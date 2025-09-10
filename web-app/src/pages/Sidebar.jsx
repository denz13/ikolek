import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/firebase";
import Swal from "sweetalert2";

/* Icons */
import { MdDashboard } from "react-icons/md";
import { FaRoute } from "react-icons/fa";
import { FaTruck } from "react-icons/fa";
import { IoPeopleSharp, IoLogOut } from "react-icons/io5";
import { RiFeedbackFill } from "react-icons/ri";
import { AiFillSchedule } from "react-icons/ai";
import { MdOutlineAnalytics } from "react-icons/md"; 

import "./Sidebar.css";

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const onLogout = async () => {
  const result = await Swal.fire({
    title: "Logout?",
    text: "Are you sure you want to logout?",
    showCancelButton: true,
    confirmButtonText: "Yes, logout",
    cancelButtonText: "Cancel",
    confirmButtonColor: "#e53e3e",
    cancelButtonColor: "#2d6a4f", 
  });

  if (!result.isConfirmed) return;

  try {
    await signOut(auth);
    localStorage.clear();
    navigate("/", { replace: true });
  } catch (error) {
    console.error("❌ Error signing out:", error);
    Swal.fire("Error", "Something went wrong while logging out.", "error");
  }
};

  useEffect(() => {
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        const errorMessage = "You need to login first.";
        navigate(`/?error=${errorMessage}`, { replace: true });
      }
    });
  }, [navigate]);

  const routes = [
    { route: "dashboard", label: "Dashboard", icon: <MdDashboard className="icon dashboard-icon" /> },
    { route: "fleet", label: "Fleet Management", icon: <FaTruck className="icon" /> }, // trucks icon ✅
    { route: "collectors", label: "Add Collectors", icon: <IoPeopleSharp className="icon" /> },
    { route: "reports", label: "Reports", icon: <RiFeedbackFill className="icon" /> },
    { route: "dss", label: "DSS", icon: <MdOutlineAnalytics className="icon" /> },
    { route: "schedules", label: "Schedules", icon: <AiFillSchedule className="icon" /> },
  ];

  return (
    <div className="sidebar">
      <h2 className="sidebar-title">Admin Panel</h2>

      <div className="nav-section">
        {routes.map(({ route, label, icon }) => (
          <button
            key={route}
            className={`sidebar-button ${location.pathname === `/${route}` ? "active" : ""}`}
            onClick={() => navigate(`/${route}`)}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Footer pinned to bottom */}
      <div className="logout-section">
        <button className="logout-button" onClick={onLogout}>
          <IoLogOut className="icon" /> Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
