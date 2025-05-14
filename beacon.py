from lightfm import LightFM
from lightfm.data import Dataset
import numpy as np
import random

class BeaconAI:
    def __init__(self):
        self.dataset = Dataset()
        self.model = LightFM(loss='warp')
        self.user_id_map = {}
        self.item_id_map = {}

    def fit_data(self, users, events, user_features, event_features, interactions):
        print(f"Debug: Total events before fitting: {len(events)}")

        # Collect unique feature tags
        user_feature_tags = set(f for _, feats in user_features for f in feats)
        event_feature_tags = set(f for _, feats in event_features for f in feats)

        # Fit the dataset
        self.dataset.fit(
            users=users,
            items=events,
            user_features=user_feature_tags,
            item_features=event_feature_tags
        )

        # Correct unpacking of mappings
        user_id_map, _, item_id_map, _ = self.dataset.mapping()
        self.user_id_map = user_id_map
        self.item_id_map = item_id_map

        print(f"Debug: Sample item_id_map keys: {list(self.item_id_map.keys())[:5]}")
        print(f"Debug: Total mapped events: {len(self.item_id_map)}")

        # Build user/item features
        self.user_features = self.dataset.build_user_features(user_features)
        self.item_features = self.dataset.build_item_features(event_features)

        # Keep interactions with known events
        valid_event_ids = set(events)
        clean_interactions = [(u, e, v) for u, e, v in interactions if e in valid_event_ids]

        # Build interaction matrix with positive likes
        self.interactions, _ = self.dataset.build_interactions(
            ((u, e) for u, e, val in clean_interactions if val == 1)
        )

    def train_model(self, epochs=10):
        self.model.fit(
            self.interactions,
            user_features=self.user_features,
            item_features=self.item_features,
            epochs=epochs,
            num_threads=2
        )

    def recommend_for_user(self, user_id, top_n=5):
        if user_id not in self.user_id_map:
            print(f"User {user_id} not found.")
            return []

        user_internal_id = self.user_id_map[user_id]
        print(f"Debug: User internal ID: {user_internal_id}")

        # Predict scores for all items
        num_items = len(self.item_id_map)
        item_indices = np.arange(num_items)
        scores = self.model.predict(
            user_internal_id,
            item_indices,
            user_features=self.user_features,
            item_features=self.item_features
        )

        # Reverse item map: internal_id -> actual event_id
        internal_to_event = {v: k for k, v in self.item_id_map.items()}

        # Filter out events user already liked
        liked_events = {e for u, e, v in interactions if u == user_id and v == 1}
        liked_internal_ids = {self.item_id_map[e] for e in liked_events if e in self.item_id_map}

        # Recommend top N events not already liked
        recommendations = []
        for idx in np.argsort(-scores):
            if idx not in liked_internal_ids:
                event_id = internal_to_event[idx]
                recommendations.append((event_id, scores[idx]))
                if len(recommendations) >= top_n:
                    break

        return recommendations


if __name__ == '__main__':
    # Set seed for reproducibility
    random.seed(42)
    np.random.seed(42)

    # Generate users and events
    num_users = 30
    num_events = 50
    users = [f'user{i+1}' for i in range(num_users)]
    events = [f'event{i+1}' for i in range(num_events)]

    # Define feature pools
    age_groups = ['18-24', '25-34', '35-49', '50-99']
    pref_times = ['weekends', 'weeknights', 'weekdays']
    event_types = ['concerts', 'clubs', 'school events', 'restaurants']
    time_tags = ['morning', 'evening', 'night', 'weekend']
    locations = ['downtown', 'uptown', 'midtown']

    # Assign random features to users and events
    user_features = [
        (user, [random.choice(event_types), random.choice(age_groups), random.choice(pref_times)])
        for user in users
    ]
    event_features = [
        (event, [random.choice(event_types), random.choice(time_tags), random.choice(locations)])
        for event in events
    ]

    # Simulate user-event likes
    interactions = []
    for user in users:
        liked_events = random.sample(events, random.randint(3, 6))
        for event in liked_events:
            interactions.append((user, event, 1))

    # Train recommender
    rec = EventRecommender()
    rec.fit_data(users, events, user_features, event_features, interactions)
    rec.train_model()

    # Evaluate for a specific user
    target_user = 'user7'
    user_feats = [feats for uid, feats in user_features if uid == target_user]
    print(f"\n{target_user} Features:\n{user_feats[0] if user_feats else 'User not found'}")

    liked = [e for u, e, v in interactions if u == target_user and v == 1]
    print(f"\n{target_user} previously liked {len(liked)} event(s):\n{liked}")

    print("\nFeatures of Liked Events:")
    for eid, feats in event_features:
        if eid in liked:
            print(f"{eid}: {feats}")

    print("\nTop 5 Recommended Events:")
    recommendations = rec.recommend_for_user(target_user, top_n=5)
    for eid, score in recommendations:
        print(f"{eid} (score: {score:.4f})")

    print("\nFeatures of Recommended Events:")
    for eid, feats in event_features:
        if eid in [x[0] for x in recommendations]:
            print(f"{eid}: {feats}")
