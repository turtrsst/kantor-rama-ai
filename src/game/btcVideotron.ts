import * as THREE from 'three';
import { ISO_WORLD_SLOPE, isoDepthZ, uvToWorld } from '../data/floorNavGraph';
import { createSoftContactShadowTexture } from './spriteLoader';

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
}

/** Floor contact point of the standing Market Desk (1,0) terminal. */
const TERMINAL_FLOOR_UV = { u: 0.440, v: 0.380 } as const;
/** Screen centre height above the floor, in world units. */
const TERMINAL_SCREEN_LIFT = 0.80;
const TERMINAL_SCREEN_W = 1.05;
const TERMINAL_SCREEN_H = 0.54;
const TERMINAL_SLOPE = ISO_WORLD_SLOPE;

/** A plane whose horizontal edges follow one ~27-degree isometric floor axis. */
function isoPlaneGeometry(
  w: number,
  h: number,
  slope = TERMINAL_SLOPE
): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(w, h, 1, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, pos.getY(i) + pos.getX(i) * slope);
  }
  pos.needsUpdate = true;
  return geo;
}

function trapezoidGeometry(topW: number, bottomW: number, h: number): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-topW / 2, h / 2);
  shape.lineTo(topW / 2, h / 2);
  shape.lineTo(bottomW / 2, -h / 2);
  shape.lineTo(-bottomW / 2, -h / 2);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function makeGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 126);
  g.addColorStop(0, 'rgba(34, 211, 238, 0.55)');
  g.addColorStop(0.55, 'rgba(56, 189, 248, 0.22)');
  g.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

/** Decorative side monitor: grid + honest label only, never a fake quote. */
function makeHoloPanelTexture(label: string, accent: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 176;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#081526';
  ctx.fillRect(0, 0, 256, 176);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.strokeRect(3, 3, 250, 170);
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.18)';
  ctx.lineWidth = 1;
  for (let x = 20; x < 250; x += 32) {
    ctx.beginPath(); ctx.moveTo(x, 36); ctx.lineTo(x, 166); ctx.stroke();
  }
  for (let y = 50; y < 170; y += 28) {
    ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(248, y); ctx.stroke();
  }
  ctx.fillStyle = accent;
  ctx.font = 'bold 17px Consolas, monospace';
  ctx.fillText(label, 14, 26);
  ctx.fillStyle = 'rgba(203, 213, 225, 0.85)';
  ctx.font = '13px Consolas, monospace';
  ctx.fillText('READ-ONLY FEED', 14, 156);
  ctx.fillStyle = accent;
  for (let i = 0; i < 7; i++) {
    const h = 18 + ((i * 23) % 58);
    ctx.globalAlpha = 0.35 + (i % 3) * 0.15;
    ctx.fillRect(22 + i * 30, 150 - h, 16, h);
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function makeOutline(
  points: Array<readonly [number, number]>,
  color: number,
  opacity = 0.9
): THREE.LineLoop {
  const geo = new THREE.BufferGeometry().setFromPoints(
    points.map(([x, y]) => new THREE.Vector3(x, y, 0))
  );
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: true,
    depthWrite: false
  });
  return new THREE.LineLoop(geo, mat);
}

/**
 * Strict Real-Data-Only BTC/USDT Market Desk holo-terminal standing on the Floor 3
 * (1,0) room floor. This replaces the old flat NW wall banner: a podium, angled
 * isometric main chart, side holo-panels, emitter and a soft contact shadow make it
 * a real furniture gadget instead of a wall tempelan. Starts as BELUM DIAMBIL until
 * real Binance WS or /api/market/btc-live (Binance REST / Coinbase / CoinGecko)
 * data arrives — never displays fabricated numbers.
 */
export class BTCVideotronEngine {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public texture: THREE.CanvasTexture;
  public mesh: THREE.Mesh;
  public candles: CandleData[] = [];
  public lastPrice: number | null = null;
  public priceChangePct: number | null = null;
  public sourceLabel: string | null = null;
  public isLiveWS = false;

