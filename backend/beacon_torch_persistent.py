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
from datetime import datetime, timedelta
import hashlib
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PersistentMatrixFactorizationModel(nn.Module):
    """Optimized PyTorch model with save/load capabilities"""
    def __init__(self, num_users, num_items, num_user_features, num_item_features, 
                 embedding_dim=32, sparse=False, use_bias=True):
        super().__init__()
        
        # Store model configuration for saving/loading
        self.config = {
            'num_users': num_users,
            'num_items': num_items,
            'num_user_features': num_user_features,
            'num_item_features': num_item_features,
            'embedding_dim': embedding_dim,
            'sparse': sparse,
            'use_bias': use_bias
        }
        
        # User and item embeddings
        self.user_embeddings = nn.Embedding(num_users, embedding_dim, sparse=sparse)
        self.item_embeddings = nn.Embedding(num_items, embedding_dim, sparse=sparse)
        
        # Feature embeddings
        self.user_feature_embeddings = nn.Embedding(num_user_features, embedding_dim, sparse=sparse)
        self.item_feature_embeddings = nn.Embedding(num_item_features, embedding_dim, sparse=sparse)
        
        # Optional bias terms
        self.use_bias = use_bias
        if use_bias:
            self.user_bias = nn.Embedding(num_users, 1, sparse=sparse)
            self.item_bias = nn.Embedding(num_items, 1, sparse=sparse)
            self.global_bias = nn.Parameter(torch.zeros(1))
        
        self._init_weights()
        
    def _init_weights(self):
        """Initialize weights using Xavier initialization"""
        nn.init.xavier_normal_(self.user_embeddings.weight)
        nn.init.xavier_normal_(self.item_embeddings.weight)
        nn.init.xavier_normal_(self.user_feature_embeddings.weight)
        nn.init.xavier_normal_(self.item_feature_embeddings.weight)
        
        if self.use_bias:
            nn.init.zeros_(self.user_bias.weight)
            nn.init.zeros_(self.item_bias.weight)
        
    def forward_vectorized(self, user_ids, item_ids, user_feature_tensor, item_feature_tensor):
        """Vectorized forward pass using pre-processed feature tensors"""
        # Get base embeddings
        user_embedding = self.user_embeddings(user_ids)
        item_embedding = self.item_embeddings(item_ids)
        
        # Add pre-computed feature embeddings
        user_embedding = user_embedding + user_feature_tensor
        item_embedding = item_embedding + item_feature_tensor
        
        # Compute dot product
        prediction = torch.sum(user_embedding * item_embedding, dim=1)
        
        # Add bias terms if enabled
        if self.use_bias:
            user_bias = self.user_bias(user_ids).squeeze(1)
            item_bias = self.item_bias(item_ids).squeeze(1)
            prediction = prediction + user_bias + item_bias + self.global_bias
        
        return prediction
    
    def save_model(self, filepath):
        """Save model state and configuration"""
        save_dict = {
            'state_dict': self.state_dict(),
            'config': self.config,
            'timestamp': datetime.now().isoformat()
        }
        torch.save(save_dict, filepath)
        logger.info(f"Model saved to {filepath}")
    
    @classmethod
    def load_model(cls, filepath, device='cpu'):
        """Load model from saved state"""
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Model file not found: {filepath}")
        
        save_dict = torch.load(filepath, map_location=device)
        config = save_dict['config']
        
        # Create model with saved configuration
        model = cls(**config)
        model.load_state_dict(save_dict['state_dict'])
        model.to(device)
        
        logger.info(f"Model loaded from {filepath} (trained: {save_dict.get('timestamp', 'unknown')})")
        return model

