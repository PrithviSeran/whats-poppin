import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { Image } from 'react-native';
const { width } = Dimensions.get('window');

const BALLOON_IMAGE = require('../assets/images/balloons.png'); // Place your balloon image in assets/balloons.png


type RootStackParamList = {
    'create-account-gender': undefined;
  };
  
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
const CreateAccountBirthday = () => {
  const [birthday, setBirthday] = useState('');
  const [birthdayError, setBirthdayError] = useState('');
  const navigation = useNavigation<NavigationProp>();
  const colorScheme = useColorScheme();

  const validateBirthday = (text: string) => {
    const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;
    if (!text.trim()) {
      setBirthdayError('Birthday is required');
      return false;
    }
    if (!dateRegex.test(text)) {
      setBirthdayError('Please enter a valid date (MM/DD/YYYY)');
      return false;
    }
    
    const [month, day, year] = text.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    const today = new Date();
    const age = today.getFullYear() - date.getFullYear();
    
    if (age < 13) {
      setBirthdayError('You must be at least 13 years old');
      return false;
    }
    
    if (age > 100) {
      setBirthdayError('Please enter a valid age');
      return false;
    }

    setBirthdayError('');
    return true;
  };

  const handleNext = () => {
    if (validateBirthday(birthday)) {
      navigation.navigate('create-account-gender');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
        <TouchableOpacity
            style={{
            position: 'absolute',
            top: 50,
            left: 20,
            zIndex: 10,
            backgroundColor: 'rgba(0,0,0,0.1)',
            borderRadius: 20,
            padding: 8,
            }}
            onPress={() => navigation.goBack()}
        >
        <Text style={{ fontSize: 28, color: '#FF1493' }}>{'←'}</Text>
      </TouchableOpacity>
      <View style={styles.centerContent}>
      <View style={styles.headerContainer}>
          <Image
            source={BALLOON_IMAGE}
            style={styles.balloons}
            resizeMode="contain"
          />
          <Text style={styles.title}>{`What's Poppin?`}</Text>
        </View>
        <View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[styles.titleLarge, { color: Colors[colorScheme ?? 'light'].text }]}>My birthday is</Text>
          <TextInput
            style={[
              styles.input,
              {
                borderBottomColor: birthdayError ? '#FF3B30' : colorScheme === 'dark' ? '#555' : '#ddd',
                color: Colors[colorScheme ?? 'light'].text,
              },
            ]}
            value={birthday}
            onChangeText={(text) => {
              setBirthday(text);
              validateBirthday(text);
            }}
            placeholder="MM/DD/YYYY"
            placeholderTextColor={colorScheme === 'dark' ? '#aaa' : '#bbb'}
            keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
            maxLength={10}
          />
          {birthdayError ? (
            <Text style={styles.errorText}>{birthdayError}</Text>
          ) : (
            <Text style={[styles.helperText, { color: colorScheme === 'dark' ? '#aaa' : '#888' }]}>
              Your age will be public
            </Text>
          )}
        </View>
        <View style={styles.buttonGroup}>
          <TouchableOpacity 
            onPress={handleNext}
            disabled={!birthday.trim() || !!birthdayError}
          >
            <LinearGradient
              colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              locations={[0, 0.3, 0.7, 1]}
              style={[
                styles.socialButton,
                (!birthday.trim() || !!birthdayError) && styles.disabledButton
              ]}
            >
              <Text style={styles.socialButtonText}>Next</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingBottom: 40,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  titleLarge: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    marginTop: 40,
  },
  input: {
    width: '80%',
    fontSize: 22,
    borderBottomWidth: 2,
    paddingVertical: 8,
    textAlign: 'left',
    marginBottom: 10,
  },
  helperText: {
    fontSize: 13,
    marginTop: 2,
    marginBottom: 10,
    textAlign: 'left',
    width: '80%',
  },
  buttonGroup: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  socialButton: {
    borderRadius: 30,
    width: width * 0.8,
    paddingVertical: 13,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  socialButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    width: '100%',
    paddingRight: 50,
  },
  balloons: {
    width: width * 0.4,
    height: width * 0.2,
  },
  title: {
    fontSize: 25,
    fontWeight: 'bold',
    color: '#F45B5B',
    textAlign: 'left',
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 4, height: 4 },
    textShadowRadius: 6,
    marginLeft: -50,
    fontFamily: Platform.OS === 'ios' ? 'MarkerFelt-Wide' : 'sans-serif-condensed',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    width: '80%',
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default CreateAccountBirthday; 