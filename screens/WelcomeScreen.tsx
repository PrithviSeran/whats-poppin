import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  Image,
  Animated
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
//import Button from '../components/Button';
import { Button } from 'tamagui'

type WelcomeScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Welcome'>;
};

export default function WelcomeScreen({ navigation }: WelcomeScreenProps) {

  
  //const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.parallel([
      /*
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),*/
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start();
  }, []);
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <Animated.View 
        style={[
          styles.content,
          {
            //opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }]}
          >
        <View style={styles.header}>
          <Text style={styles.title}>It Changed</Text>
          <Text style={styles.subtitle}>
            Find the perfect event for your evening
          </Text>
        </View>
        
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30' }} 
            style={styles.image}
            resizeMode="cover"
          />
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.description}>
            Tell us what you feel like doing tonight, and we'll match you with the perfect events.
          </Text>
          
          <Button 
            onPress={() => navigation.navigate('EventType')}
            theme="blue"
          > Let's Get Started</Button>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  header: {
    marginTop: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  imageContainer: {
    alignItems: 'center',
    marginVertical: 40,
  },
  image: {
    width: '100%',
    height: 250,
    borderRadius: 16,
  },
  footer: {
    marginBottom: 24,
  },
  description: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  button: {
    paddingVertical: 16,
  },
});