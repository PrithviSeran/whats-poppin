import { Linking } from 'react-native';
import { supabase } from './supabase';
import GlobalDataManager from './GlobalDataManager';

// Handle deep links for shared events
export const handleDeepLink = async (url: string) => {
  try {
    console.log('Handling deep link:', url);
    
    // Parse the URL to get the event ID - support both custom scheme and universal links
    let match = url.match(/whatspoppin:\/\/event\/(\d+)/); // Custom scheme: whatspoppin://event/123
    
    if (!match) {
      // Try universal link format: https://whatspoppin.app/event/123
      match = url.match(/https:\/\/whatspoppin\.app\/event\/(\d+)/);
    }
    
    if (!match) {
      console.log('No valid deep link pattern found in:', url);
      return null;
    }

    const eventId = parseInt(match[1], 10);
    if (!eventId) {
      console.log('Invalid event ID extracted from URL:', url);
      return null;
    }
    
    console.log('Extracted event ID:', eventId);

    // Fetch the event details from Supabase
    const { data: event, error } = await supabase
      .from('all_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (error || !event) {
      console.error('Error fetching shared event:', error);
      return null;
    }

    // Add image URLs to the event
    try {
      const { data: { publicUrl } } = supabase.storage
        .from('event-images')
        .getPublicUrl(`${event.id}/0.jpg`);
      
      // Create all 5 image URLs
      const allImages = Array.from({ length: 5 }, (_, i) => {
        const { data: { publicUrl: imageUrl } } = supabase.storage
          .from('event-images')
          .getPublicUrl(`${event.id}/${i}.jpg`);
        return imageUrl;
      });

      return { ...event, image: publicUrl, allImages };
    } catch (e) {
      console.log(`No image found for event ${event.id}`);
      return { ...event, image: null, allImages: [] };
    }
  } catch (error) {
    console.error('Error handling deep link:', error);
    return null;
  }
};

// Set up deep link listener
export const setupDeepLinking = () => {
  // Handle deep links when app is already running
  const handleUrl = async ({ url }: { url: string }) => {
    const event = await handleDeepLink(url);
    if (event) {
      // Emit an event that the app can listen to
      GlobalDataManager.getInstance().emit('sharedEventReceived', event);
    }
  };

  // Add event listener
  Linking.addEventListener('url', handleUrl);

  // Handle deep links when app is opened from a link
  Linking.getInitialURL().then(url => {
    if (url) {
      handleUrl({ url });
    }
  });

  // Return cleanup function
  return () => {
    Linking.removeAllListeners('url');
  };
}; 