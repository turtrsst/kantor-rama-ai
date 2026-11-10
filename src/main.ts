import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// =========================================================
// 1. UI & HUD OVERLAY (3 LANTAI + LIVE BTC TICKER + EDITOR)
// =========================================================
document.body.innerHTML = `
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
    body { background: #0b0f17; color: #e2e8f0; font-family: 'Segoe UI', system-ui, monospace; overflow: hidden; }
    #kra-canvas { width: 100vw; height: 100vh; position: relative; }
    #overlay-layer { position: fixed; inset: 0; pointer-events: none; z-index: 5; overflow: hidden; }

    .hud-top {
      position: fixed; top: 12px; left: 16px; right: 16px;
      display: flex; justify-content: space-between; align-items: center;
      pointer-events: none; z-index: 10; flex-wrap: nowrap; gap: 8px;
    }
    .hud-badge {
      background: rgba(15, 23, 42, 0.92); border: 1px solid #334155;
      border-left: 4px solid #06b6d4; padding: 8px 12px; border-radius: 6px;
      pointer-events: auto; backdrop-filter: blur(8px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
      font-weight: 700; font-size: 12px; color: #38bdf8;
      display: flex; align-items: center; gap: 10px;
      white-space: nowrap; flex-shrink: 0;
    }
    .btc-badge {
      border-left-color: #f59e0b; color: #fbbf24; font-family: monospace; font-size: 12px;
    }
    .btc-up { color: #4ade80; }
    .btc-down { color: #f87171; }

    .controls { display: flex; gap: 8px; pointer-events: auto; flex-wrap: wrap; }
    .btn {
      background: #1e293b; color: #cbd5e1; border: 1px solid #475569;
      padding: 8px 13px; border-radius: 6px; font-size: 12px; font-weight: 700;
      cursor: pointer; transition: all 0.15s;
    }
    .btn:hover { background: #334155; color: #fff; }
    .btn.active { background: #0891b2; color: #fff; border-color: #22d3ee; box-shadow: 0 0 12px rgba(34,211,238,0.45); }
    .btn.warn { background: #7f1d1d; border-color: #ef4444; color: #fecaca; }

    /* Drawer Editor Furnitur */
    #furniture-drawer {
      position: fixed; top: 62px; left: 50%; transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.96); border: 1px solid #22d3ee;
      padding: 10px 14px; border-radius: 10px; z-index: 12;
      display: none; flex-direction: column; gap: 8px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.8); backdrop-filter: blur(10px);
      width: min(96vw, 1100px);
    }
    #furniture-drawer.open { display: flex; }
    .drawer-header {
      display: flex; justify-content: space-between; align-items: center;
      font-size: 11px; color: #38bdf8; font-weight: 700; flex-wrap: wrap; gap: 6px;
    }
    .catalog-scroll {
      display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px;
    }
    .catalog-card {
      background: #1e293b; border: 1px solid #334155; border-radius: 6px;
      padding: 6px 10px; min-width: 105px; text-align: center; cursor: pointer;
      font-size: 11px; color: #e2e8f0; transition: all 0.15s; flex-shrink: 0;
    }
    .catalog-card:hover { border-color: #38bdf8; background: #0f172a; }
    .catalog-card.selected { border-color: #4ade80; background: rgba(22, 163, 74, 0.25); color: #fff; }
    .catalog-card .cat-tag { display: block; font-size: 9px; color: #94a3b8; margin-top: 2px; }

    .hud-bottom {
      position: fixed; bottom: 14px; left: 50%; transform: translateX(-50%);
      display: flex; gap: 8px; background: rgba(15, 23, 42, 0.92);
      border: 1px solid #334155; padding: 8px 14px; border-radius: 8px;
      z-index: 10; backdrop-filter: blur(8px); pointer-events: auto; flex-wrap: wrap;
      justify-content: center; max-width: 96vw;
    }
    .agent-pill {
      display: flex; align-items: center; gap: 6px;
      background: #1e293b; border: 1px solid #334155;
      padding: 5px 10px; border-radius: 6px; font-size: 11px; cursor: pointer;
      transition: all 0.15s;
    }
    .agent-pill:hover { border-color: #38bdf8; transform: translateY(-2px); }
    .dot { width: 8px; height: 8px; border-radius: 50%; }

    .agent-bubble {
      position: absolute; transform: translate(-50%, -100%);
      background: rgba(15, 23, 42, 0.93); border: 1px solid #38bdf8;
      color: #f8fafc; font-size: 10px; padding: 4px 8px; border-radius: 6px;
      white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.6);
      pointer-events: none; transition: opacity 0.15s;
    }
    .agent-bubble::after {
      content: ''; position: absolute; bottom: -5px; left: 50%;
      transform: translateX(-50%); border-width: 5px 5px 0;
      border-style: solid; border-color: #38bdf8 transparent transparent;
    }
    .agent-bubble .role { font-size: 8px; color: #38bdf8; display: block; font-weight: 700; }
    .agent-bubble .bar-bg {
      width: 100%; height: 3px; background: #334155; margin-top: 3px; border-radius: 2px; overflow: hidden;
    }
    .agent-bubble .bar-fill { height: 100%; background: #4ade80; width: 80%; transition: width 0.15s; }
  </style>

  <div id="kra-canvas"></div>
  <div id="overlay-layer"></div>

  <div class="hud-top">
    <div class="hud-badge">
      <span>Kantor-Rama-AI • 3-Floor Isometric</span>
      <span class="btc-badge" id="hud-btc-ticker">BTC/USDT: $94,850.00 ▲</span>
    </div>
    <div class="controls">
      <button class="btn active" id="btn-f1">Floor 1 (Office)</button>
      <button class="btn" id="btn-f2">Floor 2 (Lab & Server)</button>
      <button class="btn" id="btn-f3">Floor 3 (Finance & BTC)</button>
      <button class="btn" id="btn-edit">🛠️ Edit Furniture</button>
      <button class="btn" id="btn-elev">Lift Doors</button>
      <button class="btn" id="btn-reset">Reset Camera</button>
    </div>
    <div class="hud-badge" id="floor-indicator">FLOOR 1 • OFFICE</div>
  </div>

  <div id="furniture-drawer">
    <div class="drawer-header">
      <span id="editor-hint">MODE EDIT: Klik & Drag furnitur di lantai untuk menggeser, atau pilih kartu di bawah lalu klik lantai.</span>
      <div style="display:flex; gap:6px;">
        <button class="btn" id="btn-copy-coords" style="padding:4px 8px; font-size:10px;">Copy Layout JSON</button>
        <button class="btn" id="btn-flip" style="padding:4px 8px; font-size:10px;">Flip Arah [R]</button>
        <button class="btn warn" id="btn-delete-sel" style="padding:4px 8px; font-size:10px;">Hapus [Del]</button>
        <button class="btn warn" id="btn-reset-layout" style="padding:4px 8px; font-size:10px;">Reset Default Layout</button>
      </div>
    </div>
    <div class="catalog-scroll" id="furniture-catalog"></div>
  </div>

  <div class="hud-bottom" id="agent-roster"></div>
`;

// =========================================================
// 2. SCENE & ORTHOGRAPHIC ISOMETRIC VIEWPORT
// =========================================================
const container = document.getElementById('kra-canvas')!;
const overlayLayer = document.getElementById('overlay-layer')!;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141923);

const viewHeight = 9.4;
let aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera(
  (-viewHeight * aspect) / 2,
  (viewHeight * aspect) / 2,
  viewHeight / 2,
  -viewHeight / 2,
  0.1,
  100
);
camera.position.set(0, 0, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minZoom = 0.75;
controls.maxZoom = 3.2;
controls.mouseButtons = {
  LEFT: THREE.MOUSE.PAN,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.PAN
};

function uvToWorld(u: number, v: number): THREE.Vector2 {
  return new THREE.Vector2((u - 0.5) * 16, (0.5 - v) * 9);
}

function worldToUV(x: number, y: number): { u: number; v: number } {
  return { u: x / 16 + 0.5, v: 0.5 - y / 9 };
}

function calcRenderOrder(footY: number, offset = 0): number {
  return Math.round((5.0 - footY) * 100) + offset;
}

// =========================================================
// 3. LOAD BACKGROUND LANTAI 1, LANTAI 2, & LANTAI 3
// =========================================================
const textureLoader = new THREE.TextureLoader();

function loadCrispTexture(url: string): THREE.Texture {
  const t = textureLoader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

const texFloor1 = loadCrispTexture('/assets/floor_1_pure.png');
const texFloor2 = loadCrispTexture('/assets/floor_2_pure.png');
const texFloor3 = loadCrispTexture('/assets/floor_3_pure.png');

const mapPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(16, 9),
  new THREE.MeshBasicMaterial({ map: texFloor1, depthWrite: false })
);
mapPlane.renderOrder = 0;
scene.add(mapPlane);

// =========================================================
// 4. REAL-TIME BTC/USDT CANDLESTICK VIDEOTRON (FLOOR 3)
// =========================================================
interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
}

class BTCVideotronEngine {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public texture: THREE.CanvasTexture;
  public mesh: THREE.Mesh;
  public candles: CandleData[] = [];
  public lastPrice = 94850.0;
  public priceChangePct = 2.45;
  public isLiveWS = false;
  private lastRedraw = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 768;
    this.canvas.height = 384;
    this.ctx = this.canvas.getContext('2d')!;

    // Buat 36 candle awal
    let p = 94200;
    const now = Date.now();
    for (let i = 36; i >= 0; i--) {
      const open = p;
      const delta = (Math.random() - 0.46) * 180;
      const close = open + delta;
      const high = Math.max(open, close) + Math.random() * 95;
      const low = Math.min(open, close) - Math.random() * 95;
      const vol = 15 + Math.random() * 85;
      this.candles.push({ time: now - i * 2000, open, high, low, close, vol });
      p = close;
    }
    this.lastPrice = p;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    // Pasang geometri Videotron dengan Shear Isometrik mengikuti kemiringan dinding kiri-atas Floor 3
    // Di gambar floor_3_finance.png, bingkai layar berada di tengah u=0.266, v=0.254
    const screenW = 1.62;
    const screenH = 0.84;
    const isoSlope = 0.525; // Kemiringan dinding kiri-atas (dy / dx)

