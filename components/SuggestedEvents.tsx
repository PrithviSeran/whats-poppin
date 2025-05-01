import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, SafeAreaView, Animated, TouchableOpacity, ScrollView } from 'react-native';
import Swiper from 'react-native-deck-swiper';
import MainFooter from './MainFooter';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import EventFilterOverlay from './EventFilterOverlay';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  title: string;
  image: any;
  description: string;
  date: string;
  location: string;
  isLiked?: boolean;
}

const generateRandomEvents = (count: number): EventCard[] => {
  const eventTypes = [
    'Concert', 'Festival', 'Exhibition', 'Workshop', 'Conference', 'Meetup',
    'Party', 'Show', 'Tour', 'Class', 'Seminar', 'Networking', 'Performance',
    'Market', 'Fair', 'Gala', 'Auction', 'Competition', 'Race', 'Game'
  ];
  
  const locations = [
    'Central Park', 'Times Square', 'Madison Square Garden', 'Brooklyn Bridge Park',
    'Metropolitan Museum', 'Carnegie Hall', 'Lincoln Center', 'Javits Center',
    'Union Square', 'Bryant Park', 'Chelsea', 'Soho', 'Greenwich Village',
    'Williamsburg', 'DUMBO', 'Prospect Park', 'Rockefeller Center', 'High Line',
    'Battery Park', 'Hudson Yards'
  ];

  const adjectives = [
    'Amazing', 'Incredible', 'Unforgettable', 'Spectacular', 'Epic', 'Magical',
    'Enchanting', 'Thrilling', 'Exciting', 'Fabulous', 'Wonderful', 'Fantastic',
    'Stunning', 'Breathtaking', 'Mesmerizing', 'Captivating', 'Inspiring',
    'Uplifting', 'Joyful', 'Energizing'
  ];

  const images = [
    require('../assets/images/balloons.png'),
    require('../assets/images/balloons.png'),
    require('../assets/images/balloons.png'),
    require('../assets/images/balloons.png'),
    require('../assets/images/balloons.png'),
  ];

  const events: EventCard[] = [];
  const usedIds = new Set<number>();

  for (let i = 0; i < count; i++) {
    let id;
    do {
      id = Math.floor(Math.random() * 1000) + 1;
    } while (usedIds.has(id));
    usedIds.add(id);

    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const location = locations[Math.floor(Math.random() * locations.length)];
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const image = images[Math.floor(Math.random() * images.length)];
    
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1;
    const year = 2024;
    const date = `${month}/${day}/${year}`;

    events.push({
      id,
      title: `${adjective} ${eventType}`,
      image,
      description: `Join us for an ${adjective.toLowerCase()} ${eventType.toLowerCase()} at ${location}. This is a must-attend event that you won't want to miss!`,
      date,
      location,
      isLiked: false
    });
  }

  return events;
};

const EVENTS: EventCard[] = generateRandomEvents(100);

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
  
  const interpolateColor = swipeX.interpolate({
    inputRange: [-width, 0, width],
    outputRange: colorScheme === 'dark' 
      ? ['#2A1A1A', '#1A1A1A', '#1A2A1A']
      : ['#FFE5E5', '#FFFFFF', '#E5FFE5'],
  });

  // Filter the events based on selected filters
  const filteredEvents = EVENTS.filter(event => {
    if (filters.eventTypes.length > 0 && !filters.eventTypes.includes(event.title)) {
      return false;
    }
    // Add time and location filtering logic here when those fields are added to the EventCard interface
    return true;
  });

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

  const handleApplyFilters = (newFilters: FilterState) => {
    setFilters(newFilters);
    setCardIndex(0); // Reset to first card when filters change
  };

  const handleSwipeRight = async (cardIndex: number) => {
    const likedEvent = EVENTS[cardIndex];
    const newLikedEvents = [...likedEvents, likedEvent];
    setLikedEvents(newLikedEvents);
    
    // Save to AsyncStorage
    try {
      const savedEventsJson = await AsyncStorage.getItem('savedEvents');
      let savedEvents: EventCard[] = savedEventsJson ? JSON.parse(savedEventsJson) : [];
      savedEvents.push(likedEvent);
      await AsyncStorage.setItem('savedEvents', JSON.stringify(savedEvents));
    } catch (error) {
      console.error('Error saving liked events:', error);
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

  if (expandedCard) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
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
        onPress={handleBackPress}
      >
        <Text style={{ fontSize: 28, color: '#FF1493' }}>{'←'}</Text>
      </TouchableOpacity>
        <Animated.View 
          style={[
            styles.expandedCard, 
            { 
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
              backgroundColor: Colors[colorScheme ?? 'light'].background 
            }
          ]}
        >
          <Image source={require("../assets/images/balloons.png")} style={styles.imageExpanded} />

          <ScrollView style={styles.expandedContent}>
            <Text style={[styles.expandedTitle, { color: Colors[colorScheme ?? 'light'].text }]}>{expandedCard.title}</Text>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={20} color={colorScheme === 'dark' ? '#aaa' : '#666'} />
              <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text }]}>{expandedCard.date}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={20} color={colorScheme === 'dark' ? '#aaa' : '#666'} />
              <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text }]}>{expandedCard.location}</Text>
            </View>
            <Text style={[styles.description, { color: Colors[colorScheme ?? 'light'].text }]}>{expandedCard.description}</Text>
          </ScrollView>
        </Animated.View>
        <Animated.View style={[styles.actionButtons, { opacity: fadeAnim }]}>
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
      </SafeAreaView>
    );
  }

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
      

      {/* Reduced height swiper container */}
      <View style={styles.swiperContainer}>
        <Swiper
          ref={swiperRef}
          cards={filteredEvents}
          cardIndex={cardIndex}
          renderCard={(card: EventCard, index: number) => {
            const isTopCard = index === cardIndex;
            return (
              <TouchableOpacity 
                onPress={() => handleCardPress(card)}
                activeOpacity={1}
              >
                <Animated.View style={[
                  styles.card,
                  isTopCard ? { backgroundColor: interpolateColor } : { backgroundColor: Colors[colorScheme ?? 'light'].background }
                ]}>
                  <Image source={card.image} style={styles.image} />
                  <Text style={[styles.title, { color: colorScheme === 'dark' ? '#fff' : '#000' }]}>{card.title}</Text>
                </Animated.View>
              </TouchableOpacity>
            );
          }}
          onSwipedLeft={() => setCardIndex((i) => i + 1)}
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

      <View style={styles.footerContainer}>
        <MainFooter activeTab="home" />
      </View>

      <EventFilterOverlay
        visible={isFilterVisible}
        onClose={() => setIsFilterVisible(false)}
        onApplyFilters={handleApplyFilters}
        currentFilters={filters}
      />
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
    height: height * 0.5,
    width: width * 0.85,
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
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    margin: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  expandedImage: {
    width: '100%',
    height: height * 0.4,
    resizeMode: 'cover',
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  expandedContent: {
    flex: 1,
    paddingHorizontal: 20,
    marginBottom: 20,
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
  backButtonContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 20,
    padding: 8,
  },
  backButtonText: {
    fontSize: 28,
    color: '#FF1493',
  },
});