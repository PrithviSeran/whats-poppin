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

Terms and Conditions
Effective Date: June 6, 2025

1. Acceptance of Terms

By downloading, accessing, or using the Whats Poppin mobile application (the "App"), you agree to be bound by these Terms of Service ("Terms") and our Privacy Policy. These Terms form a legally binding agreement between you and Whats Poppin ("Company", "we", "us"), the operator of the App, located in Ontario, Canada. If you do not agree with these Terms or the Privacy Policy, you must not use the App.

We reserve the right to update or modify these Terms from time to time, and will indicate the "Effective Date" of the latest version. Your continued use of the App after any changes to the Terms signifies your acceptance of the revised Terms.

2. Eligibility and Age Requirements

The App is intended for users who are at least 16 years old. By using the App, you represent and warrant that you are 16 or older. If you are under the age of majority in your province or territory (which is 18 or 19 years old, depending on your jurisdiction) but at least 16, you must review these Terms with your parent or legal guardian and obtain their consent to use the App.

Users under the age of majority in their province or territory may use the App only with the involvement and consent of a parent or guardian, who agrees to be responsible for your compliance with these Terms. The App may filter or restrict certain content or events based on age categories. You agree to provide truthful and accurate age information.

3. User Accounts and Security

To access certain features of the App, you may need to create a user account. You agree to provide accurate, current, and complete information during registration and to keep your account information updated. You are responsible for maintaining the confidentiality of your account login credentials and for all activities that occur under your account.

You must notify us immediately at help@whatspoppin.info of any unauthorized use of your account or any other breach of security. We are not liable for any loss or damage arising from your failure to keep your account credentials confidential.

4. License and Permitted Use

We grant you a personal, non-exclusive, non-transferable, revocable license to install and use the App on your mobile device for lawful, personal, and non-commercial purposes, in accordance with these Terms. You must not:

• Copy, distribute, modify, or create derivative works of the App or any content available through the App;
• Reverse engineer, decompile, or attempt to extract the source code of the App;
• Use the App for any unlawful, harmful, or fraudulent purposes;
• Remove or obscure any copyright or proprietary notices;
• Use the App in a manner that could impair or disable the App.

We may terminate this license at any time if you violate these Terms.

5. User Conduct and Prohibited Activities

You agree not to use the App to:

• Impersonate others or misrepresent your affiliation;
• Post unlawful, harmful, or offensive content;
• Use bots or scrapers without permission;
• Access restricted areas without authorization;
• Attend or advertise unlawful gatherings and/or events;
• Introduce malware or engage in harmful conduct.

Violation of these rules may result in suspension or termination and potential legal consequences.

6. Third-Party Events and Content

Whats Poppin lists events hosted by third parties and is not responsible for their accuracy or outcomes. You agree that any issues related to these events are solely between you and the third-party organizer.

We are not affiliated with any event hosts, venues, or organizers listed on the App. The listing of an event does not constitute endorsement or partnership. Whats Poppin does not verify or guarantee the safety, legality, or quality of any event.

You acknowledge and agree that your decision to attend any event is at your own risk. Whats Poppin is not liable for any theft, injury, illness, loss, property damage, or other harm that may occur in connection with any event discovered through the App.

7. Location Services

The App may use GPS data to show nearby events. You can disable location permissions in your device settings. However, this may limit certain features.

We do not use your location data beyond improving the App and do not guarantee the accuracy of location-based services.

8. Termination

You may stop using the App at any time. We reserve the right to suspend or terminate your access if you violate these Terms or to protect other users or the integrity of the platform.

9. Disclaimer of Warranties

The App is provided "as is" and "as available", with no warranties of any kind. We do not guarantee the reliability or availability of the App or the accuracy of its content.

10. Limitation of Liability

To the extent permitted by law, Whats Poppin is not liable for indirect or consequential damages. Our total liability will not exceed CAD $50 or the amount you paid us in the last 6 months.

11. Indemnification

You agree to indemnify Whats Poppin and its affiliates from any claims, damages, or legal fees arising from your use of the App or breach of these Terms.

12. Dispute Resolution and Arbitration

Disputes will be resolved via arbitration in Ontario under the Ontario Arbitration Act. You waive class action rights and agree to resolve disputes individually.

You may opt out of arbitration by writing to help@whatspoppin.info within 30 days of accepting these Terms.

13. Governing Law

These Terms are governed by Ontario law. Legal actions must be filed in Ontario courts.

14. Changes to Terms

We may revise these Terms at any time. Notice will be provided via the App. Continued use after updates constitutes acceptance.

15. Miscellaneous

• Entire Agreement: These Terms and our Privacy Policy represent the complete agreement.
• Severability: If one part is invalid, the rest remains effective.
• No Waiver: Our failure to enforce any part does not waive our rights.
• Assignment: You may not transfer rights; we may assign freely.
• Third-Party App Stores: Apple and Google have no responsibility for the App.
• Language: The English version prevails in legal matters.
• Contact: help@whatspoppin.info

