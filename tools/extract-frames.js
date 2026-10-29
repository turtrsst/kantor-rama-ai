const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    webPreferences: {
      webSecurity: false,
      offscreen: true
    }
  });

  const videoPath = 'file:///C:/Users/TU/Pictures/29.10.2026_12.03.08_REC.mp4';
  const html = `
    <!DOCTYPE html>
    <html>
      <body style="margin:0;background:#000;overflow:hidden;">
        <video id="v" src="${videoPath}" style="width:100vw;height:100vh;object-fit:contain;" playsinline muted></video>
      </body>
    </html>
  `;
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

  const info = await win.webContents.executeJavaScript(`new Promise((resolve) => {
    const v = document.getElementById('v');
    v.onloadedmetadata = () => {
      resolve({ duration: v.duration, width: v.videoWidth, height: v.videoHeight });
    };
    v.onerror = (e) => resolve({ error: 'Video load error: ' + (v.error ? v.error.message : 'unknown') });
    // timeout fallback
    setTimeout(() => resolve({ error: 'Timeout loading metadata' }), 8000);
  })`);

  console.log('Video Info:', JSON.stringify(info));

  if (!info.error && info.duration) {
    const count = 5;
    for (let i = 1; i <= count; i++) {
      const pct = i / (count + 1);
      const time = info.duration * pct;
      await win.webContents.executeJavaScript(`new Promise((resolve) => {
        const v = document.getElementById('v');
        v.currentTime = ${time};
        v.onseeked = () => resolve();
        setTimeout(resolve, 2000);
      })`);
      await new Promise(r => setTimeout(r, 200));
      const image = await win.capturePage();
      const outPath = path.join(__dirname, `video_frame_${i}.png`);
      fs.writeFileSync(outPath, image.toPNG());
      console.log('Saved frame:', outPath, 'at', time.toFixed(2), 's');
    }
  }

  win.destroy();
  app.quit();
});
