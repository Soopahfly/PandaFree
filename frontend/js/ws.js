/* ws.js — WebSocket manager for real-time printer updates */
const WS = (() => {
  let socket = null;
  let reconnectTimer = null;
  let reconnectDelay = 2000;
  const MAX_DELAY = 30000;

  function setStatus(connected) {
    const dots  = document.querySelectorAll('#ws-dot, #ws-dot-mobile');
    const label = document.getElementById('ws-label');
    dots.forEach(d => {
      d.className = 'status-dot ' + (connected ? 'dot-online' : 'dot-offline');
    });
    if (label) label.textContent = connected ? 'Live' : 'Reconnecting…';
  }

  function connect() {
    const token = sessionStorage.getItem('pf_token');
    if (!token) return;

    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}/ws?token=${encodeURIComponent(token)}`;

    socket = new WebSocket(url);

    socket.onopen = () => {
      console.log('[WS] Connected');
      setStatus(true);
      reconnectDelay = 2000;
    };

    socket.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'full_state') {
          // Full state dump on connect: msg.payload is { printerId: stateObj }
          Object.entries(msg.payload).forEach(([id, state]) => {
            State.updatePrinter(id, state);
          });
        } else if (msg.type === 'printer_update') {
          State.updatePrinter(msg.printerId, msg.payload);
        }
      } catch (e) {
        console.warn('[WS] Parse error', e);
      }
    };

    socket.onerror = () => {};
    socket.onclose = () => {
      setStatus(false);
      scheduleReconnect();
    };
  }

  function scheduleReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      if (API.hasToken()) connect();
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
  }

  function disconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    socket?.close();
    socket = null;
    setStatus(false);
  }

  return { connect, disconnect };
})();
