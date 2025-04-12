import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ViewStyle, 
  TextStyle,
  ActivityIndicator
} from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
  loading?: boolean;
  primary?: boolean;
  secondary?: boolean;
  outline?: boolean;
}

export default function Button({
  title,
  onPress,
  style,
  textStyle,
  disabled = false,
  loading = false,
  primary = false,
  secondary = false,
  outline = false
}: ButtonProps) {
  
  let buttonStyle: ViewStyle[] = [styles.button];
  let buttonTextStyle: TextStyle[] = [styles.buttonText];
  
  if (primary) {
    buttonStyle.push(styles.primaryButton);
    buttonTextStyle.push(styles.primaryButtonText);
  } else if (secondary) {
    buttonStyle.push(styles.secondaryButton);
    buttonTextStyle.push(styles.secondaryButtonText);
  } else if (outline) {
    buttonStyle.push(styles.outlineButton);
    buttonTextStyle.push(styles.outlineButtonText);
  }
  
  if (disabled) {
    buttonStyle.push(styles.disabledButton);
    buttonTextStyle.push(styles.disabledButtonText);
  }
  
  return (
    <TouchableOpacity
      style={[...buttonStyle, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={outline ? '#3498db' : '#fff'} />
      ) : (
        <Text style={[...buttonTextStyle, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#3498db',
  },
  primaryButtonText: {
    color: '#fff',
  },
  secondaryButton: {
    backgroundColor: '#2ecc71',
  },
  secondaryButtonText: {
    color: '#fff',
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3498db',
  },
  outlineButtonText: {
    color: '#3498db',
  },
  disabledButton: {
    backgroundColor: '#bdc3c7',
    opacity: 0.7,
  },
  disabledButtonText: {
    color: '#7f8c8d',
  },
});