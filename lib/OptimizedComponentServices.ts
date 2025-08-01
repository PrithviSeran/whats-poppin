import DataOperationsService from './DataOperationsService';
import APIRequestService from './APIRequestService';
import { supabase } from './supabase';

/**
 * Optimized services for common component operations
 * Replaces direct Supabase calls with batched, cached, and optimistic operations
 */

class OptimizedComponentServices {
  private static instance: OptimizedComponentServices;
  private dataOps: DataOperationsService;
  private apiService: APIRequestService;
  
  private constructor() {
    this.dataOps = DataOperationsService.getInstance();
    this.apiService = APIRequestService.getInstance();
  }
  
  public static getInstance(): OptimizedComponentServices {
    if (!OptimizedComponentServices.instance) {
      OptimizedComponentServices.instance = new OptimizedComponentServices();
    }
    return OptimizedComponentServices.instance;
  }
  
  // ========== AUTH OPERATIONS ==========
  
  /**
   * Optimized sign in with caching
   */
  async signInWithPassword(email: string, password: string) {
    return this.apiService.queueRequest('auth', {
      data: {
        operation: 'signIn',
        params: { email, password }
      },
      priority: 'high',
      maxRetries: 2
    });
  }
  
  /**
   * Optimized sign up
   */
  async signUp(email: string, password: string, userData?: any) {
    return this.apiService.queueRequest('auth', {
      data: {
        operation: 'signUp',
        params: { email, password, options: { data: userData } }
      },
      priority: 'high',
      maxRetries: 2
    });
  }
  
  /**
   * Optimized sign out with cache cleanup
   */
  async signOut() {
    const result = await this.apiService.queueRequest('auth', {
      data: {
        operation: 'signOut',
        params: {}
      },
      priority: 'high'
    });
    
    // Clear all user-related cache on sign out
    this.apiService.clearCache('current_user');
    this.apiService.clearCache('current_session');
    this.apiService.clearCache('user_profile');
    console.log('🧹 Cleared all auth-related cache on sign out');
    
    return result;
  }
  
  /**
   * Get current session with enhanced caching
   */
  async getSession() {
    return this.apiService.queueRequest('auth', {
      data: {
        operation: 'getSession',
        params: {}
      },
      priority: 'high',
      cacheKey: 'current_session',
      cacheTTL: 300000 // 5 minutes cache for session
    });
  }
  
  /**
   * Get current user with enhanced caching
   */
  async getCurrentUser() {
    return this.apiService.queueRequest('auth', {
      data: {
        operation: 'getUser',
        params: {}
      },
      priority: 'high',
      cacheKey: 'current_user',
      cacheTTL: 300000 // 5 minutes cache for user
    });
  }
  
  /**
   * Update user (e.g., password reset)
   */
  async updateUser(updates: any) {
    return this.apiService.queueRequest('auth', {
      data: {
        operation: 'updateUser',
        params: updates
      },
      priority: 'high'
    });
  }
  
  // ========== USER PROFILE OPERATIONS ==========
  
  /**
   * Check username availability with caching
   */
  async checkUsernameAvailability(username: string, currentEmail?: string): Promise<boolean> {
    return this.dataOps.checkUsernameAvailability(username, currentEmail);
  }
  
  /**
   * Update username with optimistic updates
   */
  async updateUsername(email: string, newUsername: string): Promise<boolean> {
    return this.dataOps.updateUsername(email, newUsername, { validateFirst: true });
  }
  
  /**
   * Update user profile with optimistic updates
   */
  async updateUserProfile(email: string, updates: any) {
    return this.dataOps.updateUserProfile(email, updates);
  }
  
  /**
   * Update user preferences with batching
   */
  async updateUserPreferences(email: string, preferences: any) {
    return this.dataOps.updateUserPreferences(email, preferences);
  }
  
  // ========== EVENT OPERATIONS ==========
  
  /**
   * Save event with optimistic updates
   */
  async saveEvent(eventId: number): Promise<void> {
    return this.dataOps.saveEvent(eventId);
  }
  
  /**
   * Remove saved event with optimistic updates
   */
  async removeSavedEvent(eventId: number): Promise<void> {
    return this.dataOps.removeSavedEvent(eventId);
  }
  
  /**
   * Clear all saved events with optimistic updates
   */
  async clearAllSavedEvents(): Promise<void> {
    return this.dataOps.clearAllSavedEvents();
  }
  
  /**
   * Create new event with optimistic updates
   */
  async createEvent(eventData: any) {
    const currentUser = await this.getCurrentUser() as any;
    if (!currentUser?.data?.user?.email) {
      throw new Error('User not authenticated');
    }
    
    // Add user info to event data
    const enrichedEventData = {
      ...eventData,
      posted_by: currentUser.data.user.email,
      posted_by_email: currentUser.data.user.email
    };
    
    return this.apiService.queueRequest('insert', {
      table: 'new_events',
      data: enrichedEventData,
      priority: 'high',
      batch: 'event_operations'
    });
  }

