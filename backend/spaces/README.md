# Event Recommendation API - Hugging Face Spaces

A cloud-native event recommendation system powered by BeaconAI, deployed on Hugging Face Spaces with per-user model storage in Supabase.

## Features

- **Per-User Personalization**: Each user gets their own trained model stored in Supabase
- **Smart Caching**: Models are cached and only retrained when data changes or daily
- **Sub-100ms Inference**: Lightning-fast recommendations using pre-trained models
- **Automatic Training**: Daily model training with GitHub Actions
- **RESTful API**: FastAPI-powered endpoints for integration

## API Endpoints

### Core Functionality

- `POST /recommend` - Get personalized event recommendations
- `GET /recommend` - Get recommendations via GET request
- `POST /train` - Manually trigger model training for a user
- `GET /models/{user_email}` - Get model information for a user
- `DELETE /models/{user_email}` - Delete a user's model

### Admin & Debug

- `POST /admin/cleanup` - Clean up old models
- `POST /debug/filter` - Debug filtering logic
- `GET /health` - Health check

## Performance

- **First Recommendation**: 30-300x faster than training from scratch
- **Subsequent Recommendations**: 150-600x faster with cached models
- **Training Time**: Automatic daily training, sub-second inference
- **Storage**: Efficient per-user model storage in Supabase

## Setup

### Environment Variables

Set these in your Hugging Face Spaces secrets:

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Database Schema

Create this table in your Supabase database:

```sql
CREATE TABLE beacon_models (
    id SERIAL PRIMARY KEY,
    user_id TEXT,
    model_type TEXT DEFAULT 'global',
    model_data TEXT,
    mappings_data TEXT,
    features_data TEXT,
    metadata JSONB,
    data_fingerprint TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_beacon_models_user_date ON beacon_models(user_id, created_at DESC);
CREATE INDEX idx_beacon_models_type_date ON beacon_models(model_type, created_at DESC);
```

## Usage

### Getting Recommendations

```python
import requests

# Set up headers
headers = {
    'Authorization': f'Bearer {your_supabase_token}',
    'Content-Type': 'application/json'
}

# Request recommendations
response = requests.post(
    'https://your-space.hf.space/recommend',
    headers=headers,
    json={
        'email': 'user@example.com',
        'latitude': 40.7128,
        'longitude': -74.0060,
        'filter_distance': True,
        'rejected_events': [],
        'use_calendar_filter': False,
        'selected_dates': None,
        'user_start_time': '09:00',
        'user_end_time': '17:00'
    }
)

recommendations = response.json()
```

### Manual Training

```python
# Trigger training for a specific user
response = requests.post(
    'https://your-space.hf.space/train',
    headers=headers,
    json={
        'email': 'user@example.com',
        'force_retrain': False
    }
)

training_result = response.json()
```

### Check Model Status

```python
# Get model information
response = requests.get(
    f'https://your-space.hf.space/models/user@example.com',
    headers=headers
)

model_info = response.json()
```

## Architecture

### Cloud-Native BeaconAI

- **HuggingFaceBeaconAI**: Main recommendation engine optimized for cloud deployment
- **SupabaseModelStorage**: Handles model persistence and versioning
- **CloudMatrixFactorizationModel**: PyTorch model optimized for serialization

### Smart Training Logic

1. **Data Fingerprinting**: Checks if user data has changed since last training
2. **Daily Schedule**: Automatically trains models once per day
3. **Lazy Loading**: Only trains when needed, otherwise loads from cache
4. **Background Training**: Non-blocking training for better UX

### Per-User Models

- Each user gets a personalized model stored with their email as user_id
- Models are automatically versioned and old ones cleaned up
- Fallback to global model if user-specific model unavailable

## Monitoring

### Health Checks

```bash
curl https://your-space.hf.space/health
```

### Model Cleanup

```bash
curl -X POST https://your-space.hf.space/admin/cleanup
```

## Development

### Local Testing

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export SUPABASE_URL=your_url
export SUPABASE_ANON_KEY=your_key

# Run the API
python app.py
```

### Docker Build

```bash
docker build -t event-recommendation-api .
docker run -p 7860:7860 event-recommendation-api
```

## Deployment

### Hugging Face Spaces

1. Upload all files to your Hugging Face Space
2. Set environment variables in Space secrets
3. The Space will automatically build and deploy

### GitHub Actions

Daily training is automated via GitHub Actions:

```yaml
# .github/workflows/daily_training.yml
name: Daily Model Training
on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM UTC daily
```

## API Documentation

Interactive API documentation is available at:
- `https://your-space.hf.space/docs` - Swagger UI
- `https://your-space.hf.space/redoc` - ReDoc

## Performance Optimization

### Vectorized Operations

- Pre-computed feature tensors for 5-10x speed improvement
- Batch processing for efficient GPU utilization
- Memory-optimized tensor operations

### Caching Strategy

- Models cached in Supabase with automatic expiration
- Feature embeddings pre-computed and stored
- Smart data fingerprinting prevents unnecessary retraining

### Background Processing

- Non-blocking training with ThreadPoolExecutor
- Immediate UI responses while training happens in background
- Graceful fallback to existing models during training

## Troubleshooting

### Common Issues

1. **Model Not Found**: Check if user has interacted with any events
2. **Training Timeouts**: Reduce batch size or epochs in training parameters
3. **Memory Issues**: Ensure sufficient RAM for model storage
4. **Authentication**: Verify Supabase tokens and permissions

### Debug Endpoints

Use the debug endpoint to test filtering logic:

```python
response = requests.post(
    'https://your-space.hf.space/debug/filter',
    json={
        'email': 'user@example.com',
        'user_start_time': '10:00',
        'user_end_time': '16:00',
        'selected_dates': ['2024-01-15'],
        'use_calendar_filter': True
    }
)
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Test your changes locally
4. Submit a pull request

## License

MIT License - see LICENSE file for details 