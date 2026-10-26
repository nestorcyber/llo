import { describe, it, expect } from 'vitest';
import {
  LAGOS_TIMEZONE,
  LAGOS_OFFSET_HOURS,
  lagosTimeToUtcDate,
  calculateSessionWindow,
  isSessionWindowOpen,
  getSessionWindowStatus,
  format12HourTime,
  getLagosDateString,
} from '../src/lib/lagos-time';

describe('Africa/Lagos Timezone Calculations', () => {
  it('verifies Lagos is UTC+1 (West Africa Time)', () => {
    expect(LAGOS_OFFSET_HOURS).toBe(1);
    expect(LAGOS_TIMEZONE).toBe('Africa/Lagos');
  });

  it('correctly converts Lagos local calendar date and time to UTC Date', () => {
    // 10:00:00 AM Lagos time on 2026-10-26 is 09:00:00 UTC
    const dateStr = '2026-10-26';
    const timeStr = '10:00:00';
    const utcDate = lagosTimeToUtcDate(dateStr, timeStr);

    expect(utcDate.getUTCFullYear()).toBe(2026);
    expect(utcDate.getUTCMonth()).toBe(9); // 0-indexed October
    expect(utcDate.getUTCDate()).toBe(26);
    expect(utcDate.getUTCHours()).toBe(9);
    expect(utcDate.getUTCMinutes()).toBe(0);
  });

  it('handles midnight date boundary correctly', () => {
    // 00:30:00 AM Lagos on 2026-10-26 is 23:30:00 PM on 2026-10-25 UTC
    const dateStr = '2026-10-26';
    const timeStr = '00:30:00';
    const utcDate = lagosTimeToUtcDate(dateStr, timeStr);

    expect(utcDate.getUTCDate()).toBe(25);
    expect(utcDate.getUTCHours()).toBe(23);
    expect(utcDate.getUTCMinutes()).toBe(30);
  });

  it('calculates session windows accurately for Morning (10:00 AM)', () => {
    // Window open offset: 30 mins before (09:30 AM Lagos = 08:30 UTC)
    // Window close offset: 120 mins after (12:00 PM Lagos = 11:00 UTC)
    const { windowStartUtc, windowEndUtc, scheduledUtc } = calculateSessionWindow(
      '2026-10-26',
      '10:00:00',
      30,
      120
    );

    expect(scheduledUtc.toISOString()).toBe('2026-10-26T09:00:00.000Z');
    expect(windowStartUtc.toISOString()).toBe('2026-10-26T08:30:00.000Z');
    expect(windowEndUtc.toISOString()).toBe('2026-10-26T11:00:00.000Z');
  });

  it('calculates session windows accurately for Afternoon (3:00 PM)', () => {
    // 15:00:00 Lagos = 14:00 UTC
    // Open 30m prior: 13:30 UTC
    // Close 120m after: 16:00 UTC
    const { windowStartUtc, windowEndUtc } = calculateSessionWindow(
      '2026-10-26',
      '15:00:00',
      30,
      120
    );

    expect(windowStartUtc.toISOString()).toBe('2026-10-26T13:30:00.000Z');
    expect(windowEndUtc.toISOString()).toBe('2026-10-26T16:00:00.000Z');
  });

  it('calculates session windows accurately for Evening (8:00 PM)', () => {
    // 20:00:00 Lagos = 19:00 UTC
    // Open 30m prior: 18:30 UTC
    // Close 120m after: 21:00 UTC
    const { windowStartUtc, windowEndUtc } = calculateSessionWindow(
      '2026-10-26',
      '20:00:00',
      30,
      120
    );

    expect(windowStartUtc.toISOString()).toBe('2026-10-26T18:30:00.000Z');
    expect(windowEndUtc.toISOString()).toBe('2026-10-26T21:00:00.000Z');
  });

  it('evaluates whether a session window is open or closed based on current time', () => {
    const slot = {
      scheduled_time: '10:00:00',
      window_open_offset_minutes: 30,
      window_close_offset_minutes: 120,
    };
    const dateStr = '2026-10-26';

    // 08:00 UTC (09:00 AM Lagos) -> too early (window opens at 09:30 AM Lagos = 08:30 UTC)
    const tooEarly = new Date('2026-10-26T08:00:00.000Z');
    expect(isSessionWindowOpen(slot, dateStr, tooEarly)).toBe(false);
    expect(getSessionWindowStatus(slot, dateStr, tooEarly)).toBe('upcoming');

    // 09:00 UTC (10:00 AM Lagos) -> perfectly inside window
    const insideWindow = new Date('2026-10-26T09:00:00.000Z');
    expect(isSessionWindowOpen(slot, dateStr, insideWindow)).toBe(true);
    expect(getSessionWindowStatus(slot, dateStr, insideWindow)).toBe('open');

    // 11:30 UTC (12:30 PM Lagos) -> closed (window closed at 12:00 PM Lagos = 11:00 UTC)
    const tooLate = new Date('2026-10-26T11:30:00.000Z');
    expect(isSessionWindowOpen(slot, dateStr, tooLate)).toBe(false);
    expect(getSessionWindowStatus(slot, dateStr, tooLate)).toBe('closed');
  });

  it('respects manual override states over time windows', () => {
    const slotOverrideOpen = {
      scheduled_time: '10:00:00',
      window_open_offset_minutes: 30,
      window_close_offset_minutes: 120,
      is_override_open: true, // Force Open
    };

    const slotOverrideClosed = {
      scheduled_time: '10:00:00',
      window_open_offset_minutes: 30,
      window_close_offset_minutes: 120,
      is_override_open: false, // Force Closed
    };

    const earlyTime = new Date('2026-10-26T02:00:00.000Z');
    const midDayTime = new Date('2026-10-26T09:00:00.000Z');

    // Override open forces it open even at 2 AM
    expect(isSessionWindowOpen(slotOverrideOpen, '2026-10-26', earlyTime)).toBe(true);
    // Override closed forces it closed even during official scheduled hours
    expect(isSessionWindowOpen(slotOverrideClosed, '2026-10-26', midDayTime)).toBe(false);
  });

  it('formats 12-hour time correctly', () => {
    expect(format12HourTime('10:00:00')).toBe('10:00 AM');
    expect(format12HourTime('15:00:00')).toBe('3:00 PM');
    expect(format12HourTime('20:00:00')).toBe('8:00 PM');
  });
});
