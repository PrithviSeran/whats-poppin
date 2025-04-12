import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  View 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface CheckboxOptionProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
}

export default function CheckboxOption({ 
  label, 
  checked, 
  onToggle 
}: CheckboxOptionProps) {
  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={[styles.checkbox, checked && styles.checkedBox]}>
        {checked && (
          <MaterialIcons name="check" size={16} color="#fff" />
        )}
      </View>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#3498db',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedBox: {
    backgroundColor: '#3498db',
  },
  label: {
    fontSize: 16,
    color: '#333',
  },
});