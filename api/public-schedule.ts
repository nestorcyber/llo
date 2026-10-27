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
        .select('id, title, start_date, duration_days, timezone, status, active_day_number')
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
        .select('id, programme_id, day_number, calendar_date, theme, is_active')
        .eq('programme_id', prog.id)
        .order('day_number', { ascending: true });

      // Priority:
      // 1. Explicit requested day param (?day=X)
      // 2. Explicit admin override IF active_day_number is set to today or a future day (not an elapsed past day)
      // 3. Today's Lagos calendar date (automatic progression: Day 2, Day 3, etc.)
      // 4. Default to first day
      const todayDay = days?.find(d => d.calendar_date === todayLagos);
      let currentDay = requestedDay ? days?.find(d => d.day_number === requestedDay) : undefined;

      if (!currentDay && prog.active_day_number) {
        const overrideDay = days?.find(d => d.day_number === prog.active_day_number);
        if (overrideDay) {
          // If overrideDay is today or in the future, honor it. If it was left on a past day, advance to today!
          if (!todayDay || overrideDay.day_number >= todayDay.day_number) {
            currentDay = overrideDay;
          }
        }
      }

      if (!currentDay) {
        currentDay = todayDay;
      }

      if (!currentDay) {
        currentDay = days?.[0];
      }

      if (!currentDay) {
        return res.status(404).json({ success: false, message: 'Programme day not found' });
      }

      const { data: slots } = await supabaseServer
        .from('session_slots')
        .select('id, programme_day_id, session_code, name, scheduled_time, window_open_offset_minutes, window_close_offset_minutes, is_override_open')
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

      // When evaluating session windows, if currentDay is the active day set by admin or today,
      // evaluate against todayLagos so scheduled times (08:00, 15:00, 19:00 WAT) trigger today
      // without altering the day's original calendar date.
      const evalDate = (prog.active_day_number === currentDay.day_number || currentDay.calendar_date === todayLagos)
        ? todayLagos
        : currentDay.calendar_date;

      const enrichedSlots = (slots || []).map(slot => {
        const isWindowOpen = isSessionWindowOpen(slot, evalDate, now);
        // Strictly enforce only one session active at a time
        const isSlotActive = isWindowOpen && !openSlotFound;
        const windowStatus = isSlotActive ? 'open' : getSessionWindowStatus(slot, evalDate, now);

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

      const nextSession = getNextSessionInfo(evalDate, slots || [], now);

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
