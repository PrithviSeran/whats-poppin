import React, { useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  Dimensions,
  Platform,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import OptimizedComponentServices from '@/lib/OptimizedComponentServices';
import LegalDocumentViewer from './LegalDocumentViewer';
import { checkPendingEventAfterLogin } from '@/lib/deepLinking';

type RootStackParamList = {
  'social-sign-in': undefined;
  'suggested-events': undefined;
  'forgot-password': undefined;
  'create-account': undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

const LOGO_IMAGE_LIGHT = require('../assets/images/logo-light.png');
const LOGO_IMAGE_DARK = require('../assets/images/logo.png');

const SocialSignInScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const colorScheme = useColorScheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const emailScaleAnim = useRef(new Animated.Value(1)).current;
  const passwordScaleAnim = useRef(new Animated.Value(1)).current;
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const getErrorMessage = (error: any): string => {
    switch (error.message) {
      case 'Invalid login credentials':
        return 'Invalid email or password. Please try again.';
      case 'Email not confirmed':
        return 'Please verify your email address before signing in.';
      case 'Too many requests':
        return 'Too many attempts. Please try again later.';
      default:
        return 'An error occurred. Please try again.';
    }
  };

  const handleSignIn = async () => {
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      // Use optimized service with caching and better error handling
      const services = OptimizedComponentServices.getInstance();
      const result = await services.signInWithPassword(email, password);

      if ((result as any)?.error) {
        setError(getErrorMessage((result as any).error));
        setIsLoading(false);
        return;
      }
      
      console.log('Sign in successful:', (result as any)?.data);
      // Check for pending event after login
      const handled = await checkPendingEventAfterLogin(navigation);
      if (!handled) {
        navigation.navigate('suggested-events');
      }
    } catch (error) {
      console.error('Error during sign in:', error);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailFocus = () => {
    setEmailFocused(true);
    Animated.spring(emailScaleAnim, {
      toValue: 1.02,
      useNativeDriver: true,
    }).start();
  };

  const handleEmailBlur = () => {
    setEmailFocused(false);
    Animated.spring(emailScaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handlePasswordFocus = () => {
    setPasswordFocused(true);
    Animated.spring(passwordScaleAnim, {
      toValue: 1.02,
      useNativeDriver: true,
    }).start();
  };

  const handlePasswordBlur = () => {
    setPasswordFocused(false);
    Animated.spring(passwordScaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handleOpenTerms = () => {
    setShowTermsModal(true);
  };

  const handleOpenPrivacyPolicy = () => {
    setShowPrivacyModal(true);
  };

  const isFormValid = validateEmail(email) && password.trim().length > 0;

  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: Colors[colorScheme ?? 'light'].background }
    ]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="chevron-back" size={28} color="#9E95BD" />
      </TouchableOpacity>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
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
                Welcome back!
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { color: Colors[colorScheme ?? 'light'].text },
                ]}
              >
                Sign in to continue exploring events
              </Text>
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={16} color="#FF3B30" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.inputsContainer}>
              <Animated.View 
                style={[
                  styles.inputContainer,
                  { transform: [{ scale: emailScaleAnim }] }
                ]}
              >
                <View style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: Colors[colorScheme ?? 'light'].card,
                    borderColor: error && !validateEmail(email) && email.length > 0
                      ? '#FF3B30' 
                      : emailFocused 
                        ? '#9E95BD' 
                        : colorScheme === 'dark' ? '#333' : '#E5E5E7',
                    shadowColor: emailFocused ? '#9E95BD' : '#000',
                    shadowOpacity: emailFocused ? 0.2 : 0.1,
                  }
                ]}>
                  <Ionicons 
                    name="mail-outline" 
                    size={22} 
                    color={emailFocused ? '#9E95BD' : Colors[colorScheme ?? 'light'].icon} 
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[
                      styles.input,
                      { color: Colors[colorScheme ?? 'light'].text },
                    ]}
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      setError(null);
                    }}
                    onFocus={handleEmailFocus}
                    onBlur={handleEmailBlur}
                    placeholder="Enter your email address"
                    placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    returnKeyType="next"
                    editable={!isLoading}
                  />
                </View>
              </Animated.View>

              <Animated.View 
                style={[
                  styles.inputContainer,
                  { transform: [{ scale: passwordScaleAnim }] }
                ]}
              >
                <View style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: Colors[colorScheme ?? 'light'].card,
                    borderColor: passwordFocused 
                      ? '#9E95BD' 
                      : colorScheme === 'dark' ? '#333' : '#E5E5E7',
                    shadowColor: passwordFocused ? '#9E95BD' : '#000',
                    shadowOpacity: passwordFocused ? 0.2 : 0.1,
                  }
                ]}>
                  <Ionicons 
                    name="lock-closed-outline" 
                    size={22} 
                    color={passwordFocused ? '#9E95BD' : Colors[colorScheme ?? 'light'].icon} 
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[
                      styles.input,
                      { color: Colors[colorScheme ?? 'light'].text },
                    ]}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      setError(null);
                    }}
                    onFocus={handlePasswordFocus}
                    onBlur={handlePasswordBlur}
                    placeholder="Enter your password"
                    placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleSignIn}
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    style={styles.passwordToggle}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons 
                      name={showPassword ? "eye-off-outline" : "eye-outline"} 
                      size={22} 
                      color={Colors[colorScheme ?? 'light'].icon} 
                    />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </View>

            <TouchableOpacity 
              style={styles.forgotPasswordButton}
              onPress={() => navigation.navigate('forgot-password')}
            >
              <Text style={[styles.forgotPasswordText, { color: '#9E95BD' }]}>
                Forgot your password?
              </Text>
            </TouchableOpacity>

            <View style={styles.termsContainer}>
              <Text style={[styles.termsText, { color: Colors[colorScheme ?? 'light'].text }]}>
                By signing in, you agree to our{' '}
                <Text style={styles.termsLink} onPress={handleOpenTerms}>
                  Terms of Service
                </Text>
                {' '}and{' '}
                <Text style={styles.termsLink} onPress={handleOpenPrivacyPolicy}>
                  Privacy Policy
                </Text>
              </Text>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={handleSignIn}
              disabled={!isFormValid || isLoading}
              style={styles.buttonWrapper}
            >
              <LinearGradient
                colors={['#FF0005', '#FF4D9D', '#FF69E2', '#B97AFF', '#9E95BD']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                locations={[0, 0.25, 0.5, 0.75, 1]}
                style={[
                  styles.signInButton,
                  (!isFormValid || isLoading) && styles.disabledButton,
                ]}
              >
                <Text style={styles.signInButtonText}>
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Text>
                {!isLoading && (
                  <Ionicons name="chevron-forward" size={20} color="white" style={styles.buttonIcon} />
                )}
                {isLoading && (
                  <View style={styles.loadingContainer}>
                    <Ionicons name="refresh" size={20} color="white" style={styles.spinningIcon} />
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

        </ScrollView>
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
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
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
    marginTop: 60,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  titleLarge: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: 24,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  inputsContainer: {
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 16,
    fontWeight: '500',
  },
  passwordToggle: {
    padding: 8,
    marginLeft: 8,
  },
  forgotPasswordButton: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '500',
  },
  buttonContainer: {
    marginTop: 60,
  },
  buttonWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 24,
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  signInButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  buttonIcon: {
    marginLeft: 4,
  },
  loadingContainer: {
    marginLeft: 8,
  },
  spinningIcon: {
    transform: [{ rotate: '0deg' }],
  },
  disabledButton: {
    opacity: 0.6,
  },
  createAccountButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  createAccountText: {
    fontSize: 16,
    textAlign: 'center',
  },
  termsContainer: {
    marginTop: 16,
    marginBottom: 0,
    paddingHorizontal: 16,
  },
  termsText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    opacity: 0.7,
  },
  termsLink: {
    color: '#9E95BD',
    fontWeight: '500',
  },
});

export default SocialSignInScreen;