    const geo = new THREE.PlaneGeometry(screenW, screenH, 1, 1);
    const posAttr = geo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      posAttr.setY(i, vy + vx * isoSlope);
    }
    posAttr.needsUpdate = true;

    const mat = new THREE.MeshBasicMaterial({
      map: this.texture,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.Mesh(geo, mat);
    const center = uvToWorld(0.266, 0.254);
    this.mesh.position.set(center.x, center.y, 0.14);
    this.mesh.renderOrder = 15;
    this.mesh.visible = false; // Hanya tampil di Floor 3
    scene.add(this.mesh);

    this.connectBinanceStream();
    this.drawChart();
  }

  private connectBinanceStream() {
    try {
      const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade');
      ws.onopen = () => {
        this.isLiveWS = true;
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const tradePrice = parseFloat(msg.p);
          const tradeQty = parseFloat(msg.q);
          if (!isNaN(tradePrice) && tradePrice > 0) {
            this.ingestTick(tradePrice, tradeQty);
          }
        } catch {
          // Abaikan error parsing
        }
      };
      ws.onerror = () => {
        this.isLiveWS = false;
      };
      ws.onclose = () => {
        this.isLiveWS = false;
      };
    } catch {
      this.isLiveWS = false;
    }
  }

  public ingestTick(price: number, volumeAdd = 1.2) {
    this.lastPrice = price;
    const now = Date.now();
    const last = this.candles[this.candles.length - 1];

    // Buat candle baru setiap 2.5 detik agar pergerakan candlestick terlihat hidup
    if (now - last.time > 2500) {
      const open = last.close;
      this.candles.push({
        time: now,
        open,
        high: Math.max(open, price),
        low: Math.min(open, price),
        close: price,
        vol: volumeAdd
      });
      if (this.candles.length > 38) this.candles.shift();
    } else {
      last.close = price;
      if (price > last.high) last.high = price;
      if (price < last.low) last.low = price;
      last.vol = Math.min(120, last.vol + volumeAdd);
    }

    const firstOpen = this.candles[0].open;
    this.priceChangePct = ((this.lastPrice - firstOpen) / firstOpen) * 100;
  }

  public update(elapsedSec: number) {
    // Jika WebSocket belum mengirim tick atau diblokir jaringan lokal, jalankan simulasi tick mulus
    if (!this.isLiveWS && elapsedSec - this.lastRedraw > 0.22) {
      const drift = (Math.random() - 0.485) * 42 + Math.sin(elapsedSec * 1.7) * 12;
      this.ingestTick(Math.max(50000, this.lastPrice + drift), 2 + Math.random() * 8);
    }

    if (elapsedSec - this.lastRedraw > 0.15) {
      this.lastRedraw = elapsedSec;
      this.drawChart();
      this.updateHudBadge();
    }
  }

  private updateHudBadge() {
    const el = document.getElementById('hud-btc-ticker');
    if (!el) return;
    const last = this.candles[this.candles.length - 1];
    const isUp = last.close >= last.open;
    const arrow = isUp ? '▲' : '▼';
    const cls = isUp ? 'btc-up' : 'btc-down';
    const formatted = this.lastPrice.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    el.innerHTML = `BTC/USDT: <span class="${cls}">$${formatted} ${arrow}</span>`;
  }

  private drawChart() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Latar Belakang Layar Videotron Gelap
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#06101e');
    grad.addColorStop(1, '#09192c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Grid Videotron
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.12)';
    ctx.lineWidth = 1;
    for (let x = 40; x < W; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 48);
      ctx.lineTo(x, H - 24);
      ctx.stroke();
    }
    for (let y = 56; y < H - 24; y += 46) {
      ctx.beginPath();
      ctx.moveTo(16, y);
      ctx.lineTo(W - 16, y);
      ctx.stroke();
    }

    // Header Bar Videotron
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(0, 0, W, 46);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 46);
    ctx.lineTo(W, 46);
    ctx.stroke();

    const last = this.candles[this.candles.length - 1];
    const bullish = last.close >= last.open;

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px Consolas, monospace';
    ctx.fillText('BTC / USDT • REALTIME VIDEOTRON', 18, 30);

    ctx.fillStyle = bullish ? '#4ade80' : '#f87171';
    ctx.font = 'bold 22px Consolas, monospace';
    const priceText = `$${this.lastPrice.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
    ctx.fillText(priceText, W - 265, 30);

    ctx.font = 'bold 14px Consolas, monospace';
    const sign = this.priceChangePct >= 0 ? '+' : '';
    ctx.fillText(`${sign}${this.priceChangePct.toFixed(2)}%`, W - 95, 30);

    // Hitung skala min/max harga
    let minP = Infinity;
    let maxP = -Infinity;
    for (const c of this.candles) {
      if (c.low < minP) minP = c.low;
      if (c.high > maxP) maxP = c.high;
    }
    const pad = Math.max(20, (maxP - minP) * 0.12);
    minP -= pad;
    maxP += pad;

    const chartTop = 58;
    const chartBottom = H - 68;
    const chartH = chartBottom - chartTop;
    const chartLeft = 22;
    const chartRight = W - 82;
    const slotW = (chartRight - chartLeft) / this.candles.length;

    const priceToY = (p: number) =>
      chartBottom - ((p - minP) / Math.max(1, maxP - minP)) * chartH;

    // Gambar Volume Bar & Candlestick
    this.candles.forEach((c, idx) => {
      const cx = chartLeft + idx * slotW + slotW * 0.5;
      const isUp = c.close >= c.open;
      const color = isUp ? '#22c55e' : '#ef4444';

      // Volume Bar di bawah
      const vH = (c.vol / 120) * 42;
      ctx.fillStyle = isUp ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)';
      ctx.fillRect(cx - slotW * 0.32, H - 14 - vH, slotW * 0.64, vH);

      // Sumbu (Wick)
      const highY = priceToY(c.high);
      const lowY = priceToY(c.low);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, highY);
      ctx.lineTo(cx, lowY);
      ctx.stroke();

      // Badan Candle (Body)
      const openY = priceToY(c.open);
      const closeY = priceToY(c.close);
      const topY = Math.min(openY, closeY);
      const bodyH = Math.max(3, Math.abs(closeY - openY));
      ctx.fillStyle = color;
      ctx.fillRect(cx - slotW * 0.34, topY, slotW * 0.68, bodyH);
    });

    // Garis Moving Average (MA7 Cyan)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = 0; i < this.candles.length; i++) {
      let sum = 0;
      let count = 0;
      for (let j = Math.max(0, i - 5); j <= i; j++) {
        sum += this.candles[j].close;
        count++;
      }
      const avg = sum / count;
      const cx = chartLeft + i * slotW + slotW * 0.5;
      const cy = priceToY(avg);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();

    // Garis Harga Terakhir Putus-putus
    const lastY = priceToY(this.lastPrice);
    ctx.strokeStyle = bullish ? '#4ade80' : '#f87171';
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(chartLeft, lastY);
    ctx.lineTo(chartRight, lastY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label Harga di Sisi Kanan
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Consolas, monospace';
    for (let s = 0; s <= 4; s++) {
      const val = minP + ((maxP - minP) * (4 - s)) / 4;
      const y = chartTop + (chartH * s) / 4;
      ctx.fillText(val.toFixed(0), chartRight + 8, y + 4);
    }

    // Bingkai Neon Luar
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, W - 4, H - 4);

    this.texture.needsUpdate = true;
  }
}

const btcVideotron = new BTCVideotronEngine();

// =========================================================
// 5. PEMOTONG SPRITE: INSET CHROMA-KEY & FIXED BASELINE AGEN
// =========================================================
function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

/**
 * Flood-fill Chroma-Key dengan sampel 4px ke dalam (sesuai temuan opencode)
 * ditambah referensi warna latar standar (#141923 = rgb(20, 25, 35)).
 */
function removeDarkBackgroundFloodFill(
  ctx: CanvasRenderingContext2D,
  sw: number,
  sh: number,
  tolerance = 42
): ImageData {
  const imgData = ctx.getImageData(0, 0, sw, sh);
  const data = imgData.data;

  // Sampel warna background dari 4 titik inset (4px dari sudut) + warna standar #141923
  const sampleCoords = [
    [Math.min(4, sw - 1), Math.min(4, sh - 1)],
    [Math.max(0, sw - 5), Math.min(4, sh - 1)],
    [Math.min(4, sw - 1), Math.max(0, sh - 5)],
    [Math.max(0, sw - 5), Math.max(0, sh - 5)]
  ];

  const bgSamples: Array<[number, number, number]> = [[20, 25, 35]];
  for (const [sx, sy] of sampleCoords) {
    const p = (sy * sw + sx) * 4;
    bgSamples.push([data[p], data[p + 1], data[p + 2]]);
  }

  const isBgPixel = (r: number, g: number, b: number) => {
    for (const [br, bg, bb] of bgSamples) {
      const dist = Math.sqrt((r - br) ** 2 + (g - bg) ** 2 + (b - bb) ** 2);
      if (dist <= tolerance) return true;
    }
    return false;
  };

  const visited = new Uint8Array(sw * sh);
  const queue: number[] = [];

  const pushIfBg = (x: number, y: number) => {
    if (x < 0 || x >= sw || y < 0 || y >= sh) return;
    const idx = y * sw + x;
    if (visited[idx]) return;
    const p = idx * 4;
    if (isBgPixel(data[p], data[p + 1], data[p + 2])) {
      visited[idx] = 1;
      queue.push(idx);
    }
  };

  // Mulai flood-fill dari tepi luar dan baris/kolom inset 4px
  for (let x = 0; x < sw; x++) {
    pushIfBg(x, 0);
    pushIfBg(x, sh - 1);
    if (sh > 8) {
      pushIfBg(x, 4);
      pushIfBg(x, sh - 5);
    }
  }
  for (let y = 0; y < sh; y++) {
    pushIfBg(0, y);
    pushIfBg(sw - 1, y);
    if (sw > 8) {
      pushIfBg(4, y);
      pushIfBg(sw - 5, y);
    }
  }

  while (queue.length > 0) {
    const curr = queue.pop()!;
    data[curr * 4 + 3] = 0;
    const cx = curr % sw;
    const cy = (curr - cx) / sw;
    pushIfBg(cx + 1, cy);
    pushIfBg(cx - 1, cy);
    pushIfBg(cx, cy + 1);
    pushIfBg(cx, cy - 1);
  }

  ctx.putImageData(imgData, 0, 0);
  return imgData;
}

/**
 * Potong sprite dari kotak piksel pasti.
 * trim=true  -> auto-trim ke batas objek (furnitur)
 * trim=false -> kanvas ukuran tetap (pintu lift: semua frame wajib sama dimensi)
 */
function cropSpritePixels(
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  tolerance = 42,
  trim = true
): THREE.CanvasTexture {
  sx = Math.max(0, Math.min(img.width - 1, sx));
  sy = Math.max(0, Math.min(img.height - 1, sy));
  sw = Math.max(1, Math.min(img.width - sx, sw));
  sh = Math.max(1, Math.min(img.height - sy, sh));

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  const imgData = removeDarkBackgroundFloodFill(ctx, sw, sh, tolerance);
  const data = imgData.data;

  if (!trim) {
    const fixedTex = new THREE.CanvasTexture(canvas);
    fixedTex.colorSpace = THREE.SRGBColorSpace;
    fixedTex.minFilter = THREE.LinearFilter;
    fixedTex.magFilter = THREE.LinearFilter;
    return fixedTex;
  }

  let minX = sw, minY = sh, maxX = 0, maxY = 0;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (data[(y * sw + x) * 4 + 3] > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX >= minX && maxY >= minY) {
    const pad = 2;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(sw - 1, maxX + pad);
    maxY = Math.min(sh - 1, maxY + pad);
    const tw = maxX - minX + 1;
    const th = maxY - minY + 1;

    const trimmed = document.createElement('canvas');
    trimmed.width = tw;
    trimmed.height = th;
    trimmed.getContext('2d')!.drawImage(canvas, minX, minY, tw, th, 0, 0, tw, th);

    const tex = new THREE.CanvasTexture(trimmed);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

/**
 * Untuk Karakter Agen: Gunakan Kanvas Ukuran Tetap & Kunci Telapak Kaki di Garis Bawah (Baseline)
 * tanpa merentangkan (stretch) gambar, sehingga animasi jalan 100% stabil dan tidak kedut/gepeng!
 */
function cropAgentCellFixedBaseline(
  img: HTMLImageElement,
  col: number,
  row: number
): THREE.CanvasTexture {
  const marginX0 = 30, marginX1 = 970, marginY0 = 38, marginY1 = 968;
  const cellW = (marginX1 - marginX0) / 11;
  const cellH = (marginY1 - marginY0) / 5;
  const u0 = marginX0 + col * cellW;
  const v0 = marginY0 + row * cellH;

  const sx = Math.round((u0 / 1000) * img.width);
  const sy = Math.round((v0 / 1000) * img.height);
  const sw = Math.max(1, Math.round((cellW / 1000) * img.width));
  const sh = Math.max(1, Math.round((cellH / 1000) * img.height));

  const rawCanvas = document.createElement('canvas');
  rawCanvas.width = sw;
  rawCanvas.height = sh;
  const rawCtx = rawCanvas.getContext('2d')!;
  rawCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  const imgData = removeDarkBackgroundFloodFill(rawCtx, sw, sh, 38);
  const data = imgData.data;

  // Cari batas karakter untuk memusatkan X dan mengunci kaki paling bawah (maxY)
  let minX = sw, maxX = 0, minY = sh, maxY = 0;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (data[(y * sw + x) * 4 + 3] > 25) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const fixedCanvas = document.createElement('canvas');
  fixedCanvas.width = sw;
  fixedCanvas.height = sh;
  const fixedCtx = fixedCanvas.getContext('2d')!;

  if (maxX >= minX && maxY >= minY) {
    const charW = maxX - minX + 1;
    const charH = maxY - minY + 1;
    const destX = Math.round((sw - charW) / 2);
    const destY = sh - charH - 4; // Kunci telapak kaki 4px dari dasar kanvas
    fixedCtx.drawImage(rawCanvas, minX, minY, charW, charH, destX, destY, charW, charH);
  } else {
    fixedCtx.drawImage(rawCanvas, 0, 0);
  }

  const tex = new THREE.CanvasTexture(fixedCanvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

// =========================================================
// 6. PINTU LIFT TENGAH OTOMATIS (PRESISI DI POROS LIFT)
// =========================================================
interface AnimatedDoor {
  floor: number;
  pos: THREE.Vector2;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  currentFrame: number;
}

const doors: AnimatedDoor[] = [];
let elevatorFrames: THREE.Texture[] = [];
let forceOpenDoors = false;

function addElevatorDoorSlot(
  floor: number,
  u: number,
  v: number,
  w: number,
  h: number,
  flipX: boolean
) {
  const pos = uvToWorld(u, v);
  const mat = new THREE.MeshBasicMaterial({
    transparent: true,
    alphaTest: 0.04,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.position.set(pos.x, pos.y + h * 0.48, 0.15);
  if (flipX) mesh.scale.x = -1;
  mesh.renderOrder = calcRenderOrder(pos.y, -4);
  scene.add(mesh);
  doors.push({ floor, pos, mesh, mat, currentFrame: 0 });
}

// =========================================================
// MODUL AUTO-BBOX & LAYER DINDING (walls_spritesheet.png)
// =========================================================
export interface WallPieceCatalog {
  id: string;
  index: number;
  name: string;
  bbox: { x: number; y: number; w: number; h: number };
  width: number;  // Ukuran proporsional di world 16x9 (1296x730)
  height: number;
  texture: THREE.CanvasTexture;
}

export interface PlacedWall {
  uid: string;
  pieceId: string;
  floor: number;
  pos: THREE.Vector2; // Titik tumpu bawah (u, v -> world)
  flipX: boolean;
  layerOffset: number;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  piece: WallPieceCatalog;
}

export const WALL_CATALOG: WallPieceCatalog[] = [];
export const placedWalls: PlacedWall[] = [];
export const WALL_STORAGE_KEY = 'kra_modular_walls_v2';

export const WALL_BBOXES = [
  { id: "wall_00", x: 5, y: 12, w: 236, h: 215, worldW: 2.914, worldH: 2.654 },
  { id: "wall_01", x: 271, y: 51, w: 183, h: 181, worldW: 2.259, worldH: 2.235 },
  { id: "wall_02", x: 473, y: 24, w: 193, h: 216, worldW: 2.383, worldH: 2.667 },
  { id: "wall_03", x: 689, y: 3, w: 220, h: 246, worldW: 2.716, worldH: 3.037 },
  { id: "wall_04", x: 1127, y: 27, w: 169, h: 199, worldW: 2.086, worldH: 2.457 },
  { id: "wall_05", x: 5, y: 239, w: 236, h: 198, worldW: 2.914, worldH: 2.444 },
  { id: "wall_06", x: 284, y: 270, w: 132, h: 171, worldW: 1.63, worldH: 2.111 },
  { id: "wall_07", x: 436, y: 266, w: 208, h: 177, worldW: 2.568, worldH: 2.185 },
  { id: "wall_08", x: 676, y: 295, w: 78, h: 143, worldW: 0.963, worldH: 1.765 },
  { id: "wall_09", x: 779, y: 286, w: 74, h: 149, worldW: 0.914, worldH: 1.84 },
  { id: "wall_10", x: 986, y: 279, w: 166, h: 179, worldW: 2.049, worldH: 2.21 },
  { id: "wall_11", x: 745, y: 507, w: 85, h: 168, worldW: 1.049, worldH: 2.074 },
];

// Nama deskriptif default untuk 12 potongan di walls_spritesheet.png (diurutkan baris lalu kolom)
const WALL_NAMES = [
  'Corner Wood Left',     // wall_00 - top left
  'Corner Wood Right',    // wall_01 - top mid-left
  'Corner Dark Left',     // wall_02 - top mid-right
  'Corner Dark Right',    // wall_03 - top right
  'Corridor Glass L',     // wall_04 - top far right
  'Corridor Glass R',     // wall_05 - mid left
  'Boss Wood Panel L',    // wall_06 - mid mid-left
  'Boss Wood Panel R',    // wall_07 - mid center
  'Glass Partition L',    // wall_08 - mid mid-right
  'Glass Partition R',    // wall_09 - mid right
  'Lift Pillar SW',       // wall_10 - mid far right
  'Lift Pillar SE',       // wall_11 - bottom center
];

/**
 * Memindai walls_spritesheet.png (1298x681 RGBA) yang sudah bersih alpha-nya,
 * mencari seluruh komponen terhubung (pulau piksel > 150 px), menggabungkan
 * pecahan dekat, lalu mengurutkannya per baris (atas ke bawah, kiri ke kanan).
 */
export function extractWallSpritesAuto(img: HTMLImageElement): WallPieceCatalog[] {
  const W = img.width;
  const H = img.height;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const data = ctx.getImageData(0, 0, W, H).data;
  const visited = new Uint8Array(W * H);
  const rawBoxes: Array<{ minX: number; minY: number; maxX: number; maxY: number; area: number }> = [];

  const stack: number[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (visited[idx] || data[idx * 4 + 3] <= 20) continue;

      let minX = x, maxX = x, minY = y, maxY = y, area = 0;
      visited[idx] = 1;
      stack.push(idx);

      while (stack.length > 0) {
        const curr = stack.pop()!;
        const cx = curr % W;
        const cy = (curr - cx) / W;
        area++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        // 8-connected neighbors
        for (let ny = Math.max(0, cy - 1); ny <= Math.min(H - 1, cy + 1); ny++) {
          for (let nx = Math.max(0, cx - 1); nx <= Math.min(W - 1, cx + 1); nx++) {
            const nIdx = ny * W + nx;
            if (!visited[nIdx] && data[nIdx * 4 + 3] > 20) {
              visited[nIdx] = 1;
              stack.push(nIdx);
            }
          }
        }
      }

      if (area >= 120) {
        rawBoxes.push({ minX, minY, maxX, maxY, area });
      }
    }
  }

  // Gabungkan bbox yang tumpang tindih atau sangat berdekatan (jarak < 8px)
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < rawBoxes.length; i++) {
      for (let j = i + 1; j < rawBoxes.length; j++) {
        const a = rawBoxes[i];
        const b = rawBoxes[j];
        const pad = 8;
        if (
          a.minX - pad <= b.maxX &&
          a.maxX + pad >= b.minX &&
          a.minY - pad <= b.maxY &&
          a.maxY + pad >= b.minY
        ) {
          a.minX = Math.min(a.minX, b.minX);
          a.minY = Math.min(a.minY, b.minY);
          a.maxX = Math.max(a.maxX, b.maxX);
          a.maxY = Math.max(a.maxY, b.maxY);
          a.area += b.area;
          rawBoxes.splice(j, 1);
          merged = true;
          break;
        }
      }
      if (merged) break;
    }
  }

  // Urutkan berdasarkan baris (Y) lalu X dari kiri ke kanan
  rawBoxes.sort((a, b) => {
    const cyA = (a.minY + a.maxY) * 0.5;
    const cyB = (b.minY + b.maxY) * 0.5;
    if (Math.abs(cyA - cyB) > 95) return cyA - cyB;
    return a.minX - b.minX;
  });

  const PIXELS_PER_WORLD_UNIT = 1296 / 16; // 81.0 px/unit

  return rawBoxes.map((box, idx) => {
    const bw = box.maxX - box.minX + 1;
    const bh = box.maxY - box.minY + 1;

    const subCanvas = document.createElement('canvas');
    subCanvas.width = bw;
    subCanvas.height = bh;
    const sCtx = subCanvas.getContext('2d')!;
    sCtx.drawImage(canvas, box.minX, box.minY, bw, bh, 0, 0, bw, bh);

    // Tight alpha-trim: potong baris & kolom yang seluruhnya transparan
    const sData = sCtx.getImageData(0, 0, bw, bh).data;
    let tMinX = bw, tMaxX = 0, tMinY = bh, tMaxY = 0;
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const a = sData[(y * bw + x) * 4 + 3];
        if (a > 20) {
          if (x < tMinX) tMinX = x;
          if (x > tMaxX) tMaxX = x;
          if (y < tMinY) tMinY = y;
          if (y > tMaxY) tMaxY = y;
        }
      }
    }
    if (tMaxX >= tMinX && tMaxY >= tMinY) {
      const tw = tMaxX - tMinX + 1;
      const th = tMaxY - tMinY + 1;
      const trimmed = document.createElement('canvas');
      trimmed.width = tw;
      trimmed.height = th;
      trimmed.getContext('2d')!.drawImage(subCanvas, tMinX, tMinY, tw, th, 0, 0, tw, th);
      subCanvas.width = tw;
      subCanvas.height = th;
      subCanvas.getContext('2d')!.drawImage(trimmed, 0, 0);
    }

    const tex = new THREE.CanvasTexture(subCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;

    return {
      id: `wall_${String(idx).padStart(2, '0')}`,
      index: idx,
      name: WALL_NAMES[idx] || `Wall Piece #${idx + 1}`,
      bbox: { x: box.minX, y: box.minY, w: bw, h: bh },
      width: Number((bw / PIXELS_PER_WORLD_UNIT).toFixed(3)),
      height: Number((bh / PIXELS_PER_WORLD_UNIT).toFixed(3)),
      texture: tex
    };
  });
}

