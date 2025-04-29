import { StyleSheet } from 'react-native';
import SocialSignInScreen from '@/components/SocialSignInScreen';
import CreateAccountEmail from '@/components/CreateAccountEmail';

export default function CreateAccountEmailRoute() {
  return <CreateAccountEmail />;
}

export const unstable_settings = {
  headerShown: false,
}; 