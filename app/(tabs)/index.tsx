import React, { useEffect, useState } from 'react';
import { useColorScheme } from '@/hooks/useColorScheme';

import SignInScreen from '@/components/SignInScreen';
import SuggestedEvents from '@/components/SuggestedEvents';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

export default function HomeScreen() {
  const [session, setSession] = useState<Session | null>(null);
  
  const colorScheme = useColorScheme();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 HomeScreen: Starting app initialization...');
        
        // Check if user has a session
        const { data: { session } } = await supabase.auth.getSession();
        console.log('🔐 HomeScreen: Session check result:', session ? 'Found session' : 'No session');
        setSession(session);
        
        console.log('✅ HomeScreen: App initialization complete');
      } catch (error) {
        console.error('❌ HomeScreen: Error initializing app:', error);
      }
    };

    initializeApp();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 HomeScreen: Auth state changed:', event, session ? 'Session exists' : 'No session');
        setSession(session);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Show appropriate screen based on session
  if (!session) {
    console.log('📱 HomeScreen: No session, showing SignInScreen');
    return <SignInScreen />;
  }

  console.log('📱 HomeScreen: Session exists, showing SuggestedEvents');
  return <SuggestedEvents />;
}