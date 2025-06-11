import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { EventCard as EventCardType } from '@/lib/GlobalDataManager';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 45) / 2; // 2 cards per row with padding

interface EventCardProps {
  event: EventCardType;
  onPress: () => void;
  onLike: () => void;
  isLiked: boolean;
  userLocation: { latitude: number; longitude: number } | null;
  cardRef?: (ref: any) => void;
}

export default function EventCard({ event, onPress, onLike, isLiked, userLocation, cardRef }: EventCardProps) {
  const colorScheme = useColorScheme();

  return (
    <TouchableOpacity
      ref={cardRef}
      style={[styles.card, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.imageContainer}>
        {event.image ? (
          <Image
            source={{ uri: event.image }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.image, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="image-outline" size={40} color="#666" />
          </View>
        )}
        <TouchableOpacity
          style={styles.likeButton}
          onPress={onLike}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={24}
            color={isLiked ? '#FF0005' : Colors[colorScheme ?? 'light'].text}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.contentContainer}>
        <Text style={[styles.title, { color: Colors[colorScheme ?? 'light'].text }]} numberOfLines={2}>
          {event.name}
        </Text>
        {typeof event.distance === 'number' && (
          <View style={styles.distanceContainer}>
            <Ionicons name="walk-outline" size={16} color={Colors[colorScheme ?? 'light'].tint} />
            <Text style={[styles.distanceText, { color: Colors[colorScheme ?? 'light'].text }]}>
              {event.distance.toFixed(2)} km
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    marginBottom: 15,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: CARD_WIDTH * 0.75,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  likeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 6,
  },
  contentContainer: {
    padding: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceText: {
    fontSize: 14,
    marginLeft: 4,
  },
}); 