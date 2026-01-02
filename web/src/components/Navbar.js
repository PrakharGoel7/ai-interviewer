import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import logoUrl from '../assets/logo.svg';
export default function Navbar() {
    const { user, signOut, loading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };
    const isActive = (paths) => paths.some((path) => location.pathname === path);
    const practiceOptions = [
        { key: 'consulting', label: 'Consulting Case', href: '/interview.html', icon: LightbulbIcon },
        {
            key: 'ib',
            label: 'Investment Banking Interview',
            href: '/ib_interview.html',
            icon: BriefcaseIcon,
        },
    ];
    const practiceActive = useMemo(() => {
        if (location.pathname.includes('ib'))
            return 'ib';
        if (location.pathname.includes('interview'))
            return 'consulting';
        return null;
    }, [location.pathname]);
    return (_jsx("header", { className: "nav-shell app-nav", children: _jsxs("div", { className: "nav-inner", children: [_jsx("a", { href: "/", className: "nav-brand", "aria-label": "Minerva home", children: _jsx("img", { src: logoUrl, alt: "Minerva", className: "nav-logo" }) }), _jsxs("nav", { className: "nav-links", "aria-label": "Primary navigation", children: [_jsx("div", { className: "practice-toggle", role: "group", "aria-label": "Practice mode", children: practiceOptions.map((option) => (_jsxs("a", { href: option.href, className: practiceActive === option.key ? 'practice-link active' : 'practice-link', children: [_jsx("span", { className: "chip-icon", "aria-hidden": "true", children: _jsx(option.icon, {}) }), _jsx("span", { children: option.label })] }, option.key))) }), _jsxs(Link, { to: "/app/dashboard", className: isActive(['/app/dashboard']) ? 'nav-link active' : 'nav-link', children: [_jsx("span", { className: "chip-icon", "aria-hidden": "true", children: _jsx(ChartIcon, {}) }), _jsx("span", { children: "Progress Dashboard" })] })] }), _jsx("div", { className: "nav-user", children: user ? (_jsxs("button", { type: "button", className: "nav-login-btn", onClick: handleSignOut, children: [_jsx("span", { className: "chip-icon", "aria-hidden": "true", children: _jsx(LockIcon, {}) }), _jsx("span", { children: "Sign out" })] })) : loading ? null : (_jsxs(Link, { className: "nav-login-btn", to: "/login", children: [_jsx("span", { className: "chip-icon", "aria-hidden": "true", children: _jsx(LockIcon, {}) }), _jsx("span", { children: "Sign in" })] })) })] }) }));
}
const BriefcaseIcon = () => (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("rect", { x: "3", y: "7", width: "18", height: "13", rx: "2" }), _jsx("path", { d: "M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }), _jsx("path", { d: "M3 13h18" })] }));
const LightbulbIcon = () => (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M9 18h6" }), _jsx("path", { d: "M10 22h4" }), _jsx("path", { d: "M7 9a5 5 0 1 1 10 0c0 1.7-.8 3.2-2.2 4.2-.5.4-.8 1-.8 1.6V17h-4v-2.2c0-.6-.3-1.2-.8-1.6A5 5 0 0 1 7 9z" })] }));
const ChartIcon = () => (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M3 3v18h18" }), _jsx("rect", { x: "7", y: "10", width: "3", height: "7", rx: "0.5" }), _jsx("rect", { x: "12", y: "6", width: "3", height: "11", rx: "0.5" }), _jsx("rect", { x: "17", y: "12", width: "3", height: "5", rx: "0.5" })] }));
const LockIcon = () => (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("rect", { x: "5", y: "10", width: "14", height: "11", rx: "2" }), _jsx("path", { d: "M7 10V7a5 5 0 0 1 10 0v3" }), _jsx("path", { d: "M12 16v2" })] }));
