/* ==========================================================================
KRA Kantor-Rama-AI Virtual Office Engine (Prototype)
Design adapted from Munder Difflin (HarnessMD/munder-difflin)
========================================================================== */

'use strict';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
  ));
}

if (!sessionStorage.getItem('kra_auth_token')) {
  window.location.replace('login.html');
}

/* ---------- 1. WORLD PALETTE (earthbound / SNES tiles) ---------- */
const FLOOR = {
  execL: '#96592F',
  execD: '#7B4523',
  woodL: '#E5C896',
  woodD: '#C9A66B',
  serverL: '#33475B',
  serverD: '#28394A',
  loungeL: '#B98A5C',
  loungeD: '#9C7148',
  pathL: '#E8D8B0',
  pathD: '#D6C299',
  corridor:'#6B5138'
};

const DECO = {
  wall: '#593E2B',
  wallTop: '#7A5537',
  rug: '#9E2A2B',
  rugTrim: '#6E1423',
  deskA: '#8A5A32',
  deskB: '#6E4523',
  deskTop: '#A9743F',
  shelf: '#7C5B3A',
  shelfDk: '#5C4028',
  metal: '#4A5560',
  metalLt: '#7C8894',
  serverRk: '#1F2A36',
  blinkyG: '#6BCF7F',
  blinkyR: '#FF6B6B',
  blinkyY: '#FFD93D',
  lamp: '#F4D35E',
  plant: '#3F7D4A',
  plantDk: '#2C5C34',
  pot: '#A5653C',
  white: '#FFF8E7',
  ink: '#1A1320'
};

/* ---------- 2. ROOM MAP ---------- */
const T = 32;
const ASSET_REGISTRY = window.KRAAssetRegistry || null;
const FLOOR_PRESETS = {
  1: Object.freeze({ map: { w: 40, h: 20, corridorY: 9 } }),
  // Rebalanced as a deeper two-tier colony floor: generous room bays with a
  // continuous two-tile circulation spine and a central lift.
  2: Object.freeze({ map: { w: 44, h: 20, corridorY: 9 } })
};
const LEGACY_FLOOR2_PRESET = window.KRAAssetRegistry && window.KRAAssetRegistry.FLOOR2_LEGACY_40x14;
let activeFloor = 1;
let activePreset = FLOOR_PRESETS[1];
const MAP = { ...activePreset.map };
const MAP_WORLD = { w: MAP.w * T, h: MAP.h * T };
let CORRIDOR_Y = activePreset.map.corridorY;
var atlasWalkBlockers = { 1: new Set(), 2: new Set() };
var atlasBlockersDirty = { 1: true, 2: true };
const floorMaps = { 1: null, 2: null };
const floorLabels = { 1: 'Floor 01: Headquarters', 2: 'Floor 02: Innovation Deck' };

function activateMapPreset(level) {
  activePreset = FLOOR_PRESETS[level];
  MAP.w = activePreset.map.w;
  MAP.h = activePreset.map.h;
  MAP_WORLD.w = MAP.w * T;
  MAP_WORLD.h = MAP.h * T;
  CORRIDOR_Y = activePreset.map.corridorY;
}

/* Single source of truth for room geometry, floor/wall treatment, rugs and
labels. floor/wall keys map to painters in the render section below. */
const ROOM_DEFS = {
  1: [
    { id: 'admin', label: 'ADMIN OFFICES', x: 0, y: 0, w: 12, h: 9, floor: 'colonySlate', wall: 'exec', accent: '#00F5D4', rug: null },
    { id: 'manager', label: 'MANAGER - RAMA', x: 12, y: 0, w: 10, h: 9, floor: 'colonySlate', wall: 'exec', accent: '#F4D35E', rug: { x: 14.2, y: 1.7, w: 5.6, h: 2.55, fill: '#232733', trim: '#C9A24B' } },
    { id: 'studio', label: 'STUDIO - MAYA', x: 22, y: 0, w: 8, h: 9, floor: 'colonySlate', wall: 'studio', accent: '#FF6B6B', rug: { x: 23.2, y: 1.7, w: 5.7, h: 2.7, fill: '#8E7F6A', trim: '#5F5344' } },
    { id: 'lobby', label: 'LOBBY - KRA', x: 30, y: 0, w: 10, h: 9, floor: 'colonySlate', wall: 'lobby', accent: '#B197FC', rug: { x: 32.4, y: 1.7, w: 4.2, h: 2.6, fill: '#7A2436', trim: '#C9A24B' } },
    { id: 'records', label: 'RECORDS - SITI', x: 0, y: 11, w: 10, h: 9, floor: 'colonySlate', wall: 'records', accent: '#6BCF7F', rug: { x: 0.9, y: 12.65, w: 4.4, h: 2.7, fill: '#14635C', trim: '#0B3F3A' } },
    { id: 'meeting', label: 'MEETING - BUDI', x: 10, y: 11, w: 10, h: 9, floor: 'colonySlate', wall: 'meeting', accent: '#4ECDC4', rug: { x: 12.0, y: 12.35, w: 5.0, h: 3.3, fill: '#177E72', trim: '#0D4A44' } },
    { id: 'pantry', label: 'PANTRY - TEAM', x: 20, y: 11, w: 10, h: 9, doorX: 23.5, floor: 'colonySlate', wall: 'pantry', accent: '#F4D35E', rug: null },
    { id: 'play', label: 'PLAY - DIMAS', x: 30, y: 11, w: 10, h: 9, doorX: 33.5, floor: 'colonySlate', wall: 'play', accent: '#FF6B6B', rug: { x: 33.2, y: 13.35, w: 3.6, h: 2.1, fill: '#4B2A6E', trim: '#2A1844' } }
  ],
2: [
  { id: 'warroom', label: '01 EMERGENCY WAR ROOM', x: 0, y: 0, w: 15, h: 9, floor: 'colonySlate', wall: 'war', accent: '#00F5D4', rug: { x: 4.0, y: 2.2, w: 7.0, h: 2.1, fill: '#5E2230', trim: '#2E1219' } },
  { id: 'innovation', label: '02 INNOVATION STUDIO', x: 15, y: 0, w: 15, h: 9, floor: 'colonySlate', wall: 'inno', accent: '#FF007F', rug: { x: 16.0, y: 2.0, w: 12.0, h: 2.1, fill: '#4E2A52', trim: '#2C1830' } },
  { id: 'server2', label: 'SERVER ROOM - JARVIS', x: 30, y: 0, w: 14, h: 9, floor: 'colonySlate', wall: 'server', accent: '#00F0FF', rug: { x: 31.0, y: 2.0, w: 12.0, h: 2.1, fill: '#123D52', trim: '#0A2637' } },
  { id: 'observatory', label: '03 SYSTEMS OBSERVATORY', x: 0, y: 11, w: 15, h: 9, floor: 'colonySlate', wall: 'obs', accent: '#B197FC', rug: { x: 4.0, y: 12.8, w: 6.0, h: 2.1, fill: '#1D4A54', trim: '#0F2C33' } },
  { id: 'lounge2', label: '04 SKY LOUNGE', x: 15, y: 11, w: 15, h: 9, floor: 'colonySlate', wall: 'sky', accent: '#F4D35E', rug: { x: 17.0, y: 12.8, w: 6.0, h: 2.1, fill: '#8A5A3B', trim: '#5E3C24' } },
  { id: 'command', label: '06 COMMAND DECK', x: 30, y: 11, w: 14, h: 9, floor: 'colonySlate', wall: 'command', accent: '#FF6B6B', rug: { x: 31.0, y: 12.8, w: 12.0, h: 2.1, fill: '#4A2530', trim: '#2A1119' } }
]
};

// floor[][] : floor-type key per tile (see FLOOR_PAINTERS)
// deco[][] : overlay furniture sprite id per tile (or null); multi-tile
// Argon props anchor at their top-left occupancy tile.
let activeRoomId = null;
const floor = [];
const deco = [];
const rooms = []; // legacy registry, mirrors ROOM_DEFS for older callers

function room(id, label, x, y, w, h, fL, fD, accent) {
  const r = { id, label, x, y, w, h, fL, fD, accent };
  rooms.push(r);
  return r;
}

let buildingFloorId = 1;
function put(x, y, sprite) {
  // Keep authored prop layouts intact while moving the lower room tier down
  // to create a full-height circulation hall and room interiors.
  const tileY = buildingFloorId === 1 && y >= 8 ? y + 3
    : buildingFloorId === 2 && y >= 7 ? y + 4 : y;
  if (tileY < 0 || tileY >= MAP.h || x < 0 || x >= MAP.w) return;
  deco[tileY][x] = sprite;
}

function rectFloor(x, y, w, h, key) {
  for (let ty = y; ty < y + h; ty++)
  for (let tx = x; tx < x + w; tx++)
  if (ty >= 0 && ty < MAP.h && tx >= 0 && tx < MAP.w)
  floor[ty][tx] = key;
}

function fillBackground() {
  for (let y = 0; y < MAP.h; y++) {
    floor[y] = [];
    deco[y] = [];
    for (let x = 0; x < MAP.w; x++) {
      floor[y][x] = 'recordsWood';
      deco[y][x] = null;
    }
}
}

function applyRoomFloors(floorId) {
  ROOM_DEFS[floorId].forEach(r => {
      rectFloor(r.x, r.y, r.w, r.h, r.floor);
      room(r.id, r.label, r.x, r.y, r.w, r.h, r.floor, r.floor, r.accent);
    });
rectFloor(0, CORRIDOR_Y, MAP.w, 2, floorId === 2 ? 'redCorridor' : 'colonySlate');
}

/* Furniture layouts use Argon atlas ids directly (Batch 1/3/4). Every
multi-tile prop is placed by its occupancy footprint from
argon_office_furniture.json; chairs are sittable (see SITTABLE_FRAMES)
so each agent's home tile can be the chair behind their desk. */
function buildWorld() {
  buildingFloorId = 1;
  fillBackground();
  rooms.length = 0;
  applyRoomFloors(1);

  // --- ADMIN OFFICES (x 0..11): shared terminals, glass and plants
  put(1, 0, '04_mgr_panoramic_skyline_window');
  put(7, 0, '07_mgr_framed_verdict_coat_floorlamp');
  put(2, 2, '09_chair_ergonomic'); put(2, 3, '03_workstation_maya');
  put(7, 2, '09_chair_ergonomic'); put(7, 3, '03_workstation_maya');
  put(0, 4, '10_plant_potted_large');
  put(5, 4, 'p0_clutter_rama_exec');

  // --- MANAGER - RAMA (x 12..21) : broad executive suite and visitor nook
  put(13, 0, '04_mgr_panoramic_skyline_window');
  put(17, 0, '07_mgr_framed_verdict_coat_floorlamp');
  put(16, 2, '08_chair_executive');
  put(15, 3, '01_executive_desk_rama');
  put(15, 2, 'p0_clutter_rama_exec');
  put(19, 4, '05_mgr_coffee_table_guest_armchair');
  put(12, 4, '10_plant_potted_large');

  // --- STUDIO - MAYA (x 22..29) : compact twin workstation lab
  put(23, 0, '08_stu_swatch_typo_wallshelf');
  put(27, 0, '10_stu_material_rack_print_wall');
  put(24, 2, '09_chair_ergonomic');
  put(24, 3, '03_workstation_maya');
  put(24, 2, 'p0_clutter_maya_studio');
  put(27, 2, '09_chair_ergonomic');
  put(27, 3, '03_workstation_maya');
  put(22, 4, '10_plant_potted_large');

  // --- LOBBY - KRA (x 30..39) : reception counter, kiosk, waiting couch
  put(31, 0, '11_lob_kra_monogram_directory');
  put(36, 0, '08_lobby_elevator_call_panel');
  put(33, 2, '05_lobby_reception_counter_kra');
  put(31, 4, '12_lob_visitor_chair_glass_table');
  put(37, 4, '13_lob_badge_parcel_umbrella_rope');

  // --- RECORDS - SITI (x 0..9, y 8..13) : shelf wall, archive ops props
  put(0, 8, '14_rec_filing_cabinet_rolling_ladder');
  put(3, 8, '05_archive_bookshelf_siti');
  put(7, 8, '16_rec_shredder_binderlabels_calendar');
  put(2, 10, '09_chair_ergonomic');
  put(2, 11, '03_workstation_maya');
  put(2, 10, 'p0_clutter_siti_records');
  put(7, 11, '10_archive_trolley_lockbox');

  // --- MEETING - BUDI (x 10..19, y 8..13) : conference table on a teal rug
  put(11, 8, '17_mtg_metrics_wall_projector_clock');
  put(13, 9, '09_chair_ergonomic'); put(14, 9, '09_chair_ergonomic'); put(15, 9, '09_chair_ergonomic');
  put(13, 10, '19_mtg_extra_8seat_conference_module');
  put(14, 9, 'p0_clutter_budi_meeting');
  put(13, 12, '09_chair_ergonomic'); put(15, 12, '09_chair_ergonomic');

  // --- PANTRY - TEAM (x 20..29, y 8..13) : full Batch-4 pantry run + dining spot
  put(20, 8, '20_pan_bistro_stools_menu_board');
  put(24, 8, '02_pantry_refrigerator_sink');
  put(27, 8, '21_pan_snack_shelf_trash_recycle');
  put(24, 12, '22_pan_dish_toaster_caddy_cups_steam');

  // --- PLAY - DIMAS (x 30..39, y 8..13) : arcade, shelves, billiard, couch
  put(31, 8, '23_ply_crt_console_security_tv_neon');
  put(35, 8, '06_arcade_console_dimas');
  put(31, 11, '14_billiard_table_dimas');
  put(34, 11, '24_ply_beanbags_orange_cyan');
  put(37, 12, '25_ply_controller_headphone_posters_snack');
  put(34, 10, 'p0_clutter_dimas_play');

  floorMaps[1] = { map: { w: 40, h: 20, corridorY: 9 }, floor: floor.map(row => row.slice()), deco: deco.map(row => row.slice()) };
  activateMapPreset(2);
  buildSecondFloor();
  floorMaps[2] = { map: { w: MAP.w, h: MAP.h, corridorY: CORRIDOR_Y }, floor: floor.map(row => row.slice()), deco: deco.map(row => row.slice()) };
  activateMapPreset(1);
  activeFloor = 1;
  for (let y = 0; y < MAP.h; y += 1) { floor[y] = floorMaps[1].floor[y].slice(); deco[y] = floorMaps[1].deco[y].slice(); }
}

function buildSecondFloor() {
  buildingFloorId = 2;
  fillBackground();
  applyRoomFloors(2);

  // --- EMERGENCY WAR ROOM (x 0..14)
  put(1, 0, '03_war_server_rack_cables_ref');
  put(4, 0, '01_war_tower_headset_case_clock');
  put(8, 0, '02_war_projector_seats_evac_redfx');
  put(1, 2, '01_war_command_table_4x2');
  put(10, 4, '03_workstation_maya');
  put(10, 3, '08_chair_executive');
  put(0, 3, '10_plant_potted_large'); put(14, 3, '10_plant_potted_large');

  // --- INNOVATION STUDIO (x 15..29)
  put(16, 0, '06_inno_invention_wall_conveyor_fx');
  put(20, 0, '04_inno_material_shelf_robotics_arm');
  put(24, 0, '05_inno_soldering_bench_parts_bins');
  put(21, 2, '05_inno_hotdesk_modular_2x1'); put(24, 2, '05_inno_hotdesk_modular_2x1');

  // --- SERVER ROOM - JARVIS (x 30..43): rack aisle, monitor and cooling
  put(31, 0, '02_server_rack_jarvis');
  put(35, 0, '02_server_rack_jarvis');
  put(39, 0, '02_server_rack_jarvis');
  put(31, 4, '03_srv_tool_trolley_alert_beacon');
  put(35, 4, '14_aif_training_display_data_crystal');
  put(40, 4, '15_aif_cooling_pipes_hologram_fx');
  put(36, 6, '13_aif_compute_pod_gpu_rack');

  // --- SYSTEMS OBSERVATORY (x 0..14, y 7..11)
  put(1, 7, '07_obs_cctv_wall_noc_light_riser');
  put(4, 7, '08_obs_ups_battery_sensor_pole');
  put(10, 7, '09_obs_operator_chair_incident_printer');
  put(13, 10, '02_server_rack_jarvis');

  // --- SKY LOUNGE (x 15..29, y 7..11)
  put(16, 7, '12_sky_rooftop_rail_weather_display');
  put(20, 7, '10_sky_reading_shelf_boardgame_table');
  put(25, 7, '11_sky_music_corner_meditation_plant');
  put(18, 9, '14_sky_couch_low_table');

  // --- COMMAND DECK (x 30..43, y 7..11)
  put(31, 7, '17_cmd_global_project_map_logo');
  put(36, 7, '18_cmd_intercom_signal_board_alert');
  put(34, 9, '16_cmd_captain_console_dispatch_chairs');
}


let floorTransitionAlpha = 1.0;

function roomDoorCenter(room) {
  return Number.isFinite(room?.doorX) ? room.doorX : Math.floor(room.x + room.w / 2) + 0.5;
}

function roomAtPosition(x, y, floorId = activeFloor) {
  return (ROOM_DEFS[floorId] || []).find(room => x >= room.x && x < room.x + room.w
    && y >= room.y && y < room.y + room.h) || null;
}

function updateRoomDirectory() {
  const nav = document.getElementById('room-directory');
  if (!nav) return;
  const defs = ROOM_DEFS[activeFloor] || [];
  const floorLabel = document.getElementById('room-directory-floor');
  if (floorLabel) floorLabel.textContent = activeFloor === 1 ? 'HEADQUARTERS' : 'INNOVATION DECK';
  nav.replaceChildren();
  defs.forEach((room, index) => {
    const occupants = AGENTS.filter(agent => !agent.inTransit && (agent.floorId || 1) === activeFloor
      && roomAtPosition(agent.x, agent.y, activeFloor)?.id === room.id).length;
    const label = room.label.replace(/^\d+\s*/, '').split(' - ')[0].trim();
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'room-directory-chip' + (room.id === activeRoomId ? ' active' : '');
    button.dataset.roomId = room.id;
    button.setAttribute('aria-pressed', String(room.id === activeRoomId));
    button.title = room.label + ' · ' + occupants + ' crew member(s)';
    button.innerHTML = '<span class="room-chip-index">' + String(index + 1).padStart(2, '0') + '</span>'
      + '<span class="room-chip-name"></span><span class="room-chip-count">' + occupants + '</span>';
    button.querySelector('.room-chip-name').textContent = label;
    button.style.setProperty('--room-accent', room.accent);
    button.addEventListener('click', () => {
      activeRoomId = room.id;
      updateRoomDirectory();
      render();
    });
    nav.appendChild(button);
  });
}

