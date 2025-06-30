import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// Social data interfaces
export interface Friend {
  friend_id: number;
  friend_name: string;
  friend_email: string;
  friendship_id: number;
  status: 'pending' | 'accepted' | 'blocked' | 'declined';
  created_at: string;
}

export interface FriendRequest {
  request_id: number;
  sender_id: number;
  sender_name: string;
  sender_email: string;
  created_at: string;
}

export interface Follower {
  follower_id: number;
  follower_name: string;
  follower_email: string;
  created_at: string;
}

export interface Following {
  following_id: number;
  following_name: string;
  following_email: string;
  created_at: string;
}

export interface SocialData {
  friends: Friend[];
  friendRequests: FriendRequest[];
  followers: Follower[];
  following: Following[];
  followersCount: number;
  followingCount: number;
  lastUpdated: number; // timestamp
}

class SocialDataManager {
  private static instance: SocialDataManager;
  private currentUserId: number | null = null;

  private constructor() {}

  static getInstance(): SocialDataManager {
    if (!SocialDataManager.instance) {
      SocialDataManager.instance = new SocialDataManager();
    }
    return SocialDataManager.instance;
  }

  private getCacheKey(userId: number, dataType: string): string {
    return `social_${dataType}_${userId}`;
  }

  private async getCachedData(userId: number): Promise<SocialData | null> {
    try {
      const cacheKey = this.getCacheKey(userId, 'all');
      const cachedDataStr = await AsyncStorage.getItem(cacheKey);
      if (cachedDataStr) {
        const cachedData = JSON.parse(cachedDataStr) as SocialData;
        console.log('📱 OFFLINE-FIRST: Found cached social data for user', userId);
        return cachedData;
      }
      return null;
    } catch (error) {
      console.error('❌ Error getting cached social data:', error);
      return null;
    }
  }

