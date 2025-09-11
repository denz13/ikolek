import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { ThemeContext } from './ThemeContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebasecollector/firebase';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { responsive, wp, hp, fp, rp, isTablet, isSmallDevice } from '../utils/responsive';

export default function CollectionScheduleScreen() {
  const { isDarkMode } = useContext(ThemeContext);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSchedule, setExpandedSchedule] = useState(null);

  const dayOrder = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  const fetchSchedules = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'schedules'));
      const allSchedules = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      const sortedSchedules = allSchedules.sort((a, b) => {
        const dayA = dayOrder.indexOf(a.day);
        const dayB = dayOrder.indexOf(b.day);
        return dayA - dayB;
      });

      setSchedules(sortedSchedules);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchSchedules();
      setLoading(false);
    };
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSchedules();
    setRefreshing(false);
  };

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
    scheduleCard: {
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
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: responsive.spacing.lg,
    },
    scheduleTitle: {
      fontSize: responsive.fontSize.xl,
      color: isDarkMode ? '#fff' : '#000',
      fontWeight: 'bold',
      marginBottom: responsive.spacing.xs,
      ...(isTablet() && { fontSize: responsive.fontSize['2xl'] }),
    },
    scheduleSubtitle: {
      fontSize: responsive.fontSize.sm,
      color: isDarkMode ? '#bbb' : '#666',
      fontWeight: '500',
      ...(isTablet() && { fontSize: responsive.fontSize.base }),
    },
    statusBadge: {
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
      color: isDarkMode ? '#CCC' : '#555',
      fontSize: responsive.fontSize.sm,
      fontWeight: '500',
      flex: 1,
      ...(isTablet() && { fontSize: responsive.fontSize.base }),
    },
    detailValue: {
      color: isDarkMode ? '#fff' : '#000',
      fontSize: responsive.fontSize.sm,
      fontWeight: '600',
      ...(isTablet() && { fontSize: responsive.fontSize.base }),
    },
    membersSection: {
      marginTop: responsive.spacing.base,
      padding: responsive.spacing.base,
      backgroundColor: isDarkMode ? '#2a2a2a' : '#f8f9fa',
      borderRadius: responsive.borderRadius.base,
    },
    membersHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: responsive.spacing.sm,
    },
    membersTitle: {
      color: isDarkMode ? '#64b5f6' : '#1976d2',
      fontSize: responsive.fontSize.sm,
      fontWeight: '600',
      ...(isTablet() && { fontSize: responsive.fontSize.base }),
    },
    membersList: {
      marginTop: responsive.spacing.sm,
    },
    memberText: {
      fontSize: responsive.fontSize.sm,
      color: isDarkMode ? '#aaa' : '#444',
      marginBottom: responsive.spacing.xs,
      paddingLeft: responsive.spacing.base,
      ...(isTablet() && { fontSize: responsive.fontSize.base }),
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

  const renderSchedule = ({ item }) => {
    const isExpanded = expandedSchedule === item.id;

    return (
      <View style={themeStyles.scheduleCard}>
        {/* Status Badge */}
        <View style={themeStyles.statusBadge}>
          <Text style={themeStyles.statusBadgeText}>SCHEDULED</Text>
        </View>

        {/* Header Section */}
        <View style={themeStyles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={themeStyles.scheduleTitle}>{item.groupName || "N/A"}</Text>
            <Text style={themeStyles.scheduleSubtitle}>Zone: {item.zone || "N/A"}</Text>
          </View>
        </View>

        {/* Details Section */}
        <View style={themeStyles.detailsSection}>
          <View style={themeStyles.detailRow}>
            <MaterialCommunityIcons name="calendar" size={18} color="#3f51b5" style={themeStyles.detailIcon} />
            <Text style={themeStyles.detailText}>Day:</Text>
            <Text style={themeStyles.detailValue}>{item.day || "N/A"}</Text>
          </View>

          <View style={themeStyles.detailRow}>
            <MaterialCommunityIcons name="clock-outline" size={18} color="#009688" style={themeStyles.detailIcon} />
            <Text style={themeStyles.detailText}>Time:</Text>
            <Text style={themeStyles.detailValue}>{item.time || "N/A"}</Text>
          </View>

          <View style={themeStyles.detailRow}>
            <MaterialCommunityIcons name="truck" size={18} color="#795548" style={themeStyles.detailIcon} />
            <Text style={themeStyles.detailText}>Driver:</Text>
            <Text style={themeStyles.detailValue}>{item.driver || "N/A"}</Text>
          </View>

          <View style={themeStyles.detailRow}>
            <MaterialCommunityIcons name="map-marker" size={18} color="#e91e63" style={themeStyles.detailIcon} />
            <Text style={themeStyles.detailText}>Location:</Text>
            <Text style={themeStyles.detailValue}>{item.location || "N/A"}</Text>
          </View>
        </View>

        {/* Members Section */}
        <View style={themeStyles.membersSection}>
          <TouchableOpacity
            style={themeStyles.membersHeader}
            onPress={() => setExpandedSchedule(isExpanded ? null : item.id)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="account-group" size={18} color="#4caf50" style={{ marginRight: responsive.spacing.sm }} />
              <Text style={themeStyles.membersTitle}>
                Team Members ({item.members?.length || 0})
              </Text>
            </View>
            <MaterialCommunityIcons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={16}
              color="#4caf50"
            />
          </TouchableOpacity>

          {isExpanded && (
            <View style={themeStyles.membersList}>
              {item.members?.map((member, index) => (
                <Text key={index} style={themeStyles.memberText}>
                  • {member}
                </Text>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={themeStyles.container}>
      <View style={themeStyles.header}>
        <Text style={themeStyles.headerTitle}>SCHEDULES</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: responsive.spacing['3xl'] }} />
      ) : schedules.length > 0 ? (
        <FlatList
          data={schedules}
          keyExtractor={(item) => item.id}
          renderItem={renderSchedule}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#4CAF50']}
              tintColor="#4CAF50"
            />
          }
        />
      ) : (
        <View style={themeStyles.emptyState}>
          <Text style={themeStyles.emptyText}>No schedules found.</Text>
        </View>
      )}
    </View>
  );
}
