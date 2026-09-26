import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Ledger from './pages/Ledger';
import Transfers from './pages/Transfers';
import Receipts from './pages/Receipts';
import Deliveries from './pages/Deliveries';
import Adjustments from './pages/Adjustments';
import InventoryHealthPage from './pages/InventoryHealthPage';
import Alerts from './pages/Alerts';
import Settings from './pages/Settings';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/products" element={<Products />} />
        <Route path="/ledger" element={<Ledger />} />
        <Route path="/transfers" element={<Transfers />} />
        
        <Route path="/receipts" element={<Receipts />} />
        <Route path="/deliveries" element={<Deliveries />} />
        <Route path="/adjustments" element={<Adjustments />} />
        <Route path="/inventory-health" element={<InventoryHealthPage />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Router>
  );
}

export default App;
