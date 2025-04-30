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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

type RootStackParamList = {
  'social-sign-in': undefined;
  'create-account-email': undefined;
  'create-account-birthday': undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
const { width } = Dimensions.get('window');

const CreateAccount = () => {
  const navigation = useNavigation<NavigationProp>();
  const colorScheme = useColorScheme();
  const [name, setName] = useState('');
  const fadeAnim = useRef(new Animated.Value(1)).current;

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
        <View style={styles.inputSection}>
          <Text
            style={[
              styles.titleLarge,
              { color: Colors[colorScheme ?? 'light'].text },
            ]}
          >
            My name is
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                borderBottomColor: colorScheme === 'dark' ? '#555' : '#ddd',
                color: Colors[colorScheme ?? 'light'].text,
              },
            ]}
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            placeholderTextColor={colorScheme === 'dark' ? '#aaa' : '#bbb'}
            autoCapitalize="words"
          />
          <Text
            style={[
              styles.helperText,
              { color: colorScheme === 'dark' ? '#aaa' : '#888' },
            ]}
          >
            This is how it will appear in the app
          </Text>
        </View>

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            onPress={() => navigation.navigate('create-account-email')}
          >
            <LinearGradient
              colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              locations={[0, 0.3, 0.7, 1]}
              style={styles.nextButton}
            >
              <Text style={styles.nextButtonText}>Next</Text>
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
    justifyContent: 'center',
    paddingTop: 20,
    paddingBottom: 40,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  inputSection: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  titleLarge: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    width: '80%',
    height: 50,
    fontSize: 18,
    borderBottomWidth: 1,
    paddingVertical: 10,
    textAlign: 'center',
  },
  helperText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    width: '80%',
  },
  buttonGroup: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 40,
  },
  nextButton: {
    borderRadius: 30,
    width: width * 0.8,
    paddingVertical: 13,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Gotham Rounded',
  },
});

export default CreateAccount;
