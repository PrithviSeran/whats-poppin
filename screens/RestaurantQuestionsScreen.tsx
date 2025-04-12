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
import { UserPreferences } from '../types';
import Button from '../components/Button';
import OptionButton from '../components/OptionButton';
import CheckboxOption from '../components/CheckboxOption';

type RestaurantQuestionsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'RestaurantQuestions'>;
};

export default function RestaurantQuestionsScreen({ navigation }: RestaurantQuestionsScreenProps) {
  const [preferences, setPreferences] = useState<UserPreferences>({
    eventType: 'restaurant',
    partySize: 2,
    dietaryRestrictions: [],
    priceRange: '',
    location: '',
  });
  
  const [dietaryOptions, setDietaryOptions] = useState({
    vegetarian: false,
    vegan: false,
    glutenFree: false,
    dairyFree: false,
    nutFree: false,
  });
  
  const updateDietaryRestrictions = () => {
    const restrictions: string[] = [];
    if (dietaryOptions.vegetarian) restrictions.push('vegetarian');
    if (dietaryOptions.vegan) restrictions.push('vegan');
    if (dietaryOptions.glutenFree) restrictions.push('gluten-free');
    if (dietaryOptions.dairyFree) restrictions.push('dairy-free');
    if (dietaryOptions.nutFree) restrictions.push('nut-free');
    
    setPreferences(prev => ({
      ...prev,
      dietaryRestrictions: restrictions
    }));
  };
  
  const handleContinue = () => {
    navigation.navigate('Results', { preferences });
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Restaurant Preferences</Text>
        <Text style={styles.subtitle}>
          Help us find the perfect restaurant for you tonight
        </Text>
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How many people are in your party?</Text>
          <View style={styles.optionsRow}>
            {[1, 2, 3, 4, '5+'].map((size, index) => (
              <OptionButton
                key={index}
                title={size.toString()}
                selected={preferences.partySize === (size === '5+' ? 5 : size)}
                onPress={() => setPreferences(prev => ({
                  ...prev,
                  partySize: size === '5+' ? 5 : Number(size)
                }))}
                style={styles.sizeOption}
                textStyle={styles.sizeOptionText}
              />
            ))}
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Any dietary restrictions?</Text>
          <View style={styles.checkboxGroup}>
            <CheckboxOption
              label="Vegetarian"
              checked={dietaryOptions.vegetarian}
              onToggle={() => {
                setDietaryOptions(prev => ({
                  ...prev,
                  vegetarian: !prev.vegetarian
                }));
                updateDietaryRestrictions();
              }}
            />
            <CheckboxOption
              label="Vegan"
              checked={dietaryOptions.vegan}
              onToggle={() => {
                setDietaryOptions(prev => ({
                  ...prev,
                  vegan: !prev.vegan
                }));
                updateDietaryRestrictions();
              }}
            />
            <CheckboxOption
              label="Gluten-Free"
              checked={dietaryOptions.glutenFree}
              onToggle={() => {
                setDietaryOptions(prev => ({
                  ...prev,
                  glutenFree: !prev.glutenFree
                }));
                updateDietaryRestrictions();
              }}
            />
            <CheckboxOption
              label="Dairy-Free"
              checked={dietaryOptions.dairyFree}
              onToggle={() => {
                setDietaryOptions(prev => ({
                  ...prev,
                  dairyFree: !prev.dairyFree
                }));
                updateDietaryRestrictions();
              }}
            />
            <CheckboxOption
              label="Nut-Free"
              checked={dietaryOptions.nutFree}
              onToggle={() => {
                setDietaryOptions(prev => ({
                  ...prev,
                  nutFree: !prev.nutFree
                }));
                updateDietaryRestrictions();
              }}
            />
          </View>
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
            title="Find Restaurants" 
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
  sizeOption: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 12,
    minWidth: 60,
  },
  sizeOptionText: {
    textAlign: 'center',
  },
  priceOption: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 12,
  },
  checkboxGroup: {
    marginTop: 8,
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