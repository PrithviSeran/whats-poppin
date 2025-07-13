// import React, { useState } from 'react';
// import { View, Button, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
// import * as AuthSession from 'expo-auth-session';
// import { useEffect } from 'react';
// import { GoogleSignin, GoogleSigninButton } from '@react-native-google-signin/google-signin';

// // Google OAuth configuration
// const CLIENT_ID = '1028929347533-7e75f5bat89emtq4jl86o3vifpupvcnn.apps.googleusercontent.com';
// const EXPO_REDIRECT_URI = AuthSession.makeRedirectUri();
// // Use Google's OAuth endpoints
// const discovery = {
//   authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
//   tokenEndpoint: 'https://oauth2.googleapis.com/token',
//   revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
// };

// export default function ExpoGoogleSignin() {

//   useEffect(() => {
//     GoogleSignin.configure({
//       iosClientId: '1028929347533-7e75f5bat89emtq4jl86o3vifpupvcnn.apps.googleusercontent.com',
//     });
//   });

//   const signIn = async () => {
//     try {
//       await GoogleSignin.hasPlayServices();
//       const userInfo = await GoogleSignin.signIn();
//       console.log(userInfo);
//     } catch (error) {
//       console.log(error);
//     }
//   }

//   return (
//     <View>
//       <TouchableOpacity onPress={signIn}>
//         <Text>Sign in with Google</Text>
//       </TouchableOpacity>
//     </View>
//   );
// }

// Google Sign-In temporarily disabled
export default function ExpoGoogleSignin() {
  return null;
}
