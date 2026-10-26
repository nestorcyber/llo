-- =========================================================================
-- LINKEDIN LOCAL OWERRI - VOLUNTEER ENGAGEMENT TRACKING SYSTEM
-- Master Production Database Schema & Setup Script
-- Timezone: Africa/Lagos (WAT, UTC+1, No DST)
-- =========================================================================
-- Instructions:
-- 1. Open your Supabase Project Dashboard (https://supabase.com/dashboard)
-- 2. Go to the "SQL Editor" tab on the left sidebar
-- 3. Click "New Query", paste this entire script, and click "Run"
-- =========================================================================

-- -------------------------------------------------------------------------
-- 0. Required Extensions
-- -------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------------------------
-- 1. Table Definitions
-- -------------------------------------------------------------------------

-- 1.1 Programmes
CREATE TABLE IF NOT EXISTS programmes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    start_date DATE NOT NULL,
    duration_days INTEGER NOT NULL DEFAULT 30 CHECK (duration_days >= 1 AND duration_days <= 90),
    timezone TEXT NOT NULL DEFAULT 'Africa/Lagos',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
    active_day_number INTEGER DEFAULT 1 CHECK (active_day_number >= 1 AND active_day_number <= 90),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.2 Programme Days (30 calendar days)
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

-- 1.3 Session Slots (Morning 10:00 AM, Afternoon 3:00 PM, Evening 7:00 PM)
CREATE TABLE IF NOT EXISTS session_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    programme_day_id UUID NOT NULL REFERENCES programme_days(id) ON DELETE CASCADE,
    session_code TEXT NOT NULL CHECK (session_code IN ('morning', 'afternoon', 'evening')),
    name TEXT NOT NULL,
    scheduled_time TIME NOT NULL,
    window_open_offset_minutes INTEGER NOT NULL DEFAULT 30,  -- opens 30m before
    window_close_offset_minutes INTEGER NOT NULL DEFAULT 120, -- closes 120m after
    is_override_open BOOLEAN DEFAULT NULL, -- NULL = follow time window, true = force open, false = force closed
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_day_session_code UNIQUE (programme_day_id, session_code)
);

-- 1.4 Volunteers
CREATE TABLE IF NOT EXISTS volunteers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id TEXT NOT NULL UNIQUE, -- e.g. LLO-VOL-001, uppercase normalized
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    track TEXT DEFAULT 'General',
    is_active BOOLEAN NOT NULL DEFAULT true,
    pin_hash TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_volunteer_id_format CHECK (volunteer_id = UPPER(TRIM(volunteer_id)))
);

-- 1.5 Session Tasks (Optional structured tasks per session)
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

