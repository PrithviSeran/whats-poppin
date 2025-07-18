import React, { useState, useEffect, memo } from 'react';
import { Image, View, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// OPTIMIZED: Image cache to prevent re-downloading
const imageCache = new Map<string, boolean>();
const preloadQueue = new Set<string>();

// Profile and banner image cache with timestamps
const profileImageCache = new Map<string, { url: string; timestamp: number }>();
const bannerImageCache = new Map<string, { url: string; timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface OptimizedImageProps {
  source: { uri: string } | number;
  style?: any;
  fallbackImages?: string[];
  onError?: () => void;
  placeholder?: boolean;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
}

const OptimizedImage = memo<OptimizedImageProps>(({ 
  source, 
  style, 
  fallbackImages = [], 
  onError,
  placeholder = true,
  resizeMode = 'cover'
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);

  const currentSource = typeof source === 'object' && source.uri 
    ? (currentSourceIndex === 0 ? source.uri : fallbackImages[currentSourceIndex - 1])
    : source;

  // OPTIMIZED: Check cache first
  useEffect(() => {
    if (typeof currentSource === 'string' && imageCache.has(currentSource)) {
      setIsLoading(false);
      return;
    }
  }, [currentSource]);

  // Check profile/banner image cache
  useEffect(() => {
    if (typeof currentSource === 'string') {
      const now = Date.now();
      
      // Check profile image cache
      const profileCacheEntry = profileImageCache.get(currentSource);
      if (profileCacheEntry && (now - profileCacheEntry.timestamp) < CACHE_DURATION) {
        setIsLoading(false);
        return;
      }
      
      // Check banner image cache
      const bannerCacheEntry = bannerImageCache.get(currentSource);
      if (bannerCacheEntry && (now - bannerCacheEntry.timestamp) < CACHE_DURATION) {
        setIsLoading(false);
        return;
      }
    }
  }, [currentSource]);

  // OPTIMIZED: Preload next images in background
  useEffect(() => {
    if (fallbackImages.length > 0 && typeof source === 'object') {
      fallbackImages.forEach(uri => {
        if (!preloadQueue.has(uri) && !imageCache.has(uri)) {
          preloadQueue.add(uri);
          Image.prefetch(uri).then(() => {
            imageCache.set(uri, true);
            preloadQueue.delete(uri);
          }).catch(() => {
            preloadQueue.delete(uri);
          });
        }
      });
    }
  }, [fallbackImages, source]);

  const handleLoad = () => {
    setIsLoading(false);
    if (typeof currentSource === 'string') {
      imageCache.set(currentSource, true);
      
      // Cache profile and banner images with timestamp
      const now = Date.now();
      if (currentSource.includes('profile')) {
        profileImageCache.set(currentSource, { url: currentSource, timestamp: now });
      } else if (currentSource.includes('banner')) {
        bannerImageCache.set(currentSource, { url: currentSource, timestamp: now });
      }
    }
  };

  const handleError = () => {
    console.log(`Image failed to load: ${currentSource}`);
    
    // Try next fallback image
    if (currentSourceIndex < fallbackImages.length) {
      setCurrentSourceIndex(prev => prev + 1);
      setHasError(false);
      setIsLoading(true);
    } else {
      setHasError(true);
      setIsLoading(false);
      onError?.();
    }
  };

  if (hasError) {
    return (
      <View style={[style, styles.errorContainer]}>
        <Ionicons name="image-outline" size={32} color="#666" />
      </View>
    );
  }

  return (
    <View style={[style, { position: 'relative', overflow: 'hidden' }]}>
      <Image
        source={typeof currentSource === 'string' ? { uri: currentSource } : currentSource}
        style={[StyleSheet.absoluteFill, { opacity: isLoading ? 0 : 1 }]}
        onLoad={handleLoad}
        onError={handleError}
        resizeMode={resizeMode}
      />
      {isLoading && placeholder && (
        <View style={[StyleSheet.absoluteFill, styles.loadingContainer]}>
          <ActivityIndicator size="small" color="#666" />
        </View>
      )}
    </View>
  );
});

OptimizedImage.displayName = 'OptimizedImage';

const styles = StyleSheet.create({
  errorContainer: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    backgroundColor: '#f8f8f8',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// Export cache clearing functions
export const clearProfileImageCache = () => {
  profileImageCache.clear();
  console.log('🧹 Profile image cache cleared');
};

export const clearBannerImageCache = () => {
  bannerImageCache.clear();
  console.log('🧹 Banner image cache cleared');
};

export const clearAllImageCache = () => {
  imageCache.clear();
  profileImageCache.clear();
  bannerImageCache.clear();
  preloadQueue.clear();
  console.log('🧹 All image cache cleared');
};

export default OptimizedImage; 