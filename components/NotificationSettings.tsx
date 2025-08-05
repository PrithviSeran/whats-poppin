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
    newFollowers: true,
    newEventsFromFollowing: true,
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
              newFollowers: true,
              newEventsFromFollowing: true,
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

            {/* New Followers */}
            <View style={[styles.section, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons 
                    name="person-add" 
                    size={24} 
                    color={Colors[colorScheme ?? 'light'].accent} 
                  />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                      New Followers
                    </Text>
                    <Text style={[styles.settingDescription, { color: Colors[colorScheme ?? 'light'].text }]}>
                      When someone starts following you
                    </Text>
                  </View>
                </View>
                <Switch
                  value={settings.newFollowers}
                  onValueChange={(value) => updateSetting('newFollowers', value)}
                  trackColor={{ false: '#767577', true: Colors[colorScheme ?? 'light'].primary }}
                  thumbColor={'#fff'}
                />
              </View>
            </View>

            {/* New Events from Following */}
            <View style={[styles.section, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Ionicons 
                    name="star" 
                    size={24} 
                    color={Colors[colorScheme ?? 'light'].success} 
                  />
                  <View style={styles.settingText}>
                    <Text style={[styles.settingTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                      Events from Following
                    </Text>
                    <Text style={[styles.settingDescription, { color: Colors[colorScheme ?? 'light'].text }]}>
                      When someone you follow creates an event
                    </Text>
                  </View>
                </View>
                <Switch
                  value={settings.newEventsFromFollowing}
                  onValueChange={(value) => updateSetting('newEventsFromFollowing', value)}
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