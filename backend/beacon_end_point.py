from flask import Flask, request, jsonify
from beacon_torch import BeaconAI
from supabase import create_client, Client
import numpy as np
import random
import os
import jwt
import requests
from jwt import PyJWKClient
from flask_cors import CORS
from datetime import datetime, time, timedelta
from beacon_torch import BeaconAI
import math

app = Flask(__name__)
CORS(app)

# Set your Supabase credentials (use environment variables for security)
SUPABASE_URL = "https://iizdmrngykraambvsbwv.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpemRtcm5neWtyYWFtYnZzYnd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2Mzc5NDEsImV4cCI6MjA2MjIxMzk0MX0.ZmcvSrYS4bObjFQB7Mmwux7rR1kwiaWBV5CrUrOTKLY"
Client = create_client(SUPABASE_URL, SUPABASE_KEY)
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


def fetch_users_and_events():
    # Fetch all users
    users_resp = Client.table("all_users").select("*").execute()
    print("users_resp:", users_resp)
    print("users_resp.data:", users_resp.data)
    users = [u["name"] for u in users_resp.data if u.get("name")]

    # Fetch all events
    events_resp = Client.table("all_events").select("name").execute()
    print("events_resp:", events_resp)
    print("events_resp.data:", events_resp.data)
    events = [e["name"] for e in events_resp.data if e.get("name")]

    # Fetch users and events at startup (or move inside endpoint for fresh data each time)
    users, events = fetch_users_and_events()


    # Create fake interactions for demonstration
    interactions = []
    for user in users:
        liked_events = random.sample(events, min(len(events), random.randint(3, 5)))
        for event in liked_events:
            interactions.append((user, event, 1))


# Python
def remove_elements(main_array, elements_to_remove):
    # Using list comprehension
    return [item for item in main_array if item not in elements_to_remove]

# Alternative using sets (faster for large arrays)
def remove_elements_set(main_array, elements_to_remove):
    remove_set = set(elements_to_remove)
    return [item for item in main_array if item not in remove_set]

