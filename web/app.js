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

if (!localStorage.getItem('kra_auth_token')) {
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
  1: Object.freeze({ map: { w: 40, h: 14, corridorY: 6 } }),
  2: (window.KRAAssetRegistry && window.KRAAssetRegistry.FLOOR2_6DECK_44x12)
  || Object.freeze({ map: { w: 44, h: 12, corridorY: 5 } })
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
    { id: 'server', label: 'SERVER ROOM - JARVIS', x: 0, y: 0, w: 10, h: 6, floor: 'serverMetal', wall: 'server', accent: '#00F5D4', rug: null },
    { id: 'manager', label: 'MANAGER - RAMA', x: 10, y: 0, w: 10, h: 6, floor: 'execWood', wall: 'exec', accent: '#F4D35E', rug: { x: 12.2, y: 1.7, w: 5.6, h: 2.55, fill: '#232733', trim: '#C9A24B' } },
    { id: 'studio', label: 'STUDIO - MAYA', x: 20, y: 0, w: 10, h: 6, floor: 'studioWood', wall: 'studio', accent: '#FF6B6B', rug: { x: 21.8, y: 1.7, w: 6.4, h: 2.7, fill: '#8E7F6A', trim: '#5F5344' } },
    { id: 'lobby', label: 'LOBBY - KRA', x: 30, y: 0, w: 10, h: 6, floor: 'marble', wall: 'lobby', accent: '#B197FC', rug: { x: 32.4, y: 1.7, w: 4.2, h: 2.6, fill: '#7A2436', trim: '#C9A24B' } },
    { id: 'records', label: 'RECORDS - SITI', x: 0, y: 8, w: 10, h: 6, floor: 'recordsWood', wall: 'records', accent: '#6BCF7F', rug: { x: 0.9, y: 9.65, w: 4.4, h: 2.7, fill: '#14635C', trim: '#0B3F3A' } },
    { id: 'meeting', label: 'MEETING - BUDI', x: 10, y: 8, w: 10, h: 6, floor: 'meetingWood', wall: 'meeting', accent: '#4ECDC4', rug: { x: 12.0, y: 9.35, w: 5.0, h: 3.3, fill: '#177E72', trim: '#0D4A44' } },
    { id: 'pantry', label: 'PANTRY - TEAM', x: 20, y: 8, w: 10, h: 6, floor: 'pantryTile', wall: 'pantry', accent: '#F4D35E', rug: null },
    { id: 'play', label: 'PLAY - DIMAS', x: 30, y: 8, w: 10, h: 6, floor: 'playWood', wall: 'play', accent: '#FF6B6B', rug: { x: 33.2, y: 10.35, w: 3.6, h: 2.1, fill: '#4B2A6E', trim: '#2A1844' } }
  ],
2: [
  { id: 'warroom', label: '01 EMERGENCY WAR ROOM', x: 0, y: 0, w: 15, h: 5, floor: 'warSlate', wall: 'war', accent: '#00F5D4', rug: { x: 4.0, y: 2.2, w: 7.0, h: 2.1, fill: '#5E2230', trim: '#2E1219' } },
  { id: 'innovation', label: '02 INNOVATION STUDIO', x: 15, y: 0, w: 15, h: 5, floor: 'innoWood', wall: 'inno', accent: '#FF007F', rug: { x: 16.0, y: 2.0, w: 12.0, h: 2.1, fill: '#4E2A52', trim: '#2C1830' } },
  { id: 'aiforge', label: '05 AI FORGE', x: 30, y: 0, w: 14, h: 5, floor: 'aiForge', wall: 'aiforge', accent: '#00F0FF', rug: { x: 31.0, y: 2.0, w: 12.0, h: 2.1, fill: '#123D52', trim: '#0A2637' } },
  { id: 'observatory', label: '03 SYSTEMS OBSERVATORY', x: 0, y: 7, w: 15, h: 5, floor: 'obsSlate', wall: 'obs', accent: '#B197FC', rug: { x: 4.0, y: 8.8, w: 6.0, h: 2.1, fill: '#1D4A54', trim: '#0F2C33' } },
  { id: 'lounge2', label: '04 SKY LOUNGE', x: 15, y: 7, w: 15, h: 5, floor: 'skyWood', wall: 'sky', accent: '#F4D35E', rug: { x: 17.0, y: 8.8, w: 6.0, h: 2.1, fill: '#8A5A3B', trim: '#5E3C24' } },
  { id: 'command', label: '06 COMMAND DECK', x: 30, y: 7, w: 14, h: 5, floor: 'command', wall: 'command', accent: '#FF6B6B', rug: { x: 31.0, y: 8.8, w: 12.0, h: 2.1, fill: '#4A2530', trim: '#2A1119' } }
]
};

// floor[][] : floor-type key per tile (see FLOOR_PAINTERS)
// deco[][] : overlay furniture sprite id per tile (or null); multi-tile
// Argon props anchor at their top-left occupancy tile.
const floor = [];
const deco = [];
const rooms = []; // legacy registry, mirrors ROOM_DEFS for older callers

function room(id, label, x, y, w, h, fL, fD, accent) {
  const r = { id, label, x, y, w, h, fL, fD, accent };
  rooms.push(r);
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
rectFloor(0, CORRIDOR_Y, MAP.w, 2, 'corridor');
}

