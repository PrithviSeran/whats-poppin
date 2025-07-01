import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { create_client } from '@supabase/supabase-js';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
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
  newEvents: boolean;
  marketing: boolean;
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

      const { error } = await supabase
        .from('user_push_tokens')
        .upsert({
          user_id: user.id,
          email: user.email,
          push_token: token,
          platform: Platform.OS,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('❌ Error saving push token to database:', error);
      } else {
        console.log('✅ Push token saved to database');
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
      });

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
        newEvents: true,
        marketing: false,
      };

      await this.saveNotificationSettings(defaultSettings);
      return defaultSettings;
    } catch (error) {
      console.error('❌ Error getting notification settings:', error);
      return {
        enabled: true,
        friendRequests: true,
        eventReminders: true,
        newEvents: true,
        marketing: false,
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
      },
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
      },
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
   * Schedule new events notification
   */
  async scheduleNewEventsNotification(eventCount: number): Promise<string> {
    return await this.scheduleNotification({
      id: `new_events_${Date.now()}`,
      title: 'New Events Available',
      body: `${eventCount} new events match your preferences!`,
      data: {
        type: 'new_events',
        eventCount: eventCount,
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
   * Cleanup listeners
   */
  cleanup(): void {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }

  /**
   * Get current push token
   */
  getCurrentPushToken(): string | null {
    return this.expoPushToken;
  }

  // Test all notification types
  async testAllNotifications(): Promise<void> {
    try {
      console.log('🧪 Testing all notification types...');
      
      // Test basic notification
      await this.scheduleNotification({
        id: 'test_basic',
        title: 'Basic Test',
        body: 'This is a basic notification test',
        data: { type: 'test_basic' },
        trigger: null,
      });
      
      // Test new events notification
      await this.scheduleNewEventsNotification(5);
      
      // Test friend request notification
      await this.scheduleFriendRequestNotification('Test Friend');
      
      // Test event reminder (5 minutes from now)
      const reminderTime = new Date();
      reminderTime.setMinutes(reminderTime.getMinutes() + 5);
      await this.scheduleEventReminder('test_event_456', 'Test Event Reminder', reminderTime);
      
      console.log('✅ All notification tests completed successfully');
    } catch (error) {
      console.error('❌ Error testing notifications:', error);
      throw error;
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
        .from('all_events')
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