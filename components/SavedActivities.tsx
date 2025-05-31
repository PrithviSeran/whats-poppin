import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, Animated, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import type { Animated as RNAnimated } from 'react-native';

const { width, height } = Dimensions.get('window');
const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

interface EventCard {
  id: number;
  created_at: string;
  name: string;
  organization: string;
  event_type: string;
  start_time: string;
  end_time: string;
  location: string;
  cost: number;
  age_restriction: number;
  reservation: string;
  description: string;
  image: any;
  start_date: string;
  end_date: string;
  occurrence: string;
  latitude?: number;
  longitude?: number;
  distance?: number | null;
  days_of_the_week?: string[];
}

interface SavedActivitiesProps {
  visible: boolean;
  onClose: () => void;
  userLocation: { latitude: number; longitude: number } | null;
  savedActivitiesEvents: EventCard[];
  setSavedActivitiesEvents: React.Dispatch<React.SetStateAction<EventCard[]>>;
  savedActivitiesLoading: boolean;
  pressedCardIdx: number | null;
  setPressedCardIdx: React.Dispatch<React.SetStateAction<number | null>>;
  setExpandedSavedActivity: (event: EventCard) => void;
  savedActivityFadeAnim: RNAnimated.Value;
  savedActivityScaleAnim: RNAnimated.Value;
  savedActivityOpacityAnim: RNAnimated.Value;
  slideAnim: RNAnimated.Value;
  savedActivitiesFadeAnim: RNAnimated.Value;
}

export default function SavedActivities({
  visible,
  onClose,
  userLocation,
  savedActivitiesEvents,
  setSavedActivitiesEvents,
  savedActivitiesLoading,
  pressedCardIdx,
  setPressedCardIdx,
  setExpandedSavedActivity,
  savedActivityFadeAnim,
  savedActivityScaleAnim,
  savedActivityOpacityAnim,
  slideAnim,
  savedActivitiesFadeAnim
}: SavedActivitiesProps) {
  const colorScheme = useColorScheme();

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
            onPress={onClose}
            accessibilityLabel="Close Saved Activities"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={24} color={Colors[colorScheme ?? 'light'].text} />
          </TouchableOpacity>
        </View>
        {/* Clear Button */}
        <TouchableOpacity
          style={styles.clearSavedButton}
          onPress={async () => {
            setSavedActivitiesEvents([]);
            await AsyncStorage.removeItem('savedEvents');
            const { data: { user } } = await supabase.auth.getUser();
            if (user && user.email) {
              await supabase
                .from('all_users')
                .update({ saved_events: [] })
                .eq('email', user.email);
            }
          }}
          accessibilityLabel="Clear Saved Activities"
          accessibilityRole="button"
        >
          <LinearGradient
            colors={['#F45B5B', '#F45B5B', '#F45B5B', '#F45B5B']}
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
            <Ionicons name="heart" size={60} color={colorScheme === 'dark' ? '#666' : '#ccc'} />
            <Text style={[styles.savedLikesEmptyText, { color: Colors[colorScheme ?? 'light'].text }]}>No saved events yet</Text>
            <Text style={[styles.savedLikesEmptySubtext, { color: Colors[colorScheme ?? 'light'].text, opacity: 0.7 }]}>Like events to save them here</Text>
          </View>
        ) : (
          <ScrollView style={styles.savedLikesScroll} contentContainerStyle={{ paddingBottom: 40 }}>
            {savedActivitiesEvents.map((event, idx) => (
              <React.Fragment key={event.id ? `event-${event.id}` : `event-${event.name}-${idx}`}>
                <TouchableOpacity 
                  style={[
                    styles.savedLikesCard,
                    { backgroundColor: Colors[colorScheme ?? 'light'].card, opacity: pressedCardIdx === idx ? 0.92 : 1 },
                  ]}
                  activeOpacity={0.85}
                  accessibilityLabel={`View details for ${event.name}`}
                  accessibilityRole="button"
                  onPressIn={() => setPressedCardIdx(idx)}
                  onPressOut={() => setPressedCardIdx(null)}
                  onPress={() => {
                    setExpandedSavedActivity(event);
                    savedActivityFadeAnim.setValue(0);
                    savedActivityScaleAnim.setValue(0.8);
                    savedActivityOpacityAnim.setValue(0);
                  }}
                >
                  <View style={styles.savedLikesCardTextColumn}>
                    <Text style={[
                      styles.savedLikesCardTitle,
                      { color: '#000' }
                    ]} numberOfLines={1}>
                      {event.name || 'Untitled Event'}
                    </Text>
                    <View style={styles.savedLikesCardInfoContainer}>
                      <View style={styles.savedLikesCardInfoRow}>
                        {event.occurrence !== 'Weekly' && (
                          <>
                            <Ionicons name="calendar-outline" size={18} color="#000" />
                            <Text style={[styles.savedLikesCardInfoText, { color: '#000', marginLeft: 6 }]}> 
                              {new Date(event.start_date).toLocaleDateString()}
                            </Text>
                          </>
                        )}
                        {typeof event.distance === 'number' && (
                          <>
                            <Ionicons name="walk-outline" size={18} color="#000" style={{ marginLeft: 12 }} />
                            <Text style={[styles.savedLikesCardInfoText, { color: '#000', marginLeft: 6 }]}> 
                              {event.distance.toFixed(2)} km
                            </Text>
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
                {idx < savedActivitiesEvents.length - 1 && (
                  <View style={styles.cardDivider} />
                )}
              </React.Fragment>
            ))}
          </ScrollView>
        )}
      </Animated.View>
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
    height: height * 0.8, // 80% of screen height
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20, // Changed from paddingTop: 60
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
    paddingHorizontal: 10, // Reduced from 20 to give more space for cards
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F45B5B',
    marginHorizontal: 8,
    borderRadius: 1,
  },
  savedLikesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    height: 70,
    overflow: 'hidden',
    padding: 12,
    width: '100%',
    borderRadius: 6,
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
