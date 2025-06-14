#!/usr/bin/env python3
"""
Test script for Toronto Open Data integration
Run this to test the Toronto Open Data functionality without running the full scraper
"""

import os
import sys
sys.path.append('backend')

from activities_scraper import TorontoActivityScraper

def search_available_datasets():
    """Search for available datasets related to parks and recreation"""
    scraper = TorontoActivityScraper()
    
    print("\n=== SEARCHING FOR AVAILABLE DATASETS ===")
    packages = scraper.get_toronto_open_data_packages()
    
    if packages:
        print(f"Found {len(packages)} total packages")
        
        # Search for park/recreation related datasets
        keywords = ['park', 'recreation', 'trail', 'green', 'space', 'facility', 'forest', 'nature']
        matching_datasets = []
        
        for package in packages:
            package_lower = package.lower()
            if any(keyword in package_lower for keyword in keywords):
                matching_datasets.append(package)
        
        print(f"\nFound {len(matching_datasets)} datasets related to parks/recreation:")
        for i, dataset in enumerate(sorted(matching_datasets)[:20]):  # Show first 20
            print(f"  {i+1:2d}. {dataset}")
        
        if len(matching_datasets) > 20:
            print(f"  ... and {len(matching_datasets) - 20} more")
        
        return matching_datasets
    else:
        print("❌ Could not retrieve package list")
        return []

def test_toronto_open_data():
    """Test Toronto Open Data integration"""
    scraper = TorontoActivityScraper()
    
    print("Testing Toronto Open Data Portal Integration")
    print("=" * 50)
    
    # First search for available datasets
    available_datasets = search_available_datasets()
    
    # First, let's examine raw data to understand coordinate structure
    print("\n=== EXAMINING RAW DATA STRUCTURE ===")
    facilities = scraper.get_toronto_parks_and_recreation(limit=5)
    
    if facilities:
        print(f"Found {len(facilities)} raw facilities")
        for i, facility in enumerate(facilities[:2]):  # Look at first 2
            print(f"\nFacility {i+1}:")
            print(f"  Keys: {list(facility.keys())}")
            
            # Check for geometry field specifically
            if 'geometry' in facility:
                print(f"  Geometry type: {type(facility['geometry'])}")
                print(f"  Geometry content (first 200 chars): {str(facility['geometry'])[:200]}...")
            
            # Check for coordinate fields
            coord_fields = ['latitude', 'longitude', 'lat', 'lon', 'LAT', 'LONG', 'LATITUDE', 'LONGITUDE', 'y', 'x', 'Y', 'X']
            found_coords = {}
            for field in coord_fields:
                if field in facility:
                    found_coords[field] = facility[field]
            if found_coords:
                print(f"  Found coordinate fields: {found_coords}")
            else:
                print("  No standard coordinate fields found")
    
    print("\n" + "=" * 50)
    
    # Test the Toronto Open Data functionality
    results = scraper.test_toronto_open_data(limit=15)
    
    if results:
        print(f"\n✅ Success! Retrieved and processed {len(results)} Toronto facilities")
        print("\nDetailed Analysis:")
        
        facilities_with_coords = [f for f in results if f.get('latitude') and f.get('longitude')]
        facilities_without_coords = [f for f in results if not (f.get('latitude') and f.get('longitude'))]
        
        print(f"  📍 Facilities WITH coordinates: {len(facilities_with_coords)}")
        print(f"  ❌ Facilities WITHOUT coordinates: {len(facilities_without_coords)}")
        
        if facilities_with_coords:
            print(f"\n  ✅ Facilities with coordinates (ready for Google Places image enhancement):")
            for facility in facilities_with_coords:
                print(f"    - {facility['name']} ({facility['latitude']:.4f}, {facility['longitude']:.4f})")
        
        if facilities_without_coords:
            print(f"\n  🔍 Facilities without coordinates (would use Google Text Search):")
            for facility in facilities_without_coords:
                print(f"    - {facility['name']} (would search: '{facility['name']} Toronto park')")
        
        print(f"\n📸 Image Enhancement Status:")
        if scraper.google_api_key:
            print("  ✅ Google API key available - images would be fetched")
        else:
            print("  ❌ No Google API key - images cannot be fetched")
            print("  💡 To enable images: Set GOOGLE_PLACES_API_KEY environment variable")
        
        print("\nSample facility:")
        for i, facility in enumerate(results[:1]):
            print(f"  {i+1}. {facility.get('name', 'Unknown')}")
            print(f"     Location: {facility.get('location', 'Unknown')}")
            print(f"     Categories: {facility.get('event_type', [])}")
            print(f"     Coordinates: {facility.get('latitude', 'N/A')}, {facility.get('longitude', 'N/A')}")
            print(f"     Link: {facility.get('link', 'N/A')}")
            if facility.get('_temp_image_data'):
                print(f"     Images: {len(facility.get('_temp_image_data', []))} images found")
            else:
                print(f"     Images: None (would be fetched with Google API key)")
    else:
        print("❌ No facilities were retrieved. Check your internet connection or the API endpoints.")

if __name__ == "__main__":
    # Test with a higher limit to see more filtering examples
    test_toronto_open_data() 