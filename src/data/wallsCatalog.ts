import {
  FLOOR_NAV_NODES,
  GRID_DU,
  GRID_DV,
  snapUVToFloorGrid,
  uvToWorld
} from './floorNavGraph';
import { FloorId } from '../types/office';

export interface WallBBoxMeta {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  worldW: number;
  worldH: number;
  /**
   * Fraction from top of sprite image to the midpoint of its ground-contact baseline.
   * Ensures every modular wall base sits flush on the floor cyan border line.
   */
  anchorRatio: number;
  /** Always 0 after the shared cap crop; kept for catalog/audit compatibility. */
  topRatio: number;
  /** False only for the three native-height pillars / elevator hubs. */
  normalizedHeight: boolean;
  /** Small world-Y shift that aligns this sprite's real art top with the shared 136 px cap. */
  topAlignOffset: number;
}

export type PerimeterSide = 'NW' | 'NE' | 'SW' | 'SE';

export interface DefaultWallPlacement {
  pieceId: string;
  floor: FloorId;
  u: number;
  v: number;
  flipX?: boolean;
  /** Pure outer floor edge this wall was clamped to (not an interior divider). */
  perimeterSide?: PerimeterSide;
  /** Left-to-right / back-to-front tie-breaker for deterministic perimeter sorting. */
  perimeterIndex?: number;
  /** Exact measured UV; skip quarter-cell grid snapping. */
  precise?: boolean;
  /** Source segment id for gap / overlap audit. */
  segmentId?: string;
}

/**
 * Exact bounding boxes from the cleaned, anti-aliased, checkerboard-free
 * public/assets/walls_spritesheet.png (1417x1029 RGBA).
 * Scale calibrated directly against Floor_1_pure.jpg & Floor_2_pure.jpg (2752x1536).
 */
export const WALL_SHEET_W = 1417;
export const WALL_SHEET_H = 1029;
export const PX_PER_WORLD = 118.0;
/**
 * Border Wall Harmonization: every wall sprite is cropped to one identical
 * top-cap band. 136 asset pixels at 118 px/world = ~1.15 world units, the same
 * visible height for glass, wood, dark steel, portals and pillars alike.
 * Using ONE px->world scale (instead of the old 1.18 per-sprite height
 * normalizer) preserves the isometric roof slope and stops the zig-zag top
 * line seen on the live build.
 */
export const WALL_TOP_CAP_PX = 136;
export const WALL_VISIBLE_HEIGHT = Number((WALL_TOP_CAP_PX / PX_PER_WORLD).toFixed(2));

function makeBox(
  id: string,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  artAnchorRatio: number,
  _artTopRatio: number,
  keepNativeHeight = false
): WallBBoxMeta {
  // Remove the extra pixel head-frame above the shared top-cap line. The crop
  // is applied in wallsCatalog.ts so spriteLoader.ts draws exactly the cropped
  // bbox; no per-module vertical rescale is allowed (that bent the roof slope).
  const artAnchorY = artAnchorRatio * h;
  // Negative cropY pads transparent rows ABOVE short sprites (e.g. wall_09)
  // instead of leaving their ground baseline above the shared 136 px cap.
  const cropY = Math.round(artAnchorY - WALL_TOP_CAP_PX);
  const croppedH = h - cropY;
  const worldW = Number((w / PX_PER_WORLD).toFixed(3));
  // Uniform scale: worldH / croppedH === 1 / PX_PER_WORLD for EVERY module.
  const worldH = Number((croppedH / PX_PER_WORLD).toFixed(4));
  const anchorRatio = Number((WALL_TOP_CAP_PX / croppedH).toFixed(4));
  const topRatio = 0;
  // Glass panels were drawn with a shorter base->top-centre distance than wood
  // / steel. A pure translation (never a rescale) lines up their real roof
  // edges while keeping the 1/118 px->world slope identical for every module.
  const artTopY = Math.max(0, Math.min(1, _artTopRatio)) * h;
  const artVisiblePx = artAnchorY - artTopY;
  const topAlignOffset = keepNativeHeight
    ? 0
    : Number(((WALL_TOP_CAP_PX - artVisiblePx) / PX_PER_WORLD).toFixed(4));
  return {
    id,
    name,
    x,
    y: y + cropY,
    w,
    h: croppedH,
    worldW,
    worldH,
    anchorRatio,
    topRatio,
    normalizedHeight: !keepNativeHeight,
    topAlignOffset
  };
}

