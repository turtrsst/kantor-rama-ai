/* ==========================================================================
   KRA — Kantor-Rama-AI · Virtual Office Engine (Prototype)
   Design adapted from Munder Difflin (HarnessMD/munder-difflin)
   ========================================================================== */

'use strict';

/* ---------- 1. WORLD PALETTE (earthbound / SNES tiles) ---------- */
const FLOOR = {
  execL:   '#96592F',
  execD:   '#7B4523',
  woodL:   '#E5C896',
  woodD:   '#C9A66B',
  serverL: '#33475B',
  serverD: '#28394A',
  loungeL: '#B98A5C',
  loungeD: '#9C7148',
  pathL:   '#E8D8B0',
  pathD:   '#D6C299',
  corridor:'#6B5138'
};

const DECO = {
  wall:     '#593E2B',
  wallTop:  '#7A5537',
  rug:      '#9E2A2B',
  rugTrim:  '#6E1423',
  deskA:    '#8A5A32',
  deskB:    '#6E4523',
  deskTop:  '#A9743F',
  shelf:    '#7C5B3A',
  shelfDk:  '#5C4028',
  metal:    '#4A5560',
  metalLt:  '#7C8894',
  serverRk: '#1F2A36',
  blinkyG:  '#6BCF7F',
  blinkyR:  '#FF6B6B',
  blinkyY:  '#FFD93D',
  lamp:     '#F4D35E',
  plant:    '#3F7D4A',
  plantDk:  '#2C5C34',
  pot:      '#A5653C',
  white:    '#FFF8E7',
  ink:      '#1A1320'
};

/* ---------- 2. ROOM MAP (32 x 12 tiles @ 32px) ---------- */
const MAP = { w: 44, h: 12 }; // wider map to fill 16:9-ish container without pillarboxing
const T = 32;
const MAP_WORLD = { w: MAP.w * T, h: MAP.h * T };
let activeFloor = 1;
var atlasWalkBlockers = { 1: new Set(), 2: new Set() };
var atlasBlockersDirty = { 1: true, 2: true };
const floorMaps = { 1: null, 2: null };
const floorLabels = { 1: 'Floor 01: Headquarters', 2: 'Floor 02: Innovation Deck' };

// floor[][] : which floor palette key per tile
// deco[][]  : overlay furniture sprite per tile (or null)
const floor = [];
const deco  = [];
const rooms = []; // {id,label,x,y,w,h,floor:[l,d],accent}

function room(id, label, x, y, w, h, fL, fD, accent) {
  const r = { id, label, x, y, w, h, fL, fD, accent };
  rooms.push(r);
  for (let ty = y; ty < y + h; ty++) {
    for (let tx = x; tx < x + w; tx++) {
      if (ty < 0 || ty >= MAP.h || tx < 0 || tx >= MAP.w) continue;
      floor[ty][tx] = ((tx + ty) % 2 === 0) ? fL : fD;
    }
  }
  return r;
}

function put(x, y, sprite) {
  if (y < 0 || y >= MAP.h || x < 0 || x >= MAP.w) return;
  deco[y][x] = sprite;
}

function rectFloor(x, y, w, h, key) {
  for (let ty = y; ty < y + h; ty++)
    for (let tx = x; tx < x + w; tx++)
      if (ty >= 0 && ty < MAP.h && tx >= 0 && tx < MAP.w)
        floor[ty][tx] = ((tx + ty) % 2 === 0) ? FLOOR[key] : FLOOR[key];
}

function fillBackground() {
  for (let y = 0; y < MAP.h; y++) {
    floor[y] = [];
    deco[y] = [];
    for (let x = 0; x < MAP.w; x++) {
      // Phase 1: every expanded canvas tile remains a visible office floor cell;
      // Phase 2 assigns the final room palette and architecture in Tiled.
      floor[y][x] = ((x + y) % 2 === 0) ? FLOOR.woodL : FLOOR.woodD;
      deco[y][x] = null;
    }
  }
}

function buildWorld() {
  // Phase 2: 8 rooms arranged in two balanced 4-room tiers connected by a central Grand Runway
  fillBackground();
  rooms.length = 0;

  // 4 Top Rooms (y: 0..4, height 5)
  // Room 1: Server Room (Jarvis) - x: 0..7
  room('server', 'SERVER ROOM - JARVIS', 0, 0, 8, 5, FLOOR.serverL, FLOOR.serverD, '#00F5D4');
  // Room 2: Manager Suite (Rama) - x: 8..15
  room('manager', 'MANAGER SUITE - RAMA', 8, 0, 8, 5, '#8F5E36', '#7C4E28', '#F4D35E');
  // Room 3: Studio (Maya) - x: 16..23
  room('studio', 'STUDIO - MAYA', 16, 0, 8, 5, '#D9CCA3', '#CBBE95', '#FF6B6B');
  // Room 4: Lobby (KRA) - x: 24..31
  room('lobby', 'LOBBY - KRA', 24, 0, 8, 5, '#EDE9E1', '#DDD8CE', '#B197FC');

  // 2. STUDIO & LOBBY FLOORS
  // Studio (Maya) - Designer birch parquet tiles
  for (let py = 0; py <= 4; py++) {
    for (let px = 16; px <= 23; px++) {
      floor[py][px] = ((px + py) % 2 === 0) ? '#D9CCA3' : '#CBBE95';
    }
  }
  // Lobby (KRA) - Marble terrazzo reception floor
  for (let py = 0; py <= 4; py++) {
    for (let px = 24; px <= 31; px++) {
      floor[py][px] = ((px + py) % 2 === 0) ? '#EDE9E1' : '#DDD8CE';
    }
  }

  // Central Grand Runway Corridor (y: 5..6, height 2)
  rectFloor(0, 5, MAP.w, 2, 'corridor');

  // 4 Bottom Rooms (y: 7..11, height 5)
  // Room 5: Records (Siti) - x: 0..7
  room('records', 'RECORDS - SITI', 0, 7, 8, 5, '#C2A87D', '#B0966C', '#6BCF7F');
  // Room 6: Meeting (Budi) - x: 8..15
  room('meeting', 'MEETING - BUDI', 8, 7, 8, 5, '#B6A57F', '#A3926D', '#4ECDC4');
  // Room 7: Pantry (Team) - x: 16..23
  room('pantry', 'PANTRY - TEAM', 16, 7, 8, 5, '#F2F4F7', '#D7DBE2', '#F4D35E');
  // Room 8: Play Lounge (Dimas) - x: 24..31
  room('play', 'PLAY - DIMAS', 24, 7, 8, 5, '#A2754A', '#8F643B', '#FF6B6B');

  // Pantry (Team) - Crisp White Checker tiles
  for (let py = 7; py <= 11; py++) {
    for (let px = 16; px <= 23; px++) {
      floor[py][px] = ((px + py) % 2 === 0) ? '#FFFFFF' : '#E2E8F0';
    }
  }

  // Architectural walls are drawn by drawOfficeWalls() so they never block pathfinding.

  // Grand Runway runner is rendered smoothly by drawPhase5BOverlay() and corridor floor.

  // Room Furnishings:
  // --- Room 1: Server Room (Jarvis) ---
  put(1, 3, 'serverrack'); put(2, 3, 'atlas_server_blade'); put(3, 3, 'serverrack');
  put(5, 3, 'serverrack'); put(6, 3, 'vaultterm'); put(7, 3, 'serverrack');
  put(7, 4, 'plant');

  // --- Room 2: Manager Suite (Rama) ---
  put(8, 2, 'bookshelf'); put(14, 2, 'bookshelf');
  put(10, 3, 'desk');
  put(10, 2, 'chair');
  put(8, 4, 'plant'); put(14, 4, 'lamp');

  // --- Room 3: Studio (Maya) ---
  put(17, 2, 'taskboard'); put(18, 2, 'taskboard');
  put(20, 3, 'desk'); put(21, 3, 'desk');
  put(20, 2, 'chair');
  put(23, 2, 'bookshelf');
  put(16, 4, 'plant'); put(22, 4, 'synth');

  // --- Room 4: Lobby & Reception (KRA) ---
  put(24, 3, 'watercooler'); put(25, 4, 'trophy');
  put(26, 3, 'desk');
  put(29, 4, 'couch'); put(30, 4, 'couch');
  put(31, 4, 'plant');

  // --- Room 5: Records & Archive (Siti) ---
  put(1, 8, 'bookshelf'); put(3, 8, 'bookshelf'); put(5, 8, 'bookshelf');
  put(2, 9, 'desk'); put(3, 9, 'desk');
  put(2, 8, 'chair');
  put(0, 8, 'plant'); put(0, 11, 'plant');

  // --- Room 6: Meeting & War Room (Budi) ---
  put(13, 8, 'coffee');
  put(9, 9, 'table'); put(10, 9, 'table'); put(11, 9, 'table');
  put(9, 8, 'chair'); put(11, 8, 'chair');
  put(13, 9, 'taskboard'); put(14, 9, 'taskboard');

  // --- Room 7: Pantry & Cafeteria (Team) ---
  put(16, 8, 'coffee');
  put(17, 9, 'table'); put(18, 9, 'table');
  put(17, 8, 'chair'); put(18, 8, 'chair');
  put(20, 8, 'atlas_barista');
  put(22, 8, 'atlas_refrigerator');
  put(23, 11, 'watercooler');

  // --- Room 8: Play & Recreation Lounge (Dimas) ---
  put(24, 8, 'arcade');
  put(26, 8, 'bookshelf'); put(28, 8, 'bookshelf');
  put(31, 8, 'synth');
  put(26, 10, 'billiard'); // was (26,9): overlapped 2x2 bookshelf at (26,8)
  put(31, 10, 'couch');

  // --- Room 10: Systems Lab & AI Forge (Expansion, replaces black spot) ---
  room('expansion_f1_top', 'AI Forge Lab', 32, 0, 12, 5, '#1B2A38', '#121F2A', '#00E5FF');
  put(33, 2, '07_inno_asset_forge_3d_printer');
  put(36, 2, '05_inno_hotdesk_modular_2x1');
  put(39, 2, '06_inno_prototype_pedestal');
  put(41, 1, '10_plant_potted_large');

  room('expansion_f1_bot', 'Command Deck', 32, 7, 12, 5, '#221A30', '#181224', '#BD93F9');
  put(33, 8, '02_war_tactical_display_wall');
  put(36, 9, '01_war_command_table_4x2');
  put(41, 8, '04_war_radio_beacon_chair');
  put(41, 10, '13_modular_couch');

  floorMaps[1] = { floor: floor.map(row => row.slice()), deco: deco.map(row => row.slice()) };
  buildSecondFloor();
  floorMaps[2] = { floor: floor.map(row => row.slice()), deco: deco.map(row => row.slice()) };
  activeFloor = 1;
  for (let y = 0; y < MAP.h; y += 1) { floor[y] = floorMaps[1].floor[y].slice(); deco[y] = floorMaps[1].deco[y].slice(); }
}
function buildSecondFloor() {
  fillBackground();
  // Floor 2: 4 large executive decks matching 32x12
  room('warroom', 'Emergency War Room', 0, 0, 16, 5, '#202A46', '#172039', '#00F5D4');
  room('innovation', 'Innovation Studio', 16, 0, 16, 5, '#40203D', '#2A172D', '#FF007F');
  rectFloor(0, 5, MAP.w, 2, 'corridor');
  room('observatory', 'Systems Observatory', 0, 7, 16, 5, '#243A43', '#182A32', '#B197FC');
  room('lounge2', 'Sky Lounge', 16, 7, 16, 5, '#40321B', '#2C2114', '#F4D35E');

  // Floor 2 walls are handled by drawOfficeWalls()


  // The connecting runway stays clear; floor switches use the UI controls.
  // Grand Runway runner is rendered smoothly by drawPhase5BOverlay() and corridor floor.

  // War Room props
  put(4, 2, 'table'); put(5, 2, 'table'); put(6, 2, 'table');
  put(2, 1, 'taskboard'); put(8, 1, 'taskboard');
  // Innovation props and hot-desking workstations
  put(18, 2, 'desk'); put(19, 2, 'desk');
  put(21, 2, 'atlas_desk'); put(24, 2, 'atlas_desk');
  put(27, 2, 'atlas_desk'); put(29, 2, 'atlas_desk');
  put(22, 1, 'bookshelf'); put(25, 2, 'lamp');
  put(20, 3, 'chair'); put(23, 3, 'chair');
  put(26, 3, 'chair'); put(28, 3, 'chair');
  // Observatory props
  put(3, 9, 'serverrack'); put(5, 9, 'serverrack'); put(8, 9, 'vaultterm');
  // Sky lounge props
  put(18, 9, 'couch'); put(19, 9, 'couch'); put(22, 9, 'table'); put(25, 8, 'vending');
}

let floorTransitionAlpha = 1.0;

function loadFloor(level, animate = true) {
  const snapshot = floorMaps[level];
  if (!snapshot) return;
  activeFloor = level;
  invalidateAtlasWalkBlockers(level);
  invalidateDecorLayerCache(level);
  floorLayerCacheId = 0; // force floor layer cache redraw for new room colors
  if (floorMaps[level]) { for (let y = 0; y < MAP.h; y += 1) { floor[y] = floorMaps[level].floor[y].slice(); deco[y] = floorMaps[level].deco[y].slice(); } }
  if (typeof loadDecorations === 'function') loadDecorations(level);
  const label = document.getElementById('floor-label');
  if (label) label.textContent = floorLabels[level];
  document.querySelectorAll('.floor-toggle-btn').forEach(button => {
    button.classList.toggle('active', button.id === 'btn-floor-' + level);
  });

  if (typeof floorLayerCacheId !== 'undefined') floorLayerCacheId = 0;
  if (typeof floorOverlayCache !== 'undefined') floorOverlayCache = Object.create(null);
  if (animate) {
    floorTransitionAlpha = 0.15;
    const startTime = performance.now();
    const duration = 240;
    function fadeStep(now) {
      const elapsed = now - startTime;
      floorTransitionAlpha = Math.min(1.0, 0.15 + (elapsed / duration) * 0.85);
      if (floorTransitionAlpha < 1.0) {
        requestAnimationFrame(fadeStep);
      }
    }
    requestAnimationFrame(fadeStep);
  } else {
    floorTransitionAlpha = 1.0;
  }
}

function initGrid() {
  for (let y = 0; y < MAP.h; y++) { floor[y] = []; deco[y] = []; }
}
initGrid();
buildWorld();

/* ---------- 3. CANVAS RENDER ---------- */
let canvas = document.getElementById('office-canvas');
let ctx = canvas.getContext('2d');
canvas.width = MAP.w * T;
canvas.height = MAP.h * T;
ctx.imageSmoothingEnabled = false;

const W = canvas.width;
const H = canvas.height;

function jitter(x, y, range) {
  // deterministic pseudo-random for sprite detail
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

let floorLayerCache = null;
var floorLayerCacheId = 0;

function drawFloors() {
  if (!floorLayerCache) {
    floorLayerCache = document.createElement('canvas');
    floorLayerCache.width = W;
    floorLayerCache.height = H;
  }
  if (floorLayerCacheId !== activeFloor) {
    const floorCtx = floorLayerCache.getContext('2d');
    floorCtx.imageSmoothingEnabled = false;
    for (let y = 0; y < MAP.h; y++) {
      for (let x = 0; x < MAP.w; x++) {
        floorCtx.fillStyle = floor[y][x];
        floorCtx.fillRect(x * T, y * T, T, T);
        floorCtx.fillStyle = 'rgba(0,0,0,0.05)';
        floorCtx.fillRect(x * T, y * T + T - 2, T, 2);
      }
    }
    floorLayerCacheId = activeFloor;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(floorLayerCache, 0, 0);
}

function px(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * T, y * T, w, h);
}

const officeAtlas = {
  ready: false,
  metadata: null,
  diffuse: null,
  emission: null,
  cache: new Map(),
  error: null
};
window.officeAtlas = officeAtlas;

function loadImageAsset(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load atlas image: ' + url));
    image.src = url;
  });
}

async function initOfficeAtlas() {
  try {
    officeAtlas.cache.clear();
    const cacheBust = '?v=' + Date.now();
    const response = await fetch('../assets/voxel/atlas/argon_office_furniture.json' + cacheBust, { cache: 'no-store' });
    if (!response.ok) throw new Error('Atlas metadata request failed: ' + response.status);
    const metadata = await response.json();
    const baseUrl = new URL('../assets/voxel/atlas/', window.location.href);
    const diffuseUrl = new URL(metadata.texture_file + cacheBust, baseUrl).href;
    const emissionUrl = new URL(metadata.emission_file + cacheBust, baseUrl).href;
    const [diffuse, emission] = await Promise.all([
      loadImageAsset(diffuseUrl), loadImageAsset(emissionUrl)
    ]);
    if (diffuse.naturalWidth !== emission.naturalWidth || diffuse.naturalHeight !== emission.naturalHeight) {
      throw new Error('Diffuse and emission atlas dimensions differ.');
    }
    if (!Number.isInteger(metadata.grid_size) || metadata.grid_size < 1
      || Object.keys(metadata.sprites || {}).length === 0) {
      throw new Error('Atlas grid size or sprite catalog is invalid.');
    }

    Object.entries(metadata.sprites || {}).forEach(([name, sprite]) => {
      const { x, y, w, h } = sprite.frame || {};
      const { x: pivotX, y: pivotY } = sprite.pivot || {};
      const occupancy = sprite.grid_occupancy || {};
      if (![x, y, w, h, pivotX, pivotY, occupancy.cols, occupancy.rows].every(Number.isFinite)
        || x < 0 || y < 0 || w <= 0 || h <= 0
        || x + w > diffuse.naturalWidth || y + h > diffuse.naturalHeight
        || pivotX < 0 || pivotX > w || pivotY < 0 || pivotY > h
        || occupancy.cols < 1 || occupancy.rows < 1
        || !Number.isInteger(occupancy.cols) || !Number.isInteger(occupancy.rows)
        || typeof sprite.has_emission !== 'boolean') {
        throw new Error('Invalid atlas sprite metadata: ' + name);
      }
    });

    officeAtlas.metadata = metadata;
    officeAtlas.diffuse = diffuse;
    officeAtlas.emission = emission;
    officeAtlas.ready = true;
    if (typeof decorLayerCache !== 'undefined') {
      decorLayerCache[1] = null;
      decorLayerCache[2] = null;
    }
    invalidateAtlasWalkBlockers(1);
    invalidateAtlasWalkBlockers(2);
    termLine('[Atlas]: Loaded and validated ' + Object.keys(metadata.sprites).length + ' sprites.', 'sys');
  } catch (error) {
    officeAtlas.error = error.message;
    officeAtlas.ready = false;
    termLine('[Atlas]: Optional atlas unavailable; procedural sprites remain active (' + error.message + ').', 'warn');
  }
}

function getCachedAtlasFrame(name) {
  if (officeAtlas.cache.has(name)) return officeAtlas.cache.get(name);
  const sprite = officeAtlas.metadata && officeAtlas.metadata.sprites[name];
  if (!sprite) return null;

  const { frame } = sprite;
  const diffuseCanvas = document.createElement('canvas');
  diffuseCanvas.width = frame.w;
  diffuseCanvas.height = frame.h;
  const diffuseCtx = diffuseCanvas.getContext('2d');
  diffuseCtx.imageSmoothingEnabled = false;
  diffuseCtx.drawImage(officeAtlas.diffuse, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);

  let emissionCanvas = null;
  if (sprite.has_emission) {
    emissionCanvas = document.createElement('canvas');
    emissionCanvas.width = frame.w;
    emissionCanvas.height = frame.h;
    const emissionCtx = emissionCanvas.getContext('2d');
    emissionCtx.imageSmoothingEnabled = false;
    emissionCtx.drawImage(officeAtlas.emission, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
  }

  const compositeCanvas = document.createElement('canvas');
  compositeCanvas.width = frame.w;
  compositeCanvas.height = frame.h;
  const compositeCtx = compositeCanvas.getContext('2d');
  compositeCtx.imageSmoothingEnabled = false;
  compositeCtx.drawImage(diffuseCanvas, 0, 0);
  if (emissionCanvas) {
    compositeCtx.globalCompositeOperation = 'screen';
    compositeCtx.drawImage(emissionCanvas, 0, 0);
    compositeCtx.globalCompositeOperation = 'source-over';
  }

  const cached = { diffuse: diffuseCanvas, emission: emissionCanvas, composite: compositeCanvas, sprite };
  officeAtlas.cache.set(name, cached);
  return cached;
}

function drawAtlasSprite(tileX, tileY, name) {
  const cached = getCachedAtlasFrame(name);
  if (!cached) return false;
  const { sprite } = cached;
  const cols = sprite.grid_occupancy?.cols || 1;
  const rows = sprite.grid_occupancy?.rows || 1;
  const drawX = Math.round(tileX * T + (cols * T) / 2 - sprite.pivot.x);
  const drawY = Math.round(tileY * T + (rows * T) - sprite.pivot.y);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cached.composite, drawX, drawY);
  ctx.restore();
  return true;
}

function isAtlasItem(name) {
  if (!name) return false;
  return getAtlasFrameName(name) !== null;
}

function getAtlasFrameName(name) {
  // Maps decor item ids to sprite ids in argon_office_furniture.json.
  // Items without an Argon sprite return null and fall back to procedural drawing.
  return ({
    atlas_server: '02_server_rack_jarvis',
    atlas_desk: '01_executive_desk_rama',
    atlas_arcade: '06_arcade_console_dimas',
    atlas_planter: '10_plant_potted_large',
    atlas_bookshelf: '05_archive_bookshelf_siti',
    atlas_maya_desk: '03_workstation_maya',
    atlas_board: '12_modular_taskboard',
    atlas_coffee: '01_pantry_espresso_counter',
    atlas_table: '04_conference_table_budi',
    atlas_billiard: '14_billiard_table_dimas',
    atlas_chair: '08_chair_executive',
    atlas_server_blade: '02_server_rack_jarvis',
    atlas_refrigerator: '02_pantry_refrigerator_sink',
    atlas_barista: '01_pantry_espresso_counter',
    serverrack: '02_server_rack_jarvis',
    desk: '01_executive_desk_rama',
    arcade: '06_arcade_console_dimas',
    plant: '10_plant_potted_large',
    bookshelf: '05_archive_bookshelf_siti',
    taskboard: '12_modular_taskboard',
    coffee: '01_pantry_espresso_counter',
    table: '04_conference_table_budi',
    elevator: '07_elevator_door_module',
    chair: '08_chair_executive',
    vending: '03_pantry_vending_water_cooler',
    billiard: '14_billiard_table_dimas',
    // Batch 3 pass-through mappings
    '01_war_command_table_4x2': '01_war_command_table_4x2',
    '02_war_tactical_display_wall': '02_war_tactical_display_wall',
    '04_war_radio_beacon_chair': '04_war_radio_beacon_chair',
    '05_inno_hotdesk_modular_2x1': '05_inno_hotdesk_modular_2x1',
    '06_inno_prototype_pedestal': '06_inno_prototype_pedestal',
    '07_inno_asset_forge_3d_printer': '07_inno_asset_forge_3d_printer',
    '10_plant_potted_large': '10_plant_potted_large',
    '13_modular_couch': '13_modular_couch'
  })[name] || null;
}

