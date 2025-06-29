-- Drop existing functions if they exist to avoid return type conflicts
-- =======================================================================

DROP FUNCTION IF EXISTS send_friend_request(BIGINT, BIGINT);
DROP FUNCTION IF EXISTS accept_friend_request(BIGINT);
DROP FUNCTION IF EXISTS decline_friend_request(BIGINT);
DROP FUNCTION IF EXISTS get_pending_friend_requests(BIGINT);
DROP FUNCTION IF EXISTS get_user_friends(BIGINT);
DROP FUNCTION IF EXISTS remove_friend(BIGINT, BIGINT);
DROP FUNCTION IF EXISTS follow_user(TEXT, TEXT);
DROP FUNCTION IF EXISTS unfollow_user(TEXT, TEXT);
DROP FUNCTION IF EXISTS get_user_followers(BIGINT);
DROP FUNCTION IF EXISTS get_user_following(BIGINT);
DROP FUNCTION IF EXISTS get_followers_count(BIGINT);
DROP FUNCTION IF EXISTS get_following_count(BIGINT);

-- Friend Request Functions
-- ======================

-- Function to send a friend request
CREATE OR REPLACE FUNCTION send_friend_request(
    sender_id BIGINT,
    receiver_id BIGINT
) RETURNS JSON AS $$
DECLARE
    existing_request RECORD;
    existing_friendship RECORD;
