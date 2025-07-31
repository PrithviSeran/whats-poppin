# Event Cleanup System

This system automatically removes past events from the `new_events` database to keep your What's Poppin app database clean and performant.

## 🎯 Features

- **Automatic Daily Cleanup**: GitHub Actions workflow runs every day at 3 AM UTC
- **Smart Event Detection**: Only removes one-time/single events that have passed
- **Safe Operations**: Keeps recurring/weekly events (they don't expire)
- **Configurable Buffer**: Wait X days after event end before deletion
- **Batch Processing**: Efficient deletion in configurable batches
- **Comprehensive Logging**: Detailed logs and statistics
- **Dry Run Mode**: Test without actual deletion
- **Manual Triggers**: Run cleanup manually when needed

## 🤖 GitHub Actions Workflow

### Automatic Execution
The workflow runs automatically every day at 3 AM UTC (1 hour after the training workflow to avoid conflicts).

### Manual Execution
You can trigger the cleanup manually from the GitHub Actions tab:

1. Go to your repository's **Actions** tab
2. Select **"Cleanup Past Events"** workflow
3. Click **"Run workflow"**
4. Configure options:
   - **Dry run mode**: Test without deleting anything
   - **Days buffer**: How many days to wait after event end (default: 1)

### Workflow Configuration
The workflow uses these environment variables (configured in repository secrets):
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `SERVICE_ROLE_KEY`: Supabase service role key (preferred for admin operations)

## 🐍 Standalone Python Script

### Installation
```bash
cd backend/spaces
pip install supabase python-dotenv
```

### Environment Setup
Create a `.env` file in the `backend/spaces` directory:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SERVICE_ROLE_KEY=your_service_role_key  # Optional but recommended
```

### Basic Usage

#### Test Run (Recommended First)
```bash
python cleanup_past_events.py --dry-run
```

#### Standard Cleanup
```bash
python cleanup_past_events.py
```

#### Advanced Usage
```bash
# Wait 7 days after event end before deletion
python cleanup_past_events.py --days-buffer 7

# Process 100 events per batch
python cleanup_past_events.py --batch-size 100

# Dry run with no buffer (show events ending today or earlier)
python cleanup_past_events.py --dry-run --days-buffer 0

# Combine options
python cleanup_past_events.py --days-buffer 3 --batch-size 25
```

### Command Line Options

| Option | Default | Description |
|--------|---------|-------------|
| `--dry-run` | False | Simulate cleanup without actual deletion |
| `--days-buffer` | 1 | Days to wait after event end before deletion |
| `--batch-size` | 50 | Number of events to delete per batch |

## 📊 What Gets Deleted

### ✅ Events That Will Be Deleted
- Events with `occurrence = "one-time"` or `occurrence = "single"`
- Events where `end_date` (or `start_date` if no end_date) is before cutoff date
- Only after the configured buffer period

### ❌ Events That Will NOT Be Deleted
- Events with `occurrence = "Weekly"` or `occurrence = "ongoing"`
- Recent events within the buffer period
- Future events
- Events without valid dates

## 📈 Monitoring and Reports

### GitHub Actions Logs
- View detailed logs in the GitHub Actions interface
- See statistics on events found, deleted, and remaining

### Standalone Script Reports
- Console output with real-time progress
- Log files: `event_cleanup.log`
- JSON reports: `cleanup_report_YYYYMMDD_HHMMSS.json`

### Example Output
```
🚀 Starting event cleanup process
⚙️ Configuration:
  - Dry run: False
  - Days buffer: 1
  - Batch size: 50

🔍 Looking for events before: 2024-01-15
📊 Analyzing 1250 total events

📈 Event breakdown:
  - One-time events: 800
  - Recurring events: 450
  - Past events to delete: 125

📋 125 events scheduled for deletion:
  1. ID: 1001 | Date: 2024-01-10 | Type: Food & Drink | Name: New Year Food Festival...
  2. ID: 1002 | Date: 2024-01-12 | Type: Arts & Culture | Name: Winter Art Exhibition...
  ...

🗑️ Starting deletion of 125 events...
✅ Batch 1 completed: 50 events deleted
✅ Batch 2 completed: 50 events deleted
✅ Batch 3 completed: 25 events deleted

🎉 Cleanup process completed!
📈 Summary:
  - Events identified for deletion: 125
  - Events successfully deleted: 125
  - Events failed to delete: 0
  - Total events remaining: 1125
  - Processing time: 2.34 seconds
```

## 🔧 Troubleshooting

### Common Issues

#### Permission Errors
```
❌ Error: 403 Forbidden
```
**Solution**: Ensure you're using the `SERVICE_ROLE_KEY` for admin operations.

#### Missing Environment Variables
```
❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY/SERVICE_ROLE_KEY
```
**Solution**: Check your `.env` file or GitHub repository secrets.

#### Network Issues
```
❌ Error querying events: Connection timeout
```
**Solution**: Check your internet connection and Supabase service status.

### Recovery
If you accidentally delete events:
1. Check Supabase dashboard for recent backups
2. Use point-in-time recovery if available
3. Contact your database administrator

## ⚙️ Customization

### Modify Cleanup Logic
Edit the `get_events_to_cleanup()` method in `cleanup_past_events.py` to change which events are considered for deletion.

### Change Schedule
Edit `.github/workflows/cleanup_past_events.yml` and modify the cron expression:
```yaml
schedule:
  - cron: '0 3 * * *'  # Daily at 3 AM UTC
```

### Notification Setup
Add notification steps to the GitHub workflow:
```yaml
- name: Notify completion
  if: always()
  run: |
    # Add your notification logic here
    # e.g., send to Slack, Discord, email, etc.
```

## 🚨 Safety Features

- **Dry run mode** for testing
- **Batch processing** to avoid overwhelming the database
- **Detailed logging** for audit trails
- **Error handling** with individual retry logic
- **Type filtering** to preserve recurring events
- **Buffer period** to avoid premature deletion
- **Manual triggers** for controlled execution

## 📝 Best Practices

1. **Always test first**: Use `--dry-run` before actual cleanup
2. **Monitor logs**: Check GitHub Actions logs regularly
3. **Set appropriate buffer**: Consider your event lifecycle (1-7 days recommended)
4. **Backup strategy**: Ensure database backups are in place
5. **Gradual rollout**: Start with longer buffer periods
6. **Monitor performance**: Watch database performance metrics

## 📞 Support

If you encounter issues:
1. Check the logs for specific error messages
2. Verify environment variables and permissions
3. Test with `--dry-run` first
4. Review the database schema for changes
5. Check Supabase service status

---

*This cleanup system is designed to maintain optimal database performance while preserving important recurring events for your What's Poppin users.* 