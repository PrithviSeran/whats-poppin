import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { setupDeepLinking } from '@/lib/deepLinking';
import GlobalDataManager from '@/lib/GlobalDataManager';
import { supabase } from '@/lib/supabase';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [isAppReady, setIsAppReady] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 RootLayout: Starting app initialization...');
        
        // Wait for fonts to load
        if (!loaded) {
          console.log('⏳ RootLayout: Waiting for fonts to load...');
          return;
        }
        
        // Check if user has a session
        const { data: { session } } = await supabase.auth.getSession();
        console.log('🔐 RootLayout: Session check result:', session ? 'Found session' : 'No session');
        
        if (session) {
          // User has session, initialize GlobalDataManager
          console.log('📊 RootLayout: User has session, initializing GlobalDataManager...');
          const dataManager = GlobalDataManager.getInstance();
          await dataManager.setCurrentUser(session.user);
          await dataManager.initialize();
          console.log('✅ RootLayout: GlobalDataManager initialized');
        }
        
        // Set up auth state change listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            console.log('🔄 RootLayout: Auth state changed:', event, session ? 'Session exists' : 'No session');
            
            if (session) {
              // User just signed in, initialize data
              console.log('📊 RootLayout: User signed in, initializing GlobalDataManager...');
              const dataManager = GlobalDataManager.getInstance();
              await dataManager.setCurrentUser(session.user);
              await dataManager.initialize();
              console.log('✅ RootLayout: GlobalDataManager initialized after sign in');
            } else {
              // User signed out, cleanup
              console.log('🧹 RootLayout: User signed out, cleaning up data...');
              const dataManager = GlobalDataManager.getInstance();
              await dataManager.clearAllUserData();
            }
          }
        );
        
        console.log('✅ RootLayout: App initialization complete');
        setIsAppReady(true);
        
        // Clean up subscription on unmount
        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('❌ RootLayout: Error initializing app:', error);
        // Still set as ready to prevent infinite loading
        setIsAppReady(true);
      }
    };

    initializeApp();
  }, [loaded]);

  useEffect(() => {
    if (loaded && isAppReady) {
      console.log('🎨 RootLayout: Hiding splash screen');
      SplashScreen.hideAsync();
    }
  }, [loaded, isAppReady]);

  // Set up deep linking
  useEffect(() => {
    const cleanup = setupDeepLinking();

    return () => {
      cleanup();
    };
  }, []);



  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="social-sign-in" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="create-account" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="create-account-username" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="create-account-email" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="create-account-birthday" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="create-account-password" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="create-account-location" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="create-account-finished" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="edit-profile" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="edit-images" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen 
            name="user-profile" 
            options={{ 
              headerShown: false, 
              gestureEnabled: false,
              presentation: 'modal'
            }} 
          />
        <Stack.Screen name="create-event" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="forgot-password" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="reset-password" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen 
            name="suggested-events" 
            options={{ 
              headerShown: false, 
              gestureEnabled: false, 
              animation: 'fade',
              animationDuration: 100
            }} 
          />
          <Stack.Screen 
            name="discover" 
            options={{ 
              headerShown: false, 
              gestureEnabled: false, 
              animation: 'fade',
              animationDuration: 100
            }} 
          />
          <Stack.Screen 
            name="me" 
            options={{ 
              headerShown: false, 
              gestureEnabled: false, 
              animation: 'fade',
              animationDuration: 100
            }} 
          />
          <Stack.Screen 
            name="event/[id]" 
            options={{ 
              headerShown: false, 
              gestureEnabled: false,
              presentation: 'modal',
              animation: 'slide_from_bottom'
            }} 
          />
        <Stack.Screen name="+not-found" options={{ gestureEnabled: false }} />
        </Stack>
    </ThemeProvider>
  );
}
