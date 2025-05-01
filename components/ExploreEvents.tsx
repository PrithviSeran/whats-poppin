import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, TouchableOpacity, ScrollView, TextInput, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 60) / 3;
const LARGE_CARD_WIDTH = width - 30;

interface EventCard {
  id: number;
  title: string;
  image: any;
  description: string;
  date: string;
  location: string;
}

// Function to generate random events
const generateRandomEvents = (count: number): EventCard[] => {
  const eventTypes = [
    'Concert', 'Party', 'Festival', 'Conference', 'Workshop', 'Meetup',
    'Exhibition', 'Seminar', 'Networking', 'Show', 'Performance', 'Gala',
    'Tournament', 'Competition', 'Fair', 'Market', 'Sale', 'Launch',
    'Premiere', 'Screening', 'Reading', 'Lecture', 'Class', 'Course'
  ];

  const locations = [
    'Central Park', 'Times Square', 'Madison Square Garden', 'Brooklyn Bridge',
    'Empire State Building', 'Statue of Liberty', 'Metropolitan Museum',
    'Museum of Modern Art', 'Guggenheim Museum', 'Carnegie Hall',
    'Radio City Music Hall', 'Yankee Stadium', 'Citi Field', 'Barclays Center',
    'Javits Center', 'Jacob Javits Center', 'Pier 17', 'South Street Seaport',
    'High Line', 'Chelsea Market', 'Union Square', 'Washington Square Park',
    'Prospect Park', 'Flushing Meadows', 'Rockefeller Center', 'Grand Central',
    'Penn Station', 'Port Authority', 'World Trade Center', 'One World Trade'
  ];

  const adjectives = [
    'Amazing', 'Incredible', 'Spectacular', 'Unforgettable', 'Epic',
    'Legendary', 'Magical', 'Enchanting', 'Thrilling', 'Exciting',
    'Fabulous', 'Glorious', 'Marvelous', 'Wonderful', 'Fantastic',
    'Stunning', 'Breathtaking', 'Mesmerizing', 'Captivating', 'Charming'
  ];

  const events: EventCard[] = [];
  const currentDate = new Date();

  for (let i = 0; i < count; i++) {
    const randomDays = Math.floor(Math.random() * 365);
    const eventDate = new Date(currentDate);
    eventDate.setDate(eventDate.getDate() + randomDays);

    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const location = locations[Math.floor(Math.random() * locations.length)];
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];

    events.push({
      id: i + 1,
      title: `${adjective} ${eventType}`,
      image: require('../assets/images/balloons.png'),
      description: `Join us for an unforgettable ${eventType.toLowerCase()} at ${location}. Don't miss out on this incredible experience!`,
      date: eventDate.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      }),
      location: location
    });
  }

  return events;
};

const EXPLORE_EVENTS = generateRandomEvents(20);
const RECENT_SEARCHES = ['Concert', 'Party', 'Festival', 'Workshop'];
const TRENDING_SEARCHES = ['Summer Festival', 'Live Music', 'Food Market', 'Art Exhibition'];

export default function ExploreEvents() {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const colorScheme = useColorScheme();

  // Function to determine if an event should be large
  const isLargeEvent = (index: number) => {
    return index % 5 === 0; // Every 5th event is large
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      <View style={styles.searchContainer}>
        <LinearGradient
          colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          locations={[0, 0.3, 0.7, 1]}
          style={styles.searchGradient}
        >
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color={colorScheme === 'dark' ? '#fff' : '#000'} />
            <TextInput
              style={[styles.searchInput, { color: Colors[colorScheme ?? 'light'].text }]}
              placeholder="Search events..."
              placeholderTextColor={colorScheme === 'dark' ? '#aaa' : '#666'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={colorScheme === 'dark' ? '#fff' : '#000'} />
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>
      </View>

      {isSearchFocused ? (
        <ScrollView style={styles.searchResults}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Recent Searches</Text>
            {RECENT_SEARCHES.map((search: string, index: number) => (
              <TouchableOpacity 
                key={index} 
                style={styles.searchItem}
                onPress={() => {
                  setSearchQuery(search);
                  setIsSearchFocused(false);
                }}
              >
                <Ionicons name="time-outline" size={20} color={colorScheme === 'dark' ? '#aaa' : '#666'} />
                <Text style={[styles.searchText, { color: Colors[colorScheme ?? 'light'].text }]}>{search}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Trending</Text>
            {TRENDING_SEARCHES.map((search: string, index: number) => (
              <TouchableOpacity 
                key={index} 
                style={styles.searchItem}
                onPress={() => {
                  setSearchQuery(search);
                  setIsSearchFocused(false);
                }}
              >
                <Ionicons name="trending-up-outline" size={20} color={colorScheme === 'dark' ? '#aaa' : '#666'} />
                <Text style={[styles.searchText, { color: Colors[colorScheme ?? 'light'].text }]}>{search}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : (
        <ScrollView style={styles.exploreGrid}>
          <View style={styles.gridContainer}>
            {EXPLORE_EVENTS.map((event) => (
              <TouchableOpacity 
                key={event.id} 
                style={[
                  styles.card,
                  { backgroundColor: Colors[colorScheme ?? 'light'].card }
                ]}
              >
                <Image 
                  source={event.image} 
                  style={styles.cardImage}
                />
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, { color: Colors[colorScheme ?? 'light'].text }]}>{event.title}</Text>
                  <View style={styles.infoRow}>
                    <Ionicons name="calendar-outline" size={16} color={colorScheme === 'dark' ? '#aaa' : '#666'} />
                    <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text }]}>{event.date}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={16} color={colorScheme === 'dark' ? '#aaa' : '#666'} />
                    <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text }]}>{event.location}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    padding: 15,
  },
  searchGradient: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },
  searchResults: {
    flex: 1,
    padding: 15,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  searchText: {
    marginLeft: 10,
    fontSize: 16,
  },
  exploreGrid: {
    flex: 1,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 15,
    gap: 15,
    justifyContent: 'space-between',
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: CARD_WIDTH,
  },
  cardImage: {
    width: '100%',
    height: CARD_WIDTH * 1.2,
    resizeMode: 'cover',
  },
  cardContent: {
    padding: 10,
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
    marginLeft: 4,
  },
}); 