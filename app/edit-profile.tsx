import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '@/lib/supabase';

interface UserProfile {
  id: number;
  created_at: string;
  name: string;
  email: string;
  birthday: string;
  gender: string;
  saved_events?: string[];
  preferences?: string[];
  profileImage?: string;
  bannerImage?: string;
}

type RootStackParamList = {
  'edit-profile': { currentProfile: UserProfile };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type RouteParams = {
  currentProfile: UserProfile;
};

export default function EditProfileScreen() {
  const [profile, setProfile] = useState<UserProfile>({
    id: 0,
    created_at: "",
    name: "",
    email: "",
    birthday: "",
    gender: "",
    saved_events: [],
    preferences: [],
    profileImage: "",
    bannerImage: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  const colorScheme = useColorScheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const params = route.params as RouteParams;
  

  useEffect(() => {
    if (params?.currentProfile) {
      setProfile(params.currentProfile);
    }
  }, [params]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('all_users')
        .update({
          name: profile.name,
          birthday: profile.birthday,
          gender: profile.gender,
          // add other fields as needed
        })
        .eq('email', profile.email);

      if (error) {
        Alert.alert('Error', 'Failed to update profile: ' + error.message);
        return false;
      }

      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
          <Ionicons name="close" size={24} color={Colors[colorScheme ?? 'light'].text} />
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={handleSave} 
          style={styles.saveButton}
          disabled={isLoading}
        >
          <LinearGradient
            colors={['#4CAF50', '#45a049']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveButtonGradient}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark" size={24} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.saveButtonText}>Save</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: Colors[colorScheme ?? 'light'].text }]}>Name</Text>
            <TextInput
              style={[styles.input, { 
                color: Colors[colorScheme ?? 'light'].text,
                backgroundColor: Colors[colorScheme ?? 'light'].background,
                borderColor: Colors[colorScheme ?? 'light'].text + '40'
              }]}
              value={profile.name}
              onChangeText={(text) => setProfile({ ...profile, name: text })}
              placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: Colors[colorScheme ?? 'light'].text }]}>Email</Text>
            <TextInput
              style={[styles.input, { 
                color: Colors[colorScheme ?? 'light'].text,
                backgroundColor: Colors[colorScheme ?? 'light'].background,
                borderColor: Colors[colorScheme ?? 'light'].text + '40'
              }]}
              value={profile.email}
              onChangeText={(text) => setProfile({ ...profile, email: text })}
              placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: Colors[colorScheme ?? 'light'].text }]}>Birthday</Text>
            <TextInput
              style={[styles.input, { 
                color: Colors[colorScheme ?? 'light'].text,
                backgroundColor: Colors[colorScheme ?? 'light'].background,
                borderColor: Colors[colorScheme ?? 'light'].text + '40'
              }]}
              value={profile.birthday}
              onChangeText={(text) => setProfile({ ...profile, birthday: text })}
              placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: Colors[colorScheme ?? 'light'].text }]}>Gender</Text>
            <TextInput
              style={[styles.input, { 
                color: Colors[colorScheme ?? 'light'].text,
                backgroundColor: Colors[colorScheme ?? 'light'].background,
                borderColor: Colors[colorScheme ?? 'light'].text + '40'
              }]}
              value={profile.gender}
              onChangeText={(text) => setProfile({ ...profile, gender: text })}
              placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    padding: 8,
  },
  saveButton: {
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 3,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  buttonIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
}); 