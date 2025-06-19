import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from scipy.sparse import coo_matrix
from typing import Dict, List, Tuple, Optional
import torch.nn.functional as F

class OptimizedMatrixFactorizationModel(nn.Module):
    """Optimized PyTorch-based matrix factorization model with vectorized feature processing"""
    def __init__(self, num_users, num_items, num_user_features, num_item_features, 
                 embedding_dim=32, sparse=False, use_bias=True):
        super().__init__()
        
        # User and item embeddings
        self.user_embeddings = nn.Embedding(num_users, embedding_dim, sparse=sparse)
        self.item_embeddings = nn.Embedding(num_items, embedding_dim, sparse=sparse)
        
        # Feature embeddings
        self.user_feature_embeddings = nn.Embedding(num_user_features, embedding_dim, sparse=sparse)
        self.item_feature_embeddings = nn.Embedding(num_item_features, embedding_dim, sparse=sparse)
        
        # Optional bias terms for better convergence
        self.use_bias = use_bias
        if use_bias:
            self.user_bias = nn.Embedding(num_users, 1, sparse=sparse)
            self.item_bias = nn.Embedding(num_items, 1, sparse=sparse)
            self.global_bias = nn.Parameter(torch.zeros(1))
        
        # Initialize weights with Xavier initialization for better convergence
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
        """
        Vectorized forward pass using pre-processed feature tensors
        
        Parameters:
        -----------
        user_ids: tensor of user IDs [batch_size]
        item_ids: tensor of item IDs [batch_size]  
        user_feature_tensor: pre-aggregated user features [batch_size, embedding_dim]
        item_feature_tensor: pre-aggregated item features [batch_size, embedding_dim]
        """
        # Get base embeddings
        user_embedding = self.user_embeddings(user_ids)  # [batch_size, embedding_dim]
        item_embedding = self.item_embeddings(item_ids)  # [batch_size, embedding_dim]
        
        # Add pre-computed feature embeddings
        user_embedding = user_embedding + user_feature_tensor
        item_embedding = item_embedding + item_feature_tensor
        
        # Compute dot product
        prediction = torch.sum(user_embedding * item_embedding, dim=1)  # [batch_size]
        
        # Add bias terms if enabled
        if self.use_bias:
            user_bias = self.user_bias(user_ids).squeeze(1)  # [batch_size]
            item_bias = self.item_bias(item_ids).squeeze(1)  # [batch_size]
            prediction = prediction + user_bias + item_bias + self.global_bias
        
        return prediction
    
    def forward(self, user_ids, item_ids, user_feature_indices, user_feature_values,
               item_feature_indices, item_feature_values):
        """Legacy forward pass for backward compatibility"""
        # Process features the old way (slower but compatible)
        batch_size = user_ids.size(0)
        device = user_ids.device
        user_feature_embedding = torch.zeros(batch_size, self.user_embeddings.embedding_dim, device=device)
        item_feature_embedding = torch.zeros(batch_size, self.item_embeddings.embedding_dim, device=device)
        
        # Add feature embeddings for each example in the batch
        for i in range(batch_size):
            if user_feature_indices[i]:
                u_feat_idx = torch.tensor(user_feature_indices[i], device=device)
                u_feat_val = torch.tensor(user_feature_values[i], dtype=torch.float, device=device)
                u_feat_embed = self.user_feature_embeddings(u_feat_idx)
                user_feature_embedding[i] = torch.sum(u_feat_embed * u_feat_val.unsqueeze(1), dim=0)
            
            if item_feature_indices[i]:
                i_feat_idx = torch.tensor(item_feature_indices[i], device=device)
                i_feat_val = torch.tensor(item_feature_values[i], dtype=torch.float, device=device)
                i_feat_embed = self.item_feature_embeddings(i_feat_idx)
                item_feature_embedding[i] = torch.sum(i_feat_embed * i_feat_val.unsqueeze(1), dim=0)
        
        return self.forward_vectorized(user_ids, item_ids, user_feature_embedding, item_feature_embedding)

