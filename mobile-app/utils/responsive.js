import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base dimensions (iPhone 12/13/14 - 390x844)
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

// Responsive width calculation
export const wp = (percentage) => {
  return (SCREEN_WIDTH * percentage) / 100;
};

// Responsive height calculation
export const hp = (percentage) => {
  return (SCREEN_HEIGHT * percentage) / 100;
};

// Responsive font size
export const fp = (size) => {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// Responsive padding/margin
export const rp = (size) => {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  return Math.round(PixelRatio.roundToNearestPixel(size * scale));
};

// Device type detection
export const isTablet = () => {
  return SCREEN_WIDTH >= 768;
};

export const isSmallDevice = () => {
  return SCREEN_WIDTH < 375;
};

export const isLargeDevice = () => {
  return SCREEN_WIDTH > 414;
};

// Screen dimensions
export const screenWidth = SCREEN_WIDTH;
export const screenHeight = SCREEN_HEIGHT;

// Common responsive values
export const responsive = {
  // Font sizes
  fontSize: {
    xs: fp(10),
    sm: fp(12),
    base: fp(14),
    lg: fp(16),
    xl: fp(18),
    '2xl': fp(20),
    '3xl': fp(24),
    '4xl': fp(28),
    '5xl': fp(32),
  },
  
  // Spacing
  spacing: {
    xs: rp(4),
    sm: rp(8),
    base: rp(12),
    lg: rp(16),
    xl: rp(20),
    '2xl': rp(24),
    '3xl': rp(32),
    '4xl': rp(40),
    '5xl': rp(48),
  },
  
  // Border radius
  borderRadius: {
    sm: rp(4),
    base: rp(8),
    lg: rp(12),
    xl: rp(16),
    '2xl': rp(20),
    full: rp(999),
  },
  
  // Icon sizes
  iconSize: {
    sm: rp(16),
    base: rp(20),
    lg: rp(24),
    xl: rp(28),
    '2xl': rp(32),
    '3xl': rp(36),
  },
  
  // Button heights
  buttonHeight: {
    sm: rp(32),
    base: rp(40),
    lg: rp(48),
    xl: rp(56),
  },
  
  // Card dimensions
  card: {
    padding: rp(16),
    margin: rp(8),
    borderRadius: rp(12),
  },
  
  // Header heights
  header: {
    height: rp(60),
    paddingHorizontal: rp(20),
  },
  
  // Tab bar
  tabBar: {
    height: rp(60),
    paddingBottom: rp(5),
  },
};
