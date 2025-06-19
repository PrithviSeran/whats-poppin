#!/usr/bin/env python3
"""
Cloud-based scheduler for daily training of BeaconAI models
Works with Hugging Face Spaces, GitHub Actions, and other cloud platforms
"""

import asyncio
import schedule
import time
from datetime import datetime, timedelta
import logging
import os
from typing import Dict, List, Optional
import requests
import json
from concurrent.futures import ThreadPoolExecutor
from beacon_torch_cloud import HuggingFaceBeaconAI

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CloudScheduler:
    """Cloud-based scheduler for automated model training"""
    
    def __init__(self, supabase_url: str, supabase_key: str, 
                 webhook_url: Optional[str] = None):
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.webhook_url = webhook_url  # Optional webhook for notifications
        
        # Thread pool for background operations
        self.executor = ThreadPoolExecutor(max_workers=3)
        
        # Track scheduled jobs
        self.scheduled_jobs = {}
        
    def setup_daily_training(self, training_time: str = "02:00"):
        """Setup daily training schedule"""
        logger.info(f"🕐 Setting up daily training at {training_time}")
        
        # Schedule global model training
        schedule.every().day.at(training_time).do(
            self._schedule_global_training
        ).tag('global_training')
        
        # Schedule user model training (30 minutes later)
        user_time = self._add_minutes_to_time(training_time, 30)
        schedule.every().day.at(user_time).do(
            self._schedule_user_training
        ).tag('user_training')
        
        # Schedule cleanup (1 hour later)
        cleanup_time = self._add_minutes_to_time(training_time, 60)
        schedule.every().day.at(cleanup_time).do(
            self._schedule_cleanup
        ).tag('cleanup')
        
        logger.info(f"✅ Scheduled daily tasks:")
        logger.info(f"   Global training: {training_time}")
        logger.info(f"   User training: {user_time}")
        logger.info(f"   Cleanup: {cleanup_time}")
    
    def _add_minutes_to_time(self, time_str: str, minutes: int) -> str:
        """Add minutes to a time string (HH:MM format)"""
        hour, minute = map(int, time_str.split(':'))
        dt = datetime.now().replace(hour=hour, minute=minute)
        dt += timedelta(minutes=minutes)
        return dt.strftime("%H:%M")
    
    def _schedule_global_training(self):
        """Schedule global model training"""
        logger.info("🏋️ Starting global model training")
        
        future = self.executor.submit(self._train_global_model)
        self.scheduled_jobs['global_training'] = future
        
        return future
    
    def _schedule_user_training(self):
        """Schedule user-specific model training"""
        logger.info("👥 Starting user model training")
        
        future = self.executor.submit(self._train_user_models)
        self.scheduled_jobs['user_training'] = future
        
        return future
    
    def _schedule_cleanup(self):
        """Schedule model cleanup"""
        logger.info("🧹 Starting model cleanup")
        
        future = self.executor.submit(self._cleanup_old_models)
        self.scheduled_jobs['cleanup'] = future
        
        return future
    
    def _train_global_model(self):
        """Train global model using latest data"""
        try:
            logger.info("🌍 Training global model...")
            
            # Initialize BeaconAI
            beacon = HuggingFaceBeaconAI(
                supabase_url=self.supabase_url,
                supabase_key=self.supabase_key,
                user_id=None  # Global model
            )
            
            # Load training data (you'll need to implement this)
            users, events, user_features, event_features, interactions = self._load_training_data()
            
            if not interactions:
                logger.warning("⚠️ No training data found for global model")
                return
            
            # Train model
            start_time = datetime.now()
            result = beacon.load_or_train(
                users, events, user_features, event_features, interactions,
                epochs=15,
                batch_size=512,
                learning_rate=0.01
            )
            
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            
            logger.info(f"✅ Global model {result} in {duration:.1f} seconds")
            
            # Send notification
            self._send_notification(
                "Global Model Training Complete",
                f"Status: {result}, Duration: {duration:.1f}s, Interactions: {len(interactions)}"
            )
            
        except Exception as e:
            logger.error(f"❌ Global model training failed: {e}")
            self._send_notification("Global Model Training Failed", str(e))
    
    def _train_user_models(self):
        """Train user-specific models"""
        try:
            logger.info("👥 Training user-specific models...")
            
            # Get list of users who need model updates
            users_to_train = self._get_users_needing_training()
            
            if not users_to_train:
                logger.info("ℹ️ No users need model training today")
                return
            
            logger.info(f"📋 Training models for {len(users_to_train)} users")
            
            trained_count = 0
            failed_count = 0
            
            for user_id in users_to_train:
                try:
                    # Load user-specific data
                    user_data = self._load_user_training_data(user_id)
                    
                    if not user_data:
                        logger.warning(f"⚠️ No data for user {user_id}")
                        continue
                    
                    # Initialize user-specific BeaconAI
                    beacon = HuggingFaceBeaconAI(
                        supabase_url=self.supabase_url,
                        supabase_key=self.supabase_key,
                        user_id=user_id
                    )
                    
                    # Train user model
                    users, events, user_features, event_features, interactions = user_data
                    result = beacon.load_or_train(
                        users, events, user_features, event_features, interactions,
                        epochs=10,
                        batch_size=256
                    )
                    
                    if result == "trained":
                        trained_count += 1
                    
                    logger.info(f"✅ User {user_id}: {result}")
                    
                    # Small delay to avoid overwhelming the system
                    time.sleep(1)
                    
                except Exception as e:
                    logger.error(f"❌ User {user_id} training failed: {e}")
                    failed_count += 1
            
            logger.info(f"👥 User training complete: {trained_count} trained, {failed_count} failed")
            
            # Send notification
            self._send_notification(
                "User Model Training Complete",
                f"Trained: {trained_count}, Failed: {failed_count}, Total Users: {len(users_to_train)}"
            )
            
        except Exception as e:
            logger.error(f"❌ User model training failed: {e}")
            self._send_notification("User Model Training Failed", str(e))
    
    def _cleanup_old_models(self):
        """Clean up old models"""
        try:
            logger.info("🧹 Cleaning up old models...")
            
            beacon = HuggingFaceBeaconAI(
                supabase_url=self.supabase_url,
                supabase_key=self.supabase_key
            )
            
            # Clean up models older than 7 days
            beacon.cleanup_old_models(days_to_keep=7)
            
            logger.info("✅ Model cleanup complete")
            
        except Exception as e:
            logger.error(f"❌ Model cleanup failed: {e}")
    
    def _load_training_data(self):
        """Load training data from your data source"""
        # TODO: Implement your data loading logic here
        # This should return: users, events, user_features, event_features, interactions
        
        # Example implementation (replace with your actual data loading)
        logger.info("📊 Loading training data...")
        
        # You might load from:
        # - Supabase tables
        # - External APIs
        # - Data files
        # - Other databases
        
        # Placeholder data
        users = []
        events = []
        user_features = []
        event_features = []
        interactions = []
        
        logger.info(f"📊 Loaded: {len(users)} users, {len(events)} events, {len(interactions)} interactions")
        
        return users, events, user_features, event_features, interactions
    
    def _load_user_training_data(self, user_id: str):
        """Load training data for a specific user"""
        # TODO: Implement user-specific data loading
        # This should return the same format as _load_training_data but filtered for the user
        
        logger.info(f"📊 Loading data for user: {user_id}")
        
        # Placeholder - return None if no data
        return None
    
    def _get_users_needing_training(self) -> List[str]:
        """Get list of users who need model training"""
        # TODO: Implement logic to determine which users need training
        # This could be based on:
        # - New user interactions since last training
        # - Users who haven't been trained in X days
        # - Users with significant behavior changes
        
        logger.info("👥 Checking which users need training...")
        
        # Placeholder
        users_needing_training = []
        
        return users_needing_training
    
    def _send_notification(self, title: str, message: str):
        """Send notification about training status"""
        if not self.webhook_url:
            return
        
        try:
            notification = {
                "title": title,
                "message": message,
                "timestamp": datetime.now().isoformat(),
                "source": "BeaconAI Cloud Scheduler"
            }
            
            response = requests.post(
                self.webhook_url,
                json=notification,
                timeout=10
            )
            
            if response.status_code == 200:
                logger.info(f"📢 Notification sent: {title}")
            else:
                logger.warning(f"⚠️ Notification failed: {response.status_code}")
                
        except Exception as e:
            logger.error(f"❌ Notification error: {e}")
    
    def run_forever(self):
        """Run the scheduler continuously"""
        logger.info("🚀 Starting cloud scheduler...")
        logger.info("⏰ Scheduled jobs:")
        
        for job in schedule.jobs:
            logger.info(f"   {job.tags}: {job.next_run}")
        
        try:
            while True:
                schedule.run_pending()
                time.sleep(60)  # Check every minute
                
        except KeyboardInterrupt:
            logger.info("🛑 Scheduler stopped by user")
        except Exception as e:
            logger.error(f"❌ Scheduler error: {e}")
        finally:
            self.shutdown()
    
    def run_once(self):
        """Run all training jobs once (for testing)"""
        logger.info("🧪 Running all training jobs once...")
        
        # Run global training
        self._train_global_model()
        
        # Run user training
        self._train_user_models()
        
        # Run cleanup
        self._cleanup_old_models()
        
        logger.info("✅ Single run complete")
    
    def shutdown(self):
        """Shutdown the scheduler gracefully"""
        logger.info("🛑 Shutting down scheduler...")
        
        # Cancel pending jobs
        for job_name, future in self.scheduled_jobs.items():
            if not future.done():
                logger.info(f"🔄 Cancelling {job_name}...")
                future.cancel()
        
        # Shutdown thread pool
        self.executor.shutdown(wait=True)
        
        logger.info("✅ Scheduler shutdown complete")

