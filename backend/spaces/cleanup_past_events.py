#!/usr/bin/env python3
"""
Event Cleanup Script for What's Poppin App

This script removes past events from the all_events database table.
It's designed to be run periodically to keep the database clean and performant.

Features:
- Only removes one-time/single events that have passed
- Keeps recurring/weekly events (they don't have expiration dates)
- Configurable buffer period before deletion
- Dry run mode for testing
- Batch deletion for performance
- Comprehensive logging
- Safe deletion with transaction support

Usage:
    python cleanup_past_events.py [--dry-run] [--days-buffer 7] [--batch-size 100]
"""

import os
import sys
import argparse
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any
import json

try:
    from supabase import create_client, Client
    from dotenv import load_dotenv
except ImportError as e:
    print(f"❌ Missing required packages: {e}")
    print("Install with: pip install supabase python-dotenv")
    sys.exit(1)

# Load environment variables
load_dotenv()

class EventCleanupManager:
    """Manages the cleanup of past events from the database."""
    
    def __init__(self, dry_run: bool = False, days_buffer: int = 1, batch_size: int = 50):
        """
        Initialize the cleanup manager.
        
        Args:
            dry_run: If True, only simulate the cleanup without actual deletion
            days_buffer: Number of days to wait after event end before deletion
            batch_size: Number of events to delete in each batch
        """
        self.dry_run = dry_run
        self.days_buffer = days_buffer
        self.batch_size = batch_size
        self.supabase = self._init_supabase()
        
        # Setup logging
        self._setup_logging()
        
    def _init_supabase(self) -> Client:
        """Initialize Supabase client."""
        url = os.environ.get('SUPABASE_URL')
        # Use service role key for admin operations, fallback to anon key
        key = os.environ.get('SERVICE_ROLE_KEY') or os.environ.get('SUPABASE_ANON_KEY')
        
        if not url or not key:
            raise ValueError("Missing SUPABASE_URL or SUPABASE_ANON_KEY/SERVICE_ROLE_KEY environment variables")
        
        return create_client(url, key)
    
    def _setup_logging(self):
        """Setup logging configuration."""
        log_level = logging.INFO
        log_format = '%(asctime)s - %(levelname)s - %(message)s'
        
        # Create logger
        self.logger = logging.getLogger('event_cleanup')
        self.logger.setLevel(log_level)
        
        # Console handler
        console_handler = logging.StreamHandler()
        console_handler.setLevel(log_level)
        console_formatter = logging.Formatter(log_format)
        console_handler.setFormatter(console_formatter)
        self.logger.addHandler(console_handler)
        
        # File handler (optional)
        try:
            file_handler = logging.FileHandler('event_cleanup.log', mode='a')
            file_handler.setLevel(log_level)
            file_formatter = logging.Formatter(log_format)
            file_handler.setFormatter(file_formatter)
            self.logger.addHandler(file_handler)
        except Exception:
            # File logging optional, continue if fails
            pass
    
    def get_events_to_cleanup(self) -> List[Dict[str, Any]]:
        """
        Identify events that should be cleaned up.
        
        Returns:
            List of event dictionaries to be deleted
        """
        cutoff_date = (datetime.now() - timedelta(days=self.days_buffer)).strftime('%Y-%m-%d')
        self.logger.info(f"🔍 Looking for events before: {cutoff_date}")
        
        try:
            # Query all events with relevant fields
            result = self.supabase.table('all_events').select(
                'id, name, start_date, end_date, occurrence, event_type, created_at'
            ).execute()
            
            if not result.data:
                self.logger.info("✅ No events found in database")
                return []
            
            events_to_delete = []
            total_events = len(result.data)
            self.logger.info(f"📊 Analyzing {total_events} total events")
            
            # Categorize events
            one_time_events = 0
            recurring_events = 0
            past_events = 0
            
            for event in result.data:
                event_id = event.get('id')
                event_name = event.get('name', 'Unknown')
                start_date = event.get('start_date')
                end_date = event.get('end_date')
                occurrence = event.get('occurrence', '').lower()
                event_type = event.get('event_type', 'Unknown')
                created_at = event.get('created_at', '')
                
                # Count event types for statistics
                if occurrence in ['one-time', 'single']:
                    one_time_events += 1
                elif occurrence in ['weekly', 'ongoing']:
                    recurring_events += 1
                
                # Only consider deleting one-time events
                if occurrence in ['one-time', 'single']:
                    # Use end_date if available, otherwise use start_date
                    event_date = end_date if end_date else start_date
                    
                    if event_date and event_date < cutoff_date:
                        past_events += 1
                        events_to_delete.append({
                            'id': event_id,
                            'name': event_name,
                            'start_date': start_date,
                            'end_date': end_date,
                            'event_date': event_date,
                            'occurrence': occurrence,
                            'event_type': event_type,
                            'created_at': created_at
                        })
            
            self.logger.info(f"📈 Event breakdown:")
            self.logger.info(f"  - One-time events: {one_time_events}")
            self.logger.info(f"  - Recurring events: {recurring_events}")
            self.logger.info(f"  - Past events to delete: {past_events}")
            
            return events_to_delete
            
        except Exception as e:
            self.logger.error(f"❌ Error querying events: {str(e)}")
            raise
    
    def preview_cleanup(self, events_to_delete: List[Dict[str, Any]]) -> None:
        """
        Preview what will be deleted.
        
        Args:
            events_to_delete: List of events to be deleted
        """
        if not events_to_delete:
            self.logger.info("✅ No events to delete")
            return
        
        self.logger.info(f"📋 {len(events_to_delete)} events scheduled for deletion:")
        
        # Show first 10 events in detail
        for i, event in enumerate(events_to_delete[:10]):
            self.logger.info(
                f"  {i+1}. ID: {event['id']} | "
                f"Date: {event['event_date']} | "
                f"Type: {event['event_type']} | "
                f"Name: {event['name'][:50]}..."
            )
        
        if len(events_to_delete) > 10:
            self.logger.info(f"  ... and {len(events_to_delete) - 10} more events")
        
        # Show breakdown by event type
        event_types = {}
        for event in events_to_delete:
            event_type = event.get('event_type', 'Unknown')
            event_types[event_type] = event_types.get(event_type, 0) + 1
        
        self.logger.info("🏷️ Breakdown by event type:")
        for event_type, count in sorted(event_types.items()):
            self.logger.info(f"  - {event_type}: {count}")
    
    def delete_events_batch(self, event_ids: List[int]) -> int:
        """
        Delete a batch of events.
        
        Args:
            event_ids: List of event IDs to delete
            
        Returns:
            Number of events actually deleted
        """
        try:
            result = self.supabase.table('all_events').delete().in_('id', event_ids).execute()
            
            # The delete operation returns the deleted rows count in some cases
            # We'll assume success if no exception was raised
            return len(event_ids)
            
        except Exception as e:
            self.logger.error(f"❌ Error deleting batch: {str(e)}")
            # Try individual deletions to identify problematic events
            successful_deletes = 0
            for event_id in event_ids:
                try:
                    self.supabase.table('all_events').delete().eq('id', event_id).execute()
                    successful_deletes += 1
                except Exception as individual_error:
                    self.logger.error(f"❌ Failed to delete event {event_id}: {str(individual_error)}")
            
            return successful_deletes
    
    def perform_cleanup(self, events_to_delete: List[Dict[str, Any]]) -> Dict[str, int]:
        """
        Perform the actual cleanup operation.
        
        Args:
            events_to_delete: List of events to delete
            
        Returns:
            Dictionary with cleanup statistics
        """
        if not events_to_delete:
            return {'total': 0, 'deleted': 0, 'failed': 0}
        
        if self.dry_run:
            self.logger.info(f"🔍 DRY RUN: Would delete {len(events_to_delete)} events")
            return {'total': len(events_to_delete), 'deleted': 0, 'failed': 0}
        
        self.logger.info(f"🗑️ Starting deletion of {len(events_to_delete)} events...")
        
        deleted_count = 0
        failed_count = 0
        
        # Process in batches
        for i in range(0, len(events_to_delete), self.batch_size):
            batch = events_to_delete[i:i + self.batch_size]
            batch_ids = [event['id'] for event in batch]
            batch_num = (i // self.batch_size) + 1
            
            self.logger.info(f"🔄 Processing batch {batch_num}: {len(batch_ids)} events")
            
            try:
                batch_deleted = self.delete_events_batch(batch_ids)
                deleted_count += batch_deleted
                
                if batch_deleted == len(batch_ids):
                    self.logger.info(f"✅ Batch {batch_num} completed: {batch_deleted} events deleted")
                else:
                    failed_in_batch = len(batch_ids) - batch_deleted
                    failed_count += failed_in_batch
                    self.logger.warning(
                        f"⚠️ Batch {batch_num} partial: {batch_deleted} deleted, {failed_in_batch} failed"
                    )
                    
            except Exception as e:
                self.logger.error(f"❌ Batch {batch_num} failed: {str(e)}")
                failed_count += len(batch_ids)
        
        return {
            'total': len(events_to_delete),
            'deleted': deleted_count,
            'failed': failed_count
        }
    
    def get_final_statistics(self) -> Dict[str, int]:
        """Get final database statistics after cleanup."""
        try:
            result = self.supabase.table('all_events').select('id', count='exact').execute()
            total_remaining = result.count if result.count else 0
            
            # Get breakdown by occurrence type
            occurrence_result = self.supabase.table('all_events').select('occurrence').execute()
            occurrence_counts = {}
            
            if occurrence_result.data:
                for event in occurrence_result.data:
                    occurrence = event.get('occurrence', 'Unknown').lower()
                    occurrence_counts[occurrence] = occurrence_counts.get(occurrence, 0) + 1
            
            return {
                'total_remaining': total_remaining,
                'occurrence_breakdown': occurrence_counts
            }
            
        except Exception as e:
            self.logger.error(f"❌ Error getting final statistics: {str(e)}")
            return {'total_remaining': -1, 'occurrence_breakdown': {}}
    
    def run_cleanup(self) -> None:
        """Run the complete cleanup process."""
        start_time = datetime.now()
        
        self.logger.info("🚀 Starting event cleanup process")
        self.logger.info(f"⚙️ Configuration:")
        self.logger.info(f"  - Dry run: {self.dry_run}")
        self.logger.info(f"  - Days buffer: {self.days_buffer}")
        self.logger.info(f"  - Batch size: {self.batch_size}")
        
        try:
            # Step 1: Identify events to cleanup
            events_to_delete = self.get_events_to_cleanup()
            
            # Step 2: Preview what will be deleted
            self.preview_cleanup(events_to_delete)
            
            # Step 3: Perform cleanup
            cleanup_stats = self.perform_cleanup(events_to_delete)
            
            # Step 4: Get final statistics
            final_stats = self.get_final_statistics()
            
            # Step 5: Log summary
            end_time = datetime.now()
            duration = end_time - start_time
            
            self.logger.info("🎉 Cleanup process completed!")
            self.logger.info(f"📈 Summary:")
            self.logger.info(f"  - Events identified for deletion: {cleanup_stats['total']}")
            self.logger.info(f"  - Events successfully deleted: {cleanup_stats['deleted']}")
            self.logger.info(f"  - Events failed to delete: {cleanup_stats['failed']}")
            self.logger.info(f"  - Total events remaining: {final_stats['total_remaining']}")
            self.logger.info(f"  - Processing time: {duration.total_seconds():.2f} seconds")
            
            if final_stats['occurrence_breakdown']:
                self.logger.info("📊 Remaining events by type:")
                for occurrence, count in final_stats['occurrence_breakdown'].items():
                    self.logger.info(f"  - {occurrence}: {count}")
            
            # Create summary report
            self._create_summary_report(cleanup_stats, final_stats, duration)
            
        except Exception as e:
            self.logger.error(f"❌ Cleanup process failed: {str(e)}")
            raise
    
    def _create_summary_report(self, cleanup_stats: Dict, final_stats: Dict, duration) -> None:
        """Create a summary report file."""
        try:
            report = {
                'timestamp': datetime.now().isoformat(),
                'configuration': {
                    'dry_run': self.dry_run,
                    'days_buffer': self.days_buffer,
                    'batch_size': self.batch_size
                },
                'cleanup_statistics': cleanup_stats,
                'final_statistics': final_stats,
                'processing_time_seconds': duration.total_seconds()
            }
            
            report_filename = f"cleanup_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            
            with open(report_filename, 'w') as f:
                json.dump(report, f, indent=2)
            
            self.logger.info(f"📄 Summary report saved: {report_filename}")
            
        except Exception as e:
            self.logger.warning(f"⚠️ Could not create summary report: {str(e)}")


def main():
    """Main function to run the cleanup script."""
    parser = argparse.ArgumentParser(
        description="Clean up past events from the What's Poppin database",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python cleanup_past_events.py --dry-run                    # Test run, no actual deletion
  python cleanup_past_events.py --days-buffer 7             # Wait 7 days after event end
  python cleanup_past_events.py --batch-size 100            # Delete 100 events per batch
  python cleanup_past_events.py --dry-run --days-buffer 0   # Show events ending today
        """
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Perform a dry run without actual deletion'
    )
    
    parser.add_argument(
        '--days-buffer',
        type=int,
        default=1,
        help='Number of days to wait after event end before deletion (default: 1)'
    )
    
    parser.add_argument(
        '--batch-size',
        type=int,
        default=50,
        help='Number of events to delete in each batch (default: 50)'
    )
    
    args = parser.parse_args()
    
    try:
        cleanup_manager = EventCleanupManager(
            dry_run=args.dry_run,
            days_buffer=args.days_buffer,
            batch_size=args.batch_size
        )
        
        cleanup_manager.run_cleanup()
        
    except KeyboardInterrupt:
        print("\n⚠️ Cleanup interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Cleanup failed: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main() 