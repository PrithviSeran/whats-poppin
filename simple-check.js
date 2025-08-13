#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'your-supabase-url';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

if (SUPABASE_URL === 'your-supabase-url' || SUPABASE_ANON_KEY === 'your-anon-key') {
  console.log('❌ Please set your environment variables first');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkTokens() {
  console.log('🔍 Checking for push tokens...\n');
  
  try {
    const { data, error } = await supabase
      .from('user_push_tokens')
      .select('*');
    
    if (error) {
      console.log('❌ Error:', error.message);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('⚠️ No push tokens found!');
      console.log('');
      console.log('💡 This means follow notifications won\'t work yet.');
      console.log('🔧 To fix this:');
      console.log('   1. Open your app on a physical device');
      console.log('   2. Grant notification permissions');
      console.log('   3. The app should save your push token');
    } else {
      console.log(`✅ Found ${data.length} push token(s):`);
      data.forEach((token, i) => {
        console.log(`   ${i+1}. ${token.email} (${token.platform}) - Active: ${token.is_active}`);
      });
    }
  } catch (err) {
    console.log('❌ Error:', err.message);
  }
}

checkTokens();
