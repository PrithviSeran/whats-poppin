module.exports = {
  expo: {
    name: "Whats Poppin",
    slug: "whats-poppin",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/balloons.png",
    scheme: "whatspoppin",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/images/logo-light.png",
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
        UIBackgroundModes: ["location", "fetch", "remote-notification"],
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: ["whatspoppin"],
            CFBundleURLName: "com.prithviseran.whatspoppin"
          }
        ],
        // Universal Links configuration for iOS
        "com.apple.developer.associated-domains": [
          "applinks:whatspoppin.app"
        ],
        // Critical for Google Maps to work in production/TestFlight
        GMSApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
      },
      // iOS Universal Links
      associatedDomains: ["applinks:whatspoppin.app"]
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
        "ACCESS_FINE_LOCATION",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
        "WAKE_LOCK"
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
        },
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "whatspoppin",
              host: "*",
              pathPrefix: "/reset-password"
            }
          ],
          category: ["BROWSABLE", "DEFAULT"]
        },
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "https",
              host: "whatspoppin.app",
              pathPrefix: "/event"
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
          image: "./assets/images/logo-light.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff"
        }
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/images/balloons.png",
          color: "#FF0005",
          sounds: ["./assets/sounds/notification.wav"]
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