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
  'edit-images': { currentProfile: UserProfile };
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

  const fetchUserProfile = async () => {
    try {
      console.log('Fetching user profile...');
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No user found');
        return;
      }

      console.log('Fetching profile for user:', user.email);
      // Query the all_users table for this user's profile
      const { data, error } = await supabase
        .from('all_users')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user profile:', error);
        return;
      }

      if (!data) {
        console.log('No user profile found for email:', user.email);
        return;
      }

      // Create folder path using user's email
      const userFolder = user.email?.replace(/[^a-zA-Z0-9]/g, '_') || user.id;

      // Get the public URLs for both images
      const { data: { publicUrl: profileUrl } } = supabase.storage
        .from('user-images')
        .getPublicUrl(`${userFolder}/profile.jpg`);

      const { data: { publicUrl: bannerUrl } } = supabase.storage
        .from('user-images')
        .getPublicUrl(`${userFolder}/banner.jpg`);

      console.log('Profile image URL:', profileUrl);
      console.log('Banner image URL:', bannerUrl);
      
      // Set both image URLs
      data.profileImage = profileUrl;
      data.bannerImage = bannerUrl;

      console.log('Profile fetched successfully:', data);
      setProfile(data);
      setEditedProfile(data);
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchUserProfile();
  }, []);

  // Refresh data when screen comes into focus or when params change
  useFocusEffect(
    React.useCallback(() => {
      if (params?.params?.updatedProfile) {
        console.log('Updating profile with new data:', params.params.updatedProfile);
        setProfile(params.params.updatedProfile);
        setEditedProfile(params.params.updatedProfile);
      } else {
        fetchUserProfile();
      }
    }, [params?.params?.updatedProfile])
  );

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
    if (editedProfile) {
      navigation.navigate('edit-images', { currentProfile: editedProfile });
    }
  };

  const handleEditProfile = () => {
    if (editedProfile) {
      navigation.navigate('edit-profile', { currentProfile: editedProfile });
    }
  };

    

  const handleSaveImages = async () => {
    console.log("uyfedycgv")
    if (editedProfile) {
      console.log("HERE????")
      try {
        // Get the current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('No authenticated user found');
          Alert.alert('Error', 'You must be logged in to update your profile');
          return;
        }

        console.log('Current user:', user.email);
        let profileImageUrl = editedProfile.profileImage;
        let bannerImageUrl = editedProfile.bannerImage;

        // Upload profile image if it's a new local URI
        if (editedProfile.profileImage?.startsWith('file://')) {
          try {
            console.log('Uploading profile image...');
            const profileImagePath = `${user.id}/profile-${Date.now()}.jpg`;
            
            // Convert URI to blob
            const response = await fetch(editedProfile.profileImage);
            const blob = await response.blob();
            
            const { data: profileData, error: profileError } = await supabase.storage
              .from('user-images')
              .upload(profileImagePath, blob, {
                contentType: 'image/jpeg',
                upsert: true
              });

            if (profileError) {
              console.error('Profile image upload error:', profileError);
              throw profileError;
            }

            console.log('Profile image uploaded successfully');

            // Get public URL for profile image
            const { data: { publicUrl: profilePublicUrl } } = supabase.storage
              .from('user-images')
              .getPublicUrl(profileImagePath);
            
            profileImageUrl = profilePublicUrl;
            console.log('Profile image URL:', profileImageUrl);
          } catch (error) {
            console.error('Error uploading profile image:', error);
            Alert.alert('Error', 'Failed to upload profile image');
            return;
          }
        }

        // Upload banner image if it's a new local URI
        if (editedProfile.bannerImage?.startsWith('file://')) {
          try {
            console.log('Uploading banner image...');
            const bannerImagePath = `${user.id}/banner-${Date.now()}.jpg`;
            
            // Convert URI to blob
            const response = await fetch(editedProfile.bannerImage);
            const blob = await response.blob();

            console.log("BLOB:  ", blob)
            
            const { data: bannerData, error: bannerError } = await supabase.storage
              .from('user-images')
              .upload(bannerImagePath, blob, {
                contentType: 'image/jpeg',
                upsert: true
              });

            if (bannerError) {
              console.error('Banner image upload error:', bannerError);
              throw bannerError;
            }

            console.log('Banner image uploaded successfully');

            // Get public URL for banner image
            const { data: { publicUrl: bannerPublicUrl } } = supabase.storage
              .from('user-images')
              .getPublicUrl(bannerImagePath);
            
            bannerImageUrl = bannerPublicUrl;
            console.log('Banner image URL:', bannerImageUrl);
          } catch (error) {
            console.error('Error uploading banner image:', error);
            Alert.alert('Error', 'Failed to upload banner image');
            return;
          }
        }

        // Update user profile in database
        console.log('Updating profile in database...');
        const { data: updateData, error: updateError } = await supabase
          .from('all_users')
          .update({
            profile_image: profileImageUrl,
            banner_image: bannerImageUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('email', user.email)
          .select();

        if (updateError) {
          console.error('Profile update error:', updateError);
          throw updateError;
        }

        console.log('Profile updated successfully:', updateData);

        // Update local state with the returned data
        const updatedProfile = {
          ...editedProfile,
          profileImage: profileImageUrl,
          bannerImage: bannerImageUrl,
        };

        // Update both profile states immediately
        setProfile(updatedProfile);
        setEditedProfile(updatedProfile);
        setIsEditMode(false);

        Alert.alert('Success', 'Profile images updated successfully!');
      } catch (error) {
        console.error('Error saving images:', error);
        Alert.alert('Error', 'Failed to save images. Please try again.');
      }
    }
  };

  const handleCancelImages = () => {
    setEditedProfile(profile);
    setIsEditMode(false);
  };

  const pickImage = async (type: 'profile' | 'banner') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'profile' ? [1, 1] : [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        console.log(`Selected ${type} image:`, imageUri);
        if (editedProfile) {
          setEditedProfile({
            ...editedProfile,
            [type === 'profile' ? 'profileImage' : 'bannerImage']: imageUri
          });
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
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
      <View style={styles.headerContainer}>
        {editedProfile?.bannerImage && (
          <Image 
            source={{ uri: editedProfile.bannerImage }} 
            style={styles.bannerImage}
            resizeMode="cover"
          />
        )}
        <LinearGradient
          colors={['rgba(255,107,107,0.5)', 'rgba(255,20,147,0.5)', 'rgba(179,136,235,0.5)', 'rgba(255,107,107,0.5)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          locations={[0, 0.3, 0.7, 1]}
          style={styles.headerGradient}
        >
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
                <Image 
                  source={{ uri: editedProfile.profileImage }} 
                  style={styles.profileImage}
                  resizeMode="cover"
                />
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
      </View>

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
              colors={['#9E95BD', '#9E95BD']}
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
  headerContainer: {
    width: '100%',
    minHeight: 300,
    position: 'relative',
    overflow: 'hidden',
  },
  headerGradient: {
    width: '100%',
    height: '100%',
    paddingTop: 50,
    paddingBottom: 20,
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
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