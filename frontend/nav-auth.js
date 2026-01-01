(function () {
  const PROJECT_REF = 'xwsnzgqazbswuafmpigp';
  const AUTH_STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;

  function getSession() {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.access_token) return parsed;
      if (parsed?.currentSession?.access_token) return parsed.currentSession;
      if (parsed?.session?.access_token) return parsed.session;
      return null;
    } catch (err) {
      console.warn('Unable to parse Supabase session', err);
      return null;
    }
  }

  function updateAuthUI() {
    const session = getSession();
    const hasSession = Boolean(session?.access_token);
    const authLink = document.querySelector('[data-auth-link]');
    if (authLink) {
      if (hasSession) {
        authLink.textContent = 'Progress dashboard';
        authLink.setAttribute('href', '/app/');
      } else {
        const redirect = encodeURIComponent(window.location.pathname);
        authLink.textContent = 'Log in';
        authLink.setAttribute('href', `/app/login?redirect=${redirect}`);
      }
    }
    document.querySelectorAll('[data-auth-visible="true"]').forEach((el) => {
      el.classList.toggle('hidden', !hasSession);
    });
  }

  document.addEventListener('DOMContentLoaded', updateAuthUI);
  window.addEventListener('storage', (event) => {
    if (event.key === AUTH_STORAGE_KEY) {
      updateAuthUI();
    }
  });
})();
