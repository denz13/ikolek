import React, { useContext, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, Platform
} from 'react-native';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../firebasecollector/firebase';
import { ThemeContext } from './ThemeContext';
import { responsive, wp, hp, fp, rp, isTablet, isSmallDevice } from '../utils/responsive';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

const CollectionScreen = () => {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isDarkMode } = useContext(ThemeContext);

  const themeStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? '#121212' : '#f4f4f4',
      paddingTop: responsive.spacing['4xl'],
      ...(isTablet() && {
        paddingTop: responsive.spacing['5xl'],
      }),
    },
    header: {
      alignItems: 'center',
      paddingBottom: responsive.spacing.lg,
      paddingHorizontal: responsive.spacing.xl,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? '#333' : '#ccc',
    },
    headerTitle: {
      fontSize: responsive.fontSize['2xl'],
      color: isDarkMode ? '#fff' : '#000',
      fontWeight: 'bold',
      ...(isSmallDevice() && { fontSize: responsive.fontSize.xl }),
      ...(isTablet() && { fontSize: responsive.fontSize['3xl'] }),
    },
    card: {
      backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF',
      padding: responsive.spacing.xl,
      marginHorizontal: responsive.spacing.xl,
      marginVertical: responsive.spacing.base,
      borderRadius: responsive.borderRadius.lg,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
      position: 'relative',
      ...(isTablet() && {
        padding: responsive.spacing['2xl'],
        marginHorizontal: responsive.spacing['3xl'],
        marginVertical: responsive.spacing.lg,
        borderRadius: responsive.borderRadius.xl,
      }),
    },
    darkCard: {
      backgroundColor: '#1E1E1E',
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: responsive.spacing.lg,
      marginTop: responsive.spacing.sm,
    },
    collectionTitle: {
      fontSize: responsive.fontSize.xl,
      color: '#000',
      fontWeight: 'bold',
      marginBottom: responsive.spacing.xs,
      ...(isTablet() && { fontSize: responsive.fontSize['2xl'] }),
    },
    collectionSubtitle: {
      fontSize: responsive.fontSize.sm,
      color: '#666',
      fontWeight: '500',
      ...(isTablet() && { fontSize: responsive.fontSize.base }),
    },
    statusBadge: {
      position: 'absolute',
      top: responsive.spacing.lg,
      right: responsive.spacing.lg,
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
    statusBadgeText: {
      color: '#fff',
      fontSize: responsive.fontSize.sm,
      fontWeight: 'bold',
      ...(isTablet() && { fontSize: responsive.fontSize.base }),
    },
    detailsSection: {
      marginBottom: responsive.spacing.base,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: responsive.spacing.sm,
      paddingVertical: responsive.spacing.xs,
    },
    detailIcon: {
      width: responsive.spacing.lg,
      marginRight: responsive.spacing.base,
    },
    detailText: {
      color: '#555',
      fontSize: responsive.fontSize.sm,
      fontWeight: '500',
      flex: 1,
      ...(isTablet() && { fontSize: responsive.fontSize.base }),
    },
    detailValue: {
      color: '#000',
      fontSize: responsive.fontSize.sm,
      fontWeight: '600',
      ...(isTablet() && { fontSize: responsive.fontSize.base }),
    },
    timeSection: {
      marginTop: responsive.spacing.base,
      padding: responsive.spacing.base,
      backgroundColor: isDarkMode ? '#2a2a2a' : '#f8f9fa',
      borderRadius: responsive.borderRadius.base,
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: responsive.spacing.xs,
    },
    timeLabel: {
      color: '#555',
      fontSize: responsive.fontSize.sm,
      fontWeight: '500',
      marginRight: responsive.spacing.sm,
      ...(isTablet() && { fontSize: responsive.fontSize.base }),
    },
    timeValue: {
      color: '#000',
      fontSize: responsive.fontSize.sm,
      fontWeight: '600',
      flex: 1,
      ...(isTablet() && { fontSize: responsive.fontSize.base }),
    },
    darkText: {
      color: '#fff',
    },
    darkSubText: {
      color: '#bbb',
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: responsive.spacing.xl,
    },
    emptyText: {
      color: isDarkMode ? '#CCC' : '#555',
      fontSize: responsive.fontSize.base,
      textAlign: 'center',
      ...(isTablet() && { fontSize: responsive.fontSize.lg }),
    },
  });

  useEffect(() => {
    const q = collection(db, 'collections');

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by startedAt date (newest first)
      data.sort((a, b) => {
        const dateA = a.startedAt?.toDate() || new Date(0);
        const dateB = b.startedAt?.toDate() || new Date(0);
        return dateB - dateA;
      });
      setCollections(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);


  const renderItem = ({ item }) => {
    const isCompleted = item.status === 'collected' || item.completed;
    const statusColor = isCompleted ? '#4CAF50' : '#FF9800';
    const statusText = isCompleted ? 'COMPLETED' : 'ONGOING';

    return (
      <View style={[themeStyles.card, isDarkMode && themeStyles.darkCard]}>
        {/* Status Badge */}
        <View style={[themeStyles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={themeStyles.statusBadgeText}>{statusText}</Text>
        </View>

        {/* Header Section */}
        <View style={themeStyles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[themeStyles.collectionTitle, isDarkMode && themeStyles.darkText]}>
              {item.groupName || item.routeId || 'Collection'}
            </Text>
            <Text style={[themeStyles.collectionSubtitle, isDarkMode && themeStyles.darkSubText]}>
              Zone: {item.zone || 'N/A'}
            </Text>
          </View>
        </View>

        {/* Details Section */}
        <View style={themeStyles.detailsSection}>
          <View style={themeStyles.detailRow}>
            <MaterialCommunityIcons name="calendar" size={18} color="#3f51b5" style={themeStyles.detailIcon} />
            <Text style={[themeStyles.detailText, isDarkMode && themeStyles.darkText]}>Day:</Text>
            <Text style={[themeStyles.detailValue, isDarkMode && themeStyles.darkText]}>{item.day || 'N/A'}</Text>
          </View>

          <View style={themeStyles.detailRow}>
            <MaterialCommunityIcons name="clock-outline" size={18} color="#009688" style={themeStyles.detailIcon} />
            <Text style={[themeStyles.detailText, isDarkMode && themeStyles.darkText]}>Time:</Text>
            <Text style={[themeStyles.detailValue, isDarkMode && themeStyles.darkText]}>{item.time || 'N/A'}</Text>
          </View>

          <View style={themeStyles.detailRow}>
            <MaterialCommunityIcons name="truck" size={18} color="#795548" style={themeStyles.detailIcon} />
            <Text style={[themeStyles.detailText, isDarkMode && themeStyles.darkText]}>Collector ID:</Text>
            <Text style={[themeStyles.detailValue, isDarkMode && themeStyles.darkText]}>{item.collectorId || 'N/A'}</Text>
          </View>

          <View style={themeStyles.detailRow}>
            <MaterialCommunityIcons name="map-marker" size={18} color="#e91e63" style={themeStyles.detailIcon} />
            <Text style={[themeStyles.detailText, isDarkMode && themeStyles.darkText]}>Location:</Text>
            <Text style={[themeStyles.detailValue, isDarkMode && themeStyles.darkText]}>{item.location || 'N/A'}</Text>
          </View>

          {item.weightKg && (
            <View style={themeStyles.detailRow}>
              <MaterialCommunityIcons name="weight" size={18} color="#ff9800" style={themeStyles.detailIcon} />
              <Text style={[themeStyles.detailText, isDarkMode && themeStyles.darkText]}>Weight:</Text>
              <Text style={[themeStyles.detailValue, isDarkMode && themeStyles.darkText]}>{item.weightKg} kg</Text>
            </View>
          )}
        </View>

        {/* Time Information */}
        <View style={themeStyles.timeSection}>
          <View style={themeStyles.timeRow}>
            <MaterialCommunityIcons name="play-circle" size={16} color="#4CAF50" style={{ marginRight: responsive.spacing.sm }} />
            <Text style={[themeStyles.timeLabel, isDarkMode && themeStyles.darkText]}>Started:</Text>
            <Text style={[themeStyles.timeValue, isDarkMode && themeStyles.darkText]}>
              {item.startedAt?.toDate()?.toLocaleString() || 'N/A'}
            </Text>
          </View>
          
          {item.completedAt && (
            <View style={themeStyles.timeRow}>
              <MaterialCommunityIcons name="check-circle" size={16} color="#4CAF50" style={{ marginRight: responsive.spacing.sm }} />
              <Text style={[themeStyles.timeLabel, isDarkMode && themeStyles.darkText]}>Completed:</Text>
              <Text style={[themeStyles.timeValue, isDarkMode && themeStyles.darkText]}>
                {item.completedAt?.toDate()?.toLocaleString() || 'N/A'}
              </Text>
            </View>
          )}
        </View>

      </View>
    );
  };

  return (
    <View style={themeStyles.container}>
      <View style={themeStyles.header}>
        <Text style={[themeStyles.headerTitle, isDarkMode && themeStyles.darkText]}>
          Collections
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: responsive.spacing['3xl'] }} />
      ) : collections.length === 0 ? (
        <View style={themeStyles.emptyState}>
          <Text style={[themeStyles.emptyText, isDarkMode && themeStyles.darkText]}>
            No collections found.
          </Text>
        </View>
      ) : (
        <FlatList
          data={collections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: responsive.spacing.xl }}
        />
      )}
    </View>
  );
};

export default CollectionScreen;
