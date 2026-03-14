/* views/settings.js — Printer & app settings */
const SettingsView = (() => {
  function render() {
    const content = document.getElementById('settings-content');
    if (!content) return;
    const printers = Object.values(State.getPrinters());
    content.innerHTML = `
      <div class="settings-section">
        <h3>🖨 Printers</h3>
        <div id="settings-printer-list">
          ${printers.length === 0
            ? '<p style="color:var(--text-muted);font-size:0.875rem">No printers added.</p>'
            : printers.map(renderPrinterRow).join('')}
        </div>
        <button class="btn btn-primary" style="margin-top:1rem" onclick="SettingsView.showAddPrinter()">+ Add Printer</button>
      </div>

      <div class="settings-section">
        <h3>ℹ About</h3>
        <div class="glass-card settings-card">
          <p style="font-size:0.875rem;color:var(--text-secondary);line-height:1.6">
            <strong style="color:var(--text-primary)">PandaFree</strong> — Open-source Bambu Labs printer dashboard.<br>
            Runs locally in Docker. Your data never leaves your network.<br>
            Requires <strong>LAN Mode + Developer Mode</strong> on your Bambu printer.
          </p>
        </div>
      </div>
    `;
  }

  function renderPrinterRow(printer) {
    const state = printer.state || {};
    const status = state.printStatus || 'offline';
    return `
      <div class="glass-card settings-card">
        <div class="printer-row">
          <span class="status-dot ${status === 'offline' ? 'dot-offline' : 'dot-online'}"></span>
          <div class="printer-row-info">
            <div class="printer-row-name">${escHtml(printer.name)}</div>
            <div class="printer-row-sub">${escHtml(printer.ip)} · Serial: ${escHtml(printer.serial)} · ${escHtml(printer.model||'Unknown')}</div>
          </div>
          <div class="printer-row-actions">
            <button class="btn btn-ghost btn-sm" onclick="API.addBambuCamera && SettingsView.addBambuCam('${printer.id}')">📷 Camera</button>
            <button class="btn btn-danger btn-sm" onclick="SettingsView.deletePrinter('${printer.id}')">Remove</button>
          </div>
        </div>
      </div>
    `;
  }

  function showAddPrinter() {
    showModal('Add Printer', `
      <div class="field-group">
        <label>Printer Name</label>
        <input id="m-p-name" type="text" placeholder="My Bambu X1C" />
      </div>
      <div class="field-group">
        <label>IP Address</label>
        <input id="m-p-ip" type="text" placeholder="192.168.1.xxx" />
      </div>
      <div class="field-group">
        <label>Serial Number</label>
        <input id="m-p-serial" type="text" placeholder="e.g. 01P00A123456789" />
        <small style="color:var(--text-muted);font-size:0.75rem">Found on the printer screen under Settings → Device</small>
      </div>
      <div class="field-group">
        <label>Access Code</label>
        <input id="m-p-code" type="text" placeholder="8-digit code" />
        <small style="color:var(--text-muted);font-size:0.75rem">Found in Settings → Network → LAN</small>
      </div>
      <div class="field-group">
        <label>Model (optional)</label>
        <select id="m-p-model">
          <option value="Unknown">Unknown</option>
          <option value="X1C">X1C</option><option value="X1E">X1E</option>
          <option value="P1S">P1S</option><option value="P1P">P1P</option>
          <option value="A1">A1</option><option value="A1 Mini">A1 Mini</option>
          <option value="H2D">H2D</option>
        </select>
      </div>
      <div id="m-p-error" class="alert alert-error" hidden></div>
    `, [
      { label: 'Cancel',      className: 'btn-ghost',   handler: closeModal },
      { label: 'Add Printer', className: 'btn-primary', handler: addPrinter },
    ]);
  }

  async function addPrinter() {
    const errEl = document.getElementById('m-p-error');
    const data = {
      name:       document.getElementById('m-p-name')?.value.trim(),
      ip:         document.getElementById('m-p-ip')?.value.trim(),
      serial:     document.getElementById('m-p-serial')?.value.trim(),
      accessCode: document.getElementById('m-p-code')?.value.trim(),
      model:      document.getElementById('m-p-model')?.value,
    };
    if (!data.name || !data.ip || !data.serial || !data.accessCode) {
      errEl.textContent = 'All fields except model are required'; errEl.hidden = false; return;
    }
    try {
      const printer = await API.addPrinter(data);
      State.addPrinterEntry(printer);
      closeModal();
      render();
      showToast(`${data.name} added`);
    } catch (e) { errEl.textContent = e.message; errEl.hidden = false; }
  }

  async function deletePrinter(id) {
    const printer = State.getPrinter(id);
    showModal('Remove Printer', `<p>Remove <strong>${escHtml(printer?.name || 'this printer')}</strong>? The printer will be disconnected.</p>`, [
      { label: 'Cancel', className: 'btn-ghost', handler: closeModal },
      { label: 'Remove', className: 'btn-danger', handler: async () => {
        try {
          await API.deletePrinter(id);
          State.removePrinterEntry(id);
          closeModal();
          render();
          showToast('Printer removed');
        } catch (e) { showToast(e.message, 'error'); }
      }},
    ]);
  }

  async function addBambuCam(printerId) {
    try {
      const cam = await API.addBambuCamera(printerId);
      State.addCamera(cam);
      showToast('Bambu camera configured');
    } catch (e) { showToast(e.message, 'error'); }
  }

  function init() {
    State.on('printers', render);
    render();
  }

  return { init, render, showAddPrinter, deletePrinter, addBambuCam };
})();
