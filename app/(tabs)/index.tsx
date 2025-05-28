import { Image, StyleSheet, Platform, ActivityIndicator } from 'react-native';

import { HelloWave } from '@/components/HelloWave';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

import SignInScreen from '@/components/SignInScreen';
import SuggestedEvents from '@/components/SuggestedEvents';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import GlobalDataManager from '@/lib/GlobalDataManager';

export default function HomeScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [isDataInitialized, setIsDataInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  // Get the singleton instance
  const dataManager = GlobalDataManager.getInstance();

  useEffect(() => {
    // Handle authentication state
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        
        if (session) {
          // User just signed in, update the current user in GlobalDataManager
          dataManager.setCurrentUser(session.user);
          
          // Initialize global data after successful sign in
          await initializeGlobalData();
        } else {
          // User signed out, cleanup
          setIsDataInitialized(false);
          setInitializationError(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // If user is already signed in on app start, initialize data
    if (session && !isDataInitialized && !isInitializing) {
      dataManager.setCurrentUser(session.user);
      initializeGlobalData();
    }
  }, [session, isDataInitialized, isInitializing]);

  const initializeGlobalData = async () => {
    if (dataManager.isDataInitialized()) {
      setIsDataInitialized(true);
      return;
    }

    setIsInitializing(true);
    setInitializationError(null);

    try {
      // Listen for initialization completion
      const handleDataInitialized = () => {
        console.log('Global data initialized successfully');
        setIsDataInitialized(true);
        setIsInitializing(false);
        dataManager.off('dataInitialized', handleDataInitialized);
      };

      dataManager.on('dataInitialized', handleDataInitialized);
      
      // Initialize the data
      await dataManager.initialize();
      
    } catch (error) {
      console.error('Failed to initialize global data:', error);
      setInitializationError('Failed to load app data. Please try again.');
      setIsInitializing(false);
      
      // Remove the listener if initialization failed
      dataManager.removeAllListeners('dataInitialized');
    }
  };

  const handleRetryInitialization = async () => {
    await initializeGlobalData();
  };

  // Loading screen while initializing data
  const LoadingScreen = () => (
    <ThemedView style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#007AFF" />
      <ThemedText style={styles.loadingText}>Loading your events...</ThemedText>
    </ThemedView>
  );

  // Error screen with retry option
  const ErrorScreen = () => (
    <ThemedView style={styles.errorContainer}>
      <ThemedText style={styles.errorText}>{initializationError}</ThemedText>
      <ThemedText 
        style={styles.retryButton} 
        onPress={handleRetryInitialization}
      >
        Tap to retry
      </ThemedText>
    </ThemedView>
  );

  // Render logic
  if (!session) {
    return <SignInScreen />;
  }

  if (isInitializing) {
    return <LoadingScreen />;
  }

  if (initializationError) {
    return <ErrorScreen />;
  }

  if (!isDataInitialized) {
    return <LoadingScreen />;
  }

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
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
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
});