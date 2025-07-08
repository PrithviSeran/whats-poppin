import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Image,
  ScrollView,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RouteProp, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaskedView from '@react-native-masked-view/masked-view';
import CreateAccountProgressBar from './CreateAccountProgressBar';

const { width } = Dimensions.get('window');
const LOGO_IMAGE_LIGHT = require('../assets/images/logo-light.png');
const LOGO_IMAGE_DARK = require('../assets/images/logo.png');

type RootStackParamList = {
  'create-account-finished': { userData: string };
};

type CreateAccountLocationRouteProp = RouteProp<{
  'create-account-location': { userData: string };
}, 'create-account-location'>;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function CreateAccountLocation({ route }: { route: CreateAccountLocationRouteProp }) {
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [manualLocation, setManualLocation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const colorScheme = useColorScheme();
  const navigation = useNavigation<NavigationProp>();
  const userData = route?.params?.userData ? JSON.parse(route.params.userData) : {};
  const inputScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    checkLocationPermission();
  }, []);

  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      if (status === 'granted') getCurrentLocation();
    } catch (error) {
      console.error('Error checking location permission:', error);
      Alert.alert('Error', 'Failed to check location permission');
    }
  };

  const getCurrentLocation = async () => {
    try {
      setIsLoading(true);
      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (address) {
        const locationString = `${address.city}, ${address.region}`;
        setCurrentLocation(locationString);
        setManualLocation(locationString);
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get your current location');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = async () => {
    try {
      setIsLoading(true);
      const locationData = {
        useLocation: locationPermission,
        location: locationPermission ? currentLocation : manualLocation,
      };
      await AsyncStorage.setItem('userLocation', JSON.stringify(locationData));
      // Include default preferences since we're skipping the preferences step
      const defaultPreferences = {
        eventTypes: ['Food & Drink', 'Outdoor / Nature', 'Leisure & Social', 'Games & Entertainment', 'Arts & Culture', 'Nightlife & Parties', 'Wellness & Low-Energy', 'Experiences & Activities', 'Travel & Discovery'],
        timePreferences: { start: '9:00', end: '22:00' },
        locationPreferences: [],
        travelDistance: 10,
        dayPreferences: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      };
      
      navigation.navigate('create-account-finished', {
        userData: JSON.stringify({ ...userData, location: locationData, preferences: defaultPreferences }),
      });
    } catch (error) {
      console.error('Error saving location:', error);
      Alert.alert('Error', 'Failed to save location preference');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePermissionChange = async (allow: boolean) => {
    setLocationPermission(allow);
    if (allow) {
      await getCurrentLocation();
    } else {
      setCurrentLocation(null);
      setManualLocation('');
    }
  };

  const handleInputFocus = () => {
    setInputFocused(true);
    Animated.spring(inputScaleAnim, {
      toValue: 1.02,
      useNativeDriver: true,
    }).start();
  };

  const handleInputBlur = () => {
    setInputFocused(false);
    Animated.spring(inputScaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="chevron-back" size={28} color="#9E95BD" />
      </TouchableOpacity>

      <CreateAccountProgressBar
        currentStep={6}
        totalSteps={6}
        stepLabels={['Name', 'Email', 'Birthday', 'Gender', 'Password', 'Location']}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
                Almost there!
              </Text>
              <Text style={[styles.subtitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                Help us find events near you
              </Text>
            </View>

            <View style={styles.locationSection}>
              <View style={styles.sectionHeader}>
                <Ionicons name="location-outline" size={24} color="#9E95BD" />
                <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                  Location Access
                </Text>
              </View>
              
              <Text style={[styles.sectionDescription, { color: Colors[colorScheme ?? 'light'].text }]}>
                Allow location access to discover exciting events nearby and get personalized recommendations.
              </Text>

              <View style={styles.permissionOptions}>
                <TouchableOpacity
                  style={[
                    styles.permissionOption,
                    {
                      backgroundColor: Colors[colorScheme ?? 'light'].card,
                      borderColor: locationPermission === true ? '#9E95BD' : colorScheme === 'dark' ? '#333' : '#E5E5E7',
                    }
                  ]}
                  onPress={() => handlePermissionChange(true)}
                >
                  <View style={[
                    styles.permissionIconContainer,
                    { backgroundColor: locationPermission === true ? '#9E95BD' : 'transparent' }
                  ]}>
                    <Ionicons 
                      name="location" 
                      size={24} 
                      color={locationPermission === true ? 'white' : '#9E95BD'} 
                    />
                  </View>
                  <View style={styles.permissionContent}>
                    <Text style={[
                      styles.permissionTitle,
                      { 
                        color: locationPermission === true ? '#9E95BD' : Colors[colorScheme ?? 'light'].text,
                        fontWeight: locationPermission === true ? '600' : '500',
                      }
                    ]}>
                      Use my location
                    </Text>
                    <Text style={[styles.permissionDescription, { color: Colors[colorScheme ?? 'light'].text }]}>
                      Get personalized event recommendations
                    </Text>
                  </View>
                  {locationPermission === true && (
                    <Ionicons name="checkmark-circle" size={24} color="#9E95BD" />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.permissionOption,
                    {
                      backgroundColor: Colors[colorScheme ?? 'light'].card,
                      borderColor: locationPermission === false ? '#9E95BD' : colorScheme === 'dark' ? '#333' : '#E5E5E7',
                    }
                  ]}
                  onPress={() => handlePermissionChange(false)}
                >
                  <View style={[
                    styles.permissionIconContainer,
                    { backgroundColor: locationPermission === false ? '#9E95BD' : 'transparent' }
                  ]}>
                    <Ionicons 
                      name="location-outline" 
                      size={24} 
                      color={locationPermission === false ? 'white' : '#9E95BD'} 
                    />
                  </View>
                  <View style={styles.permissionContent}>
                    <Text style={[
                      styles.permissionTitle,
                      { 
                        color: locationPermission === false ? '#9E95BD' : Colors[colorScheme ?? 'light'].text,
                        fontWeight: locationPermission === false ? '600' : '500',
                      }
                    ]}>
                      Enter manually
                    </Text>
                    <Text style={[styles.permissionDescription, { color: Colors[colorScheme ?? 'light'].text }]}>
                      Type your city or area
                    </Text>
                  </View>
                  {locationPermission === false && (
                    <Ionicons name="checkmark-circle" size={24} color="#9E95BD" />
                  )}
                </TouchableOpacity>
              </View>

              {locationPermission === false && (
                <Animated.View 
                  style={[
                    styles.manualLocationContainer,
                    { transform: [{ scale: inputScaleAnim }] }
                  ]}
                >
                  <View style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: Colors[colorScheme ?? 'light'].card,
                      borderColor: inputFocused ? '#9E95BD' : colorScheme === 'dark' ? '#333' : '#E5E5E7',
                      shadowColor: inputFocused ? '#9E95BD' : '#000',
                      shadowOpacity: inputFocused ? 0.2 : 0.1,
                    }
                  ]}>
                    <Ionicons 
                      name="location-outline" 
                      size={22} 
                      color={inputFocused ? '#9E95BD' : Colors[colorScheme ?? 'light'].icon} 
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[
                        styles.manualLocationInput,
                        { color: Colors[colorScheme ?? 'light'].text },
                      ]}
                      placeholder="e.g., San Francisco, CA"
                      placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
                      value={manualLocation}
                      onChangeText={setManualLocation}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                      returnKeyType="done"
                      onSubmitEditing={handleContinue}
                    />
                  </View>
                </Animated.View>
              )}

              {isLoading && locationPermission === true && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].accent} />
                  <Text style={[styles.loadingText, { color: Colors[colorScheme ?? 'light'].text }]}>
                    Getting your location...
                  </Text>
                </View>
              )}

              {currentLocation && locationPermission === true && (
                <View style={styles.currentLocationContainer}>
                  <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                  <Text style={[styles.currentLocationText, { color: Colors[colorScheme ?? 'light'].text }]}>
                    Found: {currentLocation}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={handleContinue}
              disabled={isLoading || (locationPermission === false && !manualLocation.trim()) || locationPermission === null}
              style={styles.buttonWrapper}
            >
              <LinearGradient
                colors={['#FF0005', '#FF4D9D', '#FF69E2', '#B97AFF', '#9E95BD']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                locations={[0, 0.25, 0.5, 0.75, 1]}
                style={[
                  styles.continueButton,
                  (isLoading || (locationPermission === false && !manualLocation.trim()) || locationPermission === null) && styles.disabledButton,
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Text style={styles.continueButtonText}>Continue</Text>
                    <Ionicons name="chevron-forward" size={20} color="white" style={styles.buttonIcon} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardContainer: {
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
    marginBottom: 50,
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
  locationSection: {
    marginBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 8,
  },
  sectionDescription: {
    fontSize: 16,
    opacity: 0.7,
    lineHeight: 24,
    marginBottom: 30,
  },
  permissionOptions: {
    gap: 16,
    marginBottom: 20,
  },
  permissionOption: {
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
  permissionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  permissionContent: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 18,
    marginBottom: 4,
  },
  permissionDescription: {
    fontSize: 14,
    opacity: 0.7,
  },
  manualLocationContainer: {
    marginTop: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  inputIcon: {
    marginRight: 12,
  },
  manualLocationInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
    paddingVertical: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    opacity: 0.7,
  },
  currentLocationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 12,
  },
  currentLocationText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  buttonContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  buttonWrapper: {
    width: '100%',
  },
  continueButton: {
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
  continueButtonText: {
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
