import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
    const basename = rawBase !== '/' && rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;
    return (_jsxs(BrowserRouter, { basename: basename || '/', children: [_jsx(Navbar, {}), _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: loading ? (_jsx("div", { className: "page-shell", children: "Checking session\u2026" })) : (_jsx(Navigate, { to: user ? '/dashboard' : '/login', replace: true })) }), _jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsx(Route, { path: "/signup", element: _jsx(Signup, {}) }), _jsx(Route, { path: "/report", element: _jsx(ReportPage, {}) }), _jsx(Route, { path: "/dashboard", element: _jsx(ProtectedRoute, { children: _jsx(Dashboard, {}) }) }), _jsx(Route, { path: "/cases/:id", element: _jsx(ProtectedRoute, { children: _jsx(CaseDetails, {}) }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] })] }));
}
export default App;
