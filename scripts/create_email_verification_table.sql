-- Create email_verifications table for handling email verification
CREATE TABLE IF NOT EXISTS email_verifications (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    verification_token VARCHAR(255) UNIQUE NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(verification_token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_verified ON email_verifications(verified);

-- Enable RLS (Row Level Security)
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;

-- Create policy for users to insert their own verification records
CREATE POLICY "Users can insert their own verification records" ON email_verifications
    FOR INSERT
    WITH CHECK (true);

-- Create policy for users to read their own verification records
CREATE POLICY "Users can read their own verification records" ON email_verifications
    FOR SELECT
    USING (true);

-- Create policy for service role to update verification status
CREATE POLICY "Service role can update verification status" ON email_verifications
    FOR UPDATE
    USING (true);

-- Grant necessary permissions
GRANT ALL ON email_verifications TO authenticated;
GRANT ALL ON email_verifications TO service_role;
GRANT USAGE, SELECT ON SEQUENCE email_verifications_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE email_verifications_id_seq TO service_role; 