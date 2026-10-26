const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 600,
    height: 800,
    show: false,
    webPreferences: { offscreen: true }
  });

  const atlasDir = path.join(__dirname, '../assets/voxel/atlas');
  const diffuseSvgPath = path.join(atlasDir, 'office_furniture_diffuse.svg');
  const emissionSvgPath = path.join(atlasDir, 'office_furniture_emission.svg');

  const diffuseSvg = fs.readFileSync(diffuseSvgPath, 'utf8');
  const emissionSvg = fs.readFileSync(emissionSvgPath, 'utf8');

  async function renderSvgToPng(svgString, outFilename) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: transparent; overflow: hidden; }
        </style>
      </head>
      <body>
        <canvas id="c"></canvas>
        <script>
          const svgData = ${JSON.stringify(svgString)};
          const img = new Image();
          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);
          const canvas = document.getElementById('c');
          
          window.renderPromise = new Promise((resolve, reject) => {
            img.onload = () => {
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(img, 0, 0);
              URL.revokeObjectURL(url);
              resolve({
                dataUrl: canvas.toDataURL('image/png'),
                w: canvas.width,
                h: canvas.height
              });
            };
            img.onerror = reject;
            img.src = url;
          });
        </script>
      </body>
      </html>
    `;

    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    const result = await win.webContents.executeJavaScript('window.renderPromise');
    const base64Data = result.dataUrl.replace(/^data:image\/png;base64,/, '');
    const outPath = path.join(atlasDir, outFilename);
    fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));
    console.log('Saved:', outPath, 'Dimensions:', result.w, 'x', result.h);
  }

  try {
    await renderSvgToPng(diffuseSvg, 'office_furniture_diffuse.png');
    await renderSvgToPng(emissionSvg, 'office_furniture_emission.png');
    console.log('Atlas PNGs perfectly rendered at 1:1 pixel scale!');
  } catch (err) {
    console.error(err);
  } finally {
    win.destroy();
    app.quit();
  }
});
