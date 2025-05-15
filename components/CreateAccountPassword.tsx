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
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import MaskedView from '@react-native-masked-view/masked-view';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const BALLOON_IMAGE = require('../assets/images/balloons.png');

type RootStackParamList = {
  'create-account-location': { userData: string };
};

type CreateAccountPasswordRouteProp = RouteProp<{
  'create-account-password': { userData: string };
}, 'create-account-password'>;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const CreateAccountPassword = ({ route }: { route: CreateAccountPasswordRouteProp }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation<NavigationProp>();
  const colorScheme = useColorScheme();
  const userData = route?.params?.userData ? JSON.parse(route.params.userData) : {};

  const checkPasswordRequirements = (text: string) => ({
    length: text.length >= 8,
    uppercase: /[A-Z]/.test(text),
    lowercase: /[a-z]/.test(text),
    number: /[0-9]/.test(text),
    special: /[!@#$%^&*]/.test(text),
  });

  const validatePassword = (text: string) => {
    const requirements = checkPasswordRequirements(text);
    if (!text.trim()) return setPasswordError('Password is required'), false;
    if (!requirements.length) return setPasswordError('At least 8 characters'), false;
    if (!requirements.uppercase) return setPasswordError('One uppercase letter required'), false;
    if (!requirements.lowercase) return setPasswordError('One lowercase letter required'), false;
    if (!requirements.number) return setPasswordError('One number required'), false;
    if (!requirements.special) return setPasswordError('One special character required'), false;
    setPasswordError('');
    return true;
  };

  const validateConfirmPassword = (text: string) => {
    if (!text.trim()) return setConfirmPasswordError('Please confirm your password'), false;
    if (text !== password) return setConfirmPasswordError('Passwords do not match'), false;
    setConfirmPasswordError('');
    return true;
  };

  const handleNext = () => {
    const valid = validatePassword(password) && validateConfirmPassword(confirmPassword);
    if (valid) {
      navigation.navigate('create-account-location', {
        userData: JSON.stringify({ ...userData, password }),
      });
    }
  };

  const requirements = checkPasswordRequirements(password);

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
                colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
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
          <Text style={[styles.titleLarge, { color: Colors[colorScheme ?? 'light'].text }]}>Set your password</Text>

          <TextInput
            style={[
              styles.input,
              {
                borderBottomColor: passwordError ? '#FF3B30' : colorScheme === 'dark' ? '#555' : '#ddd',
                color: Colors[colorScheme ?? 'light'].text,
              },
            ]}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              validatePassword(text);
              if (confirmPassword) validateConfirmPassword(confirmPassword);
            }}
            placeholder="Enter your password"
            placeholderTextColor={colorScheme === 'dark' ? '#aaa' : '#bbb'}
            autoCapitalize="none"
            secureTextEntry
          />
          {passwordError ? (
            <Text style={styles.errorText}>{passwordError}</Text>
          ) : (
            <View style={styles.requirementsContainer}>
              <Text style={[styles.helperText, { color: colorScheme === 'dark' ? '#aaa' : '#888' }]}>
                Password requirements:
              </Text>
              {[
                { key: 'length', label: 'At least 8 characters' },
                { key: 'uppercase', label: 'One uppercase letter' },
                { key: 'lowercase', label: 'One lowercase letter' },
                { key: 'number', label: 'One number' },
                { key: 'special', label: 'One special character (!@#$%^&*)' },
              ].map(({ key, label }) => (
                <View key={key} style={styles.requirementRow}>
                  <Text
                    style={[
                      styles.requirementText,
                      requirements[key as keyof typeof requirements] && styles.requirementMet,
                    ]}
                  >
                    {requirements[key as keyof typeof requirements] ? '✓' : '○'} {label}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <TextInput
            style={[
              styles.input,
              {
                borderBottomColor: confirmPasswordError ? '#FF3B30' : colorScheme === 'dark' ? '#555' : '#ddd',
                color: Colors[colorScheme ?? 'light'].text,
              },
            ]}
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              validateConfirmPassword(text);
            }}
            placeholder="Confirm your password"
            placeholderTextColor={colorScheme === 'dark' ? '#aaa' : '#bbb'}
            autoCapitalize="none"
            secureTextEntry
          />
          {confirmPasswordError && (
            <Text style={styles.errorText}>{confirmPasswordError}</Text>
          )}
        </View>

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            onPress={handleNext}
            disabled={
              !password.trim() ||
              !confirmPassword.trim() ||
              !!passwordError ||
              !!confirmPasswordError
            }
          >
            <LinearGradient
              colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              locations={[0, 0.3, 0.7, 1]}
              style={[
                styles.socialButton,
                (!password.trim() || !confirmPassword.trim() || !!passwordError || !!confirmPasswordError) &&
                  styles.disabledButton,
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
  requirementsContainer: {
    width: '80%',
    marginTop: 10,
    marginBottom: 20,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  requirementText: {
    fontSize: 14,
    color: '#888',
    marginLeft: 4,
  },
  requirementMet: {
    color: '#34C759',
  },
});

export default CreateAccountPassword;