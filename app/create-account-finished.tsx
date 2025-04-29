import { StyleSheet } from 'react-native';
import SocialSignInScreen from '@/components/SocialSignInScreen';
import CreateAccountEmail from '@/components/CreateAccountEmail';
import CreateAccountFinished from '@/components/CreateAccountFinished';

export default function CreateAccountFinishedRoute() {
    return <CreateAccountFinished />;
}

export const unstable_settings = {
  headerShown: false,
}; 