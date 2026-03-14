/* views/cameras.js — Camera management view */
const CamerasView = (() => {
  function render() {
    const cameras = State.getCameras();
    const grid = document.getElementById('cameras-grid');
    if (!grid) return;

    if (cameras.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">📷</div>
        <h3>No cameras configured</h3>
        <p>Add a Bambu built-in or external RTSP camera.</p>
      </div>`;
      return;
    }

    grid.innerHTML = cameras.map(cam => `
      <div class="glass-card camera-card">
        <div class="camera-card-header">
          <span class="camera-card-name">${escHtml(cam.name)}</span>
          <div style="display:flex;align-items:center;gap:0.5rem">
            <span class="camera-card-type">${cam.type}</span>
            <button class="btn btn-danger btn-sm" onclick="CamerasView.deleteCamera('${cam.id}')">Remove</button>
          </div>
        </div>
        <div class="camera-wrapper" id="cam-wrap-${cam.id}">
          <div class="camera-offline"><span>📷</span><span>Click "View" to open stream</span></div>
          <button class="camera-fullscreen-btn"
            onclick="CamerasView.openCameraStream('${cam.id}', this.closest('.camera-wrapper'))"
          >▶ View</button>
        </div>
      </div>
    `).join('');
  }

  function openCameraStream(camId, wrap) {
    wrap.innerHTML = `
      <video id="cam-video-${camId}" autoplay muted playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000"></video>
      <button class="camera-fullscreen-btn" onclick="document.getElementById('cam-video-${camId}').requestFullscreen()">⛶ Fullscreen</button>
    `;
    connectCameraWebRTC(camId);
  }

  async function connectCameraWebRTC(streamId) {
    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pc.ontrack = (ev) => {
        const video = document.getElementById(`cam-video-${streamId}`);
        if (video && ev.streams[0]) video.srcObject = ev.streams[0];
      };
      const wsUrl = `${location.protocol==='https:'?'wss':'ws'}://${location.host}/streams/api/ws?src=${streamId}`;
      const ws = new WebSocket(wsUrl);
      ws.onopen = async () => {
        pc.addTransceiver('video', { direction: 'recvonly' });
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: 'webrtc/offer', value: offer.sdp }));
      };
      ws.onmessage = async (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'webrtc/answer')    await pc.setRemoteDescription({ type: 'answer', sdp: msg.value });
        if (msg.type === 'webrtc/candidate') await pc.addIceCandidate({ candidate: msg.value, sdpMid: msg.sdpMid ?? '0' });
      };
      pc.onicecandidate = (ev) => {
        if (ev.candidate && ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: 'webrtc/candidate', value: ev.candidate.candidate, sdpMid: ev.candidate.sdpMid }));
      };
    } catch (e) { console.warn('[Camera]', e); }
  }

  function showAddModal() {
    showModal('Add Camera', `
      <div class="field-group">
        <label>Name</label>
        <input id="m-cam-name" type="text" placeholder="My IP Camera" />
      </div>
      <div class="field-group">
        <label>RTSP URL</label>
        <input id="m-cam-url" type="text" placeholder="rtsp://192.168.1.x:554/stream" />
      </div>
      <div class="field-group">
        <label>Associated Printer (optional)</label>
        <select id="m-cam-printer">
          <option value="">— None —</option>
          ${Object.values(State.getPrinters()).map(p=>`<option value="${p.id}">${escHtml(p.name)}</option>`).join('')}
        </select>
      </div>
      <div id="m-cam-error" class="alert alert-error" hidden></div>
    `, [
      { label: 'Cancel', className: 'btn-ghost', handler: closeModal },
      { label: 'Add Camera', className: 'btn-primary', handler: addCamera },
    ]);
  }

  async function addCamera() {
    const name = document.getElementById('m-cam-name')?.value.trim();
    const url  = document.getElementById('m-cam-url')?.value.trim();
    const printerId = document.getElementById('m-cam-printer')?.value || null;
    const errEl = document.getElementById('m-cam-error');
    if (!name || !url) { errEl.textContent = 'Name and URL are required'; errEl.hidden = false; return; }
    try {
      const cam = await API.addCamera({ name, url, printerId, type: 'rtsp' });
      State.addCamera(cam);
      closeModal();
      render();
      showToast('Camera added');
    } catch (e) { errEl.textContent = e.message; errEl.hidden = false; }
  }

  async function deleteCamera(id) {
    showModal('Remove Camera', '<p>Remove this camera stream?</p>', [
      { label: 'Cancel', className: 'btn-ghost', handler: closeModal },
      { label: 'Remove', className: 'btn-danger', handler: async () => {
        try {
          await API.deleteCamera(id);
          State.removeCamera(id);
          closeModal();
          render();
          showToast('Camera removed');
        } catch (e) { showToast(e.message, 'error'); }
      }},
    ]);
  }

  function init() {
    State.on('cameras', render);
    document.getElementById('add-camera-btn')?.addEventListener('click', showAddModal);
    render();
  }

  return { init, render, openCameraStream, deleteCamera, showAddModal };
})();
