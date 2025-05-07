import { StyleSheet } from 'react-native';
import CreateAccountBirthday from '@/components/CreateAccountBirthday';
import { useLocalSearchParams } from 'expo-router';
import { UserData } from '@/types/user';
import { RouteProp } from '@react-navigation/native';

type CreateAccountBirthdayRouteProp = RouteProp<{
  'create-account-birthday': { userData: Partial<UserData> };
}, 'create-account-birthday'>;

export default function CreateAccountBirthdayRoute() {
  const params = useLocalSearchParams<{ userData: string }>();
  const userData = params.userData ? JSON.parse(params.userData) : {};
  const route: CreateAccountBirthdayRouteProp = {
    key: 'create-account-birthday',
    name: 'create-account-birthday',
    params: { userData }
  };
  return <CreateAccountBirthday route={route} />;
}

export const unstable_settings = {
  headerShown: false,
}; 