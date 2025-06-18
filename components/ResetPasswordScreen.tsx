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
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

const LOGO_IMAGE_LIGHT = require('../assets/images/logo-light.png');
const LOGO_IMAGE_DARK = require('../assets/images/logo.png');

const ResetPasswordScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const colorScheme = useColorScheme();
  const passwordScaleAnim = useRef(new Animated.Value(1)).current;
  const confirmPasswordScaleAnim = useRef(new Animated.Value(1)).current;

  const checkPasswordRequirements = (text: string) => ({
    length: text.length >= 8,
    uppercase: /[A-Z]/.test(text),
    lowercase: /[a-z]/.test(text),
    number: /[0-9]/.test(text),
    special: /[!@#$%^&*]/.test(text),
  });

  const validatePassword = (text: string) => {
    const requirements = checkPasswordRequirements(text);
    if (!text.trim()) {
      setPasswordError('Password is required');
      return false;
    }
    if (!requirements.length) {
      setPasswordError('At least 8 characters');
      return false;
    }
    if (!requirements.uppercase) {
      setPasswordError('One uppercase letter required');
      return false;
    }
    if (!requirements.lowercase) {
      setPasswordError('One lowercase letter required');
      return false;
    }
    if (!requirements.number) {
      setPasswordError('One number required');
      return false;
    }
    if (!requirements.special) {
      setPasswordError('One special character required');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const validateConfirmPassword = (text: string) => {
    if (!text.trim()) {
      setConfirmPasswordError('Please confirm your password');
      return false;
    }
    if (text !== password) {
      setConfirmPasswordError('Passwords do not match');
      return false;
    }
    setConfirmPasswordError('');
    return true;
  };

  const handleResetPassword = async () => {
    if (!validatePassword(password) || !validateConfirmPassword(confirmPassword)) return;

    setIsLoading(true);
    setSuccessMessage('');
    setPasswordError('');
    setConfirmPasswordError('');

    try {
      // Get the current session - should be automatically established from the deep link
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        setPasswordError('Invalid or expired password reset link. Please request a new password reset from the sign-in screen.');
        setIsLoading(false);
        return;
      }

      // Verify the session is for password recovery
      if (!session.user?.aud || session.user.aud !== 'authenticated') {
        setPasswordError('Invalid session. Please request a new password reset link.');
        setIsLoading(false);
        return;
      }

      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        // Handle specific error types
        if (updateError.message.includes('session_not_found')) {
          setPasswordError('Session expired. Please request a new password reset link.');
        } else if (updateError.message.includes('weak_password')) {
          setPasswordError('Password is too weak. Please choose a stronger password.');
        } else {
          setPasswordError(updateError.message);
        }
      } else {
        setSuccessMessage('Password has been reset successfully! Redirecting to sign in...');
        // Sign out to ensure clean state
        await supabase.auth.signOut();
        setTimeout(() => {
          navigation.navigate('social-sign-in');
        }, 2000);
      }
    } catch (error) {
      setPasswordError('Network error. Please check your internet connection and try again.');
    } finally {
      setIsLoading(false);
    }
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

  const handleConfirmPasswordFocus = () => {
    setConfirmPasswordFocused(true);
    Animated.spring(confirmPasswordScaleAnim, {
      toValue: 1.02,
      useNativeDriver: true,
    }).start();
  };

  const handleConfirmPasswordBlur = () => {
    setConfirmPasswordFocused(false);
    Animated.spring(confirmPasswordScaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handleBackToSignIn = () => {
    navigation.navigate('social-sign-in');
  };

  const requirements = checkPasswordRequirements(password);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.navigate('social-sign-in')}
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
                Create new password
              </Text>
              <Text style={[styles.subtitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                Choose a strong password to secure your account
              </Text>
            </View>

            {successMessage ? (
              <View style={styles.successContainer}>
                <View style={styles.successHeader}>
                  <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
                  <Text style={[styles.successTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                    Password Reset Complete
                  </Text>
                </View>
                <Text style={[styles.successMessage, { color: Colors[colorScheme ?? 'light'].text }]}>
                  {successMessage}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.inputsContainer}>
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
                        borderColor: passwordError 
                          ? '#FF3B30' 
                          : passwordFocused 
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
                          validatePassword(text);
                          if (confirmPassword) validateConfirmPassword(confirmPassword);
                          setSuccessMessage('');
                        }}
                        onFocus={handlePasswordFocus}
                        onBlur={handlePasswordBlur}
                        placeholder="Enter your new password"
                        placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
                        autoCapitalize="none"
                        autoCorrect={false}
                        secureTextEntry={!showPassword}
                        returnKeyType="next"
                        editable={!isLoading}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        style={styles.eyeButton}
                      >
                        <Ionicons 
                          name={showPassword ? "eye-off-outline" : "eye-outline"} 
                          size={22} 
                          color={Colors[colorScheme ?? 'light'].icon} 
                        />
                      </TouchableOpacity>
                    </View>
                    {passwordError ? (
                      <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle" size={16} color="#FF3B30" />
                        <Text style={styles.errorText}>{passwordError}</Text>
                      </View>
                    ) : null}
                  </Animated.View>

                  <Animated.View 
                    style={[
                      styles.inputContainer,
                      { transform: [{ scale: confirmPasswordScaleAnim }] }
                    ]}
                  >
                    <View style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: Colors[colorScheme ?? 'light'].card,
                        borderColor: confirmPasswordError 
                          ? '#FF3B30' 
                          : confirmPasswordFocused 
                            ? '#9E95BD' 
                            : colorScheme === 'dark' ? '#333' : '#E5E5E7',
                        shadowColor: confirmPasswordFocused ? '#9E95BD' : '#000',
                        shadowOpacity: confirmPasswordFocused ? 0.2 : 0.1,
                      }
                    ]}>
                      <Ionicons 
                        name="lock-closed-outline" 
                        size={22} 
                        color={confirmPasswordFocused ? '#9E95BD' : Colors[colorScheme ?? 'light'].icon} 
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={[
                          styles.input,
                          { color: Colors[colorScheme ?? 'light'].text },
                        ]}
                        value={confirmPassword}
                        onChangeText={(text) => {
                          setConfirmPassword(text);
                          validateConfirmPassword(text);
                          setSuccessMessage('');
                        }}
                        onFocus={handleConfirmPasswordFocus}
                        onBlur={handleConfirmPasswordBlur}
                        placeholder="Confirm your new password"
                        placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
                        autoCapitalize="none"
                        autoCorrect={false}
                        secureTextEntry={!showConfirmPassword}
                        returnKeyType="done"
                        onSubmitEditing={handleResetPassword}
                        editable={!isLoading}
                      />
                      <TouchableOpacity
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={styles.eyeButton}
                      >
                        <Ionicons 
                          name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} 
                          size={22} 
                          color={Colors[colorScheme ?? 'light'].icon} 
                        />
                      </TouchableOpacity>
                    </View>
                    {confirmPasswordError ? (
                      <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle" size={16} color="#FF3B30" />
                        <Text style={styles.errorText}>{confirmPasswordError}</Text>
                      </View>
                    ) : null}
                  </Animated.View>

                  {password && !passwordError && (
                    <View style={styles.requirementsContainer}>
                      <Text style={[styles.requirementsTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                        Password requirements:
                      </Text>
                      <View style={styles.requirementsList}>
                        {[
                          { key: 'length', label: 'At least 8 characters', icon: 'checkmark-circle' },
                          { key: 'uppercase', label: 'One uppercase letter', icon: 'checkmark-circle' },
                          { key: 'lowercase', label: 'One lowercase letter', icon: 'checkmark-circle' },
                          { key: 'number', label: 'One number', icon: 'checkmark-circle' },
                          { key: 'special', label: 'One special character', icon: 'checkmark-circle' },
                        ].map(({ key, label, icon }) => (
                          <View key={key} style={styles.requirementRow}>
                            <Ionicons 
                              name={requirements[key as keyof typeof requirements] ? icon as any : "ellipse-outline"} 
                              size={16} 
                              color={requirements[key as keyof typeof requirements] ? '#22C55E' : '#6B7280'} 
                              style={styles.requirementIcon}
                            />
                            <Text
                              style={[
                                styles.requirementText,
                                { 
                                  color: requirements[key as keyof typeof requirements] 
                                    ? '#22C55E' 
                                    : Colors[colorScheme ?? 'light'].text,
                                  opacity: requirements[key as keyof typeof requirements] ? 1 : 0.6,
                                }
                              ]}
                            >
                              {label}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    onPress={handleResetPassword}
                    disabled={!password.trim() || !confirmPassword.trim() || !!passwordError || !!confirmPasswordError || isLoading}
                    style={styles.buttonWrapper}
                  >
                    <LinearGradient
                      colors={['#FF0005', '#FF4D9D', '#FF69E2', '#B97AFF', '#9E95BD']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      locations={[0, 0.25, 0.5, 0.75, 1]}
                      style={[
                        styles.resetButton,
                        (!password.trim() || !confirmPassword.trim() || !!passwordError || !!confirmPasswordError || isLoading) && styles.disabledButton,
                      ]}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <>
                          <Text style={styles.resetButtonText}>Reset Password</Text>
                          <Ionicons name="checkmark" size={18} color="white" style={styles.buttonIcon} />
                        </>
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
                    Back to Sign In
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
    minHeight: 400,
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
  },
  inputsContainer: {
    gap: 20,
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 4,
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
  eyeButton: {
    padding: 4,
    marginLeft: 8,
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
    lineHeight: 20,
  },
  requirementsContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: 'rgba(158, 149, 189, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(158, 149, 189, 0.2)',
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    opacity: 0.8,
  },
  requirementsList: {
    gap: 8,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requirementIcon: {
    marginRight: 8,
  },
  requirementText: {
    fontSize: 13,
    fontWeight: '500',
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

export default ResetPasswordScreen; 