import { useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { testFirebaseAnalytics, trackScreen, trackEvent, setUserProperty, setUserId, ScreenName, AnalyticsEvent } from '../lib/firebase-analytics-test';

export const useAnalyticsTest = () => {
  // Initialize analytics on mount
  useEffect(() => {
    testFirebaseAnalytics.initialize();
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
    testFirebaseAnalytics.trackUserSignUp(method, userId);
  }, []);

  // Track user sign in
  const trackUserSignIn = useCallback((method: string, userId?: string) => {
    testFirebaseAnalytics.trackUserSignIn(method, userId);
  }, []);

  // Track event interactions
  const trackEventInteraction = useCallback((
    eventId: number,
    eventTitle: string,
    action: 'save' | 'unsave' | 'reject' | 'view' | 'share',
    additionalParams?: Record<string, any>
  ) => {
    testFirebaseAnalytics.trackEventInteraction(eventId, eventTitle, action, additionalParams);
  }, []);

  // Track swipe actions
  const trackSwipeAction = useCallback((direction: 'left' | 'right', eventId: number, eventTitle: string) => {
    testFirebaseAnalytics.trackSwipeAction(direction, eventId, eventTitle);
  }, []);

  // Track tab switches
  const trackTabSwitch = useCallback((tabName: string) => {
    testFirebaseAnalytics.trackTabSwitch(tabName);
  }, []);

  // Track search actions
  const trackSearch = useCallback((query: string, resultsCount?: number) => {
    testFirebaseAnalytics.trackSearch(query, resultsCount);
  }, []);

  // Track filter applications
  const trackFilterApplied = useCallback((filterType: string, filterValue: string) => {
    testFirebaseAnalytics.trackFilterApplied(filterType, filterValue);
  }, []);

  // Track errors
  const trackError = useCallback((errorMessage: string, errorCode?: string, screenName?: string) => {
    testFirebaseAnalytics.trackError(errorMessage, errorCode, screenName);
  }, []);

  // Track app lifecycle
  const trackAppOpen = useCallback(() => {
    testFirebaseAnalytics.trackAppOpen();
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
    testFirebaseAnalytics.setUserProfile(userProfile);
  }, []);

  // Clear user data
  const clearUserData = useCallback(() => {
    testFirebaseAnalytics.clearUserData();
  }, []);

  // Get analytics summary
  const getAnalyticsSummary = useCallback(() => {
    return testFirebaseAnalytics.getAnalyticsSummary();
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
    trackAppOpen,
    setUserProfile,
    clearUserData,
    getAnalyticsSummary,
  };
};

// Hook for automatic screen tracking
export const useScreenTrackingTest = (screenName: string) => {
  const { trackScreenView } = useAnalyticsTest();

  useFocusEffect(
    useCallback(() => {
      trackScreenView(screenName);
    }, [screenName, trackScreenView])
  );
};

// Hook for error tracking
export const useErrorTrackingTest = (screenName: string) => {
  const { trackError } = useAnalyticsTest();

  const logError = useCallback((error: Error, errorCode?: string) => {
    trackError(error.message, errorCode, screenName);
  }, [trackError, screenName]);

  return { logError };
}; 