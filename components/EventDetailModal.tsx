import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  Animated,
  Easing,
  TouchableOpacity,
  ScrollView,
  Linking,
  Share,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  SafeAreaView,
  Platform,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { EventCard } from '../lib/GlobalDataManager';
import GlobalDataManager from '../lib/GlobalDataManager';
import { supabase } from '@/lib/supabase';
import UserProfileModal from './UserProfileModal';
import OptimizedComponentServices from '@/lib/OptimizedComponentServices';
import * as ImagePicker from 'expo-image-picker';


const { width, height } = Dimensions.get('window');

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

// Helper function to check if an event is expiring soon
const isEventExpiringSoon = (event: EventCard): boolean => {
  if (!event || event.occurrence === 'Weekly') {
    return false; // Weekly events don't expire
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  // Check start_date or end_date for one-time events
  const eventDate = event.end_date || event.start_date;
  if (eventDate) {
    try {
      const eventDateTime = new Date(eventDate);
      const eventDateOnly = new Date(eventDateTime.getFullYear(), eventDateTime.getMonth(), eventDateTime.getDate());
      
      // Event is expiring soon if it's happening within the next 7 days
      return eventDateOnly >= today && eventDateOnly <= nextWeek;
    } catch (error) {
      console.error('Error parsing event date:', error);
      return false;
    }
  }

  return false;
};

interface CardPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface EventDetailModalProps {
  event: EventCard | null;
  visible: boolean;
  onClose: () => void;
  userLocation: { latitude: number; longitude: number } | null;
  cardPosition?: CardPosition | null;
}

export default function EventDetailModal({ event, visible, onClose, userLocation, cardPosition }: EventDetailModalProps) {
  const colorScheme = useColorScheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [isClosing, setIsClosing] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedEvent, setEditedEvent] = useState<any>(null);
  
  // Image management state
  const [eventImages, setEventImages] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Time picker state


  
  // Creator profile modal state
  const [userProfileModalVisible, setUserProfileModalVisible] = useState(false);
  const [creatorInfo, setCreatorInfo] = useState<{
    id: number;
    name: string;
    email: string;
    username?: string;
  } | null>(null);
  const [creatorLoading, setCreatorLoading] = useState(false);

  // Like/Save state
  const [isLiked, setIsLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const dataManager = GlobalDataManager.getInstance();



  // Check if event is already saved when modal opens and initialize edit mode
  useEffect(() => {
    const checkEventData = async () => {
      if (!event?.id) return;
      
      try {
        // Check if event is saved
        const savedEvents = await dataManager.getSavedEvents();
        const isEventSaved = savedEvents.some(savedEvent => savedEvent.id === event.id);
        setIsLiked(isEventSaved);

        // Check if this is edit mode (from My Events modal)
        if ((event as any).isEditMode) {
          setIsEditMode(true);
          // Initialize edited event data with safe defaults
          setEditedEvent({
            name: event.name || '',
            organization: event.organization || '',
            location: event.location || '',
            cost: event.cost || 0,
            age_restriction: event.age_restriction || null,
            reservation: event.reservation || 'no',
            description: event.description || '',
            start_date: event.start_date || '',
            end_date: event.end_date || '',
            occurrence: event.occurrence || '',
            latitude: event.latitude || 0,
            longitude: event.longitude || 0,
            days_of_the_week: event.days_of_the_week || [],
            event_type: event.event_type || '',
            link: event.link || '',
            times: event.times || {},
            featured: event.featured || false
          });
        } else {
          setIsEditMode(false);
        }
      } catch (error) {
        console.error('Error checking event data:', error);
      }
    };

    if (visible && event) {
      checkEventData();
      loadEventImages();
    }
  }, [visible, event, dataManager]);

  // Reset edit mode when modal closes
  useEffect(() => {
    if (!visible) {
      setIsEditMode(false);
      setEditedEvent(null);
      setIsEditing(false);
    }
  }, [visible]);



  // Function to handle like/unlike
  const handleLike = async () => {
    if (!event?.id || likeLoading) return;

    setLikeLoading(true);
    try {
      if (isLiked) {
        // Unlike the event (remove from saved events)
        await dataManager.removeEventFromSavedEvents(event.id);
        setIsLiked(false);
        console.log('✅ Event unliked:', event.id);
      } else {
        // Like the event (add to saved events)
        await dataManager.addEventToSavedEvents(event.id);
        setIsLiked(true);
        console.log('✅ Event liked:', event.id);
        
        // Refresh data to ensure everything is in sync
        await GlobalDataManager.getInstance().refreshAllData();
      }
    } catch (error) {
      console.error('Error toggling like status:', error);
    } finally {
      setLikeLoading(false);
    }
  };

  // Function to handle field updates
  const handleFieldUpdate = (field: string, value: any) => {
    setEditedEvent((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  // Function to save edited event
  const handleSaveEvent = async () => {
    if (!event?.id || !editedEvent) return;

    // Validate time formats before saving
    if (editedEvent.times) {
      for (const [day, dayTimes] of Object.entries(editedEvent.times)) {
        if (Array.isArray(dayTimes)) {
          const [startTime, endTime] = dayTimes;
          
          if (startTime && !validateTimeFormat(startTime)) {
            Alert.alert('Invalid Time Format', `Start time for ${day} must be in HH:MM format (e.g., 09:30, 14:00)`);
            return;
          }
          
          if (endTime && !validateTimeFormat(endTime)) {
            Alert.alert('Invalid Time Format', `End time for ${day} must be in HH:MM format (e.g., 09:30, 14:00)`);
            return;
          }
        }
      }
    }

    setIsEditing(true);
    try {
      const services = OptimizedComponentServices.getInstance();
      
      // Update the event in the database
      await services.updateEvent(event.id, editedEvent);
      
      // Update the local event object
      Object.assign(event, editedEvent);
      
      // Show success message and close modal
      Alert.alert('Success', 'Event updated successfully!');
      
      // Close the modal immediately
      onClose();
      
    } catch (error) {
      console.error('Error updating event:', error);
      Alert.alert('Error', 'Failed to update event. Please try again.');
    } finally {
      setIsEditing(false);
    }
  };



  // Helper function to validate time input format HH:MM
  const validateTimeFormat = (input: string): boolean => {
    if (!input) return true; // Empty input is valid (optional field)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(input);
  };

  // Image management functions - using proven code from CreateEventScreen
  const loadEventImages = async () => {
    if (!event?.id) return;
    
    try {
      // Use direct Supabase call to debug the issue
      const { data: files, error } = await supabase.storage
        .from('event-images')
        .list(event.id.toString());
      
      if (error) {
        console.error('Error listing files:', error);
        return;
      }
      
      console.log('Found files for event:', event.id, files);
      
      if (!files || files.length === 0) {
        console.log('No files found in directory:', event.id.toString());
        setEventImages([]);
        return;
      }
      
      // Get public URLs for all images
      const imageUrls = await Promise.all(
        files.map(async (file: any) => {
          try {
            const { data } = supabase.storage
              .from('event-images')
              .getPublicUrl(`${event.id}/${file.name}`);
            
            const publicUrl = data.publicUrl;
            console.log('Image URL for', file.name, ':', publicUrl);
            return publicUrl;
          } catch (error) {
            console.error('Error getting URL for', file.name, ':', error);
            return null;
          }
        })
      );
      
      // Filter out null URLs and set state
      const validUrls = imageUrls.filter((url): url is string => url !== null && url !== '');
      console.log('Setting event images:', validUrls);
      setEventImages(validUrls);
    } catch (error) {
      console.error('Error loading event images:', error);
    }
  };

  const pickImage = async () => {
    if (!event?.id) return;
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        console.log('Current eventImages.length:', eventImages.length);
        console.log('Current eventImages:', eventImages);
        
        if (eventImages.length < 5) {
          await uploadImage(imageUri);
        } else {
          Alert.alert('Limit Reached', `You can upload up to 5 images per event. Current count: ${eventImages.length}`);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const uploadImage = async (imageUri: string) => {
    if (!event?.id) return;
    
    setIsUploadingImage(true);
    try {
      // Get current image count to determine filename
      const currentImages = eventImages.length;
      const fileName = `${currentImages}.jpg`;
      const filePath = `${event.id}/${fileName}`;
      
      // Use the same upload logic as EditImages.tsx
      const uploadImageToSupabase = async (imageUri: string, imagePath: string): Promise<boolean> => {
        try {
          console.log('Starting upload for:', imagePath);
          console.log('Image URI:', imageUri);
          
          // Validate the image URI
          if (!imageUri || !imageUri.startsWith('file://')) {
            console.error('Invalid image URI:', imageUri);
            return false;
          }

          // Simple direct upload using FormData (React Native standard) - same as EditImages.tsx
          console.log('📤 Uploading with FormData...');
          const formData = new FormData();
          formData.append('file', {
            uri: imageUri,
            type: 'image/jpeg',
            name: imagePath.split('/').pop() || 'image.jpg',
          } as any);

          const { data, error } = await supabase.storage
            .from('event-images')
            .upload(imagePath, formData, {
              contentType: 'image/jpeg',
              upsert: true,
            });

          if (error) {
            console.error('Upload failed:', error);
            return false;
          }

          console.log('✅ Upload successful:', data);
          return true;
        } catch (error) {
          console.error('Error in uploadImageToSupabase:', error);
          return false;
        }
      };

      const success = await uploadImageToSupabase(imageUri, filePath);
      
      if (success) {
        // Reload all images to ensure we have the latest state
        await loadEventImages();
        Alert.alert('Success', 'Image uploaded successfully!');
      } else {
        Alert.alert('Error', 'Failed to upload image. Please try again.');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const removeImage = async (index: number) => {
    if (!event?.id) return;
    
    try {
      const services = OptimizedComponentServices.getInstance();
      const fileName = `${index}.jpg`;
      const filePath = `${event.id}/${fileName}`;
      
      // Delete from storage
      await services.deleteFile('event-images', filePath);
      
      // Reload all images to ensure we have the latest state
      await loadEventImages();
      
      Alert.alert('Success', 'Image removed successfully!');
    } catch (error) {
      console.error('Error removing image:', error);
      Alert.alert('Error', 'Failed to remove image. Please try again.');
    }
  };

  // Function to clean up orphaned images and reset the count
  const cleanupOrphanedImages = async () => {
    if (!event?.id) return;
    
    try {
      console.log('🧹 Cleaning up orphaned images...');
      
      // Get all files in the event directory
      const { data: files, error } = await supabase.storage
        .from('event-images')
        .list(event.id.toString());
      
      if (error) {
        console.error('Error listing files for cleanup:', error);
        return;
      }
      
      console.log('Found files for cleanup:', files);
      
      if (!files || files.length === 0) {
        console.log('No files to clean up');
        return;
      }
      
      // Delete all files in the directory
      const filesToDelete = files.map((file: any) => `${event.id}/${file.name}`);
      const { error: deleteError } = await supabase.storage
        .from('event-images')
        .remove(filesToDelete);
      
      if (deleteError) {
        console.error('Error deleting files during cleanup:', deleteError);
        return;
      }
      
      console.log('✅ Cleanup completed, deleted', filesToDelete.length, 'files');
      
      // Reset the eventImages state
      setEventImages([]);
      
      Alert.alert('Cleanup Complete', `Removed ${filesToDelete.length} orphaned images. You can now upload fresh images.`);
    } catch (error) {
      console.error('Error during cleanup:', error);
      Alert.alert('Error', 'Failed to cleanup images. Please try again.');
    }
  };





  // Helper function to get current day name
  const getCurrentDayName = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  };

  // Helper function to format opening hours
  const formatOpeningHours = (times: { [key: string]: string | [string, string] } | undefined) => {
    if (!times || Object.keys(times).length === 0) {
      return { display: 'Hours not available', status: null };
    }

    const currentDay = getCurrentDayName();
    const todayHours = times[currentDay];

    if (!todayHours) {
      return { display: 'Closed today', status: 'closed' };
    }

    if (todayHours === 'all_day') {
      return { display: 'Open 24 hours', status: 'open_24h' };
    }

    if (Array.isArray(todayHours) && todayHours.length === 2) {
      const [openTime, closeTime] = todayHours;
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes(); // Current time in minutes

      // Parse open and close times
      const parseTime = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
      };

      const openMinutes = parseTime(openTime);
      const closeMinutes = parseTime(closeTime);

      // Check if currently open
      let isOpen = false;
      if (closeMinutes > openMinutes) {
        // Normal hours (e.g., 9:00 - 17:00)
        isOpen = currentTime >= openMinutes && currentTime < closeMinutes;
      } else {
        // Overnight hours (e.g., 22:00 - 2:00)
        isOpen = currentTime >= openMinutes || currentTime < closeMinutes;
      }

      const formatTime = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
      };

      const status = isOpen ? 'open' : 'closed';
      const statusText = isOpen ? `Open until ${formatTime(closeTime)}` : `Closed • Opens ${formatTime(openTime)}`;
      
      return {
        display: `${formatTime(openTime)} - ${formatTime(closeTime)}`,
        status,
        statusText
      };
    }

    return { display: 'Hours not available', status: null };
  };

  // Helper function to get all week hours for display
  const getWeeklyHours = (times: { [key: string]: string | [string, string] } | undefined) => {
    if (!times || Object.keys(times).length === 0) {
      return [];
    }

    const formatTime = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    return DAYS_OF_WEEK.map(day => {
      const dayHours = times[day];
      let hoursText = 'Closed';
      
      if (dayHours === 'all_day') {
        hoursText = 'Open 24 hours';
      } else if (Array.isArray(dayHours) && dayHours.length === 2) {
        hoursText = `${formatTime(dayHours[0])} - ${formatTime(dayHours[1])}`;
      }
      
      return { day, hours: hoursText };
    });
  };
  
  // Simplified animation values for better performance
  const expandScale = useRef(new Animated.Value(0.3)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current; // Separate overlay opacity
  const imageControlsOpacity = useRef(new Animated.Value(0)).current; // Image controls animation

  // Reset current image index when event changes
  useEffect(() => {
    if (event) {
      setCurrentImageIndex(0);
      
      // Defer heavy operations until after animation to prevent stuttering
      const timer = setTimeout(() => {
        // Determine actual image count
        determineActualImageCount();
        // Always fetch fresh creator info instead of using cached data
        if (event.posted_by_email) {
          console.log('🔄 Fetching fresh creator info using email...');
          fetchCreatorInfo(event.posted_by_email);
        } else if (event.posted_by) {
          console.log('🔄 Fetching fresh creator info using posted_by...');
          fetchCreatorInfo(event.posted_by);
        } else {
          setCreatorInfo(null);
        }
      }, 100); // Small delay to let animation start smoothly
      
      return () => clearTimeout(timer);
    }
  }, [event]);

  // Comprehensive animation cleanup on component unmount
  useEffect(() => {
    return () => {
      // Stop all animations to prevent memory leaks
      console.log('🧹 EventDetailModal: Cleaning up animations');
      
      // Stop all animated values
      fadeAnim.stopAnimation();
      expandScale.stopAnimation();
      translateX.stopAnimation();
      translateY.stopAnimation();
      contentOpacity.stopAnimation();
      overlayOpacity.stopAnimation();
      imageControlsOpacity.stopAnimation();
      
      // Reset animation states
      setIsClosing(false);
    };
  }, []);

  // Function to fetch creator information
  const fetchCreatorInfo = async (creatorIdentifier: string) => {
    setCreatorLoading(true);
    try {
      console.log('🔍 Fetching creator info for:', creatorIdentifier);
      
      // Check if the identifier looks like an email
      const isEmail = creatorIdentifier.includes('@');
      
      if (isEmail) {
        // If it's an email, search by email first
        console.log('Identifier appears to be an email, searching by email...');
        const { data: emailData, error: emailError } = await supabase
          .from('all_users')
          .select('id, name, email, username')
          .eq('email', creatorIdentifier)
          .single();
        
        if (emailError) {
          console.log('⚠️ Creator not found by email. Creator may have been deleted or email is invalid:', creatorIdentifier);
          setCreatorInfo(null);
        } else {
          console.log('✅ Creator found by email:', emailData);
          setCreatorInfo(emailData);
        }
      } else {
        // If it's not an email, try by username first, then by email
        console.log('Identifier appears to be a username, searching by username first...');
        let { data, error } = await supabase
          .from('all_users')
          .select('id, name, email, username')
          .eq('username', creatorIdentifier)
          .single();

        // If not found by username, try by email (in case it's an old format)
        if (error && error.code === 'PGRST116') {
          console.log('Creator not found by username, trying email...');
          const { data: emailData, error: emailError } = await supabase
            .from('all_users')
            .select('id, name, email, username')
            .eq('email', creatorIdentifier)
            .single();
          
          if (emailError) {
            console.log('⚠️ Creator not found by email either. Creator may have been deleted or identifier is invalid:', creatorIdentifier);
            setCreatorInfo(null);
          } else {
            console.log('✅ Creator found by email:', emailData);
            setCreatorInfo(emailData);
          }
        } else if (error) {
          console.error('❌ Error fetching creator info by username:', error);
          setCreatorInfo(null);
        } else {
          console.log('✅ Creator found by username:', data);
          setCreatorInfo(data);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching creator info:', error);
      setCreatorInfo(null);
    } finally {
      setCreatorLoading(false);
    }
  };

  // Handle creator profile click
  const handleCreatorClick = () => {
    if (creatorInfo) {
      setUserProfileModalVisible(true);
    }
  };

  // Function to refresh creator info
  const refreshCreatorInfo = useCallback(async () => {
    if (event?.posted_by_email) {
      console.log('🔄 Refreshing creator info for email:', event.posted_by_email);
      await fetchCreatorInfo(event.posted_by_email);
    } else if (event?.posted_by) {
      console.log('🔄 Refreshing creator info for posted_by:', event.posted_by);
      await fetchCreatorInfo(event.posted_by);
    }
  }, [event?.posted_by_email, event?.posted_by]);



  // Function to check if an image exists at a given index
  const checkImageExists = async (index: number): Promise<boolean> => {
    if (!event?.id) return false;
    
    try {
      const imageUrl = `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/event-images/${event.id}/${index}.jpg`;
      const response = await fetch(imageUrl, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      return false;
    }
  };

  // State to track the actual number of images
  const [actualImageCount, setActualImageCount] = useState(1);

  // Function to determine how many images actually exist
  const determineActualImageCount = async () => {
    if (!event || !event.id) {
      setActualImageCount(0);
      return;
    }
    
    // If allImages array is available, check which ones actually exist
    if (event.allImages && event.allImages.length > 0) {
      let actualCount = 0;
      
      // Check each image in the allImages array to see if it actually exists
      for (let i = 0; i < event.allImages.length; i++) {
        try {
          const response = await fetch(event.allImages[i], { method: 'HEAD' });
          if (response.ok) {
            actualCount = i + 1; // Count is 1-based
          } else {
            break; // Stop at first missing image
          }
        } catch (error) {
          break; // Stop at first error
        }
      }
      
      setActualImageCount(actualCount);
      return;
    }
    
    // If there's a main image, start with 1 and check for additional images
    if (event.image) {
      let count = 1;
      
      // Check for additional images (up to 5 to be reasonable)
      for (let i = 1; i <= 5; i++) {
        const exists = await checkImageExists(i);
        if (exists) {
          count = i + 1;
        } else {
          break; // Stop when we find the first missing image
        }
      }
      
      setActualImageCount(count);
    } else {
      setActualImageCount(0);
    }
  };

  // Get current image URL (synchronous version for immediate use)
  const getCurrentImageUrl = () => {
    if (!event?.id || currentImageIndex === -1) return event?.image || null;
    
    // If currentImageIndex is beyond the actual count, fall back to main image
    if (currentImageIndex >= actualImageCount) {
      return event.image || null;
    }
    
    // If event has allImages array, use it
    if (event.allImages && event.allImages.length > 0) {
      return event.allImages[currentImageIndex] || event.allImages[0];
    }
    
    // For index 0, return the main image
    if (currentImageIndex === 0) {
      return event.image || null;
    }
    
    // Fallback: construct URL using current index (only if it's within actual count)
    return `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/event-images/${event.id}/${currentImageIndex}.jpg`;
  };

  // Helper function to get the actual number of available images
  const getActualImageCount = () => {
    return actualImageCount;
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    if (!event) return;
    
    const totalImages = getActualImageCount();
    
    // Don't navigate if there's only one image
    if (totalImages <= 1) return;
    
    setCurrentImageIndex(prevIndex => {
      if (direction === 'next') {
        return (prevIndex + 1) % totalImages;
      } else {
        return prevIndex === 0 ? totalImages - 1 : prevIndex - 1;
      }
    });
  };

  useEffect(() => {
    if (visible && event && !isClosing) {
      // Calculate initial position offset if cardPosition is provided
      let initialX = 0;
      let initialY = 0;
      let initialScale = 0.3;

      if (cardPosition) {
        const modalCenterX = width / 2;
        const modalCenterY = height / 2;
        const cardCenterX = cardPosition.x + cardPosition.width / 2;
        const cardCenterY = cardPosition.y + cardPosition.height / 2;
        
        initialX = cardCenterX - modalCenterX;
        initialY = cardCenterY - modalCenterY;
        initialScale = Math.min(cardPosition.width / (width - 40), cardPosition.height / (height - 120));
        initialScale = Math.max(0.1, Math.min(initialScale, 0.5)); // Clamp scale for smoother animation
      }

      // Set initial values immediately
      expandScale.setValue(initialScale);
      translateX.setValue(initialX);
      translateY.setValue(initialY);
      contentOpacity.setValue(0);
      fadeAnim.setValue(0); // Start invisible to prevent flash
      overlayOpacity.setValue(0); // Overlay starts transparent
      imageControlsOpacity.setValue(0); // Image controls start hidden

      // Simplified animation sequence - all animations run in parallel for smoother performance
      Animated.parallel([
        // Overlay fade in
        Animated.timing(overlayOpacity, {
          toValue: 0.8,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        // Modal fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        // Modal expansion
        Animated.timing(expandScale, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        // Modal positioning
        Animated.timing(translateX, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        // Content fade in (delayed slightly)
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 250,
          delay: 100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        // Image controls fade in (delayed more)
        Animated.timing(imageControlsOpacity, {
          toValue: 1,
          duration: 200,
          delay: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [visible, event, cardPosition]);

  // Handle closing animation
  useEffect(() => {
    if (isClosing) {
      let targetX = 0;
      let targetY = 0;
      let targetScale = 0.3;

      if (cardPosition) {
        const modalCenterX = width / 2;
        const modalCenterY = height / 2;
        const cardCenterX = cardPosition.x + cardPosition.width / 2;
        const cardCenterY = cardPosition.y + cardPosition.height / 2;
        
        targetX = cardCenterX - modalCenterX;
        targetY = cardCenterY - modalCenterY;
        targetScale = Math.min(cardPosition.width / (width - 40), cardPosition.height / (height - 120));
        targetScale = Math.max(0.1, Math.min(targetScale, 0.5));
      }

      // Simplified closing animation - all animations run in parallel
      Animated.parallel([
        // Content and controls fade out immediately
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: 150,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(imageControlsOpacity, {
          toValue: 0,
          duration: 100,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        // Modal shrinks and moves back to card position
        Animated.timing(expandScale, {
          toValue: targetScale,
          duration: 300,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: targetX,
          duration: 300,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: targetY,
          duration: 300,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        // Overlay fades out
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        })
      ]).start(() => {
        // Animation complete - now close the modal
        setIsClosing(false);
        onClose();
      });
    }
  }, [isClosing, cardPosition, onClose]);

  const handleShare = async () => {
    if (!event) return;

    try {
      // Format the date
      const eventDate = event.start_date ? new Date(event.start_date).toLocaleDateString() : 'Check event details';
      
      // App link for deep linking
      const appLink = `whatspoppin://event/${event.id}`;
      // Create the share message WITHOUT the app link in the text
      const shareMessage = `Let's see What's Poppin @ ${event.name} 🎈\n\n📍 ${event.location}\n⏰ ${eventDate}\n\nYou down? 😉`;

      await Share.share({
        message: shareMessage,
        title: event.name,
        url: appLink, // App link is attached but not visible in the message
      });
    } catch (error) {
      console.error('Error sharing event:', error);
    }
  };

  if (!visible || !event) return null;

  return (
    <>
      {/* Full-screen modal for edit mode */}
      {isEditMode ? (
        <Modal
          visible={visible}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={onClose}
        >
          <SafeAreaView style={[styles.fullScreenContainer, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
            {/* Header */}
            <View style={styles.fullScreenHeader}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={Colors[colorScheme ?? 'light'].text} />
              </TouchableOpacity>
              <View style={styles.headerSpacer} />
              <TouchableOpacity 
                onPress={handleSaveEvent} 
                style={styles.saveButton}
                disabled={isEditing}
              >
                {isEditing ? (
                  <ActivityIndicator size="small" color={Colors[colorScheme ?? 'light'].accent} />
                ) : (
                  <Ionicons name="checkmark" size={24} color={Colors[colorScheme ?? 'light'].accent} />
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.fullScreenContent} showsVerticalScrollIndicator={false}>
              {/* Event Name */}
              <View style={styles.editFieldContainer}>
                <Text style={[styles.editFieldLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Event Name</Text>
                <TextInput
                  style={[styles.editTextInput, { color: Colors[colorScheme ?? 'light'].text }]}
                  value={editedEvent?.name || ''}
                  onChangeText={(text) => handleFieldUpdate('name', text)}
                  placeholder="Event name"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
                />
              </View>

              {/* Organization */}
              <View style={styles.editFieldContainer}>
                <Text style={[styles.editFieldLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Organization</Text>
                <TextInput
                  style={[styles.editTextInput, { color: Colors[colorScheme ?? 'light'].text }]}
                  value={editedEvent?.organization || ''}
                  onChangeText={(text) => handleFieldUpdate('organization', text)}
                  placeholder="Organization"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
                />
              </View>

              {/* Description */}
              <View style={styles.editFieldContainer}>
                <Text style={[styles.editFieldLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Description</Text>
                <TextInput
                  style={[styles.editTextInput, styles.editTextArea, { color: Colors[colorScheme ?? 'light'].text }]}
                  value={editedEvent?.description || ''}
                  onChangeText={(text) => handleFieldUpdate('description', text)}
                  placeholder="Event description"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              {/* Days and Times */}
              <View style={[styles.modernHoursCard, { backgroundColor: Colors[colorScheme ?? 'light'].card, margin: 20 }]}>
                <View style={styles.modernHoursHeader}>
                  <View style={[styles.modernInfoIconBadge, { backgroundColor: 'rgba(158, 149, 189, 0.1)' }]}>
                    <Ionicons name="time" size={18} color="#9E95BD" />
                  </View>
                  <View style={styles.modernHoursHeaderText}>
                    <Text style={[styles.modernInfoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Opening Hours</Text>
                    <Text style={[styles.modernInfoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                      {editedEvent?.times && Object.keys(editedEvent.times).length > 0 ? 
                        `${Object.keys(editedEvent.times).length} days configured` : 
                        'No days configured'
                      }
                    </Text>
                  </View>
                </View>
                
                {/* Weekly Hours */}
                <View style={styles.modernWeeklyHours}>
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                    const dayTimes = editedEvent?.times?.[day];
                    const isCurrentDay = day === getCurrentDayName();
                    
                    return (
                      <View key={day} style={[
                        styles.modernDayRow,
                        { backgroundColor: isCurrentDay ? 'rgba(103, 126, 234, 0.1)' : 'transparent' }
                      ]}>
                        <TouchableOpacity
                          style={styles.dayToggleContainer}
                          onPress={() => {
                            const currentTimes = editedEvent?.times || {};
                            if (currentTimes[day]) {
                              // Remove day if already selected
                              const newTimes = { ...currentTimes };
                              delete newTimes[day];
                              handleFieldUpdate('times', newTimes);
                            } else {
                              // Add day with default times
                              handleFieldUpdate('times', {
                                ...currentTimes,
                                [day]: ['09:00', '17:00']
                              });
                            }
                          }}
                        >
                          <Text style={[
                            styles.modernDayText,
                            { 
                              color: Colors[colorScheme ?? 'light'].text,
                              fontWeight: isCurrentDay ? 'bold' : '500'
                            }
                          ]}>
                            {day.slice(0, 3)}
                          </Text>
                        </TouchableOpacity>
                        
                        <View style={styles.modernHoursText}>
                          {dayTimes ? (
                            <View style={styles.cleanTimeContainer}>
                              <View style={styles.timeRangeRow}>
                                <TextInput
                                  style={[styles.timeInput, { 
                                    borderColor: (dayTimes[0] && !validateTimeFormat(dayTimes[0])) ? '#ff4444' : Colors[colorScheme ?? 'light'].text + '30',
                                    color: Colors[colorScheme ?? 'light'].text,
                                    backgroundColor: (dayTimes[0] && !validateTimeFormat(dayTimes[0])) ? 'rgba(255, 68, 68, 0.05)' : 'rgba(158, 149, 189, 0.05)'
                                  }]}
                                  value={dayTimes[0] || ''}
                                  onChangeText={(text) => {
                                    const currentTimes = editedEvent.times || {};
                                    const updatedTimes = [...(currentTimes[day] || ['', ''])];
                                    updatedTimes[0] = text;
                                    handleFieldUpdate('times', {
                                      ...currentTimes,
                                      [day]: updatedTimes
                                    });
                                  }}
                                  placeholder="09:00"
                                  placeholderTextColor={Colors[colorScheme ?? 'light'].text + '50'}
                                  maxLength={5}
                                  keyboardType="numeric"
                                />
                                
                                <Text style={[styles.timeSeparatorClean, { color: Colors[colorScheme ?? 'light'].text }]}>to</Text>
                                
                                <TextInput
                                  style={[styles.timeInput, { 
                                    borderColor: (dayTimes[1] && !validateTimeFormat(dayTimes[1])) ? '#ff4444' : Colors[colorScheme ?? 'light'].text + '30',
                                    color: Colors[colorScheme ?? 'light'].text,
                                    backgroundColor: (dayTimes[1] && !validateTimeFormat(dayTimes[1])) ? 'rgba(255, 68, 68, 0.05)' : 'rgba(158, 149, 189, 0.05)'
                                  }]}
                                  value={dayTimes[1] || ''}
                                  onChangeText={(text) => {
                                    const currentTimes = editedEvent.times || {};
                                    const updatedTimes = [...(currentTimes[day] || ['', ''])];
                                    updatedTimes[1] = text;
                                    handleFieldUpdate('times', {
                                      ...currentTimes,
                                      [day]: updatedTimes
                                    });
                                  }}
                                  placeholder="17:00"
                                  placeholderTextColor={Colors[colorScheme ?? 'light'].text + '50'}
                                  maxLength={5}
                                  keyboardType="numeric"
                                />
                              </View>
                            </View>
                          ) : (
                            <Text style={[
                              styles.modernHoursText,
                              { 
                                color: Colors[colorScheme ?? 'light'].text + '80',
                                fontWeight: isCurrentDay ? 'bold' : '500'
                              }
                            ]}>
                              Closed
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Location */}
              <View style={styles.editFieldContainer}>
                <Text style={[styles.editFieldLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Location</Text>
                <TextInput
                  style={[styles.editTextInput, { color: Colors[colorScheme ?? 'light'].text }]}
                  value={editedEvent?.location || ''}
                  onChangeText={(text) => handleFieldUpdate('location', text)}
                  placeholder="Location"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
                />
              </View>

              {/* Cost */}
              <View style={styles.editFieldContainer}>
                <Text style={[styles.editFieldLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Cost</Text>
                <TextInput
                  style={[styles.editTextInput, { color: Colors[colorScheme ?? 'light'].text }]}
                  value={editedEvent?.cost ? editedEvent.cost.toString() : ''}
                  onChangeText={(text) => handleFieldUpdate('cost', parseFloat(text) || 0)}
                  placeholder="Cost (0 for free)"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
                  keyboardType="numeric"
                />
              </View>

              {/* Age Restriction */}
              <View style={styles.editFieldContainer}>
                <Text style={[styles.editFieldLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Age Restriction</Text>
                <TextInput
                  style={[styles.editTextInput, { color: Colors[colorScheme ?? 'light'].text }]}
                  value={editedEvent?.age_restriction ? editedEvent.age_restriction.toString() : ''}
                  onChangeText={(text) => handleFieldUpdate('age_restriction', parseFloat(text) || null)}
                  placeholder="Age restriction (leave empty for none)"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
                  keyboardType="numeric"
                />
              </View>

              {/* Reservation */}
              <View style={styles.editFieldContainer}>
                <Text style={[styles.editFieldLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Reservation</Text>
                <View style={styles.editToggleContainer}>
                  <TouchableOpacity
                    style={[
                      styles.editToggleButton,
                      editedEvent?.reservation === 'required' && styles.editToggleButtonActive
                    ]}
                    onPress={() => handleFieldUpdate('reservation', 'required')}
                  >
                    <Text style={[
                      styles.editToggleText,
                      editedEvent?.reservation === 'required' && styles.editToggleTextActive
                    ]}>
                      Required
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.editToggleButton,
                      editedEvent?.reservation === 'no' && styles.editToggleButtonActive
                    ]}
                    onPress={() => handleFieldUpdate('reservation', 'no')}
                  >
                    <Text style={[
                      styles.editToggleText,
                      editedEvent?.reservation === 'no' && styles.editToggleTextActive
                    ]}>
                      No
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.editToggleButton,
                      editedEvent?.reservation === 'recommended' && styles.editToggleButtonActive
                    ]}
                    onPress={() => handleFieldUpdate('reservation', 'recommended')}
                  >
                    <Text style={[
                      styles.editToggleText,
                      editedEvent?.reservation === 'recommended' && styles.editToggleTextActive
                    ]}>
                      Recommended
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Link */}
              <View style={styles.editFieldContainer}>
                <Text style={[styles.editFieldLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Event Link</Text>
                <TextInput
                  style={[styles.editTextInput, { color: Colors[colorScheme ?? 'light'].text }]}
                  value={editedEvent?.link || ''}
                  onChangeText={(text) => handleFieldUpdate('link', text)}
                  placeholder="Event website or link"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
                />
              </View>

              {/* Event Images */}
              <View style={styles.editFieldContainer}>
                <Text style={[styles.editFieldLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Event Images</Text>
                <Text style={[styles.editFieldSubLabel, { color: Colors[colorScheme ?? 'light'].text + '80' }]}>
                  Upload images to showcase your event
                </Text>
                
                <View style={styles.imageUploadContainer}>
                  {/* Image Grid */}
                  <View style={styles.imageGrid}>
                    {eventImages.map((imageUrl, index) => (
                      <View key={index} style={styles.imagePreviewContainer}>
                        <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
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
                    {eventImages.length < 5 && (
                      <TouchableOpacity
                        style={[styles.addImageButton, { 
                          backgroundColor: Colors[colorScheme ?? 'light'].card,
                          borderColor: colorScheme === 'dark' ? '#333' : '#ddd'
                        }]}
                        onPress={pickImage}
                        activeOpacity={0.8}
                        disabled={isUploadingImage}
                      >
                      <LinearGradient
                        colors={['#9E95BD', '#B97AFF', '#9E95BD']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.addImageGradient}
                      >
                        {isUploadingImage ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <>
                            <Ionicons name="camera" size={24} color="white" />
                            <Text style={styles.addImageText}>Add Photo</Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                    )}
                    
                    {/* Image Limit Message */}
                    {eventImages.length >= 5 && (
                      <View style={styles.imageLimitMessage}>
                        <Text style={[styles.imageLimitText, { color: Colors[colorScheme ?? 'light'].text + '70' }]}>
                          Maximum 5 images reached
                        </Text>
                      </View>
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
                    
                    {/* Debug Info and Cleanup Button */}
                    <View style={styles.debugRow}>
                      <Text style={[styles.debugText, { color: Colors[colorScheme ?? 'light'].text + '60' }]}>
                        Current images: {eventImages.length}/5
                      </Text>
                      <TouchableOpacity
                        style={styles.cleanupButton}
                        onPress={cleanupOrphanedImages}
                      >
                        <Text style={styles.cleanupButtonText}>Reset Images</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      ) : (
        /* Original modal for view mode */
        <View style={styles.expandedOverlay}>
          {/* Separate overlay background with delayed fade-in */}
          <Animated.View 
            style={[
              styles.overlayBackground,
              { 
                opacity: overlayOpacity,
              }
            ]}
          />

          <Animated.View 
            style={[
              styles.expandedCard,
              { 
                backgroundColor: Colors[colorScheme ?? 'light'].background,
                // Add shadow and border to prevent bleed-through
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 16,
                borderWidth: 1,
                borderColor: Colors[colorScheme ?? 'light'].background,
                opacity: fadeAnim,
                transform: [
                  { scale: expandScale },
                  { translateX: translateX },
                  { translateY: translateY }
                ],
              }
            ]}
          >
        {/* Close button at top of modal */}
        <TouchableOpacity
          style={styles.integratedBackButton}
          onPress={() => {
            if (!isClosing) {
              setIsClosing(true);
            }
          }}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.5)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.integratedBackButtonGradient}
          >
            <Ionicons name="close" size={22} color="white" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Save button when in edit mode */}
        {isEditMode && (
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveEvent}
            activeOpacity={0.8}
            disabled={isEditing}
          >
            <LinearGradient
              colors={['#4CAF50', '#66BB6A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.saveButtonGradient}
            >
              {isEditing ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="checkmark" size={22} color="white" />
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}



        {/* Always render image immediately for smooth scaling */}
        <View style={styles.imageContainer}>
          {getCurrentImageUrl() ? (
            <Image 
              source={{ uri: getCurrentImageUrl() }} 
              style={styles.imageExpanded}
              onError={(e) => {
                console.log('Image failed to load in modal, trying next image (retry once)');
                const totalImages = getActualImageCount();
                // Only retry once - if current image fails and there are more images, try the next one
                if (event && totalImages > 1 && currentImageIndex < totalImages - 1) {
                  navigateImage('next');
                } else {
                  // If no more images to try or this is already a retry, show placeholder
                  console.log('No more images to try, showing placeholder');
                  setCurrentImageIndex(-1);
                }
              }}
            />
          ) : (
            <View style={[styles.imageExpanded, { justifyContent: 'center', alignItems: 'center' }]}> 
              <Ionicons name="image-outline" size={40} color="#B97AFF" style={{ marginTop: -12 }} />
              <Text style={{ color: '#B97AFF', fontSize: 18, fontWeight: 'bold', marginTop: 8, marginBottom: 2, textAlign: 'center' }}>
                No Event Image
              </Text>
              <Text style={{ color: '#999', fontSize: 16, fontWeight: 'bold', marginTop: 8, textAlign: 'center' }}>
                But the fun is still on! 🎈
              </Text>
            </View>
          )}
          
          {/* Image Navigation Controls - only show if there are multiple images */}
          {event && getActualImageCount() > 1 && (
            <>
              {/* Previous Button */}
              <Animated.View style={[styles.imageNavButton, styles.imageNavLeft, { opacity: imageControlsOpacity }]}>
                <TouchableOpacity
                  style={styles.imageNavTouchable}
                  onPress={() => navigateImage('prev')}
                >
                  <LinearGradient
                    colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.4)']}
                    style={styles.imageNavGradient}
                  >
                    <Ionicons name="chevron-back" size={24} color="white" />
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
              
              {/* Next Button */}
              <Animated.View style={[styles.imageNavButton, styles.imageNavRight, { opacity: imageControlsOpacity }]}>
                <TouchableOpacity
                  style={styles.imageNavTouchable}
                  onPress={() => navigateImage('next')}
                >
                  <LinearGradient
                    colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.4)']}
                    style={styles.imageNavGradient}
                  >
                    <Ionicons name="chevron-forward" size={24} color="white" />
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
              
              {/* Image Dots Indicator */}
              <Animated.View style={[styles.imageDotsContainer, { opacity: imageControlsOpacity }]}>
                {Array.from({ length: getActualImageCount() }, (_, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.imageDot,
                      currentImageIndex === index && styles.imageDotActive
                    ]}
                    onPress={() => setCurrentImageIndex(index)}
                  />
                ))}
              </Animated.View>
            </>
          )}
        </View>

        {/* Content that fades in after main animation */}
        <Animated.View style={{ opacity: contentOpacity, flex: 1 }}>
          <ScrollView 
            style={styles.expandedContent}
            showsVerticalScrollIndicator={false}
            scrollEnabled={true}
            removeClippedSubviews={true}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            decelerationRate="fast"
            overScrollMode="never"
          >
            {/* Modern Header Section */}
            <View style={styles.modernHeaderSection}>
              <View style={styles.titleContainer}>
                {isEditMode ? (
                  <>
                    <TextInput
                      style={[styles.modernTitle, styles.editTextInput, { color: Colors[colorScheme ?? 'light'].text }]}
                      value={editedEvent?.name || ''}
                      onChangeText={(text) => handleFieldUpdate('name', text)}
                      placeholder="Event name"
                      placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
                    />
                    <TextInput
                      style={[styles.modernOrganization, styles.editTextInput, { color: Colors[colorScheme ?? 'light'].text }]}
                      value={editedEvent?.organization || ''}
                      onChangeText={(text) => handleFieldUpdate('organization', text)}
                      placeholder="Organization"
                      placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
                    />
                  </>
                ) : (
                  <>
                    <Text style={[styles.modernTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                      {event.name}
                    </Text>
                    {event.organization && (
                      <Text style={[styles.modernOrganization, { color: Colors[colorScheme ?? 'light'].text }]}>
                        by {event.organization}
                      </Text>
                    )}
                  </>
                )}
                
                {/* Event Creator Section */}
                {event.posted_by && (
                  <TouchableOpacity
                    style={styles.creatorContainer}
                    onPress={handleCreatorClick}
                    activeOpacity={0.7}
                    disabled={!creatorInfo || creatorLoading}
                  >
                    <LinearGradient
                      colors={colorScheme === 'dark' 
                        ? ['rgba(158, 149, 189, 0.15)', 'rgba(184, 174, 204, 0.15)', 'rgba(158, 149, 189, 0.15)']
                        : ['rgba(158, 149, 189, 0.08)', 'rgba(184, 174, 204, 0.08)', 'rgba(158, 149, 189, 0.08)']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.creatorCard}
                    >
                      <View style={styles.creatorHeader}>
                        <View style={styles.creatorIconBadge}>
                          {creatorInfo ? (
                            <Image 
                              source={{ 
                                uri: `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/user-images/${creatorInfo.email.replace('@', '_').replace(/\./g, '_')}/profile.jpg` 
                              }}
                              style={styles.creatorProfileImage}
                              defaultSource={require('../assets/images/icon.png')}
                              onError={() => {
                                console.log(`Failed to load creator profile image for ${creatorInfo.email}`);
                              }}
                            />
                          ) : (
                            <Ionicons name="person-add" size={16} color="#9E95BD" />
                          )}
                        </View>
                        <View style={styles.creatorInfo}>
                          {creatorLoading ? (
                            <ActivityIndicator size="small" color="#9E95BD" />
                          ) : creatorInfo ? (
                            <>
                              <Text style={[styles.creatorTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                                Created by {creatorInfo.name}
                              </Text>
                              <Text style={[styles.creatorSubtitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                                {creatorInfo.username ? `@${creatorInfo.username}` : 'Tap to view profile'}
                              </Text>
                            </>
                          ) : (
                            <Text style={[styles.creatorTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                              Created by user
                            </Text>
                          )}
                        </View>
                        {creatorInfo && !creatorLoading && (
                          <Ionicons name="chevron-forward" size={16} color="#9E95BD" />
                        )}
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>

              {/* Event Type Tags - Moved up for better hierarchy */}
              {event.event_type && (
                <View style={styles.modernTagsContainer}>
                  {(() => {
                    // Parse event types - handle both comma-separated strings and arrays
                    let eventTypes: string[] = [];
                    
                    if (typeof event.event_type === 'string') {
                      // Split by common separators and clean up
                      eventTypes = event.event_type
                        .split(/[,;|&+]/) // Split by comma, semicolon, pipe, ampersand, or plus
                        .map(type => type.trim())
                        .filter(type => type.length > 0);
                    } else if (Array.isArray(event.event_type)) {
                      eventTypes = event.event_type;
                    }
                    
                    // If no valid types found, use the original string
                    if (eventTypes.length === 0) {
                      eventTypes = [event.event_type];
                    }
                    
                    return eventTypes.map((eventType, index) => (
                      <View key={index} style={styles.modernEventTag}>
                        <Text style={styles.modernEventTagText}>{eventType}</Text>
                      </View>
                    ));
                  })()}

                  {/* Expiring Soon Tag */}
                  {isEventExpiringSoon(event) && (
                    <View style={styles.modernExpiringTag}>
                      <LinearGradient
                        colors={['#ff4444', '#ff6666']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.modernExpiringTagGradient}
                      >
                        <Ionicons name="time" size={14} color="white" />
                        <Text style={styles.modernExpiringTagText}>EXPIRING SOON</Text>
                      </LinearGradient>
                    </View>
                  )}
                </View>
              )}

              {/* People You Follow Who Saved This Event - Hero Section */}
              {event?.friendsWhoSaved && event.friendsWhoSaved.length > 0 && (
                <View style={styles.modernFriendsSection}>
                  <LinearGradient
                    colors={colorScheme === 'dark' 
                      ? ['rgba(158, 149, 189, 0.15)', 'rgba(184, 174, 204, 0.15)', 'rgba(158, 149, 189, 0.15)']
                      : ['rgba(158, 149, 189, 0.08)', 'rgba(184, 174, 204, 0.08)', 'rgba(158, 149, 189, 0.08)']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modernFriendsCard}
                  >
                    <View style={styles.modernFriendsHeader}>
                      <View style={styles.modernFriendsIconBadge}>
                        <Ionicons name="people" size={18} color="#9E95BD" />
                      </View>
                      <View style={styles.modernFriendsText}>
                        <Text style={[styles.modernFriendsTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                          {event.friendsWhoSaved.length === 1 
                            ? `${event.friendsWhoSaved[0].name} saved this`
                            : event.friendsWhoSaved.length === 2
                            ? `${event.friendsWhoSaved[0].name} and ${event.friendsWhoSaved[1].name} saved this`
                            : `${event.friendsWhoSaved[0].name} and ${event.friendsWhoSaved.length - 1} others saved this`
                          }
                        </Text>
                        <Text style={[styles.modernFriendsSubtitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                          {event.friendsWhoSaved.length} person{event.friendsWhoSaved.length !== 1 ? 's' : ''} you follow interested
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.modernFriendsList}>
                      {event.friendsWhoSaved.slice(0, 8).map((friend, index) => (
                        <View 
                          key={friend.id} 
                          style={[
                            styles.modernFriendAvatar, 
                            { 
                              marginLeft: index > 0 ? -12 : 0, 
                              zIndex: 8 - index,
                              borderColor: Colors[colorScheme ?? 'light'].background
                            }
                          ]}
                        >
                          <Image 
                            source={{ 
                              uri: `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/user-images/${friend.email.replace('@', '_').replace(/\./g, '_')}/profile.jpg` 
                            }}
                            style={styles.modernFriendAvatarImage}
                            defaultSource={require('../assets/images/icon.png')}
                            onError={() => {
                              // Fallback to icon if image fails to load
                              console.log(`Failed to load profile image for friend ${friend.email}`);
                            }}
                          />
                        </View>
                      ))}
                      {event.friendsWhoSaved.length > 8 && (
                        <View style={[styles.modernFriendAvatar, styles.modernMoreAvatar, { marginLeft: -12, zIndex: 0 }]}>
                          <Text style={styles.modernMoreText}>+{event.friendsWhoSaved.length - 8}</Text>
                        </View>
                      )}
                    </View>
                  </LinearGradient>
                </View>
              )}

              <View style={styles.buttonContainer}>
                {/* Link Button or No Link Label */}
                {event.link ? (
                  <TouchableOpacity
                    style={[styles.linkButton, { flex: 1, marginRight: 10 }]}
                    onPress={() => {
                      if (event.link) {
                        Linking.openURL(event.link).catch(err => {
                          console.error('Failed to open URL:', err);
                        });
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={[Colors.light.accent, Colors.light.primaryLight]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.linkButtonGradient}
                    >
                      <Ionicons name="link-outline" size={18} color="white" style={styles.linkIcon} />
                      <Text style={styles.linkButtonText}>
                        {event.link.includes('yelp.com') ? 'View on Yelp' :
                         event.link.includes('ticketmaster') ? 'Get Tickets' :
                         event.link.includes('maps.google.com') ? 'View on Maps' :
                         'Visit Website'}
                      </Text>
                      <Ionicons name="open-outline" size={16} color="white" style={styles.externalIcon} />
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.noLinkLabel, { flex: 1, marginRight: 10 }]}>
                    <Ionicons name="link-outline" size={18} color={Colors[colorScheme ?? 'light'].text} style={styles.linkIcon} />
                    <Text style={[styles.noLinkText, { color: Colors[colorScheme ?? 'light'].text }]}>
                      No Website Link
                    </Text>
                  </View>
                )}

                {/* Share Button */}
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={handleShare}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[Colors.light.accent, Colors.light.primaryLight]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.shareButtonGradient}
                  >
                    <Ionicons name="share-outline" size={20} color="white" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>

            {/* Modern Description Section - Only show if content is more than 2 lines */}
            {event.description && (() => {
              // Calculate if description is more than 2 lines
              const descriptionText = event.description;
              const estimatedLineHeight = 20; // Approximate line height for the text style
              const containerWidth = width - 80; // Account for padding and margins
              const fontSize = 16; // Approximate font size
              const charactersPerLine = Math.floor(containerWidth / (fontSize * 0.6)); // Rough estimate
              const lines = Math.ceil(descriptionText.length / charactersPerLine);
              
              // Only show section if more than 2 lines
              if (lines > 2) {
                return (
                  <View style={[styles.modernDescriptionCard, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
                    <View style={styles.modernDescriptionHeader}>
                      <View style={[styles.modernInfoIconBadge, { backgroundColor: 'rgba(158, 149, 189, 0.1)' }]}>
                        <Ionicons name="document-text" size={18} color="#9E95BD" />
                      </View>
                      <Text style={[styles.modernDescriptionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                        About this event
                      </Text>
                    </View>
                    <Text style={[styles.modernDescriptionText, { color: Colors[colorScheme ?? 'light'].text }]}>
                      {event.description}
                    </Text>
                  </View>
                );
              }
              return null;
            })()}

            {/* Modern Opening Hours Section - Right after friends and buttons */}
            {event.times && Object.keys(event.times).length > 0 && (
              <View style={[styles.modernHoursCard, { backgroundColor: Colors[colorScheme ?? 'light'].card, margin: 20 }]}>
                <View style={styles.modernHoursHeader}>
                  <View style={[styles.modernInfoIconBadge, { backgroundColor: 'rgba(158, 149, 189, 0.1)' }]}>
                    <Ionicons name="time" size={18} color="#9E95BD" />
                  </View>
                  <View style={styles.modernHoursHeaderText}>
                    <Text style={[styles.modernInfoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Opening Hours</Text>
                    <Text style={[styles.modernInfoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                      {formatOpeningHours(event.times).display}
                    </Text>
                    {formatOpeningHours(event.times).statusText && (
                      <View style={[
                        styles.modernStatusBadge,
                        { backgroundColor: formatOpeningHours(event.times).status === 'open' ? '#4CAF50' : 
                                         formatOpeningHours(event.times).status === 'open_24h' ? '#2196F3' : '#F44336' }
                      ]}>
                        <Text style={styles.modernStatusText}>
                          {formatOpeningHours(event.times).statusText}
                        </Text>
                      </View>
                    )}
                  </View>
                  </View>
                  
                  {/* Weekly Hours */}
                <View style={styles.modernWeeklyHours}>
                    {getWeeklyHours(event.times).map(({ day, hours }) => (
                      <View key={day} style={[
                      styles.modernDayRow,
                        { backgroundColor: day === getCurrentDayName() ? 
                        'rgba(103, 126, 234, 0.1)' : 'transparent' 
                        }
                      ]}>
                        <Text style={[
                        styles.modernDayText,
                          { 
                            color: Colors[colorScheme ?? 'light'].text,
                          fontWeight: day === getCurrentDayName() ? 'bold' : '500'
                          }
                        ]}>
                          {day.slice(0, 3)}
                        </Text>
                        <Text style={[
                        styles.modernHoursText,
                          { 
                            color: Colors[colorScheme ?? 'light'].text,
                          fontWeight: day === getCurrentDayName() ? 'bold' : '500'
                          }
                        ]}>
                          {hours}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
            )}

            {/* Back to Original Event Information Design */}
            <View style={styles.infoSection}>
              {/* Location */}
                  <View style={styles.infoRow}>
                    <LinearGradient
                      colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      locations={[0, 0.3, 0.7, 1]}
                      style={styles.infoIconContainer}
                    >
                  <Ionicons name="location-outline" size={20} color="white" />
                    </LinearGradient>
                    <View style={styles.infoTextContainer}>
                  <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Location</Text>
                  <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                    {event.location}
                  </Text>
                    </View>
                  </View>

              {/* Date/Time */}
              <View style={styles.infoRow}>
                <LinearGradient
                  colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  locations={[0, 0.3, 0.7, 1]}
                  style={styles.infoIconContainer}
                >
                  <Ionicons name="calendar-outline" size={20} color="white" />
                </LinearGradient>
                <View style={styles.infoTextContainer}>
                  <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Date</Text>
                  <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                    {event.start_date ? new Date(event.start_date).toLocaleDateString() : "Please check organizer's page"}
                  </Text>
                </View>
              </View>

              {/* Distance */}
              {typeof event.distance === 'number' && (
                <View style={styles.infoRow}>
                  <LinearGradient
                    colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    locations={[0, 0.3, 0.7, 1]}
                    style={styles.infoIconContainer}
                  >
                    <Ionicons name="walk-outline" size={20} color="white" />
                  </LinearGradient>
                  <View style={styles.infoTextContainer}>
                    <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Distance</Text>
                    <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                      {event.distance.toFixed(2)} km away
                    </Text>
                  </View>
                </View>
              )}

              {/* Cost */}
              <View style={styles.infoRow}>
                <LinearGradient
                  colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  locations={[0, 0.3, 0.7, 1]}
                  style={styles.infoIconContainer}
                >
                  <Ionicons name="cash-outline" size={20} color="white" />
                </LinearGradient>
                <View style={styles.infoTextContainer}>
                  <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Cost</Text>
                  <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                    {event.cost !== undefined && event.cost !== null 
                      ? (event.cost === 0 ? 'FREE' : `$${event.cost}`)
                      : 'Please check website'
                    }
                  </Text>
                </View>
              </View>

              {/* Age Restriction */}
              <View style={styles.infoRow}>
                <LinearGradient
                  colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  locations={[0, 0.3, 0.7, 1]}
                  style={styles.infoIconContainer}
                >
                  <Ionicons name="people-outline" size={20} color="white" />
                </LinearGradient>
                <View style={styles.infoTextContainer}>
                  <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Age Restriction</Text>
                  <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                    {event.age_restriction ? `${event.age_restriction}+` : 'None'}
                  </Text>
                </View>
              </View>

              {/* Reservation */}
              <View style={styles.infoRow}>
                <LinearGradient
                  colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  locations={[0, 0.3, 0.7, 1]}
                  style={styles.infoIconContainer}
                >
                  <Ionicons name="calendar-number-outline" size={20} color="white" />
                </LinearGradient>
                <View style={styles.infoTextContainer}>
                  <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Reservation</Text>
                  <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                    {event.reservation === 'yes' ? 'Required' : 'Not Required'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Google Map */}
            <View style={styles.mapContainer}>
              {userLocation && event.latitude && event.longitude ? (
                <View style={styles.mapWrapper}>
                  {!mapReady && (
                    <View style={styles.mapLoadingOverlay}>
                      <ActivityIndicator size="large" color="#FF0005" />
                      <Text style={[styles.mapLoadingText, { color: Colors[colorScheme ?? 'light'].text }]}>
                        Loading map...
                      </Text>
                    </View>
                  )}
                  <MapView
                  //provider={PROVIDER_GOOGLE}
                  style={styles.map}
                  initialRegion={{
                    latitude: (userLocation.latitude + event.latitude) / 2,
                    longitude: (userLocation.longitude + event.longitude) / 2,
                    latitudeDelta: Math.abs(userLocation.latitude - event.latitude) * 1.5 + 0.01,
                    longitudeDelta: Math.abs(userLocation.longitude - event.longitude) * 1.5 + 0.01,
                  }}
                  showsUserLocation={true}
                  showsMyLocationButton={true}
                  showsCompass={true}
                  showsScale={true}
                  // Critical for TestFlight: Force map tiles to load
                  mapType="standard"
                  loadingEnabled={true}
                  loadingIndicatorColor="#FF0005"
                  loadingBackgroundColor="#f0f0f0"
                  // Improved rendering for production
                  pitchEnabled={false}
                  rotateEnabled={false}
                  scrollEnabled={true}
                  zoomEnabled={true}
                  // TestFlight compatibility
                  showsBuildings={true}
                  showsTraffic={false}
                  showsIndoors={false}
                  // Map event handlers for better TestFlight reliability
                  onMapReady={() => {
                    console.log('Map is ready');
                    setMapReady(true);
                  }}
                  onRegionChangeComplete={() => {
                    // Ensure map is properly initialized
                    if (!mapReady) setMapReady(true);
                  }}
                >
                  <Marker 
                    coordinate={userLocation}
                    title="Your Location"
                  >
                    <View style={styles.userMarkerContainer}>
                      <View style={styles.userMarker}>
                        <Ionicons name="person" size={16} color="white" />
                      </View>
                    </View>
                  </Marker>

                  <Marker
                    coordinate={{
                      latitude: event.latitude,
                      longitude: event.longitude
                    }}
                    title={event.name}
                  >
                    <View style={styles.eventMarkerContainer}>
                      <View style={styles.eventMarker}>
                        <Ionicons name="location" size={16} color="white" />
                      </View>
                    </View>
                  </Marker>
                </MapView>
              </View>
              ) : (
                <View style={[styles.map, styles.mapPlaceholder]}>
                  <Text style={{ color: Colors[colorScheme ?? 'light'].text }}>
                    {!userLocation ? 'Enable location services to view map' : 'Location data missing for this event'}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </Animated.View>

        {/* Floating Like Button - Bottom Left Corner */}
        <TouchableOpacity
          style={styles.floatingLikeButton}
          onPress={handleLike}
          activeOpacity={0.8}
          disabled={likeLoading}
        >
          <LinearGradient
            colors={isLiked ? 
              ['#FF1493', '#FF69B4', '#FFB6C1'] : 
              [Colors.light.accent, Colors.light.primaryLight]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.floatingLikeButtonGradient}
          >
            {likeLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons 
                name={isLiked ? "heart" : "heart-outline"} 
                size={24} 
                color="white" 
              />
            )}
          </LinearGradient>
        </TouchableOpacity>
          </Animated.View>
        </View>
      )}




      {/* User Profile Modal for Creator */}
      {creatorInfo && (
        <UserProfileModal
          visible={userProfileModalVisible}
          onClose={() => setUserProfileModalVisible(false)}
          userId={creatorInfo.id}
          userName={creatorInfo.name}
          userEmail={creatorInfo.email}
        />
      )}


    </>
  );
}

const styles = StyleSheet.create({
  expandedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    zIndex: 201,
  },

  expandedCard: {
    width: width - 40,
    height: height - 120,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
    overflow: 'hidden',
    zIndex: 202, // Above the overlay background
  },
  expandedCardFullScreen: {
    width: width,
    height: height,
    borderRadius: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
    overflow: 'hidden',
    zIndex: 202, // Above the overlay background
  },
  expandedContent: {
    flex: 1,
  },
  imageExpanded: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  integratedBackButton: {
    position: 'absolute',
    top: 20,
    right: 10,
    zIndex: 10,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  integratedBackButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    padding: 5,
  },
  saveButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  expandedHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  expandedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  organizationText: {
    fontSize: 16,
    opacity: 0.7,
  },
  infoSection: {
    padding: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  infoTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.7,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 2,
  },
  dayButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 8,
    gap: 8,
  },
  dayCircleButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(158, 149, 189, 0.3)',
  },
  dayCircleButtonSelected: {
    backgroundColor: 'white',
    borderColor: '#FF3366',
  },
  dayCircleButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  descriptionSection: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  descriptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.8,
  },
  mapContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  map: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  mapPlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FF0005',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  eventMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#9E95BD',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 250,
  },
  imageNavButton: {
    position: 'absolute',
    top: '50%',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    transform: [{ translateY: -20 }],
  },
  imageNavTouchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timePicker: {
    flex: 1,
    height: 120, // Adjust height as needed
  },
  timeSeparator: {
    alignSelf: 'center',
    marginHorizontal: 10,
    fontSize: 18,
    fontWeight: 'bold',
  },
  imageNavLeft: {
    left: 10,
  },
  imageNavRight: {
    right: 10,
  },
  imageNavGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageDotsContainer: {
    position: 'absolute',
    bottom: 15,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  imageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  imageDotActive: {
    backgroundColor: 'white',
    transform: [{ scale: 1.2 }],
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 16,
    alignItems: 'center',
  },
  floatingLikeButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
  },
  floatingLikeButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkButton: {
    flex: 1,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  linkButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  linkIcon: {
    marginRight: 8,
  },
  linkButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  noLinkLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    backgroundColor: 'rgba(158, 149, 189, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(158, 149, 189, 0.2)',
  },
  noLinkText: {
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.7,
  },
  externalIcon: {
    marginLeft: 8,
    opacity: 0.8,
  },
  shareButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginLeft: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  shareButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hoursContainer: {
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  weeklyHoursContainer: {
    marginTop: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  dayHoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  dayText: {
    fontSize: 14,
    minWidth: 40,
  },
  hoursText: {
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  dayPill: {
    backgroundColor: '#FF1493',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 4,
    marginBottom: 4,
  },
  dayPillText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 13,
  },
  hoursSection: {
    borderWidth: 1,
    borderColor: 'rgba(158, 149, 189, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(158, 149, 189, 0.05)',
  },
  eventTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    marginBottom: 8,
    marginHorizontal: -4, // Offset the right margin of individual tags
  },
  eventTag: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginRight: 8,
    marginBottom: 6,
  },
  eventTagGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagIcon: {
    marginRight: 6,
  },
  eventTagText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  mapWrapper: {
    position: 'relative',
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(240, 240, 240, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderRadius: 12,
  },
  mapLoadingText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '500',
  },
  // Friends who saved event styles
  friendsSavedSection: {
    backgroundColor: 'rgba(158, 149, 189, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(158, 149, 189, 0.1)',
  },
  friendsSavedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  friendsSavedIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  friendsSavedTextContainer: {
    flex: 1,
  },
  friendsSavedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  friendsSavedSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  friendsSavedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  friendSavedItem: {
    alignItems: 'center',
    marginBottom: 12,
    width: 80,
  },
  friendSavedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#9E95BD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#9E95BD',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  moreFriendsAvatar: {
    backgroundColor: 'rgba(158, 149, 189, 0.7)',
  },
  moreFriendsText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  friendSavedName: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 16,
  },
  
  // Modern Header Styles
  modernHeaderSection: {
    padding: 24,
    paddingBottom: 16,
  },
  titleContainer: {
    marginBottom: 16,
  },
  modernTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    lineHeight: 34,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  modernOrganization: {
    fontSize: 16,
    opacity: 0.8,
    fontWeight: '500',
  },
  editTextInput: {
    borderWidth: 1,
    borderColor: 'rgba(158, 149, 189, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(158, 149, 189, 0.05)',
    marginBottom: 8,
  },

  // Full-screen edit modal styles
  fullScreenContainer: {
    flex: 1,
  },
  fullScreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerSpacer: {
    flex: 1,
  },
  closeButton: {
    padding: 5,
  },
  fullScreenTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  fullScreenContent: {
    flex: 1,
    padding: 20,
  },
  editFieldContainer: {
    marginBottom: 20,
  },
  editFieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  editTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  editToggleContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  editToggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(158, 149, 189, 0.3)',
    backgroundColor: 'rgba(158, 149, 189, 0.05)',
  },
  editToggleButtonActive: {
    backgroundColor: '#9E95BD',
    borderColor: '#9E95BD',
  },
  editToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(158, 149, 189, 0.8)',
  },
  editToggleTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  
  // Image management styles
  editFieldSubLabel: {
    fontSize: 14,
    marginBottom: 12,
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
  imageLimitMessage: {
    width: 100,
    height: 75,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(158, 149, 189, 0.05)',
  },
  imageLimitText: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 14,
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
  debugRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(158, 149, 189, 0.1)',
  },
  debugText: {
    fontSize: 12,
    fontWeight: '500',
  },
  cleanupButton: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cleanupButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },

  // Days and Times styles
  dayToggleContainer: {
    minWidth: 60,
  },
    // Clean Time Input Styles
  cleanTimeContainer: {
    width: '100%',
  },
  timeRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 4,
  },
  singleTimeInput: {
    flex: 1,
  },
  timeInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(158, 149, 189, 0.05)',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    minWidth: 65,
    minHeight: 40,
  },
  timePickerButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  timeSeparatorClean: {
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 4,
    opacity: 0.7,
    minWidth: 20,
  },
  
  // Time Picker Modal Styles
  timePickerModal: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 10000,
    elevation: 10000,
  },
  timePickerModalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  timePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  timePickerCancel: {
    padding: 5,
  },
  timePickerCancelText: {
    fontSize: 16,
    color: '#999',
  },
  timePickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  timePickerDone: {
    padding: 5,
  },
  timePickerDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9E95BD',
  },


  timeInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeDigitInput: {
    width: 45,
    height: 55,
    borderWidth: 1,
    borderColor: 'rgba(158, 149, 189, 0.3)',
    borderRadius: 6,
    backgroundColor: 'rgba(158, 149, 189, 0.05)',
    fontSize: 22,
    textAlign: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  timeColon: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 4,
  },

  
  
  // Modern Tags
  modernTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  modernEventTag: {
    backgroundColor: 'rgba(103, 126, 234, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(103, 126, 234, 0.2)',
  },
  modernEventTagText: {
    color: '#667eea',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modernExpiringTag: {
    backgroundColor: '#ff4444',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#ff4444',
    overflow: 'hidden',
  },
  modernExpiringTagGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modernExpiringTagText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  // Modern Friends Section
  modernFriendsSection: {
    marginBottom: 20,
  },
  modernFriendsCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(158, 149, 189, 0.1)',
    shadowColor: '#9E95BD',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  modernFriendsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modernFriendsIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(158, 149, 189, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  modernFriendsText: {
    flex: 1,
  },
  modernFriendsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
    lineHeight: 20,
  },
  modernFriendsSubtitle: {
    fontSize: 13,
    opacity: 0.7,
    fontWeight: '500',
  },
  modernFriendsList: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modernFriendAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#9E95BD',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#9E95BD',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  modernMoreAvatar: {
    backgroundColor: 'rgba(158, 149, 189, 0.8)',
  },
  modernMoreText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  
  // Modern Action Buttons
  modernActionContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  modernPrimaryButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  modernButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  modernButtonIcon: {
    marginRight: 8,
  },
  modernButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  modernSecondaryButton: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(158, 149, 189, 0.3)',
    overflow: 'hidden',
  },
  modernSecondaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  modernSecondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  
  // Modern Details Section
  modernDetailsSection: {
    padding: 20,
    gap: 16,
  },
  modernQuickInfoGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  modernInfoCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(158, 149, 189, 0.1)',
    shadowColor: '#9E95BD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  modernInfoIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modernInfoLabel: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.7,
    marginBottom: 4,
  },
  modernInfoValue: {
    fontSize: 15,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  modernFullWidthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(158, 149, 189, 0.1)',
    shadowColor: '#9E95BD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  modernFullWidthCardContent: {
    flex: 1,
    marginLeft: 12,
  },
  modernHoursCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(158, 149, 189, 0.1)',
    shadowColor: '#9E95BD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  modernHoursHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modernHoursHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  modernStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  modernStatusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modernWeeklyHours: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(158, 149, 189, 0.05)',
  },
  modernDayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(158, 149, 189, 0.1)',
  },
  modernDayText: {
    fontSize: 14,
    minWidth: 40,
  },
  modernHoursText: {
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
  },
  
  // Modern Description Section
  modernDescriptionCard: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(158, 149, 189, 0.1)',
    shadowColor: '#9E95BD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  modernDescriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modernDescriptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  modernDescriptionText: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.9,
  },
  
  // Modern Friend Avatar Image Styles
  modernFriendAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  modernFriendAvatarFallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(158, 149, 189, 0.8)',
    borderRadius: 16,
  },
  
  // Creator Section Styles
  creatorContainer: {
    marginTop: 12,
  },
  creatorCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(158, 149, 189, 0.1)',
    shadowColor: '#9E95BD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  creatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creatorIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(158, 149, 189, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  creatorProfileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  creatorInfo: {
    flex: 1,
  },
  creatorTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  creatorSubtitle: {
    fontSize: 12,
    opacity: 0.7,
    fontWeight: '500',
  },
  creatorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(158, 149, 189, 0.1)',
  },
}); 