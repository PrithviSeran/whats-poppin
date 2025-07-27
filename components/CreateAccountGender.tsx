import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  Platform,
  Image,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import CreateAccountProgressBar from './CreateAccountProgressBar';

const { width } = Dimensions.get('window');
const LOGO_IMAGE_LIGHT = require('../assets/images/logo-light.png');
const LOGO_IMAGE_DARK = require('../assets/images/logo.png');

type RootStackParamList = {
  'create-account-password': { userData: string };
};

type CreateAccountGenderRouteProp = RouteProp<{
  'create-account-gender': { userData: string };
}, 'create-account-gender'>;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const CreateAccountGender = ({ route }: { route: CreateAccountGenderRouteProp }) => {
  const [selectedGender, setSelectedGender] = useState<'Male' | 'Female' | null>(null);
  const navigation = useNavigation<NavigationProp>();
  const colorScheme = useColorScheme();
  const userData = route?.params?.userData ? JSON.parse(route.params.userData) : {};

  const handleNext = () => {
    if (selectedGender) {
      navigation.navigate('create-account-password', {
        userData: JSON.stringify({ ...userData, gender: selectedGender }),
      });
    }
  };

  const genderOptions = [
    { value: 'Male', icon: 'person-outline', label: 'Male' },
    { value: 'Female', icon: 'person-outline', label: 'Female' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="chevron-back" size={28} color="#9E95BD" />
      </TouchableOpacity>

      <CreateAccountProgressBar
        currentStep={5}
        totalSteps={7}
        stepLabels={['Name', 'Username', 'Email', 'Birthday', 'Gender', 'Password', 'Location']}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerContainer}>
          <View style={styles.headerRow}>
            <Image
              source={colorScheme === 'dark' ? LOGO_IMAGE_DARK : LOGO_IMAGE_LIGHT}
              style={colorScheme === 'dark' ? styles.logo : styles.logoLight}
              resizeMode="contain"
            />
          </View>
        </View>

        <View style={styles.contentContainer}>
          <View style={styles.titleContainer}>
            <Text style={[styles.titleLarge, { color: Colors[colorScheme ?? 'light'].text }]}>
              What's your gender?
            </Text>
            <Text style={[styles.subtitle, { color: Colors[colorScheme ?? 'light'].text }]}>
              This helps us personalize your experience
            </Text>
          </View>

          <View style={styles.genderOptionsContainer}>
            {genderOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.genderButton,
                  {
                    backgroundColor: selectedGender === option.value
                      ? Colors[colorScheme ?? 'light'].card
                      : Colors[colorScheme ?? 'light'].card,
                    borderColor: selectedGender === option.value
                      ? '#9E95BD'
                      : colorScheme === 'dark' ? '#333' : '#E5E5E7',
                  }
                ]}
                onPress={() => setSelectedGender(option.value as 'Male' | 'Female')}
              >
                <View style={[
                  styles.genderIconContainer,
                  {
                    backgroundColor: selectedGender === option.value ? '#9E95BD' : 'transparent',
                  }
                ]}>
                  <Ionicons 
                    name={option.icon as any}
                    size={24} 
                    color={selectedGender === option.value ? 'white' : '#9E95BD'} 
                  />
                </View>
                <Text style={[
                  styles.genderButtonText,
                  { 
                    color: selectedGender === option.value 
                      ? '#9E95BD' 
                      : Colors[colorScheme ?? 'light'].text,
                    fontWeight: selectedGender === option.value ? '600' : '500',
                  }
                ]}>
                  {option.label}
                </Text>
                {selectedGender === option.value && (
                  <View style={styles.checkmarkContainer}>
                    <Ionicons name="checkmark-circle" size={24} color="#9E95BD" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            onPress={handleNext} 
            disabled={!selectedGender}
            style={styles.buttonWrapper}
          >
            <LinearGradient
              colors={['#FF0005', '#FF4D9D', '#FF69E2', '#B97AFF', '#9E95BD']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              locations={[0, 0.25, 0.5, 0.75, 1]}
              style={[
                styles.nextButton,
                !selectedGender && styles.disabledButton,
              ]}
            >
              <Text style={styles.nextButtonText}>Continue</Text>
              <Ionicons name="chevron-forward" size={20} color="white" style={styles.buttonIcon} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(158, 149, 189, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: width * 0.7,
    height: width * 0.4,
  },
  logoLight: {
    width: width * 0.5,
    height: width * 0.27,
    marginTop: 10,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 400,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  titleLarge: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
    fontWeight: '400',
  },
  genderOptionsContainer: {
    gap: 16,
    marginBottom: 40,
  },
  genderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  genderIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  genderButtonText: {
    flex: 1,
    fontSize: 18,
  },
  checkmarkContainer: {
    marginLeft: 12,
  },
  buttonContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  buttonWrapper: {
    width: '100%',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  buttonIcon: {
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default CreateAccountGender;
