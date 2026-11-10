import * as THREE from 'three';
import { FloorId, NavNode, RoomDefinition, RoomZoneSpec } from '../types/office';

/**
 * Shared Diamond Grid UV <-> Three.js World Mapping (16x9 orthographic plane).
 */
export function uvToWorld(u: number, v: number): THREE.Vector2 {
  return new THREE.Vector2((u - 0.5) * 16, (0.5 - v) * 9);
}

export function worldToUV(x: number, y: number): { u: number; v: number } {
  return { u: x / 16 + 0.5, v: 0.5 - y / 9 };
}

/**
 * Shared Navigation Graph verified directly against real doorways & tiled hallways
 * on floor_1_base.png, floor_2_expansion.png, and floor_3_finance.png.
 * ZERO edges cross solid walls!
 */
export const FLOOR_NAV_NODES: Record<string, NavNode> = {
  // === CENTRAL ELEVATOR RING CORRIDOR (U-shaped walkway around shaft) ===
  lift_lobby_l: { id: 'lift_lobby_l', u: 0.436, v: 0.550, neighbors: ['lift_inside_l', 'ring_w', 'ring_s'] },
  lift_lobby_r: { id: 'lift_lobby_r', u: 0.576, v: 0.550, neighbors: ['lift_inside_r', 'ring_e', 'ring_s', 'ring_se'] },
  lift_inside_l: { id: 'lift_inside_l', u: 0.475, v: 0.532, neighbors: ['lift_lobby_l'] },
  lift_inside_r: { id: 'lift_inside_r', u: 0.546, v: 0.532, neighbors: ['lift_lobby_r'] },

  ring_w: { id: 'ring_w', u: 0.416, v: 0.482, neighbors: ['lift_lobby_l', 'door_top_left'] },
  ring_s: { id: 'ring_s', u: 0.496, v: 0.606, neighbors: ['lift_lobby_l', 'lift_lobby_r', 'corridor_bottom', 'ring_se'] },
  corridor_bottom: { id: 'corridor_bottom', u: 0.482, v: 0.668, neighbors: ['ring_s', 'door_bottom_desk'] },
  ring_e: { id: 'ring_e', u: 0.596, v: 0.486, neighbors: ['lift_lobby_r', 'door_top_right', 'corridor_e'] },
  ring_se: { id: 'ring_se', u: 0.584, v: 0.624, neighbors: ['lift_lobby_r', 'ring_s', 'door_pantry'] },
  corridor_e: {
    id: 'corridor_e',
    u: 0.695,
    v: 0.538,
    neighbors: ['ring_e', 'arch_far_right_f12', 'door_far_right_f3_out']
  },

  // === REAL ARCHITECTURAL DOORWAYS (PERPENDICULAR THRESHOLD CROSSINGS) ===
  door_top_left: { id: 'door_top_left', u: 0.374, v: 0.436, neighbors: ['ring_w', 'room_top_left'] },
  door_mid_left_in: { id: 'door_mid_left_in', u: 0.302, v: 0.492, neighbors: ['room_top_left', 'door_mid_left'] },
  door_mid_left: { id: 'door_mid_left', u: 0.254, v: 0.540, neighbors: ['door_mid_left_in', 'room_mid_left'] },
  door_bottom_desk: { id: 'door_bottom_desk', u: 0.438, v: 0.718, neighbors: ['corridor_bottom', 'room_bottom_desk'] },
  door_pantry: { id: 'door_pantry', u: 0.648, v: 0.684, neighbors: ['ring_se', 'room_pantry'] },
  door_top_right: { id: 'door_top_right', u: 0.642, v: 0.436, neighbors: ['ring_e', 'room_top_right'] },
  door_top_nook: { id: 'door_top_nook', u: 0.576, v: 0.312, neighbors: ['room_top_right', 'room_top_nook'] },
  arch_far_right_f12: {
    id: 'arch_far_right_f12',
    u: 0.742,
    v: 0.555,
    allowedFloors: [1, 2],
    neighbors: ['corridor_e', 'room_far_right']
  },
  door_far_right_f3_out: {
    id: 'door_far_right_f3_out',
    u: 0.748,
    v: 0.478,
    allowedFloors: [3],
    neighbors: ['corridor_e', 'door_far_right_f3']
  },
  door_far_right_f3: {
    id: 'door_far_right_f3',
    u: 0.790,
    v: 0.522,
    allowedFloors: [3],
    neighbors: ['door_far_right_f3_out', 'room_far_right']
  },

  // === ROOM HUBS & INTERIOR WORKSTATIONS ===
  room_top_left: { id: 'room_top_left', u: 0.320, v: 0.335, neighbors: ['door_top_left', 'door_mid_left_in'] },
  room_top_nook: { id: 'room_top_nook', u: 0.500, v: 0.230, neighbors: ['door_top_nook'] },
  room_mid_left: { id: 'room_mid_left', u: 0.215, v: 0.525, neighbors: ['door_mid_left'] },
  room_bottom_desk: {
    id: 'room_bottom_desk',
    u: 0.415,
    v: 0.710,
    neighbors: ['door_bottom_desk', 'desk_bottom_left', 'desk_bottom_right']
  },
  desk_bottom_left: { id: 'desk_bottom_left', u: 0.345, v: 0.715, neighbors: ['room_bottom_desk'] },
  desk_bottom_right: { id: 'desk_bottom_right', u: 0.515, v: 0.755, neighbors: ['room_bottom_desk'] },
  room_pantry: { id: 'room_pantry', u: 0.675, v: 0.675, neighbors: ['door_pantry'] },
  room_top_right: {
    id: 'room_top_right',
    u: 0.685,
    v: 0.345,
    neighbors: ['door_top_right', 'door_top_nook']
  },
  room_far_right: {
    id: 'room_far_right',
    u: 0.825,
    v: 0.525,
    neighbors: ['arch_far_right_f12', 'door_far_right_f3']
  }
};

