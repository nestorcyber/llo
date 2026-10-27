/**
 * Africa/Lagos Timezone Utilities
 * Lagos is strictly UTC+1 (West Africa Time - WAT) with zero daylight savings adjustments.
 */

import { NextSessionInfo, SessionCode } from '../types';

export const LAGOS_TIMEZONE = 'Africa/Lagos';
export const LAGOS_OFFSET_HOURS = 1; // UTC+1

/**
 * Gets a Date object representing the current instant, but queries can inspect it in Lagos timezone.
 */
export function getCurrentDate(): Date {
  return new Date();
}

/**
 * Returns formatted date string "YYYY-MM-DD" for Africa/Lagos timezone.
 */
export function getLagosDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: LAGOS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // outputs YYYY-MM-DD
}

/**
 * Returns formatted time string "HH:mm:ss" (24h) for Africa/Lagos timezone.
 */
export function getLagosTimeString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: LAGOS_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return formatter.format(date);
}

/**
 * Returns human-readable Lagos time e.g. "10:15 AM WAT, 26 Oct 2026"
 */
export function formatLagosDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid Date';

  const timePart = new Intl.DateTimeFormat('en-US', {
    timeZone: LAGOS_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(d);

  const datePart = new Intl.DateTimeFormat('en-GB', {
    timeZone: LAGOS_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);

  return `${timePart} WAT, ${datePart}`;
}

/**
 * Returns human-readable 12-hour time e.g. "10:00 AM"
 */
export function format12HourTime(timeString: string): string {
  // timeString can be "10:00:00" or "10:00"
  const parts = timeString.split(':');
  if (parts.length < 2) return timeString;
  const hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

/**
 * Converts a calendar date string (YYYY-MM-DD) and a time string (HH:MM:SS) in Lagos time (UTC+1)
 * into a UTC JavaScript Date object.
 */
export function lagosTimeToUtcDate(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const timeParts = timeStr.split(':').map(Number);
  const hours = timeParts[0] || 0;
  const minutes = timeParts[1] || 0;
  const seconds = timeParts[2] || 0;

  // Lagos is UTC+1, so UTC hour = Lagos hour - 1
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours - LAGOS_OFFSET_HOURS, minutes, seconds));
  return utcDate;
}

export interface SessionWindowCalculation {
  scheduledUtc: Date;
  windowStartUtc: Date;
  windowEndUtc: Date;
}

/**
 * Calculates the UTC start and end bounds of a session window in Africa/Lagos
 */
export function calculateSessionWindow(
  calendarDateStr: string,
  scheduledTimeStr: string,
  windowOpenOffsetMins = 30,
  windowCloseOffsetMins = 120
): SessionWindowCalculation {
  const scheduledUtc = lagosTimeToUtcDate(calendarDateStr, scheduledTimeStr);
  const windowStartUtc = new Date(scheduledUtc.getTime() - windowOpenOffsetMins * 60 * 1000);
  const windowEndUtc = new Date(scheduledUtc.getTime() + windowCloseOffsetMins * 60 * 1000);

  return { scheduledUtc, windowStartUtc, windowEndUtc };
}

/**
 * Evaluates whether a session window is currently open for submissions.
 * Checks manual override first:
 * - is_override_open === true  => always open
 * - is_override_open === false => always closed
 * - is_override_open === null/undefined => follows time window
 */
export function isSessionWindowOpen(
  slot: {
    scheduled_time: string;
    window_open_offset_minutes: number;
    window_close_offset_minutes: number;
    is_override_open?: boolean | null;
  },
  calendarDateStr: string,
  currentTime: Date = new Date()
): boolean {
  if (slot.is_override_open === true) return true;
  if (slot.is_override_open === false) return false;

  const { windowStartUtc, windowEndUtc } = calculateSessionWindow(
    calendarDateStr,
    slot.scheduled_time,
    slot.window_open_offset_minutes,
    slot.window_close_offset_minutes
  );

  const nowMs = currentTime.getTime();
  return nowMs >= windowStartUtc.getTime() && nowMs <= windowEndUtc.getTime();
}

/**
 * Returns 'upcoming' | 'open' | 'closed'
 */
export function getSessionWindowStatus(
  slot: {
    scheduled_time: string;
    window_open_offset_minutes: number;
    window_close_offset_minutes: number;
    is_override_open?: boolean | null;
  },
  calendarDateStr: string,
  currentTime: Date = new Date()
): 'upcoming' | 'open' | 'closed' {
  if (slot.is_override_open === true) return 'open';
  if (slot.is_override_open === false) return 'closed';

  const { windowStartUtc, windowEndUtc } = calculateSessionWindow(
    calendarDateStr,
    slot.scheduled_time,
    slot.window_open_offset_minutes,
    slot.window_close_offset_minutes
  );

  const nowMs = currentTime.getTime();
  if (nowMs < windowStartUtc.getTime()) return 'upcoming';
  if (nowMs > windowEndUtc.getTime()) return 'closed';
  return 'open';
}

/**
 * Formats window range for human reading, e.g. "09:30 AM - 12:00 PM"
 */
export function formatSessionWindowRange(
  scheduledTimeStr: string,
  windowOpenOffsetMins: number,
  windowCloseOffsetMins: number
): string {
  // Use a dummy date to compute times
  const dummyDateStr = '2026-01-01';
  const { windowStartUtc, windowEndUtc } = calculateSessionWindow(
    dummyDateStr,
    scheduledTimeStr,
    windowOpenOffsetMins,
    windowCloseOffsetMins
  );

  const formatOptions: Intl.DateTimeFormatOptions = {
    timeZone: LAGOS_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };

  const startStr = new Intl.DateTimeFormat('en-US', formatOptions).format(windowStartUtc);
  const endStr = new Intl.DateTimeFormat('en-US', formatOptions).format(windowEndUtc);

  return `${startStr} – ${endStr} WAT`;
}

/**
 * Determines the next upcoming session and human-readable opening label
 */
export function getNextSessionInfo(
  calendarDateStr: string,
  slots: Array<{
    name: string;
    session_code: SessionCode;
    scheduled_time: string;
    window_open_offset_minutes: number;
    window_close_offset_minutes: number;
  }>,
  currentTime: Date = new Date()
): NextSessionInfo {
  // Sort slots by scheduled time
  const sorted = [...slots].sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));
  const nowMs = currentTime.getTime();

  for (const slot of sorted) {
    const { windowStartUtc } = calculateSessionWindow(
      calendarDateStr,
      slot.scheduled_time,
      slot.window_open_offset_minutes,
      slot.window_close_offset_minutes
    );

    if (nowMs < windowStartUtc.getTime()) {
      const windowRange = formatSessionWindowRange(
        slot.scheduled_time,
        slot.window_open_offset_minutes,
        slot.window_close_offset_minutes
      );
      const openTimeFormatted = format12HourTime(slot.scheduled_time);
      return {
        name: slot.name,
        session_code: slot.session_code,
        scheduled_time: slot.scheduled_time,
        window_range: windowRange,
        opens_at_label: `Today at ${openTimeFormatted} WAT (${windowRange})`,
      };
    }
  }

  // If all sessions for today have elapsed, next is tomorrow's first session (Morning)
  const firstSlot = sorted[0] || {
    name: 'Morning Session (8:00 AM)',
    session_code: 'morning' as SessionCode,
    scheduled_time: '08:00:00',
    window_open_offset_minutes: 0,
    window_close_offset_minutes: 120,
  };

  const windowRange = formatSessionWindowRange(
    firstSlot.scheduled_time,
    firstSlot.window_open_offset_minutes,
    firstSlot.window_close_offset_minutes
  );
  const openTimeFormatted = format12HourTime(firstSlot.scheduled_time);

  return {
    name: firstSlot.name,
    session_code: firstSlot.session_code,
    scheduled_time: firstSlot.scheduled_time,
    window_range: windowRange,
    opens_at_label: `Tomorrow at ${openTimeFormatted} WAT (${windowRange})`,
  };
}
