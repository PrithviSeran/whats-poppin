import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Modal, ScrollView, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import GlobalDataManager from '@/lib/GlobalDataManager';

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
  location?: string;
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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [relationshipLoading, setRelationshipLoading] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [friendshipStatus, setFriendshipStatus] = useState<'accepted' | 'pending' | 'incoming' | 'none'>('none');
  const [isFollowing, setIsFollowing] = useState(false);
  const colorScheme = useColorScheme();
  const dataManager = GlobalDataManager.getInstance();

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

      setUserProfile(userProfile);

    } catch (error) {
      console.error('Error fetching user profile:', error);
      Alert.alert('Error', 'Failed to load user profile');
    } finally {
      setLoading(false);
    }
  };



  const fetchCurrentUserProfile = async () => {
    try {
      const profile = await dataManager.getUserProfile();
      setCurrentUserProfile(profile);
    } catch (error) {
      console.error('Error fetching current user profile:', error);
    }
  };

  const fetchRelationshipStatus = async () => {
    if (!currentUserProfile?.email || !currentUserProfile?.id) {
      console.log('Missing current user profile data for relationship check');
      return;
    }
    
    console.log(`Checking relationship status between ${currentUserProfile.email} and ${userEmail}`);
    setRelationshipLoading(true);
    
    try {
      // Check both friendship and follow status
      const { data: statusData, error: statusError } = await supabase.rpc('check_follow_status', {
        follower_email: currentUserProfile.email,
        following_email: userEmail
      });

      if (statusError) {
        console.error('Error in check_follow_status RPC:', statusError);
        // Continue with manual checks if RPC fails
      }

      if (statusData && statusData.length > 0) {
        const status = statusData[0]; // Get first row of results
        console.log('Follow status data:', status);
        setIsFollowing(status.is_following);
        
        if (status.is_friend) {
          console.log('Users are already friends');
          setFriendshipStatus('accepted');
          return;
        } else if (status.friendship_status === 'pending') {
          console.log('Friend request is pending');
          setFriendshipStatus('pending');
          return;
        }
      }

      // Check if there's an incoming friend request (sent by the viewed user to current user)
      console.log('Checking for incoming friend requests...');
      const { data: incomingRequest, error: incomingError } = await supabase
        .from('friend_requests')
        .select('id, status, created_at')
        .eq('sender_id', userId)
        .eq('receiver_id', currentUserProfile.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (incomingError) {
        console.error('Error checking incoming requests:', incomingError);
      }

      if (incomingRequest) {
        console.log('Found incoming friend request:', incomingRequest);
        setFriendshipStatus('incoming');
      } else {
        // Double-check if we missed a sent request (current user sent to viewed user)
        const { data: sentRequest, error: sentError } = await supabase
          .from('friend_requests')
          .select('id, status, created_at')
          .eq('sender_id', currentUserProfile.id)
          .eq('receiver_id', userId)
          .eq('status', 'pending')
          .maybeSingle();

        if (sentError) {
          console.error('Error checking sent requests:', sentError);
        }

        if (sentRequest) {
          console.log('Found sent friend request:', sentRequest);
          setFriendshipStatus('pending');
        } else {
          console.log('No friend relationship found - setting to none');
          setFriendshipStatus('none');
        }
      }

      // Set follow status if RPC didn't work
      if (!statusData || statusData.length === 0) {
        console.log('RPC failed, checking follow status manually...');
        const { data: followData, error: followError } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', currentUserProfile.id)
          .eq('followed_id', userId)
          .maybeSingle();

        if (!followError && followData) {
          setIsFollowing(true);
        } else {
          setIsFollowing(false);
        }
      }

    } catch (error) {
      console.error('Error fetching relationship status:', error);
      // Set default states on error
      setFriendshipStatus('none');
      setIsFollowing(false);
    } finally {
      setRelationshipLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!currentUserProfile?.email) return;
    
    try {
      console.log('Attempting to follow user:', {
        follower_email: currentUserProfile.email,
        target_email: userEmail
      });

      const { data, error } = await supabase.rpc('follow_user', {
        follower_email: currentUserProfile.email,
        target_email: userEmail
      });

      console.log('Follow user response:', { data, error });

      if (error) throw error;

      // Handle both array and object responses
      const result = Array.isArray(data) ? data[0] : data;
      console.log('Processed result:', result);

      if (result && result.success) {
        setIsFollowing(true);
        Alert.alert('Success', result.message || 'Successfully followed user');
      } else {
        const message = result?.message || 'Unable to follow user - already following or other issue';
        Alert.alert('Info', message);
      }
    } catch (error) {
      console.error('Error following user:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', `Failed to follow user: ${errorMessage}`);
    }
  };

  const handleUnfollow = async () => {
    if (!currentUserProfile?.email) return;
    
    try {
      console.log('Attempting to unfollow user:', {
        follower_email: currentUserProfile.email,
        target_email: userEmail
      });

      const { data, error } = await supabase.rpc('unfollow_user', {
        follower_email: currentUserProfile.email,
        target_email: userEmail
      });

      console.log('Unfollow user response:', { data, error });

      if (error) throw error;

      // Handle both array and object responses
      const result = Array.isArray(data) ? data[0] : data;
      console.log('Processed result:', result);

      if (result && result.success) {
        setIsFollowing(false);
        Alert.alert('Success', result.message || 'Successfully unfollowed user');
      } else {
        const message = result?.message || 'Unable to unfollow user - not following or other issue';
        Alert.alert('Info', message);
      }
    } catch (error) {
      console.error('Error unfollowing user:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', `Failed to unfollow user: ${errorMessage}`);
    }
  };

  const handleFriendRequest = async () => {
    if (!currentUserProfile?.email) return;
    
    try {
      const { data, error } = await supabase.rpc('send_friend_request', {
        target_email: userEmail
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string };
      if (result.success) {
        // Refresh the relationship status
        await fetchRelationshipStatus();
        Alert.alert('Success', result.message);
      } else {
        Alert.alert('Info', result.message);
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', 'Failed to send friend request');
    }
  };

  const handleAcceptFriendRequest = async () => {
    if (!currentUserProfile?.id) return;
    
    try {
      // First, find the friend request
      const { data: requestData, error: requestError } = await supabase
        .from('friend_requests')
        .select('id')
        .eq('sender_id', userId)
        .eq('receiver_id', currentUserProfile.id)
        .eq('status', 'pending')
        .single();

      if (requestError) throw requestError;

      if (!requestData) {
        Alert.alert('Error', 'Friend request not found');
        return;
      }

      // Accept the friend request
      const { data, error } = await supabase.rpc('respond_to_friend_request', {
        request_id: requestData.id,
        response: 'accepted'
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string };
      if (result.success) {
        // Refresh the relationship status
        await fetchRelationshipStatus();
        Alert.alert('Success', result.message);
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', 'Failed to accept friend request');
    }
  };

  const handleDeclineFriendRequest = async () => {
    if (!currentUserProfile?.id) return;
    
    try {
      // First, find the friend request
      const { data: requestData, error: requestError } = await supabase
        .from('friend_requests')
        .select('id')
        .eq('sender_id', userId)
        .eq('receiver_id', currentUserProfile.id)
        .eq('status', 'pending')
        .single();

      if (requestError) throw requestError;

      if (!requestData) {
        Alert.alert('Error', 'Friend request not found');
        return;
      }

      // Decline the friend request
      const { data, error } = await supabase.rpc('respond_to_friend_request', {
        request_id: requestData.id,
        response: 'declined'
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string };
      if (result.success) {
        // Refresh the relationship status
        await fetchRelationshipStatus();
        Alert.alert('Success', result.message);
      } else {
        Alert.alert('Info', result.message);
      }
    } catch (error) {
      console.error('Error declining friend request:', error);
      Alert.alert('Error', 'Failed to decline friend request');
    }
  };

  useEffect(() => {
    if (visible && userId) {
      fetchUserProfile();
      fetchCurrentUserProfile();
    }
  }, [visible, userId]);

  useEffect(() => {
    if (visible && userId && currentUserProfile?.email) {
      fetchRelationshipStatus();
    }
  }, [visible, userId, currentUserProfile?.email]);

  const profileImageUrl = userProfile?.profileImage || 
    `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/user-images/${userEmail.replace('@', '_').replace(/\./g, '_')}/profile.jpg`;

  const bannerImageUrl = userProfile?.bannerImage || 
    `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/user-images/${userEmail.replace('@', '_').replace(/\./g, '_')}/banner.jpg`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={Colors[colorScheme ?? 'light'].text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Profile</Text>
          <View style={styles.placeholder} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#9E95BD" />
            <Text style={[styles.loadingText, { color: Colors[colorScheme ?? 'light'].text }]}>
              Loading profile...
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Profile Section */}
            <View style={styles.profileSection}>
              {/* Banner Image */}
              <View style={styles.bannerContainer}>
                <Image 
                  source={{ uri: bannerImageUrl }}
                  style={styles.bannerImage}
                  defaultSource={require('../assets/images/balloons.png')}
                />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.3)']}
                  style={styles.bannerOverlay}
                />
              </View>

              {/* Profile Image */}
              <View style={styles.profileImageContainer}>
                <Image 
                  source={{ uri: profileImageUrl }}
                  style={styles.profileImage}
                  defaultSource={require('../assets/images/icon.png')}
                  onError={() => {
                    console.log(`Failed to load profile image for user ${userEmail}`);
                  }}
                />
              </View>

              {/* User Info */}
              <View style={styles.userInfo}>
                <Text style={[styles.userName, { color: Colors[colorScheme ?? 'light'].text }]}>
                  {userProfile?.name || userName}
                </Text>
                <Text style={[styles.userEmail, { color: Colors[colorScheme ?? 'light'].text }]}>
                  {userProfile?.email || userEmail}
                </Text>
                
                {/* Debug Info - Remove in production */}
                {__DEV__ && (
                  <View style={styles.debugInfo}>
                    <Text style={styles.debugText}>
                      Debug: Status={friendshipStatus}, Following={isFollowing ? 'Yes' : 'No'}, Loading={relationshipLoading ? 'Yes' : 'No'}
                    </Text>
                  </View>
                )}
              </View>



              {/* Action Buttons */}
              <View style={styles.actionButtonsContainer}>
                {/* Follow/Unfollow Button - Hide when there's any friendship relationship */}
                {friendshipStatus === 'none' && (
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { backgroundColor: isFollowing ? '#ff4444' : '#9E95BD' }
                    ]}
                    onPress={isFollowing ? handleUnfollow : handleFollow}
                    disabled={relationshipLoading}
                  >
                    <Ionicons 
                      name={isFollowing ? "person-remove" : "person-add"} 
                      size={16} 
                      color="white" 
                    />
                    <Text style={styles.actionButtonText}>
                      {isFollowing ? 'Unfollow' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Friend Request Button - Show loading state */}
                {relationshipLoading ? (
                  <View style={[styles.actionButton, { backgroundColor: '#ddd' }]}>
                    <ActivityIndicator size="small" color="white" />
                    <Text style={styles.actionButtonText}>Loading...</Text>
                  </View>
                ) : (
                  <>
                    {friendshipStatus === 'none' && (
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#4ECDC4' }]}
                        onPress={handleFriendRequest}
                      >
                        <Ionicons name="people" size={16} color="white" />
                        <Text style={styles.actionButtonText}>Add Friend</Text>
                      </TouchableOpacity>
                    )}

                    {friendshipStatus === 'pending' && (
                      <View style={styles.friendsContainer}>
                        <View style={[styles.actionButton, { backgroundColor: '#FFA500' }]}>
                          <Ionicons name="time" size={16} color="white" />
                          <Text style={styles.actionButtonText}>Request Sent</Text>
                        </View>
                        <Text style={[styles.autoFollowText, { color: Colors[colorScheme ?? 'light'].text }]}>
                          You're following {userProfile?.name || userName}
                        </Text>
                      </View>
                    )}

                    {friendshipStatus === 'accepted' && (
                      <View style={styles.friendsContainer}>
                        <View style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}>
                          <Ionicons name="checkmark-circle" size={16} color="white" />
                          <Text style={styles.actionButtonText}>Friends</Text>
                        </View>
                        <Text style={[styles.autoFollowText, { color: Colors[colorScheme ?? 'light'].text }]}>
                          You and {userProfile?.name || userName} are following each other
                        </Text>
                      </View>
                    )}

                    {friendshipStatus === 'incoming' && (
                      <View style={styles.friendRequestButtons}>
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: '#4ECDC4', flex: 1, marginRight: 8 }]}
                          onPress={handleAcceptFriendRequest}
                        >
                          <Ionicons name="checkmark" size={16} color="white" />
                          <Text style={styles.actionButtonText}>Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: '#ff4444', flex: 1, marginLeft: 8 }]}
                          onPress={handleDeclineFriendRequest}
                        >
                          <Ionicons name="close" size={16} color="white" />
                          <Text style={styles.actionButtonText}>Decline</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                )}
              </View>
            </View>

            {/* Additional Info */}
            {userProfile && (
              <View style={[styles.infoSection, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
                <Text style={[styles.infoSectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                  About
                </Text>
                {userProfile.birthday && (
                  <View style={styles.infoRow}>
                    <View style={styles.infoIconContainer}>
                      <Ionicons name="calendar-outline" size={20} color="#9E95BD" />
                    </View>
                    <View style={styles.infoTextContainer}>
                      <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                        Birthday
                      </Text>
                      <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                        {userProfile.birthday}
                      </Text>
                    </View>
                  </View>
                )}
                {userProfile.gender && (
                  <View style={styles.infoRow}>
                    <View style={styles.infoIconContainer}>
                      <Ionicons name="person-outline" size={20} color="#9E95BD" />
                    </View>
                    <View style={styles.infoTextContainer}>
                      <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                        Gender
                      </Text>
                      <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                        {userProfile.gender}
                      </Text>
                    </View>
                  </View>
                )}
                {userProfile.location && (
                  <View style={styles.infoRow}>
                    <View style={styles.infoIconContainer}>
                      <Ionicons name="location-outline" size={20} color="#9E95BD" />
                    </View>
                    <View style={styles.infoTextContainer}>
                      <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                        Location
                      </Text>
                      <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                        {userProfile.location}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
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
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  closeButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 34,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  bannerContainer: {
    width: '100%',
    height: 150,
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  profileImageContainer: {
    marginTop: -50,
    marginBottom: 15,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: 'white',
  },
  userInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 16,
    opacity: 0.7,
  },

  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    flex: 1,
  },
  actionButtonText: {
    color: 'white',
    marginLeft: 6,
    fontSize: 14,
    fontWeight: 'bold',
  },
  friendRequestButtons: {
    flexDirection: 'row',
    flex: 1,
  },
  infoSection: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  infoSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(158, 149, 189, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  debugInfo: {
    marginTop: 10,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 0, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 0, 0.3)',
  },
  debugText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#666',
    textAlign: 'center',
  },
  friendsContainer: {
    alignItems: 'center',
    width: '100%',
  },
  autoFollowText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.8,
    fontStyle: 'italic',
  },
}); 