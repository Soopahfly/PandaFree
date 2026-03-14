/* app.js — Main SPA router & bootstrap */
const App = (() => {
  function showLoginView() {
    document.getElementById('view-login').classList.add('active');
    document.getElementById('view-app').classList.remove('active');
  }
  function showAppView() {
    document.getElementById('view-login').classList.remove('active');
    document.getElementById('view-app').classList.add('active');
  }

  async function onLogin(loginData) {
    if (loginData) State.setUser(loginData);
    showAppView();
    await loadInitialData();
    WS.connect();
    navigate(location.hash || '#dashboard');
  }

  async function logout() {
    try { await API.logout(); } catch {}
    API.clearToken();
    WS.disconnect();
    showLoginView();
    location.hash = '';
  }

  async function loadInitialData() {
    try {
      const [printers, cameras] = await Promise.all([API.getPrinters(), API.getCameras()]);
      State.setPrinters(printers);
      State.setCameras(cameras);
    } catch (e) {
      showToast('Failed to load data: ' + e.message, 'error');
    }
  }

  function navigate(hash) {
    const route = hash.replace('#', '') || 'dashboard';
    const mainRoutes = ['dashboard', 'cameras', 'settings', 'account'];

    if (mainRoutes.includes(route)) {
      if (route === 'dashboard') DashboardView.render();
      if (route === 'cameras')   CamerasView.render();
      if (route === 'settings')  SettingsView.render();
      if (route === 'account')   AccountView.onActivate();
      showSection(route);
    }
  }

  function openPrinter(id) {
    PrinterView.open(id);
    // No hash change for detail view
  }

  // Mobile sidebar toggle
  let overlay;
  function initSidebar() {
    const toggleBtn = document.getElementById('menu-toggle');
    const sidebar   = document.getElementById('sidebar');
    overlay = document.createElement('div');
    overlay.id = 'sidebar-overlay';
    document.body.appendChild(overlay);

    toggleBtn?.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('visible');
    });
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('visible');
    });
  }

  function closeMobileSidebar() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('visible');
  }

  async function init() {
    // Init view modules
    LoginView.init();
    DashboardView.init();
    CamerasView.init();
    SettingsView.init();
    AccountView.init();
    initSidebar();

    // Nav link clicks
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => { closeMobileSidebar(); });
    });

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', logout);

    // Back button in printer detail
    document.getElementById('printer-back-btn')?.addEventListener('click', () => {
      PrinterView.close();
      showSection('dashboard');
      location.hash = '#dashboard';
    });

    // Hash routing
    window.addEventListener('hashchange', () => {
      if (API.hasToken()) navigate(location.hash);
    });

    // Auth expired
    window.addEventListener('auth:expired', () => {
      WS.disconnect();
      showLoginView();
      showToast('Session expired, please log in again', 'warn');
    });

    // Restore session
    if (API.hasToken()) {
      try {
        const me = await API.me();
        State.setUser(me);
        showAppView();
        await loadInitialData();
        WS.connect();
        navigate(location.hash || '#dashboard');
      } catch {
        API.clearToken();
        showLoginView();
      }
    } else {
      showLoginView();
    }
  }

  return { init, onLogin, logout, openPrinter, navigate };
})();
window.App = App;

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
