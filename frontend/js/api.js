/* api.js — HTTP API client with JWT auth */
const API = (() => {
  function getToken() { return sessionStorage.getItem('pf_token'); }

  async function request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
      sessionStorage.removeItem('pf_token');
      window.dispatchEvent(new CustomEvent('auth:expired'));
      throw new Error('Unauthorized');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  return {
    get:    (path)         => request('GET', path),
    post:   (path, body)   => request('POST', path, body),
    put:    (path, body)   => request('PUT', path, body),
    delete: (path)         => request('DELETE', path),

    // Auth
    login:          (username, password) => request('POST', '/api/auth/login', { username, password }),
    logout:         ()                   => request('POST', '/api/auth/logout'),
    me:             ()                   => request('GET',  '/api/auth/me'),
    changePassword: (currentPassword, newPassword) =>
                                            request('PUT',  '/api/auth/password', { currentPassword, newPassword }),

    // Users (admin)
    getUsers:          ()             => request('GET',    '/api/users'),
    createUser:        (data)         => request('POST',   '/api/users', data),
    deleteUser:        (id)           => request('DELETE', `/api/users/${id}`),
    adminResetPassword:(id, password) => request('PUT',    `/api/users/${id}/password`, { password }),

    // Printers
    getPrinters:     ()                  => request('GET',    '/api/printers'),
    addPrinter:      (data)              => request('POST',   '/api/printers', data),
    deletePrinter:   (id)                => request('DELETE', `/api/printers/${id}`),
    getPrinterState: (id)                => request('GET',    `/api/printers/${id}/state`),
    sendCommand:     (id, cmd, params)   => request('POST',   `/api/printers/${id}/command`, { command: cmd, params }),

    // Streams / Cameras
    getCameras:      ()    => request('GET',    '/api/streams'),
    addCamera:       (data)=> request('POST',   '/api/streams', data),
    addBambuCamera:  (pid) => request('POST',   '/api/streams/bambu', { printerId: pid }),
    deleteCamera:    (id)  => request('DELETE', `/api/streams/${id}`),

    setToken:  (t) => sessionStorage.setItem('pf_token', t),
    clearToken: () => sessionStorage.removeItem('pf_token'),
    hasToken:  ()  => !!sessionStorage.getItem('pf_token'),
  };
})();
