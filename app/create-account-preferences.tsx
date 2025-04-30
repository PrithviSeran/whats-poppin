import { StyleSheet } from 'react-native';
import CreateAccountPassword from '@/components/CreateAccountPassword';
import UserPreferences from '@/components/UserPreferences';

export default function UserPreferencesRoute() {
  return <UserPreferences />;
}

export const unstable_settings = {
  headerShown: false,
}; 