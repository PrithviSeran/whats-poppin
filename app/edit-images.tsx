import React from 'react';
import { Stack } from 'expo-router';
import EditImages from '@/components/EditImages';

export default function EditImagesScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <EditImages />
    </>
  );
} 