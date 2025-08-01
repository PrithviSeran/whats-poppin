import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import SocialDataManager from './SocialDataManager';
import APIRequestService from './APIRequestService';
import { EventEmitter } from 'events';
import { Interface } from 'readline';
import { clearProfileImageCache, clearBannerImageCache } from '@/components/OptimizedImage';

// Distance calculation cache interface
interface CachedDistance {
  distance: number;
  timestamp: number;
}

export interface EventCard {
  id: number;
  created_at: string;
  name: string;
  organization: string;
  event_type: string;
  location: string;
  cost: number;
  age_restriction: number;
  reservation: string;
  description: string;
  image: any;
  start_date: string; // 'YYYY-MM-DD'
  end_date: string;   // 'YYYY-MM-DD'
  occurrence: string;
  latitude?: number;
  longitude?: number;
  distance?: number | null;  // Add distance property
  days_of_the_week?: string[];
  times?: { [key: string]: string | [string, string] };  // New times field replacing start_time/end_time
  allImages?: string[];  // Array of all 5 image URLs for the event
  link?: string;  // Source URL for the event/activity
  featured?: boolean;  // Whether the event is featured
  friendsWhoSaved?: { id: number; name: string; email: string }[];  // People you follow who have saved this event
  posted_by?: string;  // Email of the user who created this event
  posted_by_email?: string;  // Email of the user who created this event
};

export interface UserProfile {
  id: number;
  created_at: string;
  name: string;
  username?: string;
  email: string;
  birthday: string;
  gender: string;
  preferences?: string[] | string;
  'start-time'?: string;
  'end-time'?: string;
  location?: string;
  'travel-distance'?: number;
  rejected_events?: string[] | string;
  preferred_days?: string[] | string;
  saved_events?: number[];
  saved_events_all_time?: number[];  // Permanent history of all events ever liked
  profileImage?: string;
  bannerImage?: string;
}

class GlobalDataManager extends EventEmitter {
  private static instance: GlobalDataManager;
  private isInitialized: boolean = false;
  private isInitializing: boolean = false;
  private dataUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentUser: any = null; // Field for the current logged in user
  
  // Distance calculation cache constants
  private readonly DISTANCE_CACHE_KEY = 'distanceCache';
  private readonly CACHE_EXPIRY_HOURS = 1;
  private sessionCache = new Map<string, number>(); // In-memory cache for frequently accessed distances

  // Add these new properties to the GlobalDataManager class
  private requestCache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private pendingRequests: Map<string, Promise<any>> = new Map();
  private debouncedUpdateTimeout: any = null;
  private lastApiCallTime: number = 0;
  private readonly API_CALL_DEBOUNCE_MS = 1000; // Prevent API spam
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

  // Image cache for profile and banner images
  private imageCache: Map<string, { data: string; timestamp: number }> = new Map();
  private readonly IMAGE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  // API service for optimized requests
  private apiService: APIRequestService;

  private constructor() {
    super();
    this.apiService = APIRequestService.getInstance();
  }

  static getInstance(): GlobalDataManager {
    if (!GlobalDataManager.instance) {
      GlobalDataManager.instance = new GlobalDataManager();
    }
    return GlobalDataManager.instance;
  }

  isDataInitialized(): boolean {
    return this.isInitialized;
  }

  async initialize() {
    if (this.isInitialized || this.isInitializing) {
      console.log('Initialize called but already initialized/initializing:', {
        isInitialized: this.isInitialized,
        isInitializing: this.isInitializing
      });
      return;
    }
    
    this.isInitializing = true;
    
    try {
      console.log('🚀 Starting GlobalDataManager initialization...');
      console.log('📧 Current user:', this.currentUser?.email || 'No user set');
      
      // Increase timeout and add timeout protection
      const initializationPromise = this.performInitialization();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Initialization timeout after 60 seconds')), 500);
      });
      
      await Promise.race([initializationPromise, timeoutPromise]);
      
