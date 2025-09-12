// DSS.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import { GOOGLE_MAPS_LOADER_OPTIONS } from "../utils/googleMapsLoaderOptions";
import {
  GoogleMap,
  Polygon,
  HeatmapLayer,
  InfoWindow,
  Marker,
  useJsApiLoader,
} from "@react-google-maps/api";
import "./DSS.css";

/** Firestore imports */
import { db } from "../firebase/firebase";
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit 
} from "firebase/firestore";

/** Config */
const CITY_OUTLINE_COLOR = "#2d6a4f";
const CITY_GEOJSON_URL = "/geo/talisay_boundary.geojson";
const ZONES_GEOJSON_URL = "/geo/talisay_zones.geojson";
const TRUCK_CAPACITY_REPORTS_PER_DAY = 30;
const HIGH_PRIORITY_THRESHOLD = 5;

/** SVG Bar Chart */
function BarChart({ data, max, height = 160, barGap = 10 }) {
  const keys = Object.keys(data);
  const barWidth = Math.max(12, Math.floor(600 / Math.max(1, keys.length)) - barGap);
  const svgWidth = keys.length * (barWidth + barGap) + barGap;

  return (
    <svg className="dss-barchart" width={svgWidth} height={height} viewBox={`0 0 ${svgWidth} ${height}`}>
      <line x1="0" y1={height - 24} x2={svgWidth} y2={height - 24} stroke="#e5e7eb" strokeWidth="1" />
      {keys.map((k, idx) => {
        const val = data[k] || 0;
        const h = max ? Math.round((val / max) * (height - 40)) : 0;
        const x = barGap + idx * (barWidth + barGap);
        const y = (height - 24) - h;
        return (
          <g key={k}>
            <rect x={x} y={y} width={barWidth} height={h} rx="6" />
            <text x={x + barWidth / 2} y={height - 8} textAnchor="middle" className="axis">{k}</text>
            <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" className="val">{val}</text>
          </g>
        );
      })}
    </svg>
  );
}

