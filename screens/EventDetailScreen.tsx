import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  ActivityIndicator
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation';
import { Event } from '../types';
import { mockEvents } from '../data/mockEvents';
import Button from '../components/Button';
import { MaterialIcons } from '@expo/vector-icons';

type EventDetailScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'EventDetail'>;
  route: RouteProp<RootStackParamList, 'EventDetail'>;
};

export default function EventDetailScreen({ navigation, route }: EventDetailScreenProps) {
  const { eventId } = route.params;
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<Event | null>(null);
  
  useEffect(() => {
    // Simulate API call with a delay
    const timer = setTimeout(() => {
      const foundEvent = mockEvents.find(e => e.id === eventId) || null;
      setEvent(foundEvent);
      setLoading(false);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [eventId]);
  
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading event details...</Text>
      </SafeAreaView>
    );
  }
  
  if (!event) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={64} color="#e74c3c" />
        <Text style={styles.errorTitle}>Event Not Found</Text>
        <Text style={styles.errorText}>
          We couldn't find the event you're looking for.
        </Text>
        <Button 
          title="Go Back" 
          onPress={() => navigation.goBack()}
          primary
          style={styles.errorButton}
        />
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: event.image }} 
            style={styles.image}
            resizeMode="cover"
          />
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>{event.name}</Text>
            <Text style={styles.type}>
              {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <MaterialIcons name="location-on" size={20} color="#3498db" />
              <Text style={styles.infoText}>{event.location}</Text>
            </View>
            <View style={styles.infoItem}>
              <MaterialIcons name="access-time" size={20} color="#3498db" />
              <Text style={styles.infoText}>{event.time}</Text>
            </View>
            <View style={styles.infoItem}>
              <MaterialIcons name="attach-money" size={20} color="#3498db" />
              <Text style={styles.infoText}>{event.price}</Text>
            </View>
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.description}>{event.description}</Text>
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tags</Text>
            <View style={styles.tagsContainer}>
              {event.tags.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
          
          {event.type === 'restaurant' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Restaurant Details</Text>
              {event.cuisine && (
                <View style={styles.detailItem}>
                  <MaterialIcons name="restaurant" size={20} color="#3498db" />
                  <Text style={styles.detailText}>Cuisine: {event.cuisine}</Text>
                </View>
              )}
              {event.capacity && (
                <View style={styles.detailItem}>
                  <MaterialIcons name="people" size={20} color="#3498db" />
                  <Text style={styles.detailText}>Capacity: {event.capacity} people</Text>
                </View>
              )}
              {event.dietaryOptions && event.dietaryOptions.length > 0 && (
                <View style={styles.detailItem}>
                  <MaterialIcons name="check-circle" size={20} color="#3498db" />
                  <Text style={styles.detailText}>
                    Dietary Options: {event.dietaryOptions.join(', ')}
                  </Text>
                </View>
              )}
            </View>
          )}
          
          {(event.type === 'club' || event.type === 'party') && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Venue Details</Text>
              {event.musicGenre && (
                <View style={styles.detailItem}>
                  <MaterialIcons name="music-note" size={20} color="#3498db" />
                  <Text style={styles.detailText}>Music: {event.musicGenre}</Text>
                </View>
              )}
              {event.ageRestriction && (
                <View style={styles.detailItem}>
                  <MaterialIcons name="person" size={20} color="#3498db" />
                  <Text style={styles.detailText}>Age: {event.ageRestriction}</Text>
                </View>
              )}
              {event.dresscode && (
                <View style={styles.detailItem}>
                  <MaterialIcons name="checkroom" size={20} color="#3498db" />
                  <Text style={styles.detailText}>Dress Code: {event.dresscode}</Text>
                </View>
              )}
            </View>
          )}
          
          {event.type === 'sports' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Activity Details</Text>
              {event.sportType && (
                <View style={styles.detailItem}>
                  <MaterialIcons name="sports" size={20} color="#3498db" />
                  <Text style={styles.detailText}>Sport: {event.sportType}</Text>
                </View>
              )}
            </View>
          )}
          
          <View style={styles.buttonContainer}>
            <Button 
              title="Get Directions" 
              onPress={() => Linking.openURL(`https://maps.google.com/?q=${event.location}`)}
              primary
              style={styles.button}
            />
            <Button 
              title="Share Event" 
              onPress={() => {
                // Share functionality would go here
                alert('Sharing functionality would be implemented here');
              }}
              outline
              style={styles.button}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorButton: {
    width: '100%',
    maxWidth: 300,
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 300,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 24,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  type: {
    fontSize: 16,
    color: '#3498db',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 14,
    color: '#3498db',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 16,
    color: '#555',
    marginLeft: 8,
  },
  buttonContainer: {
    marginTop: 8,
  },
  button: {
    marginBottom: 12,
  },
});