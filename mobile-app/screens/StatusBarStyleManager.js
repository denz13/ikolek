// StatusBarStyleManager.js
import React, { useCallback, useEffect } from 'react';
import { StatusBar, Platform, AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

export default function StatusBarStyleManager({ backgroundColor, barStyle = 'light-content' }) {
  const applyStatusBar = useCallback(() => {
    StatusBar.setBarStyle(barStyle);
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor(backgroundColor);
      StatusBar.setTranslucent(false);
    }
  }, [barStyle, backgroundColor]);

  // Reapply when screen comes into focus
  useFocusEffect(applyStatusBar);

  // Reapply when app returns to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        applyStatusBar();
      }
    });
    return () => subscription.remove();
  }, [applyStatusBar]);

  return null;
}
