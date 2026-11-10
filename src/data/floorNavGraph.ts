import * as THREE from 'three';
import { FloorId, NavNode, RoomDefinition, RoomZoneSpec } from '../types/office';

/**
 * Shared Diamond Grid UV <-> Three.js World Mapping (16x9 orthographic plane).
 * Calibrated directly to Floor_1_pure.jpg (Floors 1 & 3) & Floor_2_pure.jpg (Floor 2).
 */
export function uvToWorld(u: number, v: number): THREE.Vector2 {
  return new THREE.Vector2((u - 0.5) * 16, (0.5 - v) * 9);
}

export function worldToUV(x: number, y: number): { u: number; v: number } {
  return { u: x / 16 + 0.5, v: 0.5 - y / 9 };
}

/**
 * Measured room grid delta steps on Floor_1_pure.jpg / Floor_2_pure.jpg (2752x1536).
 * Diagonal pixel slope ~0.506 -> world slope ~0.510.
 */
export const GRID_DU = 0.145;
export const GRID_DV = 0.132;
export const ISO_WORLD_SLOPE = (GRID_DV * 9) / (GRID_DU * 16); // ~0.512

/**
 * Snaps any world position cleanly to the nearest isometric sub-grid point
 * matching Floor_1_pure.jpg / Floor_2_pure.jpg room lines.
 */
export function snapWorldToIsoGrid(worldPos: THREE.Vector2, subdivisions = 4): THREE.Vector2 {
  const { u, v } = worldToUV(worldPos.x, worldPos.y);
  const du = u - 0.5;
  const dv = v - 0.5;

  const dcPrime = 0.5 * (du / GRID_DU + dv / GRID_DV);
  const drPrime = 0.5 * (dv / GRID_DV - du / GRID_DU);

  const q = Math.max(1, subdivisions);
  const snappedDc = Math.round(dcPrime * q) / q;
  const snappedDr = Math.round(drPrime * q) / q;

  const su = 0.5 + (snappedDc - snappedDr) * GRID_DU;
  const sv = 0.5 + (snappedDc + snappedDr) * GRID_DV;
  return uvToWorld(su, sv);
}

/**
 * Shared Navigation Graph verified directly against real modular doorways & open walkways
 * on Floor_1_pure.jpg (Floors 1 & 3) and Floor_2_pure.jpg (Floor 2).
 * ZERO edges cross solid walls or step off Floor 2's U-cutout boundary!
 */
