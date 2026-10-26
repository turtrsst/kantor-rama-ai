const { app, BrowserWindow, session } = require('electron');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  // Clear all cache!
  await session.defaultSession.clearCache();
  await session.defaultSession.clearStorageData();
  
  const win = new BrowserWindow({ width: 1280, height: 800, show: false });
  try {
    await win.loadURL('http://127.0.0.1/kantor-rama-ai/web/index.html?t=' + Date.now());
    await new Promise(r => setTimeout(r, 1500));
    const codeSnippet = await win.webContents.executeJavaScript(`(() => {
      return {
        couchDecoY: deco[4][13],
        couchDecoY3: deco[3][13],
        deskDecoY: deco[3][10]
      };
    })()`);
    console.log('CACHE CHECK:', JSON.stringify(codeSnippet, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    win.destroy();
    app.quit();
  }
});
