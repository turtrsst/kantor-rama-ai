const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow = null;
let phpServer = null;
let phpStartedByKra = false;
let trustedOrigin = null;
const PHP_PORT = 8088;

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

function startLocalPhpServer(callback) {
  const projectRoot = path.resolve(__dirname, '..');
  // Production Windows runtime uses the requested standalone PHP 8.4 install.
  // KRA_PHP_BIN remains an explicit override for other server layouts.
  const phpBin = process.env.KRA_PHP_BIN || (process.platform === 'win32' ? 'C:\\php84\\php.exe' : 'php');

  phpServer = spawn(phpBin, ['-S', `127.0.0.1:${PHP_PORT}`, '-t', projectRoot], {
    cwd: projectRoot,
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  });
  phpStartedByKra = true;
  phpServer.stderr.on('data', (chunk) => {
    console.error('[KRA PHP]', chunk.toString().trim());
  });

  phpServer.on('error', (err) => {
    console.error('Failed to start PHP server:', err.message);
    callback(false);
  });
  phpServer.on('exit', (code, signal) => {
    console.error(`KRA PHP server exited (code ${code}, signal ${signal || 'none'}).`);
    phpServer = null;
    phpStartedByKra = false;
  });

  // Confirm the local server is listening instead of assuming startup succeeded.
  const startedAt = Date.now();
  const checkReady = () => {
    const req = http.get(`http://127.0.0.1:${PHP_PORT}/api/index.php?action=status`, (res) => {
      res.resume();
      callback(res.statusCode === 200);
    });
    req.on('error', () => {
      if (Date.now() - startedAt > 8000) {
        console.error('KRA PHP server did not become ready in time.');
        callback(false);
      } else {
        setTimeout(checkReady, 200);
      }
    });
    req.setTimeout(1000, () => req.destroy());
  };
  checkReady();
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
      if (url.protocol !== 'https:' || url.username || url.password) return false;
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
      platform: process.platform,
    };
  });

  checkApacheRunning((isApacheUp) => {
    if (isApacheUp) {
      createWindow(true);
    } else {
      startLocalPhpServer(() => {
        createWindow(false);
      });
    }
  });
});

app.on('window-all-closed', () => {
  if (phpServer) {
    phpServer.kill();
    phpServer = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
