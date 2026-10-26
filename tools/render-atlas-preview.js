const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();

const pageMarkup = (svgText) => `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin: 0; padding: 20px; background: #111722; color: #fff; font: 16px sans-serif; }
    canvas { width: 512px; height: 768px; image-rendering: pixelated; border: 1px solid #00f5d4; }
  </style>
</head>
<body>
  <h2>KRA 2.5D Atlas Preview · Diffuse + Emission</h2>
  <canvas id="atlas" width="512" height="768"></canvas>
  <script>
    const sourceSvg = ${JSON.stringify(svgText)};
    const image = new Image();
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sourceSvg);
    image.onload = () => {
      const canvas = document.getElementById('atlas');
      const context = canvas.getContext('2d');
      context.imageSmoothingEnabled = false;
      context.fillStyle = '#222e3d';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.save();
      context.scale(2, 2);
      context.drawImage(image, 0, 0);
      context.fillStyle = '#dce9f2';
      context.font = '4px monospace';
      const labels = [
        ['RACK · JARVIS', 0, 0],
        ['DESK · RAMA', 64, 0],
        ['ARCADE · DIMAS', 128, 0],
        ['PLANTER', 192, 0],
        ['BOOKSHELF · SITI', 0, 96],
        ['STUDIO · MAYA', 64, 96],
        ['PRESENTATION', 128, 96],
        ['COFFEE', 192, 96],
        ['CONFERENCE · BUDI', 0, 192],
        ['BILLIARD · DIMAS', 64, 192],
        ['OPS CONSOLE', 128, 192],
        ['CABLE NODE', 192, 192],
        ['ELEVATOR DOOR', 0, 288],
        ['OFFICE CHAIR', 64, 288],
        ['SECURITY TERMINAL', 128, 288],
        ['CUTAWAY WALL', 192, 288]
      ];
      labels.forEach(([label, x, y]) => context.fillText(label, x + 2, y + 92, 60));
      context.restore();
    };
  </script>
</body>
</html>`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1000,
    height: 620,
    show: false,
    webPreferences: { offscreen: true }
  });

  try {
    const atlasPath = path.join(__dirname, '../assets/voxel/atlas/office_furniture_diffuse.svg');
    const svgText = fs.readFileSync(atlasPath, 'utf8');
    const html = pageMarkup(svgText);
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    await new Promise(resolve => setTimeout(resolve, 300));

    const outputPath = path.join(__dirname, '../assets/voxel/renders/kra-atlas-assets-preview.png');
    fs.writeFileSync(outputPath, (await win.capturePage()).toPNG());
    console.log('SUCCESS:' + outputPath);
  } catch (error) {
    console.error('[FAIL] Preview render:', error.message);
    process.exitCode = 1;
  } finally {
    win.destroy();
    app.quit();
  }
});