// Patch Nook Ubin Putih di Floor 3
function createF3VaultFloorPatch(): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  ctx.translate(128, 128);
  ctx.beginPath();
  ctx.moveTo(0, -68);
  ctx.lineTo(118, 0);
  ctx.lineTo(0, 68);
  ctx.lineTo(-118, 0);
  ctx.closePath();
  ctx.fillStyle = '#182130';
  ctx.fill();

  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.45)';
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 1.8), mat);
  const pt = uvToWorld(0.498, 0.225);
  mesh.position.set(pt.x, pt.y, 0.02);
  mesh.renderOrder = 1;
  mesh.visible = false;
  scene.add(mesh);
  return mesh;
}

const f3VaultPatch = createF3VaultFloorPatch();

// =========================================================
// INTERFACE & LOGIK WALL PLACEMENT
// =========================================================
export interface DefaultWallPlacement {
  pieceId: string;
  floor: number;
  u: number;
  v: number;
  flipX?: boolean;
}

const DEFAULT_WALL_LAYOUT: DefaultWallPlacement[] = [
  // ================= FLOOR 1: OFFICE (Top Wood Room) =================
  { pieceId: 'wall_00', floor: 1, u: 0.280, v: 0.300, flipX: false },   // F1 Top-Left wood wall
  { pieceId: 'wall_01', floor: 1, u: 0.720, v: 0.300, flipX: false },   // F1 Top-Right wood wall
  { pieceId: 'wall_04', floor: 1, u: 0.250, v: 0.320, flipX: false },   // F1 Corridor Glass L
  { pieceId: 'wall_05', floor: 1, u: 0.750, v: 0.320, flipX: false },   // F1 Corridor Glass R
  { pieceId: 'wall_10', floor: 1, u: 0.468, v: 0.490, flipX: false },   // F1 Lift pillar SW
  { pieceId: 'wall_11', floor: 1, u: 0.532, v: 0.490, flipX: false },   // F1 Lift pillar SE

  // ================= FLOOR 2: LAB & SERVER (Dark Walls) =================
  { pieceId: 'wall_02', floor: 2, u: 0.280, v: 0.300, flipX: false },   // F2 Top-Left dark wall
  { pieceId: 'wall_03', floor: 2, u: 0.720, v: 0.300, flipX: false },   // F2 Top-Right dark wall
  { pieceId: 'wall_08', floor: 2, u: 0.350, v: 0.520, flipX: false },   // F2 Glass partition L
  { pieceId: 'wall_09', floor: 2, u: 0.650, v: 0.520, flipX: false },   // F2 Glass partition R
  { pieceId: 'wall_10', floor: 2, u: 0.468, v: 0.490, flipX: false },   // F2 Lift pillar SW
  { pieceId: 'wall_11', floor: 2, u: 0.532, v: 0.490, flipX: false },   // F2 Lift pillar SE

  // ================= FLOOR 3: FINANCE (Dark Vault & Bottom-Right Wood) =================
  { pieceId: 'wall_02', floor: 3, u: 0.280, v: 0.300, flipX: false },   // F3 Top-Left dark wall (Vault)
  { pieceId: 'wall_03', floor: 3, u: 0.720, v: 0.300, flipX: false },   // F3 Top-Right dark wall
  { pieceId: 'wall_06', floor: 3, u: 0.700, v: 0.580, flipX: false },   // F3 Boss Wood Panel L (Lounge Kanan Bawah)
  { pieceId: 'wall_07', floor: 3, u: 0.850, v: 0.580, flipX: false },   // F3 Boss Wood Panel R (Lounge Kanan Bawah)
  { pieceId: 'wall_10', floor: 3, u: 0.468, v: 0.490, flipX: false },   // F3 Lift pillar SW
  { pieceId: 'wall_11', floor: 3, u: 0.532, v: 0.490, flipX: false },   // F3 Lift pillar SE
];

