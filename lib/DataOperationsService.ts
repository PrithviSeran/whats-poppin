import APIRequestService from './APIRequestService';
import GlobalDataManager, { EventCard, UserProfile } from './GlobalDataManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * High-level service that provides optimistic update patterns for common data operations
 * Uses APIRequestService for queue management and GlobalDataManager for cache updates
 */
class DataOperationsService {
  private static instance: DataOperationsService;
  private apiService: APIRequestService;
  private dataManager: GlobalDataManager;
  
  private constructor() {
    this.apiService = APIRequestService.getInstance();
    this.dataManager = GlobalDataManager.getInstance();
  }
  
  public static getInstance(): DataOperationsService {
    if (!DataOperationsService.instance) {
      DataOperationsService.instance = new DataOperationsService();
    }
    return DataOperationsService.instance;
  }
  
  // ========== USER PROFILE OPERATIONS ==========
  
  /**
   * Update user profile with optimistic updates
   */
  async updateUserProfile(
    email: string, 
    updates: Partial<UserProfile>, 
    options: { priority?: 'high' | 'medium' | 'low' } = {}
  ): Promise<UserProfile> {
    // Get current profile for rollback
    const currentProfile = await this.dataManager.getUserProfile();
    if (!currentProfile) {
      throw new Error('No current profile found');
    }
    
    const updatedProfile = { ...currentProfile, ...updates };
    
    return this.apiService.queueRequest<UserProfile>('update', {
      table: 'all_users',
      data: updates,
      filters: { eq: { email } },
      priority: options.priority || 'high',
      batch: 'user_updates',
      cacheKey: `user_profile_${email}`,
      cacheTTL: 300000, // 5 minutes
      optimisticUpdate: async () => {
        // Immediately update local cache
        await AsyncStorage.setItem('userProfile', JSON.stringify(updatedProfile));
        this.dataManager.emit('profileUpdated', updatedProfile);
        console.log('⚡ Optimistic profile update applied');
      },
      rollback: async () => {
        // Restore original profile
        await AsyncStorage.setItem('userProfile', JSON.stringify(currentProfile));
        this.dataManager.emit('profileUpdated', currentProfile);
        console.log('🔄 Profile update rolled back');
      }
    });
  }
  
  /**
   * Update username with validation and optimistic updates
   */
  async updateUsername(
    email: string, 
    newUsername: string,
    options: { validateFirst?: boolean } = {}
  ): Promise<boolean> {
    // Validate username if requested
    if (options.validateFirst) {
      const isAvailable = await this.checkUsernameAvailability(newUsername, email);
      if (!isAvailable) {
        throw new Error('Username not available');
      }
    }
    
    const currentProfile = await this.dataManager.getUserProfile();
    if (!currentProfile) {
      throw new Error('No current profile found');
    }
    
    const oldUsername = currentProfile.username;
    
    // Batch operations for username update
    const batchId = `username_update_${Date.now()}`;
    
    try {
      // Update user profile
      await this.apiService.queueRequest('update', {
        table: 'all_users',
        data: { username: newUsername.toLowerCase() },
        filters: { eq: { email } },
        priority: 'high',
        batch: batchId,
        optimisticUpdate: async () => {
          const updatedProfile = { ...currentProfile, username: newUsername.toLowerCase() };
          await AsyncStorage.setItem('userProfile', JSON.stringify(updatedProfile));
          this.dataManager.emit('profileUpdated', updatedProfile);
        },
        rollback: async () => {
          const restoredProfile = { ...currentProfile, username: oldUsername };
          await AsyncStorage.setItem('userProfile', JSON.stringify(restoredProfile));
          this.dataManager.emit('profileUpdated', restoredProfile);
        }
      });
      
      // Update events posted_by field
      if (oldUsername) {
        await this.apiService.queueRequest('update', {
          table: 'new_events',
          data: { posted_by: newUsername },
          filters: { eq: { posted_by: oldUsername } },
          priority: 'medium',
          batch: batchId
        });
      }
      
      console.log('✅ Username update completed successfully');
      return true;
      
    } catch (error) {
      console.error('❌ Username update failed:', error);
      throw error;
    }
  }
  
