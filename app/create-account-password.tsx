import { StyleSheet } from 'react-native';
import CreateAccountPassword from '@/components/CreateAccountPassword';
import { useLocalSearchParams } from 'expo-router';
import { UserData } from '@/types/user';
import { RouteProp } from '@react-navigation/native';

type CreateAccountPasswordRouteProp = RouteProp<{
  'create-account-password': { userData: Partial<UserData> };
}, 'create-account-password'>;

export default function CreateAccountPasswordRoute() {
  const params = useLocalSearchParams<{ userData: string }>();
  const userData = params.userData ? JSON.parse(params.userData) : {};
  const route: CreateAccountPasswordRouteProp = {
    key: 'create-account-password',
    name: 'create-account-password',
    params: { userData }
  };
  return <CreateAccountPassword route={route} />;
}

export const unstable_settings = {
  headerShown: false,
}; 