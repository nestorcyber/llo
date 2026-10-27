import { PublicScheduleData, SubmissionPayload, SubmissionResult } from '../types';
import { dataStore } from './data-store';
import { supabase, isSupabaseConfigured } from './supabase';
import { resolveVolunteerInput } from './validation';
import { formatLagosDateTime } from './lagos-time';

/**
 * API client for the public check-in interface.
 * Attempts server endpoint /api/submissions and /api/public-schedule.
 * If running purely in client/offline mode, gracefully executes through local dataStore or direct Supabase.
 */

export async function fetchPublicSchedule(dayNumber?: number): Promise<PublicScheduleData> {
  try {
    const url = dayNumber ? `/api/public-schedule?day=${dayNumber}` : '/api/public-schedule';
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Falling back to local data store for public schedule:', err);
  }

  // Fallback to data store (ensure synced first if possible)
  if (!dataStore.isLiveConnected()) {
    await dataStore.syncWithLiveDatabase();
  }
  return dataStore.getPublicSchedule(dayNumber);
}

export async function submitVolunteerTask(payload: SubmissionPayload): Promise<SubmissionResult> {
  // 1. Attempt serverless API first
  try {
    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data: SubmissionResult = await res.json().catch(() => null);
    if (res.ok && data?.success) {
      return data;
    }
    // If the server explicitly rejected due to duplicate or inactive, return that business error
    if (data && (data.error_code === 'DUPLICATE_SUBMISSION' || data.error_code === 'INACTIVE_VOLUNTEER')) {
      return data;
    }
  } catch (err) {
    console.warn('Network error reaching /api/submissions, falling back to direct Supabase:', err);
  }

  // 2. Direct Supabase client fallback
  if (isSupabaseConfigured && supabase) {
    try {
      const normalizedId = resolveVolunteerInput(payload.volunteer_id);
      const rawInput = (payload.volunteer_id || '').trim();

      // Look up volunteer by volunteer_id or name
      let { data: volunteer } = await supabase
        .from('volunteers')
        .select('id, volunteer_id, full_name, is_active')
        .ilike('volunteer_id', normalizedId)
        .maybeSingle();

      if (!volunteer && rawInput) {
        const { data: byName } = await supabase
          .from('volunteers')
          .select('id, volunteer_id, full_name, is_active')
          .ilike('full_name', `%${rawInput}%`)
          .maybeSingle();
        if (byName) volunteer = byName;
      }

      if (!volunteer) {
        return {
          success: false,
          message: `Volunteer ID "${payload.volunteer_id}" was not found. Please contact your coordinator.`,
          error_code: 'INVALID_VOLUNTEER_ID',
        };
      }

      if (!volunteer.is_active) {
        return {
          success: false,
          message: `Volunteer account for ${volunteer.full_name} is currently inactive.`,
          error_code: 'INACTIVE_VOLUNTEER',
        };
      }

      // Check slot and day
      const { data: slot } = await supabase
        .from('session_slots')
        .select('id, name, scheduled_time, window_open_offset_minutes, window_close_offset_minutes, is_override_open, programme_day:programme_days(id, day_number, calendar_date, programme:programmes(id, status, active_day_number))')
        .eq('id', payload.session_slot_id)
        .maybeSingle();

      if (!slot) {
        return {
          success: false,
          message: 'Selected session slot was not found.',
          error_code: 'INVALID_SESSION',
        };
      }

      const day: any = (slot as any).programme_day;
      const prog: any = day?.programme;

      // Check duplicate check-in
      const { data: existingSub } = await supabase
        .from('task_submissions')
        .select('id, submitted_at')
        .eq('volunteer_id', volunteer.id)
        .eq('session_slot_id', slot.id)
        .neq('status', 'voided')
        .maybeSingle();

      if (existingSub) {
        return {
          success: false,
          message: `Duplicate check-in rejected: You have already checked in for ${slot.name}.`,
          error_code: 'DUPLICATE_SUBMISSION',
        };
      }

      const serverTimestamp = new Date().toISOString();
      const { data: newSub, error: insertErr } = await supabase
        .from('task_submissions')
        .insert({
          programme_id: prog?.id,
          programme_day_id: day?.id,
          session_slot_id: slot.id,
          volunteer_id: volunteer.id,
          status: 'reported',
          submitted_at: serverTimestamp,
          submitted_ip: '127.0.0.1',
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Web Client',
        })
        .select('id')
        .single();

      if (!insertErr && newSub) {
        return {
          success: true,
          message: 'Check-in recorded successfully!',
          submission: {
            id: newSub.id,
            volunteer_id: volunteer.volunteer_id,
            volunteer_name: volunteer.full_name,
            session_name: slot.name,
            day_number: day?.day_number || 1,
            submitted_at: serverTimestamp,
            submitted_at_lagos: formatLagosDateTime(serverTimestamp),
          },
        };
      }
    } catch (clientErr) {
      console.warn('Direct Supabase checkin error, falling back to local business engine:', clientErr);
    }
  }

  // 3. Fallback to local business engine
  return dataStore.submitTask(payload);
}

export async function fetchAdminData(): Promise<any> {
  try {
    const res = await fetch('/api/admin-data', {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Could not fetch admin data from /api/admin-data:', err);
  }
  return null;
}

export async function executeAdminAction(action: string, payload: any): Promise<any> {
  try {
    const res = await fetch('/api/admin-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ action, payload }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn(`Failed to execute admin action ${action}:`, err);
  }
  return null;
}

