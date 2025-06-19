# Automated Model Training Setup

This document explains how to set up automated training for all user models using GitHub Actions and the `/train` endpoint.

## 🚀 Quick Setup

### 1. Required GitHub Secrets

Add these secrets to your GitHub repository (`Settings > Secrets and variables > Actions`):

```bash
SUPABASE_URL                    # Your Supabase project URL
SUPABASE_ANON_KEY              # Your Supabase anon key  
SUPABASE_SERVICE_ROLE_KEY      # Your Supabase service role key (for admin access)
HUGGINGFACE_SPACE_URL          # Your deployed Space URL (e.g., https://your-space.hf.space)
SLACK_WEBHOOK                  # Optional: Slack webhook for notifications
```

### 2. GitHub Action Workflow

The workflow is already configured in `.github/workflows/daily_training.yml` and will:

- **Run daily at 2 AM UTC** (customize the cron schedule as needed)
- **Fetch all users** from your Supabase database
- **Call `/train` endpoint** for each user
- **Send notifications** on success/failure (if Slack is configured)
- **Handle rate limiting** and timeouts gracefully

### 3. Manual Triggering

You can manually trigger training in two ways:

#### Via GitHub UI:
1. Go to your repository's "Actions" tab
2. Select "Daily Model Training" workflow
3. Click "Run workflow"
4. Choose whether to force retrain all models

#### Via Local Script:
```bash
# Install dependencies
pip install requests supabase

# Set environment variables
export SUPABASE_URL="your_supabase_url"
export SUPABASE_ANON_KEY="your_anon_key"
export SUPABASE_SERVICE_ROLE_KEY="your_service_key"
export HUGGINGFACE_SPACE_URL="https://your-space.hf.space"

# Run training script
python train_all_users.py --force-retrain

# Or with custom settings
python train_all_users.py --batch-size 3 --delay 5.0
```

## ⚙️ Configuration Options

### Cron Schedule
Edit `.github/workflows/daily_training.yml` to change when training runs:

```yaml
schedule:
  # Every day at 2 AM UTC
  - cron: '0 2 * * *'
  
  # Every day at 6 AM UTC  
  - cron: '0 6 * * *'
  
  # Every Monday at 3 AM UTC
  - cron: '0 3 * * 1'
  
  # Twice daily (6 AM and 6 PM UTC)
  - cron: '0 6,18 * * *'
```

### Training Parameters

The script supports several parameters:

```bash
python train_all_users.py \
  --force-retrain         # Force retrain all models (ignore existing)
  --batch-size 5          # Number of users per batch (default: 5)
  --delay 2.0            # Delay between batches in seconds (default: 2.0)
  --space-url URL        # Override Space URL
```

### Rate Limiting

The training script includes built-in rate limiting:
- **Batch processing**: Trains users in batches (default: 5)
- **Delays**: Waits between batches to avoid overwhelming your Space
- **Timeouts**: 10-minute timeout per user training
- **Error handling**: Continues if individual users fail

## 📊 Monitoring & Logs

### GitHub Actions Script
The workflow uses a dedicated `github_train_all.py` script that:
- ✅ Properly handles environment variables in GitHub Actions
- 🔍 Provides detailed debugging output
- 📊 Tracks comprehensive training statistics  
- 🔄 Includes robust error handling and recovery

### GitHub Actions Logs
- View logs in your repository's "Actions" tab
- Each run shows detailed progress and statistics
- Failed runs trigger alerts (if Slack is configured)

### Training Statistics
The workflow provides detailed statistics:

```
📊 Training Summary:
   📋 Total users: 150
   ✅ Trained: 142
   ❌ Failed: 5
   ⏭️ Skipped: 3
   🕐 Completed at: 2024-01-15T02:45:30.123456
   📈 Success rate: 94.7%
```

### Slack Notifications (Optional)
If configured, you'll receive Slack notifications for:
- ✅ **Success**: Daily training completed
- ❌ **Failure**: Training failed or high failure rate
- 📊 **Summary**: Training statistics

## 🔧 Troubleshooting

### Common Issues

#### 1. Authentication Errors
```
❌ No auth token available for user@example.com, skipping...
```
**Solution**: Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in GitHub secrets

#### 2. High Failure Rate
```
❌ High failure rate: 67.3%
```
**Possible causes**:
- Hugging Face Space is down or overloaded
- Insufficient resources (CPU/memory)
- Database connection issues
- Invalid user data

#### 3. Timeout Errors
```
⏰ user@example.com: Training timeout (>10 minutes)
```
**Solutions**:
- Increase timeout in the script
- Optimize model training parameters
- Reduce batch size to avoid resource contention

#### 4. Space URL Issues
```
❌ Missing required environment variables: HUGGINGFACE_SPACE_URL
```
**Solution**: Set the correct Space URL in GitHub secrets:
```
https://your-username-your-space-name.hf.space
```

### Manual Testing

Test the training endpoint manually:

```bash
# Admin endpoint (for service role key)
curl -X POST "https://your-space.hf.space/admin/train" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_service_role_key" \
  -d '{"email": "test@example.com", "force_retrain": false}'

# User endpoint (for user tokens)
curl -X POST "https://your-space.hf.space/train" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer user_auth_token" \
  -d '{"email": "test@example.com", "force_retrain": false}'
```

### Debug Mode

For local debugging, add verbose logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## 🎯 Best Practices

### 1. Training Schedule
- **Daily training**: Ensures models stay fresh with latest user interactions
- **Off-peak hours**: Run during low-traffic periods (2-6 AM UTC)
- **Avoid user-active times**: Don't train during peak usage

### 2. Resource Management
- **Batch processing**: Train users in small batches (3-10 users)
- **Rate limiting**: Add delays between requests
- **Monitoring**: Watch Space resource usage during training

### 3. Error Handling
- **Graceful degradation**: Continue if some users fail
- **Retry logic**: Implement retries for transient failures
- **Notifications**: Alert on high failure rates

### 4. Model Freshness
- **Force retrain weekly**: Use `force_retrain: true` once a week
- **Monitor data changes**: Retrain when significant data changes occur
- **Cleanup old models**: Regular cleanup of outdated models

## 📈 Performance Optimization

### Expected Performance

| Scenario | Training Time | Recommendation Time |
|----------|---------------|-------------------|
| New User | 30-60 seconds | 30-60 seconds (first time) |
| Existing User (updated model) | 30-60 seconds | 0.5-2 seconds |
| Existing User (cached model) | Skipped | 0.5-2 seconds |

### Scaling Considerations

- **100+ users**: Consider parallel processing
- **1000+ users**: Implement distributed training
- **High frequency**: Cache training data and features

## 🔐 Security Notes

- **Service Role Key**: Keep your service role key secure
- **GitHub Secrets**: Never commit credentials to code
- **API Rate Limits**: Respect Hugging Face Space limits
- **User Privacy**: Ensure training data is properly anonymized

---

## Need Help?

- Check the GitHub Actions logs for detailed error messages
- Test individual components using the local scripts
- Monitor your Hugging Face Space logs during training
- Ensure all required secrets are properly configured 