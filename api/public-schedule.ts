import { dataStore } from '../src/lib/data-store';
import { supabaseServer, isServerSupabaseConfigured } from './utils/supabase-server';
import {
  getLagosDateString,
  formatLagosDateTime,
  isSessionWindowOpen,
  getSessionWindowStatus,
  getNextSessionInfo,
} from '../src/lib/lagos-time';

export async function handlePublicSchedule(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const url = new URL(req.url || '', 'http://localhost');
  const dayParam = url.searchParams.get('day');
  const requestedDay = dayParam ? parseInt(dayParam, 10) : undefined;

  if (!process.env.VITEST && isServerSupabaseConfigured && supabaseServer) {
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

      // Priority: 1. Requested day param -> 2. Admin configured active_day_number -> 3. Today's Lagos calendar date -> 4. Day 1
      let currentDay = requestedDay ? days?.find(d => d.day_number === requestedDay) : undefined;
      if (!currentDay && prog.active_day_number) {
        currentDay = days?.find(d => d.day_number === prog.active_day_number);
      }
      if (!currentDay) {
        currentDay = days?.find(d => d.calendar_date === todayLagos);
      }
      if (!currentDay) {
        currentDay = days?.[0];
      }

      if (!currentDay) {
        return res.status(404).json({ success: false, message: 'Programme day not found' });
      }

      const { data: slots } = await supabaseServer
        .from('session_slots')
        .select('*')
        .eq('programme_day_id', currentDay.id)
        .order('scheduled_time', { ascending: true });

      // Fetch active checkins for today's slots to include counts
      const { data: subs } = await supabaseServer
        .from('task_submissions')
        .select('id, session_slot_id')
        .eq('programme_day_id', currentDay.id)
        .neq('status', 'voided');

      const checkinsMap: Record<string, number> = {};
      if (subs) {
        for (const sub of subs) {
          checkinsMap[sub.session_slot_id] = (checkinsMap[sub.session_slot_id] || 0) + 1;
        }
      }

      const now = new Date();
      let openSlotFound: any = null;

      const enrichedSlots = (slots || []).map(slot => {
        const isWindowOpen = isSessionWindowOpen(slot, currentDay.calendar_date, now);
        // Strictly enforce only one session active at a time
        const isSlotActive = isWindowOpen && !openSlotFound;
        const windowStatus = isSlotActive ? 'open' : getSessionWindowStatus(slot, currentDay.calendar_date, now);

        const enriched = {
          ...slot,
          is_open: isSlotActive,
          window_status: windowStatus,
          checkins_count: checkinsMap[slot.id] || 0,
        };

        if (isSlotActive) {
          openSlotFound = enriched;
        }

        return enriched;
      });

      const nextSession = getNextSessionInfo(currentDay.calendar_date, slots || [], now);

      if (res.setHeader) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      }
      return res.status(200).json({
        programme: {
          id: prog.id,
          title: prog.title,
          start_date: prog.start_date,
          duration_days: prog.duration_days,
          timezone: prog.timezone,
          status: prog.status,
          active_day_number: currentDay.day_number,
        },
        current_day: {
          id: currentDay.id,
          day_number: currentDay.day_number,
          calendar_date: currentDay.calendar_date,
          theme: currentDay.theme,
          is_active: currentDay.is_active,
        },
        server_time: now.toISOString(),
        server_lagos_time: formatLagosDateTime(now),
        slots: enrichedSlots,
        active_slot: openSlotFound,
        next_session: nextSession,
        available_days: (days || []).map(d => ({
          id: d.id,
          day_number: d.day_number,
          calendar_date: d.calendar_date,
          is_active: d.is_active,
        })),
      });
    } catch (err) {
      console.error('Public schedule error:', err);
    }
  }

  // Fallback to dataStore
  if (res.setHeader) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  }
  const data = dataStore.getPublicSchedule(requestedDay);
  return res.status(200).json(data);
}

export default async function handler(req: any, res: any) {
  return handlePublicSchedule(req, res);
}
