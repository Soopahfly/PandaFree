/* views/dashboard.js — Printer grid overview */
const DashboardView = (() => {
  function renderCard(printer) {
    const state = printer.state || {};
    const status = state.printStatus || 'offline';
    const pct    = state.progress || 0;
    const badge  = statusBadgeClass(status);

    return `
      <div class="printer-card status-${status}" data-printer-id="${printer.id}" role="button" tabindex="0">
        <div class="card-header">
          <div>
            <div class="card-name">${escHtml(printer.name)}</div>
            <div class="card-ip">${escHtml(printer.ip)} · ${escHtml(printer.serial || '')}</div>
          </div>
          <span class="status-badge ${badge}">${status}</span>
        </div>

        <div class="progress-ring-wrap">
          ${buildProgressRing(pct, status)}
          <div class="progress-filename">${truncateFilename(state.fileName)}</div>
        </div>

        <div class="temp-row">
          <div class="temp-item">
            <div class="temp-label">Nozzle</div>
            <div class="temp-value">${Math.round(state.nozzleTemp || 0)}°C</div>
            <div class="temp-target">/ ${Math.round(state.nozzleTempTarget || 0)}°</div>
          </div>
          <div class="temp-item">
            <div class="temp-label">Bed</div>
            <div class="temp-value">${Math.round(state.bedTemp || 0)}°C</div>
            <div class="temp-target">/ ${Math.round(state.bedTempTarget || 0)}°</div>
          </div>
          <div class="temp-item">
            <div class="temp-label">Chamber</div>
            <div class="temp-value">${Math.round(state.chamberTemp || 0)}°C</div>
            <div class="temp-target">&nbsp;</div>
          </div>
        </div>

        ${state.remainSecs > 0 ? `
          <div class="eta-row">ETA: <strong>${formatTime(state.remainSecs)}</strong>
          · Layer <strong>${state.layer || 0}</strong>/${state.totalLayers || 0}</div>
        ` : ''}

        ${renderAmsStrip(state.ams)}

        <div class="card-actions" onclick="event.stopPropagation()">
          ${status === 'printing' ? `<button class="btn btn-ghost btn-sm" onclick="DashboardView.cmd('${printer.id}','pause')">⏸ Pause</button>` : ''}
          ${status === 'paused'   ? `<button class="btn btn-primary btn-sm" onclick="DashboardView.cmd('${printer.id}','resume')">▶ Resume</button>` : ''}
          ${(status === 'printing' || status === 'paused') ? `<button class="btn btn-danger btn-sm" onclick="DashboardView.confirmStop('${printer.id}')">■ Stop</button>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="App.openPrinter('${printer.id}')">Details →</button>
        </div>
      </div>
    `;
  }

  function renderAmsStrip(ams) {
    if (!ams?.length) return '';
    const swatches = ams.flatMap(unit =>
      unit.trays.filter(t => t.color).map(t =>
        `<span class="ams-swatch" style="background:${t.color}" title="${escHtml(t.name)}"></span>`
      )
    ).join('');
    if (!swatches) return '';
    return `<div class="ams-strip">${swatches}</div>`;
  }

  function render() {
    const printers = Object.values(State.getPrinters());
    const grid = document.getElementById('dashboard-grid');
    const noMsg = document.getElementById('no-printers-msg');
    const countEl = document.getElementById('printer-count');

    if (!grid) return;

    countEl.textContent = `${printers.length} printer${printers.length !== 1 ? 's' : ''}`;

    if (printers.length === 0) {
      noMsg.hidden = false;
      grid.querySelectorAll('.printer-card').forEach(c => c.remove());
      return;
    }
    noMsg.hidden = true;

    // Diff update: rebuild all cards
    const existing = grid.querySelectorAll('.printer-card');
    existing.forEach(c => c.remove());

    printers.forEach(printer => {
      grid.insertAdjacentHTML('beforeend', renderCard(printer));
    });

    // Click/keyboard to open detail
    grid.querySelectorAll('.printer-card').forEach(card => {
      const id = card.dataset.printerId;
      card.addEventListener('click', () => App.openPrinter(id));
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter') App.openPrinter(id); });
    });
  }

  async function cmd(printerId, command, params = {}) {
    try {
      await API.sendCommand(printerId, command, params);
      showToast(`Command sent: ${command}`);
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  function confirmStop(printerId) {
    showModal('Stop Print', '<p>Are you sure you want to stop the current print job? This cannot be undone.</p>', [
      { label: 'Cancel',    className: 'btn-ghost', handler: closeModal },
      { label: 'Stop Print', className: 'btn-danger', handler: async () => {
        closeModal();
        await cmd(printerId, 'stop');
      }},
    ]);
  }

  function init() {
    State.on('printers', render);
    State.on('printerUpdate', render);
    render();
  }

  return { init, render, cmd, confirmStop };
})();

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
