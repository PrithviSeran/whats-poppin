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

-- Enable Row Level Security
ALTER TABLE all_users ENABLE ROW LEVEL SECURITY;

-- Create the follows table for unidirectional following
CREATE TABLE IF NOT EXISTS public.follows (
    id SERIAL PRIMARY KEY,
    follower_id INTEGER NOT NULL REFERENCES public.all_users(id) ON DELETE CASCADE,
    following_id INTEGER NOT NULL REFERENCES public.all_users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(follower_id, following_id),
    CHECK (follower_id != following_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows(following_id);

-- Enable RLS on follows table
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- RLS policies for follows (users can manage their own follows and see public follow relationships)
CREATE POLICY "Users can insert their own follows" ON public.follows
    FOR INSERT WITH CHECK (follower_id = (SELECT id FROM all_users WHERE email = auth.jwt() ->> 'email'));

CREATE POLICY "Users can delete their own follows" ON public.follows
    FOR DELETE USING (follower_id = (SELECT id FROM all_users WHERE email = auth.jwt() ->> 'email'));

CREATE POLICY "Users can view all follows" ON public.follows
    FOR SELECT USING (true);

-- Update the existing friend request function to also create a follow relationship
CREATE OR REPLACE FUNCTION send_friend_request(target_email TEXT)
RETURNS JSON AS $$
DECLARE
    sender_user_id INTEGER;
    target_user_id INTEGER;
    existing_friendship INTEGER;
    existing_request INTEGER;
BEGIN
    -- Get sender user ID from JWT
    SELECT id INTO sender_user_id FROM all_users WHERE email = auth.jwt() ->> 'email';
    
    IF sender_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'User not authenticated');
    END IF;
    
    -- Get target user ID
    SELECT id INTO target_user_id FROM all_users WHERE email = target_email;
    
    IF target_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Target user not found');
    END IF;
    
    IF sender_user_id = target_user_id THEN
        RETURN json_build_object('success', false, 'message', 'Cannot send friend request to yourself');
    END IF;
    
    -- Check if already friends
    SELECT id INTO existing_friendship FROM friends 
    WHERE (user1_id = sender_user_id AND user2_id = target_user_id AND status = 'accepted')
       OR (user1_id = target_user_id AND user2_id = sender_user_id AND status = 'accepted');
    
    IF existing_friendship IS NOT NULL THEN
        RETURN json_build_object('success', false, 'message', 'Already friends');
    END IF;
    
    -- Check if request already exists
    SELECT id INTO existing_request FROM friend_requests 
    WHERE sender_id = sender_user_id AND receiver_id = target_user_id AND status = 'pending';
    
    IF existing_request IS NOT NULL THEN
        RETURN json_build_object('success', false, 'message', 'Friend request already sent');
    END IF;
    
    -- Insert friend request
    INSERT INTO friend_requests (sender_id, receiver_id, status)
    VALUES (sender_user_id, target_user_id, 'pending');
    
    -- Automatically follow the target user when sending friend request
    INSERT INTO follows (follower_id, following_id)
    VALUES (sender_user_id, target_user_id)
    ON CONFLICT (follower_id, following_id) DO NOTHING;
    
    RETURN json_build_object('success', true, 'message', 'Friend request sent and user followed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to follow a user (instant, no approval needed)
CREATE OR REPLACE FUNCTION follow_user(target_email TEXT)
RETURNS JSON AS $$
DECLARE
    follower_user_id INTEGER;
    target_user_id INTEGER;
    existing_follow INTEGER;
BEGIN
    -- Get follower user ID from JWT
    SELECT id INTO follower_user_id FROM all_users WHERE email = auth.jwt() ->> 'email';
    
    IF follower_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'User not authenticated');
    END IF;
    
    -- Get target user ID
    SELECT id INTO target_user_id FROM all_users WHERE email = target_email;
    
    IF target_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Target user not found');
    END IF;
    
    IF follower_user_id = target_user_id THEN
        RETURN json_build_object('success', false, 'message', 'Cannot follow yourself');
    END IF;
    
    -- Check if already following
    SELECT id INTO existing_follow FROM follows 
    WHERE follower_id = follower_user_id AND following_id = target_user_id;
    
    IF existing_follow IS NOT NULL THEN
        RETURN json_build_object('success', false, 'message', 'Already following this user');
    END IF;
    
    -- Insert follow relationship
    INSERT INTO follows (follower_id, following_id)
    VALUES (follower_user_id, target_user_id);
    
    RETURN json_build_object('success', true, 'message', 'Successfully followed user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to unfollow a user
CREATE OR REPLACE FUNCTION unfollow_user(target_email TEXT)
RETURNS JSON AS $$
DECLARE
    follower_user_id INTEGER;
    target_user_id INTEGER;
BEGIN
    -- Get follower user ID from JWT
    SELECT id INTO follower_user_id FROM all_users WHERE email = auth.jwt() ->> 'email';
    
    IF follower_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'User not authenticated');
    END IF;
    
    -- Get target user ID
    SELECT id INTO target_user_id FROM all_users WHERE email = target_email;
    
    IF target_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Target user not found');
    END IF;
    
    -- Delete follow relationship
    DELETE FROM follows 
    WHERE follower_id = follower_user_id AND following_id = target_user_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Not following this user');
    END IF;
    
    RETURN json_build_object('success', true, 'message', 'Successfully unfollowed user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's followers
CREATE OR REPLACE FUNCTION get_user_followers(target_user_id INTEGER)
RETURNS TABLE (
    follower_id INTEGER,
    follower_name TEXT,
    follower_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.follower_id,
        u.name,
        u.email,
        f.created_at
    FROM follows f
    JOIN all_users u ON u.id = f.follower_id
    WHERE f.following_id = target_user_id
    ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get users that a user is following
CREATE OR REPLACE FUNCTION get_user_following(target_user_id INTEGER)
RETURNS TABLE (
    following_id INTEGER,
    following_name TEXT,
    following_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.following_id,
        u.name,
        u.email,
        f.created_at
    FROM follows f
    JOIN all_users u ON u.id = f.following_id
    WHERE f.follower_id = target_user_id
    ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user A follows user B
CREATE OR REPLACE FUNCTION check_follow_status(follower_email TEXT, following_email TEXT)
RETURNS JSON AS $$
DECLARE
    follower_user_id INTEGER;
    following_user_id INTEGER;
    is_following BOOLEAN;
    are_friends BOOLEAN;
    pending_request BOOLEAN;
BEGIN
    -- Get user IDs
    SELECT id INTO follower_user_id FROM all_users WHERE email = follower_email;
    SELECT id INTO following_user_id FROM all_users WHERE email = following_email;
    
    IF follower_user_id IS NULL OR following_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'User not found');
    END IF;
    
    -- Check if following
    SELECT EXISTS(
        SELECT 1 FROM follows 
        WHERE follower_id = follower_user_id AND following_id = following_user_id
    ) INTO is_following;
    
    -- Check if friends
    SELECT EXISTS(
        SELECT 1 FROM friends 
        WHERE ((user1_id = follower_user_id AND user2_id = following_user_id) 
            OR (user1_id = following_user_id AND user2_id = follower_user_id))
        AND status = 'accepted'
    ) INTO are_friends;
    
    -- Check if there's a pending friend request
    SELECT EXISTS(
        SELECT 1 FROM friend_requests 
        WHERE sender_id = follower_user_id AND receiver_id = following_user_id AND status = 'pending'
    ) INTO pending_request;
    
    RETURN json_build_object(
        'success', true,
        'is_following', is_following,
        'are_friends', are_friends,
        'pending_friend_request', pending_request
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get followers count
CREATE OR REPLACE FUNCTION get_followers_count(target_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    count_result INTEGER;
BEGIN
    SELECT COUNT(*) INTO count_result
    FROM follows
    WHERE following_id = target_user_id;
    
    RETURN count_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get following count
CREATE OR REPLACE FUNCTION get_following_count(target_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    count_result INTEGER;
BEGIN
    SELECT COUNT(*) INTO count_result
    FROM follows
    WHERE follower_id = target_user_id;
    
    RETURN count_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 