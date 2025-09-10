import { useState, useEffect, useMemo } from "react";
import Sidebar from "./Sidebar";
import { FiMessageSquare } from "react-icons/fi";

import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  // optional: orderBy
} from "firebase/firestore";
import { db } from "../firebase/firebase";

import "./Reports.css";

const Reports = () => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [reply, setReply] = useState("");
  const [usersMap, setUsersMap] = useState({}); // uid -> { displayName, email, ... }

  /** Live-load all reports (filter out archived client-side) */
  useEffect(() => {
    // If you want newest first, uncomment the orderBy import and next line:
    // const q = query(collection(db, "reports"), orderBy("submittedAt", "desc"));
    const q = query(collection(db, "reports"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const all = [];
      querySnapshot.forEach((d) => all.push({ id: d.id, ...d.data() }));
      const visible = all.filter((f) => !f.archived);

      setFeedbacks(visible);

      // keep selection stable, or select first visible
      if (!selectedFeedback && visible.length > 0) {
        setSelectedFeedback(visible[0]);
      } else if (
        selectedFeedback &&
        !visible.find((fb) => fb.id === selectedFeedback.id)
      ) {
        setSelectedFeedback(visible[0] || null);
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFeedback?.id]);

  /** Live-load all users into a map for quick userId -> profile lookup */
  useEffect(() => {
    const uq = query(collection(db, "users"));
    const unsubUsers = onSnapshot(uq, (snap) => {
      const map = {};
      snap.forEach((d) => {
        const data = d.data() || {};
        map[d.id] = {
          displayName: data.displayName || data.name || "",
          email: data.email || "",
          ...data,
        };
      });
      setUsersMap(map);
    });
    return () => unsubUsers();
  }, []);

  /** Keep reply box in sync with selectedFeedback */
  useEffect(() => {
    setReply(selectedFeedback?.response || "");
  }, [selectedFeedback]);

  const markAsAddressed = async () => {
    if (!selectedFeedback) return;
    const docRef = doc(db, "reports", selectedFeedback.id);
    await updateDoc(docRef, {
      status: "addressed",
      archived: true,
      archivedAt: serverTimestamp(),
    });
    alert("Report marked as addressed and archived.");
  };

  const sendReply = async () => {
    if (!selectedFeedback) return;
    if (!reply.trim()) return alert("Reply cannot be empty");
    const docRef = doc(db, "reports", selectedFeedback.id);
    await updateDoc(docRef, { response: reply.trim(), status: "replied" });
    alert("Reply sent/updated!");
  };

  const handleSelectFeedback = (feedback) => setSelectedFeedback(feedback);

  // Safely read zone during field transitions
  const getZone = (fb) => fb?.zone || fb?.zoning || fb?.zoneId || null;

  // Preferred user label: displayName > email > raw userId
  const getUserLabel = (userId) => {
    if (!userId) return "Unknown User";
    const profile = usersMap[userId];
    if (!profile) return userId; // fallback to raw id if we don't have a profile
    return profile.displayName?.trim()
      ? profile.displayName
      : profile.email?.trim()
      ? profile.email
      : userId;
  };

  // Optional: memoize selected user's friendly label
  const selectedUserLabel = useMemo(
    () => getUserLabel(selectedFeedback?.userId),
    [selectedFeedback?.userId, usersMap]
  );

  return (
    <div className="reports-main">
      <Sidebar />

      <div className="reports-container">
        {/* Right: Main Viewer */}
        <div className="reports-viewer">
          <h3 className="reports-title">
            <FiMessageSquare className="reports-icon" />
            <span>Report Details</span>
          </h3>

          <div className="reports-details">
            <p>
              <strong>User:</strong> {selectedUserLabel}
            </p>

            <p>
              <strong>Zone:</strong> {getZone(selectedFeedback) || "Unknown Zone"}
            </p>

            <p>
              <strong>Status:</strong>{" "}
              {selectedFeedback?.status
                ? String(selectedFeedback.status).toUpperCase()
                : "N/A"}
            </p>
            <p>
              <strong>Submitted At:</strong>{" "}
              {selectedFeedback?.submittedAt?.toDate
                ? selectedFeedback.submittedAt.toDate().toLocaleString()
                : "N/A"}
            </p>
          </div>

          <div className="reports-message">
            <p>
              <strong>Message</strong>
            </p>
            <span>{selectedFeedback?.messages || "No message"}</span>

            {!!(selectedFeedback?.images && selectedFeedback.images.length) && (
              <div className="reports-images">
                {selectedFeedback.images.map((imgUrl, index) => (
                  <img
                    key={`${selectedFeedback.id}-img-${index}`}
                    src={imgUrl}
                    alt={`Report attachment ${index + 1}`}
                    loading="lazy"
                  />
                ))}
              </div>
            )}

            {/* Reply */}
            <div className="reports-reply">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Write your reply..."
                spellCheck
              />

              <div className="reports-buttons">
                <button
                  type="button"
                  className="btn btn-green"
                  onClick={sendReply}
                  disabled={!selectedFeedback}
                >
                  Send/Update Reply
                </button>
                <button
                  type="button"
                  className="btn btn-orange"
                  onClick={markAsAddressed}
                  disabled={!selectedFeedback}
                >
                  Addressed
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Left: Report List */}
        <div className="reports-list">
          <h3 className="reports-title">
            <FiMessageSquare className="reports-icon" />
            <span>Reports</span>
          </h3>

          <div className="reports-card-items">
            {feedbacks.length === 0 ? (
              <p className="reports-empty">No reports available</p>
            ) : (
              feedbacks.map((feedback) => {
                const userLabel = getUserLabel(feedback.userId);
                return (
                  <div
                    key={feedback.id}
                    className={`reports-item ${
                      feedback.status === "read" || feedback.status === "addressed"
                        ? "read"
                        : "unread"
                    }`}
                    onClick={() => handleSelectFeedback(feedback)}
                    title="Open report"
                  >
                    <p>
                      <strong>User:</strong> {userLabel}
                      <br />
                      <em>Zone: {getZone(feedback) || "Unknown Zone"}</em>
                      <br />
                      <span className="reports-preview">
                        {(feedback.messages || "No message").slice(0, 80)}
                        {feedback.messages && feedback.messages.length > 80 ? "…" : ""}
                      </span>
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
