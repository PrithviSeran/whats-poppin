import React from 'react';
import { 
  Modal, 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView,
  Dimensions,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

const { width, height } = Dimensions.get('window');

interface LegalDocumentViewerProps {
  visible: boolean;
  onClose: () => void;
  documentType: 'terms' | 'privacy';
  title?: string;
}

export default function LegalDocumentViewer({ 
  visible, 
  onClose, 
  documentType, 
  title 
}: LegalDocumentViewerProps) {
  const colorScheme = useColorScheme();

  const getTitle = () => {
    if (title) return title;
    switch (documentType) {
      case 'terms':
        return 'Terms & Conditions';
      case 'privacy':
        return 'Privacy Policy';
      default:
        return 'Legal Document';
    }
  };

  const getDocumentContent = () => {
    switch (documentType) {
      case 'terms':
        return `TERMS & CONDITIONS

Last updated: ${new Date().toLocaleDateString()}

1. ACCEPTANCE OF TERMS
By downloading, installing, or using the What's Poppin mobile application, you agree to be bound by these Terms & Conditions.

2. DESCRIPTION OF SERVICE
What's Poppin is a mobile application that helps users discover and explore local events and activities.

3. USER ACCOUNTS
- Users must provide accurate information when creating accounts
- Users are responsible for maintaining account security
- Users must be at least 13 years old to use the service

4. USER CONDUCT
Users agree not to:
- Post inappropriate or harmful content
- Harass or abuse other users
- Violate any applicable laws or regulations
- Use the service for commercial purposes without permission

5. PRIVACY
Your privacy is important to us. Please review our Privacy Policy to understand how we collect and use your information.

6. INTELLECTUAL PROPERTY
All content and materials in the app are owned by What's Poppin or its licensors and are protected by copyright and other intellectual property laws.

7. DISCLAIMERS
- The service is provided "as is" without warranties
- We are not responsible for event accuracy or cancellations
- Use the service at your own risk

8. LIMITATION OF LIABILITY
What's Poppin shall not be liable for any indirect, incidental, special, or consequential damages.

9. TERMINATION
We may terminate or suspend your account at any time for violations of these terms.

10. CHANGES TO TERMS
We reserve the right to modify these terms at any time. Changes will be effective upon posting.

11. CONTACT INFORMATION
For questions about these terms, please contact us at help@whatspoppin.info

By using What's Poppin, you acknowledge that you have read and understood these terms and agree to be bound by them.`;

      case 'privacy':
        return `PRIVACY POLICY

Last updated: ${new Date().toLocaleDateString()}

1. INFORMATION WE COLLECT
We collect information you provide directly to us, such as:
- Account information (name, email, preferences)
- Location data (with your permission)
- Usage information and analytics
- Device information

2. HOW WE USE YOUR INFORMATION
We use collected information to:
- Provide and improve our services
- Personalize your experience
- Send you relevant event recommendations
- Communicate with you about the service
- Ensure security and prevent fraud

3. INFORMATION SHARING
We do not sell your personal information. We may share information:
- With your consent
- To comply with legal obligations
- With service providers who assist us
- In connection with business transfers

4. LOCATION INFORMATION
- Location access is optional
- Used to show nearby events
- Can be disabled in app settings
- We don't store precise location history

5. DATA SECURITY
We implement appropriate security measures to protect your information against unauthorized access, alteration, disclosure, or destruction.

6. YOUR CHOICES
You can:
- Update your account information
- Control location sharing
- Delete your account
- Opt out of promotional communications

7. CHILDREN'S PRIVACY
Our service is not intended for children under 13. We do not knowingly collect personal information from children under 13.

8. INTERNATIONAL TRANSFERS
Your information may be transferred to and processed in countries other than your own.

9. DATA RETENTION
We retain your information as long as your account is active or as needed to provide services.

10. CHANGES TO PRIVACY POLICY
We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy.

11. CONTACT US
If you have questions about this privacy policy, please contact us at:
- Email: help@whatspoppin.info

Your privacy matters to us. We are committed to protecting your personal information and being transparent about our data practices.`;

      default:
        return 'Legal document content not available.';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView 
        style={[
          styles.container, 
          { backgroundColor: Colors[colorScheme ?? 'light'].background }
        ]}
      >
        {/* Header */}
        <View style={[
          styles.header, 
          { 
            backgroundColor: Colors[colorScheme ?? 'light'].card,
            borderBottomColor: colorScheme === 'dark' ? '#333' : '#E5E5E7'
          }
        ]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons 
              name="close" 
              size={24} 
              color={Colors[colorScheme ?? 'light'].text} 
            />
          </TouchableOpacity>
          
          <Text style={[styles.headerTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
            {getTitle()}
          </Text>
          
          <View style={styles.headerSpacer} />
        </View>

        {/* Document Content */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.documentContainer}>
            <Text style={[styles.documentContent, { color: Colors[colorScheme ?? 'light'].text }]}>
              {getDocumentContent()}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(158, 149, 189, 0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40, // Same width as close button for centering
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  documentContainer: {
    flex: 1,
  },
  documentContent: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 24,
    fontFamily: 'System',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
}); 