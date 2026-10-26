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
    await win.webContents.executeJavaScript(`new Promise(resolve => {
      const check = () => window.KRA_APP_READY ? resolve() : setTimeout(check, 25);
      check();
    })`);

    const result = await win.webContents.executeJavaScript(`(() => {
      const atlasReady = officeAtlas.ready;
      const spriteNames = Object.keys((officeAtlas.metadata && officeAtlas.metadata.sprites) || {});
      const frame = getCachedAtlasFrame('server_rack_jarvis');
      const canvas = document.getElementById('office-canvas');
      const before = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      drawSprite(2, 2, 'atlas_server');
      const after = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let changed = false;
      for (let i = 0; i < after.length; i += 4) {
        if (after[i] !== before[i] || after[i + 1] !== before[i + 1] || after[i + 2] !== before[i + 2]) {
          changed = true;
          break;
        }
      }
      return { atlasReady, spriteNames, cachedFrame: !!frame, changed };
    })()`);

    const allPass = result.atlasReady && result.cachedFrame && result.changed
      && result.spriteNames.length === 4;
    console.log(JSON.stringify(result));
    if (!allPass) process.exitCode = 1;
  } catch (error) {
    console.error('[FAIL] Atlas renderer test failed:', error.message);
    process.exitCode = 1;
  } finally {
    app.quit();
  }
});
