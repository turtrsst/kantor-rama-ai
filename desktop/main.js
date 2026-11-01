const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow = null;
let phpServer = null;
let phpStartedByKra = false;
let trustedOrigin = null;
const PHP_PORT = 8088;

// --- N100N sub-app (bundled workflow engine in n100n/) ---
let n100nServer = null;
let n100nStartedByKra = false;
let n100nReachable = false;
const N100N_PORT = 5679;
const N100N_BASE_URL = `http://127.0.0.1:${N100N_PORT}`;

function isTrustedMainFrame(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents) return false;
  if (event.senderFrame !== mainWindow.webContents.mainFrame) return false;
  try {
    return new URL(event.senderFrame.url).origin === trustedOrigin;
  } catch (_) {
    return false;
  }
}

function checkApacheRunning(callback) {
  let settled = false;
  const finish = (result) => {
    if (!settled) {
      settled = true;
      callback(result);
    }
  };
  const req = http.get('http://127.0.0.1/kantor-rama-ai/api/index.php?action=status', (res) => {
    res.resume();
    finish(res.statusCode === 200);
  });
  req.on('error', () => finish(false));
  req.setTimeout(800, () => {
    req.destroy();
    finish(false);
  });
}

function startLocalPhpServer(callback, extraEnv = {}) {
  const projectRoot = path.resolve(__dirname, '..');
  // Production Windows runtime uses the requested standalone PHP 8.4 install.
  // KRA_PHP_BIN remains an explicit override for other server layouts.
  const phpBin = process.env.KRA_PHP_BIN || (process.platform === 'win32' ? 'C:\\php84\\php.exe' : 'php');

  phpServer = spawn(phpBin, ['-S', `127.0.0.1:${PHP_PORT}`, '-t', projectRoot], {
    cwd: projectRoot,
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
    // Desktop pairing: KRA_N100N_* / KRA_FLOW_API_KEY generated for the bundled
    // N100N sub-app are handed to PHP here (real environment wins in PHP).
    env: { ...process.env, ...extraEnv },
  });
  phpStartedByKra = true;
  phpServer.stderr.on('data', (chunk) => {
    console.error('[KRA PHP]', chunk.toString().trim());
  });

  let callbackSettled = false;
  const done = (ok) => {
    if (!callbackSettled) {
      callbackSettled = true;
      callback(ok);
    }
  };
  phpServer.on('error', (err) => {
    console.error('Failed to start PHP server:', err.message);
    done(false);
  });
  phpServer.on('exit', (code, signal) => {
    console.error(`KRA PHP server exited (code ${code}, signal ${signal || 'none'}).`);
    phpServer = null;
    phpStartedByKra = false;
  });

  // Confirm the local server is listening instead of assuming startup succeeded.
  const startedAt = Date.now();
  const checkReady = () => {
    if (callbackSettled) return;
    const req = http.get(`http://127.0.0.1:${PHP_PORT}/api/index.php?action=status`, (res) => {
      res.resume();
      done(res.statusCode === 200);
    });
    req.on('error', () => {
      if (Date.now() - startedAt > 8000) {
        console.error('KRA PHP server did not become ready in time.');
        done(false);
      } else {
        setTimeout(checkReady, 200);
      }
    });
    req.setTimeout(1000, () => req.destroy());
  };
  checkReady();
}

// ---------------------------------------------------------------------------
// N100N sub-app management
// ---------------------------------------------------------------------------

function parseEnvFile(text) {
  const values = {};
  for (const line of String(text).split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (match) values[match[1]] = match[2].trim();
  }
  return values;
}

function setEnvValue(text, key, value) {
  const pattern = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');
  if (pattern.test(text)) return text.replace(pattern, `${key}=${value}`);
  return text.replace(/\s*$/, '') + `\n${key}=${value}\n`;
}

/**
 * Ensures n100n/.env exists with the secrets needed for first run and for the
 * KRA <-> N100N pairing. Existing user values are never overwritten; only
 * empty/missing secrets are generated. Returns the effective values so the
 * PHP child process can be paired through its environment.
 */
