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
    const { email } = await req.json()
    
    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Generate a 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
    
    // Store the verification code in a custom table
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Store verification code with expiration (10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    
    const { error: insertError } = await supabase
      .from('email_verifications')
      .upsert([{
        email: email.toLowerCase(),
        code: verificationCode,
        expires_at: expiresAt,
        created_at: new Date().toISOString()
      }])

    if (insertError) {
      console.error('Error storing verification code:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to store verification code' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Send email using Resend (you can use any email service)
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    
    if (RESEND_API_KEY) {
      const emailBody = {
        from: 'What\'s Poppin <noreply@whatspoppin.app>',
        to: [email],
        subject: 'Your verification code for What\'s Poppin',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #9E95BD;">What's Poppin</h1>
            <h2>Email Verification</h2>
            <p>Your verification code is:</p>
            <div style="font-size: 32px; font-weight: bold; color: #9E95BD; text-align: center; padding: 20px; background-color: #f5f5f5; border-radius: 8px; margin: 20px 0;">
              ${verificationCode}
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
          </div>
        `
      }

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailBody),
      })

      if (!emailResponse.ok) {
        console.error('Failed to send email:', await emailResponse.text())
        return new Response(
          JSON.stringify({ error: 'Failed to send email' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Verification code sent successfully' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in send-verification-code function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}) 