// src/App.js
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
} from 'react-router-dom';

import Login from './modules/Auth/Login';
import ForgotPassword from './modules/Auth/ForgotPassword';
import ResetPassword from './modules/Auth/ResetPassword';
import FirstTimeSetup from './modules/Auth/FirstTimeSetup';

import UserManagement from './modules/Users/UserManagement';
import CompanyManagement from './modules/Companies/CompanyManagement';
import BankManagement from './modules/Banks/BankManagement';
import CostCentreManagement from './modules/CostCentres/CostCentreManagement';
import TransactionTypeManagement from './modules/TransactionTypes/TransactionTypeManagement';
import Dashboard from './modules/Dashboard/Dashboard';
import ProjectManagement from './modules/Projects/ProjectManagement';
import PropertyManagement from './modules/Properties/PropertyManagement';
import EntityManagement from './modules/Entities/EntityManagement';
import ReceiptManagement from './modules/Receipts/ReceiptManagement';
import AssetManagement from './modules/Assets/AssetManagement';
import ContactManagement from './modules/Contacts/ContactManagement';
import VendorManagement from './modules/Vendors/VendorManagement';
import ContractManagement from './modules/Contracts/ContractManagement';
import CashLedgerManagement from './modules/CashLedger/CashLedgerManagement';
import EntityWiseReport from './modules/reports/EntityWiseReport';
import BankUploadManagement from './modules/BankUploads/BankUploadManagement';
import TxClassifyPage from './modules/TxClassify/TxClassifyPage';

import ProtectedRoute from './routes/ProtectedRoute';
import Sidebar from './components/Slidebar';
import Header from './components/header';
import ContractDetails from './modules/Contracts/ContractDetails';
import AnalyticsManagement from './modules/analytics/analyticsManagement';

// Smarter post-login redirect based on role
function AuthGate() {
  const token =
    localStorage.getItem('access') ||
    sessionStorage.getItem('access') ||
    localStorage.getItem('token') ||
    sessionStorage.getItem('token');

  if (!token) return <Login />;

  const getRole = () => {
    const r = localStorage.getItem('role');
    if (r) return r;
    if (token && token.split('.').length === 3) {
      try {
        return JSON.parse(atob(token.split('.')[1])).role || null;
      } catch {}
    }
    return null;
  };

  const role = getRole();
  const defaultPathByRole = {
    SUPER_USER: '/dashboard',
    CENTER_HEAD: '/dashboard',
    ACCOUNTANT: '/dashboard',
    PROPERTY_MANAGER: '/projects',
  };

  return <Navigate to={defaultPathByRole[role] || '/projects'} replace />;
}

