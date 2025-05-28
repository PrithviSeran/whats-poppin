import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const { width } = Dimensions.get('window');

type RootStackParamList = {
  'suggested-events': undefined;
  'discover': undefined;
  'me': undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface MainFooterProps {
  activeTab: 'home' | 'discover' | 'me';
}

export default function MainFooter({ activeTab }: MainFooterProps) {
  const homeAnim = useRef(new Animated.Value(activeTab === 'home' ? 1 : 0)).current;
  const discoverAnim = useRef(new Animated.Value(activeTab === 'discover' ? 1 : 0)).current;
  const meAnim = useRef(new Animated.Value(activeTab === 'me' ? 1 : 0)).current;
  const navigation = useNavigation<NavigationProp>();

  useEffect(() => {
    Animated.timing(homeAnim, {
      toValue: activeTab === 'home' ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    Animated.timing(discoverAnim, {
      toValue: activeTab === 'discover' ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    Animated.timing(meAnim, {
      toValue: activeTab === 'me' ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [activeTab]);

  return (
    <LinearGradient
      colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      locations={[0, 0.3, 0.7, 1]}
      style={styles.footer}
    >
      <TouchableOpacity 
        style={styles.tab} 
        onPress={() => {
          if (activeTab !== 'home') {
            navigation.navigate('suggested-events');
          }
        }}
      >
        <View style={{ position: 'relative', height: 28, width: 28, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={{ position: 'absolute', opacity: homeAnim }}>
            <Ionicons name="home" size={28} color="#fff" />
          </Animated.View>
          <Animated.View style={{ position: 'absolute', opacity: homeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
            <Ionicons name="home-outline" size={28} color="#fff" style={{ opacity: 0.4 }} />
          </Animated.View>
        </View>
        <Text style={styles.label}>Home</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.tab} 
        onPress={() => {
          if (activeTab !== 'discover') {
            navigation.navigate('discover');
          }
        }}
      >
        <View style={{ position: 'relative', height: 28, width: 28, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={{ position: 'absolute', opacity: discoverAnim }}>
            <Feather name="search" size={28} color="#fff" />
          </Animated.View>
          <Animated.View style={{ position: 'absolute', opacity: discoverAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
            <Feather name="search" size={28} color="#fff" style={{ opacity: 0.4 }} />
          </Animated.View>
        </View>
        <Text style={styles.label}>Discover</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.tab} 
        onPress={() => {
          if (activeTab !== 'me') {
            navigation.navigate('me');
          }
        }}
      >
        <View style={{ position: 'relative', height: 28, width: 28, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={{ position: 'absolute', opacity: meAnim }}>
            <Ionicons name="person" size={28} color="#fff" />
          </Animated.View>
          <Animated.View style={{ position: 'absolute', opacity: meAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
            <Ionicons name="person-outline" size={28} color="#fff" style={{ opacity: 0.4 }} />
          </Animated.View>
        </View>
        <Text style={styles.label}>Me</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    width: width,
    height: 80,
    paddingBottom: 10,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginBottom: 10,
  },
  label: {
    color: '#fff',
    fontSize: 12,
    marginTop: 2,
  },
  centerTabWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    top: -18,
  },
  centerTab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FF1493',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  plus: {
    fontSize: 28,
    color: '#FF1493',
    fontWeight: 'bold',
    marginTop: -2,
  },
  activeLabel: {
    color: '#fff',
    fontWeight: 'bold',
  },
  underline: {
    height: 3,
    width: 24,
    backgroundColor: '#fff',
    borderRadius: 2,
    marginTop: 2,
  },
  activeTabCircle: {
    backgroundColor: 'rgba(255,255,255,0.18)',

    padding: 12,
    marginBottom: -8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});