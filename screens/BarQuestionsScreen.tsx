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
import { UserPreferences } from '../types';
import Button from '../components/Button';
import OptionButton from '../components/OptionButton';
import CheckboxOption from '../components/CheckboxOption';

type BarQuestionsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'BarQuestions'>;
};

export default function BarQuestionsScreen({ navigation }: BarQuestionsScreenProps) {
  const [preferences, setPreferences] = useState<UserPreferences>({
    eventType: 'bar',
    priceRange: '',
    musicPreference: '',
  });
  
  const [barFeatures, setBarFeatures] = useState({
    liveMusic: false,
    sports: false,
    games: false,
    dancing: false,
    outdoor: false,
  });
  
  const handleContinue = () => {
    navigation.navigate('Results', { preferences });
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Bar Preferences</Text>
        <Text style={styles.subtitle}>
          Help us find the perfect bar for your night out
        </Text>
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What type of bar are you looking for?</Text>
          <OptionButton
            title="Cocktail Bar"
            icon="local-bar"
            selected={preferences.musicPreference === 'Cocktail'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              musicPreference: 'Cocktail'
            }))}
          />
          <OptionButton
            title="Sports Bar"
            icon="sports-football"
            selected={preferences.musicPreference === 'Sports'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              musicPreference: 'Sports'
            }))}
          />
          <OptionButton
            title="Dive Bar"
            icon="local-bar"
            selected={preferences.musicPreference === 'Dive'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              musicPreference: 'Dive'
            }))}
          />
          <OptionButton
            title="Wine Bar"
            icon="wine-bar"
            selected={preferences.musicPreference === 'Wine'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              musicPreference: 'Wine'
            }))}
          />
          <OptionButton
            title="Brewery/Beer Bar"
            icon="sports-bar"
            selected={preferences.musicPreference === 'Beer'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              musicPreference: 'Beer'
            }))}
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
          <Text style={styles.sectionTitle}>Features</Text>
          <View style={styles.checkboxGroup}>
            <CheckboxOption
              label="Live Music"
              checked={barFeatures.liveMusic}
              onToggle={() => setBarFeatures(prev => ({
                ...prev,
                liveMusic: !prev.liveMusic
              }))}
            />
            <CheckboxOption
              label="Sports Viewing"
              checked={barFeatures.sports}
              onToggle={() => setBarFeatures(prev => ({
                ...prev,
                sports: !prev.sports
              }))}
            />
            <CheckboxOption
              label="Games (Pool, Darts, etc.)"
              checked={barFeatures.games}
              onToggle={() => setBarFeatures(prev => ({
                ...prev,
                games: !prev.games
              }))}
            />
            <CheckboxOption
              label="Dancing"
              checked={barFeatures.dancing}
              onToggle={() => setBarFeatures(prev => ({
                ...prev,
                dancing: !prev.dancing
              }))}
            />
            <CheckboxOption
              label="Outdoor Seating"
              checked={barFeatures.outdoor}
              onToggle={() => setBarFeatures(prev => ({
                ...prev,
                outdoor: !prev.outdoor
              }))}
            />
          </View>
        </View>
        
        <View style={styles.buttonContainer}>
          <Button 
            title="Find Bars" 
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
  checkboxGroup: {
    marginTop: 8,
  },
  buttonContainer: {
    marginVertical: 24,
  },
  backButton: {
    marginTop: 12,
  },
});