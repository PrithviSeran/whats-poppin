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
  name: string;
  image: string | null;
  start_date: string;
  location: string;
  description: string;
  isLiked?: boolean;
  created_at: string;
  organization: string;
  event_type: string;
  start_time: string;
  latitude?: number;
  longitude?: number;
  distance?: number | null;
}

interface FilterState {
  eventTypes: string[];
  timePreferences: { start: string; end: string };
  locationPreferences: string[];
  travelDistance: number; // Maximum distance in kilometers
}

// List of Toronto neighborhoods/locations
const torontoLocations = [
  "Downtown Yonge",
  "Entertainment District",
  "Distillery District",
  "Kensington Market",
  "Queen Street West",
  "Yorkville",
  "Midtown Yonge",
  "Liberty Village",
  " финансовый район ", // Financial District
  "St. Lawrence Market",
  "Cabbagetown",
  "The Annex",
  "Little Italy",
  "Chinatown",
  "Greektown",
  "Leslieville",
  "Riverside",
  "High Park",
  "Bloor West Village",
  "Rosedale",
  "Forest Hill",
  "North York City Centre",
  "Scarborough City Centre",
  "Etobicoke City Centre"
];

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
  const swipeX = useRef(new Animated.Value(0)).current;
  const swiperRef = useRef<Swiper<EventCard>>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const colorScheme = useColorScheme();
  const navigation = useNavigation<NavigationProp>();
  const [likedEvents, setLikedEvents] = useState<EventCard[]>([]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFetchingActivities, setIsFetchingActivities] = useState(false);
  const [error, setError] = useState(null);
  const [files, setFiles] = useState<FileObject[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [EVENTS, setEVENTS] = useState<EventCard[]>([]);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<RouteCoordinates[]>([]);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const fadeInAnim = useRef(new Animated.Value(0)).current;
  const cardScaleAnim = useRef(new Animated.Value(0.95)).current;
  const cardOpacityAnim = useRef(new Animated.Value(0)).current;

  // Add recalculateDistances function inside component
  const recalculateDistances = (events: EventCard[]): EventCard[] => {
    console.log('Recalculating distances with userLocation:', userLocation);
    return events.map(event => {
      let distance = null;
      if (userLocation && event.latitude != null && event.longitude != null) {
        console.log('Calculating distance for event:', event.name);
        console.log('User location:', userLocation);
        console.log('Event location:', { latitude: event.latitude, longitude: event.longitude });
        distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          event.latitude,
          event.longitude
        );
        console.log('Calculated distance:', distance, 'km');
      } else {
        console.log('Missing location data for event:', event.name);
        console.log('userLocation:', userLocation);
        console.log('event coords:', { latitude: event.latitude, longitude: event.longitude });
      }
      return {
        ...event,
        distance: distance,
      };
    });
  };

  const initializeData = async () => {
    setLoading(true);
    try {
      const dataManager = GlobalDataManager.getInstance();
      if (!dataManager.isDataInitialized()) {
        await dataManager.initialize();
      }

      const [events, savedEvents, images] = await Promise.all([
        dataManager.getEvents(),
        dataManager.getSavedEvents(),
        loadImages()
      ]);

      const eventsWithLikes = events.map(event => ({
        ...event,
        isLiked: savedEvents.includes(event.name)
      })) as EventCard[];

      const eventsWithDistances = recalculateDistances(eventsWithLikes);

      if (images.length > 0) {
        setEVENTS(eventsWithDistances);
        setImageUrls(images);
      }

      await loadSavedFilters();
      await requestLocationPermission();
      setHasInitialLoad(true);
    } catch (error) {
      console.error('Error initializing data:', error);
    } finally {
      if (EVENTS.length > 0 && imageUrls.length > 0) {
        setLoading(false);
        // Start fade-in animation after loading is complete
        Animated.timing(fadeInAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  // Update useFocusEffect to properly handle data reloading
  useFocusEffect(
    React.useCallback(() => {
      let isMounted = true;
      const dataManager = GlobalDataManager.getInstance();

      const reloadData = async () => {
        if (!isMounted) return;
        
        // Reset states
        setLoading(true);
        setEVENTS([]);
        setImageUrls([]);
        setHasInitialLoad(false);
        
        // Reset animation values
        fadeInAnim.setValue(0);
        pulseAnim.setValue(0);
        rotateAnim.setValue(0);

        // Restart loading animations
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

        try {
          // Initialize global data if not already initialized
          if (!dataManager.isDataInitialized()) {
            await dataManager.initialize();
          }

          // Load all data in parallel
          const [events, savedEvents, images] = await Promise.all([
            dataManager.getEvents(),
            dataManager.getSavedEvents(),
            loadImages()
          ]);

          if (!isMounted) return;

          // Mark events as liked if they're in savedEvents
          const eventsWithLikes = events.map(event => ({
            ...event,
            isLiked: savedEvents.includes(event.name)
          })) as EventCard[];

          // Calculate distances for events
          const eventsWithDistances = recalculateDistances(eventsWithLikes);

          // Update states
          setEVENTS(eventsWithDistances);
          setImageUrls(images);
          setHasInitialLoad(true);
          setLoading(false);

          // Start fade-in animation
          Animated.timing(fadeInAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }).start();
        } catch (error) {
          console.error('Error reloading data:', error);
          if (isMounted) {
            setLoading(false);
          }
        }
      };

      reloadData();

      return () => {
        isMounted = false;
        // Cleanup animations
        pulseAnim.stopAnimation();
        rotateAnim.stopAnimation();
        fadeInAnim.stopAnimation();
      };
    }, [])
  );

  useEffect(() => {
    let isMounted = true;
    const dataManager = GlobalDataManager.getInstance();

    // Listen for data updates
    const handleDataUpdate = () => {
      if (isMounted) {
        setHasInitialLoad(false);
        initializeData();
      }
    };

    dataManager.on('dataInitialized', handleDataUpdate);
    initializeData();

    return () => {
      isMounted = false;
      dataManager.removeListener('dataInitialized', handleDataUpdate);
    };
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

  useEffect(() => {
    const initializeData = async () => {
      if (!hasInitialLoad) {
        setLoading(true);
        await loadImages();
        await loadSavedFilters();
        await fetchUserEvents();
        await requestLocationPermission();
        setHasInitialLoad(true);
        setLoading(false);
      }
    };

    initializeData();
  }, []);

  // Add useFocusEffect to handle tab switching
  useFocusEffect(
    React.useCallback(() => {
      // Only recalculate distances when location changes
      if (userLocation && EVENTS.length > 0) {
        const eventsWithDistances = recalculateDistances(EVENTS);
        setEVENTS(eventsWithDistances);
      }
    }, [userLocation])
  );

  const loadImages = async () => {
    try {
      // Get list of files in the bucket
      const { data: files, error: listError } = await supabase.storage
        .from('event-images')
        .list();

      if (listError) {
        console.error('Error listing files:', listError);
        // Optionally set an error state or show a message to the user
        return [];
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
           return urls;
        } else {
           console.warn('No public URLs could be generated for files found in the bucket.');
           return [];
        }

      } else {
        console.log('No files found in the event-images bucket.');
        return [];
      }
    } catch (error) {
      console.error('Error loading images:', error);
       // Optionally set an error state or show a message to the user
       return [];
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
        .select('*, latitude, longitude');

      if (error) {
        throw error
      }

      let eventsWithCalculatedDistance: EventCard[] = [];
      if (eventsData) {
        eventsWithCalculatedDistance = recalculateDistances(eventsData);
      }

      // After fetching eventsData from Supabase, update locations (keeping fetched location for distance calc)
      const eventsWithTorontoLocations = eventsWithCalculatedDistance;

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
      // Only load filters on initial mount
      if (filters.eventTypes.length === 0 && 
          filters.locationPreferences.length === 0 && 
          filters.travelDistance === 0) {
        loadSavedFilters();
      }
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

      // Filter by distance
      if (filtersToApply.travelDistance > 0 && event.distance !== null && event.distance !== undefined) {
        if (event.distance > filtersToApply.travelDistance) {
          return false;
        }
      }

      // Filter by time range
      if (filtersToApply.timePreferences && filtersToApply.timePreferences.start && filtersToApply.timePreferences.end) {
        const [startHour, startMin] = filtersToApply.timePreferences.start.split(':').map(Number);
        const [endHour, endMin] = filtersToApply.timePreferences.end.split(':').map(Number);
        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;
        const [eventHour, eventMin] = event.start_time.split(':').map(Number);
        const eventTime = eventHour * 60 + eventMin;
        
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
    // Reset animation values
    cardScaleAnim.setValue(0.95);
    cardOpacityAnim.setValue(0);
    
    // Start animations
    Animated.parallel([
      Animated.spring(cardScaleAnim, {
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
    ]).start();
  };

  const handleBackPress = () => {
    Animated.parallel([
      Animated.spring(cardScaleAnim, {
        toValue: 0.95,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setExpandedCard(null);
    });
  };

  const handleSwipeRight = async (cardIndex: number) => {
    const likedEvent = EVENTS[cardIndex];
    try {
      // Get current saved events from AsyncStorage
      const savedEvents = await GlobalDataManager.getInstance().getSavedEvents();
      
      // Add the new event if not already saved
      if (!savedEvents.includes(likedEvent.name)) {
        const newSavedEvents = [...savedEvents, likedEvent.name];
        
        // Update AsyncStorage
        await AsyncStorage.setItem('savedEvents', JSON.stringify(newSavedEvents));
        
        // Update Supabase
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.email) {
          const pgArray = '{' + newSavedEvents.map(e => '"' + e.replace(/"/g, '') + '"').join(',') + '}';
          await supabase
            .from('all_users')
            .update({ saved_events: pgArray })
            .eq('email', user.email);
        }

        // Refresh global data
        await GlobalDataManager.getInstance().refreshAllData();
      }

      // Animate the like action
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
      ]).start(() => {
        setTimeout(() => {
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
          ]).start();
        }, 500);
      });
    } catch (error) {
      console.error('Error handling swipe right:', error);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

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
      const travelDistance = userData['travel-distance'] || 0; // Get user's preferred travel distance

      // Update filters with the user's travel distance preference
      setFilters(prev => ({
        ...prev,
        travelDistance: travelDistance
      }));

      // Query all_events based on these preferences
      let query = supabase.from('all_events').select('*, latitude, longitude');

      if (userData.preferences && userData.preferences.length > 0) {
        query = query.in('event_type', userData.preferences);
      }

      const { data: eventsData, error: eventsError } = await query;

      if (eventsError) {
        setLoading(false);
        return;
      }

      let eventsWithCalculatedDistance: EventCard[] = [];
      if (eventsData) {
        eventsWithCalculatedDistance = recalculateDistances(eventsData);
      }

      // Apply filters including distance
      const filteredEvents = eventsWithCalculatedDistance.filter(event => {
        if (travelDistance > 0 && event.distance !== null && event.distance !== undefined) {
          return event.distance <= travelDistance;
        }
        return true;
      });

      setEVENTS(filteredEvents || []);
    } catch (err) {
      console.error('Error fetching events:', err);
      setEVENTS([]);
    } finally {
      setLoading(false);
    }
  };

  // Function to request location permission and get current location using expo-location
  const requestLocationPermission = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('Location permission denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      
      const newUserLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      
      setUserLocation(newUserLocation);

      // Recalculate distances for all events with the new location
      if (EVENTS.length > 0) {
        const eventsWithDistances = recalculateDistances(EVENTS);
        setEVENTS(eventsWithDistances);
      }
    } catch (err) {
      console.error('Error getting user location:', err);
    }
  };


  // Function to fetch route from Google Directions API
  const fetchRoute = async (origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }) => {
    try {
      setIsLoadingRoute(true);
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      
      if (!apiKey) {
        console.error('Google Maps API key is missing');
        return;
      }

      
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&key=${apiKey}&mode=driving`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.routes && data.routes.length > 0) {
        const points = data.routes[0].overview_polyline.points;
        const coords = decodePolyline(points);
        setRouteCoordinates(coords);
      } else {
        console.error('Directions API error:', data.status, data.error_message);
        // Fallback to straight line
        setRouteCoordinates([
          { latitude: origin.latitude, longitude: origin.longitude },
          { latitude: destination.latitude, longitude: destination.longitude }
        ]);
      }
    } catch (error) {
      console.error('Error fetching route:', error);
      // Fallback to straight line
      setRouteCoordinates([
        { latitude: origin.latitude, longitude: origin.longitude },
        { latitude: destination.latitude, longitude: destination.longitude }
      ]);
    } finally {
      setIsLoadingRoute(false);
    }
  };

  // Function to decode Google's polyline format
  const decodePolyline = (encoded: string): RouteCoordinates[] => {
    const poly: RouteCoordinates[] = [];
    let index = 0;
    let len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let shift = 0;
      let result = 0;

      do {
        let b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (result >= 0x20);

      let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        let b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (result >= 0x20);

      let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      poly.push({
        latitude: lat / 1E5,
        longitude: lng / 1E5
      });
    }

    return poly;
  };

  // Update route when expanded card changes
  /*
  useEffect(() => {

    if (expandedCard && userLocation && expandedCard.latitude && expandedCard.longitude) {
      fetchRoute(
        { latitude: userLocation.latitude, longitude: userLocation.longitude },
        { latitude: expandedCard.latitude, longitude: expandedCard.longitude }
      );
    }
  }, [expandedCard, userLocation]);*/



  const handleSwipedAll = async () => {
    try {
      // Reset the card index but keep the events
      setCardIndex(0);
      // Reinitialize data without clearing events
      await initializeData();
    } catch (error) {
      console.error('Error handling swiped all:', error);
    }
  };

  // Add this new useEffect for the fade-in animation
  useEffect(() => {
    if (EVENTS.length > 0 && imageUrls.length > 0 && !loading) {
      // Reset the animation value
      fadeInAnim.setValue(0);
      // Start the fade-in animation
      Animated.timing(fadeInAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [EVENTS.length, imageUrls.length, loading]);

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
            onPress={() => navigation.navigate('saved-likes', { onClose: () => {} })}
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
          onPress={() => navigation.navigate('saved-likes', { onClose: () => {} })}
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

      {loading || EVENTS.length === 0 || imageUrls.length === 0 ? (
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
          <Text style={[styles.loadingText, { color: Colors[colorScheme ?? 'light'].text, marginTop: 20 }]}>
            Loading events...
          </Text>
        </View>
      ) : (
        <Animated.View 
          style={[
            styles.contentContainer,
            {
              opacity: fadeInAnim,
              transform: [{
                translateY: fadeInAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                })
              }]
            }
          ]}
        >
          <View style={styles.swiperContainer}>
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
        onApplyFilters={handleApplyFilters}
        currentFilters={filters}
      />

      {/* Expanded Card Overlay */}
      {expandedCard && (
        <Animated.View 
          style={[
            styles.expandedOverlay,
            { 
              opacity: cardOpacityAnim,
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

                    {routeCoordinates.length > 0 && (
                      <Polyline
                        coordinates={routeCoordinates}
                        strokeColor="#FF1493"
                        strokeWidth={4}
                        lineDashPattern={[1]}
                      />
                    )}
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
    paddingBottom: 100,
  },
  expandedTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 101,
    borderRadius: 20,
    overflow: 'hidden',
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
});