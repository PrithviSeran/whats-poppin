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
  Modal,
  Image,
  SafeAreaView,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import Slider from '@react-native-community/slider';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaskedView from '@react-native-masked-view/masked-view';
import * as Location from 'expo-location';

const { width, height } = Dimensions.get('window');

const EVENT_TYPES = [
  'Live Concert', 'Rooftop Party', 'Comedy Night', 'Bar Hopping', 'Live Music', 'Dancing', 'Karaoke',
  'Chill Lounge', 'Comedy Show', 'Game Night', 'Food Crawl', 'Sports Bar', 'Trivia Night',
  'Outdoor Patio', 'Late Night Eats', 'Themed Party', 'Open Mic', 'Wine Tasting', 'Hookah',
  'Board Games', 'Silent Disco'
];
const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];
const defaultStart = '21:00';
const defaultEnd = '3:00';

// Navigation types
 type RootStackParamList = {
   'create-account-finished': { userData: string };
 };
 type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const BALLOON_IMAGE = require('../assets/images/balloons.png');

export default function UserPreferences({ route }: { route: any }) {
  const colorScheme = useColorScheme();
  const navigation = useNavigation<NavigationProp>();
  const userData = route?.params?.userData ? JSON.parse(route.params.userData) : {};

  // State
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
  const [selectedDayPreferences, setSelectedDayPreferences] = useState<string[]>([]);
  const [startTime, setStartTime] = useState(21 * 60);
  const [endTime, setEndTime] = useState(3 * 60);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [manualLocation, setManualLocation] = useState('');
  const [travelDistance, setTravelDistance] = useState(8);

  // Handlers
  const toggleEventType = (type: string) => {
    setSelectedEventTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };
  const toggleDayPreference = (day: string) => {
    setSelectedDayPreferences(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };
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

  // Next button handler
  const handleNext = () => {
    const preferences = {
      eventTypes: selectedEventTypes,
      timePreferences: { start: `${Math.floor(startTime/60)}:${(startTime%60).toString().padStart(2, '0')}`, end: `${Math.floor(endTime/60)}:${(endTime%60).toString().padStart(2, '0')}` },
      locationPreferences: locationPermission ? [] : [manualLocation],
      travelDistance: travelDistance,
      dayPreferences: selectedDayPreferences.length > 0 ? selectedDayPreferences : DAYS_OF_WEEK,
    };
    navigation.navigate('create-account-finished', {
      userData: JSON.stringify({ ...userData, preferences })
    });
  };

  // UI
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

      <View style={styles.headerContainer}>
        <View style={styles.headerRow}>
          <Image
            source={BALLOON_IMAGE}
            style={styles.balloons}
            resizeMode="contain"
          />
          <MaskedView
            maskElement={<Text style={[styles.headerTitle, { opacity: 1 }]}>{`What's Poppin?`}</Text>}
          >
            <LinearGradient
              colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              locations={[0, 0.3, 0.7, 1]}
            >
              <Text style={[styles.headerTitle, { opacity: 0 }]}>{`What's Poppin?`}</Text>
            </LinearGradient>
          </MaskedView>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
          {/* Event Types */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Event Types</Text>
            <View style={styles.pillContainer}>
              {EVENT_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.pill,
                    selectedEventTypes.includes(type) && (colorScheme === 'dark' ? styles.pillSelectedDark : styles.pillSelectedLight),
                    {
                      backgroundColor: selectedEventTypes.includes(type)
                        ? (colorScheme === 'dark' ? '#F45B5B' : '#F45B5B')
                        : (colorScheme === 'dark' ? '#222' : '#f5f5f5'),
                      borderColor: selectedEventTypes.includes(type)
                        ? (colorScheme === 'dark' ? '#FF3366' : '#FF3366')
                        : (colorScheme === 'dark' ? '#333' : '#eee'),
                    }
                  ]}
                  onPress={() => toggleEventType(type)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      selectedEventTypes.includes(type) && styles.pillTextSelected,
                      { color: selectedEventTypes.includes(type) ? '#fff' : (colorScheme === 'dark' ? '#fff' : '#000') }
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Day Preference */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Day Preference</Text>
            <LinearGradient
              colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
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

          {/* Time Preference */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Time Preference</Text>
            <View style={{ alignItems: 'center', marginVertical: 20 }}>
              <View style={styles.timeButtonContainer}>
                <TouchableOpacity
                  style={[styles.timeButton, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}
                  onPress={() => setShowStartTimePicker(true)}
                >
                  <Text style={[styles.timeButtonText, { color: Colors[colorScheme ?? 'light'].text }]}>Start Range</Text>
                  <Text style={[styles.timeButtonTime, { color: '#FF1493' }]}>{formatTime(startTime)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.timeButton, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}
                  onPress={() => setShowEndTimePicker(true)}
                >
                  <Text style={[styles.timeButtonText, { color: Colors[colorScheme ?? 'light'].text }]}>End Range</Text>
                  <Text style={[styles.timeButtonTime, { color: '#FF1493' }]}>{formatTime(endTime)}</Text>
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
                      <Text style={[styles.timePickerTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Select Start Time</Text>
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
                      <Text style={[styles.timePickerTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Select End Time</Text>
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
                  </View>
                </View>
              </Modal>
            )}
          </View>

          {/* Location */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Location</Text>
            <View style={styles.locationToggleRow}>
              <Text style={{ color: Colors[colorScheme ?? 'light'].text, fontSize: 16, flex: 1 }}>
                Share my location
              </Text>
              <Switch
                value={locationPermission === true}
                onValueChange={async (value) => {
                  if (value) {
                    // Request permission
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status === 'granted') {
                      setLocationPermission(true);
                    } else {
                      Alert.alert('Permission Denied', 'Location permission is required to use your current location.');
                      setLocationPermission(false);
                    }
                  } else {
                    setLocationPermission(false);
                  }
                }}
                thumbColor={locationPermission === true ? '#FF1493' : (colorScheme === 'dark' ? '#888' : '#fff')}
                trackColor={{ false: '#ccc', true: '#FFB6C1' }}
              />
            </View>
            {locationPermission === true && (
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
                      <Text style={styles.locationTitle}>Your location will be used to personalize recommendations.</Text>
                    </View>
                  </View>
                </LinearGradient>
              </View>
            )}
            {locationPermission === false && (
              <View style={styles.locationInputContainer}>
                <Text style={[styles.locationLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Enter your location</Text>
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
            )}
          </View>

          {/* Travel Distance */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Travel Distance</Text>
            <View style={styles.distanceContainer}>
              <Text style={[styles.distanceLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Travel Distance: {travelDistance} km</Text>
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

          {/* Next Button - moved here */}
          <View style={styles.buttonGroup}>
            <TouchableOpacity onPress={handleNext}>
              <LinearGradient
                colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                locations={[0, 0.3, 0.7, 1]}
                style={styles.socialButton}
              >
                <Text style={styles.socialButtonText}>Next</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingBottom: 40,
  },
  headerContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balloons: {
    width: width * 0.22,
    height: width * 0.22,
    marginRight: -6,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#F45B5B',
    textAlign: 'left',
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 4, height: 4 },
    textShadowRadius: 6,
    fontFamily: Platform.OS === 'ios' ? 'MarkerFelt-Wide' : 'sans-serif-condensed',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
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
  buttonGroup: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    paddingTop: 18,
  },
  socialButton: {
    borderRadius: 30,
    width: width * 0.8,
    paddingVertical: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  socialButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  locationToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
});
