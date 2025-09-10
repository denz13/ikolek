import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { db } from '../firebasecollector/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { ThemeContext } from './ThemeContext';

export default function ReviewCollection() {
  const navigation = useNavigation();
  const route = useRoute();
  const { routeInfo, collectorId } = route.params || {};
  const [missedPoints, setMissedPoints] = useState(false);
  const [loading, setLoading] = useState(false);
  const { isDarkMode } = useContext(ThemeContext);

  const completeCollection = async () => {
  setLoading(true);
  try {
    if (!collectorId || !routeInfo?.routeId) {
      throw new Error('Missing required collector or route information');
    }

    // Query collections collection by collectorId and routeId
    const q = query(
      collection(db, 'collections'),
      where('collectorId', '==', collectorId),
      where('routeId', '==', routeInfo.routeId)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new Error('Collection record not found');
    }

    const docSnap = querySnapshot.docs[0];
    const docRef = docSnap.ref;

    await updateDoc(docRef, {
      completed: true,
      missedPoints: missedPoints || false,
      completedAt: serverTimestamp(),
    });

    Alert.alert(
      'Collection Complete ✅',
      'Do you want to collect another route?',
      [
        {
          text: 'No',
          onPress: () => {
            console.log('Button index 0 (No) pressed');
            navigation.navigate('CollectorsDashboard');
          },
          style: 'cancel',
          // index: 0 // (cannot add index property here; just handle in onPress)
        },
        {
          text: 'Yes',
          onPress: () => {
            console.log('Button index 1 (Yes) pressed');
            navigation.navigate('Collection', { collectorId });
          },
          // index: 1
        },
      ],
      { cancelable: false }
    );
  } catch (error) {
    console.error('Error completing collection:', error);
    Alert.alert('Error', error.message || 'Could not complete the collection.');
  } finally {
    setLoading(false);
  }
};


  const cancelCollection = () => {
    navigation.goBack();
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Not available';
    try {
      const date = timestamp.toDate();
      return date.toLocaleString();
    } catch (e) {
      return 'Invalid date';
    }
  };

  return (
    <View style={[styles.container, isDarkMode && styles.darkContainer]}>
      <Text style={[styles.header, isDarkMode && styles.darkText]}>
        Review Collection
      </Text>

      <View style={[styles.infoCard, isDarkMode && styles.darkCard]}>
        <InfoItem label="Route ID" value={routeInfo?.routeId || 'N/A'} isDark={isDarkMode} />
        <InfoItem label="Started At" value={formatDate(routeInfo?.createdAt)} isDark={isDarkMode} />

        <View style={styles.routeSection}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>Route Details</Text>
          <InfoItem label="Origin" value={routeInfo?.origin || 'N/A'} isDark={isDarkMode} />
          <InfoItem label="Origin Point ID" value={routeInfo?.originPointId || 'N/A'} isDark={isDarkMode} />
          <InfoItem label="Destination" value={routeInfo?.destination || 'N/A'} isDark={isDarkMode} />
          <InfoItem label="Destination Point ID" value={routeInfo?.destinationPointId || 'N/A'} isDark={isDarkMode} />
        </View>

        <View style={styles.routeSection}>
          <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>Journey Information</Text>
          <InfoItem label="Distance" value={routeInfo?.distance || 'N/A'} isDark={isDarkMode} />
          <InfoItem label="Estimated Duration" value={routeInfo?.duration || 'N/A'} isDark={isDarkMode} />
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.option,
          missedPoints && styles.optionSelected,
          isDarkMode && styles.darkOption,
        ]}
        onPress={() => setMissedPoints(!missedPoints)}
        disabled={loading}
      >
        <Text
          style={[
            styles.optionText,
            missedPoints && styles.optionTextSelected,
            isDarkMode && styles.darkOptionText,
          ]}
        >
          {missedPoints ? '✅ Missed Points Marked' : 'Mark Missed Points'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.completeButton, isDarkMode && styles.darkCompleteButton]}
        onPress={completeCollection}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Complete Collection</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.cancelButton, isDarkMode && styles.darkCancelButton]}
        onPress={cancelCollection}
        disabled={loading}
      >
        <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const InfoItem = ({ label, value, isDark }) => (
  <View style={styles.infoItem}>
    <Text style={[styles.label, isDark && styles.darkText]}>{label}:</Text>
    <Text style={[styles.value, isDark && styles.darkText]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 50 : 70,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
  },
  darkContainer: {
    backgroundColor: '#121212',
  },
  header: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
    color: '#2E2E2E',
  },
  darkText: {
    color: '#f5f5f5',
  },
  infoCard: {
    padding: 18,
    backgroundColor: '#f3f3f3',
    borderRadius: 12,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  darkCard: {
    backgroundColor: '#1e1e1e',
  },
  routeSection: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    color: '#555',
    fontWeight: '500',
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    flexShrink: 1,
    textAlign: 'right',
    maxWidth: '60%',
  },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#aaa',
    backgroundColor: '#f9f9f9',
    marginBottom: 30,
  },
  darkOption: {
    backgroundColor: '#1a1a1a',
    borderColor: '#444',
  },
  optionSelected: {
    backgroundColor: '#FFF3CD',
    borderColor: '#FFC107',
  },
  optionText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
  },
  darkOptionText: {
    color: '#eee',
  },
  optionTextSelected: {
    fontWeight: '700',
    color: '#000',
  },
  completeButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 12,
  },
  darkCompleteButton: {
    backgroundColor: '#388E3C',
  },
  cancelButton: {
    backgroundColor: '#bbb',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  darkCancelButton: {
    backgroundColor: '#444',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#fff',
  },
  cancelButtonText: {
    color: '#222',
  },
});
