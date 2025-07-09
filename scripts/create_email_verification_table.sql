-- Create email_verifications table for storing verification codes
CREATE TABLE IF NOT EXISTS email_verifications (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified_at TIMESTAMP WITH TIME ZONE
);

-- Add index for fast email lookups
CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);

-- Add index for cleanup of expired codes
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON email_verifications(expires_at);

-- Row Level Security
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;

-- Allow public access for verification operations (since users aren't authenticated yet)
CREATE POLICY "Allow public insert for email verification" ON email_verifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select for email verification" ON email_verifications FOR SELECT USING (true);
CREATE POLICY "Allow public update for email verification" ON email_verifications FOR UPDATE USING (true);

-- Function to clean up expired verification codes (optional - run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM email_verifications 
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql; 