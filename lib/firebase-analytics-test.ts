// Test Firebase Analytics Implementation
// This version logs all events to console for testing without requiring Firebase setup

import { Platform } from 'react-native';

// Analytics event types
export enum AnalyticsEvent {
  // Screen tracking
  SCREEN_VIEW = 'screen_view',
  
  // User actions
  USER_SIGN_UP = 'user_sign_up',
  USER_SIGN_IN = 'user_sign_in',
  USER_SIGN_OUT = 'user_sign_out',
  
  // Event interactions
  EVENT_SAVE = 'event_save',
  EVENT_UNSAVE = 'event_unsave',
  EVENT_REJECT = 'event_reject',
  EVENT_VIEW = 'event_view',
  EVENT_SHARE = 'event_share',
  
  // Swipe actions
  SWIPE_RIGHT = 'swipe_right',
  SWIPE_LEFT = 'swipe_left',
  
  // Profile actions
  PROFILE_UPDATE = 'profile_update',
  PROFILE_IMAGE_UPDATE = 'profile_image_update',
  
  // Search and filters
  SEARCH_PERFORMED = 'search_performed',
  FILTER_APPLIED = 'filter_applied',
  
  // Navigation
  TAB_SWITCH = 'tab_switch',
  DEEP_LINK_OPENED = 'deep_link_opened',
  
  // App lifecycle
  APP_OPEN = 'app_open',
  APP_CLOSE = 'app_close',
  
  // Error tracking
  ERROR_OCCURRED = 'error_occurred',
  
  // Custom events
  CREATE_EVENT = 'create_event',
  FRIEND_ADD = 'friend_add',
  FRIEND_REMOVE = 'friend_remove',
  NOTIFICATION_RECEIVED = 'notification_received',
  NOTIFICATION_OPENED = 'notification_opened',
}

// User properties
export enum UserProperty {
  USER_ID = 'user_id',
  USER_EMAIL = 'user_email',
  USER_GENDER = 'user_gender',
  USER_BIRTHDAY = 'user_birthday',
  USER_LOCATION = 'user_location',
  PREFERRED_EVENT_TYPES = 'preferred_event_types',
  TRAVEL_DISTANCE = 'travel_distance',
  FRIENDS_COUNT = 'friends_count',
  SAVED_EVENTS_COUNT = 'saved_events_count',
}

// Screen names for tracking
export enum ScreenName {
  HOME = 'Home',
  EXPLORE = 'Explore',
  PROFILE = 'Profile',
  CREATE_ACCOUNT = 'CreateAccount',
  SIGN_IN = 'SignIn',
  CREATE_EVENT = 'CreateEvent',
  EDIT_PROFILE = 'EditProfile',
  EDIT_IMAGES = 'EditImages',
  EVENT_DETAIL = 'EventDetail',
  SAVED_EVENTS = 'SavedEvents',
  REJECTED_EVENTS = 'RejectedEvents',
  FRIENDS = 'Friends',
  NOTIFICATION_SETTINGS = 'NotificationSettings',
  FORGOT_PASSWORD = 'ForgotPassword',
  RESET_PASSWORD = 'ResetPassword',
  SOCIAL_SIGN_IN = 'SocialSignIn',
}

class TestFirebaseAnalyticsService {
  private isInitialized = false;
  private userProperties: Map<string, any> = new Map();
  private userId: string | null = null;

  // Initialize analytics
  async initialize() {
    try {
      if (this.isInitialized) return;
      
      console.log('🧪 TEST MODE: Firebase Analytics initialized (console logging)');
      console.log('📊 Analytics events will be logged to console for testing');
      
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Test Analytics initialization failed:', error);
    }
  }

  // Track screen views
  async trackScreenView(screenName: string, screenClass?: string) {
    try {
      const eventData = {
        screen_name: screenName,
        screen_class: screenClass || screenName,
        timestamp: new Date().toISOString(),
      };
      
      console.log('📊 [TEST] Screen tracked:', eventData);
    } catch (error) {
      console.error('❌ Test screen tracking failed:', error);
    }
  }

