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
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedGradientText from './GradientAnimatedText';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import MaskedView from '@react-native-masked-view/masked-view';

type RootStackParamList = {
  'social-sign-in': undefined;
  'create-account': undefined;
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

  const handleOpenTerms = () => {
    const termsUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'; // Sample PDF URL
    Linking.openURL(termsUrl).catch(err => console.error('An error occurred', err));
  };

  const handleOpenPrivacyPolicy = () => {
    const privacyPolicyUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'; // Sample PDF URL
    Linking.openURL(privacyPolicyUrl).catch(err => console.error('An error occurred', err));
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
            colors={['#9E95BD', '#9E95BD', '#FF0005', '#9E95BD'] as const}
          />
        </View>

        <View style={styles.buttonGroup}>
          <Text style={[styles.welcomeText, { color: Colors[colorScheme ?? 'light'].text }]}>
            By tapping "Sign In" or "Create Account", you agree to our <Text style={styles.termsLink} onPress={handleOpenTerms}>Terms of Service</Text> and <Text style={styles.termsLink} onPress={handleOpenPrivacyPolicy}>Privacy Policy</Text>.
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('social-sign-in')}>
            <LinearGradient
              colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              locations={[0, 0.3, 0.7, 1]}
              style={styles.loginButton}
            >
              <Text style={styles.loginButtonText}>Sign In</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('create-account')}>
            <LinearGradient
              colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              locations={[0, 0.3, 0.7, 1]}
              style={styles.signupButton}
            >
              <Text style={styles.signupButtonText}>Create Account</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
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
    width: width * 0.9,
    height: width * 0.5,
  },
  logoLight: {
    width: width * 0.6,
    height: width * 0.33,
    marginTop: 40,
  },
  textContainer: {
    marginTop: 20,
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
