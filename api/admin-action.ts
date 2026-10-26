import { supabaseServer, isServerSupabaseConfigured } from './utils/supabase-server';

export async function handleAdminAction(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed. Use POST.' });
  }

  if (!isServerSupabaseConfigured || !supabaseServer) {
    return res.status(200).json({
      success: false,
      live: false,
      message: 'Supabase server is not configured, running in local fallback',
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
          .select()
          .single();

        if (error) {
          if (error.code === '23505') {
            return res.status(400).json({
              success: false,
              message: `Volunteer ID "${payload.volunteer_id}" already exists in the database.`,
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
          .select()
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
          .select();

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
          .select()
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
          .select()
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
          .select()
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
          .select()
          .single();

        if (error) throw error;
        return res.status(200).json({ success: true, data });
      }

      case 'add_audit_log': {
        const { staff_id, action_type, entity_type, entity_id, details } = payload;
        const { data, error } = await supabaseServer
          .from('audit_logs')
          .insert({
            staff_id: staff_id || null,
            action_type,
            entity_type,
            entity_id: entity_id || null,
            details: details || {},
            ip_address: '127.0.0.1',
          })
          .select()
          .single();

        if (error) throw error;
        return res.status(200).json({ success: true, data });
      }

      default:
        return res.status(400).json({ success: false, message: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    console.error(`Error executing admin action ${action}:`, err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Database mutation failed',
    });
  }
}

export default async function handler(req: any, res: any) {
  return handleAdminAction(req, res);
}
