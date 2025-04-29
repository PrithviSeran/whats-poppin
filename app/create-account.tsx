import { StyleSheet } from 'react-native';
import SocialSignInScreen from '@/components/SocialSignInScreen';
import CreateAccount from '@/components/CreateAccount';

export default function CreateAccountRoute() {
  return <CreateAccount />;
}

export const unstable_settings = {
  headerShown: false,
}; 