import { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import GlobalDataManager from './lib/GlobalDataManager';
import NotificationService from './lib/NotificationService';
import { setupDeepLinking } from './lib/deepLinking';
import { EventCard } from './lib/GlobalDataManager';

// ... other imports ...

export default function App() {
  const [sharedEvent, setSharedEvent] = useState<EventCard | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize global data manager
        await GlobalDataManager.getInstance().initialize();
        
        // Initialize notification service
        await NotificationService.getInstance().initialize();
        
        console.log('✅ App initialized successfully');
      } catch (error) {
        console.error('Failed to initialize app data:', error);
      }
    };

    initializeApp();

    // Cleanup notification service on app unmount
    return () => {
      NotificationService.getInstance().cleanup();
    };
  }, []);

  // Set up deep linking
  useEffect(() => {
    const cleanup = setupDeepLinking();

    // Listen for shared events
    const dataManager = GlobalDataManager.getInstance();
    const handleSharedEvent = (event: EventCard) => {
      setSharedEvent(event);
    };

    dataManager.on('sharedEventReceived', handleSharedEvent);

    return () => {
      cleanup();
      dataManager.removeListener('sharedEventReceived', handleSharedEvent);
    };
  }, []);

  // ... rest of your App component code ...
} 