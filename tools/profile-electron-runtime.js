const { app, BrowserWindow } = require('electron');

const snapshot = label => {
  const metrics = app.getAppMetrics().map(({ type, memory }) => ({
    type,
    workingSetMB: +(memory.workingSetSize / 1024).toFixed(2),
    privateMB: +(memory.privateBytes / 1024).toFixed(2)
  }));
  console.log(JSON.stringify({
    label,
    totalWorkingSetMB: +metrics.reduce((sum, item) => sum + item.workingSetMB, 0).toFixed(2),
    metrics
  }));
};

app.whenReady().then(async () => {
  snapshot('electron-runtime-no-window');
  const win = new BrowserWindow({ show: false, width: 1, height: 1, webPreferences: { offscreen: false } });
  await win.loadURL('data:text/html,<html><body></body></html>');
  await new Promise(resolve => setTimeout(resolve, 1200));
  snapshot('electron-empty-renderer');
  win.destroy();
  app.quit();
});
