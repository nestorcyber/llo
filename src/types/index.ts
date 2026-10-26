export type ProgrammeStatus = 'draft' | 'active' | 'completed' | 'archived';
export type SessionCode = 'morning' | 'afternoon' | 'evening';
export type TaskStatus = 'draft' | 'open' | 'closed' | 'cancelled';
export type SubmissionStatus = 'reported' | 'verified' | 'voided';
export type StaffRole = 'owner' | 'manager' | 'viewer';

export interface Programme {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  start_date: string; // YYYY-MM-DD
  duration_days: number;
  timezone: string; // 'Africa/Lagos'
  status: ProgrammeStatus;
  created_at: string;
  updated_at: string;
}

export interface ProgrammeDay {
  id: string;
  programme_id: string;
  day_number: number;
  calendar_date: string; // YYYY-MM-DD
  theme: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SessionSlot {
  id: string;
  programme_day_id: string;
  session_code: SessionCode;
  name: string;
  scheduled_time: string; // HH:MM:SS
  window_open_offset_minutes: number;
  window_close_offset_minutes: number;
  is_override_open: boolean | null; // null = follow window, true = force open, false = force closed
  created_at: string;
  // Computed client-side / server-side properties
  is_open?: boolean;
  window_status?: 'upcoming' | 'open' | 'closed';
  window_start?: string;
  window_end?: string;
}

export interface SessionTask {
  id: string;
  session_slot_id: string;
  title: string;
  description: string | null;
  category: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

export interface Volunteer {
  id: string;
  volunteer_id: string; // e.g. LLO-VOL-001
  full_name: string;
  email: string | null;
  phone: string | null;
  track: string;
  is_active: boolean;
  pin_hash?: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  submission_count?: number;
}

export interface StaffProfile {
  id: string;
  email: string;
  full_name: string;
  role: StaffRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskSubmission {
  id: string;
  programme_id: string;
  programme_day_id: string;
  session_slot_id: string;
  session_task_id: string;
  volunteer_id: string;
  status: SubmissionStatus;
  submitted_at: string; // ISO 8601 timestamptz
  submitted_ip: string | null;
  user_agent: string | null;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  // Join / resolved fields
  volunteer?: {
    volunteer_id: string;
    full_name: string;
    track: string;
  };
  task?: {
    title: string;
    category: string;
  };
  slot?: {
    session_code: SessionCode;
    name: string;
    scheduled_time: string;
  };
  day?: {
    day_number: number;
    calendar_date: string;
  };
}

export interface AuditLog {
  id: string;
  staff_id: string | null;
  staff_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface PublicScheduleData {
  programme: {
    id: string;
    title: string;
    start_date: string;
    duration_days: number;
    timezone: string;
    status: ProgrammeStatus;
  };
  current_day: {
    id: string;
    day_number: number;
    calendar_date: string;
    theme: string | null;
  };
  server_time: string; // ISO timestamp
  server_lagos_time: string; // Human readable formatted Lagos time
  slots: Array<SessionSlot & {
    tasks: SessionTask[];
  }>;
}

export interface SubmissionPayload {
  volunteer_id: string;
  session_task_id: string;
  session_slot_id: string;
  pin?: string; // Optional private PIN hook
}

export interface SubmissionResult {
  success: boolean;
  message: string;
  submission?: {
    id: string;
    volunteer_id: string;
    volunteer_name: string;
    task_title: string;
    session_name: string;
    day_number: number;
    submitted_at: string;
    submitted_at_lagos: string;
  };
  error_code?:
    | 'INVALID_VOLUNTEER_ID'
    | 'INACTIVE_VOLUNTEER'
    | 'INVALID_TASK'
    | 'INVALID_SESSION'
    | 'TASK_SESSION_MISMATCH'
    | 'SESSION_CLOSED'
    | 'DUPLICATE_SUBMISSION'
    | 'RATE_LIMITED'
    | 'SERVER_ERROR';
}

export interface DashboardMetrics {
  total_volunteers: number;
  active_volunteers_count: number;
  unique_volunteers_today: number;
  total_submissions: number;
  completion_rate_percentage: number;
  session_counts: {
    morning: number;
    afternoon: number;
    evening: number;
  };
  daily_trends: Array<{
    day_number: number;
    calendar_date: string;
    unique_volunteers: number;
    total_submissions: number;
  }>;
  most_completed_tasks: Array<{
    task_id: string;
    title: string;
    category: string;
    session_name: string;
    count: number;
  }>;
  least_completed_tasks: Array<{
    task_id: string;
    title: string;
    category: string;
    session_name: string;
    count: number;
  }>;
  volunteer_consistency: {
    high: number; // >= 70% active days
    medium: number; // 30-69%
    low: number; // < 30%
  };
}
