import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, TextInput, Alert, ActivityIndicator, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import MainFooter from './MainFooter';
import { supabase } from '@/lib/supabase';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import GlobalDataManager from '@/lib/GlobalDataManager';

interface UserProfile {
  id: number;
  created_at: string;
  name: string;
  email: string;
  birthday: string;
  gender: string;
  saved_events?: string[]; // or string, depending on your usage
  preferences?: string[];  // or string, depending on your usage
  profileImage?: string;
  bannerImage?: string;
}

type RootStackParamList = {
  '(tabs)': {
    screen?: string;
    params?: {
      updatedProfile?: UserProfile;
    };
  };
  'edit-profile': { currentProfile: UserProfile };
  'edit-images': undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type RouteParams = {
  params?: {
    updatedProfile?: UserProfile;
  };
};


export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedProfile, setEditedProfile] = useState<UserProfile | null>(null);
  const colorScheme = useColorScheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const params = route.params as RouteParams;
  
  // Add animation values
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isMounted = true;
    const dataManager = GlobalDataManager.getInstance();

    const fetchUserProfile = async () => {
      try {
        // Initialize global data if not already initialized
        await dataManager.initialize();
        
        const profile = await dataManager.getUserProfile();
        if (isMounted && profile) {
          setProfile(profile);
          setEditedProfile(profile);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    // Listen for data updates
    const handleDataUpdate = () => {
      if (isMounted) {
        fetchUserProfile();
      }
    };

    dataManager.on('dataInitialized', handleDataUpdate);
    fetchUserProfile();

    return () => {
      isMounted = false;
      dataManager.removeListener('dataInitialized', handleDataUpdate);
    };
  }, []);

  // Clean up animations when component unmounts
  useEffect(() => {
    return () => {
      pulseAnim.stopAnimation();
      rotateAnim.stopAnimation();
    };
  }, []);

  // Start the animations when component mounts
  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigation.navigate('(tabs)', {});
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleEditImages = () => {
    navigation.navigate('edit-images');
  };

  const handleEditProfile = () => {
    if (editedProfile) {

      navigation.navigate('edit-profile', { currentProfile: editedProfile });
    }
  };

    

  const handleSaveImages = async () => {
    if (editedProfile) {
      const cleanPreferences = Array.isArray(editedProfile.preferences)
        ? editedProfile.preferences.map((pref: any) =>
            typeof pref === 'string' ? pref : (pref.value || JSON.stringify(pref))
          )
        : [];



    }
  };

  const handleCancelImages = () => {
    setEditedProfile(profile);
    setIsEditMode(false);
  };

  const pickImage = async (type: 'profile' | 'banner') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'profile' ? [1, 1] : [16, 9],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const imageUri = result.assets[0].uri;
      if (editedProfile) {
        setEditedProfile({
          ...editedProfile,
          [type === 'profile' ? 'profileImage' : 'bannerImage']: imageUri
        });
      }
    }
  };

  const renderInfoRow = (icon: string, label: string, value: string, showEditButton: boolean = false) => (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={24} color={colorScheme === 'dark' ? '#aaa' : '#666'} />
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>{value}</Text>
      </View>
      {showEditButton && (
        <TouchableOpacity onPress={handleEditProfile} style={styles.editInfoButton}>
          <Ionicons name="pencil" size={20} color={Colors[colorScheme ?? 'light'].text} />
        </TouchableOpacity>
      )}
    </View>
  );

  if (!profile) {
    const spin = rotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    const scale = pulseAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.8, 1.2],
    });

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
        <View style={styles.loadingContainer}>
          <Animated.View
            style={[
              styles.loadingCircle,
              {
                transform: [{ scale }, { rotate: spin }],
                borderColor: '#FF1493',
              },
            ]}
          >
            <View style={styles.innerCircle} />
          </Animated.View>
          <Text style={[styles.loadingText, { color: Colors[colorScheme ?? 'light'].text, marginTop: 20 }]}>
            Loading profile...
          </Text>
        </View>
        <View style={styles.footerContainer}>
          <MainFooter activeTab="me" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      <LinearGradient
        colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        locations={[0, 0.3, 0.7, 1]}
        style={styles.headerGradient}
      >
        {editedProfile?.bannerImage && (
          <Image source={{ uri: editedProfile.bannerImage }} style={styles.bannerImage} />
        )}
        <TouchableOpacity style={styles.editButton} onPress={handleEditImages}>
          <Ionicons name="images" size={24} color="#fff" />
        </TouchableOpacity>
        {isEditMode && (
          <TouchableOpacity style={styles.bannerEditButton} onPress={() => pickImage('banner')}>
            <Ionicons name="image" size={24} color="#fff" />
          </TouchableOpacity>
        )}
        <View style={styles.profileImageContainer}>
          <View style={styles.profileImageWrapper}>
            {editedProfile?.profileImage ? (
              <Image source={{ uri: editedProfile.profileImage }} style={styles.profileImage} />
            ) : (
              <View style={[styles.profileImage, styles.placeholderImage]}>
                <Ionicons name="person" size={50} color="#fff" />
              </View>
            )}
            {isEditMode && (
              <TouchableOpacity style={styles.uploadButton} onPress={() => pickImage('profile')}>
                <Ionicons name="camera" size={24} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <Text style={styles.name}>{editedProfile?.name}</Text>
      </LinearGradient>

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {renderInfoRow('mail-outline', 'Email', editedProfile?.email || '', true)}
          {renderInfoRow('calendar-outline', 'Birthday', editedProfile?.birthday || '')}
          {renderInfoRow('person-outline', 'Gender', editedProfile?.gender || '')}
          
          {isEditMode && (
            <View style={styles.editActions}>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveImages}>
                <LinearGradient
                  colors={['#4CAF50', '#45a049']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveButtonGradient}
                >
                  <Ionicons name="checkmark" size={24} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.saveButtonText}>Save</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancelImages}>
                <LinearGradient
                  colors={['#f44336', '#e53935']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.cancelButtonGradient}
                >
                  <Ionicons name="close" size={24} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
          
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

        <View style={styles.footerContainer}>
          <MainFooter activeTab="me" />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  headerGradient: {
    width: '100%',
    paddingTop: 50,
    paddingBottom: 20,
    alignItems: 'center',
    minHeight: 300,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  bannerImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.7,
  },
  editButton: {
    position: 'absolute',
    top: 80,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerEditButton: {
    position: 'absolute',
    top: 20,
    right: 70,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileImageContainer: {
    marginTop: 60,
    marginBottom: 20,
    alignItems: 'center',
  },
  profileImageWrapper: {
    position: 'relative',
    width: 120,
    height: 120,
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
  uploadButton: {
    position: 'absolute',
    bottom: -10,
    right: -10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
    zIndex: 1,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
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
  editInfoButton: {
    padding: 8,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  saveButton: {
    flex: 1,
    marginRight: 10,
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 3,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  cancelButton: {
    flex: 1,
    marginLeft: 10,
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 3,
  },
  cancelButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  buttonIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  signOutButton: {
    marginTop: 30,
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 3,
  },
  signOutGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  signOutText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  loadingCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#FF1493',
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 20, 147, 0.1)',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
}); 