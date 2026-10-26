const { app, BrowserWindow, session } = require('electron');
const fs = require('fs');
const path = require('path');

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  await session.defaultSession.clearCache();
  await session.defaultSession.clearStorageData();

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false
  });

  try {
    await win.loadURL('http://127.0.0.1/kantor-rama-ai/web/index.html?v=' + Date.now());
    await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const started = performance.now();
      const check = () => {
        if (window.KRA_APP_READY && document.getElementById('office-canvas').getBoundingClientRect().width > 0 && officeAtlas.ready) return resolve();
        if (performance.now() - started > 15000) return reject(new Error('Landscape map startup timed out.'));
        setTimeout(check, 50);
      };
      check();
    })`);

    // Wait for canvas to render and settle
    await new Promise(r => setTimeout(r, 2000));

    const image = await win.capturePage();
    const outputPath = path.join(__dirname, 'live_layout_preview.png');
    fs.writeFileSync(outputPath, image.toPNG());
    console.log('Saved live office preview to:', outputPath);
  } catch (err) {
    console.error(err);
  } finally {
    win.destroy();
    app.quit();
  }
});
