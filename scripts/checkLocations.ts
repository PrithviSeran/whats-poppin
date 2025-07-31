import { supabase } from './supabase-node';

async function checkLocations() {
  try {
    const { data: events, error } = await supabase
      .from('new_events')
      .select('id, name, location, latitude, longitude');

    if (error) {
      throw error;
    }

    console.log('Found', events.length, 'events');
    
    events.forEach(event => {
      console.log('\nEvent:', event.name);
      console.log('Location:', event.location);
      console.log('Latitude:', event.latitude);
      console.log('Longitude:', event.longitude);
    });

  } catch (error) {
    console.error('Error checking locations:', error);
  }
}

checkLocations(); 