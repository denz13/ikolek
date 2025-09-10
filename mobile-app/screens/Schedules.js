import React, { useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import {
  Ionicons,
  MaterialIcons,
  FontAwesome5,
  Entypo,
} from "@expo/vector-icons";
import { ThemeContext } from "./ThemeContext";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebasecollector/firebase";

export default function CollectionScheduleScreen() {
  const { isDarkMode } = useContext(ThemeContext);

  const [schedules, setSchedules] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("schedules"); // 'schedules' or 'routes'
  const [expandedSchedule, setExpandedSchedule] = useState(null); // For collapsible members

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        if (activeTab === "schedules") {
          const schedulesSnapshot = await getDocs(collection(db, "schedules"));
          const schedulesData = schedulesSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setSchedules(schedulesData);
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

    fetchData();
  }, [activeTab]);

  const dynamicStyles = {
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? "#121212" : "#f4f4f4",
      paddingTop: 40,
    },
    header: {
      alignItems: "center",
      paddingBottom: 15,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? "#333" : "#ccc",
    },
    headerTitle: {
      fontSize: 22,
      color: isDarkMode ? "#fff" : "#000",
      fontWeight: "bold",
      marginBottom: 10,
    },
    tabContainer: {
      flexDirection: "row",
      justifyContent: "center",
      marginBottom: 15,
    },
    tabButton: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      marginHorizontal: 5,
      borderRadius: 20,
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
    },
    activeTabText: {
      color: "white",
    },
    scheduleCard: {
      backgroundColor: isDarkMode ? "#1E1E1E" : "#FFFFFF",
      padding: 16,
      marginHorizontal: 20,
      marginVertical: 10,
      borderRadius: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    routeText: {
      color: isDarkMode ? "#fff" : "#000",
      fontSize: 17,
      fontWeight: "bold",
      marginBottom: 6,
    },
    detailRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 6,
    },
    detailText: {
      color: isDarkMode ? "#CCC" : "#555",
      fontSize: 14,
      marginLeft: 6,
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
  };

  const renderScheduleItem = ({ item }) => {
    const isExpanded = expandedSchedule === item.id;

    return (
      <View style={dynamicStyles.scheduleCard}>
        <Text style={dynamicStyles.routeText}>{item.groupName || "N/A"}</Text>

        <View style={dynamicStyles.detailRow}>
          <MaterialIcons name="calendar-today" size={18} color="#ff9800" />
          <Text style={dynamicStyles.detailText}>{item.day}</Text>
        </View>

        <View style={dynamicStyles.detailRow}>
          <Ionicons name="person" size={18} color="#2196f3" />
          <Text style={dynamicStyles.detailText}>Driver: {item.driver}</Text>
        </View>

        <View style={dynamicStyles.detailRow}>
          <FontAwesome5 name="truck" size={18} color="#4caf50" />
          <Text style={dynamicStyles.detailText}>{item.groupName}</Text>
        </View>

        <View style={dynamicStyles.detailRow}>
          <Entypo name="location-pin" size={18} color="#e91e63" />
          <Text style={dynamicStyles.detailText}>{item.location}</Text>
        </View>

        <View style={dynamicStyles.detailRow}>
          <Ionicons name="time" size={18} color="#9c27b0" />
          <Text style={dynamicStyles.detailText}>{item.time}</Text>
        </View>

        <View style={dynamicStyles.detailRow}>
          <FontAwesome5 name="layer-group" size={18} color="#795548" />
          <Text style={dynamicStyles.detailText}>Zone: {item.zone}</Text>
        </View>

        {/* Collapsible Members */}
        <TouchableOpacity
          style={dynamicStyles.detailRow}
          onPress={() =>
            setExpandedSchedule(isExpanded ? null : item.id)
          }
        >
          <Ionicons name="people" size={18} color="#009688" />
          <Text style={dynamicStyles.detailText}>
            Members ({item.members?.length || 0})
          </Text>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={16}
            color="#009688"
            style={{ marginLeft: 5 }}
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={dynamicStyles.membersList}>
            {item.members?.map((m, i) => (
              <Text key={i} style={dynamicStyles.memberText}>
                • {m}
              </Text>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={dynamicStyles.viewButton}
          onPress={() =>
            alert(`Schedule Details:\n\n${JSON.stringify(item, null, 2)}`)
          }
        >
          <Text style={dynamicStyles.viewText}>VIEW DETAILS</Text>
        </TouchableOpacity>
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

  return (
    <View style={dynamicStyles.container}>
      {/* Header */}
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.headerTitle}>Collection Management</Text>

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

          <TouchableOpacity
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
          </TouchableOpacity>
        </View>
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
          ListEmptyComponent={
            <View style={dynamicStyles.emptyState}>
              <Text style={dynamicStyles.emptyText}>
                No {activeTab === "schedules" ? "schedules" : "routes"} found
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
