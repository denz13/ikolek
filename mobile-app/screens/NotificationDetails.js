import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from './ThemeContext';
import { responsive, wp, hp, fp, rp, isTablet, isSmallDevice } from '../utils/responsive';

export default function NotificationDetailsScreen({ route }) {
  const { isDarkMode } = useContext(ThemeContext);
  const navigation = useNavigation();
  
  // Get the notification details passed from NotificationScreen
  const { notificationDetails } = route.params;
  
  const iconColor = isDarkMode ? "#fff" : "#333";
  const isReportNotification = notificationDetails?.type === 'report_response';
  
  return (
    <View style={[styles.container, isDarkMode && styles.darkContainer]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={responsive.iconSize.lg} color={iconColor} />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={[styles.header, isDarkMode && styles.darkText]}>Notification Details</Text>
        </View>
      </View>

      <View style={[
        styles.card, 
        isDarkMode && styles.darkCard,
        isReportNotification && styles.reportCard
      ]}>
        <View style={styles.notificationHeader}>
          <Ionicons 
            name={isReportNotification ? 'document-text' : 'notifications'} 
            size={responsive.iconSize.lg} 
            color={isReportNotification ? '#4CAF50' : '#2196F3'} 
            style={styles.notificationIcon}
          />
          <Text style={[
            styles.cardTitle, 
            isDarkMode && styles.darkText,
            isReportNotification && styles.reportTitle
          ]}>
            {notificationDetails.title || 'No Title'}
          </Text>
        </View>
        
        {isReportNotification && (
          <View style={styles.reportBadge}>
            <Text style={styles.reportBadgeText}>Report Response</Text>
          </View>
        )}
        
        <Text style={[styles.cardBody, isDarkMode && styles.darkText]}>
          {notificationDetails.message || 'No Message'}
        </Text>
        
        {notificationDetails.reportId && (
          <Text style={[styles.reportId, isDarkMode && styles.darkText]}>
            Report ID: {notificationDetails.reportId}
          </Text>
        )}
        
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
  card: {
    backgroundColor: '#fff',
    borderRadius: responsive.borderRadius.lg,
    padding: responsive.spacing.xl,
    marginBottom: responsive.spacing.base,
    position: 'relative',
    ...(isTablet() && {
      padding: responsive.spacing['2xl'],
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
    marginBottom: responsive.spacing.lg,
    ...(isTablet() && {
      marginBottom: responsive.spacing.xl,
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
    top: responsive.spacing.lg,
    right: responsive.spacing.lg,
    backgroundColor: '#4CAF50',
    paddingHorizontal: responsive.spacing.base,
    paddingVertical: responsive.spacing.xs,
    borderRadius: responsive.borderRadius.lg,
    ...(isTablet() && {
      top: responsive.spacing.xl,
      right: responsive.spacing.xl,
      paddingHorizontal: responsive.spacing.lg,
      paddingVertical: responsive.spacing.sm,
    }),
  },
  reportBadgeText: {
    color: '#fff',
    fontSize: responsive.fontSize.sm,
    fontWeight: 'bold',
    ...(isTablet() && { fontSize: responsive.fontSize.base }),
  },
  reportId: {
    fontSize: responsive.fontSize.sm,
    color: '#666',
    marginTop: responsive.spacing.base,
    fontStyle: 'italic',
    ...(isTablet() && { fontSize: responsive.fontSize.base }),
  },
  cardTitle: {
    fontSize: responsive.fontSize.xl,
    fontWeight: 'bold',
    marginBottom: responsive.spacing.base,
    ...(isTablet() && { fontSize: responsive.fontSize['2xl'] }),
  },
  cardBody: {
    fontSize: responsive.fontSize.lg,
    marginBottom: responsive.spacing.base,
    ...(isTablet() && { fontSize: responsive.fontSize.xl }),
  },
  cardDate: {
    fontSize: responsive.fontSize.base,
    color: '#888',
    ...(isTablet() && { fontSize: responsive.fontSize.lg }),
  },
  darkText: {
    color: '#fff',
  },
});