  /**
   * Check username availability with caching
   */
  async checkUsernameAvailability(username: string, currentEmail?: string): Promise<boolean> {
    const cacheKey = `username_check_${username.toLowerCase()}`;
    
    try {
      const result = await this.apiService.queueRequest<any[]>('select', {
        table: 'all_users',
        data: { select: 'username, email' },
        filters: { eq: { username: username.toLowerCase() } },
        priority: 'high',
        cacheKey,
        cacheTTL: 60000 // 1 minute cache for username checks
      });
      
      // Available if no results, or if the only result is the current user
      const isAvailable = !result || result.length === 0 || 
        (result.length === 1 && result[0].email === currentEmail);
      
      return isAvailable;
      
    } catch (error) {
      console.error('Error checking username availability:', error);
      return false;
    }
  }
  
  // ========== EVENT OPERATIONS ==========
  
  /**
   * Save event with optimistic updates
   */
  async saveEvent(eventId: number): Promise<void> {
    const user = this.dataManager.getCurrentUser();
    if (!user?.email) {
      throw new Error('User not authenticated');
    }
    
    // Get current saved events for optimistic update and rollback
    const currentSavedEvents = await this.dataManager.getSavedEvents();
    const currentEventIds = currentSavedEvents.map(e => e.id);
    
    // Check if already saved
    if (currentEventIds.includes(eventId)) {
      console.log('Event already saved');
      return;
    }
    
    // Fetch event details for optimistic update
    const eventDetails = await this.getEventById(eventId);
    if (!eventDetails) {
      throw new Error('Event not found');
    }
    
    const optimisticSavedEvents = [...currentSavedEvents, eventDetails];
    const optimisticEventIds = [...currentEventIds, eventId];
    
    return this.apiService.queueRequest('update', {
      table: 'all_users',
      data: { 
        saved_events: optimisticEventIds,
        saved_events_all_time: optimisticEventIds // For simplicity, assuming all_time includes current
      },
      filters: { eq: { email: user.email } },
      priority: 'high',
      batch: 'event_operations',
      optimisticUpdate: async () => {
        // Update local cache immediately
        await AsyncStorage.setItem('savedEvents', JSON.stringify(optimisticSavedEvents));
        this.dataManager.emit('savedEventsUpdated', optimisticSavedEvents);
        console.log('⚡ Optimistic event save applied');
      },
      rollback: async () => {
        // Restore original state
        await AsyncStorage.setItem('savedEvents', JSON.stringify(currentSavedEvents));
        this.dataManager.emit('savedEventsUpdated', currentSavedEvents);
        console.log('🔄 Event save rolled back');
      }
    });
  }
  
  /**
   * Remove saved event with optimistic updates
   */
  async removeSavedEvent(eventId: number): Promise<void> {
    const user = this.dataManager.getCurrentUser();
    if (!user?.email) {
      throw new Error('User not authenticated');
    }
    
    // Get current saved events
    const currentSavedEvents = await this.dataManager.getSavedEvents();
    const eventToRemove = currentSavedEvents.find(e => e.id === eventId);
    
    if (!eventToRemove) {
      console.log('Event not in saved list');
      return;
    }
    
    const optimisticSavedEvents = currentSavedEvents.filter(e => e.id !== eventId);
    const optimisticEventIds = optimisticSavedEvents.map(e => e.id);
    
    return this.apiService.queueRequest('update', {
      table: 'all_users',
      data: { saved_events: optimisticEventIds },
      filters: { eq: { email: user.email } },
      priority: 'high',
      batch: 'event_operations',
      optimisticUpdate: async () => {
        // Update local cache immediately
        await AsyncStorage.setItem('savedEvents', JSON.stringify(optimisticSavedEvents));
        this.dataManager.emit('savedEventsUpdated', optimisticSavedEvents);
        console.log('⚡ Optimistic event removal applied');
      },
      rollback: async () => {
        // Restore original state
        await AsyncStorage.setItem('savedEvents', JSON.stringify(currentSavedEvents));
        this.dataManager.emit('savedEventsUpdated', currentSavedEvents);
        console.log('🔄 Event removal rolled back');
      }
    });
  }
  
