import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import GlobalDataManager from '@/lib/GlobalDataManager';
import SocialDataManager from '@/lib/SocialDataManager';
import * as Location from 'expo-location';
import EventDetailModal from './EventDetailModal';
import { EventCard } from '@/lib/GlobalDataManager';

interface UserProfile {
  id: number;
  created_at: string;
  name: string;
  username?: string;
  email: string;
  birthday: string;
  gender: string;
  saved_events?: string[];
  preferences?: string[];
  profileImage?: string;
  bannerImage?: string;
  location?: string;
}

interface Event {
  id: number;
  created_at: string;
  name: string;
  organization: string;
  event_type: string;
  location: string;
  cost: number;
  age_restriction: number;
  reservation: string;
  description: string;
  image: any;
  start_date: string;
  end_date: string;
  occurrence: string;
  latitude?: number;
  longitude?: number;
  posted_by: string;
  link?: string;
  featured?: boolean;
  days_of_the_week?: string;
  times?: any; // jsonb field
  allImages?: string[]; // Array of all possible image URLs
}

interface UserProfileModalProps {
  visible: boolean;
  onClose: () => void;
  userId: number;
  userName: string;
  userEmail: string;
  initialFriendshipStatus?: 'pending' | 'accepted' | 'blocked' | 'declined' | 'incoming' | 'none' | null;
}