function drawSprite(tx, ty, name) {
  const X = tx * T;
  const Y = ty * T;
  const atlasFrameName = getAtlasFrameName(name);
  if (atlasFrameName && officeAtlas.ready && officeAtlas.metadata?.sprites?.[atlasFrameName]) {
    drawAtlasSprite(tx, ty, atlasFrameName);
    return;
  }

  const p = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(X + x, Y + y, w, h); };

  switch (name) {
    case 'trophy':
      p(12, 22, 8, 7, '#8A5A22'); p(8, 28, 16, 2, '#F4D35E');
      p(10, 5, 12, 12, '#F4D35E'); p(8, 4, 4, 8, '#FFD166'); p(20, 4, 4, 8, '#FFD166');
      p(13, 8, 6, 6, '#FFF3B0'); break;
    case 'bonsai':
      p(11, 20, 10, 9, '#B65F3B'); p(9, 19, 14, 2, '#D98957');
      p(15, 8, 2, 12, '#8B5A2B'); p(7, 7, 18, 10, '#2D8A4E');
      p(10, 5, 12, 9, '#45CC77'); p(13, 8, 2, 2, '#B7FFB5'); break;
    case 'coffee':
      p(5, 12, 22, 16, '#18232B'); p(7, 14, 18, 8, '#7DD3FC');
      p(8, 24, 16, 3, '#00F5D4'); p(10, 17, 12, 4, '#E8F5FF');
      p(12, 18, 8, 2, '#75462E'); p(11, 8, 2, 4, '#FFFFFF'); p(18, 5, 2, 7, '#FFFFFF'); break;
    case 'holoOrb':
      p(6, 25, 20, 4, '#243247'); p(11, 21, 10, 4, '#3E5272');
      ctx.save(); ctx.shadowColor = '#00F5D4'; ctx.shadowBlur = 10;
      p(10, 6, 12, 14, '#00A896'); p(12, 4, 8, 17, 'rgba(177,151,252,.75)');
      p(14, 8, 4, 8, '#E8FFFF'); ctx.restore(); break;
    case 'lavalamp':
      p(11, 25, 10, 4, '#263646'); p(13, 8, 6, 18, '#B197FC');
      p(12, 5, 8, 5, '#DBD0FF'); p(14, 12, 4, 5, '#FF007F'); p(13, 19, 5, 4, '#00F5D4'); break;
    case 'synth':
      p(3, 13, 26, 14, '#222C3A'); p(4, 14, 24, 3, '#FF007F');
      for (let key = 0; key < 8; key++) p(5 + key * 3, 19, 2, 7, key % 3 === 0 ? '#00F5D4' : '#E8EDF4');
      p(8, 10, 3, 3, '#F4D35E'); p(15, 9, 3, 4, '#B197FC'); p(22, 11, 3, 2, '#00F5D4'); break;
    case 'cactus':
      p(10, 22, 12, 8, '#B65F3B'); p(8, 21, 16, 2, '#D98957');
      p(14, 6, 5, 17, '#2D8A4E'); p(10, 12, 5, 8, '#45CC77'); p(8, 10, 4, 5, '#45CC77');
      p(18, 14, 5, 3, '#45CC77'); p(21, 11, 3, 7, '#45CC77'); p(15, 9, 1, 2, '#C7FFD7'); break;
    case 'cybercat': {
      if (drawCybercatSprite(X + 6, Y + 10, 'cybercat_idle')) break;
      p(8, 11, 16, 15, '#202A38'); p(7, 7, 6, 8, '#202A38'); p(19, 7, 6, 8, '#202A38');
      p(9, 10, 14, 12, '#F4F7FB'); p(10, 4, 3, 3, '#FF007F'); p(19, 4, 3, 3, '#00F5D4');
      p(11, 14, 3, 3, '#00F5D4'); p(18, 14, 3, 3, '#FF007F'); p(14, 19, 4, 2, '#F4D35E'); break;
    }
    case 'elevator':
      // Glass elevator: a visible transit hub between the two connected floors.
      p(2, 1, 28, 30, 'rgba(0, 0, 0, 0.42)');
      p(3, 0, 26, 30, '#17212D');
      p(5, 2, 22, 25, '#31485B');
      p(6, 3, 20, 21, '#0C1B28');
      p(7, 4, 9, 19, 'rgba(0, 245, 212, 0.24)');
      p(17, 4, 8, 19, 'rgba(177, 151, 252, 0.18)');
      p(15, 3, 2, 21, '#00F5D4');
      p(15, 4 + (Math.floor(clock / 10) % 14), 2, 3, '#FFFFFF');
      p(5, 26, 22, 2, '#00F5D4');
      p(8, 6, 5, 3, '#F4D35E'); // floor display
      break;

    case 'wallTop':
      // Architectural wood slat wall with 3D top crown moulding
      p(0, 0, T, 14, '#2A1C14');
      p(0, 0, T, 3, '#4A3122'); // top crown highlight
      p(0, 12, T, 2, '#180E09'); // bottom shadow
      for (let sl = 2; sl < T; sl += 6) {
        p(sl, 3, 1, 9, '#1C120B');
        p(sl + 1, 3, 1, 9, '#38251A');
      }
      break;

    case 'serverwall':
      // High-tech modular server wall with glowing cyan conduit lines
      p(0, 0, T, 14, '#121922');
      p(0, 0, T, 2, '#222E3D');
      p(0, 12, T, 2, '#0A0E14');
      // Glowing fiber conduit
      p(0, 5, T, 2, '#00F5D4');
      p(0, 5, T, 1, '#80FFF0');
      // Diagnostic blinky indicators
      const blk = Math.floor(clock / 20) % 3;
      p(6, 9, 3, 2, blk === 0 ? '#00F5D4' : '#00665A');
      p(14, 9, 3, 2, blk === 1 ? '#FFD166' : '#665020');
      p(22, 9, 3, 2, blk === 2 ? '#FF007F' : '#660033');
      break;

    case 'rug':
      // Luxury velvet executive rug with 3D stitched pinstripe border
      p(0, 0, T, T, '#1A1E26');
      p(0, 0, T, 2, '#2D3543');
      p(0, T - 2, T, 2, '#2D3543');
      p(0, 0, 2, T, '#2D3543');
      p(T - 2, 0, 2, T, '#2D3543');
      p(2, 2, T - 4, T - 4, '#15181F');
      p(4, 4, T - 8, 1, '#202632');
      p(4, T - 5, T - 8, 1, '#202632');
      break;

    case 'desk':
      // 3D Beveled Executive Desk with Dual Neon Screens & Laptop
      // Contact drop shadow on floor
      p(2, 26, 28, 5, 'rgba(0, 0, 0, 0.42)');
      // Modesty panel & drawer pedestals (3D volume)
      p(3, 10, 26, 15, '#592D12');
      p(3, 10, 8, 15, '#45220C'); // left drawer stack
      p(21, 10, 8, 15, '#45220C'); // right drawer stack
      // Metallic brass drawer pulls with glints
      p(6, 14, 2, 2, '#F4D35E'); p(7, 14, 1, 1, '#FFF');
      p(6, 19, 2, 2, '#F4D35E'); p(7, 19, 1, 1, '#FFF');
      p(24, 14, 2, 2, '#F4D35E'); p(25, 14, 1, 1, '#FFF');
      p(24, 19, 2, 2, '#F4D35E'); p(25, 19, 1, 1, '#FFF');
      // Beveled Mahogany Desk Top
      p(1, 4, 30, 8, '#8A481F');
      p(1, 4, 30, 1, '#C48A54'); // top highlight rim
      p(1, 11, 30, 1, '#381A08'); // underside bevel shadow
      // Leather desk pad
      p(6, 6, 20, 5, '#151921');
      // Dual Neon Display Screens
      // Left screen (Cyan IDE code)
      p(4, -3, 11, 8, '#10141D');
      p(5, -2, 9, 6, '#070A0F');
      p(6, -1, 5, 1, '#00F5D4');
      p(6, 1, 7, 1, '#00A896');
      p(6, 3, 6, 1, '#FFD166');
      // Right screen (Magenta / Gold analytics)
      p(17, -3, 11, 8, '#10141D');
      p(18, -2, 9, 6, '#070A0F');
      p(19, -1, 6, 2, '#FF007F');
      p(19, 2, 7, 1, '#F4D35E');
      // Open Aluminum Laptop in front
      p(11, 7, 10, 5, '#3A4454');
      p(12, 8, 8, 3, '#CBD5E1');
      p(13, 9, 6, 1, '#00F5D4'); // laptop glowing screen
      break;

    case 'lamp':
      // Modern Arc Floor Lamp with Metallic Brass Finish & Inner Glow
      p(15, 2, 2, 26, '#D4AF37');
      p(16, 2, 1, 26, '#FFF2AA'); // metallic glint
      p(12, 27, 8, 2, '#C2982E'); // heavy brass base
      // Flared lampshade
      p(10, 0, 12, 7, '#FFEAA7');
      p(9, 6, 14, 2, '#F0C968');
      p(11, -1, 10, 2, '#C2982E');
      // Light filament core
      p(14, 3, 4, 2, '#FFFFFF');
      break;

    case 'bookshelf':
      // 3D Library Bookcase with Depth & Gold-Embossed Books
      p(1, 26, 30, 5, 'rgba(0, 0, 0, 0.45)');
      p(1, 0, 30, 30, '#4E2C17');
      p(1, 0, 30, 2, '#7A4828'); // crown moulding
      p(3, 2, 26, 26, '#241208'); // dark shelf interior
      // 2 Shelves
      p(3, 14, 26, 2, '#663B1F');
      p(3, 16, 26, 1, 'rgba(0, 0, 0, 0.5)'); // cast shadow under shelf
      const bks = ['#FF4757', '#00D2D3', '#FFA502', '#9B59B6', '#2ED573', '#1E90FF'];
      for (let r = 0; r < 2; r++) {
        const sy = 3 + r * 13;
        for (let b = 0; b < 5; b++) {
          p(4 + b * 5, sy, 4, 11, bks[(b + r * 2) % bks.length]);
          p(5 + b * 5, sy + 3, 2, 1, '#FFEAA7'); // gold foil band
        }
      }
      break;

    case 'plant':
      // Geometric Ceramic Pot with Layered Monstera Leaves
      p(10, 26, 12, 4, 'rgba(0, 0, 0, 0.38)');
      p(10, 16, 12, 11, '#BC6D46');
      p(10, 16, 2, 11, '#D47E55'); // pot highlight
      p(20, 16, 2, 11, '#783E23'); // pot shadow
      p(9, 14, 14, 3, '#D47E55');
      // Lush tropical leaves with vein highlights
      p(5, 2, 12, 12, '#2D8A4E');
      p(7, 5, 8, 1, '#45CC77'); // vein
      p(15, 0, 13, 14, '#1E5E35');
      p(17, 4, 9, 1, '#39A35E');
      p(11, 7, 10, 9, '#2D8A4E');
      break;

    case 'watercooler':
      // Sleek Office Water Cooler with Translucent Bottle
      p(10, 26, 12, 4, 'rgba(0, 0, 0, 0.3)');
      p(12, 1, 8, 9, '#38BDF8');
      p(13, 2, 6, 7, '#7DD3FC');
      p(14, 3, 2, 4, '#FFFFFF'); // water glint
      p(10, 10, 12, 16, '#F1F5F9');
      p(10, 10, 2, 16, '#CBD5E1');
      p(12, 12, 8, 5, '#0F172A'); // dispense alcove
      p(14, 14, 2, 2, '#38BDF8'); // cold tap
      break;

    case 'serverrack':
      // Modern Server Tower with Pulsing Status LEDs
      p(3, 26, 26, 5, 'rgba(0, 0, 0, 0.5)');
      p(3, 0, 26, 30, '#0D131A');
      p(4, 1, 24, 28, '#17202B');
      p(4, 1, 24, 1, '#2E3D50'); // top bevel
      // 5 Server blades
      const cyc = Math.floor(clock / 15);
      for (let un = 0; un < 5; un++) {
        const uy = 3 + un * 5;
        p(5, uy, 22, 4, '#0B0F15');
        // Blinking LEDs
        const ledOn = (cyc + un) % 4;
        p(7, uy + 1, 2, 2, ledOn === 0 ? '#00F5D4' : '#00594D');
        p(11, uy + 1, 2, 2, ledOn === 1 ? '#00FF87' : '#00592E');
        p(15, uy + 1, 2, 2, ledOn === 2 ? '#FFD166' : '#594411');
        p(19, uy + 1, 2, 2, ledOn === 3 ? '#FF0055' : '#59001D');
      }
      break;

    case 'vaultterm':
      // High-Tech Security Vault Terminal with Waveform Display
      p(3, 22, 26, 6, 'rgba(0, 0, 0, 0.45)');
      p(3, 2, 26, 22, '#1E293B');
      p(4, 3, 24, 20, '#0F172A');
      p(5, 5, 22, 15, '#04070B');
      // Animated Neon Waveform
      const off = Math.floor(clock / 8) % 4;
      p(7, 9 + off, 4, 2, '#00F5D4');
      p(12, 11 - off, 4, 2, '#00F5D4');
      p(17, 8 + off, 4, 2, '#FF007F');
      p(21, 10, 3, 2, '#F4D35E');
      // Pedestal stand
      p(11, 24, 10, 6, '#334155');
      p(9, 29, 14, 2, '#1E293B');
      break;

    case 'taskboard':
      // Illuminated Sprint Whiteboard with Real-Time Task Badges
      p(2, 0, 28, 28, '#FFFFFF');
      p(2, 0, 28, 2, '#94A3B8');
      p(3, 2, 26, 24, '#F8FAFC');
      // Header strip
      p(5, 4, 22, 4, '#1E293B');
      p(7, 5, 10, 2, '#00F5D4');
      // Color-coded sprint sticky notes
      p(5, 10, 6, 6, '#FF6B6B');
      p(13, 10, 6, 6, '#4ECDC4');
      p(21, 10, 6, 6, '#FFD166');
      p(5, 18, 6, 6, '#B197FC');
      p(13, 18, 6, 6, '#6BCF7F');
      p(21, 18, 6, 6, '#38BDF8');
      break;

    case 'halltile':
      // Polished Grand Corridor Marble Tile with Inset Ruby Runner
      p(0, 0, T, T, '#E2E8F0');
      p(0, 0, T, 1, '#FFFFFF');
      p(0, T - 1, T, 1, '#CBD5E1');
      p(0, 4, T, T - 8, '#B82A38');
      p(0, 4, T, 1, '#851C27');
      p(0, T - 5, T, 1, '#851C27');
      break;

    case 'couch':
      // Contemporary Plush Velvet Three-Seater Sofa
      p(1, 24, 30, 6, 'rgba(0, 0, 0, 0.42)');
      p(1, 6, 30, 20, '#381820');
      p(2, 5, 28, 19, '#5E2C39');
      p(2, 5, 28, 2, '#7A394A'); // top cushion piping
      // Cushions tufting
      p(5, 8, 10, 10, '#6D3442'); p(5, 8, 10, 1, '#8A4556');
      p(17, 8, 10, 10, '#6D3442'); p(17, 8, 10, 1, '#8A4556');
      // Wooden tapered legs
      p(4, 25, 3, 4, '#542D13');
      p(25, 25, 3, 4, '#542D13');
      break;

    case 'vending':
      // Retro Standup Arcade Machine with Animated Cyber Screen
      p(3, 26, 26, 5, 'rgba(0, 0, 0, 0.5)');
      p(3, 0, 26, 30, '#1E242C');
      p(4, 1, 24, 7, '#FF007F'); // Neon Marquee
      p(6, 2, 20, 5, '#FF409F');
      // Marquee text
      p(9, 4, 10, 2, '#FFFFFF');
      // Arcade Screen with 16-bit game
      p(5, 10, 22, 12, '#0984E3');
      p(5, 18, 22, 4, '#00B894'); // grass
      const pxOff = (Math.floor(clock / 10) % 6) * 2;
      p(8 + pxOff, 15, 3, 3, '#D63031'); // red pixel hero
      p(18, 12, 3, 2, '#FDCB6E'); // gold coin
      // Control panel with joystick
      p(4, 23, 24, 6, '#333D4B');
      p(8, 24, 3, 3, '#E03131'); // red joystick
      p(16, 25, 2, 2, '#00F5D4'); // cyan button
      p(20, 25, 2, 2, '#F4D35E'); // gold button
      break;

    case 'table':
      // Modern Scandinavian Solid Oak Table with Ceramic Mug
      p(2, 24, 28, 5, 'rgba(0, 0, 0, 0.35)');
      p(2, 8, 28, 16, '#6E3A1A');
      p(2, 8, 28, 2, '#9E572B'); // beveled edge
      p(4, 24, 3, 4, '#421E0B');
      p(25, 24, 3, 4, '#421E0B');
      // White ceramic coffee mug
      p(14, 5, 4, 3, '#FFFFFF');
      p(18, 6, 1, 2, '#FFFFFF');
      break;

    case 'chair':
      // Padded Executive Armchair with High Backrest & Chrome Base
      p(7, 24, 18, 5, 'rgba(0, 0, 0, 0.35)');
      p(8, 6, 16, 18, '#1C2028');
      p(9, 7, 14, 14, '#2E3544');
      p(11, 8, 10, 4, '#3A4456'); // headrest cushion
      p(13, 24, 6, 4, '#D4AF37'); // gold swivel base
      p(10, 27, 12, 2, '#D4AF37');
      break;
  }
}

var decorLayerCache = [null, null, null];
function invalidateDecorLayerCache(floorId = activeFloor) {
  if (!decorLayerCache) decorLayerCache = [null, null, null];
  decorLayerCache[floorId] = null;
}
function drawDecor() {
  if (!decorLayerCache) decorLayerCache = [null, null, null];
  let layer = decorLayerCache[activeFloor];
  if (!layer) {
    layer = document.createElement('canvas');
    layer.width = W;
    layer.height = H;
    const targetCtx = ctx;
    const targetCanvas = canvas;
    const layerCtx = layer.getContext('2d');
    canvas = layer;
    ctx = layerCtx;
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < MAP.h; y++) {
      for (let x = 0; x < MAP.w; x++) {
        const item = deco[y][x];
        if (item && !isAtlasItem(item)) drawSprite(x, y, item);
      }
    }
    ctx = targetCtx;
    canvas = targetCanvas;
    decorLayerCache[activeFloor] = layer;
  }
  ctx.drawImage(layer, 0, 0);
}

function atlasItemFromFrame(frameName) {
  const pairs = {
    server_rack_jarvis: 'atlas_server',
    executive_desk_rama: 'atlas_desk',
    arcade_machine_dimas: 'atlas_arcade',
    neon_planter: 'atlas_planter',
    archive_bookshelf_siti: 'bookshelf',
    presentation_board: 'taskboard',
    coffee_station: 'coffee',
    conference_table_budi: 'table',
    security_console_ops: 'security',
    elevator_door_module: 'elevator'
  };
  return Object.keys(pairs).find(item => pairs[item] === frameName) || null;
}

function tileForWorldPosition(x, y) {
  return { x: Math.floor(x), y: Math.floor(y) };
}

function invalidateAtlasWalkBlockers(floorId = activeFloor) {
  atlasBlockersDirty[floorId] = true;
}

function atlasOccupancyAt(floorId, tileX, tileY) {
  if (atlasBlockersDirty[floorId]) {
    const occupied = atlasWalkBlockers[floorId] || (atlasWalkBlockers[floorId] = new Set());
    occupied.clear();
    const addFootprint = (x, y, item) => {
      const frameName = getAtlasFrameName(item);
      if (!frameName) return;
      const footprint = officeAtlas.metadata?.sprites?.[frameName]?.grid_occupancy || { cols: 1, rows: 1 };
      for (let dy = 0; dy < footprint.rows; dy += 1) {
        for (let dx = 0; dx < footprint.cols; dx += 1) occupied.add((x + dx) + ',' + (y + dy));
      }
    };
    if (floorId === activeFloor) {
      for (let y = 0; y < MAP.h; y += 1) {
        for (let x = 0; x < MAP.w; x += 1) {
          if (isAtlasItem(deco[y][x])) addFootprint(x, y, deco[y][x]);
        }
      }
    }
    (customDecor[floorId] || new Map()).forEach((item, key) => {
      if (!isAtlasItem(item)) return;
      const [x, y] = key.split(',').map(Number);
      addFootprint(x, y, item);
    });
    atlasBlockersDirty[floorId] = false;
  }
  return (atlasWalkBlockers[floorId] || new Set()).has(tileX + ',' + tileY);
}

function canPlaceDecorItem(item, tileX, tileY, ignoredKey = null) {
  if (!DECOR_ITEMS.has(item) || item === 'remove') return false;
  if (tileX < 0 || tileX >= MAP.w || tileY < 0 || tileY >= MAP.h) return false;
  const frameName = getAtlasFrameName(item);
  const sprite = frameName && officeAtlas.metadata?.sprites?.[frameName];
  const occupancy = sprite?.grid_occupancy || { cols: 1, rows: 1 };
  if (tileX + occupancy.cols > MAP.w || tileY + occupancy.rows > MAP.h) return false;
  for (let y = tileY; y < tileY + occupancy.rows; y += 1) {
    for (let x = tileX; x < tileX + occupancy.cols; x += 1) {
      if (floor[y][x] === '#3B2A1D') return false;
      if (deco[y][x] && !(x === tileX && y === tileY && isAtlasItem(deco[y][x]))) return false;
      const key = x + ',' + y;
      if (key !== ignoredKey && customDecor[activeFloor]?.has(key)) return false;
      if (AGENTS.some(agent => (agent.floorId || 1) === activeFloor && !agent.inTransit
        && x >= Math.floor(agent.x) && x <= Math.floor(agent.x + 0.75)
        && y >= Math.floor(agent.y) && y <= Math.floor(agent.y + 0.75))) return false;
    }
  }
  return true;
}