export const WALL_BBOXES: WallBBoxMeta[] = [
  makeBox('wall_00', 'Corner Wall Dark Wide',   38,   84, 233, 194, 0.7216, 0.0052),
  makeBox('wall_01', 'Corner Wall Dark Compact',  311,   97, 180, 181, 0.7790, 0.0055),
  makeBox('wall_02', 'Glass Window 3-Pane',  531,   66, 186, 212, 0.7783, 0.2217),
  makeBox('wall_03', 'Wood Panel Wall 4-Sec',  757,   38, 205, 240, 0.7958, 0.2041),
  makeBox('wall_04', 'Wood Panel Wall 3-Sec', 1002,   51, 174, 227, 0.8194, 0.1674),
  makeBox('wall_05', 'Straight Wall Dark Short', 1216,   79, 163, 199, 0.8090, 0.2060),
  makeBox('wall_06', 'Corner Wall Dark Mid',   38,  517, 233, 196, 0.7194, 0.0000),
  makeBox('wall_07', 'Half Wall + Glass',  311,  532, 129, 181, 0.8287, 0.1989),
  makeBox('wall_08', 'Twin Glass Partitions',  480,  541, 190, 172, 0.9593, 0.0349),
  makeBox('wall_09', 'Single Glass Pane A',  710,  572,  64, 141, 0.9078, 0.0921),
  makeBox('wall_10', 'Single Glass Pane B',  814,  567,  59, 146, 0.9247, 0.0959),
  makeBox('wall_11', 'Tall Structural Pillar',  913,  318,  77, 395, 0.9823, 0.0025, true),
  makeBox('wall_12', 'Sensor Glass Doors R/G', 1030,  539, 152, 174, 0.8793, 0.0000),
  makeBox('wall_13', 'Shutter Doorway Frame', 1222,  516,  96, 197, 0.9137, 0.1168),
  makeBox('wall_14', 'Straight Wall Dark Long',   38,  753, 200, 238, 0.7983, 0.1932),
  makeBox('wall_15', 'Elevator Hub (Red)',  278,  755, 191, 236, 0.9915, 0.0000, true),
  makeBox('wall_16', 'Elevator Hub (Green)',  509,  766, 192, 225, 0.9956, 0.0000, true),
  makeBox('wall_17', 'Executive Wood Door',  741,  829,  75, 162, 0.8951, 0.0926),
  makeBox('wall_18', 'Open Door Frame SW',  856,  804, 122, 187, 0.8610, 0.0909),
  makeBox('wall_19', 'Open Door Frame SE', 1018,  804, 119, 187, 0.8610, 0.0855),
];

function lerpUV(
  a: readonly [number, number],
  b: readonly [number, number],
  t: number
): { u: number; v: number } {
  return {
    u: Number((a[0] + (b[0] - a[0]) * t).toFixed(4)),
    v: Number((a[1] + (b[1] - a[1]) * t).toFixed(4))
  };
}

// Exact cyan-border / white-nook intersections measured on Floor_1_pure.jpg (Floors 1 & 3).
// These are the line endpoints that the quarter-cell snap grid locks onto.
const F1_TOP_APEX   = [0.496, 0.119] as const;
const F1_NOOK_W     = [0.384, 0.227] as const;
const F1_NOOK_E     = [0.622, 0.227] as const;
const F1_WOOD_NW    = [0.202, 0.406] as const;
const F1_WEST_APEX  = [0.031, 0.557] as const;
const F1_MID_BOT_SW = [0.191, 0.698] as const;
const F1_INNER_W    = [0.357, 0.547] as const;
const F1_BOT_PAN_SE = [0.662, 0.824] as const;
const F1_PAN_N      = [0.689, 0.553] as const;
const F1_PAN_W      = [0.523, 0.704] as const;
const F1_GLOSSY_OUT = [0.824, 0.440] as const;
const F1_EAST_APEX  = [0.966, 0.557] as const;
const F1_ELEV_N     = [0.496, 0.324] as const;

// Exact cyan-border intersections measured on Floor_2_pure.jpg (Floor 2 U-Cutout).
const F2_WEST_APEX_N = [0.287, 0.323] as const;
const F2_WEST_ELEV   = [0.399, 0.427] as const;
const F2_WEST_APEX   = [0.031, 0.557] as const;
const F2_MID_BOT_SW  = [0.180, 0.695] as const;
const F2_INNER_W     = [0.356, 0.537] as const;
const F2_BOT_PAN_SE  = [0.658, 0.820] as const;
const F2_EAST_APEX_N = [0.668, 0.292] as const;
const F2_SE_DIV_SW   = [0.621, 0.672] as const;
const F2_SE_DIV_NE   = [0.830, 0.444] as const;
const F2_EAST_APEX   = [0.966, 0.557] as const;

/** Exact world widths derived from alpha-scanned sprite bboxes. */
export const WALL_WIDTH: Record<string, number> = WALL_BBOXES.reduce(
  (acc, b) => { acc[b.id] = b.worldW; return acc; },
  {} as Record<string, number>
);
export const PORTAL_HALF_W = WALL_WIDTH['wall_18'] / 2 + 0.02;

export const PRECISE_OUTER_ANCHORS: Record<1 | 2 | 3, Record<'NW' | 'NE', readonly [UVPoint, UVPoint]>> = {
  1: { NW: [F1_TOP_APEX, F1_WEST_APEX], NE: [F1_TOP_APEX, F1_EAST_APEX] },
  2: { NW: [F2_WEST_APEX_N, F2_WEST_APEX], NE: [F2_EAST_APEX_N, F2_EAST_APEX] },
  3: { NW: [F1_TOP_APEX, F1_WEST_APEX], NE: [F1_TOP_APEX, F1_EAST_APEX] }
};

interface TilePiece { id: string; width: number }
export const PRECISE_MIN_TILE_SPAN = 0.80;
const INNER_TILE_PALETTE: TilePiece[] = ['wall_02', 'wall_07', 'wall_08', 'wall_05', 'wall_14', 'wall_03', 'wall_04', 'wall_09', 'wall_10']
  .map((id) => ({ id, width: WALL_WIDTH[id] }));

