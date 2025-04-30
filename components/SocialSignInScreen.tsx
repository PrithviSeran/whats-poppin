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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedGradientText from './GradientAnimatedText';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

type RootStackParamList = {
  'social-sign-in': undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

const BALLOON_IMAGE = require('../assets/images/balloons.png');

const CATCH_PHRASES = [
  "Any Plans Tonight?",
  "What's the Motive?",
  "Where We Linking?",
  "Plans or Nah?",
  "Where's the Spot?"
];

const SocialSignInScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const colorScheme = useColorScheme();

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
      <View style={styles.centerContent}>
        <View style={styles.headerContainer}>
          <Image
            source={BALLOON_IMAGE}
            style={styles.balloons}
            resizeMode="contain"
          />
          <Text style={[styles.title, { color: Colors[colorScheme ?? 'light'].text }]}>{`What's Poppin?`}</Text>
        </View>

        <View style={styles.gradientTextContainer}>
          <AnimatedGradientText 
            phrases={CATCH_PHRASES}
            colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B'] as const}
          />
        </View>
        
        <View style={styles.buttonGroup}>
         <Text style={[styles.welcomeText, { color: Colors[colorScheme ?? 'light'].text }]}>
            By tapping "Sign In" or "Create Account", you agree to our <Text style={styles.termsLink}>Terms of Service</Text> and <Text style={styles.termsLink}>Privacy Policy</Text>.
          </Text>
         <TouchableOpacity>
            <LinearGradient
              colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              locations={[0, 0.3, 0.7, 1]}
              style={styles.socialButton}
            >
                <Image 
                source={require('../assets/images/google-logo.webp')}
                style={styles.socialIcon}
                />
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
            <Image 
              source={require('../assets/images/meta-logo.png')}
              style={styles.socialIcon}
            />
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
            <Image 
              source={require('../assets/images/phone-logo.png')}
              style={styles.socialIcon}
            />
              <Text style={styles.socialButtonText}>Sign In with Number</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={[styles.troubleText, { color: Colors[colorScheme ?? 'light'].text }]}>
            Trouble signing in? 
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
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
    marginBottom: 20,
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
    width: width * 0.8,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 30,
    width: width * 0.8,
    paddingVertical: 13,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  socialIcon: {
    width: 24,
    height: 24,
    marginRight: 10,
  },
  socialButtonText: {
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
    marginTop: -20,
    marginBottom: 20,
  },
});

export default SocialSignInScreen; 