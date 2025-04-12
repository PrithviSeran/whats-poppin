import { Event, EventType } from '../types';

export const mockEvents: Event[] = [
  // Restaurants
  {
    id: '1',
    name: 'Bella Italia',
    type: 'restaurant',
    description: 'Authentic Italian cuisine in a cozy atmosphere',
    location: 'Downtown',
    time: '5:00 PM - 11:00 PM',
    price: '$$',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4',
    tags: ['italian', 'pasta', 'pizza', 'romantic'],
    capacity: 60,
    cuisine: 'Italian',
    dietaryOptions: ['vegetarian', 'gluten-free']
  },
  {
    id: '2',
    name: 'Sushi Delight',
    type: 'restaurant',
    description: 'Fresh sushi and Japanese specialties',
    location: 'Midtown',
    time: '4:30 PM - 10:30 PM',
    price: '$$$',
    image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c',
    tags: ['japanese', 'sushi', 'seafood'],
    capacity: 40,
    cuisine: 'Japanese',
    dietaryOptions: ['vegetarian', 'gluten-free', 'vegan']
  },
  {
    id: '3',
    name: 'Veggie Haven',
    type: 'restaurant',
    description: 'Plant-based dishes that will satisfy everyone',
    location: 'Westside',
    time: '11:00 AM - 9:00 PM',
    price: '$$',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd',
    tags: ['vegan', 'healthy', 'organic'],
    capacity: 35,
    cuisine: 'Vegan',
    dietaryOptions: ['vegetarian', 'gluten-free', 'vegan', 'dairy-free']
  },
  
  // Clubs
  {
    id: '4',
    name: 'Pulse Nightclub',
    type: 'club',
    description: 'The hottest electronic music and dance floor in town',
    location: 'Downtown',
    time: '10:00 PM - 4:00 AM',
    price: '$$$',
    image: 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67',
    tags: ['electronic', 'dance', 'nightlife'],
    musicGenre: 'Electronic',
    ageRestriction: '21+',
    dresscode: 'Smart casual'
  },
  {
    id: '5',
    name: 'Retro Groove',
    type: 'club',
    description: '80s and 90s hits all night long',
    location: 'Eastside',
    time: '9:00 PM - 3:00 AM',
    price: '$$',
    image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745',
    tags: ['retro', '80s', '90s', 'dance'],
    musicGenre: 'Retro',
    ageRestriction: '21+',
    dresscode: 'Casual'
  },
  
  // Bars
  {
    id: '6',
    name: 'Craft & Draft',
    type: 'bar',
    description: 'Specialty craft beers and cocktails',
    location: 'Downtown',
    time: '4:00 PM - 2:00 AM',
    price: '$$',
    image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b',
    tags: ['craft beer', 'cocktails', 'casual'],
    ageRestriction: '21+'
  },
  {
    id: '7',
    name: 'Whiskey & Blues',
    type: 'bar',
    description: 'Premium whiskeys with live blues music',
    location: 'Midtown',
    time: '6:00 PM - 1:00 AM',
    price: '$$$',
    image: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187',
    tags: ['whiskey', 'blues', 'live music'],
    musicGenre: 'Blues',
    ageRestriction: '21+'
  },
  
  // Parties
  {
    id: '8',
    name: 'Rooftop Summer Party',
    type: 'party',
    description: 'Summer vibes with DJ sets and amazing city views',
    location: 'Downtown Rooftop',
    time: '8:00 PM - 2:00 AM',
    price: '$$',
    image: 'https://images.unsplash.com/photo-1496337589254-7e19d01cec44',
    tags: ['rooftop', 'summer', 'DJ'],
    musicGenre: 'Mixed',
    ageRestriction: '21+',
    dresscode: 'Summer chic'
  },
  {
    id: '9',
    name: 'Warehouse Rave',
    type: 'party',
    description: 'Underground electronic music in a converted warehouse',
    location: 'Industrial District',
    time: '11:00 PM - 6:00 AM',
    price: '$$',
    image: 'https://images.unsplash.com/photo-1574391884720-bbc3740c59d1',
    tags: ['rave', 'electronic', 'underground'],
    musicGenre: 'Techno',
    ageRestriction: '21+',
    dresscode: 'Casual'
  },
  
  // Sports
  {
    id: '10',
    name: 'Pickup Basketball',
    type: 'sports',
    description: 'Casual basketball games for all skill levels',
    location: 'Community Center',
    time: '7:00 PM - 10:00 PM',
    price: '$',
    image: 'https://images.unsplash.com/photo-1546519638-68e109498ffc',
    tags: ['basketball', 'casual', 'pickup'],
    sportType: 'Basketball'
  },
  {
    id: '11',
    name: 'Evening Yoga in the Park',
    type: 'sports',
    description: 'Relaxing yoga session under the stars',
    location: 'Central Park',
    time: '7:30 PM - 8:30 PM',
    price: '$',
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b',
    tags: ['yoga', 'relaxation', 'outdoors'],
    sportType: 'Yoga'
  },
  {
    id: '12',
    name: 'Indoor Soccer League',
    type: 'sports',
    description: 'Competitive 5v5 indoor soccer matches',
    location: 'Sports Complex',
    time: '6:00 PM - 11:00 PM',
    price: '$$',
    image: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d',
    tags: ['soccer', 'competitive', 'indoor'],
    sportType: 'Soccer'
  },
  
  // Concerts
  {
    id: '13',
    name: 'Jazz Night',
    type: 'concert',
    description: 'Live jazz performances by local artists',
    location: 'Jazz Club',
    time: '8:00 PM - 11:00 PM',
    price: '$$',
    image: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae',
    tags: ['jazz', 'live music', 'intimate'],
    musicGenre: 'Jazz'
  },
  {
    id: '14',
    name: 'Rock Festival',
    type: 'concert',
    description: 'Multiple rock bands performing live',
    location: 'Outdoor Venue',
    time: '5:00 PM - 11:00 PM',
    price: '$$$',
    image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3',
    tags: ['rock', 'festival', 'outdoor'],
    musicGenre: 'Rock',
    ageRestriction: '18+'
  },
  
  // Theater
  {
    id: '15',
    name: 'Comedy Night',
    type: 'theater',
    description: 'Stand-up comedy performances by top comedians',
    location: 'Comedy Club',
    time: '8:00 PM - 10:00 PM',
    price: '$$',
    image: 'https://images.unsplash.com/photo-1527224857830-43a7acc85260',
    tags: ['comedy', 'stand-up', 'entertainment'],
    ageRestriction: '18+'
  },
  {
    id: '16',
    name: 'Shakespeare in the Park',
    type: 'theater',
    description: 'Outdoor performance of a Shakespeare classic',
    location: 'Central Park',
    time: '7:00 PM - 9:30 PM',
    price: '$',
    image: 'https://images.unsplash.com/photo-1503095396549-807759245b35',
    tags: ['shakespeare', 'theater', 'outdoor'],
    dresscode: 'Casual'
  }
];