import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, SafeAreaView, Animated, TouchableOpacity, ScrollView } from 'react-native';
import Swiper from 'react-native-deck-swiper';
import MainFooter from './MainFooter';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');
const FOOTER_HEIGHT = 80;
const TOP_BUTTONS_HEIGHT = 60; // Space for top buttons
const ACTION_BUTTONS_HEIGHT = 80; // Space for action buttons

interface EventCard {
  id: number;
  title: string;
  image: any;
  description: string;
  date: string;
  location: string;
}

const EVENTS: EventCard[] = [
  { 
    id: 1, 
    title: 'Live Concert', 
    image: require('../assets/images/balloons.png'),
    description: 'Join us for an unforgettable night of live music featuring top artists from around the world. Experience the energy of a live performance in an intimate setting.',
    date: 'June 15, 2024',
    location: 'Central Park Amphitheater'
  },
  { 
    id: 2, 
    title: 'Rooftop Party', 
    image: require('../assets/images/balloons.png'),
    description: 'Dance the night away under the stars at our exclusive rooftop party. Featuring top DJs, signature cocktails, and breathtaking city views.',
    date: 'June 20, 2024',
    location: 'Sky Lounge Rooftop'
  },
  { 
    id: 3, 
    title: 'Comedy Night', 
    image: require('../assets/images/balloons.png'),
    description: 'Laugh your heart out with some of the best comedians in town. A night filled with humor, good vibes, and great company.',
    date: 'June 25, 2024',
    location: 'Comedy Cellar'
  },
  // Add more events as needed
];

export default function SuggestedEvents() {
  const [cardIndex, setCardIndex] = useState(0);
  const [expandedCard, setExpandedCard] = useState<EventCard | null>(null);
  const swipeX = useRef(new Animated.Value(0)).current;
  const swiperRef = useRef<Swiper<EventCard>>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  const interpolateColor = swipeX.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ['#FFE5E5', '#FFFFFF', '#E5FFE5'],
  });

  const handleCardPress = (card: EventCard) => {
    setExpandedCard(card);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleBackPress = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setExpandedCard(null);
    });
  };

  if (expandedCard) {
    return (
      <SafeAreaView style={styles.container}>
        <Animated.View style={[styles.expandedCard, { opacity: fadeAnim }]}>
          <Image source={expandedCard.image} style={styles.expandedImage} />
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <ScrollView style={styles.expandedContent}>
            <Text style={styles.expandedTitle}>{expandedCard.title}</Text>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={20} color="#666" />
              <Text style={styles.infoText}>{expandedCard.date}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={20} color="#666" />
              <Text style={styles.infoText}>{expandedCard.location}</Text>
            </View>
            <Text style={styles.description}>{expandedCard.description}</Text>
          </ScrollView>
        </Animated.View>
        <Animated.View style={[styles.actionButtons, { opacity: fadeAnim }]}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.nopeButton]}
            onPress={() => swiperRef.current?.swipeLeft()}
          >
            <Ionicons name="close" size={32} color="red" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, styles.likeButton]}
            onPress={() => swiperRef.current?.swipeRight()}
          >
            <Ionicons name="heart" size={32} color="green" />
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topButtons}>
        <TouchableOpacity style={styles.topButton}>
          <LinearGradient
            colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            locations={[0, 0.3, 0.7, 1]}
            style={styles.gradientButton}
          >
            <Ionicons name="heart" size={24} color="white" />
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={styles.topButton}>
          <LinearGradient
            colors={['#FF6B6B', '#FF1493', '#B388EB', '#FF6B6B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            locations={[0, 0.3, 0.7, 1]}
            style={styles.gradientButton}
          >
            <Ionicons name="filter" size={24} color="white" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
      

      {/* Reduced height swiper container */}
      <View style={styles.swiperContainer}>
        <Swiper
          ref={swiperRef}
          cards={EVENTS}
          cardIndex={cardIndex}
          renderCard={(card: EventCard, index: number) => {
            const isTopCard = index === cardIndex;
            return (
              <TouchableOpacity 
                onPress={() => handleCardPress(card)}
                activeOpacity={1}
              >
                <Animated.View style={[
                  styles.card,
                  isTopCard ? { backgroundColor: interpolateColor } : { backgroundColor: '#FFFFFF' }
                ]}>
                  <Image source={card.image} style={styles.image} />
                  <Text style={styles.title}>{card.title}</Text>
                </Animated.View>
              </TouchableOpacity>
            );
          }}
          onSwipedLeft={() => setCardIndex((i) => i + 1)}
          onSwipedRight={() => setCardIndex((i) => i + 1)}
          onSwiping={(x) => swipeX.setValue(x)}
          backgroundColor="transparent"
          stackSize={3}
          stackSeparation={15}
          overlayLabels={{
            left: {
              style: { 
                label: { color: 'red', fontSize: 32, fontWeight: 'bold' }, 
                wrapper: { 
                  flexDirection: 'column', 
                  alignItems: 'flex-end', 
                  justifyContent: 'flex-start', 
                  marginTop: 30, 
                  marginLeft: -30 
                } 
              }
            },
            right: {
              style: { 
                label: { color: 'green', fontSize: 32, fontWeight: 'bold' }, 
                wrapper: { 
                  flexDirection: 'column', 
                  alignItems: 'flex-start', 
                  justifyContent: 'flex-start', 
                  marginTop: 30, 
                  marginLeft: 30 
                } 
              }
            }
          }}
          disableTopSwipe
          disableBottomSwipe
          pointerEvents="box-none"
          useViewOverflow={false}
        />
      </View>

      <Animated.View style={[styles.actionButtons]}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.nopeButton]}
            onPress={() => swiperRef.current?.swipeLeft()}
          >
            <Ionicons name="close" size={32} color="red" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, styles.likeButton]}
            onPress={() => swiperRef.current?.swipeRight()}
          >
            <Ionicons name="heart" size={32} color="green" />
          </TouchableOpacity>
        </Animated.View>
      

      <View style={styles.footerContainer}>
        <MainFooter />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  swiperContainer: {
    width: '95%',
    // Reduced height by calculating remaining space and taking less of it
    height: height - FOOTER_HEIGHT - TOP_BUTTONS_HEIGHT - ACTION_BUTTONS_HEIGHT - 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: TOP_BUTTONS_HEIGHT, // Add margin to account for top buttons
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: FOOTER_HEIGHT,
    zIndex: 10, // Ensure footer is above swiper
  },
  card: {
    width: width * 0.85,
    // Reduce card height to be proportional to the container
    height: height * 0.5, // Reduced from 0.6
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'flex-end',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    paddingBottom: 32,
  },
  image: {
    width: '100%',
    height: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    resizeMode: 'cover',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
    marginTop: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 40,
    marginBottom: 20, // Reduced from 40
    marginTop: -20, // Reduced from -40
    zIndex: 10
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  nopeButton: {
    borderColor: 'red',
    borderWidth: 2,
  },
  likeButton: {
    borderColor: 'green',
    borderWidth: 2,
  },
  topButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 10,
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topButton: {
    width: 50,
    height: 50,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  gradientButton: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedCard: {
    flex: 1,
    backgroundColor: '#fff',
  },
  expandedImage: {
    width: '100%',
    height: height * 0.4,
    resizeMode: 'cover',
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  expandedContent: {
    flex: 1,
    padding: 20,
  },
  expandedTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 10,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    marginTop: 20,
  },
});