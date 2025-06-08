import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, Animated, StyleSheet, Dimensions, PanResponder, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { Animated as RNAnimated } from 'react-native';
import GlobalDataManager, { EventCard } from '@/lib/GlobalDataManager';
import EventDetailModal from './EventDetailModal';
// Distance calculations are now handled within GlobalDataManager

const { height, width } = Dimensions.get('window');

interface SavedActivitiesProps {
  visible: boolean;
  onClose: () => void;
  userLocation: { latitude: number; longitude: number } | null;
}

// Memoized event card component to prevent unnecessary re-renders
const SavedEventCard = React.memo(({ 
  event, 
  index, 
  onPress, 
  onPressIn, 
  onPressOut, 
  cardRef, 
  translateX, 
  panHandlers, 
  colorScheme 
}: {
  event: EventCard;
  index: number;
  onPress: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
  cardRef: (ref: any) => void;
  translateX: RNAnimated.Value;
  panHandlers: any;
  colorScheme: 'light' | 'dark' | null;
}) => {
  const formatDaysOfWeek = useCallback((days: string[] | null | undefined): string => {
    if (!days || days.length === 0) return '';
    
    const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const weekends = ['Saturday', 'Sunday'];
    
    // Check if it's everyday
    if (days.length === 7) return 'Everyday';
    
    // Check if it's weekdays
    if (days.length === 5 && weekdays.every(day => days.includes(day))) return 'Weekdays';
    
    // Check if it's weekends
    if (days.length === 2 && weekends.every(day => days.includes(day))) return 'Weekends';
    
    // Check if it's all days except some
    const missingDays = allDays.filter(day => !days.includes(day));
    if (missingDays.length === 1) return `All days except ${missingDays[0]}`;
    
    // Otherwise, return the days in a more compact format
    return days.join(', ');
  }, []);

  return (
    <View style={{ position: 'relative', width: '100%', height: 70, marginBottom: 2 }}>
      {/* Bin icon background revealed as card is dragged */}
      <View style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'flex-start',
        zIndex: 0,
        height: 70,
      }} pointerEvents="none">
        <View style={{
          width: 60,
          height: 70,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <Ionicons name="trash" size={32} color="#FF0005" />
        </View>
      </View>
      <RNAnimated.View
        style={{
          transform: [{ translateX }],
          zIndex: 1,
        }}
        {...panHandlers}
      >
        <View style={[styles.savedLikesCard, { backgroundColor: Colors[colorScheme ?? 'light'].card, position: 'relative', overflow: 'hidden' }]}> 
          <LinearGradient
            colors={[
              'rgba(255,0,5,0.5)',
              'rgba(255,77,157,0.5)',
              'rgba(255,105,226,0.5)',
              'rgba(185,122,255,0.5)',
              'rgba(158,149,189,0.5)'
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            locations={[0, 0.25, 0.5, 0.75, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <TouchableOpacity 
            ref={cardRef}
            style={{ flex: 1 }}
            activeOpacity={0.85}
            accessibilityLabel={`View details for ${event.name}`}
            accessibilityRole="button"
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            onPress={onPress}
          >
            <View style={styles.savedLikesCardTextColumn}>
              <Text style={[
                styles.savedLikesCardTitle,
                { color: Colors[colorScheme ?? 'light'].text }
              ]} numberOfLines={1}>
                {event.name || 'Untitled Event'}
              </Text>
              <View style={styles.savedLikesCardInfoContainer}>
                <View style={styles.savedLikesCardInfoRow}>
                  {event.occurrence !== 'Weekly' && event.start_date && (
                    <>
                      <Ionicons name="calendar-outline" size={18} color={Colors[colorScheme ?? 'light'].text} />
                      <Text style={[styles.savedLikesCardInfoText, { color: Colors[colorScheme ?? 'light'].text, marginLeft: 6 }]}> 
                        {new Date(event.start_date).toLocaleDateString()}
                      </Text>
                    </>
                  )}
                  {event.days_of_the_week && event.days_of_the_week.length > 0 && (
                    <>
                      <Ionicons name="time-outline" size={18} color={Colors[colorScheme ?? 'light'].text} style={{ marginLeft: 12 }} />
                      <Text style={[styles.savedLikesCardInfoText, { color: Colors[colorScheme ?? 'light'].text, marginLeft: 6 }]}>
                        {formatDaysOfWeek(event.days_of_the_week)}
                      </Text>
                    </>
                  )}
                  {typeof event.distance === 'number' && (
                    <>
                      <Ionicons name="walk-outline" size={18} color={Colors[colorScheme ?? 'light'].text} style={{ marginLeft: 12 }} />
                      <Text style={[styles.savedLikesCardInfoText, { color: Colors[colorScheme ?? 'light'].text, marginLeft: 6 }]}> 
                        {event.distance.toFixed(2)} km
                      </Text>
                    </>
                  )}
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </RNAnimated.View>
    </View>
  );
});

export default function SavedActivities({
  visible,
  onClose,
  userLocation,
}: SavedActivitiesProps) {
  const colorScheme = useColorScheme();
  const dataManager = GlobalDataManager.getInstance();
  
  // Initialize state variables
  const [savedActivitiesEvents, setSavedActivitiesEvents] = useState<EventCard[]>([]);
  const [savedActivitiesLoading, setSavedActivitiesLoading] = useState(false);
  const [pressedCardIdx, setPressedCardIdx] = useState<number | null>(null);
  const [expandedSavedActivity, setExpandedSavedActivity] = useState<EventCard | null>(null);
  const [cardPosition, setCardPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  
  // Initialize animation values
  const slideAnim = useRef(new RNAnimated.Value(0)).current;
  const savedActivitiesFadeAnim = useRef(new RNAnimated.Value(0)).current;

  // Add refs for measuring card positions
  const cardRefs = useRef<{ [key: number]: any }>({});

  // For each card, keep a ref for its animated value
  const cardTranslateX = useRef<{ [key: number]: RNAnimated.Value }>({}).current;
  const cardPanResponder = useRef<{ [key: number]: any }>({}).current;
  const CARD_WIDTH = useMemo(() => Dimensions.get('window').width - 40, []);

  // Memoized distance calculation
  const eventsWithDistances = useMemo(() => {
    if (!userLocation?.latitude || !userLocation?.longitude || !savedActivitiesEvents.length) {
      return savedActivitiesEvents;
    }

    const distances = dataManager.calculateDistancesForEvents(
      userLocation.latitude,
      userLocation.longitude,
      savedActivitiesEvents
    );

    return savedActivitiesEvents.map((event, index) => ({
      ...event,
      distance: distances[index]
    }));
  }, [savedActivitiesEvents, userLocation]);

  // Add effect for visibility animation
  useEffect(() => {
    if (visible) {
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
      ]).start();
    }
  }, [visible]);

  const fetchSavedEvents = useCallback(async () => {
    setSavedActivitiesLoading(true);
    try {
      const savedEvents = await dataManager.getSavedEvents();
      setSavedActivitiesEvents(savedEvents);
    } catch (error) {
      console.error('Error fetching saved events:', error);
    } finally {
      setSavedActivitiesLoading(false);
    }
  }, [dataManager]);

  useEffect(() => {
    if (visible) {
      fetchSavedEvents();
    }
  }, [visible, fetchSavedEvents]);

  // Setup PanResponder for each card (only when events change)
  useEffect(() => {
    eventsWithDistances.forEach((event) => {
      if (!cardTranslateX[event.id]) {
        cardTranslateX[event.id] = new RNAnimated.Value(0);
      }
      if (!cardPanResponder[event.id]) {
        cardPanResponder[event.id] = PanResponder.create({
          onMoveShouldSetPanResponder: (evt, gestureState) => Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 20 && gestureState.dx > 0,
          onPanResponderMove: (evt, gestureState) => {
            if (gestureState.dx > 0) {
              cardTranslateX[event.id].setValue(gestureState.dx);
            }
          },
          onPanResponderRelease: (evt, gestureState) => {
            if (gestureState.dx > CARD_WIDTH * 0.6) {
              // Animate out and delete
              RNAnimated.timing(cardTranslateX[event.id], {
                toValue: CARD_WIDTH,
                duration: 200,
                useNativeDriver: true,
              }).start(async () => {
                await handleRemoveSavedEvent(event.id);
                // Clean up animated value and pan responder for this card
                delete cardTranslateX[event.id];
                delete cardPanResponder[event.id];
              });
            } else {
              // Animate back to exactly 0 for perfect alignment
              RNAnimated.spring(cardTranslateX[event.id], {
                toValue: 0,
                useNativeDriver: true,
                speed: 20,
                bounciness: 8,
              }).start(() => {
                cardTranslateX[event.id].setValue(0); // Ensure it's exactly 0
              });
            }
          },
        });
      }
    });
  }, [eventsWithDistances.length]); // Only depend on length to avoid excessive re-creation

  // Remove a saved event by id
  const handleRemoveSavedEvent = useCallback(async (eventId: number) => {
    // Remove from local state
    const updatedEvents = savedActivitiesEvents.filter(e => e.id !== eventId);
    setSavedActivitiesEvents(updatedEvents);
    
    // Remove from AsyncStorage
    await AsyncStorage.setItem('savedEvents', JSON.stringify(updatedEvents));
    
    // Remove from Supabase
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email) {
        // Get the current saved_events from user profile
        const { data: userData } = await supabase
          .from('all_users')
          .select('saved_events')
          .eq('email', user.email)
          .maybeSingle();
        let savedEventIds: number[] = [];
        if (userData?.saved_events) {
          if (Array.isArray(userData.saved_events)) {
            savedEventIds = userData.saved_events;
          } else if (typeof userData.saved_events === 'string' && userData.saved_events) {
            savedEventIds = userData.saved_events
              .replace(/[{}"']+/g, '')
              .split(',')
              .map((s: string) => parseInt(s.trim(), 10))
              .filter(Boolean);
          }
        }
        // Remove the eventId
        const newSavedIds = savedEventIds.filter(id => id !== eventId);
        await supabase
          .from('all_users')
          .update({ saved_events: newSavedIds })
          .eq('email', user.email);
      }
    } catch (error) {
      console.error('Error removing from Supabase:', error);
    }
  }, [savedActivitiesEvents]);

  const handleCardPress = useCallback((event: EventCard, index: number) => {
    // Measure the card position before expanding
    const cardRef = cardRefs.current[index];
    if (cardRef && cardRef.measure) {
      cardRef.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
        setCardPosition({ x: pageX, y: pageY, width, height });
        setExpandedSavedActivity(event);
      });
    } else {
      // Fallback if measurement fails
      setExpandedSavedActivity(event);
      setCardPosition(null);
    }
  }, []);

  const handleClose = useCallback(() => {
    // Start the closing animation
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
      // Only call onClose after animation completes
      onClose();
    });
  }, [onClose, savedActivitiesFadeAnim, slideAnim]);

  const handleClearAll = useCallback(async () => {
    try {
      await dataManager.clearSavedEvents();
      setSavedActivitiesEvents([]);
    } catch (error) {
      console.error('Error clearing saved events:', error);
      Alert.alert('Error', 'Failed to clear saved events. Please try again.');
    }
  }, [dataManager]);

  // Cleanup animation values on unmount
  useEffect(() => {
    return () => {
      slideAnim.stopAnimation();
      savedActivitiesFadeAnim.stopAnimation();
      Object.values(cardTranslateX).forEach(anim => anim.stopAnimation());
    };
  }, []);

  if (!visible) return null;

  return (
    <Animated.View 
      style={[
        styles.savedLikesOverlay,
        { opacity: savedActivitiesFadeAnim }
      ]}
    >
      <Animated.View 
        style={[
          styles.savedLikesContent,
          {
            backgroundColor: Colors[colorScheme ?? 'light'].background,
            transform: [{ 
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [height, 0]
              })
            }]
          }
        ]}
      >
        <View style={styles.savedLikesHeader}>
          <Text style={[styles.savedLikesTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Saved Activities</Text>
          <TouchableOpacity 
            style={styles.savedLikesCloseButton}
            onPress={handleClose}
            accessibilityLabel="Close Saved Activities"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={24} color={Colors[colorScheme ?? 'light'].text} />
          </TouchableOpacity>
        </View>
        
        {/* Clear Button */}
        <TouchableOpacity
          style={styles.clearSavedButton}
          onPress={() => {
            Alert.alert(
              'Clear All Saved Activities',
              'Are you sure you want to delete all your saved activities? This action cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete All', style: 'destructive', onPress: handleClearAll },
              ]
            );
          }}
          accessibilityLabel="Clear Saved Activities"
          accessibilityRole="button"
        >
          <LinearGradient
            colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            locations={[0, 0.3, 0.7, 1]}
            style={styles.clearSavedButtonGradient}
          >
            <Ionicons name="trash" size={28} color={'white'} />
          </LinearGradient>
        </TouchableOpacity>
        
        {savedActivitiesLoading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 }}>
            <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
          </View>
        ) : eventsWithDistances.length === 0 ? (
          <View style={styles.savedLikesEmptyContainer}>
            <Ionicons name="heart" size={60} color={Colors[colorScheme ?? 'light'].text} />
            <Text style={[styles.savedLikesEmptyText, { color: Colors[colorScheme ?? 'light'].text }]}>No saved events yet</Text>
            <Text style={[styles.savedLikesEmptySubtext, { color: Colors[colorScheme ?? 'light'].text, opacity: 0.7 }]}>Like events to save them here</Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.savedLikesScroll} 
            contentContainerStyle={{ paddingBottom: 40 }}
            removeClippedSubviews={true}
            keyboardShouldPersistTaps="handled"
          >
            {eventsWithDistances.map((event, idx) => (
              <SavedEventCard
                key={event.id ? `event-${event.id}` : `event-${event.name}-${idx}`}
                event={event}
                index={idx}
                onPress={() => handleCardPress(event, idx)}
                onPressIn={() => setPressedCardIdx(idx)}
                onPressOut={() => setPressedCardIdx(null)}
                cardRef={(ref) => { cardRefs.current[idx] = ref; }}
                translateX={cardTranslateX[event.id] || new RNAnimated.Value(0)}
                panHandlers={cardPanResponder[event.id] ? cardPanResponder[event.id].panHandlers : {}}
                colorScheme={colorScheme}
              />
            ))}
          </ScrollView>
        )}
      </Animated.View>

      {/* Event Detail Modal */}
      <EventDetailModal
        event={expandedSavedActivity}
        visible={!!expandedSavedActivity}
        onClose={() => setExpandedSavedActivity(null)}
        userLocation={userLocation}
        cardPosition={cardPosition}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
    height: height * 0.8,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
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
    paddingHorizontal: 10,
  },
  cardContainer: {
    position: 'relative',
    height: 72,
    marginBottom: 2,
    overflow: 'hidden',
  },
  deleteBackground: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 20,
  },
  deleteIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: '#FF0005',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  cardWrapper: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  savedLikesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    height: 70,
    overflow: 'hidden',
    padding: 12,
    width: '100%',
    borderRadius: 8,
  },
  savedLikesCardTextColumn: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 2,
  },
  savedLikesCardInfoContainer: {
    gap: 2,
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
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
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