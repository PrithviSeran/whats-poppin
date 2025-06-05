import React, { useState, useEffect } from 'react';
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

const { width } = Dimensions.get('window');
const BALLOON_IMAGE = require('../assets/images/balloons.png');

type RootStackParamList = {
  'user-preferences': { userData: string };
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
  const colorScheme = useColorScheme();
  const navigation = useNavigation<NavigationProp>();
  const userData = route?.params?.userData ? JSON.parse(route.params.userData) : {};

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
      navigation.navigate('user-preferences', {
        userData: JSON.stringify({ ...userData, location: locationData }),
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
    if (allow) await getCurrentLocation();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backIcon}>{'←'}</Text>
      </TouchableOpacity>

      <View style={styles.headerContainer}>
        <View style={styles.headerRow}>
          <Image
            source={BALLOON_IMAGE}
            style={styles.balloons}
            resizeMode="contain"
          />
          <MaskedView
            maskElement={<Text style={[styles.title, { opacity: 1 }]}>{`What's Poppin?`}</Text>}
          >
            <LinearGradient
              colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              locations={[0, 0.3, 0.7, 1]}
            >
              <Text style={[styles.title, { opacity: 0 }]}>{`What's Poppin?`}</Text>
            </LinearGradient>
          </MaskedView>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.titleLarge, { color: Colors[colorScheme ?? 'light'].text }]}>Almost there!</Text>
          <Text style={[styles.subtitle, { color: Colors[colorScheme ?? 'light'].text }]}>Help us personalize your experience</Text>
        </View>

        <View style={styles.locationSection}>
          <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Location Access</Text>
          <Text style={[styles.sectionDescription, { color: Colors[colorScheme ?? 'light'].text }]}>Allow location access to find events near you and get personalized recommendations.</Text>

          <View style={styles.permissionButtons}>
            <TouchableOpacity
              style={[styles.permissionButton, locationPermission === true && styles.permissionButtonSelected]}
              onPress={() => handlePermissionChange(true)}
            >
              <Ionicons name="location" size={24} color={locationPermission === true ? '#fff' : Colors[colorScheme ?? 'light'].text} />
              <Text style={[styles.permissionButtonText, { color: locationPermission === true ? '#fff' : Colors[colorScheme ?? 'light'].text }]}>Allow</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.permissionButton, locationPermission === false && styles.permissionButtonSelected]}
              onPress={() => handlePermissionChange(false)}
            >
              <Ionicons name="location-off" size={24} color={locationPermission === false ? '#fff' : Colors[colorScheme ?? 'light'].text} />
              <Text style={[styles.permissionButtonText, { color: locationPermission === false ? '#fff' : Colors[colorScheme ?? 'light'].text }]}>Don't Allow</Text>
            </TouchableOpacity>
          </View>

          {locationPermission === false && (
            <View style={styles.manualLocationContainer}>
              <Text style={[styles.manualLocationLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Enter your location</Text>
              <TextInput
                style={[
                  styles.manualLocationInput,
                  {
                    backgroundColor: Colors[colorScheme ?? 'light'].card,
                    color: Colors[colorScheme ?? 'light'].text,
                    borderColor: Colors[colorScheme ?? 'light'].border,
                  },
                ]}
                placeholder="e.g., New York, NY"
                placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
                value={manualLocation}
                onChangeText={setManualLocation}
              />
            </View>
          )}

          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF1493" />
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
          disabled={isLoading || (locationPermission === false && !manualLocation)}
        >
          <LinearGradient
            colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            locations={[0, 0.3, 0.7, 1]}
            style={styles.gradientButton}
          >
            <Text style={styles.continueButtonText}>{isLoading ? 'Setting up...' : 'Complete Setup'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingBottom: 40,
  },
  headerContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balloons: {
    width: width * 0.22,
    height: width * 0.22,
    marginRight: -6,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#F45B5B',
    textAlign: 'left',
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 4, height: 4 },
    textShadowRadius: 6,
    fontFamily: Platform.OS === 'ios' ? 'MarkerFelt-Wide' : 'sans-serif-condensed',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 20,
    padding: 8,
  },
  backIcon: {
    fontSize: 28,
    color: '#FF1493',
  },
  titleLarge: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    marginTop: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginTop: 40,
    marginBottom: 40,
  },
  subtitle: {
    fontSize: 18,
    opacity: 0.7,
  },
  locationSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  sectionDescription: {
    fontSize: 16,
    opacity: 0.7,
    marginBottom: 20,
  },
  permissionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  permissionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    marginHorizontal: 5,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  permissionButtonSelected: {
    backgroundColor: '#F45B5B',
    borderColor: '#FF1493',
  },
  permissionButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  manualLocationContainer: {
    marginTop: 20,
  },
  manualLocationLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  manualLocationInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
  },
  loadingContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  continueButton: {
    marginTop: 'auto',
    marginBottom: 20,
  },
  gradientButton: {
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
