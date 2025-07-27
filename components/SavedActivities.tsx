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
  colorScheme,
  isMultiSelectMode,
  isSelected,
  onToggleSelect,
  multiSelectSlideAnim
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
  isMultiSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  multiSelectSlideAnim?: RNAnimated.Value;
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

  const slideTranslateX = isMultiSelectMode ? 60 : 0;

  return (
    <View style={{ position: 'relative', width: '100%', height: 70, marginBottom: 2 }}>
      {/* Selection checkbox area - shown when in multi-select mode */}
      {isMultiSelectMode && (
        <RNAnimated.View 
          style={[
            styles.checkboxArea,
            {
              opacity: multiSelectSlideAnim ? 
                multiSelectSlideAnim.interpolate({
                  inputRange: [0.8, 1],
                  outputRange: [0, 1],
                  extrapolate: 'clamp'
                }) : 
                0
            }
          ]}
        >
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={onToggleSelect}
            activeOpacity={0.7}
          >
            <View style={[
              styles.checkbox,
              { 
                backgroundColor: isSelected ? Colors.light.primaryLight : 'transparent',
                borderColor: isSelected ? Colors.light.primaryLight : Colors[colorScheme ?? 'light'].text
              }
            ]}>
              {isSelected && (
                <Ionicons name="checkmark" size={16} color="white" />
              )}
            </View>
          </TouchableOpacity>
        </RNAnimated.View>
      )}
      
      {/* Bin icon background revealed as card is dragged (only in normal mode) */}
      {!isMultiSelectMode && (
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
      )}
      
      <RNAnimated.View
        style={{
          transform: [
            { 
              translateX: RNAnimated.add(
                translateX,
                multiSelectSlideAnim ? 
                  multiSelectSlideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -60]
                  }) : 
                  new RNAnimated.Value(0)
              )
            }
          ],
          zIndex: 1,
        }}
        {...panHandlers}
      >
        <View style={[
          styles.savedLikesCard, 
          { 
            backgroundColor: Colors[colorScheme ?? 'light'].card, 
            position: 'relative', 
            overflow: 'hidden'
          }
        ]}> 
          <LinearGradient
            colors={isSelected ? [
              'rgba(255,105,226,0.8)',
              'rgba(255,77,157,0.8)',
              'rgba(255,0,5,0.8)'
            ] : [
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
            accessibilityLabel={isMultiSelectMode ? `Toggle selection for ${event.name}` : `View details for ${event.name}`}
            accessibilityRole="button"
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            onPress={isMultiSelectMode ? onToggleSelect : onPress}
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
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  return (
    prevProps.event.id === nextProps.event.id &&
    prevProps.index === nextProps.index &&
    prevProps.colorScheme === nextProps.colorScheme &&
    prevProps.event.name === nextProps.event.name &&
    prevProps.event.distance === nextProps.event.distance &&
    prevProps.isMultiSelectMode === nextProps.isMultiSelectMode &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.multiSelectSlideAnim === nextProps.multiSelectSlideAnim
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
  
  // Multi-select state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<number>>(new Set());
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Initialize animation values
  const slideAnim = useRef(new RNAnimated.Value(0)).current;
  const savedActivitiesFadeAnim = useRef(new RNAnimated.Value(0)).current;

  // Add refs for measuring card positions
  const cardRefs = useRef<{ [key: number]: any }>({});

  // For each card, keep a ref for its animated value
  const cardTranslateX = useRef<{ [key: number]: RNAnimated.Value }>({}).current;
  const cardPanResponder = useRef<{ [key: number]: any }>({}).current;
  const multiSelectSlideAnim = useRef(new RNAnimated.Value(0)).current;
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

  // Create pan responder for a specific event (memoized)
  const createPanResponder = useCallback((eventId: number) => {
    console.log('Creating pan responder for event ID:', eventId);
    
    if (!eventId) {
      console.error('Cannot create pan responder: eventId is', eventId);
      return { panHandlers: {} };
    }
    
    if (!cardTranslateX[eventId]) {
      cardTranslateX[eventId] = new RNAnimated.Value(0);
    }
    
    if (cardPanResponder[eventId]) {
      return cardPanResponder[eventId];
    }

    cardPanResponder[eventId] = PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // More precise gesture detection
        return Math.abs(gestureState.dx) > 15 && 
               Math.abs(gestureState.dy) < 30 && 
               gestureState.dx > 0;
      },
      onPanResponderGrant: () => {
        // Add haptic feedback or visual feedback here if needed
      },
      onPanResponderMove: (evt, gestureState) => {
        // Only allow rightward movement with some resistance
        const translateValue = Math.max(0, Math.min(gestureState.dx, CARD_WIDTH * 0.8));
        cardTranslateX[eventId].setValue(translateValue);
      },
      onPanResponderRelease: (evt, gestureState) => {
        const releaseVelocity = gestureState.vx;
        const translateDistance = gestureState.dx;
        
        // More responsive threshold based on both distance and velocity
        const shouldDelete = translateDistance > CARD_WIDTH * 0.4 || 
                           (translateDistance > CARD_WIDTH * 0.2 && releaseVelocity > 0.5);
        
                 if (shouldDelete) {
           console.log('🚮 Triggering delete for event ID:', eventId);
           console.log('🔍 Event ID type:', typeof eventId, 'Value:', eventId);
           
           // Validate eventId before proceeding
           if (!eventId || typeof eventId !== 'number') {
             console.error('❌ Invalid eventId in pan responder:', eventId);
             // Reset card position
             RNAnimated.spring(cardTranslateX[eventId], {
               toValue: 0,
               useNativeDriver: true,
               tension: 200,
               friction: 8,
             }).start();
             return;
           }
           
           // Animate out faster and delete
           RNAnimated.timing(cardTranslateX[eventId], {
             toValue: CARD_WIDTH,
             duration: 150,
             useNativeDriver: true,
           }).start(() => {
             // Use the optimized removal function
             console.log('🎬 Animation complete, calling handleRemoveSavedEventOptimized for event:', eventId);
             handleRemoveSavedEventOptimized(eventId);
           });
        } else {
          // Snap back with more responsive animation
          RNAnimated.spring(cardTranslateX[eventId], {
            toValue: 0,
            useNativeDriver: true,
            tension: 200,
            friction: 8,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        // Handle gesture interruption
        RNAnimated.spring(cardTranslateX[eventId], {
          toValue: 0,
          useNativeDriver: true,
          tension: 200,
          friction: 8,
        }).start();
      },
    });

    return cardPanResponder[eventId];
  }, [CARD_WIDTH]);

  // Get or create pan responder for an event
  const getPanHandlers = useCallback((eventId: number) => {
    return createPanResponder(eventId).panHandlers;
  }, [createPanResponder]);

  // Optimized removal function using GlobalDataManager
  const handleRemoveSavedEventOptimized = useCallback(async (eventId: number) => {
    console.log('🗑️ Removing event with ID:', eventId);
    console.log('📋 Current events before removal:', savedActivitiesEvents.map(e => ({ id: e.id, name: e.name })));
    
    // Validate eventId
    if (!eventId || typeof eventId !== 'number') {
      console.error('❌ Invalid eventId provided:', eventId);
      return;
    }
    
    try {
      // Use functional state update to get current state and avoid stale closures
      let currentEventsSnapshot: EventCard[] = [];
      let eventToRemove: EventCard | undefined;
      let updatedEvents: EventCard[] = [];
      
      setSavedActivitiesEvents(currentEvents => {
        currentEventsSnapshot = [...currentEvents];
        
        // Find the event to remove for debugging
        eventToRemove = currentEventsSnapshot.find(e => e.id === eventId);
        if (!eventToRemove) {
          console.error('❌ Event not found in current events:', eventId);
          return currentEvents; // Return unchanged if event not found
        }
        
        console.log('🎯 Found event to remove:', eventToRemove.name);
        
        // Filter out the event
        updatedEvents = currentEventsSnapshot.filter(e => e.id !== eventId);
        console.log('✅ Filtered events - before:', currentEventsSnapshot.length, 'after:', updatedEvents.length);
        console.log('📋 Remaining events:', updatedEvents.map(e => ({ id: e.id, name: e.name })));
        
        return updatedEvents;
      });
      
      // Exit early if event was not found
      if (!eventToRemove) {
        return;
      }
      
      console.log('🔄 Optimistically updated UI, now updating backend...');
      
      // Clean up animation references for the removed event
      if (cardTranslateX[eventId]) {
        cardTranslateX[eventId].stopAnimation();
        delete (cardTranslateX as any)[eventId];
      }
      if (cardPanResponder[eventId]) {
        delete (cardPanResponder as any)[eventId];
      }
      
      // Wait for the backend removal to complete
      await dataManager.removeEventFromSavedEvents(eventId);
      console.log('✅ Successfully removed event from backend');
      
    } catch (error) {
      console.error('❌ Error removing event from saved events:', error);
      // Revert UI state if the removal failed by refetching from backend
      console.log('🔄 Reverting UI state due to backend error - refetching events');
      try {
        const revertedEvents = await dataManager.getSavedEvents();
        setSavedActivitiesEvents(revertedEvents);
      } catch (revertError) {
        console.error('❌ Failed to revert events, keeping current state');
      }
    }
  }, [dataManager]); // Remove savedActivitiesEvents from dependency to prevent stale closures

  // Legacy removal function for backwards compatibility (can be removed later)
  const handleRemoveSavedEvent = useCallback(async (eventId: number) => {
    // Redirect to optimized version
    await handleRemoveSavedEventOptimized(eventId);
  }, [handleRemoveSavedEventOptimized]);

  const handleCardPress = useCallback((event: EventCard, index: number) => {
    // Don't open detail modal in multi-select mode
    if (isMultiSelectMode) return;
    
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
  }, [isMultiSelectMode]);

  const handleToggleMultiSelect = useCallback(() => {
    const newMode = !isMultiSelectMode;
    setIsMultiSelectMode(newMode);
    
    // Animate the slide effect
    RNAnimated.timing(multiSelectSlideAnim, {
      toValue: newMode ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
    
    if (isMultiSelectMode) {
      // Clear selections when exiting multi-select mode
      setSelectedEventIds(new Set());
    }
  }, [isMultiSelectMode, multiSelectSlideAnim]);

  const handleToggleEventSelection = useCallback((eventId: number) => {
    setSelectedEventIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  }, []);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedEventIds.size === 0) return;

    Alert.alert(
      'Delete Selected Events',
      `Are you sure you want to delete ${selectedEventIds.size} selected event${selectedEventIds.size > 1 ? 's' : ''}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            setDeleteLoading(true);
            try {
              // Convert Set to Array for iteration
              const idsToDelete = Array.from(selectedEventIds);
              
              // Remove events from UI optimistically
              setSavedActivitiesEvents(currentEvents => 
                currentEvents.filter(event => !selectedEventIds.has(event.id))
              );
              
              // Remove from backend
              for (const eventId of idsToDelete) {
                await dataManager.removeEventFromSavedEvents(eventId);
              }
              
              // Clear selection and exit multi-select mode
              setSelectedEventIds(new Set());
              setIsMultiSelectMode(false);
              
            } catch (error) {
              console.error('Error deleting selected events:', error);
              // Revert UI state by refetching
              try {
                const revertedEvents = await dataManager.getSavedEvents();
                setSavedActivitiesEvents(revertedEvents);
              } catch (revertError) {
                console.error('Failed to revert events after delete error');
              }
              Alert.alert('Error', 'Failed to delete some events. Please try again.');
            } finally {
              setDeleteLoading(false);
            }
          }
        },
      ]
    );
  }, [selectedEventIds, dataManager]);

  const handleClose = useCallback(() => {
    // Exit multi-select mode if active
    if (isMultiSelectMode) {
      setIsMultiSelectMode(false);
      setSelectedEventIds(new Set());
      
      // Animate the slide back to normal position
      RNAnimated.timing(multiSelectSlideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
    
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
  }, [onClose, savedActivitiesFadeAnim, slideAnim, isMultiSelectMode, multiSelectSlideAnim]);

  const handleClearAll = useCallback(async () => {
    try {
      // Use functional state update to get current state
      let currentEventsSnapshot: EventCard[] = [];
      
      setSavedActivitiesEvents(currentEvents => {
        currentEventsSnapshot = [...currentEvents];
        console.log('🗑️ SavedActivities: Starting clear all process...');
        console.log('  - Events to clear:', currentEventsSnapshot.length);
        console.log('  - Event IDs:', currentEventsSnapshot.map(e => e.id));
        
        // Optimistically clear UI first
        console.log('✅ SavedActivities: UI cleared optimistically');
        return [];
      });
      
      // Wait for the backend clear to complete
      await dataManager.clearSavedEvents();
      console.log('✅ SavedActivities: Backend clear completed');
      
      // Verify the clear worked by checking the data again
      const verifyEvents = await dataManager.getSavedEvents();
      console.log('🔍 SavedActivities: Verification check - remaining events:', verifyEvents.length);
      
      if (verifyEvents.length > 0) {
        console.warn('⚠️  SavedActivities: Clear verification failed - events still exist!');
        console.warn('  - Remaining events:', verifyEvents.map((e: any) => e.id));
      } else {
        console.log('✅ SavedActivities: Clear verified successfully - no events remain');
      }
      
    } catch (error) {
      console.error('❌ SavedActivities: Error clearing saved events:', error);
      // Revert UI state if the clear failed by refetching from backend
      try {
        const revertedEvents = await dataManager.getSavedEvents();
        setSavedActivitiesEvents(revertedEvents);
      } catch (revertError) {
        console.error('❌ Failed to revert events after clear error');
      }
      Alert.alert('Error', 'Failed to clear saved events. Please try again.');
    }
  }, [dataManager]); // Remove savedActivitiesEvents from dependency to prevent stale closures

  // Cleanup animation values and prevent memory leaks
  useEffect(() => {
    return () => {
      slideAnim.stopAnimation();
      savedActivitiesFadeAnim.stopAnimation();
      multiSelectSlideAnim.stopAnimation();
      
      // Clean up all card animations and pan responders
      Object.keys(cardTranslateX).forEach(eventIdStr => {
        const eventId = parseInt(eventIdStr, 10);
        if ((cardTranslateX as any)[eventId]) {
          (cardTranslateX as any)[eventId].stopAnimation();
          delete (cardTranslateX as any)[eventId];
        }
        if ((cardPanResponder as any)[eventId]) {
          delete (cardPanResponder as any)[eventId];
        }
      });
    };
  }, []);

  // Clean up animation values for events that are no longer in the list
  useEffect(() => {
    const currentEventIds = new Set(eventsWithDistances.map(e => e.id));
    
    // Remove animations for events that no longer exist
    Object.keys(cardTranslateX).forEach(eventIdStr => {
      const eventId = parseInt(eventIdStr, 10);
              if (!currentEventIds.has(eventId)) {
          if ((cardTranslateX as any)[eventId]) {
            (cardTranslateX as any)[eventId].stopAnimation();
            delete (cardTranslateX as any)[eventId];
          }
          if ((cardPanResponder as any)[eventId]) {
            delete (cardPanResponder as any)[eventId];
          }
        }
    });
  }, [eventsWithDistances]);

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
          style={[
            styles.clearSavedButton,
            { opacity: isMultiSelectMode ? 0.3 : 1 }
          ]}
          onPress={() => {
            if (isMultiSelectMode) return; // Disable in multi-select mode
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
          disabled={isMultiSelectMode}
        >
          <LinearGradient
            colors={[Colors.light.accent, Colors.light.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.clearSavedButtonGradient}
          >
            <Ionicons name="trash" size={28} color={'white'} />
          </LinearGradient>
        </TouchableOpacity>

        {/* Multi-Select Button */}
        <TouchableOpacity
          style={styles.multiSelectButton}
          onPress={isMultiSelectMode ? 
            (selectedEventIds.size > 0 ? handleDeleteSelected : handleToggleMultiSelect) : 
            handleToggleMultiSelect
          }
          accessibilityLabel={isMultiSelectMode ? 
            (selectedEventIds.size > 0 ? `Delete ${selectedEventIds.size} selected events` : "Exit multi-select mode") : 
            "Select multiple events"
          }
          accessibilityRole="button"
          disabled={false} // Always enabled - X button should be clickable to exit
        >
          <LinearGradient
            colors={isMultiSelectMode && selectedEventIds.size > 0 ? 
              ['#FF0005', '#FF3366'] : 
              [Colors.light.accent, Colors.light.primaryLight]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.multiSelectButtonGradient}
          >
            {deleteLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : isMultiSelectMode ? (
              selectedEventIds.size > 0 ? (
                <View style={{ alignItems: 'center' }}>
                  <Ionicons name="trash" size={20} color="white" />
                  <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>
                    {selectedEventIds.size}
                  </Text>
                </View>
              ) : (
                <Ionicons name="close" size={24} color="white" />
              )
            ) : (
              <Ionicons name="checkmark-done" size={24} color="white" />
            )}
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
            {eventsWithDistances.map((event, idx) => {
              // Debug: Check for valid event ID
              if (!event.id) {
                console.warn('Event has no ID:', event.name, 'at index', idx);
                return null;
              }
              
              // Initialize translateX if not exists
              if (!cardTranslateX[event.id]) {
                cardTranslateX[event.id] = new RNAnimated.Value(0);
              }
              
              return (
                <SavedEventCard
                  key={event.id ? `event-${event.id}` : `event-${event.name}-${idx}`}
                  event={event}
                  index={idx}
                  onPress={() => handleCardPress(event, idx)}
                  onPressIn={() => setPressedCardIdx(idx)}
                  onPressOut={() => setPressedCardIdx(null)}
                  cardRef={(ref) => { cardRefs.current[idx] = ref; }}
                  translateX={cardTranslateX[event.id]}
                  panHandlers={isMultiSelectMode ? {} : getPanHandlers(event.id)}
                  colorScheme={colorScheme}
                  isMultiSelectMode={isMultiSelectMode}
                  isSelected={selectedEventIds.has(event.id)}
                  onToggleSelect={() => handleToggleEventSelection(event.id)}
                  multiSelectSlideAnim={multiSelectSlideAnim}
                />
              );
            }).filter(Boolean)}
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
    zIndex: 1001, // Higher than floating buttons to ensure close button is always clickable
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

  multiSelectButton: {
    position: 'absolute',
    bottom: 30,
    left: 30,
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
  multiSelectButtonGradient: {
    borderRadius: 30,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxArea: {
    position: 'absolute',
    right: -15, // Move 10px to the left from the previous centered position
    top: 0,
    bottom: 0,
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  checkboxContainer: {
    padding: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});