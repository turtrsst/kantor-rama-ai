'use strict';

document.getElementById('login-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const errorDiv = document.getElementById('login-error');
  const button = form.querySelector('button[type="submit"]');
  if (errorDiv) {
    errorDiv.textContent = '';
    errorDiv.style.display = 'none';
  }
  if (button) {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
  }

  try {
    const response = await fetch('../api/index.php?action=login', {
      method: 'POST',
      body: formData,
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' }
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'Gagal login');

    // SIAS password never enters browser storage; only the short-lived KRA session token does.
    sessionStorage.setItem('kra_auth_token', result.token);
    sessionStorage.setItem('kra_active_user', JSON.stringify(result.user));
    window.location.assign('index.html');
  } catch (error) {
    if (errorDiv) {
      errorDiv.textContent = error.message || 'Gagal menghubungi server';
      errorDiv.style.display = 'block';
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }
});
