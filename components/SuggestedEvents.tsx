import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, SafeAreaView } from 'react-native';
import Swiper from 'react-native-deck-swiper';
import MainFooter from './MainFooter';
const { width, height } = Dimensions.get('window');

const EVENTS = [
  { id: 1, title: 'Live Concert', image: require('../assets/images/balloons.png') },
  { id: 2, title: 'Rooftop Party', image: require('../assets/images/balloons.png') },
  { id: 3, title: 'Comedy Night', image: require('../assets/images/balloons.png') },
  // Add more events as needed
];

export default function SuggestedEvents() {
  const [cardIndex, setCardIndex] = useState(0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ marginTop: 40, width: '95%', alignItems: 'center' }}>
        <Swiper
          cards={EVENTS}
          cardIndex={cardIndex}
          renderCard={(card: { id: number; title: string; image: any }) => (
            <View style={styles.card}>
              <Image source={card.image} style={styles.image} />
              <Text style={styles.title}>{card.title}</Text>
            </View>
          )}
          onSwipedLeft={() => setCardIndex((i) => i + 1)}
          onSwipedRight={() => setCardIndex((i) => i + 1)}
          backgroundColor="transparent"
          stackSize={3}
          stackSeparation={15}
          overlayLabels={{
            left: {
              title: 'NOPE',
              style: { label: { color: 'red', fontSize: 32, fontWeight: 'bold' }, wrapper: { flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-start', marginTop: 30, marginLeft: -30 } }
            },
            right: {
              title: 'LIKE',
              style: { label: { color: 'green', fontSize: 32, fontWeight: 'bold' }, wrapper: { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', marginTop: 30, marginLeft: 30 } }
            }
          }}
          disableTopSwipe
          disableBottomSwipe
        />
      </View>
      <MainFooter />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingTop: 40,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#222',
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
});
