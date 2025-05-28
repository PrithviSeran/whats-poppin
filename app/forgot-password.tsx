import React from 'react';
import { Stack } from 'expo-router';
import ForgotPasswordScreen from '@/components/ForgotPasswordScreen';

export default function ForgotPasswordPage() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <ForgotPasswordScreen />
    </>
  );
} 