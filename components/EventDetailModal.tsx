import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  Animated,
  Easing,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { EventCard } from '../lib/GlobalDataManager';

const { width, height } = Dimensions.get('window');

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

interface CardPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface EventDetailModalProps {
  event: EventCard | null;
  visible: boolean;
  onClose: () => void;
  userLocation: { latitude: number; longitude: number } | null;
  cardPosition?: CardPosition | null;
}

export default function EventDetailModal({ event, visible, onClose, userLocation, cardPosition }: EventDetailModalProps) {
  const colorScheme = useColorScheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardScaleAnim = useRef(new Animated.Value(0.95)).current;
  
  // Simplified animation values for better performance
  const expandScale = useRef(new Animated.Value(0.3)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current; // Separate overlay opacity

  useEffect(() => {
    if (visible && event) {
      // Calculate initial position offset if cardPosition is provided
      let initialX = 0;
      let initialY = 0;
      let initialScale = 0.3;

      if (cardPosition) {
        const modalCenterX = width / 2;
        const modalCenterY = height / 2;
        const cardCenterX = cardPosition.x + cardPosition.width / 2;
        const cardCenterY = cardPosition.y + cardPosition.height / 2;
        
        initialX = cardCenterX - modalCenterX;
        initialY = cardCenterY - modalCenterY;
        initialScale = Math.min(cardPosition.width / (width - 40), cardPosition.height / (height - 120));
        initialScale = Math.max(0.1, Math.min(initialScale, 0.5)); // Clamp scale for smoother animation
      }

      // Set initial values immediately
      expandScale.setValue(initialScale);
      translateX.setValue(initialX);
      translateY.setValue(initialY);
      contentOpacity.setValue(0);
      fadeAnim.setValue(1); // Card is immediately visible
      overlayOpacity.setValue(0); // Overlay starts transparent

      // Start expansion animation immediately (no overlay delay)
      Animated.parallel([
        Animated.timing(expandScale, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        // Much later overlay fade-in to keep swiper visible during expansion
        Animated.timing(overlayOpacity, {
          toValue: 0.8, // Slightly less opaque
          duration: 200,
          delay: 300, // Start overlay much later, after expansion is mostly complete
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
      ]).start(() => {
        // Content fade in after main animation completes
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      });
    } else {
      // Close animation - faster and simpler
      let targetX = 0;
      let targetY = 0;
      let targetScale = 0.3;

      if (cardPosition) {
        const modalCenterX = width / 2;
        const modalCenterY = height / 2;
        const cardCenterX = cardPosition.x + cardPosition.width / 2;
        const cardCenterY = cardPosition.y + cardPosition.height / 2;
        
        targetX = cardCenterX - modalCenterX;
        targetY = cardCenterY - modalCenterY;
        targetScale = Math.min(cardPosition.width / (width - 40), cardPosition.height / (height - 120));
        targetScale = Math.max(0.1, Math.min(targetScale, 0.5));
      }

      // Quick content and overlay fade out first
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start(() => {
        // Then animate back to card position
        Animated.parallel([
          Animated.timing(expandScale, {
            toValue: targetScale,
            duration: 300,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: targetX,
            duration: 300,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: targetY,
            duration: 300,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          })
        ]).start();
      });
    }
  }, [visible, event, cardPosition]);

  if (!visible || !event) return null;

  return (
    <View style={styles.expandedOverlay}>
      {/* Separate overlay background with delayed fade-in */}
      <Animated.View 
        style={[
          styles.overlayBackground,
          { 
            opacity: overlayOpacity,
          }
        ]}
      />

      <TouchableOpacity
        style={styles.backButton}
        onPress={onClose}
      >
        <LinearGradient
          colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
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
            // Add shadow and border to prevent bleed-through
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 16,
            borderWidth: 1,
            borderColor: Colors[colorScheme ?? 'light'].background,
            opacity: fadeAnim,
            transform: [
              { scale: expandScale },
              { translateX: translateX },
              { translateY: translateY }
            ],
          }
        ]}
      >
        {/* Always render image immediately for smooth scaling */}
        {event.image ? (
          <Image 
            source={{ uri: event.image }} 
            style={styles.imageExpanded}
          />
        ) : (
          <View style={[styles.imageExpanded, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="image-outline" size={40} color="#666" />
          </View>
        )}

        {/* Content that fades in after main animation */}
        <Animated.View style={{ opacity: contentOpacity, flex: 1 }}>
          <ScrollView 
            style={styles.expandedContent}
            showsVerticalScrollIndicator={false}
            scrollEnabled={true}
            removeClippedSubviews={true}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.expandedHeader}>
              <Text style={[styles.expandedTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                {event.name}
              </Text>
              <Text style={[styles.organizationText, { color: Colors[colorScheme ?? 'light'].text }]}>
                {event.organization}
              </Text>
            </View>

            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <LinearGradient
                  colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  locations={[0, 0.3, 0.7, 1]}
                  style={styles.infoIconContainer}
                >
                  <Ionicons name="calendar-outline" size={20} color="white" />
                </LinearGradient>
                <View style={styles.infoTextContainer}>
                  {Array.isArray(event.days_of_the_week) && event.days_of_the_week.length > 0 ? (
                    <>
                      <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text, marginBottom: 4 }]}>Days of the Week</Text>
                      <View style={styles.dayButtonContainer}>
                        {DAYS_OF_WEEK.map((day) => (
                          <View
                            key={day}
                            style={[
                              styles.dayCircleButton,
                              event.days_of_the_week?.includes(day) && styles.dayCircleButtonSelected
                            ]}
                          >
                            <Text
                              style={[
                                styles.dayCircleButtonText,
                                { color: event.days_of_the_week?.includes(day) ? '#F45B5B' : 'white' }
                              ]}
                            >
                              {day.slice(0, 1)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Date</Text>
                      <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text, fontWeight: 'bold', marginTop: 2 }]}> 
                        {event.start_date ? new Date(event.start_date).toLocaleDateString() : "please check organizer's page"}
                      </Text>
                    </>
                  )}
                </View>
              </View>

              <View style={styles.infoRow}>
                <LinearGradient
                  colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
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
                    {event.location}
                  </Text>
                </View>
              </View>

              {typeof event.distance === 'number' && (
                <View style={styles.infoRow}>
                  <LinearGradient
                    colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
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
                      {event.distance.toFixed(2)} km away
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.infoRow}>
                <LinearGradient
                  colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
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
                    ${event.cost}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <LinearGradient
                  colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
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
                    {event.age_restriction}+
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <LinearGradient
                  colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
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
                    {event.reservation === 'yes' ? 'Required' : 'Not Required'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.descriptionSection}>
              <Text style={[styles.descriptionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                About this event
              </Text>
              <Text style={[styles.descriptionText, { color: Colors[colorScheme ?? 'light'].text }]}>
                {event.description}
              </Text>
            </View>

            {/* Google Map */}
            <View style={styles.mapContainer}>
              {userLocation && event.latitude && event.longitude ? (
                <MapView
                  provider={PROVIDER_GOOGLE}
                  style={styles.map}
                  initialRegion={{
                    latitude: (userLocation.latitude + event.latitude) / 2,
                    longitude: (userLocation.longitude + event.longitude) / 2,
                    latitudeDelta: Math.abs(userLocation.latitude - event.latitude) * 1.5 + 0.01,
                    longitudeDelta: Math.abs(userLocation.longitude - event.longitude) * 1.5 + 0.01,
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
                      latitude: event.latitude,
                      longitude: event.longitude
                    }}
                    title={event.name}
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
    </View>
  );
}

const styles = StyleSheet.create({
  expandedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    zIndex: 201,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 301,
    borderRadius: 25,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  backButtonGradient: {
    borderRadius: 25,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedCard: {
    width: width - 40,
    height: height - 120,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
    overflow: 'hidden',
    zIndex: 202, // Above the overlay background
  },
  expandedContent: {
    flex: 1,
  },
  imageExpanded: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  expandedHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  expandedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  organizationText: {
    fontSize: 16,
    opacity: 0.7,
  },
  infoSection: {
    padding: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  infoTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.7,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 2,
  },
  dayButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 8,
    gap: 8,
  },
  dayCircleButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(158, 149, 189, 0.3)',
  },
  dayCircleButtonSelected: {
    backgroundColor: 'white',
    borderColor: '#FF3366',
  },
  dayCircleButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  descriptionSection: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  descriptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.8,
  },
  mapContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  map: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  mapPlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FF0005',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  eventMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#9E95BD',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },

}); 