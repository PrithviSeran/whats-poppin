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

  // Helper function to get the actual number of available images
  const getActualImageCount = () => {
    if (!event || !event.id) return 1; // No event or no ID, assume 1 image
    
    // If allImages array is available, use its length
    if (event.allImages && event.allImages.length > 0) {
      return event.allImages.length;
    }
    
    // If no allImages array but there's an image, assume at least 1
    if (event.image) {
      return 1;
    }
    
    return 1; // Default to 1 image
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
                const totalImages = getActualImageCount();
                // If current image fails and there are more images, try to move to next image
                if (event && totalImages > 1 && currentImageIndex < totalImages - 1) {
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

            {/* Modern Description Section */}
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
}); 