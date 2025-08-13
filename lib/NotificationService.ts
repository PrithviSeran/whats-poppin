import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationData {
  id: string;
  title: string;
  body: string;
  data?: any;
  trigger?: Notifications.NotificationTriggerInput;
}

export interface NotificationSettings {
  enabled: boolean;
  friendRequests: boolean;
  eventReminders: boolean;
  newFollowers: boolean;
  newEventsFromFollowing: boolean;
  marketing: boolean;
  weekendReminders: boolean;
}

class NotificationService {
  private static instance: NotificationService;
  private expoPushToken: string | null = null;
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Initialize the notification service
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔔 Initializing notification service...');
      
      // Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.log('❌ Notification permissions not granted');
        return;
      }

      // Get push token
      await this.getPushToken();

      // Set up notification listeners
      this.setupNotificationListeners();

      // Schedule weekend notifications
      await this.scheduleRecurringWeekendNotifications();

      // Debug: Check what notifications were scheduled
      await this.debugScheduledNotifications();

      console.log('✅ Notification service initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing notification service:', error);
    }
  }

  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          console.log('❌ Notification permissions not granted');
          return false;
        }

        // Configure notification channel for Android
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF0005',
          });
        }

        console.log('✅ Notification permissions granted');
        return true;
      } else {
        console.log('⚠️ Not running on a physical device, skipping permissions');
        return false;
      }
    } catch (error) {
      console.error('❌ Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Get push token for the device
   */
  async getPushToken(): Promise<string | null> {
    try {
      if (!Device.isDevice) {
        console.log('⚠️ Not running on a physical device, cannot get push token');
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync({
        projectId: 'd313f76f-429c-4ab7-9a2a-3557cc200f40', // Your EAS project ID
      });

      this.expoPushToken = token.data;
      console.log('📱 Push token:', this.expoPushToken);

      // Save token to AsyncStorage
      if (this.expoPushToken) {
        await AsyncStorage.setItem('expoPushToken', this.expoPushToken);

        // Save token to Supabase if user is logged in
        await this.saveTokenToDatabase(this.expoPushToken);
      }

      return this.expoPushToken;
    } catch (error) {
      console.error('❌ Error getting push token:', error);
      return null;
    }
  }

  /**
   * Save push token to database
   */
  async saveTokenToDatabase(token: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('⚠️ No authenticated user, skipping token save');
        return;
      }

      // Check if user has notification settings enabled
      const settings = await this.getNotificationSettings();
      if (!settings.enabled) {
        console.log('⚠️ Notifications disabled for user, skipping token save');
        return;
      }

      // Get user's profile from all_users table to get their ID
      const { data: userProfile, error: profileError } = await supabase
        .from('all_users')
        .select('id')
        .eq('email', user.email)
        .single();

      if (profileError || !userProfile) {
        console.error('❌ Error getting user profile:', profileError);
        return;
      }

      // Check if this user already has a token for this platform
      const { data: existingToken, error: checkError } = await supabase
        .from('user_push_tokens')
        .select('id, push_token')
        .eq('user_id', user.id)
        .eq('platform', Platform.OS)
        .eq('is_active', true)
        .single();

      if (checkError) {
        if (checkError.code === 'PGRST116' || checkError.message.includes('No rows found')) {
          // No existing token found - this is expected for new users
          console.log('ℹ️ No existing token found for user, will create new one');
        } else {
          // Actual error occurred
          console.error('❌ Error checking existing token:', checkError);
          return;
        }
      }

      if (existingToken && existingToken.push_token === token) {
        console.log('✅ Push token already exists and is current');
        return;
      }

      // Deactivate any existing tokens for this user and platform
      if (existingToken) {
        console.log('🔄 Deactivating existing token for user...');
        const { error: deactivateError } = await supabase
          .from('user_push_tokens')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('platform', Platform.OS);

        if (deactivateError) {
          console.warn('⚠️ Error deactivating old token:', deactivateError);
        } else {
          console.log('✅ Existing token deactivated successfully');
        }
      } else {
        console.log('🆕 No existing token found, proceeding with new token creation');
      }

      // Insert new token
      const { error: insertError } = await supabase
        .from('user_push_tokens')
        .insert({
          user_id: user.id,
          email: user.email,
          push_token: token,
          platform: Platform.OS,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('❌ Error saving push token to database:', insertError);
      } else {
        console.log('✅ Push token saved to database for user:', user.email);
      }
    } catch (error) {
      console.error('❌ Error saving push token:', error);
    }
  }

  /**
   * Set up notification listeners
   */
  setupNotificationListeners(): void {
    // Listen for incoming notifications
    this.notificationListener = Notifications.addNotificationReceivedListener((notification: Notifications.Notification) => {
      console.log('📨 Notification received:', notification);
      this.handleNotificationReceived(notification);
    });

    // Listen for notification responses (when user taps notification)
    this.responseListener = Notifications.addNotificationResponseReceivedListener((response: Notifications.NotificationResponse) => {
      console.log('👆 Notification response:', response);
      this.handleNotificationResponse(response);
    });
  }

  /**
   * Handle incoming notifications
   */
  handleNotificationReceived(notification: Notifications.Notification): void {
    // You can add custom logic here for when notifications are received
    // For example, updating UI, playing sounds, etc.
    console.log('📨 Handling received notification:', notification.request.content);
  }

  /**
   * Handle notification responses (user taps notification)
   */
  handleNotificationResponse(response: Notifications.NotificationResponse): void {
    const data = response?.notification?.request?.content?.data;
    console.log('👆 Handling notification response:', data);

    // Handle different types of notifications
    if (data?.type === 'friend_request') {
      // Navigate to friends modal
      this.navigateToFriendsModal();
    } else if (data?.type === 'event_reminder') {
      // Navigate to specific event
      this.navigateToEvent(data.eventId as string);
    } else if (data?.type === 'new_event') {
      // Navigate to events list
      this.navigateToEvents();
    } else if (data?.type === 'new_follower') {
      // Navigate to friends modal (followers tab)
      this.navigateToFriendsModal();
    } else if (data?.type === 'new_event_following') {
      // Navigate to events list
      this.navigateToEvents();
    }
  }

  /**
   * Schedule a local notification
   */
  async scheduleNotification(notification: NotificationData): Promise<string> {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          sound: 'default',
          badge: 1,
        },
        trigger: notification.trigger || null,
      } as any);

      console.log('✅ Notification scheduled:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('❌ Error scheduling notification:', error);
      throw error;
    }
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log('✅ Notification cancelled:', notificationId);
    } catch (error) {
      console.error('❌ Error cancelling notification:', error);
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('✅ All notifications cancelled');
    } catch (error) {
      console.error('❌ Error cancelling all notifications:', error);
    }
  }

  /**
   * Get notification settings
   */
  async getNotificationSettings(): Promise<NotificationSettings> {
    try {
      const settings = await AsyncStorage.getItem('notificationSettings');
      if (settings) {
        return JSON.parse(settings);
      }
      
      // Default settings
      const defaultSettings: NotificationSettings = {
        enabled: true,
        friendRequests: true,
        eventReminders: true,
        newFollowers: true,
        newEventsFromFollowing: true,
        marketing: false,
        weekendReminders: true,
      };

      await this.saveNotificationSettings(defaultSettings);
      return defaultSettings;
    } catch (error) {
      console.error('❌ Error getting notification settings:', error);
      return {
        enabled: true,
        friendRequests: true,
        eventReminders: true,
        newFollowers: true,
        newEventsFromFollowing: true,
        marketing: false,
        weekendReminders: true,
      };
    }
  }

  /**
   * Save notification settings
   */
  async saveNotificationSettings(settings: NotificationSettings): Promise<void> {
    try {
      await AsyncStorage.setItem('notificationSettings', JSON.stringify(settings));
      console.log('✅ Notification settings saved');
    } catch (error) {
      console.error('❌ Error saving notification settings:', error);
    }
  }

  /**
   * Schedule event reminder notification (1 hour before)
   */
  async scheduleEventReminder(eventId: string, eventName: string, eventTime: Date): Promise<string> {
    const reminderTime = new Date(eventTime.getTime() - 60 * 60 * 1000); // 1 hour before
    
    if (reminderTime <= new Date()) {
      console.log('⚠️ Event reminder time has passed');
      return '';
    }

    return await this.scheduleNotification({
      id: `event_reminder_${eventId}`,
      title: 'Event Reminder',
      body: `Your event "${eventName}" starts in 1 hour!`,
      data: {
        type: 'event_reminder',
        eventId: eventId,
      },
      trigger: {
        type: 'date',
        date: reminderTime,
      } as any,
    });
  }

  /**
   * Schedule event reminder notification 1 day before
   */
  async scheduleEventReminderOneDayBefore(eventId: string, eventName: string, eventTime: Date): Promise<string> {
    const reminderTime = new Date(eventTime.getTime() - 24 * 60 * 60 * 1000); // 1 day before
    
    if (reminderTime <= new Date()) {
      console.log('⚠️ 1-day event reminder time has passed');
      return '';
    }

    return await this.scheduleNotification({
      id: `event_reminder_1day_${eventId}`,
      title: 'Event Tomorrow! 🎈',
      body: `Don't forget! "${eventName}" is happening tomorrow!`,
      data: {
        type: 'event_reminder_1day',
        eventId: eventId,
      },
      trigger: {
        type: 'date',
        date: reminderTime,
      } as any,
    });
  }

  /**
   * Schedule multiple event reminders (1 day and 1 hour before)
   */
  async scheduleEventReminders(eventId: string, eventName: string, eventTime: Date): Promise<{
    oneDayReminder: string;
    oneHourReminder: string;
  }> {
    try {
      console.log(`📅 Scheduling reminders for event: ${eventName} at ${eventTime}`);
      
      const oneDayReminder = await this.scheduleEventReminderOneDayBefore(eventId, eventName, eventTime);
      const oneHourReminder = await this.scheduleEventReminder(eventId, eventName, eventTime);
      
      console.log(`✅ Event reminders scheduled - 1 day: ${oneDayReminder ? 'Yes' : 'No'}, 1 hour: ${oneHourReminder ? 'Yes' : 'No'}`);
      
      return {
        oneDayReminder,
        oneHourReminder,
      };
    } catch (error) {
      console.error('❌ Error scheduling event reminders:', error);
      return {
        oneDayReminder: '',
        oneHourReminder: '',
      };
    }
  }

  /**
   * Cancel all reminders for a specific event
   */
  async cancelEventReminders(eventId: string): Promise<void> {
    try {
      await this.cancelNotification(`event_reminder_${eventId}`);
      await this.cancelNotification(`event_reminder_1day_${eventId}`);
      console.log(`✅ Cancelled all reminders for event: ${eventId}`);
    } catch (error) {
      console.error('❌ Error cancelling event reminders:', error);
    }
  }

  /**
   * Schedule friend request notification
   */
  async scheduleFriendRequestNotification(senderName: string): Promise<string> {
    return await this.scheduleNotification({
      id: `friend_request_${Date.now()}`,
      title: 'New Friend Request',
      body: `${senderName} sent you a friend request`,
      data: {
        type: 'friend_request',
        senderName: senderName,
      },
      trigger: null, // Show immediately
    });
  }

  /**
   * Schedule new follower notification
   */
  async scheduleNewFollowerNotification(followerName: string): Promise<string> {
    return await this.scheduleNotification({
      id: `new_follower_${Date.now()}`,
      title: 'New Follower! 🎉',
      body: `${followerName} started following you`,
      data: {
        type: 'new_follower',
        followerName: followerName,
      },
      trigger: null, // Show immediately
    });
  }

  /**
   * Schedule new event from following notification
   */
  async scheduleNewEventFromFollowingNotification(eventName: string, creatorName: string): Promise<string> {
    return await this.scheduleNotification({
      id: `new_event_following_${Date.now()}`,
      title: 'New Event from Someone You Follow! 🎈',
      body: `${creatorName} created "${eventName}"`,
      data: {
        type: 'new_event_following',
        eventName: eventName,
        creatorName: creatorName,
      },
      trigger: null, // Show immediately
    });
  }



  /**
   * Get badge count
   */
  async getBadgeCount(): Promise<number> {
    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      console.error('❌ Error getting badge count:', error);
      return 0;
    }
  }

  /**
   * Set badge count
   */
  async setBadgeCount(count: number): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('❌ Error setting badge count:', error);
    }
  }

  /**
   * Clear badge count
   */
  async clearBadgeCount(): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(0);
    } catch (error) {
      console.error('❌ Error clearing badge count:', error);
    }
  }

  /**
   * Navigation helpers (to be implemented based on your navigation setup)
   */
  private navigateToFriendsModal(): void {
    // Implement navigation to friends modal
    console.log('🔄 Navigating to friends modal');
  }

  private navigateToEvent(eventId: string): void {
    // Implement navigation to specific event
    console.log('🔄 Navigating to event:', eventId);
  }

  private navigateToEvents(): void {
    // Implement navigation to events list
    console.log('🔄 Navigating to events list');
  }

  /**
   * Cleanup listeners and deactivate push token
   */
  async cleanup(): Promise<void> {
    try {
      // Remove notification listeners
      if (this.notificationListener) {
        Notifications.removeNotificationSubscription(this.notificationListener);
      }
      if (this.responseListener) {
        Notifications.removeNotificationSubscription(this.responseListener);
      }

      // Deactivate current user's push token
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('🔔 User signing out, deactivating push token...');
        
        const { error: deactivateError } = await supabase
          .from('user_push_tokens')
          .update({ 
            is_active: false, 
            updated_at: new Date().toISOString() 
          })
          .eq('user_id', user.id)
          .eq('platform', Platform.OS);

        if (deactivateError) {
          console.warn('⚠️ Error deactivating push token on sign-out:', deactivateError);
        } else {
          console.log('✅ Push token deactivated on sign-out');
        }
      }

      // Clear local token reference
      this.expoPushToken = null;
      
    } catch (error) {
      console.error('❌ Error in cleanup:', error);
    }
  }

  /**
   * Get current push token
   */
  getCurrentPushToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * Handle user login - reinitialize notification service for new user
   */
  async handleUserLogin(): Promise<void> {
    try {
      console.log('🔔 User logged in, reinitializing notification service...');
      
      // Clear any existing tokens
      this.expoPushToken = null;
      
      // Reinitialize the service for the new user
      await this.initialize();
      
      console.log('✅ Notification service reinitialized for new user');
    } catch (error) {
      console.error('❌ Error reinitializing notification service:', error);
    }
  }

  

  /**
   * Schedule weekend reminder notifications
   */
  async scheduleWeekendReminderNotification(): Promise<string> {
    const creativeMessages = [
      "🎉 Weekend vibes are calling! Check out what's poppin' in your city today!",
      "🌟 Your city is buzzing with excitement! Discover amazing events happening right now!",
      "🎊 The weekend is here and so are the adventures! See what's happening around you!",
      "✨ Magic happens on weekends! Explore the incredible events in your area!",
      "🎈 Ready for some weekend fun? Your city has amazing events waiting for you!",
      "🔥 The weekend energy is real! Check out what's hot in your city today!",
      "🎪 Adventure awaits! Discover the coolest events happening in your area!",
      "💫 Weekend mode activated! See what's poppin' in your city right now!",
      "🎭 Your city is alive with events! Don't miss out on the weekend fun!",
      "🚀 Weekend goals: Find amazing events! Check out what's happening in your area!"
    ];

    const randomMessage = creativeMessages[Math.floor(Math.random() * creativeMessages.length)];
    
    return await this.scheduleNotification({
      id: `weekend_reminder_${Date.now()}`,
      title: 'Weekend Vibes! 🎉',
      body: randomMessage,
      data: {
        type: 'weekend_reminder',
      },
      trigger: null, // Show immediately for testing
    });
  }

  /**
   * Schedule recurring weekend and midweek notifications
   */
  async scheduleRecurringWeekendNotifications(): Promise<void> {
    try {
      const settings = await this.getNotificationSettings();
      console.log('🔍 Notification settings:', settings);
      console.log('🔍 Weekend reminders enabled:', settings.weekendReminders);
      
      if (!settings.enabled || !settings.weekendReminders) {
        console.log('⚠️ Weekend reminders are disabled');
        return;
      }

      // Cancel any existing weekend notifications
      await this.cancelWeekendNotifications();

      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
      const currentHour = now.getHours();
      
      console.log('🔍 Current time:', now.toLocaleString());
      console.log('🔍 Current day (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat):', currentDay);
      console.log('🔍 Current hour:', currentHour);

      // Schedule Friday afternoon notification (2 PM)
      if (currentDay === 5 && currentHour < 14) {
        const fridayTime = new Date(now);
        fridayTime.setHours(14, 0, 0, 0); // 2 PM
        
        await this.scheduleNotification({
          id: 'weekend_friday_reminder',
          title: 'TGIF! 🎉',
          body: "Friday afternoon vibes! Check out what's poppin' in your city this weekend!",
          data: { type: 'weekend_reminder' },
          trigger: { type: 'date', date: fridayTime } as any,
        });
      }

      // Schedule Saturday notification (12 PM)
      const saturdayTime = new Date(now);
      saturdayTime.setDate(saturdayTime.getDate() + (6 - currentDay)); // Next Saturday
      saturdayTime.setHours(12, 0, 0, 0); // 12 PM

      await this.scheduleNotification({
        id: 'weekend_saturday_reminder',
        title: 'Saturday Fun! 🌟',
        body: "Weekend mode activated! Discover amazing events happening in your city today!",
        data: { type: 'weekend_reminder' },
        trigger: { type: 'date', date: saturdayTime } as any,
      });

      // Schedule Tuesday notification (5:40 PM)
      const tuesdayTime = new Date(now);
      const daysUntilTuesday = (2 - currentDay + 7) % 7;
      tuesdayTime.setDate(tuesdayTime.getDate() + daysUntilTuesday); // Next Tuesday
      tuesdayTime.setHours(17, 40, 0, 0); // 5:40 PM
      
      console.log('🔍 Tuesday notification calculation:');
      console.log('  - Current day:', currentDay);
      console.log('  - Days until Tuesday:', daysUntilTuesday);
      console.log('  - Tuesday notification time:', tuesdayTime.toLocaleString());
      console.log('  - Is Tuesday time in the future?', tuesdayTime > now);

      await this.scheduleNotification({
        id: 'weekend_tuesday_reminder',
        title: 'Tuesday Vibes! 🌟',
        body: "Midweek motivation! Check out what's happening in your city today!",
        data: { type: 'weekend_reminder' },
        trigger: { type: 'date', date: tuesdayTime } as any,
      });
      
      console.log('✅ Tuesday notification scheduled for:', tuesdayTime.toLocaleString());

      console.log('✅ Weekend and midweek notifications scheduled');
    } catch (error) {
      console.error('❌ Error scheduling weekend notifications:', error);
    }
  }

  /**
   * Cancel weekend notifications
   */
  async cancelWeekendNotifications(): Promise<void> {
    try {
      await this.cancelNotification('weekend_friday_reminder');
      await this.cancelNotification('weekend_saturday_reminder');
      await this.cancelNotification('weekend_tuesday_reminder');
      console.log('✅ Weekend notifications cancelled');
    } catch (error) {
      console.error('❌ Error cancelling weekend notifications:', error);
    }
  }

  /**
   * Debug: Check all scheduled notifications
   */
  async debugScheduledNotifications(): Promise<void> {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      console.log('🔍 All scheduled notifications:', scheduledNotifications);
      
      if (scheduledNotifications.length === 0) {
        console.log('⚠️ No scheduled notifications found');
      } else {
        scheduledNotifications.forEach((notification, index) => {
          console.log(`📅 Notification ${index + 1}:`);
          console.log(`  - ID: ${notification.identifier}`);
          console.log(`  - Title: ${notification.content.title}`);
          console.log(`  - Body: ${notification.content.body}`);
          console.log(`  - Trigger:`, notification.trigger);
        });
      }
    } catch (error) {
      console.error('❌ Error checking scheduled notifications:', error);
    }
  }

  /**
   * Debug: Test immediate notification
   */
  async testImmediateNotification(): Promise<void> {
    try {
      console.log('🧪 Testing immediate notification...');
      const testId = await this.scheduleNotification({
        id: 'test_notification',
        title: 'Test Notification! 🧪',
        body: 'This is a test notification to verify the system is working.',
        data: { type: 'test' },
        trigger: null, // Show immediately
      });
      console.log('✅ Test notification scheduled with ID:', testId);
      
      // Also try scheduling a notification for 10 seconds from now
      const futureTime = new Date(Date.now() + 10000); // 10 seconds from now
      const futureTestId = await this.scheduleNotification({
        id: 'test_future_notification',
        title: 'Future Test! ⏰',
        body: 'This notification was scheduled for 10 seconds in the future.',
        data: { type: 'test_future' },
        trigger: { type: 'date', date: futureTime } as any,
      });
      console.log('✅ Future test notification scheduled with ID:', futureTestId);
      console.log('⏰ Future test notification will appear at:', futureTime.toLocaleString());
      
    } catch (error) {
      console.error('❌ Error scheduling test notification:', error);
    }
  }

  // Get notification permissions status
  async getNotificationPermissions(): Promise<{
    granted: boolean;
    canAskAgain: boolean;
    status: string;
  }> {
    try {
      const { status, canAskAgain } = await Notifications.getPermissionsAsync();
      return {
        granted: status === 'granted',
        canAskAgain,
        status,
      };
    } catch (error) {
      console.error('Error getting notification permissions:', error);
      return {
        granted: false,
        canAskAgain: false,
        status: 'unknown',
      };
    }
  }

  /**
   * Schedule reminders for a saved event (only if it has a specific date)
   */
  async scheduleSavedEventReminders(eventId: string, eventName: string, eventDate: string, eventTime: string): Promise<{
    oneDayReminder: string;
    oneHourReminder: string;
  }> {
    try {
      // Parse the event date and time
      const eventDateTime = new Date(`${eventDate}T${eventTime}`);
      
      // Check if the event has a valid future date
      if (isNaN(eventDateTime.getTime()) || eventDateTime <= new Date()) {
        console.log(`⚠️ Event ${eventName} has no valid future date, skipping reminders`);
        return {
          oneDayReminder: '',
          oneHourReminder: '',
        };
      }

      console.log(`📅 Scheduling reminders for saved event: ${eventName} at ${eventDateTime}`);
      
      const oneDayReminder = await this.scheduleEventReminderOneDayBefore(eventId, eventName, eventDateTime);
      const oneHourReminder = await this.scheduleEventReminder(eventId, eventName, eventDateTime);
      
      console.log(`✅ Saved event reminders scheduled - 1 day: ${oneDayReminder ? 'Yes' : 'No'}, 1 hour: ${oneHourReminder ? 'Yes' : 'No'}`);
      
      return {
        oneDayReminder,
        oneHourReminder,
      };
    } catch (error) {
      console.error('❌ Error scheduling saved event reminders:', error);
      return {
        oneDayReminder: '',
        oneHourReminder: '',
      };
    }
  }

  /**
   * Schedule reminders for all saved events with specific dates
   */
  async scheduleAllSavedEventReminders(userEmail: string): Promise<void> {
    try {
      console.log(`🔄 Scheduling reminders for all saved events for user: ${userEmail}`);
      
      // Get user's saved events from database
      const { data: userData, error: userError } = await supabase
        .from('all_users')
        .select('saved_events')
        .eq('email', userEmail)
        .single();

      if (userError || !userData?.saved_events) {
        console.log('⚠️ No saved events found for user');
        return;
      }

      // Parse saved events
      let savedEventIds: number[] = [];
      if (typeof userData.saved_events === 'string') {
        savedEventIds = userData.saved_events
          .replace(/[{}]/g, '')
          .split(',')
          .map((id: string) => parseInt(id.trim()))
          .filter((id: number) => !isNaN(id));
      } else if (Array.isArray(userData.saved_events)) {
        savedEventIds = userData.saved_events.filter((id: number) => !isNaN(id));
      }

      if (savedEventIds.length === 0) {
        console.log('⚠️ No valid saved event IDs found');
        return;
      }

      // Get event details for saved events
      const { data: events, error: eventsError } = await supabase
        .from('new_events')
        .select('id, name, start_date, start_time, occurrence')
        .in('id', savedEventIds);

      if (eventsError || !events) {
        console.error('❌ Error fetching saved events:', eventsError);
        return;
      }

      let scheduledCount = 0;
      let skippedCount = 0;

      for (const event of events) {
        // Only schedule reminders for events with specific dates (not ongoing/weekly)
        if (event.occurrence === 'single' || event.occurrence === 'one-time') {
          if (event.start_date && event.start_time) {
            const result = await this.scheduleSavedEventReminders(
              event.id.toString(),
              event.name,
              event.start_date,
              event.start_time
            );
            
            if (result.oneDayReminder || result.oneHourReminder) {
              scheduledCount++;
              console.log(`✅ Scheduled reminders for event: ${event.name}`);
            } else {
              skippedCount++;
              console.log(`⚠️ Skipped reminders for event: ${event.name} (past date or invalid time)`);
            }
          } else {
            skippedCount++;
            console.log(`⚠️ Skipped reminders for event: ${event.name} (no date/time)`);
          }
        } else {
          skippedCount++;
          console.log(`⚠️ Skipped reminders for event: ${event.name} (ongoing/weekly event)`);
        }
      }

      console.log(`📊 Reminder scheduling complete: ${scheduledCount} scheduled, ${skippedCount} skipped`);
    } catch (error) {
      console.error('❌ Error scheduling all saved event reminders:', error);
    }
  }

  /**
   * Cancel reminders for a specific saved event
   */
  async cancelSavedEventReminders(eventId: string): Promise<void> {
    try {
      await this.cancelNotification(`event_reminder_${eventId}`);
      await this.cancelNotification(`event_reminder_1day_${eventId}`);
      console.log(`✅ Cancelled all reminders for saved event: ${eventId}`);
    } catch (error) {
      console.error('❌ Error cancelling saved event reminders:', error);
    }
  }
}

export default NotificationService; 