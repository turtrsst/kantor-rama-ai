const { app, BrowserWindow, session } = require('electron');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  await session.defaultSession.clearCache();
  await session.defaultSession.clearStorageData();
  const win = new BrowserWindow({ width: 1280, height: 800, show: false });
  try {
    await win.loadURL('http://127.0.0.1/kantor-rama-ai/web/index.html?v=' + Date.now());
    await new Promise(r => setTimeout(r, 1000));
    const res = await win.webContents.executeJavaScript(`(() => {
      let calls = [];
      const o = drawAtlasSprite;
      drawAtlasSprite = function(x,y,n) { calls.push({x,y,n}); return o(...arguments); };
      render();
      return {calls, queue: renderQueueBuffer.length, cache: Array.from(officeAtlas.cache.keys())};
    })()`);
    console.log(JSON.stringify(res, null, 2));
  } catch(e){console.error(e)} finally {win.destroy();app.quit()}
});
