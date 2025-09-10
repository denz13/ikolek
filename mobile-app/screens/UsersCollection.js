import React, { useContext, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, Platform
} from 'react-native';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../firebasecollector/firebase';
import * as Linking from 'expo-linking';
import { ThemeContext } from './ThemeContext';

const CollectionScreen = () => {
  const [ongoingCollections, setOngoingCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isDarkMode } = useContext(ThemeContext);

  useEffect(() => {
    const q = query(
      collection(db, 'collections'),
      where('completed', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOngoingCollections(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const openMap = (location) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
    Linking.openURL(url);
  };

  const renderItem = ({ item }) => (
    <View style={[styles.card, isDarkMode && styles.darkCard]}>
      <Text style={[styles.routeTitle, isDarkMode && styles.darkText]}>
        {item.routeId}
      </Text>
      <Text style={[styles.details, isDarkMode && styles.darkText]}>
        Started At: {item.startedAt?.toDate().toLocaleString()}
      </Text>
      <TouchableOpacity
        style={[styles.mapButton, isDarkMode && styles.darkMapButton]}
        onPress={() => openMap(item.routeId)}
      >
        <Text style={styles.mapButtonText}>Navigate</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, isDarkMode && styles.darkContainer]}>
      {/* Fixed Heading */}
      <Text style={[styles.heading, isDarkMode && styles.darkText]}>
        Ongoing Collections
      </Text>

      {/* Scrollable list */}
      <View style={styles.listWrapper}>
        {loading ? (
          <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 50 }} />
        ) : ongoingCollections.length === 0 ? (
          <Text style={[styles.noDataText, isDarkMode && styles.darkText]}>
            No ongoing collections.
          </Text>
        ) : (
          <FlatList
            data={ongoingCollections}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 60,
    backgroundColor: '#F9FAF5',
  },
  darkContainer: {
    backgroundColor: '#121212',
  },
  heading: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 12,
    textAlign: 'center',
  },
  darkText: {
    color: '#fff',
  },
  listWrapper: {
    flex: 1, // ensures scroll area takes remaining space
  },
  card: {
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  darkCard: {
    backgroundColor: '#1E1E1E',
    borderColor: '#333',
    borderWidth: 1,
  },
  routeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B5E20',
    marginBottom: 4,
  },
  details: {
    fontSize: 14,
    color: '#4E4E4E',
    marginBottom: 8,
  },
  mapButton: {
    backgroundColor: '#388E3C',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  darkMapButton: {
    backgroundColor: '#2E7D32',
  },
  mapButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  list: {
    paddingBottom: 20,
  },
  noDataText: {
    fontSize: 16,
    color: '#777',
    textAlign: 'center',
    marginTop: 50,
  },
});

export default CollectionScreen;
