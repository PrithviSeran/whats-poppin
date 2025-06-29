import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

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
  'me': {

    params?: {
      updatedProfile?: UserProfile;
    };
  };
  'edit-profile': { currentProfile: UserProfile };
  'edit-images': { currentProfile: UserProfile };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type RouteParams = {
  currentProfile: UserProfile;
};

export default function EditImages() {
  const [editedProfile, setEditedProfile] = useState<UserProfile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const colorScheme = useColorScheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const params = route.params as RouteParams;

  // Reset state when component mounts or params change
  useEffect(() => {
    if (params?.currentProfile) {
      setEditedProfile(params.currentProfile);
      setIsUploading(false);
    }
  }, [params?.currentProfile]);

  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      setEditedProfile(null);
      setIsUploading(false);
    };
  }, []);

  const uploadImageToSupabase = async (imageUri: string, imagePath: string): Promise<string | null> => {
    try {
      console.log('Starting upload for:', imagePath);
      console.log('Image URI:', imageUri);
      
      // Validate the image URI
      if (!imageUri || !imageUri.startsWith('file://')) {
        console.error('Invalid image URI:', imageUri);
        return null;
      }

      // Method 1: Try with FormData (React Native specific)
      try {
        console.log('Trying FormData approach...');
        const formData = new FormData();
        formData.append('file', {
          uri: imageUri,
          type: 'image/jpeg',
          name: imagePath.split('/').pop() || 'image.jpg',
        } as any);

        const { data, error } = await supabase.storage
          .from('user-images')
          .upload(imagePath, formData, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (!error && data) {
          console.log('FormData upload successful:', data);
          const { data: { publicUrl } } = supabase.storage
            .from('user-images')
            .getPublicUrl(imagePath);
          return publicUrl;
        }
        console.log('FormData method failed:', error);
      } catch (formDataError) {
        console.log('FormData method error:', formDataError);
      }

      // Method 2: Try with fetch and arraybuffer
      try {
        console.log('Trying ArrayBuffer approach...');
        const response = await fetch(imageUri);
        
        if (!response.ok) {
          console.error('Failed to fetch image:', response.status, response.statusText);
          return null;
        }

        const arrayBuffer = await response.arrayBuffer();
        console.log('ArrayBuffer created, size:', arrayBuffer.byteLength);
        
        if (arrayBuffer.byteLength === 0) {
          console.error('ArrayBuffer is empty');
          return null;
        }

        const { data, error } = await supabase.storage
          .from('user-images')
          .upload(imagePath, arrayBuffer, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (!error && data) {
          console.log('ArrayBuffer upload successful:', data);
          const { data: { publicUrl } } = supabase.storage
            .from('user-images')
            .getPublicUrl(imagePath);
          return publicUrl;
        }
        console.log('ArrayBuffer method failed:', error);
      } catch (arrayBufferError) {
        console.log('ArrayBuffer method error:', arrayBufferError);
      }

      // Method 3: Try with blob (original method)
      try {
        console.log('Trying Blob approach...');
        const response = await fetch(imageUri);
        
        if (!response.ok) {
          console.error('Failed to fetch image:', response.status, response.statusText);
          return null;
        }

        const blob = await response.blob();
        console.log('Blob created, size:', blob.size, 'type:', blob.type);
        
        if (!blob || blob.size === 0) {
          console.error('Invalid or empty blob');
          return null;
        }

        const { data, error } = await supabase.storage
          .from('user-images')
          .upload(imagePath, blob, {
            contentType: blob.type || 'image/jpeg',
            upsert: true,
          });

        if (!error && data) {
          console.log('Blob upload successful:', data);
          const { data: { publicUrl } } = supabase.storage
            .from('user-images')
            .getPublicUrl(imagePath);
          return publicUrl;
        }
        console.log('Blob method failed:', error);
      } catch (blobError) {
        console.log('Blob method error:', blobError);
      }

      // Method 4: Try with base64 if available
      const base64Key = imagePath.includes('profile') ? 'profileBase64' : 'bannerBase64';
      const base64Data = (editedProfile as any)?.[base64Key];
      
      
      console.error('All upload methods failed');
      return null;
    } catch (error) {
      console.error('Error in uploadImageToSupabase:', error);
      return null;
    }
  };

  const handleSave = async () => {
    if (!editedProfile) {
      return;
    }

    setIsUploading(true);

    try {
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return;
      }

      console.log('Current user:', user.email);
      let updatedProfile = { ...editedProfile };

      // Create folder path using user's email
      const userFolder = user.email?.replace(/[^a-zA-Z0-9]/g, '_') || user.id;

      // Upload profile image if it's a new local URI
      if (editedProfile.profileImage?.startsWith('file://')) {
        console.log('Processing profile image upload...');
        const profileImagePath = `${userFolder}/profile.jpg`;
        const profileImageUrl = await uploadImageToSupabase(editedProfile.profileImage, profileImagePath);
        
        if (profileImageUrl) {
          updatedProfile.profileImage = profileImageUrl;
          console.log('Profile image uploaded successfully');
        } else {
          return;
        }
      }

      // Upload banner image if it's a new local URI
      if (editedProfile.bannerImage?.startsWith('file://')) {
        console.log('Processing banner image upload...');
        const bannerImagePath = `${userFolder}/banner.jpg`;
        const bannerImageUrl = await uploadImageToSupabase(editedProfile.bannerImage, bannerImagePath);
        
        if (bannerImageUrl) {
          updatedProfile.bannerImage = bannerImageUrl;
          console.log('Banner image uploaded successfully');
        } else {
          return;
        }
      }

      console.log('Images uploaded successfully to storage!');
      console.log('Profile image URL:', updatedProfile.profileImage);
      console.log('Banner image URL:', updatedProfile.bannerImage);

      // Immediately refresh the GlobalDataManager cache with fresh data
      const GlobalDataManager = require('@/lib/GlobalDataManager').default;
      const dataManager = GlobalDataManager.getInstance();
      await dataManager.refreshAllData();
      console.log('✅ GlobalDataManager cache refreshed with updated image data');

      // Show success message and go back to previous screen
      Alert.alert('Success', 'Images updated successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack()
        }
      ]);

    } catch (error) {
      console.error('Error saving images:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setEditedProfile(null);
    setIsUploading(false);
    navigation.goBack();
  };

  const pickImage = async (type: 'profile' | 'banner') => {
    try {
      // Request permissions first
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'profile' ? [1, 1] : [16, 9],
        quality: 0.7, // Reduce quality slightly
        exif: false, // Remove EXIF data
        base64: true, // Get base64 data as backup
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const imageUri = asset.uri;
        
        console.log(`Selected ${type} image:`, {
          uri: imageUri,
          width: asset.width,
          height: asset.height,
          fileSize: asset.fileSize,
          hasBase64: !!asset.base64
        });

        // Validate the selected image
        if (!imageUri) {
          Alert.alert('Error', 'Invalid image selected');
          return;
        }

        // Check file size (optional - limit to 5MB)
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          Alert.alert('Error', 'Image is too large. Please select an image smaller than 5MB.');
          return;
        }

        // Store both URI and base64 for upload options
        if (editedProfile) {
          const updatedProfile = {
            ...editedProfile,
            [type === 'profile' ? 'profileImage' : 'bannerImage']: imageUri
          };
          
          // Store base64 as backup data
          if (asset.base64) {
            (updatedProfile as any)[`${type}Base64`] = asset.base64;
          }
          
          setEditedProfile(updatedProfile);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  if (!editedProfile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: Colors[colorScheme ?? 'light'].text }]}>
            Loading...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={handleCancel} 
          style={styles.closeButton}
          disabled={isUploading}
        >
          <Text style={[styles.closeButtonText, { opacity: isUploading ? 0.5 : 1 }]}>
            Cancel
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={handleSave} 
          style={styles.saveButton}
          disabled={isUploading}
        >
          <Text style={[styles.saveButtonText, { opacity: isUploading ? 0.5 : 1 }]}>
            {isUploading ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
            Banner Image
          </Text>
          <TouchableOpacity
            style={styles.bannerContainer}
            onPress={() => pickImage('banner')}
            disabled={isUploading}
          >
            {editedProfile.bannerImage ? (
              <Image source={{ uri: editedProfile.bannerImage }} style={styles.bannerImage} />
            ) : (
              <LinearGradient
                colors={['#9E95BD', '#9E95BD', '#9E95BD', '#9E95BD']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                locations={[0, 0.3, 0.7, 1]}
                style={styles.bannerPlaceholder}
              >
                <Ionicons name="image-outline" size={40} color="#fff" />
                <Text style={styles.placeholderText}>Tap to add banner image</Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
            Profile Image
          </Text>
          <TouchableOpacity
            style={styles.profileContainer}
            onPress={() => pickImage('profile')}
            disabled={isUploading}
          >
            {editedProfile.profileImage ? (
              <Image source={{ uri: editedProfile.profileImage }} style={styles.profileImage} />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Ionicons name="person-outline" size={40} color={Colors[colorScheme ?? 'light'].text} />
                <Text style={[styles.placeholderText, { color: Colors[colorScheme ?? 'light'].text }]}>
                  Tap to add profile image
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {isUploading && (
          <View style={styles.uploadingIndicator}>
            <Text style={[styles.uploadingText, { color: Colors[colorScheme ?? 'light'].text }]}>
              Uploading images...
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#FF1493',
  },
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    fontSize: 16,
    color: '#FF1493',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  bannerContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bannerPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    alignSelf: 'center',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  profilePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  placeholderText: {
    marginTop: 10,
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  uploadingIndicator: {
    marginTop: 20,
    alignItems: 'center',
  },
  uploadingText: {
    fontSize: 16,
    fontStyle: 'italic',
  },
});