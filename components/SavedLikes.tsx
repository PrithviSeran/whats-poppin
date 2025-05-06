import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Image, TouchableOpacity, Dimensions, Modal, Animated, LayoutRectangle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import MainFooter from './MainFooter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

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

export default function SavedLikes() {
  const [savedEvents, setSavedEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [cardLayout, setCardLayout] = useState<LayoutRectangle | null>(null);
  const [hiddenCardId, setHiddenCardId] = useState<number | null>(null);
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const translateXAnim = React.useRef(new Animated.Value(0)).current;
  const translateYAnim = React.useRef(new Animated.Value(0)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const cardOpacity = React.useRef(new Animated.Value(1)).current;
  const colorScheme = useColorScheme();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  useEffect(() => {
    loadSavedEvents();
  }, []);

  const loadSavedEvents = async () => {
    try {
      const savedEventsJson = await AsyncStorage.getItem('savedEvents');
      if (savedEventsJson) {
        const events = JSON.parse(savedEventsJson);
        setSavedEvents(events);
      }
    } catch (error) {
      console.error('Error loading saved events:', error);
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

  const deleteEvent = async (eventId: number) => {
    try {
      const updatedEvents = savedEvents.filter(event => event.id !== eventId);
      setSavedEvents(updatedEvents);
      await AsyncStorage.setItem('savedEvents', JSON.stringify(updatedEvents));
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const clearAllEvents = async () => {
    try {
      setSavedEvents([]);
      await AsyncStorage.removeItem('savedEvents');
    } catch (error) {
      console.error('Error clearing events:', error);
    }
  };

  if (savedEvents.length === 0) {
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
        onPress={() => navigation.goBack()}
      >
        <Text style={{ fontSize: 28, color: '#FF1493' }}>{'←'}</Text>
      </TouchableOpacity>
        <View style={styles.emptyContainer}>
          <Ionicons name="heart" size={60} color={colorScheme === 'dark' ? '#666' : '#999'} />
          <Text style={[styles.emptyText, { color: Colors[colorScheme ?? 'light'].text }]}>
            No saved events yet
          </Text>
          <Text style={[styles.emptySubtext, { color: Colors[colorScheme ?? 'light'].text }]}>
            Like events to save them here
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
        onPress={() => navigation.goBack()}
      >
        <Text style={{ fontSize: 28, color: '#FF1493' }}>{'←'}</Text>
      </TouchableOpacity>
      <ScrollView style={styles.eventsGrid}>
        <View style={styles.gridContainer}>
          {savedEvents.map((event) => (
            <Animated.View
              key={event.id}
              style={[
                styles.cardContainer,
                {
                  opacity: event.id === hiddenCardId ? cardOpacity : 1,
                }
              ]}
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
                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={() => deleteEvent(event.id)}
                >
                  <Ionicons name="close" size={20} color="#fff" />
                </TouchableOpacity>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.clearAllContainer}>
        <TouchableOpacity 
          style={styles.clearAllButton}
          onPress={clearAllEvents}
        >
          <LinearGradient
            colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            locations={[0, 0.3, 0.7, 1]}
            style={styles.clearAllGradient}
          >
            <Ionicons name="trash" size={24} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

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
              <Image source={selectedEvent.image} style={styles.imageExpanded} />
              <Text style={[styles.expandedTitle, { color: Colors[colorScheme ?? 'light'].text }]}>{selectedEvent.title}</Text>
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={20} color={colorScheme === 'dark' ? '#aaa' : '#666'} />
                <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text }]}>{selectedEvent.date}</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 16,
    marginTop: 10,
    opacity: 0.7,
  },
  eventsGrid: {
    flex: 1,
    paddingTop: 60,
    width: '100%',
    height: '100%',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 15,
    gap: 15,
    justifyContent: 'space-between',
  },
  cardContainer: {
    width: CARD_WIDTH,
    marginBottom: 15,
  },
  card: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  deleteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
    padding: 5,
  },
  clearAllContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    padding: 15,
    paddingBottom: 40,
    zIndex: 10,
  },
  clearAllButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
  },
  clearAllGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
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
  backButtonText: {
    fontSize: 28,
    color: '#FF1493',
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
}); 