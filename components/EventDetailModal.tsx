import React, { useRef, useEffect, useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { EventCard } from '../lib/GlobalDataManager';
import { supabase } from '@/lib/supabase';
import UserProfileModal from './UserProfileModal';

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
  
  // Creator profile modal state
  const [userProfileModalVisible, setUserProfileModalVisible] = useState(false);
  const [creatorInfo, setCreatorInfo] = useState<{
    id: number;
    name: string;
    email: string;
  } | null>(null);
  const [creatorLoading, setCreatorLoading] = useState(false);

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
        // Fetch creator info if posted_by exists
        if (event.posted_by) {
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
  const fetchCreatorInfo = async (creatorEmail: string) => {
    setCreatorLoading(true);
    try {
      const { data, error } = await supabase
        .from('all_users')
        .select('id, name, email')
        .eq('email', creatorEmail)
        .single();

      if (error) {
        console.error('Error fetching creator info:', error);
        setCreatorInfo(null);
      } else {
        setCreatorInfo(data);
      }
    } catch (error) {
      console.error('Error fetching creator info:', error);
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
      fadeAnim.setValue(1); // Card is immediately visible
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
            <View style={[styles.imageExpanded, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="image-outline" size={60} color="#666" />
              <Text style={{ color: '#666', marginTop: 12, fontSize: 16, textAlign: 'center' }}>
                No Image Found
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
                <Text style={[styles.modernTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                {event.name}
              </Text>
                {event.organization && (
                  <Text style={[styles.modernOrganization, { color: Colors[colorScheme ?? 'light'].text }]}>
                    by {event.organization}
              </Text>
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
                                Tap to view profile
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

              {/* Friends Who Saved This Event - Hero Section */}
              {event.friendsWhoSaved && event.friendsWhoSaved.length > 0 && (
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
                          {event.friendsWhoSaved.length} friend{event.friendsWhoSaved.length !== 1 ? 's' : ''} interested
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
                  provider={PROVIDER_GOOGLE}
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
      </Animated.View>
      
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
    </View>
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
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.2)',
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
}); 