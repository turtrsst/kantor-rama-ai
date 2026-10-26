const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1140,
    height: 900,
    show: false,
    webPreferences: {
      offscreen: true
    }
  });

  const filePath = path.join(__dirname, '../assets/voxel/renders/rama-suite-preview.html');
  await win.loadFile(filePath);

  // Wait a short moment for canvas paint
  setTimeout(async () => {
    try {
      const image = await win.capturePage();
      const outPath = path.join(__dirname, '../assets/voxel/renders/rama-suite-preview.png');
      fs.writeFileSync(outPath, image.toPNG());
      console.log('SUCCESS:' + outPath);
    } catch (err) {
      console.error('ERROR:' + err.message);
    } finally {
      app.quit();
    }
  }, 1000);
});
