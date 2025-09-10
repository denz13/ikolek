import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import { ThemeProvider } from './screens/ThemeContext';
import { AuthProvider } from './screens/AuthContext';
import StatusBarStyleManager from './screens/StatusBarStyleManager';

import CollectorsLogin from './screens/CollectorsLogin';
import Settings from './screens/Settings';
import Schedules from './screens/Schedules';
import LogScreen from './screens/LogScreen';
import Collection from './screens/Collection';
import Reports from './screens/Reports';
import UsersLogin from './screens/UsersLogin';
import UsersDashboard from './screens/UsersDashboard';
import ReviewCollection from './screens/ReviewCollection';
import CollectorsTabs from './screens/CollectorsTabs';
import CollectorsDashboard from './screens/CollectorsDashboard';
import LogDetails from './screens/LogDetails';
import UsersTabs from './screens/UsersTabs';
import UsersCollection from './screens/UsersCollection';
import Map from './screens/Map';
import Notifications from './screens/Notifications';
import NotificationDetails from './screens/NotificationDetails';
import AboutUs from './screens/AboutUs';
import Hotlines from './screens/Hotlines';
import UsersNotifications from './screens/UsersNotifications';

const Stack = createStackNavigator();

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NavigationContainer>
          {/* ✅ Always Green Status Bar */}
          <StatusBarStyleManager
            backgroundColor="#146c43"
            barStyle="light-content"
          />

          <Stack.Navigator initialRouteName="CollectorsLogin" screenOptions={{ headerShown: false }}>
            <Stack.Screen name="CollectorsLogin" component={CollectorsLogin} />
            <Stack.Screen name="CollectorsTabs" component={CollectorsTabs} />
            <Stack.Screen name="Reports" component={Reports} />
            <Stack.Screen name="UsersLogin" component={UsersLogin} />
            <Stack.Screen name="UsersDashboard" component={UsersDashboard} />
            <Stack.Screen name="ReviewCollection" component={ReviewCollection} />
            <Stack.Screen name="Settings" component={Settings} />
            <Stack.Screen name="Schedules" component={Schedules} />
            <Stack.Screen name="LogScreen" component={LogScreen} />
            <Stack.Screen name="Collection" component={Collection} />
            <Stack.Screen name="CollectorsDashboard" component={CollectorsDashboard} />
            <Stack.Screen name="LogDetails" component={LogDetails} />
            <Stack.Screen name="UsersTabs" component={UsersTabs} />
            <Stack.Screen name="UsersCollection" component={UsersCollection} />
            <Stack.Screen name="Map" component={Map} />
            <Stack.Screen name="Notifications" component={Notifications} />
            <Stack.Screen name="NotificationDetails" component={NotificationDetails} />
            <Stack.Screen name="AboutUs" component={AboutUs} />
            <Stack.Screen name="Hotlines" component={Hotlines} />
            <Stack.Screen name="UsersNotifications" component={UsersNotifications} />
          </Stack.Navigator>
        </NavigationContainer>
      </AuthProvider>
    </ThemeProvider>
  );
}
