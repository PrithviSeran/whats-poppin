import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { EventEmitter } from 'events';
import { Interface } from 'readline';

export interface EventCard {
  id: number;
  created_at: string;
  name: string;
  organization: string;
  event_type: string;
  start_time: string; // 'HH:MM'
  end_time: string;   // 'HH:MM'
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
}

class GlobalDataManager extends EventEmitter {
  private static instance: GlobalDataManager;
  private isInitialized: boolean = false;
  private isInitializing: boolean = false;
  private dataUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentUser: any = null; // Field for the current logged in user

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
      await AsyncStorage.setItem('savedEvents', JSON.stringify(events || []));
      console.log('Saved events (full objects) stored successfully');
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

  async getSavedEvents(): Promise<string[]> {
    const savedEventsJson = await AsyncStorage.getItem('savedEvents');
    return savedEventsJson ? JSON.parse(savedEventsJson) : [];
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
  setCurrentUser(user: any) {
    this.currentUser = user;
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
      const profileJson = await AsyncStorage.getItem('userProfile');
      if (!profileJson) throw new Error('User profile not found in AsyncStorage');
      const profile: UserProfile = JSON.parse(profileJson);
      if (!profile.saved_events) profile.saved_events = [];
      if (!profile.saved_events.includes(eventId)) {
        profile.saved_events.push(eventId);
        // Update AsyncStorage
        await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
        await AsyncStorage.setItem('savedEvents', JSON.stringify(profile.saved_events));
        // Update Supabase
        if (profile.email) {
          const { error } = await supabase
            .from('all_users')
            .update({ saved_events: profile.saved_events })
            .eq('email', profile.email);
          if (error) throw error;
        }
      }
    } catch (err) {
      console.error('Error adding event to saved_events:', err);
      throw err;
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
}

export default GlobalDataManager; 