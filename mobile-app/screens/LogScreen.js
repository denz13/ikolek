import React, { useContext, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from './ThemeContext';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebasecollector/firebase';
import { responsive, wp, hp, fp, rp, isTablet, isSmallDevice } from '../utils/responsive';

export default function LogsScreen() {
  const { isDarkMode } = useContext(ThemeContext);
  const navigation = useNavigation();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const iconColor = isDarkMode ? "#fff" : "#333";

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const logsSnapshot = await getDocs(collection(db, 'collections'));
        const logsData = logsSnapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            date: data.completedAt?.toDate ? data.completedAt.toDate().toLocaleDateString() : 
                  data.completedAt ? new Date(data.completedAt).toLocaleDateString() : 'Unknown',
            time: data.completedAt?.toDate ? data.completedAt.toDate().toLocaleTimeString() : 
                  data.completedAt ? new Date(data.completedAt).toLocaleTimeString() : 'Unknown',
            status: data.status === 'collected' ? 'Collected' : 'Pending',
            weightKg: data.weightKg || 0,
            collector: data.collectorId || 'Unknown Collector',
            location: data.location || 'Unknown Location',
            zone: data.zone || 'Unknown Zone',
            day: data.day || 'Unknown Day',
            scheduleTime: data.time || 'Unknown Time',
            groupName: data.groupName || 'Unknown Group',
            startedAt: data.startedAt?.toDate ? data.startedAt.toDate().toLocaleString() : 
                       data.startedAt ? new Date(data.startedAt).toLocaleString() : 'Unknown',
            completedAt: data.completedAt?.toDate ? data.completedAt.toDate().toLocaleString() : 
                         data.completedAt ? new Date(data.completedAt).toLocaleString() : 'Unknown',
            scheduleId: data.scheduleId || 'Unknown Schedule',
          };
        });
        
        // Sort by completion date (newest first)
        logsData.sort((a, b) => {
          const dateA = a.completedAt === 'Unknown' ? new Date(0) : new Date(a.completedAt);
          const dateB = b.completedAt === 'Unknown' ? new Date(0) : new Date(b.completedAt);
          return dateB - dateA;
        });
        
        setLogs(logsData);
      } catch (error) {
        console.error('Error fetching logs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const renderLogItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.logItem, isDarkMode && styles.darkItem]}
      onPress={() => navigation.navigate('LogDetails', { logDetails: item })}
    >
      <View style={styles.logHeader}>
        <Ionicons name="calendar" size={20} color={iconColor} />
        <Text style={[styles.logDate, isDarkMode && styles.darkText]}>{item.date}</Text>
        <View style={[
          styles.statusBadge,
          item.status === 'Collected' ? styles.completedStatus : styles.pendingStatus
        ]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.logRow}>
        <Ionicons name="time" size={20} color={iconColor} />
        <Text style={[styles.logText, isDarkMode && styles.darkText]}>{item.time}</Text>
      </View>

      <View style={styles.logRow}>
        <Ionicons name="location" size={20} color={iconColor} />
        <Text style={[styles.logText, isDarkMode && styles.darkText]}>{item.location}</Text>
      </View>

      <View style={styles.logRow}>
        <Ionicons name="person" size={20} color={iconColor} />
        <Text style={[styles.logText, isDarkMode && styles.darkText]}>{item.collector}</Text>
      </View>

      <View style={styles.logRow}>
        <Ionicons name="scale" size={20} color={iconColor} />
        <Text style={[styles.logText, isDarkMode && styles.darkText]}>{item.weightKg} kg collected</Text>
      </View>

      <View style={styles.logRow}>
        <Ionicons name="map" size={20} color={iconColor} />
        <Text style={[styles.logText, isDarkMode && styles.darkText]}>Zone: {item.zone}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, isDarkMode && styles.darkContainer]}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={responsive.iconSize.lg} color={iconColor} />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={[styles.header, isDarkMode && styles.darkText]}>Collection History</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={logs}
          renderItem={renderLogItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: responsive.spacing.xl }}
          showsVerticalScrollIndicator={false}
        />
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
  darkText: {
    color: '#fff',
  },
  logItem: {
    backgroundColor: '#FFF',
    borderRadius: responsive.borderRadius.lg,
    padding: responsive.spacing.lg,
    marginBottom: responsive.spacing.base,
    borderLeftWidth: rp(4),
    borderLeftColor: '#4CAF50',
    ...(isTablet() && {
      borderRadius: responsive.borderRadius.xl,
      padding: responsive.spacing.xl,
      marginBottom: responsive.spacing.lg,
      borderLeftWidth: rp(6),
    }),
  },
  darkItem: {
    backgroundColor: '#1E1E1E',
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsive.spacing.base,
    ...(isTablet() && { marginBottom: responsive.spacing.lg }),
  },
  logDate: {
    fontSize: responsive.fontSize.base,
    fontWeight: 'bold',
    marginLeft: responsive.spacing.base,
    marginRight: 'auto',
    color: '#333',
    ...(isTablet() && { fontSize: responsive.fontSize.lg }),
  },
  statusBadge: {
    paddingHorizontal: responsive.spacing.base,
    paddingVertical: responsive.spacing.xs,
    borderRadius: responsive.borderRadius.lg,
    ...(isTablet() && {
      paddingHorizontal: responsive.spacing.lg,
      paddingVertical: responsive.spacing.sm,
      borderRadius: responsive.borderRadius.xl,
    }),
  },
  completedStatus: {
    backgroundColor: '#e6f7ed',
  },
  partialStatus: {
    backgroundColor: '#fff8e6',
  },
  pendingStatus: {
    backgroundColor: '#ffe6e6',
  },
  statusText: {
    fontSize: responsive.fontSize.sm,
    fontWeight: 'bold',
    ...(isTablet() && { fontSize: responsive.fontSize.base }),
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: responsive.spacing.xs,
    ...(isTablet() && { marginVertical: responsive.spacing.sm }),
  },
  logText: {
    fontSize: responsive.fontSize.base,
    marginLeft: responsive.spacing.base,
    color: '#333',
    ...(isTablet() && { fontSize: responsive.fontSize.lg }),
  },
});
