import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';

interface AnimatedGradientTextProps {
  phrases: string[];
  colors: readonly [string, string, ...string[]];
}

const AnimatedGradientText: React.FC<AnimatedGradientTextProps> = ({ phrases, colors }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [currentIndex, setCurrentIndex] = useState(0);

  // Animation for fading in and out
  useEffect(() => {
    // Start first animation immediately
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    const interval = setInterval(() => {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        // Update index after fade out
        setCurrentIndex((prevIndex) => (prevIndex + 1) % phrases.length);
        
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      });
    }, 5000); // Change every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [
          {
            translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0],
            }),
          },
        ],
        width: '100%',
        alignItems: 'center',
        paddingHorizontal: 20,
      }}
    >
      <MaskedView
        style={{ 
            width: '100%', 
            marginTop: 10,
            marginBottom: 20,
        }}
        maskElement={
          <Animated.Text style={styles.catchPhrase} numberOfLines={2}>
            {phrases[currentIndex]}
          </Animated.Text>
        }
      >
        <Animated.View style={{ width: '100%' }}>
          <LinearGradient
            colors={colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientContainer}
          />
        </Animated.View>
      </MaskedView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  catchPhrase: {
    fontSize: 45,
    fontWeight: 'bold',
    textAlign: 'center',
    fontFamily: 'Gotham Rounded',
    width: '100%',
    lineHeight: 50,
  },
  gradientContainer: {
    height: 100,
    width: '100%',
  },
});

export default AnimatedGradientText;