const renderQueueBuffer = [];
const occupiedKeysBuffer = new Set();
function drawAtlasDecorAndAgents(frame) {
  const queue = renderQueueBuffer;
  queue.length = 0;
  const occupiedKeys = occupiedKeysBuffer;
  occupiedKeys.clear();
  for (let y = 0; y < MAP.h; y++) {
    for (let x = 0; x < MAP.w; x++) {
      const item = deco[y][x];
      if (item && isAtlasItem(item)) {
        const ownerKey = x + ',' + y;
        if (occupiedKeys.has(ownerKey)) continue;
        const frameName = getAtlasFrameName(item);
        const sprite = officeAtlas.metadata?.sprites?.[frameName];
        if (!sprite) continue;
        const occupancy = sprite.grid_occupancy || { cols: 1, rows: 1 };
        queue.push({ kind: 'atlas', tileX: x, tileY: y, item, sortY: y * T + T });
        for (let dy = 0; dy < occupancy.rows; dy += 1) {
          for (let dx = 0; dx < occupancy.cols; dx += 1) occupiedKeys.add((x + dx) + ',' + (y + dy));
        }
      }
    }
  }

  const customItems = customDecor[activeFloor] || new Map();
  customItems.forEach((item, key) => {
    if (!isAtlasItem(item)) return;
    const separator = key.indexOf(',');
    const tileX = Number(key.slice(0, separator));
    const tileY = Number(key.slice(separator + 1));
    queue.push({ kind: 'atlas', tileX, tileY, item, sortY: tileY * T + T });
  });

  for (let i = 0; i < AGENTS.length; i += 1) {
    const agent = AGENTS[i];
    if ((agent.floorId || 1) !== activeFloor || agent.inTransit) continue;
    // When working behind their desk (y < desk.y), agents sort naturally behind desks
    const isAtDesk = Math.abs(agent.x - agent.homeX) < 0.2 && Math.abs(agent.y - agent.homeY) < 0.2;
    const sortOffset = isAtDesk ? 16 : 32;
    queue.push({ kind: 'agent', agent, sortY: agent.y * T + sortOffset });
  }
  queue.sort((a, b) => (a.sortY - b.sortY) || (a.kind === 'agent' ? -1 : (b.kind === 'agent' ? 1 : 0)));

  for (let i = 0; i < queue.length; i += 1) {
    const entry = queue[i];
    if (entry.kind === 'atlas') {
      const atlasFrameName = getAtlasFrameName(entry.item);
      if (atlasFrameName && officeAtlas.ready && officeAtlas.metadata?.sprites?.[atlasFrameName]) {
        drawAtlasSprite(entry.tileX, entry.tileY, atlasFrameName);
      } else {
        drawSprite(entry.tileX, entry.tileY, entry.item);
      }
      continue;
    }
    const agent = entry.agent;
    const moving = Math.abs(agent.x - agent.homeX) > 0.05 || Math.abs(agent.y - agent.homeY) > 0.05;
    drawCharacter(agent, agent.x, agent.y, moving ? frame : 0, agent.facing || 'down');
    if (agent.id === selectedAgent.id) {
      ctx.save();
      ctx.strokeStyle = agent.palette.accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(Math.round(agent.x * T + 3), Math.round(agent.y * T + 1), 26, 32);
      ctx.restore();
    }
    drawWorldBubble(agent);
  }
}

/* Phase 5B visual treatment: modern room labels, glass runway and restrained neon. */
const FLOOR_LABELS = {
  1: [
    { label: 'SERVER ROOM - JARVIS', x: 0, y: 0, w: 8, accent: '#00F5D4' },
    { label: 'MANAGER - RAMA', x: 8, y: 0, w: 8, accent: '#F4D35E' },
    { label: 'STUDIO - MAYA', x: 16, y: 0, w: 8, accent: '#FF6B6B' },
    { label: 'LOBBY - KRA', x: 24, y: 0, w: 8, accent: '#B197FC' },
    { label: 'RECORDS - SITI', x: 0, y: 7, w: 8, accent: '#6BCF7F' },
    { label: 'MEETING - BUDI', x: 8, y: 7, w: 8, accent: '#4ECDC4' },
    { label: 'PANTRY - TEAM', x: 16, y: 7, w: 8, accent: '#F4D35E' },
    { label: 'PLAY - DIMAS', x: 24, y: 7, w: 8, accent: '#FF6B6B' }
  ],
  2: [
    { label: 'WAR ROOM - EMERGENCY SUMMIT', x: 0, y: 0, w: 16, accent: '#00F5D4' },
    { label: 'ELEVATOR HUB', x: 14, y: 5, w: 4, accent: '#F4D35E' },
    { label: 'INNOVATION STUDIO', x: 16, y: 0, w: 16, accent: '#FF007F' },
    { label: 'SYSTEMS OBSERVATORY', x: 0, y: 7, w: 16, accent: '#B197FC' },
    { label: 'SKY LOUNGE', x: 16, y: 7, w: 16, accent: '#F4D35E' }
  ]
};

const FLOOR_LIGHTS = {
  1: [
    { x: 4.0 * T, y: 2.5 * T, radius: 85, color: 'rgba(0, 245, 212, 0.16)' },
    { x: 12.0 * T, y: 2.5 * T, radius: 85, color: 'rgba(244, 211, 94, 0.14)' },
    { x: 20.0 * T, y: 2.5 * T, radius: 85, color: 'rgba(255, 107, 107, 0.13)' },
    { x: 28.0 * T, y: 2.5 * T, radius: 85, color: 'rgba(177, 151, 252, 0.13)' },
    { x: 4.0 * T, y: 9.5 * T, radius: 85, color: 'rgba(107, 207, 127, 0.13)' },
    { x: 12.0 * T, y: 9.5 * T, radius: 85, color: 'rgba(78, 205, 196, 0.14)' },
    { x: 20.0 * T, y: 9.5 * T, radius: 85, color: 'rgba(244, 211, 94, 0.13)' },
    { x: 28.0 * T, y: 9.5 * T, radius: 85, color: 'rgba(255, 0, 127, 0.14)' }
  ],
  2: [
    { x: 8.0 * T, y: 2.5 * T, radius: 110, color: 'rgba(0, 245, 212, 0.18)' },
    { x: 24.0 * T, y: 2.5 * T, radius: 110, color: 'rgba(255, 0, 127, 0.16)' },
    { x: 8.0 * T, y: 9.5 * T, radius: 110, color: 'rgba(177, 151, 252, 0.15)' },
    { x: 24.0 * T, y: 9.5 * T, radius: 110, color: 'rgba(244, 211, 94, 0.14)' }
  ]
};
var floorOverlayCache = Object.create(null);
function invalidateFloorOverlayCache() {
  floorOverlayCache = Object.create(null);
}
function buildFloorOverlay(floorId) {
  const layer = document.createElement('canvas');
  layer.width = W;
  layer.height = H;
  const overlayCtx = layer.getContext('2d');
  overlayCtx.imageSmoothingEnabled = false;
  // Room titles are drawn in the final render pass, after walls and furniture.
  // Grand Runway: central red carpet corridor connecting all 8 rooms
  overlayCtx.fillStyle = 'rgba(0, 245, 212, 0.22)';
  overlayCtx.fillRect(0, 5 * T, W, 2);
  overlayCtx.fillStyle = 'rgba(255, 255, 255, 0.42)';
  overlayCtx.fillRect(0, 5 * T, W, 1);
  overlayCtx.fillStyle = 'rgba(184, 42, 56, 0.85)';
  overlayCtx.fillRect(0, 5 * T + 3, W, 2 * T - 6);
  overlayCtx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  overlayCtx.fillRect(0, 7 * T - 2, W, 2);
  overlayCtx.globalCompositeOperation = 'screen';
  const pulseFactor = 1.0 + 0.25 * Math.sin(clock / 20);
  (FLOOR_LIGHTS[floorId] || FLOOR_LIGHTS[1]).forEach(light => {
    const radius = Math.round(light.radius * pulseFactor);
    const gradient = overlayCtx.createRadialGradient(light.x, light.y, 3, light.x, light.y, radius);
    gradient.addColorStop(0, light.color);
    gradient.addColorStop(0.5, light.color.replace(/0\.\d+\)/, '0.05)'));
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    overlayCtx.fillStyle = gradient;
    overlayCtx.fillRect(light.x - radius, light.y - radius, radius * 2, radius * 2);
  });
  overlayCtx.globalCompositeOperation = 'source-over';
  return layer;
}
function drawPhase5BOverlay() {
  const layer = buildFloorOverlay(activeFloor);
  ctx.drawImage(layer, 0, 0);
}

// Room titles are deliberately redrawn above architectural walls so every room remains readable.
function drawRoomTitles(floorId) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.font = 'bold 10px monospace';
  (FLOOR_LABELS[floorId] || FLOOR_LABELS[1]).forEach(r => {
    const x = r.x * T + 5, y = r.y * T + 5;
    const width = Math.max(106, Math.min(r.w * T - 10, ctx.measureText(r.label).width + 18));
    ctx.fillStyle = 'rgba(10, 14, 22, 0.94)';
    ctx.fillRect(x, y, width, 17);
    ctx.fillStyle = r.accent;
    ctx.fillRect(x, y, 3, 17);
    ctx.fillStyle = '#F4F7FB';
    ctx.fillText(r.label, x + 8, y + 12);
  });
  ctx.restore();
}

/* Animated ambient furniture: monitors, lamps, terminals, plants and neon fixtures. */
function drawAnimatedFurniture() {
  if (activeFloor !== 1) return;
  ctx.save();
  const pulse = 0.55 + 0.45 * Math.sin(clock * 0.09);
  ctx.globalCompositeOperation = 'screen';
  [[6, 3, '#00F5D4'], [13, 3, '#F4D35E'], [20, 3, '#FF6B6B'], [26, 3, '#B197FC']].forEach(([tx, ty, color]) => {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.25 + pulse * 0.35;
    ctx.fillRect(tx * T + 6, ty * T + 19, 4, 2);
  });
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // Plant leaves gently sway; small highlights make props feel alive without losing pixel clarity.
  const sway = Math.round(Math.sin(clock * 0.07) * 2);
  ctx.fillStyle = '#22C55E';
  ctx.fillRect(8 * T + sway, 4 * T - 8, 3, 7);
  ctx.fillRect(8 * T + 8 - sway, 4 * T - 5, 3, 6);
  ctx.restore();
}

/* True when an agent is standing in the lift lobby or riding the elevator. */
function agentAtElevator() {
  const liftX = 11.5;
  const liftY = 5.5;
  for (let i = 0; i < AGENTS.length; i += 1) {
    const agent = AGENTS[i];
    if ((agent.floorId || 1) !== activeFloor) continue;
    if (agent.inTransit) return true;
    if (Math.abs(agent.x - liftX) < 1.4 && Math.abs(agent.y - liftY) < 1.2) return true;
  }
  return false;
}

function drawOfficeWalls(floorId) {
  if (floorId !== 1) {
    ctx.save();
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, 0, W, 24);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 7 * T - 8, W, 12);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const liftOpen = Math.floor(clock / 18) % 8 === 6 || agentAtElevator();

  // 1. TOP BACK WALL (y: 0..28px across top)
  // --- Server Room (x: 0..256px) ---
  ctx.fillStyle = '#141E28';
  ctx.fillRect(0, 0, 8 * T, 28);
  for (let px = 0; px <= 8 * T; px += 32) {
    ctx.fillStyle = '#0B1117'; ctx.fillRect(px, 0, 1, 28);
    ctx.fillStyle = '#223244'; ctx.fillRect(px + 1, 0, 1, 28);
  }
  ctx.fillStyle = '#2A3C50'; ctx.fillRect(0, 0, 8 * T, 3);

  // --- Manager Suite (x: 256..512px) ---
  ctx.fillStyle = '#7A828A'; ctx.fillRect(8 * T, 0, 8 * T, 12);
  for (let px = 8 * T; px <= 16 * T; px += 64) {
    ctx.fillStyle = '#555C64'; ctx.fillRect(px, 0, 2, 12);
    ctx.fillStyle = '#A4ACB4'; ctx.fillRect(px + 2, 0, 1, 12);
  }
  ctx.fillStyle = '#4A2A16'; ctx.fillRect(8 * T, 12, 8 * T, 3);
  ctx.fillStyle = '#653E22'; ctx.fillRect(8 * T, 15, 8 * T, 13);
  for (let px = 8 * T; px < 16 * T; px += 8) {
    ctx.fillStyle = '#452914'; ctx.fillRect(px, 15, 1, 13);
    ctx.fillStyle = '#7E502F'; ctx.fillRect(px + 1, 15, 1, 13);
  }

  // --- Studio & Lobby (x: 512..1024px) ---
  ctx.fillStyle = '#B0A89C'; ctx.fillRect(16 * T, 0, 16 * T, 28);
  ctx.fillStyle = '#65503E'; ctx.fillRect(16 * T, 0, 16 * T, 3);
  ctx.fillStyle = '#7A6B5C'; ctx.fillRect(16 * T, 25, 16 * T, 3);
  for (let px = 16 * T; px <= 32 * T; px += 64) {
    ctx.fillStyle = '#92887C'; ctx.fillRect(px, 3, 2, 22);
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'; ctx.fillRect(0, 28, W, 4);

  // 2. VERTICAL ROOM DIVIDERS (Posts between adjacent rooms)
  [8 * T, 16 * T, 24 * T].forEach(dx => {
    ctx.fillStyle = '#4A2D1A'; ctx.fillRect(dx - 2, 0, 4, 150);
    ctx.fillStyle = '#784B2C'; ctx.fillRect(dx - 1, 0, 1, 150);
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(dx + 2, 0, 2, 150);

    ctx.fillStyle = '#4A2D1A'; ctx.fillRect(dx - 2, 230, 4, 154);
    ctx.fillStyle = '#784B2C'; ctx.fillRect(dx - 1, 230, 1, 154);
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(dx + 2, 230, 2, 154);
  });

  // 3. UPPER CORRIDOR DIVIDING WALL (y: 146..184px - solid thick wall)
  ctx.fillStyle = '#5C381F'; ctx.fillRect(0, 146, W, 6);
  ctx.fillStyle = '#8A5632'; ctx.fillRect(0, 146, W, 1);
  ctx.fillStyle = '#382112'; ctx.fillRect(0, 151, W, 1);

  ctx.fillStyle = '#78828D'; ctx.fillRect(0, 152, W, 26);
  for (let px = 0; px < W; px += 64) {
    ctx.fillStyle = '#4A525B'; ctx.fillRect(px, 152, 2, 26);
    ctx.fillStyle = '#A0AAB5'; ctx.fillRect(px + 2, 152, 1, 26);
  }
  ctx.fillStyle = '#3A424A'; ctx.fillRect(0, 178, W, 4);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'; ctx.fillRect(0, 182, W, 4);

  // 4. INTEGRATED ELEVATOR MODULE (at x = 11.5 * T = 368..420, y = 142..184)
  const elX = 11 * T + 16;
  const elW = 54;
  const elY = 142;
  const elH = 42;
  ctx.fillStyle = '#566370'; ctx.fillRect(elX, elY, elW, elH);
  ctx.fillStyle = '#94A3B8'; ctx.fillRect(elX, elY, elW, 2);
  ctx.fillStyle = '#94A3B8'; ctx.fillRect(elX, elY, 3, elH);
  ctx.fillStyle = '#94A3B8'; ctx.fillRect(elX + elW - 3, elY, 3, elH);
  ctx.fillStyle = '#1E293B'; ctx.fillRect(elX + 3, elY + 2, elW - 6, elH - 2);

  // Integrated illuminated "ELEVATOR • LIFT" header marquee directly on the elevator housing
  ctx.fillStyle = '#0F172A'; ctx.fillRect(elX + 5, elY + 2, elW - 10, 8);
  ctx.fillStyle = '#00F5D4'; ctx.fillRect(elX + 5, elY + 2, 2, 8);
  ctx.fillStyle = '#38BDF8';
  ctx.font = 'bold 6px monospace';
  ctx.fillText('ELEVATOR', elX + 9, elY + 8);

  const doorW = Math.floor((elW - 12) / 2);
  const doorH = elH - 11;
  const slideOffset = liftOpen ? Math.min(doorW - 2, 10) : 0;

  const gradL = ctx.createLinearGradient(elX + 4 - slideOffset, 0, elX + 4 + doorW - slideOffset, 0);
  gradL.addColorStop(0, '#7D8C9C'); gradL.addColorStop(0.5, '#BACAD8'); gradL.addColorStop(1, '#687786');
  ctx.fillStyle = gradL; ctx.fillRect(elX + 4 - slideOffset, elY + 11, doorW, doorH);

  const gradR = ctx.createLinearGradient(elX + 6 + doorW + slideOffset, 0, elX + 6 + doorW * 2 + slideOffset, 0);
  gradR.addColorStop(0, '#687786'); gradR.addColorStop(0.5, '#BACAD8'); gradR.addColorStop(1, '#7D8C9C');
  ctx.fillStyle = gradR; ctx.fillRect(elX + 6 + doorW + slideOffset, elY + 11, doorW, doorH);
  ctx.fillStyle = '#24303E'; ctx.fillRect(elX + 4 + doorW, elY + 11, 2, doorH);

  ctx.fillStyle = '#334155'; ctx.fillRect(elX + elW - 7, elY + 14, 5, 12);
  ctx.fillStyle = '#00F5D4'; ctx.fillRect(elX + elW - 6, elY + 16, 3, 3);
  ctx.fillStyle = '#F59E0B'; ctx.fillRect(elX + elW - 6, elY + 21, 3, 3);

  // Red Fire Extinguisher to left of elevator
  const feX = elX - 16;
  const feY = 158;
  ctx.fillStyle = '#DC2626'; ctx.fillRect(feX, feY, 7, 13);
  ctx.fillStyle = '#EF4444'; ctx.fillRect(feX + 1, feY + 1, 2, 11);
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(feX + 2, feY + 4, 3, 4);
  ctx.fillStyle = '#1E293B'; ctx.fillRect(feX + 2, feY - 2, 3, 2);

  // Potted plant to right of elevator
  const plX = elX + elW + 6;
  const plY = 150;
  ctx.fillStyle = '#B45309'; ctx.fillRect(plX + 3, plY + 16, 10, 9);
  ctx.fillStyle = '#D97706'; ctx.fillRect(plX + 1, plY + 14, 14, 3);
  ctx.fillStyle = '#15803D';
  ctx.fillRect(plX + 2, plY + 4, 5, 10);
  ctx.fillRect(plX + 9, plY + 4, 5, 10);
  ctx.fillRect(plX + 5, plY, 6, 12);
  ctx.fillStyle = '#22C55E';
  ctx.fillRect(plX + 3, plY + 6, 3, 6);
  ctx.fillRect(plX + 10, plY + 6, 3, 6);

  // 5. LOWER CORRIDOR DIVIDING WALL & PARTITIONS (y: 216..240px - solid thick wall)
  // Meeting Room Glass Partition (x: 256..512px)
  ctx.fillStyle = '#5C381F'; ctx.fillRect(8 * T, 216, 8 * T, 4);
  ctx.fillStyle = '#8A5632'; ctx.fillRect(8 * T, 216, 8 * T, 1);
  for (let gx = 8 * T; gx < 16 * T; gx += 48) {
    if (gx >= 11 * T && gx < 12 * T) continue; // Doorway!
    ctx.fillStyle = '#3E4650'; ctx.fillRect(gx, 220, 46, 16);
    ctx.fillStyle = 'rgba(180, 215, 235, 0.45)'; ctx.fillRect(gx + 2, 222, 42, 12);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(gx + 6, 223, 8, 10);
    ctx.fillRect(gx + 22, 223, 12, 10);
  }
  ctx.fillStyle = '#3E4650'; ctx.fillRect(8 * T, 236, 8 * T, 2);

  // Records Room Partition (x: 0..256px)
  ctx.fillStyle = '#5C381F'; ctx.fillRect(0, 216, 8 * T, 4);
  ctx.fillStyle = '#78828D'; ctx.fillRect(0, 220, 8 * T, 16);
  for (let px = 0; px < 8 * T; px += 48) {
    if (px >= 3 * T && px < 4 * T) continue; // Doorway!
    ctx.fillStyle = 'rgba(180, 215, 235, 0.35)'; ctx.fillRect(px + 4, 222, 40, 12);
    ctx.fillStyle = '#4A525B'; ctx.fillRect(px, 220, 2, 16);
  }
  ctx.fillStyle = '#3A424A'; ctx.fillRect(0, 236, 8 * T, 2);

  // Pantry Partition (x: 512..768px)
  ctx.fillStyle = '#5C381F'; ctx.fillRect(16 * T, 216, 8 * T, 4);
  ctx.fillStyle = '#8A929C'; ctx.fillRect(16 * T, 220, 8 * T, 16);
  for (let px = 16 * T; px < 24 * T; px += 48) {
    if (px >= 19 * T && px < 20 * T) continue; // Doorway!
    ctx.fillStyle = 'rgba(180, 215, 235, 0.35)'; ctx.fillRect(px + 4, 222, 40, 12);
  }
  ctx.fillStyle = '#3A424A'; ctx.fillRect(16 * T, 236, 8 * T, 2);

  // Play Lounge Wall (x: 768..1024px)
  ctx.fillStyle = '#5C381F'; ctx.fillRect(24 * T, 216, 8 * T, 4);
  ctx.fillStyle = '#8A5632'; ctx.fillRect(24 * T, 216, 8 * T, 1);
  ctx.fillStyle = '#653E22'; ctx.fillRect(24 * T, 220, 8 * T, 16);
  for (let px = 24 * T; px < 32 * T; px += 32) {
    if (px >= 27 * T && px < 28 * T) continue; // Doorway!
    ctx.fillStyle = '#452914'; ctx.fillRect(px, 220, 2, 16);
    ctx.fillStyle = '#7E502F'; ctx.fillRect(px + 2, 220, 1, 16);
  }
  ctx.fillStyle = '#382112'; ctx.fillRect(24 * T, 236, 8 * T, 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'; ctx.fillRect(0, 238, W, 4);

  ctx.restore();
}

function drawNeonLightningAndEffects(floorId) {
  if (floorId !== 1) return;
  ctx.save();

  // 1. BILLIARD TABLE NEON LASER LIGHTNING SCANNING (PLAY LOUNGE - DIMAS)
  const tblX = 26.5 * T;
  const tblY = 9.4 * T;
  const tblW = 88;
  const tblH = 44;
  const emitY = 7.5 * T;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const laserGlow = ctx.createRadialGradient(tblX + tblW / 2, tblY + tblH / 2, 10, tblX + tblW / 2, tblY + tblH / 2, 80);
  laserGlow.addColorStop(0, 'rgba(255, 0, 128, 0.35)');
  laserGlow.addColorStop(0.5, 'rgba(255, 105, 180, 0.15)');
  laserGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = laserGlow;
  ctx.fillRect(tblX - 20, tblY - 20, tblW + 40, tblH + 40);

  const corners = [
    { x: tblX + 8, y: tblY + 8 },
    { x: tblX + tblW - 8, y: tblY + 8 },
    { x: tblX + 8, y: tblY + tblH - 8 },
    { x: tblX + tblW - 8, y: tblY + tblH - 8 }
  ];

  corners.forEach(c => {
    ctx.strokeStyle = 'rgba(255, 0, 128, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(c.x, emitY);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(c.x, emitY);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(c.x - 2, c.y - 2, 4, 4);
    ctx.fillStyle = '#FF007F';
    ctx.fillRect(c.x - 3, c.y - 3, 6, 6);
  });

  const scanSweep = Math.sin(clock / 15) * 16;
  const scanSweep2 = Math.cos(clock / 20) * 12;

  const laserTargets = [
    { x: tblX + 24 + scanSweep, y: tblY + 16 },
    { x: tblX + 44 + scanSweep2, y: tblY + 22 },
    { x: tblX + 64 - scanSweep, y: tblY + 18 },
    { x: tblX + 32, y: tblY + 28 },
    { x: tblX + 56, y: tblY + 26 }
  ];

  const beamPairs = [
    [corners[0], laserTargets[1]],
    [corners[1], laserTargets[0]],
    [corners[0], laserTargets[2]],
    [corners[1], laserTargets[3]],
    [corners[2], laserTargets[1]],
    [corners[3], laserTargets[0]],
    [corners[2], laserTargets[2]],
    [corners[3], laserTargets[4]],
    [laserTargets[0], laserTargets[2]],
    [laserTargets[1], laserTargets[4]]
  ];

  beamPairs.forEach(([p1, p2]) => {
    ctx.strokeStyle = 'rgba(255, 0, 128, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    ctx.strokeStyle = '#FFE0F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  });

  laserTargets.forEach(tgt => {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(tgt.x - 1, tgt.y - 1, 3, 3);
  });
  ctx.restore();

  // Dimas "Scanning for risks." speech bubble
  const bX = 24.2 * T + 2;
  const bY = 8.5 * T - 4;
  const bW = 126;
  const bH = 18;
  ctx.fillStyle = '#0F131D';
  ctx.fillRect(bX, bY, bW, bH);
  ctx.strokeStyle = '#F4D35E';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bX, bY, bW, bH);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 9px monospace';
  ctx.fillText('Scanning for risks.', bX + 6, bY + 12);
  // animated scan cursor and signal dots
  ctx.fillStyle = '#F4D35E';
  ctx.fillRect(bX + bW - 19 + (Math.floor(clock / 8) % 3) * 4, bY + 5, 2, 2);

  // 2. SERVER ROOM NEON CONDUIT & FIBER CABLES
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = 'rgba(0, 245, 212, 0.7)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 16);
  ctx.lineTo(8 * T, 16);
  ctx.stroke();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 16);
  ctx.lineTo(8 * T, 16);
  ctx.stroke();

  const ledColors = ['#00F5D4', '#FF007F', '#FFD166', '#38BDF8', '#22C55E'];
  const step = Math.floor(clock / 6) % 10;
  for (let lx = 6; lx < 8 * T - 8; lx += 12) {
    const colIdx = Math.floor((lx / 12 + step) % ledColors.length);
    ctx.fillStyle = ledColors[colIdx];
    ctx.fillRect(lx, 21, 5, 2);
  }

  // Curved fiber cables into racks
  ctx.strokeStyle = '#FF007F';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(38, 23);
  ctx.bezierCurveTo(42, 38, 54, 42, 54, 60);
  ctx.stroke();

  ctx.strokeStyle = '#00F5D4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(96, 23);
  ctx.bezierCurveTo(90, 36, 82, 44, 82, 60);
  ctx.stroke();

  // Multi-cable loop between racks
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(112, 68);
  ctx.bezierCurveTo(130, 80, 150, 80, 168, 68);
  ctx.stroke();

  ctx.strokeStyle = '#FF007F';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(112, 73);
  ctx.bezierCurveTo(130, 85, 150, 85, 168, 73);
  ctx.stroke();

  ctx.strokeStyle = '#22C55E';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(112, 78);
  ctx.bezierCurveTo(130, 90, 150, 90, 168, 78);
  ctx.stroke();

  // Volumetric floor glow under servers
  const srvGlow = ctx.createRadialGradient(100, 90, 10, 100, 90, 75);
  srvGlow.addColorStop(0, 'rgba(0, 245, 212, 0.25)');
  srvGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = srvGlow;
  ctx.fillRect(20, 40, 180, 100);

  // 3. WARM DESK LAMP LIGHTING POOLS
  const ramaLamp = ctx.createRadialGradient(348, 90, 4, 348, 90, 52);
  ramaLamp.addColorStop(0, 'rgba(255, 235, 140, 0.42)');
  ramaLamp.addColorStop(0.5, 'rgba(245, 210, 90, 0.18)');
  ramaLamp.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = ramaLamp;
  ctx.fillRect(348 - 52, 90 - 52, 104, 104);

  const sitiLamp = ctx.createRadialGradient(88, 307, 4, 88, 307, 48);
  sitiLamp.addColorStop(0, 'rgba(255, 235, 140, 0.38)');
  sitiLamp.addColorStop(0.5, 'rgba(245, 210, 90, 0.15)');
  sitiLamp.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = sitiLamp;
  ctx.fillRect(88 - 48, 307 - 48, 96, 96);

  const budiLamp = ctx.createRadialGradient(328, 307, 4, 328, 307, 48);
  budiLamp.addColorStop(0, 'rgba(255, 235, 140, 0.38)');
  budiLamp.addColorStop(0.5, 'rgba(245, 210, 90, 0.15)');
  budiLamp.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = budiLamp;
  ctx.fillRect(328 - 48, 307 - 48, 96, 96);

  ctx.restore();
  ctx.restore();
}

// Invalidate overlay cache when lights need update
// setInterval(invalidateFloorOverlayCache, 100);

/* ---------- 4. AGENTS ---------- */
// Grid positions (tile coords) — desks are drawn at (tx, ty)
window.KRA_APP_READY = false;
window.KRA_APP_BOOT_STARTED = performance.now();
window.KRA_APP_READY_AT = 0;
window.KRA_APP_ATLAS_READY_AT = 0;
const AGENTS = [
  {
    id: 'rama', name: 'RAMA', role: 'Executive Boss / Lead Auditor',
    x: 10.5, y: 2.1, homeX: 10.5, homeY: 2.1, floorId: 1, inTransit: false,
    badge: 'badge-boss', status: 'supervising',
    palette: { skin: '#F2C79B', hair: '#241A12', primary: '#1F2A44', accent: '#F4D35E' },
    intro: "Rama: I'm watching the floor. Bring me finished work, not drafts."
  },
  {
    id: 'jarvis', name: 'JARVIS', role: 'Infrastructure Daemon / SysAdmin',
    x: 5.5, y: 2.2, homeX: 5.5, homeY: 2.2, floorId: 1, inTransit: false,
    badge: 'badge-ops', status: 'monitoring systems',
    palette: { skin: '#E5B887', hair: '#5C3A21', primary: '#3B82F6', accent: '#00F5D4' },
    intro: 'Jarvis: Core systems operating within nominal parameters.'
  },
  {
    id: 'creator', name: 'BUDI', role: 'Scaffolding & Asset Production',
    x: 10.5, y: 8.2, homeX: 10.5, homeY: 8.2, floorId: 1, inTransit: false,
    badge: 'badge-idle', status: 'standing by',
    palette: { skin: '#E8B98A', hair: '#4A2F1B', primary: '#4ECDC4', accent: '#FFF8E7' },
    intro: 'Budi: Ready to scaffold. Point me at a folder.'
  },
  {
    id: 'modifier', name: 'MAYA', role: 'Code & Config Refactoring',
    x: 20.5, y: 2.1, homeX: 20.5, homeY: 2.1, floorId: 1, inTransit: false,
    badge: 'badge-idle', status: 'standing by',
    palette: { skin: '#C88B62', hair: '#1A1320', primary: '#FF6B6B', accent: '#FFEC99' },
    intro: 'Maya: Give me a target file and a spec.'
  },
  {
    id: 'auditor', name: 'DIMAS', role: 'Diagnostics & Security Review',
    x: 25.2, y: 9.2, homeX: 25.2, homeY: 9.2, floorId: 1, inTransit: false,
    badge: 'badge-auditor', status: 'Scanning for risks.',
    palette: { skin: '#F0D0A8', hair: '#6B4A2B', primary: '#B197FC', accent: '#FF007F' },
    intro: 'Dimas: I read everything. Nothing gets past me.'
  },
  {
    id: 'ops', name: 'SITI', role: 'Filesystem & Directory Management',
    x: 2.5, y: 8.2, homeX: 2.5, homeY: 8.2, floorId: 1, inTransit: false,
    badge: 'badge-idle', status: 'standing by',
    palette: { skin: '#E8B98A', hair: '#2B2B2B', primary: '#FFD93D', accent: '#3D2E4A' },
    intro: 'Siti: The vault stays tidy on my watch.'
  }
];

function mergePersistedAgents(saved) {
  if (!Array.isArray(saved)) return;
  saved.forEach(agent => {
    if (!agent || !agent.id || AGENTS.some(existing => existing.id === agent.id)) return;
    AGENTS.push({
      ...agent,
      x: Number(agent.x) || 1,
      y: Number(agent.y) || 14,
      homeX: Number(agent.homeX) || Number(agent.x) || 1,
      homeY: Number(agent.homeY) || Number(agent.y) || 14,
      floorId: Number(agent.floorId) || 1,
      inTransit: Boolean(agent.inTransit),
      badge: agent.badge || 'badge-idle',
      status: agent.status || 'standing by',
      palette: agent.palette || {
        skin: '#E8B98A', hair: '#241A12', primary: '#FF6B6B', accent: '#FFF8E7'
      },
      intro: agent.intro || agent.name + ': Ready to contribute on Rama\'s floor.'
    });
    registerHiredChatChannel(agent);
  });
}

/* --- Sprite drawing: 30x31 authored on a 32 tile, readable at room scale --- */
/* Batch 2 agent sheets: 19 cols x 4 rows of 32x40 frames. */
const AGENT_SHEET = {
  cols: { idle: [0, 4], walk: [4, 4], terminal: [8, 4], inspect: [12, 4], talk: [16, 3] },
  rows: { down: 0, left: 1, right: 2, up: 3 }
};
const agentSheets = new Map();

function loadAgentSheet(key) {
  if (agentSheets.has(key)) return agentSheets.get(key);
  const entry = { ready: false, composite: null };
  agentSheets.set(key, entry);
  const base = '../assets/argon/Batch2_Agents_Core/01_Agent_Spritesheets/' + key + '_spritesheet_';
  Promise.all([loadImageAsset(base + 'diffuse.png'), loadImageAsset(base + 'emission.png')])
    .then(([diffuse, emission]) => {
      const canvas = document.createElement('canvas');
      canvas.width = diffuse.naturalWidth;
      canvas.height = diffuse.naturalHeight;
      const c = canvas.getContext('2d');
      c.imageSmoothingEnabled = false;
      c.drawImage(diffuse, 0, 0);
      c.globalCompositeOperation = 'screen';
      c.drawImage(emission, 0, 0);
      entry.composite = canvas;
      entry.ready = true;
    })
    .catch(error => console.warn('[Agent sheet] ' + key + ': ' + error.message));
  return entry;
}

/* Batch 5: Cybercat & Event FX */
const cybercatSheets = new Map();
const CYBERCAT_META = {
  cybercat_sleep: 2, cybercat_idle: 4, cybercat_walk: 4, cybercat_run: 6,
  cybercat_inspect_terminal: 4, cybercat_follow_agent: 4, cybercat_react_alert: 2, cybercat_curl_near_couch: 2
};

function loadCybercatSheet(animId) {
  if (cybercatSheets.has(animId)) return cybercatSheets.get(animId);
  const entry = { ready: false, image: null, frames: CYBERCAT_META[animId] || 4 };
  cybercatSheets.set(animId, entry);
  const url = '../assets/argon/Batch5_Cybercat_and_Event_FX/' + animId + '_spritesheet.png';
  loadImageAsset(url).then(img => {
    entry.image = img;
    entry.ready = true;
  }).catch(() => {});
  return entry;
}

function drawCybercatSprite(px, py, animId = 'cybercat_idle') {
  const sheet = loadCybercatSheet(animId);
  if (!sheet.ready) return false;
  const frame = Math.floor(clock / 10) % sheet.frames;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet.image, frame * 20, 0, 20, 20, px, py, 20, 20);
  ctx.restore();
  return true;
}