  /**
   * Delete an event by ID
   */
  async deleteEvent(eventId: number) {
    return this.apiService.queueRequest('delete', {
      table: 'new_events',
      filters: { eq: { id: eventId } },
      priority: 'high',
      maxRetries: 2
    });
  }
  
  /**
   * Get events with intelligent caching
   */
  async getEvents(filters?: any, cacheKey?: string) {
    return this.apiService.queueRequest('select', {
      table: 'new_events',
      data: { select: 'id, created_at, name, organization, location, cost, age_restriction, reservation, description, start_date, end_date, occurrence, latitude, longitude, days_of_the_week, event_type, link, times, featured, posted_by, posted_by_email' },
      filters,
      priority: 'medium',
      cacheKey: cacheKey || 'all_events',
      cacheTTL: 300000 // 5 minutes cache
    });
  }
  
  // ========== SOCIAL OPERATIONS ==========
  
  /**
   * Follow user with optimistic updates
   */
  async followUser(followerId: number, followedId: number): Promise<boolean> {
    return this.dataOps.followUser(followerId, followedId);
  }
  
  /**
   * Unfollow user with optimistic updates
   */
  async unfollowUser(followerId: number, followedId: number): Promise<boolean> {
    return this.dataOps.unfollowUser(followerId, followedId);
  }
  
  /**
   * Search users with caching
   */
  async searchUsers(searchQuery: string, currentUserId?: number) {
    const filters: any = {};
    
    if (searchQuery.includes('@')) {
      // Email search
      filters.eq = { email: searchQuery };
    } else {
      // Username/name search - this needs to be implemented as a custom query
      return this.apiService.queueRequest('rpc', {
        data: {
          functionName: 'search_users',
          params: { search_query: searchQuery, current_user_id: currentUserId }
        },
        priority: 'medium',
        cacheKey: `user_search_${searchQuery}_${currentUserId}`,
        cacheTTL: 60000 // 1 minute cache for searches
      });
    }
    
    return this.apiService.queueRequest('select', {
      table: 'all_users',
      data: { select: 'id, name, email, username' },
      filters,
      priority: 'medium',
      cacheKey: `user_lookup_${searchQuery}`,
      cacheTTL: 300000 // 5 minutes cache for user lookups
    });
  }
  
  // ========== STORAGE OPERATIONS ==========
  
  /**
   * Optimized file upload with automatic retry and progress tracking
   */
  async uploadFile(bucket: string, path: string, file: any, options?: any) {
    return this.apiService.queueRequest('storage_upload', {
      data: {
        bucket,
        path,
        file,
        options
      },
      priority: 'medium',
      maxRetries: 3,
      batch: 'file_operations'
    });
  }
  
  /**
   * Optimized file deletion with batching support
   */
  async deleteFile(bucket: string, path: string) {
    return this.apiService.queueRequest('storage_delete', {
      data: {
        bucket,
        paths: [path]
      },
      priority: 'medium',
      batch: 'file_operations'
    });
  }
  
  /**
   * Batch file deletion for better performance
   */
  async deleteFiles(bucket: string, paths: string[]) {
    return this.apiService.queueRequest('storage_delete', {
      data: {
        bucket,
        paths
      },
      priority: 'medium',
      batch: 'file_operations'
    });
  }
  
  /**
   * Get public URL with caching
   */
  async getPublicUrl(bucket: string, path: string) {
    return this.apiService.queueRequest('storage_get_public_url', {
      data: {
        bucket,
        path
      },
      priority: 'low',
      cacheKey: `public_url_${bucket}_${path}`,
      cacheTTL: 3600000 // 1 hour cache for URLs
    });
  }
  
  /**
   * List files with caching
   */
  async listFiles(bucket: string, path?: string, options?: any) {
    return this.apiService.queueRequest('storage_list', {
      data: {
        bucket,
        path,
        options
      },
      priority: 'low',
      cacheKey: `file_list_${bucket}_${path || 'root'}`,
      cacheTTL: 60000 // 1 minute cache for file lists
    });
  }
  
  /**
   * Get user by ID with caching
   */
  async getUserById(userId: number) {
    return this.apiService.queueRequest('select', {
      table: 'all_users',
      data: { select: 'id, name, email, username' },
      filters: { eq: { id: userId } },
      priority: 'medium',
      cacheKey: `user_${userId}`,
      cacheTTL: 300000 // 5 minutes cache
    });
  }

  /**
   * Get user by email with caching
   */
  async getUserByEmail(email: string) {
    return this.apiService.queueRequest('select', {
      table: 'all_users',
      data: { select: 'id, name, email, username' },
      filters: { eq: { email: email } },
      priority: 'medium',
      cacheKey: `user_email_${email}`,
      cacheTTL: 300000 // 5 minutes cache
    });
  }
  
  /**
   * Get friendship status with caching
   */
  async getFriendshipStatus(userId1: number, userId2: number) {
    return this.apiService.queueRequest('rpc', {
      data: {
        functionName: 'get_friendship_status',
        params: { user1: userId1, user2: userId2 }
      },
      priority: 'medium',
      cacheKey: `friendship_${Math.min(userId1, userId2)}_${Math.max(userId1, userId2)}`,
      cacheTTL: 60000 // 1 minute cache for friendship status
    });
  }
  
