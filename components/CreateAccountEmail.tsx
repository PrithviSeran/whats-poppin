import React, { useState, useRef, useEffect } from 'react';
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
import { AuthChangeEvent, Session } from '@supabase/supabase-js';

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
  const [isVerificationSent, setIsVerificationSent] = useState(false);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [enteredCode, setEnteredCode] = useState('');
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [lastSendTime, setLastSendTime] = useState<number>(0);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const navigation = useNavigation<NavigationProp>();
  const colorScheme = useColorScheme();
  const inputScaleAnim = useRef(new Animated.Value(1)).current;
  const userData = route?.params?.userData ? JSON.parse(route.params.userData) : {};

  // Cooldown timer effect
  useEffect(() => {
    let interval: number;
    
    if (lastSendTime > 0) {
      interval = setInterval(() => {
        const now = Date.now();
        const timeSinceLastSend = now - lastSendTime;
        const cooldownMs = 60 * 1000; // 60 seconds
        const remaining = Math.max(0, Math.ceil((cooldownMs - timeSinceLastSend) / 1000));
        
        setCooldownSeconds(remaining);
        
        if (remaining === 0) {
          clearInterval(interval);
        }
      }, 1000);
    } else {
      setCooldownSeconds(0);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [lastSendTime]);

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
      // Only check our all_users table for registered accounts
      // We don't need to worry about the auth table since we're using OTP without creating users
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
    setVerificationError('');
    setIsVerificationSent(false);
    setIsEmailVerified(false);
    setEnteredCode('');
    setLastSendTime(0); // Reset cooldown when email changes
    
    // Validate format first
    if (validateEmail(text)) {
      // Debounce the email check
      const timeoutId = setTimeout(() => {
        checkEmailExists(text);
      }, 800);
      
      return () => clearTimeout(timeoutId);
    }
  };

    const sendVerificationEmail = async () => {
    if (!validateEmail(email) || emailExists) return;

    // Check cooldown period (60 seconds)
    const now = Date.now();
    const timeSinceLastSend = now - lastSendTime;
    const cooldownMs = 60 * 1000; // 60 seconds

    if (lastSendTime > 0 && timeSinceLastSend < cooldownMs) {
      const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastSend) / 1000);
      setVerificationError(`Please wait ${remainingSeconds} seconds before requesting another code.`);
      return;
    }

    setIsSendingVerification(true);
    setVerificationError('');

    try {
      console.log('Sending verification code to:', email);
      
      // Call our custom Edge Function to send verification code
      const { data: functionData, error: functionError } = await supabase.functions.invoke('send-verification-code', {
        body: { email: email.toLowerCase() }
      });

      if (functionError) {
        console.error('Error calling send-verification-code function:', functionError);
        setVerificationError('Failed to send verification email. Please try again.');
        return;
      }

      if (!functionData?.success) {
        console.error('Send verification function returned error:', functionData);
        setVerificationError('Failed to send verification email. Please try again.');
        return;
      }

      console.log('✅ Verification code sent successfully');
      setIsVerificationSent(true);
      setVerificationError('');
      setLastSendTime(Date.now());

    } catch (error) {
      console.error('Unexpected error during email verification:', error);
      setVerificationError('Network error. Please check your connection and try again.');
    } finally {
      setIsSendingVerification(false);
    }
  };

  const verifyCode = async () => {
    if (!enteredCode.trim() || enteredCode.length !== 6) {
      setVerificationError('Please enter a valid 6-digit code');
      return;
    }

    setIsVerifyingCode(true);
    setVerificationError('');

    try {
      console.log('🔐 Verifying code:', enteredCode, 'for email:', email.toLowerCase());
      
      // Check verification code in our custom table
      const { data: verificationData, error: verificationError } = await supabase
        .from('email_verifications')
        .select('*')
        .eq('email', email.toLowerCase())
        .eq('code', enteredCode)
        .gt('expires_at', new Date().toISOString())
        .is('verified_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (verificationError) {
        console.error('Error checking verification code:', verificationError);
        setVerificationError('Failed to verify code. Please try again.');
        return;
      }

      if (!verificationData) {
        setVerificationError('Invalid or expired verification code. Please check the code or request a new one.');
        return;
      }

      // Mark the verification as used
      const { error: updateError } = await supabase
        .from('email_verifications')
        .update({ verified_at: new Date().toISOString() })
        .eq('id', verificationData.id);

      if (updateError) {
        console.error('Error marking verification as used:', updateError);
        // Don't fail here - verification was successful
      }

      console.log('✅ Email verified successfully!');
      setIsEmailVerified(true);
      setVerificationError('');

    } catch (error) {
      console.error('Error verifying code:', error);
      setVerificationError('Network error. Please check your connection and try again.');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // Cleanup effect


  const resendVerificationEmail = async () => {
    // Check cooldown before proceeding
    const now = Date.now();
    const timeSinceLastSend = now - lastSendTime;
    const cooldownMs = 60 * 1000; // 60 seconds

    if (lastSendTime > 0 && timeSinceLastSend < cooldownMs) {
      const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastSend) / 1000);
      setVerificationError(`Please wait ${remainingSeconds} seconds before requesting another code.`);
      return;
    }

    setIsResending(true);
    
    // Reset verification states
    setIsVerificationSent(false);
    setIsEmailVerified(false);
    setEnteredCode('');
    setVerificationError('');
    
    // Send new verification email
    await sendVerificationEmail();
    setIsResending(false);
  };

  const handleNext = () => {
    if (validateEmail(email) && !emailExists && !isCheckingEmail) {
      if (!isVerificationSent) {
        // First time - send verification code
        sendVerificationEmail();
      } else if (isEmailVerified) {
        // Email verified - proceed to next step
        console.log('📤 Navigating to next step with verified email');
        navigation.navigate('create-account-birthday', {
          userData: JSON.stringify({ 
            ...userData, 
            email: email.toLowerCase().trim(), 
            emailVerified: true 
          }),
        });
      }
      // If verification sent but not verified yet, user needs to enter code
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
        currentStep={3}
        totalSteps={6}
        stepLabels={['Name', 'Username', 'Email', 'Birthday', 'Password', 'Location']}
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

               {/* Email Verification Section */}
               {isVerificationSent && (
                 <View style={[
                   styles.verificationContainer,
                   isEmailVerified && { backgroundColor: 'rgba(76, 175, 80, 0.15)', borderColor: 'rgba(76, 175, 80, 0.4)' }
                 ]}>
                   <View style={styles.verificationHeader}>
                     <Ionicons 
                       name={isEmailVerified ? "checkmark-circle" : "mail"} 
                       size={24} 
                       color={isEmailVerified ? "#4CAF50" : "#FF8C00"} 
                     />
                     <Text style={[styles.verificationTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                       {isEmailVerified 
                         ? 'Email Verified!' 
                         : 'Verification Code Sent!'
                       }
                     </Text>
                   </View>
                   
                                        <Text style={[styles.verificationMessage, { color: Colors[colorScheme ?? 'light'].text }]}>
                       {isEmailVerified ? (
                         <>
                           Great! Your email <Text style={styles.emailHighlight}>{email}</Text> has been verified. 
                           You can now continue with your account creation.
                         </>
                       ) : (
                         <>
                           We've sent a 6-digit verification code to <Text style={styles.emailHighlight}>{email}</Text>. 
                           Please check your inbox (and spam folder) and enter the code below.
                         </>
                       )}
                     </Text>

                   {!isEmailVerified && (
                     <View style={styles.codeInputContainer}>
                       <Text style={[styles.codeInputLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                         Enter Verification Code
                       </Text>
                       <TextInput
                         style={[
                           styles.codeInput,
                           {
                             color: Colors[colorScheme ?? 'light'].text,
                             backgroundColor: Colors[colorScheme ?? 'light'].card,
                             borderColor: colorScheme === 'dark' ? '#333' : '#E5E5E7',
                           }
                         ]}
                         value={enteredCode}
                         onChangeText={setEnteredCode}
                         placeholder="123456"
                         placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
                         keyboardType="number-pad"
                         maxLength={6}
                         textAlign="center"
                         autoCapitalize="none"
                         autoCorrect={false}
                       />
                       
                       <TouchableOpacity 
                         style={[
                           styles.verifyCodeButton,
                           (!enteredCode.trim() || enteredCode.length !== 6 || isVerifyingCode) && styles.disabledCodeButton
                         ]}
                         onPress={verifyCode}
                         disabled={!enteredCode.trim() || enteredCode.length !== 6 || isVerifyingCode}
                         activeOpacity={0.7}
                       >
                         <LinearGradient
                           colors={['#4CAF50', '#45A049']}
                           start={{ x: 0, y: 0 }}
                           end={{ x: 1, y: 1 }}
                           style={styles.verifyCodeButtonGradient}
                         >
                           {isVerifyingCode ? (
                             <ActivityIndicator size="small" color="white" />
                           ) : (
                             <Ionicons name="checkmark" size={18} color="white" />
                           )}
                           <Text style={styles.verifyCodeButtonText}>
                             {isVerifyingCode ? 'Verifying...' : 'Verify Code'}
                           </Text>
                         </LinearGradient>
                       </TouchableOpacity>
                     </View>
                   )}

                   {!isEmailVerified && (
                     <View style={styles.verificationActions}>
                       <TouchableOpacity 
                         style={[
                           styles.resendButton, 
                           { 
                             borderColor: colorScheme === 'dark' ? '#666' : '#D1D5DB',
                             backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                             opacity: (cooldownSeconds > 0 || isResending) ? 0.5 : 1
                           }
                         ]}
                         onPress={resendVerificationEmail}
                         disabled={isResending || cooldownSeconds > 0}
                         activeOpacity={0.7}
                       >
                         {isResending ? (
                           <ActivityIndicator size="small" color="#9E95BD" />
                         ) : (
                           <Ionicons name="refresh-outline" size={18} color="#9E95BD" />
                         )}
                         <Text style={[styles.resendButtonText, { color: '#9E95BD' }]}>
                           {isResending 
                             ? 'Sending...' 
                             : cooldownSeconds > 0 
                               ? `Resend Code (${cooldownSeconds}s)`
                               : 'Resend Code'
                           }
                         </Text>
                       </TouchableOpacity>
                     </View>
                   )}

                   {verificationError && (
                     <View style={styles.errorContainer}>
                       <Ionicons name="alert-circle" size={16} color="#FF3B30" />
                       <Text style={styles.errorText}>{verificationError}</Text>
                     </View>
                   )}
                 </View>
               )}
            </Animated.View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={handleNext}
              disabled={!email.trim() || !!emailError || emailExists || isCheckingEmail || isSendingVerification || (isVerificationSent && !isEmailVerified)}
              style={styles.buttonWrapper}
            >
              <LinearGradient
                colors={['#FF0005', '#FF4D9D', '#FF69E2', '#B97AFF', '#9E95BD']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                locations={[0, 0.25, 0.5, 0.75, 1]}
                style={[
                  styles.nextButton,
                  (!email.trim() || !!emailError || emailExists || isCheckingEmail || isSendingVerification || (isVerificationSent && !isEmailVerified)) && styles.disabledButton,
                ]}
              >
                {isSendingVerification ? (
                  <>
                    <ActivityIndicator size="small" color="white" />
                    <Text style={styles.nextButtonText}>Sending Code...</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.nextButtonText}>
                      {!isVerificationSent 
                        ? 'Send Verification Code' 
                        : isEmailVerified 
                          ? 'Continue' 
                          : 'Enter Code Above to Continue'
                      }
                    </Text>
                    <Ionicons 
                      name={!isVerificationSent 
                        ? "mail" 
                        : isEmailVerified 
                          ? "chevron-forward" 
                          : "keypad"
                      } 
                      size={20} 
                      color="white" 
                      style={styles.buttonIcon} 
                    />
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
  verificationContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  verificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  verificationMessage: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 16,
    lineHeight: 20,
  },
  emailHighlight: {
    fontWeight: '600',
    color: '#4CAF50',
  },
  verificationActions: {
    alignItems: 'center',
    gap: 12,
  },
  checkStatusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 6,
    width: '100%',
  },
  checkStatusButtonText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 6,
    width: '100%',
  },
  resendButtonText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  codeInputContainer: {
    marginVertical: 16,
    alignItems: 'center',
  },
  codeInputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
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
  },
  verifyCodeButton: {
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  verifyCodeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  verifyCodeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  disabledCodeButton: {
    opacity: 0.5,
  },
});

export default CreateAccountEmail;