@app.route('/recommend', methods=['POST', 'GET'])
def recommend():

    print("request.json:", request.json)

    target_user = request.json.get("email")
    user_latitude = request.json.get("user_latitude") # Get user latitude from request
    user_longitude = request.json.get("user_longitude") # Get user longitude from request

    print("target_user:", target_user)
    print("user_location:", user_latitude, user_longitude) # Log user location

    if not target_user:
        print("No target user email provided.")
        return jsonify({"recommended_events": []}), 400 # Bad Request

    # 1. Fetch the target user's preferences
    user_result = Client.table("all_users").select("preferences, travel-distance, saved_events, rejected_events, start-time, end-time").eq("email", target_user).maybe_single().execute()
    user_data = user_result.data

    if not user_data:
        # Handle case where user is not found
        print(f"User {target_user} not found.")
        return jsonify({"recommended_events": []}) # Return empty list if user not found

    user_preferences = parse_preferences(user_data.get("preferences", []))
    # Get user's travel distance preference, default to 50km if not set
    user_travel_distance = user_data.get("travel-distance", 50)
    # Get user's saved and rejected events (as lists of IDs)
    saved_events = user_data.get("saved_events", [])
    rejected_events = user_data.get("rejected_events") or []
    # Convert all elements to int, regardless of type
    rejected_events = [int(e) for e in rejected_events if str(e).strip().isdigit()]
    if isinstance(saved_events, str):
        saved_events = [int(e.strip()) for e in saved_events.strip('{}').split(',') if e.strip()]
    if isinstance(rejected_events, str):
        rejected_events = [int(e.strip()) for e in rejected_events.strip('{}').split(',') if e.strip()]

    # Get user's time preferences
    user_start_time = user_data.get("start-time")
    user_end_time = user_data.get("end-time")

    print("user_travel_distance:", user_travel_distance)
    print("saved_events:", saved_events)
    print("rejected_events:", rejected_events)
    # 2. Query all_events, filtering by user preferences
    query = Client.table("all_events").select("*", "latitude", "longitude") # Select latitude and longitude

    if user_preferences:
        # If user has preferences, filter events by event_type
        # Supabase client requires list for .in_()
        query = query.in_('event_type', list(user_preferences))

    event_result = query.execute()
    all_events_raw = event_result.data # Renamed to all_events_raw

    print("all_events_raw:", len(all_events_raw))

    if not all_events_raw:
        print("No events found matching user preferences.")
        return jsonify({"recommended_events": []}) # Return empty list if no matching events

    # --- Filter by time preference ---
    
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

    if user_start_time and user_end_time:
        user_start = parse_time_str(str(user_start_time))
        user_end = parse_time_str(str(user_end_time))
        if user_start and user_end:
            filtered_by_time = []
            for event in all_events_raw:
                event_start = parse_time_str(str(event.get("start_time")))
                if event_start and is_time_in_range(user_start, user_end, event_start):
                    filtered_by_time.append(event)
            all_events_raw = filtered_by_time

    # --- End filter by time preference ---

    print("Filtered by time:", len(filtered_by_time))

    # --- Print all distances before filtering ---
    """
    if user_latitude is not None and user_longitude is not None:
        print("Distances from user to each event (before filtering):")
        for event in all_events_raw:
            event_latitude = event.get("latitude")
            event_longitude = event.get("longitude")
            event_id = event.get("id")
            event_name = event.get("name")
            if event_latitude is not None and event_longitude is not None:
                distance = calculate_distance(
                    user_latitude,
                    user_longitude,
                    event_latitude,
                    event_longitude
                )
                print(f"Event {event_id} ({event_name}): {distance:.2f} km")
            else:
                print(f"Event {event_id} ({event_name}): No location data")
    """
    # Apply distance filtering if user location is available
    all_events_filtered = []
    # Use user's travel distance preference instead of hardcoded value
    distance_threshold_km = user_travel_distance
    

    if user_latitude is not None and user_longitude is not None:
        for event in all_events_raw:
            event_latitude = event.get("latitude")
            event_longitude = event.get("longitude")
            # Check if event has location data
            if event_latitude is not None and event_longitude is not None:
                distance = calculate_distance(
                    user_latitude,
                    user_longitude,
                    event_latitude,
                    event_longitude
                )
                # Only include events within the user's travel distance threshold
                if distance <= distance_threshold_km:
                    all_events_filtered.append(event)
            else:
                # Optionally include events without location data, or filter them out
                # For now, let's include events without location data (cannot calculate distance)
                all_events_filtered.append(event)
    else:
        # If user location is not available, use all events filtered by preferences
        all_events_filtered = all_events_raw

    print("all_events_filtered:", len(all_events_filtered))

    if not all_events_filtered:
        print("No events found after applying distance filter.")
        return jsonify({"recommended_events": []})

    # 3. Build event_ids from the FILTERED events
    event_ids_filtered = [event.get("id") for event in all_events_filtered if event.get("id")]
    # Remove saved and rejected events from the pool
    exclude_ids = set(saved_events) | set(rejected_events)
    event_ids_filtered = [eid for eid in event_ids_filtered if eid not in exclude_ids]
    print("event_ids (after removing saved/rejected):", event_ids_filtered)

    # 4. Build user feature tuples and interactions from ALL users
    all_users_result = Client.table("all_users").select("*").execute()
    all_users = all_users_result.data
    if not all_users:
        print("No users found in the database.")
        return jsonify({"recommended_events": []})
    user_emails = [user.get("email") for user in all_users if user.get("email")]
    interactions = build_interactions(all_users) # Build interactions from all users

    user_feature_tuples = []
    for user in all_users:
        identifier = user.get("email") or user.get("name")
        current_user_preferences = parse_preferences(user.get("preferences", []))
        birthday = user.get("birthday")
        age = calculate_age(birthday) if birthday else None
        age_group = get_age_group(age) if age is not None else None
        start_time = user.get("start-time")
        end_time = user.get("end-time")
        time_tag = get_time_tag(start_time, end_time) if start_time and end_time else None
        gender = user.get("gender")
        user_feature_tuples.append((identifier, [current_user_preferences, age_group, time_tag, gender]))

    # 5. Build event feature tuples from the FILTERED events
    event_feature_tuples = []
    for event in all_events_filtered:
        eid = event.get("id")
        event_types = parse_event_types(event.get("event_type", []))
        start_time = event.get("start_time")
        end_time = event.get("end_time")
        time_tag = get_time_tag(start_time, end_time) if start_time and end_time else None
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

    recommended_events = request.json.get("recommended_events", [])
    # Remove events from the filtered list that were already recommended in this session
    event_ids_for_recommendation = remove_elements(event_ids_filtered, recommended_events)
    if not event_ids_for_recommendation:
        print("No new events available after filtering out previously recommended.")
        return jsonify({"recommended_events": []})

    # 6. Fit and train the AI model using filtered events
    rec = BeaconAI()
    rec.fit_data(user_emails, event_ids_for_recommendation, user_feature_tuples, event_feature_tuples, interactions)
    rec.train_model()

    # 7. Recommend from the filtered and un-recommended pool
    print("\nTop 5 Recommended Events (filtered by user preferences and session history):")
    top_5_recommended_events = []
    recommendations = rec.recommend_for_user(
        target_user,
        top_n=5,
    )
    for eid, score in recommendations:
        print(f"{eid} (score: {score:.4f})")
        top_5_recommended_events.append(eid)
    print("\nFeatures of Recommended Events (from filtered pool):")
    recommended_event_features = [feats for eid, feats in event_feature_tuples if eid in top_5_recommended_events]
    for feats in recommended_event_features:
        print(feats)
    return jsonify({"recommended_events": top_5_recommended_events})


    


