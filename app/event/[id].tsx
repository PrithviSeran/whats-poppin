import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import EventDetailModal from '@/components/EventDetailModal';
import { EventCard } from '@/lib/GlobalDataManager';

export default function SharedEventPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [event, setEvent] = useState<EventCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvent = async () => {
      if (!id) {
        setError('No event ID provided');
        setLoading(false);
        return;
      }

      try {
        console.log('Fetching shared event with ID:', id);
        
        // Fetch the event details from Supabase
        const { data: event, error } = await supabase
          .from('new_events')
          .select('*')
          .eq('id', parseInt(id, 10))
          .single();

        if (error) {
          console.error('Error fetching shared event:', error);
          setError('Event not found');
          setLoading(false);
          return;
        }

        if (!event) {
          setError('Event not found');
          setLoading(false);
          return;
        }

        // Add image URLs to the event
        try {
          const randomImageIndex = Math.floor(Math.random() * 5);
          const imageUrl = `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/event-images/${event.id}/${randomImageIndex}.jpg`;
          
          // Create all 5 image URLs
          const allImages = Array.from({ length: 5 }, (_, i) => 
            `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/event-images/${event.id}/${i}.jpg`
          );

          setEvent({ ...event, image: imageUrl, allImages });
        } catch (e) {
          console.log(`No image found for event ${event.id}`);
          setEvent({ ...event, image: null, allImages: [] });
        }

        setLoading(false);
      } catch (error) {
        console.error('Error handling shared event:', error);
        setError('Failed to load event');
        setLoading(false);
      }
    };

    fetchEvent();
  }, [id]);

  const handleClose = () => {
    // Navigate back to the main app (home/discover tab)
    router.replace('/(tabs)');
  };

  const handleError = () => {
    Alert.alert(
      'Event Not Found',
      'The shared event could not be found. You will be redirected to the main app.',
      [
        {
          text: 'OK',
          onPress: () => router.replace('/(tabs)')
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
        <ActivityIndicator size="large" color="#FF0005" />
        <Text style={[styles.loadingText, { color: Colors[colorScheme ?? 'light'].text }]}>
          Loading shared event...
        </Text>
      </View>
    );
  }

  if (error || !event) {
    // Show error and auto-redirect after a delay
    useEffect(() => {
      const timer = setTimeout(() => {
        handleError();
      }, 2000);

      return () => clearTimeout(timer);
    }, []);

    return (
      <View style={[styles.container, styles.centered, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
        <Text style={[styles.errorText, { color: Colors[colorScheme ?? 'light'].text }]}>
          {error || 'Event not found'}
        </Text>
        <Text style={[styles.errorSubtext, { color: Colors[colorScheme ?? 'light'].text }]}>
          Redirecting to main app...
        </Text>
      </View>
    );
  }

  // Show the event in a modal
  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      <EventDetailModal
        visible={true}
        event={event}
        onClose={handleClose}
        userLocation={null} // Could be enhanced to get user location
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
}); 