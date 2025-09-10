// ScheduleScreen.jsx (JavaScript only)
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  query,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import Sidebar from "../pages/Sidebar";
import { FaRegEdit, FaRegTrashAlt } from "react-icons/fa";
import "./Schedules.css";

/* ── Constants ──────────────────────────────────────────────────────── */
const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const times = ["6:00 AM - 12:00 NN", "6:00 PM - 12:00 AM (Night Shift)"];

const sortSchedulesByDay = (list) =>
  [...list].sort(
    (a, b) => days.indexOf(a?.day || "") - days.indexOf(b?.day || "")
  );

const dayShortMap = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

const dayShort = (d) => dayShortMap[d] || "";

const dayPillClass = (d) =>
  (
    {
      Monday: "pill--day-mon",
      Tuesday: "pill--day-tue",
      Wednesday: "pill--day-wed",
      Thursday: "pill--day-thu",
      Friday: "pill--day-fri",
      Saturday: "pill--day-sat",
      Sunday: "pill--day-sun",
    }[d] || "pill--day-mon"
  );

const zonePillClass = (zRaw) => {
  const z = String(zRaw || "").toLowerCase();
  if (z.includes("north")) return "pill--zone-north";
  if (z.includes("south")) return "pill--zone-south";
  if (z.includes("east")) return "pill--zone-east";
  if (z.includes("west")) return "pill--zone-west";
  if (z.includes("central") || z.includes("center") || z.includes("centre"))
    return "pill--zone-central";
  return "pill--zone-north";
};

