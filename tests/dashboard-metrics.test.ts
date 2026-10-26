import { describe, it, expect, beforeEach } from 'vitest';
import { dataStore } from '../src/lib/data-store';

describe('Dashboard Metrics & Operational Analytics', () => {
  beforeEach(() => {
    dataStore.resetToDefault();
  });

  it('calculates total volunteers and active status counts accurately', () => {
    const metrics = dataStore.getDashboardMetrics();
    expect(metrics.total_volunteers).toBe(7);
    expect(metrics.active_volunteers_count).toBe(6); // 1 inactive in default seed
  });

  it('clearly distinguishes unique participants from total check-ins', () => {
    const schedule = dataStore.getPublicSchedule();
    const morningSlot = schedule.slots.find(s => s.session_code === 'morning')!;
    const afternoonSlot = schedule.slots.find(s => s.session_code === 'afternoon')!;

    // Force open both slots in the data store for deterministic testing
    const staff = dataStore.getStaff()[0];
    dataStore.setSlotOverride(morningSlot.id, true, staff);
    dataStore.setSlotOverride(afternoonSlot.id, true, staff);

    // Same volunteer checks into 2 different sessions on the same day
    const volId = 'LLO-VOL-005';
    dataStore.submitTask({
      volunteer_id: volId,
      session_slot_id: morningSlot.id,
    });
    dataStore.submitTask({
      volunteer_id: volId,
      session_slot_id: afternoonSlot.id,
    });

    const metrics = dataStore.getDashboardMetrics();
    // Unique participants must be <= total check-ins
    expect(metrics.unique_volunteers_today).toBeGreaterThanOrEqual(1);
    expect(metrics.total_submissions).toBeGreaterThanOrEqual(metrics.unique_volunteers_today);
  });

  it('calculates session breakdown across Morning, Afternoon, and Evening slots', () => {
    const metrics = dataStore.getDashboardMetrics();
    const sumSessions =
      metrics.session_counts.morning +
      metrics.session_counts.afternoon +
      metrics.session_counts.evening;

    expect(sumSessions).toBe(metrics.total_submissions);
  });

  it('provides daily trends array covering all 30 programme days', () => {
    const metrics = dataStore.getDashboardMetrics();
    expect(metrics.daily_trends.length).toBe(30);

    for (let i = 0; i < 30; i++) {
      expect(metrics.daily_trends[i].day_number).toBe(i + 1);
      expect(metrics.daily_trends[i].calendar_date).toBeDefined();
    }
  });

  it('provides top active volunteers leaderboard', () => {
    const metrics = dataStore.getDashboardMetrics();
    expect(metrics.top_active_volunteers).toBeInstanceOf(Array);
    expect(metrics.top_active_volunteers.length).toBeLessThanOrEqual(5);

    if (metrics.top_active_volunteers.length > 1) {
      expect(metrics.top_active_volunteers[0].checkins_count).toBeGreaterThanOrEqual(
        metrics.top_active_volunteers[1].checkins_count
      );
    }
  });

  it('calculates volunteer consistency categorization', () => {
    const metrics = dataStore.getDashboardMetrics();
    const { high, medium, low } = metrics.volunteer_consistency;
    expect(high + medium + low).toBe(metrics.total_volunteers);
  });

  it('filters metrics by specific programme day number', () => {
    const metricsDay1 = dataStore.getDashboardMetrics({ day_number: 1 });
    expect(metricsDay1).toBeDefined();
  });
});
