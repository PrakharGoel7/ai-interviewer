import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
export default function Signup() {
    const { signUp, user, loading } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState(null);
    const [submitLoading, setSubmitLoading] = useState(false);
    useEffect(() => {
        document.title = 'Minerva | Sign Up';
    }, []);
    useEffect(() => {
        if (!loading && user) {
            const redirect = searchParams.get('redirect');
            if (redirect) {
                window.location.replace(redirect);
            }
            else {
                navigate('/dashboard', { replace: true });
            }
        }
    }, [user, loading, navigate, searchParams]);
    const handleSubmit = async (evt) => {
        evt.preventDefault();
        if (password !== confirm) {
            setError('Passwords do not match');
            return;
        }
        setSubmitLoading(true);
        const { error } = await signUp(email, password);
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
    return (_jsxs("div", { className: "auth-shell", children: [_jsx("h1", { children: "Sign up" }), _jsxs("form", { onSubmit: handleSubmit, children: [_jsxs("label", { children: ["Email", _jsx("input", { type: "email", value: email, onChange: (e) => setEmail(e.target.value), required: true })] }), _jsxs("label", { children: ["Password", _jsx("input", { type: "password", value: password, onChange: (e) => setPassword(e.target.value), required: true })] }), _jsxs("label", { children: ["Confirm password", _jsx("input", { type: "password", value: confirm, onChange: (e) => setConfirm(e.target.value), required: true })] }), error && _jsx("p", { className: "error", children: error }), _jsx("button", { type: "submit", disabled: submitLoading, children: submitLoading ? 'Creating…' : 'Create account' })] }), _jsxs("p", { children: ["Already have an account? ", _jsx(Link, { to: "/login", children: "Log in" })] })] }));
}
