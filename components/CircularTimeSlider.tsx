import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { PanGestureHandler, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path, G, Text as SvgText } from 'react-native-svg';

const { width } = Dimensions.get('window');
const CIRCLE_SIZE = width * 0.7;
const CENTER = CIRCLE_SIZE / 2;
const RADIUS = CENTER - 40;
const HANDLE_SIZE = 24;
const TRACK_WIDTH = 8;

interface CircularTimeSliderProps {
  startTime: number; // in minutes from midnight
  endTime: number;   // in minutes from midnight
  onTimeChange: (startTime: number, endTime: number) => void;
}

export default function CircularTimeSlider({ startTime, endTime, onTimeChange }: CircularTimeSliderProps) {
  const colorScheme = useColorScheme();
  const [activeHandle, setActiveHandle] = useState<'start' | 'end' | null>(null);

  // Convert minutes to angle (0-360 degrees, where 0/360 is 12 AM at top)
  const minutesToAngle = (minutes: number): number => {
    return (minutes / 1440) * 360;
  };

  // Convert angle to minutes
  const angleToMinutes = (angle: number): number => {
    const normalizedAngle = ((angle % 360) + 360) % 360;
    return Math.round((normalizedAngle / 360) * 1440);
  };

  // Convert angle to X,Y coordinates on circle
  const angleToCoords = (angle: number): { x: number; y: number } => {
    const radians = (angle - 90) * (Math.PI / 180); // -90 to start at top
    return {
      x: CENTER + RADIUS * Math.cos(radians),
      y: CENTER + RADIUS * Math.sin(radians),
    };
  };

  // Convert touch coordinates to angle
  const coordsToAngle = (x: number, y: number): number => {
    const dx = x - CENTER;
    const dy = y - CENTER;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90; // +90 to start at top
    return ((angle % 360) + 360) % 360; // Normalize to 0-360
  };

  // Check if touch is near a handle
  const isNearHandle = (touchX: number, touchY: number, handleX: number, handleY: number): boolean => {
    const distance = Math.sqrt(Math.pow(touchX - handleX, 2) + Math.pow(touchY - handleY, 2));
    return distance <= HANDLE_SIZE * 1.5; // Larger touch area for easier interaction
  };

  // Format minutes to time string
  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
  };



  // Handle drag gestures
  const handleGestureStart = (event: any) => {
    const { x, y } = event.nativeEvent;
    
    // Determine which handle to move based on touch position
    const distanceToStart = Math.sqrt(
      Math.pow(x - startCoords.x, 2) + Math.pow(y - startCoords.y, 2)
    );
    const distanceToEnd = Math.sqrt(
      Math.pow(x - endCoords.x, 2) + Math.pow(y - endCoords.y, 2)
    );
    
    if (isNearHandle(x, y, startCoords.x, startCoords.y)) {
      setActiveHandle('start');
    } else if (isNearHandle(x, y, endCoords.x, endCoords.y)) {
      setActiveHandle('end');
    }
  };

  const handleGestureEvent = (event: any) => {
    const { x, y } = event.nativeEvent;
    
    if (activeHandle) {
      // Update time based on drag position
      const angle = coordsToAngle(x, y);
      const newMinutes = angleToMinutes(angle);

      if (activeHandle === 'start') {
        onTimeChange(newMinutes, endTime);
      } else {
        onTimeChange(startTime, newMinutes);
      }
    }
  };

  const handleGestureEnd = () => {
    setActiveHandle(null);
  };

  const startAngle = minutesToAngle(startTime);
  const endAngle = minutesToAngle(endTime);
  const startCoords = angleToCoords(startAngle);
  const endCoords = angleToCoords(endAngle);

  // Create arc path for the selected time range
  const createArcPath = (): string => {
    const startRadians = (startAngle - 90) * (Math.PI / 180);
    const endRadians = (endAngle - 90) * (Math.PI / 180);
    
    const startX = CENTER + RADIUS * Math.cos(startRadians);
    const startY = CENTER + RADIUS * Math.sin(startRadians);
    const endX = CENTER + RADIUS * Math.cos(endRadians);
    const endY = CENTER + RADIUS * Math.sin(endRadians);

    let angleDiff = endAngle - startAngle;
    if (angleDiff < 0) angleDiff += 360;
    
    const largeArcFlag = angleDiff > 180 ? 1 : 0;

    return `M ${startX} ${startY} A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
  };

  // Generate hour labels around the circle
  const hourLabels = [];
  for (let hour = 0; hour < 24; hour += 6) {
    const angle = (hour / 24) * 360;
    const labelRadius = RADIUS + 25;
    const labelRadians = (angle - 90) * (Math.PI / 180);
    const labelX = CENTER + labelRadius * Math.cos(labelRadians);
    const labelY = CENTER + labelRadius * Math.sin(labelRadians);
    
    const displayHour = hour === 0 ? '12AM' : hour === 12 ? '12PM' : 
                       hour < 12 ? `${hour}AM` : `${hour - 12}PM`;
    
    hourLabels.push(
      <SvgText
        key={hour}
        x={labelX}
        y={labelY + 4}
        fontSize="12"
        fill={Colors[colorScheme ?? 'light'].text}
        textAnchor="middle"
      >
        {displayHour}
      </SvgText>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.sliderContainer}>
        <View style={styles.timeDisplaySection}>
          <View style={styles.timeCard}>
            <View style={[styles.timeIndicator, { backgroundColor: '#FF0005' }]} />
            <View style={styles.timeContent}>
              <Text style={[styles.timeLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Start</Text>
              <Text style={[styles.timeValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                {formatTime(startTime)}
              </Text>
            </View>
          </View>
          
          <View style={styles.timeSeparator}>
            <View style={[styles.separatorLine, { backgroundColor: Colors[colorScheme ?? 'light'].text + '30' }]} />
            <Text style={[styles.separatorText, { color: Colors[colorScheme ?? 'light'].text }]}>to</Text>
            <View style={[styles.separatorLine, { backgroundColor: Colors[colorScheme ?? 'light'].text + '30' }]} />
          </View>
          
          <View style={styles.timeCard}>
            <View style={[styles.timeIndicator, { backgroundColor: '#9E95BD' }]} />
            <View style={styles.timeContent}>
              <Text style={[styles.timeLabel, { color: Colors[colorScheme ?? 'light'].text }]}>End</Text>
              <Text style={[styles.timeValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                {formatTime(endTime)}
              </Text>
            </View>
          </View>
        </View>
        
        <PanGestureHandler
          onGestureEvent={handleGestureEvent}
          onBegan={handleGestureStart}
          onEnded={handleGestureEnd}
        >
          <View style={styles.circleContainer}>
            <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
              {/* Background circle */}
              <Circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                stroke={Colors[colorScheme ?? 'light'].text + '20'}
                strokeWidth={TRACK_WIDTH}
                fill="none"
              />
              
              {/* Active time range arc */}
              <Path
                d={createArcPath()}
                stroke="#FF0005"
                strokeWidth={TRACK_WIDTH}
                fill="none"
                strokeLinecap="round"
              />
              
              {/* Hour labels */}
              <G>{hourLabels}</G>
              
              {/* Start handle */}
              <Circle
                cx={startCoords.x}
                cy={startCoords.y}
                r={activeHandle === 'start' ? HANDLE_SIZE / 1.8 : HANDLE_SIZE / 2}
                fill="#FF0005"
                stroke="white"
                strokeWidth={3}
                opacity={activeHandle === 'start' ? 0.8 : 1}
              />
              
              {/* End handle */}
              <Circle
                cx={endCoords.x}
                cy={endCoords.y}
                r={activeHandle === 'end' ? HANDLE_SIZE / 1.8 : HANDLE_SIZE / 2}
                fill="#9E95BD"
                stroke="white"
                strokeWidth={3}
                opacity={activeHandle === 'end' ? 0.8 : 1}
              />
              
              {/* Center icons */}
              {/* Moon icon at 12 AM (top) */}
              <G x={CENTER - 8} y={30}>
                <Circle cx={8} cy={8} r={8} fill={Colors[colorScheme ?? 'light'].text + '40'} />
                <SvgText x={8} y={12} fontSize="10" fill={Colors[colorScheme ?? 'light'].text} textAnchor="middle">🌙</SvgText>
              </G>
              
              {/* Sun icon at 12 PM (bottom) */}
              <G x={CENTER - 8} y={CIRCLE_SIZE - 46}>
                <Circle cx={8} cy={8} r={8} fill={Colors[colorScheme ?? 'light'].text + '40'} />
                <SvgText x={8} y={12} fontSize="10" fill={Colors[colorScheme ?? 'light'].text} textAnchor="middle">☀️</SvgText>
              </G>
            </Svg>
          </View>
        </PanGestureHandler>
        

      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderContainer: {
    alignItems: 'center',
    padding: 20,
  },
  circleContainer: {
    marginVertical: 20,
  },
  timeRangeText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  timeDisplaySection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    width: '100%',
  },
  timeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(158, 149, 189, 0.1)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  timeIndicator: {
    width: 4,
    height: 32,
    borderRadius: 2,
    marginRight: 12,
  },
  timeContent: {
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.7,
    marginBottom: 2,
  },
  timeValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  timeSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  separatorLine: {
    height: 1,
    width: 16,
  },
  separatorText: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.6,
    marginHorizontal: 8,
  },

}); 