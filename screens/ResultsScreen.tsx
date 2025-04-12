import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  FlatList,
  ActivityIndicator,
  Image
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation';
import { Event, UserPreferences } from '../types';
import { matchEvents } from '../utils/matchEvents';
import Card from '../components/Card';
import Button from '../components/Button';

type ResultsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Results'>;
  route: RouteProp<RootStackParamList, 'Results'>;
};

export default function ResultsScreen({ navigation, route }: ResultsScreenProps) {
  const { preferences } = route.params;
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  
  useEffect(() => {
    // Simulate API call with a delay
    const timer = setTimeout(() => {
      const matchedEvents = matchEvents(preferences);
      setEvents(matchedEvents);
      setLoading(false);
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [preferences]);
  
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Image 
        source={{ uri: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1' }} 
        style={styles.emptyImage}
        resizeMode="cover"
      />
      <Text style={styles.emptyTitle}>No Events Found</Text>
      <Text style={styles.emptyText}>
        We couldn't find any events matching your preferences. Try adjusting your criteria.
      </Text>
      <Button 
        title="Go Back" 
        onPress={() => navigation.goBack()}
        primary
        style={styles.emptyButton}
      />
    </View>
  );
  
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Finding the perfect events for you...</Text>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Your Matches</Text>
        <Text style={styles.subtitle}>
          Based on your preferences, here are tonight's best options
        </Text>
      </View>
      
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card 
            event={item} 
            onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
      />
      
      <View style={styles.footer}>
        <Button 
          title="Start Over" 
          onPress={() => navigation.navigate('EventType')}
          outline
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  header: {
    padding: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyImage: {
    width: 200,
    height: 200,
    borderRadius: 100,
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  emptyButton: {
    width: '100%',
  },
});