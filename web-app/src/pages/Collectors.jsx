import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import Sidebar from "./Sidebar";
import SHA256 from "crypto-js/sha256";
import { FaUserGear } from "react-icons/fa6";
import { FaRegEye, FaRegEyeSlash, FaRegEdit, FaRegTrashAlt } from "react-icons/fa";
import { CiCircleList } from "react-icons/ci";
import "./Collectors.css";

/** ---------------- Standards & Normalizers ---------------- */
// No enforced standard / regex / normalization for collectorId (free text)

// Truck ID: allow underscore and up to 20 total chars (to match Fleet)
const TRUCK_ID_REGEX = /^[A-Z][A-Z0-9_-]{4,19}$/;
const normalizeTruckId = (v) => (v || "").toUpperCase().replace(/\s+/g, "");

/** ---------------- Reusable Confirm Dialog ---------------- */
const useConfirm = () => {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState({
    title: "",
    body: "",
    variant: "",
    onConfirm: null,
  });
  const ask = (c) => {
    setConfig(c);
    setOpen(true);
  };
  const close = () => setOpen(false);
  const Dialog = () =>
    !open ? null : (
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
              onClick={async () => {
                try {
                  await Promise.resolve(config.onConfirm?.());
                } finally {
                  close();
                }
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    );
  return { ask, Dialog, open, close };
};

const AddCollectorScreen = () => {
  // form fields
  const [collectorId, setCollectorId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [password, setPassword] = useState("");
  const [assignedTruckId, setAssignedTruckId] = useState(""); // chosen from unassigned list
  const [showPassword, setShowPassword] = useState(false);
  

  // data
  const [collectors, setCollectors] = useState([]);
  const [trucks, setTrucks] = useState([]);

  // edit state
  const [editingId, setEditingId] = useState(null);
  const [truckLocked, setTruckLocked] = useState(false);
  const [saving, setSaving] = useState(false);

  // success toast
  const [successMessage, setSuccessMessage] = useState("");
  const toastTimer = useRef(null);
  const showSuccess = (msg) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setSuccessMessage(msg);
    toastTimer.current = setTimeout(() => setSuccessMessage(""), 2400);
  };
  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

  // confirm dialogs
  const deleteConfirm = useConfirm();
  const discardConfirm = useConfirm();
  const reassignConfirm = useConfirm();
  const overrideConfirm = useConfirm();

  // fetchers
  const fetchCollectors = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, "collectors"));
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCollectors(list);
    } catch (e) {
      console.error("Failed to fetch collectors:", e);
      alert("We were unable to load collectors. Please refresh and try again.");
    }
  }, []);

  const fetchTrucks = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, "trucks"));
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => String(a.truckId || a.id).localeCompare(String(b.truckId || b.id)));
      setTrucks(list);
    } catch (e) {
      console.error("Failed to fetch trucks:", e);
      alert("We were unable to load trucks. Please refresh and try again.");
    }
  }, []);

  useEffect(() => {
    (async () => {
      await fetchCollectors();
      await fetchTrucks();
    })();
  }, [fetchCollectors, fetchTrucks]);

  // freeze body scroll while any modal open
  useEffect(() => {
    const anyOpen =
      deleteConfirm.open || discardConfirm.open || reassignConfirm.open || overrideConfirm.open;
    document.body.style.overflow = anyOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [deleteConfirm.open, discardConfirm.open, reassignConfirm.open, overrideConfirm.open]);

  const clearFields = () => {
    setCollectorId("");
    setFirstName("");
    setLastName("");
    setContactNumber("");
    setPassword("");
    setAssignedTruckId("");
    setEditingId(null);
    setTruckLocked(false);
  };

  /** ---------------- Unassigned Trucks (for typeahead) ---------------- */
  const assignedTruckIds = useMemo(
    () => new Set(collectors.map((c) => c.assignedTruckId).filter(Boolean)),
    [collectors]
  );
  const allTruckIds = useMemo(() => trucks.map((t) => t.truckId || t.id), [trucks]);

  const unassignedTruckIds = useMemo(() => {
    const currentAssigned = editingId
      ? collectors.find((c) => c.id === editingId)?.assignedTruckId
      : null;
    return allTruckIds.filter((id) => !assignedTruckIds.has(id) || id === currentAssigned);
  }, [allTruckIds, assignedTruckIds, collectors, editingId]);

  /** ---------------- Validation ---------------- */
  const validate = () => {
    const id = (collectorId || "").trim();
    if (!id) {
      alert("Please provide a Collector ID.");
      return false;
    }
    if (id.includes("/")) {
      alert("Collector ID cannot contain '/'.");
      return false;
    }
    if (!firstName.trim() || !lastName.trim()) {
      alert("Please provide both first and last name.");
      return false;
    }
    if (!editingId && !password) {
      alert("Please set a password for the new collector.");
      return false;
    }
    if (assignedTruckId) {
      const tid = normalizeTruckId(assignedTruckId);
      if (!TRUCK_ID_REGEX.test(tid)) {
        alert(
          "Truck ID must be 5–20 characters, start with a letter, and use only A–Z, 0–9, '-' or '_'. Example: DMPTRCK_U9L-346"
        );
        return false;
      }
    }
    return true;
  };

  /** ---------------- Save (with reassignment confirm) ---------------- */
  const handleSave = async () => {
    if (saving) return;
    if (!validate()) return;

    const id = collectorId.trim(); // use as-is (no normalization)
    const normalizedTruck = assignedTruckId ? normalizeTruckId(assignedTruckId) : "";

    // If the entered truck is assigned to someone else, confirm reassignment
    const currentOwner = normalizedTruck
      ? collectors.find((c) => c.assignedTruckId === normalizedTruck && c.id !== editingId)
      : null;

    const doWrite = async () => {
      try {
        // Duplicate check BEFORE enabling saving (prevents stuck state)
        if (!editingId) {
          const exists = await getDoc(doc(db, "collectors", id));
          if (exists.exists()) {
            alert("The collector ID you entered is already in use. Please choose a different ID.");
            return;
          }
        }

        setSaving(true);

        const payload = {
          collectorId: id,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          contactNumber: contactNumber.trim(),
          assignedTruckId: normalizedTruck,
          ...(password ? { password: SHA256(password.trim()).toString() } : {}),
          updatedAt: new Date().toISOString(),
        };

        if (editingId) {
          await updateDoc(doc(db, "collectors", editingId), payload);
          setTruckLocked(Boolean(normalizedTruck));
        } else {
          await setDoc(doc(db, "collectors", id), payload);
        }

        // If reassignment, clear it from the previous owner
        if (currentOwner) {
          await updateDoc(doc(db, "collectors", currentOwner.id), { assignedTruckId: "" });
        }

        await fetchCollectors();
        if (!editingId) clearFields();

        showSuccess(
          editingId
            ? "Collector record updated successfully."
            : "Collector record created successfully."
        );
      } catch (err) {
        console.error(err);
        alert("We were unable to save the record. Please try again.");
      } finally {
        setSaving(false);
      }
    };

    if (normalizedTruck && currentOwner) {
      reassignConfirm.ask({
        title: "Reassign Truck?",
        body: `Truck ${normalizedTruck} is currently assigned to ${
          currentOwner.firstName || ""
        } ${currentOwner.lastName || currentOwner.id}. Do you want to reassign it to this collector?`,
        variant: "warning",
        onConfirm: doWrite,
      });
    } else {
      await doWrite();
    }
  };

  /** ---------------- UI Events ---------------- */
  const handleEdit = (collector) => {
    setCollectorId(collector.id); // show existing id (doc id)
    setFirstName(collector.firstName || "");
    setLastName(collector.lastName || "");
    setContactNumber(collector.contactNumber || "");
    setPassword("");
    setAssignedTruckId(collector.assignedTruckId || "");
    setEditingId(collector.id);
    setTruckLocked(Boolean(collector.assignedTruckId)); // lock if already has a truck
  };

  const requestDelete = (collector) => {
    deleteConfirm.ask({
      title: "Delete Collector",
      body: `You are about to delete ${collector.firstName || ""} ${
        collector.lastName || ""
      } (${collector.id}). This action cannot be undone. Proceed?`,
      variant: "danger",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "collectors", collector.id));
          await fetchCollectors();
          if (editingId === collector.id) clearFields();
          showSuccess("Collector record deleted successfully.");
        } catch (err) {
          console.error(err);
          alert("We were unable to delete the record. Please try again.");
        }
      },
    });
  };

  const formDirty =
    !!collectorId ||
    !!firstName ||
    !!lastName ||
    !!contactNumber ||
    !!password ||
    !!assignedTruckId;

  const requestCancel = () => {
    if (!formDirty) return;
    discardConfirm.ask({
      title: "Discard Changes?",
      body: "You have unsaved changes. Do you want to discard them?",
      onConfirm: clearFields,
    });
  };

  /** ---------------- Truck selector behavior ---------------- */
  const tryEnableTruckChange = () => {
    overrideConfirm.ask({
      title: "Change Assigned Truck?",
      body:
        "This collector already has an assigned truck. Changing it will release the current truck and may reassign another. Do you wish to continue?",
      variant: "warning",
      onConfirm: () => setTruckLocked(false),
    });
  };

  // for the datalist filter UX: local query state (typeahead feel)
  const [truckQuery, setTruckQuery] = useState("");
  useEffect(() => {
    setTruckQuery(assignedTruckId || "");
  }, [assignedTruckId]);

  const filteredTruckChoices = useMemo(() => {
    const q = truckQuery.toUpperCase().trim();
    const base = unassignedTruckIds;
    return q ? base.filter((id) => id.includes(q)) : base;
  }, [unassignedTruckIds, truckQuery]);

  // Helpful hint if the typed truck is already owned by someone else
  const currentOwnerOfTypedTruck = useMemo(() => {
    const tid = normalizeTruckId(truckQuery || "");
    if (!tid) return null;
    const owner = collectors.find((c) => c.assignedTruckId === tid);
    if (!owner) return null;
    if (editingId && owner.id === editingId) return null; // it's the same collector; fine
    return owner;
  }, [truckQuery, collectors, editingId]);

  return (
    <div className="collector-main">
      <Sidebar />
      <div className="collector-container">

        {/* Success toast */}
        {successMessage && (
          <div className="success-message" role="status" aria-live="polite">
            <span className="success-icon">✓</span>
            <span className="success-text">{successMessage}</span>
            <button
              className="toast-close"
              aria-label="Close"
              onClick={() => setSuccessMessage("")}
            >
              ×
            </button>
          </div>
        )}

        {/* List */}
        <div className="collector-list-card">
          <h3 className="collector-subtitle">
            <CiCircleList className="icon" /> Collector List
          </h3>
          <div className="collector-list">
            {collectors.length === 0 && (
              <div className="collector-empty">No collectors found.</div>
            )}
            {collectors.map((c) => (
              <div
                key={c.id}
                className={`collector-item ${c.assignedTruckId ? "has-truck" : ""}`}
              >
                <div className="collector-meta">
                  <div className="collector-name-line">
                    <span className="collector-name">{c.firstName} {c.lastName}</span>
                    <span className="collector-id-pill">ID: {c.id}</span>
                    {c.assignedTruckId ? (
                      <span className="truck-pill">Truck: {c.assignedTruckId}</span>
                    ) : (
                      <span className="no-truck">• No truck</span>
                    )}
                  </div>
                </div>
                <div className="collector-actions">
                  <button
                    className="icon-btn edit-btn"
                    title="Edit"
                    onClick={() => handleEdit(c)}
                  >
                    <FaRegEdit />
                  </button>
                  <button
                    className="icon-btn delete-btn"
                    title="Delete"
                    onClick={() => requestDelete(c)}
                  >
                    <FaRegTrashAlt />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="collector-form-card">
          <h2 className="collector-title">
            <FaUserGear className="icon" /> {editingId ? "Add Collector — Editing" : "Add Collector"}
          </h2>

          <input
            autoComplete="off"
            type="text"
            placeholder="Collector ID (e.g., collectorGAN-4734)"
            value={collectorId}
            onChange={(e) => setCollectorId(e.target.value)}
            onBlur={(e) => setCollectorId(e.target.value.trim())}
            disabled={!!editingId}
          />
          <div className="collector-form-help"></div>

          <input
            autoComplete="off"
            type="text"
            placeholder="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <input
            autoComplete="off"
            type="text"
            placeholder="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />

          <input
            autoComplete="off"
            type="tel"
            placeholder="09XXXXXXXXX"
            value={contactNumber}
            onChange={(e) => setContactNumber(e.target.value)}
          />

          <div className="password-wrapper">
            <input
              autoComplete="new-password"
              type={showPassword ? "text" : "password"}
              placeholder={editingId ? "New Password (optional)" : "Password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span
              className="toggle-password"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <FaRegEyeSlash /> : <FaRegEye />}
            </span>
          </div>

          {/* Truck Typeahead (unassigned only) */}
          <div className="truck-typeahead">
            <label className="small-label">Assign Truck</label>

            <div className="truck-typeahead-row">
              <input
                list="unassigned-trucks"
                className="collector-truck-select"
                type="text"
                placeholder={
                  unassignedTruckIds.length
                    ? "Search or pick a truck…"
                    : "No unassigned trucks"
                }
                value={truckLocked ? assignedTruckId : truckQuery}
                onChange={(e) => {
                  if (truckLocked) return;
                  const val = normalizeTruckId(e.target.value);
                  setTruckQuery(val);
                  setAssignedTruckId(val);
                }}
                onBlur={(e) => {
                  if (truckLocked) return;
                  const val = normalizeTruckId(e.target.value);
                  setTruckQuery(val);
                  setAssignedTruckId(val);
                }}
                disabled={truckLocked || unassignedTruckIds.length === 0}
              />
              {truckLocked ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={tryEnableTruckChange}
                  title="Change assigned truck"
                >
                  Change…
                </button>
              ) : null}
            </div>

            <datalist id="unassigned-trucks">
              {filteredTruckChoices.map((id) => (
                <option key={id} value={id} />
              ))}
            </datalist>

            {currentOwnerOfTypedTruck && (
              <div className="collector-form-help warn">
                “{truckQuery}” is currently assigned to{" "}
                {currentOwnerOfTypedTruck.firstName} {currentOwnerOfTypedTruck.lastName}. If you
                proceed, you will be asked to confirm reassignment.
              </div>
            )}
            {!assignedTruckId && <div className="collector-form-help"></div>}
          </div>

          <div className="collector-actions-row">
            <button className="save-btn" onClick={handleSave} disabled={saving}>
              {saving ? (editingId ? "Updating…" : "Saving…") : (editingId ? "Update" : "Save")}
            </button>
            <button
              className="cancel-btn-outline"
              onClick={requestCancel}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Global dialogs (no “×” icon; only Cancel/Confirm) */}
      <deleteConfirm.Dialog />
      <discardConfirm.Dialog />
      <reassignConfirm.Dialog />
      <overrideConfirm.Dialog />
    </div>
  );
};

export default AddCollectorScreen;
