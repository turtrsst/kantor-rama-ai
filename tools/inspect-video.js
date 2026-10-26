const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 720, show: false });
  const videoPath = 'file:///C:/Users/hp/Videos/Recording 2026-10-25 144251.mp4';
  
  const html = `
    <html>
      <body style="margin:0;background:#000;">
        <video id="v" src="${videoPath}" style="width:100%;height:100%;"></video>
      </body>
    </html>
  `;
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  
  const info = await win.webContents.executeJavaScript(`new Promise(resolve => {
    const v = document.getElementById('v');
    v.onloadedmetadata = () => {
      resolve({ duration: v.duration, width: v.videoWidth, height: v.videoHeight });
    };
    v.onerror = (e) => resolve({ error: 'Video load error: ' + (v.error ? v.error.message : 'unknown') });
  })`);
  console.log('Video Info:', JSON.stringify(info));

  if (!info.error) {
    // Capture 3 frames at 25%, 50%, 75%
    for (const pct of [0.25, 0.5, 0.75]) {
      const time = info.duration * pct;
      await win.webContents.executeJavaScript(`new Promise(resolve => {
        const v = document.getElementById('v');
        v.currentTime = ${time};
        v.onseeked = () => resolve();
      })`);
      const image = await win.capturePage();
      const outPath = path.join(__dirname, `../tools/temp_frame_${Math.round(pct * 100)}.png`);
      fs.writeFileSync(outPath, image.toPNG());
      console.log('Saved frame:', outPath);
    }
  }
  
  win.destroy();
  app.quit();
});