/**
 * Precision rebuild: choose the module sequence whose summed real sprite widths
 * fits a measured segment with the smallest residual. No arbitrary t fractions,
 * no per-sprite rescale, no gap larger than a few hundredths of a world unit.
 */
function fitTileSequence(
  span: number,
  palette: TilePiece[],
  preferred: string[],
  tolerance = 0
): { ids: string[]; total: number; gap: number } {
  const SCALE = 100;
  const target = Math.round(span * SCALE);
  const maxT = target + Math.round(tolerance * SCALE);
  const avgPreferred =
    preferred.reduce((sum, id) => sum + WALL_WIDTH[id], 0) / preferred.length;
  // Cap the module count around the intended architectural rhythm; otherwise
  // exact-fit DP would happily tile a whole wing with tiny filler panes.
  const maxN = Math.min(10, Math.ceil(span / avgPreferred) + 1);
  let dp: Array<{ ids: string[]; penalty: number } | null> = Array(maxT + 1).fill(null);
  dp[0] = { ids: [], penalty: 0 };
  for (let k = 0; k < maxN; k++) {
    // Carry states forward so sequences with <= maxN pieces all survive.
    const next: Array<{ ids: string[]; penalty: number } | null> = dp.slice();
    for (let t = 0; t <= maxT; t++) {
      const cur = dp[t];
      if (!cur) continue;
      for (const piece of palette) {
        const nt = t + Math.round(piece.width * SCALE);
        if (nt > maxT) continue;
        const want = preferred[cur.ids.length % preferred.length];
        const barePane = piece.id === 'wall_09' || piece.id === 'wall_10';
        const penalty = cur.penalty + (piece.id === want ? 0 : barePane ? 0.50 : 0.005);
        if (!next[nt] || penalty < next[nt]!.penalty) {
          next[nt] = { ids: [...cur.ids, piece.id], penalty };
        }
      }
    }
    dp = next;
  }
  let bestT = 0;
  let bestScore = Infinity;
  for (let t = maxT; t >= 0; t--) {
    const cur = dp[t];
    if (!cur) continue;
    const delta = Math.abs(span - t / SCALE);
    // Closest real-width fit first, then fewer modules / preferred rhythm.
    const score = delta + cur.penalty + cur.ids.length * 0.005;
    if (score < bestScore) { bestScore = score; bestT = t; }
    if (span - t / SCALE > 0.25) break;
  }
  const best = dp[bestT] ?? { ids: [], penalty: 0 };
  return { ids: best.ids, total: bestT / SCALE, gap: span - bestT / SCALE };
}

/** Place a fitted sequence at cumulative real-width centres along one exact line. */
function placeTiles(
  floor: FloorId,
  a: UVPoint,
  b: UVPoint,
  start: number,
  end: number,
  palette: TilePiece[],
  preferred: string[],
  flipX: boolean,
  side: PerimeterSide | undefined,
  segmentId: string,
  forcedIds?: string[],
  tolerance = 0
): DefaultWallPlacement[] {
  const len = worldDistance(a, b);
  const span = end - start;
  if (span < 0.35 || len === 0) return [];
  const fit = forcedIds
    ? { ids: forcedIds, total: forcedIds.reduce((sum, id) => sum + WALL_WIDTH[id], 0), gap: (span - forcedIds.reduce((sum, id) => sum + WALL_WIDTH[id], 0)) / (forcedIds.length + 1) }
    : fitTileSequence(span, palette, preferred, tolerance);
  if (!fit.ids.length) return [];
  const gap = fit.gap / (fit.ids.length + 1);
  let cursor = start + gap;
  const out: DefaultWallPlacement[] = [];
  for (const id of fit.ids) {
    const w = WALL_WIDTH[id];
    const center = cursor + w / 2;
    const t = Math.max(0, Math.min(1, center / len));
    const pos = lerpUV(a, b, t);
    cursor += w + gap;
    out.push({
      pieceId: id,
      floor,
      u: pos.u,
      v: pos.v,
      flipX,
      precise: true,
      perimeterSide: side,
      segmentId
    });
  }
  return out;
}

/**
 * Mirrored NW/NE back perimeter. Both wings use the SAME fitted module
 * sequence; the longer U-cutout wing only distributes a slightly larger
 * sub-pixel gap, so piece types / dimensions stay identical left and right.
 */