export const ROOM_DEFINITIONS: Record<string, RoomDefinition> = {
  // === FLOOR 1: KANTOR KRA (RAMA, MARTA, NARA, PUTRI, ARUNA, FIZI) ===
  Floor1_BossRoom: {
    id: 'Floor1_BossRoom',
    floor: 1,
    label: 'Boss Office RAMA',
    navNodeId: 'room_top_left',
    u: 0.312,
    v: 0.365,
    faceUp: true
  },
  Floor1_Boardroom: {
    id: 'Floor1_Boardroom',
    floor: 1,
    label: 'Ruang Rapat MARTA ASBOS',
    navNodeId: 'room_mid_left',
    u: 0.215,
    v: 0.525,
    faceUp: true,
    faceLeft: true
  },
  Floor1_Desk1: {
    id: 'Floor1_Desk1',
    floor: 1,
    label: 'Workspace NARA (Backend)',
    navNodeId: 'desk_bottom_left',
    u: 0.352,
    v: 0.698,
    faceUp: true
  },
  Floor1_Desk2: {
    id: 'Floor1_Desk2',
    floor: 1,
    label: 'Script Desk PUTRI',
    navNodeId: 'desk_bottom_right',
    u: 0.522,
    v: 0.778,
    faceUp: true
  },
  Floor1_TripleDesk: {
    id: 'Floor1_TripleDesk',
    floor: 1,
    label: 'Publish Bay ARUNA',
    navNodeId: 'room_bottom_desk',
    u: 0.435,
    v: 0.768,
    faceUp: true
  },
  Floor1_ElevatorHub: {
    id: 'Floor1_ElevatorHub',
    floor: 1,
    label: 'Central Elevator Hub',
    navNodeId: 'ring_s',
    u: 0.495,
    v: 0.592,
    faceUp: false
  },
  Floor1_Pantry: {
    id: 'Floor1_Pantry',
    floor: 1,
    label: 'Pantry & Espresso FIZI',
    navNodeId: 'room_pantry',
    u: 0.670,
    v: 0.680,
    faceUp: false
  },
  Floor1_Studio: {
    id: 'Floor1_Studio',
    floor: 1,
    label: 'Podcast & Audio Booth',
    navNodeId: 'room_top_right',
    u: 0.685,
    v: 0.325,
    faceUp: true
  },
  Floor1_Lounge: {
    id: 'Floor1_Lounge',
    floor: 1,
    label: 'Community Lounge FIZI',
    navNodeId: 'room_far_right',
    u: 0.820,
    v: 0.525,
    faceLeft: true
  },

  // === FLOOR 2: STUDIO RAGA, QA LAB MEIMEI & SHORTS ===
  Floor2_RnDLab: {
    id: 'Floor2_RnDLab',
    floor: 2,
    label: 'Media Analysis & DNA Lab',
    navNodeId: 'room_top_left',
    u: 0.268,
    v: 0.355,
    faceUp: true
  },
  Floor2_ResearchPod: {
    id: 'Floor2_ResearchPod',
    floor: 2,
    label: 'Hook & Story Research Pod',
    navNodeId: 'room_mid_left',
    u: 0.215,
    v: 0.515,
    faceUp: true
  },
  Floor2_MultiMonitor: {
    id: 'Floor2_MultiMonitor',
    floor: 2,
    label: 'QA Frame Lab MEIMEI',
    navNodeId: 'room_bottom_desk',
    u: 0.465,
    v: 0.775,
    faceUp: true
  },
  Floor2_DesignDesk: {
    id: 'Floor2_DesignDesk',
    floor: 2,
    label: 'Studio RAGA (Shotcraft & Voicebox)',
    navNodeId: 'room_top_right',
    u: 0.720,
    v: 0.365,
    faceUp: true
  },
  Floor2_Pantry: {
    id: 'Floor2_Pantry',
    floor: 2,
    label: 'R&D Break Bar',
    navNodeId: 'room_pantry',
    u: 0.665,
    v: 0.675,
    faceUp: false
  },
  Floor2_CreativePod: {
    id: 'Floor2_CreativePod',
    floor: 2,
    label: 'Shorts 9:16 & Arcade Lounge',
    navNodeId: 'room_far_right',
    u: 0.820,
    v: 0.525,
    faceLeft: true
  },

  // === FLOOR 3: DIVISI FINANCE STANDALONE (SANDI, MAEL, JARJIT + EXNESS) ===
  Floor3_Videotron: {
    id: 'Floor3_Videotron',
    floor: 3,
    label: 'Market Desk SANDI (Read-Only)',
    navNodeId: 'room_top_left',
    u: 0.315,
    v: 0.345,
    faceUp: true
  },
  Floor3_AlgoRoom: {
    id: 'Floor3_AlgoRoom',
    floor: 3,
    label: 'Macro & Sizing Conference',
    navNodeId: 'room_mid_left',
    u: 0.215,
    v: 0.515,
    faceUp: true
  },
  Floor3_TradingFloor: {
    id: 'Floor3_TradingFloor',
    floor: 3,
    label: 'Trading Pit MAEL (Plan Gate)',
    navNodeId: 'room_bottom_desk',
    u: 0.430,
    v: 0.715,
    faceUp: true
  },
  Floor3_TreasuryVault: {
    id: 'Floor3_TreasuryVault',
    floor: 3,
    label: 'Monetisasi & Vault JARJIT',
    navNodeId: 'room_top_right',
    u: 0.702,
    v: 0.392,
    faceUp: true
  },
  Floor3_AudioRoom: {
    id: 'Floor3_AudioRoom',
    floor: 3,
    label: 'Voicebox & Stock Review Booth',
    navNodeId: 'room_pantry',
    u: 0.685,
    v: 0.655,
    faceUp: true
  },
  Floor3_Lounge: {
    id: 'Floor3_Lounge',
    floor: 3,
    label: 'Finance Executive Lounge',
    navNodeId: 'room_far_right',
    u: 0.825,
    v: 0.515,
    faceLeft: true
  }
};

