const { app, BrowserWindow } = require('electron');

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 800, show: false });
  await win.loadURL('http://127.0.0.1/kantor-rama-ai/web/index.html');
  await new Promise(r => setTimeout(r, 1000));
  const report = await win.webContents.executeJavaScript(`(() => {
    const el = sel => document.querySelector(sel)?.getBoundingClientRect();
    return {
      window: { w: window.innerWidth, h: window.innerHeight },
      titlebar: el('.kra-titlebar')?.height,
      mainStage: el('.kra-main-stage')?.height,
      rosterStrip: el('.agent-strip')?.height,
      panelHeader: el('.panel-header')?.height,
      auditTargetBar: el('.audit-target-bar')?.height,
      canvasContainer: el('#canvas-container')?.height,
      floorLegend: el('.floor-legend')?.height,
      canvasContainerWidth: el('#canvas-container')?.width,
      viewportWidth: el('.floor-viewport')?.width,
      sidebarWidth: el('.command-sidebar')?.width
    };
  })()`);
  console.log(JSON.stringify(report, null, 2));
  win.destroy();
  app.quit();
});
