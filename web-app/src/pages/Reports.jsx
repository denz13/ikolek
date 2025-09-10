import { useState, useEffect, useMemo } from "react";
import Sidebar from "./Sidebar";
import { FiMessageSquare } from "react-icons/fi";

import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
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
  const [showAddressedModal, setShowAddressedModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all"); // "all", "pending", "addressed"

  /** Live-load all reports (include addressed reports even if archived) */
  useEffect(() => {
    // If you want newest first, uncomment the orderBy import and next line:
    // const q = query(collection(db, "reports"), orderBy("submittedAt", "desc"));
    const q = query(collection(db, "reports"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const all = [];
      querySnapshot.forEach((d) => all.push({ id: d.id, ...d.data() }));
      // Show all reports, including addressed ones (even if archived)
      const visible = all.filter((f) => !f.archived || f.status === "addressed");

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

  const sendReply = async () => {
    if (!selectedFeedback) return;
    if (!reply.trim()) return alert("Reply cannot be empty");
    
    // Check if report is already addressed
    if (selectedFeedback.status === "addressed") {
      setShowAddressedModal(true);
      return;
    }
    
    const docRef = doc(db, "reports", selectedFeedback.id);
    await updateDoc(docRef, { 
      response: reply.trim(), 
      status: "addressed",
      archived: true,
      archivedAt: serverTimestamp()
    });
    
    // Create notification for the user
    try {
      await addDoc(collection(db, "notifications_reports"), {
        users_id: selectedFeedback.userId,
        title: "Report Response",
        message: `Your report has been addressed. Response: ${reply.trim()}`,
        status: "unread",
        reportId: selectedFeedback.id,
        createdAt: serverTimestamp(),
        type: "report_response"
      });
    } catch (error) {
      console.error("Error creating notification:", error);
      // Don't fail the whole operation if notification fails
    }
    
    // Update local state to reflect the change
    setFeedbacks(prevFeedbacks => 
      prevFeedbacks.map(feedback => 
        feedback.id === selectedFeedback.id 
          ? { ...feedback, status: "addressed", response: reply.trim() }
          : feedback
      )
    );
    
    // Update selected feedback
    setSelectedFeedback(prev => ({ ...prev, status: "addressed", response: reply.trim() }));
    
    alert("Reply sent and report marked as addressed!");
  };

  const handleSelectFeedback = (feedback) => {
    if (feedback.status === "addressed") {
      setShowAddressedModal(true);
    } else {
      setSelectedFeedback(feedback);
    }
  };

  // Filter feedbacks based on status
  const filteredFeedbacks = feedbacks.filter(feedback => {
    if (statusFilter === "all") return true;
    if (statusFilter === "pending") return feedback.status !== "addressed";
    if (statusFilter === "addressed") return feedback.status === "addressed";
    return true;
  });

  // Debug: Log current statuses when filter changes
  useEffect(() => {
    console.log("Current filter:", statusFilter);
    console.log("All feedbacks:", feedbacks.map(f => ({ id: f.id, status: f.status, response: f.response })));
    console.log("Filtered feedbacks:", filteredFeedbacks.map(f => ({ id: f.id, status: f.status })));
  }, [statusFilter, feedbacks, filteredFeedbacks]);

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
                placeholder={selectedFeedback?.status === "addressed" ? "This report has been addressed and archived." : "Write your reply..."}
                spellCheck
                disabled={selectedFeedback?.status === "addressed"}
              />

              <div className="reports-buttons">
                <button
                  type="button"
                  className="btn btn-green"
                  onClick={sendReply}
                  disabled={!selectedFeedback || selectedFeedback?.status === "addressed"}
                >
                  {selectedFeedback?.status === "addressed" ? "Report Addressed" : "Send Reply"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Left: Report List */}
        <div className="reports-list">
          <div className="reports-header">
            <h3 className="reports-title">
              <FiMessageSquare className="reports-icon" />
              <span>Reports ({filteredFeedbacks.length})</span>
            </h3>
            <div className="status-filter">
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Reports</option>
                <option value="pending">Pending</option>
                <option value="addressed">Addressed</option>
              </select>
            </div>
          </div>

          <div className="reports-card-items">
            {filteredFeedbacks.length === 0 ? (
              <p className="reports-empty">
                {statusFilter === "all" ? "No reports available" : 
                 statusFilter === "pending" ? "No pending reports" : 
                 "No addressed reports"}
              </p>
            ) : (
              filteredFeedbacks.map((feedback) => {
                const userLabel = getUserLabel(feedback.userId);
                return (
                  <div
                    key={feedback.id}
                    className={`reports-item ${
                      feedback.status === "addressed"
                        ? "addressed"
                        : feedback.status === "read"
                        ? "read"
                        : "unread"
                    }`}
                    onClick={() => handleSelectFeedback(feedback)}
                    title={feedback.status === "addressed" ? "Report already addressed - Click to see details" : "Open report"}
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

      {/* Addressed Modal */}
      {showAddressedModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Report Already Addressed</h3>
            <p>This report has already been addressed and archived. You cannot send additional replies.</p>
            <div className="modal-buttons">
              <button 
                className="btn btn-green" 
                onClick={() => setShowAddressedModal(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
