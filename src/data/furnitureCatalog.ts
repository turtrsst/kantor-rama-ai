import { FloorId } from '../types/office';

export type SpriteSheetKey =
  | 'furniture'
  | 'furnitures_animated'
  | 'more_animated_props'
  | 'furnitures_static'
  | 'tileset_floor_wall';

export interface FurnitureDefMeta {
  id: string;
  name: string;
  category: 'OFFICE' | 'PANTRY & LOUNGE' | 'LAB & SERVER' | 'PET & DECOR' | 'TILES';
  sheet?: SpriteSheetKey;
  boxIdx: number;
  extraBoxIdxs?: number[];
  /** Custom pixel bounding boxes on the specified `sheet` */
  customBoxes?: Array<[number, number, number, number]>;
  /** Optional animation frames cropped from props_animations.png */
  propsAnimBoxes?: Array<[number, number, number, number]>;
  w: number;
  h: number;
  isPet?: boolean;
  speed?: number;
  fps?: number;
  layerBonus?: number;
}

export interface DefaultFurniturePlacement {
  itemId: string;
  floor: FloorId;
  u: number;
  v: number;
  flipX?: boolean;
}

/** Precise pixel bounding boxes on furniture_spritesheet.png (2752x1536) */
export const FURNITURE_BOXES_PX: Array<[number, number, number, number]> = [
  [115, 69, 466, 411],    // 0: boss desk
  [552, 81, 948, 404],    // 1: meeting table
  [1033, 91, 1348, 392],  // 2: it single desk
  [1415, 67, 1861, 409],  // 3: it cluster desk
  [1936, 77, 2299, 409],  // 4: studio desk
  [2398, 68, 2645, 410],  // 5: bookshelf & plant
  [124, 484, 467, 766],   // 6: pantry counter
  [660, 453, 832, 771],   // 7: fridge
  [1094, 475, 1287, 765], // 8: coffee machine
  [1451, 464, 1782, 772], // 9: brown sofa
  [1882, 527, 2249, 743], // 10: coffee table
  [2391, 457, 2577, 776], // 11: arcade machine
  [115, 821, 476, 1172],  // 12: lab bench
  [655, 819, 848, 1180],  // 13: dna hologram
  [1013, 845, 1375, 1155],// 14: molecule table
  [1534, 819, 1726, 1170],// 15: server rack
  [1941, 820, 2185, 1173],// 16: server glass wall
  [2285, 812, 2656, 1169],// 17: grey sofa & lamp
  [232, 1252, 365, 1442], // 18: pet cat idle
  [658, 1220, 846, 1448], // 19: pet cat walk
  [1103, 1215, 1293, 1460],// 20: pet dog idle
  [1528, 1237, 1735, 1458],// 21: pet dog walk
  [1922, 1222, 2207, 1437],// 22: pet drone
  [2416, 1219, 2560, 1456] // 23: trophy
];

/** Elevator door 4-frame coordinates on furnitures_animated.png / props_animations.png (2752x1536) */
export const ELEVATOR_DOOR_FRAMES_PX: Array<[number, number, number, number]> = [
  [104, 90, 250, 436],
  [418, 95, 250, 436],
  [743, 101, 250, 436],
  [1073, 108, 250, 436]
];

/** Sliding glass door 4-frame coordinates on furnitures_animated.png (2752x1536) */
export const SLIDING_DOOR_FRAMES_PX: Array<[number, number, number, number]> = [
  [1468, 116, 248, 376],
  [1764, 112, 256, 380],
  [2072, 116, 264, 388],
  [2380, 124, 284, 396]
];

