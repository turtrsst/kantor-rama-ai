const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      offscreen: true
    }
  });

  try {
    await win.loadURL('http://127.0.0.1/kantor-rama-ai/web/index.html');
  } catch (_) {
    const filePath = path.join(__dirname, '../web/index.html');
    await win.loadFile(filePath);
  }

  setTimeout(async () => {
    try {
      const image = await win.capturePage();
      const outPath = path.join(__dirname, '../assets/voxel/renders/kra-live-app.png');
      fs.writeFileSync(outPath, image.toPNG());
      console.log('SUCCESS:' + outPath);
    } catch (err) {
      console.error('ERROR:' + err.message);
    } finally {
      app.quit();
    }
  }, 1200);
});
