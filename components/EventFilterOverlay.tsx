import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import Slider from '@react-native-community/slider';
import MultiSlider from '@ptomasroos/react-native-multi-slider';


const { width, height } = Dimensions.get('window');

interface EventFilterOverlayProps {
  visible: boolean;
  onClose: () => void;
  onApplyFilters: (filters: {
    eventTypes: string[];
    timePreferences: string[];
    locationPreferences: string[];
    travelDistance: number;
  }) => void;
  currentFilters: {
    eventTypes: string[];
    timePreferences: string[];
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

const TIME_PREFERENCES = ['Morning', 'Afternoon', 'Evening'];
const LOCATION_PREFERENCES = ['Uptown', 'Midtown', 'Downtown'];

export default function EventFilterOverlay({
  visible,
  onClose,
  onApplyFilters,
  currentFilters,
}: EventFilterOverlayProps) {
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>(currentFilters.eventTypes);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [manualLocation, setManualLocation] = useState('');
  const [travelDistance, setTravelDistance] = useState(8); // Default 8 km
  const colorScheme = useColorScheme();
  const [startTime, setStartTime] = useState(21 * 60); // 9:00 PM
  const [endTime, setEndTime] = useState(3 * 60); // 3:00 AM

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
        console.log('Loading saved filters in overlay:', savedFilters);
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
    timePreferences: string[];
    locationPreferences: string[];
    travelDistance: number;
  }) => {
    try {
      await AsyncStorage.setItem('eventFilters', JSON.stringify(filters));
      console.log('Saving filters to storage:', filters); // Debug log
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

  const handleApply = async () => {
    const newFilters = {
      eventTypes: selectedEventTypes,
      timePreferences: [startTime, endTime], // Store as [start, end] in minutes
      locationPreferences: locationPermission ? [] : [manualLocation],
      travelDistance: travelDistance,
    };
    
    onClose();
  };

  const handleReset = async () => {
    const emptyFilters = {
      eventTypes: [],
      timePreferences: [],
      locationPreferences: [],
      travelDistance: 8, // Reset to 8 km
    };
    
    await saveFiltersToStorage(emptyFilters);
    setSelectedEventTypes([]);
    setManualLocation('');
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

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
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
                  <MultiSlider
                    values={[startTime, endTime]}
                    min={0}
                    max={1439}
                    step={15}
                    onValuesChange={([start, end]) => {
                      setStartTime(start);
                      setEndTime(end);
                    }}
                    sliderLength={width * 0.8}
                    selectedStyle={{ backgroundColor: '#FF1493' }}
                    unselectedStyle={{ backgroundColor: Colors[colorScheme ?? 'light'].card }}
                    markerStyle={{ backgroundColor: '#FF1493', borderWidth: 0, elevation: 3 }}
                    containerStyle={{ height: 40 }}
                    trackStyle={{ height: 4, borderRadius: 4 }}
                  />
                  <Text style={{ marginTop: 16, fontSize: 16, color: Colors[colorScheme ?? 'light'].text }}>
                    {formatTime(startTime)} - {formatTime(endTime)}
                  </Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Location</Text>
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
                  <Text style={[styles.locationText, { color: Colors[colorScheme ?? 'light'].text }]}>
                    Using your current location
                  </Text>
                )}

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
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: height * 0.8,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
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
  locationText: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 10,
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
}); 