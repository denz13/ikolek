// DSS.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import { GOOGLE_MAPS_LOADER_OPTIONS } from "../utils/googleMapsLoaderOptions";
import {
  GoogleMap,
  Polygon,
  HeatmapLayerF,
  useJsApiLoader,
} from "@react-google-maps/api";
import "./DSS.css";

/** Optional Firestore (auto-fallback to sample data) */
let db, collection, onSnapshot, query, where, orderBy, limit;
try {
  // eslint-disable-next-line no-undef
  ({ db } = require("../firebase/firebase"));
  // eslint-disable-next-line no-unused-vars
  ({ collection, onSnapshot, query, where, orderBy, limit } =
    // eslint-disable-next-line no-undef
    require("firebase/firestore"));
// eslint-disable-next-line no-unused-vars
} catch (_e) { /* empty */ }

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
  const [loadingDb, setLoadingDb] = useState(!!db);

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
    if (!db) {
      setLoadingDb(false);
      return;
    }
    const unsubs = [];
    unsubs.push(
      onSnapshot(collection(db, "collectors"), (snap) =>
        setCollectors(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      )
    );
    unsubs.push(
      onSnapshot(collection(db, "trucks"), (snap) =>
        setTrucks(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      )
    );
    unsubs.push(
      onSnapshot(
        query(
          collection(db, "reports"),
          orderBy("createdAt", "desc"),
          limit ? limit(200) : undefined
        ),
        (snap) => setReports(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      )
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

  const reportsByZone = useMemo(() => {
    const counts = {};
    if (zones.length) zones.forEach((z) => (counts[z.name] = 0));
    reports.forEach((r) => {
      const key = zoneIndex.get(r.zoneId) || r.zoneName || r.zone || "Unknown";
      counts[key] = (counts[key] || 0) + 1;
    });
    if (!Object.keys(counts).length && zones.length) {
      zones.forEach((z, i) => (counts[z.name] = Math.max(1, i % 7)));
    }
    return counts;
  }, [reports, zones, zoneIndex]);

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
    Object.entries(reportsByZone).forEach(([zoneName, count]) => {
      const trucksNeeded = Math.max(1, Math.ceil(count / TRUCK_CAPACITY_REPORTS_PER_DAY));
      out.push({
        zoneName,
        reports: count,
        trucksNeeded,
        priority: count >= HIGH_PRIORITY_THRESHOLD ? "High" : "Normal",
      });
    });
    return out.sort((a, b) => b.reports - a.reports);
  }, [reportsByZone]);

  const heatPoints = useMemo(() => {
    if (!isLoaded || !window.google) return [];
    const pts = reports
      .filter((r) => r.lat && r.lng)
      .map((r) => new window.google.maps.LatLng(r.lat, r.lng));
    if (pts.length) return pts;
    return [
      new window.google.maps.LatLng(10.736, 123.01),
      new window.google.maps.LatLng(10.739, 123.015),
      new window.google.maps.LatLng(10.732, 123.012),
    ];
  }, [isLoaded, reports]);

  const kpi = {
    totalZones: zones.length || Object.keys(reportsByZone).length || 0,
    activeCollectors,
    avgReportsPerDay,
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
              <div className="kpi-label">Avg Reports / Day</div>
              <div className="kpi-value">{kpi.avgReportsPerDay}</div>
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
                <h3>Waste Hotspot Heatmap</h3>
                <span className="hint">GPS + complaints density</span>
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
                    <HeatmapLayerF
                      data={heatPoints}
                      options={{
                        radius: 60,
                        opacity: 0.7,
                        gradient: [
                          "rgba(0, 255, 255, 0)",
                          "rgba(0, 255, 0, 1)",
                          "rgba(255, 255, 0, 1)",
                          "rgba(255, 0, 0, 1)",
                        ],
                      }}
                    />
                  </GoogleMap>
                </div>
              )}
            </section>

            {/* Reports by Zone */}
            <section className="card">
              <div className="card-head">
                <h3>Reports by Zone</h3>
                <span className="hint">Daily aggregation</span>
              </div>
              <div className="card-body">
                <BarChart
                  data={reportsByZone}
                  max={Math.max(1, ...Object.values(reportsByZone))}
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
                    <div>Reports</div>
                    <div>Priority</div>
                    <div>Recommended Trucks</div>
                  </div>
                  {truckRecs.map((r) => (
                    <div
                      className={`tr ${r.priority === "High" ? "row-high" : ""}`}
                      key={r.zoneName}
                    >
                      <div>{r.zoneName}</div>
                      <div>{r.reports}</div>
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
