import React, { useContext, useState } from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet, Alert, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from './ThemeContext';
import { AuthContext } from './AuthContext';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebasecollector/firebase';
import { responsive, wp, hp, fp, rp, isTablet, isSmallDevice } from '../utils/responsive';

export default function SettingsScreen() {
  const { isDarkMode, toggleTheme } = useContext(ThemeContext); // Get theme and toggle function from context
  const navigation = useNavigation();
  const { collectorId, setIsLoggedOut, setCollectorId } = useContext(AuthContext);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const iconColor = isDarkMode ? "#fff" : "#333"; // Dynamic icon color

  // Logout function
  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    try {
      if (collectorId) {
        const collectorRef = doc(db, 'collectors', collectorId);
        await updateDoc(collectorRef, {
          status: 'offline',
          lastActive: serverTimestamp(),
        });
      }

      setIsLoggedOut(true);    // Mark logged out in context
      setCollectorId(null);    // Clear collectorId from context

      navigation.reset({
        index: 0,
        routes: [{ name: 'CollectorsLogin' }],
      });
    } catch (error) {
      console.error('Error during logout:', error);
    }
    setShowLogoutModal(false);
  };

  const cancelLogout = () => {
    setShowLogoutModal(false);
  };

  return (
    <View style={[styles.container, isDarkMode && styles.darkContainer]}>
      {/* Header with Back Button */}
      <View style={styles.headerContainer}>
        <Text style={[styles.header, isDarkMode && styles.darkText]}>Settings</Text>
      </View>

      {/* Dark Mode Toggle */}
      <View style={[styles.settingItem, isDarkMode && styles.darkItem]}>
        <Ionicons name="moon" size={24} color={iconColor} />
        <Text style={[styles.settingText, isDarkMode && styles.darkText]}>Dark Mode</Text>
        <Switch
          value={isDarkMode}
          onValueChange={toggleTheme} // Toggle theme globally using the context
        />
      </View>

      {/* Settings List */}
      <TouchableOpacity style={[styles.settingItem, isDarkMode && styles.darkItem]} onPress={() => navigation.navigate('AboutUs')}>
        <Ionicons name="information-circle" size={24} color={iconColor} />
        <Text style={[styles.settingText, isDarkMode && styles.darkText]}>About Us</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.settingItem, isDarkMode && styles.darkItem]} onPress={() => navigation.navigate('Hotlines')}>
        <Ionicons name="call" size={24} color={iconColor} />
        <Text style={[styles.settingText, isDarkMode && styles.darkText]}>Gov't Emergency</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.settingItem, isDarkMode && styles.darkItem]} onPress={() => navigation.navigate('Notifications')}>
        <Ionicons name="notifications" size={24} color={iconColor} />
        <Text style={[styles.settingText, isDarkMode && styles.darkText]}>Notifications</Text>
      </TouchableOpacity>

      {/* Logout Button */}
      <TouchableOpacity style={[styles.settingItem, styles.logout]} onPress={handleLogout}>
        <Ionicons name="log-out" size={24} color="red" />
        <Text style={[styles.settingText, { color: "red" }]}>Logout</Text>
      </TouchableOpacity>

      {/* Custom Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelLogout}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, isDarkMode && styles.darkModalContainer]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Ionicons 
                name="log-out-outline" 
                size={responsive.iconSize['2xl']} 
                color="#ff4444" 
              />
              <Text style={[styles.modalTitle, isDarkMode && styles.darkText]}>
                Confirm Logout
              </Text>
            </View>

            {/* Modal Content */}
            <View style={styles.modalContent}>
              <Text style={[styles.modalMessage, isDarkMode && styles.darkText]}>
                Are you sure you want to logout?
              </Text>
              <Text style={[styles.modalSubMessage, isDarkMode && styles.darkSubText]}>
                You will be signed out of your account and returned to the login screen.
              </Text>
            </View>

            {/* Modal Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton, isDarkMode && styles.darkCancelButton]} 
                onPress={cancelLogout}
              >
                <Text style={[styles.cancelButtonText, isDarkMode && styles.darkCancelButtonText]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.logoutButton]} 
                onPress={confirmLogout}
              >
                <Text style={styles.logoutButtonText}>
                  Logout
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    justifyContent: 'center',
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    marginLeft: 10,
    color: '#333',
  },
  darkText: {
    color: '#fff',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 10,
    backgroundColor: '#FFF',
    marginVertical: 5,
  },
  darkItem: {
    backgroundColor: '#1E1E1E',
  },
  settingText: {
    fontSize: 16,
    flex: 1,
    marginLeft: 10,
    color: '#333',
  },
  logout: {
    backgroundColor: '#ffebee',
    marginTop: 20,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: responsive.spacing.xl,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: responsive.borderRadius.xl,
    padding: responsive.spacing['2xl'],
    width: '100%',
    maxWidth: wp(85),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    ...(isTablet() && {
      maxWidth: wp(60),
      padding: responsive.spacing['3xl'],
    }),
  },
  darkModalContainer: {
    backgroundColor: '#1E1E1E',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: responsive.spacing.xl,
  },
  modalTitle: {
    fontSize: responsive.fontSize['2xl'],
    fontWeight: 'bold',
    color: '#333',
    marginTop: responsive.spacing.base,
    textAlign: 'center',
    ...(isTablet() && { fontSize: responsive.fontSize['3xl'] }),
  },
  modalContent: {
    marginBottom: responsive.spacing['2xl'],
  },
  modalMessage: {
    fontSize: responsive.fontSize.lg,
    color: '#333',
    textAlign: 'center',
    marginBottom: responsive.spacing.base,
    fontWeight: '500',
    ...(isTablet() && { fontSize: responsive.fontSize.xl }),
  },
  modalSubMessage: {
    fontSize: responsive.fontSize.sm,
    color: '#666',
    textAlign: 'center',
    lineHeight: responsive.fontSize.lg,
    ...(isTablet() && { fontSize: responsive.fontSize.base }),
  },
  darkSubText: {
    color: '#bbb',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: responsive.spacing.base,
  },
  modalButton: {
    flex: 1,
    paddingVertical: responsive.spacing.base,
    paddingHorizontal: responsive.spacing.lg,
    borderRadius: responsive.borderRadius.lg,
    alignItems: 'center',
    ...(isTablet() && {
      paddingVertical: responsive.spacing.lg,
      paddingHorizontal: responsive.spacing.xl,
    }),
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  darkCancelButton: {
    backgroundColor: '#2a2a2a',
    borderColor: '#444',
  },
  logoutButton: {
    backgroundColor: '#ff4444',
  },
  cancelButtonText: {
    fontSize: responsive.fontSize.base,
    color: '#333',
    fontWeight: '600',
    ...(isTablet() && { fontSize: responsive.fontSize.lg }),
  },
  darkCancelButtonText: {
    color: '#fff',
  },
  logoutButtonText: {
    fontSize: responsive.fontSize.base,
    color: '#fff',
    fontWeight: 'bold',
    ...(isTablet() && { fontSize: responsive.fontSize.lg }),
  },
});