  private lastRedraw = 0;
  private lastRestFetchMs = 0;
  private restInFlight = false;
  private ws: WebSocket | null = null;
  private disposed = false;

  constructor(scene: THREE.Scene, contactShadowTex?: THREE.Texture) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = 512;
    this.ctx = this.canvas.getContext('2d')!;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = true;

    // Main candlestick screen: a sheared parallelogram reading as a ~45-degree
    // isometric monitor face. The chart canvas stays upright and readable.
    const geo = isoPlaneGeometry(TERMINAL_SCREEN_W, TERMINAL_SCREEN_H);
    const mat = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      alphaTest: 0.01,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.Mesh(geo, mat);
    const floorWorld = uvToWorld(TERMINAL_FLOOR_UV.u, TERMINAL_FLOOR_UV.v);
    const baseOrder = Math.round((5.0 - floorWorld.y) * 100);
    this.mesh.position.set(floorWorld.x, floorWorld.y + TERMINAL_SCREEN_LIFT, isoDepthZ(floorWorld.y + TERMINAL_SCREEN_LIFT, 6));
    // 372: above the NW wall cluster (<=365), below SANDI's desk (388) and agents (410).
    // Hiding this root mesh also hides every child in the standing rig.
    this.mesh.renderOrder = baseOrder + 50;
    this.mesh.visible = false;
    scene.add(this.mesh);

    this.buildStandingRig(contactShadowTex, baseOrder);

