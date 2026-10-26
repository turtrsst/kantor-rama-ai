const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

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

  // Check if Apache is up
  const checkApache = () => new Promise(resolve => {
    const req = http.get('http://127.0.0.1/kantor-rama-ai/web/index.html', res => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(500, () => { req.destroy(); resolve(false); });
  });

  const apacheUp = await checkApache();
  if (apacheUp) {
    await win.loadURL('http://127.0.0.1/kantor-rama-ai/web/index.html');
  } else {
    await win.loadFile(path.join(__dirname, '../web/index.html'));
  }

  // Click Floor 2 button to render Floor 2
  setTimeout(async () => {
    try {
      await win.webContents.executeJavaScript(`
        const btnF2 = document.getElementById('btn-floor-2');
        if (btnF2) btnF2.click();
      `);

      setTimeout(async () => {
        const image = await win.capturePage();
        const outPath = path.join(__dirname, '../assets/voxel/renders/kra-live-app-floor2.png');
        fs.writeFileSync(outPath, image.toPNG());
        console.log('SUCCESS_FLOOR2:' + outPath);
        app.quit();
      }, 800);
    } catch (err) {
      console.error('ERROR:' + err.message);
      app.quit();
    }
  }, 1000);
});
