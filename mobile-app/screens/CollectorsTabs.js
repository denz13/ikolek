import React, { useContext } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import Schedules from './Schedules';
import Collection from './Collection';
import LogScreen from './LogScreen';
import Settings from './Settings';
import CollectorsDashboard from './CollectorsDashboard';
import { ThemeContext } from './ThemeContext';

const Tab = createBottomTabNavigator();

export default function CollectorsTabs({ route }) {
  const { collectorId } = route.params || {};
  const { isDarkMode } = useContext(ThemeContext);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: isDarkMode ? '#90ee90' : '#146c43',
        tabBarInactiveTintColor: isDarkMode ? '#888' : 'gray',
        tabBarStyle: {
          backgroundColor: isDarkMode ? '#1E1E1E' : '#fff',
          borderTopColor: isDarkMode ? '#333' : '#ccc',
          paddingBottom: 5,
          height: 60,
        },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName;

          if (route.name === 'Home')
            iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Schedules')
            iconName = focused ? 'calendar' : 'calendar-outline';
          else if (route.name === 'Reports')
            iconName = focused ? 'play-circle' : 'play-circle-outline';
          else if (route.name === 'Logs')
            iconName = focused ? 'document-text' : 'document-text-outline';
          else if (route.name === 'Settings')
            iconName = focused ? 'settings' : 'settings-outline';

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={CollectorsDashboard} initialParams={{ collectorId }} />
      <Tab.Screen name="Schedules" component={Schedules} initialParams={{ collectorId }} />
      <Tab.Screen name="Reports" component={Collection} initialParams={{ collectorId }} />
      <Tab.Screen name="Logs" component={LogScreen} initialParams={{ collectorId }} />
      <Tab.Screen name="Settings" component={Settings} initialParams={{ collectorId }} />
    </Tab.Navigator>
  );
}
