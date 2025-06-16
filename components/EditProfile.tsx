import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, Alert, ScrollView } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import GlobalDataManager from '@/lib/GlobalDataManager';

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
  '(tabs)': {
    screen?: string;
    params?: {
      updatedProfile?: UserProfile;
    };
  };
  'edit-profile': { currentProfile: UserProfile };
  'edit-images': { currentProfile: UserProfile };
  'me': { updatedProfile?: UserProfile };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type RouteParams = {
  currentProfile: UserProfile;
};

export default function EditProfile() {
  const [editedProfile, setEditedProfile] = useState<UserProfile | null>(null);
  const colorScheme = useColorScheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const params = route.params as RouteParams;
  const dataManager = GlobalDataManager.getInstance();

  React.useEffect(() => {
    if (params?.currentProfile) {
      setEditedProfile(params.currentProfile);
    }
  }, [params]);

  const handleSave = async () => {
    if (!editedProfile) return;

    try {
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user found');
        Alert.alert('Error', 'You must be logged in to update your profile');
        return;
      }

      // Update user profile in database
      console.log('Updating profile in database...');
      const { data: updateData, error: updateError } = await supabase
        .from('all_users')
        .update({
          name: editedProfile.name,
          birthday: editedProfile.birthday,
          gender: editedProfile.gender
        })
        .eq('id', editedProfile.id)
        .select();

      if (updateError) {
        console.error('Profile update error:', updateError);
        Alert.alert('Error', 'Failed to update profile. Please try again.');
        return;
      }

      console.log('Profile updated successfully:', updateData);

      // Refresh GlobalDataManager to update cached data
      await dataManager.refreshAllData();

      // Navigate back to the Me profile page with updated data
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        // Fallback if we can't go back
        navigation.navigate('(tabs)', {
          screen: 'me',
          params: {
            updatedProfile: editedProfile
          }
        });
      }

    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  const handleCancel = () => {
    // Simply go back to the previous screen (Me.tsx)
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // Fallback if we can't go back
      navigation.navigate('(tabs)', {
        screen: 'me'
      });
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
        <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
            Name
          </Text>
          <TextInput
            style={[styles.input, { 
              color: Colors[colorScheme ?? 'light'].text,
              backgroundColor: Colors[colorScheme ?? 'light'].background,
              borderColor: Colors[colorScheme ?? 'light'].text + '40'
            }]}
            value={editedProfile.name}
            onChangeText={(text) => setEditedProfile({ ...editedProfile, name: text })}
            placeholder="Enter your name"
            placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
            Birthday
          </Text>
          <TextInput
            style={[styles.input, { 
              color: Colors[colorScheme ?? 'light'].text,
              backgroundColor: Colors[colorScheme ?? 'light'].background,
              borderColor: Colors[colorScheme ?? 'light'].text + '40'
            }]}
            value={editedProfile.birthday}
            onChangeText={(text) => setEditedProfile({ ...editedProfile, birthday: text })}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
            Gender
          </Text>
          <View style={styles.genderButtonGroup}>
            <TouchableOpacity
              style={[
                styles.genderButton,
                editedProfile.gender === 'Male' && styles.genderButtonSelected,
                {
                  borderColor: '#FF0005',
                  backgroundColor: editedProfile.gender === 'Male'
                    ? '#FF0005'
                    : Colors[colorScheme ?? 'light'].background,
                },
              ]}
              onPress={() => setEditedProfile({ ...editedProfile, gender: 'Male' })}
            >
              <Text style={[
                styles.genderButtonText,
                editedProfile.gender === 'Male' && styles.genderButtonTextSelected,
                { color: editedProfile.gender === 'Male' ? 'white' : '#FF0005' },
              ]}>Male</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.genderButton,
                editedProfile.gender === 'Female' && styles.genderButtonSelected,
                {
                  borderColor: '#FF0005',
                  backgroundColor: editedProfile.gender === 'Female'
                    ? '#FF0005'
                    : Colors[colorScheme ?? 'light'].background,
                },
              ]}
              onPress={() => setEditedProfile({ ...editedProfile, gender: 'Female' })}
            >
              <Text style={[
                styles.genderButtonText,
                editedProfile.gender === 'Female' && styles.genderButtonTextSelected,
                { color: editedProfile.gender === 'Female' ? 'white' : '#FF0005' },
              ]}>Female</Text>
            </TouchableOpacity>
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
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  genderButtonGroup: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 10,
    gap: 20,
  },
  genderButton: {
    borderWidth: 2,
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginHorizontal: 10,
    shadowColor: '#FF0005',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  genderButtonSelected: {
    backgroundColor: '#FF0005',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  genderButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  genderButtonTextSelected: {
    color: 'white',
  },
});