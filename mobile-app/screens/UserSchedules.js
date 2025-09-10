import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { ThemeContext } from './ThemeContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebasecollector/firebase';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

export default function CollectionScheduleScreen() {
  const { isDarkMode } = useContext(ThemeContext);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? '#121212' : '#f4f4f4',
      paddingTop: 40,
    },
    header: {
      alignItems: 'center',
      paddingBottom: 15,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? '#333' : '#ccc',
    },
    headerTitle: {
      fontSize: 22,
      color: isDarkMode ? '#fff' : '#000',
      fontWeight: 'bold',
    },
    scheduleCard: {
      backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF',
      padding: 16,
      marginHorizontal: 20,
      marginVertical: 10,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    detailText: {
      color: isDarkMode ? '#CCC' : '#333',
      fontSize: 15,
      marginBottom: 5,
      flexDirection: 'row',
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: isDarkMode ? '#fff' : '#000',
      marginBottom: 10,
    },
    memberList: {
      marginTop: 5,
      paddingLeft: 10,
      color: isDarkMode ? '#fff' : '#000',
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    emptyText: {
      color: isDarkMode ? '#CCC' : '#555',
      fontSize: 16,
      textAlign: 'center',
    },
    iconTextRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 5,
    },
    icon: {
      marginRight: 8,
    },
  });

  const renderSchedule = ({ item }) => (
  <View style={styles.scheduleCard}>
    <Text style={styles.sectionTitle}>{item.groupName}</Text>

    <View style={styles.iconTextRow}>
      <MaterialCommunityIcons name="map-marker" size={16} color="#e91e63" style={styles.icon} />
      <Text style={styles.detailText}>Location: {item.location}</Text>
    </View>

    <View style={styles.iconTextRow}>
      <MaterialCommunityIcons name="calendar" size={16} color="#3f51b5" style={styles.icon} />
      <Text style={styles.detailText}>Day: {item.day}</Text>
    </View>

    <View style={styles.iconTextRow}>
      <MaterialCommunityIcons name="clock-outline" size={16} color="#009688" style={styles.icon} />
      <Text style={styles.detailText}>Time: {item.time}</Text>
    </View>

    <View style={styles.iconTextRow}>
      <MaterialCommunityIcons name="map" size={16} color="#ff9800" style={styles.icon} />
      <Text style={styles.detailText}>Zone: {item.zone}</Text>
    </View>

    <View style={styles.iconTextRow}>
      <MaterialCommunityIcons name="truck" size={16} color="#795548" style={styles.icon} />
      <Text style={styles.detailText}>Driver: {item.driver}</Text>
    </View>

    <View style={styles.iconTextRow}>
      <MaterialCommunityIcons name="account-group" size={16} color="#4caf50" style={styles.icon} />
      <Text style={styles.detailText}>Members:</Text>
    </View>

    {item.members?.map((member, index) => (
      <Text key={index} style={styles.memberList}>• {member}</Text>
    ))}
  </View>
);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SCHEDULES</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 50 }} />
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
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No schedules found.</Text>
        </View>
      )}
    </View>
  );
}