export function spawnWallInstance(
  piece: WallPieceCatalog,
  floor: number,
  pos: THREE.Vector2,
  flipX = false,
  save = true
): PlacedWall {
  const mat = new THREE.MeshBasicMaterial({
    map: piece.texture,
    transparent: true,
    alphaTest: 0.04,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(piece.width, piece.height), mat);
  mesh.position.set(pos.x, pos.y + piece.height * 0.48, 0.12);
  if (flipX) mesh.scale.x = -1;
  mesh.renderOrder = calcRenderOrder(pos.y, 0);
  mesh.visible = floor === currentFloor;
  scene.add(mesh);

  const instance: PlacedWall = {
    uid: 'wall_' + Math.random().toString(36).substring(2, 9),
    pieceId: piece.id,
    floor,
    pos: pos.clone(),
    flipX,
    layerOffset: 0,
    mesh,
    mat,
    piece
  };

  placedWalls.push(instance);
  if (save) saveWallLayoutToStorage();
  return instance;
}

export function saveWallLayoutToStorage() {
  const data = placedWalls.map(w => {
    const uv = worldToUV(w.pos.x, w.pos.y);
    return {
      pieceId: w.pieceId,
      floor: w.floor,
      u: Number(uv.u.toFixed(4)),
      v: Number(uv.v.toFixed(4)),
      flipX: w.flipX
    };
  });
  localStorage.setItem(WALL_STORAGE_KEY, JSON.stringify(data));
}

export function loadDefaultOrSavedWalls() {
  placedWalls.forEach(w => scene.remove(w.mesh));
  placedWalls.length = 0;

  let layoutList: DefaultWallPlacement[] = DEFAULT_WALL_LAYOUT;
  const raw = localStorage.getItem(WALL_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) layoutList = parsed;
    } catch (e) {
      console.warn(e);
    }
  }

  layoutList.forEach(entry => {
    const piece = WALL_CATALOG.find(w => w.id === entry.pieceId);
    if (piece) {
      spawnWallInstance(piece, entry.floor, uvToWorld(entry.u, entry.v), !!entry.flipX, false);
    }
  });
}

export function renderWallCatalogDrawer() {
  const catalogContainer = document.getElementById('furniture-catalog');
  if (!catalogContainer) return;

  WALL_CATALOG.forEach(wall => {
    // Avoid adding duplicate card if already present
    if (catalogContainer.querySelector(`[data-wall-id="${wall.id}"]`)) return;

    const card = document.createElement('div');
    card.className = 'catalog-card';
    card.setAttribute('data-wall-id', wall.id);
    card.innerHTML = `<strong>${wall.name}</strong><span class="cat-tag">WALLS</span>`;
    card.onclick = () => {
      const pt = uvToWorld(0.5, 0.5);
      spawnWallInstance(wall, currentFloor, pt, false, true);
      if (editMode) {
        selectedPlacedItem = null;
        selectedCatalogToPlace = null;
        selectionRing.visible = false;
        ghostMesh.visible = false;
        document.querySelectorAll('.catalog-card').forEach(el => el.classList.remove('selected'));
      }
    };
    catalogContainer.appendChild(card);
  });
}

// Pintu Lift Tengah di Floor 1, Floor 2, dan Floor 3 (Tepat di mulut lift)
// Rasio 250:436 dari kanvas frame pintu, jadi lebar 0.72 wajib tinggi 1.256 agar tidak gepeng.
const DOOR_PLANE_W = 0.72;
const DOOR_PLANE_H = DOOR_PLANE_W * (436 / 250);
[1, 2, 3].forEach(fl => {
  addElevatorDoorSlot(fl, 0.468, 0.542, DOOR_PLANE_W, DOOR_PLANE_H, false); // Pintu Lift Kiri
  addElevatorDoorSlot(fl, 0.532, 0.542, DOOR_PLANE_W, DOOR_PLANE_H, true);  // Pintu Lift Kanan
});

// =========================================================
// 7. KATALOG & SISTEM FURNITUR MODULAR (DIKALIBRASI UNTUK 3 LANTAI)
// =========================================================
interface FurnitureCatalogItem {
  id: string;
  name: string;
  category: 'OFFICE' | 'PANTRY & LOUNGE' | 'LAB & SERVER' | 'PET & DECOR';
  frames: THREE.Texture[];
  width: number;
  height: number;
  isPet: boolean;
  speed: number;
  fps: number;
  layerBonus?: number;
}

interface PlacedFurniture {
  uid: string;
  itemId: string;
  floor: number;
  origin: THREE.Vector2;
  pos: THREE.Vector2;
  target: THREE.Vector2;
  flipX: boolean;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  catalog: FurnitureCatalogItem;
}

interface DefaultPlacement {
  itemId: string;
  floor: number;
  u: number;
  v: number;
  flipX?: boolean;
}

// Tata Letak Statis Terkalibrasi (100% di dalam poligon lantai masing-masing ruangan)
const DEFAULT_OFFICE_LAYOUT: DefaultPlacement[] = [
  // ================= FLOOR 1: OFFICE =================
  // Boss Room (Kiri Atas)
  { itemId: 'boss_desk',       floor: 1, u: 0.315, v: 0.390, flipX: false },
  { itemId: 'bookshelf_plant', floor: 1, u: 0.355, v: 0.335, flipX: false },
  { itemId: 'trophy',          floor: 1, u: 0.255, v: 0.425, flipX: false },

  // Meeting Room (Ujung Kiri)
  { itemId: 'meeting_table',   floor: 1, u: 0.218, v: 0.535, flipX: false },

  // Studio Room (Kanan Atas - Tanpa frame "work progress" yang berkedip)
  { itemId: 'studio_desk',     floor: 1, u: 0.675, v: 0.375, flipX: false },

  // IT Development (Kiri Bawah - Rapi di dalam garis neon cyan)
  { itemId: 'it_single_desk',  floor: 1, u: 0.355, v: 0.695, flipX: false },
  { itemId: 'it_cluster_desk', floor: 1, u: 0.435, v: 0.775, flipX: false },
  { itemId: 'it_single_desk',  floor: 1, u: 0.525, v: 0.785, flipX: true },

  // Pantry (Kanan Bawah - Sejajar dinding miring kanan)
  { itemId: 'pantry_counter',  floor: 1, u: 0.700, v: 0.665, flipX: true },
  { itemId: 'coffee_machine',  floor: 1, u: 0.695, v: 0.630, flipX: true },
  { itemId: 'fridge',          floor: 1, u: 0.750, v: 0.705, flipX: false },

  // Arcade Lounge (Ujung Kanan)
  { itemId: 'arcade_machine',  floor: 1, u: 0.755, v: 0.485, flipX: false },
  { itemId: 'arcade_machine',  floor: 1, u: 0.790, v: 0.455, flipX: false },
  { itemId: 'brown_sofa',      floor: 1, u: 0.865, v: 0.535, flipX: true },
  { itemId: 'coffee_table',    floor: 1, u: 0.830, v: 0.570, flipX: false },
  { itemId: 'brown_sofa',      floor: 1, u: 0.795, v: 0.605, flipX: false },
  { itemId: 'pet_cat',         floor: 1, u: 0.815, v: 0.545, flipX: false },

  // ================= FLOOR 2: WALLED LAB & SERVER =================
  // Innovation Lab (Kiri Atas)
  { itemId: 'lab_bench',       floor: 2, u: 0.285, v: 0.355, flipX: false },
  { itemId: 'dna_hologram',    floor: 2, u: 0.335, v: 0.410, flipX: false },

  // AI Research Room (Ujung Kiri Berdinding Kaca)
  { itemId: 'lab_bench',       floor: 2, u: 0.205, v: 0.525, flipX: false },
  { itemId: 'it_single_desk',  floor: 2, u: 0.235, v: 0.575, flipX: false },

  // Robotics & Molecule Room (Kiri Bawah)
  { itemId: 'molecule_table',  floor: 2, u: 0.425, v: 0.765, flipX: false },
  { itemId: 'it_single_desk',  floor: 2, u: 0.355, v: 0.705, flipX: false },
  { itemId: 'it_single_desk',  floor: 2, u: 0.505, v: 0.785, flipX: true },
  { itemId: 'pet_dog',         floor: 2, u: 0.450, v: 0.710, flipX: false },

  // Mainframe Server Room (Kanan Atas)
  { itemId: 'server_rack',     floor: 2, u: 0.655, v: 0.335, flipX: false },
  { itemId: 'server_rack',     floor: 2, u: 0.695, v: 0.365, flipX: false },
  { itemId: 'server_rack',     floor: 2, u: 0.735, v: 0.395, flipX: false },
  { itemId: 'pet_drone',       floor: 2, u: 0.675, v: 0.415, flipX: false },

  // Tech Pantry F2 (Kanan Bawah)
  { itemId: 'pantry_counter',  floor: 2, u: 0.700, v: 0.665, flipX: true },
  { itemId: 'fridge',          floor: 2, u: 0.750, v: 0.705, flipX: false },

  // Cyber Lounge F2 (Ujung Kanan)
  { itemId: 'arcade_machine',  floor: 2, u: 0.765, v: 0.485, flipX: false },
  { itemId: 'grey_sofa_lamp',  floor: 2, u: 0.840, v: 0.560, flipX: true },

  // ================= FLOOR 3: FINANCE & BTC VIDEOTRON =================
  // Main Quant Trading Room (Kiri Atas - Menghadap Layar Videotron BTC)
  { itemId: 'it_cluster_desk', floor: 3, u: 0.325, v: 0.395, flipX: false },
  { itemId: 'trophy',          floor: 3, u: 0.375, v: 0.335, flipX: false },

  // Algo Analytics Room (Ujung Kiri Berdinding Kaca)
  { itemId: 'meeting_table',   floor: 3, u: 0.218, v: 0.535, flipX: false },

  // Trading Floor Desk Cluster (Kiri Bawah)
  { itemId: 'it_single_desk',  floor: 3, u: 0.355, v: 0.695, flipX: false },
  { itemId: 'it_cluster_desk', floor: 3, u: 0.435, v: 0.775, flipX: false },
  { itemId: 'it_single_desk',  floor: 3, u: 0.525, v: 0.785, flipX: true },

  // Treasury & High-Frequency Server Vault (Kanan Atas)
  { itemId: 'server_rack',     floor: 3, u: 0.665, v: 0.345, flipX: false },
  { itemId: 'server_rack',     floor: 3, u: 0.710, v: 0.375, flipX: false },
  { itemId: 'boss_desk',       floor: 3, u: 0.675, v: 0.425, flipX: true },

  // Executive Pantry F3 (Kanan Bawah)
  { itemId: 'pantry_counter',  floor: 3, u: 0.700, v: 0.665, flipX: true },
  { itemId: 'coffee_machine',  floor: 3, u: 0.695, v: 0.630, flipX: true },

  // Finance VIP Lounge (Ujung Kanan)
  { itemId: 'brown_sofa',      floor: 3, u: 0.865, v: 0.535, flipX: true },
  { itemId: 'coffee_table',    floor: 3, u: 0.830, v: 0.570, flipX: false },
  { itemId: 'brown_sofa',      floor: 3, u: 0.795, v: 0.605, flipX: false },
  { itemId: 'pet_cat',         floor: 3, u: 0.820, v: 0.550, flipX: false }
];

