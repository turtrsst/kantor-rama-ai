'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const THREE = require('../web/vendor/three-r128.min.js');
const source = fs.readFileSync(path.join(__dirname, '..', 'web/kra_three_office_renderer.js'), 'utf8');
let renderCount = 0;
let lastScene = null;
class MockWebGLRenderer {
  constructor({ canvas }) { this.domElement = canvas; this.shadowMap = {}; this.outputEncoding = 0; this.toneMapping = 0; }
  setPixelRatio(value) { this.pixelRatio = value; }
  setSize(width, height) { this.width = width; this.height = height; }
  render(scene, camera) { renderCount += 1; this.scene = scene; this.camera = camera; lastScene = scene; }
}
THREE.WebGLRenderer = MockWebGLRenderer;
function canvasElement(width = 512, height = 128) {
  const context = {
    clearRect() {}, fillRect() {}, strokeRect() {}, beginPath() {}, roundRect() {}, rect() {}, fill() {}, stroke() {},
    fillText() {}, measureText: text => ({ width: String(text).length * 12 }), setLineDash() {}, save() {}, restore() {},
    moveTo() {}, lineTo() {}, quadraticCurveTo() {}, closePath() {}, arc() {}, ellipse() {},
    set fillStyle(value) {}, set strokeStyle(value) {}, set font(value) {}, set textAlign(value) {}, set textBaseline(value) {}, set lineWidth(value) {},
    set shadowColor(value) {}, set shadowBlur(value) {}, set shadowOffsetY(value) {}
  };
  const listeners = new Map();
  return { width, height, style: {}, getContext: () => context,
    addEventListener(name, fn) { listeners.set(name, fn); }, setPointerCapture() {}, listeners };
}
const webglCanvas = canvasElement(1408, 768), overlayCanvas = canvasElement(1408, 768);
const document = {
  createElement: name => name === 'canvas' ? canvasElement() : {},
  getElementById: id => id === 'office-3d-canvas' ? webglCanvas : id === 'office-canvas' ? overlayCanvas : null
};
const window = { THREE, document, devicePixelRatio: 1, performance: { now: () => 900 } };
vm.runInNewContext(source, { window, THREE, Math, Number, Map, Set, Float32Array, Uint8Array, performance: window.performance, console });
const renderer = window.KRAThreeOfficeRenderer;
assert(renderer, 'KRA 3D office renderer registers');
assert.equal(THREE.REVISION, '128', 'locally bundled Three.js matches the source project runtime');
assert.equal(renderer.getCanvasSize({ w: 40, h: 20 }, 32).width, 1408, 'KRA floor-one view retains its prior dashboard canvas width');
assert.equal(renderer.getCanvasSize({ w: 40, h: 20 }, 32).height, 768, 'KRA floor-one view retains its prior dashboard canvas height');
assert.equal(renderer.getCanvasSize({ w: 44, h: 20 }, 32).width, 1536, 'floor-two canvas fits its wider KRA map');

const drawCtx = new Proxy({ clearRect() {}, fillText() {}, measureText: text => ({ width: String(text).length * 5 }), save() {}, restore() {} },
  { set(target, key, value) { target[key] = value; return true; } });
const MAP = { w: 40, h: 20, corridorY: 9 }, T = 32;
const ROOM_DEFS = { 1: [
  { id: 'studio', label: 'STUDIO - MAYA', x: 22, y: 0, w: 8, h: 9, wall: 'studio', accent: '#52E0E2', rug: { x: 23, y: 1, w: 5, h: 3, fill: '#8E7F6A', trim: '#5F5344' } },
  { id: 'meeting', label: 'MEETING - BUDI', x: 10, y: 11, w: 10, h: 9, wall: 'meeting', accent: '#4ECDC4', rug: null }
], 2: [] };
const floor = Array.from({ length: MAP.h }, (_, y) => Array.from({ length: MAP.w }, () => y === 9 || y === 10 ? 'redCorridor' : 'recordsWood'));
const deco = Array.from({ length: MAP.h }, () => Array(MAP.w).fill(null));
deco[3][24] = '03_workstation_maya'; deco[5][25] = '08_chair_executive'; deco[4][31] = '02_server_rack_jarvis'; deco[13][5] = '10_plant_potted_large';
const crew = [{ id: 'mya', name: 'MAYA', role: 'Designer', floorId: 1, x: 26, y: 8.5, homeX: 26, homeY: 8.5,
  inTransit: false, status: 'idle', facing: 'down', palette: { primary: '#303641', accent: '#FF7D71', skin: '#E8B99B', hair: '#201721' },
  appearance: { body: 'petite_light', face: 'stern_brows', hair: 'exec_part_dark', top: 'charcoal_jacket_coral', bottom: 'chinos_sneakers' }, bubble: '', bubbleUntil: 0 }];
