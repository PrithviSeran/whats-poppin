import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

const { width } = Dimensions.get('window');

interface GoogleSignInButtonProps {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
  style?: any;
  textStyle?: any;
}

const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onSuccess,
  onError,
  style,
  textStyle,
}) => {
  const { signInWithGoogle, isGoogleLoading, googleError } = useGoogleAuth();
  const colorScheme = useColorScheme();

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithGoogle();
      onSuccess?.(result);
    } catch (error) {
      console.error('Google Sign-In failed:', error);
      onError?.(error);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: Colors[colorScheme ?? 'light'].card,
          borderColor: colorScheme === 'dark' ? '#333' : '#E5E5E7',
        },
        style,
      ]}
      onPress={handleGoogleSignIn}
      disabled={isGoogleLoading}
    >
      {isGoogleLoading ? (
        <ActivityIndicator size="small" color="#4285F4" />
      ) : (
        <>
          <Ionicons name="logo-google" size={20} color="#4285F4" style={styles.icon} />
          <Text style={[styles.text, textStyle]}>Continue with Google</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    width: width * 0.8,
    paddingVertical: 13,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  icon: {
    marginRight: 12,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4285F4',
    fontFamily: 'Gotham Rounded',
  },
});

export default GoogleSignInButton;