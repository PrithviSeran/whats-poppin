import { StyleSheet } from 'react-native';
import SocialSignInScreen from '@/components/SocialSignInScreen';
import CreateAccountBirthday from '@/components/CreateAccountBirthday';

export default function CreateAccountBirthdayRoute() {
  return <CreateAccountBirthday />;
}

export const unstable_settings = {
  headerShown: false,
}; 