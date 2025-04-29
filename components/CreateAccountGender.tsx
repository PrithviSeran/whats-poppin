import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const { width } = Dimensions.get('window');

type RootStackParamList = {
    'create-account-password': undefined;
  };
  
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const CreateAccountGender = () => {
  const [selectedGender, setSelectedGender] = useState<'Male' | 'Female' | null>(null);
  const navigation = useNavigation<NavigationProp>();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centerContent}>
        <View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={styles.titleLarge}>I am a</Text>
          <View style={styles.genderButtonGroup}>
            <TouchableOpacity
              style={[styles.genderButton, selectedGender === 'Male' && styles.genderButtonSelected]}
              onPress={() => setSelectedGender('Male')}
            >
              <Text style={[styles.genderButtonText, selectedGender === 'Male' && styles.genderButtonTextSelected]}>Male</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.genderButton, selectedGender === 'Female' && styles.genderButtonSelected]}
              onPress={() => setSelectedGender('Female')}
            >
              <Text style={[styles.genderButtonText, selectedGender === 'Female' && styles.genderButtonTextSelected]}>Female</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.buttonGroup}>
          <TouchableOpacity onPress={() => navigation.navigate('create-account-password')} disabled={!selectedGender}>
            <LinearGradient
              colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              locations={[0, 0.3, 0.7, 1]}
              style={styles.socialButton}
            >
              <Text style={styles.socialButtonText}>CONTINUE</Text>
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
    backgroundColor: 'white',
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
    color: '#222',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
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
    fontFamily: 'Gotham Rounded',
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
    borderColor: '#FF6B6B',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginHorizontal: 10,
    backgroundColor: 'white',
  },
  genderButtonSelected: {
    backgroundColor: '#FF6B6B',
  },
  genderButtonText: {
    color: '#FF6B6B',
    fontSize: 18,
    fontWeight: 'bold',
  },
  genderButtonTextSelected: {
    color: 'white',
  },
});

export default CreateAccountGender; 