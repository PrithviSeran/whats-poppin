import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView,
  TextInput
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { UserPreferences, EventType } from '../types';
import Button from '../components/Button';
import OptionButton from '../components/OptionButton';

type OtherQuestionsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'OtherQuestions'>;
};

export default function OtherQuestionsScreen({ navigation }: OtherQuestionsScreenProps) {
  const [preferences, setPreferences] = useState<UserPreferences>({
    eventType: 'other',
    priceRange: '',
    location: '',
  });
  
  const [selectedType, setSelectedType] = useState<EventType>('other');
  
  const handleTypeSelect = (type: EventType) => {
    setSelectedType(type);
    setPreferences(prev => ({
      ...prev,
      eventType: type
    }));
  };
  
  const handleContinue = () => {
    navigation.navigate('Results', { preferences });
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Other Activities</Text>
        <Text style={styles.subtitle}>
          Tell us more about what you're looking for tonight
        </Text>
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What type of activity?</Text>
          <OptionButton
            title="Concert"
            icon="music-note"
            selected={selectedType === 'concert'}
            onPress={() => handleTypeSelect('concert')}
          />
          <OptionButton
            title="Theater"
            icon="theater-comedy"
            selected={selectedType === 'theater'}
            onPress={() => handleTypeSelect('theater')}
          />
          <OptionButton
            title="Other"
            icon="more-horiz"
            selected={selectedType === 'other'}
            onPress={() => handleTypeSelect('other')}
          />
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Price Range</Text>
          <View style={styles.optionsRow}>
            {['$', '$$', '$$$', '$$$$'].map((price, index) => (
              <OptionButton
                key={index}
                title={price}
                selected={preferences.priceRange === price}
                onPress={() => setPreferences(prev => ({
                  ...prev,
                  priceRange: price
                }))}
                style={styles.priceOption}
              />
            ))}
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferred Location</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter neighborhood or area"
            value={preferences.location}
            onChangeText={(text) => setPreferences(prev => ({
              ...prev,
              location: text
            }))}
          />
        </View>
        
        <View style={styles.buttonContainer}>
          <Button 
            title="Find Activities" 
            onPress={handleContinue}
            primary
          />
          <Button 
            title="Back" 
            onPress={() => navigation.goBack()}
            outline
            style={styles.backButton}
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  priceOption: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  buttonContainer: {
    marginVertical: 24,
  },
  backButton: {
    marginTop: 12,
  },
});