class PersistentBeaconAI:
    """BeaconAI with model persistence and daily training schedule"""
    
    def __init__(self, embedding_dim=32, use_bias=True, device=None, 
                 model_cache_dir="./beacon_models", user_id=None):
        self.embedding_dim = embedding_dim
        self.use_bias = use_bias
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        self.model_cache_dir = model_cache_dir
        self.user_id = user_id
        self.model = None
        
        # Create cache directory
        os.makedirs(model_cache_dir, exist_ok=True)
        
        # Mappings (will be loaded from cache or created fresh)
        self.user_id_map = {}
        self.item_id_map = {}
        self.user_feature_map = {}
        self.item_feature_map = {}
        self.internal_to_user = {}
        self.internal_to_item = {}
        
        # Pre-computed feature tensors
        self.user_feature_tensor = None
        self.item_feature_tensor = None
        self.interactions = None
        
        # Metadata
        self.data_fingerprint = None  # Hash of input data to detect changes
        self.last_training_date = None
        
    def _get_model_paths(self):
        """Get file paths for model and metadata storage"""
        if self.user_id:
            # User-specific model
            model_file = f"beacon_model_user_{self.user_id}_{datetime.now().strftime('%Y-%m-%d')}.pt"
            metadata_file = f"beacon_metadata_user_{self.user_id}.json"
        else:
            # Global model
            model_file = f"beacon_model_global_{datetime.now().strftime('%Y-%m-%d')}.pt"
            metadata_file = "beacon_metadata_global.json"
        
        return {
            'model': os.path.join(self.model_cache_dir, model_file),
            'metadata': os.path.join(self.model_cache_dir, metadata_file),
            'mappings': os.path.join(self.model_cache_dir, f"mappings_{self.user_id or 'global'}.pkl"),
            'features': os.path.join(self.model_cache_dir, f"features_{self.user_id or 'global'}.pt")
        }
    
    def _compute_data_fingerprint(self, users, events, user_features, event_features, interactions):
        """Compute hash of input data to detect changes"""
        data_str = (
            str(sorted(users)) + 
            str(sorted(events)) + 
            str(sorted(user_features)) + 
            str(sorted(event_features)) + 
            str(sorted(interactions))
        )
        return hashlib.md5(data_str.encode()).hexdigest()
    
    def _save_metadata(self):
        """Save training metadata"""
        paths = self._get_model_paths()
        metadata = {
            'last_training_date': self.last_training_date.isoformat() if self.last_training_date else None,
            'data_fingerprint': self.data_fingerprint,
            'embedding_dim': self.embedding_dim,
            'use_bias': self.use_bias,
            'device': str(self.device),
            'user_id': self.user_id
        }
        
        with open(paths['metadata'], 'w') as f:
            json.dump(metadata, f, indent=2)
    
    def _load_metadata(self):
        """Load training metadata"""
        paths = self._get_model_paths()
        if not os.path.exists(paths['metadata']):
            return False
        
        try:
            with open(paths['metadata'], 'r') as f:
                metadata = json.load(f)
            
            self.last_training_date = datetime.fromisoformat(metadata['last_training_date']) if metadata['last_training_date'] else None
            self.data_fingerprint = metadata.get('data_fingerprint')
            
            return True
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.warning(f"Failed to load metadata: {e}")
            return False
    
    def _save_mappings_and_features(self):
        """Save ID mappings and feature tensors"""
        paths = self._get_model_paths()
        
        # Save mappings
        mappings = {
            'user_id_map': self.user_id_map,
            'item_id_map': self.item_id_map,
            'user_feature_map': self.user_feature_map,
            'item_feature_map': self.item_feature_map,
            'internal_to_user': self.internal_to_user,
            'internal_to_item': self.internal_to_item
        }
        
        with open(paths['mappings'], 'wb') as f:
            pickle.dump(mappings, f)
        
        # Save feature tensors
        if self.user_feature_tensor is not None and self.item_feature_tensor is not None:
            torch.save({
                'user_feature_tensor': self.user_feature_tensor.cpu(),
                'item_feature_tensor': self.item_feature_tensor.cpu(),
                'user_features_raw': getattr(self, '_user_features_raw', {}),
                'item_features_raw': getattr(self, '_item_features_raw', {})
            }, paths['features'])
    
    def _load_mappings_and_features(self):
        """Load ID mappings and feature tensors"""
        paths = self._get_model_paths()
        
        # Load mappings
        if not os.path.exists(paths['mappings']):
            return False
        
        try:
            with open(paths['mappings'], 'rb') as f:
                mappings = pickle.load(f)
            
            self.user_id_map = mappings['user_id_map']
            self.item_id_map = mappings['item_id_map']
            self.user_feature_map = mappings['user_feature_map']
            self.item_feature_map = mappings['item_feature_map']
            self.internal_to_user = mappings['internal_to_user']
            self.internal_to_item = mappings['internal_to_item']
            
            # Load feature tensors
            if os.path.exists(paths['features']):
                feature_data = torch.load(paths['features'], map_location=self.device)
                self.user_feature_tensor = feature_data['user_feature_tensor'].to(self.device)
                self.item_feature_tensor = feature_data['item_feature_tensor'].to(self.device)
                self._user_features_raw = feature_data.get('user_features_raw', {})
                self._item_features_raw = feature_data.get('item_features_raw', {})
            
            return True
        except (pickle.PickleError, KeyError, RuntimeError) as e:
            logger.warning(f"Failed to load mappings/features: {e}")
            return False
    
    def needs_training(self, users, events, user_features, event_features, interactions):
        """Check if model needs training (daily schedule or data changes)"""
        # Check if today's model exists
        paths = self._get_model_paths()
        if not os.path.exists(paths['model']):
            logger.info("No model found for today - training needed")
            return True
        
        # Load metadata
        if not self._load_metadata():
            logger.info("No metadata found - training needed")
            return True
        
        # Check if data changed
        current_fingerprint = self._compute_data_fingerprint(users, events, user_features, event_features, interactions)
        if self.data_fingerprint != current_fingerprint:
            logger.info("Data changed since last training - retraining needed")
            return True
        
        # Check if training is from today
        if self.last_training_date is None:
            logger.info("No training date found - training needed")
            return True
        
        if self.last_training_date.date() < datetime.now().date():
            logger.info(f"Model is from {self.last_training_date.date()}, training needed for today")
            return True
        
        logger.info(f"Using existing model from {self.last_training_date}")
        return False
    
    def load_or_train(self, users, events, user_features, event_features, interactions, 
                     force_retrain=False, **training_params):
        """Load existing model or train new one if needed"""
        
        if force_retrain or self.needs_training(users, events, user_features, event_features, interactions):
            logger.info("🏋️ Training new model...")
            self.fit_and_train(users, events, user_features, event_features, interactions, **training_params)
            return "trained"
        else:
            logger.info("📦 Loading existing model...")
            return self.load_trained_model()
    
    def fit_and_train(self, users, events, user_features, event_features, interactions, **training_params):
        """Fit data and train model, then save everything"""
        # Fit data (same as before)
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
        
        # Save everything
        self.save_trained_model()
        
        logger.info("✅ Model trained and saved successfully")
    
    def save_trained_model(self):
        """Save the trained model and all associated data"""
        if self.model is None:
            raise ValueError("No model to save. Train the model first.")
        
        paths = self._get_model_paths()
        
        # Save model
        self.model.save_model(paths['model'])
        
        # Save mappings and features
        self._save_mappings_and_features()
        
        # Update and save metadata
        self.last_training_date = datetime.now()
        self._save_metadata()
        
        logger.info(f"Model saved with timestamp: {self.last_training_date}")
    
    def load_trained_model(self):
        """Load pre-trained model and all associated data"""
        paths = self._get_model_paths()
        
        if not os.path.exists(paths['model']):
            raise FileNotFoundError(f"No trained model found for today: {paths['model']}")
        
        # Load metadata
        if not self._load_metadata():
            raise ValueError("Failed to load model metadata")
        
        # Load mappings and features
        if not self._load_mappings_and_features():
            raise ValueError("Failed to load mappings and features")
        
        # Load model
        self.model = PersistentMatrixFactorizationModel.load_model(paths['model'], self.device)
        
        logger.info("✅ Pre-trained model loaded successfully")
        return "loaded"
    
    def recommend_for_user(self, user_id, top_n=5, filter_liked=True, interactions=None, batch_size=1024):
        """Generate recommendations using pre-trained model"""
        if self.model is None:
            raise ValueError("No model loaded. Call load_or_train first.")
        
        if user_id not in self.user_id_map:
            logger.warning(f"User {user_id} not found in trained model.")
            return []
        
        user_internal_id = self.user_id_map[user_id]
        num_items = len(self.item_id_map)
        
        self.model.eval()
        with torch.no_grad():
            # Process in batches for memory efficiency
            all_scores = []
            
            for start_idx in range(0, num_items, batch_size):
                end_idx = min(start_idx + batch_size, num_items)
                batch_size_actual = end_idx - start_idx
                
                user_ids_batch = torch.full((batch_size_actual,), user_internal_id, dtype=torch.long, device=self.device)
                item_ids_batch = torch.arange(start_idx, end_idx, dtype=torch.long, device=self.device)
                
                # Get pre-computed features
                user_features_batch = self.user_feature_tensor[user_ids_batch]
                item_features_batch = self.item_feature_tensor[item_ids_batch]
                
                # Get predictions
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
        
        # Get top recommendations
        recommendations = []
        for idx in np.argsort(-scores):
            if not filter_liked or idx not in liked_items:
                item_id = self.internal_to_item[idx]
                recommendations.append((item_id, float(scores[idx])))
                if len(recommendations) >= top_n:
                    break
        
        return recommendations
    
    def cleanup_old_models(self, days_to_keep=7):
        """Clean up old model files to save disk space"""
        if not os.path.exists(self.model_cache_dir):
            return
        
        cutoff_date = datetime.now() - timedelta(days=days_to_keep)
        deleted_count = 0
        
        for filename in os.listdir(self.model_cache_dir):
            if filename.endswith('.pt') and 'beacon_model' in filename:
                filepath = os.path.join(self.model_cache_dir, filename)
                
                # Extract date from filename
                try:
                    date_str = filename.split('_')[-1].replace('.pt', '')
                    file_date = datetime.strptime(date_str, '%Y-%m-%d')
                    
                    if file_date < cutoff_date:
                        os.remove(filepath)
                        deleted_count += 1
                        logger.info(f"Deleted old model: {filename}")
                        
                except (ValueError, IndexError):
                    # Skip files that don't match expected format
                    continue
        
        if deleted_count > 0:
            logger.info(f"Cleaned up {deleted_count} old model files")

