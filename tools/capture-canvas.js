const { app, BrowserWindow, session } = require('electron');
const fs = require('fs');
const path = require('path');

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  await session.defaultSession.clearCache();
  await session.defaultSession.clearStorageData();

  const win = new BrowserWindow({ width: 1600, height: 1000, show: false });

  try {
    await win.loadURL('http://127.0.0.1/kantor-rama-ai/web/index.html?v=' + Date.now());
    await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const started = performance.now();
      const check = () => {
        if (window.KRA_APP_READY && document.getElementById('office-canvas').getBoundingClientRect().width > 0 && officeAtlas.ready) return resolve();
        if (performance.now() - started > 15000) return reject(new Error('startup timed out'));
        setTimeout(check, 50);
      };
      check();
    })`);
    await new Promise(r => setTimeout(r, 1500));

    const floor = Number(process.argv[process.argv.length - 1]) || 1;
    const dataUrl = await win.webContents.executeJavaScript(`(function(){
      if (typeof loadFloor === 'function') loadFloor(${floor}, false);
      return new Promise(res => setTimeout(() => {
        const src = document.getElementById('office-canvas');
        const out = document.createElement('canvas');
        out.width = src.width * 2;
        out.height = src.height * 2;
        const c = out.getContext('2d');
        c.imageSmoothingEnabled = false;
        c.drawImage(src, 0, 0, out.width, out.height);
        res(out.toDataURL('image/png'));
      }, 1500));
    })()`);

    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    const outPath = path.join(__dirname, 'canvas_floor' + floor + '.png');
    fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
    console.log('Saved:', outPath);
  } catch (err) {
    console.error(err);
  } finally {
    win.destroy();
    app.quit();
  }
});
