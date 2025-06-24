# Legal Documents Setup Guide

This guide explains how to set up the privacy policy and terms & conditions for the What's Poppin app.

## 📋 Current Implementation

The app has been updated to include privacy policy and terms & conditions links in the following locations:

### ✅ **Sign In Screen (`components/SignInScreen.tsx`)**
- Legal agreement text before sign-in buttons
- Clickable links to terms and privacy policy

### ✅ **Social Sign In Screen (`components/SocialSignInScreen.tsx`)**
- Legal agreement text at the bottom of the form
- Clickable links to terms and privacy policy

### ✅ **Create Account Flow (`components/CreateAccount.tsx`)**
- Legal agreement section before the Continue button
- Informs users they agree by continuing

### ✅ **Create Account Finished (`components/CreateAccountFinished.tsx`)**
- Confirmation of legal agreement acceptance after account creation
- Clickable links to view the documents

### ✅ **Profile Settings (`components/Profile.tsx`)**
- Dedicated legal documents section in settings
- Easy access to terms and privacy policy

### ✅ **Legal Document Viewer (`components/LegalDocumentViewer.tsx`)**
- Modal component for viewing legal documents in-app
- Can be integrated for better UX instead of external links

## 🔗 Current URLs

All legal links currently point to:
- **Terms & Conditions**: `https://whatspoppin.app/legal/terms-and-conditions`
- **Privacy Policy**: `https://whatspoppin.app/legal/privacy-policy`

## 📁 Available Documents

The PDF documents are located at:
- `assets/images/terms-and-conditions.pdf`
- `assets/images/privacy-and-policy.pdf`

## 🚀 Deployment Options

### Option 1: Host on Your Domain (Recommended)
1. Upload the PDFs to your web server at `https://whatspoppin.app/legal/`
2. Ensure the URLs match the current implementation
3. Test the links from the app

### Option 2: Create Web Pages
1. Convert PDFs to HTML pages at the same URLs
2. Style them to match your brand
3. Make them mobile-responsive

### Option 3: Use the LegalDocumentViewer Component (✅ RECOMMENDED)
1. Import and use the `LegalDocumentViewer` component
2. Replace `Linking.openURL()` calls with modal displays  
3. **Best user experience** - displays content directly in the app
4. **No external dependencies** - uses bundled PDF files and text content
5. **Works offline** - no internet required to view legal documents

**Features:**
- Displays legal document text directly in the app
- References to bundled PDF files in assets folder
- Responsive design with proper theming
- Scrollable content for long documents
- Professional styling with proper typography

**Example usage:**
```tsx
import LegalDocumentViewer from './LegalDocumentViewer';

// Add state
const [showTerms, setShowTerms] = useState(false);
const [showPrivacy, setShowPrivacy] = useState(false);

// Replace link handlers
const handleOpenTerms = () => setShowTerms(true);
const handleOpenPrivacyPolicy = () => setShowPrivacy(true);

// Add components to render
<LegalDocumentViewer
  visible={showTerms}
  onClose={() => setShowTerms(false)}
  documentType="terms"
/>

<LegalDocumentViewer
  visible={showPrivacy}
  onClose={() => setShowPrivacy(false)}
  documentType="privacy"
/>
```

**Content Management:**
- Legal text is embedded in the component
- Easy to update without external file changes
- PDF files remain in assets for reference
- Consistent formatting and styling

### Option 4: Use Third-Party Legal Services
1. Services like Termly, PrivacyPolicies.com, etc.
2. Generate hosted legal documents
3. Update URLs in the app

## 🔧 Technical Implementation

### Files Modified:
- `components/SignInScreen.tsx` - Updated legal links
- `components/SocialSignInScreen.tsx` - Updated legal links  
- `components/CreateAccount.tsx` - Added legal agreement section
- `components/CreateAccountFinished.tsx` - Added legal confirmation
- `components/Profile.tsx` - Added legal documents in settings
- `components/LegalDocumentViewer.tsx` - New modal viewer component

### Dependencies Added:
- `react-native-webview` (for LegalDocumentViewer component)

## ⚠️ Important Notes

1. **Legal Compliance**: Ensure your actual legal documents are reviewed by a lawyer
2. **URL Consistency**: Make sure all URLs in the app point to the correct hosted documents
3. **Mobile Optimization**: Legal documents should be mobile-friendly
4. **Accessibility**: Ensure documents are accessible to users with disabilities
5. **Updates**: Plan for how you'll update legal documents and notify users

## 🧪 Testing

Before deploying:
1. Test all legal document links from each screen
2. Verify documents load correctly on both iOS and Android
3. Test with different network conditions
4. Ensure documents are readable on small screens
5. Test the LegalDocumentViewer component if using it

## 📱 User Experience

The legal documents are now integrated throughout the user journey:
- Users are informed of legal agreements before account creation
- Easy access from profile settings
- Clear confirmation after account creation
- Consistent styling and branding across all implementations

Choose the deployment option that best fits your infrastructure and user experience goals. 