def create_github_action():
    """Create GitHub Action for daily training"""
    github_action = """
name: Daily BeaconAI Training

on:
  schedule:
    # Run daily at 2 AM UTC
    - cron: '0 2 * * *'
  workflow_dispatch:  # Allow manual trigger

jobs:
  train-models:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.9'
    
    - name: Install dependencies
      run: |
        pip install -r requirements.txt
    
    - name: Run daily training
      env:
        SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
        SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
        WEBHOOK_URL: ${{ secrets.WEBHOOK_URL }}
      run: |
        python -c "
        import os
        from cloud_scheduler import CloudScheduler
        
        scheduler = CloudScheduler(
            supabase_url=os.getenv('SUPABASE_URL'),
            supabase_key=os.getenv('SUPABASE_KEY'),
            webhook_url=os.getenv('WEBHOOK_URL')
        )
        
        # Run all training jobs once
        scheduler.run_once()
        "
""".strip()
    
    os.makedirs(".github/workflows", exist_ok=True)
    with open(".github/workflows/daily-training.yml", "w") as f:
        f.write(github_action)
    
    print("✅ Created GitHub Action: .github/workflows/daily-training.yml")

def main():
    """Main function for testing"""
    # Get environment variables
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    webhook_url = os.getenv("WEBHOOK_URL")  # Optional
    
    if not supabase_url or not supabase_key:
        logger.error("❌ SUPABASE_URL and SUPABASE_KEY environment variables required")
        return
    
    # Create scheduler
    scheduler = CloudScheduler(
        supabase_url=supabase_url,
        supabase_key=supabase_key,
        webhook_url=webhook_url
    )
    
    # Setup daily training
    scheduler.setup_daily_training(training_time="02:00")
    
    # Choose mode
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--once":
        # Run once for testing
        scheduler.run_once()
    else:
        # Run continuously
        scheduler.run_forever()

if __name__ == "__main__":
    main() 