  // Track custom events
  async trackEvent(eventName: string, parameters?: Record<string, any>) {
    try {
      const eventData = {
        event_name: eventName,
        parameters: parameters || {},
        timestamp: new Date().toISOString(),
        user_id: this.userId,
        platform: Platform.OS,
      };
      
      console.log('📊 [TEST] Event tracked:', eventData);
    } catch (error) {
      console.error('❌ Test event tracking failed:', error);
    }
  }

  // Set user properties
  async setUserProperty(property: string, value: string | number | boolean) {
    try {
      this.userProperties.set(property, value);
      console.log('👤 [TEST] User property set:', { property, value });
    } catch (error) {
      console.error('❌ Test user property setting failed:', error);
    }
  }

  // Set user ID
  async setUserId(userId: string) {
    try {
      this.userId = userId;
      console.log('👤 [TEST] User ID set:', userId);
    } catch (error) {
      console.error('❌ Test user ID setting failed:', error);
    }
  }

  // Track user sign up
  async trackUserSignUp(method: string, userId?: string) {
    try {
      const eventData = {
        method,
        user_id: userId,
        timestamp: new Date().toISOString(),
      };
      
      console.log('📊 [TEST] User sign up tracked:', eventData);
      if (userId) {
        await this.setUserId(userId);
      }
    } catch (error) {
      console.error('❌ Test sign up tracking failed:', error);
    }
  }

  // Track user sign in
  async trackUserSignIn(method: string, userId?: string) {
    try {
      const eventData = {
        method,
        user_id: userId,
        timestamp: new Date().toISOString(),
      };
      
      console.log('📊 [TEST] User sign in tracked:', eventData);
      if (userId) {
        await this.setUserId(userId);
      }
    } catch (error) {
      console.error('❌ Test sign in tracking failed:', error);
    }
  }

  // Track event interactions
  async trackEventInteraction(
    eventId: number,
    eventTitle: string,
    action: 'save' | 'unsave' | 'reject' | 'view' | 'share',
    additionalParams?: Record<string, any>
  ) {
    try {
      const eventName = action === 'save' ? AnalyticsEvent.EVENT_SAVE :
                       action === 'unsave' ? AnalyticsEvent.EVENT_UNSAVE :
                       action === 'reject' ? AnalyticsEvent.EVENT_REJECT :
                       action === 'view' ? AnalyticsEvent.EVENT_VIEW :
                       AnalyticsEvent.EVENT_SHARE;

      const eventData = {
        event_id: eventId,
        event_title: eventTitle,
        action,
        ...additionalParams,
        timestamp: new Date().toISOString(),
      };
      
      console.log('📊 [TEST] Event interaction tracked:', eventData);
    } catch (error) {
      console.error('❌ Test event interaction tracking failed:', error);
    }
  }

  // Track swipe actions
  async trackSwipeAction(direction: 'left' | 'right', eventId: number, eventTitle: string) {
    try {
      const eventName = direction === 'right' ? AnalyticsEvent.SWIPE_RIGHT : AnalyticsEvent.SWIPE_LEFT;
      
      const eventData = {
        event_id: eventId,
        event_title: eventTitle,
        swipe_direction: direction,
        timestamp: new Date().toISOString(),
      };
      
      console.log('📊 [TEST] Swipe action tracked:', eventData);
    } catch (error) {
      console.error('❌ Test swipe tracking failed:', error);
    }
  }

  // Track tab switches
  async trackTabSwitch(tabName: string) {
    try {
      const eventData = {
        tab_name: tabName,
        timestamp: new Date().toISOString(),
      };
      
      console.log('📊 [TEST] Tab switch tracked:', eventData);
    } catch (error) {
      console.error('❌ Test tab switch tracking failed:', error);
    }
  }

  // Track search actions
  async trackSearch(query: string, resultsCount?: number) {
    try {
      const eventData = {
        search_term: query,
        results_count: resultsCount,
        timestamp: new Date().toISOString(),
      };
      
      console.log('📊 [TEST] Search tracked:', eventData);
    } catch (error) {
      console.error('❌ Test search tracking failed:', error);
    }
  }

