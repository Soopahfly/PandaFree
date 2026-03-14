/* views/printer.js — Full printer detail view */
const PrinterView = (() => {
  let _currentId = null;
  let _peerConn = null;

  function open(printerId) {
    _currentId = printerId;
    render();
    showSection('printer');

    State.on('printerUpdate', onUpdate);
  }

  function close() {
    _currentId = null;
    State.off('printerUpdate', onUpdate);
    stopCamera();
  }

  function onUpdate({ id }) {
    if (id === _currentId) render();
  }

  function render() {
    if (!_currentId) return;
    const printers = State.getPrinters();
    const printer  = printers[_currentId];
    if (!printer) return;

    const state  = printer.state || {};
    const status = state.printStatus || 'offline';
    const pct    = state.progress || 0;

    // Header
    document.getElementById('printer-detail-name').textContent = printer.name;
    const badge = document.getElementById('printer-detail-badge');
    badge.textContent = status;
    badge.className = `status-badge ${statusBadgeClass(status)}`;

    const content = document.getElementById('printer-detail-content');
    content.innerHTML = `
      <div class="detail-grid">
        <!-- Camera -->
        <div class="detail-card glass-card detail-full">
          <h3>📷 Live Camera</h3>
          <div class="camera-wrapper" id="detail-camera-wrap">
            <div class="camera-offline"><span>📷</span><span>No camera configured</span></div>
          </div>
          <div style="margin-top:0.75rem;display:flex;gap:0.5rem;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" onclick="PrinterView.addBambuCam()">+ Add Bambu Camera</button>
          </div>
        </div>

        <!-- Print Progress -->
        <div class="detail-card glass-card">
          <h3>🖨 Print Progress</h3>
          <div style="display:flex;align-items:center;gap:1.25rem;margin-bottom:1rem">
            ${buildProgressRing(pct, status)}
            <div>
              <div style="font-size:0.875rem;color:var(--text-secondary);margin-bottom:0.25rem">${truncateFilename(state.fileName, 40)}</div>
              ${state.remainSecs > 0 ? `<div style="font-size:0.8rem">ETA: <strong>${formatTime(state.remainSecs)}</strong></div>` : ''}
            </div>
          </div>
          <div class="layer-bar-wrap">
            <div class="layer-bar-bg"><div class="layer-bar-fill" style="width:${pct}%"></div></div>
            <div class="layer-info">
              <span>Layer ${state.layer || 0} / ${state.totalLayers || 0}</span>
              <span>${pct}%</span>
            </div>
          </div>
          <div class="card-actions" style="margin-top:0.75rem">
            ${status === 'printing' ? `<button class="btn btn-ghost" onclick="PrinterView.cmd('pause')">⏸ Pause</button>` : ''}
            ${status === 'paused'   ? `<button class="btn btn-primary" onclick="PrinterView.cmd('resume')">▶ Resume</button>` : ''}
            ${(status==='printing'||status==='paused') ? `<button class="btn btn-danger" onclick="DashboardView.confirmStop('${_currentId}')">■ Stop</button>` : ''}
          </div>
        </div>

        <!-- Temperatures -->
        <div class="detail-card glass-card">
          <h3>🌡 Temperatures</h3>
          <div class="control-row">
            <span class="control-label">Nozzle</span>
            <div class="temp-control">
              <strong style="min-width:50px">${Math.round(state.nozzleTemp||0)}°C</strong>
              <input type="number" class="temp-input" id="temp-nozzle" value="${state.nozzleTempTarget||0}" min="0" max="300" />
              <button class="btn btn-ghost btn-sm" onclick="PrinterView.setTemp('nozzle')">Set</button>
            </div>
          </div>
          <div class="control-row">
            <span class="control-label">Bed</span>
            <div class="temp-control">
              <strong style="min-width:50px">${Math.round(state.bedTemp||0)}°C</strong>
              <input type="number" class="temp-input" id="temp-bed" value="${state.bedTempTarget||0}" min="0" max="120" />
              <button class="btn btn-ghost btn-sm" onclick="PrinterView.setTemp('bed')">Set</button>
            </div>
          </div>
          <div class="control-row">
            <span class="control-label">Chamber</span>
            <strong>${Math.round(state.chamberTemp||0)}°C</strong>
          </div>
        </div>

        <!-- Fan & Speed Controls -->
        <div class="detail-card glass-card">
          <h3>💨 Fan & Speed</h3>
          <div class="control-row">
            <span class="control-label">Part Fan</span>
            <div class="slider-wrap">
              <input type="range" id="fan-part" min="0" max="100" value="${state.fanSpeed||0}"
                onchange="PrinterView.setFan('part_fan',this.value)" oninput="this.nextElementSibling.textContent=this.value+'%'" />
              <span class="slider-val">${state.fanSpeed||0}%</span>
            </div>
          </div>
          <div class="control-row">
            <span class="control-label">Aux Fan</span>
            <div class="slider-wrap">
              <input type="range" id="fan-aux" min="0" max="100" value="${state.auxFanSpeed||0}"
                onchange="PrinterView.setFan('aux_fan',this.value)" oninput="this.nextElementSibling.textContent=this.value+'%'" />
              <span class="slider-val">${state.auxFanSpeed||0}%</span>
            </div>
          </div>
          <div style="margin-top:1rem">
            <div class="control-label" style="margin-bottom:0.5rem">Print Speed</div>
            <div class="speed-btns">
              ${[['1','🔇 Silent'],['2','⚡ Standard'],['3','🚀 Sport'],['4','🔥 Ludicrous']].map(([lvl,lbl])=>
                `<button class="speed-btn ${state.speedLevel==lvl?'active':''}" onclick="PrinterView.setSpeed(${lvl})">${lbl}</button>`
              ).join('')}
            </div>
          </div>
        </div>

        <!-- Light & Controls -->
        <div class="detail-card glass-card">
          <h3>💡 Controls</h3>
          <div class="control-row">
            <span class="control-label">Chamber Light</span>
            <label class="toggle-switch">
              <input type="checkbox" id="light-toggle" ${state.lightOn?'checked':''} onchange="PrinterView.setLight(this.checked)" />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- AMS -->
        <div class="detail-card glass-card">
          <h3>🧵 AMS Filament</h3>
          ${renderAms(state.ams)}
        </div>

        <!-- Errors -->
        <div class="detail-card glass-card">
          <h3>⚠ Errors</h3>
          ${renderErrors(state.errors)}
        </div>
      </div>
    `;

    // Init camera for this printer
    initCamera(printer);
  }

  function renderAms(ams) {
    if (!ams?.length) return '<p style="color:var(--text-muted);font-size:0.875rem">No AMS unit detected</p>';
    return ams.map(unit => `
      <div class="ams-unit">
        <h4>AMS Unit ${Number(unit.id)+1}</h4>
        <div class="ams-trays">
          ${Array.from({length:4},(_,i)=>{
            const t = unit.trays.find(tr=>String(tr.id)===String(i));
            if (!t) return `<div class="ams-tray ams-tray-empty"><div class="ams-tray-name">Empty</div></div>`;
            return `<div class="ams-tray">
              <div class="ams-tray-color" style="background:${t.color||'#444'}"></div>
              <div class="ams-tray-name" title="${escHtml(t.name)}">${escHtml(t.type||'–')}</div>
              <div class="ams-tray-remain">${t.remain??'?'}%</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    `).join('');
  }

  function renderErrors(errors) {
    if (!errors?.length) return '<p class="no-errors">✓ No errors</p>';
    return `<div class="error-list">${errors.map(e=>`<div class="error-item">${escHtml(e.msg)}</div>`).join('')}</div>`;
  }

  // Camera via go2rtc WebRTC
  function initCamera(printer) {
    const cameras = State.getCameras();
    const cam = cameras.find(c => c.printer_id === printer.id);
    const wrap = document.getElementById('detail-camera-wrap');
    if (!wrap) return;
    if (!cam) return;

    // go2rtc WebRTC player
    wrap.innerHTML = `
      <video id="camera-video" autoplay muted playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000"></video>
      <button class="camera-fullscreen-btn" onclick="document.getElementById('camera-video').requestFullscreen()">⛶ Fullscreen</button>
    `;

    // Connect to go2rtc WebRTC
    connectWebRTC(cam.id);
  }

  async function connectWebRTC(streamId) {
    stopCamera();
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      _peerConn = pc;

      pc.ontrack = (ev) => {
        const video = document.getElementById('camera-video');
        if (video && ev.streams[0]) video.srcObject = ev.streams[0];
      };

      // go2rtc WebRTC API
      const wsUrl = `${location.protocol==='https:'?'wss':'ws'}://${location.host}/streams/api/ws?src=${streamId}`;
      const ws = new WebSocket(wsUrl);
      ws.onopen = async () => {
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' }).catch(()=>{});
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: 'webrtc/offer', value: offer.sdp }));
      };
      ws.onmessage = async (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'webrtc/answer') {
          await pc.setRemoteDescription({ type: 'answer', sdp: msg.value });
        } else if (msg.type === 'webrtc/candidate') {
          await pc.addIceCandidate({ candidate: msg.value, sdpMid: msg.sdpMid ?? '0' });
        }
      };
      pc.onicecandidate = (ev) => {
        if (ev.candidate && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'webrtc/candidate', value: ev.candidate.candidate, sdpMid: ev.candidate.sdpMid }));
        }
      };
    } catch (e) {
      console.warn('[Camera] WebRTC error:', e);
    }
  }

  function stopCamera() {
    if (_peerConn) { _peerConn.close(); _peerConn = null; }
  }

  async function addBambuCam() {
    if (!_currentId) return;
    try {
      const cam = await API.addBambuCamera(_currentId);
      State.addCamera(cam);
      initCamera(State.getPrinters()[_currentId]);
      showToast('Bambu camera added');
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function cmd(command, params = {}) {
    if (!_currentId) return;
    try {
      await API.sendCommand(_currentId, command, params);
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  function setSpeed(level) { cmd('setSpeedLevel', { level }); }
  function setLight(on)    { cmd('setLight', { on }); }
  function setFan(fanType, speed) { cmd('setFanSpeed', { fanType, speed: Number(speed) }); }
  function setTemp(type) {
    const val = Number(document.getElementById(`temp-${type}`)?.value);
    if (isNaN(val)) return;
    cmd('setTemperature', { type, temp: val });
    showToast(`${type} target set to ${val}°C`);
  }

  return { open, close, render, cmd, setSpeed, setLight, setFan, setTemp, addBambuCam };
})();
