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

# Toronto Open Data Portal Configuration
TORONTO_OPEN_DATA_BASE_URL = "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action"


# Food & Drink, Outdoor / Nature, Leisure & Social, Games & Entertainment, Arts & Culture, Nightlife & Parties, Wellness & Low-Energy, Experiences & Activities, Travel & Discovery

# Initialize Supabase client
try:
    if SUPABASE_URL and SUPABASE_KEY:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    else:
        supabase = None
        print("Warning: Supabase credentials not found. Database operations will be disabled.")
except Exception as e:
    print(f"Warning: Failed to initialize Supabase client: {e}")
    supabase = None

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
        
        # Toronto Open Data datasets for parks and recreation - using correct names
        self.toronto_open_data_datasets = {
            'parks': ['green-spaces'],  # Updated to current dataset name
            'recreation': ['recreation', 'registered-programs-and-drop-in-courses-offering'],
            'projects': ['park-and-recreation-facility-projects', 'park-and-recreation-facility-study-areas']
        }

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
        if not supabase:
            print("Supabase not initialized - skipping image upload")
            return None
            
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

    def get_toronto_open_data_packages(self) -> List[Dict]:
        """Fetch available packages from Toronto Open Data Portal"""
        url = f"{TORONTO_OPEN_DATA_BASE_URL}/package_list"
        
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            data = response.json()
            
            if data.get('success') and data.get('result'):
                return data['result']
            return []
        except requests.RequestException as e:
            print(f"Toronto Open Data API error: {e}")
            return []

    def get_toronto_open_data_package_info(self, package_name: str) -> Dict:
        """Get detailed information about a specific package"""
        url = f"{TORONTO_OPEN_DATA_BASE_URL}/package_show"
        params = {'id': package_name}
        
        try:
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            
            if data.get('success') and data.get('result'):
                return data['result']
            return {}
        except requests.RequestException as e:
            print(f"Error getting package info for {package_name}: {e}")
            return {}

    def get_toronto_parks_and_recreation(self, limit: int = 100) -> List[Dict]:
        """Fetch parks and recreation data from Toronto Open Data Portal"""
        all_facilities = []
        
        # Use the correct dataset names prioritizing nature/parks/trails
        priority_datasets = [
            'green-spaces',  # Primary parks dataset - WORKING ✅
            'multi-use-trail-entrances',  # Trail entrances - from available list
            'park-and-recreation-facility-projects',  # Park facility projects - from available list
            'park-and-recreation-facility-study-areas',  # Park facility study areas - from available list
            'registered-programs-and-drop-in-courses-offering',  # Program data with locations - WORKING ✅
            'forest-and-land-cover',  # Forest and land cover data - from available list
            'cultural-spaces',  # Cultural spaces that might include outdoor venues
        ]
        
        for dataset_name in priority_datasets:
            try:
                print(f"Processing Toronto Open Data package: {dataset_name}")
                package_info = self.get_toronto_open_data_package_info(dataset_name)
                
                if not package_info:
                    print(f"No package info found for {dataset_name}")
                    continue
                
                # Look for CSV, JSON, or GeoJSON resources
                resources = package_info.get('resources', [])
                processed_data = []
                
                # Prioritize CSV format as it's most reliable
                for resource in resources:
                    format_type = resource.get('format', '').lower()
                    resource_name = resource.get('name', '').lower()
                    
                    # Skip if it's not a data file or is cached/deprecated
                    if any(skip_word in resource_name for skip_word in ['readme', 'metadata', 'cache']):
                        continue
                    
                    if format_type == 'csv' and '4326' in resource_name:  # Prefer WGS84 coordinate system
                        resource_url = resource.get('url')
                        if resource_url:
                            print(f"  Found CSV resource: {resource_name}")
                            facility_data = self.fetch_toronto_resource_data(resource_url, format_type)
                            if facility_data:
                                processed_data.extend(facility_data)
                                break  # Use first successful CSV
                
                # If no CSV worked, try JSON
                if not processed_data:
                    for resource in resources:
                        format_type = resource.get('format', '').lower()
                        resource_name = resource.get('name', '').lower()
                        
                        if format_type in ['json', 'geojson'] and not any(skip_word in resource_name for skip_word in ['readme', 'metadata', 'cache']):
                            resource_url = resource.get('url')
                            if resource_url:
                                print(f"  Found JSON resource: {resource_name}")
                                facility_data = self.fetch_toronto_resource_data(resource_url, format_type)
                                if facility_data:
                                    processed_data.extend(facility_data)
                                    break  # Use first successful JSON
                
                if processed_data:
                    print(f"  Successfully processed {len(processed_data)} records from {dataset_name}")
                    all_facilities.extend(processed_data[:limit//len(priority_datasets)])
                else:
                    print(f"  No valid data found in {dataset_name}")
                
                time_module.sleep(1)  # Rate limiting
                
            except Exception as e:
                print(f"Error processing {dataset_name}: {e}")
                continue
        
        return all_facilities[:limit]

    def fetch_toronto_resource_data(self, resource_url: str, format_type: str) -> List[Dict]:
        """Fetch and parse data from a Toronto Open Data resource"""
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (compatible; ActivityScraper/1.0)',
                'Accept': 'application/json, text/csv, text/plain, */*'
            }
            
            print(f"    Fetching data from: {resource_url}")
            response = requests.get(resource_url, timeout=30, headers=headers)
            response.raise_for_status()
            
            # Check if we actually got data
            if not response.content:
                print(f"    Empty response from {resource_url}")
                return []
            
            if format_type == 'json' or format_type == 'geojson':
                try:
                    data = response.json()
                except ValueError as e:
                    print(f"    Invalid JSON response from {resource_url}: {e}")
                    return []
                
                # Handle GeoJSON format
                if format_type == 'geojson' and 'features' in data:
                    features = data.get('features', [])
                    return [feature.get('properties', {}) for feature in features if feature.get('properties')]
                
                # Handle regular JSON - could be array or object with array
                if isinstance(data, list):
                    return data[:100]  # Limit to prevent memory issues
                elif isinstance(data, dict):
                    # Look for common array keys
                    for key in ['data', 'results', 'features', 'items', 'records']:
                        if key in data and isinstance(data[key], list):
                            return data[key][:100]  # Limit to prevent memory issues
                    return [data]  # Single object
                
            elif format_type == 'csv':
                import csv
                import io
                
                try:
                    # Handle potential encoding issues
                    text_content = response.text
                    if not text_content.strip():
                        print(f"    Empty CSV content from {resource_url}")
                        return []
                    
                    # Parse CSV data
                    facilities = []
                    csv_reader = csv.DictReader(io.StringIO(text_content))
                    
                    for i, row in enumerate(csv_reader):
                        if i >= 100:  # Limit to prevent memory issues
                            break
                        # Filter out empty rows
                        if any(value.strip() for value in row.values() if value):
                            facilities.append(dict(row))
                    
                    print(f"    Successfully parsed {len(facilities)} CSV rows")
                    return facilities
                    
                except Exception as csv_error:
                    print(f"    Error parsing CSV from {resource_url}: {csv_error}")
                    return []
            
            print(f"    Unsupported format: {format_type}")
            return []
            
        except requests.exceptions.RequestException as e:
            print(f"    Request error fetching {resource_url}: {e}")
            return []
        except Exception as e:
            print(f"    Unexpected error fetching {resource_url}: {e}")
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
            'times': self.extract_opening_times(details.get('opening_hours', {})),
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
            'times': self.extract_yelp_opening_times(business),
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
            'times': self.extract_ticketmaster_times(event),
            'link': link,  # TicketMaster event page URL
            '_temp_image_data': temp_image_data
        }

    def transform_toronto_open_data_facility(self, facility: Dict) -> Dict:
        """Transform Toronto Open Data facility to match Supabase schema"""
        
        # Debug: Print the available fields (only for first few to avoid spam)
        debug_this_facility = facility.get('_id') in ['1', '2', '3', '4', '5', '6', 1, 2, 3, 4, 5, 6]
        
        # Identify dataset types FIRST - before any other logic
        is_green_space_dataset = 'AREA_NAME' in facility and 'AREA_CLASS' in facility
        is_recreation_facility_dataset = 'Asset Name' in facility and 'Facility Type (Display Name)' in facility
        
        # Extract coordinates - handle various coordinate field names
        latitude = None
        longitude = None
        
        # Handle geometry field (GeoJSON format in green-spaces dataset)
        if 'geometry' in facility and facility['geometry']:
            try:
                import json
                geometry = json.loads(facility['geometry']) if isinstance(facility['geometry'], str) else facility['geometry']
                
                # Extract first coordinate from MultiPolygon, Polygon, MultiPoint, or Point
                if geometry.get('type') == 'MultiPolygon':
                    coords = geometry['coordinates'][0][0][0]  # First polygon, first ring, first point
                    longitude, latitude = coords[0], coords[1]
                elif geometry.get('type') == 'Polygon':
                    coords = geometry['coordinates'][0][0]  # First ring, first point
                    longitude, latitude = coords[0], coords[1]
                elif geometry.get('type') == 'MultiPoint':
                    coords = geometry['coordinates'][0]  # First point in MultiPoint
                    longitude, latitude = coords[0], coords[1]
                elif geometry.get('type') == 'Point':
                    longitude, latitude = geometry['coordinates'][0], geometry['coordinates'][1]
                else:
                    # Handle case where geometry doesn't have explicit type but has coordinates
                    if 'coordinates' in geometry and geometry['coordinates']:
                        coords_data = geometry['coordinates']
                        # Try to extract from nested coordinate structure
                        if isinstance(coords_data, list) and len(coords_data) > 0:
                            if isinstance(coords_data[0], list) and len(coords_data[0]) > 0:
                                if isinstance(coords_data[0][0], list) and len(coords_data[0][0]) > 0:
                                    # MultiPolygon-like structure
                                    first_coord = coords_data[0][0][0]
                                    if len(first_coord) >= 2:
                                        longitude, latitude = first_coord[0], first_coord[1]
            except (ValueError, TypeError, KeyError, IndexError, json.JSONDecodeError):
                pass
        
        # If geometry extraction failed, try common coordinate field names
        if latitude is None or longitude is None:
            coord_fields = [
                ('latitude', 'longitude'),
                ('lat', 'lon'),
                ('LAT', 'LONG'), 
                ('LATITUDE', 'LONGITUDE'),
                ('y', 'x'),  # Sometimes coordinates are stored as x,y
                ('Y', 'X')
            ]
            
            for lat_field, lng_field in coord_fields:
                if lat_field in facility and lng_field in facility:
                    try:
                        latitude = float(facility[lat_field])
                        longitude = float(facility[lng_field])
                        break
                    except (ValueError, TypeError):
                        continue
        
        # Extract facility name - handle Toronto Open Data specific fields
        name = ""
        
        # For Green Spaces dataset, use AREA_NAME directly
        if 'AREA_NAME' in facility and facility['AREA_NAME']:
            name = str(facility['AREA_NAME']).strip()
        
        # For Recreation Facilities dataset, extract park name from Asset Name
        elif 'Asset Name' in facility and facility['Asset Name']:
            asset_name = str(facility['Asset Name']).strip()
            # Extract park name from "ASHBRIDGES BAY PARK - Drinking Water Source (  1)" format
            if ' - ' in asset_name:
                park_name = asset_name.split(' - ')[0].strip()
                if park_name and park_name != "None":
                    name = park_name
            else:
                name = asset_name
        
        # For Park Projects and Study Areas datasets, use project_name
        elif 'project_name' in facility and facility['project_name']:
            project_name = str(facility['project_name']).strip()
            if project_name and project_name != "None":
                name = project_name
        
        # Fallback to other fields if needed
        if not name:
            fallback_fields = [
                'Facility Type (Display Name)',     # Recreation facilities dataset
                'LocationName',                     # Recreation programs dataset  
                'name', 'NAME', 
                'facility_name', 'FACILITY_NAME', 
                'park_name', 'PARK_NAME', 
                'title', 'TITLE'
            ]
            for field in fallback_fields:
                if field in facility and facility[field]:
                    candidate_name = str(facility[field]).strip()
                    if candidate_name and candidate_name != "None":
                        name = candidate_name
                        break
        
        if not name:
            # Try to build name from area description or class
            desc_fields = ['AREA_DESC', 'AREA_CLASS', 'Description']
            for field in desc_fields:
                if field in facility and facility[field] and str(facility[field]).strip() != "None":
                    name = str(facility[field]).strip()
                    break
        
        if not name:
            name = "Toronto Parks & Recreation Facility"
            
        # Debug output after name extraction
        if debug_this_facility:
            print(f"DEBUG: Extracted name: '{name}'")
            print(f"DEBUG: Available fields: {list(facility.keys())}")
            print(f"DEBUG: Sample values: {dict(list(facility.items())[:3])}")
            print(f"DEBUG: Extracted coordinates: lat={latitude}, lng={longitude}")
            if 'geometry' in facility:
                print(f"DEBUG: Geometry field present: {str(facility['geometry'])[:100]}...")
            print("---")
        
        # Extract address/location
        address_fields = [
            'AREA_DESC',        # Green spaces often have location info in description
            'address', 'ADDRESS', 
            'location', 'LOCATION', 
            'full_address', 'FULL_ADDRESS'
        ]
        location = ""
        for field in address_fields:
            if field in facility and facility[field]:
                candidate_location = str(facility[field]).strip()
                # Use AREA_DESC only if it looks like a location (contains street/area names)
                if field == 'AREA_DESC':
                    if any(indicator in candidate_location.lower() for indicator in ['street', 'avenue', 'road', 'park', 'area', 'district']):
                        location = candidate_location
                        break
                else:
                    location = candidate_location
                    break
        
        # If no specific address, try to build from components or use park name
        if not location:
            location_parts = []
            component_fields = ['street_number', 'street_name', 'district', 'ward']
            for field in component_fields:
                if field in facility and facility[field]:
                    location_parts.append(str(facility[field]).strip())
            
            if location_parts:
                location = ", ".join(location_parts) + ", Toronto, ON"
            elif is_recreation_facility_dataset and 'PARK' in name:
                # For park facilities, use the park name as location
                location = f"{name}, Toronto, ON"
            else:
                location = "Toronto, ON"
        
        # Determine facility type and category
        facility_type_fields = [
            'AREA_CLASS',                       # Green spaces dataset
            'AREA_DESC',                        # Green spaces dataset description
            'Facility Type (Display Name)',     # Recreation facilities dataset
            'FacilityType',                     # Recreation facilities dataset
            'type', 'TYPE', 
            'facility_type', 'FACILITY_TYPE', 
            'category', 'CATEGORY'
        ]
        facility_type = ""
        for field in facility_type_fields:
            if field in facility and facility[field]:
                facility_type = str(facility[field]).lower()
                break
        
        # Filter out unwanted facility types (cemeteries, etc.)
        excluded_types = [
            'cemetery', 'other_cemetery', 'graveyard', 'burial', 'memorial'
        ]
        
        # Only include parks, trails, lakes, waterfronts, and nature areas
        included_types = [
            'park', 'parks', 'green_space', 'greenspace', 'greenway',
            'trail', 'trails', 'pathway', 'walkway', 'bikeway', 'multi-use trail',
            'lake', 'pond', 'water', 'waterfront', 'beach', 'shoreline',
            'nature', 'conservation', 'forest', 'woods', 'ravine',
            'recreation', 'playground', 'sports_field', 'playing field',
            'community centre', 'community center', 'arena', 'pool'
        ]
        
        # Exclude small facilities/amenities that aren't destinations
        excluded_small_facilities = [
            'fountain', 'drinking fountain', 'dog fountain', 'water fountain',
            'bench', 'picnic table', 'trash bin', 'garbage',
            'light', 'lighting', 'sign', 'signage'
        ]
        
        # Check if facility should be excluded (cemeteries first)
        if any(excluded in facility_type for excluded in excluded_types):
            return None  # Skip this facility
            
        # Also check name for cemetery terms
        if name and any(excluded in name.lower() for excluded in excluded_types):
            return None  # Skip this facility
        
        # Special handling for recreation facilities - they might have small facility types but be from parks
        if is_recreation_facility_dataset:
            asset_name = facility.get('Asset Name', '').upper()
            if 'PARK' in asset_name:
                if debug_this_facility:
                    print(f"DEBUG: Recreation facility from park - keeping: {name}")
                # Skip small facility filtering for park amenities - they're valid
            else:
                if debug_this_facility:
                    print(f"DEBUG: Recreation facility not from park - excluding: {name}")
                return None  # Skip non-park facilities
        else:
            # For non-recreation datasets, apply small facility filtering
            # Check if this is a small facility/amenity that should be excluded
            if any(excluded in facility_type for excluded in excluded_small_facilities):
                return None  # Skip small amenities
                
            # Also check name for small facilities
            if name and any(excluded in name.lower() for excluded in excluded_small_facilities):
                return None  # Skip small amenities
        
        # Check if facility matches our desired types
        facility_matches = any(included in facility_type for included in included_types)
        
        # Also check facility name for additional filtering
        name_matches = False
        if name:
            name_lower = name.lower()
            name_matches = any(included in name_lower for included in included_types)
        
        # Apply inclusion criteria based on dataset type
        if is_green_space_dataset:
            # For green spaces, most should be included unless specifically excluded (already done above)
            if debug_this_facility:
                print(f"DEBUG: Green space dataset facility - keeping: {name}")
        elif is_recreation_facility_dataset:
            # Recreation facility logic already handled above
            pass
        else:
            # For other datasets, require positive matching
            if not (facility_matches or name_matches):
                # Additional check for generic green spaces
                if 'green' not in facility_type and 'space' not in facility_type and 'area' not in facility_type:
                    if debug_this_facility:
                        print(f"DEBUG: Other dataset facility doesn't match criteria - excluding: {name}")
                    return None  # Skip this facility
        
        # Map facility types to our categories based on what user wants
        event_type_categories = ['Outdoor / Nature']  # Default for parks/recreation
        
        if any(keyword in facility_type for keyword in ['trail', 'bike', 'cycling', 'path', 'walkway']):
            event_type_categories = ['Outdoor / Nature', 'Wellness & Low-Energy']
        elif any(keyword in facility_type for keyword in ['water', 'lake', 'pond', 'beach', 'waterfront', 'shoreline']):
            event_type_categories = ['Outdoor / Nature', 'Travel & Discovery']
        elif any(keyword in facility_type for keyword in ['forest', 'woods', 'conservation', 'ravine', 'nature']):
            event_type_categories = ['Outdoor / Nature', 'Travel & Discovery']
        elif any(keyword in facility_type for keyword in ['recreation', 'playground', 'play']):
            event_type_categories = ['Outdoor / Nature', 'Leisure & Social']
        elif any(keyword in facility_type for keyword in ['park', 'green', 'space']):
            event_type_categories = ['Outdoor / Nature']
        
        # Build description from available fields
        description_parts = []
        
        description_fields = ['description', 'DESCRIPTION', 'amenities', 'AMENITIES', 'features', 'FEATURES']
        for field in description_fields:
            if field in facility and facility[field]:
                description_parts.append(str(facility[field]).strip())
        
        # Add facility type to description if available
        if facility_type:
            description_parts.append(f"Facility type: {facility_type.title()}")
        
        # Add ward/district info if available
        ward_fields = ['ward', 'WARD', 'district', 'DISTRICT']
        for field in ward_fields:
            if field in facility and facility[field]:
                description_parts.append(f"Ward/District: {facility[field]}")
                break
        
        description = " | ".join(description_parts) if description_parts else f"Beautiful {facility_type or 'green space'} in Toronto perfect for outdoor activities and nature enjoyment"
        
        # Create link - try to find website or create Google Maps link
        link = None
        website_fields = ['website', 'WEBSITE', 'url', 'URL', 'web_site', 'WEB_SITE']
        for field in website_fields:
            if field in facility and facility[field]:
                link = str(facility[field]).strip()
                if link and not link.startswith('http'):
                    link = f"https://{link}"
                break
        
        # If no website, create Google Maps link using coordinates or address
        if not link and latitude and longitude:
            link = f"https://maps.google.com/maps?q={latitude},{longitude}"
        elif not link and location:
            encoded_location = location.replace(' ', '+').replace(',', '%2C')
            link = f"https://maps.google.com/maps?q={encoded_location}"
        
        # Extract opening hours if available
        hours_fields = ['hours', 'HOURS', 'operating_hours', 'OPERATING_HOURS', 'open_hours', 'OPEN_HOURS']
        times = None
        for field in hours_fields:
            if field in facility and facility[field]:
                # This would need more sophisticated parsing
                # For now, we'll leave it as None and let the Google Places API fill it in later
                break
        
        return {
            'name': name,
            'organization': 'City of Toronto Parks & Recreation',
            'event_type': event_type_categories,
            'start_date': None,  # Parks/facilities are ongoing
            'end_date': None,
            'location': location,
            'cost': 0.0,  # Most Toronto parks/facilities are free
            'age_restriction': None,
            'reservation': None,  # Most don't require reservations
            'description': description,
            'image': None,  # Will be processed later
            'occurrence': 'ongoing',
            'latitude': latitude,
            'longitude': longitude,
            'days_of_the_week': None,  # Would need to be parsed from hours
            'times': times,
            'link': link,
            '_temp_image_data': []  # No images from open data, will try to get from Google Places
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

    def extract_opening_times(self, opening_hours: Dict) -> Optional[Dict]:
        """Extract opening times from Google Places opening hours in the specified format
        
        Returns:
        {
            Monday: (start_time, end_time),
            Tuesday: 'all_day',
            ...
        }
        """
        if not opening_hours or not opening_hours.get('weekday_text'):
            return None
            
        import re
        
        times_dict = {}
        
        # weekday_text example: ["Monday: 9:00 AM – 5:00 PM", "Tuesday: Open 24 hours", "Wednesday: Closed"]
        for entry in opening_hours.get('weekday_text', []):
            if ':' not in entry:
                continue
                
            parts = entry.split(':', 1)
            day = parts[0].strip()
            hours_text = parts[1].strip()
            
            # Check for closed
            if 'closed' in hours_text.lower():
                continue  # Don't add closed days to the times dict
                
            # Check for 24 hours / open 24 hours
            if '24 hours' in hours_text.lower() or 'open 24' in hours_text.lower():
                times_dict[day] = 'all_day'
                continue
            
            # Try to extract time ranges using regex
            # Patterns to match: "9:00 AM – 5:00 PM", "9:00 AM - 5:00 PM", "9 AM – 5 PM", etc.
            time_pattern = r'(\d{1,2}):?(\d{0,2})\s*(AM|PM|am|pm)?\s*[–-]\s*(\d{1,2}):?(\d{0,2})\s*(AM|PM|am|pm)?'
            match = re.search(time_pattern, hours_text)
            
            if match:
                start_hour, start_min, start_ampm, end_hour, end_min, end_ampm = match.groups()
                
                # Convert to 24-hour format and then to simple format
                try:
                    # Handle start time
                    start_hour = int(start_hour)
                    start_min = int(start_min) if start_min else 0
                    
                    if start_ampm and start_ampm.lower() == 'pm' and start_hour != 12:
                        start_hour += 12
                    elif start_ampm and start_ampm.lower() == 'am' and start_hour == 12:
                        start_hour = 0
                    
                    # Handle end time
                    end_hour = int(end_hour)
                    end_min = int(end_min) if end_min else 0
                    
                    if end_ampm and end_ampm.lower() == 'pm' and end_hour != 12:
                        end_hour += 12
                    elif end_ampm and end_ampm.lower() == 'am' and end_hour == 12:
                        end_hour = 0
                    
                    # Format as "H:MM" (removing leading zero from hour)
                    start_time = f"{start_hour}:{start_min:02d}"
                    end_time = f"{end_hour}:{end_min:02d}"
                    
                    times_dict[day] = (start_time, end_time)
                    
                except (ValueError, TypeError):
                    # If parsing fails, skip this day
                    continue
        
        return times_dict if times_dict else None

    def extract_yelp_opening_times(self, business: Dict) -> Optional[Dict]:
        """Extract opening times from Yelp business data
        
        Note: Yelp API typically doesn't provide detailed opening hours in the basic search response.
        This function checks for any available hours data and attempts to get business details.
        """
        # Check if hours are included in the business response (some Yelp responses include limited hours)
        hours = business.get('hours')
        if hours and isinstance(hours, list) and len(hours) > 0:
            # Yelp hours format: [{"open": [{"is_overnight": false, "start": "1100", "end": "2200", "day": 0}], "hours_type": "REGULAR"}]
            regular_hours = None
            for hour_set in hours:
                if hour_set.get('hours_type') == 'REGULAR':
                    regular_hours = hour_set.get('open', [])
                    break
            
            if regular_hours:
                times_dict = {}
                day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
                
                for hour_info in regular_hours:
                    day_num = hour_info.get('day')  # 0 = Monday, 1 = Tuesday, etc.
                    if day_num is not None and 0 <= day_num < 7:
                        day_name = day_names[day_num]
                        start_time = hour_info.get('start')
                        end_time = hour_info.get('end')
                        
                        if start_time and end_time:
                            # Convert from Yelp format (e.g., "1100") to our format (e.g., "11:00")
                            try:
                                start_hour = int(start_time[:2])
                                start_min = int(start_time[2:])
                                end_hour = int(end_time[:2])
                                end_min = int(end_time[2:])
                                
                                start_formatted = f"{start_hour}:{start_min:02d}"
                                end_formatted = f"{end_hour}:{end_min:02d}"
                                
                                # Check if it's 24 hours (e.g., start at 00:00 and end at 23:59 or similar)
                                if start_time == "0000" and end_time in ["2359", "2400"]:
                                    times_dict[day_name] = 'all_day'
                                else:
                                    times_dict[day_name] = (start_formatted, end_formatted)
                            except (ValueError, IndexError):
                                continue
                
                return times_dict if times_dict else None
        
        # If no hours in basic response, we could potentially make a business details API call here
        # For now, return None as the basic search API doesn't typically include opening hours
        return None

    def enhance_toronto_facility_with_google_places(self, facility: Dict) -> Dict:
        """Enhance Toronto Open Data facility with Google Places information"""
        if not self.google_api_key:
            return facility
            
        # If we have coordinates, use nearby search
        if facility.get('latitude') and facility.get('longitude'):
            return self._enhance_with_coordinates(facility)
        
        # If no coordinates, try text search by name
        elif facility.get('name'):
            return self._enhance_with_text_search(facility)
        
        return facility
    
    def _enhance_with_coordinates(self, facility: Dict) -> Dict:
        """Enhance facility using coordinate-based nearby search"""
        
        try:
            # Search for nearby places using coordinates
            url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
            params = {
                'location': f"{facility['latitude']},{facility['longitude']}",
                'radius': 100,  # Small radius to find exact match
                'keyword': facility['name'],
                'key': self.google_api_key
            }
            
            response = requests.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            if data['status'] == 'OK' and data.get('results'):
                return self._process_google_place_result(facility, data['results'][0])
            
            time_module.sleep(0.1)  # Rate limiting
            return facility
            
        except Exception as e:
            print(f"Error enhancing facility with coordinates: {e}")
            return facility
    
    def _enhance_with_text_search(self, facility: Dict) -> Dict:
        """Enhance facility using text-based search when coordinates are missing"""
        try:
            # Use text search to find the place by name
            url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
            
            # Build search query - include "Toronto" to narrow results
            search_query = f"{facility['name']} Toronto park"
            
            params = {
                'query': search_query,
                'key': self.google_api_key
            }
            
            response = requests.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            if data['status'] == 'OK' and data.get('results'):
                place = data['results'][0]  # Use first result
                
                # Update facility with coordinates from Google Places
                if place.get('geometry', {}).get('location'):
                    location = place['geometry']['location']
                    facility['latitude'] = location.get('lat')
                    facility['longitude'] = location.get('lng')
                
                return self._process_google_place_result(facility, place)
            
            time_module.sleep(0.1)  # Rate limiting
            return facility
            
        except Exception as e:
            print(f"Error enhancing facility with text search: {e}")
            return facility
    
    def _process_google_place_result(self, facility: Dict, place: Dict) -> Dict:
        """Process Google Places result and enhance facility data"""
        try:
            place_id = place.get('place_id')
            
            if place_id:
                # Get detailed information including photos
                details = self.get_google_place_details(place_id)
                if details:
                    # Extract photos for image processing
                    photo_refs = [photo.get('photo_reference') for photo in details.get('photos', [])[:5] if photo.get('photo_reference')]
                    if photo_refs:
                        facility['_temp_image_data'] = photo_refs
                    
                    # Update times if available and not already set
                    if not facility.get('times') and details.get('opening_hours'):
                        facility['times'] = self.extract_opening_times(details.get('opening_hours', {}))
                    
                    # Update rating info in description
                    if place.get('rating'):
                        rating_info = f"Google Rating: {place.get('rating')}/5"
                        if rating_info not in facility['description']:
                            facility['description'] += f" | {rating_info}"
                    
                    # Update website link if available and better than current
                    if details.get('website') and (not facility.get('link') or 'maps.google.com' in facility.get('link', '')):
                        facility['link'] = details.get('website')
            
            return facility
            
        except Exception as e:
            print(f"Error processing Google Places result: {e}")
            return facility

    def extract_ticketmaster_times(self, event: Dict) -> Optional[Dict]:
        """Extract times from TicketMaster event data
        
        TicketMaster events are single occurrences, so we'll structure them differently
        """
        dates = event.get('dates', {})
        start_info = dates.get('start', {})
        end_info = dates.get('end', {})
        
        start_datetime = start_info.get('dateTime', '')
        end_datetime = end_info.get('dateTime', '')
        
        if not start_datetime:
            return None
            
        try:
            # Parse the datetime
            from datetime import datetime
            start_dt = datetime.fromisoformat(start_datetime.replace('Z', '+00:00'))
            
            # Get the day of the week
            day_name = start_dt.strftime('%A')  # Monday, Tuesday, etc.
            
            # Format times
            start_time = f"{start_dt.hour}:{start_dt.minute:02d}"
            
            if end_datetime:
                end_dt = datetime.fromisoformat(end_datetime.replace('Z', '+00:00'))
                end_time = f"{end_dt.hour}:{end_dt.minute:02d}"
            else:
                # If no end time, assume 2 hours duration (common for events)
                end_dt = start_dt.replace(hour=(start_dt.hour + 2) % 24)
                end_time = f"{end_dt.hour}:{end_dt.minute:02d}"
            
            return {day_name: (start_time, end_time)}
            
        except (ValueError, TypeError, AttributeError):
            return None

    def convert_datetime_to_string(self, obj):
        """Convert datetime and date objects to ISO format strings"""
        if isinstance(obj, datetime):
            return obj.isoformat()
        elif isinstance(obj, date):
            return obj.isoformat()
        elif isinstance(obj, dict):
            # Handle the times dictionary by recursively converting values
            converted_dict = {}
            for key, value in obj.items():
                converted_dict[key] = self.convert_datetime_to_string(value)
            return converted_dict
        elif isinstance(obj, tuple):
            # Handle tuples (like time ranges in the times dict) - these should already be strings
            return tuple(self.convert_datetime_to_string(item) for item in obj)
        elif isinstance(obj, list):
            # Handle lists by recursively converting items
            return [self.convert_datetime_to_string(item) for item in obj]
        return obj

    def save_to_supabase(self, activities: List[Dict]):
        """Save activities to Supabase database"""
        if not supabase:
            print("Supabase not initialized - skipping database save")
            print(f"Would have saved {len(activities)} activities")
            return
            
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
                places = self.get_google_places(place_type, max_results=100)
                print(f"    Found {len(places)} places")
                for place in places:
                    activity = self.transform_google_place(place, event_type)
                    all_activities.append(activity)
                time_module.sleep(1)  # Rate limiting
        
        print("\n=== Starting Yelp Scrape ===")
        yelp_categories = ['restaurants', 'bars', 'coffee', 'shopping', 'arts']
        for category in yelp_categories:
            print(f"\nScraping {category}...")
            businesses = self.get_yelp_businesses(category, limit=100)
            print(f"  Found {len(businesses)} businesses")
            for business in businesses:
                activity = self.transform_yelp_business(business, category)
                all_activities.append(activity)
            time_module.sleep(1)  # Rate limiting
        
        print("\n=== Starting TicketMaster Scrape ===")
        events = self.get_ticket_master_events(limit=100)
        print(f"Found {len(events)} events from TicketMaster")
        for event in events:
            activity = self.transform_ticket_master_event(event)
            all_activities.append(activity)
        
        print("\n=== Starting Toronto Open Data Scrape ===")
        toronto_facilities = self.get_toronto_parks_and_recreation(limit=500)  # Get more since we'll filter some out
        print(f"Found {len(toronto_facilities)} facilities from Toronto Open Data")
        processed_count = 0
        for facility in toronto_facilities:
            activity = self.transform_toronto_open_data_facility(facility)
            if activity is not None:  # Only process facilities that pass our filter
                # Enhance with Google Places data for images and additional info
                activity = self.enhance_toronto_facility_with_google_places(activity)
                all_activities.append(activity)
                processed_count += 1
                time_module.sleep(0.5)  # Rate limiting for Google Places enhancement
        print(f"After filtering, included {processed_count} Toronto parks and nature facilities")
        
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
                elif key == 'times' and value is not None:
                    # Merge times dictionaries, preferring more complete data
                    existing_times = merged.get('times', {})
                    if not existing_times or (isinstance(value, dict) and len(value) > len(existing_times)):
                        merged['times'] = value
                elif key == '_temp_image_data' and value is not None:
                    # Preserve image data if we don't have it yet
                    if not merged.get('_temp_image_data'):
                        merged['_temp_image_data'] = value
        
        return merged

    def test_toronto_open_data(self, limit: int = 3):
        """Test method to verify Toronto Open Data functionality"""
        print("\n=== Testing Toronto Open Data Integration ===")
        
        try:
            # Test getting packages
            print("Testing package list retrieval...")
            packages = self.get_toronto_open_data_packages()
            print(f"Found {len(packages)} packages available")
            
            # Test getting facilities
            print("\nTesting facility data retrieval...")
            facilities = self.get_toronto_parks_and_recreation(limit=limit)
            print(f"Retrieved {len(facilities)} facilities")
            
            # Test transformation
            transformed_facilities = []
            filtered_count = 0
            for facility in facilities:
                try:
                    transformed = self.transform_toronto_open_data_facility(facility)
                    
                    if transformed is None:
                        filtered_count += 1
                        print(f"Filtered out facility (likely cemetery or non-park): {facility.get('AREA_NAME', facility.get('name', 'Unknown'))}")
                        continue
                    
                    print(f"Transformed: {transformed.get('name', 'Unknown')}")
                    
                    # Test enhancement with Google Places (optional)
                    if self.google_api_key:
                        enhanced = self.enhance_toronto_facility_with_google_places(transformed)
                        print(f"Enhanced with Google Places data")
                        transformed_facilities.append(enhanced)
                    else:
                        print("No Google API key - skipping enhancement")
                        transformed_facilities.append(transformed)
                    
                except Exception as e:
                    print(f"Error transforming facility: {e}")
                    continue
            
            print(f"Filtered out {filtered_count} facilities (cemeteries and non-parks)")
            print(f"Kept {len(transformed_facilities)} parks and nature facilities")
            
            print(f"\nSuccessfully processed {len(transformed_facilities)} Toronto facilities")
            return transformed_facilities
            
        except Exception as e:
            print(f"Error testing Toronto Open Data: {e}")
            return []

    def get_existing_events_from_db(self) -> List[Dict]:
        """Fetch existing events from database for deduplication"""
        if not supabase:
            print("Supabase not initialized - cannot check existing events")
            return []
        
        try:
            result = supabase.table('all_events').select('id, name, location, latitude, longitude').execute()
            return result.data
        except Exception as e:
            print(f"Error fetching existing events: {e}")
            return []

    def filter_new_events_only(self, scraped_activities: List[Dict]) -> List[Dict]:
        """Filter out events that already exist in database - OPTIMIZED VERSION"""
        import re
        from difflib import SequenceMatcher
        from collections import defaultdict
        import time
        
        start_time = time.time()
        
        # Get existing events from database
        existing_events = self.get_existing_events_from_db()
        print(f"Found {len(existing_events)} existing events in database")
        
        if not existing_events:
            return scraped_activities
        
        def normalize_name(name: str) -> str:
            """Normalize business names for comparison"""
            if not name:
                return ""
            name = re.sub(r'\b(inc|ltd|llc|corp|restaurant|cafe|bar|the)\b', '', name.lower())
            name = re.sub(r'[^\w\s]', '', name)
            name = re.sub(r'\s+', ' ', name).strip()
            return name
        
        def is_similar_location(lat1, lng1, lat2, lng2, threshold_meters=100):
            """Check if two locations are within threshold distance"""
            if not all([lat1, lng1, lat2, lng2]):
                return False
            
            try:
                lat1, lng1, lat2, lng2 = float(lat1), float(lng1), float(lat2), float(lng2)
                lat_diff = abs(lat1 - lat2) * 111000
                lng_diff = abs(lng1 - lng2) * 111000 * 0.7
                distance = (lat_diff**2 + lng_diff**2)**0.5
                return distance < threshold_meters
            except (ValueError, TypeError):
                return False
        
        def similarity_ratio(str1: str, str2: str) -> float:
            """Calculate similarity ratio between two strings"""
            return SequenceMatcher(None, str1, str2).ratio()
        
        def get_location_grid_key(lat, lng, grid_size=0.01):
            """Create grid key for spatial indexing (roughly 1km grid)"""
            if not lat or not lng:
                return None
            try:
                lat, lng = float(lat), float(lng)
                return (round(lat / grid_size), round(lng / grid_size))
            except (ValueError, TypeError):
                return None
        
        # OPTIMIZATION 1: Spatial indexing - group existing events by location grid
        location_grid = defaultdict(list)
        name_index = defaultdict(list)
        
        print("Building spatial and name indexes...")
        for event in existing_events:
            normalized_name = normalize_name(event.get('name', ''))
            event_data = {
                'id': event.get('id'),
                'normalized_name': normalized_name,
                'original_name': event.get('name', ''),
                'location': event.get('location', ''),
                'latitude': event.get('latitude'),
                'longitude': event.get('longitude')
            }
            
            # Add to spatial grid (check this grid and 8 surrounding grids)
            grid_key = get_location_grid_key(event.get('latitude'), event.get('longitude'))
            if grid_key:
                location_grid[grid_key].append(event_data)
            
            # OPTIMIZATION 2: Name-based index for quick exact matches
            if normalized_name:
                # Index by first 3 characters for quick filtering
                name_prefix = normalized_name[:3] if len(normalized_name) >= 3 else normalized_name
                name_index[name_prefix].append(event_data)
        
        print(f"Created {len(location_grid)} location grids and {len(name_index)} name prefixes")
        
        new_events = []
        duplicate_count = 0
        processed_count = 0
        
        for activity in scraped_activities:
            processed_count += 1
            if processed_count % 100 == 0:
                elapsed = time.time() - start_time
                print(f"Processed {processed_count}/{len(scraped_activities)} events in {elapsed:.1f}s")
            
            activity_name = normalize_name(activity.get('name', ''))
            activity_lat = activity.get('latitude')
            activity_lng = activity.get('longitude')
            
            # OPTIMIZATION 3: Fast exact name match check first
            is_duplicate = False
            if activity_name:
                name_prefix = activity_name[:3] if len(activity_name) >= 3 else activity_name
                candidates_by_name = name_index.get(name_prefix, [])
                
                for existing in candidates_by_name:
                    if existing['normalized_name'] == activity_name:
                        # Exact name match - check location if available
                        if (not activity_lat or not activity_lng or
                            is_similar_location(activity_lat, activity_lng, 
                                              existing['latitude'], existing['longitude'])):
                            print(f"EXACT match - Skipping: '{activity.get('name')}'")
                            is_duplicate = True
                            duplicate_count += 1
                            break
            
            # OPTIMIZATION 4: Spatial filtering - only check nearby events
            if not is_duplicate and activity_lat and activity_lng:
                grid_key = get_location_grid_key(activity_lat, activity_lng)
                candidates_by_location = []
                
                if grid_key:
                    # Check current grid and 8 surrounding grids
                    for dx in [-1, 0, 1]:
                        for dy in [-1, 0, 1]:
                            nearby_grid = (grid_key[0] + dx, grid_key[1] + dy)
                            candidates_by_location.extend(location_grid.get(nearby_grid, []))
                
                # Only do expensive similarity calculation on nearby candidates
                for existing in candidates_by_location:
                    if existing['normalized_name'] == activity_name:
                        continue  # Already checked exact matches above
                    
                    # Check name similarity only for geographically close events
                    if is_similar_location(activity_lat, activity_lng, 
                                         existing['latitude'], existing['longitude']):
                        name_similarity = similarity_ratio(activity_name, existing['normalized_name'])
                        
                        if name_similarity > 0.8:
                            print(f"FUZZY match - Skipping: '{activity.get('name')}' (similar to: '{existing['original_name']}')")
                            is_duplicate = True
                            duplicate_count += 1
                            break
            
            if not is_duplicate:
                new_events.append(activity)
        
        elapsed = time.time() - start_time
        print(f"Filtering completed in {elapsed:.1f} seconds")
        print(f"Filtered out {duplicate_count} duplicates")
        print(f"Found {len(new_events)} new events to add")
        return new_events

    def save_new_events_only(self, activities: List[Dict]):
        """Save only new events to database without affecting existing ones"""
        if not supabase:
            print("Supabase not initialized - skipping database save")
            return
        
        if not activities:
            print("No new events to save")
            return
            
        try:
            print(f"\nPreparing to save {len(activities)} new events to Supabase")
            
            # Get the highest existing ID to continue from there
            try:
                result = supabase.table('all_events').select('id').order('id', desc=True).limit(1).execute()
                if result.data:
                    self.next_event_id = result.data[0]['id'] + 1
                else:
                    self.next_event_id = 1
                print(f"Starting new event IDs from: {self.next_event_id}")
            except Exception as e:
                print(f"Error getting max ID, starting from 1: {e}")
                self.next_event_id = 1
            
            # Assign IDs to new events
            for activity in activities:
                activity['id'] = self.next_event_id
                self.next_event_id += 1
            
            # Process images for each new activity
            print("\nProcessing images for new activities...")
            for activity in activities:
                print(f"Processing images for: {activity.get('name')} (ID: {activity.get('id')})")
                if '_temp_image_data' in activity:
                    temp_data = activity.pop('_temp_image_data')
                    if temp_data:
                        image_urls = []
                        try:
                            if isinstance(temp_data, list):
                                for index, image_data in enumerate(temp_data):
                                    image_url = None
                                    if isinstance(image_data, str):
                                        if image_data.startswith('http'):
                                            image_url = self.download_image_from_url(image_data, activity['id'], index)
                                        else:
                                            image_url = self.get_google_place_photo(image_data, activity['id'], index)
                                    else:
                                        image_url = self.upload_to_supabase_storage(image_data, activity['id'], index)
                                    
                                    if image_url:
                                        image_urls.append(image_url)
                                    time_module.sleep(0.2)
                            else:
                                if isinstance(temp_data, str):
                                    if temp_data.startswith('http'):
                                        image_url = self.download_image_from_url(temp_data, activity['id'], 0)
                                    else:
                                        image_url = self.get_google_place_photo(temp_data, activity['id'], 0)
                                else:
                                    image_url = self.upload_to_supabase_storage(temp_data, activity['id'], 0)
                                
                                if image_url:
                                    image_urls.append(image_url)
                            
                            if image_urls:
                                activity['image'] = image_urls[0]
                                print(f"Successfully processed {len(image_urls)} images")
                            else:
                                activity['image'] = None
                                
                        except Exception as e:
                            print(f"Error processing images for activity {activity['id']}: {e}")
                            activity['image'] = None
            
            # Clean activity data
            cleaned_activities = []
            for activity in activities:
                cleaned = {
                    k: self.convert_datetime_to_string(v) 
                    for k, v in activity.items() 
                    if v is not None and not k.startswith('_')
                }
                cleaned_activities.append(cleaned)
            
            # Insert new events (using insert instead of upsert)
            print(f"\nInserting {len(cleaned_activities)} new events into database...")
            batch_size = 100
            for i in range(0, len(cleaned_activities), batch_size):
                batch = cleaned_activities[i:i+batch_size]
                print(f"Inserting batch {i//batch_size + 1} ({len(batch)} records)...")
                result = supabase.table('all_events').insert(batch).execute()
                print(f"Successfully inserted batch {i//batch_size + 1}")
                
        except Exception as e:
            print(f"Error saving new events to Supabase: {e}")
            raise

    def run_incremental_scrape(self):
        """Main method to scrape and add only new events"""
        all_activities = []
        
        print("\n=== Starting Incremental Scrape (New Events Only) ===")
        
        print("\n=== Starting Google Places Scrape ===")
        for event_type, place_types in self.activity_types.items():
            print(f"\nScraping {event_type}...")
            for place_type in place_types:
                print(f"  - Getting {place_type} places...")
                places = self.get_google_places(place_type, max_results=100)
                print(f"    Found {len(places)} places")
                for place in places:
                    activity = self.transform_google_place(place, event_type)
                    all_activities.append(activity)
                time_module.sleep(1)  # Rate limiting
        
        print("\n=== Starting Yelp Scrape ===")
        yelp_categories = ['restaurants', 'bars', 'coffee', 'shopping', 'arts']
        for category in yelp_categories:
            print(f"\nScraping {category}...")
            businesses = self.get_yelp_businesses(category, limit=100)
            print(f"  Found {len(businesses)} businesses")
            for business in businesses:
                activity = self.transform_yelp_business(business, category)
                all_activities.append(activity)
            time_module.sleep(1)  # Rate limiting
        
        print("\n=== Starting TicketMaster Scrape ===")
        events = self.get_ticket_master_events(limit=100)
        print(f"Found {len(events)} events from TicketMaster")
        for event in events:
            activity = self.transform_ticket_master_event(event)
            all_activities.append(activity)
        
        print("\n=== Starting Toronto Open Data Scrape ===")
        toronto_facilities = self.get_toronto_parks_and_recreation(limit=500)
        print(f"Found {len(toronto_facilities)} facilities from Toronto Open Data")
        processed_count = 0
        for facility in toronto_facilities:
            activity = self.transform_toronto_open_data_facility(facility)
            if activity is not None:
                activity = self.enhance_toronto_facility_with_google_places(activity)
                all_activities.append(activity)
                processed_count += 1
                time_module.sleep(0.5)
        print(f"After filtering, included {processed_count} Toronto parks and nature facilities")
        
        print(f"\nTotal activities collected: {len(all_activities)}")
        
        # Remove duplicates within scraped data
        print("\n=== Removing Internal Duplicates ===")
        unique_activities = self.remove_duplicates(all_activities)
        print(f"Found {len(unique_activities)} unique activities after internal deduplication")
        
        print("\n=== Merging Duplicate Data ===")
        merged_activities = self.merge_duplicate_data(unique_activities)
        print(f"Final unique activities after merging: {len(merged_activities)}")
        
        # Filter against existing database events
        print("\n=== Filtering Against Existing Database Events ===")
        new_events_only = self.filter_new_events_only(merged_activities)
        
        if new_events_only:
            # Save only new events
            print("\n=== Saving New Events to Database ===")
            self.save_new_events_only(new_events_only)
        else:
            print("\nNo new events found to add!")
        
        return new_events_only

# Usage example
if __name__ == "__main__":
    # Set up your environment variables first:
    # export GOOGLE_PLACES_API_KEY="your_key_here"
    # export YELP_API_KEY="your_key_here"
    # export TICKET_MASTER_API_KEY="your_key_here"
    # export SUPABASE_URL="your_supabase_url"
    # export SUPABASE_KEY="your_supabase_anon_key"
    
    scraper = TorontoActivityScraper()
    
    # Option 1: Run incremental scrape (only add new events)
    new_activities = scraper.run_incremental_scrape()
    print("Incremental scraping completed!")
    print(f"Added {len(new_activities)} new events")
    
    # Option 2: Run full scrape (replaces all existing events)
    # activities = scraper.run_full_scrape()
    # print("Full scraping completed!")
    
    # Option 3: Test only Toronto Open Data functionality
    # test_results = scraper.test_toronto_open_data(limit=2)