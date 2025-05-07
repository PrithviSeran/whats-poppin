import { StyleSheet } from 'react-native';
import CreateAccountEmail from '@/components/CreateAccountEmail';
import { useLocalSearchParams } from 'expo-router';
import { UserData } from '@/types/user';
import { RouteProp } from '@react-navigation/native';

type CreateAccountEmailRouteProp = RouteProp<{
  'create-account-email': { userData: Partial<UserData> };
}, 'create-account-email'>;

export default function CreateAccountEmailRoute() {
  const params = useLocalSearchParams<{ userData: string }>();
  const userData = params.userData ? JSON.parse(params.userData) : {};
  const route: CreateAccountEmailRouteProp = {
    key: 'create-account-email',
    name: 'create-account-email',
    params: { userData }
  };
  return <CreateAccountEmail route={route} />;
}

export const unstable_settings = {
  headerShown: false,
}; 