function drawAgentSheet(agent, X, Y, state, facing) {
  const ID_MAP = {
    rama: 'rama', jarvis: 'jarvis', creator: 'budi', budi: 'budi',
    modifier: 'maya', maya: 'maya', ops: 'siti', siti: 'siti',
    auditor: 'dimas', dimas: 'dimas'
  };
  const key = ID_MAP[agent.id] || agent.id;
  const sheet = loadAgentSheet(key);
  if (!sheet.ready) return false;
  const [col, count] = AGENT_SHEET.cols[state];
  const row = AGENT_SHEET.rows[facing] ?? AGENT_SHEET.rows.down;
  const sx = (col + (Math.floor(clock / 8) % count)) * 32;
  const sy = row * 40;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet.composite, sx, sy, 32, 40, X, Y - 8, 32, 40);
  ctx.restore();
  return true;
}

function drawCharacter(agent, wx, wy, frame, facing) {
  const X = Math.round(wx * T);
  const Y = Math.round(wy * T);
  const pal = agent.palette;
  const p = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(X + x, Y + y, w, h); };
  const outline = DECO.ink;
  const step = (frame === 1) ? -1 : (frame === 3 ? 1 : 0);
  const idleOffset = Math.sin(clock * 0.055 + X * 0.03) > 0.82 ? -1 : 0;

  // Grounded pixel shadow with a cool neon contact rim
  ctx.fillStyle = 'rgba(0,0,0,0.36)';
  ctx.beginPath();
  ctx.ellipse(X + 16, Y + 30, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0, 245, 212, 0.28)';
  ctx.fillRect(X + 9, Y + 31, 14, 1);

  // Batch 2 agent sheet; procedural body below is the fallback until the sheet loads
  const sheetMoving = Math.abs(agent.x - agent.homeX) > 0.05 || Math.abs(agent.y - agent.homeY) > 0.05;
  const sheetState = agent.state === AGENT_STATES.COMMUNICATING ? 'talk'
    : (agent.state === AGENT_STATES.WORKING || agent.status === 'coding') ? 'terminal'
      : sheetMoving ? 'walk' : 'idle';
  if (drawAgentSheet(agent, X, Y, sheetState, facing)) return;

  // legs / shoes
  p(10, 25 + step + idleOffset, 5, 5, outline);
  p(17, 25 - step + idleOffset, 5, 5, outline);

  // torso (outfit)
  p(8, 14 + idleOffset, 16, 12, outline);
  p(9, 15 + idleOffset, 14, 10, pal.primary);
  // shirt accent band and subtle jacket shading
  p(9, 15 + idleOffset, 14, 3, pal.accent);
  p(10, 18 + idleOffset, 2, 6, 'rgba(255,255,255,0.16)');
  p(20, 18 + idleOffset, 2, 6, 'rgba(0,0,0,0.18)');
  // animated arms: typing at desk, gesturing while communicating, relaxed otherwise
  const working = agent.state === AGENT_STATES.WORKING || agent.status === 'coding' || agent.status === 'monitoring systems';
  const gesture = agent.state === AGENT_STATES.COMMUNICATING ? Math.round(Math.sin(clock * 0.16)) : (working ? Math.round(Math.sin(clock * 0.2)) : 0);
  p(5, 17 + idleOffset + gesture, 4, 7, outline);
  p(23, 17 + idleOffset - gesture, 4, 7, outline);
  p(6, 22 + idleOffset + gesture, 3, 2, pal.skin);
  p(23, 22 + idleOffset - gesture, 3, 2, pal.skin);
  // boss tie

  if (agent.id === 'rama') { p(14, 17 + idleOffset, 4, 8, pal.accent); p(15, 17 + idleOffset, 2, 8, '#C99A2E'); }

  // head
  p(8, 4 + idleOffset, 16, 12, outline);
  p(9, 5 + idleOffset, 14, 10, pal.skin);
  // hair
  p(8, 3 + idleOffset, 16, 5, pal.hair);
  p(8, 8 + idleOffset, 3, 3, pal.hair);
  p(21, 8 + idleOffset, 3, 3, pal.hair);

  // tiny face highlights, blink every few seconds for a more human rhythm
  const blink = Math.floor(clock / 90) % 9 === 0 && clock % 90 < 5;
  if (blink && facing !== 'up') {
    p(11, 10 + idleOffset, 3, 1, pal.skin);
    p(18, 10 + idleOffset, 3, 1, pal.skin);
  }
  // eyes by facing
  if (facing === 'up') {
    p(10, 5 + idleOffset, 12, 4, pal.hair);
  } else if (facing === 'left') {
    p(10, 9 + idleOffset, 3, 3, outline);
  } else if (facing === 'right') {
    p(19, 9 + idleOffset, 3, 3, outline);
  } else {
    p(11, 9 + idleOffset, 3, 3, outline);
    p(18, 9 + idleOffset, 3, 3, outline);
  }
}

/* Boss-side portrait (48px canvas) */
function drawPortrait() {
  const pc = document.getElementById('portrait-canvas');
  const pctx = pc.getContext('2d');
  pctx.imageSmoothingEnabled = false;
  const scale = 2;
  pctx.fillStyle = DECO.ink;
  pctx.fillRect(0, 0, 48, 48);
  const pal = (selectedAgent && selectedAgent.palette) || AGENTS[0].palette;
  const p = (x, y, w, h, c) => {
    pctx.fillStyle = c;
    pctx.fillRect(x * scale, y * scale, w * scale, h * scale);
  };
  p(2, 2, 20, 20, '#2A2434');
  p(8, 4, 8, 2, '#2A2434');
  const outline = DECO.ink;
  p(4, 10, 16, 12, outline);
  p(5, 11, 14, 10, pal.primary);
  p(5, 11, 14, 3, pal.accent);
  p(11, 11, 2, 4, '#FFF8E7');
  p(11, 15, 2, 7, '#C99A2E');
  p(4, 3, 16, 9, outline);
  p(5, 4, 14, 7, pal.skin);
  p(4, 2, 16, 3, pal.hair);
  p(7, 7, 2, 2, outline);
  p(15, 7, 2, 2, outline);
}

/* ---------- 5. RENDER LOOP ---------- */
let frameCounter = 0;
let clock = 0;
let activityQueue = [];

/* ---------- 5A. AGENT STATE MACHINE & LOCAL EVENT BUS ---------- */
const AGENT_STATES = Object.freeze({
  IDLE: 'idle', AMBIENT: 'ambient', THINKING: 'thinking', MOVING: 'moving',
  IN_TRANSIT: 'in_transit',
  WORKING: 'working', COMMUNICATING: 'communicating', WAITING_APPROVAL: 'waiting_approval',
  BLOCKED: 'blocked', RETURNING: 'returning'
});
const STATE_TRANSITIONS = {
  idle: ['ambient', 'thinking', 'moving', 'in_transit', 'working', 'waiting_approval'],
  ambient: ['idle', 'moving', 'communicating'],
  thinking: ['moving', 'working', 'blocked', 'communicating', 'in_transit'],
  moving: ['working', 'communicating', 'blocked', 'returning', 'in_transit', 'idle'],
  in_transit: ['moving', 'working', 'idle', 'returning', 'communicating'],
  working: ['communicating', 'waiting_approval', 'blocked', 'returning', 'thinking', 'moving'],
  communicating: ['working', 'moving', 'idle', 'blocked'],
  waiting_approval: ['working', 'returning', 'blocked'],
  blocked: ['thinking', 'returning', 'idle'],
  returning: ['idle', 'blocked', 'in_transit', 'moving']
};
const agentEventBus = {
  listeners: {}, history: [], seen: new Set(),
  on(type, handler) { (this.listeners[type] ||= []).push(handler); },
  emit(type, from, payload = {}, to = null) {
    const event = { id: 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      type, from, to, payload, createdAt: new Date().toISOString() };
    this.history.push(event); this.seen.add(event.id);
    (this.listeners[type] || []).forEach(handler => handler(event));
    (this.listeners['*'] || []).forEach(handler => handler(event));
    persistAgentEvent(event);
    return event;
  }
};
function persistPresence(agent) {
  if (!agent) return;
  fetch('../api/index.php?action=presence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      presence: {
        agentId: agent.id,
        state: agent.state || 'idle',
        activity: agent.status || 'standing by',
        x: Math.round(agent.x * 10) / 10,
        y: Math.round(agent.y * 10) / 10,
        floorId: agent.floorId || 1,
        inTransit: Boolean(agent.inTransit),
        bubbleText: agent.bubble || null,
        bubbleKind: agent.bubbleKind || null
      }
    })
  }).catch(() => {});
}

function persistAgentEvent(event) {
  if (!event || !event.id) return;
  const critical = ['approval.requested', 'approval.granted', 'approval.rejected',
    'agent.meeting.joined', 'user.message.sent', 'agent.transition.blocked'];
  if (!critical.includes(event.type)) return;
  fetch('../api/index.php?action=presence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event })
  }).catch(() => {});
}

function setAgentState(agent, next, reason, eventType = 'agent.state.changed') {
  if (!agent || agent.state === next) return true;
  const allowed = STATE_TRANSITIONS[agent.state || 'idle'] || [];
  if (!allowed.includes(next)) {
    agentEventBus.emit('agent.transition.blocked', 'jarvis', { agentId: agent.id, from: agent.state || 'idle', to: next, reason });
    return false;
  }
  const previous = agent.state || 'idle';
  agent.state = next;
  agent.status = reason || next.replace('_', ' ');
  agentEventBus.emit(eventType, agent.id, { previous, state: next, reason }, null);
  persistPresence(agent);
  return true;
}
function agentBubble(agent, text, kind = 'speech', ms = 3200) {
  agent.bubble = text; agent.bubbleKind = kind; agent.bubbleUntil = performance.now() + ms;
  agentEventBus.emit('agent.message.sent', agent.id, { text, kind }, null);
  persistPresence(agent);
}
agentEventBus.on('agent.message.sent', event => {
  const agent = AGENTS.find(item => item.id === event.from);
  if (agent) showBubble(agent.name, event.payload.text, event.payload.kind === 'system' ? 4200 : 3200, agent);
});
agentEventBus.on('agent.state.changed', event => {
  const agent = AGENTS.find(item => item.id === event.from);
  if (agent) buildRoster();
});

/* Pilar 4: collaboration scenes use actual chat summaries, never invented reasoning. */
function recordMeetingInVault(topic, participants, dialogues, verdict = 'APPROVED') {
  return fetch('../api/index.php?action=meeting-record', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, participants, dialogues, verdict,
      actionItems: ['Review the meeting report in Obsidian and confirm the next approved task.'] })
  }).then(response => response.json()).then(result => {
    if (result.ok) termLine('[Obsidian]: Meeting report saved — ' + result.reportFile, 'sys');
    else throw new Error(result.error || 'Meeting report failed');
    return result;
  }).catch(error => {
    termLine('[Obsidian]: Meeting report unavailable — ' + error.message, 'warn');
    return { ok: false, error: error.message };
  });
}

