import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.jsx'
import DashboardScreen from './pages/Dashboard.jsx';
import AddTruckScreen from './pages/Truck.jsx';
import TrackCollection from './pages/TrackCollection.jsx';
import Collectors from './pages/Collectors.jsx';
import Reports from './pages/Reports.jsx';
import Fleet from './pages/Fleet.jsx';
import DSS from './pages/DSS.jsx';


import Schedules from './pages/Schedules.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/dashboard" element={<DashboardScreen />} />
        <Route path="/truck" element={<AddTruckScreen />}/>
        <Route path="/track-collection" element={<TrackCollection />} />
        <Route path="/fleet" element={<Fleet />} />
        <Route path="/collectors" element={<Collectors />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/dss" element={<DSS />} />
        <Route path="/schedules" element={<Schedules />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
