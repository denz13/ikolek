import React, { useState, useEffect, useCallback } from "react";
import { collection, getDocs, setDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import Sidebar from "../pages/Sidebar";
import { FaTruck, FaEdit } from "react-icons/fa";
import { CiCircleList } from "react-icons/ci";
import { FaTrashCan } from "react-icons/fa6";
import "./Truck.css";

const AddTruckScreen = () => {
  const [truckId, setTruckId] = useState("");
  const [trucks, setTrucks] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTruckId, setSelectedTruckId] = useState(null);
  const [selectedTruckLabel, setSelectedTruckLabel] = useState("");

  const fetchTrucks = useCallback(async () => {
    const snapshot = await getDocs(collection(db, "trucks"));
    const truckList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setTrucks(truckList);
  }, []);

  useEffect(() => { fetchTrucks(); }, [fetchTrucks]);

  const handleAddOrUpdateTruck = async () => {
    if (!truckId.trim()) { alert("Please enter a Truck ID"); return; }
    const normalizedTruckId = truckId.trim();
    try {
      if (editingId) {
        await deleteDoc(doc(db, "trucks", editingId));
        await setDoc(doc(db, "trucks", normalizedTruckId), {
          truckId: normalizedTruckId,
          assignedRoutes: [],
          status: "logged_out",
        });
        setSuccessMessage("✅ Truck updated successfully!");
        setEditingId(null);
      } else {
        const docSnap = await getDocs(collection(db, "trucks"));
        if (docSnap.docs.some(doc => doc.id === normalizedTruckId)) {
          alert("❌ Truck ID already exists."); return;
        }
        await setDoc(doc(db, "trucks", normalizedTruckId), {
          truckId: normalizedTruckId,
          assignedRoutes: [],
          status: "logged_out",
        });
        setSuccessMessage("✅ Truck successfully added!");
      }
      setTruckId("");
      fetchTrucks();
      setTimeout(() => setSuccessMessage(""), 2000);
    } catch (error) { console.error(error); alert("Something went wrong."); }
  };

  const confirmEdit = () => { setTruckId(selectedTruckLabel); setEditingId(selectedTruckId); setShowEditModal(false); };
  const confirmDelete = async () => { try { await deleteDoc(doc(db, "trucks", selectedTruckId)); fetchTrucks(); setShowDeleteModal(false); setSuccessMessage("✅ Truck deleted successfully!"); setTimeout(() => setSuccessMessage(""),2000);} catch(e){console.error(e);} };
  const openEditModal = (truck) => { setSelectedTruckId(truck.id); setSelectedTruckLabel(truck.truckId); setShowEditModal(true); };
  const openDeleteModal = (truck) => { setSelectedTruckId(truck.id); setSelectedTruckLabel(truck.truckId); setShowDeleteModal(true); };

  return (
    <div className="add-truck-container">
      <Sidebar/>
      <div className="add-truck-grid">
        {successMessage && <div className="success-message">{successMessage}</div>}

        <div className="truck-list">
          <h3><CiCircleList style={{fontSize:"29px", marginRight:"10px"}}/>Truck List</h3>
          <div className="scrollContainer">
            {trucks.map(truck => (
              <div key={truck.id} className="truck-item">
                <span className="truck-text">{truck.truckId}</span>
                <div>
                  <button className="edit-btn" onClick={() => openEditModal(truck)}><FaEdit /></button>
                  <button className="delete-btn" onClick={() => openDeleteModal(truck)}><FaTrashCan /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2><FaTruck style={{marginRight:"10px"}}/> {editingId ? "Edit Truck" : "Add Truck"}</h2>
          <input type="text" placeholder="Enter Truck ID" value={truckId} onChange={e=>setTruckId(e.target.value)} />
          <button onClick={handleAddOrUpdateTruck}>{editingId ? "Update" : "Save"}</button>
        </div>
      </div>

      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Confirm Deletion</h3>
            <p>Delete truck: <strong>{selectedTruckLabel}</strong>?</p>
            <div className="modal-buttons">
              <button className="cancel-btn" onClick={()=>setShowDeleteModal(false)}>Cancel</button>
              <button className="confirm-btn" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Confirm Edit</h3>
            <p>Edit: <strong>{selectedTruckLabel}</strong>?</p>
            <div className="modal-buttons">
              <button className="cancel-btn" onClick={()=>setShowEditModal(false)}>Cancel</button>
              <button className="confirm-btn" onClick={confirmEdit}>Edit</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AddTruckScreen;
