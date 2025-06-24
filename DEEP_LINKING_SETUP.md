# Deep Linking Setup Guide for What's Poppin

This guide explains how to set up universal links for the What's Poppin app to enable proper sharing functionality.

## 🚀 Quick Overview

The app now supports deep linking through:
- **Custom URL Scheme**: `whatspoppin://event/{id}`
- **Universal Links**: `https://whatspoppin.app/event/{id}`

## 📁 Files Added/Modified

### App Configuration
- ✅ `app.config.js` - Added universal links configuration
- ✅ `app/_layout.tsx` - Added deep linking initialization and route
- ✅ `app/event/[id].tsx` - Dynamic route for shared events
- ✅ `lib/deepLinking.ts` - Enhanced to support universal links

### Domain Verification Files (Must be hosted on whatspoppin.app)
- ✅ `apple-app-site-association` - iOS universal links verification
- ✅ `assetlinks.json` - Android app links verification  
- ✅ `event-redirect.html` - Web fallback page

## 🌐 Domain Setup Required

### 1. Host Verification Files

Upload these files to your `whatspoppin.app` domain:

```
https://whatspoppin.app/.well-known/apple-app-site-association
https://whatspoppin.app/.well-known/assetlinks.json
```

**Important**: 
- Files must be served with `Content-Type: application/json`
- No `.json` extension for `apple-app-site-association`
- Must be accessible via HTTPS

### 2. Update Apple App Site Association

In the `apple-app-site-association` file, replace `TEAMID` with your actual Apple Developer Team ID:

```json
{
    "applinks": {
        "details": [
            {
                "appIDs": ["YOUR_TEAM_ID.com.prithviseran.whatspoppin"],
                "components": [
                    {
                        "/": "/event/*",
                        "comment": "Matches any URL with path that starts with /event/"
                    }
                ]
            }
        ]
    }
}
```

### 3. Update Android Asset Links

In the `assetlinks.json` file, replace the SHA256 fingerprint with your app's signing certificate fingerprint:

```json
[{
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
        "namespace": "android_app",
        "package_name": "com.prithviseran.whatspoppin",
        "sha256_cert_fingerprints": [
            "YOUR_ACTUAL_SHA256_FINGERPRINT"
        ]
    }
}]
```

**To get your SHA256 fingerprint:**
- Google Play Console → App Signing → App signing key certificate
- Or use: `keytool -list -v -keystore your-release-key.keystore`

## 📱 App Store Setup

### iOS - App Store Connect
1. Go to App Store Connect
2. Select your app → App Information
3. Add `whatspoppin.app` to Associated Domains
4. Ensure Universal Links are enabled

### Android - Google Play Console  
1. Go to Google Play Console
2. Select your app → App Signing
3. Note down the SHA256 certificate fingerprint
4. Update `assetlinks.json` with this fingerprint

## 🧪 Testing Deep Links

### Test URLs:
- Custom scheme: `whatspoppin://event/123`
- Universal link: `https://whatspoppin.app/event/123`

### Testing Methods:

#### iOS Testing:
```bash
# Test with iOS Simulator
xcrun simctl openurl booted "https://whatspoppin.app/event/123"

# Test custom scheme
xcrun simctl openurl booted "whatspoppin://event/123"
```

#### Android Testing:
```bash
# Test with Android emulator/device
adb shell am start -W -a android.intent.action.VIEW -d "https://whatspoppin.app/event/123"

# Test custom scheme  
adb shell am start -W -a android.intent.action.VIEW -d "whatspoppin://event/123"
```

#### Web Testing:
- Go to `https://whatspoppin.app/event/123` in Safari/Chrome on mobile
- Should prompt to open the app or redirect to app store

## 🔍 Verification

### Verify iOS Universal Links:
1. Visit: `https://search.developer.apple.com/appsearch-validation-tool/`
2. Enter: `https://whatspoppin.app/event/123`
3. Should show your app as associated

### Verify Android App Links:
1. Visit: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://whatspoppin.app&relation=delegate_permission/common.handle_all_urls`
2. Should return your app's package and fingerprint

## 🚨 Common Issues & Solutions

### Universal Links Not Working:

1. **Check domain verification files are accessible**:
   ```bash
   curl -I https://whatspoppin.app/.well-known/apple-app-site-association
   curl -I https://whatspoppin.app/.well-known/assetlinks.json
   ```

2. **Verify correct Team ID and Package Name**:
   - iOS: Check your Apple Developer Team ID
   - Android: Verify package name matches exactly

3. **Clear iOS cache** (if testing on device):
   - Settings → General → iPhone Storage → [Your App] → Delete App
   - Reinstall from App Store/TestFlight

4. **Android troubleshooting**:
   - Check app is set to handle URLs in device settings
   - Verify SHA256 fingerprint matches production certificate

### App Not Opening:

1. **Check app.config.js configuration**
2. **Verify route exists**: `app/event/[id].tsx` 
3. **Test custom scheme first**: `whatspoppin://event/123`
4. **Check device logs for errors**

## 📋 Deployment Checklist

- [ ] Upload `apple-app-site-association` to `https://whatspoppin.app/.well-known/`
- [ ] Upload `assetlinks.json` to `https://whatspoppin.app/.well-known/`
- [ ] Replace `TEAMID` with actual Apple Team ID
- [ ] Replace SHA256 fingerprint with production certificate
- [ ] Update app store links in `event-redirect.html`
- [ ] Test on physical devices (iOS & Android)
- [ ] Verify with Apple/Google validation tools

## 🎯 Next Steps

1. **Deploy verification files to your domain**
2. **Update Team ID and fingerprints with real values**
3. **Test thoroughly on physical devices**
4. **Submit app update to app stores**
5. **Test sharing functionality end-to-end**

## ✨ Sharing Flow

When users share an event:
1. Share URL: `https://whatspoppin.app/event/123`
2. Recipient taps link
3. If app installed → Opens event directly in app
4. If app not installed → Redirects to App Store/Play Store
5. After installation → Link works as universal link

The sharing experience is now seamless! 🎉 