/* Furniture layouts use Argon atlas ids directly (Batch 1/3/4). Every
multi-tile prop is placed by its occupancy footprint from
argon_office_furniture.json; chairs are sittable (see SITTABLE_FRAMES)
so each agent's home tile can be the chair behind their desk. */
function buildWorld() {
  fillBackground();
  rooms.length = 0;
  applyRoomFloors(1);

  // --- SERVER ROOM - JARVIS (x 0..9) : rack clusters flanking a topology panel
  put(1, 0, '01_srv_cooling_apar_patch');
  put(4, 0, '02_srv_raised_floor_cable_riser_tape');
  put(7, 0, '02_server_rack_jarvis');
  put(1, 3, '02_server_rack_jarvis'); put(2, 3, '02_server_rack_jarvis');
  put(7, 3, '03_srv_tool_trolley_alert_beacon');
  put(0, 4, '10_plant_potted_large');
  put(4, 2, 'p0_clutter_jarvis_server');

  // --- MANAGER - RAMA (x 10..19) : bookshelves, executive desk on a dark rug
  put(11, 0, '04_mgr_panoramic_skyline_window');
  put(15, 0, '07_mgr_framed_verdict_coat_floorlamp');
  put(14, 2, '08_chair_executive');
  put(13, 3, '01_executive_desk_rama');
  put(13, 2, 'p0_clutter_rama_exec');
  put(17, 4, '05_mgr_coffee_table_guest_armchair');
  put(10, 4, '10_plant_potted_large');

  // --- STUDIO - MAYA (x 20..29) : twin workstations under a taskboard
  put(21, 0, '08_stu_swatch_typo_wallshelf');
  put(25, 0, '10_stu_material_rack_print_wall');
  put(23, 2, '09_chair_ergonomic');
  put(23, 3, '03_workstation_maya');
  put(23, 2, 'p0_clutter_maya_studio');
  put(26, 2, '09_chair_ergonomic');
  put(26, 3, '03_workstation_maya');
  put(20, 4, '10_plant_potted_large');

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
  put(34, 11, '24_ply_beanbags_orange_cyan');
  put(37, 12, '25_ply_controller_headphone_posters_snack');
  put(34, 10, 'p0_clutter_dimas_play');

  floorMaps[1] = { map: { w: 40, h: 14, corridorY: 6 }, floor: floor.map(row => row.slice()), deco: deco.map(row => row.slice()) };
  activateMapPreset(2);
  buildSecondFloor();
  floorMaps[2] = { map: { w: MAP.w, h: MAP.h, corridorY: CORRIDOR_Y }, floor: floor.map(row => row.slice()), deco: deco.map(row => row.slice()) };
  activateMapPreset(1);
  activeFloor = 1;
  for (let y = 0; y < MAP.h; y += 1) { floor[y] = floorMaps[1].floor[y].slice(); deco[y] = floorMaps[1].deco[y].slice(); }
}

