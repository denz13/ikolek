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
        // Get user ID from route params (for report notifications)
        const userId = route.params?.uid || route.params?.userId;
        
        let allNotifications = [];
        
        // Fetch regular notifications (for collectors)
        if (truckId) {
          const notificationsQuery = query(collection(db, 'notifications'), where('truckId', '==', truckId));
          const snapshot = await getDocs(notificationsQuery);
          const notifs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            type: 'assignment' // Mark as assignment notification
          }));
          allNotifications = [...allNotifications, ...notifs];
        }
        
        // Fetch report notifications (for users)
        if (userId) {
          console.log('Fetching notifications for userId:', userId);
          const reportNotificationsQuery = query(
            collection(db, 'notifications_reports'), 
            where('users_id', '==', userId)
          );
          const reportSnapshot = await getDocs(reportNotificationsQuery);
          console.log('Report notifications found:', reportSnapshot.docs.length);
          const reportNotifs = reportSnapshot.docs.map(doc => {
            console.log('Report notification data:', doc.data());
            return {
              id: doc.id,
              ...doc.data(),
              type: 'report_response', // Mark as report notification
              title: doc.data().title || 'Report Response',
              message: doc.data().message || 'No message',
              timestamp: doc.data().createdAt || doc.data().timestamp
            };
          });
          allNotifications = [...allNotifications, ...reportNotifs];
        } else {
          console.log('No userId found in route params');
        }

        // Sort by timestamp (newest first)
        allNotifications.sort((a, b) => {
          const timeA = a.timestamp?.seconds || 0;
          const timeB = b.timestamp?.seconds || 0;
          return timeB - timeA;
        });

        setNotifications(allNotifications);
      } catch (error) {
        console.error('Error fetching notifications:', error);
        Alert.alert('Error', 'Failed to load notifications. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [truckId, route.params?.uid, route.params?.userId]);

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

  const renderNotification = ({ item }) => {
    const isReportNotification = item.type === 'report_response';
    const iconName = isReportNotification ? 'document-text' : 'notifications';
    const iconColor = isReportNotification ? '#4CAF50' : '#2196F3';
    
    return (
      <TouchableOpacity
        style={[
          styles.card, 
          isDarkMode && styles.darkCard,
          isReportNotification && styles.reportCard
        ]}
        onPress={() => navigation.navigate('NotificationDetails', { notificationDetails: item })}
      >
        <View style={styles.notificationHeader}>
          <Ionicons 
            name={iconName} 
            size={20} 
            color={iconColor} 
            style={styles.notificationIcon}
          />
          <Text style={[
            styles.cardTitle, 
            isDarkMode && styles.darkText,
            isReportNotification && styles.reportTitle
          ]}>
            {item.title || 'No Title'}
          </Text>
        </View>
        <Text style={[styles.cardBody, isDarkMode && styles.darkText]}>
          {item.message || 'No Message'}
        </Text>
        <Text style={[styles.cardDate, isDarkMode && styles.darkText]}>
          {item.timestamp?.seconds
            ? new Date(item.timestamp.seconds * 1000).toLocaleString()
            : 'Unknown Timestamp'}
        </Text>
        {isReportNotification && (
          <View style={styles.reportBadge}>
            <Text style={styles.reportBadgeText}>Report Response</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

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
    position: 'relative',
  },
  darkCard: {
    backgroundColor: '#1E1E1E',
  },
  reportCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  notificationIcon: {
    marginRight: 10,
  },
  reportTitle: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  reportBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  reportBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
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