# Additional methods for the PersistentBeaconAI class
class PersistentBeaconAI(PersistentBeaconAI):
    def fit_data(self, users, events, user_features, event_features, interactions):
        """Fit data (same as optimized version)"""
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
        positive_interactions = 0
        
        for u, e, val in clean_interactions:
            if val > 0 and u in self.user_id_map and e in self.item_id_map:
                user_indices.append(self.user_id_map[u])
                item_indices.append(self.item_id_map[e])
                values.append(float(val))
                positive_interactions += 1
        
        logger.info(f"Found {positive_interactions} positive interactions for training")
        
        self.interactions = coo_matrix(
            (values, (user_indices, item_indices)),
            shape=(len(self.user_id_map), len(self.item_id_map))
        )
        
        # Initialize model
        self.model = PersistentMatrixFactorizationModel(
            num_users=len(self.user_id_map),
            num_items=len(self.item_id_map),
            num_user_features=len(self.user_feature_map),
            num_item_features=len(self.item_feature_map),
            embedding_dim=self.embedding_dim,
            use_bias=self.use_bias
        ).to(self.device)
        
        # Compute data fingerprint
        self.data_fingerprint = self._compute_data_fingerprint(users, events, user_features, event_features, interactions)
    
    def _precompute_feature_tensors(self, user_features, event_features):
        """Pre-compute feature embeddings as dense tensors"""
        num_users = len(self.user_id_map)
        num_items = len(self.item_id_map)
        
        self.user_feature_tensor = torch.zeros(num_users, self.embedding_dim, device=self.device)
        self.item_feature_tensor = torch.zeros(num_items, self.embedding_dim, device=self.device)
        
        self._user_features_raw = self._process_features(user_features, self.user_id_map, self.user_feature_map)
        self._item_features_raw = self._process_features(event_features, self.item_id_map, self.item_feature_map)
    
    def _process_features(self, feature_data, id_map, feature_map):
        """Process features into format suitable for the model"""
        features_dict = {}
        
        for entity_id, feature_list in feature_data:
            if entity_id in id_map:
                internal_id = id_map[entity_id]
                feature_indices = []
                feature_values = []
                
                for feature in feature_list:
                    if feature in feature_map:
                        feature_indices.append(feature_map[feature])
                        feature_values.append(1.0)
                
                if feature_indices:
                    features_dict[internal_id] = (feature_indices, feature_values)
        
        return features_dict
    
    def _update_feature_tensors(self):
        """Update pre-computed feature tensors using current model weights"""
        if self.model is None:
            return
            
        self.model.eval()
        with torch.no_grad():
            # Update user feature tensor
            for user_internal_id, (feat_indices, feat_values) in self._user_features_raw.items():
                if feat_indices:
                    feat_idx_tensor = torch.tensor(feat_indices, device=self.device)
                    feat_val_tensor = torch.tensor(feat_values, dtype=torch.float, device=self.device)
                    feat_embeddings = self.model.user_feature_embeddings(feat_idx_tensor)
                    self.user_feature_tensor[user_internal_id] = torch.sum(
                        feat_embeddings * feat_val_tensor.unsqueeze(1), dim=0
                    )
            
            # Update item feature tensor
            for item_internal_id, (feat_indices, feat_values) in self._item_features_raw.items():
                if feat_indices:
                    feat_idx_tensor = torch.tensor(feat_indices, device=self.device)
                    feat_val_tensor = torch.tensor(feat_values, dtype=torch.float, device=self.device)
                    feat_embeddings = self.model.item_feature_embeddings(feat_idx_tensor)
                    self.item_feature_tensor[item_internal_id] = torch.sum(
                        feat_embeddings * feat_val_tensor.unsqueeze(1), dim=0
                    )
    
    def train_model(self, epochs=10, learning_rate=0.01, weight_decay=1e-6, batch_size=256, 
                   negative_sampling_ratio=1.0, use_early_stopping=True, patience=3):
        """Train the model (same as optimized version)"""
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
        
        # Combine and shuffle
        all_user_ids = np.concatenate([pos_user_ids, neg_user_ids])
        all_item_ids = np.concatenate([pos_item_ids, neg_item_ids])
        all_labels = np.concatenate([pos_labels, neg_labels])
        
        dataset_size = len(all_user_ids)
        indices = np.arange(dataset_size)
        
        logger.info(f"Training dataset size: {dataset_size} (batch_size: {batch_size})")
        
        if dataset_size == 0:
            logger.warning("No training data available!")
            return
        
        # Early stopping variables
        best_loss = float('inf')
        patience_counter = 0
        
        # Update feature tensors before training
        self._update_feature_tensors()
        
        # Training loop
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
                
                # Use pre-computed feature tensors
                batch_user_features = self.user_feature_tensor[batch_user_ids]
                batch_item_features = self.item_feature_tensor[batch_item_ids]
                
                # Forward pass
                raw_predictions = self.model.forward_vectorized(
                    batch_user_ids, batch_item_ids, batch_user_features, batch_item_features
                )
                
                predictions = torch.sigmoid(raw_predictions) * 3.0
                loss = loss_fn(predictions, batch_labels)
                
                # Backward pass
                optimizer.zero_grad()
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
                optimizer.step()
                
                total_loss += loss.item()
                batches += 1
            
            avg_loss = total_loss / batches if batches > 0 else 0
            scheduler.step(avg_loss)
            
            logger.info(f"Epoch {epoch+1}/{epochs}, Loss: {avg_loss:.4f}, LR: {optimizer.param_groups[0]['lr']:.6f}")
            
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
            
            # Update feature tensors periodically
            if epoch % 5 == 0:
                self._update_feature_tensors()

# Backward compatibility alias
BeaconAI = PersistentBeaconAI 