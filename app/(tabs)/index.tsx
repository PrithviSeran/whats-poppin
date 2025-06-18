import { Image, StyleSheet, Platform, ActivityIndicator, View, Text, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { HelloWave } from '@/components/HelloWave';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

import SignInScreen from '@/components/SignInScreen';
import SuggestedEvents from '@/components/SuggestedEvents';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import GlobalDataManager from '@/lib/GlobalDataManager';

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(false);
  
  const colorScheme = useColorScheme();
  
  // Animation values for loading screen
  const pulseAnim = useState(new Animated.Value(0))[0];
  const rotateAnim = useState(new Animated.Value(0))[0];
  const fadeAnim = useState(new Animated.Value(0))[0];

  // Get the singleton instance
  const dataManager = GlobalDataManager.getInstance();

  // Start loading animations
  useEffect(() => {
    if (isDataLoading) {
      // Fade in the loading screen
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Start the pulse and rotate animations
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
    } else {
      // Fade out the loading screen when not loading
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isDataLoading]);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Check if user has a session
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        
        if (session) {
          // User has session, initialize data
          setIsDataLoading(true);
          
          // Set current user in data manager
          await dataManager.setCurrentUser(session.user);
          
          // Wait for data manager to fully load
          await dataManager.initialize();
          
          setIsDataLoading(false);
        }
      } catch (error) {
        console.error('Error initializing app:', error);
        setIsDataLoading(false);
      }
    };

    initializeApp();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        
        if (session) {
          // User just signed in, initialize data
          setIsDataLoading(true);
          await dataManager.setCurrentUser(session.user);
          await dataManager.initialize();
          setIsDataLoading(false);
        } else {
          // User signed out, cleanup
          await dataManager.clearAllUserData();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Beautiful themed loading screen
  const LoadingScreen = () => {
    const spin = rotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });
    
    const scale = pulseAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.8, 1.2],
    });

    return (
      <View style={[styles.loadingContainer, { backgroundColor: colorScheme === 'dark' ? '#181818' : '#F2F2F2' }]}>
        <LinearGradient
          colors={colorScheme === 'dark' 
            ? ['#181818', '#2A2A2A', '#181818'] 
            : ['#F2F2F2', '#FFFFFF', '#F2F2F2']
          }
          style={styles.loadingGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
                     <Animated.View
             style={[
               styles.loadingCircle,
               {
                 opacity: fadeAnim,
                 transform: [{ scale }, { rotate: spin }],
                 borderColor: '#FF1493',
               },
             ]}
           >
             <View style={styles.innerCircle}>
               <Ionicons name="heart" size={24} color="#FF1493" />
             </View>
           </Animated.View>
          
          <Animated.Text 
            style={[
              styles.loadingText, 
              { 
                color: Colors[colorScheme ?? 'light'].text,
                opacity: fadeAnim,
              }
            ]}
          >
            Loading your events...
          </Animated.Text>
          
                     <Animated.View style={[styles.loadingSubtitle, { opacity: fadeAnim }]}>
             <Text style={[styles.subtitleText, { color: Colors[colorScheme ?? 'light'].text }]}>
               Discovering amazing activities just for you
             </Text>
           </Animated.View>
           
           <Animated.View style={[styles.brandingContainer, { opacity: fadeAnim }]}>
             <LinearGradient
               colors={['#FF0005', '#FF4D9D', '#FF69E2', '#B97AFF', '#9E95BD']}
               start={{ x: 0, y: 0 }}
               end={{ x: 1, y: 0 }}
               style={styles.brandingGradient}
             >
               <Text style={styles.brandingText}>What's Poppin</Text>
             </LinearGradient>
           </Animated.View>
        </LinearGradient>
      </View>
    );
  };

  // Render logic
  if (!session) {
    return <SignInScreen />;
  }

  // if (isDataLoading) {
  //   return <LoadingScreen />;
  // }

  // Data is ready, show the main content
  return <SuggestedEvents />;
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingGradient: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  innerCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 20, 147, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  loadingSubtitle: {
    marginTop: 8,
  },
  subtitleText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
    fontWeight: '400',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ff3333',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    fontSize: 16,
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  retryButtonGradient: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  brandingContainer: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
  },
  brandingGradient: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  brandingText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 1,
  },
});