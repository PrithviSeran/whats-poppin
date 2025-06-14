import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from scipy.sparse import coo_matrix

class MatrixFactorizationModel(nn.Module):
    """PyTorch-based matrix factorization model with feature embeddings"""
    def __init__(self, num_users, num_items, num_user_features, num_item_features, 
                 embedding_dim=32, sparse=False):
        super().__init__()
        
        # User and item embeddings
        self.user_embeddings = nn.Embedding(num_users, embedding_dim, sparse=sparse)
        self.item_embeddings = nn.Embedding(num_items, embedding_dim, sparse=sparse)
        
        # Feature embeddings
        self.user_feature_embeddings = nn.Embedding(num_user_features, embedding_dim, sparse=sparse)
        self.item_feature_embeddings = nn.Embedding(num_item_features, embedding_dim, sparse=sparse)
        
        # Initialize weights
        nn.init.normal_(self.user_embeddings.weight, std=0.01)
        nn.init.normal_(self.item_embeddings.weight, std=0.01)
        nn.init.normal_(self.user_feature_embeddings.weight, std=0.01)
        nn.init.normal_(self.item_feature_embeddings.weight, std=0.01)
        
    def forward(self, user_ids, item_ids, user_feature_indices, user_feature_values,
               item_feature_indices, item_feature_values):
        """
        Forward pass of the model
        
        Parameters:
        -----------
        user_ids: tensor of user IDs
        item_ids: tensor of item IDs
        user_feature_indices: list of lists containing feature indices for each user
        user_feature_values: list of lists containing feature values for each user
        item_feature_indices: list of lists containing feature indices for each item
        item_feature_values: list of lists containing feature values for each item
        """
        # Get base embeddings for users and items
        user_embedding = self.user_embeddings(user_ids)
        item_embedding = self.item_embeddings(item_ids)
        
        # Initialize containers for feature embeddings
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
        
        # Combine base embeddings with feature embeddings
        user_embedding = user_embedding + user_feature_embedding
        item_embedding = item_embedding + item_feature_embedding
        
        # Compute dot product for the final prediction
        prediction = torch.sum(user_embedding * item_embedding, dim=1)
        
        return prediction
    
    def predict(self, user_ids, item_ids, user_features, item_features):
        """Make predictions in evaluation mode"""
        self.eval()
        with torch.no_grad():
            # Process features for each user-item pair
            batch_size = len(user_ids)
            user_feature_indices = []
            user_feature_values = []
            item_feature_indices = []
            item_feature_values = []
            
            for i in range(batch_size):
                user_id = user_ids[i].item() if isinstance(user_ids, torch.Tensor) else user_ids[i]
                
                # Get user features if available
                u_feat_idx, u_feat_val = [], []
                if user_id in user_features:
                    u_feat_idx, u_feat_val = user_features[user_id]
                user_feature_indices.append(u_feat_idx)
                user_feature_values.append(u_feat_val)
                
                # Get item features if available
                item_id = item_ids[i].item() if isinstance(item_ids, torch.Tensor) else item_ids[i]
                i_feat_idx, i_feat_val = [], []
                if item_id in item_features:
                    i_feat_idx, i_feat_val = item_features[item_id]
                item_feature_indices.append(i_feat_idx)
                item_feature_values.append(i_feat_val)
            
            # Convert to tensors
            user_ids_tensor = torch.tensor(user_ids, dtype=torch.long)
            item_ids_tensor = torch.tensor(item_ids, dtype=torch.long)
            
            # Make predictions
            raw_predictions = self.forward(
                user_ids_tensor, 
                item_ids_tensor,
                user_feature_indices,
                user_feature_values,
                item_feature_indices,
                item_feature_values
            )
            
            # Apply sigmoid and scale to match training
            predictions = torch.sigmoid(raw_predictions) * 3.0
            
            return predictions.numpy()

