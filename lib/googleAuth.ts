import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from './supabase';

// Google OAuth configuration
const GOOGLE_CLIENT_ID = '1028929347533-7e75f5bat89emtq4jl86o3vifpupvcnn.apps.googleusercontent.com';

export class GoogleAuthService {
  static configure() {
    GoogleSignin.configure({
      iosClientId: GOOGLE_CLIENT_ID,
      webClientId: GOOGLE_CLIENT_ID, // Add your web client ID if needed
      offlineAccess: true,
    });
  }

  static async signInWithGoogle() {
    try {
      // Check if Google Play Services are available (Android only)
      await GoogleSignin.hasPlayServices();
      
      // Sign in with Google
      const userInfo = await GoogleSignin.signIn();
      
      if (!userInfo.idToken) {
        throw new Error('No ID token received from Google');
      }

      // Sign in with Supabase using Google OAuth
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: userInfo.idToken,
      });

      if (error) {
        throw error;
      }

      return { data, userInfo };
    } catch (error) {
      console.error('Google Sign-In error:', error);
      throw error;
    }
  }

  static async signOut() {
    try {
      // Sign out from Google
      await GoogleSignin.signOut();
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  static async isSignedIn() {
    try {
      return await GoogleSignin.isSignedIn();
    } catch (error) {
      console.error('Check sign-in status error:', error);
      return false;
    }
  }

  static async getCurrentUser() {
    try {
      return await GoogleSignin.getCurrentUser();
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }
}