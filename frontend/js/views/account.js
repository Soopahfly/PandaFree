/* views/account.js — Account & user management */
const AccountView = (() => {

  function render() {
    const content = document.getElementById('account-content');
    if (!content) return;
    const user = State.getUser();

    content.innerHTML = `
      <div class="settings-section">
        <h3>🔑 Change Password</h3>
        <div class="glass-card settings-card">
          <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:1rem">
            Signed in as <strong style="color:var(--text-primary)">${escHtml(user?.username || '')}</strong>
          </p>
          <div class="field-group">
            <label>Current Password</label>
            <input id="acc-cur-pw" type="password" autocomplete="current-password" placeholder="••••••••" />
          </div>
          <div class="field-group">
            <label>New Password</label>
            <input id="acc-new-pw" type="password" autocomplete="new-password" placeholder="Min 6 characters" />
          </div>
          <div class="field-group">
            <label>Confirm New Password</label>
            <input id="acc-conf-pw" type="password" autocomplete="new-password" placeholder="Repeat new password" />
          </div>
          <div id="acc-pw-error" class="alert alert-error" hidden></div>
          <div id="acc-pw-success" class="alert alert-success" hidden>Password changed successfully.</div>
          <button class="btn btn-primary" style="margin-top:0.5rem" onclick="AccountView.changePassword()">
            Update Password
          </button>
        </div>
      </div>

      ${user?.role === 'admin' ? renderUsersSection() : ''}
    `;
  }

  function renderUsersSection() {
    return `
      <div class="settings-section">
        <h3>👤 User Management</h3>
        <div id="users-list-container">
          <div class="glass-card settings-card" style="text-align:center;color:var(--text-muted)">Loading…</div>
        </div>
        <button class="btn btn-primary" style="margin-top:1rem" onclick="AccountView.showAddUser()">
          + Add User
        </button>
      </div>
    `;
  }

  function renderUserRow(u, currentUserId) {
    const isSelf = u.id === currentUserId;
    return `
      <div class="glass-card settings-card">
        <div class="printer-row">
          <div class="printer-row-info">
            <div class="printer-row-name">
              ${escHtml(u.username)}
              ${isSelf ? '<span style="font-size:0.7rem;background:var(--accent);color:#fff;border-radius:4px;padding:1px 6px;margin-left:6px">you</span>' : ''}
            </div>
            <div class="printer-row-sub">
              Role: <strong>${escHtml(u.role)}</strong>
            </div>
          </div>
          <div class="printer-row-actions">
            <button class="btn btn-ghost btn-sm" onclick="AccountView.showResetPassword('${u.id}','${escHtml(u.username)}')">
              Reset PW
            </button>
            <button class="btn btn-danger btn-sm" ${isSelf ? 'disabled title="Cannot delete own account"' : `onclick="AccountView.deleteUser('${u.id}','${escHtml(u.username)}')"`}>
              Remove
            </button>
          </div>
        </div>
      </div>
    `;
  }

  async function loadUsers() {
    const container = document.getElementById('users-list-container');
    if (!container) return;
    try {
      const users = await API.getUsers();
      const currentUser = State.getUser();
      if (users.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:0.875rem">No users found.</p>';
        return;
      }
      container.innerHTML = users.map(u => renderUserRow(u, currentUser?.id)).join('');
    } catch (e) {
      container.innerHTML = `<p style="color:var(--accent-danger);font-size:0.875rem">${escHtml(e.message)}</p>`;
    }
  }

  async function changePassword() {
    const errEl = document.getElementById('acc-pw-error');
    const okEl  = document.getElementById('acc-pw-success');
    errEl.hidden = true;
    okEl.hidden  = true;

    const cur  = document.getElementById('acc-cur-pw')?.value;
    const nw   = document.getElementById('acc-new-pw')?.value;
    const conf = document.getElementById('acc-conf-pw')?.value;

    if (!cur || !nw || !conf) { errEl.textContent = 'All fields are required.'; errEl.hidden = false; return; }
    if (nw !== conf)          { errEl.textContent = 'New passwords do not match.'; errEl.hidden = false; return; }
    if (nw.length < 6)        { errEl.textContent = 'New password must be at least 6 characters.'; errEl.hidden = false; return; }

    try {
      await API.changePassword(cur, nw);
      okEl.hidden = false;
      document.getElementById('acc-cur-pw').value = '';
      document.getElementById('acc-new-pw').value = '';
      document.getElementById('acc-conf-pw').value = '';
    } catch (e) {
      errEl.textContent = e.message;
      errEl.hidden = false;
    }
  }

  function showAddUser() {
    showModal('Add User', `
      <div class="field-group">
        <label>Username</label>
        <input id="m-u-name" type="text" placeholder="username" />
      </div>
      <div class="field-group">
        <label>Password</label>
        <input id="m-u-pass" type="password" placeholder="Min 6 characters" />
      </div>
      <div class="field-group">
        <label>Role</label>
        <select id="m-u-role">
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div id="m-u-error" class="alert alert-error" hidden></div>
    `, [
      { label: 'Cancel',   className: 'btn-ghost',   handler: closeModal },
      { label: 'Add User', className: 'btn-primary',  handler: addUser },
    ]);
  }

  async function addUser() {
    const errEl = document.getElementById('m-u-error');
    const username = document.getElementById('m-u-name')?.value.trim();
    const password = document.getElementById('m-u-pass')?.value;
    const role     = document.getElementById('m-u-role')?.value;
    if (!username || !password) { errEl.textContent = 'Username and password required.'; errEl.hidden = false; return; }
    try {
      await API.createUser({ username, password, role });
      closeModal();
      showToast(`User ${username} created`);
      loadUsers();
    } catch (e) { errEl.textContent = e.message; errEl.hidden = false; }
  }

  function showResetPassword(id, username) {
    showModal(`Reset Password — ${username}`, `
      <div class="field-group">
        <label>New Password</label>
        <input id="m-r-pass" type="password" placeholder="Min 6 characters" />
      </div>
      <div id="m-r-error" class="alert alert-error" hidden></div>
    `, [
      { label: 'Cancel', className: 'btn-ghost',   handler: closeModal },
      { label: 'Reset',  className: 'btn-primary',  handler: async () => {
        const errEl = document.getElementById('m-r-error');
        const password = document.getElementById('m-r-pass')?.value;
        if (!password || password.length < 6) { errEl.textContent = 'Min 6 characters.'; errEl.hidden = false; return; }
        try {
          await API.adminResetPassword(id, password);
          closeModal();
          showToast(`Password reset for ${username}`);
        } catch (e) { errEl.textContent = e.message; errEl.hidden = false; }
      }},
    ]);
  }

  function deleteUser(id, username) {
    showModal('Remove User', `<p>Remove user <strong>${escHtml(username)}</strong>? This cannot be undone.</p>`, [
      { label: 'Cancel', className: 'btn-ghost',  handler: closeModal },
      { label: 'Remove', className: 'btn-danger', handler: async () => {
        try {
          await API.deleteUser(id);
          closeModal();
          showToast(`User ${username} removed`);
          loadUsers();
        } catch (e) { showToast(e.message, 'error'); closeModal(); }
      }},
    ]);
  }

  function init() {
    State.on('user', () => render());
  }

  // Called when section becomes active
  function onActivate() {
    render();
    const user = State.getUser();
    if (user?.role === 'admin') loadUsers();
  }

  return { init, render, onActivate, changePassword, showAddUser, showResetPassword, deleteUser };
})();
