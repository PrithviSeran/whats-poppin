import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

const { width, height } = Dimensions.get('window');

interface MainLoadingScreenProps {
  onLoadingComplete?: () => void;
}

export default function MainLoadingScreen({ onLoadingComplete }: MainLoadingScreenProps) {
  const colorScheme = useColorScheme();
  
  // Animation refs
  const logoScaleAnim = useRef(new Animated.Value(0)).current;
  const logoOpacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;
  const gradientAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start the loading animation sequence
    const startAnimations = () => {
      // Logo entrance animation
      Animated.parallel([
        Animated.spring(logoScaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacityAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start();

      // Gradient background animation
      Animated.loop(
        Animated.timing(gradientAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: false,
        })
      ).start();

      // Pulsing loading circle animation
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 0,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Text fade in animation (delayed)
      setTimeout(() => {
        Animated.timing(textFadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }).start();
      }, 400);

      // Auto-complete loading after 3 seconds (optional)
      if (onLoadingComplete) {
        setTimeout(() => {
          onLoadingComplete();
        }, 3000);
      }
    };

    startAnimations();

    // Cleanup function
    return () => {
      logoScaleAnim.stopAnimation();
      logoOpacityAnim.stopAnimation();
      pulseAnim.stopAnimation();
      rotateAnim.stopAnimation();
      textFadeAnim.stopAnimation();
      gradientAnim.stopAnimation();
    };
  }, [onLoadingComplete]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const scale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.2],
  });

  return (
    <View style={styles.container}>
      {/* Animated Background Gradient */}
      <Animated.View style={[styles.backgroundGradient, {
        opacity: gradientAnim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.8, 1, 0.8],
        })
      }]}>
        <LinearGradient
          colors={colorScheme === 'dark' 
            ? ['#1A1A2E', '#16213E', '#0F3460', '#533A7B'] 
            : ['#9E95BD', '#F45B5B', '#9E95BD', '#B8AECC']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          locations={[0, 0.3, 0.7, 1]}
          style={styles.gradient}
        />
      </Animated.View>

      {/* Content Container */}
      <View style={styles.contentContainer}>
        {/* Logo Section */}
        <Animated.View 
          style={[
            styles.logoContainer,
            {
              transform: [{ scale: logoScaleAnim }],
              opacity: logoOpacityAnim,
            }
          ]}
        >
          <View style={styles.logoWrapper}>
            <Image 
              source={colorScheme === 'dark' 
                ? require('@/assets/images/logo-light.png')
                : require('@/assets/images/logo.png')
              }
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        {/* App Title */}
        <Animated.View style={[styles.titleContainer, { opacity: textFadeAnim }]}>
          <Text style={[styles.appTitle, { color: Colors[colorScheme ?? 'light'].background === '#FFFFFF' ? '#FFFFFF' : '#1A1A1A' }]}>
            What's Poppin
          </Text>
          <Text style={[styles.appSubtitle, { color: Colors[colorScheme ?? 'light'].background === '#FFFFFF' ? 'rgba(255,255,255,0.8)' : 'rgba(26,26,26,0.8)' }]}>
            Discover Amazing Events
          </Text>
        </Animated.View>

        {/* Loading Animation */}
        <Animated.View style={[styles.loadingContainer, { opacity: textFadeAnim }]}>
          <Animated.View
            style={[
              styles.loadingCircle,
              {
                transform: [{ scale }, { rotate: spin }],
                borderColor: Colors[colorScheme ?? 'light'].background === '#FFFFFF' ? '#FFFFFF' : '#FF1493',
              },
            ]}
          >
            <View style={[styles.innerCircle, {
              backgroundColor: Colors[colorScheme ?? 'light'].background === '#FFFFFF' 
                ? 'rgba(255, 255, 255, 0.2)' 
                : 'rgba(255, 20, 147, 0.1)'
            }]} />
          </Animated.View>
          <Text style={[styles.loadingText, { 
            color: Colors[colorScheme ?? 'light'].background === '#FFFFFF' ? '#FFFFFF' : '#1A1A1A',
            marginTop: 20 
          }]}>
            Loading amazing events...
          </Text>
        </Animated.View>
      </View>

      {/* Floating Particles Effect */}
      <View style={styles.particlesContainer}>
        {[...Array(6)].map((_, index) => (
          <Animated.View
            key={index}
            style={[
              styles.particle,
              {
                left: `${15 + index * 12}%`,
                top: `${20 + index * 8}%`,
                opacity: pulseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.2, 0.8],
                }),
                transform: [{
                  translateY: pulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -10],
                  })
                }]
              }
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradient: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    zIndex: 1,
  },
  logoContainer: {
    marginBottom: 40,
  },
  logoWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  logo: {
    width: 80,
    height: 80,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  appSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  particlesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
}); 