  /**
   * Clear all saved events with optimistic updates
   */
  async clearAllSavedEvents(): Promise<void> {
    const user = this.dataManager.getCurrentUser();
    if (!user?.email) {
      throw new Error('User not authenticated');
    }
    
    // Get current saved events for rollback
    const currentSavedEvents = await this.dataManager.getSavedEvents();
    
    return this.apiService.queueRequest('update', {
      table: 'all_users',
      data: { saved_events: [] },
      filters: { eq: { email: user.email } },
      priority: 'high',
      maxRetries: 5, // More retries for critical operation
      optimisticUpdate: async () => {
        // Clear local cache immediately
        await AsyncStorage.setItem('savedEvents', JSON.stringify([]));
        this.dataManager.emit('savedEventsUpdated', []);
        console.log('⚡ Optimistic clear all events applied');
      },
      rollback: async () => {
        // Restore original state
        await AsyncStorage.setItem('savedEvents', JSON.stringify(currentSavedEvents));
        this.dataManager.emit('savedEventsUpdated', currentSavedEvents);
        console.log('🔄 Clear all events rolled back');
      }
    });
  }
  
  /**
   * Reject event with optimistic updates
   */
  async rejectEvent(event: EventCard): Promise<void> {
    const currentRejectedEvents = await this.dataManager.getRejectedEvents();
    
    // Check if already rejected
    if (currentRejectedEvents.some(e => e.id === event.id)) {
      console.log('Event already rejected');
      return;
    }
    
    const optimisticRejectedEvents = [...currentRejectedEvents, event];
    
    // Note: This doesn't immediately update Supabase, just local cache
    // The actual sync happens later via batch operations
    await AsyncStorage.setItem('rejectedEvents', JSON.stringify(optimisticRejectedEvents));
    console.log('⚡ Event rejected and cached locally');
  }
  
  /**
   * Get event by ID with caching
   */
  async getEventById(eventId: number): Promise<EventCard | null> {
    const cacheKey = `event_${eventId}`;
    
    try {
      const result = await this.apiService.queueRequest<EventCard[]>('select', {
        table: 'new_events',
        data: { select: '*' },
        filters: { eq: { id: eventId } },
        priority: 'medium',
        cacheKey,
        cacheTTL: 600000 // 10 minutes cache for individual events
      });
      
      return result && result.length > 0 ? result[0] : null;
      
    } catch (error) {
      console.error('Error fetching event by ID:', error);
      return null;
    }
  }
  
  // ========== SOCIAL OPERATIONS ==========
  
  /**
   * Follow user with optimistic updates
   */
  async followUser(followerId: number, followedId: number): Promise<boolean> {
    return this.apiService.queueRequest<any>('insert', {
      table: 'follows',
      data: { follower_id: followerId, followed_id: followedId },
      priority: 'high',
      batch: 'social_operations',
      optimisticUpdate: () => {
        // Update social cache optimistically
        console.log('⚡ Optimistic follow applied');
        // Emit event for UI updates
        this.dataManager.emit('socialDataUpdated', { type: 'follow', followerId, followedId });
      },
      rollback: () => {
        console.log('🔄 Follow operation rolled back');
        this.dataManager.emit('socialDataUpdated', { type: 'unfollow', followerId, followedId });
      }
    });
  }
  
  /**
   * Unfollow user with optimistic updates
   */
  async unfollowUser(followerId: number, followedId: number): Promise<boolean> {
    return this.apiService.queueRequest<any>('delete', {
      table: 'follows',
      filters: { 
        eq: { 
          follower_id: followerId, 
          followed_id: followedId 
        } 
      },
      priority: 'high',
      batch: 'social_operations',
      optimisticUpdate: () => {
        console.log('⚡ Optimistic unfollow applied');
        this.dataManager.emit('socialDataUpdated', { type: 'unfollow', followerId, followedId });
      },
      rollback: () => {
        console.log('🔄 Unfollow operation rolled back');
        this.dataManager.emit('socialDataUpdated', { type: 'follow', followerId, followedId });
      }
    });
  }
  
  // ========== BATCH OPERATIONS ==========
  
