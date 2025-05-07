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
import { UserData } from '@/types/user';
import { RouteProp } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const BALLOON_IMAGE = require('../assets/images/balloons.png'); // Place your balloon image in assets/balloons.png

type RootStackParamList = {
  'create-account-password': { userData: string };
};

type CreateAccountGenderRouteProp = RouteProp<{
  'create-account-gender': { userData: Partial<UserData> };
}, 'create-account-gender'>;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const CreateAccountGender = ({ route }: { route?: CreateAccountGenderRouteProp }) => {
  const [selectedGender, setSelectedGender] = useState<'Male' | 'Female' | null>(null);
  const navigation = useNavigation<NavigationProp>();
  const colorScheme = useColorScheme();
  const userData = route?.params?.userData || {};

  const handleNext = () => {
    if (selectedGender) {
      navigation.navigate('create-account-password', {
        userData: JSON.stringify({ ...userData, gender: selectedGender })
      });
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
          <Text style={[styles.titleLarge, { color: Colors[colorScheme ?? 'light'].text }]}>I am a</Text>
          <View style={styles.genderButtonGroup}>
            <TouchableOpacity
              style={[
                styles.genderButton,
                selectedGender === 'Male' && styles.genderButtonSelected,
                { borderColor: '#FF8C00', backgroundColor: selectedGender === 'Male' ? '#FF8C00' : Colors[colorScheme ?? 'light'].background }
              ]}
              onPress={() => setSelectedGender('Male')}
            >
              <Text style={[
                styles.genderButtonText,
                selectedGender === 'Male' && styles.genderButtonTextSelected,
                { color: selectedGender === 'Male' ? 'white' : '#FF8C00' }
              ]}>Male</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.genderButton,
                selectedGender === 'Female' && styles.genderButtonSelected,
                { borderColor: '#FF8C00', backgroundColor: selectedGender === 'Female' ? '#FF8C00' : Colors[colorScheme ?? 'light'].background }
              ]}
              onPress={() => setSelectedGender('Female')}
            >
              <Text style={[
                styles.genderButtonText,
                selectedGender === 'Female' && styles.genderButtonTextSelected,
                { color: selectedGender === 'Female' ? 'white' : '#FF8C00' }
              ]}>Female</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.buttonGroup}>
          <TouchableOpacity 
            onPress={handleNext} 
            disabled={!selectedGender}
          >
            <LinearGradient
              colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              locations={[0, 0.3, 0.7, 1]}
              style={[
                styles.socialButton,
                !selectedGender && styles.disabledButton
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
    borderBottomColor: '#ddd',
    paddingVertical: 8,
    textAlign: 'left',
    marginBottom: 10,
    color: '#222',
  },
  helperText: {
    fontSize: 13,
    color: '#888',
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
  genderButtonGroup: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 10,
    gap: 20,
  },
  genderButton: {
    borderWidth: 2,
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginHorizontal: 10,
    shadowColor: '#FF8C00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  genderButtonSelected: {
    backgroundColor: '#FF8C00',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  genderButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  genderButtonTextSelected: {
    color: 'white',
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
  disabledButton: {
    backgroundColor: '#888',
  },
});

export default CreateAccountGender; 