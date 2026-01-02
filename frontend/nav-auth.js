(function () {
  const PROJECT_REF = 'xwsnzgqazbswuafmpigp';
  const AUTH_STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;
  const LOCK_ICON = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M7 10V7a5 5 0 0 1 10 0v3" />
      <path d="M12 16v2" />
    </svg>`;

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

  function attachLogoutHandler(chip, callback) {
    if (chip.__logoutHandler) return;
    chip.__logoutHandler = callback;
    chip.addEventListener('click', chip.__logoutHandler);
  }

  function detachLogoutHandler(chip) {
    if (chip.__logoutHandler) {
      chip.removeEventListener('click', chip.__logoutHandler);
      delete chip.__logoutHandler;
    }
  }

  function setLoginChipState(chip, { text, icon, href }) {
    const label = chip.querySelector('[data-login-text]');
    if (label) label.textContent = text;
    const iconSpan = chip.querySelector('[data-login-icon]');
    if (iconSpan) iconSpan.innerHTML = icon;
    if (href) chip.setAttribute('href', href);
    chip.classList.remove('hidden');
  }

  function updateAuthUI() {
    const session = getSession();
    const hasSession = Boolean(session?.access_token);
    const redirect = encodeURIComponent(window.location.pathname || '/');
    const progressHref = hasSession ? '/app/dashboard' : `/app/login?redirect=${redirect}`;

    document.querySelectorAll('[data-progress-link]').forEach((link) => {
      link.setAttribute('href', progressHref);
    });

    const loginChips = document.querySelectorAll('[data-login-chip]');

    if (hasSession) {
      const logoutHandler = (evt) => {
        evt.preventDefault();
        localStorage.removeItem(AUTH_STORAGE_KEY);
        updateAuthUI();
      };

      loginChips.forEach((chip) => {
        setLoginChipState(chip, { text: 'Sign out', icon: LOCK_ICON, href: '#' });
        attachLogoutHandler(chip, logoutHandler);
      });

    } else {
      loginChips.forEach((chip) => {
        detachLogoutHandler(chip);
        setLoginChipState(chip, {
          text: 'Sign in',
          icon: LOCK_ICON,
          href: `/app/login?redirect=${redirect}`,
        });
      });
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
