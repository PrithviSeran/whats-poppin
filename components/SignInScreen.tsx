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

const BALLOON_IMAGE = require('../assets/images/balloons.png');

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
          <View style={styles.headerRow}>
            <Image
              source={BALLOON_IMAGE}
              style={styles.balloons}
              resizeMode="contain"
            />
            <MaskedView
              maskElement={
                <Text style={[styles.title, { opacity: 1 }]}>{`What's Poppin?`}</Text>
              }
            >
              <LinearGradient
                colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                locations={[0, 0.3, 0.7, 1]}
              >
                <Text style={[styles.title, { opacity: 0 }]}>{`What's Poppin?`}</Text>
              </LinearGradient>
            </MaskedView>
          </View>
        </View>

        <AnimatedGradientText
          phrases={CATCH_PHRASES}
          colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF69B4'] as const}
        />

        <View style={styles.buttonGroup}>
          <Text style={[styles.welcomeText, { color: Colors[colorScheme ?? 'light'].text }]}>
            By tapping "Sign In" or "Create Account", you agree to our <Text style={styles.termsLink} onPress={handleOpenTerms}>Terms of Service</Text> and <Text style={styles.termsLink} onPress={handleOpenPrivacyPolicy}>Privacy Policy</Text>.
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('social-sign-in')}>
            <LinearGradient
              colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
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
              colors={['#FF9A9E', '#FF69B4', '#9D4EDD', '#FF9A9E']}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balloons: {
    width: width * 0.22, // bigger balloon
    height: width * 0.22,
    marginRight: -6, // slight overlap to keep it snug
  },
  title: {
    fontSize: 32, // bigger text
    fontWeight: 'bold',
    color: '#F45B5B',
    textAlign: 'left',
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 4, height: 4 },
    textShadowRadius: 6,
    fontFamily: Platform.OS === 'ios' ? 'MarkerFelt-Wide' : 'sans-serif-condensed',
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
