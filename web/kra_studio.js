/* KRA Command Center — Fullscreen Autonomous Coding Workstation.
   Provides 10-view workspace, 212 tools catalog, model selector modal,
   subtask checklist tracker, reasoning cards, terminal peek, and browser controller. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const state = {
    open: false,
    view: 'chat',
    activeSessionId: 'session_audit_01',
    activeModel: '9router / combo-free',
    activeProvider: 'Antigravity',
    mode: 'Agent',
    tools: {},
    toolCount: 0,
    models: {},
    harnessProfiles: {},
    sessions: [],
    filesTree: [],
    selectedFilePath: 'Cargo.toml',
    selectedFileContent: '',
    projectRoot: '',
    filePath: '',
    terminalHistory: [
      { type: 'sys', text: 'KRA Command Center' },
      { type: 'sys', text: 'Authorized commands only (platform admin + loopback).' },
      { type: 'meta', text: 'Jalankan perintah allowlisted (php, node, git, npm) langsung di sini.' }
    ],
    browserStatus: { installed: false, binary: 'none', mode: 'unavailable', lastUrl: '' },
    sshHosts: [],
    sshStatus: null,
    terminalHost: '',
    authStatus: null,
    settings: {},
    sessionsMirrored: false,
    sessionMirror: '',
    githubReady: false,
    streaming: false,
    abortController: null,
    attachments: []
  };

  const SEND_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 7-7 7 7M12 5v14"/></svg>';
  const STOP_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>';

  // Composer reflects the run state: idle = Send, active = Stop.
  function syncComposerState() {
    const btn = $('ks-composer-send');
    if (!btn) return;
    const busy = Boolean(state.streaming);
    btn.classList.toggle('ks-stop', busy);
    btn.innerHTML = busy ? STOP_ICON : SEND_ICON;
    btn.title = busy ? 'Hentikan agent (Esc)' : 'Kirim (Ctrl+Enter)';
    btn.setAttribute('aria-label', busy ? 'Hentikan agent' : 'Kirim pesan');
    const wrap = $('ks-composer-box');
    if (wrap) wrap.classList.toggle('is-running', busy);
  }

  function authHeaders() {
    return typeof window.getAuthHeaders === 'function' ? window.getAuthHeaders(false) : {};
  }

  async function api(action, options = {}) {
    const { query, ...requestOptions } = options;
    const params = new URLSearchParams({ action });
    Object.entries(query || {}).forEach(([k, v]) => params.set(k, String(v)));
    const headers = Object.assign({}, authHeaders(), requestOptions.headers || {});
    if (requestOptions.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const res = await fetch('../api/index.php?' + params.toString(), Object.assign({}, requestOptions, { headers }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || ('Request failed (' + res.status + ')'));
    }
    return data;
  }

  function updateTokenMeter(usage) {
    const used = Number(usage.used || 0), limit = Number(usage.limit || 150000), percent = Math.min(100, Number(usage.percent || (used / limit * 100)));
    const pct = $('ks-token-pct'), fill = $('ks-token-bar-fill');
    if (pct) pct.textContent = percent.toFixed(percent < 1 ? 1 : 0) + '% / ' + Math.round(limit / 1000) + 'K';
    if (fill) fill.style.width = percent + '%';
    if ($('ks-token-in')) $('ks-token-in').textContent = Number(usage.input || 0).toLocaleString();
    if ($('ks-token-out')) $('ks-token-out').textContent = Number(usage.output || used).toLocaleString();
  }

  function updateDiffMeter() {
    const el = $('ks-diff-stats');
    if (!el) return;
    let added = 0, removed = 0;
    (getActiveSession()?.messages || []).forEach(message => {
      if (message.role !== 'assistant') return;
      String(message.content || '').split('\n').forEach(line => {
        if (/^\+(?!\+\+)/.test(line)) added += 1;
        if (/^-(?!--)/.test(line)) removed += 1;
      });
    });
    el.innerHTML = '<b class="add">+' + added + '</b> <b class="del">-' + removed + '</b>';
  }

  function toast(msg, isError = false) {
    const el = $('ks-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('error', Boolean(isError));
    el.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  // ---------- Session persistence (local first, server mirror) ----------
  const SESSION_KEY = 'kra-studio-sessions';
  let sessionSaveTimer = 0;

  function persistSessions() {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        sessions: state.sessions.slice(0, 40),
        active: state.activeSessionId
      }));
    } catch (_) { /* storage full or private mode: in-memory only */ }
    clearTimeout(sessionSaveTimer);
    // Debounced server mirror so recent sessions survive a device switch.
    sessionSaveTimer = setTimeout(() => {
      if (!state.authStatus) return;
      const payload = JSON.stringify({ sessions: state.sessions.slice(0, 40), active: state.activeSessionId });
      if (payload.length > 512000) {
        // Server mirror caps at 512 KB; say so instead of failing silently.
        state.sessionMirror = 'too-large:' + Math.round(payload.length / 1024) + 'KB';
        return;
      }
      api('studio-sessions', { method: 'POST', body: payload })
        .then(res => {
          state.sessionMirror = res.ok === false
            ? 'error:' + (res.error || 'ditolak')
            : 'ok:' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        })
        .catch(err => { state.sessionMirror = 'error:' + (err.message || 'offline'); });
    }, 2500);
  }

  /** Merge the server mirror into whatever the browser already has. */
  function mergeServerSessions(server) {
    const list = Array.isArray(server?.sessions) ? server.sessions : [];
    if (!list.length) return false;
    const byId = new Map((state.sessions || []).map(s => [s.id, s]));
    list.forEach(s => { if (!byId.has(s.id)) byId.set(s.id, s); });
    state.sessions = Array.from(byId.values());
    if (server.active && state.sessions.some(s => s.id === server.active)) {
      state.activeSessionId = server.active;
    }
    return true;
  }

  function restoreLocalSessions() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const local = Array.isArray(parsed?.sessions) ? parsed.sessions : [];
      if (!local.length) return false;
      const byId = new Map(local.map(s => [s.id, s]));
      const server = state.sessions || [];
      server.forEach(s => { if (!byId.has(s.id)) byId.set(s.id, s); });
      state.sessions = Array.from(byId.values());
      if (parsed.active && state.sessions.some(s => s.id === parsed.active)) state.activeSessionId = parsed.active;
      return true;
    } catch (_) { return false; }
  }

  // ---------- Init and Data Hydration ----------
  async function hydrate() {
    const [providerResult, agentResult, skillResult, usageResult, projectResult] = await Promise.allSettled([
      api('providers'), api('agents'), api('skills'), api('token-usage'), api('project-path')
    ]);
    const toolResult = await api('tools').catch(() => null);
    state.reactTools = (toolResult && toolResult.catalog) || [];
    state.reactToolCount = state.reactTools.length;
    state.reactToolHealthy = (toolResult && toolResult.implemented) || 0;
    state.reactToolVerdict = (toolResult && toolResult.verdict) || {};
    const providerConfig = providerResult.status === 'fulfilled' ? (providerResult.value.config || {}) : {};
    const providerNames = Object.keys(providerConfig.providers || {});
    const routerModels = {
      '9router': [{ id: 'combo-free', name: '9router / combo-free', provider: '9router', badge: 'KRA DEFAULT', context: '32k', description: 'KRA Office primary gateway.' }]
    };
    const configuredModels = providerNames.reduce((out, name) => {
      const p = providerConfig.providers[name] || {};
      const model = p.availableModel || p.model || name;
      out[name] = [{ id: model, name: name + ' / ' + model, provider: name.toLowerCase(), badge: p.apiKeyConfigured ? 'LIVE' : 'CONFIG', context: '', description: p.baseUrl || 'Configured provider' }];
      return out;
    }, {});
    state.models = Object.assign(routerModels, configuredModels);
    state.activeProvider = '9router';
    // Restore the model the operator last chose, if it still exists in the catalog.
    try {
      const savedModel = localStorage.getItem('kra-studio-model');
      if (savedModel) state.activeModel = savedModel;
    } catch (_) {}
    if (projectResult.status === 'fulfilled') state.projectRoot = projectResult.value.suggested || '';
    // Real ReAct tool catalog (implementation-backed), plus agents and skills
    // listed separately so the counts mean something.
    const agentsPayload = agentResult.status === 'fulfilled' ? (agentResult.value.agents || {}) : {};
    const agents = Array.isArray(agentsPayload) ? agentsPayload : Object.values(agentsPayload);
    state.agents = agents;
    const skillsPayload = skillResult.status === 'fulfilled' ? skillResult.value.skills : [];
    const skills = Array.isArray(skillsPayload) ? skillsPayload : Object.entries(skillsPayload || {}).map(([id, skill]) => Object.assign({ id }, skill));
    state.tools = {};
    state.reactTools.forEach(t => {
      state.tools[t.name] = { name: t.name, category: 'ReAct Tools', description: t.description || '' };
    });
    agents.forEach(agent => { state.tools['agent_' + (agent.id || agent.name)] = { name: agent.name || agent.id, category: 'KRA Agents', description: agent.title || agent.role || agent.description || 'KRA Office agent' }; });
    skills.forEach(skill => { state.tools['skill_' + (skill.id || skill.name)] = { name: skill.name || skill.id, category: 'KRA Skills', description: skill.description || skill.summary || 'KRA skill module' }; });
    state.toolCount = state.reactTools.length;
    state.agentCount = agents.length;
    state.skillCount = skills.length;
    try { state.sessions = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}').sessions || []; } catch (_) { state.sessions = []; }
    state.sessions = state.sessions.length ? state.sessions : [{ id: 'session_kra_office', title: 'KRA Office', time: 'Baru', model: state.activeModel, mode: 'Agent', tasks: [], messages: [] }];
    restoreLocalSessions();
    if (!state.sessions.some(s => s.id === state.activeSessionId)) state.activeSessionId = state.sessions[0].id;
    // Apply the operator's last-chosen model to the active session so the first
    // render does not resurrect whatever model that session was stored with.
    const activeAtBoot = getActiveSession();
    if (activeAtBoot) activeAtBoot.model = state.activeModel;
    state.modelPinned = true;
    renderToolsCount(); renderRecentChats(); renderActiveSession(); renderToolsCatalog(); renderModelModal();
    applyCapabilities();
    if (usageResult.status === 'fulfilled') updateTokenMeter(usageResult.value.usage || {});
  }

  // ---------- Composer attachments ----------
  function renderAttachments() {
    const root = $('ks-attach-queue');
    if (!root) return;
    root.replaceChildren();
    root.classList.toggle('hidden', !state.attachments.length);
    state.attachments.forEach((file, index) => {
      const chip = document.createElement('span');
      chip.className = 'ks-attach-chip';
      chip.textContent = file.name;
      const remove = document.createElement('button');
      remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Hapus ' + file.name);
      remove.addEventListener('click', () => { state.attachments.splice(index, 1); renderAttachments(); });
      chip.appendChild(remove); root.appendChild(chip);
    });
  }

  async function prepareAttachments() {
    const allowed = { 'image/png': 'image', 'image/jpeg': 'image', 'image/webp': 'image', 'application/pdf': 'text' };
    const TEXT_FILE_MAX = 256000;   // mirrors KraAgentChat::normalizeAttachments
    const IMAGE_FILE_MAX = 5 * 1024 * 1024;
    const result = [];
    for (const file of state.attachments) {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const kind = allowed[file.type] || (['txt', 'md', 'csv', 'json', 'xml', 'html', 'css', 'js', 'mjs', 'log', 'yaml', 'yml'].includes(ext) ? 'text' : '');
      if (!kind) throw new Error(file.name + ': format tidak didukung.');
      if (kind === 'image') {
        if (file.size > IMAGE_FILE_MAX) throw new Error(file.name + ': gambar maksimal 5 MB.');
        result.push({ name: file.name, kind, mimeType: file.type, dataUrl: await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); }) });
      } else {
        if (file.size > TEXT_FILE_MAX) throw new Error(file.name + ': teks maksimal 256 KB.');
        result.push({ name: file.name, kind: 'text', mimeType: file.type || 'text/plain', text: (await file.text()).slice(0, TEXT_FILE_MAX) });
      }
    }
    return result;
  }

  // ---------- KRA router integration ----------
  async function refreshRouterStatus() {
    const statusEl = $('ks-router-rna-status');
    const messageEl = $('ks-router-rna-message');
    const modelEl = $('ks-router-rna-model');
    try {
      const data = await api('rna-router-status');
      const config = await api('rna-router-config').catch(() => ({}));
      const connected = Boolean(data.connected);
      if (statusEl) { statusEl.textContent = connected ? 'ONLINE' : 'OFFLINE'; statusEl.className = 'ks-tag ' + (connected ? 'ok' : 'bad'); }
      if (messageEl) messageEl.textContent = data.message || 'RNA Router status received.';
      if (modelEl) modelEl.textContent = 'model: ' + (config.rnaRouter?.model || '—');
    } catch (e) {
      if (statusEl) { statusEl.textContent = 'UNAVAILABLE'; statusEl.className = 'ks-tag bad'; }
      if (messageEl) messageEl.textContent = e.message;
    }
  }

  async function testRnaRoute() {
    const message = 'KRA Office router health check. Reply with short status.';
    try {
      const data = await api('rna-router-chat', { method: 'POST', body: JSON.stringify({ message }) });
      toast(data.reply || data.message || 'RNA Router route completed.');
    } catch (e) { toast('RNA Router: ' + e.message, true); }
  }

  async function showRnaModels() {
    try {
      const data = await api('rna-router-models');
      const root = $('ks-router-detail');
      if (!root) return;
      root.classList.remove('hidden');
      root.innerHTML = '<div class="ks-card-title">RNA Router models (' + (data.count || 0) + ')</div><div class="ks-card-meta">' + (data.models || []).map(m => '<span class="ks-tag">' + escapeHtml(m.id || m.name || m) + '</span>').join('') + '</div>';
    } catch (e) { toast('RNA models: ' + e.message, true); }
  }

  // ---------- View Switching ----------
  function setView(viewName) {
    state.view = viewName;
    $$('.ks-nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });
    $$('.ks-view').forEach(v => {
      v.classList.toggle('hidden', v.id !== ('ks-view-' + viewName));
    });
    const bc = $('ks-breadcrumb-view');
    if (bc) bc.textContent = viewName.toUpperCase();
    applyCapabilities();

    if (viewName === 'files' && !state.filesTree.length) loadFilesTree(state.filePath || '');
    if (viewName === 'ssh') loadSshHosts();
    if (viewName === 'browser') checkBrowserStatus();
    if (viewName === 'github' && !state.githubLoaded) loadGithub();
    if (viewName === 'github' && state.githubLoaded) loadGithubPulls();
    if (viewName === 'automations' && !state.automationsLoaded) loadAutomations();
    if (viewName === 'mcp') { state.skillsLoaded = false; loadSkills(); }
    if (viewName === 'connections' && !state.connectionsLoaded) loadConnections();
    if (viewName === 'router') refreshRouterStatus();
    if (viewName === 'code' && !state.diffLoaded) loadDiffQueue();
    if (viewName === 'settings') loadSettings();
  }

  // ---------- Recent Chats & Sessions ----------
  function renderRecentChats() {
    const root = $('ks-recent-list');
    if (!root) return;
    root.innerHTML = '';
    (state.sessions || []).forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'ks-recent' + (s.id === state.activeSessionId ? ' active' : '');
      btn.title = s.title || '';
      btn.innerHTML = `<span class="ks-recent-title">${escapeHtml(s.title)}</span><span class="ks-recent-time">${escapeHtml(s.time || '')}</span>`;
      btn.addEventListener('click', () => selectSession(s.id));
      root.appendChild(btn);
    });
    // Keep the current conversation visible in a long list.
    const active = root.querySelector('.ks-recent.active');
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
  }

  function selectSession(id) {
    state.activeSessionId = id;
    // A different session brings its own model; unpin so it applies.
    state.modelPinned = false;
    persistSessions();
    renderRecentChats();
    renderActiveSession();
    setView('chat');
  }

  function getActiveSession() {
    return (state.sessions || []).find(s => s.id === state.activeSessionId) || state.sessions[0];
  }

  function renderToolsCount() {
    const el = $('ks-tools-count-pill');
    if (el) el.textContent = `Tools (${state.reactToolCount || 0})`;
    const navEl = $('ks-nav-tools-count');
    if (navEl) navEl.textContent = state.reactToolCount || 0;
    const top = $('ks-topbar-tools');
    if (top) {
      const n = state.reactToolCount || 0;
      const ok = state.reactToolHealthy || 0;
      top.textContent = n === 0 ? 'Tools: 0 (katalog kosong)' : `Tools: ${ok}/${n} aktif`;
    }
  }

  // ---------- AI Chat View Rendering ----------
  // ---------- Thinking duration ----------
  function formatDuration(from, to) {
    if (!from) return '';
    const end = to || Date.now();
    const ms = Math.max(0, end - from);
    if (ms < 1000) return (ms / 1000).toFixed(1) + 's';
    if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
    const mins = Math.floor(ms / 60000);
    const secs = Math.round((ms % 60000) / 1000);
    return mins + 'm ' + secs + 's';
  }

  // Live-updates every running thinking timer once per 200ms.
  let thinkTicker = null;
  function startThinkTicker() {
    if (thinkTicker) return;
    thinkTicker = setInterval(() => {
      const nodes = $$('.ks-think-timer.is-live');
      if (!nodes.length) {
        clearInterval(thinkTicker);
        thinkTicker = null;
        return;
      }
      nodes.forEach(node => {
        const started = Number(node.getAttribute('data-think-start') || 0);
        if (started) node.textContent = formatDuration(started);
      });
    }, 200);
  }

  // Header reflects whichever session is active, matching the Recent list.
  function renderSessionTitle() {
    const s = getActiveSession();
    const nameEl = $('ks-session-name');
    const metaEl = $('ks-session-meta');
    if (!s) return;
    if (nameEl) nameEl.textContent = s.title || 'Sesi tanpa judul';
    if (metaEl) {
      const count = (s.messages || []).length;
      const when = s.time || 'Baru';
      metaEl.textContent = when + ' · ' + count + ' pesan · ' + (s.model || state.activeModel);
    }
  }

  function renderActiveSession() {
    const s = getActiveSession();
    if (!s) return;
    const scroll = $('ks-chat-scroll');
    const inner = $('ks-chat-inner');
    if (!inner) return;

    // Restore the session's own model only when the user has not just picked one
    // for this session. Prevents a stored session from reverting a fresh choice.
    if (s.model && !state.modelPinned) {
      state.activeModel = s.model;
      updateModelDisplay();
    }
    updateDiffMeter();
    renderSessionTitle();
    if ((s.messages || []).some(m => m.role === 'assistant' && m.streaming)) startThinkTicker();

    inner.innerHTML = '';

    if (!(s.messages || []).length) {
      const empty = document.createElement('div');
      empty.className = 'ks-empty';
      empty.innerHTML = '<strong>Belum ada langkah pada sesi ini</strong>Ketik instruksi di bawah. Agent akan memanggil model live, menjalankan tool yang diizinkan, lalu menampilkan langkah nyata beserta jawabannya.';
      inner.appendChild(empty);
    }

    (s.messages || []).forEach(m => {
      if (m.role === 'user') {
        const u = document.createElement('div');
        u.className = 'ks-msg-user';
        u.textContent = m.content;
        if (Array.isArray(m.attachments) && m.attachments.length) {          const list = document.createElement('div');
          list.className = 'ks-msg-attach';
          m.attachments.forEach(att => { const chip = document.createElement('span'); chip.textContent = '📎 ' + att.name; list.appendChild(chip); });
          u.appendChild(list);
        }
        inner.appendChild(u);
      } else if (m.role === 'assistant') {
        const a = document.createElement('div');
        a.className = 'ks-msg-agent';

        // Reasoning collapsible — spoiler-style trace (bukan CoT privat)
        if (m.reasoning) {
          const det = document.createElement('details');
          det.className = 'ks-reasoning';
          det.open = Boolean(m.streaming);
          const elapsed = formatDuration(m.startedAt, m.finishedAt);
          const stepCount = String(m.reasoning).split('\n').filter(Boolean).length;
          const timer = m.streaming
            ? `<span class="ks-think-timer is-live" data-think-start="${m.startedAt || Date.now()}">0.0s</span>`
            : (elapsed ? `<span class="ks-think-timer">${elapsed}</span>` : '');
          const label = m.streaming
            ? `⏳ KRA sedang berpikir… ${timer}`
            : `🧠 Jejak analisis agent · ${stepCount} langkah ${timer} — klik untuk buka`;
          const steps = String(m.reasoning).split('\n').filter(l => l.trim())
            .map(l => `<div class="ks-step">${escapeHtml(l)}</div>`).join('');
          det.innerHTML = `<summary>${label}</summary><div class="ks-reasoning-body">${steps}</div>`;
          a.appendChild(det);
        }

        // Inline tool execution cards — aktivitas agent
        if (Array.isArray(m.toolCalls)) {
          m.toolCalls.forEach(tc => {
            const rawStatus = String(tc.status || 'COMPLETED').toUpperCase();
            const statusClass = /FAIL|ERROR/.test(rawStatus) ? 'bad'
              : /RUN|PENDING|WAIT/.test(rawStatus) ? 'run'
              : /STOP|ABORT|CANCEL/.test(rawStatus) ? 'warn' : 'ok';
            const card = document.createElement('div');
            card.className = 'ks-tool-card is-' + statusClass;
            card.innerHTML = `
              <div class="ks-tool-head">
                <span class="ks-tool-dot" aria-hidden="true"></span>
                <span class="ks-tool-name">${escapeHtml(tc.tool || 'shell_exec')}</span>
                <span class="ks-tool-status ${statusClass}">${escapeHtml(rawStatus)}</span>
              </div>
              ${tc.command ? `<div class="ks-tool-cmd">${escapeHtml(tc.command)}</div>` : ''}
              ${tc.output ? `<pre class="ks-tool-out">${escapeHtml(tc.output)}</pre>` : ''}
              <div class="ks-tool-actions">
                <button type="button" class="ks-link-btn" data-peek-cmd="${escapeAttr(tc.command || '')}" data-peek-out="${escapeAttr(tc.output || '')}">↳ Peek to Terminal</button>
              </div>
            `;
            a.appendChild(card);
          });
        }

        // Jawaban akhir — area terpisah dari bagian analisis di atas
        if (m.content) {
          const answer = document.createElement('div');
          answer.className = 'ks-answer';
          const answerHead = document.createElement('div');
          answerHead.className = 'ks-answer-head';
          answerHead.innerHTML = `<strong>KRA Agent</strong><span class="ks-agent-badge ${m.streaming ? 'is-live' : 'is-idle'}">${m.streaming ? 'WORKING' : 'READY'}</span><span>• ${escapeHtml(state.activeModel)}</span>${m.streaming ? '<span class="ks-typing" aria-hidden="true"><i></i><i></i><i></i></span>' : ''}`;
          answer.appendChild(answerHead);
          const txt = document.createElement('div');
          txt.className = 'ks-msg-text';
          txt.innerHTML = renderMarkdown(m.content);
          answer.appendChild(txt);
          a.appendChild(answer);
        }

        inner.appendChild(a);
      }
    });

    // Render Subtasks Progress Checklist
    if (Array.isArray(s.tasks) && s.tasks.length > 0) {
      const total = s.tasks.length;
      const completed = s.tasks.filter(t => t.status === 'COMPLETED').length;
      const card = document.createElement('div');
      card.className = 'ks-tasks-card';
      let rows = '';
      s.tasks.forEach((t, i) => {
        const isProg = t.status === 'IN PROGRESS';
        const isDone = t.status === 'COMPLETED';
        const cls = isDone ? 'is-done' : (isProg ? 'is-progress' : 'is-pending');
        const icon = isDone ? '✓' : (isProg ? '●' : String(i + 1));
        rows += `
          <div class="ks-task ${cls}">
            <span class="ks-task-icon">${icon}</span>
            <span class="ks-task-title">${escapeHtml(t.title)}</span>
            <span class="ks-task-state">${escapeHtml(t.status)}</span>
          </div>
        `;
      });
      card.innerHTML = `
        <div class="ks-tasks-head">
          <span>Tasks (${completed}/${total}) - ${escapeHtml(s.tasks[0]?.title || '')}</span>
          <span class="ks-task-progress-pill">${Math.round((completed / total) * 100)}%</span>
        </div>
        <div class="ks-task-list">${rows}</div>
      `;
      inner.appendChild(card);
    }

    if (scroll) scroll.scrollTop = scroll.scrollHeight;
    syncComposerState();
  }

  // ---------- Peek to Terminal Interaction ----------
  function handlePeekToTerminal(command, output) {
    state.terminalHistory.push({ type: 'cmd', text: command });
    state.terminalHistory.push({ type: 'out', text: output });
    renderTerminalOutput();
    setView('terminal');
    toast('Peeked command into live terminal');
  }

  // ---------- Terminal View ----------
  function renderTerminalOutput() {
    const out = $('ks-term-output');
    if (!out) return;
    out.innerHTML = '';
    state.terminalHistory.forEach(line => {
      const div = document.createElement('div');
      div.className = 'ks-term-line-' + (line.type || 'out');
      div.textContent = line.text;
      out.appendChild(div);
    });
    out.scrollTop = out.scrollHeight;
  }

  async function executeTerminalCommand(cmd) {
    if (!cmd.trim()) return;
    state.terminalHistory.push({ type: 'cmd', text: cmd });
    renderTerminalOutput();
    try {
      const res = await api('terminal-run', { method: 'POST', body: JSON.stringify({ command: cmd }) });
      state.terminalHistory.push({ type: res.ok ? 'out' : 'err', text: res.output || '(no output)' });
    } catch (e) {
      state.terminalHistory.push({ type: 'err', text: e.message || 'Execution failed' });
    }
    renderTerminalOutput();
  }

  // ---------- Files / Dual-Pane Explorer ----------
  async function loadFilesTree(path = '') {
    const list = $('ks-tree-list');
    if (!list) return;
    list.innerHTML = '<div class="ks-empty">Scanning workspace...</div>';
    try {
      // Only a workspace admin may name a project root by path. Everyone else
      // gets the workspace's own sandbox resolved server-side, so the KRA
      // installation path is never sent to the browser.
      const wantsExplicitRoot = capabilities().wsAdmin && state.projectRoot;
      if (wantsExplicitRoot && !state.projectRoot) {
        try {
          const project = await api('project-path');
          state.projectRoot = project.suggested || '';
        } catch (_) {
          state.projectRoot = '';
        }
      }
      const query = Object.assign({ path }, wantsExplicitRoot ? { root: state.projectRoot } : {});
      const data = await api('workspace-files', { query });
      state.filesTree = data.entries || [];
      state.filePath = path;
      const crumb = $('ks-files-current-path');
      if (crumb) {
        const base = data.root ? String(data.root).split(/[\\/]/).filter(Boolean).pop() : 'workspace';
        crumb.textContent = base + (path ? ' / ' + path : ' / root') + (data.truncated ? ' (dipotong)' : '');
      }
      renderFilesTree();
      const firstFile = state.filesTree.find(e => e.kind === 'file');
      if (firstFile && path !== state.previewedDir) loadFilePreview(firstFile.path);
      state.previewedDir = path;
    } catch (e) {
      list.innerHTML = `<div class="ks-empty error">Failed to load files: ${escapeHtml(e.message)}</div>`;
    }
  }

  function renderFilesTree() {
    const list = $('ks-tree-list');
    if (!list) return;
    list.innerHTML = '';
    state.filesTree.forEach(entry => {
      const isDir = entry.kind === 'directory';
      const row = document.createElement('button');
      row.className = 'ks-tree-row' + (isDir ? ' is-dir' : '') + (entry.path === state.selectedFilePath ? ' active' : '');
      row.innerHTML = `<span class="ks-tree-icon">${isDir ? '📁' : '📄'}</span><span class="ks-tree-name">${escapeHtml(entry.name)}</span>`;
      row.addEventListener('click', () => {
        if (isDir) loadFilesTree(entry.path);
        else loadFilePreview(entry.path);
      });
      list.appendChild(row);
    });
  }

  function filesGoUp() {
    const current = state.filePath || '';
    if (!current) return;
    const parent = current.split('/').slice(0, -1).join('/');
    loadFilesTree(parent);
  }

  async function loadFilePreview(filePath) {
    state.selectedFilePath = filePath;
    renderFilesTree();
    const title = $('ks-file-path-title');
    if (title) title.textContent = filePath;
    const code = $('ks-file-code');
    if (!code) return;
    code.textContent = 'Loading file...';
    try {
      const wantsExplicitRoot = capabilities().wsAdmin && state.projectRoot;
      const query = Object.assign({ path: filePath }, wantsExplicitRoot ? { root: state.projectRoot } : {});
      const data = await api('workspace-read', { query });
      state.selectedFileContent = data.content || '';
      renderCodeWithLineNumbers(code, state.selectedFileContent);
    } catch (e) {
      code.textContent = '// Could not read file: ' + e.message;
    }
  }

  function renderCodeWithLineNumbers(container, rawCode) {
    const lines = (rawCode || '').split('\n');
    let html = '';
    lines.forEach((line, i) => {
      html += `<span class="ln">${i + 1}</span>${escapeHtml(line)}\n`;
    });
    container.innerHTML = html;
  }

  // ---------- Tools Catalog (real ReAct tools + agents + skills) ----------
  function renderToolsCatalog() {
    const grid = $('ks-tools-catalog-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const cats = {};
    Object.values(state.tools).forEach(t => {
      const c = t.category || 'General';
      if (!cats[c]) cats[c] = [];
      cats[c].push(t);
    });

    const catNames = Object.keys(cats);
    if (!catNames.length) {
      grid.innerHTML = '<div class="ks-empty"><strong>Katalog tool kosong</strong>Server tidak mengembalikan tool ReAct, agent, atau skill. Cek action <code>tools</code> di server.</div>';
      return;
    }

    catNames.forEach(catName => {
      const head = document.createElement('div');
      head.className = 'ks-tools-cat';
      head.textContent = `${catName} (${cats[catName].length})`;
      grid.appendChild(head);

      cats[catName].forEach(tool => {
        const item = document.createElement('div');
        item.className = 'ks-tool-item';
        const verdict = catName === 'ReAct Tools' ? state.reactToolVerdict[tool.name] : null;
        const live = verdict ? !String(verdict.error || '').includes('Unknown tool name') : null;
        const badge = live === null ? '' : `<span class="ks-tag ${live ? 'ok' : 'bad'}">${live ? 'IMPLEMENTED' : 'BELUM ADA'}</span>`;
        item.innerHTML = `<div class="ks-tool-item-name">${escapeHtml(tool.name)} ${badge}</div><div class="ks-tool-item-desc">${escapeHtml(tool.description)}</div>`;
        grid.appendChild(item);
      });
    });
  }

  // ---------- Model Selector Modal ----------
  function renderModelModal() {
    const tabsRoot = $('ks-modal-tabs');
    const bodyRoot = $('ks-modal-model-list');
    if (!tabsRoot || !bodyRoot) return;
    tabsRoot.innerHTML = '';

    const providers = Object.keys(state.models);
    if (!providers.length) return;

    if (!state.activeProvider || !state.models[state.activeProvider]) {
      state.activeProvider = providers[0];
    }

    providers.forEach(prov => {
      const tab = document.createElement('button');
      tab.className = 'ks-tab' + (prov === state.activeProvider ? ' active' : '');
      tab.textContent = prov;
      tab.addEventListener('click', () => {
        state.activeProvider = prov;
        renderModelModal();
      });
      tabsRoot.appendChild(tab);
    });

    bodyRoot.innerHTML = '';
    const modelsList = state.models[state.activeProvider] || [];
    modelsList.forEach(m => {
      const row = document.createElement('button');
      row.className = 'ks-model-row' + (m.name === state.activeModel ? ' selected' : '');
      row.innerHTML = `
        <span class="ks-model-badge">${escapeHtml(m.badge || 'PRO')}</span>
        <div class="ks-model-main">
          <div class="ks-model-name">${escapeHtml(m.name)}</div>
          <div class="ks-model-desc">${escapeHtml(m.description || '')}</div>
          <div class="ks-model-ctx">${escapeHtml(m.context || '')}</div>
        </div>
      `;
      row.addEventListener('click', () => {
        state.activeModel = m.name;
        // The session record carries its own model; update it too or the next
        // render/save will resurrect the old one.
        const s = getActiveSession();
        if (s) s.model = m.name;
        state.modelPinned = true;
        try { localStorage.setItem('kra-studio-model', m.name); } catch (_) {}
        updateModelDisplay();
        persistSessions();
        closeModelModal();
        toast('Switched model to ' + m.name);
      });
      bodyRoot.appendChild(row);
    });
  }

  function openModelModal() {
    renderModelModal();
    const modal = $('ks-model-modal');
    if (modal) modal.classList.remove('hidden');
  }

  function closeModelModal() {
    const modal = $('ks-model-modal');
    if (modal) modal.classList.add('hidden');
  }

  function updateModelDisplay() {
    const p1 = $('ks-topbar-model');
    const p2 = $('ks-composer-model');
    if (p1) p1.textContent = state.activeModel;
    if (p2) p2.textContent = state.activeModel;
  }

  // ---------- SSH Remote Hosts ----------
  async function loadSshHosts() {
    const list = $('ks-ssh-hosts-list');
    if (!list) return;
    list.innerHTML = '<div class="ks-empty">Memuat host SSH…</div>';
    try {
      const [data, meta] = await Promise.all([
        api('studio-ssh'),
        api('studio-ssh', { method: 'POST', body: JSON.stringify({ op: 'status' }) }).catch(() => null),
      ]);
      state.sshHosts = data.hosts || [];
      state.sshStatus = meta || null;
      renderSshHosts();
    } catch (e) {
      list.innerHTML = `<div class="ks-empty error">Gagal: ${escapeHtml(e.message)}</div>`;
    }
  }

  /** Persist a host via the bridge and re-render from the server's own list. */
  async function saveSshHost(host, label) {
    const hosts = state.sshHosts.filter(h => h.id !== host.id).concat([host]);
    try {
      const res = await api('studio-ssh', { method: 'POST', body: JSON.stringify({ op: 'save', hosts }) });
      state.sshHosts = res.hosts || hosts;
      renderSshHosts();
      toast('Host SSH ' + (label || host.name) + ' tersimpan.');
    } catch (err) {
      toast('Gagal menyimpan host SSH: ' + err.message, true);
    }
  }

  function setSshBadge(hostId, label, tone) {
    const badge = document.querySelector('[data-ssh-badge="' + (window.CSS && CSS.escape ? CSS.escape(hostId) : hostId) + '"]');
    if (!badge) return;
    badge.textContent = label;
    badge.className = 'ks-tag' + (tone ? ' ' + tone : '');
  }

  function renderSshHosts() {
    const list = $('ks-ssh-hosts-list');
    if (!list) return;
    const status = state.sshStatus;
    const openSsh = status && status.sshBinary && status.sshBinary !== 'none';
    const banner = status
      ? `<div class="ks-card"><div class="ks-card-head"><span class="ks-card-title">OpenSSH</span><span class="ks-tag ${openSsh ? 'ok' : 'warn'}">${openSsh ? 'TERPASANG' : 'TIDAK ADA'}</span></div><div class="ks-card-desc">${escapeHtml(status.notice || '')}</div><div class="ks-card-meta"><span class="ks-tag">${escapeHtml(status.sshBinary || 'ssh: none')}</span><span class="ks-tag">${escapeHtml(status.sftpBinary || 'sftp: none')}</span><span class="ks-tag">${Number(status.hostCount || 0)} host</span></div></div>`
      : '';

    if (!state.sshHosts.length) {
      list.innerHTML = banner + '<div class="ks-empty"><strong>Belum ada host SSH terdaftar</strong>Tambahkan host lewat form di bawah. Bridge memakai <code>ssh</code>/<code>sftp</code> sistem dan akan melaporkan <code>unavailable</code> bila biner atau host tidak tersedia — tidak ada output palsu.</div>';
      return;
    }

    list.innerHTML = banner + state.sshHosts.map(h => `
      <div class="ks-card">
        <div class="ks-card-head">
          <span class="ks-card-title">${escapeHtml(h.name || h.host)}</span>
          <span class="ks-tag" data-ssh-badge="${escapeAttr(h.id)}">BELUM DITES</span>
          <div class="ks-card-actions">
            <button type="button" class="ks-btn" data-ssh-test="${escapeAttr(h.id)}">Test koneksi</button>
            <button type="button" class="ks-btn" data-ssh-term="${escapeAttr(h.id)}">Terminal</button>
            <button type="button" class="ks-btn primary" data-ssh-sftp="${escapeAttr(h.id)}">Explore sFTP</button>
          </div>
        </div>
        <div class="ks-card-desc">${escapeHtml(h.user || '—')}@${escapeHtml(h.host || '')}:${escapeHtml(String(h.port || 22))} · <code>${escapeHtml(h.remotePath || '~')}</code></div>
      </div>`).join('');
  }

  // ---------- Browser Controller ----------
  async function checkBrowserStatus() {
    try {
      const data = await api('studio-browser');
      state.browserStatus = data;
      const bin = $('ks-browser-bin');
      if (bin) bin.textContent = data.binary || 'none';
      const mode = $('ks-browser-mode');
      if (mode) {
        const live = data.mode === 'live';
        mode.textContent = live ? 'LIVE (CDP)' : (data.installed ? 'TERPASANG, SESI OFF' : 'TIDAK TERSEDIA');
        mode.className = 'ks-tag ' + (live ? 'ok' : 'warn');
        mode.title = data.notice || '';
      }
      const result = $('ks-browser-result');
      if (result && !data.cdpConnected) result.textContent = data.notice || 'DevTools belum tersambung';
      const hint = $('ks-browser-hint');
      if (hint && data.notice) hint.textContent = data.notice;
    } catch (e) {
      console.warn('Browser status check failed', e);
    }
  }

  async function triggerBrowserAction(op, params = {}) {
    try {
      const res = await api('studio-browser', { method: 'POST', body: JSON.stringify(Object.assign({ op }, params)) });
      toast(`Browser ${op}: ${res.ok ? 'OK' : 'GAGAL'}`, !res.ok);
      const result = $('ks-browser-result');
      if (result) result.textContent = op + ': ' + (res.ok ? (res.url || res.selector || res.snapshot || 'ok') : (res.error || 'gagal'));
      if (res.action === 'screenshot' && (res.dataUrl || res.snapshot)) {
        const preview = $('ks-browser-snapshot-img');
        if (preview && res.dataUrl) preview.src = res.dataUrl;
      }
    } catch (e) {
      toast('Browser error: ' + e.message, true);
    }
  }

  // ---------- Live Agent Run (real ReAct loop + real tools) ----------
  // The model selector stores display names; the agent endpoint needs the real
  // provider + model id, so resolve through the catalog the server sent.
  function resolveModelChoice() {
    const catalog = state.models || {};
    for (const prov of Object.keys(catalog)) {
      const hit = (catalog[prov] || []).find(m => m.name === state.activeModel || m.id === state.activeModel);
      if (hit) return { provider: hit.provider || prov.toLowerCase(), model: hit.id };
    }
    const parts = String(state.activeModel || '').split('/').map(p => p.trim());
    if (parts.length === 2) return { provider: parts[0], model: parts[1] };
    return { provider: '9router', model: 'combo-free' };
  }

  // Autonomous terminal runner: executes shell/powershell directly and displays reasoning
  async function runStudioCommand(text, s) {
    s.messages = s.messages || [];
    s.messages.push({ role: 'user', content: text });
    const assistantMsg = {
      role: 'assistant',
      reasoning: 'Menganalisis perintah terminal...\n- Memvalidasi sintaks allowlist & executable.\n- Membuka subprocess di workspace.\n- Mengalirkan output command ke terminal buffer.',
      content: 'Sedang mengeksekusi perintah `' + text + '` di workspace...',
      startedAt: Date.now(),
      toolCalls: [
        {
          id: 'tc_' + Date.now(),
          tool: 'terminal_exec',
          command: text,
          status: 'RUNNING',
          output: 'Menunggu output...'
        }
      ],
      streaming: true
    };
    s.messages.push(assistantMsg);
    state.streaming = true;
    state.abortController = new AbortController();
    syncComposerState();
    renderActiveSession();

    try {
      const remoteHost = state.terminalHost;
      const res = remoteHost
        ? await api('studio-ssh', {
            method: 'POST',
            signal: state.abortController.signal,
            body: JSON.stringify({ op: 'exec', hostId: remoteHost, command: text }),
          })
        : await api('terminal-run', {
            method: 'POST',
            signal: state.abortController.signal,
            body: JSON.stringify({ command: text })
          });
      assistantMsg.streaming = false;
      const exitCode = Number(res.exitCode ?? res.code ?? 0);
      assistantMsg.reasoning = remoteHost
        ? ('Perintah dieksekusi lewat SSH ke ' + remoteHost + '.\n- Mode: ' + (res.mode || 'live') + '\n- Exit code: ' + exitCode)
        : ('Perintah dieksekusi melalui KRA Terminal Bridge.\n- Allowlist command: lolos.\n- Working directory: workspace project.\n- Exit code: ' + exitCode);
      assistantMsg.toolCalls = [{
        id: 'tc_' + Date.now(),
        tool: remoteHost ? 'ssh_exec' : 'shell_exec',
        command: text,
        status: exitCode === 0 && res.ok !== false ? 'COMPLETED' : 'FAILED',
        output: res.output || res.stdout || res.error || '(no output)'
      }];
      assistantMsg.content = res.ok ? ('Perintah selesai (exit ' + exitCode + ').\n\n```\n' + (res.output || res.stdout || '(no output)') + '\n```') : ('⚠︎ Eksekusi gagal: ' + (res.error || 'Unknown error'));
      state.terminalHistory.push({ type: 'cmd', text: (remoteHost ? '[' + remoteHost + '] ' : '') + text });
      state.terminalHistory.push({ type: res.ok ? 'out' : 'err', text: res.output || res.error || '(no output)' });
      renderTerminalOutput();
    } catch (e) {
      assistantMsg.streaming = false;
      if (e && e.name === 'AbortError') {
        assistantMsg.content = '⏹ Agent dihentikan oleh pengguna.';
        if (assistantMsg.toolCalls[0]) assistantMsg.toolCalls[0].status = 'STOPPED';
      } else {
        assistantMsg.content = '⚠︎ Terminal tidak dapat dijalankan: ' + e.message + '\n\n`terminal-run` hanya aktif untuk platform admin dari mesin lokal. Gunakan AI Chat untuk tugas agent biasa.';
        if (assistantMsg.toolCalls[0]) assistantMsg.toolCalls[0].status = 'FAILED';
      }
    } finally {
      state.streaming = false;
      state.abortController = null;
      assistantMsg.finishedAt = Date.now();
      syncComposerState();
      persistSessions();
      renderActiveSession();
      renderRecentChats();
    }
  }

  function stopGeneration() {
    if (!state.streaming) return;
    if (state.abortController) {
      try { state.abortController.abort(); } catch (_) {}
      state.abortController = null;
    }
    const s = getActiveSession();
    if (s && Array.isArray(s.messages)) {
      const last = s.messages[s.messages.length - 1];
      if (last && last.role === 'assistant' && last.streaming) {
        last.streaming = false;
        last.content = (last.content || '').trim();
        last.content += (last.content ? '\n\n' : '') + '⏹ Agent dihentikan oleh pengguna.';
        if (Array.isArray(last.toolCalls)) {
          last.toolCalls.forEach(tc => { if (tc.status === 'RUNNING') tc.status = 'STOPPED'; });
        }
      }
    }
    state.streaming = false;
    syncComposerState();
    persistSessions();
    renderActiveSession();
    renderRecentChats();
    toast('Eksekusi dihentikan.');
  }

  async function sendChatMessage() {
    if (state.streaming) {
      stopGeneration();
      return;
    }
    const ta = $('ks-composer-input');
    if (!ta) return;
    const text = ta.value.trim();
    if (!text && !state.attachments.length) return;
    const message = text || 'Tolong analisis lampiran ini dan rangkum informasi pentingnya.';
    const s = getActiveSession();
    if (!s) return;
    let attachments = [];
    try { attachments = await prepareAttachments(); } catch (e) { toast(e.message, true); return; }
    ta.value = '';

    // Autonomous terminal: a bare command (or $/>, run, cmd, powershell) is
    // executed by the agent itself instead of being sent as chat.
    if (/^(?:\$|>|run\s|exec\s|terminal\s|cmd\s|powershell\s|pwsh\s|git\s|dir\b|ls\b|npm\s|node\s|php\s)/i.test(text) && !attachments.length) {
      runStudioCommand(text, s);
      return;
    }

    state.attachments = [];
    renderAttachments();
    s.messages = s.messages || [];

    // "continue" / "lanjut" / "retry" re-runs the previous user turn instead of
    // being sent as a new message. This is how the operator recovers from a
    // provider outage without retyping their prompt.
    const RETRY_RE = /^(?:continue|lanjut|lanjutkan|retry|coba\s*lagi|ulangi|gagal,\s*lanjut|error,\s*lanjut|again)$/i;
    let outbound = message;
    if (RETRY_RE.test(text) && !attachments.length) {
      const priorUser = [...s.messages].reverse().find(m => m.role === 'user' && RETRY_RE.test(String(m.content || '').trim()) === false);
      if (priorUser && String(priorUser.content || '').trim() !== '') {
        outbound = String(priorUser.content);
        attachments = Array.isArray(priorUser.attachmentsRaw) ? priorUser.attachmentsRaw : [];
      }
    }

    s.messages.push({ role: 'user', content: message, attachments: attachments.map(a => ({ name: a.name, kind: a.kind })), attachmentsRaw: attachments });
    const assistantMsg = { role: 'assistant', reasoning: 'Menghubungi ' + state.activeModel + ' — menunggu langkah pertama…', content: '', toolCalls: [], streaming: true, startedAt: Date.now() };
    s.messages.push(assistantMsg);
    state.streaming = true;
    state.abortController = new AbortController();
    syncComposerState();

    if (/^Percakapan Baru/.test(s.title || '') || s.title === 'Audit Refactor') {
      s.title = outbound.slice(0, 42) + (outbound.length > 42 ? '…' : '');
    }
    s.time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    persistSessions();
    renderRecentChats();
    renderActiveSession();

    // Coalesce repaints: progress events can arrive several times per second.
    let paintTimer = null;
    const paint = () => {
      if (paintTimer) return;
      paintTimer = setTimeout(() => { paintTimer = null; renderActiveSession(); }, 90);
    };
    const traceLines = [];

    // Previous conversational context: everything before this turn's user
    // message and the streaming placeholder. Without this the model answers
    // every turn as if the conversation just started.
    const history = (s.messages || [])
      .slice(0, -2)
      .filter(m => {
        if (!m || (m.role !== 'user' && m.role !== 'assistant')) return false;
        if (typeof m.content !== 'string' || !m.content.trim()) return false;
        if (m.role === 'assistant' && m.content.startsWith('KRA Studio siap.')) return false;
        return true;
      })
      .slice(-12)
      .map(m => ({ role: m.role, content: m.content.trim() }));

    try {
      const choice = resolveModelChoice();
      const response = await fetch('../api/index.php?action=react-chat&stream=1', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
        signal: state.abortController ? state.abortController.signal : undefined,
        body: JSON.stringify({
          agentId: 'rama',
          channel: 'studio',
          message: outbound,
          attachments,
          history,
          maxTurns: 30,
          chainHandoff: true,
          provider: choice.provider,
          model: choice.model,
        }),
      });
      if (!response.ok) {
        let payload = {};
        try { payload = await response.json(); } catch (_) {}
        throw new Error(payload.error || ('Agent request failed (' + response.status + ')'));
      }

      let doneEvent = null;
      const handleEvent = event => {
        if (event.type === 'progress') {
          const p = event.progress || {};
          const line = (p.message || '').trim();
          if (line) {
            traceLines.push((p.kind === 'action' ? '→ ' : '') + line + (p.turn ? '  (' + p.turn + '/' + (p.maxTurns || '?') + ')' : ''));
            assistantMsg.reasoning = traceLines.join('\n');
            paint();
          }
        } else if (event.type === 'done') {
          doneEvent = event;
        } else if (event.type === 'error') {
          throw new Error(event.error || 'Agent run failed');
        }
      };

      if (response.body && response.body.getReader && !(response.headers.get('content-type') || '').includes('application/json')) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          lines.forEach(line => { if (line.trim()) handleEvent(JSON.parse(line)); });
          if (done) break;
        }
        if (buffer.trim()) handleEvent(JSON.parse(buffer));
      } else {
        const result = await response.json();
        if (!result.ok) throw new Error(result.error || 'Agent run failed');
        doneEvent = { ok: true, result };
      }

      const result = doneEvent?.result || {};
      (result.trace || []).forEach(step => {
        if (!step.action) return;
        const obs = step.observation || {};
        let cmd = '';
        if (step.input) {
          if (typeof step.input === 'string') cmd = step.input;
          else if (step.input.command) cmd = step.input.command;
          else if (step.input.query) cmd = step.input.query;
          else if (step.input.path) cmd = step.input.path;
          else if (step.input.url) cmd = step.input.url;
          else cmd = JSON.stringify(step.input);
        }
        assistantMsg.toolCalls.push({
          id: 'tc_' + assistantMsg.toolCalls.length,
          tool: step.action,
          status: obs.ok === false ? 'FAILED' : 'COMPLETED',
          command: cmd,
          output: obs.summary || obs.error || (obs.ok ? 'Action completed.' : 'Action did not complete.'),
        });
      });
      assistantMsg.content = String(result.finalAnswer || '').trim() || assistantMsg.reasoning || 'Agent selesai tanpa jawaban akhir.';
      if (Array.isArray(result.trace) && result.trace.some(step => step.handoffPacket)) {
        assistantMsg.reasoning += '\n(handoff ke agent lain terjadi pada run ini)';
      }
      if (Array.isArray(s.tasks) && s.tasks.length) {
        s.tasks.forEach((t, i) => { t.status = i === 0 ? 'COMPLETED' : (i === 1 ? 'IN PROGRESS' : 'PENDING'); });
      }
    } catch (error) {
      if (error && error.name === 'AbortError') {
        assistantMsg.content = (assistantMsg.content || '').trim();
        assistantMsg.content += (assistantMsg.content ? '\n\n' : '') + '⏹ Agent dihentikan oleh pengguna.';
      } else {
        const detail = String(error.message || 'unknown error');
        const canRetry = /provider|unavailable|failed|timeout|offline|tidak tersedia/i.test(detail);
        assistantMsg.content = '⚠︎ Agent tidak dapat dijalankan: ' + detail;
        assistantMsg.retryable = canRetry;
        if (canRetry) {
          assistantMsg.content += '\n\n↻ Ketik `continue` untuk mencoba ulang, atau pilih provider lain di Settings → model default.';
        }
        if (traceLines.length) assistantMsg.reasoning = traceLines.join('\n');
        toast(canRetry ? 'Provider gagal — ketik "continue" untuk retry.' : detail, true);
      }
    } finally {
      assistantMsg.streaming = false;
      assistantMsg.finishedAt = Date.now();
      state.streaming = false;
      state.abortController = null;
      syncComposerState();
      if (paintTimer) { clearTimeout(paintTimer); paintTimer = null; }
      persistSessions();
      renderActiveSession();
      renderRecentChats();
    }
  }

  // ---------- GitHub, Automations, MCP, Connections, Diff ----------
  async function loadGithub() {
    const root = $('ks-github-connect-card');
    if (!root) return;
    const messageRoot = $('ks-github-message');
    if (messageRoot) messageRoot.textContent = 'Menghubungi GitHub Changer...';
    state.githubLoaded = true;
    try {
      const status = await api('github-changer-status');
      const s = status || {};
      const statusEl = $('ks-github-status');
      if (statusEl) {
        statusEl.textContent = s.connected ? 'CONNECTED' : 'OFFLINE';
        statusEl.className = 'ks-tag ' + (s.connected ? 'ok' : 'warn');
      }
      if (messageRoot) messageRoot.textContent = s.message || ('Base URL: ' + (s.appUrl || s.baseUrl || 'belum dikonfigurasi'));

      const repos = await api('github-changer-repos').catch(() => ({ repos: [] }));
      const repoRoot = $('ks-github-repos');
      const list = repos.repos || repos.items || [];
      const repoCount = $('ks-github-repo-count');
      if (repoCount) repoCount.textContent = String(list.length);
      if (repoRoot) {
        repoRoot.innerHTML = list.length
          ? list.slice(0, 20).map(r => `<div class="ks-card"><div class="ks-card-head"><span class="ks-card-title">${escapeHtml(r.full_name || r.name || String(r))}</span><span class="ks-tag">${escapeHtml(r.private ? 'private' : 'public')}</span></div></div>`).join('')
          : '<div class="ks-empty">Tidak ada repo terdaftar. Hubungkan GitHub untuk menulis project langsung ke repo.</div>';
      }

      const activity = await api('github-changer-activity').catch(() => ({ entries: [] }));
      const actRoot = $('ks-github-activity');
      if (actRoot) {
        const items = activity.entries || activity.activity || activity.items || [];
        actRoot.innerHTML = items.length
          ? items.slice(0, 20).map(a => `<div class="ks-card"><div class="ks-card-desc"><code>${escapeHtml(a.action || a.type || 'event')}</code> — ${escapeHtml(a.summary || a.message || '')}</div></div>`).join('')
          : '<div class="ks-empty">Belum ada aktivitas Git terbaru.</div>';
      }
    } catch (e) {
      if (messageRoot) messageRoot.textContent = 'GitHub Changer belum tersambung: ' + e.message;
      const statusEl = $('ks-github-status');
      if (statusEl) { statusEl.textContent = 'ERROR'; statusEl.className = 'ks-tag bad'; }
    }
    loadGithubPulls();
  }

  async function loadAutomations() {
    const root = $('ks-automation-cards');
    if (!root) return;
    state.automationsLoaded = true;
    root.innerHTML = '<div class="ks-empty">Memuat workflow otomasi...</div>';
    try {
      const data = await api('workflow-list');
      const items = data.workflows || data.items || [];
      root.innerHTML = items.length
        ? items.map(w => `
            <div class="ks-card">
              <div class="ks-card-head">
                <span class="ks-card-title">${escapeHtml(w.name || w.title || w.id || 'Workflow')}</span>
                <span class="ks-tag ${String(w.status || '').toLowerCase() === 'active' ? 'ok' : ''}">${escapeHtml(w.status || 'idle')}</span>
              </div>
              <div class="ks-card-desc">${escapeHtml(w.description || w.summary || 'N100N / RNA Router automation pipeline')}</div>
              <div class="ks-card-meta">
                <span class="ks-tag">trigger: ${escapeHtml(w.trigger || 'manual / cron')}</span>
                <span class="ks-tag">${(w.stages || []).length || 0} stage</span>
              </div>
            </div>`).join('')
        : '<div class="ks-empty"><strong>Belum ada workflow</strong>Buat otomasi N100N atau RNA Router dari panel integrasi.</div>';
    } catch (e) {
      root.innerHTML = `<div class="ks-empty error">Workflow tidak dapat dimuat: ${escapeHtml(e.message)}</div>`;
    }
  }

  // ---------- GitHub pull request workflow ----------
  async function loadGithubPulls() {
    const listRoot = $('ks-gh-pr-list');
    const msg = $('ks-gh-message');
    const readyTag = $('ks-gh-ready');
    if (!listRoot) return;
    listRoot.innerHTML = '<div class="ks-empty">Membaca pull request…</div>';
    try {
      const branches = await api('github-branches');
      const ready = branches.ready !== false;
      state.githubReady = ready;
      if (readyTag) {
        readyTag.textContent = ready ? 'TOKEN OK' : 'NO TOKEN';
        readyTag.className = 'ks-tag ' + (ready ? 'ok' : 'warn');
      }
      // Hide the write form entirely when the server has no token, rather than
      // showing a form whose submit is guaranteed to 503.
      const prCard = $('ks-gh-pr-card');
      if (prCard) {
        prCard.classList.toggle('hidden', !ready || !capabilities().canGithubWrite);
      }
      const list = $('ks-gh-branch-list');
      if (list) {
        list.innerHTML = (branches.branches || []).map(b => `<option value="${escapeAttr(b.name)}">`).join('');
      }
      const info = $('ks-gh-branch-info');
      if (info && branches.repo) info.innerHTML = `<span class="ks-tag">repo: ${escapeHtml(branches.repo)}</span><span class="ks-tag">${(branches.branches || []).length} branch</span>`;

      const data = await api('github-pulls', { query: { state: 'open' } });
      const pulls = data.pullRequests || [];
      if (msg) {
        msg.textContent = ready
          ? 'KRA dapat membuat dan me-merge pull request ke repo ini.'
          : 'Baca branch/PR tetap jalan, tapi create & merge butuh GITHUB_TOKEN pada environment server KRA.';
      }
      listRoot.innerHTML = pulls.length ? pulls.map(pr => `
        <div class="ks-card">
          <div class="ks-card-head">
            <span class="ks-card-title">#${pr.number} ${escapeHtml(pr.title)}</span>
            <span class="ks-tag ${pr.draft ? 'warn' : 'ok'}">${pr.draft ? 'DRAFT' : String(pr.state || '').toUpperCase()}</span>
          </div>
          <div class="ks-card-meta">
            <span class="ks-tag">${escapeHtml(pr.head)} → ${escapeHtml(pr.base)}</span>
            <span class="ks-tag">by ${escapeHtml(pr.user || '—')}</span>
            ${pr.url ? `<a class="ks-btn" href="${escapeAttr(pr.url)}" target="_blank" rel="noopener">Buka</a>` : ''}
            ${capabilities().canGithubWrite && state.githubReady ? `<button class="ks-btn primary" type="button" data-merge-pr="${pr.number}">Merge ke ${escapeHtml(pr.base)}</button>` : (capabilities().canGithubWrite ? '<span class="ks-tag" title="Merge butuh GITHUB_TOKEN di server KRA.">merge: tanpa token</span>' : '<span class="ks-tag" title="Merge butuh workspace admin.">merge: admin saja</span>')}
          </div>
        </div>`).join('') : '<div class="ks-empty">Tidak ada pull request terbuka.</div>';
    } catch (e) {
      if (msg) msg.textContent = 'GitHub PR: ' + e.message;
      listRoot.innerHTML = `<div class="ks-empty error">${escapeHtml(e.message)}</div>`;
    }
  }

  async function createPullRequest() {
    const btn = $('ks-gh-pr-create');
    const result = $('ks-gh-pr-result');
    const title = ($('ks-gh-pr-title')?.value || '').trim();
    const head = ($('ks-gh-pr-head')?.value || '').trim();
    const base = ($('ks-gh-pr-base')?.value || 'main').trim();
    const body = ($('ks-gh-pr-body')?.value || '').trim();
    const draft = Boolean($('ks-gh-pr-draft')?.checked);
    if (!title || !head) { toast('Judul dan branch sumber wajib diisi.', true); return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Membuat…'; }
    try {
      const res = await api('github-pr-create', { method: 'POST', body: JSON.stringify({ title, head, base, body, draft }) });
      if (result) { result.textContent = 'PR #' + res.number + ' dibuat'; result.className = 'ks-tag ok'; }
      toast(res.message || 'Pull request dibuat.');
      $('ks-gh-pr-title').value = '';
      $('ks-gh-pr-body').value = '';
      await loadGithubPulls();
    } catch (e) {
      if (result) { result.textContent = e.message; result.className = 'ks-tag bad'; }
      toast('Create PR gagal: ' + e.message, true);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Create PR'; }
    }
  }

  async function mergePullRequest(number, base) {
    if (!number) return;
    if (!window.confirm('Merge pull request #' + number + ' ke ' + (base || 'main') + '?')) return;
    try {
      const res = await api('github-pr-merge', { method: 'POST', body: JSON.stringify({ number, method: 'merge' }) });
      toast(res.message || ('PR #' + number + ' di-merge.'));
      await loadGithubPulls();
    } catch (e) {
      toast('Merge gagal: ' + e.message, true);
    }
  }

  async function loadSkills() {
    const root = $('ks-mcp-cards');
    if (!root) return;
    state.skillsLoaded = true;
    root.innerHTML = '<div class="ks-empty">Memuat skill hub…</div>';
    try {
      // catalog() returns an object keyed by skill id, not an array.
      const [data, hub] = await Promise.all([
        api('skills'),
        api('skill-hub').catch(() => null),
      ]);
      const raw = data.skills || {};
      const list = Array.isArray(raw) ? raw : Object.entries(raw).map(([id, sk]) => Object.assign({ id }, sk));
      state.skills = list;
      const canEdit = capabilities().wsAdmin;
      const hubState = (hub && hub.hub) || {};
      const disabledFor = {};
      Object.entries(hubState.agents || {}).forEach(([agentId, entry]) => {
        (entry.disabled || []).forEach(skillId => {
          disabledFor[skillId] = disabledFor[skillId] || [];
          disabledFor[skillId].push(agentId);
        });
      });

      const approved = list.filter(sk => sk.approved !== false).length;
      const pending = list.length - approved;
      const agentOptions = (state.agents || []).map(a => `<option value="${escapeAttr(a.id || a.name)}">${escapeHtml(a.name || a.id)}</option>`).join('');

      const header = `
        <div class="ks-card ks-skill-summary">
          <div class="ks-card-head">
            <span class="ks-card-title">Skill lokal</span>
            <span class="ks-tag ${list.length ? 'ok' : 'warn'}">${list.length} terdeteksi</span>
          </div>
          <div class="ks-card-desc">
            ${approved} tersetujui · ${pending} menunggu approval · sumber <code>resources/skills</code>.
            ${canEdit ? 'Ubah status per agent di bawah.' : 'Perubahan skill butuh workspace admin.'}
          </div>
          ${canEdit ? `<div class="ks-card-meta">
            <select id="ks-skill-agent" class="ks-select">${agentOptions}</select>
            <span class="ks-tag" id="ks-skill-toggle-result">pilih skill lalu Enable/Disable</span>
          </div>` : ''}
        </div>`;

      root.innerHTML = header + (list.length
        ? list.map(sk => {
            const lockState = sk.approved === false ? 'PENDING' : (sk.drift ? 'DRIFT' : 'LOCKED');
            const tone = sk.approved === false ? 'warn' : (sk.drift ? 'bad' : 'ok');
            const off = (disabledFor[sk.id] || []).length;
            return `
            <div class="ks-card">
              <div class="ks-card-head">
                <span class="ks-card-title">${escapeHtml(sk.name || sk.id || 'Skill')}</span>
                <span class="ks-tag ${tone}">${lockState}</span>
                ${off ? `<span class="ks-tag warn">off di ${off} agent</span>` : ''}
                <div class="ks-card-actions">
                  <button class="ks-btn" type="button" data-skill-read="${escapeAttr(sk.id || '')}">Baca</button>
                  ${canEdit && sk.approved !== false ? `
                    <button class="ks-btn" type="button" data-skill-enable="${escapeAttr(sk.id || '')}">Enable</button>
                    <button class="ks-btn" type="button" data-skill-disable="${escapeAttr(sk.id || '')}">Disable</button>` : ''}
                </div>
              </div>
              <div class="ks-card-desc">${escapeHtml(sk.description || sk.summary || 'Tanpa deskripsi di frontmatter SKILL.md.')}</div>
              <div class="ks-card-meta">
                <span class="ks-tag">id: ${escapeHtml(sk.id || '')}</span>
                <span class="ks-tag">source: ${escapeHtml(sk.source || 'local')}</span>
                <span class="ks-tag">${Number(sk.bytes || 0).toLocaleString()} byte</span>
              </div>
            </div>`;
          }).join('')
        : '<div class="ks-empty"><strong>Tidak ada SKILL.md terdeteksi</strong>Letakkan folder skill di <code>resources/skills/&lt;nama&gt;/SKILL.md</code>, lalu jalankan skill lock sebelum bisa diaktifkan.</div>');
    } catch (e) {
      root.innerHTML = `<div class="ks-empty error">Skill tidak dapat dimuat: ${escapeHtml(e.message)}</div>`;
    }
  }

  async function readSkill(id) {
    if (!id) return;
    try {
      const data = await api('skill-read', { query: { id } });
      const wrap = $('ks-diff-wrap');
      const title = $('ks-diff-title');
      const body = $('ks-diff-body');
      if (title) title.textContent = 'SKILL.md — ' + id;
      if (body) body.textContent = data.content || '';
      if (wrap) { wrap.classList.remove('hidden'); wrap.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    } catch (e) {
      toast('Skill tidak dapat dibaca: ' + e.message, true);
    }
  }

  /**
   * Toggle a skill for the selected agent. Goes through skill-toggle:
   * preview first (no writes), then re-send with approved:true.
   */
  async function toggleSkill(skillId, enabled) {
    const agentSel = $('ks-skill-agent');
    const agentId = agentSel ? agentSel.value : '';
    const result = $('ks-skill-toggle-result');
    if (!agentId) { toast('Pilih agent dulu.', true); return; }
    if (!skillId) return;
    const base = { agentId, skillId, enabled, priority: 100 };
    try {
      const preview = await api('skill-toggle', { method: 'POST', body: JSON.stringify(base) });
      const summary = preview.proposal && preview.proposal.summary ? preview.proposal.summary : (`${enabled ? 'Enable' : 'Disable'} ${skillId} untuk ${agentId}`);
      if (!window.confirm(summary + '\n\nTerapkan sekarang?')) {
        if (result) { result.textContent = 'Dibatalkan.'; result.className = 'ks-tag'; }
        return;
      }
      const applied = await api('skill-toggle', { method: 'POST', body: JSON.stringify(Object.assign({}, base, { approved: true })) });
      if (result) { result.textContent = 'Tersimpan: ' + (applied.change ? applied.change.skillId : skillId); result.className = 'ks-tag ok'; }
      toast('Skill ' + skillId + ' ' + (enabled ? 'diaktifkan' : 'dinonaktifkan') + ' untuk ' + agentId + '.');
      state.skillsLoaded = false;
      loadSkills();
    } catch (e) {
      if (result) { result.textContent = e.message; result.className = 'ks-tag bad'; }
      toast('Gagal mengubah skill: ' + e.message, true);
    }
  }

  async function loadConnections() {
    const provRoot = $('ks-providers-cards');
    const harnessRoot = $('ks-harness-cards');
    state.connectionsLoaded = true;

    if (provRoot) {
      provRoot.innerHTML = '<div class="ks-empty">Membaca provider configuration...</div>';
      try {
        const data = await api('providers');
        const cfg = data.config || {};
        const provs = cfg.providers || {};
        const names = Object.keys(provs);
        provRoot.innerHTML = names.length ? names.map(name => {
          const p = provs[name];
          return `
            <div class="ks-card">
              <div class="ks-card-head">
                <span class="ks-card-title">${escapeHtml(name)}</span>
                <span class="ks-tag ${p.apiKeyConfigured ? 'ok' : 'warn'}">${p.apiKeyConfigured ? 'KEY OK' : 'NO KEY'}</span>
                <div class="ks-card-actions"><span class="ks-tag">${escapeHtml(p.availableModel || p.model || '')}</span></div>
              </div>
              <div class="ks-card-desc">baseUrl: <code>${escapeHtml(p.baseUrl || 'local')}</code>${p.fallbackProvider ? ' • fallback: ' + escapeHtml(p.fallbackProvider) : ''}</div>
            </div>`;
        }).join('') : '<div class="ks-empty">Belum ada provider pada config.json.</div>';
      } catch (e) {
        provRoot.innerHTML = `<div class="ks-empty error">Provider gagal dimuat: ${escapeHtml(e.message)}</div>`;
      }
    }

    if (harnessRoot) {
      harnessRoot.innerHTML = '<div class="ks-empty">Membaca harness profile…</div>';
      try {
        const hdata = await api('harness');
        state.harnessProfiles = hdata.profiles || {};
      } catch (e) {
        harnessRoot.innerHTML = `<div class="ks-empty error">Harness gagal dimuat: ${escapeHtml(e.message)}</div>`;
      }
      const profiles = Object.values(state.harnessProfiles || {});
      harnessRoot.innerHTML = profiles.length ? profiles.map(h => `
        <div class="ks-card">
          <div class="ks-card-head">
            <span class="ks-card-title">${escapeHtml(h.name)}</span>
            <span class="ks-tag ${h.active ? 'ok' : 'warn'}">${escapeHtml(h.badge)}</span>
          </div>
          <div class="ks-card-desc">${escapeHtml(h.description)}</div>
          <div class="ks-card-meta">
            <span class="ks-tag">auth: ${escapeHtml(h.authType)}</span>
            <span class="ks-tag">provider: ${escapeHtml(h.provider)}</span>
            <span class="ks-tag">model: ${escapeHtml(h.defaultModel)}</span>
          </div>
        </div>`).join('') : '<div class="ks-empty">Harness profile belum dimuat.</div>';
    }

    loadTelegramBridge();
  }

  // ---------- Telegram bridge (existing KRA Telegram bot) ----------
  function telegramTone(status) {
    const el = $('ks-telegram-status');
    if (!el) return;
    const configured = Boolean(status.configured);
    const paired = Boolean(status.paired);
    el.textContent = !configured ? 'BELUM DIKONFIGURASI' : (paired ? 'TERHUBUNG' : 'SIAP PAIRING');
    el.className = 'ks-tag ' + (!configured ? 'warn' : (paired ? 'ok' : 'warn'));
  }

  async function loadTelegramBridge() {
    const msg = $('ks-telegram-message');
    const status = $('ks-telegram-status');
    if (!status) return;
    if (status.dataset.busy === '1') return;
    status.dataset.busy = '1';
    try {
      const data = await api('telegram-config');
      const t = data.telegram || {};
      telegramTone(t);
      if (msg) {
        msg.textContent = !t.configured
          ? 'Bot token Telegram belum disimpan di server KRA. Simpan token dari @BotFather untuk mengaktifkan bridge.'
          : (t.paired
            ? 'Bot terhubung ke chat "' + (t.chatTitle || 'pribadi') + '". ' + (t.environmentManaged ? 'Dikelola via environment server.' : 'Dikelola dari pengaturan workspace.')
            : 'Token tersimpan. Buat kode pairing lalu kirim /start KODE ke bot Telegram Anda.');
      }
      const bot = $('ks-telegram-bot');
      if (bot) bot.textContent = 'bot: ' + (t.configured ? (t.environmentManaged ? 'ENV' : 'TERSIMPAN') : '—');
      const chat = $('ks-telegram-chat');
      if (chat) chat.textContent = 'chat: ' + (t.chatTitle || (t.paired ? 'terpasang' : '—'));
    } catch (e) {
      if (msg) msg.textContent = 'Telegram bridge: ' + e.message;
      if (status) { status.textContent = 'TIDAK TERSEDIA'; status.className = 'ks-tag bad'; }
    } finally {
      status.dataset.busy = '';
    }
  }

  async function telegramAction(action, body, button) {
    const msg = $('ks-telegram-message');
    const label = button ? button.textContent : '';
    if (button) { button.disabled = true; button.textContent = '…'; }
    try {
      const res = await api(action, { method: 'POST', body: JSON.stringify(body || {}) });
      if (msg) msg.textContent = res.message || res.pairingCode || 'OK';
      toast('Telegram ' + action.replace('telegram-', '') + ': OK');
      await loadTelegramBridge();
      return res;
    } catch (e) {
      if (msg) msg.textContent = 'Telegram error: ' + e.message;
      toast('Telegram gagal: ' + e.message, true);
      return null;
    } finally {
      if (button) { button.disabled = false; button.textContent = label; }
    }
  }

  async function loadDiffQueue() {
    const root = $('ks-code-cards');
    if (!root) return;
    state.diffLoaded = true;
    root.innerHTML = '<div class="ks-empty">Memuat antrean proposal & diff...</div>';
    try {
      const data = await api('tasks');
      const raw = data.tasks || data.items || {};
      const list = Array.isArray(raw) ? raw : Object.values(raw);
      const actionable = list.filter(t => t && t.status && /WAIT|PENDING|PROPOSED|REVIEW/i.test(String(t.status)));
      root.innerHTML = list.length ? list.map(t => {
        const status = String(t.status || 'PENDING').toUpperCase();
        const tone = /WAIT|PENDING|PROPOSED|REVIEW/.test(status) ? 'warn' : (/DONE|EXECUTED|APPROVED|COMPLETED/.test(status) ? 'ok' : 'bad');
        return `
        <div class="ks-card">
          <div class="ks-card-head">
            <span class="ks-card-title">${escapeHtml(t.title || t.id)}</span>
            <span class="ks-tag ${tone}">${escapeHtml(status)}</span>
            ${/WAIT|PENDING|PROPOSED|REVIEW/.test(status) ? `<div class="ks-card-actions"><button type="button" class="ks-btn" data-diff-task="${escapeAttr(t.id)}">Lihat Diff</button></div>` : ''}
          </div>
          <div class="ks-card-desc">Target: <code>${escapeHtml(t.targetFile || t.target || '—')}</code> • Agent: ${escapeHtml(t.agentId || t.agent || 'system')}</div>
        </div>`;
      }).join('') : '<div class="ks-empty"><strong>Antrean bersih</strong>Tidak ada proposal menunggu persetujuan.</div>';
      state.diffPending = actionable.length;
      updateDiffMeter();
    } catch (e) {
      root.innerHTML = `<div class="ks-empty error">Task gagal dimuat: ${escapeHtml(e.message)}</div>`;
    }
  }

  async function showTaskDiff(taskId) {
    const wrap = $('ks-diff-wrap');
    const body = $('ks-diff-body');
    const title = $('ks-diff-title');
    if (!wrap || !body) return;
    wrap.classList.remove('hidden');
    if (title) title.textContent = 'Diff • ' + taskId;
    body.textContent = 'Memuat perbandingan berkas...';
    try {
      const data = await api('task-preview', { query: { taskId } });
      const before = String(data.beforeContent || '');
      const after = String(data.proposedContent || data.content || '');
      body.innerHTML = renderSimpleDiff(before, after);
    } catch (e) {
      body.textContent = 'Gagal memuat diff: ' + e.message;
    }
  }

  function renderSimpleDiff(before, after) {
    const b = before.split('\n');
    const a = after.split('\n');
    let html = '';
    const max = Math.max(b.length, a.length);
    for (let i = 0; i < max; i++) {
      if (b[i] === a[i]) {
        html += `<div class="ks-diff-line">  ${escapeHtml(a[i] === undefined ? '' : a[i])}</div>`;
      } else {
        if (b[i] !== undefined) html += `<div class="ks-diff-line del">- ${escapeHtml(b[i])}</div>`;
        if (a[i] !== undefined) html += `<div class="ks-diff-line add">+ ${escapeHtml(a[i])}</div>`;
      }
    }
    return html || '<div class="ks-empty">Tidak ada isi berkas.</div>';
  }

  // ---------- Global Open / Close ----------
  function openStudio() {
    state.open = true;
    const root = $('kra-studio');
    if (root) root.classList.remove('hidden');
    document.body.classList.add('kra-studio-active');
    setView(state.view || 'chat');
    renderTerminalOutput();
    syncComposerState();
  }

  function closeStudio() {
    state.open = false;
    const root = $('kra-studio');
    if (root) root.classList.add('hidden');
    document.body.classList.remove('kra-studio-active');
  }

  // ---------- Event Listeners Binding ----------
  function bindEvents() {
    // Navigation items
    $$('.ks-nav-item').forEach(btn => {
      btn.addEventListener('click', () => setView(btn.dataset.view));
    });

    // Exit back home
    $('ks-btn-back')?.addEventListener('click', () => window.KRA_SetAppMode?.('creator', true));
    $('ks-btn-exit')?.addEventListener('click', () => window.KRA_SetAppMode?.('creator', true));
    $('ks-btn-login')?.addEventListener('click', goLogin);
    $('ks-login-gate-btn')?.addEventListener('click', goLogin);
    $('ks-btn-logout')?.addEventListener('click', doLogout);
    $('kra-studio-open')?.addEventListener('click', openStudio);
    $('ks-router-refresh')?.addEventListener('click', refreshRouterStatus);
    $('ks-router-rna-test')?.addEventListener('click', testRnaRoute);
    $('ks-router-rna-models')?.addEventListener('click', showRnaModels);
    $('ks-mode-office')?.addEventListener('click', () => window.KRA_SetAppMode?.('office', true));
    $('ks-mode-creator')?.addEventListener('click', () => window.KRA_SetAppMode?.('creator', true));

    // Attachment picker (reuse native browser File API and server-side validation).
    const fileInput = $('ks-attach-input');
    $('ks-attach-btn')?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', () => {
      const next = Array.from(fileInput.files || []);
      if (state.attachments.length + next.length > 5) { toast('Maksimal 5 file per pesan.', true); fileInput.value = ''; return; }
      state.attachments.push(...next);
      renderAttachments();
      fileInput.value = '';
    });

    // Recent sessions: clear local history
    $('ks-recents-clear')?.addEventListener('click', () => {
      state.sessions = [{ id: 'session_kra_office', title: 'KRA Office', time: 'Baru', model: state.activeModel, mode: 'Agent', tasks: [], messages: [] }];
      state.activeSessionId = 'session_kra_office';
      persistSessions();
      renderRecentChats(); renderActiveSession();
    });

    // GitHub view actions
    $('ks-github-refresh')?.addEventListener('click', () => { state.githubLoaded = false; loadGithub(); });
    $('ks-gh-refresh')?.addEventListener('click', loadGithubPulls);
    $('ks-gh-pr-create')?.addEventListener('click', createPullRequest);
    $('ks-gh-pr-list')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-merge-pr]');
      if (!btn) return;
      mergePullRequest(Number(btn.getAttribute('data-merge-pr')), $('ks-gh-pr-base')?.value || 'main');
    });
    $('ks-mcp-cards')?.addEventListener('click', (e) => {
      const readBtn = e.target.closest('[data-skill-read]');
      if (readBtn) { readSkill(readBtn.getAttribute('data-skill-read')); return; }
      const enableBtn = e.target.closest('[data-skill-enable]');
      if (enableBtn) { toggleSkill(enableBtn.getAttribute('data-skill-enable'), true); return; }
      const disableBtn = e.target.closest('[data-skill-disable]');
      if (disableBtn) { toggleSkill(disableBtn.getAttribute('data-skill-disable'), false); }
    });

    // Settings
    $('ks-settings-login')?.addEventListener('click', goLogin);
    $('ks-settings-logout')?.addEventListener('click', doLogout);
    $('ks-settings-model-pick')?.addEventListener('click', openModelModal);
    $('ks-settings-quota-refresh')?.addEventListener('click', loadSettingsQuota);
    $('ks-settings-project-browse')?.addEventListener('click', () => browseProjectFolder());
    $('ks-settings-browser')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-browse-dir]');
      if (btn) browseProjectFolder(btn.getAttribute('data-browse-dir'));
    });
    $('ks-settings-project-save')?.addEventListener('click', async () => {
      const path = ($('ks-settings-project-path')?.value || '').trim();
      const result = $('ks-settings-project-result');
      if (!path) { toast('Path project kosong.', true); return; }
      try {
        const check = await api('project-path', { query: { mode: 'check', path } });
        if (check.valid === false) {
          if (result) { result.textContent = check.error || 'Path tidak valid'; result.className = 'ks-tag bad'; }
          toast(check.error || 'Path project tidak valid untuk workspace ini.', true);
          return;
        }
        await api('project-default', { method: 'POST', body: JSON.stringify({ root: path }) });
        state.projectRoot = path;
        state.filesTree = [];
        if (result) { result.textContent = 'Tersimpan'; result.className = 'ks-tag ok'; }
        toast('Project path disimpan.');
        state.filesLoaded = false;
      } catch (e) {
        if (result) { result.textContent = e.message; result.className = 'ks-tag bad'; }
        toast('Gagal menyimpan path: ' + e.message, true);
      }
    });
    $('ks-settings-clear-chats')?.addEventListener('click', () => {
      if (!window.confirm('Hapus semua sesi chat KRA Office di browser ini?')) return;
      try { localStorage.removeItem(SESSION_KEY); } catch (_) {}
      state.sessions = [];
      state.activeSessionId = '';
      hydrate();
      toast('Semua sesi chat dihapus.');
    });
    $('ks-settings-clear-all')?.addEventListener('click', () => {
      if (!window.confirm('Hapus tema, preferensi, dan seluruh data lokal KRA Office?')) return;
      try { localStorage.removeItem(SETTINGS_KEY); localStorage.removeItem(SESSION_KEY); } catch (_) {}
      location.reload();
    });
    $('ks-settings-reset')?.addEventListener('click', () => {
      if (!window.confirm('Kembalikan tema dan preferensi ke default?')) return;
      saveSettings({ theme: 'cream', compact: false, monoTools: true, autoSpoiler: true, showTimer: true, density: 'normal' });
      ['ks-opt-compact', 'ks-opt-mono', 'ks-opt-autospoiler', 'ks-opt-timer', 'ks-opt-density'].forEach(id => { const el = $(id); if (el) el.dataset.bound = ''; });
      loadSettings();
      toast('Preferensi dikembalikan ke default.');
    });
    $('ks-github-sync')?.addEventListener('click', async () => {
      try { await api('github-changer-sync', { method: 'POST', body: '{}' }); toast('GitHub sync dimulai.'); }
      catch (e) { toast('Sync gagal: ' + e.message, true); }
    });
    $('ks-github-open')?.addEventListener('click', async () => {
      try {
        const current = await api('github-changer-config');
        const baseUrl = window.prompt('GitHub Changer base URL', current.githubChanger?.baseUrl || '');
        if (baseUrl === null) return;
        const apiKey = window.prompt('GitHub API key / token (kosongkan untuk tetap)', '') || '';
        await api('github-changer-config', { method: 'POST', body: JSON.stringify({ base_url: baseUrl, api_key: apiKey }) });
        toast('Pengaturan GitHub disimpan.');
        state.githubLoaded = false; loadGithub();
      } catch (e) { toast('Gagal menyimpan GitHub: ' + e.message, true); }
    });

    // New chat
    $('ks-btn-newchat')?.addEventListener('click', () => {
      const id = 'session_' + Date.now();
      const newS = {
        id,
        title: 'Percakapan Baru ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        time: 'Baru',
        model: state.activeModel,
        mode: state.mode,
        tasks: [],
        messages: [
          {
            role: 'assistant',
            content: 'KRA Studio siap. Ketik instruksi — agent akan benar-benar memanggil model, menjalankan tool yang diizinkan (read_file, run_audit, web_search, get_telemetry, stage_proposal), lalu menampilkan langkah yang dieksekusi beserta jawaban akhir.'
          }
        ]
      };
      state.sessions.unshift(newS);
      selectSession(id);
    });

    // Model selectors
    $('ks-topbar-model-pill')?.addEventListener('click', openModelModal);
    $('ks-composer-model-pill')?.addEventListener('click', openModelModal);
    $('ks-topbar-tools-pill')?.addEventListener('click', () => setView('tools'));
    $('ks-modal-close')?.addEventListener('click', closeModelModal);
    $('ks-model-modal')?.addEventListener('click', (e) => {
      if (e.target === $('ks-model-modal')) closeModelModal();
    });

    // Tools button in composer & nav
    $('ks-composer-tools-btn')?.addEventListener('click', () => setView('tools'));

    // Tool search filter
    $('ks-tool-search')?.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      const grid = $('ks-tools-catalog-grid');
      if (!grid) return;
      $$('.ks-tool-item', grid).forEach(item => {
        item.style.display = !q || item.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
      $$('.ks-tools-cat', grid).forEach(head => { head.style.display = q ? 'none' : ''; });
    });

    // Files refresh
    $('ks-btn-refresh-files')?.addEventListener('click', () => {
      state.filesTree = [];
      loadFilesTree(state.filePath || '');
    });
    $('ks-files-up')?.addEventListener('click', filesGoUp);

    // Diff queue delegation
    $('ks-code-cards')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-diff-task]');
      if (btn) showTaskDiff(btn.getAttribute('data-diff-task'));
    });

    // Settings icon in topbar
    $$('[data-studio-view]').forEach(btn => {
      btn.addEventListener('click', () => setView(btn.dataset.studioView));
    });

    // Mode chips
    $$('.ks-chip[data-mode]').forEach(chip => {
      chip.addEventListener('click', () => {
        $$('.ks-chip[data-mode]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.mode = chip.dataset.mode;
        toast('Execution mode: ' + state.mode);
      });
    });

    // Send/Stop button: one control that swaps based on run state.
    $('ks-composer-send')?.addEventListener('click', sendChatMessage);

    // Composer: auto-grow, Enter sends, Shift+Enter newline, Esc stops.
    const composerInput = $('ks-composer-input');
    composerInput?.addEventListener('input', () => {
      composerInput.style.height = 'auto';
      composerInput.style.height = Math.min(composerInput.scrollHeight, 220) + 'px';
    });
    composerInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });

    // Peek to terminal event delegation
    $('ks-chat-inner')?.addEventListener('click', (e) => {
      const peekBtn = e.target.closest('[data-peek-cmd]');
      if (peekBtn) {
        const cmd = peekBtn.getAttribute('data-peek-cmd') || '';
        const out = peekBtn.getAttribute('data-peek-out') || '';
        handlePeekToTerminal(cmd, out);
      }
    });

    // Terminal command input
    $('ks-term-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = $('ks-term-input');
      if (!inp) return;
      const cmd = inp.value;
      inp.value = '';
      executeTerminalCommand(cmd);
    });
    $('ks-term-clear')?.addEventListener('click', () => {
      state.terminalHistory = [];
      renderTerminalOutput();
    });

    // Browser view buttons
    $('ks-browser-btn-goto')?.addEventListener('click', () => {
      const url = $('ks-browser-url-input')?.value || 'http://127.0.0.1:80/kantor-rama-ai/web/index.html';
      triggerBrowserAction('goto', { url });
    });
    $('ks-browser-btn-click')?.addEventListener('click', () => {
      const selector = $('ks-browser-sel-input')?.value || 'button.app-mode-btn';
      triggerBrowserAction('click', { selector });
    });
    $('ks-browser-btn-shot')?.addEventListener('click', () => triggerBrowserAction('screenshot'));

    // SSH actions delegation
    $('ks-ssh-hosts-list')?.addEventListener('click', async (e) => {
      const testBtn = e.target.closest('[data-ssh-test]');
      if (testBtn) {
        const id = testBtn.getAttribute('data-ssh-test');
        setSshBadge(id, 'TESTING', '');
        try {
          const res = await api('studio-ssh', { method: 'POST', body: JSON.stringify({ op: 'test', hostId: id }) });
          if (res.ok) {
            setSshBadge(id, res.mode === 'tcp-only' ? 'TCP OK' : 'TERHUBUNG', 'ok');
            toast('SSH ' + (res.host || id) + ' OK (' + (res.latencyMs || '?') + 'ms, ' + (res.mode || 'live') + ')');
          } else {
            setSshBadge(id, 'GAGAL', 'bad');
            toast('SSH gagal: ' + (res.error || res.mode || 'tidak tersedia'), true);
          }
        } catch (err) {
          setSshBadge(id, 'GAGAL', 'bad');
          toast('SSH failed: ' + err.message, true);
        }
      }
      const sftpBtn = e.target.closest('[data-ssh-sftp]');
      if (sftpBtn) {
        const id = sftpBtn.getAttribute('data-ssh-sftp');
        const panel = $('ks-sftp-panel');
        const listEl = $('ks-sftp-list');
        const titleEl = $('ks-sftp-title');
        const pathEl = $('ks-sftp-path');
        if (panel && listEl) {
          panel.classList.remove('hidden');
          if (titleEl) titleEl.textContent = 'sFTP • ' + id;
          listEl.innerHTML = '<div class="ks-empty">Memuat daftar direktori remote...</div>';
          try {
            const res = await api('studio-ssh', { method: 'POST', body: JSON.stringify({ op: 'sftp', hostId: id }) });
            if (pathEl) pathEl.textContent = res.path || '/var/www';
            const entries = res.entries || [];
            listEl.innerHTML = entries.length ? entries.map(ent => `
              <div class="ks-sftp-row">
                <span class="ks-sftp-icon">${ent.kind === 'directory' ? '📁' : '📄'}</span>
                <span class="ks-sftp-name">${escapeHtml(ent.name)}</span>
                <span class="ks-sftp-perm">${escapeHtml(ent.perm || '')}</span>
                <span class="ks-sftp-size">${ent.size ? (Math.round(ent.size / 1024 * 10) / 10) + ' KB' : '—'}</span>
              </div>
            `).join('') : '<div class="ks-empty">Direktori kosong.</div>';
          } catch (err) {
            listEl.innerHTML = `<div class="ks-empty error">Gagal memuat sFTP: ${escapeHtml(err.message)}</div>`;
          }
        }
      }
      const termBtn = e.target.closest('[data-ssh-term]');
      if (termBtn) {
        const id = termBtn.getAttribute('data-ssh-term');
        // Point the composer at this host instead of printing a fake session banner.
        state.terminalHost = id;
        state.terminalHistory.push({ type: 'meta', text: 'Target SSH aktif: ' + id + ' — perintah berikut dikirim lewat bridge SSH.' });
        if ($('ks-sftp-panel')) $('ks-sftp-panel').classList.add('hidden');
        renderTerminalOutput();
        toast('Target SSH diatur ke ' + id + '.');
        setView('terminal');
      }
    });

    $('ks-sftp-close')?.addEventListener('click', () => {
      $('ks-sftp-panel')?.classList.add('hidden');
    });

    // WhatsApp test button
    $('ks-btn-whatsapp-test')?.addEventListener('click', async () => {
      const msg = $('ks-whatsapp-message');
      if (msg) msg.textContent = 'Mengirim ping uji…';
      try {
        const res = await api('studio-whatsapp', { method: 'POST', body: JSON.stringify({ message: 'KRA Office relay test ping' }) });
        if (res.ok) {
          toast('Relay WhatsApp: terkirim ke ' + (res.target || 'relay'));
          if (msg) msg.textContent = 'Terkirim ke ' + (res.target || 'relay') + ' (HTTP ' + (res.status || 200) + ').';
        } else {
          toast('Relay WhatsApp belum siap: ' + (res.error || res.mode || 'unavailable'), true);
          if (msg) msg.textContent = 'Belum terkirim — ' + (res.error || res.notice || res.mode || 'relay belum dikonfigurasi') + '.';
        }
      } catch (e) {
        toast('Relay gagal: ' + e.message, true);
        if (msg) msg.textContent = 'Relay gagal: ' + e.message;
      }
    });

    // Telegram bridge (uses the existing KRA Telegram bot)
    $('ks-telegram-save')?.addEventListener('click', (e) => {
      const token = ($('ks-telegram-token')?.value || '').trim();
      telegramAction('telegram-config', { bot_token: token }, e.currentTarget)
        .then((res) => { if (res) { const t = $('ks-telegram-token'); if (t) t.value = ''; } });
    });
    $('ks-telegram-pairing')?.addEventListener('click', async (e) => {
      const res = await telegramAction('telegram-pairing', {}, e.currentTarget);
      const codeEl = $('ks-telegram-pairing-code');
      if (codeEl) codeEl.textContent = res?.pairingCode ? ('Kirim "/start ' + res.pairingCode + '" ke bot Telegram Anda dalam 10 menit.') : '';
      if (res?.pairingCode) {
        try { await navigator.clipboard.writeText('/start ' + res.pairingCode); toast('Kode pairing disalin.'); } catch (_) {}
      }
    });
    $('ks-telegram-webhook')?.addEventListener('click', (e) => telegramAction('telegram-set-webhook', {}, e.currentTarget));
    $('ks-telegram-test')?.addEventListener('click', (e) => telegramAction('telegram-test', {}, e.currentTarget));
    $('ks-telegram-disconnect')?.addEventListener('click', (e) => telegramAction('telegram-disconnect', {}, e.currentTarget));

    // BYOK save button
    $('ks-byok-save')?.addEventListener('click', async () => {
      const name = ($('ks-byok-name')?.value || '').trim().toLowerCase();
      const baseUrl = ($('ks-byok-base')?.value || '').trim();
      const model = ($('ks-byok-model')?.value || '').trim();
      const apiKey = ($('ks-byok-key')?.value || '').trim();
      if (!name || !baseUrl) {
        toast('Provider ID dan Base URL wajib diisi.', true);
        return;
      }
      try {
        await api('provider-settings', {
          method: 'POST',
          body: JSON.stringify({
            providers: {
              [name]: { baseUrl, model, apiKey }
            }
          })
        });
        toast('Provider ' + name + ' berhasil disimpan.');
        state.connectionsLoaded = false;
        loadConnections();
      } catch (err) {
        toast('Gagal menyimpan provider: ' + err.message, true);
      }
    });

    // Harness reload
    $('ks-btn-harness-refresh')?.addEventListener('click', async () => {
      state.connectionsLoaded = false;
      await loadConnections();
      toast('Connections dimuat ulang dari server.');
    });

    // SSH host add button
    $('ks-ssh-add')?.addEventListener('click', async () => {
      const name = ($('ks-ssh-name')?.value || '').trim();
      const host = ($('ks-ssh-host')?.value || '').trim();
      const port = parseInt($('ks-ssh-port')?.value, 10) || 22;
      const user = ($('ks-ssh-user')?.value || '').trim() || 'root';
      const remotePath = ($('ks-ssh-path')?.value || '').trim() || '~';
      if (!name || !host) {
        toast('Nama host dan alamat host/IP wajib diisi.', true);
        return;
      }
      await saveSshHost({ id: 'host_' + Date.now(), name, host, port, user, auth: 'key', remotePath }, name);
      if ($('ks-ssh-name')) $('ks-ssh-name').value = '';
      if ($('ks-ssh-host')) $('ks-ssh-host').value = '';
    });

    // One-click localhost target so the SSH view has something real to test.
    $('ks-ssh-add-local')?.addEventListener('click', async () => {
      if (state.sshHosts.some(h => (h.host === '127.0.0.1' || h.host === 'localhost') && Number(h.port) === 22)) {
        toast('Host lokal sudah terdaftar.', true);
        return;
      }
      await saveSshHost({
        id: 'host_local_22',
        name: 'KRA Server (localhost)',
        host: '127.0.0.1',
        port: 22,
        user: (state.authStatus && state.authStatus.user && state.authStatus.user.username) || 'administrator',
        auth: 'key',
        remotePath: '~'
      }, 'localhost');
    });

    // Global keyboard shortcuts (Ctrl+\ toggle, Ctrl+K new session, Esc close/stop)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        state.open ? closeStudio() : openStudio();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openStudio();
        $('ks-btn-newchat')?.click();
      }
      if (e.key === 'Escape') {
        if (state.streaming) {
          e.preventDefault();
          stopGeneration();
          return;
        }
        const modal = $('ks-model-modal');
        if (state.open && modal && !modal.classList.contains('hidden')) {
          closeModelModal();
          e.stopPropagation();
        }
      }
    });
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }

  function escapeAttr(str) {
    return String(str || '').replace(/"/g, '&quot;');
  }

  function renderMarkdown(str) {
    // Lightweight markdown formatter for agent outputs
    let text = escapeHtml(str);
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return text.replace(/\n\n/g, '<br><br>');
  }

  // ---------- Settings (theme, identity, project, quota, local data) ----------
  const SETTINGS_KEY = 'kra-studio-settings';

  const THEMES = {
    cream:    { label: 'Krem',     bg: '#f3ead9', surface: '#fffaf0', surface2: '#ebe0cc', surface3: '#dfd0b8', border: '#cbb99d', borderSoft: '#e2d5c2', text: '#30271e', dim: '#66594a', faint: '#998a78', accent: '#9a5a2e', accentSoft: 'rgba(154,90,46,0.13)', green: '#39764b', amber: '#9b6819', red: '#ad3f35' },
    sand:     { label: 'Sand',     bg: '#efe6d3', surface: '#fbf6ea', surface2: '#e8dcc4', surface3: '#d9c9ab', border: '#c8b394', borderSoft: '#ded0b7', text: '#332a1d', dim: '#6b5c46', faint: '#9c8b70', accent: '#a3652f', accentSoft: 'rgba(163,101,47,0.13)', green: '#3c7448', amber: '#9c6a1a', red: '#ab4034' },
    forest:   { label: 'Forest',   bg: '#e9efe4', surface: '#f8fbf5', surface2: '#dfe9d9', surface3: '#cbdcc4', border: '#aec4a7', borderSoft: '#d3e0cd', text: '#26301f', dim: '#52604a', faint: '#7f8c78', accent: '#3f6b4a', accentSoft: 'rgba(63,107,74,0.13)', green: '#39764b', amber: '#8f6a17', red: '#a8402f' },
    slate:    { label: 'Slate',    bg: '#e7e9ec', surface: '#f7f8fa', surface2: '#dde1e6', surface3: '#cbd1d8', border: '#b0b8c2', borderSoft: '#d5dae0', text: '#22262c', dim: '#4d555f', faint: '#7b848f', accent: '#4a5a70', accentSoft: 'rgba(74,90,112,0.13)', green: '#356b47', amber: '#8a6516', red: '#a03d33' },
    midnight: { label: 'Midnight', bg: '#1e2024', surface: '#2a2d33', surface2: '#33373e', surface3: '#3e434b', border: '#4a505a', borderSoft: '#3a3f47', text: '#eceff3', dim: '#a9b1bb', faint: '#7d858f', accent: '#c98a4b', accentSoft: 'rgba(201,138,75,0.18)', green: '#5aa36e', amber: '#c79a45', red: '#cf6558' },
    plum:     { label: 'Plum',     bg: '#efe6ee', surface: '#faf5f9', surface2: '#e6d8e3', surface3: '#d5c2d0', border: '#bda3b9', borderSoft: '#e0d0da', text: '#2d222b', dim: '#5e4d5a', faint: '#8c7886', accent: '#7a4a72', accentSoft: 'rgba(122,74,114,0.13)', green: '#3d7350', amber: '#93641c', red: '#a84237' },
  };

  // ---------- Capabilities (mirrors server requireWorkspaceAccess levels) ----------
  // Keep this in lockstep with api/index.php requireWorkspaceAccess(): showing a
  // control the server will always 403 is worse than hiding it.
  function capabilities() {
    const u = state.authStatus || {};
    const admin = Boolean(u.isPlatformAdmin);
    const role = String((u.activeWorkspace && u.activeWorkspace.memberRole) || '').toLowerCase();
    const wsAdmin = admin || role === 'owner' || role === 'admin';
    const member = wsAdmin || role === 'member';
    return {
      admin,
      supervisor: Boolean(u.isSupervisor) || admin,
      wsAdmin,
      member,
      viewer: member || role === 'viewer',
      canTerminal: admin,               // terminal-run: platform admin + loopback
      canGithubWrite: wsAdmin,          // github-pr-create / merge
      canSshWrite: wsAdmin,             // studio-ssh op=save
      canProjectPath: wsAdmin,          // project-path mode=browse|check, project-default
      canProviderByok: wsAdmin,         // provider-settings
      canTelegram: wsAdmin,             // telegram-* admin + commercial feature
      canDiff: member,                  // task approve/reject
    };
  }

  /** Hide elements with [data-need="admin|wsAdmin|member|viewer|..."] the caller lacks. */
  function applyCapabilities() {
    const caps = capabilities();
    $$('[data-need]').forEach(el => {
      const need = String(el.getAttribute('data-need') || '').trim();
      const ok = need === '' ? true : Boolean(caps[need]);
      el.classList.toggle('hidden', !ok);
      if (el.tagName === 'BUTTON') {
        el.disabled = !ok;
        if (!ok) el.title = 'Butuh akses ' + need + ' pada workspace ini.';
      }
    });
    const note = $('ks-caps-note');
    if (note) {
      const u = state.authStatus || {};
      note.textContent = caps.admin
        ? 'Platform admin — semua kontrol aktif.'
        : (caps.wsAdmin
          ? 'Workspace admin — kontrol tulis aktif.'
          : (caps.member
            ? 'Member workspace — kontrol tulis (GitHub/SSH/BYOK/terminal) disembunyikan.'
            : 'Akses baca saja.'));
    }
  }

  function readSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (_) { return {}; }
  }

  function writeSettings(next) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch (_) { /* private mode */ }
    state.settings = next;
  }

  function applyTheme(name) {
    const theme = THEMES[name] || THEMES.cream;
    const root = $('kra-studio');
    if (!root) return;
    const map = {
      '--ks-bg': theme.bg, '--ks-surface': theme.surface, '--ks-surface-2': theme.surface2,
      '--ks-surface-3': theme.surface3, '--ks-border': theme.border, '--ks-border-soft': theme.borderSoft,
      '--ks-text': theme.text, '--ks-text-dim': theme.dim, '--ks-text-faint': theme.faint,
      '--ks-accent': theme.accent, '--ks-accent-soft': theme.accentSoft,
      '--ks-green': theme.green, '--ks-amber': theme.amber, '--ks-red': theme.red,
    };
    Object.entries(map).forEach(([key, value]) => root.style.setProperty(key, value));
    document.documentElement.style.setProperty('--kra-office-bg', theme.bg);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme.bg);
    const label = $('ks-theme-current');
    if (label) label.textContent = theme.label;
    $$('.ks-theme-swatch').forEach(btn => btn.classList.toggle('active', btn.dataset.theme === name));
  }

  function applyPreferences(settings) {
    const root = $('kra-studio');
    if (!root) return;
    const density = settings.density || 'normal';
    root.dataset.density = density;
    root.classList.toggle('ks-compact', Boolean(settings.compact) || density === 'compact');
    root.classList.toggle('ks-mono-tools', settings.monoTools !== false);
    root.classList.toggle('ks-no-timer', settings.showTimer === false);
    state.autoCollapse = settings.autoSpoiler !== false;
  }

  function saveSettings(patch) {
    const next = Object.assign(readSettings(), patch);
    writeSettings(next);
    applyTheme(next.theme || 'cream');
    applyPreferences(next);
    return next;
  }

  async function loadSettings() {
    const root = $('ks-view-settings');
    if (!root) return;
    const settings = readSettings();
    state.settings = settings;

    // Theme swatches
    const grid = $('ks-theme-grid');
    if (grid && !grid.dataset.bound) {
      grid.dataset.bound = '1';
      grid.addEventListener('click', (e) => {
        const swatch = e.target.closest('[data-theme]');
        if (!swatch) return;
        saveSettings({ theme: swatch.dataset.theme });
        toast('Tema ' + (THEMES[swatch.dataset.theme]?.label || swatch.dataset.theme) + ' diterapkan.');
      });
    }

    // Preference controls
    const bindPref = (id, key, prop = 'checked') => {
      const el = $(id);
      if (!el || el.dataset.bound) return;
      el.dataset.bound = '1';
      if (prop === 'checked') el.checked = settings[key] !== undefined ? Boolean(settings[key]) : el.checked;
      else el.value = settings[key] || el.value;
      el.addEventListener('change', () => {
        saveSettings({ [key]: prop === 'checked' ? el.checked : el.value });
      });
    };
    bindPref('ks-opt-compact', 'compact');
    bindPref('ks-opt-mono', 'monoTools');
    bindPref('ks-opt-autospoiler', 'autoSpoiler');
    bindPref('ks-opt-timer', 'showTimer');
    bindPref('ks-opt-density', 'density', 'value');

    const modelEl = $('ks-settings-model');
    if (modelEl) modelEl.value = state.activeModel;
    const provCount = $('ks-settings-provider-count');
    if (provCount) provCount.textContent = Object.keys(state.models || {}).length + ' provider';

    // Identity
    try {
      const data = await api('auth-status');
      const authed = Boolean(data.authenticated);
      state.authStatus = authed ? data : null;
      const tag = $('ks-settings-auth');
      if (tag) { tag.textContent = authed ? 'MASUK' : 'BELUM MASUK'; tag.className = 'ks-tag ' + (authed ? 'ok' : 'warn'); }
      const identity = $('ks-settings-identity');
      if (identity) {
        identity.textContent = authed
          ? 'Sesi SIAS aktif sebagai ' + (data.user?.display_name || data.user?.username || 'pengguna') + '.'
          : 'Belum ada sesi SIAS. Login diperlukan untuk chat, kuota, dan operasi GitHub.';
      }
      $('ks-settings-login')?.toggleAttribute('hidden', authed);
      $('ks-settings-logout')?.toggleAttribute('hidden', !authed);
    } catch (_) { /* offline */ }

    // Project path — server internals, admin only. Members get the sandbox note.
    if (!capabilities().wsAdmin) {
      const desc = $('ks-settings-project');
      if (desc) desc.textContent = 'Path project hanya terlihat oleh workspace admin. File manager Anda berjalan di dalam kotak pasir workspace.';
      const pathEl = $('ks-settings-project-path');
      if (pathEl) { pathEl.value = ''; pathEl.placeholder = 'disembunyikan (bukan admin)'; pathEl.disabled = true; }
      const tag = $('ks-settings-project-tag');
      if (tag) { tag.textContent = 'SANDBOX'; tag.className = 'ks-tag'; }
    } else {
      try {
        const project = await api('project-path');
        const pathEl = $('ks-settings-project-path');
        if (pathEl) { pathEl.disabled = false; pathEl.value = project.suggested || state.projectRoot || ''; }
        const desc = $('ks-settings-project');
        if (desc) desc.textContent = 'Workspace ' + (project.workspaceId || '—') + ' · root ' + (project.projectsRoot || '—');
        const tag = $('ks-settings-project-tag');
        if (tag) { tag.textContent = project.valid === false ? 'PERLU DIBUAT' : 'SIAP'; tag.className = 'ks-tag ' + (project.valid === false ? 'warn' : 'ok'); }
      } catch (e) {
        const desc = $('ks-settings-project');
        if (desc) desc.textContent = 'Path project tidak dapat dimuat: ' + e.message;
      }
    }

    // Quota
    loadSettingsQuota();

    // Integrations
    loadSettingsIntegrations();

    // Local storage usage
    let bytes = 0;
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        bytes += (key || '').length + String(localStorage.getItem(key) || '').length;
      }
    } catch (_) { bytes = 0; }
    const storageEl = $('ks-settings-storage');
    if (storageEl) {
      const sessions = (state.sessions || []).length;
      storageEl.textContent = (bytes / 1024).toFixed(1) + ' KB data lokal · ' + sessions + ' sesi chat tersimpan.';
    }
    const mirrorEl = $('ks-settings-mirror');
    if (mirrorEl) {
      const m = String(state.sessionMirror || 'belum');
      if (m.startsWith('ok:')) {
        mirrorEl.textContent = 'Mirror server: tersinkron ' + m.slice(3) + ' — sesi muncul di perangkat lain.';
      } else if (m.startsWith('too-large:')) {
        mirrorEl.textContent = 'Mirror server: payload ' + m.slice(10) + ' melebihi 512 KB, sesi lama tidak tersinkron. Hapus sesi lama agar mirror jalan lagi.';
      } else if (m.startsWith('error:')) {
        mirrorEl.textContent = 'Mirror server: gagal — ' + m.slice(6);
      } else {
        mirrorEl.textContent = 'Mirror server: menunggu sinkronisasi pertama.';
      }
    }
    applyCapabilities();
  }

  async function loadSettingsQuota() {
    try {
      const data = await api('token-usage');
      const usage = data.usage || {};
      const limit = Number(usage.limit || 150000);
      const used = Number(usage.used || 0);
      const pct = Number(usage.percent || (used / limit * 100));
      const pctEl = $('ks-settings-quota-pct');
      if (pctEl) { pctEl.textContent = pct.toFixed(pct < 1 ? 1 : 0) + '%'; pctEl.className = 'ks-tag ' + (pct > 90 ? 'bad' : pct > 70 ? 'warn' : 'ok'); }
      const desc = $('ks-settings-quota');
      if (desc) desc.textContent = used.toLocaleString() + ' dari ' + limit.toLocaleString() + ' token terpakai hari ini (reset 07:00 WIB).';
      const limitEl = $('ks-settings-quota-limit');
      if (limitEl) limitEl.value = limit;
      updateTokenMeter(usage);
    } catch (e) {
      const desc = $('ks-settings-quota');
      if (desc) desc.textContent = 'Kuota tidak tersedia: ' + e.message;
    }
  }

  async function loadSettingsIntegrations() {
    const root = $('ks-settings-integrations');
    if (!root) return;
    root.innerHTML = '<span class="ks-tag">Memeriksa…</span>';
    const [telegram, gh, router, browser] = await Promise.allSettled([
      api('telegram-config'),
      api('github-changer-status'),
      api('rna-router-status').catch(() => api('router-health')),
      api('studio-browser'),
    ]);
    const chip = (name, ok, detail) =>
      `<span class="ks-tag ${ok ? 'ok' : 'warn'}" title="${escapeAttr(detail || '')}">${name}: ${ok ? 'ON' : 'OFF'}</span>`;
    const parts = [];
    if (telegram.status === 'fulfilled') {
      const t = telegram.value.telegram || {};
      parts.push(chip('Telegram', Boolean(t.configured), t.paired ? 'chat terpasang' : 'belum pairing'));
    } else parts.push(chip('Telegram', false, 'perlu admin / fitur'));
    if (gh.status === 'fulfilled') parts.push(chip('GitHub', Boolean(gh.value.connected), gh.value.message || ''));
    else parts.push(chip('GitHub', false, 'belum dikonfigurasi'));
    if (router.status === 'fulfilled') parts.push(chip('Router', Boolean(router.value.ok !== false), 'RNA / 9router gateway'));
    else parts.push(chip('Router', false, 'tidak terjangkau'));
    if (browser.status === 'fulfilled') parts.push(chip('Browser', Boolean(browser.value.installed), browser.value.binary || ''));
    else parts.push(chip('Browser', false, 'bridge tidak tersedia'));
    root.innerHTML = parts.join(' ');
  }

  async function browseProjectFolder(dir) {
    const box = $('ks-settings-browser');
    if (!box) return;
    box.classList.remove('hidden');
    box.innerHTML = '<div class="ks-empty">Membaca folder…</div>';
    try {
      const data = await api('project-path', { query: Object.assign({ mode: 'browse' }, dir ? { dir } : {}) });
      const entries = data.entries || [];
      box.innerHTML = `
        <div class="ks-folder-head">
          <span class="ks-mono">${escapeHtml(data.dir || dir || 'root')}</span>
          ${data.parent ? `<button class="ks-btn" type="button" data-browse-dir="${escapeAttr(data.parent)}">Up</button>` : ''}
        </div>
        <div class="ks-folder-list">
          ${entries.length ? entries.map(e => `<button class="ks-folder-item" type="button" data-browse-dir="${escapeAttr(e.path)}"><span>📁</span>${escapeHtml(e.name)}</button>`).join('') : '<div class="ks-empty">Tidak ada subfolder.</div>'}
        </div>`;
    } catch (e) {
      box.innerHTML = `<div class="ks-empty error">${escapeHtml(e.message)}</div>`;
    }
  }

  // ---------- Login gate (SIAS account) ----------
  async function checkLoginGate() {
    const gate = $('ks-login-gate');
    const status = $('ks-login-gate-status');
    const loginBtn = $('ks-btn-login');
    const logoutBtn = $('ks-btn-logout');
    const planEl = $('ks-profile-plan');
    let authenticated = false;
    let userName = '';
    try {
      const data = await api('auth-status');
      authenticated = Boolean(data.authenticated);
      state.authStatus = authenticated ? data : null;
      if (authenticated && data.user) {
        userName = data.user.display_name || data.user.username || 'SIAS';
      }
    } catch (_) { authenticated = false; state.authStatus = null; }

    if (authenticated) {
      if (status) status.textContent = 'MASUK · ' + userName;
      const nameEl = $('ks-profile-name');
      if (nameEl) nameEl.textContent = userName;
      if (planEl) planEl.textContent = 'Sesi SIAS aktif';
    } else {
      if (status) status.textContent = 'BELUM MASUK';
      const nameEl = $('ks-profile-name');
      if (nameEl) nameEl.textContent = 'Belum masuk';
      if (planEl) planEl.textContent = 'Login SIAS diperlukan';
    }
    loginBtn?.toggleAttribute('hidden', authenticated);
    logoutBtn?.toggleAttribute('hidden', !authenticated);
    gate?.classList.toggle('hidden', authenticated);

    const composer = $('ks-composer-input');
    if (composer) {
      composer.disabled = !authenticated;
      composer.placeholder = authenticated
        ? 'Instruksi untuk agent… (Enter kirim, Shift+Enter baris baru, Esc stop)'
        : 'Masuk dengan akun SIAS dulu untuk mulai mengetik…';
    }
    $('ks-composer-send')?.toggleAttribute('disabled', !authenticated);
    $('ks-attach-btn')?.toggleAttribute('disabled', !authenticated);
    applyCapabilities();

    // Authenticated: pull the server session mirror once, after first paint.
    if (authenticated && !state.sessionsMirrored) {
      state.sessionsMirrored = true;
      api('studio-sessions')
        .then(server => { if (mergeServerSessions(server)) { renderRecentChats(); renderActiveSession(); } })
        .catch(() => { /* mirror is optional */ });
    }
  }

  function goLogin() {
    window.location.href = 'login.html';
  }

  async function doLogout() {
    const logoutBtn = $('ks-btn-logout');
    if (logoutBtn) logoutBtn.disabled = true;
    try {
      const response = await fetch('../api/index.php?action=logout', {
        method: 'POST',
        headers: authHeaders()
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.error || 'Server tidak dapat mengakhiri sesi ini.');
      }
    } catch (error) {
      if (logoutBtn) logoutBtn.disabled = false;
      window.alert('Logout belum berhasil; sesi server masih aktif. Coba lagi. ' + error.message);
      return;
    }
    ['kra_auth_token', 'kra_active_user', 'kra_active_workspace', 'kra_tenant_session', 'kra-last-project-task']
      .forEach(key => sessionStorage.removeItem(key));
    window.location.replace('login.html');
  }

  // Public API
  window.KRAStudio = {
    open: openStudio,
    close: closeStudio,
    toggle: () => (state.open ? closeStudio() : openStudio()),
    setView,
    state
  };

  document.addEventListener('DOMContentLoaded', () => {
    const saved = readSettings();
    state.settings = saved;
    applyTheme(saved.theme || 'cream');
    applyPreferences(saved);
    bindEvents();
    hydrate();
    checkLoginGate();
    // app.js boots into Office mode before this script loads, so open the
    // Command Center here when the page starts outside Creator mode.
    if (!document.body.classList.contains('creator-mode-active')) openStudio();
  });
})();
