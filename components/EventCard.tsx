import React, { useState, memo } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors, gradients } from '@/constants/Colors';
import { EventCard } from '@/lib/GlobalDataManager';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 45) / 2;

interface ExtendedEventCard extends EventCard {
  isLiked?: boolean;
}

interface EventCardComponentProps {
  event: ExtendedEventCard;
  onPress: () => void;
  onLike: () => void;
  isLiked: boolean;
  userLocation: { latitude: number; longitude: number } | null;
  cardRef?: (ref: any) => void;
}

// Helper function to check if an event is expiring soon
const isEventExpiringSoon = (event: EventCard): boolean => {
  if (!event || event.occurrence === 'Weekly') {
    return false;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  const eventDate = event.end_date || event.start_date;
  if (eventDate) {
    try {
      const eventDateTime = new Date(eventDate);
      const eventDateOnly = new Date(eventDateTime.getFullYear(), eventDateTime.getMonth(), eventDateTime.getDate());
      
      return eventDateOnly >= today && eventDateOnly <= nextWeek;
    } catch (error) {
      return false;
    }
  }

  return false;
};

const EventCardComponent = memo<EventCardComponentProps>(({ 
  event, 
  onPress, 
  onLike, 
  isLiked, 
  userLocation, 
  cardRef 
}) => {
  const colorScheme = useColorScheme();
  const [imageError, setImageError] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const handleImageError = () => {
    // Try next image if available
    if (event.allImages && event.allImages.length > 0 && currentImageIndex < event.allImages.length - 1) {
      setCurrentImageIndex(prev => prev + 1);
    } else {
      setImageError(true);
    }
  };

  const currentImageUrl = event.allImages && event.allImages.length > 0 
    ? event.allImages[currentImageIndex] 
    : event.image;

  return (
    <View 
      style={[styles.card, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}
      ref={cardRef}
    >
      {currentImageUrl && !imageError ? (
        <Image 
          source={{ uri: currentImageUrl }}
          style={styles.cardImage}
          onError={handleImageError}
        />
      ) : (
        <LinearGradient
          colors={colorScheme === 'dark' 
            ? ['#2A2A2A', '#1F1F1F', '#252525'] 
            : ['#FFFFFF', '#F8F9FA', '#FFFFFF']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.cardImage, { justifyContent: 'center', alignItems: 'center' }]}
        >
          <Ionicons name="image-outline" size={32} color="#B97AFF" style={{ marginTop: -8 }} />
          <Text style={{ color: '#B97AFF', fontSize: 14, fontWeight: 'bold', marginTop: 8, marginBottom: 2, textAlign: 'center' }}>
            No Event Image
          </Text>
          <Text style={{ color: '#999', fontSize: 12, fontWeight: 'bold', marginTop: 4, textAlign: 'center' }}>
            But the fun is still on! 🎈
          </Text>
        </LinearGradient>
      )}
      
      {/* Featured Badge */}
      {event.featured && (
        <View style={styles.featuredBadge}>
          <LinearGradient
            colors={[Colors[colorScheme ?? 'light'].warning, '#FFA500']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.featuredBadgeContainer}
          >
            <Ionicons name="star" size={14} color="white" />
            <Text style={styles.featuredText}>Featured</Text>
          </LinearGradient>
        </View>
      )}

      {/* Expiring Soon Badge */}
      {isEventExpiringSoon(event) && (
        <View style={[styles.featuredBadge, { top: event.featured ? 50 : 10 }]}>
          <LinearGradient
            colors={[Colors[colorScheme ?? 'light'].primary, Colors[colorScheme ?? 'light'].primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.featuredBadgeContainer}
          >
            <Ionicons name="time" size={14} color="white" />
            <Text style={styles.featuredText}>Expiring Soon</Text>
          </LinearGradient>
        </View>
      )}

      <TouchableOpacity 
        style={styles.likeButton}
        onPress={onLike}
      >
        <Ionicons 
          name={isLiked ? "heart" : "heart-outline"} 
          size={24} 
          color={isLiked ? Colors[colorScheme ?? 'light'].primary : "#fff"} 
        />
      </TouchableOpacity>

      <TouchableOpacity style={styles.cardContent} onPress={onPress}>
        <Text style={[styles.cardTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
          {event.name}
        </Text>
        

        
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={16} color={colorScheme === 'dark' ? '#aaa' : '#666'} />
          <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text }]} numberOfLines={2}>
            {event.location}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return (
    prevProps.event.id === nextProps.event.id &&
    prevProps.isLiked === nextProps.isLiked &&
    prevProps.event.featured === nextProps.event.featured &&
    prevProps.event.name === nextProps.event.name &&
    prevProps.event.image === nextProps.event.image
  );
});

EventCardComponent.displayName = 'EventCardComponent';

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: CARD_WIDTH * 0.8,
    resizeMode: 'cover',
  },
  featuredBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    borderRadius: 20,
    overflow: 'hidden',
    zIndex: 1,
  },
  featuredBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  featuredText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  likeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    marginLeft: 6,
    flex: 1,
  },
});

export default EventCardComponent; 