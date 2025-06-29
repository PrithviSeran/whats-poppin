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
      
      console.log(`🔍 FriendsModal: fetchFriends for user ID ${profile.id}`);
      
      // Use direct database query instead of broken RPC function
      console.log('🔄 FriendsModal: Using direct database query for friends...');
      
      const { data: directData, error: directError } = await supabase
        .from('friends')
        .select(`
          id,
          friend_id,
          status,
          created_at,
          all_users!friends_friend_id_fkey (
            id,
            name,
            email
          )
        `)
        .eq('user_id', profile.id)
        .eq('status', 'accepted');

      console.log(`📥 FriendsModal: Direct friends query result:`, { data: directData, error: directError });

      if (directError) {
        console.error('🚨 FriendsModal: Direct friends query error:', directError);
        throw directError;
      }

      // Transform the data to match expected format
      const transformedData = directData?.map((friend: any) => ({
        friend_id: friend.friend_id,
        friend_name: friend.all_users?.name || 'Unknown',
        friend_email: friend.all_users?.email || 'Unknown',
        friendship_id: friend.id,
        status: friend.status,
        created_at: friend.created_at
      })) || [];

      console.log(`🔄 FriendsModal: Transformed friends data:`, transformedData);
      console.log(`✅ FriendsModal: Found ${transformedData.length} friends for user ${profile.id}`);
      onFriendsUpdate(transformedData);
      
    } catch (error) {
      console.error('🚨 FriendsModal: Error fetching friends:', error);
      if (showLoading) Alert.alert('Error', 'Failed to load friends');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

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

  const fetchFriendRequests = async (showLoading: boolean = true) => {
    if (!profile?.id) {
      console.log('🚨 fetchFriendRequests: No profile ID available');
      return;
    }
    
    console.log(`🔍 FriendsModal: fetchFriendRequests for user ID ${profile.id}`);
    
    try {
      if (showLoading) setLoading(true);
      
      // Use direct database query instead of broken RPC function
      console.log('🔄 FriendsModal: Using direct database query...');
      
      const { data: directData, error: directError } = await supabase
        .from('friend_requests')
        .select('id, sender_id, created_at')
        .eq('receiver_id', profile.id)
        .eq('status', 'pending');

      console.log(`📥 FriendsModal: Direct query result:`, { data: directData, error: directError });

      if (directError) {
        console.error('🚨 FriendsModal: Direct query error:', directError);
        throw directError;
      }

      // Get sender details separately
      const senderIds = directData?.map(req => req.sender_id) || [];
      let senderDetails: any[] = [];
      if (senderIds.length > 0) {
        const { data: sendersData } = await supabase
          .from('all_users')
          .select('id, name, email')
          .in('id', senderIds);
        senderDetails = sendersData || [];
        console.log(`👥 FriendsModal: Sender details fetched:`, senderDetails);
      }

      // Transform the data to match expected format
      const transformedData = directData?.map(request => {
        const sender = senderDetails.find(s => s.id === request.sender_id);
        return {
          request_id: request.id,
          sender_id: request.sender_id,
          sender_name: sender?.name || 'Unknown',
          sender_email: sender?.email || 'Unknown',
          created_at: request.created_at
        };
      }) || [];

      console.log(`🔄 FriendsModal: Final transformed data:`, transformedData);
      console.log(`✅ FriendsModal: Found ${transformedData.length} pending friend requests for user ${profile.id}`);
      onRequestsUpdate(transformedData);
      
    } catch (error) {
      console.error('🚨 FriendsModal: Error fetching friend requests:', error);
      if (showLoading) Alert.alert('Error', 'Failed to load friend requests');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchFollowers = async (showLoading: boolean = true) => {
    if (!profile?.id) return;
    
    try {
      if (showLoading) setLoading(true);
      
      console.log(`🔍 FriendsModal: fetchFollowers for user ID ${profile.id}`);
      
      // Use direct database query instead of broken RPC function
      console.log('🔄 FriendsModal: Using direct database query for followers...');
      
      const { data: directData, error: directError } = await supabase
        .from('follows')
        .select(`
          id,
          follower_id,
          created_at,
          all_users!follows_follower_id_fkey (
            id,
            name,
            email
          )
        `)
        .eq('followed_id', profile.id);

      console.log(`📥 FriendsModal: Direct followers query result:`, { data: directData, error: directError });

      if (directError) {
        console.error('🚨 FriendsModal: Direct followers query error:', directError);
        throw directError;
      }

      // Transform the data to match expected format
      const transformedData = directData?.map((follow: any) => ({
        follower_id: follow.follower_id,
        follower_name: follow.all_users?.name || 'Unknown',
        follower_email: follow.all_users?.email || 'Unknown',
        created_at: follow.created_at
      })) || [];

      console.log(`🔄 FriendsModal: Transformed followers data:`, transformedData);
      console.log(`✅ FriendsModal: Found ${transformedData.length} followers for user ${profile.id}`);
      setFollowers(transformedData);
      
    } catch (error) {
      console.error('🚨 FriendsModal: Error fetching followers:', error);
      if (showLoading) Alert.alert('Error', 'Failed to load followers');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchFollowing = async (showLoading: boolean = true) => {
    if (!profile?.id) return;
    
    try {
      if (showLoading) setLoading(true);
      
      console.log(`🔍 FriendsModal: fetchFollowing for user ID ${profile.id}`);
      
      // Use direct database query instead of broken RPC function
      console.log('🔄 FriendsModal: Using direct database query for following...');
      
      const { data: directData, error: directError } = await supabase
        .from('follows')
        .select(`
          id,
          followed_id,
          created_at,
          all_users!follows_followed_id_fkey (
            id,
            name,
            email
          )
        `)
        .eq('follower_id', profile.id);

      console.log(`📥 FriendsModal: Direct following query result:`, { data: directData, error: directError });

      if (directError) {
        console.error('🚨 FriendsModal: Direct following query error:', directError);
        throw directError;
      }

      // Transform the data to match expected format
      const transformedData = directData?.map((follow: any) => ({
        following_id: follow.followed_id,
        following_name: follow.all_users?.name || 'Unknown',
        following_email: follow.all_users?.email || 'Unknown',
        created_at: follow.created_at
      })) || [];

      console.log(`🔄 FriendsModal: Transformed following data:`, transformedData);
      console.log(`✅ FriendsModal: Found ${transformedData.length} following for user ${profile.id}`);
      setFollowing(transformedData);
      
    } catch (error) {
      console.error('🚨 FriendsModal: Error fetching following:', error);
      if (showLoading) Alert.alert('Error', 'Failed to load following');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const respondToFriendRequest = async (requestId: number, response: 'accepted' | 'declined' | 'blocked') => {
    try {
      console.log(`🔍 Responding to friend request ${requestId} with response: ${response}`);
      
      // Since RPC functions have conflicts, handle this manually with direct database operations
      if (response === 'accepted') {
        // First, get the friend request details
        const { data: requestData, error: requestError } = await supabase
          .from('friend_requests')
          .select('sender_id, receiver_id')
          .eq('id', requestId)
          .eq('status', 'pending')
          .single();

        if (requestError) {
          console.error('🚨 Error fetching friend request:', requestError);
          throw requestError;
        }

        if (!requestData) {
          Alert.alert('Error', 'Friend request not found or already processed');
          return;
        }

        console.log('📋 Friend request data:', requestData);

        // Update the friend request status to accepted
        const { error: updateError } = await supabase
          .from('friend_requests')
          .update({ status: 'accepted', updated_at: new Date().toISOString() })
          .eq('id', requestId);

        if (updateError) {
          console.error('🚨 Error updating friend request:', updateError);
          throw updateError;
        }

        // Check if friendship already exists to avoid duplicates
        const { data: existingFriendships, error: checkError } = await supabase
          .from('friends')
          .select('id')
          .or(`and(user_id.eq.${requestData.sender_id},friend_id.eq.${requestData.receiver_id}),and(user_id.eq.${requestData.receiver_id},friend_id.eq.${requestData.sender_id})`);

        if (checkError) {
          console.error('🚨 Error checking existing friendships:', checkError);
          // Continue with creation anyway, let the database handle duplicates
        }

        if (existingFriendships && existingFriendships.length > 0) {
          console.log('⚠️ Friendship already exists, updating status instead of creating new');
          
          // Update existing friendships instead of creating new ones
          const { error: updateFriendshipError } = await supabase
            .from('friends')
            .update({ 
              status: 'accepted', 
              updated_at: new Date().toISOString() 
            })
            .or(`and(user_id.eq.${requestData.sender_id},friend_id.eq.${requestData.receiver_id}),and(user_id.eq.${requestData.receiver_id},friend_id.eq.${requestData.sender_id})`);

          if (updateFriendshipError) {
            console.error('🚨 Error updating existing friendship:', updateFriendshipError);
            throw updateFriendshipError;
          }

          console.log('✅ Existing friendships updated to accepted status');
        } else {
          // Create new friendship entries in both directions
          const friendshipData = [
            {
              user_id: requestData.sender_id,
              friend_id: requestData.receiver_id,
              status: 'accepted',
              created_at: new Date().toISOString()
            },
            {
              user_id: requestData.receiver_id,
              friend_id: requestData.sender_id,
              status: 'accepted',
              created_at: new Date().toISOString()
            }
          ];

          console.log('📝 Creating new friendships:', friendshipData);

          const { data: insertResult, error: friendshipError } = await supabase
            .from('friends')
            .insert(friendshipData)
            .select();

          console.log('📤 Friendship insert result:', { data: insertResult, error: friendshipError });

          if (friendshipError) {
            console.error('🚨 Error creating friendship:', friendshipError);
            console.error('🚨 Friendship error details:', JSON.stringify(friendshipError, null, 2));
            
            // If it's a duplicate key error, try to handle it gracefully
            if (friendshipError.message?.includes('duplicate') || friendshipError.code === '23505') {
              console.log('🔄 Duplicate key error detected, friendship may already exist');
              Alert.alert('Success', 'Friend request accepted! You are now friends.');
            } else {
              throw friendshipError;
            }
          } else {
            console.log('✅ New friendships created successfully:', insertResult);
          }
        }

        // Verify the friendship was created by checking the friends table directly
        const { data: verifyFriendship, error: verifyError } = await supabase
          .from('friends')
          .select('id, user_id, friend_id, status')
          .or(`and(user_id.eq.${requestData.sender_id},friend_id.eq.${requestData.receiver_id}),and(user_id.eq.${requestData.receiver_id},friend_id.eq.${requestData.sender_id})`)
          .eq('status', 'accepted');

        console.log('🔍 Friendship verification result:', { data: verifyFriendship, error: verifyError });

        if (verifyFriendship && verifyFriendship.length >= 2) {
          console.log('✅ Friend request accepted successfully - bidirectional friendship confirmed');
        } else if (verifyFriendship && verifyFriendship.length === 1) {
          console.log('⚠️ Only one direction of friendship found, may need to fix RPC function');
        } else {
          console.log('🚨 No friendship entries found after creation - there may be a database issue');
        }
        
        Alert.alert('Success', 'Friend request accepted! You are now friends.');
        
      } else {
        // For declined/blocked, just update the status
        const { error: updateError } = await supabase
          .from('friend_requests')
          .update({ status: response, updated_at: new Date().toISOString() })
          .eq('id', requestId);

        if (updateError) {
          console.error('🚨 Error updating friend request:', updateError);
          throw updateError;
        }

        console.log(`✅ Friend request ${response} successfully`);
        Alert.alert('Success', `Friend request ${response}.`);
      }

      // Refresh both friend requests and friends lists
      fetchFriendRequests(true);
      fetchFriends(true);
      
      // Update parent Profile component's follow counts if friend request was accepted
      if (response === 'accepted' && onFollowCountsUpdate) {
        onFollowCountsUpdate();
      }
      
      // Refresh parent Profile component's friend requests data
      if (onRefreshRequests) {
        onRefreshRequests();
      }

    } catch (error) {
      console.error('🚨 Error responding to friend request:', error);
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
              console.log(`🔍 Removing friend - user: ${profile.id}, friend: ${friendId}`);
              
              // Since RPC function has conflicts, handle this manually with direct database operations
              // Remove both directions of the friendship
              const { error: removeError } = await supabase
                .from('friends')
                .delete()
                .or(`and(user_id.eq.${profile.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${profile.id})`);

              console.log('📤 Friend removal result:', { error: removeError });

              if (removeError) {
                console.error('🚨 Error removing friend:', removeError);
                throw removeError;
              }

              // Also clean up any old friend requests between these users to allow fresh requests
              console.log('🧹 Cleaning up old friend requests between users...');
              const { error: cleanupError } = await supabase
                .from('friend_requests')
                .delete()
                .or(`and(sender_id.eq.${profile.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${profile.id})`);

              if (cleanupError) {
                console.log('⚠️ Warning: Could not clean up old friend requests:', cleanupError);
                // Don't throw error here - friend removal was successful
              } else {
                console.log('✅ Old friend requests cleaned up successfully');
              }

              console.log('✅ Friend removed successfully');
              Alert.alert('Success', 'Friend removed successfully');
              fetchFriends(true); // Show loading since user initiated this action
              
              // Update parent Profile component's follow counts
              if (onFollowCountsUpdate) {
                onFollowCountsUpdate();
              }
              
            } catch (error) {
              console.error('🚨 Error removing friend:', error);
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
      console.log(`🔍 FriendsModal: Unfollowing user ${targetEmail} by ${profile.email}`);
      
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

      // Use direct database operations instead of broken RPC function
      const { error: unfollowError } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', profile.id)
        .eq('followed_id', targetUser.id);

      if (unfollowError) {
        console.error('🚨 FriendsModal: Error unfollowing user:', unfollowError);
        throw unfollowError;
      }

      console.log('✅ FriendsModal: Successfully unfollowed user');
      Alert.alert('Success', 'User unfollowed successfully');
      
      fetchFollowing(true); // Refresh following list
      // Update parent Profile component's follow counts
      if (onFollowCountsUpdate) {
        onFollowCountsUpdate();
      }
    } catch (error) {
      console.error('🚨 FriendsModal: Error unfollowing user:', error);
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
    fetchFollowers(true); // Force refresh followers with loading
    fetchFollowing(true); // Force refresh following with loading to catch new auto-follows
    
    // Also refresh parent Profile component's data
    if (onRefreshRequests) {
      console.log('🔄 FriendsModal: Requesting parent to refresh friend requests data...');
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
                    console.log('🔄 Manual refresh triggered...');
                    fetchFriendRequests(true);
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