/* ── Component ─────────────────────────────────────────────────────── */
export default function ScheduleScreen() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // filter
  const [filterZone, setFilterZone] = useState("");

  // form
  const [zone, setZone] = useState("");
  const [location, setLocation] = useState("");
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [groupName, setGroupName] = useState("");
  const [driver, setDriver] = useState("");
  const [members, setMembers] = useState([""]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  // delete modal
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  /* ── Realtime Firestore sync ─────────────────────────────────────── */
  useEffect(() => {
    const colRef = collection(db, "schedules");
    const q = query(colRef);

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setSchedules(sortSchedulesByDay(list));
        setLoading(false);
        setLoadError("");
      },
      (err) => {
        console.error(err);
        setLoadError("Failed to load schedules.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  /* ── Helpers ─────────────────────────────────────────────────────── */
  const resetForm = () => {
    setZone("");
    setLocation("");
    setDay("");
    setTime("");
    setGroupName("");
    setDriver("");
    setMembers([""]);
    setEditMode(false);
    setEditId(null);
    setSaving(false);
  };

  const openAddModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleEdit = (s) => {
    setZone(s.zone || "");
    setLocation(s.location || "");
    setDay(s.day || "");
    setTime(s.time || "");
    setGroupName(s.groupName || "");
    setDriver(s.driver || "");
    setMembers(Array.isArray(s.members) && s.members.length ? s.members : [""]);
    setEditMode(true);
    setEditId(s.id);
    setModalOpen(true);
  };

  const requestDelete = (schedule) => {
    setDeleteTarget(schedule);
    setDeleteOpen(true);
  };

  /* ── Create / Update ─────────────────────────────────────────────── */
  const handleAddOrUpdateSchedule = async () => {
    const normalizedMembers = members.map((m) => m.trim()).filter(Boolean);

    if (
      !zone.trim() ||
      !location.trim() ||
      !day ||
      !time ||
      !groupName.trim() ||
      !driver.trim() ||
      normalizedMembers.length === 0
    ) {
      alert("Please fill in all fields and provide at least one member.");
      return;
    }
    if (!days.includes(day)) {
      alert("Please select a valid day.");
      return;
    }
    if (!times.includes(time)) {
      alert("Please select a valid time.");
      return;
    }

    const data = {
      zone: zone.trim(),
      location: location.trim(),
      day,
      time,
      groupName: groupName.trim(),
      driver: driver.trim(),
      members: normalizedMembers,
    };

    try {
      setSaving(true);
      if (editMode && editId) {
        await updateDoc(doc(db, "schedules", editId), data);
      } else {
        await addDoc(collection(db, "schedules"), data);
      }
      setModalOpen(false);
      resetForm();
    } catch (e) {
      console.error(e);
      alert("Failed to save schedule.");
      setSaving(false);
    }
  };

  /* ── Delete ─────────────────────────────────────────────────────── */
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteDoc(doc(db, "schedules", deleteTarget.id));
      setDeleteOpen(false);
      setDeleteTarget(null);
    } catch (e) {
      console.error(e);
      alert("Failed to delete schedule.");
    } finally {
      setDeleting(false);
    }
  };

  /* ── Derived UI data ─────────────────────────────────────────────── */
  const uniqueZones = useMemo(
    () =>
      [...new Set(schedules.map((s) => s && s.zone).filter(Boolean))].sort(
        (a, b) => String(a).localeCompare(String(b))
      ),
    [schedules]
  );

  const filtered = useMemo(() => {
    const base = filterZone
      ? schedules.filter((s) => s.zone === filterZone)
      : schedules;
    return sortSchedulesByDay(base);
  }, [schedules, filterZone]);

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div className="schedule-container">
      <Sidebar />

      <div className="schedule-main">
        <div className="schedule-header">
          <div>
            <label className="small-label" htmlFor="zoneFilter">
              Filter by Zone
            </label>
            <select
              id="zoneFilter"
              className="schedule-select"
              value={filterZone}
              onChange={(e) => setFilterZone(e.target.value)}
            >
              <option value="">All Zones</option>
              {uniqueZones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>

          <h2>Schedules</h2>

          <div>
            <button className="btn-primary" onClick={openAddModal}>
              + Add Schedule
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          {loading ? (
            <div className="schedule-empty">Loading schedules…</div>
          ) : loadError ? (
            <div className="schedule-empty error">{loadError}</div>
          ) : (
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Location</th>
                  <th>Day</th>
                  <th>Time</th>
                  <th>Group</th>
                  <th>Driver</th>
                  <th>Members</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <div className="schedule-empty">
                        No schedules found. Click <b>+ Add Schedule</b> to
                        create one.
                      </div>
                    </td>
                  </tr>
                )}

                {filtered.map((s) => (
                  <tr key={s.id} data-day={dayShort(s.day)}>
                    <td>
                      <span className={`pill ${zonePillClass(s.zone)}`}>
                        {s.zone}
                      </span>
                    </td>
                    <td>{s.location}</td>
                    <td>
                      <span className={`pill ${dayPillClass(s.day)}`}>
                        {dayShort(s.day) || s.day}
                      </span>
                    </td>
                    <td>{s.time}</td>
                    <td>{s.groupName}</td>
                    <td>{s.driver}</td>
                    <td>{Array.isArray(s.members) ? s.members.join(", ") : ""}</td>
                    <td className="actions-cell">
                      <button
                        className="icon-btn edit-btn"
                        title="Edit"
                        onClick={() => handleEdit(s)}
                      >
                        <FaRegEdit />
                      </button>
                      <button
                        className="icon-btn delete-btn"
                        title="Delete"
                        onClick={() => requestDelete(s)}
                      >
                        <FaRegTrashAlt />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Add / Edit Modal */}
        {modalOpen && (
          <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal" role="document" aria-labelledby="formTitle">
              <h3 id="formTitle">
                {editMode ? "Edit Schedule" : "Add New Schedule"}
              </h3>

              <input
                className="input"
                type="text"
                placeholder="Zone (e.g., North / South / Central)"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
              />
              <input
                className="input"
                type="text"
                placeholder="Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />

              <select
                className="select"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              >
                <option value="">Select Day</option>
                {days.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                className="select"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              >
                <option value="">Select Time</option>
                {times.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <input
                className="input"
                type="text"
                placeholder="Group Name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
              <input
                className="input"
                type="text"
                placeholder="Driver Name"
                value={driver}
                onChange={(e) => setDriver(e.target.value)}
              />

              {members.map((m, i) => (
                <div key={i} className="row-inline">
                  <input
                    className="input"
                    type="text"
                    placeholder={`Member ${i + 1}`}
                    value={m}
                    onChange={(e) => {
                      const next = [...members];
                      next[i] = e.target.value;
                      setMembers(next);
                    }}
                  />
                 <button
  className="icon-btn icon-btn--sm icon-btn--danger"
  title={`Remove member ${i + 1}`}
  aria-label={`Remove member ${i + 1}`}
  type="button"
  onClick={() => {
    const next = [...members];
    next.splice(i, 1);
    setMembers(next.length ? next : [""]);
  }}
>
  <FaRegTrashAlt />
</button>



                </div>
              ))}

              <button
                className="btn-secondary"
                type="button"
                onClick={() => setMembers((arr) => [...arr, ""])}
              >
                + Add Member
              </button>

              <div className="modal-actions">
                <button
                  className="btn-primary"
                  onClick={handleAddOrUpdateSchedule}
                  disabled={saving}
                >
                  {saving ? (editMode ? "Updating…" : "Saving…") : editMode ? "Update" : "Save"}
                </button>
                <button
                  className="btn-cancel"
                  onClick={() => {
                    setModalOpen(false);
                    resetForm();
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteOpen && deleteTarget && (
          <div className="modal-overlay" role="dialog" aria-modal="true">
            <div
              className="modal modal--danger"
              role="document"
              aria-labelledby="deleteTitle"
            >
              <div className="modal-icon warn"></div>
              <h3 id="deleteTitle">Delete schedule?</h3>
              <p className="modal-sub">
                You’re about to delete this schedule. This action cannot be
                undone.
              </p>

              <div className="modal-summary">
                <div>
                  <strong>Zone:</strong> {deleteTarget.zone}
                </div>
                <div>
                  <strong>Location:</strong> {deleteTarget.location}
                </div>
                <div>
                  <strong>Day/Time:</strong> {deleteTarget.day} —{" "}
                  {deleteTarget.time}
                </div>
                <div>
                  <strong>Group:</strong> {deleteTarget.groupName}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  className="btn-danger"
                  onClick={confirmDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
                <button
                  className="btn-cancel"
                  onClick={() => {
                    setDeleteOpen(false);
                    setDeleteTarget(null);
                  }}
                  disabled={deleting}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
