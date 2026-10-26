const { app, BrowserWindow, session } = require('electron');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  await session.defaultSession.clearCache();
  await session.defaultSession.clearStorageData();
  const win = new BrowserWindow({ width: 1280, height: 800, show: false });
  try {
    await win.loadURL('http://127.0.0.1/kantor-rama-ai/web/index.html?v=20261025-ref3-' + Date.now());
    await new Promise(r => setTimeout(r, 1000));
    const result = await win.webContents.executeJavaScript(`(() => ({
      scriptTags: Array.from(document.scripts).map(s => s.src),
      deco: { server: deco[2][1], desk: deco[3][10], bookshelf: deco[2][8] },
      frameNames: ['serverrack','desk','bookshelf'].map(k => getAtlasFrameName(k)),
      atlasReady: officeAtlas.ready,
      canvasDisplay: { width: document.getElementById('office-canvas').style.width, height: document.getElementById('office-canvas').style.height }
    }))()`);
    console.log(JSON.stringify(result, null, 2));
  } catch (e) { console.error(e); }
  finally { win.destroy(); app.quit(); }
});
