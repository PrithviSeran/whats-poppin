#!/usr/bin/env python3
"""
Example usage of PersistentBeaconAI for daily training and fast inference
This shows how to implement a production-ready recommendation system.
"""

from beacon_torch_persistent import PersistentBeaconAI
import time
import json

def daily_training_job(user_id=None):
    """
    Daily training job - run this once per day via cron job or scheduler
    
    Args:
        user_id: Optional user ID for user-specific models, None for global model
    """
    print("🏋️ Starting daily training job...")
    
    # Initialize persistent BeaconAI
    beacon = PersistentBeaconAI(
        embedding_dim=32,
        use_bias=True,
        device='cuda',  # Use GPU if available
        model_cache_dir="./beacon_models",
        user_id=user_id  # None for global model, or specific user ID
    )
    
    # Load your data (replace with your actual data loading logic)
    users, events, user_features, event_features, interactions = load_your_data()
    
    print(f"📊 Data loaded: {len(users)} users, {len(events)} events, {len(interactions)} interactions")
    
    # Check if training is needed and train/load accordingly
    start_time = time.time()
    
    result = beacon.load_or_train(
        users, events, user_features, event_features, interactions,
        force_retrain=False,  # Set to True to force retraining
        # Training parameters (only used if training is needed)
        epochs=15,
        learning_rate=0.01,
        batch_size=512,  # Larger batch for daily training
        use_early_stopping=True,
        patience=5
    )
    
    end_time = time.time()
    
    if result == "trained":
        print(f"✅ Model trained successfully in {end_time - start_time:.2f} seconds")
    else:
        print(f"📦 Existing model loaded in {end_time - start_time:.2f} seconds")
    
    # Clean up old models to save disk space
    beacon.cleanup_old_models(days_to_keep=7)
    
    return beacon

def real_time_recommendations(user_id, beacon=None):
    """
    Real-time recommendation serving - call this for each user request
    This is FAST because it uses pre-trained weights
    
    Args:
        user_id: User to get recommendations for
        beacon: Optional pre-loaded beacon instance
    """
    
    if beacon is None:
        # Load pre-trained model (very fast)
        print("📦 Loading pre-trained model...")
        beacon = PersistentBeaconAI(
            model_cache_dir="./beacon_models",
            user_id=None  # Use global model for this example
        )
        
        # This just loads from cache - NO TRAINING
        beacon.load_trained_model()
    
    # Get recommendations (super fast inference)
    start_time = time.time()
    
    recommendations = beacon.recommend_for_user(
        user_id=user_id,
        top_n=10,
        filter_liked=True,
        interactions=None,  # You can pass current interactions to filter
        batch_size=2048  # Large batch for fast inference
    )
    
    end_time = time.time()
    
    print(f"🚀 Generated {len(recommendations)} recommendations in {end_time - start_time:.3f} seconds")
    
    return recommendations

def production_workflow_example():
    """
    Example of a complete production workflow
    """
    print("=" * 60)
    print("🏭 PRODUCTION WORKFLOW EXAMPLE")
    print("=" * 60)
    
    # Step 1: Daily training (run this via cron job at 2 AM daily)
    print("\n1️⃣ Daily Training Job (scheduled):")
    beacon = daily_training_job(user_id=None)  # Global model
    
    # Step 2: Real-time serving (called for each user request)
    print("\n2️⃣ Real-time Recommendation Serving:")
    
    # Simulate multiple user requests
    test_users = ["user_123", "user_456", "user_789"]
    
    for user_id in test_users:
        print(f"\n🎯 Getting recommendations for {user_id}:")
        recommendations = real_time_recommendations(user_id, beacon)
        
        # Display results
        if recommendations:
            print(f"   Top 3 recommendations:")
            for i, (event_id, score) in enumerate(recommendations[:3], 1):
                print(f"   {i}. Event {event_id} (score: {score:.3f})")
        else:
            print(f"   No recommendations found for {user_id}")

def load_your_data():
    """
    Replace this with your actual data loading logic
    """
    # Example dummy data - replace with your database queries
    users = [f"user_{i}" for i in range(1000)]
    events = [f"event_{i}" for i in range(500)]
    
    user_features = [(f"user_{i}", ["feature_1", "feature_2"]) for i in range(1000)]
    event_features = [(f"event_{i}", ["event_type_A", "category_B"]) for i in range(500)]
    
    # Generate some dummy interactions
    interactions = []
    for i in range(5000):
        user = f"user_{i % 1000}"
        event = f"event_{i % 500}"
        rating = 1 if i % 3 == 0 else 0  # 33% positive interactions
        interactions.append((user, event, rating))
    
    return users, events, user_features, event_features, interactions

def benchmark_performance():
    """
    Benchmark the performance difference between training vs loading
    """
    print("=" * 60)
    print("⚡ PERFORMANCE BENCHMARK")
    print("=" * 60)
    
    # Load data once
    users, events, user_features, event_features, interactions = load_your_data()
    
    # Test 1: Fresh training
    print("\n🏋️ Test 1: Fresh Training")
    beacon_fresh = PersistentBeaconAI(model_cache_dir="./benchmark_models_fresh")
    
    start = time.time()
    beacon_fresh.load_or_train(users, events, user_features, event_features, interactions, force_retrain=True)
    training_time = time.time() - start
    
    # Test 2: Loading pre-trained
    print("\n📦 Test 2: Loading Pre-trained Model")
    beacon_loaded = PersistentBeaconAI(model_cache_dir="./benchmark_models_fresh")
    
    start = time.time()
    beacon_loaded.load_or_train(users, events, user_features, event_features, interactions, force_retrain=False)
    loading_time = time.time() - start
    
    # Test 3: Recommendation speed
    print("\n🚀 Test 3: Recommendation Speed")
    start = time.time()
    for _ in range(10):  # 10 recommendation calls
        beacon_loaded.recommend_for_user("user_1", top_n=10)
    avg_rec_time = (time.time() - start) / 10
    
    # Results
    print("\n📊 BENCHMARK RESULTS:")
    print(f"   Training time:     {training_time:.2f} seconds")
    print(f"   Loading time:      {loading_time:.2f} seconds")
    print(f"   Speedup:          {training_time/loading_time:.1f}x faster")
    print(f"   Avg rec time:     {avg_rec_time:.3f} seconds")
    print(f"   Recommendations/sec: {1/avg_rec_time:.1f}")

if __name__ == "__main__":
    print("🎯 PersistentBeaconAI Usage Examples")
    print("Choose an example to run:")
    print("1. Production Workflow")
    print("2. Performance Benchmark")
    
    choice = input("\nEnter choice (1 or 2): ").strip()
    
    if choice == "1":
        production_workflow_example()
    elif choice == "2":
        benchmark_performance()
    else:
        print("Running production workflow by default...")
        production_workflow_example()
    
    print("\n✅ Done!") 