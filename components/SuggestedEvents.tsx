import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, SafeAreaView, Animated, TouchableOpacity, ScrollView } from 'react-native';
import Swiper from 'react-native-deck-swiper';
import MainFooter from './MainFooter';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import EventFilterOverlay from './EventFilterOverlay';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { FileObject } from '@supabase/storage-js';

const { width, height } = Dimensions.get('window');
const FOOTER_HEIGHT = 80;
const TOP_BUTTONS_HEIGHT = 60; // Space for top buttons
const ACTION_BUTTONS_HEIGHT = 80; // Space for action buttons
const CARD_WIDTH = (width - 45) / 2; // 2 cards per row with padding

type RootStackParamList = {
  'saved-likes': undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface EventCard {
  id: number;
  created_at: string;
  name: string;
  organization: string;
  event_at: string;
  event_type: string;
  time_pref: string;
  location_pref: string;
  cost: number;
  age_restriction: number;
  group: string;
  description: string;
  image: any;
  title?: string; // For backward compatibility
  date?: string; // For backward compatibility
  location?: string; // For backward compatibility
  isLiked?: boolean;
}

const generateRandomEvents = (count: number) => {
  const eventTypes = [
    'Bar Hopping',
    'Live Music',
    'Dancing',
    'Karaoke',
    'Chill Lounge',
    'Rooftop',
    'Comedy Show',
    'Game Night',
    'Food Crawl',
    'Sports Bar',
    'Trivia Night',
    'Outdoor Patio',
    'Late Night Eats',
    'Themed Party',
    'Open Mic',
    'Wine Tasting',
    'Hookah',
    'Board Games',
    'Silent Disco',
    'Other'
  ];
  const organizations = ['LiveNation', 'EventBrite', 'Local Venues', 'Community Center', 'Art Gallery'];
  const timePrefs = ['Morning', 'Afternoon', 'Evening'];
  const locationPrefs = ['Uptown', 'Midtown', 'Downtown'];
  const groups = ['Music', 'Art', 'Technology', 'Sports', 'Food & Drink'];
  
  const events = [];
  
  for (let i = 0; i < count; i++) {
    const event = {
      id: i + 1,
      created_at: new Date().toISOString(),
      name: `${eventTypes[Math.floor(Math.random() * eventTypes.length)]} Event ${i + 1}`,
      organization: organizations[Math.floor(Math.random() * organizations.length)],
      event_at: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(), // Random date within next 30 days
      event_type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
      time_pref: timePrefs[Math.floor(Math.random() * timePrefs.length)],
      location_pref: locationPrefs[Math.floor(Math.random() * locationPrefs.length)],
      cost: Math.floor(Math.random() * 200), // Random price between 0 and 200
      age_restriction: Math.floor(Math.random() * 3) * 7 + 18, // 18, 21, or 25
      group: groups[Math.floor(Math.random() * groups.length)],
      description: `This is a sample description for event ${i + 1}. Join us for an amazing experience!`,
      image: require('../assets/images/balloons.png') // You'll need to handle actual image data differently
    };
    
    events.push(event);
  }
  
  return events;
};

// Generate 10 sample events
const EVENTS = generateRandomEvents(10);

// Save the generated events to AsyncStorage
const saveGeneratedEvents = async () => {
  try {
    await AsyncStorage.setItem('suggestedEvents', JSON.stringify(EVENTS));
  } catch (error) {
    console.error('Error saving suggested events:', error);
  }
};

// Call this function when the component is first loaded
saveGeneratedEvents();

interface FilterState {
  eventTypes: string[];
  timePreferences: string[];
  locationPreferences: string[];
}

export default function SuggestedEvents() {
  const [cardIndex, setCardIndex] = useState(0);
  const [expandedCard, setExpandedCard] = useState<EventCard | null>(null);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    eventTypes: [],
    timePreferences: [],
    locationPreferences: [],
  });
  const swipeX = useRef(new Animated.Value(0)).current;
  const swiperRef = useRef<Swiper<EventCard>>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const colorScheme = useColorScheme();
  const navigation = useNavigation<NavigationProp>();
  const [likedEvents, setLikedEvents] = useState<EventCard[]>([]);
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [files, setFiles] = useState<FileObject[]>([])
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [filteredEvents, setFilteredEvents] = useState<EventCard[]>(EVENTS);

  useEffect(() => {
    loadImages();
    loadSavedFilters();
  }, []);

  const loadImages = async () => {
    try {
      // Get list of files in the bucket
      const { data: files, error: listError } = await supabase.storage
        .from('event-images')
        .list()

      if (listError) {
        console.error('Error listing files:', listError)
        return
      }


      if (files) {
        setFiles(files)
        
        // Get public URLs for each file
        const urls = files.map(file => {
          const { data: { publicUrl } } = supabase.storage
            .from('event-images')
            .getPublicUrl(file.name)
          return publicUrl
        })
        
        setImageUrls(urls)
      }
    } catch (error) {
      console.error('Error loading images:', error)
    }
  }

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
      
      // Replace 'your_table' with your actual table name
      const { data, error } = await supabase
        .from('all_events')
        .select('*')
        // Add filters if needed
        // .eq('column_name', 'value')
        // .order('created_at', { ascending: false })
        // .limit(10)
      
      if (error) {
        throw error
      }

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
        console.log('Loaded saved filters:', savedFilters);
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
      if (filtersToApply.eventTypes.length > 0) {
        const matchesEventType = filtersToApply.eventTypes.some(type => 
          event.event_type.toLowerCase().includes(type.toLowerCase())
        );
        if (!matchesEventType) {
          return false;
        }
      }

      if (filtersToApply.timePreferences.length > 0) {
        const matchesTimePref = filtersToApply.timePreferences.some(time => 
          event.time_pref.toLowerCase().includes(time.toLowerCase())
        );
        if (!matchesTimePref) {
          return false;
        }
      }

      if (filtersToApply.locationPreferences.length > 0) {
        const matchesLocationPref = filtersToApply.locationPreferences.some(location => 
          event.location_pref.toLowerCase().includes(location.toLowerCase())
        );
        if (!matchesLocationPref) {
          return false;
        }
      }

      return true;
    });

    setFilteredEvents(filtered);
  };

  const handleApplyFilters = async (newFilters: FilterState) => {
    try {
      // Save to AsyncStorage first
      await AsyncStorage.setItem('eventFilters', JSON.stringify(newFilters));
      console.log('Saved new filters:', newFilters);
      
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
    // Reset the scale value
    fadeAnim.setValue(0);
    // Start the animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 50,
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
      })
    ]).start(() => {
      // Only update state after animation completes
      setExpandedCard(null);
    });
  };

  const handleSwipeRight = async (cardIndex: number) => {
    const likedEvent = EVENTS[cardIndex];
    
    try {
      // Get current saved events
      const savedEventsJson = await AsyncStorage.getItem('savedEvents');
      let savedEvents: EventCard[] = savedEventsJson ? JSON.parse(savedEventsJson) : [];
      
      // Check if event is already saved
      const isAlreadySaved = savedEvents.some(event => event.id === likedEvent.id);
      
      if (!isAlreadySaved) {
        // Only add if not already saved
        savedEvents.push(likedEvent);
        await AsyncStorage.setItem('savedEvents', JSON.stringify(savedEvents));
        console.log('Event saved successfully');
      } else {
        console.log('Event already saved');
      }
      
      // Update local state
      const newLikedEvents = [...likedEvents, likedEvent];
      setLikedEvents(newLikedEvents);
      
      loadImages();
      
      // Animate out before closing
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

      if (event.isLiked) {
        // Remove from saved events
        savedEvents = savedEvents.filter(e => e.id !== event.id);
      } else {
        // Add to saved events
        savedEvents.push(event);
      }

      await AsyncStorage.setItem('likedEvents', JSON.stringify(savedEvents));
      
      // Update the events state
      setLikedEvents(prevEvents => 
        prevEvents.map(e => 
          e.id === event.id ? { ...e, isLiked: !e.isLiked } : e
        )
      );
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        const userDataJson = await AsyncStorage.getItem('userData');
        if (userDataJson) {
          const userData = JSON.parse(userDataJson);
          if (userData.preferences) {
            setFilters({
              eventTypes: userData.preferences.eventTypes || [],
              timePreferences: userData.preferences.timePreferences || [],
              locationPreferences: userData.preferences.locationPreferences || [],
            });
          }
        }
      } catch (error) {
        console.error('Error loading user preferences:', error);
      }
    };

    loadUserPreferences();
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      <View style={styles.topButtons}>
        <TouchableOpacity 
          style={styles.topButton}
          onPress={() => navigation.navigate('saved-likes')}
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

      {filteredEvents.length > 0 ? (
        <>
          {/* Main Swiper View */}
          <View style={styles.swiperContainer}>
            <Swiper
              ref={swiperRef}
              cards={filteredEvents}
              cardIndex={cardIndex}
              renderCard={(card: EventCard, index: number) => {
                const isTopCard = index === cardIndex;
                const imageUrl = imageUrls[index % imageUrls.length]; // Cycle through available images
                return (
                  <TouchableOpacity 
                    onPress={() => handleCardPress(card)}
                    activeOpacity={1}
                  >
                    <Animated.View style={[
                      styles.card,
                      isTopCard ? { backgroundColor: interpolateColor } : { backgroundColor: Colors[colorScheme ?? 'light'].background }
                    ]}>
                      {imageUrl ? (
                        <Image 
                          source={{ uri: imageUrl }} 
                          style={styles.image} 
                        />
                      ) : (
                        <Image source={card.image} style={styles.image} />
                      )}
                      <Text style={[styles.title, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>{card.name}</Text>
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
        onClose={() => setIsFilterVisible(false)}
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
            <Text style={styles.backButtonText}>{'←'}</Text>
          </TouchableOpacity>
          <View style={[styles.expandedCard, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
            <ScrollView style={styles.expandedContent}>
              <Image source={expandedCard.image} style={styles.imageExpanded} />
              <Text style={[styles.expandedTitle, { color: Colors[colorScheme ?? 'light'].text }]}>{expandedCard.name}</Text>
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={20} color={colorScheme === 'dark' ? '#aaa' : '#666'} />
                <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text }]}>{new Date(expandedCard.event_at).toLocaleDateString()}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={20} color={colorScheme === 'dark' ? '#aaa' : '#666'} />
                <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text }]}>{expandedCard.location_pref}</Text>
              </View>
              <Text style={[styles.description, { color: Colors[colorScheme ?? 'light'].text }]}>{expandedCard.description}</Text>
            </ScrollView>
            <Animated.View style={[styles.expandedActionButtons, { opacity: fadeAnim }]}>
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
          </View>
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
});