import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')

    if (!token) {
      return new Response(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invalid Verification Link</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
            .container { max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .error { color: #e74c3c; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="error">Invalid Link</h1>
            <p>This verification link is invalid or malformed.</p>
            <p>Please try requesting a new verification email.</p>
          </div>
        </body>
        </html>
        `,
        {
          headers: { ...corsHeaders, 'Content-Type': 'text/html' },
          status: 400
        }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Check if token exists and is not expired
    const { data: verification, error: fetchError } = await supabase
      .from('email_verifications')
      .select('*')
      .eq('verification_token', token)
      .single()

    if (fetchError || !verification) {
      return new Response(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invalid Verification Token</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
            .container { max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .error { color: #e74c3c; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="error">Invalid Token</h1>
            <p>This verification token is invalid or has expired.</p>
            <p>Please try requesting a new verification email.</p>
          </div>
        </body>
        </html>
        `,
        {
          headers: { ...corsHeaders, 'Content-Type': 'text/html' },
          status: 404
        }
      )
    }

    // Check if token is expired
    if (new Date(verification.expires_at) < new Date()) {
      return new Response(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Verification Link Expired</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
            .container { max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .error { color: #e74c3c; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="error">Link Expired</h1>
            <p>This verification link has expired.</p>
            <p>Please request a new verification email from the app.</p>
          </div>
        </body>
        </html>
        `,
        {
          headers: { ...corsHeaders, 'Content-Type': 'text/html' },
          status: 410
        }
      )
    }

    // Check if already verified
    if (verification.verified) {
      return new Response(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Already Verified</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
            .container { max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .success { color: #27ae60; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="success">✓ Already Verified</h1>
            <p>This email has already been verified.</p>
            <p>You can continue with your account creation in the app.</p>
          </div>
        </body>
        </html>
        `,
        {
          headers: { ...corsHeaders, 'Content-Type': 'text/html' },
          status: 200
        }
      )
    }

    // Mark as verified
    const { error: updateError } = await supabase
      .from('email_verifications')
      .update({ 
        verified: true, 
        verified_at: new Date().toISOString() 
      })
      .eq('verification_token', token)

    if (updateError) {
      console.error('Error updating verification status:', updateError)
      return new Response(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Verification Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
            .container { max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .error { color: #e74c3c; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="error">Verification Failed</h1>
            <p>There was an error verifying your email.</p>
            <p>Please try again or contact support.</p>
          </div>
        </body>
        </html>
        `,
        {
          headers: { ...corsHeaders, 'Content-Type': 'text/html' },
          status: 500
        }
      )
    }

    // Success response
    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Email Verified Successfully</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
          .container { max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .success { color: #27ae60; }
          .icon { font-size: 48px; margin-bottom: 20px; }
          .app-link { color: #9E95BD; text-decoration: none; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">✅</div>
          <h1 class="success">Email Verified!</h1>
          <p>Your email <strong>${verification.email}</strong> has been successfully verified.</p>
          <p>You can now return to the <a href="#" class="app-link">What's Poppin app</a> to continue creating your account.</p>
          <p><small>You can close this tab.</small></p>
        </div>
      </body>
      </html>
      `,
      {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Verification Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
          .container { max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .error { color: #e74c3c; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 class="error">Something went wrong</h1>
          <p>An unexpected error occurred during verification.</p>
          <p>Please try again or contact support.</p>
        </div>
      </body>
      </html>
      `,
      {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        status: 500
      }
    )
  }
}) 