import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Image, View, ActivityIndicator, StyleSheet, ImageStyle, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface OptimizedImageProps {
  eventId?: number;
  imageUrl?: string | null;
  style?: ImageStyle;
  containerStyle?: ViewStyle;
  placeholder?: React.ReactNode;
  fallback?: React.ReactNode;
  lazy?: boolean;
  priority?: 'high' | 'normal' | 'low';
}

// Global image cache to prevent re-downloading
const IMAGE_CACHE = new Map<string, { 
  loaded: boolean; 
  error: boolean; 
  timestamp: number;
}>();

const IMAGE_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Lazy loading intersection observer equivalent for React Native
class ImageLoadQueue {
  private static instance: ImageLoadQueue;
  private highPriorityQueue: string[] = [];
  private normalPriorityQueue: string[] = [];
  private lowPriorityQueue: string[] = [];
  private processing = false;
  private concurrent = 3; // Load max 3 images concurrently

  static getInstance(): ImageLoadQueue {
    if (!ImageLoadQueue.instance) {
      ImageLoadQueue.instance = new ImageLoadQueue();
    }
    return ImageLoadQueue.instance;
  }

  addToQueue(url: string, priority: 'high' | 'normal' | 'low' = 'normal') {
    switch (priority) {
      case 'high':
        if (!this.highPriorityQueue.includes(url)) {
          this.highPriorityQueue.push(url);
        }
        break;
      case 'low':
        if (!this.lowPriorityQueue.includes(url)) {
          this.lowPriorityQueue.push(url);
        }
        break;
      default:
        if (!this.normalPriorityQueue.includes(url)) {
          this.normalPriorityQueue.push(url);
        }
    }
    this.processQueue();
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    const getNextUrl = (): string | null => {
      return this.highPriorityQueue.shift() || 
             this.normalPriorityQueue.shift() || 
             this.lowPriorityQueue.shift() || 
             null;
    };

    const promises: Promise<void>[] = [];
    
    for (let i = 0; i < this.concurrent; i++) {
      const url = getNextUrl();
      if (url) {
        promises.push(this.preloadImage(url));
      }
    }

    await Promise.all(promises);
    this.processing = false;

    // Continue processing if there are more items
    if (this.highPriorityQueue.length || this.normalPriorityQueue.length || this.lowPriorityQueue.length) {
      this.processQueue();
    }
  }

  private async preloadImage(url: string): Promise<void> {
    return new Promise((resolve) => {
      Image.prefetch(url)
        .then(() => {
          IMAGE_CACHE.set(url, {
            loaded: true,
            error: false,
            timestamp: Date.now()
          });
        })
        .catch(() => {
          IMAGE_CACHE.set(url, {
            loaded: false,
            error: true,
            timestamp: Date.now()
          });
        })
        .finally(() => resolve());
    });
  }
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  eventId,
  imageUrl,
  style,
  containerStyle,
  placeholder,
  fallback,
  lazy = true,
  priority = 'normal'
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [inView, setInView] = useState(!lazy);
  const mountedRef = useRef(true);
  const imageQueue = useRef(ImageLoadQueue.getInstance()).current;

  // Generate optimized image URL
  const optimizedImageUrl = useMemo(() => {
    if (imageUrl) return imageUrl;
    if (!eventId) return null;
    
    const randomIndex = Math.floor(Math.random() * 5);
    return `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/event-images/${eventId}/${randomIndex}.jpg`;
  }, [eventId, imageUrl]);

  // Check cache status
  const cacheStatus = useMemo(() => {
    if (!optimizedImageUrl) return null;
    
    const cached = IMAGE_CACHE.get(optimizedImageUrl);
    if (!cached) return null;
    
    // Check if cache is expired
    if (Date.now() - cached.timestamp > IMAGE_CACHE_TTL) {
      IMAGE_CACHE.delete(optimizedImageUrl);
      return null;
    }
    
    return cached;
  }, [optimizedImageUrl]);

  // Handle image load
  const handleImageLoad = useCallback(() => {
    if (!mountedRef.current) return;
    
    setLoading(false);
    setError(false);
    
    if (optimizedImageUrl) {
      IMAGE_CACHE.set(optimizedImageUrl, {
        loaded: true,
        error: false,
        timestamp: Date.now()
      });
    }
  }, [optimizedImageUrl]);

  // Handle image error
  const handleImageError = useCallback(() => {
    if (!mountedRef.current) return;
    
    setLoading(false);
    setError(true);
    
    if (optimizedImageUrl) {
      IMAGE_CACHE.set(optimizedImageUrl, {
        loaded: false,
        error: true,
        timestamp: Date.now()
      });
    }
  }, [optimizedImageUrl]);

  // Effect for lazy loading
  useEffect(() => {
    if (lazy && optimizedImageUrl) {
      // Simulate intersection observer by immediately setting inView
      // In a real implementation, you'd use an intersection observer library
      const timer = setTimeout(() => {
        if (mountedRef.current) {
          setInView(true);
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [lazy, optimizedImageUrl]);

  // Effect for image preloading
  useEffect(() => {
    if (inView && optimizedImageUrl && !cacheStatus) {
      imageQueue.addToQueue(optimizedImageUrl, priority);
    }
  }, [inView, optimizedImageUrl, cacheStatus, priority, imageQueue]);

  // Effect for cleanup
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Early return for no image
  if (!optimizedImageUrl) {
    return (
      <View style={[styles.container, containerStyle]}>
        {fallback || (
          <View style={[styles.placeholder, style]}>
            <Ionicons name="image-outline" size={40} color="#666" />
          </View>
        )}
      </View>
    );
  }

  // If cached as error, show fallback
  if (cacheStatus?.error) {
    return (
      <View style={[styles.container, containerStyle]}>
        {fallback || (
          <View style={[styles.placeholder, style]}>
            <Ionicons name="image-outline" size={40} color="#666" />
            <Text style={styles.errorText}>No Image Found</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, containerStyle]}>
      {inView ? (
        <>
          <Image
            source={{ uri: optimizedImageUrl }}
            style={style}
            onLoad={handleImageLoad}
            onError={handleImageError}
            fadeDuration={200}
          />
          {loading && (
            <View style={[styles.loadingOverlay, style]}>
              {placeholder || <ActivityIndicator size="small" color="#9E95BD" />}
            </View>
          )}
        </>
      ) : (
        <View style={[styles.placeholder, style]}>
          {placeholder || <ActivityIndicator size="small" color="#9E95BD" />}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  placeholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(240, 240, 240, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#666',
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
  },
});

export default OptimizedImage; 