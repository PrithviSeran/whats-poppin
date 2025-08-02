import React from 'react';
import { useScreenTracking, useAnalytics } from '../hooks/useAnalytics';

interface WithAnalyticsProps {
  screenName: string;
}

export const withAnalytics = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  screenName: string
) => {
  const WithAnalyticsComponent = (props: P) => {
    // Track screen view automatically
    useScreenTracking(screenName);
    
    // Provide analytics functions
    const analytics = useAnalytics();

    return <WrappedComponent {...props} analytics={analytics} />;
  };

  WithAnalyticsComponent.displayName = `withAnalytics(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithAnalyticsComponent;
};

// Higher-order component for error tracking
export const withErrorTracking = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  screenName?: string
) => {
  const WithErrorTrackingComponent = (props: P) => {
    const { logError } = useErrorTracking(screenName);

    return <WrappedComponent {...props} logError={logError} />;
  };

  WithErrorTrackingComponent.displayName = `withErrorTracking(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithErrorTrackingComponent;
};

// Combined HOC for both analytics and error tracking
export const withAnalyticsAndErrorTracking = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  screenName: string
) => {
  const WithAnalyticsAndErrorTrackingComponent = (props: P) => {
    // Track screen view automatically
    useScreenTracking(screenName);
    
    // Provide analytics functions
    const analytics = useAnalytics();
    
    // Provide error tracking
    const { logError } = useErrorTracking(screenName);

    return <WrappedComponent {...props} analytics={analytics} logError={logError} />;
  };

  WithAnalyticsAndErrorTrackingComponent.displayName = `withAnalyticsAndErrorTracking(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithAnalyticsAndErrorTrackingComponent;
}; 