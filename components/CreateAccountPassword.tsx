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
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

const { width } = Dimensions.get('window');

type RootStackParamList = {
    'create-account-finished': undefined;
  };
  
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const CreateAccountPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigation = useNavigation<NavigationProp>();
  const colorScheme = useColorScheme();

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
        <View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[styles.titleLarge, { color: Colors[colorScheme ?? 'light'].text }]}>Set your password</Text>
          <TextInput
            style={[
              styles.input,
              {
                borderBottomColor: colorScheme === 'dark' ? '#555' : '#ddd',
                color: Colors[colorScheme ?? 'light'].text,
              },
            ]}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            placeholderTextColor={colorScheme === 'dark' ? '#aaa' : '#bbb'}
            autoCapitalize="none"
            secureTextEntry
          />
          <TextInput
            style={[
              styles.input,
              {
                borderBottomColor: colorScheme === 'dark' ? '#555' : '#ddd',
                color: Colors[colorScheme ?? 'light'].text,
              },
            ]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm your password"
            placeholderTextColor={colorScheme === 'dark' ? '#aaa' : '#bbb'}
            autoCapitalize="none"
            secureTextEntry
          />
          <Text style={[styles.helperText, { color: colorScheme === 'dark' ? '#aaa' : '#888' }]}>
            Please enter your password and confirm it.
          </Text>
        </View>
        <View style={styles.buttonGroup}>
          <TouchableOpacity onPress={() => navigation.navigate('create-account-finished')}>
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
});

export default CreateAccountPassword; 