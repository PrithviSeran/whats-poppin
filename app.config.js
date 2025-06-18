module.exports = {
  expo: {
    name: "whats-poppin",
    slug: "whats-poppin",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "whatspoppin",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/images/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    extra: {
      eas: {
        projectId: "d313f76f-429c-4ab7-9a2a-3557cc200f40"
      }
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.prithviseran.whatspoppin",
      buildNumber: "1",
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
      },
      infoPlist: {
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true
        },
        NSLocationWhenInUseUsageDescription: "This app needs access to your location to show nearby events and your position on the map.",
        NSLocationAlwaysUsageDescription: "This app needs access to your location to show nearby events and your position on the map.",
        UIBackgroundModes: ["location", "fetch"],
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: ["whatspoppin"],
            CFBundleURLName: "com.prithviseran.whatspoppin"
          }
        ],
        // Critical for Google Maps to work in production/TestFlight
        GMSApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.prithviseran.whatspoppin",
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      },
      permissions: [
        "INTERNET",
        "ACCESS_NETWORK_STATE",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION"
      ],
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "whatspoppin"
            }
          ],
          category: ["BROWSABLE", "DEFAULT"]
        }
      ]
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Allow $(PRODUCT_NAME) to use your location."
        }
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff"
        }
      ],
      "expo-font",
      "expo-web-browser",
      // Critical: React Native Maps plugin for proper iOS compilation
    ],
    experiments: {
      typedRoutes: true
    }
  }
}; 