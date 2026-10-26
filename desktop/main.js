const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow = null;
let phpServer = null;
let phpStartedByKra = false;
const PHP_PORT = 8088;

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
  const phpRoot = process.env.XAMPP_HOME || path.join(path.parse(process.cwd()).root, 'xampp');
  // Override XAMPP_HOME when PHP is installed elsewhere.
  const phpBin = path.join(phpRoot, 'php', 'php.exe');

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

  const appUrl = useApache
    ? 'http://127.0.0.1/kantor-rama-ai/web/index.html'
    : `http://127.0.0.1:${PHP_PORT}/web/index.html`;

  mainWindow.loadURL(appUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Folder picker IPC
  ipcMain.handle('kra:select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Project Directory to Audit',
      properties: ['openDirectory'],
    });
    if (result.canceled || !result.filePaths.length) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle('kra:open-external', async (_event, url) => {
    await shell.openExternal(url);
    return true;
  });

  ipcMain.handle('kra:get-app-info', () => ({
    name: 'Kantor-Rama-AI',
    version: '0.1.0',
    platform: process.platform,
  }));

  ipcMain.handle('kra:get-runtime-status', () => ({
    desktop: true,
    phpServer: Boolean(phpServer),
    phpStartedByKra,
    apacheChecked: true,
    phpPort: PHP_PORT,
    platform: process.platform,
  }));

  ipcMain.handle('kra:exec-command', async (_event, cmd) => {
    const command = String(cmd || '').trim();
    const blocked = ['format ', 'rd /s /q c:', 'rmdir /s /q c:', 'rm -rf /', 'diskpart', 'shutdown'];
    if (!command || blocked.some(token => command.toLowerCase().includes(token))) {
      return { ok: false, output: '[KRA]: Unsafe or empty command blocked.', exitCode: 126 };
    }
    return new Promise((resolve) => {
      const projectRoot = path.resolve(__dirname, '..');
      const isWin = process.platform === 'win32';
      const shellBin = isWin ? 'powershell.exe' : '/bin/sh';
      const args = isWin ? ['-NoProfile', '-Command', command] : ['-c', command];
      const child = spawn(shellBin, args, {
        cwd: projectRoot,
        windowsHide: true,
      });
      let output = '';
      child.stdout.on('data', (d) => { output += d.toString(); });
      child.stderr.on('data', (d) => { output += d.toString(); });
      const timer = setTimeout(() => {
        child.kill();
        resolve({ ok: false, output: output + '\n[KRA]: Command timed out.' });
      }, 15000);
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ ok: code === 0, output: output.trim(), exitCode: code });
      });
      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({ ok: false, output: err.message, exitCode: 1 });
      });
    });
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