  private async setCachedData(userId: number, data: SocialData): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(userId, 'all');
      data.lastUpdated = Date.now();
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      console.log('✅ OFFLINE-FIRST: Cached social data for user', userId);
    } catch (error) {
      console.error('❌ Error caching social data:', error);
    }
  }

  private async fetchFriendsFromDatabase(userId: number): Promise<Friend[]> {
    try {
      console.log('🔍 Fetching friends from database for user', userId);
      
      const { data: directData, error: directError } = await supabase
        .from('friends')
        .select(`
          id,
          friend_id,
          status,
          created_at,
          all_users!friends_friend_id_fkey (
            id,
            name,
            email
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'accepted');

      if (directError) {
        console.error('🚨 Error fetching friends:', directError);
        throw directError;
      }

      return directData?.map((friend: any) => ({
        friend_id: friend.friend_id,
        friend_name: friend.all_users?.name || 'Unknown',
        friend_email: friend.all_users?.email || 'Unknown',
        friendship_id: friend.id,
        status: friend.status,
        created_at: friend.created_at
      })) || [];
    } catch (error) {
      console.error('🚨 Error fetching friends from database:', error);
      return [];
    }
  }

  private async fetchFriendRequestsFromDatabase(userId: number): Promise<FriendRequest[]> {
    try {
      console.log('🔍 Fetching friend requests from database for user', userId);
      
      const { data: directData, error: directError } = await supabase
        .from('friend_requests')
        .select('id, sender_id, created_at, status')
        .eq('receiver_id', userId);

      if (directError) {
        console.error('🚨 Error fetching friend requests:', directError);
        throw directError;
      }

      // Filter for pending requests
      const pendingRequests = directData?.filter(req => req.status === 'pending') || [];

      // Get sender details
      const senderIds = pendingRequests.map(req => req.sender_id);
      let senderDetails: any[] = [];
      if (senderIds.length > 0) {
        const { data: sendersData } = await supabase
          .from('all_users')
          .select('id, name, email')
          .in('id', senderIds);
        senderDetails = sendersData || [];
      }

      return pendingRequests.map(request => {
        const sender = senderDetails.find(s => s.id === request.sender_id);
        return {
          request_id: request.id,
          sender_id: request.sender_id,
          sender_name: sender?.name || 'Unknown',
          sender_email: sender?.email || 'Unknown',
          created_at: request.created_at
        };
      });
    } catch (error) {
      console.error('🚨 Error fetching friend requests from database:', error);
      return [];
    }
  }

  private async fetchFollowersFromDatabase(userId: number): Promise<Follower[]> {
    try {
      console.log('🔍 Fetching followers from database for user', userId);
      
      const { data: directData, error: directError } = await supabase
        .from('follows')
        .select(`
          id,
          follower_id,
          created_at,
          all_users!follows_follower_id_fkey (
            id,
            name,
            email
          )
        `)
        .eq('followed_id', userId);

      if (directError) {
        console.error('🚨 Error fetching followers:', directError);
        throw directError;
      }

      return directData?.map((follow: any) => ({
        follower_id: follow.follower_id,
        follower_name: follow.all_users?.name || 'Unknown',
        follower_email: follow.all_users?.email || 'Unknown',
        created_at: follow.created_at
      })) || [];
    } catch (error) {
      console.error('🚨 Error fetching followers from database:', error);
      return [];
    }
  }

  private async fetchFollowingFromDatabase(userId: number): Promise<Following[]> {
    try {
      console.log('🔍 Fetching following from database for user', userId);
      
      const { data: directData, error: directError } = await supabase
        .from('follows')
        .select(`
          id,
          followed_id,
          created_at,
          all_users!follows_followed_id_fkey (
            id,
            name,
            email
          )
        `)
        .eq('follower_id', userId);

      if (directError) {
        console.error('🚨 Error fetching following:', directError);
        throw directError;
      }

      return directData?.map((follow: any) => ({
        following_id: follow.followed_id,
        following_name: follow.all_users?.name || 'Unknown',
        following_email: follow.all_users?.email || 'Unknown',
        created_at: follow.created_at
      })) || [];
    } catch (error) {
      console.error('🚨 Error fetching following from database:', error);
      return [];
    }
  }

  async refreshAllSocialData(userId: number, forceRefresh: boolean = false): Promise<SocialData> {
    console.log('🚀 OFFLINE-FIRST: Refreshing social data for user', userId, forceRefresh ? '(forced)' : '');
    
    // Check cache first unless forced refresh
    if (!forceRefresh) {
      const cachedData = await this.getCachedData(userId);
      if (cachedData) {
        const cacheAge = Date.now() - cachedData.lastUpdated;
        const maxCacheAge = 5 * 60 * 1000; // 5 minutes
        
        if (cacheAge < maxCacheAge) {
          console.log('✅ OFFLINE-FIRST: Using cached social data (age:', Math.round(cacheAge / 1000), 'seconds)');
          return cachedData;
        } else {
          console.log('🔄 Cache expired, fetching fresh data (age:', Math.round(cacheAge / 1000), 'seconds)');
        }
      }
    }

    // Fetch fresh data from database
    console.log('📡 Fetching fresh social data from database');
    const [friends, friendRequests, followers, following] = await Promise.all([
      this.fetchFriendsFromDatabase(userId),
      this.fetchFriendRequestsFromDatabase(userId),
      this.fetchFollowersFromDatabase(userId),
      this.fetchFollowingFromDatabase(userId)
    ]);

    const socialData: SocialData = {
      friends,
      friendRequests,
      followers,
      following,
      followersCount: followers.length,
      followingCount: following.length,
      lastUpdated: Date.now()
    };

    // Cache the fresh data
    await this.setCachedData(userId, socialData);
    
    console.log('✅ Social data refreshed and cached:', {
      friends: friends.length,
      requests: friendRequests.length,
      followers: followers.length,
      following: following.length
    });

    return socialData;
  }

  async getSocialData(userId: number): Promise<SocialData> {
    this.currentUserId = userId;
    return this.refreshAllSocialData(userId, false);
  }

  // Update methods that sync both database and cache
  async acceptFriendRequest(requestId: number, senderId: number, receiverId: number): Promise<boolean> {
    try {
      console.log('🤝 Accepting friend request:', requestId);

      // Update database
      const { error: updateError } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Create friendship entries
      const friendshipData = [
        {
          user_id: senderId,
          friend_id: receiverId,
          status: 'accepted',
          created_at: new Date().toISOString()
        },
        {
          user_id: receiverId,
          friend_id: senderId,
          status: 'accepted',
          created_at: new Date().toISOString()
        }
      ];

      const { error: friendshipError } = await supabase
        .from('friends')
        .insert(friendshipData);

      if (friendshipError && !friendshipError.message?.includes('duplicate')) {
        throw friendshipError;
      }

      // Refresh cache for both users
      await this.refreshAllSocialData(senderId, true);
      await this.refreshAllSocialData(receiverId, true);

      console.log('✅ Friend request accepted and cache updated');
      return true;
    } catch (error) {
      console.error('❌ Error accepting friend request:', error);
      return false;
    }
  }

  async removeFriend(userId: number, friendId: number): Promise<boolean> {
    try {
      console.log('💔 Removing friend:', friendId);

      // Remove from database
      const { error: removeError } = await supabase
        .from('friends')
        .delete()
        .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);

      if (removeError) throw removeError;

      // Refresh cache for both users
      await this.refreshAllSocialData(userId, true);
      await this.refreshAllSocialData(friendId, true);

      console.log('✅ Friend removed and cache updated');
      return true;
    } catch (error) {
      console.error('❌ Error removing friend:', error);
      return false;
    }
  }

  async unfollowUser(followerId: number, followedId: number): Promise<boolean> {
    try {
      console.log('👋 Unfollowing user:', followedId);

      // Remove from database
      const { error: unfollowError } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', followerId)
        .eq('followed_id', followedId);

      if (unfollowError) throw unfollowError;

      // Refresh cache for both users
      await this.refreshAllSocialData(followerId, true);
      await this.refreshAllSocialData(followedId, true);

      console.log('✅ User unfollowed and cache updated');
      return true;
    } catch (error) {
      console.error('❌ Error unfollowing user:', error);
      return false;
    }
  }

  async declineFriendRequest(requestId: number, receiverId: number): Promise<boolean> {
    try {
      console.log('❌ Declining friend request:', requestId);

      // Update database
      const { error: updateError } = await supabase
        .from('friend_requests')
        .update({ status: 'declined', updated_at: new Date().toISOString() })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Refresh cache for receiver
      await this.refreshAllSocialData(receiverId, true);

      console.log('✅ Friend request declined and cache updated');
      return true;
    } catch (error) {
      console.error('❌ Error declining friend request:', error);
      return false;
    }
  }

  // Clear cache (for logout, etc.)
  async clearCache(userId?: number): Promise<void> {
    try {
      if (userId) {
        const cacheKey = this.getCacheKey(userId, 'all');
        await AsyncStorage.removeItem(cacheKey);
        console.log('🗑️ Cleared social cache for user', userId);
      } else {
        // Clear all social cache
        const keys = await AsyncStorage.getAllKeys();
        const socialKeys = keys.filter(key => key.startsWith('social_'));
        await AsyncStorage.multiRemove(socialKeys);
        console.log('🗑️ Cleared all social cache');
      }
    } catch (error) {
      console.error('❌ Error clearing social cache:', error);
    }
  }
}

export default SocialDataManager; 