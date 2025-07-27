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
import time
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
    'Travel & Discovery',
    'Happy Hour'
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
    # NEW: Add optional event type preferences from UI
    event_type_preferences: Optional[List[str]] = None
    
    # OFFLINE-FIRST OPTIMIZATION: Pass user profile data instead of querying database
    user_id: Optional[int] = None
    user_preferences: Optional[List[str]] = None  # Fallback if event_type_preferences not provided
    user_travel_distance: Optional[float] = None
    user_saved_events: Optional[List[int]] = None
    user_preferred_days: Optional[List[str]] = None
    user_birthday: Optional[str] = None
    user_gender: Optional[str] = None
    # Note: profile start/end times handled by user_start_time/user_end_time above

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
    
            return None
    

    
    def get_featured_events_batch(self, event_ids):
        """Batch fetch featured status for multiple events - MUCH faster than individual calls"""
        if not event_ids:
            return {}
        
        try:
            # Single API call to get all featured statuses
            result = self.Client.table("all_events").select("id, featured").in_("id", list(event_ids)).execute()
            
            # Build lookup dictionary
            featured_lookup = {}
            if result.data:
                for event in result.data:
                    featured_lookup[event["id"]] = event.get("featured", False)
            
            # Fill in missing events as non-featured
            for event_id in event_ids:
                if event_id not in featured_lookup:
                    featured_lookup[event_id] = False
                    
    
            return featured_lookup
            
        except Exception as e:
    
            return {event_id: False for event_id in event_ids}
    
    def is_featured_event(self, event_id):
        """Individual featured check - DEPRECATED: Use get_featured_events_batch() for efficiency"""

        try:
            result = self.Client.table("all_events").select("featured").eq("id", event_id).maybe_single().execute()
            return result.data.get("featured", False) if result.data else False
        except Exception as e:
    
            return False

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
    
    def get_all_events_data(self, exclude_user_email=None):
        """Fetch ALL events data from Supabase without any preference filtering, optionally excluding user-created events"""
        try:
            result = self.Client.table("all_events").select("*").execute()
            all_events = result.data if result.data else []
            
            # Filter out events created by the user if email is provided
            if exclude_user_email:
                original_count = len(all_events)
                all_events = [event for event in all_events if event.get("posted_by") != exclude_user_email]
                filtered_count = len(all_events)
                excluded_count = original_count - filtered_count
                print(f"🎯 Fetched {original_count} total events, excluded {excluded_count} events created by {exclude_user_email}, returning {filtered_count} events")
            else:
                print(f"🎯 Fetched {len(all_events)} total events from database")
            
            return all_events
        except Exception as e:
            print(f"Error fetching all events data: {e}")
            return []
    
    def filter_events_by_preferences(self, events, user_preferences, featured_only=False):
        """Filter events by user preferences and featured status (called after getting all events)"""
        if not user_preferences and not featured_only:
            print("🔍 No preferences or featured filter provided, returning all events")
            return events
            
        print(f"🔍 Filtering {len(events)} events by preferences: {user_preferences}, featured_only: {featured_only}")
        
        filtered_events = []
        for event in events:
            event_types = event.get('event_type', [])
            
            # Handle different storage formats
            if isinstance(event_types, str):
                # Parse PostgreSQL array string format
                event_types = [t.strip().strip('"') for t in event_types.strip('{}').split(',') if t.strip()]
            elif not isinstance(event_types, list):
                event_types = []
            
            # First check featured filter if enabled
            if featured_only and not event.get('featured', False):
                continue  # Skip non-featured events if featured_only is True
            
            # Then check event type preferences
            if user_preferences:
                # Normal category filtering - any preference matches any event type
                if any(pref in event_types for pref in user_preferences):
                    filtered_events.append(event)
            else:
                # If no preferences but featured_only is True, include all featured events
                if featured_only:
                    filtered_events.append(event)
        
        print(f"🎯 Filtered to {len(filtered_events)} events matching preferences and featured status")
        return filtered_events
    
    def get_events_data(self, user_preferences=None):
        """DEPRECATED: Use get_all_events_data() + filter_events_by_preferences() instead"""
        print("⚠️ WARNING: Using deprecated get_events_data method. Use get_all_events_data() + filter_events_by_preferences() instead")
        return self.get_all_events_data()
        
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
    
    def build_interactions(self, users, events_data=None):
        """Build user interactions with optional events data to avoid N+1 queries for featured lookups"""
        interactions = []
        total_users_with_interactions = 0
        
        # Build featured lookup from events_data if provided (N+1 query optimization)
        featured_lookup = {}
        if events_data:
            featured_lookup = {event["id"]: event.get("featured", False) for event in events_data}
            print(f"🚀 N+1 optimization: Built featured lookup for {len(featured_lookup)} events from existing data")
        
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
            
            # Create weighted interactions with optional featured boosting
            for event_id in saved_events_all_time:
                try:
                    event_id = int(event_id)
                    # Base weight: higher (2.0) for currently saved events, normal (1.0) for historical
                    weight = 2.0 if event_id in current_saved_set else 1.0
                    
                    # N+1 optimized featured boost: use lookup dict instead of individual API calls
                    if featured_lookup and featured_lookup.get(event_id, False):
                        weight *= 1.5  # 50% boost for featured events
                    
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
            featured_interactions = sum(1 for _, event_id, weight in interactions if weight > 2.0)
            print(f"Interaction stats: {unique_users} unique users, {unique_events} unique events, {avg_interactions_per_user:.2f} avg interactions per user")
            if featured_lookup:
                print(f"Featured boost applied to {featured_interactions} interactions")
        
        return interactions
    

    

    
    def build_user_features(self, users):
        """Build user features WITHOUT preferences to avoid ML bias - filtering happens at API level"""

        user_feature_tuples = []
        for user in users:
            identifier = user.get("email") or user.get("name")
            # REMOVED: current_user_preferences - let the model learn from behavior, not stated preferences
            birthday = user.get("birthday")
            age = self.calculate_age(birthday) if birthday else None
            age_group = self.get_age_group(age) if age is not None else None
            start_time = user.get("start-time")
            end_time = user.get("end-time")
            time_tag = self.get_time_tag(start_time, end_time) if start_time and end_time else None
            gender = user.get("gender")
            # Note: preferences removed - model learns from actual save/reject behavior instead
            user_feature_tuples.append((identifier, [age_group, time_tag, gender]))

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
    
    def recommend_events(self, token, email, latitude=None, longitude=None, filter_distance=True, rejected_events=None, use_calendar_filter=False, selected_dates=None, user_start_time=None, user_end_time=None, event_type_preferences=None, user_id=None, user_preferences=None, user_travel_distance=None, user_saved_events=None, user_preferred_days=None, user_birthday=None, user_gender=None):
        """Main recommendation function - ML model is preference-agnostic, filtering happens at API level"""
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
            print(f"UI Event type preferences: {event_type_preferences}")
            
            # 1. OFFLINE-FIRST: Use passed user profile data instead of database query
            print("🚀 OFFLINE-FIRST: Using passed user profile data, skipping database query")
            
            # Parse user data from passed parameters
            try:
                # IMPORTANT: Use UI preferences if provided, otherwise fall back to passed user profile preferences
                if event_type_preferences is not None:
                    all_preferences = event_type_preferences
                    print(f"🎯 Using UI event type preferences: {all_preferences}")
                elif user_preferences is not None:
                    all_preferences = user_preferences
                    print(f"📊 Using passed profile event type preferences: {all_preferences}")
                else:
                    all_preferences = []
                    print(f"⚠️ No preferences provided, using empty list")
                
                # Extract featured events preference and regular event types
                featured_only = "Featured Events" in all_preferences
                final_user_preferences = [pref for pref in all_preferences if pref != "Featured Events"]
                print(f"🎯 Extracted preferences - Event types: {final_user_preferences}, Featured only: {featured_only}")
                
                # Use passed travel distance or default
                final_user_travel_distance = user_travel_distance if user_travel_distance is not None else 50
                
                # Use passed saved events or default
                saved_events = user_saved_events if user_saved_events is not None else []
                
                # Time filters are already passed as user_start_time/user_end_time
                final_start_time = user_start_time
                final_end_time = user_end_time
                
                print(f"Time filters: {final_start_time}-{final_end_time}")
                print(f"Travel distance: {final_user_travel_distance}")
                print(f"Saved events count: {len(saved_events)}")
            except Exception as e:
                print(f"Error processing passed user data: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Error processing user data: {str(e)}")

            # Handle saved_events format with better error handling
            try:
                if isinstance(saved_events, str):
                    if saved_events.strip():
                        saved_events = [int(e.strip()) for e in saved_events.strip('{}').split(',') if e.strip()]
                    else:
                        saved_events = []
                elif saved_events is None:
                    saved_events = []
                elif not isinstance(saved_events, list):
                    saved_events = []
                print(f"💾 Parsed saved_events: {saved_events}")
            except Exception as e:
                print(f"⚠️ Error parsing saved_events: {e}, defaulting to empty list")
                saved_events = []
                
            # Additional validation for rejected_events parsing
            try:
                if not isinstance(rejected_events, list):
                    rejected_events = []
                print(f"🚫 Parsed rejected_events: {rejected_events}")
            except Exception as e:
                print(f"⚠️ Error parsing rejected_events: {e}, defaulting to empty list") 
                rejected_events = []

            # 2. Fetch ALL events from Supabase (no filtering at database level)
            try:
                all_events_raw = self.get_all_events_data(exclude_user_email=email)
                print(f"All events fetched: {len(all_events_raw)}")
                
                # DEBUG: Check event type distribution in database
                if all_events_raw:
                    event_type_counts = {}
                    for event in all_events_raw[:50]:  # Sample first 50 events
                        event_types = event.get('event_type', [])
                        if isinstance(event_types, str):
                            event_types = [t.strip().strip('"') for t in event_types.strip('{}').split(',') if t.strip()]
                        elif not isinstance(event_types, list):
                            event_types = []
                        for event_type in event_types:
                            event_type_counts[event_type] = event_type_counts.get(event_type, 0) + 1
                    print(f"🎭 Event type distribution in database (sample): {event_type_counts}")
                
                # 3. Apply preference filtering AFTER getting all events
                print(f"🔍 Filtering - Event types: {final_user_preferences}, Featured only: {featured_only}")
                if final_user_preferences or featured_only:
                    events_before_pref = len(all_events_raw)
                    all_events_raw = self.filter_events_by_preferences(all_events_raw, final_user_preferences, featured_only)
                    events_after_pref = len(all_events_raw)
                    print(f"✅ Preference filtering: {events_before_pref} -> {events_after_pref} events (filtered out: {events_before_pref - events_after_pref})")
                    print(f"🎯 Applied filters - Event types: {final_user_preferences}, Featured only: {featured_only}")
                    
                    # DEBUG: Check event type distribution after filtering
                    if all_events_raw:
                        filtered_event_type_counts = {}
                        for event in all_events_raw[:20]:  # Sample filtered events
                            event_types = event.get('event_type', [])
                            if isinstance(event_types, str):
                                event_types = [t.strip().strip('"') for t in event_types.strip('{}').split(',') if t.strip()]
                            elif not isinstance(event_types, list):
                                event_types = []
                            for event_type in event_types:
                                filtered_event_type_counts[event_type] = filtered_event_type_counts.get(event_type, 0) + 1
                        print(f"🎭 Event type distribution AFTER filtering: {filtered_event_type_counts}")
                else:
                    print("No preferences or featured filter to apply, using all events")
                    
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
                    final_user_preferred_days = user_preferred_days if user_preferred_days is not None else []
                    print(f"Using traditional day filtering with preferred days: {final_user_preferred_days}")
                    events_before_day = len(all_events_raw)
                    all_events_raw = self.filter_by_occurrence(all_events_raw, final_user_preferred_days)
                    events_after_day = len(all_events_raw)
                    print(f"Day preference filter: {events_before_day} -> {events_after_day} events (filtered out: {events_before_day - events_after_day})")
                
                all_events_filtered = self.apply_distance_filter(
                    all_events_raw, latitude, longitude, 
                    filter_distance, final_user_travel_distance
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

            # Remove saved and rejected events (user-created events already filtered out during data fetch)
            try:
                exclude_ids = set(saved_events) | set(rejected_events)
                final_events = [e for e in all_events_filtered if e["id"] not in exclude_ids]
                event_ids_filtered = [event["id"] for event in final_events]
                print(f"🚫 Excluded IDs (saved + rejected): {exclude_ids}")
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

            # 4. ML Recommendation logic
            all_users_result = self.Client.table("all_users").select(
                "email, preferences, travel-distance, saved_events, saved_events_all_time, rejected_events, start-time, end-time, birthday, gender, preferred_days"
            ).execute()
            all_users = all_users_result.data
            user_emails = [user.get("email") for user in all_users if user.get("email")]
            event_ids = [event["id"] for event in all_events_filtered]

            # N+1 Query Optimization: Pass events data to avoid individual featured lookups
            interactions = self.build_interactions(all_users, events_data=all_events_filtered)
            user_feature_tuples = self.build_user_features(all_users)
            event_feature_tuples = self.build_event_features(all_events_filtered)

            # DEBUG: Check event types available for ML training
            if all_events_filtered:
                ml_event_type_counts = {}
                for event in all_events_filtered[:30]:  # Sample events for ML training
                    event_types = self.parse_event_types(event.get('event_type', []))
                    for event_type in event_types:
                        ml_event_type_counts[event_type] = ml_event_type_counts.get(event_type, 0) + 1
                print(f"🤖 Event types available for ML training: {ml_event_type_counts}")
                print(f"📊 Total events for ML training: {len(all_events_filtered)}")
                
            # Use cloud-native BeaconAI with FORCED FRESH TRAINING
            self.rec.user_id = email
            print("🔄 FORCING FRESH MODEL TRAINING - No cached weights will be used")
            status = self.rec.load_or_train(
                user_emails, event_ids, user_feature_tuples, event_feature_tuples, interactions,
                epochs=10, learning_rate=0.01, batch_size=256, force_retrain=True
            )

            # Generate recommendations - OPTIMIZED: Only get top 5 since that's what we return
            liked_and_rejected_ids = set(saved_events) | set(rejected_events)
            recommendations = self.rec.recommend_for_user(
                email, top_n=10, filter_liked=True, liked_event_ids=list(liked_and_rejected_ids)
            )
            
            print(f"🎯 ML model generated {len(recommendations)} recommendations")
            if recommendations:
                rec_event_ids = [eid for eid, score in recommendations[:10]]
                print(f"🔢 Top 10 recommended event IDs: {rec_event_ids}")

            # Get the full event objects for the recommended events - OPTIMIZED with lookup dict
            recommended_events = []
            # Create a lookup dictionary for O(1) access instead of O(n) search
            event_lookup = {event["id"]: event for event in all_events_filtered}
            for eid, score in recommendations:
                if eid in exclude_ids:
                    continue
                event_obj = event_lookup.get(eid)
                if event_obj:
                    recommended_events.append(event_obj)
                    
            # DEBUG: Check event types in ML recommendations
            if recommended_events:
                rec_event_type_counts = {}
                for event in recommended_events[:10]:  # Sample recommended events
                    event_types = self.parse_event_types(event.get('event_type', []))
                    for event_type in event_types:
                        rec_event_type_counts[event_type] = rec_event_type_counts.get(event_type, 0) + 1
                print(f"🎯 Event types in ML recommendations: {rec_event_type_counts}")
                print(f"📈 Total ML recommended events: {len(recommended_events)}")

            # OPTIMIZATION: Skip redundant filtering since these filters were already applied earlier
            # The ML recommendations are already based on filtered events, so no need to re-apply filters
            events_filtered = recommended_events
            print(f"🚀 OPTIMIZATION: Skipping redundant filtering - using ML recommendations directly")
                
            # DEBUG: Check final event types being returned to user
            final_events_to_return = events_filtered[:10]
            if final_events_to_return:
                final_event_type_counts = {}
                for event in final_events_to_return:
                    event_types = self.parse_event_types(event.get('event_type', []))
                    for event_type in event_types:
                        final_event_type_counts[event_type] = final_event_type_counts.get(event_type, 0) + 1
                print(f"🎉 FINAL event types being returned to user: {final_event_type_counts}")
                print(f"🏁 Final events returned: {len(final_events_to_return)} out of {len(events_filtered)} filtered")
                
                # Show event names for debugging
                final_event_names = [event.get('name', 'Unknown')[:50] for event in final_events_to_return]
                print(f"📝 Final event names: {final_event_names}")

            return {
                "summary": f"Found {len(events_filtered)} recommended events for {email}",
                "events": events_filtered[:10],  # Return top 10
                "total_found": len(all_events_filtered)
            }
        except Exception as e:
            print(f"Error in recommend_events: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error in recommend_events: {str(e)}")

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
        user_end_time=request_data.user_end_time,
        event_type_preferences=request_data.event_type_preferences,
        # OFFLINE-FIRST: Pass user profile data
        user_id=request_data.user_id,
        user_preferences=request_data.user_preferences,
        user_travel_distance=request_data.user_travel_distance,
        user_saved_events=request_data.user_saved_events,
        user_preferred_days=request_data.user_preferred_days,
        user_birthday=request_data.user_birthday,
        user_gender=request_data.user_gender
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
    user_end_time: Optional[str] = Query(None, description="User end time filter (HH:MM format)"),
    event_type_preferences: str = Query("", description="Comma-separated event type preferences from UI"),
    # OFFLINE-FIRST: User profile data parameters
    user_id: Optional[int] = Query(None, description="User ID"),
    user_preferences: str = Query("", description="Comma-separated user profile event type preferences"),
    user_travel_distance: Optional[float] = Query(None, description="User travel distance preference"),
    user_saved_events: str = Query("", description="Comma-separated user saved event IDs"),
    user_preferred_days: str = Query("", description="Comma-separated user preferred days"),
    user_birthday: Optional[str] = Query(None, description="User birthday"),
    user_gender: Optional[str] = Query(None, description="User gender")
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
    
    # Parse event_type_preferences from comma-separated string
    parsed_event_type_preferences = None
    if event_type_preferences:
        parsed_event_type_preferences = [pref.strip() for pref in event_type_preferences.split(',') if pref.strip()]
    
    # OFFLINE-FIRST: Parse user profile data from query parameters
    parsed_user_preferences = None
    if user_preferences:
        parsed_user_preferences = [pref.strip() for pref in user_preferences.split(',') if pref.strip()]
    
    parsed_user_saved_events = None
    if user_saved_events:
        parsed_user_saved_events = [int(id.strip()) for id in user_saved_events.split(',') if id.strip()]
    
    parsed_user_preferred_days = None
    if user_preferred_days:
        parsed_user_preferred_days = [day.strip() for day in user_preferred_days.split(',') if day.strip()]
    
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
        user_end_time=user_end_time,
        event_type_preferences=parsed_event_type_preferences,
        # OFFLINE-FIRST: Pass parsed user profile data
        user_id=user_id,
        user_preferences=parsed_user_preferences,
        user_travel_distance=user_travel_distance,
        user_saved_events=parsed_user_saved_events,
        user_preferred_days=parsed_user_preferred_days,
        user_birthday=user_birthday,
        user_gender=user_gender
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

@app.get("/debug/event-types")
async def debug_event_types():
    """Debug endpoint to examine event types in the database"""
    try:
        # Get a sample of events to examine their event_type field
        result = recommender.Client.table("all_events").select("id, name, event_type").limit(20).execute()
        events = result.data or []
        
        debug_info = {
            "total_events_sampled": len(events),
            "event_type_analysis": [],
            "unique_event_types": set(),
            "event_type_formats": {}
        }
        
        for event in events:
            event_types = event.get('event_type', [])
            event_type_str = str(event_types)
            event_type_type = type(event_types).__name__
            
            # Parse event types
            parsed_types = []
            if isinstance(event_types, list):
                parsed_types = event_types
            elif isinstance(event_types, str):
                parsed_types = [t.strip().strip('"') for t in event_types.strip('{}').split(',') if t.strip()]
            
            debug_info["event_type_analysis"].append({
                "id": event.get("id"),
                "name": event.get("name", "")[:50],  # Truncate name
                "event_type_raw": event_type_str,
                "event_type_type": event_type_type,
                "parsed_types": parsed_types
            })
            
            # Track unique types
            for ptype in parsed_types:
                debug_info["unique_event_types"].add(ptype)
            
            # Track format types
            if event_type_type not in debug_info["event_type_formats"]:
                debug_info["event_type_formats"][event_type_type] = 0
            debug_info["event_type_formats"][event_type_type] += 1
        
        # Convert set to list for JSON serialization
        debug_info["unique_event_types"] = list(debug_info["unique_event_types"])
        
        # Compare with expected types
        debug_info["expected_event_types"] = EVENT_TYPES
        debug_info["missing_types"] = [t for t in EVENT_TYPES if t not in debug_info["unique_event_types"]]
        debug_info["extra_types"] = [t for t in debug_info["unique_event_types"] if t not in EVENT_TYPES]
        
        return debug_info
        
    except Exception as e:
        return {"error": str(e)}

@app.post("/debug/test-filter")
async def test_event_type_filter(request: Request):
    """Test event type filtering with specific preferences"""
    try:
        body = await request.json()
        test_preferences = body.get("preferences", [])
        
        if not test_preferences:
            return {"error": "Please provide preferences to test"}
        
        print(f"🧪 Testing filter with preferences: {test_preferences}")
        
        # Test the filtering
        filtered_events = recommender.get_events_data(test_preferences)
        
        debug_info = {
            "test_preferences": test_preferences,
            "filtered_event_count": len(filtered_events),
            "sample_filtered_events": []
        }
        
        # Get sample of filtered events
        sample_events = filtered_events[:10]
        sample_event_ids = [event.get("id") for event in sample_events if event.get("id")]
        
        # DEMO: Efficient batch featured lookup vs individual lookups
        if sample_event_ids:
            print("🚀 N+1 Demo: Using batch featured lookup for sample events")
            featured_lookup = recommender.get_featured_events_batch(sample_event_ids)
        else:
            featured_lookup = {}
        
        for event in sample_events:
            event_types = event.get('event_type', [])
            if isinstance(event_types, str):
                parsed_types = [t.strip().strip('"') for t in event_types.strip('{}').split(',') if t.strip()]
            else:
                parsed_types = event_types
            
            event_id = event.get("id")
            # Use batch lookup result instead of individual API call
            is_featured = featured_lookup.get(event_id, False)
                
            debug_info["sample_filtered_events"].append({
                "id": event_id,
                "name": event.get("name", "")[:50],
                "event_type_raw": str(event_types),
                "parsed_types": parsed_types,
                "featured": is_featured,
                "matches_filter": any(pref in parsed_types for pref in test_preferences)
            })
        
        return debug_info
        
    except Exception as e:
        return {"error": str(e)}



# For local development
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)