#!/usr/bin/env python3
"""
Hugging Face Spaces API for BeaconAI with Supabase storage
This creates a FastAPI endpoint that can be deployed on Hugging Face Spaces
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import os
import logging
from datetime import datetime
import asyncio
from beacon_torch_cloud import HuggingFaceBeaconAI
import traceback

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="BeaconAI Recommendation API",
    description="Fast, scalable recommendation system with daily training and instant inference",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment variables (set these in Hugging Face Spaces)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("❌ SUPABASE_URL and SUPABASE_KEY environment variables must be set")
    raise ValueError("Missing Supabase configuration")

# Global BeaconAI instances cache
beacon_cache: Dict[str, HuggingFaceBeaconAI] = {}

# Pydantic models for API
class TrainingDataModel(BaseModel):
    users: List[str]
    events: List[str]
    user_features: List[tuple]  # [(user_id, [features])]
    event_features: List[tuple]  # [(event_id, [features])]
    interactions: List[tuple]  # [(user_id, event_id, rating)]

class TrainingRequest(BaseModel):
    user_id: Optional[str] = None  # None for global model
    data: TrainingDataModel
    training_params: Optional[Dict[str, Any]] = {}
    force_retrain: bool = False

class RecommendationRequest(BaseModel):
    user_id: str
    model_user_id: Optional[str] = None  # Which model to use (None for global)
    top_n: int = 10
    filter_liked: bool = True
    interactions: Optional[List[tuple]] = None

class RecommendationResponse(BaseModel):
    user_id: str
    recommendations: List[tuple]  # [(event_id, score)]
    model_used: str
    inference_time_ms: float

class TrainingResponse(BaseModel):
    user_id: Optional[str]
    status: str  # "trained", "loaded", "scheduled"
    message: str
    training_time_ms: Optional[float] = None

class ModelStatusResponse(BaseModel):
    user_id: Optional[str]
    exists: bool
    last_training_date: Optional[str]
    data_fingerprint: Optional[str]
    needs_training: bool

def get_beacon_ai(user_id: Optional[str] = None) -> HuggingFaceBeaconAI:
    """Get or create BeaconAI instance for user"""
    cache_key = user_id or "global"
    
    if cache_key not in beacon_cache:
        beacon_cache[cache_key] = HuggingFaceBeaconAI(
            supabase_url=SUPABASE_URL,
            supabase_key=SUPABASE_KEY,
            embedding_dim=32,
            use_bias=True,
            device='cpu',  # Hugging Face Spaces typically use CPU
            user_id=user_id
        )
    
    return beacon_cache[cache_key]

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "BeaconAI Recommendation API",
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "cached_models": list(beacon_cache.keys())
    }

@app.post("/train", response_model=TrainingResponse)
async def train_model(request: TrainingRequest, background_tasks: BackgroundTasks):
    """Train or load model for a user"""
    try:
        start_time = datetime.now()
        
        beacon = get_beacon_ai(request.user_id)
        
        # Extract data from request
        data = request.data
        users = data.users
        events = data.events
        user_features = data.user_features
        event_features = data.event_features
        interactions = data.interactions
        
        logger.info(f"🏋️ Training request for user: {request.user_id or 'global'}")
        logger.info(f"📊 Data: {len(users)} users, {len(events)} events, {len(interactions)} interactions")
        
        # Check if we can train in foreground (fast) or background (slow)
        needs_training = beacon.needs_training(users, events, user_features, event_features, interactions)
        
        if needs_training or request.force_retrain:
            # Estimate training time based on data size
            estimated_time_ms = len(interactions) * 0.1  # Rough estimate
            
            if estimated_time_ms < 30000:  # Train in foreground if < 30 seconds
                logger.info("🚀 Training in foreground (fast)")
                result = beacon.load_or_train(
                    users, events, user_features, event_features, interactions,
                    force_retrain=request.force_retrain,
                    **request.training_params
                )
                
                end_time = datetime.now()
                training_time = (end_time - start_time).total_seconds() * 1000
                
                return TrainingResponse(
                    user_id=request.user_id,
                    status=result,
                    message="Model trained successfully",
                    training_time_ms=training_time
                )
            
            else:
                # Schedule background training for large datasets
                logger.info("⏰ Scheduling background training (large dataset)")
                
                future = beacon.schedule_background_training(
                    users, events, user_features, event_features, interactions,
                    force_retrain=request.force_retrain,
                    **request.training_params
                )
                
                return TrainingResponse(
                    user_id=request.user_id,
                    status="scheduled",
                    message="Training scheduled in background for large dataset"
                )
        
        else:
            # Load existing model
            logger.info("📦 Loading existing model")
            result = beacon.load_trained_model()
            
            end_time = datetime.now()
            loading_time = (end_time - start_time).total_seconds() * 1000
            
            return TrainingResponse(
                user_id=request.user_id,
                status=result,
                message="Existing model loaded",
                training_time_ms=loading_time
            )
    
    except Exception as e:
        logger.error(f"❌ Training failed: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")

@app.post("/recommend", response_model=RecommendationResponse)
async def get_recommendations(request: RecommendationRequest):
    """Get recommendations for a user"""
    try:
        start_time = datetime.now()
        
        beacon = get_beacon_ai(request.model_user_id)
        
        # Check if model is loaded
        if beacon.model is None:
            # Try to load the model
            try:
                beacon.load_trained_model()
            except FileNotFoundError:
                raise HTTPException(
                    status_code=404, 
                    detail=f"No trained model found for user: {request.model_user_id or 'global'}. Train a model first."
                )
        
        logger.info(f"🎯 Getting recommendations for user: {request.user_id}")
        
        # Get recommendations
        recommendations = beacon.recommend_for_user(
            user_id=request.user_id,
            top_n=request.top_n,
            filter_liked=request.filter_liked,
            interactions=request.interactions
        )
        
        end_time = datetime.now()
        inference_time = (end_time - start_time).total_seconds() * 1000
        
        logger.info(f"✅ Generated {len(recommendations)} recommendations in {inference_time:.2f}ms")
        
        return RecommendationResponse(
            user_id=request.user_id,
            recommendations=recommendations,
            model_used=request.model_user_id or "global",
            inference_time_ms=inference_time
        )
    
    except Exception as e:
        logger.error(f"❌ Recommendation failed: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Recommendation failed: {str(e)}")

@app.get("/model/status", response_model=ModelStatusResponse)
async def get_model_status(user_id: Optional[str] = None):
    """Check model status for a user"""
    try:
        beacon = get_beacon_ai(user_id)
        
        # Check if model exists in Supabase
        stored_model = beacon.storage.load_model(user_id)
        
        if stored_model:
            model_date = datetime.fromisoformat(stored_model["created_at"].replace('Z', '+00:00'))
            needs_training = model_date.date() < datetime.now().date()
            
            return ModelStatusResponse(
                user_id=user_id,
                exists=True,
                last_training_date=stored_model["created_at"],
                data_fingerprint=stored_model["data_fingerprint"],
                needs_training=needs_training
            )
        else:
            return ModelStatusResponse(
                user_id=user_id,
                exists=False,
                last_training_date=None,
                data_fingerprint=None,
                needs_training=True
            )
    
    except Exception as e:
        logger.error(f"❌ Status check failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Status check failed: {str(e)}")

@app.delete("/model")
async def delete_model(user_id: Optional[str] = None):
    """Delete model for a user"""
    try:
        beacon = get_beacon_ai(user_id)
        
        # Remove from cache
        cache_key = user_id or "global"
        if cache_key in beacon_cache:
            del beacon_cache[cache_key]
        
        # Clean up in Supabase (delete models older than 0 days)
        beacon.cleanup_old_models(days_to_keep=0)
        
        return {"message": f"Model deleted for user: {user_id or 'global'}"}
    
    except Exception as e:
        logger.error(f"❌ Model deletion failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Model deletion failed: {str(e)}")

@app.post("/cleanup")
async def cleanup_old_models(days_to_keep: int = 7):
    """Clean up old models across all users"""
    try:
        # Use any beacon instance for cleanup (they all share the same storage)
        beacon = get_beacon_ai()
        beacon.cleanup_old_models(days_to_keep=days_to_keep)
        
        return {"message": f"Cleaned up models older than {days_to_keep} days"}
    
    except Exception as e:
        logger.error(f"❌ Cleanup failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")

@app.get("/users")
async def list_user_models():
    """List all users with trained models"""
    try:
        beacon = get_beacon_ai()
        
        # Query Supabase for all models
        result = beacon.storage.supabase.table(beacon.storage.table_name).select(
            "user_id, model_type, created_at"
        ).order("created_at", desc=True).execute()
        
        users = {}
        for record in result.data:
            user_id = record["user_id"]
            if user_id not in users:
                users[user_id] = {
                    "user_id": user_id,
                    "model_type": record["model_type"],
                    "last_training": record["created_at"]
                }
        
        return {"users": list(users.values())}
    
    except Exception as e:
        logger.error(f"❌ User listing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"User listing failed: {str(e)}")

# Health check for Hugging Face Spaces
@app.get("/health")
async def health_check():
    """Detailed health check"""
    try:
        # Test Supabase connection
        beacon = get_beacon_ai()
        beacon.storage.supabase.table(beacon.storage.table_name).select("id").limit(1).execute()
        
        return {
            "status": "healthy",
            "supabase": "connected",
            "cached_models": len(beacon_cache),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)  # Hugging Face Spaces default port 