import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, SafeAreaView, Animated, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
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
import { EventCard } from '../lib/GlobalDataManager';

const { width, height } = Dimensions.get('window');
const FOOTER_HEIGHT = 80;
const TOP_BUTTONS_HEIGHT = 60; // Space for top buttons
const ACTION_BUTTONS_HEIGHT = 80; // Space for action buttons
const CARD_WIDTH = (width - 45) / 2; // 2 cards per row with padding

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
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

/*
interface RouteCoordinates {
  latitude: number;
  longitude: number;
}*/

export default function SuggestedEvents() {
  const [cardIndex, setCardIndex] = useState(0);
  const [expandedCard, setExpandedCard] = useState<EventCard | null>(null);
  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const swipeX = useRef(new Animated.Value(0)).current;
  const swiperRef = useRef<Swiper<EventCard>>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const contentFadeAnim = useRef(new Animated.Value(0)).current;
  const colorScheme = useColorScheme();
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

  const dataManager = GlobalDataManager.getInstance();

  const fetchTokenAndCallBackend = async () => {
    const currentUserEmail = dataManager.getCurrentUser()?.email ?? null;
    const userLocation = await Location.getCurrentPositionAsync();
    const userLatitude = userLocation.coords.latitude;
    const userLongitude = userLocation.coords.longitude;

    if (!currentUserEmail) {
      console.error('No user email available');
      return;
    }

    try {
      const rejectedEvents = await dataManager.getRejectedEvents();
      const rejectedEventIds = rejectedEvents.map((e: any) => e.id);
      const filterByDistance = await dataManager.getIsFilterByDistance();
      const session = await dataManager.getSession();

      console.log('rejectedEventIds in fetchTokenAndCallBackend', rejectedEventIds);

      /*const params = new URLSearchParams({
          email: currentUserEmail,
          latitude: userLatitude?.toString() || '',
          longitude: userLongitude?.toString() || '',
          filter_distance: filterByDistance.toString(),
          rejected_events: Array.isArray(rejectedEventIds) ? rejectedEventIds.join(',') : rejectedEventIds
      });*/

      const response = await fetch('https://iamtheprince-whats-poppin.hf.space/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          email: currentUserEmail,
          latitude: userLatitude,
          longitude: userLongitude,
          rejected_events: rejectedEventIds,
          filter_distance: filterByDistance
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

      const eventsData = await response.json();

      console.log('eventsData', eventsData);

      // Reset the Swiper state
      setCardIndex(0);
      setEVENTS([]); // Clear current events
      setTimeout(() => {
        setEVENTS(eventsData.events); // Set new events after a brief delay
        setLoading(false);
        setIsFetchingActivities(false); // Reset fetching activities state
      }, 100);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      setLoading(false);
      setIsFetchingActivities(false); // Reset fetching activities state
    }
  };

  useEffect(() => {


    loadImages();
    //loadSavedFilters();
    console.log('here???');
    //fetchUserEvents(); // Consider if this should be here or after filters are loaded
    fetchTokenAndCallBackend();
    requestLocationPermission(); // Request and get user location
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

  
  const interpolateColor = swipeX.interpolate({
    inputRange: [-width, 0, width],
    outputRange: colorScheme === 'dark' 
      ? ['#2A1A1A', '#1A1A1A', '#1A2A1A']
      : ['#FFE5E5', '#FFFFFF', '#E5FFE5'],
  });

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
      await dataManager.addEventToSavedEvents(likedEvent.id);
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
    const rejectedEvents = await dataManager.getRejectedEvents();
    const rejectedEventIds = rejectedEvents.map((e: any) => e.id);
    console.log('All cards have been swiped');
    setLoading(true);
    setIsFetchingActivities(true); // Set fetching activities state
    fetchTokenAndCallBackend();
    await dataManager.updateRejectedEventsInSupabase(rejectedEventIds);
    setCardIndex(0);
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
          let location = await Location.getCurrentPositionAsync({});
          userLat = location.coords.latitude;
          userLon = location.coords.longitude;
          setUserLocation({ latitude: userLat, longitude: userLon });
        } catch (e) {
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

  // Open overlay and fetch saved activities
  const openSavedActivities = () => {
    setIsSavedLikesVisible(true);
    fetchSavedActivities();
  };

  // Update the animation effect
  useEffect(() => {
    if (isSavedLikesVisible) {
      setIsAnimating(true);
      Animated.parallel([
        Animated.timing(savedActivitiesFadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(savedActivitiesFadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        })
      ]).start(() => {
        setIsAnimating(false);
      });
    }
  }, [isSavedLikesVisible]);

  // Update the close button handler
  const handleCloseSavedActivities = () => {
    setIsSavedLikesVisible(false);
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
    const rejectedEvent = EVENTS[cardIndex];

    console.log('rejectedEvent', rejectedEvent);

    await dataManager.updateRejectedEvents(rejectedEvent);

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
  };

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

      {(loading || isFetchingActivities) ? (
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
            {isFetchingActivities ? 'Fetching activities...' : 'Loading events...'}
          </Text>
        </View>
      ) : (
        <Animated.View 
          style={[
            styles.contentContainer,
            { opacity: contentFadeAnim }
          ]}
        >
          {EVENTS.length > 0 && imageUrls.length > 0 ? (
            <>
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
                            {typeof card.distance === 'number' && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                <Ionicons name="walk-outline" size={18} color={Colors[colorScheme ?? 'light'].tint} />
                                <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text, marginLeft: 6 }]}>
                                  {card.distance.toFixed(2)} km
                                </Text>
                              </View>
                            )}
                        </Animated.View>
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
                  pointerEvents="box-none"
                  useViewOverflow={false}
                />
              </View>

              <Animated.View style={styles.actionButtons}>
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
                    <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text, marginBottom: 4 }]}>Days of the Week</Text>
                    {expandedCard.occurrence === 'Weekly' && Array.isArray(expandedCard.days_of_the_week) && expandedCard.days_of_the_week.length > 0 ? (
                      <View style={styles.dayButtonContainer}>
                        {DAYS_OF_WEEK.map((day) => (
                          <View
                            key={day}
                            style={[
                              styles.dayCircleButton,
                              Array.isArray(expandedCard.days_of_the_week) && expandedCard.days_of_the_week.includes(day) && styles.dayCircleButtonSelected
                            ]}
                          >
                            <Text
                              style={[
                                styles.dayCircleButtonText,
                                { color: Array.isArray(expandedCard.days_of_the_week) && expandedCard.days_of_the_week.includes(day) ? '#F45B5B' : 'white' }
                              ]}
                            >
                              {day.slice(0, 1)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text, fontWeight: 'bold', marginTop: 2 }]}> 
                        {new Date(expandedCard.start_date).toLocaleDateString()} {expandedCard.occurrence !== 'Weekly' && `at ${expandedCard.start_time}`}
                      </Text>
                    )}
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

                {typeof expandedCard.distance === 'number' && (
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
                )}

                <View style={styles.infoRow}>
                  <LinearGradient
                    colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
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
                      ${expandedCard.cost}
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
                    <Ionicons name="people-outline" size={20} color="white" />
                  </LinearGradient>
                  <View style={styles.infoTextContainer}>
                    <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Age Restriction</Text>
                    <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                      {expandedCard.age_restriction}+
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
                    <Ionicons name="calendar-number-outline" size={20} color="white" />
                  </LinearGradient>
                  <View style={styles.infoTextContainer}>
                    <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Reservation</Text>
                    <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                      {expandedCard.reservation === 'yes' ? 'Required' : 'Not Required'}
                    </Text>
                  </View>
                </View>
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

      {/* Saved Activities Overlay (fully integrated) */}
      <SavedActivities
        visible={isSavedLikesVisible || isAnimating}
        onClose={handleCloseSavedActivities}
        userLocation={userLocation}
        savedActivitiesEvents={savedActivitiesEvents}
        setSavedActivitiesEvents={setSavedActivitiesEvents}
        savedActivitiesLoading={savedActivitiesLoading}
        pressedCardIdx={pressedCardIdx}
        setPressedCardIdx={setPressedCardIdx}
        setExpandedSavedActivity={setExpandedSavedActivity}
        savedActivityFadeAnim={savedActivityFadeAnim}
        savedActivityScaleAnim={savedActivityScaleAnim}
        savedActivityOpacityAnim={savedActivityOpacityAnim}
        slideAnim={slideAnim}
        savedActivitiesFadeAnim={savedActivitiesFadeAnim}
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
                      colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
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
                              Array.isArray(expandedSavedActivity.days_of_the_week) && expandedSavedActivity.days_of_the_week.includes(day) && styles.dayCircleButtonSelected
                            ]}
                          >
                            <Text
                              style={[
                                styles.dayCircleButtonText,
                                { color: Array.isArray(expandedSavedActivity.days_of_the_week) && expandedSavedActivity.days_of_the_week.includes(day) ? '#F45B5B' : 'white' }
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
                        colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
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
                        colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        locations={[0, 0.3, 0.7, 1]}
                        style={styles.infoIconContainer}
                      >
                        <Ionicons name="time-outline" size={20} color="white" />
                      </LinearGradient>
                      <View style={styles.infoTextContainer}>
                        <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Time</Text>
                        <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                          {expandedSavedActivity.start_time}
                        </Text>
                      </View>
                    </View>
                  </>
                )}

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
                      {expandedSavedActivity.location}
                    </Text>
                  </View>
                </View>
                {typeof expandedSavedActivity.distance === 'number' && (
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
                        {expandedSavedActivity.distance.toFixed(2)} km away
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.infoRow}>
                  <LinearGradient
                    colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
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
                    colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
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
                      {expandedSavedActivity.age_restriction}+
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
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 200,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  savedLikesContent: {
    width: '100%',
    height: height * 0.8, // 80% of screen height
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20, // Changed from paddingTop: 60
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  savedLikesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  savedLikesTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  savedLikesCloseButton: {
    padding: 5,
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
    paddingHorizontal: 10, // Reduced from 20 to give more space for cards
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
    height: 100,
    overflow: 'hidden',
    padding: 8,
    width: '100%',
  },
  savedLikesCardImage: {
    width: 100,
    height: 84,
    borderRadius: 16,
    resizeMode: 'cover',
  },
  savedLikesCardTextColumn: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
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
  savedLikesCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  dayPill: {
    backgroundColor: '#FF1493',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 4,
    marginBottom: 4,
  },
  dayPillText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 13,
  },
  dayButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 4,
    marginBottom: 4,
  },
  dayCircleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  clearSavedButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    borderRadius: 30,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 1000,
  },
  clearSavedButtonGradient: {
    borderRadius: 30,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
});