  // ========== IMAGE OPERATIONS ==========
  
  /**
   * Upload profile image with progress tracking
   */
  async uploadProfileImage(userEmail: string, imageUri: string, onProgress?: (progress: number) => void): Promise<string> {
    return this.dataOps.uploadProfileImage(userEmail, imageUri, onProgress);
  }
  
  /**
   * Upload banner image with progress tracking
   */
  async uploadBannerImage(userEmail: string, imageUri: string, onProgress?: (progress: number) => void): Promise<string> {
    return this.dataOps.uploadBannerImage(userEmail, imageUri, onProgress);
  }
  
  /**
   * Upload event images in batch
   */
  async uploadEventImages(eventId: number, imageUris: string[], onProgress?: (progress: number) => void) {
    const uploadPromises = imageUris.map((uri, index) => {
      return this.apiService.queueRequest('storage_upload', {
        data: {
          bucket: 'event-images',
          path: `${eventId}/${index}.jpg`,
          file: uri,
          options: {
            contentType: 'image/jpeg',
            upsert: true
          }
        },
        priority: 'medium',
        batch: 'image_uploads'
      });
    });
    
    return Promise.all(uploadPromises);
  }
  
  // ========== BATCH OPERATIONS ==========
  
  /**
   * Batch update multiple users (for admin operations)
   */
  async batchUpdateUsers(updates: Array<{ email: string; data: any }>) {
    const promises = updates.map(update => 
      this.apiService.queueRequest('update', {
        table: 'all_users',
        data: update.data,
        filters: { eq: { email: update.email } },
        priority: 'low',
        batch: 'admin_user_updates'
      })
    );
    
    return Promise.all(promises);
  }
  
  /**
   * Batch create events
   */
  async batchCreateEvents(events: any[]) {
    return this.apiService.queueRequest('insert', {
      table: 'new_events',
      data: { values: events },
      priority: 'medium',
      batch: 'event_operations'
    });
  }
  
  // ========== ADVANCED QUERIES ==========
  
  /**
   * Get recommended events with caching
   */
  async getRecommendedEvents(userId: number, userLat?: number, userLon?: number) {
    return this.apiService.queueRequest('rpc', {
      data: {
        functionName: 'get_recommended_events',
        params: { 
          user_id: userId,
          user_latitude: userLat,
          user_longitude: userLon
        }
      },
      priority: 'medium',
      cacheKey: `recommendations_${userId}_${userLat}_${userLon}`,
      cacheTTL: 180000 // 3 minutes cache for recommendations
    });
  }
  
  /**
   * Get events by location with caching
   */
  async getEventsByLocation(latitude: number, longitude: number, radiusKm: number = 25) {
    return this.apiService.queueRequest('rpc', {
      data: {
        functionName: 'get_events_by_location',
        params: { 
          center_lat: latitude,
          center_lon: longitude,
          radius_km: radiusKm
        }
      },
      priority: 'medium',
      cacheKey: `events_location_${latitude.toFixed(2)}_${longitude.toFixed(2)}_${radiusKm}`,
      cacheTTL: 300000 // 5 minutes cache for location-based events
    });
  }
  
  /**
   * Get trending events with caching
   */
  async getTrendingEvents(limit: number = 20) {
    return this.apiService.queueRequest('rpc', {
      data: {
        functionName: 'get_trending_events',
        params: { event_limit: limit }
      },
      priority: 'medium',
      cacheKey: `trending_events_${limit}`,
      cacheTTL: 600000 // 10 minutes cache for trending events
    });
  }
  
  // ========== ANALYTICS OPERATIONS ==========
  
  /**
   * Track user interaction (non-blocking, low priority)
   */
  async trackUserInteraction(userId: number, eventId: number, action: string) {
    // Fire and forget - don't block UI
    this.apiService.queueRequest('insert', {
      table: 'user_interactions',
      data: {
        user_id: userId,
        event_id: eventId,
        action,
        timestamp: new Date().toISOString()
      },
      priority: 'low',
      maxRetries: 1
    }).catch(error => {
      console.warn('Analytics tracking failed (non-critical):', error);
    });
  }
  
  // ========== UTILITY METHODS ==========
  
  /**
   * Get queue status for debugging
   */
  getQueueStatus() {
    return this.dataOps.getQueueStatus();
  }
  
  /**
   * Clear cache
   */
  clearCache(pattern?: string) {
    this.dataOps.clearCache(pattern);
  }
  
  /**
   * Set network status
   */
  setNetworkStatus(isOnline: boolean) {
    this.dataOps.setNetworkStatus(isOnline);
  }
  
  /**
   * Force sync offline operations
   */
  async syncOfflineOperations() {
    return this.dataOps.syncOfflineOperations();
  }
  
  // ========== FALLBACK METHODS FOR GRADUAL MIGRATION ==========
  
  /**
   * Direct supabase access for cases not yet optimized
   * This allows gradual migration while maintaining functionality
   */
  getSupabaseClient() {
    return supabase;
  }
}

export default OptimizedComponentServices;