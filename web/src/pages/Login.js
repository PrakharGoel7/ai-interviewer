import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
export default function Login() {
    const { signIn, user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [submitLoading, setSubmitLoading] = useState(false);
    useEffect(() => {
        document.title = 'Minerva | Login';
    }, []);
    useEffect(() => {
        if (!authLoading && user) {
            const redirect = searchParams.get('redirect');
            if (redirect) {
                window.location.replace(redirect);
            }
            else {
                navigate('/dashboard', { replace: true });
            }
        }
    }, [user, authLoading, navigate, searchParams]);
    const handleSubmit = async (evt) => {
        evt.preventDefault();
        setSubmitLoading(true);
        const { error } = await signIn(email, password);
        setSubmitLoading(false);
        if (error) {
            setError(error);
            return;
        }
        const redirect = searchParams.get('redirect');
        if (redirect) {
            window.location.assign(redirect);
            return;
        }
        navigate('/dashboard');
    };
    return (_jsxs("div", { className: "auth-shell", children: [_jsx("h1", { children: "Log in" }), _jsxs("form", { onSubmit: handleSubmit, children: [_jsxs("label", { children: ["Email", _jsx("input", { type: "email", value: email, onChange: (e) => setEmail(e.target.value), required: true })] }), _jsxs("label", { children: ["Password", _jsx("input", { type: "password", value: password, onChange: (e) => setPassword(e.target.value), required: true })] }), error && _jsx("p", { className: "error", children: error }), _jsx("button", { type: "submit", disabled: submitLoading, children: submitLoading ? 'Signing in…' : 'Sign in' })] }), _jsxs("p", { children: ["Need an account? ", _jsx(Link, { to: "/signup", children: "Sign up" })] })] }));
}
