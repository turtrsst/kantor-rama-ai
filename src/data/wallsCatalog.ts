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

function makeBox(
  id: string,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  anchorRatio: number
): WallBBoxMeta {
  return {
    id,
    name,
    x,
    y,
    w,
    h,
    worldW: Number((w / PX_PER_WORLD).toFixed(3)),
    worldH: Number((h / PX_PER_WORLD).toFixed(3)),
    anchorRatio
  };
}

export const WALL_BBOXES: WallBBoxMeta[] = [
  makeBox('wall_00', 'Corner Wall Dark Wide',     36,  82, 237, 198, 0.717),
  makeBox('wall_01', 'Corner Wall Dark Compact',  309,  95, 184, 185, 0.773),
  makeBox('wall_02', 'Glass Window 3-Pane',       529,  64, 190, 216, 0.773),
  makeBox('wall_03', 'Wood Panel Wall 4-Sec',     755,  36, 209, 244, 0.791),
  makeBox('wall_04', 'Wood Panel Wall 3-Sec',    1000,  49, 178, 231, 0.814),
  makeBox('wall_05', 'Straight Wall Dark Short', 1214,  77, 167, 203, 0.803),

  makeBox('wall_06', 'Corner Wall Dark Mid',      36, 515, 237, 200, 0.715),
  makeBox('wall_07', 'Half Wall + Glass',        309, 530, 133, 185, 0.822),
  makeBox('wall_08', 'Twin Glass Partitions',    478, 539, 194, 176, 0.949),
  makeBox('wall_09', 'Single Glass Pane A',      708, 570,  68, 145, 0.897),
  makeBox('wall_10', 'Single Glass Pane B',      812, 565,  63, 150, 0.913),
  makeBox('wall_11', 'Tall Structural Pillar',   911, 316,  81, 399, 0.977),
  makeBox('wall_12', 'Sensor Glass Doors R/G',  1028, 537, 156, 178, 0.870),
  makeBox('wall_13', 'Shutter Doorway Frame',   1220, 514, 100, 201, 0.905),

  makeBox('wall_14', 'Straight Wall Dark Long',   36, 751, 204, 242, 0.793),
  makeBox('wall_15', 'Elevator Hub (Red)',       276, 753, 195, 240, 0.985),
  makeBox('wall_16', 'Elevator Hub (Green)',     507, 764, 196, 229, 0.985),
  makeBox('wall_17', 'Executive Wood Door',      739, 827,  79, 166, 0.886),
  makeBox('wall_18', 'Open Door Frame SW',       854, 802, 126, 191, 0.853),
  makeBox('wall_19', 'Open Door Frame SE',      1016, 802, 123, 191, 0.853),
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

// Measured exact vertices on Floor_1_pure.jpg (Floors 1 & 3)
const F1_TOP_APEX   = [0.496, 0.119] as const;
const F1_NOOK_W     = [0.384, 0.227] as const;
const F1_NOOK_E     = [0.623, 0.241] as const;
const F1_WOOD_NW    = [0.201, 0.398] as const;
const F1_WEST_APEX  = [0.031, 0.555] as const;
const F1_MID_BOT_SW = [0.187, 0.691] as const;
const F1_INNER_W    = [0.350, 0.532] as const;
const F1_BOT_PAN_SE = [0.645, 0.824] as const;
const F1_PAN_N      = [0.690, 0.573] as const;
const F1_PAN_W      = [0.547, 0.697] as const;
const F1_GLOSSY_OUT = [0.834, 0.446] as const;
const F1_EAST_APEX  = [0.967, 0.566] as const;
const F1_ELEV_N     = [0.506, 0.340] as const;

// Measured exact vertices on Floor_2_pure.jpg (Floor 2 U-Cutout)
const F2_WEST_APEX_N = [0.287, 0.323] as const;
const F2_WEST_ELEV   = [0.399, 0.427] as const;
const F2_WEST_APEX   = [0.030, 0.555] as const;
const F2_MID_BOT_SW  = [0.187, 0.691] as const;
const F2_INNER_W     = [0.350, 0.532] as const;
const F2_BOT_PAN_SE  = [0.645, 0.824] as const;
const F2_EAST_APEX_N = [0.668, 0.292] as const;
const F2_EAST_ELEV   = [0.581, 0.386] as const;
const F2_SE_DIV_SW   = [0.621, 0.672] as const;
const F2_SE_DIV_NE   = [0.830, 0.444] as const;
const F2_EAST_APEX   = [0.968, 0.566] as const;

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
export const DEFAULT_WALL_LAYOUT: DefaultWallPlacement[] = [
  ...buildF1LikeWalls(1),
  ...buildF2Walls(),
  ...buildF1LikeWalls(3)
];
