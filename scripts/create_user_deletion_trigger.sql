-- Create trigger to automatically delete user from all_users when auth.users record is deleted
-- This ensures data consistency when users delete their accounts

-- Create the trigger function
CREATE OR REPLACE FUNCTION delete_user_from_all_users()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete the user from all_users table based on their email
    DELETE FROM all_users 
    WHERE email = OLD.email;
    
    -- Log the deletion (optional)
    RAISE NOTICE 'User deleted from all_users table: %', OLD.email;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger that fires AFTER a user is deleted from auth.users
CREATE OR REPLACE TRIGGER trigger_delete_user_from_all_users
    AFTER DELETE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION delete_user_from_all_users();

-- Alternative: If you want to also clean up related data, you can expand the function:
CREATE OR REPLACE FUNCTION delete_user_and_related_data()
RETURNS TRIGGER AS $$
DECLARE
    user_id_to_delete BIGINT;
BEGIN
    -- Get the user ID from all_users before deletion
    SELECT id INTO user_id_to_delete 
    FROM all_users 
    WHERE email = OLD.email;
    
    -- If user exists in all_users
    IF user_id_to_delete IS NOT NULL THEN
        -- Delete related data first (optional - depends on your needs)
        
        -- Delete from friends table
        DELETE FROM friends 
        WHERE user_id = user_id_to_delete OR friend_id = user_id_to_delete;
        
        -- Delete from follows table
        DELETE FROM follows 
        WHERE follower_id = user_id_to_delete OR followed_id = user_id_to_delete;
        
        -- Delete saved events (assuming you have this table)
        DELETE FROM saved_events 
        WHERE user_id = user_id_to_delete;
        
        -- Delete rejected events (assuming you have this table)
        DELETE FROM rejected_events 
        WHERE user_id = user_id_to_delete;
        
        -- Delete user's posted events (if you want to remove their events too)
        DELETE FROM new_events 
        WHERE posted_by_email = OLD.email;
        
        -- Finally, delete from all_users
        DELETE FROM all_users 
        WHERE id = user_id_to_delete;
        
        RAISE NOTICE 'User and all related data deleted for: %', OLD.email;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Replace the trigger to use the comprehensive cleanup function
DROP TRIGGER IF EXISTS trigger_delete_user_from_all_users ON auth.users;

CREATE TRIGGER trigger_delete_user_comprehensive_cleanup
    AFTER DELETE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION delete_user_and_related_data();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION delete_user_from_all_users() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION delete_user_and_related_data() TO authenticated, anon;