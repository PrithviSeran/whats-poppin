import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { EventEmitter } from 'events';

interface Event {
  id: number;
  name: string;
  image: string | null;
  start_date: string;
  location: string;
  description: string;
  isLiked?: boolean;
  created_at: string;
  organization: string;
  event_type: string;
  start_time: string;
  latitude?: number;
  longitude?: number;
  distance?: number | null;
}

interface UserProfile {
  id: number;
  created_at: string;
  name: string;
  email: string;
  birthday: string;
  gender: string;
  saved_events?: string[];
  preferences?: string[];
  profileImage?: string;
  bannerImage?: string;
}

class GlobalDataManager extends EventEmitter {
  private static instance: GlobalDataManager;
  private isInitialized: boolean = false;
  private isInitializing: boolean = false;
  private dataUpdateTimeout: ReturnType<typeof setTimeout> | null = null;

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
      await Promise.all([
        this.fetchAndStoreEvents(),
        this.fetchAndStoreUserProfile(),
        this.fetchAndStoreSavedEvents()
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error } = await supabase
        .from('all_users')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();

      if (error) throw error;
      if (profile) {
        await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
        console.log('User profile stored successfully');
      }
    } catch (error) {
      console.error('Error fetching and storing user profile:', error);
      throw error;
    }
  }

  private async fetchAndStoreSavedEvents() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData, error } = await supabase
        .from('all_users')
        .select('saved_events')
        .eq('email', user.email)
        .maybeSingle();

      if (error) throw error;
      if (userData?.saved_events) {
        await AsyncStorage.setItem('savedEvents', JSON.stringify(userData.saved_events));
        console.log('Saved events stored successfully');
      }
    } catch (error) {
      console.error('Error fetching and storing saved events:', error);
      throw error;
    }
  }

  // Getters for stored data
  async getEvents(): Promise<Event[]> {
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
}

export default GlobalDataManager; 