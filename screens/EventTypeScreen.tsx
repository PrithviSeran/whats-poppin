import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView 
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { EventType } from '../types';
import OptionButton from '../components/OptionButton';
import Button from '../components/Button';

type EventTypeScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'EventType'>;
};

export default function EventTypeScreen({ navigation }: EventTypeScreenProps) {
  const [selectedType, setSelectedType] = useState<EventType | null>(null);
  
  const handleContinue = () => {
    if (!selectedType) return;
    
    switch (selectedType) {
      case 'restaurant':
        navigation.navigate('RestaurantQuestions');
        break;
      case 'club':
        navigation.navigate('ClubQuestions');
        break;
      case 'bar':
        navigation.navigate('BarQuestions');
        break;
      case 'party':
        navigation.navigate('PartyQuestions');
        break;
      case 'sports':
        navigation.navigate('SportsQuestions');
        break;
      default:
        navigation.navigate('OtherQuestions');
        break;
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <Text style={styles.title}>What do you feel like doing tonight?</Text>
        <Text style={styles.subtitle}>
          Select the type of activity you're interested in
        </Text>
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <OptionButton
          title="Restaurant"
          subtitle="Find a great place to eat"
          icon="restaurant"
          selected={selectedType === 'restaurant'}
          onPress={() => setSelectedType('restaurant')}
        />
        
        <OptionButton
          title="Club"
          subtitle="Dance the night away"
          icon="nightlife"
          selected={selectedType === 'club'}
          onPress={() => setSelectedType('club')}
        />
        
        <OptionButton
          title="Bar"
          subtitle="Grab drinks with friends"
          icon="local-bar"
          selected={selectedType === 'bar'}
          onPress={() => setSelectedType('bar')}
        />
        
        <OptionButton
          title="Party"
          subtitle="Find a party or social gathering"
          icon="celebration"
          selected={selectedType === 'party'}
          onPress={() => setSelectedType('party')}
        />
        
        <OptionButton
          title="Sports"
          subtitle="Join a drop-in sports activity"
          icon="sports-basketball"
          selected={selectedType === 'sports'}
          onPress={() => setSelectedType('sports')}
        />
        
        <OptionButton
          title="Concert"
          subtitle="Enjoy live music performances"
          icon="music-note"
          selected={selectedType === 'concert'}
          onPress={() => setSelectedType('concert')}
        />
        
        <OptionButton
          title="Theater"
          subtitle="Watch a play or comedy show"
          icon="theater-comedy"
          selected={selectedType === 'theater'}
          onPress={() => setSelectedType('theater')}
        />
        
        <OptionButton
          title="Other"
          subtitle="Something else in mind"
          icon="more-horiz"
          selected={selectedType === 'other'}
          onPress={() => setSelectedType('other')}
        />
        
        <View style={styles.buttonContainer}>
          <Button 
            title="Continue" 
            onPress={handleContinue}
            primary
            disabled={!selectedType}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
  scrollView: {
    flex: 1,
    paddingHorizontal: 24,
  },
  buttonContainer: {
    marginVertical: 24,
  },
});