import React, { useContext, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  BackHandler,
  StatusBar,
} from 'react-native';
import { ThemeContext } from './ThemeContext';
import { db } from '../firebasecollector/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function CollectorsDashboard({ navigation }) {
  const { isDarkMode } = useContext(ThemeContext);
  const route = useRoute();

  const [collectorId, setCollectorId] = useState(route.params?.collectorId || 'N/A');
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [assignedTruck, setAssignedTruck] = useState(null);
  const [currentSchedule, setCurrentSchedule] = useState(null);
  const [collectionStatus, setCollectionStatus] = useState('uncollected');
  const [isOnline, setIsOnline] = useState(false);
  const [isLoggedOut, setIsLoggedOut] = useState(false);

  useEffect(() => {
    const incomingCollectorId = route.params?.collectorId;
    if (incomingCollectorId && incomingCollectorId !== 'N/A') {
      setCollectorId(incomingCollectorId);
    } else {
      console.error('Collector ID not provided');
      navigation.navigate('Login');
    }
  }, [route.params]);

  // Update collector status to online when component mounts
  useEffect(() => {
    if (!collectorId || collectorId === 'N/A') return;

    const updateOnlineStatus = async () => {
      try {
        const collectorRef = doc(db, 'collectors', collectorId);
        await updateDoc(collectorRef, {
          status: 'online',
          lastActive: serverTimestamp()
        });
        setIsOnline(true);
      } catch (error) {
        console.error('Error updating collector status to online:', error);
      }
    };

    updateOnlineStatus();

    return () => {
      if (collectorId && collectorId !== 'N/A') {
        const updateOfflineStatus = async () => {
          try {
            const collectorRef = doc(db, 'collectors', collectorId);
            await updateDoc(collectorRef, {
              status: 'offline',
              lastActive: serverTimestamp()
            });
          } catch (error) {
            console.error('Error updating collector status to offline:', error);
          }
        };
        updateOfflineStatus();
      }
    };
  }, [collectorId]);

  // Fetch collector's assigned truck, schedule, and status
  useEffect(() => {
    if (!collectorId || collectorId === 'N/A') return;

    const unsubscribeCollector = onSnapshot(
      doc(db, 'collectors', collectorId),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setAssignedTruck(data?.assignedTruck || null);
          setCurrentSchedule(data?.currentSchedule || null);
          setIsOnline(data?.status === 'online');
        }
      },
      (error) => {
        console.error('Error fetching collector data:', error);
      }
    );

    return () => unsubscribeCollector();
  }, [collectorId]);

  // Track collection status
  useEffect(() => {
    if (!currentSchedule) return;

    const unsubscribeCollection = onSnapshot(
      doc(db, 'collections', currentSchedule),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setCollectionStatus(data?.status || 'uncollected');
        }
      },
      (error) => {
        console.error('Error fetching collection status:', error);
      }
    );

    return () => unsubscribeCollection();
  }, [currentSchedule]);

  const fetchNotifications = useCallback(async () => {
    if (!collectorId || collectorId === 'N/A') return;

    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('collectorId', '==', collectorId),
        where('read', '==', false)
      );

      const snapshot = await getDocs(notificationsQuery);
      setNotificationsCount(snapshot.size);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, [collectorId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useFocusEffect(
    useCallback(() => {
      if (!collectorId || collectorId === 'N/A') return;

      let isMounted = true;
      let locationUpdateInterval = null;

      const fetchLocationRepeatedly = async () => {
        setLoading(true);
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            alert('Location permission denied.');
            return;
          }

          const updateLocation = async () => {
            try {
              const currentLocation = await Location.getCurrentPositionAsync({});
              if (!isMounted || isLoggedOut) return;

              setLocation(currentLocation.coords);

              if (collectorId && collectorId !== 'N/A') {
                const collectorRef = doc(db, 'collectors', collectorId);
                await updateDoc(collectorRef, {
                  location: {
                    latitude: currentLocation.coords.latitude,
                    longitude: currentLocation.coords.longitude,
                  },
                  ...(isMounted && !isLoggedOut && { status: 'online' }),
                  lastUpdated: serverTimestamp(),
                  lastActive: serverTimestamp()
                });

                if (assignedTruck) {
                  const truckRef = doc(db, 'trucks', assignedTruck);
                  await updateDoc(truckRef, {
                    location: {
                      latitude: currentLocation.coords.latitude,
                      longitude: currentLocation.coords.longitude,
                    },
                    lastUpdated: serverTimestamp(),
                    collectorId: collectorId,
                  });
                }
              }
            } catch (error) {
              console.error('Error updating location:', error);
            }
          };

          await updateLocation();
          locationUpdateInterval = setInterval(updateLocation, 15000);

        } catch (error) {
          console.error('Error getting location repeatedly:', error);
          alert('Failed to load location.');
        } finally {
          setLoading(false);
        }
      };

      fetchLocationRepeatedly();

      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);

      return () => {
        isMounted = false;
        backHandler.remove();
        if (locationUpdateInterval) {
          clearInterval(locationUpdateInterval);
        }
      };
    }, [collectorId, fetchNotifications, assignedTruck, isLoggedOut])
  );

  const handleNotificationPress = async () => {
    navigation.navigate('Notifications');

    if (!collectorId || collectorId === 'N/A') return;

    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('collectorId', '==', collectorId),
        where('read', '==', false)
      );

      const snapshot = await getDocs(notificationsQuery);
      const batch = writeBatch(db);
      snapshot.forEach(docSnap => {
        const ref = doc(db, 'notifications', docSnap.id);
        batch.update(ref, { read: true });
      });
      await batch.commit();

      fetchNotifications();
    } catch (error) {
      console.error('Error updating notifications:', error);
    }
  };

  const getStatusColor = () => {
    switch(collectionStatus?.toLowerCase()) {
      case 'approaching':
        return '#FFFF00'; // Yellow
      case 'collected':
        return '#00FF00'; // Green
      case 'missed':
        return '#FF0000'; // Red
      default:
        return '#FFA500'; // Orange (uncollected)
    }
  };

  const getStatusText = () => {
    switch(collectionStatus?.toLowerCase()) {
      case 'approaching':
        return 'Approaching Collection Point';
      case 'collected':
        return 'Collection Completed';
      case 'missed':
        return 'Collection Missed';
      default:
        return 'Ready for Collection';
    }
  };

  if (!collectorId || collectorId === 'N/A') {
    return (
      <View style={styles.container}>
        <Text>Error: Collector ID not available. Redirecting to login...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      
      {/* Top Bar */}
      <View style={[styles.appBar, isDarkMode && styles.darkAppBar]}>
        <View style={styles.collectorInfo}>
          <Text style={[styles.collectorIdText, isDarkMode && styles.darkText]}>
            Collector ID: {collectorId}
          </Text>
          <Text style={[styles.statusIndicator, isOnline ? styles.onlineStatus : styles.offlineStatus]}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>

        <TouchableOpacity 
          onPress={handleNotificationPress} 
          style={styles.notificationButton}
        >
          <Ionicons
            name="notifications-outline"
            size={24}
            color={isDarkMode ? "#fff" : "#000"}
          />
          {notificationsCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationText}>{notificationsCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Status Bar */}
      <View style={[styles.statusBar, { backgroundColor: getStatusColor() }]}>
        <Text style={styles.statusText}>{getStatusText()}</Text>
      </View>

      {/* Map View */}
      <View style={styles.mapContainer}>
        {location ? (
          <MapView
            style={styles.map}
            showsUserLocation
            region={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
          >
            <Marker 
              coordinate={location} 
              title="You are here"
              description={`Status: ${getStatusText()}`}
            >
              <View style={[styles.markerContainer, { backgroundColor: getStatusColor() }]}>
                <Ionicons 
                  name={assignedTruck ? "car" : "person"} 
                  size={24} 
                  color="#fff" 
                />
              </View>
            </Marker>
          </MapView>
        ) : (
          <ActivityIndicator style={styles.loader} size="large" color="#007AFF" />
        )}
      </View>

      {/* Info Container */}
      <View style={[styles.infoContainer, isDarkMode && styles.darkInfoContainer]}>
        <View style={styles.infoRow}>
          <Ionicons name="car" size={20} color={isDarkMode ? "#fff" : "#000"} />
          <Text style={[styles.infoText, isDarkMode && styles.darkText]}>
            Truck: {assignedTruck || 'Not assigned'}
          </Text>
        </View>
        
        <View style={styles.infoRow}>
          <Ionicons name="calendar" size={20} color={isDarkMode ? "#fff" : "#000"} />
          <Text style={[styles.infoText, isDarkMode && styles.darkText]}>
            Schedule: {currentSchedule || 'None'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: StatusBar.currentHeight || 35,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
  },
  darkAppBar: {
    backgroundColor: '#1c1c1e',
    borderColor: '#444',
  },
  collectorInfo: {
    flex: 1,
  },
  collectorIdText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statusIndicator: {
    fontSize: 14,
    marginTop: 4,
  },
  onlineStatus: {
    color: '#4CAF50',
  },
  offlineStatus: {
    color: '#F44336',
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: 'red',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },
  darkText: {
    color: '#fff',
  },
  statusBar: {
    paddingVertical: 10,
    backgroundColor: '#FFA500',
  },
  statusText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerContainer: {
    padding: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  darkInfoContainer: {
    backgroundColor: '#2c2c2e',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoText: {
    marginLeft: 10,
    fontSize: 16,
  },
});