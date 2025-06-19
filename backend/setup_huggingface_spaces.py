#!/usr/bin/env python3
"""
Setup script for deploying BeaconAI to Hugging Face Spaces
This creates all necessary files for Hugging Face Spaces deployment
"""

import os
from pathlib import Path

def create_requirements_txt():
    """Create requirements.txt for Hugging Face Spaces"""
    requirements = """
# Core ML dependencies
torch>=1.13.0
numpy>=1.21.0
scipy>=1.9.0

# API framework
fastapi>=0.68.0
uvicorn[standard]>=0.15.0
pydantic>=1.8.0

# Database and storage
supabase>=1.0.0
python-dotenv>=0.19.0

# Utilities
python-multipart>=0.0.5
""".strip()
    
    with open("requirements.txt", "w") as f:
        f.write(requirements)
    
    print("✅ Created requirements.txt")

def create_app_py():
    """Create app.py (entry point for Hugging Face Spaces)"""
    app_content = '''
import os
import sys

# Add backend directory to Python path
backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Import and run the FastAPI app
from huggingface_spaces_api import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
'''.strip()
    
    with open("app.py", "w") as f:
        f.write(app_content)
    
    print("✅ Created app.py")

def create_dockerfile():
    """Create Dockerfile for Hugging Face Spaces"""
    dockerfile_content = '''
FROM python:3.9

WORKDIR /code

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade -r requirements.txt

COPY . .

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
'''.strip()
    
    with open("Dockerfile", "w") as f:
        f.write(dockerfile_content)
    
    print("✅ Created Dockerfile")

def create_readme_spaces():
    """Create README for Hugging Face Spaces"""
    readme_content = '''---
title: BeaconAI Recommendation API
emoji: 🎯
colorFrom: red
colorTo: purple
sdk: docker
pinned: false
license: mit
---

# 🎯 BeaconAI Recommendation API

A high-performance recommendation system API that trains once daily and serves recommendations instantly using cached model weights stored in Supabase.

## 🚀 Features

- **Ultra-Fast Inference**: Sub-100ms recommendations using pre-trained weights
- **Per-User Models**: Separate models for each user stored in Supabase
- **Smart Caching**: Only trains when data changes or daily schedule
- **RESTful API**: Easy integration with any frontend or mobile app
- **Background Training**: Handles large datasets with background processing

## 🔧 Setup

### Environment Variables

Set these in your Hugging Face Spaces settings:

```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
```

### Supabase Table Setup

Create this table in your Supabase dashboard:

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

## 📝 API Usage

### Train a Model

```python
import requests

# Train a global model
response = requests.post("https://your-space-url/train", json={
    "user_id": None,  # None for global model
    "data": {
        "users": ["user1", "user2", "user3"],
        "events": ["event1", "event2", "event3"],
        "user_features": [
            ("user1", ["young", "tech"]),
            ("user2", ["adult", "sports"]),
            ("user3", ["senior", "arts"])
        ],
        "event_features": [
            ("event1", ["technology", "conference"]),
            ("event2", ["sports", "outdoor"]),
            ("event3", ["arts", "indoor"])
        ],
        "interactions": [
            ("user1", "event1", 1),
            ("user2", "event2", 1),
            ("user3", "event3", 1)
        ]
    },
    "force_retrain": False
})

print(response.json())
```

### Get Recommendations

```python
# Get recommendations for a user
response = requests.post("https://your-space-url/recommend", json={
    "user_id": "user1",
    "model_user_id": None,  # Use global model
    "top_n": 10,
    "filter_liked": True
})

recommendations = response.json()
print(f"Recommendations: {recommendations['recommendations']}")
print(f"Inference time: {recommendations['inference_time_ms']}ms")
```

### Check Model Status

```python
# Check if model exists and when it was last trained
response = requests.get("https://your-space-url/model/status?user_id=user123")
status = response.json()

if status["exists"]:
    print(f"Model last trained: {status['last_training_date']}")
    print(f"Needs retraining: {status['needs_training']}")
else:
    print("No model found - need to train first")
```

## 🎯 Per-User Models

Train separate models for each user for better personalization:

```python
# Train user-specific model
requests.post("https://your-space-url/train", json={
    "user_id": "user123",  # Specific user
    "data": user_specific_data,
    "force_retrain": False
})

# Use user-specific model for recommendations
requests.post("https://your-space-url/recommend", json={
    "user_id": "user123",
    "model_user_id": "user123",  # Use this user's model
    "top_n": 10
})
```

## 📊 Performance

- **Training**: 10-30 seconds for typical datasets
- **Inference**: 50-200ms per user
- **Storage**: Efficient model compression in Supabase
- **Scalability**: Unlimited users with per-user models

## 🛠️ Advanced Features

### Background Training for Large Datasets

Large datasets (>300k interactions) automatically train in the background:

```python
response = requests.post("https://your-space-url/train", json={
    "user_id": None,
    "data": large_dataset,  # Will auto-detect size
    "training_params": {
        "epochs": 20,
        "batch_size": 1024,
        "learning_rate": 0.01
    }
})

# Returns immediately with status="scheduled"
```

### Model Management

```python
# List all users with models
users = requests.get("https://your-space-url/users").json()

# Delete a specific user's model
requests.delete("https://your-space-url/model?user_id=user123")

# Clean up old models (older than 7 days)
requests.post("https://your-space-url/cleanup", json={"days_to_keep": 7})
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Hugging Face   │    │    Supabase     │    │   Your App      │
│     Spaces      │    │    Database     │    │   Frontend      │
│                 │    │                 │    │                 │
│ • FastAPI       │◄───┤ • Model Storage │◄───┤ • Train Models  │
│ • BeaconAI      │    │ • User Data     │    │ • Get Recs      │
│ • Model Cache   │    │ • Metadata      │    │ • Monitor       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔐 Security

- Environment variables for Supabase credentials
- Row Level Security (RLS) in Supabase for user data isolation
- Rate limiting and input validation
- Secure model storage with base64 encoding

## 📈 Monitoring

Check health and performance:

```python
# Health check
health = requests.get("https://your-space-url/health").json()
print(f"Status: {health['status']}")
print(f"Cached models: {health['cached_models']}")
```

## 🚀 Getting Started

1. Fork this space or create a new one
2. Set up Supabase database and get credentials
3. Add environment variables to Hugging Face Spaces settings
4. Deploy and start training models!

---

**Built with ❤️ using PyTorch, FastAPI, and Supabase**
'''.strip()
    
    with open("README.md", "w") as f:
        f.write(readme_content)
    
    print("✅ Created README.md for Hugging Face Spaces")