export default function UserProfileModal({
  visible,
  onClose,
  userId,
  userName,
  userEmail,
  initialFriendshipStatus
}: UserProfileModalProps) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [relationshipLoading, setRelationshipLoading] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [friendshipStatus, setFriendshipStatus] = useState<'accepted' | 'pending' | 'incoming' | 'none'>('none');
  const [isFollowing, setIsFollowing] = useState(false);
  const [userEvents, setUserEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const colorScheme = useColorScheme();
  const dataManager = GlobalDataManager.getInstance();

  // Add new state for tracking image loading per event
  const [eventImageStates, setEventImageStates] = useState<{ [eventId: number]: { currentImageIndex: number; hasError: boolean } }>({});
  
  // State for EventDetailModal
  const [expandedCard, setExpandedCard] = useState<EventCard | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Function to get event image URLs (similar to SuggestedEvents)
  const getEventImageUrls = useCallback((eventId: number) => {
    if (!eventId) return { imageUrl: null, allImages: [] };

    const baseUrl = `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/event-images/${eventId}`;
    const allImages = Array.from({ length: 5 }, (_, i) => `${baseUrl}/${i}.jpg`);
    
    return { imageUrl: allImages[0], allImages };
  }, []);

  // Location permission request function (similar to SuggestedEvents)
  const requestLocationPermission = useCallback(async () => {
    if (userLocation) {
      console.log('⚡ Location already cached');
      return;
    }

    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (err) {
      console.error('Error getting user location:', err);
      // Try to get manual location from user profile as fallback
      try {
        const userProfile = await dataManager.getUserProfile();
        if (userProfile?.location) {
          console.log('Using manual location as fallback:', userProfile.location);
          try {
            const geocodedLocation = await Location.geocodeAsync(userProfile.location);
            if (geocodedLocation && geocodedLocation.length > 0) {
              setUserLocation({
                latitude: geocodedLocation[0].latitude,
                longitude: geocodedLocation[0].longitude,
              });
              console.log('Successfully geocoded manual address:', geocodedLocation[0]);
            } else {
              console.log('Could not geocode manual address:', userProfile.location);
            }
          } catch (geocodeError) {
            console.error('Error geocoding manual address:', geocodeError);
          }
        }
      } catch (profileError) {
        console.error('Error getting user profile for fallback location:', profileError);
      }
    }
  }, [userLocation, dataManager]);

  // Function to handle image error and try next image
  const handleEventImageError = useCallback((eventId: number) => {
    console.log('Image failed to load for event:', eventId);
    
    const { allImages } = getEventImageUrls(eventId);
    const currentState = eventImageStates[eventId] || { currentImageIndex: 0, hasError: false };
    const nextIndex = currentState.currentImageIndex + 1;
    
    if (nextIndex < allImages.length) {
      console.log(`Retrying with image ${nextIndex} for event ${eventId}`);
      setEventImageStates(prev => ({
        ...prev,
        [eventId]: { currentImageIndex: nextIndex, hasError: false }
      }));
      
      // Update the event's image URL to the next one
      setUserEvents(prevEvents => 
        prevEvents.map(event => 
          event.id === eventId ? { ...event, image: allImages[nextIndex] } : event
        )
      );
    } else {
      console.log('No more images to try for event:', eventId);
      setEventImageStates(prev => ({
        ...prev,
        [eventId]: { currentImageIndex: nextIndex, hasError: true }
      }));
      
      // Set image to null to show placeholder
      setUserEvents(prevEvents => 
        prevEvents.map(event => 
          event.id === eventId ? { ...event, image: null } : event
        )
      );
    }
  }, [eventImageStates, getEventImageUrls]);

  // Function to get current image URL for an event
  const getCurrentEventImageUrl = useCallback((event: Event) => {
    const eventState = eventImageStates[event.id];
    
    if (eventState?.hasError) {
      return null; // Show placeholder
    }
    
    // If we have a custom image state, use it
    if (eventState) {
      const { allImages } = getEventImageUrls(event.id);
      return allImages[eventState.currentImageIndex] || null;
    }
    
    // Otherwise, use the event's image or generate the first one
    if (event.image) {
      return event.image;
    }
    
    const { imageUrl } = getEventImageUrls(event.id);
    return imageUrl;
  }, [eventImageStates, getEventImageUrls]);

  // Function to handle event card press
  const handleEventCardPress = useCallback((event: Event) => {
    console.log('🎯 Event card pressed:', event.name);
    // Convert Event to EventCard format for EventDetailModal
    const eventCard: EventCard = {
      ...event,
      // Handle days_of_the_week conversion from string to string[]
      days_of_the_week: event.days_of_the_week ? 
        (typeof event.days_of_the_week === 'string' ? 
          event.days_of_the_week.split(',').map(d => d.trim()) : 
          event.days_of_the_week) : 
        undefined,
      // Use actual data or provide sensible defaults
      latitude: event.latitude || 0,
      longitude: event.longitude || 0,
      distance: undefined,
      featured: event.featured || false,
      age_restriction: event.age_restriction || 0,
      reservation: event.reservation || 'no',
      times: event.times || {},
      allImages: event.allImages || []
    };
    setExpandedCard(eventCard);
  }, []);

  // Function to close EventDetailModal
  const handleCloseEventDetail = useCallback(() => {
    setExpandedCard(null);
  }, []);

  // Request location permission when component mounts
  useEffect(() => {
    if (visible) {
      requestLocationPermission();
    }
  }, [visible, requestLocationPermission]);

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

  const fetchUserEvents = async () => {
    try {
      setEventsLoading(true);
      
      // Use username if available, otherwise fallback to email
      const postedBy = userProfile?.username || userEmail;
      console.log('🔍 Fetching events for user:', { username: userProfile?.username, email: userEmail, using: postedBy });
      
      // Fetch events posted by this user - get specific fields (excluding image)
      const { data: eventsData, error: eventsError } = await supabase
        .from('new_events')
        .select('id, created_at, name, organization, location, cost, age_restriction, reservation, description, start_date, end_date, occurrence, latitude, longitude, days_of_the_week, event_type, link, times, featured, posted_by, posted_by_email')
        .eq('posted_by', postedBy)
        .order('created_at', { ascending: false });

      if (eventsError) {
        console.error('Error fetching user events:', eventsError);
        setUserEvents([]);
      } else {
        const events = eventsData || [];
        console.log(`✅ Found ${events.length} events for user with posted_by: ${postedBy}`);
        
        // Initialize event images using the same logic as SuggestedEvents
        const eventsWithImages = events.map(event => {
          const { imageUrl, allImages } = getEventImageUrls(event.id);
          return {
            ...event,
            image: event.image || imageUrl, // Use existing image or generate first one
            allImages // Add allImages array for fallback logic
          };
        });
        
        setUserEvents(eventsWithImages);
        
        // Initialize image states for all events
        const initialImageStates: { [eventId: number]: { currentImageIndex: number; hasError: boolean } } = {};
        events.forEach(event => {
          initialImageStates[event.id] = { currentImageIndex: 0, hasError: false };
        });
        setEventImageStates(initialImageStates);
      }

    } catch (error) {
      console.error('Error fetching user events:', error);
      setUserEvents([]);
    } finally {
      setEventsLoading(false);
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
      console.log('❌ Missing current user profile data for relationship check');
      return;
    }
    
    console.log(`🔍 Checking relationship status between user ${currentUserProfile.id} and target user ${userId}`);
    setRelationshipLoading(true);
    
    try {
      // STEP 1: Check if they are already friends
      console.log('🤝 Checking friends table for existing friendship...');
      const { data: friendshipData, error: friendshipError } = await supabase
        .from('friends')
        .select('id, status')
        .or(`and(user_id.eq.${currentUserProfile.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${currentUserProfile.id})`)
        .eq('status', 'accepted')
        .limit(1);

      if (friendshipError) {
        console.error('🚨 Error checking friendship:', friendshipError);
      }

      if (friendshipData && friendshipData.length > 0) {
        console.log('✅ Found existing friendship:', friendshipData[0]);
        setFriendshipStatus('accepted');
        // Still check follow status
      } else {
        // STEP 2: Check for incoming friend request (viewed user sent to current user)
        console.log('📥 Checking for incoming friend requests...');
        const { data: incomingRequest, error: incomingError } = await supabase
          .from('friend_requests')
          .select('id, status, created_at')
          .eq('sender_id', userId)
          .eq('receiver_id', currentUserProfile.id)
          .eq('status', 'pending')
          .maybeSingle();

        if (incomingError) {
          console.error('🚨 Error checking incoming requests:', incomingError);
        }

        if (incomingRequest) {
          console.log('📥 Found incoming friend request:', incomingRequest);
          setFriendshipStatus('incoming');
        } else {
          // STEP 3: Check for outgoing friend request (current user sent to viewed user)
          console.log('📤 Checking for outgoing friend requests...');
          const { data: sentRequest, error: sentError } = await supabase
            .from('friend_requests')
            .select('id, status, created_at')
            .eq('sender_id', currentUserProfile.id)
            .eq('receiver_id', userId)
            .eq('status', 'pending')
            .maybeSingle();

          if (sentError) {
            console.error('🚨 Error checking sent requests:', sentError);
          }

          if (sentRequest) {
            console.log('📤 Found outgoing friend request:', sentRequest);
            setFriendshipStatus('pending');
          } else {
            console.log('❌ No friend relationship found - setting to none');
            setFriendshipStatus('none');
          }
        }
      }

      // STEP 4: Check follow status manually (skip RPC as it's unreliable)
      console.log('👥 Checking follow status manually...');
      const { data: followData, error: followError } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', currentUserProfile.id)
        .eq('followed_id', userId)
        .maybeSingle();

      if (!followError && followData) {
        console.log('✅ User is following target');
        setIsFollowing(true);
      } else {
        console.log('❌ User is not following target');
        setIsFollowing(false);
      }

    } catch (error) {
      console.error('🚨 Error fetching relationship status:', error);
      // Set default states on error
      setFriendshipStatus('none');
      setIsFollowing(false);
    } finally {
      setRelationshipLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!currentUserProfile?.email || !currentUserProfile?.id) return;
    
    try {
      console.log(`🚀 OFFLINE-FIRST: Following user ${userEmail} by ${currentUserProfile.email}`);
      
      // Get target user ID first
      const { data: targetUser, error: targetError } = await supabase
        .from('all_users')
        .select('id')
        .eq('email', userEmail)
        .single();

      if (targetError || !targetUser) {
        console.error('🚨 Error finding target user:', targetError);
        Alert.alert('Error', 'User not found');
        return;
      }

      // Use SocialDataManager to follow user (auto-updates cache)
      const socialDataManager = SocialDataManager.getInstance();
      const success = await socialDataManager.followUser(currentUserProfile.id, targetUser.id);

      if (success) {
        console.log('✅ OFFLINE-FIRST: Successfully followed user');
        setIsFollowing(true);
        Alert.alert('Success', 'Successfully followed user');
      } else {
        Alert.alert('Error', 'Failed to follow user');
      }
      
    } catch (error) {
      console.error('🚨 OFFLINE-FIRST: Error following user:', error);
      Alert.alert('Error', 'Failed to follow user');
    }
  };

  const handleUnfollow = async () => {
    if (!currentUserProfile?.email || !currentUserProfile?.id) return;
    
    try {
      console.log(`🚀 OFFLINE-FIRST: Unfollowing user ${userEmail} by ${currentUserProfile.email}`);
      
      // Get target user ID first
      const { data: targetUser, error: targetError } = await supabase
        .from('all_users')
        .select('id')
        .eq('email', userEmail)
        .single();

      if (targetError || !targetUser) {
        console.error('🚨 Error finding target user:', targetError);
        Alert.alert('Error', 'User not found');
        return;
      }

      // Use SocialDataManager to unfollow user (auto-updates cache)
      const socialDataManager = SocialDataManager.getInstance();
      const success = await socialDataManager.unfollowUser(currentUserProfile.id, targetUser.id);

      if (success) {
        console.log('✅ OFFLINE-FIRST: Successfully unfollowed user');
        setIsFollowing(false);
        Alert.alert('Success', 'Successfully unfollowed user');
      } else {
        Alert.alert('Error', 'Failed to unfollow user');
      }
      
    } catch (error) {
      console.error('🚨 OFFLINE-FIRST: Error unfollowing user:', error);
      Alert.alert('Error', 'Failed to unfollow user');
    }
  };

  const handleFriendRequest = async () => {
    if (!currentUserProfile?.id) {
      console.error('No current user ID available for sending friend request');
      Alert.alert('Error', 'User profile not loaded properly');
      return;
    }
    
    console.log(`🔍 Sending friend request from user ${currentUserProfile.id} to user ${userId}`);
    
    // Immediately update UI to show loading state
    setRelationshipLoading(true);
    
    try {
      // Check if a friend request already exists to avoid duplicates
      console.log(`🔍 Checking for existing friend request: sender=${currentUserProfile.id}, receiver=${userId}`);
      const { data: existingRequest, error: checkError } = await supabase
        .from('friend_requests')
        .select('id, status')
        .eq('sender_id', currentUserProfile.id)
        .eq('receiver_id', userId)
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
          setFriendshipStatus('pending'); // Ensure UI shows correct state
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
            sender_id: currentUserProfile.id,
            receiver_id: userId,
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

      // Also automatically follow the user when sending friend request
      try {
        console.log('🚀 OFFLINE-FIRST: Auto-following user when sending friend request...');
        
        // Use SocialDataManager to follow user (auto-updates cache)
        const socialDataManager = SocialDataManager.getInstance();
        const followSuccess = await socialDataManager.followUser(currentUserProfile.id, userId);

        if (followSuccess) {
          console.log('✅ OFFLINE-FIRST: Auto-follow successful');
          setIsFollowing(true);
        } else {
          console.log('⚠️ Auto-follow failed, but friend request was sent');
        }
      } catch (followError) {
        console.log('⚠️ Auto-follow error, but friend request was sent:', followError);
      }

      // Immediately set the UI to pending status for better UX
      console.log('✅ Friend request process completed, updating UI to pending status');
      setFriendshipStatus('pending');
      
      // Force refresh from database to confirm (ignore initial status)
      setTimeout(() => {
        console.log('🔄 Force refreshing relationship status from database after friend request');
        fetchRelationshipStatus();
      }, 500);
      
      Alert.alert('Success', 'Friend request sent successfully!');
      
    } catch (error) {
      console.error('🚨 Error sending friend request:', error);
      Alert.alert('Error', 'Failed to send friend request');
      // Refresh status in case of error to get current state
      await fetchRelationshipStatus();
    } finally {
      setRelationshipLoading(false);
    }
  };

  const handleAcceptFriendRequest = async () => {
    if (!currentUserProfile?.id) return;
    
    try {
      console.log(`🔍 UserProfile: Accepting friend request from ${userId} to ${currentUserProfile.id}`);
      
      // First, find the friend request
      const { data: requestData, error: requestError } = await supabase
        .from('friend_requests')
        .select('id, sender_id, receiver_id')
        .eq('sender_id', userId)
        .eq('receiver_id', currentUserProfile.id)
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

      console.log('📋 UserProfile: Friend request data:', requestData);

      // Update the friend request status to accepted
      const { error: updateError } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', requestData.id);

      if (updateError) {
        console.error('🚨 Error updating friend request:', updateError);
        throw updateError;
      }

      // Create friendship entries in both directions
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

      const { error: friendshipError } = await supabase
        .from('friends')
        .insert(friendshipData);

      if (friendshipError) {
        console.error('🚨 Error creating friendship:', friendshipError);
        throw friendshipError;
      }

      console.log('✅ UserProfile: Friend request accepted successfully');
      
      // Refresh the relationship status
      await fetchRelationshipStatus();
      Alert.alert('Success', 'Friend request accepted! You are now friends.');
      
    } catch (error) {
      console.error('🚨 UserProfile: Error accepting friend request:', error);
      Alert.alert('Error', 'Failed to accept friend request');
    }
  };

  const handleDeclineFriendRequest = async () => {
    if (!currentUserProfile?.id) return;
    
    try {
      console.log(`🔍 UserProfile: Declining friend request from ${userId} to ${currentUserProfile.id}`);
      
      // First, find the friend request
      const { data: requestData, error: requestError } = await supabase
        .from('friend_requests')
        .select('id')
        .eq('sender_id', userId)
        .eq('receiver_id', currentUserProfile.id)
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

      console.log('📋 UserProfile: Friend request data:', requestData);

      // Update the friend request status to declined
      const { error: updateError } = await supabase
        .from('friend_requests')
        .update({ status: 'declined', updated_at: new Date().toISOString() })
        .eq('id', requestData.id);

      if (updateError) {
        console.error('🚨 Error updating friend request:', updateError);
        throw updateError;
      }

      console.log('✅ UserProfile: Friend request declined successfully');
      
      // Refresh the relationship status
      await fetchRelationshipStatus();
      Alert.alert('Success', 'Friend request declined.');
      
    } catch (error) {
      console.error('🚨 UserProfile: Error declining friend request:', error);
      Alert.alert('Error', 'Failed to decline friend request');
    }
  };

  useEffect(() => {
    if (visible && userId) {
      fetchUserProfile();
      fetchCurrentUserProfile();
    }
  }, [visible, userId]);

  // Fetch user events after user profile is loaded
  useEffect(() => {
    if (visible && userId && userProfile) {
      fetchUserEvents();
    }
  }, [visible, userId, userProfile]);

  useEffect(() => {
    if (visible && userId && currentUserProfile?.email) {
      // If initial friendship status is provided (from Discover), use it
      if (initialFriendshipStatus !== undefined && initialFriendshipStatus !== null) {
        console.log(`🎯 Using initial friendship status: ${initialFriendshipStatus}`);
        // Map external status types to internal types
        let mappedStatus: 'pending' | 'accepted' | 'incoming' | 'none';
        if (initialFriendshipStatus === 'blocked' || initialFriendshipStatus === 'declined' || initialFriendshipStatus === 'none') {
          mappedStatus = 'none';
        } else if (initialFriendshipStatus === 'pending') {
          mappedStatus = 'pending';
        } else if (initialFriendshipStatus === 'accepted') {
          mappedStatus = 'accepted';
        } else {
          mappedStatus = 'none';
        }
        setFriendshipStatus(mappedStatus);
        setRelationshipLoading(false);
      } else {
        console.log('🔍 No initial friendship status provided, fetching from database');
        fetchRelationshipStatus();
      }
    }
  }, [visible, userId, currentUserProfile?.email, initialFriendshipStatus]);

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
            <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].accent} />
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
                  @{userProfile?.username || 'username'}
                </Text>
                <Text style={[styles.userRealName, { color: Colors[colorScheme ?? 'light'].text }]}>
                  {userProfile?.name || userName}
                </Text>
              </View>



              {/* Action Buttons */}
              <View style={styles.actionButtonsContainer}>
                {/* Follow/Unfollow Button - Always show when no friendship relationship */}
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

                {/* Friend Request Button - Show friendship status */}
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
              </View>
            </View>

            {/* User's Events */}
            <View style={[styles.eventsSection, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
              <Text style={[styles.eventsSectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                Events Created ({userEvents.length})
              </Text>
              
              {eventsLoading ? (
                <View style={styles.eventsLoadingContainer}>
                  <ActivityIndicator size="small" color={Colors[colorScheme ?? 'light'].accent} />
                  <Text style={[styles.eventsLoadingText, { color: Colors[colorScheme ?? 'light'].text }]}>
                    Loading events...
                  </Text>
                </View>
              ) : userEvents.length === 0 ? (
                <View style={styles.noEventsContainer}>
                  <Ionicons name="calendar-outline" size={40} color="#ccc" />
                  <Text style={[styles.noEventsText, { color: Colors[colorScheme ?? 'light'].text }]}>
                    No events created yet
                  </Text>
                </View>
              ) : (
                <View style={styles.eventsList}>
                  {userEvents.map((event) => (
                    <TouchableOpacity 
                      key={event.id} 
                      style={[styles.eventCard, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}
                      onPress={() => handleEventCardPress(event)}
                      activeOpacity={0.7}
                    >
                      {/* Event Image with sophisticated fallback logic */}
                      {(() => {
                        const currentImageUrl = getCurrentEventImageUrl(event);
                        const eventState = eventImageStates[event.id];
                        
                        return currentImageUrl && !eventState?.hasError ? (
                          <Image 
                            source={{ uri: currentImageUrl }}
                            style={styles.eventImage}
                            onError={() => handleEventImageError(event.id)}
                            onLoad={() => {
                              // Mark that this image loaded successfully
                              setEventImageStates(prev => ({
                                ...prev,
                                [event.id]: { 
                                  ...prev[event.id], 
                                  hasError: false 
                                }
                              }));
                            }}
                          />
                        ) : (
                          <LinearGradient
                            colors={colorScheme === 'dark' 
                              ? ['#2A2A2A', '#1F1F1F', '#252525'] 
                              : ['#FFFFFF', '#F8F9FA', '#FFFFFF']
                            }
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[styles.eventImage, { justifyContent: 'center', alignItems: 'center' }]}
                          >
                            <Ionicons name="image-outline" size={28} color="#B97AFF" style={{ marginTop: -6 }} />
                            <Text style={{ color: '#B97AFF', fontSize: 12, fontWeight: 'bold', marginTop: 6, marginBottom: 2, textAlign: 'center' }}>
                              No Event Image
                            </Text>
                            <Text style={{ color: '#999', fontSize: 10, fontWeight: 'bold', marginTop: 2, textAlign: 'center' }}>
                              But the fun is still on! 🎈
                            </Text>
                          </LinearGradient>
                        );
                      })()}
                      
                      {/* Event Info */}
                      <View style={styles.eventInfo}>
                        <Text style={[styles.eventName, { color: Colors[colorScheme ?? 'light'].text }]}>
                          {event.name}
                        </Text>
                        
                        {event.location && (
                          <View style={styles.eventDetail}>
                            <Ionicons name="location-outline" size={14} color="#9E95BD" />
                            <Text style={[styles.eventDetailText, { color: Colors[colorScheme ?? 'light'].text }]}>
                              {event.location}
                            </Text>
                          </View>
                        )}
                        
                        {event.start_date && (
                          <View style={styles.eventDetail}>
                            <Ionicons name="calendar-outline" size={14} color="#9E95BD" />
                            <Text style={[styles.eventDetailText, { color: Colors[colorScheme ?? 'light'].text }]}>
                              {new Date(event.start_date).toLocaleDateString()}
                            </Text>
                          </View>
                        )}
                        
                        {event.cost !== undefined && event.cost !== null && (
                          <View style={styles.eventDetail}>
                            <Ionicons name="cash-outline" size={14} color="#9E95BD" />
                            <Text style={[styles.eventDetailText, { color: Colors[colorScheme ?? 'light'].text }]}>
                              {event.cost === 0 ? 'FREE' : `$${event.cost}`}
                            </Text>
                          </View>
                        )}
                        
                        {event.event_type && (
                          <View style={styles.eventTypeContainer}>
                            <Text style={styles.eventType}>
                              {event.event_type}
                            </Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
             {expandedCard && (
         <EventDetailModal
           visible={!!expandedCard}
           event={expandedCard}
           onClose={handleCloseEventDetail}
           userLocation={userLocation}
         />
       )}
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
  userRealName: {
    fontSize: 18,
    fontWeight: '600',
    opacity: 0.8,
    marginBottom: 5,
  },

  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    minWidth: 120,
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

  // Events section styles
  eventsSection: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  eventsSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  eventsLoadingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  eventsLoadingText: {
    marginLeft: 10,
    fontSize: 16,
  },
  noEventsContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  noEventsText: {
    fontSize: 16,
    marginTop: 10,
    opacity: 0.6,
  },
  eventsList: {
    gap: 12,
  },
  eventCard: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 8,
  },
  eventImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 12,
    resizeMode: 'cover',
  },
  eventInfo: {
    gap: 8,
  },
  eventName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  eventDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventDetailText: {
    fontSize: 14,
    marginLeft: 6,
    opacity: 0.8,
  },
  eventTypeContainer: {
    alignSelf: 'flex-start',
    backgroundColor: '#9E95BD',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
  },
  eventType: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
}); 