#!/usr/bin/env node

/**
 * Test script to verify follow notification fix
 * This script simulates the follow notification flow
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration - update these with your actual values
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://iizdmrngykraambvsbwv.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpemRtcm5neWtyYWFtYnZzYnd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2Mzc5NDEsImV4cCI6MjA2MjIxMzk0MX0.ZmcvSrYS4bObjFQB7Mmwux7rR1kwiaWBV5CrUrOTKLY';

if (SUPABASE_URL === 'your-supabase-url' || SUPABASE_ANON_KEY === 'your-supabase-anon-key') {
  console.log('❌ Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables');
  console.log('Example:');
  console.log('export SUPABASE_URL="https://your-project.supabase.co"');
  console.log('export SUPABASE_ANON_KEY="your-anon-key"');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testFollowNotification() {
  console.log('🧪 Testing follow notification fix...\n');

  try {
    // Test 1: Check if the Edge Function exists
    console.log('1️⃣ Testing Edge Function availability...');
    
    // Note: We can't list functions via the client, so we'll test by trying to invoke it
    console.log('   Note: Function listing not available via client, testing invocation instead...\n');

    // Test 2: Check database tables
    console.log('2️⃣ Testing database tables...');
    
    // Check user_push_tokens table
    const { data: tokens, error: tokensError } = await supabase
      .from('user_push_tokens')
      .select('count')
      .limit(1);

    if (tokensError) {
      console.log('❌ user_push_tokens table not accessible:', tokensError.message);
      console.log('💡 Run the SQL script: scripts/create_notification_tables.sql');
      return;
    }

    console.log('✅ user_push_tokens table accessible');

    // Check notification_logs table
    const { data: logs, error: logsError } = await supabase
      .from('notification_logs')
      .select('count')
      .limit(1);

    if (logsError) {
      console.log('⚠️ notification_logs table not accessible (optional):', logsError.message);
    } else {
      console.log('✅ notification_logs table accessible');
    }

    console.log('');

    // Test 3: Test function invocation (with mock data)
    console.log('3️⃣ Testing function invocation...');
    
    const testData = {
      followerId: 999999, // Mock ID
      followerName: 'Test User',
      followedId: 999998, // Mock ID
      followedEmail: 'prithviseran0@gmail.com'
    };

    try {
      const { data, error } = await supabase.functions.invoke('send-follow-notification', {
        body: testData
      });

      console.log(data);

      if (error) {
        if (error.message.includes('No active push token found')) {
          console.log('✅ Function working correctly - no push token found for test user (expected)');
        } else {
          console.log('❌ Function error:', error.message);
        }
      } else {
        console.log('✅ Function invoked successfully');
        console.log('   Response:', data);
      }
    } catch (invokeError) {
      console.log('❌ Function invocation failed:', invokeError.message);
    }

    console.log('\n🎉 Test completed!');
    console.log('\n📱 To test with real users:');
    console.log('   1. Have two users in the app');
    console.log('   2. User A follows User B');
    console.log('   3. User B should receive push notification');
    console.log('   4. User A should NOT receive notification');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testFollowNotification();
