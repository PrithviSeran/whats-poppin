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
import DateTimePicker from '@react-native-community/datetimepicker';
import CreateAccountProgressBar from './CreateAccountProgressBar';

const { width } = Dimensions.get('window');

const LOGO_IMAGE_LIGHT = require('../assets/images/logo-light.png');
const LOGO_IMAGE_DARK = require('../assets/images/logo.png');

type RootStackParamList = {
  'create-account-password': { userData: string };
};

type CreateAccountBirthdayRouteProp = RouteProp<{
  'create-account-birthday': { userData: string };
}, 'create-account-birthday'>;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const CreateAccountBirthday = ({ route }: { route: CreateAccountBirthdayRouteProp }) => {
  const [birthday, setBirthday] = useState('');
  const [birthdayError, setBirthdayError] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const navigation = useNavigation<NavigationProp>();
  const colorScheme = useColorScheme();
  const userData = route?.params?.userData ? JSON.parse(route.params.userData) : {};

  const formatBirthday = (date: Date): string => {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  };

  const validateBirthday = (date: Date) => {
    const today = new Date();
    const age = today.getFullYear() - date.getFullYear();
    if (age < 13 || (age === 13 && today < new Date(date.getFullYear() + 13, date.getMonth(), date.getDate()))) {
      setBirthdayError('You must be at least 13 years old');
      return false;
    }
    if (age > 100) {
      setBirthdayError('Please enter a valid age');
      return false;
    }
    setBirthdayError('');
    return true;
  };

  const handleDateChange = (event: any, date?: Date) => {
    if (date) {
      setSelectedDate(date);
      setBirthday(formatBirthday(date));
      validateBirthday(date);
    }
  };

  const handleNext = () => {
    if (selectedDate && validateBirthday(selectedDate)) {
      navigation.navigate('create-account-password', {
        userData: JSON.stringify({ ...userData, birthday }),
      });
    }
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
        currentStep={4}
        totalSteps={6}
        stepLabels={['Name', 'Username', 'Email', 'Birthday', 'Password', 'Location']}
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
              When's your birthday?
            </Text>
            <Text style={[styles.subtitle, { color: Colors[colorScheme ?? 'light'].text }]}>
              Your age will be visible to others
            </Text>
          </View>

          <View style={styles.datePickerContainer}>
            <View style={[
              styles.datePickerWrapper,
              {
                backgroundColor: Colors[colorScheme ?? 'light'].card,
                borderColor: birthdayError 
                  ? '#FF3B30' 
                  : '#9E95BD',
              }
            ]}>
              <View style={styles.datePickerIconContainer}>
                <Ionicons 
                  name="calendar-outline" 
                  size={24} 
                  color="#9E95BD" 
                />
              </View>
              <DateTimePicker
                value={selectedDate || new Date(2000, 0, 1)}
                mode="date"
                display={Platform.OS === 'ios' ? 'compact' : 'calendar'}
                onChange={handleDateChange}
                maximumDate={new Date()}
                style={styles.datePicker}
                textColor={Colors[colorScheme ?? 'light'].text}
              />
            </View>
            
            {birthdayError ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color="#FF3B30" />
                <Text style={styles.errorText}>{birthdayError}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={handleNext}
            disabled={!birthday || !!birthdayError}
            style={styles.buttonWrapper}
          >
            <LinearGradient
              colors={['#FF0005', '#FF4D9D', '#FF69E2', '#B97AFF', '#9E95BD']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              locations={[0, 0.25, 0.5, 0.75, 1]}
              style={[
                styles.nextButton,
                (!birthday || !!birthdayError) && styles.disabledButton,
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
  datePickerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  datePickerWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    minWidth: width * 0.8,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  datePickerIconContainer: {
    marginRight: 12,
  },
  datePicker: {
    flex: 1,
    height: Platform.OS === 'ios' ? 40 : undefined,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginLeft: 6,
    fontWeight: '500',
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

export default CreateAccountBirthday;
