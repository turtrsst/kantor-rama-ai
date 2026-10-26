const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await win.loadFile(path.join(__dirname, '../web/index.html'));
  await new Promise(r => setTimeout(r, 1000));
  const res = await win.webContents.executeJavaScript(`
    JSON.stringify(AGENTS.map(a => ({
      id: a.id, name: a.name, x: a.x, y: a.y, floorId: a.floorId, inTransit: a.inTransit,
      sceneBusy: a.sceneBusy, state: a.state
    })))
  `);
  console.log('AGENTS_RUN:', res);
  app.quit();
});
