import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Animated, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import OptimizedComponentServices from '@/lib/OptimizedComponentServices';


const EVENT_TYPES = [
  'Bars',
  'Party life',
  'Clubbing',
  'Happy hours'
];

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

interface CreateEventForm {
  name: string;
  organization: string;
  location: string;
  description: string;
  cost: string;
  age_restriction: string;
  reservation: 'yes' | 'no';
  occurrence: 'one-time' | 'Weekly';
  event_type: string;
  start_date: string;
  end_date: string;
  start_time: string;
  days_of_the_week: string[];
  times: { [key: string]: string | [string, string] };
  featured: boolean;
  link: string;
  images: string[];
}

// Reusable Gradient Pill Component
interface GradientPillProps {
  text: string;
  isSelected: boolean;
  onPress: () => void;
  style?: any;
}

const GradientPill: React.FC<GradientPillProps> = ({ text, isSelected, onPress, style }) => {
  const colorScheme = useColorScheme();
  
  return (
    <TouchableOpacity
      style={[styles.pillContainer, style]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {isSelected ? (
        <LinearGradient
          colors={['#FF69E2', '#FF3366']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientPill}
        >
          <Text style={styles.selectedPillText}>{text}</Text>
        </LinearGradient>
      ) : (
        <View style={[
          styles.unselectedPill,
          { 
            backgroundColor: colorScheme === 'dark' ? '#222' : '#f5f5f5',
            borderColor: colorScheme === 'dark' ? '#333' : '#eee'
          }
        ]}>
          <Text style={[
            styles.unselectedPillText,
            { color: colorScheme === 'dark' ? '#fff' : '#000' }
          ]}>
            {text}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default function CreateEventScreen() {
  const [isCreating, setIsCreating] = useState(false);
  const colorScheme = useColorScheme();
  const navigation = useNavigation();
  const [showTimePicker, setShowTimePicker] = useState<{
    visible: boolean;
    day: string;
    type: 'start' | 'end';
  }>({ visible: false, day: '', type: 'start' });

  const [showDatePicker, setShowDatePicker] = useState<{
    visible: boolean;
    type: 'start' | 'end';
  }>({ visible: false, type: 'start' });

  // Animation refs for date picker
  const dateFadeAnim = useRef(new Animated.Value(0)).current;
  const dateSlideAnim = useRef(new Animated.Value(300)).current;
  const dateScaleAnim = useRef(new Animated.Value(0.8)).current;
  const [isDateClosing, setIsDateClosing] = useState(false);

  // Animation refs for time picker
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(300)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const [isClosing, setIsClosing] = useState(false);

  // Animate time picker modal when it opens
  useEffect(() => {
    if (showTimePicker.visible && !isClosing) {
      // Reset initial values and start opening animation
      fadeAnim.setValue(0);
      slideAnim.setValue(300);
      scaleAnim.setValue(0.8);
      
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showTimePicker.visible, isClosing]);

  // Animate date picker modal when it opens
  useEffect(() => {
    if (showDatePicker.visible && !isDateClosing) {
      // Reset initial values and start opening animation
      dateFadeAnim.setValue(0);
      dateSlideAnim.setValue(300);
      dateScaleAnim.setValue(0.8);
      
      Animated.parallel([
        Animated.timing(dateFadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(dateSlideAnim, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.spring(dateScaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showDatePicker.visible, isDateClosing]);

  // Function to handle closing animation
  const closeTimePicker = () => {
    setIsClosing(true);
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Animation completed, now hide the modal
      setShowTimePicker({ visible: false, day: '', type: 'start' });
      setIsClosing(false);
    });
  };

  // Function to handle closing animation for date picker
  const closeDatePicker = () => {
    setIsDateClosing(true);
    
    Animated.parallel([
      Animated.timing(dateFadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(dateSlideAnim, {
        toValue: 300,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(dateScaleAnim, {
        toValue: 0.8,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Animation completed, now hide the modal
      setShowDatePicker({ visible: false, type: 'start' });
      setIsDateClosing(false);
    });
  };

  const [eventForm, setEventForm] = useState<CreateEventForm>({
    name: '',
    organization: '',
    location: '',
    description: '',
    cost: '',
    age_restriction: '',
    reservation: 'no',
    occurrence: 'one-time',
    event_type: EVENT_TYPES[0],
    start_date: '',
    end_date: '',
    start_time: '',
    days_of_the_week: [],
    times: {},
    featured: true,
    link: '',
    images: []
  });

  // Helper function to format time from "HH:MM" string to Date object
  const timeStringToDate = (timeString: string): Date => {
    const date = new Date();
    if (timeString) {
      const [hours, minutes] = timeString.split(':').map(Number);
      date.setHours(hours, minutes, 0, 0);
    } else {
      date.setHours(9, 0, 0, 0); // Default to 9:00 AM
    }
    return date;
  };

  // Helper function to format Date object to "HH:MM" string
  const dateToTimeString = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Image picker functions
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        if (eventForm.images.length < 5) {
          setEventForm({ 
            ...eventForm, 
            images: [...eventForm.images, imageUri] 
          });
        } else {
          Alert.alert('Limit Reached', 'You can upload up to 5 images per event.');
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const removeImage = (index: number) => {
    const newImages = eventForm.images.filter((_, i) => i !== index);
    setEventForm({ ...eventForm, images: newImages });
  };

  // Helper function to format time for display (12-hour format)
  const formatTimeDisplay = (timeString: string): string => {
    if (!timeString) return 'Select time';
    const [hours, minutes] = timeString.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  // Handle date picker change
  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker({ visible: false, type: 'start' });
    }
    
    if (selectedDate && showDatePicker.visible) {
      const dateString = selectedDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
      
      if (showDatePicker.type === 'start') {
        setEventForm({ ...eventForm, start_date: dateString });
      } else {
        setEventForm({ ...eventForm, end_date: dateString });
      }
    }
  };

  // Handle time picker change
  const handleTimeChange = (event: any, selectedDate?: Date) => {
    if (selectedDate && showTimePicker.visible) {
      const timeString = dateToTimeString(selectedDate);
      
      // Handle general start time
      if (showTimePicker.day === 'start_time') {
        setEventForm({ ...eventForm, start_time: timeString });
      } else {
        // Handle weekly event times
        const newTimes = { ...eventForm.times };
        const currentTime = Array.isArray(newTimes[showTimePicker.day]) ? newTimes[showTimePicker.day] : ['', ''];
        
        if (showTimePicker.type === 'start') {
          newTimes[showTimePicker.day] = [timeString, currentTime[1] || ''];
        } else {
          newTimes[showTimePicker.day] = [currentTime[0] || '', timeString];
        }
        
        setEventForm({ ...eventForm, times: newTimes });
      }
    }
    
    // Close picker on Android when a time is selected
    if (Platform.OS === 'android') {
      closeTimePicker();
    }
  };



  const handleCreateEvent = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      // Validate required fields
      if (!eventForm.name.trim()) {
        Alert.alert('Error', 'Event name is required');
        return;
      }
      if (!eventForm.location.trim()) {
        Alert.alert('Error', 'Location is required');
        return;
      }
      if (!eventForm.description.trim()) {
        Alert.alert('Error', 'Description is required');
        return;
      }
      // Validate dates for one-time events
      if (eventForm.occurrence === 'one-time') {
        if (!eventForm.start_date) {
          Alert.alert('Error', 'Start date is required for one-time events');
          return;
        }
        if (!eventForm.start_time) {
          Alert.alert('Error', 'Start time is required for one-time events');
          return;
        }
      }
      // Validate days for weekly events
      if (eventForm.occurrence === 'Weekly' && eventForm.days_of_the_week.length === 0) {
        Alert.alert('Error', 'Please select at least one day for weekly events');
        return;
      }
      // Validate link when reservation is required
      if (eventForm.reservation === 'yes' && !eventForm.link.trim()) {
        Alert.alert('Error', 'Website/Link is required when reservation is needed');
        return;
      }
      // Get current user's email and username using optimized service with caching
      const services = OptimizedComponentServices.getInstance();
      const userResult = await services.getCurrentUser();
      const user = (userResult as any)?.data?.user;
      
      if (!user) {
        Alert.alert('Error', 'You must be logged in to create an event');
        return;
      }
      
      // Get user's username from profiles table using optimized service
      let username = user.email; // fallback to email if username not found
      try {
        const profileResult = await services.getUserByEmail(user.email);
        const profileData = (profileResult as any)?.data;
        
        if (profileData && profileData.username) {
          username = profileData.username;
        }
      } catch (error) {
        console.warn('Could not fetch username, using email as fallback:', error);
      }
      // Get coordinates for location
      let latitude: number | null = null;
      let longitude: number | null = null;
      try {
        const geocodedLocation = await Location.geocodeAsync(eventForm.location);
        if (geocodedLocation && geocodedLocation.length > 0) {
          latitude = geocodedLocation[0].latitude;
          longitude = geocodedLocation[0].longitude;
        }
      } catch (geocodeError) {
        console.warn('Could not geocode location:', geocodeError);
      }
      // --- NEW LOGIC FOR TIMES FIELD ---
      let times = null;
      if (eventForm.occurrence === 'one-time') {
        // Find day of week for start_date
        const date = new Date(eventForm.start_date);
        const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
        // Use start_time and end_time (if provided)
        const startTime = eventForm.start_time;
        // For one-time, let user optionally enter end_time in the UI, or use start_time for both if not present
        let endTime = '';
        if (eventForm.times && eventForm.times[dayOfWeek] && Array.isArray(eventForm.times[dayOfWeek])) {
          endTime = eventForm.times[dayOfWeek][1] || '';
        } else {
          endTime = startTime;
        }
        times = { [dayOfWeek]: [startTime, endTime] };
      } else if (eventForm.occurrence === 'Weekly') {
        times = Object.keys(eventForm.times).length > 0 ? eventForm.times : null;
      }
      // --- END NEW LOGIC ---
      // Prepare event data for insert (remove start_time field)
      const eventData = {
        name: eventForm.name.trim(),
        organization: eventForm.organization.trim(),
        location: eventForm.location.trim(),
        description: eventForm.description.trim(),
        cost: eventForm.cost ? parseFloat(eventForm.cost) : 0,
        age_restriction: eventForm.age_restriction ? parseInt(eventForm.age_restriction) : null,
        reservation: eventForm.reservation,
        occurrence: eventForm.occurrence,
        event_type: [eventForm.event_type],
        start_date: eventForm.occurrence === 'one-time' ? eventForm.start_date : null,
        end_date: eventForm.occurrence === 'one-time' ? eventForm.end_date || eventForm.start_date : null,
        days_of_the_week: eventForm.occurrence === 'Weekly' ? eventForm.days_of_the_week : null,
        times: times,
        featured: eventForm.featured,
        link: eventForm.link.trim() || null,
        latitude,
        longitude,
        posted_by: username,
        created_at: new Date().toISOString()
      };
      // Insert event into Supabase
      const { data, error } = await supabase
        .from('new_events')
        .insert([eventData])
        .select();
      if (error) {
        throw error;
      }
      const eventId = data[0].id;

      // Upload images to Supabase storage if any were selected
      let uploadedImages = 0;
      if (eventForm.images.length > 0) {
        console.log(`Uploading ${eventForm.images.length} images for event ${eventId}`);

        // --- OPTIMIZED: Delete existing images using batched operations ---
        try {
          const existingFilesResult = await services.listFiles('event-images', eventId.toString());
          const existingFiles = (existingFilesResult as any)?.data;
          
          if (existingFiles && existingFiles.length > 0) {
            const filesToDelete = existingFiles.map((file: any) => `${eventId}/${file.name}`);
            await services.deleteFiles('event-images', filesToDelete);
            console.log(`Deleted ${filesToDelete.length} existing images for event ${eventId}`);
          }
        } catch (deleteCatchError) {
          console.warn('Error during optimized image folder cleanup:', deleteCatchError);
        }
        // --- END NEW ---

        // --- OPTIMIZED: Use optimized upload service with built-in retry and fallback logic ---
        const uploadImageToSupabase = async (imageUri: string, imagePath: string): Promise<boolean> => {
          try {
            // Validate the image URI
            if (!imageUri || !imageUri.startsWith('file://')) {
              console.error('Invalid image URI:', imageUri);
              return false;
            }

            // Convert URI to file data for upload service
            const response = await fetch(imageUri);
            const fileData = await response.blob();
            
            const uploadResult = await services.uploadFile('event-images', imagePath, fileData, {
              contentType: 'image/jpeg',
              upsert: true
            });
            
            if ((uploadResult as any)?.error) {
              console.error('Optimized upload failed:', (uploadResult as any).error);
              return false;
            }
            
            console.log('Optimized upload successful:', imagePath);
            return true;
          } catch (error) {
            console.error('Error in optimized uploadImageToSupabase:', error);
            return false;
          }
        };

        for (let i = 0; i < eventForm.images.length; i++) {
          const imageUri = eventForm.images[i];
          const fileName = `${eventId}/${i}.jpg`;
          const success = await uploadImageToSupabase(imageUri, fileName);
          if (success) {
            uploadedImages++;
            console.log(`Successfully uploaded image ${i} for event ${eventId}`);
          } else {
            console.error(`Error uploading image ${i} for event ${eventId}`);
          }
        }
        // --- END REFACTORED ---
      }

      // Create success message based on image upload results
      let successMessage = 'Event created successfully!';
      if (eventForm.images.length > 0) {
        if (uploadedImages === eventForm.images.length) {
          successMessage += ` All ${uploadedImages} images uploaded successfully.`;
        } else if (uploadedImages > 0) {
          successMessage += ` ${uploadedImages} of ${eventForm.images.length} images uploaded successfully.`;
        } else {
          successMessage += ' However, there was an issue uploading the images. You can try adding them later.';
        }
      }



      Alert.alert('Success', successMessage, [
        {
          text: 'OK',
          onPress: () => {
            navigation.goBack();
          }
        }
      ]);

    } catch (error) {
      console.error('Error creating event:', error);
      Alert.alert('Error', 'Failed to create event. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const renderTimeInput = (day: string) => {
    const dayTime = eventForm.times[day];
    const startTime = Array.isArray(dayTime) ? dayTime[0] : '';
    const endTime = Array.isArray(dayTime) ? dayTime[1] : '';

    return (
      <View key={day} style={styles.timeRow}>
        <View style={styles.dayLabelContainer}>
          <Text style={[styles.dayLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
            {day.substring(0, 3)}
          </Text>
        </View>
        
        <View style={styles.timeFieldsContainer}>
          <TouchableOpacity
            style={[styles.timePickerButton, { 
              backgroundColor: Colors[colorScheme ?? 'light'].card,
              borderColor: colorScheme === 'dark' ? '#333' : '#eee'
            }]}
            onPress={() => setShowTimePicker({ visible: true, day, type: 'start' })}
          >
            <Text style={[styles.timePickerText, { 
              color: startTime ? Colors[colorScheme ?? 'light'].text : Colors[colorScheme ?? 'light'].text + '60'
            }]}>
              {formatTimeDisplay(startTime)}
            </Text>
          </TouchableOpacity>
          
          <Text style={[styles.timeSeparator, { color: Colors[colorScheme ?? 'light'].text }]}>to</Text>
          
          <TouchableOpacity
            style={[styles.timePickerButton, { 
              backgroundColor: Colors[colorScheme ?? 'light'].card,
              borderColor: colorScheme === 'dark' ? '#333' : '#eee'
            }]}
            onPress={() => setShowTimePicker({ visible: true, day, type: 'end' })}
          >
            <Text style={[styles.timePickerText, { 
              color: endTime ? Colors[colorScheme ?? 'light'].text : Colors[colorScheme ?? 'light'].text + '60'
            }]}>
              {formatTimeDisplay(endTime)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      <SafeAreaView style={styles.contentSafeArea}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardContainer}
        >

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Simple header that scrolls with content */}
          <View style={styles.simpleHeader}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={28} color="#9E95BD" />
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            {/* Event Name */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Event Name *</Text>
              <TextInput
                style={[styles.formInput, { 
                  color: Colors[colorScheme ?? 'light'].text,
                  backgroundColor: Colors[colorScheme ?? 'light'].card
                }]}
                placeholder="Enter event name"
                placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
                value={eventForm.name}
                onChangeText={(text) => setEventForm({ ...eventForm, name: text })}
              />
            </View>

            {/* Organization */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Organization (Optional)</Text>
              <TextInput
                style={[styles.formInput, { 
                  color: Colors[colorScheme ?? 'light'].text,
                  backgroundColor: Colors[colorScheme ?? 'light'].card
                }]}
                placeholder="Enter organization name"
                placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
                value={eventForm.organization}
                onChangeText={(text) => setEventForm({ ...eventForm, organization: text })}
              />
            </View>

            {/* Location */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Location *</Text>
              <TextInput
                style={[styles.formInput, { 
                  color: Colors[colorScheme ?? 'light'].text,
                  backgroundColor: Colors[colorScheme ?? 'light'].card
                }]}
                placeholder="Enter event location"
                placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
                value={eventForm.location}
                onChangeText={(text) => setEventForm({ ...eventForm, location: text })}
              />
            </View>

            {/* Event Type */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Event Type</Text>
              <View style={styles.pillGrid}>
                {EVENT_TYPES.map((type) => (
                  <GradientPill
                    key={type}
                    text={type}
                    isSelected={eventForm.event_type === type}
                    onPress={() => setEventForm({ ...eventForm, event_type: type })}
                    style={styles.eventTypePill}
                  />
                ))}
              </View>
            </View>

            {/* Occurrence */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Occurrence</Text>
              <View style={styles.rowPills}>
                {['one-time', 'Weekly'].map((type) => (
                  <GradientPill
                    key={type}
                    text={type === 'one-time' ? 'One Time' : type}
                    isSelected={eventForm.occurrence === type}
                    onPress={() => setEventForm({ ...eventForm, occurrence: type as any })}
                    style={styles.occurrencePill}
                  />
                ))}
              </View>
            </View>

            {/* Start Time (for one-time events only) */}
            {eventForm.occurrence === 'one-time' && (
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Start Time</Text>
                <TouchableOpacity
                  style={[styles.timePickerButton, styles.fullWidthTimeButton, { 
                    backgroundColor: Colors[colorScheme ?? 'light'].card,
                    borderColor: colorScheme === 'dark' ? '#333' : '#eee'
                  }]}
                  onPress={() => setShowTimePicker({ visible: true, day: 'start_time', type: 'start' })}
                >
                  <Ionicons name="time-outline" size={20} color={Colors[colorScheme ?? 'light'].text} style={{ marginRight: 10 }} />
                  <Text style={[styles.timePickerText, { 
                    color: eventForm.start_time ? Colors[colorScheme ?? 'light'].text : Colors[colorScheme ?? 'light'].text + '60'
                  }]}>
                    {formatTimeDisplay(eventForm.start_time)}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Days of Week (for Weekly events) */}
            {eventForm.occurrence === 'Weekly' && (
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Days of Week *</Text>
                <LinearGradient
                  colors={['#FF69E2', '#FF3366']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.dayGradientContainer}
                >
                  <View style={styles.dayButtonContainer}>
                    {DAYS_OF_WEEK.map((day) => (
                      <TouchableOpacity
                        key={day}
                        style={[
                          styles.dayCircleButton,
                          eventForm.days_of_the_week.includes(day) && styles.dayCircleButtonSelected
                        ]}
                        onPress={() => {
                          const newDays = eventForm.days_of_the_week.includes(day)
                            ? eventForm.days_of_the_week.filter(d => d !== day)
                            : [...eventForm.days_of_the_week, day];
                          setEventForm({ ...eventForm, days_of_the_week: newDays });
                        }}
                      >
                        <Text
                          style={[
                            styles.dayCircleButtonText,
                            { color: eventForm.days_of_the_week.includes(day) ? '#F45B5B' : 'white' }
                          ]}
                        >
                          {day.slice(0, 1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </LinearGradient>
              </View>
            )}

            {/* Times (for Weekly events) */}
            {eventForm.occurrence === 'Weekly' && (
              <View style={styles.formGroup}>
                {eventForm.days_of_the_week.map(renderTimeInput)}
              </View>
            )}

            {/* Start Date (for one-time events) */}
            {eventForm.occurrence === 'one-time' && (
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Start Date *</Text>
                <TouchableOpacity
                  style={[styles.datePickerButton, { 
                    backgroundColor: Colors[colorScheme ?? 'light'].card,
                    borderColor: colorScheme === 'dark' ? '#333' : '#eee'
                  }]}
                  onPress={() => setShowDatePicker({ visible: true, type: 'start' })}
                >
                  <Ionicons name="calendar-outline" size={20} color={Colors[colorScheme ?? 'light'].text} style={{ marginRight: 10 }} />
                  <Text style={[styles.datePickerText, { 
                    color: eventForm.start_date ? Colors[colorScheme ?? 'light'].text : Colors[colorScheme ?? 'light'].text + '60'
                  }]}>
                    {eventForm.start_date || 'Select start date'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* End Date (for one-time events, optional) */}
            {eventForm.occurrence === 'one-time' && (
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: Colors[colorScheme ?? 'light'].text }]}>End Date (Optional)</Text>
                <TouchableOpacity
                  style={[styles.datePickerButton, { 
                    backgroundColor: Colors[colorScheme ?? 'light'].card,
                    borderColor: colorScheme === 'dark' ? '#333' : '#eee'
                  }]}
                  onPress={() => setShowDatePicker({ visible: true, type: 'end' })}
                >
                  <Ionicons name="calendar-outline" size={20} color={Colors[colorScheme ?? 'light'].text} style={{ marginRight: 10 }} />
                  <Text style={[styles.datePickerText, { 
                    color: eventForm.end_date ? Colors[colorScheme ?? 'light'].text : Colors[colorScheme ?? 'light'].text + '60'
                  }]}>
                    {eventForm.end_date || 'Select end date'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Cost */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Cost (Leave empty for free)</Text>
              <TextInput
                style={[styles.formInput, { 
                  color: Colors[colorScheme ?? 'light'].text,
                  backgroundColor: Colors[colorScheme ?? 'light'].card
                }]}
                placeholder="0.00"
                placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
                value={eventForm.cost}
                onChangeText={(text) => setEventForm({ ...eventForm, cost: text })}
                keyboardType="numeric"
              />
            </View>

            {/* Age Restriction */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Age Restriction (Minimum age)</Text>
              <TextInput
                style={[styles.formInput, { 
                  color: Colors[colorScheme ?? 'light'].text,
                  backgroundColor: Colors[colorScheme ?? 'light'].card
                }]}
                placeholder="18"
                placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
                value={eventForm.age_restriction}
                onChangeText={(text) => setEventForm({ ...eventForm, age_restriction: text })}
                keyboardType="numeric"
              />
            </View>

            {/* Reservation Required */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Reservation Required</Text>
              <View style={styles.rowPills}>
                <GradientPill
                  text="No"
                  isSelected={eventForm.reservation === 'no'}
                  onPress={() => setEventForm({ ...eventForm, reservation: 'no' })}
                  style={styles.reservationPill}
                />
                <GradientPill
                  text="Yes"
                  isSelected={eventForm.reservation === 'yes'}
                  onPress={() => setEventForm({ ...eventForm, reservation: 'yes' })}
                  style={styles.reservationPill}
                />
              </View>
            </View>

            {/* Link */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                Website/Link{eventForm.reservation === 'yes' ? ' *' : ''}
              </Text>
              <TextInput
                style={[styles.formInput, { 
                  color: Colors[colorScheme ?? 'light'].text,
                  backgroundColor: Colors[colorScheme ?? 'light'].card
                }]}
                placeholder="https://example.com"
                placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
                value={eventForm.link}
                onChangeText={(text) => setEventForm({ ...eventForm, link: text })}
                keyboardType="url"
              />
            </View>

            {/* Event Images */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Event Images</Text>
              <Text style={[styles.formSubLabel, { color: Colors[colorScheme ?? 'light'].text + '80' }]}>
                Upload up to 5 images to showcase your event
              </Text>
              
              <View style={styles.imageUploadContainer}>
                {/* Image Grid */}
                <View style={styles.imageGrid}>
                  {eventForm.images.map((imageUri, index) => (
                    <View key={index} style={styles.imagePreviewContainer}>
                      <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => removeImage(index)}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={['#ff4444', '#ff6666']}
                          style={styles.removeImageGradient}
                        >
                          <Ionicons name="close" size={14} color="white" />
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  ))}
                  
                  {/* Add Image Button */}
                  {eventForm.images.length < 5 && (
                    <TouchableOpacity
                      style={[styles.addImageButton, { 
                        backgroundColor: Colors[colorScheme ?? 'light'].card,
                        borderColor: colorScheme === 'dark' ? '#333' : '#ddd'
                      }]}
                      onPress={pickImage}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['#9E95BD', '#B97AFF', '#9E95BD']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.addImageGradient}
                      >
                        <Ionicons name="camera" size={24} color="white" />
                        <Text style={styles.addImageText}>Add Photo</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>
                
                {/* Upload Tips */}
                <View style={styles.uploadTips}>
                  <View style={styles.tipRow}>
                    <Ionicons name="information-circle-outline" size={16} color="#9E95BD" />
                    <Text style={[styles.tipText, { color: Colors[colorScheme ?? 'light'].text + '70' }]}>
                      High-quality images help attract more participants
                    </Text>
                  </View>
                  <View style={styles.tipRow}>
                    <Ionicons name="image-outline" size={16} color="#9E95BD" />
                    <Text style={[styles.tipText, { color: Colors[colorScheme ?? 'light'].text + '70' }]}>
                      Recommended size: 1200×675 pixels (16:9 ratio)
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Description */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Description *</Text>
              <TextInput
                style={[styles.formTextArea, { 
                  color: Colors[colorScheme ?? 'light'].text,
                  backgroundColor: Colors[colorScheme ?? 'light'].card
                }]}
                placeholder="Describe your event..."
                placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
                value={eventForm.description}
                onChangeText={(text) => setEventForm({ ...eventForm, description: text })}
                multiline
                numberOfLines={4}
              />
            </View>



            {/* Create Button */}
            <TouchableOpacity 
              style={styles.createButton}
              onPress={handleCreateEvent}
              disabled={isCreating}
            >
              <LinearGradient
                colors={['#FF69E2', '#FF3366']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.createButtonGradient}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="add" size={24} color="#fff" style={styles.buttonIcon} />
                    <Text style={styles.createButtonText}>Create Event</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Time Picker */}
      {(showTimePicker.visible || isClosing) && (
        <>
          {Platform.OS === 'ios' ? (
            <Animated.View 
              style={[
                styles.timePickerOverlay,
                {
                  opacity: fadeAnim,
                }
              ]}
            >
              <TouchableOpacity 
                style={styles.timePickerBackdrop}
                activeOpacity={1}
                onPress={closeTimePicker}
              />
              <Animated.View 
                style={[
                  styles.timePickerContainer,
                  {
                    transform: [
                      { translateY: slideAnim },
                      { scale: scaleAnim }
                    ]
                  }
                ]}
              >
                <LinearGradient
                  colors={['#FF69E2', '#FF3366']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.timePickerHeaderGradient}
                >
                  <View style={styles.timePickerHeaderContent}>
                    <View style={styles.timePickerTitleContainer}>
                      <Text style={styles.timePickerMainTitle}>
                        {showTimePicker.day === 'start_time' 
                          ? 'Event Start Time' 
                          : showTimePicker.type === 'start' ? 'Start Time' : 'End Time'
                        }
                      </Text>
                      <Text style={styles.timePickerSubtitle}>
                        {showTimePicker.day === 'start_time' 
                          ? 'When does your event begin?' 
                          : showTimePicker.day
                        }
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.timePickerCloseButton}
                      onPress={closeTimePicker}
                    >
                      <View style={styles.timePickerCloseButtonInner}>
                        <Ionicons name="close" size={20} color="#FF0005" />
                      </View>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
                
                <View style={[styles.timePickerContent, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
                  <View style={styles.timePickerSection}>
                    <DateTimePicker
                      value={timeStringToDate(
                        showTimePicker.day === 'start_time' 
                          ? eventForm.start_time
                          : showTimePicker.type === 'start' 
                            ? (Array.isArray(eventForm.times[showTimePicker.day]) ? eventForm.times[showTimePicker.day][0] : '') 
                            : (Array.isArray(eventForm.times[showTimePicker.day]) ? eventForm.times[showTimePicker.day][1] : '')
                      )}
                      mode="time"
                      is24Hour={false}
                      onChange={handleTimeChange}
                      style={styles.timePicker}
                      textColor={Colors[colorScheme ?? 'light'].text}
                    />
                  </View>
                  
                  <View style={styles.timePickerActions}>
                    <TouchableOpacity 
                      style={styles.timePickerConfirmButton}
                      onPress={closeTimePicker}
                    >
                      <LinearGradient
                        colors={['#FF69E2', '#FF3366']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.timePickerConfirmGradient}
                      >
                        <Ionicons name="checkmark" size={20} color="white" style={{ marginRight: 8 }} />
                        <Text style={styles.timePickerConfirmText}>Confirm</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
            </Animated.View>
          ) : (
            <DateTimePicker
              value={timeStringToDate(
                showTimePicker.day === 'start_time' 
                  ? eventForm.start_time
                  : showTimePicker.type === 'start' 
                    ? (Array.isArray(eventForm.times[showTimePicker.day]) ? eventForm.times[showTimePicker.day][0] : '') 
                    : (Array.isArray(eventForm.times[showTimePicker.day]) ? eventForm.times[showTimePicker.day][1] : '')
              )}
              mode="time"
              is24Hour={false}
              onChange={handleTimeChange}
            />
          )}
        </>
      )}

      {/* Date Picker */}
      {(showDatePicker.visible || isDateClosing) && (
        <>
          {Platform.OS === 'ios' ? (
            <Animated.View 
              style={[
                styles.timePickerOverlay,
                {
                  opacity: dateFadeAnim,
                }
              ]}
            >
              <TouchableOpacity 
                style={styles.timePickerBackdrop}
                activeOpacity={1}
                onPress={closeDatePicker}
              />
              <Animated.View 
                style={[
                  styles.timePickerContainer,
                  {
                    transform: [
                      { translateY: dateSlideAnim },
                      { scale: dateScaleAnim }
                    ]
                  }
                ]}
              >
                <LinearGradient
                  colors={['#FF69E2', '#FF3366']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.timePickerHeaderGradient}
                >
                  <View style={styles.timePickerHeaderContent}>
                    <View style={styles.timePickerTitleContainer}>
                      <Text style={styles.timePickerMainTitle}>
                        {showDatePicker.type === 'start' ? 'Start Date' : 'End Date'}
                      </Text>
                      <Text style={styles.timePickerSubtitle}>
                        {showDatePicker.type === 'start' ? 'When does your event start?' : 'When does your event end?'}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.timePickerCloseButton}
                      onPress={closeDatePicker}
                    >
                      <View style={styles.timePickerCloseButtonInner}>
                        <Ionicons name="close" size={20} color="#FF0005" />
                      </View>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
                
                <View style={[styles.timePickerContent, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
                  <View style={styles.timePickerSection}>
                    <DateTimePicker
                      value={showDatePicker.type === 'start' 
                        ? (eventForm.start_date ? new Date(eventForm.start_date) : new Date())
                        : (eventForm.end_date ? new Date(eventForm.end_date) : new Date())
                      }
                      mode="date"
                      onChange={handleDateChange}
                      style={styles.timePicker}
                      textColor={Colors[colorScheme ?? 'light'].text}
                    />
                  </View>
                  
                  <View style={styles.timePickerActions}>
                    <TouchableOpacity 
                      style={styles.timePickerConfirmButton}
                      onPress={closeDatePicker}
                    >
                      <LinearGradient
                        colors={['#FF69E2', '#FF3366']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.timePickerConfirmGradient}
                      >
                        <Ionicons name="checkmark" size={20} color="white" style={{ marginRight: 8 }} />
                        <Text style={styles.timePickerConfirmText}>Confirm</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
            </Animated.View>
          ) : (
            <DateTimePicker
              value={showDatePicker.type === 'start' 
                ? (eventForm.start_date ? new Date(eventForm.start_date) : new Date())
                : (eventForm.end_date ? new Date(eventForm.end_date) : new Date())
              }
              mode="date"
              onChange={handleDateChange}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  simpleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginBottom: 10,
  },
  // New Header Styles
  headerGradient: {
    paddingTop: 0,
    paddingBottom: 25,
    paddingHorizontal: 0,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 12,
  },
  headerSafeArea: {
    flex: 1,
  },
  contentSafeArea: {
    flex: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(158, 149, 189, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 20,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleIconContainer: {
    marginRight: 12,
    opacity: 0.9,
  },
  titleTextContainer: {
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    letterSpacing: 0.3,
  },
  headerRightSpace: {
    width: 44, // Same width as back button for balance
  },
  headerDecorations: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  decorativeCircle: {
    position: 'absolute',
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  decorativeCircle1: {
    width: 100,
    height: 100,
    top: -30,
    right: -20,
  },
  decorativeCircle2: {
    width: 60,
    height: 60,
    top: 10,
    left: -15,
  },
  decorativeCircle3: {
    width: 40,
    height: 40,
    bottom: -10,
    right: 60,
  },
  
  // Legacy styles (keeping for compatibility)
  topButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },

  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  form: {
    padding: 20,
    paddingTop: 20,
  },
  formGroup: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  formInput: {
    width: '100%',
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
  },
  formTextArea: {
    width: '100%',
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    height: 120,
    textAlignVertical: 'top',
  },
  
  // Pill Components
  pillContainer: {
    marginBottom: 8,
    marginRight: 8,
  },
  gradientPill: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    flexShrink: 0,
  },
  selectedPillText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
  unselectedPill: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 36,
    flexShrink: 0,
  },
  unselectedPillText: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 16,
  },
  
  // Layout Grids
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  eventTypePill: {
    // Individual pill styling handled by pillContainer
  },
  rowPills: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  occurrencePill: {
    flex: 1,
  },
  reservationPill: {
    flex: 1,
  },
  
  // Days of Week
  dayGradientContainer: {
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 15,
    marginTop: 10,
    alignItems: 'center',
    overflow: 'hidden',
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
  
  // Time Input
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 8,
  },
  dayLabelContainer: {
    width: 80,
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  timeFieldsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  timePickerButton: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
    minHeight: 44,
  },
  timePickerText: {
    fontSize: 15,
    fontWeight: '500',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 44,
  },
  datePickerText: {
    fontSize: 15,
    fontWeight: '500',
  },
  fullWidthTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  timeSeparator: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.7,
  },

  
  // Create Button
  createButton: {
    marginTop: 20,
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  buttonIcon: {
    marginRight: 8,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  // Time Picker Modal
  timePickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  timePickerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  timePickerContainer: {
    marginHorizontal: 20,
    marginBottom: 40,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  timePickerHeaderGradient: {
    paddingVertical: 20,
    paddingHorizontal: 25,
  },
  timePickerHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timePickerTitleContainer: {
    flex: 1,
  },
  timePickerMainTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  timePickerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  timePickerCloseButton: {
    padding: 4,
  },
  timePickerCloseButtonInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timePickerContent: {
    paddingVertical: 30,
    paddingHorizontal: 25,
  },
  timePickerSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  timePickerActions: {
    width: '100%',
  },
  timePickerConfirmButton: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#FF0005',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  timePickerConfirmGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  timePickerConfirmText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  timePicker: {
    height: 200,
    width: 280,
  },
  
  // Image Upload Styles
  formSubLabel: {
    fontSize: 14,
    marginBottom: 16,
    opacity: 0.8,
  },
  imageUploadContainer: {
    marginTop: 8,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  imagePreviewContainer: {
    position: 'relative',
    width: 100,
    height: 75,
  },
  imagePreview: {
    width: 100,
    height: 75,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    zIndex: 1,
  },
  removeImageGradient: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addImageButton: {
    width: 100,
    height: 75,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  addImageGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addImageText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  uploadTips: {
    marginTop: 16,
    gap: 8,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tipText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  section: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.7)',
  },
  reminderToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 12,
    marginBottom: 16,
  },
  reminderToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reminderToggleText: {
    flex: 1,
  },
  reminderToggleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  reminderToggleSubtitle: {
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.7)',
  },
  reminderToggleSwitch: {
    width: 40,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderToggleSwitchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'white',
  },
  reminderOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  reminderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 12,
  },
  reminderOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reminderOptionText: {
    fontSize: 14,
    marginLeft: 8,
  },
  reminderOptionCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
}); 