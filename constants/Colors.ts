/**
 * Unified color system for What's Poppin app
 * This provides consistent colors across all components in both light and dark modes
 */

// Brand colors - consistent across light and dark modes
const brandColors = {
  primary: '#FF0005',        // Main red - used for CTAs, primary actions
  primaryLight: '#FF3366',   // Lighter red - for hover states, secondary actions
  primaryDark: '#E60000',    // Darker red - for pressed states
  
  secondary: '#9E95BD',      // Purple - used for accents, icons, secondary elements
  secondaryLight: '#B8AECC', // Light purple - for subtle backgrounds
  secondaryDark: '#8B7FB5',  // Dark purple - for pressed states
  
  accent: '#FF69E2',         // Pink accent - for highlights, special elements
  
  success: '#4CAF50',        // Green - for success states
  warning: '#FFC107',        // Yellow - for warnings
  error: '#f44336',          // Red - for errors
  info: '#2196F3',           // Blue - for info
};

// Gradient combinations
const gradients = {
  primary: [brandColors.primary, brandColors.primaryLight],
  secondary: [brandColors.secondary, brandColors.secondaryLight], 
  sunset: [brandColors.primary, brandColors.accent],
  rainbow: ['#FF0005', '#FF4D9D', '#FF69E2', '#B97AFF', '#9E95BD'],
};

const tintColorLight = brandColors.secondary;
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: brandColors.primary,
    card: '#f8f9fa',
    
    // Brand colors
    primary: brandColors.primary,
    primaryLight: brandColors.primaryLight,
    primaryDark: brandColors.primaryDark,
    secondary: brandColors.secondary,
    secondaryLight: brandColors.secondaryLight,
    secondaryDark: brandColors.secondaryDark,
    accent: brandColors.accent,
    
    // Status colors
    success: brandColors.success,
    warning: brandColors.warning,
    error: brandColors.error,
    info: brandColors.info,
    
    // UI colors
    border: 'rgba(0,0,0,0.1)',
    overlay: 'rgba(0,0,0,0.5)',
    shadow: 'rgba(0,0,0,0.1)',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: brandColors.primaryLight,
    card: '#1c1f21',
    
    // Brand colors (slightly adjusted for dark mode)
    primary: brandColors.primaryLight,
    primaryLight: brandColors.accent,
    primaryDark: brandColors.primary,
    secondary: brandColors.secondaryLight,
    secondaryLight: brandColors.secondaryDark,
    secondaryDark: brandColors.secondary,
    accent: brandColors.accent,
    
    // Status colors
    success: brandColors.success,
    warning: brandColors.warning,
    error: brandColors.error,
    info: brandColors.info,
    
    // UI colors
    border: 'rgba(255,255,255,0.1)',
    overlay: 'rgba(0,0,0,0.7)',
    shadow: 'rgba(0,0,0,0.3)',
  },
};

// Export gradients for easy access
export { gradients };

// Export brand colors for components that need direct access
export { brandColors };
