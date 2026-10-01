import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
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
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import ProtectedRoute from './components/common/ProtectedRoute';
import ErrorBoundary from './components/common/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <Toaster 
        position="top-right" 
        toastOptions={{
          className: 'text-sm font-semibold text-slate-900 shadow-xl border border-slate-100 rounded-xl',
          duration: 4000,
        }}
      />
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route element={<ProtectedRoute />}>
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
          </Route>
          {/* BUG-005 fix: 404 catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