export const FLOOR_NAV_NODES: Record<string, NavNode> = {
  // === CENTRAL ELEVATOR RING CORRIDOR ===
  // Floor 1 & 3 have SW + SE elevator doors; Floor 2 has SW door ONLY (SE panel is solid steel)
  lift_lobby_l: {
    id: 'lift_lobby_l',
    u: 0.432,
    v: 0.572,
    neighbors: ['lift_inside_l', 'ring_w', 'ring_s']
  },
  lift_lobby_r: {
    id: 'lift_lobby_r',
    u: 0.588,
    v: 0.572,
    neighbors: ['lift_inside_r', 'ring_e', 'ring_s', 'ring_se']
  },
  lift_inside_l: {
    id: 'lift_inside_l',
    u: 0.474,
    v: 0.576,
    neighbors: ['lift_lobby_l']
  },
  lift_inside_r: {
    id: 'lift_inside_r',
    u: 0.550,
    v: 0.576,
    allowedFloors: [1, 3],
    neighbors: ['lift_lobby_r']
  },

  ring_w: {
    id: 'ring_w',
    u: 0.402,
    v: 0.515,
    neighbors: ['lift_lobby_l', 'door_top_left', 'door_f2_west']
  },
  ring_s: {
    id: 'ring_s',
    u: 0.514,
    v: 0.654,
    neighbors: ['lift_lobby_l', 'lift_lobby_r', 'door_bottom_desk', 'ring_se']
  },
  ring_e: {
    id: 'ring_e',
    u: 0.602,
    v: 0.486,
    neighbors: ['lift_lobby_r', 'door_top_right', 'corridor_e']
  },
  ring_se: {
    id: 'ring_se',
    u: 0.592,
    v: 0.622,
    neighbors: ['lift_lobby_r', 'ring_s', 'door_pantry', 'corridor_f2_se']
  },
  corridor_e: {
    id: 'corridor_e',
    u: 0.662,
    v: 0.530,
    allowedFloors: [1, 3],
    neighbors: ['ring_e', 'room_top_right', 'door_far_right']
  },

  // === FLOOR 1 & 3 DOORWAY CROSSINGS (Floor_1_pure.jpg) ===
  door_top_left: {
    id: 'door_top_left',
    u: 0.386,
    v: 0.486,
    allowedFloors: [1, 3],
    neighbors: ['ring_w', 'room_top_left']
  },
  door_top_nook: {
    id: 'door_top_nook',
    u: 0.447,
    v: 0.286,
    allowedFloors: [1, 3],
    neighbors: ['room_top_left', 'room_top_nook']
  },
  door_mid_left: {
    id: 'door_mid_left',
    u: 0.282,
    v: 0.474,
    allowedFloors: [1, 3],
    neighbors: ['room_top_left', 'room_mid_left']
  },
  door_pantry: {
    id: 'door_pantry',
    u: 0.611,
    v: 0.641,
    allowedFloors: [1, 3],
    neighbors: ['ring_se', 'room_pantry']
  },
  door_far_right: {
    id: 'door_far_right',
    u: 0.745,
    v: 0.515,
    allowedFloors: [1, 3],
    neighbors: ['corridor_e', 'room_far_right']
  },

  // === FLOOR 2 DOORWAY CROSSINGS (Floor_2_pure.jpg U-Cutout) ===
  door_f2_west: {
    id: 'door_f2_west',
    u: 0.345,
    v: 0.482,
    allowedFloors: [2],
    neighbors: ['ring_w', 'room_f2_west_north', 'room_f2_west_pod']
  },
  corridor_f2_se: {
    id: 'corridor_f2_se',
    u: 0.635,
    v: 0.692,
    allowedFloors: [2],
    neighbors: ['ring_se', 'room_f2_pantry', 'door_f2_se_from_hall']
  },
  door_f2_se_from_hall: {
    id: 'door_f2_se_from_hall',
    u: 0.692,
    v: 0.672,
    allowedFloors: [2],
    neighbors: ['corridor_f2_se', 'room_far_right']
  },
  door_f2_se_studio: {
    id: 'door_f2_se_studio',
    u: 0.671,
    v: 0.617,
    allowedFloors: [2],
    neighbors: ['room_top_right', 'room_far_right']
  },

  // === SHARED DOORWAYS (ALL FLOORS 1, 2, 3) ===
  door_bottom_desk: {
    id: 'door_bottom_desk',
    u: 0.512,
    v: 0.693,
    neighbors: ['ring_s', 'room_bottom_desk']
  },
  door_top_right: {
    id: 'door_top_right',
    u: 0.632,
    v: 0.452,
    neighbors: ['ring_e', 'room_top_right']
  },

  // === ROOM HUBS & INTERIOR WORKSTATIONS ===
  room_top_nook: {
    id: 'room_top_nook',
    u: 0.498,
    v: 0.228,
    allowedFloors: [1, 3],
    neighbors: ['door_top_nook']
  },
  room_top_left: {
    id: 'room_top_left',
    u: 0.322,
    v: 0.398,
    allowedFloors: [1, 3],
    neighbors: ['door_top_left', 'door_top_nook', 'door_mid_left']
  },
  room_mid_left: {
    id: 'room_mid_left',
    u: 0.178,
    v: 0.585,
    allowedFloors: [1, 3],
    neighbors: ['door_mid_left']
  },

  // Floor 2 West Wing Hubs (inside Floor_2_pure.jpg real grid footprint!)
  room_f2_west_north: {
    id: 'room_f2_west_north',
    u: 0.268,
    v: 0.422,
    allowedFloors: [2],
    neighbors: ['door_f2_west', 'room_f2_west_pod']
  },
  room_f2_west_pod: {
    id: 'room_f2_west_pod',
    u: 0.175,
    v: 0.588,
    allowedFloors: [2],
    neighbors: ['door_f2_west', 'room_f2_west_north']
  },

  // Shared Big Bottom Room (2,1) & South Alcove
  room_bottom_desk: {
    id: 'room_bottom_desk',
    u: 0.425,
    v: 0.798,
    neighbors: ['door_bottom_desk', 'desk_bottom_left', 'desk_bottom_right', 'room_south_alcove']
  },
  desk_bottom_left: {
    id: 'desk_bottom_left',
    u: 0.325,
    v: 0.722,
    neighbors: ['room_bottom_desk']
  },
  desk_bottom_right: {
    id: 'desk_bottom_right',
    u: 0.515,
    v: 0.808,
    neighbors: ['room_bottom_desk']
  },
  room_south_alcove: {
    id: 'room_south_alcove',
    u: 0.468,
    v: 0.875,
    neighbors: ['room_bottom_desk']
  },

  // Pantry (Floor 1 & 3 checkerboard; Floor 2 SE corridor)
  room_pantry: {
    id: 'room_pantry',
    u: 0.680,
    v: 0.692,
    allowedFloors: [1, 3],
    neighbors: ['door_pantry']
  },
  room_f2_pantry: {
    id: 'room_f2_pantry',
    u: 0.648,
    v: 0.725,
    allowedFloors: [2],
    neighbors: ['corridor_f2_se']
  },

  // East Wings (Glossy Tech + Matte Lounge / SE Studio)
  room_top_right: {
    id: 'room_top_right',
    u: 0.688,
    v: 0.438,
    neighbors: ['door_top_right', 'corridor_e', 'door_f2_se_studio']
  },
  room_far_right: {
    id: 'room_far_right',
    u: 0.818,
    v: 0.562,
    neighbors: ['door_far_right', 'door_f2_se_studio', 'door_f2_se_from_hall']
  }
};