function buildSecondFloor() {
  fillBackground();
  applyRoomFloors(2);

  // --- EMERGENCY WAR ROOM (x 0..14)
  put(1, 0, '03_war_server_rack_cables_ref');
  put(4, 0, '01_war_tower_headset_case_clock');
  put(8, 0, '02_war_projector_seats_evac_redfx');
  put(1, 2, '01_war_command_table_4x2');
  put(0, 3, '10_plant_potted_large'); put(14, 3, '10_plant_potted_large');

  // --- INNOVATION STUDIO (x 15..29)
  put(16, 0, '06_inno_invention_wall_conveyor_fx');
  put(20, 0, '04_inno_material_shelf_robotics_arm');
  put(24, 0, '05_inno_soldering_bench_parts_bins');
  put(21, 2, '05_inno_hotdesk_modular_2x1'); put(24, 2, '05_inno_hotdesk_modular_2x1');

  // --- AI FORGE (x 30..43)
  put(31, 0, '13_aif_compute_pod_gpu_rack');
  put(34, 0, '14_aif_training_display_data_crystal');
  put(38, 0, '15_aif_cooling_pipes_hologram_fx');

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

function loadFloor(level, animate = true) {
  const snapshot = floorMaps[level];
  if (!snapshot) return;
  activateMapPreset(level);
  resizeWorldCanvas();
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

let W = canvas.width;
let H = canvas.height;

function resizeWorldCanvas() {
  const width = MAP.w * T;
  const height = MAP.h * T;
  if (canvas.width === width && canvas.height === height) return;
  canvas.width = width;
  canvas.height = height;
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  W = width;
  H = height;
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
paintRunwayCarpet(g);
// door thresholds: light mat at each room's corridor-side centre
g.fillStyle = 'rgba(240,230,210,0.85)';
ROOM_DEFS[activeFloor].forEach(r => {
    const cx = Math.round((r.x + r.w / 2) * T) - 13;
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
    // Base paths normalized to root for domain compatibility
    const response = await fetch('assets/voxel/atlas/argon_office_furniture.json' + cacheKey, { cache: 'force-cache' });
    if (!response.ok) throw new Error('Atlas metadata request failed: ' + response.status);
    const metadata = await response.json();
    const baseUrl = new URL('assets/voxel/atlas/', window.location.origin + window.location.pathname);
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
  x: 36.2, y: 12.35, tx: 36.2, ty: 12.35,
  anim: 'cybercat_curl_near_couch', wait: 500, leg: 0, flip: false
};
const CYBERCAT_ROUTE = [
  { x: 36.2, y: 12.35, anim: 'cybercat_curl_near_couch', wait: 700 },
  { x: 31.4, y: 12.35, anim: 'cybercat_walk', wait: 40 },
  { x: 31.4, y: 6.9, anim: 'cybercat_walk', wait: 30 },
  { x: 19.2, y: 6.9, anim: 'cybercat_walk', wait: 160, rest: 'cybercat_inspect_terminal' },
  { x: 3.0, y: 6.9, anim: 'cybercat_walk', wait: 140, rest: 'cybercat_idle' },
  { x: 31.4, y: 6.9, anim: 'cybercat_walk', wait: 30 },
  { x: 31.4, y: 12.35, anim: 'cybercat_walk', wait: 40 },
  { x: 36.2, y: 12.35, anim: 'cybercat_walk', wait: 0, rest: 'cybercat_sleep' }
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
    { x: 13.1, y: 3.02, id: '16_decor_award_plaque_snack_bowl' },
    { x: 23.05, y: 3.02, id: '13_decor_mug_headset_keyboard' },
    { x: 2.05, y: 11.02, id: '14_decor_globe_mini_robot' },
    { x: 13.5, y: 10.45, id: '15_decor_sticky_notes_cable_coil' },
    { x: 33.4, y: 2.55, id: '16_decor_award_plaque_snack_bowl' }
  ],
2: [
  { x: 9.0, y: 3.5, id: '15_decor_sticky_notes_cable_coil' },
  { x: 8.2, y: 11.45, id: '13_decor_mug_headset_keyboard' }
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
  ctx.save();
  ctx.strokeStyle = agent.palette.accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(Math.round(agent.x * T + 3), Math.round(agent.y * T + 1), 26, 32);
  ctx.restore();
}
drawWorldBubble(agent);
}
}

/* ---------- 3B. ARCHITECTURE, LIGHTING & LABELS ----------
Static wall treatment is baked per floor (wallLayerCache); only the
elevator doors, server LEDs and arcade glow animate per frame. */
const WALL_HEIGHT = 46;
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
if (r.y > 0) wallDoor(g, x0 + w / 2, y0, st);
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
    const dx = Math.round((r.x + r.w / 2) * T) - 14;
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
const bounds = floorId === 1 ? [10, 20, 30] : [15, 30];
[0, CORRIDOR_Y + 2].forEach(tierTile => {
    const yStart = tierTile * T;
    const yEnd = yStart + 6 * T + (tierTile === 0 ? 21 : 0);
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
  const liftX = 19.5;
  const liftY = CORRIDOR_Y + 1.2;
  for (let i = 0; i < AGENTS.length; i += 1) {
    const agent = AGENTS[i];
    if ((agent.floorId || 1) !== activeFloor) continue;
    if (agent.inTransit) return true;
    if (Math.abs(agent.x - liftX) < 1.4 && Math.abs(agent.y - liftY) < 1.3) return true;
  }
return false;
}

function drawElevatorDoors() {
  const e = elevatorRect();
  const open = Math.floor(clock / 18) % 8 === 6 || agentAtElevator();
  const doorW = Math.floor((e.w - 10) / 2);
  const doorH = e.h - 12;
  const slide = open ? Math.min(doorW - 3, 12) : 0;
  ctx.save();
  ctx.beginPath();
  ctx.rect(e.x + 4, e.y + 11, e.w - 8, doorH);
  ctx.clip();
  const gradL = ctx.createLinearGradient(e.x + 4 - slide, 0, e.x + 4 + doorW - slide, 0);
  gradL.addColorStop(0, '#7D8C9C'); gradL.addColorStop(0.5, '#C4D4E2'); gradL.addColorStop(1, '#687786');
  ctx.fillStyle = gradL;
  ctx.fillRect(e.x + 4 - slide, e.y + 11, doorW, doorH);
  const gradR = ctx.createLinearGradient(e.x + 6 + doorW + slide, 0, e.x + 6 + 2 * doorW + slide, 0);
  gradR.addColorStop(0, '#687786'); gradR.addColorStop(0.5, '#C4D4E2'); gradR.addColorStop(1, '#7D8C9C');
  ctx.fillStyle = gradR;
  ctx.fillRect(e.x + 6 + doorW + slide, e.y + 11, doorW, doorH);
  ctx.fillStyle = '#24303E';
  ctx.fillRect(e.x + 4 + doorW, e.y + 11, 2, doorH);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = '#334155';
  ctx.fillRect(e.x + e.w - 8, e.y + 22, 4, 12);
  ctx.fillStyle = Math.floor(clock / 12) % 2 === 0 ? '#00F5D4' : '#0B6B5E';
  ctx.fillRect(e.x + e.w - 7, e.y + 24, 2, 2);
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(e.x + e.w - 7, e.y + 29, 2, 2);
  ctx.restore();
}

function drawOfficeWalls(floorId) {
  if (!wallLayerCache[floorId]) wallLayerCache[floorId] = buildWallLayer(floorId);
  ctx.drawImage(wallLayerCache[floorId], 0, 0);
  drawElevatorDoors();
}

/* Cached soft lighting: per-room pools + warm lamp glows + vignette. */
const LAMP_GLOWS = {
  1: [[19.5, 2.5], [29.5, 1.5], [4.5, 11.0], [10.5, 9.5], [39.5, 11.5]],
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
    { x: 34.5, y: 11.0, color: '#FF55B8', radius: 58, alpha: 0.10, phase: 3.1 }
  ],
2: [
  { x: 7.5, y: 3.0, color: '#D93838', radius: 70, alpha: 0.12, phase: 0.5 },
  { x: 22.0, y: 2.0, color: '#FF55B8', radius: 66, alpha: 0.11, phase: 1.7 },
  { x: 36.0, y: 2.0, color: '#00F0FF', radius: 98, alpha: 0.19, phase: 2.8 },
  { x: 7.5, y: 9.3, color: '#B197FC', radius: 78, alpha: 0.12, phase: 3.5 },
  { x: 22.0, y: 9.3, color: '#7DEBFF', radius: 74, alpha: 0.12, phase: 4.1 },
  { x: 37.0, y: 9.3, color: '#FF6B6B', radius: 74, alpha: 0.12, phase: 5.0 }
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
    palette: { skin: '#F2C79B', hair: '#241A12', primary: '#1F2A44', accent: '#F4D35E' },
    intro: "Rama: I'm watching the floor. Bring me finished work, not drafts."
  },
{
  id: 'jarvis', name: 'JARVIS', role: 'Infrastructure Daemon / SysAdmin',
  x: 4.5, y: 2.6, homeX: 4.5, homeY: 2.6, floorId: 1, inTransit: false,
  badge: 'badge-ops', status: 'monitoring systems',
  palette: { skin: '#E5B887', hair: '#5C3A21', primary: '#3B82F6', accent: '#00F5D4' },
  intro: 'Jarvis: Core systems operating within nominal parameters.'
},
{
  id: 'creator', name: 'BUDI', role: 'Scaffolding & Asset Production',
  x: 14, y: 9, homeX: 14, homeY: 9, floorId: 1, inTransit: false,
  badge: 'badge-idle', status: 'standing by',
  palette: { skin: '#E8B98A', hair: '#4A2F1B', primary: '#4ECDC4', accent: '#FFF8E7' },
  intro: 'Budi: Ready to scaffold. Point me at a folder.'
},
{
  id: 'modifier', name: 'MAYA', role: 'Code & Config Refactoring',
  x: 23, y: 2, homeX: 23, homeY: 2, floorId: 1, inTransit: false,
  badge: 'badge-idle', status: 'standing by',
  palette: { skin: '#C88B62', hair: '#1A1320', primary: '#FF6B6B', accent: '#FFEC99' },
  intro: 'Maya: Give me a target file and a spec.'
},
{
  id: 'auditor', name: 'DIMAS', role: 'Diagnostics & Security Review',
  x: 34, y: 10, homeX: 34, homeY: 10, floorId: 1, inTransit: false,
  badge: 'badge-auditor', status: 'Scanning for risks.',
  palette: { skin: '#F0D0A8', hair: '#6B4A2B', primary: '#B197FC', accent: '#FF007F' },
  intro: 'Dimas: I read everything. Nothing gets past me.'
},
{
  id: 'ops', name: 'SITI', role: 'Filesystem & Directory Management',
  x: 2, y: 10, homeX: 2, homeY: 10, floorId: 1, inTransit: false,
  badge: 'badge-idle', status: 'standing by',
  palette: { skin: '#E8B98A', hair: '#2B2B2B', primary: '#FFD93D', accent: '#3D2E4A' },
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
  const appearance = agent.appearance;
  if (!appearance) return false;
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
const hdPortraits = new Map();

function loadHDAgentSheet(key) {
  if (hdAgentSheets.has(key)) return hdAgentSheets.get(key);
  const entry = { ready: false, image: null };
  hdAgentSheets.set(key, entry);
  const url = 'assets/argon/Batch8_HD_Humanoid_and_Lighting_Upgrade/Batch8_HD_Upgrade/02_HD_Agent_Spritesheets_32x48/' + key + '_hd_spritesheet_32x48.png';
  loadImageAsset(url).then(img => {
    entry.image = img;
    entry.ready = true;
  }).catch(() => {});
  return entry;
}

function loadHDPortrait(key) {
  if (hdPortraits.has(key)) return hdPortraits.get(key);
  const entry = { ready: false, image: null };
  hdPortraits.set(key, entry);
  const url = 'assets/argon/Batch8_HD_Humanoid_and_Lighting_Upgrade/Batch8_HD_Upgrade/01_UI_Roster_Portraits_64x64/' + key + '_portrait_64x64.png';
  loadImageAsset(url).then(img => {
    entry.image = img;
    entry.ready = true;
    drawPortrait();
  }).catch(() => {});
  return entry;
}

function loadAgentSheet(key) {
  if (agentSheets.has(key)) return agentSheets.get(key);
  const entry = { ready: false, composite: null };
  agentSheets.set(key, entry);
  const base = 'assets/argon/Batch2_Agents_Core/01_Agent_Spritesheets/' + key + '_spritesheet_';
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
  const url = 'assets/argon/Batch5_Cybercat_and_Event_FX/01_Cybercat_Jarvis/' + animId + '_spritesheet.png';
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
    const frame = Math.floor(clock / 8) % 4;
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

/* Boss-side portrait (48px canvas) */
function drawPortrait() {
  const pc = document.getElementById('portrait-canvas');
  if (!pc) return;
  const pctx = pc.getContext('2d');
  pctx.imageSmoothingEnabled = false;

  const currentAgent = selectedAgent || AGENTS[0];
  const ID_MAP = {
    rama: 'rama', jarvis: 'jarvis', creator: 'budi', budi: 'budi',
    modifier: 'maya', maya: 'maya', ops: 'siti', siti: 'siti',
    auditor: 'dimas', dimas: 'dimas'
  };
  const key = ID_MAP[currentAgent.id] || currentAgent.id;
  const hd = loadHDPortrait(key);
  if (hd.ready) {
    pctx.drawImage(hd.image, 0, 0, 64, 64, 0, 0, pc.width, pc.height);
    return;
  }

  const scale = 2;
  pctx.fillStyle = DECO.ink;
  pctx.fillRect(0, 0, 48, 48);
  const pal = currentAgent.palette || AGENTS[0].palette;
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
    { x: 18.5, y: 6.6, status: 'briefing', text: 'Briefing team at elevator.' }
  ],
jarvis: [
  { x: 2.5, y: 2.6, status: 'monitoring systems', text: 'Checking left rack cluster.' },
  { x: 7.5, y: 2.6, status: 'monitoring systems', text: 'Checking right rack cluster.' },
  { x: 24.5, y: 10.5, status: 'thinking', text: 'Refuelling at the pantry.' }
],
creator: [
  { x: 12.5, y: 10.5, status: 'coding', text: 'Working at the war table.' },
  { x: 13.5, y: 9, status: 'building', text: 'Reviewing task board.' },
  { x: 23, y: 10.5, status: 'thinking', text: 'Grabbing espresso.' }
],
modifier: [
  { x: 23, y: 2, status: 'refactoring', text: 'Working behind studio PC.' },
  { x: 21.5, y: 1.5, status: 'refactoring', text: 'Tracing diff on the board.' },
  { x: 16.5, y: 4.5, status: 'walking', text: 'Checking with Rama.' }
],
auditor: [
  { x: 34, y: 10, status: 'auditing', text: 'Playing billiard & risk scan.' },
  { x: 30, y: 10, status: 'auditing', text: 'Scanning for risks.' },
  { x: 6.5, y: 2.6, status: 'thinking', text: 'Auditing the server vault.' }
],
ops: [
  { x: 2, y: 10, status: 'managing', text: 'Working behind records PC.' },
  { x: 4, y: 10, status: 'organizing', text: 'Vault stays tidy.' },
  { x: 7.5, y: 10.5, status: 'monitoring', text: 'Scanning documents.' }
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

  updateCybercat();
  drawFloors();
  drawOfficeWalls(activeFloor);
  drawPropShadows();
  drawDecor();
  drawCustomDecor();
  drawAtlasDecorAndAgents(frame);
  drawSurfaceDecor();
  drawAmbientFX();
  drawLightingOverlay();
  drawCinematicLighting();
  // Final pass: room signs stay readable above walls, furniture and agents.
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

// Status markers above each agent: teal = available, amber = working.
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

let officerSession = localStorage.getItem('kra_auth_token') || '';
let kraActiveOfficer = JSON.parse(localStorage.getItem('kra_active_user') || 'null') || {
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
localStorage.removeItem('kra_auth_token');
localStorage.removeItem('kra_active_user');
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
  // Contain-fit the 40x14 world (1280x448) into the frame; the dark
  // container mat reads as the picture frame from the reference art.
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
      localStorage.removeItem('kra_auth_token');
      localStorage.removeItem('kra_active_user');
      window.location.replace('login.html');
    });
}

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
  div.textContent = text;
  sysLog.appendChild(div);
  sysLog.scrollTop = sysLog.scrollHeight;
  if (KRA_REDUCED_MOTION) return () => div.remove();
  let n = 0;
  const timer = setInterval(() => {
    div.textContent = text + ' ' + '.'.repeat((n++ % 3) + 1);
    sysLog.scrollTop = sysLog.scrollHeight;
  }, 400);
  return () => { clearInterval(timer); div.remove(); };
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
      const ev = JSON.parse(line);
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
  return AGENTS.find(agent => agent.name === sender) || AGENTS[0];
}

function appendChatBubble(sender, message, timestamp, isUser = false) {
  const agent = isUser ? null : agentForSender(sender);
  const agentId = isUser ? (kraUserProfile.avatar.replace('char-', '')) : (agent.id || sender.toLowerCase());
  const row = document.createElement('div');
  row.className = 'chat-message ' + (isUser ? 'chat-message-user' : 'chat-message-agent');
  row.setAttribute('data-agent', agentId);

  const msgRow = document.createElement('div');
  msgRow.className = 'chat-row';

  const avatar = document.createElement('div');
  avatar.className = 'chat-avatar char-' + agentId;
  avatar.title = isUser ? kraUserProfile.displayName : (agent ? agent.name : sender);

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
  // thinking bubbles suppressed per user request; kept as no-op
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
    label: 'PRIVATE CHANNEL ' + name,
    title: name + ' CHAT',
  };
if (!chatTabs || document.querySelector('.chat-tab[data-channel="' + agent.id + '"]')) return;
const tab = document.createElement('button');
tab.className = 'chat-tab hired-chat-tab';
tab.dataset.channel = agent.id;
tab.setAttribute('role', 'tab');
  tab.innerHTML = '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg><span>' + name + '</span>';
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
    chatLiveStatus.textContent = ' COMMAND MODE';
    document.querySelectorAll('.chat-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.channel === 'terminal');
      });
  commandInput.placeholder = 'Type /help or commands (/agent, /create, /audit, /skills, /model)...';
  termLine('live pty /dev/kra-bus [OpenCode Command Mode]', 'sys', false);
  termLine('Type /help to see commands or /agent <name> to switch focus.', 'prompt', false);
  loadChatHistory('terminal');
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

function appendAgentMessage(result) {
  chatLiveStatus.classList.remove('offline');
  chatLiveStatus.textContent = ' LIVE ' + result.provider;
  playSfx('reply');
  const replies = Array.isArray(result.replies) ? result.replies : [result];
  replies.forEach(reply => {
      const msg = reply.message || '';
      // Redirect system reports to Log tab instead of bubbles
      if (msg.includes('Laporan Audit') || msg.includes('Laporan Operasional') || msg.startsWith('[Jarvis]') || msg.startsWith('[Memory]')) {
        termLine(msg, 'sys');
        return;
      }

      // thinking line suppressed per user choice (straight to answer)
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
  termLine('[Approval Gate]: Proposal prepared review before execution.', 'prompt');
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
appendChatBubble(kraUserProfile.displayName, message, new Date(), true);
const stopChatSpinner = startStatusSpinner(chatLiveStatus, ' THINKING');
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
if (typeof stopChatSpinner === 'function') stopChatSpinner();
if (!result.ok) throw new Error(result.error || 'Agent unavailable');
appendAgentMessage(result);
} catch (error) {
if (typeof stopChatSpinner === 'function') stopChatSpinner();
chatLiveStatus.classList.add('offline');
chatLiveStatus.textContent = ' AGENT OFFLINE';
termLine('[Jarvis]: Agent bridge unavailable ' + error.message, 'warn');
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
  appendChatBubble(kraUserProfile.displayName, message, new Date(), true);
  const agentId = activeChatChannel === 'team' ? 'budi' : activeChatChannel;
  chatLiveStatus.textContent = ' REACT LOOP';
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
  appendReactCard('action', 'handoff ' + nextAgent, stepAgent);
  animateReactAgent(nextAgent, 'handoff');
}
});

if (result.budget) {
  const b = result.budget;
  const bText = 'Turns: ' + (result.turns || 1) + ' Tools: ' + (b.toolCalls || 0)
  + ' Reads: ' + (b.reads || 0) + ' (' + (b.readBytes || 0) + 'B) Handoffs: ' + (b.handoffs || 0)
  + ' Stop: ' + (result.stopReason || 'completed');
  appendReactCard('budget', bText, result.agentId || agentId);
  updateAutonomyBudgetMeters(result);
}

const speaker = AGENTS.find(item => item.id === (result.agentId || agentId));
const sender = speaker ? speaker.name : 'Jarvis';
appendChatBubble(sender, result.finalAnswer || 'ReAct loop completed.', new Date());
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
      card.className = 'roster-card' + (a.id === selectedAgent.id ? ' active' : '')
      + (a.id.startsWith('agent-') ? ' hired-agent-card' : '');
      card.style.setProperty('--agent-accent', a.palette.accent);
      card.dataset.id = a.id;
      card.innerHTML = `
      <div class="card-avatar-box"><canvas width="32" height="32"></canvas></div>
      <div class="card-info">
      <div class="card-name-row">
      <span class="card-name">${a.name}</span>
      <span class="card-badge ${a.badge}">FL ${a.floorId || 1} ${a.status}</span>
      </div>
      <div class="card-role">${a.role}</div>
      </div>`;
      const c = card.querySelector('canvas');
      const cc = c.getContext('2d');
      cc.imageSmoothingEnabled = false;
      cc.save();

      const ID_MAP = { rama: 'rama', jarvis: 'jarvis', budi: 'budi', maya: 'maya', siti: 'siti', dimas: 'dimas' };
      const agentKey = ID_MAP[a.id] || (a.appearance?.character || (a.id.startsWith('agent-') ? 'budi' : a.id));
      const sheet = loadAgentSheet(agentKey);

      if (sheet && sheet.ready && sheet.composite) {
        cc.drawImage(sheet.composite, 0, 0, 32, 32, 0, 0, 32, 32);
      } else if (window.KRAAssetRegistry?.drawModularAgent && a.appearance) {
      window.KRAAssetRegistry.drawModularAgent(cc, 'front', { ...a.appearance, palette: a.palette }, 0);
    } else {
    // fallback mini sprite
    const pal = a.palette;
    const q = (x, y, w, h, col) => { cc.fillStyle = col; cc.fillRect(x, y, w, h); };
    cc.fillStyle = '#FCFAF0'; cc.fillRect(0, 0, 32, 32);
    q(8, 2, 16, 12, DECO.ink);
    q(9, 3, 14, 10, pal.skin || '#E8B98A');
    q(8, 1, 16, 4, pal.hair || '#2B2B2B');
    q(11, 7, 3, 3, DECO.ink); q(18, 7, 3, 3, DECO.ink);
    q(8, 14, 16, 12, DECO.ink);
    q(9, 15, 14, 10, pal.primary || '#4ECDC4');
    q(9, 15, 14, 3, pal.accent || '#FFF8E7');
    if (a.id === 'rama') q(14, 17, 4, 8, pal.accent || '#FFF8E7');
    q(10, 26, 5, 4, DECO.ink); q(17, 26, 5, 4, DECO.ink);
  }
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
profileName.textContent = a.name + ' - ' + a.role;
document.querySelectorAll('.roster-card').forEach(c =>
  c.classList.toggle('active', c.dataset.id === id));
drawPortrait();
switchChatChannel(a.id);
showBubble(a.name, a.intro.replace(/^[^:]+:\s*/, ''), 4600);
termLine('[focus] ' + a.name + ' selected ' + a.role, 'info');
}

/* --- Pilar 3: waypoint movement and collision-safe routes --- */
const OFFICE_WAYPOINTS = {
  corridorWest: { x: 4.5, y: 6.6 }, corridorCenter: { x: 19.5, y: 6.6 },
  corridorEast: { x: 34.5, y: 6.6 }, meeting: { x: 14.5, y: 12.5 },
  rama: { x: 14.5, y: 4.2 }, budi: { x: 14.5, y: 12.5 },
  maya: { x: 24.5, y: 4.2 }, dimas: { x: 34.5, y: 12.5 }, siti: { x: 3.5, y: 12.5 }
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
  1: { x: 19.5, y: 7.2 },
  2: { x: 19.5, y: 7.2 }
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

let pendingProjectCreation = null;
let projectPathMode = 'create';
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

async function showAuditFolderPicker() {
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

function closeProjectPathGate() {
  projectPathModal.classList.add('hidden');
  pendingProjectCreation = null;
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
    if (selected) {
      document.getElementById('audit-target').value = selected;
      termLine('[Jarvis]: Audit focus set to: ' + selected, 'sys');
    }
    closeProjectPathGate();
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
termLine('[' + agentName + ']: Model unconfigured or offline (' + err.message + '). Using standard proposal scaffold.', 'warn');
content = '// Generated by ' + agentName + ' (' + (agent ? agent.role : 'Specialist') + ')\n// Objective: ' + userPrompt + '\n\n'
+ (actionType === 'create' ? '// Module structure ready for development\n' : '// Targeted refactor payload ready\n');
}

proposeTask(agentId, actionType, title, targetFile, content, summary, projectRoot);
}

/* --- Step 3: Propose-then-Approve Gate --- */
let pendingTask = null;

const approvalModal = document.getElementById('approval-modal');

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
termLine('[Jarvis]: Task ' + taskId + ' APPROVED and executed.', 'prompt');
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
          const label = skill.id + (skill.approved ? '' : ' locked');
          return '<label class="skills-row"><span>' + label + ' <small>p' + skill.priority + '</small></span>'
          + '<input type="checkbox" data-agent="' + agent.id + '" data-skill="' + skill.id + '"'
          + checked + (disabled ? ' disabled' : '') + '></label>';
        }).join('');
    return '<section class="skills-agent-card"><h4>' + agent.name + '</h4>' + (rows || '<small style="color:var(--ink-400)">No matching skills</small>') + '</section>';
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
let allTasks = {};

