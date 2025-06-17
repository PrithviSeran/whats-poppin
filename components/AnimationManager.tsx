import { useRef, useCallback, useEffect } from 'react';
import { Animated } from 'react-native';

interface AnimationConfig {
  duration: number;
  useNativeDriver: boolean;
  tension?: number;
  friction?: number;
}

class AnimationManager {
  private static instance: AnimationManager;
  private activeAnimations: Set<Animated.CompositeAnimation> = new Set();
  private animatedValues: Map<string, Animated.Value> = new Map();

  static getInstance(): AnimationManager {
    if (!AnimationManager.instance) {
      AnimationManager.instance = new AnimationManager();
    }
    return AnimationManager.instance;
  }

  // Get or create animated value with caching
  getAnimatedValue(key: string, initialValue: number = 0): Animated.Value {
    if (!this.animatedValues.has(key)) {
      this.animatedValues.set(key, new Animated.Value(initialValue));
    }
    return this.animatedValues.get(key)!;
  }

  // Optimized fade animation with cleanup
  createFadeAnimation(
    animatedValue: Animated.Value,
    toValue: number,
    config: AnimationConfig = { duration: 300, useNativeDriver: true }
  ): Promise<void> {
    return new Promise((resolve) => {
      const animation = Animated.timing(animatedValue, {
        toValue,
        ...config,
      });

      this.activeAnimations.add(animation);
      
      animation.start((finished) => {
        this.activeAnimations.delete(animation);
        if (finished) resolve();
      });
    });
  }

  // Optimized spring animation
  createSpringAnimation(
    animatedValue: Animated.Value,
    toValue: number,
    config: AnimationConfig = { 
      tension: 40, 
      friction: 8, 
      useNativeDriver: true,
      duration: 300 
    }
  ): Promise<void> {
    return new Promise((resolve) => {
      const animation = Animated.spring(animatedValue, {
        toValue,
        ...config,
      });

      this.activeAnimations.add(animation);
      
      animation.start((finished) => {
        this.activeAnimations.delete(animation);
        if (finished) resolve();
      });
    });
  }

  // Batch animations for better performance
  createParallelAnimation(animations: Animated.CompositeAnimation[]): Promise<void> {
    return new Promise((resolve) => {
      const parallelAnim = Animated.parallel(animations);
      this.activeAnimations.add(parallelAnim);
      
      parallelAnim.start((finished) => {
        this.activeAnimations.delete(parallelAnim);
        if (finished) resolve();
      });
    });
  }

  // Stop all animations and cleanup
  stopAllAnimations(): void {
    this.activeAnimations.forEach(animation => {
      animation.stop();
    });
    this.activeAnimations.clear();
  }

  // Cleanup specific animated value
  cleanupAnimatedValue(key: string): void {
    const animatedValue = this.animatedValues.get(key);
    if (animatedValue) {
      animatedValue.stopAnimation();
      this.animatedValues.delete(key);
    }
  }

  // Get active animation count for debugging
  getActiveAnimationCount(): number {
    return this.activeAnimations.size;
  }
}

// React hook for using the animation manager
export const useOptimizedAnimations = () => {
  const animationManager = useRef(AnimationManager.getInstance()).current;
  const componentAnimations = useRef<Set<string>>(new Set()).current;

  const createFadeAnimation = useCallback((
    key: string,
    toValue: number,
    config?: AnimationConfig
  ) => {
    const animatedValue = animationManager.getAnimatedValue(key);
    componentAnimations.add(key);
    return animationManager.createFadeAnimation(animatedValue, toValue, config);
  }, [animationManager, componentAnimations]);

  const createSpringAnimation = useCallback((
    key: string,
    toValue: number,
    config?: AnimationConfig
  ) => {
    const animatedValue = animationManager.getAnimatedValue(key);
    componentAnimations.add(key);
    return animationManager.createSpringAnimation(animatedValue, toValue, config);
  }, [animationManager, componentAnimations]);

  const getAnimatedValue = useCallback((key: string, initialValue?: number) => {
    componentAnimations.add(key);
    return animationManager.getAnimatedValue(key, initialValue);
  }, [animationManager, componentAnimations]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      componentAnimations.forEach(key => {
        animationManager.cleanupAnimatedValue(key);
      });
      componentAnimations.clear();
    };
  }, [animationManager, componentAnimations]);

  return {
    createFadeAnimation,
    createSpringAnimation,
    getAnimatedValue,
    stopAllAnimations: () => animationManager.stopAllAnimations(),
    activeAnimationCount: animationManager.getActiveAnimationCount(),
  };
};

export default AnimationManager; 