-- =========================================================================
-- LinkedIn Local Owerri - Migration 004
-- Allow Read Access to Volunteers for Public Verification and Dashboard Roster
-- =========================================================================
-- Run this in your Supabase Dashboard -> SQL Editor -> Run
-- This allows both anon and authenticated users to read the volunteer directory,
-- enabling the Live Dashboard and check-in pages to display volunteers in real time.

DROP POLICY IF EXISTS "Staff can view volunteers" ON volunteers;
DROP POLICY IF EXISTS "Public can view volunteers" ON volunteers;

CREATE POLICY "Public can view volunteers"
ON volunteers FOR SELECT
TO anon, authenticated
USING (true);

-- Ensure RLS is still active (mutations are still restricted to managers/owners)
ALTER TABLE volunteers ENABLE ROW LEVEL SECURITY;
