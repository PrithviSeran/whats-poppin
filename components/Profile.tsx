import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import MainFooter from './MainFooter';
import { supabase } from '@/lib/supabase';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface UserProfile {
  name: string;
  email: string;
  birthday: string;
  gender: string;
  profileImage?: string;
}

type RootStackParamList = {
  '(tabs)': undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const sampleProfile: UserProfile = {
  name: "John Doe",
  email: "john.doe@example.com",
  birthday: "January 15, 1995",
  gender: "Male",
  profileImage: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
};

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const colorScheme = useColorScheme();
  const navigation = useNavigation<NavigationProp>();

  useEffect(() => {
    // Simulate loading delay
    const timer = setTimeout(() => {
      setProfile(sampleProfile);
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigation.navigate('(tabs)');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const renderInfoRow = (icon: string, label: string, value: string) => (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={24} color={colorScheme === 'dark' ? '#aaa' : '#666'} />
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>{value}</Text>
      </View>
    </View>
  );

  if (!profile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: Colors[colorScheme ?? 'light'].text }]}>Loading profile...</Text>
        </View>
        <View style={styles.footerContainer}>
          <MainFooter activeTab="me" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      <LinearGradient
        colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        locations={[0, 0.3, 0.7, 1]}
        style={styles.header}
      >
        <TouchableOpacity style={styles.editButton}>
          <Ionicons name="pencil" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.profileImageContainer}>
          {profile.profileImage ? (
            <Image source={{ uri: profile.profileImage }} style={styles.profileImage} />
          ) : (
            <View style={[styles.profileImage, styles.placeholderImage]}>
              <Ionicons name="person" size={50} color="#fff" />
            </View>
          )}
        </View>
        <Text style={styles.name}>{profile.name}</Text>
      </LinearGradient>

      <ScrollView>
        <View style={styles.content}>
          {renderInfoRow('mail-outline', 'Email', profile.email)}
          {renderInfoRow('calendar-outline', 'Birthday', profile.birthday)}
          {renderInfoRow('person-outline', 'Gender', profile.gender)}
          
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <LinearGradient
              colors={['#FF6B6B', '#FF1493']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.signOutGradient}
            >
              <Text style={styles.signOutText}>Sign Out</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <View style={styles.footerContainer}>
        <MainFooter activeTab="me" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    alignItems: 'center',
  },
  editButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileImageContainer: {
    marginBottom: 20,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#fff',
  },
  placeholderImage: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    padding: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  infoContent: {
    marginLeft: 15,
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  signOutButton: {
    marginTop: 30,
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  signOutGradient: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
}); 