export function getRoomById(roomId: string): RoomDefinition | undefined {
  return ROOM_DEFINITIONS[roomId];
}

export function findNearestNavNode(worldPos: THREE.Vector2, floor?: FloorId): string {
  let bestId = 'ring_s';
  let bestDist = Infinity;
  for (const [id, node] of Object.entries(FLOOR_NAV_NODES)) {
    if (floor && node.allowedFloors && !node.allowedFloors.includes(floor)) continue;
    const p = uvToWorld(node.u, node.v);
    const d = worldPos.distanceTo(p);
    if (d < bestDist) {
      bestDist = d;
      bestId = id;
    }
  }
  return bestId;
}

export function findPathBetweenNodes(
  startId: string,
  goalId: string,
  floor: FloorId
): THREE.Vector2[] {
  if (!FLOOR_NAV_NODES[startId] || !FLOOR_NAV_NODES[goalId]) {
    const fallback = FLOOR_NAV_NODES[goalId] ?? FLOOR_NAV_NODES.ring_s;
    return [uvToWorld(fallback.u, fallback.v)];
  }
  if (startId === goalId) {
    const node = FLOOR_NAV_NODES[goalId];
    return [uvToWorld(node.u, node.v)];
  }

  const queue: string[] = [startId];
  const visited = new Set<string>([startId]);
  const parent: Record<string, string | null> = { [startId]: null };

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === goalId) break;
    const node = FLOOR_NAV_NODES[curr];
    if (!node) continue;
    for (const nextId of node.neighbors) {
      const nextNode = FLOOR_NAV_NODES[nextId];
      if (!nextNode) continue;
      if (nextNode.allowedFloors && !nextNode.allowedFloors.includes(floor)) continue;
      if (!visited.has(nextId)) {
        visited.add(nextId);
        parent[nextId] = curr;
        queue.push(nextId);
      }
    }
  }

  const pathIds: string[] = [];
  let trace: string | null = visited.has(goalId) ? goalId : null;
  while (trace) {
    pathIds.unshift(trace);
    trace = parent[trace] ?? null;
  }

  if (pathIds.length === 0) {
    const goal = FLOOR_NAV_NODES[goalId];
    return [uvToWorld(goal.u, goal.v)];
  }

  return pathIds.map((id) => {
    const n = FLOOR_NAV_NODES[id];
    return uvToWorld(n.u, n.v);
  });
}

