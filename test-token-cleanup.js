const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = 'https://iizdmrngykraambvsbwv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpemRtcm5neWtyYWFtYnZzYnd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2Mzc5NDEsImV4cCI6MjA2MjIxMzk0MX0.ZmcvSrYS4bObjFQB7Mmwux7rR1kwiaWBV5CrUrOTKLY';

async function testTokenCleanup() {
  try {
    console.log('🔍 Testing token cleanup functionality...');
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Check current state of user_push_tokens table
    console.log('\n📊 Current user_push_tokens table state:');
    const { data: tokens, error: tokensError } = await supabase
      .from('user_push_tokens')
      .select('id, user_id, email, platform, is_active, created_at, updated_at')
      .order('created_at', { ascending: false });
    
    if (tokensError) {
      console.error('❌ Error fetching tokens:', tokensError);
      return;
    }
    
    if (tokens.length === 0) {
      console.log('ℹ️ No tokens found in user_push_tokens table');
      return;
    }
    
    console.log(`Found ${tokens.length} tokens:`);
    tokens.forEach((token, index) => {
      console.log(`  ${index + 1}. User: ${token.email} | Platform: ${token.platform} | Active: ${token.is_active} | Created: ${new Date(token.created_at).toLocaleString()}`);
    });
    
    // Check for any users with multiple active tokens
    console.log('\n🔍 Checking for users with multiple active tokens:');
    const activeTokens = tokens.filter(t => t.is_active);
    const userTokenCounts = {};
    
    activeTokens.forEach(token => {
      const key = `${token.user_id}_${token.platform}`;
      userTokenCounts[key] = (userTokenCounts[key] || 0) + 1;
    });
    
    const multipleTokens = Object.entries(userTokenCounts).filter(([key, count]) => count > 1);
    
    if (multipleTokens.length === 0) {
      console.log('✅ No users have multiple active tokens on the same platform');
    } else {
      console.log('⚠️ Users with multiple active tokens on same platform:');
      multipleTokens.forEach(([key, count]) => {
        console.log(`  - ${key}: ${count} active tokens`);
      });
    }
    
    // Check for inactive tokens (should be from sign-outs)
    const inactiveTokens = tokens.filter(t => !t.is_active);
    if (inactiveTokens.length > 0) {
      console.log('\n📉 Inactive tokens (from sign-outs):');
      inactiveTokens.forEach((token, index) => {
        console.log(`  ${index + 1}. User: ${token.email} | Platform: ${token.platform} | Deactivated: ${new Date(token.updated_at).toLocaleString()}`);
      });
    }
    
    console.log('\n🎯 Token cleanup test complete!');
    console.log('💡 To test the cleanup:');
    console.log('   1. Sign out of the app');
    console.log('   2. Run this script again');
    console.log('   3. Check if your token is now marked as inactive');
    
  } catch (error) {
    console.error('❌ Error in testTokenCleanup:', error);
  }
}

// Run the test
testTokenCleanup();
