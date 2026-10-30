'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'web/app.js'), 'utf8');
const registry = fs.readFileSync(path.join(root, 'web/kra_asset_registry.js'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'web/kra_three_office_renderer.js'), 'utf8');
const atlas = JSON.parse(fs.readFileSync(path.join(root, 'assets/voxel/atlas/argon_office_furniture.json'), 'utf8'));
const atlasFrames = atlas.sprites;
const roomBlock = app.match(/const ROOM_DEFS = \{([\s\S]*?)\n\};/);
assert(roomBlock, 'ROOM_DEFS should be present');

function readRooms(floorId) {
  const token = floorId + ': [';
  const entry = roomBlock[1].indexOf(token);
  assert(entry >= 0, 'ROOM_DEFS floor ' + floorId + ' should be present');
  const arrayStart = roomBlock[1].indexOf('[', entry) + 1;
  const nextEntry = roomBlock[1].indexOf('2: [', arrayStart);
  const arrayEnd = Number(floorId) === 1 && nextEntry >= 0
    ? roomBlock[1].lastIndexOf(']', nextEntry) : roomBlock[1].lastIndexOf(']');
  return Array.from(roomBlock[1].slice(arrayStart, arrayEnd).matchAll(/\{ id: '([^']+)', label: '[^']+', x: (\d+), y: (\d+), w: (\d+), h: (\d+)(?:, doorX: ([\d.]+))?/g), item => ({
    id: item[1], x: Number(item[2]), y: Number(item[3]), w: Number(item[4]), h: Number(item[5]), doorX: item[6] == null ? null : Number(item[6])
  }));
}

const layouts = {
  1: { width: 40, height: 20, corridorY: 9, lowerY: 11, roomCount: 8 },
  2: { width: 44, height: 20, corridorY: 9, lowerY: 11, roomCount: 6 }
};
for (const [floorId, expected] of Object.entries(layouts)) {
  const rooms = readRooms(floorId);
  assert.equal(rooms.length, expected.roomCount, 'floor ' + floorId + ' room count');
  for (const tierY of [0, expected.lowerY]) {
    const tier = rooms.filter(room => room.y === tierY).sort((a, b) => a.x - b.x);
    assert(tier.length > 0, 'floor ' + floorId + ' has tier at y=' + tierY);
    assert.equal(tier[0].x, 0, 'room tier begins at west edge');
    assert.equal(tier[tier.length - 1].x + tier[tier.length - 1].w, expected.width, 'room tier reaches east edge');
    tier.forEach((room, index) => {
      assert.equal(room.h, 9, room.id + ' uses the deeper room bay');
      if (index) assert.equal(room.x, tier[index - 1].x + tier[index - 1].w, 'rooms are contiguous with no accidental gaps');
    });
  }
  assert(app.includes(floorId + ': Object.freeze({ map: { w: ' + expected.width + ', h: ' + expected.height + ', corridorY: ' + expected.corridorY + ' }'),
    'floor ' + floorId + ' map preset matches the room plan');

  const builderStart = app.indexOf(floorId === '1' ? 'function buildWorld()' : 'function buildSecondFloor()');
  const builderEnd = app.indexOf(floorId === '1' ? 'floorMaps[1] =' : '\n}\n', builderStart);
  const builder = app.slice(builderStart, builderEnd);
  const blocked = new Set();
  for (const match of builder.matchAll(/put\((\d+), (\d+), '([^']+)'\)/g)) {
    const x = Number(match[1]);
    const authoredY = Number(match[2]);
    const sprite = match[3];
    let y = floorId === '1' && authoredY >= 8 ? authoredY + 3
      : floorId === '2' && authoredY >= 7 ? authoredY + 4 : authoredY;
    if (sprite === '08_chair_executive' || sprite === '09_chair_ergonomic') continue;
    const footprint = atlasFrames[sprite]?.grid_occupancy || { cols: 1, rows: 1 };
    for (let dy = 0; dy < footprint.rows; dy += 1) {
      for (let dx = 0; dx < footprint.cols; dx += 1) blocked.add((x + dx) + ',' + (y + dy));
    }
  }
  const doorTile = room => Number.isFinite(room.doorX) ? Math.floor(room.doorX) : Math.floor(room.x + room.w / 2);
  const corridor = (x, y) => y === expected.corridorY || y === expected.corridorY + 1;
  const roomAtTile = (x, y) => rooms.find(room => x >= room.x && x < room.x + room.w
    && y >= room.y && y < room.y + room.h) || null;
  const canCross = (fromX, fromY, toX, toY) => {
    const fromRoom = roomAtTile(fromX, fromY);
    const toRoom = roomAtTile(toX, toY);
    if (fromRoom && toRoom) return fromRoom.id === toRoom.id;
    if (corridor(fromX, fromY) && corridor(toX, toY)) return true;
    const room = fromRoom || toRoom;
    return Boolean(room && (corridor(fromX, fromY) || corridor(toX, toY))
      && fromX === toX && toX === doorTile(room));
  };
  const isClear = (x, y) => x >= 0 && x < expected.width && y >= 0 && y < expected.height
    && !blocked.has(x + ',' + y);
  const elevator = { x: Math.floor(expected.width / 2), y: expected.corridorY + 1 };
  for (const room of rooms) {
    const x = doorTile(room);
    const insideY = room.y === 0 ? expected.corridorY - 1 : room.y;
    const corridorY = room.y === 0 ? expected.corridorY : room.y - 1;
    assert(isClear(x, insideY), room.id + ' door approach is not obstructed by furniture');
    assert(isClear(x, corridorY), room.id + ' corridor threshold is clear');
    const queue = [[x, insideY]];
    const seen = new Set([x + ',' + insideY]);
    for (let head = 0; head < queue.length; head += 1) {
      const [fromX, fromY] = queue[head];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const toX = fromX + dx;
        const toY = fromY + dy;
        const key = toX + ',' + toY;
        if (seen.has(key) || !isClear(toX, toY) || !canCross(fromX, fromY, toX, toY)) continue;
        seen.add(key);
        queue.push([toX, toY]);
      }
    }
    assert(seen.has(elevator.x + ',' + elevator.y), room.id + ' has a clear walking route to the elevator');
  }
}

