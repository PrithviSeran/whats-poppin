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

type PartyQuestionsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PartyQuestions'>;
};

export default function PartyQuestionsScreen({ navigation }: PartyQuestionsScreenProps) {
  const [preferences, setPreferences] = useState<UserPreferences>({
    eventType: 'party',
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
        <Text style={styles.title}>Party Preferences</Text>
        <Text style={styles.subtitle}>
          Help us find the perfect party for your night out
        </Text>
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What type of party are you looking for?</Text>
          <OptionButton
            title="House Party"
            icon="house"
            selected={preferences.musicPreference === 'House Party'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              musicPreference: 'House Party'
            }))}
          />
          <OptionButton
            title="Rooftop Party"
            icon="deck"
            selected={preferences.musicPreference === 'Rooftop'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              musicPreference: 'Rooftop'
            }))}
          />
          <OptionButton
            title="Warehouse/Rave"
            icon="warehouse"
            selected={preferences.musicPreference === 'Warehouse'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              musicPreference: 'Warehouse'
            }))}
          />
          <OptionButton
            title="Pool Party"
            icon="pool"
            selected={preferences.musicPreference === 'Pool'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              musicPreference: 'Pool'
            }))}
          />
          <OptionButton
            title="Theme Party"
            icon="celebration"
            selected={preferences.musicPreference === 'Theme'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              musicPreference: 'Theme'
            }))}
          />
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dress Code</Text>
          <OptionButton
            title="Casual"
            subtitle="Comfortable, everyday attire"
            icon="checkroom"
            selected={preferences.dresscode === 'Casual'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              dresscode: 'Casual'
            }))}
          />
          <OptionButton
            title="Semi-Formal"
            subtitle="Dress shirts, nice tops, dresses"
            icon="checkroom"
            selected={preferences.dresscode === 'Semi-Formal'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              dresscode: 'Semi-Formal'
            }))}
          />
          <OptionButton
            title="Costume/Theme"
            subtitle="Specific theme or costume required"
            icon="checkroom"
            selected={preferences.dresscode === 'Costume'}
            onPress={() => setPreferences(prev => ({
              ...prev,
              dresscode: 'Costume'
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
            title="Find Parties" 
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