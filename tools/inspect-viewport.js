const { app, BrowserWindow } = require('electron');

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 800, show: false });
  await win.loadURL('http://127.0.0.1/kantor-rama-ai/web/index.html');
  await new Promise(r => setTimeout(r, 1500));
  const dims = await win.webContents.executeJavaScript(`(() => {
    const c = document.getElementById('canvas-container');
    const cv = document.getElementById('office-canvas');
    const cr = c.getBoundingClientRect();
    const cvr = cv.getBoundingClientRect();
    const stage = document.querySelector('.kra-main-stage').getBoundingClientRect();
    const vp = document.querySelector('.floor-viewport').getBoundingClientRect();
    return {
      window: { innerWidth: window.innerWidth, innerHeight: window.innerHeight },
      stage: { w: Math.round(stage.width), h: Math.round(stage.height) },
      floorViewport: { w: Math.round(vp.width), h: Math.round(vp.height) },
      container: { w: Math.round(cr.width), h: Math.round(cr.height), clientW: c.clientWidth, clientH: c.clientHeight },
      canvasStyle: { w: cv.style.width, h: cv.style.height },
      canvasRect: { w: Math.round(cvr.width), h: Math.round(cvr.height) },
      canvasInternal: { w: cv.width, h: cv.height },
      ratioContainer: (cr.width / cr.height).toFixed(3),
      ratioCanvas: (cv.width / cv.height).toFixed(3)
    };
  })()`);
  console.log(JSON.stringify(dims, null, 2));
  win.destroy();
  app.quit();
});
