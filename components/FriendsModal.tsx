import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, TextInput, Alert, ActivityIndicator, Modal, ScrollView, Animated, PanResponder, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors, gradients } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '@/lib/GlobalDataManager';
import UserProfileModal from './UserProfileModal';
import SocialDataManager, { Friend, FriendRequest, Follower, Following } from '@/lib/SocialDataManager';
import { LinearGradient } from 'expo-linear-gradient';

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

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;

// Separate component for animated user items with swipe functionality
const AnimatedUserItem = React.memo(({ 
  user, 
  type, 
  index, 
  colorScheme, 
  onUserPress, 
  onRemoveFriend, 
  onUnfollow, 
  onAcceptRequest, 
  onDeclineRequest,
  onItemRemoved,
  isRemoving
}: {
  user: any;
  type: 'friend' | 'follower' | 'following' | 'request';
  index: number;
  colorScheme: 'light' | 'dark';
  onUserPress: (userId: number, userName: string, userEmail: string) => void;
  onRemoveFriend: (friendId: number) => void;
  onUnfollow: (userEmail: string) => void;
  onAcceptRequest: (requestId: number) => void;
  onDeclineRequest: (requestId: number) => void;
  onItemRemoved: (userId: number, type: string) => void;
  isRemoving: boolean;
}) => {
  const userId = user.friend_id || user.follower_id || user.following_id || user.sender_id;
  const userName = user.friend_name || user.follower_name || user.following_name || user.sender_name;
  const userEmail = user.friend_email || user.follower_email || user.following_email || user.sender_email;
  const key = user.friendship_id || user.request_id || `${type}-${userId}`;

  // Animation values
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const translateX = useRef(new Animated.Value(50)).current;
  const cardTranslateX = useRef(new Animated.Value(0)).current;
  const heightAnim = useRef(new Animated.Value(72)).current;

  // Create pan responder for swipe functionality
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Allow both leftward and rightward movement for requests, only rightward for others
        const isRequest = type === 'request';
        const minDistance = 15;
        const maxVerticalDistance = 30;
        
        if (isRequest) {
          // For requests, allow both directions
          return Math.abs(gestureState.dx) > minDistance && 
                 Math.abs(gestureState.dy) < maxVerticalDistance;
        } else {
          // For others, only allow rightward movement
          return Math.abs(gestureState.dx) > minDistance && 
                 Math.abs(gestureState.dy) < maxVerticalDistance && 
                 gestureState.dx > 0;
        }
      },
      onPanResponderGrant: () => {
        // Add haptic feedback or visual feedback here if needed
      },
      onPanResponderMove: (evt, gestureState) => {
        const isRequest = type === 'request';
        
        if (isRequest) {
          // For requests, allow movement in both directions
          const maxDistance = CARD_WIDTH * 0.8;
          const translateValue = Math.max(-maxDistance, Math.min(gestureState.dx, maxDistance));
          cardTranslateX.setValue(translateValue);
        } else {
          // For others, only allow rightward movement
          const translateValue = Math.max(0, Math.min(gestureState.dx, CARD_WIDTH * 0.8));
          cardTranslateX.setValue(translateValue);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        const releaseVelocity = gestureState.vx;
        const translateDistance = gestureState.dx;
        const isRequest = type === 'request';
        
        if (isRequest) {
          // For requests, handle both directions
          const threshold = CARD_WIDTH * 0.4;
          const velocityThreshold = 0.5;
          
          if (translateDistance > threshold || (translateDistance > CARD_WIDTH * 0.2 && releaseVelocity > velocityThreshold)) {
            // Swipe right - decline request
            Animated.parallel([
              Animated.timing(cardTranslateX, {
                toValue: CARD_WIDTH,
                duration: 150,
                useNativeDriver: true,
              }),
              Animated.timing(heightAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: false,
              }),
              Animated.timing(opacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              })
            ]).start(() => {
              onItemRemoved(userId, type);
              onDeclineRequest(user.request_id);
            });
          } else if (translateDistance < -threshold || (translateDistance < -CARD_WIDTH * 0.2 && releaseVelocity < -velocityThreshold)) {
            // Swipe left - accept request
            Animated.parallel([
              Animated.timing(cardTranslateX, {
                toValue: -CARD_WIDTH,
                duration: 150,
                useNativeDriver: true,
              }),
              Animated.timing(heightAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: false,
              }),
              Animated.timing(opacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              })
            ]).start(() => {
              onItemRemoved(userId, type);
              onAcceptRequest(user.request_id);
            });
          } else {
            // Snap back
            Animated.spring(cardTranslateX, {
              toValue: 0,
              useNativeDriver: true,
              tension: 200,
              friction: 8,
            }).start();
          }
        } else {
          // For others, only handle rightward swipe (delete)
          const shouldDelete = translateDistance > CARD_WIDTH * 0.4 || 
                             (translateDistance > CARD_WIDTH * 0.2 && releaseVelocity > 0.5);
          
          if (shouldDelete) {
            Animated.parallel([
              Animated.timing(cardTranslateX, {
                toValue: CARD_WIDTH,
                duration: 150,
                useNativeDriver: true,
              }),
              Animated.timing(heightAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: false,
              }),
              Animated.timing(opacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              })
            ]).start(() => {
              onItemRemoved(userId, type);
              
              if (type === 'friend') {
                onRemoveFriend(userId);
              } else if (type === 'following') {
                onUnfollow(userEmail);
              }
            });
          } else {
            Animated.spring(cardTranslateX, {
              toValue: 0,
              useNativeDriver: true,
              tension: 200,
              friction: 8,
            }).start();
          }
        }
      },
      onPanResponderTerminate: () => {
        // Handle gesture interruption
        Animated.spring(cardTranslateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 200,
          friction: 8,
        }).start();
      },
    })
  ).current;

  // Animate in with staggered delay
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }, index * 50);
    
    return () => clearTimeout(timer);
  }, [key, index]);

  // Animate button press
  const animateButtonPress = () => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Don't render if item is being removed
  if (isRemoving) {
    return null;
  }

  return (
    <Animated.View style={{ 
      position: 'relative', 
      width: '100%', 
      height: heightAnim,
      marginBottom: 3,
      overflow: 'hidden'
    }}>
      {/* Background icons revealed as card is dragged */}
      <View style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'flex-start',
        zIndex: 0,
        height: 72,
      }} pointerEvents="none">
        <View style={{
          width: 60,
          height: 72,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <Ionicons name="trash" size={32} color="#FF0005" />
        </View>
      </View>
      
      {/* Accept icon for requests (swipe left) */}
      {type === 'request' && (
        <View style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '100%',
          justifyContent: 'center',
          alignItems: 'flex-end',
          zIndex: 0,
          height: 72,
        }} pointerEvents="none">
          <View style={{
            width: 60,
            height: 72,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
          </View>
        </View>
      )}
      
      <Animated.View
        style={{
          transform: [{ translateX: cardTranslateX }],
          zIndex: 1,
        }}
        {...panResponder.panHandlers}
      >
        <Animated.View 
          style={[
            styles.userItem, 
            { 
              backgroundColor: Colors[colorScheme as keyof typeof Colors].card,
              opacity,
              transform: [
                { scale },
                { translateX }
              ],
            }
          ]}
        >
          <LinearGradient
            colors={[
              'rgba(255,0,5,0.5)',
              'rgba(255,77,157,0.5)',
              'rgba(255,105,226,0.5)',
              'rgba(185,122,255,0.5)',
              'rgba(158,149,189,0.5)'
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            locations={[0, 0.25, 0.5, 0.75, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          
          <TouchableOpacity 
            style={styles.userInfo}
            onPress={() => onUserPress(userId, userName, userEmail)}
            activeOpacity={0.85}
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
              <Text style={[styles.userName, { color: Colors[colorScheme as keyof typeof Colors].text }]}>
                {userName}
              </Text>
              <Text style={[styles.userEmail, { color: Colors[colorScheme as keyof typeof Colors].text }]}>
                {userEmail}
              </Text>
              {type === 'request' && (
                <View style={styles.dateContainer}>
                  <Ionicons name="time-outline" size={12} color="#9E95BD" />
                  <Text style={[styles.dateText, { color: Colors[colorScheme as keyof typeof Colors].text }]}>
                    Sent {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          
          {/* No action buttons needed for requests - both accept and decline are handled by swiping */}
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
});

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
  
  // Add state for tracking items being removed
  const [removingItems, setRemovingItems] = useState<Set<string>>(new Set());
  
  // Tab switching animation
  const tabSwitchAnim = useRef(new Animated.Value(1)).current;
  
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
        
        // Immediately update UI by filtering out the accepted request
        const updatedRequests = friendRequests.filter(req => req.request_id !== requestId);
        onRequestsUpdate(updatedRequests);
        
        // Use SocialDataManager to accept friend request (auto-updates cache)
        success = await socialDataManager.acceptFriendRequest(requestId, request.sender_id, profile.id);
        
        if (success) {
          // Show success message without blocking UI
          setTimeout(() => {
            Alert.alert('Success', 'Friend request accepted! You are now friends.');
          }, 100);
        } else {
          // Revert UI change if backend failed
          onRequestsUpdate(friendRequests);
          Alert.alert('Error', 'Failed to accept friend request');
          return;
        }

        // Refresh parent Profile component's social data (triggers cache refresh)
        if (onFollowCountsUpdate) {
          onFollowCountsUpdate();
        }
        
        if (onRefreshRequests) {
          onRefreshRequests();
        }
      } else {
        // Mark item as removing for smooth animation
        const itemKey = `request-${requestId}`;
        setRemovingItems(prev => new Set([...prev, itemKey]));
        
        // Immediately update UI by filtering out the declined request
        const updatedRequests = friendRequests.filter(request => request.request_id !== requestId);
        onRequestsUpdate(updatedRequests);
        
        // Use SocialDataManager to decline friend request (auto-updates cache)
        success = await socialDataManager.declineFriendRequest(requestId, profile.id);
        
        if (success) {
          // Show success message without blocking UI
          setTimeout(() => {
            Alert.alert('Success', `Friend request ${response}.`);
          }, 100);
        } else {
          // Revert UI change if backend failed
          onRequestsUpdate(friendRequests);
          setRemovingItems(prev => {
            const newSet = new Set(prev);
            newSet.delete(itemKey);
            return newSet;
          });
          Alert.alert('Error', `Failed to ${response} friend request`);
          return;
        }

        // Refresh parent Profile component's social data (triggers cache refresh)
        if (onFollowCountsUpdate) {
          onFollowCountsUpdate();
        }
        
        if (onRefreshRequests) {
          onRefreshRequests();
        }
      }

    } catch (error) {
      console.error('🚨 OFFLINE-FIRST: Error responding to friend request:', error);
      Alert.alert('Error', 'Failed to respond to friend request');
    }
  };

  const removeFriend = async (friendId: number) => {
    if (!profile?.id) return;
    
    try {
      console.log(`🚀 OFFLINE-FIRST: Removing friend - user: ${profile.id}, friend: ${friendId}`);
      
      // Mark item as removing for smooth animation
      const itemKey = `friend-${friendId}`;
      setRemovingItems(prev => new Set([...prev, itemKey]));
      
      // Immediately update UI by filtering out the removed friend
      const updatedFriends = friends.filter(friend => friend.friend_id !== friendId);
      onFriendsUpdate(updatedFriends);
      
      // Use SocialDataManager to remove friend (auto-updates cache)
      const success = await socialDataManager.removeFriend(profile.id, friendId);
      
      if (success) {
        // Show success message without blocking UI
        setTimeout(() => {
          Alert.alert('Success', 'Friend removed successfully');
        }, 100);
        
        // Update parent Profile component's social data (triggers cache refresh)
        if (onFollowCountsUpdate) {
          onFollowCountsUpdate();
        }
      } else {
        // Revert UI change if backend failed
        onFriendsUpdate(friends);
        setRemovingItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(itemKey);
          return newSet;
        });
        Alert.alert('Error', 'Failed to remove friend');
      }
      
    } catch (error) {
      console.error('🚨 OFFLINE-FIRST: Error removing friend:', error);
      // Revert UI change if error occurred
      onFriendsUpdate(friends);
      const itemKey = `friend-${friendId}`;
      setRemovingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemKey);
        return newSet;
      });
      Alert.alert('Error', 'Failed to remove friend');
    }
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

      // Mark item as removing for smooth animation
      const itemKey = `following-${targetUser.id}`;
      setRemovingItems(prev => new Set([...prev, itemKey]));

      // Immediately update UI by filtering out the unfollowed user
      const updatedFollowing = following.filter(follow => follow.following_email !== targetEmail);
      setFollowing(updatedFollowing);

      // Use SocialDataManager to unfollow user (auto-updates cache)
      const success = await socialDataManager.unfollowUser(profile.id, targetUser.id);

      if (success) {
        // Show success message without blocking UI
        setTimeout(() => {
          Alert.alert('Success', 'User unfollowed successfully');
        }, 100);
        
        // Update parent Profile component's social data (triggers cache refresh)
        if (onFollowCountsUpdate) {
          onFollowCountsUpdate();
        }
      } else {
        // Revert UI change if backend failed
        setFollowing(following);
        setRemovingItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(itemKey);
          return newSet;
        });
        Alert.alert('Error', 'Failed to unfollow user');
      }

    } catch (error) {
      console.error('🚨 OFFLINE-FIRST: Error unfollowing user:', error);
      // Revert UI change if error occurred
      setFollowing(following);
      // Note: targetUser might not be available in catch block, so we can't clean up removingItems
      Alert.alert('Error', 'Failed to unfollow user');
    }
  };

  // Handle tab switching and mark as viewed
  const handleTabSwitch = async (tab: 'friends' | 'followers' | 'following' | 'requests') => {
    // Animate tab switch
    Animated.sequence([
      Animated.timing(tabSwitchAnim, {
        toValue: 0.7,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(tabSwitchAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    
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
    } else {
      // Clear removing items when modal closes
      setRemovingItems(new Set());
    }
  }, [visible]);

  // Clear removing items when data changes (indicating successful removal)
  useEffect(() => {
    setRemovingItems(new Set());
  }, [friends, followers, following, friendRequests]);

  // Comprehensive animation cleanup on component unmount
  useEffect(() => {
    return () => {
      // Stop all animations to prevent memory leaks
      console.log('🧹 FriendsModal: Cleaning up animations');
      
      // Stop tab switch animation
      tabSwitchAnim.stopAnimation();
      
      // Clear removing items state
      setRemovingItems(new Set());
    };
  }, []);

  // Open user profile modal
  const handleUserProfileNavigation = (userId: number, userName: string, userEmail: string) => {
    setSelectedUserId(userId);
    setSelectedUserName(userName);
    setSelectedUserEmail(userEmail);
    setUserProfileModalVisible(true);
  };

  const handleItemRemoved = (userId: number, type: string) => {
    // This function will be called when an item is removed via swipe
    // Mark the item as being removed to prevent re-rendering issues
    const itemKey = `${type}-${userId}`;
    setRemovingItems(prev => new Set([...prev, itemKey]));
    
    // Remove from removing items after animation completes
    setTimeout(() => {
      setRemovingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemKey);
        return newSet;
      });
    }, 300);
    
    console.log(`Item removed: ${type} with ID ${userId}`);
  };

  const renderUserItem = (user: any, type: 'friend' | 'follower' | 'following' | 'request', index: number) => {
    // Create wrapper functions for request handlers
    const handleAcceptRequest = (requestId: number) => {
      respondToFriendRequest(requestId, 'accepted');
    };

    const handleDeclineRequest = (requestId: number) => {
      respondToFriendRequest(requestId, 'declined');
    };

    const userId = user.friend_id || user.follower_id || user.following_id || user.sender_id;
    const itemKey = `${type}-${userId}`;
    const isRemoving = removingItems.has(itemKey);

    return (
      <AnimatedUserItem
        key={itemKey}
        user={user}
        type={type}
        index={index}
        colorScheme={colorScheme ?? 'light'}
        onUserPress={handleUserProfileNavigation}
        onRemoveFriend={removeFriend}
        onUnfollow={handleUnfollow}
        onAcceptRequest={handleAcceptRequest}
        onDeclineRequest={handleDeclineRequest}
        onItemRemoved={handleItemRemoved}
        isRemoving={isRemoving}
      />
    );
  };

  const renderTabContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].accent} style={styles.loader} />
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
      <Animated.View style={{ flex: 1, opacity: tabSwitchAnim }}>
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {data.map((item, index) => renderUserItem(item, type, index))}
        </ScrollView>
      </Animated.View>
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
    backgroundColor: Colors.light.secondary,
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
    backgroundColor: Colors.light.primary,
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.light.primary,
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
    backgroundColor: Colors.light.primary,
    shadowColor: Colors.light.primary,
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
    paddingHorizontal: 8,
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
    alignItems: 'center',
    backgroundColor: '#fff',
    height: 72,
    overflow: 'hidden',
    padding: 12,
    width: '100%',
    borderRadius: 8,
    position: 'relative',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingTop: 2,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F5F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'rgba(158, 149, 189, 0.1)',
  },
  userAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  userDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    opacity: 0.8,
    fontWeight: '400',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dateText: {
    fontSize: 10,
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
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unfollowButton: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: Colors.light.error,
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: Colors.light.success,
    borderRadius: 10,
    padding: 12,
    minWidth: 40,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.2)',
  },
  declineButton: {
    backgroundColor: Colors.light.error,
    borderRadius: 10,
    padding: 12,
    minWidth: 40,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.2)',
  },
}); 