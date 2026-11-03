/* RNA Router KRA panel — shortcut, health/models, automation status, config.
   Dimuat setelah app.js; wrapper fetch global menyisipkan sesi SIAS. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const state = { loaded: false, connected: false, healthy: false, appUrl: '' };
  const AUTOMATION_COMMAND = 'npm run rna-router:automation -- --once';

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
      throw new Error(payload.error || ('KRA RNA Router request failed (' + response.status + ').'));
    }
    return payload;
  }

  function setStatus(text, isError = false) {
    const target = $('rna-router-status');
    if (!target) return;
    target.textContent = text;
    target.classList.toggle('is-error', Boolean(isError));
  }

  function setConfigStatus(text, isError = false) {
    const target = $('rna-router-config-status');
    if (!target) return;
    target.textContent = text;
    target.classList.toggle('is-error', Boolean(isError));
  }

  function setConnection(connected, healthy) {
    const dot = $('kra-rna-dot');
    const card = $('rna-router-connection-status');
    const label = $('rna-router-connection-label');
    const menu = $('rna-router-menu-status');
    if (dot) {
      dot.classList.remove('is-online', 'is-offline', 'is-checking');
      dot.classList.add(connected ? (healthy ? 'is-online' : 'is-checking') : 'is-offline');
    }
    card?.classList.toggle('is-connected', Boolean(connected && healthy));
    const text = connected ? (healthy ? 'CONNECTED' : 'DEGRADED') : 'OFFLINE';
    if (label) label.textContent = text;
    if (menu) menu.textContent = text;
  }

  /** Sama seperti kebijakan shortcut N100N/GitHub Changer: hanya HTTPS publik,
   *  host yang sama, atau loopback/LAN yang ditulis ulang ke host halaman. */
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
    const link = $('rna-router-open-link');
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
    const grid = $('rna-router-grid');
    if (!grid) return;
    const event = status.lastEvent || {};
    const cells = [
      ['Service', status.version ? 'RNA Router v' + status.version : '—'],
      ['Health', status.healthy ? 'OK' : (status.ok ? 'DEGRADED' : 'OFFLINE')],
      ['Auto fallback', (status.features || []).some((f) => String(f).includes('fallback')) ? 'AKTIF' : 'tidak terdeteksi'],
      ['Provider model', (config && config.model) || 'muse-spark-1.2-free'],
      ['Automation', event.at ? timeLabel(event.at) : 'belum ada event'],
      ['Models on gateway', event.modelCount !== undefined ? String(event.modelCount) : '—'],
      ['Event bridge', (config && config.eventSecretConfigured) || status.eventSecretConfigured ? 'HMAC active' : 'not configured'],
      ['Last error', event.error || status.error || '—'],
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
    setStatus('Memeriksa gateway RNA Router dari server KRA…');
    const [statusResult, configResult] = await Promise.allSettled([
      api('rna-router-status'),
      api('rna-router-config'),
    ]);
    const config = configResult.status === 'fulfilled' ? (configResult.value.rnaRouter || {}) : null;
    if (statusResult.status === 'fulfilled') {
      const payload = statusResult.value;
      const status = payload.rnaRouter || {};
      state.connected = Boolean(payload.connected);
      state.healthy = Boolean(status.healthy);
      state.loaded = true;
      setAppLink(status.baseUrl || '');
      setConnection(state.connected, state.healthy);
      renderGrid(status, config);
      setStatus(payload.message || (state.connected ? 'RNA Router terhubung.' : 'Belum terhubung.'), !state.connected);
    } else {
      setStatus(statusResult.reason.message, true);
      setAppLink('');
      renderGrid({}, config);
    }
    if (config) {
      const url = $('rna-router-base-url');
      const model = $('rna-router-model');
      if (url && !url.value) url.value = config.baseUrl || 'http://127.0.0.1:3000';
      if (model && !model.value) model.value = config.model || 'muse-spark-1.2-free';
      setConfigStatus(config.environmentManaged
        ? 'Dikelola environment server; isian tersimpan tidak mengalahkan environment.'
        : (config.apiKeyConfigured ? 'Service key tersimpan di server KRA.' : 'Gateway dapat dipakai tanpa key (x-api-key opsional).'));
    } else {
      const form = $('rna-router-config-form');
      form?.querySelectorAll('input, button').forEach((element) => { element.disabled = true; });
      setConfigStatus('Pengaturan hanya untuk admin workspace: ' + configResult.reason.message, true);
    }
  }

  function openPanel() {
    const modal = $('rna-router-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    $('rna-router-close')?.focus();
    refresh();
  }

  function closePanel() {
    $('rna-router-modal')?.classList.add('hidden');
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
    const detail = $('rna-router-detail');
    if (!detail) return;
    detail.textContent = JSON.stringify(value, null, 2);
    detail.classList.remove('hidden');
  }

  function init() {
    $('kra-rna-router-open')?.addEventListener('click', async () => {
      if (!state.loaded) await refresh();
      if (state.connected && openApp()) return;
      openPanel();
    });
    $('btn-rna-router-settings')?.addEventListener('click', () => {
      $('settings-menu')?.classList.add('hidden');
      $('btn-settings-menu')?.setAttribute('aria-expanded', 'false');
      openPanel();
    });
    $('rna-router-close')?.addEventListener('click', closePanel);
    $('rna-router-modal')?.addEventListener('click', (event) => {
      if (event.target === $('rna-router-modal')) closePanel();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closePanel();
    });
    $('rna-router-open-link')?.addEventListener('click', (event) => {
      if (window.kraDesktop && typeof window.kraDesktop.openExternal === 'function') {
        event.preventDefault();
        openApp();
      }
    });
    $('rna-router-refresh')?.addEventListener('click', refresh);
    $('rna-router-models')?.addEventListener('click', async () => {
      setStatus('Memuat daftar model dari gateway…');
      try {
        const payload = await api('rna-router-models');
        showDetail({ count: payload.count, models: payload.models || [] });
        setStatus((payload.count || 0) + ' model tersedia di gateway.');
      } catch (error) {
        setStatus(error.message, true);
      }
    });
    $('rna-router-test-chat')?.addEventListener('click', async () => {
      if (!window.confirm('Kirim satu pesan uji ke RNA Router melalui server KRA? Ini memakai satu permintaan model.')) return;
      setStatus('Menjalankan test chat…');
      try {
        const payload = await api('rna-router-chat', {
          method: 'POST',
          body: JSON.stringify({ message: 'Balas satu kalimat singkat: KRA terhubung.' }),
        });
        showDetail({ model: payload.model, reply: payload.reply });
        setStatus('Balasan diterima dari model ' + (payload.model || 'default') + '.');
      } catch (error) {
        setStatus(error.message, true);
      }
    });
    $('rna-router-copy-command')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(AUTOMATION_COMMAND);
        setStatus('Perintah disalin: ' + AUTOMATION_COMMAND);
      } catch (_) {
        setStatus('Salin manual: ' + AUTOMATION_COMMAND, true);
      }
    });
    $('rna-router-config-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = $('rna-router-save');
      if (button) button.disabled = true;
      try {
        const payload = await api('rna-router-config', {
          method: 'POST',
          body: JSON.stringify({
            base_url: $('rna-router-base-url')?.value || '',
            model: $('rna-router-model')?.value || '',
            api_key: $('rna-router-api-key')?.value || '',
            clear_key: Boolean($('rna-router-clear-key')?.checked),
          }),
        });
        const keyInput = $('rna-router-api-key');
        if (keyInput) keyInput.value = '';
        const clearInput = $('rna-router-clear-key');
        if (clearInput) clearInput.checked = false;
        setConfigStatus(payload.message || 'Pengaturan tersimpan.');
        await refresh();
      } catch (error) {
        setConfigStatus(error.message, true);
      } finally {
        if (button) button.disabled = false;
      }
    });

    window.addEventListener('kra:tenant-ready', () => { if (!state.loaded) refresh(); });
    window.setTimeout(() => { if (!state.loaded) refresh(); }, 2800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
