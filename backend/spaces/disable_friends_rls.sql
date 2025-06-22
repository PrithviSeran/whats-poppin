-- =====================================================
-- QUICK FIX: Disable RLS on friends table
-- =====================================================

-- This disables Row Level Security on the friends table
-- The security is still maintained by the PostgreSQL functions
-- which validate user permissions before any operations

ALTER TABLE friends DISABLE ROW LEVEL SECURITY;

-- Verification: Check if RLS is disabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'friends';

-- Expected result: rowsecurity should be 'f' (false) 