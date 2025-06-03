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
  Modal,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import * as Location from 'expo-location';
import Slider from '@react-native-community/slider';
import DateTimePicker from '@react-native-community/datetimepicker';
import GlobalDataManager from '@/lib/GlobalDataManager';
import { UserProfile } from '@/lib/GlobalDataManager';
import AsyncStorage from '@react-native-async-storage/async-storage';


const { width, height } = Dimensions.get('window');

interface EventFilterOverlayProps {
  visible: boolean;
  onClose: () => void;
  setLoading: (loading: boolean) => void;
  fetchTokenAndCallBackend: () => void;
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

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

export default function EventFilterOverlay({ visible, onClose, setLoading, fetchTokenAndCallBackend }: EventFilterOverlayProps) {
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
  const [selectedDayPreferences, setSelectedDayPreferences] = useState<string[]>([]);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [manualLocation, setManualLocation] = useState('');
  const [travelDistance, setTravelDistance] = useState(8);
  const [startTime, setStartTime] = useState(21 * 60);
  const [endTime, setEndTime] = useState(3 * 60);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const colorScheme = useColorScheme();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(0)).current;
  const [isAnimating, setIsAnimating] = useState(false);
  const [filterByDistance, setFilterByDistance] = useState(true);

  const dataManager = GlobalDataManager.getInstance();

