import React, { createContext, useState, useContext, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import NotificationService from '../lib/NotificationService';

// Create context
type AuthContextType = {
  session: Session | null;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({ session: null, isLoading: true });

// Context provider
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
      
      // Initialize notification service if user is already logged in
      if (session) {
        console.log('🔐 AuthContext: Initial session exists, initializing notification service...');
        try {
          const notificationService = NotificationService.getInstance();
          await notificationService.initialize();
          console.log('✅ AuthContext: Initial notification service initialized successfully');
        } catch (error) {
          console.error('❌ AuthContext: Error initializing initial notification service:', error);
        }
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('🔐 AuthContext: Auth state change event:', event, 'Session exists:', !!newSession);
      
      setSession(newSession);
      setIsLoading(false);
      
      // Handle notification service for user login/logout
      if (newSession) {
        console.log('🔐 AuthContext: User logged in, initializing notification service...');
        try {
          const notificationService = NotificationService.getInstance();
          await notificationService.handleUserLogin();
          console.log('✅ AuthContext: Notification service initialized successfully');
        } catch (error) {
          console.error('❌ AuthContext: Error initializing notification service:', error);
        }
      } else {
        console.log('🔐 AuthContext: User logged out, cleaning up notification service...');
        try {
          const notificationService = NotificationService.getInstance();
          await notificationService.cleanup();
          console.log('✅ AuthContext: Notification service cleaned up successfully');
        } catch (error) {
          console.error('❌ AuthContext: Error cleaning up notification service:', error);
        }
      }
    });

    // Fallback: Check session every 2 seconds to ensure notification service is initialized
    const sessionCheckInterval = setInterval(async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession && currentSession !== session) {
        console.log('🔐 AuthContext: Fallback session check - new session detected, initializing notification service...');
        try {
          const notificationService = NotificationService.getInstance();
          await notificationService.handleUserLogin();
          console.log('✅ AuthContext: Fallback notification service initialized successfully');
        } catch (error) {
          console.error('❌ AuthContext: Error in fallback notification service initialization:', error);
        }
      }
    }, 2000);

    // Cleanup
    return () => {
      subscription.unsubscribe();
      clearInterval(sessionCheckInterval);
    };
  }, [session]);

  return (
    <AuthContext.Provider value={{ session, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook for using the auth context
export function useAuth() {
  return useContext(AuthContext);
}