Force Majeure: We are not liable for delays or failure to perform due to causes beyond our reasonable control, including acts of God, natural disasters, war, terrorism, internet or utility outages, labor disputes, or government actions.

Survival: Provisions relating to limitations of liability, dispute resolution, intellectual property, and indemnification shall survive the termination of these Terms and your use of the App.

16. Content Warning

The App may contain or link to user-generated or third-party content that includes mature or explicit material. You acknowledge that by using the App, you may encounter such content, and you agree to use discretion and any provided filters. We are not responsible for such content and disclaim all liability associated with it.

17. Copyright Complaints (DMCA)

If you believe that any content available through the App infringes your copyright, please send a takedown notice to help@whatspoppin.info with your name, contact info, the material in question, and proof of ownership. We will respond in accordance with applicable copyright laws.

18. Beta Features Disclaimer

Some features of the App may be released as beta versions and are subject to further testing. These features may contain bugs or limitations and are provided "as-is". Your feedback is appreciated but use of beta features is at your own risk.

19. Data Usage and Liability

By using the App, you agree that Whats Poppin may collect, store, process, analyze, and utilize any data or information generated through your use of the App, including but not limited to location data, interaction data, user-generated content, and technical diagnostics, for any lawful purpose including analytics, improvement, marketing, and third-party collaboration. You acknowledge and consent to such use without further notice or compensation.

While we implement measures to safeguard your data, you acknowledge and agree that no platform can guarantee absolute security. Whats Poppin is not liable for any unauthorized access to, loss of, or theft of user data, whether due to hacking, negligence, or unforeseen breaches. You assume all responsibility and risk for using the App and sharing personal information within it.

20. External Links Disclaimer

The App may contain links to third-party websites, services, or affiliate programs that are not owned or controlled by Whats Poppin. These links are provided for your convenience and do not imply endorsement, sponsorship, or partnership.

You acknowledge and agree that Whats Poppin has no control over, and assumes no responsibility for, the content, privacy policies, security, or practices of any third-party websites or services. We are not liable for any harm, damage, or loss arising from your access to or use of any third-party content, websites, or services linked through the App. Your use of third-party sites is at your own risk and subject to the terms and policies of those sites.

By using the App, you agree that Whats Poppin may collect, store, process, analyze, and utilize any data or information generated through your use of the App, including but not limited to location data, interaction data, user-generated content, and technical diagnostics, for any lawful purpose including analytics, improvement, marketing, and third-party collaboration. You acknowledge and consent to such use without further notice or compensation.

While we implement measures to safeguard your data, you acknowledge and agree that no platform can guarantee absolute security. Whats Poppin is not liable for any unauthorized access to, loss of, or theft of user data, whether due to hacking, negligence, or unforeseen breaches. You assume all responsibility and risk for using the App and sharing personal information within it.

Some features of the App may be released as beta versions and are subject to further testing. These features may contain bugs or limitations and are provided "as-is". Your feedback is appreciated but use of beta features is at your own risk.`;

      case 'privacy':
        return `PRIVACY POLICY

Whats Poppin's Privacy Policy
Effective Date: June 17, 2025

Introduction

Whats Poppin ("we", "us", or "our") is committed to protecting your privacy and safeguarding your personal information. This Privacy Policy explains how we collect, use, disclose, and protect information when you use the Whats Poppin mobile application (the "App"). It also describes your rights and choices regarding your personal information. This Privacy Policy is governed by the federal Personal Information Protection and Electronic Documents Act (PIPEDA) and applicable provincial privacy laws in Canada. By using the App, you consent to the practices described in this Privacy Policy.

1. Information We Collect

When you use the App, we may collect certain information from or about you, including:

Personal Information: Information you provide to us, such as your name, email address, date of birth or age (for age verification purposes), or other contact information if you create an account or contact us for support.

Location Data: Precise geolocation information from your mobile device (GPS coordinates), which allows the App to show you nearby events. We only collect location data with your permission, and you can disable location access at any time in your device settings.

Usage and Device Information: Technical information about your use of the App, such as your device type and model, operating system, unique device identifiers, IP address, App version, and usage statistics (e.g., features you use, pages or screens viewed, and time spent).

Cookies and Similar Technologies: The App may use local storage or similar technologies to remember your preferences and enhance your experience. (Note: The App does not use traditional web cookies, since it is a mobile application, but it may use similar mechanisms for storing data on your device.)

We do not knowingly collect sensitive personal information (such as financial information or social insurance numbers) through the App, as the App's functionality is limited to event discovery.

2. How We Use Your Information

We use the information we collect for various purposes related to operating and improving the App, including:

Providing Services: To operate the App and provide you with its core features, such as displaying local events based on your location and preferences.

Account Management: If you create an account, to manage your account, authenticate you, and provide customer support.

Communication: To communicate with you about the App, respond to your inquiries, send you important notices or updates, and, if you have opted in, send you promotional messages or event recommendations. (You can opt out of marketing communications at any time by contacting us or using the unsubscribe mechanism provided.)

