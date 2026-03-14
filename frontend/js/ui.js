/* ui.js — Shared UI utilities */

// Toast notifications
function showToast(message, type = 'success', duration = 3500) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = { success: '✓', error: '✗', warn: '⚠' }[type] || '•';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Modal
function showModal(title, bodyHtml, actions = []) {
  const overlay = document.getElementById('modal-overlay');
  const box = document.getElementById('modal-box');
  box.innerHTML = `
    <div class="modal-title">${title}</div>
    <div class="modal-body">${bodyHtml}</div>
    <div class="modal-actions" id="modal-actions"></div>
  `;
  const actionsEl = box.querySelector('#modal-actions');
  actions.forEach(({ label, className, id, handler }) => {
    const btn = document.createElement('button');
    btn.className = `btn ${className || 'btn-ghost'}`;
    btn.textContent = label;
    if (id) btn.id = id;
    btn.addEventListener('click', () => {
      if (handler) handler();
    });
    actionsEl.appendChild(btn);
  });
  overlay.hidden = false;
}

function closeModal() {
  document.getElementById('modal-overlay').hidden = true;
}

document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

// Progress ring helper
function setProgressRing(svgFill, percent) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  svgFill.style.strokeDasharray = `${circ}`;
  svgFill.style.strokeDashoffset = `${offset}`;
}

// Format seconds to HH:MM
function formatTime(secs) {
  if (!secs || secs <= 0) return '--:--';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Truncate filename
function truncateFilename(name, max = 30) {
  if (!name) return '—';
  return name.length > max ? name.slice(0, max - 1) + '…' : name;
}

// Status badge class
function statusBadgeClass(status) {
  const map = {
    idle: 'badge-idle', printing: 'badge-printing', paused: 'badge-paused',
    finished: 'badge-finished', failed: 'badge-failed', offline: 'badge-offline',
    preparing: 'badge-preparing',
  };
  return map[status] || 'badge-offline';
}

// Build a progress ring SVG + center text
function buildProgressRing(percent, status) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  let ringClass = 'progress-ring-fill';
  if (status === 'paused')  ringClass += ' ring-paused';
  if (status === 'failed')  ringClass += ' ring-danger';
  return `
    <div class="progress-ring-container">
      <svg class="progress-ring-svg" width="96" height="96" viewBox="0 0 96 96">
        <circle class="progress-ring-track" cx="48" cy="48" r="${r}" />
        <circle class="${ringClass}" cx="48" cy="48" r="${r}"
          style="stroke-dasharray:${circ};stroke-dashoffset:${offset}" />
      </svg>
      <div class="progress-center">
        <span class="progress-pct">${percent}%</span>
        <span class="progress-status">${status}</span>
      </div>
    </div>
  `;
}

// View routing helper — show/hide sections
function showSection(name) {
  ['dashboard', 'printer', 'cameras', 'account', 'settings'].forEach(s => {
    const el = document.getElementById(`section-${s}`);
    if (el) el.hidden = s !== name;
  });
  // Update active nav link
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.view === name || (name === 'printer' && l.dataset.view === 'dashboard'));
  });
}