BEGIN
    -- Check if users are already friends
    SELECT * INTO existing_friendship 
    FROM friends 
    WHERE ((user_id = sender_id AND friend_id = receiver_id) 
           OR (user_id = receiver_id AND friend_id = sender_id))
    AND status::TEXT = 'accepted';
    
    IF existing_friendship IS NOT NULL THEN
        RETURN json_build_object('success', false, 'message', 'You are already friends with this user');
    END IF;
    
    -- Check if a friend request already exists
    SELECT * INTO existing_request 
    FROM friend_requests 
    WHERE sender_id = send_friend_request.sender_id 
    AND receiver_id = send_friend_request.receiver_id 
    AND status::TEXT = 'pending';
    
    IF existing_request IS NOT NULL THEN
        RETURN json_build_object('success', false, 'message', 'Friend request already sent');
    END IF;
    
    -- Insert new friend request
    INSERT INTO friend_requests (sender_id, receiver_id, status, created_at)
    VALUES (sender_id, receiver_id, 'pending', NOW());
    
    RETURN json_build_object('success', true, 'message', 'Friend request sent successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get pending friend requests for a user
CREATE OR REPLACE FUNCTION get_pending_friend_requests(
    target_user_id BIGINT
) RETURNS TABLE(
    request_id BIGINT,
    sender_id BIGINT,
    sender_name TEXT,
    sender_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fr.id,
        fr.sender_id,
        u.name,
        u.email,
        fr.created_at
    FROM friend_requests fr
    JOIN all_users u ON fr.sender_id = u.id
    WHERE fr.receiver_id = target_user_id 
    AND fr.status::TEXT = 'pending'
    ORDER BY fr.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to accept a friend request
CREATE OR REPLACE FUNCTION accept_friend_request(
    request_id BIGINT
) RETURNS JSON AS $$
DECLARE
    request_record RECORD;
BEGIN
    -- Get the friend request
    SELECT * INTO request_record 
    FROM friend_requests 
    WHERE id = request_id AND status::TEXT = 'pending';
    
    IF request_record IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Friend request not found or already processed');
    END IF;
    
    -- Update friend request status
    UPDATE friend_requests 
    SET status = 'accepted', updated_at = NOW()
    WHERE id = request_id;
    
    -- Create bidirectional friendship
    INSERT INTO friends (user_id, friend_id, status, created_at)
    VALUES 
        (request_record.sender_id, request_record.receiver_id, 'accepted', NOW()),
        (request_record.receiver_id, request_record.sender_id, 'accepted', NOW())
    ON CONFLICT (user_id, friend_id) DO UPDATE SET 
        status = 'accepted', 
        updated_at = NOW();
    
    RETURN json_build_object('success', true, 'message', 'Friend request accepted');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decline a friend request
CREATE OR REPLACE FUNCTION decline_friend_request(
    request_id BIGINT
) RETURNS JSON AS $$
BEGIN
    -- Update friend request status
    UPDATE friend_requests 
    SET status = 'declined', updated_at = NOW()
    WHERE id = request_id AND status::TEXT = 'pending';
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Friend request not found or already processed');
    END IF;
    
    RETURN json_build_object('success', true, 'message', 'Friend request declined');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Friends Functions
-- =================

-- Function to get user's friends
CREATE OR REPLACE FUNCTION get_user_friends(
    target_user_id BIGINT
) RETURNS TABLE(
    friend_id BIGINT,
    friend_name TEXT,
    friend_email TEXT,
    friendship_id BIGINT,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.friend_id,
        u.name,
        u.email,
        f.id,
        f.status::TEXT,  -- Cast ENUM to TEXT
        f.created_at
    FROM friends f
    JOIN all_users u ON f.friend_id = u.id
    WHERE f.user_id = target_user_id 
    AND f.status::TEXT = 'accepted'
    ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove a friend
CREATE OR REPLACE FUNCTION remove_friend(
    user_id BIGINT,
    friend_id BIGINT
) RETURNS JSON AS $$
BEGIN
    -- Remove both directions of friendship
    DELETE FROM friends 
    WHERE (friends.user_id = remove_friend.user_id AND friends.friend_id = remove_friend.friend_id)
    OR (friends.user_id = remove_friend.friend_id AND friends.friend_id = remove_friend.user_id);
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Friendship not found');
    END IF;
    
    RETURN json_build_object('success', true, 'message', 'Friend removed successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Follow Functions
-- ================

-- Function to follow a user
CREATE OR REPLACE FUNCTION follow_user(
    follower_email TEXT,
    followed_email TEXT
) RETURNS JSON AS $$
DECLARE
    follower_id BIGINT;
    followed_id BIGINT;
    existing_follow RECORD;
BEGIN
    -- Get follower ID
    SELECT id INTO follower_id FROM all_users WHERE email = follower_email;
    IF follower_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Follower user not found');
    END IF;
    
    -- Get followed user ID
    SELECT id INTO followed_id FROM all_users WHERE email = followed_email;
    IF followed_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Followed user not found');
    END IF;
    
    -- Check if already following
    SELECT * INTO existing_follow 
    FROM follows 
    WHERE follower_id = follow_user.follower_id AND followed_id = follow_user.followed_id;
    
    IF existing_follow IS NOT NULL THEN
        RETURN json_build_object('success', false, 'message', 'Already following this user');
    END IF;
    
    -- Insert follow relationship
    INSERT INTO follows (follower_id, followed_id, created_at)
    VALUES (follower_id, followed_id, NOW());
    
    RETURN json_build_object('success', true, 'message', 'Successfully followed user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to unfollow a user
CREATE OR REPLACE FUNCTION unfollow_user(
    follower_email TEXT,
    followed_email TEXT
) RETURNS JSON AS $$
DECLARE
    follower_id BIGINT;
    followed_id BIGINT;
BEGIN
    -- Get follower ID
    SELECT id INTO follower_id FROM all_users WHERE email = follower_email;
    IF follower_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Follower user not found');
    END IF;
    
    -- Get followed user ID
    SELECT id INTO followed_id FROM all_users WHERE email = followed_email;
    IF followed_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Followed user not found');
    END IF;
    
    -- Delete follow relationship
    DELETE FROM follows 
    WHERE follower_id = unfollow_user.follower_id AND followed_id = unfollow_user.followed_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Not following this user');
    END IF;
    
    RETURN json_build_object('success', true, 'message', 'Successfully unfollowed user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's followers
CREATE OR REPLACE FUNCTION get_user_followers(
    target_user_id BIGINT
) RETURNS TABLE(
    follower_id BIGINT,
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
    JOIN all_users u ON f.follower_id = u.id
    WHERE f.followed_id = target_user_id
    ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get users that a user is following
CREATE OR REPLACE FUNCTION get_user_following(
    target_user_id BIGINT
) RETURNS TABLE(
    following_id BIGINT,
    following_name TEXT,
    following_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.followed_id,
        u.name,
        u.email,
        f.created_at
    FROM follows f
    JOIN all_users u ON f.followed_id = u.id
    WHERE f.follower_id = target_user_id
    ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get followers count
CREATE OR REPLACE FUNCTION get_followers_count(
    target_user_id BIGINT
) RETURNS INTEGER AS $$
DECLARE
    follower_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO follower_count
    FROM follows
    WHERE followed_id = target_user_id;
    
    RETURN COALESCE(follower_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get following count
CREATE OR REPLACE FUNCTION get_following_count(
    target_user_id BIGINT
) RETURNS INTEGER AS $$
DECLARE
    following_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO following_count
    FROM follows
    WHERE follower_id = target_user_id;
    
    RETURN COALESCE(following_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION send_friend_request(BIGINT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_friend_request(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_friend_request(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_friend_requests(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_friends(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_friend(BIGINT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION follow_user(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION unfollow_user(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_followers(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_following(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_followers_count(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_following_count(BIGINT) TO authenticated; 