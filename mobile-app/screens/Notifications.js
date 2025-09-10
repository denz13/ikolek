import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebasecollector/firebase';
import { ThemeContext } from './ThemeContext';

export default function NotificationScreen({ route }) {
  const { isDarkMode } = useContext(ThemeContext);
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const iconColor = isDarkMode ? "#fff" : "#333";

  // Changed from collectorId to truckId
  const truckId = route.params?.truckId || null;

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        let notificationsQuery = collection(db, 'notifications');
        if (truckId) {
          notificationsQuery = query(notificationsQuery, where('truckId', '==', truckId));
        }

        const snapshot = await getDocs(notificationsQuery);
        const notifs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));

        setNotifications(notifs);
      } catch (error) {
        console.error('Error fetching notifications:', error);
        Alert.alert('Error', 'Failed to load notifications. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [truckId]);

  // Changed from collectorId to truckId
  const addNotification = async (truckId, message) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        truckId: truckId,
        timestamp: serverTimestamp(),
        message: message,
        title: 'Assigned',
        read: false,
      });
    } catch (error) {
      console.error('Error adding notification:', error);
      Alert.alert('Error', 'Failed to send notification. Please try again.');
    }
  };

  // Changed from collectorId to truckId
  const handleAdminRouteAssignment = (truckId, routeName) => {
    const message = `You have been assigned new routes: ${routeName}`;
    addNotification(truckId, message);
  };

  const renderNotification = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, isDarkMode && styles.darkCard]}
      onPress={() => navigation.navigate('NotificationDetails', { notificationDetails: item })}
    >
      <Text style={[styles.cardTitle, isDarkMode && styles.darkText]}>
        {item.title || 'No Title'}
      </Text>
      <Text style={[styles.cardBody, isDarkMode && styles.darkText]}>
        {item.message || 'No Message'}
      </Text>
      <Text style={[styles.cardDate, isDarkMode && styles.darkText]}>
        {item.timestamp?.seconds
          ? new Date(item.timestamp.seconds * 1000).toLocaleString()
          : 'Unknown Timestamp'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, isDarkMode && styles.darkContainer]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={iconColor} />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={[styles.header, isDarkMode && styles.darkText]}>Notifications</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 50 }} />
      ) : notifications.length > 0 ? (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <Text style={[styles.noNotifText, isDarkMode && styles.darkText]}>
          No notifications to show.
        </Text>
      )}
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
  listContainer: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  darkCard: {
    backgroundColor: '#1E1E1E',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  cardBody: {
    fontSize: 14,
    marginBottom: 5,
  },
  cardDate: {
    fontSize: 12,
    color: '#888',
  },
  darkText: {
    color: '#fff',
  },
  noNotifText: {
    marginTop: 100,
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
  },
});