class BeaconAI:
    def __init__(self, embedding_dim=32):
        self.embedding_dim = embedding_dim
        self.model = None
        
        # Mappings
        self.user_id_map = {}  # external user ID -> internal index
        self.item_id_map = {}  # external item ID -> internal index
        self.user_feature_map = {}  # external feature -> internal index
        self.item_feature_map = {}  # external feature -> internal index
        
        # Reverse mappings for convenience
        self.internal_to_user = {}  # internal index -> external user ID
        self.internal_to_item = {}  # internal index -> external item ID
        
        # Feature matrices
        self.user_features = {}  # internal user ID -> (feature indices, feature values)
        self.item_features = {}  # internal item ID -> (feature indices, feature values)
        
        # Interactions
        self.interactions = None
        
    def fit_data(self, users, events, user_features, event_features, interactions):
        print(f"Debug: Total events before fitting: {len(events)}")
        
        # Create mappings for users and items
        self.user_id_map = {uid: idx for idx, uid in enumerate(users)}
        self.item_id_map = {eid: idx for idx, eid in enumerate(events)}
        
        # Create reverse mappings
        self.internal_to_user = {idx: uid for uid, idx in self.user_id_map.items()}
        self.internal_to_item = {idx: eid for eid, idx in self.item_id_map.items()}
        
        print(f"Debug: Sample item_id_map keys: {list(self.item_id_map.keys())[:5]}")
        print(f"Debug: Total mapped events: {len(self.item_id_map)}")
        
        # Create mappings for user and item features
        user_feature_tags = set(f for _, feats in user_features for f in feats)
        event_feature_tags = set(f for _, feats in event_features for f in feats)
        
        self.user_feature_map = {feat: idx for idx, feat in enumerate(user_feature_tags)}
        self.item_feature_map = {feat: idx for idx, feat in enumerate(event_feature_tags)}
        
        # Process user features
        self.user_features = self._process_features(user_features, self.user_id_map, self.user_feature_map)
        
        # Process item features
        self.item_features = self._process_features(event_features, self.item_id_map, self.item_feature_map)
        
        # Keep interactions with known events
        valid_event_ids = set(events)
        clean_interactions = [(u, e, v) for u, e, v in interactions if e in valid_event_ids]
        
        # Build sparse interaction matrix with positive interactions
        user_indices = []
        item_indices = []
        values = []
        
        print(f"Debug: Processing {len(clean_interactions)} clean interactions")
        positive_interactions = 0
        
        for u, e, val in clean_interactions:
            # Accept any positive interaction value (1.0, 2.0, etc.) but reject negative ones
            if val > 0 and u in self.user_id_map and e in self.item_id_map:
                user_indices.append(self.user_id_map[u])
                item_indices.append(self.item_id_map[e])
                values.append(float(val))  # Keep the original weight
                positive_interactions += 1
        
        print(f"Debug: Found {positive_interactions} positive interactions for training")
        
        self.interactions = coo_matrix(
            (values, (user_indices, item_indices)),
            shape=(len(self.user_id_map), len(self.item_id_map))
        )
        
        # Initialize the PyTorch model
        self.model = MatrixFactorizationModel(
            num_users=len(self.user_id_map),
            num_items=len(self.item_id_map),
            num_user_features=len(self.user_feature_map),
            num_item_features=len(self.item_feature_map),
            embedding_dim=self.embedding_dim
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
                        feature_values.append(1.0)  # Assuming binary features
                
                if feature_indices:
                    features_dict[internal_id] = (feature_indices, feature_values)
        
        return features_dict
    
    def train_model(self, epochs=10, learning_rate=0.01, weight_decay=1e-6, batch_size=64):
        """Train the PyTorch model"""
        if self.model is None:
            raise ValueError("Model not initialized. Call fit_data first.")
        
        # Create optimizer
        optimizer = optim.Adam(self.model.parameters(), lr=learning_rate, weight_decay=weight_decay)
        
        # Use mean squared error loss to handle weighted interactions
        loss_fn = nn.MSELoss()
        
        # Convert interactions to training data
        coo = self.interactions.tocoo()
        
        # Generate positive examples with their actual weights
        pos_user_ids = coo.row
        pos_item_ids = coo.col
        pos_labels = coo.data.astype(np.float32)  # Use actual interaction weights
        
        # Generate negative examples (simple negative sampling)
        num_negatives = len(pos_user_ids)
        neg_user_ids = np.random.randint(0, len(self.user_id_map), size=num_negatives)
        neg_item_ids = np.random.randint(0, len(self.item_id_map), size=num_negatives)
        neg_labels = np.zeros_like(neg_user_ids, dtype=np.float32)
        
        # Combine positive and negative examples
        all_user_ids = np.concatenate([pos_user_ids, neg_user_ids])
        all_item_ids = np.concatenate([pos_item_ids, neg_item_ids])
        all_labels = np.concatenate([pos_labels, neg_labels])
        
        # Create dataset indices and shuffle
        dataset_size = len(all_user_ids)
        indices = np.arange(dataset_size)
        np.random.shuffle(indices)
        
        print(f"Debug: Training dataset size: {dataset_size}")
        print(f"Debug: Positive examples: {len(pos_user_ids)}, Negative examples: {len(neg_user_ids)}")
        print(f"Debug: Sample positive labels: {pos_labels[:5] if len(pos_labels) > 0 else 'None'}")
        
        if dataset_size == 0:
            print("Warning: No training data available!")
            return
        
        # Training loop
        self.model.train()
        for epoch in range(epochs):
            total_loss = 0.0
            batches = 0
            
            # Process in batches
            for start_idx in range(0, dataset_size, batch_size):
                # Get batch indices
                batch_indices = indices[start_idx:start_idx+batch_size]
                
                # Get batch data
                batch_user_ids = all_user_ids[batch_indices]
                batch_item_ids = all_item_ids[batch_indices]
                batch_labels = all_labels[batch_indices]
                
                # Prepare feature data for the batch
                user_feature_indices = []
                user_feature_values = []
                item_feature_indices = []
                item_feature_values = []
                
                for u_id in batch_user_ids:
                    if u_id in self.user_features:
                        u_feat_idx, u_feat_val = self.user_features[u_id]
                        user_feature_indices.append(u_feat_idx)
                        user_feature_values.append(u_feat_val)
                    else:
                        user_feature_indices.append([])
                        user_feature_values.append([])
                
                for i_id in batch_item_ids:
                    if i_id in self.item_features:
                        i_feat_idx, i_feat_val = self.item_features[i_id]
                        item_feature_indices.append(i_feat_idx)
                        item_feature_values.append(i_feat_val)
                    else:
                        item_feature_indices.append([])
                        item_feature_values.append([])
                
                # Convert to PyTorch tensors
                batch_user_tensor = torch.tensor(batch_user_ids, dtype=torch.long)
                batch_item_tensor = torch.tensor(batch_item_ids, dtype=torch.long)
                batch_labels_tensor = torch.tensor(batch_labels, dtype=torch.float)
                
                # Forward pass
                raw_predictions = self.model(
                    batch_user_tensor,
                    batch_item_tensor,
                    user_feature_indices,
                    user_feature_values,
                    item_feature_indices,
                    item_feature_values
                )
                
                # Apply sigmoid to get predictions in [0, 1] range, then scale for weighted interactions
                predictions = torch.sigmoid(raw_predictions) * 3.0  # Scale to handle weights up to 3.0
                
                # Compute loss
                loss = loss_fn(predictions, batch_labels_tensor)
                
                # Backward pass and optimization
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()
                
                total_loss += loss.item()
                batches += 1
            
            # Print epoch stats
            avg_loss = total_loss / batches if batches > 0 else 0
            print(f"Epoch {epoch+1}/{epochs}, Loss: {avg_loss:.4f}")
    
    def recommend_for_user(self, user_id, top_n=5, filter_liked=True, interactions=None):
        """Generate recommendations for a user"""
        if user_id not in self.user_id_map:
            print(f"User {user_id} not found.")
            return []
        
        user_internal_id = self.user_id_map[user_id]
        print(f"Debug: User internal ID: {user_internal_id}")
        
        # Generate user ID tensors (repeat the same user for all items)
        user_ids = np.repeat(user_internal_id, len(self.item_id_map))
        
        # Generate item ID tensors (all items)
        item_ids = np.arange(len(self.item_id_map))
        
        # Get predictions for all items
        scores = self.model.predict(
            user_ids,
            item_ids,
            self.user_features,
            self.item_features
        )
        
        # Get set of items the user already liked
        liked_items = set()
        if filter_liked and interactions is not None:
            liked_items = {
                self.item_id_map[e] 
                for u, e, v in interactions 
                if u == user_id and v == 1 and e in self.item_id_map
            }
        
        # Get recommendations (skipping already liked items)
        recommendations = []
        for idx in np.argsort(-scores):
            if not filter_liked or idx not in liked_items:
                item_id = self.internal_to_item[idx]
                recommendations.append((item_id, float(scores[idx])))
                if len(recommendations) >= top_n:
                    break
        
        return recommendations
