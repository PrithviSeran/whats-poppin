#!/usr/bin/env python3
"""
Example client for the Event Recommendation API
Demonstrates how to interact with the Hugging Face Spaces endpoint
"""

import requests
import json
import os
from datetime import datetime, timedelta

class EventRecommendationClient:
    def __init__(self, base_url, supabase_token):
        """
        Initialize the client
        
        Args:
            base_url: Base URL of the API (e.g., 'https://your-space.hf.space')
            supabase_token: Your Supabase auth token
        """
        self.base_url = base_url.rstrip('/')
        self.headers = {
            'Authorization': f'Bearer {supabase_token}',
            'Content-Type': 'application/json'
        }
    
    def get_recommendations(self, email, **kwargs):
        """
        Get event recommendations for a user
        
        Args:
            email: User email
            **kwargs: Optional parameters like latitude, longitude, etc.
        
        Returns:
            dict: Recommendation response
        """
        data = {'email': email}
        data.update(kwargs)
        
        response = requests.post(
            f'{self.base_url}/recommend',
            headers=self.headers,
            json=data
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"API Error: {response.status_code} - {response.text}")
    
    def trigger_training(self, email, force_retrain=False):
        """
        Manually trigger model training for a user
        
        Args:
            email: User email
            force_retrain: Whether to force retraining even if model exists
        
        Returns:
            dict: Training result
        """
        response = requests.post(
            f'{self.base_url}/train',
            headers=self.headers,
            json={
                'email': email,
                'force_retrain': force_retrain
            }
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Training Error: {response.status_code} - {response.text}")
    
    def get_model_info(self, email):
        """
        Get information about a user's trained model
        
        Args:
            email: User email
        
        Returns:
            dict: Model information
        """
        response = requests.get(
            f'{self.base_url}/models/{email}',
            headers=self.headers
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Model Info Error: {response.status_code} - {response.text}")
    
    def health_check(self):
        """
        Check if the API is healthy
        
        Returns:
            dict: Health status
        """
        response = requests.get(f'{self.base_url}/health')
        return response.json()
    
    def debug_filter(self, email, **filter_params):
        """
        Debug filtering logic
        
        Args:
            email: User email
            **filter_params: Filter parameters to test
        
        Returns:
            dict: Debug information
        """
        data = {'email': email}
        data.update(filter_params)
        
        response = requests.post(
            f'{self.base_url}/debug/filter',
            headers=self.headers,
            json=data
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Debug Error: {response.status_code} - {response.text}")

def main():
    """Example usage of the Event Recommendation API"""
    
    # Configuration
    BASE_URL = "https://your-space.hf.space"  # Replace with your actual Hugging Face Space URL
    SUPABASE_TOKEN = os.getenv("SUPABASE_TOKEN", "your_token_here")  # Set this environment variable
    USER_EMAIL = "user@example.com"  # Replace with actual user email
    
    # Initialize client
    client = EventRecommendationClient(BASE_URL, SUPABASE_TOKEN)
    
    try:
        # 1. Health check
        print("🏥 Checking API health...")
        health = client.health_check()
        print(f"✅ API Status: {health['status']}")
        print()
        
        # 2. Check if user has a trained model
        print(f"🔍 Checking model for {USER_EMAIL}...")
        try:
            model_info = client.get_model_info(USER_EMAIL)
            if model_info.get('has_model'):
                print(f"✅ Model found, created: {model_info['created_at']}")
                print(f"📊 Data fingerprint: {model_info['data_fingerprint'][:10]}...")
            else:
                print("❌ No model found")
        except Exception as e:
            print(f"⚠️  Model check failed: {e}")
        print()
        
        # 3. Get basic recommendations
        print(f"🎯 Getting recommendations for {USER_EMAIL}...")
        recommendations = client.get_recommendations(
            email=USER_EMAIL,
            latitude=40.7128,  # New York City
            longitude=-74.0060,
            filter_distance=True,
            rejected_events=[],
            use_calendar_filter=False
        )
        
        print(f"📝 Summary: {recommendations['summary']}")
        print(f"🎉 Found {len(recommendations['events'])} recommended events:")
        
        for i, event in enumerate(recommendations['events'][:3], 1):
            print(f"  {i}. {event.get('name', 'Unnamed Event')}")
            if 'distance' in event and event['distance'] is not None:
                print(f"     📍 Distance: {event['distance']:.2f} km")
            if event.get('featured'):
                print(f"     ⭐ Featured Event")
        print()
        
        # 4. Get recommendations with time filter
        print("⏰ Getting recommendations with time filter (10 AM - 4 PM)...")
        time_filtered_recs = client.get_recommendations(
            email=USER_EMAIL,
            latitude=40.7128,
            longitude=-74.0060,
            user_start_time="10:00",
            user_end_time="16:00"
        )
        
        print(f"📝 Time-filtered results: {len(time_filtered_recs['events'])} events")
        print()
        
        # 5. Get recommendations with calendar filter
        tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        print(f"📅 Getting recommendations for specific date: {tomorrow}...")
        
        date_filtered_recs = client.get_recommendations(
            email=USER_EMAIL,
            use_calendar_filter=True,
            selected_dates=[tomorrow]
        )
        
        print(f"📝 Date-filtered results: {len(date_filtered_recs['events'])} events")
        print()
        
        # 6. Debug filtering logic
        print("🐛 Testing debug filter endpoint...")
        debug_info = client.debug_filter(
            email=USER_EMAIL,
            user_start_time="14:00",
            user_end_time="18:00",
            use_calendar_filter=True,
            selected_dates=[tomorrow]
        )
        
        print(f"📊 Original events: {debug_info['original_event_count']}")
        print(f"📊 Final events: {debug_info['final_event_count']}")
        if 'filtering_results' in debug_info:
            for filter_type, result in debug_info['filtering_results'].items():
                print(f"     {filter_type}: {result['events_before']} → {result['events_after']}")
        print()
        
        # 7. Trigger manual training (optional)
        print(f"🏋️ Triggering training for {USER_EMAIL}...")
        try:
            training_result = client.trigger_training(USER_EMAIL, force_retrain=False)
            print(f"✅ Training {training_result['status']}: {training_result['message']}")
        except Exception as e:
            print(f"⚠️  Training failed: {e}")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main() 