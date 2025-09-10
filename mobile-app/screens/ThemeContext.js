import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create the context
export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Load the theme from AsyncStorage on app startup
  useEffect(() => {
    const loadTheme = async () => {
      const storedTheme = await AsyncStorage.getItem('isDarkMode');
      if (storedTheme !== null) {
        setIsDarkMode(JSON.parse(storedTheme));
      }
    };
    loadTheme();
  }, []);

  // Toggle the theme and save it to AsyncStorage
  const toggleTheme = async () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    await AsyncStorage.setItem('isDarkMode', JSON.stringify(newTheme));
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// ✅ Add this line to fix the "missing default export" issue:
export default ThemeProvider;