assert(app.includes('function drawAnimatedRoomDoors()'), 'room doors have an animated renderer');
assert(app.includes('function canTraverseRoomBoundary('), 'agents are routed through actual room doorways');
assert(app.includes('elevatorDoorOpenness += (target - elevatorDoorOpenness) * 0.17'), 'elevator doors animate smoothly');
assert(app.includes('elevatorMotion = { active: true, fromFloor: originFloor, toFloor: destinationFloor'), 'floor transit drives the elevator motion scene');
assert(app.includes('serverDataGenerationUnits += dataTick - lastDataGenerationTick') && app.includes('Simulated units:'), 'server data generation is visibly simulated and labeled');
assert(app.includes('Recreation buff applied for 20 seconds') && app.includes('dist * (agent.recreationBuffUntil'), 'recreation buff is time-limited and affects crew movement');
assert(app.includes('function handleColonyAssetClick('), 'terminals and recreation props have interaction handlers');
assert(renderer.includes('new THREE.WebGLRenderer') && renderer.includes('function buildAvatar') && renderer.includes('function hitTest('), 'camera, 3D mesh avatars and raycast picking use Three.js');
assert(app.includes('window.KRAThreeOfficeRenderer'), 'app renders and hit-tests through the Three.js scene');
assert(!app.includes('window.KRAIsometricColonyRenderer'), 'the superseded Canvas2D renderer is no longer wired into the office view');
assert(app.includes('migrateJarvis') && app.includes("'server2'"), 'Jarvis legacy server coordinates migrate to the floor-two server room');
assert(registry.includes("if (cfg.top === 'white_lab_coat')") && registry.includes("if (cfg.hair === 'hijab_emerald')"),
  'crew sprites include tailored role and hair details');
for (const id of ['rama', 'jarvis', 'creator', 'modifier', 'auditor', 'ops']) {
  const start = app.indexOf("id: '" + id + "'");
  const nextAgent = app.indexOf("id: '", start + 6);
  assert(start >= 0 && app.slice(start, nextAgent < 0 ? start + 800 : nextAgent).includes('appearance:'), id + ' has a distinct visual appearance');
}

const refs = [
  'room-layout-interior-01.jpg',
  'room-layout-interior-02.jpg',
  'character-spritesheet-concept.jpg',
  'isometric-colony-office.jpg',
  '../rimworld-topdown-direction/rimworld-office-rooms.png',
  '../rimworld-topdown-direction/rimworld-colony-interior-wide.png',
  '../rimworld-topdown-direction/topdown-kitchen-reference.png',
  '../rimworld-topdown-direction/topdown-utility-reference.png'
];
for (const file of refs) {
  const asset = path.join(root, file.startsWith('../rimworld-topdown-direction/')
    ? 'assets/reference/rimworld-topdown-direction/' + path.basename(file)
    : 'assets/reference/creator-visual-direction/' + file);
  assert(fs.existsSync(asset), file + ' reference is preserved');
  const bytes = fs.readFileSync(asset);
  if (asset.endsWith('.png')) assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', file + ' remains a readable PNG');
  else assert.equal(bytes.readUInt16BE(0), 0xFFD8, file + ' remains a readable JPEG');
}

console.log('Colony layout verification passed: 2 floors, reachable door routes, timed doors/elevator, Three.js model wiring, 6 tailored crew records, and 8 preserved references.');
