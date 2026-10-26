import { normalizeVolunteerId, isValidVolunteerIdFormat } from '../src/lib/validation';
import { isSessionWindowOpen, formatLagosDateTime } from '../src/lib/lagos-time';
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
  if (!body || !body.volunteer_id || !body.session_task_id || !body.session_slot_id) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: volunteer_id, session_task_id, and session_slot_id must be provided.',
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
      message: `Too many submission attempts. Please wait ${rateCheck.retryAfterSeconds} seconds before trying again.`,
      error_code: 'RATE_LIMITED',
    });
  }

  // If Supabase service role is configured, execute via Supabase with SQL constraints
  if (isServerSupabaseConfigured && supabaseServer) {
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

      // 2. Resolve task and session slot
      const { data: task, error: taskErr } = await supabaseServer
        .from('session_tasks')
        .select(`
          id,
          title,
          status,
          session_slot_id,
          session_slot:session_slots (
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
                status
              )
            )
          )
        `)
        .eq('id', body.session_task_id)
        .maybeSingle();

      if (taskErr || !task) {
        return res.status(404).json({
          success: false,
          message: 'Selected task was not found.',
          error_code: 'INVALID_TASK',
        });
      }

      if (task.session_slot_id !== body.session_slot_id) {
        return res.status(400).json({
          success: false,
          message: 'Task does not belong to the selected session.',
          error_code: 'TASK_SESSION_MISMATCH',
        });
      }

      if (task.status !== 'open') {
        return res.status(400).json({
          success: false,
          message: `This task is marked as "${task.status}" and cannot accept submissions.`,
          error_code: 'INVALID_TASK',
        });
      }

      // Extract slot & day
      const slot = task.session_slot as any;
      const day = slot?.programme_day as any;
      const programme = day?.programme as any;

      if (!slot || !day || programme?.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Programme or session is not currently active.',
          error_code: 'SESSION_CLOSED',
        });
      }

      // 3. Confirm session window in Africa/Lagos
      const isOpen = isSessionWindowOpen(slot, day.calendar_date);
      if (!isOpen) {
        return res.status(400).json({
          success: false,
          message: `Submission closed: ${slot.name} is outside its permitted submission window.`,
          error_code: 'SESSION_CLOSED',
        });
      }

      // 4. Generate server timestamp & Insert submission record
      const serverTimestamp = new Date().toISOString();
      const userAgent = typeof req.headers?.['user-agent'] === 'string' ? req.headers['user-agent'] : 'Web Client';

      const { data: newSub, error: insertErr } = await supabaseServer
        .from('task_submissions')
        .insert({
          programme_id: programme.id,
          programme_day_id: day.id,
          session_slot_id: slot.id,
          session_task_id: task.id,
          volunteer_id: volunteer.id,
          status: 'reported',
          submitted_at: serverTimestamp,
          submitted_ip: clientIp,
          user_agent: userAgent,
        })
        .select()
        .single();

      if (insertErr) {
        // PostgreSQL error 23505 = unique_violation
        if (insertErr.code === '23505' || insertErr.message?.includes('duplicate key')) {
          return res.status(409).json({
            success: false,
            message: `Duplicate submission rejected: You have already checked in for "${task.title}".`,
            error_code: 'DUPLICATE_SUBMISSION',
          });
        }
        throw insertErr;
      }

      return res.status(201).json({
        success: true,
        message: 'Participation recorded successfully!',
        submission: {
          id: newSub.id,
          volunteer_id: volunteer.volunteer_id,
          volunteer_name: volunteer.full_name,
          task_title: task.title,
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
        message: 'An internal server error occurred while recording submission.',
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