    this.connectBinanceStream();
    void this.hydrateFromRest();
    this.drawChart();
  }

  /** Builds the podium, column, holo glow, side monitors and contact shadow. */
  private buildStandingRig(contactShadowTex: THREE.Texture | undefined, baseOrder: number): void {
    const floorY = -TERMINAL_SCREEN_LIFT;
    const addMesh = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      order: number
    ): THREE.Mesh => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.renderOrder = order;
      this.mesh.add(m);
      return m;
    };
    const basic = (color: number, opacity = 1, side = THREE.DoubleSide) =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        depthTest: true,
        depthWrite: false,
        side
      });

    // 1. Ground contact shadow + cyan floor ring.
    const shadowTex = contactShadowTex ?? createSoftContactShadowTexture();
    if (contactShadowTex) shadowTex.userData.external = true; // owned by OfficeEngine
    addMesh(
      new THREE.PlaneGeometry(1.40, 0.46),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        opacity: 0.82,
        depthTest: true,
        depthWrite: false
      }),
      0, floorY + 0.01, 0.01, baseOrder - 8
    );
    const ring = addMesh(
      new THREE.RingGeometry(0.55, 0.61, 40),
      basic(0x22d3ee, 0.55),
      0, floorY + 0.02, 0.02, baseOrder - 7
    );
    ring.scale.set(1, 0.48, 1);

    // 2. Podium / kiosk stand, with an isometric top outline.
    addMesh(
      trapezoidGeometry(0.82, 1.00, 0.20),
      basic(0x0f172a),
      0, floorY + 0.10, 0.03, baseOrder - 4
    );
    addMesh(
      new THREE.PlaneGeometry(0.82, 0.12),
      basic(0x1e293b),
      0, floorY + 0.20, 0.035, baseOrder - 3
    );
    const tw = 0.41;
    const th = 0.06;
    const tsh = tw * TERMINAL_SLOPE;
    const topOutline = makeOutline(
      [
        [-tw, th - tsh], [tw, th + tsh],
        [tw, -th + tsh], [-tw, -th - tsh]
      ],
      0x22d3ee,
      0.8
    );
    topOutline.position.set(0, floorY + 0.20, 0.04);
    topOutline.renderOrder = baseOrder - 2;
    this.mesh.add(topOutline);
    addMesh(
      new THREE.PlaneGeometry(0.52, 0.030),
      basic(0x38bdf8, 0.7),
      0, floorY + 0.08, 0.045, baseOrder - 2
    );
    addMesh(
      new THREE.PlaneGeometry(0.075, 0.075),
      basic(0x4ade80, 0.9),
      -0.30, floorY + 0.08, 0.046, baseOrder - 1
    );

    // 3. Short support column and cyan spine behind the display.
    addMesh(
      isoPlaneGeometry(0.12, 0.16),
      basic(0x334155),
      0, floorY + 0.26, 0.05, baseOrder - 1
    );
    addMesh(
      new THREE.PlaneGeometry(0.024, 1.00),
      basic(0x22d3ee, 0.35),
      0, 0.02, 0.06, baseOrder + 1
    );

    // 4. Holo glow, bezel, bezel trim behind the live chart.
    addMesh(
      isoPlaneGeometry(TERMINAL_SCREEN_W + 0.40, TERMINAL_SCREEN_H + 0.44),
      new THREE.MeshBasicMaterial({
        map: makeGlowTexture(),
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide
      }),
      0, 0, 0.08, baseOrder + 46
    );
    addMesh(
      isoPlaneGeometry(TERMINAL_SCREEN_W + 0.09, TERMINAL_SCREEN_H + 0.09),
      basic(0x111c2e),
      0, 0, 0.10, baseOrder + 47
    );
    const hw = (TERMINAL_SCREEN_W + 0.10) / 2;
    const hh = (TERMINAL_SCREEN_H + 0.10) / 2;
    const sh = hw * TERMINAL_SLOPE;
    const bezelTrim = makeOutline(
      [
        [-hw, hh - sh], [hw, hh + sh],
        [hw, -hh + sh], [-hw, -hh - sh]
      ],
      0x38bdf8,
      0.85
    );
    bezelTrim.position.set(0, 0, 0.11);
    bezelTrim.renderOrder = baseOrder + 48;
    this.mesh.add(bezelTrim);

    // 5. Two smaller counter-tilted holo monitors: a real multi-monitor rig.
    for (const side of [-1, 1] as const) {
      const x = side * (TERMINAL_SCREEN_W / 2 + 0.25);
      const y = side * 0.04;
      addMesh(
        isoPlaneGeometry(0.46, 0.32, -TERMINAL_SLOPE),
        basic(0x0b1626),
        x, y, 0.11, baseOrder + 48
      );
      addMesh(
        isoPlaneGeometry(0.40, 0.26, -TERMINAL_SLOPE),
        new THREE.MeshBasicMaterial({
          map: makeHoloPanelTexture(side < 0 ? 'ORDER FLOW' : 'DEPTH / VOL', side < 0 ? '#38bdf8' : '#a78bfa'),
          transparent: true,
          alphaTest: 0.01,
          depthTest: true,
          depthWrite: false,
          side: THREE.DoubleSide
        }),
        x, y, 0.12, baseOrder + 49
      );
    }

    // 6. Small holographic emitter above the central display.
    const emitter = addMesh(
      new THREE.ConeGeometry(0.065, 0.17, 4),
      basic(0x67e8f9, 0.85),
      0, TERMINAL_SCREEN_H / 2 + 0.34, 0.14, baseOrder + 51
    );
    emitter.rotation.z = Math.PI / 4;
  }

  public async hydrateFromRest() {
    if (this.disposed || this.restInFlight) return;
    this.restInFlight = true;
    this.lastRestFetchMs = Date.now();
    try {
      const resp = await fetch('/api/market/btc-live');
      if (!resp.ok || this.disposed) return;
      const data = (await resp.json()) as {
        ok?: boolean;
        source?: string | null;
        price?: number | null;
        change24hPct?: number | null;
        candles?: CandleData[];
      };
      if (data.ok && Array.isArray(data.candles) && data.candles.length > 0 && typeof data.price === 'number') {
        this.ingestCandles(data.candles, data.price, data.change24hPct ?? null, data.source ?? 'REST Live');
      }
    } catch {
      // stay honest BELUM DIAMBIL
    } finally {
      this.restInFlight = false;
    }
  }

  private connectBinanceStream() {
    try {
      this.ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade');
      this.ws.onopen = () => {
        if (!this.disposed) this.isLiveWS = true;
      };
      this.ws.onmessage = (event) => {
        if (this.disposed) return;
        try {
          const msg = JSON.parse(event.data);
          const tradePrice = parseFloat(msg.p);
          const tradeQty = parseFloat(msg.q);
          if (!Number.isNaN(tradePrice) && tradePrice > 0) {
            this.sourceLabel = 'Binance WS';
            this.ingestTick(tradePrice, Number.isFinite(tradeQty) ? tradeQty : 1.0);
          }
        } catch {
          // ignore malformed tick
        }
      };
      this.ws.onerror = () => {
        this.isLiveWS = false;
      };
      this.ws.onclose = () => {
        this.isLiveWS = false;
      };
    } catch {
      this.isLiveWS = false;
    }
  }

  public ingestCandles(
    candles: CandleData[],
    price: number,
    change24hPct: number | null,
    source = 'REST Live'
  ) {
    if (!Array.isArray(candles) || candles.length === 0 || !Number.isFinite(price) || price <= 0) {
      return;
    }
    this.candles = candles.slice(-40).map((c) => ({ ...c }));
    this.lastPrice = price;
    this.sourceLabel = this.isLiveWS ? 'Binance WS + REST' : source;
    if (change24hPct !== null && Number.isFinite(change24hPct)) {
      this.priceChangePct = change24hPct;
    } else {
      const firstOpen = this.candles[0].open;
      this.priceChangePct = ((price - firstOpen) / Math.max(1e-6, firstOpen)) * 100;
    }
    this.drawChart();
  }

  public ingestTick(price: number, volumeAdd = 1.2) {
    if (!Number.isFinite(price) || price <= 0) return;
    this.lastPrice = price;
    if (!this.sourceLabel) this.sourceLabel = 'Binance WS';
    const now = Date.now();

    if (this.candles.length === 0) {
      this.candles.push({
        time: now,
        open: price,
        high: price,
        low: price,
        close: price,
        vol: volumeAdd
      });
      this.priceChangePct = 0;
      return;
    }

    const last = this.candles[this.candles.length - 1];
    if (now - last.time > 30000) {
      const open = last.close;
      this.candles.push({
        time: now,
        open,
        high: Math.max(open, price),
        low: Math.min(open, price),
        close: price,
        vol: volumeAdd
      });
      if (this.candles.length > 40) this.candles.shift();
    } else {
      last.close = price;
      if (price > last.high) last.high = price;
      if (price < last.low) last.low = price;
      last.vol = Math.min(180, last.vol + volumeAdd);
    }

    if (this.priceChangePct === null) {
      const firstOpen = this.candles[0].open;
      this.priceChangePct = ((this.lastPrice - firstOpen) / Math.max(1e-6, firstOpen)) * 100;
    }
  }

  public update(elapsedSec: number): boolean {
    if (!this.isLiveWS && Date.now() - this.lastRestFetchMs > 30000) {
      void this.hydrateFromRest();
    }
    if (elapsedSec - this.lastRedraw > 0.25) {
      this.lastRedraw = elapsedSec;
      this.drawChart();
      return true;
    }
    return false;
  }

  public isBullish(): boolean | null {
    if (this.candles.length === 0) return null;
    const last = this.candles[this.candles.length - 1];
    return last.close >= last.open;
  }

  /** Honest HUD label: null until a real price AND at least one real candle exist. */
  public get feedLabel(): string | null {
    if (this.lastPrice === null || this.candles.length === 0) return null;
    return this.sourceLabel ?? (this.isLiveWS ? 'Binance WS' : 'REST Live');
  }

  public get hasChart(): boolean {
    return this.lastPrice !== null && this.candles.length > 0;
  }

  private drawChart() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Outer sleek architectural titanium bezel
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, W - 4, H - 4);

    // Inner display viewport inset (14px bevel)
    const padX = 14;
    const padY = 14;
    const innerW = W - padX * 2;
    const innerH = H - padY * 2;

    const grad = ctx.createLinearGradient(0, padY, 0, padY + innerH);
    grad.addColorStop(0, '#071324');
    grad.addColorStop(1, '#0b1e36');
    ctx.fillStyle = grad;
    ctx.fillRect(padX, padY, innerW, innerH);

    // Subtle chart grid lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
    ctx.lineWidth = 1;
    for (let x = padX + 48; x < padX + innerW - 90; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, padY + 64);
      ctx.lineTo(x, padY + innerH - 42);
      ctx.stroke();
    }
    for (let y = padY + 76; y < padY + innerH - 42; y += 56) {
      ctx.beginPath();
      ctx.moveTo(padX + 12, y);
      ctx.lineTo(padX + innerW - 12, y);
      ctx.stroke();
    }

    // Header banner
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.fillRect(padX, padY, innerW, 64);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padX, padY + 64);
    ctx.lineTo(padX + innerW, padY + 64);
    ctx.stroke();

    // Live indicator dot + title
    ctx.fillStyle = this.lastPrice !== null ? (this.isLiveWS ? '#4ade80' : '#38bdf8') : '#f59e0b';
    ctx.beginPath();
    ctx.arc(padX + 26, padY + 32, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 23px Consolas, monospace';
    ctx.fillText('BTC / USDT • F3 HOLO-TERMINAL', padX + 44, padY + 41);

    if (this.lastPrice === null || this.candles.length === 0) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 24px Consolas, monospace';
      ctx.fillText('BELUM DIAMBIL', W - padX - 216, padY + 41);

      // Center high-contrast card (strictly honest read-only telemetry)
      const cardW = 760;
      const cardH = 220;
      const cardX = (W - cardW) / 2;
      const cardY = padY + 130;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(cardX, cardY, cardW, cardH);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 2;
      ctx.strokeRect(cardX, cardY, cardW, cardH);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 34px Consolas, monospace';
      ctx.fillText('STATUS: BELUM DIAMBIL', cardX + 168, cardY + 74);

      ctx.fillStyle = '#7dd3fc';
      ctx.font = 'bold 20px Consolas, monospace';
      ctx.fillText('READ-ONLY FEED: Binance WS / CoinGecko / Coinbase', cardX + 94, cardY + 124);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '18px Consolas, monospace';
      ctx.fillText('Zero fabricated prices — menunggu koneksi pasar live.', cardX + 114, cardY + 166);
      ctx.fillText('STANDING RIG: MARKET DESK (1,0) • FLOOR 3', cardX + 150, cardY + 196);

      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 3;
      ctx.strokeRect(padX, padY, innerW, innerH);
      this.texture.needsUpdate = true;
      return;
    }

    const last = this.candles[this.candles.length - 1];
    const bullish = last.close >= last.open;
    const priceText = `$${this.lastPrice.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
    const pct = this.priceChangePct ?? 0;
    const sign = pct >= 0 ? '+' : '';

    ctx.fillStyle = bullish ? '#4ade80' : '#f87171';
    ctx.font = 'bold 30px Consolas, monospace';
    ctx.fillText(priceText, W - padX - 340, padY + 42);

    ctx.font = 'bold 22px Consolas, monospace';
    ctx.fillText(`${sign}${pct.toFixed(2)}%`, W - padX - 125, padY + 42);

    let minP = Infinity;
    let maxP = -Infinity;
    let maxVol = 1;
    for (const c of this.candles) {
      if (c.low < minP) minP = c.low;
      if (c.high > maxP) maxP = c.high;
      if (c.vol > maxVol) maxVol = c.vol;
    }
    const spread = Math.max(12, maxP - minP);
    const pad = spread * 0.14;
    minP -= pad;
    maxP += pad;

    const chartTop = padY + 80;
    const chartBottom = padY + innerH - 86;
    const chartH = chartBottom - chartTop;
    const chartLeft = padX + 24;
    const chartRight = W - padX - 118;
    const slotW = (chartRight - chartLeft) / Math.max(1, this.candles.length);

    const priceToY = (p: number) =>
      chartBottom - ((p - minP) / Math.max(1, maxP - minP)) * chartH;

    this.candles.forEach((c, idx) => {
      const cx = chartLeft + idx * slotW + slotW * 0.5;
      const isUp = c.close >= c.open;
      const color = isUp ? '#22c55e' : '#ef4444';

      // Volume bars at bottom strip
      const vH = Math.max(4, (c.vol / maxVol) * 38);
      ctx.fillStyle = isUp ? 'rgba(34, 197, 94, 0.38)' : 'rgba(239, 68, 68, 0.38)';
      ctx.fillRect(cx - slotW * 0.34, padY + innerH - 38 - vH, Math.max(3, slotW * 0.68), vH);

      // Wick
      const highY = priceToY(c.high);
      const lowY = priceToY(c.low);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx, highY);
      ctx.lineTo(cx, lowY);
      ctx.stroke();

      // Body
      const openY = priceToY(c.open);
      const closeY = priceToY(c.close);
      const topY = Math.min(openY, closeY);
      const bodyH = Math.max(4, Math.abs(closeY - openY));
      ctx.fillStyle = color;
      ctx.fillRect(cx - slotW * 0.36, topY, Math.max(4, slotW * 0.72), bodyH);
    });

    // Current live price dashed line & pill tag
    const lastY = priceToY(this.lastPrice);
    ctx.strokeStyle = bullish ? '#4ade80' : '#f87171';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(chartLeft, lastY);
    ctx.lineTo(chartRight, lastY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = bullish ? '#16a34a' : '#dc2626';
    ctx.fillRect(chartRight + 6, lastY - 14, 102, 28);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Consolas, monospace';
    ctx.fillText(this.lastPrice.toFixed(0), chartRight + 14, lastY + 5);

    // Y-axis price scale
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 15px Consolas, monospace';
    for (let s = 0; s <= 4; s++) {
      const val = minP + ((maxP - minP) * (4 - s)) / 4;
      const y = chartTop + (chartH * s) / 4;
      if (Math.abs(y - lastY) > 22) {
        ctx.fillText(val.toFixed(0), chartRight + 14, y + 5);
      }
    }

    // Bottom status bar (H/L/Source)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(padX, padY + innerH - 34, innerW, 34);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 15px Consolas, monospace';
    ctx.fillText(
      `HI: $${maxP.toFixed(0)}   LO: $${minP.toFixed(0)}   CANDLES: ${this.candles.length}   SRC: ${(this.sourceLabel || 'LIVE').toUpperCase()}`,
      padX + 18,
      padY + innerH - 11
    );

    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 3;
    ctx.strokeRect(padX, padY, innerW, innerH);
    this.texture.needsUpdate = true;
  }

  public dispose() {
    this.disposed = true;
    try {
      this.ws?.close();
    } catch {
      // ignore
    }
    // The root screen mesh owns every rig child; dispose all geometries,
    // materials and privately-created canvas textures in one traversal.
    this.mesh.traverse((obj) => {
      const drawable = obj as THREE.Mesh | THREE.Line;
      const geo = (drawable as THREE.Mesh).geometry;
      if (geo) geo.dispose();
      const rawMat = (drawable as THREE.Mesh).material;
      if (!rawMat) return;
      const mats = Array.isArray(rawMat) ? rawMat : [rawMat];
      for (const mat of mats) {
        const map = (mat as THREE.MeshBasicMaterial).map;
        if (map && !map.userData.external) map.dispose();
        mat.dispose();
      }
    });
    this.mesh.removeFromParent();
  }
}
