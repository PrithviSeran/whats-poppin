import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationRequest {
  type: 'weekend_friday' | 'weekend_saturday' | 'weekend_tuesday' | 'all';
}

const NOTIFICATION_MESSAGES = {
  weekend_friday: {
    title: 'TGIF! 🎉',
    body: "Friday afternoon vibes! Check out what's poppin' in your city this weekend!"
  },
  weekend_saturday: {
    title: 'Saturday Fun! 🌟',
    body: "Weekend mode activated! Discover amazing events happening in your city today!"
  },
  weekend_tuesday: {
    title: 'Tuesday Vibes! 🌟',
    body: "Midweek motivation! Check out what's happening in your city today!"
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { type }: NotificationRequest = await req.json()
    
    console.log(`🚀 Starting weekend notifications for type: ${type}`)

    // Get all active push tokens
    const { data: userTokens, error: tokenError } = await supabaseClient
      .from('user_push_tokens')
      .select('push_token, user_id, email, platform')
      .eq('is_active', true)

    if (tokenError) {
      console.error('❌ Error fetching user tokens:', tokenError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!userTokens || userTokens.length === 0) {
      console.log('ℹ️ No active push tokens found')
      return new Response(
        JSON.stringify({ message: 'No active push tokens found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📱 Found ${userTokens.length} active push tokens`)

    // Determine which notifications to send
    let notificationsToSend: Array<{ type: string; title: string; body: string }> = []
    
    if (type === 'all') {
      notificationsToSend = Object.entries(NOTIFICATION_MESSAGES).map(([key, value]) => ({
        type: key,
        title: value.title,
        body: value.body
      }))
    } else if (type in NOTIFICATION_MESSAGES) {
      notificationsToSend = [{
        type,
        title: NOTIFICATION_MESSAGES[type as keyof typeof NOTIFICATION_MESSAGES].title,
        body: NOTIFICATION_MESSAGES[type as keyof typeof NOTIFICATION_MESSAGES].body
      }]
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid notification type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let successCount = 0
    let errorCount = 0

    // Send notifications for each type
    for (const notification of notificationsToSend) {
      console.log(`📤 Sending ${notification.type} notifications...`)
      
      // Send to all users
      for (const userToken of userTokens) {
        try {
          const message = {
            to: userToken.push_token,
            sound: 'default',
            title: notification.title,
            body: notification.body,
            data: {
              type: 'weekend_reminder',
              notification_type: notification.type,
              timestamp: new Date().toISOString(),
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

          if (response.ok) {
            successCount++
            
            // Log the notification in our database
            try {
              await supabaseClient
                .from('notification_logs')
                .insert({
                  user_id: userToken.user_id,
                  notification_type: notification.type,
                  title: message.title,
                  body: message.body,
                  data: message.data,
                  status: 'sent'
                })
            } catch (logError) {
              console.warn(`⚠️ Failed to log notification for user ${userToken.email}:`, logError)
            }
          } else {
            errorCount++
            console.error(`❌ Failed to send notification to ${userToken.email}:`, await response.text())
          }
        } catch (error) {
          errorCount++
          console.error(`❌ Error sending notification to ${userToken.email}:`, error)
        }
      }
    }

    console.log(`✅ Weekend notifications completed! Success: ${successCount}, Errors: ${errorCount}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Weekend notifications sent successfully',
        summary: {
          total_users: userTokens.length,
          notifications_sent: successCount,
          errors: errorCount,
          notification_types: notificationsToSend.map(n => n.type)
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error in send-weekend-notifications function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
