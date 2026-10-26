const { app, BrowserWindow } = require('electron');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 800, show: false });
  try {
    await win.loadURL('http://127.0.0.1/kantor-rama-ai/web/index.html');
    await new Promise(r => setTimeout(r, 1500));
    const test = await win.webContents.executeJavaScript(`(() => {
      const c = getCachedAtlasFrame('server_rack_jarvis');
      const diffuseW = officeAtlas.diffuse.naturalWidth || officeAtlas.diffuse.width;
      const diffuseH = officeAtlas.diffuse.naturalHeight || officeAtlas.diffuse.height;
      
      // Let's check pixel data from cached.composite
      const compCtx = c.composite.getContext('2d');
      const imgData = compCtx.getImageData(0, 0, c.composite.width, c.composite.height).data;
      let nonZeroCount = 0;
      for (let i = 3; i < imgData.length; i += 4) {
        if (imgData[i] > 0) nonZeroCount++;
      }
      
      return {
        diffuseW, diffuseH,
        diffuseComplete: officeAtlas.diffuse.complete,
        compositeW: c.composite.width,
        compositeH: c.composite.height,
        nonZeroAlphaPixels: nonZeroCount,
        totalPixels: c.composite.width * c.composite.height,
        sprite: c.sprite
      };
    })()`);
    console.log('TEST RESULT:', JSON.stringify(test, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    win.destroy();
    app.quit();
  }
});