function renderTaskBoard() {
  if (!taskListGrid) return;
  const tasks = Object.values(allTasks)
  .filter(t => t.status === taskBoardActiveFilter)
  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Update counts on tabs
  document.querySelectorAll('.task-tab').forEach(tab => {
      const filter = tab.dataset.filter;
      const count = Object.values(allTasks).filter(t => t.status === filter).length;
      tab.textContent = (filter === 'WAITING_APPROVAL' ? 'Pending' : filter === 'EXECUTED' ? 'Completed' : 'Blocked') + ' (' + count + ')';
      tab.classList.toggle('active', filter === taskBoardActiveFilter);
    });

if (tasks.length === 0) {
  taskListGrid.innerHTML = '<div class="empty-state">No tasks matching this filter.</div>';
  return;
}

taskListGrid.innerHTML = tasks.map(task => {
    const agent = AGENTS.find(a => a.id === task.agentId);
    const agentName = agent ? agent.name : task.agentId.toUpperCase();
    return `
    <div class="task-item">
    <div class="task-header">
    <span class="task-id">${escapeHtml(task.id)} ${escapeHtml(agentName)}</span>
    <span class="task-status status-${escapeHtml(task.status)}">${escapeHtml(task.status)}</span>
    </div>
    <div class="task-title">${escapeHtml(task.title)}</div>
    <div class="task-summary">${escapeHtml(task.summary)}</div>
    <div class="task-actions">
    ${task.status === 'WAITING_APPROVAL' ? `<button type="button" class="small-btn kra-btn-primary" data-action="review" data-id="${escapeHtml(task.id)}">REVIEW</button>` : ''}
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
    if (action === 'review') {
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

async function openTaskBoard() {
  if (!taskBoardModal) return;
  taskBoardModal.classList.remove('hidden');
  renderTaskBoard();
  try {
    const response = await fetch('../api/index.php?action=tasks');
    const payload = await response.json();
    if (payload.ok) {
      allTasks = payload.tasks || {};
      renderTaskBoard();
    }
} catch (error) {
termLine('[Jarvis]: Task board query failed: ' + error.message, 'warn');
}
}

document.getElementById('task-board-btn-close').addEventListener('click', () => taskBoardModal.classList.add('hidden'));
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
    const res = window.kraDesktop && window.kraDesktop.execCommand
    ? await window.kraDesktop.execCommand(command)
    : await (await fetch('../api/index.php?action=terminal-run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command }),
        })).json();
  chatLiveStatus.textContent = ' COMMAND MODE';
  (res.output || '').split('\n').forEach(line => termLine(line, res.ok ? 'sys' : 'warn'));
} catch (err) {
chatLiveStatus.textContent = ' COMMAND MODE';
termLine('[Terminal]: Execution failed: ' + err.message, 'warn');
}
}

function handleCommand(raw) {
  const cmd = raw.trim();
  if (!cmd) return;
  
  const lower = cmd.toLowerCase();
  
  // Auto-switch to terminal for slash commands
  if (cmd.startsWith('/') && activeChatChannel !== 'terminal') {
    switchChatChannel('terminal');
  }

  // Terminal tab shows raw stream; Team/Private tabs show chat bubbles
  if (activeChatChannel === 'terminal') {
    termLine('> ' + cmd, 'user');
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
termLine('[Jarvis]: Querying 9Router live models...', 'info');
fetch('../api/index.php?action=router-models')
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
  termLine(' Run shell commands in Terminal mode (desktop recommended)', 'info');
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
      handleCommand(commandInput.value);
      commandInput.value = '';
    }
  });
document.getElementById('btn-send-cmd').addEventListener('click', () => {
    hideCommandMenu();
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
const avatarPreviewCanvas = document.getElementById('agent-avatar-preview-canvas');

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
  const folder = prompt('Enter workspace path:', agentWorkspacePath.value || 'C:\\xampp\\htdocs\\');
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
  if (!avatarPreviewCanvas) return;
  const ctx = avatarPreviewCanvas.getContext('2d');
  ctx.clearRect(0, 0, avatarPreviewCanvas.width, avatarPreviewCanvas.height);
  ctx.imageSmoothingEnabled = false;
  const selected = document.querySelector('.char-card.active');
  const character = selected?.dataset.char;
  const sprite = document.querySelector('.char-' + character);
  const body = document.getElementById('hire-body-select')?.value || 'standard_warm';
  const hair = document.getElementById('hire-hair-select')?.value || 'exec_part_dark';
  const top = document.getElementById('hire-top-select')?.value || 'navy_suit_tie';
  const heldItem = document.getElementById('hire-held-item-select')?.value || 'none';

  if (sprite?.classList.contains('char-rama') || sprite?.classList.contains('char-jarvis')
    || sprite?.classList.contains('char-maya') || sprite?.classList.contains('char-budi')
    || sprite?.classList.contains('char-siti') || sprite?.classList.contains('char-dimas')) {
    const image = new Image();
    image.onload = () => ctx.drawImage(image, 0, 0, 32, 40, 0, 0, 32, 40);
    image.src = getComputedStyle(sprite).backgroundImage.slice(5, -2);
    return;
  }

if (window.KRAAssetRegistry?.drawModularAgent) {
  window.KRAAssetRegistry.drawModularAgent(ctx, 'front', {
      body, hair, top, heldItem,
      palette: { primary: document.querySelector('.swatch-btn.active')?.dataset.color || '#4ECDC4' }
    }, 0);
}
}

function bindHirePreviewEvents() {
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

openHireButton.addEventListener('click', () => hireModal.classList.remove('hidden'));
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
const id = 'agent-' + Date.now();
const seat = { x: 22 + (AGENTS.length % 4) * 4, y: 2 }; // simple seating logic
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
  palette: { primary: document.querySelector('.swatch-btn.active')?.dataset.color || '#4ECDC4' },
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
    const response = await fetch('../api/index.php?action=router-health');
    const payload = await response.json();
    const health = payload.health || {};
    if (health.online) {
      termLine('[9Router]: Online provider ' + health.provider + '.', 'prompt');
      const catalogRes = await fetch('../api/index.php?action=router-models');
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
      // Persisted coordinates were created against older map dimensions. Keep
      // agents on their current, valid room home when migrated values fall
      // outside this 40x14 world.
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
switchChatChannel('terminal');
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
