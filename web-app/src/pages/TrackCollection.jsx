import React, { useEffect, useState } from "react";
import { db } from "../firebase/firebase";
import { collection, onSnapshot, doc, updateDoc, getDocs } from "firebase/firestore";
import dayjs from "dayjs";
import Sidebar from "./Sidebar";
import "./TrackCollection.css";

// React Icons
import { FaRoute, FaTruck, FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import { BsClockHistory } from "react-icons/bs";

const TrackCollection = () => {
  const [collections, setCollections] = useState([]);
  const [routeIdMap, setRouteIdMap] = useState({});

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "collections"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCollections(data);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchRoutes = async () => {
      const routesSnapshot = await getDocs(collection(db, "routes"));
      const map = {};
      routesSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        map[docSnap.id] = data.routeId || "Unknown";
      });
      setRouteIdMap(map);
    };
    fetchRoutes();
  }, []);

  const markAsCompleted = async (id) => {
    const completedAt = new Date();
    await updateDoc(doc(db, "collections", id), {
      completed: true,
      completedAt,
    });
  };

  const isMissed = (item) => {
    const scheduled = dayjs(item.startedAt?.toDate());
    return !item.completed && scheduled.isBefore(dayjs());
  };

  const ongoing = collections.filter((item) => !item.completed);
  const completed = collections.filter((item) => item.completed);
  const missed = ongoing.filter(isMissed);

  return (
    <div className="track-collection-container">
      <Sidebar />

      <div className="tc-main">
        {/* Centered header that aligns with Sidebar line */}
        <div className="tc-header">
          <h1 className="tc-title">Collection Logs</h1>

          {/* Right-side actions (optional). Keep empty or add buttons later */}
          <div className="tc-actions">
            {/* Example buttons:
            <button className="tc-btn" onClick={() => {}}>Refresh</button>
            <button className="tc-btn" onClick={() => {}}>Export</button>
            */}
          </div>
        </div>

        {/* Scrollable page content below the sticky header */}
        <div className="tc-scroll">
          <CollectionSection
            title="Ongoing Collections"
            items={ongoing}
            onMark={markAsCompleted}
            getMissed={isMissed}
            routeIdMap={routeIdMap}
            emptyMessage="No ongoing collections"
          />

          <CollectionSection
            title="Missed Collections (For Rescheduling)"
            items={missed}
            getMissed={() => true}
            routeIdMap={routeIdMap}
            emptyMessage="No missed collections"
            highlightMissed
          />

          <CollectionSection
            title="Completed Collections"
            items={completed}
            routeIdMap={routeIdMap}
            emptyMessage="No completed collections yet"
          />
        </div>
      </div>
    </div>
  );
};

const CollectionSection = ({
  title,
  items,
  onMark,
  getMissed,
  emptyMessage,
  highlightMissed,
  routeIdMap,
}) => (
  <div className="collection-section">
    <h2 className="section-title">
      {title.includes("Missed") ? (
        <FaExclamationTriangle className="warning-icon" />
      ) : title.includes("Completed") ? (
        <FaCheckCircle className="completed-icon" />
      ) : (
        <BsClockHistory className="collection-icon" />
      )}
      {title}
    </h2>

    {items.length > 0 ? (
      items.map((item) => (
        <CollectionCard
          key={item.id}
          item={item}
          missed={getMissed ? getMissed(item) : false}
          onMark={onMark}
          routeIdMap={routeIdMap}
          highlightMissed={highlightMissed}
        />
      ))
    ) : (
      <p className="empty-message">{emptyMessage}</p>
    )}
  </div>
);

const CollectionCard = ({ item, missed, onMark, routeIdMap, highlightMissed }) => {
  const displayRouteId = routeIdMap[item.routeId] || "Unknown Route ID";

  return (
    <div className={`collection-card ${missed ? "missed" : ""}`}>
      <div>
        <FaRoute className="collection-icon" />
        <strong>Route ID:</strong> {displayRouteId}
      </div>
      <div>
        <FaTruck className="collection-icon" />
        <strong>Truck ID:</strong> {item.truckId || "N/A"}
      </div>
      <div>
        <BsClockHistory className="collection-icon" />
        <strong>Started:</strong>{" "}
        {item.startedAt?.toDate().toLocaleString() || "Not started"}
      </div>

      {item.completed && (
        <div>
          <FaCheckCircle className="completed-icon" />
          <strong>Completed:</strong>{" "}
          {item.completedAt?.toDate().toLocaleString()}
        </div>
      )}

      {item.missedPoints && (
        <div>
          <FaExclamationTriangle className="warning-icon" />
          Missed Points
        </div>
      )}

      {highlightMissed && missed && (
        <div>
          <FaExclamationTriangle className="warning-icon" />
          <strong>Missed - Please Reschedule</strong>
        </div>
      )}

      {!item.completed && onMark && (
        <button className="action-button" onClick={() => onMark(item.id)}>
          <FaCheckCircle /> Mark as Completed
        </button>
      )}
    </div>
  );
};

export default TrackCollection;