  // Track filter applications
  async trackFilterApplied(filterType: string, filterValue: string) {
    try {
      const eventData = {
        filter_type: filterType,
        filter_value: filterValue,
        timestamp: new Date().toISOString(),
      };
      
      console.log('📊 [TEST] Filter tracked:', eventData);
    } catch (error) {
      console.error('❌ Test filter tracking failed:', error);
    }
  }

  // Track errors
  async trackError(errorMessage: string, errorCode?: string, screenName?: string) {
    try {
      const eventData = {
        error_message: errorMessage,
        error_code: errorCode,
        screen_name: screenName,
        timestamp: new Date().toISOString(),
      };
      
      console.log('❌ [TEST] Error tracked:', eventData);
    } catch (error) {
      console.error('❌ Test error tracking failed:', error);
    }
  }

  // Track app lifecycle
  async trackAppOpen() {
    try {
      const eventData = {
        timestamp: new Date().toISOString(),
      };
      
      console.log('📊 [TEST] App open tracked:', eventData);
    } catch (error) {
      console.error('❌ Test app open tracking failed:', error);
    }
  }

  // Set user profile properties
  async setUserProfile(userProfile: {
    userId: string;
    email: string;
    gender?: string;
    birthday?: string;
    location?: string;
    preferredEventTypes?: string[];
    travelDistance?: number;
    friendsCount?: number;
    savedEventsCount?: number;
  }) {
    try {
      await this.setUserId(userProfile.userId);
      await this.setUserProperty(UserProperty.USER_EMAIL, userProfile.email);
      
      if (userProfile.gender) {
        await this.setUserProperty(UserProperty.USER_GENDER, userProfile.gender);
      }
      if (userProfile.birthday) {
        await this.setUserProperty(UserProperty.USER_BIRTHDAY, userProfile.birthday);
      }
      if (userProfile.location) {
        await this.setUserProperty(UserProperty.USER_LOCATION, userProfile.location);
      }
      if (userProfile.preferredEventTypes) {
        await this.setUserProperty(UserProperty.PREFERRED_EVENT_TYPES, userProfile.preferredEventTypes.join(','));
      }
      if (userProfile.travelDistance) {
        await this.setUserProperty(UserProperty.TRAVEL_DISTANCE, userProfile.travelDistance);
      }
      if (userProfile.friendsCount) {
        await this.setUserProperty(UserProperty.FRIENDS_COUNT, userProfile.friendsCount);
      }
      if (userProfile.savedEventsCount) {
        await this.setUserProperty(UserProperty.SAVED_EVENTS_COUNT, userProfile.savedEventsCount);
      }
      
      console.log('👤 [TEST] User profile set:', userProfile);
    } catch (error) {
      console.error('❌ Test user profile setting failed:', error);
    }
  }

  // Clear user data (for sign out)
  async clearUserData() {
    try {
      this.userId = null;
      this.userProperties.clear();
      console.log('🧹 [TEST] User analytics data cleared');
    } catch (error) {
      console.error('❌ Test user data clearing failed:', error);
    }
  }

  // Get analytics summary
  getAnalyticsSummary() {
    return {
      isInitialized: this.isInitialized,
      userId: this.userId,
      userProperties: Object.fromEntries(this.userProperties),
      platform: Platform.OS,
      timestamp: new Date().toISOString(),
    };
  }
}

// Export singleton instance
export const testFirebaseAnalytics = new TestFirebaseAnalyticsService();

// Export convenience functions
export const trackScreen = (screenName: string) => testFirebaseAnalytics.trackScreenView(screenName);
export const trackEvent = (eventName: string, parameters?: Record<string, any>) => testFirebaseAnalytics.trackEvent(eventName, parameters);
export const setUserProperty = (property: string, value: string | number | boolean) => testFirebaseAnalytics.setUserProperty(property, value);
export const setUserId = (userId: string) => testFirebaseAnalytics.setUserId(userId); 