export const ROOM_DEFINITIONS: Record<string, RoomDefinition> = {
  // === FLOOR 1: KANTOR KRA (Floor_1_pure.jpg) ===
  Floor1_BossRoom: {
    id: 'Floor1_BossRoom',
    floor: 1,
    label: 'Boss Office RAMA',
    navNodeId: 'room_top_left',
    u: 0.322,
    v: 0.398,
    faceUp: true
  },
  Floor1_Boardroom: {
    id: 'Floor1_Boardroom',
    floor: 1,
    label: 'Ruang Rapat MARTA ASBOS',
    navNodeId: 'room_mid_left',
    u: 0.178,
    v: 0.585,
    faceUp: true,
    faceLeft: true
  },
  Floor1_Desk1: {
    id: 'Floor1_Desk1',
    floor: 1,
    label: 'Workspace NARA (Backend)',
    navNodeId: 'desk_bottom_left',
    u: 0.322,
    v: 0.722,
    faceUp: true
  },
  Floor1_TripleDesk: {
    id: 'Floor1_TripleDesk',
    floor: 1,
    label: 'Publish Bay ARUNA',
    navNodeId: 'room_bottom_desk',
    u: 0.425,
    v: 0.798,
    faceUp: true
  },
  Floor1_Desk2: {
    id: 'Floor1_Desk2',
    floor: 1,
    label: 'Script Desk PUTRI',
    navNodeId: 'desk_bottom_right',
    u: 0.515,
    v: 0.808,
    faceUp: true
  },
  Floor1_Atrium: {
    id: 'Floor1_Atrium',
    floor: 1,
    label: 'South Showcase Lounge',
    navNodeId: 'room_south_alcove',
    u: 0.468,
    v: 0.875,
    faceUp: false
  },
  Floor1_ElevatorHub: {
    id: 'Floor1_ElevatorHub',
    floor: 1,
    label: 'Central Elevator Hub',
    navNodeId: 'ring_s',
    u: 0.514,
    v: 0.654,
    faceUp: false
  },
  Floor1_Pantry: {
    id: 'Floor1_Pantry',
    floor: 1,
    label: 'Pantry & Espresso FIZI',
    navNodeId: 'room_pantry',
    u: 0.680,
    v: 0.692,
    faceUp: true
  },
  Floor1_Studio: {
    id: 'Floor1_Studio',
    floor: 1,
    label: 'Podcast & Audio Booth',
    navNodeId: 'room_top_right',
    u: 0.692,
    v: 0.398,
    faceUp: true
  },
  Floor1_Lounge: {
    id: 'Floor1_Lounge',
    floor: 1,
    label: 'Community Lounge FIZI',
    navNodeId: 'room_far_right',
    u: 0.818,
    v: 0.562,
    faceLeft: true
  },

  // === FLOOR 2: STUDIO RAGA & QA LAB MEIMEI (Floor_2_pure.jpg U-Cutout) ===
  Floor2_RnDLab: {
    id: 'Floor2_RnDLab',
    floor: 2,
    label: 'Media Analysis & DNA Lab',
    navNodeId: 'room_f2_west_north',
    u: 0.268,
    v: 0.422,
    faceUp: true
  },
  Floor2_ResearchPod: {
    id: 'Floor2_ResearchPod',
    floor: 2,
    label: 'Hook & Story Research Pod',
    navNodeId: 'room_f2_west_pod',
    u: 0.175,
    v: 0.588,
    faceUp: true
  },
  Floor2_MultiMonitor: {
    id: 'Floor2_MultiMonitor',
    floor: 2,
    label: 'QA Frame Lab MEIMEI',
    navNodeId: 'room_bottom_desk',
    u: 0.425,
    v: 0.798,
    faceUp: true
  },
  Floor2_Atrium: {
    id: 'Floor2_Atrium',
    floor: 2,
    label: 'Motion Preview Lounge',
    navNodeId: 'room_south_alcove',
    u: 0.468,
    v: 0.875,
    faceUp: false
  },
  Floor2_DesignDesk: {
    id: 'Floor2_DesignDesk',
    floor: 2,
    label: 'Studio RAGA (Shotcraft & Voicebox)',
    navNodeId: 'room_top_right',
    u: 0.688,
    v: 0.438,
    faceUp: true
  },
  Floor2_Pantry: {
    id: 'Floor2_Pantry',
    floor: 2,
    label: 'R&D Break Bar',
    navNodeId: 'room_f2_pantry',
    u: 0.648,
    v: 0.725,
    faceUp: true
  },
  Floor2_CreativePod: {
    id: 'Floor2_CreativePod',
    floor: 2,
    label: 'Shorts 9:16 & Arcade Lounge',
    navNodeId: 'room_far_right',
    u: 0.818,
    v: 0.562,
    faceLeft: true
  },

  // === FLOOR 3: DIVISI FINANCE STANDALONE (Floor_1_pure.jpg) ===
  Floor3_Videotron: {
    id: 'Floor3_Videotron',
    floor: 3,
    label: 'Market Desk SANDI (BTC Videotron)',
    navNodeId: 'room_top_left',
    u: 0.322,
    v: 0.398,
    faceUp: true
  },
  Floor3_AlgoRoom: {
    id: 'Floor3_AlgoRoom',
    floor: 3,
    label: 'Macro & Sizing Conference',
    navNodeId: 'room_mid_left',
    u: 0.178,
    v: 0.585,
    faceUp: true
  },
  Floor3_TradingFloor: {
    id: 'Floor3_TradingFloor',
    floor: 3,
    label: 'Trading Pit MAEL (Plan Gate)',
    navNodeId: 'room_bottom_desk',
    u: 0.425,
    v: 0.798,
    faceUp: true
  },
  Floor3_Atrium: {
    id: 'Floor3_Atrium',
    floor: 3,
    label: 'South Risk Observatory',
    navNodeId: 'room_south_alcove',
    u: 0.468,
    v: 0.875,
    faceUp: false
  },
  Floor3_TreasuryVault: {
    id: 'Floor3_TreasuryVault',
    floor: 3,
    label: 'Monetisasi Aset JARJIT (Stock/Etsy)',
    navNodeId: 'room_top_right',
    u: 0.688,
    v: 0.438,
    faceUp: true
  },
  Floor3_AudioRoom: {
    id: 'Floor3_AudioRoom',
    floor: 3,
    label: 'Voicebox & Review Booth',
    navNodeId: 'room_pantry',
    u: 0.680,
    v: 0.692,
    faceUp: true
  },
  Floor3_Lounge: {
    id: 'Floor3_Lounge',
    floor: 3,
    label: 'Finance Strategy Lounge',
    navNodeId: 'room_far_right',
    u: 0.818,
    v: 0.562,
    faceLeft: true
  }
};

