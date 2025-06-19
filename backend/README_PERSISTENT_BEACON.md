# 🚀 Persistent BeaconAI: Production-Ready Recommendation System

A high-performance, production-ready recommendation system that trains once daily and serves recommendations instantly using cached model weights.

## 🎯 Problem Solved

**Before**: Every user request triggered model training → slow response times (5-30 seconds)
**After**: Train once daily, serve instantly from cache → ultra-fast recommendations (<100ms)

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Daily Cron    │    │  Model Cache    │    │  Fast Serving   │
│   (2 AM daily)  │───▶│   Directory     │───▶│   (Real-time)   │
│                 │    │                 │    │                 │
│ • Train model   │    │ • Model weights │    │ • Load from     │
│ • Save weights  │    │ • Mappings      │    │   cache         │
│ • Clean old     │    │ • Features      │    │ • Instant recs  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📊 Performance Comparison

| Metric | Original BeaconAI | Persistent BeaconAI |
|--------|------------------|---------------------|
| **First Request** | 15-30 seconds | 0.1-0.5 seconds |
| **Subsequent Requests** | 15-30 seconds | 0.05-0.1 seconds |
| **Memory Usage** | High (training data) | Low (model only) |
| **CPU Usage** | High (training) | Minimal (inference) |
| **Scalability** | Poor | Excellent |

## 🎯 Key Features

### ⚡ **Ultra-Fast Inference**
- **Sub-100ms recommendations** using pre-trained weights
- **Batch processing** for memory efficiency
- **GPU acceleration** support

### 🔄 **Smart Caching System**
- **Daily training schedule** - trains only when needed
- **Data change detection** - retrains if data changes
- **Automatic cleanup** - removes old models to save disk space

### 🛡️ **Production Ready**
- **Error handling** and recovery
- **Comprehensive logging**
- **Multiple deployment options** (cron, systemd)
- **Memory optimization**

### 📈 **Scalability**
- **Per-user models** or global models
- **Horizontal scaling** support
- **Resource efficient**

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pip install torch numpy scipy
```

### 2. Basic Usage

```python
from beacon_torch_persistent import PersistentBeaconAI

# Initialize
beacon = PersistentBeaconAI(
    embedding_dim=32,
    model_cache_dir="./models",
    user_id=None  # Global model
)

# Load data (replace with your data loading)
users, events, user_features, event_features, interactions = load_your_data()

# Smart training - only trains if needed
result = beacon.load_or_train(
    users, events, user_features, event_features, interactions
)

# Get instant recommendations
recommendations = beacon.recommend_for_user(
    user_id="user_123",
    top_n=10
)
```

### 3. Production Setup

```bash
# Run setup script
python setup_daily_training.py

# Test manually
python daily_training_job.py

# Set up automation (cron job)
crontab -e
# Add: 0 2 * * * /usr/bin/python3 /path/to/daily_training_job.py
```

## 📁 File Structure

```
backend/
├── beacon_torch_persistent.py    # Core persistent BeaconAI implementation
├── beacon_usage_example.py       # Usage examples and benchmarks
├── setup_daily_training.py       # Automated setup for daily training
├── daily_training_job.py         # Generated cron job script
└── beacon_models/                # Model cache directory
    ├── beacon_model_global_2024-01-15.pt
    ├── beacon_metadata_global.json
    ├── mappings_global.pkl
    └── features_global.pt
```

## 🔧 Configuration Options

### Model Configuration
```python
beacon = PersistentBeaconAI(
    embedding_dim=32,           # Model complexity
    use_bias=True,              # Enable bias terms
    device='cuda',              # GPU acceleration
    model_cache_dir="./models", # Cache location
    user_id=None                # Global or user-specific
)
```

### Training Parameters
```python
beacon.load_or_train(
    users, events, user_features, event_features, interactions,
    epochs=15,                  # Training epochs
    learning_rate=0.01,         # Learning rate
    batch_size=512,             # Batch size
    use_early_stopping=True,    # Early stopping
    patience=5                  # Early stopping patience
)
```

## 📋 Implementation Details

### Daily Training Logic
```python
def needs_training(self, users, events, user_features, event_features, interactions):
    """Smart training decision"""
    # 1. Check if today's model exists
    # 2. Check if data changed (hash comparison)
    # 3. Check if last training was today
    # Returns True only if training is actually needed
