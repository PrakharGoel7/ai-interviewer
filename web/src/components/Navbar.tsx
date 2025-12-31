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
    if (!user?.email) return 'MN';
    return user.email
      .split('@')[0]
      .split(/[.\-_]/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }, [user]);

  return (
    <header className="nav-shell app-nav">
      <div className="nav-inner">
        <Link to="/" className="nav-brand" aria-label="Minerva home">
          <img src={logoUrl} alt="Minerva" className="nav-logo" />
        </Link>
        <div className="nav-right">
          <div className="nav-links">
            <a className="nav-link" href="/interview.html">
              Start consulting case
            </a>
            <a className="nav-link" href="/ib_interview.html">
              Start IB mock interview
            </a>
            <Link className="nav-link" to="/app/dashboard">
              View progress
            </Link>
          </div>
          <div className="nav-auth">
            <div className="account-pill">
              <span className="avatar">{initials}</span>
              {user ? (
                <button className="nav-pill-btn" onClick={handleSignOut}>
                  Sign out
                </button>
              ) : loading ? null : (
                <Link className="nav-pill-btn" to="/login">
                  Log in
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
