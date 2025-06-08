import React, { useState, useRef, useEffect, useCallback } from 'react';
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

const { height, width } = Dimensions.get('window');

interface SavedActivitiesProps {
  visible: boolean;
  onClose: () => void;
  userLocation: { latitude: number; longitude: number } | null;
}

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

  // Improved swipe animation refs
  const cardAnimations = useRef<{ [key: number]: RNAnimated.Value }>({});
  const cardOpacities = useRef<{ [key: number]: RNAnimated.Value }>({});
  const panResponders = useRef<{ [key: number]: any }>({});
  
  const SWIPE_THRESHOLD = width * 0.25; // 25% of screen width
  const DELETE_THRESHOLD = width * 0.4; // 40% of screen width

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

  useEffect(() => {
    const fetchSavedEvents = async () => {
      setSavedActivitiesLoading(true);
      try {
        const savedEvents = await dataManager.getSavedEvents();
        // Calculate distances for each event
        const eventsWithDistance = savedEvents.map(event => {
          let distance = null;
          if (userLocation?.latitude != null && userLocation?.longitude != null &&
              event.latitude != null && event.longitude != null) {
            // Haversine formula
            const R = 6371;
            const dLat = (event.latitude - userLocation.latitude) * Math.PI / 180;
            const dLon = (event.longitude - userLocation.longitude) * Math.PI / 180;
            const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(userLocation.latitude * Math.PI / 180) *
              Math.cos(event.latitude * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            distance = R * c;
          }
          return { ...event, distance };
        });
        setSavedActivitiesEvents(eventsWithDistance);
      } catch (error) {
        console.error('Error fetching saved events:', error);
      } finally {
        setSavedActivitiesLoading(false);
      }
    };
    if (visible) {
      fetchSavedEvents();
    }
  }, [visible, userLocation]);

  // Initialize animations for each card
  const initializeCardAnimations = useCallback((eventId: number) => {
    if (!cardAnimations.current[eventId]) {
      cardAnimations.current[eventId] = new RNAnimated.Value(0);
    }
    if (!cardOpacities.current[eventId]) {
      cardOpacities.current[eventId] = new RNAnimated.Value(1);
    }
  }, []);

  // Create pan responder for each card
  const createPanResponder = useCallback((eventId: number) => {
    if (panResponders.current[eventId]) {
      return panResponders.current[eventId];
    }

    const panResponder = PanResponder.create({
      onStartShouldSetPanResponder: (evt, gestureState) => {
        // Only start if horizontal movement is more significant than vertical
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to horizontal swipes that are more significant than vertical
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderGrant: () => {
        // Reset any existing animation
        cardAnimations.current[eventId]?.stopAnimation();
        cardAnimations.current[eventId]?.setValue(cardAnimations.current[eventId]._value);
      },
      onPanResponderMove: (evt, gestureState) => {
        // Only allow right swipes (positive dx)
        if (gestureState.dx >= 0) {
          const progress = Math.min(gestureState.dx / DELETE_THRESHOLD, 1);
          cardAnimations.current[eventId]?.setValue(gestureState.dx);
          
          // Fade out as we approach delete threshold
          const opacity = 1 - (progress * 0.3); // Fade to 70% opacity
          cardOpacities.current[eventId]?.setValue(opacity);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        const shouldDelete = gestureState.dx > DELETE_THRESHOLD;
        const shouldReveal = gestureState.dx > SWIPE_THRESHOLD;
        
        if (shouldDelete) {
          // Animate out and delete
          RNAnimated.parallel([
            RNAnimated.timing(cardAnimations.current[eventId], {
              toValue: width,
              duration: 200,
              useNativeDriver: true,
            }),
            RNAnimated.timing(cardOpacities.current[eventId], {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            })
          ]).start(() => {
            handleRemoveSavedEvent(eventId);
          });
        } else if (shouldReveal) {
          // Snap to revealed position
          RNAnimated.parallel([
            RNAnimated.spring(cardAnimations.current[eventId], {
              toValue: 80, // Show delete button
              friction: 8,
              tension: 100,
              useNativeDriver: true,
            }),
            RNAnimated.spring(cardOpacities.current[eventId], {
              toValue: 0.9,
              friction: 8,
              tension: 100,
              useNativeDriver: true,
            })
          ]).start();
        } else {
          // Snap back to original position
          RNAnimated.parallel([
            RNAnimated.spring(cardAnimations.current[eventId], {
              toValue: 0,
              friction: 8,
              tension: 100,
              useNativeDriver: true,
            }),
            RNAnimated.spring(cardOpacities.current[eventId], {
              toValue: 1,
              friction: 8,
              tension: 100,
              useNativeDriver: true,
            })
          ]).start();
        }
      },
      onPanResponderTerminate: () => {
        // Reset position if gesture is interrupted
        RNAnimated.parallel([
          RNAnimated.spring(cardAnimations.current[eventId], {
            toValue: 0,
            friction: 8,
            tension: 100,
            useNativeDriver: true,
          }),
          RNAnimated.spring(cardOpacities.current[eventId], {
            toValue: 1,
            friction: 8,
            tension: 100,
            useNativeDriver: true,
          })
        ]).start();
      },
    });

    panResponders.current[eventId] = panResponder;
    return panResponder;
  }, []);

  // Remove a saved event by id
  const handleRemoveSavedEvent = async (eventId: number) => {
    try {
      // Remove from GlobalDataManager first
      await dataManager.removeEventFromSavedEvents(eventId);
      
      // Update local state by filtering out only the removed event
      setSavedActivitiesEvents(prevEvents => 
        prevEvents.filter(event => event.id !== eventId)
      );
      
      // Clean up animations for removed card
      delete cardAnimations.current[eventId];
      delete cardOpacities.current[eventId];
      delete panResponders.current[eventId];
    } catch (error) {
      console.error('Error removing saved event:', error);
      Alert.alert('Error', 'Failed to remove event. Please try again.');
    }
  };

  // Reset all card positions
  const resetAllCardPositions = useCallback(() => {
    Object.keys(cardAnimations.current).forEach(eventId => {
      RNAnimated.parallel([
        RNAnimated.spring(cardAnimations.current[parseInt(eventId)], {
          toValue: 0,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }),
        RNAnimated.spring(cardOpacities.current[parseInt(eventId)], {
          toValue: 1,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        })
      ]).start();
    });
  }, []);

  const formatDaysOfWeek = (days: string[] | null | undefined): string => {
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
  };

  const handleCardPress = (event: EventCard, index: number) => {
    // Reset all card positions first
    resetAllCardPositions();
    
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
  };

  const handleClose = () => {
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
  };

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
                { text: 'Delete All', style: 'destructive', onPress: async () => {
                  try {
                    await dataManager.clearSavedEvents();
                    setSavedActivitiesEvents([]);
                    // Clear all animations
                    cardAnimations.current = {};
                    cardOpacities.current = {};
                    panResponders.current = {};
                  } catch (error) {
                    console.error('Error clearing saved events:', error);
                    Alert.alert('Error', 'Failed to clear saved events. Please try again.');
                  }
                }},
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
        ) : savedActivitiesEvents.length === 0 ? (
          <View style={styles.savedLikesEmptyContainer}>
            <Ionicons name="heart" size={60} color={Colors[colorScheme ?? 'light'].text} />
            <Text style={[styles.savedLikesEmptyText, { color: Colors[colorScheme ?? 'light'].text }]}>No saved events yet</Text>
            <Text style={[styles.savedLikesEmptySubtext, { color: Colors[colorScheme ?? 'light'].text, opacity: 0.7 }]}>Like events to save them here</Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.savedLikesScroll} 
            contentContainerStyle={{ paddingBottom: 40 }}
            onScrollBeginDrag={resetAllCardPositions} // Reset cards when scrolling
          >
            {savedActivitiesEvents.map((event, idx) => {
              // Initialize animations for this card
              initializeCardAnimations(event.id);
              const panResponder = createPanResponder(event.id);
              
              return (
                <View key={event.id ? `event-${event.id}` : `event-${event.name}-${idx}`} style={styles.cardContainer}>
                  {/* Delete background */}
                  <View style={styles.deleteBackground}>
                    <RNAnimated.View style={[
                      styles.deleteIconContainer,
                      {
                        opacity: cardAnimations.current[event.id]?.interpolate({
                          inputRange: [0, SWIPE_THRESHOLD],
                          outputRange: [0, 1],
                          extrapolate: 'clamp',
                        }) || 0,
                        transform: [{
                          scale: cardAnimations.current[event.id]?.interpolate({
                            inputRange: [0, SWIPE_THRESHOLD, DELETE_THRESHOLD],
                            outputRange: [0.8, 1, 1.2],
                            extrapolate: 'clamp',
                          }) || 1,
                        }]
                      }
                    ]}>
                      <Ionicons name="trash" size={32} color="#FF0005" />
                      <Text style={styles.deleteText}>Delete</Text>
                    </RNAnimated.View>
                  </View>

                  {/* Card */}
                  <RNAnimated.View
                    style={[
                      styles.cardWrapper,
                      {
                        transform: [{ 
                          translateX: cardAnimations.current[event.id] || 0 
                        }],
                        opacity: cardOpacities.current[event.id] || 1,
                      }
                    ]}
                    {...panResponder.panHandlers}
                  >
                    <View style={[styles.savedLikesCard, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}> 
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
                        ref={(ref) => { cardRefs.current[idx] = ref; }}
                        style={{ flex: 1 }}
                        activeOpacity={0.85}
                        accessibilityLabel={`View details for ${event.name}`}
                        accessibilityRole="button"
                        onPressIn={() => setPressedCardIdx(idx)}
                        onPressOut={() => setPressedCardIdx(null)}
                        onPress={() => handleCardPress(event, idx)}
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
            })}
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