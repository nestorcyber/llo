-- Migration 007: Allow Public/Anon Check-In Submissions
-- Run this in your Supabase SQL Editor to allow public check-in submissions and read access.

-- 1. Allow public and anon users to record check-in attendance
DROP POLICY IF EXISTS "Public can insert task submissions" ON task_submissions;
CREATE POLICY "Public can insert task submissions"
ON task_submissions FOR INSERT
TO public
WITH CHECK (true);

-- 2. Allow public and anon users to view task submissions (needed for live check-in counters and duplicate detection)
DROP POLICY IF EXISTS "Public can view task submissions" ON task_submissions;
CREATE POLICY "Public can view task submissions"
ON task_submissions FOR SELECT
TO public
USING (true);

-- Ensure RLS is active with the permissive public policies
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;
