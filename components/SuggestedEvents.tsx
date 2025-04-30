import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, SafeAreaView, Animated, TouchableOpacity } from 'react-native';
import Swiper from 'react-native-deck-swiper';
import MainFooter from './MainFooter';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');
const FOOTER_HEIGHT = 80;

interface EventCard {
  id: number;
  title: string;
  image: any;
}

const EVENTS: EventCard[] = [
  { id: 1, title: 'Live Concert', image: require('../assets/images/balloons.png') },
  { id: 2, title: 'Rooftop Party', image: require('../assets/images/balloons.png') },
  { id: 3, title: 'Comedy Night', image: require('../assets/images/balloons.png') },
  // Add more events as needed
];

export default function SuggestedEvents() {
  const [cardIndex, setCardIndex] = useState(0);
  const swipeX = useRef(new Animated.Value(0)).current;
  const swiperRef = useRef<Swiper<EventCard>>(null);
  
  const interpolateColor = swipeX.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ['#FFE5E5', '#FFFFFF', '#E5FFE5'],
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.swiperContainer}>
        <Swiper
          ref={swiperRef}
          cards={EVENTS}
          cardIndex={cardIndex}
          renderCard={(card: EventCard, index: number) => {
            // The card at cardIndex is the one being swiped
            const isTopCard = index === cardIndex;
            return (
              <Animated.View style={[
                styles.card,
                isTopCard ? { backgroundColor: interpolateColor } : { backgroundColor: '#FFFFFF' }
              ]}>
                <Image source={card.image} style={styles.image} />
                <Text style={styles.title}>{card.title}</Text>
              </Animated.View>
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

      <View style={styles.actionButtons}>
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
      </View>
      
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
    height: height - FOOTER_HEIGHT - 100, // Leave space for footer
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
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
    height: height * 0.6,
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
    marginBottom: 40,
    marginTop: -40,
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
});
