# app.py for Hugging Face Spaces with Docker + FastAPI
import json
import os
from datetime import datetime
from typing import List, Optional, Union
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from datetime import datetime, timedelta
import uvicorn
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from beacon_torch import BeaconAI

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
    'Live Concert', 'Rooftop Party', 'Comedy Night', 'Bar Hopping', 'Live Music', 'Dancing', 'Karaoke',
    'Chill Lounge', 'Comedy Show', 'Game Night', 'Food Crawl', 'Sports Bar', 'Trivia Night',
    'Outdoor Patio', 'Late Night Eats', 'Themed Party', 'Open Mic', 'Wine Tasting', 'Hookah',
        'Board Games', 'Silent Disco'
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
        # Initialize your model
        # self.rec = BeaconAI()
    
    def get_user_data(self, email):
        """Fetch user data from Supabase"""
        try:
            result = self.Client.table("all_users").select(
                "preferences, travel-distance, saved_events, rejected_events, start-time, end-time, birthday, gender, preferred_days"
            ).eq("email", email).maybe_single().execute()
            return result.data
        except Exception as e:
            print(f"Error fetching user data: {e}")
            return None
        
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
                # Filter by event types matching user preferences
                query = query.in_('event_type', list(user_preferences))
            
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
        """Filter events by time - implement your logic"""
        def parse_time_str(tstr):
            if tstr is None:
                return None
            for fmt in ("%H:%M:%S", "%H:%M"):
                try:
                    return datetime.strptime(tstr, fmt).time()
                except Exception:
                    continue
            return None

        def is_time_in_range(start, end, t):
            if start <= end:
                return start <= t <= end
            else:  # Overnight
                return t >= start or t <= end

        if start_time and end_time:
            user_start = parse_time_str(str(start_time))
            user_end = parse_time_str(str(end_time))
            if user_start and user_end:
                filtered_by_time = []
                for event in events:
                    event_start = parse_time_str(str(event.get("start_time")))
                    if event_start and is_time_in_range(user_start, user_end, event_start):
                        filtered_by_time.append(event)
                events = filtered_by_time

        return events
    
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
        """Build user interactions - implement your logic"""
        interactions = []
        for user in users:
            user_name = user.get("email")
            saved_events = user.get("saved_events", [])
            # Ensure saved_events is always a list
            if not saved_events:
                continue
            if isinstance(saved_events, str):
                saved_events = [int(e.strip()) for e in saved_events.strip('{}').split(',') if e.strip()]
            for event_id in saved_events:
                interactions.append((user_name, event_id, 1))
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
        """Build event features - implement your logic"""
        event_feature_tuples = []
        for event in events:
            eid = event.get("id")
            event_types = self.parse_event_types(event.get("event_type", []))
            start_time = event.get("start_time")
            end_time = event.get("end_time")
            time_tag = self.get_time_tag(start_time, end_time) if start_time and end_time else None
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
            event_feature_tuples.append((eid, [event_types, time_tag, age_restriction, cost_range, reservation_required]))

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
    
    def recommend_events(self, email, latitude=None, longitude=None, filter_distance=True, rejected_events=None):
        """Main recommendation function"""
        try:
            print(f"Starting recommendation process for email: {email}")
            
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
                user_start_time = user_data.get("start-time")
                user_end_time = user_data.get("end-time")
                print(f"User preferences parsed: {user_preferences}")
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
                if user_start_time and user_end_time:
                    all_events_raw = self.filter_by_time(all_events_raw, user_start_time, user_end_time)
                    print(f"Events after time filter: {len(all_events_raw)}")
                
                user_preferred_days = self.parse_days(user_data.get("preferred_days", []))
                all_events_raw = self.filter_by_occurrence(all_events_raw, user_preferred_days)
                print(f"Events after occurrence filter: {len(all_events_raw)}")
                
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

            # 4. ML Recommendation logic
            try:
                all_users_result = self.Client.table("all_users").select("*").execute()
                all_users = all_users_result.data
                print(f"Users fetched: {len(all_users)}")

                user_emails = [user.get("email") for user in all_users if user.get("email")]
                interactions = self.build_interactions(all_users)
                print(f"Interactions built: {len(interactions)}")

                user_feature_tuples = self.build_user_features(all_users)
                print(f"User features built: {len(user_feature_tuples)}")
                
                event_feature_tuples = self.build_event_features(all_events_filtered)
                print(f"Event features built: {len(event_feature_tuples)}")

                rec = BeaconAI()
                rec.fit_data(user_emails, event_ids_filtered, user_feature_tuples, event_feature_tuples, interactions)
                rec.train_model()
                print("Model trained successfully")

                top_5_recommended_events = []
                recommendations = rec.recommend_for_user(
                    email,
                    top_n=5,
                )
                print(f"Recommendations generated: {len(recommendations)}")

                # Get the full event objects for the recommended events
                recommended_events = []
                for eid, score in recommendations:
                    # Find the full event object from all_events_filtered
                    event_obj = next((event for event in all_events_filtered if event["id"] == eid), None)
                    if event_obj:
                        recommended_events.append(event_obj)

                return {
                    "summary": f"Found {len(recommended_events)} recommended events for {email}",
                    "events": recommended_events,  # Now returning full event objects
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

@app.post("/recommend", response_model=RecommendationResponse)
async def get_recommendations(request: RecommendationRequest):
    """Get event recommendations for a user"""
    result = recommender.recommend_events(
        email=request.email,
        latitude=request.latitude,
        longitude=request.longitude,
        filter_distance=request.filter_distance,
        rejected_events=request.rejected_events
    )
    
    return RecommendationResponse(**result)

@app.get("/recommend")
async def get_recommendations_get(
    email: str = Query(..., description="User email"),
    latitude: Optional[float] = Query(None, description="User latitude"),
    longitude: Optional[float] = Query(None, description="User longitude"),
    filter_distance: bool = Query(True, description="Whether to filter by distance"),
    rejected_events: str = Query("", description="Comma-separated rejected event IDs")
):
    """Get event recommendations via GET request"""
    result = recommender.recommend_events(
        email=email,
        latitude=latitude,
        longitude=longitude,
        filter_distance=filter_distance,
        rejected_events=rejected_events
    )
    
    return result

# For local development
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)