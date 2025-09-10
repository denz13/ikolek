import React, { useContext, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, Platform, ActivityIndicator,
} from 'react-native';
import { ThemeContext } from './ThemeContext';
import { db } from '../firebasecollector/firebase';
import {
  doc, getDoc, setDoc, collection, serverTimestamp,
  query, where, getDocs,
} from 'firebase/firestore';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function CollectionScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { collectorId } = route.params || {};

  const { isDarkMode } = useContext(ThemeContext);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assignedRoutes, setAssignedRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [truckId, setTruckId] = useState(null);

  // Fetch assigned routes for collector
  const fetchAssignedRoutes = async () => {
    setLoading(true);
    try {
      if (!collectorId) {
        Alert.alert('Error', 'Collector ID is missing.');
        setLoading(false);
        return;
      }

      const collectorRef = doc(db, 'collectors', collectorId);
      const collectorSnap = await getDoc(collectorRef);

      if (!collectorSnap.exists()) {
        Alert.alert('Error', 'Collector not found.');
        setLoading(false);
        return;
      }

      const collectorData = collectorSnap.data();
      const routeIds = collectorData.assignedRoutes || [];
      const truckIdFromCollector = collectorData.assignedTruck || null;
      setTruckId(truckIdFromCollector);

      if (routeIds.length === 0) {
        setAssignedRoutes([]);
        setLoading(false);
        return;
      }

      // Fetch all routes data, NO automatic missed or completed marking
      const routeDataPromises = routeIds.map(async (routeId) => {
        const routeDoc = await getDoc(doc(db, 'routes', routeId));
        if (!routeDoc.exists()) return null;
        const routeData = routeDoc.data();

        // Query collections for this route and collector
        const collectionsQuery = query(
          collection(db, 'collections'),
          where('routeId', '==', routeId),
          where('collectorId', '==', collectorId)
        );
        const collectionsSnap = await getDocs(collectionsQuery);

        let status = 'pending'; // default
        let collectionId = null;

        if (!collectionsSnap.empty) {
          // Get latest collection
          const latestCollection = collectionsSnap.docs[collectionsSnap.docs.length - 1];
          collectionId = latestCollection.id;
          const latestData = latestCollection.data();

          if (latestData.completed) {
            status = 'completed';
          } else if (latestData.missedPoints && latestData.missedPoints.length > 0) {
            status = 'has_missed';
          } else {
            status = 'in_progress';
          }
        }

        return {
          id: routeDoc.id,
          routeId: routeData.routeId || routeDoc.id,
          origin: routeData.origin || 'Unknown',
          destination: routeData.destination || 'Unknown',
          distance: routeData.distance || 'N/A',
          duration: routeData.duration || 'N/A',
          status,
          collectionId,
        };
      });

      const routeDocs = await Promise.all(routeDataPromises);
      setAssignedRoutes(routeDocs.filter(Boolean));
    } catch (error) {
      console.error('Error fetching assigned routes:', error);
      Alert.alert('Error', 'Failed to load assigned routes.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch routes on screen focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchAssignedRoutes();
      setSelectedRoute(null); // Reset selection on refresh
    });
    return unsubscribe;
  }, [navigation]);

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAssignedRoutes();
    setRefreshing(false);
  };

  // Handle starting or reviewing collection
  const handleStartCollection = async () => {
    if (!selectedRoute) {
      Alert.alert('No Route Selected', 'Please select a route to begin collection.');
      return;
    }

    const { id: routeId, status, collectionId } = selectedRoute;

    if (status === 'completed') {
      Alert.alert('Already Completed', 'This collection has already been completed.');
      return;
    }

    try {
      // If there's an existing incomplete collection
      if (collectionId) {
        const collectionRef = doc(db, 'collections', collectionId);
        const collectionDoc = await getDoc(collectionRef);

        if (collectionDoc.exists() && !collectionDoc.data().completed) {
          // Navigate to review collection screen
          navigation.navigate('ReviewCollection', {
            routeInfo: selectedRoute,
            collectorId,
            collectionId,
            onComplete: handleCollectionComplete, // callback for when collection completes
          });
          return;
        }
      }

      // Start new collection
      Alert.alert(
        'Confirm Start',
        `Start collection for route:\n\n🛣️ ${selectedRoute.routeId}\n📍 From: ${selectedRoute.origin}\n➡️ To: ${selectedRoute.destination}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Start',
            onPress: async () => {
              const newCollectionRef = doc(collection(db, 'collections'));
              await setDoc(newCollectionRef, {
                id: newCollectionRef.id,
                collectorId,
                routeId,
                truckId,
                startedAt: serverTimestamp(),
                completed: false,
                missedPoints: [],
              });
              navigation.navigate('ReviewCollection', {
                routeInfo: selectedRoute,
                collectorId,
                collectionId: newCollectionRef.id,
                onComplete: handleCollectionComplete,
              });
            },
          },
        ],
      );
    } catch (error) {
      console.error('Error starting collection:', error);
      Alert.alert('Error', 'Could not start collection. Please try again.');
    }
  };

  // Callback when collection completes or is marked for review
  const handleCollectionComplete = (wasReviewed) => {
    Alert.alert(
      'Collection Completed',
      'Do you want to start another collection?',
      [
        {
          text: 'No',
          onPress: () => navigation.navigate('CollectorsDashboard'),
          style: 'cancel',
        },
        {
          text: 'Yes',
          onPress: () => {
            // Refresh routes and reset selection to start another collection
            fetchAssignedRoutes();
            setSelectedRoute(null);
          },
        },
      ],
      { cancelable: false }
    );
  };

  // Render each route item in list
  const renderRouteItem = ({ item }) => {
    const isSelected = selectedRoute?.id === item.id;
    // No disabled routes, collectors can select any assigned route
    // Removed automatic missed/completed disabling per instructions

    let statusIcon = '';
    if (item.status === 'completed') statusIcon = '✅';
    else if (item.status === 'has_missed') statusIcon = '⚠️';
    else if (item.status === 'in_progress') statusIcon = '🕗';

    return (
      <TouchableOpacity
        style={[
          styles.routeItem,
          isSelected && styles.selectedRoute,
          isDarkMode && styles.darkItem,
          isDarkMode && isSelected && styles.darkSelectedRoute,
        ]}
        onPress={() => setSelectedRoute(item)}
        activeOpacity={0.7}
      >
        <Text style={[styles.routeTitle, isDarkMode && styles.darkText]}>
          {item.routeId} {statusIcon}
        </Text>
        <Text style={[styles.routeDetail, isDarkMode && styles.darkText]}>
          📍 From: {item.origin}
        </Text>
        <Text style={[styles.routeDetail, isDarkMode && styles.darkText]}>
          ➡️ To: {item.destination}
        </Text>
        <Text style={[styles.routeDetail, isDarkMode && styles.darkText]}>
          📏 Distance: {item.distance}
        </Text>
        <Text style={[styles.routeDetail, isDarkMode && styles.darkText]}>
          ⏰ Duration: {item.duration}
        </Text>
        {item.status === 'has_missed' && (
          <Text style={[styles.missedText, isDarkMode && styles.darkMissedText]}>
            Has missed points - tap to review
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, isDarkMode && styles.darkContainer]}>
      <View style={styles.headerContainer}>
        <Text style={[styles.headerTitle, isDarkMode && styles.darkText]}>
          Start Collection
        </Text>
      </View>

      <Text style={[styles.title, isDarkMode && styles.darkText]}>
        Assigned Zones
      </Text>

      {loading ? (
        <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 50 }} />
      ) : assignedRoutes.length === 0 ? (
        <Text style={[{ textAlign: 'center', marginTop: 30 }, isDarkMode && styles.darkText]}>
          No assigned routes found.
        </Text>
      ) : (
        <FlatList
          data={assignedRoutes}
          keyExtractor={(item) => item.id}
          renderItem={renderRouteItem}
          contentContainerStyle={{ paddingBottom: 20 }}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={handleStartCollection}
          style={[
            styles.button,
            selectedRoute ? styles.buttonActive : styles.buttonDisabled,
            isDarkMode && (selectedRoute ? styles.darkButtonActive : styles.darkButtonDisabled),
          ]}
          disabled={!selectedRoute}
        >
          <Text style={styles.buttonText}>
            {selectedRoute?.status === 'has_missed' ? 'Review Collection' : 'Start Collection'}
          </Text>
        </TouchableOpacity>
        {/* Removed Back to Dashboard button */}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 60,
    backgroundColor: '#fff',
  },
  darkContainer: {
    backgroundColor: '#121212',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  darkText: {
    color: '#fff',
  },
  routeItem: {
    padding: 16,
    backgroundColor: '#f4f4f4',
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  darkItem: {
    backgroundColor: '#1E1E1E',
    borderColor: '#333',
  },
  selectedRoute: {
    backgroundColor: '#4CAF50',
    borderColor: '#388E3C',
    borderWidth: 2,
  },
  darkSelectedRoute: {
    backgroundColor: '#388E3C',
    borderColor: '#66BB6A',
  },
  routeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
  },
  routeDetail: {
    fontSize: 14,
    color: '#555',
    marginBottom: 2,
  },
  missedText: {
    fontSize: 12,
    color: '#FF5722',
    marginTop: 4,
    fontStyle: 'italic',
  },
  darkMissedText: {
    color: '#FF8A65',
  },
  buttonContainer: {
    marginTop: 'auto',
    marginBottom: 20,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonActive: {
    backgroundColor: '#4CAF50',
  },
  buttonDisabled: {
    backgroundColor: '#A9A9A9',
  },
  darkButtonActive: {
    backgroundColor: '#2E7D32',
  },
  darkButtonDisabled: {
    backgroundColor: '#555',
  },
});
