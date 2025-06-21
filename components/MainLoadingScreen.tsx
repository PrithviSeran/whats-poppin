import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';

const { width, height } = Dimensions.get('window');

interface MainLoadingScreenProps {
  onLoadingComplete?: (destination: 'suggested-events' | 'social-sign-in') => void;
}

export default function MainLoadingScreen({ onLoadingComplete }: MainLoadingScreenProps) {
  const colorScheme = useColorScheme();
  
  // Debug mode - set to true for quick testing
  const DEBUG_MODE = false;
  
  // Animation refs
  const logoScaleAnim = useRef(new Animated.Value(0)).current;
  const logoOpacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;
  const gradientAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Add a failsafe timeout to prevent infinite loading
    const failsafeTimeout = setTimeout(() => {
      console.log('⚠️ MainLoadingScreen: Failsafe timeout triggered - forcing navigation to social-sign-in');
      if (onLoadingComplete) {
        onLoadingComplete('social-sign-in');
      }
    }, 15000); // 15 seconds max

    // Start the loading animation sequence
    const startAnimations = () => {
      console.log('🎨 MainLoadingScreen: Starting animations...');
      
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

      // Check authentication and auto-complete after animations
      if (DEBUG_MODE) {
        console.log('🐛 MainLoadingScreen: DEBUG MODE - Quick routing to social-sign-in');
        setTimeout(() => {
          if (onLoadingComplete) {
            onLoadingComplete('social-sign-in');
          }
        }, 3000);
      } else {
        checkAuthAndComplete();
      }
    };

    const checkAuthAndComplete = async () => {
      console.log('🚀 MainLoadingScreen: Starting checkAuthAndComplete...');
      
      try {
        // Wait at least 2 seconds for animations to show
        console.log('⏱️ MainLoadingScreen: Waiting 2 seconds for animations...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('🔍 MainLoadingScreen: Checking authentication status...');
        
        // Check authentication status with timeout
        const authPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Auth check timeout')), 10000)
        );
        
        const { data: { session }, error } = await Promise.race([authPromise, timeoutPromise]) as any;
        
        console.log('📊 MainLoadingScreen: Auth check result:', {
          hasSession: !!session,
          hasUser: !!(session?.user),
          userEmail: session?.user?.email,
          error: error?.message
        });
        
        if (error) {
          console.error('❌ MainLoadingScreen: Error checking auth status:', error);
          // Default to sign-in on error
          if (onLoadingComplete) {
            clearTimeout(failsafeTimeout);
            console.log('🔄 MainLoadingScreen: Calling onLoadingComplete with social-sign-in (error fallback)');
            onLoadingComplete('social-sign-in');
          }
          return;
        }

        // Wait up to 5 seconds total for the full loading experience
        const remainingTime = Math.max(0, 5000 - 2000); // 3 seconds remaining
        console.log(`⏱️ MainLoadingScreen: Waiting ${remainingTime}ms more for full experience...`);
        await new Promise(resolve => setTimeout(resolve, remainingTime));

        // Route based on authentication status
        if (onLoadingComplete) {
          // Clear the failsafe timeout since we're completing normally
          clearTimeout(failsafeTimeout);
          
          if (session && session.user) {
            console.log('✅ MainLoadingScreen: User is authenticated, calling onLoadingComplete with suggested-events');
            console.log('👤 User email:', session.user.email);
            onLoadingComplete('suggested-events');
          } else {
            console.log('🔒 MainLoadingScreen: User is not authenticated, calling onLoadingComplete with social-sign-in');
            onLoadingComplete('social-sign-in');
          }
        } else {
          console.error('❌ MainLoadingScreen: onLoadingComplete callback is undefined!');
        }
      } catch (error) {
        console.error('❌ MainLoadingScreen: Error in checkAuthAndComplete:', error);
        if (onLoadingComplete) {
          clearTimeout(failsafeTimeout);
          console.log('🔄 MainLoadingScreen: Calling onLoadingComplete with social-sign-in (catch fallback)');
          onLoadingComplete('social-sign-in');
        } else {
          console.error('❌ MainLoadingScreen: onLoadingComplete callback is undefined in catch block!');
        }
      }
    };

    startAnimations();

    // Cleanup function
    return () => {
      console.log('🧹 MainLoadingScreen: Cleaning up animations and timers...');
      clearTimeout(failsafeTimeout);
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
                ? require('@/assets/images/logo.png')
                : require('@/assets/images/logo-light.png')
              }
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        {/* App Title */}
        <Animated.View style={[styles.titleContainer, { opacity: textFadeAnim }]}>
          <Text style={[styles.appTitle, { color: colorScheme === 'dark' ? '#FFFFFF' : '#1A1A1A' }]}>
            What's Poppin
          </Text>
          <Text style={[styles.appSubtitle, { color: colorScheme === 'dark' ? 'rgba(255,255,255,0.8)' : 'rgba(26,26,26,0.8)' }]}>
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
                borderColor: colorScheme === 'dark' ? '#FFFFFF' : '#FF1493',
              },
            ]}
          >
            <View style={[styles.innerCircle, {
              backgroundColor: colorScheme === 'dark' 
                ? 'rgba(255, 255, 255, 0.2)' 
                : 'rgba(255, 20, 147, 0.1)'
            }]} />
          </Animated.View>
          <Text style={[styles.loadingText, { 
            color: colorScheme === 'dark' ? '#FFFFFF' : '#1A1A1A',
            marginTop: 20 
          }]}>
            Preparing your experience...
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