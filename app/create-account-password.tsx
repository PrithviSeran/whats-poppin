import { StyleSheet } from 'react-native';
import CreateAccountPassword from '@/components/CreateAccountPassword';
import { useLocalSearchParams } from 'expo-router';

export default function CreateAccountPasswordRoute() {
  const params = useLocalSearchParams<{ userData: string }>();
  return <CreateAccountPassword route={{ 
    key: 'create-account-password',
    name: 'create-account-password',
    params 
  }} />;
}

export const unstable_settings = {
  headerShown: false,
}; 