const roomDoorStates = new Map();
const opts = {
  ctx: drawCtx, W: 1408, H: 768, T, MAP, floor, deco, ROOM_DEFS, activeFloor: 1, activeRoomId: 'studio',
  AGENTS: crew, selectedAgent: crew[0], deltaMs: 1000 / 60, clock: 100, roomDoorCenter: room => room.doorX || room.x + room.w / 2 + 0.5,
  roomDoorStates, customDecor: { 1: new Map([['2,2', 'plant']]) }, surfaceDecor: [], cybercat: { x: 1, y: 1 },
  decorMode: false, selectedDecorItem: '', mouseTileX: -1, mouseTileY: -1,
  getItemFootprint: id => /workstation|server_rack/.test(id) ? { cols: 2, rows: 2 } : { cols: 1, rows: 1 },
  isAtlasItem: () => true, elevator: { openness: 0, motion: null }
};
assert(renderer.render(opts), 'WebGL scene can be built and rendered');
assert.equal(renderCount, 1, 'renderer submits the first 3D frame');
assert(renderer.getState().hasScene, 'real scene graph is active');
assert(renderer.getState().objectCount > 100, 'scene contains furniture, walls, floor, lights, lift and avatar meshes');
const campusCounts = { roads: 0, trees: 0, buildings: 0 };
lastScene.traverse(object => {
  if (object.name === 'KRA campus road') campusCounts.roads += 1;
  if (object.name === 'KRA campus tree') campusCounts.trees += 1;
  if (object.name === 'KRA neighboring building') campusCounts.buildings += 1;
});
assert(campusCounts.roads >= 4, 'the office is surrounded by a connected road loop');
assert(campusCounts.trees >= 20, 'tree-lined verges surround the office campus');
assert(campusCounts.buildings >= 7, 'neighboring buildings frame the office block');
const campusTraffic = { cars: 0, motorbikes: 0, pedestrians: 0, elevator: 0 };
lastScene.traverse(object => {
  if (object.name === 'KRA campus car') campusTraffic.cars += 1;
  if (object.name === 'KRA campus motorbike') campusTraffic.motorbikes += 1;
  if (object.name === 'KRA campus pedestrian') campusTraffic.pedestrians += 1;
  if (object.name === 'KRA glass elevator') campusTraffic.elevator += 1;
});
assert(campusTraffic.cars >= 2 && campusTraffic.motorbikes >= 1 && campusTraffic.pedestrians >= 2, 'the surrounding campus animates cars, a motorbike, and walking pedestrians (' + JSON.stringify(campusTraffic) + ')');
assert.equal(campusTraffic.elevator, 1, 'the 3D office includes a visible glass elevator structure');
assert.equal(renderer.getState().campusActorCount, 5, 'all campus traffic and pedestrian actors are synchronized into animation');
let campusCar = null;
lastScene.traverse(object => { if (!campusCar && object.name === 'KRA campus car') campusCar = object; });
const campusCarStartX = campusCar.position.x;
for (let i = 0; i < 8; i += 1) renderer.render(opts);
assert.notEqual(campusCar.position.x, campusCarStartX, 'campus vehicles move continuously along the road');
assert(renderer.getState().cameraRadius < 85, 'the initial world framing zooms closer to the office and campus');
let mapSpeechBubble = null;
lastScene.traverse(object => { if (object.userData?.kraSpeechBubble) mapSpeechBubble = object; });
assert(mapSpeechBubble?.material?.map?.image?.width >= 1024, 'map chat bubbles use a high-resolution antialiased canvas texture');
assert(mapSpeechBubble.material.map.magFilter === THREE.LinearFilter, 'map chat bubbles use linear texture filtering');
let floorTileBatch = null;
lastScene.traverse(object => { if (object.name === 'KRA room-coloured floor tiles') floorTileBatch = object; });
assert(floorTileBatch?.instanceColor, 'floor tile batch stores room-specific display colors');
const tileColorTriplets = new Set();
for (let i = 0; i < floorTileBatch.instanceColor.array.length; i += 3) {
  const c = floorTileBatch.instanceColor.array.slice(i, i + 3).map(value => value.toFixed(2)).join(','); tileColorTriplets.add(c);
}
assert(tileColorTriplets.size >= 4, 'room floors and transit corridor render with visibly distinct palettes');
assert(overlayCanvas.listeners.has('pointerdown'), 'orbit controls bind to the existing KRA interaction overlay');
for (const [x, y] of [[0, 0], [12, 9], [26, 8], [39, 19]]) {
  const p = renderer.point(x + 0.5, y + 0.5, 0, MAP, T);
  const tile = renderer.hitTest(p.x, p.y, MAP, T);
  assert.equal(tile.x, x, '3D camera raycast restores tile x');
  assert.equal(tile.y, y, '3D camera raycast restores tile y');
}
for (let i = 0; i < 70; i += 1) renderer.render(opts);
assert(roomDoorStates.get('1:studio') > 0.98, '3D model door animates open when a crew member approaches');
opts.AGENTS = [];
for (let i = 0; i < 70; i += 1) renderer.render(opts);
assert(roomDoorStates.get('1:studio') < 0.02, '3D model door eases closed after the crew member leaves');
assert(renderCount > 100, 'scene remains frame-synchronized with the KRA application clock');
opts.MAP = { w: 44, h: 20, corridorY: 9 };
opts.floor = Array.from({ length: 20 }, (_, y) => Array.from({ length: 44 }, () => y === 9 || y === 10 ? 'redCorridor' : 'recordsWood'));
opts.deco = Array.from({ length: 20 }, () => Array(44).fill(null));
opts.ROOM_DEFS[2] = [{ id: 'floor2-lab', label: 'FLOOR 2 LAB', x: 0, y: 0, w: 15, h: 9, wall: 'war', accent: '#73D8E8', rug: null }];
opts.activeFloor = 2; opts.activeRoomId = 'floor2-lab'; opts.AGENTS = []; opts.roomDoorStates = new Map();
renderer.render(opts);
assert.equal(renderer.getState().floorElevation, 4.3, 'Floor 2 is elevated above the street-level campus');
let lowerStorey = false, raisedDeck = false;
lastScene.traverse(object => {
  if (object.name === 'KRA lower-storey architecture') lowerStorey = true;
  if (object.name === 'KRA active floor 2' && Math.abs(object.position.y - 4.3) < 0.001) raisedDeck = true;
});
assert(lowerStorey && raisedDeck, 'Floor 2 is shown as a raised deck above a complete lower-storey facade');
const floorTwoPoint = renderer.point(12.5, 5.5, 0, opts.MAP, T);
const floorTwoTile = renderer.hitTest(floorTwoPoint.x, floorTwoPoint.y, opts.MAP, T);
assert.equal(floorTwoTile.x, 12, 'Floor 2 ray picking uses its raised level height');
assert.equal(floorTwoTile.y, 5, 'Floor 2 ray picking still resolves the correct map row');