function ensureN100nEnv(n100nDir) {
  const envPath = path.join(n100nDir, '.env');
  const examplePath = path.join(n100nDir, '.env.example');
  let text = '';
  try {
    text = fs.readFileSync(envPath, 'utf8');
  } catch (_) {
    try {
      text = fs.readFileSync(examplePath, 'utf8');
    } catch (__) {
      text = '';
    }
  }
  const values = parseEnvFile(text);
  const secretKeys = ['APP_PASSWORD', 'APP_SECRET', 'APP_API_TOKEN', 'KRA_API_KEY'];
  let changed = !fs.existsSync(envPath);
  for (const key of secretKeys) {
    if (!values[key]) {
      values[key] = crypto.randomBytes(24).toString('hex');
      text = setEnvValue(text, key, values[key]);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(envPath, text.endsWith('\n') ? text : text + '\n', 'utf8');
    console.log('[KRA N100N] First-run N100N configuration saved to n100n/.env — the admin UI password is APP_PASSWORD in that file.');
  }
  return values;
}

function probeN100n(callback) {
  let settled = false;
  const finish = (result) => {
    if (!settled) {
      settled = true;
      callback(result);
    }
  };
  // Any HTTP response (including an auth challenge) means a service is listening.
  const req = http.get(`${N100N_BASE_URL}/api/health`, (res) => {
    res.resume();
    finish(true);
  });
  req.on('error', () => finish(false));
  req.setTimeout(900, () => {
    req.destroy();
    finish(false);
  });
}

/**
 * Starts the bundled N100N engine as a KRA-managed sub-app unless it is
 * already running (e.g. via the user's own scheduled task) or disabled with
 * KRA_N100N_AUTOSTART=0. Tries the system Node first, then Electron's Node.
 */
function startN100nServer(kraBaseUrl, n100nEnvValues) {
  if (process.env.KRA_N100N_AUTOSTART === '0') {
    console.log('[KRA N100N] Auto-start disabled via KRA_N100N_AUTOSTART=0.');
    return;
  }
  const projectRoot = path.resolve(__dirname, '..');
  const n100nDir = path.join(projectRoot, 'n100n');
  if (!fs.existsSync(path.join(n100nDir, 'server.js'))) {
    console.error('[KRA N100N] Bundled n100n/server.js not found; sub-app not started.');
    return;
  }
  probeN100n((alreadyUp) => {
    if (alreadyUp) {
      n100nReachable = true;
      console.log('[KRA N100N] Service already running at ' + N100N_BASE_URL + '; leaving it unmanaged.');
      return;
    }
    const flowUrl = `${kraBaseUrl}/api/index.php?action=flow-tugas`;
    const childEnv = {
      ...process.env,
      // Real environment values win over --env-file, so KRA pairing stays
      // correct even if the user later edits n100n/.env by hand.
      KRA_BASE_URL: process.env.KRA_BASE_URL || kraBaseUrl,
      KRA_TUGAS_URL: process.env.KRA_TUGAS_URL || flowUrl,
      KRA_TUGAS_LIST_URL: process.env.KRA_TUGAS_LIST_URL || flowUrl,
    };
    if (n100nEnvValues.KRA_API_KEY && !process.env.KRA_API_KEY) childEnv.KRA_API_KEY = n100nEnvValues.KRA_API_KEY;

    const candidates = [
      { bin: process.env.KRA_NODE_BIN || 'node', env: { ...childEnv } },
      { bin: process.execPath, env: { ...childEnv, ELECTRON_RUN_AS_NODE: '1' } },
    ];
    const tryCandidate = (index) => {
      if (index >= candidates.length) {
        console.error('[KRA N100N] Could not start the bundled N100N engine. Install Node.js 22.5+ (or set KRA_NODE_BIN) — KRA itself keeps running without it.');
        return;
      }
      const candidate = candidates[index];
      let settled = false;
      let child;
      try {
        child = spawn(candidate.bin, ['--env-file=.env', 'server.js'], {
          cwd: n100nDir,
          stdio: ['ignore', 'ignore', 'pipe'],
          windowsHide: true,
          env: candidate.env,
        });
      } catch (err) {
        console.error(`[KRA N100N] Spawn failed (${candidate.bin}): ${err.message}`);
        tryCandidate(index + 1);
        return;
      }
      n100nServer = child;
      n100nStartedByKra = true;
      child.stderr.on('data', (chunk) => console.error('[KRA N100N]', chunk.toString().trim()));
      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        console.error(`[KRA N100N] Failed to start with ${candidate.bin}: ${err.message}`);
        n100nServer = null;
        n100nStartedByKra = false;
        tryCandidate(index + 1);
      });
      child.on('exit', (code, signal) => {
        const managed = n100nServer === child;
        if (managed) {
          n100nServer = null;
          n100nStartedByKra = false;
          n100nReachable = false;
        }
        if (!settled) {
          settled = true;
          console.error(`[KRA N100N] Engine exited during startup (code ${code}, signal ${signal || 'none'}) using ${candidate.bin}; trying next runtime.`);
          tryCandidate(index + 1);
        } else if (managed) {
          console.error(`[KRA N100N] Engine exited (code ${code}, signal ${signal || 'none'}).`);
        }
      });
      const startedAt = Date.now();
      const checkReady = () => {
        if (settled) return;
        probeN100n((up) => {
          if (settled) return;
          if (up) {
            settled = true;
            n100nReachable = true;
            console.log('[KRA N100N] Sub-app ready at ' + N100N_BASE_URL);
          } else if (Date.now() - startedAt > 12000) {
            settled = true;
            console.error(`[KRA N100N] Engine did not become ready with ${candidate.bin}; trying next runtime.`);
            try { child.kill(); } catch (_) { /* already gone */ }
            tryCandidate(index + 1);
          } else {
            setTimeout(checkReady, 250);
          }
        });
      };
      setTimeout(checkReady, 250);
    };
    tryCandidate(0);
  });
}

