import { StyleSheet } from 'react-native';
import CreateAccountEmail from '@/components/CreateAccountEmail';
import { useLocalSearchParams } from 'expo-router';

export default function CreateAccountEmailRoute() {
  const params = useLocalSearchParams<{ userData: string }>();
  return <CreateAccountEmail route={{ 
    key: 'create-account-email',
    name: 'create-account-email',
    params 
  }} />;
}

export const unstable_settings = {
  headerShown: false,
}; 