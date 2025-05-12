import { StyleSheet } from 'react-native';
import CreateAccountFinished from '@/components/CreateAccountFinished';
import { useLocalSearchParams } from 'expo-router';

export default function CreateAccountFinishedRoute() {
  const params = useLocalSearchParams<{ userData: string }>();
  return <CreateAccountFinished route={{ 
    key: 'create-account-finished',
    name: 'create-account-finished',
    params 
  }} />;
}

export const unstable_settings = {
  headerShown: false,
}; 