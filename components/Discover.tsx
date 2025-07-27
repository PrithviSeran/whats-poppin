import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, SafeAreaView, ScrollView, Image, TouchableOpacity, Dimensions, Modal, Animated, LayoutRectangle, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors, gradients } from '@/constants/Colors';
import MainFooter from './MainFooter';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import GlobalDataManager, { EventCard, UserProfile } from '@/lib/GlobalDataManager';
import SocialDataManager from '@/lib/SocialDataManager';
import EventDetailModal from './EventDetailModal';
import * as Location from 'expo-location';
import EventCardComponent from './EventCard';
import UserProfileModal from './UserProfileModal';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = (width - 45) / 2; // 2 cards per row with padding
const ITEMS_PER_PAGE = 10;

// User search interfaces
interface SearchUser {
  user_id: number; // This handles BIGINT from PostgreSQL
  name: string;
  username?: string; // Add username field
  email: string;
  friendship_status: 'pending' | 'accepted' | 'blocked' | 'declined' | 'incoming' | null;
  following_status: boolean; // Whether current user is following this user
}

interface Friend {
  friend_id: number;
  friend_name: string;
  friend_email: string;
  friendship_id: number;
  status: 'pending' | 'accepted' | 'blocked' | 'declined';
  created_at: string;
}

// We'll show a "No Image Found" placeholder instead of a default image