App Improvement: To analyze usage and performance of the App (e.g., to understand which features are most used) and to fix bugs, improve functionality, and develop new features.

Safety and Legal Obligations: To monitor, investigate, or enforce compliance with our Terms of Service and this Privacy Policy, to protect the rights, property, or safety of us, our users, or others, and to comply with applicable legal obligations (such as responding to lawful requests by public authorities).

We will only use your personal information for the purposes for which we collected it, or for compatible purposes such as those listed above, unless we obtain your consent or as otherwise required or permitted by law.

3. How We Share or Disclose Information

We understand the importance of keeping your information private. We do not sell or rent your personal information to third parties. We may share or disclose your information in the following circumstances:

Service Providers: We may share information with third-party service providers who perform services on our behalf to help us operate the App (for example, cloud hosting providers, analytics services, or customer support tools). These service providers are contractually obligated to protect your information and use it only for the purposes of providing services to us.

Event Information Sharing: If you choose to interact with a third-party event (for example, by clicking a link to buy tickets or by using a feature to indicate interest or attendance), information necessary to facilitate that interaction (such as the fact that you are interested in the event) may be sent to the relevant third party. We will not share your personal contact information with event organizers through the App without your explicit action or consent.

Legal Compliance: We may disclose your information if required to do so by law or in the good-faith belief that such action is necessary to comply with applicable laws, regulations, legal process, or governmental requests (for example, in response to a subpoena or court order).

Protection of Rights: We may disclose information where we believe it is necessary to investigate, prevent, or take action regarding illegal activities, suspected fraud, situations involving potential threats to the safety of any person, violations of our Terms of Service or this Privacy Policy, or as evidence in litigation in which we are involved.

Business Transactions: Your information may be transferred to a successor organization if, for example, we are involved in a merger, acquisition, financing due diligence, reorganization, bankruptcy, receivership, sale of assets, or transition of service to another provider. In such a case, your information would remain subject to the protections of this Privacy Policy (unless you are notified otherwise and consent to any new uses or disclosures).

With Your Consent: We may share your information for any other purpose disclosed to you with your consent.

If we transfer your personal information internationally (for example, to a service provider in another country), we will take steps to ensure it is protected in accordance with this Privacy Policy and applicable law, but note that it may be subject to the laws of the jurisdiction where it is stored.

External Links Disclaimer: The App may contain links to third-party websites, applications, or services. We do not control and are not responsible for the privacy practices, content, or terms of use of these third-party platforms. Your use of third-party websites or services is at your own risk, and you should review their privacy policies before sharing any personal information.

4. Your Rights and Choices

You have certain rights and choices regarding your personal information:

Access and Correction: You have the right to access the personal information we hold about you and to request correction of any inaccuracies. You may review and update some of your account information directly in the App (if applicable), or you can contact us at help@whatspoppin.info to make an access or correction request.

Withdrawal of Consent: Where you have provided consent for our collection, use, or disclosure of your personal information, you have the right to withdraw your consent at any time, subject to legal or contractual restrictions.

Deletion: You may request that we delete your personal information. We will honor such requests to the extent required by applicable law, but may retain certain data for legal or business reasons.

Marketing Communications: You can opt out of receiving promotional communications at any time using the unsubscribe link or by adjusting preferences in the App.

Children's Information: If you are a parent or guardian and believe we have collected personal information from a child under 13 without proper consent, please contact us and we will delete that information.

To exercise these rights or for questions about your personal information, contact us at help@whatspoppin.info. We may take steps to verify your identity before fulfilling requests.

5. Data Security and Retention

We take the security of your personal information seriously and implement reasonable physical, administrative, and technical safeguards to protect it. However, no method of transmission or storage is 100% secure. You are also responsible for maintaining the confidentiality of your account credentials.

We retain personal information only as long as necessary to fulfill the purposes for which it was collected, or as required by applicable laws. In some cases, we may retain data to resolve disputes, enforce our agreements, or maintain security and backup systems. When information is no longer needed, we securely erase, anonymize, or destroy it.

6. Children's Privacy

As noted in our Terms of Service, the App is not intended for children under 16. We do not knowingly collect personal information from children under 16. If we become aware that we have done so, we will delete the data as soon as possible.

Minors aged 16 to under 18 may use the App only with parental or guardian consent. Parents may contact us to review or delete any personal data collected from their child.

7. Changes to this Privacy Policy

We may update this Privacy Policy to reflect changes in our practices or for legal or operational reasons. When we make updates, we will revise the "Effective Date" and may provide more prominent notice when appropriate.

Your continued use of the App after changes constitutes acceptance of the revised Privacy Policy. If you disagree, you should stop using the App and request account deletion if applicable.

8. Contact Us

If you have questions or requests regarding this Privacy Policy, contact us at help@whatspoppin.info`;

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
    fontSize: 16,
    lineHeight: 26,
    marginBottom: 24,
    fontFamily: 'System',
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
    color: '#007AFF',
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