#!/usr/bin/env node

/**
 * Script to check push tokens in the database
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration - update these with your actual values
const SUPABASE_URL = process.env.SUPABASE_URL || 'your-supabase-url';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key';

if (SUPABASE_URL === 'your-supabase-url' || SUPABASE_ANON_KEY === 'your-supabase-anon-key') {
  console.log('❌ Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables');
  console.log('Example:');
  console.log('export SUPABASE_URL="https://your-project.supabase.co"');
  console.log('export SUPABASE_ANON_KEY="your-anon-key"');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkPushTokens() {
  console.log('🔍 Checking push tokens in database...\n');

  try {
    // Check if user_push_tokens table has data
    const { data: tokens, error: tokensError } = await supabase
      .from('user_push_tokens')
      .select('*')
      .order('created_at', { ascending: false });

    if (tokensError) {
      console.log('❌ Error accessing user_push_tokens table:', tokensError.message);
      return;
    }

    if (!tokens || tokens.length === 0) {
      console.log('⚠️ No push tokens found in database');
      console.log('');
      console.log('💡 This means:');
      console.log('   - Users haven\'t granted notification permissions yet');
      console.log('   - The app hasn\'t saved any push tokens');
      console.log('   - Follow notifications won\'t work until tokens are saved');
      console.log('');
      console.log('🔧 To fix this:');
      console.log('   1. Open the app on a physical device (not simulator)');
      console.log('   2. Grant notification permissions when prompted');
      console.log('   3. The app should automatically save the push token');
      console.log('   4. Check this script again to verify tokens are saved');
      return;
    }

    console.log(`✅ Found ${tokens.length} push token(s) in database:\n`);

    tokens.forEach((token, index) => {
      console.log(`${index + 1}. User: ${token.email}`);
      console.log(`   Platform: ${token.platform}`);
      console.log(`   Active: ${token.is_active ? 'Yes' : 'No'}`);
      console.log(`   Created: ${new Date(token.created_at).toLocaleString()}`);
      console.log(`   Updated: ${new Date(token.updated_at).toLocaleString()}`);
      console.log(`   Token: ${token.push_token.substring(0, 20)}...`);
      console.log('');
    });

    // Check if any tokens are active
    const activeTokens = tokens.filter(t => t.is_active);
    console.log(`📊 Summary: ${activeTokens.length} active token(s) out of ${tokens.length} total`);

    if (activeTokens.length === 0) {
      console.log('⚠️ No active tokens found - notifications won\'t work');
    } else {
      console.log('✅ Active tokens found - notifications should work');
    }

  } catch (error) {
    console.error('❌ Error checking push tokens:', error.message);
  }
}

// Run the check
checkPushTokens();