  const fetchUserPreferences = async () => {
    try {
      
      const userProfile = await dataManager.getUserProfile();

      const prefs = userProfile as UserProfile;
      // Set event types
      let eventTypes: string[] = [];
      if (Array.isArray(prefs.preferences)) {
        eventTypes = prefs.preferences;
      } else if (typeof prefs.preferences === 'string' && prefs.preferences.length > 0) {
        eventTypes = prefs.preferences.replace(/[{}"']+/g, '').split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      setSelectedEventTypes(eventTypes);
      // Set time preferences
      const startTimeStr = prefs['start-time'] || defaultStart;
      const endTimeStr = prefs['end-time'] || defaultEnd;
      const [startHour, startMin] = startTimeStr.split(':').map(Number);
      const [endHour, endMin] = endTimeStr.split(':').map(Number);
      setStartTime(startHour * 60 + startMin);
      setEndTime(endHour * 60 + endMin);
      // Set location
      setManualLocation(prefs.location || '');
      // Set travel distance
      setTravelDistance(prefs['travel-distance'] || 8);
      // Set day preferences
      let days: string[] = [];
      if (Array.isArray(prefs.preferred_days)) {
        days = prefs.preferred_days;
      } else if (typeof prefs.preferred_days === 'string' && prefs.preferred_days.length > 0) {
        days = prefs.preferred_days.replace(/[{}"']+/g, '').split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      setSelectedDayPreferences(days.length > 0 ? days : DAYS_OF_WEEK);
      // Load filter by distance preference
      const filterByDistanceStr = await dataManager.getIsFilterByDistance();
      //AsyncStorage.getItem('filterByDistance');
      setFilterByDistance(filterByDistanceStr);
    } catch (error) {
      console.error('Error in fetchUserPreferences:', error);
    }
  };

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
      fetchUserPreferences(); // Fetch user preferences from Supabase when overlay becomes visible
      //checkLocationPermission();
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

  /*
  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      
      if (status === 'granted') {
        // Get current location when permission is granted
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High
        });
      }
    } catch (error) {
      console.error('Error checking location permission:', error);
      Alert.alert('Error', 'Failed to check location permission');
    }
  };*/

  const toggleEventType = (type: string) => {
    setSelectedEventTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const toggleDayPreference = (day: string) => {
    setSelectedDayPreferences(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
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

    // If no days are selected, use all days
    const daysToSave = selectedDayPreferences.length > 0 ? selectedDayPreferences : DAYS_OF_WEEK;

    const userProfile = await dataManager.getUserProfile();

    if (!userProfile) {
      Alert.alert('Error', 'User profile not found');
      return;
    }

    // Update user preferences in Supabase
    userProfile.preferences = selectedEventTypes;
    userProfile['start-time'] = start;
    userProfile['end-time'] = end;
    userProfile.location = manualLocation;
    userProfile['travel-distance'] = travelDistance;
    userProfile.preferred_days = daysToSave;

    // Save filter by distance preference
    await dataManager.setIsFilterByDistance(filterByDistance);
    //await AsyncStorage.setItem('filterByDistance', filterByDistance.toString());

    await dataManager.setUserProfile(userProfile);

    onClose();
    setLoading(true);
    fetchTokenAndCallBackend();
  };

   const handleReset = async () => {
    // Reset local state
    setSelectedEventTypes([]);
    setSelectedDayPreferences([]);
    setStartTime(21 * 60);
    setEndTime(3 * 60);
    setTravelDistance(8);
    setManualLocation('');
    
    // Reset filter by distance preference
    await dataManager.setIsFilterByDistance(false);
    setFilterByDistance(false);
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
                          ? '#F45B5B'
                          : (isDark ? '#222' : '#f5f5f5'),
                        borderColor: selectedEventTypes.includes(type)
                          ? '#F45B5B'
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
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Day Preference</Text>
              <LinearGradient
                colors={['#F45B5B', '#F45B5B', '#F45B5B', '#F45B5B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                locations={[0, 0.3, 0.7, 1]}
                style={styles.dayGradientContainer}
              >
                <View style={styles.dayButtonContainer}>
                  {DAYS_OF_WEEK.map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.dayCircleButton,
                        selectedDayPreferences.includes(day) && styles.dayCircleButtonSelected
                      ]}
                      onPress={() => toggleDayPreference(day)}
                    >
                      <Text
                        style={[
                          styles.dayCircleButtonText,
                          { color: selectedDayPreferences.includes(day) ? '#F45B5B' : 'white' }
                        ]}
                      >
                        {day.slice(0, 1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </LinearGradient>
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
                    <Text style={[styles.timeButtonTime, { color: '#F45B5B' }]}>
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
                    <Text style={[styles.timeButtonTime, { color: '#F45B5B' }]}>
                      {formatTime(endTime)}
                  </Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              {showStartTimePicker && (
                  <Modal
                    transparent={true}
                    animationType="slide"
                    visible={showStartTimePicker}
                  >
                    <View style={styles.timePickerModalContainer}>
                      <View style={[
                        styles.timePickerModalContent,
                        { backgroundColor: Colors[colorScheme ?? 'light'].background }
                      ]}>
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
                            colors={['#F45B5B', '#F45B5B', '#F45B5B', '#F45B5B']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            locations={[0, 0.3, 0.7, 1]}
                            style={styles.timePickerGradientButton}
                          >
                            <Text style={styles.timePickerConfirmText}>Done</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Modal>
              )}
              
              {showEndTimePicker && (
                <Modal
                  transparent={true}
                  animationType="slide"
                  visible={showEndTimePicker}
                >
                  <View style={styles.timePickerModalContainer}>
                    <View style={[
                      styles.timePickerModalContent,
                      { backgroundColor: Colors[colorScheme ?? 'light'].background }
                    ]}>
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
                          colors={['#F45B5B', '#F45B5B', '#F45B5B', '#F45B5B']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          locations={[0, 0.3, 0.7, 1]}
                          style={styles.timePickerGradientButton}
                        >
                          <Text style={styles.timePickerConfirmText}>Done</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Modal>
              )}
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Location</Text>
              <View style={styles.locationToggleContainer}>
                <Text style={[styles.locationToggleLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                  Filter by travel distance
                </Text>
                <Switch
                  value={filterByDistance}
                  onValueChange={setFilterByDistance}
                  trackColor={{ false: '#767577', true: '#F45B5B' }}
                  thumbColor={filterByDistance ? '#fff' : '#f4f3f4'}
                />
              </View>
              {filterByDistance && (
                <>
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
                        colors={['#F45B5B', '#F45B5B', '#F45B5B', '#F45B5B']}
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
                </>
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
                  minimumTrackTintColor="#F45B5B"
                  maximumTrackTintColor={Colors[colorScheme ?? 'light'].card}
                  thumbTintColor="#F45B5B"
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
                colors={['#F45B5B', '#F45B5B', '#F45B5B', '#F45B5B']}
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
  timePickerModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  timePickerModalContent: {
    borderRadius: 20,
    padding: 20,
    margin: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: width * 0.9,
  },
  dayGradientContainer: {
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 15,
    marginTop: 10,
    alignItems: 'center',
  },
  dayButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  dayCircleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayCircleButtonSelected: {
    backgroundColor: 'white',
    borderColor: '#FF3366',
  },
  dayCircleButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  locationToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  locationToggleLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
}); 