const { supabase } = require('./supabase-node');

async function updateLocations() {
  try {
    // First, get all events
    const { data: events, error: fetchError } = await supabase
      .from('new_events')
      .select('id, name');

    if (fetchError) {
      console.error('Error fetching events:', fetchError);
      return;
    }

    console.log('Found', events.length, 'events to update');

    // Update each event with Toronto coordinates
    for (const event of events) {
      // Random latitude between 43.5 and 43.8 (Toronto's latitude range)
      const latitude = 43.5 + Math.random() * 0.3;
      // Random longitude between -79.6 and -79.2 (Toronto's longitude range)
      const longitude = -79.6 + Math.random() * 0.4;

      console.log(`Updating event ${event.id} (${event.name})...`);

      // Use a direct SQL update query
      const { error: updateError } = await supabase.rpc('update_event_coordinates', {
        event_id: event.id,
        new_latitude: latitude,
        new_longitude: longitude
      });

      if (updateError) {
        console.error(`Error updating event ${event.id}:`, updateError);
      } else {
        console.log(`Successfully updated event ${event.id} with coordinates:`, {
          latitude,
          longitude
        });
      }

      // Add a small delay between updates to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Verify the updates
    const { data: verifyData, error: verifyError } = await supabase
      .from('new_events')
      .select('id, name, latitude, longitude');

    if (verifyError) {
      console.error('Error verifying updates:', verifyError);
    } else {
      console.log('\nVerification of updates:');
      verifyData.forEach(event => {
        console.log(`Event ${event.id} (${event.name}):`, {
          latitude: event.latitude,
          longitude: event.longitude
        });
      });
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

updateLocations(); 