import { Event, UserPreferences } from '../types';
import { mockEvents } from '../data/mockEvents';

export function matchEvents(preferences: UserPreferences): Event[] {
  // First filter by event type
  let matches = mockEvents.filter(event => event.type === preferences.eventType);
  
  // Apply additional filters based on preferences
  if (preferences.eventType === 'restaurant') {
    // Filter by dietary restrictions if specified
    if (preferences.dietaryRestrictions && preferences.dietaryRestrictions.length > 0) {
      matches = matches.filter(event => {
        // Check if the restaurant has all the required dietary options
        return preferences.dietaryRestrictions?.every(restriction => 
          event.dietaryOptions?.includes(restriction)
        );
      });
    }
    
    // Filter by price range if specified
    if (preferences.priceRange) {
      matches = matches.filter(event => event.price === preferences.priceRange);
    }
    
    // Filter by cuisine if specified
    if (preferences.location) {
      matches = matches.filter(event => 
        event.location.toLowerCase().includes(preferences.location?.toLowerCase() || '')
      );
    }
  } 
  else if (preferences.eventType === 'club' || preferences.eventType === 'party') {
    // Filter by music preference if specified
    if (preferences.musicPreference) {
      matches = matches.filter(event => 
        event.musicGenre?.toLowerCase().includes(preferences.musicPreference?.toLowerCase() || '')
      );
    }
    
    // Filter by dress code if specified
    if (preferences.dresscode) {
      matches = matches.filter(event => 
        event.dresscode?.toLowerCase().includes(preferences.dresscode?.toLowerCase() || '')
      );
    }
    
    // Filter by age group if specified
    if (preferences.ageGroup) {
      matches = matches.filter(event => event.ageRestriction === preferences.ageGroup);
    }
  }
  else if (preferences.eventType === 'sports') {
    // Filter by sport preference if specified
    if (preferences.sportPreference) {
      matches = matches.filter(event => 
        event.sportType?.toLowerCase().includes(preferences.sportPreference?.toLowerCase() || '')
      );
    }
    
    // Filter by location if specified
    if (preferences.location) {
      matches = matches.filter(event => 
        event.location.toLowerCase().includes(preferences.location?.toLowerCase() || '')
      );
    }
  }
  
  // Sort matches by relevance (simplified version - just using price as a proxy)
  matches.sort((a, b) => a.price.length - b.price.length);
  
  return matches;
}