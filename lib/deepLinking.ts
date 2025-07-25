import { Linking } from 'react-native';
import GlobalDataManager from './GlobalDataManager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { CommonActions } from '@react-navigation/native';

// Handle deep links for shared events
export const handleDeepLink = async (url: string, navigation?: any) => {
  try {
    console.log('🔗 Handling deep link:', url);
    
    // Check if this is an event sharing link
    if (url.includes('/event/')) {
      console.log('🎉 Event sharing link detected');
      
      // Extract event ID from URL
      const eventIdMatch = url.match(/\/event\/(\d+)/);
      if (eventIdMatch) {
        const eventId = eventIdMatch[1];
        console.log('📋 Event ID extracted:', eventId);

        // Check if user is logged in
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          // Not logged in: store eventId and navigate to SignInScreen
          try {
            await AsyncStorage.setItem('pendingEventId', eventId);
            console.log('✅ Pending event ID stored in AsyncStorage');
          } catch (error) {
            console.error('❌ Error storing pending event ID:', error);
          }
          if (navigation) {
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'social-sign-in' }],
              })
            );
          }
          return {
            type: 'event-share',
            success: true,
            eventId,
            message: 'User not logged in, redirected to SignInScreen',
            pending: true
          };
        } else {
          // Logged in: navigate to event detail
          if (navigation) {
            navigation.navigate('event/[id]', { id: eventId });
          }
          return {
            type: 'event-share',
            success: true,
            eventId,
            message: 'Navigated to event detail',
            pending: false
          };
        }
      } else {
        console.error('❌ Could not extract event ID from URL');
        return {
          type: 'event-share',
          success: false,
          error: 'Invalid event sharing link'
        };
      }
    }
    
    console.log('⚠️ Unknown deep link format:', url);
    return {
      type: 'unknown',
      success: false,
      error: 'Unknown deep link format'
    };
    
  } catch (error) {
    console.error('❌ Error handling deep link:', error);
    return {
      type: 'error',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Helper to check for pending event after login
export const checkPendingEventAfterLogin = async (navigation: any) => {
  const eventId = await AsyncStorage.getItem('pendingEventId');
  if (eventId) {
    await AsyncStorage.removeItem('pendingEventId');
    navigation.navigate('event/[id]', { id: eventId });
    return true;
  }
  return false;
};

// Set up deep link listener
export const setupDeepLinking = () => {
  console.log('🔗 Setting up deep linking...');
  
  // Handle deep links when app is already running
  const handleUrl = async ({ url }: { url: string }) => {
    console.log('🔗 Deep link received:', url);
    
    const result = await handleDeepLink(url);
    
    if (result) {
      if (result.type === 'event-share') {
        // Handle event sharing result
        if (result.success && result.eventId) {
          console.log('📅 Event sharing link handled, event ID:', result.eventId);
          // The app can now use the event ID stored in AsyncStorage
        } else {
          console.error('❌ Event sharing failed:', result.error);
        }
      } else {
        console.log('⚠️ Unknown deep link result type:', result.type);
      }
    } else {
      console.log('⚠️ No result from deep link handler for URL:', url);
    }
  };

  // Add event listener
  Linking.addEventListener('url', handleUrl);
  console.log('✅ Deep link event listener added');

  // Handle deep links when app is opened from a link
  Linking.getInitialURL().then(url => {
    if (url) {
      console.log('🔗 Initial URL found:', url);
      handleUrl({ url });
    } else {
      console.log('🔗 No initial URL found');
    }
  }).catch(error => {
    console.error('❌ Error getting initial URL:', error);
  });

  // Return cleanup function
  return () => {
    console.log('🧹 Cleaning up deep linking...');
    Linking.removeAllListeners('url');
  };
}; 