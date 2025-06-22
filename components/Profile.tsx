import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, TextInput, Alert, ActivityIndicator, Animated, Easing, Modal, ScrollView, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import MainFooter from './MainFooter';
import { supabase } from '@/lib/supabase';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import GlobalDataManager, { UserProfile } from '@/lib/GlobalDataManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

type RootStackParamList = {
  '(tabs)': {
    screen?: string;
    params?: {
      updatedProfile?: UserProfile;
    };
  };
  'edit-profile': { currentProfile: UserProfile };
  'edit-images': { currentProfile: UserProfile };
  'create-event': undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Friends interfaces
interface Friend {
  friend_id: number;
  friend_name: string;
  friend_email: string;
  friendship_id: number;
  status: 'pending' | 'accepted' | 'blocked' | 'declined';
  created_at: string;
}

interface FriendRequest {
  request_id: number;
  sender_id: number;
  sender_name: string;
  sender_email: string;
  created_at: string;
}

interface SearchUser {
  user_id: number;
  name: string;
  email: string;
  friendship_status: 'pending' | 'accepted' | 'blocked' | 'declined' | null;
}

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedProfile, setEditedProfile] = useState<UserProfile | null>(null);
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
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');
  
  // Notification state for new friends/requests
  const [lastViewedFriendsCount, setLastViewedFriendsCount] = useState(0);
  const [lastViewedRequestsCount, setLastViewedRequestsCount] = useState(0);
  const [hasNewFriends, setHasNewFriends] = useState(false);
  const [hasNewRequests, setHasNewRequests] = useState(false);
  const [loading, setLoading] = useState(true);

  const dataManager = GlobalDataManager.getInstance();

  // Removed old fetchFriendsData function - now using direct fetch functions in loadInitialData

  // Initial data loading function
  const loadInitialData = async () => {
    try {
      setLoading(true);
      console.log('Starting complete data load...');
      
      // First get the user profile
      await fetchUserProfile();
      
      // Get user profile from data manager to ensure we have the ID
      const userProfile = await dataManager.getUserProfile();
      if (userProfile?.id) {
        console.log('User ID found, fetching friends data...');
        // Now fetch friends data with the confirmed user ID
        await Promise.all([
          fetchFriendsWithUserId(userProfile.id),
          fetchFriendRequestsWithUserId(userProfile.id)
        ]);
        console.log('All data loaded successfully');
      } else {
        console.log('No user ID found, skipping friends data');
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Direct friends fetching with user ID (for initial load)
  const fetchFriendsWithUserId = async (userId: number) => {
    try {
      const { data, error } = await supabase.rpc('get_user_friends', {
        target_user_id: userId
      });
      if (error) throw error;
      setFriends(data || []);
      console.log('Friends loaded:', data?.length || 0);
    } catch (error) {
      console.error('Error fetching friends with user ID:', error);
    }
  };

  // Direct friend requests fetching with user ID (for initial load)
  const fetchFriendRequestsWithUserId = async (userId: number) => {
    try {
      const { data, error } = await supabase.rpc('get_pending_friend_requests', {
        target_user_id: userId
      });
      if (error) throw error;
      setFriendRequests(data || []);
      console.log('Friend requests loaded:', data?.length || 0);
    } catch (error) {
      console.error('Error fetching friend requests with user ID:', error);
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
      setEditedProfile(user);
    } catch (error) {
      console.error('Profile component: Error in fetchUserProfile:', error);
    }
  };

  useEffect(() => {
    loadInitialData();
    loadNotificationState();
  }, []);

  // Update notification state when friends or requests change
  useEffect(() => {
    updateNotificationState();
  }, [friends.length, friendRequests.length, lastViewedFriendsCount, lastViewedRequestsCount]);

  // Removed: No longer fetch friends data after component is visible
  // All data is loaded during initial loading phase

  // Removed automatic refresh on focus to prevent visible updates when switching tabs
  // Data is loaded once during initial mount and updated only through user actions

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



  const handleSignOut = async () => {
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
    }
  };

  const handleEditImages = () => {
    if (editedProfile) {
      navigation.navigate('edit-images', { currentProfile: editedProfile });
    }
  };

  const handleEditProfile = () => {
    if (editedProfile) {
      navigation.navigate('edit-profile', { currentProfile: editedProfile });
    }
  };

  const handleCreateEvent = () => {
    navigation.navigate('create-event');
  };

  // Friends functionality
  const fetchFriends = async (showLoading: boolean = true) => {
    if (!profile?.id) return;
    
    try {
      if (showLoading) setFriendsLoading(true);
      const { data, error } = await supabase.rpc('get_user_friends', {
        target_user_id: profile.id
      });

      if (error) throw error;
      setFriends(data || []);
    } catch (error) {
      console.error('Error fetching friends:', error);
      if (showLoading) Alert.alert('Error', 'Failed to load friends');
    } finally {
      if (showLoading) setFriendsLoading(false);
    }
  };

  const fetchFriendRequests = async (showLoading: boolean = true) => {
    if (!profile?.id) return;
    
    try {
      if (showLoading) setFriendsLoading(true);
      const { data, error } = await supabase.rpc('get_pending_friend_requests', {
        target_user_id: profile.id
      });

      if (error) throw error;
      setFriendRequests(data || []);
    } catch (error) {
      console.error('Error fetching friend requests:', error);
      if (showLoading) Alert.alert('Error', 'Failed to load friend requests');
    } finally {
      if (showLoading) setFriendsLoading(false);
    }
  };

  const searchUsers = async (query: string) => {
    if (!profile?.id || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    
    try {
      setFriendsLoading(true);
      const { data, error } = await supabase.rpc('search_users_for_friends', {
        searcher_id: profile.id,
        search_query: query.trim(),
        limit_count: 10
      });

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching users:', error);
      Alert.alert('Error', 'Failed to search users');
    } finally {
      setFriendsLoading(false);
    }
  };

  const sendFriendRequest = async (receiverId: number) => {
    if (!profile?.id) return;
    
    try {
      const { data, error } = await supabase.rpc('send_friend_request', {
        sender_id: profile.id,
        receiver_id: receiverId
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string };
      if (result.success) {
        Alert.alert('Success', result.message);
        // Refresh search results to update button states
        if (searchQuery.trim().length >= 2) {
          searchUsers(searchQuery);
        }
        // Refresh friends list if request was accepted automatically
        fetchFriends(false); // Background refresh since user is still in search tab
      } else {
        Alert.alert('Info', result.message);
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', 'Failed to send friend request');
    }
  };

  const respondToFriendRequest = async (requestId: number, response: 'accepted' | 'declined' | 'blocked') => {
    try {
      const { data, error } = await supabase.rpc('respond_to_friend_request', {
        request_id: requestId,
        response: response
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string };
      if (result.success) {
        Alert.alert('Success', result.message);
        // Refresh both friend requests and friends lists with loading
        fetchFriendRequests(true);
        fetchFriends(true);
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      console.error('Error responding to friend request:', error);
      Alert.alert('Error', 'Failed to respond to friend request');
    }
  };

  const removeFriend = async (friendId: number) => {
    if (!profile?.id) return;
    
    Alert.alert(
      'Remove Friend',
      'Are you sure you want to remove this friend?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data, error } = await supabase.rpc('remove_friend', {
                user_id: profile.id,
                friend_id: friendId
              });

              if (error) throw error;

              const result = data as { success: boolean; message: string };
              if (result.success) {
                Alert.alert('Success', result.message);
                fetchFriends(true); // Show loading since user initiated this action
              } else {
                Alert.alert('Error', result.message);
              }
            } catch (error) {
              console.error('Error removing friend:', error);
              Alert.alert('Error', 'Failed to remove friend');
            }
          }
        }
      ]
    );
  };

  const handleOpenFriendsModal = () => {
    setFriendsModalVisible(true);
    setActiveTab('friends');
    // Only refresh friends data when user explicitly opens the modal
    // This ensures fresh data for user interactions without affecting tab switching
    console.log('Refreshing friends data for modal interaction...');
    fetchFriends(true);
    fetchFriendRequests(true);
    // Mark friends as viewed when opening modal (defaults to friends tab)
    setTimeout(() => markFriendsAsViewed(), 500);
  };

  // Handle tab switching and mark as viewed
  const handleTabSwitch = (tab: 'friends' | 'requests' | 'search') => {
    setActiveTab(tab);
    
    // Mark as viewed when switching to tabs
    if (tab === 'friends') {
      setTimeout(() => markFriendsAsViewed(), 200);
    } else if (tab === 'requests') {
      setTimeout(() => markRequestsAsViewed(), 200);
    }
  };

  const handleSaveImages = async () => {
    console.log("uyfedycgv")
    if (editedProfile) {
      console.log("HERE????")
      try {
        // Get the current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('No authenticated user found');
          Alert.alert('Error', 'You must be logged in to update your profile');
          return;
        }

        console.log('Current user:', user.email);
        let profileImageUrl = editedProfile.profileImage;
        let bannerImageUrl = editedProfile.bannerImage;

        // Upload profile image if it's a new local URI
        if (editedProfile.profileImage?.startsWith('file://')) {
          try {
            console.log('Uploading profile image...');
            const profileImagePath = `${user.id}/profile-${Date.now()}.jpg`;
            
            // Convert URI to blob
            const response = await fetch(editedProfile.profileImage);
            const blob = await response.blob();
            
            const { data: profileData, error: profileError } = await supabase.storage
              .from('user-images')
              .upload(profileImagePath, blob, {
                contentType: 'image/jpeg',
                upsert: true
              });

            if (profileError) {
              console.error('Profile image upload error:', profileError);
              throw profileError;
            }

            console.log('Profile image uploaded successfully');

            // Get public URL for profile image
            const { data: { publicUrl: profilePublicUrl } } = supabase.storage
              .from('user-images')
              .getPublicUrl(profileImagePath);
            
            profileImageUrl = profilePublicUrl;
            console.log('Profile image URL:', profileImageUrl);
          } catch (error) {
            console.error('Error uploading profile image:', error);
            Alert.alert('Error', 'Failed to upload profile image');
            return;
          }
        }

        // Upload banner image if it's a new local URI
        if (editedProfile.bannerImage?.startsWith('file://')) {
          try {
            console.log('Uploading banner image...');
            const bannerImagePath = `${user.id}/banner-${Date.now()}.jpg`;
            
            // Convert URI to blob
            const response = await fetch(editedProfile.bannerImage);
            const blob = await response.blob();

            console.log("BLOB:  ", blob)
            
            const { data: bannerData, error: bannerError } = await supabase.storage
              .from('user-images')
              .upload(bannerImagePath, blob, {
                contentType: 'image/jpeg',
                upsert: true
              });

            if (bannerError) {
              console.error('Banner image upload error:', bannerError);
              throw bannerError;
            }

            console.log('Banner image uploaded successfully');

            // Get public URL for banner image
            const { data: { publicUrl: bannerPublicUrl } } = supabase.storage
              .from('user-images')
              .getPublicUrl(bannerImagePath);
            
            bannerImageUrl = bannerPublicUrl;
            console.log('Banner image URL:', bannerImageUrl);
          } catch (error) {
            console.error('Error uploading banner image:', error);
            Alert.alert('Error', 'Failed to upload banner image');
            return;
          }
        }

        // Update user profile in database
        console.log('Updating profile in database...');
        const { data: updateData, error: updateError } = await supabase
          .from('all_users')
          .update({
            profile_image: profileImageUrl,
            banner_image: bannerImageUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('email', user.email)
          .select();

        if (updateError) {
          console.error('Profile update error:', updateError);
          throw updateError;
        }

        console.log('Profile updated successfully:', updateData);

        // Update local state with the returned data
        const updatedProfile = {
          ...editedProfile,
          profileImage: profileImageUrl,
          bannerImage: bannerImageUrl,
        };

        // Update both profile states immediately
        setProfile(updatedProfile);
        setEditedProfile(updatedProfile);
        setIsEditMode(false);

        // Refresh GlobalDataManager to update cached data
        await dataManager.refreshAllData();

        Alert.alert('Success', 'Profile images updated successfully!');
      } catch (error) {
        console.error('Error saving images:', error);
        Alert.alert('Error', 'Failed to save images. Please try again.');
      }
    }
  };

  const handleCancelImages = () => {
    setEditedProfile(profile);
    setIsEditMode(false);
  };

  const pickImage = async (type: 'profile' | 'banner') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'profile' ? [1, 1] : [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        console.log(`Selected ${type} image:`, imageUri);
        if (editedProfile) {
          setEditedProfile({
            ...editedProfile,
            [type === 'profile' ? 'profileImage' : 'bannerImage']: imageUri
          });
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const renderInfoRow = (icon: string, label: string, value: string, showEditButton: boolean = false) => (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={24} color={colorScheme === 'dark' ? '#aaa' : '#666'} />
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>{value}</Text>
      </View>
      {showEditButton && (
        <TouchableOpacity onPress={handleEditProfile} style={styles.editInfoButton}>
          <Ionicons name="pencil" size={20} color={Colors[colorScheme ?? 'light'].text} />
        </TouchableOpacity>
      )}
    </View>
  );

  // Remove collapsible header animations - banner will scroll normally

  if (loading) {
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
                borderColor: '#9E95BD',
              },
            ]}
          >
            <View style={styles.innerCircle} />
          </Animated.View>
          <Text style={[styles.loadingText, { color: Colors[colorScheme ?? 'light'].text, marginTop: 20 }]}>
            Loading profile and friends...
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
          {editedProfile?.bannerImage && (
            <Image 
              source={{ uri: editedProfile.bannerImage }} 
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
            <TouchableOpacity style={styles.editButton} onPress={handleEditImages}>
              <Ionicons name="images" size={24} color="#fff" />
            </TouchableOpacity>
            {isEditMode && (
              <TouchableOpacity style={styles.bannerEditButton} onPress={() => pickImage('banner')}>
                <Ionicons name="image" size={24} color="#fff" />
              </TouchableOpacity>
            )}
            <View style={styles.profileImageContainer}>
              <View style={styles.profileImageWrapper}>
                {editedProfile?.profileImage ? (
                  <Image 
                    source={{ uri: editedProfile.profileImage }} 
                    style={styles.profileImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.profileImage, styles.placeholderImage]}>
                    <Ionicons name="person" size={50} color="#fff" />
                  </View>
                )}
                {isEditMode && (
                  <TouchableOpacity style={styles.uploadButton} onPress={() => pickImage('profile')}>
                    <Ionicons name="camera" size={24} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <Text style={styles.name}>{editedProfile?.name}</Text>
          </LinearGradient>
        </View>

        {/* Modern Content Container */}
        <View style={styles.modernContentContainer}>
          {/* Quick Stats Section */}
                     <View style={styles.quickStatsSection}>
             <View style={[styles.statCard, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
               <View style={[styles.statIconContainer, { backgroundColor: 'rgba(158, 149, 189, 0.1)' }]}>
                 <Ionicons name="people" size={24} color="#9E95BD" />
               </View>
               <Text style={[styles.statNumber, { color: Colors[colorScheme ?? 'light'].text }]}>{friends.length}</Text>
               <Text style={[styles.statLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Friends</Text>
             </View>
             
             <View style={[styles.statCard, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
               <View style={[styles.statIconContainer, { backgroundColor: 'rgba(255, 107, 157, 0.1)' }]}>
                 <Ionicons name="calendar" size={24} color="#FF6B9D" />
               </View>
               <Text style={[styles.statNumber, { color: Colors[colorScheme ?? 'light'].text }]}>0</Text>
               <Text style={[styles.statLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Events</Text>
             </View>
             
             <View style={[styles.statCard, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
               <View style={[styles.statIconContainer, { backgroundColor: 'rgba(78, 205, 196, 0.1)' }]}>
                 <Ionicons name="mail" size={24} color="#4ECDC4" />
               </View>
               <Text style={[styles.statNumber, { color: Colors[colorScheme ?? 'light'].text }]}>{friendRequests.length}</Text>
               <Text style={[styles.statLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Requests</Text>
             </View>
           </View>

          {/* Action Cards Grid */}
          <View style={styles.actionCardsGrid}>
            {/* Friends Card */}
            <TouchableOpacity style={styles.actionCard} onPress={handleOpenFriendsModal}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
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
                colors={['#f093fb', '#f5576c']}
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
               <Text style={[styles.profileInfoTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Profile Information</Text>
               <TouchableOpacity style={styles.profileEditButton} onPress={handleEditProfile}>
                 <Ionicons name="pencil" size={20} color="#9E95BD" />
               </TouchableOpacity>
             </View>
             
             <View style={styles.profileInfoContent}>
              <View style={styles.profileInfoRow}>
                <View style={styles.profileInfoIconContainer}>
                  <Ionicons name="mail-outline" size={20} color="#9E95BD" />
                </View>
                <View style={styles.profileInfoDetails}>
                  <Text style={[styles.profileInfoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Email</Text>
                  <Text style={[styles.profileInfoValue, { color: Colors[colorScheme ?? 'light'].text }]}>{editedProfile?.email || 'Not provided'}</Text>
                </View>
              </View>

              <View style={[styles.profileInfoDivider, { backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]} />

              <View style={styles.profileInfoRow}>
                <View style={styles.profileInfoIconContainer}>
                  <Ionicons name="calendar-outline" size={20} color="#FF6B9D" />
                </View>
                <View style={styles.profileInfoDetails}>
                  <Text style={[styles.profileInfoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Birthday</Text>
                  <Text style={[styles.profileInfoValue, { color: Colors[colorScheme ?? 'light'].text }]}>{editedProfile?.birthday || 'Not provided'}</Text>
                </View>
              </View>

              <View style={[styles.profileInfoDivider, { backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]} />

              <View style={styles.profileInfoRow}>
                <View style={styles.profileInfoIconContainer}>
                  <Ionicons name="person-outline" size={20} color="#4ECDC4" />
                </View>
                <View style={styles.profileInfoDetails}>
                  <Text style={[styles.profileInfoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Gender</Text>
                  <Text style={[styles.profileInfoValue, { color: Colors[colorScheme ?? 'light'].text }]}>{editedProfile?.gender || 'Not provided'}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Edit Mode Actions */}
          {isEditMode && (
            <View style={styles.editModeCard}>
              <View style={styles.editModeHeader}>
                <Text style={[styles.editModeTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Edit Images</Text>
              </View>
              <View style={styles.editModeActions}>
                <TouchableOpacity style={styles.modernSaveButton} onPress={handleSaveImages}>
                  <LinearGradient
                    colors={['#4CAF50', '#45a049']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.modernSaveButtonGradient}
                  >
                    <Ionicons name="checkmark" size={24} color="#fff" style={styles.modernButtonIcon} />
                    <Text style={styles.modernSaveButtonText}>Save Changes</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modernCancelButton} onPress={handleCancelImages}>
                  <LinearGradient
                    colors={['#f44336', '#e53935']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.modernCancelButtonGradient}
                  >
                    <Ionicons name="close" size={24} color="#fff" style={styles.modernButtonIcon} />
                    <Text style={styles.modernCancelButtonText}>Cancel</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Settings & Actions */}
          <View style={[styles.settingsSection, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
            <TouchableOpacity style={styles.settingsItem} onPress={handleSignOut}>
              <View style={styles.settingsItemContent}>
                <View style={styles.settingsIconContainer}>
                  <Ionicons name="log-out-outline" size={24} color="#ff6b6b" />
                </View>
                <View style={styles.settingsItemDetails}>
                  <Text style={[styles.settingsItemTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Sign Out</Text>
                  <Text style={[styles.settingsItemSubtitle, { color: Colors[colorScheme ?? 'light'].text }]}>See you next time!</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors[colorScheme ?? 'light'].text} style={{ opacity: 0.5 }} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footerContainer}>
        <MainFooter activeTab="me" />
      </View>

      {/* Friends Modal */}
      <Modal
        visible={friendsModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFriendsModalVisible(false)}
      >
        <SafeAreaView style={[styles.friendsModalContainer, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
          <View style={styles.friendsModalHeader}>
            <Text style={[styles.friendsModalTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Friends</Text>
            <TouchableOpacity onPress={() => setFriendsModalVisible(false)}>
              <Ionicons name="close" size={24} color={Colors[colorScheme ?? 'light'].text} />
            </TouchableOpacity>
          </View>

          {/* Tab Navigation */}
          <View style={styles.friendsTabContainer}>
            <TouchableOpacity
              style={[styles.friendsTab, activeTab === 'friends' && styles.friendsTabActive]}
              onPress={() => handleTabSwitch('friends')}
            >
              <View style={styles.tabIconContainer}>
                <Ionicons 
                  name="people" 
                  size={24} 
                  color={activeTab === 'friends' ? '#fff' : Colors[colorScheme ?? 'light'].text} 
                />
                {hasNewFriends && activeTab !== 'friends' && (
                  <View style={styles.tabNotificationBubble}>
                    <View style={styles.tabNotificationDot} />
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.friendsTab, activeTab === 'requests' && styles.friendsTabActive]}
              onPress={() => handleTabSwitch('requests')}
            >
              <View style={styles.tabIconContainer}>
                <Ionicons 
                  name="mail" 
                  size={24} 
                  color={activeTab === 'requests' ? '#fff' : Colors[colorScheme ?? 'light'].text} 
                />
                {friendRequests.length > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{friendRequests.length}</Text>
                  </View>
                )}
                {hasNewRequests && activeTab !== 'requests' && (
                  <View style={styles.tabNotificationBubble}>
                    <View style={styles.tabNotificationDot} />
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.friendsTab, activeTab === 'search' && styles.friendsTabActive]}
              onPress={() => handleTabSwitch('search')}
            >
              <View style={styles.tabIconContainer}>
                <Ionicons 
                  name="person-add" 
                  size={24} 
                  color={activeTab === 'search' ? '#fff' : Colors[colorScheme ?? 'light'].text} 
                />
              </View>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          <View style={styles.friendsContent}>
            {activeTab === 'friends' && (
              <ScrollView style={styles.friendsList}>
                {friendsLoading ? (
                  <ActivityIndicator size="large" color="#FF0005" style={styles.friendsLoader} />
                ) : friends.length === 0 ? (
                  <View style={styles.emptyFriendsContainer}>
                    <Ionicons name="people-outline" size={64} color={Colors[colorScheme ?? 'light'].text} />
                    <Text style={[styles.emptyFriendsText, { color: Colors[colorScheme ?? 'light'].text }]}>
                      No friends yet
                    </Text>
                    <Text style={[styles.emptyFriendsSubtext, { color: Colors[colorScheme ?? 'light'].text }]}>
                      Search for people to add as friends
                    </Text>
                  </View>
                ) : (
                  friends.map((friend) => (
                    <View key={friend.friendship_id} style={[styles.friendItem, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
                      <View style={styles.friendInfo}>
                        <View style={styles.friendAvatar}>
                          <Image 
                            source={{ 
                              uri: `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/user-images/${friend.friend_email.replace('@', '_').replace(/\./g, '_')}/profile.jpg` 
                            }}
                            style={styles.friendAvatarImage}
                            defaultSource={require('../assets/images/icon.png')}
                            onError={() => {
                              console.log(`Failed to load profile image for friend ${friend.friend_email}`);
                            }}
                          />
                        </View>
                        <View style={styles.friendDetails}>
                          <Text style={[styles.friendName, { color: Colors[colorScheme ?? 'light'].text }]}>
                            {friend.friend_name}
                          </Text>
                          <Text style={[styles.friendEmail, { color: Colors[colorScheme ?? 'light'].text }]}>
                            {friend.friend_email}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.removeFriendButton}
                        onPress={() => removeFriend(friend.friend_id)}
                      >
                        <Ionicons name="person-remove" size={20} color="#ff4444" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </ScrollView>
            )}

            {activeTab === 'requests' && (
              <ScrollView style={styles.friendsList}>
                {friendsLoading ? (
                  <ActivityIndicator size="large" color="#FF0005" style={styles.friendsLoader} />
                ) : friendRequests.length === 0 ? (
                  <View style={styles.emptyFriendsContainer}>
                    <Ionicons name="mail-outline" size={64} color={Colors[colorScheme ?? 'light'].text} />
                    <Text style={[styles.emptyFriendsText, { color: Colors[colorScheme ?? 'light'].text }]}>
                      No friend requests
                    </Text>
                  </View>
                ) : (
                  friendRequests.map((request) => (
                    <View key={request.request_id} style={[styles.friendItem, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
                      <View style={styles.friendInfo}>
                        <View style={styles.friendAvatar}>
                          <Image 
                            source={{ 
                              uri: `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/user-images/${request.sender_email.replace('@', '_').replace(/\./g, '_')}/profile.jpg` 
                            }}
                            style={styles.friendAvatarImage}
                            defaultSource={require('../assets/images/icon.png')}
                            onError={() => {
                              console.log(`Failed to load profile image for request sender ${request.sender_email}`);
                            }}
                          />
                        </View>
                        <View style={styles.friendDetails}>
                          <Text style={[styles.friendName, { color: Colors[colorScheme ?? 'light'].text }]}>
                            {request.sender_name}
                          </Text>
                          <Text style={[styles.friendEmail, { color: Colors[colorScheme ?? 'light'].text }]}>
                            {request.sender_email}
                          </Text>
                          <View style={styles.friendDateContainer}>
                            <Ionicons name="time-outline" size={12} color="#9E95BD" />
                            <Text style={[styles.friendDateText, { color: Colors[colorScheme ?? 'light'].text }]}>
                              Sent {new Date(request.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.requestActions}>
                        <TouchableOpacity
                          style={styles.acceptButton}
                          onPress={() => respondToFriendRequest(request.request_id, 'accepted')}
                        >
                          <Ionicons name="checkmark" size={18} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.declineButton}
                          onPress={() => respondToFriendRequest(request.request_id, 'declined')}
                        >
                          <Ionicons name="close" size={18} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            )}

            {activeTab === 'search' && (
              <View style={styles.searchContainer}>
                <View style={styles.searchInputContainer}>
                  <Ionicons name="search" size={20} color={Colors[colorScheme ?? 'light'].text} />
                  <TextInput
                    style={[styles.searchInput, { color: Colors[colorScheme ?? 'light'].text }]}
                    placeholder="Search by name or email..."
                    placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
                    value={searchQuery}
                    onChangeText={(text) => {
                      setSearchQuery(text);
                      searchUsers(text);
                    }}
                  />
                </View>
                <ScrollView style={styles.searchResults}>
                  {friendsLoading ? (
                    <ActivityIndicator size="large" color="#FF0005" style={styles.friendsLoader} />
                  ) : searchResults.length === 0 ? (
                    searchQuery.trim().length >= 2 ? (
                      <View style={styles.emptyFriendsContainer}>
                        <Ionicons name="search-outline" size={64} color={Colors[colorScheme ?? 'light'].text} />
                        <Text style={[styles.emptyFriendsText, { color: Colors[colorScheme ?? 'light'].text }]}>
                          No users found
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.emptyFriendsContainer}>
                        <Ionicons name="search-outline" size={64} color={Colors[colorScheme ?? 'light'].text} />
                        <Text style={[styles.emptyFriendsText, { color: Colors[colorScheme ?? 'light'].text }]}>
                          Search for friends
                        </Text>
                        <Text style={[styles.emptyFriendsSubtext, { color: Colors[colorScheme ?? 'light'].text }]}>
                          Type at least 2 characters to search
                        </Text>
                      </View>
                    )
                  ) : (
                    searchResults.map((user) => (
                      <View key={user.user_id} style={[styles.friendItem, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
                        <View style={styles.friendInfo}>
                          <View style={styles.friendAvatar}>
                            <Image 
                              source={{ 
                                uri: `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/user-images/${user.email.replace('@', '_').replace(/\./g, '_')}/profile.jpg` 
                              }}
                              style={styles.friendAvatarImage}
                              defaultSource={require('../assets/images/icon.png')}
                              onError={() => {
                                console.log(`Failed to load profile image for user ${user.email}`);
                              }}
                            />
                          </View>
                          <View style={styles.friendDetails}>
                            <Text style={[styles.friendName, { color: Colors[colorScheme ?? 'light'].text }]}>
                              {user.name}
                            </Text>
                            <Text style={[styles.friendEmail, { color: Colors[colorScheme ?? 'light'].text }]}>
                              {user.email}
                            </Text>
                            <View style={styles.friendDateContainer}>
                              <Ionicons 
                                name={user.friendship_status === 'accepted' ? 'checkmark-circle-outline' : 
                                      user.friendship_status === 'pending' ? 'time-outline' : 'person-add-outline'} 
                                size={12} 
                                color="#9E95BD" 
                              />
                              <Text style={[styles.friendDateText, { color: Colors[colorScheme ?? 'light'].text }]}>
                                {user.friendship_status === 'accepted' ? 'Already friends' :
                                 user.friendship_status === 'pending' ? 'Request pending' : 'Available to add'}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.addFriendButton,
                            user.friendship_status === 'pending' && styles.addFriendButtonPending,
                            user.friendship_status === 'accepted' && styles.addFriendButtonAccepted
                          ]}
                          onPress={() => sendFriendRequest(user.user_id)}
                          disabled={user.friendship_status !== null}
                        >
                          {user.friendship_status === null && (
                            <Ionicons name="person-add" size={18} color="#fff" />
                          )}
                          {user.friendship_status === 'pending' && (
                            <Ionicons name="hourglass" size={18} color="#fff" />
                          )}
                          {user.friendship_status === 'accepted' && (
                            <Ionicons name="checkmark" size={18} color="#fff" />
                          )}
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </ScrollView>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

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
  bannerEditButton: {
    position: 'absolute',
    top: 20,
    right: 70,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
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
  uploadButton: {
    position: 'absolute',
    bottom: -10,
    right: -10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
    zIndex: 1,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    paddingBottom: 100, // Extra padding for footer
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  infoContent: {
    marginLeft: 15,
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  editInfoButton: {
    padding: 8,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    paddingHorizontal: 20,
  },
  saveButton: {
    flex: 1,
    marginRight: 10,
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 3,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  cancelButton: {
    flex: 1,
    marginLeft: 10,
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 3,
  },
  cancelButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  buttonIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  createEventButton: {
    marginTop: 10,
    marginBottom: 20,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#FF0005',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  createEventGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  createEventText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  signOutButton: {
    marginTop: 5,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#FF0005',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  signOutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  signOutText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  loadingCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#F45B5B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 20, 147, 0.1)',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  // Friends styles
  friendsButton: {
    marginTop: 20,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  friendsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    position: 'relative',
  },
  friendsText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  friendRequestBadge: {
    position: 'absolute',
    top: -5,
    right: 10,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendRequestBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Friends Modal styles
  friendsModalContainer: {
    flex: 1,
  },
  friendsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  friendsModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  friendsTabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  friendsTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginHorizontal: 5,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  friendsTabActive: {
    backgroundColor: '#9E95BD',
  },
  friendsTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadge: {
    position: 'absolute',
    top: -8,
    right: -12,
    backgroundColor: '#9E95BD',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#9E95BD',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  tabBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  friendsContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  friendsList: {
    flex: 1,
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  friendsLoader: {
    marginTop: 50,
  },
  emptyFriendsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyFriendsText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  emptyFriendsSubtext: {
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
    opacity: 0.7,
  },
  friendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 4,
    borderRadius: 16,
    shadowColor: '#9E95BD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(158, 149, 189, 0.1)',
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#9E95BD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#9E95BD',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  friendEmail: {
    fontSize: 14,
    opacity: 0.8,
    fontWeight: '500',
  },
  friendDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  friendDateText: {
    fontSize: 12,
    opacity: 0.7,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  removeFriendButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptButton: {
    backgroundColor: '#9E95BD',
    borderRadius: 20,
    padding: 10,
    minWidth: 36,
    alignItems: 'center',
    shadowColor: '#9E95BD',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  declineButton: {
    backgroundColor: '#ff4444',
    borderRadius: 20,
    padding: 10,
    minWidth: 36,
    alignItems: 'center',
    shadowColor: '#ff4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  addFriendButton: {
    backgroundColor: '#9E95BD',
    borderRadius: 20,
    padding: 10,
    minWidth: 36,
    alignItems: 'center',
    shadowColor: '#9E95BD',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  addFriendButtonPending: {
    backgroundColor: '#FFA500',
  },
  addFriendButtonAccepted: {
    backgroundColor: '#888',
  },
  searchContainer: {
    flex: 1,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 15,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },
  searchResults: {
    flex: 1,
  },
  // Notification bubble styles
  newNotificationBubble: {
    position: 'absolute',
    top: 5,
    right: 5,
    zIndex: 10,
  },
  newNotificationDot: {
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
  tabNotificationBubble: {
    position: 'absolute',
    top: -4,
    right: -4,
    zIndex: 10,
  },
  tabNotificationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ff4444',
    shadowColor: '#ff4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 2,
  },
  // New profile layout styles
  friendsSection: {
    marginTop: 20,
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    opacity: 0.9,
  },
  friendsOverviewCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#9E95BD',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  friendsOverviewGradient: {
    padding: 20,
    position: 'relative',
  },
  friendsOverviewContent: {
    alignItems: 'center',
  },
  friendsStatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  friendsStat: {
    alignItems: 'center',
    flex: 1,
  },
  friendsStatNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  friendsStatLabel: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginTop: 4,
  },
  friendsStatDivider: {
    width: 1,
    height: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 20,
  },
  recentFriendsContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  recentFriendsTitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 12,
    opacity: 0.9,
  },
  recentFriendsAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recentFriendAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#9E95BD',
  },
  moreIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  moreIndicatorText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#9E95BD',
  },
  friendsActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  friendsActionText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
    opacity: 0.9,
  },
  userInfoSection: {
    marginBottom: 15,
  },
  infoGrid: {
    backgroundColor: 'rgba(158, 149, 189, 0.05)',
    borderRadius: 16,
    padding: 16,
  },
  actionButtonsContainer: {
    gap: 10,
    marginTop: 10,
  },
  contentPadding: {
    padding: 20,
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
  profileEditButton: {
    padding: 8,
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
  // Edit Mode Styles
  editModeCard: {
    marginTop: 20,
    backgroundColor: 'rgba(244, 91, 91, 0.1)',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#f45b5b',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(244, 91, 91, 0.2)',
  },
  editModeHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(244, 91, 91, 0.2)',
  },
  editModeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  editModeActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    gap: 15,
  },
  modernSaveButton: {
    flex: 1,
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 3,
  },
  modernSaveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  modernCancelButton: {
    flex: 1,
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 3,
  },
  modernCancelButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  modernButtonIcon: {
    marginRight: 8,
  },
  modernSaveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modernCancelButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  
  // Friend Avatar Image Styles
  friendAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  friendAvatarFallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(158, 149, 189, 0.8)',
    borderRadius: 24,
  },
}); 