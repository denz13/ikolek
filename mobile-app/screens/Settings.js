import React, { useContext } from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from './ThemeContext';
import { AuthContext } from './AuthContext'; // Import ThemeContext

export default function SettingsScreen() {
  const { isDarkMode, toggleTheme } = useContext(ThemeContext); // Get theme and toggle function from context
  const navigation = useNavigation();
  const { collectorId, setIsLoggedOut, setCollectorId } = useContext(AuthContext);

  const iconColor = isDarkMode ? "#fff" : "#333"; // Dynamic icon color

  // Logout function
  
  const handleLogout = () => {
    Alert.alert(
      "Confirm Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            if (collectorId) {
              const collectorRef = doc(db, 'collectors', collectorId);
              await updateDoc(collectorRef, {
                status: 'offline',
                lastActive: serverTimestamp(),
              });
            }

            setIsLoggedOut(true);    // Mark logged out in context
            setCollectorId(null);    // Clear collectorId from context

            navigation.reset({
              index: 0,
              routes: [{ name: 'CollectorsLogin' }],
            });
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.container, isDarkMode && styles.darkContainer]}>
      {/* Header with Back Button */}
      <View style={styles.headerContainer}>
        <Text style={[styles.header, isDarkMode && styles.darkText]}>Settings</Text>
      </View>

      {/* Dark Mode Toggle */}
      <View style={[styles.settingItem, isDarkMode && styles.darkItem]}>
        <Ionicons name="moon" size={24} color={iconColor} />
        <Text style={[styles.settingText, isDarkMode && styles.darkText]}>Dark Mode</Text>
        <Switch
          value={isDarkMode}
          onValueChange={toggleTheme} // Toggle theme globally using the context
        />
      </View>

      {/* Settings List */}
      <TouchableOpacity style={[styles.settingItem, isDarkMode && styles.darkItem]} onPress={() => navigation.navigate('AboutUs')}>
        <Ionicons name="information-circle" size={24} color={iconColor} />
        <Text style={[styles.settingText, isDarkMode && styles.darkText]}>About Us</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.settingItem, isDarkMode && styles.darkItem]} onPress={() => navigation.navigate('Hotlines')}>
        <Ionicons name="call" size={24} color={iconColor} />
        <Text style={[styles.settingText, isDarkMode && styles.darkText]}>Gov't Emergency</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.settingItem, isDarkMode && styles.darkItem]} onPress={() => navigation.navigate('Notifications')}>
        <Ionicons name="notifications" size={24} color={iconColor} />
        <Text style={[styles.settingText, isDarkMode && styles.darkText]}>Notifications</Text>
      </TouchableOpacity>

      {/* Logout Button */}
      <TouchableOpacity style={[styles.settingItem, styles.logout]} onPress={handleLogout}>
        <Ionicons name="log-out" size={24} color="red" />
        <Text style={[styles.settingText, { color: "red" }]}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f4f4',
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  darkContainer: {
    backgroundColor: '#121212',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    justifyContent: 'center',
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    marginLeft: 10,
    color: '#333',
  },
  darkText: {
    color: '#fff',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 10,
    backgroundColor: '#FFF',
    marginVertical: 5,
  },
  darkItem: {
    backgroundColor: '#1E1E1E',
  },
  settingText: {
    fontSize: 16,
    flex: 1,
    marginLeft: 10,
    color: '#333',
  },
  logout: {
    backgroundColor: '#ffebee',
    marginTop: 20,
  },
});
