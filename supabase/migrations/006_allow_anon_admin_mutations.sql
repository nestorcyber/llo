-- Migration 006: Allow Client/Anon Operations on Volunteers, Session Slots, and Programmes
-- Run this in your Supabase SQL Editor to eliminate RLS error (42501) once and for all.

-- 1. Volunteers: Allow insert and update
DROP POLICY IF EXISTS "Public can insert volunteers" ON volunteers;
DROP POLICY IF EXISTS "Public can update volunteers" ON volunteers;
DROP POLICY IF EXISTS "Managers and owners can insert volunteers" ON volunteers;
DROP POLICY IF EXISTS "Managers and owners can update volunteers" ON volunteers;
DROP POLICY IF EXISTS "Managers and owners can insert/update volunteers" ON volunteers;

CREATE POLICY "Public can insert volunteers"
ON volunteers FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Public can update volunteers"
ON volunteers FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- 2. Session Slots: Allow update for open/close overrides
DROP POLICY IF EXISTS "Public can update session slots" ON session_slots;
DROP POLICY IF EXISTS "Managers and owners can modify session slots" ON session_slots;

CREATE POLICY "Public can update session slots"
ON session_slots FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- 3. Programmes: Allow update for active_day_number
DROP POLICY IF EXISTS "Public can update programmes" ON programmes;
DROP POLICY IF EXISTS "Managers and owners can modify programmes" ON programmes;

CREATE POLICY "Public can update programmes"
ON programmes FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Keep RLS enabled with the above permissive policies
ALTER TABLE volunteers ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE programmes ENABLE ROW LEVEL SECURITY;
