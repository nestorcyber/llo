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

  it('clearly distinguishes unique participants from total task submissions', () => {
    const schedule = dataStore.getPublicSchedule();
    const openSlot = schedule.slots.find(s => s.is_open && s.tasks.length >= 2)!;
    expect(openSlot.tasks.length).toBeGreaterThanOrEqual(2);

    const task1 = openSlot.tasks[0];
    const task2 = openSlot.tasks[1];

    // Same volunteer submits 2 different tasks in the session
    const volId = 'LLO-VOL-005';
    dataStore.submitTask({
      volunteer_id: volId,
      session_slot_id: openSlot.id,
      session_task_id: task1.id,
    });
    dataStore.submitTask({
      volunteer_id: volId,
      session_slot_id: openSlot.id,
      session_task_id: task2.id,
    });

    const metrics = dataStore.getDashboardMetrics();
    // Unique participants must be <= total submissions
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

  it('identifies most and least completed tasks', () => {
    const metrics = dataStore.getDashboardMetrics();
    expect(metrics.most_completed_tasks).toBeInstanceOf(Array);
    expect(metrics.least_completed_tasks).toBeInstanceOf(Array);

    if (metrics.most_completed_tasks.length > 0 && metrics.least_completed_tasks.length > 0) {
      expect(metrics.most_completed_tasks[0].count).toBeGreaterThanOrEqual(
        metrics.least_completed_tasks[0].count
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
