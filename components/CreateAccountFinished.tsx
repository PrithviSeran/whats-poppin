import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { UserData } from '@/types/user';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');

const BALLOON_IMAGE = require('../assets/images/balloons.png');

type RootStackParamList = {
  'suggested-events': undefined;
};

type CreateAccountFinishedRouteProp = RouteProp<{
  'create-account-finished': { userData: string };
}, 'create-account-finished'>;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function CreateAccountFinished({ route }: { route: CreateAccountFinishedRouteProp }) {
  const colorScheme = useColorScheme();
  const navigation = useNavigation<NavigationProp>();
  const userData = route?.params?.userData ? JSON.parse(route.params.userData) : {};

  async function createUser() {
    const { data, error } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          username: userData.name || undefined,
          gender: userData.gender || undefined,
          birthday: userData.birthday || undefined,
          preferences: userData.preferences || undefined,
        },
      },
    });

    if (error) throw error; 
  }

  useEffect(() => {
    createUser();
  }, []);

  return (
    <View style={styles.container}>
      {/* Large circular gradient background */}
      <LinearGradient
        colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF69B4']}
        style={styles.gradientCircle}
        start={{ x: 0.1, y: 0.1 }}
        end={{ x: 0.9, y: 0.9 }}
      />
      {/* Smaller circle for depth */}
      <LinearGradient
        colors={['#B388EB', '#FF69B4', '#FF6B6B']}
        style={styles.gradientCircleSmall}
        start={{ x: 0.7, y: 0.2 }}
        end={{ x: 0.3, y: 0.8 }}
      />
      <Image
        source={BALLOON_IMAGE}
        style={styles.balloons}
        resizeMode="contain"
      />
      <View style={styles.content}>
        <Text style={[styles.title, { color: Colors[colorScheme ?? 'light'].text }]}>
          You have created your account!
        </Text>
        <Text style={[styles.title, { color: Colors[colorScheme ?? 'light'].text }]}>{userData.name}</Text>
        <TouchableOpacity style={styles.findEventsButton} onPress={() => navigation.navigate('suggested-events')}>
          <Text style={[styles.findEventsText, { color: Colors[colorScheme ?? 'light'].text }]}>
            find events now! <Text style={styles.arrow}>→</Text>
          </Text>

        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FF1493',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientCircle: {
    position: 'absolute',
    width: width * 1.5,
    height: width * 1.5,
    borderRadius: width * 0.75,
    top: -width * 0.25,
    left: -width * 0.25,
    opacity: 0.7,
  },
  gradientCircleSmall: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    bottom: -width * 0.2,
    right: -width * 0.2,
    opacity: 0.5,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 2,
    width: '100%',
    paddingTop: 120,
    marginBottom: 140,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: 30,
    marginBottom: 32,
  },
  findEventsButton: {
    alignItems: 'center',
    marginTop: 0,
  },
  findEventsText: {
    fontSize: 18,
    textDecorationLine: 'underline',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  arrow: {
    fontSize: 20,
    fontWeight: 'bold',
    textDecorationLine: 'none',
  },
  balloons: {
    width: width * 1,
    height: width * .8,
    marginTop: 80,
  },
});
