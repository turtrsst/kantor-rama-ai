/* GitHub Changer KRA bridge — shortcut, status panel, and server-side config.
   Loaded after app.js; the global fetch wrapper injects SIAS auth + workspace. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const state = { loaded: false, connected: false, configured: false, appUrl: '' };

  function authHeaders() {
    return typeof window.getAuthHeaders === 'function' ? window.getAuthHeaders(false) : {};
  }

  async function api(action, options = {}) {
    const { query, ...requestOptions } = options;
    const params = new URLSearchParams({ action });
    Object.entries(query || {}).forEach(([key, value]) => params.set(key, String(value)));
    const headers = Object.assign({}, authHeaders(), requestOptions.headers || {});
    if (requestOptions.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const response = await fetch('../api/index.php?' + params.toString(), Object.assign({}, requestOptions, { headers }));
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || ('KRA GitHub Changer request failed (' + response.status + ').'));
    }
    return payload;
  }

  function setStatus(text, isError = false) {
    const target = $('github-changer-status');
    if (!target) return;
    target.textContent = text;
    target.classList.toggle('is-error', Boolean(isError));
  }

  function setConfigStatus(text, isError = false) {
    const target = $('github-changer-config-status');
    if (!target) return;
    target.textContent = text;
    target.classList.toggle('is-error', Boolean(isError));
  }

  function setConnection(connected, configured) {
    const dot = document.querySelector('.kra-ghc-dot');
    const card = $('github-changer-connection-status');
    const label = $('github-changer-connection-label');
    const menu = $('github-changer-menu-status');
    const mode = connected ? 'is-online' : (configured ? 'is-offline' : 'is-checking');
    if (dot) {
      dot.classList.remove('is-online', 'is-offline', 'is-checking');
      dot.classList.add(mode);
    }
    card?.classList.toggle('is-connected', Boolean(connected));
    const text = connected ? 'CONNECTED' : (configured ? 'OFFLINE' : 'SETUP REQUIRED');
    if (label) label.textContent = text;
    if (menu) menu.textContent = text;
  }

  /* Only link public HTTPS services, the same host, or LAN endpoints on the
     same machine (loopback rewritten to the page host). Never credentialed,
     query, or fragment URLs. Sama dengan kebijakan shortcut N100N. */
  function safeAppUrl(baseUrl) {
    try {
      const url = new URL(String(baseUrl || ''));
      if (url.username || url.password || url.search || url.hash) return '';
      const isLoopback = (host) => host === 'localhost' || host.endsWith('.localhost')
        || host === '::1' || /^127\./.test(host);
      const isPrivate = (host) => isLoopback(host)
        || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
        || host.endsWith('.local');
      const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
      const pageHost = window.location.hostname.toLowerCase().replace(/^\[|\]$/g, '');
      const localService = isPrivate(host);
      const browserOnLan = isPrivate(pageHost);
      const httpLike = url.protocol === 'http:' || url.protocol === 'https:';
      const allowed = (url.protocol === 'https:' && !localService)
        || (host === pageHost && httpLike)
        || (localService && browserOnLan && httpLike);
      if (!allowed) return '';
      let target = url;
      if (isLoopback(host) && !isLoopback(pageHost) && host !== pageHost) {
        target = new URL(url.href);
        target.hostname = pageHost.includes(':') ? '[' + pageHost + ']' : pageHost;
      }
      return target.origin + target.pathname;
    } catch (_) {
      return '';
    }
  }

  function setAppLink(baseUrl) {
    const link = $('github-changer-open-link');
    if (!link) return;
    state.appUrl = safeAppUrl(baseUrl);
    link.href = state.appUrl || '#';
    link.classList.toggle('hidden', !state.appUrl);
  }

  function timeLabel(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value).slice(0, 24) : date.toLocaleString();
  }

  function renderGrid(status, config) {
    const grid = $('github-changer-grid');
    if (!grid) return;
    const service = status.githubChanger || {};
    const app = service.app || {};
    const automation = service.automation || {};
    const run = service.automationStatus || {};
    const event = status.lastEvent || {};
    const cells = [
      ['Service', app.name ? app.name + ' v' + (app.version || '?') : '—'],
      ['Repos scanned', typeof service.repoCount === 'number' ? String(service.repoCount) : '—'],
      ['GitHub login', service.authenticated ? 'ACTIVE' : (service.oauthReady ? 'CLIENT ID READY' : 'NOT SET')],
      ['Scheduler', automation.enabled ? 'ON · ' + (automation.action || 'pull') : 'OFF'],
      ['Branch guard', automation.branch || 'not set'],
      ['Last sync', event.at ? timeLabel(event.at) : (run.lastRunAt ? timeLabel(run.lastRunAt) : '—')],
      ['Sync result', event.at ? (event.ok || 0) + ' ok · ' + (event.failed || 0) + ' failed · ' + (event.skipped || 0) + ' skipped'
        : (run.lastResult ? (run.lastResult.ok || 0) + ' ok · ' + (run.lastResult.failed || 0) + ' failed' : '—')],
      ['Event bridge', (config && config.eventSecretConfigured) || status.eventSecretConfigured ? 'HMAC active' : 'not configured'],
    ];
    grid.replaceChildren(...cells.map(([label, value]) => {
      const cell = document.createElement('div');
      cell.className = 'kra-ghc-cell';
      const key = document.createElement('span');
      key.textContent = label;
      const val = document.createElement('strong');
      val.textContent = String(value);
      cell.append(key, val);
      return cell;
    }));
  }

  async function refresh() {
    setConnection(false, false);
    setStatus('Memeriksa koneksi server KRA ke GitHub Changer…');
    const [statusResult, configResult] = await Promise.allSettled([
      api('github-changer-status'),
      api('github-changer-config'),
    ]);
    if (statusResult.status === 'fulfilled') {
      const payload = statusResult.value;
      const status = payload.githubChanger || {};
      state.connected = Boolean(payload.connected);
      state.configured = Boolean(payload.configured);
      state.loaded = true;
      setAppLink(status.baseUrl || '');
      setConnection(state.connected, state.configured);
      renderGrid(status, configResult.status === 'fulfilled' ? configResult.value.githubChanger : null);
      setStatus(payload.message || (state.connected ? 'GitHub Changer terhubung.' : 'Belum terhubung.'), !state.connected);
    } else {
      setStatus(statusResult.reason.message, true);
      setConnection(false, false);
      setAppLink('');
    }
    if (configResult.status === 'fulfilled') {
      const config = configResult.value.githubChanger || {};
      const input = $('github-changer-base-url');
      if (input && !input.value) input.value = config.baseUrl || 'http://127.0.0.1:4173';
      setConfigStatus(config.environmentManaged
        ? 'Dikelola environment server; isian tersimpan tidak mengalahkan environment.'
        : (config.configured ? 'Service key tersimpan di server KRA dan tidak ditampilkan.' : 'Service key belum diset.'));
    } else {
      const form = $('github-changer-config-form');
      if (form) {
        form.querySelectorAll('input, button').forEach((element) => { element.disabled = true; });
      }
      setConfigStatus('Pengaturan koneksi hanya untuk admin workspace: ' + configResult.reason.message, true);
    }
  }

  function openPanel() {
    const modal = $('github-changer-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    $('github-changer-close')?.focus();
    refresh();
  }

  function closePanel() {
    $('github-changer-modal')?.classList.add('hidden');
  }

  function openApp() {
    if (!state.appUrl) return false;
    if (window.kraDesktop && typeof window.kraDesktop.openExternal === 'function') {
      window.kraDesktop.openExternal(state.appUrl);
    } else {
      window.open(state.appUrl, '_blank', 'noopener,noreferrer');
    }
    return true;
  }

  function showDetail(value) {
    const detail = $('github-changer-detail');
    if (!detail) return;
    detail.textContent = JSON.stringify(value, null, 2);
    detail.classList.remove('hidden');
  }

  function init() {
    const headerButton = $('kra-github-changer-open');
    const menuButton = $('btn-github-changer-settings');
    const link = $('github-changer-open-link');

    headerButton?.addEventListener('click', async () => {
      if (!state.loaded) await refresh();
      // Tombol akses langsung: bila service hidup, langsung buka dashboard.
      // Bila belum, buka panel supaya koneksi bisa disetel dulu.
      if (state.connected && openApp()) return;
      openPanel();
    });
    menuButton?.addEventListener('click', () => {
      $('settings-menu')?.classList.add('hidden');
      $('btn-settings-menu')?.setAttribute('aria-expanded', 'false');
      openPanel();
    });
    $('github-changer-close')?.addEventListener('click', closePanel);
    $('github-changer-modal')?.addEventListener('click', (event) => {
      if (event.target === $('github-changer-modal')) closePanel();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closePanel();
    });
    link?.addEventListener('click', (event) => {
      if (window.kraDesktop && typeof window.kraDesktop.openExternal === 'function') {
        event.preventDefault();
        openApp();
      }
    });

    $('github-changer-refresh')?.addEventListener('click', refresh);
    $('github-changer-inspect')?.addEventListener('click', async () => {
      setStatus('Memuat daftar repo dan riwayat dari GitHub Changer…');
      try {
        const [repos, activity] = await Promise.all([
          api('github-changer-repos'),
          api('github-changer-activity', { query: { limit: 8 } }),
        ]);
        showDetail({ repos: repos.repos || [], recentActivity: activity.entries || [] });
        setStatus((repos.count || 0) + ' repo terdeteksi, ' + (activity.entries || []).length + ' aktivitas terakhir.');
      } catch (error) {
        setStatus(error.message, true);
      }
    });
    $('github-changer-sync')?.addEventListener('click', async () => {
      if (!window.confirm('Jalankan sinkronisasi Git (fetch/pull/push) sekarang melalui GitHub Changer? Aksi ini dijalankan di mesin yang menjalankan service tersebut.')) return;
      setStatus('Menjalankan sinkronisasi…');
      try {
        const payload = await api('github-changer-sync', { method: 'POST', body: '{}' });
        showDetail(payload.result || payload);
        setStatus('Sinkronisasi selesai. Periksa ringkasan hasil di bawah, lalu tekan CHECK CONNECTION.');
        await refresh();
      } catch (error) {
        setStatus(error.message, true);
      }
    });

    $('github-changer-config-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = $('github-changer-save');
      if (button) button.disabled = true;
      try {
        const payload = await api('github-changer-config', {
          method: 'POST',
          body: JSON.stringify({
            base_url: $('github-changer-base-url')?.value || '',
            api_key: $('github-changer-api-key')?.value || '',
            clear_key: Boolean($('github-changer-clear-key')?.checked),
          }),
        });
        const keyInput = $('github-changer-api-key');
        if (keyInput) keyInput.value = '';
        const clearInput = $('github-changer-clear-key');
        if (clearInput) clearInput.checked = false;
        setConfigStatus(payload.message || 'Pengaturan tersimpan.');
        await refresh();
      } catch (error) {
        setConfigStatus(error.message, true);
      } finally {
        if (button) button.disabled = false;
      }
    });

    // Tunggu sesi workspace KRA siap sebelum memeriksa koneksi.
    window.addEventListener('kra:tenant-ready', () => { if (!state.loaded) refresh(); });
    window.setTimeout(() => { if (!state.loaded) refresh(); }, 2500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
