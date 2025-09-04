import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  Dimensions,
  Animated,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedGradientText from './GradientAnimatedText';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import LegalDocumentViewer from './LegalDocumentViewer';
// import { GoogleSignin } from '@react-native-google-signin/google-signin';
import GlobalDataManager from '@/lib/GlobalDataManager';
import NotificationService from '@/lib/NotificationService';
import { supabase } from '@/lib/supabase';
import * as Crypto from 'expo-crypto';
// Lazy/optional Apple auth import to avoid build-time type errors if not installed
const AppleAuth: any = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-apple-authentication');
  } catch {
    return null;
  }
})();

type RootStackParamList = {
  'social-sign-in': undefined;
  'create-account': undefined;
  'suggested-events': undefined;
  'create-account-username': { userData: string; isGoogleSignIn?: boolean };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

const LOGO_IMAGE_LIGHT = require('../assets/images/logo-light.png');
const LOGO_IMAGE_DARK = require('../assets/images/logo.png');

const CATCH_PHRASES = [
  "Any Plans Tonight?",
  "What's the Motive?",
  "Where We Linking?",
  "Plans or Nah?",
  "Where's the Spot?",
  "Wagwan Cro?"
];

const SignInScreen = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const navigation = useNavigation<NavigationProp>();
  const colorScheme = useColorScheme();
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  // const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [isAppleSigningIn, setIsAppleSigningIn] = useState(false);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);

  // Configure Google Sign-In
  // useEffect(() => {
  //   GoogleSignin.configure({
  //     iosClientId: '1028929347533-7e75f5bat89emtq4jl86o3vifpupvcnn.apps.googleusercontent.com',
  //     // Add Android client ID if needed
  //     // androidClientId: 'your-android-client-id.apps.googleusercontent.com',
  //   });
  // }, []);

  // Check Apple availability on iOS
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'ios' && AppleAuth?.isAvailableAsync) {
          const available = await AppleAuth.isAvailableAsync();
          console.log('🍎 Apple Sign-In available:', available);
          setIsAppleAvailable(!!available);
        } else {
          console.log('🍎 Apple Sign-In not available on this platform');
          setIsAppleAvailable(false);
        }
      } catch (error) {
        console.error('🍎 Error checking Apple Sign-In availability:', error);
        setIsAppleAvailable(false);
      }
    })();
  }, []);

  const handleOpenTerms = () => {
    setShowTermsModal(true);
  };

  const handleOpenPrivacyPolicy = () => {
    setShowPrivacyModal(true);
  };

  // const handleGoogleSignIn = async () => {
  //   try {
  //     setIsGoogleSigningIn(true);
      
  //     // Check if Google Play Services are available (Android)
  //     if (Platform.OS === 'android') {
  //       await GoogleSignin.hasPlayServices();
  //     }
      
  //     // Sign in with Google
  //     const userInfo = await GoogleSignin.signIn() as any;
  //     console.log('Google Sign-In successful:', userInfo);
      
  //     if (!userInfo.data?.idToken) {
  //       throw new Error('No ID token received from Google');
  //     }
      
  //     // Sign in with Supabase using Google token
  //     const { data, error } = await supabase.auth.signInWithIdToken({
  //       provider: 'google',
  //       token: userInfo.data.idToken,
  //     });
      
  //     if (error) {
  //       console.error('Supabase Google Sign-In error:', error);
  //       throw error;
  //     }
      
  //     if (data.user) {
  //       console.log('✅ Google Sign-In successful, user:', data.user.email);
        
  //       // Check if user already has a username
  //       const { data: userProfile, error: profileError } = await supabase
  //         .from('all_users')
  //         .select('username')
  //         .eq('email', data.user.email)
  //         .single();
        
  //       if (profileError && profileError.code !== 'PGRST116') {
  //         console.error('Error checking user profile:', profileError);
  //       }
        
  //       // Set user in GlobalDataManager
  //       GlobalDataManager.getInstance().setCurrentUser(data.user);

  //       // Trigger notification service initialization for Google Sign-In
  //       try {
  //         console.log('🔔 SignInScreen: Triggering notification service initialization for Google Sign-In...');
  //         const notificationService = NotificationService.getInstance();
  //         await notificationService.handleUserLogin();
  //         console.log('✅ SignInScreen: Notification service initialized for Google Sign-In');
  //       } catch (error) {
  //         console.error('❌ SignInScreen: Error initializing notification service for Google Sign-In:', error);
  //       }

  //       navigation.navigate('create-account-username', {
  //         userData: JSON.stringify({
  //           email: data.user.email,
  //           googleUserInfo: userInfo.data,
  //           supabaseUser: data.user
  //         }),
  //         isGoogleSignIn: true
  //       });
        
  //       /*
  //       if (userProfile?.username) {
  //         // User already has a username, go directly to SuggestedEvents
  //         navigation.navigate('suggested-events');
  //       } else {
  //         // User doesn't have a username, go to CreateAccountUsername
  //         navigation.navigate('create-account-username', {
  //           userData: JSON.stringify({
  //             email: data.user.email,
  //             googleUserInfo: userInfo.data,
  //             supabaseUser: data.user
  //           }),
  //           isGoogleSignIn: true
  //         });
  //       }*/
  //     }
  //   } catch (error) {
  //     console.error('❌ Google Sign-In error:', error);
  //     // Handle error appropriately
  //   } finally {
  //     setIsGoogleSigningIn(false);
  //   }
  // };

  const handleAppleSignIn = async () => {
    try {
      setIsAppleSigningIn(true);
      
      // Check if Apple Sign-In is available
      if (!AppleAuth?.signInAsync) {
        throw new Error('Apple Sign-In not available');
      }
      
      console.log('🍎 Starting Apple Sign-In...');
      
      // Generate nonce (raw) and SHA-256 hash for Apple request
      const generateRandomNonce = (length: number) => {
        const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        let result = '';
        for (let i = 0; i < length; i++) {
          result += chars[Math.floor(Math.random() * chars.length)];
        }
        return result;
      };

      const rawNonce = generateRandomNonce(32);
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      
      console.log('🍎 Generated nonce, requesting Apple credentials...');
      console.log('🍎 Bundle ID:', 'com.prithviseran.whatspoppin');
      console.log('🍎 Platform:', Platform.OS);
      console.log('🍎 Device:', Platform.OS === 'ios' ? 'iOS Device' : 'Android Device');
      
      // Request Apple credentials with minimal scopes first
      const credential = await AppleAuth.signInAsync({
        requestedScopes: [
          AppleAuth.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      
      console.log('🍎 Apple credential received:', {
        user: credential.user,
        email: credential.email,
        fullName: credential.fullName,
        hasIdentityToken: !!credential.identityToken,
        hasAuthorizationCode: !!credential.authorizationCode,
      });

      if (!credential.identityToken) {
        throw new Error('No identity token received from Apple');
      }

      // Sign in with Supabase using Apple token
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });

      if (error) {
        console.error('Supabase Apple Sign-In error:', error);
        throw error;
      }

      if (data.user) {
        console.log('✅ Apple Sign-In successful, user:', data.user.email);

        // Set user in GlobalDataManager
        GlobalDataManager.getInstance().setCurrentUser(data.user);

        // Initialize notifications
        try {
          console.log('🔔 SignInScreen: Triggering notification service initialization for Apple Sign-In...');
          const notificationService = NotificationService.getInstance();
          await notificationService.handleUserLogin();
          console.log('✅ SignInScreen: Notification service initialized for Apple Sign-In');
        } catch (err) {
          console.error('❌ SignInScreen: Error initializing notification service for Apple Sign-In:', err);
        }

        // Build a google-like payload for downstream username screen
        const appleUserInfo: any = {
          name: credential.fullName
            ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
            : undefined,
          email: credential.email || data.user.email,
          idToken: credential.identityToken,
        };

        navigation.navigate('create-account-username', {
          userData: JSON.stringify({
            email: data.user.email,
            googleUserInfo: appleUserInfo, // reuse same field shape for downstream logic
            supabaseUser: data.user,
          }),
          isGoogleSignIn: true, // reuse the same downstream flow/labels
        });
      }
    } catch (error) {
      const err: any = error;
      if (err?.code === 'ERR_CANCELED') {
        // User canceled; no-op
        return;
      }
      try {
        const details = {
          code: err?.code,
          domain: err?.domain,
          message: err?.message,
          userInfo: err?.userInfo,
          nativeStackIOS: err?.nativeStackIOS,
          stack: err?.stack,
        };
        console.error('❌ Apple Sign-In detailed error:', details);
      } catch {}
      console.error('❌ Apple Sign-In error:', err);
    } finally {
      setIsAppleSigningIn(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % CATCH_PHRASES.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }).start();
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Comprehensive animation cleanup on component unmount
  useEffect(() => {
    return () => {
      // Stop all animations to prevent memory leaks
      console.log('🧹 SignInScreen: Cleaning up animations');
      
      // Stop all animated values
      fadeAnim.stopAnimation();
    };
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      <View style={styles.centerContent}>
        <View style={styles.headerContainer}>
          <Image
            source={colorScheme === 'dark' ? LOGO_IMAGE_DARK : LOGO_IMAGE_LIGHT}
            style={colorScheme === 'dark' ? styles.logo : styles.logoLight}
            resizeMode="contain"
          />
        </View>

        <View style={styles.textContainer}>
          <AnimatedGradientText
            phrases={CATCH_PHRASES}
            colors={['#FF0005', '#FF4D9D', '#FF69E2', '#B97AFF', '#9E95BD'] as const}
          />
        </View>

        <View style={styles.buttonGroup}>
          <Text style={[styles.welcomeText, { color: Colors[colorScheme ?? 'light'].text }]}>
            By tapping "Sign In" or "Create Account", you agree to our <Text style={styles.termsLink} onPress={handleOpenTerms}>Terms of Service</Text> and <Text style={styles.termsLink} onPress={handleOpenPrivacyPolicy}>Privacy Policy</Text>.
          </Text>
          
          {/* Google Sign-In Button */}
          {/* <TouchableOpacity 
            onPress={handleGoogleSignIn}
            disabled={isGoogleSigningIn}
            style={[styles.googleButton, isGoogleSigningIn && styles.disabledButton]}
            activeOpacity={0.8}
          >
            <View style={styles.googleButtonContent}>
              {isGoogleSigningIn ? (
                <ActivityIndicator size="small" color="#757575" />
              ) : (
                <Image 
                  source={require('../assets/images/google-logo.webp')} 
                  style={styles.googleIcon}
                  resizeMode="contain"
                />
              )}
              <Text style={styles.googleButtonText}>
                {isGoogleSigningIn ? 'Signing in...' : 'Continue with Google'}
              </Text>
            </View>
          </TouchableOpacity> */}

          {/* Apple Sign-In Button */}
          {Platform.OS === 'ios' && isAppleAvailable && (
            <TouchableOpacity 
              onPress={handleAppleSignIn}
              disabled={isAppleSigningIn}
              style={[styles.appleButton, isAppleSigningIn && styles.disabledButton]}
              activeOpacity={0.8}
            >
              <View style={styles.appleButtonContent}>
                {isAppleSigningIn ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Image 
                    source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg' }} 
                    style={styles.appleIcon}
                    resizeMode="contain"
                  />
                )}
                <Text style={styles.appleButtonText}>
                  {isAppleSigningIn ? 'Signing in...' : 'Continue with Apple'}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={[styles.dividerText, { color: Colors[colorScheme ?? 'light'].text }]}>or</Text>
            <View style={styles.dividerLine} />
          </View>
          
          <TouchableOpacity onPress={() => navigation.navigate('social-sign-in')}>
            <LinearGradient
              colors={['#FF0005', '#FF4D9D', '#FF69E2', '#B97AFF', '#9E95BD']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              locations={[0, 0.25, 0.5, 0.75, 1]}
              style={styles.loginButton}
            >
              <Text style={styles.loginButtonText}>Sign In</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('create-account')}>
            <LinearGradient
              colors={['#FF0005', '#FF4D9D', '#FF69E2', '#B97AFF', '#9E95BD']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              locations={[0, 0.25, 0.5, 0.75, 1]}
              style={styles.signupButton}
            >
              <Text style={styles.signupButtonText}>Create Account</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingBottom: 40,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  headerContainer: {
    width: '100%',
    marginTop: 20,
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
  textContainer: {
    marginTop: -40,
    marginBottom: 20,
    width: '100%',
  },
  buttonGroup: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 40,
  },
  welcomeText: {
    fontSize: 12,
    textAlign: 'center',
    marginHorizontal: 20,
    marginBottom: 30,
    lineHeight: 24,
  },
  troubleText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginHorizontal: 20,
    marginTop: 30,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    width: width * 0.8,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  googleButtonText: {
    color: '#757575',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Gotham Rounded',
  },
  appleButton: {
    backgroundColor: '#000000',
    borderRadius: 30,
    width: width * 0.8,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#000000',
  },
  appleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleIcon: {
    width: 18,
    height: 18,
    marginRight: 12,
    tintColor: '#FFFFFF',
  },
  appleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Gotham Rounded',
  },
  disabledButton: {
    opacity: 0.6,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: width * 0.8,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 15,
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.6,
  },
  loginButton: {
    borderRadius: 30,
    width: width * 0.8,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Gotham Rounded',
  },
  signupButton: {
    borderRadius: 30,
    width: width * 0.8,
    paddingVertical: 13,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  signupButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Gotham Rounded',
  },
  termsLink: {
    color: '#F45B5B',
    textDecorationLine: 'underline',
  },
});

export default SignInScreen;