export const FURNITURE_CATALOG_DEFS: FurnitureDefMeta[] = [
  { id: 'boss_desk',       name: '🪑 Boss Executive Desk', category: 'OFFICE',          boxIdx: 0,  w: 1.45, h: 1.15 },
  { id: 'meeting_table',   name: '🤝 Oval Meeting Table',  category: 'OFFICE',          boxIdx: 1,  w: 1.70, h: 1.32 },
  {
    id: 'holo_boardroom_table',
    name: '📊 3D Holo Chart Table',
    category: 'OFFICE',
    sheet: 'furnitures_animated',
    boxIdx: 0,
    customBoxes: [[112, 624, 352, 320], [568, 612, 356, 332], [996, 612, 356, 332]],
    w: 1.75,
    h: 1.45,
    fps: 1.4
  },
  {
    id: 'chart_whiteboard',
    name: '📈 Animated Chart Board',
    category: 'OFFICE',
    sheet: 'furnitures_animated',
    boxIdx: 0,
    customBoxes: [[1472, 584, 372, 340], [1904, 584, 348, 336], [2324, 584, 320, 336]],
    w: 1.45,
    h: 1.25,
    fps: 1.2
  },
  { id: 'it_single_desk',  name: '💻 IT Dev Workstation',  category: 'OFFICE',          boxIdx: 2,  w: 1.05, h: 0.92 },
  { id: 'it_cluster_desk', name: '🖥️ 4-Desk IT Cluster',   category: 'OFFICE',          boxIdx: 3,  w: 1.95, h: 1.48 },
  { id: 'studio_desk',     name: '🎙️ Audio Studio Desk',   category: 'OFFICE',          boxIdx: 4,  w: 1.38, h: 1.18 },
  {
    id: 'audio_eq_pad',
    name: '🎵 Cyan Audio EQ Ring',
    category: 'OFFICE',
    sheet: 'more_animated_props',
    boxIdx: 0,
    customBoxes: [
      [1420, 140, 305, 300],
      [1740, 140, 305, 300],
      [2060, 140, 305, 300],
      [2375, 140, 305, 300],
      [80, 550, 295, 340],
      [405, 550, 295, 340],
      [730, 550, 295, 340],
      [1055, 550, 295, 340]
    ],
    w: 1.15,
    h: 0.95,
    fps: 6.0,
    layerBonus: -40
  },
  {
    id: 'studio_mic',
    name: '🎤 Studio Condenser Mic',
    category: 'OFFICE',
    sheet: 'furnitures_static',
    boxIdx: 0,
    customBoxes: [[2480, 1124, 160, 296]],
    w: 0.45,
    h: 0.82
  },
  { id: 'bookshelf_plant', name: '🌿 Bookshelf & Plant',   category: 'OFFICE',          boxIdx: 5,  w: 0.85, h: 1.05 },

  { id: 'pantry_counter',  name: '🚰 Pantry Counter',      category: 'PANTRY & LOUNGE', boxIdx: 6,  w: 1.35, h: 1.02 },
  { id: 'fridge',          name: '🧊 Modern Fridge',       category: 'PANTRY & LOUNGE', boxIdx: 7,  w: 0.68, h: 1.08 },
  { id: 'coffee_machine',  name: '☕ Espresso Machine',    category: 'PANTRY & LOUNGE', boxIdx: 8,  w: 0.48, h: 0.58, layerBonus: 8 },
  { id: 'brown_sofa',      name: '🛋️ Brown Leather Sofa',  category: 'PANTRY & LOUNGE', boxIdx: 9,  w: 1.15, h: 0.88 },
  { id: 'coffee_table',    name: '🍵 Lounge Table & Rug',  category: 'PANTRY & LOUNGE', boxIdx: 10, w: 1.12, h: 0.78, layerBonus: -3 },
  {
    id: 'arcade_machine',
    name: '🕹️ Fireworks Arcade',
    category: 'PANTRY & LOUNGE',
    sheet: 'more_animated_props',
    boxIdx: 0,
    customBoxes: [
      [1400, 964, 332, 460],
      [1748, 964, 260, 460],
      [2076, 980, 272, 444],
      [2384, 1028, 228, 396]
    ],
    w: 0.82,
    h: 1.25,
    fps: 2.2
  },
  {
    id: 'restroom_stall',
    name: '🚽 Restroom Stall',
    category: 'PANTRY & LOUNGE',
    sheet: 'furnitures_static',
    boxIdx: 0,
    customBoxes: [[108, 1008, 328, 448]],
    w: 0.88,
    h: 1.18
  },
  {
    id: 'restroom_sink',
    name: '🧼 Restroom Sink',
    category: 'PANTRY & LOUNGE',
    sheet: 'furnitures_static',
    boxIdx: 0,
    customBoxes: [[548, 1056, 164, 364]],
    w: 0.48,
    h: 0.92
  },

  { id: 'lab_bench',       name: '🔬 Lab Workbench',       category: 'LAB & SERVER',    boxIdx: 12, w: 1.25, h: 1.02 },
  {
    id: 'lab_centrifuge',
    name: '🧪 Lab Centrifuge & Glass',
    category: 'LAB & SERVER',
    sheet: 'more_animated_props',
    boxIdx: 0,
    customBoxes: [
      [1432, 580, 344, 384],
      [2052, 592, 344, 372]
    ],
    w: 1.28,
    h: 1.12,
    fps: 1.5
  },
  { id: 'dna_hologram',    name: '🧬 DNA Helix Pod',       category: 'LAB & SERVER',    boxIdx: 13, w: 1.02, h: 1.52, fps: 2.2,
    propsAnimBoxes: [[1820, 568, 210, 386], [522, 1038, 210, 386]] },
  { id: 'molecule_table',  name: '⚛️ Molecule Holo Table', category: 'LAB & SERVER',    boxIdx: 14, w: 1.35, h: 1.12, fps: 1.8,
    propsAnimBoxes: [[2346, 636, 348, 318], [1530, 1094, 366, 318]] },
  { id: 'server_rack',     name: '🖧 LED Server Rack',      category: 'LAB & SERVER',    boxIdx: 15, w: 0.74, h: 1.25, fps: 2.5,
    propsAnimBoxes: [[852, 1044, 224, 386], [1186, 1044, 224, 386]] },
  { id: 'server_glass',    name: '🪟 Server Glass Wall',   category: 'LAB & SERVER',    boxIdx: 16, w: 1.10, h: 1.28 },
  { id: 'grey_sofa_lamp',  name: '🛋️ Grey Sofa & Lamp',    category: 'LAB & SERVER',    boxIdx: 17, w: 1.25, h: 1.02 },

  { id: 'pet_cat',         name: '🐱 Office Cat (Pet)',    category: 'PET & DECOR',     boxIdx: 18, extraBoxIdxs: [19], w: 0.48, h: 0.48, isPet: true, speed: 0.38, fps: 4.0 },
  { id: 'pet_dog',         name: '🐕 Cyber Dog (Pet)',     category: 'PET & DECOR',     boxIdx: 20, extraBoxIdxs: [21], w: 0.56, h: 0.56, isPet: true, speed: 0.45, fps: 4.5 },
  {
    id: 'pet_drone',
    name: '🛸 AI Mini Drone (4F)',
    category: 'PET & DECOR',
    sheet: 'more_animated_props',
    boxIdx: 0,
    customBoxes: [
      [148, 1092, 176, 264],
      [472, 1096, 180, 260],
      [792, 1092, 172, 264],
      [1116, 1088, 172, 260]
    ],
    w: 0.54,
    h: 0.68,
    isPet: true,
    speed: 0.60,
    fps: 6.0
  },
  { id: 'trophy',          name: '🏆 Golden Cyber Trophy', category: 'PET & DECOR',     boxIdx: 23, w: 0.52, h: 0.76 },

  // Floor Tiles from tileset_floor_wall.png
  {
    id: 'tile_tech_cyan',
    name: '💠 Neon Tech Tile',
    category: 'TILES',
    sheet: 'tileset_floor_wall',
    boxIdx: 0,
    customBoxes: [[104, 116, 284, 176]],
    w: 1.40,
    h: 0.88,
    layerBonus: -12
  },
  {
    id: 'tile_wood_parquet',
    name: '🪵 Wood Parquet Tile',
    category: 'TILES',
    sheet: 'tileset_floor_wall',
    boxIdx: 0,
    customBoxes: [[732, 112, 288, 180]],
    w: 1.40,
    h: 0.88,
    layerBonus: -12
  },
  {
    id: 'tile_white_clean',
    name: '⬜ Clean White Tile',
    category: 'TILES',
    sheet: 'tileset_floor_wall',
    boxIdx: 0,
    customBoxes: [[1372, 108, 324, 192]],
    w: 1.40,
    h: 0.88,
    layerBonus: -12
  }
];

