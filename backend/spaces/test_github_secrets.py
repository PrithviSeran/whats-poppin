#!/usr/bin/env python3
"""
Test script to validate GitHub secrets and Supabase connectivity
Run this locally with environment variables to test your configuration
"""

import os
import sys
from supabase import create_client
import requests

def test_supabase_keys():
    """Test Supabase keys and connectivity"""
    print("🔍 Testing Supabase Configuration")
    print("=" * 50)
    
    # Your known working configuration from lib/supabase.ts
    KNOWN_URL = "https://iizdmrngykraambvsbwv.supabase.co"
    KNOWN_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpemRtcm5neWtyYWFtYnZzYnd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2Mzc5NDEsImV4cCI6MjA2MjIxMzk0MX0.ZmcvSrYS4bObjFQB7Mmwux7rR1kwiaWBV5CrUrOTKLY"
    
    # Get environment variables (from GitHub secrets)
    env_url = os.environ.get('SUPABASE_URL', '').strip()
    env_anon_key = os.environ.get('SUPABASE_ANON_KEY', '').strip()
    env_service_key = os.environ.get('SERVICE_ROLE_KEY', '').strip()
    
    print(f"📋 Configuration Comparison:")
    print(f"   Known URL: {KNOWN_URL}")
    print(f"   GitHub URL: {env_url}")
    print(f"   URLs Match: {'✅' if env_url == KNOWN_URL else '❌'}")
    print()
    
    print(f"   Known Anon Key: {KNOWN_ANON_KEY[:20]}...")
    print(f"   GitHub Anon Key: {env_anon_key[:20] if env_anon_key else 'MISSING'}...")
    print(f"   Anon Keys Match: {'✅' if env_anon_key == KNOWN_ANON_KEY else '❌'}")
    print()
    
    print(f"   Service Key: {'✅ Set (' + env_service_key[:20] + '...)' if env_service_key else '❌ Missing'}")
    print()
    
    # Test 1: Test with known working credentials
    print("🧪 Test 1: Known working credentials")
    try:
        supabase_known = create_client(KNOWN_URL, KNOWN_ANON_KEY)
        result = supabase_known.table('all_users').select('email').limit(1).execute()
        print(f"   ✅ Known credentials work: Found {len(result.data)} users")
    except Exception as e:
        print(f"   ❌ Known credentials failed: {e}")
    
    # Test 2: Test with environment credentials (anon key)
    print("\n🧪 Test 2: GitHub anon key")
    if env_url and env_anon_key:
        try:
            supabase_env = create_client(env_url, env_anon_key)
            result = supabase_env.table('all_users').select('email').limit(1).execute()
            print(f"   ✅ GitHub anon key works: Found {len(result.data)} users")
        except Exception as e:
            print(f"   ❌ GitHub anon key failed: {e}")
    else:
        print("   ⏭️ Skipping - missing URL or anon key")
    
    # Test 3: Test with service role key
    print("\n🧪 Test 3: GitHub service role key")
    if env_url and env_service_key:
        try:
            supabase_service = create_client(env_url, env_service_key)
            result = supabase_service.table('all_users').select('email').limit(1).execute()
            print(f"   ✅ GitHub service key works: Found {len(result.data)} users")
        except Exception as e:
            print(f"   ❌ GitHub service key failed: {e}")
    else:
        print("   ⏭️ Skipping - missing URL or service key")
    
    # Test 4: Test Hugging Face Space URL
    print("\n🧪 Test 4: Hugging Face Space URL")
    space_url = os.environ.get('HUGGINGFACE_SPACE_URL', '').strip()
    if space_url:
        try:
            response = requests.get(f"{space_url}/", timeout=10)
            if response.status_code == 200:
                print(f"   ✅ Space URL accessible: {space_url}")
            else:
                print(f"   ⚠️ Space URL returned {response.status_code}: {space_url}")
        except Exception as e:
            print(f"   ❌ Space URL failed: {e}")
    else:
        print("   ❌ Space URL missing")

def get_service_role_key_instructions():
    """Provide instructions for getting the service role key"""
    print("\n" + "=" * 50)
    print("🔑 How to Get Your Service Role Key")
    print("=" * 50)
    print("1. Go to your Supabase project dashboard:")
    print("   https://supabase.com/dashboard/project/iizdmrngykraambvsbwv")
    print()
    print("2. Navigate to: Settings → API")
    print()
    print("3. Look for 'Project API keys' section")
    print()
    print("4. Copy the 'service_role' key (NOT the anon/public key)")
    print("   - It should start with 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'")
    print("   - It will be much longer than the anon key")
    print("   - It has elevated permissions for admin operations")
    print()
    print("5. Add it to GitHub secrets as 'SUPABASE_SERVICE_ROLE_KEY'")
    print()
    print("⚠️ WARNING: Keep the service role key secure!")
    print("   - It has admin access to your database")
    print("   - Never commit it to code or share it publicly")

def main():
    """Main test function"""
    print("🚀 GitHub Secrets Validation Test")
    print("=" * 50)
    
    # Show environment variables
    print("📍 Environment Variables:")
    for key, value in os.environ.items():
        if any(keyword in key.upper() for keyword in ['SUPABASE', 'HUGGINGFACE', 'FORCE']):
            display_value = value[:20] + "..." if len(value) > 20 else value
            print(f"   {key}: {display_value}")
    print()
    
    # Test Supabase connectivity
    test_supabase_keys()
    
    # Show instructions
    get_service_role_key_instructions()
    
    print("\n" + "=" * 50)
    print("✅ Test completed!")
    print("=" * 50)

if __name__ == "__main__":
    main() 