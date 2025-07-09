# Email Verification Setup Guide

This document explains how to set up the new simplified email verification system that doesn't rely on Supabase Auth for verification codes.

## What Changed

- **Before**: Created temporary Supabase Auth users to send OTP codes (complex, error-prone)
- **After**: Custom verification system with Edge Functions (simple, reliable)

## Setup Steps

### 1. Create the Database Table

Run the SQL script to create the verification table:

```bash
# In your Supabase dashboard, go to SQL Editor and run:
cat scripts/create_email_verification_table.sql
```

Or run it directly in your Supabase SQL editor.

### 2. Deploy the Edge Function

Deploy the email verification Edge Function:

```bash
# From your project root
supabase functions deploy send-verification-code
```

### 3. Set up Email Service (Resend)

1. Sign up for [Resend](https://resend.com) (free tier available)
2. Get your API key from the Resend dashboard
3. Add it to your Supabase project:

```bash
# Set the environment variable in Supabase
supabase secrets set RESEND_API_KEY=your_resend_api_key_here
```

### 4. Alternative Email Services

If you prefer not to use Resend, you can modify the Edge Function to use:

- **SendGrid**: Replace the Resend API call with SendGrid's API
- **Mailgun**: Use Mailgun's API instead
- **AWS SES**: Use AWS Simple Email Service
- **Any SMTP service**: Add SMTP support to the Edge Function

### 5. Test the Flow

1. Start your app and navigate to the email screen
2. Enter an email address
3. Click "Send Verification Code"
4. Check your email for the 6-digit code
5. Enter the code and verify
6. Complete the signup process

## How It Works

### Email Verification Flow

1. **Send Code**: Edge Function generates 6-digit code, stores in `email_verifications` table, sends email
2. **Verify Code**: App checks code against database table, marks as verified when correct
3. **Account Creation**: Normal Supabase Auth signup (email already verified)

### Benefits

- ✅ **No temp auth users**: Cleaner, simpler flow
- ✅ **No complex password management**: No temp passwords to track
- ✅ **Better error handling**: Clear separation of concerns
- ✅ **More reliable**: Fewer moving parts, less prone to session issues
- ✅ **Customizable**: Easy to change email provider or styling

### Database Schema

```sql
email_verifications:
- id: Primary key
- email: Email address
- code: 6-digit verification code
- expires_at: When the code expires (10 minutes)
- created_at: When the code was created
- verified_at: When the code was verified (NULL = not verified)
```

## Troubleshooting

### "Function not found" error
- Make sure you deployed the Edge Function: `supabase functions deploy send-verification-code`

### "Failed to send email" error
- Check your RESEND_API_KEY is set correctly
- Verify your Resend account is active
- Check Supabase function logs for details

### "Invalid verification code" error
- Code might be expired (10 minute limit)
- Code might already be used
- Check the `email_verifications` table for debugging

### RLS (Row Level Security) issues
- The table policies allow public access since users aren't authenticated yet
- If you're getting permission errors, check the RLS policies

## Security Notes

- Codes expire after 10 minutes
- Codes can only be used once
- Rate limiting on code generation (60 seconds between requests)
- Email addresses are case-insensitive
- Old codes are automatically cleaned up 