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

type RootStackParamList = {
  'social-sign-in': undefined;
  'reset-password': { email: string };
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
  const colorScheme = useColorScheme();
  const inputScaleAnim = useRef(new Animated.Value(1)).current;

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

  const handleResetPassword = async () => {
    if (!validateEmail(email)) return;

    setIsLoading(true);
    setSuccessMessage('');
    setEmailError('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'whatspoppin://reset-password',
      });

      if (error) {
        setEmailError(error.message);
      } else {
        setSuccessMessage('Password reset instructions have been sent to your email');
        setEmail('');
      }
    } catch (error) {
      setEmailError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
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
                Enter your email address and we'll send you instructions to reset your password
              </Text>
            </View>

            {successMessage ? (
              <View style={styles.successContainer}>
                <View style={styles.successHeader}>
                  <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
                  <Text style={[styles.successTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                    Check your email
                  </Text>
                </View>
                <Text style={[styles.successMessage, { color: Colors[colorScheme ?? 'light'].text }]}>
                  {successMessage}
                </Text>
                <TouchableOpacity 
                  style={styles.backToSignInButtonWrapper}
                  onPress={handleBackToSignIn}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#9E95BD', '#B97AFF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.backToSignInButton}
                  >
                    <Ionicons name="arrow-back" size={18} color="white" />
                    <Text style={styles.backToSignInButtonText}>Back to Sign In</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
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
});

export default ForgotPasswordScreen; 