export type EventType = 'restaurant' | 'club' | 'bar' | 'party' | 'sports' | 'concert' | 'theater' | 'other';

export interface Event {
  id: string;
  name: string;
  type: EventType;
  description: string;
  location: string;
  time: string;
  price: string;
  image: string;
  tags: string[];
  capacity?: number;
  cuisine?: string;
  musicGenre?: string;
  sportType?: string;
  ageRestriction?: string;
  dietaryOptions?: string[];
  dresscode?: string;
}

export interface UserPreferences {
  eventType: EventType;
  partySize?: number;
  dietaryRestrictions?: string[];
  priceRange?: string;
  location?: string;
  musicPreference?: string;
  sportPreference?: string;
  dresscode?: string;
  ageGroup?: string;
}