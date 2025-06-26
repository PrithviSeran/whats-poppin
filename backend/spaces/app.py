# app.py for Hugging Face Spaces with Docker + FastAPI
import json
import os
from datetime import datetime
from typing import List, Optional, Union
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from datetime import datetime, timedelta
import uvicorn
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from beacon_torch_cloud import HuggingFaceBeaconAI

AGE_GROUPS = ['18-24', '25-34', '35-49', '50-99']
GENDER = ['male', 'female', 'other']
TIME_TAGS = {
    'morning':   {'start': '05:00', 'end': '12:00'},   # 5:00 AM - 12:00 PM
    'afternoon': {'start': '12:00', 'end': '17:00'},   # 12:00 PM - 5:00 PM
    'evening':   {'start': '17:00', 'end': '21:00'},   # 5:00 PM - 9:00 PM
    'night':     {'start': '21:00', 'end': '05:00'},   # 9:00 PM - 5:00 AM (overnight)
    'weekend':   {'start': '00:00', 'end': '23:59'},   # All day Saturday & Sunday (special handling)
}
AGE_RESTRICTIONS = ['18+', '21+', '16+', '13+']
COST_RANGES = ['$', '$$', '$$$', '$$$$']
RESERVATION_REQUIRED = ['yes', 'no']
EVENT_TYPES = [
    'Food & Drink',
    'Outdoor / Nature',
    'Leisure & Social',
    'Games & Entertainment',
    'Arts & Culture',
    'Nightlife & Parties',
    'Wellness & Low-Energy',
    'Experiences & Activities',
    'Travel & Discovery'
]

