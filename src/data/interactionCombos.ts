import * as THREE from 'three';

export type InteractionSheetKey = 'more_agent_interactions' | 'agent_furniture_interactions';

export interface ComboAnimDef {
  sheet: InteractionSheetKey;
  boxes: Array<[number, number, number, number]>;
  worldH: number;
  fps: number;
  targetFurnitureDefs: string[];
}

export const COMBO_ANIM_LIBRARY: Record<string, ComboAnimDef> = {
  seo_desk_drone: {
    sheet: 'more_agent_interactions',
    boxes: [[90, 88, 385, 415], [538, 88, 385, 415], [978, 88, 385, 415]],
    worldH: 1.25,
    fps: 3.2,
    targetFurnitureDefs: ['it_single_desk', 'it_cluster_desk']
  },
  exec_3monitor: {
    sheet: 'more_agent_interactions',
    boxes: [[1444, 96, 368, 372], [1892, 96, 356, 372], [2320, 96, 360, 372]],
    worldH: 1.20,
    fps: 3.5,
    targetFurnitureDefs: ['boss_desk', 'it_cluster_desk', 'it_single_desk']
  },
  voicebox_mic_ring: {
    sheet: 'more_agent_interactions',
    boxes: [[116, 576, 320, 388], [552, 576, 344, 396], [956, 572, 416, 416]],
    worldH: 1.12,
    fps: 3.6,
    targetFurnitureDefs: ['studio_desk', 'audio_eq_pad', 'studio_mic']
  },
  lab_microscope: {
    sheet: 'more_agent_interactions',
    boxes: [[1476, 564, 344, 428], [1904, 564, 344, 428], [2332, 564, 344, 428]],
    worldH: 1.24,
    fps: 2.2,
    targetFurnitureDefs: ['lab_bench', 'it_single_desk', 'lab_centrifuge']
  },
  sofa_coffee: {
    sheet: 'more_agent_interactions',
    boxes: [[1468, 1096, 392, 364], [1924, 1096, 324, 364], [2300, 1096, 376, 364]],
    worldH: 1.14,
    fps: 2.0,
    targetFurnitureDefs: ['brown_sofa', 'grey_sofa_lamp']
  },
  green_3monitor: {
    sheet: 'agent_furniture_interactions',
    boxes: [[1428, 92, 388, 380]],
    worldH: 1.20,
    fps: 1.0,
    targetFurnitureDefs: ['it_single_desk', 'it_cluster_desk', 'studio_desk']
  },
  purple_3monitor: {
    sheet: 'agent_furniture_interactions',
    boxes: [[1892, 96, 356, 376], [2320, 96, 364, 376]],
    worldH: 1.20,
    fps: 2.8,
    targetFurnitureDefs: ['it_single_desk', 'it_cluster_desk']
  },
  scientist_dna: {
    sheet: 'agent_furniture_interactions',
    boxes: [[92, 536, 320, 400], [520, 536, 336, 400]],
    worldH: 1.28,
    fps: 2.4,
    targetFurnitureDefs: ['dna_hologram', 'lab_centrifuge']
  },
  scientist_molecule: {
    sheet: 'agent_furniture_interactions',
    boxes: [[1460, 516, 360, 420]],
    worldH: 1.24,
    fps: 1.0,
    targetFurnitureDefs: ['molecule_table', 'lab_bench']
  },
  barista_espresso: {
    sheet: 'agent_furniture_interactions',
    boxes: [[92, 1008, 344, 376], [548, 1032, 296, 376]],
    worldH: 1.14,
    fps: 2.0,
    targetFurnitureDefs: ['coffee_machine', 'pantry_counter']
  },
  exec_holo_present: {
    sheet: 'agent_furniture_interactions',
    boxes: [[928, 1028, 662, 468]],
    worldH: 1.34,
    fps: 1.0,
    targetFurnitureDefs: ['holo_boardroom_table', 'meeting_table', 'boss_desk']
  },
  motion_arcade: {
    sheet: 'agent_furniture_interactions',
    boxes: [[1665, 1064, 265, 432], [2040, 1064, 260, 444], [2368, 1064, 292, 416]],
    worldH: 1.22,
    fps: 2.8,
    targetFurnitureDefs: ['arcade_machine']
  }
};

export const AGENT_COMBO_MAP: Record<
  string,
  Partial<Record<'typing' | 'thinking' | 'coffee', keyof typeof COMBO_ANIM_LIBRARY>>
> = {
  rama: { typing: 'exec_3monitor', thinking: 'exec_holo_present' },
  marta: { typing: 'seo_desk_drone', thinking: 'exec_holo_present' },
  nara: { typing: 'purple_3monitor', thinking: 'lab_microscope' },
  putri: { typing: 'seo_desk_drone', thinking: 'purple_3monitor', coffee: 'sofa_coffee' },
  aruna: { typing: 'seo_desk_drone', thinking: 'exec_holo_present' },
  fizi: { coffee: 'barista_espresso', typing: 'sofa_coffee' },
  raga: { typing: 'green_3monitor', thinking: 'voicebox_mic_ring' },
  meimei: { typing: 'scientist_molecule', thinking: 'lab_microscope' },
  sandi: { typing: 'purple_3monitor', thinking: 'scientist_dna' },
  mael: { typing: 'exec_3monitor', thinking: 'exec_holo_present' },
  jarjit: { typing: 'scientist_molecule', coffee: 'sofa_coffee' }
};

export interface ActiveComboMatch {
  comboKey: keyof typeof COMBO_ANIM_LIBRARY;
  furnitureUid: string;
  furnitureDefId: string;
  anchorPos: THREE.Vector2;
}

/**
 * Matches a stationary working/coffee agent to the nearest unoccupied interactive furniture
 * piece on the same floor so the static desk/chair/sofa hides cleanly (zero double-render)
 * and the seated combo sprite snaps onto the exact furniture anchor.
 */
export function resolveAgentFurnitureCombo(
  agentId: string,
  action: 'typing' | 'thinking' | 'coffee',
  agentPos: THREE.Vector2,
  floor: number,
  placedFurnitures: Array<{
    uid: string;
    itemId: string;
    floor: number;
    pos: THREE.Vector2;
  }>,
  occupiedFurnitureUids: Set<string>,
  maxRadiusWorld = 1.65
): ActiveComboMatch | null {
  const preferredKey = AGENT_COMBO_MAP[agentId]?.[action];
  if (!preferredKey) return null;

  const preferredDef = COMBO_ANIM_LIBRARY[preferredKey];
  if (!preferredDef) return null;

  let bestFurn: (typeof placedFurnitures)[0] | null = null;
  let bestDist = maxRadiusWorld;

  for (const furn of placedFurnitures) {
    if (furn.floor !== floor) continue;
    if (occupiedFurnitureUids.has(furn.uid)) continue;
    if (!preferredDef.targetFurnitureDefs.includes(furn.itemId)) continue;

    const d = agentPos.distanceTo(furn.pos);
    if (d <= bestDist) {
      bestDist = d;
      bestFurn = furn;
    }
  }

  if (!bestFurn) return null;

  return {
    comboKey: preferredKey,
    furnitureUid: bestFurn.uid,
    furnitureDefId: bestFurn.itemId,
    anchorPos: bestFurn.pos
  };
}
