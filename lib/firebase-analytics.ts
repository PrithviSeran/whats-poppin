import { getAnalytics, logEvent, setUserId, setUserProperty, setDefaultEventParameters } from 'expo-firebase-analytics';
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

class FirebaseAnalyticsService {
  private isInitialized = false;
  private analytics: any = null;

  // Initialize analytics
  async initialize() {
    try {
      if (this.isInitialized) return;
      
      // Get analytics instance
      this.analytics = getAnalytics();
      
      // Set default event parameters
      await setDefaultEventParameters({
        app_version: '1.5.0',
        platform: Platform.OS,
      });
      
      this.isInitialized = true;
      console.log('✅ Firebase Analytics initialized successfully');
    } catch (error) {
      console.error('❌ Firebase Analytics initialization failed:', error);
    }
  }

  // Track screen views
  async trackScreenView(screenName: string, screenClass?: string) {
    try {
      await logEvent('screen_view', {
        screen_name: screenName,
        screen_class: screenClass || screenName,
      });
      console.log(`📊 Screen tracked: ${screenName}`);
    } catch (error) {
      console.error('❌ Screen tracking failed:', error);
    }
  }

  // Track custom events
  async trackEvent(eventName: string, parameters?: Record<string, any>) {
    try {
      await logEvent(eventName, parameters);
      console.log(`📊 Event tracked: ${eventName}`, parameters);
    } catch (error) {
      console.error('❌ Event tracking failed:', error);
    }
  }

  // Set user properties
  async setUserProperty(property: string, value: string | number | boolean) {
    try {
      await setUserProperty(property, String(value));
      console.log(`👤 User property set: ${property} = ${value}`);
    } catch (error) {
      console.error('❌ User property setting failed:', error);
    }
  }

  // Set user ID
  async setUserId(userId: string) {
    try {
      await setUserId(userId);
      console.log(`👤 User ID set: ${userId}`);
    } catch (error) {
      console.error('❌ User ID setting failed:', error);
    }
  }

  // Track user sign up
  async trackUserSignUp(method: string, userId?: string) {
    try {
      await logEvent(AnalyticsEvent.USER_SIGN_UP, {
        method,
        user_id: userId,
      });
      if (userId) {
        await this.setUserId(userId);
      }
    } catch (error) {
      console.error('❌ Sign up tracking failed:', error);
    }
  }

  // Track user sign in
  async trackUserSignIn(method: string, userId?: string) {
    try {
      await logEvent(AnalyticsEvent.USER_SIGN_IN, {
        method,
        user_id: userId,
      });
      if (userId) {
        await this.setUserId(userId);
      }
    } catch (error) {
      console.error('❌ Sign in tracking failed:', error);
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

      await logEvent(eventName, {
        event_id: eventId,
        event_title: eventTitle,
        ...additionalParams,
      });
    } catch (error) {
      console.error('❌ Event interaction tracking failed:', error);
    }
  }

  // Track swipe actions
  async trackSwipeAction(direction: 'left' | 'right', eventId: number, eventTitle: string) {
    try {
      const eventName = direction === 'right' ? AnalyticsEvent.SWIPE_RIGHT : AnalyticsEvent.SWIPE_LEFT;
      
      await logEvent(eventName, {
        event_id: eventId,
        event_title: eventTitle,
        swipe_direction: direction,
      });
    } catch (error) {
      console.error('❌ Swipe tracking failed:', error);
    }
  }

  // Track tab switches
  async trackTabSwitch(tabName: string) {
    try {
      await logEvent(AnalyticsEvent.TAB_SWITCH, {
        tab_name: tabName,
      });
    } catch (error) {
      console.error('❌ Tab switch tracking failed:', error);
    }
  }

  // Track search actions
  async trackSearch(query: string, resultsCount?: number) {
    try {
      await logEvent(AnalyticsEvent.SEARCH_PERFORMED, {
        search_term: query,
        results_count: resultsCount,
      });
    } catch (error) {
      console.error('❌ Search tracking failed:', error);
    }
  }

  // Track filter applications
  async trackFilterApplied(filterType: string, filterValue: string) {
    try {
      await logEvent(AnalyticsEvent.FILTER_APPLIED, {
        filter_type: filterType,
        filter_value: filterValue,
      });
    } catch (error) {
      console.error('❌ Filter tracking failed:', error);
    }
  }

  // Track errors
  async trackError(errorMessage: string, errorCode?: string, screenName?: string) {
    try {
      await logEvent(AnalyticsEvent.ERROR_OCCURRED, {
        error_message: errorMessage,
        error_code: errorCode,
        screen_name: screenName,
      });
    } catch (error) {
      console.error('❌ Error tracking failed:', error);
    }
  }

  // Track app lifecycle
  async trackAppOpen() {
    try {
      await logEvent(AnalyticsEvent.APP_OPEN);
    } catch (error) {
      console.error('❌ App open tracking failed:', error);
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
    } catch (error) {
      console.error('❌ User profile setting failed:', error);
    }
  }

  // Clear user data (for sign out)
  async clearUserData() {
    try {
      await setUserId(null);
      console.log('🧹 User analytics data cleared');
    } catch (error) {
      console.error('❌ User data clearing failed:', error);
    }
  }
}

// Export singleton instance
export const firebaseAnalytics = new FirebaseAnalyticsService();

// Export convenience functions
export const trackScreen = (screenName: string) => firebaseAnalytics.trackScreenView(screenName);
export const trackEvent = (eventName: string, parameters?: Record<string, any>) => firebaseAnalytics.trackEvent(eventName, parameters);
export const setUserProperty = (property: string, value: string | number | boolean) => firebaseAnalytics.setUserProperty(property, value);
export const setUserId = (userId: string) => firebaseAnalytics.setUserId(userId); 