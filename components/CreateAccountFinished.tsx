import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { UserData } from '@/types/user';
import { Amplify } from 'aws-amplify';
import { signUp } from 'aws-amplify/auth';

const { width } = Dimensions.get('window');

const BALLOON_IMAGE = require('../assets/images/balloons.png');

type RootStackParamList = {
    'suggested-events': undefined;
};
  
type CreateAccountFinishedRouteProp = RouteProp<{
  'create-account-finished': { userData: UserData };
}, 'create-account-finished'>;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function CreateAccountFinished({ route }: { route: CreateAccountFinishedRouteProp }) {
  const colorScheme = useColorScheme();
  const navigation = useNavigation<NavigationProp>();
  const { userData } = route.params;

  async function signUpAWS() {
    try {
      const { userId } = await signUp({
        username: userData.email,
        password: userData.password,
        
      });
      console.log('Sign up successful!', userId);
    } catch (error) {
      console.log('Error signing up:', error);
    }
  }

  useEffect(() => {
    if (userData) {
      signUpAWS();
    }
  }, [userData]);

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
          Welcome, {userData.name}!
        </Text>
        <Text style={[styles.subtitle, { color: Colors[colorScheme ?? 'light'].text }]}>
          Your account has been created successfully.
        </Text>
        <View style={styles.userInfo}>
          <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text }]}>
            Email: {userData.email}
          </Text>
          <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text }]}>
            Birthday: {userData.birthday}
          </Text>
          <Text style={[styles.infoText, { color: Colors[colorScheme ?? 'light'].text }]}>
            Gender: {userData.gender}
          </Text>
        </View>
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
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  userInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
    borderRadius: 15,
    marginBottom: 30,
    width: '80%',
  },
  infoText: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
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
