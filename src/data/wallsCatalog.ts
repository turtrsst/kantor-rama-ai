import { snapUVToFloorGrid } from './floorNavGraph';
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
  /** Fraction from top of sprite to its visible top-centre edge. */
  topRatio: number;
  /** True when worldH was normalized to one shared architectural wall height. */
  normalizedHeight: boolean;
}

export interface DefaultWallPlacement {
  pieceId: string;
  floor: FloorId;
  u: number;
  v: number;
  flipX?: boolean;
}

/**
 * Exact bounding boxes from the cleaned, anti-aliased, checkerboard-free
 * public/assets/walls_spritesheet.png (1417x1029 RGBA).
 * Scale calibrated directly against Floor_1_pure.jpg & Floor_2_pure.jpg (2752x1536).
 */
const PX_PER_WORLD = 115.0;
/** All regular perimeter / partition walls share this visible height above the floor. */
export const WALL_VISIBLE_HEIGHT = 1.18;

function makeBox(
  id: string,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  anchorRatio: number,
  topRatio: number,
  keepNativeHeight = false
): WallBBoxMeta {
  const worldW = Number((w / PX_PER_WORLD).toFixed(3));
  const worldH = keepNativeHeight
    ? Number((h / PX_PER_WORLD).toFixed(3))
    : Number((WALL_VISIBLE_HEIGHT / (anchorRatio - topRatio)).toFixed(3));
  return {
    id,
    name,
    x,
    y,
    w,
    h,
    worldW,
    worldH,
    anchorRatio,
    topRatio,
    normalizedHeight: !keepNativeHeight
  };
}