function startCollaborationScene(first, second, firstText, secondText) {
  if (!first || !second || first === second || first.sceneBusy || second.sceneBusy) return;
  [first, second].forEach(agent => { agent.sceneBusy = true; agent.activityBusy = true; });
  agentEventBus.emit('agent.meeting.requested', first.id, { participant: second.id, location: 'meeting' }, second.id);
  [first, second].forEach(agent => {
    if (agent.state === AGENT_STATES.IDLE || agent.state === AGENT_STATES.COMMUNICATING) {
      setAgentState(agent, AGENT_STATES.MOVING, 'heading to Floor 2 War Room');
    }
  });

  // Transit both agents up to Floor 2 War Room via elevator
  transitAgentToFloor(first, 2, () => {
    transitAgentToFloor(second, 2, () => {
      let arrived = 0;
      const arrive = () => {
        arrived += 1;
        if (arrived !== 2) return;
        [first, second].forEach(agent => setAgentState(agent, AGENT_STATES.COMMUNICATING, 'in War Room summit'));
        agentEventBus.emit('agent.meeting.joined', first.id, { participant: second.id, location: 'warroom' }, second.id);
        const dialogue = [
          { sender: first.name, text: firstText, kind: 'speech' },
          { sender: second.name, text: secondText, kind: 'speech' }
        ];
        agentBubble(first, firstText.slice(0, 42), 'speech', 4200);
        setTimeout(() => agentBubble(second, secondText.slice(0, 42), 'speech', 4200), 1800);
        recordMeetingInVault(first.name + ' + ' + second.name + ' Summit (Floor 02)',
          [first.name, second.name, 'Rama'], dialogue, 'APPROVED');
        setTimeout(() => {
          [first, second].forEach(agent => {
            setAgentState(agent, AGENT_STATES.RETURNING, 'summit complete');
            transitAgentToFloor(agent, 1, () => {
              walkPath(agent, agent.homeX, agent.homeY, () => {
                setAgentState(agent, AGENT_STATES.IDLE, 'standing by');
                agent.sceneBusy = false;
                agent.activityBusy = false;
              });
            });
          });
        }, 5000);
      };
      walkPath(first, 5.0, 3.2, arrive);
      walkPath(second, 6.5, 3.2, arrive);
    });
  });
}

const AGENT_ACTIVITIES = {
  rama: [
    { x: 10.5, y: 2.3, status: 'auditing', text: 'Working on boss desk.' },
    { x: 13.5, y: 3.5, status: 'reviewing', text: 'Reviewing the floor.' },
    { x: 15.5, y: 5.5, status: 'briefing', text: 'Briefing team at elevator.' }
  ],
  creator: [
    { x: 9.5, y: 9.5, status: 'coding', text: 'Working behind PC.' },
    { x: 13.5, y: 8.5, status: 'building', text: 'Reviewing task board.' },
    { x: 18.5, y: 9.5, status: 'thinking', text: 'Grabbing espresso.' }
  ],
  modifier: [
    { x: 19.5, y: 3.2, status: 'refactoring', text: 'Working behind studio PC.' },
    { x: 17.5, y: 2.2, status: 'refactoring', text: 'Tracing diff.' },
    { x: 15.5, y: 5.5, status: 'walking', text: 'Checking with Rama.' }
  ],
  auditor: [
    { x: 25.2, y: 9.2, status: 'auditing', text: 'Playing billiard & risk scan.' },
    { x: 26.5, y: 9.5, status: 'auditing', text: 'Scanning for risks.' },
    { x: 10.5, y: 9.5, status: 'thinking', text: 'Evidence verified.' }
  ],
  ops: [
    { x: 2.5, y: 9.5, status: 'managing', text: 'Working behind records PC.' },
    { x: 1.5, y: 9.2, status: 'organizing', text: 'Vault stays tidy.' },
    { x: 4.5, y: 2.5, status: 'monitoring', text: 'Systems are healthy.' }
  ]
};

const HUMOR_BANTER = [
  { agentId: 'rama', text: 'If it passes my audit, it goes to production.' },
  { agentId: 'rama', text: 'Who touched the main config without a PR?' },
  { agentId: 'creator', text: 'Coffee level low... Code output dropping!' },
  { agentId: 'creator', text: 'I build scaffolding, not excuses!' },
  { agentId: 'modifier', text: 'Refactoring 500 lines into 5 clean lines.' },
  { agentId: 'modifier', text: 'No bugs here, just unexpected features.' },
  { agentId: 'auditor', text: 'Scanning billiard cue for risk vectors.' },
  { agentId: 'auditor', text: 'I see every typo before git commit.' },
  { agentId: 'ops', text: 'Don\'t touch row 4 of the server vault!' },
  { agentId: 'ops', text: 'Backup completed in 42 milliseconds.' },
  { agentId: 'jarvis', text: 'All sub-daemons operating at 99.99% uptime.' }
];

function scheduleAgentActivity(agent) {
  const options = AGENT_ACTIVITIES[agent.id] || [];
  if (!options.length || agent.activityBusy) return;
  const activity = options[Math.floor(Math.random() * options.length)];
  agent.activityBusy = true;
  setAgentState(agent, AGENT_STATES.THINKING, activity.status);
  setAgentState(agent, AGENT_STATES.MOVING, 'moving to activity');
  walkPath(agent, activity.x, activity.y, () => {
    setAgentState(agent, AGENT_STATES.WORKING, activity.status);
    agentBubble(agent, activity.text, 'task', 2800);
    setTimeout(() => {
      setAgentState(agent, AGENT_STATES.RETURNING, 'returning home');
      walkPath(agent, agent.homeX, agent.homeY, () => {
        setAgentState(agent, AGENT_STATES.IDLE, 'standing by');
        agent.activityBusy = false;
      });
    }, 2400 + Math.random() * 2600);
  });
}

function drawWorldBubble(agent) {
  if (!agent.bubble || agent.bubbleUntil < performance.now()) return;
  if (agent.bubbleUntil < performance.now()) { agent.bubble = ''; return; }
  if ((agent.floorId || 1) !== activeFloor) return;
  const x = Math.round(agent.x * T + 14);
  const y = Math.round(agent.y * T - 12);
  const kind = agent.bubbleKind || 'speech';
  const colors = {
    speech: agent.palette.accent,
    task: '#FF9F1C',
    system: '#00F5D4',
    alert: '#FF5C77'
  };
  ctx.save();
  ctx.font = '7px monospace';
  const text = agent.bubble.slice(0, 28);
  const width = Math.min(150, Math.max(52, ctx.measureText(text).width + 12));
  ctx.fillStyle = 'rgba(8, 12, 20, 0.94)';
  ctx.strokeStyle = colors[kind] || agent.palette.accent;
  ctx.lineWidth = 1;
  ctx.fillRect(x - width / 2, y - 16, width, 15);
  ctx.strokeRect(x - width / 2, y - 16, width, 15);
  ctx.fillStyle = '#FFF8E7';
  ctx.fillText(text, x - width / 2 + 5, y - 6);
  ctx.restore();
}

function render() {
  const renderStart = performance.now();
  clock += 1;
  frameCounter += 1;
  const frame = Math.floor(frameCounter / 8) % 4;

  drawFloors();
  drawDecor();
  drawCustomDecor();
  drawPhase5BOverlay();
  drawOfficeWalls(activeFloor);
  drawAnimatedFurniture();
  drawNeonLightningAndEffects(activeFloor);
  drawAtlasDecorAndAgents(frame);
  // Final pass: titles must be above walls, furniture, agents, and speech bubbles.
  drawRoomTitles(activeFloor);

  const floorAgents = [];
  for (let i = 0; i < AGENTS.length; i += 1) {
    const agent = AGENTS[i];
    if ((agent.floorId || 1) === activeFloor && !agent.inTransit) floorAgents.push(agent);
  }
  if (clock % 240 === 0) {
    AGENTS.forEach(agent => {
      if (Math.random() < 0.72) scheduleAgentActivity(agent);
    });
    if (humorModeEnabled && Math.random() < 0.45) {
      const banter = HUMOR_BANTER[Math.floor(Math.random() * HUMOR_BANTER.length)];
      const spk = AGENTS.find(a => a.id === banter.agentId);
      if (spk && (spk.floorId || 1) === activeFloor && !spk.bubble) {
        agentBubble(spk, banter.text, 'speech', 3600);
      }
    }
    if (Math.random() < 0.35) {
      const budi = AGENTS.find(a => a.id === 'creator');
      const dimas = AGENTS.find(a => a.id === 'auditor');
      startCollaborationScene(budi, dimas, 'Prototype ready for security review.', 'I will scan the proposal now.');
    }
  }

  // Neon status markers preserve the Phase 5B visual language without changing agent logic.
  ctx.save();
  floorAgents.forEach(a => {
    const active = a.status && !/standing by|idle/i.test(a.status);
    ctx.fillStyle = active ? '#FF9F1C' : '#00F5D4';
    ctx.fillRect(Math.round(a.x * T + 22), Math.round(a.y * T - 4), 5, 5);
  });
  ctx.restore();

  // Highlight tile under cursor when Decorator mode is active
  if (decorMode && mouseTileX >= 0 && mouseTileX < MAP.w && mouseTileY >= 0 && mouseTileY < MAP.h) {
    ctx.save();
    ctx.strokeStyle = selectedDecorItem === 'remove' ? '#FF6B6B' : '#00F5D4';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mouseTileX * T, mouseTileY * T, T, T);
    ctx.fillStyle = selectedDecorItem === 'remove' ? 'rgba(255, 107, 107, 0.22)' : 'rgba(0, 245, 212, 0.2)';
    ctx.fillRect(mouseTileX * T, mouseTileY * T, T, T);
    ctx.restore();
  }

  // Canvas fade overlay during floor transition
  if (floorTransitionAlpha < 1.0) {
    ctx.save();
    ctx.fillStyle = 'rgba(7, 9, 14, ' + (1.0 - floorTransitionAlpha) + ')';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  if (window.KRA_PROFILE) {
    window.KRA_PROFILE.renderFrameMs = performance.now() - renderStart;
    window.KRA_PROFILE.frameCount += 1;
  }
  requestAnimationFrame(render);
}

/* ---------- 6. UI WIRING ---------- */
const DECOR_ITEMS = new Set([
  'trophy', 'bonsai', 'coffee', 'holoOrb', 'lavalamp', 'synth', 'cactus',
  'cybercat', 'lamp', 'plant',
  'atlas_server', 'atlas_desk', 'atlas_arcade', 'atlas_planter', 'atlas_bookshelf',
  'atlas_maya_desk', 'atlas_board', 'atlas_coffee', 'atlas_table', 'atlas_billiard',
  'atlas_chair', 'atlas_server_blade', 'atlas_refrigerator', 'atlas_barista'
]);
let decorMode = false;
let selectedDecorItem = 'trophy';
const customDecor = { 1: new Map(), 2: new Map() };

let officerSession = localStorage.getItem('kra_session_id') || 'kra_officer_rama';
let kraActiveOfficer = {
  id: 'user_rama',
  username: 'rama',
  display_name: 'Rama (Executive Boss)',
  role: 'supervisor'
};

function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (officerSession) {
    headers['Authorization'] = 'Bearer ' + officerSession;
  }
  return headers;
}

function updateDecoratorBadge() {
  const titleEl = document.querySelector('.decor-bar-title');
  if (titleEl) {
    titleEl.textContent = '🎨 DECK DECORATOR // OFFICER: ' + kraActiveOfficer.display_name.toUpperCase() + ' [ISOLATED]';
  }
}

async function initOfficerAuth() {
  try {
    const response = await fetch('../api/index.php?action=auth-status', {
      headers: getAuthHeaders()
    });
    const payload = await response.json();
    if (payload.ok && payload.authenticated && payload.user) {
      kraActiveOfficer = payload.user;
    }
    updateDecoratorBadge();
  } catch (_) {}
}
initOfficerAuth();

async function loadDecorations(level) {
  try {
    const response = await fetch('../api/index.php?action=decorations&floor=' + level, {
      headers: getAuthHeaders()
    });
    const payload = await response.json();
    if (!payload.ok) return;
    customDecor[level] = new Map((payload.items || []).map(item => [item.tile_x + ',' + item.tile_y, item.item_id]));
    invalidateAtlasWalkBlockers(level);
  } catch (error) {
    termLine('[Jarvis]: Decoration memory unavailable; using local deck state.', 'warn');
  }
}

async function saveDecoration(level, x, y, item) {
  try {
    const resp = await fetch('../api/index.php?action=save-decor', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ floor: level, x, y, item })
    });
    const res = await resp.json();
    if (!res.ok) {
      termLine('[Decorator]: ' + (res.error || 'Access denied on this tile.'), 'warn');
    }
  } catch (error) {
    termLine('[Jarvis]: Decoration save failed; local preview retained.', 'warn');
  }
}

function drawCustomDecor() {
  const items = customDecor[activeFloor] || new Map();
  items.forEach((item, key) => {
    if (isAtlasItem(item)) return;
    const [x, y] = key.split(',').map(Number);
    drawSprite(x, y, item);
  });
}

const floor1Button = document.getElementById('btn-floor-1');
const floor2Button = document.getElementById('btn-floor-2');
if (floor1Button) floor1Button.addEventListener('click', () => loadFloor(1));
if (floor2Button) floor2Button.addEventListener('click', () => loadFloor(2));

// Fit the world to the available viewport, then apply user zoom without distorting pixels.
const camera = { fitScale: 1, zoom: 1, minZoom: 0.5, maxZoom: 2 };
const canvasContainer = canvas.parentElement;
function applyCamera() {
  const availableWidth = Math.max(1, canvasContainer.clientWidth - 8);
  const availableHeight = Math.max(1, canvasContainer.clientHeight - 8);
  // Fill container cleanly: use contain (Math.min) or cover (Math.max) based on user zoom.
  // With wide map (44x12), contain fits nicely without black bars.
  const scaleX = availableWidth / W;
  const scaleY = availableHeight / H;
  camera.fitScale = Math.min(scaleX, scaleY);
  const displayScale = Math.max(0.01, camera.fitScale * camera.zoom);
  canvas.style.width = Math.floor(W * displayScale) + 'px';
  canvas.style.height = Math.floor(H * displayScale) + 'px';
  canvas.style.transform = 'none';
  canvas.style.transformOrigin = 'center center';
}
if (typeof ResizeObserver !== 'undefined') {
  const cameraResizeObserver = new ResizeObserver(applyCamera);
  cameraResizeObserver.observe(canvasContainer);
} else {
  window.addEventListener('resize', applyCamera);
}
requestAnimationFrame(applyCamera);
const zoomInButton = document.getElementById('btn-zoom-in');
const zoomOutButton = document.getElementById('btn-zoom-out');
const resetCameraButton = document.getElementById('btn-reset-cam');
if (zoomInButton) zoomInButton.addEventListener('click', () => { camera.zoom = Math.min(camera.maxZoom, camera.zoom + 0.125); applyCamera(); });
if (zoomOutButton) zoomOutButton.addEventListener('click', () => { camera.zoom = Math.max(camera.minZoom, camera.zoom - 0.125); applyCamera(); });
if (resetCameraButton) resetCameraButton.addEventListener('click', () => { camera.zoom = 1; applyCamera(); });

// Canvas hit testing lets agents leave their rooms and remain directly selectable.
let mouseTileX = -1, mouseTileY = -1;
canvas.addEventListener('mousemove', event => {
  const rect = canvas.getBoundingClientRect();
  const worldX = ((event.clientX - rect.left) / rect.width) * W;
  const worldY = ((event.clientY - rect.top) / rect.height) * H;
  mouseTileX = Math.floor(worldX / T);
  mouseTileY = Math.floor(worldY / T);
});
canvas.addEventListener('mouseleave', () => { mouseTileX = -1; mouseTileY = -1; });

canvas.addEventListener('click', event => {
  const rect = canvas.getBoundingClientRect();
  const worldX = ((event.clientX - rect.left) / rect.width) * W;
  const worldY = ((event.clientY - rect.top) / rect.height) * H;
  const tileX = Math.floor(worldX / T);
  const tileY = Math.floor(worldY / T);

  if (decorMode) {
    if (tileX >= 0 && tileX < MAP.w && tileY >= 0 && tileY < MAP.h) {
      const tileKey = tileX + ',' + tileY;
      if (selectedDecorItem === 'remove') {
        const atlasOrigin = [...customDecor[activeFloor].entries()].find(([key, item]) => {
          if (!isAtlasItem(item)) return false;
          const [originX, originY] = key.split(',').map(Number);
          const frameName = getAtlasFrameName(item);
          const occupancy = officeAtlas.metadata?.sprites?.[frameName]?.grid_occupancy || { cols: 1, rows: 1 };
          return tileX >= originX && tileX < originX + occupancy.cols
            && tileY >= originY && tileY < originY + occupancy.rows;
        });
        if (atlasOrigin) {
          const [originKey, originItem] = atlasOrigin;
          const [originX, originY] = originKey.split(',').map(Number);
          const frameName = getAtlasFrameName(originItem);
          const occupancy = officeAtlas.metadata?.sprites?.[frameName]?.grid_occupancy || { cols: 1, rows: 1 };
          for (let dy = 0; dy < occupancy.rows; dy += 1) {
            for (let dx = 0; dx < occupancy.cols; dx += 1) {
              const key = (originX + dx) + ',' + (originY + dy);
              customDecor[activeFloor].delete(key);
              saveDecoration(activeFloor, originX + dx, originY + dy, 'remove');
            }
          }
        } else {
          customDecor[activeFloor].delete(tileKey);
          saveDecoration(activeFloor, tileX, tileY, 'remove');
        }
        invalidateAtlasWalkBlockers(activeFloor);
        playSfx('send');
        termLine('[Decorator]: Removed item at (' + tileX + ', ' + tileY + ').', 'sys');
      } else if (canPlaceDecorItem(selectedDecorItem, tileX, tileY, tileKey)) {
        const frameName = getAtlasFrameName(selectedDecorItem);
        const occupancy = officeAtlas.metadata?.sprites?.[frameName]?.grid_occupancy || { cols: 1, rows: 1 };
        customDecor[activeFloor].set(tileKey, selectedDecorItem);
        saveDecoration(activeFloor, tileX, tileY, selectedDecorItem);
        invalidateAtlasWalkBlockers(activeFloor);
        playSfx('reply');
        termLine('[Decorator]: Placed ' + selectedDecorItem + ' at (' + tileX + ', ' + tileY + ').', 'prompt');
      } else {
        termLine('[Decorator]: Placement rejected; footprint overlaps a blocked or occupied tile.', 'warn');
      }
    }
    return;
  }

  const target = AGENTS.find(agent => {
    if ((agent.floorId || 1) !== activeFloor) return false;
    const ax = agent.x * T, ay = agent.y * T;
    return worldX >= ax - 5 && worldX <= ax + 28 && worldY >= ay && worldY <= ay + 34;
  });
  if (target) selectAgent(target.id);
});

/* Decorator toolbar UI wiring */
const decorBar = document.getElementById('decor-bar');
const toggleDecorBtn = document.getElementById('btn-toggle-decor');
const closeDecorBtn = document.getElementById('btn-close-decor');
const clearDecorBtn = document.getElementById('btn-clear-decor');
const officerSelect = document.getElementById('decor-officer-select');

if (officerSelect) {
  officerSelect.value = officerSession;
  officerSelect.addEventListener('change', async () => {
    officerSession = officerSelect.value;
    localStorage.setItem('kra_session_id', officerSession);
    await initOfficerAuth();
    await loadDecorations(activeFloor);
    termLine('[Auth]: Deck switched to ' + kraActiveOfficer.display_name + '.', 'sys');
    playSfx('reply');
  });
}

if (toggleDecorBtn) {
  toggleDecorBtn.addEventListener('click', () => {
    decorMode = !decorMode;
    toggleDecorBtn.classList.toggle('active', decorMode);
    if (decorBar) decorBar.classList.toggle('hidden', !decorMode);
    termLine(decorMode ? '[Decorator]: Mode ON. Select an item and click tile.' : '[Decorator]: Mode OFF.', 'sys');
    playSfx('reply');
  });
}

if (closeDecorBtn) {
  closeDecorBtn.addEventListener('click', () => {
    decorMode = false;
    if (toggleDecorBtn) toggleDecorBtn.classList.remove('active');
    if (decorBar) decorBar.classList.add('hidden');
    playSfx('send');
  });
}

if (clearDecorBtn) {
  clearDecorBtn.addEventListener('click', async () => {
    customDecor[activeFloor].clear();
    invalidateAtlasWalkBlockers(activeFloor);
    try {
      await fetch('../api/index.php?action=clear-decor', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ floor: activeFloor })
      });
    } catch (_) {}
    playSfx('send');
    termLine('[Decorator]: Cleared custom decorations on this floor.', 'sys');
  });
}

document.querySelectorAll('.decor-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.decor-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedDecorItem = btn.dataset.item;
    playSfx('reply');
  });
});
applyCamera();
const terminal = document.getElementById('terminal-output');
const commandInput = document.getElementById('command-input');
const chatTabs = document.getElementById('chat-tabs');
const chatChannelLabel = document.getElementById('chat-channel-label');
const chatLiveStatus = document.getElementById('chat-live-status');
const terminalChannelTitle = document.getElementById('terminal-channel-title');
const fullscreenChatButton = document.getElementById('btn-chat-fullscreen');
const closeFullscreenChatButton = document.getElementById('btn-chat-close-fullscreen');
let activeChatChannel = 'team';

function setChatFullscreen(enabled) {
  document.body.classList.toggle('chat-fullscreen', enabled);
  if (fullscreenChatButton) fullscreenChatButton.setAttribute('aria-expanded', enabled ? 'true' : 'false');
  if (closeFullscreenChatButton) closeFullscreenChatButton.classList.toggle('hidden', !enabled);
  if (enabled) commandInput.focus();
}

fullscreenChatButton?.addEventListener('click', () => setChatFullscreen(true));
closeFullscreenChatButton?.addEventListener('click', () => setChatFullscreen(false));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.body.classList.contains('chat-fullscreen')) setChatFullscreen(false);
});
const chatChannels = {
  terminal: { label: 'COMMAND TERMINAL · JARVIS BUS', title: 'KRA TERMINAL' },
  team: { label: 'TEAM ROOM · ALL OFFICERS', title: 'TEAM CHAT' },
  rama: { label: 'PRIVATE CHANNEL · RAMA', title: 'RAMA CHAT' },
  budi: { label: 'PRIVATE CHANNEL · BUDI', title: 'BUDI CHAT' },
  maya: { label: 'PRIVATE CHANNEL · MAYA', title: 'MAYA CHAT' },
  dimas: { label: 'PRIVATE CHANNEL · DIMAS', title: 'DIMAS CHAT' },
  siti: { label: 'PRIVATE CHANNEL · SITI', title: 'SITI CHAT' },
};
const speechBubble = document.getElementById('agent-speech-bubble');
const speechText = document.getElementById('speech-text');
const speechSender = document.getElementById('speech-sender');
const rosterGrid = document.getElementById('roster-grid');
const activeHeading = document.getElementById('active-agent-heading');
const profileName = document.getElementById('profile-name');

let selectedAgent = AGENTS[0];
let bubbleTimer = null;
let activeModel = localStorage.getItem('kra-model') || '';
let reactModeEnabled = localStorage.getItem('kra-react-mode') === 'on';
let humorModeEnabled = localStorage.getItem('kra-humor-mode') !== 'off';
const reactToggle = document.getElementById('btn-react-toggle');
const humorToggle = document.getElementById('btn-humor-toggle');