function createWindow(useApache) {
  const appUrl = useApache
    ? 'http://127.0.0.1/kantor-rama-ai/web/index.html'
    : `http://127.0.0.1:${PHP_PORT}/web/index.html`;
  trustedOrigin = new URL(appUrl).origin;
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1040,
    minHeight: 720,
    title: 'Kantor-Rama-AI (KRA) — Virtual Office',
    backgroundColor: '#F0EAD2',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, destination) => {
    try {
      if (new URL(destination).origin !== trustedOrigin) event.preventDefault();
    } catch (_) {
      event.preventDefault();
    }
  });
  mainWindow.loadURL(appUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Folder picker IPC
  ipcMain.handle('kra:select-folder', async (event) => {
    if (!isTrustedMainFrame(event)) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Project Directory to Audit',
      properties: ['openDirectory'],
    });
    if (result.canceled || !result.filePaths.length) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle('kra:open-external', async (event, value) => {
    if (!isTrustedMainFrame(event)) return false;
    try {
      const url = new URL(String(value || ''));
      if (url.username || url.password) return false;
      const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
      const isLoopback = host === 'localhost' || host.endsWith('.localhost') || host === '::1' || /^127\./.test(host);
      // HTTPS anywhere (e.g. Google OAuth), plus plain HTTP only for this
      // machine's loopback sub-apps such as the bundled N100N UI.
      if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback)) return false;
      await shell.openExternal(url.href);
      return true;
    } catch (_) {
      return false;
    }
  });

  ipcMain.handle('kra:get-app-info', (event) => {
    if (!isTrustedMainFrame(event)) return null;
    return { name: 'Kantor-Rama-AI', version: '0.1.0', platform: process.platform };
  });

  ipcMain.handle('kra:get-runtime-status', (event) => {
    if (!isTrustedMainFrame(event)) return null;
    return {
      desktop: true,
      phpServer: Boolean(phpServer),
      phpStartedByKra,
      apacheChecked: true,
      phpPort: PHP_PORT,
      n100n: {
        managed: n100nStartedByKra,
        running: n100nReachable || Boolean(n100nServer),
        port: N100N_PORT,
        baseUrl: N100N_BASE_URL,
        autostart: process.env.KRA_N100N_AUTOSTART !== '0',
      },
      platform: process.platform,
    };
  });

  checkApacheRunning((isApacheUp) => {
    const kraBaseUrl = isApacheUp ? 'http://127.0.0.1/kantor-rama-ai' : `http://127.0.0.1:${PHP_PORT}`;
    const projectRoot = path.resolve(__dirname, '..');
    const n100nEnvValues = (() => {
      try {
        return ensureN100nEnv(path.join(projectRoot, 'n100n'));
      } catch (err) {
        console.error('[KRA N100N] Could not prepare n100n/.env: ' + err.message);
        return {};
      }
    })();
    startN100nServer(kraBaseUrl, n100nEnvValues);
    if (isApacheUp) {
      createWindow(true);
    } else {
      const pairingEnv = {};
      if (!process.env.KRA_N100N_BASE_URL && !process.env.KRA_N100N_URL) pairingEnv.KRA_N100N_BASE_URL = N100N_BASE_URL;
      if (n100nEnvValues.APP_API_TOKEN && !process.env.KRA_N100N_API_KEY && !process.env.KRA_N100N_TOKEN) pairingEnv.KRA_N100N_API_KEY = n100nEnvValues.APP_API_TOKEN;
      if (n100nEnvValues.KRA_API_KEY && !process.env.KRA_FLOW_API_KEY && !process.env.KRA_API_KEY) pairingEnv.KRA_FLOW_API_KEY = n100nEnvValues.KRA_API_KEY;
      startLocalPhpServer(() => {
        createWindow(false);
      }, pairingEnv);
    }
  });
});

app.on('window-all-closed', () => {
  if (phpServer) {
    phpServer.kill();
    phpServer = null;
  }
  if (n100nServer && n100nStartedByKra) {
    n100nServer.kill();
    n100nServer = null;
    n100nStartedByKra = false;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
