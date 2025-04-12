import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import WelcomeScreen from '../screens/WelcomeScreen';
import EventTypeScreen from '../screens/EventTypeScreen';
import RestaurantQuestionsScreen from '../screens/RestaurantQuestionsScreen';
import ClubQuestionsScreen from '../screens/ClubQuestionsScreen';
import BarQuestionsScreen from '../screens/BarQuestionsScreen';
import PartyQuestionsScreen from '../screens/PartyQuestionsScreen';
import SportsQuestionsScreen from '../screens/SportsQuestionsScreen';
import OtherQuestionsScreen from '../screens/OtherQuestionsScreen';
import ResultsScreen from '../screens/ResultsScreen';
import EventDetailScreen from '../screens/EventDetailScreen';

export type RootStackParamList = {
  Welcome: undefined;
  EventType: undefined;
  RestaurantQuestions: undefined;
  ClubQuestions: undefined;
  BarQuestions: undefined;
  PartyQuestions: undefined;
  SportsQuestions: undefined;
  OtherQuestions: undefined;
  Results: { preferences: any };
  EventDetail: { eventId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function Navigation() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Welcome"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: '#f8f9fa' }
        }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="EventType" component={EventTypeScreen} />
        <Stack.Screen name="RestaurantQuestions" component={RestaurantQuestionsScreen} />
        <Stack.Screen name="ClubQuestions" component={ClubQuestionsScreen} />
        <Stack.Screen name="BarQuestions" component={BarQuestionsScreen} />
        <Stack.Screen name="PartyQuestions" component={PartyQuestionsScreen} />
        <Stack.Screen name="SportsQuestions" component={SportsQuestionsScreen} />
        <Stack.Screen name="OtherQuestions" component={OtherQuestionsScreen} />
        <Stack.Screen name="Results" component={ResultsScreen} />
        <Stack.Screen name="EventDetail" component={EventDetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}