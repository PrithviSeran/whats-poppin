import { StyleSheet } from 'react-native';
import CreateAccountFinished from '@/components/CreateAccountFinished';
import { useLocalSearchParams } from 'expo-router';
import { UserData } from '@/types/user';
import { RouteProp } from '@react-navigation/native';

type CreateAccountFinishedRouteProp = RouteProp<{
  'create-account-finished': { userData: UserData };
}, 'create-account-finished'>;

export default function CreateAccountFinishedRoute() {
  const params = useLocalSearchParams<{ userData: string }>();
  const userData = params.userData ? JSON.parse(params.userData) : {};
  const route: CreateAccountFinishedRouteProp = {
    key: 'create-account-finished',
    name: 'create-account-finished',
    params: { userData }
  };
  return <CreateAccountFinished route={route} />;
}

export const unstable_settings = {
  headerShown: false,
}; 