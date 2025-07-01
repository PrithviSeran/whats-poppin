-- Create table for storing user push tokens
CREATE TABLE IF NOT EXISTS user_push_tokens (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    push_token TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Create unique index to prevent duplicate tokens per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_push_tokens_user_platform 
ON user_push_tokens(user_id, platform) 
WHERE is_active = TRUE;

-- Create index for efficient token lookups
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_token 
ON user_push_tokens(push_token) 
WHERE is_active = TRUE;

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_email 
ON user_push_tokens(email) 
WHERE is_active = TRUE;

-- Enable Row Level Security
ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to manage their own tokens
CREATE POLICY "Users can manage their own push tokens" ON user_push_tokens
    FOR ALL USING (auth.uid() = user_id);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_push_tokens_updated_at 
    BEFORE UPDATE ON user_push_tokens 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to deactivate old tokens when new ones are added
CREATE OR REPLACE FUNCTION deactivate_old_tokens()
RETURNS TRIGGER AS $$
BEGIN
    -- Deactivate old tokens for the same user and platform
    UPDATE user_push_tokens 
    SET is_active = FALSE 
    WHERE user_id = NEW.user_id 
    AND platform = NEW.platform 
    AND id != NEW.id;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to deactivate old tokens
CREATE TRIGGER deactivate_old_push_tokens 
    BEFORE INSERT ON user_push_tokens 
    FOR EACH ROW 
    EXECUTE FUNCTION deactivate_old_tokens();

-- Create table for notification logs (optional, for debugging)
CREATE TABLE IF NOT EXISTS notification_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed')),
    error_message TEXT
);

-- Enable RLS for notification logs
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for notification logs
CREATE POLICY "Users can view their own notification logs" ON notification_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Create indexes for notification logs
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id 
ON notification_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at 
ON notification_logs(sent_at);

CREATE INDEX IF NOT EXISTS idx_notification_logs_type 
ON notification_logs(notification_type);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated; 