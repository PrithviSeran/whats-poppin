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
import CircularTimeSlider from './CircularTimeSlider';


const { width, height } = Dimensions.get('window');

interface EventFilterOverlayProps {
  visible: boolean;
  onClose: () => void;
  setLoading: (loading: boolean) => void;
  fetchTokenAndCallBackend: () => void;
  onStartLoading: () => void;
}

const EVENT_TYPES = [
  'Food & Drink',
  'Outdoor / Nature',
  'Leisure & Social',
  'Games & Entertainment',
  'Arts & Culture',
  'Nightlife & Parties',
  'Wellness & Low-Energy',
  'Experiences & Activities',
  'Travel & Discovery'
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

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function EventFilterOverlay({ visible, onClose, setLoading, fetchTokenAndCallBackend, onStartLoading }: EventFilterOverlayProps) {
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
  const [selectedDayPreferences, setSelectedDayPreferences] = useState<string[]>([]);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [manualLocation, setManualLocation] = useState('');
  const [travelDistance, setTravelDistance] = useState(8);
  const [startTime, setStartTime] = useState(21 * 60);
  const [endTime, setEndTime] = useState(3 * 60);
  const colorScheme = useColorScheme();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(0)).current;
  const [isAnimating, setIsAnimating] = useState(false);
  const [filterByDistance, setFilterByDistance] = useState(true);
  const [locationBubbleAnim] = useState(new Animated.Value(filterByDistance ? 1 : 0));
  const [bubbleHeight, setBubbleHeight] = useState(0);
  const scrollViewRef = React.useRef<ScrollView>(null);
  
  // Calendar state
  const [isCalendarMode, setIsCalendarMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  
  // Featured Events state
  const [featuredEventsOnly, setFeaturedEventsOnly] = useState(false);

  const dataManager = GlobalDataManager.getInstance();

  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
    } catch (error) {
      console.error('Error checking location permission:', error);
      setLocationPermission(false);
    }
  };

  const fetchUserPreferences = async () => {
    try {
      console.log('🚀 OFFLINE-FIRST: Loading all preferences from AsyncStorage');
      
      // OFFLINE-FIRST: Load all preferences from AsyncStorage instead of database
      
      // Load event type preferences
      const savedPreferences = await AsyncStorage.getItem('userPreferences');
      let eventTypes: string[] = [];
      if (savedPreferences) {
        try {
          eventTypes = JSON.parse(savedPreferences);
        } catch (e) {
          console.error('Error parsing saved preferences:', e);
          eventTypes = [];
        }
      }
      
      // Extract "Featured Events" from event types and set the checkbox state
      const hasFeaturedEvents = eventTypes.includes('Featured Events');
      setFeaturedEventsOnly(hasFeaturedEvents);
      
      // Remove "Featured Events" from regular event types (it's now a separate checkbox)
      const regularEventTypes = eventTypes.filter(type => type !== 'Featured Events');
      setSelectedEventTypes(regularEventTypes);
      
      // Load time preferences
      const startTimeStr = await AsyncStorage.getItem('userStartTime') || defaultStart;
      const endTimeStr = await AsyncStorage.getItem('userEndTime') || defaultEnd;
      const [startHour, startMin] = startTimeStr.split(':').map(Number);
      const [endHour, endMin] = endTimeStr.split(':').map(Number);
      setStartTime(startHour * 60 + startMin);
      setEndTime(endHour * 60 + endMin);
      
      // Load location preference
      const savedLocation = await AsyncStorage.getItem('userLocation') || '';
      setManualLocation(savedLocation);
      
      // Load travel distance preference
      const savedTravelDistance = await AsyncStorage.getItem('userTravelDistance');
      setTravelDistance(savedTravelDistance ? parseFloat(savedTravelDistance) : 8);
      
      // Load calendar preferences from AsyncStorage
      const calendarModeStr = await AsyncStorage.getItem('isCalendarMode');
      const savedSelectedDates = await AsyncStorage.getItem('selectedDates');
      
      if (calendarModeStr === 'true') {
        setIsCalendarMode(true);
        if (savedSelectedDates) {
          try {
            const dates = JSON.parse(savedSelectedDates);
            setSelectedDates(Array.isArray(dates) ? dates : []);
          } catch (e) {
            console.error('Error parsing saved dates:', e);
            setSelectedDates([]);
          }
        }
      } else {
        setIsCalendarMode(false);
        // Load day preferences from AsyncStorage
        const savedPreferredDays = await AsyncStorage.getItem('userPreferredDays');
        let days: string[] = [];
        if (savedPreferredDays) {
          try {
            days = JSON.parse(savedPreferredDays);
          } catch (e) {
            console.error('Error parsing saved preferred days:', e);
            days = [];
          }
        }
        setSelectedDayPreferences(days.length > 0 ? days : DAYS_OF_WEEK);
      }
      
      // Load filter by distance preference
      const filterByDistanceStr = await dataManager.getIsFilterByDistance();
      setFilterByDistance(filterByDistanceStr);
      
      console.log('✅ OFFLINE-FIRST: All preferences loaded from AsyncStorage successfully');
    } catch (error) {
      console.error('❌ Error loading preferences from AsyncStorage:', error);
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
      checkLocationPermission();
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

  // Calendar helper functions
  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const formatDateString = (day: number, month: number, year: number) => {
    return `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  };

  const toggleDateSelection = async (dateString: string) => {
    const newSelectedDates = selectedDates.includes(dateString)
      ? selectedDates.filter(d => d !== dateString)
      : [...selectedDates, dateString];
    
    setSelectedDates(newSelectedDates);
    
    // Save to AsyncStorage
    try {
      await AsyncStorage.setItem('selectedDates', JSON.stringify(newSelectedDates));
    } catch (error) {
      console.error('Error saving selected dates:', error);
    }
  };

  const handleCalendarModeToggle = async (isCalendar: boolean) => {
    setIsCalendarMode(isCalendar);
    
    // Save calendar mode preference
    try {
      await AsyncStorage.setItem('isCalendarMode', isCalendar.toString());
      
      // If switching to calendar mode and no dates selected, clear any existing dates
      if (isCalendar && selectedDates.length === 0) {
        await AsyncStorage.setItem('selectedDates', JSON.stringify([]));
      }
      // If switching to days mode, we don't need to clear anything as days are stored in user profile
    } catch (error) {
      console.error('Error saving calendar mode preference:', error);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    const firstDay = getFirstDayOfMonth(currentMonth, currentYear);
    const today = new Date();
    const todayString = formatDateString(today.getDate(), today.getMonth(), today.getFullYear());
    
    const calendarDays = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      calendarDays.push(
        <View key={`empty-${i}`} style={styles.calendarDay} />
      );
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = formatDateString(day, currentMonth, currentYear);
      const isSelected = selectedDates.includes(dateString);
      const isToday = dateString === todayString;
      const isPast = new Date(currentYear, currentMonth, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      calendarDays.push(
        <TouchableOpacity
          key={day}
          style={[
            styles.calendarDay,
            styles.calendarDayButton,
            isSelected && styles.calendarDaySelected,
            isToday && styles.calendarDayToday,
            isPast && styles.calendarDayPast
          ]}
          onPress={() => !isPast && toggleDateSelection(dateString)}
          disabled={isPast}
        >
          <Text
            style={[
              styles.calendarDayText,
              isSelected && styles.calendarDayTextSelected,
              isToday && styles.calendarDayTextToday,
              isPast && styles.calendarDayTextPast
            ]}
          >
            {day}
          </Text>
        </TouchableOpacity>
      );
    }
    
    return (
               <View style={styles.calendarContainer}>
           <View style={styles.calendarHeader}>
             <TouchableOpacity onPress={() => navigateMonth('prev')} style={styles.calendarNavButton}>
               <Ionicons name="chevron-back" size={24} color={Colors[colorScheme ?? 'light'].text} />
             </TouchableOpacity>
             <Text style={[styles.calendarHeaderText, { color: Colors[colorScheme ?? 'light'].text }]}>
               {MONTH_NAMES[currentMonth]} {currentYear}
             </Text>
             <TouchableOpacity onPress={() => navigateMonth('next')} style={styles.calendarNavButton}>
               <Ionicons name="chevron-forward" size={24} color={Colors[colorScheme ?? 'light'].text} />
             </TouchableOpacity>
           </View>
           
           <View style={styles.calendarWeekHeader}>
             {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayLetter, index) => (
               <Text key={index} style={[styles.calendarWeekHeaderText, { color: Colors[colorScheme ?? 'light'].text }]}>
                 {dayLetter}
               </Text>
             ))}
           </View>
        
        <View style={styles.calendarGrid}>
          {calendarDays}
        </View>
      </View>
    );
  };

  const formatTimeString = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}:${m.toString().padStart(2, '0')}`;
  };

  const handleApply = async () => {
    // Start loading animation immediately for smooth user experience
    onStartLoading();
    
    const start = formatTimeString(startTime);
    const end = formatTimeString(endTime);

    console.log('🚀 OFFLINE-FIRST: Saving all preferences to AsyncStorage only');

    // OFFLINE-FIRST: Save all preferences to AsyncStorage instead of database
    try {
      // Save event type preferences (including featured events)
      const preferencesToSave = [...selectedEventTypes];
      if (featuredEventsOnly) {
        preferencesToSave.push('Featured Events');
      }
      await AsyncStorage.setItem('userPreferences', JSON.stringify(preferencesToSave));
      
      // Save time preferences
      await AsyncStorage.setItem('userStartTime', start);
      await AsyncStorage.setItem('userEndTime', end);
      
      // Save location preference
      await AsyncStorage.setItem('userLocation', manualLocation);
      
      // Save travel distance preference
      await AsyncStorage.setItem('userTravelDistance', travelDistance.toString());
      
      // Save calendar mode and date/day preferences
      await AsyncStorage.setItem('isCalendarMode', isCalendarMode.toString());
      
      if (isCalendarMode) {
        // In calendar mode, save selected dates and clear preferred_days
        await AsyncStorage.setItem('selectedDates', JSON.stringify(selectedDates));
        await AsyncStorage.setItem('userPreferredDays', JSON.stringify([])); // Clear days when using calendar mode
        console.log('✅ OFFLINE-FIRST: Saved calendar mode with dates:', selectedDates);
      } else {
        // In days mode, save preferred days and clear selected dates
        const daysToSave = selectedDayPreferences.length > 0 ? selectedDayPreferences : DAYS_OF_WEEK;
        await AsyncStorage.setItem('userPreferredDays', JSON.stringify(daysToSave));
        await AsyncStorage.setItem('selectedDates', JSON.stringify([])); // Clear dates when using days mode
        console.log('✅ OFFLINE-FIRST: Saved days mode with days:', daysToSave);
      }

      // Save filter by distance preference
      await dataManager.setIsFilterByDistance(filterByDistance);
      
      console.log('✅ OFFLINE-FIRST: All preferences saved to AsyncStorage successfully');
      
    } catch (error) {
      console.error('❌ Error saving preferences to AsyncStorage:', error);
      Alert.alert('Error', 'Failed to save preferences. Please try again.');
      return;
    }

    // Play the same closing animation as the close button
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
      onClose();
      // Fetch new events after the modal has closed
      fetchTokenAndCallBackend();
    });
  };

   const handleReset = async () => {
    console.log('🚀 OFFLINE-FIRST: Resetting all preferences in AsyncStorage');
    
    // Reset local state
    setSelectedEventTypes([]);
    setSelectedDayPreferences([]);
    setStartTime(21 * 60);
    setEndTime(3 * 60);
    setTravelDistance(8);
    setManualLocation('');
    setFeaturedEventsOnly(false);
    
    // Reset calendar preferences
    setIsCalendarMode(false);
    setSelectedDates([]);
    
    try {
      // OFFLINE-FIRST: Clear all preferences from AsyncStorage
      await AsyncStorage.setItem('userPreferences', JSON.stringify([]));
      await AsyncStorage.setItem('userStartTime', '21:00');
      await AsyncStorage.setItem('userEndTime', '03:00');
      await AsyncStorage.setItem('userLocation', '');
      await AsyncStorage.setItem('userTravelDistance', '8');
      await AsyncStorage.setItem('userPreferredDays', JSON.stringify([]));
      await AsyncStorage.setItem('isCalendarMode', 'false');
      await AsyncStorage.setItem('selectedDates', JSON.stringify([]));
      
      console.log('✅ OFFLINE-FIRST: All preferences cleared from AsyncStorage');
    } catch (error) {
      console.error('❌ Error resetting preferences in AsyncStorage:', error);
    }
    
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

  const handleToggleLocation = (value: boolean) => {
    setFilterByDistance(value);
    Animated.timing(locationBubbleAnim, {
      toValue: value ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleLocationInputFocus = () => {
    // Delay to ensure keyboard is opening
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
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
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={{ paddingBottom: 120 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
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
                          ? '#FF0005'
                          : (isDark ? '#222' : '#f5f5f5'),
                        borderColor: selectedEventTypes.includes(type)
                          ? '#FF0005'
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
              
              {/* Featured Events Checkbox */}
              <View style={styles.featuredEventsContainer}>
                <TouchableOpacity 
                  style={styles.featuredEventsToggle}
                  onPress={() => setFeaturedEventsOnly(!featuredEventsOnly)}
                >
                  <View style={[
                    styles.featuredEventsCheckbox,
                    featuredEventsOnly && styles.featuredEventsCheckboxSelected,
                    { 
                      backgroundColor: featuredEventsOnly ? '#FF0005' : 'transparent',
                      borderColor: featuredEventsOnly ? '#FF0005' : (isDark ? '#333' : '#ccc')
                    }
                  ]}>
                    {featuredEventsOnly && (
                      <Ionicons name="checkmark" size={16} color="white" />
                    )}
                  </View>
                  <Text style={[
                    styles.featuredEventsText,
                    { color: Colors[colorScheme ?? 'light'].text }
                  ]}>
                    Featured Events Only
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.dayPreferenceHeader}>
                <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Day Preference</Text>
                <View style={styles.dayPreferenceToggle}>
                  <TouchableOpacity
                    style={[
                      styles.dayToggleButton,
                      !isCalendarMode && styles.dayToggleButtonActive,
                      { backgroundColor: !isCalendarMode ? '#FF0005' : 'transparent' }
                    ]}
                    onPress={() => handleCalendarModeToggle(false)}
                  >
                    <Text style={[
                      styles.dayToggleButtonText,
                      { color: !isCalendarMode ? 'white' : Colors[colorScheme ?? 'light'].text }
                    ]}>
                      Days
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.dayToggleButton,
                      isCalendarMode && styles.dayToggleButtonActive,
                      { backgroundColor: isCalendarMode ? '#FF0005' : 'transparent' }
                    ]}
                    onPress={() => handleCalendarModeToggle(true)}
                  >
                    <Text style={[
                      styles.dayToggleButtonText,
                      { color: isCalendarMode ? 'white' : Colors[colorScheme ?? 'light'].text }
                    ]}>
                      Dates
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              {!isCalendarMode ? (
                <LinearGradient
                  colors={['#FF0005', '#FF4D9D', '#FF69E2', '#B97AFF', '#9E95BD']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  locations={[0, 0.25, 0.5, 0.75, 1]}
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
              ) : (
                renderCalendar()
              )}
              
              {isCalendarMode && selectedDates.length > 0 && (
                <View style={styles.selectedDatesContainer}>
                  <Text style={[styles.selectedDatesLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                    Selected Dates ({selectedDates.length}):
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedDatesScroll}>
                    {selectedDates.map((dateString) => (
                      <View key={dateString} style={styles.selectedDateChip}>
                        <Text style={styles.selectedDateChipText}>
                          {new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                        <TouchableOpacity onPress={() => toggleDateSelection(dateString)}>
                          <Ionicons name="close-circle" size={16} color="white" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Time Preference</Text>
              <CircularTimeSlider
                startTime={startTime}
                endTime={endTime}
                onTimeChange={(newStartTime, newEndTime) => {
                  setStartTime(newStartTime);
                  setEndTime(newEndTime);
                }}
              />
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Location</Text>
              <View style={styles.locationToggleContainer}>
                <Text style={[styles.locationToggleLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                  Filter by travel distance
                </Text>
                <Switch
                  value={filterByDistance}
                  onValueChange={handleToggleLocation}
                  trackColor={{ false: '#767577', true: '#FF0005' }}
                  thumbColor={'#fff'}
                />
              </View>
                            {filterByDistance && (
                locationPermission === false ? (
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
                          borderColor: '#9E95BD'
                        }
                      ]}
                      placeholder="Enter your city or address (e.g., New York, NY)"
                      placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
                      value={manualLocation}
                      onChangeText={setManualLocation}
                      onFocus={handleLocationInputFocus}
                      returnKeyType="done"
                      autoCapitalize="words"
                      autoCorrect={false}
                      clearButtonMode="while-editing"
                      blurOnSubmit={true}
                    />
                  </View>
                ) : (
                  <View style={styles.locationContainer}>
                    <Animated.View
                      style={{
                        opacity: locationBubbleAnim,
                        transform: [{
                          scale: locationBubbleAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.95, 1]
                          })
                        }],
                        overflow: 'hidden',
                      }}
                    >
                      <LinearGradient
                        colors={['#FF0005', '#FF4D9D', '#FF69E2', '#B97AFF', '#9E95BD']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        locations={[0, 0.25, 0.5, 0.75, 1]}
                        style={styles.locationGradient}
                      >
                        <View style={styles.locationContent}>
                          <Ionicons name="location" size={24} color="white" />
                          <View style={styles.locationTextContainer}>
                            <Text style={styles.locationTitle}>Using your current location</Text>
                          </View>
                        </View>
                      </LinearGradient>
                    </Animated.View>
                  </View>
                )
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
                  minimumTrackTintColor="#FF0005"
                  maximumTrackTintColor={Colors[colorScheme ?? 'light'].card}
                  thumbTintColor="#FF0005"
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
                colors={['#FF0005', '#FF4D9D', '#FF69E2', '#B97AFF', '#9E95BD']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                locations={[0, 0.25, 0.5, 0.75, 1]}
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
    maxHeight: height * 0.85,
    minHeight: height * 0.6,
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
    marginTop: 15,
    marginBottom: 25,
    paddingHorizontal: 5,
  },
  locationLabel: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 12,
    opacity: 0.9,
  },
  locationInput: {
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 17,
    fontWeight: '500',
    minHeight: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    textAlign: 'left',
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
  // Day Preference Header and Toggle Styles
  dayPreferenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  dayPreferenceToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 2,
  },
  dayToggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    minWidth: 60,
    alignItems: 'center',
  },
  dayToggleButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  dayToggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Calendar Styles
  calendarContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 15,
    padding: 15,
    marginTop: 10,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  calendarHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  calendarNavButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  calendarWeekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  calendarWeekHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.7,
    width: 40,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  calendarDay: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  calendarDayButton: {
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  calendarDaySelected: {
    backgroundColor: '#FF0005',
  },
  calendarDayToday: {
    borderWidth: 2,
    borderColor: '#FF0005',
  },
  calendarDayPast: {
    opacity: 0.3,
  },
  calendarDayText: {
    fontSize: 16,
    fontWeight: '500',
  },
  calendarDayTextSelected: {
    color: 'white',
    fontWeight: 'bold',
  },
  calendarDayTextToday: {
    fontWeight: 'bold',
  },
  calendarDayTextPast: {
    opacity: 0.5,
  },
  // Selected Dates Display Styles
  selectedDatesContainer: {
    marginTop: 15,
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
  },
  selectedDatesLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    opacity: 0.8,
  },
  selectedDatesScroll: {
    maxHeight: 40,
  },
  selectedDateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF0005',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    gap: 6,
  },
  selectedDateChipText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  // Featured Events Checkbox Styles
  featuredEventsContainer: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  featuredEventsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  featuredEventsCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredEventsCheckboxSelected: {
    backgroundColor: '#FF0005',
  },
  featuredEventsText: {
    fontSize: 16,
    fontWeight: '500',
  },
}); 