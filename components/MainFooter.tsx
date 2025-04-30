import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function MainFooter() {
  return (
    <LinearGradient
      colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      locations={[0, 0.3, 0.7, 1]}
      style={styles.footer}
    >
      <TouchableOpacity style={styles.tab}>
        <Ionicons name="home" size={28} color="#fff" />
        <Text style={styles.label}>Home</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.tab}>
        <Feather name="search" size={28} color="#fff" />
        <Text style={styles.label}>Discover</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.tab}>
        <MaterialIcons name="chat-bubble-outline" size={28} color="#fff" />
        <Text style={styles.label}>Inbox</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.tab}>
        <Ionicons name="person-outline" size={28} color="#fff" />
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
});
