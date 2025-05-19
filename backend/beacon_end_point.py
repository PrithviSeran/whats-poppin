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
    print("recommend endpoint called")

    result = Client.table("all_users").select("*").execute()
    all_users = result.data

    result = Client.table("all_events").select("*").execute()
    all_events = result.data

    interactions = build_interactions(all_users)
    #print(all_users)

    user_emails = [user.get("email") for user in all_users if user.get("email")]
    event_names = [event.get("name") for event in all_events if event.get("name")]

    recommended_events = request.json.get("recommended_events", [])

    print("recommended_events:", recommended_events)

    event_names = remove_elements(event_names, recommended_events)

    print("event_names:", event_names)

    user_feature_tuples = []
    for user in all_users:
        identifier = user.get("email") or user.get("name")
        preferences = parse_preferences(user.get("preferences", []))
        birthday = user.get("birthday")
        age = calculate_age(birthday)
        age_group = get_age_group(age)
        start_time = user.get("start-time")
        end_time = user.get("end-time")
        time_tag = get_time_tag(start_time, end_time)
        gender = user.get("gender")
        # The features are in a list, and the tuple has two elements
        user_feature_tuples.append((identifier, [preferences, age_group, time_tag, gender]))

    event_feature_tuples = []
    for event in all_events:
        name = event.get("name")
        event_types = parse_event_types(event.get("event_type", []))
        start_time = event.get("start_time")
        end_time = event.get("end_time")
        time_tag = get_time_tag(start_time, end_time)
        age_restriction = event.get("age_restriction")
        cost = event.get("cost")
        if cost is not None:
            if cost < 20:
                cost_range = "$"
            elif cost < 50:
                cost_range = "$$"
            elif cost < 100:
                cost_range = "$$$"
            else:
                cost_range = "$$$$"
        else:
            cost_range = None
        reservation = event.get("reservation")
        reservation_required = "yes" if reservation and reservation.lower() in ["yes", "y", "true", "1"] else "no"
        # The features are in a list, and the tuple has two elements
        event_feature_tuples.append((name, [event_types, time_tag, age_restriction, cost_range, reservation_required]))


    rec = BeaconAI()
    rec.fit_data(user_emails, event_names, user_feature_tuples, event_feature_tuples, interactions)
    rec.train_model()

    target_user = request.json.get("email")
    user_feats = [feats for uid, feats in user_feature_tuples if uid == target_user]
    print(f"\n{target_user} Features:\n{user_feats[0] if user_feats else 'User not found'}")

    liked = [e for u, e, v in interactions if u == target_user and v == 1]
    print(f"\n{target_user} previously liked {len(liked)} event(s):\n{liked}")

    print("\nFeatures of Liked Events:")
    for eid, feats in event_feature_tuples:
        if eid in liked:
            print(f"{eid}: {feats}")

    print("\nTop 5 Recommended Events:")
    top_5 = []
    recommendations = rec.recommend_for_user(target_user, top_n=5)
    for eid, score in recommendations:
        print(f"{eid} (score: {score:.4f})")
        top_5.append(eid)

    print("\nFeatures of Recommended Events:")
    for eid, feats in event_feature_tuples:
        if eid in [x[0] for x in recommendations]:
            print(f"{eid}: {feats}")
    
    return jsonify({"recommended_events": top_5})


    


def get_age_group(age):
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
    start_time = parse_time(start_time_str)
    end_time = parse_time(end_time_str)
    if start_time is None or end_time is None:
        return None  # or return a default tag, e.g., "unknown"
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
        saved_events = parse_saved_events(user.get("saved_events", []))
        for event_name in saved_events:
            interactions.append((user_name, event_name, 1))
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



if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
