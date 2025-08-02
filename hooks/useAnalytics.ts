import { useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { firebaseAnalytics, trackScreen, trackEvent, setUserProperty, setUserId, ScreenName, AnalyticsEvent } from '../lib/firebase-analytics';

export const useAnalytics = () => {
  // Initialize analytics on mount
  useEffect(() => {
    firebaseAnalytics.initialize();
  }, []);

  // Track screen view when component mounts
  const trackScreenView = useCallback((screenName: string) => {
    trackScreen(screenName);
  }, []);

  // Track custom events
  const trackCustomEvent = useCallback((eventName: string, parameters?: Record<string, any>) => {
    trackEvent(eventName, parameters);
  }, []);

  // Track user properties
  const trackUserProperty = useCallback((property: string, value: string | number | boolean) => {
    setUserProperty(property, value);
  }, []);

  // Track user ID
  const trackUserId = useCallback((userId: string) => {
    setUserId(userId);
  }, []);

  // Track user sign up
  const trackUserSignUp = useCallback((method: string, userId?: string) => {
    firebaseAnalytics.trackUserSignUp(method, userId);
  }, []);

  // Track user sign in
  const trackUserSignIn = useCallback((method: string, userId?: string) => {
    firebaseAnalytics.trackUserSignIn(method, userId);
  }, []);

  // Track event interactions
  const trackEventInteraction = useCallback((
    eventId: number,
    eventTitle: string,
    action: 'save' | 'unsave' | 'reject' | 'view' | 'share',
    additionalParams?: Record<string, any>
  ) => {
    firebaseAnalytics.trackEventInteraction(eventId, eventTitle, action, additionalParams);
  }, []);

  // Track swipe actions
  const trackSwipeAction = useCallback((direction: 'left' | 'right', eventId: number, eventTitle: string) => {
    firebaseAnalytics.trackSwipeAction(direction, eventId, eventTitle);
  }, []);

  // Track tab switches
  const trackTabSwitch = useCallback((tabName: string) => {
    firebaseAnalytics.trackTabSwitch(tabName);
  }, []);

  // Track search actions
  const trackSearch = useCallback((query: string, resultsCount?: number) => {
    firebaseAnalytics.trackSearch(query, resultsCount);
  }, []);

  // Track filter applications
  const trackFilterApplied = useCallback((filterType: string, filterValue: string) => {
    firebaseAnalytics.trackFilterApplied(filterType, filterValue);
  }, []);

  // Track errors
  const trackError = useCallback((errorMessage: string, errorCode?: string, screenName?: string) => {
    firebaseAnalytics.trackError(errorMessage, errorCode, screenName);
  }, []);

  // Set user profile
  const setUserProfile = useCallback((userProfile: {
    userId: string;
    email: string;
    gender?: string;
    birthday?: string;
    location?: string;
    preferredEventTypes?: string[];
    travelDistance?: number;
    friendsCount?: number;
    savedEventsCount?: number;
  }) => {
    firebaseAnalytics.setUserProfile(userProfile);
  }, []);

  // Clear user data
  const clearUserData = useCallback(() => {
    firebaseAnalytics.clearUserData();
  }, []);

  return {
    trackScreenView,
    trackCustomEvent,
    trackUserProperty,
    trackUserId,
    trackUserSignUp,
    trackUserSignIn,
    trackEventInteraction,
    trackSwipeAction,
    trackTabSwitch,
    trackSearch,
    trackFilterApplied,
    trackError,
    setUserProfile,
    clearUserData,
  };
};

// Hook for automatic screen tracking
export const useScreenTracking = (screenName: string) => {
  const { trackScreenView } = useAnalytics();

  useFocusEffect(
    useCallback(() => {
      trackScreenView(screenName);
    }, [screenName, trackScreenView])
  );
};

// Hook for error tracking
export const useErrorTracking = (screenName?: string) => {
  const { trackError } = useAnalytics();

  const logError = useCallback((error: Error | string, errorCode?: string) => {
    const errorMessage = typeof error === 'string' ? error : error.message;
    trackError(errorMessage, errorCode, screenName);
  }, [trackError, screenName]);

  return { logError };
}; 