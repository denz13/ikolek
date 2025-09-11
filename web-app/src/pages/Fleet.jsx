import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  collection,
  setDoc,
  doc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import Sidebar from "../pages/Sidebar";
import { FaTruck, FaEdit, FaGasPump, FaRoad, FaFilter, FaWrench, FaFileAlt } from "react-icons/fa";
import { CiCircleList } from "react-icons/ci";
import { FaTrashCan } from "react-icons/fa6";
import "./Fleet.css";

/* ---------------- Standards & Normalizers ---------------- */
const TRUCK_ID_REGEX = /^[A-Z][A-Z0-9_-]{4,19}$/;  // total length 5–20
const normalizeTruckId = (v) => (v || "").toUpperCase().replace(/\s+/g, "");
const normalizePlate = (v) => (v || "").toUpperCase().trim();

/* ---------------- Helpers ---------------- */
const todayYMD = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

const addMonthsISO = (iso, months) => {
  if (!iso) return null;
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
};

const computeNextOilChange = (lastOilISO) => addMonthsISO(lastOilISO, 3);
const isOilDue = (nextOilISO) => nextOilISO && new Date(nextOilISO) <= new Date();

/* ---------------- Reusable Confirm Dialog ---------------- */
const useConfirm = () => {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState({ title: "", body: "", variant: "", onConfirm: null });
  const ask = (c) => { setConfig(c); setOpen(true); };
  const close = () => setOpen(false);
  const Dialog = () => !open ? null : (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="confirmTitle">
      <div className="modal">
        <div className="modal-header">
          <h3 id="confirmTitle" className="modal-title">{config.title || "Confirm"}</h3>
        </div>
        <div className="modal-body"><p>{config.body}</p></div>
        <div className="modal-buttons">
          <button className="cancel-btn" onClick={close}>Cancel</button>
          <button
            className={`confirm-btn ${config.variant || ""}`}
            onClick={() => { config.onConfirm?.(); close(); }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
  return { ask, Dialog, open, close };
};

const Fleet = () => {
  // ===== Core state =====
  const [truckId, setTruckId] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [capacityKg, setCapacityKg] = useState("");
  const [fuelType, setFuelType] = useState("Diesel");

  const [trucks, setTrucks] = useState([]);
  const [editingId, setEditingId] = useState(null);

  // ===== UI state =====
  const [successMessage, setSuccessMessage] = useState("");

  // dialogs / modals
  const deleteConfirm = useConfirm();
  const editConfirm = useConfirm();

  const [showFuelModal, setShowFuelModal] = useState(false);
  const [fuelLiters, setFuelLiters] = useState("");
  const [fuelCost, setFuelCost] = useState(""); // fixed tiny typo
  const [fuelNote, setFuelNote] = useState("");

  const [showTripModal, setShowTripModal] = useState(false);
  const [tripOrigin, setTripOrigin] = useState("");
  const [tripDestination, setTripDestination] = useState("");
  const [tripCargo, setTripCargo] = useState("");

  // NEW: Collection modal
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [collectZone, setCollectZone] = useState("");
  const [collectKg, setCollectKg] = useState("");

  // Collection Schedule Modal
  const [showCollectionScheduleModal, setShowCollectionScheduleModal] = useState(false);
  const [selectedTruckCollections, setSelectedTruckCollections] = useState([]);

  // Collector Reports Modal
  const [showCollectorReportsModal, setShowCollectorReportsModal] = useState(false);
  const [selectedTruckReports, setSelectedTruckReports] = useState([]);

  const [selectedTruckId, setSelectedTruckId] = useState(null);
  const [selectedTruckLabel, setSelectedTruckLabel] = useState("");

  // Collections data for checking submitted collections
  const [collections, setCollections] = useState([]);
  
  // Collector reports data
  const [collectorReports, setCollectorReports] = useState([]);

  // Filters / search
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Freeze body scroll when any modal is open
  useEffect(() => {
    const anyOpen =
      deleteConfirm.open ||
      editConfirm.open ||
      showFuelModal || showTripModal || showCollectModal || showCollectionScheduleModal || showCollectorReportsModal;
    document.body.style.overflow = anyOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [deleteConfirm.open, editConfirm.open, showFuelModal, showTripModal, showCollectModal, showCollectionScheduleModal, showCollectorReportsModal]);

  const humanStatus = (t) => {
    const s = t?.status || "inactive";
    if (s === "active") return "Active";
    if (s === "maintenance") return "Under Maintenance";
    if (s === "logged_out") return "Logged Out";
    if (s === "to_dump") return "To Dump Site";
    return "Inactive";
  };

  const statusClass = (t) => {
    const s = t?.status || "inactive";
    if (s === "active") return "badge success";
    if (s === "maintenance") return "badge warn";
    if (s === "logged_out") return "badge neutral";
    if (s === "to_dump") return "badge err";
    return "badge gray";
  };

  // Check if truck has submitted collections
  const hasSubmittedCollections = (truck) => {
    const truckCollectorId = truck.collectorId;
    return collections.some(collection => 
      collection.collectorId === truckCollectorId && collection.status === 'collected'
    );
  };

  // Check if truck has submitted reports
  const hasSubmittedReports = (truck) => {
    const truckCollectorId = truck.collectorId;
    return collectorReports.some(report => 
      report.collectorId === truckCollectorId
    );
  };

  // ===== Fetch (Realtime) =====
  const fetchTrucks = useCallback(() => {
    const qy = query(collection(db, "trucks"), orderBy("__name__"));
    const unsub = onSnapshot(qy, (snapshot) => {
      const list = snapshot.docs.map((d) => {
        const t = { id: d.id, ...d.data() };
        const last = t.lastOilChange || null;
        const next = t.nextOilChange || (last ? computeNextOilChange(last) : null);
        return { ...t, nextOilChange: next };
      });
      setTrucks(list);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = fetchTrucks();
    return () => unsub && unsub();
  }, [fetchTrucks]);

  // Fetch collections data
  useEffect(() => {
    const qy = query(collection(db, "collections"), orderBy("completedAt", "desc"));
    const unsub = onSnapshot(qy, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCollections(list);
    });
    return () => unsub && unsub();
  }, []);

  // Fetch collector reports data
  useEffect(() => {
    const qy = query(collection(db, "collector_reports"));
    const unsub = onSnapshot(qy, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCollectorReports(list);
    });
    return () => unsub && unsub();
  }, []);

  // ===== CRUD: Add / Update =====
  const clearForm = () => {
    setTruckId("");
    setPlateNumber("");
    setCapacityKg("");
    setFuelType("Diesel");
    setEditingId(null);
  };

  const validateTruckForm = () => {
    const normId = normalizeTruckId(truckId);
    if (!TRUCK_ID_REGEX.test(normId)) {
      alert("Truck ID must be 5–20 chars, start with a letter, and use A–Z, 0–9, '-' or '_'. Example: DMPTRCK_GAN-4734");
      return { ok: false };
    }
    const cap = capacityKg ? Number(capacityKg) : 0;
    return { ok: true, normId, cap, plate: normalizePlate(plateNumber) };
  };

  const baseNewTruckFields = () => ({
    status: "logged_out",
    fuelLogs: [],
    trips: [],
    // NEW fields for maintenance/collection:
    currentLoadKg: 0,
    needsDumping: false,
    dumpSiteName: "Garbage Dump Site",
    collectionHistory: [], // {zone, dateYMD, kg}
    lastOilChange: null,
    nextOilChange: null,
    assignedZone: "", // optional if you assign default zone
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });

  const handleAddOrUpdateTruck = async () => {
    const v = validateTruckForm();
    if (!v.ok) return;

    try {
      if (!editingId) {
        const exists = await getDoc(doc(db, "trucks", v.normId));
        if (exists.exists()) {
          alert("❌ Truck ID already exists.");
          return;
        }
      }

      if (editingId && editingId !== v.normId) {
        editConfirm.ask({
          title: "Rename Truck ID?",
          body: `Change ID from ${editingId} to ${v.normId}? This will move all current data under the new ID.`,
          variant: "warning",
          onConfirm: async () => {
            const prev = trucks.find((t) => t.id === editingId) || {};
            await deleteDoc(doc(db, "trucks", editingId));
            await setDoc(doc(db, "trucks", v.normId), {
              ...baseNewTruckFields(),
              ...prev,
              truckId: v.normId,
              plateNumber: v.plate || prev.plateNumber || "",
              capacityKg: v.cap || prev.capacityKg || 0,
              fuelType: fuelType || prev.fuelType || "Diesel",
              updatedAt: serverTimestamp(),
              createdAt: prev.createdAt || serverTimestamp(),
            });
            setSuccessMessage("✅ Truck updated successfully!");
            clearForm();
            setTimeout(() => setSuccessMessage(""), 2000);
          }
        });
        return;
      }

      const existing = trucks.find((t) => t.id === v.normId);
      await setDoc(
        doc(db, "trucks", v.normId),
        {
          ...(!existing ? baseNewTruckFields() : {}),
          truckId: v.normId,
          plateNumber: v.plate || existing?.plateNumber || "",
          capacityKg: v.cap || existing?.capacityKg || 0,
          fuelType: fuelType || existing?.fuelType || "Diesel",
          status: existing?.status || "logged_out",
          fuelLogs: existing?.fuelLogs || [],
          trips: existing?.trips || [],
          currentLoadKg: existing?.currentLoadKg ?? 0,
          needsDumping: existing?.needsDumping ?? false,
          dumpSiteName: existing?.dumpSiteName || "Garbage Dump Site",
          collectionHistory: existing?.collectionHistory || [],
          lastOilChange: existing?.lastOilChange || null,
          nextOilChange: existing?.nextOilChange || null,
          assignedZone: existing?.assignedZone || "",
          updatedAt: serverTimestamp(),
          createdAt: existing?.createdAt || serverTimestamp(),
        },
        { merge: true }
      );

      setSuccessMessage(existing ? "✅ Truck updated successfully!" : "✅ Truck successfully added!");
      clearForm();
      setTimeout(() => setSuccessMessage(""), 2000);
    } catch (error) {
      console.error(error);
      alert("Something went wrong.");
    }
  };

  // ===== Delete =====
  const openDeleteModal = (truck) => {
    deleteConfirm.ask({
      title: "Delete Truck",
      body: `Delete truck: ${truck.truckId || truck.id}? This cannot be undone.`,
      variant: "danger",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "trucks", truck.id));
          setSuccessMessage("✅ Truck deleted successfully!");
          setTimeout(() => setSuccessMessage(""), 2000);
        } catch (e) {
          console.error(e);
        }
      }
    });
  };

  // ===== Edit (prefill via confirm) =====
  const openEditModal = (truck) => {
    editConfirm.ask({
      title: "Edit Truck",
      body: `Edit: ${truck.truckId || truck.id}?`,
      onConfirm: () => {
        const t = trucks.find((x) => x.id === truck.id);
        if (t) {
          setTruckId(t.truckId || t.id);
          setPlateNumber(t.plateNumber || "");
          setCapacityKg(t.capacityKg ? String(t.capacityKg) : "");
          setFuelType(t.fuelType || "Diesel");
          setEditingId(t.id);
        }
      }
    });
  };

  // ===== Fuel log =====
  const openFuelModal = (truck) => {
    setSelectedTruckId(truck.id);
    setSelectedTruckLabel(truck.truckId || truck.id);
    setFuelLiters("");
    setFuelCost("");
    setFuelNote("");
    setShowFuelModal(true);
  };

  const saveFuel = async () => {
    if (!fuelLiters) {
      alert("Enter liters");
      return;
    }
    try {
      const t = trucks.find((x) => x.id === selectedTruckId);
      await updateDoc(doc(db, "trucks", selectedTruckId), {
        fuelLogs: [
          ...(t?.fuelLogs || []),
          {
            liters: Number(fuelLiters),
            cost: fuelCost ? Number(fuelCost) : 0,
            note: (fuelNote || "").trim(),
            date: new Date().toISOString(),
          },
        ],
        updatedAt: serverTimestamp(),
      });
      setShowFuelModal(false);
      setSuccessMessage("⛽ Fuel entry logged.");
      setTimeout(() => setSuccessMessage(""), 2000);
    } catch (e) {
      console.error(e);
      alert("Could not save fuel log.");
    }
  };

  // ===== Generic Trip =====
  const openTripModal = (truck) => {
    setSelectedTruckId(truck.id);
    setSelectedTruckLabel(truck.truckId || truck.id);
    setTripOrigin("");
    setTripDestination("");
    setTripCargo("");
    setShowTripModal(true);
  };

  const saveTrip = async () => {
    if (!tripOrigin.trim() || !tripDestination.trim()) {
      alert("Enter origin and destination");
      return;
    }
    try {
      const t = trucks.find((x) => x.id === selectedTruckId);
      await updateDoc(doc(db, "trucks", selectedTruckId), {
        trips: [
          ...(t?.trips || []),
          {
            origin: tripOrigin.trim(),
            destination: tripDestination.trim(),
            cargo: (tripCargo || "").trim(),
            date: new Date().toISOString(),
          },
        ],
        status: "active",
        updatedAt: serverTimestamp(),
      });
      setShowTripModal(false);
      setSuccessMessage("🛣️ Trip recorded.");
      setTimeout(() => setSuccessMessage(""), 2000);
    } catch (e) {
      console.error(e);
      alert("Could not save trip.");
    }
  };

  // ===== Collection (once a day per zone) =====
  const openCollectModal = (truck) => {
    setSelectedTruckId(truck.id);
    setSelectedTruckLabel(truck.truckId || truck.id);
    setCollectZone(truck.assignedZone || ""); // prefill if any
    setCollectKg("");
    setShowCollectModal(true);
  };

  // ===== Collection Schedule Modal =====
  const openCollectScheduleModal = (truck) => {
    console.log('View collection schedule for truck:', truck.id);
    
    // Get collections for this truck's collectorId
    const truckCollections = collections.filter(collection => 
      collection.collectorId === truck.collectorId && collection.status === 'collected'
    );
    
    // Sort by completedAt date (newest first)
    truckCollections.sort((a, b) => {
      const dateA = a.completedAt?.toDate ? a.completedAt.toDate() : new Date(a.completedAt);
      const dateB = b.completedAt?.toDate ? b.completedAt.toDate() : new Date(b.completedAt);
      return dateB - dateA;
    });
    
    setSelectedTruckCollections(truckCollections);
    setSelectedTruckLabel(truck.truckId || truck.id);
    setShowCollectionScheduleModal(true);
  };

  // ===== Collector Reports Modal =====
  const openCollectorReportsModal = (truck) => {
    console.log('View collector reports for truck:', truck.id);
    
    // Get reports for this truck's collectorId
    const truckReports = collectorReports.filter(report => 
      report.collectorId === truck.collectorId
    );
    
    // Sort by createdAt date (newest first)
    truckReports.sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dateB - dateA;
    });
    
    setSelectedTruckReports(truckReports);
    setSelectedTruckLabel(truck.truckId || truck.id);
    setShowCollectorReportsModal(true);
  };

  // ===== Approve/Decline Report Functions =====
  const approveReport = async (reportId) => {
    try {
      await updateDoc(doc(db, "collector_reports", reportId), {
        status: "approved",
        updatedAt: serverTimestamp(),
      });
      setSuccessMessage("✅ Report approved successfully!");
      setTimeout(() => setSuccessMessage(""), 2000);
    } catch (error) {
      console.error("Error approving report:", error);
      alert("Could not approve report.");
    }
  };

  const declineReport = async (reportId) => {
    try {
      await updateDoc(doc(db, "collector_reports", reportId), {
        status: "rejected",
        updatedAt: serverTimestamp(),
      });
      setSuccessMessage("❌ Report declined successfully!");
      setTimeout(() => setSuccessMessage(""), 2000);
    } catch (error) {
      console.error("Error declining report:", error);
      alert("Could not decline report.");
    }
  };

  const saveCollection = async () => {
    const zone = (collectZone || "").trim();
    const kg = Number(collectKg || 0);
    if (!zone) { alert("Enter zone"); return; }
    if (!kg || kg <= 0) { alert("Enter collected weight in kg"); return; }

    try {
      const t = trucks.find((x) => x.id === selectedTruckId) || {};
      const history = t.collectionHistory || [];
      const today = todayYMD();

      // Block duplicate collection for the same zone today
      const already = history.some((h) => h.zone?.toLowerCase() === zone.toLowerCase() && h.dateYMD === today);
      if (already) {
        alert(`Collection for zone "${zone}" already recorded for ${today}.`);
        return;
      }

      const newLoad = (t.currentLoadKg || 0) + kg;
      const atOrOverCap = t.capacityKg ? newLoad >= Number(t.capacityKg) : false;

      const updates = {
        collectionHistory: [
          ...history,
          { zone, dateYMD: today, kg }
        ],
        currentLoadKg: newLoad,
        needsDumping: atOrOverCap ? true : (t.needsDumping || false),
        status: atOrOverCap ? "to_dump" : (t.status || "active"),
        updatedAt: serverTimestamp(),
        trips: [
          ...(t.trips || []),
          {
            origin: zone,
            destination: atOrOverCap ? (t.dumpSiteName || "Garbage Dump Site") : zone,
            cargo: `Collection: ${kg} kg`,
            date: new Date().toISOString(),
          }
        ],
      };

      await updateDoc(doc(db, "trucks", selectedTruckId), updates);

      setShowCollectModal(false);
      setSuccessMessage(atOrOverCap ? "🧺 Collected. Truck is FULL — send to Dump Site." : "🧺 Collection recorded.");
      setTimeout(() => setSuccessMessage(""), 2200);
    } catch (e) {
      console.error(e);
      alert("Could not save collection.");
    }
  };

  // ===== Dump flow =====
  const dumpNow = async (truck) => {
    try {
      const t = trucks.find((x) => x.id === truck.id) || {};
      await updateDoc(doc(db, "trucks", truck.id), {
        trips: [
          ...(t.trips || []),
          {
            origin: "Route",
            destination: t.dumpSiteName || "Garbage Dump Site",
            cargo: `Dumping ${t.currentLoadKg || 0} kg`,
            date: new Date().toISOString(),
          }
        ],
        currentLoadKg: 0,
        needsDumping: false,
        status: "active",
        updatedAt: serverTimestamp(),
      });
      setSuccessMessage("🗑️ Dump completed. Load reset to 0 kg.");
      setTimeout(() => setSuccessMessage(""), 2000);
    } catch (e) {
      console.error(e);
      alert("Could not complete dump.");
    }
  };

  // ===== Oil change =====
  const markOilChanged = async (truck) => {
    try {
      const nowISO = new Date().toISOString();
      const nextISO = computeNextOilChange(nowISO);
      await updateDoc(doc(db, "trucks", truck.id), {
        lastOilChange: nowISO,
        nextOilChange: nextISO,
        updatedAt: serverTimestamp(),
      });
      setSuccessMessage("🛠️ Oil change recorded (next due in ~3 months).");
      setTimeout(() => setSuccessMessage(""), 2200);
    } catch (e) {
      console.error(e);
      alert("Could not mark oil change.");
    }
  };

  // ===== Status quick toggle =====
  const setStatus = async (truck, status) => {
    try {
      await updateDoc(doc(db, "trucks", truck.id), { status, updatedAt: serverTimestamp() });
      setSuccessMessage(`🚦 Status set to ${status}`);
      setTimeout(() => setSuccessMessage(""), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  // ===== Filtering =====
  const filteredTrucks = useMemo(() => {
    return trucks
      .filter((t) => {
        const hay = ((t.truckId || "") + " " + (t.plateNumber || "")).toLowerCase().trim();
        const needle = search.toLowerCase().trim();
        const matchesSearch = !needle || hay.includes(needle);
        const matchesStatus = statusFilter === "all" ? true : (t.status || "inactive") === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => (a.truckId || a.id).localeCompare(b.truckId || b.id));
  }, [trucks, search, statusFilter]);

  return (
    <div className="add-truck-container">
      <Sidebar />

      <div className="add-truck-grid">
        {successMessage && <div className="success-message">{successMessage}</div>}

        {/* ===== Left column: List + Filters ===== */}
        <div className="truck-list">
          <h3>
            <CiCircleList style={{ fontSize: "29px" }} />
            <span>Fleet — Truck List</span>
          </h3>

          <div className="filterBar">
            <div className="searchWrap">
              <input
                type="text"
                placeholder="Search ID / plate"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="statusWrap" title="Filter status">
              <FaFilter />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
                <option value="to_dump">To Dump</option>
                <option value="logged_out">Logged Out</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="scrollContainer">
            {filteredTrucks.map((truck) => {
              const load = Number(truck.currentLoadKg || 0);
              const cap = Number(truck.capacityKg || 0);
              const pct = cap > 0 ? Math.min(100, Math.round((load / cap) * 100)) : 0;
              const nextOil = truck.nextOilChange || (truck.lastOilChange ? computeNextOilChange(truck.lastOilChange) : null);
              const oilDue = isOilDue(nextOil);

              return (
                <div key={truck.id} className="truck-item">
                  <div className="truck-main">
                    <span className="truck-text">
                      <strong>{truck.truckId || truck.id}</strong> · {truck.plateNumber || "No plate"}
                      <span className={statusClass(truck)}>{humanStatus(truck)}</span>
                      {oilDue && (
                        <span className="badge warn" title={`Next oil: ${nextOil ? new Date(nextOil).toLocaleDateString() : "N/A"}`}>
                          Oil Change DUE
                        </span>
                      )}
                      {truck.needsDumping && <span className="badge err">FULL</span>}
                    </span>
                    <div className="truck-subtext">
                      {(truck.fuelType || "Fuel N/A")} · {cap ? `${cap} kg cap` : "Cap N/A"} · Load: {load} kg ({pct}%)
                    </div>
                    {nextOil && (
                      <div className="truck-subtext small">
                        Next oil change: {new Date(nextOil).toLocaleDateString()}
                      </div>
                    )}
                    {/* simple load bar */}
                    <div className="progressWrap" aria-label="Load progress">
                      <div className="progressBar">
                        <div className={`progressFill ${truck.needsDumping ? "danger" : ""}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="btnRow">
                    {/* Left cluster: trip / fuel / collection / status */}
                    <div className="action-group">
                      <button className="small-btn" title="Record Trip" onClick={() => openTripModal(truck)}>
                        <FaRoad />
                      </button>

                      <button className="small-btn" title="Log Fuel" onClick={() => openFuelModal(truck)}>
                        <FaGasPump />
                      </button>

                      {/* NEW: Collection */}
                      <button className="small-btn" title="Record Collection (once per zone per day)" onClick={() => openCollectModal(truck)}>
                        🧺
                      </button>

                      {/* View Collection Submitted - Only show if truck has submitted collections */}
                      {hasSubmittedCollections(truck) && (
                        <button className="small-btn" title="View Collection Schedule" onClick={() => openCollectScheduleModal(truck)}>
                          📆
                        </button>
                      )}

                      {/* View Collector Reports - Only show if truck has submitted reports */}
                      {hasSubmittedReports(truck) && (
                        <button className="small-btn" title="View Collector Reports" onClick={() => openCollectorReportsModal(truck)}>
                          <FaFileAlt />
                        </button>
                      )}
                      

                      {/* NEW: Dump Now when full */}
                      {(truck.needsDumping || (cap > 0 && load >= cap)) && (
                        <button className="small-btn danger" title="Dump Now" onClick={() => dumpNow(truck)}>
                          🗑️
                        </button>
                      )}

                      {/* NEW: Mark Oil Changed */}
                      <button className="small-btn" title="Mark Oil Changed" onClick={() => markOilChanged(truck)}>
                        <FaWrench />
                      </button>

                      <select
                        className="statusDropdown"
                        value={truck.status || "inactive"}
                        onChange={(e) => setStatus(truck, e.target.value)}
                        title="Quick status"
                      >
                        <option value="active">Active</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="to_dump">To Dump</option>
                        <option value="logged_out">Logged Out</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>

                    {/* Right cluster: edit / delete */}
                    <div className="edit-delete-group">
                      <button className="edit-btn" onClick={() => openEditModal(truck)}>
                        <FaEdit />
                      </button>
                      <button className="delete-btn" onClick={() => openDeleteModal(truck)}>
                        <FaTrashCan />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredTrucks.length === 0 && <div className="empty">No trucks found.</div>}
          </div>
        </div>

        {/* ===== Right column: Form (fixed, no internal scroll) ===== */}
        <div className="card sticky-card">
          <h2>
            <FaTruck style={{ marginRight: "10px" }} /> {editingId ? "Edit Truck" : "Add Truck"}
          </h2>

          <div className="formGrid">
            <label>Truck ID</label>
            <input
              type="text"
              placeholder="e.g. DMPTRCK_U9L-346"
              value={truckId}
              onChange={(e) => setTruckId(normalizeTruckId(e.target.value))}
              onBlur={(e) => setTruckId(normalizeTruckId(e.target.value))}
              maxLength={20}
            />

            <label>Plate Number</label>
            <input
              type="text"
              placeholder="e.g. ABC-1234"
              value={plateNumber}
              onChange={(e) => setPlateNumber(normalizePlate(e.target.value))}
              onBlur={(e) => setPlateNumber(normalizePlate(e.target.value))}
            />

            <label>Capacity (kg)</label>
            <input
              type="number"
              placeholder="e.g. 3000"
              value={capacityKg}
              onChange={(e) => setCapacityKg(e.target.value)}
            />

            <label>Fuel Type</label>
            <select value={fuelType} onChange={(e) => setFuelType(e.target.value)}>
              <option>Diesel</option>
              <option>Gasoline</option>
              <option>Electric</option>
              <option>Hybrid</option>
            </select>
          </div>

          <div className="formButtons">
            <button onClick={handleAddOrUpdateTruck}>{editingId ? "Update" : "Save"}</button>
            {editingId && (
              <button className="secondary" onClick={clearForm}>
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===== Fuel Modal ===== */}
      {showFuelModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Log Fuel — {selectedTruckLabel}</h3>
            <div className="modal-form">
              <label>Liters</label>
              <input
                type="number"
                placeholder="e.g. 50"
                value={fuelLiters}
                onChange={(e) => setFuelLiters(e.target.value)}
              />
              <label>Cost</label>
              <input
                type="number"
                placeholder="e.g. 3500"
                value={fuelCost}
                onChange={(e) => setFuelCost(e.target.value)}
              />
              <label>Notes</label>
              <textarea
                placeholder="Fuel station / receipt no."
                value={fuelNote}
                onChange={(e) => setFuelNote(e.target.value)}
              />
            </div>
            <div className="modal-buttons">
              <button className="cancel-btn" onClick={() => setShowFuelModal(false)}>
                Cancel
              </button>
              <button className="confirm-btn" onClick={saveFuel}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Trip Modal ===== */}
      {showTripModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Record Trip — {selectedTruckLabel}</h3>
            <div className="modal-form">
              <label>Origin</label>
              <input
                type="text"
                placeholder="e.g. Bacolod"
                value={tripOrigin}
                onChange={(e) => setTripOrigin(e.target.value)}
              />
              <label>Destination</label>
              <input
                type="text"
                placeholder="e.g. Iloilo"
                value={tripDestination}
                onChange={(e) => setTripDestination(e.target.value)}
              />
              <label>Cargo</label>
              <input
                type="text"
                placeholder="e.g. Rice sacks"
                value={tripCargo}
                onChange={(e) => setTripCargo(e.target.value)}
              />
            </div>
            <div className="modal-buttons">
              <button className="cancel-btn" onClick={() => setShowTripModal(false)}>
                Cancel
              </button>
              <button className="confirm-btn" onClick={saveTrip}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Collection Modal ===== */}
      {showCollectModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Record Collection — {selectedTruckLabel}</h3>
            <div className="modal-form">
              <label>Zone</label>
              <input
                type="text"
                placeholder="e.g. Zone 3A"
                value={collectZone}
                onChange={(e) => setCollectZone(e.target.value)}
              />
              <label>Collected Weight (kg)</label>
              <input
                type="number"
                placeholder="e.g. 600"
                value={collectKg}
                onChange={(e) => setCollectKg(e.target.value)}
              />
              <small className="hint">A zone can be collected only once per day.</small>
            </div>
            <div className="modal-buttons">
              <button className="cancel-btn" onClick={() => setShowCollectModal(false)}>
                Cancel
              </button>
              <button className="confirm-btn" onClick={saveCollection}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Collection Schedule Modal ===== */}
      {showCollectionScheduleModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: '800px', maxHeight: '80vh' }}>
            <h3>Collection History — {selectedTruckLabel}</h3>
            
            <div style={{ maxHeight: '60vh', overflowY: 'auto', marginTop: '16px' }}>
              {selectedTruckCollections.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  <p>No collection records found for this truck.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {selectedTruckCollections.map((collection, index) => {
                    const completedDate = collection.completedAt?.toDate ? 
                      collection.completedAt.toDate() : 
                      new Date(collection.completedAt);
                    const startedDate = collection.startedAt?.toDate ? 
                      collection.startedAt.toDate() : 
                      new Date(collection.startedAt);
                    
                    return (
                      <div key={collection.id || index} style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '16px',
                        backgroundColor: '#f9fafb'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div>
                            <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600' }}>
                              {collection.location || 'Unknown Location'}
                            </h4>
                            <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>
                              {collection.zone} • {collection.day} • {collection.time}
                            </p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ 
                              backgroundColor: '#10b981', 
                              color: 'white', 
                              padding: '4px 8px', 
                              borderRadius: '4px', 
                              fontSize: '12px', 
                              fontWeight: '600',
                              marginBottom: '4px'
                            }}>
                              {collection.weightKg} kg
                            </div>
                            <div style={{ fontSize: '12px', color: '#666' }}>
                              {collection.status}
                            </div>
                          </div>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', color: '#666' }}>
                          <div>
                            <strong>Started:</strong> {startedDate.toLocaleString()}
                          </div>
                          <div>
                            <strong>Completed:</strong> {completedDate.toLocaleString()}
                          </div>
                          <div>
                            <strong>Group:</strong> {collection.groupName || 'N/A'}
                          </div>
                          <div>
                            <strong>Schedule ID:</strong> {collection.scheduleId || 'N/A'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="modal-buttons">
              <button className="cancel-btn" onClick={() => setShowCollectionScheduleModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Collector Reports Modal ===== */}
      {showCollectorReportsModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: '800px', maxHeight: '80vh' }}>
            <h3>Collector Reports — {selectedTruckLabel}</h3>
            
            <div style={{ maxHeight: '60vh', overflowY: 'auto', marginTop: '16px' }}>
              {selectedTruckReports.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  <p>No reports found for this collector.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {selectedTruckReports.map((report, index) => {
                    const createdDate = report.createdAt?.toDate ? 
                      report.createdAt.toDate() : 
                      new Date(report.createdAt);
                    
                    const getStatusColor = (status) => {
                      switch (status) {
                        case 'pending': return '#f59e0b';
                        case 'approved': return '#10b981';
                        case 'rejected': return '#ef4444';
                        default: return '#6b7280';
                      }
                    };
                    
                    return (
                      <div key={report.id || index} style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        padding: '20px',
                        backgroundColor: '#ffffff',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        marginBottom: '16px'
                      }}>
                        {/* Header Section */}
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'flex-start', 
                          marginBottom: '16px',
                          borderBottom: '1px solid #f3f4f6',
                          paddingBottom: '12px'
                        }}>
                          <div style={{ flex: 1 }}>
                            <h4 style={{ 
                              margin: '0 0 8px 0', 
                              fontSize: '18px', 
                              fontWeight: '700',
                              color: '#1f2937'
                            }}>
                              {report.reporttype || 'Unknown Report Type'}
                            </h4>
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '12px',
                              fontSize: '14px',
                              color: '#6b7280'
                            }}>
                              <span style={{ 
                                backgroundColor: '#f3f4f6',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '500'
                              }}>
                                📅 {report.maintenanceDate || 'N/A'}
                              </span>
                              <span style={{ 
                                backgroundColor: '#f3f4f6',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '500'
                              }}>
                                🕒 {createdDate.toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ 
                              backgroundColor: getStatusColor(report.status), 
                              color: 'white', 
                              padding: '8px 16px', 
                              borderRadius: '20px', 
                              fontSize: '13px', 
                              fontWeight: '700',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              {report.status || 'pending'}
                            </div>
                          </div>
                        </div>
                        
                        {/* Report Message Section */}
                        <div style={{ 
                          marginBottom: '16px',
                          padding: '12px',
                          backgroundColor: '#f9fafb',
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb'
                        }}>
                          <h5 style={{ 
                            margin: '0 0 8px 0', 
                            fontSize: '14px', 
                            fontWeight: '600',
                            color: '#374151'
                          }}>
                            Report Details:
                          </h5>
                          <p style={{ 
                            margin: '0', 
                            fontSize: '14px', 
                            color: '#4b5563', 
                            lineHeight: '1.5'
                          }}>
                            {report.reportMessage || 'No message provided'}
                          </p>
                        </div>
                        
                        {/* Action Buttons Section */}
                        {report.status === 'pending' && (
                          <div style={{ 
                            display: 'flex', 
                            gap: '12px', 
                            marginBottom: '16px',
                            padding: '12px',
                            backgroundColor: '#fef3c7',
                            borderRadius: '8px',
                            border: '1px solid #fbbf24'
                          }}>
                            <button
                              onClick={() => approveReport(report.id)}
                              style={{
                                backgroundColor: '#10b981',
                                color: 'white',
                                border: 'none',
                                padding: '10px 20px',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                flex: 1,
                                justifyContent: 'center'
                              }}
                              onMouseOver={(e) => {
                                e.target.style.backgroundColor = '#059669';
                                e.target.style.transform = 'translateY(-1px)';
                                e.target.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.3)';
                              }}
                              onMouseOut={(e) => {
                                e.target.style.backgroundColor = '#10b981';
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = 'none';
                              }}
                            >
                              ✓ Approve Report
                            </button>
                            <button
                              onClick={() => declineReport(report.id)}
                              style={{
                                backgroundColor: '#ef4444',
                                color: 'white',
                                border: 'none',
                                padding: '10px 20px',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                flex: 1,
                                justifyContent: 'center'
                              }}
                              onMouseOver={(e) => {
                                e.target.style.backgroundColor = '#dc2626';
                                e.target.style.transform = 'translateY(-1px)';
                                e.target.style.boxShadow = '0 4px 8px rgba(239, 68, 68, 0.3)';
                              }}
                              onMouseOut={(e) => {
                                e.target.style.backgroundColor = '#ef4444';
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = 'none';
                              }}
                            >
                              ✗ Decline Report
                            </button>
                          </div>
                        )}
                        
                        {/* Footer Section */}
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          fontSize: '12px', 
                          color: '#9ca3af',
                          paddingTop: '12px',
                          borderTop: '1px solid #f3f4f6'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ 
                              backgroundColor: '#f3f4f6',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '500'
                            }}>
                              ID: {report.id || 'N/A'}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px' }}>
                            Created: {createdDate.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="modal-buttons">
              <button className="cancel-btn" onClick={() => setShowCollectorReportsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global dialogs (Delete / Edit confirms) */}
      <deleteConfirm.Dialog />
      <editConfirm.Dialog />
    </div>
  );
};

export default Fleet;
