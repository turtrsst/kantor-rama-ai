const { app, BrowserWindow, session } = require('electron');
const fs = require('fs');
const path = require('path');

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('in-process-gpu');
app.whenReady().then(async () => {
  await session.defaultSession.clearCache();
  const win = new BrowserWindow({ width: 1280, height: 800, show: false });
  const errors = [];
  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) errors.push(message);
  });
  try {
    await win.loadURL('http://127.0.0.1:8080/web/index.html?v=' + Date.now());
    await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const started = performance.now();
      const check = () => {
        if (window.officeAtlas && officeAtlas.ready) return resolve();
        if (performance.now() - started > 20000) return reject(new Error('Startup timed out; atlas ready=' + (window.officeAtlas && officeAtlas.ready) + ' err=' + (window.officeAtlas && officeAtlas.error)));
        setTimeout(check, 50);
      };
      check();
    })`);
    await new Promise(r => setTimeout(r, 1500));
    const info = await win.webContents.executeJavaScript(`({
      atlasSprites: Object.keys(officeAtlas.metadata.sprites).length,
      floor: activeFloor
    })`);
    console.log('INFO ' + JSON.stringify(info));
    const image = await win.capturePage();
    const outFloor1 = path.join(__dirname, '..', 'assets', 'argon', 'verify_floor1.png');
    fs.writeFileSync(outFloor1, image.toPNG());
    await win.webContents.executeJavaScript(`loadFloor(2, false)`);
    await new Promise(r => setTimeout(r, 800));
    const image2 = await win.capturePage();
    fs.writeFileSync(path.join(__dirname, '..', 'assets', 'argon', 'verify_floor2.png'), image2.toPNG());
    console.log('SAVED ' + outFloor1);
    console.log('CONSOLE_ERRORS ' + JSON.stringify(errors.slice(0, 10)));
  } catch (err) {
    console.error('ERROR ' + err.message);
  } finally {
    win.destroy();
    app.quit();
  }
});
