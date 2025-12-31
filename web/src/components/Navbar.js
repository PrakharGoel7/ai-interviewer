import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import logoUrl from '../assets/logo.svg';
export default function Navbar() {
    const { user, signOut, loading } = useAuth();
    const navigate = useNavigate();
    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };
    const initials = useMemo(() => {
        if (!user?.email)
            return 'MN';
        return user.email
            .split('@')[0]
            .split(/[.\-_]/)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join('');
    }, [user]);
    return (_jsx("header", { className: "nav-shell app-nav", children: _jsxs("div", { className: "nav-inner", children: [_jsx(Link, { to: "/", className: "nav-brand", "aria-label": "Minerva home", children: _jsx("img", { src: logoUrl, alt: "Minerva", className: "nav-logo" }) }), _jsxs("div", { className: "nav-right", children: [_jsxs("div", { className: "nav-links", children: [_jsx("a", { className: "nav-link", href: "/interview.html", children: "Start consulting case" }), _jsx("a", { className: "nav-link", href: "/ib_interview.html", children: "Start IB mock interview" }), _jsx(Link, { className: "nav-link", to: "/app/dashboard", children: "View progress" })] }), _jsx("div", { className: "nav-auth", children: _jsxs("div", { className: "account-pill", children: [_jsx("span", { className: "avatar", children: initials }), user ? (_jsx("button", { className: "nav-pill-btn", onClick: handleSignOut, children: "Sign out" })) : loading ? null : (_jsx(Link, { className: "nav-pill-btn", to: "/login", children: "Log in" }))] }) })] })] }) }));
}
