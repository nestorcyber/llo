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

  it('allows volunteers to check in tasks on the newly activated day', () => {
    const staff = dataStore.getStaff()[0];

    // Activate Day 8
    dataStore.setActiveProgrammeDay(8, staff, true);

    const schedule = dataStore.getPublicSchedule();
    expect(schedule.current_day.day_number).toBe(8);

    const morningSlot = schedule.slots.find(s => s.session_code === 'morning')!;
    expect(morningSlot).toBeDefined();
    expect(morningSlot.tasks.length).toBeGreaterThan(0);

    const task = morningSlot.tasks[0];

    // Volunteer check-in for Day 8
    const subResult = dataStore.submitTask({
      volunteer_id: 'LLO-VOL-002',
      session_slot_id: morningSlot.id,
      session_task_id: task.id,
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
});