-- 1.6 Staff Profiles (Linked to Supabase Auth Users)
CREATE TABLE IF NOT EXISTS staff_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'manager', 'viewer')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.7 Task Submissions / Check-Ins (Immutable participation logs)
CREATE TABLE IF NOT EXISTS task_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    programme_id UUID NOT NULL REFERENCES programmes(id) ON DELETE RESTRICT,
    programme_day_id UUID NOT NULL REFERENCES programme_days(id) ON DELETE RESTRICT,
    session_slot_id UUID NOT NULL REFERENCES session_slots(id) ON DELETE RESTRICT,
    session_task_id UUID REFERENCES session_tasks(id) ON DELETE SET NULL,
    volunteer_id UUID NOT NULL REFERENCES volunteers(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'reported' CHECK (status IN ('reported', 'verified', 'voided')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    submitted_ip TEXT,
    user_agent TEXT,
    voided_at TIMESTAMPTZ,
    voided_by UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
    void_reason TEXT,
    -- Strictly enforces 1 check-in per volunteer per session
    CONSTRAINT uq_volunteer_session_checkin UNIQUE (volunteer_id, session_slot_id)
);

-- 1.8 Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
    staff_email TEXT,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------------------
-- 2. Performance Indexes
-- -------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_programme_days_prog ON programme_days(programme_id, day_number);
CREATE INDEX IF NOT EXISTS idx_programme_days_date ON programme_days(calendar_date);
CREATE INDEX IF NOT EXISTS idx_session_slots_day ON session_slots(programme_day_id);
CREATE INDEX IF NOT EXISTS idx_volunteers_vid ON volunteers(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_volunteers_active ON volunteers(is_active);
CREATE INDEX IF NOT EXISTS idx_submissions_volunteer ON task_submissions(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_submissions_slot ON task_submissions(session_slot_id);
CREATE INDEX IF NOT EXISTS idx_submissions_day ON task_submissions(programme_day_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON task_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON task_submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- -------------------------------------------------------------------------
-- 3. Business Logic Functions & Triggers
-- -------------------------------------------------------------------------

-- 3.1 Get Current Lagos Time
CREATE OR REPLACE FUNCTION get_lagos_now()
RETURNS TIMESTAMP WITHOUT TIME ZONE
LANGUAGE sql
STABLE
AS $$
    SELECT (now() AT TIME ZONE 'Africa/Lagos')::timestamp;
$$;

-- 3.2 Get Current Lagos Date
CREATE OR REPLACE FUNCTION get_lagos_today()
RETURNS DATE
LANGUAGE sql
STABLE
AS $$
    SELECT (now() AT TIME ZONE 'Africa/Lagos')::date;
$$;

-- 3.3 Set Active Programme Day
CREATE OR REPLACE FUNCTION set_programme_active_day(p_programme_id UUID, p_day_number INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE programmes
    SET active_day_number = p_day_number,
        updated_at = now()
    WHERE id = p_programme_id;
END;
$$;

-- 3.4 Generate 30-Day Calendar & 90 Session Slots
CREATE OR REPLACE FUNCTION generate_programme_calendar(p_programme_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_programme RECORD;
    v_day_idx INTEGER;
    v_day_date DATE;
    v_day_id UUID;
    v_days_created INTEGER := 0;
    v_sessions_created INTEGER := 0;
BEGIN
    SELECT * INTO v_programme FROM programmes WHERE id = p_programme_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Programme with ID % not found', p_programme_id;
    END IF;

    FOR v_day_idx IN 1..v_programme.duration_days LOOP
        v_day_date := v_programme.start_date + (v_day_idx - 1) * INTERVAL '1 day';

        INSERT INTO programme_days (programme_id, day_number, calendar_date, theme)
        VALUES (
            p_programme_id,
            v_day_idx,
            v_day_date,
            'Day ' || v_day_idx || ' Engagement'
        )
        ON CONFLICT (programme_id, day_number) DO UPDATE
        SET calendar_date = EXCLUDED.calendar_date
        RETURNING id INTO v_day_id;

        v_days_created := v_days_created + 1;

        -- 1. Morning Session (10:00 AM WAT, 09:30 AM - 12:00 PM window)
        INSERT INTO session_slots (
            programme_day_id,
            session_code,
            name,
            scheduled_time,
            window_open_offset_minutes,
            window_close_offset_minutes
        )
        VALUES (
            v_day_id,
            'morning',
            'Morning Session (10:00 AM)',
            '10:00:00'::TIME,
            30,
            120
        )
        ON CONFLICT (programme_day_id, session_code) DO NOTHING;

        -- 2. Afternoon Session (3:00 PM WAT, 02:30 PM - 05:00 PM window)
        INSERT INTO session_slots (
            programme_day_id,
            session_code,
            name,
            scheduled_time,
            window_open_offset_minutes,
            window_close_offset_minutes
        )
        VALUES (
            v_day_id,
            'afternoon',
            'Afternoon Session (3:00 PM)',
            '15:00:00'::TIME,
            30,
            120
        )
        ON CONFLICT (programme_day_id, session_code) DO NOTHING;

        -- 3. Evening Session (7:00 PM WAT, 06:30 PM - 09:00 PM window)
        INSERT INTO session_slots (
            programme_day_id,
            session_code,
            name,
            scheduled_time,
            window_open_offset_minutes,
            window_close_offset_minutes
        )
        VALUES (
            v_day_id,
            'evening',
            'Evening Session (7:00 PM)',
            '19:00:00'::TIME,
            30,
            120
        )
        ON CONFLICT (programme_day_id, session_code) DO NOTHING;

        v_sessions_created := v_sessions_created + 3;
    END LOOP;

    RETURN jsonb_build_object(
        'programme_id', p_programme_id,
        'days_created', v_days_created,
        'sessions_created', v_sessions_created,
        'success', true
    );
END;
$$;

-- 3.5 Check Session Slot Open Status (Africa/Lagos time window + manual overrides)
CREATE OR REPLACE FUNCTION is_session_slot_open(p_slot_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_slot RECORD;
    v_lagos_now TIMESTAMP;
    v_scheduled TIMESTAMP;
    v_open_time TIMESTAMP;
    v_close_time TIMESTAMP;
BEGIN
    SELECT 
        s.*, 
        d.calendar_date,
        p.status as programme_status
    INTO v_slot
    FROM session_slots s
    JOIN programme_days d ON s.programme_day_id = d.id
    JOIN programmes p ON d.programme_id = p.id
    WHERE s.id = p_slot_id;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    IF v_slot.programme_status != 'active' THEN
        RETURN false;
    END IF;

    -- Manual override takes precedence
    IF v_slot.is_override_open IS NOT NULL THEN
        RETURN v_slot.is_override_open;
    END IF;

    v_lagos_now := get_lagos_now();
    v_scheduled := (v_slot.calendar_date || ' ' || v_slot.scheduled_time)::timestamp;
    v_open_time := v_scheduled - (v_slot.window_open_offset_minutes || ' minutes')::interval;
    v_close_time := v_scheduled + (v_slot.window_close_offset_minutes || ' minutes')::interval;

    RETURN (v_lagos_now >= v_open_time AND v_lagos_now <= v_close_time);
END;
$$;

-- 3.6 Protect Last Owner Trigger
CREATE OR REPLACE FUNCTION trg_protect_last_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_owner_count INTEGER;
BEGIN
    IF (TG_OP = 'DELETE') OR 
       (TG_OP = 'UPDATE' AND (NEW.role != 'owner' OR NEW.is_active = false)) THEN
        
        IF OLD.role = 'owner' AND OLD.is_active = true THEN
            SELECT COUNT(*) INTO v_owner_count
            FROM staff_profiles
            WHERE role = 'owner' AND is_active = true AND id != OLD.id;

            IF v_owner_count < 1 THEN
                RAISE EXCEPTION 'Action rejected: At least one active Owner account must be preserved.';
            END IF;
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_last_owner_protection ON staff_profiles;
CREATE TRIGGER check_last_owner_protection
BEFORE UPDATE OR DELETE ON staff_profiles
FOR EACH ROW
EXECUTE FUNCTION trg_protect_last_owner();

-- 3.7 Auto-sync Supabase Auth Users to Staff Profiles
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.staff_profiles (id, email, full_name, role, is_active)
    VALUES (
        NEW.id,
        LOWER(NEW.email),
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            CASE 
                WHEN LOWER(NEW.email) = 'admin@llo.com' THEN 'Admin LLO'
                WHEN LOWER(NEW.email) = 'manager@llo.com' THEN 'Manager LLO'
                WHEN LOWER(NEW.email) = 'viewer@llo.com' THEN 'Viewer LLO'
                ELSE INITCAP(REPLACE(SPLIT_PART(NEW.email, '@', 1), '.', ' '))
            END
        ),
        COALESCE(
            (NEW.raw_user_meta_data->>'role')::text,
            CASE 
                WHEN LOWER(NEW.email) = 'admin@llo.com' THEN 'owner'
                WHEN LOWER(NEW.email) = 'manager@llo.com' THEN 'manager'
                ELSE 'viewer'
            END
        ),
        true
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_auth_user();

-- -------------------------------------------------------------------------
-- 4. Row Level Security (RLS) Configuration
-- -------------------------------------------------------------------------
ALTER TABLE programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE programme_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteers ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper RLS functions
CREATE OR REPLACE FUNCTION is_active_staff()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (SELECT 1 FROM staff_profiles WHERE id = auth.uid() AND is_active = true);
$$;

CREATE OR REPLACE FUNCTION is_manager_or_owner()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (SELECT 1 FROM staff_profiles WHERE id = auth.uid() AND is_active = true AND role IN ('owner', 'manager'));
$$;

CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (SELECT 1 FROM staff_profiles WHERE id = auth.uid() AND is_active = true AND role = 'owner');
$$;

-- Drop any existing policies before recreating
DROP POLICY IF EXISTS "Public can view active programmes" ON programmes;
DROP POLICY IF EXISTS "Staff can view all programmes" ON programmes;
DROP POLICY IF EXISTS "Managers and owners can modify programmes" ON programmes;
DROP POLICY IF EXISTS "Public can view programme days" ON programme_days;
DROP POLICY IF EXISTS "Managers and owners can modify programme days" ON programme_days;
DROP POLICY IF EXISTS "Public can view session slots" ON session_slots;
DROP POLICY IF EXISTS "Managers and owners can modify session slots" ON session_slots;
DROP POLICY IF EXISTS "Public can view open session tasks" ON session_tasks;
DROP POLICY IF EXISTS "Staff can view all session tasks" ON session_tasks;
DROP POLICY IF EXISTS "Managers and owners can modify session tasks" ON session_tasks;
DROP POLICY IF EXISTS "Staff can view volunteers" ON volunteers;
DROP POLICY IF EXISTS "Managers and owners can insert volunteers" ON volunteers;
DROP POLICY IF EXISTS "Managers and owners can update volunteers" ON volunteers;
DROP POLICY IF EXISTS "Only owners can delete volunteers" ON volunteers;
DROP POLICY IF EXISTS "Staff can view all staff profiles" ON staff_profiles;
DROP POLICY IF EXISTS "Staff can update own profile" ON staff_profiles;
DROP POLICY IF EXISTS "Owners have full control on staff profiles" ON staff_profiles;
DROP POLICY IF EXISTS "Staff can view submissions" ON task_submissions;
DROP POLICY IF EXISTS "Managers and owners can void submissions" ON task_submissions;
DROP POLICY IF EXISTS "Staff can view audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Staff can insert audit logs" ON audit_logs;

-- Apply RLS Policies
CREATE POLICY "Public can view active programmes" ON programmes FOR SELECT TO anon, authenticated USING (status = 'active');
CREATE POLICY "Staff can view all programmes" ON programmes FOR SELECT TO authenticated USING (is_active_staff());
CREATE POLICY "Managers and owners can modify programmes" ON programmes FOR ALL TO authenticated USING (is_manager_or_owner()) WITH CHECK (is_manager_or_owner());

CREATE POLICY "Public can view programme days" ON programme_days FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM programmes WHERE programmes.id = programme_days.programme_id AND programmes.status = 'active')
);
CREATE POLICY "Managers and owners can modify programme days" ON programme_days FOR ALL TO authenticated USING (is_manager_or_owner()) WITH CHECK (is_manager_or_owner());

CREATE POLICY "Public can view session slots" ON session_slots FOR SELECT TO anon, authenticated USING (
    EXISTS (
        SELECT 1 FROM programme_days
        JOIN programmes ON programmes.id = programme_days.programme_id
        WHERE programme_days.id = session_slots.programme_day_id AND programmes.status = 'active'
    )
);
CREATE POLICY "Managers and owners can modify session slots" ON session_slots FOR ALL TO authenticated USING (is_manager_or_owner()) WITH CHECK (is_manager_or_owner());

CREATE POLICY "Public can view open session tasks" ON session_tasks FOR SELECT TO anon, authenticated USING (status = 'open');
CREATE POLICY "Staff can view all session tasks" ON session_tasks FOR SELECT TO authenticated USING (is_active_staff());
CREATE POLICY "Managers and owners can modify session tasks" ON session_tasks FOR ALL TO authenticated USING (is_manager_or_owner()) WITH CHECK (is_manager_or_owner());

-- Volunteer data is strictly protected from public scraping
CREATE POLICY "Staff can view volunteers" ON volunteers FOR SELECT TO authenticated USING (is_active_staff());
CREATE POLICY "Managers and owners can insert volunteers" ON volunteers FOR INSERT TO authenticated WITH CHECK (is_manager_or_owner());
CREATE POLICY "Managers and owners can update volunteers" ON volunteers FOR UPDATE TO authenticated USING (is_manager_or_owner()) WITH CHECK (is_manager_or_owner());
CREATE POLICY "Only owners can delete volunteers" ON volunteers FOR DELETE TO authenticated USING (is_owner());

CREATE POLICY "Staff can view all staff profiles" ON staff_profiles FOR SELECT TO authenticated USING (is_active_staff());
CREATE POLICY "Staff can update own profile" ON staff_profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Owners have full control on staff profiles" ON staff_profiles FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());

CREATE POLICY "Staff can view submissions" ON task_submissions FOR SELECT TO authenticated USING (is_active_staff());
CREATE POLICY "Managers and owners can void submissions" ON task_submissions FOR UPDATE TO authenticated USING (is_manager_or_owner()) WITH CHECK (is_manager_or_owner());

CREATE POLICY "Staff can view audit logs" ON audit_logs FOR SELECT TO authenticated USING (is_active_staff());
CREATE POLICY "Staff can insert audit logs" ON audit_logs FOR INSERT TO authenticated WITH CHECK (is_active_staff());

-- -------------------------------------------------------------------------
-- 5. Seed Production Programme & Default Staff Accounts
-- -------------------------------------------------------------------------
DO $$
DECLARE
    v_prog_id UUID;
    v_admin_id UUID := gen_random_uuid();
    v_manager_id UUID := gen_random_uuid();
    v_viewer_id UUID := gen_random_uuid();
BEGIN
    -- 5.1 Create Active 30-Day Programme
    INSERT INTO programmes (
        title,
        slug,
        description,
        start_date,
        duration_days,
        timezone,
        status,
        active_day_number
    )
    VALUES (
        'LinkedIn Local Owerri 30-Day Volunteer Programme',
        'llo-30day-2026',
        'Official 30-day engagement programme tracking volunteer contributions across morning, afternoon, and evening sessions.',
        CURRENT_DATE,
        30,
        'Africa/Lagos',
        'active',
        1
    )
    ON CONFLICT (slug) DO UPDATE
    SET status = 'active'
    RETURNING id INTO v_prog_id;

    -- 5.2 Generate 30 Days and 90 Session Slots
    PERFORM generate_programme_calendar(v_prog_id);

    -- 5.3 Bootstrap Default Staff in Supabase auth.users & staff_profiles
    -- 1) Admin LLO (admin@llo.com / password: adminllo)
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@llo.com') THEN
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            role,
            aud,
            created_at,
            updated_at
        ) VALUES (
            v_admin_id,
            '00000000-0000-0000-0000-000000000000',
            'admin@llo.com',
            crypt('adminllo', gen_salt('bf')),
            now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"Admin LLO","role":"owner"}'::jsonb,
            'authenticated',
            'authenticated',
            now(),
            now()
        );

        INSERT INTO public.staff_profiles (id, email, full_name, role, is_active)
        VALUES (v_admin_id, 'admin@llo.com', 'Admin LLO', 'owner', true)
        ON CONFLICT (id) DO UPDATE SET full_name = 'Admin LLO', role = 'owner', is_active = true;
    END IF;

    -- 2) Manager LLO (manager@llo.com / password: managerllo)
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'manager@llo.com') THEN
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            role,
            aud,
            created_at,
            updated_at
        ) VALUES (
            v_manager_id,
            '00000000-0000-0000-0000-000000000000',
            'manager@llo.com',
            crypt('managerllo', gen_salt('bf')),
            now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"Manager LLO","role":"manager"}'::jsonb,
            'authenticated',
            'authenticated',
            now(),
            now()
        );

        INSERT INTO public.staff_profiles (id, email, full_name, role, is_active)
        VALUES (v_manager_id, 'manager@llo.com', 'Manager LLO', 'manager', true)
        ON CONFLICT (id) DO UPDATE SET full_name = 'Manager LLO', role = 'manager', is_active = true;
    END IF;

    -- 3) Viewer LLO (viewer@llo.com / password: viewerllo)
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'viewer@llo.com') THEN
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            role,
            aud,
            created_at,
            updated_at
        ) VALUES (
            v_viewer_id,
            '00000000-0000-0000-0000-000000000000',
            'viewer@llo.com',
            crypt('viewerllo', gen_salt('bf')),
            now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"Viewer LLO","role":"viewer"}'::jsonb,
            'authenticated',
            'authenticated',
            now(),
            now()
        );

        INSERT INTO public.staff_profiles (id, email, full_name, role, is_active)
        VALUES (v_viewer_id, 'viewer@llo.com', 'Viewer LLO', 'viewer', true)
        ON CONFLICT (id) DO UPDATE SET full_name = 'Viewer LLO', role = 'viewer', is_active = true;
    END IF;
END $$;
