import React, { useContext, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from './ThemeContext';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebasecollector/firebase';

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
        const logsData = await Promise.all(
          logsSnapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();
            const routeDoc = await getDoc(doc(db, 'routes', data.routeId));
            const routeData = routeDoc.exists() ? routeDoc.data() : {};
            return {
              id: docSnap.id,
              date: data.startedAt?.toDate().toLocaleDateString() || 'Unknown',
              time: data.startedAt?.toDate().toLocaleTimeString() || 'Unknown',
              status: data.completed ? 'Completed' : 'Ongoing',
              wasteTypes: data.wasteTypes || [],
              collector: `Truck #${data.truckId || 'Unknown'}`,
              notes: data.notes || '',
              routeName: routeData.name || 'Unnamed Route',
            };
          })
        );
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
          item.status === 'Completed' ? styles.completedStatus :
          item.status === 'Partial' ? styles.partialStatus :
          styles.pendingStatus
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
        <Text style={[styles.logText, isDarkMode && styles.darkText]}>{item.routeName}</Text>
      </View>

      <View style={styles.logRow}>
        <Ionicons name="person" size={20} color={iconColor} />
        <Text style={[styles.logText, isDarkMode && styles.darkText]}>{item.collector}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, isDarkMode && styles.darkContainer]}>
      <View style={styles.headerContainer}>
        <Text style={[styles.header, isDarkMode && styles.darkText]}>Collection History</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={logs}
          renderItem={renderLogItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
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
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  darkContainer: {
    backgroundColor: '#121212',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  darkText: {
    color: '#fff',
  },
  listContainer: {
    paddingBottom: 20,
  },
  logItem: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  darkItem: {
    backgroundColor: '#1E1E1E',
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  logDate: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
    marginRight: 'auto',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
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
    fontSize: 12,
    fontWeight: 'bold',
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  logText: {
    fontSize: 14,
    marginLeft: 10,
    color: '#333',
  },
});
