import React from 'react';
import { Stack } from 'expo-router';
import Discover from '@/components/Discover';

export default function ExplorePage() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <Discover />
    </>
  );
} 