function buildPreciseOuterPerimeter(floor: 1 | 2 | 3): DefaultWallPlacement[] {
  const out: DefaultWallPlacement[] = [];
  const anchors = PRECISE_OUTER_ANCHORS[floor];
  const forcedIds = floor === 2
    ? ['wall_02', 'wall_05', 'wall_02', 'wall_10']
    : ['wall_02', 'wall_09', 'wall_02', 'wall_02', 'wall_02', 'wall_02'];

  if (floor === 2) {
    out.push({ pieceId: 'wall_01', floor, u: F2_WEST_APEX_N[0], v: F2_WEST_APEX_N[1] + 0.004, flipX: false, precise: true, perimeterSide: 'NW', segmentId: `f${floor}-nw` });
    out.push({ pieceId: 'wall_01', floor, u: F2_EAST_APEX_N[0], v: F2_EAST_APEX_N[1] + 0.004, flipX: true, precise: true, perimeterSide: 'NE', segmentId: `f${floor}-ne` });
  } else {
    out.push({ pieceId: 'wall_01', floor, u: F1_TOP_APEX[0], v: F1_TOP_APEX[1] + 0.004, flipX: false, precise: true, perimeterSide: 'NW', segmentId: `f${floor}-nw` });
  }

  // Mirror the identical glass module sequence onto both wings; each wing
  // distributes its own exact seam overlap instead of showing a visible gap.
  const fit = {
    ids: forcedIds,
    total: forcedIds.reduce((sum, id) => sum + WALL_WIDTH[id], 0),
    gap: 0
  };
  for (const side of ['NW', 'NE'] as const) {
    const [a, b] = anchors[side];
    const len = worldDistance(a, b);
    const gap = (len - fit.total) / (fit.ids.length + 1);
    let cursor = gap;
    for (const id of fit.ids) {
      const w = WALL_WIDTH[id];
      const center = Math.max(0, Math.min(len, cursor + w / 2));
      const pos = lerpUV(a, b, center / len);
      out.push({
        pieceId: id,
        floor,
        u: pos.u,
        v: pos.v,
        flipX: side === 'NE',
        precise: true,
        perimeterSide: side,
        segmentId: `f${floor}-${side.toLowerCase()}`
      });
      cursor += w + gap;
    }
  }
  return out;
}

/** Every interior divider is tiled with exact cumulative widths, portals stay exact. */
function buildPreciseInteriorDividers(floor: FloorId): DefaultWallPlacement[] {
  const out: DefaultWallPlacement[] = [];
  INTERIOR_DIVIDER_SPECS[floor].forEach((spec, idx) => {
    const slope = (spec.b[1] - spec.a[1]) / (spec.b[0] - spec.a[0] || 1e-6);
    const panelFlip = slope > 0;
    const portalPiece = spec.portalPieceId ?? (slope > 0 ? 'wall_19' : 'wall_18');
    const segmentId = `f${floor}-d${idx}`;
    const geometry = PRECISE_SPEC_GEOMETRY[segmentId];

    for (const p of spec.portals ?? []) {
      out.push({ pieceId: portalPiece, floor, u: p[0], v: p[1], flipX: false, precise: true, segmentId });
    }
    if (spec.portalOnly || geometry.len < 0.35) return;

    for (const [start, end] of geometry.spans) {
      out.push(...placeTiles(
        floor, spec.a, spec.b, start, end,
        INNER_TILE_PALETTE,
        ['wall_02', 'wall_07', 'wall_08', 'wall_14'],
        panelFlip,
        undefined,
        segmentId,
        undefined,
        0.40
      ));
    }
  });
  return out;
}

/**
 * Custom architectural modular wall layout aligned pixel-for-pixel to
 * Floor_1_pure.jpg (Floors 1 & 3) and Floor_2_pure.jpg (Floor 2),
 * framing every room with real perimeter walls, panoramic windows,
 * glass dividers, and clear doorway portals while leaving the baked central
 * elevator shafts unobstructed.
 * Fully editable / bongkar-pasang in Edit Mode!
 */
export type BorderSegment = readonly [number, number, number, number];

/**
 * Architectural border lines measured directly from the pure JPGs (cyan glow
 * lines + white-nook / wood / dark-wing tile edges). The quarter-cell grid gets
 * a wall into the right cell; this final projection locks its baseline onto the
 * exact baked floor line so no partition floats in the middle of a room.
 */
export const FLOOR_BORDER_SEGMENTS: Record<1 | 2 | 3, BorderSegment[]> = {
  1: [
    [0.032, 0.552, 0.491, 0.970], [0.195, 0.400, 0.662, 0.824],
    [0.824, 0.436, 0.966, 0.565], [0.587, 0.464, 0.689, 0.556],
    [0.429, 0.543, 0.517, 0.622], [0.032, 0.560, 0.203, 0.400],
    [0.186, 0.695, 0.355, 0.543], [0.522, 0.704, 0.689, 0.553],
    [0.331, 0.527, 0.433, 0.435], [0.509, 0.624, 0.592, 0.548],
    [0.487, 0.971, 0.966, 0.557], [0.384, 0.227, 0.496, 0.118],
    [0.496, 0.118, 0.622, 0.227], [0.384, 0.227, 0.496, 0.324],
    [0.496, 0.324, 0.622, 0.227], [0.192, 0.397, 0.384, 0.227],
    [0.622, 0.227, 0.966, 0.557]
  ],
  2: [
    [0.031, 0.548, 0.493, 0.967], [0.347, 0.542, 0.655, 0.822],
    [0.660, 0.290, 0.967, 0.570], [0.278, 0.323, 0.406, 0.439],
    [0.611, 0.665, 0.738, 0.780], [0.392, 0.493, 0.508, 0.598],
    [0.032, 0.561, 0.294, 0.323], [0.184, 0.701, 0.360, 0.540],
    [0.612, 0.678, 0.855, 0.457], [0.486, 0.973, 0.967, 0.560],
    [0.582, 0.374, 0.674, 0.290], [0.491, 0.596, 0.598, 0.500],
    [0.725, 0.776, 0.777, 0.728]
  ],
  3: []
};
FLOOR_BORDER_SEGMENTS[3] = FLOOR_BORDER_SEGMENTS[1];