function updateReactToggle() {
  if (!reactToggle) return;
  reactToggle.textContent = reactModeEnabled ? '⚙ ReAct ON' : '⚙ ReAct OFF';
  reactToggle.setAttribute('aria-pressed', reactModeEnabled ? 'true' : 'false');
  reactToggle.classList.toggle('active', reactModeEnabled);
}
function updateHumorToggle() {
  if (!humorToggle) return;
  humorToggle.textContent = humorModeEnabled ? '😄 Humor ON' : '😐 Humor OFF';
  humorToggle.setAttribute('aria-pressed', humorModeEnabled ? 'true' : 'false');
  humorToggle.classList.toggle('active', humorModeEnabled);
}

function appendReactCard(kind, text, agentId) {
  const row = document.createElement('div');
  row.className = 'react-card react-' + kind;
  row.tabIndex = 0;
  row.setAttribute('role', 'button');
  row.setAttribute('aria-expanded', 'false');
  row.dataset.agent = agentId || 'jarvis';
  const label = kind === 'thought' ? 'THOUGHT'
    : kind === 'action' ? 'ACTION'
    : kind === 'observation' ? 'OBSERVATION'
    : kind === 'handoff' ? 'HANDOFF PACKET'
    : kind === 'budget' ? 'BUDGET METRICS'
    : kind.toUpperCase();
  row.textContent = '[' + label + '] ' + text;
  const toggle = () => {
    const collapsed = row.classList.toggle('collapsed');
    row.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  };
  row.addEventListener('click', toggle);
  row.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle();
    }
  });
  terminal.appendChild(row);
  terminal.scrollTop = terminal.scrollHeight;
}

function renderHandoffPacketCard(packet, agentId) {
  if (!packet) return;
  const card = document.createElement('div');
  card.className = 'handoff-packet-card';
  card.dataset.agent = agentId || 'jarvis';

  const header = document.createElement('div');
  header.className = 'packet-header';
  header.innerHTML = `
    <span class="packet-tag">📦 AUTONOMOUS HANDOFF</span>
    <span class="packet-route">${escapeHtml(packet.from || 'agent')} ➔ ${escapeHtml(packet.to || 'agent')}</span>
  `;

  const body = document.createElement('div');
  body.className = 'packet-body';

  const obj = document.createElement('div');
  obj.className = 'packet-field';
  obj.innerHTML = `<strong>Objective:</strong> ${escapeHtml(packet.objective || 'N/A')}`;

  const reason = document.createElement('div');
  reason.className = 'packet-field';
  reason.innerHTML = `<strong>Reason:</strong> ${escapeHtml(packet.reason || 'N/A')}`;

  body.appendChild(obj);
  body.appendChild(reason);

  if (packet.findings && packet.findings.length > 0) {
    const findingsList = document.createElement('div');
    findingsList.className = 'packet-findings';
    findingsList.innerHTML = `<strong>Findings (${packet.findings.length}):</strong>`;
    const ul = document.createElement('ul');
    packet.findings.slice(0, 3).forEach(f => {
      const li = document.createElement('li');
      li.textContent = f;
      ul.appendChild(li);
    });
    if (packet.findings.length > 3) {
      const more = document.createElement('li');
      more.textContent = `...and ${packet.findings.length - 3} more`;
      ul.appendChild(more);
    }
    findingsList.appendChild(ul);
    body.appendChild(findingsList);
  }

  if (packet.remainingBudget) {
    const rem = packet.remainingBudget;
    const footer = document.createElement('div');
    footer.className = 'packet-budget';
    footer.textContent = `Rem Budget: T:${rem.turns} | Tool:${rem.toolCalls} | Rd:${rem.reads} | HO:${rem.handoffs}`;
    body.appendChild(footer);
  }

  card.appendChild(header);
  card.appendChild(body);
  terminal.appendChild(card);
  terminal.scrollTop = terminal.scrollHeight;
}

function updateAutonomyBudgetMeters(result) {
  if (!result || !result.budget) return;
  const b = result.budget;
  const turns = result.turns || 1;
  const maxTurns = 6;
  const maxTools = 8;
  const maxReads = 12;
  const maxHandoffs = 3;

  const setSeg = (id, cur, max, prefix) => {
    const el = document.getElementById(id);
    const txt = document.getElementById(id + '-txt');
    if (!el || !txt) return;
    txt.textContent = prefix + ' ' + cur + '/' + max;
    el.className = 'meter-seg';
    const ratio = cur / max;
    if (ratio >= 1) el.classList.add('exhausted');
    else if (ratio >= 0.75) el.classList.add('warning');
    else if (cur > 0) el.classList.add('active');
  };

  setSeg('seg-turns', turns, maxTurns, 'T');
  setSeg('seg-tools', b.toolCalls || 0, maxTools, 'TOOL');
  setSeg('seg-reads', b.reads || 0, maxReads, 'RD');
  setSeg('seg-handoffs', b.handoffs || 0, maxHandoffs, 'HO');

  const stopEl = document.getElementById('budget-stop');
  if (stopEl) {
    const reason = result.stopReason || 'DONE';
    stopEl.textContent = reason;
    stopEl.className = 'budget-stop';
    if (reason === 'completed' || reason === 'answer' || reason === 'DONE') {
      stopEl.classList.add('active');
    } else {
      stopEl.classList.add('alert');
    }
  }
}

function animateReactAgent(agentId, kind) {
  const agent = AGENTS.find(item => item.id === agentId);
  if (!agent) return;
  setAgentState(agent, AGENT_STATES.THINKING, 'ReAct ' + kind);
  agentBubble(agent, kind.toUpperCase() + ' · autonomous loop', 'task', 2600);
  walkPath(agent, agent.homeX, agent.homeY);
}

updateReactToggle();
updateHumorToggle();
if (reactToggle) {
  reactToggle.addEventListener('click', () => {
    reactModeEnabled = !reactModeEnabled;
    localStorage.setItem('kra-react-mode', reactModeEnabled ? 'on' : 'off');
    updateReactToggle();
    termLine('[Jarvis]: ReAct mode ' + (reactModeEnabled ? 'enabled.' : 'disabled.'), 'sys');
  });
}
if (humorToggle) {
  humorToggle.addEventListener('click', () => {
    humorModeEnabled = !humorModeEnabled;
    localStorage.setItem('kra-humor-mode', humorModeEnabled ? 'on' : 'off');
    updateHumorToggle();
    termLine('[Jarvis]: Office Humor & banter ' + (humorModeEnabled ? 'enabled.' : 'disabled.'), 'sys');
  });
}

function termLine(text, cls, persist = true) {
  const div = document.createElement('div');
  div.className = 'term-line ' + (cls || '');
  div.textContent = text;
  terminal.appendChild(div);
  if (persist) {
    fetch('../api/index.php?action=log-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: cls === 'user' ? 'User' : 'Jarvis',
        message: text,
        channel: activeChatChannel,
      }),
    }).catch(() => {});
  }
  terminal.scrollTop = terminal.scrollHeight;
}

async function loadChatHistory(channel) {
  try {
    const response = await fetch('../api/index.php?action=chat-history&channel=' + encodeURIComponent(channel));
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || 'History unavailable');
    terminal.innerHTML = '';
    (payload.messages || []).forEach(message => {
      appendChatBubble(
        message.sender,
        message.message,
        message.created_at || message.createdAt,
        message.sender === 'User'
      );
    });
    terminal.scrollTop = terminal.scrollHeight;
  } catch (error) {
    chatLiveStatus.classList.add('offline');
    chatLiveStatus.textContent = '● HISTORY OFFLINE';
  }
}

function appendTermLine(text, cls) {
  const div = document.createElement('div');
  div.className = 'term-line ' + (cls || '');
  div.textContent = text;
  terminal.appendChild(div);
}

function chatTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function agentForSender(sender) {
  return AGENTS.find(agent => agent.name === sender) || AGENTS[0];
}

function appendChatBubble(sender, message, timestamp, isUser = false) {
  const agent = agentForSender(sender);
  const row = document.createElement('div');
  row.className = 'chat-message ' + (isUser ? 'chat-message-user' : 'chat-message-agent');

  if (!isUser) {
    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.textContent = agent.name.slice(0, 1).toUpperCase();
    avatar.title = agent.name;
    row.appendChild(avatar);
  }

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  if (!isUser) {
    const name = document.createElement('span');
    name.className = 'chat-sender';
    name.textContent = agent.name;
    bubble.appendChild(name);
  }
  const content = document.createElement('span');
  content.className = 'chat-content';
  content.textContent = message;
  bubble.appendChild(content);
  const time = document.createElement('time');
  time.className = 'chat-time';
  time.textContent = chatTime(timestamp);
  bubble.appendChild(time);
  row.appendChild(bubble);
  terminal.appendChild(row);
  terminal.scrollTop = terminal.scrollHeight;
}

function appendThinkingBubble(sender, thinking) {
  const row = document.createElement('div');
  row.className = 'chat-thinking';
  row.textContent = '· ' + sender + ' is thinking: ' + thinking;
  terminal.appendChild(row);
}

const placeholders = {
  team: 'Message all officers or @mention (e.g. @Budi, @Dimas)...',
  rama: 'Direct order or question for Boss Rama...',
  budi: 'Ask Budi to create or scaffold a module...',
  maya: 'Ask Maya to refactor, fix, or optimize code...',
  dimas: 'Ask Dimas to inspect hygiene or security...',
  siti: 'Ask Siti about workspace operations or runtime...',
};

function registerHiredChatChannel(agent) {
  if (!agent || !agent.id || chatChannels[agent.id]) return;
  const name = String(agent.name || agent.id).toUpperCase();
  chatChannels[agent.id] = {
    label: 'PRIVATE CHANNEL · ' + name,
    title: name + ' CHAT',
  };
  if (!chatTabs || document.querySelector('.chat-tab[data-channel="' + agent.id + '"]')) return;
  const tab = document.createElement('button');
  tab.className = 'chat-tab hired-chat-tab';
  tab.dataset.channel = agent.id;
  tab.setAttribute('role', 'tab');
  tab.textContent = '◈ ' + name;
  tab.addEventListener('click', () => switchChatChannel(agent.id));
  chatTabs.appendChild(tab);
}

function switchChatChannel(channel) {
  if (!chatChannels[channel]) return;
  activeChatChannel = channel;
  if (channel === 'terminal') {
    chatChannelLabel.textContent = chatChannels.terminal.label;
    terminalChannelTitle.textContent = chatChannels.terminal.title + ' • /dev/kra-bus';
    chatLiveStatus.textContent = '● COMMAND MODE';
    document.querySelectorAll('.chat-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.channel === 'terminal');
    });
    commandInput.placeholder = 'Type /help or commands (/agent, /create, /audit, /skills, /model)...';
    termLine('live · pty /dev/kra-bus [OpenCode Command Mode]', 'sys', false);
    termLine('Type /help to see commands or /agent <name> to switch focus.', 'prompt', false);
    return;
  }
  const info = chatChannels[channel];
  document.querySelectorAll('.chat-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.channel === channel);
    tab.setAttribute('aria-selected', tab.dataset.channel === channel ? 'true' : 'false');
  });
  chatChannelLabel.textContent = info.label;
  terminalChannelTitle.textContent = info.title + ' • /dev/kra-bus';
  chatLiveStatus.classList.remove('offline');
  chatLiveStatus.textContent = '● LIVE';

  if (placeholders[channel]) {
    commandInput.placeholder = placeholders[channel];
  }

  const focusAgent = AGENTS.find(a => a.id === channel);
  if (focusAgent) {
    selectedAgent = focusAgent;
    activeHeading.textContent = 'Agent: ' + focusAgent.name;
    profileName.textContent = focusAgent.name + ' — ' + focusAgent.role;
    document.querySelectorAll('.roster-card').forEach(c =>
      c.classList.toggle('active', c.dataset.id === channel));
    drawPortrait();
  } else if (channel === 'team') {
    selectedAgent = AGENTS[0];
    activeHeading.textContent = 'Team Console: All Officers';
    profileName.textContent = 'Rama & Field Agents — Virtual Office Floor';
    document.querySelectorAll('.roster-card').forEach(c =>
      c.classList.remove('active'));
    drawPortrait();
  }

  loadChatHistory(channel);
}

function appendAgentMessage(result) {
  chatLiveStatus.classList.remove('offline');
  chatLiveStatus.textContent = '● LIVE · ' + result.provider;
  playSfx('reply');
  const replies = Array.isArray(result.replies) ? result.replies : [result];
  replies.forEach(reply => {
    if (reply.thinking) appendThinkingBubble(reply.sender, reply.thinking);
    appendChatBubble(reply.sender, reply.message, new Date());
    const speakingAgent = AGENTS.find(agent => agent.name.toLowerCase() === (reply.sender || '').toLowerCase());
    if (speakingAgent) {
      setAgentState(speakingAgent, AGENT_STATES.COMMUNICATING, 'communicating');
      agentBubble(speakingAgent, (reply.message || '').slice(0, 42), 'speech', 4800);
      setTimeout(() => {
        if (!speakingAgent.activityBusy && speakingAgent.state === AGENT_STATES.COMMUNICATING) {
          setAgentState(speakingAgent, AGENT_STATES.IDLE, 'standing by');
        }
      }, 4800);
    }
    if (reply.proposal) {
      playSfx('gated');
      termLine('[Approval Gate]: Proposal prepared — review before execution.', 'prompt');
      if (speakingAgent) {
        setAgentState(speakingAgent, AGENT_STATES.WAITING_APPROVAL, 'waiting approval');
        agentBubble(speakingAgent, 'Proposal waiting approval', 'task', 6000);
      }
      openProposalFromChat(reply.proposal, reply.agentId);
    }
  });
}

async function sendAgentChat(message) {
  if (reactModeEnabled && activeChatChannel !== 'terminal') {
    await sendReActChat(message);
    return;
  }
  playSfx('send');
  appendChatBubble('User', message, new Date(), true);
  chatLiveStatus.textContent = '● THINKING';
  agentEventBus.emit('user.message.sent', 'user', { channel: activeChatChannel, message });
  if (activeChatChannel === 'team') {
    AGENTS.forEach(a => {
      setAgentState(a, AGENT_STATES.THINKING, 'processing prompt');
      agentBubble(a, 'Thinking...', 'task', 3000);
    });
  } else {
    const targetAgent = AGENTS.find(a => a.id === activeChatChannel);
    if (targetAgent) {
      setAgentState(targetAgent, AGENT_STATES.THINKING, 'processing prompt');
      agentBubble(targetAgent, 'Thinking...', 'task', 3500);
    }
  }
  try {
    const response = await fetch('../api/index.php?action=chat-agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: activeChatChannel, message, model: activeModel }),
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || 'Agent unavailable');
    appendAgentMessage(result);
  } catch (error) {
    chatLiveStatus.classList.add('offline');
    chatLiveStatus.textContent = '● AGENT OFFLINE';
    termLine('[Jarvis]: Agent bridge unavailable — ' + error.message, 'warn');
    if (activeChatChannel === 'team') {
      AGENTS.forEach(a => setAgentState(a, AGENT_STATES.IDLE, 'standing by'));
    } else {
      const targetAgent = AGENTS.find(a => a.id === activeChatChannel);
      if (targetAgent) setAgentState(targetAgent, AGENT_STATES.BLOCKED, 'bridge offline');
    }
  }
}

async function sendReActChat(message) {
  playSfx('send');
  appendChatBubble('User', message, new Date(), true);
  const agentId = activeChatChannel === 'team' ? 'budi' : activeChatChannel;
  chatLiveStatus.textContent = '● REACT LOOP';
  animateReactAgent(agentId, 'reasoning');
  try {
    const response = await fetch('../api/index.php?action=react-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, message, maxTurns: 6, chainHandoff: true }),
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || 'ReAct engine unavailable');

    let stagedTask = null;
    (result.trace || []).forEach(step => {
      const stepAgent = step.agent || agentId;
      if (step.thought) appendReactCard('thought', step.thought, stepAgent);
      if (step.action) {
        appendReactCard('action', step.action, stepAgent);
        animateReactAgent(stepAgent, step.action);
      }
      if (step.observation) {
        if (typeof step.observation === 'object' && step.observation.task) {
          stagedTask = step.observation.task;
        }
        const observation = typeof step.observation === 'string'
          ? step.observation : JSON.stringify(step.observation);
        appendReactCard('observation', observation.slice(0, 700), stepAgent);
      }
      if (step.handoffPacket) {
        renderHandoffPacketCard(step.handoffPacket, stepAgent);
      }
      if (step.handoff) {
        const nextAgent = typeof step.handoff === 'object' ? step.handoff.to : step.handoff;
        appendReactCard('action', 'handoff → ' + nextAgent, stepAgent);
        animateReactAgent(nextAgent, 'handoff');
      }
    });

    if (result.budget) {
      const b = result.budget;
      const bText = 'Turns: ' + (result.turns || 1) + ' · Tools: ' + (b.toolCalls || 0)
        + ' · Reads: ' + (b.reads || 0) + ' (' + (b.readBytes || 0) + 'B) · Handoffs: ' + (b.handoffs || 0)
        + ' · Stop: ' + (result.stopReason || 'completed');
      appendReactCard('budget', bText, result.agentId || agentId);
      updateAutonomyBudgetMeters(result);
    }

    const speaker = AGENTS.find(item => item.id === (result.agentId || agentId));
    const sender = speaker ? speaker.name : 'Jarvis';
    appendChatBubble(sender, result.finalAnswer || 'ReAct loop completed.', new Date());
    chatLiveStatus.textContent = '● REACT · ' + (result.provider || 'local');
    if (result.handoff) {
      const handoffAgent = AGENTS.find(item => item.id === result.handoff);
      if (handoffAgent) {
        setAgentState(handoffAgent, AGENT_STATES.COMMUNICATING, 'received autonomous handoff');
        agentBubble(handoffAgent, 'Handoff received from ' + sender, 'system', 4200);
      }
    }

    if (stagedTask) {
      termLine('[Jarvis]: Proposal ' + stagedTask.id + ' staged by ' + (stagedTask.agentId || sender) + '. WAITING APPROVAL.', 'warn');
      showApprovalGate(stagedTask);
      playSfx('propose');
    }

    playSfx('reply');
  } catch (error) {
    chatLiveStatus.classList.add('offline');
    chatLiveStatus.textContent = '● REACT OFFLINE';
    termLine('[Jarvis]: ReAct engine unavailable — ' + error.message, 'warn');
  }
}

function openProposalFromChat(proposal, agentId) {
  proposeTask(
    agentId,
    proposal.actionType,
    proposal.title,
    proposal.targetFile,
    proposal.proposedContent,
    proposal.summary
  );
}

function showBubble(sender, text, ms, agent) {
  speechSender.textContent = sender + ':';
  speechText.textContent = text;
  if (agent && typeof agent.x === 'number' && typeof agent.y === 'number') {
    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = canvasContainer.getBoundingClientRect();
    const agentPixelX = (agent.x * T / W) * canvasRect.width + (canvasRect.left - containerRect.left);
    const agentPixelY = (agent.y * T / H) * canvasRect.height + (canvasRect.top - containerRect.top);
    const bubbleX = Math.max(8, Math.min(containerRect.width - 200, agentPixelX - 60));
    const bubbleY = Math.max(8, agentPixelY - 64);
    speechBubble.style.left = Math.round(bubbleX) + 'px';
    speechBubble.style.top = Math.round(bubbleY) + 'px';
  } else {
    speechBubble.style.left = '16px';
    speechBubble.style.top = '16px';
  }
  speechBubble.classList.remove('hidden');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => speechBubble.classList.add('hidden'), ms || 4200);
}

function buildRoster() {
  rosterGrid.innerHTML = '';
  AGENTS.forEach(a => {
    const card = document.createElement('div');
    card.className = 'roster-card' + (a.id === selectedAgent.id ? ' active' : '');
    card.dataset.id = a.id;
    card.innerHTML = `
      <div class="card-avatar-box"><canvas width="32" height="32"></canvas></div>
      <div class="card-info">
        <div class="card-name-row">
          <span class="card-name">${a.name}</span>
          <span class="card-badge ${a.badge}">FL ${a.floorId || 1} · ${a.status}</span>
        </div>
        <div class="card-role">${a.role}</div>
      </div>`;
    const c = card.querySelector('canvas');
    const cc = c.getContext('2d');
    cc.imageSmoothingEnabled = false;
    cc.save();
    cc.translate(0, 0);
    // draw mini sprite into card
    const pal = a.palette;
    const q = (x, y, w, h, col) => { cc.fillStyle = col; cc.fillRect(x, y, w, h); };
    cc.fillStyle = '#FCFAF0'; cc.fillRect(0, 0, 32, 32);
    q(8, 2, 16, 12, DECO.ink);
    q(9, 3, 14, 10, pal.skin);
    q(8, 1, 16, 4, pal.hair);
    q(11, 7, 3, 3, DECO.ink); q(18, 7, 3, 3, DECO.ink);
    q(8, 14, 16, 12, DECO.ink);
    q(9, 15, 14, 10, pal.primary);
    q(9, 15, 14, 3, pal.accent);
    if (a.id === 'rama') q(14, 17, 4, 8, pal.accent);
    q(10, 26, 5, 4, DECO.ink); q(17, 26, 5, 4, DECO.ink);
    cc.restore();

    card.addEventListener('click', () => selectAgent(a.id));
    rosterGrid.appendChild(card);
  });
}

function selectAgent(id) {
  const a = AGENTS.find(x => x.id === id);
  if (!a) return;
  selectedAgent = a;
  if ((a.floorId || 1) !== activeFloor) {
    loadFloor(a.floorId || 1);
    termLine('[Camera]: Switched to Floor 0' + (a.floorId || 1) + ' to focus on ' + a.name + '.', 'info');
  }
  activeHeading.textContent = (a.id === 'rama' ? 'Boss Console: Rama' : 'Agent: ' + a.name);
  profileName.textContent = a.name + ' — ' + a.role;
  document.querySelectorAll('.roster-card').forEach(c =>
    c.classList.toggle('active', c.dataset.id === id));
  drawPortrait();
  switchChatChannel(a.id);
  showBubble(a.name, a.intro.replace(/^[^:]+:\s*/, ''), 4600);
  termLine('[focus] ' + a.name + ' selected — ' + a.role, 'info');
}

/* --- Pilar 3: waypoint movement and collision-safe routes --- */
const OFFICE_WAYPOINTS = {
  corridorWest: { x: 3.5, y: 5.5 }, corridorCenter: { x: 15.5, y: 5.5 },
  corridorEast: { x: 27.5, y: 5.5 }, meeting: { x: 10.5, y: 9.5 },
  rama: { x: 10.5, y: 3.2 }, budi: { x: 10.5, y: 10.2 },
  maya: { x: 20.5, y: 3.2 }, dimas: { x: 28.5, y: 10.2 }, siti: { x: 1.5, y: 10.2 }
};
function isWalkableTileForAgent(agent, tileX, tileY) {
  if (tileX < 0 || tileX >= MAP.w || tileY < 0 || tileY >= MAP.h) return false;
  if (!floor[tileY] || !floor[tileY][tileX] || floor[tileY][tileX] === '#3B2A1D') return false;
  if (deco[tileY][tileX] && deco[tileY][tileX] !== 'elevator' && !String(deco[tileY][tileX]).startsWith('halltile')) return false;
  if (atlasOccupancyAt(agent.floorId || activeFloor, tileX, tileY)) return false;
  const agentFloor = agent.floorId || activeFloor;
  return !AGENTS.some(other => other !== agent && (other.floorId || 1) === agentFloor
    && !other.inTransit && Math.floor(other.x) === tileX && Math.floor(other.y) === tileY);
}

