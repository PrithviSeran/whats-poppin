import React from 'react';
import { Stack } from 'expo-router';
import EditProfile from '@/components/EditProfile';

export default function EditProfileScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <EditProfile />
    </>
  );
} 