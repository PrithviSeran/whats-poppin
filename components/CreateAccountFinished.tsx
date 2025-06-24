import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Image, Alert, SafeAreaView, TextInput, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { UserData } from '@/types/user';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import GlobalDataManager from '@/lib/GlobalDataManager';
import LegalDocumentViewer from './LegalDocumentViewer';

const { width } = Dimensions.get('window');

type RootStackParamList = {
  'suggested-events': undefined;
};

type CreateAccountFinishedRouteProp = RouteProp<{
  'create-account-finished': { userData: string };
}, 'create-account-finished'>;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function CreateAccountFinished({ route }: { route: CreateAccountFinishedRouteProp }) {
  const colorScheme = useColorScheme();
  const navigation = useNavigation<NavigationProp>();
  const userData = route?.params?.userData ? JSON.parse(route.params.userData) : {};
  
  const [accountCreated, setAccountCreated] = useState(false);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(true);
  const [showAddressInput, setShowAddressInput] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const dataManager = GlobalDataManager.getInstance();

  const handleOpenTerms = () => {
    setShowTermsModal(true);
  };

  const handleOpenPrivacyPolicy = () => {
    setShowPrivacyModal(true);
  };

  async function createUser() {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            username: userData.name || undefined,
            gender: userData.gender || undefined,
            birthday: userData.birthday || undefined,
            preferences: userData.preferences || undefined,

          },
        },
      });

      if (error) {
        console.error('Signup error:', error.message);
        throw error;
      }
      
      // If sign up is successful, insert into all_users
      const user = data.user;
      if (user) {
        console.log(userData.preferences)

        const preferencesArr = userData.preferences?.eventTypes || [];
        const preferences = `{${preferencesArr.map((p: string) => `"${p}"`).join(',')}}`;

        const savedEventsArr = userData.saved_events || [];
        const saved_events = `{${savedEventsArr.map((e: string) => `"${e}"`).join(',')}}`;

        const { error: insertError } = await supabase
          .from('all_users')
          .insert([{
            name: userData.name,
            email: userData.email,
            birthday: userData.birthday,
            gender: userData.gender,
            saved_events: saved_events,
            preferences: userData.preferences.eventTypes,
            ['start-time']: userData.preferences.timePreferences.start,
            ['end-time']: userData.preferences.timePreferences.end,
            location: userData.preferences.locationPreferences[0],
            ['travel-distance']: userData.preferences.travelDistance,
            
          }]);
        if (insertError) {
          console.error('Error inserting into all_users:', insertError.message);
        }
      }

      console.log('Signup and all_users insert successful:', data);
      setAccountCreated(true);
    } catch (error) {
      console.error('Error during signup:', error);
      Alert.alert(
        'Account Creation Error',
        'There was an issue creating your account. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsCreatingAccount(false);
    }
  }

  async function requestLocationPermissions() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status === 'granted') {
        setLocationPermissionGranted(true);
        // Navigate to suggested events after a brief delay
        setTimeout(() => {
          navigation.navigate('suggested-events');
        }, 1000);
      } else {
        Alert.alert(
          'Location Access',
          'No worries! You can still discover events by entering your address.',
          [
            { text: 'Skip', onPress: () => navigation.navigate('suggested-events') },
            { text: 'Enter Address', onPress: () => setShowAddressInput(true) }
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      setShowAddressInput(true);
    }
  }

  async function handleAddressSubmit() {
    if (!manualAddress.trim()) {
      Alert.alert('Address Required', 'Please enter your address to continue.');
      return;
    }

    try {
      // Save the manual address to the user profile
      const userProfile = await dataManager.getUserProfile();
      if (userProfile) {
        userProfile.location = manualAddress.trim();
        await dataManager.setUserProfile(userProfile);
      }
      
      // Navigate to suggested events
      navigation.navigate('suggested-events');
    } catch (error) {
      console.error('Error saving address:', error);
      navigation.navigate('suggested-events');
    }
  }

  useEffect(() => {
    createUser();
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      {/* Modern gradient background */}
      <LinearGradient
        colors={['#FF0005', '#FF4D9D', '#FF69E2', '#B97AFF', '#9E95BD']}
        style={styles.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.content}>
        {/* Status Icon */}
        <View style={styles.iconContainer}>
          {isCreatingAccount ? (
            <View style={styles.loadingIcon}>
              <Ionicons name="hourglass-outline" size={64} color="#9E95BD" />
            </View>
          ) : accountCreated && !locationPermissionGranted ? (
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={64} color="#22C55E" />
            </View>
          ) : locationPermissionGranted ? (
            <View style={styles.locationIcon}>
              <Ionicons name="location" size={64} color="#3B82F6" />
            </View>
          ) : (
            <View style={styles.errorIcon}>
              <Ionicons name="alert-circle" size={64} color="#EF4444" />
            </View>
          )}
        </View>

        {/* Main Content */}
        <View style={styles.textContainer}>
          {isCreatingAccount ? (
            <>
              <Text style={[styles.title, { color: Colors[colorScheme ?? 'light'].text }]}>
                Setting up your account...
              </Text>
              <Text style={[styles.subtitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                We're personalizing your experience based on your preferences
              </Text>
            </>
          ) : showAddressInput ? (
            <>
              <Text style={[styles.title, { color: Colors[colorScheme ?? 'light'].text }]}>
                Enter Your Address 📍
              </Text>
              <Text style={[styles.subtitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                Help us find the best events in your area by entering your address or city
              </Text>
            </>
          ) : accountCreated && !locationPermissionGranted ? (
            <>
              <Text style={[styles.title, { color: Colors[colorScheme ?? 'light'].text }]}>
                Welcome to What's Poppin! 🎉
              </Text>
              <Text style={[styles.subtitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                Your account is ready! Now let's help you discover amazing events nearby.
              </Text>
            </>
          ) : locationPermissionGranted ? (
            <>
              <Text style={[styles.title, { color: Colors[colorScheme ?? 'light'].text }]}>
                All set! 🌟
              </Text>
              <Text style={[styles.subtitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                You're ready to explore events in your area
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: Colors[colorScheme ?? 'light'].text }]}>
                Almost there!
              </Text>
              <Text style={[styles.subtitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                Let's get you set up to find the best events
              </Text>
            </>
          )}
        </View>

        {/* Address Input Form */}
        {showAddressInput && (
          <View style={styles.addressInputContainer}>
            <TextInput
              style={[
                styles.addressInput,
                { 
                  backgroundColor: Colors[colorScheme ?? 'light'].card,
                  color: Colors[colorScheme ?? 'light'].text,
                  borderColor: Colors[colorScheme ?? 'light'].text + '20'
                }
              ]}
              placeholder="Enter your city or address (e.g., New York, NY)"
              placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
              value={manualAddress}
              onChangeText={setManualAddress}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleAddressSubmit}
            />
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          {showAddressInput ? (
            <>
              <TouchableOpacity 
                style={styles.primaryButton} 
                onPress={handleAddressSubmit}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#22C55E', '#16A34A']}
                  style={styles.primaryButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="checkmark-outline" size={20} color="white" />
                  <Text style={styles.primaryButtonText}>Continue</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.secondaryButton} 
                onPress={() => navigation.navigate('suggested-events')}
                activeOpacity={0.8}
              >
                <Text style={[styles.secondaryButtonText, { color: Colors[colorScheme ?? 'light'].text }]}>
                  Skip for now
                </Text>
              </TouchableOpacity>
            </>
          ) : accountCreated && !locationPermissionGranted ? (
            <>
              <TouchableOpacity 
                style={styles.primaryButton} 
                onPress={requestLocationPermissions}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#3B82F6', '#8B5CF6']}
                  style={styles.primaryButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="location-outline" size={20} color="white" />
                  <Text style={styles.primaryButtonText}>Enable Location</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.secondaryButton} 
                onPress={() => navigation.navigate('suggested-events')}
                activeOpacity={0.8}
              >
                <Text style={[styles.secondaryButtonText, { color: Colors[colorScheme ?? 'light'].text }]}>
                  Skip for now
                </Text>
              </TouchableOpacity>
            </>
          ) : !accountCreated && !isCreatingAccount ? (
            <TouchableOpacity 
              style={styles.primaryButton} 
              onPress={createUser}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#EF4444', '#F97316']}
                style={styles.primaryButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="refresh-outline" size={20} color="white" />
                <Text style={styles.primaryButtonText}>Try Again</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Legal Documents Section */}
        {accountCreated && (
          <View style={styles.legalContainer}>
            <Text style={[styles.legalTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
              By creating your account, you agree to our:
            </Text>
            <View style={styles.legalLinks}>
              <TouchableOpacity onPress={handleOpenTerms} style={styles.legalLink}>
                <Ionicons name="document-text-outline" size={16} color="#9E95BD" />
                <Text style={styles.legalLinkText}>Terms & Conditions</Text>
              </TouchableOpacity>
              <Text style={[styles.legalSeparator, { color: Colors[colorScheme ?? 'light'].text }]}>and</Text>
              <TouchableOpacity onPress={handleOpenPrivacyPolicy} style={styles.legalLink}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#9E95BD" />
                <Text style={styles.legalLinkText}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Location Permission Info */}
        {accountCreated && !locationPermissionGranted && (
          <View style={styles.infoContainer}>
            <View style={styles.infoItem}>
              <Ionicons name="map-outline" size={20} color="#9E95BD" />
              <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text }]}>
                Discover events near you
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="notifications-outline" size={20} color="#9E95BD" />
              <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text }]}>
                Get notified about local happenings
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="time-outline" size={20} color="#9E95BD" />
              <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text }]}>
                Save time with personalized suggestions
              </Text>
            </View>
          </View>
        )}
        </View>
      </KeyboardAvoidingView>

      {/* Legal Document Modals */}
      <LegalDocumentViewer
        visible={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        documentType="terms"
      />

      <LegalDocumentViewer
        visible={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        documentType="privacy"
      />
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
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: width * 0.6,
    opacity: 0.1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: 40,
    alignItems: 'center',
  },
  loadingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(158, 149, 189, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  primaryButton: {
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 8,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(158, 149, 189, 0.3)',
    backgroundColor: 'rgba(158, 149, 189, 0.05)',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.8,
  },
  infoContainer: {
    width: '100%',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(158, 149, 189, 0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(158, 149, 189, 0.1)',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  infoText: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.8,
    flex: 1,
  },
  addressInputContainer: {
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 30,
    marginTop: 20,
  },
  addressInput: {
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 18,
    fontWeight: '500',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    minHeight: 56,
    textAlign: 'left',
  },
  legalContainer: {
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(158, 149, 189, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(158, 149, 189, 0.1)',
    marginBottom: 20,
    alignItems: 'center',
  },
  legalTitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 12,
    opacity: 0.8,
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  legalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(158, 149, 189, 0.1)',
    gap: 4,
  },
  legalLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9E95BD',
    textDecorationLine: 'underline',
  },
  legalSeparator: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.6,
    marginHorizontal: 4,
  },
});
