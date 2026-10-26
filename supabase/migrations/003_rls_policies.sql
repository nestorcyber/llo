-- Migration: 003_rls_policies.sql
-- Description: Row Level Security policies for public and role-based staff access

-- Enable RLS on all tables
ALTER TABLE programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE programme_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteers ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's staff role
CREATE OR REPLACE FUNCTION current_staff_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT role FROM staff_profiles
    WHERE id = auth.uid() AND is_active = true;
$$;

-- Helper function to verify if current user is an active staff member
CREATE OR REPLACE FUNCTION is_active_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM staff_profiles
        WHERE id = auth.uid() AND is_active = true
    );
$$;

-- Helper function to check if current user is at least a manager
CREATE OR REPLACE FUNCTION is_manager_or_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM staff_profiles
        WHERE id = auth.uid() AND is_active = true AND role IN ('owner', 'manager')
    );
$$;

-- Helper function to check if current user is an owner
CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM staff_profiles
        WHERE id = auth.uid() AND is_active = true AND role = 'owner'
    );
$$;

-- =========================================================================
-- 1. Programmes RLS
-- =========================================================================
-- Public can read active programmes
CREATE POLICY "Public can view active programmes"
ON programmes FOR SELECT
TO anon, authenticated
USING (status = 'active');

-- Staff can view all programmes
CREATE POLICY "Staff can view all programmes"
ON programmes FOR SELECT
TO authenticated
USING (is_active_staff());

-- Managers and owners can create or edit programmes
CREATE POLICY "Managers and owners can modify programmes"
ON programmes FOR ALL
TO authenticated
USING (is_manager_or_owner())
WITH CHECK (is_manager_or_owner());

-- =========================================================================
-- 2. Programme Days RLS
-- =========================================================================
-- Public can view programme days of active programmes
CREATE POLICY "Public can view programme days"
ON programme_days FOR SELECT
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM programmes
        WHERE programmes.id = programme_days.programme_id
        AND programmes.status = 'active'
    )
);

-- Managers and owners can modify programme days
CREATE POLICY "Managers and owners can modify programme days"
ON programme_days FOR ALL
TO authenticated
USING (is_manager_or_owner())
WITH CHECK (is_manager_or_owner());

-- =========================================================================
-- 3. Session Slots RLS
-- =========================================================================
-- Public can view session slots of active programmes
CREATE POLICY "Public can view session slots"
ON session_slots FOR SELECT
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM programme_days
        JOIN programmes ON programmes.id = programme_days.programme_id
        WHERE programme_days.id = session_slots.programme_day_id
        AND programmes.status = 'active'
    )
);

-- Managers and owners can modify session slots
CREATE POLICY "Managers and owners can modify session slots"
ON session_slots FOR ALL
TO authenticated
USING (is_manager_or_owner())
WITH CHECK (is_manager_or_owner());

-- =========================================================================
-- 4. Session Tasks RLS
-- =========================================================================
-- Public can view open tasks for active programmes
CREATE POLICY "Public can view open session tasks"
ON session_tasks FOR SELECT
TO anon, authenticated
USING (
    status = 'open' AND
    EXISTS (
        SELECT 1 FROM session_slots
        JOIN programme_days ON programme_days.id = session_slots.programme_day_id
        JOIN programmes ON programmes.id = programme_days.programme_id
        WHERE session_slots.id = session_tasks.session_slot_id
        AND programmes.status = 'active'
    )
);

-- Staff can view all tasks
CREATE POLICY "Staff can view all session tasks"
ON session_tasks FOR SELECT
TO authenticated
USING (is_active_staff());

-- Managers and owners can modify tasks
CREATE POLICY "Managers and owners can modify session tasks"
ON session_tasks FOR ALL
TO authenticated
USING (is_manager_or_owner())
WITH CHECK (is_manager_or_owner());

-- =========================================================================
-- 5. Volunteers RLS
-- Anonymous users CANNOT select, insert, update or delete volunteers!
-- Protected against scraping. Only authenticated staff can view/edit volunteers.
-- =========================================================================
CREATE POLICY "Staff can view volunteers"
ON volunteers FOR SELECT
TO authenticated
USING (is_active_staff());

CREATE POLICY "Managers and owners can insert/update volunteers"
ON volunteers FOR INSERT
TO authenticated
WITH CHECK (is_manager_or_owner());

CREATE POLICY "Managers and owners can update volunteers"
ON volunteers FOR UPDATE
TO authenticated
USING (is_manager_or_owner())
WITH CHECK (is_manager_or_owner());

CREATE POLICY "Only owners can delete volunteers"
ON volunteers FOR DELETE
TO authenticated
USING (is_owner());

-- =========================================================================
-- 6. Staff Profiles RLS
-- =========================================================================
CREATE POLICY "Staff can view all staff profiles"
ON staff_profiles FOR SELECT
TO authenticated
USING (is_active_staff());

CREATE POLICY "Staff can update own name/email"
ON staff_profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
    id = auth.uid() AND
    -- Prevent self-elevating role!
    role = (SELECT role FROM staff_profiles WHERE id = auth.uid())
);

CREATE POLICY "Owners have full control on staff profiles"
ON staff_profiles FOR ALL
TO authenticated
USING (is_owner())
WITH CHECK (is_owner());

-- =========================================================================
-- 7. Task Submissions RLS
-- Anonymous users cannot query submissions directly (protects volunteer privacy).
-- Submissions are submitted via the secure server-side endpoint.
-- =========================================================================
CREATE POLICY "Staff can view submissions"
ON task_submissions FOR SELECT
TO authenticated
USING (is_active_staff());

CREATE POLICY "Managers and owners can void submissions"
ON task_submissions FOR UPDATE
TO authenticated
USING (is_manager_or_owner())
WITH CHECK (is_manager_or_owner());

-- =========================================================================
-- 8. Audit Logs RLS
-- Immutable audit log: Staff can view, staff can insert; no update or delete allowed.
-- =========================================================================
CREATE POLICY "Staff can view audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (is_active_staff());

CREATE POLICY "Staff can insert audit logs"
ON audit_logs FOR INSERT
TO authenticated
WITH CHECK (is_active_staff());
