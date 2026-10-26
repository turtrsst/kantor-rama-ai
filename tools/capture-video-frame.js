const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      webSecurity: false,
      offscreen: true
    }
  });

  const fileUrl = 'file:///' + 'C:/Users/hp/Videos/Recording 2026-10-25 144251.mp4'.replace(/\\/g, '/');
  
  try {
    await win.loadURL(fileUrl);
    await new Promise(r => setTimeout(r, 1000));
    const image = await win.capturePage();
    fs.writeFileSync(path.join(__dirname, 'video_preview.png'), image.toPNG());
    console.log('Captured video preview successfully!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    win.destroy();
    app.quit();
  }
});
