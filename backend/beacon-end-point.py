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

app = Flask(__name__)
CORS(app)

# Set your Supabase credentials (use environment variables for security)
SUPABASE_URL = "https://iizdmrngykraambvsbwv.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpemRtcm5neWtyYWFtYnZzYnd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2Mzc5NDEsImV4cCI6MjA2MjIxMzk0MX0.ZmcvSrYS4bObjFQB7Mmwux7rR1kwiaWBV5CrUrOTKLY"
Client = create_client(SUPABASE_URL, SUPABASE_KEY)

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


    return users, events

# Fetch users and events at startup (or move inside endpoint for fresh data each time)
users, events = fetch_users_and_events()


# Create fake interactions for demonstration
interactions = []
for user in users:
    liked_events = random.sample(events, min(len(events), random.randint(3, 5)))
    for event in liked_events:
        interactions.append((user, event, 1))


@app.route('/recommend', methods=['POST', 'GET'])
def recommend():
    print("recommend endpoint called")
    auth_header = request.headers.get('Authorization', '')
    token = auth_header.replace('Bearer ', '')
    
    data = request.get_json()
    user_id = data.get('user_id')
    top_n = data.get('top_n', 5)
    if not user_id or user_id not in users:
        return jsonify({"error": "Invalid or missing user_id"}), 400

    # Get Supabase JWKS (public keys)
    JWKS_URL = "https://iizdmrngykraambvsbwv.supabase.co/auth/v1/keys"
    jwks = requests.get(JWKS_URL).json()

    # Use PyJWT to decode and verify
    jwk_client = PyJWKClient(JWKS_URL)
    signing_key = jwk_client.get_signing_key_from_jwt(token)
    decoded = jwt.decode(token, signing_key.key, algorithms=["RS256"], audience="https://iizdmrngykraambvsbwv.supabase.co")

    print("decoded:", decoded)

    recommendations = rec.recommend_for_user(user_id, top_n=top_n, interactions=interactions)
    return jsonify({
        "user_id": user_id,
        "recommendations": [
            {"event": event, "score": score} for event, score in recommendations
        ]
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
