const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 256,
    height: 128,
    show: false,
    webPreferences: { offscreen: true }
  });

  const outDir = path.join(__dirname, '../assets/tiled/tilesets');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const html = `
<!DOCTYPE html>
<html>
<head><style>body { margin: 0; background: transparent; }</style></head>
<body>
<canvas id="c" width="256" height="128"></canvas>
<script>
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // 8 columns x 4 rows = 32 tiles, each 32x32 px
  const T = 32;

  // Helper to draw tile at index
  function drawTile(idx, fn) {
    const col = idx % 8;
    const row = Math.floor(idx / 8);
    const X = col * T;
    const Y = row * T;
    ctx.save();
    ctx.translate(X, Y);
    fn(ctx, T);
    ctx.restore();
  }

  const p = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

  // Tile 0: Wood Light
  drawTile(0, (ctx, T) => {
    p(ctx, 0, 0, T, T, '#E5C896');
    p(ctx, 0, 0, T, 1, '#F3DEC0');
    p(ctx, 0, T-1, T, 1, '#CCA870');
    p(ctx, 8, 2, 1, T-4, '#CCA870');
    p(ctx, 24, 2, 1, T-4, '#CCA870');
  });

  // Tile 1: Wood Dark
  drawTile(1, (ctx, T) => {
    p(ctx, 0, 0, T, T, '#C9A66B');
    p(ctx, 0, 0, T, 1, '#D8B880');
    p(ctx, 0, T-1, T, 1, '#A88046');
    p(ctx, 16, 2, 1, T-4, '#A88046');
  });

  // Tile 2: Server Light
  drawTile(2, (ctx, T) => {
    p(ctx, 0, 0, T, T, '#33475B');
    p(ctx, 0, 0, T, 1, '#475E74');
    p(ctx, 0, 0, 1, T, '#475E74');
    p(ctx, T-1, 0, 1, T, '#212F3D');
    p(ctx, 0, T-1, T, 1, '#212F3D');
    p(ctx, 2, 2, 2, 2, '#00F5D4');
  });

  // Tile 3: Server Dark
  drawTile(3, (ctx, T) => {
    p(ctx, 0, 0, T, T, '#28394A');
    p(ctx, 0, 0, T, 1, '#374B5E');
    p(ctx, 0, 0, 1, T, '#374B5E');
    p(ctx, T-1, 0, 1, T, '#17222C');
    p(ctx, 0, T-1, T, 1, '#17222C');
  });

  // Tile 4: Manager Suite Executive Light
  drawTile(4, (ctx, T) => {
    p(ctx, 0, 0, T, T, '#96592F');
    p(ctx, 0, 0, T, 1, '#B07040');
    p(ctx, 0, T-1, T, 1, '#703D1A');
    p(ctx, 10, 4, 12, 1, '#B07040');
  });

  // Tile 5: Manager Suite Executive Dark
  drawTile(5, (ctx, T) => {
    p(ctx, 0, 0, T, T, '#7B4523');
    p(ctx, 0, 0, T, 1, '#945830');
    p(ctx, 0, T-1, T, 1, '#572E14');
  });

  // Tile 6: Studio Light
  drawTile(6, (ctx, T) => {
    p(ctx, 0, 0, T, T, '#DFCFB2');
    p(ctx, 0, 0, T, 1, '#EFE4D0');
    p(ctx, 0, T-1, T, 1, '#C5B290');
    p(ctx, 15, 0, 1, T, '#C5B290');
  });

  // Tile 7: Studio Dark
  drawTile(7, (ctx, T) => {
    p(ctx, 0, 0, T, T, '#C8B799');
    p(ctx, 0, 0, T, 1, '#D8C9B0');
    p(ctx, 0, T-1, T, 1, '#AE9B7B');
  });

  // Tile 8: Lobby Light
  drawTile(8, (ctx, T) => {
    p(ctx, 0, 0, T, T, '#EFECE6');
    p(ctx, 0, 0, T, 1, '#FAF8F5');
    p(ctx, 0, T-1, T, 1, '#D5D0C5');
    p(ctx, 16, 0, 1, T, '#D5D0C5');
  });

  // Tile 9: Lobby Dark
  drawTile(9, (ctx, T) => {
    p(ctx, 0, 0, T, T, '#D8D4CC');
    p(ctx, 0, 0, T, 1, '#E6E3DC');
    p(ctx, 0, T-1, T, 1, '#BCB7AD');
  });

  // Tile 10: Records Light
  drawTile(10, (ctx, T) => {
    p(ctx, 0, 0, T, T, '#6A432D');
    p(ctx, 0, 0, T, 1, '#82553B');
    p(ctx, 0, T-1, T, 1, '#4E2E1D');
  });

  // Tile 11: Records Dark
  drawTile(11, (ctx, T) => {
    p(ctx, 0, 0, T, T, '#4A2E20');
    p(ctx, 0, 0, T, 1, '#5E3C2B');
    p(ctx, 0, T-1, T, 1, '#341E13');
  });

  // Tile 12: Meeting Light
  drawTile(12, (ctx, T) => {
    p(ctx, 0, 0, T, T, '#B9A878');
    p(ctx, 0, 0, T, 1, '#CCBD93');
    p(ctx, 0, T-1, T, 1, '#9B895C');
  });

  // Tile 13: Meeting Dark
  drawTile(13, (ctx, T) => {
    p(ctx, 0, 0, T, T, '#8C7958');
    p(ctx, 0, 0, T, 1, '#A08D6C');
    p(ctx, 0, T-1, T, 1, '#6E5C3D');
  });

  // Tile 14: Pantry Light
  drawTile(14, (ctx, T) => {
    p(ctx, 0, 0, T, T, '#F2F4F7');
    p(ctx, 0, 0, T, 1, '#FFFFFF');
    p(ctx, 0, T-1, T, 1, '#D0D6DE');
    p(ctx, 16, 0, 1, T, '#D0D6DE');
  });

  // Tile 15: Pantry Dark
  drawTile(15, (ctx, T) => {
    p(ctx, 0, 0, T, T, '#D7DBE2');
    p(ctx, 0, 0, T, 1, '#E6E9EE');
    p(ctx, 0, T-1, T, 1, '#B8BFCB');
  });

  // Tile 16: Play Lounge Light
  drawTile(16, (ctx, T) => {
    p(ctx, 0, 0, T, T, '#3C2B22');
    p(ctx, 0, 0, T, 1, '#4F3B30');
    p(ctx, 0, T-1, T, 1, '#281B14');
  });

  // Tile 17: Play Lounge Dark
  drawTile(17, (ctx, T) => {
    p(ctx, 0, 0, T, T, '#2A1D19');
    p(ctx, 0, 0, T, 1, '#3A2924');
    p(ctx, 0, T-1, T, 1, '#1A100C');
  });

  // Tile 18: Grand Runway Corridor Base
  drawTile(18, (ctx, T) => {
    p(ctx, 0, 0, T, T, '#6B5138');
    p(ctx, 0, 0, T, 2, '#836548');
    p(ctx, 0, T-2, T, 2, '#4E3824');
    for (let x = 4; x < T; x += 8) {
      p(ctx, x, 4, 1, T-8, '#594029');
    }
  });

  // Tile 19: Grand Runway Runner Tile (Golden Glow)
  drawTile(19, (ctx, T) => {
    p(ctx, 0, 0, T, T, '#6B5138');
    p(ctx, 4, 2, 24, T-4, '#9E2A2B');
    p(ctx, 6, 4, 20, T-8, '#B23A3B');
    p(ctx, 8, 0, 2, T, '#F4D35E');
    p(ctx, 22, 0, 2, T, '#F4D35E');
  });

  // Tile 20: Wood Slat Wall Top (Crown Moulding)
  drawTile(20, (ctx, T) => {
    p(ctx, 0, 0, T, T, '#2A1C14');
    p(ctx, 0, 0, T, 4, '#4A3122');
    p(ctx, 0, 12, T, 3, '#180E09');
    p(ctx, 0, 15, T, T-15, '#352115');
    for (let sl = 2; sl < T; sl += 6) {
      p(ctx, sl, 4, 1, 10, '#1C120B');
      p(ctx, sl + 1, 4, 1, 10, '#38251A');
    }
  });

  // Tile 21: Server Tech Wall with Cyan Glowing Conduit
  drawTile(21, (ctx, T) => {
    p(ctx, 0, 0, T, T, '#121922');
    p(ctx, 0, 0, T, 3, '#222E3D');
    p(ctx, 0, 12, T, 2, '#0A0E14');
    p(ctx, 0, 5, T, 2, '#00F5D4');
    p(ctx, 0, 5, T, 1, '#80FFF0');
    p(ctx, 6, 8, 4, 3, '#00F5D4');
    p(ctx, 14, 8, 4, 3, '#FFD166');
    p(ctx, 22, 8, 4, 3, '#FF007F');
    p(ctx, 0, 14, T, T-14, '#19222E');
  });

  // Tile 22: Elevator Door Frame Hub
  drawTile(22, (ctx, T) => {
    p(ctx, 0, 0, T, T, '#17212D');
    p(ctx, 2, 2, T-4, T-4, '#0C1B28');
    p(ctx, 4, 4, T-8, T-8, '#31485B');
    p(ctx, 6, 6, T-12, T-12, 'rgba(0, 245, 212, 0.3)');
    p(ctx, 14, 2, 4, T-4, '#00F5D4');
  });

  // Tile 23: Velvet Executive Rug
  drawTile(23, (ctx, T) => {
    p(ctx, 0, 0, T, T, '#1A1E26');
    p(ctx, 2, 2, T-4, T-4, '#9E2A2B');
    p(ctx, 4, 4, T-8, T-8, '#781D20');
    p(ctx, 2, 2, T-4, 1, '#F4D35E');
    p(ctx, 2, T-3, T-4, 1, '#F4D35E');
  });
</script>
</body>
</html>
  `;

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise(r => setTimeout(r, 600));

  const dataUrl = await win.webContents.executeJavaScript(`canvas.toDataURL('image/png')`);
  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
  const outPng = path.join(outDir, 'office_architecture.png');
  fs.writeFileSync(outPng, base64Data, 'base64');
  console.log('Generated architecture tileset PNG at:', outPng);

  win.destroy();
  app.quit();
});
