import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  Dimensions,
  Platform,
} from 'react-native';

const { width } = Dimensions.get('window');

const BALLOON_IMAGE = require('../assets/images/balloons.png'); // Place your balloon image in assets/balloons.png

const SignInScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centerContent}>
        <Image
          source={BALLOON_IMAGE}
          style={styles.balloons}
          resizeMode="contain"
        />
        <Text style={styles.title}>{`What's\nPoppin`}</Text>
        <TouchableOpacity style={styles.loginButton}>
          <Text style={styles.loginButtonText}>Log In</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.signupButton}>
          <Text style={styles.signupButtonText}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8D6CB', // Peach background
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  balloons: {
    width: width * 0.45,
    height: width * 0.35,
    marginBottom: 24,
    marginTop: 24,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 4, height: 4 },
    textShadowRadius: 6,
    marginBottom: 48,
    fontFamily: Platform.OS === 'ios' ? 'MarkerFelt-Wide' : 'sans-serif-condensed', // Playful font
  },
  loginButton: {
    backgroundColor: '#F7B693', // Peach button
    borderRadius: 30,
    width: width * 0.8,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'MarkerFelt-Wide' : 'sans-serif-condensed',
  },
  signupButton: {
    backgroundColor: '#F45B5B', // Red button
    borderRadius: 30,
    width: width * 0.8,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  signupButtonText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'MarkerFelt-Wide' : 'sans-serif-condensed',
  },
});

export default SignInScreen; 