def create_gitignore():
    """Create .gitignore file"""
    gitignore_content = '''
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
pip-wheel-metadata/
share/python-wheels/
*.egg-info/
.installed.cfg
*.egg
MANIFEST

# Environment variables
.env
.venv
env/
venv/
ENV/
env.bak/
venv.bak/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Logs
*.log
logs/

# Model cache
beacon_models/
*.pt
*.pkl

# Temporary files
*.tmp
*.temp
'''.strip()
    
    with open(".gitignore", "w") as f:
        f.write(gitignore_content)
    
    print("✅ Created .gitignore")

def create_example_client():
    """Create example client code"""
    client_code = '''#!/usr/bin/env python3
"""
Example client for BeaconAI Hugging Face Spaces API
"""

import requests
import time
import json

class BeaconAIClient:
    """Client for BeaconAI API hosted on Hugging Face Spaces"""
    
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
    
    def train_model(self, user_id=None, users=None, events=None, user_features=None, 
                   event_features=None, interactions=None, force_retrain=False, **training_params):
        """Train a model for a user"""
        
        data = {
            "user_id": user_id,
            "data": {
                "users": users,
                "events": events,
                "user_features": user_features,
                "event_features": event_features,
                "interactions": interactions
            },
            "training_params": training_params,
            "force_retrain": force_retrain
        }
        
        response = self.session.post(f"{self.base_url}/train", json=data)
        response.raise_for_status()
        return response.json()
    
    def get_recommendations(self, user_id, model_user_id=None, top_n=10, 
                          filter_liked=True, interactions=None):
        """Get recommendations for a user"""
        
        data = {
            "user_id": user_id,
            "model_user_id": model_user_id,
            "top_n": top_n,
            "filter_liked": filter_liked,
            "interactions": interactions
        }
        
        response = self.session.post(f"{self.base_url}/recommend", json=data)
        response.raise_for_status()
        return response.json()
    
    def get_model_status(self, user_id=None):
        """Check model status"""
        params = {"user_id": user_id} if user_id else {}
        response = self.session.get(f"{self.base_url}/model/status", params=params)
        response.raise_for_status()
        return response.json()
    
    def health_check(self):
        """Check API health"""
        response = self.session.get(f"{self.base_url}/health")
        response.raise_for_status()
        return response.json()

def example_usage():
    """Example usage of BeaconAI client"""
    
    # Initialize client (replace with your Hugging Face Spaces URL)
    client = BeaconAIClient("https://your-username-beacon-ai.hf.space")
    
    # Example data
    users = ["user1", "user2", "user3", "user4", "user5"]
    events = ["event1", "event2", "event3", "event4", "event5"]
    
    user_features = [
        ("user1", ["young", "tech", "urban"]),
        ("user2", ["adult", "sports", "suburban"]),
        ("user3", ["senior", "arts", "urban"]),
        ("user4", ["young", "music", "rural"]),
        ("user5", ["adult", "food", "urban"])
    ]
    
    event_features = [
        ("event1", ["technology", "conference", "indoor"]),
        ("event2", ["sports", "outdoor", "active"]),
        ("event3", ["arts", "museum", "cultural"]),
        ("event4", ["music", "concert", "entertainment"]),
        ("event5", ["food", "restaurant", "social"])
    ]
    
    interactions = [
        ("user1", "event1", 1),  # user1 likes event1
        ("user1", "event4", 1),  # user1 likes event4
        ("user2", "event2", 1),  # user2 likes event2
        ("user3", "event3", 1),  # user3 likes event3
        ("user4", "event4", 1),  # user4 likes event4
        ("user5", "event5", 1),  # user5 likes event5
        ("user1", "event2", 0),  # user1 dislikes event2
        ("user2", "event1", 0),  # user2 dislikes event1
    ]
    
    print("🎯 BeaconAI Client Example")
    print("=" * 50)
    
    # 1. Health check
    print("\\n1️⃣ Health Check")
    health = client.health_check()
    print(f"Status: {health['status']}")
    print(f"Cached models: {health.get('cached_models', 0)}")
    
    # 2. Train global model
    print("\\n2️⃣ Training Global Model")
    training_result = client.train_model(
        user_id=None,  # Global model
        users=users,
        events=events,
        user_features=user_features,
        event_features=event_features,
        interactions=interactions,
        epochs=10,
        learning_rate=0.01
    )
    
    print(f"Training status: {training_result['status']}")
    print(f"Training time: {training_result.get('training_time_ms', 0):.0f}ms")
    
    # 3. Check model status
    print("\\n3️⃣ Model Status")
    status = client.get_model_status()
    print(f"Model exists: {status['exists']}")
    if status['exists']:
        print(f"Last training: {status['last_training_date']}")
        print(f"Needs retraining: {status['needs_training']}")
    
    # 4. Get recommendations
    print("\\n4️⃣ Getting Recommendations")
    
    for user_id in ["user1", "user2", "user3"]:
        print(f"\\n🎯 Recommendations for {user_id}:")
        
        start_time = time.time()
        recommendations = client.get_recommendations(
            user_id=user_id,
            top_n=5,
            filter_liked=True
        )
        end_time = time.time()
        
        print(f"   Inference time: {recommendations['inference_time_ms']:.1f}ms")
        print(f"   Top recommendations:")
        
        for i, (event_id, score) in enumerate(recommendations['recommendations'][:3], 1):
            print(f"   {i}. {event_id} (score: {score:.3f})")
    
    # 5. Train user-specific model
    print("\\n5️⃣ Training User-Specific Model")
    
    user_specific_result = client.train_model(
        user_id="user1",  # User-specific model
        users=users,
        events=events,
        user_features=user_features,
        event_features=event_features,
        interactions=interactions,
        epochs=5  # Fewer epochs for demo
    )
    
    print(f"User model status: {user_specific_result['status']}")
    
    # 6. Compare global vs user-specific recommendations
    print("\\n6️⃣ Global vs User-Specific Models")
    
    # Global model recommendations
    global_recs = client.get_recommendations(
        user_id="user1",
        model_user_id=None,  # Global model
        top_n=3
    )
    
    # User-specific model recommendations
    user_recs = client.get_recommendations(
        user_id="user1",
        model_user_id="user1",  # User-specific model
        top_n=3
    )
    
    print("\\nGlobal model recommendations:")
    for i, (event_id, score) in enumerate(global_recs['recommendations'], 1):
        print(f"  {i}. {event_id} (score: {score:.3f})")
    
    print("\\nUser-specific model recommendations:")
    for i, (event_id, score) in enumerate(user_recs['recommendations'], 1):
        print(f"  {i}. {event_id} (score: {score:.3f})")
    
    print("\\n✅ Example completed successfully!")

if __name__ == "__main__":
    example_usage()
'''.strip()
    
    with open("example_client.py", "w") as f:
        f.write(client_code)
    
    print("✅ Created example_client.py")

def main():
    """Main setup function"""
    print("🚀 Setting up Hugging Face Spaces deployment for BeaconAI")
    print("=" * 60)
    
    # Create all necessary files
    create_requirements_txt()
    create_app_py()
    create_dockerfile()
    create_readme_spaces()
    create_gitignore()
    create_example_client()
    
    print("\\n✅ Setup complete!")
    print("\\n📋 Next steps:")
    print("1. Create a new Hugging Face Space (choose Docker SDK)")
    print("2. Upload these files to your space")
    print("3. Set up Supabase database and get credentials")
    print("4. Add environment variables in Hugging Face Spaces settings:")
    print("   - SUPABASE_URL=your_supabase_project_url")
    print("   - SUPABASE_KEY=your_supabase_anon_key")
    print("5. Create the beacon_models table in Supabase (see README.md)")
    print("6. Deploy your space and test with example_client.py")
    
    print("\\n🔗 Useful links:")
    print("- Hugging Face Spaces: https://huggingface.co/spaces")
    print("- Supabase: https://supabase.com/")
    print("- Documentation: See README.md")

if __name__ == "__main__":
    main() 