export const WALL_BBOXES: WallBBoxMeta[] = [
  makeBox('wall_00', 'Corner Wall Dark Wide',   36,   82, 237, 198, 0.717, 0.0152),
  makeBox('wall_01', 'Corner Wall Dark Compact',  309,   95, 184, 185, 0.773, 0.0162),
  makeBox('wall_02', 'Glass Window 3-Pane',  529,   64, 190, 216, 0.773, 0.2269),
  makeBox('wall_03', 'Wood Panel Wall 4-Sec',  755,   36, 209, 244, 0.791, 0.2090),
  makeBox('wall_04', 'Wood Panel Wall 3-Sec', 1000,   49, 178, 231, 0.814, 0.1732),
  makeBox('wall_05', 'Straight Wall Dark Short', 1214,   77, 167, 203, 0.803, 0.2118),

  makeBox('wall_06', 'Corner Wall Dark Mid',   36,  515, 237, 200, 0.715, 0.0100),
  makeBox('wall_07', 'Half Wall + Glass',  309,  530, 133, 185, 0.822, 0.2054),
  makeBox('wall_08', 'Twin Glass Partitions',  478,  539, 194, 176, 0.949, 0.0455),
  makeBox('wall_09', 'Single Glass Pane A',  708,  570,  68, 145, 0.897, 0.1034),
  makeBox('wall_10', 'Single Glass Pane B',  812,  565,  63, 150, 0.913, 0.1067),
  makeBox('wall_11', 'Tall Structural Pillar',  911,  316,  81, 399, 0.977, 0.0075, true),
  makeBox('wall_12', 'Sensor Glass Doors R/G', 1028,  537, 156, 178, 0.870, 0.0000),
  makeBox('wall_13', 'Shutter Doorway Frame', 1220,  514, 100, 201, 0.905, 0.1244),

  makeBox('wall_14', 'Straight Wall Dark Long',   36,  751, 204, 242, 0.793, 0.1983),
  makeBox('wall_15', 'Elevator Hub (Red)',  276,  753, 195, 240, 0.985, 0.0083, true),
  makeBox('wall_16', 'Elevator Hub (Green)',  507,  764, 196, 229, 0.985, 0.0087, true),
  makeBox('wall_17', 'Executive Wood Door',  739,  827,  79, 166, 0.886, 0.1024),
  makeBox('wall_18', 'Open Door Frame SW',  854,  802, 126, 191, 0.853, 0.0995),
  makeBox('wall_19', 'Open Door Frame SE', 1016,  802, 123, 191, 0.853, 0.0942),
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
const F2_EAST_ELEV   = [0.581, 0.386] as const;
const F2_SE_DIV_SW   = [0.621, 0.672] as const;
const F2_SE_DIV_NE   = [0.830, 0.444] as const;
const F2_EAST_APEX   = [0.966, 0.557] as const;

function buildF1LikeWalls(floor: 1 | 3): DefaultWallPlacement[] {
  const isFinance = floor === 3;
  return [
    // 1. North White Tile Nook (0,0) perimeter
    { pieceId: 'wall_01', floor, u: F1_TOP_APEX[0], v: F1_TOP_APEX[1] + 0.004, flipX: false },
    { pieceId: 'wall_02', floor, ...lerpUV(F1_TOP_APEX, F1_NOOK_W, 0.56), flipX: false },
    { pieceId: 'wall_02', floor, ...lerpUV(F1_TOP_APEX, F1_NOOK_E, 0.54), flipX: true },

    // 2. TopLeft (1,0) NW back wall: Executive Wood (F1) or Corporate Dark Steel behind BTC Videotron (F3)
    {
      pieceId: isFinance ? 'wall_14' : 'wall_03',
      floor,
      ...lerpUV(F1_NOOK_W, F1_WOOD_NW, 0.29),
      flipX: isFinance
    },
    {
      pieceId: isFinance ? 'wall_14' : 'wall_03',
      floor,
      ...lerpUV(F1_NOOK_W, F1_WOOD_NW, 0.72),
      flipX: isFinance
    },

    // Partition & Open Doorways around (1,0): Top Nook <-> (1,0) and Elevator Hall <-> (1,0)
    { pieceId: 'wall_09', floor, ...lerpUV(F1_NOOK_W, F1_ELEV_N, 0.14), flipX: true },
    { pieceId: 'wall_19', floor, ...lerpUV(F1_NOOK_W, F1_ELEV_N, 0.52), flipX: false },
    { pieceId: 'wall_18', floor, u: 0.386, v: 0.486, flipX: false },

    // 3. MidLeft (2,0) NW panoramic window + Dark wall + (1,0)<->(2,0) doorway
    { pieceId: 'wall_02', floor, ...lerpUV(F1_WOOD_NW, F1_WEST_APEX, 0.34), flipX: false },
    { pieceId: 'wall_05', floor, ...lerpUV(F1_WOOD_NW, F1_WEST_APEX, 0.77), flipX: false },
    { pieceId: 'wall_09', floor, ...lerpUV(F1_WOOD_NW, F1_INNER_W, 0.16), flipX: true },
    { pieceId: 'wall_19', floor, ...lerpUV(F1_WOOD_NW, F1_INNER_W, 0.55), flipX: false },

    // 4. East Wing NE outer perimeter: TopRight (0,1) + FarRight (0,2)
    { pieceId: 'wall_14', floor, ...lerpUV(F1_NOOK_E, F1_GLOSSY_OUT, 0.25), flipX: false },
    { pieceId: 'wall_02', floor, ...lerpUV(F1_NOOK_E, F1_GLOSSY_OUT, 0.70), flipX: true },
    { pieceId: 'wall_14', floor, ...lerpUV(F1_GLOSSY_OUT, F1_EAST_APEX, 0.40), flipX: false },

    // 5. MidLeft <-> BottomDesk interior glass divider
    { pieceId: 'wall_07', floor, ...lerpUV(F1_MID_BOT_SW, F1_INNER_W, 0.28), flipX: false },
    { pieceId: 'wall_09', floor, ...lerpUV(F1_MID_BOT_SW, F1_INNER_W, 0.72), flipX: false },

    // 6. BottomDesk <-> Central Hallway glass partitions + Open Doorway SE clear of Elevator
    { pieceId: 'wall_09', floor, ...lerpUV(F1_INNER_W, F1_BOT_PAN_SE, 0.18), flipX: true },
    { pieceId: 'wall_09', floor, ...lerpUV(F1_INNER_W, F1_BOT_PAN_SE, 0.32), flipX: true },
    { pieceId: 'wall_19', floor, ...lerpUV(F1_INNER_W, F1_BOT_PAN_SE, 0.55), flipX: false },
    { pieceId: 'wall_10', floor, ...lerpUV(F1_INNER_W, F1_BOT_PAN_SE, 0.77), flipX: true },

    // 7. Checkerboard Pantry / Audio Booth <-> Central Hallway doorway & glass pane
    { pieceId: 'wall_18', floor, ...lerpUV(F1_PAN_W, F1_PAN_N, 0.44), flipX: false },
    { pieceId: 'wall_09', floor, ...lerpUV(F1_PAN_W, F1_PAN_N, 0.85), flipX: false }
  ];
}

function buildF2Walls(): DefaultWallPlacement[] {
  return [
    // 1. West Wing Top Apex & NW Outer Perimeter (Floor_2_pure.jpg U-Cutout)
    { pieceId: 'wall_01', floor: 2, u: F2_WEST_APEX_N[0], v: F2_WEST_APEX_N[1] + 0.004, flipX: false },
    { pieceId: 'wall_02', floor: 2, ...lerpUV(F2_WEST_APEX_N, F2_WEST_APEX, 0.25), flipX: false },
    { pieceId: 'wall_05', floor: 2, ...lerpUV(F2_WEST_APEX_N, F2_WEST_APEX, 0.54), flipX: false },
    { pieceId: 'wall_02', floor: 2, ...lerpUV(F2_WEST_APEX_N, F2_WEST_APEX, 0.81), flipX: false },
    // West Wing inner cutout wall running SE into Silver Elevator
    { pieceId: 'wall_14', floor: 2, ...lerpUV(F2_WEST_APEX_N, F2_WEST_ELEV, 0.52), flipX: false },

    // 2. West Research <-> Bottom QA Lab interior glass divider
    { pieceId: 'wall_07', floor: 2, ...lerpUV(F2_MID_BOT_SW, F2_INNER_W, 0.28), flipX: false },
    { pieceId: 'wall_09', floor: 2, ...lerpUV(F2_MID_BOT_SW, F2_INNER_W, 0.72), flipX: false },

    // 3. Bottom QA Lab MEIMEI <-> Central Hallway glass partitions + Open Doorway SE
    { pieceId: 'wall_09', floor: 2, ...lerpUV(F2_INNER_W, F2_BOT_PAN_SE, 0.18), flipX: true },
    { pieceId: 'wall_09', floor: 2, ...lerpUV(F2_INNER_W, F2_BOT_PAN_SE, 0.32), flipX: true },
    { pieceId: 'wall_19', floor: 2, ...lerpUV(F2_INNER_W, F2_BOT_PAN_SE, 0.55), flipX: false },
    { pieceId: 'wall_10', floor: 2, ...lerpUV(F2_INNER_W, F2_BOT_PAN_SE, 0.77), flipX: true },

    // 4. East Glossy Tech Wing (Studio RAGA) Apex, Inner Cutout Window & NE Perimeter
    { pieceId: 'wall_01', floor: 2, u: F2_EAST_APEX_N[0], v: F2_EAST_APEX_N[1] + 0.004, flipX: false },
    { pieceId: 'wall_02', floor: 2, ...lerpUV(F2_EAST_APEX_N, F2_EAST_ELEV, 0.46), flipX: false },
    { pieceId: 'wall_14', floor: 2, ...lerpUV(F2_EAST_APEX_N, F2_SE_DIV_NE, 0.32), flipX: false },
    { pieceId: 'wall_02', floor: 2, ...lerpUV(F2_EAST_APEX_N, F2_SE_DIV_NE, 0.76), flipX: true },
    { pieceId: 'wall_14', floor: 2, ...lerpUV(F2_SE_DIV_NE, F2_EAST_APEX, 0.40), flipX: false },

    // 5. Studio RAGA <-> Shorts 9:16 Studio glass partition + Open Doorway
    { pieceId: 'wall_18', floor: 2, ...lerpUV(F2_SE_DIV_SW, F2_SE_DIV_NE, 0.24), flipX: false },
    { pieceId: 'wall_02', floor: 2, ...lerpUV(F2_SE_DIV_SW, F2_SE_DIV_NE, 0.68), flipX: false }
  ];
}

/**
 * Custom architectural modular wall layout aligned pixel-for-pixel to
 * Floor_1_pure.jpg (Floors 1 & 3) and Floor_2_pure.jpg (Floor 2),
 * framing every room with real perimeter walls, panoramic windows,
 * glass dividers, and clear doorway portals while leaving the baked central
 * elevator shafts unobstructed.
 * Fully editable / bongkar-pasang in Edit Mode!
 */
type BorderSegment = readonly [number, number, number, number];

/**
 * Architectural border lines measured directly from the pure JPGs (cyan glow
 * lines + white-nook / wood / dark-wing tile edges). The quarter-cell grid gets
 * a wall into the right cell; this final projection locks its baseline onto the
 * exact baked floor line so no partition floats in the middle of a room.
 */
const FLOOR_BORDER_SEGMENTS: Record<1 | 2 | 3, BorderSegment[]> = {
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

/** Snaps every default wall base to the calibrated grid, then locks it onto a real floor line. */
function snapWallLayout(layout: DefaultWallPlacement[]): DefaultWallPlacement[] {
  return layout.map((entry) => {
    const grid = snapUVToFloorGrid(entry.u, entry.v, 4);
    const snapped = projectUVToBorder(entry.floor, grid.u, grid.v);
    return {
      ...entry,
      u: Number(snapped.u.toFixed(4)),
      v: Number(snapped.v.toFixed(4))
    };
  });
}

export const DEFAULT_WALL_LAYOUT: DefaultWallPlacement[] = [
  ...snapWallLayout(buildF1LikeWalls(1)),
  ...snapWallLayout(buildF2Walls()),
  ...snapWallLayout(buildF1LikeWalls(3))
];
