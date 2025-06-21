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
import { supabase } from '@/lib/supabase';
import { FileObject } from '@supabase/storage-js';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import GlobalDataManager from '@/lib/GlobalDataManager';
import SavedActivities from './SavedActivities';
import EventDetailModal from './EventDetailModal';
import { EventCard } from '../lib/GlobalDataManager';

const { width, height } = Dimensions.get('window');
const FOOTER_HEIGHT = 80;
const TOP_BUTTONS_HEIGHT = 60; // Space for top buttons
const ACTION_BUTTONS_HEIGHT = 80; // Space for action buttons
const CARD_WIDTH = (width - 45) / 2; // 2 cards per row with padding

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

// Function to calculate distance between two coordinates using Haversine formula
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radius of Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in kilometers
  return distance;
};

/*
interface RouteCoordinates {
  latitude: number;
  longitude: number;
}*/

export default function SuggestedEvents() {
  const [cardIndex, setCardIndex] = useState(0);
  const [expandedCard, setExpandedCard] = useState<EventCard | null>(null);
  const [cardPosition, setCardPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  // Removed swiperVisible state - swiper now stays visible when modal opens
  const [isSwipeInProgress, setIsSwipeInProgress] = useState(false);

  const swipeX = useRef(new Animated.Value(0)).current;
  const swiperRef = useRef<Swiper<EventCard>>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const contentFadeAnim = useRef(new Animated.Value(0)).current;
  const colorScheme = useColorScheme();
  const [likedEvents, setLikedEvents] = useState<EventCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFetchingActivities, setIsFetchingActivities] = useState(false);
  const [EVENTS, setEVENTS] = useState<EventCard[]>([]);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const cardScaleAnim = useRef(new Animated.Value(0.95)).current;
  const cardOpacityAnim = useRef(new Animated.Value(0)).current;
  const [isSavedLikesVisible, setIsSavedLikesVisible] = useState(false);
  const [savedActivitiesEvents, setSavedActivitiesEvents] = useState<EventCard[]>([]);
  const [savedActivitiesLoading, setSavedActivitiesLoading] = useState(false);
  const savedActivitiesFadeAnim = useRef(new Animated.Value(0)).current;
  const [pressedCardIdx, setPressedCardIdx] = useState<number | null>(null);
  const [expandedSavedActivity, setExpandedSavedActivity] = useState<EventCard | null>(null);
  const savedActivityFadeAnim = useRef(new Animated.Value(0)).current;
  const savedActivityScaleAnim = useRef(new Animated.Value(0.8)).current;
  const savedActivityOpacityAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [isAnimating, setIsAnimating] = useState(false);
  const loadingFadeAnim = useRef(new Animated.Value(0)).current;

  const dataManager = GlobalDataManager.getInstance();

  // Memoized expensive calculations
  const processedEventsRef = useRef<EventCard[]>([]);
  const lastFetchTimeRef = useRef<number>(0);

  // Debounced fetch function
  const debouncedFetchRef = useRef<any>(null);

  const debouncedFetchBackend = useCallback(() => {
    if (debouncedFetchRef.current) {
      clearTimeout(debouncedFetchRef.current);
    }

    debouncedFetchRef.current = setTimeout(() => {
      const now = Date.now();
      if (now - lastFetchTimeRef.current < 1000) {
        console.log('⚡ Fetch skipped - too frequent');
        return;
      }
      lastFetchTimeRef.current = now;
      fetchTokenAndCallBackend();
    }, DEBOUNCE_DELAY);
  }, []);

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

  // Optimized event processing
  const processEvents = useCallback((events: EventCard[]) => {
    return events.map((event) => {
      const urls = getEventImageUrls(event.id);
      return {
        ...event,
        image: urls.imageUrl,
        allImages: urls.allImages
      };
    });
  }, [getEventImageUrls]);

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
      console.error('No user email available');
      return;
    }

    try {
      setLoading(true);
      
      // Use debounced refresh instead of immediate
      await dataManager.refreshAllDataDebounced();
      
      // Get location only if not cached
      let userLat = userLocation?.latitude;
      let userLon = userLocation?.longitude;
      
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
          } else {
            console.log('Location permission not granted, using manual location from profile');
            // Try to use manual location from user profile
            const userProfile = await dataManager.getUserProfile();
            if (userProfile?.location) {
              console.log('Using manual location from profile:', userProfile.location);
              try {
                // Geocode the manual address to get coordinates
                const geocodedLocation = await Location.geocodeAsync(userProfile.location);
                if (geocodedLocation && geocodedLocation.length > 0) {
                  userLat = geocodedLocation[0].latitude;
                  userLon = geocodedLocation[0].longitude;
                  setUserLocation({ latitude: userLat, longitude: userLon });
                  console.log('Successfully geocoded manual address to coordinates:', { userLat, userLon });
                } else {
                  console.log('Could not geocode manual address:', userProfile.location);
                }
              } catch (geocodeError) {
                console.error('Error geocoding manual address:', geocodeError);
              }
            }
          }
        } catch (locationError) {
          console.error('Error getting location in fetchTokenAndCallBackend:', locationError);
          // Continue without location - backend should handle missing coordinates
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
      
      console.log('📊 Optimized data state:', {
        rejectedCount: rejectedEventIds.length,
        savedCount: savedEventIds.length,
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

      // Get current user profile to extract time preferences
      const userProfile = await dataManager.getUserProfile();
      const currentStartTime = userProfile?.['start-time'] || '21:00';
      const currentEndTime = userProfile?.['end-time'] || '03:00';

      const requestBody = {
        email: currentUserEmail,
        latitude: userLat,
        longitude: userLon,
        rejected_events: rejectedEventIds,
        filter_distance: filterByDistance,
        selected_dates: selectedDates,
        use_calendar_filter: isCalendarMode === 'true' && selectedDates.length > 0,
        user_start_time: currentStartTime,
        user_end_time: currentEndTime
      };

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
      const processedEvents = processEvents(eventsData.events);

      
      // Update state efficiently
      setCardIndex(0);
      setEVENTS(processedEvents);
      processedEventsRef.current = processedEvents;
      
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
      setIsFetchingActivities(false);
    }
  }, [userLocation, dataManager, processEvents]);

  useEffect(() => {
    //fetchUserEvents(); // Consider if this should be here or after filters are loaded
    fetchTokenAndCallBackend();
    requestLocationPermission(); // Request and get user location
  }, []);

  useEffect(() => {
    if (loading || isFetchingActivities) {
      // Start the fade-in animation for loading screen
      Animated.timing(loadingFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Start the pulse and rotate animations
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
    } else {
      // Fade out the loading screen when not loading
      Animated.timing(loadingFadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, isFetchingActivities]);


  
  const interpolateColor = swipeX.interpolate({
    inputRange: [-width, 0, width],
    outputRange: colorScheme === 'dark' 
      ? ['#2A1A1A', '#1A1A1A', '#1A2A1A']
      : ['#FFE5E5', '#FFFFFF', '#E5FFE5'],
  });

  const handleCardPress = (card: EventCard) => {
    console.log('🎯 Card press attempted:', {
      isSwipeInProgress,
      expandedCard: !!expandedCard,
      cardName: card.name
    });
    
    // Block all interactions if a swipe is in progress
    if (isSwipeInProgress) {
      console.log('❌ Ignoring card press - swipe in progress');
      return;
    }
    
    // Block multiple modal opens
    if (expandedCard) {
      console.log('❌ Ignoring card press - modal already open');
      return;
    }
    
    console.log('✅ Processing card press for:', card.name);
    
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
    console.log('🚀 Starting swipe right for card:', cardIndex);
    
    // Mark swipe as in progress to block interactions
    setIsSwipeInProgress(true);
    
    // Shorter failsafe timer since we're unblocking UI immediately
    const failsafeTimer = setTimeout(() => {
      console.log('⚠️ Failsafe timer triggered - resetting isSwipeInProgress (backup)');
      setIsSwipeInProgress(false);
    }, 1000); // Much shorter since we unblock immediately anyway
    
    const likedEvent = EVENTS[cardIndex];
    
    // Clear swipe in progress IMMEDIATELY to unblock UI
    setIsSwipeInProgress(false);
    clearTimeout(failsafeTimer);
    console.log('✅ Swipe right UI unblocked immediately');
    
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
    
    // Do heavy backend operations in background (non-blocking)
    (async () => {
      try {
        console.log('🔄 Starting background save operation for:', likedEvent.name);
        
        // Save the event (this can take time but won't block UI)
        await dataManager.addEventToSavedEvents(likedEvent.id);
        console.log('✅ Event saved successfully in background');
        
        // Refresh data in background (don't await this - let it happen async)
        GlobalDataManager.getInstance().refreshAllData().then(() => {
          console.log('✅ Global data refreshed in background');
        }).catch((error) => {
          console.error('❌ Background data refresh failed:', error);
        });
        
      } catch (error) {
        console.error('❌ Background save operation failed:', error);
        // Even if save fails, UI remains responsive
      }
    })();
  };

  // Load liked events on component mount
  useEffect(() => {
    const loadLikedEvents = async () => {
      try {
        const savedEventsJson = await AsyncStorage.getItem('savedEvents');
        if (savedEventsJson) {
          const savedEvents = JSON.parse(savedEventsJson);
          setLikedEvents(savedEvents);
        }
      } catch (error) {
        console.error('Error loading liked events:', error);
      }
    };
    loadLikedEvents();
  }, []);

  // Add a watchdog effect to reset isSwipeInProgress if it gets stuck
  useEffect(() => {
    if (isSwipeInProgress) {
      console.log('🔍 isSwipeInProgress is true, starting watchdog timer');
      const watchdogTimer = setTimeout(() => {
        console.log('🚨 Watchdog triggered: isSwipeInProgress has been stuck for 10 seconds, forcing reset');
        setIsSwipeInProgress(false);
      }, 10000); // Force reset after 10 seconds if still stuck

      return () => {
        console.log('🔍 Clearing watchdog timer');
        clearTimeout(watchdogTimer);
      };
    }
  }, [isSwipeInProgress]);

  const handleSwipedAll = async () => {
    // This function will be called when all cards have been swiped
    console.log('All cards have been swiped');
    
    try {
      // First, update all rejected events in Supabase to ensure we have the latest data
      const rejectedEvents = await dataManager.getRejectedEvents();
      const rejectedEventIds = rejectedEvents.map((e: any) => e.id.toString()); // Convert to strings
      console.log('About to update rejected events in Supabase:', rejectedEventIds);
      await dataManager.updateRejectedEventsInSupabase(rejectedEventIds);
      console.log('Rejected events updated in Supabase, now calling backend');
      
      // Set loading states
      setLoading(true);
      setIsFetchingActivities(true);
      
      // Now call backend with updated data
      await fetchTokenAndCallBackend();
      
      setCardIndex(0);
    } catch (error) {
      console.error('Error in handleSwipedAll:', error);
      setLoading(false);
      setIsFetchingActivities(false);
    }
  };


  const fetchSavedActivities = async () => {
    setSavedActivitiesLoading(true);

    try {
      // Get saved event ids from all_users
      const userEvents = await dataManager.getSavedEvents();

      if (!userEvents) {
        setSavedActivitiesEvents([]);
        setSavedActivitiesLoading(false);
        return;
      }

      // Get user location if not already set
      let userLat = userLocation?.latitude;
      let userLon = userLocation?.longitude;
      if (userLat == null || userLon == null) {
        try {
          // Check permissions before getting location
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === 'granted') {
            let location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            userLat = location.coords.latitude;
            userLon = location.coords.longitude;
            setUserLocation({ latitude: userLat, longitude: userLon });
          } else {
            console.log('Location permission not granted for saved activities');
            userLat = undefined;
            userLon = undefined;
          }
        } catch (e) {
          console.error('Error getting location for saved activities:', e);
          // If location can't be fetched, just skip distance
          userLat = undefined;
          userLon = undefined;
        }
      }

      // Attach distance to each event
      const eventsWithDistance = (userEvents as any[]).filter(e => typeof e === 'object' && e !== null).map(event => {
        let distance = null;
        if (
          userLat != null && userLon != null &&
          event.latitude != null && event.longitude != null
        ) {
          distance = calculateDistance(
            userLat,
            userLon,
            event.latitude,
            event.longitude
          );
        }
        return { ...event, distance };
      });

      setSavedActivitiesEvents(eventsWithDistance);
    } catch (err) {
      setSavedActivitiesEvents([]);
    } finally {
      setSavedActivitiesLoading(false);
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
    console.log('🚀 Starting swipe left for card:', cardIndex);
    
    // Mark swipe as in progress to block interactions
    setIsSwipeInProgress(true);
    
    // Failsafe timer to reset isSwipeInProgress if it gets stuck
    const failsafeTimer = setTimeout(() => {
      console.log('⚠️ Failsafe timer triggered - resetting isSwipeInProgress');
      setIsSwipeInProgress(false);
    }, 5000); // Reset after 5 seconds maximum
    
    const rejectedEvent = EVENTS[cardIndex];

    try {
      // Update rejected events in AsyncStorage
      await dataManager.updateRejectedEvents(rejectedEvent);
      
      // Also immediately update Supabase to prevent race conditions
      const rejectedEvents = await dataManager.getRejectedEvents();
      const rejectedEventIds = rejectedEvents.map((e: any) => e.id.toString());
      await dataManager.updateRejectedEventsInSupabase(rejectedEventIds);
      
      console.log('Rejected event saved to both AsyncStorage and Supabase:', rejectedEvent.id);
      
      // Clear the failsafe timer since we completed successfully
      clearTimeout(failsafeTimer);
    } catch (error) {
      console.error('❌ Error saving rejected event:', error);
      // Clear the failsafe timer
      clearTimeout(failsafeTimer);
    }

    // Clear swipe in progress immediately after backend operations complete
    setIsSwipeInProgress(false);
    console.log('✅ Swipe left completed, isSwipeInProgress reset');
    
    // Reset any expanded card state to prevent interference
    setExpandedCard(null);
    setCardPosition(null);

    setCardIndex((i) => i + 1);
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
            colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            locations={[0, 0.3, 0.7, 1]}
            style={styles.gradientButton}
          >
            <Ionicons name="heart" size={24} color="white" />
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.topButton}
          onPress={() => setIsFilterVisible(true)}
        >
          <LinearGradient
            colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            locations={[0, 0.3, 0.7, 1]}
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
                borderColor: '#FF1493',
              },
            ]}
          >
            <View style={styles.innerCircle} />
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
            colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            locations={[0, 0.3, 0.7, 1]}
            style={styles.gradientButton}
          >
            <Ionicons name="heart" size={24} color="white" />
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.topButton}
          onPress={() => setIsFilterVisible(true)}
        >
          <LinearGradient
            colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            locations={[0, 0.3, 0.7, 1]}
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
                borderColor: '#FF1493',
              },
            ]}
          >
            <View style={styles.innerCircle} />
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
          {EVENTS.length > 0 ? (
            <>
              <View style={styles.swiperContainer}>
                <Swiper
                  ref={swiperRef}
                  cards={EVENTS}
                  cardIndex={cardIndex}
                  renderCard={(card: EventCard, index: number) => {
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
                        onPressIn={() => console.log('👆 TouchableOpacity onPressIn for:', card.name)}
                        onPressOut={() => console.log('👆 TouchableOpacity onPressOut for:', card.name)}
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
                            style={[styles.card]}
                          >
                            {/* Image Container with Overlay */}
                            <View style={styles.imageContainer}>
                              {eventImageUrl ? (
                                <Image 
                                  source={{ uri: eventImageUrl }}
                                  style={styles.modernImage} 
                                  onError={(e) => {
                                    console.log('Image failed to load, trying next image for event:', card.id);
                                    // Try to find a working image systematically
                                    if (card.allImages && card.allImages.length > 0) {
                                      // Get current failed image and find its index
                                      const currentImageUrl = eventImageUrl;
                                      let currentIndex = -1;
                                      
                                      // Find current index, handling the case where it might not be found
                                      if (currentImageUrl) {
                                        currentIndex = card.allImages.findIndex(url => url === currentImageUrl);
                                      }
                                      
                                      // Determine next image to try
                                      const startIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
                                      let foundWorkingImage = false;
                                      
                                      // Try up to 3 different images
                                      for (let i = 0; i < Math.min(3, card.allImages.length); i++) {
                                        const tryIndex = (startIndex + i) % card.allImages.length;
                                        const tryImageUrl = card.allImages[tryIndex];
                                        
                                        // Skip if this is the same image that just failed
                                        if (tryImageUrl !== currentImageUrl) {
                                          console.log(`Trying image ${tryIndex} for event ${card.id}`);
                                          setEVENTS(prevEvents => 
                                            prevEvents.map(event => 
                                              event.id === card.id ? { ...event, image: tryImageUrl } : event
                                            )
                                          );
                                          foundWorkingImage = true;
                                          break;
                                        }
                                      }
                                      
                                      if (!foundWorkingImage) {
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
                                <View style={[styles.modernImage, styles.imagePlaceholder]}>
                                  <LinearGradient
                                    colors={['#E8E8E8', '#F5F5F5', '#E8E8E8']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.placeholderGradient}
                                  >
                                    <Ionicons name="image-outline" size={48} color="#999" />
                                    <Text style={styles.placeholderText}>No Image Available</Text>
                                  </LinearGradient>
                                </View>
                              )}
                              
                              {/* Image Overlay for Better Text Readability */}
                              <LinearGradient
                                colors={['transparent', 'transparent', 'rgba(0,0,0,0.3)']}
                                style={styles.imageOverlay}
                              />
                              
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
                              

                            </View>

                            {/* Content Section */}
                            <View style={styles.cardContent}>
                              {/* Title and Organization */}
                              <View style={styles.titleSection}>
                                <Text style={[styles.modernTitle, { color: colorScheme === 'dark' ? '#FFFFFF' : '#1A1A1A' }]} numberOfLines={2}>
                                  {card.name}
                                </Text>
                                {card.organization && (
                                  <Text style={[styles.organizationLabel, { color: colorScheme === 'dark' ? '#B0B0B0' : '#666666' }]} numberOfLines={1}>
                                    by {card.organization}
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
                  onSwipedLeft={(cardIndex) => handleSwipedLeft(cardIndex)}
                  onSwipedRight={(cardIndex) => handleSwipeRight(cardIndex)}
                    onSwipedAll={handleSwipedAll}
                  onSwiping={(x) => swipeX.setValue(x)}
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
                  onPress={() => {
                    setLoading(true);
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
              <Text style={[styles.noEventsText, { color: Colors[colorScheme ?? 'light'].text }]}>
                No Events Found
              </Text>
              <TouchableOpacity onPress={() => setIsFilterVisible(true)}>
            <Text style={[styles.adjustFiltersText, { color: '#9E95BD' }]}>
                  Try adjusting your filters
                </Text>
              </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.reloadButton, { marginTop: 40 }]}
            onPress={() => {
              setLoading(true);
              fetchTokenAndCallBackend();
            }}
          >
            <Ionicons name="reload" size={32} color="#9E95BD" />
          </TouchableOpacity>
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
        fetchTokenAndCallBackend={fetchTokenAndCallBackend}
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
  },
  placeholderGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 10,
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    zIndex: 10,
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
  },
  noEventsText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  adjustFiltersText: {
    fontSize: 18,
    color: '#FF1493',
    marginTop: 20,
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
    borderColor: '#FF1493',
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
});