export const ROOM_ZONES: RoomZoneSpec[] = [
  // Floor 1 Zones
  {
    zoneId: 'F1_TopLeft',
    floor: 1,
    label: 'Boss Office RAMA',
    roomIds: ['Floor1_BossRoom'],
    polygonUV: [[0.384, 0.227], [0.506, 0.340], [0.350, 0.532], [0.201, 0.398]],
    doorSensors: [{ u: 0.386, v: 0.486 }, { u: 0.447, v: 0.286 }]
  },
  {
    zoneId: 'F1_MidLeft',
    floor: 1,
    label: 'Boardroom MARTA',
    roomIds: ['Floor1_Boardroom'],
    polygonUV: [[0.201, 0.398], [0.350, 0.532], [0.187, 0.691], [0.031, 0.555]],
    doorSensors: [{ u: 0.282, v: 0.474 }]
  },
  {
    zoneId: 'F1_BottomDesk',
    floor: 1,
    label: 'Open Desks NARA/ARUNA/PUTRI',
    roomIds: ['Floor1_Desk1', 'Floor1_TripleDesk', 'Floor1_Desk2', 'Floor1_Atrium'],
    polygonUV: [[0.350, 0.532], [0.645, 0.824], [0.486, 0.969], [0.187, 0.691]],
    doorSensors: [{ u: 0.512, v: 0.693 }]
  },
  {
    zoneId: 'F1_Pantry',
    floor: 1,
    label: 'Pantry & Espresso FIZI',
    roomIds: ['Floor1_Pantry'],
    polygonUV: [[0.547, 0.697], [0.690, 0.573], [0.818, 0.691], [0.645, 0.824]],
    doorSensors: [{ u: 0.611, v: 0.641 }]
  },
  {
    zoneId: 'F1_TopRight',
    floor: 1,
    label: 'Podcast Booth',
    roomIds: ['Floor1_Studio'],
    polygonUV: [[0.623, 0.241], [0.834, 0.446], [0.690, 0.573], [0.575, 0.455]],
    doorSensors: [{ u: 0.632, v: 0.452 }]
  },
  {
    zoneId: 'F1_FarRight',
    floor: 1,
    label: 'Community Lounge FIZI',
    roomIds: ['Floor1_Lounge'],
    polygonUV: [[0.834, 0.446], [0.967, 0.566], [0.818, 0.691], [0.690, 0.573]],
    doorSensors: [{ u: 0.745, v: 0.515 }]
  },

  // Floor 2 Zones (Floor_2_pure.jpg U-Cutout)
  {
    zoneId: 'F2_WestWing',
    floor: 2,
    label: 'Media & Research Lab',
    roomIds: ['Floor2_RnDLab', 'Floor2_ResearchPod'],
    polygonUV: [[0.287, 0.323], [0.399, 0.427], [0.350, 0.532], [0.187, 0.691], [0.030, 0.555]],
    doorSensors: [{ u: 0.345, v: 0.482 }]
  },
  {
    zoneId: 'F2_BottomDesk',
    floor: 2,
    label: 'QA Frame Lab MEIMEI',
    roomIds: ['Floor2_MultiMonitor', 'Floor2_Atrium'],
    polygonUV: [[0.350, 0.532], [0.645, 0.824], [0.486, 0.969], [0.187, 0.691]],
    doorSensors: [{ u: 0.512, v: 0.693 }]
  },
  {
    zoneId: 'F2_TopRight',
    floor: 2,
    label: 'Studio RAGA',
    roomIds: ['Floor2_DesignDesk'],
    polygonUV: [[0.668, 0.292], [0.830, 0.444], [0.621, 0.672], [0.581, 0.386]],
    doorSensors: [{ u: 0.632, v: 0.452 }, { u: 0.671, v: 0.617 }]
  },
  {
    zoneId: 'F2_CreativePod',
    floor: 2,
    label: 'Shorts 9:16 Studio',
    roomIds: ['Floor2_CreativePod', 'Floor2_Pantry'],
    polygonUV: [[0.830, 0.444], [0.968, 0.566], [0.727, 0.768], [0.621, 0.672]],
    doorSensors: [{ u: 0.671, v: 0.617 }, { u: 0.692, v: 0.672 }]
  },

  // Floor 3 Zones (Floor_1_pure.jpg Finance HQ)
  {
    zoneId: 'F3_TopLeft',
    floor: 3,
    label: 'Market Desk SANDI (BTC Videotron)',
    roomIds: ['Floor3_Videotron'],
    polygonUV: [[0.384, 0.227], [0.506, 0.340], [0.350, 0.532], [0.201, 0.398]],
    doorSensors: [{ u: 0.386, v: 0.486 }, { u: 0.447, v: 0.286 }]
  },
  {
    zoneId: 'F3_MidLeft',
    floor: 3,
    label: 'Macro & Sizing Conference',
    roomIds: ['Floor3_AlgoRoom'],
    polygonUV: [[0.201, 0.398], [0.350, 0.532], [0.187, 0.691], [0.031, 0.555]],
    doorSensors: [{ u: 0.282, v: 0.474 }]
  },
  {
    zoneId: 'F3_BottomDesk',
    floor: 3,
    label: 'Trading Pit MAEL',
    roomIds: ['Floor3_TradingFloor', 'Floor3_Atrium'],
    polygonUV: [[0.350, 0.532], [0.645, 0.824], [0.486, 0.969], [0.187, 0.691]],
    doorSensors: [{ u: 0.512, v: 0.693 }]
  },
  {
    zoneId: 'F3_AudioBooth',
    floor: 3,
    label: 'Voicebox & Review Booth',
    roomIds: ['Floor3_AudioRoom'],
    polygonUV: [[0.547, 0.697], [0.690, 0.573], [0.818, 0.691], [0.645, 0.824]],
    doorSensors: [{ u: 0.611, v: 0.641 }]
  },
  {
    zoneId: 'F3_Treasury',
    floor: 3,
    label: 'Monetisasi Aset JARJIT',
    roomIds: ['Floor3_TreasuryVault'],
    polygonUV: [[0.623, 0.241], [0.834, 0.446], [0.690, 0.573], [0.575, 0.455]],
    doorSensors: [{ u: 0.632, v: 0.452 }]
  },
  {
    zoneId: 'F3_Lounge',
    floor: 3,
    label: 'Finance Strategy Lounge',
    roomIds: ['Floor3_Lounge'],
    polygonUV: [[0.834, 0.446], [0.967, 0.566], [0.818, 0.691], [0.690, 0.573]],
    doorSensors: [{ u: 0.745, v: 0.515 }]
  }
];

