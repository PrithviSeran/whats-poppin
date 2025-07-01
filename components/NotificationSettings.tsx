import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import NotificationService, { NotificationSettings as NotificationSettingsType } from '@/lib/NotificationService';
import { supabase } from '@/lib/supabase';

interface NotificationSettingsProps {
  visible: boolean;
  onClose: () => void;
}

export default function NotificationSettings({ visible, onClose }: NotificationSettingsProps) {
  const colorScheme = useColorScheme();
  const [settings, setSettings] = useState<NotificationSettingsType>({
    enabled: true,
    friendRequests: true,
    eventReminders: true,
    newEvents: true,
    marketing: false,
  });
  const [loading, setLoading] = useState(false);

  const notificationService = NotificationService.getInstance();

  useEffect(() => {
    if (visible) {
      loadSettings();
    }
  }, [visible]);

  const loadSettings = async () => {
    try {
      const savedSettings = await notificationService.getNotificationSettings();
      setSettings(savedSettings);
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const updateSetting = async (key: keyof NotificationSettingsType, value: boolean) => {
    try {
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);
      await notificationService.saveNotificationSettings(newSettings);
      
      // If disabling all notifications, show confirmation
      if (key === 'enabled' && !value) {
        Alert.alert(
          'Notifications Disabled',
          'You will no longer receive any notifications from What\'s Poppin. You can re-enable them anytime in settings.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error updating notification setting:', error);
      Alert.alert('Error', 'Failed to update notification setting. Please try again.');
    }
  };

  const testNotification = async () => {
    try {
      setLoading(true);
      
      // Show instructions first
      Alert.alert(
        'Testing Push Notifications',
        'To see a PUSH notification (not an alert):\n\n1. Tap "Send Test Notification"\n2. Immediately close the app (swipe up and swipe away)\n3. Wait 2-3 seconds\n4. You should see a push notification\n\nIf the app is open, you\'ll see an alert instead.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Send Test Notification',
            onPress: async () => {
              await notificationService.scheduleNotification({
                id: 'test_notification',
                title: '🎈 What\'s Poppin Test',
                body: 'This is a test push notification! Tap to open the app.',
                data: { type: 'test' },
                trigger: null, // Show immediately
              });
              Alert.alert('✅ Test Sent!', 'Now close the app to see the push notification.');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error sending test notification:', error);
      Alert.alert('Error', 'Failed to send test notification. Please check your notification permissions.');
    } finally {
      setLoading(false);
    }
  };

  const testNewEventsNotification = async () => {
    try {
      setLoading(true);
      await notificationService.scheduleNewEventsNotification(3); // Test with 3 new events
      Alert.alert('Success', 'New events notification sent!');
    } catch (error) {
      console.error('Error sending new events notification:', error);
      Alert.alert('Error', 'Failed to send new events notification.');
    } finally {
      setLoading(false);
    }
  };

  const testFriendRequestNotification = async () => {
    try {
      setLoading(true);
      await notificationService.scheduleFriendRequestNotification('Test User');
      Alert.alert('Success', 'Friend request notification sent!');
    } catch (error) {
      console.error('Error sending friend request notification:', error);
      Alert.alert('Error', 'Failed to send friend request notification.');
    } finally {
      setLoading(false);
    }
  };

  const testEventReminderNotification = async () => {
    try {
      setLoading(true);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0); // 10 AM tomorrow
      
      await notificationService.scheduleEventReminder('test_event_123', 'Test Event', tomorrow);
      Alert.alert('Success', 'Event reminder scheduled for tomorrow at 10 AM!');
    } catch (error) {
      console.error('Error scheduling event reminder:', error);
      Alert.alert('Error', 'Failed to schedule event reminder.');
    } finally {
      setLoading(false);
    }
  };

  const testOneDayReminderNotification = async () => {
    try {
      setLoading(true);
      const dayAfterTomorrow = new Date();
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      dayAfterTomorrow.setHours(15, 0, 0, 0); // 3 PM day after tomorrow
      
      await notificationService.scheduleEventReminderOneDayBefore('test_event_456', 'Test Event Tomorrow', dayAfterTomorrow);
      Alert.alert('Success', '1-day reminder scheduled! You\'ll get notified tomorrow about the event happening the day after.');
    } catch (error) {
      console.error('Error scheduling 1-day reminder:', error);
      Alert.alert('Error', 'Failed to schedule 1-day reminder.');
    } finally {
      setLoading(false);
    }
  };

  const testMultipleReminders = async () => {
    try {
      setLoading(true);
      const futureEvent = new Date();
      futureEvent.setDate(futureEvent.getDate() + 3);
      futureEvent.setHours(20, 0, 0, 0); // 8 PM in 3 days
      
      const result = await notificationService.scheduleEventReminders('test_event_789', 'Test Event with Multiple Reminders', futureEvent);
      
      Alert.alert(
        'Multiple Reminders Scheduled!',
        `Event: Test Event with Multiple Reminders\nDate: ${futureEvent.toLocaleDateString()} at 8:00 PM\n\nYou'll receive:\n• 1-day reminder: ${futureEvent.getDate() - 1} at 8:00 PM\n• 1-hour reminder: ${futureEvent.getDate()} at 7:00 PM`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error scheduling multiple reminders:', error);
      Alert.alert('Error', 'Failed to schedule multiple reminders.');
    } finally {
      setLoading(false);
    }
  };

  const testSavedEventReminders = async () => {
    try {
      setLoading(true);
      
      // Get current user email
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        Alert.alert('Error', 'User not found');
        return;
      }

      await notificationService.scheduleAllSavedEventReminders(user.email);
      
      Alert.alert(
        '✅ Saved Event Reminders',
        'Reminders have been scheduled for all your saved events with specific dates!\n\nCheck the console for detailed scheduling information.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error scheduling saved event reminders:', error);
      Alert.alert('Error', 'Failed to schedule saved event reminders.');
    } finally {
      setLoading(false);
    }
  };

  const testSingleSavedEventReminder = async () => {
    try {
      setLoading(true);
      
      // Test with a sample saved event
      const result = await notificationService.scheduleSavedEventReminders(
        'test_saved_event_123',
        'Sample Saved Event',
        new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days from now
        '15:00' // 3 PM
      );
      
      if (result.oneDayReminder || result.oneHourReminder) {
        Alert.alert(
          '✅ Single Saved Event Reminder',
          'Reminder scheduled for "Sample Saved Event"!\n\nYou\'ll get notified:\n• 1 day before (if enabled)\n• 1 hour before (if enabled)',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('⚠️ No Reminders Scheduled', 'The test event might be in the past or have invalid date/time.');
      }
    } catch (error) {
      console.error('Error scheduling single saved event reminder:', error);
      Alert.alert('Error', 'Failed to schedule single saved event reminder.');
    } finally {
      setLoading(false);
    }
  };

  const testDelayedNotification = async () => {
    try {
      setLoading(true);
      
      // Schedule notification for 5 seconds from now
      const futureTime = new Date();
      futureTime.setSeconds(futureTime.getSeconds() + 5);
      
      await notificationService.scheduleNotification({
        id: 'delayed_test_notification',
        title: '⏰ Delayed Test',
        body: 'This notification was scheduled 5 seconds ago!',
        data: { type: 'delayed_test' },
        trigger: {
          type: 'date',
          date: futureTime,
        },
      });
      
      Alert.alert(
        '⏰ Delayed Test Scheduled!',
        'A notification will appear in 5 seconds.\n\nTo see it as a PUSH notification:\n1. Close the app now\n2. Wait 5 seconds\n3. You\'ll see a push notification\n\nOr keep the app open to see it as an alert.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error scheduling delayed notification:', error);
      Alert.alert('Error', 'Failed to schedule delayed notification.');
    } finally {
      setLoading(false);
    }
  };

  const testNotificationPermissions = async () => {
    try {
      setLoading(true);
      const permissions = await notificationService.getNotificationPermissions();
      
      Alert.alert(
        '📱 Notification Permissions',
        `Status: ${permissions.status}\nGranted: ${permissions.granted ? 'Yes' : 'No'}\nCan Ask Again: ${permissions.canAskAgain ? 'Yes' : 'No'}\n\nIf not granted, you can enable notifications in your device settings.`,
        [
          { text: 'OK' },
          {
            text: 'Request Permissions',
            onPress: async () => {
              const granted = await notificationService.requestPermissions();
              Alert.alert(
                granted ? '✅ Permissions Granted!' : '❌ Permissions Denied',
                granted ? 'You can now receive notifications!' : 'Please enable notifications in device settings.'
              );
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error checking permissions:', error);
      Alert.alert('Error', 'Failed to check notification permissions.');
    } finally {
      setLoading(false);
    }
  };

  const resetToDefaults = async () => {
    Alert.alert(
      'Reset to Defaults',
      'Are you sure you want to reset all notification settings to their default values?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const defaultSettings: NotificationSettingsType = {
              enabled: true,
              friendRequests: true,
              eventReminders: true,
              newEvents: true,
              marketing: false,
            };
            setSettings(defaultSettings);
            await notificationService.saveNotificationSettings(defaultSettings);
          },
        },
      ]
    );
  };

  if (!visible) return null;

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: Colors[colorScheme ?? 'light'].text }]}>
          Notification Settings
        </Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={Colors[colorScheme ?? 'light'].text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Main Toggle */}
        <View style={[styles.section, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons 
                name="notifications" 
                size={24} 
                color={settings.enabled ? Colors[colorScheme ?? 'light'].primary : Colors[colorScheme ?? 'light'].text} 
              />
              <View style={styles.settingText}>
                <Text style={[styles.settingTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                  Enable Notifications
                </Text>
                <Text style={[styles.settingDescription, { color: Colors[colorScheme ?? 'light'].text }]}>
                  Receive notifications from What's Poppin
                </Text>
              </View>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={(value) => updateSetting('enabled', value)}
              trackColor={{ false: '#767577', true: Colors[colorScheme ?? 'light'].primary }}
              thumbColor={'#fff'}
            />
          </View>
        </View>

        {settings.enabled && (
          <>
            {/* Friend Requests */}
            <View style={[styles.section, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons 
                    name="people" 
                    size={24} 
                    color={Colors[colorScheme ?? 'light'].accent} 
                  />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                      Friend Requests
                    </Text>
                    <Text style={[styles.settingDescription, { color: Colors[colorScheme ?? 'light'].text }]}>
                      When someone sends you a friend request
                    </Text>
                  </View>
                </View>
                <Switch
                  value={settings.friendRequests}
                  onValueChange={(value) => updateSetting('friendRequests', value)}
                  trackColor={{ false: '#767577', true: Colors[colorScheme ?? 'light'].primary }}
                  thumbColor={'#fff'}
                />
              </View>
            </View>

            {/* Event Reminders */}
            <View style={[styles.section, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons 
                    name="calendar" 
                    size={24} 
                    color={Colors[colorScheme ?? 'light'].success} 
                  />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                      Event Reminders
                    </Text>
                    <Text style={[styles.settingDescription, { color: Colors[colorScheme ?? 'light'].text }]}>
                      Reminders for events you're interested in
                    </Text>
                  </View>
                </View>
                <Switch
                  value={settings.eventReminders}
                  onValueChange={(value) => updateSetting('eventReminders', value)}
                  trackColor={{ false: '#767577', true: Colors[colorScheme ?? 'light'].primary }}
                  thumbColor={'#fff'}
                />
              </View>
            </View>

            {/* New Events */}
            <View style={[styles.section, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons 
                    name="sparkles" 
                    size={24} 
                    color={Colors[colorScheme ?? 'light'].warning} 
                  />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                      New Events
                    </Text>
                    <Text style={[styles.settingDescription, { color: Colors[colorScheme ?? 'light'].text }]}>
                      When new events match your preferences
                    </Text>
                  </View>
                </View>
                <Switch
                  value={settings.newEvents}
                  onValueChange={(value) => updateSetting('newEvents', value)}
                  trackColor={{ false: '#767577', true: Colors[colorScheme ?? 'light'].primary }}
                  thumbColor={'#fff'}
                />
              </View>
            </View>

            {/* Marketing */}
            <View style={[styles.section, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons 
                    name="megaphone" 
                    size={24} 
                    color={Colors[colorScheme ?? 'light'].info} 
                  />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                      Marketing & Updates
                    </Text>
                    <Text style={[styles.settingDescription, { color: Colors[colorScheme ?? 'light'].text }]}>
                      App updates and promotional content
                    </Text>
                  </View>
                </View>
                <Switch
                  value={settings.marketing}
                  onValueChange={(value) => updateSetting('marketing', value)}
                  trackColor={{ false: '#767577', true: Colors[colorScheme ?? 'light'].primary }}
                  thumbColor={'#fff'}
                />
              </View>
            </View>
          </>
        )}

        {/* Testing Section */}
        <View style={[styles.section, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
          <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
            🧪 Testing Notifications
          </Text>
          <Text style={[styles.sectionSubtitle, { color: Colors[colorScheme ?? 'light'].text }]}>
            Test different types of notifications to ensure they work properly
          </Text>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}
            onPress={testNotification}
            disabled={loading || !settings.enabled}
          >
            <Ionicons 
              name="notifications" 
              size={20} 
              color={loading || !settings.enabled ? Colors[colorScheme ?? 'light'].text + '60' : Colors[colorScheme ?? 'light'].primary} 
            />
            <Text style={[
              styles.actionButtonText, 
              { color: loading || !settings.enabled ? Colors[colorScheme ?? 'light'].text + '60' : Colors[colorScheme ?? 'light'].primary }
            ]}>
              {loading ? 'Sending...' : 'Test Basic Notification'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}
            onPress={testNewEventsNotification}
            disabled={loading || !settings.enabled || !settings.newEvents}
          >
            <Ionicons 
              name="sparkles" 
              size={20} 
              color={loading || !settings.enabled || !settings.newEvents ? Colors[colorScheme ?? 'light'].text + '60' : Colors[colorScheme ?? 'light'].primary} 
            />
            <Text style={[
              styles.actionButtonText, 
              { color: loading || !settings.enabled || !settings.newEvents ? Colors[colorScheme ?? 'light'].text + '60' : Colors[colorScheme ?? 'light'].primary }
            ]}>
              {loading ? 'Sending...' : 'Test New Events Notification'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}
            onPress={testFriendRequestNotification}
            disabled={loading || !settings.enabled || !settings.friendRequests}
          >
            <Ionicons 
              name="people" 
              size={20} 
              color={loading || !settings.enabled || !settings.friendRequests ? Colors[colorScheme ?? 'light'].text + '60' : Colors[colorScheme ?? 'light'].primary} 
            />
            <Text style={[
              styles.actionButtonText, 
              { color: loading || !settings.enabled || !settings.friendRequests ? Colors[colorScheme ?? 'light'].text + '60' : Colors[colorScheme ?? 'light'].primary }
            ]}>
              {loading ? 'Sending...' : 'Test Friend Request Notification'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}
            onPress={testEventReminderNotification}
            disabled={loading || !settings.enabled || !settings.eventReminders}
          >
            <Ionicons 
              name="calendar" 
              size={20} 
              color={loading || !settings.enabled || !settings.eventReminders ? Colors[colorScheme ?? 'light'].text + '60' : Colors[colorScheme ?? 'light'].primary} 
            />
            <Text style={[
              styles.actionButtonText, 
              { color: loading || !settings.enabled || !settings.eventReminders ? Colors[colorScheme ?? 'light'].text + '60' : Colors[colorScheme ?? 'light'].primary }
            ]}>
              {loading ? 'Sending...' : 'Test Event Reminder (Tomorrow 10 AM)'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}
            onPress={testOneDayReminderNotification}
            disabled={loading || !settings.enabled || !settings.eventReminders}
          >
            <Ionicons 
              name="calendar" 
              size={20} 
              color={loading || !settings.enabled || !settings.eventReminders ? Colors[colorScheme ?? 'light'].text + '60' : Colors[colorScheme ?? 'light'].primary} 
            />
            <Text style={[
              styles.actionButtonText, 
              { color: loading || !settings.enabled || !settings.eventReminders ? Colors[colorScheme ?? 'light'].text + '60' : Colors[colorScheme ?? 'light'].primary }
            ]}>
              {loading ? 'Sending...' : 'Test 1-Day Reminder (3 PM)'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}
            onPress={testMultipleReminders}
            disabled={loading || !settings.enabled || !settings.eventReminders}
          >
            <Ionicons 
              name="calendar" 
              size={20} 
              color={loading || !settings.enabled || !settings.eventReminders ? Colors[colorScheme ?? 'light'].text + '60' : Colors[colorScheme ?? 'light'].primary} 
            />
            <Text style={[
              styles.actionButtonText, 
              { color: loading || !settings.enabled || !settings.eventReminders ? Colors[colorScheme ?? 'light'].text + '60' : Colors[colorScheme ?? 'light'].primary }
            ]}>
              {loading ? 'Sending...' : 'Test Multiple Reminders'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}
            onPress={testSingleSavedEventReminder}
            disabled={loading || !settings.enabled || !settings.eventReminders}
          >
            <Ionicons 
              name="bookmark" 
              size={20} 
              color={loading || !settings.enabled || !settings.eventReminders ? Colors[colorScheme ?? 'light'].text + '60' : Colors[colorScheme ?? 'light'].primary} 
            />
            <Text style={[
              styles.actionButtonText, 
              { color: loading || !settings.enabled || !settings.eventReminders ? Colors[colorScheme ?? 'light'].text + '60' : Colors[colorScheme ?? 'light'].primary }
            ]}>
              {loading ? 'Sending...' : 'Test Single Saved Event'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}
            onPress={testSavedEventReminders}
            disabled={loading || !settings.enabled || !settings.eventReminders}
          >
            <Ionicons 
              name="bookmarks" 
              size={20} 
              color={loading || !settings.enabled || !settings.eventReminders ? Colors[colorScheme ?? 'light'].text + '60' : Colors[colorScheme ?? 'light'].primary} 
            />
            <Text style={[
              styles.actionButtonText, 
              { color: loading || !settings.enabled || !settings.eventReminders ? Colors[colorScheme ?? 'light'].text + '60' : Colors[colorScheme ?? 'light'].primary }
            ]}>
              {loading ? 'Sending...' : 'Test All Saved Events'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}
            onPress={testDelayedNotification}
            disabled={loading || !settings.enabled}
          >
            <Ionicons 
              name="time" 
              size={20} 
              color={loading || !settings.enabled ? Colors[colorScheme ?? 'light'].text + '60' : Colors[colorScheme ?? 'light'].primary} 
            />
            <Text style={[
              styles.actionButtonText, 
              { color: loading || !settings.enabled ? Colors[colorScheme ?? 'light'].text + '60' : Colors[colorScheme ?? 'light'].primary }
            ]}>
              {loading ? 'Sending...' : 'Test Delayed Notification'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}
            onPress={testNotificationPermissions}
            disabled={loading || !settings.enabled}
          >
            <Ionicons 
              name="settings" 
              size={20} 
              color={loading || !settings.enabled ? Colors[colorScheme ?? 'light'].text + '60' : Colors[colorScheme ?? 'light'].primary} 
            />
            <Text style={[
              styles.actionButtonText, 
              { color: loading || !settings.enabled ? Colors[colorScheme ?? 'light'].text + '60' : Colors[colorScheme ?? 'light'].primary }
            ]}>
              {loading ? 'Checking...' : 'Check Notification Permissions'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}
            onPress={resetToDefaults}
          >
            <Ionicons 
              name="refresh-outline" 
              size={20} 
              color={Colors[colorScheme ?? 'light'].text} 
            />
            <Text style={[styles.actionButtonText, { color: Colors[colorScheme ?? 'light'].text }]}>
              Reset to Defaults
            </Text>
          </TouchableOpacity>
        </View>

        {/* Info Section */}
        <View style={[styles.infoSection, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
          <Ionicons name="information-circle-outline" size={20} color={Colors[colorScheme ?? 'light'].info} />
          <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text }]}>
            You can change these settings anytime. Some notifications may still appear if required for app functionality.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginTop: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#9E95BD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
    opacity: 0.7,
  },
  actionButtons: {
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  infoSection: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoText: {
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
    opacity: 0.8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 20,
  },
}); 