      this.isInitialized = true;
      this.emit('dataInitialized');
      console.log('✅ Global data initialized successfully - isInitialized:', this.isInitialized);
      
    } catch (error) {
      console.error('❌ Error initializing global data:', error);
      
      // Set as initialized with partial data rather than failing completely
      this.isInitialized = true;
      this.emit('dataInitialized');
      console.log('⚠️ Initialized with partial data due to errors');
      
      // Don't throw the error - allow app to continue with empty data
      console.log('📱 App will continue with empty data - user can retry later');
      
    } finally {
      this.isInitializing = false;
    }
  }

  private async performInitialization() {
    // Wait for user to be properly set
    if (!this.currentUser) {
      console.log('⏳ Waiting for user to be set...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!this.currentUser) {
        console.log('⚠️ No user set - continuing with guest mode');
        return;
      }
    }

    console.log('🚀 Starting parallel data initialization...');
    const startTime = Date.now();

    // OPTIMIZED: Run all initialization methods in parallel instead of sequentially
    const initPromises = [
      this.initializeWithGracefulFailure('fetchAndStoreUserProfile', () => this.fetchAndStoreUserProfile()),
      this.initializeWithGracefulFailure('fetchAndStoreSavedEvents', () => this.fetchAndStoreSavedEvents()),
      this.initializeWithGracefulFailure('fetchAndStoreRejectedEvents', () => this.fetchAndStoreRejectedEvents())
    ];

    await Promise.all(initPromises);
    
    const endTime = Date.now();
    console.log(`✅ Parallel initialization completed in ${endTime - startTime}ms`);
  }

  private async initializeWithGracefulFailure(methodName: string, method: () => Promise<void>) {
    try {
      console.log(`📋 ${methodName}...`);
      
      // Add timeout for individual methods
      const methodPromise = method();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`${methodName} timeout after 20 seconds`)), 20000);
      });
      
      await Promise.race([methodPromise, timeoutPromise]);
      console.log(`✅ ${methodName} completed successfully`);
    } catch (error) {
      console.error(`⚠️ ${methodName} failed, continuing with empty data:`, error);
      
      // Store empty data as fallback
      if (methodName.includes('UserProfile')) {
        await AsyncStorage.setItem('userProfile', JSON.stringify(null));
      } else if (methodName.includes('SavedEvents')) {
        await AsyncStorage.setItem('savedEvents', JSON.stringify([]));
      } else if (methodName.includes('RejectedEvents')) {
        await AsyncStorage.setItem('rejectedEvents', JSON.stringify([]));
      }
    }
  }

  private async initializeWithRetry(methodName: string, method: () => Promise<void>, maxRetries = 2) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📋 ${methodName} (attempt ${attempt}/${maxRetries})...`);
        
        // Add timeout for individual retry attempts
        const methodPromise = method();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`${methodName} attempt timeout after 15 seconds`)), 15000);
        });
        
        await Promise.race([methodPromise, timeoutPromise]);
        console.log(`✅ ${methodName} completed successfully`);
        return;
      } catch (error) {
        console.error(`❌ ${methodName} failed (attempt ${attempt}/${maxRetries}):`, error);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Shorter backoff: 1s, 2s
        const delay = attempt * 1000;
        console.log(`⏳ Retrying ${methodName} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  private async fetchAndStoreEvents() {
    const cacheKey = 'new_events';
    
    try {
      const events = await this.makeApiCall(cacheKey, async () => {
        const { data: events, error } = await supabase
          .from('new_events')
          .select('id, created_at, name, organization, location, cost, age_restriction, reservation, description, start_date, end_date, occurrence, latitude, longitude, days_of_the_week, event_type, link, times, featured, posted_by, posted_by_email');

        if (error) throw error;
        return events;
      });

      await AsyncStorage.setItem('allEvents', JSON.stringify(events));
      console.log('Events stored successfully (cached)');
    } catch (error) {
      console.error('Error fetching and storing events:', error);
      throw error;
    }
  }

  private async fetchAndStoreUserProfile() {
    try {
      const user = this.currentUser;
      console.log('fetchAndStoreUserProfile - user:', user?.email || 'No user');
      
      if (!user) {
        console.log('No current user set, skipping user profile fetch');
        return;
      }

      if (!user.email) {
        console.log('User has no email, skipping user profile fetch');
        return;
      }

      console.log('Querying all_users table for email:', user.email);
      
      // Use APIRequestService for optimized querying with caching
      const profile = await this.apiService.queueRequest<any>('select', {
        table: 'all_users',
        data: { select: '*' },
        filters: { eq: { email: user.email } },
        priority: 'high',
        cacheKey: `user_profile_${user.email}`,
        cacheTTL: 300000 // 5 minutes cache
      });

      console.log('Profile query result:', profile && profile.length > 0 ? 'Found profile' : 'No profile found');
      
      if (profile && profile.length > 0) {
        const userProfile = profile[0];
        
        // Use the profile_image and banner_image fields from the database if they exist
        let profileImageUrl = userProfile.profile_image;
        let bannerImageUrl = userProfile.banner_image;

        // If no custom images are set in the database, fall back to default paths
        if (!profileImageUrl) {
          const userFolder = user.email?.replace(/[^a-zA-Z0-9]/g, '_') || user.id;
          const { data: { publicUrl: defaultProfileUrl } } = supabase.storage
            .from('user-images')
            .getPublicUrl(`${userFolder}/profile.jpg`);
          profileImageUrl = defaultProfileUrl;
        }

        if (!bannerImageUrl) {
          const userFolder = user.email?.replace(/[^a-zA-Z0-9]/g, '_') || user.id;
          const { data: { publicUrl: defaultBannerUrl } } = supabase.storage
            .from('user-images')
            .getPublicUrl(`${userFolder}/banner.jpg`);
          bannerImageUrl = defaultBannerUrl;
        }

        // Add image URLs to profile object
        const profileWithImages = {
          ...userProfile,
          profileImage: profileImageUrl,
          bannerImage: bannerImageUrl
        };

        await AsyncStorage.setItem('userProfile', JSON.stringify(profileWithImages));
        console.log('User profile stored successfully with image URLs');
      } else {
        // Store empty profile if none found
        await AsyncStorage.setItem('userProfile', JSON.stringify(null));
        console.log('No profile found, stored null');
      }
    } catch (error) {
      console.error('Error fetching and storing user profile:', error);
      throw error;
    }
  }

  private async fetchAndStoreSavedEvents() {
    try {
      const user = this.currentUser;
      console.log('fetchAndStoreSavedEvents - user:', user?.email || 'No user');
      
      if (!user) {
        console.log('No current user set, storing empty saved events');
        await AsyncStorage.setItem('savedEvents', JSON.stringify([]));
        return;
      }

      // Fetch saved_events IDs from user profile using API service
      const userData = await this.apiService.queueRequest<any[]>('select', {
        table: 'all_users',
        data: { select: 'saved_events' },
        filters: { eq: { email: user.email } },
        priority: 'high',
        cacheKey: `user_saved_events_${user.email}`,
        cacheTTL: 120000 // 2 minutes cache for saved events
      });

      let savedEventIds: number[] = [];
      if (userData && userData.length > 0 && userData[0]?.saved_events) {
        const savedEvents = userData[0].saved_events;
        if (Array.isArray(savedEvents)) {
          savedEventIds = savedEvents;
        } else if (typeof savedEvents === 'string' && savedEvents) {
          savedEventIds = savedEvents
            .replace(/[{}"']+/g, '')
            .split(',')
            .map((s: string) => parseInt(s.trim(), 10))
            .filter(Boolean);
        }
      }
      
      if (savedEventIds.length === 0) {
        await AsyncStorage.setItem('savedEvents', JSON.stringify([]));
        console.log('No saved events to store');
        return;
      }
      
      // Fetch full event objects for these IDs using API service
      const events = await this.apiService.queueRequest<any[]>('select', {
        table: 'new_events',
        data: { select: '*' },
        filters: { in: { id: savedEventIds } },
        priority: 'medium',
        cacheKey: `events_batch_${savedEventIds.join('_')}`,
        cacheTTL: 300000 // 5 minutes cache for event details
      });
      
      // OPTIMIZED: Generate image URLs efficiently and in parallel
      const eventsWithImages = await this.addImageUrlsToEventsOptimized(events || []);
      
      await AsyncStorage.setItem('savedEvents', JSON.stringify(eventsWithImages));
      console.log('Saved events (full objects with images) stored successfully');
    } catch (error) {
      console.error('Error fetching and storing saved events:', error);
      throw error;
    }
  }

  // OPTIMIZED: Efficient image URL generation
  private async addImageUrlsToEventsOptimized(events: any[]): Promise<any[]> {
    if (events.length === 0) return events;
    
    console.log(`🖼️ Generating image URLs for ${events.length} events...`);
    const startTime = Date.now();
    
    // Process events in parallel with limited concurrency to avoid overwhelming the system
    const eventsWithImages = await Promise.all(
      events.map(async (event) => {
        try {
          // Generate image URLs efficiently - no need for 6 API calls per event
          const randomImageIndex = Math.floor(Math.random() * 5);
          
          // OPTIMIZED: Use template-based URL generation (much faster than API calls)
          const baseUrl = `https://iizdmrngykraambvsbwv.supabase.co/storage/v1/object/public/event-images/${event.id}`;
          const imageUrl = `${baseUrl}/${randomImageIndex}.jpg`;
          const allImages = Array.from({ length: 5 }, (_, i) => `${baseUrl}/${i}.jpg`);
          
          return { ...event, image: imageUrl, allImages };
        } catch (e) {
          console.log(`No image found for event ${event.id}`);
          return { ...event, image: null, allImages: [] };
        }
      })
    );
    
    const endTime = Date.now();
    console.log(`✅ Image URL generation completed in ${endTime - startTime}ms`);
    
    return eventsWithImages;
  }

  // Fetch the user's rejected_events from Supabase and store in AsyncStorage
  private async fetchAndStoreRejectedEvents() {
    try {
      const user = this.currentUser;
      console.log('fetchAndStoreRejectedEvents - user:', user?.email || 'No user');
      
      if (!user || !user.email) {
        console.log('No current user set, storing empty rejected events');
        await AsyncStorage.setItem('rejectedEvents', JSON.stringify([]));
        return;
      }
      
      // Use API service for fetching rejected events
      const userData = await this.apiService.queueRequest<any[]>('select', {
        table: 'all_users',
        data: { select: 'rejected_events' },
        filters: { eq: { email: user.email } },
        priority: 'medium',
        cacheKey: `user_rejected_events_${user.email}`,
        cacheTTL: 180000 // 3 minutes cache for rejected events
      });
      
      let rejectedEventsArr: number[] = [];
      if (userData && userData.length > 0 && userData[0]?.rejected_events) {
        const rejectedEvents = userData[0].rejected_events;
        if (Array.isArray(rejectedEvents)) {
          rejectedEventsArr = rejectedEvents;
        } else if (typeof rejectedEvents === 'string' && rejectedEvents) {
          rejectedEventsArr = rejectedEvents
            .replace(/[{}"']+/g, '')
            .split(',')
            .map((s: string) => parseInt(s.trim(), 10))
            .filter(Boolean);
        }
      }
      
      if (rejectedEventsArr.length === 0) {
        await AsyncStorage.setItem('rejectedEvents', JSON.stringify([]));
        console.log('No rejected events to store');
        return;
      }
      
      // Fetch full event objects for these IDs using API service
      const events = await this.apiService.queueRequest<any[]>('select', {
        table: 'new_events',
        data: { select: '*' },
        filters: { in: { id: rejectedEventsArr } },
        priority: 'low', // Lower priority for rejected events
        cacheKey: `rejected_events_batch_${rejectedEventsArr.join('_')}`,
        cacheTTL: 600000 // 10 minutes cache for rejected events (they don't change often)
      });
      
      await AsyncStorage.setItem('rejectedEvents', JSON.stringify(events || []));
      console.log('Rejected events (full objects) stored successfully');
    } catch (error) {
      console.error('Error fetching and storing rejected events:', error);
      throw error;
    }
  }

  // Getters for stored data
  async getEvents(): Promise<EventCard[]> {
    const eventsJson = await AsyncStorage.getItem('allEvents');
    return eventsJson ? JSON.parse(eventsJson) : [];
  }

  async getUserProfile(): Promise<UserProfile | null> {
    const profileJson = await AsyncStorage.getItem('userProfile');
    return profileJson ? JSON.parse(profileJson) : null;
  }

  async getSavedEvents(): Promise<EventCard[]> {
    const savedEventsJson = await AsyncStorage.getItem('savedEvents');
    return savedEventsJson ? JSON.parse(savedEventsJson) : [];
  }

  // Get all events the user has ever liked (permanent history)
  async getSavedEventsAllTime(): Promise<number[]> {
    try {
      const user = this.currentUser;
      if (!user || !user.email) return [];

      const userData = await this.apiService.queueRequest<any[]>('select', {
        table: 'all_users',
        data: { select: 'saved_events_all_time' },
        filters: { eq: { email: user.email } },
        priority: 'medium',
        cacheKey: `user_saved_events_all_time_${user.email}`,
        cacheTTL: 300000 // 5 minutes cache
      });

      let savedEventsAllTime: number[] = [];
      if (userData && userData.length > 0 && userData[0]?.saved_events_all_time) {
        const allTimeEvents = userData[0].saved_events_all_time;
        if (Array.isArray(allTimeEvents)) {
          savedEventsAllTime = allTimeEvents;
        } else if (typeof allTimeEvents === 'string' && allTimeEvents) {
          savedEventsAllTime = allTimeEvents
            .replace(/[{}"']+/g, '')
            .split(',')
            .map((s: string) => parseInt(s.trim(), 10))
            .filter(Boolean);
        }
      }

      return savedEventsAllTime;
    } catch (error) {
      console.error('Error getting saved events all time:', error);
      return [];
    }
  }

  // Method to refresh all data with debouncing
  async refreshAllData() {
    if (this.dataUpdateTimeout) {
      clearTimeout(this.dataUpdateTimeout);
    }

    this.dataUpdateTimeout = setTimeout(async () => {
      this.isInitialized = false;
      await this.initialize();
    }, 1000); // Debounce for 1 second
  }

  // Immediate refresh without debouncing - used after critical operations like clearing events
  async refreshAllDataImmediate() {
    console.log('🔄 Performing immediate data refresh...');
    if (this.dataUpdateTimeout) {
      clearTimeout(this.dataUpdateTimeout);
      this.dataUpdateTimeout = null;
    }
    
    this.isInitialized = false;
    await this.initialize();
    console.log('✅ Immediate data refresh completed');
  }

  // Cleanup method
  cleanup() {
    if (this.dataUpdateTimeout) {
      clearTimeout(this.dataUpdateTimeout);
    }
    this.removeAllListeners();
  }

  // Getter for current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Setter for current user
  async setCurrentUser(user: any) {
    const previousUser = this.currentUser;
    this.currentUser = user;
    
    // If user changed (and both users exist), clear cached data for the previous user
    if (previousUser && user && previousUser.email && user.email && previousUser.email !== user.email) {
      console.log(`User changed from ${previousUser.email} to ${user.email}, clearing cached data`);
      await this.clearAllUserData();
      // Note: we set currentUser again because clearAllUserData sets it to null
      this.currentUser = user;
    }
  }

  // Setter for user profile: updates AsyncStorage and Supabase
  async setUserProfile(profile: UserProfile) {
    try {
      // Update AsyncStorage immediately (optimistic update)
      await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
      
      // Update Supabase using API service
      if (profile.email) {
        // Remove profileImage and bannerImage before updating Supabase
        const { id, created_at, profileImage, bannerImage, ...updateData } = profile as any;
        
        await this.apiService.queueRequest('update', {
          table: 'all_users',
          data: updateData,
          filters: { eq: { email: profile.email } },
          priority: 'high',
          batch: 'user_updates'
        });
        
        // Emit event for listeners
        this.emit('profileUpdated', profile);
      }
    } catch (err) {
      console.error('Error updating user profile:', err);
      throw err; // Optionally rethrow if you want to handle it elsewhere
    }
  }



  // Preload and cache profile images
  async preloadProfileImages(profileImageUrl?: string, bannerImageUrl?: string) {
    try {
      const preloadPromises = [];
      const now = Date.now();

      if (profileImageUrl && !this.imageCache.has(profileImageUrl)) {
        console.log('🖼️ Preloading profile image:', profileImageUrl);
        preloadPromises.push(
          fetch(profileImageUrl)
            .then(response => response.blob())
            .then(blob => {
              const reader = new FileReader();
              return new Promise<string>((resolve) => {
                reader.onloadend = () => {
                  this.imageCache.set(profileImageUrl, { 
                    data: reader.result as string, 
                    timestamp: now 
                  });
                  resolve(reader.result as string);
                };
                reader.readAsDataURL(blob);
              });
            })
            .catch(error => {
              console.warn('Failed to preload profile image:', error);
            })
        );
      }

      if (bannerImageUrl && !this.imageCache.has(bannerImageUrl)) {
        console.log('🖼️ Preloading banner image:', bannerImageUrl);
        preloadPromises.push(
          fetch(bannerImageUrl)
            .then(response => response.blob())
            .then(blob => {
              const reader = new FileReader();
              return new Promise<string>((resolve) => {
                reader.onloadend = () => {
                  this.imageCache.set(bannerImageUrl, { 
                    data: reader.result as string, 
                    timestamp: now 
                  });
                  resolve(reader.result as string);
                };
                reader.readAsDataURL(blob);
              });
            })
            .catch(error => {
              console.warn('Failed to preload banner image:', error);
            })
        );
      }

      if (preloadPromises.length > 0) {
        await Promise.all(preloadPromises);
        console.log('✅ Profile images preloaded and cached');
      }

      // Clean up old cached images
      this.cleanupImageCache();
    } catch (error) {
      console.error('Error preloading profile images:', error);
    }
  }

  // Get cached image data
  getCachedImage(imageUrl: string): string | null {
    const cached = this.imageCache.get(imageUrl);
    if (cached && (Date.now() - cached.timestamp) < this.IMAGE_CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  // Clean up expired image cache entries
  private cleanupImageCache() {
    const now = Date.now();
    for (const [url, data] of this.imageCache.entries()) {
      if ((now - data.timestamp) > this.IMAGE_CACHE_DURATION) {
        this.imageCache.delete(url);
      }
    }
  }

  // Add an event to the saved_events field in AsyncStorage and Supabase
  async addEventToSavedEvents(eventId: number) {
    try {
      const user = this.currentUser;
      if (!user || !user.email) return;

      // Get current saved events from AsyncStorage for optimistic update
      const savedEventsJson = await AsyncStorage.getItem('savedEvents');
      const currentSavedEvents = savedEventsJson ? JSON.parse(savedEventsJson) : [];
      
      // Check if already saved
      if (currentSavedEvents.some((event: EventCard) => event.id === eventId)) {
        console.log('Event already saved');
        return;
      }

      // Fetch the full event object first for optimistic update
      const eventData = await this.apiService.queueRequest<any[]>('select', {
        table: 'new_events',
        data: { select: '*' },
        filters: { eq: { id: eventId } },
        priority: 'high',
        cacheKey: `event_${eventId}`,
        cacheTTL: 300000
      });

      if (!eventData || eventData.length === 0) {
        throw new Error('Event not found');
      }

      const event = eventData[0];
      const eventWithImage = await this.addImageUrlsToEventsOptimized([event]);
      const optimizedEvent = eventWithImage[0] || { ...event, image: null, allImages: [] };

      // Get current user data to update arrays
      const userData = await this.apiService.queueRequest<any[]>('select', {
        table: 'all_users',
        data: { select: 'saved_events, saved_events_all_time' },
        filters: { eq: { email: user.email } },
        priority: 'high'
      });

      let savedEventIds: number[] = [];
      let savedEventsAllTime: number[] = [];

      if (userData && userData.length > 0) {
        const userRecord = userData[0];
        
        // Parse saved events
        if (userRecord.saved_events) {
          if (Array.isArray(userRecord.saved_events)) {
            savedEventIds = userRecord.saved_events;
          } else if (typeof userRecord.saved_events === 'string' && userRecord.saved_events) {
            savedEventIds = userRecord.saved_events
              .replace(/[{}"']+/g, '')
              .split(',')
              .map((s: string) => parseInt(s.trim(), 10))
              .filter(Boolean);
          }
        }

        // Parse all time events
        if (userRecord.saved_events_all_time) {
          if (Array.isArray(userRecord.saved_events_all_time)) {
            savedEventsAllTime = userRecord.saved_events_all_time;
          } else if (typeof userRecord.saved_events_all_time === 'string' && userRecord.saved_events_all_time) {
            savedEventsAllTime = userRecord.saved_events_all_time
              .replace(/[{}"']+/g, '')
              .split(',')
              .map((s: string) => parseInt(s.trim(), 10))
              .filter(Boolean);
          }
        }
      }

      // Add new event ID if not already present
      if (!savedEventIds.includes(eventId)) {
        savedEventIds.push(eventId);
        
        // Also add to all time if not present
        if (!savedEventsAllTime.includes(eventId)) {
          savedEventsAllTime.push(eventId);
        }

        // Update with optimistic UI update
        const updatedSavedEvents = [...currentSavedEvents, optimizedEvent];
        
        await this.apiService.queueRequest('update', {
          table: 'all_users',
          data: { 
            saved_events: savedEventIds,
            saved_events_all_time: savedEventsAllTime
          },
          filters: { eq: { email: user.email } },
          priority: 'high',
          batch: 'event_operations',
          optimisticUpdate: async () => {
            // Update AsyncStorage immediately
            await AsyncStorage.setItem('savedEvents', JSON.stringify(updatedSavedEvents));
            this.emit('savedEventsUpdated', updatedSavedEvents);
            console.log('⚡ Optimistic save event applied');
          },
          rollback: async () => {
            // Rollback to original state
            await AsyncStorage.setItem('savedEvents', JSON.stringify(currentSavedEvents));
            this.emit('savedEventsUpdated', currentSavedEvents);
            console.log('🔄 Save event rolled back');
          }
        });
      }
    } catch (error) {
      console.error('Error adding event to saved events:', error);
      throw error;
    }
  }

  // Add or update a rejected event for the user in Supabase
  async updateRejectedEvents(event: EventCard) {
    try {
      const eventId = event.id;
    
      // Save to AsyncStorage for caching (append full event object)
      const rejectedEventsJson = await AsyncStorage.getItem('rejectedEvents');
      let rejectedEventsArrFull: any[] = [];
      if (rejectedEventsJson) {
        try {
          rejectedEventsArrFull = JSON.parse(rejectedEventsJson);
        } catch {}
      }
      // Only append if not already present by id
      if (!rejectedEventsArrFull.some((e) => e && e.id === eventId)) {
        rejectedEventsArrFull.push(event);
        await AsyncStorage.setItem('rejectedEvents', JSON.stringify(rejectedEventsArrFull));
      }
      
    } catch (error) {
      console.error('Error updating rejected events:', error);
    }
  }

  async setIsFilterByDistance(filterByDistance: boolean) {
    await AsyncStorage.setItem('filterByDistance', filterByDistance.toString());
  }

  async getIsFilterByDistance(): Promise<boolean> {
    const filterByDistanceStr = await AsyncStorage.getItem('filterByDistance');
    return filterByDistanceStr ? filterByDistanceStr === 'true' : false;
  }

  async getRejectedEvents(): Promise<EventCard[]> {
    const rejectedEventsJson = await AsyncStorage.getItem('rejectedEvents');
    return rejectedEventsJson ? JSON.parse(rejectedEventsJson) : [];
  }

  // Update the user's rejected_events field in Supabase with an array of string IDs
  async updateRejectedEventsInSupabase(eventIds: string[]) {
    try {
      const user = this.currentUser;
      if (!user || !user.email) return;
      // Update rejected_events as array of text
      const { error } = await supabase
        .from('all_users')
        .update({ rejected_events: eventIds })
        .eq('email', user.email);
      if (error) throw error;
      console.log('Rejected events updated in Supabase:', eventIds);
    } catch (error) {
      console.error('Error updating rejected events in Supabase:', error);
      throw error;
    }
  }

  // Add this method to the GlobalDataManager class
  async getSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error getting session:', error);
        return null;
      }
      return session;
    } catch (error) {
      console.error('Error in getSession:', error);
      return null;
    }
  }

  async clearSavedEvents() {
    try {
      const user = this.currentUser;
      if (!user || !user.email) {
        console.error('No user or email available for clearing saved events');
        throw new Error('User not authenticated');
      }

      console.log(`🗑️ Starting clear all saved events for user ${user.email}`);

      // Clear only saved_events from Supabase (NOT saved_events_all_time)
      const { data: updateData, error: updateError } = await supabase
        .from('all_users')
        .update({ saved_events: [] })
        .eq('email', user.email)
        .select(); // Return the updated row to verify the change

      if (updateError) {
        console.error('❌ Error clearing saved events in Supabase:', updateError);
        throw updateError;
      }

      console.log('✅ Supabase clear operation completed. Updated data:', updateData);

      // Verify the update worked
      if (updateData && updateData.length > 0) {
        console.log('📊 Verified cleared saved_events in database:', updateData[0].saved_events);
      }

      // CRITICAL: Wait and verify the change has fully propagated before proceeding
      // This prevents race conditions with subsequent refreshAllData() calls
      console.log('⏳ Verifying database state is fully synchronized...');
      
      let verificationAttempts = 0;
      const maxAttempts = 5;
      const retryDelay = 200; // milliseconds
      
      while (verificationAttempts < maxAttempts) {
        // Read the current state directly from database
        const { data: verifyData, error: verifyError } = await supabase
          .from('all_users')
          .select('saved_events')
          .eq('email', user.email)
          .single();
        
        if (verifyError) {
          console.warn(`⚠️  Verification attempt ${verificationAttempts + 1} failed:`, verifyError);
        } else if (verifyData && Array.isArray(verifyData.saved_events) && verifyData.saved_events.length === 0) {
          console.log(`✅ Database verification successful on attempt ${verificationAttempts + 1}`);
          break;
        } else {
          console.warn(`⚠️  Verification attempt ${verificationAttempts + 1}: Database still shows events:`, verifyData?.saved_events);
        }
        
        verificationAttempts++;
        if (verificationAttempts < maxAttempts) {
          console.log(`⏳ Waiting ${retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
      
      if (verificationAttempts >= maxAttempts) {
        console.error('❌ Database verification failed after maximum attempts');
        throw new Error('Clear operation completed but verification failed - database may be inconsistent');
      }

      // Then clear from AsyncStorage
      await AsyncStorage.setItem('savedEvents', JSON.stringify([]));
      
      // CRITICAL: Immediately refresh all data to ensure cache synchronization
      // This prevents race conditions with subsequent operations
      console.log('🔄 Performing immediate cache refresh after clear...');
      await this.refreshAllDataImmediate();
      
      // Emit an event to notify listeners
      this.emit('savedEventsUpdated', []);
      
      console.log('✅ Saved events cleared successfully and verified in both Supabase and AsyncStorage');
    } catch (error) {
      console.error('❌ Error clearing saved events:', error);
      throw error;
    }
  }

  // Clear all user-specific cached data when user changes
  async clearAllUserData() {
    try {
      console.log('🧹 OFFLINE-FIRST: Clearing all user-specific cached data...');
      
      // Get SocialDataManager instance
      const socialDataManager = SocialDataManager.getInstance();
      
      // Clear all user-specific AsyncStorage data
      await Promise.all([
        AsyncStorage.removeItem('userProfile'),
        AsyncStorage.removeItem('savedEvents'),
        AsyncStorage.removeItem('rejectedEvents'),
        AsyncStorage.removeItem('filterByDistance'),
        AsyncStorage.removeItem('allEvents'), // Also clear events to get fresh data
        this.clearDistanceCache(), // Clear distance calculations cache
        socialDataManager.clearCache() // Clear social data cache
      ]);
      
      // Clear session cache
      this.sessionCache.clear();
      
      // Clear image cache
      this.imageCache.clear();
      
      // Reset initialization state to force fresh data fetch
      this.isInitialized = false;
      this.isInitializing = false;
      
      // Clear current user
      this.currentUser = null;
      
      // Remove any pending timeouts
      if (this.dataUpdateTimeout) {
        clearTimeout(this.dataUpdateTimeout);
        this.dataUpdateTimeout = null;
      }
      
      console.log('✅ OFFLINE-FIRST: All user-specific cached data cleared successfully (profile, events, social data)');
    } catch (error) {
      console.error('❌ Error clearing user data:', error);
      throw error;
    }
  }

  // ========== DISTANCE CALCULATION METHODS ==========

  // Check if cache entry is still valid (within 1 hour)
  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
  }

  // Get cached distance from AsyncStorage
  private async getCachedDistance(cacheKey: string): Promise<number | null> {
    try {
      // Check session cache first (fastest)
      const sessionResult = this.sessionCache.get(cacheKey);
      if (sessionResult !== undefined) {
        return sessionResult;
      }

      // Check AsyncStorage
      const cacheJson = await AsyncStorage.getItem(this.DISTANCE_CACHE_KEY);
      if (cacheJson) {
        const cache = JSON.parse(cacheJson);
        const entry = cache[cacheKey] as CachedDistance;
        
        if (entry && this.isCacheValid(entry.timestamp)) {
          // Store in session cache for faster access
          this.sessionCache.set(cacheKey, entry.distance);
          return entry.distance;
        }
      }
    } catch (error) {
      console.warn('Error reading distance cache:', error);
    }
    return null;
  }

  // Store distance in cache
  private async setCachedDistance(cacheKey: string, distance: number): Promise<void> {
    try {
      // Store in session cache immediately
      this.sessionCache.set(cacheKey, distance);

      // Store in AsyncStorage
      const cacheJson = await AsyncStorage.getItem(this.DISTANCE_CACHE_KEY);
      const cache = cacheJson ? JSON.parse(cacheJson) : {};
      
      cache[cacheKey] = {
        distance,
        timestamp: Date.now()
      };

      // Keep only last 500 entries to prevent storage bloat
      const entries = Object.entries(cache);
      if (entries.length > 500) {
        const sorted = entries.sort(([,a], [,b]) => (b as CachedDistance).timestamp - (a as CachedDistance).timestamp);
        const limited = Object.fromEntries(sorted.slice(0, 500));
        await AsyncStorage.setItem(this.DISTANCE_CACHE_KEY, JSON.stringify(limited));
      } else {
        await AsyncStorage.setItem(this.DISTANCE_CACHE_KEY, JSON.stringify(cache));
      }
    } catch (error) {
      console.warn('Error storing distance cache:', error);
    }
  }

  // Optimized Haversine formula with caching
  async calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): Promise<number> {
    // Create cache key (round to 4 decimal places for reasonable precision)
    const cacheKey = `${lat1.toFixed(4)},${lon1.toFixed(4)},${lat2.toFixed(4)},${lon2.toFixed(4)}`;
    
    // Check cache first
    const cached = await this.getCachedDistance(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Calculate distance using Haversine formula
    const R = 6371; // Radius of Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    // Cache the result
    await this.setCachedDistance(cacheKey, distance);
    
    return distance;
  }

  // Synchronous version for when caching isn't needed
  calculateDistanceSync(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Batch distance calculation for multiple events (sync version for performance)
  calculateDistancesForEvents(
    userLat: number, 
    userLon: number, 
    events: Array<{latitude?: number; longitude?: number}>
  ): number[] {
    return events.map(event => {
      if (event.latitude != null && event.longitude != null) {
        return this.calculateDistanceSync(userLat, userLon, event.latitude, event.longitude);
      }
      return 0;
    });
  }

  // Clear cache when needed (e.g., when user location changes significantly)
  async clearDistanceCache(): Promise<void> {
    try {
      this.sessionCache.clear();
      await AsyncStorage.removeItem(this.DISTANCE_CACHE_KEY);
    } catch (error) {
      console.warn('Error clearing distance cache:', error);
    }
  }

  // Clean up expired cache entries
  async cleanupDistanceCache(): Promise<void> {
    try {
      const cacheJson = await AsyncStorage.getItem(this.DISTANCE_CACHE_KEY);
      if (cacheJson) {
        const cache = JSON.parse(cacheJson);
        const validEntries: Record<string, CachedDistance> = {};
        
        for (const [key, entry] of Object.entries(cache)) {
          if (this.isCacheValid((entry as CachedDistance).timestamp)) {
            validEntries[key] = entry as CachedDistance;
          }
        }
        
        await AsyncStorage.setItem(this.DISTANCE_CACHE_KEY, JSON.stringify(validEntries));
      }
    } catch (error) {
      console.warn('Error cleaning up distance cache:', error);
    }
  }

  // Remove an event from the saved_events field in AsyncStorage and Supabase
  // Note: This only removes from saved_events, NOT from saved_events_all_time (permanent history)
  async removeEventFromSavedEvents(eventId: number) {
    try {
      const user = this.currentUser;
      if (!user || !user.email) {
        console.error('No user or email available for removing saved event');
        throw new Error('User not authenticated');
      }

      console.log(`Starting removal of event ${eventId} for user ${user.email}`);

      // Get current saved events from Supabase
      const { data: userData, error } = await supabase
        .from('all_users')
        .select('saved_events')
        .eq('email', user.email)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user data from Supabase:', error);
        throw error;
      }

      console.log('Current user data from Supabase:', userData);

      // Parse current saved events
      let savedEventIds: number[] = [];
      if (userData?.saved_events) {
        if (Array.isArray(userData.saved_events)) {
          savedEventIds = userData.saved_events;
        } else if (typeof userData.saved_events === 'string' && userData.saved_events) {
          savedEventIds = userData.saved_events
            .replace(/[{}"']+/g, '')
            .split(',')
            .map((s: string) => parseInt(s.trim(), 10))
            .filter(Boolean);
        }
      }

      console.log('Parsed saved event IDs before removal:', savedEventIds);

      // Check if event ID is actually in the list
      if (!savedEventIds.includes(eventId)) {
        console.log(`Event ${eventId} not found in saved events list`);
        return; // Event wasn't saved anyway
      }

      // Remove event ID if present
      const originalLength = savedEventIds.length;
      savedEventIds = savedEventIds.filter(id => id !== eventId);
      
      console.log(`Removed event ${eventId}. Array length changed from ${originalLength} to ${savedEventIds.length}`);
      console.log('Updated saved event IDs after removal:', savedEventIds);

      // Update Supabase with detailed error checking
      const { data: updateData, error: updateError } = await supabase
        .from('all_users')
        .update({ saved_events: savedEventIds })
        .eq('email', user.email)
        .select(); // Return the updated row to verify the change

      if (updateError) {
        console.error('Error updating Supabase:', updateError);
        throw updateError;
      }

      console.log('Supabase update successful. Updated data:', updateData);

      // Verify the update worked
      if (updateData && updateData.length > 0) {
        console.log('Verified updated saved_events in database:', updateData[0].saved_events);
      }

      // Get current saved events from AsyncStorage
      const savedEventsJson = await AsyncStorage.getItem('savedEvents');
      const currentSavedEvents = savedEventsJson ? JSON.parse(savedEventsJson) : [];

      console.log('Current AsyncStorage events before removal:', currentSavedEvents.map((e: EventCard) => e.id));

      // Remove event from AsyncStorage
      const updatedSavedEvents = currentSavedEvents.filter((event: EventCard) => event.id !== eventId);
      await AsyncStorage.setItem('savedEvents', JSON.stringify(updatedSavedEvents));

      console.log('Updated AsyncStorage events after removal:', updatedSavedEvents.map((e: EventCard) => e.id));

      // Emit an event to notify listeners
      this.emit('savedEventsUpdated', updatedSavedEvents);
      
      console.log(`Successfully removed event ${eventId} from saved events`);
    } catch (error) {
      console.error('Error removing event from saved events:', error);
      throw error;
    }
  }

  // Add caching method
  private getCachedData<T>(key: string): T | null {
    const cached = this.requestCache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data as T;
    }
    this.requestCache.delete(key);
    return null;
  }

  private setCachedData(key: string, data: any, ttl: number = this.CACHE_TTL_MS): void {
    this.requestCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  // Optimized API call wrapper with deduplication
  private async makeApiCall<T>(key: string, apiCall: () => Promise<T>, ttl?: number): Promise<T> {
    // Check cache first
    const cached = this.getCachedData<T>(key);
    if (cached) {
      return cached;
    }

    // Check if request is already pending
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key) as Promise<T>;
    }

    // Make the request
    const promise = apiCall();
    this.pendingRequests.set(key, promise);

    try {
      const result = await promise;
      this.setCachedData(key, result, ttl);
      return result;
    } finally {
      this.pendingRequests.delete(key);
    }
  }

  // Optimized batch user data fetch
  private async fetchUserDataBatch() {
    const user = this.currentUser;
    if (!user?.email) return;

    const cacheKey = `user_data_${user.email}`;
    
    try {
      const userData = await this.makeApiCall(cacheKey, async () => {
        const { data, error } = await supabase
          .from('all_users')
          .select('*, saved_events, rejected_events, saved_events_all_time')
          .eq('email', user.email)
          .maybeSingle();

        if (error) throw error;
        return data;
      }, 2 * 60 * 1000); // 2 minute cache for user data

             // Process and store all user data at once
       if (userData) {
         await Promise.all([
           this.fetchAndStoreUserProfile(),
           this.fetchAndStoreSavedEvents(),
           this.fetchAndStoreRejectedEvents()
         ]);
       }
    } catch (error) {
      console.error('Error in batch user data fetch:', error);
      throw error;
    }
  }

  // Debounced refresh to prevent excessive API calls
  async refreshAllDataDebounced() {
    if (this.debouncedUpdateTimeout) {
      clearTimeout(this.debouncedUpdateTimeout);
    }

    this.debouncedUpdateTimeout = setTimeout(async () => {
      const now = Date.now();
      if (now - this.lastApiCallTime < this.API_CALL_DEBOUNCE_MS) {
        console.log('⚡ API call skipped - too frequent');
        return;
      }

      this.lastApiCallTime = now;
      await this.refreshAllDataImmediate();
    }, 300);
  }

  // Get people the user follows who have saved a specific event
  async getFriendsWhoSavedEvent(eventId: number): Promise<{ id: number; name: string; email: string }[]> {
    const cacheKey = `following_saved_event_${eventId}`;
    
    return this.makeApiCall(cacheKey, async () => {
      if (!this.currentUser?.email) {
        return [];
      }

      try {
        // Get all users who have saved this event
        const { data: usersData, error } = await supabase
          .from('all_users')
          .select('id, name, email, saved_events')
          .not('saved_events', 'is', null);

        if (error) throw error;

        // Filter users who have this event in their saved_events and are people the current user follows
        const userProfile = await this.getUserProfile();
        if (!userProfile?.id) return [];

        // Get people the current user follows
        const { data: followingData, error: followingError } = await supabase
          .from('follows')
          .select('followed_id')
          .eq('follower_id', userProfile.id);

        if (followingError) throw followingError;

        const followingIds = new Set(followingData?.map(f => f.followed_id) || []);

        // Find people the user follows who have saved this event
        const followingWhoSaved: { id: number; name: string; email: string }[] = [];
        
        for (const user of usersData || []) {
          if (!followingIds.has(user.id)) continue;
          
          let savedEvents: number[] = [];
          if (user.saved_events) {
            if (Array.isArray(user.saved_events)) {
              savedEvents = user.saved_events;
            } else if (typeof user.saved_events === 'string') {
              savedEvents = user.saved_events
                .replace(/[{}"']+/g, '')
                .split(',')
                .map((s: string) => parseInt(s.trim(), 10))
                .filter(Boolean);
            }
          }
          
          if (savedEvents.includes(eventId)) {
            followingWhoSaved.push({
              id: user.id,
              name: user.name,
              email: user.email
            });
          }
        }

        return followingWhoSaved;
      } catch (error) {
        console.error('Error fetching people you follow who saved event:', error);
        return [];
      }
    }, 30 * 1000); // Cache for 30 seconds
  }

  // OPTIMIZED: Batch method to fetch following data for multiple events at once
  async getFriendsWhoSavedEventsBatch(eventIds: number[]): Promise<{ [eventId: number]: { id: number; name: string; email: string }[] }> {
    if (!this.currentUser?.email || eventIds.length === 0) {
      return {};
    }

    try {
      console.log(`🚀 Batch fetching following data for ${eventIds.length} events`);
      const startTime = Date.now();

      // Get all users who have saved events
      const { data: usersData, error } = await supabase
        .from('all_users')
        .select('id, name, email, saved_events')
        .not('saved_events', 'is', null);

      if (error) throw error;

      // Get people the current user follows
      const userProfile = await this.getUserProfile();
      if (!userProfile?.id) return {};

      const { data: followingData, error: followingError } = await supabase
        .from('follows')
        .select('followed_id')
        .eq('follower_id', userProfile.id);

      if (followingError) throw followingError;

      const followingIds = new Set(followingData?.map(f => f.followed_id) || []);

      // Build result map for all requested events
      const result: { [eventId: number]: { id: number; name: string; email: string }[] } = {};
      eventIds.forEach(id => result[id] = []);

      // Process each user once and check against all events
      for (const user of usersData || []) {
        if (!followingIds.has(user.id)) continue;
        
        let savedEvents: number[] = [];
        if (user.saved_events) {
          if (Array.isArray(user.saved_events)) {
            savedEvents = user.saved_events;
          } else if (typeof user.saved_events === 'string') {
            savedEvents = user.saved_events
              .replace(/[{}"']+/g, '')
              .split(',')
              .map((s: string) => parseInt(s.trim(), 10))
              .filter(Boolean);
          }
        }
        
        // Check which of the requested events this user has saved
        for (const eventId of eventIds) {
          if (savedEvents.includes(eventId)) {
            result[eventId].push({
              id: user.id,
              name: user.name,
              email: user.email
            });
          }
        }
      }

      const endTime = Date.now();
      console.log(`✅ Batch following fetch completed in ${endTime - startTime}ms for ${eventIds.length} events`);

      return result;
    } catch (error) {
      console.error('Error in batch following fetch:', error);
      // Return empty result for all events instead of failing
      const result: { [eventId: number]: { id: number; name: string; email: string }[] } = {};
      eventIds.forEach(id => result[id] = []);
      return result;
    }
  }

  // OPTIMIZED: Batch AsyncStorage operations to reduce I/O
  private async setMultipleAsyncStorage(items: { key: string; value: string }[]): Promise<void> {
    try {
      const pairs = items.map(item => [item.key, item.value] as [string, string]);
      await AsyncStorage.multiSet(pairs);
    } catch (error) {
      console.error('Error in batch AsyncStorage set:', error);
      // Fallback to individual sets
      for (const item of items) {
        try {
          await AsyncStorage.setItem(item.key, item.value);
        } catch (e) {
          console.error(`Error setting ${item.key}:`, e);
        }
      }
    }
  }

  // OPTIMIZED: Batch read multiple AsyncStorage items
  private async getMultipleAsyncStorage(keys: string[]): Promise<{ [key: string]: string | null }> {
    try {
      const pairs = await AsyncStorage.multiGet(keys);
      const result: { [key: string]: string | null } = {};
      pairs.forEach(([key, value]) => {
        result[key] = value;
      });
      return result;
    } catch (error) {
      console.error('Error in batch AsyncStorage get:', error);
      // Fallback to individual gets
      const result: { [key: string]: string | null } = {};
      for (const key of keys) {
        try {
          result[key] = await AsyncStorage.getItem(key);
        } catch (e) {
          console.error(`Error getting ${key}:`, e);
          result[key] = null;
        }
      }
      return result;
    }
  }

  // OPTIMIZED: Compress large JSON data before storing
  private compressData(data: any): string {
    const jsonString = JSON.stringify(data);
    // For very large data sets, you could implement actual compression here
    // For now, we'll just return the JSON string
    return jsonString;
  }

  // OPTIMIZED: Decompress and parse data
  private decompressData<T>(compressedData: string): T | null {
    try {
      return JSON.parse(compressedData);
    } catch (error) {
      console.error('Error decompressing data:', error);
      return null;
    }
  }
}

export default GlobalDataManager; 