export const DEFAULT_OFFICE_LAYOUT: DefaultFurniturePlacement[] = [
  // ================= FLOOR 1: OFFICE & CONTENT PIPELINE =================
  { itemId: 'boss_desk',       floor: 1, u: 0.315, v: 0.390, flipX: false },
  { itemId: 'bookshelf_plant', floor: 1, u: 0.355, v: 0.335, flipX: false },
  { itemId: 'trophy',          floor: 1, u: 0.242, v: 0.342, flipX: false },

  // Boardroom with upgraded 3D Holo Chart Table & Chart Whiteboard!
  { itemId: 'holo_boardroom_table', floor: 1, u: 0.215, v: 0.535, flipX: false },
  { itemId: 'chart_whiteboard',     floor: 1, u: 0.190, v: 0.505, flipX: false },

  // Studio Room
  { itemId: 'studio_desk',     floor: 1, u: 0.675, v: 0.375, flipX: false },
  { itemId: 'studio_mic',      floor: 1, u: 0.725, v: 0.365, flipX: false },

  // Open Desks / Modular Triple Desk
  { itemId: 'it_single_desk',  floor: 1, u: 0.355, v: 0.695, flipX: false },
  { itemId: 'it_cluster_desk', floor: 1, u: 0.435, v: 0.775, flipX: false },
  { itemId: 'it_single_desk',  floor: 1, u: 0.525, v: 0.785, flipX: true },

  // Pantry & Coffee Corner
  { itemId: 'pantry_counter',  floor: 1, u: 0.698, v: 0.662, flipX: true },
  { itemId: 'coffee_machine',  floor: 1, u: 0.693, v: 0.628, flipX: true },
  { itemId: 'fridge',          floor: 1, u: 0.746, v: 0.718, flipX: true },

  // Arcade Lounge
  { itemId: 'arcade_machine',  floor: 1, u: 0.755, v: 0.485, flipX: false },
  { itemId: 'arcade_machine',  floor: 1, u: 0.790, v: 0.455, flipX: false },
  { itemId: 'brown_sofa',      floor: 1, u: 0.865, v: 0.535, flipX: true },
  { itemId: 'coffee_table',    floor: 1, u: 0.830, v: 0.570, flipX: false },
  { itemId: 'brown_sofa',      floor: 1, u: 0.795, v: 0.605, flipX: false },
  { itemId: 'pet_cat',         floor: 1, u: 0.815, v: 0.545, flipX: false },

  // ================= FLOOR 2: LAB, RnD & MOTION DESIGN =================
  { itemId: 'lab_centrifuge',  floor: 2, u: 0.285, v: 0.355, flipX: false },
  { itemId: 'dna_hologram',    floor: 2, u: 0.335, v: 0.410, flipX: false },

  // AI Research Pod
  { itemId: 'lab_bench',       floor: 2, u: 0.205, v: 0.525, flipX: false },
  { itemId: 'it_single_desk',  floor: 2, u: 0.235, v: 0.575, flipX: false },

  // Floor 2 Restroom (Top Center White Tile Nook — furnished!)
  { itemId: 'restroom_stall',  floor: 2, u: 0.520, v: 0.205, flipX: false },
  { itemId: 'restroom_sink',   floor: 2, u: 0.470, v: 0.220, flipX: false },

  // Multi-Monitor & Molecule Lab
  { itemId: 'molecule_table',  floor: 2, u: 0.425, v: 0.765, flipX: false },
  { itemId: 'it_single_desk',  floor: 2, u: 0.355, v: 0.705, flipX: false },
  { itemId: 'it_single_desk',  floor: 2, u: 0.505, v: 0.785, flipX: true },
  { itemId: 'pet_dog',         floor: 2, u: 0.450, v: 0.710, flipX: false },

  // Design & Server Cluster
  { itemId: 'audio_eq_pad',    floor: 2, u: 0.700, v: 0.375, flipX: false },
  { itemId: 'server_rack',     floor: 2, u: 0.655, v: 0.335, flipX: false },
  { itemId: 'server_rack',     floor: 2, u: 0.695, v: 0.365, flipX: false },
  { itemId: 'server_rack',     floor: 2, u: 0.735, v: 0.395, flipX: false },
  { itemId: 'pet_drone',       floor: 2, u: 0.675, v: 0.415, flipX: false },

  // Tech Pantry F2
  { itemId: 'pantry_counter',  floor: 2, u: 0.698, v: 0.662, flipX: true },
  { itemId: 'fridge',          floor: 2, u: 0.746, v: 0.718, flipX: true },

  // Creative Shorts Pod
  { itemId: 'arcade_machine',  floor: 2, u: 0.765, v: 0.485, flipX: false },
  { itemId: 'grey_sofa_lamp',  floor: 2, u: 0.840, v: 0.560, flipX: true },

  // ================= FLOOR 3: FINANCE, EXNESS, BTC & AUDIO ROOM =================
  { itemId: 'it_cluster_desk', floor: 3, u: 0.325, v: 0.395, flipX: false },
  { itemId: 'trophy',          floor: 3, u: 0.375, v: 0.335, flipX: false },

  // Exness & Algo Analytics Room with Holo Table & Whiteboard
  { itemId: 'holo_boardroom_table', floor: 3, u: 0.215, v: 0.535, flipX: false },
  { itemId: 'chart_whiteboard',     floor: 3, u: 0.190, v: 0.505, flipX: false },

  // Trading Floor Desk Cluster
  { itemId: 'it_single_desk',  floor: 3, u: 0.355, v: 0.695, flipX: false },
  { itemId: 'it_cluster_desk', floor: 3, u: 0.435, v: 0.775, flipX: false },
  { itemId: 'it_single_desk',  floor: 3, u: 0.525, v: 0.785, flipX: true },

  // Treasury & Server Vault
  { itemId: 'server_rack',     floor: 3, u: 0.660, v: 0.340, flipX: false },
  { itemId: 'server_rack',     floor: 3, u: 0.705, v: 0.370, flipX: false },
  { itemId: 'boss_desk',       floor: 3, u: 0.692, v: 0.408, flipX: true },

  // Audio & Voicebox Room (Glowing Audio Equalizer Pad + Studio Desk + Mic!)
  { itemId: 'audio_eq_pad',    floor: 3, u: 0.680, v: 0.725, flipX: false },
  { itemId: 'studio_desk',     floor: 3, u: 0.700, v: 0.670, flipX: true },
  { itemId: 'studio_mic',      floor: 3, u: 0.665, v: 0.705, flipX: false },
  { itemId: 'bookshelf_plant', floor: 3, u: 0.640, v: 0.715, flipX: false },

  // Finance VIP Lounge
  { itemId: 'brown_sofa',      floor: 3, u: 0.865, v: 0.535, flipX: true },
  { itemId: 'coffee_table',    floor: 3, u: 0.830, v: 0.570, flipX: false },
  { itemId: 'brown_sofa',      floor: 3, u: 0.795, v: 0.605, flipX: false },
  { itemId: 'pet_cat',         floor: 3, u: 0.820, v: 0.550, flipX: false }
];
