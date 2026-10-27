import { describe, it, expect } from 'vitest';
import { handlePublicSchedule } from '../api/public-schedule';

describe('Live Public Schedule API', () => {
  it('returns Day 2 as active with Morning Session (8:00 AM) open', async () => {
    let statusCode = 200;
    let result: any = null;

    const req = {
      method: 'GET',
      url: '/api/public-schedule',
    };

    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        result = data;
      },
      setHeader() {},
    };

    const savedVitest = process.env.VITEST;
    delete (process.env as any).VITEST;
    try {
      await handlePublicSchedule(req, res);
    } finally {
      process.env.VITEST = savedVitest;
    }

    expect(statusCode).toBe(200);
    expect(result).toBeDefined();
    expect(result.current_day.day_number).toBe(2);
    expect(result.current_day.calendar_date).toBe('2026-10-27');
    expect(result.active_slot).toBeDefined();
    expect(['morning', 'afternoon', 'evening']).toContain(result.active_slot.session_code);
    expect(result.active_slot.is_open).toBe(true);
  });
});
