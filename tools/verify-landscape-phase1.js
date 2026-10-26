const { app, BrowserWindow } = require('electron');

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: { offscreen: true }
  });

  try {
    await win.loadURL('http://127.0.0.1/kantor-rama-ai/web/index.html');
    await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const started = performance.now();
      const check = () => {
        if (window.KRA_APP_READY && document.getElementById('office-canvas').getBoundingClientRect().width > 0) return resolve();
        if (performance.now() - started > 15000) return reject(new Error('Landscape map startup timed out.'));
        setTimeout(check, 25);
      };
      check();
    })`);

    const result = await win.webContents.executeJavaScript(`(() => {
      const canvas = document.getElementById('office-canvas');
      const rect = canvas.getBoundingClientRect();
      const container = canvas.parentElement.getBoundingClientRect();
      const missingCells = floor.flat().filter(cell => !cell || cell === '#3B2A1D').length;
      const expectedWorld = { width: MAP.w * T, height: MAP.h * T };
      const viewportFit = Math.abs(rect.width - container.width) <= 8 || Math.abs(rect.height - container.height) <= 8;
      const fillsViewport = rect.width >= container.width - 8 && rect.height >= container.height - 8;
      return {
        map: { width: MAP.w, height: MAP.h, tileSize: T },
        expectedWorld,
        actualCanvas: { width: canvas.width, height: canvas.height },
        displayedCanvas: { width: Math.round(rect.width), height: Math.round(rect.height) },
        viewport: { width: Math.round(container.width), height: Math.round(container.height) },
        viewportFit,
        fillsViewport,
        missingCells,
        activeFloor: activeFloor
      };
    })()`);

    const passed = result.map.width === 32 && result.map.height === 12
      && result.expectedWorld.width === 1024 && result.expectedWorld.height === 384
      && result.actualCanvas.width === 1024 && result.actualCanvas.height === 384
      && result.viewportFit && result.fillsViewport && result.missingCells === 0;
    console.log(JSON.stringify({ ...result, passed }, null, 2));
    if (!passed) process.exitCode = 1;
  } catch (error) {
    console.error('[FAIL] Landscape phase 1:', error.message);
    process.exitCode = 1;
  } finally {
    win.destroy();
    app.quit();
  }
});
