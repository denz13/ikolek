import React, { useState, useRef, useEffect } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Autocomplete,
  DirectionsRenderer,
  Marker,
} from "@react-google-maps/api";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import Sidebar from "./Sidebar";
import { GOOGLE_MAPS_LOADER_OPTIONS } from "../utils/googleMapsLoaderOptions";
import "./AddRoutes.css";

const mapContainerStyle = { width: "100%", height: "100%" };
const center = { lat: 10.73237840605571, lng: 123.01135894262397 };

const TALISAY_BOUNDARY = {
  north: 10.8,
  south: 10.65,
  west: 122.95,
  east: 123.1,
};

export default function AddRoutes() {
  const { isLoaded, loadError } = useJsApiLoader({
    ...GOOGLE_MAPS_LOADER_OPTIONS,
    libraries: ["places"],
  });
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [directions, setDirections] = useState(null);
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [, setMap] = useState(null);
  const [clickMode, setClickMode] = useState("origin");
  const [originMarker, setOriginMarker] = useState(null);
  const [destinationMarker, setDestinationMarker] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState(null);
  const [showSavedRoutes, setShowSavedRoutes] = useState(false);
  const [routeId, setRouteId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const originAutocompleteRef = useRef(null);
  const destinationAutocompleteRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        setLoading(true);
        const querySnapshot = await getDocs(collection(db, "routes"));
        const routes = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setSavedRoutes(routes);
      } catch (err) {
        setError("Failed to load routes: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchRoutes();
  }, []);

  const isWithinTalisay = (latLng) => {
    if (!latLng) return false;
    const lat = latLng.lat ? latLng.lat() : latLng.lat;
    const lng = latLng.lng ? latLng.lng() : latLng.lng;
    
    return (
      lat >= TALISAY_BOUNDARY.south &&
      lat <= TALISAY_BOUNDARY.north &&
      lng >= TALISAY_BOUNDARY.west &&
      lng <= TALISAY_BOUNDARY.east
    );
  };

  const generateRoute = async () => {
    setError("");
    if (!origin || !destination) {
      setError("Please provide both origin and destination.");
      return;
    }

    try {
      setLoading(true);
      const directionsService = new window.google.maps.DirectionsService();
      
      const results = await directionsService.route({
        origin,
        destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
      });

      if (!results || !results.routes.length) {
        throw new Error("No route found");
      }

      const leg = results.routes[0].legs[0];
      if (!leg) {
        throw new Error("Route information incomplete");
      }

      if (!isWithinTalisay(leg.start_location) || !isWithinTalisay(leg.end_location)) {
        throw new Error("Both locations must be within Talisay City");
      }

      setDirections(results);
      setDistance(leg.distance.text);
      setDuration(leg.duration.text);
      setOriginMarker(leg.start_location);
      setDestinationMarker(leg.end_location);
      setModalOpen(true);

      if (mapRef.current) {
        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend(leg.start_location);
        bounds.extend(leg.end_location);
        mapRef.current.fitBounds(bounds);
      }
    } catch (err) {
      setError("Error generating route: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveRoute = async () => {
    if (!directions) return;

    try {
      setLoading(true);
      const route = directions.routes[0];
      const leg = route.legs[0];
      const polylinePoints = route.overview_polyline?.points || "";

      const routeData = {
        routeId: routeId || `route_${Date.now()}`,
        origin: leg.start_address,
        destination: leg.end_address,
        distance: leg.distance.text,
        duration: leg.duration.text,
        polyline: polylinePoints,
        originCoords: {
          lat: originMarker.lat(),
          lng: originMarker.lng()
        },
        destinationCoords: {
          lat: destinationMarker.lat(),
          lng: destinationMarker.lng()
        },
        updatedAt: serverTimestamp(),
      };

      if (editingRoute) {
        await updateDoc(doc(db, "routes", editingRoute.id), routeData);
        setSavedRoutes(prev => 
          prev.map(r => r.id === editingRoute.id ? { ...r, ...routeData } : r)
        );
      } else {
        const docId = routeData.routeId;
        await setDoc(doc(db, "routes", docId), {
          ...routeData,
          createdAt: serverTimestamp()
        });
        setSavedRoutes(prev => [...prev, { id: docId, ...routeData }]);
      }

      setModalOpen(false);
      setEditingRoute(null);
      setError("");
    } catch (err) {
      setError("Error saving route: " + err.message);
    } finally {
      setLoading(false);
    }
  };


  const deleteRoute = async (id) => {
    if (!window.confirm("Delete this route?")) return;
    await deleteDoc(doc(db, "routes", id));
    setSavedRoutes((prev) => prev.filter((r) => r.id !== id));
  };

  const editRoute = (route) => {
    setOrigin(route.origin);
    setDestination(route.destination);
    setRouteId(route.routeId || "route001");
    setEditingRoute(route);
    
    if (route.originCoords) {
      setOriginMarker(new window.google.maps.LatLng(
        route.originCoords.lat,
        route.originCoords.lng
      ));
    }
    
    if (route.destinationCoords) {
      setDestinationMarker(new window.google.maps.LatLng(
        route.destinationCoords.lat,
        route.destinationCoords.lng
      ));
    }
    
    setModalOpen(false);
    setTimeout(() => {
      generateRoute();
    }, 100);
  };

  const handleMapClick = (e) => {
    const latLng = e.latLng;
    if (!latLng) return;

    if (!isWithinTalisay(latLng)) {
      setError("Selected location is outside Talisay City boundaries");
      return;
    }

    if (clickMode === "origin") {
      setOrigin(`${latLng.lat()},${latLng.lng()}`);
      setOriginMarker(latLng);
      if (mapRef.current) {
        mapRef.current.setCenter(latLng);
        mapRef.current.setZoom(15);
      }
    } else {
      setDestination(`${latLng.lat()},${latLng.lng()}`);
      setDestinationMarker(latLng);
      if (mapRef.current) {
        mapRef.current.setCenter(latLng);
        mapRef.current.setZoom(15);
      }
    }
    setError("");
  };

  const handlePlaceChanged = (autocompleteRef, isOrigin) => {
    const place = autocompleteRef.current.getPlace();
    if (!place.geometry) {
      setError("No details available for this place");
      return;
    }

    if (!isWithinTalisay(place.geometry.location)) {
      setError("Selected location is outside Talisay City boundaries");
      return;
    }

    if (isOrigin) {
      setOrigin(place.formatted_address);
      setOriginMarker(place.geometry.location);
    } else {
      setDestination(place.formatted_address);
      setDestinationMarker(place.geometry.location);
    }

    if (mapRef.current) {
      if (place.geometry.viewport) {
        mapRef.current.fitBounds(place.geometry.viewport);
      } else {
        mapRef.current.setCenter(place.geometry.location);
        mapRef.current.setZoom(15);
      }
    }
    setError("");
  };

  if (loadError) {
    return (
      <div className="error-container">
        <h3>Error loading Google Maps</h3>
        <p>{loadError.message}</p>
      </div>
    );
  }

  if (!isLoaded) {
    return <div className="loading-container">Loading Google Maps...</div>;
  }

  return (
    <div className="routes-container">
      <Sidebar />
      
      <div className="routes-main-content">
        <div className="routes-top-bar">
          <h2 className="routes-heading">Route Management</h2>
          
          <div className="routes-controls">
            <div className="form-group">
              <label>Click Mode</label>
              <select
                value={clickMode}
                onChange={(e) => setClickMode(e.target.value)}
              >
                <option value="origin">Set Origin</option>
                <option value="destination">Set Destination</option>
              </select>
            </div>

            <div className="form-group">
              <label>Route ID</label>
              <input
                type="text"
                placeholder="Enter Route ID"
                value={routeId}
                onChange={(e) => setRouteId(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Origin</label>
              <Autocomplete
                onLoad={autocomplete => originAutocompleteRef.current = autocomplete}
                onPlaceChanged={() => handlePlaceChanged(originAutocompleteRef, true)}
                options={{
                  bounds: TALISAY_BOUNDARY,
                  strictBounds: true,
                  types: ['address'],
                  componentRestrictions: { country: 'ph' }
                }}
              >
                <input
                  placeholder="Enter origin address"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                />
              </Autocomplete>
            </div>

            <div className="form-group">
              <label>Destination</label>
              <Autocomplete
                onLoad={autocomplete => destinationAutocompleteRef.current = autocomplete}
                onPlaceChanged={() => handlePlaceChanged(destinationAutocompleteRef, false)}
                options={{
                  bounds: TALISAY_BOUNDARY,
                  strictBounds: true,
                  types: ['address'],
                  componentRestrictions: { country: 'ph' }
                }}
              >
                <input
                  placeholder="Enter destination address"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </Autocomplete>
            </div>

            <button 
              className="generate-route-btn"
              onClick={generateRoute}
              disabled={loading}
            >
              {loading ? 'Generating...' : 'Generate Route'}
            </button>

            <button 
              className="toggle-routes-btn"
              onClick={() => setShowSavedRoutes(!showSavedRoutes)}
            >
              {showSavedRoutes ? 'Hide Routes' : 'Show Routes'}
            </button>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="routes-map-container">
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={center}
            zoom={12}
            onLoad={map => {
              setMap(map);
              mapRef.current = map;
              const bounds = new window.google.maps.LatLngBounds(
                new window.google.maps.LatLng(TALISAY_BOUNDARY.south, TALISAY_BOUNDARY.west),
                new window.google.maps.LatLng(TALISAY_BOUNDARY.north, TALISAY_BOUNDARY.east)
              );
              map.fitBounds(bounds);
            }}
            onClick={handleMapClick}
            options={{
              streetViewControl: false,
              mapTypeControl: true,
              fullscreenControl: true,
              restriction: {
                latLngBounds: TALISAY_BOUNDARY,
                strictBounds: true,
              },
            }}
          >
            {originMarker && <Marker position={originMarker} label="O" />}
            {destinationMarker && <Marker position={destinationMarker} label="D" />}
            {directions && <DirectionsRenderer directions={directions} />}
          </GoogleMap>
        </div>

        {modalOpen && (
          <div className="route-modal">
            <div className="modal-content">
              <h3>Save Route</h3>
              <div className="modal-body">
                <div className="route-info">
                  <p><strong>Route ID:</strong> {routeId || 'Not specified'}</p>
                  <p><strong>Origin:</strong> {origin}</p>
                  <p><strong>Destination:</strong> {destination}</p>
                  <p><strong>Distance:</strong> {distance}</p>
                  <p><strong>Duration:</strong> {duration}</p>
                </div>
                {error && <div className="modal-error">{error}</div>}
              </div>
              <div className="modal-actions">
                <button 
                  className="cancel-btn"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  className="save-btn"
                  onClick={saveRoute}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Route'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showSavedRoutes && (
          <div className="saved-routes-panel">
            <div className="panel-header">
              <h3>Saved Routes</h3>
              <button 
                className="close-panel-btn"
                onClick={() => setShowSavedRoutes(false)}
              >
                &times;
              </button>
            </div>
            <div className="routes-list">
              {savedRoutes.length === 0 ? (
                <div className="no-routes">No saved routes found</div>
              ) : (
                savedRoutes.map(route => (
                  <div key={route.id} className="route-item">
                    <div className="route-info">
                      <h4>{route.routeId}</h4>
                      <p>{route.origin} → {route.destination}</p>
                      <p>Distance: {route.distance} | Duration: {route.duration}</p>
                    </div>
                    <div className="route-actions">
                      <button 
                        className="edit-btn"
                        onClick={() => editRoute(route)}
                      >
                        Edit
                      </button>
                      <button 
                        className="delete-btn"
                        onClick={() => deleteRoute(route.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}