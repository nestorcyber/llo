import { describe, it, expect, beforeEach } from 'vitest';
import { dataStore } from '../src/lib/data-store';

describe('Admin Active Programme Day Activation for Volunteers', () => {
  beforeEach(() => {
    dataStore.resetToDefault();
  });

  it('defaults to Day 1 as active day', () => {
    const schedule = dataStore.getPublicSchedule();
    expect(schedule.current_day.day_number).toBe(1);
    expect(schedule.programme.active_day_number).toBe(1);
  });

  it('allows administrator to set any day (e.g. Day 4) as active for volunteer access', () => {
    const staff = dataStore.getStaff()[0]; // Owner

    // Activate Day 4
    const result = dataStore.setActiveProgrammeDay(4, staff, true);
    expect(result.success).toBe(true);
    expect(result.active_day_number).toBe(4);

    // Public schedule should now serve Day 4 as the current active day
    const updatedSchedule = dataStore.getPublicSchedule();
    expect(updatedSchedule.current_day.day_number).toBe(4);
    expect(updatedSchedule.programme.active_day_number).toBe(4);

    // Verify session slots for Day 4 are open
    const openSlots = updatedSchedule.slots.filter(s => s.is_open);
    expect(openSlots.length).toBeGreaterThan(0);

    // Verify audit log recorded the change
    const logs = dataStore.getAuditLogs();
    const activeDayLog = logs.find(l => l.action === 'ACTIVE_DAY_CHANGED');
    expect(activeDayLog).toBeDefined();
    expect(activeDayLog?.details).toMatchObject({ day_number: 4 });
  });

  it('allows volunteers to check in on the newly activated day', () => {
    const staff = dataStore.getStaff()[0];

    // Activate Day 8
    dataStore.setActiveProgrammeDay(8, staff, true);

    const schedule = dataStore.getPublicSchedule();
    expect(schedule.current_day.day_number).toBe(8);

    const morningSlot = schedule.slots.find(s => s.session_code === 'morning')!;
    expect(morningSlot).toBeDefined();

    // Volunteer check-in for Day 8
    const subResult = dataStore.submitTask({
      volunteer_id: 'LLO-VOL-002',
      session_slot_id: morningSlot.id,
    });

    expect(subResult.success).toBe(true);
    expect(subResult.submission?.day_number).toBe(8);
    expect(subResult.submission?.volunteer_name).toBe('Amina Yusuf');
  });

  it('rejects setting a nonexistent day number', () => {
    const staff = dataStore.getStaff()[0];
    const invalidResult = dataStore.setActiveProgrammeDay(99, staff);
    expect(invalidResult.success).toBe(false);
    expect(invalidResult.message).toContain('does not exist');
  });

  it('preserves scheduled calendar_date when Day 3 is activated and allows check-in when overridden open', () => {
    const staff = dataStore.getStaff()[0];
    const day3 = dataStore.getProgrammeDays().find(d => d.day_number === 3)!;
    const initialCalendarDate = day3.calendar_date;

    // Admin sets Day 3 active
    const res = dataStore.setActiveProgrammeDay(3, staff, false);
    expect(res.success).toBe(true);

    // Verify calendar date is intact (not overwritten)
    const schedule = dataStore.getPublicSchedule();
    expect(schedule.current_day.day_number).toBe(3);
    expect(schedule.current_day.calendar_date).toBe(initialCalendarDate);

    // Force open morning session for Day 3
    const morningSlot = schedule.slots.find(s => s.session_code === 'morning')!;
    dataStore.setSlotOverride(morningSlot.id, true, staff);

    const refreshedSchedule = dataStore.getPublicSchedule();
    const refreshedSlot = refreshedSchedule.slots.find(s => s.id === morningSlot.id)!;
    expect(refreshedSlot.is_open).toBe(true);

    // Volunteer check-in succeeds without date mismatch
    const sub = dataStore.submitTask({
      volunteer_id: 'LLO-VOL-001',
      session_slot_id: morningSlot.id,
    });
    expect(sub.success).toBe(true);
    expect(sub.submission?.day_number).toBe(3);
  });
});
