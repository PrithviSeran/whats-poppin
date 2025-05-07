import { StyleSheet } from 'react-native';
import CreateAccountGender from '@/components/CreateAccountGender';
import { useLocalSearchParams } from 'expo-router';

export default function CreateAccountGenderRoute() {
  const params = useLocalSearchParams<{ userData: string }>();
  return <CreateAccountGender route={{ 
    key: 'create-account-gender',
    name: 'create-account-gender',
    params 
  }} />;
}

export const unstable_settings = {
  headerShown: false,
}; 