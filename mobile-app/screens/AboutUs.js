import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from './ThemeContext';

export default function AboutUs() {
  const { isDarkMode } = useContext(ThemeContext);
  const navigation = useNavigation();
  const iconColor = isDarkMode ? '#fff' : '#333';

  return (
    <View style={[styles.container, isDarkMode && styles.darkContainer]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={iconColor} />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={[styles.header, isDarkMode && styles.darkText]}>About Us</Text>
        </View>
      </View>

      <ScrollView style={styles.contentContainer}>
        <Text style={[styles.text, isDarkMode && styles.darkText]}>
          Welcome to our Collectors Mobile App! We are dedicated to providing a seamless waste
          collection experience. Our mission is to support efficient waste management and promote
          environmental sustainability through modern technology.
        </Text>

        <Text style={[styles.text, isDarkMode && styles.darkText]}>
          This app enables waste collectors to view schedules, manage routes, report issues, and
          stay connected with the administration in real-time.
        </Text>

        <Text style={[styles.text, isDarkMode && styles.darkText]}>
          Thank you for being part of our community and helping us keep our environment clean and
          safe.
        </Text>
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
  text: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 15,
    color: '#333',
  },
});
