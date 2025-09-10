import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from './ThemeContext';

export default function NotificationDetailsScreen({ route }) {
  const { isDarkMode } = useContext(ThemeContext);
  const navigation = useNavigation();
  
  // Get the notification details passed from NotificationScreen
  const { notificationDetails } = route.params;
  
  const iconColor = isDarkMode ? "#fff" : "#333";
  
  return (
    <View style={[styles.container, isDarkMode && styles.darkContainer]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={iconColor} />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={[styles.header, isDarkMode && styles.darkText]}>Notification Details</Text>
        </View>
      </View>

      <View style={[styles.card, isDarkMode && styles.darkCard]}>
        <Text style={[styles.cardTitle, isDarkMode && styles.darkText]}>
          {notificationDetails.title || 'No Title'}
        </Text>
        <Text style={[styles.cardBody, isDarkMode && styles.darkText]}>
          {notificationDetails.message || 'No Message'}
        </Text>
        <Text style={[styles.cardDate, isDarkMode && styles.darkText]}>
          {notificationDetails.timestamp?.seconds
            ? new Date(notificationDetails.timestamp.seconds * 1000).toLocaleString()
            : 'Unknown Timestamp'}
        </Text>
      </View>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
    height: 40,
  },
  titleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    marginBottom: 10,
  },
  darkCard: {
    backgroundColor: '#1E1E1E',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  cardBody: {
    fontSize: 16,
    marginBottom: 10,
  },
  cardDate: {
    fontSize: 14,
    color: '#888',
  },
  darkText: {
    color: '#fff',
  },
});
