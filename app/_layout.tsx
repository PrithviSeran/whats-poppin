import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-reanimated';
import { View } from 'react-native';

import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import MainLoadingScreen from '@/components/MainLoadingScreen';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Loading states
  const [showMainLoading, setShowMainLoading] = useState(true);
  const [isCheckingAppState, setIsCheckingAppState] = useState(true);
  
  // App state tracking
  const appState = useRef(AppState.currentState);
  const [wasAppClosed, setWasAppClosed] = useState(false);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      checkAppLaunchState();
    }
  }, [loaded]);

  // App state change handler to detect force-close scenarios
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log('App state changed from', appState.current, 'to', nextAppState);
      
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came back to foreground - check if it was force-closed
        checkIfAppWasClosed();
      }
      
      if (nextAppState === 'background') {
        // Mark timestamp when app goes to background
        AsyncStorage.setItem('lastBackgroundTime', Date.now().toString());
      }
      
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  const checkAppLaunchState = async () => {
    try {
      // Check if this is the first time ever launching the app
      const hasLaunchedBefore = await AsyncStorage.getItem('hasLaunchedBefore');
      
      if (!hasLaunchedBefore) {
        // First time launching - show main loading screen
        console.log('First time launch detected');
        await AsyncStorage.setItem('hasLaunchedBefore', 'true');
        setShowMainLoading(true);
        setIsCheckingAppState(false);
        return;
      }

      // Check if app was force-closed
      await checkIfAppWasClosed();
      
    } catch (error) {
      console.error('Error checking app launch state:', error);
      setShowMainLoading(false);
      setIsCheckingAppState(false);
    }
  };

  const checkIfAppWasClosed = async () => {
    try {
      const lastBackgroundTime = await AsyncStorage.getItem('lastBackgroundTime');
      const appSessionId = await AsyncStorage.getItem('currentAppSession');
      
      // Generate a new session ID for this app launch
      const newSessionId = Date.now().toString();
      
      if (lastBackgroundTime && appSessionId) {
        const backgroundTime = parseInt(lastBackgroundTime);
        const timeDiff = Date.now() - backgroundTime;
        
        // If more than 5 minutes passed or session ID is different, likely force-closed
        if (timeDiff > 5 * 60 * 1000) { // 5 minutes
          console.log('App was likely force-closed (time gap:', timeDiff, 'ms)');
          setWasAppClosed(true);
          setShowMainLoading(true);
        } else {
          console.log('App was backgrounded normally');
          setShowMainLoading(false);
        }
      } else {
        // No previous session data - treat as fresh launch
        console.log('No previous session data - treating as fresh launch');
        setShowMainLoading(true);
      }
      
      // Update current session
      await AsyncStorage.setItem('currentAppSession', newSessionId);
      setIsCheckingAppState(false);
      
    } catch (error) {
      console.error('Error checking if app was closed:', error);
      setShowMainLoading(false);
      setIsCheckingAppState(false);
    }
  };

  const handleLoadingComplete = () => {
    setShowMainLoading(false);
    setWasAppClosed(false);
  };

  // Don't render anything until fonts are loaded and we've checked app state
  if (!loaded || isCheckingAppState) {
    return null;
  }

  // Show main loading screen for first launch or after force-close
  if (showMainLoading) {
    return <MainLoadingScreen onLoadingComplete={handleLoadingComplete} />;
  }

  const theme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const backgroundColor = Colors[colorScheme ?? 'light'].background;

  return (
    <ThemeProvider value={theme}>
      <View style={{ flex: 1, backgroundColor }}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{headerShown: false, gestureEnabled: false}} />
          <Stack.Screen name="+not-found" options={{gestureEnabled: false}} />
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
        </Stack>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </View>
    </ThemeProvider>
  );
}
