import { useColorScheme as useRNColorScheme } from 'react-native';
import { Platform } from 'react-native';

export function useColorScheme() {
  const systemColorScheme = useRNColorScheme();
  
  // For native platforms, return the system color scheme directly
  if (Platform.OS !== 'web') {
    return systemColorScheme ?? 'light';
  }

  // For web, we'll use the web-specific implementation
  return systemColorScheme ?? 'light';
}