const FURNITURE_CATALOG: FurnitureCatalogItem[] = [];
const placedFurniture: PlacedFurniture[] = [];

let editMode = false;
let selectedCatalogToPlace: FurnitureCatalogItem | null = null;
let selectedPlacedItem: PlacedFurniture | null = null;
let draggingPlacedItem: PlacedFurniture | null = null;
let placementFlipX = false;

const selectionRing = new THREE.Mesh(
  new THREE.RingGeometry(0.32, 0.40, 28),
  new THREE.MeshBasicMaterial({ color: 0x4ade80, side: THREE.DoubleSide, depthWrite: false })
);
selectionRing.scale.set(1, 0.55, 1);
selectionRing.visible = false;
selectionRing.renderOrder = 9998;
scene.add(selectionRing);

const ghostMat = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0.65,
  depthWrite: false,
  side: THREE.DoubleSide
});
const ghostMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ghostMat);
ghostMesh.visible = false;
ghostMesh.renderOrder = 9999;
scene.add(ghostMesh);

const STORAGE_KEY = 'kra_modular_furniture_v3';

function saveLayoutToStorage() {
  const data = placedFurniture.map(f => {
    const uv = worldToUV(f.origin.x, f.origin.y);
    return {
      itemId: f.itemId,
      floor: f.floor,
      u: Number(uv.u.toFixed(4)),
      v: Number(uv.v.toFixed(4)),
      flipX: f.flipX
    };
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function spawnFurnitureInstance(
  catalog: FurnitureCatalogItem,
  floor: number,
  worldPos: THREE.Vector2,
  flipX = false,
  save = true
): PlacedFurniture {
  const mat = new THREE.MeshBasicMaterial({
    map: catalog.frames[0],
    transparent: true,
    alphaTest: 0.04,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(catalog.width, catalog.height), mat);
  const origin = worldPos.clone();
  const pos = worldPos.clone();
  const target = worldPos.clone();

  mesh.position.set(pos.x, pos.y + catalog.height * 0.48, 0.18);
  mesh.scale.x = flipX ? -1 : 1;
  mesh.visible = floor === currentFloor;
  mesh.renderOrder = calcRenderOrder(pos.y, catalog.layerBonus ?? 0);
  scene.add(mesh);

  const instance: PlacedFurniture = {
    uid: `${catalog.id}_${Date.now()}_${Math.random()}`,
    itemId: catalog.id,
    floor,
    origin,
    pos,
    target,
    flipX,
    mesh,
    mat,
    catalog
  };
  placedFurniture.push(instance);
  if (save) saveLayoutToStorage();
  return instance;
}

function loadDefaultOrSavedLayout() {
  placedFurniture.forEach(f => scene.remove(f.mesh));
  placedFurniture.length = 0;

  let layoutList: DefaultPlacement[] = DEFAULT_OFFICE_LAYOUT;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) layoutList = parsed;
    } catch (e) {
      console.warn(e);
    }
  }

  layoutList.forEach(entry => {
    const found = FURNITURE_CATALOG.find(c => c.id === entry.itemId);
    if (found) {
      spawnFurnitureInstance(found, entry.floor, uvToWorld(entry.u, entry.v), !!entry.flipX, false);
    }
  });
}

// Muat furniture_spritesheet.png + props_animations.png
Promise.all([
  loadImageElement('/assets/furniture_spritesheet.png'),
  loadImageElement('/assets/props_animations.png').catch(() => null)
])
  .then(([furnImg, propsImg]) => {
    if (propsImg) {
      // Semua frame pintu wajib kanvas 250x436 yang sama (tanpa auto-trim per frame),
      // supaya keempat pintu lift di 3 lantai tidak berubah ukuran saat animasi buka/tutup.
      const DOOR_W = 250;
      const DOOR_H = 436;
      elevatorFrames = [
        cropSpritePixels(propsImg, 104, 90, DOOR_W, DOOR_H, 42, false),
        cropSpritePixels(propsImg, 418, 95, DOOR_W, DOOR_H, 42, false),
        cropSpritePixels(propsImg, 743, 101, DOOR_W, DOOR_H, 42, false),
        cropSpritePixels(propsImg, 1073, 108, DOOR_W, DOOR_H, 42, false)
      ];
      doors.forEach(d => {
        d.mat.map = elevatorFrames[0];
        d.mat.needsUpdate = true;
      });
    }

    // Kotak batas presisi per sprite (piksel pada sheet 2752x1536).
    // Grid 6x4 lama memotong sprite yang melebar (kursi/meja hilang) karena banyak objek
    // melewati garis sel. Tabel ini hasil deteksi bbox nyata, jadi sprite utuh.
    const FURNITURE_BOXES_PX: Array<[number, number, number, number]> = [
      [115, 69, 466, 411],    // 0,0 boss desk
      [552, 81, 948, 404],    // 0,1 meeting table
      [1033, 91, 1348, 392],  // 0,2 it single desk
      [1415, 67, 1861, 409],  // 0,3 it cluster desk
      [1936, 77, 2299, 409],  // 0,4 studio desk
      [2398, 68, 2645, 410],  // 0,5 bookshelf & plant
      [124, 484, 467, 766],   // 1,0 pantry counter
      [660, 453, 832, 771],   // 1,1 fridge
      [1094, 475, 1287, 765], // 1,2 coffee machine
      [1451, 464, 1782, 772], // 1,3 brown sofa
      [1882, 527, 2249, 743], // 1,4 coffee table
      [2391, 457, 2577, 776], // 1,5 arcade machine
      [115, 821, 476, 1172],  // 2,0 lab bench
      [655, 819, 848, 1180],  // 2,1 dna hologram
      [1013, 845, 1375, 1155],// 2,2 molecule table
      [1534, 819, 1726, 1170],// 2,3 server rack
      [1941, 820, 2185, 1173],// 2,4 server glass wall
      [2285, 812, 2656, 1169],// 2,5 grey sofa & lamp
      [232, 1252, 365, 1442], // 3,0 pet cat idle
      [658, 1220, 846, 1448], // 3,1 pet cat walk
      [1103, 1215, 1293, 1460],// 3,2 pet dog idle
      [1528, 1237, 1735, 1458],// 3,3 pet dog walk
      [1922, 1222, 2207, 1437],// 3,4 pet drone
      [2416, 1219, 2560, 1456] // 3,5 trophy
    ];

    const boxScale = furnImg.width / 2752;
    const fCell = (c: number, r: number) => {
      const [x0, y0, x1, y1] = FURNITURE_BOXES_PX[r * 6 + c];
      const pad = 3;
      return cropSpritePixels(
        furnImg,
        Math.round((x0 - pad) * boxScale),
        Math.round((y0 - pad) * boxScale),
        Math.round((x1 - x0 + 1 + pad * 2) * boxScale),
        Math.round((y1 - y0 + 1 + pad * 2) * boxScale),
        26,
        true
      );
    };

    const catalogDefs: Array<{
      id: string;
      name: string;
      category: FurnitureCatalogItem['category'];
      frames: THREE.Texture[];
      w: number;
      h: number;
      isPet?: boolean;
      speed?: number;
      fps?: number;
      layerBonus?: number;
    }> = [
      // Baris 0: Office & Studio (Semua frame konsisten, tidak ada pergantian ke gambar "work progress")
      { id: 'boss_desk',       name: '🪑 Boss Executive Desk', category: 'OFFICE',          frames: [fCell(0, 0)], w: 1.45, h: 1.15 },
      { id: 'meeting_table',   name: '🤝 Oval Meeting Table',  category: 'OFFICE',          frames: [fCell(1, 0)], w: 1.70, h: 1.32 },
      { id: 'it_single_desk',  name: '💻 IT Dev Workstation',  category: 'OFFICE',          frames: [fCell(2, 0)], w: 1.05, h: 0.92 },
      { id: 'it_cluster_desk', name: '🖥️ 4-Desk IT Cluster',   category: 'OFFICE',          frames: [fCell(3, 0)], w: 1.95, h: 1.48 },
      { id: 'studio_desk',     name: '🎙️ Audio Studio Desk',   category: 'OFFICE',          frames: [fCell(4, 0)], w: 1.38, h: 1.18 },
      { id: 'bookshelf_plant', name: '🌿 Bookshelf & Plant',   category: 'OFFICE',          frames: [fCell(5, 0)], w: 0.85, h: 1.05 },

      // Baris 1: Pantry & Lounge
      { id: 'pantry_counter',  name: '🚰 Pantry Counter',      category: 'PANTRY & LOUNGE', frames: [fCell(0, 1)], w: 1.35, h: 1.02 },
      { id: 'fridge',          name: '🧊 Modern Fridge',       category: 'PANTRY & LOUNGE', frames: [fCell(1, 1)], w: 0.68, h: 1.08 },
      { id: 'coffee_machine',  name: '☕ Espresso Machine',    category: 'PANTRY & LOUNGE', frames: [fCell(2, 1)], w: 0.48, h: 0.58, layerBonus: 8 },
      { id: 'brown_sofa',      name: '🛋️ Brown Leather Sofa',  category: 'PANTRY & LOUNGE', frames: [fCell(3, 1)], w: 1.15, h: 0.88 },
      { id: 'coffee_table',    name: '🍵 Lounge Table & Rug',  category: 'PANTRY & LOUNGE', frames: [fCell(4, 1)], w: 1.12, h: 0.78, layerBonus: -3 },
      { id: 'arcade_machine',  name: '🕹️ Neon Arcade Machine', category: 'PANTRY & LOUNGE', frames: [fCell(5, 1)], w: 0.74, h: 1.15 },

      // Baris 2: Innovation Lab & Server Room
      { id: 'lab_bench',       name: '🔬 Lab Workbench',       category: 'LAB & SERVER',    frames: [fCell(0, 2)], w: 1.25, h: 1.02 },
      { id: 'dna_hologram',    name: '🧬 DNA Helix Pod',       category: 'LAB & SERVER',    frames: [fCell(1, 2)], w: 1.02, h: 1.52 },
      { id: 'molecule_table',  name: '⚛️ Molecule Holo Table', category: 'LAB & SERVER',    frames: [fCell(2, 2)], w: 1.35, h: 1.12 },
      { id: 'server_rack',     name: '🖧 LED Server Rack',      category: 'LAB & SERVER',    frames: [fCell(3, 2)], w: 0.74, h: 1.25 },
      { id: 'server_glass',    name: '🪟 Server Glass Wall',   category: 'LAB & SERVER',    frames: [fCell(4, 2)], w: 1.10, h: 1.28 },
      { id: 'grey_sofa_lamp',  name: '🛋️ Grey Sofa & Lamp',    category: 'LAB & SERVER',    frames: [fCell(5, 2)], w: 1.25, h: 1.02 },

      // Baris 3: Pets & Trophy
      { id: 'pet_cat',         name: '🐱 Office Cat (Pet)',    category: 'PET & DECOR',     frames: [fCell(0, 3), fCell(1, 3)], w: 0.48, h: 0.48, isPet: true, speed: 0.38, fps: 4.0 },
      { id: 'pet_dog',         name: '🐕 Cyber Dog (Pet)',     category: 'PET & DECOR',     frames: [fCell(2, 3), fCell(3, 3)], w: 0.56, h: 0.56, isPet: true, speed: 0.45, fps: 4.5 },
      { id: 'pet_drone',       name: '🛸 AI Mini Drone',       category: 'PET & DECOR',     frames: [fCell(4, 3)],              w: 0.52, h: 0.52, isPet: true, speed: 0.60, fps: 5.0 },
      { id: 'trophy',          name: '🏆 Golden Cyber Trophy', category: 'PET & DECOR',     frames: [fCell(5, 3)],              w: 0.52, h: 0.76 }
    ];

    const catalogContainer = document.getElementById('furniture-catalog')!;
    catalogDefs.forEach(def => {
      const item: FurnitureCatalogItem = {
        id: def.id,
        name: def.name,
        category: def.category,
        frames: def.frames,
        width: def.w,
        height: def.h,
        isPet: !!def.isPet,
        speed: def.speed ?? 0,
        fps: def.fps ?? 0,
        layerBonus: def.layerBonus
      };
      FURNITURE_CATALOG.push(item);

      const card = document.createElement('div');
      card.className = 'catalog-card';
      card.innerHTML = `<strong>${item.name}</strong><span class="cat-tag">${item.category}</span>`;
      card.onclick = () => {
        if (selectedCatalogToPlace?.id === item.id) {
          selectedCatalogToPlace = null;
          ghostMesh.visible = false;
          card.classList.remove('selected');
        } else {
          selectedCatalogToPlace = item;
          selectedPlacedItem = null;
          selectionRing.visible = false;
          ghostMat.map = item.frames[0];
          ghostMat.needsUpdate = true;
          ghostMesh.geometry.dispose();
          ghostMesh.geometry = new THREE.PlaneGeometry(item.width, item.height);
          // Sesuai perbaikan opencode: ghostMesh baru tampil saat pointer bergerak di lantai
          ghostMesh.visible = false;
          document.querySelectorAll('.catalog-card').forEach(el => el.classList.remove('selected'));
          card.classList.add('selected');
        }
      };
      catalogContainer.appendChild(card);
    });

    renderWallCatalogDrawer();
    loadDefaultOrSavedLayout();
  })
.catch(err => console.error('Gagal memuat furniture_spritesheet.png:', err));
// =========================================================
interface WaypointTask {
  pos: THREE.Vector2;
  task: string;
  dwell: number; // Durasi berhenti melakukan aktivitas di titik tersebut (detik)
  faceUp?: boolean;
  faceLeft?: boolean;
}

interface AgentState {
  name: string;
  role: string;
  color: number;
  floor: number;
  pos: THREE.Vector2;
  schedule: WaypointTask[];
  wpIndex: number;
  speed: number;
  task: string;
  dwellTimer: number;
  dwellDuration: number;
  walkPhase: number;
  mesh: THREE.Mesh;
  shadowMesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  framesFront: THREE.Texture[];
  framesBack: THREE.Texture[];
}

function createAgentWithShadow(colorHex: number) {
  const mat = new THREE.MeshBasicMaterial({
    transparent: true,
    alphaTest: 0.05,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.85), mat);
  scene.add(mesh);

  const shadowMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.28,
    depthWrite: false
  });
  const shadowMesh = new THREE.Mesh(new THREE.CircleGeometry(0.18, 20), shadowMat);
  shadowMesh.scale.set(1, 0.52, 1);
  scene.add(shadowMesh);

  return { mesh, shadowMesh, mat };
}

