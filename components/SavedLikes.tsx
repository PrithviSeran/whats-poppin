import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Image, TouchableOpacity, Dimensions, Modal, Animated, LayoutRectangle, ActivityIndicator, ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import MainFooter from './MainFooter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = (width - 45) / 2; // 2 cards per row with padding

interface EventCard {
  id: number;
  name: string;
  description: string;
  image: ImageSourcePropType;
  location: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  event_type: string;
  latitude?: number;
  longitude?: number;
  distance?: number | null;
}

interface FilterState {
  eventTypes: string[];
  timePreferences: { start: string; end: string };
  locationPreferences: string[];
  travelDistance: number;
}

const formatDate = (dateString: string) => {
  // If the date is already in a readable format (e.g., "June 15, 2024"), return it as is
  if (dateString.match(/^[A-Za-z]+\s+\d{1,2},\s+\d{4}$/)) {
    return dateString;
  }

  // Otherwise, try to parse it as an ISO date
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString; // Return original string if date is invalid
    }
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (error) {
    return dateString; // Return original string if parsing fails
  }
};

export default function SavedLikes() {
  const [savedEvents, setSavedEvents] = useState<EventCard[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<EventCard | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [cardLayout, setCardLayout] = useState<LayoutRectangle | null>(null);
  const [hiddenCardId, setHiddenCardId] = useState<number | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    eventTypes: [],
    timePreferences: { start: '21:00', end: '3:00' },
    locationPreferences: [],
    travelDistance: 0,
  });
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const translateXAnim = React.useRef(new Animated.Value(0)).current;
  const translateYAnim = React.useRef(new Animated.Value(0)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const cardOpacity = React.useRef(new Animated.Value(1)).current;
  const colorScheme = useColorScheme();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  // Calculate distance between two coordinates
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
    return R * c;
  };

  // Recalculate distances for all events
  const recalculateDistances = (events: EventCard[]): EventCard[] => {
    return events.map(event => {
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
        distance
      };
    });
  };

  // Get user location
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

      // Recalculate distances for all events
      if (savedEvents.length > 0) {
        const eventsWithDistances = recalculateDistances(savedEvents);
        setSavedEvents(eventsWithDistances);
      }
    } catch (err) {
      console.error('Error getting user location:', err);
    }
  };

  // Load saved events
  const loadSavedEvents = async () => {
    try {
      const savedEventsJson = await AsyncStorage.getItem('savedEvents');
      console.log('Loading saved events from storage:', savedEventsJson);
      if (savedEventsJson) {
        const events = JSON.parse(savedEventsJson);
        console.log('Parsed saved events:', events);
        setSavedEvents(events);
      } else {
        console.log('No saved events found in storage');
        setSavedEvents([]);
      }
    } catch (error) {
      console.error('Error loading saved events:', error);
      setSavedEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSavedEvents();
    requestLocationPermission();
  }, []);

  // Fetch route for selected event
  const fetchRoute = async (origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }) => {
    try {
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
      }
    } catch (error) {
      console.error('Error fetching route:', error);
    }
  };

  // Decode Google's polyline format
  const decodePolyline = (encoded: string): { latitude: number; longitude: number }[] => {
    const poly: { latitude: number; longitude: number }[] = [];
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

  useEffect(() => {
    if (selectedEvent && userLocation && selectedEvent.latitude && selectedEvent.longitude) {
      fetchRoute(
        { latitude: userLocation.latitude, longitude: userLocation.longitude },
        { latitude: selectedEvent.latitude, longitude: selectedEvent.longitude }
      );
    }
  }, [selectedEvent, userLocation]);

  const openModal = (event: EventCard, layout: LayoutRectangle) => {
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

  const renderEventCard = (event: EventCard) => (
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
          <Text style={[styles.cardTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
            {event.name}
          </Text>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color={colorScheme === 'dark' ? '#aaa' : '#666'} />
            <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text }]}>
              {formatDate(event.start_date || '')} - {formatDate(event.end_date || '')}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color={colorScheme === 'dark' ? '#aaa' : '#666'} />
            <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text }]}>
              {event.location}
            </Text>
          </View>
          {event.distance !== null && event.distance !== undefined ? (
            <Text style={[styles.eventDistance, { color: Colors[colorScheme ?? 'light'].text }]}>
              Distance: {event.distance.toFixed(2)} km
            </Text>
          ) : (
            <Text style={[styles.eventDistance, { color: Colors[colorScheme ?? 'light'].text }]}>
              Distance: Calculating...
            </Text>
          )}
        </View>
        <TouchableOpacity 
          style={styles.deleteButton}
          onPress={() => deleteEvent(event.id)}
        >
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
        <ActivityIndicator size="large" color="#FF1493" />
      </View>
    );
  }

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
          {savedEvents.map(renderEventCard)}
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
            style={styles.backButton}
            onPress={closeModal}
          >
            <Text style={styles.backButtonText}>{'←'}</Text>
          </TouchableOpacity>
          
          <View style={[styles.expandedCard, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
            <ScrollView style={styles.expandedContent}>
              <Image source={selectedEvent.image} style={styles.imageExpanded} />
              <Text style={[styles.expandedTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                {selectedEvent.name}
              </Text>
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={20} color={colorScheme === 'dark' ? '#aaa' : '#666'} />
                <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text }]}>
                  {formatDate(selectedEvent.start_date || '')} - {formatDate(selectedEvent.end_date || '')}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={20} color={colorScheme === 'dark' ? '#aaa' : '#666'} />
                <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text }]}>
                  {selectedEvent.location}
                </Text>
              </View>
              {selectedEvent.distance !== null && selectedEvent.distance !== undefined ? (
                <View style={styles.infoRow}>
                  <Ionicons name="walk-outline" size={20} color={colorScheme === 'dark' ? '#aaa' : '#666'} />
                  <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text }]}>
                    Distance: {selectedEvent.distance.toFixed(2)} km
                  </Text>
                </View>
              ) : (
                <View style={styles.infoRow}>
                  <Ionicons name="walk-outline" size={20} color={colorScheme === 'dark' ? '#aaa' : '#666'} />
                  <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text }]}>
                    Distance: Calculating...
                  </Text>
                </View>
              )}
              <Text style={[styles.description, { color: Colors[colorScheme ?? 'light'].text }]}>
                {selectedEvent.description}
              </Text>

              {/* Google Map */}
              <View style={styles.mapContainer}>
                {userLocation && selectedEvent.latitude && selectedEvent.longitude ? (
                  <MapView
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    initialRegion={{
                      latitude: (userLocation.latitude + selectedEvent.latitude) / 2,
                      longitude: (userLocation.longitude + selectedEvent.longitude) / 2,
                      latitudeDelta: Math.abs(userLocation.latitude - selectedEvent.latitude) * 1.5 + 0.01,
                      longitudeDelta: Math.abs(userLocation.longitude - selectedEvent.longitude) * 1.5 + 0.01,
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
                        latitude: selectedEvent.latitude,
                        longitude: selectedEvent.longitude
                      }}
                      title={selectedEvent.name}
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
                        strokeColor="#2196F3"
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
  imageExpanded: {
    width: '100%',
    height: height * 0.4,
    resizeMode: 'cover',
    marginBottom: 20,
  },
  expandedTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: 20,
  },
  mapContainer: {
    marginTop: 20,
    height: 300,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
    position: 'relative',
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
  eventDistance: {
    fontSize: 14,
    color: '#666',
  },
}); 