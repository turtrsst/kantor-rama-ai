const { app, BrowserWindow } = require('electron');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 800, show: false });
  try {
    await win.loadURL('http://127.0.0.1/kantor-rama-ai/web/index.html');
    await new Promise(r => setTimeout(r, 1500));
    const status = await win.webContents.executeJavaScript(`(() => {
      const c = document.getElementById('office-canvas');
      const ctx2 = c.getContext('2d');
      const imgData = ctx2.getImageData(100, 100, 10, 10).data;
      return {
        clock: clock,
        frameCounter: frameCounter,
        activeFloor: activeFloor,
        floorTransitionAlpha: floorTransitionAlpha,
        canvasW: c.width,
        canvasH: c.height,
        canvasStyleW: c.style.width,
        canvasStyleH: c.style.height,
        firstPixels: Array.from(imgData.slice(0, 16)),
        atlasReady: officeAtlas.ready,
        decorLayer1: !!decorLayerCache[1],
        floor1FloorSample: floor[2][2]
      };
    })()`);
    console.log('STATUS:', JSON.stringify(status, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    win.destroy();
    app.quit();
  }
});
