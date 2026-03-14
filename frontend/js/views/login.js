/* views/login.js */
const LoginView = (() => {
  function init() {
    const form = document.getElementById('login-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl  = document.getElementById('login-error');
      const btnTxt = document.getElementById('login-btn-text');
      const spinner = document.getElementById('login-spinner');
      errEl.hidden = true;
      btnTxt.hidden = true;
      spinner.hidden = false;
      document.getElementById('login-btn').disabled = true;

      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;

      try {
        const loginData = await API.login(username, password);
        API.setToken(loginData.token);
        window.App.onLogin(loginData);
      } catch (err) {
        errEl.textContent = err.message || 'Login failed';
        errEl.hidden = false;
      } finally {
        btnTxt.hidden = false;
        spinner.hidden = true;
        document.getElementById('login-btn').disabled = false;
      }
    });
  }

  return { init };
})();
