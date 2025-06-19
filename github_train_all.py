#!/usr/bin/env python3
"""
GitHub Actions script to train all user models
This script is specifically designed to run in GitHub Actions environment
"""

import os
import sys
import requests
import json
from supabase import create_client
import time
from datetime import datetime

def main():
    """Main function to train all user models in GitHub Actions"""
    print("🚀 Starting GitHub Actions training script...")
    print(f"📍 Python version: {sys.version}")
    print(f"📍 Working directory: {os.getcwd()}")
    
    # Debug: Print all environment variables that might be relevant
    print("🔍 All environment variables:")
    for key, value in os.environ.items():
        if any(keyword in key.upper() for keyword in ['SUPABASE', 'HUGGINGFACE', 'FORCE', 'GITHUB']):
            # Mask sensitive values
            display_value = value[:10] + "..." if len(value) > 10 else value
            print(f"   {key}: {display_value}")
    
    # Get environment variables (these should be set in GitHub Actions)
    supabase_url = os.environ.get('SUPABASE_URL')
    supabase_key = os.environ.get('SUPABASE_ANON_KEY')
    service_key = os.environ.get('SERVICE_ROLE_KEY')
    space_url = os.environ.get('HUGGINGFACE_SPACE_URL')
    force_retrain = os.environ.get('FORCE_RETRAIN', 'false').lower() == 'true'
    
    print(f"🔍 Environment check:")
    print(f"   SUPABASE_URL: {'✅ Set' if supabase_url else '❌ Missing'}")
    print(f"   SUPABASE_ANON_KEY: {'✅ Set' if supabase_key else '❌ Missing'}")
    print(f"   SERVICE_ROLE_KEY: {'✅ Set' if service_key else '❌ Missing'}")
    print(f"   HUGGINGFACE_SPACE_URL: {'✅ Set' if space_url else '❌ Missing'}")
    print(f"   FORCE_RETRAIN: {force_retrain}")
    
    if not all([supabase_url, supabase_key, space_url]):
        print("❌ Missing required environment variables")
        print("Please check your GitHub repository secrets:")
        print("   - SUPABASE_URL")
        print("   - SUPABASE_ANON_KEY") 
        print("   - HUGGINGFACE_SPACE_URL")
        print("   - SERVICE_ROLE_KEY (optional but recommended)")
        sys.exit(1)
    
    # Use service role key for admin access if available
    auth_key = service_key if service_key else supabase_key
    supabase = create_client(supabase_url, auth_key)
    
    print(f"🔍 Fetching all users...")
    
    try:
        # Get all users with email addresses
        result = supabase.table('all_users').select('email').execute()
        users = result.data
        
        if not users:
            print("⚠️ No users found in all_users table")
            return
        
        print(f"👥 Found {len(users)} users to train")
        
        # Training statistics
        trained_count = 0
        failed_count = 0
        skipped_count = 0
        
        # Create auth token for API calls
        auth_token = service_key if service_key else None
        
        if not auth_token:
            print("⚠️ No SERVICE_ROLE_KEY provided - this may cause authentication issues")
        
        # Train each user's model
        for i, user in enumerate(users):
            email = user['email']
            if not email:
                continue
            
            print(f"🏋️ [{i+1}/{len(users)}] Training model for: {email}")
            
            try:
                # Prepare request
                headers = {
                    'Content-Type': 'application/json',
                }
                
                # Use service role key for authorization if available
                if auth_token:
                    headers['Authorization'] = f'Bearer {auth_token}'
                else:
                    print(f"⚠️ No auth token available for {email}, skipping...")
                    skipped_count += 1
                    continue
                
                data = {
                    'email': email,
                    'force_retrain': force_retrain
                }
                
                # Call the /admin/train endpoint (for service role access)
                response = requests.post(
                    f'{space_url}/admin/train',
                    headers=headers,
                    json=data,
                    timeout=600  # 10 minute timeout for training
                )
                
                if response.status_code == 200:
                    result_data = response.json()
                    status = result_data.get('status', 'unknown')
                    print(f"✅ {email}: {status}")
                    trained_count += 1
                else:
                    error_text = response.text[:200] + "..." if len(response.text) > 200 else response.text
                    print(f"❌ {email}: HTTP {response.status_code} - {error_text}")
                    failed_count += 1
                
                # Small delay to avoid overwhelming the system
                time.sleep(2)
                
            except requests.exceptions.Timeout:
                print(f"⏰ {email}: Training timeout (>10 minutes)")
                failed_count += 1
            except Exception as e:
                print(f"❌ {email}: {str(e)}")
                failed_count += 1
        
        # Summary
        print(f"\n📊 Training Summary:")
        print(f"   ✅ Trained: {trained_count}")
        print(f"   ❌ Failed: {failed_count}")
        print(f"   ⏭️ Skipped: {skipped_count}")
        print(f"   📋 Total: {len(users)}")
        print(f"   🕐 Completed at: {datetime.now().isoformat()}")
        
        # Exit with error if too many failures
        if len(users) > 0:
            failure_rate = failed_count / len(users)
            success_rate = trained_count / len(users)
            print(f"   📈 Success rate: {success_rate:.1%}")
            
            if failure_rate > 0.5:  # More than 50% failed
                print(f"❌ High failure rate: {failure_rate:.1%}")
                sys.exit(1)
        
        print("✅ Training completed successfully")
        
    except Exception as e:
        print(f"❌ Error fetching users or training: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main() 