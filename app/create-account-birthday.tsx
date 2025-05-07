import { StyleSheet } from 'react-native';
import CreateAccountBirthday from '@/components/CreateAccountBirthday';
import { useLocalSearchParams } from 'expo-router';

export default function CreateAccountBirthdayRoute() {
  const params = useLocalSearchParams<{ userData: string }>();
  return <CreateAccountBirthday route={{ 
    key: 'create-account-birthday',
    name: 'create-account-birthday',
    params 
  }} />;
}

export const unstable_settings = {
  headerShown: false,
}; 