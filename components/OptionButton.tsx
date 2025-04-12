import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ViewStyle, 
  TextStyle,
  View
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface OptionButtonProps {
  title: string;
  subtitle?: string;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  selected?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
}

export default function OptionButton({
  title,
  subtitle,
  onPress,
  style,
  textStyle,
  selected = false,
  icon
}: OptionButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        selected && styles.selectedButton,
        style
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {icon && (
        <View style={styles.iconContainer}>
          <MaterialIcons 
            name={icon} 
            size={24} 
            color={selected ? '#fff' : '#3498db'} 
          />
        </View>
      )}
      <View style={styles.textContainer}>
        <Text 
          style={[
            styles.title,
            selected && styles.selectedTitle,
            textStyle
          ]}
        >
          {title}
        </Text>
        {subtitle && (
          <Text 
            style={[
              styles.subtitle,
              selected && styles.selectedSubtitle
            ]}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {selected && (
        <MaterialIcons 
          name="check-circle" 
          size={24} 
          color="#fff" 
          style={styles.checkIcon}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedButton: {
    backgroundColor: '#3498db',
  },
  iconContainer: {
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  selectedTitle: {
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  selectedSubtitle: {
    color: '#e6f2ff',
  },
  checkIcon: {
    marginLeft: 8,
  },
});