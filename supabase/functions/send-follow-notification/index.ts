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
    // Create a Supabase client with the Auth context of the function
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { followerId, followerName, followedId, followedEmail } = await req.json()

    if (!followerId || !followerName || !followedId || !followedEmail) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the followed user's push token
    const { data: userToken, error: tokenError } = await supabaseClient
      .from('user_push_tokens')
      .select('push_token')
      .eq('email', followedEmail)
      .eq('is_active', true)
      .single()

    if (tokenError || !userToken?.push_token) {
      console.log(`No active push token found for user ${followedEmail}`)
      return new Response(
        JSON.stringify({ message: 'No active push token found for user' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send push notification using Expo's push service
    const message = {
      to: userToken.push_token,
      sound: 'default',
      title: 'New Follower! 🎉',
      body: `${followerName} started following you`,
      data: {
        type: 'new_follower',
        followerId: followerId.toString(),
        followerName: followerName,
      },
    }

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to send push notification:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to send push notification' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = await response.json()
    console.log('Push notification sent successfully:', result)

    // Log the notification in the database (optional)
    try {
      await supabaseClient
        .from('notification_logs')
        .insert({
          user_id: followedId,
          notification_type: 'new_follower',
          title: message.title,
          body: message.body,
          data: message.data,
          status: 'sent'
        })
    } catch (logError) {
      console.warn('Failed to log notification:', logError)
      // Don't fail the request if logging fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Follow notification sent successfully',
        result: result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in send-follow-notification function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
