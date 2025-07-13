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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
// import AsyncStorage from '@react-native-async-storage/async-storage';

type RootStackParamList = {
  'social-sign-in': undefined;
  'reset-password': undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

const LOGO_IMAGE_LIGHT = require('../assets/images/logo-light.png');
const LOGO_IMAGE_DARK = require('../assets/images/logo.png');

const ForgotPasswordScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showRecoveryTokenInput, setShowRecoveryTokenInput] = useState(false);
  const [recoveryToken, setRecoveryToken] = useState('');
  const [recoveryTokenError, setRecoveryTokenError] = useState('');
  const [isTokenFocused, setIsTokenFocused] = useState(false);
  const [isVerifyingToken, setIsVerifyingToken] = useState(false);
  const colorScheme = useColorScheme();
  const inputScaleAnim = useRef(new Animated.Value(1)).current;
  const tokenInputScaleAnim = useRef(new Animated.Value(1)).current;

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

  const handleEmailChange = (text: string) => {
    setEmail(text);
    setSuccessMessage(''); // Clear success message when user starts typing again
    validateEmail(text);
  };

  const checkEmailExists = async (email: string): Promise<boolean> => {
    try {
      // Check if email exists in the all_users table (doesn't create any users)
      const { data, error } = await supabase
        .from('all_users')
        .select('email')
        .eq('email', email)
        .limit(1);

      if (error) {
        console.error('Error checking email existence:', error);
        return false; // On error, allow the process to continue
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error checking email existence:', error);
      return false; // On error, allow the process to continue
    }
  };

  const handleResetPassword = async () => {
    if (!validateEmail(email)) return;

    setIsLoading(true);
    setSuccessMessage('');
    setEmailError('');

    try {
      // First check if the email exists in our user database
      const emailExists = await checkEmailExists(email);
      
      if (!emailExists) {
        setEmailError('No account found with this email address. Please check your email or sign up for a new account.');
        setIsLoading(false);
        return;
      }

      // Save the email to AsyncStorage for password reset
      // await AsyncStorage.setItem('resetPasswordEmail', email);
      
      // Use a simple redirect URL that will open the app
      const redirectUrl = 'whatspoppin://reset-password';
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        // Provide more user-friendly error messages
        if (error.message.includes('rate limit')) {
          setEmailError('Too many requests. Please wait a few minutes before trying again');
        } else {
          setEmailError(error.message);
        }
        // Remove the email from AsyncStorage if there was an error
        // await AsyncStorage.removeItem('resetPasswordEmail');
      } else {
        setSuccessMessage('Password reset instructions have been sent to your email. Please check your inbox and enter the recovery token below.');
        setShowRecoveryTokenInput(true);
      }
    } catch (error) {
      setEmailError('An error occurred. Please check your internet connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecoveryTokenChange = (text: string) => {
    setRecoveryToken(text);
    setRecoveryTokenError('');
  };

  const validateRecoveryToken = (token: string) => {
    if (!token.trim()) {
      setRecoveryTokenError('Recovery token is required');
      return false;
    }
    // Supabase sends 6-digit numeric tokens
    if (token.length !== 6) {
      setRecoveryTokenError('Please enter the 6-digit recovery token from your email');
      return false;
    }
    // Check if token contains only numbers
    if (!/^\d{6}$/.test(token)) {
      setRecoveryTokenError('Recovery token should be 6 digits');
      return false;
    }
    setRecoveryTokenError('');
    return true;
  };

  const handleVerifyToken = async () => {
    if (!validateRecoveryToken(recoveryToken)) return;

    setIsVerifyingToken(true);
    setRecoveryTokenError('');

    try {
      console.log('🔍 Verifying recovery token...');
      
      // Try to set the session with the recovery token
      // The token should be in the format that Supabase sends in the email
      const { error } = await supabase.auth.verifyOtp({
        email: email,
        token: recoveryToken,
        type: 'recovery'
      });

      if (error) {
        console.error('❌ Token verification error:', error);
        setRecoveryTokenError('Invalid or expired recovery token. Please check your email and try again.');
      } else {
        console.log('✅ Recovery token verified successfully');
        // Navigate to reset password screen
        navigation.navigate('reset-password');
      }
    } catch (error) {
      console.error('❌ Unexpected error during token verification:', error);
      setRecoveryTokenError('Network error. Please check your internet connection and try again.');
    } finally {
      setIsVerifyingToken(false);
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

  const handleTokenInputFocus = () => {
    setIsTokenFocused(true);
    Animated.spring(tokenInputScaleAnim, {
      toValue: 1.02,
      useNativeDriver: true,
    }).start();
  };

  const handleTokenInputBlur = () => {
    setIsTokenFocused(false);
    Animated.spring(tokenInputScaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handleBackToSignIn = () => {
    navigation.navigate('social-sign-in');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
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
                Reset your password
              </Text>
              <Text style={[styles.subtitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                {showRecoveryTokenInput 
                  ? 'Enter the recovery token from your email to continue'
                  : 'Enter your email address and we\'ll send you instructions to reset your password'
                }
              </Text>
            </View>

            {showRecoveryTokenInput ? (
              <>
                <View style={styles.successContainer}>
                  <View style={styles.successHeader}>
                    <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
                    <Text style={[styles.successTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                      Email sent successfully
                    </Text>
                  </View>
                  <Text style={[styles.successMessage, { color: Colors[colorScheme ?? 'light'].text }]}>
                    Password reset instructions have been sent to {email}. Please check your inbox and enter the recovery token below.
                  </Text>
                </View>

                <View style={styles.tokenInputSpacing} />

                <Animated.View 
                  style={[
                    styles.inputContainer,
                    { transform: [{ scale: tokenInputScaleAnim }] }
                  ]}
                >
                  <View style={styles.codeInputContainer}>
                    <Text style={[styles.codeInputLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                      Enter Recovery Token
                    </Text>
                    <TextInput
                      style={[
                        styles.codeInput,
                        {
                          color: Colors[colorScheme ?? 'light'].text,
                          backgroundColor: Colors[colorScheme ?? 'light'].card,
                          borderColor: recoveryTokenError 
                            ? '#FF3B30' 
                            : isTokenFocused 
                              ? '#9E95BD' 
                              : colorScheme === 'dark' ? '#333' : '#E5E5E7',
                        }
                      ]}
                      value={recoveryToken}
                      onChangeText={handleRecoveryTokenChange}
                      onFocus={handleTokenInputFocus}
                      onBlur={handleTokenInputBlur}
                      placeholder="123456"
                      placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
                      keyboardType="numeric"
                      maxLength={6}
                      textAlign="center"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isVerifyingToken}
                    />
                    {isVerifyingToken && (
                      <ActivityIndicator 
                        size="small" 
                        color="#9E95BD" 
                        style={{ marginTop: 8 }}
                      />
                    )}
                  </View>
                  {recoveryTokenError ? (
                    <View style={styles.errorContainer}>
                      <Ionicons name="alert-circle" size={16} color="#FF3B30" />
                      <Text style={styles.errorText}>{recoveryTokenError}</Text>
                    </View>
                  ) : null}
                </Animated.View>

                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    onPress={handleVerifyToken}
                    disabled={!recoveryToken.trim() || !!recoveryTokenError || isVerifyingToken}
                    style={styles.buttonWrapper}
                  >
                    <LinearGradient
                      colors={['#FF0005', '#FF4D9D', '#FF69E2', '#B97AFF', '#9E95BD']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      locations={[0, 0.25, 0.5, 0.75, 1]}
                      style={[
                        styles.resetButton,
                        (!recoveryToken.trim() || !!recoveryTokenError || isVerifyingToken) && styles.disabledButton,
                      ]}
                    >
                      <Text style={styles.resetButtonText}>
                        {isVerifyingToken ? 'Verifying...' : 'Verify Token'}
                      </Text>
                      {!isVerifyingToken && (
                        <Ionicons name="checkmark" size={18} color="white" style={styles.buttonIcon} />
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  style={styles.backToSignInLink}
                  onPress={handleBackToSignIn}
                  disabled={isVerifyingToken}
                >
                  <Text style={[styles.backToSignInLinkText, { color: '#9E95BD' }]}>
                    Back to Sign In
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
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
                      editable={!isLoading}
                    />
                    {isLoading && (
                      <ActivityIndicator 
                        size="small" 
                        color="#9E95BD" 
                        style={{ marginLeft: 8 }}
                      />
                    )}
                  </View>
                  {emailError ? (
                    <View style={styles.errorContainer}>
                      <Ionicons name="alert-circle" size={16} color="#FF3B30" />
                      <Text style={styles.errorText}>{emailError}</Text>
                    </View>
                  ) : null}
                </Animated.View>

                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    onPress={handleResetPassword}
                    disabled={!email.trim() || !!emailError || isLoading}
                    style={styles.buttonWrapper}
                  >
                    <LinearGradient
                      colors={['#FF0005', '#FF4D9D', '#FF69E2', '#B97AFF', '#9E95BD']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      locations={[0, 0.25, 0.5, 0.75, 1]}
                      style={[
                        styles.resetButton,
                        (!email.trim() || !!emailError || isLoading) && styles.disabledButton,
                      ]}
                    >
                      <Text style={styles.resetButtonText}>
                        {isLoading ? 'Sending...' : 'Send Reset Instructions'}
                      </Text>
                      {!isLoading && (
                        <Ionicons name="paper-plane" size={18} color="white" style={styles.buttonIcon} />
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  style={styles.backToSignInLink}
                  onPress={handleBackToSignIn}
                  disabled={isLoading}
                >
                  <Text style={[styles.backToSignInLinkText, { color: '#9E95BD' }]}>
                    Remember your password? Sign in
                  </Text>
                </TouchableOpacity>
              </>
            )}
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
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  inputContainer: {
    marginBottom: 30,
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
  successContainer: {
    padding: 20,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    alignItems: 'center',
  },
  successHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  successMessage: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
    marginBottom: 20,
    lineHeight: 20,
  },
  tokenInputSpacing: {
    height: 20, // Adjust as needed for spacing
  },
  backToSignInButtonWrapper: {
    shadowColor: '#9E95BD',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  backToSignInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  backToSignInButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  buttonContainer: {
    marginBottom: 20,
  },
  buttonWrapper: {
    width: '100%',
  },
  resetButton: {
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
    gap: 8,
  },
  resetButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  buttonIcon: {
    marginLeft: 4,
  },
  disabledButton: {
    opacity: 0.5,
  },
  backToSignInLink: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  backToSignInLinkText: {
    fontSize: 16,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  codeInputContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  codeInputLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  codeInput: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderRadius: 12,
    width: 200,
    marginBottom: 16,
    textAlign: 'center',
  },
});

export default ForgotPasswordScreen; 