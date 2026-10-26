const { app, BrowserWindow } = require('electron');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 800, show: false });
  try {
    await win.loadURL('http://127.0.0.1/kantor-rama-ai/web/index.html');
    await new Promise(r => setTimeout(r, 1500));
    const test = await win.webContents.executeJavaScript(`(() => {
      const c = document.getElementById('office-canvas');
      const mainCtx = c.getContext('2d');
      
      // Let's check drawAtlasSprite for tile (1, 2) 'server_rack_jarvis'
      const cached = getCachedAtlasFrame('server_rack_jarvis');
      const sprite = cached.sprite;
      const cols = sprite.grid_occupancy?.cols || 1;
      const rows = sprite.grid_occupancy?.rows || 1;
      const drawX = Math.round(1 * T + (cols * T) / 2 - sprite.pivot.x);
      const drawY = Math.round(2 * T + (rows * T) - sprite.pivot.y);
      
      // Check pixel at (drawX + 32, drawY + 40) before and after drawAtlasSprite
      const before = mainCtx.getImageData(drawX + 32, drawY + 40, 1, 1).data;
      drawAtlasSprite(1, 2, 'server_rack_jarvis');
      const after = mainCtx.getImageData(drawX + 32, drawY + 40, 1, 1).data;
      
      return {
        drawX, drawY,
        beforePixel: Array.from(before),
        afterPixel: Array.from(after),
        ctxIsMainCanvas: ctx === mainCtx,
        queueEntries: renderQueueBuffer.map(e => ({ kind: e.kind, item: e.item, x: e.tileX, y: e.tileY, sortY: e.sortY }))
      };
    })()`);
    console.log('DRAW TEST RESULT:', JSON.stringify(test, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    win.destroy();
    app.quit();
  }
});
