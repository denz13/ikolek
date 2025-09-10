import React, { useContext } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import UserSchedules from "./UserSchedules";
import UserSettings from "./UserSettings";
import UsersCollection from "./UsersCollection";
import Reports from "./Reports";
import UsersDashboard from "./UsersDashboard";
import { ThemeContext } from "./ThemeContext";

const Tab = createBottomTabNavigator();

export default function UsersTabs({ route }) {
  const { isDarkMode } = useContext(ThemeContext);
  const { uid, userId } = route.params || {};

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: isDarkMode ? "#90ee90" : "#146c43",
        tabBarInactiveTintColor: isDarkMode ? "#888" : "gray",
        tabBarStyle: {
          backgroundColor: isDarkMode ? "#1E1E1E" : "#fff",
          borderTopColor: isDarkMode ? "#333" : "#ccc",
          paddingBottom: 5,
          height: 60,
        },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName = "ellipse-outline"; // safe default
          if (route.name === "Home") iconName = focused ? "home" : "home-outline";
          else if (route.name === "Schedules") iconName = focused ? "calendar" : "calendar-outline";
          else if (route.name === "Collection") iconName = focused ? "albums" : "albums-outline";
          else if (route.name === "Reports") iconName = focused ? "document-text" : "document-text-outline";
          else if (route.name === "Settings") iconName = focused ? "settings" : "settings-outline";
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarHideOnKeyboard: true,
      })}
    >
      <Tab.Screen name="Home" component={UsersDashboard} initialParams={{ uid, userId }} />
      <Tab.Screen name="Schedules" component={UserSchedules} initialParams={{ uid, userId }} />
      <Tab.Screen name="Collection" component={UsersCollection} initialParams={{ uid, userId }} />
      <Tab.Screen name="Reports" component={Reports} initialParams={{ uid, userId }} />
      <Tab.Screen name="Settings" component={UserSettings} initialParams={{ uid, userId }} />
    </Tab.Navigator>
  );
}
