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

interface SearchUser {
  user_id: number;
  name: string;
  email: string;
  friendship_status: 'pending' | 'accepted' | 'blocked' | 'declined' | null;
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
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');
  
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
      if (showLoading) setFriendsLoading(true);
      const { data, error } = await supabase.rpc('get_user_friends', {
        target_user_id: profile.id
      });

      if (error) throw error;
      onFriendsUpdate(data || []);
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
      onRequestsUpdate(data || []);
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

  const handleModalOpen = () => {
    setActiveTab('friends');
    // Refresh friends data when user explicitly opens the modal
    console.log('Refreshing friends data for modal interaction...');
    fetchFriends(true);
    fetchFriendRequests(true);
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.friendsModalContainer, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
        <View style={styles.friendsModalHeader}>
          <Text style={[styles.friendsModalTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Friends</Text>
          <TouchableOpacity onPress={onClose}>
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
                    <TouchableOpacity 
                      style={styles.friendInfo}
                      onPress={() => handleUserProfileNavigation(friend.friend_id, friend.friend_name, friend.friend_email)}
                    >
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
                    </TouchableOpacity>
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
                    <TouchableOpacity 
                      style={styles.friendInfo}
                      onPress={() => handleUserProfileNavigation(request.sender_id, request.sender_name, request.sender_email)}
                    >
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
                    </TouchableOpacity>
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
                      <TouchableOpacity 
                        style={styles.friendInfo}
                        onPress={() => handleUserProfileNavigation(user.user_id, user.name, user.email)}
                      >
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
                      </TouchableOpacity>
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
  // Friend Avatar Image Styles
  friendAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
}); 