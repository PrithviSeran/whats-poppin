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

    const { eventId, eventName, creatorId, creatorName } = await req.json()

    if (!eventId || !eventName || !creatorId || !creatorName) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get all followers of the event creator
    const { data: followers, error: followersError } = await supabaseClient
      .from('follows')
      .select(`
        follower_id,
        all_users!follows_follower_id_fkey (
          id,
          name,
          email
        )
      `)
      .eq('followed_id', creatorId)

    if (followersError) {
      console.error('Error fetching followers:', followersError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch followers' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!followers || followers.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No followers to notify' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send notifications to each follower
    const notificationPromises = followers.map(async (follower) => {
      const user = follower.all_users
      if (!user) return null

      // Get user's push token from user_push_tokens table
      const { data: userToken, error: tokenError } = await supabaseClient
        .from('user_push_tokens')
        .select('push_token')
        .eq('email', user.email)
        .eq('is_active', true)
        .single()

      if (tokenError || !userToken?.push_token) {
        console.log(`No active push token found for user ${user.email}`)
        return null
      }

      // Send push notification using Expo's push service
      const message = {
        to: userToken.push_token,
        sound: 'default',
        title: 'New Event from Someone You Follow! 🎈',
        body: `${creatorName} created "${eventName}"`,
        data: {
          type: 'new_event_following',
          eventId: eventId.toString(),
          eventName: eventName,
          creatorName: creatorName,
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
        console.error(`Failed to send notification to ${user.email}:`, await response.text())
        return { error: true, user: user.email }
      }

      return { success: true, user: user.email }
    })

    const results = await Promise.all(notificationPromises)
    const successful = results.filter(r => r?.success).length
    const failed = results.filter(r => r?.error).length

    console.log(`Sent notifications: ${successful} successful, ${failed} failed`)

    return new Response(
      JSON.stringify({ 
        message: 'Notifications sent',
        results: {
          total: followers.length,
          successful,
          failed
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in send-event-notifications function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}) 