const app = fs.readFileSync(path.join(__dirname, '..', 'web/app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'web/index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'web/style.css'), 'utf8');
const api = fs.readFileSync(path.join(__dirname, '..', 'api/index.php'), 'utf8');
const n100nClient = fs.readFileSync(path.join(__dirname, '..', 'api/lib/KraN100nClient.php'), 'utf8');
const n100nCss = fs.readFileSync(path.join(__dirname, '..', 'web/n100n_creator_connector.css'), 'utf8');
assert(api.includes("$action === 'n100n-workflows'") && api.includes("$action === 'n100n-run'") && api.includes("$action === 'n100n-execution'"), 'KRA exposes workflow list, run, and execution bridge actions');
const n100nRunAction = api.indexOf("$action === 'n100n-run'");
assert(n100nRunAction >= 0 && api.indexOf('requireSupervisorRole($currentUser)', n100nRunAction) < api.indexOf("if ($_SERVER['REQUEST_METHOD'] !== 'POST')", n100nRunAction), 'only a KRA supervisor can start N100N workflows');
assert(n100nClient.includes("getenv('KRA_N100N_API_KEY')") && n100nClient.includes("getenv('KRA_N100N_TOKEN')") && n100nClient.includes("'x-api-key: ' . self::token()") && n100nClient.includes('http://127.0.0.1:5679'), 'N100N REST credentials stay server-side with documented and legacy environment names');
assert(api.includes("$aksiFlowMesin = ['flow-kategori', 'flow-tugas', 'flow-selesai', 'flow-status']") && api.includes("} elseif (in_array($action, $aksiN100nStudio, true))") && api.includes('$currentUser = KraAuth::requireUser();'), 'N100N Studio accepts KRA bearer sessions while flow endpoints retain their machine-key gate');
assert(api.includes('KraN100nClient::runAsync((int) $workflowId, $payload[\'items\'])') && api.includes('KraN100nClient::execution((int) $executionId)'), 'N100N execution runs asynchronously and execution IDs are validated/cast before lookup');
assert(api.includes("'connected' => $connected") && api.includes("'configured' => (bool) ($status['configured'] ?? false)"), 'N100N status payload matches the Creator Studio connection UI');
assert(html.includes('id="creator-n100n-workflow"') && html.includes('id="creator-n100n-run"') && html.includes('id="creator-n100n-check-execution"'), 'Content Creator includes N100N workflow controls');
assert(app.includes("creatorN100nRequest('n100n-run'") && app.includes('JSON.stringify({ workflow_id: Number(workflowId), items })'), 'the Creator UI sends selected N100N workflows through KRA PHP');
assert(n100nCss.includes('.creator-n100n-panel') && n100nCss.includes('body.dark-mode'), 'N100N bridge panel follows the Creator responsive theme');
assert(app.includes('window.KRAThreeOfficeRenderer'), 'KRA application drives the Three.js office scene');
assert(app.includes('function findElevatorApproach(agent, floorId)') && app.includes('const maxRetries = 6') && app.includes("window.setTimeout(routeToLift, 350)"), 'elevator transit searches alternate clear corridor tiles and retries temporary congestion');
assert(!app.includes('cannot reach the elevator; transit was cancelled'), 'elevator transit no longer immediately cancels on a single blocked waypoint');
const elevatorApproachStart = app.indexOf('function findElevatorApproach(');
const elevatorApproachEnd = app.indexOf('function transitAgentToFloor(', elevatorApproachStart);
const elevatorSandbox = { MAP: { w: 40, h: 20 }, CORRIDOR_Y: 9, ELEVATOR_WAYPOINTS: { 1: { x: 20, y: 10 } },
  findWalkPath: (agent, x, y) => x === 20.5 && y === 9.5 ? [] : [{ x, y }] };