function loadFloor(level, animate = true) {
  const snapshot = floorMaps[level];
  if (!snapshot) return;
  activateMapPreset(level);
  resizeWorldCanvas();
  if (typeof applyCamera === 'function') requestAnimationFrame(applyCamera);
  activeFloor = level;
  invalidateAtlasWalkBlockers(level);
  invalidateDecorLayerCache(level);
  floorLayerCacheId = 0; // force floor layer cache redraw for new room colors
  if (floorMaps[level]) {
    for (let y = 0; y < MAP.h; y += 1) {
      floor[y] = floorMaps[level].floor[y].slice();
      deco[y] = floorMaps[level].deco[y].slice();
    }
  }
  if (!(ROOM_DEFS[level] || []).some(room => room.id === activeRoomId)) activeRoomId = null;
  updateRoomDirectory();
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
const CANVAS_PADDING = 2;
const initialSceneSize = window.KRAThreeOfficeRenderer?.getCanvasSize(MAP, T)
  || { width: (MAP.w + CANVAS_PADDING * 2) * T, height: (MAP.h + CANVAS_PADDING * 2) * T };
canvas.width = initialSceneSize.width;
canvas.height = initialSceneSize.height;
ctx.imageSmoothingEnabled = true;

let W = canvas.width;
let H = canvas.height;

function resizeWorldCanvas() {
  const sceneSize = window.KRAThreeOfficeRenderer?.getCanvasSize(MAP, T);
  const width = sceneSize?.width || (MAP.w + CANVAS_PADDING * 2) * T;
  const height = sceneSize?.height || (MAP.h + CANVAS_PADDING * 2) * T;
  if (canvas.width === width && canvas.height === height) return;
  canvas.width = width;
  canvas.height = height;
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  W = width;
  H = height;
  window.KRAThreeOfficeRenderer?.resize(W, H);
  floorLayerCache = null;
  floorLayerCacheId = 0;
  invalidateFloorOverlayCache();
  if (typeof decorLayerCache !== 'undefined') decorLayerCache = [null, null, null];
}

function jitter(x, y, range) {
  // deterministic pseudo-random for sprite detail
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

let floorLayerCache = null;
var floorLayerCacheId = 0;

/* Detailed per-type floor painters, baked once per floor into
floorLayerCache together with rugs, door thresholds and the runway
carpet (reference look: real planks/plates instead of flat checker). */
function hashTile(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function paintWoodTile(g, x, y, base, light, dark) {
  const X = x * T, Y = y * T;
  for (let r = 0; r < 2; r++) {
    const yy = Y + r * 16;
    const h1 = hashTile(x * 3 + r * 7, y * 5 + r);
    g.fillStyle = h1 > 0.78 ? light : (h1 < 0.16 ? dark : base);
    g.fillRect(X, yy, T, 16);
    g.fillStyle = 'rgba(255,255,255,0.07)';
    g.fillRect(X, yy, T, 1);
    g.fillStyle = 'rgba(40,20,8,0.55)';
    g.fillRect(X, yy + 15, T, 1);
    // grain streaks
    g.fillStyle = 'rgba(60,32,12,0.35)';
    const g1 = hashTile(x * 11 + r, y * 13);
    g.fillRect(X + 3 + Math.floor(g1 * 14), yy + 4 + Math.floor(g1 * 7), 6 + Math.floor(g1 * 9), 1);
    const g2 = hashTile(x * 17, y * 19 + r * 3);
    g.fillRect(X + 2 + Math.floor(g2 * 18), yy + 9 + Math.floor(g2 * 4), 4 + Math.floor(g2 * 7), 1);
    // staggered plank end joint
    if (h1 > 0.35) {
      const jx = X + ((x * 13 + (y * 2 + r) * 7) % 26) + 3;
      g.fillStyle = 'rgba(40,20,8,0.5)';
      g.fillRect(jx, yy + 1, 1, 14);
    }
}
}

function paintMetalTile(g, x, y, base, alt, edge) {
  const X = x * T, Y = y * T;
  g.fillStyle = ((x + y) % 2 === 0) ? base : alt;
  g.fillRect(X, Y, T, T);
  g.fillStyle = 'rgba(255,255,255,0.09)';
  g.fillRect(X + 1, Y + 1, T - 2, 1);
  g.fillRect(X + 1, Y + 1, 1, T - 2);
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.fillRect(X + 1, Y + T - 2, T - 2, 1);
  g.fillRect(X + T - 2, Y + 1, 1, T - 2);
  g.fillStyle = edge;
  [[4, 4], [T - 6, 4], [4, T - 6], [T - 6, T - 6]].forEach(([dx, dy]) => {
      g.fillRect(X + dx, Y + dy, 2, 2);
    });
if (hashTile(x * 7, y * 9) > 0.82) { // faint floor conduit tick
  g.fillStyle = 'rgba(0,245,212,0.20)';
  g.fillRect(X + 6, Y + 15, 20, 1);
}
}

function paintMarbleTile(g, x, y) {
  const X = x * T, Y = y * T;
  g.fillStyle = ((x + y) % 2 === 0) ? '#EFEAE0' : '#E2DCCD';
  g.fillRect(X, Y, T, T);
  g.fillStyle = 'rgba(120,110,95,0.5)';
  g.fillRect(X + T - 1, Y, 1, T);
  g.fillRect(X, Y + T - 1, T, 1);
  g.fillStyle = 'rgba(150,140,120,0.55)';
  for (let i = 0; i < 4; i++) {
    const hx = hashTile(x * 23 + i * 5, y * 29 + i);
    const hy = hashTile(x * 31 + i, y * 37 + i * 3);
    g.fillRect(X + 3 + Math.floor(hx * 26), Y + 3 + Math.floor(hy * 26), 1, 1);
  }
if (hashTile(x * 41, y * 43) > 0.72) { // soft vein
  g.fillStyle = 'rgba(160,150,130,0.5)';
  g.fillRect(X + 5, Y + 20, 6, 1); g.fillRect(X + 11, Y + 17, 6, 1); g.fillRect(X + 17, Y + 14, 6, 1);
}
}

function paintPantryTile(g, x, y) {
  const X = x * T, Y = y * T;
  for (let sy = 0; sy < 2; sy++) {
    for (let sx = 0; sx < 2; sx++) {
      const on = (x * 2 + sx + y * 2 + sy) % 2 === 0;
      g.fillStyle = on ? '#F4F6F8' : '#C9D2DE';
      g.fillRect(X + sx * 16, Y + sy * 16, 16, 16);
      g.fillStyle = 'rgba(110,125,145,0.55)';
      g.fillRect(X + sx * 16 + 15, Y + sy * 16, 1, 16);
      g.fillRect(X + sx * 16, Y + sy * 16 + 15, 16, 1);
    }
}
}

function paintSlateTile(g, x, y, base, alt, accent) {
  const X = x * T, Y = y * T;
  g.fillStyle = ((x + y) % 2 === 0) ? base : alt;
  g.fillRect(X, Y, T, T);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(X, Y + T - 1, T, 1);
  g.fillRect(X + T - 1, Y, 1, T);
  g.fillStyle = 'rgba(255,255,255,0.05)';
  g.fillRect(X, Y, T, 1);
  if (x % 2 === 0 && y % 2 === 0) {
    g.fillStyle = accent;
    g.fillRect(X + 2, Y + 2, 2, 2);
  }
}

function paintCorridorTile(g, x, y) {
  const X = x * T, Y = y * T;
  g.fillStyle = ((x + y) % 2 === 0) ? '#8B8172' : '#7E7462';
  g.fillRect(X, Y, T, T);
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.fillRect(X, Y, T, 1);
  g.fillStyle = 'rgba(30,25,18,0.45)';
  g.fillRect(X, Y + T - 1, T, 1);
  g.fillRect(X + T - 1, Y, 1, T);
}

function paintRedCorridorTile(g, x, y) {
  const X = x * T, Y = y * T;
  g.fillStyle = ((x + y) % 2 === 0) ? '#8B2431' : '#741C29';
  g.fillRect(X, Y, T, T);
  g.fillStyle = 'rgba(238,190,128,0.42)';
  g.fillRect(X, Y, T, 1);
  g.fillStyle = 'rgba(22,9,16,0.50)';
  g.fillRect(X, Y + T - 1, T, 1);
  g.fillRect(X + T - 1, Y, 1, T);
  if (x % 4 === 0) {
    g.fillStyle = 'rgba(240,201,146,0.48)';
    g.fillRect(X + T / 2 - 1, Y + T / 2 - 1, 3, 3);
  }
}

const FLOOR_PAINTERS = {
  serverMetal: (g, x, y) => paintMetalTile(g, x, y, '#33475B', '#2B3D4F', '#16222E'),
  execWood: (g, x, y) => paintWoodTile(g, x, y, '#8A5A30', '#9C6B3A', '#754A26'),
  studioWood: (g, x, y) => paintWoodTile(g, x, y, '#D8BE8E', '#E6CF9F', '#C8AC76'),
  marble: paintMarbleTile,
  recordsWood: (g, x, y) => paintWoodTile(g, x, y, '#BE9A68', '#CCA978', '#AC8854'),
  meetingWood: (g, x, y) => paintWoodTile(g, x, y, '#B08D5C', '#BE9C6A', '#9E7B4C'),
  pantryTile: paintPantryTile,
  playWood: (g, x, y) => paintWoodTile(g, x, y, '#9A6B3E', '#AA7A4A', '#86592F'),
  warSlate: (g, x, y) => paintSlateTile(g, x, y, '#39445E', '#323D54', 'rgba(0,245,212,0.35)'),
  innoWood: (g, x, y) => paintWoodTile(g, x, y, '#7A4E63', '#8A5C72', '#684154'),
  obsSlate: (g, x, y) => paintSlateTile(g, x, y, '#35505C', '#2E4652', 'rgba(177,151,252,0.35)'),
  skyWood: (g, x, y) => paintWoodTile(g, x, y, '#B98D55', '#C89F66', '#A67C46'),
  aiForge: (g, x, y) => paintSlateTile(g, x, y, '#183E52', '#123246', 'rgba(0,240,255,0.45)'),
  command: (g, x, y) => paintSlateTile(g, x, y, '#4A2939', '#3B2130', 'rgba(255,107,107,0.4)'),
  colonySlate: (g, x, y) => paintSlateTile(g, x, y, '#46505E', '#3E4855', 'rgba(173,205,225,0.22)'),
  redCorridor: paintRedCorridorTile,
  corridor: paintCorridorTile
};

function paintRug(g, rug) {
  const X = Math.round(rug.x * T), Y = Math.round(rug.y * T);
  const Wd = Math.round(rug.w * T), Hd = Math.round(rug.h * T);
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.fillRect(X + 2, Y + 3, Wd, Hd);
  g.fillStyle = rug.fill;
  g.fillRect(X, Y, Wd, Hd);
  g.fillStyle = 'rgba(0,0,0,0.07)';
  for (let yy = Y + 4; yy < Y + Hd - 2; yy += 4) g.fillRect(X + 2, yy, Wd - 4, 1);
  g.fillStyle = rug.trim;
  g.fillRect(X, Y, Wd, 3); g.fillRect(X, Y + Hd - 3, Wd, 3);
  g.fillRect(X, Y, 3, Hd); g.fillRect(X + Wd - 3, Y, 3, Hd);
  g.fillRect(X + 6, Y + 6, Wd - 12, 1); g.fillRect(X + 6, Y + Hd - 7, Wd - 12, 1);
  g.fillRect(X + 6, Y + 6, 1, Hd - 12); g.fillRect(X + Wd - 7, Y + 6, 1, Hd - 12);
  [[X + 3, Y + 3], [X + Wd - 8, Y + 3], [X + 3, Y + Hd - 8], [X + Wd - 8, Y + Hd - 8]].forEach(([cx, cy]) => {
      g.fillStyle = rug.trim;
      g.fillRect(cx, cy, 5, 5);
    });
}

function paintRunwayCarpet(g) {
  const y0 = CORRIDOR_Y * T + 10, y1 = (CORRIDOR_Y + 2) * T - 10;
  g.fillStyle = '#6E1423';
  g.fillRect(0, y0 - 2, W, y1 - y0 + 4);
  g.fillStyle = '#A42633';
  g.fillRect(0, y0, W, y1 - y0);
  g.fillStyle = 'rgba(0,0,0,0.08)';
  for (let yy = y0 + 3; yy < y1 - 2; yy += 4) g.fillRect(0, yy, W, 1);
  g.fillStyle = '#D9A441';
  g.fillRect(0, y0 + 3, W, 1);
  g.fillRect(0, y1 - 4, W, 1);
  g.fillStyle = 'rgba(217,164,65,0.55)';
  const cy = Math.round((y0 + y1) / 2);
  for (let cx = 32; cx < W; cx += 64) {
    g.fillRect(cx - 1, cy - 4, 3, 9);
    g.fillRect(cx - 4, cy - 1, 9, 3);
  }
}

function buildFloorLayer() {
  if (!floorLayerCache) {
    floorLayerCache = document.createElement('canvas');
    floorLayerCache.width = W;
    floorLayerCache.height = H;
  }
const g = floorLayerCache.getContext('2d');
g.imageSmoothingEnabled = false;
for (let y = 0; y < MAP.h; y++) {
  for (let x = 0; x < MAP.w; x++) {
    const painter = FLOOR_PAINTERS[floor[y][x]] || FLOOR_PAINTERS.recordsWood;
    painter(g, x, y);
  }
}
ROOM_DEFS[activeFloor].forEach(r => { if (r.rug) paintRug(g, r.rug); });
if (activeFloor === 2) paintRunwayCarpet(g);
// door thresholds: light mat at each room's corridor-side centre
g.fillStyle = 'rgba(240,230,210,0.85)';
ROOM_DEFS[activeFloor].forEach(r => {
    const cx = Math.round(roomDoorCenter(r) * T) - 13;
    const ty = r.y === 0 ? CORRIDOR_Y * T - 4 : (CORRIDOR_Y + 2) * T;
    g.fillRect(cx, ty, 26, 4);
    g.fillStyle = 'rgba(120,100,70,0.85)';
    g.fillRect(cx, ty, 26, 1);
    g.fillStyle = 'rgba(240,230,210,0.85)';
  });
floorLayerCacheId = activeFloor;
}

function drawFloors() {
  if (!floorLayerCache || floorLayerCacheId !== activeFloor) buildFloorLayer();
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
  if (window.KRAAssetCache?.loadImage) return window.KRAAssetCache.loadImage(url);
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
    // Browser HTTP cache keeps this versioned atlas after first authenticated load.
    // Bump `atlasVersion` only when atlas source files change.
    const atlasVersion = '20261027';
    const cacheKey = '?v=' + atlasVersion;
    // Resolve relative to the served app directory so subfolder installs work.
    const atlasManifestUrl = '../assets/voxel/atlas/argon_office_furniture.json' + cacheKey;
    const response = window.KRAAssetCache?.fetch
      ? await window.KRAAssetCache.fetch(atlasManifestUrl)
      : await fetch(atlasManifestUrl, { cache: 'force-cache' });
    if (!response.ok) throw new Error('Atlas metadata request failed: ' + response.status);
    const metadata = await response.json();
    const baseUrl = new URL('../assets/voxel/atlas/', window.location.href);
    const diffuseUrl = new URL(metadata.texture_file + cacheKey, baseUrl).href;
    const emissionUrl = new URL(metadata.emission_file + cacheKey, baseUrl).href;
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

if (window.KRABatchLoader) {
  window.KRABatchLoader.loadBatchAtlases(officeAtlas).then(() => {
    if (typeof decorLayerCache !== 'undefined') {
      decorLayerCache[1] = null;
      decorLayerCache[2] = null;
    }
  });
}
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
  const diffuseImg = sprite.diffuse || officeAtlas.diffuse;
  diffuseCtx.drawImage(diffuseImg, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);

  let emissionCanvas = null;
  if (sprite.has_emission) {
    emissionCanvas = document.createElement('canvas');
    emissionCanvas.width = frame.w;
    emissionCanvas.height = frame.h;
    const emissionCtx = emissionCanvas.getContext('2d');
    emissionCtx.imageSmoothingEnabled = false;
    const emissionImg = sprite.emission || officeAtlas.emission;
    emissionCtx.drawImage(emissionImg, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
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

function isRegistryItem(name) {
  return Boolean(name && ASSET_REGISTRY && ASSET_REGISTRY.props[name]);
}

function isAtlasItem(name) {
  if (!name) return false;
  return getAtlasFrameName(name) !== null || isRegistryItem(name);
}

function getAtlasFrameName(name) {
  // Batch layouts address Argon sprites by their atlas id directly; the
  // alias table below only covers legacy/procedural decor names.
  if (name && officeAtlas.metadata && officeAtlas.metadata.sprites
    && Object.prototype.hasOwnProperty.call(officeAtlas.metadata.sprites, name)) {
    return name;
  }
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
    lamp: '11_brass_desk_lamp',
    couch: '13_modular_couch',
    vending: '03_pantry_vending_water_cooler',
    watercooler: '03_pantry_vending_water_cooler',
    billiard: '14_billiard_table_dimas'
  })[name] || null;
}

/* Chairs are sittable: agents may path onto / idle on a chair tile so the
crew visually sits at their desks like the reference floor plan. */
const SITTABLE_FRAMES = new Set([
    '08_chair_executive', '09_chair_ergonomic'
  ]);

function isSittableItem(name) {
  if (!name) return false;
  const registryAsset = ASSET_REGISTRY && ASSET_REGISTRY.props[name];
  if (registryAsset) return registryAsset.collision === false;
  return SITTABLE_FRAMES.has(getAtlasFrameName(name) || name);
}

function getItemFootprint(name) {
  const frameName = getAtlasFrameName(name);
  return officeAtlas.metadata?.sprites?.[frameName]?.grid_occupancy
  || ASSET_REGISTRY?.getFootprint(name)
  || { cols: 1, rows: 1 };
}

function drawSprite(tx, ty, name) {
  const X = tx * T;
  const Y = ty * T;
  const atlasFrameName = getAtlasFrameName(name);
  if (atlasFrameName && officeAtlas.ready && officeAtlas.metadata?.sprites?.[atlasFrameName]) {
    drawAtlasSprite(tx, ty, atlasFrameName);
    return;
  }

const registryAsset = ASSET_REGISTRY && ASSET_REGISTRY.props[name];
if (registryAsset) {
  ASSET_REGISTRY.drawFallback(ctx, name, {
      x: X,
      y: Y,
      w: registryAsset.footprint.cols * T,
      h: registryAsset.footprint.rows * T
    });
return;
}

const p = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(X + x, Y + y, w, h); };

switch (name) {
  case 'dining':
  // Cafe table (top-down): pale top, two mugs, tiny plant centre.
  p(4, 24, 24, 4, 'rgba(0,0,0,0.30)');
  p(3, 8, 26, 15, '#6E4523');
  p(4, 9, 24, 13, '#E8DCC2');
  p(4, 9, 24, 2, '#F7EFDB');
  p(7, 12, 4, 4, '#C4553B'); p(8, 13, 2, 2, '#7A2E1E');
  p(21, 15, 4, 4, '#3B82C4'); p(22, 16, 2, 2, '#5E3A1E');
  p(14, 12, 4, 4, '#B65F3B'); p(13, 9, 6, 4, '#3F9E58'); p(15, 8, 2, 3, '#57C977');
  p(6, 23, 3, 4, '#4A2E18'); p(23, 23, 3, 4, '#4A2E18');
  break;
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
      if (isSittableItem(item)) return; // chairs never block pathfinding
      const frameName = getAtlasFrameName(item);
      if (!frameName && !isRegistryItem(item)) return;
      const footprint = getItemFootprint(item);
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
  const occupancy = getItemFootprint(item);
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

/* Batch 5 office mascot: the Cybercat patrols the runway and curls up by
the Play-lounge couch. Purely visual - it never blocks agents. */
const cybercat = {
  x: 36.2, y: 15.35, tx: 36.2, ty: 15.35,
  anim: 'cybercat_curl_near_couch', wait: 500, leg: 0, flip: false
};
const CYBERCAT_ROUTE = [
  { x: 36.2, y: 15.35, anim: 'cybercat_curl_near_couch', wait: 700 },
  { x: 31.4, y: 15.35, anim: 'cybercat_walk', wait: 40 },
  { x: 31.4, y: 10.0, anim: 'cybercat_walk', wait: 30 },
  { x: 19.2, y: 10.0, anim: 'cybercat_walk', wait: 160, rest: 'cybercat_inspect_terminal' },
  { x: 3.0, y: 10.0, anim: 'cybercat_walk', wait: 140, rest: 'cybercat_idle' },
  { x: 31.4, y: 10.0, anim: 'cybercat_walk', wait: 30 },
  { x: 31.4, y: 15.35, anim: 'cybercat_walk', wait: 40 },
  { x: 36.2, y: 15.35, anim: 'cybercat_walk', wait: 0, rest: 'cybercat_sleep' }
];

function updateCybercat() {
  if (activeFloor !== 1) return;
  const target = CYBERCAT_ROUTE[cybercat.leg];
  const dx = target.x - cybercat.x;
  const dy = target.y - cybercat.y;
  const dist = Math.hypot(dx, dy);
  if (cybercat.wait > 0) {
    cybercat.wait -= 1;
    cybercat.anim = target.rest || target.anim;
    if (cybercat.leg === 0) cybercat.anim = 'cybercat_curl_near_couch';
    return;
  }
if (dist < 0.06) {
  cybercat.x = target.x; cybercat.y = target.y;
  cybercat.wait = target.wait;
  cybercat.leg = (cybercat.leg + 1) % CYBERCAT_ROUTE.length;
  return;
}
const step = 0.022;
cybercat.x += (dx / dist) * step;
cybercat.y += (dy / dist) * step;
cybercat.flip = dx < -0.01 ? true : (dx > 0.01 ? false : cybercat.flip);
cybercat.anim = dist > 6 ? 'cybercat_run' : 'cybercat_walk';
}

function drawCybercatEntity() {
  const sheet = loadCybercatSheet(cybercat.anim);
  if (!sheet.ready) return;
  const frame = Math.floor(clock / 10) % sheet.frames;
  const X = Math.round(cybercat.x * T) + 6;
  const Y = Math.round(cybercat.y * T) + 12;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath();
  ctx.ellipse(X + 10, Y + 18, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  if (cybercat.flip) {
    ctx.translate(X + 20, Y);
    ctx.scale(-1, 1);
    ctx.drawImage(sheet.image, frame * 20, 0, 20, 20, 0, 0, 20, 20);
  } else {
  ctx.drawImage(sheet.image, frame * 20, 0, 20, 20, X, Y, 20, 20);
}
ctx.restore();
}

/* Soft contact shadows under every atlas prop so furniture sits on the
floor instead of floating (props ship without baked shadows). */
function drawPropShadows() {
  if (!officeAtlas.ready) return;
  ctx.save();
  ctx.fillStyle = 'rgba(18,10,4,0.28)';
  const paintShadow = (x, y, item) => {
    const frameName = getAtlasFrameName(item);
    if (!frameName && !isRegistryItem(item)) return;
    const occ = getItemFootprint(item);
    const cx = (x + occ.cols / 2) * T;
    const cy = (y + occ.rows) * T - 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(9, occ.cols * T * 0.42), 5, 0, 0, Math.PI * 2);
    ctx.fill();
  };
for (let y = 0; y < MAP.h; y++) {
  for (let x = 0; x < MAP.w; x++) {
    const item = deco[y][x];
    if (item && isAtlasItem(item)) paintShadow(x, y, item);
  }
}
(customDecor[activeFloor] || new Map()).forEach((item, key) => {
    if (!isAtlasItem(item)) return;
    const [x, y] = key.split(',').map(Number);
    paintShadow(x, y, item);
  });
ctx.restore();
}

/* Batch-4 desktop clutter (mug/headset, globe, sticky notes, award plaque)
is drawn as a surface layer on top of desks rather than as floor props.
x/y are the frame's top-left in tile units. */
const SURFACE_DECOR = {
  1: [
    { x: 15.1, y: 3.02, id: '16_decor_award_plaque_snack_bowl' },
    { x: 24.05, y: 3.02, id: '13_decor_mug_headset_keyboard' },
    { x: 2.05, y: 14.02, id: '14_decor_globe_mini_robot' },
    { x: 13.5, y: 13.45, id: '15_decor_sticky_notes_cable_coil' },
    { x: 33.4, y: 2.55, id: '16_decor_award_plaque_snack_bowl' }
  ],
2: [
  { x: 9.0, y: 3.5, id: '15_decor_sticky_notes_cable_coil' },
  { x: 8.2, y: 15.45, id: '13_decor_mug_headset_keyboard' }
]
};

function drawSurfaceDecor() {
  if (!officeAtlas.ready) return;
  const items = SURFACE_DECOR[activeFloor] || [];
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  items.forEach(item => {
      const cached = getCachedAtlasFrame(item.id);
      if (!cached) return;
      ctx.drawImage(cached.composite, Math.round(item.x * T), Math.round(item.y * T));
    });
ctx.restore();
}

function drawAtlasDecorAndAgents(frame) {
  const queue = renderQueueBuffer;
  queue.length = 0;
  const occupiedKeys = occupiedKeysBuffer;
  occupiedKeys.clear();
  const pushAtlas = (x, y, item) => {
    const frameName = getAtlasFrameName(item);
    const occ = getItemFootprint(item);
    // Y-sort by the prop's floor footprint bottom; sittable chairs render
    // just behind whoever sits on them.
    const sortY = (y + occ.rows) * T - (isSittableItem(item) ? 18 : 0);
    queue.push({ kind: 'atlas', tileX: x, tileY: y, item, sortY });
    return occ;
  };
for (let y = 0; y < MAP.h; y++) {
  for (let x = 0; x < MAP.w; x++) {
    const item = deco[y][x];
    if (item && isAtlasItem(item)) {
      if (occupiedKeys.has(x + ',' + y)) continue;
      const occ = pushAtlas(x, y, item);
      for (let dy = 0; dy < occ.rows; dy += 1) {
        for (let dx = 0; dx < occ.cols; dx += 1) occupiedKeys.add((x + dx) + ',' + (y + dy));
      }
  }
}
}

const customItems = customDecor[activeFloor] || new Map();
customItems.forEach((item, key) => {
    if (!isAtlasItem(item)) return;
    const separator = key.indexOf(',');
    pushAtlas(Number(key.slice(0, separator)), Number(key.slice(separator + 1)), item);
  });

for (let i = 0; i < AGENTS.length; i += 1) {
  const agent = AGENTS[i];
  if ((agent.floorId || 1) !== activeFloor || agent.inTransit) continue;
  queue.push({ kind: 'agent', agent, sortY: agent.y * T + 31 });
}
if (activeFloor === 1) {
  queue.push({ kind: 'cat', sortY: cybercat.y * T + 30 });
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
if (entry.kind === 'cat') {
  drawCybercatEntity();
  continue;
}
const agent = entry.agent;
const moving = Math.abs(agent.x - agent.homeX) > 0.05 || Math.abs(agent.y - agent.homeY) > 0.05;
drawCharacter(agent, agent.x, agent.y, moving ? frame : 0, agent.facing || 'down');
if (agent.id === selectedAgent.id) {
  // Pawn-style ground selection ring: it tracks the feet without boxing in the sprite.
  ctx.save();
  ctx.strokeStyle = agent.palette.accent || '#F4D35E';
  ctx.lineWidth = 1.5;
  ctx.shadowColor = agent.palette.accent || '#F4D35E';
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.ellipse(Math.round(agent.x * T + 16), Math.round(agent.y * T + 32), 12, 4, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
drawWorldBubble(agent);
}
}

/* ---------- 3B. ARCHITECTURE, LIGHTING & LABELS ----------
Static wall treatment is baked per floor (wallLayerCache); only the
elevator doors, server LEDs and arcade glow animate per frame. */
const WALL_HEIGHT = 54;
const WALL_STYLES = {
  server: { top: '#4B677D', mid: '#26394B', low: '#162635', trim: '#0A141F' },
  exec: { top: '#D3C3A3', mid: '#A98C68', low: '#54331D', trim: '#2E1B0E' },
  studio: { top: '#F0E7D3', mid: '#D8C7A9', low: '#9C7B52', trim: '#6B5138' },
  lobby: { top: '#F0E8D3', mid: '#D5CCB9', low: '#93876E', trim: '#5F5543' },
  records: { top: '#D8C8A0', mid: '#B99B68', low: '#5F4125', trim: '#3A2513' },
  meeting: { top: '#D8D4C2', mid: '#B3A98D', low: '#665A3E', trim: '#3D3524' },
  pantry: { top: '#FFFFFF', mid: '#DCE6EE', low: '#A9BCD0', trim: '#60748C' },
  play: { top: '#9274A8', mid: '#6B4E78', low: '#4A2E1E', trim: '#2A1730' },
  war: { top: '#465A78', mid: '#2D3D5C', low: '#1A2536', trim: '#0A1220' },
  inno: { top: '#C48AC0', mid: '#8C557E', low: '#4E2C48', trim: '#2B1729' },
  obs: { top: '#5F8797', mid: '#3D6172', low: '#213B47', trim: '#12242D' },
  sky: { top: '#BCD2E2', mid: '#88A9BE', low: '#536F83', trim: '#31495E' },
  aiforge: { top: '#3D8DA3', mid: '#1C566B', low: '#103747', trim: '#071C28' },
  command: { top: '#8E5364', mid: '#5A3042', low: '#321B2A', trim: '#180C15' }
};

var wallLayerCache = Object.create(null);
var floorOverlayCache = Object.create(null);
let cinematicLightingCache = null;
const lightingEngine = window.KRALightingEngine || null;

function invalidateFloorOverlayCache() {
  floorOverlayCache = Object.create(null);
  wallLayerCache = Object.create(null);
  cinematicLightingCache = null;
}

function wallWindow(g, x, y, w, night, h = 21) {
  g.fillStyle = '#241A12';
  g.fillRect(x - 2, y - 2, w + 4, h + 4);
  const grad = g.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, night ? '#16233E' : '#9FC4DE');
  grad.addColorStop(1, night ? '#2A3A5E' : '#D7EDF8');
  g.fillStyle = grad;
  g.fillRect(x, y, w, h);
  g.fillStyle = '#241A12';
  g.fillRect(x + Math.floor(w / 2), y, 1, h);
  g.fillRect(x, y + Math.floor(h / 2), w, 1);
  g.fillRect(x - 3, y + h + 2, w + 6, 2);
  if (night) {
    g.fillStyle = '#FFE9A8';
    g.fillRect(x + 3, y + 3, 1, 1); g.fillRect(x + w - 5, y + 5, 1, 1);
    g.fillRect(x + 7, y + 8, 1, 1); g.fillRect(x + w - 9, y + 2, 1, 1);
    g.fillStyle = '#0E1626';
    g.fillRect(x + 2, y + h - 5, 6, 5); g.fillRect(x + w - 10, y + h - 7, 7, 7);
    g.fillStyle = '#FFE9A8';
    g.fillRect(x + 4, y + h - 3, 1, 1); g.fillRect(x + w - 7, y + h - 4, 1, 1);
  } else {
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.fillRect(x + 4, y + 4, 8, 2); g.fillRect(x + w - 13, y + 7, 8, 2);
}
}

function wallPoster(g, x, y, w, h, fill, line) {
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.fillRect(x, y + 1, w + 2, h + 2);
  g.fillStyle = '#1E150E';
  g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = fill;
  g.fillRect(x, y, w, h);
  g.fillStyle = line;
  g.fillRect(x + 2, y + 2, w - 5, 3);
  g.fillRect(x + 2, y + 7, w - 8, 1);
  g.fillRect(x + 2, y + 10, w - 6, 1);
  if (h > 15) g.fillRect(x + 2, y + 13, w - 9, 1);
}

function wallSconce(g, x, y) {
  g.fillStyle = '#6E4E16';
  g.fillRect(x, y, 4, 7);
  g.fillStyle = '#C9A24B';
  g.fillRect(x + 1, y, 2, 7);
  g.fillStyle = '#FFE9A8';
  g.fillRect(x - 2, y - 3, 8, 4);
  g.fillStyle = '#FFF7D6';
  g.fillRect(x, y - 2, 4, 2);
}

function wallClock(g, cx, cy, r = 6) {
  g.fillStyle = '#241A12';
  g.beginPath(); g.arc(cx, cy, r + 1, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#F5EFE2';
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#241A12';
  g.fillRect(cx, cy - r + 2, 1, r - 1);
  g.fillRect(cx, cy, r - 2, 1);
  g.fillRect(cx, cy, 1, 1);
}

function wallShelf(g, x, y, w) {
  g.fillStyle = 'rgba(0,0,0,0.24)';
  g.fillRect(x + 1, y + 3, w, 3);
  g.fillStyle = '#4E2F1B';
  g.fillRect(x, y, w, 3);
  g.fillStyle = '#8A5A32';
  g.fillRect(x, y, w, 1);
  g.fillRect(x + 4, y + 3, 3, 4);
  g.fillRect(x + w - 7, y + 3, 3, 4);
  const items = ['#C4553B', '#4ECDC4', '#F4D35E'];
  items.forEach((c, i) => {
      const ix = x + 4 + i * Math.max(10, Math.floor((w - 16) / 3));
      g.fillStyle = c;
      g.fillRect(ix, y - 6, 5, 6);
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.fillRect(ix + 1, y - 5, 3, 1);
    });
}

function wallDoor(g, cx, y0, st) {
  const x = Math.round(cx - 13);
  const y = y0 + 8;
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.fillRect(x + 1, y + 1, 28, 35);
  g.fillStyle = st.trim;
  g.fillRect(x - 1, y - 1, 28, 36);
  g.fillStyle = st.low;
  g.fillRect(x + 1, y + 1, 24, 32);
  g.fillStyle = 'rgba(255,255,255,0.10)';
  g.fillRect(x + 2, y + 2, 1, 30);
  g.fillStyle = '#9FC4DE';
  g.fillRect(x + 5, y + 4, 16, 9);
  g.fillStyle = '#16233E';
  g.fillRect(x + 6, y + 5, 14, 7);
  g.fillStyle = '#7DEBFF';
  g.fillRect(x + 8, y + 7, 4, 1); g.fillRect(x + 15, y + 9, 3, 1);
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 1;
  g.strokeRect(x + 4.5, y + 16.5, 17, 13);
  g.fillStyle = '#F4D35E';
  g.fillRect(x + 21, y + 20, 3, 2);
}


function drawWallDecor(g, r, x0, y0, w) {
  const midX = x0 + Math.floor(w / 2);
  switch (r.id) {
    case 'server': {
      g.fillStyle = 'rgba(0,245,212,0.82)';
      g.fillRect(x0 + 5, y0 + 10, w - 10, 2);
      g.fillStyle = 'rgba(255,255,255,0.88)';
      g.fillRect(x0 + 5, y0 + 10, w - 10, 1);
      g.fillStyle = 'rgba(0,245,212,0.26)';
      for (let bx = x0 + 32; bx < x0 + w; bx += 32) g.fillRect(bx, y0 + 12, 1, 18);
      g.fillStyle = '#1D3045';
      g.fillRect(x0 + 8, y0 + 17, 9, 11);
      g.fillRect(x0 + w - 17, y0 + 17, 9, 11);
      g.fillStyle = '#00F5D4';
      g.fillRect(x0 + 11, y0 + 20, 3, 3);
      g.fillRect(x0 + w - 14, y0 + 20, 3, 3);
      for (let sx = 0; sx < 6; sx++) {
        g.fillStyle = sx % 2 ? '#111111' : '#FFD166';
        g.fillRect(x0 + 5 + sx * 3, y0 + 34, 3, 5);
      }
    g.fillStyle = '#0D1824';
    g.fillRect(x0 + w - 25, y0 + 33, 19, 8);
    g.fillStyle = '#38536D';
    g.fillRect(x0 + w - 22, y0 + 35, 13, 1);
    g.fillRect(x0 + w - 22, y0 + 38, 13, 1);
    break;
  }
case 'manager':
wallWindow(g, x0 + 72, y0 + 9, 42, true);
wallWindow(g, x0 + 176, y0 + 9, 40, true);
wallSconce(g, x0 + 134, y0 + 18);
wallSconce(g, x0 + 150, y0 + 18);
wallPoster(g, x0 + 288, y0 + 10, 20, 19, '#E8DCC2', '#8A5A22');
break;
case 'studio': {
  wallWindow(g, x0 + 5, y0 + 9, 22, false);
  const notes = ['#FF6B6B', '#FFD93D', '#6BCF7F', '#38BDF8', '#B197FC', '#FF9F1C'];
  notes.forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect(x0 + 104 + (i % 3) * 8, y0 + 10 + Math.floor(i / 3) * 10, 6, 7);
    });
wallShelf(g, x0 + 132, y0 + 27, 78);
wallPoster(g, x0 + 198, y0 + 9, 22, 18, '#F2E8D8', '#C4553B');
break;
}
case 'lobby':
wallWindow(g, x0 + 68, y0 + 9, 38, false);
g.fillStyle = '#17120C';
g.fillRect(midX - 24, y0 + 9, 48, 17);
g.fillStyle = '#C9A24B';
g.fillRect(midX - 24, y0 + 9, 48, 1);
g.fillRect(midX - 24, y0 + 25, 48, 1);
g.fillStyle = '#F4D35E';
g.font = 'bold 10px monospace';
g.textAlign = 'center';
g.fillText('K R A', midX, y0 + 21);
g.textAlign = 'left';
wallClock(g, x0 + w - 18, y0 + 16, 6);
wallSconce(g, x0 + 266, y0 + 19);
break;
case 'records':
g.fillStyle = 'rgba(245,235,210,0.94)';
for (let lx = x0 + 230; lx < x0 + w - 18; lx += 24) {
  g.fillRect(lx, y0 + 11, 18, 6);
  g.fillRect(lx, y0 + 21, 18, 6);
}
g.fillStyle = '#6E4E2E';
for (let lx = x0 + 233; lx < x0 + w - 18; lx += 24) {
  g.fillRect(lx, y0 + 13, 11, 1);
  g.fillRect(lx, y0 + 23, 9, 1);
}
break;
case 'meeting':
g.fillStyle = '#2A2118';
g.fillRect(x0 + 102, y0 + 8, 58, 22);
g.fillStyle = '#C8CFD6';
g.fillRect(x0 + 103, y0 + 9, 56, 20);
g.fillStyle = 'rgba(90,100,115,0.7)';
for (let ly = y0 + 12; ly < y0 + 29; ly += 3) g.fillRect(x0 + 103, ly, 56, 1);
wallPoster(g, x0 + 172, y0 + 9, 22, 18, '#EAF2F2', '#14635C');
wallClock(g, x0 + w - 18, y0 + 16, 6);
break;
case 'pantry':
for (let tx = x0; tx < x0 + w; tx += 8) {
  g.fillStyle = ((tx / 8) % 2 === 0) ? 'rgba(255,255,255,0.42)' : 'rgba(140,160,185,0.38)';
  g.fillRect(tx, y0 + 32, 8, 10);
}
wallShelf(g, x0 + 100, y0 + 25, 24);
g.fillStyle = '#18232B';
g.fillRect(x0 + 196, y0 + 9, 24, 20);
g.fillStyle = '#F4D35E';
g.fillRect(x0 + 199, y0 + 12, 17, 2);
g.fillStyle = '#DCE6EE';
g.fillRect(x0 + 199, y0 + 17, 14, 1);
g.fillRect(x0 + 199, y0 + 20, 16, 1);
g.fillRect(x0 + 199, y0 + 23, 12, 1);
wallClock(g, x0 + w - 17, y0 + 15, 6);
break;
case 'play':
wallPoster(g, x0 + 136, y0 + 9, 24, 18, '#20142E', '#FF409F');
wallShelf(g, x0 + 226, y0 + 28, 54);
g.strokeStyle = '#FF409F';
g.lineWidth = 2;
g.beginPath();
g.moveTo(x0 + w - 82, y0 + 22);
g.lineTo(x0 + w - 68, y0 + 10);
g.lineTo(x0 + w - 54, y0 + 22);
g.lineTo(x0 + w - 40, y0 + 10);
g.lineTo(x0 + w - 26, y0 + 22);
g.stroke();
g.strokeStyle = '#35E0D0';
g.lineWidth = 1;
g.beginPath();
g.moveTo(x0 + w - 82, y0 + 26);
g.lineTo(x0 + w - 24, y0 + 26);
g.stroke();
break;
case 'warroom':
g.fillStyle = 'rgba(0,245,212,0.58)';
g.fillRect(x0 + 6, y0 + 9, w - 12, 1);
g.fillStyle = '#C0392B';
g.fillRect(x0 + 6, y0 + 36, w - 12, 2);
wallPoster(g, x0 + 134, y0 + 9, 54, 20, '#0E1A2A', '#00F5D4');
wallPoster(g, x0 + 358, y0 + 9, 52, 20, '#0E1A2A', '#FF6B6B');
wallPoster(g, x0 + 454, y0 + 9, 48, 20, '#0E1A2A', '#F4D35E');
break;
case 'innovation':
wallPoster(g, x0 + 132, y0 + 9, 24, 18, '#F5EFF7', '#B03060');
wallPoster(g, x0 + 164, y0 + 9, 24, 18, '#EFF5FF', '#3050B0');
wallPoster(g, x0 + 196, y0 + 9, 24, 18, '#FFF7E6', '#B07A20');
g.fillStyle = '#2B1729';
g.fillRect(x0 + 236, y0 + 10, 76, 17);
g.fillStyle = '#F3EAF7';
g.fillRect(x0 + 238, y0 + 12, 72, 13);
['#FF6B6B', '#FFD93D', '#6BCF7F', '#38BDF8', '#B197FC'].forEach((c, i) => {
    g.fillStyle = c;
    g.fillRect(x0 + 242 + i * 13, y0 + 15 + (i % 2) * 5, 7, 6);
  });
wallShelf(g, x0 + 336, y0 + 27, 58);
break;
case 'observatory':
g.fillStyle = '#0E1A22';
g.fillRect(x0 + 166, y0 + 9, 76, 20);
g.fillStyle = '#35E0D0';
for (let dx = 0; dx < 9; dx++) g.fillRect(x0 + 170 + dx * 7, y0 + 24 - ((dx * 37) % 9), 3, 2);
wallPoster(g, x0 + 358, y0 + 9, 46, 18, '#101D2A', '#B197FC');
wallPoster(g, x0 + 516, y0 + 9, 24, 18, '#101D2A', '#35E0D0');
break;
case 'lounge2':
wallWindow(g, x0 + 8, y0 + 8, 42, true);
wallWindow(g, x0 + 170, y0 + 8, 40, true);
wallWindow(g, x0 + 588, y0 + 8, 40, true);
wallSconce(g, x0 + 330, y0 + 18);
wallSconce(g, x0 + 492, y0 + 18);
wallPoster(g, x0 + 452, y0 + 9, 24, 18, '#EAF2F8', '#486A86');
break;
default:
break;
}
}


function buildWallLayer(floorId) {
  const layer = document.createElement('canvas');
  layer.width = W;
  layer.height = H;
  const g = layer.getContext('2d');
  g.imageSmoothingEnabled = false;
  const defs = ROOM_DEFS[floorId];

  // Back walls: a full 46px architectural face, not just a trim line.
  defs.forEach(r => {
      const st = WALL_STYLES[r.wall] || WALL_STYLES.records;
      const x0 = r.x * T, y0 = r.y * T, w = r.w * T;
      g.fillStyle = st.mid;
      g.fillRect(x0, y0, w, WALL_HEIGHT);
      const sheen = g.createLinearGradient(0, y0, 0, y0 + 30);
      sheen.addColorStop(0, 'rgba(255,255,255,0.13)');
      sheen.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sheen;
      g.fillRect(x0, y0, w, 30);

      // Crown moulding.
      g.fillStyle = st.top;
      g.fillRect(x0, y0, w, 7);
      g.fillStyle = 'rgba(255,255,255,0.20)';
      g.fillRect(x0, y0, w, 1);
      g.fillStyle = st.trim;
      g.fillRect(x0, y0 + 7, w, 2);

      // Recessed wall panels, one per tile bay.
      for (let px = x0; px < x0 + w; px += 32) {
        g.strokeStyle = 'rgba(0,0,0,0.24)';
        g.lineWidth = 1;
        g.strokeRect(px + 4.5, y0 + 11.5, 23, 15);
        g.strokeStyle = 'rgba(255,255,255,0.08)';
        g.strokeRect(px + 5.5, y0 + 12.5, 21, 13);
        if (px > x0) {
          g.fillStyle = 'rgba(0,0,0,0.24)';
          g.fillRect(px, y0 + 9, 1, 33);
          g.fillStyle = 'rgba(255,255,255,0.08)';
          g.fillRect(px + 1, y0 + 9, 1, 33);
        }
    }

  // Chair rail.
  g.fillStyle = 'rgba(255,255,255,0.14)';
  g.fillRect(x0, y0 + 28, w, 1);
  g.fillStyle = st.trim;
  g.fillRect(x0, y0 + 29, w, 3);

  // Lower wainscot / service panel.
  g.fillStyle = st.low;
  g.fillRect(x0, y0 + 32, w, 10);
  const techWall = r.wall === 'server' || r.wall === 'war' || r.wall === 'obs';
  if (techWall) {
    for (let px = x0; px < x0 + w; px += 32) {
      g.fillStyle = st.trim;
      g.fillRect(px + 6, y0 + 35, 20, 2);
      g.fillRect(px + 6, y0 + 38, 20, 1);
      g.fillStyle = 'rgba(125,235,255,0.55)';
      g.fillRect(px + 24, y0 + 35, 2, 2);
    }
} else {
for (let px = x0 + 4; px < x0 + w; px += 8) {
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.fillRect(px, y0 + 32, 1, 10);
  g.fillStyle = 'rgba(255,255,255,0.07)';
  g.fillRect(px + 1, y0 + 32, 1, 10);
}
}

// Skirting board, then room-specific fittings and floor shadow.
g.fillStyle = st.trim;
g.fillRect(x0, y0 + WALL_HEIGHT - 4, w, 4);
g.fillStyle = 'rgba(255,255,255,0.15)';
g.fillRect(x0, y0 + WALL_HEIGHT - 4, w, 1);
if (r.y > 0) wallDoor(g, roomDoorCenter(r) * T, y0, st);
drawWallDecor(g, r, x0, y0, w);
const shadow = g.createLinearGradient(0, y0 + WALL_HEIGHT, 0, y0 + WALL_HEIGHT + 13);
shadow.addColorStop(0, 'rgba(10,6,3,0.42)');
shadow.addColorStop(1, 'rgba(10,6,3,0)');
g.fillStyle = shadow;
g.fillRect(x0, y0 + WALL_HEIGHT, w, 13);
});

// South wall of the top tier: a real corridor wall with framed doors.
const cy = CORRIDOR_Y * T;
g.fillStyle = '#78828C';
g.fillRect(0, cy, W, 21);
g.fillStyle = '#3C3430';
g.fillRect(0, cy, W, 3);
g.fillStyle = '#A7B1BB';
g.fillRect(0, cy + 3, W, 2);
for (let px = 32; px < W; px += 32) {
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.fillRect(px, cy + 5, 1, 12);
  g.fillStyle = 'rgba(255,255,255,0.10)';
  g.fillRect(px + 1, cy + 5, 1, 12);
}
g.fillStyle = '#39414A';
g.fillRect(0, cy + 17, W, 4);
g.fillStyle = 'rgba(255,255,255,0.14)';
g.fillRect(0, cy + 17, W, 1);
const corridorShadow = g.createLinearGradient(0, cy + 21, 0, cy + 29);
corridorShadow.addColorStop(0, 'rgba(10,8,6,0.32)');
corridorShadow.addColorStop(1, 'rgba(10,8,6,0)');
g.fillStyle = corridorShadow;
g.fillRect(0, cy + 21, W, 8);
defs.filter(r => r.y === 0).forEach(r => {
    const dx = Math.round(roomDoorCenter(r) * T) - 14;
    g.clearRect(dx, cy + 4, 28, 25);
    g.fillStyle = '#261A12';
    g.fillRect(dx - 2, cy + 2, 32, 3);
    g.fillRect(dx, cy + 4, 3, 17);
    g.fillRect(dx + 25, cy + 4, 3, 17);
    g.fillStyle = 'rgba(255,240,210,0.28)';
    g.fillRect(dx + 3, cy + 4, 1, 17);
    g.fillStyle = '#C9B488';
    g.fillRect(dx + 3, cy + 19, 22, 2);
    g.fillStyle = r.accent;
    g.fillRect(dx + 10, cy + 3, 8, 1);
  });

// Side walls: full-height partitions with capitals, bases and floor shadows.
const partition = floorId === 1
? { left: '#62452B', right: '#4F3520', cap: '#211207', hi: '#96703F' }
: { left: '#314156', right: '#263447', cap: '#0C1420', hi: '#5C7A96' };
const drawPartition = (bx, yStart, yEnd) => {
  const h = yEnd - yStart;
  g.fillStyle = 'rgba(0,0,0,0.15)';
  g.fillRect(bx - 10, yStart, 4, h);
  g.fillRect(bx + 6, yStart, 4, h);
  g.fillStyle = 'rgba(0,0,0,0.07)';
  g.fillRect(bx - 12, yStart, 2, h);
  g.fillRect(bx + 10, yStart, 2, h);
  g.fillStyle = partition.left;
  g.fillRect(bx - 5, yStart, 5, h);
  g.fillStyle = partition.right;
  g.fillRect(bx, yStart, 5, h);
  g.fillStyle = partition.cap;
  g.fillRect(bx - 1, yStart, 2, h);
  g.fillStyle = partition.hi;
  g.globalAlpha = 0.55;
  g.fillRect(bx - 4, yStart, 1, h);
  g.fillRect(bx + 3, yStart, 1, h);
  g.globalAlpha = 1;
  for (let py = yStart + 48; py < yEnd - 12; py += 48) {
    g.fillStyle = 'rgba(0,0,0,0.32)';
    g.fillRect(bx - 5, py, 10, 1);
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.fillRect(bx - 5, py + 1, 10, 1);
  }
g.fillStyle = partition.cap;
g.fillRect(bx - 7, yStart, 14, 8);
g.fillRect(bx - 7, yEnd - 8, 14, 8);
g.fillStyle = partition.hi;
g.fillRect(bx - 7, yStart, 14, 1);
g.fillRect(bx - 7, yEnd - 8, 14, 1);
};
const bounds = defs.filter(room => room.y === 0).slice(0, -1).map(room => room.x + room.w);
[0, CORRIDOR_Y + 2].forEach(tierTile => {
    const yStart = tierTile * T;
    const yEnd = tierTile === 0 ? CORRIDOR_Y * T + 21 : H - 8;
    drawPartition(3, yStart, yEnd);
    bounds.forEach(bx => drawPartition(bx * T, yStart, yEnd));
    drawPartition(W - 3, yStart, yEnd);
  });

// Bottom enclosure + fine outer picture frame.
g.fillStyle = partition.cap;
g.fillRect(0, H - 8, W, 8);
g.fillStyle = partition.left;
g.fillRect(0, H - 6, W, 3);
g.fillStyle = 'rgba(255,255,255,0.16)';
g.fillRect(0, H - 8, W, 1);
g.fillStyle = '#14100E';
g.fillRect(0, 0, W, 3); g.fillRect(0, H - 3, W, 3);
g.fillRect(0, 0, 3, H); g.fillRect(W - 3, 0, 3, H);
g.fillStyle = 'rgba(255,240,210,0.16)';
g.fillRect(3, 3, W - 6, 1); g.fillRect(3, 3, 1, H - 6);

drawElevatorHousing(g);
return layer;
}


function elevatorRect() {
  return { x: Math.round(W / 2) - 31, y: CORRIDOR_Y * T + 3, w: 62, h: 2 * T - 6 };
}

function drawElevatorHousing(g) {
  const e = elevatorRect();
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(e.x + 2, e.y + e.h - 2, e.w, 4);
  g.fillStyle = '#566370';
  g.fillRect(e.x, e.y, e.w, e.h);
  g.fillStyle = '#94A3B8';
  g.fillRect(e.x, e.y, e.w, 2);
  g.fillRect(e.x, e.y, 3, e.h);
  g.fillRect(e.x + e.w - 3, e.y, 3, e.h);
  g.fillStyle = '#1E293B';
  g.fillRect(e.x + 3, e.y + 11, e.w - 6, e.h - 12);
  g.fillStyle = '#0F172A';
  g.fillRect(e.x + 5, e.y + 2, e.w - 10, 8);
  g.fillStyle = '#00F5D4';
  g.fillRect(e.x + 5, e.y + 2, 2, 8);
  g.fillStyle = '#7DEBFF';
  g.font = 'bold 6px monospace';
  g.fillText('ELEVATOR', e.x + 10, e.y + 8);
  // fire extinguisher + plant flanking the lift (reference detail)
  g.fillStyle = '#DC2626';
  g.fillRect(e.x - 13, e.y + 34, 6, 12);
  g.fillStyle = '#FFFFFF';
  g.fillRect(e.x - 11, e.y + 38, 3, 4);
  g.fillStyle = '#1E293B';
  g.fillRect(e.x - 11, e.y + 32, 3, 2);
  g.fillStyle = '#B45309';
  g.fillRect(e.x + e.w + 6, e.y + 38, 9, 8);
  g.fillStyle = '#1E7A3C';
  g.fillRect(e.x + e.w + 4, e.y + 26, 5, 12);
  g.fillRect(e.x + e.w + 11, e.y + 26, 5, 12);
  g.fillRect(e.x + e.w + 8, e.y + 22, 5, 14);
}

function agentAtElevator() {
  const liftX = MAP.w / 2;
  const liftY = CORRIDOR_Y + 1;
  for (let i = 0; i < AGENTS.length; i += 1) {
    const agent = AGENTS[i];
    if ((agent.floorId || 1) !== activeFloor || agent.inTransit) continue;
    if (Math.abs(agent.x - liftX) < 1.4 && Math.abs(agent.y - liftY) < 1.3) return true;
  }
return false;
}

let elevatorDoorOpenness = 0;
let elevatorMotion = null;
let roomDoorStates = new Map();

function drawElevatorDoors() {
  const e = elevatorRect();
  const periodicOpen = Math.floor(clock / 24) % 10 === 8;
  const wantsOpen = !elevatorMotion && (periodicOpen || agentAtElevator());
  const target = wantsOpen ? 1 : 0;
  elevatorDoorOpenness += (target - elevatorDoorOpenness) * 0.17;
  if (Math.abs(target - elevatorDoorOpenness) < 0.012) elevatorDoorOpenness = target;
  const doorW = Math.floor((e.w - 10) / 2);
  const doorH = e.h - 12;
  const slide = Math.round(elevatorDoorOpenness * (doorW - 3));
  ctx.save();
  ctx.beginPath();
  ctx.rect(e.x + 4, e.y + 11, e.w - 8, doorH);
  ctx.clip();
  const well = ctx.createLinearGradient(e.x, e.y, e.x + e.w, e.y);
  well.addColorStop(0, '#111923'); well.addColorStop(0.5, '#263647'); well.addColorStop(1, '#111923');
  ctx.fillStyle = well;
  ctx.fillRect(e.x + 4, e.y + 11, e.w - 8, doorH);
  if (elevatorMotion) {
    // Moving shaft lights and the cabin's scrolling floor marks make a trip
    // readable even while the pawn is hidden inside the lift.
    const elapsed = performance.now() - elevatorMotion.startedAt;
    const travel = Math.min(1, elapsed / 1200);
    const direction = elevatorMotion.toFloor > elevatorMotion.fromFloor ? -1 : 1;
    const offset = (clock * 3 * direction) % 18;
    ctx.fillStyle = '#101923';
    ctx.fillRect(e.x + 11, e.y + 15, e.w - 22, doorH - 8);
    for (let i = -1; i < 8; i += 1) {
      const yy = e.y + 18 + i * 18 + offset;
      ctx.fillStyle = i % 2 ? 'rgba(0,245,212,0.18)' : 'rgba(125,235,255,0.42)';
      ctx.fillRect(e.x + 13, yy, e.w - 26, 2);
    }
    const cabY = e.y + 16 + travel * (doorH - 28);
    ctx.fillStyle = 'rgba(0,245,212,0.7)';
    ctx.fillRect(e.x + 8, cabY, e.w - 16, 2);
    ctx.fillStyle = 'rgba(0,245,212,0.14)';
    ctx.fillRect(e.x + 8, cabY + 2, e.w - 16, 12);
  } else {
    ctx.fillStyle = '#344658';
    ctx.fillRect(e.x + 10, e.y + 16, e.w - 20, doorH - 10);
    ctx.fillStyle = 'rgba(125,235,255,0.20)';
    ctx.fillRect(e.x + 13, e.y + 19, e.w - 26, 2);
    ctx.fillStyle = '#1C2936';
    ctx.fillRect(e.x + 13, e.y + doorH + 4, e.w - 26, 4);
  }
  const gradL = ctx.createLinearGradient(e.x + 4 - slide, 0, e.x + 4 + doorW - slide, 0);
  gradL.addColorStop(0, '#536575'); gradL.addColorStop(0.45, '#D0D9E0'); gradL.addColorStop(1, '#687A89');
  ctx.fillStyle = gradL;
  ctx.fillRect(e.x + 4 - slide, e.y + 11, doorW, doorH);
  const gradR = ctx.createLinearGradient(e.x + 6 + doorW + slide, 0, e.x + 6 + 2 * doorW + slide, 0);
  gradR.addColorStop(0, '#687A89'); gradR.addColorStop(0.55, '#D0D9E0'); gradR.addColorStop(1, '#536575');
  ctx.fillStyle = gradR;
  ctx.fillRect(e.x + 6 + doorW + slide, e.y + 11, doorW, doorH);
  // Panel grooves and cyan safety-edge lights
  ctx.fillStyle = 'rgba(22,35,49,0.46)';
  ctx.fillRect(e.x + 8 - slide, e.y + 14, 1, doorH - 6);
  ctx.fillRect(e.x + e.w - 9 + slide, e.y + 14, 1, doorH - 6);
  ctx.fillStyle = '#24303E';
  ctx.fillRect(e.x + 4 + doorW - Math.round(slide / 2), e.y + 11, 2, doorH);
  ctx.restore();

  // Animated floor indicator and call button remain outside the moving leaves.
  ctx.save();
  ctx.fillStyle = '#273647';
  ctx.fillRect(e.x + e.w - 9, e.y + 20, 6, 18);
  const shownFloor = elevatorMotion && performance.now() - elevatorMotion.startedAt > 600
    ? elevatorMotion.toFloor : activeFloor;
  ctx.fillStyle = elevatorMotion ? (Math.floor(clock / 5) % 2 ? '#7DEBFF' : '#00F5D4') : '#00F5D4';
  ctx.font = 'bold 7px monospace';
  ctx.fillText(String(shownFloor).padStart(2, '0'), e.x + e.w - 9, e.y + 28);
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(e.x + e.w - 7, e.y + 32, 2, 2);
  if (elevatorMotion) {
    ctx.fillStyle = '#7DEBFF';
    ctx.fillRect(e.x + e.w - 7, e.y + 35 + (Math.floor(clock / 6) % 2), 2, 2);
  }
  ctx.restore();
}

function drawAnimatedRoomDoors() {
  const defs = ROOM_DEFS[activeFloor] || [];
  const agents = AGENTS.filter(agent => !agent.inTransit && (agent.floorId || 1) === activeFloor);
  defs.forEach(room => {
    const centerX = roomDoorCenter(room);
    const thresholdY = room.y === 0 ? CORRIDOR_Y : CORRIDOR_Y + 2;
    const approaching = agents.some(agent => Math.abs(agent.x - centerX) < 1.45
      && Math.abs(agent.y - thresholdY) < 2.35);
    const key = activeFloor + ':' + room.id;
    const current = roomDoorStates.get(key) || 0;
    const next = current + ((approaching ? 1 : 0) - current) * (approaching ? 0.24 : 0.13);
    const openness = Math.abs(next - (approaching ? 1 : 0)) < 0.018 ? (approaching ? 1 : 0) : next;
    roomDoorStates.set(key, openness);

    const cx = Math.round(centerX * T);
    const y = room.y === 0 ? CORRIDOR_Y * T + 4 : room.y * T + 8;
    const width = 28;
    const height = room.y === 0 ? 17 : 29;
    const leafWidth = Math.floor(width / 2);
    const slide = Math.round(openness * (leafWidth - 1));
    const tint = activeFloor === 1 ? '#D7B477' : '#85E8F0';
    ctx.save();
    ctx.fillStyle = 'rgba(10,15,22,0.96)';
    ctx.fillRect(cx - width / 2, y, width, height);
    ctx.fillStyle = '#293644';
    ctx.fillRect(cx - width / 2 + 2, y + 2, width - 4, height - 4);
    const panel = (x, side) => {
      const grad = ctx.createLinearGradient(x, y, x + leafWidth, y);
      grad.addColorStop(0, '#344656'); grad.addColorStop(0.52, '#AFC0CC'); grad.addColorStop(1, '#536675');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y + 2, leafWidth, height - 4);
      ctx.fillStyle = 'rgba(15,26,36,0.35)';
      ctx.fillRect(side === 'left' ? x + leafWidth - 2 : x + 1, y + 4, 1, height - 8);
      ctx.fillStyle = tint;
      ctx.globalAlpha = 0.42 + openness * 0.5;
      ctx.fillRect(side === 'left' ? x + leafWidth - 1 : x + 1, y + 3, 1, height - 6);
      ctx.globalAlpha = 1;
    };
    panel(cx - leafWidth - slide, 'left');
    panel(cx + slide, 'right');
    ctx.fillStyle = '#1B2734';
    ctx.fillRect(cx - 1, y + 3, 2, height - 6);
    ctx.fillStyle = room.accent;
    ctx.globalAlpha = 0.25 + openness * 0.65;
    ctx.fillRect(cx - 4, y - 2, 8, 2);
    ctx.globalAlpha = 1;
    ctx.restore();
  });
}

function drawOfficeWalls(floorId) {
  if (!wallLayerCache[floorId]) wallLayerCache[floorId] = buildWallLayer(floorId);
  ctx.drawImage(wallLayerCache[floorId], 0, 0);
  drawElevatorDoors();
  drawAnimatedRoomDoors();
}

/* Cached soft lighting: per-room pools + warm lamp glows + vignette. */
const LAMP_GLOWS = {
  1: [[19.5, 2.5], [29.5, 1.5], [4.5, 14.0], [10.5, 13.5], [39.5, 14.5]],
  2: [[27.5, 11.5]]
};

function accentRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
}

function buildFloorOverlay(floorId) {
  const layer = document.createElement('canvas');
  layer.width = W;
  layer.height = H;
  const g = layer.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.globalCompositeOperation = 'screen';
  ROOM_DEFS[floorId].forEach(r => {
      const cx = (r.x + r.w / 2) * T;
      const cy = (r.y + r.h / 2) * T;
      const radius = Math.round(r.w * T * 0.52);
      const grad = g.createRadialGradient(cx, cy, 6, cx, cy, radius);
      grad.addColorStop(0, accentRgba(r.accent, 0.13));
      grad.addColorStop(0.55, accentRgba(r.accent, 0.045));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    });
(LAMP_GLOWS[floorId] || []).forEach(([tx, ty]) => {
    const cx = tx * T, cy = ty * T, radius = 52;
    const grad = g.createRadialGradient(cx, cy, 3, cx, cy, radius);
    grad.addColorStop(0, 'rgba(255,220,130,0.30)');
    grad.addColorStop(0.5, 'rgba(245,200,95,0.10)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  });
g.globalCompositeOperation = 'source-over';
const edge = (x0, y0, x1, y1, w2, h2) => {
  const grad = g.createLinearGradient(x0, y0, x1, y1);
  grad.addColorStop(0, 'rgba(12,8,16,0.26)');
  grad.addColorStop(1, 'rgba(12,8,16,0)');
  g.fillStyle = grad;
  g.fillRect(Math.min(x0, x1), Math.min(y0, y1), w2, h2);
};
edge(0, 0, 0, 22, W, 22);
edge(0, H, 0, H - 22, W, 22);
edge(0, 0, 22, 0, 22, H);
edge(W, 0, W - 22, 0, 22, H);
return layer;
}

function drawLightingOverlay() {
  if (!floorOverlayCache[activeFloor]) {
    floorOverlayCache[activeFloor] = buildFloorOverlay(activeFloor);
  }
ctx.drawImage(floorOverlayCache[activeFloor], 0, 0);
}

const CINEMATIC_LIGHTS = {
  1: [
    { x: 19.5, y: 2.2, color: '#FFE070', radius: 72, alpha: 0.22, phase: 0.1 },
    { x: 4.5, y: 1.5, color: '#00F0FF', radius: 96, alpha: 0.14, phase: 1.2 },
    { x: 23.5, y: 2.0, color: '#FF55B8', radius: 64, alpha: 0.10, phase: 2.4 },
    { x: 34.5, y: 14.0, color: '#FF55B8', radius: 58, alpha: 0.10, phase: 3.1 }
  ],
2: [
  { x: 7.5, y: 3.0, color: '#D93838', radius: 70, alpha: 0.12, phase: 0.5 },
  { x: 22.0, y: 2.0, color: '#FF55B8', radius: 66, alpha: 0.11, phase: 1.7 },
  { x: 36.0, y: 2.0, color: '#00F0FF', radius: 98, alpha: 0.19, phase: 2.8 },
  { x: 7.5, y: 13.3, color: '#B197FC', radius: 78, alpha: 0.12, phase: 3.5 },
  { x: 22.0, y: 13.3, color: '#7DEBFF', radius: 74, alpha: 0.12, phase: 4.1 },
  { x: 37.0, y: 13.3, color: '#FF6B6B', radius: 74, alpha: 0.12, phase: 5.0 }
]
};

function drawCinematicLighting() {
  if (!lightingEngine) return;
  if (!cinematicLightingCache || cinematicLightingCache.canvas.width !== W || cinematicLightingCache.canvas.height !== H) {
    cinematicLightingCache = lightingEngine.create(W, H);
  }
const motionReduced = lightingEngine.reducedMotion();
const lights = (CINEMATIC_LIGHTS[activeFloor] || []).map(light => ({
      ...light,
      x: light.x * T,
      y: light.y * T
    }));
lightingEngine.render(ctx, cinematicLightingCache, lights, motionReduced);
}

/* Subtle live detail: blinking server LEDs and the arcade screen glow.
(The old full-screen neon laser web over the billiard table is gone.) */
function drawAmbientFX() {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const cycle = Math.floor(clock / 9);
  const ledCols = ['#00F5D4', '#37E08B', '#FFD93D', '#FF6B6B'];
  const blinkRow = (tiles, ty) => {
    tiles.forEach((tx, i) => {
        for (let d = 0; d < 4; d++) {
          const on = (cycle + i * 2 + d) % 4 === 0;
          ctx.fillStyle = on ? ledCols[(i + d) % ledCols.length] : 'rgba(40,70,80,0.55)';
          ctx.fillRect(tx * T + 8 + (d % 2) * 8, ty * T + 12 + Math.floor(d / 2) * 12, 2, 2);
        }
    });
};
if (activeFloor === 1) {
  blinkRow([1, 2, 3, 6, 7, 8], 0);
  const flicker = 0.35 + 0.25 * Math.sin(clock * 0.23);
  ctx.fillStyle = 'rgba(80,200,255,' + flicker.toFixed(3) + ')';
  ctx.fillRect(30 * T + 8, 8 * T + 10, 16, 9); // arcade screen
} else {
blinkRow([1, 4, 10, 13], 7);
blinkRow([5, 12, 31, 38, 40], 0);
}
ctx.restore();
}

/* Reference-style room signs: dark pills with an accent bar, straddling
the corridor edge of each room. Drawn last so they always read. */
function drawActiveRoomHighlight() {
  const room = (ROOM_DEFS[activeFloor] || []).find(item => item.id === activeRoomId);
  if (!room) return;
  const color = /^#[0-9a-f]{6}$/i.test(room.accent) ? room.accent : '#F4D35E';
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);
  ctx.shadowColor = color;
  ctx.shadowBlur = 7;
  ctx.strokeRect(room.x * T + 2, room.y * T + 2, room.w * T - 4, room.h * T - 4);
  ctx.setLineDash([]);
  ctx.restore();
}

function drawRoomTitles(floorId) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.font = 'bold 9px monospace';
  try { ctx.letterSpacing = '1px'; } catch (_) {}
  (ROOM_DEFS[floorId] || []).forEach(r => {
      const textW = ctx.measureText(r.label).width;
      const pillW = Math.min(r.w * T - 12, Math.ceil(textW) + 18);
      const cx = Math.round((r.x + r.w / 2) * T - pillW / 2);
      const cy = r.y === 0 ? (r.y + r.h) * T - 8 : r.y * T - 8;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(cx + 1, cy + 2, pillW, 16);
      ctx.fillStyle = '#11141C';
      ctx.fillRect(cx, cy, pillW, 16);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx + 0.5, cy + 0.5, pillW - 1, 15);
      ctx.fillStyle = r.accent;
      ctx.fillRect(cx, cy, 3, 16);
      ctx.fillStyle = '#F4F7FB';
      ctx.fillText(r.label, cx + 8, cy + 12);
    });
try { ctx.letterSpacing = '0px'; } catch (_) {}
ctx.restore();
}

/* ---------- 4. AGENTS ---------- */
// Grid positions (tile coords) desks are drawn at (tx, ty)
window.KRA_APP_READY = false;
window.KRA_APP_BOOT_STARTED = performance.now();
window.KRA_APP_READY_AT = 0;
window.KRA_APP_ATLAS_READY_AT = 0;
const AGENTS = [
  {
    id: 'rama', name: 'RAMA', role: 'Executive Boss / Lead Auditor',
    x: 14, y: 2, homeX: 14, homeY: 2, floorId: 1, inTransit: false,
    badge: 'badge-boss', status: 'supervising',
    appearance: { body: 'standard_warm', face: 'stern_brows', hair: 'exec_part_dark', top: 'navy_suit_tie', bottom: 'formal_navy_loafers', shoes: 'formal_loafers', heldItem: 'glasses_tablet' },
    palette: { skin: '#F2C79B', hair: '#241A12', primary: '#1F2A44', accent: '#F4D35E' },
    intro: "Rama: I'm watching the floor. Bring me finished work, not drafts."
  },
{
  id: 'jarvis', name: 'JARVIS', role: 'Infrastructure Daemon / SysAdmin',
  x: 36.5, y: 5.5, homeX: 36.5, homeY: 5.5, floorId: 2, inTransit: false,
  badge: 'badge-ops', status: 'monitoring systems',
  appearance: { body: 'android_synth', face: 'stern_brows', hair: 'tech_crop_brown', top: 'white_lab_coat', bottom: 'chinos_sneakers', shoes: 'white_sneakers', heldItem: 'wrench_tool' },
  palette: { skin: '#91A9C2', hair: '#253B54', primary: '#D9E7F2', accent: '#00F5D4' },
  intro: 'Jarvis: Core systems operating within nominal parameters.'
},
{
  id: 'creator', name: 'BUDI', role: 'Scaffolding & Asset Production',
  x: 14, y: 14, homeX: 14, homeY: 14, floorId: 1, inTransit: false,
  badge: 'badge-idle', status: 'standing by',
  appearance: { body: 'tall_olive', face: 'beard_mustache', hair: 'tech_crop_brown', top: 'blue_overalls_belt', bottom: 'denim_work_boots', shoes: 'white_sneakers', heldItem: 'none' },
  palette: { skin: '#C99770', hair: '#3F2A1D', primary: '#238D89', accent: '#F2D59A' },
  intro: 'Budi: Ready to scaffold. Point me at a folder.'
},
{
  id: 'modifier', name: 'MAYA', role: 'Code & Config Refactoring',
  x: 23, y: 2, homeX: 23, homeY: 2, floorId: 1, inTransit: false,
  badge: 'badge-idle', status: 'standing by',
  appearance: { body: 'petite_light', face: 'stern_brows', hair: 'exec_part_dark', top: 'charcoal_jacket_coral', bottom: 'chinos_sneakers', shoes: 'white_sneakers', heldItem: 'glasses_tablet' },
  palette: { skin: '#E8B99B', hair: '#201721', primary: '#303641', accent: '#FF7D71' },
  intro: 'Maya: Give me a target file and a spec.'
},
{
  id: 'auditor', name: 'DIMAS', role: 'Diagnostics & Security Review',
  x: 34, y: 14, homeX: 34, homeY: 14, floorId: 1, inTransit: false,
  badge: 'badge-auditor', status: 'Scanning for risks.',
  appearance: { body: 'broad_deep', face: 'beard_mustache', hair: 'tech_crop_brown', top: 'tactical_vest_purple', bottom: 'cargo_tactical', shoes: 'white_sneakers', heldItem: 'none' },
  palette: { skin: '#A96F4E', hair: '#35251D', primary: '#392B58', accent: '#E2A8FF' },
  intro: 'Dimas: I read everything. Nothing gets past me.'
},
{
  id: 'ops', name: 'SITI', role: 'Filesystem & Directory Management',
  x: 2, y: 14, homeX: 2, homeY: 14, floorId: 1, inTransit: false,
  badge: 'badge-idle', status: 'standing by',
  appearance: { body: 'standard_warm', face: 'stern_brows', hair: 'hijab_emerald', top: 'brown_cardigan_green', bottom: 'chinos_sneakers', shoes: 'white_sneakers', heldItem: 'none' },
  palette: { skin: '#D39B77', hair: '#17613F', primary: '#71533E', accent: '#69D49B' },
  intro: 'Siti: The vault stays tidy on my watch.'
}
];

function normalizeAppearance(appearance) {
  if (!appearance || typeof appearance !== 'object') return null;
  const allowed = (value, values, fallback) => values.includes(value) ? value : fallback;
  return {
    spriteVersion: '2.0-ortho-ref',
    body: allowed(appearance.body, ['standard_warm', 'petite_light', 'tall_olive', 'broad_deep', 'android_synth'], 'standard_warm'),
    face: allowed(appearance.face, ['stern_brows', 'beard_mustache'], 'stern_brows'),
    hair: allowed(appearance.hair, ['exec_part_dark', 'tech_crop_brown', 'hijab_emerald'], 'exec_part_dark'),
    top: allowed(appearance.top, ['navy_suit_tie', 'teal_blazer_cream', 'white_lab_coat', 'tactical_vest_purple', 'blue_overalls_belt', 'charcoal_jacket_coral', 'brown_cardigan_green'], 'navy_suit_tie'),
    bottom: allowed(appearance.bottom, ['formal_navy_loafers', 'denim_work_boots', 'chinos_sneakers', 'cargo_tactical'], 'formal_navy_loafers'),
    shoes: allowed(appearance.shoes, ['formal_loafers', 'white_sneakers'], 'formal_loafers'),
    accessories: allowed(appearance.accessories, ['none'], 'none'),
    heldItem: allowed(appearance.heldItem, ['none', 'wrench_tool', 'glasses_tablet'], 'none'),
    palette: appearance.palette && typeof appearance.palette === 'object'
    ? { primary: String(appearance.palette.primary || '') }
    : {},
    hitbox: { width: 24, height: 32, pivot: 'bottom_center' }
  };
}

function mergePersistedAgents(saved) {
  if (!Array.isArray(saved)) return;
  saved.forEach(agent => {
      if (!agent || !agent.id || AGENTS.some(existing => existing.id === agent.id)) return;
      AGENTS.push({
          ...agent,
          x: Number(agent.x) || 1,
          y: Number(agent.y) || 7,
          homeX: Number(agent.homeX) || Number(agent.x) || 1,
          homeY: Number(agent.homeY) || Number(agent.y) || 7,
          floorId: Number(agent.floorId) || 1,
          inTransit: Boolean(agent.inTransit),
          badge: agent.badge || 'badge-idle',
          status: agent.status || 'standing by',
          appearance: normalizeAppearance(agent.appearance),
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
const modularAgentCache = new Map();
const modularAgentRegistry = window.KRAAssetRegistry || null;

function drawModularAgent(agent, X, Y, frame, facing) {
  if (!modularAgentRegistry || typeof modularAgentRegistry.drawModularAgent !== 'function') return false;
  if (!agent.appearance) return false;
  const moving = agent.state === AGENT_STATES.MOVING
    || Math.abs(agent.x - agent.homeX) > 0.05 || Math.abs(agent.y - agent.homeY) > 0.05;
  const appearance = { ...agent.appearance, anim: moving ? 'walk' : 'idle' };
  const direction = facing === 'up' ? 'back' : facing === 'left' ? 'left' : facing === 'right' ? 'right' : 'front';
  const key = JSON.stringify([appearance, agent.palette, direction, frame % 2]);
  let cached = modularAgentCache.get(key);
  if (!cached) {
    cached = document.createElement('canvas');
    cached.width = 32;
    cached.height = 40;
    const cacheCtx = cached.getContext('2d');
    cacheCtx.imageSmoothingEnabled = false;
    modularAgentRegistry.drawModularAgent(cacheCtx, direction, { ...appearance, palette: agent.palette }, frame % 2);
    modularAgentCache.set(key, cached);
  }
ctx.save();
ctx.imageSmoothingEnabled = false;
ctx.drawImage(cached, X, Y - 8, 32, 40);
ctx.restore();
return true;
}

const hdAgentSheets = new Map();

function loadHDAgentSheet(key) {
  if (hdAgentSheets.has(key)) return hdAgentSheets.get(key);
  const entry = { ready: false, image: null };
  hdAgentSheets.set(key, entry);
  const url = '../assets/argon/Batch8_HD_Humanoid_and_Lighting_Upgrade/Batch8_HD_Upgrade/02_HD_Agent_Spritesheets_32x48/' + key + '_hd_spritesheet_32x48.png';
  loadImageAsset(url).then(img => {
    entry.image = img;
    entry.ready = true;
  }).catch(() => {});
  return entry;
}

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
      buildRoster();
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
  const url = '../assets/argon/Batch5_Cybercat_and_Event_FX/01_Cybercat_Jarvis/' + animId + '_spritesheet.png';
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

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  return hash;
}

function drawAgentSheet(agent, X, Y, state, facing) {
  const ID_MAP = {
    rama: 'rama', jarvis: 'jarvis', creator: 'budi', budi: 'budi',
    modifier: 'maya', maya: 'maya', ops: 'siti', siti: 'siti',
    auditor: 'dimas', dimas: 'dimas'
  };
  const hiredSpriteKeys = ['budi', 'maya', 'dimas', 'siti', 'jarvis'];
  const key = ID_MAP[agent.id] || (agent.id.startsWith('agent-')
    ? hiredSpriteKeys[Math.abs(hashString(agent.id)) % hiredSpriteKeys.length]
    : agent.id);

  // Try Batch 11 Modular first if appearance exists
  if (agent.appearance && agent.appearance.spriteVersion === '2.0-modular') {
    const d = facing === 'up' ? 3 : facing === 'left' ? 1 : facing === 'right' ? 2 : 0;
    const f = Math.floor(clock / 8) % 16;
    const frameId = `agent_modular_${d}_${f}`;
    const cached = getCachedAtlasFrame(frameId);
    if (cached) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(cached.composite, X, Y - 8, 32, 40);
      ctx.restore();
      return true;
    }
  }

  // Try Batch 8 HD Sprite next (32x48)
  const hdSheet = loadHDAgentSheet(key);
  if (hdSheet.ready) {
    const HD_POSES = { idle: 0, walk: 4, terminal: 8, inspect: 12, talk: 16 };
    const HD_DIRS = { front: 0, left: 1, right: 2, back: 3, down: 0, up: 3 };
    const startCol = HD_POSES[state] ?? 0;
    const row = HD_DIRS[facing] ?? 0;
    const frame = Math.floor(clock / 6) % 4;
    const sx = (startCol + frame) * 32;
    const sy = row * 48;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(hdSheet.image, sx, sy, 32, 48, X, Y - 16, 32, 48);
    ctx.restore();
    return true;
  }

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

  if (drawModularAgent(agent, X, Y, frame, facing)) return;

  // Fixed officers keep authored sprite sheets; procedural body remains fallback.
  const sheetMoving = Math.abs(agent.x - agent.homeX) > 0.05 || Math.abs(agent.y - agent.homeY) > 0.05;
  const sheetState = agent.state === AGENT_STATES.COMMUNICATING ? 'talk'
  : (agent.state === AGENT_STATES.WORKING || agent.status === 'coding') ? 'terminal'
  : sheetMoving ? 'walk' : 'idle';
  if (drawAgentSheet(agent, X, Y, sheetState, facing)) {
    if (agent.id.startsWith('agent-')) {
      ctx.save();
      ctx.fillStyle = agent.palette.accent;
      ctx.fillRect(X + 26, Y + 5, 4, 4);
      ctx.strokeStyle = agent.palette.primary;
      ctx.lineWidth = 1;
      ctx.strokeRect(X + 2.5, Y + 1.5, 27, 32);
      ctx.restore();
    }
  return;
}

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

/* Boss-side profile marker, styled as a clean initials badge rather than a pixel sprite. */
function drawPortrait() {
  const pc = document.getElementById('portrait-canvas');
  const frame = pc?.parentElement;
  if (!pc || !frame) return;
  pc.setAttribute('aria-hidden', 'true');
  const currentAgent = selectedAgent || AGENTS[0];
  const displayName = String(currentAgent?.name || currentAgent?.id || 'Agent').trim();
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  frame.dataset.initial = initials || '?';
  const accent = /^#[0-9a-f]{6}$/i.test(String(currentAgent?.palette?.accent || '')) ? currentAgent.palette.accent : '#8da895';
  frame.style.setProperty('--agent-accent', accent);
}

/* ---------- 5. RENDER LOOP ---------- */
let clock = 0; // animation clock normalized to 60 Hz, independent of display refresh
let previousRenderAt = 0;
let lastDataGenerationTick = 0;
let lastActivityCycle = 0;
let serverDataGenerationUnits = 0;
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
    if (result.ok) termLine('[Obsidian]: Meeting report saved ' + result.reportFile, 'sys');
    else throw new Error(result.error || 'Meeting report failed');
    return result;
  }).catch(error => {
  termLine('[Obsidian]: Meeting report unavailable ' + error.message, 'warn');
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
walkPath(first, 8, 2, arrive);
walkPath(second, 11, 2, arrive);
});
});
}

const AGENT_ACTIVITIES = {
  rama: [
    { x: 14, y: 2, status: 'auditing', text: 'Working on boss desk.' },
    { x: 16.5, y: 3.5, status: 'reviewing', text: 'Reviewing the floor.' },
    { x: 19.5, y: 10, status: 'briefing', text: 'Briefing team at elevator.' }
  ],
jarvis: [
  { x: 32.5, y: 2.5, status: 'monitoring systems', text: 'Checking the primary rack aisle.' },
  { x: 38.5, y: 2.5, status: 'monitoring systems', text: 'Balancing the GPU cluster.' },
  { x: 40.5, y: 6.5, status: 'thinking', text: 'Cooling systems are nominal.' }
],
creator: [
  { x: 12.5, y: 14.5, status: 'coding', text: 'Working at the war table.' },
  { x: 13.5, y: 10, status: 'building', text: 'Reviewing task board.' },
  { x: 23, y: 14.5, status: 'thinking', text: 'Grabbing espresso.' }
],
modifier: [
  { x: 23, y: 2, status: 'refactoring', text: 'Working behind studio PC.' },
  { x: 21.5, y: 1.5, status: 'refactoring', text: 'Tracing diff on the board.' },
  { x: 16.5, y: 4.5, status: 'walking', text: 'Checking with Rama.' }
],
auditor: [
  { x: 34, y: 14, status: 'auditing', text: 'Playing billiard & risk scan.' },
  { x: 30, y: 14, status: 'auditing', text: 'Scanning for risks.' },
  { x: 6.5, y: 2.6, status: 'thinking', text: 'Auditing the server vault.' }
],
ops: [
  { x: 2, y: 14, status: 'managing', text: 'Working behind records PC.' },
  { x: 4, y: 14, status: 'organizing', text: 'Vault stays tidy.' },
  { x: 7.5, y: 14.5, status: 'monitoring', text: 'Scanning documents.' }
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
  if (!options.length || agent.activityBusy || (agent.floorId || 1) !== activeFloor) return;
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

function drawWorldBubble(agent, projectedPoint) {
  if (!agent.bubble || agent.bubbleUntil < performance.now()) return;
  if (agent.bubbleUntil < performance.now()) { agent.bubble = ''; return; }
  if ((agent.floorId || 1) !== activeFloor) return;
  const x = Math.round(projectedPoint ? projectedPoint.x : agent.x * T + 14);
  const y = Math.round(projectedPoint ? projectedPoint.y : agent.y * T - 12);
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

function isometricPoint(x, y, z = 0) {
  return window.KRAThreeOfficeRenderer?.point(x, y, z, MAP, T) || { x: 0, y: 0 };
}

function renderThreeOffice(frame, deltaMs) {
  const renderer = window.KRAThreeOfficeRenderer;
  ctx.clearRect(0, 0, W, H);
  if (!renderer) {
    ctx.save(); ctx.fillStyle = '#f5f0e6'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('3D office renderer did not load.', W / 2, H / 2); ctx.restore();
    return true;
  }
  const lift = { openness: elevatorDoorOpenness, motion: elevatorMotion };
  const ready = renderer.render({
    ctx, W, H, T, MAP, floor, deco, ROOM_DEFS, activeFloor, activeRoomId, deltaMs,
    AGENTS, selectedAgent, clock, roomDoorCenter, roomDoorStates, customDecor,
    surfaceDecor: SURFACE_DECOR[activeFloor] || [], cybercat, decorMode, selectedDecorItem,
    mouseTileX, mouseTileY, getItemFootprint, isAtlasItem, elevator: lift
  });
  elevatorDoorOpenness = lift.openness;
  if (!ready) {
    ctx.save(); ctx.fillStyle = '#f5f0e6'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('This browser needs WebGL enabled to display the 3D office.', W / 2, H / 2); ctx.restore();
    return true;
  }
  AGENTS.forEach(agent => {
    if ((agent.floorId || 1) !== activeFloor || agent.inTransit) return;
    const bubblePoint = renderer.point(agent.x + 0.5, agent.y + 0.5, 2.45, MAP, T);
    drawWorldBubble(agent, bubblePoint);
  });
  return true;
}

function render(timestamp) {
  const renderStart = performance.now();
  const now = Number.isFinite(timestamp) ? timestamp : renderStart;
  const deltaMs = previousRenderAt ? Math.min(50, Math.max(0, now - previousRenderAt)) : (1000 / 60);
  previousRenderAt = now;
  clock += deltaMs / (1000 / 60);
  const dataTick = Math.floor(clock / 60);
  if (dataTick > lastDataGenerationTick && ROOM_DEFS[2].some(room => room.id === 'server2')) {
    serverDataGenerationUnits += dataTick - lastDataGenerationTick;
    lastDataGenerationTick = dataTick;
  }
  const frame = Math.floor(clock / 6) % 4;

  updateCybercat();
  const colonySceneRendered = renderThreeOffice(frame, deltaMs);
  if (!colonySceneRendered) {
    drawFloors();
    drawOfficeWalls(activeFloor);
    drawActiveRoomHighlight();
    drawPropShadows();
    drawDecor();
    drawCustomDecor();
    drawAtlasDecorAndAgents(frame);
    drawSurfaceDecor();
    drawAmbientFX();
    drawLightingOverlay();
    drawCinematicLighting();
    drawRoomTitles(activeFloor);
  }

  const floorAgents = [];
  for (let i = 0; i < AGENTS.length; i += 1) {
    const agent = AGENTS[i];
    if ((agent.floorId || 1) === activeFloor && !agent.inTransit) floorAgents.push(agent);
  }
const activityCycle = Math.floor(clock / 240);
if (activityCycle > lastActivityCycle) {
  lastActivityCycle = activityCycle;
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

// Crew state markers are projected by the live Three.js model renderer.
if (!colonySceneRendered) {
  ctx.save();
  floorAgents.forEach(a => {
      const active = a.status && !/standing by|idle/i.test(a.status);
      ctx.fillStyle = active ? '#FF9F1C' : '#00F5D4';
      ctx.fillRect(Math.round(a.x * T + 22), Math.round(a.y * T - 4), 5, 5);
    });
  ctx.restore();
}

// Highlight tile under cursor when Decorator mode is active
if (!colonySceneRendered && decorMode && mouseTileX >= 0 && mouseTileX < MAP.w && mouseTileY >= 0 && mouseTileY < MAP.h) {
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

let officerSession = sessionStorage.getItem('kra_auth_token') || '';
let kraActiveOfficer = JSON.parse(sessionStorage.getItem('kra_active_user') || 'null') || {
  id: 'user_rama',
  username: 'rama',
  display_name: 'Rama (Executive Boss)',
  role: 'supervisor'
};

function getAuthHeaders(json) {
  const headers = {};
  if (json !== false) headers['Content-Type'] = 'application/json';
  if (officerSession) headers['Authorization'] = 'Bearer ' + officerSession;
  return headers;
}

/* Wrap native fetch to inject auth headers on every API call */
const _origFetch = window.fetch;
window.fetch = function(url, opts) {
  if (typeof url === 'string' && url.indexOf('/api/') !== -1) {
    opts = opts || {};
    const existing = opts.headers || {};
    const merged = Object.assign({}, existing);
    if (!merged['Authorization'] && officerSession) {
      merged['Authorization'] = 'Bearer ' + officerSession;
    }
  opts.headers = merged;
}
return _origFetch.call(this, url, opts);
};

function updateDecoratorBadge() {
  const titleEl = document.querySelector('.decor-bar-title');
  if (titleEl) {
    titleEl.textContent = 'DECK DECORATOR // OFFICER: ' + kraActiveOfficer.display_name.toUpperCase() + ' [ISOLATED]';
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
    updateDecoratorBadge();
    return;
  }
sessionStorage.removeItem('kra_auth_token');
sessionStorage.removeItem('kra_active_user');
sessionStorage.removeItem('kra-last-project-task');
window.location.replace('login.html');
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
  // Contain-fit the deeper colony floor into the frame; the dark
  // container mat reads as the picture frame from the reference art.
  const scaleX = availableWidth / W;
  const scaleY = availableHeight / H;
  camera.fitScale = Math.min(scaleX, scaleY);
  const displayScale = Math.max(0.01, camera.fitScale * camera.zoom);
  const displayWidth = Math.floor(W * displayScale);
  const displayHeight = Math.floor(H * displayScale);
  canvas.style.width = displayWidth + 'px';
  canvas.style.height = displayHeight + 'px';
  canvas.style.transformOrigin = 'center center';
  const sceneCanvas = document.getElementById('office-3d-canvas');
  if (sceneCanvas) { sceneCanvas.style.width = displayWidth + 'px'; sceneCanvas.style.height = displayHeight + 'px'; }
  window.KRAThreeOfficeRenderer?.resize(W, H);
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
const canvasFsButton = document.getElementById('btn-canvas-fullscreen');

if (zoomInButton) zoomInButton.addEventListener('click', () => { camera.zoom = Math.min(camera.maxZoom, camera.zoom + 0.125); applyCamera(); });
if (zoomOutButton) zoomOutButton.addEventListener('click', () => { camera.zoom = Math.max(camera.minZoom, camera.zoom - 0.125); applyCamera(); });

if (canvasFsButton) {
  canvasFsButton.addEventListener('click', () => {
      const viewport = document.querySelector('.floor-viewport');
      const isFs = viewport.classList.toggle('canvas-fullscreen');
      canvasFsButton.textContent = isFs ? ' ' : ' ';
      canvasFsButton.title = isFs ? 'Close Fullscreen' : 'Toggle Fullscreen Canvas';
      playSfx('reply');
      window.dispatchEvent(new Event('resize'));
    });
}

const logoutButton = document.getElementById('btn-logout');
if (logoutButton) {
  logoutButton.addEventListener('click', () => {
      sessionStorage.removeItem('kra_auth_token');
      sessionStorage.removeItem('kra_active_user');
      sessionStorage.removeItem('kra-last-project-task');
      window.location.replace('login.html');
    });
}

// Raycast the Three.js camera for selection and decor placement.
let mouseTileX = -1, mouseTileY = -1;
function canvasTileAt(worldX, worldY) {
  if (window.KRAThreeOfficeRenderer) return window.KRAThreeOfficeRenderer.hitTest(worldX, worldY, MAP, T);
  return { x: Math.floor(worldX / T), y: Math.floor(worldY / T) };
}
canvas.addEventListener('mousemove', event => {
    const rect = canvas.getBoundingClientRect();
    const worldX = ((event.clientX - rect.left) / rect.width) * W;
    const worldY = ((event.clientY - rect.top) / rect.height) * H;
    const tile = canvasTileAt(worldX, worldY);
    mouseTileX = tile.x;
    mouseTileY = tile.y;
  });
canvas.addEventListener('mouseleave', () => { mouseTileX = -1; mouseTileY = -1; });

canvas.addEventListener('click', event => {
    if (window.KRAThreeOfficeRenderer?.consumeClickSuppression()) return;
    const rect = canvas.getBoundingClientRect();
    const worldX = ((event.clientX - rect.left) / rect.width) * W;
    const worldY = ((event.clientY - rect.top) / rect.height) * H;
    const pointerTile = canvasTileAt(worldX, worldY);
    const tileX = pointerTile.x;
    const tileY = pointerTile.y;

    if (decorMode) {
      if (tileX >= 0 && tileX < MAP.w && tileY >= 0 && tileY < MAP.h) {
        const tileKey = tileX + ',' + tileY;
        if (selectedDecorItem === 'remove') {
          const atlasOrigin = [...customDecor[activeFloor].entries()].find(([key, item]) => {
              if (!isAtlasItem(item)) return false;
              const [originX, originY] = key.split(',').map(Number);
              const occupancy = getItemFootprint(item);
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
const occupancy = getItemFootprint(selectedDecorItem);
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
    if (window.KRAThreeOfficeRenderer) {
      const foot = isometricPoint(agent.x + 0.5, agent.y + 0.5);
      return worldX >= foot.x - 17 && worldX <= foot.x + 17
        && worldY >= foot.y - 42 && worldY <= foot.y + 5;
    }
    const ax = agent.x * T, ay = agent.y * T;
    return worldX >= ax - 5 && worldX <= ax + 28 && worldY >= ay && worldY <= ay + 34;
  });
if (handleColonyAssetClick(tileX, tileY)) return;
if (target) selectAgent(target.id);
});

function handleColonyAssetClick(tileX, tileY) {
  if (tileX < 0 || tileX >= MAP.w || tileY < 0 || tileY >= MAP.h) return false;
  const candidates = [];
  for (let y = 0; y < MAP.h; y += 1) for (let x = 0; x < MAP.w; x += 1) {
    const id = deco[y]?.[x];
    if (!id) continue;
    const footprint = getItemFootprint(id);
    if (tileX >= x && tileX < x + footprint.cols && tileY >= y && tileY < y + footprint.rows) candidates.push(String(id));
  }
  const itemId = candidates.find(id => /server_rack_jarvis|aif_training_display_data_crystal|workstation_maya|arcade_console_dimas|billiard_table_dimas/i.test(id));
  if (!itemId) return false;
  if (/server_rack_jarvis/i.test(itemId)) {
    termLine('[Jarvis]: Server data generation is active. Simulated units: ' + serverDataGenerationUnits + '.', 'sys');
    const jarvis = AGENTS.find(agent => agent.id === 'jarvis');
    if (jarvis && (jarvis.floorId || 1) === activeFloor) agentBubble(jarvis, 'Data generation is active.', 'task', 3000);
  } else if (/aif_training_display_data_crystal/i.test(itemId)) {
    termLine('[System Control]: Server-room control UI node is online; display shimmer is active.', 'sys');
  } else if (/workstation_maya/i.test(itemId)) {
    termLine('[Admin Terminal]: Interactable office terminal ready. Live provider actions are not triggered by this visual preview.', 'sys');
  } else {
    const preferred = selectedAgent && (selectedAgent.floorId || 1) === activeFloor
      ? selectedAgent : AGENTS.find(agent => agent.id === 'auditor' && (agent.floorId || 1) === activeFloor);
    if (preferred) {
      preferred.recreationBuffUntil = performance.now() + 20000;
      agentBubble(preferred, 'Recreation buff: refreshed for 20 seconds.', 'task', 3600);
    }
    termLine('[Play Room]: Recreation buff applied for 20 seconds.', 'sys');
  }
  playSfx('reply');
  return true;
}

/* Decorator toolbar UI wiring */
const decorBar = document.getElementById('decor-bar');
const toggleDecorBtn = document.getElementById('btn-toggle-decor');
const closeDecorBtn = document.getElementById('btn-close-decor');
const clearDecorBtn = document.getElementById('btn-clear-decor');
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
const terminal = document.getElementById('chat-output');
const sysLog = document.getElementById('terminal-output');
const commandInput = document.getElementById('command-input');
const chatFileInput = document.getElementById('chat-file-input');
const chatAttachmentQueue = document.getElementById('chat-attachments');
const MAX_CHAT_ATTACHMENTS = 5;
const MAX_CHAT_FILE_BYTES = 12 * 1024 * 1024;
const MAX_CHAT_TEXT_BYTES = 256 * 1024;
const MAX_CHAT_TEXT_CHARS = 50000;
const MAX_CHAT_TEXT_BYTES_PER_FILE = 50000;
const MAX_CHAT_TEXT_BYTES_TOTAL = 100000;
const chatTextEncoder = new TextEncoder();
let queuedChatFiles = [];
let pdfJsModulePromise = null;

function attachmentMimeType(file) {
  const extension = (file.name.split('.').pop() || '').toLowerCase();
  const byExtension = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
  return file.type || byExtension[extension] || '';
}

function attachmentKind(file) {
  const extension = (file.name.split('.').pop() || '').toLowerCase();
  if (file.type === 'application/pdf' || extension === 'pdf') return 'pdf';
  if (['image/png', 'image/jpeg', 'image/webp'].includes(attachmentMimeType(file))) return 'image';
  if (['txt', 'md', 'csv', 'json', 'xml', 'html', 'css', 'js', 'mjs', 'log', 'yaml', 'yml'].includes(extension)
      || file.type.startsWith('text/')) return 'text';
  return '';
}

function renderChatAttachmentQueue(status = '') {
  chatAttachmentQueue.replaceChildren();
  chatAttachmentQueue.classList.toggle('hidden', queuedChatFiles.length === 0 && !status);
  queuedChatFiles.forEach((file, index) => {
    const chip = document.createElement('div');
    chip.className = 'chat-attachment-chip';
    const icon = document.createElement('span');
    icon.className = 'chat-attachment-icon';
    icon.textContent = attachmentKind(file) === 'image' ? '▧' : attachmentKind(file) === 'pdf' ? 'PDF' : 'TXT';
    const name = document.createElement('span');
    name.className = 'chat-attachment-name';
    name.textContent = file.name;
    name.title = file.name + ' · ' + Math.ceil(file.size / 1024) + ' KB';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'chat-attachment-remove';
    remove.setAttribute('aria-label', 'Remove ' + file.name);
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      queuedChatFiles.splice(index, 1);
      renderChatAttachmentQueue();
    });
    chip.append(icon, name, remove);
    chatAttachmentQueue.appendChild(chip);
  });
  if (status) {
    const note = document.createElement('span');
    note.className = 'chat-attachment-status';
    note.textContent = status;
    chatAttachmentQueue.appendChild(note);
  }
}

function addChatFiles(files) {
  const errors = [];
  for (const file of files) {
    if (queuedChatFiles.length >= MAX_CHAT_ATTACHMENTS) {
      errors.push('Maksimal ' + MAX_CHAT_ATTACHMENTS + ' lampiran per pesan.');
      break;
    }
    if (!attachmentKind(file)) {
      errors.push(file.name + ': format tidak didukung. Gunakan gambar, PDF, atau file teks.');
      continue;
    }
    if (file.size > MAX_CHAT_FILE_BYTES) {
      errors.push(file.name + ': ukuran maksimal 12 MB.');
      continue;
    }
    if (queuedChatFiles.some(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) continue;
    queuedChatFiles.push(file);
  }
  renderChatAttachmentQueue(errors.join(' '));
}

function loadPdfJs() {
  if (!pdfJsModulePromise) {
    pdfJsModulePromise = import('./vendor/pdfjs/pdf.min.mjs?v=5.4.394').then(pdfjs => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs?v=5.4.394', document.baseURI).href;
      return pdfjs;
    });
  }
  return pdfJsModulePromise;
}

function truncateUtf8(text, maxBytes) {
  const encoded = chatTextEncoder.encode(String(text));
  if (encoded.length <= maxBytes) return String(text);
  let end = Math.max(0, maxBytes);
  while (end > 0) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(encoded.subarray(0, end));
    } catch (_) {
      end--;
    }
  }
  return '';
}

async function renderScannedPdfPages(file, pdf) {
  const rendered = [{
    name: file.name + ' (scanned PDF note)',
    kind: 'text',
    mimeType: 'application/pdf',
    text: 'This PDF has no selectable text. The first two pages are attached as images for visual analysis; OCR was not performed.',
  }];
  const pageLimit = Math.min(pdf.numPages, 2);
  for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(1.4, 1200 / base.width, 1600 / base.height);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d', { alpha: false });
    await page.render({ canvasContext: context, viewport }).promise;
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .78));
    canvas.width = 0;
    canvas.height = 0;
    if (!blob) throw new Error('Tidak dapat merender halaman ' + pageNumber + ' dari ' + file.name);
    rendered.push({
      name: file.name + ' — page ' + pageNumber,
      kind: 'image',
      mimeType: 'image/jpeg',
      dataUrl: await readBlobAsDataUrl(blob),
    });
  }
  return rendered;
}

async function extractPdfText(file) {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  const pageLimit = Math.min(pdf.numPages, 40);
  const pages = [];
  let byteCount = 0;
  for (let pageNumber = 1; pageNumber <= pageLimit && byteCount < MAX_CHAT_TEXT_BYTES_PER_FILE - 32; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const line = content.items.map(item => item.str || '').join(' ').replace(/\s+/g, ' ').trim();
    if (!line) continue;
    const pageLabel = '[Page ' + pageNumber + ']\n';
    const availableBytes = MAX_CHAT_TEXT_BYTES_PER_FILE - byteCount - chatTextEncoder.encode(pageLabel).length;
    const excerpt = truncateUtf8(line, Math.max(0, availableBytes));
    pages.push(pageLabel + excerpt);
    byteCount += chatTextEncoder.encode(pageLabel + excerpt).length;
  }
  if (!pages.length) return renderScannedPdfPages(file, pdf);
  const truncated = pdf.numPages > pageLimit || byteCount >= MAX_CHAT_TEXT_BYTES_PER_FILE - 32;
  return [{
    name: file.name,
    kind: 'text',
    mimeType: 'application/pdf',
    text: truncateUtf8(pages.join('\n\n') + (truncated ? '\n\n[PDF excerpt truncated locally for context size.]' : ''), MAX_CHAT_TEXT_BYTES_PER_FILE),
  }];
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Tidak dapat membaca lampiran gambar.'));
    reader.readAsDataURL(blob);
  });
}

function readFileAsDataUrl(file) {
  return readBlobAsDataUrl(file);
}

async function prepareChatAttachments() {
  const prepared = [];
  let imageBytes = 0;
  let textBytes = 0;
  for (const file of queuedChatFiles) {
    const kind = attachmentKind(file);
    if (kind === 'image') {
      imageBytes += file.size;
      if (imageBytes > 3.5 * 1024 * 1024) throw new Error('Total gambar maksimal 3,5 MB per pesan.');
      prepared.push({ name: file.name, kind: 'image', mimeType: attachmentMimeType(file), dataUrl: await readFileAsDataUrl(file) });
    } else if (kind === 'pdf') {
      const extracted = await extractPdfText(file);
      extracted.forEach(item => {
        if (item.kind === 'image') imageBytes += Math.floor((item.dataUrl.length * 3) / 4);
        else textBytes += chatTextEncoder.encode(item.text).length;
        prepared.push(item);
      });
      if (imageBytes > 3.5 * 1024 * 1024) throw new Error('Total gambar, termasuk halaman scan PDF, maksimal 3,5 MB per pesan.');
    } else {
      if (file.size > MAX_CHAT_TEXT_BYTES) throw new Error(file.name + ': file teks maksimal 256 KB.');
      const text = truncateUtf8(await file.text(), MAX_CHAT_TEXT_BYTES_PER_FILE);
      textBytes += chatTextEncoder.encode(text).length;
      prepared.push({ name: file.name, kind: 'text', mimeType: file.type || 'text/plain', text });
    }
    if (textBytes > MAX_CHAT_TEXT_BYTES_TOTAL) throw new Error('Total teks lampiran maksimal 100 KB per pesan.');
    if (prepared.length > MAX_CHAT_ATTACHMENTS) throw new Error('PDF scan dirender sebagai gambar halaman; kurangi jumlah file agar maksimal 5 item terkirim.');
  }
  return prepared;
}

let composerPreparingAttachments = false;
async function submitComposerMessage() {
  if (composerPreparingAttachments) return;
  let message = commandInput.value.trim();
  if (message.startsWith('/')) {
    if (queuedChatFiles.length) renderChatAttachmentQueue('Kirim pesan biasa agar file ikut dianalisis; command / tidak memakai lampiran.');
    handleCommand(message);
    commandInput.value = '';
    return;
  }
  if (!message && !queuedChatFiles.length) return;
  if (!message) message = 'Tolong analisis lampiran ini dan rangkum informasi pentingnya.';
  let attachments = [];
  if (queuedChatFiles.length) {
    composerPreparingAttachments = true;
    document.getElementById('btn-send-cmd').disabled = true;
    document.getElementById('chat-attach-btn').disabled = true;
    renderChatAttachmentQueue('Membaca lampiran secara lokal…');
    try {
      attachments = await prepareChatAttachments();
    } catch (error) {
      renderChatAttachmentQueue(error.message);
      return;
    } finally {
      composerPreparingAttachments = false;
      document.getElementById('btn-send-cmd').disabled = false;
      document.getElementById('chat-attach-btn').disabled = false;
    }
  }
  handleCommand(message, { attachments });
  commandInput.value = '';
  if (attachments.length) {
    queuedChatFiles = [];
    renderChatAttachmentQueue();
  }
}
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
  terminal: { label: 'OFFICE LOG & COMMAND BUS', title: 'OFFICE LOG' },
  team: { label: 'TEAM ROOM ALL OFFICERS', title: 'TEAM CHAT' },
  rama: { label: 'PRIVATE CHANNEL RAMA', title: 'RAMA CHAT' },
  budi: { label: 'PRIVATE CHANNEL BUDI', title: 'BUDI CHAT' },
  maya: { label: 'PRIVATE CHANNEL MAYA', title: 'MAYA CHAT' },
  dimas: { label: 'PRIVATE CHANNEL DIMAS', title: 'DIMAS CHAT' },
  siti: { label: 'PRIVATE CHANNEL SITI', title: 'SITI CHAT' },
};
const speechBubble = document.getElementById('agent-speech-bubble');
const speechText = document.getElementById('speech-text');
const speechSender = document.getElementById('speech-sender');
const rosterGrid = document.getElementById('roster-grid');
const quickActionsBar = document.querySelector('.quick-actions-bar');

[chatTabs, quickActionsBar, rosterGrid].forEach(el => {
    el?.addEventListener('wheel', event => {
        if (el.scrollWidth <= el.clientWidth) return;
        const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        if (!delta) return;
        event.preventDefault();
        el.scrollLeft += delta;
      }, { passive: false });
});
const activeHeading = document.getElementById('active-agent-heading');
const profileName = document.getElementById('profile-name');

let selectedAgent = AGENTS[0];
let bubbleTimer = null;
let activeModel = localStorage.getItem('kra-model') || '';
let activeProvider = localStorage.getItem('kra-chat-provider') || '';
let activeWorkspaceRoot = localStorage.getItem('kra-workspace-root') || '';
const chatProviderSelect = document.getElementById('chat-provider-select');
const creatorStudioProviderSelect = document.getElementById('creator-studio-provider');
let availableChatProviders = [];
let reactModeEnabled = localStorage.getItem('kra-react-mode') === 'on';
let humorModeEnabled = localStorage.getItem('kra-humor-mode') !== 'off';
const reactToggle = document.getElementById('btn-react-toggle');
const humorToggle = document.getElementById('btn-humor-toggle');

function updateReactToggle() {
  if (!reactToggle) return;
  reactToggle.querySelector('.toggle-label').textContent = reactModeEnabled ? 'ReAct ON' : 'ReAct OFF';
  reactToggle.setAttribute('aria-pressed', reactModeEnabled ? 'true' : 'false');
  reactToggle.classList.toggle('active', reactModeEnabled);
}
function updateHumorToggle() {
  if (!humorToggle) return;
  humorToggle.querySelector('.toggle-label').textContent = humorModeEnabled ? 'Humor ON' : 'Humor OFF';
  humorToggle.setAttribute('aria-pressed', humorModeEnabled ? 'true' : 'false');
  humorToggle.classList.toggle('active', humorModeEnabled);
}

function syncCreatorStudioProviderOptions() {
  if (!creatorStudioProviderSelect) return;
  creatorStudioProviderSelect.replaceChildren();
  const providerBadge = document.getElementById('creator-studio-provider-badge');
  if (!availableChatProviders.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No live AI provider';
    creatorStudioProviderSelect.appendChild(option);
    creatorStudioProviderSelect.disabled = true;
    if (providerBadge) {
      providerBadge.textContent = 'PROVIDER OFFLINE';
      providerBadge.classList.add('is-offline');
    }
    return;
  }
  availableChatProviders.forEach(provider => {
    const option = document.createElement('option');
    option.value = provider.id;
    option.textContent = provider.id === '9router' ? '9Router' : provider.id.charAt(0).toUpperCase() + provider.id.slice(1);
    creatorStudioProviderSelect.appendChild(option);
  });
  creatorStudioProviderSelect.value = availableChatProviders.some(provider => provider.id === activeProvider)
    ? activeProvider : availableChatProviders[0].id;
  creatorStudioProviderSelect.disabled = false;
  if (providerBadge) {
    providerBadge.textContent = 'LIVE AI · NO SIMULATOR';
    providerBadge.classList.remove('is-offline');
  }
}

async function loadChatProviders() {
  if (!chatProviderSelect) return;
  try {
    const response = await fetch('../api/index.php?action=providers');
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'Provider list unavailable');
    const providers = Object.entries(payload.config?.providers || {})
      .filter(([id, provider]) => id !== 'simulator' && provider.configured)
      .map(([id, provider]) => ({ id, ...provider }));
    availableChatProviders = providers;
    chatProviderSelect.replaceChildren();
    if (!providers.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No live AI';
      chatProviderSelect.appendChild(option);
      chatProviderSelect.disabled = true;
      activeProvider = '';
      syncCreatorStudioProviderOptions();
      return;
    }
    providers.forEach(provider => {
      const option = document.createElement('option');
      option.value = provider.id;
      const providerLabel = provider.id === '9router'
        ? '9Router' : provider.id.charAt(0).toUpperCase() + provider.id.slice(1);
      option.textContent = provider.preview ? providerLabel + ' (preview mock)' : providerLabel;
      option.title = provider.model || provider.id;
      chatProviderSelect.appendChild(option);
    });
    const configuredDefault = payload.config?.defaultProvider || '';
    const requested = providers.some(provider => provider.id === activeProvider)
      ? activeProvider
      : providers.some(provider => provider.id === configuredDefault)
        ? configuredDefault
        : providers.some(provider => provider.id === '9router') ? '9router' : providers[0].id;
    activeProvider = requested;
    chatProviderSelect.value = requested;
    chatProviderSelect.disabled = false;
    localStorage.setItem('kra-chat-provider', requested);
    syncCreatorStudioProviderOptions();
  } catch (error) {
    availableChatProviders = [];
    chatProviderSelect.replaceChildren();
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Provider offline';
    chatProviderSelect.appendChild(option);
    chatProviderSelect.disabled = true;
    syncCreatorStudioProviderOptions();
  }
}

chatProviderSelect?.addEventListener('change', () => {
  activeProvider = chatProviderSelect.value;
  activeModel = '';
  localStorage.setItem('kra-chat-provider', activeProvider);
  localStorage.removeItem('kra-model');
  chatLiveStatus.textContent = ' AI: ' + (chatProviderSelect.selectedOptions[0]?.textContent || 'selected');
  chatLiveStatus.classList.remove('offline');
  syncCreatorStudioProviderOptions();
});
loadChatProviders();

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
const output = activeChatChannel === 'terminal' ? sysLog : terminal;
output.appendChild(row);
output.scrollTop = output.scrollHeight;
}

