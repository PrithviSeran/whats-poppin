import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

const { width, height } = Dimensions.get('window');

type RootStackParamList = {
    'create-account-finished': undefined;
  };
  
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const PREFERENCES = [
  'Bar Hopping',
  'Live Music',
  'Dancing',
  'Karaoke',
  'Chill Lounge',
  'Rooftop',
  'Comedy Show',
  'Game Night',
  'Food Crawl',
  'Sports Bar',
  'Trivia Night',
  'Outdoor Patio',
  'Late Night Eats',
  'Themed Party',
  'Open Mic',
  'Wine Tasting',
  'Hookah',
  'Board Games',
  'Silent Disco',
  'Other',
];

const DEFAULT_SELECTED = ['Bar Hopping', 'Live Music', 'Dancing'];

export default function UserPreferences() {
  const [selected, setSelected] = useState<string[]>(DEFAULT_SELECTED);
  const navigation = useNavigation<NavigationProp>();
  const colorScheme = useColorScheme();

  const togglePreference = (pref: string) => {
    setSelected((prev) =>
      prev.includes(pref)
        ? prev.filter((p) => p !== pref)
        : [...prev, pref]
    );
  };

  const isDark = colorScheme === 'dark';

  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: Colors[colorScheme ?? 'light'].background }
    ]}>
      <TouchableOpacity
        style={{
          position: 'absolute',
          top: 50,
          left: 20,
          zIndex: 10,
          backgroundColor: 'rgba(0,0,0,0.1)',
          borderRadius: 20,
          padding: 8,
        }}
        onPress={() => navigation.goBack()}
      >
        <Text style={{ fontSize: 28, color: '#FF1493' }}>{'←'}</Text>
      </TouchableOpacity>

        <Text style={[styles.title, { color: Colors[colorScheme ?? 'light'].text }]}>Almost There! Let us know what you're feeling!</Text>
        <Text style={[styles.subtitle, { color: isDark ? '#aaa' : '#888' }]}>Choose your interests for tonight</Text>
    
      <View style={{ height: height * 0.5, width: '100%', marginTop: -10 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.pillContainer}>
            {PREFERENCES.map((pref) => (
              <TouchableOpacity
                key={pref}
                style={[
                  styles.pill,
                  selected.includes(pref) && (isDark ? styles.pillSelectedDark : styles.pillSelectedLight),
                  {
                    backgroundColor: selected.includes(pref)
                      ? (isDark ? '#F45B5B' : '#F45B5B')
                      : (isDark ? '#222' : '#f5f5f5'),
                    borderColor: selected.includes(pref)
                      ? (isDark ? '#FF3366' : '#FF3366')
                      : (isDark ? '#333' : '#eee'),
                  }
                ]}
                onPress={() => togglePreference(pref)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.pillText,
                    selected.includes(pref) && styles.pillTextSelected,
                    { color: selected.includes(pref) ? '#fff' : (isDark ? '#fff' : '#222') }
                  ]}
                >
                  {pref}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
        <View style={styles.buttonGroup}>
            <TouchableOpacity onPress={() => navigation.navigate('create-account-finished')}>
            <LinearGradient
                colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
                locations={[0, 0.3, 0.7, 1]}
                style={styles.socialButton}
            >
                <Text style={styles.socialButtonText}>CONTINUE</Text>
            </LinearGradient>
            </TouchableOpacity>
        </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scrollContent: {
    alignItems: 'center',
    padding: 24,
    paddingBottom: 60,
    
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    marginTop: 86,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  pillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  pill: {
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 10,
    margin: 6,
    borderWidth: 1,
  },
  pillSelectedLight: {
    backgroundColor: '#F45B5B',
    borderColor: '#FF3366',
  },
  pillSelectedDark: {
    backgroundColor: '#F45B5B',
    borderColor: '#FF3366',
  },
  pillText: {
    fontSize: 15,
    fontWeight: '500',
  },
  pillTextSelected: {
    fontWeight: 'bold',
  },
  buttonGroup: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  socialButton: {
    borderRadius: 30,
    width: width * 0.8,
    paddingVertical: 13,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  socialButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