vm.runInNewContext(app.slice(elevatorApproachStart, elevatorApproachEnd) + '\nthis.findElevatorApproach = findElevatorApproach;', elevatorSandbox);
assert.equal(elevatorSandbox.findElevatorApproach({ id: 'test-agent' }, 1).point.x, 19.5, 'lift routing falls back to a neighboring walkable corridor tile');
assert(html.includes('vendor/three-r128.min.js') && html.includes('kra_three_office_renderer.js'), 'the Three.js runtime is served locally before the renderer');
assert(css.includes('#office-3d-canvas') && css.includes('position: absolute') && css.includes('translate(-50%, -50%)'), 'the WebGL scene and transparent canvas are layered in one viewport');
assert(app.includes('const displayWidth = Math.floor(W * displayScale)') && app.includes('sceneCanvas.style.width = displayWidth'), 'both canvases receive the same fitted dimensions');
assert(!app.includes('window.KRAIsometricColonyRenderer'), 'the procedural Canvas2D 2.5D renderer is no longer active');
assert(fs.existsSync(path.join(__dirname, '..', 'web/vendor/licenses/LICENSE-kantor-ai.txt')), 'MIT notice for the upstream model reference is included');
assert(fs.existsSync(path.join(__dirname, '..', 'web/vendor/LICENSE-three.txt')), 'MIT notice for bundled Three.js is included');