function renderHandoffPacketCard(packet, agentId) {
  if (!packet) return;
  const card = document.createElement('div');
  card.className = 'handoff-packet-card';
  card.dataset.agent = agentId || 'jarvis';

  const header = document.createElement('div');
  header.className = 'packet-header';
  header.innerHTML = `
  <span class="packet-tag">AUTONOMOUS HANDOFF</span>
  <span class="packet-route">${escapeHtml(packet.from || 'agent')} ${escapeHtml(packet.to || 'agent')}</span>
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
const output = activeChatChannel === 'terminal' ? sysLog : terminal;
output.appendChild(card);
output.scrollTop = output.scrollHeight;
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
  agentBubble(agent, kind.toUpperCase() + ' autonomous loop', 'task', 2600);
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
      if (activeChatChannel === 'team' && reactModeEnabled) {
        termLine('[Jarvis]: Team remains a live group broadcast; use a private agent tab for ReAct actions.', 'info');
      }
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
  sysLog.appendChild(div);
  if (persist) {
    fetch('../api/index.php?action=log-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sender: cls === 'user' ? 'User' : 'Jarvis',
            message: text,
            channel: 'terminal',
          }),
    }).catch(() => {});
  }
  sysLog.scrollTop = sysLog.scrollHeight;
}

const KRA_REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Reveal text progressively (terminal-style typing). Honors prefers-reduced-motion.
function typeIntoElement(el, text, onTick) {
  if (KRA_REDUCED_MOTION) { el.textContent = text; if (onTick) onTick(); return Promise.resolve(); }
  return new Promise(resolve => {
    let i = 0;
    const step = () => {
      i = Math.min(text.length, i + 3);
      el.textContent = text.slice(0, i) + (i < text.length ? '\u258d' : '');
      if (onTick) onTick();
      if (i < text.length) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
}

// Animated "..." line in the Log while a task is processing. Returns a stop() fn that removes it.
function startTermSpinner(text, cls) {
  const div = document.createElement('div');
  div.className = 'term-line ' + (cls || 'info');
  let currentText = text;
  div.textContent = currentText;
  sysLog.appendChild(div);
  sysLog.scrollTop = sysLog.scrollHeight;
  if (KRA_REDUCED_MOTION) {
    const stop = () => div.remove();
    stop.update = next => { currentText = String(next || text); div.textContent = currentText; };
    return stop;
  }
  let n = 0;
  const timer = setInterval(() => {
    div.textContent = currentText + ' ' + '.'.repeat((n++ % 3) + 1);
    sysLog.scrollTop = sysLog.scrollHeight;
  }, 400);
  const stop = () => { clearInterval(timer); div.remove(); };
  stop.update = next => { currentText = String(next || text); n = 0; div.textContent = currentText; };
  return stop;
}

function startStatusSpinner(element, label) {
  let n = 0;
  element.textContent = label;
  if (KRA_REDUCED_MOTION) return () => {};
  const timer = setInterval(() => {
    element.textContent = label + '.'.repeat((n++ % 3) + 1);
  }, 400);
  return () => clearInterval(timer);
}

/* --- Streaming runner: live coding via NDJSON events --- */
let runnerEventQueue = [];
let runnerDraining = false;
const runnerSleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function drainRunnerQueue() {
  if (runnerDraining) return;
  runnerDraining = true;
  const startedAt = performance.now();
  while (runnerEventQueue.length) {
    const ev = runnerEventQueue.shift();
    const div = document.createElement('div');
    div.className = 'term-line sys';
    if (ev.type === 'phase') {
      div.textContent = '[Runner]: ' + (ev.message || ev.name) + (ev.path ? ' ' + ev.path : '');
      if (!KRA_REDUCED_MOTION) await runnerSleep(250);
    } else {
      const pad = String(ev.number).padStart(3, '0');
      if (KRA_REDUCED_MOTION) {
        div.textContent = pad + ' | ' + ev.text;
      } else {
        sysLog.appendChild(div);
        sysLog.scrollTop = sysLog.scrollHeight;
        await typeIntoElement(div, pad + ' | ' + ev.text, () => {
          sysLog.scrollTop = sysLog.scrollHeight;
        });
        await runnerSleep(20);
        continue;
      }
    }
    sysLog.appendChild(div);
    sysLog.scrollTop = sysLog.scrollHeight;
    if (!KRA_REDUCED_MOTION && performance.now() - startedAt < 8000) {
      await runnerSleep(180);
    }
  }
  runnerDraining = false;
}

async function readRunnerStream(response) {
  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    let message = text || ('HTTP ' + response.status);
    try { message = JSON.parse(text).error || message; } catch (_) {}
    throw new Error('Runner request failed: ' + message);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let donePayload = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: !done });
    let nl = buffer.indexOf('\n');
    while (nl !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      nl = buffer.indexOf('\n');
      if (!line) continue;
      let ev;
      try { ev = JSON.parse(line); }
      catch (_) { throw new Error('Runner returned an invalid progress event.'); }
      if (ev.type === 'done') { donePayload = ev; continue; }
      if (ev.type === 'error') throw new Error(ev.error || 'Runner failed');
      runnerEventQueue.push(ev);
      drainRunnerQueue();
    }
    if (done) break;
  }
  while (runnerDraining || runnerEventQueue.length) await runnerSleep(50);
  if (!donePayload || !donePayload.ok) {
    throw new Error((donePayload && donePayload.error) || 'Runner ended without result');
  }
  return donePayload;
}

async function loadChatHistory(channel) {
  try {
    const response = await fetch('../api/index.php?action=chat-history&channel=' + encodeURIComponent(channel));
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || 'History unavailable');
    
    if (channel === 'terminal') {
      sysLog.innerHTML = '';
      (payload.messages || []).forEach(m => {
          const div = document.createElement('div');
          div.className = 'term-line ' + (m.sender === 'User' ? 'user' : 'sys');
          div.textContent = (m.sender === 'User' ? '> ' : '') + m.message;
          sysLog.appendChild(div);
        });
      sysLog.scrollTop = sysLog.scrollHeight;
    } else {
      terminal.innerHTML = '';
      (payload.messages || []).forEach(message => {
          const msg = message.message || '';
          // Skip system logs from appearing as bubbles in history
          if (msg.includes('Laporan Audit') || msg.includes('Laporan Operasional') || msg.startsWith('[Jarvis]') || msg.startsWith('[Memory]') || msg.startsWith('[Runtime]')) {
             return;
          }
          appendChatBubble(
            message.sender,
            message.message,
            message.created_at || message.createdAt,
            message.sender === 'User'
          );
      });
      terminal.scrollTop = terminal.scrollHeight;
    }
} catch (error) {
chatLiveStatus.classList.add('offline');
chatLiveStatus.textContent = ' HISTORY OFFLINE';
}
}

function appendTermLine(text, cls) {
  const div = document.createElement('div');
  div.className = 'term-line ' + (cls || '');
  div.textContent = text;
  sysLog.appendChild(div);
  sysLog.scrollTop = sysLog.scrollHeight;
}

/* --- User Profile & Avatar --- */
let kraUserProfile = JSON.parse(localStorage.getItem('kra_user_profile') || 'null') || {
  displayName: kraActiveOfficer.display_name.split(' (')[0],
  avatar: 'char-rama',
  role: kraActiveOfficer.role === 'supervisor' ? 'Executive Boss' : 'Officer'
};

function saveUserProfile() {
  localStorage.setItem('kra_user_profile', JSON.stringify(kraUserProfile));
  updateHeaderProfile();
}

function updateHeaderProfile() {
  const nameEl = document.getElementById('header-user-name');
  const avatarEl = document.getElementById('header-user-avatar');
  const statusEl = document.querySelector('.profile-header-status');
  if (nameEl) nameEl.textContent = kraUserProfile.displayName;
  if (avatarEl) {
    avatarEl.className = 'user-header-avatar ' + kraUserProfile.avatar;
    const displayName = String(kraUserProfile.displayName || 'User').trim();
    avatarEl.dataset.initial = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'U';
  }
  if (statusEl) statusEl.textContent = kraUserProfile.role;
}

const profileModal = document.getElementById('profile-modal');
const btnUserProfile = document.getElementById('btn-user-profile');
const profileAvatarGrid = document.getElementById('profile-avatar-grid');

btnUserProfile?.addEventListener('click', () => {
  document.getElementById('profile-display-name').value = kraUserProfile.displayName;
  document.getElementById('profile-role').value = kraUserProfile.role;
  document.getElementById('profile-avatar-preview').className = 'chat-avatar large-avatar ' + kraUserProfile.avatar;

  profileAvatarGrid.querySelectorAll('.char-card').forEach(card => {
    card.classList.toggle('active', card.dataset.char === kraUserProfile.avatar.replace('char-', ''));
  });

  profileModal.classList.remove('hidden');
});

profileAvatarGrid?.querySelectorAll('.char-card').forEach(card => {
  card.addEventListener('click', () => {
    profileAvatarGrid.querySelectorAll('.char-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    const char = card.dataset.char;
    document.getElementById('profile-avatar-preview').className = 'chat-avatar large-avatar char-' + char;
  });
});

document.getElementById('profile-btn-save')?.addEventListener('click', () => {
  const name = document.getElementById('profile-display-name').value.trim();
  const role = document.getElementById('profile-role').value.trim();
  const selected = profileAvatarGrid.querySelector('.char-card.active');
  if (name) {
    kraUserProfile.displayName = name;
    kraUserProfile.role = role || 'Officer';
    if (selected) kraUserProfile.avatar = 'char-' + selected.dataset.char;
    saveUserProfile();
    profileModal.classList.add('hidden');
    termLine('[System]: Profile updated.', 'sys');
  }
});

document.getElementById('profile-btn-close')?.addEventListener('click', () => profileModal.classList.add('hidden'));
document.getElementById('profile-btn-cancel')?.addEventListener('click', () => profileModal.classList.add('hidden'));

updateHeaderProfile();

function chatTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function agentForSender(sender) {
  return AGENTS.find(agent => agent.name === sender)
    || (typeof creatorAgents !== 'undefined' ? creatorAgents.find(agent => agent.name === sender || agent.id === sender) : null)
    || AGENTS[0];
}

function appendChatBubble(sender, message, timestamp, isUser = false, options = {}) {
  const agent = isUser ? null : agentForSender(sender);
  const agentId = isUser ? (kraUserProfile.avatar.replace('char-', '')) : (agent.id || sender.toLowerCase());
  const row = document.createElement('div');
  row.className = 'chat-message ' + (isUser ? 'chat-message-user' : 'chat-message-agent')
    + (options.error ? ' chat-message-provider-error' : '');
  row.setAttribute('data-agent', agentId);

  const msgRow = document.createElement('div');
  msgRow.className = 'chat-row';

  const avatar = document.createElement('div');
  avatar.className = 'chat-avatar char-' + agentId;
  avatar.title = isUser ? kraUserProfile.displayName : (agent ? agent.name : sender);
  if (!isUser && typeof creatorAgents !== 'undefined' && creatorAgents.some(item => item.id === agentId)) {
    avatar.innerHTML = agentAvatarMarkup(agent);
  }

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';

  if (!isUser) {
    const name = document.createElement('span');
    name.className = 'chat-sender';
    name.textContent = (agent ? agent.name : sender).toUpperCase();
    bubble.appendChild(name);
  }

  const content = document.createElement('span');
  content.className = 'chat-content';
  bubble.appendChild(content);
  if (isUser || KRA_REDUCED_MOTION) {
    content.textContent = message;
  } else {
    typeIntoElement(content, message, () => { terminal.scrollTop = terminal.scrollHeight; });
  }
  if (isUser && Array.isArray(options.attachments) && options.attachments.length) {
    const attachmentList = document.createElement('div');
    attachmentList.className = 'chat-message-attachments';
    options.attachments.forEach(item => {
      const label = document.createElement('span');
      label.className = 'chat-message-attachment';
      label.textContent = (item.kind === 'image' ? '▧ ' : item.mimeType === 'application/pdf' ? 'PDF ' : 'FILE ') + item.name;
      if (item.kind === 'image' && item.dataUrl) {
        const thumbnail = document.createElement('img');
        thumbnail.src = item.dataUrl;
        thumbnail.alt = item.name;
        thumbnail.loading = 'lazy';
        attachmentList.appendChild(thumbnail);
      }
      attachmentList.appendChild(label);
    });
    bubble.appendChild(attachmentList);
  }

  const time = document.createElement('time');
  time.className = 'chat-time';
  const label = isUser ? kraUserProfile.displayName.toUpperCase() : (agent ? agent.name.toUpperCase() : sender.toUpperCase());
  time.textContent = label + ' \u00b7 ' + chatTime(timestamp);
  bubble.appendChild(time);

  if (isUser) {
    msgRow.appendChild(bubble);
    msgRow.appendChild(avatar);
  } else {
    msgRow.appendChild(avatar);
    msgRow.appendChild(bubble);
  }

  row.appendChild(msgRow);
  terminal.appendChild(row);
  terminal.scrollTop = terminal.scrollHeight;
}

function appendThinkingBubble(sender, thinking) {
  // Show a short activity cue, never raw private reasoning text.
  return appendThinkingIndicator(sender, thinking || 'Thinking');
}

function appendThinkingIndicator(sender, label = 'Thinking') {
  const agent = agentForSender(sender);
  const row = document.createElement('div');
  row.className = 'chat-message chat-message-agent chat-thinking';
  row.setAttribute('aria-live', 'polite');
  const msgRow = document.createElement('div');
  msgRow.className = 'chat-row';
  const avatar = document.createElement('div');
  avatar.className = 'chat-avatar char-' + String(agent.id || 'jarvis');
  avatar.setAttribute('aria-hidden', 'true');
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  const name = document.createElement('span');
  name.className = 'chat-sender';
  name.textContent = String(sender || 'Jarvis');
  const text = document.createElement('span');
  text.className = 'chat-thinking-label';
  text.textContent = String(label);
  const dots = document.createElement('span');
  dots.className = 'thinking-dots';
  dots.setAttribute('aria-hidden', 'true');
  dots.textContent = '•••';
  bubble.append(name, text, dots);
  msgRow.append(avatar, bubble);
  row.appendChild(msgRow);
  terminal.appendChild(row);
  terminal.scrollTop = terminal.scrollHeight;
  const stop = () => row.remove();
  stop.update = (nextLabel) => { text.textContent = String(nextLabel || 'Thinking'); };
  return stop;
}

const placeholders = {
  team: 'Message the team, @mention an officer, or attach a file…',
  rama: 'Ask Rama a question or attach a reference file…',
  budi: 'Ask Budi to create something or attach a brief…',
  maya: 'Ask Maya to edit the selected project or analyze a file…',
  dimas: 'Ask Dimas to inspect something or attach evidence…',
  siti: 'Ask Siti about operations or attach a report…',
  creator_research: 'Ask Nara to research a topic or verify sources…',
  creator_writer: 'Ask Aruna to draft a script or metadata…',
  creator_producer: 'Ask Dito for a storyboard or production plan…',
  creator_reviewer: 'Ask Lintang to review accuracy and readiness…',
};

function registerHiredChatChannel(agent) {
  if (!agent || !agent.id || chatChannels[agent.id]) return;
  const name = String(agent.name || agent.id).toUpperCase();
  chatChannels[agent.id] = {
    label: 'PRIVATE CHANNEL ' + name,
    title: name + ' CHAT',
  };
  if (!chatTabs || document.querySelector('.chat-tab[data-channel="' + CSS.escape(agent.id) + '"]')) return;
  const tab = document.createElement('button');
  tab.className = 'chat-tab hired-chat-tab';
  tab.dataset.channel = agent.id;
  tab.setAttribute('role', 'tab');
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('class', 'ui-icon');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>';
  const label = document.createElement('span');
  label.textContent = name;
  tab.append(icon, label);
  tab.addEventListener('click', () => switchChatChannel(agent.id));
  chatTabs.appendChild(tab);
}

function switchChatChannel(channel) {
  if (!chatChannels[channel]) return;
  activeChatChannel = channel;

  const isTerminal = channel === 'terminal';
  terminal.classList.toggle('hidden', isTerminal);
  sysLog.classList.toggle('hidden', !isTerminal);

  if (isTerminal) {
    chatChannelLabel.textContent = chatChannels.terminal.label;
    terminalChannelTitle.textContent = chatChannels.terminal.title + ' /dev/kra-bus';
    chatLiveStatus.textContent = ' LIVE AI CHAT';
    document.querySelectorAll('.chat-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.channel === 'terminal');
      });
  commandInput.placeholder = 'Chat with Rama, ask about current topics, or use /command…';
  loadChatHistory('terminal').then(() => {
    if (activeChatChannel !== 'terminal') return;
    appendTermLine('Terminal is both a live conversation with Rama and a safe command console.', 'sys');
    appendTermLine('Current weather, news, and other real-time questions request web research; they are not sent to shell.', 'prompt');
    appendTermLine('Shell processes require explicit /run plus human confirmation. Plain text is always chat.', 'info');
  });
  return;
}
const info = chatChannels[channel];
document.querySelectorAll('.chat-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.channel === channel);
    tab.setAttribute('aria-selected', tab.dataset.channel === channel ? 'true' : 'false');
  });
chatChannelLabel.textContent = info.label;
terminalChannelTitle.textContent = info.title + ' /dev/kra-bus';
chatLiveStatus.classList.remove('offline');
chatLiveStatus.textContent = ' LIVE';

if (placeholders[channel]) {
  commandInput.placeholder = placeholders[channel];
}

const focusAgent = AGENTS.find(a => a.id === channel);
if (focusAgent) {
  selectedAgent = focusAgent;
  activeHeading.textContent = 'Agent: ' + focusAgent.name;
  profileName.textContent = focusAgent.name + ' ' + focusAgent.role;
  document.querySelectorAll('.roster-card').forEach(c =>
    c.classList.toggle('active', c.dataset.id === channel));
  drawPortrait();
} else if (typeof creatorAgents !== 'undefined' && creatorAgents.some(agent => agent.id === channel)) {
  const creatorAgent = creatorAgents.find(agent => agent.id === channel);
  activeHeading.textContent = 'Creator Specialist: ' + creatorAgent.name;
  profileName.textContent = creatorAgent.name + ' · ' + creatorAgent.role;
  document.querySelectorAll('.roster-card').forEach(card => card.classList.remove('active'));
} else if (channel === 'team') {
selectedAgent = AGENTS[0];
activeHeading.textContent = 'Team Console: All Officers';
profileName.textContent = 'Rama & Field Agents Virtual Office Floor';
document.querySelectorAll('.roster-card').forEach(c =>
  c.classList.remove('active'));
drawPortrait();
}

loadChatHistory(channel);
}

function appendAgentMessage(result, channel = activeChatChannel) {
  if (channel !== activeChatChannel) return;
  chatLiveStatus.classList.remove('offline');
  chatLiveStatus.textContent = ' LIVE ' + (result.provider || 'AI');
  playSfx('reply');
  const replies = Array.isArray(result.replies) ? result.replies : [result];
  replies.forEach(reply => {
    const msg = reply.message || '';
    if (msg.includes('Laporan Audit') || msg.includes('Laporan Operasional') || msg.startsWith('[Jarvis]') || msg.startsWith('[Memory]')) {
      termLine(msg, 'sys');
      return;
    }
    if (channel === 'terminal') {
      appendTermLine('[' + (reply.sender || 'Rama') + ']: ' + msg, reply.error ? 'warn' : 'sys');
      if (reply.proposal) {
        termLine('[Approval Gate]: Proposal prepared; review before execution.', 'prompt');
        openProposalFromChat(reply.proposal, reply.agentId);
      }
      return;
    }
    appendChatBubble(reply.sender, msg, new Date(), false, { error: Boolean(reply.error) });
    const speakingAgent = AGENTS.find(agent => agent.name.toLowerCase() === (reply.sender || '').toLowerCase());
    if (speakingAgent && !reply.error) {
      setAgentState(speakingAgent, AGENT_STATES.COMMUNICATING, 'communicating');
      agentBubble(speakingAgent, msg.slice(0, 42), 'speech', 4800);
      setTimeout(() => {
        if (!speakingAgent.activityBusy && speakingAgent.state === AGENT_STATES.COMMUNICATING) {
          setAgentState(speakingAgent, AGENT_STATES.IDLE, 'standing by');
        }
      }, 4800);
    }
    if (reply.error && speakingAgent) {
      setAgentState(speakingAgent, AGENT_STATES.BLOCKED, 'AI provider unavailable');
    }
    if (reply.proposal) {
      playSfx('gated');
      termLine('[Approval Gate]: Proposal prepared; review before execution.', 'prompt');
      if (speakingAgent) {
        setAgentState(speakingAgent, AGENT_STATES.WAITING_APPROVAL, 'waiting approval');
        agentBubble(speakingAgent, 'Proposal waiting approval', 'task', 6000);
      }
      openProposalFromChat(reply.proposal, reply.agentId);
    }
  });
}

function appendChatActionPoint(message, buttonLabel, action) {
  const card = document.createElement('div');
  card.className = 'chat-action-point';
  const text = document.createElement('div');
  text.textContent = message;
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = buttonLabel;
  button.addEventListener('click', action, { once: true });
  card.append(text, button);
  const output = activeChatChannel === 'terminal' ? sysLog : terminal;
  output.appendChild(card);
  output.scrollTop = output.scrollHeight;
}

async function consumeChatAgentResponse(response, channel, onReply) {
  if (!response.ok) {
    let payload = {};
    try { payload = await response.json(); } catch (_) {}
    throw new Error(payload.error || 'AI chat request failed');
  }
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json') || !response.body?.getReader) {
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || 'AI provider unavailable');
    (result.replies || [result]).forEach(reply => onReply(reply, result.provider));
    return result;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let doneEvent = null;
  const processLine = line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const event = JSON.parse(trimmed);
    if (event.type === 'reply') onReply(event.reply, event.reply?.provider || event.provider);
    else if (event.type === 'done') doneEvent = event;
    else if (event.type === 'error') throw new Error(event.error || 'AI chat stream failed');
  };
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    lines.forEach(processLine);
    if (done) break;
  }
  if (buffer.trim()) processLine(buffer);
  if (!doneEvent?.ok) throw new Error(doneEvent?.error || 'AI chat stream ended before completion');
  return doneEvent;
}

function addProviderRetryAction(message, channel, retryState, attachments = []) {
  if (retryState.shown) return;
  retryState.shown = true;
  if (!availableChatProviders.length) {
    appendChatActionPoint(
      'Belum ada provider AI live yang dikonfigurasi. Aktifkan 9Router atau Ollama agar tim bisa menjawab dengan model nyata.',
      'OPEN PROVIDER SETUP',
      () => window.open('../docs/BYOK_PROVIDER_SETUP.md', '_blank', 'noopener,noreferrer')
    );
    return;
  }
  const nextProvider = availableChatProviders.find(provider => provider.id !== activeProvider)
    || availableChatProviders[0];
  const label = nextProvider.id === '9router' ? '9Router' : nextProvider.id;
  appendChatActionPoint(
    'Provider ' + (activeProvider || 'AI') + ' tidak merespons. Coba provider lain?',
    'RETRY WITH ' + label.toUpperCase(),
    () => {
      activeProvider = nextProvider.id;
      if (chatProviderSelect) chatProviderSelect.value = activeProvider;
      localStorage.setItem('kra-chat-provider', activeProvider);
      if (channel === activeChatChannel) sendAgentChat(message, { appendUser: false, retryShown: true, attachments });
    }
  );
}

function providerNeedsConsent(providerId) {
  const provider = availableChatProviders.find(item => item.id === providerId);
  if (!provider?.baseUrl) return true;
  try {
    const host = new URL(provider.baseUrl).hostname.toLowerCase();
    return !['localhost', '127.0.0.1', '::1'].includes(host);
  } catch (_) {
    return true;
  }
}

function isCurrentInfoQuestion(message) {
  return /\b(?:cuaca|weather|forecast|ramalan|berita|news|terbaru|latest|sekarang|saat ini|hari ini|today|right now|current|real[- ]time|kurs|exchange rate|harga saham|stock price)\b/i.test(String(message || ''));
}

async function sendAgentChat(message, options = {}) {
  const channel = activeChatChannel;
  const consentKey = 'kra-chat-provider-consent:' + activeProvider;
  if (!options.consentChecked && providerNeedsConsent(activeProvider)
    && sessionStorage.getItem(consentKey) !== 'yes') {
    const providerName = chatProviderSelect?.selectedOptions[0]?.textContent || activeProvider || 'AI provider';
    appendChatActionPoint(
      ((options.attachments || []).length
        ? 'This message, its ' + options.attachments.length + ' attachment(s), and recent ' + channel + ' chat context'
        : 'This message and recent ' + channel + ' chat context') + ' will be sent to ' + providerName + '. Continue?',
      'ALLOW & SEND TO ' + providerName.toUpperCase(),
      () => {
        sessionStorage.setItem(consentKey, 'yes');
        sendAgentChat(message, { ...options, consentChecked: true });
      }
    );
    return;
  }
  const attachments = Array.isArray(options.attachments) ? options.attachments : [];
  const shouldResearchLiveInfo = isCurrentInfoQuestion(message) && attachments.length === 0;
  const shouldUseReact = attachments.length === 0 && (
    shouldResearchLiveInfo || (reactModeEnabled && channel !== 'terminal' && channel !== 'team')
  );
  if (shouldUseReact) {
    await sendReActChat(message);
    return;
  }
  playSfx('send');
  if (channel === 'terminal' && attachments.length) {
    appendTermLine('[Attachments]: ' + attachments.map(item => item.name).join(', '), 'info');
  }
  if (options.appendUser !== false && channel !== 'terminal') appendChatBubble(kraUserProfile.displayName, message, new Date(), true, { attachments });
  const stopChatSpinner = startStatusSpinner(chatLiveStatus, ' THINKING');
  const thinkingAgent = AGENTS.find(a => a.id === channel) || AGENTS[0];
  const stopThinking = channel === 'terminal'
    ? startTermSpinner('[' + thinkingAgent.name + ']: Waiting for live AI reply', 'info')
    : appendThinkingIndicator(channel === 'team' ? 'Rama' : thinkingAgent.name, 'Waiting for live AI reply');
  const retryState = { shown: Boolean(options.retryShown) };
  agentEventBus.emit('user.message.sent', 'user', { channel, message });
  if (channel === 'team') {
    AGENTS.forEach(agent => {
      setAgentState(agent, AGENT_STATES.THINKING, 'replying in group');
      agentBubble(agent, 'Thinking...', 'task', 3000);
    });
  } else if (thinkingAgent) {
    setAgentState(thinkingAgent, AGENT_STATES.THINKING, 'processing prompt');
    agentBubble(thinkingAgent, 'Thinking...', 'task', 3500);
  }

  try {
    const response = await fetch('../api/index.php?action=chat-agent&stream=1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel,
        message,
        model: activeModel,
        provider: activeProvider,
        projectRoot: activeWorkspaceRoot,
        attachments,
      }),
    });
    await consumeChatAgentResponse(response, channel, (reply, provider) => {
      appendAgentMessage({ replies: [reply], provider }, channel);
      if (reply?.error) addProviderRetryAction(message, channel, retryState, attachments);
    });
    if (typeof stopChatSpinner === 'function') stopChatSpinner();
    stopThinking();
    if (channel === activeChatChannel) chatLiveStatus.textContent = ' LIVE ' + (activeProvider || 'AI');
  } catch (error) {
    if (typeof stopChatSpinner === 'function') stopChatSpinner();
    stopThinking();
    if (channel === activeChatChannel) {
      chatLiveStatus.classList.add('offline');
      chatLiveStatus.textContent = ' AI OFFLINE';
      addProviderRetryAction(message, channel, retryState, attachments);
    }
    if (channel === 'team') {
      AGENTS.forEach(agent => setAgentState(agent, AGENT_STATES.IDLE, 'standing by'));
    } else if (thinkingAgent) {
      setAgentState(thinkingAgent, AGENT_STATES.BLOCKED, 'bridge offline');
    }
  }
}

async function sendReActChat(message) {
  playSfx('send');
  if (activeChatChannel !== 'terminal') appendChatBubble(kraUserProfile.displayName, message, new Date(), true);
  const agentId = activeChatChannel === 'team' ? 'budi' : activeChatChannel === 'terminal' ? 'rama' : activeChatChannel;
  const reactAgent = AGENTS.find(item => item.id === agentId) || AGENTS[0];
  const stopStatus = startStatusSpinner(chatLiveStatus, ' REACT THINKING');
  const stopThinking = activeChatChannel === 'terminal'
    ? startTermSpinner('[Rama]: Planning next action', 'info')
    : appendThinkingIndicator(reactAgent.name, 'Planning next action');
  animateReactAgent(agentId, 'reasoning');
  try {
    const response = await fetch('../api/index.php?action=react-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          channel: activeChatChannel,
          message,
          maxTurns: 6,
          chainHandoff: true,
          provider: activeProvider,
          model: activeModel,
        }),
      });
  const result = await response.json();
  if (!result.ok) throw new Error(result.error || 'ReAct engine unavailable');

  let stagedTask = null;
  const trace = result.trace || [];
  for (let traceIndex = 0; traceIndex < trace.length; traceIndex++) {
    const step = trace[traceIndex];
    const stepAgent = step.agent || agentId;
    stopThinking.update('Working through step ' + (traceIndex + 1) + ' of ' + trace.length);
    await new Promise(resolve => setTimeout(resolve, KRA_REDUCED_MOTION ? 0 : 130));
    // Show action/observation summaries, not private raw chain-of-thought.
    if (step.thought && !step.action) appendReactCard('thought', 'Evaluating the safest next step…', stepAgent);
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
  appendReactCard('action', 'handoff ' + nextAgent, stepAgent);
  animateReactAgent(nextAgent, 'handoff');
}
  }
  stopStatus();
  stopThinking();
  chatLiveStatus.textContent = ' REACT FINALIZING';

if (result.budget) {
  const b = result.budget;
  const bText = 'Turns: ' + (result.turns || 1) + ' Tools: ' + (b.toolCalls || 0)
  + ' Reads: ' + (b.reads || 0) + ' (' + (b.readBytes || 0) + 'B) Handoffs: ' + (b.handoffs || 0)
  + ' Stop: ' + (result.stopReason || 'completed');
  appendReactCard('budget', bText, result.agentId || agentId);
  updateAutonomyBudgetMeters(result);
}

const creatorSpeaker = typeof creatorAgents !== 'undefined'
  ? creatorAgents.find(item => item.id === activeChatChannel) : null;
const speaker = creatorSpeaker || AGENTS.find(item => item.id === (result.agentId || agentId));
const sender = speaker ? speaker.name : 'Jarvis';
const finalAnswer = result.finalAnswer || 'ReAct loop completed.';
if (activeChatChannel === 'terminal') appendTermLine('[' + sender + ']: ' + finalAnswer, 'sys');
else appendChatBubble(sender, finalAnswer, new Date());
chatLiveStatus.textContent = ' REACT ' + (result.provider || 'local');
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
stopStatus();
stopThinking();
chatLiveStatus.classList.add('offline');
chatLiveStatus.textContent = ' REACT OFFLINE';
termLine('[Jarvis]: ReAct engine unavailable ' + error.message, 'warn');
}
}

function openProposalFromChat(proposal, agentId) {
  proposeTask(
    agentId,
    proposal.actionType,
    proposal.title,
    proposal.targetFile,
    proposal.proposedContent,
    proposal.summary,
    proposal.projectRoot || null
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

function agentAvatarMarkup(agent = {}) {
  const validHex = value => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : '#6f9a7d';
  const key = String(agent.id || agent.name || 'agent').replace(/[^a-z0-9_-]/gi, '').slice(0, 24) || 'agent';
  const primary = validHex(agent.palette?.primary || agent.palette?.accent);
  const accent = validHex(agent.palette?.accent || primary);
  const skin = agent.appearance?.body === 'broad_deep' ? '#a96f54'
    : agent.appearance?.body === 'tall_olive' ? '#c18e6e'
      : agent.appearance?.body === 'android_synth' ? '#a6b7af' : '#d7a887';
  const hair = agent.appearance?.hair === 'tech_crop_brown' ? '#58463a'
    : agent.appearance?.hair === 'hijab_emerald' ? '#2d7359'
      : String(agent.appearance?.character || '').toLowerCase() === 'maya' ? '#49342e' : '#392c2a';
  const scarf = agent.appearance?.hair === 'hijab_emerald';
  const beard = agent.appearance?.face === 'beard_mustache';
  const dark = primary === '#ffffff' ? '#718579' : primary;
  return `<svg class="agent-avatar-art" viewBox="0 0 96 96" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="bg-${key}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${accent}" stop-opacity=".32"/><stop offset="1" stop-color="#f3f6ef"/></linearGradient>
      <linearGradient id="shirt-${key}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${primary}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
      <linearGradient id="skin-${key}" x1="0" y1="0" x2=".9" y2="1"><stop stop-color="#f0c4a0"/><stop offset="1" stop-color="${skin}"/></linearGradient>
      <linearGradient id="hair-${key}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${hair}"/><stop offset="1" stop-color="#241f1e"/></linearGradient>
    </defs>
    <circle cx="48" cy="48" r="48" fill="url(#bg-${key})"/>
    <ellipse cx="48" cy="92" rx="39" ry="29" fill="#294a38" opacity=".13"/>
    <path d="M12 96c2-19 13-30 36-30s34 11 36 30H12Z" fill="url(#shirt-${key})"/>
    <path d="m39 65 9 10 9-10-4-7H43l-4 7Z" fill="url(#skin-${key})"/>
    ${scarf ? `<path d="M24 43c0-19 10-30 24-30s24 11 24 30v24c-4 10-14 17-24 17S28 77 24 67V43Z" fill="url(#hair-${key})"/>` : `<path d="M27 43c0-20 8-30 21-30 15 0 23 12 22 32-2-6-7-10-12-13-8 4-17 5-30 4l-1 7Z" fill="url(#hair-${key})"/>`}
    <ellipse cx="48" cy="47" rx="17.5" ry="22" fill="url(#skin-${key})"/>
    ${scarf ? `<path d="M29 39c3-14 10-22 19-22 10 0 17 8 19 22-7-6-11-10-15-15-6 7-14 12-23 15Z" fill="url(#hair-${key})"/>` : `<path d="M30 39c2-15 9-23 18-23 11 0 17 8 19 22-8-3-13-8-17-13-5 7-12 11-20 14Z" fill="url(#hair-${key})"/>`}
    <path d="M39 47h4m10 0h4" stroke="#47372f" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="41" cy="49" r="1.35" fill="#28372e"/><circle cx="55" cy="49" r="1.35" fill="#28372e"/>
    <path d="M48 50v7" stroke="#b87962" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>
    ${beard ? `<path d="M37 57c4 2 7 3 11 3s8-1 11-3c-1 8-5 12-11 12s-10-4-11-12Z" fill="url(#hair-${key})"/>` : `<path d="M43 61c3 2 7 2 10 0" stroke="#a86859" stroke-width="1.8" fill="none" stroke-linecap="round"/>`}
    <path d="M44 76h8l-4 13-4-13Z" fill="#f1f1e9" opacity=".88"/>
    <path d="M48 77v12" stroke="${accent}" stroke-width="2.5" opacity=".9"/>
    <circle cx="75" cy="21" r="5" fill="${accent}" opacity=".85"/>
  </svg>`;
}

let rosterDrawerAutoHideTimer = null;
let rosterDrawerPinnedOpen = false;

function setRosterDrawerOpen(open, pinned = false) {
  const drawer = document.getElementById('agent-roster-drawer');
  const button = document.getElementById('btn-roster-drawer');
  const content = document.getElementById('agent-roster-content');
  if (!drawer || !button || !content) return;
  rosterDrawerPinnedOpen = Boolean(open && pinned);
  drawer.classList.toggle('is-open', Boolean(open));
  drawer.dataset.open = String(Boolean(open));
  button.setAttribute('aria-expanded', String(Boolean(open)));
  button.setAttribute('aria-label', open ? 'Hide office crew' : 'Show office crew');
  content.setAttribute('aria-hidden', String(!open));
  content.inert = !open;
}

function scheduleRosterDrawerHide(delay = 900) {
  window.clearTimeout(rosterDrawerAutoHideTimer);
  const drawer = document.getElementById('agent-roster-drawer');
  if (rosterDrawerPinnedOpen || drawer?.contains(document.activeElement)) return;
  rosterDrawerAutoHideTimer = window.setTimeout(() => setRosterDrawerOpen(false), delay);
}

function initAgentRosterDrawer() {
  const drawer = document.getElementById('agent-roster-drawer');
  const button = document.getElementById('btn-roster-drawer');
  if (!drawer || !button || drawer.dataset.initialized === 'true') return;
  drawer.dataset.initialized = 'true';

  drawer.addEventListener('pointerenter', () => {
    if (rosterDrawerPinnedOpen) return;
    setRosterDrawerOpen(true);
    scheduleRosterDrawerHide(4600);
  });
  drawer.addEventListener('pointermove', () => {
    if (drawer.classList.contains('is-open') && !rosterDrawerPinnedOpen) scheduleRosterDrawerHide(4600);
  });
  drawer.addEventListener('pointerleave', () => scheduleRosterDrawerHide(650));
  drawer.addEventListener('focusin', event => {
    if (event.target === button) return;
    window.clearTimeout(rosterDrawerAutoHideTimer);
    setRosterDrawerOpen(true, true);
  });
  drawer.addEventListener('focusout', () => {
    window.setTimeout(() => {
      if (!drawer.contains(document.activeElement)) {
        rosterDrawerPinnedOpen = false;
        setRosterDrawerOpen(false);
      }
    }, 0);
  });
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    const isOpen = drawer.classList.contains('is-open');
    const shouldOpen = !isOpen || !rosterDrawerPinnedOpen;
    window.clearTimeout(rosterDrawerAutoHideTimer);
    setRosterDrawerOpen(shouldOpen, shouldOpen);
  });
  document.addEventListener('pointerdown', event => {
    if (!drawer.contains(event.target) && !rosterDrawerPinnedOpen) setRosterDrawerOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && drawer.classList.contains('is-open')) {
      window.clearTimeout(rosterDrawerAutoHideTimer);
      setRosterDrawerOpen(false);
      button.focus();
    }
  });
}

function closeAgentRosterDrawer() {
  window.clearTimeout(rosterDrawerAutoHideTimer);
  rosterDrawerPinnedOpen = false;
  setRosterDrawerOpen(false);
}

function buildRoster() {
  rosterGrid.innerHTML = '';
  AGENTS.forEach(a => {
      const card = document.createElement('div');
      card.className = 'roster-card' + (a.id === selectedAgent.id ? ' active' : '')
      + (a.id.startsWith('agent-') ? ' hired-agent-card' : '');
      const accent = /^#[0-9a-f]{6}$/i.test(String(a.palette?.accent || '')) ? a.palette.accent : '#4ECDC4';
      card.style.setProperty('--agent-accent', accent);
      card.dataset.id = a.id;
      card.innerHTML = `
      <div class="card-avatar-box" aria-hidden="true">${agentAvatarMarkup(a)}<i class="agent-presence-dot"></i></div>
      <div class="card-info">
      <div class="card-name-row">
      <span class="card-name"></span>
      <span class="card-badge"></span>
      </div>
      <div class="card-role"></div>
      </div>`;
      card.querySelector('.card-name').textContent = String(a.name || a.id);
      const badge = card.querySelector('.card-badge');
      const badgeKind = String(a.badge || '').replace(/[^a-z0-9_-]/gi, '');
      if (badgeKind) badge.classList.add(badgeKind);
      badge.textContent = 'FL ' + (Number(a.floorId) || 1) + ' ' + String(a.status || 'standing by');
      card.querySelector('.card-role').textContent = String(a.role || 'Agent');
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
  activeRoomId = roomAtPosition(a.x, a.y, a.floorId || activeFloor)?.id || null;
  updateRoomDirectory();
activeHeading.textContent = (a.id === 'rama' ? 'Boss Console: Rama' : 'Agent: ' + a.name);
profileName.textContent = a.name + ' - ' + a.role;
document.querySelectorAll('.roster-card').forEach(c =>
  c.classList.toggle('active', c.dataset.id === id));
drawPortrait();
switchChatChannel(a.id);
closeAgentRosterDrawer();
showBubble(a.name, a.intro.replace(/^[^:]+:\s*/, ''), 4600);
termLine('[focus] ' + a.name + ' selected ' + a.role, 'info');
}

/* --- Pilar 3: waypoint movement and collision-safe routes --- */
const OFFICE_WAYPOINTS = {
  corridorWest: { x: 4.5, y: 10 }, corridorCenter: { x: 20, y: 10 },
  corridorEast: { x: 34.5, y: 10 }, meeting: { x: 14.5, y: 15.5 },
  rama: { x: 14.5, y: 4.2 }, budi: { x: 14.5, y: 15.5 },
  maya: { x: 24.5, y: 4.2 }, dimas: { x: 34.5, y: 15.5 }, siti: { x: 3.5, y: 15.5 }
};
function isWalkableTileForAgent(agent, tileX, tileY) {
  if (tileX < 0 || tileX >= MAP.w || tileY < 0 || tileY >= MAP.h) return false;
  if (!floor[tileY] || !floor[tileY][tileX] || floor[tileY][tileX] === '#3B2A1D') return false;
  if (deco[tileY][tileX] && deco[tileY][tileX] !== 'elevator' && !isSittableItem(deco[tileY][tileX]) && !String(deco[tileY][tileX]).startsWith('halltile')) return false;
  if (atlasOccupancyAt(agent.floorId || activeFloor, tileX, tileY)) return false;
  const agentFloor = agent.floorId || activeFloor;
  return !AGENTS.some(other => other !== agent && (other.floorId || 1) === agentFloor
    && !other.inTransit && Math.floor(other.x) === tileX && Math.floor(other.y) === tileY);
}

function canTraverseRoomBoundary(fromX, fromY, toX, toY, floorId) {
  const defs = ROOM_DEFS[floorId] || [];
  const roomAtTile = (x, y) => defs.find(room => x >= room.x && x < room.x + room.w
    && y >= room.y && y < room.y + room.h) || null;
  const fromRoom = roomAtTile(fromX, fromY);
  const toRoom = roomAtTile(toX, toY);
  if (fromRoom && toRoom) return fromRoom.id === toRoom.id;
  const fromCorridor = fromY === CORRIDOR_Y || fromY === CORRIDOR_Y + 1;
  const toCorridor = toY === CORRIDOR_Y || toY === CORRIDOR_Y + 1;
  if (fromCorridor && toCorridor) return true;
  const room = fromRoom || toRoom;
  if (room && (fromCorridor || toCorridor)) {
    const doorwayTileX = Math.floor(roomDoorCenter(room));
    return fromX === toX && toX === doorwayTileX;
  }
  return false;
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
      if (!canTraverseRoomBoundary(current.x, current.y, next.x, next.y, agent.floorId || activeFloor)) continue;
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
  1: { x: 20, y: 10 },
  2: { x: 22, y: 10 }
};

function findElevatorApproach(agent, floorId) {
  const lift = ELEVATOR_WAYPOINTS[floorId];
  if (!lift) return null;
  const candidates = [];
  for (const y of [CORRIDOR_Y, CORRIDOR_Y + 1]) {
    for (let offset = 0; offset <= 5; offset += 1) {
      for (const direction of offset === 0 ? [0] : [-1, 1]) {
        const tileX = lift.x + offset * direction;
        if (tileX < 1 || tileX >= MAP.w - 1) continue;
        candidates.push({ x: tileX + 0.5, y: y + 0.5 });
      }
    }
  }
  candidates.sort((a, b) => Math.hypot(a.x - lift.x, a.y - lift.y) - Math.hypot(b.x - lift.x, b.y - lift.y));
  for (const point of candidates) {
    const path = findWalkPath(agent, point.x, point.y);
    if (path.length) return { point, path };
  }
  return null;
}

function transitAgentToFloor(agent, destinationFloor, thenFn) {
  if (!agent || agent.inTransit || destinationFloor === (agent.floorId || 1)) {
    thenFn && thenFn();
    return;
  }
  const originFloor = agent.floorId || 1;
  const originLift = ELEVATOR_WAYPOINTS[originFloor];
  const destinationLift = ELEVATOR_WAYPOINTS[destinationFloor];
  if (!originLift || !destinationLift) {
    termLine('[Lift]: Floor route is not configured for this destination.', 'warn');
    return;
  }
  setAgentState(agent, AGENT_STATES.MOVING, 'walking to elevator');
  let retries = 0;
  const maxRetries = 6;
  const failTransit = () => {
    agent.pathTarget = null;
    setAgentState(agent, AGENT_STATES.IDLE, 'elevator route blocked');
    agentBubble(agent, 'The lift route is busy; please try again.', 'alert', 2400);
    termLine('[Lift]: ' + agent.name + ' could not reach an open lift approach after several route checks.', 'warn');
  };
  const enterLift = () => {
    if (elevatorMotion) {
      window.setTimeout(enterLift, 250);
      return;
    }
    agent.x = originLift.x;
    agent.y = originLift.y;
    agent.inTransit = true;
    elevatorMotion = { active: true, fromFloor: originFloor, toFloor: destinationFloor, startedAt: performance.now(), agentId: agent.id };
    agent.facing = 'up';
    setAgentState(agent, AGENT_STATES.IN_TRANSIT, 'stepping into elevator');
    agentBubble(agent, 'Taking lift to Floor 0' + destinationFloor + '...', 'task', 1800);
    agentEventBus.emit('agent.floor.transit.started', agent.id, {
      fromFloor: originFloor, toFloor: destinationFloor, waypoint: originLift
    });
    persistPresence(agent);
    window.setTimeout(() => {
      agent.floorId = destinationFloor;
      elevatorMotion = null;
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
    }, 1500);
  };
  const routeToLift = () => {
    const approach = findElevatorApproach(agent, originFloor);
    if (!approach) {
      retries += 1;
      if (retries <= maxRetries) { window.setTimeout(routeToLift, 350); return; }
      failTransit();
      return;
    }
    let retryScheduled = false;
    const retryRoute = () => {
      if (retryScheduled) return;
      retryScheduled = true;
      retries += 1;
      if (retries <= maxRetries) window.setTimeout(routeToLift, 250);
      else failTransit();
    };
    const started = walkPath(agent, approach.point.x, approach.point.y, enterLift, retryRoute);
    if (!started) retryRoute();
  };
  routeToLift();
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
const dur = Math.max(300, dist * (agent.recreationBuffUntil > performance.now() ? 208 : 260));
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

let pendingProjectCreation = null;
let projectPathMode = 'create';
let projectPathSelectCallback = null;
const projectPathModal = document.getElementById('project-path-modal');

async function requestProjectPath(mode, params = {}) {
  const query = new URLSearchParams({ action: 'project-path', mode, ...params });
  const response = await fetch('../api/index.php?' + query.toString());
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(payload.error || 'Path request failed');
  return payload;
}

async function showProjectPathGate(name, userPrompt) {
  projectPathMode = 'create';
  pendingProjectCreation = { name, userPrompt };
  const intent = document.getElementById('project-path-intent');
  const input = document.getElementById('project-path-input');
  const target = document.getElementById('project-path-target');
  const targetLabel = document.getElementById('project-path-target-label');
  const summary = document.getElementById('project-path-summary');
  const status = document.getElementById('project-path-status');
  const confirm = document.getElementById('project-path-confirm');
  intent.textContent = 'New project: ' + name;
  summary.textContent = 'New applications are created outside the KRA folder. Confirm the target location before any file is written.';
  target.value = 'index.php';
  target.classList.remove('hidden');
  targetLabel.classList.remove('hidden');
  confirm.textContent = '✔ USE THIS LOCATION';
  status.textContent = 'Checking location...';
  projectPathModal.classList.remove('hidden');
  try {
    const result = await requestProjectPath('suggest', { name });
    input.value = result.suggested;
    await validateProjectPathInput();
    await browseProjectPath(result.projectsRoot);
  } catch (error) {
    status.textContent = 'Unable to load project paths: ' + error.message;
  }
}

async function showAuditFolderPicker(onSelect = null) {
  projectPathSelectCallback = typeof onSelect === 'function' ? onSelect : null;
  projectPathMode = 'select-folder';
  const intent = document.getElementById('project-path-intent');
  const input = document.getElementById('project-path-input');
  const target = document.getElementById('project-path-target');
  const targetLabel = document.getElementById('project-path-target-label');
  const summary = document.getElementById('project-path-summary');
  const status = document.getElementById('project-path-status');
  const confirm = document.getElementById('project-path-confirm');
  intent.textContent = 'Focus Repository / Folder';
  summary.textContent = 'Select directory focus for Rama audit, task execution, and agent operations.';
  target.classList.add('hidden');
  targetLabel.classList.add('hidden');
  confirm.textContent = '✔ SELECT FOLDER';
  confirm.disabled = false;
  status.textContent = 'Choose folder...';
  status.className = 'path-status is-valid';
  
  const currentTarget = document.getElementById('audit-target').value.trim();
  const startDir = currentTarget === '.' ? '' : currentTarget;
  projectPathModal.classList.remove('hidden');
  try {
    const result = await requestProjectPath('browse', { dir: startDir });
    input.value = result.dir;
    await browseProjectPath(result.dir);
  } catch (error) {
    status.textContent = 'Error: ' + error.message;
  }
}

async function validateProjectPathInput() {
  if (projectPathMode === 'select-folder') {
    const input = document.getElementById('project-path-input');
    const status = document.getElementById('project-path-status');
    const confirm = document.getElementById('project-path-confirm');
    const val = input.value.trim();
    if (!val) {
      status.textContent = 'Folder path cannot be empty.';
      status.className = 'path-status is-invalid';
      confirm.disabled = true;
      return false;
    }
    status.textContent = 'Selected folder: ' + val;
    status.className = 'path-status is-valid';
    confirm.disabled = false;
    return true;
  }
  const input = document.getElementById('project-path-input');
  const status = document.getElementById('project-path-status');
  const confirm = document.getElementById('project-path-confirm');
  status.textContent = 'Checking location...';
  confirm.disabled = true;
  try {
    const result = await requestProjectPath('check', { path: input.value.trim() });
    const messages = [...(result.reasons || []), ...(result.warnings || [])];
    status.textContent = messages.join(' ') || 'Location is outside KRA and ready.';
    status.dataset.valid = result.ok ? 'true' : 'false';
    status.classList.toggle('is-invalid', !result.ok);
    status.classList.toggle('is-valid', result.ok);
    confirm.disabled = !result.ok || !document.getElementById('project-path-target').value.trim();
    return result.ok;
  } catch (error) {
    status.textContent = error.message;
    status.dataset.valid = 'false';
    status.classList.add('is-invalid');
    return false;
  }
}

async function browseProjectPath(dir) {
  const list = document.getElementById('project-path-list');
  const current = document.getElementById('project-path-current');
  list.replaceChildren();
  try {
    const result = await requestProjectPath('browse', { dir });
    current.textContent = result.dir;
    current.dataset.parent = result.parent || '';
    for (const entry of result.dirs || []) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'path-entry';
      button.textContent = entry;
      button.title = 'Open ' + entry;
      button.addEventListener('click', () => {
        const next = result.dir.replace(/[\\/]+$/, '') + '/' + entry;
        document.getElementById('project-path-input').value = next;
        validateProjectPathInput();
        browseProjectPath(next);
      });
      list.append(button);
    }
    if (!result.dirs || result.dirs.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'path-empty';
      empty.textContent = 'No subfolders';
      list.append(empty);
    }
  } catch (error) {
    current.textContent = error.message;
  }
}

const workspaceModal = document.getElementById('workspace-modal');
const workspaceProjectSelect = document.getElementById('workspace-project-select');
const workspaceTree = document.getElementById('workspace-tree');
const workspaceEditor = document.getElementById('workspace-editor');
const workspaceStatus = document.getElementById('workspace-status');
let activeWorkspaceFile = '';
let workspaceFileRequestId = 0;

async function workspaceRequest(action, params = {}) {
  const query = new URLSearchParams({ action, ...params });
  const response = await fetch('../api/index.php?' + query.toString());
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.error || 'Workspace request failed');
  return payload;
}

function workspaceLabelForRoot(root) {
  const parts = String(root).split(/[\\/]+/).filter(Boolean);
  return (parts.at(-1) || root) + ' — ' + root;
}

async function populateWorkspaceDirectory(root, relativePath, container, depth = 0) {
  container.replaceChildren();
  try {
    const result = await workspaceRequest('workspace-files', { root, path: relativePath });
    if (root !== activeWorkspaceRoot) return;
    const entries = result.entries || [];
    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'workspace-tree-empty';
      empty.textContent = 'No visible files or folders';
      container.appendChild(empty);
      return;
    }
    entries.forEach(entry => {
      if (entry.kind === 'directory') {
        const row = document.createElement('div');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'workspace-tree-directory';
        button.style.paddingInlineStart = (7 + depth * 12) + 'px';
        button.textContent = '▸ ' + entry.name + '/';
        const children = document.createElement('div');
        children.hidden = true;
        let loaded = false;
        button.addEventListener('click', async () => {
          const opening = children.hidden;
          children.hidden = !opening;
          button.textContent = (opening ? '▾ ' : '▸ ') + entry.name + '/';
          if (opening && !loaded) {
            loaded = true;
            await populateWorkspaceDirectory(root, entry.path, children, depth + 1);
          }
        });
        row.append(button, children);
        container.appendChild(row);
        return;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'workspace-tree-file';
      button.style.paddingInlineStart = (21 + depth * 12) + 'px';
      button.textContent = '▧ ' + entry.name;
      button.title = entry.path + (entry.size == null ? '' : ' · ' + entry.size + ' bytes');
      button.addEventListener('click', async () => {
        const requestId = ++workspaceFileRequestId;
        workspaceTree.querySelectorAll('.workspace-tree-file').forEach(node => node.classList.remove('active'));
        button.classList.add('active');
        workspaceStatus.textContent = 'Reading ' + entry.path + '…';
        workspaceEditor.value = '';
        workspaceEditor.disabled = true;
        try {
          const payload = await workspaceRequest('workspace-read', { root, path: entry.path });
          if (requestId !== workspaceFileRequestId || root !== activeWorkspaceRoot) return;
          activeWorkspaceFile = payload.path;
          document.getElementById('workspace-file-path').textContent = payload.path;
          workspaceEditor.value = payload.content || '';
          workspaceEditor.disabled = false;
          document.getElementById('workspace-request-change').disabled = false;
          workspaceStatus.textContent = 'Read-only · ' + payload.size + ' bytes';
        } catch (error) {
          if (requestId !== workspaceFileRequestId) return;
          activeWorkspaceFile = '';
          document.getElementById('workspace-file-path').textContent = 'File unavailable';
          workspaceEditor.value = '';
          workspaceEditor.disabled = false;
          document.getElementById('workspace-request-change').disabled = true;
          workspaceStatus.textContent = error.message;
        }
      });
      container.appendChild(button);
    });
    if (result.truncated) {
      const note = document.createElement('div');
      note.className = 'workspace-tree-empty';
      note.textContent = 'List capped at 300 entries';
      container.appendChild(note);
    }
  } catch (error) {
    const notice = document.createElement('div');
    notice.className = 'workspace-tree-empty';
    notice.textContent = error.message;
    container.appendChild(notice);
    workspaceStatus.textContent = error.message;
  }
}

async function selectWorkspaceRoot(root) {
  const normalized = String(root || '').trim();
  activeWorkspaceRoot = normalized;
  localStorage.setItem('kra-workspace-root', normalized);
  activeWorkspaceFile = '';
  workspaceFileRequestId++;
  workspaceEditor.value = '';
  workspaceEditor.disabled = false;
  document.getElementById('workspace-file-path').textContent = 'No file selected';
  document.getElementById('workspace-request-change').disabled = true;
  workspaceTree.replaceChildren();
  workspaceStatus.textContent = normalized ? 'Loading project files…' : 'Choose a project to inspect its files.';
  if (!normalized) return;
  await populateWorkspaceDirectory(normalized, '', workspaceTree);
  if (activeWorkspaceRoot === normalized) workspaceProjectSelect.value = normalized;
}

async function openProjectWorkspace() {
  workspaceModal.classList.remove('hidden');
  workspaceStatus.textContent = 'Loading projects…';
  try {
    const payload = await workspaceRequest('tasks');
    const entries = Array.isArray(payload.tasks) ? payload.tasks : Object.values(payload.tasks || {});
    const roots = [...new Set(entries
      .filter(task => ['EXECUTED', 'WAITING_APPROVAL'].includes(task.status) && task.projectRoot)
      .map(task => String(task.projectRoot)))];
    if (activeWorkspaceRoot && !roots.includes(activeWorkspaceRoot)) roots.unshift(activeWorkspaceRoot);
    workspaceProjectSelect.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = roots.length ? 'Choose a project…' : 'No task projects yet';
    workspaceProjectSelect.appendChild(placeholder);
    roots.forEach(root => {
      const option = document.createElement('option');
      option.value = root;
      option.textContent = workspaceLabelForRoot(root);
      workspaceProjectSelect.appendChild(option);
    });
    const selected = roots.includes(activeWorkspaceRoot) ? activeWorkspaceRoot : roots[0] || '';
    if (selected) await selectWorkspaceRoot(selected);
    else {
      activeWorkspaceRoot = '';
      localStorage.removeItem('kra-workspace-root');
      workspaceTree.replaceChildren();
      workspaceStatus.textContent = 'No project from an approved task. Use OPEN FOLDER to select one.';
    }
  } catch (error) {
    workspaceStatus.textContent = 'Unable to load projects: ' + error.message;
  }
}

document.getElementById('open-workspace-btn').addEventListener('click', openProjectWorkspace);
document.getElementById('workspace-close').addEventListener('click', () => workspaceModal.classList.add('hidden'));
workspaceProjectSelect.addEventListener('change', () => selectWorkspaceRoot(workspaceProjectSelect.value));
document.getElementById('workspace-refresh').addEventListener('click', async () => {
  if (activeWorkspaceRoot) await selectWorkspaceRoot(activeWorkspaceRoot);
});
document.getElementById('workspace-browse-project').addEventListener('click', () => {
  workspaceModal.classList.add('hidden');
  showAuditFolderPicker(async root => {
    workspaceModal.classList.remove('hidden');
    let option = [...workspaceProjectSelect.options].find(item => item.value === root);
    if (!option) {
      option = document.createElement('option');
      option.value = root;
      option.textContent = workspaceLabelForRoot(root);
      workspaceProjectSelect.appendChild(option);
    }
    await selectWorkspaceRoot(root);
  });
});
document.getElementById('workspace-request-change').addEventListener('click', () => {
  if (!activeWorkspaceRoot || !activeWorkspaceFile) return;
  const prompt = '@Maya ubah file ' + activeWorkspaceFile + ': ';
  workspaceModal.classList.add('hidden');
  switchChatChannel('team');
  commandInput.value = prompt;
  commandInput.focus();
  workspaceStatus.textContent = 'Team Chat siap membuat proposal. File belum diubah.';
});
document.getElementById('workspace-editor').addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') event.preventDefault();
});

function closeProjectPathGate() {
  projectPathModal.classList.add('hidden');
  pendingProjectCreation = null;
  projectPathSelectCallback = null;
}

document.getElementById('project-path-input').addEventListener('change', validateProjectPathInput);
document.getElementById('project-path-input').addEventListener('blur', validateProjectPathInput);
document.getElementById('project-path-target').addEventListener('input', validateProjectPathInput);
document.getElementById('project-path-up').addEventListener('click', () => {
  const parent = document.getElementById('project-path-current').dataset.parent;
  if (parent) browseProjectPath(parent);
});
document.getElementById('project-path-reload').addEventListener('click', () => {
  browseProjectPath(document.getElementById('project-path-current').textContent);
});
document.getElementById('project-path-close').addEventListener('click', closeProjectPathGate);
document.getElementById('project-path-cancel').addEventListener('click', closeProjectPathGate);
document.getElementById('project-path-confirm').addEventListener('click', async () => {
  if (projectPathMode === 'select-folder') {
    const selected = document.getElementById('project-path-input').value.trim();
    const onSelect = projectPathSelectCallback;
    projectPathSelectCallback = null;
    closeProjectPathGate();
    if (selected && onSelect) {
      await onSelect(selected);
      return;
    }
    if (selected) {
      document.getElementById('audit-target').value = selected;
      termLine('[Jarvis]: Audit focus set to: ' + selected, 'sys');
    }
    return;
  }
  if (!pendingProjectCreation || !(await validateProjectPathInput())) return;
  const { name, userPrompt } = pendingProjectCreation;
  const projectRoot = document.getElementById('project-path-input').value.trim();
  const targetFile = document.getElementById('project-path-target').value.trim();
  closeProjectPathGate();
  const budi = AGENTS.find(a => a.id === 'creator') || AGENTS[2];
  const onArrive = () => proposeWithModel(
    'creator', 'create', 'App: ' + name.slice(0, 30), targetFile,
    userPrompt, 'Budi drafted a new application. Review before approving.', projectRoot
  );
  if (!walkTo(budi, OFFICE_WAYPOINTS.budi.x, OFFICE_WAYPOINTS.budi.y, onArrive)) {
    termLine('[Jarvis]: Budi desk route blocked; generating directly.', 'warn');
    onArrive();
  }
});

async function proposeWithModel(agentId, actionType, title, targetFile, userPrompt, summary, projectRoot = null) {
  const agent = AGENTS.find(a => a.id === agentId);
  const agentName = agent ? agent.name : agentId.toUpperCase();
  const stopSpinner = startTermSpinner('[' + agentName + ']: Thinking & generating with AI model', 'info');

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
  stopSpinner();
  if (aiPayload.ok && aiPayload.result && aiPayload.result.content) {
    content = aiPayload.result.content;
    termLine('[' + agentName + ']: AI generation complete (' + aiPayload.result.provider + ' / ' + aiPayload.result.model + ').', 'prompt');
  } else {
  throw new Error(aiPayload.error || 'Model returned empty response');
}
} catch (err) {
  if (typeof stopSpinner === 'function') stopSpinner();
  termLine('[' + agentName + ']: Model unavailable (' + err.message + '). No placeholder task was created; configure a provider and retry.', 'warn');
  return;
}
if (!content.trim()) {
  termLine('[' + agentName + ']: Model returned empty content. No approval task was created.', 'warn');
  return;
}
proposeTask(agentId, actionType, title, targetFile, content, summary, projectRoot);
}

/* --- Step 3: Propose-then-Approve Gate --- */
let pendingTask = null;

const approvalModal = document.getElementById('approval-modal');

function appendDiffRow(container, kind, line, oldNumber, newNumber) {
  const row = document.createElement('div');
  row.className = 'diff-line diff-' + kind;
  const numbers = document.createElement('span');
  numbers.className = 'diff-line-numbers';
  numbers.textContent = (oldNumber || '') + ' ' + (newNumber || '');
  const marker = document.createElement('span');
  marker.className = 'diff-line-marker';
  marker.textContent = kind === 'added' ? '+' : kind === 'removed' ? '−' : ' ';
  const content = document.createElement('code');
  content.textContent = line || ' ';
  row.append(numbers, marker, content);
  container.appendChild(row);
}

function renderLineDiff(beforeText, afterText, container, info) {
  const beforeLines = beforeText === '' ? [] : beforeText.replace(/\r\n/g, '\n').split('\n');
  const afterLines = afterText.replace(/\r\n/g, '\n').split('\n');
  const rows = beforeLines.length + 1;
  const cols = afterLines.length + 1;
  const maxMatrixCells = 160000;
  const maxLinesPerSide = 3000;
  const maxRenderedRows = 3000;
  if (rows * cols > maxMatrixCells || beforeLines.length > maxLinesPerSide || afterLines.length > maxLinesPerSide) {
    info.textContent += ' Large change set: showing up to 1,500 removed and 1,500 proposed lines.';
    const shownBefore = beforeLines.slice(0, 1500);
    const shownAfter = afterLines.slice(0, 1500);
    shownBefore.forEach((line, index) => appendDiffRow(container, 'removed', line, index + 1, ''));
    shownAfter.forEach((line, index) => appendDiffRow(container, 'added', line, '', index + 1));
    if (beforeLines.length > shownBefore.length || afterLines.length > shownAfter.length) {
      appendDiffRow(container, 'same', `[Preview truncated: ${beforeLines.length - shownBefore.length} old and ${afterLines.length - shownAfter.length} proposed lines omitted]`, '', '');
    }
    return;
  }
  const matrix = Array.from({ length: rows }, () => new Uint32Array(cols));
  for (let i = beforeLines.length - 1; i >= 0; i--) {
    for (let j = afterLines.length - 1; j >= 0; j--) {
      matrix[i][j] = beforeLines[i] === afterLines[j]
        ? matrix[i + 1][j + 1] + 1
        : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  let oldNumber = 1;
  let newNumber = 1;
  let renderedRows = 0;
  while ((i < beforeLines.length || j < afterLines.length) && renderedRows < maxRenderedRows) {
    if (i < beforeLines.length && j < afterLines.length && beforeLines[i] === afterLines[j]) {
      appendDiffRow(container, 'same', beforeLines[i], oldNumber++, newNumber++);
      renderedRows++;
      i++; j++;
    } else if (i < beforeLines.length && (j >= afterLines.length || matrix[i + 1][j] >= matrix[i][j + 1])) {
      appendDiffRow(container, 'removed', beforeLines[i], oldNumber++, '');
      renderedRows++;
      i++;
    } else {
      appendDiffRow(container, 'added', afterLines[j], '', newNumber++);
      renderedRows++;
      j++;
    }
  }
  if (i < beforeLines.length || j < afterLines.length) {
    appendDiffRow(container, 'same', `[Preview truncated: ${beforeLines.length - i} old and ${afterLines.length - j} proposed lines omitted]`, '', '');
  }
}

async function renderApprovalDiff(task) {
  const container = document.getElementById('modal-diff-content');
  const info = document.getElementById('approval-diff-info');
  container.replaceChildren();
  const proposed = String(task.proposedContent || '');
  let before = '';
  if (task.actionType === 'modify') {
    info.textContent = 'Loading the current file to compare with this proposal…';
    try {
      const query = new URLSearchParams({ action: 'task-preview', taskId: task.id });
      const response = await fetch('../api/index.php?' + query.toString());
      const preview = await response.json();
      if (pendingTask?.id !== task.id) return;
      if (!response.ok || !preview.ok) throw new Error(preview.error || 'Current file preview unavailable');
      before = preview.workspaceAvailable === false || !preview.exists
        ? '' : String(preview.beforeContent || '');
      info.textContent = preview.workspaceAvailable === false
        ? 'Current app files are not exposed to the workspace preview; only the proposed content is shown.'
        : (preview.exists
          ? '− Current file  /  + Proposed file. Nothing is written until you approve.'
          : 'The target does not exist yet; this proposal will create a new file after approval.');
    } catch (error) {
      if (pendingTask?.id !== task.id) return;
      info.textContent = 'Could not load the current file: ' + error.message + '. Review the proposed content below.';
    }
  } else {
    info.textContent = '+ New file proposal. Nothing is written until you approve.';
  }
  renderLineDiff(before, proposed, container, info);
}

function showApprovalGate(task) {
  pendingTask = task;
  const execStatus = document.getElementById('modal-exec-status');
  execStatus.textContent = '';
  execStatus.classList.remove('offline');
  ['modal-btn-approve', 'modal-btn-reject', 'modal-btn-close'].forEach(id => {
    document.getElementById(id).disabled = false;
  });
  document.getElementById('modal-task-title').textContent = 'Approval Gate: ' + task.id;
  const proposingAgent = AGENTS.find(a => a.id === task.agentId);
  const proposingLabel = proposingAgent
  ? (proposingAgent.name + ' (' + proposingAgent.role + ')')
  : task.agentId.toUpperCase();
  document.getElementById('modal-agent-desc').textContent =
  'Proposed by: ' + proposingLabel + ' ' + task.actionType.toUpperCase();
  document.getElementById('modal-task-summary').textContent = task.summary;
  document.getElementById('modal-target-file').textContent = task.projectRoot
    ? ('Target: ' + task.targetFile + '  [outside KRA: ' + task.projectRoot + ']')
    : ('Target: ' + task.targetFile);
  approvalModal.classList.remove('hidden');
  renderApprovalDiff(task);

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

async function proposeTask(agentId, actionType, title, targetFile, proposedContent, summary, projectRoot = null) {
  const agent = AGENTS.find(a => a.id === agentId);
  const agentName = agent ? agent.name : agentId.toUpperCase();
  termLine('[' + agentName + ']: Preparing proposal ' + title, 'info');
  try {
    const body = JSON.stringify({
        agentId, actionType, title, targetFile, proposedContent, summary, projectRoot,
      });
  const response = await fetch('../api/index.php?action=propose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
const payload = await response.json();
if (!payload.ok) throw new Error(payload.error || 'Proposal failed');
termLine('[Jarvis]: Proposal ' + payload.task.id + ' is WAITING FOR YOUR APPROVAL.', 'warn');
allTasks[payload.task.id] = payload.task;
taskBoardActiveFilter = 'WAITING_APPROVAL';
showApprovalGate(payload.task);
if (!taskBoardModal.classList.contains('hidden')) renderTaskBoard();
} catch (error) {
termLine('[Jarvis]: Proposal unavailable ' + error.message, 'warn');
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
termLine('[Skills Hub]: Failed to apply skill change ' + error.message, 'warn');
await openSkillsHub();
}
return;
}

const execStatus = document.getElementById('modal-exec-status');
const btnApprove = document.getElementById('modal-btn-approve');
const btnReject = document.getElementById('modal-btn-reject');
const btnClose = document.getElementById('modal-btn-close');
btnApprove.disabled = true;
btnReject.disabled = true;
btnClose.disabled = true;

const phase = wasReject ? 'REJECTING TASK' : 'RUNNER EXECUTING';
const stopStatus = startStatusSpinner(execStatus, phase);
const stopTerm = startTermSpinner('[Runner]: ' + phase, wasReject ? 'warn' : 'info');
if (proposingAgent) setAgentState(proposingAgent, AGENT_STATES.WORKING, 'resolving task');
let payload;
try {
  if (wasReject) {
    const response = await fetch('../api/index.php?action=' + decision, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
    payload = await response.json();
  } else {
    const response = await fetch('../api/index.php?action=approve&stream=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
    payload = await readRunnerStream(response);
  }
  if (!payload.ok) throw new Error(payload.error || 'Action failed');
  if (payload.task && payload.task.id) {
    allTasks[payload.task.id] = payload.task;
    if (payload.task.status === 'EXECUTED' || payload.task.status === 'FAILED') {
      taskBoardActiveFilter = payload.task.status;
    }
    renderTaskBoard();
  }
stopStatus();
stopTerm();
if (wasReject) {
  execStatus.textContent = 'REJECTED';
  termLine('[Jarvis]: Task ' + taskId + ' REJECTED. No files were changed.', 'warn');
  hideApprovalGate();
  if (rama) agentBubble(rama, 'Verdict: REJECTED. Zero writes.', 'alert', 4000);
  if (proposingAgent) {
    setAgentState(proposingAgent, AGENT_STATES.RETURNING, 'proposal rejected');
    setTimeout(() => setAgentState(proposingAgent, AGENT_STATES.IDLE, 'standing by'), 2500);
  }
agentEventBus.emit('approval.rejected', 'user', { taskId }, task.agentId);
} else {
execStatus.textContent = 'EXECUTED';
const completedTask = payload.task || task;
termLine('[Jarvis]: Task ' + taskId + ' APPROVED and executed.', 'prompt');
if (completedTask.execution?.targetPath) {
  termLine('[Runner]: Output saved to ' + completedTask.execution.targetPath, 'sys');
}
if (completedTask.projectRoot) {
  termLine('[Next]: This approval completes one file. Use the CONTINUE APP action on this completed task to propose the next file; it will still require approval.', 'info');
  addTerminalContinueAction(completedTask);
} else {
  termLine('[Next]: This approved task is complete. Send another explicit task when you are ready; no files will be changed without approval.', 'info');
}
if (payload.task && payload.task.execution && payload.task.execution.output) {
  const runnerLine = document.createElement('div');
  runnerLine.className = 'term-line sys';
  sysLog.appendChild(runnerLine);
  sysLog.scrollTop = sysLog.scrollHeight;
  await typeIntoElement(runnerLine, '[Runner]: ' + payload.task.execution.output, () => {
    sysLog.scrollTop = sysLog.scrollHeight;
  });
  fetch('../api/index.php?action=log-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
          sender: 'Jarvis',
          message: '[Runner]: ' + payload.task.execution.output,
          channel: 'terminal',
        }),
    }).catch(() => {});
}
hideApprovalGate();
if (rama) agentBubble(rama, 'Verdict: APPROVED. Change written.', 'system', 4000);
if (proposingAgent) {
  setAgentState(proposingAgent, AGENT_STATES.WORKING, 'executed');
  agentBubble(proposingAgent, 'Execution complete!', 'task', 3500);
  setTimeout(() => setAgentState(proposingAgent, AGENT_STATES.IDLE, 'standing by'), 3500);
}
agentEventBus.emit('approval.granted', 'user', { taskId }, task.agentId);
}
} catch (error) {
stopStatus();
stopTerm();
execStatus.textContent = 'FAILED';
execStatus.classList.add('offline');
termLine('[Jarvis]: Could not resolve task ' + error.message, 'warn');
if (proposingAgent) setAgentState(proposingAgent, AGENT_STATES.BLOCKED, 'resolution failed');
setTimeout(() => {
  execStatus.classList.remove('offline');
  btnApprove.disabled = false;
  btnReject.disabled = false;
  btnClose.disabled = false;
}, 2000);
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

let cachedSkillsHub = null;

function renderSkillsHub(hub, filterText = '') {
  cachedSkillsHub = hub;
  const agents = (hub && hub.agents) || [];
  const query = filterText.toLowerCase().trim();
  skillsHubContent.innerHTML = agents.map(agent => {
      const rows = (agent.skills || []).filter(skill => {
          if (!query) return true;
          return skill.id.toLowerCase().includes(query) || (skill.name || '').toLowerCase().includes(query);
      }).map(skill => {
          const disabled = !skill.approved || skill.id === 'antislop';
          const checked = skill.enabled ? ' checked' : '';
          const label = escapeHtml(skill.id) + (skill.approved ? '' : ' locked');
          const priority = Number.isFinite(Number(skill.priority)) ? Number(skill.priority) : 100;
          return '<label class="skills-row"><span>' + label + ' <small>p' + priority + '</small></span>'
          + '<input type="checkbox" data-agent="' + escapeHtml(agent.id) + '" data-skill="' + escapeHtml(skill.id) + '"'
          + checked + (disabled ? ' disabled' : '') + '></label>';
        }).join('');
    return '<section class="skills-agent-card"><h4>' + escapeHtml(agent.name) + '</h4>' + (rows || '<small style="color:var(--ink-400)">No matching skills</small>') + '</section>';
  }).join('');
  skillsHubContent.querySelectorAll('input[data-skill]').forEach(input => {
    input.addEventListener('change', () => toggleHubSkill(input));
  });
}

const skillsSearchInput = document.getElementById('skills-search-input');
if (skillsSearchInput) {
  skillsSearchInput.addEventListener('input', (e) => {
    if (cachedSkillsHub) {
      renderSkillsHub(cachedSkillsHub, e.target.value);
    }
  });
}

async function openSkillsHub() {
  if (!skillsModal || !skillsHubContent) return;
  skillsModal.classList.remove('hidden');
  skillsHubContent.textContent = 'Loading skill assignments ';
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

/* --- Phase 4: Task Board --- */
const taskBoardModal = document.getElementById('task-board-modal');
const taskListGrid = document.getElementById('task-list');
let taskBoardActiveFilter = 'WAITING_APPROVAL';
let taskBoardScope = 'office';
let allTasks = {};

function taskBoardEntries(tasks = allTasks) {
  return Array.isArray(tasks) ? tasks : Object.values(tasks || {});
}

function taskBoardScopeForTask(task) {
  return task?.context?.scope === 'creator' ? 'creator' : 'office';
}

function preferredTaskBoardFilter(tasks, scope = taskBoardScope) {
  const statuses = new Set(taskBoardEntries(tasks)
    .filter(task => taskBoardScopeForTask(task) === scope)
    .map(task => task.status));
  if (statuses.has('WAITING_APPROVAL')) return 'WAITING_APPROVAL';
  if (statuses.has('EXECUTED')) return 'EXECUTED';
  if (statuses.has('FAILED')) return 'FAILED';
  return 'WAITING_APPROVAL';
}

function renderTaskBoard() {
  if (!taskListGrid) return;
  const taskEntries = taskBoardEntries();
  const scopeTasks = taskEntries.filter(task => taskBoardScopeForTask(task) === taskBoardScope);
  const scopeLabel = taskBoardScope === 'creator' ? 'Content Creator' : 'Virtual Office';
  const heading = document.getElementById('task-board-heading');
  if (heading) heading.textContent = scopeLabel + ' // Task Board';
  document.querySelectorAll('[data-board-scope]').forEach(button => {
    const active = button.dataset.boardScope === taskBoardScope;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const tasks = scopeTasks
  .filter(t => t.status === taskBoardActiveFilter)
  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Update counts on tabs
  document.querySelectorAll('.task-tab').forEach(tab => {
      const filter = tab.dataset.filter;
      const count = scopeTasks.filter(t => t.status === filter).length;
      tab.textContent = (filter === 'WAITING_APPROVAL' ? 'Pending' : filter === 'EXECUTED' ? 'Completed' : 'Blocked') + ' (' + count + ')';
      tab.classList.toggle('active', filter === taskBoardActiveFilter);
    });

if (tasks.length === 0) {
  taskListGrid.innerHTML = '<div class="empty-state">No ' + escapeHtml(scopeLabel) + ' tasks match this filter. Switch the board scope to view the other workspace.</div>';
  return;
}

taskListGrid.innerHTML = tasks.map(task => {
    const agent = AGENTS.find(a => a.id === task.agentId);
    const agentName = agent ? agent.name : task.agentId.toUpperCase();
    const taskScope = taskBoardScopeForTask(task);
    const taskContext = taskScope === 'creator'
      ? 'CONTENT CREATOR · ' + (task.context.workflowTitle || 'Creator workflow') + (task.context.workflowNodeId ? ' · ' + task.context.workflowNodeId : '')
      : 'VIRTUAL OFFICE';
    return `
    <div class="task-item">
    <div class="task-context-badge task-context-${taskScope}">${escapeHtml(taskContext)}</div>
    <div class="task-header">
    <span class="task-id">${escapeHtml(task.id)} ${escapeHtml(agentName)}</span>
    <span class="task-status status-${escapeHtml(task.status)}">${escapeHtml(task.status)}</span>
    </div>
    <div class="task-title">${escapeHtml(task.title)}</div>
    <div class="task-summary">${escapeHtml(task.summary)}</div>
    <div class="task-actions">
    ${task.status === 'WAITING_APPROVAL' ? `<button type="button" class="small-btn kra-btn-primary" data-action="review" data-id="${escapeHtml(task.id)}">REVIEW</button>` : ''}
    ${task.status === 'EXECUTED' && task.projectRoot ? `<button type="button" class="small-btn continue-app-btn" data-action="continue-app" data-id="${escapeHtml(task.id)}">CONTINUE APP</button>` : ''}
    <button type="button" class="small-btn" data-action="copy-path" data-path="${escapeHtml(task.targetFile || '')}">Copy Path</button>
    </div>
    </div>
    `;
  }).join('');
}

taskListGrid?.addEventListener('click', async event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.dataset.action;
    if (action === 'continue-app') {
      const task = taskBoardEntries().find(item => item.id === target.dataset.id);
      if (task && task.status === 'EXECUTED' && task.projectRoot) {
        taskBoardModal.classList.add('hidden');
        openContinueAppModal(task, true);
      }
    } else if (action === 'review') {
      const taskId = target.dataset.id;
      const task = allTasks[taskId];
      if (task) {
        taskBoardModal.classList.add('hidden');
        showApprovalGate(task);
      }
  } else if (action === 'copy-path') {
  const filePath = target.dataset.path || '';
  if (!filePath) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(filePath);
    } else {
    const input = document.createElement('input');
    input.value = filePath;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
  }
termLine('[Clipboard]: Copied ' + filePath, 'sys');
} catch (err) {
termLine('[Clipboard]: Copy failed: ' + err.message, 'warn');
}
}
});

const continueAppModal = document.getElementById('continue-app-modal');
const continueAppForm = document.getElementById('continue-app-form');
let continueAppTask = null;
let continueAppReturnToBoard = false;

function openContinueAppModal(task, returnToBoard = false) {
  if (!task || task.status !== 'EXECUTED' || !task.projectRoot) return;
  continueAppTask = task;
  continueAppReturnToBoard = returnToBoard;
  document.getElementById('continue-app-project').textContent =
    'Project: ' + task.projectRoot + ' · Entry file: ' + (task.targetFile || 'unknown');
  document.getElementById('continue-app-file').value = 'assets/app.css';
  document.getElementById('continue-app-request').value = '';
  const status = document.getElementById('continue-app-status');
  status.textContent = 'Choose a new relative file. Changes still require approval before writing.';
  status.className = 'path-status';
  continueAppModal.classList.remove('hidden');
  document.getElementById('continue-app-file').focus();
}

function closeContinueAppModal(restoreCaller = true) {
  continueAppModal.classList.add('hidden');
  continueAppTask = null;
  if (restoreCaller && continueAppReturnToBoard) {
    taskBoardModal.classList.remove('hidden');
    renderTaskBoard();
  }
  continueAppReturnToBoard = false;
}

function normalizeContinueFilePath(value) {
  const path = String(value || '').trim().replace(/\\/g, '/');
  if (!path || path.startsWith('/') || /^[a-zA-Z]:/.test(path)
    || /[\\x00-\\x1f\\x7f]/.test(path)) return '';
  const segments = path.split('/');
  if (segments.some(part => !part || part === '.' || part === '..')) return '';
  return path;
}

function addTerminalContinueAction(task) {
  if (!task || !task.projectRoot || !sysLog) return;
  const row = document.createElement('div');
  row.className = 'term-line info term-action-row';
  const label = document.createElement('span');
  label.textContent = 'Ready for the next app file? ';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'small-btn continue-app-btn';
  button.textContent = 'CONTINUE APP';
  button.addEventListener('click', () => openContinueAppModal(task));
  row.append(label, button);
  sysLog.appendChild(row);
  sysLog.scrollTop = sysLog.scrollHeight;
}

continueAppForm.addEventListener('submit', event => {
  event.preventDefault();
  const task = continueAppTask;
  if (!task) return;
  const fileInput = document.getElementById('continue-app-file');
  const requestInput = document.getElementById('continue-app-request');
  const status = document.getElementById('continue-app-status');
  const targetFile = normalizeContinueFilePath(fileInput.value);
  const feature = requestInput.value.trim();
  if (!targetFile) {
    status.textContent = 'Enter a safe relative path, such as assets/app.css. Do not use absolute paths or .. segments.';
    status.className = 'path-status is-invalid';
    fileInput.focus();
    return;
  }
  if (!feature) {
    status.textContent = 'Describe what the next file should do before generating a proposal.';
    status.className = 'path-status is-invalid';
    requestInput.focus();
    return;
  }
  const submit = document.getElementById('continue-app-propose');
  submit.disabled = true;
  status.textContent = 'Preparing a new proposal. No file is changed until you approve it.';
  const prompt = 'Continue the previously approved standalone app. Its entry file is '
    + (task.targetFile || 'unknown') + '. Create only the new file ' + targetFile
    + ' for this requested next change: ' + feature
    + '. Return the complete contents for that file and do not claim to have edited other files.';
  const title = 'Continue app: ' + feature.slice(0, 36);
  closeContinueAppModal(false);
  proposeWithModel(task.agentId || 'creator', 'create', title, targetFile, prompt,
    'Next app file proposed from completed task ' + task.id + '. Review before approval.', task.projectRoot)
    .finally(() => { submit.disabled = false; });
});

document.getElementById('continue-app-close').addEventListener('click', () => closeContinueAppModal(true));
document.getElementById('continue-app-cancel').addEventListener('click', () => closeContinueAppModal(true));

async function openTaskBoard(scope = (document.body.classList.contains('creator-mode-active') ? 'creator' : 'office')) {
  if (!taskBoardModal) return;
  taskBoardScope = scope === 'creator' ? 'creator' : 'office';
  taskBoardModal.classList.remove('hidden');
  renderTaskBoard();
  try {
    const response = await fetch('../api/index.php?action=tasks');
    const payload = await response.json();
    if (payload.ok) {
      allTasks = payload.tasks || {};
      taskBoardActiveFilter = preferredTaskBoardFilter(allTasks, taskBoardScope);
      renderTaskBoard();
    }
} catch (error) {
termLine('[Jarvis]: Task board query failed: ' + error.message, 'warn');
}
}

document.getElementById('task-board-btn-close').addEventListener('click', () => taskBoardModal.classList.add('hidden'));
document.querySelectorAll('[data-board-scope]').forEach(button => {
  button.addEventListener('click', () => {
    taskBoardScope = button.dataset.boardScope === 'creator' ? 'creator' : 'office';
    taskBoardActiveFilter = preferredTaskBoardFilter(allTasks, taskBoardScope);
    renderTaskBoard();
  });
});
document.querySelectorAll('.task-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        taskBoardActiveFilter = tab.dataset.filter;
        renderTaskBoard();
      });
});

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
termLine('[Skills Hub]: Change rejected ' + error.message, 'warn');
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
        termLine('[' + f.severity + '] ' + location + ' ' + f.message, f.severity === 'Critical' ? 'warn' : 'info');
      });
  showBubble('Rama', audit.verdict === 'APPROVED' ? 'Approved. The work is clean.' : 'Needs revision. I found issues in the real files.', 5200);
} catch (error) {
termLine('[Rama]: Real audit unavailable ' + error.message, 'warn');
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
    termLine('[Jarvis]: Report saved ' + payload.reportFile, 'prompt');
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
      termLine('[Memory]: ' + m.file, 'prompt');
      termLine(' ' + m.excerpt, 'info');
    });
} catch (err) {
termLine('[Jarvis]: Memory recall error: ' + err.message, 'warn');
}
}

async function runTerminalCommand(command) {
  termLine('$ ' + command, 'prompt');
  chatLiveStatus.textContent = ' EXECUTING';
  try {
    const response = await fetch('../api/index.php?action=terminal-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    });
    const res = await response.json();
    if (!response.ok && !res.output) res.output = res.error || 'Command request rejected.';
  chatLiveStatus.textContent = ' COMMAND MODE';
  (res.output || '').split('\n').forEach(line => termLine(line, res.ok ? 'sys' : 'warn'));
} catch (err) {
chatLiveStatus.textContent = ' COMMAND MODE';
termLine('[Terminal]: Execution failed: ' + err.message, 'warn');
}
}

function handleCommand(raw, options = {}) {
  const cmd = raw.trim();
  if (!cmd) return;
  
  const lower = cmd.toLowerCase();
  
  // Auto-switch to terminal for slash commands
  if (cmd.startsWith('/') && activeChatChannel !== 'terminal') {
    switchChatChannel('terminal');
  }

  // Terminal tab shows raw stream; Team/Private tabs show chat bubbles
  if (activeChatChannel === 'terminal') {
    if (cmd.startsWith('/')) termLine('> ' + cmd, 'user');
    else appendTermLine('> ' + cmd, 'user');
  }

  if (lower === '/status' || lower === '/rama briefing') {
    termLine('[Jarvis]: Reading memory from vault ...', 'info');
    fetch('../api/index.php?action=vault-dashboard')
    .then(r => r.json())
    .then(memory => {
        if (memory.connected) {
          termLine('[Memory]: ' + memory.systemStatus + ' ' + memory.milestones + ' milestones.', 'sys');
          termLine('[Memory]: ' + memory.reports + ' dashboard report entries indexed.', 'info');
          showMilestoneTriggerReminder('status checkpoint');
        } else {
        termLine('[Memory]: Obsidian dashboard unavailable.', 'warn');
      }
    return fetch('../api/index.php?action=runtime');
  })
.then(r => r.json())
.then(runtime => {
    termLine('[Runtime]: PHP ' + runtime.php + ' MySQL ' + (runtime.database ? 'online' : 'offline'), 'sys');
    termLine('[Rama]: Briefing complete. Team is ready for assignment.', 'boss');
  })
.catch(error => termLine('[Jarvis]: Briefing unavailable ' + error.message, 'warn'));
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
        termLine(' - ' + name + ' (' + p.model + '): ' + state, p.configured ? 'prompt' : 'info');
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
  termLine('[Skills]: ' + entries.length + ' installed ' + approved + ' approved.', 'sys');
  entries.forEach(s => {
      const state = s.approved ? 'approved' : (s.drift ? 'drift' : (s.status || 'pending'));
      const pin = s.commit ? s.commit.slice(0, 8) : 'local';
      termLine(' - ' + s.id + ' [' + state + '] ' + (s.source || 'local') + ' @ ' + pin,
        s.approved ? 'prompt' : 'warn');
    });
if (agentId) {
  const active = (data.active || []).join(', ') || 'none';
  termLine('[Routing]: ' + agentId + ' mode ' + data.mode + ' active ' + active, 'info');
}
})
.catch(e => termLine('[Skills]: Query failed: ' + e.message, 'warn'));
return;
}

if (lower.startsWith('/rama review') || lower.startsWith('/review') || lower === '/audit workspace') {
  const targetInput = document.getElementById('audit-target');
  const target = targetInput && targetInput.value.trim() ? targetInput.value.trim() : '.';
  const rama = AGENTS.find(a => a.id === 'rama') || AGENTS[0];
  walkTo(rama, 6.6, 4.2, () => runRealAudit(target));
  return;
}

if (lower.startsWith('/audit')) {
  termLine('[Jarvis]: Dispatching Auditor Agent...', 'info');
  const dimas = AGENTS.find(a => a.id === 'auditor') || AGENTS[4];
  walkTo(dimas, 8.6, 12.1, () => {
      setTimeout(() => termLine('[Auditor]: Scanning workspace tree...', 'info'), 300);
      setTimeout(() => termLine('[Auditor]: 0 critical issues 3 warnings coverage 0%.', 'warn'), 1000);
      setTimeout(() => termLine('[Rama]: Noted. Auditor, file a report to the Dashboard.', 'boss'), 1600);
      setTimeout(() => termLine('[Jarvis]: Report linked to "Dashboard KRA Project.md".', 'sys'), 2200);
    });
return;
}

if (lower.startsWith('/create-app') || lower.startsWith('/new-app') || lower.startsWith('/bikin-aplikasi')) {
  const prompt = cmd.replace(/^\/(?:create-app|new-app|bikin-aplikasi)/i, '').trim() || 'Aplikasi Baru';
  termLine('[Jarvis]: Application creation requested. Opening Project Location Gate...', 'info');
  showProjectPathGate(prompt, prompt);
  return;
}

const naturalAppCreation = !cmd.startsWith('/')
  && /\b(?:buatkan|bikin|tolong buat|membuatkan|membangun|create|build|develop|generate|implement|make)\b/i.test(cmd)
  && /\b(?:aplikasi|web app|website|software|program|sistem|application|app)\b/i.test(cmd)
  && !/\b(?:cara|bagaimana|how to|apa itu|jelaskan|explain)\b/i.test(cmd);
if (naturalAppCreation) {
  termLine('[Jarvis]: Natural-language app request detected. Opening Project Location Gate...', 'info');
  showProjectPathGate(cmd, cmd);
  return;
}

if (lower.startsWith('/create')) {
  const prompt = cmd.slice('/create'.length).trim() || 'New KRA module';
  const looksLikeApp = /\b(?:aplikasi|app|system|sistem|proyek|project|cashflow|keuangan|pos|dashboard|crm|erp)\b/i.test(prompt);
  if (looksLikeApp) {
    termLine('[Jarvis]: App creation prompt detected. Opening Project Location Gate...', 'info');
    showProjectPathGate(prompt, prompt);
    return;
  }
  const targetFile = 'proposals/' + prompt.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '.txt';
  const budi = AGENTS.find(a => a.id === 'creator') || AGENTS[2];
  const onArrive = () => {
      proposeWithModel(
        'creator',
        'create',
        prompt,
        targetFile,
        prompt,
        'Budi (Creator) drafted a proposal. Review the content before approving.'
      );
  };
  if (!walkTo(budi, OFFICE_WAYPOINTS.budi.x, OFFICE_WAYPOINTS.budi.y, onArrive)) {
    termLine('[Jarvis]: Budi desk route blocked; generating directly.', 'warn');
    onArrive();
  }
return;
}

if (lower.startsWith('/modify')) {
  const spec = cmd.slice('/modify'.length).trim() || 'Targeted change requested';
  const maya = AGENTS.find(a => a.id === 'modifier') || AGENTS[3];
  const onArrive = () => {
      proposeWithModel(
        'modifier',
        'modify',
        'Modifier: ' + spec.slice(0, 30),
        'proposals/modifier-change.txt',
        spec,
        'Maya (Modifier) prepared a proposed change. Review before execution.'
      );
  };
  if (!walkTo(maya, OFFICE_WAYPOINTS.maya.x, OFFICE_WAYPOINTS.maya.y, onArrive)) {
    termLine('[Jarvis]: Maya desk route blocked; generating directly.', 'warn');
    onArrive();
  }
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
  const parts = cmd.split(' ').filter(p => p.trim());
  let a1 = AGENTS.find(a => a.id === 'creator');
  let a2 = AGENTS.find(a => a.id === 'modifier');
  if (parts.length >= 3) {
    a1 = AGENTS.find(a => a.id === parts[1] || a.name.toLowerCase() === parts[1].toLowerCase());
    a2 = AGENTS.find(a => a.id === parts[2] || a.name.toLowerCase() === parts[2].toLowerCase());
  }
if (!a1 || !a2 || a1 === a2) {
  termLine('[Jarvis]: Usage: /meeting [agent1] [agent2]. Participants not found.', 'warn');
  return;
}
if ((a1.floorId || 1) !== (a2.floorId || 1)) {
  transitAgentToFloor(a2, a1.floorId || 1, () => {
      startCollaborationScene(a1, a2, 'Meeting requested: ' + a1.name + ' & ' + a2.name, 'Understood. Initializing summit.');
    });
termLine('[Lift]: ' + a2.name + ' is moving to ' + a1.name + '\'s floor.', 'info');
return;
}
startCollaborationScene(a1, a2, 'Meeting requested: ' + a1.name + ' & ' + a2.name, 'Understood. Initializing summit.');
termLine('[Jarvis]: Collaboration scene started for ' + a1.name + ' and ' + a2.name + '.', 'info');
return;
}

if (lower === '/tasks' || lower === '/task board') {
  openTaskBoard();
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
termLine('[Jarvis]: Querying ' + (activeProvider || 'configured') + ' live models...', 'info');
fetch('../api/index.php?action=router-models&provider=' + encodeURIComponent(activeProvider))
.then(r => r.json())
.then(d => {
    const models = (d.catalog && d.catalog.models) || [];
    termLine('[9Router]: Online ' + models.length + ' model(s) available.', 'sys');
    models.slice(0, 10).forEach(m => {
        termLine(' ' + (m.id || m.name), 'prompt');
      });
})
.catch(e => termLine('[9Router]: Model query failed: ' + e.message, 'warn'));
    return;
  }

  if (lower === '/manual') {
    const manualWindow = window.open('manual.html', '_blank', 'noopener,noreferrer');
    termLine(manualWindow ? '[KRA]: User manual opened in a new tab.' : '[KRA]: Popup blocked. Open web/manual.html from the sidebar chip.', manualWindow ? 'sys' : 'warn');
    return;
  }

  if (lower.startsWith('/help')) {
  termLine('=== OPENCODE / KRA COMMAND REFERENCE ===', 'sys');
  KRA_COMMANDS.forEach(item => {
      const signature = item.cmd + (item.args ? ' ' + item.args : '');
      termLine(' ' + signature.padEnd(26) + item.desc, item.tone || 'info');
    });
  termLine(' Use /run <command>; local allowlist + confirmation required', 'info');
  termLine('---------------------------------------------------------', 'sys');
  return;
}

// Natural language in the terminal pane is chat, never an implicit shell command.
// OS processes require an explicit /run prefix plus a human confirmation dialog.
if (activeChatChannel === 'terminal') {
  if (lower === '/run' || lower.startsWith('/run ')) {
    const developerCommand = cmd.slice('/run'.length).trim();
    if (!developerCommand) {
      termLine('[Jarvis]: Usage: /run <php|node|npm|npx|git|python|python3|composer command>', 'info');
      return;
    }
    const approved = window.confirm(
      'Run this local developer command in the KRA folder?\n\n' + developerCommand
      + '\n\nOnly allowlisted executables are accepted.'
    );
    if (approved) runTerminalCommand(developerCommand);
    else termLine('[Terminal]: Command cancelled; no process was started.', 'warn');
    return;
  }
  if (!cmd.startsWith('/')) {
    sendAgentChat(cmd, options);
    return;
  }
  termLine('[Jarvis]: Unknown command. Use /help, or type a normal message to chat.', 'warn');
  return;
}

// Free chat is channel-aware and sent to the selected live officer/team.
sendAgentChat(cmd, options);
const focusId = activeChatChannel === 'team' ? 'rama' : activeChatChannel;
const focusAgent = AGENTS.find(agent => agent.id === focusId) || AGENTS[0];
showBubble(focusAgent.name, 'Message received. I am reviewing it now.', 3800);
walkTo(focusAgent, focusAgent.homeX + 0.8, focusAgent.homeY, () => {
    setTimeout(() => walkTo(focusAgent, focusAgent.homeX, focusAgent.homeY), 400);
  });
}

// Compact header dropdowns keep secondary controls out of the main title bar.
const hudDropdowns = document.querySelectorAll('.hud-dropdown');
hudDropdowns.forEach(dropdown => {
  const button = dropdown.querySelector('.hud-drop-btn');
  const menu = dropdown.querySelector('.hud-menu');
  if (!button || !menu) return;
  button.addEventListener('click', event => {
    event.stopPropagation();
    const shouldOpen = menu.classList.contains('hidden');
    hudDropdowns.forEach(item => {
      item.querySelector('.hud-menu')?.classList.add('hidden');
      item.querySelector('.hud-drop-btn')?.setAttribute('aria-expanded', 'false');
    });
    if (shouldOpen) {
      menu.classList.remove('hidden');
      button.setAttribute('aria-expanded', 'true');
    }
  });
});

document.querySelectorAll('.hud-menu').forEach(menu => {
  menu.addEventListener('click', event => event.stopPropagation());
  // Action rows close the menu; toggle rows stay open so their state stays visible.
  menu.querySelectorAll('.hud-item').forEach(item => {
    if (item.querySelector('.toggle-label')) return;
    item.addEventListener('click', () => {
      menu.classList.add('hidden');
      menu.closest('.hud-dropdown')?.querySelector('.hud-drop-btn')?.setAttribute('aria-expanded', 'false');
    });
  });
});
window.addEventListener('click', () => {
  hudDropdowns.forEach(item => {
    item.querySelector('.hud-menu')?.classList.add('hidden');
    item.querySelector('.hud-drop-btn')?.setAttribute('aria-expanded', 'false');
  });
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  hudDropdowns.forEach(item => item.querySelector('.hud-menu')?.classList.add('hidden'));
});

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
    const dark = document.body.classList.contains('dark-mode');
    themeToggle.querySelector('.toggle-label').textContent = dark ? 'Light' : 'Dark';
    themeToggle.querySelector('.theme-icon').innerHTML = dark
    ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>'
    : '<path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z"/>';
  };
updateThemeLabel();
const soundToggle = document.getElementById('btn-sound-toggle');
const updateSoundLabel = () => {
  if (soundToggle) soundToggle.querySelector('.toggle-label').textContent = sfxEnabled ? 'SFX ON' : 'SFX OFF';
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

/* --- Slash command catalog (single source for /help and autocomplete) --- */
const KRA_COMMANDS = [
  { cmd: '/status', desc: 'Runtime, PHP, and MySQL status' },
  { cmd: '/rama', args: 'briefing', desc: 'Executive briefing from Rama' },
  { cmd: '/rama', args: 'review', desc: 'Request executive audit verdict', tone: 'boss' },
  { cmd: '/run', args: '<command>', desc: 'Run an allowlisted local developer command (confirmation required)' },
  { cmd: '/create', args: '<desc>', desc: 'Draft new module file (Budi)' },
  { cmd: '/create-app', args: '<desc>', desc: 'New standalone app outside KRA (Budi)' },
  { cmd: '/modify', args: '<desc>', desc: 'Refactor or edit target file (Maya)' },
  { cmd: '/audit', args: '[path]', desc: 'Inspect security, paths, and hygiene (Dimas)' },
  { cmd: '/agent', args: '<name>', desc: 'Switch active subagent focus and channel' },
  { cmd: '/model', args: '[name]', desc: 'List or select a live 9Router model' },
  { cmd: '/skills', args: '[agent] [task]', desc: 'Show lock state and active routing' },
  { cmd: '/providers', desc: 'Display BYOK provider connection status' },
  { cmd: '/hire', desc: 'Hire a new agent from 36 archetypes' },
  { cmd: '/save', desc: 'Sync tasks, chat metrics, and status to Obsidian' },
  { cmd: '/recall', args: '<query>', desc: 'Search past reports in the KRA vault' },
  { cmd: '/meeting', args: '[agent1] [agent2]', desc: 'Start a collaboration scene' },
  { cmd: '/tasks', desc: 'Open task board and approval queue' },
  { cmd: '/manual', desc: 'Open KRA user manual' },
  { cmd: '/floor', args: '<1|2>', desc: 'Move active agent to specified floor' },
  { cmd: '/clear', desc: 'Clear terminal stream display' },
  { cmd: '/help', desc: 'Display the command catalog' },
];

const cmdSuggest = document.getElementById('cmd-suggest');
let cmdSuggestItems = [];
let cmdSuggestIndex = -1;

function hideCommandMenu() {
  if (cmdSuggest.classList.contains('hidden')) return;
  cmdSuggest.classList.add('hidden');
  cmdSuggest.replaceChildren();
  cmdSuggestItems = [];
  cmdSuggestIndex = -1;
  commandInput.setAttribute('aria-expanded', 'false');
}

function renderCommandMenu(query) {
  const matches = KRA_COMMANDS.filter(item => (item.cmd + ' ' + (item.args || '')).startsWith(query)).slice(0, 8);
  if (!matches.length) { hideCommandMenu(); return; }
  cmdSuggest.replaceChildren();
  cmdSuggestItems = matches;
  cmdSuggestIndex = 0;
  matches.forEach((item, index) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'cmd-suggest-item' + (index === 0 ? ' active' : '');
      row.setAttribute('role', 'option');
      const name = document.createElement('span');
      name.className = 'cmd-suggest-name';
      name.textContent = item.cmd + (item.args ? ' ' + item.args : '');
      const desc = document.createElement('span');
      desc.className = 'cmd-suggest-desc';
      desc.textContent = item.desc;
      row.append(name, desc);
      row.addEventListener('mousedown', event => {
          event.preventDefault();
          acceptCommand(index);
        });
      cmdSuggest.append(row);
    });
  cmdSuggest.classList.remove('hidden');
  commandInput.setAttribute('aria-expanded', 'true');
}

function moveCommandSelection(step) {
  if (!cmdSuggestItems.length) return;
  cmdSuggestIndex = (cmdSuggestIndex + step + cmdSuggestItems.length) % cmdSuggestItems.length;
  Array.from(cmdSuggest.children).forEach((row, index) => {
      row.classList.toggle('active', index === cmdSuggestIndex);
    });
  cmdSuggest.children[cmdSuggestIndex]?.scrollIntoView({ block: 'nearest' });
}

function acceptCommand(index = cmdSuggestIndex) {
  const item = cmdSuggestItems[index];
  if (!item) return;
  commandInput.value = item.cmd + (item.args ? ' ' : '');
  hideCommandMenu();
  commandInput.focus();
}

commandInput.addEventListener('input', () => {
    const value = commandInput.value;
    if (value.startsWith('/') && !value.includes(' ')) {
      renderCommandMenu(value.toLowerCase());
    } else {
      hideCommandMenu();
    }
  });

commandInput.addEventListener('blur', hideCommandMenu);
document.getElementById('chat-attach-btn').addEventListener('click', () => chatFileInput.click());
chatFileInput.addEventListener('change', () => {
  addChatFiles(Array.from(chatFileInput.files || []));
  chatFileInput.value = '';
});

/* --- Input events --- */
commandInput.addEventListener('keydown', e => {
    const menuOpen = !cmdSuggest.classList.contains('hidden');
    if (menuOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      moveCommandSelection(e.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (menuOpen && e.key === 'Tab') {
      e.preventDefault();
      acceptCommand();
      return;
    }
    if (menuOpen && e.key === 'Enter') {
      const item = cmdSuggestItems[cmdSuggestIndex];
      if (item && item.cmd === commandInput.value.trim().toLowerCase()) {
        hideCommandMenu();
        handleCommand(commandInput.value);
        commandInput.value = '';
        return;
      }
      e.preventDefault();
      acceptCommand();
      return;
    }
    if (menuOpen && e.key === 'Escape') {
      e.preventDefault();
      hideCommandMenu();
      return;
    }
    if (e.key === 'Enter') {
      hideCommandMenu();
      submitComposerMessage();
    }
  });
document.getElementById('btn-send-cmd').addEventListener('click', () => {
    hideCommandMenu();
    submitComposerMessage();
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
    if (activeChatChannel === 'terminal') {
      sysLog.innerHTML = '';
      termLine('[Jarvis]: Terminal cleared.', 'sys');
    } else {
      terminal.innerHTML = '';
    }
  });
document.getElementById('btn-sync-memory').addEventListener('click', () => {
    handleCommand('/save');
  });
document.getElementById('btn-open-manual').addEventListener('click', () => {
    handleCommand('/manual');
  });
document.getElementById('btn-live-audit').addEventListener('click', () => {
    const target = document.getElementById('audit-target').value.trim();
    if (!target) { termLine('[Jarvis]: Select a project folder first.', 'warn'); return; }
    runRealAudit(target);
  });

/* --- Step 4: Desktop folder picker and human-named agent hiring --- */
const desktopApi = window.kraDesktop;
const browseFolderButton = document.getElementById('btn-browse-folder');
if (browseFolderButton) {
  browseFolderButton.addEventListener('click', async () => {
    if (desktopApi && typeof desktopApi.selectFolder === 'function') {
      try {
        const folder = await desktopApi.selectFolder();
        if (folder) {
          document.getElementById('audit-target').value = folder;
          termLine('[Jarvis]: Audit folder selected: ' + folder, 'sys');
          return;
        }
      } catch (err) {
        console.warn('Native picker error, fallback to browser modal', err);
        termLine('[Jarvis]: Native picker error, using browser modal...', 'warn');
      }
    }
    try {
      await showAuditFolderPicker();
    } catch (e) {
      console.error('Folder picker failed', e);
      termLine('[Jarvis]: Could not open folder picker: ' + e.message, 'warn');
    }
  });
}

const hireModal = document.getElementById('hire-modal');
const hireRoleSelect = document.getElementById('hire-role-select');
const openHireButton = document.getElementById('btn-open-hire');
const closeHireModal = () => hireModal.classList.add('hidden');
let roleTemplates = {};

// UI Selectors for Add Agent 4-Tab
const agentTabBtns = document.querySelectorAll('.agent-tab-btn');
const agentTabPanes = document.querySelectorAll('.agent-tab-pane');
const agentNameInput = document.getElementById('agent-name-input');
const charCards = document.querySelectorAll('.char-card');
const colorSwatches = document.querySelectorAll('.swatch-btn');
const providerPills = document.querySelectorAll('.engine-pill[data-provider]');
const modelPills = document.querySelectorAll('.engine-pill[data-model]');
const templateChips = document.querySelectorAll('.template-chip');
const avatarPreview = document.getElementById('agent-avatar-preview-portrait');

const agentWorkspacePath = document.getElementById('agent-workspace-path');
const agentGitIsolation = document.getElementById('agent-git-isolation');
const agentResumeSession = document.getElementById('agent-resume-session');
const agentCommandInput = document.getElementById('agent-command-input');
const agentDescriptionInput = document.getElementById('agent-description-input');
const agentGoalInput = document.getElementById('agent-goal-input');
const pickFolderBtn = document.getElementById('pick-folder-btn');
const importHireBtn = document.getElementById('btn-import-hire');
const fileImportManifest = document.getElementById('file-import-manifest');
const agentProjects = [];

// Folder picker (Desktop electron or prompt fallback)
if (pickFolderBtn) {
  pickFolderBtn.addEventListener('click', async () => {
      if (window.kraDesktop && typeof window.kraDesktop.selectFolder === 'function') {
        try {
          const folder = await window.kraDesktop.selectFolder();
          if (folder) addAgentProject(folder);
        } catch (err) {
        console.warn('Folder picker failed', err);
      }
  } else {
  const folder = prompt('Enter workspace path:', agentWorkspacePath.value || '');
  if (folder) agentWorkspacePath.value = folder;
}
});
}

// Add project button
const addProjBtn = document.querySelector('.add-proj-btn');
const projectList = document.getElementById('agent-project-list');
function addAgentProject(path) {
  const value = String(path || '').trim();
  if (!value || agentProjects.includes(value)) return;
  agentProjects.push(value);
  if (projectList) {
    const item = document.createElement('li');
    item.textContent = value;
    item.dataset.path = value;
    projectList.appendChild(item);
  }
agentWorkspacePath.value = value;
}
if (addProjBtn) {
  addProjBtn.addEventListener('click', () => addAgentProject(prompt('Enter project name or folder path:')));
}

// Briefing Template Chips click
templateChips.forEach(chip => {
    chip.addEventListener('click', () => {
        const roleName = chip.dataset.role;
        // Find matching role in roleTemplates if any
        const foundEntry = Object.entries(roleTemplates).find(([_, t]) => t.name.toLowerCase().includes(roleName.toLowerCase()));
        if (foundEntry) {
          hireRoleSelect.value = foundEntry[0];
          updateRolePreview();
        } else {
        agentDescriptionInput.value = 'Dedicated agent specialized in: ' + roleName;
        agentGoalInput.value = 'Execute all tasks related to ' + roleName + ' with high quality.';
      }
  });
});

// Import Hire (.json manifest)
if (importHireBtn && fileImportManifest) {
  importHireBtn.addEventListener('click', () => fileImportManifest.click());
  fileImportManifest.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const manifest = JSON.parse(evt.target.result);
          if (window.mapMunderArchetypeToKRAForm) {
            const mapped = window.mapMunderArchetypeToKRAForm(manifest, {
                name: manifest.name,
                accent: manifest.configs?.accent,
                appearance: manifest.appearance
              });

          // Fill all 4 tabs from manifest
          if (mapped.identity.name) agentNameInput.value = mapped.identity.name;
          if (mapped.identity.color) {
            colorSwatches.forEach(s => s.classList.toggle('active', s.dataset.color === mapped.identity.color));
          }
        if (mapped.identity.character) {
          charCards.forEach(c => c.classList.toggle('active', c.dataset.char === mapped.identity.character));
        }
      if (mapped.identity.appearance) {
        const app = mapped.identity.appearance;
        ['body', 'hair', 'top', 'heldItem'].forEach(key => {
            const select = document.getElementById('hire-' + (key === 'heldItem' ? 'held-item' : key) + '-select');
            if (select && app[key]) select.value = app[key];
          });
    }
  if (manifest.workspace?.path) addAgentProject(manifest.workspace.path);
  if (Array.isArray(manifest.workspace?.projects)) manifest.workspace.projects.forEach(addAgentProject);
  if (manifest.workspace?.isolation !== undefined) agentGitIsolation.checked = Boolean(manifest.workspace.isolation);
  if (manifest.workspace?.resumeId) agentResumeSession.value = manifest.workspace.resumeId;
  const importedEngine = manifest.engine || mapped.engine;
  const importedBriefing = manifest.briefing || mapped.briefing;
  if (importedEngine?.provider) {
    providerPills.forEach(p => p.classList.toggle('active', p.dataset.provider === importedEngine.provider));
  }
if (importedEngine?.model) {
  modelPills.forEach(p => p.classList.toggle('active', p.dataset.model === importedEngine.model));
}
if (importedEngine?.command) agentCommandInput.value = importedEngine.command;
if (importedBriefing?.description) agentDescriptionInput.value = importedBriefing.description;
if (importedBriefing?.goal) agentGoalInput.value = importedBriefing.goal;
hireRoleSelect._mappedData = { ...mapped, engine: importedEngine, briefing: importedBriefing };

termLine('[Jarvis]: Manifest imported successfully for ' + manifest.name + '.', 'info');
}
} catch (err) {
termLine('[Jarvis]: Failed to parse manifest JSON: ' + err.message, 'warn');
}
};
reader.readAsText(file);
});
}

function drawHireAvatarPreview() {
  if (!avatarPreview) return;
  const selected = document.querySelector('#character-grid .char-card.active');
  const character = selected?.dataset.char || 'jim';
  const color = document.querySelector('.swatch-btn.active')?.dataset.color || '#4e9b83';
  const body = document.getElementById('hire-body-select')?.value || 'standard_warm';
  const hair = document.getElementById('hire-hair-select')?.value || 'exec_part_dark';
  const top = document.getElementById('hire-top-select')?.value || 'navy_suit_tie';
  const heldItem = document.getElementById('hire-held-item-select')?.value || 'none';
  const selectedRole = hireRoleSelect?.selectedOptions?.[0]?.textContent?.trim();
  const displayName = agentNameInput?.value.trim() || 'New agent';
  const preview = {
    id: 'hire-preview-' + character, name: displayName,
    palette: { primary: color, accent: color },
    appearance: { character, body, hair, top, heldItem, face: character === 'michael' ? 'beard_mustache' : 'stern_brows' }
  };
  avatarPreview.innerHTML = agentAvatarMarkup(preview);
  const previewName = document.getElementById('agent-avatar-preview-name');
  const previewRole = document.getElementById('agent-avatar-preview-role');
  if (previewName) previewName.textContent = displayName;
  if (previewRole) previewRole.textContent = selectedRole && !selectedRole.startsWith('--')
    ? selectedRole + ' · ready to configure' : 'Team agent · ready to configure';
}

function bindHirePreviewEvents() {
  agentNameInput?.addEventListener('input', drawHireAvatarPreview);
  document.querySelectorAll('#pane-identity select, #color-swatches .swatch-btn, #character-grid ~ .custom-avatar-section .char-card')
  .forEach(control => control.addEventListener('change', drawHireAvatarPreview));
  document.querySelectorAll('#pane-identity select, #color-swatches .swatch-btn, .char-card')
  .forEach(control => control.addEventListener('click', () => requestAnimationFrame(drawHireAvatarPreview)));
  drawHireAvatarPreview();
}

// Tab Switching Logic
agentTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        agentTabBtns.forEach(b => b.classList.remove('active'));
        agentTabPanes.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('pane-' + btn.dataset.tab).classList.add('active');
      });
});

// Selection Logic (Identity)
charCards.forEach(card => {
    card.addEventListener('click', () => {
        charCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      });
});

colorSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
        colorSwatches.forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        drawHireAvatarPreview();
      });
});

bindHirePreviewEvents();

// Engine Pills
providerPills.forEach(pill => {
    pill.addEventListener('click', () => {
        providerPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
      });
});

modelPills.forEach(pill => {
    pill.addEventListener('click', () => {
        modelPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const provider = document.querySelector('.engine-pill[data-provider].active')?.dataset.provider;
        const model = pill.dataset.model;
        if (provider === 'claude-code') agentCommandInput.value = 'claude --model ' + model + ' --permission-mode bypassPermissions';
        if (provider === 'codex-gpt') agentCommandInput.value = 'codex run --model ' + model;
        if (provider === 'opencode') agentCommandInput.value = 'opencode run --model ' + model;
      });
});

function updateRolePreview() {
  const roleId = hireRoleSelect.value;
  const role = roleTemplates[roleId];
  if (!role || !window.mapMunderArchetypeToKRAForm) return;

  const mapped = window.mapMunderArchetypeToKRAForm(role, {
      name: agentNameInput.value,
      accent: document.querySelector('.swatch-btn.active')?.dataset.color,
      appearance: {
        body: document.getElementById('hire-body-select')?.value,
        hair: document.getElementById('hire-hair-select')?.value,
        top: document.getElementById('hire-top-select')?.value,
        heldItem: document.getElementById('hire-held-item-select')?.value
      }
  });

// Apply Mapped Identity
if (mapped.identity.name) agentNameInput.value = mapped.identity.name;
if (mapped.identity.color) {
  colorSwatches.forEach(s => s.classList.toggle('active', s.dataset.color === mapped.identity.color));
}
if (mapped.identity.character) {
  charCards.forEach(c => c.classList.toggle('active', c.dataset.char === mapped.identity.character));
}

// Visual Loadout / Appearance options for Modular Agents (Batch 11)
if (mapped.identity.appearance) {
  const app = mapped.identity.appearance;
  const bodySelect = document.getElementById('hire-body-select');
  const hairSelect = document.getElementById('hire-hair-select');
  const topSelect = document.getElementById('hire-top-select');
  const heldSelect = document.getElementById('hire-held-item-select');

  if (bodySelect && app.body) bodySelect.value = app.body;
  if (hairSelect && app.hair) hairSelect.value = app.hair;
  if (topSelect && app.top) topSelect.value = app.top;
  if (heldSelect && app.heldItem) heldSelect.value = app.heldItem;
}

// Apply Mapped Engine
if (mapped.engine.provider) {
  providerPills.forEach(p => p.classList.toggle('active', p.dataset.provider === mapped.engine.provider));
}
if (mapped.engine.model) {
  modelPills.forEach(p => p.classList.toggle('active', p.dataset.model === mapped.engine.model));
}
if (mapped.engine.command) agentCommandInput.value = mapped.engine.command;

// Apply Mapped Briefing
if (mapped.briefing.description) agentDescriptionInput.value = mapped.briefing.description;
if (mapped.briefing.goal) agentGoalInput.value = mapped.briefing.goal;

hireRoleSelect._mappedData = mapped;
}

async function loadRoleTemplates() {
  try {
    const response = await fetch('../api/index.php?action=templates');
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || 'Template catalog unavailable');
    roleTemplates = payload.templates || {};
    hireRoleSelect.innerHTML = '<option value="">-- Choose Archetype --</option>' +
    Object.entries(roleTemplates).map(([id, role]) =>
      '<option value="' + id + '">' + role.name + '</option>'
    ).join('');
  hireRoleSelect.addEventListener('change', updateRolePreview);
  termLine('[Jarvis]: Loaded ' + payload.count + ' Munder Difflin role templates.', 'sys');
} catch (error) {
termLine('[Jarvis]: Role catalog unavailable ' + error.message, 'warn');
}
}

document.getElementById('btn-generate-ai').addEventListener('click', () => {
    // Simulate AI generation by picking a random template if none selected
    if (!hireRoleSelect.value) {
      const keys = Object.keys(roleTemplates);
      if (keys.length) {
        hireRoleSelect.value = keys[Math.floor(Math.random() * keys.length)];
        updateRolePreview();
      }
  } else {
  updateRolePreview();
}
});

function openHireModalFor(target) {
  hireTarget = target === 'creator' ? 'creator' : 'office';
  hireModal.dataset.hireTarget = hireTarget;
  hireModal.classList.toggle('creator-hire-context', hireTarget === 'creator');
  const title = document.getElementById('hire-modal-title');
  const subtitle = document.getElementById('hire-modal-subtitle');
  const confirm = document.getElementById('hire-btn-confirm');
  if (title) title.textContent = hireTarget === 'creator' ? 'Hire a Creator Agent' : 'Hire an Office Agent';
  if (subtitle) subtitle.textContent = hireTarget === 'creator'
    ? 'Configure a studio teammate; this roster stays separate from the Virtual Office.'
    : 'Choose a role, workspace, engine, and visual style for the office.';
  if (confirm) confirm.textContent = hireTarget === 'creator' ? 'Add to creator studio' : 'Hire office agent';
  agentTabBtns.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === 'identity'));
  agentTabPanes.forEach(pane => pane.classList.toggle('active', pane.id === 'pane-identity'));
  drawHireAvatarPreview();
  hireModal.classList.remove('hidden');
  agentNameInput?.focus();
}
openHireButton?.addEventListener('click', () => openHireModalFor('office'));
document.getElementById('hire-btn-close').addEventListener('click', closeHireModal);
document.getElementById('hire-btn-cancel').addEventListener('click', closeHireModal);

document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!hireModal.classList.contains('hidden')) closeHireModal();
    if (!skillsModal.classList.contains('hidden')) skillsModal.classList.add('hidden');
    if (!taskBoardModal.classList.contains('hidden')) taskBoardModal.classList.add('hidden');
    if (!approvalModal.classList.contains('hidden')) hideApprovalGate();
  });

document.getElementById('hire-btn-confirm').addEventListener('click', () => {
    const chosenName = agentNameInput.value.trim();
    const roleId = hireRoleSelect.value;
    const roleTemplate = roleTemplates[roleId];
    const role = roleTemplate ? roleTemplate.name : (roleId || 'Custom Agent');

    if (!chosenName) {
      termLine('[Jarvis]: A human name is required before seating the agent.', 'warn');
      return;
    }

  if (agentWorkspacePath.value.trim() && !agentProjects.includes(agentWorkspacePath.value.trim())) {
    addAgentProject(agentWorkspacePath.value);
  }
const id = (hireTarget === 'creator' ? 'creator-agent-' : 'agent-') + Date.now();
const seat = { x: 22 + (AGENTS.length % 4) * 4, y: 2 }; // Office placement is used only by the office roster.
const assignedFloor = 2;

// Gather appearance from loadout selects
const bodySelect = document.getElementById('hire-body-select');
const hairSelect = document.getElementById('hire-hair-select');
const topSelect = document.getElementById('hire-top-select');
const heldSelect = document.getElementById('hire-held-item-select');

const hired = {
  id, name: chosenName.toUpperCase(), role,
  templateId: roleId,
  x: seat.x, y: seat.y, homeX: seat.x, homeY: seat.y, floorId: assignedFloor,
  badge: 'badge-idle', status: 'standing by',
  palette: {
    primary: document.querySelector('.swatch-btn.active')?.dataset.color || '#4e9b83',
    accent: document.querySelector('.swatch-btn.active')?.dataset.color || '#4e9b83'
  },
  engine: {
    provider: document.querySelector('.engine-pill[data-provider].active')?.dataset.provider,
    model: document.querySelector('.engine-pill[data-model].active')?.dataset.model,
    command: agentCommandInput.value
  },
briefing: {
  description: agentDescriptionInput.value,
  goal: agentGoalInput.value
},
workspace: {
  path: agentWorkspacePath.value,
  projects: [...agentProjects],
  isolation: agentGitIsolation.checked,
  resumeId: agentResumeSession.value
},
appearance: {
  spriteVersion: '2.0-ortho-ref',
  body: bodySelect?.value || 'standard_warm',
  face: 'stern_brows',
  hair: hairSelect?.value || 'tech_crop_brown',
  top: topSelect?.value || 'navy_suit_tie',
  bottom: 'formal_navy_loafers',
  shoes: 'formal_loafers',
  accessories: 'none',
  heldItem: heldSelect?.value || 'none',
  character: document.querySelector('.char-card.active')?.dataset.char || 'jim',
  palette: { primary: document.querySelector('.swatch-btn.active')?.dataset.color || '#4ECDC4' },
  hitbox: { width: 24, height: 32, pivot: 'bottom_center' }
},
intro: chosenName + ': Ready to contribute to Rama\'s office.'
};

if (hireTarget === 'creator') {
  hired.intro = chosenName + ': Ready for the content studio.';
  hired.creatorActivity = creatorStageForAgent(hired, creatorAgents.length).key;
  creatorAgents.push(hired);
  persistCreatorAgents();
  renderCreatorTeam();
  closeHireModal();
  return;
}

AGENTS.push(hired);
registerHiredChatChannel(hired);
buildRoster();
closeHireModal();
termLine('[Rama]: Welcome ' + chosenName + ', hired as ' + role + '.', 'boss');

// Persist to backend
fetch('../api/index.php?action=save-agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(hired)
  }).then(response => {
  if (!response.ok) throw new Error('HTTP ' + response.status);
}).catch(() => termLine('[Jarvis]: Agent seated locally; database sync unavailable.', 'warn'));
});

/* --- Boot --- */
async function loadRuntimeStatus() {
  try {
    const response = await fetch('../api/index.php?action=runtime');
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || 'Runtime unavailable');
    termLine('[Runtime]: PHP ' + payload.php + ' MySQL ' + (payload.database ? 'online' : 'offline'), 'sys');
    termLine('[Runtime]: Task states ' + payload.executionStates.join(' '), 'info');
    loadRouterStatus();
  } catch (error) {
  termLine('[Runtime]: Status unavailable ' + error.message, 'warn');
}
}

async function loadRouterStatus() {
  try {
    const response = await fetch('../api/index.php?action=router-health&provider=' + encodeURIComponent(activeProvider));
    const payload = await response.json();
    const health = payload.health || {};
    if (health.online) {
      termLine('[9Router]: Online provider ' + health.provider + '.', 'prompt');
      const catalogRes = await fetch('../api/index.php?action=router-models&provider=' + encodeURIComponent(activeProvider));
      const catalogPayload = await catalogRes.json();
      const models = (catalogPayload.catalog && catalogPayload.catalog.models) || [];
      termLine('[9Router]: ' + models.length + ' model(s) available to KRA.', 'sys');
    } else {
    termLine('[9Router]: Offline or busy simulator fallback remains available.', 'warn');
  }
} catch (error) {
termLine('[9Router]: Status unavailable simulator fallback remains available.', 'warn');
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
      // Persisted coordinates may be from an older floor plan. Validate each
      // crew member against the dimensions of their own floor preset.
      const persistedFloor = Number(p.floor_id);
      const persistedX = Number(p.x);
      const persistedY = Number(p.y);
      if (persistedFloor === 1 || persistedFloor === 2) ag.floorId = persistedFloor;
      const migrateJarvis = ag.id === 'jarvis' && persistedFloor === 1;
      if (migrateJarvis) {
        ag.floorId = 2;
        ag.x = ag.homeX;
        ag.y = ag.homeY;
      }
      const persistedMap = FLOOR_PRESETS[ag.floorId || persistedFloor]?.map;
      if (!migrateJarvis && persistedMap && Number.isFinite(persistedX) && Number.isFinite(persistedY)
        && persistedX >= 0 && persistedX < persistedMap.w && persistedY >= 0 && persistedY < persistedMap.h) {
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

const CREATOR_AGENT_STORAGE_KEY = 'kra-creator-studio-agents-v1';
const CREATOR_ACTIVITY_STAGES = [
  { key: 'research', title: 'Riset topik', detail: 'Mengumpulkan referensi dan ide', station: 'research' },
  { key: 'writing', title: 'Menulis naskah', detail: 'Menyusun outline dan hook', station: 'writing' },
  { key: 'production', title: 'Persiapan produksi', detail: 'Menata shot dan kebutuhan visual', station: 'production' },
  { key: 'review', title: 'Quality review', detail: 'Memeriksa brief dan metadata', station: 'review' },
];
const DEFAULT_CREATOR_AGENTS = [
  {
    id: 'creator_research', name: 'Nara', role: 'Content Research Analyst', creatorActivity: 'research',
    intro: 'Nara: I gather current, source-backed ideas and audience insights.',
    briefing: { description: 'Research topics, trends, audience needs, and reliable source material.', goal: 'Deliver a concise, cited research brief before scripting.' },
    palette: { primary: '#477a68', accent: '#76c5a2' }, appearance: { body: 'standard_warm', hair: 'tech_crop_brown' }
  },
  {
    id: 'creator_writer', name: 'Aruna', role: 'Scriptwriter & Metadata Editor', creatorActivity: 'writing',
    intro: 'Aruna: I turn approved research into clear scripts, titles, and descriptions.',
    briefing: { description: 'Write audience-friendly scripts, hooks, titles, descriptions, and metadata.', goal: 'Create an editable first draft that follows the approved brief.' },
    palette: { primary: '#7c557c', accent: '#d695c0' }, appearance: { body: 'standard_warm', hair: 'hijab_emerald' }
  },
  {
    id: 'creator_producer', name: 'Dito', role: 'Creative Production Planner', creatorActivity: 'production',
    intro: 'Dito: I plan the visual approach, shots, pacing, and production checklist.',
    briefing: { description: 'Plan shot lists, visual beats, pacing, and production requirements.', goal: 'Produce a practical storyboard and production checklist; do not claim to render video.' },
    palette: { primary: '#4e668c', accent: '#89b4ec' }, appearance: { body: 'broad_deep', hair: 'tech_crop_brown' }
  },
  {
    id: 'creator_reviewer', name: 'Lintang', role: 'Quality & Publishing Reviewer', creatorActivity: 'review',
    intro: 'Lintang: I review drafts for accuracy, clarity, policy, and publication readiness.',
    briefing: { description: 'Check factual claims, clarity, brand safety, metadata, and policy risks.', goal: 'Return actionable review notes and an approval checklist; never publish or upload.' },
    palette: { primary: '#a36c43', accent: '#e3b66c' }, appearance: { body: 'android_synth', hair: 'tech_crop_brown' }
  }
];
let creatorAgents = DEFAULT_CREATOR_AGENTS.map(agent => ({ ...agent }));
try {
  const storedCreatorAgents = JSON.parse(localStorage.getItem(CREATOR_AGENT_STORAGE_KEY) || '[]');
  if (Array.isArray(storedCreatorAgents)) {
    const rosterById = new Map(creatorAgents.map(agent => [agent.id, agent]));
    storedCreatorAgents.filter(agent => agent && agent.id && agent.name).forEach(agent => {
      if (!rosterById.has(agent.id)) rosterById.set(agent.id, agent);
    });
    creatorAgents = [...rosterById.values()];
  }
} catch (_) { /* Browser storage is optional; the built-in studio crew is always available. */ }
creatorAgents.forEach(registerHiredChatChannel);
const CREATOR_STUDIO_GROUP_ID = 'creator_studio_team';
let activeCreatorStudioAgentId = CREATOR_STUDIO_GROUP_ID;
let creatorStudioHistoryRequest = 0;
const creatorStudioBusyAgents = new Set();
let creatorWorkflows = [];
let activeCreatorWorkflowId = '';
let hireTarget = 'office';

function creatorWorkflowStatus(message, isError = false) {
  const target = document.getElementById('creator-workflow-status');
  if (!target) return;
  target.textContent = message;
  target.classList.toggle('is-error', isError);
}

function selectedCreatorWorkflow() {
  return creatorWorkflows.find(workflow => workflow.id === activeCreatorWorkflowId) || null;
}

function creatorStageForAgent(agent, index = 0) {
  const role = String(agent.role || '').toLowerCase();
  const text = (role + ' ' + String(agent.briefing?.description || '') + ' ' + String(agent.briefing?.goal || '')).toLowerCase();
  const inferred = /research|researcher|riset|research assistant|topic/.test(text) ? 'research'
    : /writer|writing|script|naskah|copy/.test(text) ? 'writing'
      : /producer|production|video|editor|edit/.test(text) ? 'production'
        : /quality|review|auditor|publish|metadata/.test(text) ? 'review' : '';
  return CREATOR_ACTIVITY_STAGES.find(stage => stage.key === (agent.creatorActivity || inferred))
    || CREATOR_ACTIVITY_STAGES[index % CREATOR_ACTIVITY_STAGES.length];
}

const CREATOR_AMBIENT_LABELS = {
  computer: 'Typing at computer',
  thinking: 'Thinking through ideas',
  chatting: 'Discussing with teammate',
  resting: 'Taking a short break',
  stretching: 'Stretching'
};

function updateCreatorAmbientLabels() {
  const renderer = window.KRACreatorSceneRenderer;
  if (!renderer?.getBehaviorAt) return;
  const time = performance.now();
  document.querySelectorAll('.creator-agent-card').forEach(card => {
    const liveStatus = card.querySelector('.creator-agent-live');
    const index = Number(card.dataset.creatorIndex || 0);
    const behavior = renderer.getBehaviorAt(index, time);
    if (!liveStatus || !behavior) return;
    liveStatus.textContent = 'Studio simulation · ' + (CREATOR_AMBIENT_LABELS[behavior.key] || behavior.label);
    card.dataset.ambientBehavior = behavior.key;
  });
}

function persistCreatorAgents() {
  try { localStorage.setItem(CREATOR_AGENT_STORAGE_KEY, JSON.stringify(creatorAgents)); }
  catch (_) { /* Keep the current-session roster if storage is unavailable. */ }
}

function renderCreatorTeam() {
  const grid = document.getElementById('creator-team-grid');
  const count = document.getElementById('creator-team-count');
  if (!grid) return;
  grid.replaceChildren();
  if (count) count.textContent = creatorAgents.length + (creatorAgents.length === 1 ? ' studio agent' : ' studio agents');
  if (!creatorAgents.length) {
    const empty = document.createElement('div');
    empty.className = 'creator-team-empty';
    empty.textContent = 'Belum ada creator agent. Hire agent untuk menempatkannya di studio.';
    grid.appendChild(empty);
  }
  creatorAgents.forEach((agent, index) => {
    const stage = creatorStageForAgent(agent, index);
    const card = document.createElement('article');
    card.className = 'creator-agent-card';
    card.dataset.agentId = agent.id;
    card.dataset.creatorIndex = String(index);
    card.style.setProperty('--agent-accent', agent.palette?.accent || agent.palette?.primary || '#78a98b');
    card.innerHTML = `<div class="creator-agent-avatar">${agentAvatarMarkup(agent)}<i></i></div>
      <div class="creator-agent-copy"><div class="creator-agent-name"></div><div class="creator-agent-role"></div>
      <span class="creator-activity-chip"><i></i></span><small class="creator-agent-detail"></small>
      <small class="creator-agent-live" aria-live="polite"></small>
      <span class="creator-agent-progress" aria-hidden="true"><span></span></span></div>
      <button class="creator-agent-chat" type="button" data-open-creator-chat="${String(agent.id).replace(/[^a-z0-9_-]/gi, '')}">CHAT</button>`;
    card.querySelector('.creator-agent-name').textContent = String(agent.name || 'Creator agent');
    card.querySelector('.creator-agent-role').textContent = String(agent.role || 'Studio contributor');
    card.querySelector('.creator-activity-chip').append(document.createTextNode(stage.title));
    card.querySelector('.creator-agent-detail').textContent = stage.detail;
    const progressFill = card.querySelector('.creator-agent-progress span');
    if (progressFill) progressFill.style.width = (28 + ((index * 17) % 63)) + '%';
    grid.appendChild(card);
  });
  if (!grid.dataset.chatBound) {
    grid.dataset.chatBound = 'true';
    grid.addEventListener('click', event => {
      const button = event.target.closest('[data-open-creator-chat]');
      if (!button) return;
      const agentId = button.dataset.openCreatorChat;
      openCreatorStudioTerminal(agentId);
    });
  }
  window.KRACreatorSceneRenderer?.setAgents(creatorAgents.map((agent, index) => {
    const stage = creatorStageForAgent(agent, index);
    return { ...agent, activity: stage.key, activityLabel: stage.title, accent: agent.palette?.accent || agent.palette?.primary || '#78a98b' };
  }));
  updateCreatorAmbientLabels();
  renderCreatorStudioTerminal();
}

function creatorStudioChannelFor(agentId) {
  if (agentId === CREATOR_STUDIO_GROUP_ID) return CREATOR_STUDIO_GROUP_ID;
  const suffix = String(agentId || '').replace(/^creator_/, '').replace(/[^a-z0-9_-]/gi, '');
  return 'creator_studio_' + (suffix || 'agent');
}

function creatorStudioStatus(message, isError = false) {
  const status = document.getElementById('creator-studio-chat-status');
  if (!status) return;
  status.textContent = String(message || '');
  status.classList.toggle('is-error', isError);
}

function renderCreatorStudioEmpty(message) {
  const log = document.getElementById('creator-studio-chat-log');
  if (!log) return;
  log.replaceChildren();
  const empty = document.createElement('div');
  empty.className = 'creator-studio-chat-empty';
  empty.textContent = message;
  log.appendChild(empty);
}

function renderCreatorStudioMessage(message, channelId, isUser = false, createdAt = '', isError = false, senderName = '') {
  const log = document.getElementById('creator-studio-chat-log');
  if (!log) return;
  log.querySelector('.creator-studio-chat-empty')?.remove();
  const agent = creatorAgents.find(item => item.id === senderName || item.name === senderName)
    || creatorAgents.find(item => item.id === channelId) || creatorAgents[0];
  const row = document.createElement('div');
  row.className = 'creator-studio-chat-message' + (isUser ? ' is-user' : '') + (isError ? ' is-error' : '');
  const avatar = document.createElement('div');
  avatar.className = 'creator-studio-chat-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  if (isUser) avatar.textContent = 'YOU';
  else if (agent) avatar.innerHTML = agentAvatarMarkup(agent);
  const bubble = document.createElement('div');
  bubble.className = 'creator-studio-chat-bubble';
  const sender = document.createElement('span');
  sender.className = 'creator-studio-chat-sender';
  sender.textContent = isUser ? (kraUserProfile?.displayName || 'You') : (senderName || agent?.name || 'Creator agent');
  const text = document.createElement('div');
  text.className = 'creator-studio-chat-text';
  text.textContent = String(message || '');
  const time = document.createElement('time');
  time.className = 'creator-studio-chat-time';
  const date = createdAt ? new Date(createdAt) : new Date();
  time.textContent = Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  bubble.append(sender, text, time);
  row.append(avatar, bubble);
  log.appendChild(row);
  log.scrollTop = log.scrollHeight;
}

async function loadCreatorStudioHistory(agentId) {
  const channel = creatorStudioChannelFor(agentId);
  const requestId = ++creatorStudioHistoryRequest;
  const isGroup = agentId === CREATOR_STUDIO_GROUP_ID;
  const agentName = creatorAgents.find(agent => agent.id === agentId)?.name || (isGroup ? 'Studio Crew' : 'agent');
  renderCreatorStudioEmpty('Memuat riwayat chat Studio…');
  creatorStudioStatus('Memuat channel ' + agentName + '…');
  try {
    const response = await fetch('../api/index.php?action=chat-history&channel=' + encodeURIComponent(channel), {
      headers: getAuthHeaders(false),
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'Riwayat Studio tidak tersedia.');
    if (requestId !== creatorStudioHistoryRequest || activeCreatorStudioAgentId !== agentId) return;
    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    if (!messages.length) renderCreatorStudioEmpty(isGroup
      ? 'Belum ada diskusi bersama. Kirim satu pesan; Nara, Aruna, Dito, dan Lintang akan membaca konteks lalu menanggapi bergantian.'
      : 'Belum ada percakapan pribadi di channel Studio ini. Riwayat Office tetap terpisah.');
    else {
      const log = document.getElementById('creator-studio-chat-log');
      log.replaceChildren();
      messages.forEach(item => renderCreatorStudioMessage(
        item.message, agentId, item.sender === 'User', item.created_at || item.createdAt, false, item.sender,
      ));
    }
    creatorStudioStatus(isGroup ? 'Studio Crew · ' + messages.length + ' pesan' : 'Channel Studio terpisah · ' + messages.length + ' pesan');
  } catch (error) {
    if (requestId !== creatorStudioHistoryRequest) return;
    renderCreatorStudioEmpty('Riwayat belum dapat dimuat. Pesan baru tetap bisa dicoba jika provider tersedia.');
    creatorStudioStatus('Riwayat offline: ' + error.message, true);
  }
}

function selectCreatorStudioAgent(agentId, options = {}) {
  const isGroup = agentId === CREATOR_STUDIO_GROUP_ID;
  const agent = creatorAgents.find(item => item.id === agentId);
  if (!isGroup && !agent) return;
  const changed = activeCreatorStudioAgentId !== agentId;
  activeCreatorStudioAgentId = agentId;
  document.querySelectorAll('.creator-studio-terminal-tab').forEach(tab => {
    const active = tab.dataset.creatorTerminalAgent === agentId;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  const label = isGroup ? 'STUDIO CREW · ALL FOUR AGENTS' : 'CREATOR / ' + agent.name.toUpperCase();
  const channelLabel = document.getElementById('creator-studio-terminal-channel');
  if (channelLabel) channelLabel.textContent = label + ' · ' + creatorStudioChannelFor(agentId);
  const input = document.getElementById('creator-studio-chat-input');
  if (input) input.placeholder = isGroup
    ? 'Beri arahan atau pertanyaan untuk seluruh Studio Crew…'
    : 'Tulis pesan untuk ' + agent.name + '…';
  const sendButton = document.getElementById('creator-studio-chat-send');
  if (sendButton) {
    sendButton.textContent = isGroup ? 'KIRIM KE STUDIO CREW' : 'KIRIM KE ' + agent.name.toUpperCase();
    sendButton.disabled = creatorStudioBusyAgents.has(agentId);
  }
  if (changed || options.forceLoad) loadCreatorStudioHistory(agentId);
  if (options.focus) input?.focus({ preventScroll: true });
}

function renderCreatorStudioTerminal(options = {}) {
  const tabs = document.getElementById('creator-studio-terminal-tabs');
  if (!tabs) return;
  tabs.replaceChildren();
  const groupButton = document.createElement('button');
  groupButton.type = 'button';
  groupButton.className = 'creator-studio-terminal-tab creator-studio-terminal-group-tab';
  groupButton.dataset.creatorTerminalAgent = CREATOR_STUDIO_GROUP_ID;
  groupButton.setAttribute('role', 'tab');
  groupButton.setAttribute('aria-selected', 'false');
  const groupPortrait = document.createElement('span');
  groupPortrait.className = 'creator-studio-terminal-tab-avatar creator-studio-terminal-team-avatar';
  groupPortrait.textContent = String(DEFAULT_CREATOR_AGENTS.length);
  const groupName = document.createElement('span');
  groupName.textContent = 'Studio Crew';
  groupButton.append(groupPortrait, groupName);
  tabs.appendChild(groupButton);
  creatorAgents.forEach(agent => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'creator-studio-terminal-tab';
    button.dataset.creatorTerminalAgent = agent.id;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', 'false');
    button.style.setProperty('--agent-accent', agent.palette?.accent || agent.palette?.primary || '#78a98b');
    const portrait = document.createElement('span');
    portrait.className = 'creator-studio-terminal-tab-avatar';
    portrait.innerHTML = agentAvatarMarkup(agent);
    const name = document.createElement('span');
    name.textContent = agent.name;
    button.append(portrait, name);
    tabs.appendChild(button);
  });
  if (activeCreatorStudioAgentId !== CREATOR_STUDIO_GROUP_ID
    && !creatorAgents.some(agent => agent.id === activeCreatorStudioAgentId)) {
    activeCreatorStudioAgentId = CREATOR_STUDIO_GROUP_ID;
  }
  selectCreatorStudioAgent(activeCreatorStudioAgentId, { forceLoad: options.forceLoad !== false });
}

function openCreatorStudioTerminal(agentId) {
  selectCreatorStudioAgent(agentId, { focus: true });
  const panel = document.getElementById('creator-studio-terminal');
  panel?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function sendCreatorStudioMessage() {
  const agentId = activeCreatorStudioAgentId;
  const isGroup = agentId === CREATOR_STUDIO_GROUP_ID;
  const agent = creatorAgents.find(item => item.id === agentId);
  const targetName = isGroup ? 'Studio Crew' : (agent?.name || 'Creator agent');
  const input = document.getElementById('creator-studio-chat-input');
  const sendButton = document.getElementById('creator-studio-chat-send');
  const message = String(input?.value || '').trim();
  if ((!isGroup && !agent) || !message || creatorStudioBusyAgents.has(agentId)) return;
  if (!activeProvider || !availableChatProviders.some(provider => provider.id === activeProvider)) {
    creatorStudioStatus('Pilih provider AI live terlebih dahulu. Jika daftar kosong, konfigurasi provider di server.', true);
    return;
  }
  const consentKey = 'kra-chat-provider-consent:' + activeProvider;
  if (providerNeedsConsent(activeProvider) && sessionStorage.getItem(consentKey) !== 'yes') {
    const providerName = availableChatProviders.find(provider => provider.id === activeProvider)?.id || activeProvider;
    const audience = isGroup ? 'pesan dan konteks ini akan dibaca oleh keempat specialist Creator' : 'pesan dan konteks channel Studio ini';
    const approved = window.confirm(audience + ' dan dikirim ke ' + providerName + '. Lanjutkan?');
    if (!approved) return;
    sessionStorage.setItem(consentKey, 'yes');
  }
  input.value = '';
  renderCreatorStudioMessage(message, agentId, true);
  creatorStudioBusyAgents.add(agentId);
  if (sendButton) sendButton.disabled = true;
  creatorStudioStatus(isGroup ? 'Studio Crew sedang menyusun balasan bersama…' : 'Mengirim pesan ke ' + targetName + '…');
  let replyCount = 0;
  let hasError = false;
  let hasProposal = false;
  try {
    const response = await fetch('../api/index.php?action=chat-agent&stream=1', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        channel: creatorStudioChannelFor(agentId), ...(isGroup ? {} : { agentId }), message,
        provider: activeProvider, model: activeModel, projectRoot: activeWorkspaceRoot,
      }),
    });
    const completion = await consumeChatAgentResponse(response, creatorStudioChannelFor(agentId), (reply, provider) => {
      replyCount += 1;
      hasError ||= Boolean(reply.error);
      if (activeCreatorStudioAgentId === agentId) {
        renderCreatorStudioMessage(reply.message, agentId, false, '', Boolean(reply.error), reply.sender || reply.agentId);
      }
      if (reply.proposal) {
        hasProposal = true;
        if (activeCreatorStudioAgentId === agentId) creatorStudioStatus('Proposal dibuat oleh ' + (reply.sender || 'specialist') + ' dan menunggu approval Task Board.');
        openProposalFromChat(reply.proposal, reply.agentId);
      }
    });
    if (activeCreatorStudioAgentId === agentId && !hasProposal) {
      creatorStudioStatus(hasError
        ? (isGroup ? 'Sebagian specialist tidak mendapat balasan. Periksa provider atau coba lagi.' : 'Provider tidak merespons. Coba lagi atau pilih provider lain.')
        : (isGroup ? 'Studio Crew selesai · ' + replyCount + ' specialist · ' + (completion.provider || activeProvider)
          : 'LIVE · ' + (completion.provider || activeProvider)), hasError);
    }
  } catch (error) {
    if (activeCreatorStudioAgentId === agentId) {
      renderCreatorStudioMessage(error.message, agentId, false, '', true, targetName);
      creatorStudioStatus('Chat gagal: ' + error.message, true);
    }
  } finally {
    creatorStudioBusyAgents.delete(agentId);
    if (activeCreatorStudioAgentId === agentId && sendButton) sendButton.disabled = false;
  }
}

function initCreatorStudioTerminal() {
  const tabs = document.getElementById('creator-studio-terminal-tabs');
  const form = document.getElementById('creator-studio-terminal-form');
  const input = document.getElementById('creator-studio-chat-input');
  tabs?.addEventListener('click', event => {
    const button = event.target.closest('[data-creator-terminal-agent]');
    if (button) selectCreatorStudioAgent(button.dataset.creatorTerminalAgent, { focus: true });
  });
  form?.addEventListener('submit', event => {
    event.preventDefault();
    sendCreatorStudioMessage();
  });
  input?.addEventListener('keydown', event => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      form?.requestSubmit();
    }
  });
  creatorStudioProviderSelect?.addEventListener('change', () => {
    activeProvider = creatorStudioProviderSelect.value;
    activeModel = '';
    localStorage.setItem('kra-chat-provider', activeProvider);
    localStorage.removeItem('kra-model');
    if (chatProviderSelect) chatProviderSelect.value = activeProvider;
  });
}

async function refreshCreatorWorkflows() {
  const select = document.getElementById('creator-workflow-select');
  if (!select) return;
  try {
    const response = await fetch('../api/index.php?action=workflow-list');
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'Workflow list is unavailable.');
    creatorWorkflows = Array.isArray(payload.workflows) ? payload.workflows : [];
    select.replaceChildren(new Option('Choose saved flow…', ''));
    creatorWorkflows.forEach(workflow => {
      const option = new Option(workflow.title + ' · ' + workflow.status, workflow.id);
      select.add(option);
    });
    if (activeCreatorWorkflowId && creatorWorkflows.some(flow => flow.id === activeCreatorWorkflowId)) {
      select.value = activeCreatorWorkflowId;
    } else if (creatorWorkflows.length) {
      activeCreatorWorkflowId = creatorWorkflows[0].id;
      select.value = activeCreatorWorkflowId;
    }
    const hasSelected = Boolean(select.value);
    document.getElementById('creator-workflow-plan').disabled = !hasSelected;
    document.getElementById('creator-workflow-stage').disabled = !hasSelected;
    document.getElementById('creator-workflow-wave').disabled = !hasSelected;
  } catch (error) {
    creatorWorkflowStatus('Tidak dapat memuat workflow: ' + error.message, true);
  }
}

async function planCreatorWorkflow() {
  const workflow = selectedCreatorWorkflow();
  if (!workflow) {
    creatorWorkflowStatus('Pilih atau simpan workflow terlebih dahulu.', true);
    return;
  }
  const planButton = document.getElementById('creator-workflow-plan');
  planButton.disabled = true;
  try {
    await refreshCreatorWorkflows();
    const response = await fetch('../api/index.php?action=workflow-plan&id=' + encodeURIComponent(workflow.id));
    const plan = await response.json();
    if (!response.ok || !plan.ok) throw new Error(plan.error || 'Plan failed.');
    const waveSelect = document.getElementById('creator-workflow-wave');
    waveSelect.replaceChildren();
    const fresh = selectedCreatorWorkflow() || workflow;
    let nextIncompleteWave = -1;
    plan.parallelWaves.forEach((nodes, index) => {
      const complete = nodes.every(id => fresh.nodes?.[id]?.status === 'EXECUTED');
      const label = 'Stage ' + (index + 1) + (complete ? ' · done' : ' · ' + nodes.length + ' task(s)');
      waveSelect.add(new Option(label, String(index)));
      if (!complete && nextIncompleteWave < 0) nextIncompleteWave = index;
    });
    const canStage = nextIncompleteWave >= 0;
    waveSelect.value = String(Math.max(0, nextIncompleteWave));
    waveSelect.disabled = !canStage;
    document.getElementById('creator-workflow-stage').disabled = !canStage;
    creatorWorkflowStatus(canStage
      ? 'Plan siap: ' + plan.totalNodes + ' task node dalam ' + plan.parallelWaves.length
        + ' stage. Setiap file tetap menunggu approval di Task Board; tahap berikutnya terkunci sampai approval sebelumnya dieksekusi. Produksi video/YouTube tidak dijalankan oleh scaffold ini.'
      : 'Semua task workflow ini sudah dieksekusi. Produksi video dan upload YouTube tetap di luar cakupan engine ini.');
  } catch (error) {
    creatorWorkflowStatus('Plan gagal: ' + error.message, true);
  } finally {
    planButton.disabled = false;
  }
}

function initCreatorWorkflowControls() {
  const title = document.getElementById('creator-workflow-title');
  const select = document.getElementById('creator-workflow-select');
  document.getElementById('creator-workflow-save')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    const workflowTitle = title.value.trim();
    if (!workflowTitle) {
      creatorWorkflowStatus('Masukkan nama workflow.', true);
      title.focus();
      return;
    }
    button.disabled = true;
    creatorWorkflowStatus('Menyimpan workflow scaffold lokal…');
    try {
      const response = await fetch('../api/index.php?action=workflow-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: workflowTitle, creatorStarter: true }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.id) throw new Error(payload.error || 'Workflow could not be saved.');
      activeCreatorWorkflowId = payload.id;
      await refreshCreatorWorkflows();
      select.value = activeCreatorWorkflowId;
      creatorWorkflowStatus('Workflow tersimpan (' + payload.id + '). Tidak ada file yang ditulis saat menyimpan; gunakan CHECK PLAN lalu antrekan task bila siap.');
      await planCreatorWorkflow();
    } catch (error) {
      creatorWorkflowStatus('Gagal menyimpan workflow: ' + error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  select?.addEventListener('change', () => {
    activeCreatorWorkflowId = select.value;
    const workflow = selectedCreatorWorkflow();
    if (workflow) title.value = workflow.title;
    document.getElementById('creator-workflow-plan').disabled = !workflow;
    document.getElementById('creator-workflow-stage').disabled = !workflow;
    document.getElementById('creator-workflow-wave').disabled = !workflow;
    if (workflow) planCreatorWorkflow();
  });
  document.getElementById('creator-workflow-load')?.addEventListener('click', planCreatorWorkflow);
  document.getElementById('creator-workflow-plan')?.addEventListener('click', planCreatorWorkflow);
  document.getElementById('creator-workflow-stage')?.addEventListener('click', async event => {
    const workflow = selectedCreatorWorkflow();
    if (!workflow) return;
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const response = await fetch('../api/index.php?action=workflow-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: workflow.id, wave: Number(document.getElementById('creator-workflow-wave').value || 0) }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not queue this workflow stage.');
      await refreshCreatorWorkflows();
      creatorWorkflowStatus('Stage masuk ke Task Board: ' + payload.staged.map(item => item.taskId).join(', ')
        + '. Buka Task Board dan approve tiap file-write proposal. Tidak ada video yang dibuat atau di-upload.');
    } catch (error) {
      creatorWorkflowStatus('Stage tertahan: ' + error.message, true);
    } finally {
      button.disabled = false;
      await planCreatorWorkflow();
    }
  });
  document.getElementById('creator-open-tasks')?.addEventListener('click', () => openTaskBoard('creator'));
  refreshCreatorWorkflows();
}

function n100nStatusMessage(message, isError = false) {
  const target = document.getElementById('creator-n100n-status');
  if (target) {
    target.textContent = message;
    target.classList.toggle('is-error', isError);
  }
}

function showN100nResult(value) {
  const result = document.getElementById('creator-n100n-result');
  if (!result) return;
  result.textContent = JSON.stringify(value, null, 2);
  result.classList.remove('hidden');
}

async function creatorN100nRequest(action, options = {}) {
  const { query, ...requestOptions } = options;
  const params = new URLSearchParams({ action });
  Object.entries(query || {}).forEach(([key, value]) => params.set(key, String(value)));
  const response = await fetch('../api/index.php?' + params.toString(), requestOptions);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) throw new Error(payload.error || ('KRA N100N request failed (' + response.status + ').'));
  return payload;
}

async function checkCreatorN100nConnection() {
  const button = document.getElementById('creator-n100n-check');
  const summary = document.getElementById('creator-n100n-summary');
  const badge = document.getElementById('creator-n100n-badge');
  if (button) button.disabled = true;
  if (badge) badge.textContent = 'CHECKING';
  n100nStatusMessage('Memeriksa koneksi server KRA ke N100N…');
  try {
    const payload = await creatorN100nRequest('n100n-status');
    if (payload.connected) {
      if (summary) summary.textContent = 'N100N · connected';
      if (badge) badge.textContent = 'CONNECTED';
      n100nStatusMessage('N100N terhubung. ' + Number(payload.workflowCount || 0) + ' workflow tersedia. Klik LOAD WORKFLOWS untuk memilih alur.');
    } else {
      if (summary) summary.textContent = payload.configured ? 'N100N · offline' : 'N100N · setup required';
      if (badge) badge.textContent = payload.configured ? 'OFFLINE' : 'SETUP REQUIRED';
      n100nStatusMessage(payload.message || 'N100N belum terkonfigurasi pada server KRA.', true);
    }
    return payload;
  } catch (error) {
    if (summary) summary.textContent = 'N100N · unavailable';
    if (badge) badge.textContent = 'UNAVAILABLE';
    n100nStatusMessage(error.message, true);
    return null;
  } finally {
    if (button) button.disabled = false;
  }
}

function initCreatorN100nConnector() {
  const workflowSelect = document.getElementById('creator-n100n-workflow');
  const loadButton = document.getElementById('creator-n100n-load');
  const runButton = document.getElementById('creator-n100n-run');
  const executionInput = document.getElementById('creator-n100n-execution-id');
  const checkButton = document.getElementById('creator-n100n-check-execution');
  document.getElementById('creator-n100n-check')?.addEventListener('click', checkCreatorN100nConnection);

  loadButton?.addEventListener('click', async () => {
    loadButton.disabled = true;
    n100nStatusMessage('Memuat daftar workflow dari N100N…');
    try {
      const payload = await creatorN100nRequest('n100n-workflows');
      const workflows = Array.isArray(payload.workflows) ? payload.workflows : [];
      workflowSelect.replaceChildren(new Option('Pilih workflow N100N…', ''));
      workflows.forEach(workflow => {
        const id = workflow.id ?? workflow.workflow_id ?? workflow.workflowId;
        if (id === undefined || id === null || String(id).trim() === '') return;
        const name = workflow.name || workflow.title || workflow.label || ('Workflow ' + id);
        workflowSelect.add(new Option(String(name) + ' · #' + id, String(id)));
      });
      workflowSelect.disabled = workflowSelect.options.length <= 1;
      if (runButton) runButton.disabled = !workflowSelect.value;
      const total = Math.max(0, workflowSelect.options.length - 1);
      const summary = document.getElementById('creator-n100n-summary');
      const badge = document.getElementById('creator-n100n-badge');
      if (summary) summary.textContent = 'N100N · connected';
      if (badge) badge.textContent = 'CONNECTED';
      n100nStatusMessage(total ? total + ' workflow siap dipilih. Periksa inputnya sebelum menjalankan.' : 'Koneksi hidup, tetapi daftar workflow kosong atau format daftar tidak dikenali.', !total);
    } catch (error) {
      workflowSelect.disabled = true;
      if (runButton) runButton.disabled = true;
      n100nStatusMessage('Gagal memuat workflow: ' + error.message, true);
    } finally {
      loadButton.disabled = false;
    }
  });

  workflowSelect?.addEventListener('change', () => {
    if (runButton) runButton.disabled = !workflowSelect.value;
  });

  runButton?.addEventListener('click', async () => {
    const workflowId = workflowSelect.value;
    if (!workflowId) return;
    let items;
    try {
      items = JSON.parse(document.getElementById('creator-n100n-items').value);
      if (!Array.isArray(items)) throw new Error('Input harus berupa JSON array.');
    } catch (error) {
      n100nStatusMessage('JSON input tidak valid: ' + error.message, true);
      return;
    }
    if (!window.confirm('Jalankan workflow N100N terpilih? Workflow ini dapat memulai pekerjaan atau efek eksternal di N100N.')) return;
    runButton.disabled = true;
    n100nStatusMessage('Mengirim workflow ke N100N melalui server KRA…');
    try {
      const payload = await creatorN100nRequest('n100n-run', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ workflow_id: Number(workflowId), items }),
      });
      const executionId = payload.executionId || payload.result?.execution_id || payload.result?.executionId || '';
      if (executionId && executionInput) executionInput.value = String(executionId);
      showN100nResult(payload.result ?? payload);
      n100nStatusMessage(executionId
        ? 'Workflow dijalankan. Execution ID ' + executionId + ' tersimpan untuk pengecekan hasil.'
        : 'Workflow dijalankan. N100N tidak menyertakan execution ID pada respons; detail respons ada di bawah.');
    } catch (error) {
      n100nStatusMessage('Workflow tidak dapat dijalankan: ' + error.message, true);
    } finally {
      runButton.disabled = !workflowSelect.value;
    }
  });

  checkButton?.addEventListener('click', async () => {
    const executionId = String(executionInput?.value || '').trim();
    if (!executionId) {
      n100nStatusMessage('Masukkan execution ID terlebih dahulu.', true);
      return;
    }
    checkButton.disabled = true;
    n100nStatusMessage('Memeriksa hasil execution ' + executionId + '…');
    try {
      const payload = await creatorN100nRequest('n100n-execution', { query: { id: executionId } });
      showN100nResult(payload.execution ?? payload);
      n100nStatusMessage('Status execution diperbarui dari N100N.');
    } catch (error) {
      n100nStatusMessage('Hasil execution belum tersedia: ' + error.message, true);
    } finally {
      checkButton.disabled = false;
    }
  });

  checkCreatorN100nConnection();
}

let vaultBrowserPath = '';

function vaultSettingsMessage(message, isError = false) {
  const target = document.getElementById('obsidian-vault-message');
  if (!target) return;
  target.textContent = message;
  target.classList.toggle('is-error', isError);
}

async function vaultSettingsRequest(action, options = {}, query = {}) {
  const params = new URLSearchParams({ action });
  Object.entries(query).forEach(([key, value]) => params.set(key, String(value)));
  const response = await fetch('../api/index.php?' + params.toString(), options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) throw new Error(payload.error || ('Vault request failed (' + response.status + ').'));
  return payload;
}

function renderVaultSettingsStatus(payload) {
  const path = String(payload.path || '');
  const currentPath = document.getElementById('obsidian-vault-current-path');
  const currentState = document.getElementById('obsidian-vault-current-state');
  const summary = document.getElementById('vault-settings-summary');
  if (currentPath) currentPath.textContent = path || 'Belum dipilih';
  if (!path) {
    if (currentState) currentState.textContent = 'Belum ada folder vault aktif.';
    if (summary) summary.textContent = 'NOT SET';
    return;
  }
  const state = !payload.exists ? 'Folder tidak ditemukan di server.'
    : !payload.writable ? 'Folder ditemukan, tetapi server tidak memiliki izin tulis.'
      : payload.isObsidianVault ? 'Vault terdeteksi dan writable oleh server KRA.'
        : 'Folder writable, tetapi tidak ditemukan folder konfigurasi .obsidian.';
  if (currentState) currentState.textContent = state;
  if (summary) summary.textContent = payload.exists && payload.writable ? 'VAULT READY' : 'CHECK PATH';
}

function renderVaultBrowser(payload) {
  const list = document.getElementById('obsidian-vault-folder-list');
  const current = document.getElementById('obsidian-vault-browser-path');
  const parent = document.getElementById('obsidian-vault-parent');
  if (!list) return;
  vaultBrowserPath = String(payload.path || '');
  if (current) current.textContent = vaultBrowserPath || 'Drives / server roots';
  if (parent) {
    parent.disabled = !payload.parent;
    parent.dataset.parentPath = String(payload.parent || '');
  }
  const entries = vaultBrowserPath
    ? (payload.dirs || []).map(dir => ({ name: dir.name, path: dir.path, type: 'folder' }))
    : (payload.roots || []).map(root => ({ name: root.name, path: root.path, type: 'root' }));
  list.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'obsidian-vault-folder-empty';
    empty.textContent = vaultBrowserPath ? 'Tidak ada subfolder yang dapat dibuka di sini.' : 'Server tidak melaporkan drive/root yang dapat dijelajahi. Anda tetap dapat memasukkan path manual.';
    list.appendChild(empty);
    return;
  }
  entries.forEach(entry => {
    const button = document.createElement('button');
    button.className = 'obsidian-vault-folder';
    button.type = 'button';
    button.setAttribute('role', 'option');
    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = entry.type === 'root' ? '▣' : '📁';
    const label = document.createElement('span');
    label.textContent = entry.name;
    button.append(icon, label);
    button.title = entry.path;
    button.addEventListener('click', () => browseVaultFolder(entry.path));
    list.appendChild(button);
  });
}

async function browseVaultFolder(path = '') {
  vaultSettingsMessage('Membaca daftar folder di server…');
  try {
    const payload = await vaultSettingsRequest('vault-browse', {}, path ? { path } : {});
    renderVaultBrowser(payload);
    const input = document.getElementById('obsidian-vault-path');
    if (path && input) input.value = String(payload.path || path);
    vaultSettingsMessage('Pilih folder vault lalu tekan SAVE VAULT FOLDER. KRA hanya menampilkan nama subfolder, bukan isi file.');
  } catch (error) {
    vaultSettingsMessage(error.message, true);
  }
}

async function openObsidianVaultSettings() {
  const modal = document.getElementById('obsidian-vault-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  vaultSettingsMessage('Membaca pengaturan vault…');
  try {
    const payload = await vaultSettingsRequest('vault-settings');
    renderVaultSettingsStatus(payload);
    const input = document.getElementById('obsidian-vault-path');
    if (input) input.value = String(payload.path || '');
    await browseVaultFolder(String(payload.path || ''));
  } catch (error) {
    vaultSettingsMessage(error.message, true);
  }
}

function closeObsidianVaultSettings() {
  document.getElementById('obsidian-vault-modal')?.classList.add('hidden');
}

function initObsidianVaultSettings() {
  const modal = document.getElementById('obsidian-vault-modal');
  const settingsButton = document.getElementById('btn-obsidian-vault-settings');
  settingsButton?.addEventListener('click', () => {
    document.getElementById('settings-menu')?.classList.add('hidden');
    document.getElementById('btn-settings-menu')?.setAttribute('aria-expanded', 'false');
    openObsidianVaultSettings();
  });
  document.getElementById('obsidian-vault-close')?.addEventListener('click', closeObsidianVaultSettings);
  document.getElementById('obsidian-vault-cancel')?.addEventListener('click', closeObsidianVaultSettings);
  modal?.addEventListener('click', event => { if (event.target === modal) closeObsidianVaultSettings(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modal?.classList.contains('hidden')) closeObsidianVaultSettings();
  });
  document.getElementById('obsidian-vault-roots')?.addEventListener('click', () => browseVaultFolder(''));
  document.getElementById('obsidian-vault-parent')?.addEventListener('click', event => {
    const parent = event.currentTarget.dataset.parentPath || '';
    if (parent) browseVaultFolder(parent);
  });
  document.getElementById('obsidian-vault-native-picker')?.addEventListener('click', async () => {
    if (window.kraDesktop && typeof window.kraDesktop.selectFolder === 'function') {
      try {
        const selected = await window.kraDesktop.selectFolder();
        if (selected) {
          document.getElementById('obsidian-vault-path').value = selected;
          vaultSettingsMessage('Folder dipilih. Tekan SAVE VAULT FOLDER untuk mengaktifkannya.');
          return;
        }
      } catch (error) { vaultSettingsMessage('Folder picker desktop gagal: ' + error.message, true); }
    }
    vaultSettingsMessage('Pilih folder melalui daftar server di bawah atau masukkan path folder yang valid.', true);
    browseVaultFolder(vaultBrowserPath);
  });
  document.getElementById('obsidian-vault-save')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    const path = document.getElementById('obsidian-vault-path').value.trim();
    if (!path) {
      vaultSettingsMessage('Pilih atau masukkan path folder vault terlebih dahulu.', true);
      return;
    }
    button.disabled = true;
    vaultSettingsMessage('Memvalidasi izin folder dan menyimpan konfigurasi…');
    try {
      const payload = await vaultSettingsRequest('vault-select', {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ path }),
      });
      renderVaultSettingsStatus(payload);
      document.getElementById('obsidian-vault-path').value = String(payload.path || path);
      const note = payload.isObsidianVault
        ? 'Vault Obsidian tersimpan. Save Memory, recall, meeting notes, dan laporan KRA akan menggunakan folder ini. Catatan lama tidak dipindahkan.'
        : 'Folder tersimpan dan writable. Folder .obsidian belum ditemukan; pastikan ini memang root vault yang Anda inginkan. Catatan lama tidak dipindahkan.';
      vaultSettingsMessage(note, !payload.isObsidianVault);
    } catch (error) {
      vaultSettingsMessage(error.message, true);
    } finally {
      button.disabled = false;
    }
  });
  vaultSettingsRequest('vault-settings').then(renderVaultSettingsStatus).catch(() => {
    const summary = document.getElementById('vault-settings-summary');
    if (summary) summary.textContent = 'UNAVAILABLE';
  });
}

function initAppModeSwitcher() {
  initCreatorStudioTerminal();
  initCreatorWorkflowControls();
  initCreatorN100nConnector();
  initObsidianVaultSettings();
  if (!window.KRA_CREATOR_ACTIVITY_TIMER) {
    window.KRA_CREATOR_ACTIVITY_TIMER = window.setInterval(updateCreatorAmbientLabels, 900);
  }
  const officeView = document.getElementById('office-mode');
  const creatorView = document.getElementById('creator-mode');
  const modeButtons = [...document.querySelectorAll('[data-app-mode]')];
  const appTitle = document.querySelector('.app-title');
  const originalTitle = appTitle?.textContent || 'Kantor-Rama-AI // Virtual Office';

  function setMode(mode, persist = true) {
    const creatorActive = mode === 'creator';
    if (typeof taskBoardModal !== 'undefined' && !taskBoardModal.classList.contains('hidden')) {
      taskBoardModal.classList.add('hidden');
    }
    document.body.classList.toggle('creator-mode-active', creatorActive);
    officeView?.classList.toggle('hidden', creatorActive);
    creatorView?.classList.toggle('hidden', !creatorActive);
    modeButtons.forEach(button => {
      const active = button.dataset.appMode === (creatorActive ? 'creator' : 'office');
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (appTitle) appTitle.textContent = creatorActive ? 'Kantor-Rama-AI // Content Creator Studio' : originalTitle;
    if (creatorActive) {
      refreshCreatorWorkflows();
      renderCreatorTeam();
      window.KRACreatorSceneRenderer?.resize();
    }
    if (persist) {
      try { localStorage.setItem('kra-app-mode', creatorActive ? 'creator' : 'office'); } catch (_) { /* Optional preference only. */ }
    }
  }

  let initialMode = 'office';
  try { initialMode = localStorage.getItem('kra-app-mode') === 'creator' ? 'creator' : 'office'; } catch (_) { /* Default to office. */ }
  setMode(initialMode, false);
  modeButtons.forEach(button => button.addEventListener('click', () => setMode(button.dataset.appMode)));

  const youtubeModal = document.getElementById('youtube-settings-modal');
  // Header menus are managed once by the shared .hud-dropdown controller above.
  // A second click handler here used to toggle Settings open and immediately closed.
  const settingsMenu = document.getElementById('settings-menu');
  const settingsMenuButton = document.getElementById('btn-settings-menu');
  const openYouTubeSettings = () => {
    settingsMenu?.classList.add('hidden');
    settingsMenuButton?.setAttribute('aria-expanded', 'false');
    youtubeModal?.classList.remove('hidden');
    document.getElementById('youtube-settings-close')?.focus();
  };
  document.getElementById('btn-youtube-settings')?.addEventListener('click', openYouTubeSettings);
  document.getElementById('creator-youtube-settings')?.addEventListener('click', openYouTubeSettings);
  document.querySelectorAll('[data-open-youtube-settings]').forEach(button => button.addEventListener('click', openYouTubeSettings));
  const closeYouTubeSettings = () => youtubeModal?.classList.add('hidden');
  document.getElementById('youtube-settings-close')?.addEventListener('click', closeYouTubeSettings);
  youtubeModal?.addEventListener('click', event => { if (event.target === youtubeModal) closeYouTubeSettings(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !youtubeModal?.classList.contains('hidden')) closeYouTubeSettings(); });
}

async function boot() {
  initAppModeSwitcher();
  initAgentRosterDrawer();
  drawPortrait();
  buildRoster();
  updateRoomDirectory();
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
switchChatChannel('terminal');
// Atlas and initial visual readiness should not wait for backend roster/presence latency.
const atlasInitialization = initOfficeAtlas().then(() => {
    window.KRA_APP_ATLAS_READY_AT = performance.now();
  });
render();
hydrateAgentState().then(() => {
    buildRoster();
    drawPortrait();
    updateRoomDirectory();
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
