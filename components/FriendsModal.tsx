import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, TextInput, Alert, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '@/lib/GlobalDataManager';
import UserProfileModal from './UserProfileModal';
import SocialDataManager, { Friend, FriendRequest, Follower, Following } from '@/lib/SocialDataManager';

// Social interfaces now imported from SocialDataManager

interface FriendsModalProps {
  visible: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  friends: Friend[];
  friendRequests: FriendRequest[];
  onFriendsUpdate: (friends: Friend[]) => void;
  onRequestsUpdate: (requests: FriendRequest[]) => void;
  onFollowCountsUpdate?: () => void;
  onRefreshRequests?: () => void;
}

export default function FriendsModal({
  visible,
  onClose,
  profile,
  friends,
  friendRequests,
  onFriendsUpdate,
  onRequestsUpdate,
  onFollowCountsUpdate,
  onRefreshRequests
}: FriendsModalProps) {
  const colorScheme = useColorScheme();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'followers' | 'following' | 'requests'>('friends');
  
  // Follow state
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [following, setFollowing] = useState<Following[]>([]);
  
  // Get SocialDataManager instance
  const socialDataManager = SocialDataManager.getInstance();
  
  // UserProfileModal state
  const [userProfileModalVisible, setUserProfileModalVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number>(0);
  const [selectedUserName, setSelectedUserName] = useState<string>('');
  const [selectedUserEmail, setSelectedUserEmail] = useState<string>('');

  // Notification state for new friends/requests
  const [lastViewedFriendsCount, setLastViewedFriendsCount] = useState(0);
  const [lastViewedRequestsCount, setLastViewedRequestsCount] = useState(0);
  const [hasNewFriends, setHasNewFriends] = useState(false);
  const [hasNewRequests, setHasNewRequests] = useState(false);

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

  useEffect(() => {
    loadNotificationState();
  }, []);

  // Update notification state when friends or requests change
  useEffect(() => {
    updateNotificationState();
  }, [friends.length, friendRequests.length, lastViewedFriendsCount, lastViewedRequestsCount]);

  // REMOVED: fetchFriends - now handled by SocialDataManager in parent component

  // Debug function to check friend requests manually
  const debugFriendRequests = async () => {
    if (!profile?.id) {
      console.log('🚨 DEBUG: No profile ID available');
      return;
    }

    console.log(`🔍 DEBUG: Checking friend requests for user ID ${profile.id}`);
    console.log(`👤 DEBUG: Profile info:`, { id: profile.id, email: profile.email, name: profile.name });

    try {
      // Check all friend requests in the database for this user
      const { data: allRequests, error: allError } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('receiver_id', profile.id);

      console.log(`📋 DEBUG: All friend requests for user ${profile.id}:`, allRequests);

      // Check pending requests specifically
      const { data: pendingRequests, error: pendingError } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('receiver_id', profile.id)
        .eq('status', 'pending');

      console.log(`⏳ DEBUG: Pending friend requests:`, pendingRequests);

      // Also check what the RPC function returns
      const { data: rpcRequests, error: rpcError } = await supabase.rpc('get_pending_friend_requests', {
        target_user_id: profile.id
      });

      console.log(`🔧 DEBUG: RPC function result:`, { data: rpcRequests, error: rpcError });

    } catch (error) {
      console.error('🚨 DEBUG: Error in debug function:', error);
    }
  };

  // Debug function to check relationship between two users
  const debugRelationship = async (userId1: number, userId2: number) => {
    console.log(`🔍 DEBUG: Checking relationship between users ${userId1} and ${userId2}`);
    
    try {
      // Check friend requests in both directions
      const { data: requests1to2 } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('sender_id', userId1)
        .eq('receiver_id', userId2);
      
      const { data: requests2to1 } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('sender_id', userId2)
        .eq('receiver_id', userId1);

      // Check friendships in both directions
      const { data: friendships } = await supabase
        .from('friends')
        .select('*')
        .or(`and(user_id.eq.${userId1},friend_id.eq.${userId2}),and(user_id.eq.${userId2},friend_id.eq.${userId1})`);

      // Check follows in both directions
      const { data: follows } = await supabase
        .from('follows')
        .select('*')
        .or(`and(follower_id.eq.${userId1},followed_id.eq.${userId2}),and(follower_id.eq.${userId2},followed_id.eq.${userId1})`);

      console.log('📋 DEBUG: Friend requests 1→2:', requests1to2);
      console.log('📋 DEBUG: Friend requests 2→1:', requests2to1);
      console.log('👥 DEBUG: Friendships:', friendships);
      console.log('🔗 DEBUG: Follows:', follows);

    } catch (error) {
      console.error('🚨 DEBUG: Error checking relationship:', error);
    }
  };

  // Add debug button to modal when in development
  const isDev = __DEV__ || process.env.NODE_ENV === 'development';

  // REMOVED: fetchFriendRequests, fetchFollowers, fetchFollowing - now handled by SocialDataManager

  const respondToFriendRequest = async (requestId: number, response: 'accepted' | 'declined' | 'blocked') => {
    if (!profile?.id) return;
    
    try {
      console.log(`🚀 OFFLINE-FIRST: Responding to friend request ${requestId} with response: ${response}`);
      
      let success = false;
      
      if (response === 'accepted') {
        // Get the sender ID from the friend request
        const request = friendRequests.find(req => req.request_id === requestId);
        if (!request) {
          Alert.alert('Error', 'Friend request not found');
          return;
        }
        
        // Use SocialDataManager to accept friend request (auto-updates cache)
        success = await socialDataManager.acceptFriendRequest(requestId, request.sender_id, profile.id);
        
        if (success) {
          Alert.alert('Success', 'Friend request accepted! You are now friends.');
        } else {
          Alert.alert('Error', 'Failed to accept friend request');
          return;
        }
      } else {
        // Use SocialDataManager to decline friend request (auto-updates cache)
        success = await socialDataManager.declineFriendRequest(requestId, profile.id);
        
        if (success) {
          Alert.alert('Success', `Friend request ${response}.`);
        } else {
          Alert.alert('Error', `Failed to ${response} friend request`);
          return;
        }
      }

      // Refresh parent Profile component's social data (triggers cache refresh)
      if (onFollowCountsUpdate) {
        onFollowCountsUpdate();
      }
      
      if (onRefreshRequests) {
        onRefreshRequests();
      }

    } catch (error) {
      console.error('🚨 OFFLINE-FIRST: Error responding to friend request:', error);
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
              console.log(`🚀 OFFLINE-FIRST: Removing friend - user: ${profile.id}, friend: ${friendId}`);
              
              // Use SocialDataManager to remove friend (auto-updates cache)
              const success = await socialDataManager.removeFriend(profile.id, friendId);
              
              if (success) {
                Alert.alert('Success', 'Friend removed successfully');
                
                // Update parent Profile component's social data (triggers cache refresh)
                if (onFollowCountsUpdate) {
                  onFollowCountsUpdate();
                }
              } else {
                Alert.alert('Error', 'Failed to remove friend');
              }
              
            } catch (error) {
              console.error('🚨 OFFLINE-FIRST: Error removing friend:', error);
              Alert.alert('Error', 'Failed to remove friend');
            }
          }
        }
      ]
    );
  };

  const handleUnfollow = async (targetEmail: string) => {
    if (!profile?.email || !profile?.id) return;
    
    try {
      console.log(`🚀 OFFLINE-FIRST: Unfollowing user ${targetEmail} by ${profile.email}`);
      
      // Get target user ID first
      const { data: targetUser, error: targetError } = await supabase
        .from('all_users')
        .select('id')
        .eq('email', targetEmail)
        .single();

      if (targetError || !targetUser) {
        console.error('🚨 Error finding target user:', targetError);
        Alert.alert('Error', 'User not found');
        return;
      }

      // Use SocialDataManager to unfollow user (auto-updates cache)
      const success = await socialDataManager.unfollowUser(profile.id, targetUser.id);

      if (success) {
        Alert.alert('Success', 'User unfollowed successfully');
        
        // Update parent Profile component's social data (triggers cache refresh)
        if (onFollowCountsUpdate) {
          onFollowCountsUpdate();
        }
      } else {
        Alert.alert('Error', 'Failed to unfollow user');
      }
    } catch (error) {
      console.error('🚨 OFFLINE-FIRST: Error unfollowing user:', error);
      Alert.alert('Error', 'Failed to unfollow user');
    }
  };

  // Handle tab switching and mark as viewed
  const handleTabSwitch = async (tab: 'friends' | 'followers' | 'following' | 'requests') => {
    setActiveTab(tab);
    
    // Mark as viewed when switching to tabs
    if (tab === 'friends') {
      setTimeout(() => markFriendsAsViewed(), 200);
    } else if (tab === 'requests') {
      setTimeout(() => markRequestsAsViewed(), 200);
    }
    
    // OFFLINE-FIRST: Load data for tabs that need it from cache
    if ((tab === 'followers' || tab === 'following') && profile?.id) {
      try {
        console.log(`🚀 OFFLINE-FIRST: Loading ${tab} data from cache for tab switch`);
        const socialData = await socialDataManager.getSocialData(profile.id);
        
        if (tab === 'followers') {
          setFollowers(socialData.followers);
        } else if (tab === 'following') {
          setFollowing(socialData.following);
        }
      } catch (error) {
        console.error(`❌ Error loading ${tab} data:`, error);
      }
    }
    // Friends and requests are already available from props
  };

  const handleModalOpen = () => {
    setActiveTab('friends');
    
    // OFFLINE-FIRST: Data will be fresh from parent's cache refresh
    console.log('🚀 OFFLINE-FIRST: Modal opened - using cached social data from parent');
    
    // Update local follower/following state from props
    // (Friends and requests are passed as props and already up-to-date)
    
    // Trigger parent refresh for latest data
    if (onRefreshRequests) {
      console.log('🔄 OFFLINE-FIRST: Requesting parent to refresh all social data...');
      onRefreshRequests();
    }
    
    // Mark friends as viewed when opening modal (defaults to friends tab)
    setTimeout(() => markFriendsAsViewed(), 500);
  };

  // Handle modal opening
  useEffect(() => {
    if (visible) {
      handleModalOpen();
    }
  }, [visible]);

  // Open user profile modal
  const handleUserProfileNavigation = (userId: number, userName: string, userEmail: string) => {
    setSelectedUserId(userId);
    setSelectedUserName(userName);
    setSelectedUserEmail(userEmail);
    setUserProfileModalVisible(true);
  };

  const renderUserItem = (user: any, type: 'friend' | 'follower' | 'following' | 'request') => {
    const userId = user.friend_id || user.follower_id || user.following_id || user.sender_id;
    const userName = user.friend_name || user.follower_name || user.following_name || user.sender_name;
    const userEmail = user.friend_email || user.follower_email || user.following_email || user.sender_email;
    const key = user.friendship_id || user.request_id || `${type}-${userId}`;

    return (
      <View key={key} style={[styles.userItem, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
        <TouchableOpacity 
          style={styles.userInfo}
          onPress={() => handleUserProfileNavigation(userId, userName, userEmail)}
        >
          <View style={styles.userAvatar}>
            <Image 
              source={{ 
                uri: `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/user-images/${userEmail.replace('@', '_').replace(/\./g, '_')}/profile.jpg` 
              }}
              style={styles.userAvatarImage}
              defaultSource={require('../assets/images/icon.png')}
              onError={() => {
                console.log(`Failed to load profile image for ${type} ${userEmail}`);
              }}
            />
          </View>
          <View style={styles.userDetails}>
            <Text style={[styles.userName, { color: Colors[colorScheme ?? 'light'].text }]}>
              {userName}
            </Text>
            <Text style={[styles.userEmail, { color: Colors[colorScheme ?? 'light'].text }]}>
              {userEmail}
            </Text>
            {type === 'request' && (
              <View style={styles.dateContainer}>
                <Ionicons name="time-outline" size={12} color="#9E95BD" />
                <Text style={[styles.dateText, { color: Colors[colorScheme ?? 'light'].text }]}>
                  Sent {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        
        {/* Action buttons based on type */}
        {type === 'friend' && (
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeFriend(userId)}
          >
            <Ionicons name="person-remove" size={20} color="#ff4444" />
          </TouchableOpacity>
        )}
        
        {type === 'following' && (
          <TouchableOpacity
            style={styles.unfollowButton}
            onPress={() => handleUnfollow(userEmail)}
          >
            <Ionicons name="person-remove-outline" size={20} color="#fff" />
          </TouchableOpacity>
        )}
        
        {type === 'request' && (
          <View style={styles.requestActions}>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => respondToFriendRequest(user.request_id, 'accepted')}
            >
              <Ionicons name="checkmark" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={() => respondToFriendRequest(user.request_id, 'declined')}
            >
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderTabContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#9E95BD" style={styles.loader} />
        </View>
      );
    }

    let data: any[] = [];
    let emptyIcon = 'people-outline';
    let emptyTitle = 'No data found';
    let emptySubtitle = '';
    let type: 'friend' | 'follower' | 'following' | 'request' = 'friend';

    switch (activeTab) {
      case 'friends':
        data = friends;
        emptyIcon = 'people-outline';
        emptyTitle = 'No friends yet';
        emptySubtitle = 'Use the Discover tab to search for friends';
        type = 'friend';
        break;
      case 'followers':
        data = followers;
        emptyIcon = 'person-outline';
        emptyTitle = 'No followers yet';
        emptySubtitle = 'Share your profile to gain followers';
        type = 'follower';
        break;
      case 'following':
        data = following;
        emptyIcon = 'person-add-outline';
        emptyTitle = 'Not following anyone';
        emptySubtitle = 'Follow people to see their updates';
        type = 'following';
        break;
      case 'requests':
        data = friendRequests;
        emptyIcon = 'mail-outline';
        emptyTitle = 'No friend requests';
        emptySubtitle = '';
        type = 'request';
        break;
    }

    if (data.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name={emptyIcon as any} size={64} color={Colors[colorScheme ?? 'light'].text} />
          <Text style={[styles.emptyTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
            {emptyTitle}
          </Text>
          {emptySubtitle && (
            <Text style={[styles.emptySubtitle, { color: Colors[colorScheme ?? 'light'].text }]}>
              {emptySubtitle}
            </Text>
          )}
        </View>
      );
    }

    return (
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {data.map((item) => renderUserItem(item, type))}
      </ScrollView>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => {}} // Prevent closing with back button or gestures
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Social</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {isDev && (
              <>
                <TouchableOpacity onPress={debugFriendRequests} style={{ padding: 5 }}>
                  <Text style={{ color: '#FF6B9D', fontSize: 12, fontWeight: 'bold' }}>DEBUG</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => {
                    console.log('🔄 OFFLINE-FIRST: Manual refresh triggered...');
                    if (onRefreshRequests) onRefreshRequests();
                  }} 
                  style={{ padding: 5 }}
                >
                  <Text style={{ color: '#4CAF50', fontSize: 12, fontWeight: 'bold' }}>REFRESH</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => {
                    // Example usage - you can change these IDs to test specific relationships
                    if (profile?.id) {
                      debugRelationship(profile.id, profile.id + 1); // Debug with next user ID
                    }
                  }} 
                  style={{ padding: 5 }}
                >
                  <Text style={{ color: '#9C27B0', fontSize: 12, fontWeight: 'bold' }}>REL</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors[colorScheme ?? 'light'].text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'friends' && styles.tabActive]}
            onPress={() => handleTabSwitch('friends')}
          >
            <View style={styles.tabIconContainer}>
              <Ionicons 
                name="people" 
                size={20} 
                color={activeTab === 'friends' ? '#fff' : Colors[colorScheme ?? 'light'].text} 
              />
              {hasNewFriends && activeTab !== 'friends' && (
                <View style={styles.tabNotificationBubble}>
                  <View style={styles.tabNotificationDot} />
                </View>
              )}
            </View>
            <Text style={[
              styles.tabText,
              { color: activeTab === 'friends' ? '#fff' : Colors[colorScheme ?? 'light'].text }
            ]}>
              Friends
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'followers' && styles.tabActive]}
            onPress={() => handleTabSwitch('followers')}
          >
            <View style={styles.tabIconContainer}>
              <Ionicons 
                name="person" 
                size={20} 
                color={activeTab === 'followers' ? '#fff' : Colors[colorScheme ?? 'light'].text} 
              />
            </View>
            <Text style={[
              styles.tabText,
              { color: activeTab === 'followers' ? '#fff' : Colors[colorScheme ?? 'light'].text }
            ]}>
              Followers
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'following' && styles.tabActive]}
            onPress={() => handleTabSwitch('following')}
          >
            <View style={styles.tabIconContainer}>
              <Ionicons 
                name="person-add" 
                size={20} 
                color={activeTab === 'following' ? '#fff' : Colors[colorScheme ?? 'light'].text} 
              />
            </View>
            <Text style={[
              styles.tabText,
              { color: activeTab === 'following' ? '#fff' : Colors[colorScheme ?? 'light'].text }
            ]}>
              Following
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
            onPress={() => handleTabSwitch('requests')}
          >
            <View style={styles.tabIconContainer}>
              <Ionicons 
                name="mail" 
                size={20} 
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
            <Text style={[
              styles.tabText,
              { color: activeTab === 'requests' ? '#fff' : Colors[colorScheme ?? 'light'].text }
            ]}>
              Requests
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <View style={styles.content}>
          {renderTabContent()}
        </View>
      </SafeAreaView>

      {/* User Profile Modal */}
      <UserProfileModal
        visible={userProfileModalVisible}
        onClose={() => setUserProfileModalVisible(false)}
        userId={selectedUserId}
        userName={selectedUserName}
        userEmail={selectedUserEmail}
        initialFriendshipStatus={undefined}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 5,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: 60,
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: '#9E95BD',
  },
  tabIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  tabBadge: {
    position: 'absolute',
    top: -8,
    right: -12,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff4444',
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loader: {
    marginTop: 50,
  },
  list: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
    opacity: 0.7,
  },
  userItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    marginVertical: 6,
    marginHorizontal: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(158, 149, 189, 0.08)',
    backgroundColor: 'rgba(158, 149, 189, 0.02)',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F5F5F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 18,
    borderWidth: 2,
    borderColor: 'rgba(158, 149, 189, 0.1)',
  },
  userAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  userEmail: {
    fontSize: 13,
    opacity: 0.65,
    fontWeight: '400',
    marginTop: 1,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dateText: {
    fontSize: 11,
    opacity: 0.6,
    marginLeft: 4,
    fontWeight: '400',
  },
  removeButton: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.15)',
  },
  unfollowButton: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
      },
    requestActions: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptButton: {
    backgroundColor: '#34C759',
    borderRadius: 10,
    padding: 12,
    minWidth: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.2)',
  },
  declineButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    padding: 12,
    minWidth: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
}); 