const creatorSource = fs.readFileSync(path.join(__dirname, '..', 'web/kra_creator_scene_renderer.js'), 'utf8');
const creatorCanvas = canvasElement(900, 360);
creatorCanvas.getBoundingClientRect = () => ({ width: 900, height: 360 });
const creatorDocument = { readyState: 'complete', createElement: name => name === 'canvas' ? canvasElement() : {}, getElementById: id => id === 'creator-studio-3d' ? creatorCanvas : null };
const creatorFrames = [];
const creatorWindow = { THREE, document: creatorDocument, devicePixelRatio: 1, requestAnimationFrame: callback => creatorFrames.push(callback) };
vm.runInNewContext(creatorSource, { window: creatorWindow, THREE, Math, Number, console });
assert(creatorWindow.KRACreatorSceneRenderer, 'creator-mode scene renderer registers');
assert(creatorWindow.KRACreatorSceneRenderer.init(), 'creator-mode renderer builds its procedural 3D studio');
assert(creatorWindow.KRACreatorSceneRenderer.getState().scene, 'creator scene owns an independent Three.js scene');
assert(creatorWindow.KRACreatorSceneRenderer.setAgents([
  { id: 'creator-agent-a', name: 'Nara', role: 'Research assistant', activity: 'research', activityLabel: 'Riset topik', accent: '#78a98b' },
  { id: 'creator-agent-b', name: 'Dito', role: 'Video producer', activity: 'production', activityLabel: 'Persiapan produksi', accent: '#b47e62' }
]), 'Creator mode can place a separate crew in its 3D set');
assert.equal(creatorWindow.KRACreatorSceneRenderer.getState().actors.length, 2, 'Creator hires become distinct animated 3D actors');
const creatorActor = creatorWindow.KRACreatorSceneRenderer.getState().actors[0];
assert(creatorActor.workstation?.screen && creatorActor.workstation?.mug, 'each hired Creator actor gets a computer workstation and a break mug');
function runCreatorFrame(time) { const next = creatorFrames.shift(); assert(next, 'Creator scene schedules animation frames'); next(time); }
runCreatorFrame(0);
assert.equal(creatorActor.currentBehavior, 'computer', 'Creator actors start by visibly working at their computers');
runCreatorFrame(12000);
assert.equal(creatorActor.currentBehavior, 'thinking', 'Creator actors cycle into a visible thinking pose');
runCreatorFrame(17000);
assert.equal(creatorActor.currentBehavior, 'chatting', 'paired Creator actors cycle into discussion');
runCreatorFrame(23000);
assert.equal(creatorActor.currentBehavior, 'resting', 'Creator actors cycle into a short seated break');
runCreatorFrame(28000);
assert.equal(creatorActor.currentBehavior, 'stretching', 'Creator actors cycle into an animated stretch');
assert(creatorCanvas.listeners.has('pointerdown') && creatorCanvas.listeners.has('wheel'), 'creator studio supports drag orbit and scroll zoom');
assert(html.includes('id="creator-studio-3d"') && html.indexOf('vendor/three-r128.min.js') < html.indexOf('kra_creator_scene_renderer.js'), 'Creator mode canvas loads the shared local Three.js runtime first');
assert(html.includes('id="creator-team-grid"') && html.includes('4 specialist agents ready'), 'Creator mode renders its default crew activity roster');
const chatBackend = fs.readFileSync(path.join(__dirname, '..', 'api/lib/KraAgentChat.php'), 'utf8');
assert(html.includes('id="creator-team-grid"') && html.includes('4 specialist agents ready') && !html.includes('id="creator-hire-agent"'), 'Creator Studio starts with a built-in crew instead of requiring manual hires');
for (const id of ['creator_research', 'creator_writer', 'creator_producer', 'creator_reviewer']) {
  assert(app.includes("id: '" + id + "'") && chatBackend.includes("'" + id + "' => ["), 'Built-in Creator agent ' + id + ' is available in the UI and AI chat backend');
}
assert(app.includes('data-open-creator-chat') && app.includes('openCreatorStudioTerminal(agentId)'), 'each Creator specialist CHAT button opens the in-Studio terminal without switching to the office');
assert(html.includes('id="creator-studio-terminal-form"') && html.includes('id="creator-studio-provider"') && html.includes('Studio Crew'), 'Creator Studio has a provider-aware terminal, composer, and shared group tab');
assert(app.includes("return 'creator_studio_' + (suffix || 'agent')") && app.includes('creatorStudioChannelFor(agentId)'), 'Studio chat history uses channels separate from Virtual Office');
assert(chatBackend.includes("$channel === 'creator_studio_team'") && chatBackend.includes('array_keys(self::$creatorPersonas)'), 'Studio group dispatch is restricted to its four Creator personas');
assert(app.includes('window.KRACreatorSceneRenderer?.setAgents'), 'Creator roster synchronizes its visual crew into the 3D studio');
assert(app.includes('getBehaviorAt(index, time)') && app.includes('Studio simulation ·'), 'Creator roster exposes honest ambient activity status for each hired agent');
assert(app.includes('window.KRA_CREATOR_ACTIVITY_TIMER'), 'Creator roster activity labels refresh while the studio is open');
assert(html.includes('mengetik di komputer, berpikir, berdiskusi, istirahat'), 'Creator UI explains the ambient activity cycle and that it is not autonomous AI execution');
assert(app.includes('window.KRACreatorSceneRenderer?.resize()'), 'Creator mode resizes its 3D scene when the view is opened');
const uiRefresh = fs.readFileSync(path.join(__dirname, '..', 'web/ui_refresh.css'), 'utf8');
const auth = fs.readFileSync(path.join(__dirname, '..', 'web/auth.css'), 'utf8');
const login = fs.readFileSync(path.join(__dirname, '..', 'web/login.html'), 'utf8');
assert(uiRefresh.includes('font-family') && uiRefresh.includes('.creator-scene-frame'), 'refreshed UI has cohesive typography and a 3D Creator presentation');
assert(auth.includes('.auth-card') && auth.includes('border-radius: 22px'), 'authentication screens use the shared modern visual system');
assert(login.includes('id="login-form"') && login.includes('name="username"') && login.includes('name="password"'), 'login form keeps its authentication contract');
const rosterBuilder = app.slice(app.indexOf('function buildRoster()'), app.indexOf('function selectAgent('));
assert(rosterBuilder.includes('agentAvatarMarkup(a)') && !rosterBuilder.includes('drawImage(portrait.image'), 'roster UI renders smooth illustrated agent avatars instead of pixel portraits');
const avatarMarkupStart = app.indexOf('function agentAvatarMarkup(');
const avatarMarkupEnd = app.indexOf('function buildRoster()', avatarMarkupStart);
const avatarSandbox = {};
vm.runInNewContext(app.slice(avatarMarkupStart, avatarMarkupEnd) + '\nthis.renderAgentAvatar = agentAvatarMarkup;', avatarSandbox);
const avatarSvg = avatarSandbox.renderAgentAvatar({ id: 'agent-test', palette: { primary: '#4e9b83', accent: '#d7ad67' }, appearance: { hair: 'hijab_emerald', body: 'standard_warm' } });
assert(avatarSvg.includes('<svg') && avatarSvg.includes('<circle cx="48" cy="48"') && avatarSvg.includes('url(#hair-agent-test)'), 'agent avatars render as smooth, color-matched SVG portraits');
assert(!avatarSvg.includes('image-rendering') && !avatarSvg.includes('canvas'), 'new roster portraits do not depend on pixel canvases');
assert(app.includes('frame.dataset.initial = initials') && app.includes('avatarEl.dataset.initial'), 'boss and user profile badges expose accessible initials');
assert(uiRefresh.includes('#portrait-canvas { display: none; }') && uiRefresh.includes('.terminal-body'), 'boss portrait and console have refreshed non-pixel UI treatments');
console.log('Three.js verification passed: campus roads and traffic, elevator, antialiased speech bubbles, Creator 3D workstation activity cycles, smooth UI avatars, and local runtime.');
