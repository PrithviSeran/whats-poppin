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

type ClubQuestionsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ClubQuestions'>;
};

export default function ClubQuestionsScreen({ navigation }: ClubQuestionsScreenProps) {
  const [preferences, setPreferences] = useState<UserPreferences>({
    eventType: 'club',
    musicPreference: '',
    dresscode: '',
    ageGroup: '',
  });
  
  const handleContinue = () => {
    navigation.navigate('Results', { preferences });
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Club Preferences</Text>
        <Text style={styles.subtitle}>
          Help us find the perfect club for your night out
        </Text>
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What music do you prefer?</Text>
          <OptionButton
            title="Electronic / EDM"
            icon="music-note"
            selected={preferences.musicPreference === 'Electronic'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              musicPreference: 'Electronic'
            }))}
          />
          <OptionButton
            title="Hip Hop / R&B"
            icon="music-note"
            selected={preferences.musicPreference === 'Hip Hop'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              musicPreference: 'Hip Hop'
            }))}
          />
          <OptionButton
            title="Latin / Reggaeton"
            icon="music-note"
            selected={preferences.musicPreference === 'Latin'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              musicPreference: 'Latin'
            }))}
          />
          <OptionButton
            title="Top 40 / Pop"
            icon="music-note"
            selected={preferences.musicPreference === 'Pop'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              musicPreference: 'Pop'
            }))}
          />
          <OptionButton
            title="Retro / 80s & 90s"
            icon="music-note"
            selected={preferences.musicPreference === 'Retro'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              musicPreference: 'Retro'
            }))}
          />
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dress Code Preference</Text>
          <OptionButton
            title="Casual"
            subtitle="T-shirts, jeans, sneakers allowed"
            icon="checkroom"
            selected={preferences.dresscode === 'Casual'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              dresscode: 'Casual'
            }))}
          />
          <OptionButton
            title="Smart Casual"
            subtitle="No athletic wear or sneakers"
            icon="checkroom"
            selected={preferences.dresscode === 'Smart casual'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              dresscode: 'Smart casual'
            }))}
          />
          <OptionButton
            title="Dressy"
            subtitle="Dress to impress"
            icon="checkroom"
            selected={preferences.dresscode === 'Dressy'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              dresscode: 'Dressy'
            }))}
          />
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Age Group</Text>
          <OptionButton
            title="18+"
            icon="people"
            selected={preferences.ageGroup === '18+'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              ageGroup: '18+'
            }))}
          />
          <OptionButton
            title="21+"
            icon="people"
            selected={preferences.ageGroup === '21+'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              ageGroup: '21+'
            }))}
          />
          <OptionButton
            title="25+"
            subtitle="Mature crowd"
            icon="people"
            selected={preferences.ageGroup === '25+'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              ageGroup: '25+'
            }))}
          />
        </View>
        
        <View style={styles.buttonContainer}>
          <Button 
            title="Find Clubs" 
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