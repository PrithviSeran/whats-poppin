import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';

interface UserProfile {
  id: number;
  created_at: string;
  name: string;
  email: string;
  birthday: string;
  gender: string;
  saved_events?: string[];
  preferences?: string[];
  profileImage?: string;
  bannerImage?: string;
}

interface UserProfileModalProps {
  visible: boolean;
  onClose: () => void;
  userId: number;
  userName: string;
  userEmail: string;
}

export default function UserProfileModal({
  visible,
  onClose,
  userId,
  userName,
  userEmail
}: UserProfileModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [eventsCreated, setEventsCreated] = useState(0);
  const [eventsSaved, setEventsSaved] = useState(0);
  const [loading, setLoading] = useState(false);
  const colorScheme = useColorScheme();

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      
      // Fetch user profile
      const { data: userData, error: userError } = await supabase
        .from('all_users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError) throw userError;
      
      // Set the profile with proper image URLs
      const userProfile: UserProfile = {
        ...userData,
        profileImage: userData.profile_image || `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/user-images/${userData.email.replace('@', '_').replace(/\./g, '_')}/profile.jpg`,
        bannerImage: userData.banner_image || `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/user-images/${userData.email.replace('@', '_').replace(/\./g, '_')}/banner.jpg`
      };

      setProfile(userProfile);

      // Note: Events don't currently track creator, so showing 0 for now
      // This could be implemented in the future by adding a created_by_user_id field
      setEventsCreated(0);

      // Count saved events
      let savedCount = 0;
      if (userData.saved_events) {
        if (Array.isArray(userData.saved_events)) {
          savedCount = userData.saved_events.length;
        } else if (typeof userData.saved_events === 'string' && userData.saved_events) {
                     const savedEventIds = userData.saved_events
             .replace(/[{}"']+/g, '')
             .split(',')
             .filter((id: string) => id.trim());
          savedCount = savedEventIds.length;
        }
      }
      setEventsSaved(savedCount);

    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && userId) {
      fetchUserProfile();
    }
  }, [visible, userId]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
        {/* Close Button */}
        <TouchableOpacity onPress={onClose} style={styles.floatingCloseButton}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#9E95BD" />
            <Text style={[styles.loadingText, { color: Colors[colorScheme ?? 'light'].text }]}>
              Loading profile...
            </Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.scrollContainer} 
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Header with Banner and Profile Image */}
            <View style={styles.headerContainer}>
              {profile?.bannerImage && (
                <Image 
                  source={{ uri: profile.bannerImage }} 
                  style={styles.bannerImage}
                  resizeMode="cover"
                />
              )}
              <LinearGradient
                colors={['rgba(244, 91, 91, 0.4)', 'rgba(244, 91, 91, 0.4)', 'rgba(244, 91, 91, 0.4)', 'rgba(244, 91, 91, 0.4)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                locations={[0, 0.3, 0.7, 1]}
                style={styles.headerGradient}
              >
                <View style={styles.profileImageContainer}>
                  <View style={styles.profileImageWrapper}>
                    {profile?.profileImage ? (
                      <Image 
                        source={{ uri: profile.profileImage }} 
                        style={styles.profileImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.profileImage, styles.placeholderImage]}>
                        <Ionicons name="person" size={50} color="#fff" />
                      </View>
                    )}
                  </View>
                </View>
                <Text style={styles.name}>{profile?.name || userName}</Text>
              </LinearGradient>
            </View>

            {/* Content Container */}
            <View style={styles.modernContentContainer}>
              {/* Quick Stats Section */}
              <View style={styles.quickStatsSection}>
                <View style={[styles.statCard, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
                  <View style={[styles.statIconContainer, { backgroundColor: 'rgba(255, 107, 157, 0.1)' }]}>
                    <Ionicons name="calendar" size={24} color="#FF6B9D" />
                  </View>
                  <Text style={[styles.statNumber, { color: Colors[colorScheme ?? 'light'].text }]}>{eventsCreated}</Text>
                  <Text style={[styles.statLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Created</Text>
                </View>
                
                <View style={[styles.statCard, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
                  <View style={[styles.statIconContainer, { backgroundColor: 'rgba(78, 205, 196, 0.1)' }]}>
                    <Ionicons name="bookmark" size={24} color="#4ECDC4" />
                  </View>
                  <Text style={[styles.statNumber, { color: Colors[colorScheme ?? 'light'].text }]}>{eventsSaved}</Text>
                  <Text style={[styles.statLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Saved</Text>
                </View>
                
                <View style={[styles.statCard, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
                  <View style={[styles.statIconContainer, { backgroundColor: 'rgba(158, 149, 189, 0.1)' }]}>
                    <Ionicons name="time" size={24} color="#9E95BD" />
                  </View>
                  <Text style={[styles.statNumber, { color: Colors[colorScheme ?? 'light'].text }]}>
                    {profile?.created_at ? new Date(profile.created_at).getFullYear() : '----'}
                  </Text>
                  <Text style={[styles.statLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Joined</Text>
                </View>
              </View>

              {/* Profile Information Card */}
              <View style={[styles.profileInfoCard, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
                <View style={[styles.profileInfoHeader, { borderBottomColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
                  <Text style={[styles.profileInfoTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Profile Information</Text>
                </View>
                
                <View style={styles.profileInfoContent}>
                  <View style={styles.profileInfoRow}>
                    <View style={styles.profileInfoIconContainer}>
                      <Ionicons name="mail-outline" size={20} color="#9E95BD" />
                    </View>
                    <View style={styles.profileInfoDetails}>
                      <Text style={[styles.profileInfoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Email</Text>
                      <Text style={[styles.profileInfoValue, { color: Colors[colorScheme ?? 'light'].text }]}>{profile?.email || userEmail}</Text>
                    </View>
                  </View>

                  <View style={[styles.profileInfoDivider, { backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]} />

                  <View style={styles.profileInfoRow}>
                    <View style={styles.profileInfoIconContainer}>
                      <Ionicons name="calendar-outline" size={20} color="#FF6B9D" />
                    </View>
                    <View style={styles.profileInfoDetails}>
                      <Text style={[styles.profileInfoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Birthday</Text>
                      <Text style={[styles.profileInfoValue, { color: Colors[colorScheme ?? 'light'].text }]}>{profile?.birthday || 'Not provided'}</Text>
                    </View>
                  </View>

                  <View style={[styles.profileInfoDivider, { backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]} />

                  <View style={styles.profileInfoRow}>
                    <View style={styles.profileInfoIconContainer}>
                      <Ionicons name="person-outline" size={20} color="#4ECDC4" />
                    </View>
                    <View style={styles.profileInfoDetails}>
                      <Text style={[styles.profileInfoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Gender</Text>
                      <Text style={[styles.profileInfoValue, { color: Colors[colorScheme ?? 'light'].text }]}>{profile?.gender || 'Not provided'}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Member Since Card */}
              <View style={[styles.additionalInfoCard, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
                <View style={styles.joinedDateContainer}>
                  <Ionicons name="calendar" size={16} color="#9E95BD" />
                  <Text style={[styles.joinedDateText, { color: Colors[colorScheme ?? 'light'].text }]}>
                    Member since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { 
                      month: 'long', 
                      year: 'numeric' 
                    }) : 'Unknown'}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  floatingCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    paddingBottom: 20,
  },
  headerContainer: {
    width: '100%',
    height: 280,
    position: 'relative',
    overflow: 'hidden',
  },
  headerGradient: {
    width: '100%',
    height: '100%',
    paddingTop: 50,
    paddingBottom: 20,
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  bannerImage: {
    width: '100%',
    height: 280,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
  },
  profileImageContainer: {
    marginTop: 40,
    marginBottom: 20,
    alignItems: 'center',
  },
  profileImageWrapper: {
    position: 'relative',
    width: 120,
    height: 120,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#fff',
  },
  placeholderImage: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  modernContentContainer: {
    padding: 20,
  },
  quickStatsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 4,
    borderRadius: 16,
    shadowColor: '#9E95BD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statIconContainer: {
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.8,
  },
  profileInfoCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#9E95BD',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 20,
  },
  profileInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  profileInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  profileInfoContent: {
    padding: 20,
  },
  profileInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileInfoIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 8,
    marginRight: 12,
  },
  profileInfoDetails: {
    flex: 1,
  },
  profileInfoLabel: {
    fontSize: 14,
    opacity: 0.9,
  },
  profileInfoValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  profileInfoDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginVertical: 12,
  },
  additionalInfoCard: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#9E95BD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  joinedDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinedDateText: {
    fontSize: 14,
    marginLeft: 8,
    opacity: 0.8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 20,
  },
}); 