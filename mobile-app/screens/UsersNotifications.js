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
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebasecollector/firebase';
import { ThemeContext } from './ThemeContext';
import { responsive, wp, hp, fp, rp, isTablet, isSmallDevice } from '../utils/responsive';

export default function UserNotificationsScreen({ route }) {
  const { isDarkMode } = useContext(ThemeContext);
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const iconColor = isDarkMode ? "#fff" : "#333";
  
  // Get user ID from route params
  const userId = route.params?.uid || route.params?.userId;

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        let allNotifications = [];
        
        // Fetch regular notifications (for users)
        const notificationsQuery = query(
          collection(db, 'notifications'),
          where('target', '==', 'users') // optional filter if you categorize target audiences
        );
        const snapshot = await getDocs(notificationsQuery);
        const notifs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          type: 'general'
        }));
        allNotifications = [...allNotifications, ...notifs];
        
        // Fetch report notifications (for users)
        if (userId) {
          console.log('Fetching report notifications for userId:', userId);
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
              type: 'report_response',
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
  }, [userId]);

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
            size={responsive.iconSize.base} 
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
          <Ionicons name="arrow-back" size={responsive.iconSize.lg} color={iconColor} />
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
    paddingTop: responsive.spacing['4xl'],
    paddingHorizontal: responsive.spacing.xl,
    ...(isTablet() && {
      paddingTop: responsive.spacing['5xl'],
      paddingHorizontal: responsive.spacing['3xl'],
    }),
  },
  darkContainer: {
    backgroundColor: '#121212',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsive.spacing.xl,
    position: 'relative',
    height: responsive.spacing['4xl'],
    ...(isTablet() && {
      marginBottom: responsive.spacing['2xl'],
      height: responsive.spacing['5xl'],
    }),
  },
  titleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    fontSize: responsive.fontSize['2xl'],
    fontWeight: 'bold',
    color: '#333',
    ...(isSmallDevice() && { fontSize: responsive.fontSize.xl }),
    ...(isTablet() && { fontSize: responsive.fontSize['3xl'] }),
  },
  listContainer: {
    paddingBottom: responsive.spacing.xl,
    ...(isTablet() && {
      paddingHorizontal: responsive.spacing.lg,
    }),
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: responsive.borderRadius.lg,
    padding: responsive.spacing.lg,
    marginBottom: responsive.spacing.base,
    position: 'relative',
    ...(isTablet() && {
      padding: responsive.spacing.xl,
      marginBottom: responsive.spacing.lg,
      borderRadius: responsive.borderRadius.xl,
    }),
  },
  darkCard: {
    backgroundColor: '#1E1E1E',
  },
  reportCard: {
    borderLeftWidth: rp(4),
    borderLeftColor: '#4CAF50',
    ...(isTablet() && {
      borderLeftWidth: rp(6),
    }),
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsive.spacing.sm,
    ...(isTablet() && {
      marginBottom: responsive.spacing.base,
    }),
  },
  notificationIcon: {
    marginRight: responsive.spacing.base,
    ...(isTablet() && {
      marginRight: responsive.spacing.lg,
    }),
  },
  reportTitle: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  reportBadge: {
    position: 'absolute',
    top: responsive.spacing.base,
    right: responsive.spacing.base,
    backgroundColor: '#4CAF50',
    paddingHorizontal: responsive.spacing.sm,
    paddingVertical: responsive.spacing.xs,
    borderRadius: responsive.borderRadius.lg,
    ...(isTablet() && {
      top: responsive.spacing.lg,
      right: responsive.spacing.lg,
      paddingHorizontal: responsive.spacing.base,
      paddingVertical: responsive.spacing.sm,
    }),
  },
  reportBadgeText: {
    color: '#fff',
    fontSize: responsive.fontSize.xs,
    fontWeight: 'bold',
    ...(isTablet() && { fontSize: responsive.fontSize.sm }),
  },
  cardTitle: {
    fontSize: responsive.fontSize.lg,
    fontWeight: 'bold',
    marginBottom: responsive.spacing.xs,
    ...(isTablet() && { fontSize: responsive.fontSize.xl }),
  },
  cardBody: {
    fontSize: responsive.fontSize.base,
    marginBottom: responsive.spacing.xs,
    ...(isTablet() && { fontSize: responsive.fontSize.lg }),
  },
  cardDate: {
    fontSize: responsive.fontSize.sm,
    color: '#888',
    ...(isTablet() && { fontSize: responsive.fontSize.base }),
  },
  darkText: {
    color: '#fff',
  },
  noNotifText: {
    marginTop: hp(12),
    fontSize: responsive.fontSize.lg,
    textAlign: 'center',
    color: '#666',
    ...(isTablet() && {
      marginTop: hp(15),
      fontSize: responsive.fontSize.xl,
    }),
  },
});
