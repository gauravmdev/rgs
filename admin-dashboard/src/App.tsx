import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import StoresList from './pages/stores/StoresList';
import StaffList from './pages/staff/StaffList';
import CustomersList from './pages/customers/CustomersList';
import CustomerDetail from './pages/customers/CustomerDetail';
import OrdersList from './pages/orders/OrdersList';
import OrderDetail from './pages/orders/OrderDetail';
import LiveOrders from './pages/orders/LiveOrders';
import Analytics from './pages/analytics/Analytics';
import Reports from './pages/analytics/Reports';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />

        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'STORE_MANAGER']}>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/stores"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <Layout>
                <StoresList />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/staff"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <Layout>
                <StaffList />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/customers"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'STORE_MANAGER']}>
              <Layout>
                <CustomersList />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/customers/:id"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'STORE_MANAGER']}>
              <Layout>
                <CustomerDetail />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/orders"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'STORE_MANAGER']}>
              <Layout>
                <OrdersList />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/orders/live"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'STORE_MANAGER']}>
              <Layout>
                <LiveOrders />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/orders/:id"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'STORE_MANAGER']}>
              <Layout>
                <OrderDetail />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/analytics"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'STORE_MANAGER']}>
              <Layout>
                <Analytics />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'STORE_MANAGER']}>
              <Layout>
                <Reports />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