const DssScreen = () => {
  const mapRef = useRef(null);

  const [cityPolygons, setCityPolygons] = useState([]);
  const [cityBounds, setCityBounds] = useState(null);
  const [cityCenter, setCityCenter] = useState({ lat: 10.736, lng: 123.01 });

  const [zones, setZones] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [reports, setReports] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loadingDb, setLoadingDb] = useState(!!db);
  const [activeInfoWindow, setActiveInfoWindow] = useState(null);

  const { isLoaded, loadError } = useJsApiLoader(GOOGLE_MAPS_LOADER_OPTIONS);

  /** GeoJSON helpers */
  const toLatLng = (lngLat) =>
    new window.google.maps.LatLng(lngLat[1], lngLat[0]);

  const featureToPolygons = (feature) => {
    const geom = feature?.geometry;
    if (!geom) return [];
    if (geom.type === "Polygon") {
      return [geom.coordinates.map((ring) => ring.map(toLatLng))];
    }
    if (geom.type === "MultiPolygon") {
      return geom.coordinates.map((poly) =>
        poly.map((ring) => ring.map(toLatLng))
      );
    }
    return [];
  };

  const computeBoundsFromPolygons = (polygons) => {
    const b = new window.google.maps.LatLngBounds();
    polygons.forEach((poly) => (poly[0] || []).forEach((pt) => b.extend(pt)));
    return b;
  };

  /** Load city & zones */
  useEffect(() => {
    if (!isLoaded || !window.google) return;

    (async () => {
      try {
        const res = await fetch(CITY_GEOJSON_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`City GeoJSON ${res.status}`);
        const gj = await res.json();
        const f = Array.isArray(gj?.features) ? gj.features[0] : null;
        if (f) {
          const polygons = featureToPolygons(f);
          setCityPolygons(polygons);
          const b = computeBoundsFromPolygons(polygons);
          setCityBounds(b);
          setCityCenter(b.getCenter().toJSON());
        }
      } catch (err) {
        console.error("City GeoJSON load failed:", err);
      }

      try {
        const res = await fetch(ZONES_GEOJSON_URL, { cache: "no-store" });
        if (!res.ok) return;
        const gj = await res.json();
        const z = (gj.features || []).map((f, idx) => {
          const name =
            f.properties?.name ||
            f.properties?.NAME ||
            f.properties?.zone ||
            f.properties?.Zone ||
            `Zone ${idx + 1}`;
          const id = f.properties?.id || String(idx + 1);
          const polygons = featureToPolygons(f);
          return { id, name: String(name), polygons };
        });
        setZones(z);
      } catch (err) {
        console.warn("Zones GeoJSON not found or invalid.", err);
      }
    })();
  }, [isLoaded]);

  /** Firestore feeds */
  useEffect(() => {
    console.log('🔍 Firestore connection check:', { db: !!db, onSnapshot: !!onSnapshot });
    
    if (!db) {
      console.log('❌ No Firestore database connection');
      setLoadingDb(false);
      return;
    }
    
    // Debug: List all available collections (this is just for debugging)
    console.log('🔍 Attempting to connect to Firestore collections...');
    
    const unsubs = [];
    
    // Collectors
    unsubs.push(
      onSnapshot(collection(db, "collectors"), (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        console.log('👥 Collectors loaded:', data.length);
        setCollectors(data);
      })
    );
    
    // Trucks
    unsubs.push(
      onSnapshot(collection(db, "trucks"), (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        console.log('🚛 Trucks loaded:', data.length);
        setTrucks(data);
      })
    );
    
    // Reports
    unsubs.push(
      onSnapshot(
        query(
          collection(db, "reports"),
          orderBy("createdAt", "desc"),
          limit ? limit(200) : undefined
        ),
        (snap) => {
          const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          console.log('📋 Reports loaded:', data.length);
          setReports(data);
        }
      )
    );
    
    // Collections - Main collection data from mobile app
    unsubs.push(
      onSnapshot(collection(db, "collections"), (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        console.log('🗑️ Collections loaded:', data.length);
        if (data.length > 0) {
          console.log('🗑️ Sample collection:', data[0]);
        }
        setCollections(data);
      })
    );
    
    setLoadingDb(false);
    return () => unsubs.forEach((u) => u && u());
  }, []);

  /** Derived metrics */
  const zoneIndex = useMemo(() => {
    const idx = new Map();
    zones.forEach((z) => idx.set(z.id ?? z.name, z.name));
    return idx;
  }, [zones]);

  const collectionsByZone = useMemo(() => {
    const counts = {};
    const weightsByZone = {};
    
    if (zones.length) {
      zones.forEach((z) => {
        counts[z.name] = 0;
        weightsByZone[z.name] = 0;
      });
    }
    
    // Count collections and total weight by zone using exact structure from Schedules.js
    collections.forEach((c) => {
      // Only count completed collections (status: 'collected')
      if (c.status === 'collected') {
        const zoneName = c.zone || "Unknown";
        const weight = c.weightKg || 0;
        
        counts[zoneName] = (counts[zoneName] || 0) + 1;
        weightsByZone[zoneName] = (weightsByZone[zoneName] || 0) + weight;
      }
    });
    
    // If no collections data, use sample data for demonstration
    if (!Object.keys(counts).length && zones.length) {
      console.log('📊 No collections data found, using sample data for demonstration');
      zones.forEach((z, i) => {
        counts[z.name] = Math.max(1, i % 7);
        weightsByZone[z.name] = Math.max(50, (i % 7) * 100);
      });
    }
    
    // If no zones data either, create some sample zones
    if (!Object.keys(counts).length) {
      console.log('📊 No zones data found, creating sample data');
      const sampleZones = ['Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 5'];
      sampleZones.forEach((zone, i) => {
        counts[zone] = Math.max(1, i % 7);
        weightsByZone[zone] = Math.max(50, (i % 7) * 100);
      });
    }
    
    console.log('📊 Collections by zone:', counts);
    console.log('⚖️ Total weight by zone:', weightsByZone);
    console.log('📊 Sample collection data:', collections.slice(0, 3));
    console.log('📊 Completed collections count:', collections.filter(c => c.status === 'collected').length);
    console.log('📊 All collections count:', collections.length);
    return counts;
  }, [collections, zones]);

  const pendingComplaints = useMemo(
    () =>
      reports
        .filter(
          (r) =>
            r.type === "complaint" ||
            r.category === "complaint" ||
            r.status === "pending"
        )
        .slice(0, 8),
    [reports]
  );

  const activeCollectors = useMemo(
    () => collectors.filter((c) => c.status === "online" || c.online === true).length,
    [collectors]
  );

  const avgReportsPerDay = useMemo(() => {
    if (!reports.length) return 0;
    const byDay = new Map();
    reports.forEach((r) => {
      const d = (r.createdAt?.toDate?.() ?? r.createdAt ?? new Date())
        .toISOString()
        .slice(0, 10);
      byDay.set(d, (byDay.get(d) || 0) + 1);
    });
    const sum = [...byDay.values()].reduce((a, b) => a + b, 0);
    return Math.round(sum / byDay.size);
  }, [reports]);

  const trucksOnline = useMemo(
    () => trucks.filter((t) => t.status === "online" || t.online === true).length,
    [trucks]
  );

  const truckRecs = useMemo(() => {
    const out = [];
    Object.entries(collectionsByZone).forEach(([zoneName, count]) => {
      const trucksNeeded = Math.max(1, Math.ceil(count / TRUCK_CAPACITY_REPORTS_PER_DAY));
      out.push({
        zoneName,
        collections: count,
        trucksNeeded,
        priority: count >= HIGH_PRIORITY_THRESHOLD ? "High" : "Normal",
      });
    });
    return out.sort((a, b) => b.collections - a.collections);
  }, [collectionsByZone]);

  // Calculate collection levels and create heatmap data based on actual collection locations
  const collectionHeatData = useMemo(() => {
    if (!isLoaded || !window.google) return [];
    
    console.log('🎨 Creating heatmap from actual collection data...');
    console.log('📊 Total collections:', collections.length);
    console.log('📊 Collections by zone:', collectionsByZone);
    
    const heatData = [];
    
    // Only create heat points for zones that have actual collections (count > 0)
    Object.entries(collectionsByZone).forEach(([zoneName, count]) => {
      if (count === 0) {
        console.log(`⏭️ Skipping ${zoneName} - no collections`);
        return; // Skip zones with no collections
      }
      
      console.log(`🔥 Processing ${zoneName} with ${count} collections`);
      
      let position = null;
      
      // Try to get position from zones GeoJSON first
      const zone = zones.find(z => z.name === zoneName);
      if (zone && zone.polygons && zone.polygons.length > 0) {
        // Get center point of zone polygon
        const bounds = new window.google.maps.LatLngBounds();
        zone.polygons[0][0].forEach(point => bounds.extend(point));
        position = bounds.getCenter();
        console.log(`🗺️ Using GeoJSON coordinates for ${zoneName}:`, position);
      } else {
        // Generate dynamic coordinates based on zone number
        const zoneNumber = parseInt(zoneName.replace('Zone ', ''));
        if (isNaN(zoneNumber)) {
          console.log(`❌ Invalid zone name format: ${zoneName}, skipping`);
          return;
        }
        
        // Generate coordinates in a grid pattern around Talisay City center
        const baseLat = 10.736;
        const baseLng = 123.010;
        const latOffset = (zoneNumber % 4) * 0.01; // 4 zones per row
        const lngOffset = Math.floor(zoneNumber / 4) * 0.01; // Rows of zones
        
        position = {
          lat: baseLat + latOffset,
          lng: baseLng + lngOffset
        };
        
        console.log(`🗺️ Generated coordinates for ${zoneName}:`, position);
      }
      
      if (position) {
        // Create exactly ONE heat point per zone (same intensity for all zones with collections)
        // Collection details will be shown in InfoWindow when clicked
        heatData.push({
          location: new window.google.maps.LatLng(position.lat, position.lng),
          weight: 1.0 // Same intensity for all zones with collections
        });
        
        console.log(`🗺️ Zone ${zoneName}: ${count} collections, heat spot: 1 (details in InfoWindow)`);
      }
    });
    
    console.log('🗺️ Total heat points created:', heatData.length);
    console.log('🗺️ Heat data sample:', heatData.slice(0, 3));
    return heatData;
  }, [isLoaded, collectionsByZone, zones, collections]);

  // Create clickable zone data for InfoWindows (only zones with collections)
  const zoneInfoData = useMemo(() => {
    const zoneData = [];
    
    Object.entries(collectionsByZone).forEach(([zoneName, count]) => {
      // Only include zones that have actual collections
      if (count === 0) {
        console.log(`⏭️ Skipping InfoWindow for ${zoneName} - no collections`);
        return;
      }
      
      console.log(`📋 Creating InfoWindow for ${zoneName} with ${count} collections`);
      
      let position = null;
      
      // Try to get position from zones GeoJSON first
      const zone = zones.find(z => z.name === zoneName);
      if (zone && zone.polygons && zone.polygons.length > 0) {
        // Get center point of zone polygon
        const bounds = new window.google.maps.LatLngBounds();
        zone.polygons[0][0].forEach(point => bounds.extend(point));
        position = bounds.getCenter();
        console.log(`🗺️ Using GeoJSON coordinates for InfoWindow ${zoneName}:`, position);
      } else {
        // Generate dynamic coordinates based on zone number
        const zoneNumber = parseInt(zoneName.replace('Zone ', ''));
        if (isNaN(zoneNumber)) {
          console.log(`❌ Invalid zone name format for InfoWindow: ${zoneName}, skipping`);
          return;
        }
        
        // Generate coordinates in a grid pattern around Talisay City center
        const baseLat = 10.736;
        const baseLng = 123.010;
        const latOffset = (zoneNumber % 4) * 0.01; // 4 zones per row
        const lngOffset = Math.floor(zoneNumber / 4) * 0.01; // Rows of zones
        
        position = {
          lat: baseLat + latOffset,
          lng: baseLng + lngOffset
        };
        
        console.log(`🗺️ Generated coordinates for InfoWindow ${zoneName}:`, position);
      }
      
      if (position) {
        // Get zone-specific collection data
        const zoneCollections = collections.filter(c => c.zone === zoneName && c.status === 'collected');
        const totalWeight = zoneCollections.reduce((sum, c) => sum + (c.weightKg || 0), 0);
        const avgWeight = count > 0 ? (totalWeight / count).toFixed(1) : 0;
        
        zoneData.push({
          id: zoneName,
          position: position,
          zoneName: zoneName,
          collectionCount: count,
          totalWeight: totalWeight,
          avgWeight: avgWeight,
          collections: zoneCollections
        });
      }
    });
    
    console.log('📋 InfoWindow zones created:', zoneData.length);
    console.log('📋 InfoWindow zones:', zoneData.map(z => z.zoneName));
    return zoneData;
  }, [collectionsByZone, zones, collections]);

  const totalWeightCollected = useMemo(() => {
    return collections
      .filter(c => c.status === 'collected')
      .reduce((total, c) => total + (c.weightKg || 0), 0);
  }, [collections]);

  const kpi = {
    totalZones: zones.length || Object.keys(collectionsByZone).length || 0,
    activeCollectors,
    totalCollections: collections.filter(c => c.status === 'collected').length,
    totalWeightCollected,
    pendingComplaints: pendingComplaints.length,
  };

  if (loadError) return <div>Map failed to load.</div>;

  return (
    <div className="dss">
      <Sidebar />

      <div className="dss-main">
        <div className="dss-header">
          <h1 className="dss-title">Decision Support</h1>
        </div>

        {/* Scrollable content wrapper */}
        <div className="dss-content">
          {/* KPIs */}
          <div className="dss-kpis">
            <div className="kpi">
              <div className="kpi-label">Total Zones</div>
              <div className="kpi-value">{kpi.totalZones}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Active Collectors</div>
              <div className="kpi-value">{kpi.activeCollectors}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Total Collections</div>
              <div className="kpi-value">
                {loadingDb ? "Loading..." : kpi.totalCollections}
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Total Weight (kg)</div>
              <div className="kpi-value">
                {loadingDb ? "Loading..." : kpi.totalWeightCollected.toLocaleString()}
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Pending Complaints</div>
              <div className="kpi-value">{kpi.pendingComplaints}</div>
            </div>
          </div>

          <div className="dss-grid">
            {/* MAP */}
            <section className="card dss-map">
              <div className="card-head">
                <h3>Collection Activity Map</h3>
                <span className="hint">🟢 Low | 🟡 Medium | 🔴 High Collection</span>
              </div>
              {!isLoaded ? (
                <div className="card-body">
                  <p>Loading map…</p>
                </div>
              ) : (
                <div className="dss-map-wrap">
                  <GoogleMap
                    mapContainerClassName="dss-map-canvas"
                    center={cityCenter}
                    zoom={12}
                    onLoad={(map) => (mapRef.current = map)}
                    onUnmount={() => (mapRef.current = null)}
                    options={{
                      restriction: cityBounds
                        ? { latLngBounds: cityBounds, strictBounds: true }
                        : undefined,
                      minZoom: 11,
                      maxZoom: 16,
                      streetViewControl: false,
                      fullscreenControl: true,
                      zoomControl: true,
                      gestureHandling: "greedy",
                    }}
                  >
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
                    {/* Collection Activity Heatmap */}
                    <HeatmapLayer
                      data={collectionHeatData}
                      options={{
                        radius: 100,
                        opacity: 0.8,
                        gradient: [
                          "rgba(0, 255, 0, 0)",      // Transparent
                          "rgba(0, 255, 0, 0.6)",    // Green - Low collection
                          "rgba(255, 255, 0, 0.8)",  // Yellow - Medium collection
                          "rgba(255, 0, 0, 1)",      // Red - High collection
                        ],
                      }}
                    />

                    {/* Invisible clickable markers for InfoWindows */}
                    {zoneInfoData.map((zone) => (
                      <Marker
                        key={zone.id}
                        position={zone.position}
                        icon={{
                          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                            <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
                              <circle cx="50" cy="50" r="50" fill="transparent" stroke="none"/>
                            </svg>
                          `),
                          scaledSize: new window.google.maps.Size(100, 100),
                          anchor: new window.google.maps.Point(50, 50),
                        }}
                        onClick={() => {
                          console.log('🗺️ Zone clicked:', zone.zoneName);
                          setActiveInfoWindow(zone.id);
                        }}
                      />
                    ))}

                    {/* InfoWindow for selected zone */}
                    {activeInfoWindow && (() => {
                      const selectedZone = zoneInfoData.find(z => z.id === activeInfoWindow);
                      if (!selectedZone) return null;
                      
                      return (
                        <InfoWindow
                          position={selectedZone.position}
                          onCloseClick={() => setActiveInfoWindow(null)}
                        >
                          <div style={{ padding: '10px', minWidth: '250px' }}>
                            <h3 style={{ margin: '0 0 10px 0', color: '#2d6a4f', fontSize: '16px' }}>
                              📍 {selectedZone.zoneName}
                            </h3>
                            
                            <div style={{ marginBottom: '8px' }}>
                              <strong>Collections:</strong> {selectedZone.collectionCount}
                            </div>
                            
                            <div style={{ marginBottom: '8px' }}>
                              <strong>Total Weight:</strong> {selectedZone.totalWeight} kg
                            </div>
                            
                            <div style={{ marginBottom: '8px' }}>
                              <strong>Average Weight:</strong> {selectedZone.avgWeight} kg
                            </div>
                            
                            {selectedZone.collections.length > 0 && (
                              <div>
                                <strong>Recent Collections:</strong>
                                <div style={{ maxHeight: '120px', overflowY: 'auto', marginTop: '5px' }}>
                                  {selectedZone.collections.slice(0, 3).map((collection, idx) => (
                                    <div key={idx} style={{ 
                                      fontSize: '12px', 
                                      padding: '3px 0', 
                                      borderBottom: '1px solid #eee' 
                                    }}>
                                      <div>📅 {collection.day} - {collection.time}</div>
                                      <div>⚖️ {collection.weightKg} kg</div>
                                      <div>👤 {collection.collectorId}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </InfoWindow>
                      );
                    })()}
                  </GoogleMap>
                </div>
              )}
            </section>

            {/* Collections by Zone */}
            <section className="card">
              <div className="card-head">
                <h3>Collections by Zone</h3>
                <span className="hint">Collection activity per zone</span>
              </div>
              <div className="card-body">
                <BarChart
                  data={collectionsByZone}
                  max={Math.max(1, ...Object.values(collectionsByZone))}
                />
              </div>
            </section>

            {/* Truck recommendations */}
            <section className="card">
              <div className="card-head">
                <h3>Suggested Trucks per Zone</h3>
                <span className="hint">
                  Capacity = {TRUCK_CAPACITY_REPORTS_PER_DAY}/day · High ≥{" "}
                  {HIGH_PRIORITY_THRESHOLD}
                </span>
              </div>
              <div className="card-body">
                <div className="table">
                  <div className="tr th">
                    <div>Zone</div>
                    <div>Collections</div>
                    <div>Priority</div>
                    <div>Recommended Trucks</div>
                  </div>
                  {truckRecs.map((r) => (
                    <div
                      className={`tr ${r.priority === "High" ? "row-high" : ""}`}
                      key={r.zoneName}
                    >
                      <div>{r.zoneName}</div>
                      <div>{r.collections}</div>
                      <div
                        className={`pill ${
                          r.priority === "High" ? "pill-red" : "pill-green"
                        }`}
                      >
                        {r.priority}
                      </div>
                      <div className="strong">{r.trucksNeeded}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Complaints log */}
            <section className="card">
              <div className="card-head">
                <h3>Complaints Log</h3>
              </div>
              <div className="card-body list">
                {pendingComplaints.length ? (
                  pendingComplaints.map((c) => (
                    <div key={c.id} className="row">
                      <div className="when">
                        {(
                          c.createdAt?.toDate?.() ??
                          c.createdAt ??
                          new Date()
                        ).toLocaleDateString()}
                      </div>
                      <div className="zone">
                        {zoneIndex.get(c.zoneId) || c.zoneName || "Unknown Zone"}
                      </div>
                      <div className="desc">
                        {c.details || c.title || "Complaint"}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="muted">
                    {loadingDb ? "Loading…" : "No pending complaints."}
                  </p>
                )}
              </div>
            </section>

            {/* Fleet snapshot */}
            <section className="card">
              <div className="card-head">
                <h3>Fleet Status</h3>
              </div>
              <div className="card-body fleet">
                <div className="fleet-item">
                  <span className="dot dot-green" /> Online <b>{trucksOnline}</b>
                </div>
                <div className="fleet-item">
                  <span className="dot dot-gray" /> Offline{" "}
                  <b>{Math.max(0, trucks.length - trucksOnline)}</b>
                </div>
                <div className="fleet-item">
                  <span className="dot dot-amber" /> Needs Maintenance{" "}
                  <b>{trucks.filter((t) => t.needsMaintenance === true).length}</b>
                </div>
              </div>
            </section>
          </div>

          <div className="dss-footer-note">
            <strong>Objective coverage:</strong> Web dashboard (1), GPS & heatmap
            (2), in-app feedback via complaints (3), DSS analytics & truck
            recommendations (4), fleet monitoring (5), zoning overlay & per-zone
            metrics (6).
          </div>
        </div>
      </div>
    </div>
  );
};

export default DssScreen;
