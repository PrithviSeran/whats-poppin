import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, TextInput, Alert, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '@/lib/GlobalDataManager';
import UserProfileModal from './UserProfileModal';

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

// Follow interfaces
interface Follower {
  follower_id: number;
  follower_name: string;
  follower_email: string;
  created_at: string;
}

interface Following {
  following_id: number;
  following_name: string;
  following_email: string;
  created_at: string;
}

interface FriendsModalProps {
  visible: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  friends: Friend[];
  friendRequests: FriendRequest[];
  onFriendsUpdate: (friends: Friend[]) => void;
  onRequestsUpdate: (requests: FriendRequest[]) => void;
}

export default function FriendsModal({
  visible,
  onClose,
  profile,
  friends,
  friendRequests,
  onFriendsUpdate,
  onRequestsUpdate
}: FriendsModalProps) {
  const colorScheme = useColorScheme();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'followers' | 'following' | 'requests'>('friends');
  
  // Follow state
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [following, setFollowing] = useState<Following[]>([]);
  
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

  const fetchFriends = async (showLoading: boolean = true) => {
    if (!profile?.id) return;
    
    try {
      if (showLoading) setLoading(true);
      const { data, error } = await supabase.rpc('get_user_friends', {
        target_user_id: profile.id
      });

      if (error) throw error;
      onFriendsUpdate(data || []);
    } catch (error) {
      console.error('Error fetching friends:', error);
      if (showLoading) Alert.alert('Error', 'Failed to load friends');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchFriendRequests = async (showLoading: boolean = true) => {
    if (!profile?.id) return;
    
    try {
      if (showLoading) setLoading(true);
      const { data, error } = await supabase.rpc('get_pending_friend_requests', {
        target_user_id: profile.id
      });

      if (error) throw error;
      onRequestsUpdate(data || []);
    } catch (error) {
      console.error('Error fetching friend requests:', error);
      if (showLoading) Alert.alert('Error', 'Failed to load friend requests');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchFollowers = async (showLoading: boolean = true) => {
    if (!profile?.id) return;
    
    try {
      if (showLoading) setLoading(true);
      const { data, error } = await supabase.rpc('get_user_followers', {
        target_user_id: profile.id
      });

      if (error) throw error;
      setFollowers(data || []);
    } catch (error) {
      console.error('Error fetching followers:', error);
      if (showLoading) Alert.alert('Error', 'Failed to load followers');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchFollowing = async (showLoading: boolean = true) => {
    if (!profile?.id) return;
    
    try {
      if (showLoading) setLoading(true);
      const { data, error } = await supabase.rpc('get_user_following', {
        target_user_id: profile.id
      });

      if (error) throw error;
      setFollowing(data || []);
    } catch (error) {
      console.error('Error fetching following:', error);
      if (showLoading) Alert.alert('Error', 'Failed to load following');
    } finally {
      if (showLoading) setLoading(false);
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

  const handleUnfollow = async (targetEmail: string) => {
    try {
      const { data, error } = await supabase.rpc('unfollow_user', {
        target_email: targetEmail
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string };
      if (result.success) {
        Alert.alert('Success', result.message);
        fetchFollowing(true); // Refresh following list
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      console.error('Error unfollowing user:', error);
      Alert.alert('Error', 'Failed to unfollow user');
    }
  };

  // Handle tab switching and mark as viewed
  const handleTabSwitch = (tab: 'friends' | 'followers' | 'following' | 'requests') => {
    setActiveTab(tab);
    
    // Mark as viewed when switching to tabs
    if (tab === 'friends') {
      setTimeout(() => markFriendsAsViewed(), 200);
    } else if (tab === 'requests') {
      setTimeout(() => markRequestsAsViewed(), 200);
    }
    
    // Fetch data for the active tab
    switch (tab) {
      case 'friends':
        fetchFriends(false);
        break;
      case 'followers':
        fetchFollowers(false);
        break;
      case 'following':
        fetchFollowing(false);
        break;
      case 'requests':
        fetchFriendRequests(false);
        break;
    }
  };

  const handleModalOpen = () => {
    setActiveTab('friends');
    // Refresh all data when user explicitly opens the modal
    console.log('Refreshing all social data for modal interaction...');
    fetchFriends(true);
    fetchFriendRequests(true);
    fetchFollowers(false);
    fetchFollowing(false);
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
            <Text style={styles.unfollowButtonText}>Unfollow</Text>
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
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Social</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors[colorScheme ?? 'light'].text} />
          </TouchableOpacity>
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
    paddingHorizontal: 4,
    paddingTop: 8,
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
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
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
  userAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  userEmail: {
    fontSize: 14,
    opacity: 0.8,
    fontWeight: '500',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dateText: {
    fontSize: 12,
    opacity: 0.7,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  removeButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
  },
  unfollowButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#ff4444',
  },
  unfollowButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
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
}); 