import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, SafeAreaView, Animated, TouchableOpacity, ScrollView } from 'react-native';
import Swiper from 'react-native-deck-swiper';
import MainFooter from './MainFooter';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import EventFilterOverlay from './EventFilterOverlay';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import GlobalDataManager from '@/lib/GlobalDataManager';
import OptimizedComponentServices from '@/lib/OptimizedComponentServices';
import SavedActivities from './SavedActivities';
import EventDetailModal from './EventDetailModal';
import { EventCard } from '../lib/GlobalDataManager';
import { supabase } from '@/lib/supabase';
import { useRoute, useFocusEffect } from '@react-navigation/native';


const { width, height } = Dimensions.get('window');
const FOOTER_HEIGHT = 80;
const TOP_BUTTONS_HEIGHT = 60; // Space for top buttons
const ACTION_BUTTONS_HEIGHT = 80; // Space for action buttons

// We'll show a "No Image Found" placeholder instead of a default image

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

// Add these optimized constants outside the component
const DEBOUNCE_DELAY = 500;
const IMAGE_CACHE = new Map<number, { imageUrl: string | null; allImages: string[] }>();

// Helper function to format times data for display
const formatTimesForDisplay = (times: { [key: string]: string | [string, string] } | undefined): string => {
  if (!times || Object.keys(times).length === 0) {
    return 'Hours not available';
  }

  const entries = Object.entries(times);
  if (entries.length === 1) {
    const [day, timeValue] = entries[0];
    if (timeValue === 'all_day') {
      return `${day}: Open 24 hours`;
    } else if (Array.isArray(timeValue)) {
      return `${day}: ${timeValue[0]} - ${timeValue[1]}`;
    }
    return `${day}: ${timeValue}`;
  }

  // Multiple days - show a summary
  const allDayCount = entries.filter(([_, timeValue]) => timeValue === 'all_day').length;
  const regularHours = entries.filter(([_, timeValue]) => Array.isArray(timeValue));
  
  if (allDayCount === entries.length) {
    return 'Open 24 hours daily';
  } else if (regularHours.length > 0) {
    const [_, firstTime] = regularHours[0];
    if (Array.isArray(firstTime)) {
      return `Varies by day (e.g., ${firstTime[0]} - ${firstTime[1]})`;
    }
  }
  
  return 'Varies by day';
};

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




