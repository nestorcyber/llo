import { supabaseServer, isServerSupabaseConfigured } from './utils/supabase-server';

export async function handleAdminAction(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed. Use POST.' });
  }

  if (!isServerSupabaseConfigured || !supabaseServer) {
    return res.status(503).json({
      success: false,
      live: false,
      message: 'Supabase server is not configured. Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in server/Vercel environment variables.',
    });
  }

  const { action, payload } = req.body || {};
  if (!action) {
    return res.status(400).json({ success: false, message: 'Missing action parameter' });
  }

  try {
    switch (action) {
      case 'add_volunteer': {
        const { data, error } = await supabaseServer
          .from('volunteers')
          .insert({
            volunteer_id: payload.volunteer_id,
            full_name: payload.full_name,
            email: payload.email || null,
            phone: payload.phone || null,
            track: payload.track || 'General',
            is_active: payload.is_active ?? true,
            notes: payload.notes || null,
          })
          .select('id, volunteer_id, full_name, email, phone, track, is_active, notes, created_at, updated_at')
          .single();

        if (error) {
          if (error.code === '23505') {
            return res.status(400).json({
              success: false,
              message: `Volunteer ID "${payload.volunteer_id}" already exists in the database.`,
            });
          }
          if (error.code === '42501' || error.message?.includes('violates row-level security')) {
            return res.status(500).json({
              success: false,
              message: 'Supabase Row Level Security blocked the insert. Please verify that SUPABASE_SERVICE_ROLE_KEY is set in your Vercel/server environment variables.',
            });
          }
          throw error;
        }
        return res.status(200).json({ success: true, data });
      }

      case 'update_volunteer': {
        const { id, updates } = payload;
        const { data, error } = await supabaseServer
          .from('volunteers')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select('id, volunteer_id, full_name, email, phone, track, is_active, notes, created_at, updated_at')
          .single();

        if (error) throw error;
        return res.status(200).json({ success: true, data });
      }

      case 'import_volunteers': {
        const rows = payload.volunteers;
        if (!Array.isArray(rows)) {
          return res.status(400).json({ success: false, message: 'Invalid volunteers array' });
        }
        const { data, error } = await supabaseServer
          .from('volunteers')
          .upsert(rows, { onConflict: 'volunteer_id' })
          .select('id, volunteer_id, full_name, email, phone, track, is_active, notes, created_at, updated_at');

        if (error) throw error;
        return res.status(200).json({ success: true, data });
      }

      case 'void_submission': {
        const { submission_id, void_reason, voided_by } = payload;
        const { data, error } = await supabaseServer
          .from('task_submissions')
          .update({
            status: 'voided',
            void_reason,
            voided_at: new Date().toISOString(),
            voided_by: voided_by || null,
          })
          .eq('id', submission_id)
          .select('id, status, void_reason, voided_at, voided_by')
          .single();

        if (error) throw error;
        return res.status(200).json({ success: true, data });
      }

      case 'set_slot_override': {
        const { slot_id, override } = payload;
        const { data, error } = await supabaseServer
          .from('session_slots')
          .update({
            is_override_open: override,
          })
          .eq('id', slot_id)
          .select('id, name, session_code, scheduled_time, is_override_open')
          .single();

        if (error) throw error;
        return res.status(200).json({ success: true, data });
      }

      case 'set_active_day': {
        const { programme_id, day_number } = payload;
        const { data, error } = await supabaseServer
          .from('programmes')
          .update({
            active_day_number: day_number,
            updated_at: new Date().toISOString(),
          })
          .eq('id', programme_id)
          .select('id, title, active_day_number, status, updated_at')
          .single();

        if (error) throw error;
        return res.status(200).json({ success: true, data });
      }

      case 'update_staff_role': {
        const { staff_id, role } = payload;
        const { data, error } = await supabaseServer
          .from('staff_profiles')
          .update({
            role,
            updated_at: new Date().toISOString(),
          })
          .eq('id', staff_id)
          .select('id, email, full_name, role, is_active, updated_at')
          .single();

        if (error) throw error;
        return res.status(200).json({ success: true, data });
      }

      case 'add_audit_log': {
        const { staff_id, staff_email, action: logAction, target_type, target_id, details } = payload;
        const { data, error } = await supabaseServer
          .from('audit_logs')
          .insert({
            staff_id: staff_id || null,
            staff_email: staff_email || null,
            action: logAction || payload.action_type || 'SYSTEM_ACTION',
            target_type: target_type || payload.entity_type || 'system',
            target_id: target_id || payload.entity_id || null,
            details: details || {},
            ip_address: payload.ip_address || '127.0.0.1',
          })
          .select('id, staff_id, staff_email, action, target_type, target_id, details, ip_address, created_at')
          .single();

        if (error) throw error;
        return res.status(200).json({ success: true, data });
      }

      default:
        return res.status(400).json({ success: false, message: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    console.error(`Error executing admin action ${action}:`, err);
    const message = (err?.code === '42501' || err?.message?.includes('violates row-level security'))
      ? 'Supabase Row Level Security blocked the operation. Please configure SUPABASE_SERVICE_ROLE_KEY in your server/Vercel environment variables.'
      : err?.message || 'Database mutation failed';
    return res.status(500).json({
      success: false,
      message,
    });
  }
}

export default async function handler(req: any, res: any) {
  return handleAdminAction(req, res);
}
