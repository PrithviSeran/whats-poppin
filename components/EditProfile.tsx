import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, Alert, ScrollView, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import OptimizedComponentServices from '@/lib/OptimizedComponentServices';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface UserProfile {
  id: number;
  created_at: string;
  name: string;
  email: string;
  birthday: string;
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
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type RouteParams = {
  currentProfile: UserProfile;
};

export default function EditProfile() {
  const [editedProfile, setEditedProfile] = useState<UserProfile | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const colorScheme = useColorScheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const params = route.params as RouteParams;

  React.useEffect(() => {
    if (params?.currentProfile) {
      setEditedProfile(params.currentProfile);
      
      // Parse existing birthday if available
      if (params.currentProfile.birthday) {
        const parsedDate = new Date(params.currentProfile.birthday);
        if (!isNaN(parsedDate.getTime())) {
          setSelectedDate(parsedDate);
        }
      }
    }
  }, [params]);

  const handleDateChange = (event: any, date?: Date) => {
    // Only update the selected date, don't close the picker
    // The picker will only close when user taps Done or Cancel
    if (date && editedProfile) {
      setSelectedDate(date);
      // Don't update the profile immediately - wait for Done button
    }
  };

  const handleDatePickerDone = () => {
    // Save the selected date to the profile
    if (editedProfile) {
      const formattedDate = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      setEditedProfile({ ...editedProfile, birthday: formattedDate });
    }
    setShowDatePicker(false);
  };

  const handleDatePickerCancel = () => {
    // Revert to the original date if it exists
    if (editedProfile?.birthday) {
      const originalDate = new Date(editedProfile.birthday);
      if (!isNaN(originalDate.getTime())) {
        setSelectedDate(originalDate);
      }
    }
    setShowDatePicker(false);
  };

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return 'Select your birthday';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Select your birthday';
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleSave = async () => {
    if (!editedProfile) return;

    try {
      // Get the optimized services
      const services = OptimizedComponentServices.getInstance();
      
      // Get the current user
      const result = await services.getCurrentUser();
      const user = (result as any)?.data?.user;
      if (!user) {
        console.error('No authenticated user found');
        Alert.alert('Error', 'You must be logged in to update your profile');
        return;
      }

      // Update user profile using optimized service with automatic caching and optimistic updates
      console.log('Updating profile with optimized service...');
      await services.updateUserProfile(user.email, {
        name: editedProfile.name,
        birthday: editedProfile.birthday,
      });

      console.log('✅ Profile updated successfully with optimistic updates');

      // Show success message and go back to previous screen
      Alert.alert('Success', 'Profile updated successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack()
        }
      ]);

    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  const handleCancel = () => {
    navigation.goBack();
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
      {/* Simple Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.modernContent} showsVerticalScrollIndicator={false}>
        {/* Name Section */}
        <View style={[styles.modernSection, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
          <View style={styles.modernSectionHeader}>
            <View style={styles.modernSectionIconContainer}>
              <Ionicons name="person-outline" size={24} color="#9E95BD" />
            </View>
            <Text style={[styles.modernSectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
              Full Name
            </Text>
          </View>
          <View style={styles.modernInputContainer}>
            <TextInput
              style={[styles.modernInput, { 
                color: Colors[colorScheme ?? 'light'].text,
                backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(158, 149, 189, 0.05)',
              }]}
              value={editedProfile.name}
              onChangeText={(text) => setEditedProfile({ ...editedProfile, name: text })}
              placeholder="Enter your full name"
              placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
            />
          </View>
        </View>

        {/* Birthday Section */}
        <View style={[styles.modernSection, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}>
          <View style={styles.modernSectionHeader}>
            <View style={styles.modernSectionIconContainer}>
              <Ionicons name="calendar-outline" size={24} color="#FF6B9D" />
            </View>
            <Text style={[styles.modernSectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
              Birthday
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.modernDateButton, { 
              backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(158, 149, 189, 0.05)',
            }]}
            onPress={() => setShowDatePicker(true)}
          >
            <View style={styles.modernDateButtonContent}>
              <Ionicons 
                name="calendar" 
                size={20} 
                color={editedProfile.birthday ? Colors[colorScheme ?? 'light'].text : Colors[colorScheme ?? 'light'].text + '60'} 
                style={styles.modernDateIcon}
              />
              <Text style={[
                styles.modernDateText, 
                { 
                  color: editedProfile.birthday ? Colors[colorScheme ?? 'light'].text : Colors[colorScheme ?? 'light'].text + '60'
                }
              ]}>
                {formatDisplayDate(editedProfile.birthday)}
              </Text>
              <Ionicons 
                name="chevron-down" 
                size={20} 
                color={Colors[colorScheme ?? 'light'].text + '60'} 
              />
            </View>
          </TouchableOpacity>
        </View>


      </ScrollView>

      {/* Date Picker Modal */}
      {Platform.OS === 'ios' ? (
        <Modal
          visible={showDatePicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {}} // Prevent closing with back button
        >
          <View style={styles.datePickerModalOverlay}>
            <View style={[styles.datePickerModalContent, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
              {/* Header */}
              <View style={styles.datePickerHeader}>
                <TouchableOpacity onPress={handleDatePickerCancel} style={styles.datePickerCloseButton}>
                  <Text style={styles.datePickerCancelText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={[styles.datePickerTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                  Select Birthday
                </Text>
                <TouchableOpacity onPress={handleDatePickerDone} style={styles.datePickerCloseButton}>
                  <Text style={styles.datePickerDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
              
              {/* Date Picker */}
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                maximumDate={new Date()}
                minimumDate={new Date(1900, 0, 1)}
                textColor={Colors[colorScheme ?? 'light'].text}
                style={styles.datePickerSpinner}
              />
            </View>
          </View>
        </Modal>
      ) : (
        showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
            maximumDate={new Date()}
            minimumDate={new Date(1900, 0, 1)}
          />
        )
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // Simple Header Styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerButton: {
    padding: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#FF1493',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#FF1493',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  
  // Modern Content Styles
  modernContent: {
    flex: 1,
    padding: 20,
  },
  modernSection: {
    borderRadius: 16,
    marginBottom: 20,
    padding: 20,
    shadowColor: '#9E95BD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  modernSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  modernSectionIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 10,
    marginRight: 15,
  },
  modernSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  
  // Modern Input Styles
  modernInputContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  modernInput: {
    height: 56,
    paddingHorizontal: 20,
    fontSize: 16,
    fontWeight: '500',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(158, 149, 189, 0.15)',
  },
  
  // Modern Date Button Styles
  modernDateButton: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(158, 149, 189, 0.15)',
    justifyContent: 'center',
  },
  modernDateButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modernDateIcon: {
    marginRight: 12,
  },
  modernDateText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },

  
  // Loading Styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  
  // Date Picker Modal Styles
  datePickerModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 20,
  },
  datePickerModalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  datePickerCloseButton: {
    padding: 8,
    minWidth: 60,
  },
  datePickerCancelText: {
    fontSize: 16,
    color: '#FF1493',
  },
  datePickerDoneText: {
    fontSize: 16,
    color: '#FF1493',
    fontWeight: 'bold',
    textAlign: 'right',
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  datePickerSpinner: {
    height: 220,
    width: '100%',
  },
});