function findWalkPath(agent, gx, gy) {
  if (!window.KRA_APP_READY) return [];
  const start = tileForWorldPosition(agent.x, agent.y);
  const goal = tileForWorldPosition(gx, gy);
  if (start.x === goal.x && start.y === goal.y) return [{ x: gx, y: gy }];
  const startKey = start.x + ',' + start.y;
  const goalKey = goal.x + ',' + goal.y;
  if (!isWalkableTileForAgent(agent, goal.x, goal.y)) return [];
  const queue = [start];
  let queueHead = 0;
  const cameFrom = new Map([[startKey, null]]);
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  while (queueHead < queue.length) {
    const current = queue[queueHead++];
    const currentKey = current.x + ',' + current.y;
    if (currentKey === goalKey) break;
    for (const [dx, dy] of directions) {
      const next = { x: current.x + dx, y: current.y + dy };
      const nextKey = next.x + ',' + next.y;
      if (cameFrom.has(nextKey)) continue;
      if (nextKey !== goalKey && !isWalkableTileForAgent(agent, next.x, next.y)) continue;
      cameFrom.set(nextKey, currentKey);
      queue.push(next);
    }
  }

  if (!cameFrom.has(goalKey)) return [];
  const path = [];
  let key = goalKey;
  while (key && key !== startKey) {
    const [x, y] = key.split(',').map(Number);
    path.push({ x: x + 0.5, y: y + 0.5 });
    key = cameFrom.get(key);
  }
  path.reverse();
  if (path.length) path[path.length - 1] = { x: gx, y: gy };
  return path;
}

function routeFor(agent, gx, gy) {
  const points = findWalkPath(agent, gx, gy);
  return points.length ? points : [];
}
const ELEVATOR_WAYPOINTS = {
  1: { x: 12.0, y: 5.5 },
  2: { x: 12.0, y: 5.5 }
};

function transitAgentToFloor(agent, destinationFloor, thenFn) {
  if (!agent || agent.inTransit || destinationFloor === (agent.floorId || 1)) {
    thenFn && thenFn();
    return;
  }
  const originFloor = agent.floorId || 1;
  const originLift = ELEVATOR_WAYPOINTS[originFloor];
  const destinationLift = ELEVATOR_WAYPOINTS[destinationFloor];
  setAgentState(agent, AGENT_STATES.MOVING, 'walking to elevator');
  const routeStarted = walkPath(agent, originLift.x, originLift.y, () => {
    agent.inTransit = true;
    agent.facing = 'up';
    setAgentState(agent, AGENT_STATES.IN_TRANSIT, 'stepping into elevator');
    agentBubble(agent, 'Taking lift to Floor 0' + destinationFloor + '...', 'task', 1800);
    agentEventBus.emit('agent.floor.transit.started', agent.id, {
      fromFloor: originFloor, toFloor: destinationFloor, waypoint: originLift
    });
    persistPresence(agent);
    setTimeout(() => {
      agent.floorId = destinationFloor;
      agent.x = destinationLift.x;
      agent.y = destinationLift.y;
      agent.inTransit = false;
      agent.facing = 'down';
      setAgentState(agent, AGENT_STATES.MOVING, 'arrived from elevator');
      agentBubble(agent, 'Arrived at Floor 0' + destinationFloor, 'task', 1800);
      agentEventBus.emit('agent.floor.changed', agent.id, {
        fromFloor: originFloor, toFloor: destinationFloor, waypoint: destinationLift
      });
      persistPresence(agent);
      if (activeFloor !== destinationFloor) loadFloor(destinationFloor);
      thenFn && thenFn();
    }, 1200);
  });
  if (!routeStarted) {
    setAgentState(agent, AGENT_STATES.IDLE, 'elevator route blocked');
    termLine('[Lift]: ' + agent.name + ' cannot reach the elevator; transit was cancelled.', 'warn');
  }
}

function walkPath(agent, gx, gy, thenFn, onBlocked) {
  const points = routeFor(agent, gx, gy);
  if (!points.length) {
    agent.pathTarget = null;
    agentEventBus.emit('agent.path.blocked', agent.id, { x: gx, y: gy, floorId: agent.floorId || activeFloor });
    if (typeof onBlocked === 'function') onBlocked();
    return false;
  }
  const next = () => {
    const point = points.shift();
    if (!point) { thenFn && thenFn(); return; }
    const started = walkTo(agent, point.x, point.y, next);
    if (started === false) {
      agent.pathTarget = null;
      if (typeof onBlocked === 'function') onBlocked();
    }
  };
  next();
  return true;
}
function walkTo(agent, gx, gy, thenFn) {
  if (agent.activityBusy && agent.pathTarget && agent.pathTarget.x === gx && agent.pathTarget.y === gy) return false;
  const currentTile = tileForWorldPosition(agent.x, agent.y);
  const targetTile = tileForWorldPosition(gx, gy);
  if ((currentTile.x !== targetTile.x || currentTile.y !== targetTile.y)
    && !findWalkPath(agent, gx, gy).length) {
    agent.pathTarget = null;
    agentEventBus.emit('agent.path.blocked', agent.id, { x: gx, y: gy, floorId: agent.floorId || activeFloor });
    return false;
  }
  agent.pathTarget = { x: gx, y: gy };
  agentEventBus.emit('agent.position.changed', agent.id, { from: { x: agent.x, y: agent.y }, to: { x: gx, y: gy } });
  const startX = agent.x, startY = agent.y;
  const dx = gx - startX, dy = gy - startY;
  const dist = Math.hypot(dx, dy);
  const dur = Math.max(300, dist * 260);
  const t0 = performance.now();
  function step(now) {
    const t = Math.min(1, (now - t0) / dur);
    agent.x = startX + dx * t;
    agent.y = startY + dy * t;
    agent.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    if (t < 1) requestAnimationFrame(step);
    else {
      agent.x = gx;
      agent.y = gy;
      agent.facing = 'down';
      agent.pathTarget = null;
      thenFn && thenFn();
    }
  }
  requestAnimationFrame(step);
  return true;
}

async function proposeWithModel(agentId, actionType, title, targetFile, userPrompt, summary) {
  const agent = AGENTS.find(a => a.id === agentId);
  const agentName = agent ? agent.name : agentId.toUpperCase();
  termLine('[' + agentName + ']: Thinking & generating with AI model...', 'info');

  const system = 'You are ' + agentName + ', a specialist agent in the Kantor-Rama-AI virtual office. '
    + 'Role: ' + (agent ? agent.role : actionType) + '. '
    + 'Your job is to generate the EXACT file contents requested by the user. '
    + 'Return ONLY the code or content of the file. Do not include markdown code block backticks unless they are part of the file itself. '
    + 'Target file: ' + targetFile;

  let content = '';
  try {
    const aiResp = await fetch('../api/index.php?action=model-propose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: userPrompt, system, agentId, model: activeModel }),
    });
    const aiPayload = await aiResp.json();
    if (aiPayload.ok && aiPayload.result && aiPayload.result.content) {
      content = aiPayload.result.content;
      termLine('[' + agentName + ']: AI generation complete (' + aiPayload.result.provider + ' / ' + aiPayload.result.model + ').', 'prompt');
    } else {
      throw new Error(aiPayload.error || 'Model returned empty response');
    }
  } catch (err) {
    termLine('[' + agentName + ']: Model unconfigured or offline (' + err.message + '). Using standard proposal scaffold.', 'warn');
    content = '// Generated by ' + agentName + ' (' + (agent ? agent.role : 'Specialist') + ')\n// Objective: ' + userPrompt + '\n\n'
      + (actionType === 'create' ? '// Module structure ready for development\n' : '// Targeted refactor payload ready\n');
  }

  proposeTask(agentId, actionType, title, targetFile, content, summary);
}

/* --- Step 3: Propose-then-Approve Gate --- */
let pendingTask = null;

const approvalModal = document.getElementById('approval-modal');

function showApprovalGate(task) {
  pendingTask = task;
  document.getElementById('modal-task-title').textContent = 'Approval Gate: ' + task.id;
  const proposingAgent = AGENTS.find(a => a.id === task.agentId);
  const proposingLabel = proposingAgent
    ? (proposingAgent.name + ' (' + proposingAgent.role + ')')
    : task.agentId.toUpperCase();
  document.getElementById('modal-agent-desc').textContent =
    'Proposed by: ' + proposingLabel + ' · ' + task.actionType.toUpperCase();
  document.getElementById('modal-task-summary').textContent = task.summary;
  document.getElementById('modal-target-file').textContent = 'Target: ' + task.targetFile;
  document.getElementById('modal-diff-content').textContent =
    task.proposedContent || '// (no content preview)';
  approvalModal.classList.remove('hidden');

  if (proposingAgent) {
    setAgentState(proposingAgent, AGENT_STATES.WAITING_APPROVAL, 'waiting approval');
    agentBubble(proposingAgent, 'Waiting approval: ' + task.id, 'task', 6000);
  }
  const rama = AGENTS.find(a => a.id === 'rama');
  if (rama) {
    agentBubble(rama, 'Gated: Reviewing proposal ' + task.id, 'system', 5000);
  }
  agentEventBus.emit('approval.requested', task.agentId, { taskId: task.id, title: task.title, target: task.targetFile }, 'rama');
}

function hideApprovalGate() {
  approvalModal.classList.add('hidden');
  pendingTask = null;
}

async function proposeTask(agentId, actionType, title, targetFile, proposedContent, summary) {
  const agent = AGENTS.find(a => a.id === agentId);
  const agentName = agent ? agent.name : agentId.toUpperCase();
  termLine('[' + agentName + ']: Preparing proposal — ' + title, 'info');
  try {
    const body = JSON.stringify({
      agentId, actionType, title, targetFile, proposedContent, summary,
    });
    const response = await fetch('../api/index.php?action=propose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || 'Proposal failed');
    termLine('[Jarvis]: Proposal ' + payload.task.id + ' is WAITING FOR YOUR APPROVAL.', 'warn');
    showApprovalGate(payload.task);
  } catch (error) {
    termLine('[Jarvis]: Proposal unavailable — ' + error.message, 'warn');
  }
}

async function resolveTask(decision) {
  if (!pendingTask) return;
  const task = pendingTask;
  const taskId = task.id;
  const proposingAgent = AGENTS.find(a => a.id === task.agentId);
  const rama = AGENTS.find(a => a.id === 'rama');
  const wasReject = decision === 'reject';

  if (task.kind === 'skill-toggle') {
    hideApprovalGate();
    if (wasReject) {
      termLine('[Skills Hub]: Skill change proposal rejected.', 'warn');
      if (rama) agentBubble(rama, 'Verdict: Skill change REJECTED.', 'alert', 4000);
      await openSkillsHub();
      return;
    }
    try {
      const response = await fetch('../api/index.php?action=skill-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: task.skillChange.agentId,
          skillId: task.skillChange.skillId,
          enabled: task.skillChange.enabled,
          priority: task.skillChange.priority,
          approved: true,
          updatedBy: 'Boss/User',
        }),
      });
      const payload = await response.json();
      if (!payload.ok) throw new Error(payload.error || 'Apply failed');
      termLine('[Skills Hub]: ' + task.summary + ' APPROVED & applied.', 'prompt');
      if (proposingAgent) {
        agentBubble(proposingAgent, 'Skill set updated: ' + task.skillChange.skillId, 'system', 4500);
      }
      if (rama) {
        agentBubble(rama, 'Verdict: APPROVED skill change.', 'system', 4000);
      }
      await openSkillsHub();
    } catch (error) {
      termLine('[Skills Hub]: Failed to apply skill change — ' + error.message, 'warn');
      await openSkillsHub();
    }
    return;
  }

  hideApprovalGate();
  try {
    const response = await fetch('../api/index.php?action=' + decision, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId }),
    });
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || 'Action failed');
    if (wasReject) {
      termLine('[Jarvis]: Task ' + taskId + ' REJECTED. No files were changed.', 'warn');
      if (rama) agentBubble(rama, 'Verdict: REJECTED. Zero writes.', 'alert', 4000);
      if (proposingAgent) {
        setAgentState(proposingAgent, AGENT_STATES.RETURNING, 'proposal rejected');
        setTimeout(() => setAgentState(proposingAgent, AGENT_STATES.IDLE, 'standing by'), 2500);
      }
      agentEventBus.emit('approval.rejected', 'user', { taskId }, task.agentId);
    } else {
      termLine('[Jarvis]: Task ' + taskId + ' APPROVED and executed.', 'prompt');
      if (payload.task && payload.task.execution && payload.task.execution.output) {
        termLine('[Runner]: ' + payload.task.execution.output, 'sys');
      }
      if (rama) agentBubble(rama, 'Verdict: APPROVED. Change written.', 'system', 4000);
      if (proposingAgent) {
        setAgentState(proposingAgent, AGENT_STATES.WORKING, 'executed');
        agentBubble(proposingAgent, 'Execution complete!', 'task', 3500);
        setTimeout(() => setAgentState(proposingAgent, AGENT_STATES.IDLE, 'standing by'), 3500);
      }
      agentEventBus.emit('approval.granted', 'user', { taskId }, task.agentId);
    }
  } catch (error) {
    termLine('[Jarvis]: Could not resolve task — ' + error.message, 'warn');
    if (proposingAgent) setAgentState(proposingAgent, AGENT_STATES.BLOCKED, 'resolution failed');
  }
}

document.getElementById('modal-btn-approve').addEventListener('click', () => resolveTask('approve'));
document.getElementById('modal-btn-reject').addEventListener('click', () => resolveTask('reject'));
document.getElementById('modal-btn-close').addEventListener('click', hideApprovalGate);

/* --- Phase 3: per-agent Skills Hub --- */
const skillsModal = document.getElementById('skills-modal');
const skillsHubContent = document.getElementById('skills-hub-content');

function skillHubAgentId(agentId) {
  const aliases = { creator: 'budi', modifier: 'maya', auditor: 'dimas', ops: 'siti' };
  return aliases[agentId] || agentId;
}

function renderSkillsHub(hub) {
  const agents = (hub && hub.agents) || [];
  skillsHubContent.innerHTML = agents.map(agent => {
    const rows = (agent.skills || []).map(skill => {
      const disabled = !skill.approved || skill.id === 'antislop';
      const checked = skill.enabled ? ' checked' : '';
      const label = skill.id + (skill.approved ? '' : ' · locked');
      return '<label class="skills-row"><span>' + label + ' <small>p' + skill.priority + '</small></span>'
        + '<input type="checkbox" data-agent="' + agent.id + '" data-skill="' + skill.id + '"'
        + checked + (disabled ? ' disabled' : '') + '></label>';
    }).join('');
    return '<section class="skills-agent-card"><h4>' + agent.name + '</h4>' + rows + '</section>';
  }).join('');
  skillsHubContent.querySelectorAll('input[data-skill]').forEach(input => {
    input.addEventListener('change', () => toggleHubSkill(input));
  });
}

async function openSkillsHub() {
  if (!skillsModal || !skillsHubContent) return;
  skillsModal.classList.remove('hidden');
  skillsHubContent.textContent = 'Loading skill assignments…';
  try {
    const response = await fetch('../api/index.php?action=skill-hub');
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || 'Hub unavailable');
    renderSkillsHub(payload.hub);
    termLine('[Skills Hub]: Per-agent assignments loaded.', 'sys');
  } catch (error) {
    skillsHubContent.textContent = 'Skills Hub unavailable: ' + error.message;
    termLine('[Skills Hub]: ' + error.message, 'warn');
  }
}

async function toggleHubSkill(input) {
  const enabled = input.checked;
  input.disabled = true;
  try {
    const previewResponse = await fetch('../api/index.php?action=skill-toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: input.dataset.agent,
        skillId: input.dataset.skill,
        enabled,
        priority: 100,
      }),
    });
    const preview = await previewResponse.json();
    if (!preview.ok) throw new Error(preview.error || 'Preview failed');
    const proposal = preview.proposal;
    const uiAgent = AGENTS.find(item => skillHubAgentId(item.id) === proposal.agentId);
    showApprovalGate({
      id: proposal.id,
      kind: 'skill-toggle',
      agentId: uiAgent ? uiAgent.id : proposal.agentId,
      actionType: 'skill-toggle',
      title: 'Skill change: ' + proposal.skillId,
      targetFile: 'Agent ' + proposal.agentId + ' skill set',
      proposedContent: (proposal.enabled ? 'ENABLE ' : 'DISABLE ') + proposal.skillId
        + '\nPriority: ' + proposal.priority,
      summary: proposal.summary,
      skillChange: proposal,
    });
  } catch (error) {
    input.checked = !enabled;
    input.disabled = false;
    termLine('[Skills Hub]: Change rejected — ' + error.message, 'warn');
  }
}

document.getElementById('skills-btn-close').addEventListener('click', () => {
  skillsModal.classList.add('hidden');
});

/* --- Command bus --- */
async function runRealAudit(target) {
  termLine('[Rama]: Starting read-only audit of ' + target, 'boss');
  try {
    const response = await fetch('../api/index.php?action=audit&target=' + encodeURIComponent(target));
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || 'Audit failed');
    const audit = payload.audit;
    termLine('[Rama]: Scanned ' + audit.summary.files + ' files (' + audit.summary.readableFiles + ' readable).', 'info');
    const findingText = '[Rama]: Found ' + audit.summary.findings
      + ' findings; possible secrets: ' + audit.summary.possibleSecrets + '.';
    termLine(findingText, audit.summary.possibleSecrets ? 'warn' : 'info');
    termLine('[Rama]: VERDICT: ' + audit.verdict, audit.verdict === 'APPROVED' ? 'prompt' : 'boss');
    audit.findings.slice(0, 8).forEach(f => {
      const location = f.file + (f.line ? ':' + f.line : '');
      termLine('[' + f.severity + '] ' + location + ' — ' + f.message, f.severity === 'Critical' ? 'warn' : 'info');
    });
    showBubble('Rama', audit.verdict === 'APPROVED' ? 'Approved. The work is clean.' : 'Needs revision. I found issues in the real files.', 5200);
  } catch (error) {
    termLine('[Rama]: Real audit unavailable — ' + error.message, 'warn');
    termLine('[Jarvis]: Start Apache or run: php -S localhost:8080 -t .', 'prompt');
    showBubble('Rama', 'I cannot reach the local audit bridge yet.', 5000);
  }
}

let milestoneReminderShown = false;

function showMilestoneTriggerReminder(context = 'checkpoint') {
  if (milestoneReminderShown) return;
  milestoneReminderShown = true;
  termLine('[Milestone]: Checkpoint detected (' + context + ').', 'boss');
  termLine('[Milestone]: Save one when a feature/phase is verified, an architecture decision is approved,', 'info');
  termLine('[Milestone]: a critical fix lands, or 3+ related tasks are complete.', 'info');
  termLine('[Milestone]: Use /save to sync evidence, then confirm the milestone in Obsidian.', 'prompt');
}

async function syncObsidianMemory() {
  termLine('[Jarvis]: Syncing live memory session to Obsidian vault...', 'sys');
  showMilestoneTriggerReminder('memory sync');
  try {
    const res = await fetch('../api/index.php?action=vault-sync', { method: 'POST' });
    const payload = await res.json();
    if (!payload.ok) throw new Error(payload.error || 'Sync failed');
    termLine('[Jarvis]: Report saved → ' + payload.reportFile, 'prompt');
    termLine('[Jarvis]: ' + payload.tasksTotal + ' tasks & ' + payload.chatLogged + ' chats synced.', 'info');
  } catch (err) {
    termLine('[Jarvis]: Memory sync error: ' + err.message, 'warn');
  }
}

async function recallObsidianMemory(query) {
  termLine('[Jarvis]: Querying Obsidian memory vault for: ' + query, 'info');
  try {
    const res = await fetch('../api/index.php?action=vault-recall&q=' + encodeURIComponent(query));
    const payload = await res.json();
    if (!payload.ok || !payload.matches || payload.matches.length === 0) {
      termLine('[Jarvis]: No matching memory records found.', 'warn');
      return;
    }
    payload.matches.forEach(m => {
      termLine('📄 ' + m.file, 'prompt');
      termLine('   ' + m.excerpt, 'info');
    });
  } catch (err) {
    termLine('[Jarvis]: Memory recall error: ' + err.message, 'warn');
  }
}

