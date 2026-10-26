-- Migration: 001_initial_schema.sql
-- Description: Core tables for LinkedIn Local Owerri Volunteer Engagement Tracking System
-- Timezone: Africa/Lagos (UTC+1, no daylight savings)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Programmes
CREATE TABLE IF NOT EXISTS programmes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    start_date DATE NOT NULL,
    duration_days INTEGER NOT NULL DEFAULT 30 CHECK (duration_days >= 1 AND duration_days <= 90),
    timezone TEXT NOT NULL DEFAULT 'Africa/Lagos',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Programme Days (30 days generated per programme)
CREATE TABLE IF NOT EXISTS programme_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    programme_id UUID NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL CHECK (day_number >= 1),
    calendar_date DATE NOT NULL,
    theme TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_programme_day_number UNIQUE (programme_id, day_number),
    CONSTRAINT uq_programme_calendar_date UNIQUE (programme_id, calendar_date)
);

-- 3. Session Slots (3 per day: Morning 10:00 AM, Afternoon 3:00 PM, Evening 8:00 PM)
CREATE TABLE IF NOT EXISTS session_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    programme_day_id UUID NOT NULL REFERENCES programme_days(id) ON DELETE CASCADE,
    session_code TEXT NOT NULL CHECK (session_code IN ('morning', 'afternoon', 'evening')),
    name TEXT NOT NULL,
    scheduled_time TIME NOT NULL,
    window_open_offset_minutes INTEGER NOT NULL DEFAULT 30, -- starts 30 mins before
    window_close_offset_minutes INTEGER NOT NULL DEFAULT 120, -- closes 120 mins after
    is_override_open BOOLEAN DEFAULT NULL, -- NULL = follow time window, true = force open, false = force closed
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_day_session_code UNIQUE (programme_day_id, session_code)
);

-- 4. Volunteers
CREATE TABLE IF NOT EXISTS volunteers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id TEXT NOT NULL UNIQUE, -- e.g. LLO-VOL-001, normalized uppercase
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    track TEXT DEFAULT 'General',
    is_active BOOLEAN NOT NULL DEFAULT true,
    pin_hash TEXT, -- architectural hook for optional private PIN
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_volunteer_id_format CHECK (volunteer_id = UPPER(TRIM(volunteer_id)))
);

-- 5. Session Tasks (Multiple tasks per session slot)
CREATE TABLE IF NOT EXISTS session_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_slot_id UUID NOT NULL REFERENCES session_slots(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'General',
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'closed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Staff Profiles & Roles
CREATE TABLE IF NOT EXISTS staff_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'manager', 'viewer')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Task Submissions
CREATE TABLE IF NOT EXISTS task_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    programme_id UUID NOT NULL REFERENCES programmes(id) ON DELETE RESTRICT,
    programme_day_id UUID NOT NULL REFERENCES programme_days(id) ON DELETE RESTRICT,
    session_slot_id UUID NOT NULL REFERENCES session_slots(id) ON DELETE RESTRICT,
    session_task_id UUID NOT NULL REFERENCES session_tasks(id) ON DELETE RESTRICT,
    volunteer_id UUID NOT NULL REFERENCES volunteers(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'reported' CHECK (status IN ('reported', 'verified', 'voided')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    submitted_ip TEXT,
    user_agent TEXT,
    voided_at TIMESTAMPTZ,
    voided_by UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
    void_reason TEXT,
    -- Database unique constraint: Same volunteer cannot submit the same task twice!
    CONSTRAINT uq_volunteer_task_submission UNIQUE (volunteer_id, session_task_id)
);

-- 8. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
    staff_email TEXT,
    action TEXT NOT NULL, -- e.g. 'TASK_EDIT', 'VOLUNTEER_DEACTIVATE', 'RECORD_VOID', 'PROGRAMME_CHANGE', 'ROLE_CHANGE', 'CSV_EXPORT'
    target_type TEXT NOT NULL, -- 'task', 'volunteer', 'submission', 'programme', 'staff'
    target_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_programme_days_prog ON programme_days(programme_id, day_number);
CREATE INDEX IF NOT EXISTS idx_programme_days_date ON programme_days(calendar_date);
CREATE INDEX IF NOT EXISTS idx_session_slots_day ON session_slots(programme_day_id);
CREATE INDEX IF NOT EXISTS idx_session_tasks_slot ON session_tasks(session_slot_id, status);
CREATE INDEX IF NOT EXISTS idx_volunteers_vid ON volunteers(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_volunteers_active ON volunteers(is_active);
CREATE INDEX IF NOT EXISTS idx_submissions_volunteer ON task_submissions(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_submissions_task ON task_submissions(session_task_id);
CREATE INDEX IF NOT EXISTS idx_submissions_slot ON task_submissions(session_slot_id);
CREATE INDEX IF NOT EXISTS idx_submissions_day ON task_submissions(programme_day_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON task_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON task_submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
