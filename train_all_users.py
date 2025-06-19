#!/usr/bin/env python3
"""
Script to train all user models via the /train endpoint
Can be run locally or in CI/CD pipelines
"""

import os
import requests
import json
from supabase import create_client
import time
from datetime import datetime
import argparse
import sys
from typing import List, Dict, Optional

class UserModelTrainer:
    """Train all user models via API endpoint"""
    
    def __init__(self, supabase_url: str, supabase_key: str, 
                 space_url: str, service_key: Optional[str] = None):
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.space_url = space_url.rstrip('/')  # Remove trailing slash
        self.service_key = service_key
        
        # Initialize Supabase client
        auth_key = service_key if service_key else supabase_key
        self.supabase = create_client(supabase_url, auth_key)
        
        # Get auth token for API calls
        self.auth_token = self._get_auth_token()
    
    def _get_auth_token(self) -> Optional[str]:
        """Get authentication token for API calls"""
        if self.service_key:
            # For service role, we can use the key directly
            return self.service_key
        
        # For regular auth, you might need to implement sign-in
        # This depends on your authentication setup
        return None
    
    def get_all_users(self) -> List[Dict]:
        """Fetch all users from Supabase"""
        try:
            print("🔍 Fetching all users...")
            result = self.supabase.table('all_users').select('email').execute()
            users = [user for user in result.data if user.get('email')]
            print(f"👥 Found {len(users)} users")
            return users
        except Exception as e:
            print(f"❌ Error fetching users: {e}")
            return []
    
    def train_user(self, email: str, force_retrain: bool = False) -> Dict:
        """Train a single user's model"""
        try:
            headers = {
                'Content-Type': 'application/json',
            }
            
            if self.auth_token:
                headers['Authorization'] = f'Bearer {self.auth_token}'
            
            data = {
                'email': email,
                'force_retrain': force_retrain
            }
            
            response = requests.post(
                f'{self.space_url}/train',
                headers=headers,
                json=data,
                timeout=600  # 10 minute timeout
            )
            
            if response.status_code == 200:
                result = response.json()
                return {
                    'success': True,
                    'status': result.get('status', 'trained'),
                    'message': result.get('message', '')
                }
            else:
                return {
                    'success': False,
                    'status': 'failed',
                    'message': f"HTTP {response.status_code}: {response.text}"
                }
                
        except requests.exceptions.Timeout:
            return {
                'success': False,
                'status': 'timeout',
                'message': 'Training timeout (>10 minutes)'
            }
        except Exception as e:
            return {
                'success': False,
                'status': 'error',
                'message': str(e)
            }
    
    def train_all_users(self, force_retrain: bool = False, 
                       batch_size: int = 5, delay: float = 2.0) -> Dict:
        """Train all users with batching and rate limiting"""
        users = self.get_all_users()
        
        if not users:
            return {
                'total': 0,
                'trained': 0,
                'failed': 0,
                'skipped': 0,
                'results': []
            }
        
        if not self.auth_token:
            print("⚠️ No authentication token available")
            return {
                'total': len(users),
                'trained': 0,
                'failed': 0,
                'skipped': len(users),
                'results': []
            }
        
        print(f"🏋️ Starting training for {len(users)} users")
        print(f"⚙️ Batch size: {batch_size}, Delay: {delay}s")
        
        results = []
        trained_count = 0
        failed_count = 0
        
        for i, user in enumerate(users):
            email = user['email']
            print(f"🔄 [{i+1}/{len(users)}] Training: {email}")
            
            result = self.train_user(email, force_retrain)
            results.append({
                'email': email,
                **result
            })
            
            if result['success']:
                print(f"✅ {email}: {result['status']}")
                trained_count += 1
            else:
                print(f"❌ {email}: {result['message']}")
                failed_count += 1
            
            # Rate limiting
            if (i + 1) % batch_size == 0 and i < len(users) - 1:
                print(f"⏸️ Batch completed, waiting {delay}s...")
                time.sleep(delay)
            else:
                time.sleep(0.5)  # Small delay between requests
        
        summary = {
            'total': len(users),
            'trained': trained_count,
            'failed': failed_count,
            'skipped': 0,
            'results': results
        }
        
        return summary
    
    def print_summary(self, summary: Dict):
        """Print training summary"""
        print(f"\n📊 Training Summary:")
        print(f"   📋 Total users: {summary['total']}")
        print(f"   ✅ Trained: {summary['trained']}")
        print(f"   ❌ Failed: {summary['failed']}")
        print(f"   ⏭️ Skipped: {summary['skipped']}")
        print(f"   🕐 Completed at: {datetime.now().isoformat()}")
        
        if summary['total'] > 0:
            success_rate = summary['trained'] / summary['total']
            print(f"   📈 Success rate: {success_rate:.1%}")
        
        # Show failed users
        failed_users = [r for r in summary['results'] if not r['success']]
        if failed_users:
            print(f"\n❌ Failed users:")
            for user in failed_users[:5]:  # Show first 5
                print(f"   • {user['email']}: {user['message']}")
            if len(failed_users) > 5:
                print(f"   ... and {len(failed_users) - 5} more")

def main():
    parser = argparse.ArgumentParser(description='Train all user models')
    parser.add_argument('--force-retrain', action='store_true',
                      help='Force retrain all models')
    parser.add_argument('--batch-size', type=int, default=5,
                      help='Number of users to train before delay')
    parser.add_argument('--delay', type=float, default=2.0,
                      help='Delay between batches (seconds)')
    parser.add_argument('--space-url', type=str,
                      help='Hugging Face Space URL')
    
    args = parser.parse_args()
    
    # Get environment variables
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_ANON_KEY')
    service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    space_url = args.space_url or os.getenv('HUGGINGFACE_SPACE_URL')
    
    if not all([supabase_url, supabase_key, space_url]):
        print("❌ Missing required environment variables:")
        print("   SUPABASE_URL")
        print("   SUPABASE_ANON_KEY")
        print("   HUGGINGFACE_SPACE_URL (or --space-url)")
        sys.exit(1)
    
    print(f"🚀 Starting user model training")
    print(f"   Space URL: {space_url}")
    print(f"   Force retrain: {args.force_retrain}")
    
    trainer = UserModelTrainer(
        supabase_url=supabase_url,
        supabase_key=supabase_key,
        space_url=space_url,
        service_key=service_key
    )
    
    try:
        summary = trainer.train_all_users(
            force_retrain=args.force_retrain,
            batch_size=args.batch_size,
            delay=args.delay
        )
        
        trainer.print_summary(summary)
        
        # Exit with error if high failure rate
        if summary['total'] > 0:
            failure_rate = summary['failed'] / summary['total']
            if failure_rate > 0.5:
                print(f"❌ High failure rate: {failure_rate:.1%}")
                sys.exit(1)
        
        print("✅ Training completed successfully")
        
    except KeyboardInterrupt:
        print("\n⏹️ Training interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 