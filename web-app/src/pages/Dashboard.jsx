// Dashboard.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/firebase";
import Sidebar from "./Sidebar";
import { GOOGLE_MAPS_LOADER_OPTIONS } from "../utils/googleMapsLoaderOptions";
import {
  GoogleMap,
  Marker,
  InfoWindow,
  Polygon,
  useJsApiLoader,
} from "@react-google-maps/api";
import { FaCheckCircle, FaCircle, FaTruck } from "react-icons/fa";
import { FaRotate } from "react-icons/fa6";
import { IoIosCloseCircle } from "react-icons/io";
import "./Dashboard.css";

/** ── CONFIG ─────────────────────────────────────────────────────────── */
const CITY_OUTLINE_COLOR = "#2d6a4f"; // city outline (green)
const HIGHLIGHT_COLOR = "#E53935";    // search highlight (red)
const CITY_GEOJSON_URL = "/geo/talisay_boundary.geojson";
const ZONES_GEOJSON_URL = "/geo/talisay_zones.geojson"; // Optional - will gracefully handle if missing

const STATUS_CONFIG = {
  online:      { color: "#00C853", label: "Online" },
  offline:     { color: "#FF1744", label: "Offline" },
  uncollected: { color: "#FFA000", label: "Uncollected" },
  approaching: { color: "#FFD600", label: "Approaching" },
  collected:   { color: "#00E676", label: "Collected" },
};

