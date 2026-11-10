import * as THREE from 'three';
import { WALL_BBOXES } from '../data/wallsCatalog';

export interface AgentFrameTexture {
  texture: THREE.CanvasTexture;
  worldW: number;
  worldH: number;
}

export interface WallPieceCatalog {
  id: string;
  index: number;
  name: string;
  bbox: { x: number; y: number; w: number; h: number };
  width: number;
  height: number;
  texture: THREE.CanvasTexture;
  cutawayTexture: THREE.CanvasTexture;
}

export function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

export function loadCrispTexture(loader: THREE.TextureLoader, url: string): THREE.Texture {
  const t = loader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

/**
 * Exact non-clipping cell bounding boxes [x, y, w, h] measured on agents_cleaned.png (2752x1536).
 */
const AGENT_CELL_BOXES: Array<Array<[number, number, number, number]>> = [
  [
    [86, 86, 127, 310], [329, 86, 126, 310], [575, 93, 130, 304], [815, 88, 137, 309],
    [1064, 87, 138, 309], [1305, 87, 139, 310], [1549, 86, 134, 309], [1789, 86, 133, 309],
    [2047, 89, 134, 306], [2277, 79, 144, 316], [2533, 96, 131, 301]
  ],
  [
    [92, 428, 110, 274], [339, 425, 112, 277], [577, 430, 120, 275], [822, 430, 121, 273],
    [1072, 434, 117, 271], [1316, 434, 117, 271], [1558, 427, 117, 278], [1797, 426, 117, 279],
    [2050, 426, 126, 277], [2292, 428, 157, 275], [2521, 410, 167, 287]
  ],
  [
    [98, 725, 100, 249], [346, 723, 100, 250], [582, 725, 105, 249], [831, 723, 108, 251],
    [1077, 728, 105, 244], [1319, 729, 107, 245], [1526, 738, 183, 230], [1780, 734, 185, 234],
    [2056, 725, 137, 246], [2302, 719, 134, 253], [2523, 698, 162, 276]
  ],
  [
    [95, 992, 107, 249], [341, 991, 104, 249], [583, 992, 105, 249], [828, 994, 110, 245],
    [1071, 988, 114, 247], [1315, 990, 113, 247], [1559, 989, 111, 247], [1806, 992, 113, 246],
    [2059, 992, 113, 250], [2303, 992, 111, 249], [2547, 993, 109, 243]
  ],
  [
    [94, 1265, 137, 241], [341, 1273, 109, 233], [585, 1267, 134, 236], [830, 1265, 140, 239],
    [1071, 1258, 114, 247], [1315, 1267, 110, 236], [1560, 1263, 111, 242], [1806, 1263, 113, 244],
    [2060, 1263, 112, 244], [2304, 1272, 106, 235], [2548, 1263, 107, 244]
  ]
];

export function cropAgentCellClean(
  img: HTMLImageElement,
  col: number,
  row: number
): AgentFrameTexture {
  const sxScale = img.width / 2752;
  const syScale = img.height / 1536;
  const [bx, by, bw, bh] = AGENT_CELL_BOXES[row]?.[col] ?? [86, 86, 127, 310];

  const pad = 2;
  const sx = Math.max(0, Math.round((bx - pad) * sxScale));
  const sy = Math.max(0, Math.round((by - pad) * syScale));
  const sw = Math.min(img.width - sx, Math.round((bw + pad * 2) * sxScale));
  const sh = Math.min(img.height - sy, Math.round((bh + pad * 2) * syScale));

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;

  const isDeskTyping = row === 2 && (col === 6 || col === 7);
  const isConfetti = col === 10 && (row === 1 || row === 2);

  let worldH = 0.84;
  if (isConfetti) worldH = 0.92;
  else if (isDeskTyping) worldH = 0.80;

  const worldW = Number((worldH * (sw / Math.max(1, sh))).toFixed(3));
  return { texture: tex, worldW, worldH };
}

/**
 * Inset flood-fill chroma-key for JPEG-backed spritesheets.
 */
export function removeDarkBackgroundFloodFill(
  ctx: CanvasRenderingContext2D,
  sw: number,
  sh: number,
  tolerance = 40
): ImageData {
  const imgData = ctx.getImageData(0, 0, sw, sh);
  const data = imgData.data;

  const sampleCoords = [
    [Math.min(4, sw - 1), Math.min(4, sh - 1)],
    [Math.max(0, sw - 5), Math.min(4, sh - 1)],
    [Math.min(4, sw - 1), Math.max(0, sh - 5)],
    [Math.max(0, sw - 5), Math.max(0, sh - 5)]
  ];

  const bgSamples: Array<[number, number, number]> = [[24, 28, 40]];
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

export function cropSpritePixels(
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  tolerance = 38,
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
 * Cleans, removes trapped interior dark gaps (e.g. Frame 2), normalizes outer door frame bounds
 * across all 4 animation frames (eliminating width wobble), and aligns isometric wall slope (+0.112)
 * so sliding glass doors lock flush onto the architectural wall frames.
 */
export function createNormalizedSlidingDoorFrames(
  img: HTMLImageElement,
  boxes: Array<[number, number, number, number]>
): THREE.CanvasTexture[] {
  const sX = img.width / 2752;
  const sY = img.height / 1536;
  const CANVAS_W = 300;
  const CANVAS_H = 440;
  const TX0 = 24;
  const TY0 = 16;
  const TW = 252;
  const TH = 380;
  const SHEAR = 0.112;

  return boxes.map(([bx, by, bw, bh]) => {
    const sx = Math.max(0, Math.min(img.width - 1, Math.round(bx * sX)));
    const sy = Math.max(0, Math.min(img.height - 1, Math.round(by * sY)));
    const sw = Math.max(1, Math.min(img.width - sx, Math.round(bw * sX)));
    const sh = Math.max(1, Math.min(img.height - sy, Math.round(bh * sY)));

    const rawCanvas = document.createElement('canvas');
    rawCanvas.width = sw;
    rawCanvas.height = sh;
    const rawCtx = rawCanvas.getContext('2d')!;
    rawCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    const imgData = removeDarkBackgroundFloodFill(rawCtx, sw, sh, 34);
    const data = imgData.data;

    // Seed interior doorway opening center to clear sealed dark gap (critical on Frame 2)
    const cx0 = Math.floor(sw / 2);
    const cy0 = Math.floor(sh * 0.45);
    const isDarkVoid = (p: number) => {
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      return r < 52 && g < 56 && b < 68 && Math.hypot(r - 24, g - 28, b - 40) <= 20;
    };
    const seedP = (cy0 * sw + cx0) * 4;
    if (data[seedP + 3] > 0 && isDarkVoid(seedP)) {
      const vis = new Uint8Array(sw * sh);
      const q: number[] = [cy0 * sw + cx0];
      vis[cy0 * sw + cx0] = 1;
      while (q.length > 0) {
        const idx = q.pop()!;
        data[idx * 4 + 3] = 0;
        const x = idx % sw;
        const y = (idx - x) / sw;
        const neighbors: Array<[number, number]> = [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1]
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= sw || ny < 0 || ny >= sh) continue;
          const nIdx = ny * sw + nx;
          if (vis[nIdx]) continue;
          const np = nIdx * 4;
          if (data[np + 3] > 0 && isDarkVoid(np)) {
            vis[nIdx] = 1;
            q.push(nIdx);
          }
        }
      }
      rawCtx.putImageData(imgData, 0, 0);
    }

    // Measure solid metal doorframe bounds (ignoring cyan floor threshold glow in bottom quarter)
    let minX = sw;
    let maxX = 0;
    let minY = sh;
    let maxY = 0;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const p = (y * sw + x) * 4;
        if (data[p + 3] <= 20) continue;
        const isBottomGlow = data[p + 2] > 170 && data[p] < 70 && y > sh * 0.72;
        if (isBottomGlow) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < minX || maxY < minY) {
      minX = 0;
      minY = 0;
      maxX = sw - 1;
      maxY = sh - 1;
    }

    const scaleX = TW / Math.max(1, maxX - minX + 1);
    const scaleY = TH / Math.max(1, maxY - minY + 1);
    const ox = TX0 - minX * scaleX;
    const oy = TY0 - minY * scaleY;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = CANVAS_W;
    outCanvas.height = CANVAS_H;
    const outCtx = outCanvas.getContext('2d')!;
    outCtx.setTransform(1, SHEAR, 0, 1, 0, -SHEAR * (CANVAS_W / 2));
    outCtx.drawImage(rawCanvas, ox, oy, sw * scaleX, sh * scaleY);
    outCtx.setTransform(1, 0, 0, 1, 0, 0);

    const tex = new THREE.CanvasTexture(outCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  });
}

export function cropComboFrame(
  img: HTMLImageElement,
  box: [number, number, number, number],
  targetWorldH = 1.25
): AgentFrameTexture {
  const sxScale = img.width / 2752;
  const syScale = img.height / 1536;
  const tex = cropSpritePixels(
    img,
    Math.round(box[0] * sxScale),
    Math.round(box[1] * syScale),
    Math.round(box[2] * sxScale),
    Math.round(box[3] * syScale),
    34,
    true
  );
  const c = tex.image as HTMLCanvasElement;
  const worldW = Number((targetWorldH * (c.width / Math.max(1, c.height))).toFixed(3));
  return { texture: tex, worldW, worldH: targetWorldH };
}

/**
 * Generates a clean RimWorld-style cutaway half-wall texture from a full wall canvas.
 * Upper half becomes lightly ghosted (10% alpha) while bottom 48% remains solid with a crisp cyan cutaway bevel.
 */
export function createCutawayWallTexture(sourceCanvas: HTMLCanvasElement): THREE.CanvasTexture {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(sourceCanvas, 0, 0);

  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const cutY = Math.round(h * 0.54);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const alpha = d[idx + 3];
      if (alpha === 0) continue;

      if (y < cutY - 2) {
        d[idx + 3] = Math.round(alpha * 0.10);
      } else if (y >= cutY - 2 && y <= cutY + 1) {
        // Subtle cyan/slate architectural cutaway rim
        d[idx] = Math.min(255, Math.round(d[idx] * 0.4 + 56 * 0.6));
        d[idx + 1] = Math.min(255, Math.round(d[idx + 1] * 0.4 + 189 * 0.6));
        d[idx + 2] = Math.min(255, Math.round(d[idx + 2] * 0.4 + 248 * 0.6));
        d[idx + 3] = Math.min(255, Math.round(alpha * 0.92));
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(out);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

/**
 * Creates a repeating halftone stippled dark-navy RimWorld Fog-of-War pattern texture.
 */
export function createRimworldFogPatternTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, 32, 32);

  // Subtle dither dots matching walls_rimworld_occlusion.png
  ctx.fillStyle = 'rgba(30, 41, 59, 0.55)';
  for (let y = 0; y < 32; y += 4) {
    for (let x = (y % 8 === 0 ? 0 : 2); x < 32; x += 4) {
      ctx.fillRect(x, y, 2, 2);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Extracts all 20 cleaned, anti-aliased wall sprites from walls_spritesheet.png
 * plus clean Studio/Metallic/Glass walls from tileset_floor_wall.png if provided.
 */
export function extractWallSpritesFromSheet(
  img: HTMLImageElement,
  tilesetWallImg?: HTMLImageElement | null
): WallPieceCatalog[] {
  const sxScale = img.width / 1417;
  const syScale = img.height / 1029;

  const basePieces: WallPieceCatalog[] = WALL_BBOXES.map((meta, idx) => {
    const sx = Math.round(meta.x * sxScale);
    const sy = Math.round(meta.y * syScale);
    const sw = Math.max(1, Math.round(meta.w * sxScale));
    const sh = Math.max(1, Math.round(meta.h * syScale));

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;

    return {
      id: meta.id,
      index: idx,
      name: meta.name,
      bbox: { x: meta.x, y: meta.y, w: meta.w, h: meta.h },
      width: meta.worldW,
      height: meta.worldH,
      texture: tex,
      cutawayTexture: createCutawayWallTexture(canvas)
    };
  });

  if (tilesetWallImg) {
    const tsScaleX = tilesetWallImg.width / 2752;
    const tsScaleY = tilesetWallImg.height / 1536;
    const extraWalls: Array<{ id: string; name: string; box: [number, number, number, number]; w: number; h: number }> = [
      { id: 'wall_ts_acoustic', name: 'Acoustic Foam Wall', box: [104, 576, 240, 388], w: 1.25, h: 1.78 },
      { id: 'wall_ts_studio', name: 'Studio Metallic Wall', box: [1056, 572, 276, 396], w: 1.38, h: 1.82 },
      { id: 'wall_ts_corner', name: 'Metallic Corner L', box: [1440, 564, 580, 396], w: 2.35, h: 1.65 },
      { id: 'wall_ts_connector', name: 'Holo X-Wall Connector', box: [2404, 592, 244, 356], w: 1.18, h: 1.65 },
      { id: 'wall_ts_glass_door', name: 'Glass Doorway Frame', box: [1128, 1068, 276, 356], w: 1.38, h: 1.72 }
    ];

    extraWalls.forEach((ew, eIdx) => {
      const tex = cropSpritePixels(
        tilesetWallImg,
        Math.round(ew.box[0] * tsScaleX),
        Math.round(ew.box[1] * tsScaleY),
        Math.round(ew.box[2] * tsScaleX),
        Math.round(ew.box[3] * tsScaleY),
        34,
        true
      );
      const canvas = tex.image as HTMLCanvasElement;
      basePieces.push({
        id: ew.id,
        index: basePieces.length + eIdx,
        name: ew.name,
        bbox: { x: ew.box[0], y: ew.box[1], w: ew.box[2], h: ew.box[3] },
        width: ew.w,
        height: ew.h,
        texture: tex,
        cutawayTexture: createCutawayWallTexture(canvas)
      });
    });
  }

  return basePieces;
}
