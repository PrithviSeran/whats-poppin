import { StyleSheet } from 'react-native';
import UserPreferences from '@/components/UserPreferences';
import { useLocalSearchParams } from 'expo-router';

export default function UserPreferencesRoute() {
  const params = useLocalSearchParams<{ userData: string }>();
  return <UserPreferences route={{ 
    key: 'user-preferences',
    name: 'user-preferences',
    params 
  }} />;
}

export const unstable_settings = {
  headerShown: false,
}; 