def get_age_group(age):
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


def calculate_age(birthday_str):
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


def parse_time(tstr):
    if tstr is None:
        return None
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(tstr, fmt).time()
        except ValueError:
            continue
    raise ValueError(f"Unknown time format: {tstr}")

def time_in_range(start, end, t):
    """Return true if t is in the range [start, end). Handles overnight ranges."""
    if start <= end:
        return start <= t < end
    else:  # Over midnight
        return t >= start or t < end

def get_time_tag(start_time_str, end_time_str):
    print(start_time_str, end_time_str)
    start_time = parse_time(start_time_str)
    end_time = parse_time(end_time_str)
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
            tag_start = parse_time(rng['start'])
            tag_end = parse_time(rng['end'])
            if time_in_range(tag_start, tag_end, t):
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

def parse_saved_events(saved_events):
    # Handles both Postgres array string and Python list
    if isinstance(saved_events, list):
        return saved_events
    elif isinstance(saved_events, str):
        # Remove curly braces and split by comma, strip quotes and whitespace
        return [e.strip().strip('"') for e in saved_events.strip('{}').split(',') if e.strip()]
    else:
        return []

def build_interactions(all_users):
    interactions = []
    for user in all_users:
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

def parse_preferences(preferences):
    if isinstance(preferences, list):
        return tuple(preferences)
    elif isinstance(preferences, str):
        return tuple(e.strip().strip('"') for e in preferences.strip('{}').split(',') if e.strip())
    else:
        return tuple()


# Usage:
# all_users = result.data  # from your Supabase query

# all_users = result from Client.table("all_users").select("*").execute().data
# all_events = result from Client.table("all_events").select("*").execute().data

def parse_event_types(event_type):
    if isinstance(event_type, list):
        return tuple(event_type)
    elif isinstance(event_type, str):
        # Split by comma if multiple types are stored as a comma-separated string
        return tuple(e.strip().strip('"') for e in event_type.strip('{}').split(',') if e.strip())
    else:
        return tuple()

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on the earth (specified in decimal degrees)
    Returns the distance in kilometers
    """
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])

    # Haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    r = 6371  # Radius of earth in kilometers
    return c * r

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