function AppContent() {
  const location = useLocation();

  // Hide nav/header on public auth pages
  const PUBLIC_NO_NAV = ['/', '/forgot-password', '/reset-password', '/first-time-setup'];
  const hideNavOnLogin = PUBLIC_NO_NAV.includes(location.pathname);

  return (
    <div style={{ display: 'flex' }}>
      {!hideNavOnLogin && <Sidebar />}
      <div style={{ flexGrow: 1, backgroundColor: '#F9FAFB', minHeight: '100vh' }}>
        {!hideNavOnLogin && <Header />}

        <Routes>
          {/* Public */}
          <Route path="/" element={<AuthGate />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/first-time-setup" element={<FirstTimeSetup />} />

          {/* Private */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute
                allowedRoles={['SUPER_USER', 'CENTER_HEAD', 'ACCOUNTANT']}
                redirectTo="/projects"
              >
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Users (only Super User) */}
          <Route
            path="/users"
            element={
              <ProtectedRoute allowedRoles={['SUPER_USER']}>
                <UserManagement />
              </ProtectedRoute>
            }
          />

          {/* Companies → SU/CH/AC */}
          <Route
            path="/companies"
            element={
              <ProtectedRoute allowedRoles={['SUPER_USER', 'CENTER_HEAD', 'ACCOUNTANT']}>
                <CompanyManagement />
              </ProtectedRoute>
            }
          />

          {/* Banks → SU/AC/CH */}
          <Route
            path="/banks"
            element={
              <ProtectedRoute allowedRoles={['SUPER_USER', 'ACCOUNTANT', 'CENTER_HEAD']}>
                <BankManagement />
              </ProtectedRoute>
            }
          />

          {/* Cost Centres → SU/AC/CH */}
          <Route
            path="/cost-centres"
            element={
              <ProtectedRoute allowedRoles={['SUPER_USER', 'ACCOUNTANT', 'CENTER_HEAD']}>
                <CostCentreManagement />
              </ProtectedRoute>
            }
          />

          {/* Transaction Types → SU/AC/CH */}
          <Route
            path="/transaction-types"
            element={
              <ProtectedRoute allowedRoles={['SUPER_USER', 'ACCOUNTANT', 'CENTER_HEAD']}>
                <TransactionTypeManagement />
              </ProtectedRoute>
            }
          />

          {/* Projects (all four can list) */}
          <Route
            path="/projects"
            element={
              <ProtectedRoute allowedRoles={['SUPER_USER', 'PROPERTY_MANAGER', 'CENTER_HEAD', 'ACCOUNTANT']}>
                <ProjectManagement />
              </ProtectedRoute>
            }
          />

          {/* Properties */}
          <Route
            path="/properties"
            element={
              <ProtectedRoute allowedRoles={['SUPER_USER', 'PROPERTY_MANAGER', 'CENTER_HEAD', 'ACCOUNTANT']}>
                <PropertyManagement />
              </ProtectedRoute>
            }
          />

          {/* Entities */}
          <Route
            path="/entities"
            element={
              <ProtectedRoute allowedRoles={['SUPER_USER', 'PROPERTY_MANAGER', 'CENTER_HEAD', 'ACCOUNTANT']}>
                <EntityManagement />
              </ProtectedRoute>
            }
          />

          {/* Receipts (keep SU only) */}
          <Route
            path="/receipts"
            element={
              <ProtectedRoute allowedRoles={['SUPER_USER']}>
                <ReceiptManagement />
              </ProtectedRoute>
            }
          />

          {/* Assets */}
          <Route
            path="/assets"
            element={
              <ProtectedRoute allowedRoles={['SUPER_USER', 'PROPERTY_MANAGER', 'CENTER_HEAD', 'ACCOUNTANT']}>
                <AssetManagement />
              </ProtectedRoute>
            }
          />

          {/* Contacts */}
          <Route
            path="/contacts"
            element={
              <ProtectedRoute allowedRoles={['SUPER_USER', 'CENTER_HEAD', 'PROPERTY_MANAGER', 'ACCOUNTANT']}>
                <ContactManagement />
              </ProtectedRoute>
            }
          />

          {/* Vendors */}
          <Route
            path="/vendors"
            element={
              <ProtectedRoute allowedRoles={['SUPER_USER', 'ACCOUNTANT', 'PROPERTY_MANAGER', 'CENTER_HEAD']}>
                <VendorManagement />
              </ProtectedRoute>
            }
          />

          {/* Contracts */}
          <Route
            path="/contracts"
            element={
              <ProtectedRoute allowedRoles={['SUPER_USER', 'PROPERTY_MANAGER', 'CENTER_HEAD', 'ACCOUNTANT']}>
                <ContractManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/contracts/:id"
            element={
              <ProtectedRoute allowedRoles={['SUPER_USER', 'PROPERTY_MANAGER', 'CENTER_HEAD', 'ACCOUNTANT']}>
                <ContractDetails />
              </ProtectedRoute>
            }
          />

          {/* Cash Ledger → include PM */}
          <Route
            path="/cash-ledger"
            element={
              <ProtectedRoute allowedRoles={['SUPER_USER', 'ACCOUNTANT', 'CENTER_HEAD', 'PROPERTY_MANAGER']}>
                <CashLedgerManagement />
              </ProtectedRoute>
            }
          />

          {/* Reports */}
          <Route
            path="/entity-report"
            element={
              <ProtectedRoute allowedRoles={['SUPER_USER', 'CENTER_HEAD', 'ACCOUNTANT']}>
                <EntityWiseReport />
              </ProtectedRoute>
            }
          />

          {/* Bank uploads & classify */}
          <Route
            path="/bank-uploads"
            element={
              <ProtectedRoute allowedRoles={['SUPER_USER', 'ACCOUNTANT', 'CENTER_HEAD']}>
                <BankUploadManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tx-classify"
            element={
              <ProtectedRoute allowedRoles={['SUPER_USER', 'ACCOUNTANT', 'CENTER_HEAD']}>
                <TxClassifyPage />
              </ProtectedRoute>
            }
          />

          {/* Analytics → SU/AC/CH */}
          <Route
            path="/analytics"
            element={
              <ProtectedRoute allowedRoles={['SUPER_USER', 'ACCOUNTANT', 'CENTER_HEAD']}>
                <AnalyticsManagement />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
