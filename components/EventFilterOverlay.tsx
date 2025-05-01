import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

const { width, height } = Dimensions.get('window');

interface EventFilterOverlayProps {
  visible: boolean;
  onClose: () => void;
  onApplyFilters: (filters: {
    eventTypes: string[];
    timePreferences: string[];
    locationPreferences: string[];
  }) => void;
  currentFilters: {
    eventTypes: string[];
    timePreferences: string[];
    locationPreferences: string[];
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
  const [selectedTimePreferences, setSelectedTimePreferences] = useState<string[]>(currentFilters.timePreferences);
  const [selectedLocationPreferences, setSelectedLocationPreferences] = useState<string[]>(currentFilters.locationPreferences);
  const colorScheme = useColorScheme();

  const toggleEventType = (type: string) => {
    setSelectedEventTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const toggleTimePreference = (time: string) => {
    setSelectedTimePreferences(prev =>
      prev.includes(time)
        ? prev.filter(t => t !== time)
        : [...prev, time]
    );
  };

  const toggleLocationPreference = (location: string) => {
    setSelectedLocationPreferences(prev =>
      prev.includes(location)
        ? prev.filter(l => l !== location)
        : [...prev, location]
    );
  };

  const handleApply = () => {
    onApplyFilters({
      eventTypes: selectedEventTypes,
      timePreferences: selectedTimePreferences,
      locationPreferences: selectedLocationPreferences,
    });
    onClose();
  };

  const isDark = colorScheme === 'dark';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: Colors[colorScheme ?? 'light'].text }]}>Filter Events</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Colors[colorScheme ?? 'light'].text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView}>
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
              <View style={styles.pillContainer}>
                {TIME_PREFERENCES.map((time) => (
                  <TouchableOpacity
                    key={time}
                    style={[
                      styles.pill,
                      selectedTimePreferences.includes(time) && (isDark ? styles.pillSelectedDark : styles.pillSelectedLight),
                      {
                        backgroundColor: selectedTimePreferences.includes(time)
                          ? (isDark ? '#F45B5B' : '#F45B5B')
                          : (isDark ? '#222' : '#f5f5f5'),
                        borderColor: selectedTimePreferences.includes(time)
                          ? (isDark ? '#FF3366' : '#FF3366')
                          : (isDark ? '#333' : '#eee'),
                      }
                    ]}
                    onPress={() => toggleTimePreference(time)}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        selectedTimePreferences.includes(time) && styles.pillTextSelected,
                        { 
                          color: selectedTimePreferences.includes(time) 
                            ? '#fff' 
                            : (isDark ? '#fff' : '#000')
                        }
                      ]}
                    >
                      {time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Location Preference</Text>
              <View style={styles.pillContainer}>
                {LOCATION_PREFERENCES.map((location) => (
                  <TouchableOpacity
                    key={location}
                    style={[
                      styles.pill,
                      selectedLocationPreferences.includes(location) && (isDark ? styles.pillSelectedDark : styles.pillSelectedLight),
                      {
                        backgroundColor: selectedLocationPreferences.includes(location)
                          ? (isDark ? '#F45B5B' : '#F45B5B')
                          : (isDark ? '#222' : '#f5f5f5'),
                        borderColor: selectedLocationPreferences.includes(location)
                          ? (isDark ? '#FF3366' : '#FF3366')
                          : (isDark ? '#333' : '#eee'),
                      }
                    ]}
                    onPress={() => toggleLocationPreference(location)}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        selectedLocationPreferences.includes(location) && styles.pillTextSelected,
                        { 
                          color: selectedLocationPreferences.includes(location) 
                            ? '#fff' 
                            : (isDark ? '#fff' : '#000')
                        }
                      ]}
                    >
                      {location}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => {
                setSelectedEventTypes([]);
                setSelectedTimePreferences([]);
                setSelectedLocationPreferences([]);
              }}
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
}); 