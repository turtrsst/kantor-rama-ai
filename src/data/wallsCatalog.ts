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
 */
const PX_PER_WORLD = 115.0;

function makeBox(id: string, name: string, x: number, y: number, w: number, h: number): WallBBoxMeta {
  return {
    id,
    name,
    x,
    y,
    w,
    h,
    worldW: Number((w / PX_PER_WORLD).toFixed(3)),
    worldH: Number((h / PX_PER_WORLD).toFixed(3))
  };
}

export const WALL_BBOXES: WallBBoxMeta[] = [
  makeBox('wall_00', 'Corner Wall Dark Wide',     36,  82, 237, 198),
  makeBox('wall_01', 'Corner Wall Dark Compact',  309,  95, 184, 185),
  makeBox('wall_02', 'Glass Window 3-Pane',       529,  64, 190, 216),
  makeBox('wall_03', 'Wood Panel Wall 4-Sec',     755,  36, 209, 244),
  makeBox('wall_04', 'Wood Panel Wall 3-Sec',    1000,  49, 178, 231),
  makeBox('wall_05', 'Straight Wall Dark Short', 1214,  77, 167, 203),

  makeBox('wall_06', 'Corner Wall Dark Mid',      36, 515, 237, 200),
  makeBox('wall_07', 'Half Wall + Glass',        309, 530, 133, 185),
  makeBox('wall_08', 'Twin Glass Partitions',    478, 539, 194, 176),
  makeBox('wall_09', 'Single Glass Pane A',      708, 570,  68, 145),
  makeBox('wall_10', 'Single Glass Pane B',      812, 565,  63, 150),
  makeBox('wall_11', 'Tall Structural Pillar',   911, 316,  81, 399),
  makeBox('wall_12', 'Sensor Glass Doors R/G',  1028, 537, 156, 178),
  makeBox('wall_13', 'Shutter Doorway Frame',   1220, 514, 100, 201),

  makeBox('wall_14', 'Straight Wall Dark Long',   36, 751, 204, 242),
  makeBox('wall_15', 'Elevator Hub (Red)',       276, 753, 195, 240),
  makeBox('wall_16', 'Elevator Hub (Green)',     507, 764, 196, 229),
  makeBox('wall_17', 'Executive Wood Door',      739, 827,  79, 166),
  makeBox('wall_18', 'Open Door Frame SW',       854, 802, 126, 191),
  makeBox('wall_19', 'Open Door Frame SE',      1016, 802, 123, 191),
];

/**
 * Clean modular wall accents placed thoughtfully so they never block
 * base room doorways or Floor 3's Live BTC Videotron screen.
 * Additional walls can be added/dragged/flipped/deleted in Edit Layout mode.
 */
export const DEFAULT_WALL_LAYOUT: DefaultWallPlacement[] = [
  // Floor 1: Sleek glass cubicle divider clear of BottomDesk door (0.460, 0.696)
  { pieceId: 'wall_09', floor: 1, u: 0.390, v: 0.750, flipX: false },

  // Floor 2: Sleek glass lab divider between workstation & Molecule table
  { pieceId: 'wall_09', floor: 2, u: 0.390, v: 0.750, flipX: false },

  // Floor 3: Trading bay glass partitions completely clear of BottomDesk doorway jambs
  { pieceId: 'wall_09', floor: 3, u: 0.390, v: 0.750, flipX: false },
  { pieceId: 'wall_10', floor: 3, u: 0.556, v: 0.790, flipX: false }
];
