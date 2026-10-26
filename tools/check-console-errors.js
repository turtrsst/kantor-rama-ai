const { app, BrowserWindow } = require('electron');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 800, show: false });
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[CONSOLE ${level}]: ${message} (line ${line} in ${sourceId})`);
  });
  try {
    await win.loadURL('http://127.0.0.1/kantor-rama-ai/web/index.html');
    await new Promise(r => setTimeout(r, 2000));
  } catch (err) {
    console.error(err);
  } finally {
    win.destroy();
    app.quit();
  }
});
