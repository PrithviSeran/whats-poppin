import React, { useEffect, useRef, useState } from 'react';
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
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedGradientText from './GradientAnimatedText';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import MaskedView from '@react-native-masked-view/masked-view';
import LegalDocumentViewer from './LegalDocumentViewer';
//import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from '@/lib/supabase';
import GlobalDataManager from '@/lib/GlobalDataManager';
import { Ionicons } from '@expo/vector-icons';

type RootStackParamList = {
  'social-sign-in': undefined;
  'create-account': undefined;
  'suggested-events': undefined;
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
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);

  const dataManager = GlobalDataManager.getInstance();

  // Configure Google Sign-In
  useEffect(() => {
    // GoogleSignin.configure({
    //   iosClientId: '1028929347533-7e75f5bat89emtq4jl86o3vifpupvcnn.apps.googleusercontent.com',
    //   // Add Android client ID if needed
    //   // androidClientId: 'your-android-client-id.apps.googleusercontent.com',
    // });
  }, []);

  const handleOpenTerms = () => {
    setShowTermsModal(true);
  };

  const handleOpenPrivacyPolicy = () => {
    setShowPrivacyModal(true);
  };

      const handleGoogleSignIn = async () => {
    if (isGoogleSigningIn) return;
    
    setIsGoogleSigningIn(true);
    
    try {
      // // Check if Google Play Services are available (Android)
      // if (Platform.OS === 'android') {
      //   await GoogleSignin.hasPlayServices();
      // }
      
      // // Sign in with Google
      // const userInfo = await GoogleSignin.signIn() as any;
      // console.log('Google Sign-In successful:', userInfo);
      
      // if (!userInfo.data?.idToken) {
      //   throw new Error('No ID token received from Google');
      // }
      
      // // Sign in with Supabase using Google token
      // const { data, error } = await supabase.auth.signInWithIdToken({
      //   provider: 'google',
      //   token: userInfo.data.idToken,
      // });
      
      // if (error) {
      //   console.error('Supabase Google Sign-In error:', error);
      //   throw error;
      // }
      
      // if (data.user) {
      //   console.log('✅ Google Sign-In successful with Supabase');
        
      //   // Check if user exists in our all_users table
      //   const { data: existingUser, error: userError } = await supabase
      //     .from('all_users')
      //     .select('*')
      //     .eq('email', userInfo.data.user?.email)
      //     .maybeSingle();
        
      //   if (userError) {
      //     console.error('Error checking existing user:', userError);
      //   }
        
      //   if (!existingUser) {
      //     // Create user profile in all_users table with Google profile data
      //     console.log('🔄 Creating user profile for Google user...');
          
      //     // Extract user info from Google profile
      //     const googleUser = userInfo.data.user;
      //     const googleName = googleUser?.name || googleUser?.givenName || googleUser?.email?.split('@')[0] || 'User';
      //     const googleEmail = googleUser?.email;
      //     const googlePhoto = googleUser?.photo;
          
      //     // Create user profile with Google data (no profile_picture field)
      //     const { error: insertError } = await supabase
      //       .from('all_users')
      //       .insert([{
      //         name: googleName,
      //         email: googleEmail,
      //         birthday: '1990-01-01', // Default birthday - user can update later
      //         gender: null, // Default gender - user can update later
      //         saved_events: '{}',
      //         preferences: [], // Default empty preferences - user can set up later
      //         ['start-time']: '21:00', // Default evening time
      //         ['end-time']: '03:00', // Default late night time
      //         location: 'Toronto, ON', // Default location - user can update later
      //         ['travel-distance']: 50, // Default 50km travel distance
      //       }]);
          
      //     if (insertError) {
      //       console.error('Error creating user profile:', insertError);
      //       // Don't fail the sign-in for profile creation errors
      //     } else {
      //       console.log('✅ User profile created successfully with Google data');
      //       console.log('📊 Created profile for:', {
      //         name: googleName,
      //         email: googleEmail,
      //         photo: googlePhoto ? 'Available' : 'Not provided'
      //       });
      //       // Upload Google profile image to Supabase Storage
      //       if (googlePhoto && googleEmail) {
      //         try {
      //           const response = await fetch(googlePhoto);
      //           const blob = await response.blob();
      //           const emailDir = googleEmail.replace(/[@.]/g, '_');
      //           const { error: uploadError } = await supabase.storage
      //             .from('user-images')
      //             .upload(`${emailDir}/profile.jpg`, blob, {
      //               cacheControl: '3600',
      //               upsert: true,
      //               contentType: 'image/jpeg',
      //             });
      //           if (uploadError) {
      //             console.error('Error uploading profile image:', uploadError);
      //           } else {
      //             console.log('✅ Uploaded Google profile image to Supabase Storage');
      //           }
      //         } catch (err) {
      //           console.error('Error downloading or uploading Google profile image:', err);
      //         }
      //       }
      //       // Show success message to user
      //       Alert.alert(
      //         'Welcome to What\'s Poppin! 🎉',
      //         `Your account has been created with your Google profile data. You can update your preferences and profile information later.`,
      //         [{ text: 'Continue' }]
      //       );
      //       return; // Exit early since we're handling navigation in the alert
      //     }
      //   } else {
      //     console.log('✅ Existing user found:', existingUser.name);
          
      //     // Initialize GlobalDataManager with the new session
      //     await dataManager.setCurrentUser(data.user);
      //     await dataManager.initialize();
          
      //     // Navigate to suggested events
      //     navigation.navigate('suggested-events');
      //   }
      // }
      
    } catch (error: any) {
      console.error('Google Sign-In error:', error);
      
      let errorMessage = 'Failed to sign in with Google. Please try again.';
      
      if (error.code === 'SIGN_IN_CANCELLED') {
        errorMessage = 'Sign-in was cancelled.';
      } else if (error.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
        errorMessage = 'Google Play Services not available.';
      } else if (error.message?.includes('network')) {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      Alert.alert('Google Sign-In Error', errorMessage);
    } finally {
      setIsGoogleSigningIn(false);
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
          <TouchableOpacity 
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
          </TouchableOpacity>
          
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
