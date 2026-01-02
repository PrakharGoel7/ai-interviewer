import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';

export default function Login() {
  const { signIn, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    document.title = 'Minerva | Login';
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      const redirect = searchParams.get('redirect');
      if (redirect) {
        window.location.replace(redirect);
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, authLoading, navigate, searchParams]);

  const handleSubmit = async (evt: FormEvent) => {
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

  return (
    <div className="auth-shell">
      <h1>Log in</h1>
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
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitLoading}>
          {submitLoading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p>
        Need an account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  );
}
