import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, SafeAreaView, ScrollView, Image, TouchableOpacity, Dimensions, Modal, Animated, LayoutRectangle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import MainFooter from './MainFooter';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = (width - 45) / 2; // 2 cards per row with padding

interface Event {
  id: number;
  title: string;
  image: any;
  date: string;
  location: string;
  description: string;
  isLiked?: boolean;
}

// Sample events data
const EVENTS: Event[] = [
  { id: 1, title: 'Summer Festival', image: require('../assets/images/balloons.png'), date: 'June 15, 2024', location: 'Central Park', description: 'Join us for an unforgettable summer festival in the heart of Central Park. Enjoy live music, food trucks, and fun activities for all ages!' },
  { id: 2, title: 'Music Concert', image: require('../assets/images/balloons.png'), date: 'July 20, 2024', location: 'Madison Square Garden', description: 'Experience an amazing night of live music at Madison Square Garden. Featuring top artists and special guests!' },
  { id: 3, title: 'Food Market', image: require('../assets/images/balloons.png'), date: 'August 5, 2024', location: 'Union Square', description: 'Discover delicious food from around the world at the Union Square Food Market. Local vendors and international cuisine!' },
  { id: 4, title: 'Art Exhibition', image: require('../assets/images/balloons.png'), date: 'June 25, 2024', location: 'Metropolitan Museum', description: 'Explore contemporary art at the Metropolitan Museum. Special exhibition featuring modern artists!' },
  { id: 5, title: 'Comedy Show', image: require('../assets/images/balloons.png'), date: 'July 10, 2024', location: 'Carnegie Hall', description: 'Laugh the night away at Carnegie Hall with top comedians from around the world!' },
  { id: 6, title: 'Dance Party', image: require('../assets/images/balloons.png'), date: 'August 15, 2024', location: 'Brooklyn Bridge Park', description: 'Dance under the stars at Brooklyn Bridge Park. Live DJs and amazing views!' },
  { id: 7, title: 'Tech Conference', image: require('../assets/images/balloons.png'), date: 'September 1, 2024', location: 'Javits Center', description: 'Join tech leaders and innovators at the annual tech conference. Workshops and networking!' },
  { id: 8, title: 'Fashion Show', image: require('../assets/images/balloons.png'), date: 'July 30, 2024', location: 'Times Square', description: 'Experience the latest fashion trends at the Times Square Fashion Show!' },
  { id: 9, title: 'Film Festival', image: require('../assets/images/balloons.png'), date: 'August 20, 2024', location: 'Lincoln Center', description: 'Watch premieres of new films at the Lincoln Center Film Festival!' },
];

export default function Discover() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [cardLayout, setCardLayout] = useState<LayoutRectangle | null>(null);
  const [hiddenCardId, setHiddenCardId] = useState<number | null>(null);
  const [events, setEvents] = useState<Event[]>(EVENTS);
  const [suggestedEvents, setSuggestedEvents] = useState<Event[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const translateXAnim = React.useRef(new Animated.Value(0)).current;
  const translateYAnim = React.useRef(new Animated.Value(0)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const cardOpacity = React.useRef(new Animated.Value(1)).current;
  const colorScheme = useColorScheme();

  useEffect(() => {
    loadLikedEvents();
    loadSuggestedEvents();
  }, []);

  useEffect(() => {
    setAllEvents([...events, ...suggestedEvents]);
  }, [events, suggestedEvents]);

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

  const searchEvents = (query: string) => {
    const lowerQuery = query.toLowerCase();
    
    const filteredEvents = allEvents.filter(event => 
      event.title.toLowerCase().includes(lowerQuery) ||
      event.location.toLowerCase().includes(lowerQuery) ||
      event.description.toLowerCase().includes(lowerQuery) ||
      event.date.toLowerCase().includes(lowerQuery)
    );

    setEvents(filteredEvents);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text.trim() === '') {
      setEvents(EVENTS);
    } else {
      searchEvents(text);
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
                setEvents(EVENTS);
              }}>
                <Ionicons name="close-circle" size={20} color="#000" />
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>
      </View>

      <ScrollView style={styles.eventsGrid}>
        <View style={styles.gridContainer}>
          {events.map((event) => (
            <Animated.View
              key={event.id}
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
                  source={event.image} 
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
                  <Text style={[styles.cardTitle, { color: Colors[colorScheme ?? 'light'].text }]}>{event.title}</Text>
                  <View style={styles.infoRow}>
                    <Ionicons name="calendar-outline" size={16} color={colorScheme === 'dark' ? '#aaa' : '#666'} />
                    <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text }]}>{event.date}</Text>
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
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="none"
        onRequestClose={closeModal}
      >
        <Animated.View style={[styles.modalContainer, { opacity: fadeAnim }]}>
          <TouchableOpacity 
            style={styles.modalBackground}
            activeOpacity={1}
            onPress={closeModal}
          >
            <Animated.View 
              style={[
                styles.modalContent, 
                { 
                  backgroundColor: Colors[colorScheme ?? 'light'].background,
                  transform: [
                    { scale: scaleAnim },
                    { translateX: translateXAnim },
                    { translateY: translateYAnim }
                  ]
                }
              ]}
              onStartShouldSetResponder={() => true}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={closeModal}
              >
                <Ionicons name="close" size={24} color={colorScheme === 'dark' ? '#fff' : '#000'} />
              </TouchableOpacity>
              
              {selectedEvent && (
                <>
                  <Image 
                    source={selectedEvent.image} 
                    style={styles.modalImage}
                  />
                  <View style={styles.modalTextContent}>
                    <Text style={[styles.modalTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                      {selectedEvent.title}
                    </Text>
                    <View style={styles.modalInfoRow}>
                      <Ionicons name="calendar-outline" size={20} color={colorScheme === 'dark' ? '#aaa' : '#666'} />
                      <Text style={[styles.modalInfoText, { color: Colors[colorScheme ?? 'light'].text }]}>
                        {selectedEvent.date}
                      </Text>
                    </View>
                    <View style={styles.modalInfoRow}>
                      <Ionicons name="location-outline" size={20} color={colorScheme === 'dark' ? '#aaa' : '#666'} />
                      <Text style={[styles.modalInfoText, { color: Colors[colorScheme ?? 'light'].text }]}>
                        {selectedEvent.location}
                      </Text>
                    </View>
                    <Text style={[styles.modalDescription, { color: Colors[colorScheme ?? 'light'].text }]}>
                      {selectedEvent.description}
                    </Text>
                  </View>
                </>
              )}
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </Modal>

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
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.9,
    borderRadius: 20,
    overflow: 'hidden',
    maxHeight: height * 0.9,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
    padding: 5,
  },
  modalImage: {
    width: '100%',
    height: height * 0.4,
    resizeMode: 'cover',
  },
  modalTextContent: {
    padding: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalInfoText: {
    fontSize: 16,
    marginLeft: 8,
  },
  modalDescription: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: 15,
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
}); 