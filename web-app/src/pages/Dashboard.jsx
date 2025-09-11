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
import { FaCheckCircle, FaCircle } from "react-icons/fa";
import { FaRotate } from "react-icons/fa6";
import { IoIosCloseCircle } from "react-icons/io";
import "./Dashboard.css";

/** ── CONFIG ─────────────────────────────────────────────────────────── */
const CITY_OUTLINE_COLOR = "#2d6a4f"; // city outline (green)
const HIGHLIGHT_COLOR = "#E53935";    // search highlight (red)
const CITY_GEOJSON_URL = "/geo/talisay_boundary.geojson";
const ZONES_GEOJSON_URL = "/geo/talisay_zones.geojson"; // <-- MISSING BEFORE

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
  const [ongoingCollections, setOngoingCollections] = useState([]);
  const [completedCollections, setCompletedCollections] = useState([]);
  const [missedCollections, setMissedCollections] = useState([]);

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
        const res = await fetch(ZONES_GEOJSON_URL, { cache: "no-store" }); // <-- fixed
        if (!res.ok) return; // zones are optional
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
      } catch (err) {
        console.warn("Zones GeoJSON not found or invalid.", err);
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
    collectors.find((x) => x.assignedTruck === truckId)?.collectorId || "Unassigned";

  const onlineTruckCount = useMemo(
    () =>
      new Set(
        collectors.filter((c) => c.isOnline && c.assignedTruck).map((c) => c.assignedTruck)
      ).size,
    [collectors]
  );

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

        setSearchQuery(place.name || place.formatted_address || "");
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
                  <input
                    value={searchQuery}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSearchQuery(v);
                      // zone match first (instant)
                      if (tryHighlightZoneByName(v)) {
                        setPredictions([]);
                        setIsPredOpen(false);
                        return;
                      }
                      // otherwise, show Places predictions (within city bounds)
                      fetchPredictions(v.trim());
                    }}
                    onFocus={() => { if (predictions.length) setIsPredOpen(true); }}
                    placeholder="Search zone or place (within Talisay)"
                    className="map-search-input"
                  />

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
                    restriction: cityBounds
                      ? { latLngBounds: cityBounds, strictBounds: true }
                      : undefined,
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
          </div>

          {/* ── Collection Summary ───────────────────────────────────── */}
          <div className="section">
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
          </div>

          {/* ── Truck Details ────────────────────────────────────────── */}
          <div className="section">
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
          </div>

          {/* ── Alerts ──────────────────────────────────────────────── */}
          <div className="section">
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardScreen;
