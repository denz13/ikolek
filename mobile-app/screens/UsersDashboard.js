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

const GOOGLE_ROUTES_API_KEY = "AIzaSyDp7VxhZMHKPdCSB4FTru40iVkmTQ7bU3M";

export default function UsersDashboard({ navigation }) {
  const { isDarkMode } = useContext(ThemeContext);
  const route = useRoute();

  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [trucks, setTrucks] = useState([]);
  const [routeCoords, setRouteCoords] = useState([]);

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

  // fetch user location + trucks
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

  const handleNotificationPress = async () => {
    navigation.navigate("UsersNotifications");
    try {
      const notificationsQuery = query(
        collection(db, "notifications"),
        where("read", "==", false)
      );
      const notificationsSnapshot = await getDocs(notificationsQuery);
      const batch = writeBatch(db);

      notificationsSnapshot.forEach((docSnap) => {
        const notificationRef = doc(db, "notifications", docSnap.id);
        batch.update(notificationRef, { read: true });
      });

      await batch.commit();
      setNotificationsCount(0);
    } catch (error) {
      console.error("Error updating notifications:", error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Fixed Top App Bar */}
      <View style={[styles.appBar, isDarkMode && styles.darkAppBar]}>
        <Text style={[styles.appTitle, isDarkMode && styles.darkText]}>
          Users Dashboard
        </Text>
        <TouchableOpacity onPress={handleNotificationPress}>
          <View style={styles.notificationContainer}>
            <Ionicons
              name="notifications-outline"
              size={26}
              color={isDarkMode ? "#fff" : "#000"}
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

      {/* Scrollable Map Content */}
      <View style={styles.content}>
        {location ? (
          <MapView
            style={StyleSheet.absoluteFillObject}
            region={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
          >
            {/* User marker */}
            <Marker coordinate={location} title="You are here">
              <Ionicons name="person-circle" size={36} color="blue" />
            </Marker>

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
                  <FontAwesome5 name="truck" size={28} color="green" />
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
                  <Ionicons name="flag" size={28} color="red" />
                </Marker>
                <Polyline
                  coordinates={routeCoords}
                  strokeColor="#007AFF"
                  strokeWidth={4}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  loader: { flex: 1 },
  appBar: {
    position: "absolute",
    top: Platform.OS === "android" ? 25 : 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    height: 60,
    borderBottomWidth: 1,
    borderColor: "#ccc",
    elevation: 3,
    zIndex: 10,
  },
  darkAppBar: { backgroundColor: "#1c1c1e", borderColor: "#444" },
  appTitle: { fontSize: 20, fontWeight: "bold", color: "#333" },
  darkText: { color: "#fff" },
  notificationContainer: { position: "relative" },
  notificationBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "red",
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  notificationText: { fontSize: 10, color: "#fff", fontWeight: "bold" },
  content: {
    flex: 1,
    marginTop: Platform.OS === "android" ? 85 : 75, // push below app bar
  },
});