export interface OuterPerimeterSegment {
  side: PerimeterSide;
  a: UVPoint;
  b: UVPoint;
}

/**
 * The four PURE outer edges of Floor_1_pure.jpg (also F3) and the concave
 * U-cutout outline of Floor_2_pure.jpg. In our 16x9 orthographic world the
 * user-facing X,Z formulas map as posX -> u, posZ -> v:
 *   NW: v =  m * u + c_NW   (m ~ -0.92)
 *   NE: v = -m * u + c_NE   (m ~ +0.92)
 * All outer wall bases are clamped here, never to an interior divider line.
 */
export const OUTER_PERIMETER_SEGMENTS: Record<1 | 2 | 3, OuterPerimeterSegment[]> = {
  1: [
    { side: 'NW', a: [0.031, 0.557], b: [0.496, 0.119] },
    { side: 'NE', a: [0.496, 0.119], b: [0.966, 0.557] },
    { side: 'SW', a: [0.031, 0.557], b: [0.496, 0.970] },
    { side: 'SE', a: [0.496, 0.970], b: [0.966, 0.557] }
  ],
  2: [
    { side: 'NW', a: [0.031, 0.557], b: [0.287, 0.323] },
    { side: 'NW', a: [0.287, 0.323], b: [0.399, 0.427] },
    { side: 'NE', a: [0.399, 0.427], b: [0.581, 0.386] },
    { side: 'NE', a: [0.581, 0.386], b: [0.668, 0.292] },
    { side: 'NE', a: [0.668, 0.292], b: [0.966, 0.557] },
    { side: 'SE', a: [0.966, 0.557], b: [0.727, 0.768] },
    { side: 'SE', a: [0.727, 0.768], b: [0.486, 0.969] },
    { side: 'SW', a: [0.486, 0.969], b: [0.187, 0.691] },
    { side: 'SW', a: [0.187, 0.691], b: [0.031, 0.557] }
  ],
  3: []
};
OUTER_PERIMETER_SEGMENTS[3] = OUTER_PERIMETER_SEGMENTS[1].map((s) => ({ ...s }));

// Register the pure outer edges as real floor lines for the audit / snap grid.
for (const fl of [1, 2, 3] as const) {
  for (const seg of OUTER_PERIMETER_SEGMENTS[fl]) {
    FLOOR_BORDER_SEGMENTS[fl].push([seg.a[0], seg.a[1], seg.b[0], seg.b[1]]);
  }
}

interface PerimeterProjection {
  u: number;
  v: number;
  side: PerimeterSide;
  t: number;
  d2Px: number;
}

/** projectToPerimeter(x, z, side): clamp a wall base to one pure outer edge. */
export function projectToPerimeter(
  floor: FloorId,
  u: number,
  v: number,
  side?: PerimeterSide
): PerimeterProjection | null {
  const PX_W = 2752;
  const PX_H = 1536;
  const px = u * PX_W;
  const py = v * PX_H;
  let best: PerimeterProjection | null = null;
  OUTER_PERIMETER_SEGMENTS[floor].forEach((seg, segmentIndex) => {
    if (side && seg.side !== side) return;
    const [u1, v1] = seg.a;
    const [u2, v2] = seg.b;
    const ax = u1 * PX_W;
    const ay = v1 * PX_H;
    const bx = u2 * PX_W;
    const by = v2 * PX_H;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const d2 = (px - cx) * (px - cx) + (py - cy) * (py - cy);
    if (!best || d2 < best.d2Px) {
      best = {
        u: Number((cx / PX_W).toFixed(4)),
        v: Number((cy / PX_H).toFixed(4)),
        side: seg.side,
        t: segmentIndex + t,
        d2Px: d2
      };
    }
  });
  return best;
}

function projectUVToBorder(floor: FloorId, u: number, v: number): { u: number; v: number } {
  const PX_W = 2752;
  const PX_H = 1536;
  const px = u * PX_W;
  const py = v * PX_H;
  let bestU = u;
  let bestV = v;
  let bestD2 = Infinity;

  for (const [u1, v1, u2, v2] of FLOOR_BORDER_SEGMENTS[floor]) {
    const ax = u1 * PX_W;
    const ay = v1 * PX_H;
    const bx = u2 * PX_W;
    const by = v2 * PX_H;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) continue;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const d2 = (px - cx) * (px - cx) + (py - cy) * (py - cy);
    if (d2 < bestD2) {
      bestD2 = d2;
      bestU = cx / PX_W;
      bestV = cy / PX_H;
    }
  }

  // 45 px at 2752x1536 (~22 px in the half-size audit render) is below the wall bezel width.
  return bestD2 <= 45 * 45
    ? { u: Number(bestU.toFixed(4)), v: Number(bestV.toFixed(4)) }
    : { u, v };
}

type UVPoint = readonly [number, number];

interface InteriorDividerSpec {
  a: UVPoint;
  b: UVPoint;
  /** Real nav doorway positions that must stay open along this divider. */
  portals?: UVPoint[];
  /** Render only the door portal(s), e.g. a short connector across a dark wing. */
  portalOnly?: boolean;
  /** Force a portal frame orientation when a divider is portal-only or hand-measured. */
  portalPieceId?: 'wall_18' | 'wall_19';
}

