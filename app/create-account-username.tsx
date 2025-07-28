import CreateAccountUsername from '@/components/CreateAccountUsername';
import { useLocalSearchParams } from 'expo-router';

export default function CreateAccountUsernameRoute() {
  const params = useLocalSearchParams<{ userData: string }>();
  return <CreateAccountUsername route={{ 
    key: 'create-account-username',
    name: 'create-account-username',
    params 
  }} />;
}

export const unstable_settings = {
  headerShown: false,
}; 