// Helper function to check if an event is expiring soon
const isEventExpiringSoon = (event: EventCard): boolean => {
  if (!event || event.occurrence === 'Weekly') {
    return false; // Weekly events don't expire
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  // Check start_date or end_date for one-time events
  const eventDate = event.end_date || event.start_date;
  if (eventDate) {
    try {
      const eventDateTime = new Date(eventDate);
      const eventDateOnly = new Date(eventDateTime.getFullYear(), eventDateTime.getMonth(), eventDateTime.getDate());
      
      // Event is expiring soon if it's happening within the next 7 days
      return eventDateOnly >= today && eventDateOnly <= nextWeek;
    } catch (error) {
      console.error('Error parsing event date:', error);
      return false;
    }
  }

  return false;
};

// Extend EventCard to include isLiked
interface ExtendedEventCard extends EventCard {
  isLiked?: boolean;
}

// Memoized user item component with optimized animations
const UserItem = React.memo(({ 
  user, 
  index, 
  colorScheme, 
  onUserPress 
}: {
  user: SearchUser;
  index: number;
  colorScheme: 'light' | 'dark';
  onUserPress: (userId: number, userName: string, userEmail: string, friendshipStatus?: 'pending' | 'accepted' | 'blocked' | 'declined' | 'incoming' | null) => void;
}) => {
  // Lazy initialization of animations - only create when actually needed
  const [animationsCreated, setAnimationsCreated] = useState(false);
  const opacity = useRef<Animated.Value | null>(null);
  const scale = useRef<Animated.Value | null>(null);
  const translateX = useRef<Animated.Value | null>(null);

  // Initialize animations only when component becomes visible
  const initializeAnimations = () => {
    if (animationsCreated) return;
    
    opacity.current = new Animated.Value(0);
    scale.current = new Animated.Value(0.95);
    translateX.current = new Animated.Value(20);
    setAnimationsCreated(true);
    
    // Simple, fast animation
    Animated.parallel([
      Animated.timing(opacity.current, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scale.current, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateX.current, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Initialize animations on mount with reduced delay
  useEffect(() => {
    const timer = setTimeout(() => {
      initializeAnimations();
    }, Math.min(index * 25, 100)); // Reduce stagger and cap at 100ms
    
    return () => clearTimeout(timer);
  }, [user.user_id, index]);

  return (
    <Animated.View 
      style={[
        { 
          position: 'relative', 
          width: '100%', 
          height: 72, 
          marginBottom: 3,
          overflow: 'hidden',
          opacity: opacity.current || 1,
          transform: [
            { scale: scale.current || 1 },
            { translateX: translateX.current || 0 }
          ],
        }
      ]}
    >
      <View style={[styles.userItem, { backgroundColor: Colors[colorScheme ?? 'light'].card, position: 'relative', overflow: 'hidden' }]}>
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
          onPress={() => onUserPress(user.user_id, user.name, user.email, user.friendship_status)}
          activeOpacity={0.85}
        >
          <View style={styles.userAvatar}>
            <Image 
              source={{ 
                uri: `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/user-images/${user.email.replace('@', '_').replace(/\./g, '_')}/profile.jpg` 
              }}
              style={styles.userAvatarImage}
              defaultSource={require('../assets/images/icon.png')}
              onError={() => {
                console.log(`Failed to load profile image for user ${user.email}`);
              }}
            />
          </View>
          <View style={styles.userDetails}>
            <Text style={[styles.userName, { color: Colors[colorScheme ?? 'light'].text }]}>
              {user.username ? `@${user.username}` : '<testing account>'}
            </Text>
            <Text style={[styles.userEmail, { color: Colors[colorScheme ?? 'light'].text }]}>
              {user.name}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  return (
    prevProps.user.user_id === nextProps.user.user_id &&
    prevProps.index === nextProps.index &&
    prevProps.colorScheme === nextProps.colorScheme &&
    prevProps.user.name === nextProps.user.name &&
    prevProps.user.username === nextProps.user.username &&
    prevProps.user.email === nextProps.user.email
  );
});

export default function Discover() {
  const [events, setEvents] = useState<ExtendedEventCard[]>([]);
  const [allEvents, setAllEvents] = useState<ExtendedEventCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ExtendedEventCard | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loadedEventIds, setLoadedEventIds] = useState<Set<number>>(new Set());
  const [cardLayout, setCardLayout] = useState<LayoutRectangle | null>(null);
  const [hiddenCardId, setHiddenCardId] = useState<number | null>(null);
  const [sharedEvent, setSharedEvent] = useState<ExtendedEventCard | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullToRefreshEnabled, setPullToRefreshEnabled] = useState(false);
  const [refreshTriggered, setRefreshTriggered] = useState(false);
  const refreshAnimation = useRef(new Animated.Value(0)).current;

  // Search mode state
  const [searchMode, setSearchMode] = useState<'events' | 'users'>('events');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showTransitionLoader, setShowTransitionLoader] = useState(false);
  
  // User search states
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  // UserProfileModal state
  const [userProfileModalVisible, setUserProfileModalVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number>(0);
  const [selectedUserName, setSelectedUserName] = useState<string>('');
  const [selectedUserEmail, setSelectedUserEmail] = useState<string>('');
  const [selectedFriendshipStatus, setSelectedFriendshipStatus] = useState<'pending' | 'accepted' | 'blocked' | 'declined' | 'incoming' | null>(null);

  // Animation refs
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateXAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  
  // User item animation refs
  const userItemAnimations = useRef<{ [key: number]: Animated.Value }>({}).current;

  // Ref to store the modal close timeout
  const modalCloseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const colorScheme = useColorScheme();
  const dataManager = GlobalDataManager.getInstance();

  // Add cardRefs at the top of the component
  const cardRefs = useRef<{ [key: number]: any }>({});

  // Recent searches functions
  const loadRecentSearches = async () => {
    try {
      const savedSearches = await AsyncStorage.getItem('recentUserSearches');
      if (savedSearches) {
        const searches = JSON.parse(savedSearches);
        setRecentSearches(searches);
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  };

  const saveRecentSearch = async (query: string) => {
    if (!query.trim()) return;
    
    try {
      const trimmedQuery = query.trim();
      const updatedSearches = [trimmedQuery, ...recentSearches.filter(search => search !== trimmedQuery)].slice(0, 5);
      setRecentSearches(updatedSearches);
      await AsyncStorage.setItem('recentUserSearches', JSON.stringify(updatedSearches));
    } catch (error) {
      console.error('Error saving recent search:', error);
    }
  };

  const clearRecentSearches = async () => {
    try {
      setRecentSearches([]);
      await AsyncStorage.removeItem('recentUserSearches');
    } catch (error) {
      console.error('Error clearing recent searches:', error);
    }
  };

  const removeRecentSearch = async (searchToRemove: string) => {
    try {
      const updatedSearches = recentSearches.filter(search => search !== searchToRemove);
      setRecentSearches(updatedSearches);
      await AsyncStorage.setItem('recentUserSearches', JSON.stringify(updatedSearches));
    } catch (error) {
      console.error('Error removing recent search:', error);
    }
  };

  // User search functions
  const searchUsers = async (query: string) => {
    if (!userProfile?.id || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    
    try {
      setUserLoading(true);
      
      // First, search by username if query doesn't start with @ (prioritize username search)
      let users: any[] = [];
      let searchError: any = null;
      
      // Search by username first (prioritized)
      const { data: usernameUsers, error: usernameError } = await supabase
        .from('all_users')
        .select('id, name, username, email')
        .ilike('username', `%${query.trim()}%`)
        .neq('id', userProfile.id)
        .not('username', 'is', null)
        .limit(10);

      if (usernameError) {
        console.error('Error searching by username:', usernameError);
      } else if (usernameUsers && usernameUsers.length > 0) {
        users = usernameUsers;
      }

      // If no username matches found, search by name
      if (users.length === 0) {
        const { data: nameUsers, error: nameError } = await supabase
          .from('all_users')
          .select('id, name, username, email')
          .ilike('name', `%${query.trim()}%`)
          .neq('id', userProfile.id)
          .limit(10);

        if (nameError) {
          searchError = nameError;
        } else if (nameUsers) {
          users = nameUsers;
        }
      }

      if (searchError) throw searchError;

      if (!users || users.length === 0) {
        setSearchResults([]);
        return;
      }

      // Get user IDs for batch queries
      const userIds = users.map(user => user.id);

      // Check friendship status for all users in parallel
      const { data: friendships } = await supabase
        .from('friends')
        .select('friend_id, status')
        .eq('user_id', userProfile.id)
        .in('friend_id', userIds);

      // Check outgoing friend requests in parallel
      const { data: sentRequests } = await supabase
        .from('friend_requests')
        .select('receiver_id, status')
        .eq('sender_id', userProfile.id)
        .in('receiver_id', userIds)
        .eq('status', 'pending');

      // Check incoming friend requests in parallel
      const { data: receivedRequests } = await supabase
        .from('friend_requests')
        .select('sender_id, status')
        .eq('receiver_id', userProfile.id)
        .in('sender_id', userIds)
        .eq('status', 'pending');

      // Check following status in parallel
      const { data: followingRelations } = await supabase
        .from('follows')
        .select('followed_id')
        .eq('follower_id', userProfile.id)
        .in('followed_id', userIds);

      // Transform the results
      const searchResults: SearchUser[] = users.map(user => {
        // Determine friendship status
        let friendshipStatus: SearchUser['friendship_status'] = null;
        
        const friendship = friendships?.find(f => f.friend_id === user.id);
        if (friendship?.status === 'accepted') {
          friendshipStatus = 'accepted';
        } else {
          const sentRequest = sentRequests?.find(r => r.receiver_id === user.id);
          const receivedRequest = receivedRequests?.find(r => r.sender_id === user.id);
          
          if (sentRequest) {
            friendshipStatus = 'pending';
          } else if (receivedRequest) {
            friendshipStatus = 'incoming';
          }
        }

        // Determine following status
        const isFollowing = followingRelations?.some(f => f.followed_id === user.id) || false;

        return {
          user_id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          friendship_status: friendshipStatus,
          following_status: isFollowing
        };
      });

      setSearchResults(searchResults);
    } catch (error) {
      console.error('Error searching users:', error);
      Alert.alert('Error', 'Failed to search users');
    } finally {
      setUserLoading(false);
    }
  };

  const sendFriendRequest = async (receiverId: number) => {
    if (!userProfile?.id) {
      console.error('No current user ID available for sending friend request');
      Alert.alert('Error', 'User profile not loaded properly');
      return;
    }
    
    console.log(`🔍 Discover: Sending friend request from user ${userProfile.id} to user ${receiverId}`);
    
    try {
      // Check if a friend request already exists to avoid duplicates
      console.log(`🔍 Checking for existing friend request: sender=${userProfile.id}, receiver=${receiverId}`);
      const { data: existingRequest, error: checkError } = await supabase
        .from('friend_requests')
        .select('id, status')
        .eq('sender_id', userProfile.id)
        .eq('receiver_id', receiverId)
        .maybeSingle();

      console.log('📋 Existing request check result:', { data: existingRequest, error: checkError });

      if (checkError) {
        console.error('🚨 Error checking existing friend request:', checkError);
        throw checkError;
      }

      if (existingRequest) {
        console.log(`📝 Found existing request with status: ${existingRequest.status}`);
        if (existingRequest.status === 'pending') {
          console.log('⚠️ Friend request already pending');
          Alert.alert('Info', 'Friend request already sent');
          // Refresh search results to update button states
          if (searchQuery.trim().length >= 2) {
            searchUsers(searchQuery);
          }
          return;
        } else if (existingRequest.status === 'declined' || existingRequest.status === 'accepted') {
          // Update existing declined/accepted request to pending (for when friendship was removed)
          console.log(`🔄 Updating ${existingRequest.status} request to pending...`);
          const { error: updateError } = await supabase
            .from('friend_requests')
            .update({ 
              status: 'pending', 
              updated_at: new Date().toISOString() 
            })
            .eq('id', existingRequest.id);

          if (updateError) {
            console.error('🚨 Error updating friend request:', updateError);
            throw updateError;
          }

          console.log(`✅ Previous ${existingRequest.status} request updated to pending`);
        }
      } else {
        // Create new friend request
        console.log('📤 Creating new friend request...');
        const { data: insertData, error: insertError } = await supabase
          .from('friend_requests')
          .insert({
            sender_id: userProfile.id,
            receiver_id: receiverId,
            status: 'pending',
            created_at: new Date().toISOString()
          })
          .select();

        console.log('📤 Friend request insert result:', { data: insertData, error: insertError });

        if (insertError) {
          console.error('🚨 Error creating friend request:', insertError);
          throw insertError;
        }

        console.log('✅ Friend request created successfully:', insertData);
      }

      // Auto-follow the user when sending friend request
      try {
        console.log('🚀 OFFLINE-FIRST: Auto-following user when sending friend request...');
        
        // Use SocialDataManager to follow user (auto-updates cache)
        const socialDataManager = SocialDataManager.getInstance();
        const followSuccess = await socialDataManager.followUser(userProfile.id, receiverId);

        if (followSuccess) {
          console.log('✅ OFFLINE-FIRST: Auto-follow successful');
        } else {
          console.log('⚠️ Auto-follow failed, but friend request was sent');
        }
      } catch (followError) {
        console.log('⚠️ Auto-follow error, but friend request was sent:', followError);
      }

      Alert.alert('Success', 'Friend request sent successfully!');
      
      // Refresh search results to update button states
      if (searchQuery.trim().length >= 2) {
        searchUsers(searchQuery);
      }
      
    } catch (error) {
      console.error('🚨 Error sending friend request:', error);
      Alert.alert('Error', 'Failed to send friend request');
    }
  };

  const handleFollowToggle = async (userId: number, currentlyFollowing: boolean) => {
    if (!userProfile?.id) {
      console.error('No current user ID available for follow action');
      Alert.alert('Error', 'User profile not loaded properly');
      return;
    }
    
    try {
      console.log(`🚀 OFFLINE-FIRST: ${currentlyFollowing ? 'Unfollowing' : 'Following'} user ${userId}`);
      
      // Use SocialDataManager for all follow operations (auto-updates cache)
      const socialDataManager = SocialDataManager.getInstance();
      let success: boolean;

      if (currentlyFollowing) {
        success = await socialDataManager.unfollowUser(userProfile.id, userId);
      } else {
        success = await socialDataManager.followUser(userProfile.id, userId);
      }

      if (success) {
        console.log(`✅ OFFLINE-FIRST: Successfully ${currentlyFollowing ? 'unfollowed' : 'followed'} user`);
        // Refresh search results to update button states
        if (searchQuery.trim().length >= 2) {
          searchUsers(searchQuery);
        }
      } else {
        Alert.alert('Error', `Failed to ${currentlyFollowing ? 'unfollow' : 'follow'} user`);
      }
      
    } catch (error) {
      console.error('🚨 OFFLINE-FIRST: Error toggling follow status:', error);
      Alert.alert('Error', 'Failed to update follow status');
    }
  };

  // Open user profile modal
  const handleUserProfileNavigation = async (userId: number, userName: string, userEmail: string, friendshipStatus?: 'pending' | 'accepted' | 'blocked' | 'declined' | 'incoming' | null) => {
    setSelectedUserId(userId);
    setSelectedUserName(userName);
    setSelectedUserEmail(userEmail);
    
    // Save the current search query to recent searches when user clicks on a user
    if (searchQuery.trim().length >= 2) {
      await saveRecentSearch(searchQuery);
    }
    
    // CRITICAL FIX: The RPC function returns "pending" incorrectly for both sent and received requests
    // We need to determine the correct direction by checking who is the sender vs receiver
    let correctedFriendshipStatus = friendshipStatus;
    
    if (friendshipStatus === 'pending' && userProfile?.id) {
      console.log(`🔍 Discover: Checking friend request direction between current user ${userProfile.id} and target user ${userId}`);
      
      try {
        // Check if current user SENT a request to target user (should show "Request Sent")
        const { data: sentRequest, error: sentError } = await supabase
          .from('friend_requests')
          .select('id')
          .eq('sender_id', userProfile.id)
          .eq('receiver_id', userId)
          .eq('status', 'pending')
          .maybeSingle();

        if (sentError) {
          console.error('🚨 Error checking sent requests:', sentError);
        }

        if (sentRequest) {
          console.log('📤 Current user sent request to target user - status should be "pending"');
          correctedFriendshipStatus = 'pending'; // Current user sent request
        } else {
          // Check if target user SENT a request to current user (should show "Accept/Decline")
          const { data: receivedRequest, error: receivedError } = await supabase
            .from('friend_requests')
            .select('id')
            .eq('sender_id', userId)
            .eq('receiver_id', userProfile.id)
            .eq('status', 'pending')
            .maybeSingle();

          if (receivedError) {
            console.error('🚨 Error checking received requests:', receivedError);
          }

          if (receivedRequest) {
            console.log('📥 Current user received request from target user - status should be "incoming"');
            correctedFriendshipStatus = 'incoming'; // Current user received request
          } else {
            console.log('❓ No pending request found in either direction - setting to null');
            correctedFriendshipStatus = null;
          }
        }
      } catch (error) {
        console.error('🚨 Error checking friend request direction:', error);
        // Fall back to original status if there's an error
      }
    }
    
    console.log(`🎯 Discover: Final friendship status for user ${userId}: ${correctedFriendshipStatus} (original: ${friendshipStatus})`);
    setSelectedFriendshipStatus(correctedFriendshipStatus || null);
    setUserProfileModalVisible(true);
  };

  useEffect(() => {
    let isMounted = true;

    const initializeData = async () => {
      if (!hasInitialLoad && isMounted) {
        setLoading(true);
        try {
          // Initialize global data if not already initialized
          if (!dataManager.isDataInitialized()) {
            await dataManager.initialize();
          }

          // Get user profile for user search functionality
          const profile = await dataManager.getUserProfile();
          setUserProfile(profile);

          // Load recent searches
          await loadRecentSearches();

          // Get user location
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('latitude, longitude')
              .eq('id', userData.user.id)
              .single();
            
            if (profile?.latitude && profile?.longitude) {
              setUserLocation({
                latitude: profile.latitude,
                longitude: profile.longitude
              });
            }
          }

          // Fetch events directly from database
          const { data: events, error } = await supabase
            .from('all_events')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) throw error;

          if (!isMounted) return;

          // Get saved events to filter them out
          const savedEvents = await dataManager.getSavedEvents();
          const savedEventIds = new Set(savedEvents.map((event: ExtendedEventCard) => event.id));

          // Filter out saved events
          const filteredEvents = events.filter(event => !savedEventIds.has(event.id));
          
          // Process events with friends data
          const eventsWithLikes = await Promise.all(
            filteredEvents.map(async (event) => {
              // Randomly select one of the 5 images (0-4) or leave null if no ID
              const randomImageIndex = Math.floor(Math.random() * 5);
              const imageUrl = event.id ? 
                `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/event-images/${event.id}/${randomImageIndex}.jpg` : 
                null;

              // Fetch friends who saved this event
              let friendsWhoSaved: { id: number; name: string; email: string }[] = [];
              try {
                friendsWhoSaved = await dataManager.getFriendsWhoSavedEvent(event.id);
              } catch (error) {
                console.error(`Error fetching friends for event ${event.id} in initializeData:`, error);
              }

              return {
                ...event,
                image: imageUrl,
                isLiked: false, // These are unsaved events
                allImages: event.id ? Array.from({ length: 5 }, (_, i) => 
                  `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/event-images/${event.id}/${i}.jpg`
                ) : [],
                friendsWhoSaved
              } as ExtendedEventCard;
            })
          );

          // Shuffle the events array only once during initialization
          const shuffledEvents = [...eventsWithLikes].sort(() => Math.random() - 0.5);

          setAllEvents(shuffledEvents);
          setEvents(shuffledEvents.slice(0, ITEMS_PER_PAGE));
          setLoadedEventIds(new Set(shuffledEvents.slice(0, ITEMS_PER_PAGE).map(e => e.id)));
          setHasInitialLoad(true);
        } catch (error) {
          console.error('Error initializing data:', error);
          setError('Failed to load events');
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      }
    };

    // Listen for data updates - only refresh liked status, not entire data
    const handleDataUpdate = async () => {
      if (isMounted) {
        try {
          // Only sync the liked status instead of reloading everything
          const savedEvents = await dataManager.getSavedEvents();
          const savedEventIds = new Set(savedEvents.map((event: ExtendedEventCard) => event.id));
          setEvents(prevEvents =>
            prevEvents.map(event => ({
              ...event,
              isLiked: savedEventIds.has(event.id)
            } as ExtendedEventCard))
          );
        } catch (error) {
          console.error('Error updating liked status:', error);
        }
      }
    };

    // Listen for saved events updates from other components
    const handleSavedEventsUpdate = (updatedSavedEvents: ExtendedEventCard[]) => {
      console.log('Discover: Received savedEventsUpdated event with', updatedSavedEvents.length, 'events');
      if (isMounted) {
        const savedEventIds = new Set(updatedSavedEvents.map(event => event.id));
        setEvents(prevEvents =>
          prevEvents.map(event => ({
            ...event,
            isLiked: savedEventIds.has(event.id)
          } as ExtendedEventCard))
        );
      }
    };

    // Listen for shared events
    const handleSharedEvent = (event: EventCard) => {
      // Add the shared event to the top of the stack
      setSharedEvent(event as ExtendedEventCard);
      setEvents(prevEvents => {
        // Remove the event if it already exists in the list
        const filteredEvents = prevEvents.filter(e => e.id !== event.id);
        // Add the shared event at the beginning
        return [event as ExtendedEventCard, ...filteredEvents];
      });
    };

    dataManager.on('dataInitialized', handleDataUpdate);
    dataManager.on('savedEventsUpdated', handleSavedEventsUpdate);
    dataManager.on('sharedEventReceived', handleSharedEvent);
    initializeData();

    return () => {
      isMounted = false;
      dataManager.removeListener('dataInitialized', handleDataUpdate);
      dataManager.removeListener('savedEventsUpdated', handleSavedEventsUpdate);
      dataManager.removeListener('sharedEventReceived', handleSharedEvent);
    };
  }, []);

  // Start loading animations
  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Comprehensive animation cleanup on component unmount
  useEffect(() => {
    return () => {
      // Stop all animations to prevent memory leaks
      console.log('🧹 Discover: Cleaning up animations');
      
      // Stop all animated values
      scaleAnim.stopAnimation();
      translateXAnim.stopAnimation();
      translateYAnim.stopAnimation();
      fadeAnim.stopAnimation();
      cardOpacity.stopAnimation();
      pulseAnim.stopAnimation();
      rotateAnim.stopAnimation();
      refreshAnimation.stopAnimation();
      
      // Clean up user item animations
      Object.values(userItemAnimations).forEach(anim => {
        anim.stopAnimation();
      });
      
      // Clear user item animations object
      Object.keys(userItemAnimations).forEach(key => {
        delete (userItemAnimations as any)[key];
      });
    };
  }, []);

  // Use useFocusEffect to handle tab switching with debouncing
  const lastFocusTime = useRef(0);
  
  useFocusEffect(
    React.useCallback(() => {
      const now = Date.now();
      // Debounce rapid tab switches (prevent execution if less than 500ms since last focus)
      if (now - lastFocusTime.current < 500) {
        return;
      }
      lastFocusTime.current = now;

      // Only sync if we're in events mode and have events to update, and not currently transitioning
      if (searchMode !== 'events' || events.length === 0 || isTransitioning) {
        return;
      }

      // Lightweight sync - only update if actually needed
      const syncLikedStatus = async () => {
        try {
          const savedEvents = await dataManager.getSavedEvents();
          const savedEventIds = new Set(savedEvents.map((event: ExtendedEventCard) => event.id));
          
          // Check if any events actually need updating before triggering re-render
          const needsUpdate = events.some(event => 
            event.isLiked !== savedEventIds.has(event.id)
          );
          
          if (!needsUpdate) {
            return; // Skip update if nothing changed
          }
          
          setEvents(prevEvents =>
            prevEvents.map(event => ({
              ...event,
              isLiked: savedEventIds.has(event.id)
            } as ExtendedEventCard))
          );
        } catch (error) {
          console.error('Error syncing liked status:', error);
        }
      };
      
      // Add small delay to ensure smooth transition
      const timeoutId = setTimeout(() => {
        syncLikedStatus();
      }, 100);
      
             return () => clearTimeout(timeoutId);
     }, [dataManager, searchMode, events.length, isTransitioning])
  );

  const loadLikedEvents = async () => {
    try {
      const savedEvents = await dataManager.getSavedEvents();
      const savedEventIds = new Set(savedEvents.map((event: ExtendedEventCard) => event.id));
      setEvents(prevEvents => 
        prevEvents.map(event => ({
          ...event,
          isLiked: savedEventIds.has(event.id)
        } as ExtendedEventCard))
      );
    } catch (error) {
      console.error('Error loading liked events:', error);
    }
  };

  const fetchEvents = async (pageNum: number = 1) => {
    try {
      setIsLoadingMore(true);
      const { data: eventsData, error } = await supabase
        .from('all_events')
        .select('*')
        .order('created_at', { ascending: false })
        .range((pageNum - 1) * ITEMS_PER_PAGE, pageNum * ITEMS_PER_PAGE - 1);

      if (error) throw error;

      // Get saved events to mark them as liked and filter them out
      const savedEvents = await dataManager.getSavedEvents();
      const savedEventIds = new Set(savedEvents.map(event => event.id));

      // Filter out already loaded events and saved events, then map the remaining ones
      const filteredEvents = eventsData.filter(event => !loadedEventIds.has(event.id) && !savedEventIds.has(event.id));
      
      // OPTIMIZED: Batch fetch friends data for all events at once (eliminates N+1 queries)
      const eventIds = filteredEvents.map(event => event.id);
      let friendsDataBatch: { [eventId: number]: { id: number; name: string; email: string }[] } = {};
      
      if (eventIds.length > 0) {
        try {
          friendsDataBatch = await dataManager.getFriendsWhoSavedEventsBatch(eventIds);
        } catch (error) {
          console.error(`Error fetching friends data in batch:`, error);
          // Continue with empty friends data instead of failing
        }
      }

      // OPTIMIZED: Process events synchronously without Promise.all
      const newEvents = filteredEvents.map((event) => {
        // Randomly select one of the 5 images (0-4) or leave null if no ID
        const randomImageIndex = Math.floor(Math.random() * 5);
        const imageUrl = event.id ? 
          `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/event-images/${event.id}/${randomImageIndex}.jpg` : 
          null;

        // Use batched friends data
        const friendsWhoSaved = friendsDataBatch[event.id] || [];

        return {
          ...event,
          image: imageUrl,
          isLiked: false, // These are unsaved events
          occurrence: event.occurrence || 'one-time',
          allImages: event.id ? Array.from({ length: 5 }, (_, i) => 
            `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/event-images/${event.id}/${i}.jpg`
          ) : [],
          friendsWhoSaved
        };
      });

      if (newEvents.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      // Update loaded event IDs
      const newLoadedIds = new Set([...loadedEventIds, ...newEvents.map(e => e.id)]);
      setLoadedEventIds(newLoadedIds);

      if (pageNum === 1) {
        setEvents(newEvents);
      } else {
        setEvents(prev => [...prev, ...newEvents]);
      }
      setPage(pageNum);
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError('Failed to load events. Please try again.');
      setLoading(false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleRefresh = async () => {
    if (!pullToRefreshEnabled || refreshTriggered) return;
    
    setRefreshTriggered(true);
    setIsRefreshing(true);
    setPullToRefreshEnabled(false);
    
    // Add a delay before starting the refresh animation
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Animate the refresh
    Animated.sequence([
      Animated.timing(refreshAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(refreshAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start();

    // Shuffle all events and reset to initial state
    const shuffledEvents = [...allEvents].sort(() => Math.random() - 0.5);
    setAllEvents(shuffledEvents);
    setEvents(shuffledEvents.slice(0, ITEMS_PER_PAGE));
    setPage(1);
    setLoadedEventIds(new Set(shuffledEvents.slice(0, ITEMS_PER_PAGE).map(e => e.id)));
    setHasMore(true);
    
    setIsRefreshing(false);
    setRefreshTriggered(false);
  };

  const handleScroll = ({ nativeEvent }: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const paddingToBottom = 20;
    
    // Check if we need to load more
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
      handleLoadMore();
    }

    // Enable pull to refresh when scrolled to top
    if (contentOffset.y <= 0) {
      setPullToRefreshEnabled(true);
    } else {
      setPullToRefreshEnabled(false);
    }
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      // Always fetch the next page, regardless of current state
      fetchEvents(page + 1);
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    
    if (searchMode === 'events') {
      // Handle event search
      if (text.trim() === '') {
        setEvents(allEvents);
      } else {
        const filtered = allEvents.filter(event =>
          event.name.toLowerCase().includes(text.toLowerCase())
        );
        setEvents(filtered);
      }
    } else {
      // Handle user search
      if (text.trim().length < 2) {
        setSearchResults([]);
      } else {
        searchUsers(text);
      }
    }
  };

  const toggleLike = async (event: ExtendedEventCard) => {
    console.log(`Toggling like for event: ${event.name} (ID: ${event.id}) - Currently liked: ${event.isLiked}`);
    
    try {
      const dataManager = GlobalDataManager.getInstance();
      
      // Optimistically update UI first for better responsiveness
      setEvents(prevEvents => 
        prevEvents.map(e => 
          e.id === event.id ? { ...e, isLiked: !e.isLiked } : e
        )
      );
      
      if (event.isLiked) {
        // Remove from saved events
        console.log(`Removing event ${event.id} from saved events`);
        await dataManager.removeEventFromSavedEvents(event.id);
      } else {
        // Add to saved events
        console.log(`Adding event ${event.id} to saved events`);
        await dataManager.addEventToSavedEvents(event.id);
      }
      
      console.log(`Successfully ${event.isLiked ? 'removed' : 'added'} event ${event.id}`);
      
      // No need to refresh all data - the GlobalDataManager already handles 
      // emitting events to update other components when needed
      
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert the optimistic update if the operation failed
      setEvents(prevEvents => 
        prevEvents.map(e => 
          e.id === event.id ? { ...e, isLiked: !e.isLiked } : e
        )
      );
    }
  };

  const openModal = (event: ExtendedEventCard, layout: LayoutRectangle) => {
    // Clear any pending close timeout before opening
    if (modalCloseTimeout.current) {
      clearTimeout(modalCloseTimeout.current);
      modalCloseTimeout.current = null;
    }
    setSelectedEvent(event);
    setCardLayout(layout);
    setHiddenCardId(event.id);
    setModalVisible(true);

    // Fade out the clicked card
    Animated.timing(cardOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // Calculate the center of the clicked card
    const cardCenterX = layout.x + layout.width / 2;
    const cardCenterY = layout.y + layout.height / 2;

    // Calculate the center of the screen
    const screenCenterX = width / 2;
    const screenCenterY = height / 2;

    // Calculate the translation needed to move from card center to screen center
    const translateX = -(screenCenterX - cardCenterX);
    const translateY = -(screenCenterY - cardCenterY);

    // Set initial values
    translateXAnim.setValue(translateX);
    translateYAnim.setValue(translateY);
    scaleAnim.setValue(0.1);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(translateXAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(translateYAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeModal = () => {
    if (!cardLayout) return;

    // Start fading in the card immediately
    Animated.timing(cardOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // Animate out the modal
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 0.8,
        friction: 5,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.spring(translateXAnim, {
        toValue: 0,
        friction: 5,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.spring(translateYAnim, {
        toValue: 0,
        friction: 5,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setModalVisible(false);
      setSelectedEvent(null);
      setCardLayout(null);
      setHiddenCardId(null);
    });
  };

  const handleEventPress = (event: ExtendedEventCard, layout: LayoutRectangle) => {
    // Clear any pending close timeout before opening
    if (modalCloseTimeout.current) {
      clearTimeout(modalCloseTimeout.current);
      modalCloseTimeout.current = null;
    }
    setSelectedEvent(event);
    setCardLayout(layout);
    setHiddenCardId(event.id);
    setModalVisible(true);

    // Fade out the clicked card for smooth transition
    Animated.timing(cardOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const handleCloseModal = () => {
    // Start fading in the card immediately if it was hidden
    if (hiddenCardId !== null) {
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        // Ensure the opacity is fully reset after animation completes
        cardOpacity.setValue(1);
      });
    }

    setModalVisible(false);
    // Clear the hidden card immediately to prevent flickering
    setHiddenCardId(null);
    // Ensure opacity is reset as a fallback
    cardOpacity.setValue(1);

    // Don't clear the selected event immediately to allow for smooth animation
    if (modalCloseTimeout.current) {
      clearTimeout(modalCloseTimeout.current);
    }
    modalCloseTimeout.current = setTimeout(() => {
      setSelectedEvent(null);
      setCardLayout(null);
      modalCloseTimeout.current = null;
    }, 300); // Match the animation duration
  };

  // Add location permission request
  useEffect(() => {
    const requestLocationPermission = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.error('Permission to access location was denied');
          return;
        }

        let location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch (err) {
        console.error('Error getting user location:', err);
      }
    };

    requestLocationPermission();
  }, []);

  const renderContent = () => {
    if (loading && searchMode === 'events') {
      return (
        <View style={styles.loadingContainer}>
          <Animated.View
            style={[
              styles.loadingCircle,
              {
                transform: [
                  { scale: pulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1.2],
                  })}, 
                  { rotate: rotateAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  })}
                ],
                borderColor: Colors[colorScheme ?? 'light'].accent,
              },
            ]}
          >
            <View style={[styles.innerCircle, { backgroundColor: `${Colors[colorScheme ?? 'light'].accent}20` }]} />
          </Animated.View>
          <Text style={[styles.loadingText, { color: Colors[colorScheme ?? 'light'].text }]}>
            Discovering events...
          </Text>
        </View>
      );
    }

    if (error && searchMode === 'events') {
      return (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: Colors[colorScheme].text }]}>{error}</Text>
        </View>
      );
    }

    // User search mode
    if (searchMode === 'users') {
      if (searchQuery && searchResults.length === 0 && !userLoading) {
        return (
          <View style={styles.noResultsContainer}>
            <Ionicons name="search-outline" size={48} color={Colors[colorScheme ?? 'light'].text} />
            <Text style={[styles.noResultsText, { color: Colors[colorScheme ?? 'light'].text }]}>
              {searchQuery.trim().length >= 2 ? `No users found for "${searchQuery}"` : 'Search for friends'}
            </Text>
            <Text style={[styles.noResultsSubtext, { color: Colors[colorScheme ?? 'light'].text }]}>
              {searchQuery.trim().length >= 2 ? 'Try different keywords or search by username' : 'Search by username or name (2+ characters)'}
            </Text>
          </View>
        );
      }

      return (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {userLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].accent} />
              <Text style={[styles.loadingText, { color: Colors[colorScheme ?? 'light'].text }]}>
                Searching users...
              </Text>
            </View>
          ) : searchQuery.trim().length >= 2 ? (
            // Show search results
            searchResults.length === 0 ? (
              <View style={styles.noResultsContainer}>
                <Ionicons name="people-outline" size={64} color={Colors[colorScheme ?? 'light'].text} />
                <Text style={[styles.noResultsText, { color: Colors[colorScheme ?? 'light'].text }]}>
                  No users found
                </Text>
                <Text style={[styles.noResultsSubtext, { color: Colors[colorScheme ?? 'light'].text }]}>
                  Try different keywords or search by username
                </Text>
              </View>
            ) : (
              <View style={styles.userResultsContainer}>
                {searchResults.map((user, index) => (
                  <UserItem
                    key={user.user_id}
                    user={user}
                    index={index}
                    colorScheme={colorScheme ?? 'light'}
                    onUserPress={handleUserProfileNavigation}
                  />
                ))}
              </View>
            )
          ) : (
            // Show recent searches or empty state
            <View style={styles.recentSearchesContainer}>
              {recentSearches.length > 0 ? (
                <>
                  <View style={styles.recentSearchesHeader}>
                    <Text style={[styles.recentSearchesTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                      Recent Searches
                    </Text>
                    <TouchableOpacity onPress={clearRecentSearches}>
                      <Text style={[styles.clearRecentText, { color: Colors[colorScheme ?? 'light'].accent }]}>
                        Clear All
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {recentSearches.map((search, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[styles.recentSearchItem, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}
                      onPress={() => {
                        setSearchQuery(search);
                        searchUsers(search);
                      }}
                    >
                      <View style={styles.recentSearchContent}>
                        <Ionicons name="time-outline" size={20} color={Colors[colorScheme ?? 'light'].text} />
                        <Text style={[styles.recentSearchText, { color: Colors[colorScheme ?? 'light'].text }]}>
                          {search}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => removeRecentSearch(search)}
                        style={styles.removeSearchButton}
                      >
                        <Ionicons name="close" size={16} color={Colors[colorScheme ?? 'light'].text} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </>
              ) : (
                <View style={styles.noRecentSearchesContainer}>
                  <Ionicons name="search-outline" size={64} color={Colors[colorScheme ?? 'light'].text} />
                  <Text style={[styles.noRecentSearchesText, { color: Colors[colorScheme ?? 'light'].text }]}>
                    No Recent Searches
                  </Text>
                  <Text style={[styles.noRecentSearchesSubtext, { color: Colors[colorScheme ?? 'light'].text }]}>
                    Start searching for friends by username or name
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      );
    }

    // Show transition loader for events mode
    if (showTransitionLoader && searchMode === 'events') {
      return (
        <View style={styles.transitionLoadingContainer}>
          <Animated.View
            style={[
              styles.loadingCircle,
              {
                transform: [
                  { scale: pulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1.2],
                  })}, 
                  { rotate: rotateAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  })}
                ],
                borderColor: Colors[colorScheme ?? 'light'].accent,
              },
            ]}
          >
            <View style={[styles.innerCircle, { backgroundColor: `${Colors[colorScheme ?? 'light'].accent}20` }]} />
          </Animated.View>
          <Text style={[styles.loadingText, { color: Colors[colorScheme ?? 'light'].text }]}>
            Loading events...
          </Text>
        </View>
      );
    }

    // Event search mode (existing code)
    if (searchQuery && events.length === 0 && searchMode === 'events') {
      return (
        <View style={styles.noResultsContainer}>
          <Ionicons name="search-outline" size={48} color={Colors[colorScheme].text} />
          <Text style={[styles.noResultsText, { color: Colors[colorScheme].text }]}>
            No events found for "{searchQuery}"
          </Text>
          <Text style={[styles.noResultsSubtext, { color: Colors[colorScheme].text }]}>
            Try different keywords or browse all events
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            enabled={pullToRefreshEnabled}
            progressViewOffset={10}
                              tintColor={Colors[colorScheme ?? 'light'].secondary}
                  colors={[Colors[colorScheme ?? 'light'].secondary, Colors[colorScheme ?? 'light'].primary]}
            progressBackgroundColor={Colors[colorScheme].background}
          />
        }
      >
        <Animated.View 
          style={[
            styles.gridContainer,
            {
              opacity: refreshAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.3]
              }),
              transform: [{
                scale: refreshAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0.95]
                })
              }]
            }
          ]}
        >
          {/* Show shared event at the top if it exists */}
          {sharedEvent && (
            <View style={styles.sharedEventContainer}>
              <Text style={[styles.sharedEventLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                Shared Event
              </Text>
              <EventCardComponent
                event={sharedEvent}
                onPress={() => handleEventPress(sharedEvent, cardLayout!)}
                onLike={() => toggleLike(sharedEvent)}
                isLiked={!!sharedEvent.isLiked}
                userLocation={userLocation}
                cardRef={(ref) => {
                  if (ref) {
                    cardRefs.current[0] = ref;
                  }
                }}
              />
            </View>
          )}
          {events.map((event, index) => (
            <Animated.View
              key={`${event.id}-${index}`}
              style={{
                opacity: event.id === hiddenCardId ? cardOpacity : 1,
              }}
            >
              <TouchableOpacity
                style={[
                  styles.card,
                  { backgroundColor: Colors[colorScheme ?? 'light'].card }
                ]}
                onPress={() => {
                  // Measure the card position when pressed
                  const cardRef = cardRefs.current[index];
                  if (cardRef && cardRef.measure) {
                    cardRef.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
                      const layout = { x: pageX, y: pageY, width, height };
                      setCardLayout(layout);
                      handleEventPress(event, layout);
                    });
                  } else {
                    // Fallback if measurement fails - use a default layout
                    const defaultLayout = { x: 0, y: 0, width: CARD_WIDTH, height: CARD_WIDTH * 1.2 };
                    handleEventPress(event, defaultLayout);
                  }
                }}
                ref={(ref) => {
                  if (ref) {
                    cardRefs.current[index] = ref;
                  }
                }}
              >
                <EventCardComponent
                  event={event}
                  onPress={() => handleEventPress(event, cardLayout!)}
                  onLike={() => toggleLike(event)}
                  isLiked={!!event.isLiked}
                  userLocation={userLocation}
                  cardRef={(ref) => {
                    if (ref) {
                      cardRefs.current[index] = ref;
                    }
                  }}
                />
              </TouchableOpacity>
            </Animated.View>
          ))}
        </Animated.View>
        {isLoadingMore && (
          <View style={styles.loadingMoreContainer}>
                            <ActivityIndicator size="small" color={Colors[colorScheme ?? 'light'].accent} />
            <Text style={[styles.loadingMoreText, { color: Colors[colorScheme ?? 'light'].text }]}>
              Loading more events...
            </Text>
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      <View style={styles.searchContainer}>
        <LinearGradient
          colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          locations={[0, 0.3, 0.7, 1]}
          style={styles.searchGradient}
        >
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#000" />
            <TextInput
              style={[styles.searchInput, { color: '#000' }]}
              placeholder={searchMode === 'events' ? 'Search events...' : 'Search by username or name...'}
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => {
                setSearchQuery('');
                if (searchMode === 'events') {
                  setEvents(allEvents);
                } else {
                  setSearchResults([]);
                }
              }}>
                <Ionicons name="close-circle" size={20} color="#000" />
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>

        {/* Search Mode Toggle - Moved below search bar */}
        <View style={styles.searchModeToggle}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              searchMode === 'events' && styles.toggleButtonActive,
              isTransitioning && searchMode === 'events' && styles.toggleButtonTransitioning
            ]}
            onPress={() => {
              if (isTransitioning) return; // Prevent double-taps during transition
              
              // Show loading if we need to restore events from allEvents
              const needsEventRestore = events.length === 0 && allEvents.length > 0;
              if (needsEventRestore) {
                setShowTransitionLoader(true);
              }
              
              // Defer UI state changes slightly to prevent flickering
              requestAnimationFrame(() => {
                setIsTransitioning(true);
                setSearchMode('events');
                setSearchQuery('');
                setSearchResults([]);
                
                // Defer heavy operations further for smooth transition
                setTimeout(() => {
                  if (needsEventRestore) {
                    setEvents(allEvents.slice(0, ITEMS_PER_PAGE));
                    setShowTransitionLoader(false);
                  }
                  setIsTransitioning(false);
                }, needsEventRestore ? 150 : 50); // Consistent timing
              });
            }}
            activeOpacity={0.7}
            disabled={isTransitioning}
          >
            <View style={styles.toggleButtonContent}>
              <Text style={[
                styles.toggleButtonText,
                { color: searchMode === 'events' ? '#fff' : Colors[colorScheme ?? 'light'].text }
              ]}>
                Events
              </Text>
              {isTransitioning && searchMode === 'events' && (
                <ActivityIndicator 
                  size="small" 
                  color="#fff"
                  style={styles.buttonLoader}
                />
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              searchMode === 'users' && styles.toggleButtonActive,
              isTransitioning && searchMode === 'users' && styles.toggleButtonTransitioning
            ]}
            onPress={() => {
              if (isTransitioning) return; // Prevent double-taps during transition
              
              // Defer UI state changes slightly to prevent flickering
              requestAnimationFrame(() => {
                setIsTransitioning(true);
                setSearchMode('users');
                setSearchQuery('');
                
                // Load recent searches when switching to users mode
                loadRecentSearches();
                
                // For users mode, quick transition
                setTimeout(() => {
                  setIsTransitioning(false);
                }, 50); // Consistent timing
              });
            }}
            activeOpacity={0.7}
            disabled={isTransitioning}
          >
            <Text style={[
              styles.toggleButtonText,
              { color: searchMode === 'users' ? '#fff' : Colors[colorScheme ?? 'light'].text }
            ]}>
              Users
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {renderContent()}

      <EventDetailModal
        event={selectedEvent}
        visible={modalVisible}
        onClose={handleCloseModal}
        userLocation={userLocation}
        cardPosition={cardLayout}
      />

      <MainFooter activeTab="discover" />

      <UserProfileModal
        visible={userProfileModalVisible}
        onClose={() => setUserProfileModalVisible(false)}
        userId={selectedUserId}
        userName={selectedUserName}
        userEmail={selectedUserEmail}
        initialFriendshipStatus={selectedFriendshipStatus}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    padding: 15,
  },
  searchGradient: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },
  eventsGrid: {
    flex: 1,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 15,
    gap: 15,
    justifyContent: 'space-between',
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: CARD_WIDTH,
  },
  cardImage: {
    width: '100%',
    height: CARD_WIDTH * 1.2,
    resizeMode: 'cover',
  },
  cardContent: {
    padding: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    marginLeft: 4,
  },
  likeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
    padding: 5,
    zIndex: 1,
  },
  expandedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  expandedCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#fff',
    overflow: 'hidden',
    paddingTop: 100,
  },
  expandedContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 100,
    marginTop: 20,
  },
  imageExpanded: {
    width: '100%',
    height: height * 0.4,
    resizeMode: 'cover',
    marginBottom: 20,
  },
  expandedTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 40,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: 20,
  },
  loadingMoreContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  loadingMoreText: {
    marginLeft: 10,
    fontSize: 14,
  },
  loadingContainer: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    transform: [{ translateY: -50 }],
    alignItems: 'center',
  },
  transitionLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 20,
    marginTop: 100,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  noResultsSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.7,
  },
  scrollContent: {
    flexGrow: 1,
  },
  sharedEventContainer: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  sharedEventLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    opacity: 0.7,
  },
  featuredBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 2,
  },
  featuredBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  featuredText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 3,
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
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 20,
  },
  searchModeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    backgroundColor: 'rgba(158, 149, 189, 0.1)',
    borderRadius: 25,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonActive: {
    backgroundColor: Colors.light.accent,
    shadowColor: Colors.light.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleButtonTransitioning: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  toggleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttonLoader: {
    marginLeft: 8,
  },
  userResultsContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
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
    fontSize: 13,
    opacity: 0.7,
    fontWeight: '400',
  },
  userStatusContainer: {
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  userStatusText: {
    fontSize: 11,
    opacity: 0.6,
    marginLeft: 4,
    fontWeight: '400',
  },
  addFriendButton: {
    backgroundColor: '#9E95BD',
    borderRadius: 10,
    padding: 12,
    minWidth: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(158, 149, 189, 0.2)',
    minHeight: 44,
    justifyContent: 'center',
  },
  addFriendButtonPending: {
    backgroundColor: '#FFA500',
  },
  addFriendButtonAccepted: {
    backgroundColor: '#888',
  },
  actionButton: {
    backgroundColor: '#9E95BD',
    borderRadius: 10,
    padding: 10,
    minWidth: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(158, 149, 189, 0.2)',
    minHeight: 40,
    justifyContent: 'center',
  },
  addFriendButtonIncoming: {
    backgroundColor: '#007AFF',
    borderColor: 'rgba(0, 122, 255, 0.2)',
  },
  followingButton: {
    backgroundColor: '#FF3B30',
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  notFollowingButton: {
    backgroundColor: '#007AFF',
    borderColor: 'rgba(0, 122, 255, 0.2)',
  },
  userActionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  recentSearchesContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  recentSearchesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  recentSearchesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  clearRecentText: {
    fontSize: 14,
    fontWeight: '500',
  },
  recentSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  recentSearchContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recentSearchText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  removeSearchButton: {
    padding: 4,
  },
  noRecentSearchesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 100,
  },
  noRecentSearchesText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  noRecentSearchesSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.7,
  },
}); 