const D_TOP_NOOK: UVPoint = [0.447, 0.286];
const D_TOP_LEFT: UVPoint = [0.386, 0.486];
const D_MID_LEFT: UVPoint = [0.282, 0.474];
const D_BOTTOM_DESK: UVPoint = [0.512, 0.693];
const D_PANTRY: UVPoint = [0.611, 0.641];
const D_FAR_RIGHT: UVPoint = [0.745, 0.515];
const D_TOP_RIGHT: UVPoint = [0.632, 0.452];
const D_F2_SE_STUDIO: UVPoint = [0.671, 0.617];
const D_F2_WEST: UVPoint = [0.345, 0.482];
const D_F2_SE_FROM_HALL: UVPoint = [0.692, 0.672];

const F1_ELEV_W: UVPoint = [0.331, 0.527];
const F1_ELEV_NW: UVPoint = [0.433, 0.435];
const F1_ELEV_SE: UVPoint = [0.517, 0.622];
const F1_ELEV_NE: UVPoint = [0.592, 0.548];

/**
 * Interior room dividers measured on the pure floorplates. Unlike the outer
 * perimeter these lines previously carried only a few floating glass panes;
 * every span is now tiled with wall_07 / wall_09 panels and a wall_18 / wall_19
 * portal at each real nav doorway, up to the central elevator pillar.
 */
const INTERIOR_DIVIDER_SPECS: Record<1 | 2 | 3, InteriorDividerSpec[]> = {
  1: [
    { a: F1_NOOK_W, b: F1_ELEV_N, portals: [D_TOP_NOOK] },
    { a: F1_ELEV_N, b: F1_NOOK_E },
    { a: F1_WOOD_NW, b: F1_ELEV_W, portals: [D_MID_LEFT] },
    { a: F1_WOOD_NW, b: F1_INNER_W },
    { a: F1_ELEV_W, b: F1_ELEV_NW, portals: [D_TOP_LEFT] },
    { a: F1_MID_BOT_SW, b: F1_INNER_W },
    { a: F1_INNER_W, b: F1_BOT_PAN_SE, portals: [D_BOTTOM_DESK] },
    { a: F1_PAN_W, b: F1_PAN_N, portals: [D_PANTRY] },
    { a: F1_PAN_N, b: F1_GLOSSY_OUT, portals: [D_FAR_RIGHT] },
    { a: F1_ELEV_N, b: F1_PAN_N, portals: [D_TOP_RIGHT], portalOnly: true },
    { a: F1_ELEV_SE, b: F1_ELEV_NE }
  ],
  2: [
    { a: F2_WEST_APEX_N, b: F2_WEST_ELEV },
    { a: F2_MID_BOT_SW, b: F2_INNER_W },
    { a: F2_INNER_W, b: F2_BOT_PAN_SE, portals: [D_BOTTOM_DESK] },
    { a: F2_SE_DIV_SW, b: F2_SE_DIV_NE, portals: [D_F2_SE_STUDIO] },
    { a: [0.278, 0.323], b: [0.406, 0.439] },
    { a: [0.612, 0.678], b: [0.855, 0.457] },
    { a: [0.582, 0.374], b: [0.674, 0.290] },
    { a: [0.491, 0.596], b: [0.598, 0.500] },
    // Hand-measured F2 door dividers so every L2 doorway gets a real frame
    // and its neighbouring spans are tiled instead of left as cyan floor lines.
    { a: [0.287, 0.429], b: [0.406, 0.535], portals: [D_F2_WEST], portalPieceId: 'wall_19' },
    { a: [0.612, 0.746], b: [0.772, 0.599], portals: [D_F2_SE_FROM_HALL], portalPieceId: 'wall_18' },
    { a: [0.582, 0.406], b: [0.682, 0.498], portals: [D_TOP_RIGHT], portalPieceId: 'wall_19' }
  ],
  3: []
};
INTERIOR_DIVIDER_SPECS[3] = INTERIOR_DIVIDER_SPECS[1];

// Keep floor 3 border segments independent, then register every interior divider
// as a real floor line so snapWallLayout() cannot pull generated panels off it.
FLOOR_BORDER_SEGMENTS[3] = [...FLOOR_BORDER_SEGMENTS[1]];
for (const fl of [1, 2, 3] as const) {
  for (const spec of INTERIOR_DIVIDER_SPECS[fl]) {
    FLOOR_BORDER_SEGMENTS[fl].push([
      spec.a[0], spec.a[1], spec.b[0], spec.b[1]
    ]);
  }
}

// Door portals are nav-node anchors, not wall pixels: register a tiny border
// stub in both isometric directions so snap/audit keeps them exactly in place.
for (const [nodeId, node] of Object.entries(FLOOR_NAV_NODES)) {
  if (!nodeId.startsWith('door_')) continue;
  const floors = node.allowedFloors ?? [1, 2, 3];
  const du = GRID_DU * 0.09;
  const dv = GRID_DV * 0.09;
  for (const fl of floors) {
    FLOOR_BORDER_SEGMENTS[fl as 1 | 2 | 3].push([
      node.u - du, node.v - dv, node.u + du, node.v + dv
    ]);
    FLOOR_BORDER_SEGMENTS[fl as 1 | 2 | 3].push([
      node.u - du, node.v + dv, node.u + du, node.v - dv
    ]);
  }
}

