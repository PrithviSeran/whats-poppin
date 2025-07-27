import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Dimensions,
  Platform,
  Animated,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import CreateAccountProgressBar from './CreateAccountProgressBar';
import { supabase } from '@/lib/supabase';

type RootStackParamList = {
  'create-account-email': { userData: string };
  'create-account-username': { userData: string };
  'create-account': { userData: string };
};

type CreateAccountUsernameRouteProp = RouteProp<RootStackParamList, 'create-account-username'>;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface CreateAccountUsernameProps {
  route: CreateAccountUsernameRouteProp;
}

const { width } = Dimensions.get('window');

const LOGO_IMAGE_LIGHT = require('../assets/images/logo-light.png');
const LOGO_IMAGE_DARK = require('../assets/images/logo.png');

const CreateAccountUsername: React.FC<CreateAccountUsernameProps> = ({ route }) => {
  const navigation = useNavigation<NavigationProp>();
  const colorScheme = useColorScheme();
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameValid, setUsernameValid] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const inputScaleAnim = useRef(new Animated.Value(1)).current;
  const userData = route?.params?.userData ? JSON.parse(route.params.userData) : {};

  const validateUsernameFormat = (text: string) => {
    // Username requirements: 3-20 characters, alphanumeric and underscores only, no spaces
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    
    if (!text.trim()) {
      setUsernameError('Username is required');
      return false;
    }
    if (text.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      return false;
    }
    if (text.length > 20) {
      setUsernameError('Username must be 20 characters or less');
      return false;
    }
    if (!usernameRegex.test(text)) {
      setUsernameError('Username can only contain letters, numbers, and underscores');
      return false;
    }
    
    return true;
  };

  const checkUsernameAvailability = async (text: string) => {
    if (!validateUsernameFormat(text)) {
      setUsernameValid(false);
      return;
    }

    setIsCheckingUsername(true);
    setUsernameError('');

    try {
      // Check if username already exists
      const { data, error } = await supabase
        .from('all_users')
        .select('username')
        .eq('username', text.toLowerCase())
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "not found" which is what we want
        console.error('Error checking username:', error);
        setUsernameError('Error checking username availability');
        setUsernameValid(false);
        return;
      }

      if (data) {
        // Username already exists
        setUsernameError('This username is already taken');
        setUsernameValid(false);
      } else {
        // Username is available
        setUsernameError('');
        setUsernameValid(true);
      }
    } catch (error) {
      console.error('Error checking username:', error);
      setUsernameError('Error checking username availability');
      setUsernameValid(false);
    } finally {
      setIsCheckingUsername(false);
    }
  };

  // Debounced username checking
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (username.trim()) {
        checkUsernameAvailability(username.trim().toLowerCase());
      } else {
        setUsernameValid(false);
        setUsernameError('');
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [username]);

  const handleNext = () => {
    if (usernameValid && !isCheckingUsername) {
      const userDataToSend = { 
        ...userData, 
        username: username.trim().toLowerCase() 
      };
      console.log('CreateAccountUsername - userDataToSend:', userDataToSend);

      navigation.navigate('create-account-email', {
        userData: JSON.stringify(userDataToSend),
      });
    }
  };

  const handleInputFocus = () => {
    setIsFocused(true);
    Animated.spring(inputScaleAnim, {
      toValue: 1.02,
      useNativeDriver: true,
    }).start();
  };

  const handleInputBlur = () => {
    setIsFocused(false);
    Animated.spring(inputScaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  // Comprehensive animation cleanup on component unmount
  useEffect(() => {
    return () => {
      // Stop all animations to prevent memory leaks
      console.log('🧹 CreateAccountUsername: Cleaning up animations');
      
      // Stop all animated values
      fadeAnim.stopAnimation();
      inputScaleAnim.stopAnimation();
    };
  }, []);

  // Breathing animation effect
  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getValidationIcon = () => {
    if (isCheckingUsername) {
      return <ActivityIndicator size="small" color="#9E95BD" />;
    }
    if (usernameValid) {
      return <Ionicons name="checkmark-circle" size={20} color="#22C55E" />;
    }
    if (usernameError && username.trim()) {
      return <Ionicons name="close-circle" size={20} color="#FF3B30" />;
    }
    return null;
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: Colors[colorScheme ?? 'light'].background },
      ]}
    >
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="chevron-back" size={28} color="#9E95BD" />
      </TouchableOpacity>

      <CreateAccountProgressBar
        currentStep={2}
        totalSteps={7}
        stepLabels={['Name', 'Username', 'Email', 'Birthday', 'Gender', 'Password', 'Location']}
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
              <Text
                style={[
                  styles.titleLarge,
                  { color: Colors[colorScheme ?? 'light'].text },
                ]}
              >
                Choose a username
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { color: Colors[colorScheme ?? 'light'].text },
                ]}
              >
                This is how others will find and mention you
              </Text>
            </View>

            <Animated.View 
              style={[
                styles.inputContainer,
                { transform: [{ scale: inputScaleAnim }] }
              ]}
            >
              <View style={[
                styles.inputWrapper,
                {
                  backgroundColor: Colors[colorScheme ?? 'light'].card,
                  borderColor: usernameError 
                    ? '#FF3B30' 
                    : usernameValid
                      ? '#22C55E'
                      : isFocused 
                        ? '#9E95BD' 
                        : colorScheme === 'dark' ? '#333' : '#E5E5E7',
                  shadowColor: isFocused ? '#9E95BD' : '#000',
                  shadowOpacity: isFocused ? 0.2 : 0.1,
                }
              ]}>
                <Text style={[styles.atSymbol, { color: Colors[colorScheme ?? 'light'].text }]}>@</Text>
                <TextInput
                  style={[
                    styles.input,
                    { color: Colors[colorScheme ?? 'light'].text },
                  ]}
                  value={username}
                  onChangeText={(text) => {
                    // Remove spaces and convert to lowercase as user types
                    const cleanText = text.replace(/\s/g, '').toLowerCase();
                    setUsername(cleanText);
                  }}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  placeholder="username"
                  placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={handleNext}
                  maxLength={20}
                />
                <View style={styles.validationIcon}>
                  {getValidationIcon()}
                </View>
              </View>
              {usernameError ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color="#FF3B30" />
                  <Text style={styles.errorText}>{usernameError}</Text>
                </View>
              ) : usernameValid ? (
                <View style={styles.successContainer}>
                  <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                  <Text style={styles.successText}>Great! This username is available</Text>
                </View>
              ) : null}
            </Animated.View>

            {/* Username tips */}
            <View style={styles.tipsContainer}>
              <Text style={[styles.tipsTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                Username tips:
              </Text>
              <View style={styles.tipsList}>
                <View style={styles.tipRow}>
                  <Ionicons name="checkmark" size={14} color="#9E95BD" />
                  <Text style={[styles.tipText, { color: Colors[colorScheme ?? 'light'].text }]}>
                    3-20 characters long
                  </Text>
                </View>
                <View style={styles.tipRow}>
                  <Ionicons name="checkmark" size={14} color="#9E95BD" />
                  <Text style={[styles.tipText, { color: Colors[colorScheme ?? 'light'].text }]}>
                    Letters, numbers, and underscores only
                  </Text>
                </View>
                <View style={styles.tipRow}>
                  <Ionicons name="checkmark" size={14} color="#9E95BD" />
                  <Text style={[styles.tipText, { color: Colors[colorScheme ?? 'light'].text }]}>
                    No spaces allowed
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={handleNext}
              disabled={!usernameValid || isCheckingUsername}
              style={styles.buttonWrapper}
            >
              <LinearGradient
                colors={['#FF0005', '#FF4D9D', '#FF69E2', '#B97AFF', '#9E95BD']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                locations={[0, 0.25, 0.5, 0.75, 1]}
                style={[
                  styles.nextButton,
                  (!usernameValid || isCheckingUsername) && styles.disabledButton,
                ]}
              >
                {isCheckingUsername ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Text style={styles.nextButtonText}>Continue</Text>
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
};

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
    minHeight: 300,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 40,
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
  inputContainer: {
    marginBottom: 20,
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
  atSymbol: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: 4,
    opacity: 0.7,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
    paddingVertical: 16,
  },
  validationIcon: {
    marginLeft: 8,
    width: 20,
    alignItems: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginLeft: 6,
    fontWeight: '500',
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  successText: {
    color: '#22C55E',
    fontSize: 14,
    marginLeft: 6,
    fontWeight: '500',
  },
  tipsContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: 'rgba(158, 149, 189, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(158, 149, 189, 0.1)',
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    opacity: 0.8,
  },
  tipsList: {
    gap: 8,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tipText: {
    fontSize: 13,
    opacity: 0.7,
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

export default CreateAccountUsername; 