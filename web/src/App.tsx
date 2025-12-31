import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthProvider';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import CaseDetails from './pages/CaseDetails';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import ReportPage from './pages/ReportPage';

function App() {
  const { user, loading } = useAuth();
  const rawBase = import.meta.env.BASE_URL || '/';
  const basename =
    rawBase !== '/' && rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;

  return (
    <BrowserRouter basename={basename || '/'}>
      <Navbar />
      <Routes>
        <Route
          path="/"
          element={
            loading ? (
              <div className="page-shell">Checking session…</div>
            ) : (
              <Navigate to={user ? '/dashboard' : '/login'} replace />
            )
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/report" element={<ReportPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cases/:id"
          element={
            <ProtectedRoute>
              <CaseDetails />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
