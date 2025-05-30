import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, SafeAreaView, ScrollView, Image, TouchableOpacity, Dimensions, Modal, Animated, LayoutRectangle, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import MainFooter from './MainFooter';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import GlobalDataManager from '@/lib/GlobalDataManager';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = (width - 45) / 2; // 2 cards per row with padding

interface Event {
  id: number;
  name: string;
  image: string | null;
  start_date: string;
  location: string;
  description: string;
  isLiked?: boolean;
}

export default function Discover() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [cardLayout, setCardLayout] = useState<LayoutRectangle | null>(null);
  const [hiddenCardId, setHiddenCardId] = useState<number | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [suggestedEvents, setSuggestedEvents] = useState<Event[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const ITEMS_PER_PAGE = 10;
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const translateXAnim = React.useRef(new Animated.Value(0)).current;
  const translateYAnim = React.useRef(new Animated.Value(0)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const cardOpacity = React.useRef(new Animated.Value(1)).current;
  const colorScheme = useColorScheme();

  useEffect(() => {
    let isMounted = true;
    const dataManager = GlobalDataManager.getInstance();

    const initializeData = async () => {
      if (!hasInitialLoad && isMounted) {
        setLoading(true);
        try {
          // Initialize global data if not already initialized
          if (!dataManager.isDataInitialized()) {
            await dataManager.initialize();
          }

          const events = await dataManager.getEvents();
          const savedEvents = await dataManager.getSavedEvents();
          
          if (!isMounted) return;

          const eventsWithLikes = events.map(event => ({
            ...event,
            isLiked: savedEvents.includes(event.name)
          }));

          setAllEvents(eventsWithLikes);
          setEvents(eventsWithLikes);
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

  // Clean up animations when component unmounts
  useEffect(() => {
    return () => {
      scaleAnim.stopAnimation();
      translateXAnim.stopAnimation();
      translateYAnim.stopAnimation();
      fadeAnim.stopAnimation();
      cardOpacity.stopAnimation();
    };
  }, []);

  // Use useFocusEffect to handle tab switching
  useFocusEffect(
    React.useCallback(() => {
      // Only sync liked status when returning to the tab
      const syncLikedStatus = async () => {
        const savedEventsJson = await AsyncStorage.getItem('savedEvents');
        let savedEvents: Event[] = savedEventsJson ? JSON.parse(savedEventsJson) : [];
        const savedEventNames = new Set(savedEvents.map((event: Event) => event.name));
        setEvents(prevEvents =>
          prevEvents.map(event => ({
            ...event,
            isLiked: savedEventNames.has(event.name)
          }))
        );
      };
      syncLikedStatus();
    }, [])
  );

  const loadLikedEvents = async () => {
    try {
      const savedEventsJson = await AsyncStorage.getItem('savedEvents');
      if (savedEventsJson) {
        const savedEvents = JSON.parse(savedEventsJson);
        const savedEventIds = new Set(savedEvents.map((event: Event) => event.id));
        setEvents(prevEvents => 
          prevEvents.map(event => ({
            ...event,
            isLiked: savedEventIds.has(event.id)
          }))
        );
      }
    } catch (error) {
      console.error('Error loading liked events:', error);
    }
  };

  const loadSuggestedEvents = async () => {
    try {
      const suggestedEventsJson = await AsyncStorage.getItem('suggestedEvents');
      if (suggestedEventsJson) {
        const parsedEvents = JSON.parse(suggestedEventsJson) as Event[];
        setSuggestedEvents(parsedEvents);
      }
    } catch (error) {
      console.error('Error loading suggested events:', error);
    }
  };

  const fetchEvents = async (pageNum: number = 1) => {
    if (pageNum === 1) {
      setLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    
    setError(null);
    try {
      const { data, error } = await supabase
        .from('all_events')
        .select('*')
        .range((pageNum - 1) * ITEMS_PER_PAGE, pageNum * ITEMS_PER_PAGE - 1)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((event: any) => ({
        id: event.id,
        name: event.name,
        image: event.image,
        start_date: event.start_date,
        location: event.location,
        description: event.description,
        isLiked: false,
      }));

      if (pageNum === 1) {
        setAllEvents(mapped);
        setEvents(mapped);
      } else {
        // When loading more, append new events
        setAllEvents(prev => [...prev, ...mapped]);
        setEvents(prev => [...prev, ...mapped]);
      }

      setHasMore(mapped.length === ITEMS_PER_PAGE);
      setPage(pageNum);
    } catch (err: any) {
      setError(err.message || 'Failed to load events');
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleScroll = ({ nativeEvent }: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const paddingToBottom = 20;
    
    // Check if we need to load more
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
      handleLoadMore();
    }

    // If we've scrolled all the way up, reset to initial state but keep the ability to load more
    if (contentOffset.y <= 0) {
      setEvents(allEvents.slice(0, ITEMS_PER_PAGE));
      setPage(1);
      // Reset hasMore to true to ensure we can load more events
      setHasMore(true);
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

  const toggleLike = async (event: Event) => {
    try {
      const savedEventsJson = await AsyncStorage.getItem('savedEvents');
      let savedEvents: Event[] = savedEventsJson ? JSON.parse(savedEventsJson) : [];

      if (event.isLiked) {
        // Remove from saved events
        savedEvents = savedEvents.filter(e => e.id !== event.id);
      } else {
        // Add to saved events
        savedEvents.push(event);
        // Update saved_events in Supabase (append event name)
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.email) {
          // Fetch current saved_events from Supabase
          const { data: userRow, error: userError } = await supabase
            .from('all_users')
            .select('saved_events')
            .eq('email', user.email)
            .maybeSingle();
          if (!userError && userRow) {
            let savedEventsArr: string[] = [];
            if (Array.isArray(userRow.saved_events)) {
              savedEventsArr = userRow.saved_events;
            } else if (typeof userRow.saved_events === 'string' && userRow.saved_events.length > 0) {
              savedEventsArr = userRow.saved_events.replace(/[{}"]+/g, '').split(',').map((s: string) => s.trim()).filter(Boolean);
            }
            // Only append if not already present
            if (!savedEventsArr.includes(event.name)) {
              savedEventsArr.push(event.name);
              // Convert to Postgres array string
              const pgArray = '{' + savedEventsArr.map(e => '"' + e.replace(/"/g, '') + '"').join(',') + '}';
              await supabase
                .from('all_users')
                .update({ saved_events: pgArray })
                .eq('email', user.email);
            }
          }
        }
      }

      await AsyncStorage.setItem('savedEvents', JSON.stringify(savedEvents));
      
      // Update the events state
      setEvents(prevEvents => 
        prevEvents.map(e => 
          e.id === event.id ? { ...e, isLiked: !e.isLiked } : e
        )
      );
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const openModal = (event: Event, layout: LayoutRectangle) => {
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

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
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
      >
        <View style={styles.gridContainer}>
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
                onPress={(e) => {
                  e.target.measure((x, y, width, height, pageX, pageY) => {
                    openModal(event, { x: pageX, y: pageY, width, height });
                  });
                }}
              >
                <Image 
                  source={event.image ? { uri: event.image } : require('../assets/images/balloons.png')}
                  style={styles.cardImage}
                />
                <TouchableOpacity 
                  style={styles.likeButton}
                  onPress={() => toggleLike(event)}
                >
                  <Ionicons 
                    name={event.isLiked ? "heart" : "heart-outline"} 
                    size={24} 
                    color={event.isLiked ? "#FF6B6B" : "#fff"} 
                  />
                </TouchableOpacity>
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, { color: Colors[colorScheme ?? 'light'].text }]}>{event.name}</Text>
                  <View style={styles.infoRow}>
                    <Ionicons name="calendar-outline" size={16} color={colorScheme === 'dark' ? '#aaa' : '#666'} />
                    <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text }]}>{event.start_date}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={16} color={colorScheme === 'dark' ? '#aaa' : '#666'} />
                    <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text }]}>{event.location}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
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
          colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
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

      {modalVisible && selectedEvent && (
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
            style={{
              position: 'absolute',
              top: 50,
              left: 20,
              zIndex: 10,
              backgroundColor: 'rgba(0,0,0,0.1)',
              borderRadius: 20,
              padding: 8,
            }}
                onPress={closeModal}
              >
            <Text style={{ fontSize: 28, color: '#FF1493' }}>{'←'}</Text>
              </TouchableOpacity>
          <View style={[styles.expandedCard, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
            <ScrollView style={styles.expandedContent}>
              <Image
                source={selectedEvent.image ? { uri: selectedEvent.image } : require('../assets/images/balloons.png')}
                style={styles.imageExpanded}
              />
              <Text style={[styles.expandedTitle, { color: Colors[colorScheme ?? 'light'].text }]}>{selectedEvent.name}</Text>
              <View style={styles.infoRow}>
                      <Ionicons name="calendar-outline" size={20} color={colorScheme === 'dark' ? '#aaa' : '#666'} />
                <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text }]}>{selectedEvent.start_date}</Text>
                    </View>
              <View style={styles.infoRow}>
                      <Ionicons name="location-outline" size={20} color={colorScheme === 'dark' ? '#aaa' : '#666'} />
                <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text }]}>{selectedEvent.location}</Text>
                    </View>
              <Text style={[styles.description, { color: Colors[colorScheme ?? 'light'].text }]}>{selectedEvent.description}</Text>
            </ScrollView>
                  </View>
        </Animated.View>
      )}

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
}); 