import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from './ThemeContext';

export default function Hotlines() {
  const { isDarkMode } = useContext(ThemeContext);
  const navigation = useNavigation();
  const iconColor = isDarkMode ? '#fff' : '#333';

  // Example emergency hotlines - replace or add as needed
  const hotlines = [
    { name: "Fire Department", number: "911" },
    { name: "Police", number: "911" },
    { name: "Medical Emergency", number: "911" },
    { name: "Disaster Response", number: "123-456-7890" },
    { name: "Local Gov't Hotline", number: "987-654-3210" },
  ];

  return (
    <View style={[styles.container, isDarkMode && styles.darkContainer]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={iconColor} />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={[styles.header, isDarkMode && styles.darkText]}>Gov't Emergency</Text>
        </View>
      </View>

      <ScrollView style={styles.contentContainer}>
        {hotlines.map((hotline, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.hotlineItem, isDarkMode && styles.darkItem]}
            onPress={() => Linking.openURL(`tel:${hotline.number}`)}
          >
            <Text style={[styles.hotlineName, isDarkMode && styles.darkText]}>{hotline.name}</Text>
            <Text style={[styles.hotlineNumber, isDarkMode && styles.darkText]}>{hotline.number}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
    height: 40,
  },
  titleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  darkText: {
    color: '#fff',
  },
  contentContainer: {
    flex: 1,
  },
  hotlineItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  darkItem: {
    backgroundColor: '#1E1E1E',
  },
  hotlineName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  hotlineNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
});
