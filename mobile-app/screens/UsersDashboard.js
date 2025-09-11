import React, { useContext, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  BackHandler,
  SafeAreaView,
  Platform,
  Dimensions,
  Modal,
  FlatList,
} from "react-native";
import { ThemeContext } from "./ThemeContext";
import { db } from "../firebasecollector/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  writeBatch,
  doc,
} from "firebase/firestore";
import { useRoute, useFocusEffect } from "@react-navigation/native";
import MapView, { Marker, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";
import polyline from "@mapbox/polyline";
import { responsive, wp, hp, fp, rp, isTablet, isSmallDevice } from "../utils/responsive";

const GOOGLE_ROUTES_API_KEY = "AIzaSyDp7VxhZMHKPdCSB4FTru40iVkmTQ7bU3M";

export default function UsersDashboard({ navigation, route }) {
  const { isDarkMode } = useContext(ThemeContext);

  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [trucks, setTrucks] = useState([]);
  const [routeCoords, setRouteCoords] = useState([]);
  const [mapRegion, setMapRegion] = useState(null);
  const [focusedCollector, setFocusedCollector] = useState(null);


  // decode polyline
  const decodePolyline = (encoded) => {
    const points = polyline.decode(encoded);
    return points.map(([lat, lng]) => ({
      latitude: lat,
      longitude: lng,
    }));
  };

  // fetch route
  const fetchRoute = async (origin, destination) => {
    if (!origin || !destination) return;

    try {
      const response = await fetch(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_ROUTES_API_KEY,
            "X-Goog-FieldMask": "routes.polyline.encodedPolyline",
          },
          body: JSON.stringify({
            origin: { location: { latLng: origin } },
            destination: { location: { latLng: destination } },
            travelMode: "DRIVE",
          }),
        }
      );

      const data = await response.json();
      if (data.routes && data.routes[0]?.polyline) {
        const coords = decodePolyline(
          data.routes[0].polyline.encodedPolyline
        );
        setRouteCoords(coords);
      }
    } catch (error) {
      console.error("Error fetching route:", error);
      setRouteCoords([]);
    }
  };

  // fetch user location + trucks + notifications count
  useFocusEffect(
    useCallback(() => {
      const initDashboard = async () => {
        setLoading(true);
        try {
          const { status } =
            await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") {
            alert("Location permission denied.");
            return;
          }
          const currentLocation = await Location.getCurrentPositionAsync({});
          setLocation(currentLocation.coords);

          const trucksQuery = collection(db, "trucks");
          const unsubscribe = onSnapshot(trucksQuery, (snapshot) => {
            const trucksData = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            setTrucks(trucksData);
          });

          // Fetch notifications count
          await fetchNotificationsCount();

          return unsubscribe;
        } catch (error) {
          console.error("Error loading dashboard:", error);
        } finally {
          setLoading(false);
        }
      };

      initDashboard();

      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        () => true
      );
      return () => backHandler.remove();
    }, [])
  );

  // Refresh notification count when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchNotificationsCount();
    }, [])
  );

  // Handle focus location from CollectorsList
  useFocusEffect(
    useCallback(() => {
      const { focusLocation } = route.params || {};
      if (focusLocation) {
        setFocusedCollector(focusLocation);
        setMapRegion({
          latitude: focusLocation.latitude,
          longitude: focusLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
        // Clear the focus after setting it
        navigation.setParams({ focusLocation: undefined });
      }
    }, [route.params, navigation])
  );

  // Fetch notifications count
  const fetchNotificationsCount = async () => {
    try {
      const { uid, userId } = route.params || {};
      let totalCount = 0;

      // Count regular notifications
      const notificationsQuery = query(
        collection(db, "notifications"),
        where("target", "==", "users"),
        where("read", "==", false)
      );
      const notificationsSnapshot = await getDocs(notificationsQuery);
      totalCount += notificationsSnapshot.docs.length;

      // Count report notifications
      if (userId) {
        const reportNotificationsQuery = query(
          collection(db, "notifications_reports"),
          where("users_id", "==", userId),
          where("status", "==", "unread")
        );
        const reportSnapshot = await getDocs(reportNotificationsQuery);
        totalCount += reportSnapshot.docs.length;
      }

      setNotificationsCount(totalCount);
    } catch (error) {
      console.error("Error fetching notifications count:", error);
    }
  };

  const handleNotificationPress = async () => {
    const { uid, userId } = route.params || {};
    navigation.navigate("UsersNotifications", { uid, userId });
    
    try {
      const batch = writeBatch(db);

      // Mark regular notifications as read
      const notificationsQuery = query(
        collection(db, "notifications"),
        where("target", "==", "users"),
        where("read", "==", false)
      );
      const notificationsSnapshot = await getDocs(notificationsQuery);
      notificationsSnapshot.forEach((docSnap) => {
        const notificationRef = doc(db, "notifications", docSnap.id);
        batch.update(notificationRef, { read: true });
      });

      // Mark report notifications as read
      if (userId) {
        const reportNotificationsQuery = query(
          collection(db, "notifications_reports"),
          where("users_id", "==", userId),
          where("status", "==", "unread")
        );
        const reportSnapshot = await getDocs(reportNotificationsQuery);
        reportSnapshot.forEach((docSnap) => {
          const reportNotificationRef = doc(db, "notifications_reports", docSnap.id);
          batch.update(reportNotificationRef, { status: "read" });
        });
      }

      await batch.commit();
      setNotificationsCount(0);
    } catch (error) {
      console.error("Error updating notifications:", error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Full Screen Map */}
      <View style={styles.mapContainer}>
        {location ? (
          <MapView
            style={StyleSheet.absoluteFillObject}
            region={mapRegion || {
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
          >
            {/* User marker */}
            <Marker coordinate={location} title="You are here">
              <Ionicons name="person-circle" size={responsive.iconSize['3xl']} color="blue" />
            </Marker>

            {/* Focused collector marker */}
            {focusedCollector && (
              <Marker 
                coordinate={{
                  latitude: focusedCollector.latitude,
                  longitude: focusedCollector.longitude,
                }}
                title={`${focusedCollector.collectorName}`}
                description={`Collector ID: ${focusedCollector.collectorId}`}
              >
                <FontAwesome5 name="truck" size={responsive.iconSize.xl} color="green" />
              </Marker>
            )}

            {/* Live trucks */}
            {trucks.map((truck) =>
              truck.location ? (
                <Marker
                  key={truck.id}
                  coordinate={{
                    latitude: truck.location.latitude,
                    longitude: truck.location.longitude,
                  }}
                  title={`Truck ${truck.id}`}
                  description="Live location"
                >
                  <FontAwesome5 name="truck" size={responsive.iconSize.xl} color="green" />
                </Marker>
              ) : null
            )}

            {/* Route */}
            {routeCoords.length > 0 && (
              <>
                <Marker
                  coordinate={routeCoords[routeCoords.length - 1]}
                  title="Destination"
                >
                  <Ionicons name="flag" size={responsive.iconSize.xl} color="red" />
                </Marker>
                <Polyline
                  coordinates={routeCoords}
                  strokeColor="#007AFF"
                  strokeWidth={rp(4)}
                />
              </>
            )}
          </MapView>
        ) : (
          <ActivityIndicator
            style={styles.loader}
            size="large"
            color="#007AFF"
          />
        )}
      </View>

      {/* Overlay Header */}
      <View style={[styles.topBar, isDarkMode && styles.darkTopBar]}>
        <View style={styles.titleContainer}>
          <Text style={[styles.header, isDarkMode && styles.darkText]}>
            {focusedCollector ? 'Viewing Collector' : 'Users Dashboard'}
          </Text>
          {focusedCollector && (
            <>
              <Text style={[styles.subHeader, isDarkMode && styles.darkSubText]}>
                {focusedCollector.collectorName}
              </Text>
              <Text style={[styles.subHeader, isDarkMode && styles.darkSubText]}>
                ID: {focusedCollector.collectorId}
              </Text>
            </>
          )}
        </View>
        <View style={styles.rightButtons}>
          {/* Collectors Button */}
          <TouchableOpacity 
            onPress={() => navigation.navigate('CollectorsList')} 
            style={styles.zoneButton}
          >
            <Ionicons
              name="people-outline"
              size={responsive.iconSize['2xl']}
              color="#007AFF"
            />
            <Text style={styles.zoneButtonText}>
              Collectors
            </Text>
          </TouchableOpacity>
          
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

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapContainer: {
    flex: 1,
  },
  loader: { 
    flex: 1 
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
  darkText: {
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
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
  zoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: responsive.borderRadius.lg,
    paddingHorizontal: responsive.spacing.sm,
    paddingVertical: responsive.spacing.xs,
    gap: responsive.spacing.xs,
    ...(isTablet() && {
      paddingHorizontal: responsive.spacing.base,
      paddingVertical: responsive.spacing.sm,
    }),
  },
  zoneButtonText: {
    fontSize: responsive.fontSize.sm,
    color: '#007AFF',
    fontWeight: '600',
    ...(isTablet() && { fontSize: responsive.fontSize.base }),
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
});