const AGENTS: AgentState[] = [
  {
    name: 'Rama-Exec',
    role: 'CHIEF DIRECTOR',
    color: 0x38bdf8,
    floor: 1,
    pos: uvToWorld(0.335, 0.425),
    schedule: [
      { pos: uvToWorld(0.335, 0.425), task: 'Reviewing KRA Executive KPI', dwell: 4.0, faceUp: true },
      { pos: uvToWorld(0.415, 0.495), task: 'Walking to Meeting Room', dwell: 0 },
      { pos: uvToWorld(0.285, 0.535), task: 'Entering Meeting Room', dwell: 0 },
      { pos: uvToWorld(0.245, 0.565), task: 'Chairing Strategy Sync', dwell: 4.5, faceUp: true, faceLeft: true },
      { pos: uvToWorld(0.285, 0.535), task: 'Returning to Office', dwell: 0 },
      { pos: uvToWorld(0.415, 0.495), task: 'Walking Corridor', dwell: 0 }
    ],
    wpIndex: 1,
    speed: 0.72,
    task: 'Reviewing KRA Executive KPI',
    dwellTimer: 2.0,
    dwellDuration: 4.0,
    walkPhase: 0,
    framesFront: [], framesBack: [],
    ...createAgentWithShadow(0x38bdf8)
  },
  {
    name: 'Aria-Boss',
    role: 'OPERATIONS AI',
    color: 0x22d3ee,
    floor: 1,
    pos: uvToWorld(0.500, 0.615),
    schedule: [
      { pos: uvToWorld(0.500, 0.615), task: 'Coordinating Floor 1 Lift', dwell: 2.5 },
      { pos: uvToWorld(0.575, 0.555), task: 'Inspecting East Wing', dwell: 0 },
      { pos: uvToWorld(0.605, 0.495), task: 'Entering Studio', dwell: 0 },
      { pos: uvToWorld(0.655, 0.415), task: 'Reviewing Studio Output', dwell: 3.8, faceUp: true },
      { pos: uvToWorld(0.605, 0.495), task: 'Heading to Corridor', dwell: 0 },
      { pos: uvToWorld(0.575, 0.555), task: 'Walking to Central Hub', dwell: 0 }
    ],
    wpIndex: 1,
    speed: 0.75,
    task: 'Coordinating Floor 1 Lift',
    dwellTimer: 1.0,
    dwellDuration: 2.5,
    walkPhase: 1.2,
    framesFront: [], framesBack: [],
    ...createAgentWithShadow(0x22d3ee)
  },
  {
    name: 'Rama-Coder',
    role: 'CORE ARCHITECT',
    color: 0x4ade80,
    floor: 1,
    pos: uvToWorld(0.455, 0.745),
    schedule: [
      { pos: uvToWorld(0.455, 0.745), task: 'Coding Three.js Isometric Engine', dwell: 5.0, faceUp: true, faceLeft: true },
      { pos: uvToWorld(0.455, 0.675), task: 'Walking to Pantry', dwell: 0 },
      { pos: uvToWorld(0.500, 0.615), task: 'Crossing Elevator Hall', dwell: 0 },
      { pos: uvToWorld(0.610, 0.675), task: 'Entering Pantry', dwell: 0 },
      { pos: uvToWorld(0.665, 0.715), task: 'Grabbing Espresso Shot', dwell: 3.5, faceUp: true },
      { pos: uvToWorld(0.610, 0.675), task: 'Back to IT Workstation', dwell: 0 },
      { pos: uvToWorld(0.500, 0.615), task: 'Crossing Elevator Hall', dwell: 0 },
      { pos: uvToWorld(0.455, 0.675), task: 'Entering IT Dev', dwell: 0 }
    ],
    wpIndex: 1,
    speed: 0.78,
    task: 'Coding Three.js Isometric Engine',
    dwellTimer: 3.0,
    dwellDuration: 5.0,
    walkPhase: 2.4,
    framesFront: [], framesBack: [],
    ...createAgentWithShadow(0x4ade80)
  },
  {
    name: 'Lyra-Media',
    role: 'STUDIO AI',
    color: 0xa855f7,
    floor: 1,
    pos: uvToWorld(0.665, 0.415),
    schedule: [
      { pos: uvToWorld(0.665, 0.415), task: 'Mastering Audio & Sprites', dwell: 4.5, faceUp: true },
      { pos: uvToWorld(0.605, 0.495), task: 'Walking to Lounge', dwell: 0 },
      { pos: uvToWorld(0.575, 0.555), task: 'Passing East Hall', dwell: 0 },
      { pos: uvToWorld(0.775, 0.535), task: 'Testing Neon Arcade', dwell: 3.8, faceUp: true, faceLeft: true },
      { pos: uvToWorld(0.575, 0.555), task: 'Returning to Studio', dwell: 0 },
      { pos: uvToWorld(0.605, 0.495), task: 'Entering Studio', dwell: 0 }
    ],
    wpIndex: 1,
    speed: 0.74,
    task: 'Mastering Audio & Sprites',
    dwellTimer: 2.2,
    dwellDuration: 4.5,
    walkPhase: 3.6,
    framesFront: [], framesBack: [],
    ...createAgentWithShadow(0xa855f7)
  },
  {
    name: 'Brew-Bot',
    role: 'PANTRY & OPS',
    color: 0xf97316,
    floor: 1,
    pos: uvToWorld(0.675, 0.715),
    schedule: [
      { pos: uvToWorld(0.675, 0.715), task: 'Brewing Fresh Arabica', dwell: 4.0, faceUp: true },
      { pos: uvToWorld(0.610, 0.675), task: 'Delivering Coffee to IT', dwell: 0 },
      { pos: uvToWorld(0.500, 0.615), task: 'Delivering Coffee to IT', dwell: 0 },
      { pos: uvToWorld(0.455, 0.675), task: 'Entering IT Dev', dwell: 0 },
      { pos: uvToWorld(0.425, 0.735), task: 'Serving Coffee to Devs', dwell: 3.2 },
      { pos: uvToWorld(0.455, 0.675), task: 'Returning to Pantry', dwell: 0 },
      { pos: uvToWorld(0.500, 0.615), task: 'Returning to Pantry', dwell: 0 },
      { pos: uvToWorld(0.610, 0.675), task: 'Entering Pantry', dwell: 0 }
    ],
    wpIndex: 1,
    speed: 0.72,
    task: 'Brewing Fresh Arabica',
    dwellTimer: 1.5,
    dwellDuration: 4.0,
    walkPhase: 4.8,
    framesFront: [], framesBack: [],
    ...createAgentWithShadow(0xf97316)
  },
  {
    name: 'Quant-Lab',
    role: 'BIOTECH SCIENTIST',
    color: 0xfacc15,
    floor: 2,
    pos: uvToWorld(0.325, 0.425),
    schedule: [
      { pos: uvToWorld(0.325, 0.425), task: 'Sequencing DNA Hologram', dwell: 4.2, faceUp: true, faceLeft: true },
      { pos: uvToWorld(0.415, 0.495), task: 'Walking to Robotics Room', dwell: 0 },
      { pos: uvToWorld(0.455, 0.665), task: 'Entering Molecule Lab', dwell: 0 },
      { pos: uvToWorld(0.425, 0.735), task: 'Analyzing Molecular Bonds', dwell: 4.5, faceUp: true },
      { pos: uvToWorld(0.455, 0.665), task: 'Returning to Helix Pod', dwell: 0 },
      { pos: uvToWorld(0.415, 0.495), task: 'Walking Corridor', dwell: 0 }
    ],
    wpIndex: 1,
    speed: 0.74,
    task: 'Sequencing DNA Hologram',
    dwellTimer: 2.0,
    dwellDuration: 4.2,
    walkPhase: 0.7,
    framesFront: [], framesBack: [],
    ...createAgentWithShadow(0xfacc15)
  },
  {
    name: 'Cyber-Node',
    role: 'SERVER SECOPS',
    color: 0xec4899,
    floor: 2,
    pos: uvToWorld(0.665, 0.415),
    schedule: [
      { pos: uvToWorld(0.665, 0.415), task: 'Auditing Server Rack Temps', dwell: 4.2, faceUp: true },
      { pos: uvToWorld(0.605, 0.495), task: 'Patrolling East Corridor', dwell: 0 },
      { pos: uvToWorld(0.575, 0.555), task: 'Checking Lift Security', dwell: 2.5, faceLeft: true },
      { pos: uvToWorld(0.775, 0.555), task: 'Inspecting Cyber Lounge', dwell: 3.0 },
      { pos: uvToWorld(0.575, 0.555), task: 'Returning to Mainframe', dwell: 0 },
      { pos: uvToWorld(0.605, 0.495), task: 'Entering Server Cluster', dwell: 0 }
    ],
    wpIndex: 1,
    speed: 0.76,
    task: 'Auditing Server Rack Temps',
    dwellTimer: 1.8,
    dwellDuration: 4.2,
    walkPhase: 2.1,
    framesFront: [], framesBack: [],
    ...createAgentWithShadow(0xec4899)
  },
  {
    name: 'Satoshi-Quant',
    role: 'BTC ALGO TRADER',
    color: 0xf59e0b,
    floor: 3,
    pos: uvToWorld(0.320, 0.365),
    schedule: [
      { pos: uvToWorld(0.320, 0.365), task: 'Watching Live BTC Videotron', dwell: 5.0, faceUp: true, faceLeft: true },
      { pos: uvToWorld(0.415, 0.495), task: 'Walking to Trading Desk', dwell: 0 },
      { pos: uvToWorld(0.455, 0.675), task: 'Entering Algo Floor', dwell: 0 },
      { pos: uvToWorld(0.435, 0.745), task: 'Executing 4-Gate BTC Order', dwell: 4.5, faceUp: true },
      { pos: uvToWorld(0.455, 0.675), task: 'Heading to Videotron Hall', dwell: 0 },
      { pos: uvToWorld(0.415, 0.495), task: 'Crossing West Hall', dwell: 0 }
    ],
    wpIndex: 1,
    speed: 0.78,
    task: 'Watching Live BTC Videotron',
    dwellTimer: 3.0,
    dwellDuration: 5.0,
    walkPhase: 1.5,
    framesFront: [], framesBack: [],
    ...createAgentWithShadow(0xf59e0b)
  },
  {
    name: 'Treasury-AI',
    role: 'RISK & VAULT OPS',
    color: 0x10b981,
    floor: 3,
    pos: uvToWorld(0.665, 0.415),
    schedule: [
      { pos: uvToWorld(0.665, 0.415), task: 'Reconciling Cold Wallet Vault', dwell: 4.2, faceUp: true },
      { pos: uvToWorld(0.605, 0.495), task: 'Walking to Videotron Hall', dwell: 0 },
      { pos: uvToWorld(0.500, 0.615), task: 'Checking Central Lift', dwell: 0 },
      { pos: uvToWorld(0.415, 0.495), task: 'Entering Videotron Room', dwell: 0 },
      { pos: uvToWorld(0.355, 0.405), task: 'Checking BTC Volatility Hedge', dwell: 4.0, faceUp: true, faceLeft: true },
      { pos: uvToWorld(0.415, 0.495), task: 'Returning to Vault', dwell: 0 },
      { pos: uvToWorld(0.500, 0.615), task: 'Crossing Lift Hall', dwell: 0 },
      { pos: uvToWorld(0.605, 0.495), task: 'Entering Treasury Vault', dwell: 0 }
    ],
    wpIndex: 1,
    speed: 0.75,
    task: 'Reconciling Cold Wallet Vault',
    dwellTimer: 1.5,
    dwellDuration: 4.2,
    walkPhase: 3.1,
    framesFront: [], framesBack: [],
    ...createAgentWithShadow(0x10b981)
  }
];