const ELEVATOR_FOOTPRINT = { uMin: 0.425, uMax: 0.600, vMin: 0.315, vMax: 0.635 };
/**
 * Concave Floor 2 U-cutout outline measured from Floor_2_pure.jpg: the north
 * triangular notch around the elevator is void, while the central lift lobby,
 * both wings and the bottom desk remain walkable floor.
 */
const F2_FOOTPRINT_POLYGON: UVPoint[] = [
  [0.031, 0.557], [0.287, 0.323], [0.399, 0.427], [0.581, 0.386],
  [0.668, 0.292], [0.966, 0.557], [0.727, 0.768], [0.486, 0.969],
  [0.187, 0.691]
];
interface SpecGeometry {
  len: number;
  blocked: Array<[number, number]>;
  spans: Array<[number, number]>;
}

/** Contiguous parameter ranges where a predicate holds, converted to world distance. */
function sampledIntervals(
  predicate: (t: number) => boolean,
  len: number,
  pad = 0.04
): Array<[number, number]> {
  const step = 0.005;
  const steps = Math.round(1 / step);
  const out: Array<[number, number]> = [];
  let start: number | null = null;
  for (let i = 0; i <= steps; i++) {
    const t = i * step;
    const inside = predicate(t);
    if (inside && start === null) start = t;
    if (start !== null && (!inside || i === steps)) {
      const end = inside && i === steps ? 1 : t;
      out.push([Math.max(0, start * len - pad), Math.min(len, end * len + pad)]);
      start = null;
    }
  }
  return out;
}

function mergeIntervals(intervals: Array<[number, number]>): Array<[number, number]> {
  const sorted = [...intervals].sort((x, y) => x[0] - y[0]);
  const merged: Array<[number, number]> = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval[0] <= last[1]) last[1] = Math.max(last[1], interval[1]);
    else merged.push([...interval]);
  }
  return merged;
}

function computeSpecGeometry(floor: FloorId, spec: InteriorDividerSpec): SpecGeometry {
  const len = worldDistance(spec.a, spec.b);
  const portalTs = (spec.portals ?? []).map((p) => paramOnSegment(spec.a, spec.b, p));
  const blocked: Array<[number, number]> = portalTs.map((t) => [
    Math.max(0, t * len - PORTAL_HALF_W),
    Math.min(len, t * len + PORTAL_HALF_W)
  ]);
  // Carve the baked elevator shaft and the L2 U-cutout void as real breaks,
  // instead of dropping individual panels and leaving floating glass.
  blocked.push(...sampledIntervals((t) => {
    const q = lerpUV(spec.a, spec.b, t);
    return isElevatorFootprint(q.u, q.v);
  }, len, 0.04));
  if (floor === 2) {
    blocked.push(...sampledIntervals((t) => {
      const q = lerpUV(spec.a, spec.b, t);
      return !isOnFloor2Footprint(q.u, q.v);
    }, len, 0.12));
  }
  const merged = mergeIntervals(blocked);
  const spans: Array<[number, number]> = [];
  let cursor = 0;
  for (const [lo, hi] of merged) {
    if (lo - cursor >= PRECISE_MIN_TILE_SPAN) spans.push([cursor, lo]);
    cursor = Math.max(cursor, hi);
  }
  if (len - cursor >= PRECISE_MIN_TILE_SPAN) spans.push([cursor, len]);
  return { len, blocked: merged, spans };
}

export const PRECISE_SPEC_GEOMETRY: Record<string, SpecGeometry> = {};
for (const fl of [1, 2, 3] as const) {
  INTERIOR_DIVIDER_SPECS[fl].forEach((spec, idx) => {
    PRECISE_SPEC_GEOMETRY[`f${fl}-d${idx}`] = computeSpecGeometry(fl, spec);
  });
}
export const PRECISE_PORTAL_ONLY_SEGMENTS: string[] = [];
for (const fl of [1, 2, 3] as const) {
  INTERIOR_DIVIDER_SPECS[fl].forEach((spec, idx) => {
    if (spec.portalOnly) PRECISE_PORTAL_ONLY_SEGMENTS.push(`f${fl}-d${idx}`);
  });
}
/** Blocked world-distance intervals per interior segment, for the gap audit. */
export const PRECISE_CARVED_INTERVALS: Record<string, Array<[number, number]>> =
  Object.fromEntries(
    Object.entries(PRECISE_SPEC_GEOMETRY).map(([id, g]) => [id, g.blocked])
  );

/** Exact segment endpoints for the precision gap / overlap audit. */
export const PRECISE_TILE_SEGMENTS: Record<string, { a: UVPoint; b: UVPoint }> = {};
for (const fl of [1, 2, 3] as const) {
  for (const side of ['NW', 'NE'] as const) {
    const [a, b] = PRECISE_OUTER_ANCHORS[fl][side];
    PRECISE_TILE_SEGMENTS[`f${fl}-${side.toLowerCase()}`] = { a, b };
  }
  INTERIOR_DIVIDER_SPECS[fl].forEach((spec, idx) => {
    PRECISE_TILE_SEGMENTS[`f${fl}-d${idx}`] = { a: spec.a, b: spec.b };
  });
}

function worldDistance(a: UVPoint, b: UVPoint): number {
  return uvToWorld(a[0], a[1]).distanceTo(uvToWorld(b[0], b[1]));
}

