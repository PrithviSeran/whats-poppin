import requests
import json
from datetime import datetime, timedelta, date, time
from typing import List, Dict, Optional
import time as time_module
import os
import base64
import hashlib
from urllib.parse import urlparse
from supabase import create_client, Client

# Configuration
GOOGLE_API_KEY = os.getenv('GOOGLE_PLACES_API_KEY')
YELP_API_KEY = os.getenv('YELP_API_KEY')
TICKET_MASTER_API_KEY = os.getenv('TICKET_MASTER_API')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_ANON_KEY')


# Food & Drink, Outdoor / Nature, Leisure & Social, Games & Entertainment, Arts & Culture, Nightlife & Parties, Wellness & Low-Energy, Experiences & Activities, Travel & Discovery

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

class TorontoActivityScraper:
    def __init__(self):
        self.google_api_key = GOOGLE_API_KEY
        self.yelp_api_key = YELP_API_KEY
        self.ticket_master_api_key = TICKET_MASTER_API_KEY
        
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
                time_module.sleep(2)  # Required delay for page token
            
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

    def get_google_place_photo(self, photo_reference: str, event_id: int = None, image_index: int = 0) -> Optional[str]:
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
                return self.upload_to_supabase_storage(response.content, event_id, image_index)

            
        except requests.RequestException as e:
            print(f"Error downloading Google photo: {e}")
            return None

    def download_image_from_url(self, url: str, event_id: int, image_index: int = 0) -> Optional[str]:
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
            
            return self.upload_to_supabase_storage(response.content, event_id, image_index)
            
        except requests.RequestException as e:
            print(f"Error downloading image from {url}: {e}")
            return None

    def upload_to_supabase_storage(self, image_data: bytes, event_id: int, image_index: int = 0) -> Optional[str]:
        """Upload image to Supabase Storage in event-specific folder and return public URL"""
        try:
            # Create folder structure: event_id/image_index.jpg
            filename = f"{event_id}/{image_index}.jpg"
            
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

    def extract_google_photos(self, place_details: Dict, event_id: int) -> List[str]:
        """Extract and download multiple photos from Google Place details"""
        photos = place_details.get('photos', [])
        photo_urls = []
        
        # Get up to 5 photos per place
        for index, photo in enumerate(photos[:5]):
            photo_ref = photo.get('photo_reference')
            if photo_ref:
                photo_url = self.get_google_place_photo(photo_ref, event_id, index)
                if photo_url:
                    photo_urls.append(photo_url)
                time_module.sleep(0.1)  # Rate limiting
                
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

    def get_ticket_master_events(self, limit: int = 50) -> List[Dict]:
        """Fetch events from TicketMaster API"""
        url = "https://app.ticketmaster.com/discovery/v2/events.json"
        
        params = {
            'apikey': self.ticket_master_api_key,
            'city': 'Toronto',
            'countryCode': 'CA',
            'startDateTime': datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ'),
            'endDateTime': (datetime.now() + timedelta(days=90)).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'size': min(limit, 50),
            'sort': 'date,asc'
        }
        
        try:
            print(f"\nMaking TicketMaster API request with params: {params}")
            response = requests.get(url, params=params)
            response.raise_for_status()
            response_data = response.json()
            
            # Print the raw response for debugging
            print(f"TicketMaster API Response Status: {response.status_code}")
            print(f"Response Data: {json.dumps(response_data, indent=2)}")
            
            # TicketMaster returns events in _embedded.events
            if '_embedded' in response_data and 'events' in response_data['_embedded']:
                events = response_data['_embedded']['events']
                print(f"Successfully retrieved {len(events)} events")
                return events
            print("No events found in response")
            return []
        except requests.RequestException as e:
            print(f"TicketMaster API error: {e}")
            if hasattr(e.response, 'text'):
                print(f"Error response: {e.response.text}")
            return []

    def transform_google_place(self, place: Dict, event_type: str) -> Dict:
        """Transform Google Places data to match Supabase schema"""
        # Get additional details if place_id exists
        details = {}
        photo_refs = []
        if place.get('place_id'):
            details = self.get_google_place_details(place['place_id'])
            if details:
                # Store up to 5 photo references for later processing
                photo_refs = [photo.get('photo_reference') for photo in details.get('photos', [])[:5] if photo.get('photo_reference')]
            time_module.sleep(0.1)  # Rate limiting
        
        # Store photo references for later processing
        additional_photos_info = f" | Photos available: {len(photo_refs)}" if photo_refs else ""
        event_type_categories = self.event_type_to_category.get(event_type, [])
        
        # Generate link - prefer website from details, fallback to Google Maps URL
        link = None
        if details.get('website'):
            link = details.get('website')
        elif place.get('place_id'):
            # Create Google Maps URL using place_id
            link = f"https://maps.google.com/maps/place/?q=place_id:{place.get('place_id')}"
        
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
            'image': None,  # Will be set later with multiple images
            'occurrence': 'ongoing',
            'latitude': place.get('geometry', {}).get('location', {}).get('lat'),
            'longitude': place.get('geometry', {}).get('location', {}).get('lng'),
            'days_of_the_week': self.extract_opening_days(details.get('opening_hours', {})),
            'link': link,  # Website URL or Google Maps URL
            '_temp_image_data': photo_refs  # Store multiple photo references for later processing
        }

    def transform_yelp_business(self, business: Dict, event_type: str) -> Dict:
        """Transform Yelp data to match Supabase schema"""
        # Collect Yelp images - Yelp typically only provides one main image
        image_urls = []
        main_image = business.get('image_url')
        if main_image:
            image_urls.append(main_image)
        
        # Check if there are additional photos (some Yelp responses include photos array)
        photos = business.get('photos', [])
        for photo in photos[:4]:  # Get up to 4 additional photos
            if photo != main_image:  # Avoid duplicates
                image_urls.append(photo)
        
        processed_images = []
        temp_image_data = []
        
        if image_urls and self.image_storage_method != 'url_only':
            # Store URLs temporarily, we'll download and process later
            temp_image_data = image_urls
        elif image_urls:
            processed_images = image_urls  # Store URLs only
            
        event_type_categories = self.event_type_to_category.get(event_type, [])
        
        # Get Yelp business URL
        link = business.get('url')  # Yelp provides direct URL to business page
        
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
            'description': f"Rating: {business.get('rating', 'N/A')}/5 | {business.get('review_count', 0)} reviews | Images: {len(image_urls)}",
            'image': processed_images if processed_images else None,
            'occurrence': 'ongoing',
            'latitude': business.get('coordinates', {}).get('latitude'),
            'longitude': business.get('coordinates', {}).get('longitude'),
            'days_of_the_week': None,  # Yelp does not provide this info
            'link': link,  # Yelp business page URL
            '_temp_image_data': temp_image_data
        }

    def transform_ticket_master_event(self, event: Dict) -> Dict:
        """Transform TicketMaster data to match Supabase schema"""
        dates = event.get('dates', {})
        start_info = dates.get('start', {})
        end_info = dates.get('end', {})
        
        start_datetime = start_info.get('dateTime', '')
        end_datetime = end_info.get('dateTime', '')

        print("start_time ticketmaster: ", start_datetime)
        print("end_time ticketmaster: ", end_datetime)
        
        # Parse datetime strings
        start_dt = None
        end_dt = None
        if start_datetime:
            start_dt = datetime.fromisoformat(start_datetime.replace('Z', '+00:00'))
        if end_datetime:
            end_dt = datetime.fromisoformat(end_datetime.replace('Z', '+00:00'))
        
        # Get venue info from _embedded.venues
        venues = event.get('_embedded', {}).get('venues', [])
        venue = venues[0] if venues else {}
        
        # Get multiple images from event images array
        images = event.get('images', [])
        image_urls = []
        
        # Sort images by ratio (prefer landscape images) and get up to 5
        sorted_images = sorted(images, key=lambda x: x.get('ratio', '16_9'), reverse=True)
        for img in sorted_images[:5]:
            img_url = img.get('url')
            if img_url:
                image_urls.append(img_url)
        
        processed_images = []
        temp_image_data = []
        
        if image_urls and self.image_storage_method != 'url_only':
            # Store URLs temporarily, we'll download and process later
            temp_image_data = image_urls
        elif image_urls:
            processed_images = image_urls  # Store URLs only
        
        # Get event type from classifications
        classifications = event.get('classifications', [])
        classification = classifications[0] if classifications else {}
        segment = classification.get('segment', {})
        segment_name = segment.get('name', 'Experiences & Activities')
        
        # Map TicketMaster segments to our categories
        segment_mapping = {
            'Music': ['Experiences & Activities'],
            'Sports': ['Games & Entertainment'],
            'Arts & Theatre': ['Arts & Culture'],
            'Film': ['Arts & Culture'],
            'Miscellaneous': ['Experiences & Activities'],
            'Family': ['Experiences & Activities']
        }
        event_type_categories = segment_mapping.get(segment_name, ['Experiences & Activities'])
        
        # Build location string
        location_parts = []
        if venue.get('name'):
            location_parts.append(venue.get('name'))
        if venue.get('city', {}).get('name'):
            location_parts.append(venue.get('city', {}).get('name'))
        if venue.get('state', {}).get('name'):
            location_parts.append(venue.get('state', {}).get('name'))
        location = ', '.join(location_parts)
        
        # Update description with image count
        base_description = (event.get('info', '') or '')[:450]  # Leave room for image info
        description = f"{base_description} | Images: {len(image_urls)}" if image_urls else base_description
        
        # Get TicketMaster event URL
        link = event.get('url')  # TicketMaster provides direct URL to event page
        
        return {
            'name': event.get('name', ''),
            'organization': None,  # TicketMaster doesn't typically provide organizer info
            'event_type': event_type_categories,
            'start_time': start_dt.time() if start_dt else None,
            'end_time': end_dt.time() if end_dt else None,
            'start_date': start_dt.date() if start_dt else None,
            'end_date': end_dt.date() if end_dt else None,
            'location': location,
            'cost': self.extract_ticket_master_cost(event),
            'age_restriction': self.extract_age_restriction(event.get('info', '') or ''),
            'reservation': 'required',
            'description': description,
            'image': processed_images if processed_images else None,
            'occurrence': 'single',
            'latitude': venue.get('location', {}).get('latitude'),
            'longitude': venue.get('location', {}).get('longitude'),
            'days_of_the_week': None,  # TicketMaster does not provide this info
            'link': link,  # TicketMaster event page URL
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

    def extract_ticket_master_cost(self, event: Dict) -> Optional[float]:
        """Extract cost from TicketMaster event"""
        # Check if event has price ranges
        price_ranges = event.get('priceRanges', [])
        if price_ranges:
            # Return the minimum price from the first price range
            min_price = price_ranges[0].get('min')
            if min_price is not None:
                return float(min_price)
        
        # If no price ranges available, return None (price unknown)
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

    def convert_datetime_to_string(self, obj):
        """Convert datetime and time objects to ISO format strings"""
        if isinstance(obj, datetime):
            return obj.isoformat()
        elif isinstance(obj, time):  # Using time class from datetime
            return obj.strftime('%H:%M:%S')
        elif isinstance(obj, date):
            return obj.isoformat()
        return obj

    def save_to_supabase(self, activities: List[Dict]):
        """Save activities to Supabase database"""
        try:
            print(f"\nPreparing to save {len(activities)} activities to Supabase")
            
            # Clear existing images from the bucket
            try:
                bucket_name = "event-images"
                print("\nClearing existing images from storage...")
                # List all files/folders in the bucket
                files = supabase.storage.from_(bucket_name).list()
                print(f"Found {len(files)} existing files/folders")
                # Delete each file/folder
                for file in files:
                    if file.get('name'):
                        try:
                            # If it's a folder, list and delete contents first
                            if not file.get('name').endswith(('.jpg', '.jpeg', '.png', '.webp')):
                                # This might be a folder, try to list its contents
                                folder_files = supabase.storage.from_(bucket_name).list(file['name'])
                                folder_file_names = [f"{file['name']}/{f['name']}" for f in folder_files if f.get('name')]
                                if folder_file_names:
                                    supabase.storage.from_(bucket_name).remove(folder_file_names)
                            else:
                                # Direct file deletion
                                supabase.storage.from_(bucket_name).remove([file['name']])
                        except Exception as fe:
                            # If individual deletion fails, continue with others
                            print(f"Failed to delete {file['name']}: {fe}")
                print("Cleared existing images from storage")
            except Exception as e:
                print(f"Error clearing existing images: {e}")
            
            # Process images for each activity
            print("\nProcessing images for activities...")
            for activity in activities:
                print(f"\nProcessing activity: {activity.get('name')} (ID: {activity.get('id')})")
                if '_temp_image_data' in activity:
                    temp_data = activity.pop('_temp_image_data')
                    if temp_data:
                        image_urls = []
                        try:
                            # Handle multiple images
                            if isinstance(temp_data, list):
                                print(f"Processing {len(temp_data)} images")
                                for index, image_data in enumerate(temp_data):
                                    image_url = None
                                    if isinstance(image_data, str):
                                        if image_data.startswith('http'):
                                            # Download and process image from URL
                                            image_url = self.download_image_from_url(image_data, activity['id'], index)
                                        else:
                                            # This is a Google photo reference
                                            image_url = self.get_google_place_photo(image_data, activity['id'], index)
                                    else:
                                        # Process raw image data
                                        image_url = self.upload_to_supabase_storage(image_data, activity['id'], index)
                                    
                                    if image_url:
                                        image_urls.append(image_url)
                                    
                                    # Small delay between image downloads
                                    time_module.sleep(0.2)
                            else:
                                # Single image (legacy support)
                                if isinstance(temp_data, str):
                                    if temp_data.startswith('http'):
                                        image_url = self.download_image_from_url(temp_data, activity['id'], 0)
                                    else:
                                        image_url = self.get_google_place_photo(temp_data, activity['id'], 0)
                                else:
                                    image_url = self.upload_to_supabase_storage(temp_data, activity['id'], 0)
                                
                                if image_url:
                                    image_urls.append(image_url)
                            
                            # Store the list of image URLs or first image URL based on schema
                            if image_urls:
                                activity['image'] = image_urls[0]  # Using first image for now
                                print(f"Successfully processed {len(image_urls)} images")
                            else:
                                activity['image'] = None
                                print("No images were successfully processed")
                                
                        except Exception as e:
                            print(f"Error processing images for activity {activity['id']}: {e}")
                            activity['image'] = None
            
            # Filter out None values and ensure data types
            print("\nCleaning activity data...")
            cleaned_activities = []
            for activity in activities:
                # Convert datetime and time objects to strings
                cleaned = {
                    k: self.convert_datetime_to_string(v) 
                    for k, v in activity.items() 
                    if v is not None and not k.startswith('_')
                }
                cleaned_activities.append(cleaned)
            
            # Insert in batches
            print("\nSaving to Supabase database...")
            batch_size = 100
            for i in range(0, len(cleaned_activities), batch_size):
                batch = cleaned_activities[i:i+batch_size]
                print(f"Saving batch {i//batch_size + 1} ({len(batch)} records)...")
                result = supabase.table('all_events').upsert(batch).execute()
                print(f"Successfully saved batch {i//batch_size + 1}")
                
        except Exception as e:
            print(f"Error saving to Supabase: {e}")
            raise  # Re-raise the exception to see the full traceback

    def run_full_scrape(self):
        """Main method to scrape all data sources"""
        all_activities = []
        
        print("\n=== Starting Google Places Scrape ===")
        for event_type, place_types in self.activity_types.items():
            print(f"\nScraping {event_type}...")
            for place_type in place_types:
                print(f"  - Getting {place_type} places...")
                places = self.get_google_places(place_type, max_results=1)
                print(f"    Found {len(places)} places")
                for place in places:
                    activity = self.transform_google_place(place, event_type)
                    all_activities.append(activity)
                time_module.sleep(1)  # Rate limiting
        
        print("\n=== Starting Yelp Scrape ===")
        yelp_categories = ['restaurants', 'bars', 'coffee', 'shopping', 'arts']
        for category in yelp_categories:
            print(f"\nScraping {category}...")
            businesses = self.get_yelp_businesses(category, limit=1)
            print(f"  Found {len(businesses)} businesses")
            for business in businesses:
                activity = self.transform_yelp_business(business, category)
                all_activities.append(activity)
            time_module.sleep(1)  # Rate limiting
        
        print("\n=== Starting TicketMaster Scrape ===")
        events = self.get_ticket_master_events(limit=1)
        print(f"Found {len(events)} events from TicketMaster")
        for event in events:
            activity = self.transform_ticket_master_event(event)
            all_activities.append(activity)
        
        print(f"\nTotal activities collected: {len(all_activities)}")
        
        # Remove duplicates and merge data
        print("\n=== Removing Duplicates ===")
        unique_activities = self.remove_duplicates(all_activities)
        print(f"Found {len(unique_activities)} unique activities after deduplication")
        
        print("\n=== Merging Duplicate Data ===")
        merged_activities = self.merge_duplicate_data(unique_activities)
        print(f"Final unique activities after merging: {len(merged_activities)}")
        
        # Assign IDs to the final deduplicated activities
        print("\n=== Assigning IDs ===")
        self.next_event_id = 1
        for activity in merged_activities:
            activity['id'] = self.next_event_id
            self.next_event_id += 1
        
        # Save to database
        print("\n=== Saving to Database ===")
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
                try:
                    lat_float = float(lat)
                    lng_float = float(lng)
                    location_key = f"{round(lat_float, 4)}_{round(lng_float, 4)}"
                except (ValueError, TypeError):
                    location_key = activity.get('location', '').lower()
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
    # export TICKET_MASTER_API_KEY="your_key_here"
    # export SUPABASE_URL="your_supabase_url"
    # export SUPABASE_KEY="your_supabase_anon_key"
    
    scraper = TorontoActivityScraper()
    activities = scraper.run_full_scrape()
    
    print("Scraping completed!")
    print(f"Sample activity: {activities[0] if activities else 'No activities found'}")