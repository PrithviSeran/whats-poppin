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

type SportsQuestionsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'SportsQuestions'>;
};

export default function SportsQuestionsScreen({ navigation }: SportsQuestionsScreenProps) {
  const [preferences, setPreferences] = useState<UserPreferences>({
    eventType: 'sports',
    sportPreference: '',
    location: '',
  });
  
  const handleContinue = () => {
    navigation.navigate('Results', { preferences });
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Sports Preferences</Text>
        <Text style={styles.subtitle}>
          Help us find the perfect sports activity for tonight
        </Text>
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What sport are you interested in?</Text>
          <OptionButton
            title="Basketball"
            icon="sports-basketball"
            selected={preferences.sportPreference === 'Basketball'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              sportPreference: 'Basketball'
            }))}
          />
          <OptionButton
            title="Soccer"
            icon="sports-soccer"
            selected={preferences.sportPreference === 'Soccer'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              sportPreference: 'Soccer'
            }))}
          />
          <OptionButton
            title="Volleyball"
            icon="sports-volleyball"
            selected={preferences.sportPreference === 'Volleyball'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              sportPreference: 'Volleyball'
            }))}
          />
          <OptionButton
            title="Tennis"
            icon="sports-tennis"
            selected={preferences.sportPreference === 'Tennis'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              sportPreference: 'Tennis'
            }))}
          />
          <OptionButton
            title="Yoga"
            icon="self-improvement"
            selected={preferences.sportPreference === 'Yoga'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              sportPreference: 'Yoga'
            }))}
          />
          <OptionButton
            title="Other"
            icon="more-horiz"
            selected={preferences.sportPreference === 'Other'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              sportPreference: 'Other'
            }))}
          />
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferred Location</Text>
          <OptionButton
            title="Indoor"
            icon="home"
            selected={preferences.location === 'Indoor'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              location: 'Indoor'
            }))}
          />
          <OptionButton
            title="Outdoor"
            icon="terrain"
            selected={preferences.location === 'Outdoor'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              location: 'Outdoor'
            }))}
          />
          <OptionButton
            title="Either"
            icon="all-inclusive"
            selected={preferences.location === 'Either'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              location: 'Either'
            }))}
          />
        </View>
        
        <View style={styles.buttonContainer}>
          <Button 
            title="Find Sports Activities" 
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
  buttonContainer: {
    marginVertical: 24,
  },
  backButton: {
    marginTop: 12,
  },
});