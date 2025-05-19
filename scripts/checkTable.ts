const { supabase } = require('./supabase-node');

async function checkTable() {
  try {
    // First, let's check if we can read the table structure
    const { data: tableInfo, error: tableError } = await supabase
      .from('all_events')
      .select('*')
      .limit(1);

    if (tableError) {
      console.error('Error accessing table:', tableError);
      return;
    }

    console.log('Table structure:', Object.keys(tableInfo[0]));

    // Now let's try to update a single record
    const testUpdate = {
      latitude: 43.6532,
      longitude: -79.3832
    };

    const { data: updateData, error: updateError } = await supabase
      .from('all_events')
      .update(testUpdate)
      .eq('id', 1)
      .select();

    if (updateError) {
      console.error('Error updating record:', updateError);
    } else {
      console.log('Update result:', updateData);
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkTable(); 