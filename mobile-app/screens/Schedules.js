import React, { useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import {
  Ionicons,
  MaterialIcons,
  FontAwesome5,
  Entypo,
} from "@expo/vector-icons";
import { ThemeContext } from "./ThemeContext";
import { collection, getDocs, doc, getDoc, addDoc, serverTimestamp, query, where } from "firebase/firestore";
import { db } from "../firebasecollector/firebase";
import { useRoute, useNavigation } from "@react-navigation/native";
import { responsive, wp, hp, fp, rp, isTablet, isSmallDevice } from '../utils/responsive';

export default function CollectionScheduleScreen() {
  const { isDarkMode } = useContext(ThemeContext);
  const route = useRoute();
  const navigation = useNavigation();
  const { collectorId } = route.params || {};

  const [schedules, setSchedules] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("schedules"); // 'schedules' or 'routes'
  const [expandedSchedule, setExpandedSchedule] = useState(null); // For collapsible members
  
  // Collection states
  const [activeCollection, setActiveCollection] = useState(null); // Currently collecting schedule ID
  const [collectionStartTime, setCollectionStartTime] = useState(null); // When collection started
  const [showKilosDialog, setShowKilosDialog] = useState(false);
  const [kilosInput, setKilosInput] = useState('');
  const [submittingKilos, setSubmittingKilos] = useState(false);
  const [completedCollections, setCompletedCollections] = useState({}); // Track completed collections by schedule ID

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('=== SCHEDULES DEBUG START ===');
        console.log('Active tab:', activeTab);
        console.log('Collector ID from route:', collectorId);
        console.log('Collector ID type:', typeof collectorId);
        console.log('Collector ID length:', collectorId?.length);
        
        setLoading(true);

        if (activeTab === "schedules") {
          console.log('Fetching schedules from Firestore...');
          
          // First, get the collector's actual name from the collectors collection
          let collectorName = null;
          if (collectorId) {
            try {
              const collectorDoc = await getDoc(doc(db, 'collectors', collectorId));
              if (collectorDoc.exists()) {
                const collectorData = collectorDoc.data();
                collectorName = `${collectorData.firstName || ''} ${collectorData.lastName || ''}`.trim();
                console.log('Collector data:', collectorData);
                console.log('Collector name:', collectorName);
              } else {
                console.log('❌ Collector document not found for ID:', collectorId);
              }
            } catch (error) {
              console.error('Error fetching collector data:', error);
            }
          }
          
          const schedulesSnapshot = await getDocs(collection(db, "schedules"));
          console.log('Schedules snapshot size:', schedulesSnapshot.size);
          console.log('Schedules snapshot empty:', schedulesSnapshot.empty);
          
          const allSchedules = schedulesSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          console.log('Total schedules found:', allSchedules.length);
          console.log('All schedules data:', allSchedules);
          console.log('Looking for collector ID:', collectorId);
          console.log('Looking for collector name:', collectorName);
          console.log('Collector ID toLowerCase:', collectorId?.toLowerCase());
          console.log('Collector name toLowerCase:', collectorName?.toLowerCase());

          if (allSchedules.length === 0) {
            console.log('❌ NO SCHEDULES FOUND IN DATABASE');
            setSchedules([]);
            return;
          }

          // Filter schedules for the specific collector (same logic as CollectorsDashboard)
          const collectorSchedules = allSchedules.filter(schedule => {
            console.log('--- Checking schedule:', schedule.id);
            console.log('Schedule driver:', schedule.driver);
            console.log('Schedule members:', schedule.members);
            
            // Check if driver field contains the collector ID or name
            if (schedule.driver) {
              const driverName = schedule.driver.toLowerCase().trim();
              console.log('Driver name (lowercase):', driverName);
              console.log('Looking for collector ID:', collectorId?.toLowerCase());
              console.log('Looking for collector name:', collectorName?.toLowerCase());
              
              // Check for collector ID match
              if (collectorId && driverName.includes(collectorId.toLowerCase())) {
                console.log('✅ Found schedule with collector ID as driver:', schedule.id, schedule);
                return true;
              }
              
              // Check for collector name match
              if (collectorName && driverName.includes(collectorName.toLowerCase())) {
                console.log('✅ Found schedule with collector name as driver:', schedule.id, schedule);
                return true;
              }
            }
            
            // Check if members array contains the collector ID or name
            if (schedule.members && Array.isArray(schedule.members)) {
              console.log('Checking members array:', schedule.members);
              const hasCollector = schedule.members.some(member => {
                const memberName = member.toLowerCase();
                console.log('Member name (lowercase):', memberName);
                
                // Check for collector ID match
                if (collectorId && memberName.includes(collectorId.toLowerCase())) {
                  console.log('Member contains collector ID:', true);
                  return true;
                }
                
                // Check for collector name match
                if (collectorName && memberName.includes(collectorName.toLowerCase())) {
                  console.log('Member contains collector name:', true);
                  return true;
                }
                
                return false;
              });
              
              if (hasCollector) {
                console.log('✅ Found schedule with collector in members:', schedule.id, schedule);
                return true;
              }
            }
            
            console.log('❌ No match for schedule:', schedule.id);
            return false;
          });

          console.log('Filtered schedules for collector:', collectorSchedules.length);
          console.log('Filtered schedules data:', collectorSchedules);
          
          if (collectorSchedules.length === 0) {
            console.log('❌ NO MATCHING SCHEDULES FOUND FOR COLLECTOR');
            console.log('Available drivers in all schedules:', allSchedules.map(s => s.driver));
            console.log('Available members in all schedules:', allSchedules.map(s => s.members));
          }
          
          setSchedules(collectorSchedules);
        } else {
          const routesSnapshot = await getDocs(collection(db, "routes"));
          const routesData = routesSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setRoutes(routesData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (collectorId) {
      fetchData();
    }
  }, [activeTab, collectorId]);

  // Fetch completed collections for today
  const fetchCompletedCollections = async () => {
    if (!collectorId) return;
    
    try {
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      console.log('Fetching completed collections for today:', today);
      
      const collectionsQuery = query(
        collection(db, 'collections'),
        where('collectorId', '==', collectorId),
        where('day', '==', today),
        where('status', '==', 'collected')
      );
      
      const snapshot = await getDocs(collectionsQuery);
      const completed = {};
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        completed[data.scheduleId] = {
          weightKg: data.weightKg,
          completedAt: data.completedAt,
          id: doc.id,
          day: data.day
        };
      });
      
      console.log('Completed collections for today:', completed);
      console.log('Total completed collections found:', Object.keys(completed).length);
      setCompletedCollections(completed);
    } catch (error) {
      console.error('Error fetching completed collections:', error);
    }
  };

  // Fetch completed collections when component loads
  useEffect(() => {
    if (collectorId) {
      fetchCompletedCollections();
    }
  }, [collectorId]);

  // Collection functions
  const startCollection = (scheduleId) => {
    const startTime = new Date();
    setActiveCollection(scheduleId);
    setCollectionStartTime(startTime);
    
    console.log('Collection started at:', startTime);
    Alert.alert(
      "Collection Started",
      "You have started collecting garbage for this schedule. Tap 'Done' when finished.",
      [{ text: "OK" }]
    );
  };

  const finishCollection = () => {
    setShowKilosDialog(true);
  };

  const submitKilos = async () => {
    if (!kilosInput.trim()) {
      Alert.alert("Error", "Please enter the kilos of garbage collected.");
      return;
    }

    const kilos = parseFloat(kilosInput);
    if (isNaN(kilos) || kilos < 0) {
      Alert.alert("Error", "Please enter a valid number for kilos.");
      return;
    }

    setSubmittingKilos(true);
    try {
      const activeSchedule = schedules.find(s => s.id === activeCollection);
      const completedAt = new Date();
      
      console.log('Collection completed at:', completedAt);
      console.log('Collection started at:', collectionStartTime);
      
      // Save collection data to Firestore with proper field names
      await addDoc(collection(db, 'collections'), {
        collectorId: collectorId,
        scheduleId: activeCollection,
        day: activeSchedule?.day || 'Unknown',
        time: activeSchedule?.time || 'Unknown',
        location: activeSchedule?.location || 'Unknown',
        zone: activeSchedule?.zone || 'Unknown',
        groupName: activeSchedule?.groupName || 'Unknown',
        weightKg: kilos,
        startedAt: collectionStartTime,
        completedAt: completedAt,
        status: 'collected'
      });

      Alert.alert(
        "Collection Completed",
        `Successfully recorded ${kilos} kg of garbage collected.`,
        [{ text: "OK" }]
      );

      // Reset states
      setActiveCollection(null);
      setCollectionStartTime(null);
      setShowKilosDialog(false);
      setKilosInput('');
      
      // Refresh completed collections
      await fetchCompletedCollections();
      
    } catch (error) {
      console.error('Error submitting collection:', error);
      Alert.alert("Error", "Failed to submit collection data. Please try again.");
    } finally {
      setSubmittingKilos(false);
    }
  };

  const cancelCollection = () => {
    Alert.alert(
      "Cancel Collection",
      "Are you sure you want to cancel this collection?",
      [
        { text: "No", style: "cancel" },
        { 
          text: "Yes", 
          style: "destructive",
          onPress: () => {
            setActiveCollection(null);
            setCollectionStartTime(null);
            setShowKilosDialog(false);
            setKilosInput('');
          }
        }
      ]
    );
  };

  const dynamicStyles = {
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? "#121212" : "#f4f4f4",
      paddingTop: responsive.spacing['4xl'],
      paddingHorizontal: responsive.spacing.xl,
      ...(isTablet() && {
        paddingTop: responsive.spacing['5xl'],
        paddingHorizontal: responsive.spacing['3xl'],
      }),
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: responsive.spacing.xl,
      position: 'relative',
      height: responsive.spacing['4xl'],
      ...(isTablet() && {
        marginBottom: responsive.spacing['2xl'],
        height: responsive.spacing['5xl'],
      }),
    },
    titleContainer: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    header: {
      fontSize: responsive.fontSize['2xl'],
      fontWeight: 'bold',
      color: isDarkMode ? '#fff' : '#333',
      ...(isSmallDevice() && { fontSize: responsive.fontSize.xl }),
      ...(isTablet() && { fontSize: responsive.fontSize['3xl'] }),
    },
    tabContainer: {
      flexDirection: "row",
      justifyContent: "center",
      marginBottom: responsive.spacing.lg,
      marginTop: responsive.spacing.base,
    },
    tabButton: {
      paddingHorizontal: responsive.spacing.lg,
      paddingVertical: responsive.spacing.base,
      marginHorizontal: responsive.spacing.xs,
      borderRadius: responsive.borderRadius.lg,
      ...(isTablet() && {
        paddingHorizontal: responsive.spacing.xl,
        paddingVertical: responsive.spacing.lg,
        marginHorizontal: responsive.spacing.sm,
        borderRadius: responsive.borderRadius.xl,
      }),
    },
    activeTab: {
      backgroundColor: "#4CAF50",
    },
    inactiveTab: {
      backgroundColor: isDarkMode ? "#333" : "#ddd",
    },
    tabText: {
      color: isDarkMode ? "#fff" : "#000",
      fontWeight: "bold",
      fontSize: responsive.fontSize.sm,
      ...(isTablet() && { fontSize: responsive.fontSize.base }),
    },
    activeTabText: {
      color: "white",
    },
    scheduleCard: {
      backgroundColor: isDarkMode ? "#1E1E1E" : "#FFFFFF",
      padding: responsive.spacing.lg,
      marginHorizontal: 0,
      marginVertical: responsive.spacing.base,
      borderRadius: responsive.borderRadius.lg,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
      borderLeftWidth: rp(4),
      borderLeftColor: '#4CAF50',
      ...(isTablet() && {
        padding: responsive.spacing.xl,
        marginVertical: responsive.spacing.lg,
        borderRadius: responsive.borderRadius.xl,
        borderLeftWidth: rp(6),
      }),
    },
    routeText: {
      color: isDarkMode ? "#fff" : "#000",
      fontSize: responsive.fontSize.lg,
      fontWeight: "bold",
      marginBottom: responsive.spacing.xs,
      ...(isTablet() && { fontSize: responsive.fontSize.xl }),
    },
    detailRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: responsive.spacing.xs,
    },
    detailText: {
      color: isDarkMode ? "#CCC" : "#555",
      fontSize: responsive.fontSize.base,
      marginLeft: responsive.spacing.xs,
      ...(isTablet() && { fontSize: responsive.fontSize.lg }),
    },
    membersList: {
      marginLeft: 30,
      marginTop: 5,
    },
    memberText: {
      fontSize: 13,
      color: isDarkMode ? "#aaa" : "#444",
      marginTop: 2,
    },
    viewButton: {
      backgroundColor: "#4CAF50",
      paddingVertical: 8,
      paddingHorizontal: 15,
      borderRadius: 6,
      alignSelf: "flex-start",
      marginTop: 10,
    },
    viewText: {
      color: "white",
      fontWeight: "bold",
      fontSize: 13,
    },
    emptyState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    emptyText: {
      color: isDarkMode ? "#CCC" : "#555",
      fontSize: 16,
      textAlign: "center",
    },
    scheduleHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: responsive.spacing.base,
      paddingHorizontal: responsive.spacing.xs,
      ...(isTablet() && {
        paddingVertical: responsive.spacing.lg,
        paddingHorizontal: responsive.spacing.sm,
      }),
    },
    scheduleHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    scheduleHeaderText: {
      fontSize: responsive.fontSize.base,
      fontWeight: 'bold',
      color: isDarkMode ? "#fff" : "#333",
      marginLeft: responsive.spacing.base,
      ...(isTablet() && { fontSize: responsive.fontSize.lg }),
    },
    scheduleDetailsContent: {
      paddingLeft: responsive.spacing['2xl'],
      paddingTop: responsive.spacing.base,
      paddingBottom: responsive.spacing.xs,
      ...(isTablet() && {
        paddingLeft: responsive.spacing['3xl'],
        paddingTop: responsive.spacing.lg,
        paddingBottom: responsive.spacing.sm,
      }),
    },
    scheduleDetailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: responsive.spacing.xs,
      ...(isTablet() && { marginBottom: responsive.spacing.sm }),
    },
    scheduleDetailText: {
      fontSize: responsive.fontSize.base,
      color: isDarkMode ? "#CCC" : "#555",
      marginLeft: responsive.spacing.base,
      flex: 1,
      ...(isTablet() && { fontSize: responsive.fontSize.lg }),
    },
    collectionButtonsContainer: {
      marginTop: responsive.spacing.lg,
      alignItems: 'center',
      ...(isTablet() && { marginTop: responsive.spacing.xl }),
    },
    collectionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: responsive.spacing.lg,
      paddingHorizontal: responsive.spacing.lg,
      borderRadius: responsive.borderRadius.base,
      gap: responsive.spacing.base,
      minWidth: rp(150),
      justifyContent: 'center',
      ...(isTablet() && {
        paddingVertical: responsive.spacing.xl,
        paddingHorizontal: responsive.spacing.xl,
        borderRadius: responsive.borderRadius.lg,
        minWidth: rp(200),
      }),
    },
    startButton: {
      backgroundColor: '#4CAF50',
    },
    doneButton: {
      backgroundColor: '#FF9800',
    },
    completedButton: {
      backgroundColor: '#4CAF50',
    },
    collectionButtonText: {
      color: '#fff',
      fontSize: responsive.fontSize.base,
      fontWeight: 'bold',
      ...(isTablet() && { fontSize: responsive.fontSize.lg }),
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF',
      borderRadius: responsive.borderRadius.lg,
      padding: responsive.spacing.xl,
      margin: responsive.spacing.xl,
      minWidth: rp(300),
      ...(isTablet() && {
        borderRadius: responsive.borderRadius.xl,
        padding: responsive.spacing['2xl'],
        margin: responsive.spacing['2xl'],
        minWidth: rp(400),
      }),
    },
    modalTitle: {
      fontSize: responsive.fontSize.lg,
      fontWeight: 'bold',
      color: isDarkMode ? '#fff' : '#333',
      marginBottom: responsive.spacing.lg,
      textAlign: 'center',
      ...(isTablet() && { fontSize: responsive.fontSize.xl }),
    },
    inputContainer: {
      marginBottom: responsive.spacing.lg,
      ...(isTablet() && { marginBottom: responsive.spacing.xl }),
    },
    inputLabel: {
      fontSize: responsive.fontSize.base,
      color: isDarkMode ? '#CCC' : '#555',
      marginBottom: responsive.spacing.base,
      ...(isTablet() && { fontSize: responsive.fontSize.lg }),
    },
    textInput: {
      borderWidth: 1,
      borderColor: isDarkMode ? '#444' : '#ddd',
      borderRadius: responsive.borderRadius.base,
      padding: responsive.spacing.lg,
      fontSize: responsive.fontSize.base,
      color: isDarkMode ? '#fff' : '#333',
      backgroundColor: isDarkMode ? '#2a2a2a' : '#fff',
      ...(isTablet() && {
        borderRadius: responsive.borderRadius.lg,
        padding: responsive.spacing.xl,
        fontSize: responsive.fontSize.lg,
      }),
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: responsive.spacing.lg,
      ...(isTablet() && { gap: responsive.spacing.xl }),
    },
    modalButton: {
      flex: 1,
      paddingVertical: responsive.spacing.lg,
      borderRadius: responsive.borderRadius.base,
      alignItems: 'center',
      ...(isTablet() && {
        paddingVertical: responsive.spacing.xl,
        borderRadius: responsive.borderRadius.lg,
      }),
    },
    submitButton: {
      backgroundColor: '#4CAF50',
    },
    cancelButton: {
      backgroundColor: '#F44336',
    },
    modalButtonText: {
      color: '#fff',
      fontSize: responsive.fontSize.base,
      fontWeight: 'bold',
      ...(isTablet() && { fontSize: responsive.fontSize.lg }),
    },
    darkText: {
      color: '#fff',
    },
  };

  const renderScheduleItem = ({ item }) => {
    const isExpanded = expandedSchedule === item.id;

    return (
      <View style={dynamicStyles.scheduleCard}>
        {/* Schedule Header - Always Visible */}
        <TouchableOpacity 
          style={dynamicStyles.scheduleHeader}
          onPress={() => setExpandedSchedule(isExpanded ? null : item.id)}
        >
          <View style={dynamicStyles.scheduleHeaderLeft}>
            <Ionicons name="calendar-outline" size={18} color="#FF5722" />
            <Text style={[dynamicStyles.scheduleHeaderText, isDarkMode && dynamicStyles.darkText]}>
              {item.day || 'N/A'} - {item.time || 'N/A'}
            </Text>
          </View>
          <Ionicons 
            name={isExpanded ? "chevron-up" : "chevron-down"} 
            size={20} 
            color={isDarkMode ? "#fff" : "#000"} 
          />
        </TouchableOpacity>
        
        {/* Collapsible Schedule Details */}
        {isExpanded && (
          <View style={dynamicStyles.scheduleDetailsContent}>
            <View style={dynamicStyles.scheduleDetailRow}>
              <Ionicons name="location" size={16} color="#FF9800" />
              <Text style={[dynamicStyles.scheduleDetailText, isDarkMode && dynamicStyles.darkText]}>
                {item.location || 'N/A'}
              </Text>
            </View>
            
            <View style={dynamicStyles.scheduleDetailRow}>
              <Ionicons name="car" size={16} color="#2196F3" />
              <Text style={[dynamicStyles.scheduleDetailText, isDarkMode && dynamicStyles.darkText]}>
                {item.groupName || 'N/A'}
              </Text>
            </View>
            
            <View style={dynamicStyles.scheduleDetailRow}>
              <Ionicons name="map" size={16} color="#9C27B0" />
              <Text style={[dynamicStyles.scheduleDetailText, isDarkMode && dynamicStyles.darkText]}>
                Zone: {item.zone || 'N/A'}
              </Text>
            </View>
            
            <View style={dynamicStyles.scheduleDetailRow}>
              <Ionicons name="person" size={16} color="#4CAF50" />
              <Text style={[dynamicStyles.scheduleDetailText, isDarkMode && dynamicStyles.darkText]}>
                Driver: {item.driver || 'N/A'}
              </Text>
            </View>
            
            {item.members && item.members.length > 0 && (
              <View style={dynamicStyles.scheduleDetailRow}>
                <Ionicons name="people" size={16} color="#009688" />
                <Text style={[dynamicStyles.scheduleDetailText, isDarkMode && dynamicStyles.darkText]}>
                  Members: {item.members.join(', ')}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Collection Buttons - Only show if today matches schedule day */}
        {(() => {
          const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
          const isTodaySchedule = item.day && item.day.toLowerCase() === today.toLowerCase();
          const isCompleted = completedCollections[item.id];
          
          // Calculate next collection date
          const getNextCollectionDate = (targetDay) => {
            const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const targetDayIndex = daysOfWeek.indexOf(targetDay);
            const today = new Date();
            const todayIndex = today.getDay();
            
            let daysUntilTarget = targetDayIndex - todayIndex;
            if (daysUntilTarget <= 0) {
              daysUntilTarget += 7; // Next week
            }
            
            const nextDate = new Date(today);
            nextDate.setDate(today.getDate() + daysUntilTarget);
            
            return nextDate.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              year: 'numeric'
            });
          };
          
          console.log(`Schedule ${item.id} (${item.day}):`, {
            today,
            isTodaySchedule,
            isCompleted: !!isCompleted,
            completedWeight: isCompleted?.weightKg
          });
          
          if (!isTodaySchedule) {
            const nextDate = getNextCollectionDate(item.day);
            return (
              <View style={dynamicStyles.collectionButtonsContainer}>
                <Text style={[dynamicStyles.scheduleDetailText, { textAlign: 'center', fontStyle: 'italic' }]}>
                  Collection available on {item.day}
                </Text>
                <Text style={[dynamicStyles.scheduleDetailText, { textAlign: 'center', fontSize: 11, marginTop: 2, fontStyle: 'italic', color: '#666' }]}>
                  Start Collection button will appear on {item.day}, {nextDate}
                </Text>
              </View>
            );
          }

          // If collection is already completed today
          if (isCompleted) {
            const nextDate = getNextCollectionDate(item.day);
            return (
              <View style={dynamicStyles.collectionButtonsContainer}>
                <View style={[dynamicStyles.collectionButton, dynamicStyles.completedButton]}>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={dynamicStyles.collectionButtonText}>
                    Completed: {isCompleted.weightKg} kg
                  </Text>
                </View>
                <Text style={[dynamicStyles.scheduleDetailText, { textAlign: 'center', fontSize: 12, marginTop: 4 }]}>
                  Collection completed for today
                </Text>
                <Text style={[dynamicStyles.scheduleDetailText, { textAlign: 'center', fontSize: 11, marginTop: 2, fontStyle: 'italic', color: '#666' }]}>
                  Next collection available on {item.day}, {nextDate}
                </Text>
              </View>
            );
          }

          return (
            <View style={dynamicStyles.collectionButtonsContainer}>
              {activeCollection === item.id ? (
                // Show Done button when collecting
                <TouchableOpacity
                  style={[dynamicStyles.collectionButton, dynamicStyles.doneButton]}
                  onPress={finishCollection}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={dynamicStyles.collectionButtonText}>Done</Text>
                </TouchableOpacity>
              ) : (
                // Show Start Collection button when not collecting
                <TouchableOpacity
                  style={[dynamicStyles.collectionButton, dynamicStyles.startButton]}
                  onPress={() => startCollection(item.id)}
                  disabled={activeCollection !== null} // Disable if another collection is active
                >
                  <Ionicons name="play-circle" size={20} color="#fff" />
                  <Text style={dynamicStyles.collectionButtonText}>
                    {activeCollection !== null ? 'Collection in Progress' : 'Start Collection'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })()}
      </View>
    );
  };

  const renderRouteItem = ({ item }) => (
    <View style={dynamicStyles.scheduleCard}>
      <Text style={dynamicStyles.routeText}>
        Route ID: {item.routeId || "N/A"}
      </Text>
      <Text style={dynamicStyles.detailText}>
        Origin: {item.origin || "N/A"}
      </Text>
      <Text style={dynamicStyles.detailText}>
        Destination: {item.destination || "N/A"}
      </Text>
      <Text style={dynamicStyles.detailText}>
        Distance: {item.distance || "N/A"}
      </Text>
      <Text style={dynamicStyles.detailText}>
        Duration: {item.duration || "N/A"}
      </Text>

      <TouchableOpacity
        style={dynamicStyles.viewButton}
        onPress={() =>
          alert(`Route Details:\n\n${JSON.stringify(item, null, 2)}`)
        }
      >
        <Text style={dynamicStyles.viewText}>VIEW ROUTE DETAILS</Text>
      </TouchableOpacity>
    </View>
  );

  // Debug render state
  console.log('=== RENDER DEBUG ===');
  console.log('Collector ID:', collectorId);
  console.log('Loading:', loading);
  console.log('Schedules count:', schedules.length);
  console.log('Schedules data:', schedules);
  console.log('Active tab:', activeTab);

  // Show message if no collector is logged in
  if (!collectorId) {
    console.log('❌ No collector ID - showing login message');
    return (
      <View style={dynamicStyles.container}>
        <View style={dynamicStyles.emptyState}>
          <Text style={dynamicStyles.emptyText}>
            Please log in to view your schedules
          </Text>
        </View>
      </View>
    );
  }

  const iconColor = isDarkMode ? "#fff" : "#333";

  return (
    <View style={dynamicStyles.container}>
      {/* Header */}
      <View style={dynamicStyles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={responsive.iconSize.lg} color={iconColor} />
        </TouchableOpacity>
        <View style={dynamicStyles.titleContainer}>
          <Text style={[dynamicStyles.header, isDarkMode && dynamicStyles.darkText]}>
            My Schedules ({collectorId})
          </Text>
        </View>
      </View>

      {/* Tab Selector */}
      <View style={dynamicStyles.tabContainer}>
        <TouchableOpacity
          style={[
            dynamicStyles.tabButton,
            activeTab === "schedules"
              ? dynamicStyles.activeTab
              : dynamicStyles.inactiveTab,
          ]}
          onPress={() => setActiveTab("schedules")}
        >
          <Text
            style={[
              dynamicStyles.tabText,
              activeTab === "schedules" && dynamicStyles.activeTabText,
            ]}
          >
            MY SCHEDULES
          </Text>
        </TouchableOpacity>

        {/* <TouchableOpacity
          style={[
            dynamicStyles.tabButton,
            activeTab === "routes"
              ? dynamicStyles.activeTab
              : dynamicStyles.inactiveTab,
          ]}
          onPress={() => setActiveTab("routes")}
        >
          <Text
            style={[
              dynamicStyles.tabText,
              activeTab === "routes" && dynamicStyles.activeTabText,
            ]}
          >
            ROUTES
          </Text>
        </TouchableOpacity> */}
      </View>

      {/* Loading */}
      {loading ? (
        <ActivityIndicator
          size="large"
          color="#4CAF50"
          style={{ marginTop: 50 }}
        />
      ) : (
        <FlatList
          data={activeTab === "schedules" ? schedules : routes}
          keyExtractor={(item) => item.id}
          renderItem={
            activeTab === "schedules" ? renderScheduleItem : renderRouteItem
          }
          contentContainerStyle={{ paddingBottom: responsive.spacing.xl }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={dynamicStyles.emptyState}>
              <Text style={dynamicStyles.emptyText}>
                No {activeTab === "schedules" ? "schedules" : "routes"} found
              </Text>
              <Text style={dynamicStyles.emptyText}>
                Debug: Collector ID = {collectorId}
              </Text>
              <Text style={dynamicStyles.emptyText}>
                Debug: Schedules count = {schedules.length}
              </Text>
            </View>
          }
          onLayout={() => console.log('FlatList rendered with data:', activeTab === "schedules" ? schedules : routes)}
        />
      )}

      {/* Kilos Input Dialog */}
      <Modal
        visible={showKilosDialog}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowKilosDialog(false)}
      >
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.modalContent}>
            <Text style={dynamicStyles.modalTitle}>
              Collection Complete
            </Text>
            
            <View style={dynamicStyles.inputContainer}>
              <Text style={dynamicStyles.inputLabel}>
                How many kilos of garbage did you collect?
              </Text>
              <TextInput
                style={dynamicStyles.textInput}
                value={kilosInput}
                onChangeText={setKilosInput}
                placeholder="Enter kilos (e.g., 25.5)"
                placeholderTextColor={isDarkMode ? '#888' : '#999'}
                keyboardType="numeric"
                autoFocus={true}
              />
            </View>

            <View style={dynamicStyles.modalButtons}>
              <TouchableOpacity
                style={[dynamicStyles.modalButton, dynamicStyles.cancelButton]}
                onPress={cancelCollection}
                disabled={submittingKilos}
              >
                <Text style={dynamicStyles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[dynamicStyles.modalButton, dynamicStyles.submitButton]}
                onPress={submitKilos}
                disabled={submittingKilos}
              >
                <Text style={dynamicStyles.modalButtonText}>
                  {submittingKilos ? 'Submitting...' : 'Submit'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
