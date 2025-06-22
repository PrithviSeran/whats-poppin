-- =====================================================
-- FIX FOR FRIENDS RLS POLICIES
-- =====================================================

-- First, drop the existing problematic policies
DROP POLICY IF EXISTS friends_select_policy ON friends;
DROP POLICY IF EXISTS friends_insert_policy ON friends;
DROP POLICY IF EXISTS friends_update_policy ON friends;
DROP POLICY IF EXISTS friends_delete_policy ON friends;

-- Option 1: Updated policies that work with Supabase auth + all_users table
-- These policies check if the authenticated user's email matches a user in all_users

CREATE POLICY friends_select_policy ON friends
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM all_users au 
            WHERE au.email = auth.email() 
            AND (au.id = friends.user_id OR au.id = friends.friend_id)
        )
    );

CREATE POLICY friends_insert_policy ON friends
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM all_users au 
            WHERE au.email = auth.email() 
            AND au.id = friends.user_id
        )
    );

CREATE POLICY friends_update_policy ON friends
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM all_users au 
            WHERE au.email = auth.email() 
            AND au.id = friends.friend_id
        )
    );

CREATE POLICY friends_delete_policy ON friends
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM all_users au 
            WHERE au.email = auth.email() 
            AND (au.id = friends.user_id OR au.id = friends.friend_id)
        )
    );

-- =====================================================
-- ALTERNATIVE: Temporarily disable RLS (Quick Fix)
-- =====================================================

-- If the above policies still don't work, you can temporarily disable RLS:
-- ALTER TABLE friends DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Test if the current user can access their data
-- SELECT auth.email();
-- SELECT * FROM all_users WHERE email = auth.email(); 