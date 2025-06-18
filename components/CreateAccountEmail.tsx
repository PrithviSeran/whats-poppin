import React, { useState, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Dimensions,
  Platform,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import CreateAccountProgressBar from './CreateAccountProgressBar';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');

const LOGO_IMAGE_LIGHT = require('../assets/images/logo-light.png');
const LOGO_IMAGE_DARK = require('../assets/images/logo.png');

type RootStackParamList = {
  'create-account-birthday': { userData: string };
  'create-account-email': { userData: string };
  'social-sign-in': undefined;
  'forgot-password': undefined;
};

type CreateAccountEmailRouteProp = RouteProp<RootStackParamList, 'create-account-email'>;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface CreateAccountEmailProps {
  route: CreateAccountEmailRouteProp;
}

const CreateAccountEmail: React.FC<CreateAccountEmailProps> = ({ route }) => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  const navigation = useNavigation<NavigationProp>();
  const colorScheme = useColorScheme();
  const inputScaleAnim = useRef(new Animated.Value(1)).current;

  const userData = route?.params?.userData ? JSON.parse(route.params.userData) : {};

  const validateEmail = (text: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!text.trim()) {
      setEmailError('Email is required');
      return false;
    }
    if (!emailRegex.test(text)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  const checkEmailExists = async (email: string) => {
    if (!email || !validateEmail(email)) return;
    
    setIsCheckingEmail(true);
    setEmailExists(false);
    setEmailError('');
    
    try {
      // First check auth.users table for existing auth accounts
      const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
      
      // If we can't access admin API (which is expected in client-side), 
      // check the all_users table instead
      if (authError) {
        const { data: userData, error: userError } = await supabase
          .from('all_users')
          .select('email')
          .eq('email', email.toLowerCase())
          .maybeSingle();
        
        if (userError && userError.code !== 'PGRST116') {
          console.error('Error checking email:', userError);
          return;
        }
        
        if (userData) {
          setEmailExists(true);
          setEmailError('This email is already registered');
        }
      } else {
        // Check if email exists in auth users
        const existingUser = authData.users.find(user => 
          user.email?.toLowerCase() === email.toLowerCase()
        );
        
        if (existingUser) {
          setEmailExists(true);
          setEmailError('This email is already registered');
        }
      }
    } catch (error) {
      console.error('Error checking email existence:', error);
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    setEmailExists(false);
    setEmailError('');
    
    // Validate format first
    if (validateEmail(text)) {
      // Debounce the email check
      const timeoutId = setTimeout(() => {
        checkEmailExists(text);
      }, 800);
      
      return () => clearTimeout(timeoutId);
    }
  };

  const handleNext = () => {
    if (validateEmail(email) && !emailExists && !isCheckingEmail) {
      navigation.navigate('create-account-birthday', {
        userData: JSON.stringify({ ...userData, email }),
      });
    }
  };

  const handleSignIn = () => {
    navigation.navigate('social-sign-in');
  };

  const handleForgotPassword = () => {
    navigation.navigate('forgot-password');
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="chevron-back" size={28} color="#9E95BD" />
      </TouchableOpacity>

      <CreateAccountProgressBar
        currentStep={2}
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
                What's your email?
              </Text>
              <Text style={[styles.subtitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                We'll use this to recover your account if needed
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
                  borderColor: emailError 
                    ? '#FF3B30' 
                    : isFocused 
                      ? '#9E95BD' 
                      : colorScheme === 'dark' ? '#333' : '#E5E5E7',
                  shadowColor: isFocused ? '#9E95BD' : '#000',
                  shadowOpacity: isFocused ? 0.2 : 0.1,
                }
              ]}>
                <Ionicons 
                  name="mail-outline" 
                  size={22} 
                  color={isFocused ? '#9E95BD' : Colors[colorScheme ?? 'light'].icon} 
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[
                    styles.input,
                    { color: Colors[colorScheme ?? 'light'].text },
                  ]}
                  value={email}
                  onChangeText={handleEmailChange}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  placeholder="Enter your email address"
                  placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  returnKeyType="done"
                />
                {isCheckingEmail && (
                  <ActivityIndicator 
                    size="small" 
                    color="#9E95BD" 
                    style={{ marginLeft: 8 }}
                  />
                )}
              </View>
              {emailError && !emailExists && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color="#FF3B30" />
                  <Text style={styles.errorText}>{emailError}</Text>
                </View>
              )}
                             {emailExists && (
                 <View style={styles.existingEmailContainer}>
                   <View style={styles.existingEmailHeader}>
                     <Ionicons name="information-circle" size={22} color="#FF8C00" />
                     <Text style={[styles.existingEmailTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                       Account Already Exists
                     </Text>
                   </View>
                   <Text style={[styles.existingEmailMessage, { color: Colors[colorScheme ?? 'light'].text }]}>
                     This email is already registered. Choose an option below:
                   </Text>
                   <View style={styles.existingEmailButtons}>
                     <TouchableOpacity 
                       style={styles.signInButtonWrapper}
                       onPress={handleSignIn}
                       activeOpacity={0.8}
                     >
                       <LinearGradient
                         colors={['#9E95BD', '#B97AFF']}
                         start={{ x: 0, y: 0 }}
                         end={{ x: 1, y: 1 }}
                         style={styles.signInButton}
                       >
                         <Ionicons name="log-in-outline" size={18} color="white" />
                         <Text style={styles.signInButtonText}>Sign In</Text>
                       </LinearGradient>
                     </TouchableOpacity>
                     
                     <TouchableOpacity 
                       style={[styles.forgotPasswordButton, { 
                         borderColor: colorScheme === 'dark' ? '#666' : '#D1D5DB',
                         backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
                       }]}
                       onPress={handleForgotPassword}
                       activeOpacity={0.7}
                     >
                       <Ionicons name="key-outline" size={18} color="#9E95BD" />
                       <Text style={[styles.forgotPasswordText, { color: '#9E95BD' }]}>Reset Password</Text>
                     </TouchableOpacity>
                   </View>
                 </View>
               )}
            </Animated.View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={handleNext}
              disabled={!email.trim() || !!emailError || emailExists || isCheckingEmail}
              style={styles.buttonWrapper}
            >
              <LinearGradient
                colors={['#FF0005', '#FF4D9D', '#FF69E2', '#B97AFF', '#9E95BD']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                locations={[0, 0.25, 0.5, 0.75, 1]}
                style={[
                  styles.nextButton,
                  (!email.trim() || !!emailError || emailExists || isCheckingEmail) && styles.disabledButton,
                ]}
              >
                <Text style={styles.nextButtonText}>Continue</Text>
                <Ionicons name="chevron-forward" size={20} color="white" style={styles.buttonIcon} />
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
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
    paddingVertical: 16,
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
  existingEmailContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: 'rgba(255, 140, 0, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 140, 0, 0.3)',
  },
  existingEmailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  existingEmailTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  existingEmailMessage: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 16,
    lineHeight: 20,
  },
  existingEmailButtons: {
    flexDirection: 'column',
    gap: 12,
  },
  signInButtonWrapper: {
    shadowColor: '#9E95BD',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  signInButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  forgotPasswordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 8,
  },
  forgotPasswordText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

export default CreateAccountEmail;
