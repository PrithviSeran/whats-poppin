import { useState, useEffect } from 'react';
import { GoogleAuthService } from '@/lib/googleAuth';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export const useGoogleAuth = () => {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const { session } = useAuth();

  const signInWithGoogle = async () => {
    setIsGoogleLoading(true);
    setGoogleError(null);
    
    try {
      const result = await GoogleAuthService.signInWithGoogle();
      console.log('Google Sign-In successful:', result);
      return result;
    } catch (error: any) {
      console.error('Google Sign-In error:', error);
      
      // Handle specific error cases
      let errorMessage = 'Failed to sign in with Google';
      
      if (error.code === 'SIGN_IN_CANCELLED') {
        errorMessage = 'Sign in was cancelled';
      } else if (error.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
        errorMessage = 'Google Play Services not available';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setGoogleError(errorMessage);
      throw error;
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await GoogleAuthService.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const checkGoogleSignInStatus = async () => {
    try {
      return await GoogleAuthService.isSignedIn();
    } catch (error) {
      console.error('Check Google sign-in status error:', error);
      return false;
    }
  };

  return {
    signInWithGoogle,
    signOut,
    checkGoogleSignInStatus,
    isGoogleLoading,
    googleError,
    isAuthenticated: !!session,
  };
};