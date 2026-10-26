import { dataStore } from '../src/lib/data-store';
import { supabaseServer, isServerSupabaseConfigured } from './utils/supabase-server';
import { getLagosDateString, formatLagosDateTime, isSessionWindowOpen, getSessionWindowStatus } from '../src/lib/lagos-time';

export async function handlePublicSchedule(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  if (isServerSupabaseConfigured && supabaseServer) {
    try {
      const todayLagos = getLagosDateString();
      const { data: prog, error: progErr } = await supabaseServer
        .from('programmes')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (progErr || !prog) {
        return res.status(404).json({ success: false, message: 'No active programme found' });
      }

      // Get programme days
      const { data: days } = await supabaseServer
        .from('programme_days')
        .select('*')
        .eq('programme_id', prog.id)
        .order('day_number', { ascending: true });

      const currentDay = days?.find(d => d.calendar_date === todayLagos) || days?.[0];

      if (!currentDay) {
        return res.status(404).json({ success: false, message: 'Programme day not found' });
      }

      const { data: slots } = await supabaseServer
        .from('session_slots')
        .select(`
          *,
          session_tasks (*)
        `)
        .eq('programme_day_id', currentDay.id);

      const enrichedSlots = (slots || []).map(slot => {
        const isOpen = isSessionWindowOpen(slot, currentDay.calendar_date);
        const windowStatus = getSessionWindowStatus(slot, currentDay.calendar_date);
        const tasks = (slot.session_tasks || []).filter((t: any) => t.status === 'open');

        return {
          ...slot,
          is_open: isOpen,
          window_status: windowStatus,
          tasks,
        };
      });

      const now = new Date();
      return res.status(200).json({
        programme: {
          id: prog.id,
          title: prog.title,
          start_date: prog.start_date,
          duration_days: prog.duration_days,
          timezone: prog.timezone,
          status: prog.status,
        },
        current_day: {
          id: currentDay.id,
          day_number: currentDay.day_number,
          calendar_date: currentDay.calendar_date,
          theme: currentDay.theme,
        },
        server_time: now.toISOString(),
        server_lagos_time: formatLagosDateTime(now),
        slots: enrichedSlots,
      });
    } catch (err) {
      console.error('Public schedule error:', err);
    }
  }

  // Fallback to dataStore
  const data = dataStore.getPublicSchedule();
  return res.status(200).json(data);
}

export default async function handler(req: any, res: any) {
  return handlePublicSchedule(req, res);
}
