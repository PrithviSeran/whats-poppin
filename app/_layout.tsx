import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { setupDeepLinking } from '@/lib/deepLinking';
import GlobalDataManager from '@/lib/GlobalDataManager';
import { GoogleAuthService } from '@/lib/googleAuth';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Set up deep linking
  useEffect(() => {
    const cleanup = setupDeepLinking();

    return () => {
      cleanup();
    };
  }, []);

  // Configure Google Sign-In
  useEffect(() => {
    GoogleAuthService.configure();
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
          <Stack.Screen name="create-account-email" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="create-account-birthday" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="create-account-gender" options={{ headerShown: false, gestureEnabled: false }} />
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