  /**
   * Batch update multiple user preferences
   */
  async updateUserPreferences(
    email: string,
    preferences: {
      'start-time'?: string;
      'end-time'?: string;
      location?: string;
      'travel-distance'?: number;
      preferred_days?: string[];
      preferences?: string[];
    }
  ): Promise<UserProfile> {
    const currentProfile = await this.dataManager.getUserProfile();
    if (!currentProfile) {
      throw new Error('No current profile found');
    }
    
    const updatedProfile = { ...currentProfile, ...preferences };
    
    return this.apiService.queueRequest<UserProfile>('update', {
      table: 'all_users',
      data: preferences,
      filters: { eq: { email } },
      priority: 'medium',
      batch: 'user_updates',
      cacheKey: `user_profile_${email}`,
      optimisticUpdate: async () => {
        await AsyncStorage.setItem('userProfile', JSON.stringify(updatedProfile));
        this.dataManager.emit('profileUpdated', updatedProfile);
        console.log('⚡ Optimistic preferences update applied');
      },
      rollback: async () => {
        await AsyncStorage.setItem('userProfile', JSON.stringify(currentProfile));
        this.dataManager.emit('profileUpdated', currentProfile);
        console.log('🔄 Preferences update rolled back');
      }
    });
  }
  
  /**
   * Sync rejected events to database (batch operation)
   */
  async syncRejectedEvents(): Promise<void> {
    const user = this.dataManager.getCurrentUser();
    if (!user?.email) return;
    
    const rejectedEvents = await this.dataManager.getRejectedEvents();
    const rejectedEventIds = rejectedEvents.map(e => e.id.toString());
    
    if (rejectedEventIds.length === 0) return;
    
    return this.apiService.queueRequest('update', {
      table: 'all_users',
      data: { rejected_events: rejectedEventIds },
      filters: { eq: { email: user.email } },
      priority: 'low', // Low priority for background sync
      batch: 'user_updates'
    });
  }
  
  // ========== IMAGE OPERATIONS ==========
  
  /**
   * Upload profile image with progress tracking
   */
  async uploadProfileImage(
    userEmail: string, 
    imageUri: string, 
    onProgress?: (progress: number) => void
  ): Promise<string> {
    const userFolder = userEmail.replace(/[^a-zA-Z0-9]/g, '_');
    const imagePath = `${userFolder}/profile.jpg`;
    
    // Convert image URI to file
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    try {
      const result = await this.apiService.queueRequest<any>('storage_upload', {
        data: {
          bucket: 'user-images',
          path: imagePath,
          file: blob,
          options: {
            contentType: 'image/jpeg',
            upsert: true
          }
        },
        priority: 'medium',
        maxRetries: 5
      });
      
      // Get public URL
      const { data: { publicUrl } } = await import('./supabase').then(({ supabase }) => 
        supabase.storage.from('user-images').getPublicUrl(imagePath)
      );
      
      // Update profile with new image URL
      await this.updateUserProfile(userEmail, { profile_image: publicUrl });
      
      return publicUrl;
      
    } catch (error) {
      console.error('Error uploading profile image:', error);
      throw error;
    }
  }
  
  /**
   * Upload banner image with progress tracking
   */
  async uploadBannerImage(
    userEmail: string, 
    imageUri: string, 
    onProgress?: (progress: number) => void
  ): Promise<string> {
    const userFolder = userEmail.replace(/[^a-zA-Z0-9]/g, '_');
    const imagePath = `${userFolder}/banner.jpg`;
    
    // Convert image URI to file
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    try {
      const result = await this.apiService.queueRequest<any>('storage_upload', {
        data: {
          bucket: 'user-images',
          path: imagePath,
          file: blob,
          options: {
            contentType: 'image/jpeg',
            upsert: true
          }
        },
        priority: 'medium',
        maxRetries: 5
      });
      
      // Get public URL
      const { data: { publicUrl } } = await import('./supabase').then(({ supabase }) => 
        supabase.storage.from('user-images').getPublicUrl(imagePath)
      );
      
      // Update profile with new image URL
      await this.updateUserProfile(userEmail, { banner_image: publicUrl });
      
      return publicUrl;
      
    } catch (error) {
      console.error('Error uploading banner image:', error);
      throw error;
    }
  }
  
  // ========== UTILITY METHODS ==========
  
  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      mainQueue: this.apiService.getQueueSize(),
      offlineQueue: this.apiService.getOfflineQueueSize()
    };
  }
  
  /**
   * Clear cache for specific patterns
   */
  clearCache(pattern?: string) {
    this.apiService.clearCache(pattern);
  }
  
  /**
   * Force sync of all offline operations
   */
  async syncOfflineOperations() {
    await this.apiService.syncOfflineQueue();
  }
  
  /**
   * Set network status (for testing or manual control)
   */
  setNetworkStatus(isOnline: boolean) {
    this.apiService.setOnlineStatus(isOnline);
  }
}

export default DataOperationsService;