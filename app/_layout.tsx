import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { View } from 'react-native';

import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

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

  if (!loaded) {
    return null;
  }

  const theme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const backgroundColor = Colors[colorScheme ?? 'light'].background;

  return (
    <ThemeProvider value={theme}>
      <View style={{ flex: 1, backgroundColor }}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{headerShown: false}} />
          <Stack.Screen name="+not-found" />
          <Stack.Screen name="social-sign-in" options={{ headerShown: false }} />
          <Stack.Screen name="create-account" options={{ headerShown: false }} />
          <Stack.Screen name="create-account-email" options={{ headerShown: false }} />
          <Stack.Screen name="create-account-birthday" options={{ headerShown: false }} />
          <Stack.Screen name="create-account-gender" options={{ headerShown: false }} />
          <Stack.Screen name="create-account-password" options={{ headerShown: false }} />
          <Stack.Screen name="create-account-preferences" options={{ headerShown: false }} />
          <Stack.Screen name="create-account-finished" options={{ headerShown: false }} />
          <Stack.Screen name="suggested-events" options={{ headerShown: false }} />


        </Stack>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </View>
    </ThemeProvider>
  );
}
