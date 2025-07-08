import { Linking } from 'react-native';
import GlobalDataManager from './GlobalDataManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Handle deep links for shared events and password reset
export const handleDeepLink = async (url: string) => {
  try {
    console.log('🔗 Handling deep link:', url);
    
    // Check if this is a password reset link
    if (url.includes('reset-password')) {
      console.log('🔑 Password reset link detected');
      
      // The email is already saved in AsyncStorage from ForgotPasswordScreen
      // Just navigate to the reset password screen
      console.log('✅ Password reset link handled - email should be in AsyncStorage');
      
      return {
        type: 'password-reset',
        success: true,
        message: 'Password reset link handled successfully'
      };
    }
    
    // Check if this is an event sharing link
    if (url.includes('/event/')) {
      console.log('🎉 Event sharing link detected');
      
      // Extract event ID from URL
      const eventIdMatch = url.match(/\/event\/(\d+)/);
      if (eventIdMatch) {
        const eventId = eventIdMatch[1];
        console.log('📋 Event ID extracted:', eventId);

        // Store the event ID for the app to handle
        try {
          await AsyncStorage.setItem('sharedEventId', eventId);
          console.log('✅ Event ID stored in AsyncStorage');
        } catch (error) {
          console.error('❌ Error storing event ID:', error);
        }
        
        return {
          type: 'event-share',
          success: true,
          eventId: eventId,
          message: 'Event sharing link handled successfully'
        };
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

// Set up deep link listener
export const setupDeepLinking = () => {
  console.log('🔗 Setting up deep linking...');
  
  // Handle deep links when app is already running
  const handleUrl = async ({ url }: { url: string }) => {
    console.log('🔗 Deep link received:', url);
    
    const result = await handleDeepLink(url);
    
    if (result) {
      if (result.type === 'password-reset') {
        // Handle password reset result
        if (result.success) {
          console.log('✅ Password reset link handled, user can now reset password');
          // The ResetPasswordScreen will handle the actual password reset
        } else {
          console.error('❌ Password reset failed:', result.error);
        }
      } else if (result.type === 'event-share') {
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