function paramOnSegment(a: UVPoint, b: UVPoint, p: UVPoint): number {
  const A = uvToWorld(a[0], a[1]);
  const B = uvToWorld(b[0], b[1]);
  const P = uvToWorld(p[0], p[1]);
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return 0;
  return Math.max(0, Math.min(1, ((P.x - A.x) * dx + (P.y - A.y) * dy) / len2));
}

function isElevatorFootprint(u: number, v: number): boolean {
  return (
    u >= ELEVATOR_FOOTPRINT.uMin &&
    u <= ELEVATOR_FOOTPRINT.uMax &&
    v >= ELEVATOR_FOOTPRINT.vMin &&
    v <= ELEVATOR_FOOTPRINT.vMax
  );
}

/** Floor 2 U-cutout: reject panels whose centre is in the north void, allow border tolerance. */
function isOnFloor2Footprint(u: number, v: number): boolean {
  const probes: UVPoint[] = [
    [u, v],
    [u + 0.012, v], [u - 0.012, v],
    [u, v + 0.012], [u, v - 0.012]
  ];
  const inPolygon = (pu: number, pv: number): boolean => {
    let inside = false;
    for (let i = 0, j = F2_FOOTPRINT_POLYGON.length - 1; i < F2_FOOTPRINT_POLYGON.length; j = i++) {
      const [xi, yi] = F2_FOOTPRINT_POLYGON[i];
      const [xj, yj] = F2_FOOTPRINT_POLYGON[j];
      const crosses = yi > pv !== yj > pv;
      if (crosses && pu < ((xj - xi) * (pv - yi)) / (yj - yi + 1e-9) + xi) inside = !inside;
    }
    return inside;
  };
  return probes.some(([pu, pv]) => inPolygon(pu, pv));
}

/** Drop near-duplicate bases so generated panels replace the old sparse panes. */
function dedupeWallLayout(layout: DefaultWallPlacement[]): DefaultWallPlacement[] {
  // Precision rebuild wins over any legacy nearby panel; 1/2000 UV keeps
  // genuinely adjacent modules (a few px apart) from collapsing together.
  const ordered = [...layout].sort(
    (a, b) =>
      Number(!!b.precise) - Number(!!a.precise) ||
      Number(!!b.perimeterSide) - Number(!!a.perimeterSide)
  );
  const seen = new Set<string>();
  return ordered.filter((p) => {
    const key = `${p.floor}|${Math.round(p.u * 2000)}|${Math.round(p.v * 2000)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function snapWallLayout(layout: DefaultWallPlacement[]): DefaultWallPlacement[] {
  const projected = layout.map((entry) => {
    const isPortal = entry.pieceId === 'wall_18' || entry.pieceId === 'wall_19';
    if (isPortal) {
      return { ...entry, u: entry.u, v: entry.v, _perimeterParam: 0 } as DefaultWallPlacement & { _perimeterParam: number };
    }
    const grid = entry.precise
      ? { u: entry.u, v: entry.v }
      : snapUVToFloorGrid(entry.u, entry.v, 4);
    if (entry.perimeterSide) {
      const outer = projectToPerimeter(entry.floor, grid.u, grid.v, entry.perimeterSide);
      if (outer) {
        return {
          ...entry,
          u: outer.u,
          v: outer.v,
          _perimeterParam: outer.t
        } as DefaultWallPlacement & { _perimeterParam: number };
      }
    }
    if (entry.precise) {
      return { ...entry, u: entry.u, v: entry.v, _perimeterParam: 0 } as DefaultWallPlacement & { _perimeterParam: number };
    }
    const inner = projectUVToBorder(entry.floor, grid.u, grid.v);
    return { ...entry, u: inner.u, v: inner.v, _perimeterParam: 0 } as DefaultWallPlacement & { _perimeterParam: number };
  });

  // Deterministic back-to-front tie-breaker: further-back walls sort first,
  // front walls get the larger index so equal-footY neighbours never z-fight.
  const groups = new Map<string, Array<DefaultWallPlacement & { _perimeterParam: number }>>();
  for (const entry of projected) {
    if (!entry.perimeterSide) continue;
    const key = `${entry.floor}|${entry.perimeterSide}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(entry);
    groups.set(key, bucket);
  }
  for (const bucket of groups.values()) {
    bucket.sort(
      (a, b) =>
        uvToWorld(b.u, b.v).y - uvToWorld(a.u, a.v).y ||
        a._perimeterParam - b._perimeterParam
    );
    bucket.forEach((entry, idx) => {
      entry.perimeterIndex = idx;
      delete (entry as Partial<{ _perimeterParam: number }>)._perimeterParam;
    });
  }

  return projected.map((entry) => ({
    ...entry,
    u: Number(entry.u.toFixed(4)),
    v: Number(entry.v.toFixed(4))
  }));
}

export const DEFAULT_WALL_LAYOUT: DefaultWallPlacement[] = dedupeWallLayout(
  snapWallLayout([
    ...buildPreciseInteriorDividers(1),
    ...buildPreciseOuterPerimeter(1),
    ...buildPreciseInteriorDividers(2),
    ...buildPreciseOuterPerimeter(2),
    ...buildPreciseInteriorDividers(3),
    ...buildPreciseOuterPerimeter(3)
  ])
);