export default function SuggestedEvents() {
  const [cardIndex, setCardIndex] = useState(0);
  const [expandedCard, setExpandedCard] = useState<EventCard | null>(null);
  const [cardPosition, setCardPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  // Removed swiperVisible state - swiper now stays visible when modal opens
  const [isSwipeInProgress, setIsSwipeInProgress] = useState(false);
  const [pendingOperations, setPendingOperations] = useState(new Set<string>());

  const swipeX = useRef(new Animated.Value(0)).current;
  const swiperRef = useRef<Swiper<EventCard>>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const contentFadeAnim = useRef(new Animated.Value(0)).current;
  const colorScheme = useColorScheme();
  const [loading, setLoading] = useState(true);
  const [isFetchingActivities, setIsFetchingActivities] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [EVENTS, setEVENTS] = useState<EventCard[]>([]);
  const [cachedEvents, setCachedEvents] = useState<EventCard[]>([]);
  const [swipedEventIds, setSwipedEventIds] = useState<Set<number>>(new Set());
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isSavedLikesVisible, setIsSavedLikesVisible] = useState(false);
  const [expandedSavedActivity, setExpandedSavedActivity] = useState<EventCard | null>(null);
  const savedActivityFadeAnim = useRef(new Animated.Value(0)).current;
  const savedActivityScaleAnim = useRef(new Animated.Value(0.8)).current;
  const savedActivityOpacityAnim = useRef(new Animated.Value(0)).current;
  const loadingFadeAnim = useRef(new Animated.Value(0)).current;
  const [profileImageStates, setProfileImageStates] = useState<{ [eventId: number]: boolean }>({});
  const [isHandlingSwipedAll, setIsHandlingSwipedAll] = useState(false);
  const [backendReturnedEmpty, setBackendReturnedEmpty] = useState(false);

  //supabase.auth.signOut();

  const dataManager = GlobalDataManager.getInstance();


  // Simple cache functions
  const saveEventsToCache = useCallback(async (events: EventCard[]) => {
    try {
      // Don't save empty events to cache to prevent infinite loops
      if (!events || events.length === 0) {
        console.log('⚠️ Not saving empty events to cache');
        return;
      }
      
      // Filter out swiped events before saving to cache
      const filteredEvents = events.filter(event => !swipedEventIds.has(event.id));
      
      const cacheData = {
        events: filteredEvents,
        swipedEventIds: Array.from(swipedEventIds)
      };
      await AsyncStorage.setItem('suggestedEventsCache', JSON.stringify(cacheData));
      console.log('💾 Saved events to cache:', filteredEvents.length, 'events, swiped:', swipedEventIds.size);
    } catch (error) {
      console.error('❌ Error saving events to cache:', error);
    }
  }, [swipedEventIds]);

  const loadEventsFromCache = useCallback(async () => {
    try {
      const cachedData = await AsyncStorage.getItem('suggestedEventsCache');
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        if (parsed.events && parsed.events.length > 0) {
          console.log('📦 Loading events from cache:', parsed.events.length, 'events');
          
          // Filter out any null/undefined events from cache
          const validEvents = parsed.events.filter((event: EventCard) => event != null);
          
          if (validEvents.length === 0) {
            console.log('📦 Cache contains no valid events, clearing cache');
            await AsyncStorage.removeItem('suggestedEventsCache');
            return false;
          }
          
          // Load swiped event IDs if available
          if (parsed.swipedEventIds && Array.isArray(parsed.swipedEventIds)) {
            setSwipedEventIds(new Set(parsed.swipedEventIds));
            console.log('📦 Loaded swiped event IDs from cache:', parsed.swipedEventIds.length);
          }
          
          // Events in cache are already filtered (no swiped events)
          setEVENTS(validEvents);
          
          // Clear backend empty flag since we loaded events from cache
          setBackendReturnedEmpty(false);
          
          setLoading(false);
          return true;
        } else {
          console.log('📦 Cache exists but has no events, clearing cache');
          // Clear invalid cache to prevent future issues
          await AsyncStorage.removeItem('suggestedEventsCache');
        }
      }
      return false;
    } catch (error) {
      console.error('❌ Error loading events from cache:', error);
      // Clear corrupted cache
      try {
        await AsyncStorage.removeItem('suggestedEventsCache');
      } catch (clearError) {
        console.error('❌ Error clearing corrupted cache:', clearError);
      }
      return false;
    }
  }, []);

  const clearEventsCache = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('suggestedEventsCache');
      setSwipedEventIds(new Set());
      console.log('🗑️ Cleared events cache and swiped events');
    } catch (error) {
      console.error('❌ Error clearing events cache:', error);
    }
  }, []);

  // Memoized expensive calculations
  const processedEventsRef = useRef<EventCard[]>([]);

  // No longer need displayEvents - swiper uses EVENTS directly
  // Swiped events are handled in renderCard by returning null





  // Optimized image URL generation with caching
  const getEventImageUrls = useCallback((eventId: number) => {
    const cacheKey = eventId;
    
    if (IMAGE_CACHE.has(cacheKey)) {
      const cached = IMAGE_CACHE.get(cacheKey);
      return cached || { imageUrl: null, allImages: [] };
    }

    if (!eventId) return { imageUrl: null, allImages: [] };

    const randomImageIndex = Math.floor(Math.random() * 5);
    const baseUrl = `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/event-images/${eventId}`;
    
    const imageUrl = `${baseUrl}/${randomImageIndex}.jpg`;
    const allImages = Array.from({ length: 5 }, (_, i) => `${baseUrl}/${i}.jpg`);
    
    const result = { imageUrl, allImages };
    IMAGE_CACHE.set(cacheKey, result);
    
    return result;
  }, []);

  // Optimized event processing with friends data
  const processEvents = useCallback(async (events: EventCard[]) => {
    console.log('🔄 Processing events with friends data...');
    
    // Filter out any undefined events first
    const validEvents = events.filter(event => event != null);
    
    // Process events with image URLs and friends data in parallel
    const processedEvents = await Promise.all(
      validEvents.map(async (event) => {
      const urls = getEventImageUrls(event.id);
        
        // Fetch friends who saved this event
        let friendsWhoSaved: { id: number; name: string; email: string }[] = [];
        try {
          friendsWhoSaved = await dataManager.getFriendsWhoSavedEvent(event.id);
        } catch (error) {
          console.error(`Error fetching friends for event ${event.id}:`, error);
        }
        
      return {
        ...event,
        image: urls.imageUrl,
          allImages: urls.allImages,
          friendsWhoSaved
      };
      })
    );
    
    console.log('✅ Events processed with friends data');
    return processedEvents;
  }, [getEventImageUrls, dataManager]);

  // Memoized location permission request
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
        accuracy: Location.Accuracy.Balanced, // Lower accuracy for better performance
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
            // Geocode the manual address to get coordinates
            const geocodedLocation = await Location.geocodeAsync(userProfile.location);
            if (geocodedLocation && geocodedLocation.length > 0) {
              setUserLocation({
                latitude: geocodedLocation[0].latitude,
                longitude: geocodedLocation[0].longitude,
              });
              console.log('Successfully geocoded manual address in requestLocationPermission:', geocodedLocation[0]);
            } else {
              console.log('Could not geocode manual address in requestLocationPermission:', userProfile.location);
            }
          } catch (geocodeError) {
            console.error('Error geocoding manual address in requestLocationPermission:', geocodeError);
          }
        }
      } catch (profileError) {
        console.error('Error getting user profile for fallback location:', profileError);
      }
    }
  }, [userLocation, dataManager]);



  // Optimized fetchTokenAndCallBackend with better error handling and caching
  const fetchTokenAndCallBackend = useCallback(async () => {
    const currentUserEmail = dataManager.getCurrentUser()?.email;
    
    if (!currentUserEmail) {
      console.error('No user email available - user should be signed in by now');
      setLoading(false);
      setIsFetchingActivities(false);
      return;
    }

    // Prevent multiple simultaneous calls
    if (isFetchingActivities) {
      console.log('⚠️ Already fetching activities, skipping duplicate call');
      return;
    }

    try {
      setLoading(true);
      setIsFetchingActivities(true);
      
      // CRITICAL: Force immediate refresh to get absolutely latest data (not debounced)
      console.log('🔄 Force refreshing data before backend call...');
      await dataManager.refreshAllData();
      
      // Check location mode from AsyncStorage to determine which location to use
      const [locationMode, customAddress] = await Promise.all([
        AsyncStorage.getItem('userLocationMode'),
        AsyncStorage.getItem('userLocation')
      ]);
      
      console.log('📍 Location mode from AsyncStorage:', locationMode);
      console.log('📍 Custom address from AsyncStorage:', customAddress);
      
      let userLat = null;
      let userLon = null;
      
      if (locationMode === 'custom' && customAddress?.trim()) {
        // Use custom address - geocode it to get coordinates
        console.log('📍 Using custom address:', customAddress);
        try {
          const geocodedLocation = await Location.geocodeAsync(customAddress.trim());
          if (geocodedLocation && geocodedLocation.length > 0) {
            userLat = geocodedLocation[0].latitude;
            userLon = geocodedLocation[0].longitude;
            console.log('✅ Successfully geocoded custom address to coordinates:', { userLat, userLon });
          } else {
            console.log('❌ Could not geocode custom address:', customAddress);
          }
        } catch (geocodeError) {
          console.error('❌ Error geocoding custom address:', geocodeError);
        }
      } else if (locationMode === 'current') {
        // Use current GPS location
        console.log('📍 Using current GPS location');
        userLat = userLocation?.latitude;
        userLon = userLocation?.longitude;
        
        if (!userLat || !userLon) {
          try {
            // Check permissions before getting location
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status === 'granted') {
              const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
              });
              userLat = location.coords.latitude;
              userLon = location.coords.longitude;
              setUserLocation({ latitude: userLat, longitude: userLon });
              console.log('✅ Got current GPS location:', { userLat, userLon });
            } else {
              console.log('⚠️ Location permission not granted, falling back to profile location');
              // Try to use manual location from user profile as fallback
              const userProfile = await dataManager.getUserProfile();
              if (userProfile?.location) {
                console.log('📍 Using manual location from profile as fallback:', userProfile.location);
                try {
                  const geocodedLocation = await Location.geocodeAsync(userProfile.location);
                  if (geocodedLocation && geocodedLocation.length > 0) {
                    userLat = geocodedLocation[0].latitude;
                    userLon = geocodedLocation[0].longitude;
                    setUserLocation({ latitude: userLat, longitude: userLon });
                    console.log('✅ Successfully geocoded profile address to coordinates:', { userLat, userLon });
                  } else {
                    console.log('❌ Could not geocode profile address:', userProfile.location);
                  }
                } catch (geocodeError) {
                  console.error('❌ Error geocoding profile address:', geocodeError);
                }
              }
            }
          } catch (locationError) {
            console.error('❌ Error getting location in fetchTokenAndCallBackend:', locationError);
            // Continue without location - backend should handle missing coordinates
          }
        }
      } else if (locationMode === 'none') {
        // No location filtering - but still send coordinates for distance calculation
        console.log('📍 No location filtering selected - but still getting coordinates for distance display');
        userLat = userLocation?.latitude;
        userLon = userLocation?.longitude;
        
        if (!userLat || !userLon) {
          try {
            // Check permissions before getting location for distance calculation
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status === 'granted') {
              const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
              });
              userLat = location.coords.latitude;
              userLon = location.coords.longitude;
              setUserLocation({ latitude: userLat, longitude: userLon });
              console.log('✅ Got location for distance calculation:', { userLat, userLon });
            } else {
              console.log('⚠️ Location permission not granted for distance calculation');
            }
          } catch (locationError) {
            console.error('❌ Error getting location for distance calculation:', locationError);
          }
        }
      } else {
        // Default to current location if no mode is set
        console.log('📍 No location mode set, defaulting to current location');
        userLat = userLocation?.latitude;
        userLon = userLocation?.longitude;
        
        if (!userLat || !userLon) {
          try {
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status === 'granted') {
              const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
              });
              userLat = location.coords.latitude;
              userLon = location.coords.longitude;
              setUserLocation({ latitude: userLat, longitude: userLon });
            }
          } catch (locationError) {
            console.error('❌ Error getting default location:', locationError);
          }
        }
      }

      // Batch data fetch
      const [rejectedEvents, savedEvents, filterByDistance, session] = await Promise.all([
        dataManager.getRejectedEvents(),
        dataManager.getSavedEvents(),
        dataManager.getIsFilterByDistance(),
        dataManager.getSession(),
      ]);

      const rejectedEventIds = rejectedEvents.map((e: any) => e.id);
      const savedEventIds = savedEvents.map((e: any) => e.id);
      
      console.log('📊 Data state before backend call:', {
        rejectedCount: rejectedEventIds.length,
        savedCount: savedEventIds.length,
        savedEventIds: savedEventIds, // Log full saved event IDs
        rejectedEventIds: rejectedEventIds.slice(-5), // Log last 5 rejected events
        location: { lat: userLat, lon: userLon }
      });

      // Get calendar preferences (cached)
      const [isCalendarMode, selectedDatesStr] = await Promise.all([
        AsyncStorage.getItem('isCalendarMode'),
        AsyncStorage.getItem('selectedDates')
      ]);

      let selectedDates: string[] = [];
      if (isCalendarMode === 'true' && selectedDatesStr) {
        try {
          selectedDates = JSON.parse(selectedDatesStr);
        } catch (e) {
          console.error('Error parsing selected dates:', e);
        }
      }

            // OFFLINE-FIRST OPTIMIZATION: Get preferences from AsyncStorage instead of database
      console.log('🚀 OFFLINE-FIRST: Using preferences from AsyncStorage, not database');
      
      // Load time preferences from AsyncStorage
      const currentStartTime = await AsyncStorage.getItem('userStartTime') || '21:00';
      const currentEndTime = await AsyncStorage.getItem('userEndTime') || '03:00';
      
      // Load event type preferences from AsyncStorage  
      const savedPreferencesStr = await AsyncStorage.getItem('userPreferences');
      let eventTypePreferences: string[] = [];
      if (savedPreferencesStr) {
        try {
          eventTypePreferences = JSON.parse(savedPreferencesStr);
        } catch (e) {
          console.error('Error parsing saved preferences:', e);
          eventTypePreferences = [];
        }
      }
      console.log('📊 Using AsyncStorage event type preferences:', eventTypePreferences);
      
      // Load other user preferences from AsyncStorage
      const userTravelDistanceStr = await AsyncStorage.getItem('userTravelDistance');
      const userTravelDistance = userTravelDistanceStr ? parseFloat(userTravelDistanceStr) : 50;
      
      const userPreferredDaysStr = await AsyncStorage.getItem('userPreferredDays');
      let userPreferredDays: string[] = [];
      if (userPreferredDaysStr) {
        try {
          userPreferredDays = JSON.parse(userPreferredDaysStr);
        } catch (e) {
          console.error('Error parsing saved preferred days:', e);
          userPreferredDays = [];
        }
      }
      
      // Get minimal user profile data ONLY for ID, saved events, and basic info (NOT preferences)
      const userProfile = await dataManager.getUserProfile();

      const requestBody = {
        email: currentUserEmail,
        latitude: userLat,
        longitude: userLon,
        rejected_events: rejectedEventIds,
        filter_distance: filterByDistance,
        selected_dates: selectedDates,
        use_calendar_filter: isCalendarMode === 'true' && selectedDates.length > 0,
        user_start_time: currentStartTime,
        user_end_time: currentEndTime,
        event_type_preferences: eventTypePreferences,
        
        // OFFLINE-FIRST: Pass preferences from AsyncStorage + minimal database data
        user_id: userProfile?.id,
        user_preferences: eventTypePreferences, // Use AsyncStorage preferences, not database ones
        user_travel_distance: userTravelDistance,
        user_saved_events: savedEventIds, // Keep saved events from GlobalDataManager
        user_preferred_days: userPreferredDays,
        user_birthday: userProfile?.birthday, // Keep basic profile info from database
        user_gender: userProfile?.gender
      };
      
      console.log('🚀 OFFLINE-FIRST: Sending AsyncStorage preferences + minimal profile to backend');
      console.log('📊 Data summary:', {
        id: userProfile?.id,
        preferences_count: eventTypePreferences.length,
        travel_distance: userTravelDistance,
        saved_events_count: savedEventIds.length,
        preferred_days_count: userPreferredDays.length,
        has_birthday: !!userProfile?.birthday,
        has_gender: !!userProfile?.gender,
        preferences_source: 'AsyncStorage',
        database_queries_eliminated: 'user preferences, time settings, location, travel distance, preferred days'
      });

      console.log('🎯 CRITICAL: Sending saved events to backend:', savedEventIds);
      console.log('🎯 CRITICAL: Sending rejected events to backend:', rejectedEventIds);

      const response = await fetch('https://iamtheprince-whats-poppin.hf.space/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const eventsData = await response.json();
      
      // Check if we got events from the backend
      if (!eventsData.events || eventsData.events.length === 0) {
        console.log('⚠️ No events returned from backend - this is a legitimate empty response');
        setEVENTS([]);
        setCardIndex(0);
        setBackendReturnedEmpty(true); // Mark that backend legitimately returned empty
        // Don't save empty events to cache to prevent infinite loops
        return;
      }
      
      // If we got events, clear the backend empty flag
      setBackendReturnedEmpty(false);
      
      const processedEvents = await processEvents(eventsData.events);

      // Update state efficiently
      setCardIndex(0);
      setEVENTS(processedEvents);
      processedEventsRef.current = processedEvents;
      
      // Ensure swipedEventIds is clean for new events (should already be cleared in handleSwipedAll)
      console.log('🔄 Loading new events - swipedEventIds size should be 0:', swipedEventIds.size);
      if (swipedEventIds.size > 0) {
        console.log('⚠️ Warning: swipedEventIds not properly cleared, clearing now');
        setSwipedEventIds(new Set());
      }
      
      // Save events to cache only if we have events
      if (processedEvents.length > 0) {
        // Save all events to main state (using stable array approach)
        console.log('📊 New events loaded after swiping all - count:', processedEvents.length);
        console.log('🎯 STABLE ARRAY: Events will remain in EVENTS array, swiped events hidden via renderCard');
        
        await saveEventsToCache(processedEvents);
        console.log('✅ Backend fetch complete - new events loaded and cached:', processedEvents.length);
      } else {
        console.log('📊 Backend initialization complete - no events returned');
      }
      
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      // Set empty events to prevent infinite loops
      setEVENTS([]);
      setCardIndex(0);
    } finally {
      setLoading(false);
      setIsFetchingActivities(false);
    }
  }, [userLocation, dataManager, processEvents, saveEventsToCache]);

  const route = useRoute();

  useEffect(() => {
    // If a sharedEventId param is present, fetch that event and add to top of stack
    const sharedEventId = (route.params as any)?.sharedEventId;
    if (sharedEventId) {
      // Only add if not already present
      if (!EVENTS.some(e => e.id === parseInt(sharedEventId, 10))) {
        (async () => {
          try {
            const { data: event, error } = await supabase
              .from('new_events')
              .select('id, created_at, name, organization, location, cost, age_restriction, reservation, description, start_date, end_date, occurrence, latitude, longitude, days_of_the_week, event_type, link, times, featured, posted_by, posted_by_email')
              .eq('id', parseInt(sharedEventId, 10))
              .single();
            if (event) {
              // Add image URLs
              const randomImageIndex = Math.floor(Math.random() * 5);
              const imageUrl = `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/event-images/${event.id}/${randomImageIndex}.jpg`;
              const allImages = Array.from({ length: 5 }, (_, i) => 
                `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/event-images/${event.id}/${i}.jpg`
              );
              setEVENTS(prev => [{ ...event, image: imageUrl, allImages }, ...prev]);
              setCardIndex(0);
            }
          } catch (e) {
            console.error('Error fetching shared event for stack:', e);
          }
        })();
      } else {
        // If already present, move it to the top
        setEVENTS(prev => {
          const idx = prev.findIndex(e => e.id === parseInt(sharedEventId, 10));
          if (idx > 0) {
            const event = prev[idx];
            const newArr = [event, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
            return newArr;
          }
          return prev;
        });
        setCardIndex(0);
      }
    }
  }, [(route.params as any)?.sharedEventId]);

  useEffect(() => {
    let isMounted = true;
    
    const initializeEvents = async () => {
      if (!isMounted) return;
      
      // Don't initialize if we already have events, have already initialized, or are currently fetching
      if (EVENTS.length > 0 || hasInitialized || isFetchingActivities) {
        console.log('📦 Already have events, initialized, or fetching, skipping initialization', {
          eventsLength: EVENTS.length,
          hasInitialized,
          isFetchingActivities
        });
        return;
      }
      
      setLoading(true);
      
      // Try to load from cache first
      const loadedFromCache = await loadEventsFromCache();
      
      if (!isMounted) return;
      
      if (!loadedFromCache) {
        // If no cache, fetch from backend
        console.log('🔄 No cache found, fetching from backend...');
        try {
          await fetchTokenAndCallBackend();
        } catch (error) {
          console.error('❌ Failed to fetch from backend:', error);
          // Set loading to false even if backend call fails
          if (isMounted) {
            setLoading(false);
            setIsFetchingActivities(false);
          }
        }
      } else {
              console.log('✅ Loaded events from cache successfully');
      if (isMounted) {
        setLoading(false);
        setHasInitialized(true);
        console.log('📊 Cache initialization complete - events:', EVENTS.length, 'hasInitialized:', true);
      }
      }
      
      // Always request location permission
      if (isMounted) {
        await requestLocationPermission();
        setHasInitialized(true);
        console.log('📊 Location permission requested, initialization complete');
      }
    };
    
    // Add a timeout to prevent infinite initialization
    const timeoutId = setTimeout(() => {
      if (isMounted && loading) {
        console.log('⚠️ Initialization timeout, stopping loading');
        setLoading(false);
        setIsFetchingActivities(false);
        setHasInitialized(true);
      }
    }, 10000); // 10 second timeout
    
    initializeEvents();
    
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [loadEventsFromCache, fetchTokenAndCallBackend, requestLocationPermission]);



  // Cleanup effect to handle component unmount
  useEffect(() => {
    return () => {
      // Clear any pending operations on unmount
      setPendingOperations(new Set());
      
      // Don't save cache on unmount to prevent infinite loops
      // Cache is already being saved by the swipe tracking useEffect
    };
  }, []);

  // Debug effect to track pending operations
  useEffect(() => {
    if (pendingOperations.size > 0) {
      console.log(`📊 Pending operations: ${Array.from(pendingOperations).join(', ')}`);
    }
  }, [pendingOperations]);

  // Effect to automatically fetch new events when all current events are swiped
  useEffect(() => {
    // Only check if we have events and are not currently loading or handling swipedAll
    if (EVENTS.length > 0 && !loading && !isFetchingActivities && !isHandlingSwipedAll && hasInitialized) {
      const remainingEvents = EVENTS.filter(event => event != null && !swipedEventIds.has(event.id));
      console.log('🔍 Checking if all events swiped - remaining:', remainingEvents.length, 'total:', EVENTS.length, 'swiped:', swipedEventIds.size);
      
      if (remainingEvents.length === 0) {
        console.log('🚀 All events swiped! Automatically triggering backend fetch...');
        handleSwipedAll();
      }
    }
  }, [EVENTS.length, swipedEventIds.size, loading, isFetchingActivities, isHandlingSwipedAll, hasInitialized]);





  useEffect(() => {
    let animationLoop: Animated.CompositeAnimation | null = null;
    
    if (loading || isFetchingActivities) {
      // Start the fade-in animation for loading screen
      Animated.timing(loadingFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Start the pulse and rotate animations
      animationLoop = Animated.loop(
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
      );
      animationLoop.start();
    } else {
      // Fade out the loading screen when not loading
      Animated.timing(loadingFadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      if (animationLoop) {
        animationLoop.stop();
      }
    };
  }, [loading, isFetchingActivities]);

  // Start animations for "No Events Found" page
  useEffect(() => {
    let noEventsAnimationLoop: Animated.CompositeAnimation | null = null;
    
    if (!loading && !isFetchingActivities && EVENTS.length === 0) {
      // Start subtle animations for the empty state
      noEventsAnimationLoop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 0,
              duration: 2000,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(rotateAnim, {
              toValue: 1,
              duration: 4000,
              useNativeDriver: true,
            }),
            Animated.timing(rotateAnim, {
              toValue: 0,
              duration: 4000,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      noEventsAnimationLoop.start();
    }

    return () => {
      if (noEventsAnimationLoop) {
        noEventsAnimationLoop.stop();
      }
    };
  }, [loading, isFetchingActivities, EVENTS.length]);


  const handleCardPress = (card: EventCard) => {
    // Block all interactions if a swipe is in progress
    if (isSwipeInProgress) {
      return;
    }
    
    // Block multiple modal opens
    if (expandedCard) {
      return;
    }
    
    // Keep swiper visible - don't hide it when modal opens
    // This prevents race conditions and provides smoother UX
    
    // Measure the card position before expanding
    const cardRef = cardRefs.current[cardIndex];
    if (cardRef && cardRef.measure) {
      cardRef.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
        setCardPosition({ x: pageX, y: pageY, width, height });
        setExpandedCard(card);
      });
    } else {
      // Fallback if measurement fails
      setExpandedCard(card);
      setCardPosition(null);
    }
  };

  const handleBackPress = () => {
    // Simply clear modal state - swiper stays visible throughout
    setExpandedCard(null);
    setCardPosition(null);
  };

  const handleSwipeRight = async (cardIndex: number) => {
    // Update the cardIndex to point to the next card for color overlay effect
    setCardIndex(cardIndex + 1);
    
    // Mark swipe as in progress to block interactions
    setIsSwipeInProgress(true);
    
    // Shorter failsafe timer since we're unblocking UI immediately
    const failsafeTimer = setTimeout(() => {
      setIsSwipeInProgress(false);
    }, 1000); // Much shorter since we unblock immediately anyway
    
    const likedEvent = EVENTS[cardIndex];
    
    // Safety check for undefined event
    if (!likedEvent) {
      console.warn('handleSwipeRight: No event found at cardIndex', cardIndex, 'EVENTS length:', EVENTS.length);
      setIsSwipeInProgress(false);
      clearTimeout(failsafeTimer);
      return;
    }
    
    const operationId = `save-${likedEvent.id}-${Date.now()}`;
    
    // Track this operation
    setPendingOperations(prev => new Set(prev).add(operationId));
    console.log(`💾 Starting save operation for event ${likedEvent.id}`);
    
    // Clear swipe in progress IMMEDIATELY to unblock UI
    setIsSwipeInProgress(false);
    clearTimeout(failsafeTimer);
    
    // Reset any expanded card state to prevent interference
    setExpandedCard(null);
    setCardPosition(null);

    // Start animation immediately (non-blocking)
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
      })
    ]).start();
    
    // Do save operations with proper tracking
    (async () => {
      try {
        // Save the event using optimized service with automatic optimistic updates
        const services = OptimizedComponentServices.getInstance();
        await services.saveEvent(likedEvent.id);
        
        console.log('✅ Event saved successfully with optimistic updates');
        
        // Track the swiped event
        setSwipedEventIds(prev => new Set(prev).add(likedEvent.id));
        console.log('💾 Added liked event to swiped list:', likedEvent.id, 'Total swiped:', swipedEventIds.size + 1);
        
        // Update cache ONLY - keep EVENTS array stable for swiper
        setTimeout(async () => {
          // Explicitly filter out this specific event and all previously swiped events
          const currentSwipedIds = new Set(swipedEventIds);
          currentSwipedIds.add(likedEvent.id); // Add the current event
          const filteredEvents = EVENTS.filter(event => event && !currentSwipedIds.has(event.id));
          
          const cacheData = {
            events: filteredEvents,
            swipedEventIds: Array.from(currentSwipedIds)
          };
          await AsyncStorage.setItem('suggestedEventsCache', JSON.stringify(cacheData));
          console.log('💾 Updated cache after liking event, removed event from cache:', likedEvent.id);
          console.log('📊 Cache updated with', filteredEvents.length, 'events, EVENTS array remains stable, size:', EVENTS.length);
        }, 300);
        
      } catch (error) {
        console.error('Error saving event:', error);
      } finally {
        // Mark operation as complete
        setPendingOperations(prev => {
          const newSet = new Set(prev);
          newSet.delete(operationId);
          return newSet;
        });
        console.log(`✅ Completed save operation for event ${likedEvent.id}`);
      }
    })();
  };


  // Add a watchdog effect to reset isSwipeInProgress if it gets stuck
  useEffect(() => {
    if (isSwipeInProgress) {
      const watchdogTimer = setTimeout(() => {
        setIsSwipeInProgress(false);
      }, 10000); // Force reset after 10 seconds if still stuck

      return () => {
        clearTimeout(watchdogTimer);
      };
    }
  }, [isSwipeInProgress]);

  // Comprehensive animation cleanup on component unmount
  useEffect(() => {
    return () => {
      // Stop all animations to prevent memory leaks
      console.log('🧹 SuggestedEvents: Cleaning up animations');
      
      // Stop all animated values
      swipeX.stopAnimation();
      fadeAnim.stopAnimation();
      scaleAnim.stopAnimation();
      contentFadeAnim.stopAnimation();
      pulseAnim.stopAnimation();
      rotateAnim.stopAnimation();
      savedActivityFadeAnim.stopAnimation();
      savedActivityScaleAnim.stopAnimation();
      savedActivityOpacityAnim.stopAnimation();
      loadingFadeAnim.stopAnimation();
      
      // Clean up any running animation loops
      if (swiperRef.current) {
        // Stop any ongoing swiper animations
        try {
          swiperRef.current.swipeBack();
        } catch (e) {
          // Ignore errors if swiper is already stopped
        }
      }
    };
  }, []);

  const handleSwipedAll = async () => {
    // Prevent multiple simultaneous calls
    if (isHandlingSwipedAll) {
      console.log('⚠️ handleSwipedAll already in progress, skipping...');
      return;
    }
    
    setIsHandlingSwipedAll(true);
    
    console.log('🚀 HANDLESWIPEDALL TRIGGERED - All cards swiped, starting fetch process...');
    console.log('📊 Current state before handleSwipedAll:', {
      eventsLength: EVENTS.length,
      swipedCount: swipedEventIds.size,
      loading,
      isFetchingActivities,
      hasInitialized
    });
    
    // Wait for all pending save/reject operations to complete
    const waitForPendingOperations = () => {
      return new Promise<void>((resolve) => {
        const checkPending = () => {
          if (pendingOperations.size === 0) {
            console.log('✅ All pending operations completed');
            resolve();
          } else {
            console.log(`⏳ Waiting for ${pendingOperations.size} pending operations...`);
            setTimeout(checkPending, 100); // Check every 100ms
          }
        };
        checkPending();
      });
    };
    
    // Wait with a timeout to prevent infinite waiting
    const waitWithTimeout = Promise.race([
      waitForPendingOperations(),
      new Promise<void>((resolve) => {
        setTimeout(() => {
          console.log('⚠️ Timeout waiting for pending operations, proceeding anyway');
          resolve();
        }, 5000); // 5 second timeout
      })
    ]);
    
    await waitWithTimeout;
    
    try {
      console.log('🔄 Refreshing all data to ensure latest state...');
      
      // CRITICAL: Force a complete data refresh to ensure we have the absolute latest data
      await GlobalDataManager.getInstance().refreshAllData();
      
      // Additional delay to ensure database transactions are fully committed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Double-check: Get the latest saved and rejected events after refresh
      const [rejectedEvents, savedEvents] = await Promise.all([
        dataManager.getRejectedEvents(),
        dataManager.getSavedEvents()
      ]);
      
      const rejectedEventIds = rejectedEvents.map((e: any) => e.id.toString());
      const savedEventIds = savedEvents.map((e: any) => e.id.toString());
      
      console.log('📊 Final state before backend call:', {
        rejectedEventsCount: rejectedEventIds.length,
        savedEventsCount: savedEventIds.length,
        lastSavedEvents: savedEventIds.slice(-3) // Log last 3 saved events
      });
      
      // Update both rejected and saved events in Supabase to ensure backend has latest data
      await dataManager.updateRejectedEventsInSupabase(rejectedEventIds);
      
      console.log('🔄 Setting loading states and clearing old data...');
      
      // Set loading states EARLY to show loading UI
      setLoading(true);
      setIsFetchingActivities(true);
      
      // Clear the backend empty flag since we're about to fetch new data
      setBackendReturnedEmpty(false);
      
      // Clear the cache and swiped events since all events have been swiped
      await clearEventsCache();
      setSwipedEventIds(new Set());
      
      // Clear current EVENTS to prevent showing old events during loading
      setEVENTS([]);
      
      console.log('✅ Loading states set, cache cleared, ready to fetch backend...');
      
      // Reset initialization flag to allow new events to be loaded
      setHasInitialized(false);
      
      // Now call backend with fully updated data
      try {
        await fetchTokenAndCallBackend();
        console.log('✅ Successfully fetched new events after swiping all');
      } catch (error) {
        console.error('❌ Error in handleSwipedAll backend call:', error);
        // Don't retry to prevent infinite loops, but ensure loading stops
        setLoading(false);
        setIsFetchingActivities(false);
      }
      
      setCardIndex(0);
    } catch (error) {
      console.error('Error in handleSwipedAll:', error);
      setLoading(false);
      setIsFetchingActivities(false);
    } finally {
      setIsHandlingSwipedAll(false);
      console.log('✅ handleSwipedAll completed, guard reset');
    }
  };

  // Simplified animation state management - SavedActivities handles its own animations
  useEffect(() => {
    if (isSavedLikesVisible) {
      console.log('SavedActivities opened');
    } else {
      console.log('SavedActivities closed');
    }
  }, [isSavedLikesVisible]);

  // Update the close button handler
  const handleCloseSavedActivities = () => {
    console.log('Closing Saved Activities');
    setIsSavedLikesVisible(false);
  };

  // Open overlay and fetch saved activities
  const openSavedActivities = () => {
    // Prevent opening if already visible
    if (isSavedLikesVisible) {
      console.log('SavedActivities button blocked: already visible');
      return;
    }
    
    console.log('Opening Saved Activities');
    setIsSavedLikesVisible(true);
  };

  // Add this effect for the saved activity expanded card animation
  useEffect(() => {
    if (expandedSavedActivity) {
      Animated.parallel([
        Animated.timing(savedActivityFadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(savedActivityScaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(savedActivityOpacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(savedActivityFadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(savedActivityScaleAnim, {
          toValue: 0.8,
          friction: 5,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.timing(savedActivityOpacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [expandedSavedActivity]);

  // Add effect for content fade animation
  useEffect(() => {
    if (!loading && !isFetchingActivities) {
      Animated.timing(contentFadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } else {
      contentFadeAnim.setValue(0);
    }
  }, [loading, isFetchingActivities]);

  const handleSwipedLeft = async (cardIndex: number) => {
    // Update the cardIndex to point to the next card for color overlay effect
    setCardIndex(cardIndex + 1);
    
    // Mark swipe as in progress to block interactions
    setIsSwipeInProgress(true);
    
    // Failsafe timer to reset isSwipeInProgress if it gets stuck
    const failsafeTimer = setTimeout(() => {
      setIsSwipeInProgress(false);
    }, 5000); // Reset after 5 seconds maximum
    
    const rejectedEvent = EVENTS[cardIndex];
    
    // Safety check for undefined event
    if (!rejectedEvent) {
      console.warn('handleSwipedLeft: No event found at cardIndex', cardIndex, 'EVENTS length:', EVENTS.length);
      setIsSwipeInProgress(false);
      clearTimeout(failsafeTimer);
      return;
    }
    
    const operationId = `reject-${rejectedEvent.id}-${Date.now()}`;
    
    // Track this operation
    setPendingOperations(prev => new Set(prev).add(operationId));
    console.log(`❌ Starting reject operation for event ${rejectedEvent.id}`);

    try {
      // Update rejected events in AsyncStorage
      await dataManager.updateRejectedEvents(rejectedEvent);
      
      // Also immediately update Supabase to prevent race conditions
      const rejectedEvents = await dataManager.getRejectedEvents();
      const rejectedEventIds = rejectedEvents.map((e: any) => e.id.toString());
      await dataManager.updateRejectedEventsInSupabase(rejectedEventIds);
      
      // Track the swiped event
      setSwipedEventIds(prev => new Set(prev).add(rejectedEvent.id));
      console.log('💾 Added rejected event to swiped list:', rejectedEvent.id, 'Total swiped:', swipedEventIds.size + 1);
      
      // Update cache ONLY - keep EVENTS array stable for swiper
      setTimeout(async () => {
        // Explicitly filter out this specific event and all previously swiped events
        const currentSwipedIds = new Set(swipedEventIds);
        currentSwipedIds.add(rejectedEvent.id); // Add the current event
        const filteredEvents = EVENTS.filter(event => event && !currentSwipedIds.has(event.id));
        
        const cacheData = {
          events: filteredEvents,
          swipedEventIds: Array.from(currentSwipedIds)
        };
        await AsyncStorage.setItem('suggestedEventsCache', JSON.stringify(cacheData));
        console.log('💾 Updated cache after rejecting event, removed event from cache:', rejectedEvent.id);
        console.log('📊 Cache updated with', filteredEvents.length, 'events, EVENTS array remains stable, size:', EVENTS.length);
      }, 300);
      
      // Clear the failsafe timer since we completed successfully
      clearTimeout(failsafeTimer);
    } catch (error) {
      console.error('Error rejecting event:', error);
      // Clear the failsafe timer
      clearTimeout(failsafeTimer);
    } finally {
      // Mark operation as complete
      setPendingOperations(prev => {
        const newSet = new Set(prev);
        newSet.delete(operationId);
        return newSet;
      });
      console.log(`✅ Completed reject operation for event ${rejectedEvent.id}`);
    }

    // Clear swipe in progress immediately after backend operations complete
    setIsSwipeInProgress(false);
    
    // Reset any expanded card state to prevent interference
    setExpandedCard(null);
    setCardPosition(null);

    // Don't manually increment card index - let Swiper handle it automatically
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
      })
    ]).start();
  };

  // Add refs for measuring card positions
  const cardRefs = useRef<{ [key: number]: any }>({});

  if (loading && !isFetchingActivities) {
    const spin = rotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });
    const scale = pulseAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.8, 1.2],
    });
  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: colorScheme === 'dark' ? '#181818' : '#F2F2F2' }
    ]}>
        {/* Top Buttons (Saved Events and Filters) */}
      <View style={styles.topButtons}>
        <TouchableOpacity 
          style={[
            styles.topButton,
            isSavedLikesVisible && { opacity: 0.5 }
          ]}
          onPress={openSavedActivities}
          activeOpacity={0.7}
          disabled={isSavedLikesVisible}
        >
          <LinearGradient
            colors={[Colors.light.accent, Colors.light.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientButton}
          >
            <Ionicons name="heart" size={24} color="white" />
          </LinearGradient>
        </TouchableOpacity>
        
        {/* Logo in center */}
        <View style={styles.logoContainer}>
          <Image 
            source={colorScheme === 'light' ? require('../assets/images/logo-light.png') : require('../assets/images/logo.png')}
            style={[styles.logo, colorScheme === 'dark' && styles.logoScaled]}
            resizeMode="contain"
          />
        </View>
        
        <TouchableOpacity 
          style={styles.topButton}
          onPress={() => setIsFilterVisible(true)}
        >
          <LinearGradient
            colors={[Colors.light.accent, Colors.light.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientButton}
          >
            <Ionicons name="filter" size={24} color="white" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
        {/* Loading Spinner and Text */}
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
            <View style={[styles.innerCircle, { backgroundColor: `${Colors[colorScheme ?? 'light'].accent}20` }]} />
          </Animated.View>
          <Text style={[styles.loadingText, { color: Colors[colorScheme ?? 'light'].text, marginTop: 20 }]}>Loading events...</Text>
        </View>
        <View style={styles.footerContainer}>
          <MainFooter activeTab="home" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: colorScheme === 'dark' ? '#181818' : '#F2F2F2' }
    ]}>
      <View style={styles.topButtons}>
        <TouchableOpacity 
          style={[
            styles.topButton,
            isSavedLikesVisible && { opacity: 0.5 }
          ]}
          onPress={openSavedActivities}
          activeOpacity={0.7}
          disabled={isSavedLikesVisible}
        >
          <LinearGradient
            colors={[Colors.light.accent, Colors.light.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientButton}
          >
            <Ionicons name="heart" size={24} color="white" />
          </LinearGradient>
        </TouchableOpacity>
        
        {/* Logo in center */}
        <View style={styles.logoContainer}>
          <Image 
            source={colorScheme === 'light' ? require('../assets/images/logo-light.png') : require('../assets/images/logo.png')}
            style={[styles.logo, colorScheme === 'dark' && styles.logoScaled]}
            resizeMode="contain"
          />
        </View>
        
        <TouchableOpacity 
          style={styles.topButton}
          onPress={() => setIsFilterVisible(true)}
        >
          <LinearGradient
            colors={[Colors.light.accent, Colors.light.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientButton}
          >
            <Ionicons name="filter" size={24} color="white" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {(loading || isFetchingActivities) ? (
        <Animated.View 
          style={[
            styles.loadingContainer,
            { opacity: loadingFadeAnim }
          ]}
        >
          <Animated.View
            style={[
              styles.loadingCircle,
              {
                transform: [{ scale: pulseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1.2],
                })}, { rotate: rotateAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '360deg'],
                })}],
                borderColor: Colors[colorScheme ?? 'light'].accent,
              },
            ]}
          >
            <View style={[styles.innerCircle, { backgroundColor: `${Colors[colorScheme ?? 'light'].accent}20` }]} />
          </Animated.View>
          <Text style={[styles.loadingText, { color: Colors[colorScheme ?? 'light'].text, marginTop: 20 }]}>
            {isFetchingActivities ? 'Fetching activities...' : 'Loading events...'}
          </Text>
        </Animated.View>
      ) : (
        <Animated.View 
          style={[
            styles.contentContainer,
            { opacity: contentFadeAnim }
          ]}
        >
          {(() => {
            const hasUnswipedEvents = EVENTS.length > 0 && EVENTS.some(event => event != null && !swipedEventIds.has(event.id));
            const isLoading = loading || isFetchingActivities;
            const hasEventsLocally = EVENTS.length > 0; // Even if all swiped, we have events locally
            const isHandlingSwipedAllProcess = isHandlingSwipedAll;
            
            // Show swiper/loading if:
            // 1. We have unswipped events, OR
            // 2. We're currently loading, OR  
            // 3. We have events locally (even if all swiped) AND backend hasn't returned empty, OR
            // 4. We're handling the swipedAll process
            const shouldShowSwiper = hasUnswipedEvents || isLoading || (hasEventsLocally && !backendReturnedEmpty) || isHandlingSwipedAllProcess;
            
            console.log('🎯 Render decision:', {
              eventsLength: EVENTS.length,
              swipedCount: swipedEventIds.size,
              hasUnswipedEvents,
              hasEventsLocally,
              backendReturnedEmpty,
              isLoading,
              isHandlingSwipedAllProcess,
              shouldShowSwiper
            });
            
            return shouldShowSwiper;
          })() ? (
            <>
              <View style={styles.swiperContainer}>
                <Swiper
                  ref={swiperRef}
                  cards={EVENTS}
                  cardIndex={Math.min(cardIndex, EVENTS.length - 1)}
                  renderCard={(card: EventCard, index: number) => {
                    // Add safety check for undefined card
                    if (!card) {
                      console.warn('SuggestedEvents: Received undefined card at index', index);
                      return null;
                    }
                    
                    // If this event has been swiped, don't render it
                    if (swipedEventIds.has(card.id)) {
                      return null;
                    }
                    
                    const isTopCard = index === cardIndex;
                      // Use the first image URL for all cards if available
                      const eventImageUrl = card.image;

                    return (
                      <TouchableOpacity 
                        ref={(ref) => { cardRefs.current[index] = ref; }}
                        onPress={() => {
                          console.log('🎯 TouchableOpacity onPress triggered for:', card.name);
                          handleCardPress(card);
                        }}
                        
                        activeOpacity={1}
                        disabled={isSwipeInProgress}
                        style={{ flex: 1 }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <View style={styles.cardContainer}>
                          <LinearGradient
                            colors={colorScheme === 'dark' 
                              ? ['#2A2A2A', '#1F1F1F', '#252525'] 
                              : ['#FFFFFF', '#F8F9FA', '#FFFFFF']
                            }
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.card}
                          >
                            {/* Color Overlay - Applied only to the top card */}
                            {index === cardIndex && (
                              <Animated.View 
                                style={[
                                  styles.colorOverlay,
                                  {
                                    backgroundColor: swipeX.interpolate({
                                      inputRange: [-200, 0, 200],
                                      outputRange: [
                                        'rgba(255, 68, 68, 0.2)', // Red overlay for left swipe
                                        'transparent', // No overlay for center
                                        'rgba(68, 255, 68, 0.2)' // Green overlay for right swipe
                                      ],
                                      extrapolate: 'clamp'
                                    })
                                  }
                                ]}
                              />
                            )}
                            {/* Image Container with Overlay */}
                            <View style={styles.imageContainer}>
                              {eventImageUrl ? (
                                <Image 
                                  source={{ uri: eventImageUrl }}
                                  style={styles.modernImage} 
                                  onError={(e) => {
                                    console.log('Image failed to load, trying next image for event:', card.id, '(retry once)');
                                    // Only retry once - try the next image if available
                                    if (card.allImages && card.allImages.length > 0) {
                                      // Get current failed image and find its index
                                      const currentImageUrl = eventImageUrl;
                                      let currentIndex = -1;
                                      
                                      // Find current index, handling the case where it might not be found
                                      if (currentImageUrl) {
                                        currentIndex = card.allImages.findIndex(url => url === currentImageUrl);
                                      }
                                      
                                      // Only try the next image (retry once)
                                      const nextIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
                                      
                                      if (nextIndex < card.allImages.length) {
                                        const nextImageUrl = card.allImages[nextIndex];
                                        
                                        // Only try if it's a different image
                                        if (nextImageUrl !== currentImageUrl) {
                                          console.log(`Retrying with image ${nextIndex} for event ${card.id}`);
                                          setEVENTS(prevEvents => 
                                            prevEvents.map(event => 
                                              event.id === card.id ? { ...event, image: nextImageUrl } : event
                                            )
                                          );
                                        } else {
                                          console.log('No different image to try for event:', card.id);
                                          setEVENTS(prevEvents => 
                                            prevEvents.map(event => 
                                              event.id === card.id ? { ...event, image: null } : event
                                            )
                                          );
                                        }
                                      } else {
                                        console.log('No more images to try for event:', card.id);
                                        setEVENTS(prevEvents => 
                                          prevEvents.map(event => 
                                            event.id === card.id ? { ...event, image: null } : event
                                          )
                                        );
                                      }
                                    } else {
                                      // No allImages array, just show placeholder
                                      console.log('No allImages array for event:', card.id);
                                      setEVENTS(prevEvents => 
                                        prevEvents.map(event => 
                                          event.id === card.id ? { ...event, image: null } : event
                                        )
                                      );
                                    }
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
                                  style={[styles.modernImage, styles.imagePlaceholder, styles.placeholderGradient]}
                                >
                                  <Ionicons name="image-outline" size={40} color="#B97AFF" style={{ marginTop: -12 }} />
                                  <Text style={styles.placeholderTitle}>No Event Image</Text>
                                  <Text style={styles.placeholderText}>But the fun is still on! 🎈</Text>
                                </LinearGradient>
                              )}
                              
                              {/* Image Overlay for Better Text Readability */}
                              <LinearGradient
                                colors={['transparent', 'transparent', 'rgba(0,0,0,0.3)']}
                                style={styles.imageOverlay}
                              />
                              

                              
                              {/* Profile Picture in Top Right */}
                              {(card.organization || card.posted_by) && profileImageStates[card.id] !== false && (
                                <View style={styles.topRightProfileContainer}>
                                  <Image 
                                    source={{ 
                                      uri: `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/user-images/${(card.posted_by_email || card.organization).replace('@', '_').replace(/\./g, '_')}/profile.jpg` 
                                    }}
                                    style={styles.topRightProfileImage}
                                    onError={() => {
                                      console.log(`Failed to load profile image for ${card.posted_by || card.organization}`);
                                      // Hide the avatar container when image fails to load
                                      setProfileImageStates(prev => ({
                                        ...prev,
                                        [card.id]: false
                                      }));
                                    }}
                                    onLoad={() => {
                                      // Mark that profile image loaded successfully
                                      setProfileImageStates(prev => ({
                                        ...prev,
                                        [card.id]: true
                                      }));
                                    }}
                                  />
                                </View>
                              )}

                              {/* Featured Badge */}
                              {card.featured && (
                                <View style={styles.modernFeaturedBadge}>
                                  <LinearGradient
                                    colors={['#FFD700', '#FFA500', '#FF8C00']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.featuredBadgeGradient}
                                  >
                                    <Ionicons name="star" size={14} color="white" />
                                    <Text style={styles.modernFeaturedText}>FEATURED</Text>
                                  </LinearGradient>
                                </View>
                              )}

                              {/* Expiring Soon Badge */}
                              {isEventExpiringSoon(card) && (
                                <View style={[styles.modernFeaturedBadge, { top: card.featured ? 50 : 12 }]}>
                                  <LinearGradient
                                    colors={['#ff4444', '#ff6666', '#ff4444']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.featuredBadgeGradient}
                                  >
                                    <Ionicons name="time" size={14} color="white" />
                                    <Text style={styles.modernFeaturedText}>EXPIRING SOON</Text>
                                  </LinearGradient>
                                </View>
                              )}
                              

                            </View>

                            {/* Content Section */}
                            <View style={styles.cardContent}>
                              {/* Title and Organization */}
                              <View style={styles.titleSection}>
                                <Text style={[styles.modernTitle, { color: colorScheme === 'dark' ? '#FFFFFF' : '#1A1A1A' }]} numberOfLines={2}>
                                  {card.name}
                                </Text>
                                {(card.organization || card.posted_by) && (
                                  <Text style={[styles.organizationLabel, { color: colorScheme === 'dark' ? '#B0B0B0' : '#666666' }]} numberOfLines={1}>
                                    by {card.posted_by ? card.posted_by.split('@')[0] : card.organization}
                                  </Text>
                                )}
                              </View>

                              {/* Tags Row */}
                              {card.event_type && (
                                <View style={styles.tagsContainer}>
                                  <View style={styles.eventTypeTag}>
                                    <Text style={styles.tagText}>{card.event_type}</Text>
                                  </View>
                                </View>
                              )}

                              {/* People You Follow Who Saved This Event */}
                              {card.friendsWhoSaved && card.friendsWhoSaved.length > 0 && (
                                <View style={styles.friendsContainer}>
                                  <View style={styles.friendsHeader}>
                                    <Ionicons name="people" size={16} color="#9E95BD" />
                                    <Text style={[styles.friendsText, { color: colorScheme === 'dark' ? '#B0B0B0' : '#666666' }]}>
                                      {card.friendsWhoSaved.length === 1 
                                        ? `${card.friendsWhoSaved[0].name} saved this`
                                        : card.friendsWhoSaved.length === 2
                                        ? `${card.friendsWhoSaved[0].name} and ${card.friendsWhoSaved[1].name} saved this`
                                        : `${card.friendsWhoSaved[0].name} and ${card.friendsWhoSaved.length - 1} others saved this`
                                      }
                                    </Text>
                                  </View>
                                  <View style={styles.friendsAvatars}>
                                    {card.friendsWhoSaved.slice(0, 3).map((friend, friendIndex) => (
                                      <View 
                                        key={friend.id} 
                                        style={[
                                          styles.friendAvatar, 
                                          { marginLeft: friendIndex > 0 ? -8 : 0, zIndex: 3 - friendIndex }
                                        ]}
                                      >
                                        <Image 
                                          source={{ 
                                            uri: `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/user-images/${friend.email.replace('@', '_').replace(/\./g, '_')}/profile.jpg` 
                                          }}
                                          style={styles.friendAvatarImage}
                                          defaultSource={require('../assets/images/icon.png')}
                                          onError={() => {
                                            // Fallback to icon if image fails to load
                                            console.log(`Failed to load profile image for friend ${friend.email}`);
                                          }}
                                        />
                                      </View>
                                    ))}
                                    {card.friendsWhoSaved.length > 3 && (
                                      <View style={[styles.friendAvatar, styles.moreAvatar, { marginLeft: -8, zIndex: 0 }]}>
                                        <Text style={styles.moreAvatarText}>+{card.friendsWhoSaved.length - 3}</Text>
                                      </View>
                                    )}
                                  </View>
                                </View>
                              )}

                              {/* Cost, Distance, and Date Row */}
                              <View style={[
                                styles.bottomRow,
                                { justifyContent: card.start_date ? 'space-around' : 'flex-start' }
                              ]}>
                                {/* Cost and Distance Group when no date */}
                                {!card.start_date ? (
                                  <View style={styles.costDistanceGroup}>
                                    {/* Cost - only show if cost information is available */}
                                    {(card.cost !== undefined && card.cost !== null) && (
                                      <View style={styles.costContainer}>
                                        <LinearGradient
                                          colors={['#9E95BD', '#B8AECC', '#9E95BD']}
                                          start={{ x: 0, y: 0 }}
                                          end={{ x: 1, y: 1 }}
                                          style={styles.costBadge}
                                        >
                                          <Ionicons 
                                            name="cash" 
                                            size={12} 
                                            color="white" 
                                          />
                                          <Text style={styles.costText}>
                                            {card.cost === 0 ? 'FREE' : `$${card.cost}`}
                                          </Text>
                                        </LinearGradient>
                                      </View>
                                    )}

                                    {/* Distance */}
                                    {typeof card.distance === 'number' && (
                                      <View style={styles.distanceContainer}>
                                        <View style={styles.infoIconBackground}>
                                          <Ionicons name="walk" size={12} color="#9E95BD" />
                                        </View>
                                        <Text style={[styles.distanceText, { color: colorScheme === 'dark' ? '#D0D0D0' : '#555555' }]}>
                                          {card.distance.toFixed(1)} km
                                        </Text>
                                      </View>
                                    )}
                                  </View>
                                ) : (
                                  <>
                                    {/* Cost - only show if cost information is available */}
                                    {(card.cost !== undefined && card.cost !== null) && (
                                      <View style={styles.costContainer}>
                                        <LinearGradient
                                          colors={['#9E95BD', '#B8AECC', '#9E95BD']}
                                          start={{ x: 0, y: 0 }}
                                          end={{ x: 1, y: 1 }}
                                          style={styles.costBadge}
                                        >
                                          <Ionicons 
                                            name="cash" 
                                            size={12} 
                                            color="white" 
                                          />
                                          <Text style={styles.costText}>
                                            {card.cost === 0 ? 'FREE' : `$${card.cost}`}
                                          </Text>
                                        </LinearGradient>
                                      </View>
                                    )}

                                    {/* Distance */}
                                    {typeof card.distance === 'number' && (
                                      <View style={styles.distanceContainer}>
                                        <View style={styles.infoIconBackground}>
                                          <Ionicons name="walk" size={12} color="#9E95BD" />
                                        </View>
                                        <Text style={[styles.distanceText, { color: colorScheme === 'dark' ? '#D0D0D0' : '#555555' }]}>
                                          {card.distance.toFixed(1)} km
                                        </Text>
                                      </View>
                                    )}

                                    {/* Date */}
                                    <View style={styles.dateContainer}>
                                      <Ionicons name="calendar-outline" size={12} color={colorScheme === 'dark' ? '#B0B0B0' : '#888888'} />
                                      <Text style={[styles.dateText, { color: colorScheme === 'dark' ? '#B0B0B0' : '#888888' }]}>
                                        {new Date(card.start_date).toLocaleDateString('en-US', { 
                                          month: 'short', 
                                          day: 'numeric' 
                                        })}
                                      </Text>
                                    </View>
                                  </>
                                )}
                              </View>
                            </View>

                            {/* Subtle Card Border */}
                            <View style={[styles.cardBorder, { borderColor: colorScheme === 'dark' ? '#333333' : '#E5E5E5' }]} />
                          </LinearGradient>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                  onSwipedLeft={(cardIndex) => {
                    console.log('🔄 Swiper onSwipedLeft called with cardIndex:', cardIndex, 'Total cards:', EVENTS.length);
                    handleSwipedLeft(cardIndex);
                  }}
                  onSwipedRight={(cardIndex) => {
                    console.log('🔄 Swiper onSwipedRight called with cardIndex:', cardIndex, 'Total cards:', EVENTS.length);
                    handleSwipeRight(cardIndex);
                  }}
                    onSwipedAll={() => {
                      // Only handle swipedAll if we've actually swiped all non-null events
                      const remainingEvents = EVENTS.filter(event => event != null && !swipedEventIds.has(event.id));
                      console.log('🔄 onSwipedAll triggered: remaining events =', remainingEvents.length, 'total events =', EVENTS.length, 'swiped =', swipedEventIds.size);
                      if (remainingEvents.length === 0) {
                        console.log('✅ All events swiped, triggering handleSwipedAll');
                        handleSwipedAll();
                      } else {
                        console.log('⏳ Still have', remainingEvents.length, 'events remaining, not fetching new ones yet');
                      }
                    }}
                  onSwiping={(x) => {
                    swipeX.setValue(x);
                  }}
                  backgroundColor="transparent"
                  stackSize={3}
                  stackSeparation={15}
                  overlayLabels={{
                    left: {
                      style: { 
                        label: { color: 'red', fontSize: 32, fontWeight: 'bold' }, 
                        wrapper: { 
                          flexDirection: 'column', 
                          alignItems: 'flex-end', 
                          justifyContent: 'flex-start', 
                          marginTop: 30, 
                          marginLeft: -30 
                        } 
                      }
                    },
                    right: {
                      style: { 
                        label: { color: 'green', fontSize: 32, fontWeight: 'bold' }, 
                        wrapper: { 
                          flexDirection: 'column', 
                          alignItems: 'flex-start', 
                          justifyContent: 'flex-start', 
                          marginTop: 30, 
                          marginLeft: 30 
                        } 
                      }
                    }
                  }}
                  disableTopSwipe
                  disableBottomSwipe
                  useViewOverflow={false}
                />
              </View>

              <Animated.View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.nopeButton]}
                  onPress={() => swiperRef.current?.swipeLeft()}
                  disabled={isSwipeInProgress}
                >
                  <Ionicons name="close" size={32} color="red" />
                </TouchableOpacity>
                {/* Reload Button */}
                <TouchableOpacity
                  style={[styles.actionButton, styles.reloadButton]}
                  onPress={async () => {
                    setLoading(true);
                    await clearEventsCache();
                    fetchTokenAndCallBackend();
                  }}
                >
                  <Ionicons name="reload" size={32} color="#9E95BD" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.likeButton]}
                  onPress={() => swiperRef.current?.swipeRight()}
                  disabled={isSwipeInProgress}
                >
                  <Ionicons name="checkmark" size={32} color="green" />
                </TouchableOpacity>
              </Animated.View>
            </>
          ) : (
            <View style={styles.noEventsContainer}>
              {/* Animated Icon Container */}
              <Animated.View 
                style={[
                  styles.noEventsIconContainer,
                  {
                    transform: [
                      { scale: pulseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.9, 1.1],
                      })},
                      { rotate: rotateAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '10deg'],
                      })}
                    ]
                  }
                ]}
              >
                <LinearGradient
                  colors={['#9E95BD', '#B8AECC', '#D4C9E8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.noEventsIconGradient}
                >
                  <Ionicons name="search-outline" size={32} color="white" />
                </LinearGradient>
              </Animated.View>

              {/* Main Content */}
              <View style={styles.noEventsContent}>
                <Text style={[styles.noEventsTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                  No Events Found
                </Text>
                <Text style={[styles.noEventsSubtitle, { color: colorScheme === 'dark' ? '#B0B0B0' : '#666666' }]}>
                  We couldn't find any events matching your current preferences.
                </Text>
                <Text style={[styles.noEventsDescription, { color: colorScheme === 'dark' ? '#888888' : '#888888' }]}>
                  Try adjusting your filters or refreshing for new recommendations.
                </Text>
              </View>

              {/* Action Cards */}
              <View style={styles.noEventsActions}>
                {/* Adjust Filters Card */}
                <TouchableOpacity 
                  style={styles.actionCard}
                  onPress={() => setIsFilterVisible(true)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#667eea', '#764ba2']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.actionCardGradient}
                  >
                    <View style={styles.actionCardIcon}>
                      <Ionicons name="options" size={20} color="white" />
                    </View>
                    <View style={styles.actionCardContent}>
                      <Text style={styles.actionCardTitle}>Adjust Filters</Text>
                      <Text style={styles.actionCardSubtitle}>Modify your preferences</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="rgba(255, 255, 255, 0.8)" />
                  </LinearGradient>
                </TouchableOpacity>

                {/* Refresh Card */}
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={async () => {
                    setLoading(true);
                    await clearEventsCache();
                    fetchTokenAndCallBackend();
                  }}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#f093fb', '#f5576c']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.actionCardGradient}
                  >
                    <View style={styles.actionCardIcon}>
                      <Ionicons name="refresh" size={20} color="white" />
                    </View>
                    <View style={styles.actionCardContent}>
                      <Text style={styles.actionCardTitle}>Refresh Events</Text>
                      <Text style={styles.actionCardSubtitle}>Get new recommendations</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="rgba(255, 255, 255, 0.8)" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* Bottom Suggestion */}
              <View style={styles.noEventsBottomSection}>
                <View style={styles.suggestionCard}>
                  <View style={styles.suggestionCardContainer}>
                    <Text style={[styles.suggestionText, { color: colorScheme === 'dark' ? '#B0B0B0' : '#666666' }]}>
                      <Text style={styles.suggestionBold}>Pro tip:</Text> Try expanding your search radius or removing specific date filters for more results.
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </Animated.View>
      )}

      <View style={styles.footerContainer}>
        <MainFooter activeTab="home" />
      </View>

      <EventFilterOverlay
        visible={isFilterVisible}
        onClose={() => {
          setIsFilterVisible(false);
        }}
        setLoading={setLoading}
        fetchTokenAndCallBackend={async () => {
          await clearEventsCache();
          fetchTokenAndCallBackend();
        }}
        onStartLoading={() => setLoading(true)}
      />



      {/* Expanded Card Overlay */}
      <EventDetailModal
        visible={!!expandedCard}
        event={expandedCard}
        onClose={handleBackPress}
        userLocation={userLocation}
        cardPosition={cardPosition}
      />

      {/* Saved Activities Overlay (fully integrated) */}
      <SavedActivities
        visible={isSavedLikesVisible}
        onClose={handleCloseSavedActivities}
        userLocation={userLocation}
      />

      {/* Add the expanded saved activity overlay */}
      {expandedSavedActivity && (
        <Animated.View 
          style={[
            styles.expandedOverlay,
            { 
              opacity: savedActivityFadeAnim,
              transform: [{ scale: savedActivityScaleAnim }],
              zIndex: 9999,
            }
          ]}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              Animated.parallel([
                Animated.timing(savedActivityFadeAnim, {
                  toValue: 0,
                  duration: 200,
                  useNativeDriver: true,
                }),
                Animated.spring(savedActivityScaleAnim, {
                  toValue: 0.8,
                  friction: 5,
                  tension: 50,
                  useNativeDriver: true,
                }),
                Animated.timing(savedActivityOpacityAnim, {
                  toValue: 0,
                  duration: 200,
                  useNativeDriver: true,
                })
              ]).start(() => setExpandedSavedActivity(null));
            }}
          >
            <LinearGradient
              colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              locations={[0, 0.3, 0.7, 1]}
              style={styles.backButtonGradient}
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </LinearGradient>
          </TouchableOpacity>
          <Animated.View 
            style={[
              styles.expandedCard,
              { 
                backgroundColor: Colors[colorScheme ?? 'light'].background,
                opacity: savedActivityOpacityAnim,
                transform: [{ scale: savedActivityScaleAnim }],
              }
            ]}
          >
            <ScrollView 
              style={styles.expandedContent}
              showsVerticalScrollIndicator={false}
            >
              {expandedSavedActivity.image ? (
                <Image 
                  source={typeof expandedSavedActivity.image === 'string' ? { uri: expandedSavedActivity.image } : expandedSavedActivity.image} 
                  style={styles.imageExpanded}
                />
              ) : (
                <View style={[styles.imageExpanded, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}> 
                  <Ionicons name="image-outline" size={40} color="#666" />
                </View>
              )}
              <View style={styles.expandedHeader}>
                <Text style={[styles.expandedTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                  {expandedSavedActivity.name}
                </Text>
                <Text style={[styles.organizationText, { color: Colors[colorScheme ?? 'light'].text }]}>
                  {expandedSavedActivity.organization}
                </Text>
              </View>
              <View style={styles.infoSection}>
                {expandedSavedActivity.occurrence === 'Weekly' && Array.isArray(expandedSavedActivity.days_of_the_week) && expandedSavedActivity.days_of_the_week.length > 0 ? (
                  <View style={styles.infoRow}>
                    <LinearGradient
                      colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      locations={[0, 0.3, 0.7, 1]}
                      style={styles.infoIconContainer}
                    >
                      <Ionicons name="calendar-outline" size={20} color="white" />
                    </LinearGradient>
                    <View style={styles.infoTextContainer}>
                      <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Days of the Week</Text>
                      <View style={styles.dayButtonContainer}>
                        {DAYS_OF_WEEK.map((day) => (
                          <View
                            key={day}
                            style={[
                              styles.dayCircleButton,
                              expandedSavedActivity.days_of_the_week?.includes(day) && styles.dayCircleButtonSelected
                            ]}
                          >
                            <Text
                              style={[
                                styles.dayCircleButtonText,
                                { color: expandedSavedActivity.days_of_the_week?.includes(day) ? '#F45B5B' : 'white' }
                              ]}
                            >
                              {day.slice(0, 1)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                ) : (
                  <>
                    <View style={styles.infoRow}>
                      <LinearGradient
                        colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        locations={[0, 0.3, 0.7, 1]}
                        style={styles.infoIconContainer}
                      >
                        <Ionicons name="calendar-outline" size={20} color="white" />
                      </LinearGradient>
                      <View style={styles.infoTextContainer}>
                        <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Date</Text>
                        <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                          {new Date(expandedSavedActivity.start_date).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.infoRow}>
                      <LinearGradient
                        colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        locations={[0, 0.3, 0.7, 1]}
                        style={styles.infoIconContainer}
                      >
                        <Ionicons name="time-outline" size={20} color="white" />
                      </LinearGradient>
                      <View style={styles.infoTextContainer}>
                        <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Hours</Text>
                        <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                          {formatTimesForDisplay(expandedSavedActivity.times)}
                        </Text>
                      </View>
                    </View>
                  </>
                )}

                <View style={styles.infoRow}>
                  <LinearGradient
                    colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    locations={[0, 0.3, 0.7, 1]}
                    style={styles.infoIconContainer}
                  >
                    <Ionicons name="location-outline" size={20} color="white" />
                  </LinearGradient>
                  <View style={styles.infoTextContainer}>
                    <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Location</Text>
                    <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                      {expandedSavedActivity.location}
                    </Text>
                  </View>
                </View>
                {typeof expandedSavedActivity.distance === 'number' && (
                  <View style={styles.infoRow}>
                    <LinearGradient
                      colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      locations={[0, 0.3, 0.7, 1]}
                      style={styles.infoIconContainer}
                    >
                      <Ionicons name="walk-outline" size={20} color="white" />
                    </LinearGradient>
                    <View style={styles.infoTextContainer}>
                      <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Distance</Text>
                      <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                        {expandedSavedActivity.distance.toFixed(2)} km away
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.infoRow}>
                  <LinearGradient
                    colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    locations={[0, 0.3, 0.7, 1]}
                    style={styles.infoIconContainer}
                  >
                    <Ionicons name="cash-outline" size={20} color="white" />
                  </LinearGradient>
                  <View style={styles.infoTextContainer}>
                    <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Cost</Text>
                    <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                      ${expandedSavedActivity.cost}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <LinearGradient
                    colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    locations={[0, 0.3, 0.7, 1]}
                    style={styles.infoIconContainer}
                  >
                    <Ionicons name="people-outline" size={20} color="white" />
                  </LinearGradient>
                  <View style={styles.infoTextContainer}>
                    <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Age Restriction</Text>
                    <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                      {expandedSavedActivity.age_restriction ? `${expandedSavedActivity.age_restriction}+` : 'None'}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <LinearGradient
                    colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    locations={[0, 0.3, 0.7, 1]}
                    style={styles.infoIconContainer}
                  >
                    <Ionicons name="calendar-number-outline" size={20} color="white" />
                  </LinearGradient>
                  <View style={styles.infoTextContainer}>
                    <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Reservation</Text>
                    <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                      {expandedSavedActivity.reservation === 'yes' ? 'Required' : 'Not Required'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.descriptionSection}>
                <Text style={[styles.descriptionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                  About this event
                </Text>
                <Text style={[styles.descriptionText, { color: Colors[colorScheme ?? 'light'].text }]}>
                  {expandedSavedActivity.description}
                </Text>
              </View>

              {/* Google Map */}
              <View style={styles.mapContainer}>
                {userLocation && expandedSavedActivity.latitude && expandedSavedActivity.longitude ? (
                  <MapView
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    initialRegion={{
                      latitude: (userLocation.latitude + expandedSavedActivity.latitude) / 2,
                      longitude: (userLocation.longitude + expandedSavedActivity.longitude) / 2,
                      latitudeDelta: Math.abs(userLocation.latitude - expandedSavedActivity.latitude) * 1.5 + 0.01,
                      longitudeDelta: Math.abs(userLocation.longitude - expandedSavedActivity.longitude) * 1.5 + 0.01,
                    }}
                  >
                    <Marker 
                      coordinate={userLocation}
                      title="Your Location"
                    >
                      <View style={styles.userMarkerContainer}>
                        <View style={styles.userMarker}>
                          <Ionicons name="person" size={16} color="white" />
                        </View>
                      </View>
                    </Marker>
                    <Marker 
                      coordinate={{
                        latitude: expandedSavedActivity.latitude,
                        longitude: expandedSavedActivity.longitude
                      }}
                      title={expandedSavedActivity.name}
                    >
                      <View style={styles.eventMarkerContainer}>
                        <View style={styles.eventMarker}>
                          <Ionicons name="location" size={16} color="white" />
                        </View>
                      </View>
                    </Marker>
                  </MapView>
                ) : (
                  <View style={[styles.map, styles.mapPlaceholder]}>
                    <Text style={{ color: Colors[colorScheme ?? 'light'].text }}>
                      {!userLocation ? 'Enable location services to view map' : 'Location data missing for this event'}
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </Animated.View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  swiperContainer: {
    width: '95%',
    height: height - FOOTER_HEIGHT - TOP_BUTTONS_HEIGHT - ACTION_BUTTONS_HEIGHT - 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: TOP_BUTTONS_HEIGHT - 80,
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: FOOTER_HEIGHT,
    zIndex: 10, // Ensure footer is above swiper
  },
  cardContainer: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
  },
  card: {
    width: width * 0.85,
    height: height * 0.5,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
  },
  modernImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch', // Ensures it fills the card horizontally
    width: '100%',
    minWidth: 0,
    minHeight: 0,
  },
  placeholderGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch', // Ensures it fills the card horizontally
    width: '100%',
    minWidth: 0,
    minHeight: 0,
    paddingHorizontal: 0, // Remove any default padding
  },
  placeholderText: {
    color: '#999',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modernFeaturedBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 2,
  },
  featuredBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modernFeaturedText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  categoryBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
  },
  categoryBadgeContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  cardContent: {
    padding: 20,
    backgroundColor: 'transparent',
  },
  titleSection: {
    marginBottom: 12,
  },
  modernTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
    lineHeight: 26,
  },
  organizationLabel: {
    fontSize: 16,
    opacity: 0.8,
    fontStyle: 'italic',
  },
  infoRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  infoIconBackground: {
    backgroundColor: 'rgba(158, 149, 189, 0.2)',
    padding: 6,
    borderRadius: 12,
    marginRight: 6,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    width: '100%',
  },
  costDistanceGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  costContainer: {
    alignItems: 'center',
  },
  costBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  costText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceText: {
    fontSize: 14,
    marginLeft: 4,
    fontWeight: '500',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 14,
    marginLeft: 4,
    fontWeight: '500',
  },
  cardBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    borderRadius: 24,
    opacity: 0.1,
  },
  tagsContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  eventTypeTag: {
    backgroundColor: 'rgba(158, 149, 189, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(158, 149, 189, 0.3)',
  },
  tagText: {
    color: '#9E95BD',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  // Add back missing styles
  topButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 10,
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  logo: {
    width: 160,
    height: 80,
  },
  logoScaled: {
    width: 220,
    height: 110,
    marginTop: -10,
  },
  topButton: {
    width: 50,
    height: 50,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  gradientButton: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 40,
    marginBottom: 10,
    marginTop: -60,
    zIndex: 10
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  nopeButton: {
    borderColor: 'red',
    borderWidth: 2,
  },
  likeButton: {
    borderColor: 'green',
    borderWidth: 2,
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
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 101,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 20,
    padding: 8,
  },
  backButtonText: {
    fontSize: 28,
    color: '#FF1493',
  },
  expandedActionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 40,
    paddingVertical: 20,
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
  },
  noEventsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  noEventsBackground: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  noEventsIconContainer: {
    marginBottom: 24,
    shadowColor: '#9E95BD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  noEventsIconGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noEventsContent: {
    alignItems: 'center',
    marginBottom: 28,
  },
  noEventsTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  noEventsSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 20,
  },
  noEventsDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 18,
    opacity: 0.7,
  },
  noEventsActions: {
    width: '100%',
    marginBottom: 24,
    gap: 12,
  },
  actionCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  actionCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  actionCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionCardContent: {
    flex: 1,
  },
  actionCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 2,
  },
  actionCardSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
  },
  noEventsBottomSection: {
    width: '100%',
    marginTop: 6,
  },
  suggestionCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  suggestionCardContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    gap: 10,
  },
  suggestionText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  suggestionBold: {
    fontWeight: 'bold',
    color: '#9E95BD',
  },
  adjustFiltersText: {
    fontSize: 18,
    color: '#FF1493',
    marginTop: 20,
  },
  noEventsText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  imageExpanded: {
    marginTop: 20,
    width: '100%',
    height: height * 0.4,
    resizeMode: 'cover',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    minHeight: 48,
  },
  infoText: {
    fontSize: 16,
    marginLeft: 10,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: 20,
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    alignSelf: 'center',
  },
  infoTextContainer: {
    flex: 1,
  },
  organizationText: {
    fontSize: 18,
    opacity: 0.7,
  },
  expandedHeader: {
    marginTop: 20,
    marginBottom: 30,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
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
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  backButtonGradient: {
    padding: 12,
    borderRadius: 20,
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
  },
  expandedContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 100, // Add padding to account for the action buttons
  },
  expandedTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 40,
  },
  infoSection: {
    marginBottom: 30,
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reloadButton: {
    borderColor: '#9E95BD',
    borderWidth: 2,
  },
  dayButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
    marginBottom: 4,
    minHeight: 40,
  },
  dayCircleButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    marginHorizontal: 2,
  },
  dayCircleButtonSelected: {
    backgroundColor: 'white',
    borderColor: '#FF3366',
  },
  dayCircleButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  mapContainer: {
    height: 300,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  userMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMarker: {
    backgroundColor: '#FF1493',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  eventMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventMarker: {
    backgroundColor: '#4CAF50',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  descriptionSection: {
    marginBottom: 30,
  },
  descriptionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 24,
  },
  // Friends styles
  friendsContainer: {
    marginBottom: 8,
    backgroundColor: 'rgba(158, 149, 189, 0.05)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(158, 149, 189, 0.1)',
  },
  friendsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  friendsText: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 6,
    flex: 1,
  },
  friendsAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#9E95BD',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  moreAvatar: {
    backgroundColor: 'rgba(158, 149, 189, 0.8)',
  },
  moreAvatarText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  friendAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
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
    borderRadius: 12,
  },
  // Creator Badge Styles
  creatorBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 10,
    borderRadius: 20,
    overflow: 'hidden',
    maxWidth: 140,
  },
  creatorBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  creatorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
  },
  creatorAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  creatorInfo: {
    flex: 1,
    minWidth: 0,
  },
  creatorLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    marginBottom: 1,
  },
  creatorName: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  // Top Right Profile Picture Styles
  topRightProfileContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  topRightProfileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  placeholderTitle: {
    color: '#B97AFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 2,
    textAlign: 'center',
  },
  colorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    pointerEvents: 'none',
  },
});

