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
  TextInput,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedGradientText from './GradientAnimatedText';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';

type RootStackParamList = {
  'social-sign-in': undefined;
  'suggested-events': undefined;
  'forgot-password': undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

const BALLOON_IMAGE = require('../assets/images/balloons.png');

const CATCH_PHRASES = [
  "Any Plans Tonight?",
  "What's the Motive?",
  "Where We Linking?",
  "Plans or Nah?",
  "Where's the Spot?",
  "Wagwan Cro?"
];

const SocialSignInScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const colorScheme = useColorScheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isEmailValid, setIsEmailValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
    if (!isEmailValid) {
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        setError(getErrorMessage(error));
        throw error;
      }
      
      console.log('Sign in successful:', data);
      navigation.navigate('suggested-events');
    } catch (error) {
      console.error('Error during sign in:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenTerms = () => {
    const termsUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'; // Replace with your PDF URL
    Linking.openURL(termsUrl).catch(err => console.error('An error occurred', err));
  };

  const handleOpenPrivacyPolicy = () => {
    const privacyPolicyUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'; // Replace with your PDF URL
    Linking.openURL(privacyPolicyUrl).catch(err => console.error('An error occurred', err));
  };

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % CATCH_PHRASES.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.centerContent}>
            <TouchableOpacity
              style={{
                position: 'absolute',
                top: 50,
                left: 20,
                zIndex: 10,
                backgroundColor: 'rgba(0,0,0,0.1)',
                borderRadius: 20,
                padding: 8,
              }}
              onPress={() => navigation.goBack()}
            >
              <Text style={{ fontSize: 28, color: '#FF1493' }}>{'←'}</Text>
            </TouchableOpacity>

            <View style={styles.headerContainer}>
              <Image
                source={BALLOON_IMAGE}
                style={styles.balloons}
                resizeMode="contain"
              />
              <Text style={styles.title}>{`What's Poppin?`}</Text>
            </View>
            
            <View style={styles.buttonGroup}>
              <Text style={[styles.welcomeText, { color: Colors[colorScheme ?? 'light'].text }]}>
                By tapping "Sign In" or "Create Account", you agree to our <Text style={styles.termsLink} onPress={handleOpenTerms}>Terms of Service</Text> and <Text style={styles.termsLink} onPress={handleOpenPrivacyPolicy}>Privacy Policy</Text>.
              </Text>

              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, { color: '#333' }]}
                  placeholder="Email"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setError(null);
                    setIsEmailValid(validateEmail(text));
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!isLoading}
                />
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, { color: '#333' }]}
                  placeholder="Password"
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError(null);
                  }}
                  secureTextEntry
                  editable={!isLoading}
                />
              </View>

              <TouchableOpacity 
                style={[
                  styles.signInButton, 
                  (!isEmailValid || isLoading) && styles.disabledButton
                ]} 
                onPress={handleSignIn}
                disabled={!isEmailValid || isLoading}
              >
                <LinearGradient
                  colors={isEmailValid && !isLoading ? ['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD'] : ['#ccc', '#ccc']}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 1}}
                  locations={[0, 0.3, 0.7, 1]}
                  style={styles.gradientButton}
                >
                  <Text style={styles.signInButtonText}>
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <Text style={styles.troubleText}>
                <TouchableOpacity onPress={() => navigation.navigate('forgot-password')}>
                  <Text style={[styles.troubleText, { color: '#FF1493' }]}>
                    Trouble signing in?
                  </Text>
                </TouchableOpacity>
              </Text>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingTop: 20,
    paddingBottom: 40,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    width: '100%',
    paddingRight: 50,
  },
  balloons: {
    width: width * 0.4,
    height: width * 0.2,
  },
  title: {
    fontSize: 25,
    fontWeight: 'bold',
    color: '#F45B5B',
    textAlign: 'left',
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 4, height: 4 },
    textShadowRadius: 6,
    marginLeft: -50,
    fontFamily: Platform.OS === 'ios' ? 'MarkerFelt-Wide' : 'sans-serif-condensed',
  },
  buttonGroup: {
    width: '100%',
    alignItems: 'center',
    marginBottom: -20,
  },
  termsLink: {
    color: '#F45B5B',
    textDecorationLine: 'underline',
  },
  welcomeText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginHorizontal: 20,
    marginBottom: 30,
    lineHeight: 24,
    zIndex: 1,
  },
  inputContainer: {
    width: width * 0.8,
    marginBottom: 15,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  input: {
    height: 46,
    paddingHorizontal: 20,
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  signInButton: {
    width: width * 0.8,
    height: 46,
    marginBottom: 20,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  gradientButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Gotham Rounded',
  },
  troubleText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginHorizontal: 20,
    marginTop: 15,
  },
  gradientTextContainer: {
    marginTop: 10,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.7,
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    width: width * 0.8,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default SocialSignInScreen; 



{/*
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity>
            <LinearGradient
              colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              locations={[0, 0.3, 0.7, 1]}
              style={styles.socialButton}
            >
              <View style={styles.iconContainer}>
                <Image 
                  source={require('../assets/images/google-logo.webp')}
                  style={styles.socialIcon}
                />
              </View>
              <Text style={styles.socialButtonText}>Sign In with Google</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity>
            <LinearGradient
              colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              locations={[0, 0.3, 0.7, 1]}
              style={styles.socialButton}
            >
              <View style={styles.iconContainer}>
                <Image 
                  source={require('../assets/images/meta-logo.png')}
                  style={styles.socialIcon}
                />
              </View>
              <Text style={styles.socialButtonText}>Sign In with Facebook</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity>
            <LinearGradient
              colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              locations={[0, 0.3, 0.7, 1]}
              style={styles.socialButton}
            >
              <View style={styles.iconContainer}>
                <Image 
                  source={require('../assets/images/phone-logo.png')}
                  style={styles.socialIcon}
                />
              </View>
              <Text style={styles.socialButtonText}>Sign In with Number</Text>
            </LinearGradient>
          </TouchableOpacity>
          */}