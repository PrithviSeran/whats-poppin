import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import Slider from '@react-native-community/slider';
import MultiSlider from '@ptomasroos/react-native-multi-slider';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '@/lib/supabase';

const { width, height } = Dimensions.get('window');

interface EventFilterOverlayProps {
  visible: boolean;
  onClose: () => void;
  onApplyFilters: (filters: {
    eventTypes: string[];
    timePreferences: { start: string; end: string };
    locationPreferences: string[];
    travelDistance: number;
  }) => void;
  currentFilters: {
    eventTypes: string[];
    timePreferences: { start: string; end: string };
    locationPreferences: string[];
    travelDistance: number;
  };
}

const EVENT_TYPES = [
  'Live Concert',
  'Rooftop Party',
  'Comedy Night',
  'Bar Hopping',
  'Live Music',
  'Dancing',
  'Karaoke',
  'Chill Lounge',
  'Comedy Show',
  'Game Night',
  'Food Crawl',
  'Sports Bar',
  'Trivia Night',
  'Outdoor Patio',
  'Late Night Eats',
  'Themed Party',
  'Open Mic',
  'Wine Tasting',
  'Hookah',
  'Board Games',
  'Silent Disco',
];

const defaultStart = '21:00';
const defaultEnd = '3:00';

export default function EventFilterOverlay({
  visible,
  onClose,
  onApplyFilters,
  currentFilters,
}: EventFilterOverlayProps) {
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>(currentFilters.eventTypes);
  const [selectedTimePreferences, setSelectedTimePreferences] = useState<{ start: string; end: string }>(currentFilters.timePreferences);
  const [selectedLocationPreferences, setSelectedLocationPreferences] = useState<string[]>(currentFilters.locationPreferences);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [manualLocation, setManualLocation] = useState('');
  const [currentLocation, setCurrentLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [travelDistance, setTravelDistance] = useState(currentFilters.travelDistance);
  const [startTime, setStartTime] = useState(
    currentFilters.timePreferences?.start
      ? parseInt(currentFilters.timePreferences.start.split(':')[0], 10) * 60 + parseInt(currentFilters.timePreferences.start.split(':')[1], 10)
      : 21 * 60
  );
  const [endTime, setEndTime] = useState(
    currentFilters.timePreferences?.end
      ? parseInt(currentFilters.timePreferences.end.split(':')[0], 10) * 60 + parseInt(currentFilters.timePreferences.end.split(':')[1], 10)
      : 3 * 60
  );
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const colorScheme = useColorScheme();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(0)).current;
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (visible) {
      setIsAnimating(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
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
        Animated.timing(fadeAnim, {
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
        setIsAnimating(false);
      });
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      loadSavedFilters();
      checkLocationPermission();
    }
  }, [visible]);

  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      
      if (status === 'granted') {
        // Get current location when permission is granted
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High
        });
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });
      }
    } catch (error) {
      console.error('Error checking location permission:', error);
      Alert.alert('Error', 'Failed to check location permission');
    }
  };

  const loadSavedFilters = async () => {
    try {
      const savedFiltersJson = await AsyncStorage.getItem('eventFilters');
      if (savedFiltersJson) {
        const savedFilters = JSON.parse(savedFiltersJson);

        setSelectedEventTypes(savedFilters.eventTypes);
        setManualLocation('');
        setTravelDistance(savedFilters.travelDistance);
      }
    } catch (error) {
      console.error('Error loading saved filters in overlay:', error);
    }
  };

  const saveFiltersToStorage = async (filters: {
    eventTypes: string[];
    timePreferences: { start: string; end: string };
    locationPreferences: string[];
    travelDistance: number;
  }) => {
    try {
      await AsyncStorage.setItem('eventFilters', JSON.stringify(filters));

    } catch (error) {
      console.error('Error saving filters:', error);
    }
  };

  const toggleEventType = (type: string) => {
    setSelectedEventTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const formatTimeString = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}:${m.toString().padStart(2, '0')}`;
  };

  const handleApply = async () => {
    const start = formatTimeString(startTime);
    const end = formatTimeString(endTime);

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Error', 'User not logged in');
      return;
    }

    // Update user preferences in Supabase
    const { error } = await supabase
      .from('all_users')
      .update({
        preferences: selectedEventTypes,
        ['start-time']: start,
        ['end-time']: end,
        location: locationPermission ? null : manualLocation,
        ['travel-distance']: travelDistance,
      })
      .eq('email', user.email);

    if (error) {
      Alert.alert('Error', 'Failed to update preferences: ' + error.message);
      return;
    }

    const newFilters = {
      eventTypes: selectedEventTypes,
      timePreferences: { start, end },
      locationPreferences: locationPermission ? [] : [manualLocation],
      travelDistance: travelDistance,
    };

    // Save to AsyncStorage (optional: you may want to store minutes for persistence)
    await saveFiltersToStorage({
      ...newFilters,
      timePreferences: { start, end },
    });
    
    // Apply filters
    onApplyFilters(newFilters);
    onClose();
  };

   const handleReset = async () => {
    const emptyFilters = {
      eventTypes: [],
      timePreferences: { start: defaultStart, end: defaultEnd },
      locationPreferences: [],
      travelDistance: 8,
    };
    
    // Save empty filters to AsyncStorage
    await saveFiltersToStorage(emptyFilters);
    
    // Reset local state
    setSelectedEventTypes([]);
    setSelectedTimePreferences({ start: defaultStart, end: defaultEnd });
    setSelectedLocationPreferences([]);
    setStartTime(21 * 60);
    setEndTime(3 * 60);
    setTravelDistance(8);
  };

  const isDark = colorScheme === 'dark';

  // Helper to format minutes to 12-hour time string
  const formatTime = (minutes: number) => {
    let h = Math.floor(minutes / 60);
    let m = minutes % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}${m === 0 ? '' : ':' + m.toString().padStart(2, '0')}${ampm}`;
  };

  const getDateFromMinutes = (minutes: number) => {
    const date = new Date();
    date.setHours(Math.floor(minutes / 60));
    date.setMinutes(minutes % 60);
    date.setSeconds(0);
    return date;
  };

  if (!visible && !isAnimating) return null;

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0]
  });

  return (
    <Animated.View 
      style={[
        styles.overlay,
        { opacity: fadeAnim }
      ]}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Animated.View 
          style={[
            styles.content,
            { 
              backgroundColor: Colors[colorScheme ?? 'light'].background,
              transform: [{ translateY }]
            }
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: Colors[colorScheme ?? 'light'].text }]}>Filter Events</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Colors[colorScheme ?? 'light'].text} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.scrollView}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Event Types</Text>
              <View style={styles.pillContainer}>
                {EVENT_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.pill,
                      selectedEventTypes.includes(type) && (isDark ? styles.pillSelectedDark : styles.pillSelectedLight),
                      {
                        backgroundColor: selectedEventTypes.includes(type)
                          ? (isDark ? '#F45B5B' : '#F45B5B')
                          : (isDark ? '#222' : '#f5f5f5'),
                        borderColor: selectedEventTypes.includes(type)
                          ? (isDark ? '#FF3366' : '#FF3366')
                          : (isDark ? '#333' : '#eee'),
                      }
                    ]}
                    onPress={() => toggleEventType(type)}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        selectedEventTypes.includes(type) && styles.pillTextSelected,
                        { 
                          color: selectedEventTypes.includes(type) 
                            ? '#fff' 
                            : (isDark ? '#fff' : '#000')
                        }
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Time Preference</Text>
              <View style={{ alignItems: 'center', marginVertical: 20 }}>
                
                <View style={styles.timeButtonContainer}>
                  <TouchableOpacity
                    style={[styles.timeButton, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}
                    onPress={() => setShowStartTimePicker(true)}
                  >
                    <Text style={[styles.timeButtonText, { color: Colors[colorScheme ?? 'light'].text }]}>
                      Start Range
                    </Text>
                    <Text style={[styles.timeButtonTime, { color: '#FF1493' }]}>
                      {formatTime(startTime)}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.timeButton, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}
                    onPress={() => setShowEndTimePicker(true)}
                  >
                    <Text style={[styles.timeButtonText, { color: Colors[colorScheme ?? 'light'].text }]}>
                      End Range
                    </Text>
                    <Text style={[styles.timeButtonTime, { color: '#FF1493' }]}>
                      {formatTime(endTime)}
                  </Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              {showStartTimePicker && (
                <Animated.View 
                  style={[
                    styles.timePickerOverlay,
                    { opacity: fadeAnim }
                  ]}
                >
                  <Animated.View 
                    style={[
                      styles.timePickerContent,
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
                    <View style={styles.timePickerHeader}>
                      <Text style={[styles.timePickerTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                        Select Start Time
                      </Text>
                      <TouchableOpacity onPress={() => setShowStartTimePicker(false)}>
                        <Ionicons name="close" size={24} color={Colors[colorScheme ?? 'light'].text} />
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={getDateFromMinutes(startTime)}
                      mode="time"
                      is24Hour={false}
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(event, selectedTime) => {
                        if (selectedTime) {
                          const minutes = selectedTime.getHours() * 60 + selectedTime.getMinutes();
                          setStartTime(minutes);
                        }
                      }}
                      style={{ backgroundColor: Colors[colorScheme ?? 'light'].background }}
                    />
                    <TouchableOpacity
                      style={styles.timePickerConfirmButton}
                      onPress={() => setShowStartTimePicker(false)}
                    >
                      <LinearGradient
                        colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        locations={[0, 0.3, 0.7, 1]}
                        style={styles.timePickerGradientButton}
                      >
                        <Text style={styles.timePickerConfirmText}>Done</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                </Animated.View>
              )}
              
              {showEndTimePicker && (
                <Animated.View 
                  style={[
                    styles.timePickerOverlay,
                    { opacity: fadeAnim }
                  ]}
                >
                  <Animated.View 
                    style={[
                      styles.timePickerContent,
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
                    <View style={styles.timePickerHeader}>
                      <Text style={[styles.timePickerTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                        Select End Time
                      </Text>
                      <TouchableOpacity onPress={() => setShowEndTimePicker(false)}>
                        <Ionicons name="close" size={24} color={Colors[colorScheme ?? 'light'].text} />
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={getDateFromMinutes(endTime)}
                      mode="time"
                      is24Hour={false}
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(event, selectedTime) => {
                        if (selectedTime) {
                          const minutes = selectedTime.getHours() * 60 + selectedTime.getMinutes();
                          setEndTime(minutes);
                        }
                      }}
                      style={{ backgroundColor: Colors[colorScheme ?? 'light'].background }}
                    />
                    <TouchableOpacity
                      style={styles.timePickerConfirmButton}
                      onPress={() => setShowEndTimePicker(false)}
                    >
                      <LinearGradient
                        colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        locations={[0, 0.3, 0.7, 1]}
                        style={styles.timePickerGradientButton}
                      >
                        <Text style={styles.timePickerConfirmText}>Done</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                </Animated.View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                Location
              </Text>
              {locationPermission === false ? (
                <View style={styles.locationInputContainer}>
                  <Text style={[styles.locationLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                    Enter your location
                  </Text>
                  <TextInput
                    style={[
                      styles.locationInput,
                      { 
                        backgroundColor: Colors[colorScheme ?? 'light'].card,
                        color: Colors[colorScheme ?? 'light'].text,
                        borderColor: Colors[colorScheme ?? 'light'].card
                      }
                    ]}
                    placeholder="e.g., New York, NY"
                    placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
                    value={manualLocation}
                    onChangeText={setManualLocation}
                    returnKeyType="done"
                  />
                </View>
              ) : (
                <View style={styles.locationContainer}>
                  <LinearGradient
                    colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    locations={[0, 0.3, 0.7, 1]}
                    style={styles.locationGradient}
                  >
                    <View style={styles.locationContent}>
                      <Ionicons name="location" size={24} color="white" />
                      <View style={styles.locationTextContainer}>
                        <Text style={styles.locationTitle}>Using your current location</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Travel Distance</Text>
              <View style={styles.distanceContainer}>
                <Text style={[styles.distanceLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                  Travel Distance: {travelDistance} km
                </Text>
                <Slider
                  style={styles.slider}
                  minimumValue={1}
                  maximumValue={40}
                  step={1}
                  value={travelDistance}
                  onValueChange={setTravelDistance}
                  minimumTrackTintColor="#FF1493"
                  maximumTrackTintColor={Colors[colorScheme ?? 'light'].card}
                  thumbTintColor="#FF1493"
                />
                <View style={styles.distanceMarkers}>
                  <Text style={[styles.distanceMarker, { color: Colors[colorScheme ?? 'light'].text }]}>1 km</Text>
                  <Text style={[styles.distanceMarker, { color: Colors[colorScheme ?? 'light'].text }]}>20 km</Text>
                  <Text style={[styles.distanceMarker, { color: Colors[colorScheme ?? 'light'].text }]}>40 km</Text>
                </View>
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleReset}
            >
              <Text style={[styles.resetButtonText, { color: Colors[colorScheme ?? 'light'].text }]}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={handleApply}
            >
              <LinearGradient
                colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                locations={[0, 0.3, 0.7, 1]}
                style={styles.gradientButton}
              >
                <Text style={styles.applyButtonText}>Apply Filters</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 200,
    justifyContent: 'flex-end',
  },
  content: {
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
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  pillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pill: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillSelectedLight: {
    backgroundColor: '#F45B5B',
    borderColor: '#FF3366',
  },
  pillSelectedDark: {
    backgroundColor: '#F45B5B',
    borderColor: '#FF3366',
  },
  pillText: {
    fontSize: 14,
  },
  pillTextSelected: {
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  resetButton: {
    padding: 10,
  },
  resetButtonText: {
    fontSize: 16,
  },
  applyButton: {
    flex: 1,
    marginLeft: 20,
  },
  gradientButton: {
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  locationContainer: {
    marginBottom: 20,
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  locationGradient: {
    padding: 15,
  },
  locationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  locationTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  locationInputContainer: {
    marginTop: 10,
    marginBottom: 20,
  },
  locationLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  locationInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    minHeight: 50,
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  locationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  locationChip: {
    padding: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  locationChipSelected: {
    borderColor: '#FF1493',
  },
  locationChipText: {
    fontSize: 14,
  },
  locationChipTextSelected: {
    fontWeight: 'bold',
  },
  distanceContainer: {
    marginTop: 20,
    paddingHorizontal: 10,
  },
  distanceLabel: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  distanceMarkers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
    marginTop: -5,
  },
  distanceMarker: {
    fontSize: 12,
    opacity: 0.7,
  },
  timeButtonContainer: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 15,
  },
  timeButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 20, 147, 0.3)',
  },
  timeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  timeButtonTime: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  timePickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timePickerContent: {
    width: width * 0.9,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    position: 'absolute',
    bottom: height * 0.3,
    left: width * 0.05,
  },
  timePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  timePickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  timePickerConfirmButton: {
    marginTop: 20,
  },
  timePickerGradientButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
  },
  timePickerConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 