class OptimizedBeaconAI:
    def __init__(self, embedding_dim=32, use_bias=True, device=None):
        self.embedding_dim = embedding_dim
        self.use_bias = use_bias
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = None
        
        # Mappings
        self.user_id_map = {}
        self.item_id_map = {}
        self.user_feature_map = {}
        self.item_feature_map = {}
        
        # Reverse mappings
        self.internal_to_user = {}
        self.internal_to_item = {}
        
        # Pre-computed feature tensors for faster training/inference
        self.user_feature_tensor = None  # [num_users, embedding_dim]
        self.item_feature_tensor = None  # [num_items, embedding_dim]
        
        # Interactions
        self.interactions = None
        
    def fit_data(self, users, events, user_features, event_features, interactions):
        print(f"Debug: Total events before fitting: {len(events)}")
        
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
        
        # Pre-compute feature tensors for faster training/inference
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
        
        print(f"Debug: Found {positive_interactions} positive interactions for training")
        
        self.interactions = coo_matrix(
            (values, (user_indices, item_indices)),
            shape=(len(self.user_id_map), len(self.item_id_map))
        )
        
        # Initialize optimized model
        self.model = OptimizedMatrixFactorizationModel(
            num_users=len(self.user_id_map),
            num_items=len(self.item_id_map),
            num_user_features=len(self.user_feature_map),
            num_item_features=len(self.item_feature_map),
            embedding_dim=self.embedding_dim,
            use_bias=self.use_bias
        ).to(self.device)
        
    def _precompute_feature_tensors(self, user_features, event_features):
        """Pre-compute feature embeddings as dense tensors for faster access"""
        num_users = len(self.user_id_map)
        num_items = len(self.item_id_map)
        
        # Initialize feature tensors
        self.user_feature_tensor = torch.zeros(num_users, self.embedding_dim, device=self.device)
        self.item_feature_tensor = torch.zeros(num_items, self.embedding_dim, device=self.device)
        
        # This will be properly computed after model initialization
        self._user_features_raw = self._process_features(user_features, self.user_id_map, self.user_feature_map)
        self._item_features_raw = self._process_features(event_features, self.item_id_map, self.item_feature_map)
    
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
    
    def train_model(self, epochs=10, learning_rate=0.01, weight_decay=1e-6, batch_size=256, 
                   negative_sampling_ratio=1.0, use_early_stopping=True, patience=3):
        """Optimized training with larger batches and early stopping"""
        if self.model is None:
            raise ValueError("Model not initialized. Call fit_data first.")
        
        # Use AdamW optimizer with better weight decay handling
        optimizer = optim.AdamW(self.model.parameters(), lr=learning_rate, weight_decay=weight_decay)
        
        # Use scheduler for better convergence
        scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', patience=2, factor=0.5)
        
        loss_fn = nn.MSELoss()
        
        # Convert interactions to training data
        coo = self.interactions.tocoo()
        pos_user_ids = coo.row
        pos_item_ids = coo.col
        pos_labels = coo.data.astype(np.float32)
        
        # More efficient negative sampling
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
        
        print(f"Debug: Training dataset size: {dataset_size} (batch_size: {batch_size})")
        
        if dataset_size == 0:
            print("Warning: No training data available!")
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
            
            # Process in larger batches for efficiency
            for start_idx in range(0, dataset_size, batch_size):
                batch_indices = indices[start_idx:start_idx+batch_size]
                
                batch_user_ids = torch.tensor(all_user_ids[batch_indices], dtype=torch.long, device=self.device)
                batch_item_ids = torch.tensor(all_item_ids[batch_indices], dtype=torch.long, device=self.device)
                batch_labels = torch.tensor(all_labels[batch_indices], dtype=torch.float, device=self.device)
                
                # Use pre-computed feature tensors for faster access
                batch_user_features = self.user_feature_tensor[batch_user_ids]
                batch_item_features = self.item_feature_tensor[batch_item_ids]
                
                # Forward pass with vectorized features
                raw_predictions = self.model.forward_vectorized(
                    batch_user_ids, batch_item_ids, batch_user_features, batch_item_features
                )
                
                predictions = torch.sigmoid(raw_predictions) * 3.0
                loss = loss_fn(predictions, batch_labels)
                
                # Backward pass
                optimizer.zero_grad()
                loss.backward()
                
                # Gradient clipping for stability
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
                
                optimizer.step()
                
                total_loss += loss.item()
                batches += 1
            
            avg_loss = total_loss / batches if batches > 0 else 0
            scheduler.step(avg_loss)
            
            print(f"Epoch {epoch+1}/{epochs}, Loss: {avg_loss:.4f}, LR: {optimizer.param_groups[0]['lr']:.6f}")
            
            # Early stopping
            if use_early_stopping:
                if avg_loss < best_loss:
                    best_loss = avg_loss
                    patience_counter = 0
                else:
                    patience_counter += 1
                    if patience_counter >= patience:
                        print(f"Early stopping at epoch {epoch+1}")
                        break
            
            # Update feature tensors periodically for better performance
            if epoch % 5 == 0:
                self._update_feature_tensors()
    
    def recommend_for_user(self, user_id, top_n=5, filter_liked=True, interactions=None, batch_size=1024):
        """Optimized recommendation with batched inference"""
        if user_id not in self.user_id_map:
            print(f"User {user_id} not found.")
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
                
                # Create batch tensors
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

# Alias for backward compatibility
BeaconAI = OptimizedBeaconAI 