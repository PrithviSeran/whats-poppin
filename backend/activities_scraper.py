import requests
import json
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import time
import os
import base64
import hashlib
from urllib.parse import urlparse
from supabase import create_client, Client

# Configuration
GOOGLE_API_KEY = os.getenv('GOOGLE_PLACES_API_KEY')
YELP_API_KEY = os.getenv('YELP_API_KEY')
EVENTBRITE_API_KEY = os.getenv('EVENTBRITE_API_KEY')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_ANON_KEY')


# Food & Drink, Outdoor / Nature, Leisure & Social, Games & Entertainment, Arts & Culture, Nightlife & Parties, Wellness & Low-Energy, Experiences & Activities, Travel & Discovery

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

class TorontoActivityScraper:
    def __init__(self):
        self.google_api_key = GOOGLE_API_KEY
        self.yelp_api_key = YELP_API_KEY
        self.eventbrite_api_key = EVENTBRITE_API_KEY
        
        # Downtown Toronto bounds
        self.toronto_center = {"lat": 43.6532, "lng": -79.3832}
        self.search_radius = 5000  # 5km radius
        
        # Image handling
        self.image_storage_method = 'supabase_storage'  # Options: 'supabase_storage', 'base64', 'url_only'
        self.max_image_size = 5 * 1024 * 1024  # 5MB max
        self.supported_formats = ['jpg', 'jpeg', 'png', 'webp']
        
        # Activity categories mapping
        self.activity_types = {
            'restaurant': ['meal_delivery', 'meal_takeaway'],
            'cafe': ['cafe'],
            'shopping': ['shopping_mall', 'store'],
            'entertainment': ['movie_theater', 'amusement_park', 'bowling_alley'],
            'museum': ['museum'],
            'park': ['park'],
            'nightlife': ['night_club', 'bar'],
            'gym': ['gym'],
            'spa': ['spa', 'beauty_salon']
        }

        self.activity_types_list = [
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

        # Mapping from internal event type to categories
        self.event_type_to_category = {
            'restaurant': ['Food & Drink'],
            'cafe': ['Food & Drink'],
            'shopping': ['Leisure & Social'],
            'entertainment': ['Games & Entertainment'],
            'museum': ['Arts & Culture'],
            'park': ['Outdoor / Nature'],
            'nightlife': ['Nightlife & Parties'],
            'gym': ['Wellness & Low-Energy'],
            'spa': ['Wellness & Low-Energy'],
        }

        # Event ID counter
        self.next_event_id = 1

    def get_google_places(self, place_type: str, max_results: int = 60) -> List[Dict]:
        """Fetch places from Google Places API"""
        places = []
        next_page_token = None
        
        base_url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        
        while len(places) < max_results:
            params = {
                'location': f"{self.toronto_center['lat']},{self.toronto_center['lng']}",
                'radius': self.search_radius,
                'type': place_type,
                'key': self.google_api_key
            }
            
            if next_page_token:
                params['pagetoken'] = next_page_token
                time.sleep(2)  # Required delay for page token
            
            try:
                response = requests.get(base_url, params=params)
                response.raise_for_status()
                data = response.json()
                
                if data['status'] != 'OK' and data['status'] != 'ZERO_RESULTS':
                    print(f"Google API error: {data.get('status', 'Unknown error')}")
                    break
                
                places.extend(data.get('results', []))
                next_page_token = data.get('next_page_token')
                
                if not next_page_token or len(places) >= max_results:
                    break
                    
            except requests.RequestException as e:
                print(f"Request error: {e}")
                break
        
        return places[:max_results]

    def get_google_place_photo(self, photo_reference: str, event_id: str = None) -> Optional[str]:
        """Download photo from Google Places API"""
        if not photo_reference:
            return None
            
        url = "https://maps.googleapis.com/maps/api/place/photo"
        params = {
            'photoreference': photo_reference,
            'maxwidth': 800,
            'key': self.google_api_key
        }
        
        try:
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            # Check content type and size
            content_type = response.headers.get('content-type', '')
            if not content_type.startswith('image/'):
                return None
                
            if len(response.content) > self.max_image_size:
                print(f"Image too large: {len(response.content)} bytes")
                return None
            
            # If event_id is provided, upload to storage
            if event_id:
                return self.upload_to_supabase_storage(response.content, int(event_id))

            
        except requests.RequestException as e:
            print(f"Error downloading Google photo: {e}")
            return None

    def download_image_from_url(self, url: str, filename_prefix: str) -> Optional[str]:
        """Download image from any URL"""
        if not url:
            return None
            
        try:
            # Validate URL format
            parsed = urlparse(url)
            if not parsed.scheme or not parsed.netloc:
                return None
            
            response = requests.get(url, timeout=30, headers={
                'User-Agent': 'Mozilla/5.0 (compatible; ActivityScraper/1.0)'
            })
            response.raise_for_status()
            
            # Check content type
            content_type = response.headers.get('content-type', '')
            if not content_type.startswith('image/'):
                return None
            
            # Check file extension
            file_ext = url.split('.')[-1].lower()
            if file_ext not in self.supported_formats:
                return None
                
            if len(response.content) > self.max_image_size:
                print(f"Image too large: {len(response.content)} bytes")
                return None
            
            return self.upload_to_supabase_storage(response.content, filename_prefix)
            
        except requests.RequestException as e:
            print(f"Error downloading image from {url}: {e}")
            return None


    def upload_to_supabase_storage(self, image_data: bytes, event_id: int) -> Optional[str]:
        """Upload image to Supabase Storage and return public URL"""
        try:
            # Use just the event_id as filename
            filename = f"{event_id}.jpg"
            
            # Upload to Supabase Storage
            bucket_name = "event-images"
            
            # Upload file
            supabase.storage.from_(bucket_name).upload(
                filename, 
                image_data,
                file_options={"content-type": "image/jpeg"}
            )
            
            # Get public URL
            public_url = supabase.storage.from_(bucket_name).get_public_url(filename)
            return public_url
            
        except Exception as e:
            print(f"Error uploading to Supabase Storage: {e}")
            return None

    def extract_google_photos(self, place_details: Dict) -> List[str]:
        """Extract photo references from Google Place details"""
        photos = place_details.get('photos', [])
        photo_urls = []
        
        # Get up to 3 photos per place
        for photo in photos[:3]:
            photo_ref = photo.get('photo_reference')
            if photo_ref:
                photo_url = self.get_google_place_photo(photo_ref)
                if photo_url:
                    photo_urls.append(photo_url)
                time.sleep(0.1)  # Rate limiting
                
        return photo_urls
    def get_google_place_details(self, place_id: str) -> Dict:
        """Get detailed information for a specific place"""
        url = "https://maps.googleapis.com/maps/api/place/details/json"
        params = {
            'place_id': place_id,
            'fields': 'name,formatted_address,formatted_phone_number,website,opening_hours,price_level,rating,photos',
            'key': self.google_api_key
        }
        
        try:
            response = requests.get(url, params=params)
            response.raise_for_status()
            return response.json().get('result', {})
        except requests.RequestException as e:
            print(f"Error getting place details: {e}")
            return {}

    def get_yelp_businesses(self, category: str, limit: int = 50) -> List[Dict]:
        """Fetch businesses from Yelp Fusion API"""
        url = "https://api.yelp.com/v3/businesses/search"
        headers = {'Authorization': f'Bearer {self.yelp_api_key}'}
        
        params = {
            'location': 'Downtown Toronto, ON',
            'categories': category,
            'limit': min(limit, 50),  # Yelp max is 50 per request
            'radius': self.search_radius
        }
        
        try:
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            return response.json().get('businesses', [])
        except requests.RequestException as e:
            print(f"Yelp API error: {e}")
            return []

    def get_eventbrite_events(self, limit: int = 50) -> List[Dict]:
        """Fetch events from Eventbrite API"""
        url = "https://www.eventbriteapi.com/v3/events/search/"
        headers = {'Authorization': f'Bearer {self.eventbrite_api_key}'}
        
        params = {
            'location.address': 'Toronto, ON',
            'location.within': '10km',
            'start_date.range_start': datetime.now().isoformat(),
            'start_date.range_end': (datetime.now() + timedelta(days=90)).isoformat(),
            'expand': 'venue',
            'page_size': min(limit, 50)
        }
        
        try:
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            return response.json().get('events', [])
        except requests.RequestException as e:
            print(f"Eventbrite API error: {e}")
            return []

    def transform_google_place(self, place: Dict, event_type: str) -> Dict:
        """Transform Google Places data to match Supabase schema"""
        # Get additional details if place_id exists
        details = {}
        photos = []
        if place.get('place_id'):
            details = self.get_google_place_details(place['place_id'])
            if details:
                # Just store photo references, don't download yet
                photos = [photo.get('photo_reference') for photo in details.get('photos', [])[:3]]
            time.sleep(0.1)  # Rate limiting
        
        # Store first photo reference for later processing
        main_photo_ref = photos[0] if photos else None
        additional_photos_info = f" | Additional photos: {len(photos)-1}" if len(photos) > 1 else ""
        event_type_categories = self.event_type_to_category.get(event_type, [])
        
        return {
            'name': place.get('name', ''),
            'organization': None,
            'event_type': event_type_categories,
            'start_time': None,  # Ongoing business
            'end_time': None,
            'start_date': None,
            'end_date': None,
            'location': place.get('vicinity', details.get('formatted_address', '')),
            'cost': self.map_price_level(place.get('price_level', details.get('price_level'))),
            'age_restriction': None,
            'reservation': 'recommended' if event_type in ['restaurant', 'spa'] else None,
            'description': f"Rating: {place.get('rating', 'N/A')}/5{additional_photos_info}",
            'image': None,  # Will be set later
            'occurrence': 'ongoing',
            'latitude': place.get('geometry', {}).get('location', {}).get('lat'),
            'longitude': place.get('geometry', {}).get('location', {}).get('lng'),
            'days_of_the_week': self.extract_opening_days(details.get('opening_hours', {})),
            '_temp_image_data': main_photo_ref  # Store photo reference for later processing
        }

    def transform_yelp_business(self, business: Dict, event_type: str) -> Dict:
        """Transform Yelp data to match Supabase schema"""
        # Download Yelp image
        image_url = business.get('image_url')
        processed_image = None
        temp_image_data = None
        if image_url and self.image_storage_method != 'url_only':
            # Store URL temporarily, we'll download and process later
            temp_image_data = image_url
        elif image_url:
            processed_image = image_url  # Store URL only
        event_type_categories = self.event_type_to_category.get(event_type, [])
        
        return {
            'name': business.get('name', ''),
            'organization': None,
            'event_type': event_type_categories,
            'start_time': None,
            'end_time': None,
            'start_date': None,
            'end_date': None,
            'location': ', '.join([
                business.get('location', {}).get('address1', ''),
                business.get('location', {}).get('city', ''),
                business.get('location', {}).get('state', '')
            ]).strip(', '),
            'cost': self.map_yelp_price(business.get('price')),
            'age_restriction': None,
            'reservation': 'recommended' if event_type == 'restaurant' else None,
            'description': f"Rating: {business.get('rating', 'N/A')}/5 | {business.get('review_count', 0)} reviews",
            'image': processed_image,
            'occurrence': 'ongoing',
            'latitude': business.get('coordinates', {}).get('latitude'),
            'longitude': business.get('coordinates', {}).get('longitude'),
            'days_of_the_week': None,  # Yelp does not provide this info
            '_temp_image_data': temp_image_data
        }

    def transform_eventbrite_event(self, event: Dict) -> Dict:
        """Transform Eventbrite data to match Supabase schema"""
        start_time = event.get('start', {}).get('local', '')
        end_time = event.get('end', {}).get('local', '')
        
        # Parse datetime strings
        start_dt = None
        end_dt = None
        if start_time:
            start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
        if end_time:
            end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
        
        venue = event.get('venue', {}) or {}
        
        # Download Eventbrite logo/image
        logo_url = event.get('logo', {}).get('url') if event.get('logo') else None
        processed_image = None
        temp_image_data = None
        if logo_url and self.image_storage_method != 'url_only':
            # Store URL temporarily, we'll download and process later
            temp_image_data = logo_url
        elif logo_url:
            processed_image = logo_url  # Store URL only
        
        # For Eventbrite, use a default category
        event_type_categories = ['Experiences & Activities']
        
        return {
            'name': event.get('name', {}).get('text', ''),
            'organization': event.get('organizer', {}).get('name', ''),
            'event_type': event_type_categories,
            'start_time': start_dt.time() if start_dt else None,
            'end_time': end_dt.time() if end_dt else None,
            'start_date': start_dt.date() if start_dt else None,
            'end_date': end_dt.date() if end_dt else None,
            'location': venue.get('address', {}).get('localized_area_display', ''),
            'cost': self.extract_eventbrite_cost(event),
            'age_restriction': self.extract_age_restriction(event.get('description', {}).get('text', '')),
            'reservation': 'required',
            'description': event.get('description', {}).get('text', '')[:500],  # Truncate long descriptions
            'image': processed_image,
            'occurrence': 'single',
            'latitude': venue.get('latitude'),
            'longitude': venue.get('longitude'),
            'days_of_the_week': None,  # Eventbrite does not provide this info
            '_temp_image_data': temp_image_data
        }

    def map_price_level(self, price_level) -> Optional[float]:
        """Convert Google price level to estimated cost"""
        if price_level is None:
            return None
        price_map = {0: 0.0, 1: 25.0, 2: 50.0, 3: 100.0, 4: 200.0}
        return price_map.get(price_level, None)

    def map_yelp_price(self, price_str) -> Optional[float]:
        """Convert Yelp price string to estimated cost"""
        if not price_str:
            return None
        price_map = {'$': 25.0, '$$': 50.0, '$$$': 100.0, '$$$$': 200.0}
        return price_map.get(price_str, None)

    def extract_eventbrite_cost(self, event: Dict) -> Optional[float]:
        """Extract cost from Eventbrite event"""
        ticket_availability = event.get('ticket_availability', {})
        if ticket_availability.get('is_free'):
            return 0.0
        # You might need to make additional API calls to get ticket prices
        return None

    def extract_age_restriction(self, description: str) -> Optional[int]:
        """Extract age restrictions from event descriptions"""
        import re
        age_patterns = [r'(\d+)\+', r'ages? (\d+)', r'minimum age (\d+)']
        for pattern in age_patterns:
            match = re.search(pattern, description.lower())
            if match:
                return int(match.group(1))
        return None

    def extract_opening_days(self, opening_hours: Dict) -> Optional[List[str]]:
        """Extract opening days from Google Places opening hours"""
        if not opening_hours or not opening_hours.get('weekday_text'):
            return None
        # weekday_text example: ["Monday: 9:00 AM – 5:00 PM", ...]
        days = []
        for entry in opening_hours.get('weekday_text', []):
            day = entry.split(':')[0].strip()
            if day:
                days.append(day)
        return days if days else None

    def save_to_supabase(self, activities: List[Dict]):
        """Save activities to Supabase database"""
        try:
            # Clear existing images from the bucket
            try:
                bucket_name = "event-images"
                # List all files in the bucket
                files = supabase.storage.from_(bucket_name).list()
                # Delete each file
                for file in files:
                    supabase.storage.from_(bucket_name).remove([file['name']])
                print("Cleared existing images from storage")
            except Exception as e:
                print(f"Error clearing existing images: {e}")
            
            # Process images for each activity
            for activity in activities:
                if '_temp_image_data' in activity:
                    temp_data = activity.pop('_temp_image_data')
                    if temp_data:
                        try:
                            if isinstance(temp_data, str):
                                if temp_data.startswith('http'):
                                    # Download and process image from URL
                                    activity['image'] = self.download_image_from_url(temp_data, str(activity['id']))
                                else:
                                    # This is a Google photo reference
                                    activity['image'] = self.get_google_place_photo(temp_data, str(activity['id']))
                            else:
                                print("activity id: ", activity['id'])
                                # Process raw image data
                                activity['image'] = self.upload_to_supabase_storage(temp_data, activity['id'])
                        except Exception as e:
                            print(f"Error processing image for activity {activity['id']}: {e}")
                            activity['image'] = None
            
            # Filter out None values and ensure data types
            cleaned_activities = []
            for activity in activities:
                cleaned = {k: v for k, v in activity.items() if v is not None and not k.startswith('_')}
                cleaned_activities.append(cleaned)
            
            # Insert in batches
            batch_size = 100
            for i in range(0, len(cleaned_activities), batch_size):
                batch = cleaned_activities[i:i+batch_size]
                result = supabase.table('all_events').upsert(batch).execute()
                print(f"Inserted batch {i//batch_size + 1}: {len(batch)} records")
                
        except Exception as e:
            print(f"Error saving to Supabase: {e}")

    def run_full_scrape(self):
        """Main method to scrape all data sources"""
        all_activities = []
        
        print("Fetching Google Places data...")
        for event_type, place_types in self.activity_types.items():
            for place_type in place_types:
                places = self.get_google_places(place_type, max_results=1)
                for place in places:
                    activity = self.transform_google_place(place, event_type)
                    all_activities.append(activity)
                time.sleep(1)  # Rate limiting
        
        print("Fetching Yelp data...")
        yelp_categories = ['restaurants', 'bars', 'coffee', 'shopping', 'arts']
        for category in yelp_categories:
            businesses = self.get_yelp_businesses(category, limit=1)
            for business in businesses:
                activity = self.transform_yelp_business(business, category)
                all_activities.append(activity)
            time.sleep(1)  # Rate limiting
        
        print("Fetching Eventbrite data...")
        events = self.get_eventbrite_events(limit=1)
        for event in events:
            activity = self.transform_eventbrite_event(event)
            all_activities.append(activity)
        
        print(f"Total activities collected: {len(all_activities)}")
        
        # Remove duplicates and merge data
        print("Removing duplicates and merging data...")
        unique_activities = self.remove_duplicates(all_activities)
        merged_activities = self.merge_duplicate_data(unique_activities)
        print(f"Final unique activities after deduplication and merging: {len(merged_activities)}")
        
        # Assign IDs to the final deduplicated activities
        self.next_event_id = 1
        for activity in merged_activities:
            activity['id'] = self.next_event_id
            self.next_event_id += 1
        
        # Save to database
        self.save_to_supabase(merged_activities)
        
        return merged_activities

    def remove_duplicates(self, activities: List[Dict]) -> List[Dict]:
        """Remove duplicate activities with multiple deduplication strategies"""
        import re
        from difflib import SequenceMatcher
        
        unique_activities = []
        seen_exact = set()
        seen_fuzzy = []
        
        def normalize_name(name: str) -> str:
            """Normalize business names for comparison"""
            if not name:
                return ""
            # Remove common business suffixes and prefixes
            name = re.sub(r'\b(inc|ltd|llc|corp|restaurant|cafe|bar|the)\b', '', name.lower())
            # Remove special characters and extra spaces
            name = re.sub(r'[^\w\s]', '', name)
            name = re.sub(r'\s+', ' ', name).strip()
            return name
        
        def normalize_address(address: str) -> str:
            """Normalize addresses for comparison"""
            if not address:
                return ""
            # Remove apartment/suite numbers, standardize street abbreviations
            address = re.sub(r'\b(apt|suite|unit|#)\s*\w+', '', address.lower())
            address = re.sub(r'\b(street|st)\b', 'st', address)
            address = re.sub(r'\b(avenue|ave)\b', 'ave', address)
            address = re.sub(r'\b(road|rd)\b', 'rd', address)
            address = re.sub(r'\s+', ' ', address).strip()
            return address
        
        def is_similar_location(lat1, lng1, lat2, lng2, threshold_meters=50):
            """Check if two locations are within threshold distance"""
            if not all([lat1, lng1, lat2, lng2]):
                return False
            
            # Simple distance calculation (approximation for short distances)
            lat_diff = abs(lat1 - lat2) * 111000  # ~111km per degree lat
            lng_diff = abs(lng1 - lng2) * 111000 * 0.7  # Adjust for Toronto latitude
            distance = (lat_diff**2 + lng_diff**2)**0.5
            
            return distance < threshold_meters
        
        def similarity_ratio(str1: str, str2: str) -> float:
            """Calculate similarity ratio between two strings"""
            return SequenceMatcher(None, str1, str2).ratio()
        
        for activity in activities:
            name = activity.get('name', '')
            location = activity.get('location', '')
            lat = activity.get('latitude')
            lng = activity.get('longitude')
            
            if not name:  # Skip activities without names
                continue
            
            # Step 1: Exact duplicate check
            exact_key = (normalize_name(name), normalize_address(location))
            if exact_key in seen_exact:
                print(f"Exact duplicate found: {name}")
                continue
            
            # Step 2: Fuzzy matching for similar names + close locations
            is_duplicate = False
            for existing in seen_fuzzy:
                existing_name = existing.get('normalized_name', '')
                existing_lat = existing.get('latitude')
                existing_lng = existing.get('longitude')
                
                # Check name similarity
                name_similarity = similarity_ratio(normalize_name(name), existing_name)
                
                # If names are very similar (>0.8) and locations are close, it's likely a duplicate
                if (name_similarity > 0.8 and 
                    is_similar_location(lat, lng, existing_lat, existing_lng)):
                    print(f"Fuzzy duplicate found: '{name}' similar to '{existing.get('original_name')}'")
                    is_duplicate = True
                    break
                
                # Special case: exact name match with different addresses might be branches
                if (normalize_name(name) == existing_name and 
                    not is_similar_location(lat, lng, existing_lat, existing_lng, threshold_meters=1000)):
                    # Keep both as they might be different locations of same business
                    print(f"Same business, different location: {name}")
            
            if not is_duplicate:
                seen_exact.add(exact_key)
                seen_fuzzy.append({
                    'normalized_name': normalize_name(name),
                    'original_name': name,
                    'latitude': lat,
                    'longitude': lng
                })
                unique_activities.append(activity)
        
        return unique_activities

    def merge_duplicate_data(self, activities: List[Dict]) -> List[Dict]:
        """Merge data from duplicates to create richer records"""
        # Group potential duplicates
        grouped = {}
        
        for activity in activities:
            name = activity.get('name', '').lower().strip()
            lat = activity.get('latitude')
            lng = activity.get('longitude')
            
            # Create a location-based key
            if lat and lng:
                location_key = f"{round(lat, 4)}_{round(lng, 4)}"
            else:
                location_key = activity.get('location', '').lower()
            
            key = f"{name}_{location_key}"
            
            if key not in grouped:
                grouped[key] = []
            grouped[key].append(activity)
        
        merged_activities = []
        
        for key, group in grouped.items():
            if len(group) == 1:
                merged_activities.append(group[0])
            else:
                # Merge multiple records for the same business
                merged = self.merge_activity_records(group)
                merged_activities.append(merged)
                print(f"Merged {len(group)} records for: {group[0].get('name')}")
        
        return merged_activities

    def merge_activity_records(self, records: List[Dict]) -> Dict:
        """Merge multiple records of the same activity"""
        # Start with the most complete record (most non-null fields)
        base_record = max(records, key=lambda r: sum(1 for v in r.values() if v is not None))
        merged = base_record.copy()
        
        # Merge data from other records
        for record in records:
            for key, value in record.items():
                if value is not None and merged.get(key) is None:
                    merged[key] = value
                elif key == 'description':
                    # Combine descriptions
                    existing_desc = merged.get('description', '')
                    new_desc = value or ''
                    if new_desc and new_desc not in existing_desc:
                        merged['description'] = f"{existing_desc} | {new_desc}".strip(' |')
                elif key == '_temp_image_data' and value is not None:
                    # Preserve image data if we don't have it yet
                    if not merged.get('_temp_image_data'):
                        merged['_temp_image_data'] = value
        
        return merged

# Usage example
if __name__ == "__main__":
    # Set up your environment variables first:
    # export GOOGLE_PLACES_API_KEY="your_key_here"
    # export YELP_API_KEY="your_key_here"
    # export EVENTBRITE_API_KEY="your_key_here"
    # export SUPABASE_URL="your_supabase_url"
    # export SUPABASE_KEY="your_supabase_anon_key"
    
    scraper = TorontoActivityScraper()
    activities = scraper.run_full_scrape()
    
    print("Scraping completed!")
    print(f"Sample activity: {activities[0] if activities else 'No activities found'}")