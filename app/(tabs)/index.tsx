import React, { useEffect, useState } from 'react';
import { useColorScheme } from '@/hooks/useColorScheme';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';

import SignInScreen from '@/components/SignInScreen';
import SuggestedEvents from '@/components/SuggestedEvents';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import GlobalDataManager from '@/lib/GlobalDataManager';

export default function HomeScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  
  const colorScheme = useColorScheme();

  // Get the singleton instance
  const dataManager = GlobalDataManager.getInstance();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 HomeScreen: Starting app initialization...');
        
        // Check if user has a session
        const { data: { session } } = await supabase.auth.getSession();
        console.log('🔐 HomeScreen: Session check result:', session ? 'Found session' : 'No session');
        setSession(session);
        
        if (session) {
          // User has session, initialize data
          console.log('📊 HomeScreen: User has session, starting data initialization...');
          setIsDataLoading(true);
          
          // Set current user in data manager
          await dataManager.setCurrentUser(session.user);
          
          // Wait for data manager to fully load
          await dataManager.initialize();
          
          console.log('✅ HomeScreen: Data initialization complete');
          setIsDataLoading(false);
        }
        
        console.log('✅ HomeScreen: App initialization complete');
        setIsLoading(false);
      } catch (error) {
        console.error('❌ HomeScreen: Error initializing app:', error);
        setIsLoading(false);
        setIsDataLoading(false);
      }
    };

    initializeApp();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 HomeScreen: Auth state changed:', event, session ? 'Session exists' : 'No session');
        setSession(session);
        
        if (session) {
          // User just signed in, initialize data
          console.log('📊 HomeScreen: User signed in, initializing data...');
          setIsDataLoading(true);
          await dataManager.setCurrentUser(session.user);
          await dataManager.initialize();
          setIsDataLoading(false);
          console.log('✅ HomeScreen: Data initialization complete after sign in');
        } else {
          // User signed out, cleanup
          console.log('🧹 HomeScreen: User signed out, cleaning up data...');
          await dataManager.clearAllUserData();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Show loading screen while checking auth or loading data
  if (isLoading || isDataLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
        <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].primary} />
      </View>
    );
  }

  // Show appropriate screen based on session
  if (!session) {
    console.log('📱 HomeScreen: No session, showing SignInScreen');
    return <SignInScreen />;
  }

  console.log('📱 HomeScreen: Session exists, showing SuggestedEvents');
  return <SuggestedEvents />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});