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
    const result = await win.webContents.executeJavaScript(`(async () => {
      document.getElementById('btn-toggle-decor').click();
      document.querySelector('[data-item="atlas_server"]').click();
      const canvas = document.getElementById('office-canvas');
      const rect = canvas.getBoundingClientRect();
      let tileX = -1;
      let tileY = -1;
      for (let y = 0; y < MAP.h && tileX < 0; y += 1) {
        for (let x = 0; x < MAP.w; x += 1) {
          if (canPlaceDecorItem('atlas_server', x, y)) {
            tileX = x;
            tileY = y;
            break;
          }
        }
      }
      if (tileX < 0) throw new Error('No empty legal footprint available for atlas test.');
      canvas.dispatchEvent(new MouseEvent('click', {
        clientX: rect.left + (tileX + 0.5) / MAP.w * rect.width,
        clientY: rect.top + (tileY + 0.5) / MAP.h * rect.height,
        bubbles: true
      }));
      await new Promise(resolve => setTimeout(resolve, 500));
      const frame = getCachedAtlasFrame('server_rack_jarvis');
      const entry = customDecor[activeFloor].get(tileX + ',' + tileY);
      const occupiedEntry = atlasOccupancyAt(activeFloor, tileX + 1, tileY);
      const blockedRejected = !canPlaceDecorItem('atlas_server', MAP.w - 1, MAP.h - 1);
      return {
        atlasReady: officeAtlas.ready,
        decorMode,
        selectedDecorItem,
        placedItem: entry,
        occupiedEntry,
        blockedRejected,
        cachedComposite: Boolean(frame && frame.composite),
        canvasCrisp: ctx.imageSmoothingEnabled === false
      };
    })()`);
    const passed = result.atlasReady && result.decorMode
      && result.selectedDecorItem === 'atlas_server'
      && result.placedItem === 'atlas_server'
      && result.occupiedEntry
      && result.blockedRejected
      && result.cachedComposite && result.canvasCrisp;
    console.log(JSON.stringify(result));
    if (!passed) process.exitCode = 1;
  } catch (error) {
    console.error('[FAIL] Atlas UI test:', error.message);
    process.exitCode = 1;
  } finally {
    app.quit();
  }
});
