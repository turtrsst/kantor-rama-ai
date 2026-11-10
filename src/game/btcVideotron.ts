import * as THREE from 'three';
import { ISO_WORLD_SLOPE, uvToWorld } from '../data/floorNavGraph';

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
}

/**
 * Strict Real-Data-Only BTC/USDT Videotron mounted symmetrically on Floor 3 Quant Room's
 * back-left wall. Starts as BELUM DIAMBIL until real Binance WS or /api/market/btc-live
 * (Binance REST / Coinbase / CoinGecko) data arrives — never displays fabricated numbers.
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

  constructor(scene: THREE.Scene) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = 512;
    this.ctx = this.canvas.getContext('2d')!;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = true;

    // Enlarged framed display mounted inside the dark corporate NW wall of Floor 3 (1,0) Market Desk SANDI
    const screenW = 1.72;
    const screenH = 0.86;
    const isoSlope = ISO_WORLD_SLOPE;

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
      transparent: true,
      alphaTest: 0.01,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.Mesh(geo, mat);
    // NW back wall line runs from (0.384, 0.227) to (0.201, 0.398), midpoint u=0.2925, v=0.3125.
    // With the normalized 1.18-world wall datum the screen centre sits at v=0.239,
    // fully inside the steel wall instead of floating above its top edge.
    const wallBaseWorld = uvToWorld(0.295, 0.312);
    const screenCenter = uvToWorld(0.295, 0.239);
    this.mesh.position.set(screenCenter.x, screenCenter.y, 0.24);
    // Walls are transparent and sorted by renderOrder. The old opaque mesh was always
    // drawn before them (and behind the second NW wall at order 365), hiding the chart.
    // 370 keeps it above every NW wall (<=365) but below the trophy (372), SANDI's desk
    // (388) and agent (410) so the Videotron reads as wall-mounted, not a HUD overlay.
    const nwWallRenderOrder = Math.round((5.0 - wallBaseWorld.y) * 100);
    this.mesh.renderOrder = nwWallRenderOrder + 39; // 331 + 39 = 370
    this.mesh.visible = false;
    scene.add(this.mesh);

    this.connectBinanceStream();
    void this.hydrateFromRest();
    this.drawChart();
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
    ctx.font = 'bold 26px Consolas, monospace';
    ctx.fillText('BTC / USDT • QUANT VIDEOTRON', padX + 44, padY + 41);

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
    this.texture.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
