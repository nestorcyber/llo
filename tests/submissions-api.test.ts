import { describe, it, expect, beforeEach } from 'vitest';
import { dataStore } from '../src/lib/data-store';
import { handleSubmission } from '../api/submissions';
import { checkRateLimit } from '../api/utils/rate-limiter';

describe('Secure Submission Backend & Business Rules', () => {
  beforeEach(() => {
    dataStore.resetToDefault();
    const staff = dataStore.getStaff()[0];
    const morningSlot = dataStore.getDaySessionSlots('day-prog-llo-2026-1')[0];
    dataStore.setSlotOverride(morningSlot.id, true, staff);
  });

  it('records valid session check-in and resolves volunteer name from ID', async () => {
    const schedule = dataStore.getPublicSchedule();
    const openSlot = schedule.slots.find(s => s.is_open);
    expect(openSlot).toBeDefined();

    let responseStatus = 0;
    let responseBody: any = null;

    const mockReq = {
      method: 'POST',
      body: {
        volunteer_id: 'llo-vol-004', // Emeka Nwosu
        session_slot_id: openSlot!.id,
      },
      headers: {
        'x-forwarded-for': '197.210.55.10',
        'user-agent': 'Vitest Mobile Agent',
      },
    };

    const mockRes = {
      status(code: number) {
        responseStatus = code;
        return this;
      },
      json(data: any) {
        responseBody = data;
      },
      setHeader() {},
    };

    await handleSubmission(mockReq, mockRes);

    expect(responseStatus).toBe(201);
    expect(responseBody.success).toBe(true);
    expect(responseBody.submission).toBeDefined();
    // Resolves volunteer name on the server
    expect(responseBody.submission.volunteer_name).toBe('Emeka Nwosu');
    expect(responseBody.submission.volunteer_id).toBe('LLO-VOL-004');
    expect(responseBody.submission.session_name).toBe(openSlot!.name);
    expect(responseBody.submission.submitted_at_lagos).toContain('WAT');
  });

  it('rejects nonexistent or unregistered volunteer IDs', async () => {
    const schedule = dataStore.getPublicSchedule();
    const openSlot = schedule.slots.find(s => s.is_open)!;

    let responseStatus = 0;
    let responseBody: any = null;

    const mockReq = {
      method: 'POST',
      body: {
        volunteer_id: 'LLO-VOL-999', // nonexistent
        session_slot_id: openSlot.id,
      },
    };

    const mockRes = {
      status(code: number) {
        responseStatus = code;
        return this;
      },
      json(data: any) {
        responseBody = data;
      },
      setHeader() {},
    };

    await handleSubmission(mockReq, mockRes);

    expect(responseStatus).toBe(404);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error_code).toBe('INVALID_VOLUNTEER_ID');
    expect(responseBody.message).toContain('not found');
  });

  it('rejects inactive or deactivated volunteer accounts', async () => {
    // In default seed data, LLO-VOL-007 (Blessing Okafor) is inactive (is_active = false)
    const schedule = dataStore.getPublicSchedule();
    const openSlot = schedule.slots.find(s => s.is_open)!;

    let responseStatus = 0;
    let responseBody: any = null;

    const mockReq = {
      method: 'POST',
      body: {
        volunteer_id: 'LLO-VOL-007', // Inactive volunteer
        session_slot_id: openSlot.id,
      },
    };

    const mockRes = {
      status(code: number) {
        responseStatus = code;
        return this;
      },
      json(data: any) {
        responseBody = data;
      },
      setHeader() {},
    };

    await handleSubmission(mockReq, mockRes);

    expect(responseStatus).toBe(403);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error_code).toBe('INACTIVE_VOLUNTEER');
    expect(responseBody.message).toContain('inactive');
  });

  it('rejects invalid session slot ID', async () => {
    let responseStatus = 0;
    let responseBody: any = null;

    const mockReq = {
      method: 'POST',
      body: {
        volunteer_id: 'LLO-VOL-001',
        session_slot_id: 'nonexistent-slot-id',
      },
    };

    const mockRes = {
      status(code: number) {
        responseStatus = code;
        return this;
      },
      json(data: any) {
        responseBody = data;
      },
      setHeader() {},
    };

    await handleSubmission(mockReq, mockRes);

    expect(responseStatus).toBe(400);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error_code).toBe('INVALID_SESSION');
  });

  it('rejects submissions when session window is closed', async () => {
    // Force close a slot override
    const schedule = dataStore.getPublicSchedule();
    const targetSlot = schedule.slots[0];
    const staff = dataStore.getStaff()[0];

    // Force closed
    dataStore.setSlotOverride(targetSlot.id, false, staff);

    let responseStatus = 0;
    let responseBody: any = null;

    const mockReq = {
      method: 'POST',
      body: {
        volunteer_id: 'LLO-VOL-001',
        session_slot_id: targetSlot.id,
      },
    };

    const mockRes = {
      status(code: number) {
        responseStatus = code;
        return this;
      },
      json(data: any) {
        responseBody = data;
      },
      setHeader() {},
    };

    await handleSubmission(mockReq, mockRes);

    expect(responseStatus).toBe(400);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error_code).toBe('SESSION_CLOSED');
  });

  it('enforces database unique constraint preventing duplicate submissions for the same session slot', async () => {
    const schedule = dataStore.getPublicSchedule();
    const openSlot = schedule.slots.find(s => s.is_open)!;

    const mockReq = {
      method: 'POST',
      body: {
        volunteer_id: 'LLO-VOL-003',
        session_slot_id: openSlot.id,
      },
      headers: { 'x-forwarded-for': '127.0.0.1' },
    };

    let firstCode = 0;
    let firstRes: any = null;
    await handleSubmission(mockReq, {
      status(c: number) { firstCode = c; return this; },
      json(d: any) { firstRes = d; },
      setHeader() {},
    });

    expect(firstCode).toBe(201);
    expect(firstRes.success).toBe(true);

    // Second submission with exact same volunteer & session slot -> MUST BE REJECTED (409)
    let secondCode = 0;
    let secondRes: any = null;
    await handleSubmission(mockReq, {
      status(c: number) { secondCode = c; return this; },
      json(d: any) { secondRes = d; },
      setHeader() {},
    });

    expect(secondCode).toBe(409);
    expect(secondRes.success).toBe(false);
    expect(secondRes.error_code).toBe('DUPLICATE_SUBMISSION');
    expect(secondRes.message).toContain('Already checked in');
  });

  it('allows resubmission if an existing submission was voided by an authorized administrator', async () => {
    const schedule = dataStore.getPublicSchedule();
    const openSlot = schedule.slots.find(s => s.is_open)!;
    const staff = dataStore.getStaff()[0];

    // 1. Submit
    const res1 = dataStore.submitTask({
      volunteer_id: 'LLO-VOL-004',
      session_slot_id: openSlot.id,
    });
    expect(res1.success).toBe(true);

    // 2. Void the submission
    const voidRes = dataStore.voidSubmission(res1.submission!.id, 'Submitted by mistake', staff);
    expect(voidRes.success).toBe(true);

    // 3. Resubmit same slot -> Now permitted because old record is voided!
    const res2 = dataStore.submitTask({
      volunteer_id: 'LLO-VOL-004',
      session_slot_id: openSlot.id,
    });
    expect(res2.success).toBe(true);
    expect(res2.submission).toBeDefined();
  });

  it('applies sliding window rate limiting on rapid burst attempts', () => {
    const testKey = 'test-rate-limit-key';

    // First 5 requests within window are allowed
    for (let i = 0; i < 5; i++) {
      const check = checkRateLimit(testKey, 5, 5000);
      expect(check.allowed).toBe(true);
    }

    // 6th request within window must be rejected
    const blockedCheck = checkRateLimit(testKey, 5, 5000);
    expect(blockedCheck.allowed).toBe(false);
    expect(blockedCheck.remaining).toBe(0);
    expect(blockedCheck.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('allows multiple sessions to be simultaneously open and selectable', async () => {
    const staff = dataStore.getStaff()[0];
    const slots = dataStore.getDaySessionSlots('day-prog-llo-2026-1');
    const morningSlot = slots[0];
    const afternoonSlot = slots[1];

    // Force override open on both morning and afternoon slots
    await dataStore.setSlotOverride(morningSlot.id, true, staff);
    await dataStore.setSlotOverride(afternoonSlot.id, true, staff);

    const schedule = dataStore.getPublicSchedule();
    const morningInSchedule = schedule.slots.find(s => s.id === morningSlot.id);
    const afternoonInSchedule = schedule.slots.find(s => s.id === afternoonSlot.id);

    expect(morningInSchedule?.is_open).toBe(true);
    expect(morningInSchedule?.window_status).toBe('open');

    // Crucial fix verification: the second open slot must NOT be forced to closed!
    expect(afternoonInSchedule?.is_open).toBe(true);
    expect(afternoonInSchedule?.window_status).toBe('open');
  });

  it('accepts shorthand volunteer ID input during check-in', async () => {
    const schedule = dataStore.getPublicSchedule();
    const openSlot = schedule.slots.find(s => s.is_open)!;

    let responseStatus = 0;
    let responseBody: any = null;

    // Volunteer inputs just "1" or "001"
    const mockReq = {
      method: 'POST',
      body: {
        volunteer_id: '1',
        session_slot_id: openSlot.id,
      },
    };

    const mockRes = {
      status(code: number) {
        responseStatus = code;
        return this;
      },
      json(data: any) {
        responseBody = data;
      },
      setHeader() {},
    };

    await handleSubmission(mockReq, mockRes);

    expect(responseStatus).toBe(201);
    expect(responseBody.success).toBe(true);
    expect(responseBody.submission.volunteer_id).toBe('LLO-VOL-001');
    expect(responseBody.submission.volunteer_name).toBe('Chinedu Okeke');
  });
});
