-- Simple trigger to delete user from all_users when auth account is deleted
-- Run this in your Supabase SQL Editor

-- Create the trigger function
CREATE OR REPLACE FUNCTION delete_user_from_all_users()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete the user from all_users table based on their email
    DELETE FROM all_users 
    WHERE email = OLD.email;
    
    -- Log the deletion
    RAISE NOTICE 'User deleted from all_users table: %', OLD.email;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE OR REPLACE TRIGGER trigger_delete_user_from_all_users
    AFTER DELETE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION delete_user_from_all_users();