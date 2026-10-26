import {
  Programme,
  ProgrammeDay,
  SessionSlot,
  Volunteer,
  StaffProfile,
  TaskSubmission,
  AuditLog,
  SubmissionPayload,
  SubmissionResult,
  DashboardMetrics,
  PublicScheduleData,
} from '../types';
import {
  getLagosDateString,
  formatLagosDateTime,
  isSessionWindowOpen,
  getSessionWindowStatus,
  formatSessionWindowRange,
  getNextSessionInfo,
} from './lagos-time';
import { normalizeVolunteerId } from './validation';

// Helper to generate IDs
const uid = () => 'id-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);

const STORAGE_KEY = 'llo_tracking_data_v2';

interface StoreState {
  programmes: Programme[];
  programme_days: ProgrammeDay[];
  session_slots: SessionSlot[];
  volunteers: Volunteer[];
  staff_profiles: StaffProfile[];
  task_submissions: TaskSubmission[];
  audit_logs: AuditLog[];
}

function initializeDefaultData(): StoreState {
  const progId = 'prog-llo-2026';
  const todayLagos = getLagosDateString();

  const programmes: Programme[] = [
    {
      id: progId,
      title: 'LinkedIn Local Owerri 30-Day Volunteer Programme',
      slug: 'llo-30day-2026',
      description: 'Official 30-day volunteer attendance tracking across morning, afternoon, and evening sessions.',
      start_date: todayLagos,
      duration_days: 30,
      timezone: 'Africa/Lagos',
      status: 'active',
      active_day_number: null, // null = follows real-time today calendar date automatically
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  // Generate 30 days starting today
  const programme_days: ProgrammeDay[] = [];
  const session_slots: SessionSlot[] = [];

  const startDateObj = new Date(todayLagos + 'T00:00:00Z');

  for (let d = 1; d <= 30; d++) {
    const dayDate = new Date(startDateObj);
    dayDate.setDate(startDateObj.getDate() + (d - 1));
    const dateStr = dayDate.toISOString().split('T')[0];

    const dayId = `day-${progId}-${d}`;
    programme_days.push({
      id: dayId,
      programme_id: progId,
      day_number: d,
      calendar_date: dateStr,
      theme: `Day ${d} Volunteer Operations`,
      is_active: true,
      created_at: new Date().toISOString(),
    });

    // 3 slots per day: Morning (10:00 AM), Afternoon (3:00 PM), Evening (8:00 PM)
    const morningSlotId = `slot-${dayId}-morning`;
    const afternoonSlotId = `slot-${dayId}-afternoon`;
    const eveningSlotId = `slot-${dayId}-evening`;

    session_slots.push(
      {
        id: morningSlotId,
        programme_day_id: dayId,
        session_code: 'morning',
        name: 'Morning Session (10:00 AM)',
        scheduled_time: '10:00:00',
        window_open_offset_minutes: 0, // Opens at 10:00 AM
        window_close_offset_minutes: 120, // 10:00 AM - 12:00 PM
        is_override_open: null, // strictly follows time window
        created_at: new Date().toISOString(),
      },
      {
        id: afternoonSlotId,
        programme_day_id: dayId,
        session_code: 'afternoon',
        name: 'Afternoon Session (3:00 PM)',
        scheduled_time: '15:00:00',
        window_open_offset_minutes: 0, // Opens at 03:00 PM
        window_close_offset_minutes: 120, // 03:00 PM - 05:00 PM
        is_override_open: null, // strictly follows time window
        created_at: new Date().toISOString(),
      },
      {
        id: eveningSlotId,
        programme_day_id: dayId,
        session_code: 'evening',
        name: 'Evening Session (8:00 PM)',
        scheduled_time: '20:00:00',
        window_open_offset_minutes: 0, // Opens at 08:00 PM
        window_close_offset_minutes: 120, // 08:00 PM - 10:00 PM
        is_override_open: null, // strictly follows time window
        created_at: new Date().toISOString(),
      }
    );
  }

  // Seed Volunteers: Clean list with IDs and Names
  const volunteers: Volunteer[] = [
    {
      id: 'vol-1',
      volunteer_id: 'LLO-VOL-001',
      full_name: 'Chinedu Okeke',
      email: 'chinedu.okeke@example.com',
      phone: '+2348031234567',
      is_active: true,
      notes: 'Volunteer Member',
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'vol-2',
      volunteer_id: 'LLO-VOL-002',
      full_name: 'Amina Yusuf',
      email: 'amina.yusuf@example.com',
      phone: '+2348022345678',
      is_active: true,
      notes: 'Volunteer Member',
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'vol-3',
      volunteer_id: 'LLO-VOL-003',
      full_name: 'Ngozi Eze',
      email: 'ngozi.eze@example.com',
      phone: '+2348093456789',
      is_active: true,
      notes: 'Volunteer Member',
      created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'vol-4',
      volunteer_id: 'LLO-VOL-004',
      full_name: 'Emeka Nwosu',
      email: 'emeka.nwosu@example.com',
      phone: '+2348144567890',
      is_active: true,
      notes: 'Volunteer Member',
      created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'vol-5',
      volunteer_id: 'LLO-VOL-005',
      full_name: 'Fatima Bello',
      email: 'fatima.bello@example.com',
      phone: '+2348185678901',
      is_active: true,
      notes: 'Volunteer Member',
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'vol-6',
      volunteer_id: 'LLO-VOL-006',
      full_name: 'Kelechi Umeh',
      email: 'kelechi.umeh@example.com',
      phone: '+2347066789012',
      is_active: true,
      notes: 'Volunteer Member',
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'vol-7',
      volunteer_id: 'LLO-VOL-007',
      full_name: 'Blessing Okafor',
      email: 'blessing.okafor@example.com',
      phone: '+2347012345678',
      is_active: false, // Inactive volunteer to test rejection
      notes: 'On leave - Deactivated',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  // Staff Profiles
  const staff_profiles: StaffProfile[] = [
    {
      id: 'staff-owner-1',
      email: 'owner@llowerri.org',
      full_name: 'Ifeanyi Nwachukwu',
      role: 'owner',
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'staff-manager-1',
      email: 'manager@llowerri.org',
      full_name: 'Adaobi Uchendu',
      role: 'manager',
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'staff-viewer-1',
      email: 'viewer@llowerri.org',
      full_name: 'Tariq Danjuma',
      role: 'viewer',
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  // Initial Sample Check-Ins (e.g. for Day 1)
  const d1MorningSlot = session_slots.find(s => s.programme_day_id === 'day-prog-llo-2026-1' && s.session_code === 'morning')!;
  const d1AfternoonSlot = session_slots.find(s => s.programme_day_id === 'day-prog-llo-2026-1' && s.session_code === 'afternoon')!;

  const task_submissions: TaskSubmission[] = [
    {
      id: 'sub-init-1',
      programme_id: progId,
      programme_day_id: 'day-prog-llo-2026-1',
      session_slot_id: d1MorningSlot.id,
      volunteer_id: volunteers[0].id,
      status: 'reported',
      submitted_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      submitted_ip: '127.0.0.1',
      user_agent: 'Mozilla/5.0 Volunteer Mobile',
      voided_at: null,
      voided_by: null,
      void_reason: null,
    },
    {
      id: 'sub-init-2',
      programme_id: progId,
      programme_day_id: 'day-prog-llo-2026-1',
      session_slot_id: d1MorningSlot.id,
      volunteer_id: volunteers[1].id,
      status: 'reported',
      submitted_at: new Date(Date.now() - 3600000 * 1.5).toISOString(),
      submitted_ip: '127.0.0.1',
      user_agent: 'Mozilla/5.0 Volunteer Mobile',
      voided_at: null,
      voided_by: null,
      void_reason: null,
    },
    {
      id: 'sub-init-3',
      programme_id: progId,
      programme_day_id: 'day-prog-llo-2026-1',
      session_slot_id: d1AfternoonSlot.id,
      volunteer_id: volunteers[2].id,
      status: 'reported',
      submitted_at: new Date(Date.now() - 3600000 * 0.8).toISOString(),
      submitted_ip: '127.0.0.1',
      user_agent: 'Mozilla/5.0 Volunteer Mobile',
      voided_at: null,
      voided_by: null,
      void_reason: null,
    },
  ];

  const audit_logs: AuditLog[] = [
    {
      id: 'log-1',
      staff_id: staff_profiles[0].id,
      staff_email: staff_profiles[0].email,
      action: 'PROGRAMME_CREATED',
      target_type: 'programme',
      target_id: progId,
      details: { title: programmes[0].title, duration_days: 30 },
      ip_address: '127.0.0.1',
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      id: 'log-2',
      staff_id: staff_profiles[0].id,
      staff_email: staff_profiles[0].email,
      action: 'CALENDAR_GENERATED',
      target_type: 'programme',
      target_id: progId,
      details: { days_generated: 30, sessions_generated: 90 },
      ip_address: '127.0.0.1',
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
  ];

  return {
    programmes,
    programme_days,
    session_slots,
    volunteers,
    staff_profiles,
    task_submissions,
    audit_logs,
  };
}

class Store {
  private state: StoreState;

  constructor() {
    this.state = this.load();
  }

  private load(): StoreState {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          return JSON.parse(saved);
        }
      } catch (err) {
        console.warn('Failed to load store from localStorage', err);
      }
    }
    const fresh = initializeDefaultData();
    this.save(fresh);
    return fresh;
  }

  private save(newState?: StoreState): void {
    if (newState) this.state = newState;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (err) {
        console.warn('Failed to save store to localStorage', err);
      }
    }
  }

  public resetToDefault(): void {
    const fresh = initializeDefaultData();
    this.state = fresh;
    this.save(fresh);
  }

  // =========================================================================
  // Public Schedule & Check-in Methods
  // =========================================================================

  public getPublicSchedule(requestedDayNumber?: number): PublicScheduleData {
    const activeProg = this.state.programmes.find(p => p.status === 'active') || this.state.programmes[0];
    const todayLagos = getLagosDateString();

    let currentDay: ProgrammeDay | undefined;

    // 1. Explicit requested day (e.g. administrator viewing schedule)
    if (requestedDayNumber) {
      currentDay = this.state.programme_days.find(
        d => d.programme_id === activeProg.id && d.day_number === requestedDayNumber
      );
    }

    // 2. Explicitly configured active_day_number (set by administrator override)
    if (!currentDay && activeProg.active_day_number) {
      currentDay = this.state.programme_days.find(
        d => d.programme_id === activeProg.id && d.day_number === activeProg.active_day_number
      );
    }

    // 3. Automatically match today's real date in Africa/Lagos (WAT)
    if (!currentDay) {
      currentDay = this.state.programme_days.find(
        d => d.programme_id === activeProg.id && d.calendar_date === todayLagos
      );
    }

    // 4. Default to Day 1
    if (!currentDay) {
      currentDay = this.state.programme_days.find(
        d => d.programme_id === activeProg.id && d.day_number === 1
      )!;
    }

    const daySlots = this.state.session_slots.filter(s => s.programme_day_id === currentDay!.id);
    const now = new Date();

    // Strictly enforce: ONLY ONE session can be active at a time
    let openSlotFound: (SessionSlot & { checkins_count?: number }) | null = null;

    const enrichedSlots = daySlots.map(slot => {
      const isWindowOpen = isSessionWindowOpen(slot, currentDay!.calendar_date, now);
      // If a slot is open and no active slot has been claimed yet, designate this as the active session
      const isSlotActive = isWindowOpen && !openSlotFound;
      const windowStatus = isSlotActive ? 'open' : getSessionWindowStatus(slot, currentDay!.calendar_date, now);
      const checkinCount = this.state.task_submissions.filter(
        sub => sub.session_slot_id === slot.id && sub.status !== 'voided'
      ).length;

      const enriched = {
        ...slot,
        is_open: isSlotActive,
        window_status: windowStatus,
        checkins_count: checkinCount,
      };

      if (isSlotActive) {
        openSlotFound = enriched;
      }

      return enriched;
    });

    const nextSession = getNextSessionInfo(currentDay!.calendar_date, daySlots, now);

    const availableDays = this.state.programme_days
      .filter(d => d.programme_id === activeProg.id)
      .map(d => ({
        id: d.id,
        day_number: d.day_number,
        calendar_date: d.calendar_date,
        is_active: d.is_active,
      }));

    return {
      programme: {
        id: activeProg.id,
        title: activeProg.title,
        start_date: activeProg.start_date,
        duration_days: activeProg.duration_days,
        timezone: activeProg.timezone,
        status: activeProg.status,
        active_day_number: currentDay!.day_number,
      },
      current_day: {
        id: currentDay!.id,
        day_number: currentDay!.day_number,
        calendar_date: currentDay!.calendar_date,
        theme: currentDay!.theme,
        is_active: currentDay!.is_active,
      },
      server_time: now.toISOString(),
      server_lagos_time: formatLagosDateTime(now),
      slots: enrichedSlots,
      active_slot: openSlotFound,
      next_session: nextSession,
      available_days: availableDays,
    };
  }

  /**
   * Volunteer Session Check-In Engine
   * Validates volunteer ID, verifies session window, enforces duplicate constraint,
   * and saves the check-in record.
   */
  public submitTask(payload: SubmissionPayload, clientIp = '127.0.0.1', userAgent = 'Web Client'): SubmissionResult {
    const normalizedId = normalizeVolunteerId(payload.volunteer_id);

    // 1. Resolve volunteer
    const volunteer = this.state.volunteers.find(
      v => normalizeVolunteerId(v.volunteer_id) === normalizedId
    );

    if (!volunteer) {
      return {
        success: false,
        message: `Volunteer ID "${normalizedId}" was not found. Please verify your ID with the coordinator.`,
        error_code: 'INVALID_VOLUNTEER_ID',
      };
    }

    if (!volunteer.is_active) {
      return {
        success: false,
        message: `Volunteer ID "${normalizedId}" is currently inactive. Please contact the administrator.`,
        error_code: 'INACTIVE_VOLUNTEER',
      };
    }

    // 2. Resolve session slot
    const slot = this.state.session_slots.find(s => s.id === payload.session_slot_id);
    if (!slot) {
      return {
        success: false,
        message: 'The selected session slot was not found.',
        error_code: 'INVALID_SESSION',
      };
    }

    // 3. Resolve programme day
    const day = this.state.programme_days.find(d => d.id === slot.programme_day_id);
    if (!day) {
      return {
        success: false,
        message: 'Programme day record not found.',
        error_code: 'INVALID_SESSION',
      };
    }

    // 4. Verify session window in Africa/Lagos
    const isOpen = isSessionWindowOpen(slot, day.calendar_date);
    if (!isOpen) {
      const windowStr = formatSessionWindowRange(slot.scheduled_time, slot.window_open_offset_minutes, slot.window_close_offset_minutes);
      return {
        success: false,
        message: `Check-in is currently closed: ${slot.name} accepts check-ins during its scheduled window (${windowStr}). Please come back when the session opens.`,
        error_code: 'SESSION_CLOSED',
      };
    }

    // 5. Enforce Unique Database Constraint:
    // Same volunteer cannot check in to the same session slot twice (unless previously voided)
    const existing = this.state.task_submissions.find(
      sub => sub.volunteer_id === volunteer.id &&
             sub.session_slot_id === slot.id &&
             sub.status !== 'voided'
    );

    if (existing) {
      return {
        success: false,
        message: `Duplicate check-in rejected: You have already checked in for ${slot.name} at ${formatLagosDateTime(existing.submitted_at)}.`,
        error_code: 'DUPLICATE_SUBMISSION',
      };
    }

    // 6. Save check-in record with server-generated timestamp
    const now = new Date();
    const submissionId = uid();
    const activeProg = this.state.programmes.find(p => p.id === day.programme_id) || this.state.programmes[0];

    const newSubmission: TaskSubmission = {
      id: submissionId,
      programme_id: activeProg.id,
      programme_day_id: day.id,
      session_slot_id: slot.id,
      volunteer_id: volunteer.id,
      status: 'reported',
      submitted_at: now.toISOString(), // Server timestamptz!
      submitted_ip: clientIp,
      user_agent: userAgent,
      voided_at: null,
      voided_by: null,
      void_reason: null,
    };

    this.state.task_submissions.unshift(newSubmission);
    this.save();

    return {
      success: true,
      message: 'Check-in recorded successfully!',
      submission: {
        id: submissionId,
        volunteer_id: volunteer.volunteer_id,
        volunteer_name: volunteer.full_name,
        session_name: slot.name,
        day_number: day.day_number,
        submitted_at: now.toISOString(),
        submitted_at_lagos: formatLagosDateTime(now),
      },
    };
  }

  // =========================================================================
  // Admin Data & Analytics
  // =========================================================================

  public getDashboardMetrics(filters?: { programme_id?: string; day_number?: number }): DashboardMetrics {
    const activeProg = this.state.programmes.find(p => p.status === 'active') || this.state.programmes[0];
    const totalVolunteers = this.state.volunteers.length;
    const activeVolunteersCount = this.state.volunteers.filter(v => v.is_active).length;

    // Filter valid (non-voided) check-ins
    let validSubmissions = this.state.task_submissions.filter(
      s => s.programme_id === activeProg.id && s.status !== 'voided'
    );

    if (filters?.day_number) {
      const targetDay = this.state.programme_days.find(
        d => d.programme_id === activeProg.id && d.day_number === filters.day_number
      );
      if (targetDay) {
        validSubmissions = validSubmissions.filter(s => s.programme_day_id === targetDay.id);
      }
    }

    // Unique volunteers today
    const todayLagos = getLagosDateString();
    const todayDay = this.state.programme_days.find(d => d.calendar_date === todayLagos);
    const todaySubs = todayDay
      ? validSubmissions.filter(s => s.programme_day_id === todayDay.id)
      : [];
    const uniqueVolunteersToday = new Set(todaySubs.map(s => s.volunteer_id)).size;

    // Session breakdown
    const sessionSlotsMap = new Map(this.state.session_slots.map(s => [s.id, s.session_code]));
    let morningCount = 0;
    let afternoonCount = 0;
    let eveningCount = 0;

    for (const sub of validSubmissions) {
      const code = sessionSlotsMap.get(sub.session_slot_id);
      if (code === 'morning') morningCount++;
      else if (code === 'afternoon') afternoonCount++;
      else if (code === 'evening') eveningCount++;
    }

    // Daily check-in trends for Day 1..30
    const progDays = this.state.programme_days
      .filter(d => d.programme_id === activeProg.id)
      .sort((a, b) => a.day_number - b.day_number);

    const dailyTrends = progDays.map(day => {
      const daySubs = this.state.task_submissions.filter(
        s => s.programme_day_id === day.id && s.status !== 'voided'
      );
      const uniqueVols = new Set(daySubs.map(s => s.volunteer_id)).size;
      return {
        day_number: day.day_number,
        calendar_date: day.calendar_date,
        unique_volunteers: uniqueVols,
        total_submissions: daySubs.length,
      };
    });

    // Top active volunteers leaderboard
    const volCheckinMap = new Map<string, number>();
    for (const sub of validSubmissions) {
      volCheckinMap.set(sub.volunteer_id, (volCheckinMap.get(sub.volunteer_id) || 0) + 1);
    }

    const topVolunteers = this.state.volunteers
      .map(v => ({
        volunteer_id: v.volunteer_id,
        full_name: v.full_name,
        checkins_count: volCheckinMap.get(v.id) || 0,
      }))
      .sort((a, b) => b.checkins_count - a.checkins_count)
      .slice(0, 5);

    // Attendance rate
    const totalPossibleSlots = Math.max(1, activeVolunteersCount * 30 * 3);
    const attendanceRate = Math.min(100, Math.round((validSubmissions.length / totalPossibleSlots) * 100));

    // Volunteer consistency
    let high = 0;
    let medium = 0;
    let low = 0;

    for (const vol of this.state.volunteers) {
      const volSubs = validSubmissions.filter(s => s.volunteer_id === vol.id);
      const activeDaysCount = new Set(volSubs.map(s => s.programme_day_id)).size;
      const ratio = activeDaysCount / 30;
      if (ratio >= 0.7) high++;
      else if (ratio >= 0.3) medium++;
      else low++;
    }

    return {
      total_volunteers: totalVolunteers,
      active_volunteers_count: activeVolunteersCount,
      unique_volunteers_today: uniqueVolunteersToday,
      total_submissions: validSubmissions.length,
      attendance_rate_percentage: attendanceRate,
      session_counts: {
        morning: morningCount,
        afternoon: afternoonCount,
        evening: eveningCount,
      },
      daily_trends: dailyTrends,
      top_active_volunteers: topVolunteers,
      volunteer_consistency: { high, medium, low },
    };
  }

  public getAttendance(filters?: {
    day_number?: number;
    session_code?: string;
    status?: string;
    search?: string;
  }): TaskSubmission[] {
    const volMap = new Map(this.state.volunteers.map(v => [v.id, v]));
    const slotMap = new Map(this.state.session_slots.map(s => [s.id, s]));
    const dayMap = new Map(this.state.programme_days.map(d => [d.id, d]));

    let list = this.state.task_submissions.map(sub => {
      const vol = volMap.get(sub.volunteer_id);
      const slot = slotMap.get(sub.session_slot_id);
      const day = dayMap.get(sub.programme_day_id);

      return {
        ...sub,
        volunteer: vol ? { volunteer_id: vol.volunteer_id, full_name: vol.full_name } : undefined,
        slot: slot ? { session_code: slot.session_code, name: slot.name, scheduled_time: slot.scheduled_time } : undefined,
        day: day ? { day_number: day.day_number, calendar_date: day.calendar_date } : undefined,
      };
    });

    if (filters?.day_number) {
      list = list.filter(s => s.day?.day_number === filters.day_number);
    }
    if (filters?.session_code) {
      list = list.filter(s => s.slot?.session_code === filters.session_code);
    }
    if (filters?.status) {
      list = list.filter(s => s.status === filters.status);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(s =>
        s.volunteer?.volunteer_id.toLowerCase().includes(q) ||
        s.volunteer?.full_name.toLowerCase().includes(q)
      );
    }

    return list;
  }

  public voidSubmission(submissionId: string, reason: string, staffUser: StaffProfile): { success: boolean; message: string } {
    const sub = this.state.task_submissions.find(s => s.id === submissionId);
    if (!sub) return { success: false, message: 'Check-in record not found' };

    sub.status = 'voided';
    sub.voided_at = new Date().toISOString();
    sub.voided_by = staffUser.id;
    sub.void_reason = reason;

    // Log audit
    this.addAuditLog(staffUser, 'RECORD_VOID', 'submission', submissionId, {
      previous_status: 'reported',
      void_reason: reason,
    });

    this.save();
    return { success: true, message: 'Check-in record has been voided and audit logged.' };
  }

  public getVolunteers(search = '', statusFilter = ''): Volunteer[] {
    const subCountMap = new Map<string, number>();
    for (const sub of this.state.task_submissions) {
      if (sub.status !== 'voided') {
        subCountMap.set(sub.volunteer_id, (subCountMap.get(sub.volunteer_id) || 0) + 1);
      }
    }

    let list = this.state.volunteers.map(v => ({
      ...v,
      submission_count: subCountMap.get(v.id) || 0,
    }));

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(v =>
        v.volunteer_id.toLowerCase().includes(q) ||
        v.full_name.toLowerCase().includes(q) ||
        (v.email && v.email.toLowerCase().includes(q))
      );
    }
    if (statusFilter === 'active') {
      list = list.filter(v => v.is_active);
    } else if (statusFilter === 'inactive') {
      list = list.filter(v => !v.is_active);
    }

    return list;
  }

  public addVolunteer(vol: Omit<Volunteer, 'id' | 'created_at' | 'updated_at'>, staffUser: StaffProfile): { success: boolean; message: string; volunteer?: Volunteer } {
    const normalizedId = normalizeVolunteerId(vol.volunteer_id);
    if (this.state.volunteers.some(v => normalizeVolunteerId(v.volunteer_id) === normalizedId)) {
      return { success: false, message: `Volunteer ID "${normalizedId}" already exists.` };
    }

    const newVol: Volunteer = {
      ...vol,
      id: uid(),
      volunteer_id: normalizedId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.state.volunteers.unshift(newVol);
    this.addAuditLog(staffUser, 'VOLUNTEER_ADD', 'volunteer', newVol.id, {
      volunteer_id: newVol.volunteer_id,
      name: newVol.full_name,
    });
    this.save();

    return { success: true, message: 'Volunteer added successfully.', volunteer: newVol };
  }

  public updateVolunteer(id: string, updates: Partial<Volunteer>, staffUser: StaffProfile): { success: boolean; message: string } {
    const vol = this.state.volunteers.find(v => v.id === id);
    if (!vol) return { success: false, message: 'Volunteer not found.' };

    const oldActive = vol.is_active;
    Object.assign(vol, updates, { updated_at: new Date().toISOString() });

    if (updates.volunteer_id) {
      vol.volunteer_id = normalizeVolunteerId(updates.volunteer_id);
    }

    this.addAuditLog(staffUser, 'VOLUNTEER_UPDATE', 'volunteer', id, {
      volunteer_id: vol.volunteer_id,
      status_changed: oldActive !== vol.is_active ? `active: ${oldActive} -> ${vol.is_active}` : undefined,
      updates,
    });
    this.save();

    return { success: true, message: 'Volunteer updated successfully.' };
  }

  public importVolunteers(
    rows: Array<Omit<Volunteer, 'id' | 'created_at' | 'updated_at'>>,
    staffUser: StaffProfile
  ): { success: boolean; importedCount: number; duplicateCount: number; message: string } {
    const existingIds = new Set(this.state.volunteers.map(v => normalizeVolunteerId(v.volunteer_id)));
    let imported = 0;
    let duplicates = 0;

    for (const row of rows) {
      const nid = normalizeVolunteerId(row.volunteer_id);
      if (existingIds.has(nid)) {
        duplicates++;
        continue;
      }

      const newVol: Volunteer = {
        ...row,
        id: uid(),
        volunteer_id: nid,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.state.volunteers.push(newVol);
      existingIds.add(nid);
      imported++;
    }

    this.addAuditLog(staffUser, 'VOLUNTEER_IMPORT', 'volunteer', null, {
      imported_count: imported,
      duplicates_skipped: duplicates,
    });

    this.save();
    return {
      success: true,
      importedCount: imported,
      duplicateCount: duplicates,
      message: `Successfully imported ${imported} volunteers (${duplicates} duplicates skipped).`,
    };
  }

  /**
   * 30-Day Participation Matrix for a specific volunteer
   * Shows Morning, Afternoon, Evening check-in states
   */
  public getVolunteerParticipationMatrix(volunteerId: string) {
    const progDays = this.state.programme_days
      .filter(d => d.programme_id === this.state.programmes[0].id)
      .sort((a, b) => a.day_number - b.day_number);

    const subs = this.state.task_submissions.filter(s => s.volunteer_id === volunteerId);
    const slotMap = new Map(this.state.session_slots.map(s => [s.id, s]));

    return progDays.map(day => {
      const daySubs = subs.filter(s => s.programme_day_id === day.id);

      const morningSub = daySubs.find(s => slotMap.get(s.session_slot_id)?.session_code === 'morning');
      const afternoonSub = daySubs.find(s => slotMap.get(s.session_slot_id)?.session_code === 'afternoon');
      const eveningSub = daySubs.find(s => slotMap.get(s.session_slot_id)?.session_code === 'evening');

      return {
        day_number: day.day_number,
        calendar_date: day.calendar_date,
        morning: morningSub ? morningSub.status : 'none',
        afternoon: afternoonSub ? afternoonSub.status : 'none',
        evening: eveningSub ? eveningSub.status : 'none',
        total_attended: daySubs.filter(s => s.status !== 'voided').length,
      };
    });
  }

  // =========================================================================
  // Sessions & Programme Management
  // =========================================================================

  public getProgrammeDays(programmeId?: string): ProgrammeDay[] {
    const prog = programmeId || this.state.programmes[0].id;
    return this.state.programme_days
      .filter(d => d.programme_id === prog)
      .sort((a, b) => a.day_number - b.day_number);
  }

  public setActiveProgrammeDay(dayNumber: number, staffUser?: StaffProfile, openDaySlots = true): { success: boolean; message: string; active_day_number: number } {
    const activeProg = this.state.programmes.find(p => p.status === 'active') || this.state.programmes[0];
    const targetDay = this.state.programme_days.find(
      d => d.programme_id === activeProg.id && d.day_number === dayNumber
    );

    if (!targetDay) {
      return { success: false, message: `Programme Day ${dayNumber} does not exist.`, active_day_number: activeProg.active_day_number || 1 };
    }

    activeProg.active_day_number = dayNumber;
    activeProg.updated_at = new Date().toISOString();
    targetDay.is_active = true;

    if (openDaySlots) {
      const slots = this.state.session_slots.filter(s => s.programme_day_id === targetDay.id);
      for (const slot of slots) {
        slot.is_override_open = true;
      }
    }

    this.addAuditLog(staffUser || null, 'ACTIVE_DAY_CHANGED', 'programme_day', targetDay.id, {
      day_number: dayNumber,
      calendar_date: targetDay.calendar_date,
      open_slots: openDaySlots,
    });

    this.save();
    return {
      success: true,
      message: `Day ${dayNumber} (${targetDay.calendar_date}) is now set as the active day for volunteer check-ins!`,
      active_day_number: dayNumber,
    };
  }

  public getDaySessionSlots(dayId: string) {
    const slots = this.state.session_slots.filter(s => s.programme_day_id === dayId);
    const day = this.state.programme_days.find(d => d.id === dayId);
    return slots.map(slot => {
      const isOpen = day ? isSessionWindowOpen(slot, day.calendar_date) : false;
      const status = day ? getSessionWindowStatus(slot, day.calendar_date) : 'closed';
      const checkinCount = this.state.task_submissions.filter(
        sub => sub.session_slot_id === slot.id && sub.status !== 'voided'
      ).length;

      return {
        ...slot,
        is_open: isOpen,
        window_status: status,
        formatted_window: formatSessionWindowRange(slot.scheduled_time, slot.window_open_offset_minutes, slot.window_close_offset_minutes),
        checkins_count: checkinCount,
      };
    });
  }

  public setSlotOverride(slotId: string, override: boolean | null, staffUser: StaffProfile) {
    const slot = this.state.session_slots.find(s => s.id === slotId);
    if (!slot) return { success: false, message: 'Slot not found' };

    slot.is_override_open = override;
    this.addAuditLog(staffUser, 'SESSION_OVERRIDE', 'session_slot', slotId, {
      override_state: override === null ? 'AUTO (WINDOW)' : override ? 'FORCE_OPEN' : 'FORCE_CLOSED',
    });
    this.save();
    return { success: true, message: `Session slot override set to ${override}` };
  }

  // =========================================================================
  // Staff & Team Management
  // =========================================================================

  public getStaff(): StaffProfile[] {
    return [...this.state.staff_profiles];
  }

  public addStaff(staff: Omit<StaffProfile, 'id' | 'created_at' | 'updated_at'>, staffUser: StaffProfile) {
    const newStaff: StaffProfile = {
      ...staff,
      id: uid(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.state.staff_profiles.push(newStaff);
    this.addAuditLog(staffUser, 'ROLE_CHANGE', 'staff', newStaff.id, {
      action: 'ADD_STAFF',
      role: newStaff.role,
      email: newStaff.email,
    });
    this.save();
    return { success: true, staff: newStaff };
  }

  public updateStaffRole(id: string, newRole: StaffProfile['role'], staffUser: StaffProfile): { success: boolean; message: string } {
    const target = this.state.staff_profiles.find(s => s.id === id);
    if (!target) return { success: false, message: 'Staff member not found.' };

    if (target.role === 'owner' && newRole !== 'owner') {
      const remainingOwners = this.state.staff_profiles.filter(s => s.role === 'owner' && s.is_active && s.id !== id);
      if (remainingOwners.length === 0) {
        return { success: false, message: 'Cannot demote the last remaining active Owner account in the system.' };
      }
    }

    const oldRole = target.role;
    target.role = newRole;
    target.updated_at = new Date().toISOString();

    this.addAuditLog(staffUser, 'ROLE_CHANGE', 'staff', id, {
      old_role: oldRole,
      new_role: newRole,
    });
    this.save();
    return { success: true, message: `Staff role updated to ${newRole}.` };
  }

  // =========================================================================
  // Audit Logs
  // =========================================================================

  public getAuditLogs(limit = 100): AuditLog[] {
    return [...this.state.audit_logs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, limit);
  }

  public addAuditLog(
    staff: StaffProfile | null,
    action: string,
    target_type: string,
    target_id: string | null,
    details: Record<string, unknown>
  ): void {
    const log: AuditLog = {
      id: uid(),
      staff_id: staff?.id || null,
      staff_email: staff?.email || 'system',
      action,
      target_type,
      target_id,
      details,
      ip_address: '127.0.0.1',
      created_at: new Date().toISOString(),
    };
    this.state.audit_logs.unshift(log);
    this.save();
  }
}

export const dataStore = new Store();
