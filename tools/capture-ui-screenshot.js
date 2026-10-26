const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1266,
    height: 657,
    show: false,
    webPreferences: { offscreen: true }
  });

  try {
    await win.loadURL('http://127.0.0.1/kantor-rama-ai/web/index.html');
    await new Promise(r => setTimeout(r, 2000));
    const image = await win.capturePage();
    const outputPath = path.join(__dirname, 'chatbox_preview.png');
    fs.writeFileSync(outputPath, image.toPNG());
    console.log('Saved preview to:', outputPath);
  } catch (err) {
    console.error(err);
  } finally {
    win.destroy();
    app.quit();
  }
});