export function getRoomById(roomId: string): RoomDefinition | undefined {
  return ROOM_DEFINITIONS[roomId];
}

export function getNodesForFloor(floor: FloorId): NavNode[] {
  return Object.values(FLOOR_NAV_NODES).filter(
    (n) => !n.allowedFloors || n.allowedFloors.includes(floor)
  );
}

export function findNearestNavNode(worldPos: THREE.Vector2, floor: FloorId): string {
  let bestId = 'ring_s';
  let bestDist = Infinity;
  for (const node of getNodesForFloor(floor)) {
    const p = uvToWorld(node.u, node.v);
    const d = worldPos.distanceTo(p);
    if (d < bestDist) {
      bestDist = d;
      bestId = node.id;
    }
  }
  return bestId;
}

export function findPathBetweenNodes(startId: string, endId: string, floor: FloorId): THREE.Vector2[] {
  const allowed = new Set(getNodesForFloor(floor).map((n) => n.id));
  if (!allowed.has(startId) || !allowed.has(endId)) {
    const fallback = FLOOR_NAV_NODES[endId] ?? FLOOR_NAV_NODES['ring_s'];
    return [uvToWorld(fallback.u, fallback.v)];
  }
  if (startId === endId) {
    const n = FLOOR_NAV_NODES[endId];
    return [uvToWorld(n.u, n.v)];
  }

  const open = new Set<string>([startId]);
  const cameFrom: Record<string, string> = {};
  const gScore: Record<string, number> = { [startId]: 0 };
  const fScore: Record<string, number> = {};
  const endPos = uvToWorld(FLOOR_NAV_NODES[endId].u, FLOOR_NAV_NODES[endId].v);
  fScore[startId] = uvToWorld(FLOOR_NAV_NODES[startId].u, FLOOR_NAV_NODES[startId].v).distanceTo(endPos);

  while (open.size > 0) {
    let curr = '';
    let bestF = Infinity;
    for (const id of open) {
      const f = fScore[id] ?? Infinity;
      if (f < bestF) {
        bestF = f;
        curr = id;
      }
    }

    if (curr === endId) {
      const path: THREE.Vector2[] = [];
      let trace: string | undefined = curr;
      while (trace) {
        const node = FLOOR_NAV_NODES[trace];
        path.unshift(uvToWorld(node.u, node.v));
        trace = cameFrom[trace];
      }
      return path;
    }

    open.delete(curr);
    const currNode = FLOOR_NAV_NODES[curr];
    const currPos = uvToWorld(currNode.u, currNode.v);

    for (const nbId of currNode.neighbors) {
      if (!allowed.has(nbId)) continue;
      const nbNode = FLOOR_NAV_NODES[nbId];
      const nbPos = uvToWorld(nbNode.u, nbNode.v);
      const tentativeG = (gScore[curr] ?? Infinity) + currPos.distanceTo(nbPos);
      if (tentativeG < (gScore[nbId] ?? Infinity)) {
        cameFrom[nbId] = curr;
        gScore[nbId] = tentativeG;
        fScore[nbId] = tentativeG + nbPos.distanceTo(endPos);
        open.add(nbId);
      }
    }
  }

  const endNode = FLOOR_NAV_NODES[endId];
  return [uvToWorld(endNode.u, endNode.v)];
}

export function pointInPolygonUV(u: number, v: number, poly: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    const intersect = yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
