import React, { useEffect, useState } from 'react';
import { useColorScheme } from '@/hooks/useColorScheme';

import SignInScreen from '@/components/SignInScreen';
import SuggestedEvents from '@/components/SuggestedEvents';
import MainLoadingScreen from '@/components/MainLoadingScreen';
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

  // Handle loading completion from MainLoadingScreen
  const handleLoadingComplete = (destination: 'suggested-events' | 'social-sign-in') => {
    console.log('🎯 HomeScreen: Loading complete, destination:', destination);
    // The MainLoadingScreen already determined the destination based on auth status
    // We don't need to do additional navigation here since we're already showing the right screen
    setIsLoading(false);
  };

  // Show loading screen while checking auth or loading data
  if (isLoading || isDataLoading) {
    return <MainLoadingScreen onLoadingComplete={handleLoadingComplete} />;
  }

  // Show appropriate screen based on session
  if (!session) {
    console.log('📱 HomeScreen: No session, showing SignInScreen');
    return <SignInScreen />;
  }

  console.log('📱 HomeScreen: Session exists, showing SuggestedEvents');
  return <SuggestedEvents />;
}