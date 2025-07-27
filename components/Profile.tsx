import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, TextInput, Alert, ActivityIndicator, Animated, Easing, ScrollView, RefreshControl, StatusBar, Modal, FlatList, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors, gradients } from '@/constants/Colors';
import MainFooter from './MainFooter';
import FriendsModal from './FriendsModal';
import { supabase } from '@/lib/supabase';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import GlobalDataManager, { UserProfile } from '@/lib/GlobalDataManager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LegalDocumentViewer from './LegalDocumentViewer';
import SocialDataManager, { Friend, FriendRequest, Follower, Following, SocialData } from '@/lib/SocialDataManager';
import OptimizedImage from './OptimizedImage';

type RootStackParamList = {
  '(tabs)': {
    screen?: string;
    params?: {
      updatedProfile?: UserProfile;
    };
  };

  'edit-images': { currentProfile: UserProfile };
  'create-event': undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface ProfileProps {
  dataManager?: GlobalDataManager;
  socialDataManager?: SocialDataManager;
}

export default memo(function Profile({ 
  dataManager = GlobalDataManager.getInstance(), 
  socialDataManager = SocialDataManager.getInstance() 
}: ProfileProps = {}) {
  const [profile, setProfile] = useState<UserProfile | null>(null);


  const colorScheme = useColorScheme();
  const navigation = useNavigation<NavigationProp>();
  
  // Add animation values
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  // Friends state
  const [friendsModalVisible, setFriendsModalVisible] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Notification state for new friends/requests
  const [lastViewedFriendsCount, setLastViewedFriendsCount] = useState(0);
  const [lastViewedRequestsCount, setLastViewedRequestsCount] = useState(0);
  const [hasNewFriends, setHasNewFriends] = useState(false);
  const [hasNewRequests, setHasNewRequests] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // State for follow counts
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Image preloading state
  const [imagesPreloaded, setImagesPreloaded] = useState(false);

  // OFFLINE-FIRST: Load all social data from cache/database with automatic sync
  const loadAllSocialData = async (userId: number, forceRefresh: boolean = false) => {
    try {
      console.log(`🚀 OFFLINE-FIRST: Loading social data for user ${userId}`, forceRefresh ? '(forced refresh)' : '');
      
      // Get all social data with automatic caching
      const socialData: SocialData = await socialDataManager.refreshAllSocialData(userId, forceRefresh);
      
      // Update all state from cached/fresh data
      setFriends(socialData.friends);
      setFriendRequests(socialData.friendRequests);
      setFollowersCount(socialData.followersCount);
      setFollowingCount(socialData.followingCount);
      
      console.log('✅ OFFLINE-FIRST: All social data loaded and state updated:', {
        friends: socialData.friends.length,
        requests: socialData.friendRequests.length,
        followers: socialData.followersCount,
        following: socialData.followingCount,
        dataSource: forceRefresh ? 'database (forced)' : 'cache/database'
      });
      
      return socialData;
    } catch (error) {
      console.error('❌ Error loading social data:', error);
      return null;
    }
  };

  // Load notification state from AsyncStorage
  const loadNotificationState = async () => {
    try {
      const lastFriendsCount = await AsyncStorage.getItem('lastViewedFriendsCount');
      const lastRequestsCount = await AsyncStorage.getItem('lastViewedRequestsCount');
      
      setLastViewedFriendsCount(lastFriendsCount ? parseInt(lastFriendsCount) : 0);
      setLastViewedRequestsCount(lastRequestsCount ? parseInt(lastRequestsCount) : 0);
    } catch (error) {
      console.error('Error loading notification state:', error);
    }
  };

  // Initial data loading function with OFFLINE-FIRST social caching
  const loadInitialData = async () => {
    try {
      setLoading(true);
      console.log('🚀 OFFLINE-FIRST: Starting complete data load...');
      
      // First get the user profile
      await fetchUserProfile();
      
      // Get user profile from data manager to ensure we have the ID
      const userProfile = await dataManager.getUserProfile();
      if (userProfile?.id) {
        console.log('✅ User ID found, loading cached social data...');
        // Load all social data from cache/database in one call
        await loadAllSocialData(userProfile.id, false);
        console.log('✅ All social data loaded successfully from cache/database');
      } else {
        console.log('⚠️ No user ID found, skipping social data');
      }
    } catch (error) {
      console.error('❌ Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update notification state when counts change
  const updateNotificationState = () => {
    setHasNewFriends(friends.length > lastViewedFriendsCount);
    setHasNewRequests(friendRequests.length > lastViewedRequestsCount);
  };

  // Mark friends as viewed
  const markFriendsAsViewed = async () => {
    try {
      await AsyncStorage.setItem('lastViewedFriendsCount', friends.length.toString());
      setLastViewedFriendsCount(friends.length);
      setHasNewFriends(false);
    } catch (error) {
      console.error('Error saving friends viewed state:', error);
    }
  };

  // Mark requests as viewed
  const markRequestsAsViewed = async () => {
    try {
      await AsyncStorage.setItem('lastViewedRequestsCount', friendRequests.length.toString());
      setLastViewedRequestsCount(friendRequests.length);
      setHasNewRequests(false);
    } catch (error) {
      console.error('Error saving requests viewed state:', error);
    }
  };

  const fetchUserProfile = async () => {
    try {
      console.log('Profile component: Fetching user profile...');
      
      // Get the current user
      const user = await dataManager.getUserProfile();
      if (!user) {
        console.log('Profile component: No user found');
        return;
      }

      console.log('Profile component: Profile fetched successfully for user:', user.email);
      setProfile(user);

      // Preload images if they exist using GlobalDataManager
      if (user.profileImage || user.bannerImage) {
        console.log('🖼️ Preloading profile images...');
        try {
          await dataManager.preloadProfileImages(user.profileImage, user.bannerImage);
          console.log('✅ Profile images preloaded successfully');
          setImagesPreloaded(true);
        } catch (error) {
          console.warn('⚠️ Some images failed to preload:', error);
          setImagesPreloaded(true); // Still set to true to show images
        }
      } else {
        setImagesPreloaded(true);
      }
    } catch (error) {
      console.error('Profile component: Error in fetchUserProfile:', error);
      setImagesPreloaded(true); // Set to true even on error to show placeholder
    }
  };

  useEffect(() => {
    loadInitialData();
    loadNotificationState();

    // Listen for profile updates from GlobalDataManager
    const handleProfileUpdate = (updatedProfile: UserProfile) => {
      console.log('🔄 Profile: Received profile update from GlobalDataManager');
      setProfile(updatedProfile);
    };

    dataManager.on('profileUpdated', handleProfileUpdate);

    // Cleanup listener on unmount
    return () => {
      dataManager.off('profileUpdated', handleProfileUpdate);
    };
  }, [dataManager]);

  // Add periodic refresh for social data every 30 seconds when app is active
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (profile?.id) {
        console.log('🔄 OFFLINE-FIRST: Periodic refresh - checking for social updates...');
        loadAllSocialData(profile.id, true); // Force refresh for periodic check
      }
    }, 30000); // 30 seconds

    return () => clearInterval(intervalId);
  }, [profile?.id]);

  // Update notification state when friends or requests change
  useEffect(() => {
    updateNotificationState();
  }, [friends.length, friendRequests.length, lastViewedFriendsCount, lastViewedRequestsCount]);

  // Update profile data when returning from edit screens
  useFocusEffect(
    React.useCallback(() => {
      // Only refresh if we already have a profile loaded (not on initial mount)
      if (profile?.id && !loading) {
        console.log('🔄 Profile: Screen focused, checking for updated data...');
        
        // Get the updated profile from cache (should already be fresh from edit screens)
        dataManager.getUserProfile().then((updatedProfile) => {
          if (updatedProfile) {
            console.log('✅ Profile: Updated profile data loaded from cache');
            setProfile(updatedProfile);
          }
        }).catch(error => {
          console.error('🚨 Profile: Error loading updated profile:', error);
        });

        // OFFLINE-FIRST: Also refresh social data when screen is focused 
        // This catches follow/unfollow actions from other screens
        console.log('🔄 OFFLINE-FIRST: Refreshing social data on screen focus...');
        loadAllSocialData(profile.id, true); // Force refresh to catch changes from other screens
      }
    }, [profile?.id, loading, dataManager])
  );

  // Start the animations when component mounts
  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Comprehensive animation cleanup on component unmount
  useEffect(() => {
    return () => {
      // Stop all animations to prevent memory leaks
      console.log('🧹 Profile: Cleaning up animations');
      
      // Stop all animated values
      pulseAnim.stopAnimation();
      rotateAnim.stopAnimation();
      scrollY.stopAnimation();
    };
  }, []);

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? You will need to sign in again to access your account.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.auth.signOut();
              if (error) throw error;
              
              // Reset the navigation stack completely and navigate to main tabs
              // The index.tsx will handle showing SignInScreen when there's no session
              navigation.reset({
                index: 0,
                routes: [{ name: '(tabs)' }],
              });
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = async () => {
    if (!profile?.email) {
      Alert.alert('Error', 'Unable to identify your account. Please try again.');
      return;
    }

    Alert.alert(
      'Delete Account',
      'Are you absolutely sure you want to delete your account? This action cannot be undone and will permanently remove:\n\n• Your profile and all personal data\n• All events you have posted\n• Your friends and social connections\n• All saved events and preferences',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🗑️ Starting account deletion process for:', profile.email);
              
              // Step 1: Delete all events posted by this user
              console.log('📝 Deleting user\'s posted events...');
              const { error: eventsError } = await supabase
                .from('all_events')
                .delete()
                .eq('posted_by', profile.email);
              
              if (eventsError) {
                console.error('❌ Error deleting user events:', eventsError);
                throw new Error(`Failed to delete events: ${eventsError.message}`);
              }
              
              console.log('✅ User events deleted successfully');
              
              // Step 2: Delete user from all_users table
              console.log('👤 Deleting user from all_users table...');
              const { error: userError } = await supabase
                .from('all_users')
                .delete()
                .eq('email', profile.email);
              
              if (userError) {
                console.error('❌ Error deleting user from all_users:', userError);
                throw new Error(`Failed to delete user profile: ${userError.message}`);
              }
              
              console.log('✅ User deleted from all_users successfully');
              
              // Step 3: Delete user from Supabase auth
              console.log('🔐 Deleting user from Supabase auth...');
              const { error: authError } = await supabase.auth.admin.deleteUser(
                (await supabase.auth.getUser()).data.user?.id || ''
              );
              
              if (authError) {
                console.error('❌ Error deleting user from auth:', authError);
                throw new Error(`Failed to delete authentication: ${authError.message}`);
              }
              
              console.log('✅ User deleted from auth successfully');
              
              // Step 4: Sign out and redirect
              console.log('🚪 Signing out and redirecting...');
              await supabase.auth.signOut();
              
              // Reset navigation and show success message
              Alert.alert(
                'Account Deleted',
                'Your account has been successfully deleted. Thank you for using our app.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      navigation.reset({
                        index: 0,
                        routes: [{ name: '(tabs)' }],
                      });
                    },
                  },
                ]
              );
              
            } catch (error) {
              console.error('❌ Error during account deletion:', error);
              Alert.alert(
                'Deletion Failed',
                `Failed to delete your account: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again or contact support.`
              );
            }
          },
        },
      ]
    );
  };



  const handleEditImages = () => {
    if (profile) {
      // Navigate to dedicated EditImages screen instead of inline editing
      navigation.navigate('edit-images', { currentProfile: profile });
    }
  };



  const handleCreateEvent = () => {
    navigation.navigate('create-event');
  };

  const handleOpenTerms = () => {
    setShowTermsModal(true);
  };

  const handleOpenPrivacyPolicy = () => {
    setShowPrivacyModal(true);
  };

  // OFFLINE-FIRST: Simplified social data functions for Profile component
  const refreshSocialData = async (forceRefresh: boolean = false) => {
    if (!profile?.id) return;
    
    try {
      console.log(`🔄 OFFLINE-FIRST: Refreshing social data for user ID ${profile.id}`, forceRefresh ? '(forced)' : '');
      await loadAllSocialData(profile.id, forceRefresh);
    } catch (error) {
      console.error('❌ Error refreshing social data:', error);
    }
  };

  const handleOpenFriendsModal = () => {
    setFriendsModalVisible(true);
    // Refresh social data when opening modal to get latest data
    if (profile?.id) {
      console.log('🔄 OFFLINE-FIRST: Refreshing social data when opening modal...');
      refreshSocialData(true); // Force refresh for modal interaction
    }
    // Mark friends as viewed when opening modal
    setTimeout(() => markFriendsAsViewed(), 500);
  };

  // Function to refresh all social data when called from FriendsModal
  const refreshAllSocialCounts = () => {
    if (profile?.id) {
      console.log('🔄 OFFLINE-FIRST: Refreshing all social data after social action...');
      refreshSocialData(true); // Force refresh after social interactions
    }
  };

  if (loading || !imagesPreloaded) {
    const spin = rotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    const scale = pulseAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.8, 1.2],
    });

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
        <View style={styles.loadingContainer}>
          <Animated.View
            style={[
              styles.loadingCircle,
              {
                transform: [{ scale }, { rotate: spin }],
                borderColor: Colors[colorScheme ?? 'light'].accent,
              },
            ]}
          >
            <View style={styles.innerCircle} />
          </Animated.View>
          <Text style={[styles.loadingText, { color: Colors[colorScheme ?? 'light'].text, marginTop: 20 }]}>
            {loading ? 'Loading profile and friends...' : 'Loading images...'}
          </Text>
        </View>
        <View style={styles.footerContainer}>
          <MainFooter activeTab="me" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      <ScrollView 
        style={styles.scrollContainer} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header moved inside ScrollView to scroll with content */}
        <View style={styles.headerContainer}>
          {profile?.bannerImage && (
            <OptimizedImage 
              source={{ uri: profile?.bannerImage || '' }} 
              style={styles.bannerImage}
              resizeMode="cover"
              placeholder={false}
            />
          )}
          <LinearGradient
            colors={[
              `rgba(${parseInt(Colors[colorScheme ?? 'light'].primary.slice(1, 3), 16)}, ${parseInt(Colors[colorScheme ?? 'light'].primary.slice(3, 5), 16)}, ${parseInt(Colors[colorScheme ?? 'light'].primary.slice(5, 7), 16)}, 0.4)`,
              `rgba(${parseInt(Colors[colorScheme ?? 'light'].primaryLight.slice(1, 3), 16)}, ${parseInt(Colors[colorScheme ?? 'light'].primaryLight.slice(3, 5), 16)}, ${parseInt(Colors[colorScheme ?? 'light'].primaryLight.slice(5, 7), 16)}, 0.4)`
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <TouchableOpacity style={styles.editButton} onPress={handleEditImages}>
              <Ionicons name="images" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.profileImageContainer}>
              <View style={styles.profileImageWrapper}>
                {profile?.profileImage ? (
                  <OptimizedImage 
                    source={{ uri: profile?.profileImage || '' }} 
                    style={styles.profileImage}
                    resizeMode="cover"
                    placeholder={false}
                  />
                ) : (
                  <View style={[styles.profileImage, styles.placeholderImage]}>
                    <Ionicons name="person" size={50} color="#fff" />
                  </View>
                )}
              </View>
            </View>
            
            {/* Username display */}
            <View style={styles.nameContainer}>
              <View style={styles.nameDisplayContainer}>
                <Text style={styles.name}>@{profile?.username || 'username'}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Modern Content Container */}
        <View style={styles.modernContentContainer}>
          {/* Quick Stats Section - 2x2 Grid Layout */}
          <View style={styles.quickStatsSection}>
            {/* Top Row */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
                <View style={styles.statCardContent}>
                  <View style={[styles.statIconContainer, { backgroundColor: 'rgba(158, 149, 189, 0.1)' }]}>
                    <Ionicons name="people" size={22} color="#9E95BD" />
                  </View>
                  <View style={styles.statTextContainer}>
                    <Text style={[styles.statNumber, { color: Colors[colorScheme ?? 'light'].text }]}>{friends.length}</Text>
                    <Text style={[styles.statLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Friends</Text>
                  </View>
                </View>
              </View>
              
              <View style={[styles.statCard, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
                <View style={styles.statCardContent}>
                  <View style={[styles.statIconContainer, { backgroundColor: 'rgba(76, 175, 80, 0.1)' }]}>
                    <Ionicons name="person" size={22} color="#4CAF50" />
                  </View>
                  <View style={styles.statTextContainer}>
                    <Text style={[styles.statNumber, { color: Colors[colorScheme ?? 'light'].text }]}>{followersCount}</Text>
                    <Text style={[styles.statLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Followers</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Bottom Row */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
                <View style={styles.statCardContent}>
                  <View style={[styles.statIconContainer, { backgroundColor: 'rgba(255, 193, 7, 0.1)' }]}>
                    <Ionicons name="person-add" size={22} color="#FFC107" />
                  </View>
                  <View style={styles.statTextContainer}>
                    <Text style={[styles.statNumber, { color: Colors[colorScheme ?? 'light'].text }]}>{followingCount}</Text>
                    <Text style={[styles.statLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Following</Text>
                  </View>
                </View>
              </View>
                        
              <View style={[styles.statCard, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
                <View style={styles.statCardContent}>
                  <View style={[styles.statIconContainer, { backgroundColor: 'rgba(255, 107, 157, 0.1)' }]}>
                    <Ionicons name="mail" size={22} color="#FF6B9D" />
                  </View>
                  <View style={styles.statTextContainer}>
                    <Text style={[styles.statNumber, { color: Colors[colorScheme ?? 'light'].text }]}>{friendRequests.length}</Text>
                    <Text style={[styles.statLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Requests</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Action Cards Grid */}
          <View style={styles.actionCardsGrid}>
            {/* Friends Card */}
            <TouchableOpacity style={styles.actionCard} onPress={handleOpenFriendsModal}>
              <LinearGradient
                colors={[Colors[colorScheme ?? 'light'].secondary, Colors[colorScheme ?? 'light'].secondaryLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionCardGradient}
              >
                <View style={styles.actionCardHeader}>
                  <Ionicons name="people" size={32} color="#fff" />
                  {(hasNewFriends || hasNewRequests) && (
                    <View style={styles.actionCardBadge}>
                      <View style={styles.actionCardBadgeDot} />
                    </View>
                  )}
                </View>
                <Text style={styles.actionCardTitle}>Friends</Text>
                <Text style={styles.actionCardSubtitle}>Manage your connections</Text>
                <View style={styles.actionCardStats}>
                  <Text style={styles.actionCardStatsText}>{friends.length} friends • {friendRequests.length} requests</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Create Event Card */}
            <TouchableOpacity style={styles.actionCard} onPress={handleCreateEvent}>
              <LinearGradient
                colors={[Colors[colorScheme ?? 'light'].primary, Colors[colorScheme ?? 'light'].accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionCardGradient}
              >
                <View style={styles.actionCardHeader}>
                  <Ionicons name="add-circle" size={32} color="#fff" />
                </View>
                <Text style={styles.actionCardTitle}>Create Event</Text>
                <Text style={styles.actionCardSubtitle}>Start something amazing</Text>
                <View style={styles.actionCardStats}>
                  <Text style={styles.actionCardStatsText}>Host your next gathering</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Profile Information Card */}
          <View style={[styles.profileInfoCard, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
            <View style={[styles.profileInfoHeader, { borderBottomColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
              <Text style={[styles.profileInfoTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Profile Information (Only visible to you)</Text>
            </View>

            <View style={styles.profileInfoContent}>
              <View style={styles.profileInfoRow}>
                <View style={styles.profileInfoIconContainer}>
                  <Ionicons name="person-outline" size={20} color={Colors[colorScheme ?? 'light'].primary} />
                </View>
                <View style={styles.profileInfoDetails}>
                  <Text style={[styles.profileInfoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Name</Text>
                  <Text style={[styles.profileInfoValue, { color: Colors[colorScheme ?? 'light'].text }]}>{profile?.name || 'Not provided'}</Text>
                </View>
              </View>

              <View style={[styles.profileInfoDivider, { backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]} />

              <View style={styles.profileInfoRow}>
                <View style={styles.profileInfoIconContainer}>
                  <Ionicons name="mail-outline" size={20} color={Colors[colorScheme ?? 'light'].secondary} />
                </View>
                <View style={styles.profileInfoDetails}>
                  <Text style={[styles.profileInfoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Email</Text>
                  <Text style={[styles.profileInfoValue, { color: Colors[colorScheme ?? 'light'].text }]}>{profile?.email || 'Not provided'}</Text>
                </View>
              </View>

              <View style={[styles.profileInfoDivider, { backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]} />

              <View style={styles.profileInfoRow}>
                <View style={styles.profileInfoIconContainer}>
                  <Ionicons name="calendar-outline" size={20} color={Colors[colorScheme ?? 'light'].accent} />
                </View>
                <View style={styles.profileInfoDetails}>
                  <Text style={[styles.profileInfoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Birthday</Text>
                  <Text style={[styles.profileInfoValue, { color: Colors[colorScheme ?? 'light'].text }]}>{profile?.birthday || 'Not provided'}</Text>
                </View>
              </View>

              <View style={[styles.profileInfoDivider, { backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]} />

              <View style={styles.profileInfoRow}>
                <View style={styles.profileInfoIconContainer}>
                  <Ionicons name="person-outline" size={20} color={Colors[colorScheme ?? 'light'].info} />
                </View>
                <View style={styles.profileInfoDetails}>
                  <Text style={[styles.profileInfoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Gender</Text>
                  <Text style={[styles.profileInfoValue, { color: Colors[colorScheme ?? 'light'].text }]}>{profile?.gender || 'Not provided'}</Text>
                </View>
              </View>
            </View>
          </View>



          {/* Legal Documents Section */}
          <View style={[styles.settingsSection, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
            <TouchableOpacity style={styles.settingsItem} onPress={handleOpenTerms}>
              <View style={styles.settingsItemContent}>
                <View style={styles.settingsIconContainer}>
                  <Ionicons name="document-text-outline" size={24} color={Colors[colorScheme ?? 'light'].secondary} />
                </View>
                <View style={styles.settingsItemDetails}>
                  <Text style={[styles.settingsItemTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Terms & Conditions</Text>
                  <Text style={[styles.settingsItemSubtitle, { color: Colors[colorScheme ?? 'light'].text }]}>View our terms of service</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors[colorScheme ?? 'light'].text} style={{ opacity: 0.5 }} />
            </TouchableOpacity>

            <View style={[styles.settingsDivider, { backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]} />

            <TouchableOpacity style={styles.settingsItem} onPress={handleOpenPrivacyPolicy}>
              <View style={styles.settingsItemContent}>
                <View style={styles.settingsIconContainer}>
                  <Ionicons name="shield-checkmark-outline" size={24} color={Colors[colorScheme ?? 'light'].secondary} />
                </View>
                <View style={styles.settingsItemDetails}>
                  <Text style={[styles.settingsItemTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Privacy Policy</Text>
                  <Text style={[styles.settingsItemSubtitle, { color: Colors[colorScheme ?? 'light'].text }]}>How we protect your data</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors[colorScheme ?? 'light'].text} style={{ opacity: 0.5 }} />
            </TouchableOpacity>
          </View>

          {/* Settings & Actions */}
          <View style={[styles.settingsSection, { backgroundColor: Colors[colorScheme ?? 'light'].card, marginTop: 16 }]}>
            <TouchableOpacity style={styles.settingsItem} onPress={handleSignOut}>
              <View style={styles.settingsItemContent}>
                <View style={styles.settingsIconContainer}>
                  <Ionicons name="log-out-outline" size={24} color={Colors[colorScheme ?? 'light'].error} />
                </View>
                <View style={styles.settingsItemDetails}>
                  <Text style={[styles.settingsItemTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Sign Out</Text>
                  <Text style={[styles.settingsItemSubtitle, { color: Colors[colorScheme ?? 'light'].text }]}>See you next time!</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors[colorScheme ?? 'light'].text} style={{ opacity: 0.5 }} />
            </TouchableOpacity>
          </View>

          {/* Danger Zone - Delete Account */}
          <View style={[styles.dangerZoneSection, { backgroundColor: Colors[colorScheme ?? 'light'].card, marginTop: 16 }]}>
            <View style={styles.dangerZoneHeader}>
              <Text style={[styles.dangerZoneTitle, { color: Colors[colorScheme ?? 'light'].error }]}>Danger Zone</Text>
            </View>
            <TouchableOpacity style={styles.dangerZoneItem} onPress={handleDeleteAccount}>
              <View style={styles.dangerZoneItemContent}>
                <View style={[styles.dangerZoneIconContainer, { backgroundColor: 'rgba(244, 67, 54, 0.1)' }]}>
                  <Ionicons name="trash" size={24} color={Colors[colorScheme ?? 'light'].error} />
                </View>
                <View style={styles.dangerZoneItemDetails}>
                  <Text style={[styles.dangerZoneItemTitle, { color: Colors[colorScheme ?? 'light'].error }]}>Delete Account</Text>
                  <Text style={[styles.dangerZoneItemSubtitle, { color: Colors[colorScheme ?? 'light'].text }]}>Permanently remove your account and all data</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors[colorScheme ?? 'light'].error} style={{ opacity: 0.5 }} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footerContainer}>
        <MainFooter activeTab="me" />
      </View>

      {/* Friends Modal */}
      <FriendsModal
        visible={friendsModalVisible}
        onClose={() => setFriendsModalVisible(false)}
        profile={profile}
        friends={friends}
        friendRequests={friendRequests}
        onFriendsUpdate={setFriends}
        onRequestsUpdate={setFriendRequests}
        onFollowCountsUpdate={refreshAllSocialCounts}
        onRefreshRequests={refreshAllSocialCounts}
      />

      {/* Legal Document Modals */}
      <LegalDocumentViewer
        visible={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        documentType="terms"
      />

      <LegalDocumentViewer
        visible={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        documentType="privacy"
      />

    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  headerContainer: {
    width: '100%',
    height: 300,
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
    height: 300,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
  },
  profileImageContainer: {
    marginTop: 60,
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
  nameContainer: {
    alignItems: 'center',
    minHeight: 40,
  },
  nameDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginRight: 8,
  },

  editButton: {
    position: 'absolute',
    top: 80,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    paddingBottom: 100, // Extra padding for footer
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  loadingContainer: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    transform: [{ translateY: -50 }],
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  loadingCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 105, 226, 0.15)',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  modernContentContainer: {
    padding: 20,
  },
  quickStatsSection: {
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statCard: {
    width: '48%', // 2 cards per row with gap
    padding: 16,
    borderRadius: 16,
    shadowColor: '#9E95BD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    minHeight: 80,
  },
  statCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statIconContainer: {
    borderRadius: 12,
    padding: 8,
    marginRight: 12,
  },
  statTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.8,
  },
  actionCardsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 15,
  },
  actionCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#9E95BD',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  actionCardGradient: {
    padding: 20,
    position: 'relative',
  },
  actionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  actionCardBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    zIndex: 10,
  },
  actionCardBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff4444',
    shadowColor: '#ff4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
    elevation: 3,
  },
  actionCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  actionCardSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  actionCardStats: {
    marginTop: 8,
  },
  actionCardStatsText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  profileInfoCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#9E95BD',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  profileInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
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
  settingsSection: {
    marginTop: 20,
    padding: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#9E95BD',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingsItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 8,
    marginRight: 12,
  },
  settingsItemDetails: {
    flex: 1,
  },
  settingsItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  settingsItemSubtitle: {
    fontSize: 14,
    opacity: 0.9,
  },
  settingsDivider: {
    height: 1,
    marginVertical: 8,
    marginHorizontal: 16,
  },
  dangerZoneSection: {
    marginTop: 20,
    padding: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#9E95BD',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.2)',
  },
  dangerZoneHeader: {
    marginBottom: 16,
  },
  dangerZoneTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  dangerZoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(244, 67, 54, 0.05)',
    borderRadius: 12,
  },
  dangerZoneItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dangerZoneIconContainer: {
    borderRadius: 12,
    padding: 8,
    marginRight: 12,
  },
  dangerZoneItemDetails: {
    flex: 1,
  },
  dangerZoneItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  dangerZoneItemSubtitle: {
    fontSize: 14,
    opacity: 0.9,
  },

}); 