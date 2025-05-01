import SavedLikes from '@/components/SavedLikes';
import { Stack } from 'expo-router';

export default function SavedLikesPage() {
  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: false,
        }}
      />
      <SavedLikes />
    </>
  );
} 