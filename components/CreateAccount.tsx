import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Dimensions,
  Platform,
  Animated,
  Image,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import 'react-native-url-polyfill/auto';
import MaskedView from '@react-native-masked-view/masked-view';
import CreateAccountProgressBar from './CreateAccountProgressBar';

type RootStackParamList = {
  'social-sign-in': undefined;
  'create-account-email': { userData: string };
  'create-account': { userData: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
const { width } = Dimensions.get('window');

const LOGO_IMAGE_LIGHT = require('../assets/images/logo-light.png');
const LOGO_IMAGE_DARK = require('../assets/images/logo.png');

const CreateAccount = () => {
  const navigation = useNavigation<NavigationProp>();
  const colorScheme = useColorScheme();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const inputScaleAnim = useRef(new Animated.Value(1)).current;

  const validateName = (text: string) => {
    if (text.trim().length < 2) {
      setNameError('Name must be at least 2 characters long');
      return false;
    }
    setNameError('');
    return true;
  };

  const handleNext = () => {
    if (validateName(name)) {
      const userDataToSend = { name };
      console.log('CreateAccount - name value:', name);
      console.log('CreateAccount - userDataToSend:', userDataToSend);
      console.log('CreateAccount - stringified userData:', JSON.stringify(userDataToSend));

      navigation.navigate('create-account-email', {
        userData: JSON.stringify(userDataToSend),
      });
    }
  };

  const handleInputFocus = () => {
    setIsFocused(true);
    Animated.spring(inputScaleAnim, {
      toValue: 1.02,
      useNativeDriver: true,
    }).start();
  };

  const handleInputBlur = () => {
    setIsFocused(false);
    Animated.spring(inputScaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: Colors[colorScheme ?? 'light'].background },
      ]}
    >
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="chevron-back" size={28} color="#9E95BD" />
      </TouchableOpacity>

      <CreateAccountProgressBar
        currentStep={1}
        totalSteps={6}
        stepLabels={['Name', 'Email', 'Birthday', 'Gender', 'Password', 'Location']}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerContainer}>
            <View style={styles.headerRow}>
              <Image
                source={colorScheme === 'dark' ? LOGO_IMAGE_DARK : LOGO_IMAGE_LIGHT}
                style={colorScheme === 'dark' ? styles.logo : styles.logoLight}
                resizeMode="contain"
              />
            </View>
          </View>

          <View style={styles.contentContainer}>
            <View style={styles.titleContainer}>
              <Text
                style={[
                  styles.titleLarge,
                  { color: Colors[colorScheme ?? 'light'].text },
                ]}
              >
                What's your name?
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { color: Colors[colorScheme ?? 'light'].text },
                ]}
              >
                This is how you'll appear to others
              </Text>
            </View>

            <Animated.View 
              style={[
                styles.inputContainer,
                { transform: [{ scale: inputScaleAnim }] }
              ]}
            >
              <View style={[
                styles.inputWrapper,
                {
                  backgroundColor: Colors[colorScheme ?? 'light'].card,
                  borderColor: nameError 
                    ? '#FF3B30' 
                    : isFocused 
                      ? '#9E95BD' 
                      : colorScheme === 'dark' ? '#333' : '#E5E5E7',
                  shadowColor: isFocused ? '#9E95BD' : '#000',
                  shadowOpacity: isFocused ? 0.2 : 0.1,
                }
              ]}>
                <Ionicons 
                  name="person-outline" 
                  size={22} 
                  color={isFocused ? '#9E95BD' : Colors[colorScheme ?? 'light'].icon} 
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[
                    styles.input,
                    { color: Colors[colorScheme ?? 'light'].text },
                  ]}
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    validateName(text);
                  }}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  placeholder="Enter your full name"
                  placeholderTextColor={colorScheme === 'dark' ? '#666' : '#999'}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={handleNext}
                />
              </View>
              {nameError ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color="#FF3B30" />
                  <Text style={styles.errorText}>{nameError}</Text>
                </View>
              ) : null}
            </Animated.View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={handleNext}
              disabled={!name.trim() || !!nameError}
              style={styles.buttonWrapper}
            >
              <LinearGradient
                colors={['#FF0005', '#FF4D9D', '#FF69E2', '#B97AFF', '#9E95BD']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                locations={[0, 0.25, 0.5, 0.75, 1]}
                style={[
                  styles.nextButton,
                  (!name.trim() || !!nameError) && styles.disabledButton,
                ]}
              >
                <Text style={styles.nextButtonText}>Continue</Text>
                <Ionicons name="chevron-forward" size={20} color="white" style={styles.buttonIcon} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(158, 149, 189, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: width * 0.7,
    height: width * 0.4,
  },
  logoLight: {
    width: width * 0.5,
    height: width * 0.27,
    marginTop: 10,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 300,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  titleLarge: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
    fontWeight: '400',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
    paddingVertical: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginLeft: 6,
    fontWeight: '500',
  },
  buttonContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  buttonWrapper: {
    width: '100%',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  buttonIcon: {
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default CreateAccount;
