import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import GlobalDataManager from './lib/GlobalDataManager';

// ... other imports ...

export default function App() {
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await GlobalDataManager.getInstance().initialize();
      } catch (error) {
        console.error('Failed to initialize app data:', error);
      }
    };

    initializeApp();
  }, []);

  // ... rest of your App component code ...
} 