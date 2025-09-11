import React, { useState, useContext, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { ThemeContext } from './ThemeContext';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebasecollector/firebase';
import { responsive, wp, hp, fp, rp, isTablet, isSmallDevice } from '../utils/responsive';

export default function CollectorsList({ route, navigation }) {
  const { isDarkMode } = useContext(ThemeContext);
  const [collectors, setCollectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Fetch collectors data
  useEffect(() => {
    const fetchCollectors = () => {
      try {
        const collectorsQuery = collection(db, 'collectors');
        const unsubscribe = onSnapshot(collectorsQuery, (snapshot) => {
          if (!mounted.current) return;
          
          const collectorsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          
          // Filter collectors with online status only
          const onlineCollectors = collectorsData.filter(collector => 
            collector.status === 'online'
          );
          
          setCollectors(onlineCollectors);
          setLoading(false);
        }, (error) => {
          console.error('Error fetching collectors:', error);
          setLoading(false);
        });

        return unsubscribe;
      } catch (error) {
        console.error('Error setting up collectors listener:', error);
        setLoading(false);
      }
    };

    fetchCollectors();
  }, []);

  const themeStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? '#121212' : '#f4f4f4',
      paddingTop: responsive.spacing['4xl'],
      paddingHorizontal: responsive.spacing.xl,
      ...(isTablet() && {
        paddingTop: responsive.spacing['5xl'],
        paddingHorizontal: responsive.spacing['3xl'],
      }),
    },
    header: {
      paddingTop: responsive.spacing['4xl'],
      paddingBottom: responsive.spacing.lg,
      backgroundColor: isDarkMode ? '#121212' : '#f4f4f4',
    },
    title: {
      fontSize: responsive.fontSize['2xl'],
      fontWeight: 'bold',
      color: isDarkMode ? '#fff' : '#333',
      alignSelf: 'center',
      ...(isSmallDevice() && { fontSize: responsive.fontSize.xl }),
      ...(isTablet() && { fontSize: responsive.fontSize['3xl'] }),
    },
    subtitle: {
      textAlign: 'center',
      marginTop: responsive.spacing.sm,
      color: isDarkMode ? '#bbb' : '#444',
      fontSize: responsive.fontSize.base,
    },
    card: {
      backgroundColor: isDarkMode ? '#1E1E1E' : '#fff',
      borderRadius: responsive.borderRadius.lg,
      padding: responsive.spacing.xl,
      marginBottom: responsive.spacing.base,
      position: 'relative',
      ...(isTablet() && {
        padding: responsive.spacing['2xl'],
        marginBottom: responsive.spacing.lg,
        borderRadius: responsive.borderRadius.xl,
      }),
    },
    cardTitle: {
      fontSize: responsive.fontSize.xl,
      fontWeight: 'bold',
      marginBottom: responsive.spacing.base,
      color: isDarkMode ? '#fff' : '#000',
      ...(isTablet() && { fontSize: responsive.fontSize['2xl'] }),
    },
    metaRow: {
      marginBottom: responsive.spacing.sm,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    metaLabel: {
      color: isDarkMode ? '#bbb' : '#666',
      fontSize: responsive.fontSize.sm,
      fontWeight: '500',
    },
    metaValue: {
      color: isDarkMode ? '#fff' : '#000',
      fontSize: responsive.fontSize.sm,
      fontWeight: '600',
    },
    statusBadge: {
      position: 'absolute',
      top: responsive.spacing.lg,
      right: responsive.spacing.lg,
      backgroundColor: '#4CAF50',
      paddingHorizontal: responsive.spacing.base,
      paddingVertical: responsive.spacing.xs,
      borderRadius: responsive.borderRadius.lg,
      ...(isTablet() && {
        top: responsive.spacing.xl,
        right: responsive.spacing.xl,
        paddingHorizontal: responsive.spacing.lg,
        paddingVertical: responsive.spacing.sm,
      }),
    },
    statusBadgeText: {
      color: '#fff',
      fontSize: responsive.fontSize.sm,
      fontWeight: 'bold',
      ...(isTablet() && { fontSize: responsive.fontSize.base }),
    },
    onlineStatus: {
      backgroundColor: '#4CAF50',
    },
    offlineStatus: {
      backgroundColor: '#f44336',
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: responsive.spacing.lg,
      marginTop: responsive.spacing.sm,
    },
    nameSection: {
      flex: 1,
    },
    collectorName: {
      fontSize: responsive.fontSize.xl,
      fontWeight: 'bold',
      color: isDarkMode ? '#fff' : '#000',
      marginBottom: responsive.spacing.xs,
      ...(isTablet() && { fontSize: responsive.fontSize['2xl'] }),
    },
    collectorId: {
      fontSize: responsive.fontSize.sm,
      color: isDarkMode ? '#bbb' : '#666',
      fontWeight: '500',
      ...(isTablet() && { fontSize: responsive.fontSize.base }),
    },
    lastActiveSection: {
      alignItems: 'flex-end',
    },
    lastActiveLabel: {
      fontSize: responsive.fontSize.xs,
      color: isDarkMode ? '#888' : '#999',
      marginBottom: responsive.spacing.xs,
      ...(isTablet() && { fontSize: responsive.fontSize.sm }),
    },
    lastActiveValue: {
      fontSize: responsive.fontSize.sm,
      color: isDarkMode ? '#fff' : '#333',
      fontWeight: '600',
      ...(isTablet() && { fontSize: responsive.fontSize.base }),
    },
    contactSection: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: responsive.spacing.base,
      paddingVertical: responsive.spacing.sm,
      paddingHorizontal: responsive.spacing.base,
      backgroundColor: isDarkMode ? '#2a2a2a' : '#f8f9fa',
      borderRadius: responsive.borderRadius.base,
    },
    contactLabel: {
      fontSize: responsive.fontSize.sm,
      color: isDarkMode ? '#64b5f6' : '#1976d2',
      fontWeight: '600',
      marginRight: responsive.spacing.sm,
      ...(isTablet() && { fontSize: responsive.fontSize.base }),
    },
    contactValue: {
      fontSize: responsive.fontSize.sm,
      color: isDarkMode ? '#fff' : '#333',
      fontWeight: '500',
      ...(isTablet() && { fontSize: responsive.fontSize.base }),
    },
    truckInfo: {
      marginBottom: responsive.spacing.base,
      padding: responsive.spacing.base,
      backgroundColor: isDarkMode ? '#2a2a2a' : '#e8f5e9',
      borderRadius: responsive.borderRadius.base,
      ...(isTablet() && {
        padding: responsive.spacing.lg,
      }),
    },
    truckLabel: {
      color: isDarkMode ? '#81c784' : '#2e7d32',
      fontSize: responsive.fontSize.sm,
      fontWeight: '600',
      ...(isTablet() && { fontSize: responsive.fontSize.base }),
    },
    locationInfo: {
      marginBottom: responsive.spacing.base,
      padding: responsive.spacing.base,
      backgroundColor: isDarkMode ? '#2a2a2a' : '#e3f2fd',
      borderRadius: responsive.borderRadius.base,
      ...(isTablet() && {
        padding: responsive.spacing.lg,
      }),
    },
    locationLabel: {
      color: isDarkMode ? '#64b5f6' : '#1976d2',
      fontSize: responsive.fontSize.sm,
      fontWeight: '600',
      marginBottom: responsive.spacing.xs,
      ...(isTablet() && { fontSize: responsive.fontSize.base }),
    },
    locationValue: {
      color: isDarkMode ? '#fff' : '#333',
      fontSize: responsive.fontSize.sm,
      fontWeight: '500',
      fontFamily: 'monospace',
      ...(isTablet() && { fontSize: responsive.fontSize.base }),
    },
    tapIndicator: {
      alignItems: 'center',
      paddingTop: responsive.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: isDarkMode ? '#333' : '#e0e0e0',
    },
    tapText: {
      fontSize: responsive.fontSize.xs,
      color: isDarkMode ? '#888' : '#999',
      fontStyle: 'italic',
      ...(isTablet() && { fontSize: responsive.fontSize.sm }),
    },
    noCollectorsText: {
      color: isDarkMode ? '#888' : '#555',
      textAlign: 'center',
      marginTop: responsive.spacing['3xl'],
      fontSize: responsive.fontSize.base,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  if (loading) {
    return (
      <View style={[themeStyles.container, themeStyles.loadingContainer]}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={[themeStyles.noCollectorsText, { marginTop: responsive.spacing.lg }]}>
          Loading collectors...
        </Text>
      </View>
    );
  }

  return (
    <View style={themeStyles.container}>
      <View style={themeStyles.header}>
        <Text style={themeStyles.title}>Online Collectors</Text>
        <Text style={themeStyles.subtitle}>
          {collectors.length} online collector{collectors.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {collectors.length > 0 ? (
          collectors.map((collector) => (
            <TouchableOpacity 
              key={collector.id} 
              style={themeStyles.card}
              onPress={() => {
                if (collector.location) {
                  // Navigate to the parent navigator's UsersDashboard screen
                  const parentNavigation = navigation.getParent();
                  if (parentNavigation) {
                    parentNavigation.navigate('UsersDashboard', {
                      focusLocation: {
                        latitude: collector.location.latitude,
                        longitude: collector.location.longitude,
                        collectorName: `${collector.firstName} ${collector.lastName}`,
                        collectorId: collector.collectorId
                      }
                    });
                  } else {
                    // Fallback: try to navigate to UsersTabs
                    navigation.navigate('UsersTabs', {
                      screen: 'Home',
                      params: {
                        focusLocation: {
                          latitude: collector.location.latitude,
                          longitude: collector.location.longitude,
                          collectorName: `${collector.firstName} ${collector.lastName}`,
                          collectorId: collector.collectorId
                        }
                      }
                    });
                  }
                }
              }}
            >
              {/* Status Badge */}
              <View
                style={[
                  themeStyles.statusBadge,
                  collector.status === 'online' 
                    ? themeStyles.onlineStatus 
                    : themeStyles.offlineStatus,
                ]}
              >
                <Text style={themeStyles.statusBadgeText}>
                  {collector.status?.toUpperCase() || 'UNKNOWN'}
                </Text>
              </View>

              {/* Header Section */}
              <View style={themeStyles.cardHeader}>
                <View style={themeStyles.nameSection}>
                  <Text style={themeStyles.collectorName}>
                    {collector.firstName} {collector.lastName}
                  </Text>
                  <Text style={themeStyles.collectorId}>
                    ID: {collector.collectorId}
                  </Text>
                </View>
                <View style={themeStyles.lastActiveSection}>
                  <Text style={themeStyles.lastActiveLabel}>Last Active</Text>
                  <Text style={themeStyles.lastActiveValue}>
                    {collector.lastActive?.toDate?.()
                      ? collector.lastActive.toDate().toLocaleDateString()
                      : 'Unknown'}
                  </Text>
                </View>
              </View>

              {/* Contact Information */}
              <View style={themeStyles.contactSection}>
                <Text style={themeStyles.contactLabel}>📞 Contact</Text>
                <Text style={themeStyles.contactValue}>{collector.contactNumber}</Text>
              </View>

              {/* Truck Information */}
              {collector.assignedTruck && (
                <View style={themeStyles.truckInfo}>
                  <Text style={themeStyles.truckLabel}>
                    🚛 Assigned Truck: {collector.assignedTruck}
                  </Text>
                </View>
              )}

              {/* Location Information */}
              {collector.location && (
                <View style={themeStyles.locationInfo}>
                  <Text style={themeStyles.locationLabel}>
                    📍 Current Location
                  </Text>
                  <Text style={themeStyles.locationValue}>
                    {collector.location.latitude?.toFixed(4)}, {collector.location.longitude?.toFixed(4)}
                  </Text>
                </View>
              )}

              {/* Tap to View Indicator */}
              <View style={themeStyles.tapIndicator}>
                <Text style={themeStyles.tapText}>Tap to view on map</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={themeStyles.noCollectorsText}>
            No online collectors found.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
