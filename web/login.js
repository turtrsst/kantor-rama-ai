'use strict';

document.getElementById('login-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const errorDiv = document.getElementById('login-error');
  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = true;

  try {
    const response = await fetch('../api/index.php?action=login', {
      method: 'POST',
      body: formData,
      credentials: 'same-origin'
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'Gagal login');
    // Session storage survives refreshes in this tab and is cleared when the tab closes.
    sessionStorage.setItem('kra_auth_token', result.token);
    sessionStorage.setItem('kra_active_user', JSON.stringify(result.user));
    window.location.assign('index.html');
  } catch (error) {
    errorDiv.textContent = error.message || 'Gagal menghubungi server';
    errorDiv.style.display = 'block';
  } finally {
    if (button) button.disabled = false;
  }
});