# Initialize FastAPI app
app = FastAPI(
    title="Event Recommendation API",
    description="Get personalized event recommendations based on your preferences and location",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for request/response
class RecommendationRequest(BaseModel):
    email: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    filter_distance: bool = True
    rejected_events: Union[List[int], str] = []
    use_calendar_filter: bool = False
    selected_dates: Optional[List[str]] = None
    user_start_time: Optional[str] = None
    user_end_time: Optional[str] = None

class RecommendationResponse(BaseModel):
    summary: str
    events: List[dict]
    total_found: int

class EventRecommendationSystem:
    def __init__(self):
        # Initialize Supabase client using environment variables
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_ANON_KEY")
        
        if not supabase_url or not supabase_key:
            raise ValueError("Please set SUPABASE_URL and SUPABASE_ANON_KEY in your Space secrets")
        
        self.Client = create_client(supabase_url, supabase_key)
        
        # Initialize cloud-native BeaconAI
        self.rec = HuggingFaceBeaconAI(
            supabase_url=supabase_url,
            supabase_key=supabase_key,
            embedding_dim=32,
            user_id=None  # Set to specific user ID for per-user models
        )
    
    def get_user_data(self, email):
        """Fetch user data from Supabase"""
        try:
            result = self.Client.table("all_users").select(
                "id, preferences, travel-distance, saved_events, saved_events_all_time, rejected_events, start-time, end-time, birthday, gender, preferred_days"
            ).eq("email", email).maybe_single().execute()
            return result.data
        except Exception as e:
            print(f"Error fetching user data: {e}")
            return None
    
    def get_user_social_connections(self, user_id):
        """Get list of user's friends and following with their saved events for social recommendations"""
        try:
            social_connections = []
            
            # Get user's friends using the RPC function
            friends_result = self.Client.rpc('get_user_friends', {
                'target_user_id': user_id
            }).execute()
            
            # Get user's following using the RPC function
            following_result = self.Client.rpc('get_user_following', {
                'target_user_id': user_id
            }).execute()
            
            # Collect all connection emails
            connection_emails = []
            
            if friends_result.data:
                friend_emails = [friend['friend_email'] for friend in friends_result.data]
                connection_emails.extend(friend_emails)
                print(f"🤝 Found {len(friend_emails)} friends for user {user_id}")
            
            if following_result.data:
                following_emails = [following['following_email'] for following in following_result.data]
                connection_emails.extend(following_emails)
                print(f"👥 Found {len(following_emails)} following for user {user_id}")
            
            # Remove duplicates (some people might be both friends and followed)
            unique_emails = list(set(connection_emails))
            
            # Get social connections' saved events
            if unique_emails:
                connections_data = self.Client.table("all_users").select(
                    "email, saved_events, saved_events_all_time"
                ).in_("email", unique_emails).execute()
                
                print(f"🌐 Total unique social connections: {len(unique_emails)}")
                return connections_data.data
            
            return []
        except Exception as e:
            print(f"Error fetching user social connections: {e}")
            return []
        
    def get_age_group(self, age):
        if age is None:
            return None
        if 18 <= age <= 24:
            return "18-24"
        elif 25 <= age <= 34:
            return "25-34"
        elif 35 <= age <= 49:
            return "35-49"
        elif age >= 50:
            return "50+"
        else:
            return "Under 18"
        
    def time_in_range(self, start, end, t):
        """Return true if t is in the range [start, end). Handles overnight ranges."""
        if start <= end:
            return start <= t < end
        else:  # Over midnight
            return t >= start or t < end
    
    def time_ranges_overlap(self, user_start, user_end, event_start, event_end):
        """Check if two time ranges overlap, handling overnight periods correctly"""
        if user_start is None or user_end is None or event_start is None or event_end is None:
            return False
        
        # Handle normal day ranges (no midnight crossing)
        if user_start <= user_end and event_start <= event_end:
            # Standard overlap check: ranges overlap if start1 < end2 and start2 < end1
            return user_start < event_end and event_start < user_end
        
        # Handle overnight ranges
        elif user_start > user_end and event_start <= event_end:
            # User range crosses midnight, event range is normal
            # User time is either [user_start, 23:59] OR [00:00, user_end]
            return (user_start < event_end) or (event_start < user_end)
        
        elif user_start <= user_end and event_start > event_end:
            # Event range crosses midnight, user range is normal
            # Event time is either [event_start, 23:59] OR [00:00, event_end]
            return (event_start < user_end) or (user_start < event_end)
        
        else:
            # Both ranges cross midnight
            # If both cross midnight, they overlap (both include some part of late night/early morning)
            return True
        
    def get_time_tag(self, start_time_str, end_time_str):
        print(start_time_str, end_time_str)
        start_time = self.parse_time(start_time_str)
        end_time = self.parse_time(end_time_str)
        if start_time is None or end_time is None:
            return None  # or return a default tag, e.g., "unknown"
        
        # Round times to nearest hour
        start_dt = datetime.combine(datetime.today(), start_time)
        end_dt = datetime.combine(datetime.today(), end_time)
        
        # Round to nearest hour
        start_dt = start_dt.replace(minute=0, second=0, microsecond=0)
        end_dt = end_dt.replace(minute=0, second=0, microsecond=0)
        
        # Convert back to time objects
        start_time = start_dt.time()
        end_time = end_dt.time()
        
        tag_scores = {}

        # Handle overnight user time range
        t = start_time
        while True:
            for tag, rng in TIME_TAGS.items():
                tag_start = self.parse_time(rng['start'])
                tag_end = self.parse_time(rng['end'])
                if self.time_in_range(tag_start, tag_end, t):
                    tag_scores[tag] = tag_scores.get(tag, 0) + 1
            # Increment by 1 hour
            t_dt = (datetime.combine(datetime.today(), t) + timedelta(hours=1))
            t = t_dt.time()
            if t == end_time:
                break

        if not tag_scores:
            return None
        best_tag = max(tag_scores, key=tag_scores.get)
        print("Best Tag: ", best_tag)

        return best_tag

    
    def calculate_age(self, birthday_str):
        # Try both 'YYYY-MM-DD' and 'MM/DD/YYYY'
        for fmt in ("%Y-%m-%d", "%m/%d/%Y"):
            try:
                birthday = datetime.strptime(birthday_str, fmt)
                break
            except ValueError:
                continue
        else:
            raise ValueError(f"Unknown date format: {birthday_str}")
        
        today = datetime.today()
        age = today.year - birthday.year - ((today.month, today.day) < (birthday.month, birthday.day))

        return age
    
    def get_events_data(self, user_preferences=None):
        """Fetch events data from Supabase with optional filtering"""
        try:
            query = self.Client.table("all_events").select("*")
            
            if user_preferences:
                # Check if "Featured Events" is in user preferences
                if "Featured Events" in user_preferences:
                    # If only "Featured Events" is selected, return only featured events
                    if len(user_preferences) == 1:
                        query = query.eq('featured', True)
                    else:
                        # If "Featured Events" plus other categories, filter by event types first, then featured
                        other_preferences = [pref for pref in user_preferences if pref != "Featured Events"]
                        preferences_array = '{' + ','.join(f'"{pref}"' for pref in other_preferences) + '}'
                        # Use AND logic: filter by event types first, then only show featured events from those types
                        query = query.filter('event_type', 'ov', preferences_array).eq('featured', True)
                else:
                    # Normal filtering by event types only
                    preferences_array = '{' + ','.join(f'"{pref}"' for pref in user_preferences) + '}'
                    query = query.filter('event_type', 'ov', preferences_array)
            
            result = query.execute()
            return result.data
        except Exception as e:
            print(f"Error fetching events data: {e}")
            return []
        
    def parse_event_types(self, event_type):
        if isinstance(event_type, list):
            return tuple(event_type)
        elif isinstance(event_type, str):
            # Split by comma if multiple types are stored as a comma-separated string
            return tuple(e.strip().strip('"') for e in event_type.strip('{}').split(',') if e.strip())
        else:
            return tuple()
    
    def get_all_users(self):
        """Fetch all users for building interactions"""
        try:
            result = self.Client.table("all_users").select("*").execute()
            return result.data
        except Exception as e:
            print(f"Error fetching all users: {e}")
            return []
    
    def parse_preferences(self, preferences):
        """Parse user preferences - implement your logic"""
        if isinstance(preferences, list):
            return tuple(preferences)
        elif isinstance(preferences, str):
            return tuple(e.strip().strip('"') for e in preferences.strip('{}').split(',') if e.strip())
        else:
            return tuple()
    
    def parse_days(self, days):
        """Parse preferred days - implement your logic"""
       # Handles both Postgres array string and Python list
        if isinstance(days, list):
            return [d.strip() for d in days if d.strip()]
        elif isinstance(days, str):
            return [d.strip().strip('"') for d in days.strip('{}').split(',') if d.strip()]
        else:
            return []
        
    def parse_time(self, tstr):
        if tstr is None:
            return None
        for fmt in ("%H:%M", "%H:%M:%S"):
            try:
                return datetime.strptime(tstr, fmt).time()
            except ValueError:
                continue
        raise ValueError(f"Unknown time format: {tstr}")
    
    def filter_by_time(self, events, start_time, end_time):
        """Filter events by time preferences using the new times field"""
        def parse_time_str(tstr):
            if not tstr:
                return None
            try:
                return datetime.strptime(str(tstr), '%H:%M').time()
            except (ValueError, TypeError):
                return None

        def is_time_in_range(start, end, t):
            if t is None or start is None or end is None:
                return False
            if start <= end:
                return start <= t <= end
            else:  # Handles cases where time range crosses midnight
                return t >= start or t <= end

        # Parse user's start_time and end_time to datetime.time objects
        user_start = parse_time_str(start_time)
        user_end = parse_time_str(end_time)
        
        if user_start is None or user_end is None:
            # If we can't parse user times, don't filter by time
            return events

        def extract_times_from_event(event):
            """Extract time ranges from various possible event time fields"""
            time_ranges = []
            
            # Try the new 'times' field first
            times_data = event.get('times', {})
            if times_data and isinstance(times_data, dict):
                for day, time_info in times_data.items():
                    if time_info == 'all_day':
                        # 24-hour businesses are always available
                        time_ranges.append((datetime.strptime('00:00', '%H:%M').time(), 
                                          datetime.strptime('23:59', '%H:%M').time()))
                    elif isinstance(time_info, (list, tuple)) and len(time_info) == 2:
                        start_str, end_str = time_info
                        start_t = parse_time_str(start_str)
                        end_t = parse_time_str(end_str)
                        if start_t and end_t:
                            time_ranges.append((start_t, end_t))
            
            # Fallback: try legacy fields
            if not time_ranges:
                # Try start_time and end_time fields
                start_time = event.get('start_time') or event.get('startTime')
                end_time = event.get('end_time') or event.get('endTime')
                
                if start_time and end_time:
                    start_t = parse_time_str(start_time)
                    end_t = parse_time_str(end_time)
                    if start_t and end_t:
                        time_ranges.append((start_t, end_t))
                
                # Try opening_hours field
                opening_hours = event.get('opening_hours') or event.get('hours')
                if opening_hours and isinstance(opening_hours, str):
                    # Parse formats like "09:00-17:00" or "9 AM - 5 PM"
                    import re
                    time_pattern = r'(\d{1,2}):?(\d{0,2})\s*(?:AM|PM)?\s*[-–]\s*(\d{1,2}):?(\d{0,2})\s*(?:AM|PM)?'
                    match = re.search(time_pattern, opening_hours, re.IGNORECASE)
                    if match:
                        try:
                            start_hour, start_min, end_hour, end_min = match.groups()
                            start_min = start_min or '00'
                            end_min = end_min or '00'
                            start_str = f"{start_hour.zfill(2)}:{start_min.zfill(2)}"
                            end_str = f"{end_hour.zfill(2)}:{end_min.zfill(2)}"
                            start_t = parse_time_str(start_str)
                            end_t = parse_time_str(end_str)
                            if start_t and end_t:
                                time_ranges.append((start_t, end_t))
                        except:
                            pass
            
            return time_ranges

        filtered_events = []
        for event in events:
            # Extract time ranges from the new times field
            event_time_ranges = extract_times_from_event(event)
            
            # If no time data available, let it through (for events without specific hours)
            if not event_time_ranges:
                filtered_events.append(event)
                continue
            
            # Check if any of the event's time ranges overlap with user's preferred time
            time_overlap = False
            for event_start, event_end in event_time_ranges:
                # Check for any overlap between user time range and event time range
                # Overlap exists if: user_start < event_end AND user_end > event_start
                # This handles all overlap scenarios correctly
                if self.time_ranges_overlap(user_start, user_end, event_start, event_end):
                    time_overlap = True
                    break
            
            if time_overlap:
                filtered_events.append(event)
            
        return filtered_events
    
    def filter_by_dates(self, events, selected_dates):
        """Filter events by specific calendar dates"""
        if not selected_dates:
            return events
            
        from datetime import datetime, timedelta
        
        # Parse selected dates
        parsed_dates = []
        for date_str in selected_dates:
            try:
                parsed_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                parsed_dates.append(parsed_date)
            except ValueError:
                print(f"Invalid date format: {date_str}")
                continue
        
        if not parsed_dates:
            return events
            
        filtered_events = []
        
        for event in events:
            occurrence = event.get("occurrence", "")
            
            if occurrence == "single" or occurrence == "one-time":
                # For single events, check if the event date matches any selected date
                event_start_date = event.get("start_date")
                if event_start_date:
                    try:
                        if isinstance(event_start_date, str):
                            event_date = datetime.strptime(event_start_date, '%Y-%m-%d').date()
                        else:
                            event_date = event_start_date
                        
                        if event_date in parsed_dates:
                            filtered_events.append(event)
                    except (ValueError, TypeError):
                        print(f"Invalid event date format: {event_start_date}")
                        continue
                        
            elif occurrence == "ongoing" or occurrence == "Weekly":
                # For ongoing/weekly events, check if any selected date falls on the event's operating days
                event_days = self.parse_days(event.get("days_of_the_week", []))
                
                if event_days:
                    # Check if any selected date falls on the event's operating days
                    for selected_date in parsed_dates:
                        day_name = selected_date.strftime('%A')  # Get day name (Monday, Tuesday, etc.)
                        if day_name in event_days:
                            filtered_events.append(event)
                            break  # Found a match, no need to check other dates for this event
                else:
                    # If no specific days are set for ongoing events, include them
                    # (assuming they're available on all selected dates)
                    filtered_events.append(event)
            else:
                # For other occurrence types, include the event
                filtered_events.append(event)
        
        print(f"Date filtering: {len(events)} -> {len(filtered_events)} events")
        return filtered_events

    def filter_by_occurrence(self, events, preferred_days):
        """Filter events by occurrence days - implement your logic"""
        user_preferred_days = self.parse_days(preferred_days)
        filtered_by_occurrence = []
        for event in events:
            occurrence = event.get("occurrence", "")
            if occurrence != "Weekly":
                filtered_by_occurrence.append(event)
            else:
                event_days = self.parse_days(event.get("days_of_the_week", []))
                # Check for intersection
                if any(day in user_preferred_days for day in event_days):
                    filtered_by_occurrence.append(event)
        events = filtered_by_occurrence
        return events
    
    def apply_distance_filter(self, events, lat, lng, filter_by_distance, max_distance):
        """Apply distance filtering - implement your logic"""
        all_events_filtered = []
        distance_threshold_km = max_distance

        if filter_by_distance and lat is not None and lng is not None:
            for event in events:
                event_latitude = event.get("latitude")
                event_longitude = event.get("longitude")
                # Check if event has location data
                if event_latitude is not None and event_longitude is not None:
                    distance = self.calculate_distance(
                        lat,
                        lng,
                        event_latitude,
                        event_longitude
                    )
                    # Add distance field to the event object
                    event["distance"] = distance
                    # Only include events within the user's travel distance threshold
                    if distance <= distance_threshold_km:
                        all_events_filtered.append(event)
                else:
                    # Optionally include events without location data, or filter them out
                    event["distance"] = None
                    all_events_filtered.append(event)
        else:
            # If not filtering by distance, use all events filtered by preferences
            all_events_filtered = events
            # Still add distance field if location data is available
            if lat is not None and lng is not None:
                for event in all_events_filtered:
                    event_latitude = event.get("latitude")
                    event_longitude = event.get("longitude")
                    if event_latitude is not None and event_longitude is not None:
                        distance = self.calculate_distance(
                            lat,
                            lng,
                            event_latitude,
                            event_longitude
                        )
                        event["distance"] = distance
                    else:
                        event["distance"] = None
        return all_events_filtered
    
    def build_interactions(self, users):
        """Build user interactions using saved_events_all_time for richer interaction history"""
        interactions = []
        total_users_with_interactions = 0
        
        for user in users:
            user_name = user.get("email")
            if not user_name:
                continue
            
            # Use saved_events_all_time for comprehensive interaction history
            saved_events_all_time = user.get("saved_events_all_time", [])
            
            # Fallback to saved_events if saved_events_all_time is not available
            if not saved_events_all_time:
                saved_events_all_time = user.get("saved_events", [])
            
            # Ensure saved_events_all_time is not None and is iterable
            if saved_events_all_time is None:
                saved_events_all_time = []
            elif isinstance(saved_events_all_time, str):
                try:
                    saved_events_all_time = [int(e.strip()) for e in saved_events_all_time.strip('{}').split(',') if e.strip()]
                except (ValueError, AttributeError):
                    saved_events_all_time = []
            elif not isinstance(saved_events_all_time, (list, tuple)):
                saved_events_all_time = []
            
            # Skip users with no interactions
            if not saved_events_all_time:
                continue
                
            total_users_with_interactions += 1
            
            # Get current saved events for weighting
            current_saved_events = user.get("saved_events", [])
            if current_saved_events is None:
                current_saved_events = []
            elif isinstance(current_saved_events, str):
                try:
                    current_saved_events = [int(e.strip()) for e in current_saved_events.strip('{}').split(',') if e.strip()]
                except (ValueError, AttributeError):
                    current_saved_events = []
            elif not isinstance(current_saved_events, (list, tuple)):
                current_saved_events = []
            
            current_saved_set = set(current_saved_events)
            
            # Create weighted interactions
            for event_id in saved_events_all_time:
                try:
                    event_id = int(event_id)
                    # Give higher weight (2.0) to currently saved events, normal weight (1.0) to historical likes
                    weight = 2.0 if event_id in current_saved_set else 1.0
                    interactions.append((user_name, event_id, weight))
                except (ValueError, TypeError):
                    # Skip invalid event IDs
                    continue
                
        print(f"Built {len(interactions)} interactions from {total_users_with_interactions} users with saved_events_all_time data")
        
        # Log some statistics for debugging
        if interactions:
            unique_users = len(set(interaction[0] for interaction in interactions))
            unique_events = len(set(interaction[1] for interaction in interactions))
            avg_interactions_per_user = len(interactions) / unique_users if unique_users > 0 else 0
            print(f"Interaction stats: {unique_users} unique users, {unique_events} unique events, {avg_interactions_per_user:.2f} avg interactions per user")
        
        return interactions
    
    def is_featured_event(self, event_id):
        """Helper method to check if an event is featured"""
        try:
            result = self.Client.table("all_events").select("featured").eq("id", event_id).single().execute()
            return result.data.get("featured", False) if result.data else False
        except Exception:
            return False
    
    def build_enhanced_interactions(self, users, target_user_email=None, social_connections_data=None):
        """Build enhanced interactions including both positive (saved) and negative (rejected) interactions with social boosting"""
        interactions = []
        total_users_with_interactions = 0
        
        # Build social connections events set for boosting
        social_saved_events = set()
        if target_user_email and social_connections_data:
            for connection in social_connections_data:
                connection_saved = connection.get("saved_events_all_time", []) or connection.get("saved_events", [])
                if connection_saved:
                    if isinstance(connection_saved, str):
                        try:
                            connection_saved = [int(e.strip()) for e in connection_saved.strip('{}').split(',') if e.strip()]
                        except (ValueError, AttributeError):
                            connection_saved = []
                    elif not isinstance(connection_saved, (list, tuple)):
                        connection_saved = []
                    
                    social_saved_events.update(connection_saved)
            
            print(f"🌐 Social network: {len(social_connections_data)} connections with {len(social_saved_events)} unique saved events")
        
        for user in users:
            user_name = user.get("email")
            if not user_name:
                continue
            
            user_has_interactions = False
            is_target_user = (user_name == target_user_email)
            
            # Positive interactions from saved_events_all_time
            saved_events_all_time = user.get("saved_events_all_time", [])
            if not saved_events_all_time:
                saved_events_all_time = user.get("saved_events", [])
            
            # Ensure saved_events_all_time is not None and is iterable
            if saved_events_all_time is None:
                saved_events_all_time = []
            elif isinstance(saved_events_all_time, str):
                try:
                    saved_events_all_time = [int(e.strip()) for e in saved_events_all_time.strip('{}').split(',') if e.strip()]
                except (ValueError, AttributeError):
                    saved_events_all_time = []
            elif not isinstance(saved_events_all_time, (list, tuple)):
                saved_events_all_time = []
            
            # Get current saved events for weighting
            current_saved_events = user.get("saved_events", [])
            if current_saved_events is None:
                current_saved_events = []
            elif isinstance(current_saved_events, str):
                try:
                    current_saved_events = [int(e.strip()) for e in current_saved_events.strip('{}').split(',') if e.strip()]
                except (ValueError, AttributeError):
                    current_saved_events = []
            elif not isinstance(current_saved_events, (list, tuple)):
                current_saved_events = []
            
            current_saved_set = set(current_saved_events)
            
            # Add positive interactions with enhanced weighting
            for event_id in saved_events_all_time:
                try:
                    event_id = int(event_id)
                    # Higher weight for currently saved events
                    base_weight = 2.0 if event_id in current_saved_set else 1.0
                    
                    # FEATURED BOOST: Check if this is a featured event
                    is_featured = self.is_featured_event(event_id)
                    featured_multiplier = 1.5 if is_featured else 1.0
                    
                    # SOCIAL BOOST: For target user, boost events that social connections have saved
                    social_multiplier = 1.0
                    if is_target_user and event_id in social_saved_events:
                        social_multiplier = 1.8  # 80% boost for socially-saved events
                        print(f"🎯 Social boost applied to event {event_id} for user {user_name}")
                    
                    final_weight = base_weight * featured_multiplier * social_multiplier
                    interactions.append((user_name, event_id, final_weight))
                    user_has_interactions = True
                except (ValueError, TypeError):
                    continue
            
            # SOCIAL RECOMMENDATION INJECTION: Add virtual interactions for socially-saved events
            if is_target_user and social_saved_events:
                target_saved_set = set(saved_events_all_time)
                for social_event_id in social_saved_events:
                    if social_event_id not in target_saved_set:  # Don't duplicate existing interactions
                        # Add synthetic positive interaction based on social recommendation
                        social_rec_weight = 1.2  # Medium positive weight for social recommendations
                        interactions.append((user_name, social_event_id, social_rec_weight))
                        user_has_interactions = True
            
            # Negative interactions from rejected_events (with reduced penalty for featured)
            rejected_events = user.get("rejected_events", [])
            if rejected_events is None:
                rejected_events = []
            elif isinstance(rejected_events, str):
                try:
                    rejected_events = [int(e.strip()) for e in rejected_events.strip('{}').split(',') if e.strip()]
                except (ValueError, AttributeError):
                    rejected_events = []
            elif not isinstance(rejected_events, (list, tuple)):
                rejected_events = []
            
            # Add negative interactions with reduced penalty for featured events and friend-saved events
            for event_id in rejected_events:
                try:
                    event_id = int(event_id)
                    # FEATURED PROTECTION: Reduce negative impact for featured events
                    is_featured = self.is_featured_event(event_id)
                    base_negative_weight = -0.25 if is_featured else -0.5
                    
                    # SOCIAL PROTECTION: Reduce negative impact if social connections have saved this event
                    if is_target_user and event_id in social_saved_events:
                        base_negative_weight *= 0.5  # Halve the negative impact for socially-saved events
                        print(f"🛡️ Social protection applied to rejected event {event_id} for user {user_name}")
                    
                    interactions.append((user_name, event_id, base_negative_weight))
                    user_has_interactions = True
                except (ValueError, TypeError):
                    continue
            
            if user_has_interactions:
                total_users_with_interactions += 1
                
        print(f"Built {len(interactions)} enhanced interactions (positive + negative + friends) from {total_users_with_interactions} users")
        
        # Log statistics
        if interactions:
            positive_interactions = [i for i in interactions if i[2] > 0]
            negative_interactions = [i for i in interactions if i[2] < 0]
            social_boosted = [i for i in interactions if i[2] > 2.5]  # Likely socially-boosted
            unique_users = len(set(interaction[0] for interaction in interactions))
            unique_events = len(set(interaction[1] for interaction in interactions))
            
            print(f"Enhanced interaction stats: {len(positive_interactions)} positive, {len(negative_interactions)} negative, {len(social_boosted)} socially-boosted")
            print(f"Users: {unique_users}, Events: {unique_events}")
        
        return interactions
    
    def build_user_features(self, users):
        """Build user features - implement your logic"""

        user_feature_tuples = []
        for user in users:
            identifier = user.get("email") or user.get("name")
            current_user_preferences = self.parse_preferences(user.get("preferences", []))
            birthday = user.get("birthday")
            age = self.calculate_age(birthday) if birthday else None
            age_group = self.get_age_group(age) if age is not None else None
            start_time = user.get("start-time")
            end_time = user.get("end-time")
            time_tag = self.get_time_tag(start_time, end_time) if start_time and end_time else None
            gender = user.get("gender")
            user_feature_tuples.append((identifier, [current_user_preferences, age_group, time_tag, gender]))

        return user_feature_tuples
    
    def build_event_features(self, events):
        """Build event features with featured event boosting"""
        event_feature_tuples = []
        for event in events:
            eid = event.get("id")
            event_types = self.parse_event_types(event.get("event_type", []))
            
            # Extract time information from the new times field
            times_data = event.get("times", {})
            time_tag = None
            if times_data and isinstance(times_data, dict):
                # Use the first available time range for feature extraction
                for day, time_info in times_data.items():
                    if time_info == 'all_day':
                        time_tag = self.get_time_tag("00:00", "23:59")
                        break
                    elif isinstance(time_info, (list, tuple)) and len(time_info) == 2:
                        start_time, end_time = time_info
                        time_tag = self.get_time_tag(start_time, end_time)
                        break
            age_restriction = event.get("age_restriction")
            cost = event.get("cost")
            cost_range = None
            if cost is not None:
                if cost < 20:
                    cost_range = "$"
                elif cost < 50:
                    cost_range = "$$"
                elif cost < 100:
                    cost_range = "$$$"
                else:
                    cost_range = "$$$$"
            reservation = event.get("reservation")
            reservation_required = "yes" if reservation and reservation.lower() in ["yes", "y", "true", "1"] else "no"
            
            # FEATURED EVENT BOOST: Add featured status as a strong positive feature
            is_featured = event.get("featured", False)
            featured_status = "featured" if is_featured else "regular"
            
            # Featured events get additional boost through multiple feature dimensions
            featured_boost_score = 1.0 if is_featured else 0.0  # Binary featured flag
            featured_multiplier = 3 if is_featured else 1  # Quality multiplier
            
            event_feature_tuples.append((eid, [
                event_types, 
                time_tag, 
                age_restriction, 
                cost_range, 
                reservation_required,
                featured_status,      # Categorical: "featured" vs "regular"
                featured_boost_score, # Numeric: 1.0 for featured, 0.0 for regular
                featured_multiplier   # Weight multiplier: 3 for featured, 1 for regular
            ]))

        return event_feature_tuples
    

    def calculate_distance(self, lat1, lon1, lat2, lon2):
        """Calculate distance between two points using Haversine formula"""
        from math import radians, cos, sin, asin, sqrt
        
        lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * asin(sqrt(a))
        r = 6371  # Radius of earth in kilometers
        return c * r
    
    def recommend_events(self, token, email, latitude=None, longitude=None, filter_distance=True, rejected_events=None, use_calendar_filter=False, selected_dates=None, user_start_time=None, user_end_time=None):
        """Main recommendation function"""
        try:
            print(f"Starting recommendation process for email: {email}")

            user = self.Client.auth.get_user(token)
            if user.user.email != email:
                raise HTTPException(status_code=401, detail="Token doesn't match requested email")
            
            # Parse rejected events
            if isinstance(rejected_events, str):
                if rejected_events.strip():
                    try:
                        rejected_events = json.loads(rejected_events)
                    except:
                        rejected_events = [int(x.strip()) for x in rejected_events.split(',') if x.strip()]
                else:
                    rejected_events = []
            
            rejected_events = rejected_events or []
            
            print(f"Processing recommendation for: {email}")
            print(f"Location: {latitude}, {longitude}")
            print(f"Rejected events: {rejected_events}")
            
            # 1. Fetch the target user's preferences
            try:
                user_data = self.get_user_data(email)
                print(f"User data fetched: {user_data is not None}")
            except Exception as e:
                print(f"Error fetching user data: {str(e)}")
                raise HTTPException(status_code=404, detail=f"User {email} not found")
            
            if not user_data:
                raise HTTPException(status_code=404, detail=f"User {email} not found")

            # Parse user data
            try:
                user_preferences = self.parse_preferences(user_data.get("preferences", []))
                user_travel_distance = user_data.get("travel-distance", 50)
                saved_events = user_data.get("saved_events", [])
                
                # Use request parameters if provided, otherwise fall back to user profile
                final_start_time = user_start_time if user_start_time else user_data.get("start-time")
                final_end_time = user_end_time if user_end_time else user_data.get("end-time")
                
                print(f"User preferences parsed: {user_preferences}")
                print(f"Time filters - request: {user_start_time}-{user_end_time}, profile: {user_data.get('start-time')}-{user_data.get('end-time')}, final: {final_start_time}-{final_end_time}")
            except Exception as e:
                print(f"Error parsing user data: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Error parsing user data: {str(e)}")

            # Handle saved_events format
            if isinstance(saved_events, str):
                saved_events = [int(e.strip()) for e in saved_events.strip('{}').split(',') if e.strip()]

            # 2. Query all_events from Supabase
            try:
                all_events_raw = self.get_events_data(user_preferences if user_preferences else None)
                print(f"Events fetched: {len(all_events_raw)}")
            except Exception as e:
                print(f"Error fetching events: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Error fetching events: {str(e)}")
            
            if not all_events_raw:
                return {
                    "summary": "No events found matching user preferences.",
                    "events": [],
                    "total_found": 0
                }

            # 3. Apply filters
            try:
                print(f"Starting filter process with {len(all_events_raw)} events")
                print(f"Final time filters: {final_start_time} - {final_end_time}")
                print(f"Use calendar filter: {use_calendar_filter}, Selected dates: {selected_dates}")
                
                # Only apply time filter if both start_time and end_time are not None
                if final_start_time and final_end_time:
                    events_before_time = len(all_events_raw)
                    all_events_raw = self.filter_by_time(all_events_raw, final_start_time, final_end_time)
                    events_after_time = len(all_events_raw)
                    print(f"Time filter: {events_before_time} -> {events_after_time} events (filtered out: {events_before_time - events_after_time})")
                else:
                    print("No time filtering applied - missing start or end time")

                # Apply date/day filtering based on calendar mode
                if use_calendar_filter and selected_dates:
                    print(f"Applying calendar date filter with {len(selected_dates)} selected dates: {selected_dates}")
                    events_before_date = len(all_events_raw)
                    all_events_raw = self.filter_by_dates(all_events_raw, selected_dates)
                    events_after_date = len(all_events_raw)
                    print(f"Calendar date filter: {events_before_date} -> {events_after_date} events (filtered out: {events_before_date - events_after_date})")
                else:
                    # Use traditional day preference filtering
                    user_preferred_days = self.parse_days(user_data.get("preferred_days", []))
                    print(f"Using traditional day filtering with preferred days: {user_preferred_days}")
                    events_before_day = len(all_events_raw)
                    all_events_raw = self.filter_by_occurrence(all_events_raw, user_preferred_days)
                    events_after_day = len(all_events_raw)
                    print(f"Day preference filter: {events_before_day} -> {events_after_day} events (filtered out: {events_before_day - events_after_day})")
                
                all_events_filtered = self.apply_distance_filter(
                    all_events_raw, latitude, longitude, 
                    filter_distance, user_travel_distance
                )
                print(f"Events after distance filter: {len(all_events_filtered)}")
            except Exception as e:
                print(f"Error applying filters: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Error applying filters: {str(e)}")

            if not all_events_filtered:
                return {
                    "summary": "No events found after applying filters.",
                    "events": [],
                    "total_found": 0
                }

            # Remove saved and rejected events
            try:
                exclude_ids = set(saved_events) | set(rejected_events)
                final_events = [e for e in all_events_filtered if e["id"] not in exclude_ids]
                event_ids_filtered = [event["id"] for event in final_events]
                print(f"Events after removing saved/rejected: {len(event_ids_filtered)}")
            except Exception as e:
                print(f"Error filtering saved/rejected events: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Error filtering saved/rejected events: {str(e)}")

            if not event_ids_filtered:
                return {
                    "summary": "No new events available after filtering.",
                    "events": [],
                    "total_found": 0
                }

            # 4. ML Recommendation logic - OPTIMIZED
            try:
                # GET SOCIAL CONNECTIONS DATA for social boosting (needed for both fast and slow paths)
                social_connections_data = []
                if user_data and user_data.get("id"):
                    social_connections_data = self.get_user_social_connections(user_data.get("id"))
                    print(f"🌐 Found {len(social_connections_data)} social connections for user {email}")
                
                # Use cloud-native BeaconAI for per-user models
                self.rec.user_id = email  # Set user ID for per-user model storage
                
                # TRY FAST PATH: Load existing model without rebuilding features
                print("🚀 Attempting fast inference path...")
                model_status = self.rec.load_model_if_exists()
                
                if model_status and self.rec.is_model_loaded():
                    print("✅ Using pre-trained model for fast inference")
                    # Extract liked/rejected event IDs for simple filtering
                    liked_and_rejected_ids = set(saved_events) | set(rejected_events)
                    
                    # Fast recommendation without feature/interaction building
                    recommendations = self.rec.recommend_for_user(
                        email,
                        top_n=5,
                        filter_liked=True,
                        liked_event_ids=list(liked_and_rejected_ids)
                    )
                    print(f"🚀 Fast recommendations generated: {len(recommendations)}")
                    
                else:
                    print("📚 No existing model found, falling back to training...")
                    # SLOW PATH: Need to build features and train
                    # Fetch all users with their interaction history
                    all_users_result = self.Client.table("all_users").select(
                        "email, preferences, travel-distance, saved_events, saved_events_all_time, rejected_events, start-time, end-time, birthday, gender, preferred_days"
                    ).execute()
                    all_users = all_users_result.data
                    print(f"Users fetched: {len(all_users)}")
                
                    user_emails = [user.get("email") for user in all_users if user.get("email")]
                    
                    # Choose interaction method based on data availability
                    use_enhanced_interactions = True  # Can be made configurable
                    
                    if use_enhanced_interactions:
                        interactions = self.build_enhanced_interactions(all_users, target_user_email=email, social_connections_data=social_connections_data)
                        print(f"Enhanced interactions built: {len(interactions)}")
                    else:
                        interactions = self.build_interactions(all_users)
                        print(f"Basic interactions built: {len(interactions)}")
                    
                    # Debug: Show sample interactions
                    if interactions:
                        print(f"Debug: Sample interactions: {interactions[:5]}")
                        positive_interactions = [i for i in interactions if i[2] > 0]
                        negative_interactions = [i for i in interactions if i[2] < 0]
                        print(f"Debug: Positive interactions: {len(positive_interactions)}, Negative: {len(negative_interactions)}")
                    else:
                        print("Warning: No interactions found for training!")

                    user_feature_tuples = self.build_user_features(all_users)
                    print(f"User features built: {len(user_feature_tuples)}")

                    event_feature_tuples = self.build_event_features(all_events_filtered)
                    print(f"Event features built: {len(event_feature_tuples)}")
                    
                    # Load or train model for this user
                    status = self.rec.load_or_train(
                        user_emails, 
                        event_ids_filtered, 
                        user_feature_tuples, 
                        event_feature_tuples, 
                        interactions,
                        epochs=10,
                        learning_rate=0.01,
                        batch_size=256
                    )
                    print(f"Model status: {status}")

                    # Extract liked/rejected event IDs for filtering
                    liked_and_rejected_ids = set(saved_events) | set(rejected_events)
                    
                    # Generate recommendations with optimized filtering
                    recommendations = self.rec.recommend_for_user(
                        email,
                        top_n=5,
                        filter_liked=True,
                        liked_event_ids=list(liked_and_rejected_ids)
                    )
                    print(f"📚 Training path recommendations generated: {len(recommendations)}")

                # Get social connections' saved events for post-processing boost
                social_connections_saved_events = set()
                if user_data and user_data.get("id"):
                    for connection in social_connections_data:
                        connection_saved = connection.get("saved_events_all_time", []) or connection.get("saved_events", [])
                        if connection_saved:
                            if isinstance(connection_saved, str):
                                try:
                                    connection_saved = [int(e.strip()) for e in connection_saved.strip('{}').split(',') if e.strip()]
                                except (ValueError, AttributeError):
                                    connection_saved = []
                            elif not isinstance(connection_saved, (list, tuple)):
                                connection_saved = []
                            social_connections_saved_events.update(connection_saved)
                
                # Get the full event objects for the recommended events with enhanced scoring
                                                 # Get the full event objects for the recommended events with enhanced scoring
                recommended_events = []
                featured_events = []
                regular_events = []
                social_events = []
                
                for eid, score in recommendations:
                    # Find the full event object from all_events_filtered
                    event_obj = next((event for event in all_events_filtered if event["id"] == eid), None)
                    if event_obj:
                        # SOCIAL POST-PROCESSING BOOST: Additional boost for socially-saved events
                        if eid in social_connections_saved_events:
                            social_boosted_score = score * 1.4  # 40% additional boost for social recommendations
                            print(f"🎯 Post-processing social boost applied to event {eid}")
                            social_events.append((event_obj, social_boosted_score))
                        # FEATURED POST-PROCESSING BOOST: Separate featured and regular events
                        elif event_obj.get("featured", False):
                            # Apply additional score boost to featured events
                            boosted_score = score * 1.3  # 30% score boost
                            featured_events.append((event_obj, boosted_score))
                        else:
                            regular_events.append((event_obj, score))
                
                # Sort each group by score
                social_events.sort(key=lambda x: x[1], reverse=True)
                featured_events.sort(key=lambda x: x[1], reverse=True)
                regular_events.sort(key=lambda x: x[1], reverse=True)
                
                # Interleave with priority: Social events > Featured events > Regular events
                recommended_events = []
                s_idx = f_idx = r_idx = 0
                position = 0
                
                while len(recommended_events) < 5 and (s_idx < len(social_events) or f_idx < len(featured_events) or r_idx < len(regular_events)):
                    # Highest priority: socially-saved events (positions 0, 2, 4...)
                    if position % 2 == 0 and s_idx < len(social_events):
                        recommended_events.append(social_events[s_idx][0])
                        s_idx += 1
                    # Medium priority: featured events
                    elif position % 3 != 2 and f_idx < len(featured_events):
                        recommended_events.append(featured_events[f_idx][0])
                        f_idx += 1
                    # Lower priority: regular events
                    elif r_idx < len(regular_events):
                        recommended_events.append(regular_events[r_idx][0])
                        r_idx += 1
                    # Fill remaining slots with any available events
                    elif s_idx < len(social_events):
                        recommended_events.append(social_events[s_idx][0])
                        s_idx += 1
                    elif f_idx < len(featured_events):
                        recommended_events.append(featured_events[f_idx][0])
                        f_idx += 1
                    
                    position += 1
                
                print(f"Final recommendations: {len([e for e in recommended_events if e.get('id') in social_connections_saved_events])} socially-recommended, {len([e for e in recommended_events if e.get('featured')])} featured, {len([e for e in recommended_events if not e.get('featured') and e.get('id') not in social_connections_saved_events])} regular")
                
                return {
                    "summary": f"Found {len(recommended_events)} recommended events for {email}",
                    "events": recommended_events,  # Now returning full event objects with image URLs
                    "total_found": len(event_ids_filtered)
                }
            except Exception as e:
                print(f"Error in ML recommendation logic: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Error in ML recommendation logic: {str(e)}")
            
        except Exception as e:
            print(f"Unexpected error in recommend_events: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

# Initialize the recommendation system
recommender = EventRecommendationSystem()

# API Routes
@app.get("/")
async def root():
    return {
        "message": "Event Recommendation API",
        "endpoints": {
            "recommendations": "/recommend",
            "docs": "/docs",
            "health": "/health"
        }
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.post("/recommend")
async def get_recommendations(request_data: RecommendationRequest, request: Request):
    """Get event recommendations for a user"""

    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return {"error": "No valid token provided"}

    token = auth_header.split(' ')[1]

    result = recommender.recommend_events(
        token=token,
        email=request_data.email,
        latitude=request_data.latitude,
        longitude=request_data.longitude,
        filter_distance=request_data.filter_distance,
        rejected_events=request_data.rejected_events,
        use_calendar_filter=request_data.use_calendar_filter,
        selected_dates=request_data.selected_dates,
        user_start_time=request_data.user_start_time,
        user_end_time=request_data.user_end_time
    )
    
    return RecommendationResponse(**result)

@app.get("/recommend")
async def get_recommendations_get(
    request: Request,
    email: str = Query(..., description="User email"),
    latitude: Optional[float] = Query(None, description="User latitude"),
    longitude: Optional[float] = Query(None, description="User longitude"),
    filter_distance: bool = Query(True, description="Whether to filter by distance"),
    rejected_events: str = Query("", description="Comma-separated rejected event IDs"),
    use_calendar_filter: bool = Query(False, description="Whether to use calendar date filtering"),
    selected_dates: str = Query("", description="Comma-separated selected dates in YYYY-MM-DD format"),
    user_start_time: Optional[str] = Query(None, description="User start time filter (HH:MM format)"),
    user_end_time: Optional[str] = Query(None, description="User end time filter (HH:MM format)")
):
    """Get event recommendations via GET request"""
    # Get token from Authorization header
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return {"error": "No valid token provided"}

    token = auth_header.split(' ')[1]
    
    # Parse selected_dates from comma-separated string
    parsed_selected_dates = None
    if use_calendar_filter and selected_dates:
        parsed_selected_dates = [date.strip() for date in selected_dates.split(',') if date.strip()]
    
    result = recommender.recommend_events(
        token=token,
        email=email,
        latitude=latitude,
        longitude=longitude,
        filter_distance=filter_distance,
        rejected_events=rejected_events,
        use_calendar_filter=use_calendar_filter,
        selected_dates=parsed_selected_dates,
        user_start_time=user_start_time,
        user_end_time=user_end_time
    )
    
    return result

@app.post("/debug/filter")
async def debug_filter(request: Request):
    """Debug endpoint to test filtering logic"""
    try:
        body = await request.json()
        email = body.get("email")
        user_start_time = body.get("user_start_time")  # e.g., "10:00"
        user_end_time = body.get("user_end_time")      # e.g., "16:00"
        selected_dates = body.get("selected_dates", [])  # e.g., ["2024-01-15"]
        use_calendar_filter = body.get("use_calendar_filter", False)
        
        if not email:
            return {"error": "Email required"}
        
        # Get user data
        user_data = recommender.get_user_data(email)
        if not user_data:
            return {"error": "User not found"}
        
        # Get events
        user_preferences = recommender.parse_preferences(user_data.get("preferences", []))
        all_events = recommender.get_events_data(user_preferences if user_preferences else None)
        
        # Sample a few events for debugging
        sample_events = all_events[:3] if all_events else []
        
        debug_info = {
            "original_event_count": len(all_events),
            "sample_events": [],
            "filters_applied": {},
            "filtering_results": {}
        }
        
        # Add sample event info
        for event in sample_events:
            debug_info["sample_events"].append({
                "id": event.get("id"),
                "name": event.get("name"),
                "times": event.get("times"),
                "occurrence": event.get("occurrence"),
                "start_date": event.get("start_date"),
                "days_of_the_week": event.get("days_of_the_week")
            })
        
        current_events = all_events.copy()
        
        # Test time filtering
        if user_start_time and user_end_time:
            debug_info["filters_applied"]["time_filter"] = {
                "user_start_time": user_start_time,
                "user_end_time": user_end_time
            }
            
            events_before_time = len(current_events)
            current_events = recommender.filter_by_time(current_events, user_start_time, user_end_time)
            events_after_time = len(current_events)
            
            debug_info["filtering_results"]["time_filter"] = {
                "events_before": events_before_time,
                "events_after": events_after_time,
                "filtered_out": events_before_time - events_after_time
            }
        
        # Test date filtering
        if use_calendar_filter and selected_dates:
            debug_info["filters_applied"]["date_filter"] = {
                "selected_dates": selected_dates,
                "use_calendar_filter": use_calendar_filter
            }
            
            events_before_date = len(current_events)
            current_events = recommender.filter_by_dates(current_events, selected_dates)
            events_after_date = len(current_events)
            
            debug_info["filtering_results"]["date_filter"] = {
                "events_before": events_before_date,
                "events_after": events_after_date,
                "filtered_out": events_before_date - events_after_date
            }
        else:
            # Traditional day filtering
            user_preferred_days = recommender.parse_days(user_data.get("preferred_days", []))
            debug_info["filters_applied"]["day_filter"] = {
                "user_preferred_days": user_preferred_days
            }
            
            events_before_day = len(current_events)
            current_events = recommender.filter_by_occurrence(current_events, user_preferred_days)
            events_after_day = len(current_events)
            
            debug_info["filtering_results"]["day_filter"] = {
                "events_before": events_before_day,
                "events_after": events_after_day,
                "filtered_out": events_before_day - events_after_day
            }
        
        # Add final filtered sample events
        final_sample_events = current_events[:3] if current_events else []
        debug_info["final_sample_events"] = []
        for event in final_sample_events:
            debug_info["final_sample_events"].append({
                "id": event.get("id"),
                "name": event.get("name"),
                "times": event.get("times"),
                "occurrence": event.get("occurrence"),
                "start_date": event.get("start_date"),
                "days_of_the_week": event.get("days_of_the_week")
            })
        
        debug_info["final_event_count"] = len(current_events)
        
        return debug_info
        
    except Exception as e:
        return {"error": str(e), "traceback": str(e)}

@app.post("/admin/train")
async def admin_trigger_training(request: Request):
    """Admin endpoint to trigger model training for any user (requires service role key)"""
    try:
        body = await request.json()
        email = body.get("email")
        force_retrain = body.get("force_retrain", False)
        
        if not email:
            return {"error": "Email required"}
        
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return {"error": "No valid token provided"}

        token = auth_header.split(' ')[1]
        
        # For admin endpoint, we expect a service role key
        # Verify the service role key works by making a privileged query
        try:
            # Test service role access by checking if we can query users table
            # We'll use a new Supabase client with the provided token
            from supabase import create_client
            import os
            
            admin_client = create_client(
                os.getenv('SUPABASE_URL'),
                token  # Use the provided token (should be service role key)
            )
            
            test_query = admin_client.table("all_users").select("email").limit(1).execute()
            if not test_query.data:
                return {"error": "Service role verification failed - no access to users table"}
        except Exception as e:
            return {"error": f"Service role verification failed: {str(e)}"}
        
        # Get user data and prepare training data
        user_data = recommender.get_user_data(email)
        if not user_data:
            return {"error": "User not found"}
        
        # Get all users and events for training
        all_users_result = recommender.Client.table("all_users").select("*").execute()
        all_users = all_users_result.data
        
        user_preferences = recommender.parse_preferences(user_data.get("preferences", []))
        all_events = recommender.get_events_data(user_preferences if user_preferences else None)
        
        user_emails = [user.get("email") for user in all_users if user.get("email")]
        event_ids = [event["id"] for event in all_events]
        
        # Get friend data for social boosting
        friends_data = []
        if user_data and user_data.get("id"):
            friends_data = recommender.get_user_friends(user_data.get("id"))
            print(f"🤝 Found {len(friends_data)} friends for user {email}")
        
        interactions = recommender.build_enhanced_interactions(all_users, target_user_email=email, friends_data=friends_data)
        user_feature_tuples = recommender.build_user_features(all_users)
        event_feature_tuples = recommender.build_event_features(all_events)
        
        # Set user ID for per-user model
        recommender.rec.user_id = email
        
        # Train model
        status = recommender.rec.load_or_train(
            user_emails,
            event_ids,
            user_feature_tuples,
            event_feature_tuples,
            interactions,
            force_retrain=force_retrain,
            epochs=15,  # More epochs for manual training
            learning_rate=0.01,
            batch_size=256
        )
        
        return {
            "success": True,
            "status": status,
            "message": f"Admin training completed for user {email}",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        return {"error": str(e)}

@app.post("/train")
async def trigger_training(request: Request):
    """User-specific training endpoint (requires user authentication)"""
    try:
        body = await request.json()
        email = body.get("email")
        force_retrain = body.get("force_retrain", False)
        
        if not email:
            return {"error": "Email required"}
        
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return {"error": "No valid token provided"}

        token = auth_header.split(' ')[1]
        
        # Verify user (user can only train their own model)
        user = recommender.Client.auth.get_user(token)
        if user.user.email != email:
            return {"error": "Token doesn't match requested email"}
        
        # Get user data and prepare training data
        user_data = recommender.get_user_data(email)
        if not user_data:
            return {"error": "User not found"}
        
        # Get all users and events for training
        all_users_result = recommender.Client.table("all_users").select("*").execute()
        all_users = all_users_result.data
        
        user_preferences = recommender.parse_preferences(user_data.get("preferences", []))
        all_events = recommender.get_events_data(user_preferences if user_preferences else None)
        
        user_emails = [user.get("email") for user in all_users if user.get("email")]
        event_ids = [event["id"] for event in all_events]
        
        # Get friend data for social boosting
        friends_data = []
        if user_data and user_data.get("id"):
            friends_data = recommender.get_user_friends(user_data.get("id"))
            print(f"🤝 Found {len(friends_data)} friends for user {email}")
        
        interactions = recommender.build_enhanced_interactions(all_users, target_user_email=email, friends_data=friends_data)
        user_feature_tuples = recommender.build_user_features(all_users)
        event_feature_tuples = recommender.build_event_features(all_events)
        
        # Set user ID for per-user model
        recommender.rec.user_id = email
        
        # Train model
        status = recommender.rec.load_or_train(
            user_emails,
            event_ids,
            user_feature_tuples,
            event_feature_tuples,
            interactions,
            force_retrain=force_retrain,
            epochs=15,  # More epochs for manual training
            learning_rate=0.01,
            batch_size=256
        )
        
        return {
            "success": True,
            "status": status,
            "message": f"Training completed for user {email}",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        return {"error": str(e)}

@app.get("/models/{user_email}")
async def get_model_info(user_email: str, request: Request):
    """Get information about a user's trained model"""
    try:
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return {"error": "No valid token provided"}

        token = auth_header.split(' ')[1]
        
        # Verify user
        user = recommender.Client.auth.get_user(token)
        if user.user.email != user_email:
            return {"error": "Token doesn't match requested email"}
        
        # Check for existing model
        stored_model = recommender.rec.storage.load_model(user_email)
        
        if stored_model:
            return {
                "has_model": True,
                "created_at": stored_model["created_at"],
                "data_fingerprint": stored_model["data_fingerprint"],
                "metadata": stored_model["metadata"]
            }
        else:
            return {
                "has_model": False,
                "message": "No trained model found for this user"
            }
            
    except Exception as e:
        return {"error": str(e)}

@app.delete("/models/{user_email}")
async def delete_user_model(user_email: str, request: Request):
    """Delete a user's trained model"""
    try:
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return {"error": "No valid token provided"}

        token = auth_header.split(' ')[1]
        
        # Verify user
        user = recommender.Client.auth.get_user(token)
        if user.user.email != user_email:
            return {"error": "Token doesn't match requested email"}
        
        # Delete model by creating a "deleted" entry (or implement actual deletion in Supabase)
        # For now, we'll rely on the model's age-based cleanup
        return {
            "success": True,
            "message": f"Model deletion scheduled for user {user_email}. It will be removed during next cleanup."
        }
        
    except Exception as e:
        return {"error": str(e)}

@app.post("/admin/cleanup")
async def cleanup_old_models():
    """Admin endpoint to clean up old models"""
    try:
        recommender.rec.cleanup_old_models(days_to_keep=7)
        return {
            "success": True,
            "message": "Model cleanup completed",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/admin/cleanup-duplicates")
async def cleanup_duplicate_models():
    """Admin endpoint to clean up duplicate models - ensures only one model per user"""
    try:
        deleted_count = recommender.rec.storage.cleanup_duplicate_models()
        return {
            "success": True,
            "message": f"Duplicate cleanup completed - deleted {deleted_count} duplicate models",
            "deleted_count": deleted_count,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {"error": str(e)}

# For local development
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)