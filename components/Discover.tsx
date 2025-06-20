import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, SafeAreaView, ScrollView, Image, TouchableOpacity, Dimensions, Modal, Animated, LayoutRectangle, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import MainFooter from './MainFooter';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import GlobalDataManager, { EventCard } from '@/lib/GlobalDataManager';
import EventDetailModal from './EventDetailModal';
import * as Location from 'expo-location';
import EventCardComponent from './EventCard';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = (width - 45) / 2; // 2 cards per row with padding
const ITEMS_PER_PAGE = 10;

// We'll show a "No Image Found" placeholder instead of a default image

// Extend EventCard to include isLiked
interface ExtendedEventCard extends EventCard {
  isLiked?: boolean;
}

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

  // Animation refs
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateXAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const colorScheme = useColorScheme();
  const dataManager = GlobalDataManager.getInstance();

  // Add cardRefs at the top of the component
  const cardRefs = useRef<{ [key: number]: any }>({});

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

          // Filter out saved events and map the remaining ones
          const eventsWithLikes = events
            .filter(event => !savedEventIds.has(event.id))
            .map(event => {
              // Randomly select one of the 5 images (0-4) or leave null if no ID
              const randomImageIndex = Math.floor(Math.random() * 5);
              const imageUrl = event.id ? 
                `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/event-images/${event.id}/${randomImageIndex}.jpg` : 
                null;

              return {
                ...event,
                image: imageUrl,
                isLiked: false, // These are unsaved events
                allImages: event.id ? Array.from({ length: 5 }, (_, i) => 
                  `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/event-images/${event.id}/${i}.jpg`
                ) : []
              } as ExtendedEventCard;
            });

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

  // Clean up animations when component unmounts
  useEffect(() => {
    return () => {
      scaleAnim.stopAnimation();
      translateXAnim.stopAnimation();
      translateYAnim.stopAnimation();
      fadeAnim.stopAnimation();
      cardOpacity.stopAnimation();
      pulseAnim.stopAnimation();
      rotateAnim.stopAnimation();
    };
  }, []);

  // Use useFocusEffect to handle tab switching
  useFocusEffect(
    React.useCallback(() => {
      // Only sync liked status when returning to the tab
      const syncLikedStatus = async () => {
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
          console.error('Error syncing liked status:', error);
        }
      };
      syncLikedStatus();
    }, [dataManager])
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
      const newEvents = eventsData
        .filter(event => !loadedEventIds.has(event.id) && !savedEventIds.has(event.id))
        .map(event => {
          // Randomly select one of the 5 images (0-4) or leave null if no ID
          const randomImageIndex = Math.floor(Math.random() * 5);
          const imageUrl = event.id ? 
            `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/event-images/${event.id}/${randomImageIndex}.jpg` : 
            null;

          return {
            ...event,
            image: imageUrl,
            isLiked: false, // These are unsaved events
            occurrence: event.occurrence || 'one-time',
            allImages: event.id ? Array.from({ length: 5 }, (_, i) => 
              `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/event-images/${event.id}/${i}.jpg`
            ) : []
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
    if (text.trim() === '') {
      setEvents(allEvents);
    } else {
      const filtered = allEvents.filter(event =>
        event.name.toLowerCase().includes(text.toLowerCase())
      );
      setEvents(filtered);
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
    setTimeout(() => {
      setSelectedEvent(null);
      setCardLayout(null);
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
    if (loading) {
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
                borderColor: '#FF1493',
              },
            ]}
          >
            <View style={styles.innerCircle} />
          </Animated.View>
          <Text style={[styles.loadingText, { color: Colors[colorScheme ?? 'light'].text }]}>
            Discovering events...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: Colors[colorScheme].text }]}>{error}</Text>
        </View>
      );
    }

    if (searchQuery && events.length === 0) {
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
            tintColor="#9E95BD"
            colors={["#9E95BD", "#F45B5B"]}
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
                {event.image ? (
                  <Image 
                    source={{ uri: event.image }}
                    style={styles.cardImage}
                    onError={(e) => {
                      console.log('Image failed to load, trying next image for event:', event.id);
                      // Try to find a working image systematically
                      if (event.allImages && event.allImages.length > 0) {
                        // Get current failed image and find its index
                        const currentImageUrl = event.image;
                        let currentIndex = -1;
                        
                        // Find current index, handling the case where it might not be found
                        if (currentImageUrl) {
                          currentIndex = event.allImages.findIndex(url => url === currentImageUrl);
                        }
                        
                        // Determine next image to try
                        const startIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
                        let foundWorkingImage = false;
                        
                        // Try up to 3 different images
                        for (let i = 0; i < Math.min(3, event.allImages.length); i++) {
                          const tryIndex = (startIndex + i) % event.allImages.length;
                          const tryImageUrl = event.allImages[tryIndex];
                          
                          // Skip if this is the same image that just failed
                          if (tryImageUrl !== currentImageUrl) {
                                                         console.log(`Trying image ${tryIndex} for event ${event.id}`);
                             setEvents(prevEvents => 
                               prevEvents.map(evt => 
                                 evt.id === event.id ? { ...evt, image: tryImageUrl } : evt
                               )
                             );
                            foundWorkingImage = true;
                            break;
                          }
                        }
                        
                        if (!foundWorkingImage) {
                          console.log('No more images to try for event:', event.id);
                          setEvents(prevEvents => 
                            prevEvents.map(evt => 
                              evt.id === event.id ? { ...evt, image: null } : evt
                            )
                          );
                        }
                      } else {
                        // No allImages array, just show placeholder
                        console.log('No allImages array for event:', event.id);
                        setEvents(prevEvents => 
                          prevEvents.map(evt => 
                            evt.id === event.id ? { ...evt, image: null } : evt
                          )
                        );
                      }
                    }}
                  />
                ) : (
                  <View style={[styles.cardImage, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="image-outline" size={32} color="#666" />
                    <Text style={{ color: '#666', marginTop: 8, fontSize: 12, textAlign: 'center' }}>
                      No Image Found
                    </Text>
                  </View>
                )}
                
                {/* Featured Badge */}
                {event.featured && (
                  <View style={styles.featuredBadge}>
                    <LinearGradient
                      colors={['#FFD700', '#FFA500']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.featuredBadgeContainer}
                    >
                      <Ionicons name="star" size={14} color="white" />
                      <Text style={styles.featuredText}>Featured</Text>
                    </LinearGradient>
                  </View>
                )}
                <TouchableOpacity 
                  style={styles.likeButton}
                  onPress={() => toggleLike(event)}
                >
                  <Ionicons 
                    name={event.isLiked ? "heart" : "heart-outline"} 
                    size={24} 
                    color={event.isLiked ? "#F45B5B" : "#fff"} 
                  />
                </TouchableOpacity>
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, { color: Colors[colorScheme ?? 'light'].text }]}>{event.name}</Text>
                  {/* Only show calendar icon and date if date information is available */}
                  {event.start_date && (
                    <View style={styles.infoRow}>
                      <Ionicons name="calendar-outline" size={16} color={colorScheme === 'dark' ? '#aaa' : '#666'} />
                      <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text }]}>{event.start_date}</Text>
                    </View>
                  )}
                  <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={16} color={colorScheme === 'dark' ? '#aaa' : '#666'} />
                    <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text }]}>{event.location}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </Animated.View>
        {isLoadingMore && (
          <View style={styles.loadingMoreContainer}>
            <ActivityIndicator size="small" color="#FF1493" />
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
              placeholder="Search events..."
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => {
                setSearchQuery('');
                fetchEvents();
              }}>
                <Ionicons name="close-circle" size={20} color="#000" />
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginTop: 20,
  },

}); 