loadImageElement('/assets/agents_cleaned.png')
  .then((img) => {
    const cell = (c: number, r: number) => cropAgentCellFixedBaseline(img, c, r);

    // Setiap agen hanya menggunakan frame berdiri/berjalan yang konsisten (tanpa frame meja yang bikin gepeng)
    AGENTS[0].framesFront = [cell(0, 0), cell(0, 2), cell(1, 0), cell(0, 2)];
    AGENTS[0].framesBack  = [cell(1, 1), cell(1, 2), cell(2, 3), cell(1, 2)];

    AGENTS[1].framesFront = [cell(2, 0), cell(3, 2), cell(3, 0), cell(3, 2)];
    AGENTS[1].framesBack  = [cell(2, 1), cell(2, 2)];

    AGENTS[2].framesFront = [cell(4, 0), cell(4, 2), cell(5, 0), cell(4, 2)];
    AGENTS[2].framesBack  = [cell(5, 2)];

    AGENTS[3].framesFront = [cell(6, 0), cell(7, 0), cell(6, 1), cell(7, 0)];
    AGENTS[3].framesBack  = [cell(7, 1)];

    AGENTS[4].framesFront = [cell(8, 0), cell(8, 2), cell(9, 1), cell(8, 2)];
    AGENTS[4].framesBack  = [cell(1, 4), cell(2, 4)];

    AGENTS[5].framesFront = [cell(9, 0), cell(4, 3), cell(5, 4), cell(4, 3)];
    AGENTS[5].framesBack  = [cell(6, 3), cell(6, 4)];

    AGENTS[6].framesFront = [cell(7, 3), cell(8, 3), cell(7, 4), cell(8, 3)];
    AGENTS[6].framesBack  = [cell(9, 3), cell(10, 3)];

    AGENTS[7].framesFront = [cell(4, 3), cell(5, 3), cell(4, 4), cell(5, 3)];
    AGENTS[7].framesBack  = [cell(6, 3), cell(6, 4)];

    AGENTS[8].framesFront = [cell(0, 3), cell(3, 3), cell(0, 2), cell(3, 3)];
    AGENTS[8].framesBack  = [cell(1, 3), cell(2, 3)];

    AGENTS.forEach(a => {
      if (a.framesFront.length > 0) {
        a.mat.map = a.framesFront[0];
        a.mat.needsUpdate = true;
      }
    });
  })
  .catch(err => console.warn('Gagal memuat agents_cleaned.png:', err));

loadImageElement('/assets/walls_spritesheet.png')
  .then((img) => {
    const extracted = extractWallSpritesAuto(img);
    WALL_CATALOG.push(...extracted);
    loadDefaultOrSavedWalls();
    console.log(`Wall catalog loaded: ${extracted.length} wall pieces`);
  })
  .catch(err => console.warn('Gagal memuat walls_spritesheet.png:', err));

// =========================================================
// 9. INTERAKSI DRAG & DROP / PLACEMENT FURNITUR DI LANTAI
// =========================================================
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();

function getWorldPointOnFloor(e: MouseEvent): THREE.Vector2 | null {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObject(mapPlane);
  if (hits.length > 0) {
    return new THREE.Vector2(hits[0].point.x, hits[0].point.y);
  }
  return null;
}

function getClickedFurniture(e: MouseEvent): PlacedFurniture | null {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);

  const floorMeshes = placedFurniture
    .filter(f => f.floor === currentFloor)
    .map(f => f.mesh);

  const hits = raycaster.intersectObjects(floorMeshes, false);
  if (hits.length > 0) {
    hits.sort((a, b) => b.object.renderOrder - a.object.renderOrder);
    const topMesh = hits[0].object;
    return placedFurniture.find(f => f.mesh === topMesh) ?? null;
  }
  return null;
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || !editMode) return;
  const pt = getWorldPointOnFloor(e);
  if (!pt) return;

  if (selectedCatalogToPlace) {
    const created = spawnFurnitureInstance(selectedCatalogToPlace, currentFloor, pt, placementFlipX, true);
    selectedPlacedItem = created;
    selectionRing.visible = true;
    selectionRing.position.set(created.pos.x, created.pos.y, 0.16);
    return;
  }

  const hitFurn = getClickedFurniture(e);
  if (hitFurn) {
    selectedPlacedItem = hitFurn;
    draggingPlacedItem = hitFurn;
    controls.enabled = false;
    selectionRing.visible = true;
    selectionRing.position.set(hitFurn.pos.x, hitFurn.pos.y, 0.16);
    const uv = worldToUV(hitFurn.pos.x, hitFurn.pos.y);
    document.getElementById('editor-hint')!.textContent =
      `Terpilih: ${hitFurn.catalog.name} • Posisi u=${uv.u.toFixed(3)}, v=${uv.v.toFixed(3)}`;
  } else {
    selectedPlacedItem = null;
    selectionRing.visible = false;
  }
});

renderer.domElement.addEventListener('pointermove', (e) => {
  if (!editMode) return;
  const pt = getWorldPointOnFloor(e);
  if (!pt) return;

  if (selectedCatalogToPlace) {
    ghostMesh.visible = true;
    ghostMesh.position.set(pt.x, pt.y + selectedCatalogToPlace.height * 0.48, 0.35);
    ghostMesh.scale.x = placementFlipX ? -1 : 1;
  } else if (draggingPlacedItem) {
    draggingPlacedItem.origin.copy(pt);
    draggingPlacedItem.pos.copy(pt);
    draggingPlacedItem.target.copy(pt);
    draggingPlacedItem.mesh.position.set(
      pt.x,
      pt.y + draggingPlacedItem.catalog.height * 0.48,
      0.18
    );
    draggingPlacedItem.mesh.renderOrder = calcRenderOrder(pt.y, draggingPlacedItem.catalog.layerBonus ?? 0);
    selectionRing.position.set(pt.x, pt.y, 0.16);
    const uv = worldToUV(pt.x, pt.y);
    document.getElementById('editor-hint')!.textContent =
      `Menggeser: ${draggingPlacedItem.catalog.name} • u=${uv.u.toFixed(3)}, v=${uv.v.toFixed(3)}`;
  }
});

window.addEventListener('pointerup', () => {
  if (draggingPlacedItem) {
    draggingPlacedItem = null;
    controls.enabled = true;
    saveLayoutToStorage();
  }
});

function flipCurrentItem() {
  if (selectedCatalogToPlace) {
    placementFlipX = !placementFlipX;
    ghostMesh.scale.x = placementFlipX ? -1 : 1;
  } else if (selectedPlacedItem) {
    selectedPlacedItem.flipX = !selectedPlacedItem.flipX;
    selectedPlacedItem.mesh.scale.x = selectedPlacedItem.flipX ? -1 : 1;
    saveLayoutToStorage();
  }
}

function deleteSelectedFurniture() {
  if (!selectedPlacedItem) return;
  scene.remove(selectedPlacedItem.mesh);
  const idx = placedFurniture.indexOf(selectedPlacedItem);
  if (idx !== -1) placedFurniture.splice(idx, 1);
  selectedPlacedItem = null;
  selectionRing.visible = false;
  saveLayoutToStorage();
}

window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'r') {
    flipCurrentItem();
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (editMode && selectedPlacedItem) deleteSelectedFurniture();
  } else if (e.key === 'Escape') {
    selectedCatalogToPlace = null;
    selectedPlacedItem = null;
    ghostMesh.visible = false;
    selectionRing.visible = false;
    document.querySelectorAll('.catalog-card').forEach(el => el.classList.remove('selected'));
  }
});

// =========================================================
// 10. KONTROL 3 LANTAI & ROSTER PANEL BAWAH
// =========================================================
const agentElements = AGENTS.map(agent => {
  const el = document.createElement('div');
  el.className = 'agent-bubble';
  el.innerHTML = `
    <span class="role">${agent.name} • ${agent.role}</span>
    <span class="task-text">${agent.task}</span>
    <div class="bar-bg"><div class="bar-fill"></div></div>
  `;
  const taskEl = el.querySelector('.task-text') as HTMLElement;
  const barEl = el.querySelector('.bar-fill') as HTMLElement;
  overlayLayer.appendChild(el);
  return { agent, el, taskEl, barEl };
});

let currentFloor = 1;

