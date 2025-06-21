import { Stack } from 'expo-router';
import CreateEventScreen from '../components/CreateEventScreen';

export default function CreateEvent() {
  return (
    <>
      <Stack.Screen 
        name="create-event" 
        options={{ 
          headerShown: false,
          presentation: 'modal',
          gestureEnabled: true 
        }} 
      />
      <CreateEventScreen />
    </>
  );
} 