import React, { useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from './ThemeContext';
import { useNavigation } from '@react-navigation/native';

export default function LogDetails({ route }) {
  const { isDarkMode } = useContext(ThemeContext);
  const { logDetails } = route.params;
  const navigation = useNavigation();

  const themedStyles = isDarkMode ? darkStyles : lightStyles;

  const DetailItem = ({ icon, label, value }) => (
    <View style={themedStyles.detailCard}>
      <View style={baseStyles.detailRow}>
        <Ionicons name={icon} size={20} color={themedStyles.icon.color} />
        <Text style={themedStyles.label}>{label}</Text>
      </View>
      <Text style={themedStyles.value}>{value}</Text>
    </View>
  );

  return (
    <ScrollView style={themedStyles.container}>
      {/* Header with back button */}
      <View style={themedStyles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={themedStyles.icon.color} />
        </TouchableOpacity>
        <Text style={themedStyles.header}>Log Details</Text>
        {/* Invisible text to balance layout */}
        <Text style={{ width: 24, opacity: 0 }}>.</Text>
      </View>

      <DetailItem icon="calendar" label="Date" value={logDetails.date} />
      <DetailItem icon="time" label="Time" value={logDetails.time} />
      <DetailItem icon="location" label="Route" value={logDetails.routeName} />
      <DetailItem icon="person" label="Collector" value={logDetails.collector} />
      <DetailItem icon="checkmark-done" label="Status" value={logDetails.status} />

      {logDetails.wasteTypes?.length > 0 && (
        <View style={themedStyles.detailCard}>
          <Text style={themedStyles.subHeader}>Waste Types</Text>
          {logDetails.wasteTypes.map((type, index) => (
            <Text key={index} style={themedStyles.wasteItem}>• {type}</Text>
          ))}
        </View>
      )}

      {logDetails.notes ? (
        <View style={themedStyles.detailCard}>
          <Text style={themedStyles.subHeader}>Notes</Text>
          <Text style={themedStyles.value}>{logDetails.notes}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const baseStyles = {
  container: {
    flex: 1,
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  detailCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  value: {
    fontSize: 16,
    marginTop: 4,
  },
  subHeader: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  wasteItem: {
    fontSize: 15,
    marginLeft: 10,
    marginBottom: 4,
  },
  icon: {
    color: '#333',
  },
};

const lightStyles = StyleSheet.create({
  ...baseStyles,
  container: {
    ...baseStyles.container,
    backgroundColor: '#fff',
  },
  header: {
    ...baseStyles.header,
    color: '#222',
  },
  detailCard: {
    ...baseStyles.detailCard,
    backgroundColor: '#f9f9f9',
  },
  label: {
    ...baseStyles.label,
    color: '#444',
  },
  value: {
    ...baseStyles.value,
    color: '#333',
  },
  subHeader: {
    ...baseStyles.subHeader,
    color: '#333',
  },
  wasteItem: {
    ...baseStyles.wasteItem,
    color: '#555',
  },
  icon: {
    color: '#444',
  },
});

const darkStyles = StyleSheet.create({
  ...baseStyles,
  container: {
    ...baseStyles.container,
    backgroundColor: '#121212',
  },
  header: {
    ...baseStyles.header,
    color: '#fff',
  },
  detailCard: {
    ...baseStyles.detailCard,
    backgroundColor: '#1e1e1e',
  },
  label: {
    ...baseStyles.label,
    color: '#ccc',
  },
  value: {
    ...baseStyles.value,
    color: '#eee',
  },
  subHeader: {
    ...baseStyles.subHeader,
    color: '#fff',
  },
  wasteItem: {
    ...baseStyles.wasteItem,
    color: '#ccc',
  },
  icon: {
    color: '#fff',
  },
});