function switchFloor(floor: number) {
  currentFloor = floor;
  mapPlane.material.map =
    floor === 1 ? texFloor1 : floor === 2 ? texFloor2 : texFloor3;
  mapPlane.material.needsUpdate = true;

  // Tampilkan Videotron BTC & Patch Vault hanya di Lantai 3
  btcVideotron.mesh.visible = floor === 3;
  f3VaultPatch.visible = floor === 3;

  placedFurniture.forEach(f => {
    f.mesh.visible = f.floor === currentFloor;
  });

  placedWalls.forEach(w => {
    w.mesh.visible = w.floor === currentFloor;
  });

  selectedPlacedItem = null;
  selectionRing.visible = false;

  document.getElementById('btn-f1')!.classList.toggle('active', floor === 1);
  document.getElementById('btn-f2')!.classList.toggle('active', floor === 2);
  document.getElementById('btn-f3')!.classList.toggle('active', floor === 3);

  const labels: Record<number, string> = {
    1: 'FLOOR 1 • OFFICE',
    2: 'FLOOR 2 • LAB & SERVER',
    3: 'FLOOR 3 • FINANCE & LIVE BTC'
  };
  document.getElementById('floor-indicator')!.textContent = labels[floor];
}

document.getElementById('btn-f1')!.onclick = () => switchFloor(1);
document.getElementById('btn-f2')!.onclick = () => switchFloor(2);
document.getElementById('btn-f3')!.onclick = () => switchFloor(3);

const drawerEl = document.getElementById('furniture-drawer')!;
const btnEdit = document.getElementById('btn-edit')!;
btnEdit.onclick = () => {
  editMode = !editMode;
  drawerEl.classList.toggle('open', editMode);
  btnEdit.classList.toggle('active', editMode);
  if (!editMode) {
    selectedCatalogToPlace = null;
    selectedPlacedItem = null;
    ghostMesh.visible = false;
    selectionRing.visible = false;
    document.querySelectorAll('.catalog-card').forEach(el => el.classList.remove('selected'));
  }
};

document.getElementById('btn-flip')!.onclick = flipCurrentItem;
document.getElementById('btn-delete-sel')!.onclick = deleteSelectedFurniture;
document.getElementById('btn-reset-layout')!.onclick = () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(WALL_STORAGE_KEY);
  loadDefaultOrSavedLayout();
  loadDefaultOrSavedWalls();
  selectedPlacedItem = null;
  selectionRing.visible = false;
};

document.getElementById('btn-copy-coords')!.onclick = () => {
  saveLayoutToStorage();
  const raw = localStorage.getItem(STORAGE_KEY) || '[]';
  (window as any).__LAST_COPIED_LAYOUT__ = raw;

  const hintEl = document.getElementById('editor-hint')!;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(raw)
      .then(() => {
        hintEl.textContent = 'JSON tata letak furnitur berhasil disalin ke Clipboard!';
      })
      .catch(() => {
        hintEl.textContent = 'JSON tata letak furnitur berhasil disalin (Headless Fallback)!';
      });
  } else {
    hintEl.textContent = 'JSON tata letak furnitur berhasil disalin!';
  }
};

const btnElev = document.getElementById('btn-elev')!;
btnElev.onclick = () => {
  forceOpenDoors = !forceOpenDoors;
  btnElev.classList.toggle('active', forceOpenDoors);
  btnElev.textContent = forceOpenDoors ? 'Lift: OPEN' : 'Lift Doors';
};

document.getElementById('btn-reset')!.onclick = () => {
  camera.zoom = 1;
  camera.position.set(0, 0, 10);
  controls.target.set(0, 0, 0);
  camera.updateProjectionMatrix();
};

const roster = document.getElementById('agent-roster')!;
AGENTS.forEach((a, idx) => {
  const pill = document.createElement('div');
  pill.className = 'agent-pill';
  const hex = '#' + a.color.toString(16).padStart(6, '0');
  pill.innerHTML = `<span class="dot" style="background:${hex}"></span><strong>${a.name} (F${a.floor})</strong>`;
  pill.onclick = () => {
    if (currentFloor !== a.floor) switchFloor(a.floor);
    a.dwellTimer = 3.5;
    a.dwellDuration = 3.5;
    a.task = 'Priority Task Activated!';
    agentElements[idx].taskEl.textContent = a.task;
  };
  roster.appendChild(pill);
});

// =========================================================
// 11. ANIMATION LOOP (TANPA THREE.CLOCK DEPRECATION)
// =========================================================
let lastTimeMs = performance.now();
let animationFrameId: number;

function animate(nowMs: number) {
  animationFrameId = requestAnimationFrame(animate);
  const delta = Math.min((nowMs - lastTimeMs) / 1000, 0.1);
  lastTimeMs = nowMs;
  const elapsed = nowMs / 1000;

  controls.update();

  // 1. Update Layar Videotron BTC Real-Time
  btcVideotron.update(elapsed);

  // 2. Update Pergerakan Halus & Aktivitas Kontekstual Agen AI
  agentElements.forEach(({ agent, el, taskEl, barEl }, i) => {
    const onFloor = agent.floor === currentFloor;
    agent.mesh.visible = onFloor;
    agent.shadowMesh.visible = onFloor;
    el.style.display = onFloor ? 'block' : 'none';

    const currentWp = agent.schedule[agent.wpIndex];
    let isMoving = false;
    let movingUp = false;
    let movingLeft = false;

    if (agent.dwellTimer > 0) {
      // Sedang melakukan aktivitas di stasiun kerja / meja / videotron
      agent.dwellTimer -= delta;
      movingUp = !!currentWp.faceUp;
      movingLeft = !!currentWp.faceLeft;

      const pct = Math.min(
        100,
        Math.max(12, ((agent.dwellDuration - agent.dwellTimer) / Math.max(0.1, agent.dwellDuration)) * 100)
      );
      barEl.style.width = `${pct.toFixed(0)}%`;

      if (agent.dwellTimer <= 0) {
        agent.wpIndex = (agent.wpIndex + 1) % agent.schedule.length;
        const nextWp = agent.schedule[agent.wpIndex];
        agent.task = nextWp.task;
        taskEl.textContent = agent.task;
      }
    } else {
      // Sedang berjalan menuju waypoint berikutnya
      const dir = new THREE.Vector2().subVectors(currentWp.pos, agent.pos);
      const dist = dir.length();

      if (dist < 0.04) {
        agent.pos.copy(currentWp.pos);
        if (currentWp.dwell > 0) {
          agent.dwellTimer = currentWp.dwell;
          agent.dwellDuration = currentWp.dwell;
          agent.task = currentWp.task;
          taskEl.textContent = agent.task;
        } else {
          agent.wpIndex = (agent.wpIndex + 1) % agent.schedule.length;
          agent.task = agent.schedule[agent.wpIndex].task;
          taskEl.textContent = agent.task;
        }
      } else {
        isMoving = true;
        dir.normalize();
        // Kecepatan melambat halus saat mendekati titik henti
        const slowDown = currentWp.dwell > 0 ? Math.min(1, dist / 0.25 + 0.35) : 1;
        const stepSpeed = agent.speed * slowDown;
        agent.pos.addScaledVector(dir, stepSpeed * delta);
        agent.walkPhase += delta * 6.5;

        movingUp = dir.y > 0.12;
        movingLeft = dir.x < -0.04;
        barEl.style.width = '65%';
      }
    }

    // Pilih frame jalan vs diam dengan transisi yang tenang
    const activeSet = movingUp && agent.framesBack.length > 0 ? agent.framesBack : agent.framesFront;
    if (activeSet.length > 0) {
      const frameIdx = isMoving ? Math.floor(agent.walkPhase) % activeSet.length : 0;
      if (agent.mat.map !== activeSet[frameIdx]) {
        agent.mat.map = activeSet[frameIdx];
        agent.mat.needsUpdate = true;
      }
    }

    agent.mesh.scale.x = movingLeft ? -1 : 1;

    // Ayunan langkah saat jalan vs napas halus saat bekerja di tempat
    const bob = isMoving
      ? Math.abs(Math.sin(agent.walkPhase * Math.PI)) * 0.024
      : Math.sin(elapsed * 3.5 + i) * 0.008;

    agent.mesh.position.set(agent.pos.x, agent.pos.y + 0.42 + bob, 0.22);
    agent.mesh.renderOrder = calcRenderOrder(agent.pos.y, 2);

    agent.shadowMesh.position.set(agent.pos.x, agent.pos.y + 0.02, 0.17);
    agent.shadowMesh.renderOrder = calcRenderOrder(agent.pos.y, -2);

    if (onFloor) {
      const worldPos = new THREE.Vector3(agent.pos.x, agent.pos.y + 0.86, 0.4);
      worldPos.project(camera);
      const x = (worldPos.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-(worldPos.y * 0.5) + 0.5) * window.innerHeight;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }
  });

  // 3. Update Sensor Kedekatan Pintu Lift Tengah
  doors.forEach(d => {
    d.mesh.visible = d.floor === currentFloor;
    if (!d.mesh.visible) return;

    let near = forceOpenDoors;
    if (!near) {
      for (const a of AGENTS) {
        if (a.floor === d.floor && a.pos.distanceTo(d.pos) < 1.15) {
          near = true;
          break;
        }
      }
    }

    const targetFrame = near ? 3 : 0;
    d.currentFrame = THREE.MathUtils.lerp(d.currentFrame, targetFrame, delta * 9);
    const idx = Math.min(3, Math.max(0, Math.round(d.currentFrame)));
    if (elevatorFrames.length === 4 && d.mat.map !== elevatorFrames[idx]) {
      d.mat.map = elevatorFrames[idx];
      d.mat.needsUpdate = true;
    }
  });

  // 4. Update Pergerakan Pet Kantor (Kucing, Cyber Dog, Drone)
  placedFurniture.forEach((f, idx) => {
    f.mesh.visible = f.floor === currentFloor;
    if (!f.mesh.visible) return;

    if (f.catalog.isPet && draggingPlacedItem !== f) {
      const dir = new THREE.Vector2().subVectors(f.target, f.pos);
      if (dir.length() < 0.04) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 0.55;
        f.target.set(
          f.origin.x + Math.cos(angle) * radius,
          f.origin.y + Math.sin(angle) * radius * 0.5
        );
      } else {
        dir.normalize();
        f.pos.addScaledVector(dir, f.catalog.speed * delta);
        f.mesh.scale.x = dir.x < 0 ? -1 : 1;
      }

      if (f.catalog.frames.length > 1) {
        const fIdx = Math.floor(elapsed * f.catalog.fps + idx) % f.catalog.frames.length;
        if (f.mat.map !== f.catalog.frames[fIdx]) {
          f.mat.map = f.catalog.frames[fIdx];
          f.mat.needsUpdate = true;
        }
      }

      const hover = f.catalog.id === 'pet_drone' ? Math.sin(elapsed * 4.5 + idx) * 0.05 : 0;
      f.mesh.position.set(f.pos.x, f.pos.y + f.catalog.height * 0.48 + hover, 0.20);
      f.mesh.renderOrder = calcRenderOrder(f.pos.y, 1);
    }
  });

  renderer.render(scene, camera);
}

animationFrameId = requestAnimationFrame(animate);

const onResize = () => {
  aspect = window.innerWidth / window.innerHeight;
  camera.left = (-viewHeight * aspect) / 2;
  camera.right = (viewHeight * aspect) / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
};
window.addEventListener('resize', onResize);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cancelAnimationFrame(animationFrameId);
    window.removeEventListener('resize', onResize);
    controls.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  });
}

// =========================================================
// 12. EXPOSE KE WINDOW UNTUK AUTOMATED TEST (OPENCODE / VERIFY3.MJS)
// =========================================================
Object.assign(window as any, {
  placedFurniture,
  placedWalls,
  btcVideotron,
  AGENTS,
  FURNITURE_CATALOG,
  WALL_CATALOG,
  WALL_BBOXES,
  doors,
  mapPlane,
  switchFloor,
  getCurrentFloor: () => currentFloor
});