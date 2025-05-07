import { StyleSheet } from 'react-native';
import CreateAccountGender from '@/components/CreateAccountGender';
import { useLocalSearchParams } from 'expo-router';
import { UserData } from '@/types/user';
import { RouteProp } from '@react-navigation/native';

type CreateAccountGenderRouteProp = RouteProp<{
  'create-account-gender': { userData: Partial<UserData> };
}, 'create-account-gender'>;

export default function CreateAccountGenderRoute() {
  const params = useLocalSearchParams<{ userData: string }>();
  const userData = params.userData ? JSON.parse(params.userData) : {};
  const route: CreateAccountGenderRouteProp = {
    key: 'create-account-gender',
    name: 'create-account-gender',
    params: { userData }
  };
  return <CreateAccountGender route={route} />;
}

export const unstable_settings = {
  headerShown: false,
}; 