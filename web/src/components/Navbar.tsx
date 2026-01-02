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

  const isActive = (paths: string[]) => paths.some((path) => location.pathname === path);

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
    if (location.pathname.includes('ib')) return 'ib';
    if (location.pathname.includes('interview')) return 'consulting';
    return null;
  }, [location.pathname]);

  return (
    <header className="nav-shell app-nav">
      <div className="nav-inner">
        <a href="/" className="nav-brand" aria-label="Minerva home">
          <img src={logoUrl} alt="Minerva" className="nav-logo" />
        </a>
        <nav className="nav-links" aria-label="Primary navigation">
          <div className="practice-toggle" role="group" aria-label="Practice mode">
            {practiceOptions.map((option) => (
              <a
                key={option.key}
                href={option.href}
                className={practiceActive === option.key ? 'practice-link active' : 'practice-link'}
              >
                <span className="chip-icon" aria-hidden="true">
                  <option.icon />
                </span>
                <span>{option.label}</span>
              </a>
            ))}
          </div>
          <Link
            to="/app/dashboard"
            className={isActive(['/app/dashboard']) ? 'nav-link active' : 'nav-link'}
          >
            <span className="chip-icon" aria-hidden="true">
              <ChartIcon />
            </span>
            <span>Progress Dashboard</span>
          </Link>
        </nav>
        <div className="nav-user">
          {user ? (
            <button type="button" className="nav-login-btn" onClick={handleSignOut}>
              <span className="chip-icon" aria-hidden="true">
                <LockIcon />
              </span>
              <span>Sign out</span>
            </button>
          ) : loading ? null : (
            <Link className="nav-login-btn" to="/login">
              <span className="chip-icon" aria-hidden="true">
                <LockIcon />
              </span>
              <span>Sign in</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

const BriefcaseIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M3 13h18" />
  </svg>
);

const LightbulbIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M7 9a5 5 0 1 1 10 0c0 1.7-.8 3.2-2.2 4.2-.5.4-.8 1-.8 1.6V17h-4v-2.2c0-.6-.3-1.2-.8-1.6A5 5 0 0 1 7 9z" />
  </svg>
);

const ChartIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 3v18h18" />
    <rect x="7" y="10" width="3" height="7" rx="0.5" />
    <rect x="12" y="6" width="3" height="11" rx="0.5" />
    <rect x="17" y="12" width="3" height="5" rx="0.5" />
  </svg>
);

const LockIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="5" y="10" width="14" height="11" rx="2" />
    <path d="M7 10V7a5 5 0 0 1 10 0v3" />
    <path d="M12 16v2" />
  </svg>
);
