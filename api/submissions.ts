import { normalizeVolunteerId, isValidVolunteerIdFormat } from '../src/lib/validation';
import { isSessionWindowOpen, formatLagosDateTime, getLagosDateString } from '../src/lib/lagos-time';
import { checkRateLimit } from './utils/rate-limiter';
import { supabaseServer, isServerSupabaseConfigured } from './utils/supabase-server';
import { dataStore } from '../src/lib/data-store';
import { SubmissionPayload } from '../src/types';

export interface ApiRequest {
  method?: string;
  body?: SubmissionPayload;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

export interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (data: unknown) => void;
  setHeader?: (name: string, value: string) => void;
}

export async function handleSubmission(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use POST.',
      error_code: 'SERVER_ERROR',
    });
  }

  const clientIp = (
    (typeof req.headers?.['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : req.socket?.remoteAddress) || '127.0.0.1'
  );

  const body = req.body;
  if (!body || !body.volunteer_id || !body.session_slot_id) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: volunteer_id and session_slot_id must be provided.',
      error_code: 'INVALID_VOLUNTEER_ID',
    });
  }

  const normalizedId = normalizeVolunteerId(body.volunteer_id);

  // Validate ID format
  if (!isValidVolunteerIdFormat(normalizedId)) {
    return res.status(400).json({
      success: false,
      message: `Invalid Volunteer ID format: "${normalizedId}". Expected format: LLO-VOL-###`,
      error_code: 'INVALID_VOLUNTEER_ID',
    });
  }

  // Rate Limiting per IP + Volunteer ID: max 5 attempts per 10 seconds
  const rateLimitKey = `${clientIp}:${normalizedId}`;
  const rateCheck = checkRateLimit(rateLimitKey, 5, 10000);
  if (!rateCheck.allowed) {
    if (res.setHeader) {
      res.setHeader('Retry-After', String(rateCheck.retryAfterSeconds));
    }
    return res.status(429).json({
      success: false,
      message: `Too many check-in attempts. Please wait ${rateCheck.retryAfterSeconds} seconds before trying again.`,
      error_code: 'RATE_LIMITED',
    });
  }

  // If Supabase service role is configured (and not running in vitest unit test runner), execute via Supabase
  if (!process.env.VITEST && isServerSupabaseConfigured && supabaseServer) {
    try {
      // 1. Resolve active volunteer
      const { data: volunteer, error: volErr } = await supabaseServer
        .from('volunteers')
        .select('id, volunteer_id, full_name, is_active, pin_hash')
        .eq('volunteer_id', normalizedId)
        .maybeSingle();

      if (volErr || !volunteer) {
        return res.status(404).json({
          success: false,
          message: `Volunteer ID "${normalizedId}" was not found. Please contact your coordinator.`,
          error_code: 'INVALID_VOLUNTEER_ID',
        });
      }

      if (!volunteer.is_active) {
        return res.status(403).json({
          success: false,
          message: `Volunteer ID "${normalizedId}" is inactive. Contact the administration team.`,
          error_code: 'INACTIVE_VOLUNTEER',
        });
      }

      // Optional PIN verification if PIN hash is configured on the volunteer record
      if (volunteer.pin_hash && body.pin) {
        // verify PIN hash here (architecture hook)
      }

      // 2. Resolve session slot
      const { data: slot, error: slotErr } = await supabaseServer
        .from('session_slots')
        .select(`
          id,
          name,
          session_code,
          scheduled_time,
          window_open_offset_minutes,
          window_close_offset_minutes,
          is_override_open,
          programme_day:programme_days (
            id,
            day_number,
            calendar_date,
            programme:programmes (
              id,
              status,
              active_day_number
            )
          )
        `)
        .eq('id', body.session_slot_id)
        .maybeSingle();

      if (slotErr || !slot) {
        return res.status(400).json({
          success: false,
          message: 'Selected session slot was not found.',
          error_code: 'INVALID_SESSION',
        });
      }

      const day = (slot as any).programme_day;
      const programme = day?.programme;

      if (!slot || !day || programme?.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Programme or session is not currently active.',
          error_code: 'SESSION_CLOSED',
        });
      }

      // 3. Confirm session window in Africa/Lagos
      // When day is the admin-activated day or today, evaluate window against todayLagos
      const todayLagos = getLagosDateString();
      const evalDate = (programme.active_day_number === day.day_number || day.calendar_date === todayLagos)
        ? todayLagos
        : day.calendar_date;
      const isOpen = isSessionWindowOpen(slot, evalDate);
      if (!isOpen) {
        return res.status(400).json({
          success: false,
          message: `Check-in closed: ${slot.name} is outside its permitted window.`,
          error_code: 'SESSION_CLOSED',
        });
      }

      // Check duplicate check-in
      const { data: existingSub } = await supabaseServer
        .from('task_submissions')
        .select('id, submitted_at')
        .eq('volunteer_id', volunteer.id)
        .eq('session_slot_id', slot.id)
        .neq('status', 'voided')
        .maybeSingle();

      if (existingSub) {
        return res.status(409).json({
          success: false,
          message: `Duplicate check-in rejected: You have already checked in for ${slot.name}.`,
          error_code: 'DUPLICATE_SUBMISSION',
        });
      }

      // 4. Generate server timestamp & Insert check-in record
      const serverTimestamp = new Date().toISOString();
      const userAgent = typeof req.headers?.['user-agent'] === 'string' ? req.headers['user-agent'] : 'Web Client';

      const { data: newSub, error: insertErr } = await supabaseServer
        .from('task_submissions')
        .insert({
          programme_id: programme.id,
          programme_day_id: day.id,
          session_slot_id: slot.id,
          volunteer_id: volunteer.id,
          status: 'reported',
          submitted_at: serverTimestamp,
          submitted_ip: clientIp,
          user_agent: userAgent,
        })
        .select('id, programme_id, programme_day_id, session_slot_id, volunteer_id, status, submitted_at, submitted_ip, user_agent')
        .single();

      if (insertErr) {
        if (insertErr.code === '23505' || insertErr.message?.includes('duplicate key')) {
          return res.status(409).json({
            success: false,
            message: `Duplicate check-in rejected: You have already checked in for ${slot.name}.`,
            error_code: 'DUPLICATE_SUBMISSION',
          });
        }
        throw insertErr;
      }

      return res.status(201).json({
        success: true,
        message: 'Check-in recorded successfully!',
        submission: {
          id: newSub.id,
          volunteer_id: volunteer.volunteer_id,
          volunteer_name: volunteer.full_name,
          session_name: slot.name,
          day_number: day.day_number,
          submitted_at: serverTimestamp,
          submitted_at_lagos: formatLagosDateTime(serverTimestamp),
        },
      });
    } catch (err: any) {
      console.error('Supabase submission error:', err);
      return res.status(500).json({
        success: false,
        message: 'An internal server error occurred while recording check-in.',
        error_code: 'SERVER_ERROR',
      });
    }
  }

  // Fallback to dataStore (offline development / standalone mode)
  const userAgent = typeof req.headers?.['user-agent'] === 'string' ? req.headers['user-agent'] : 'Web Client';
  const result = dataStore.submitTask(body, clientIp, userAgent);

  if (!result.success) {
    const statusCode =
      result.error_code === 'INVALID_VOLUNTEER_ID' ? 404 :
      result.error_code === 'INACTIVE_VOLUNTEER' ? 403 :
      result.error_code === 'DUPLICATE_SUBMISSION' ? 409 :
      result.error_code === 'SESSION_CLOSED' ? 400 : 400;

    return res.status(statusCode).json(result);
  }

  return res.status(201).json(result);
}

// Default export for Vercel Serverless Function
export default async function handler(req: any, res: any) {
  return handleSubmission(req, res);
}
