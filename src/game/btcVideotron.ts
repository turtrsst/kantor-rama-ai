import * as THREE from 'three';
import { uvToWorld } from '../data/floorNavGraph';

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
}

/**
 * Strict Real-Data-Only BTC/USDT Videotron.
 * Starts as BELUM DIAMBIL until a real Binance WebSocket/REST price arrives —
 * never displays fabricated/random prices (per AGENTS.md & prompt-opencode-bots-exness.md).
 */
export class BTCVideotronEngine {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public texture: THREE.CanvasTexture;
  public mesh: THREE.Mesh;
  public candles: CandleData[] = [];
  public lastPrice: number | null = null;
  public priceChangePct: number | null = null;
  public isLiveWS = false;
  private lastRedraw = 0;
  private ws: WebSocket | null = null;
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 768;
    this.canvas.height = 384;
    this.ctx = this.canvas.getContext('2d')!;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    // Precisely calibrated to sit inside the gray wall bezel on Floor 3 (u=0.246, v=0.226)
    const screenW = 1.34;
    const screenH = 0.53;
    const isoSlope = 0.525;

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
    const center = uvToWorld(0.246, 0.226);
    this.mesh.position.set(center.x, center.y, 0.14);
    this.mesh.renderOrder = 15;
    this.mesh.visible = false;
    scene.add(this.mesh);

    this.connectBinanceStream();
    this.drawChart();
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
            this.ingestTick(tradePrice, tradeQty);
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

  public ingestTick(price: number, volumeAdd = 1.2) {
    this.lastPrice = price;
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

  public update(elapsedSec: number): boolean {
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

  private drawChart() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#06101e');
    grad.addColorStop(1, '#09192c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

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

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(0, 0, W, 46);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 46);
    ctx.lineTo(W, 46);
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px Consolas, monospace';
    ctx.fillText('BTC / USDT • REALTIME VIDEOTRON', 18, 30);

    if (this.lastPrice === null || this.candles.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 18px Consolas, monospace';
      ctx.fillText('BELUM DIAMBIL', W - 180, 30);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 24px Consolas, monospace';
      ctx.fillText('STATUS: BELUM DIAMBIL (READ-ONLY SANDI)', 90, 182);
      ctx.fillStyle = '#64748b';
      ctx.font = '16px Consolas, monospace';
      ctx.fillText('Menunggu tick live Binance / Refresh Market Brief Pagi — tanpa angka karangan.', 68, 222);

      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, W - 4, H - 4);
      this.texture.needsUpdate = true;
      return;
    }

    const last = this.candles[this.candles.length - 1];
    const bullish = last.close >= last.open;
    ctx.fillStyle = bullish ? '#4ade80' : '#f87171';
    ctx.font = 'bold 22px Consolas, monospace';
    const priceText = `$${this.lastPrice.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
    ctx.fillText(priceText, W - 265, 30);

    const pct = this.priceChangePct ?? 0;
    ctx.font = 'bold 14px Consolas, monospace';
    const sign = pct >= 0 ? '+' : '';
    ctx.fillText(`${sign}${pct.toFixed(2)}%`, W - 95, 30);

    let minP = Infinity;
    let maxP = -Infinity;
    for (const c of this.candles) {
      if (c.low < minP) minP = c.low;
      if (c.high > maxP) maxP = c.high;
    }
    const pad = Math.max(10, (maxP - minP) * 0.12);
    minP -= pad;
    maxP += pad;

    const chartTop = 58;
    const chartBottom = H - 68;
    const chartH = chartBottom - chartTop;
    const chartLeft = 22;
    const chartRight = W - 82;
    const slotW = (chartRight - chartLeft) / Math.max(1, this.candles.length);

    const priceToY = (p: number) =>
      chartBottom - ((p - minP) / Math.max(1, maxP - minP)) * chartH;

    this.candles.forEach((c, idx) => {
      const cx = chartLeft + idx * slotW + slotW * 0.5;
      const isUp = c.close >= c.open;
      const color = isUp ? '#22c55e' : '#ef4444';

      const vH = Math.min(42, (c.vol / 10) * 14);
      ctx.fillStyle = isUp ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)';
      ctx.fillRect(cx - slotW * 0.32, H - 14 - vH, slotW * 0.64, vH);

      const highY = priceToY(c.high);
      const lowY = priceToY(c.low);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, highY);
      ctx.lineTo(cx, lowY);
      ctx.stroke();

      const openY = priceToY(c.open);
      const closeY = priceToY(c.close);
      const topY = Math.min(openY, closeY);
      const bodyH = Math.max(3, Math.abs(closeY - openY));
      ctx.fillStyle = color;
      ctx.fillRect(cx - slotW * 0.34, topY, slotW * 0.68, bodyH);
    });

    const lastY = priceToY(this.lastPrice);
    ctx.strokeStyle = bullish ? '#4ade80' : '#f87171';
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(chartLeft, lastY);
    ctx.lineTo(chartRight, lastY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px Consolas, monospace';
    for (let s = 0; s <= 4; s++) {
      const val = minP + ((maxP - minP) * (4 - s)) / 4;
      const y = chartTop + (chartH * s) / 4;
      ctx.fillText(val.toFixed(0), chartRight + 8, y + 4);
    }

    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, W - 4, H - 4);
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
