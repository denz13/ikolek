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
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { responsive, wp, hp, fp, rp, isTablet, isSmallDevice } from '../utils/responsive';

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
  const [scheduleDetails, setScheduleDetails] = useState(null);
  const [allSchedules, setAllSchedules] = useState([]);
  const [expandedSchedules, setExpandedSchedules] = useState({});
  const [todayScheduleLocation, setTodayScheduleLocation] = useState(null);
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

  // Fetch collector's assigned truck and status
  useEffect(() => {
    if (!collectorId || collectorId === 'N/A') return;

    const unsubscribeCollector = onSnapshot(
      doc(db, 'collectors', collectorId),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setAssignedTruck(data?.assignedTruckId || null);
          setIsOnline(data?.status === 'online');
          
          // Try to find schedule by assigned truck first
          if (data?.assignedTruckId) {
            fetchScheduleByTruck(data.assignedTruckId).then(() => {
              // If no schedule found by truck, try by collector name as fallback
              if (!currentSchedule && data?.firstName && data?.lastName) {
                console.log('Truck search failed, trying collector name search...');
                fetchScheduleByCollectorName(data.firstName, data.lastName);
              }
            });
          } else {
            // If no assigned truck, try to find schedule by collector name
            if (data?.firstName && data?.lastName) {
              fetchScheduleByCollectorName(data.firstName, data.lastName);
            }
          }
        }
      },
      (error) => {
        console.error('Error fetching collector data:', error);
      }
    );

    return () => unsubscribeCollector();
  }, [collectorId]);

  // Fetch schedule by truck ID
  const fetchScheduleByTruck = async (truckId) => {
    try {
      console.log('Searching for schedule with truck ID:', truckId);
      const schedulesQuery = query(
        collection(db, 'schedules'),
        where('groupName', '==', truckId)
      );
      const snapshot = await getDocs(schedulesQuery);
      
      if (!snapshot.empty) {
        const scheduleDoc = snapshot.docs[0];
        console.log('Found schedule by truck ID:', scheduleDoc.id);
        setCurrentSchedule(scheduleDoc.id);
        setScheduleDetails(scheduleDoc.data());
      } else {
        console.log('No schedule found by truck ID, will try by collector name');
        setCurrentSchedule(null);
        setScheduleDetails(null);
      }
    } catch (error) {
      console.error('Error fetching schedule by truck:', error);
      setCurrentSchedule(null);
    }
  };

  // Fetch schedule by collector name
  const fetchScheduleByCollectorName = async (firstName, lastName) => {
    try {
      console.log('Searching for schedule with collector name:', firstName, lastName);
      
      // Search in schedules collection for collector name
      const schedulesQuery = query(
        collection(db, 'schedules')
      );
      const snapshot = await getDocs(schedulesQuery);
      
      let foundSchedules = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log('Checking schedule:', doc.id, data);
        
        const fullName = `${firstName} ${lastName}`.toLowerCase();
        const reverseName = `${lastName} ${firstName}`.toLowerCase();
        
        // Check if driver field contains the collector name
        if (data.driver) {
          const driverName = data.driver.toLowerCase().trim();
          if (driverName.includes(fullName) || 
              driverName.includes(reverseName) ||
              driverName.includes(firstName.toLowerCase()) ||
              driverName.includes(lastName.toLowerCase())) {
            console.log('Found schedule with collector as driver:', doc.id, data);
            foundSchedules.push({
              id: doc.id,
              ...data
            });
          }
        }
        
        // Check if members array contains the collector name
        if (data.members && Array.isArray(data.members)) {
          const hasCollector = data.members.some(member => {
            const memberName = member.toLowerCase();
            
            return memberName.includes(fullName) || 
                   memberName.includes(reverseName) ||
                   memberName.includes(firstName.toLowerCase()) ||
                   memberName.includes(lastName.toLowerCase());
          });
          
          if (hasCollector) {
            console.log('Found schedule with collector in members:', doc.id, data);
            foundSchedules.push({
              id: doc.id,
              ...data
            });
          }
        }
      });
      
      if (foundSchedules.length > 0) {
        console.log(`Found ${foundSchedules.length} schedules for collector`);
        setAllSchedules(foundSchedules);
        setCurrentSchedule(foundSchedules[0].id);
        setScheduleDetails(foundSchedules[0]);
      } else {
        console.log('No schedule found with collector name');
        setCurrentSchedule(null);
        setScheduleDetails(null);
        setAllSchedules([]);
      }
    } catch (error) {
      console.error('Error fetching schedule by collector name:', error);
      setCurrentSchedule(null);
      setAllSchedules([]);
    }
  };

  // Toggle schedule expansion
  const toggleScheduleExpansion = (scheduleId) => {
    setExpandedSchedules(prev => ({
      ...prev,
      [scheduleId]: !prev[scheduleId]
    }));
  };

  // Geocode location to coordinates in Talisay City, Negros Occidental
  const geocodeLocation = async (location) => {
    try {
      if (!location) {
        console.log('No location provided, using default Talisay City coordinates');
        return { lat: 10.7372, lng: 122.9673 };
      }

      // Get all unique locations from schedules to build dynamic mapping
      const allLocations = [...new Set(allSchedules.map(s => s.location).filter(Boolean))];
      console.log('All available locations from schedules:', allLocations);

      // Base coordinates for Talisay City, Negros Occidental
      const talisayBase = { lat: 10.7372, lng: 122.9673 };
      
      // Generate coordinates based on location name hash for consistency
      const locationHash = location.split('').reduce((hash, char) => {
        return hash + char.charCodeAt(0);
      }, 0);
      
      // Create consistent coordinates based on location name
      const latOffset = (locationHash % 100) / 10000; // Small offset for latitude
      const lngOffset = ((locationHash * 7) % 100) / 10000; // Small offset for longitude
      
      const coordinates = {
        lat: talisayBase.lat + latOffset,
        lng: talisayBase.lng + lngOffset
      };

      console.log(`Geocoded location "${location}" -> ${JSON.stringify(coordinates)}`);
      return coordinates;
      
    } catch (error) {
      console.error('Error geocoding location:', error);
      return { lat: 10.7372, lng: 122.9673 }; // Default Talisay City coordinates
    }
  };

  // Update today's schedule location when schedules change
  useEffect(() => {
    if (allSchedules.length === 0) {
      setTodayScheduleLocation(null);
      return;
    }
    
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    console.log('Today is:', today);
    console.log('Available schedule days:', allSchedules.map(s => s.day));
    
    const todaySchedule = allSchedules.find(schedule => 
      schedule.day && schedule.day.toLowerCase() === today.toLowerCase()
    );
    
    if (todaySchedule) {
      console.log('Today schedule found:', todaySchedule);
      console.log('Location to geocode:', todaySchedule.location);
      // Geocode the location to get coordinates
      geocodeLocation(todaySchedule.location).then(coordinates => {
        console.log('Geocoded coordinates:', coordinates);
        // Force update with correct coordinates
        const correctedCoordinates = {
          latitude: coordinates.lat,
          longitude: coordinates.lng
        };
        console.log('Setting corrected coordinates:', correctedCoordinates);
        setTodayScheduleLocation(correctedCoordinates);
      });
    } else {
      setTodayScheduleLocation(null);
    }
  }, [allSchedules]);

  // Check if today matches any scheduled day
  const getTodayScheduleStatus = () => {
    if (allSchedules.length === 0) return 'No active schedule';
    
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const todaySchedule = allSchedules.find(schedule => 
      schedule.day && schedule.day.toLowerCase() === today.toLowerCase()
    );
    
    if (todaySchedule) {
      return `${todaySchedule.time} - ${todaySchedule.location}`;
    }
    
    return 'No active schedule';
  };

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


  if (!collectorId || collectorId === 'N/A') {
    return (
      <View style={styles.container}>
        <Text>Error: Collector ID not available. Redirecting to login...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      
      {/* Overlay Header */}
      <View style={[styles.topBar, isDarkMode && styles.darkTopBar]}>
        <View style={styles.titleContainer}>
          <Text style={[styles.header, isDarkMode && styles.darkText]}>
            Collectors Dashboard
          </Text>
          <Text style={[styles.subHeader, isDarkMode && styles.darkSubText]}>
            Collector ID: {collectorId}
          </Text>
          <Text style={[styles.subHeader, isDarkMode && styles.darkSubText]}>
            Status: {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
        <View style={styles.rightButtons}>
          {/* Notification Bell */}
          <TouchableOpacity onPress={handleNotificationPress} style={styles.notificationButton}>
            <View style={styles.notificationContainer}>
              <Ionicons
                name="notifications-outline"
                size={responsive.iconSize['2xl']}
                color={notificationsCount > 0 ? "#ff4444" : "#4CAF50"}
              />
              {notificationsCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationText}>
                    {notificationsCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>


      {/* Full Screen Map */}
      <View style={styles.mapContainer}>
        {console.log('Rendering map with:', {
          location,
          todayScheduleLocation,
          hasLocation: !!location,
          hasScheduleLocation: !!todayScheduleLocation
        })}
        <MapView
          style={StyleSheet.absoluteFillObject}
          showsUserLocation={!!location}
          region={{
            latitude: todayScheduleLocation ? todayScheduleLocation.latitude : (location ? location.latitude : 10.7372),
            longitude: todayScheduleLocation ? todayScheduleLocation.longitude : (location ? location.longitude : 122.9673),
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          initialRegion={{
    latitude: 10.7372,
    longitude: 122.9673,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          onMapReady={() => console.log('Map is ready')}
          onRegionChangeComplete={(region) => console.log('Map region:', region)}
        >
          {/* Collector's Current Location */}
          {location && (
            <Marker 
              coordinate={location} 
              title="You are here"
              description="Collector Location"
            >
              <View style={[styles.markerContainer, { backgroundColor: '#4CAF50' }]}>
                <FontAwesome5 
                  name="truck" 
                  size={20} 
                  color="#fff" 
                />
              </View>
            </Marker>
          )}

          {/* Today's Schedule Location */}
          {todayScheduleLocation && (
            <Marker 
              coordinate={todayScheduleLocation} 
              title="Today's Schedule Location"
              description="Work Location"
            >
              <View style={[styles.markerContainer, { backgroundColor: '#FF9800' }]}>
                <FontAwesome5 
                  name="truck" 
                  size={20} 
                  color="#fff" 
                />
              </View>
            </Marker>
          )}

          {/* Default Talisay City Marker if no location */}
          {!location && !todayScheduleLocation && (
            <Marker 
              coordinate={{ latitude: 10.737, longitude: 122.967 }} 
              title="Talisay City"
              description="Default Location"
            >
              <View style={[styles.markerContainer, { backgroundColor: '#2196F3' }]}>
                <FontAwesome5 
                  name="truck" 
                  size={20} 
                  color="#fff" 
                />
              </View>
            </Marker>
          )}
        </MapView>
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
            Schedule: {getTodayScheduleStatus()}
          </Text>
        </View>

        {/* Schedule Details */}
        {allSchedules.length > 0 && (
          <View style={[styles.scheduleDetailsContainer, isDarkMode && styles.darkScheduleDetailsContainer]}>
            <Text style={[styles.scheduleDetailsTitle, isDarkMode && styles.darkText]}>
              My Schedules ({allSchedules.length})
            </Text>
            
            {allSchedules.map((schedule, index) => {
              const isExpanded = expandedSchedules[schedule.id];
              return (
                <View key={schedule.id} style={[styles.scheduleItem, index > 0 && styles.scheduleItemSeparator]}>
                  {/* Schedule Header - Always Visible */}
                  <TouchableOpacity 
                    style={styles.scheduleHeader}
                    onPress={() => toggleScheduleExpansion(schedule.id)}
                  >
                    <View style={styles.scheduleHeaderLeft}>
                      <Ionicons name="calendar-outline" size={18} color="#FF5722" />
                      <Text style={[styles.scheduleHeaderText, isDarkMode && styles.darkText]}>
                        {schedule.day || 'N/A'} - {schedule.time || 'N/A'}
                      </Text>
                    </View>
                    <Ionicons 
                      name={isExpanded ? "chevron-up" : "chevron-down"} 
                      size={20} 
                      color={isDarkMode ? "#fff" : "#000"} 
                    />
                  </TouchableOpacity>
                  
                  {/* Collapsible Schedule Details */}
                  {isExpanded && (
                    <View style={styles.scheduleDetailsContent}>
                      <View style={styles.scheduleDetailRow}>
                        <Ionicons name="location" size={16} color="#FF9800" />
                        <Text style={[styles.scheduleDetailText, isDarkMode && styles.darkText]}>
                          {schedule.location || 'N/A'}
                        </Text>
                      </View>
                      
                      <View style={styles.scheduleDetailRow}>
                        <Ionicons name="car" size={16} color="#2196F3" />
                        <Text style={[styles.scheduleDetailText, isDarkMode && styles.darkText]}>
                          {schedule.groupName || 'N/A'}
                        </Text>
                      </View>
                      
                      <View style={styles.scheduleDetailRow}>
                        <Ionicons name="map" size={16} color="#9C27B0" />
                        <Text style={[styles.scheduleDetailText, isDarkMode && styles.darkText]}>
                          Zone: {schedule.zone || 'N/A'}
                        </Text>
                      </View>
                      
                      {schedule.members && schedule.members.length > 0 && (
                        <View style={styles.scheduleDetailRow}>
                          <Ionicons name="people" size={16} color="#009688" />
                          <Text style={[styles.scheduleDetailText, isDarkMode && styles.darkText]}>
                            Members: {schedule.members.join(', ')}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  topBar: {
    position: 'absolute',
    top: responsive.spacing['4xl'],
    left: responsive.spacing.xl,
    right: responsive.spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    height: responsive.spacing['4xl'],
    zIndex: 1000,
    ...(isTablet() && {
      top: responsive.spacing['5xl'],
      left: responsive.spacing['3xl'],
      right: responsive.spacing['3xl'],
      height: responsive.spacing['5xl'],
    }),
  },
  darkTopBar: {
    // Add any dark mode specific styling for overlay if needed
  },
  titleContainer: {
    position: 'absolute',
    left: 0,
    paddingLeft: responsive.spacing.xl,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    top: 0,
  },
  header: {
    fontSize: responsive.fontSize['2xl'],
    fontWeight: 'bold',
    color: '#333',
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    ...(isSmallDevice() && { fontSize: responsive.fontSize.xl }),
    ...(isTablet() && { fontSize: responsive.fontSize['3xl'] }),
  },
  subHeader: {
    fontSize: responsive.fontSize.sm,
    fontWeight: '500',
    color: '#666',
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    marginTop: responsive.spacing.xs,
    ...(isSmallDevice() && { fontSize: responsive.fontSize.xs }),
    ...(isTablet() && { fontSize: responsive.fontSize.base }),
  },
  darkSubText: {
    color: '#ccc',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  rightButtons: {
    position: "absolute",
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.spacing.sm,
  },
  notificationButton: {
    padding: responsive.spacing.sm,
    ...(isTablet() && {
      padding: responsive.spacing.base,
    }),
  },
  notificationContainer: { 
    position: "relative" 
  },
  notificationBadge: {
    position: "absolute",
    top: rp(-5),
    right: rp(-5),
    backgroundColor: "red",
    width: rp(18),
    height: rp(18),
    borderRadius: rp(9),
    justifyContent: "center",
    alignItems: "center",
    ...(isTablet() && {
      width: rp(22),
      height: rp(22),
      borderRadius: rp(11),
    }),
  },
  notificationText: { 
    fontSize: responsive.fontSize.xs, 
    color: "#fff", 
    fontWeight: "bold",
    ...(isTablet() && { fontSize: responsive.fontSize.sm }),
  },
  darkText: {
    color: '#fff',
  },
  scheduleDetailsContainer: {
    backgroundColor: '#f8f9fa',
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  darkScheduleDetailsContainer: {
    backgroundColor: '#2a2a2a',
  },
  scheduleDetailsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  scheduleDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  scheduleDetailText: {
    fontSize: 14,
    color: '#555',
    marginLeft: 8,
    flex: 1,
  },
  scheduleItem: {
    marginBottom: 8,
  },
  scheduleItemSeparator: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 8,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  scheduleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  scheduleHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  scheduleDetailsContent: {
    paddingLeft: 26,
    paddingTop: 8,
    paddingBottom: 4,
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