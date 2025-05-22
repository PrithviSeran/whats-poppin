import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, SafeAreaView, Animated, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import Swiper from 'react-native-deck-swiper';
import MainFooter from './MainFooter';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import EventFilterOverlay from './EventFilterOverlay';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { FileObject } from '@supabase/storage-js';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import GlobalDataManager from '@/lib/GlobalDataManager';
import MaskedView from '@react-native-masked-view/masked-view';

const { width, height } = Dimensions.get('window');
const FOOTER_HEIGHT = 80;
const TOP_BUTTONS_HEIGHT = 60; // Space for top buttons
const ACTION_BUTTONS_HEIGHT = 80; // Space for action buttons
const CARD_WIDTH = (width - 45) / 2; // 2 cards per row with padding

type RootStackParamList = {
  'saved-likes': { onClose: () => void } | undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface EventCard {
  id: number;
  created_at: string;
  name: string;
  organization: string;
  event_type: string;
  start_time: string; // 'HH:MM'
  end_time: string;   // 'HH:MM'
  location: string;
  cost: number;
  age_restriction: number;
  reservation: string;
  description: string;
  image: any;
  start_date: string; // 'YYYY-MM-DD'
  end_date: string;   // 'YYYY-MM-DD'
  occurrence: string;
  latitude?: number;
  longitude?: number;
  distance?: number | null;  // Add distance property
}

interface FilterState {
  eventTypes: string[];
  timePreferences: { start: string; end: string };
  locationPreferences: string[];
  travelDistance: number;
}

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

interface RouteCoordinates {
  latitude: number;
  longitude: number;
}

export default function SuggestedEvents() {
  const [cardIndex, setCardIndex] = useState(0);
  const [expandedCard, setExpandedCard] = useState<EventCard | null>(null);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    eventTypes: [],
    timePreferences: { start: '21:00', end: '3:00' },
    locationPreferences: [],
    travelDistance: 0,
  });
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const swipeX = useRef(new Animated.Value(0)).current;
  const swiperRef = useRef<Swiper<EventCard>>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const colorScheme = useColorScheme();
  const navigation = useNavigation<NavigationProp>();
  const [likedEvents, setLikedEvents] = useState<EventCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFetchingActivities, setIsFetchingActivities] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [EVENTS, setEVENTS] = useState<EventCard[]>([]);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const cardScaleAnim = useRef(new Animated.Value(0.95)).current;
  const cardOpacityAnim = useRef(new Animated.Value(0)).current;
  const [recommendedEvents, setRecommendedEvents] = useState<string[]>([]);
  const [isSavedLikesVisible, setIsSavedLikesVisible] = useState(false);
  const [savedActivitiesEvents, setSavedActivitiesEvents] = useState<EventCard[]>([]);
  const [savedActivitiesLoading, setSavedActivitiesLoading] = useState(false);
  const savedActivitiesFadeAnim = useRef(new Animated.Value(0)).current;
  const [pressedCardIdx, setPressedCardIdx] = useState<number | null>(null);
  const [expandedSavedActivity, setExpandedSavedActivity] = useState<EventCard | null>(null);
  const savedActivityFadeAnim = useRef(new Animated.Value(0)).current;
  const savedActivityScaleAnim = useRef(new Animated.Value(0.8)).current;
  const savedActivityOpacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fetchTokenAndCallBackend = async (recommendedEvents: string[]) => {
      try {
        console.log('Making request to backend with data:', {
          email: 'jdh@shdid.com',
          top_n: 10,
          recommended_events: recommendedEvents
        });

        const response = await fetch('http://192.168.68.139:5000/recommend', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ 
            email: 'jdh@shdid.com', 
            top_n: 10, 
            recommended_events: recommendedEvents 
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Server responded with error:', {
            status: response.status,
            statusText: response.statusText,
            errorText
          });
          throw new Error(`Server responded with ${response.status}: ${errorText}`);
        }

        const data = await response.json();

        // Fetch the full event details for each recommended event
        const { data: eventsData, error } = await supabase
          .from('all_events')
          .select('*, latitude, longitude')
          .in('name', data.recommended_events);

        if (error) {
          console.error('Error fetching event details:', error);
          return;
        }

        // Create a map of event names to their index in the recommended list
        const recommendedOrder = data.recommended_events.reduce((acc: { [key: string]: number }, name: string, index: number) => {
          acc[name] = index;
          return acc;
        }, {});

        // Add distance calculation and sort by recommended order
        const eventsWithDistance = eventsData
          .map((event: any) => {
            let distance = null;
            if (userLocation && event.latitude != null && event.longitude != null) {
              distance = calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                event.latitude,
                event.longitude
              );
            }
            return {
              ...event,
              distance: distance,
            };
          })
          .sort((a: any, b: any) => {
            // Sort based on the order in recommended_events
            return (recommendedOrder[a.name] ?? Infinity) - (recommendedOrder[b.name] ?? Infinity);
          });

        setEVENTS(eventsWithDistance);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching recommendations:', error);
        setLoading(false);
      }
    };

    loadImages();
    loadSavedFilters();
    fetchUserEvents(); // Consider if this should be here or after filters are loaded
    requestLocationPermission(); // Request and get user location
    
    fetchTokenAndCallBackend(recommendedEvents);
  }, []);

  useEffect(() => {
    if (loading) {
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
    }
  }, [loading]);

  const loadImages = async () => {
    try {
      // Get list of files in the bucket
      const { data: files, error: listError } = await supabase.storage
        .from('event-images')
        .list();

      if (listError) {
        console.error('Error listing files:', listError);
        // Optionally set an error state or show a message to the user
        return;
      }

      if (files && files.length > 0) {
        // Get public URLs for each file
        const urls = files.map(file => {
          const { data: { publicUrl } } = supabase.storage
            .from('event-images')
            .getPublicUrl(file.name);
          return publicUrl;
        }).filter(url => url !== null); // Filter out any null URLs

        if (urls.length > 0) {
           console.log('Successfully loaded image URLs:', urls);
           setImageUrls(urls);
        } else {
           console.warn('No public URLs could be generated for files found in the bucket.');
        }

      } else {
        console.log('No files found in the event-images bucket.');
      }
    } catch (error) {
      console.error('Error loading images:', error);
       // Optionally set an error state or show a message to the user
    }
  };

  // Example of how to use the image URLs in your render
  const renderImage = (imageUrl: string) => {
    return (
      <Image 
        source={{ uri: imageUrl }}
        style={styles.image}
        resizeMode="cover"
      />
    )
  }

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      const { data: eventsData, error } = await supabase
        .from('all_events')
        .select('*, latitude, longitude'); // Select latitude and longitude

      if (error) {
        throw error
      }

      let eventsWithCalculatedDistance: EventCard[] = [];
      if (eventsData) {
        eventsWithCalculatedDistance = eventsData.map((event: any): EventCard => {
          let distance = null;
          if (userLocation && event.latitude != null && event.longitude != null) {
            distance = calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              event.latitude,
              event.longitude
            );
          }
          return {
            ...event,
            distance: distance, // Add calculated distance
          };
        });
      }

      // After fetching eventsData from Supabase, update locations (keeping fetched location for distance calc)
      const eventsWithTorontoLocations = eventsWithCalculatedDistance; // Use events with calculated distance

      let filteredEvents = eventsWithTorontoLocations;

      if (filters.timePreferences && filters.timePreferences.start && filters.timePreferences.end) {
        const toMinutes = (t: string) => {
          const [h, m] = t.split(':');
          return parseInt(h, 10) * 60 + parseInt(m, 10);
        };
        const startMins = toMinutes(filters.timePreferences.start);
        const endMins = toMinutes(filters.timePreferences.end);

        filteredEvents = filteredEvents.filter((event: any) => {
          const eventMins = toMinutes(event.start_time);
          if (endMins < startMins) {
            // Overnight range
            return eventMins >= startMins || eventMins <= endMins;
          } else {
            return eventMins >= startMins && eventMins <= endMins;
          }
        });
      }

      setEVENTS(filteredEvents || []);
    } catch (error) {
      console.error('Error fetching data:', error)

    } finally {
      setLoading(false)
    }
  }
  
  const interpolateColor = swipeX.interpolate({
    inputRange: [-width, 0, width],
    outputRange: colorScheme === 'dark' 
      ? ['#2A1A1A', '#1A1A1A', '#1A2A1A']
      : ['#FFE5E5', '#FFFFFF', '#E5FFE5'],
  });

  // Add focus effect to reload filters when returning to this screen
  useFocusEffect(
    React.useCallback(() => {
      loadSavedFilters();
    }, [])
  );

  const loadSavedFilters = async () => {
    try {
      const savedFiltersJson = await AsyncStorage.getItem('eventFilters');
      if (savedFiltersJson) {
        const savedFilters = JSON.parse(savedFiltersJson);

        setFilters(savedFilters);
        // Apply filters immediately
        applyFilters(savedFilters);
        // Reset card index to show filtered results from the beginning
        setCardIndex(0);
      }
    } catch (error) {
      console.error('Error loading saved filters:', error);
    }
  };

  const applyFilters = (filtersToApply: FilterState) => {
    const filtered = EVENTS.filter(event => {
      // Filter by event type
      if (filtersToApply.eventTypes.length > 0) {
        const matchesEventType = filtersToApply.eventTypes.some(type => 
          event.event_type.toLowerCase().includes(type.toLowerCase())
        );
        if (!matchesEventType) {
          return false;
        }
      }

      // Filter by time range (parse 'HH:MM' to minutes)
      if (filtersToApply.timePreferences && filtersToApply.timePreferences.start && filtersToApply.timePreferences.end) {
        const [startHour, startMin] = filtersToApply.timePreferences.start.split(':').map(Number);
        const [endHour, endMin] = filtersToApply.timePreferences.end.split(':').map(Number);
        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;
        const [eventHour, eventMin] = event.start_time.split(':').map(Number);
        const eventTime = eventHour * 60 + eventMin;
        // Handle overnight time ranges (e.g., 21:00 to 3:00)
        if (endTime < startTime) {
          if (!(eventTime >= startTime || eventTime <= endTime)) {
            return false;
          }
        } else {
          if (!(eventTime >= startTime && eventTime <= endTime)) {
            return false;
          }
        }
      }

      // Filter by location
      if (filtersToApply.locationPreferences.length > 0) {
        const matchesLocationPref = filtersToApply.locationPreferences.some(location => 
          event.location.toLowerCase().includes(location.toLowerCase())
        );
        if (!matchesLocationPref) {
          return false;
        }
      }

      return true;
    });

    setEVENTS(filtered);
  };

  const handleApplyFilters = async (newFilters: FilterState) => {
    try {
      // Save to AsyncStorage first
      await AsyncStorage.setItem('eventFilters', JSON.stringify(newFilters));

      
      // Then update state and apply filters
      setFilters(newFilters);
      applyFilters(newFilters);
      setCardIndex(0); // Reset to first card when filters change
    } catch (error) {
      console.error('Error saving filters:', error);
    }
  };

  const handleCardPress = (card: EventCard) => {
    setExpandedCard(card);
    // Reset the animation values
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.8);
    cardOpacityAnim.setValue(0);
    cardScaleAnim.setValue(0.8);

    // Start the animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(cardScaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();
  };

  const handleBackPress = () => {
    // Animate out
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
      Animated.timing(cardOpacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(cardScaleAnim, {
        toValue: 0.8,
        friction: 5,
        tension: 50,
        useNativeDriver: true,
      })
    ]).start(() => {
      // Only update state after animation completes
      setExpandedCard(null);
    });
  };

  const handleSwipeRight = async (cardIndex: number) => {
    const likedEvent = EVENTS[cardIndex];
    try {
      // Get current saved events (local)
      const savedEventsJson = await AsyncStorage.getItem('savedEvents');

      let savedEvents: EventCard[] = savedEventsJson ? JSON.parse(savedEventsJson) : [];
      const isAlreadySaved = savedEvents.some(event => event.id === likedEvent.id);
      if (!isAlreadySaved) {
        savedEvents.push(likedEvent);
        await AsyncStorage.setItem('savedEvents', JSON.stringify(savedEvents));
        console.log('Event saved successfully');
      } else {
        console.log('Event already saved');
      }
      // Update local state
      const newLikedEvents = [...likedEvents, likedEvent];
      setLikedEvents(newLikedEvents);
      // Update saved_events in Supabase (append event name)
      if (userEmail) {
        // Fetch current saved_events from Supabase
        const { data: userRow, error: userError } = await supabase
          .from('all_users')
          .select('saved_events')
          .eq('email', userEmail)
          .maybeSingle();
        if (!userError && userRow) {
          let savedEventsArr: string[] = [];
          if (Array.isArray(userRow.saved_events)) {
            savedEventsArr = userRow.saved_events;
          } else if (typeof userRow.saved_events === 'string' && userRow.saved_events.length > 0) {
            savedEventsArr = userRow.saved_events.replace(/[{}"]+/g, '').split(',').map((s: string) => s.trim()).filter(Boolean);
          }
          // Only append if not already present
          if (!savedEventsArr.includes(likedEvent.name)) {
            savedEventsArr.push(likedEvent.name);
            // Convert to Postgres array string
            const pgArray = '{' + savedEventsArr.map(e => '"' + e.replace(/"/g, '') + '"').join(',') + '}';
            await supabase
              .from('all_users')
              .update({ saved_events: pgArray })
              .eq('email', userEmail);
          }
        }
      }
      // Refresh global data so SavedLikes and others update
      await GlobalDataManager.getInstance().refreshAllData();
      loadImages();
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
      ]).start(() => {
        setExpandedCard(null);
      });

      console.log('EVENTS', EVENTS[0].name);

      // Update recommendedEvents with the liked event
    } catch (error) {
      console.error('Error saving liked event:', error);
    }
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

  const toggleLike = async (event: EventCard) => {
    try {
      const savedEventsJson = await AsyncStorage.getItem('likedEvents');
      let savedEvents: EventCard[] = savedEventsJson ? JSON.parse(savedEventsJson) : [];
      const isAlreadyLiked = savedEvents.some(e => e.id === event.id);
      if (isAlreadyLiked) {
        savedEvents = savedEvents.filter(e => e.id !== event.id);
      } else {
        savedEvents.push(event);
      }
      await AsyncStorage.setItem('likedEvents', JSON.stringify(savedEvents));
      setLikedEvents(savedEvents);
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const fetchUserEvents = async () => {
    setLoading(true);
    try {
      // 1. Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // 2. Get all relevant columns from all_users
      const { data: userDataRaw, error: userError } = await supabase
        .from('all_users')
        .select('preferences, start-time, end-time, location, travel-distance')
        .eq('email', user.email)
        .maybeSingle();

      if (userError || !userDataRaw) {
        setLoading(false);
        return;
      }

      const userData: any = userDataRaw;

      // Parse preferences (event types)
      let preferences: string[] = [];
      if (Array.isArray(userData.preferences)) {
        preferences = userData.preferences;
      } else if (typeof userData.preferences === 'string') {
        // If stored as a Postgres array string, parse it
        preferences = userData.preferences
          .replace(/[{}"]/g, '')
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);
      }

      // Parse times
      const startTime = userData['start-time']; // e.g. '18:00:00'
      const endTime = userData['end-time'];     // e.g. '23:00:00'
      const location = userData.location;
      const travelDistance = userData['travel-distance'];

      // 3. Query all_events based on these preferences
      let query = supabase.from('all_events').select('*, latitude, longitude'); // Select latitude and longitude

       if (preferences.length > 0) {
         query = query.in('event_type', preferences);
       }
      // You can add more filters here, e.g. for time, travelDistance, etc.

      const { data: eventsData, error: eventsError } = await query;


      if (eventsError) {
        setLoading(false);
        return;
      }

      let eventsWithCalculatedDistance: EventCard[] = [];
      if (eventsData) {
         eventsWithCalculatedDistance = eventsData.map((event: any): EventCard => {
           let distance = null;
           if (userLocation && event.latitude != null && event.longitude != null) {
             distance = calculateDistance(
               userLocation.latitude,
               userLocation.longitude,
               event.latitude,
               event.longitude
             );
           }
           return {
             ...event,
             distance: distance, // Add calculated distance
           };
         });
      }

      // After fetching eventsData from Supabase, update locations (keeping fetched location for distance calc)
      const eventsWithTorontoLocations = eventsWithCalculatedDistance; // Use events with calculated distance

      // After fetching eventsData from Supabase
      let filteredEvents = eventsWithTorontoLocations; // Use events with calculated distance

      if (startTime && endTime) {
        const toMinutes = (t: string) => {
          const [h, m] = t.split(':');
          return parseInt(h, 10) * 60 + parseInt(m, 10);
        };
        const startMins = toMinutes(startTime);
        const endMins = toMinutes(endTime);

        filteredEvents = filteredEvents.filter((event: any) => {
          const eventMins = toMinutes(event.start_time);
          if (endMins < startMins) {
            // Overnight range (e.g., 21:00 to 03:00)
            return eventMins >= startMins || eventMins <= endMins;
          } else {
            // Normal range (e.g., 18:00 to 23:00)
            return eventMins >= startMins && eventMins <= endMins;
          }
        });
      }

      setEVENTS(filteredEvents || []);
    } catch (err) {
      // handle error
      setEVENTS([]);
    } finally {
      setLoading(false);
    }
  };

  // Function to request location permission and get current location using expo-location
  const requestLocationPermission = async () => {
    try {
      // Request foreground location permissions
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('Permission to access location was denied');
        // Optionally show a message to the user explaining why location is needed
        return;
      }

      // Get current location
      let location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      console.log('User Location:', location.coords);

    } catch (err) {
      console.error('Error getting user location:', err);
    }
  };

  const handleSwipedAll = async () => {
    // This function will be called when all cards have been swiped
    console.log('All cards have been swiped');
    setLoading(true);
    setIsFetchingActivities(true); // Set fetching activities state
    
    // Add current events to recommendedEvents array
    const newRecommendedEvents = [...recommendedEvents];
    for (let i = 0; i < EVENTS.length; i++) {
      if (!newRecommendedEvents.includes(EVENTS[i].name)) {
        newRecommendedEvents.push(EVENTS[i].name);
      }
    }
    
    console.log('About to update recommendedEvents with:', newRecommendedEvents);
    setRecommendedEvents(newRecommendedEvents);
  };

  // Add effect to get user email when component mounts
  useEffect(() => {
    const getUserEmail = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          setUserEmail(user.email);
        }
      } catch (error) {
        console.error('Error getting user email:', error);
      }
    };
    getUserEmail();
  }, []);

  // Effect to handle API call when recommendedEvents changes
  useEffect(() => {
    const fetchTokenAndCallBackend = async (eventsToRecommend: string[]) => {
      if (!userEmail) {
        console.error('No user email available');
        return;
      }

      try {
        console.log('Making request to backend with data:', {
          email: userEmail,
          top_n: 10,
          recommended_events: eventsToRecommend
        });

        const response = await fetch('http://192.168.68.139:5000/recommend', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ 
            email: userEmail, 
            top_n: 10, 
            recommended_events: eventsToRecommend 
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Server responded with error:', {
            status: response.status,
            statusText: response.statusText,
            errorText
          });
          throw new Error(`Server responded with ${response.status}: ${errorText}`);
        }

        const data = await response.json();

        // Fetch the full event details for each recommended event
        const { data: eventsData, error } = await supabase
          .from('all_events')
          .select('*, latitude, longitude')
          .in('name', data.recommended_events);

        if (error) {
          console.error('Error fetching event details:', error);
          return;
        }

        // Create a map of event names to their index in the recommended list
        const recommendedOrder = data.recommended_events.reduce((acc: { [key: string]: number }, name: string, index: number) => {
          acc[name] = index;
          return acc;
        }, {});

        // Add distance calculation and sort by recommended order
        const eventsWithDistance = eventsData
          .map((event: any) => {
            let distance = null;
            if (userLocation && event.latitude != null && event.longitude != null) {
              distance = calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                event.latitude,
                event.longitude
              );
            }
            return {
              ...event,
              distance: distance,
            };
          })
          .sort((a: any, b: any) => {
            // Sort based on the order in recommended_events
            return (recommendedOrder[a.name] ?? Infinity) - (recommendedOrder[b.name] ?? Infinity);
          });

        // Reset the Swiper state
        setCardIndex(0);
        setEVENTS([]); // Clear current events
        setTimeout(() => {
          setEVENTS(eventsWithDistance); // Set new events after a brief delay
          setLoading(false);
          setIsFetchingActivities(false); // Reset fetching activities state
        }, 100);
      } catch (error) {
        console.error('Error fetching recommendations:', error);
        setLoading(false);
        setIsFetchingActivities(false); // Reset fetching activities state
      }
    };

    // Only run the API call if recommendedEvents is not empty and we have a user email
    if (recommendedEvents.length > 0 && userEmail) {
      console.log('recommendedEvents updated, making API call with:', recommendedEvents);
      fetchTokenAndCallBackend(recommendedEvents);
    }
  }, [recommendedEvents, userEmail]); // Add userEmail to dependencies

  const fetchSavedActivities = async () => {
    setSavedActivitiesLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) {
        setSavedActivitiesEvents([]);
        setSavedActivitiesLoading(false);
        return;
      }
      // Get saved event names from all_users
      const { data: userRow, error: userError } = await supabase
        .from('all_users')
        .select('saved_events')
        .eq('email', user.email)
        .maybeSingle();
      if (userError || !userRow || !userRow.saved_events) {
        setSavedActivitiesEvents([]);
        setSavedActivitiesLoading(false);
        return;
      }
      let savedEventNames: string[] = [];
      if (Array.isArray(userRow.saved_events)) {
        savedEventNames = userRow.saved_events;
      } else if (typeof userRow.saved_events === 'string' && userRow.saved_events.length > 0) {
        savedEventNames = userRow.saved_events.replace(/[{}"]+/g, '').split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      if (savedEventNames.length === 0) {
        setSavedActivitiesEvents([]);
        setSavedActivitiesLoading(false);
        return;
      }
      // Fetch full event details for these names
      const { data: eventsData, error: eventsError } = await supabase
        .from('all_events')
        .select('*')
        .in('name', savedEventNames);
      if (eventsError || !eventsData) {
        setSavedActivitiesEvents([]);
        setSavedActivitiesLoading(false);
        return;
      }
      setSavedActivitiesEvents(eventsData);
    } catch (err) {
      setSavedActivitiesEvents([]);
    } finally {
      setSavedActivitiesLoading(false);
    }
  };

  // Open overlay and fetch saved activities
  const openSavedActivities = () => {
    setIsSavedLikesVisible(true);
    fetchSavedActivities();
  };

  // Animate overlay fade-in when opened
  useEffect(() => {
    if (isSavedLikesVisible) {
      Animated.timing(savedActivitiesFadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      savedActivitiesFadeAnim.setValue(0);
    }
  }, [isSavedLikesVisible]);

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
      <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}> 
        {/* Top Buttons (Saved Events and Filters) */}
        <View style={styles.topButtons}>
          <TouchableOpacity 
            style={styles.topButton}
            onPress={openSavedActivities}
          >
            <LinearGradient
              colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
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
              colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
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
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      <View style={styles.topButtons}>
        <TouchableOpacity 
          style={styles.topButton}
          onPress={openSavedActivities}
        >
          <LinearGradient
            colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
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
            colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            locations={[0, 0.3, 0.7, 1]}
            style={styles.gradientButton}
          >
            <Ionicons name="filter" size={24} color="white" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {EVENTS.length > 0 && imageUrls.length > 0 ? (
        <>
          <View style={styles.swiperContainer}>
            {loading && isFetchingActivities ? (
              <View style={styles.loadingContainer}>
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
                <Text style={[styles.loadingText, { color: Colors[colorScheme ?? 'light'].text, marginTop: 20 }]}>Fetching activities...</Text>
              </View>
            ) : (
              <Swiper
                ref={swiperRef}
                cards={EVENTS}
                cardIndex={cardIndex}
                renderCard={(card: EventCard, index: number) => {
                  const isTopCard = index === cardIndex;
                  // Use the first image URL for all cards if available
                  const eventImageUrl = imageUrls.length > 0 ? imageUrls[0] : null;

                  return (
                    <TouchableOpacity
                      onPress={() => handleCardPress(card)}
                      activeOpacity={1}
                    >
                      <Animated.View style={[
                        styles.card,
                        isTopCard ? { backgroundColor: interpolateColor } : { backgroundColor: Colors[colorScheme ?? 'light'].background }
                      ]}>
                        {eventImageUrl ? (
                          <Image
                            source={{ uri: eventImageUrl }}
                            style={styles.image}
                            onError={(e) => console.error('Image failed to load:', e.nativeEvent.error)}
                          />
                        ) : (
                          <View style={[styles.image, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
                            <Ionicons name="image-outline" size={40} color="#666" />
                          </View>
                        )}
                        <Text style={[styles.title, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>{card.name}</Text>
                        {/* Distance Display */}
                        {card.distance != null ? (
                          <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text, marginTop: 5 }]}>
                            Distance: {card.distance.toFixed(2)} km
                          </Text>
                        ) : userLocation ? (
                           <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text, marginTop: 5 }]}>
                             Distance: Calculating...
                           </Text>
                        ) : (
                           <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text, marginTop: 5 }]}>
                              Distance: N/A (Location required)
                           </Text>
                        )}
                      </Animated.View>
                    </TouchableOpacity>
                  );
                }}
                onSwipedLeft={() => {
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
                  ]).start(() => {
                    setExpandedCard(null);
                  });
                }}
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
                pointerEvents="box-none"
                useViewOverflow={false}
              />
            )}
          </View>

          <Animated.View style={[styles.actionButtons]}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.nopeButton]}
              onPress={() => swiperRef.current?.swipeLeft()}
            >
              <Ionicons name="close" size={32} color="red" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.likeButton]}
              onPress={() => swiperRef.current?.swipeRight()}
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
            <Text style={styles.adjustFiltersText}>
              Try adjusting your filters
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.footerContainer}>
        <MainFooter activeTab="home" />
      </View>

      <EventFilterOverlay
        visible={isFilterVisible}
        onClose={() => {
          setIsFilterVisible(false);
          fetchUserEvents();
        }}
        onApplyFilters={handleApplyFilters}
        currentFilters={filters}
      />

      {/* Expanded Card Overlay */}
      {expandedCard && (
        <Animated.View 
          style={[
            styles.expandedOverlay,
            { 
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            }
          ]}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackPress}
          >
            <LinearGradient
              colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
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
                opacity: cardOpacityAnim,
                transform: [{ scale: cardScaleAnim }],
              }
            ]}
          >
            <ScrollView 
              style={styles.expandedContent}
              showsVerticalScrollIndicator={false}
            >
              {imageUrls.length > 0 ? (
                <Image 
                  source={{ uri: imageUrls[0] }} 
                  style={styles.imageExpanded}
                />
              ) : (
                <View style={[styles.imageExpanded, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="image-outline" size={40} color="#666" />
                </View>
              )}

              <View style={styles.expandedHeader}>
                <Text style={[styles.expandedTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                  {expandedCard.name}
                </Text>
                <Text style={[styles.organizationText, { color: Colors[colorScheme ?? 'light'].text }]}>
                  {expandedCard.organization}
                </Text>
              </View>

              <View style={styles.infoSection}>
                <View style={styles.infoRow}>
                  <LinearGradient
                    colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    locations={[0, 0.3, 0.7, 1]}
                    style={styles.infoIconContainer}
                  >
                    <Ionicons name="calendar-outline" size={20} color="white" />
                  </LinearGradient>
                  <View style={styles.infoTextContainer}>
                    <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Date & Time</Text>
                    <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                      {new Date(expandedCard.start_date).toLocaleDateString()} at {expandedCard.start_time}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <LinearGradient
                    colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
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
                      {expandedCard.location}
                    </Text>
                  </View>
                </View>

                {expandedCard.distance !== null && expandedCard.distance !== undefined ? (
                  <View style={styles.infoRow}>
                    <LinearGradient
                      colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
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
                        {expandedCard.distance.toFixed(2)} km away
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>

              <View style={styles.descriptionSection}>
                <Text style={[styles.descriptionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                  About this event
                </Text>
                <Text style={[styles.descriptionText, { color: Colors[colorScheme ?? 'light'].text }]}>
                  {expandedCard.description}
                </Text>
              </View>

              {/* Google Map */}
              <View style={styles.mapContainer}>
                {userLocation && expandedCard.latitude && expandedCard.longitude ? (
                  <MapView
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    initialRegion={{
                      latitude: (userLocation.latitude + expandedCard.latitude) / 2,
                      longitude: (userLocation.longitude + expandedCard.longitude) / 2,
                      latitudeDelta: Math.abs(userLocation.latitude - expandedCard.latitude) * 1.5 + 0.01,
                      longitudeDelta: Math.abs(userLocation.longitude - expandedCard.longitude) * 1.5 + 0.01,
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
                        latitude: expandedCard.latitude,
                        longitude: expandedCard.longitude
                      }}
                      title={expandedCard.name}
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

      {isSavedLikesVisible && (
        <Animated.View style={[
          styles.savedLikesOverlay,
          { backgroundColor: Colors[colorScheme ?? 'light'].background, opacity: savedActivitiesFadeAnim, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 }
        ]}>
          <TouchableOpacity
            style={styles.savedLikesCloseButton}
            onPress={() => setIsSavedLikesVisible(false)}
            accessibilityLabel="Close Saved Activities"
            accessibilityRole="button"
          >
            <MaskedView
              style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}
              maskElement={
                <Ionicons name="arrow-back" size={32} color="#fff" style={{ backgroundColor: 'transparent' }} />
              }
            >
              <LinearGradient
                colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                locations={[0, 0.3, 0.7, 1]}
                style={{ flex: 1, width: 40, height: 40 }}
              />
            </MaskedView>
          </TouchableOpacity>
          <Text style={[styles.savedLikesTitle, { color: Colors[colorScheme ?? 'light'].tint, marginTop: 32, marginBottom: 24 }]}>Saved Activities</Text>
          {savedActivitiesLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 }}>
              <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
            </View>
          ) : savedActivitiesEvents.length === 0 ? (
            <View style={styles.savedLikesEmptyContainer}>
              <Ionicons name="heart" size={60} color={colorScheme === 'dark' ? '#666' : '#ccc'} />
              <Text style={[styles.savedLikesEmptyText, { color: Colors[colorScheme ?? 'light'].text }]}>No saved events yet</Text>
              <Text style={[styles.savedLikesEmptySubtext, { color: Colors[colorScheme ?? 'light'].text, opacity: 0.7 }]}>Like events to save them here</Text>
            </View>
          ) : (
            <ScrollView style={styles.savedLikesScroll} contentContainerStyle={{ paddingBottom: 40 }}>
              {savedActivitiesEvents.map((event, idx) => (
                <LinearGradient
                  key={event.id ? `event-${event.id}` : `event-${event.name}-${idx}`}
                  colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  locations={[0, 0.3, 0.7, 1]}
                  style={styles.savedLikesCardGradientBorder}
                >
                  <TouchableOpacity
                    style={[
                      styles.savedLikesCard,
                      { backgroundColor: Colors[colorScheme ?? 'light'].card, opacity: pressedCardIdx === idx ? 0.92 : 1 },
                    ]}
                    activeOpacity={0.85}
                    accessibilityLabel={`View details for ${event.name}`}
                    accessibilityRole="button"
                    onPressIn={() => setPressedCardIdx(idx)}
                    onPressOut={() => setPressedCardIdx(null)}
                    onPress={() => {
                      setExpandedSavedActivity(event);
                      savedActivityFadeAnim.setValue(0);
                      savedActivityScaleAnim.setValue(0.8);
                      savedActivityOpacityAnim.setValue(0);
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
                    }}
                  >
                    <Image
                      source={event.image ? { uri: event.image } : require('../assets/images/balloons.png')}
                      style={styles.savedLikesCardImage}
                      resizeMode="cover"
                      accessibilityLabel={event.name || 'Event image'}
                    />
                    <View style={styles.savedLikesCardTextColumn}>
                      <Text style={[
                        styles.savedLikesCardTitle,
                        { color: Colors[colorScheme ?? 'light'].tint }
                      ]} numberOfLines={1}>
                        {event.name || 'Untitled Event'}
                      </Text>
                      <View style={styles.savedLikesCardInfoContainer}>
                        <View style={styles.savedLikesCardInfoRow}>
                          <Ionicons name="calendar-outline" size={18} color={Colors[colorScheme ?? 'light'].tint} />
                          <Text style={[styles.savedLikesCardInfoText, { color: Colors[colorScheme ?? 'light'].text }]}>
                            {event.start_date}
                          </Text>
                        </View>
                        <View style={styles.savedLikesCardInfoRow}>
                          <Ionicons name="location-outline" size={18} color={Colors[colorScheme ?? 'light'].tint} />
                          <Text style={[styles.savedLikesCardInfoText, { color: Colors[colorScheme ?? 'light'].text }]} numberOfLines={1}>
                            {event.location}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                </LinearGradient>
              ))}
            </ScrollView>
          )}
          {/* Expanded overlay for saved activity, rendered as a child so it appears above the Saved Activities overlay only */}
          {expandedSavedActivity && (
            <Animated.View 
              style={[
                styles.expandedOverlay,
                { 
                  opacity: savedActivityFadeAnim,
                  transform: [{ scale: savedActivityScaleAnim }],
                  zIndex: 9999, // ensure on top of overlay
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
                  colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
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
                    <Text style={[styles.expandedTitle, { color: Colors[colorScheme ?? 'light'].text }]}> {expandedSavedActivity.name} </Text>
                  </View>
                  <View style={styles.infoSection}>
                    <View style={styles.infoRow}>
                      <LinearGradient
                        colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        locations={[0, 0.3, 0.7, 1]}
                        style={styles.infoIconContainer}
                      >
                        <Ionicons name="calendar-outline" size={20} color="white" />
                      </LinearGradient>
                      <View style={styles.infoTextContainer}>
                        <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Date & Time</Text>
                        <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}> {expandedSavedActivity.start_date} at {expandedSavedActivity.start_time} </Text>
                      </View>
                    </View>
                    <View style={styles.infoRow}>
                      <LinearGradient
                        colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        locations={[0, 0.3, 0.7, 1]}
                        style={styles.infoIconContainer}
                      >
                        <Ionicons name="location-outline" size={20} color="white" />
                      </LinearGradient>
                      <View style={styles.infoTextContainer}>
                        <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Location</Text>
                        <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}> {expandedSavedActivity.location} </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.descriptionSection}>
                    <Text style={[styles.descriptionTitle, { color: Colors[colorScheme ?? 'light'].text }]}> About this event </Text>
                    <Text style={[styles.descriptionText, { color: Colors[colorScheme ?? 'light'].text }]}> {expandedSavedActivity.description} </Text>
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
    // Reduced height by calculating remaining space and taking less of it
    height: height - FOOTER_HEIGHT - TOP_BUTTONS_HEIGHT - ACTION_BUTTONS_HEIGHT - 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: TOP_BUTTONS_HEIGHT, // Add margin to account for top buttons
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: FOOTER_HEIGHT,
    zIndex: 10, // Ensure footer is above swiper
  },
  card: {
    width: width * 0.85,
    // Reduce card height to be proportional to the container
    height: height * 0.5, // Reduced from 0.6
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'flex-end',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    paddingBottom: 32,
  },
  imageExpanded: {
    marginTop: 20,
    width: '100%',
    height: height * 0.4,
    resizeMode: 'cover',
  },
  image: {
    width: '100%',
    height: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    resizeMode: 'cover',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 10,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 40,
    marginBottom: 20, // Reduced from 40
    marginTop: -20, // Reduced from -40
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
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
  expandedHeader: {
    marginTop: 20,
    marginBottom: 30,
  },
  infoSection: {
    marginBottom: 30,
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
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
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
    width: '95%',
  },
  organizationText: {
    fontSize: 18,
    opacity: 0.7,
  },
  savedLikesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.98)',
    zIndex: 200,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 60,
  },
  savedLikesCloseButton: {
    position: 'absolute',
    top: 70,
    left: 20,
    zIndex: 201,
    borderRadius: 24,
    overflow: 'hidden',
  },
  savedLikesTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#FF1493',
    letterSpacing: 0.5,
  },
  savedLikesEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  savedLikesEmptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    color: '#888',
  },
  savedLikesEmptySubtext: {
    fontSize: 16,
    marginTop: 10,
    opacity: 0.7,
    color: '#888',
  },
  savedLikesScroll: {
    width: '100%',
    paddingHorizontal: 20,
  },
  savedLikesCardGradientBorder: {
    borderRadius: 22,
    padding: 2.5,
    marginBottom: 18,
  },
  savedLikesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    height: 120,
    overflow: 'hidden',
    padding: 8,
  },
  savedLikesCardImage: {
    width: 110,
    height: 110,
    borderRadius: 16,
    resizeMode: 'cover',
  },
  savedLikesCardTextColumn: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  savedLikesCardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  savedLikesCardInfoContainer: {
    gap: 4,
  },
  savedLikesCardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  savedLikesCardInfoText: {
    fontSize: 16,
    opacity: 0.8,
  },
});