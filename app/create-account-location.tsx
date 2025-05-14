
import CreateAccountLocation from '@/components/CreateAccountLocation';
import { useLocalSearchParams } from 'expo-router';

export default function CreateAccountLocationRoute() {
  const params = useLocalSearchParams<{ userData: string }>();

  return <CreateAccountLocation route={{ 
    key: 'create-account-location',
    name: 'create-account-location',
    params 
  }} />;
}

export const unstable_settings = {
  headerShown: false,
}; 