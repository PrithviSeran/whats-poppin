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
import { supabase } from '@/lib/supabase';

type RootStackParamList = {
  'social-sign-in': undefined;
  'reset-password': { email: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

const ForgotPasswordScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const colorScheme = useColorScheme();

  const validateEmail = (text: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!text.trim()) {
      setEmailError('Email is required');
      return false;
    }
    if (!emailRegex.test(text)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleResetPassword = async () => {
    if (!validateEmail(email)) return;

    setIsLoading(true);
    setSuccessMessage('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'whatspoppin://reset-password',
      });

      if (error) {
        setEmailError(error.message);
      } else {
        setSuccessMessage('Password reset instructions have been sent to your email');
        setEmail('');
      }
    } catch (error) {
      setEmailError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>{'←'}</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={[styles.title, { color: Colors[colorScheme ?? 'light'].text }]}>
          Reset Password
        </Text>
        
        <Text style={[styles.subtitle, { color: Colors[colorScheme ?? 'light'].text }]}>
          Enter your email address and we'll send you instructions to reset your password.
        </Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={[
              styles.input,
              {
                borderBottomColor: emailError ? '#FF3B30' : colorScheme === 'dark' ? '#555' : '#ddd',
                color: Colors[colorScheme ?? 'light'].text,
              },
            ]}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              validateEmail(text);
            }}
            placeholder="Enter your email"
            placeholderTextColor={colorScheme === 'dark' ? '#aaa' : '#bbb'}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!isLoading}
          />
          {emailError ? (
            <Text style={styles.errorText}>{emailError}</Text>
          ) : null}
          {successMessage ? (
            <Text style={styles.successText}>{successMessage}</Text>
          ) : null}
        </View>

        <TouchableOpacity
          onPress={handleResetPassword}
          disabled={isLoading || !email.trim() || !!emailError}
        >
          <LinearGradient
            colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            locations={[0, 0.3, 0.7, 1]}
            style={[
              styles.resetButton,
              (isLoading || !email.trim() || !!emailError) && styles.disabledButton,
            ]}
          >
            <Text style={styles.resetButtonText}>
              {isLoading ? 'Sending...' : 'Send Reset Instructions'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 20,
    padding: 8,
  },
  backButtonText: {
    fontSize: 28,
    color: '#FF1493',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    fontSize: 16,
    borderBottomWidth: 2,
    paddingVertical: 8,
    textAlign: 'left',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: 8,
  },
  successText: {
    color: '#34C759',
    fontSize: 14,
    marginTop: 8,
  },
  resetButton: {
    width: width * 0.8,
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  resetButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default ForgotPasswordScreen; 