async function runTerminalCommand(command) {
  termLine('$ ' + command, 'prompt');
  chatLiveStatus.textContent = '● EXECUTING';
  try {
    const res = window.kraDesktop && window.kraDesktop.execCommand
      ? await window.kraDesktop.execCommand(command)
      : await (await fetch('../api/index.php?action=terminal-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      })).json();
    chatLiveStatus.textContent = '● COMMAND MODE';
    (res.output || '').split('\n').forEach(line => termLine(line, res.ok ? 'sys' : 'warn'));
  } catch (err) {
    chatLiveStatus.textContent = '● COMMAND MODE';
    termLine('[Terminal]: Execution failed: ' + err.message, 'warn');
  }
}

function handleCommand(raw) {
  const cmd = raw.trim();
  if (!cmd) return;
  termLine('> ' + cmd, 'user');

  const lower = cmd.toLowerCase();

  if (lower === '/status' || lower === '/rama briefing') {
    termLine('[Jarvis]: Reading memory from vault ...', 'info');
    fetch('../api/index.php?action=vault-dashboard')
      .then(r => r.json())
      .then(memory => {
        if (memory.connected) {
          termLine('[Memory]: ' + memory.systemStatus + ' · ' + memory.milestones + ' milestones.', 'sys');
          termLine('[Memory]: ' + memory.reports + ' dashboard report entries indexed.', 'info');
          showMilestoneTriggerReminder('status checkpoint');
        } else {
          termLine('[Memory]: Obsidian dashboard unavailable.', 'warn');
        }
        return fetch('../api/index.php?action=runtime');
      })
      .then(r => r.json())
      .then(runtime => {
        termLine('[Runtime]: PHP ' + runtime.php + ' · MySQL ' + (runtime.database ? 'online' : 'offline'), 'sys');
        termLine('[Rama]: Briefing complete. Team is ready for assignment.', 'boss');
      })
      .catch(error => termLine('[Jarvis]: Briefing unavailable — ' + error.message, 'warn'));
    showBubble('Rama', 'Reading memory and runtime status.', 4200);
    return;
  }

  if (lower === '/providers' || lower === '/ai') {
    termLine('[Jarvis]: Checking configured multi-model providers...', 'info');
    fetch('../api/index.php?action=providers')
      .then(r => r.json())
      .then(data => {
        if (!data.ok || !data.config.configured) {
          termLine('[Jarvis]: No local config.json. See docs/BYOK_PROVIDER_SETUP.md.', 'warn');
          return;
        }
        termLine('[Jarvis]: Default provider = ' + data.config.defaultProvider, 'sys');
        Object.entries(data.config.providers).forEach(([name, p]) => {
          const state = p.configured ? 'ready' : 'key missing';
          termLine('  - ' + name + ' (' + p.model + '): ' + state, p.configured ? 'prompt' : 'info');
        });
      })
      .catch(e => termLine('[Jarvis]: Providers endpoint unreachable: ' + e.message, 'warn'));
    return;
  }

  if (lower === '/skills hub' || lower === '/skill-hub') {
    openSkillsHub();
    return;
  }

  if (lower.startsWith('/skills')) {
    const rest = cmd.slice('/skills'.length).trim();
    const parts = rest.split(/\s+/).filter(Boolean);
    const agentIds = ['rama', 'budi', 'maya', 'dimas', 'siti'];
    let agentId = '';
    if (parts.length && agentIds.includes(parts[0].toLowerCase())) {
      agentId = parts.shift().toLowerCase();
    }
    const query = parts.join(' ');
    termLine('[Jarvis]: Reading skill catalog and lock state...', 'info');
    const url = '../api/index.php?action=skills'
      + (agentId ? '&agentId=' + encodeURIComponent(agentId) : '')
      + (query ? '&q=' + encodeURIComponent(query) : '');
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (!data.ok) {
          termLine('[Skills]: Catalog unavailable.', 'warn');
          return;
        }
        const entries = Object.values(data.skills || {});
        const approved = entries.filter(s => s.approved).length;
        termLine('[Skills]: ' + entries.length + ' installed · ' + approved + ' approved.', 'sys');
        entries.forEach(s => {
          const state = s.approved ? 'approved' : (s.drift ? 'drift' : (s.status || 'pending'));
          const pin = s.commit ? s.commit.slice(0, 8) : 'local';
          termLine('  - ' + s.id + ' [' + state + '] ' + (s.source || 'local') + ' @ ' + pin,
            s.approved ? 'prompt' : 'warn');
        });
        if (agentId) {
          const active = (data.active || []).join(', ') || 'none';
          termLine('[Routing]: ' + agentId + ' · mode ' + data.mode + ' · active ' + active, 'info');
        }
      })
      .catch(e => termLine('[Skills]: Query failed: ' + e.message, 'warn'));
    return;
  }

  if (lower.startsWith('/rama review') || lower.startsWith('/review') || lower === '/audit workspace') {
    const targetInput = document.getElementById('audit-target');
    const target = targetInput && targetInput.value.trim() ? targetInput.value.trim() : '.';
    walkTo(AGENTS[0], 6.6, 4.2, () => runRealAudit(target));
    return;
  }

  if (lower.startsWith('/audit')) {
    termLine('[Jarvis]: Dispatching Auditor Agent...', 'info');
    walkTo(AGENTS[3], 8.6, 12.1, () => {
      setTimeout(() => termLine('[Auditor]: Scanning workspace tree...', 'info'), 300);
      setTimeout(() => termLine('[Auditor]: 0 critical issues · 3 warnings · coverage 0%.', 'warn'), 1000);
      setTimeout(() => termLine('[Rama]: Noted. Auditor, file a report to the Dashboard.', 'boss'), 1600);
      setTimeout(() => termLine('[Jarvis]: Report linked to "Dashboard KRA Project.md".', 'sys'), 2200);
    });
    return;
  }

  if (lower.startsWith('/create')) {
    const prompt = cmd.slice('/create'.length).trim() || 'New KRA module';
    const targetFile = 'proposals/' + prompt.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '.txt';
    walkTo(AGENTS[1], 6.4, 12.0, () => {
      proposeWithModel(
        'creator',
        'create',
        prompt,
        targetFile,
        prompt,
        'Budi (Creator) drafted a proposal. Review the content before approving.'
      );
    });
    return;
  }

  if (lower.startsWith('/modify')) {
    const spec = cmd.slice('/modify'.length).trim() || 'Targeted change requested';
    walkTo(AGENTS[2], 11.4, 12.0, () => {
      proposeWithModel(
        'modifier',
        'modify',
        'Modifier: ' + spec.slice(0, 30),
        'proposals/modifier-change.txt',
        spec,
        'Maya (Modifier) prepared a proposed change. Review before execution.'
      );
    });
    return;
  }

  if (lower.startsWith('/save') || lower === '/memory' || lower === '/sync') {
    showMilestoneTriggerReminder('save command');
    syncObsidianMemory();
    return;
  }

  if (lower.startsWith('/recall ')) {
    recallObsidianMemory(cmd.slice('/recall'.length).trim());
    return;
  }

  if (lower.startsWith('/agent')) {
    const target = lower.slice('/agent'.length).trim();
    if (!target) {
      termLine('[Jarvis]: Usage: /agent <rama | budi | maya | dimas | siti>', 'info');
      termLine('[Jarvis]: Current active agent: ' + selectedAgent.name, 'prompt');
      return;
    }
    const match = AGENTS.find(a => a.id === target || a.name.toLowerCase() === target);
    if (match) {
      selectAgent(match.id);
      termLine('[Jarvis]: Agent switched to ' + match.name + ' (' + match.role + ').', 'prompt');
    } else {
      termLine('[Jarvis]: Unknown agent: ' + target + '. Available: rama, budi, maya, dimas, siti', 'warn');
    }
    return;
  }

  if (lower.startsWith('/floor ')) {
    const requestedFloor = Number(lower.slice('/floor'.length).trim());
    if (![1, 2].includes(requestedFloor)) {
      termLine('[Jarvis]: Usage: /floor 1 or /floor 2.', 'warn');
      return;
    }
    if ((selectedAgent.floorId || 1) === requestedFloor) {
      loadFloor(requestedFloor);
    } else {
      transitAgentToFloor(selectedAgent, requestedFloor, () => {
        termLine('[Lift]: ' + selectedAgent.name + ' arrived at Floor 0' + requestedFloor + '.', 'sys');
      });
    }
    return;
  }

  if (lower.startsWith('/meeting')) {
    const budi = AGENTS.find(a => a.id === 'creator');
    const maya = AGENTS.find(a => a.id === 'modifier');
    if (budi && maya && (budi.floorId || 1) !== (maya.floorId || 1)) {
      transitAgentToFloor(maya, budi.floorId || 1, () => {
        startCollaborationScene(budi, maya, 'Let us review the proposed module.', 'I will check the diff.');
      });
      termLine('[Lift]: Maya is moving to Budi\'s floor before the collaboration.', 'info');
      return;
    }
    startCollaborationScene(budi, maya, 'Let us review the proposed module.', 'I will check the diff and dependencies.');
    termLine('[Jarvis]: Collaboration scene requested for Budi and Maya.', 'info');
    return;
  }

  if (lower === '/clear') {
    terminal.innerHTML = '';
    termLine('[Jarvis]: Terminal stream cleared.', 'sys');
    return;
  }

  if (lower === '/hire') {
    hireModal.classList.remove('hidden');
    termLine('[Jarvis]: Opening Hire Agent modal...', 'info');
    return;
  }

  if (lower === '/model' || lower.startsWith('/model ')) {
    const requestedModel = cmd.slice('/model'.length).trim();
    if (requestedModel) {
      activeModel = requestedModel;
      localStorage.setItem('kra-model', activeModel);
      termLine('[Jarvis]: Active model set to ' + activeModel + '.', 'prompt');
      return;
    }
    termLine('[Jarvis]: Querying 9Router live models...', 'info');
    fetch('../api/index.php?action=router-models')
      .then(r => r.json())
      .then(d => {
        const models = (d.catalog && d.catalog.models) || [];
        termLine('[9Router]: Online · ' + models.length + ' model(s) available.', 'sys');
        models.slice(0, 10).forEach(m => {
          termLine('  • ' + (m.id || m.name), 'prompt');
        });
      })
      .catch(e => termLine('[9Router]: Model query failed: ' + e.message, 'warn'));
    return;
  }

  if (lower.startsWith('/help')) {
    termLine('=== OPENCODE / KRA COMMAND REFERENCE ===', 'sys');
    termLine('  /agent <name>   Switch active subagent focus & channel', 'prompt');
    termLine('  /create <desc>  Scaffold new module file (Budi)', 'prompt');
    termLine('  /modify <desc>  Refactor or edit target file (Maya)', 'prompt');
    termLine('  /audit [path]   Inspect security, paths, & hygiene (Dimas)', 'prompt');
    termLine('  /rama review    Request executive audit verdict from Rama', 'boss');
    termLine('  /model [name]   List or select a live 9Router model', 'info');
    termLine('  /skills [agent] [task] Show lock state and active routing', 'info');
    termLine('  /providers      Display BYOK provider connection status', 'info');
    termLine('  /status         Display runtime, PHP, and MySQL status', 'info');
    termLine('  /hire           Hire a new agent from 36 archetypes', 'info');
    termLine('  /save or /sync  Sync tasks, chat metrics, and status to Obsidian', 'info');
    termLine('  /recall <query> Search past reports in the KRA vault', 'info');
    termLine('  /meeting        Start a Budi + Maya collaboration scene', 'info');
    termLine('  /floor <1|2>    Move active agent to specified floor', 'info');
    termLine('  Run shell commands in Terminal mode (desktop recommended)', 'info');
    termLine('  /clear          Clear terminal stream display', 'info');
    termLine('  /help           Display this command catalog', 'info');
    termLine('  SFX             Toggle retro Web Audio feedback from header', 'info');
    termLine('---------------------------------------------------------', 'sys');
    return;
  }

  // Terminal tab preserves the OpenCode-style command bus and slash commands.
  if (activeChatChannel === 'terminal') {
    if (!cmd.startsWith('/')) {
      runTerminalCommand(cmd);
    }
    return;
  }

  // Free chat is channel-aware and sent to the selected live officer/team.
  sendAgentChat(cmd);
  const focusId = activeChatChannel === 'team' ? 'rama' : activeChatChannel;
  const focusAgent = AGENTS.find(agent => agent.id === focusId) || AGENTS[0];
  showBubble(focusAgent.name, 'Message received. I am reviewing it now.', 3800);
  walkTo(focusAgent, focusAgent.homeX + 0.8, focusAgent.homeY, () => {
    setTimeout(() => walkTo(focusAgent, focusAgent.homeX, focusAgent.homeY), 400);
  });
}

/* --- Retro SFX --- */
let kraAudioContext = null;
let sfxEnabled = localStorage.getItem('kra-sfx') !== 'off';
function playSfx(type) {
  if (!sfxEnabled) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  kraAudioContext = kraAudioContext || new AudioCtx();
  const oscillator = kraAudioContext.createOscillator();
  const gain = kraAudioContext.createGain();
  const now = kraAudioContext.currentTime;
  const settings = type === 'gated'
    ? { start: 520, end: 880, duration: 0.22 }
    : { start: type === 'send' ? 660 : 440, end: type === 'send' ? 880 : 620, duration: 0.1 };
  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(settings.start, now);
  oscillator.frequency.exponentialRampToValueAtTime(settings.end, now + settings.duration);
  gain.gain.setValueAtTime(0.045, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + settings.duration);
  oscillator.connect(gain).connect(kraAudioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + settings.duration);
}

/* --- Theme persistence --- */
const themeToggle = document.getElementById('btn-theme-toggle');
if (localStorage.getItem('kra-theme') === 'dark') document.body.classList.add('dark-mode');
if (themeToggle) {
  const updateThemeLabel = () => {
    themeToggle.textContent = document.body.classList.contains('dark-mode') ? '☀️ Light' : '🌙 Dark';
  };
  updateThemeLabel();
  const soundToggle = document.getElementById('btn-sound-toggle');
  const updateSoundLabel = () => {
    if (soundToggle) soundToggle.textContent = sfxEnabled ? '🔊 SFX' : '🔇 SFX';
  };
  if (soundToggle) {
    updateSoundLabel();
    soundToggle.addEventListener('click', () => {
      sfxEnabled = !sfxEnabled;
      localStorage.setItem('kra-sfx', sfxEnabled ? 'on' : 'off');
      updateSoundLabel();
      if (sfxEnabled) playSfx('reply');
    });
  }
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('kra-theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    updateThemeLabel();
  });
}

/* --- Input events --- */
commandInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { handleCommand(commandInput.value); commandInput.value = ''; }
});
document.getElementById('btn-send-cmd').addEventListener('click', () => {
  handleCommand(commandInput.value); commandInput.value = '';
});
document.querySelectorAll('.chat-tab').forEach(tab => {
  tab.addEventListener('click', () => switchChatChannel(tab.dataset.channel));
});
document.querySelectorAll('.action-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    commandInput.value = chip.dataset.cmd;
    handleCommand(chip.dataset.cmd);
    commandInput.value = '';
  });
});
document.getElementById('btn-clear-term').addEventListener('click', () => {
  terminal.innerHTML = '';
  termLine('[Jarvis]: Terminal cleared.', 'sys');
});
document.getElementById('btn-sync-memory').addEventListener('click', () => {
  handleCommand('/save');
});
document.getElementById('btn-live-audit').addEventListener('click', () => {
  const target = document.getElementById('audit-target').value.trim();
  if (!target) { termLine('[Jarvis]: Select a project folder first.', 'warn'); return; }
  runRealAudit(target);
});

/* --- Step 4: Desktop folder picker and human-named agent hiring --- */
const desktopApi = window.kraDesktop;
const browseFolderButton = document.getElementById('btn-browse-folder');
if (desktopApi && browseFolderButton) {
  browseFolderButton.classList.remove('hidden');
  browseFolderButton.addEventListener('click', async () => {
    const folder = await desktopApi.selectFolder();
    if (folder) {
      document.getElementById('audit-target').value = folder;
      termLine('[Jarvis]: Audit folder selected: ' + folder, 'sys');
    }
  });
}

const hireModal = document.getElementById('hire-modal');
const hireNameSelect = document.getElementById('hire-name-select');
const hireCustomName = document.getElementById('hire-custom-name');
const hireRoleSelect = document.getElementById('hire-role-select');
const hireRolePreview = document.getElementById('hire-role-preview');
const openHireButton = document.getElementById('btn-open-hire');
const closeHireModal = () => hireModal.classList.add('hidden');
let roleTemplates = {};

function updateRolePreview() {
  const role = roleTemplates[hireRoleSelect.value];
  if (!role) {
    hireRolePreview.textContent = 'Role catalog unavailable; choose a basic role after the API is online.';
    return;
  }
  const skills = role.skills && role.skills.length ? role.skills.join(' · ') : 'No linked skills';
  hireRolePreview.innerHTML = '<strong>' + role.name + '</strong><br>'
    + role.description + '<br><span class="role-skills">Skills: ' + skills + '</span>';
}

async function loadRoleTemplates() {
  try {
    const response = await fetch('../api/index.php?action=templates');
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || 'Template catalog unavailable');
    roleTemplates = payload.templates || {};
    hireRoleSelect.innerHTML = Object.entries(roleTemplates).map(([id, role]) =>
      '<option value="' + id + '">' + role.name + '</option>'
    ).join('');
    hireRoleSelect.addEventListener('change', updateRolePreview);
    updateRolePreview();
    termLine('[Jarvis]: Loaded ' + payload.count + ' Munder Difflin role templates.', 'sys');
  } catch (error) {
    termLine('[Jarvis]: Role catalog unavailable — ' + error.message, 'warn');
  }
}

hireNameSelect.addEventListener('change', () => {
  hireCustomName.classList.toggle('hidden', hireNameSelect.value !== 'custom');
  if (hireNameSelect.value === 'custom') hireCustomName.focus();
});
openHireButton.addEventListener('click', () => hireModal.classList.remove('hidden'));
document.getElementById('hire-btn-close').addEventListener('click', closeHireModal);
document.getElementById('hire-btn-cancel').addEventListener('click', closeHireModal);
document.getElementById('hire-btn-confirm').addEventListener('click', () => {
  const chosenName = hireNameSelect.value === 'custom' ? hireCustomName.value.trim() : hireNameSelect.value;
  const roleId = hireRoleSelect.value;
  const roleTemplate = roleTemplates[roleId];
  const role = roleTemplate ? roleTemplate.name : roleId;
  const accent = document.getElementById('hire-accent-select').value;
  if (!chosenName) {
    termLine('[Jarvis]: A human name is required before seating the agent.', 'warn');
    return;
  }
  const id = 'agent-' + Date.now();
  const hotDeskSeats = [
    { x: 20.5, y: 3.2 }, { x: 23.5, y: 3.2 },
    { x: 26.5, y: 3.2 }, { x: 28.5, y: 3.2 },
  ];
  const fallbackSeats = [
    { x: 6.2, y: 14.6 }, { x: 10.2, y: 14.6 },
    { x: 15.2, y: 14.6 }, { x: 20.2, y: 13.8 },
    { x: 23.2, y: 13.8 },
  ];
  const occupiedHotDesks = new Set(
    AGENTS.filter(a => (a.floorId || 1) === 2).map(a => Math.round(a.homeX))
  );
  const freeHotDesk = hotDeskSeats.find(s => !occupiedHotDesks.has(Math.round(s.x)));
  const fallbackIndex = Math.max(0, (AGENTS.length - 5) % fallbackSeats.length);
  const seat = freeHotDesk || fallbackSeats[fallbackIndex];
  const assignedFloor = freeHotDesk ? 2 : 1;
  const humanNameExists = AGENTS.some(a => a.name.toLowerCase() === chosenName.toLowerCase());
  if (humanNameExists) {
    termLine('[Jarvis]: That human name is already assigned. Choose a distinct name.', 'warn');
    return;
  }
  const hired = {
    id, name: chosenName.toUpperCase(), role,
    templateId: roleId,
    x: seat.x, y: seat.y, homeX: seat.x, homeY: seat.y, floorId: assignedFloor,
    badge: 'badge-idle', status: 'standing by',
    palette: { skin: '#E8B98A', hair: '#241A12', primary: accent, accent: '#FFF8E7' },
    intro: chosenName + ': Ready to contribute to Rama\'s office.'
  };
  AGENTS.push(hired);
  registerHiredChatChannel(hired);
  fetch('../api/index.php?action=save-agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(hired),
  }).catch(() => termLine('[Jarvis]: Agent seated locally; database sync unavailable.', 'warn'));
  buildRoster();
  closeHireModal();
  termLine('[Rama]: Welcome ' + chosenName + ', hired as ' + role + '.', 'boss');
  showBubble('Rama', chosenName + ' is seated and ready.', 4200);
});

/* --- Boot --- */
async function loadRuntimeStatus() {
  try {
    const response = await fetch('../api/index.php?action=runtime');
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || 'Runtime unavailable');
    termLine('[Runtime]: PHP ' + payload.php + ' · MySQL ' + (payload.database ? 'online' : 'offline'), 'sys');
    termLine('[Runtime]: Task states ' + payload.executionStates.join(' → '), 'info');
    loadRouterStatus();
  } catch (error) {
    termLine('[Runtime]: Status unavailable — ' + error.message, 'warn');
  }
}

async function loadRouterStatus() {
  try {
    const response = await fetch('../api/index.php?action=router-health');
    const payload = await response.json();
    const health = payload.health || {};
    if (health.online) {
      termLine('[9Router]: Online · provider ' + health.provider + '.', 'prompt');
      const catalogRes = await fetch('../api/index.php?action=router-models');
      const catalogPayload = await catalogRes.json();
      const models = (catalogPayload.catalog && catalogPayload.catalog.models) || [];
      termLine('[9Router]: ' + models.length + ' model(s) available to KRA.', 'sys');
    } else {
      termLine('[9Router]: Offline or busy — simulator fallback remains available.', 'warn');
    }
  } catch (error) {
    termLine('[9Router]: Status unavailable — simulator fallback remains available.', 'warn');
  }
}

async function hydrateAgentState() {
  const [rosterResult, presenceResult] = await Promise.allSettled([
    fetch('../api/index.php?action=hired-agents').then(response => response.json()),
    fetch('../api/index.php?action=presence').then(response => response.json())
  ]);
  if (rosterResult.status === 'fulfilled' && rosterResult.value.ok) {
    mergePersistedAgents(rosterResult.value.agents);
  }
  if (presenceResult.status === 'fulfilled' && presenceResult.value.ok
    && Array.isArray(presenceResult.value.presence)) {
    presenceResult.value.presence.forEach(p => {
      const ag = AGENTS.find(a => a.id === p.agent_id);
      if (!ag) return;
      // Persisted coordinates were created against older map dimensions. Keep
      // agents on their current, valid room home when migrated values fall
      // outside this 32×12 world.
      const persistedFloor = Number(p.floor_id);
      const persistedX = Number(p.x);
      const persistedY = Number(p.y);
      if (persistedFloor === 1 || persistedFloor === 2) ag.floorId = persistedFloor;
      if (Number.isFinite(persistedX) && Number.isFinite(persistedY)
        && persistedX >= 0 && persistedX < MAP.w && persistedY >= 0 && persistedY < MAP.h) {
        ag.x = persistedX;
        ag.y = persistedY;
      }
      if (p.in_transit !== undefined) ag.inTransit = Number(p.in_transit) === 1;
      if (p.state && p.state !== 'idle') {
        ag.state = p.state;
        ag.status = p.activity || ag.status;
      }
    });
  }
}

async function boot() {
  drawPortrait();
  buildRoster();
  window.KRA_APP_READY = true;
  window.KRA_APP_READY_AT = performance.now();
  loadRoleTemplates();
  loadRuntimeStatus();
  fetch('../api/index.php?action=vault-dashboard')
    .then(r => r.json())
    .then(memory => {
      termLine('[Memory]: ' + (memory.systemStatus || 'Vault status unavailable'), memory.connected ? 'sys' : 'warn');
    })
    .catch(() => termLine('[Memory]: Startup vault read unavailable.', 'warn'));
  switchChatChannel('team');
  // Atlas and initial visual readiness should not wait for backend roster/presence latency.
  const atlasInitialization = initOfficeAtlas().then(() => {
    window.KRA_APP_ATLAS_READY_AT = performance.now();
  });
  render();
  hydrateAgentState().then(() => {
    buildRoster();
    drawPortrait();
  });
  await atlasInitialization;

  // idle: boss paces occasionally
  setInterval(() => {
    if (Math.random() < 0.35) {
      const targetX = AGENTS[0].homeX + (Math.random() < 0.5 ? -1.4 : 1.6);
      walkTo(AGENTS[0], targetX, AGENTS[0].homeY, () => {
        setTimeout(() => walkTo(AGENTS[0], AGENTS[0].homeX, AGENTS[0].homeY), 500);
      });
    }
  }, 9000);

  setTimeout(() => showBubble('Rama', AGENTS[0].intro.replace(/^[^:]+:\s*/, ''), 6000), 900);
  termLine('[Jarvis]: Office online. Tip: try /rama review', 'prompt');
}

boot();
