import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  Platform,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import MaskedView from '@react-native-masked-view/masked-view';

const { width } = Dimensions.get('window');
const BALLOON_IMAGE = require('../assets/images/balloons.png');

type RootStackParamList = {
  'create-account-password': { userData: string };
};

type CreateAccountGenderRouteProp = RouteProp<{
  'create-account-gender': { userData: string };
}, 'create-account-gender'>;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const CreateAccountGender = ({ route }: { route: CreateAccountGenderRouteProp }) => {
  const [selectedGender, setSelectedGender] = useState<'Male' | 'Female' | null>(null);
  const navigation = useNavigation<NavigationProp>();
  const colorScheme = useColorScheme();
  const userData = route?.params?.userData ? JSON.parse(route.params.userData) : {};

  const handleNext = () => {
    if (selectedGender) {
      navigation.navigate('create-account-password', {
        userData: JSON.stringify({ ...userData, gender: selectedGender }),
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
        <Text style={{ fontSize: 28, color: '#FF0005' }}>{'←'}</Text>
      </TouchableOpacity>

      <View style={styles.centerContent}>
        <View style={styles.headerContainer}>
          <View style={styles.headerRow}>
            <Image
              source={BALLOON_IMAGE}
              style={styles.balloons}
              resizeMode="contain"
            />
            <MaskedView
              maskElement={
                <Text style={[styles.title, { opacity: 1 }]}>{`What's Poppin?`}</Text>
              }
            >
              <LinearGradient
                colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                locations={[0, 0.3, 0.7, 1]}
              >
                <Text style={[styles.title, { opacity: 0 }]}>{`What's Poppin?`}</Text>
              </LinearGradient>
            </MaskedView>
          </View>
        </View>

        <View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[styles.titleLarge, { color: Colors[colorScheme ?? 'light'].text }]}>I am a</Text>
          <View style={styles.genderButtonGroup}>
            <TouchableOpacity
              style={[
                styles.genderButton,
                selectedGender === 'Male' && styles.genderButtonSelected,
                {
                  borderColor: '#FF0005',
                  backgroundColor: selectedGender === 'Male'
                    ? '#FF0005'
                    : Colors[colorScheme ?? 'light'].background,
                },
              ]}
              onPress={() => setSelectedGender('Male')}
            >
              <Text style={[
                styles.genderButtonText,
                selectedGender === 'Male' && styles.genderButtonTextSelected,
                { color: selectedGender === 'Male' ? 'white' : '#FF0005' },
              ]}>Male</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.genderButton,
                selectedGender === 'Female' && styles.genderButtonSelected,
                {
                  borderColor: '#FF0005',
                  backgroundColor: selectedGender === 'Female'
                    ? '#FF0005'
                    : Colors[colorScheme ?? 'light'].background,
                },
              ]}
              onPress={() => setSelectedGender('Female')}
            >
              <Text style={[
                styles.genderButtonText,
                selectedGender === 'Female' && styles.genderButtonTextSelected,
                { color: selectedGender === 'Female' ? 'white' : '#FF0005' },
              ]}>Female</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.buttonGroup}>
          <TouchableOpacity onPress={handleNext} disabled={!selectedGender}>
            <LinearGradient
              colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              locations={[0, 0.3, 0.7, 1]}
              style={styles.socialButton}
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
    shadowColor: '#FF0005',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  genderButtonSelected: {
    backgroundColor: '#FF0005',
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
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balloons: {
    width: width * 0.22,
    height: width * 0.22,
    marginRight: -6,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#F45B5B',
    textAlign: 'left',
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 4, height: 4 },
    textShadowRadius: 6,
    fontFamily: Platform.OS === 'ios' ? 'MarkerFelt-Wide' : 'sans-serif-condensed',
  },
});

export default CreateAccountGender;
