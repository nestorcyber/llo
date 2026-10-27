import { supabaseServer, isServerSupabaseConfigured } from './utils/supabase-server';

export async function handleAdminData(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  if (!isServerSupabaseConfigured || !supabaseServer) {
    return res.status(200).json({
      success: false,
      live: false,
      message: 'Supabase server is not configured',
    });
  }

  try {
    const [
      { data: programmes, error: progErr },
      { data: programme_days, error: daysErr },
      { data: session_slots, error: slotsErr },
      { data: volunteers, error: volErr },
      { data: task_submissions, error: subErr },
      { data: staff_profiles, error: staffErr },
      { data: audit_logs, error: auditErr },
    ] = await Promise.all([
      supabaseServer
        .from('programmes')
        .select('id, title, slug, description, start_date, duration_days, timezone, status, active_day_number, created_at, updated_at')
        .order('created_at', { ascending: false }),
      supabaseServer
        .from('programme_days')
        .select('id, programme_id, day_number, calendar_date, theme, is_active, created_at')
        .order('day_number', { ascending: true }),
      supabaseServer
        .from('session_slots')
        .select('id, programme_day_id, session_code, name, scheduled_time, window_open_offset_minutes, window_close_offset_minutes, is_override_open, created_at')
        .order('scheduled_time', { ascending: true }),
      supabaseServer
        .from('volunteers')
        .select('id, volunteer_id, full_name, email, phone, track, is_active, notes, created_at, updated_at')
        .order('volunteer_id', { ascending: true }),
      supabaseServer
        .from('task_submissions')
        .select('id, programme_id, programme_day_id, session_slot_id, volunteer_id, status, submitted_at, submitted_ip, user_agent, voided_at, voided_by, void_reason')
        .order('submitted_at', { ascending: false }),
      supabaseServer
        .from('staff_profiles')
        .select('id, email, full_name, role, is_active, created_at, updated_at')
        .order('created_at', { ascending: true }),
      supabaseServer
        .from('audit_logs')
        .select('id, staff_id, staff_email, action, target_type, target_id, details, ip_address, created_at')
        .order('created_at', { ascending: false })
        .limit(200),
    ]);

    if (progErr || daysErr || slotsErr || volErr || subErr || staffErr || auditErr) {
      console.warn('Admin data query warnings:', {
        progErr,
        daysErr,
        slotsErr,
        volErr,
        subErr,
        staffErr,
        auditErr,
      });
    }

    if (res.setHeader) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    return res.status(200).json({
      success: true,
      live: true,
      data: {
        programmes: programmes || [],
        programme_days: programme_days || [],
        session_slots: session_slots || [],
        volunteers: volunteers || [],
        task_submissions: task_submissions || [],
        staff_profiles: staff_profiles || [],
        audit_logs: audit_logs || [],
      },
    });
  } catch (err: any) {
    console.error('Error fetching admin data from Supabase:', err);
    return res.status(500).json({
      success: false,
      live: false,
      message: err?.message || 'Failed to fetch admin data from Supabase',
    });
  }
}

export default async function handler(req: any, res: any) {
  return handleAdminData(req, res);
}
