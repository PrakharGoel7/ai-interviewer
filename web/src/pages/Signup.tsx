import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';

export default function Signup() {
  const { signUp, user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    document.title = 'Minerva | Sign Up';
  }, []);

  useEffect(() => {
    if (!loading && user) {
      const redirect = searchParams.get('redirect');
      if (redirect) {
        window.location.replace(redirect);
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, loading, navigate, searchParams]);

  const handleSubmit = async (evt: FormEvent) => {
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

  return (
    <div className="auth-shell">
      <h1>Sign up</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <label>
          Confirm password
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitLoading}>
          {submitLoading ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
