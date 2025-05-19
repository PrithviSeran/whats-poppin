import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Dimensions,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

type RootStackParamList = {
  'create-account-finished': { userData: string };
};

type UserPreferencesRouteProp = RouteProp<{
  'user-preferences': { userData: string };
}, 'user-preferences'>;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

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

export default function UserPreferences({ route }: { route: UserPreferencesRouteProp }) {
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
  const [startTime, setStartTime] = useState(21 * 60);
  const [endTime, setEndTime] = useState(3 * 60);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [manualLocation, setManualLocation] = useState('');
  const [travelDistance, setTravelDistance] = useState(8);
  const navigation = useNavigation<NavigationProp>();
  const colorScheme = useColorScheme();
  const userData = route?.params?.userData ? JSON.parse(route.params.userData) : {};
  const isDark = colorScheme === 'dark';

  const toggleEventType = (type: string) => {
    setSelectedEventTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
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

  const formatTimeString = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}:${m.toString().padStart(2, '0')}`;
  };

  const handleNext = async () => {
    const preferences = {
      eventTypes: selectedEventTypes,
      timePreferences: { start: formatTimeString(startTime), end: formatTimeString(endTime) },
      locationPreferences: manualLocation ? [manualLocation] : [],
      travelDistance: travelDistance,
    };
    try {
      const updatedUserData = { ...userData, preferences };
      await AsyncStorage.setItem('userData', JSON.stringify(updatedUserData));
      navigation.navigate('create-account-finished', {
        userData: JSON.stringify(updatedUserData)
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  };

  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: Colors[colorScheme ?? 'light'].background }
    ]}>
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

      <Text style={[styles.title, { color: Colors[colorScheme ?? 'light'].text }]}>Almost There! Let us know what you're feeling!</Text>
      <Text style={[styles.subtitle, { color: isDark ? '#aaa' : '#888' }]}>Choose your interests for tonight</Text>
    
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
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
                <View style={styles.timePickerModalContent}>
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
                <View style={styles.timePickerModalContent}>
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

        <View style={styles.section}>
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
      </ScrollView>
      <View style={styles.buttonGroup}>
        <TouchableOpacity onPress={handleNext}>
          <LinearGradient
            colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            locations={[0, 0.3, 0.7, 1]}
            style={styles.socialButton}
          >
            <Text style={styles.socialButtonText}>Next</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scrollContent: {
    alignItems: 'center',
    padding: 24,
    paddingBottom: 60,
    
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    marginTop: 86,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  pillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  pill: {
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 10,
    margin: 6,
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
    fontSize: 15,
    fontWeight: '500',
  },
  pillTextSelected: {
    fontWeight: 'bold',
  },
  buttonGroup: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  socialButton: {
    borderRadius: 30,
    width: width * 0.8,
    paddingVertical: 13,
    marginBottom: 20,
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
  section: {
    width: '100%',
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    marginLeft: 10,
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
    fontSize: 16,
    fontWeight: 'bold',
  },
  timeButtonTime: {
    fontSize: 14,
    fontWeight: '500',
  },
  timePickerModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  timePickerModalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 20,
    width: '80%',
    maxHeight: '80%',
  },
  timePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  timePickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  timePickerConfirmButton: {
    borderRadius: 20,
    padding: 10,
    marginTop: 10,
    alignItems: 'center',
  },
  timePickerGradientButton: {
    borderRadius: 20,
    padding: 10,
  },
  timePickerConfirmText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  locationInputContainer: {
    marginBottom: 20,
  },
  locationLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  locationInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '500',
  },
  distanceContainer: {
    marginBottom: 20,
  },
  distanceLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  distanceMarkers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  distanceMarker: {
    fontSize: 12,
    fontWeight: '500',
  },
});
