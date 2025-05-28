import React from 'react';
import { Stack } from 'expo-router';
import ResetPasswordScreen from '@/components/ResetPasswordScreen';

export default function ResetPasswordPage() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <ResetPasswordScreen />
    </>
  );
} 