```

### Model Persistence
```python
# Save everything needed for inference
model.save_model(path)                    # PyTorch model weights
self._save_mappings_and_features()        # ID mappings & feature tensors
self._save_metadata()                     # Training metadata & data hash
```

### Fast Loading
```python
# Load pre-computed components for instant inference
self.model = load_model(path)             # Load PyTorch model
self._load_mappings_and_features()        # Load ID mappings
self.user_feature_tensor = load_features() # Pre-computed feature embeddings
```

## 🎯 Production Deployment

### Option 1: Cron Job (Simple)
```bash
# Add to crontab
0 2 * * * /usr/bin/python3 /path/to/daily_training_job.py >> /var/log/beacon.log 2>&1
```

### Option 2: Systemd Service (Production)
```bash
# Install service
sudo cp beacon-training.service /etc/systemd/system/
sudo systemctl enable beacon-training.timer
sudo systemctl start beacon-training.timer
```

### Option 3: Container/Cloud Scheduler
```yaml
# Kubernetes CronJob example
apiVersion: batch/v1beta1
kind: CronJob
metadata:
  name: beacon-training
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: beacon-training
            image: your-app:latest
            command: ["python3", "daily_training_job.py"]
```

## 🔍 Monitoring & Debugging

### Log Monitoring
```bash
# Monitor training logs
tail -f /var/log/beacon_training.log

# Check for errors
grep "ERROR" /var/log/beacon_training.log
```

### Model Status Check
```python
# Check if model is current
beacon = PersistentBeaconAI(model_cache_dir="./models")
needs_training = beacon.needs_training(users, events, user_features, event_features, interactions)
print(f"Training needed: {needs_training}")
```

### Performance Monitoring
```python
import time

# Benchmark recommendation speed
start = time.time()
recommendations = beacon.recommend_for_user("user_123", top_n=10)
duration = time.time() - start
print(f"Recommendation took {duration:.3f} seconds")
```

## 🛠️ Advanced Features

### Per-User Models
```python
# Train separate models for each user
user_beacon = PersistentBeaconAI(
    model_cache_dir="./models",
    user_id="user_123"  # User-specific model
)
```

### Data Change Detection
```python
# Automatically detects if training data changed
# Uses MD5 hash of sorted data to detect changes
# Only retrains when data actually changes
current_hash = beacon._compute_data_fingerprint(users, events, user_features, event_features, interactions)
```

### Memory Optimization
```python
# Large batch inference for memory efficiency
recommendations = beacon.recommend_for_user(
    user_id="user_123",
    batch_size=2048  # Process 2048 items at once
)
```

### Model Cleanup
```python
# Automatically clean up old models
beacon.cleanup_old_models(days_to_keep=7)  # Keep only last 7 days
```

## 🔥 Performance Tips

### 1. **Use GPU for Training**
```python
beacon = PersistentBeaconAI(device='cuda')  # Much faster training
```

### 2. **Optimize Batch Sizes**
```python
# Training: Larger batches = faster training
beacon.load_or_train(..., batch_size=1024)

# Inference: Larger batches = more memory efficient
beacon.recommend_for_user(..., batch_size=4096)
```

### 3. **Pre-warm Models**
```python
# Load model at app startup to avoid cold starts
global_beacon = PersistentBeaconAI(model_cache_dir="./models")
global_beacon.load_trained_model()
```

### 4. **Monitor Memory Usage**
```python
import torch
print(f"GPU Memory: {torch.cuda.memory_allocated() / 1e9:.2f} GB")
```

## 📈 Scaling Strategies

### Horizontal Scaling
- **Multiple model servers** serving from shared cache
- **Load balancers** distributing recommendation requests
- **Shared storage** (NFS, S3) for model cache

### Vertical Scaling
- **Larger embedding dimensions** for better accuracy
- **More training epochs** for better convergence
- **GPU clusters** for faster training

### Hybrid Approach
- **Global model** for new users
- **Per-user models** for power users
- **Fallback mechanisms** for model failures

## 🎯 Best Practices

### Data Management
- **Incremental updates** instead of full reloads
- **Data validation** before training
- **Backup strategies** for model cache

### Monitoring
- **Training success alerts**
- **Model performance metrics**
- **Resource usage monitoring**

### Security
- **Access controls** on model cache
- **Data encryption** for sensitive features
- **Audit logging** for model updates

## 🚨 Troubleshooting

### Common Issues

**1. "No model found for today"**
```python
# Force retrain
beacon.load_or_train(..., force_retrain=True)
```

**2. "User not found in trained model"**
```python
# Check if user was in training data
if user_id not in beacon.user_id_map:
    print(f"User {user_id} not in training data")
```

**3. "Model loading failed"**
```python
# Check file permissions and paths
import os
print(f"Model file exists: {os.path.exists(model_path)}")
```

**4. "Out of memory during training"**
```python
# Reduce batch size
beacon.load_or_train(..., batch_size=128)
```

### Performance Issues

**Slow recommendations?**
- Check if using CPU instead of GPU
- Verify model is loaded (not training each time)
- Increase batch_size for inference

**High memory usage?**
- Reduce embedding_dim
- Use smaller batch sizes
- Enable gradient checkpointing

## 📞 Support

For issues and questions:
1. Check the logs first
2. Verify all paths are correct
3. Test with smaller datasets
4. Monitor resource usage

---

🎉 **You now have a production-ready recommendation system that trains once daily and serves recommendations in milliseconds!** 