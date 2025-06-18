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
  const cardScaleAnim = useRef(new Animated.Value(0.95)).current;
  const [isClosing, setIsClosing] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

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
    }
  }, [event]);

  // Get current image URL
  const getCurrentImageUrl = () => {
    if (!event?.id || currentImageIndex === -1) return event?.image || null;
    
    // If event has allImages array, use it
    if (event.allImages && event.allImages.length > 0) {
      return event.allImages[currentImageIndex] || event.allImages[0];
    }
    
    // Fallback: construct URL using current index
    return `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/event-images/${event.id}/${currentImageIndex}.jpg`;
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    if (!event) return;
    
    const totalImages = event.allImages?.length || 5; // Default to 5 if allImages not available
    
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

      // First: Show dark background immediately
      Animated.timing(overlayOpacity, {
        toValue: 0.8,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        // Then: Start modal expansion animation
        Animated.parallel([
          Animated.timing(expandScale, {
            toValue: 1,
            duration: 250,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: 0,
            duration: 250,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: 250,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        ]).start(() => {
          // Finally: Content fade in after modal animation completes
          Animated.timing(contentOpacity, {
            toValue: 1,
            duration: 150,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }).start(() => {
            // Last: Image controls fade in after content is fully visible
            Animated.timing(imageControlsOpacity, {
              toValue: 1,
              duration: 200,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }).start();
          });
        });
      });
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

      // First: Image controls and content fade out simultaneously
      Animated.parallel([
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
        })
      ]).start(() => {
        // Then: Modal shrinks back to card position
        Animated.parallel([
          Animated.timing(expandScale, {
            toValue: targetScale,
            duration: 250,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: targetX,
            duration: 250,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: targetY,
            duration: 250,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          })
        ]).start(() => {
          // Finally: Dark background fades out
          Animated.timing(overlayOpacity, {
            toValue: 0,
            duration: 120,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }).start(() => {
            // Animation complete - now close the modal
            setIsClosing(false);
            onClose();
          });
        });
      });
    }
  }, [isClosing, cardPosition, onClose]);

  const handleShare = async () => {
    if (!event) return;

    try {
      // Format the date
      const eventDate = event.start_date ? new Date(event.start_date).toLocaleDateString() : 'Check event details';
      
      // Create the share message with the exact template
      const shareMessage = `Let's see What's Poppin @ ${event.name} 🎈\n\n📍 ${event.location}\n⏰ ${eventDate}\n\nYou down? 😉\n\nhttps://whatspoppin.app/event/${event.id}`;
      
      await Share.share({
        message: shareMessage,
        title: event.name,
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
                console.log('Image failed to load in modal, trying next image');
                // If current image fails, try to move to next image
                if (event && event.allImages && event.allImages.length > 1 && currentImageIndex < event.allImages.length - 1) {
                  navigateImage('next');
                } else {
                  // If no more images to try, set current image to null to show placeholder
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
          
          {/* Image Navigation Controls */}
          {event && ((event.allImages && event.allImages.length > 1) || event.id) && (
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
                {Array.from({ length: event.allImages?.length || 5 }, (_, index) => (
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
          >
            <View style={styles.expandedHeader}>
              <Text style={[styles.expandedTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                {event.name}
              </Text>
              <Text style={[styles.organizationText, { color: Colors[colorScheme ?? 'light'].text }]}>
                {event.organization}
              </Text>

              <View style={styles.buttonContainer}>
                {/* Link Button */}
                {event.link && (
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
                      colors={['#FF0005', '#FF4D9D', '#FF69E2', '#B97AFF', '#9E95BD']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      locations={[0, 0.25, 0.5, 0.75, 1]}
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
                )}

                {/* Share Button */}
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={handleShare}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#FF0005', '#FF4D9D', '#FF69E2', '#B97AFF', '#9E95BD']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    locations={[0, 0.25, 0.5, 0.75, 1]}
                    style={styles.shareButtonGradient}
                  >
                    <Ionicons name="share-outline" size={20} color="white" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* Event Type Tags */}
              {event.event_type && (
                <View style={styles.eventTagsContainer}>
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
                      <View key={index} style={styles.eventTag}>
                        <LinearGradient
                          colors={['#FF0005', '#FF4D9D', '#FF69E2', '#B97AFF', '#9E95BD']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          locations={[0, 0.25, 0.5, 0.75, 1]}
                          style={styles.eventTagGradient}
                        >
                          <Ionicons name="pricetag" size={14} color="white" style={styles.tagIcon} />
                          <Text style={styles.eventTagText}>{eventType}</Text>
                        </LinearGradient>
                      </View>
                    ));
                  })()}
                </View>
              )}
            </View>

            <View style={styles.infoSection}>
              {/* Opening Hours Section */}
              {event.times && Object.keys(event.times).length > 0 ? (
                <View style={styles.hoursSection}>
                  <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text, marginBottom: 8 }]}>Hours Today</Text>
                  <View style={styles.hoursContainer}>
                    <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                      {formatOpeningHours(event.times).display}
                    </Text>
                    {formatOpeningHours(event.times).statusText && (
                      <View style={[
                        styles.statusBadge,
                        { backgroundColor: formatOpeningHours(event.times).status === 'open' ? '#4CAF50' : 
                                         formatOpeningHours(event.times).status === 'open_24h' ? '#2196F3' : '#F44336' }
                      ]}>
                        <Text style={styles.statusText}>
                          {formatOpeningHours(event.times).statusText}
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  {/* Weekly Hours */}
                  <View style={styles.weeklyHoursContainer}>
                    {getWeeklyHours(event.times).map(({ day, hours }) => (
                      <View key={day} style={[
                        styles.dayHoursRow,
                        { backgroundColor: day === getCurrentDayName() ? 
                          (colorScheme === 'dark' ? 'rgba(158, 149, 189, 0.2)' : 'rgba(158, 149, 189, 0.1)') : 
                          'transparent' 
                        }
                      ]}>
                        <Text style={[
                          styles.dayText,
                          { 
                            color: Colors[colorScheme ?? 'light'].text,
                            fontWeight: day === getCurrentDayName() ? 'bold' : 'normal'
                          }
                        ]}>
                          {day.slice(0, 3)}
                        </Text>
                        <Text style={[
                          styles.hoursText,
                          { 
                            color: Colors[colorScheme ?? 'light'].text,
                            fontWeight: day === getCurrentDayName() ? 'bold' : 'normal'
                          }
                        ]}>
                          {hours}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                Array.isArray(event.days_of_the_week) && event.days_of_the_week.length > 0 ? (
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
                      <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Days of the Week</Text>
                      <View style={styles.daysContainer}>
                        {event.days_of_the_week.map((day, index) => (
                          <View key={day} style={styles.dayPill}>
                            <Text style={styles.dayPillText}>{day}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                ) : (
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
                      <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text, fontWeight: 'bold', marginTop: 2 }]}> 
                        {event.start_date ? new Date(event.start_date).toLocaleDateString() : "please check organizer's page"}
                      </Text>
                    </View>
                  </View>
                )
              )}

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
                    ${event.cost}
                  </Text>
                </View>
              </View>

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

            <View style={styles.descriptionSection}>
              <Text style={[styles.descriptionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                About this event
              </Text>
              <Text style={[styles.descriptionText, { color: Colors[colorScheme ?? 'light'].text }]}>
                {event.description}
              </Text>
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
                    setMapError(false);
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
}); 