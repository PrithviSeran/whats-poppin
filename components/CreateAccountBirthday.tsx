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

const { width } = Dimensions.get('window');

type RootStackParamList = {
    'create-account-gender': undefined;
  };
  
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
const CreateAccountBirthday = () => {
  const [birthday, setBirthday] = useState('');
  const navigation = useNavigation<NavigationProp>();
  const colorScheme = useColorScheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      <View style={styles.centerContent}>
        <View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[styles.titleLarge, { color: Colors[colorScheme ?? 'light'].text }]}>My birthday is</Text>
          <TextInput
            style={[
              styles.input,
              {
                borderBottomColor: colorScheme === 'dark' ? '#555' : '#ddd',
                color: Colors[colorScheme ?? 'light'].text,
              },
            ]}
            value={birthday}
            onChangeText={setBirthday}
            placeholder="MM/DD/YYYY"
            placeholderTextColor={colorScheme === 'dark' ? '#aaa' : '#bbb'}
            keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
            maxLength={10}
          />
          <Text style={[styles.helperText, { color: colorScheme === 'dark' ? '#aaa' : '#888' }]}>
            Your age will be public
          </Text>
        </View>
        <View style={styles.buttonGroup}>
          <TouchableOpacity onPress={() => navigation.navigate('create-account-gender')}>
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

export default CreateAccountBirthday; 