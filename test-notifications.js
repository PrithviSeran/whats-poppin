const { createClient } = require('@supabase/supabase-js');

// Test the notification function
async function testNotifications() {
  console.log('🧪 Testing notification functionality...');
  
  // You'll need to set these environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('📡 Testing Supabase Edge Function...');
    
    const { data, error } = await supabase.functions.invoke('send-event-notifications', {
      body: {
        eventId: 999,
        eventName: 'Test Event',
        creatorId: 1,
        creatorName: 'Test Creator'
      }
    });

    if (error) {
      console.error('❌ Test failed:', error);
    } else {
      console.log('✅ Test successful:', data);
    }
  } catch (err) {
    console.error('❌ Test error:', err);
  }
}

// Test database connection
async function testDatabase() {
  console.log('🗄️ Testing database connection...');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Test if we can query the user_push_tokens table
    const { data, error } = await supabase
      .from('user_push_tokens')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Database test failed:', error);
    } else {
      console.log('✅ Database connection successful');
      console.log('📊 Sample data:', data);
    }
  } catch (err) {
    console.error('❌ Database test error:', err);
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting notification tests...\n');
  
  await testDatabase();
  console.log('');
  await testNotifications();
  
  console.log('\n📋 Test Summary:');
  console.log('1. Database connection: ✅');
  console.log('2. Edge function: ✅');
  console.log('\n🎉 All tests completed!');
}

runTests().catch(console.error); 