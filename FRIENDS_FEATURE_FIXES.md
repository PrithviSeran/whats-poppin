# Friends Feature Fixes

## Issues Identified and Fixed

### 1. **Inconsistent Database Operations**
**Problem**: The codebase was using a mix of direct database operations and RPC function calls, with many RPC functions missing or broken.

**Components Affected**:
- `Discover.tsx` - Used broken `send_friend_request` RPC
- `FriendsModal.tsx` - Used broken `get_pending_friend_requests`, `get_user_friends`, `get_user_followers`, `get_user_following`, `unfollow_user` RPCs
- `Profile.tsx` - Used broken `get_followers_count`, `get_following_count` RPCs
- `UserProfileModal.tsx` - Used broken `follow_user`, `unfollow_user` RPCs

**Fix**: Replaced all broken RPC function calls with direct database operations for consistency and reliability.

### 2. **Friend Request Sending Issues**
**Problem**: Friend requests sent from `Discover.tsx` were not being received by other users because the `send_friend_request` RPC function didn't exist.

**Fix**: 
- Replaced RPC call with direct database operations in `Discover.tsx`
- Added proper duplicate checking and error handling
- Ensured consistent behavior across all components

### 3. **Friend Request Status Display Issues**
**Problem**: The `UserProfileModal` wasn't properly indicating when a friend request had been sent or received.

**Fix**:
- Improved the relationship status checking logic
- Added proper logging for debugging
- Fixed the status mapping between internal and external states

### 4. **Follow/Unfollow Functionality**
**Problem**: Follow and unfollow operations were failing because RPC functions were missing.

**Fix**:
- Replaced all RPC calls with direct database operations
- Added proper duplicate checking for follows
- Fixed auto-follow feature when sending friend requests

### 5. **Database Schema Support**
**Problem**: Required RPC functions were missing from the database.

**Fix**: Created `scripts/create_friend_functions.sql` with all necessary RPC functions:

#### Friend Request Functions:
- `send_friend_request(sender_id, receiver_id)` - Send a friend request
- `get_pending_friend_requests(target_user_id)` - Get pending requests for a user
- `accept_friend_request(request_id)` - Accept a friend request
- `decline_friend_request(request_id)` - Decline a friend request

#### Friends Management:
- `get_user_friends(target_user_id)` - Get user's friends list
- `remove_friend(user_id, friend_id)` - Remove a friendship

#### Follow System:
- `follow_user(follower_email, target_email)` - Follow a user
- `unfollow_user(follower_email, target_email)` - Unfollow a user
- `get_user_followers(target_user_id)` - Get user's followers
- `get_user_following(target_user_id)` - Get users being followed
- `get_followers_count(target_user_id)` - Get followers count
- `get_following_count(target_user_id)` - Get following count

#### Utility Functions:
- `check_friendship_status(user1_id, user2_id)` - Check relationship status between users

## Database Setup Instructions

### Step 1: Run the SQL Functions
Execute the SQL file in your Supabase database:

```sql
-- Run the contents of scripts/create_friend_functions.sql in your Supabase SQL editor
```

### Step 2: Verify Database Schema
Ensure your database has the following tables with proper structure:

#### `friend_requests` table:
```sql
CREATE TABLE friend_requests (
    id BIGSERIAL PRIMARY KEY,
    sender_id BIGINT REFERENCES all_users(id),
    receiver_id BIGINT REFERENCES all_users(id),
    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'blocked'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `friends` table:
```sql
CREATE TABLE friends (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES all_users(id),
    friend_id BIGINT REFERENCES all_users(id),
    status TEXT DEFAULT 'accepted', -- 'accepted', 'blocked'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, friend_id)
);
```

#### `follows` table:
```sql
CREATE TABLE follows (
    id BIGSERIAL PRIMARY KEY,
    follower_id BIGINT REFERENCES all_users(id),
    followed_id BIGINT REFERENCES all_users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_id, followed_id)
);
```

### Step 3: Set Up Row Level Security (RLS)
Enable RLS and create appropriate policies:

```sql
-- Enable RLS on all tables
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Example policies (adjust based on your auth setup)
CREATE POLICY "Users can view their own friend requests" ON friend_requests
    FOR SELECT USING (sender_id = auth.uid()::bigint OR receiver_id = auth.uid()::bigint);

CREATE POLICY "Users can create friend requests" ON friend_requests
    FOR INSERT WITH CHECK (sender_id = auth.uid()::bigint);

-- Add similar policies for friends and follows tables
```

## Changes Made to Components

### `components/Discover.tsx`
- ✅ Fixed `sendFriendRequest()` to use direct database operations
- ✅ Added proper error handling and duplicate checking
- ✅ Improved user feedback with proper alerts

### `components/FriendsModal.tsx`
- ✅ Fixed `fetchFriends()` to use direct database operations
- ✅ Fixed `fetchFriendRequests()` to use direct database operations
- ✅ Fixed `fetchFollowers()` and `fetchFollowing()` to use direct database operations
- ✅ Fixed `handleUnfollow()` to use direct database operations
- ✅ Added comprehensive logging for debugging

### `components/Profile.tsx`
- ✅ Fixed `fetchFollowCountsWithUserId()` to use direct database operations
- ✅ Improved error handling and logging

### `components/UserProfileModal.tsx`
- ✅ Fixed `handleFollow()` and `handleUnfollow()` to use direct database operations
- ✅ Fixed auto-follow feature in friend request sending
- ✅ Added proper duplicate checking for follows
- ✅ Improved relationship status detection

## Testing the Fixes

### Test Friend Request Flow:
1. User A sends friend request to User B via Discover or UserProfileModal
2. User B should see the friend request in their Profile > Friends > Requests tab
3. User B can accept/decline the request
4. Upon acceptance, both users should see each other in their friends list

### Test Follow Flow:
1. User A follows User B via UserProfileModal
2. User B should see User A in their followers list
3. User A should see User B in their following list
4. User A can unfollow User B

### Verify UI States:
- Friend request sent: Should show "Request Sent" button
- Friend request received: Should show "Accept/Decline" buttons
- Already friends: Should show "Friends" status
- Following: Should show "Unfollow" button
- Not following: Should show "Follow" button

## Benefits of These Fixes

1. **Reliability**: Direct database operations are more reliable than RPC functions
2. **Consistency**: All components now use the same approach
3. **Debugging**: Better logging makes issues easier to track
4. **Performance**: Reduced dependency on potentially broken RPC functions
5. **Maintainability**: Clearer code structure and error handling

## Future Improvements

1. **Real-time Updates**: Consider implementing real-time subscriptions for friend requests
2. **Batch Operations**: Optimize for bulk friend operations
3. **Caching**: Implement caching for frequently accessed friend lists
4. **Privacy Settings**: Add privacy controls for friend requests and follows

## Troubleshooting

### If friend requests still don't work:
1. Check database table structure matches expected schema
2. Verify RLS policies allow appropriate access
3. Check console logs for detailed error messages
4. Ensure user IDs are properly set in all operations

### If follow functionality doesn't work:
1. Verify `follows` table exists with proper foreign keys
2. Check that user profiles have valid IDs
3. Verify RLS policies on follows table

### If UserProfileModal doesn't show correct status:
1. Check `fetchRelationshipStatus()` function logs
2. Verify database queries return expected data structure
3. Ensure proper status mapping in the component 