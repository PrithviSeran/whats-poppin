import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from scipy.sparse import coo_matrix
from typing import Dict, List, Tuple, Optional
import torch.nn.functional as F
import os
import pickle
import json
import base64
import io
from datetime import datetime, timedelta
import hashlib
import logging
from supabase import create_client, Client
import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CloudMatrixFactorizationModel(nn.Module):
    """PyTorch model optimized for cloud deployment"""
    def __init__(self, num_users, num_items, num_user_features, num_item_features, 
                 embedding_dim=32, sparse=False, use_bias=True):
        super().__init__()
        
        # Store model configuration
        self.config = {
            'num_users': num_users,
            'num_items': num_items,
            'num_user_features': num_user_features,
            'num_item_features': num_item_features,
            'embedding_dim': embedding_dim,
            'sparse': sparse,
            'use_bias': use_bias
        }
        
        # Embeddings
        self.user_embeddings = nn.Embedding(num_users, embedding_dim, sparse=sparse)
        self.item_embeddings = nn.Embedding(num_items, embedding_dim, sparse=sparse)
        self.user_feature_embeddings = nn.Embedding(num_user_features, embedding_dim, sparse=sparse)
        self.item_feature_embeddings = nn.Embedding(num_item_features, embedding_dim, sparse=sparse)
        
        # Bias terms
        self.use_bias = use_bias
        if use_bias:
            self.user_bias = nn.Embedding(num_users, 1, sparse=sparse)
            self.item_bias = nn.Embedding(num_items, 1, sparse=sparse)
            self.global_bias = nn.Parameter(torch.zeros(1))
        
        self._init_weights()
        
    def _init_weights(self):
        """Initialize weights"""
        nn.init.xavier_normal_(self.user_embeddings.weight)
        nn.init.xavier_normal_(self.item_embeddings.weight)
        nn.init.xavier_normal_(self.user_feature_embeddings.weight)
        nn.init.xavier_normal_(self.item_feature_embeddings.weight)
        
        if self.use_bias:
            nn.init.zeros_(self.user_bias.weight)
            nn.init.zeros_(self.item_bias.weight)
        
    def forward_vectorized(self, user_ids, item_ids, user_feature_tensor, item_feature_tensor):
        """Vectorized forward pass"""
        user_embedding = self.user_embeddings(user_ids) + user_feature_tensor
        item_embedding = self.item_embeddings(item_ids) + item_feature_tensor
        prediction = torch.sum(user_embedding * item_embedding, dim=1)
        
        if self.use_bias:
            user_bias = self.user_bias(user_ids).squeeze(1)
            item_bias = self.item_bias(item_ids).squeeze(1)
            prediction = prediction + user_bias + item_bias + self.global_bias
        
        return prediction
    
    def to_bytes(self):
        """Serialize model to bytes for storage"""
        buffer = io.BytesIO()
        save_dict = {
            'state_dict': self.state_dict(),
            'config': self.config,
            'timestamp': datetime.now().isoformat()
        }
        torch.save(save_dict, buffer)
        return buffer.getvalue()
    
    @classmethod
    def from_bytes(cls, data_bytes, device='cpu'):
        """Load model from bytes"""
        buffer = io.BytesIO(data_bytes)
        save_dict = torch.load(buffer, map_location=device)
        config = save_dict['config']
        
        model = cls(**config)
        model.load_state_dict(save_dict['state_dict'])
        model.to(device)
        
        return model, save_dict.get('timestamp', 'unknown')

