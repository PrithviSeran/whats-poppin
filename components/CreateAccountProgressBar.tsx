import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

const { width } = Dimensions.get('window');

interface CreateAccountProgressBarProps {
  currentStep: number;
  totalSteps: number;
  stepLabels?: string[];
}

export default function CreateAccountProgressBar({ 
  currentStep, 
  totalSteps, 
  stepLabels = [] 
}: CreateAccountProgressBarProps) {
  const colorScheme = useColorScheme();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate progress bar
    Animated.timing(progressAnim, {
      toValue: currentStep / totalSteps,
      duration: 600,
      useNativeDriver: false,
    }).start();

    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [currentStep, totalSteps]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Step indicator */}
      <View style={styles.stepIndicatorContainer}>
        <Text style={[styles.stepText, { color: Colors[colorScheme ?? 'light'].text }]}>
          Step {currentStep} of {totalSteps}
        </Text>
        {stepLabels[currentStep - 1] && (
          <Text style={[styles.stepLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
            {stepLabels[currentStep - 1]}
          </Text>
        )}
      </View>

      {/* Progress bar background */}
      <View style={[
        styles.progressBarBackground,
        { backgroundColor: colorScheme === 'dark' ? '#333' : '#E5E5E7' }
      ]}>
        {/* Animated progress fill */}
        <Animated.View style={[styles.progressBarContainer, { width: progressWidth }]}>
          <LinearGradient
            colors={['#FF0005', '#FF4D9D', '#FF69E2', '#B97AFF', '#9E95BD']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            locations={[0, 0.25, 0.5, 0.75, 1]}
            style={styles.progressBarFill}
          />
        </Animated.View>
      </View>

      {/* Progress percentage */}
      <Text style={[styles.progressPercentage, { color: Colors[colorScheme ?? 'light'].text }]}>
        {Math.round((currentStep / totalSteps) * 100)}% Complete
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    marginTop: 10,
  },
  stepIndicatorContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  stepText: {
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.8,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.6,
    marginTop: 2,
  },
  progressBarBackground: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarContainer: {
    height: '100%',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercentage: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.7,
  },
}); 