export function pointInPolygonUV(u: number, v: number, polygon: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

const BASE_ROOM_TEMPLATES: Array<{
  key: string;
  polygonUV: Array<[number, number]>;
  doorSensors: Array<{ u: number; v: number }>;
  slidingDoor?: { u: number; v: number; flipX?: boolean; floors?: FloorId[] };
}> = [
  {
    key: 'TopLeft',
    polygonUV: [[0.315, 0.270], [0.432, 0.372], [0.318, 0.430], [0.215, 0.342]],
    doorSensors: [{ u: 0.399, v: 0.464 }, { u: 0.277, v: 0.517 }],
    slidingDoor: { u: 0.399, v: 0.464, flipX: true }
  },
  {
    key: 'MidLeft',
    polygonUV: [[0.212, 0.456], [0.332, 0.554], [0.212, 0.676], [0.098, 0.578]],
    doorSensors: [{ u: 0.277, v: 0.517 }],
    slidingDoor: { u: 0.277, v: 0.517, flipX: false }
  },
  {
    key: 'BottomDesk',
    polygonUV: [[0.440, 0.630], [0.642, 0.818], [0.502, 0.948], [0.254, 0.754], [0.365, 0.658]],
    doorSensors: [{ u: 0.460, v: 0.696 }],
    slidingDoor: { u: 0.460, v: 0.696, flipX: false }
  },
  {
    key: 'PantryAudio',
    polygonUV: [[0.658, 0.605], [0.788, 0.722], [0.675, 0.835], [0.598, 0.715]],
    doorSensors: [{ u: 0.616, v: 0.658 }],
    slidingDoor: { u: 0.616, v: 0.658, flipX: true }
  },
  {
    key: 'TopRight',
    polygonUV: [[0.695, 0.262], [0.818, 0.368], [0.695, 0.478], [0.578, 0.370]],
    doorSensors: [{ u: 0.617, v: 0.465 }, { u: 0.576, v: 0.312 }],
    slidingDoor: { u: 0.617, v: 0.465, flipX: false }
  },
  {
    key: 'FarRight',
    polygonUV: [[0.805, 0.415], [0.944, 0.552], [0.785, 0.706], [0.682, 0.562]],
    doorSensors: [{ u: 0.742, v: 0.555 }, { u: 0.765, v: 0.500 }],
    slidingDoor: { u: 0.765, v: 0.500, flipX: true, floors: [3] }
  },
  {
    key: 'TopNook',
    polygonUV: [[0.502, 0.160], [0.570, 0.224], [0.505, 0.282], [0.438, 0.222]],
    doorSensors: [{ u: 0.576, v: 0.312 }]
  }
];

const FLOOR_ZONE_META: Record<FloorId, Record<string, { label: string; roomIds: string[] }>> = {
  1: {
    TopLeft: { label: 'Boss Room (Strategist HQ)', roomIds: ['Floor1_BossRoom'] },
    MidLeft: { label: 'Boardroom & SEO Strategy', roomIds: ['Floor1_Boardroom'] },
    BottomDesk: { label: 'Script & Editing Pit', roomIds: ['Floor1_Desk1', 'Floor1_Desk2', 'Floor1_TripleDesk'] },
    PantryAudio: { label: 'Espresso Pantry', roomIds: ['Floor1_Pantry'] },
    TopRight: { label: 'Audio & Recording Pod', roomIds: ['Floor1_Studio'] },
    FarRight: { label: 'Community & Arcade Lounge', roomIds: ['Floor1_Lounge'] },
    TopNook: { label: 'Utility & Storage Nook', roomIds: [] }
  },
  2: {
    TopLeft: { label: 'Hook & Viral R&D Lab', roomIds: ['Floor2_RnDLab'] },
    MidLeft: { label: 'Retention Chemistry Pod', roomIds: ['Floor2_ResearchPod'] },
    BottomDesk: { label: 'Retention & Motion Center', roomIds: ['Floor2_MultiMonitor'] },
    PantryAudio: { label: 'R&D Break Bar', roomIds: ['Floor2_Pantry'] },
    TopRight: { label: 'Shotcraft Server & Render Bay', roomIds: ['Floor2_DesignDesk'] },
    FarRight: { label: 'Shorts & Arcade Lounge', roomIds: ['Floor2_CreativePod'] },
    TopNook: { label: 'R&D Restroom', roomIds: [] }
  },
  3: {
    TopLeft: { label: 'BTC Videotron Trading Floor', roomIds: ['Floor3_Videotron'] },
    MidLeft: { label: 'Quant Strategy Conference', roomIds: ['Floor3_AlgoRoom'] },
    BottomDesk: { label: 'Exness Multi-Monitor Pit', roomIds: ['Floor3_TradingFloor'] },
    PantryAudio: { label: 'Voicebox TTS Studio', roomIds: ['Floor3_AudioRoom'] },
    TopRight: { label: 'Exness Treasury Vault', roomIds: ['Floor3_TreasuryVault'] },
    FarRight: { label: 'Executive Sky Lounge', roomIds: ['Floor3_Lounge'] },
    TopNook: { label: 'Cold Storage Vault', roomIds: [] }
  }
};

export const ROOM_ZONES: RoomZoneSpec[] = ([1, 2, 3] as FloorId[]).flatMap((floor) =>
  BASE_ROOM_TEMPLATES.map((tpl) => ({
    zoneId: `L${floor}_${tpl.key}`,
    label: FLOOR_ZONE_META[floor][tpl.key].label,
    floor,
    polygonUV: tpl.polygonUV,
    doorSensors: tpl.doorSensors,
    roomIds: FLOOR_ZONE_META[floor][tpl.key].roomIds,
    slidingDoor:
      tpl.slidingDoor && (!tpl.slidingDoor.floors || tpl.slidingDoor.floors.includes(floor))
        ? tpl.slidingDoor
        : undefined
  }))
);