class SupabaseModelStorage:
    """Handle model storage in Supabase"""
    
    def __init__(self, supabase_url: str, supabase_key: str, table_name: str = "beacon_models"):
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.table_name = table_name
        self._ensure_table_exists()
    
    def _ensure_table_exists(self):
        """Ensure the models table exists"""
        # You need to create this table in your Supabase dashboard:
        """
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
        """
        pass
    
    def save_model(self, user_id: str, model_data: bytes, mappings_data: bytes, 
                   features_data: bytes, metadata: dict, data_fingerprint: str):
        """Save model to Supabase"""
        try:
            # Encode binary data as base64 for storage
            model_b64 = base64.b64encode(model_data).decode('utf-8')
            mappings_b64 = base64.b64encode(mappings_data).decode('utf-8')
            features_b64 = base64.b64encode(features_data).decode('utf-8')
            
            # Check if model for this user exists today
            today = datetime.now().date().isoformat()
            existing = self.supabase.table(self.table_name).select("id").eq(
                "user_id", user_id or "global"
            ).gte("created_at", f"{today}T00:00:00").execute()
            
            data = {
                "user_id": user_id or "global",
                "model_type": "user" if user_id else "global",
                "model_data": model_b64,
                "mappings_data": mappings_b64,
                "features_data": features_b64,
                "metadata": metadata,
                "data_fingerprint": data_fingerprint,
                "updated_at": datetime.now().isoformat()
            }
            
            if existing.data:
                # Update existing model
                result = self.supabase.table(self.table_name).update(data).eq(
                    "id", existing.data[0]["id"]
                ).execute()
            else:
                # Insert new model
                result = self.supabase.table(self.table_name).insert(data).execute()
            
            logger.info(f"✅ Model saved to Supabase for user: {user_id or 'global'}")
            return result.data[0]["id"] if result.data else None
            
        except Exception as e:
            logger.error(f"❌ Failed to save model to Supabase: {e}")
            raise
    
    def load_model(self, user_id: str = None, max_age_days: int = 1):
        """Load model from Supabase"""
        try:
            cutoff_date = (datetime.now() - timedelta(days=max_age_days)).isoformat()
            
            result = self.supabase.table(self.table_name).select("*").eq(
                "user_id", user_id or "global"
            ).gte("created_at", cutoff_date).order("created_at", desc=True).limit(1).execute()
            
            if not result.data:
                return None
            
            model_record = result.data[0]
            
            # Decode base64 data
            model_data = base64.b64decode(model_record["model_data"])
            mappings_data = base64.b64decode(model_record["mappings_data"])
            features_data = base64.b64decode(model_record["features_data"])
            
            logger.info(f"📦 Model loaded from Supabase for user: {user_id or 'global'}")
            
            return {
                "model_data": model_data,
                "mappings_data": mappings_data,
                "features_data": features_data,
                "metadata": model_record["metadata"],
                "data_fingerprint": model_record["data_fingerprint"],
                "created_at": model_record["created_at"]
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to load model from Supabase: {e}")
            return None
    
    def cleanup_old_models(self, days_to_keep: int = 7):
        """Clean up old models"""
        try:
            cutoff_date = (datetime.now() - timedelta(days=days_to_keep)).isoformat()
            
            result = self.supabase.table(self.table_name).delete().lt(
                "created_at", cutoff_date
            ).execute()
            
            if result.data:
                logger.info(f"🧹 Cleaned up {len(result.data)} old models")
            
        except Exception as e:
            logger.error(f"❌ Failed to cleanup old models: {e}")

class HuggingFaceBeaconAI:
    """BeaconAI optimized for Hugging Face Spaces with Supabase storage"""
    
    def __init__(self, supabase_url: str, supabase_key: str, embedding_dim=32, 
                 use_bias=True, device=None, user_id=None):
        self.embedding_dim = embedding_dim
        self.use_bias = use_bias
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        self.user_id = user_id
        self.model = None
        
        # Initialize Supabase storage
        self.storage = SupabaseModelStorage(supabase_url, supabase_key)
        
        # Mappings and features
        self.user_id_map = {}
        self.item_id_map = {}
        self.user_feature_map = {}
        self.item_feature_map = {}
        self.internal_to_user = {}
        self.internal_to_item = {}
        self.user_feature_tensor = None
        self.item_feature_tensor = None
        self.interactions = None
        
        # Metadata
        self.data_fingerprint = None
        self.last_training_date = None
        
        # Thread pool for background operations
        self.executor = ThreadPoolExecutor(max_workers=2)
    
    def _compute_data_fingerprint(self, users, events, user_features, event_features, interactions):
        """Compute hash of input data"""
        data_str = (
            str(sorted(users)) + 
            str(sorted(events)) + 
            str(sorted(user_features)) + 
            str(sorted(event_features)) + 
            str(sorted(interactions))
        )
        return hashlib.md5(data_str.encode()).hexdigest()
    
    def needs_training(self, users, events, user_features, event_features, interactions):
        """Check if training is needed"""
        # Check if model exists in Supabase
        stored_model = self.storage.load_model(self.user_id)
        
        if not stored_model:
            logger.info("No model found in Supabase - training needed")
            return True
        
        # Check if data changed
        current_fingerprint = self._compute_data_fingerprint(
            users, events, user_features, event_features, interactions
        )
        
        if stored_model["data_fingerprint"] != current_fingerprint:
            logger.info("Data changed since last training - retraining needed")
            return True
        
        # Check if model is from today
        model_date = datetime.fromisoformat(stored_model["created_at"].replace('Z', '+00:00')).date()
        if model_date < datetime.now().date():
            logger.info(f"Model is from {model_date}, training needed for today")
            return True
        
        logger.info(f"Using existing model from {model_date}")
        return False
    
    def load_or_train(self, users, events, user_features, event_features, interactions, 
                     force_retrain=False, **training_params):
        """Load existing model or train new one if needed"""
        
        if force_retrain or self.needs_training(users, events, user_features, event_features, interactions):
            logger.info("🏋️ Training new model...")
            return self.fit_and_train(users, events, user_features, event_features, interactions, **training_params)
        else:
            logger.info("📦 Loading existing model...")
            return self.load_trained_model()
    
    def fit_and_train(self, users, events, user_features, event_features, interactions, **training_params):
        """Fit data and train model"""
        # Fit data
        self.fit_data(users, events, user_features, event_features, interactions)
        
        # Train model
        default_params = {
            'epochs': 10,
            'learning_rate': 0.01,
            'weight_decay': 1e-6,
            'batch_size': 256,
            'negative_sampling_ratio': 1.0,
            'use_early_stopping': True,
            'patience': 3
        }
        default_params.update(training_params)
        
        self.train_model(**default_params)
        
        # Save to Supabase
        self.save_trained_model()
        
        logger.info("✅ Model trained and saved successfully")
        return "trained"
    
    def fit_data(self, users, events, user_features, event_features, interactions):
        """Fit data and initialize model"""
        logger.info(f"Fitting data: {len(users)} users, {len(events)} events")
        
        # Create mappings
        self.user_id_map = {uid: idx for idx, uid in enumerate(users)}
        self.item_id_map = {eid: idx for idx, eid in enumerate(events)}
        self.internal_to_user = {idx: uid for uid, idx in self.user_id_map.items()}
        self.internal_to_item = {idx: eid for eid, idx in self.item_id_map.items()}
        
        # Create feature mappings
        user_feature_tags = set(f for _, feats in user_features for f in feats)
        event_feature_tags = set(f for _, feats in event_features for f in feats)
        
        self.user_feature_map = {feat: idx for idx, feat in enumerate(user_feature_tags)}
        self.item_feature_map = {feat: idx for idx, feat in enumerate(event_feature_tags)}
        
        # Pre-compute feature tensors
        self._precompute_feature_tensors(user_features, event_features)
        
        # Process interactions
        valid_event_ids = set(events)
        clean_interactions = [(u, e, v) for u, e, v in interactions if e in valid_event_ids]
        
        user_indices, item_indices, values = [], [], []
        for u, e, val in clean_interactions:
            if val > 0 and u in self.user_id_map and e in self.item_id_map:
                user_indices.append(self.user_id_map[u])
                item_indices.append(self.item_id_map[e])
                values.append(float(val))
        
        self.interactions = coo_matrix(
            (values, (user_indices, item_indices)),
            shape=(len(self.user_id_map), len(self.item_id_map))
        )
        
        # Initialize model
        self.model = CloudMatrixFactorizationModel(
            num_users=len(self.user_id_map),
            num_items=len(self.item_id_map),
            num_user_features=len(self.user_feature_map),
            num_item_features=len(self.item_feature_map),
            embedding_dim=self.embedding_dim,
            use_bias=self.use_bias
        ).to(self.device)
        
        # Compute data fingerprint
        self.data_fingerprint = self._compute_data_fingerprint(
            users, events, user_features, event_features, interactions
        )
    
    def _precompute_feature_tensors(self, user_features, event_features):
        """Pre-compute feature embeddings"""
        num_users = len(self.user_id_map)
        num_items = len(self.item_id_map)
        
        self.user_feature_tensor = torch.zeros(num_users, self.embedding_dim, device=self.device)
        self.item_feature_tensor = torch.zeros(num_items, self.embedding_dim, device=self.device)
        
        self._user_features_raw = self._process_features(user_features, self.user_id_map, self.user_feature_map)
        self._item_features_raw = self._process_features(event_features, self.item_id_map, self.item_feature_map)
    
    def _process_features(self, feature_data, id_map, feature_map):
        """Process features"""
        features_dict = {}
        for entity_id, feature_list in feature_data:
            if entity_id in id_map:
                internal_id = id_map[entity_id]
                feature_indices = [feature_map[f] for f in feature_list if f in feature_map]
                if feature_indices:
                    features_dict[internal_id] = (feature_indices, [1.0] * len(feature_indices))
        return features_dict
    
    def train_model(self, epochs=10, learning_rate=0.01, weight_decay=1e-6, batch_size=256, 
                   negative_sampling_ratio=1.0, use_early_stopping=True, patience=3):
        """Train the model"""
        if self.model is None:
            raise ValueError("Model not initialized. Call fit_data first.")
        
        optimizer = optim.AdamW(self.model.parameters(), lr=learning_rate, weight_decay=weight_decay)
        scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', patience=2, factor=0.5)
        loss_fn = nn.MSELoss()
        
        # Convert interactions to training data
        coo = self.interactions.tocoo()
        pos_user_ids = coo.row
        pos_item_ids = coo.col
        pos_labels = coo.data.astype(np.float32)
        
        # Negative sampling
        num_negatives = int(len(pos_user_ids) * negative_sampling_ratio)
        neg_user_ids = np.random.randint(0, len(self.user_id_map), size=num_negatives)
        neg_item_ids = np.random.randint(0, len(self.item_id_map), size=num_negatives)
        neg_labels = np.zeros(num_negatives, dtype=np.float32)
        
        # Combine data
        all_user_ids = np.concatenate([pos_user_ids, neg_user_ids])
        all_item_ids = np.concatenate([pos_item_ids, neg_item_ids])
        all_labels = np.concatenate([pos_labels, neg_labels])
        
        dataset_size = len(all_user_ids)
        indices = np.arange(dataset_size)
        
        # Update feature tensors
        self._update_feature_tensors()
        
        # Training loop
        best_loss = float('inf')
        patience_counter = 0
        
        for epoch in range(epochs):
            self.model.train()
            np.random.shuffle(indices)
            total_loss = 0.0
            batches = 0
            
            for start_idx in range(0, dataset_size, batch_size):
                batch_indices = indices[start_idx:start_idx+batch_size]
                
                batch_user_ids = torch.tensor(all_user_ids[batch_indices], dtype=torch.long, device=self.device)
                batch_item_ids = torch.tensor(all_item_ids[batch_indices], dtype=torch.long, device=self.device)
                batch_labels = torch.tensor(all_labels[batch_indices], dtype=torch.float, device=self.device)
                
                batch_user_features = self.user_feature_tensor[batch_user_ids]
                batch_item_features = self.item_feature_tensor[batch_item_ids]
                
                raw_predictions = self.model.forward_vectorized(
                    batch_user_ids, batch_item_ids, batch_user_features, batch_item_features
                )
                
                predictions = torch.sigmoid(raw_predictions) * 3.0
                loss = loss_fn(predictions, batch_labels)
                
                optimizer.zero_grad()
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
                optimizer.step()
                
                total_loss += loss.item()
                batches += 1
            
            avg_loss = total_loss / batches if batches > 0 else 0
            scheduler.step(avg_loss)
            
            logger.info(f"Epoch {epoch+1}/{epochs}, Loss: {avg_loss:.4f}")
            
            # Early stopping
            if use_early_stopping:
                if avg_loss < best_loss:
                    best_loss = avg_loss
                    patience_counter = 0
                else:
                    patience_counter += 1
                    if patience_counter >= patience:
                        logger.info(f"Early stopping at epoch {epoch+1}")
                        break
    
    def _update_feature_tensors(self):
        """Update feature tensors"""
        if self.model is None:
            return
            
        self.model.eval()
        with torch.no_grad():
            for user_internal_id, (feat_indices, feat_values) in self._user_features_raw.items():
                if feat_indices:
                    feat_idx_tensor = torch.tensor(feat_indices, device=self.device)
                    feat_val_tensor = torch.tensor(feat_values, dtype=torch.float, device=self.device)
                    feat_embeddings = self.model.user_feature_embeddings(feat_idx_tensor)
                    self.user_feature_tensor[user_internal_id] = torch.sum(
                        feat_embeddings * feat_val_tensor.unsqueeze(1), dim=0
                    )
            
            for item_internal_id, (feat_indices, feat_values) in self._item_features_raw.items():
                if feat_indices:
                    feat_idx_tensor = torch.tensor(feat_indices, device=self.device)
                    feat_val_tensor = torch.tensor(feat_values, dtype=torch.float, device=self.device)
                    feat_embeddings = self.model.item_feature_embeddings(feat_idx_tensor)
                    self.item_feature_tensor[item_internal_id] = torch.sum(
                        feat_embeddings * feat_val_tensor.unsqueeze(1), dim=0
                    )
    
    def save_trained_model(self):
        """Save model to Supabase"""
        if self.model is None:
            raise ValueError("No model to save")
        
        # Serialize model
        model_data = self.model.to_bytes()
        
        # Serialize mappings
        mappings = {
            'user_id_map': self.user_id_map,
            'item_id_map': self.item_id_map,
            'user_feature_map': self.user_feature_map,
            'item_feature_map': self.item_feature_map,
            'internal_to_user': self.internal_to_user,
            'internal_to_item': self.internal_to_item
        }
        mappings_data = pickle.dumps(mappings)
        
        # Serialize features
        features = {
            'user_feature_tensor': self.user_feature_tensor.cpu(),
            'item_feature_tensor': self.item_feature_tensor.cpu(),
            'user_features_raw': self._user_features_raw,
            'item_features_raw': self._item_features_raw
        }
        
        buffer = io.BytesIO()
        torch.save(features, buffer)
        features_data = buffer.getvalue()
        
        # Metadata
        metadata = {
            'embedding_dim': self.embedding_dim,
            'use_bias': self.use_bias,
            'device': str(self.device),
            'user_id': self.user_id,
            'last_training_date': datetime.now().isoformat()
        }
        
        # Save to Supabase
        self.storage.save_model(
            self.user_id, model_data, mappings_data, 
            features_data, metadata, self.data_fingerprint
        )
        
        self.last_training_date = datetime.now()
    
    def load_trained_model(self):
        """Load model from Supabase"""
        stored_model = self.storage.load_model(self.user_id)
        
        if not stored_model:
            raise FileNotFoundError(f"No trained model found for user: {self.user_id or 'global'}")
        
        # Load model
        self.model, timestamp = CloudMatrixFactorizationModel.from_bytes(
            stored_model["model_data"], self.device
        )
        
        # Load mappings
        mappings = pickle.loads(stored_model["mappings_data"])
        self.user_id_map = mappings['user_id_map']
        self.item_id_map = mappings['item_id_map']
        self.user_feature_map = mappings['user_feature_map']
        self.item_feature_map = mappings['item_feature_map']
        self.internal_to_user = mappings['internal_to_user']
        self.internal_to_item = mappings['internal_to_item']
        
        # Load features
        buffer = io.BytesIO(stored_model["features_data"])
        features = torch.load(buffer, map_location=self.device)
        self.user_feature_tensor = features['user_feature_tensor'].to(self.device)
        self.item_feature_tensor = features['item_feature_tensor'].to(self.device)
        self._user_features_raw = features['user_features_raw']
        self._item_features_raw = features['item_features_raw']
        
        # Load metadata
        self.data_fingerprint = stored_model["data_fingerprint"]
        metadata = stored_model["metadata"]
        self.last_training_date = datetime.fromisoformat(metadata['last_training_date'])
        
        logger.info("✅ Pre-trained model loaded from Supabase")
        return "loaded"
    
    def recommend_for_user(self, user_id, top_n=5, filter_liked=True, interactions=None, batch_size=1024):
        """Generate recommendations"""
        if self.model is None:
            raise ValueError("No model loaded. Call load_or_train first.")
        
        if user_id not in self.user_id_map:
            logger.warning(f"User {user_id} not found in trained model.")
            return []
        
        user_internal_id = self.user_id_map[user_id]
        num_items = len(self.item_id_map)
        
        self.model.eval()
        with torch.no_grad():
            all_scores = []
            
            for start_idx in range(0, num_items, batch_size):
                end_idx = min(start_idx + batch_size, num_items)
                batch_size_actual = end_idx - start_idx
                
                user_ids_batch = torch.full((batch_size_actual,), user_internal_id, dtype=torch.long, device=self.device)
                item_ids_batch = torch.arange(start_idx, end_idx, dtype=torch.long, device=self.device)
                
                user_features_batch = self.user_feature_tensor[user_ids_batch]
                item_features_batch = self.item_feature_tensor[item_ids_batch]
                
                raw_predictions = self.model.forward_vectorized(
                    user_ids_batch, item_ids_batch, user_features_batch, item_features_batch
                )
                
                batch_scores = torch.sigmoid(raw_predictions) * 3.0
                all_scores.append(batch_scores.cpu().numpy())
            
            scores = np.concatenate(all_scores)
        
        # Filter liked items
        liked_items = set()
        if filter_liked and interactions is not None:
            liked_items = {
                self.item_id_map[e] 
                for u, e, v in interactions 
                if u == user_id and v == 1 and e in self.item_id_map
            }
        
        # Get recommendations
        recommendations = []
        for idx in np.argsort(-scores):
            if not filter_liked or idx not in liked_items:
                item_id = self.internal_to_item[idx]
                recommendations.append((item_id, float(scores[idx])))
                if len(recommendations) >= top_n:
                    break
        
        return recommendations
    
    def fit_data(self, users, events, user_features, event_features, interactions):
        """Fit data and initialize model"""
        logger.info(f"Fitting data: {len(users)} users, {len(events)} events")
        
        # Create mappings
        self.user_id_map = {uid: idx for idx, uid in enumerate(users)}
        self.item_id_map = {eid: idx for idx, eid in enumerate(events)}
        self.internal_to_user = {idx: uid for uid, idx in self.user_id_map.items()}
        self.internal_to_item = {idx: eid for eid, idx in self.item_id_map.items()}
        
        # Create feature mappings
        user_feature_tags = set(f for _, feats in user_features for f in feats)
        event_feature_tags = set(f for _, feats in event_features for f in feats)
        
        self.user_feature_map = {feat: idx for idx, feat in enumerate(user_feature_tags)}
        self.item_feature_map = {feat: idx for idx, feat in enumerate(event_feature_tags)}
        
        # Pre-compute feature tensors
        self._precompute_feature_tensors(user_features, event_features)
        
        # Process interactions
        valid_event_ids = set(events)
        clean_interactions = [(u, e, v) for u, e, v in interactions if e in valid_event_ids]
        
        user_indices, item_indices, values = [], [], []
        for u, e, val in clean_interactions:
            if val > 0 and u in self.user_id_map and e in self.item_id_map:
                user_indices.append(self.user_id_map[u])
                item_indices.append(self.item_id_map[e])
                values.append(float(val))
        
        self.interactions = coo_matrix(
            (values, (user_indices, item_indices)),
            shape=(len(self.user_id_map), len(self.item_id_map))
        )
        
        # Initialize model
        self.model = CloudMatrixFactorizationModel(
            num_users=len(self.user_id_map),
            num_items=len(self.item_id_map),
            num_user_features=len(self.user_feature_map),
            num_item_features=len(self.item_feature_map),
            embedding_dim=self.embedding_dim,
            use_bias=self.use_bias
        ).to(self.device)
        
        # Compute data fingerprint
        self.data_fingerprint = self._compute_data_fingerprint(
            users, events, user_features, event_features, interactions
        )
    
    def _precompute_feature_tensors(self, user_features, event_features):
        """Pre-compute feature embeddings"""
        num_users = len(self.user_id_map)
        num_items = len(self.item_id_map)
        
        self.user_feature_tensor = torch.zeros(num_users, self.embedding_dim, device=self.device)
        self.item_feature_tensor = torch.zeros(num_items, self.embedding_dim, device=self.device)
        
        self._user_features_raw = self._process_features(user_features, self.user_id_map, self.user_feature_map)
        self._item_features_raw = self._process_features(event_features, self.item_id_map, self.item_feature_map)
    
    def _process_features(self, feature_data, id_map, feature_map):
        """Process features"""
        features_dict = {}
        for entity_id, feature_list in feature_data:
            if entity_id in id_map:
                internal_id = id_map[entity_id]
                feature_indices = [feature_map[f] for f in feature_list if f in feature_map]
                if feature_indices:
                    features_dict[internal_id] = (feature_indices, [1.0] * len(feature_indices))
        return features_dict
    
    def train_model(self, epochs=10, learning_rate=0.01, weight_decay=1e-6, batch_size=256, 
                   negative_sampling_ratio=1.0, use_early_stopping=True, patience=3):
        """Train the model"""
        if self.model is None:
            raise ValueError("Model not initialized. Call fit_data first.")
        
        optimizer = optim.AdamW(self.model.parameters(), lr=learning_rate, weight_decay=weight_decay)
        scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', patience=2, factor=0.5)
        loss_fn = nn.MSELoss()
        
        # Convert interactions to training data
        coo = self.interactions.tocoo()
        pos_user_ids = coo.row
        pos_item_ids = coo.col
        pos_labels = coo.data.astype(np.float32)
        
        # Negative sampling
        num_negatives = int(len(pos_user_ids) * negative_sampling_ratio)
        neg_user_ids = np.random.randint(0, len(self.user_id_map), size=num_negatives)
        neg_item_ids = np.random.randint(0, len(self.item_id_map), size=num_negatives)
        neg_labels = np.zeros(num_negatives, dtype=np.float32)
        
        # Combine data
        all_user_ids = np.concatenate([pos_user_ids, neg_user_ids])
        all_item_ids = np.concatenate([pos_item_ids, neg_item_ids])
        all_labels = np.concatenate([pos_labels, neg_labels])
        
        dataset_size = len(all_user_ids)
        indices = np.arange(dataset_size)
        
        # Update feature tensors
        self._update_feature_tensors()
        
        # Training loop
        best_loss = float('inf')
        patience_counter = 0
        
        for epoch in range(epochs):
            self.model.train()
            np.random.shuffle(indices)
            total_loss = 0.0
            batches = 0
            
            for start_idx in range(0, dataset_size, batch_size):
                batch_indices = indices[start_idx:start_idx+batch_size]
                
                batch_user_ids = torch.tensor(all_user_ids[batch_indices], dtype=torch.long, device=self.device)
                batch_item_ids = torch.tensor(all_item_ids[batch_indices], dtype=torch.long, device=self.device)
                batch_labels = torch.tensor(all_labels[batch_indices], dtype=torch.float, device=self.device)
                
                batch_user_features = self.user_feature_tensor[batch_user_ids]
                batch_item_features = self.item_feature_tensor[batch_item_ids]
                
                raw_predictions = self.model.forward_vectorized(
                    batch_user_ids, batch_item_ids, batch_user_features, batch_item_features
                )
                
                predictions = torch.sigmoid(raw_predictions) * 3.0
                loss = loss_fn(predictions, batch_labels)
                
                optimizer.zero_grad()
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
                optimizer.step()
                
                total_loss += loss.item()
                batches += 1
            
            avg_loss = total_loss / batches if batches > 0 else 0
            scheduler.step(avg_loss)
            
            logger.info(f"Epoch {epoch+1}/{epochs}, Loss: {avg_loss:.4f}")
            
            # Early stopping
            if use_early_stopping:
                if avg_loss < best_loss:
                    best_loss = avg_loss
                    patience_counter = 0
                else:
                    patience_counter += 1
                    if patience_counter >= patience:
                        logger.info(f"Early stopping at epoch {epoch+1}")
                        break
    
    def _update_feature_tensors(self):
        """Update feature tensors"""
        if self.model is None:
            return
            
        self.model.eval()
        with torch.no_grad():
            for user_internal_id, (feat_indices, feat_values) in self._user_features_raw.items():
                if feat_indices:
                    feat_idx_tensor = torch.tensor(feat_indices, device=self.device)
                    feat_val_tensor = torch.tensor(feat_values, dtype=torch.float, device=self.device)
                    feat_embeddings = self.model.user_feature_embeddings(feat_idx_tensor)
                    self.user_feature_tensor[user_internal_id] = torch.sum(
                        feat_embeddings * feat_val_tensor.unsqueeze(1), dim=0
                    )
            
            for item_internal_id, (feat_indices, feat_values) in self._item_features_raw.items():
                if feat_indices:
                    feat_idx_tensor = torch.tensor(feat_indices, device=self.device)
                    feat_val_tensor = torch.tensor(feat_values, dtype=torch.float, device=self.device)
                    feat_embeddings = self.model.item_feature_embeddings(feat_idx_tensor)
                    self.item_feature_tensor[item_internal_id] = torch.sum(
                        feat_embeddings * feat_val_tensor.unsqueeze(1), dim=0
                    )
    
    def save_trained_model(self):
        """Save model to Supabase"""
        if self.model is None:
            raise ValueError("No model to save")
        
        # Serialize model
        model_data = self.model.to_bytes()
        
        # Serialize mappings
        mappings = {
            'user_id_map': self.user_id_map,
            'item_id_map': self.item_id_map,
            'user_feature_map': self.user_feature_map,
            'item_feature_map': self.item_feature_map,
            'internal_to_user': self.internal_to_user,
            'internal_to_item': self.internal_to_item
        }
        mappings_data = pickle.dumps(mappings)
        
        # Serialize features
        features = {
            'user_feature_tensor': self.user_feature_tensor.cpu(),
            'item_feature_tensor': self.item_feature_tensor.cpu(),
            'user_features_raw': self._user_features_raw,
            'item_features_raw': self._item_features_raw
        }
        
        buffer = io.BytesIO()
        torch.save(features, buffer)
        features_data = buffer.getvalue()
        
        # Metadata
        metadata = {
            'embedding_dim': self.embedding_dim,
            'use_bias': self.use_bias,
            'device': str(self.device),
            'user_id': self.user_id,
            'last_training_date': datetime.now().isoformat()
        }
        
        # Save to Supabase
        self.storage.save_model(
            self.user_id, model_data, mappings_data, 
            features_data, metadata, self.data_fingerprint
        )
        
        self.last_training_date = datetime.now()
    
    def load_trained_model(self):
        """Load model from Supabase"""
        stored_model = self.storage.load_model(self.user_id)
        
        if not stored_model:
            raise FileNotFoundError(f"No trained model found for user: {self.user_id or 'global'}")
        
        # Load model
        self.model, timestamp = CloudMatrixFactorizationModel.from_bytes(
            stored_model["model_data"], self.device
        )
        
        # Load mappings
        mappings = pickle.loads(stored_model["mappings_data"])
        self.user_id_map = mappings['user_id_map']
        self.item_id_map = mappings['item_id_map']
        self.user_feature_map = mappings['user_feature_map']
        self.item_feature_map = mappings['item_feature_map']
        self.internal_to_user = mappings['internal_to_user']
        self.internal_to_item = mappings['internal_to_item']
        
        # Load features
        buffer = io.BytesIO(stored_model["features_data"])
        features = torch.load(buffer, map_location=self.device)
        self.user_feature_tensor = features['user_feature_tensor'].to(self.device)
        self.item_feature_tensor = features['item_feature_tensor'].to(self.device)
        self._user_features_raw = features['user_features_raw']
        self._item_features_raw = features['item_features_raw']
        
        # Load metadata
        self.data_fingerprint = stored_model["data_fingerprint"]
        metadata = stored_model["metadata"]
        self.last_training_date = datetime.fromisoformat(metadata['last_training_date'])
        
        logger.info("✅ Pre-trained model loaded from Supabase")
        return "loaded"
    
    def schedule_background_training(self, users, events, user_features, event_features, interactions, **training_params):
        """Schedule training in background thread"""
        def train():
            try:
                self.fit_and_train(users, events, user_features, event_features, interactions, **training_params)
                logger.info("🎉 Background training completed successfully")
            except Exception as e:
                logger.error(f"❌ Background training failed: {e}")
        
        future = self.executor.submit(train)
        return future
    
    def cleanup_old_models(self, days_to_keep=7):
        """Clean up old models"""
        return self.storage.cleanup_old_models(days_to_keep)

# Alias for backward compatibility
BeaconAI = HuggingFaceBeaconAI 