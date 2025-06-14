import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { EventEmitter } from 'events';
import { Interface } from 'readline';

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
};

export interface UserProfile {
  id: number;
  created_at: string;
  name: string;
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

  private constructor() {
    super();
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
    if (this.isInitialized || this.isInitializing) return;
    
    this.isInitializing = true;
    try {
      // Set current user from Supabase
      await Promise.all([
        this.fetchAndStoreUserProfile(),
        this.fetchAndStoreSavedEvents(),
        this.fetchAndStoreRejectedEvents()
      ]);
      
      this.isInitialized = true;
      this.emit('dataInitialized');
      console.log('Global data initialized successfully');
    } catch (error) {
      console.error('Error initializing global data:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  private async fetchAndStoreEvents() {
    try {
      const { data: events, error } = await supabase
        .from('all_events')
        .select('*');

      if (error) throw error;

      await AsyncStorage.setItem('allEvents', JSON.stringify(events));
      console.log('Events stored successfully');
    } catch (error) {
      console.error('Error fetching and storing events:', error);
      throw error;
    }
  }

  private async fetchAndStoreUserProfile() {
    try {
      const user = this.currentUser;
      if (!user) return;

      const { data: profile, error } = await supabase
        .from('all_users')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();

      if (error) throw error;
      if (profile) {
        // Create folder path using user's email
        const userFolder = user.email?.replace(/[^a-zA-Z0-9]/g, '_') || user.id;

        // Get the public URLs for both images
        const { data: { publicUrl: profileUrl } } = supabase.storage
          .from('user-images')
          .getPublicUrl(`${userFolder}/profile.jpg`);

        const { data: { publicUrl: bannerUrl } } = supabase.storage
          .from('user-images')
          .getPublicUrl(`${userFolder}/banner.jpg`);

        // Add image URLs to profile object
        const profileWithImages = {
          ...profile,
          profileImage: profileUrl,
          bannerImage: bannerUrl
        };

        await AsyncStorage.setItem('userProfile', JSON.stringify(profileWithImages));
        console.log('User profile stored successfully with image URLs');
      }
    } catch (error) {
      console.error('Error fetching and storing user profile:', error);
      throw error;
    }
  }

  private async fetchAndStoreSavedEvents() {
    try {
      const user = this.currentUser;
      if (!user) return;

      // Fetch saved_events IDs from user profile
      const { data: userData, error } = await supabase
        .from('all_users')
        .select('saved_events')
        .eq('email', user.email)
        .maybeSingle();

      if (error) throw error;
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
      if (savedEventIds.length === 0) {
        await AsyncStorage.setItem('savedEvents', JSON.stringify([]));
        console.log('No saved events to store');
        return;
      }
      // Fetch full event objects for these IDs
      const { data: events, error: eventsError } = await supabase
        .from('all_events')
        .select('*')
        .in('id', savedEventIds);
      if (eventsError) throw eventsError;
      
      // Add image URLs to events (similar to how the recommendation API does it)
      const eventsWithImages = (events || []).map(event => {
        try {
          // Randomly select one of the 5 images (0-4)
          const randomImageIndex = Math.floor(Math.random() * 5);
          const { data: { publicUrl } } = supabase.storage
            .from('event-images')
            .getPublicUrl(`${event.id}/${randomImageIndex}.jpg`);
          
          // Create all 5 image URLs
          const allImages = Array.from({ length: 5 }, (_, i) => {
            const { data: { publicUrl: imageUrl } } = supabase.storage
              .from('event-images')
              .getPublicUrl(`${event.id}/${i}.jpg`);
            return imageUrl;
          });
          
          return { ...event, image: publicUrl, allImages };
        } catch (e) {
          console.log(`No image found for event ${event.id}`);
          return { ...event, image: null, allImages: [] };
        }
      });
      
      await AsyncStorage.setItem('savedEvents', JSON.stringify(eventsWithImages));
      console.log('Saved events (full objects with images) stored successfully');
    } catch (error) {
      console.error('Error fetching and storing saved events:', error);
      throw error;
    }
  }

  // Fetch the user's rejected_events from Supabase and store in AsyncStorage
  private async fetchAndStoreRejectedEvents() {
    try {
      const user = this.currentUser;
      if (!user || !user.email) return;
      const { data: userData, error } = await supabase
        .from('all_users')
        .select('rejected_events')
        .eq('email', user.email)
        .maybeSingle();
      if (error) throw error;
      let rejectedEventsArr: number[] = [];
      if (userData?.rejected_events) {
        if (Array.isArray(userData.rejected_events)) {
          rejectedEventsArr = userData.rejected_events;
        } else if (typeof userData.rejected_events === 'string' && userData.rejected_events) {
          rejectedEventsArr = userData.rejected_events
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
      // Fetch full event objects for these IDs
      const { data: events, error: eventsError } = await supabase
        .from('all_events')
        .select('*')
        .in('id', rejectedEventsArr);
      if (eventsError) throw eventsError;
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

      const { data: userData, error } = await supabase
        .from('all_users')
        .select('saved_events_all_time')
        .eq('email', user.email)
        .maybeSingle();

      if (error) throw error;

      let savedEventsAllTime: number[] = [];
      if (userData?.saved_events_all_time) {
        if (Array.isArray(userData.saved_events_all_time)) {
          savedEventsAllTime = userData.saved_events_all_time;
        } else if (typeof userData.saved_events_all_time === 'string' && userData.saved_events_all_time) {
          savedEventsAllTime = userData.saved_events_all_time
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
      // Update AsyncStorage
      await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
      // Update Supabase
      if (profile.email) {
        // Remove profileImage and bannerImage before updating Supabase
        const { id, created_at, profileImage, bannerImage, ...updateData } = profile as any;
        const { error } = await supabase
          .from('all_users')
          .update(updateData)
          .eq('email', profile.email);
        if (error) throw error;
      }
    } catch (err) {
      console.error('Error updating user profile:', err);
      throw err; // Optionally rethrow if you want to handle it elsewhere
    }
  }

  // Add an event to the saved_events field in AsyncStorage and Supabase
  async addEventToSavedEvents(eventId: number) {
    try {
      const user = this.currentUser;
      if (!user || !user.email) return;

      // Get current saved events and saved_events_all_time from Supabase
      const { data: userData, error } = await supabase
        .from('all_users')
        .select('saved_events, saved_events_all_time')
        .eq('email', user.email)
        .maybeSingle();

      if (error) throw error;

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

      // Parse current saved_events_all_time
      let savedEventsAllTime: number[] = [];
      if (userData?.saved_events_all_time) {
        if (Array.isArray(userData.saved_events_all_time)) {
          savedEventsAllTime = userData.saved_events_all_time;
        } else if (typeof userData.saved_events_all_time === 'string' && userData.saved_events_all_time) {
          savedEventsAllTime = userData.saved_events_all_time
            .replace(/[{}"']+/g, '')
            .split(',')
            .map((s: string) => parseInt(s.trim(), 10))
            .filter(Boolean);
        }
      }

      // Add new event ID if not already present in current saved events
      if (!savedEventIds.includes(eventId)) {
        savedEventIds.push(eventId);

        // Also add to saved_events_all_time if not already present
        if (!savedEventsAllTime.includes(eventId)) {
          savedEventsAllTime.push(eventId);
        }

        // Update Supabase with both arrays
        await supabase
          .from('all_users')
          .update({ 
            saved_events: savedEventIds,
            saved_events_all_time: savedEventsAllTime
          })
          .eq('email', user.email);

        // Fetch the full event object
        const { data: event, error: eventError } = await supabase
          .from('all_events')
          .select('*')
          .eq('id', eventId)
          .single();

        if (eventError) throw eventError;

        // Add image URL to the event
        let eventWithImage = event;
        try {
          const { data: { publicUrl } } = supabase.storage
            .from('event-images')
            .getPublicUrl(`${event.id}.jpg`);
          eventWithImage = { ...event, image: publicUrl };
        } catch (e) {
          console.log(`No image found for event ${event.id}`);
          eventWithImage = { ...event, image: null };
        }

        // Get current saved events from AsyncStorage
        const savedEventsJson = await AsyncStorage.getItem('savedEvents');
        const currentSavedEvents = savedEventsJson ? JSON.parse(savedEventsJson) : [];

        // Add new event to AsyncStorage
        await AsyncStorage.setItem('savedEvents', JSON.stringify([...currentSavedEvents, eventWithImage]));

        // Emit an event to notify listeners
        this.emit('savedEventsUpdated', [...currentSavedEvents, eventWithImage]);
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
      console.log('Clearing all user-specific cached data...');
      
      // Clear all user-specific AsyncStorage data
      await Promise.all([
        AsyncStorage.removeItem('userProfile'),
        AsyncStorage.removeItem('savedEvents'),
        AsyncStorage.removeItem('rejectedEvents'),
        AsyncStorage.removeItem('filterByDistance'),
        AsyncStorage.removeItem('allEvents'), // Also clear events to get fresh data
        this.clearDistanceCache() // Clear distance calculations cache
      ]);
      
      // Clear session cache
      this.sessionCache.clear();
      
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
      
      console.log('All user-specific cached data cleared successfully');
    } catch (error) {
      console.error('Error clearing user data:', error);
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
}

export default GlobalDataManager; 