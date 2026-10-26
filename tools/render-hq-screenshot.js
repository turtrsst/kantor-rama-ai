const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1240,
    height: 960,
    show: false,
    webPreferences: {
      offscreen: true
    }
  });

  const filePath = path.join(__dirname, '../assets/voxel/renders/kra-headquarters-preview.html');
  await win.loadFile(filePath);

  setTimeout(async () => {
    try {
      const image = await win.capturePage();
      const outPath = path.join(__dirname, '../assets/voxel/renders/kra-headquarters-preview.png');
      fs.writeFileSync(outPath, image.toPNG());
      console.log('SUCCESS:' + outPath);
    } catch (err) {
      console.error('ERROR:' + err.message);
    } finally {
      app.quit();
    }
  }, 1200);
});
