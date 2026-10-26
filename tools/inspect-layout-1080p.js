const { app, BrowserWindow } = require('electron');

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1920, height: 1080, show: false });
  win.setContentSize(1920, 1080);
  await win.loadURL('http://127.0.0.1/kantor-rama-ai/web/index.html');
  await new Promise(r => setTimeout(r, 1000));
  const report = await win.webContents.executeJavaScript(`(() => {
    const el = sel => document.querySelector(sel)?.getBoundingClientRect();
    return {
      window: { w: window.innerWidth, h: window.innerHeight },
      canvasContainerWidth: Math.round(el('#canvas-container')?.width),
      canvasContainerHeight: Math.round(el('#canvas-container')?.height),
      aspectRatio: (el('#canvas-container')?.width / el('#canvas-container')?.height).toFixed(3)
    };
  })()`);
  console.log(JSON.stringify(report, null, 2));
  win.destroy();
  app.quit();
});