const DashboardScreen = () => {
  /* ── State: data collections ──────────────────────────────────────── */
  const [trucks, setTrucks] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [ongoingCollections, setOngoingCollections] = useState([]);
  const [completedCollections, setCompletedCollections] = useState([]);
  const [missedCollections, setMissedCollections] = useState([]);
  
  // Debug: Log data when it changes (like mobile app debugging)
  useEffect(() => {
    console.log('🚛 Trucks data updated:', trucks);
    console.log('🚛 Trucks with location:', trucks.filter(t => t.location && t.location.latitude && t.location.longitude));
  }, [trucks]);

  useEffect(() => {
    console.log('👥 Collectors data updated:', collectors);
    console.log('👥 Collectors with assignedTruckId:', collectors.filter(c => c.assignedTruckId));
  }, [collectors]);

  useEffect(() => {
    console.log('📅 Schedules data updated:', schedules);
    console.log('📅 Schedules with groupName:', schedules.filter(s => s.groupName));
  }, [schedules]);
  
  /* ── State: map markers ────────────────────────────────────────────── */
  const [activeInfoWindow, setActiveInfoWindow] = useState(null);

  /* ── State: map + search ──────────────────────────────────────────── */
  const mapRef = useRef(null);
  const [selectedTruckId, setSelectedTruckId] = useState(null);

  // custom search (Places AutocompleteService)
  const [searchQuery, setSearchQuery] = useState("");
  const placesAutoSvcRef = useRef(null);
  const placesDetailSvcRef = useRef(null);
  const [predictions, setPredictions] = useState([]); // [{ description, place_id }]
  const [isPredOpen, setIsPredOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  
  // Collector dropdown state
  const [selectedCollectorFromDropdown, setSelectedCollectorFromDropdown] = useState(null);
  const [showCollectorDropdown, setShowCollectorDropdown] = useState(false);
  const [collectorSearchTerm, setCollectorSearchTerm] = useState("");
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showCollectorDropdown && !event.target.closest('.collector-dropdown-container')) {
        setShowCollectorDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCollectorDropdown]);

  // City & zones geometry
  // cityPolygons: LatLng[][][] (polygons -> rings -> LatLngs)
  const [cityPolygons, setCityPolygons] = useState([]);
  const [cityBounds, setCityBounds] = useState(null);
  const [cityCenter, setCityCenter] = useState({ lat: 10.736, lng: 123.010 });
  const [zones, setZones] = useState([]); // { name, outerRing, bounds }

  // Highlight overlay refs
  const highlightShapeRef = useRef(null);
  const dashedOutlineRef = useRef(null);
  const zoneLabelRef = useRef(null);

  // Search results state
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

 const { isLoaded, loadError } = useJsApiLoader(GOOGLE_MAPS_LOADER_OPTIONS);

  /* ── Live Firestore subscriptions ─────────────────────────────────── */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "trucks"), (snap) =>
      setTrucks(
        snap.docs.map((d) => ({
          truckId: d.id,
          ...d.data(),
          lastUpdated: d.data().lastUpdated?.toDate?.() ?? null,
        }))
      )
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "collectors"), (snap) =>
      setCollectors(
        snap.docs.map((d) => ({
          collectorId: d.id,
          ...d.data(),
          isOnline: (d.data()?.status || "").toLowerCase() === "online",
        }))
      )
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "schedules"), (snap) =>
      setSchedules(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      )
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "collections"), (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setOngoingCollections(all.filter((c) => c.status === "started"));
      setCompletedCollections(all.filter((c) => c.status === "completed"));
      setMissedCollections(all.filter((c) => c.status === "missed"));
    });
    return () => unsub();
  }, []);

  /* ── GeoJSON helpers ──────────────────────────────────────────────── */
  const toLatLng = (lngLat) => {
    if (!Array.isArray(lngLat) || lngLat.length < 2) {
      throw new Error('Invalid coordinate array');
    }
    const [lng, lat] = lngLat;
    if (typeof lng !== 'number' || typeof lat !== 'number' || 
        isNaN(lng) || isNaN(lat) || !isFinite(lng) || !isFinite(lat)) {
      throw new Error('Invalid coordinate values');
    }
    return new window.google.maps.LatLng(lat, lng); // GeoJSON [lng,lat] -> LatLng(lat, lng)
  };

  const featureToPolygons = (feature) => {
    try {
      const geom = feature?.geometry;
      if (!geom || !geom.coordinates) return [];
      
      if (geom.type === "Polygon") {
        // [[ring1Pts], [hole1Pts], ...]
        return [geom.coordinates.map((ring) => {
          if (!Array.isArray(ring)) return [];
          return ring.map((coord) => {
            try {
              return toLatLng(coord);
            } catch (e) {
              console.warn('Invalid coordinate:', coord);
              return null;
            }
          }).filter(Boolean);
        }).filter(ring => ring.length > 0)];
      }
      
      if (geom.type === "MultiPolygon") {
        // [[[ring1], [hole1]], [[ring1], ...], ...]
        return geom.coordinates.map((poly) => {
          if (!Array.isArray(poly)) return [];
          return poly.map((ring) => {
            if (!Array.isArray(ring)) return [];
            return ring.map((coord) => {
              try {
                return toLatLng(coord);
              } catch (e) {
                console.warn('Invalid coordinate:', coord);
                return null;
              }
            }).filter(Boolean);
          }).filter(ring => ring.length > 0);
        }).filter(poly => poly.length > 0);
      }
      
      return [];
    } catch (error) {
      console.error('Error processing feature geometry:', error);
      return [];
    }
  };

  const computeBoundsFromRing = (ring) => {
    const b = new window.google.maps.LatLngBounds();
    ring.forEach((pt) => b.extend(pt));
    return b;
  };

  const computeBoundsFromPolygons = (polygons) => {
    if (!polygons || !Array.isArray(polygons) || polygons.length === 0) {
      return null;
    }
    
    const b = new window.google.maps.LatLngBounds();
    let hasValidPoints = false;
    
    polygons.forEach((poly) => {
      if (poly && Array.isArray(poly) && poly[0] && Array.isArray(poly[0])) {
        poly[0].forEach((pt) => {
          if (pt && typeof pt.lat === 'function' && typeof pt.lng === 'function') {
            b.extend(pt);
            hasValidPoints = true;
          }
        });
      }
    });
    
    return hasValidPoints ? b : null;
  };

  /* ── Load city & zones ───────────────────────────────────────────── */
  useEffect(() => {
    if (!isLoaded || !window.google) return;

    const loadCity = async () => {
      try {
        const res = await fetch(CITY_GEOJSON_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`City GeoJSON ${res.status}`);
        const gj = await res.json();

        const f = Array.isArray(gj?.features) ? gj.features[0] : null;
        if (!f) return;

        const polygons = featureToPolygons(f);
        setCityPolygons(polygons);

        const b = computeBoundsFromPolygons(polygons);
        setCityBounds(b);
        
        // Safely get center with fallback
        if (b) {
          const center = b.getCenter();
          if (center && typeof center.toJSON === 'function') {
            setCityCenter(center.toJSON());
          } else {
            // Fallback to default center if bounds center is invalid
            setCityCenter({ lat: 10.736, lng: 123.010 });
          }
        } else {
          // No valid bounds computed, use default center
          setCityCenter({ lat: 10.736, lng: 123.010 });
        }
      } catch (err) {
        console.error("City GeoJSON load failed:", err);
      }
    };

    const loadZones = async () => {
      try {
        const res = await fetch(ZONES_GEOJSON_URL, { cache: "no-store" });
        if (!res.ok) {
          console.log("Zones GeoJSON not available - using schedule-based zones instead");
          return;
        }
        
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.log("Zones GeoJSON returned non-JSON content - using schedule-based zones instead");
          return;
        }
        
        const gj = await res.json();

        const z = (gj.features || []).map((f) => {
          const name =
            f.properties?.name ||
            f.properties?.NAME ||
            f.properties?.zone ||
            f.properties?.Zone ||
            "Unnamed Zone";

          const polygons = featureToPolygons(f);
          // take first polygon's outer ring for highlight
          const outerRing = polygons?.[0]?.[0] || [];
          return {
            name: String(name),
            outerRing,
            bounds: outerRing.length ? computeBoundsFromRing(outerRing) : null,
          };
        });

        setZones(z);
        console.log(`Loaded ${z.length} zones from GeoJSON`);
      } catch (err) {
        console.log("Zones GeoJSON not found or invalid - using schedule-based zones instead:", err.message);
      }
    };

    loadCity();
    loadZones();
  }, [isLoaded]);

  /* ── Derived helpers ─────────────────────────────────────────────── */
  const isTruckOnline = (truckId) =>
    collectors.find((c) => c.assignedTruck === truckId)?.isOnline === true;

  const getTruckStatus = (truckId) => {
    if (!isTruckOnline(truckId)) return "offline";
    if (ongoingCollections.some((c) => c.truckId === truckId)) return "approaching";
    if (completedCollections.some((c) => c.truckId === truckId)) return "collected";
    return "uncollected";
  };

  const getAssignedCollector = (truckId) =>
    collectors.find((x) => x.assignedTruckId === truckId)?.collectorId || "Unassigned";

  // Function to center map on truck location
  const centerMapOnTruck = (truck) => {
    if (truck && truck.location && truck.location.latitude && truck.location.longitude && mapRef.current) {
      console.log('🎯 Centering map on truck:', truck.truckId, 'at:', truck.location);
      
      // Force center the map on truck location
      const truckLocation = {
        lat: truck.location.latitude,
        lng: truck.location.longitude
      };
      
      // Use setTimeout to ensure map is ready
      setTimeout(() => {
        if (mapRef.current) {
          // Set center and zoom
          mapRef.current.setCenter(truckLocation);
          mapRef.current.setZoom(18); // Higher zoom for better focus
          
          // Also pan to the location to ensure it's visible
          mapRef.current.panTo(truckLocation);
          
          console.log('✅ Map centered on truck location:', truckLocation);
        }
      }, 100);
      
      // Set the active info window to show truck details
      setActiveInfoWindow(truck.truckId);
      
    } else {
      console.log('❌ Cannot center map - missing data:', {
        truck: !!truck,
        location: truck?.location,
        mapRef: !!mapRef.current
      });
    }
  };

  // Function to handle collector selection and show their schedule location
  const handleCollectorSelection = (collector) => {
    console.log('👤 Selected collector:', collector);
    setSelectedCollectorFromDropdown(collector);
    setShowCollectorDropdown(false);
    setCollectorSearchTerm(`${collector.firstName} ${collector.lastName}`);
    
    // Find the collector's assigned truck
    const assignedTruck = trucks.find(truck => truck.truckId === collector.assignedTruckId);
    
    // Find schedules for this collector
    const collectorSchedules = schedules.filter(schedule => {
      const driverFullName = (schedule.driver || "").toLowerCase().trim();
      const collectorFullName = `${collector.firstName} ${collector.lastName}`.toLowerCase();
      const firstName = collector.firstName.toLowerCase();
      const lastName = collector.lastName.toLowerCase();
      
      // Check if collector is the driver
      if (driverFullName.includes(collectorFullName) || 
          driverFullName.includes(firstName) || 
          driverFullName.includes(lastName)) {
        return true;
      }
      
      // Check if collector is in members array
      if (schedule.members && Array.isArray(schedule.members)) {
        return schedule.members.some(member => {
          const memberName = member.toLowerCase();
          return memberName.includes(collectorFullName) || 
                 memberName.includes(firstName) ||
                 memberName.includes(lastName);
        });
      }
      
      return false;
    });
    
    console.log('📅 Found schedules for collector:', collectorSchedules);
    
    // Always try to center on the assigned truck first
    if (assignedTruck && assignedTruck.location) {
      console.log('🚛 Centering on assigned truck:', assignedTruck.truckId);
      centerMapOnTruck(assignedTruck);
      
      // Show search results with collector's information
      setSearchResults([{
        schedule: collectorSchedules.length > 0 ? collectorSchedules[0] : null,
        assignedCollectors: [collector],
        truck: assignedTruck,
        matchType: 'collector'
      }]);
      setShowSearchResults(true);
    } else {
      console.log('❌ No assigned truck or location found for collector:', collector.collectorId);
      console.log('🔍 Assigned truck data:', assignedTruck);
      
      // Show results even without truck location
      setSearchResults([{
        schedule: collectorSchedules.length > 0 ? collectorSchedules[0] : null,
        assignedCollectors: [collector],
        truck: assignedTruck, // Show truck even if no location
        matchType: 'collector'
      }]);
      setShowSearchResults(true);
    }
  };

  /* ── Search logic for zones/places ─────────────────────────────────── */
  const searchZoneOrPlace = (query) => {
    if (!query || !query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const searchTerm = query.toLowerCase().trim();
    const results = [];
    
    // Debug logging
    console.log('🔍 Searching for:', searchTerm);

    // First, search for truck ID directly (like mobile app)
    const truckIdMatch = trucks.find(truck => 
      truck.truckId && truck.truckId.toLowerCase().includes(searchTerm)
    );
    
    if (truckIdMatch) {
      console.log('🚛 Found truck by ID:', truckIdMatch.truckId);
      
      // Find related schedule for this truck using groupName (like mobile app)
      const relatedSchedule = schedules.find(schedule => 
        schedule.groupName === truckIdMatch.truckId
      );
      
      // Find collectors assigned to this truck using assignedTruckId (like mobile app)
      const assignedCollectors = collectors.filter(collector => 
        collector.assignedTruckId === truckIdMatch.truckId
      );
      
      results.push({
        schedule: relatedSchedule,
        assignedCollectors,
        truck: truckIdMatch,
        matchType: 'truck_id'
      });
    }

    // Search for driver names in schedules (like mobile app logic)
    schedules.forEach((schedule) => {
      const driver = (schedule.driver || "").toLowerCase().trim();
      
      // Check if search term matches driver name (like mobile app)
      if (driver.includes(searchTerm) || searchTerm.includes(driver)) {
        console.log('👤 Found driver match:', schedule.driver);
        
        // Find collectors assigned to this truck (like mobile app)
        const assignedCollectors = collectors.filter((collector) => {
          const collectorFullName = `${collector.firstName || ""} ${collector.lastName || ""}`.trim().toLowerCase();
          const firstName = (collector.firstName || "").toLowerCase();
          const lastName = (collector.lastName || "").toLowerCase();
          const driverFullName = driver.toLowerCase().trim();
          
          // Check if collector is assigned to this truck (like mobile app)
          if (collector.assignedTruckId === schedule.groupName) {
            return true;
          }
          
          // Check if collector name matches the driver (like mobile app pattern)
          if (driverFullName.includes(collectorFullName) || 
              collectorFullName.includes(driverFullName) ||
              driverFullName.includes(firstName) ||
              driverFullName.includes(lastName)) {
            return true;
          }
          
          // Check if collector is in the members array (like mobile app)
          if (schedule.members && Array.isArray(schedule.members)) {
            return schedule.members.some(member => {
              const memberName = member.toLowerCase();
              return memberName.includes(collectorFullName) || 
                     memberName.includes(firstName) ||
                     memberName.includes(lastName);
            });
          }
          
          return false;
        });

        // Find truck location for this group
        const truck = trucks.find((t) => t.truckId === schedule.groupName);

        results.push({
          schedule,
          assignedCollectors,
          truck,
          matchType: 'driver'
        });
      }
    });

    // Search in schedules for matching zones, locations, or group names
    schedules.forEach((schedule, index) => {
      const zone = (schedule.zone || "").toLowerCase();
      const location = (schedule.location || "").toLowerCase();
      const groupName = (schedule.groupName || "").toLowerCase();
      const driver = (schedule.driver || "").toLowerCase();


      // Normalize search term for better matching (remove parentheses, extra spaces)
      const normalizedSearchTerm = searchTerm.replace(/[().]/g, "").replace(/\s+/g, " ").trim();
      const normalizedZone = zone.replace(/[().]/g, "").replace(/\s+/g, " ").trim();
      const normalizedLocation = location.replace(/[().]/g, "").replace(/\s+/g, " ").trim();

      // Check if search term matches zone, location, or group name
      if (normalizedZone.includes(normalizedSearchTerm) || 
          normalizedLocation.includes(normalizedSearchTerm) || 
          groupName.includes(searchTerm) ||
          zone.includes(searchTerm) || 
          location.includes(searchTerm)) {
        
        // Find collectors assigned to this truck/group (like mobile app logic)
        const assignedCollectors = collectors.filter((collector) => {
          const collectorFullName = `${collector.firstName || ""} ${collector.lastName || ""}`.trim().toLowerCase();
          const firstName = (collector.firstName || "").toLowerCase();
          const lastName = (collector.lastName || "").toLowerCase();
          const driverFullName = driver.toLowerCase().trim();
          
          // Check if collector is assigned to this truck (like mobile app)
          if (collector.assignedTruckId === schedule.groupName) {
            return true;
          }
          
          // Check if collector name matches the driver (like mobile app pattern)
          if (driverFullName.includes(collectorFullName) || 
              collectorFullName.includes(driverFullName) ||
              driverFullName.includes(firstName) ||
              driverFullName.includes(lastName)) {
            return true;
          }
          
          // Check if collector is in the members array (like mobile app)
          if (schedule.members && Array.isArray(schedule.members)) {
            return schedule.members.some(member => {
              const memberName = member.toLowerCase();
              return memberName.includes(collectorFullName) || 
                     memberName.includes(firstName) ||
                     memberName.includes(lastName);
            });
          }
          
          return false;
        });

        // Find truck location for this group
        const truck = trucks.find((t) => t.truckId === schedule.groupName);

        results.push({
          schedule,
          assignedCollectors,
          truck,
          matchType: zone.includes(searchTerm) ? 'zone' : 
                    location.includes(searchTerm) ? 'location' : 
                    groupName.includes(searchTerm) ? 'group' : 'other'
        });
      }
    });

    // Also search for collectors by name directly (like mobile app)
    collectors.forEach((collector) => {
      const collectorFullName = `${collector.firstName || ""} ${collector.lastName || ""}`.trim().toLowerCase();
      const firstName = (collector.firstName || "").toLowerCase();
      const lastName = (collector.lastName || "").toLowerCase();
      
      // Check if search term matches collector name (like mobile app pattern)
      if (collectorFullName.includes(searchTerm) || 
          firstName.includes(searchTerm) || 
          lastName.includes(searchTerm)) {
        
        // Find their assigned truck (like mobile app)
        const truck = trucks.find((t) => t.truckId === collector.assignedTruckId);
        
        // Find schedules where this collector is involved (like mobile app logic)
        const relatedSchedules = schedules.filter((schedule) => {
          const driverFullName = (schedule.driver || "").toLowerCase().trim();
          
          // Check if collector is the driver (like mobile app)
          if (driverFullName.includes(collectorFullName) || 
              driverFullName.includes(firstName) || 
              driverFullName.includes(lastName)) {
            return true;
          }
          
          // Check if collector is in members array (like mobile app)
          if (schedule.members && Array.isArray(schedule.members)) {
            return schedule.members.some(member => {
              const memberName = member.toLowerCase();
              return memberName.includes(collectorFullName) || 
                     memberName.includes(firstName) || 
                     memberName.includes(lastName);
            });
          }
          
          return false;
        });

        results.push({
          schedule: relatedSchedules[0] || null,
          assignedCollectors: [collector],
          truck,
          matchType: 'collector'
        });
      }
    });

    // If no results found, try partial matching
    if (results.length === 0) {
      const partialResults = [];
      
      schedules.forEach((schedule) => {
        const zone = (schedule.zone || "").toLowerCase();
        const location = (schedule.location || "").toLowerCase();
        const groupName = (schedule.groupName || "").toLowerCase();
        
        // Try to match parts of the search term
        const searchWords = searchTerm.split(/\s+/);
        let hasMatch = false;
        
        searchWords.forEach(word => {
          if (word.length > 2 && (
            zone.includes(word) || 
            location.includes(word) || 
            groupName.includes(word)
          )) {
            hasMatch = true;
          }
        });
        
        if (hasMatch) {
          const assignedCollectors = collectors.filter((collector) => {
            return collector.assignedTruckId === schedule.groupName;
          });
          
          const truck = trucks.find((t) => t.truckId === schedule.groupName);
          
          partialResults.push({
            schedule,
            assignedCollectors,
            truck,
            matchType: 'partial'
          });
        }
      });
      
      results.push(...partialResults);
    }

    // Remove duplicates and set results
    const uniqueResults = results.filter((result, index, self) => 
      index === self.findIndex((r) => 
        r.schedule?.id === result.schedule?.id && 
        r.assignedCollectors[0]?.collectorId === result.assignedCollectors[0]?.collectorId
      )
    );

    console.log('🎯 Final search results:', uniqueResults.length);
    
    setSearchResults(uniqueResults);
    setShowSearchResults(true); // Always show results panel, even if empty
    
    // If we found a truck (especially by truck ID or driver name), center the map on it
    if (uniqueResults.length > 0) {
      const firstResult = uniqueResults[0];
      
      // Prioritize truck ID and driver matches for auto-centering
      if ((firstResult.matchType === 'truck_id' || firstResult.matchType === 'driver') && firstResult.truck) {
        centerMapOnTruck(firstResult.truck);
      }
    }
  };

  const checkIfCollectorIsDriver = (collector, schedules) => {
    const collectorFullName = `${collector.firstName || ""} ${collector.lastName || ""}`.trim().toLowerCase();
    const firstName = (collector.firstName || "").toLowerCase();
    const lastName = (collector.lastName || "").toLowerCase();
    
    return schedules.some((schedule) => {
      const driverFullName = (schedule.driver || "").toLowerCase().trim();
      
      // Check exact match
      if (driverFullName === collectorFullName) {
        return true;
      }
      
      // Check if driver name contains collector name (like mobile app pattern)
      if (driverFullName.includes(collectorFullName) || 
          driverFullName.includes(firstName) || 
          driverFullName.includes(lastName)) {
        return true;
      }
      
      return false;
    });
  };

  const onlineTruckCount = useMemo(() => {
    // Count trucks that have online collectors assigned to them
    const onlineTrucks = trucks.filter(truck => {
      // Check if any collector assigned to this truck is online
      const assignedCollectors = collectors.filter(collector => 
        collector.assignedTruckId === truck.truckId
      );
      return assignedCollectors.some(collector => collector.status === 'online');
    });
    
    console.log('🚛 Total trucks:', trucks.length);
    console.log('👥 Total collectors:', collectors.length);
    console.log('🟢 Online collectors:', collectors.filter(c => c.status === 'online').length);
    console.log('🚛 Trucks with online collectors:', onlineTrucks.length);
    console.log('🚛 Truck statuses:', trucks.map(t => ({ id: t.truckId, status: t.status })));
    console.log('👥 Collector statuses:', collectors.map(c => ({ id: c.collectorId, status: c.status, assignedTruck: c.assignedTruckId })));
    
    return onlineTrucks.length;
  }, [trucks, collectors]);

  /* ── Map bindings ────────────────────────────────────────────────── */
  useEffect(() => {
    if (mapRef.current && cityCenter) mapRef.current.setCenter(cityCenter);
  }, [cityCenter]);

  const handleMapLoad = (map) => {
    mapRef.current = map;

    // Places services (after map is ready)
    if (!placesAutoSvcRef.current) {
      placesAutoSvcRef.current = new window.google.maps.places.AutocompleteService();
    }
    if (!placesDetailSvcRef.current) {
      placesDetailSvcRef.current = new window.google.maps.places.PlacesService(map);
    }

    // Soft clamp to city polygon on drag/idle
    const isInsideCity = (latLng) => {
      if (!window.google?.maps?.geometry || !cityPolygons.length) return true;
      return cityPolygons.some((poly) =>
        window.google.maps.geometry.poly.containsLocation(
          latLng,
          new window.google.maps.Polygon({ paths: poly })
        )
      );
    };

    const recentreIfOutside = () => {
      const c = map.getCenter();
      if (!c) return;
      if (!isInsideCity(c) && cityCenter) map.panTo(cityCenter);
    };

    const dragListener = map.addListener("dragend", recentreIfOutside);
    const idleListener = map.addListener("idle", recentreIfOutside);
    map.__listeners = [dragListener, idleListener];
  };

  const handleMapUnmount = () => {
    const map = mapRef.current;
    if (map?.__listeners?.length) {
      map.__listeners.forEach((l) => window.google.maps.event.removeListener(l));
      map.__listeners = [];
    }
    mapRef.current = null;
  };

  /* ── Search & highlight utilities ─────────────────────────────────── */
  const clearZoneHighlight = () => {
    if (highlightShapeRef.current) {
      highlightShapeRef.current.setMap(null);
      highlightShapeRef.current = null;
    }
    if (dashedOutlineRef.current) {
      dashedOutlineRef.current.setMap(null);
      dashedOutlineRef.current = null;
    }
    if (zoneLabelRef.current) {
      zoneLabelRef.current.close();
      zoneLabelRef.current = null;
    }
  };

  const drawPolygonHighlight = (ring, labelText = "") => {
    clearZoneHighlight();
    if (!mapRef.current || !ring?.length) return;

    const poly = new window.google.maps.Polygon({
      paths: ring,
      map: mapRef.current,
      strokeColor: HIGHLIGHT_COLOR,
      strokeOpacity: 1,
      strokeWeight: 2,
      fillColor: HIGHLIGHT_COLOR,
      fillOpacity: 0.06,
      clickable: false,
    });
    highlightShapeRef.current = poly;

    const dotted = new window.google.maps.Polyline({
      path: ring,
      map: mapRef.current,
      strokeOpacity: 0,
      icons: [
        {
          icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 2, strokeColor: HIGHLIGHT_COLOR },
          offset: "0",
          repeat: "10px",
        },
      ],
      clickable: false,
    });
    dashedOutlineRef.current = dotted;

    const b = computeBoundsFromRing(ring);
    const center = b.getCenter();
    zoneLabelRef.current = new window.google.maps.InfoWindow({
      content: `<div style="font-weight:700;font-size:14px;color:#B71C1C;">${labelText}</div>`,
      position: center,
      disableAutoPan: true,
    });
    zoneLabelRef.current.open({ map: mapRef.current });

    mapRef.current.fitBounds(b);
  };

  const drawBoundsBoundary = (bounds, labelText = "") => {
    clearZoneHighlight();
    if (!bounds) return;
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const nw = new window.google.maps.LatLng(ne.lat(), sw.lng());
    const se = new window.google.maps.LatLng(sw.lat(), ne.lng());
    drawPolygonHighlight([nw, ne, se, sw, nw], labelText);
  };

  const drawCircleBoundary = (location, labelText = "") => {
    clearZoneHighlight();
    if (!mapRef.current) return;

    const circle = new window.google.maps.Circle({
      center: location,
      radius: 250,
      map: mapRef.current,
      strokeColor: HIGHLIGHT_COLOR,
      strokeOpacity: 1,
      strokeWeight: 2,
      fillColor: HIGHLIGHT_COLOR,
      fillOpacity: 0.06,
      clickable: false,
    });
    highlightShapeRef.current = circle;

    zoneLabelRef.current = new window.google.maps.InfoWindow({
      content: `<div style="font-weight:700;font-size:14px;color:#B71C1C;">${labelText}</div>`,
      position: location,
      disableAutoPan: true,
    });
    zoneLabelRef.current.open({ map: mapRef.current });

    mapRef.current.setCenter(location);
    mapRef.current.setZoom(16);
  };

  // Normalize zone names for fuzzy matching
  const norm = (s) =>
    (s || "")
      .toLowerCase()
      .replace(/poblacion/g, "pob")
      .replace(/[().,/_-]/g, "")
      .replace(/\s+/g, "");

  const tryHighlightZoneByName = (query) => {
    if (!zones.length) return false;
    const q = norm(query);
    if (!q) return false;

    let match =
      zones.find((z) => norm(z.name) === q) ||
      zones.find((z) => norm(z.name).includes(q)) ||
      null;

    // also catch "zone12a" patterns
    if (!match) {
      const m = q.match(/zone(\d+[a-z]?)/);
      if (m) {
        match =
          zones.find((z) => norm(z.name) === `zone${m[1]}`) ||
          zones.find((z) => norm(z.name).includes(`zone${m[1]}`)) ||
          null;
      }
    }

    if (match?.outerRing?.length) {
      drawPolygonHighlight(match.outerRing, match.name);
      return true;
    }
    return false;
  };

  const centerMapToGeometry = (geometry, labelText = "") => {
    if (!geometry) return;
    const bounds = geometry.viewport || geometry.bounds;
    if (bounds) drawBoundsBoundary(bounds, labelText);
    else if (geometry.location) drawCircleBoundary(geometry.location, labelText);
  };

  const isInsideCityLatLng = (latLng) => {
    if (!window.google?.maps?.geometry || !cityPolygons.length) return true;
    return cityPolygons.some((poly) =>
      window.google.maps.geometry.poly.containsLocation(
        latLng,
        new window.google.maps.Polygon({ paths: poly })
      )
    );
  };

  /* ── STRICT in-boundary predictions ──────────────────────────────── */
  const fetchPredictions = (text) => {
    const svc = placesAutoSvcRef.current;
    if (!svc || !text || !cityBounds) {
      setPredictions([]);
      setIsPredOpen(false);
      return;
    }

    svc.getPlacePredictions(
      {
        input: text,
        locationRestriction: cityBounds, // restrict to Talisay bounds
        componentRestrictions: { country: "PH" },
      },
      (res, status) => {
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !res?.length) {
          setPredictions([]);
          setIsPredOpen(false);
          return;
        }
        setPredictions(res);
        setIsPredOpen(true);
        setActiveIdx(-1);
      }
    );
  };

  const selectPrediction = (pred) => {
    const svc = placesDetailSvcRef.current;
    if (!svc || !pred?.place_id) return;

    svc.getDetails(
      { placeId: pred.place_id, fields: ["name", "formatted_address", "geometry"] },
      (place, status) => {
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !place?.geometry) return;

        const loc = place.geometry.location || place.geometry.viewport?.getCenter();
        if (loc && !isInsideCityLatLng(loc)) {
          alert("That place is outside Talisay City. Please choose a location within the city.");
          return;
        }

        const label = place.name || place.formatted_address || "Selected Area";
        centerMapToGeometry(place.geometry, label);

        const searchText = place.name || place.formatted_address || "";
        setSearchQuery(searchText);
        
        // Also search for truck information when a location is selected
        searchZoneOrPlace(searchText);
        
        setPredictions([]);
        setIsPredOpen(false);
        setActiveIdx(-1);
      }
    );
  };

  const selectedTruck = selectedTruckId
    ? trucks.find((t) => t.truckId === selectedTruckId)
    : null;
  const selectedCollector = selectedTruck
    ? collectors.find((c) => c.assignedTruck === selectedTruck.truckId)
    : null;

  if (loadError) return <div>Map failed to load.</div>;

  return (
    <div className="dashboard-container">
      <Sidebar />

      <div className="main-content">
        <div className="header">
          <h1 className="dash-title">Waste Collection Dashboard</h1>
        </div>

        <div className="scroll-area">
          {/* ── Real-Time Truck Locations ───────────────────────────── */}
          <div className="section map-section">
            <div className="section-head">
              <h3 className="section-title">Real-Time Truck Locations</h3>
            </div>

            {!isLoaded ? (
              <p>Loading map...</p>
            ) : (
              <div className="map-wrap">
                {/* Search overlay (STRICT in-city) */}
                <div
                  className="map-search"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      // If predictions are closed, try zone highlight on Enter
                      if (!isPredOpen || predictions.length === 0) {
                        if (tryHighlightZoneByName(searchQuery)) return;
                      }
                    }
                    if (!isPredOpen || !predictions.length) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setActiveIdx((i) => Math.min(i + 1, predictions.length - 1));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setActiveIdx((i) => Math.max(i - 1, 0));
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      const choice = predictions[activeIdx] || predictions[0];
                      if (choice) selectPrediction(choice);
                    } else if (e.key === "Escape") {
                      setIsPredOpen(false);
                    }
                  }}
                >
                  <div className="collector-dropdown-container">
                  <input
                      value={collectorSearchTerm}
                    onChange={(e) => {
                      const v = e.target.value;
                        setCollectorSearchTerm(v);
                        setShowCollectorDropdown(v.length > 0);
                      }}
                      onFocus={() => setShowCollectorDropdown(true)}
                      placeholder="Select a collector..."
                    className="map-search-input"
                  />
                    
                    {/* Collector Dropdown */}
                    {showCollectorDropdown && (
                      <div className="collector-dropdown">
                        {collectors
                          .filter(collector => {
                            const fullName = `${collector.firstName} ${collector.lastName}`.toLowerCase();
                            const searchTerm = collectorSearchTerm.toLowerCase();
                            return fullName.includes(searchTerm) || 
                                   collector.firstName?.toLowerCase().includes(searchTerm) ||
                                   collector.lastName?.toLowerCase().includes(searchTerm);
                          })
                          .map((collector, index) => (
                            <div
                              key={collector.collectorId}
                              className="collector-dropdown-item"
                              onClick={() => handleCollectorSelection(collector)}
                            >
                              <div className="collector-info">
                                <strong>{collector.firstName} {collector.lastName}</strong>
                                <span className="collector-id">ID: {collector.collectorId}</span>
                              </div>
                              <div className="collector-status">
                                <span className={`status-badge ${collector.status}`}>
                                  {collector.status}
                                </span>
                                {collector.assignedTruckId && (
                                  <span className="truck-assignment">
                                    🚛 {collector.assignedTruckId}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Predictions dropdown */}
                  {isPredOpen && predictions.length > 0 && (
                    <div className="pred-drop">
                      {predictions.map((p, idx) => (
                        <div
                          key={p.place_id}
                          className={`pred-item ${idx === activeIdx ? "is-active" : ""}`}
                          onMouseEnter={() => setActiveIdx(idx)}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectPrediction(p)}
                          title={p.description}
                        >
                          <span className="pred-pin">📍</span>
                          <span className="pred-text">{p.description}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <GoogleMap
                  mapContainerClassName="map-container"
                  center={cityCenter}
                  zoom={12}
                  onLoad={handleMapLoad}
                  onUnmount={handleMapUnmount}
                  options={{
                    // Removed restriction to allow centering on trucks outside city bounds
                    mapTypeControl: true,
                    mapTypeControlOptions: {
                      position: window.google?.maps?.ControlPosition?.LEFT_BOTTOM,
                    },
                    rotateControl: false,
                    minZoom: 11,
                    maxZoom: 16,
                    streetViewControl: false,
                    fullscreenControl: true,
                    zoomControl: true,
                    controlSize: 24,
                    gestureHandling: "greedy",
                  }}
                >
                  {/* Always-on city outline (supports holes) */}
                  {cityPolygons.map((poly, i) => (
                    <Polygon
                      key={`city-poly-${i}`}
                      paths={poly}
                      options={{
                        strokeColor: CITY_OUTLINE_COLOR,
                        strokeOpacity: 0.7,
                        strokeWeight: 1.5,
                        fillOpacity: 0,
                        clickable: false,
                      }}
                    />
                  ))}

                  {/* Online trucks */}
                  {trucks
                    .filter((t) => {
                      const assn = collectors.find((c) => c.assignedTruck === t.truckId);
                      return assn?.isOnline && t.location?.latitude && t.location?.longitude;
                    })
                    .map((t) => {
                      const status = getTruckStatus(t.truckId);
                      const config = STATUS_CONFIG[status] || STATUS_CONFIG.offline;
                      const collectorId = getAssignedCollector(t.truckId);

                      return (
                        <Marker
                          key={t.truckId}
                          position={{ lat: t.location.latitude, lng: t.location.longitude }}
                          label={{
                            text: `${t.truckId} (${collectorId})`,
                            fontSize: "12px",
                            fontWeight: "bold",
                            color: "#000",
                          }}
                          icon={{
                            path: "M20.8 4H3.2C1.4 4 0 5.4 0 7.2v9.6C0 18.6 1.4 20 3.2 20h1.6c0 1.8 1.4 3.2 3.2 3.2s3.2-1.4 3.2-3.2h4.8c0 1.8 1.4 3.2 3.2 3.2s3.2-1.4 3.2-3.2h1.6c1.8 0 3.2-1.4 3.2-3.2V7.2C24 5.4 22.6 4 20.8 4zM6.4 20.8c-0.9 0-1.6-0.7-1.6-1.6S5.5 17.6 6.4 17.6s1.6 0.7 1.6 1.6-0.7 1.6-1.6 1.6zm11.2 0c-0.9 0-1.6-0.7-1.6-1.6s0.7-1.6 1.6-1.6 1.6 0.7 1.6 1.6z",
                            fillColor: config.color,
                            fillOpacity: 1,
                            strokeWeight: 1,
                            scale: 1.5,
                            anchor: new window.google.maps.Point(12, 24),
                          }}
                          onClick={() => setSelectedTruckId(t.truckId)}
                        />
                      );
                    })}

                  {/* Truck Markers */}
                  {trucks.map((truck) => {
                    console.log('🚛 Truck data:', truck);
                    if (truck.location && truck.location.latitude && truck.location.longitude) {
                      console.log('✅ Rendering marker for truck:', truck.truckId, 'at:', truck.location);
                      return (
                        <Marker
                          key={truck.truckId}
                          position={{
                            lat: truck.location.latitude,
                            lng: truck.location.longitude,
                          }}
                          onClick={() => {
                            console.log('🎯 Marker clicked for truck:', truck.truckId);
                            setActiveInfoWindow(truck.truckId);
                          }}
                          icon={{
                            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                              <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="16" cy="16" r="14" fill="#FF6B35" stroke="#fff" stroke-width="2"/>
                                <text x="16" y="20" text-anchor="middle" fill="white" font-size="16" font-weight="bold">🚛</text>
                              </svg>
                            `),
                            scaledSize: new window.google.maps.Size(32, 32),
                          }}
                        />
                      );
                    } else {
                      console.log('❌ No location data for truck:', truck.truckId, truck.location);
                      return null;
                    }
                  })}

                  {/* Info Window for active truck */}
                  {activeInfoWindow && (() => {
                    const activeTruck = trucks.find((t) => t.truckId === activeInfoWindow);
                    const relatedSchedule = schedules.find(schedule => schedule.groupName === activeInfoWindow);
                    const assignedCollectors = collectors.filter(collector => collector.assignedTruckId === activeInfoWindow);
                    
                    return (
                      <InfoWindow
                        position={
                          activeTruck?.location
                            ? {
                                lat: activeTruck.location.latitude,
                                lng: activeTruck.location.longitude,
                              }
                            : undefined
                        }
                        onCloseClick={() => setActiveInfoWindow(null)}
                      >
                        <div className="info-window-content">
                          {/* Truck Header */}
                          <div className="truck-header">
                            <h4>🚛 {activeInfoWindow}</h4>
                            <span className={`status-badge ${activeTruck?.status || 'unknown'}`}>
                              {activeTruck?.status?.toUpperCase() || 'UNKNOWN'}
                            </span>
                          </div>

                          {/* Schedule Information */}
                          {relatedSchedule && (
                            <div className="info-section">
                              <h6 className="section-title">📅 Schedule Information</h6>
                              <div className="info-grid">
                                <div className="info-item">
                                  <span className="info-label">Zone:</span>
                                  <span className="info-value">{relatedSchedule.zone || 'N/A'}</span>
                                </div>
                                <div className="info-item">
                                  <span className="info-label">Location:</span>
                                  <span className="info-value">{relatedSchedule.location || 'N/A'}</span>
                                </div>
                                <div className="info-item">
                                  <span className="info-label">Day:</span>
                                  <span className="info-value">{relatedSchedule.day || 'N/A'}</span>
                                </div>
                                <div className="info-item">
                                  <span className="info-label">Time:</span>
                                  <span className="info-value">{relatedSchedule.time || 'N/A'}</span>
                                </div>
                                <div className="info-item">
                                  <span className="info-label">Driver:</span>
                                  <span className="info-value driver-name">{relatedSchedule.driver || 'N/A'}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Truck Location */}
                          {activeTruck?.location && (
                            <div className="info-section">
                              <h6 className="section-title">📍 Current Location</h6>
                              <div className="location-details">
                                <div className="coordinates">
                                  <span className="coord-item">
                                    <strong>Lat:</strong> {activeTruck.location.latitude?.toFixed(6)}
                                  </span>
                                  <span className="coord-item">
                                    <strong>Lng:</strong> {activeTruck.location.longitude?.toFixed(6)}
                                  </span>
                                </div>
                                {activeTruck.lastUpdated && (
                                  <div className="last-updated">
                                    <span className="update-label">Last Updated:</span>
                                    <span className="update-time">
                                      {activeTruck.lastUpdated.toLocaleString()}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}


                          {/* Schedule Members */}
                          {relatedSchedule?.members && relatedSchedule.members.length > 0 && (
                            <div className="info-section">
                              <h6 className="section-title">👨‍👩‍👧‍👦 Team Members</h6>
                              <div className="members-list">
                                {relatedSchedule.members.map((member, idx) => (
                                  <span key={idx} className="member-tag">{member}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Truck Details */}
                          {activeTruck && (
                            <div className="info-section">
                              <h6 className="section-title">🚛 Truck Details</h6>
                              <div className="truck-details">
                                {activeTruck.plateNumber && (
                                  <div className="detail-item">
                                    <span className="detail-label">Plate Number:</span>
                                    <span className="detail-value">{activeTruck.plateNumber}</span>
                                  </div>
                                )}
                                {activeTruck.capacityKg && (
                                  <div className="detail-item">
                                    <span className="detail-label">Capacity:</span>
                                    <span className="detail-value">{activeTruck.capacityKg} kg</span>
                                  </div>
                                )}
                                {activeTruck.currentLoadKg !== undefined && (
                                  <div className="detail-item">
                                    <span className="detail-label">Current Load:</span>
                                    <span className="detail-value">{activeTruck.currentLoadKg} kg</span>
                                  </div>
                                )}
                                {activeTruck.fuelType && (
                                  <div className="detail-item">
                                    <span className="detail-label">Fuel Type:</span>
                                    <span className="detail-value">{activeTruck.fuelType}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </InfoWindow>
                    );
                  })()}

                  {/* Info window */}
                  {selectedTruck?.location && (
                    <InfoWindow
                      position={{
                        lat: selectedTruck.location.latitude,
                        lng: selectedTruck.location.longitude,
                      }}
                      onCloseClick={() => setSelectedTruckId(null)}
                    >
                      <div style={{ minWidth: 220 }}>
                        <h4 style={{ margin: 0 }}>{selectedTruck.truckId}</h4>
                        <p style={{ margin: "6px 0 0" }}>
                          <strong>Status:</strong>{" "}
                          <span
                            style={{
                              color: STATUS_CONFIG[getTruckStatus(selectedTruck.truckId)].color,
                              fontWeight: "bold",
                            }}
                          >
                            {STATUS_CONFIG[getTruckStatus(selectedTruck.truckId)].label}
                          </span>
                        </p>
                        <p style={{ margin: "4px 0" }}>
                          <strong>Collector:</strong>{" "}
                          {selectedCollector ? selectedCollector.collectorId : "Unassigned"}
                        </p>
                        <p style={{ margin: "4px 0" }}>
                          <strong>Coords:</strong>{" "}
                          {selectedTruck.location.latitude.toFixed(5)},{" "}
                          {selectedTruck.location.longitude.toFixed(5)}
                        </p>
                        <p style={{ margin: "4px 0" }}>
                          <strong>Last Updated:</strong>{" "}
                          {selectedTruck.lastUpdated
                            ? selectedTruck.lastUpdated.toLocaleString()
                            : "Unknown"}
                        </p>
                      </div>
                    </InfoWindow>
                  )}
                </GoogleMap>

                {/* Quick stat badge */}
                <div className="map-badge">
                  <b>Online Trucks:</b> {onlineTruckCount}
                </div>
              </div>
            )}

            {/* Search Results Display */}
            {showSearchResults && (
              <div className="search-results">
                <div className="search-results-header">
                  <div className="header-content">
                    <h4>
                      <FaTruck className="truck-icon" />
                      {selectedCollectorFromDropdown 
                        ? `Collector Details: ${selectedCollectorFromDropdown.firstName} ${selectedCollectorFromDropdown.lastName}`
                        : `Search Results for: "${searchQuery}"`
                      }
                    </h4>
                    <p className="results-count">
                      {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
                    </p>
                  </div>
                  <button 
                    className="close-results-btn"
                    onClick={() => {
                      setShowSearchResults(false);
                      setSearchResults([]);
                      setSelectedCollectorFromDropdown(null);
                      setCollectorSearchTerm("");
                    }}
                    title="Close results"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="search-results-content">
                  {searchResults.length > 0 ? (
                    searchResults.map((result, index) => (
                      <div key={index} className="search-result-item">
                        {/* Result Header */}
                        <div className="result-header">
                          <div className="truck-title">
                            <FaTruck className="truck-icon" />
                            <h5>{result.schedule?.groupName || result.truck?.truckId || 'Unknown Truck'}</h5>
                          </div>
                          <span className={`match-type ${result.matchType}`}>
                            {result.matchType.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>

                        {/* Schedule Information */}
                        {result.schedule && (
                          <div className="info-section schedule-info">
                            <h6 className="section-title">📅 Schedule Information</h6>
                            <div className="info-grid">
                              <div className="info-item">
                                <span className="info-label">Zone:</span>
                                <span className="info-value">{result.schedule.zone || 'N/A'}</span>
                              </div>
                              <div className="info-item">
                                <span className="info-label">Location:</span>
                                <span className="info-value">{result.schedule.location || 'N/A'}</span>
                              </div>
                              <div className="info-item">
                                <span className="info-label">Day:</span>
                                <span className="info-value">{result.schedule.day || 'N/A'}</span>
                              </div>
                              <div className="info-item">
                                <span className="info-label">Time:</span>
                                <span className="info-value">{result.schedule.time || 'N/A'}</span>
                              </div>
                              <div className="info-item">
                                <span className="info-label">Driver:</span>
                                <span className="info-value driver-name">{result.schedule.driver || 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Truck Location */}
                        {result.truck && result.truck.location && (
                          <div className="info-section truck-location">
                            <h6 className="section-title">📍 Truck Location</h6>
                            <div className="location-details">
                              <div className="coordinates">
                                <span className="coord-item">
                                  <strong>Latitude:</strong> {result.truck.location.latitude?.toFixed(6)}
                                </span>
                                <span className="coord-item">
                                  <strong>Longitude:</strong> {result.truck.location.longitude?.toFixed(6)}
                                </span>
                              </div>
                              {result.truck.status && (
                                <div className="truck-status">
                                  <span className="status-label">Status:</span>
                                  <span className={`status-badge ${result.truck.status}`}>
                                    {result.truck.status.toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Assigned Collectors */}
                        {/* <div className="info-section collectors-info">
                          <h6 className="section-title">👥 Assigned Collectors</h6>
                          {console.log('🔍 Debug - assignedCollectors:', result.assignedCollectors)}
                          {result.assignedCollectors.length > 0 ? (
                            <div className="collectors-list">
                              {result.assignedCollectors.map((collector, idx) => {
                                const isDriver = checkIfCollectorIsDriver(collector, schedules);
                                return (
                                  <div key={idx} className="collector-card">
                                    <div className="collector-main">
                                      <span className="collector-name">
                                        {collector.firstName} {collector.lastName}
                                        {isDriver && <span className="driver-badge">DRIVER</span>}
                                      </span>
                                      <span className="collector-id">ID: {collector.collectorId}</span>
                                    </div>
                                    <div className="collector-status">
                                      <span className={`status-indicator ${collector.status}`}>
                                        {collector.status.toUpperCase()}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="no-collectors">
                              <p>No collectors assigned to this truck</p>
                              {result.truck && (
                                <p className="truck-info">
                                  Truck ID: <strong>{result.truck.truckId}</strong>
                                </p>
                              )}
                            </div>
                          )}
                        </div> */}

                        {/* Schedule Members */}
                        {result.schedule?.members && result.schedule.members.length > 0 && (
                          <div className="info-section schedule-members">
                            <h6 className="section-title">👨‍👩‍👧‍👦 Team Members</h6>
                            <div className="members-list">
                              {result.schedule.members.map((member, idx) => (
                                <span key={idx} className="member-tag">{member}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="no-results">
                      <div className="no-results-icon">🚛</div>
                      <h4>No Results Found</h4>
                      <p>No truck bases or collectors found for "{searchQuery}"</p>
                      <div className="no-results-suggestions">
                        <h5>💡 Try searching for:</h5>
                        <ul className="suggestions-list">
                          <li>🚛 <strong>Truck ID:</strong> "CMPCTR001", "GARBAGE COMPACTOR 001"</li>
                          <li>👤 <strong>Driver names:</strong> "Joel Jalique", "Crispin"</li>
                          <li>🗺️ <strong>Zone names:</strong> "Zone 3", "Zone 16"</li>
                          <li>📍 <strong>Location names:</strong> "Concepcion Market"</li>
                          <li>👥 <strong>Collector names:</strong> "Joel", "Alexander"</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Collection Summary ───────────────────────────────────── */}
          {/* <div className="section">
            <h3 className="section-title">Collection Summary</h3>
            <div className="summary">
              <p className="summary-item">
                <FaCheckCircle style={{ color: "green", fontSize: 18, marginRight: 5 }} />
                <b>Completed: {completedCollections.length}</b>
              </p>
              <p className="summary-item">
                <FaRotate style={{ color: "blue", fontSize: 18, marginRight: 5 }} />
                <b>Ongoing: {ongoingCollections.length}</b>
              </p>
              <p className="summary-item">
                <IoIosCloseCircle style={{ color: "red", fontSize: 23, marginRight: 5 }} />
                <b>Missed: {missedCollections.length}</b>
              </p>
              <p className="summary-item">
                <FaCircle style={{ color: "green", fontSize: 18, marginRight: 5 }} />
                <b>Online: {onlineTruckCount}</b>
              </p>
            </div>
          </div> */}

          {/* ── Truck Details ────────────────────────────────────────── */}
          {/* <div className="section">
            <h3 className="section-title">Truck Details</h3>
            <div className="truck-grid">
              {trucks.map((t) => {
                const status = getTruckStatus(t.truckId);
                const config = STATUS_CONFIG[status] || STATUS_CONFIG.offline;
                const collector = collectors.find((c) => c.assignedTruck === t.truckId);

                return (
                  <div
                    key={t.truckId}
                    className="truck-card"
                    style={{ borderLeftColor: config.color, cursor: "pointer" }}
                    onClick={() => setSelectedTruckId(t.truckId)}
                    title="Show on map"
                  >
                    <h4 style={{ marginBottom: 8 }}>{t.truckId}</h4>
                    <p>
                      <strong>Status:</strong>
                      <span style={{ color: config.color, fontWeight: "bold", marginLeft: 8 }}>
                        {config.label}
                      </span>
                    </p>
                    <p>
                      <strong>Assigned Collector:</strong>
                      {collector ? ` ${collector.collectorId}` : " Unassigned"}
                    </p>
                    {status !== "offline" && t.location && (
                      <p>
                        <strong>Location:</strong>{" "}
                        {t.location.latitude?.toFixed(4)}, {t.location.longitude?.toFixed(4)}
                      </p>
                    )}
                    <p>
                      <strong>Last Updated:</strong>{" "}
                      {t.lastUpdated?.toLocaleTimeString() || "Unknown"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div> */}

          {/* ── Alerts ──────────────────────────────────────────────── */}
          {/* <div className="section">
            <h3 className="section-title">Alerts</h3>
            {missedCollections.length > 0 ? (
              <>
                <p className="alert-text">
                  🚨 {missedCollections.length} Missed Collection
                  {missedCollections.length > 1 ? "s" : ""}
                </p>
                <ul>
                  {missedCollections.map((m) => (
                    <li key={m.id} className="alert-item">
                      ❌ Truck: {m.truckId || "Unknown"} | Zone: {m.zone || m.zoneId || "Unknown"}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>No alerts.</p>
            )}
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default DashboardScreen;
