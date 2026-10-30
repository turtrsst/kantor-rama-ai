/* KRA's real-time 3D office renderer. The soft rounded avatar geometry and
 * paper-model treatment are adapted from the MIT-licensed kantor-ai project;
 * see vendor/licenses/LICENSE-kantor-ai.txt and THIRD_PARTY_NOTICES.md. */
(function attachKRAThreeOfficeRenderer(root) {
  'use strict';
  const THREE = root.THREE;
  const TILE = 1;
  const FLOOR_Y = 0;
  const WALL_HEIGHT = 2.65;
  const sceneState = { renderer: null, scene: null, camera: null, world: null, failed: false, signature: '', map: null, T: 32, W: 0, H: 0, options: null,
    avatars: new Map(), props: [], doors: [], roomLabels: [], highlight: null, cursor: null, elevator: null,
    campusActors: [], target: null, theta: 0.68, phi: 0.78, radius: 62, floorElevation: 0, structure: null, drag: null, dragged: false, suppressClick: false, elapsed: 0,
    materials: new Map(), softShapes: new Map(), raycaster: null, plane: null };
  const PALETTE = {
    floor: 0xc6b99f, stone: 0xd7cbb4, stoneDark: 0xaaa08e, trim: 0xeee4cf, ink: 0x332e29,
    wood: 0xb8895e, woodLight: 0xd0ad7f, woodDark: 0x795c43, green: 0x748e67, screen: 0x91b5b3,
    metal: 0x667379, dark: 0x3e4140, glass: 0x92b7b9, carpet: 0x9b7965, warmLight: 0xf3d9a3
  };
  function sizeFor(MAP, T) { return { width: (MAP.w + 4) * T, height: (MAP.h + 4) * T }; }
  function worldX(x, MAP) { return x - MAP.w / 2; }
  function worldZ(y, MAP) { return y - MAP.h / 2; }
  function colorValue(value, fallback = PALETTE.stone) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) return Number.parseInt(value.slice(1), 16);
    return fallback;
  }
  function material(color, options = {}) {
    const hex = colorValue(color);
    const key = [hex, options.roughness ?? 0.82, options.metalness ?? 0, options.transparent ? 1 : 0, options.opacity ?? 1, options.emissive || 0].join(':');
    if (!sceneState.materials.has(key)) {
      const baseColor = new THREE.Color(hex).convertSRGBToLinear();
      const glowColor = new THREE.Color(options.emissive || 0).convertSRGBToLinear();
      sceneState.materials.set(key, new THREE.MeshStandardMaterial({ color: baseColor,
        roughness: options.roughness ?? 0.82, metalness: options.metalness ?? 0, transparent: !!options.transparent,
        opacity: options.opacity ?? 1, emissive: glowColor, emissiveIntensity: options.emissiveIntensity || 0,
        side: options.doubleSide ? THREE.DoubleSide : THREE.FrontSide, depthWrite: options.depthWrite !== false }));
    }
    return sceneState.materials.get(key);
  }
  function softBox(w, h, d) {
    const key = [w, h, d].join('/');
    if (sceneState.softShapes.has(key)) return sceneState.softShapes.get(key);
    const radius = Math.min(w, h, d) * 0.22;
    const geometry = new THREE.BoxGeometry(w, h, d, 4, 4, 4);
    const points = geometry.attributes.position, inner = new THREE.Vector3(), normal = new THREE.Vector3();
    for (let i = 0; i < points.count; i += 1) {
      normal.fromBufferAttribute(points, i);
      inner.set(Math.max(-w / 2 + radius, Math.min(w / 2 - radius, normal.x)),
        Math.max(-h / 2 + radius, Math.min(h / 2 - radius, normal.y)),
        Math.max(-d / 2 + radius, Math.min(d / 2 - radius, normal.z)));
      normal.sub(inner).normalize().multiplyScalar(radius).add(inner);
      points.setXYZ(i, normal.x, normal.y, normal.z);
    }
    geometry.computeVertexNormals(); sceneState.softShapes.set(key, geometry); return geometry;
  }
  function mesh(parent, geometry, color, position, opts = {}) {
    const object = new THREE.Mesh(geometry, material(color, opts));
    object.position.set(position.x || 0, position.y || 0, position.z || 0);
    object.castShadow = opts.castShadow !== false; object.receiveShadow = opts.receiveShadow !== false;
    if (opts.outline) {
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 25), new THREE.LineBasicMaterial({ color: PALETTE.ink, transparent: true, opacity: 0.12 }));
      edges.renderOrder = 1; object.add(edges);
    }
    parent.add(object); return object;
  }
  function box(parent, w, h, d, color, x, y, z, opts = {}) {
    const geometry = opts.round ? softBox(w, h, d) : new THREE.BoxGeometry(w, h, d);
    return mesh(parent, geometry, color, { x, y: y + h / 2, z }, { outline: opts.outline ?? !opts.round, ...opts });
  }
  function rounded(parent, w, h, d, color, x, y, z, opts = {}) {
    return mesh(parent, softBox(w, h, d), color, { x, y, z }, { outline: false, ...opts });
  }
  function oval(parent, w, h, d, color, x, y, z, opts = {}) {
    const item = mesh(parent, new THREE.SphereGeometry(1, 16, 12), color, { x, y, z }, { outline: false, ...opts });
    item.scale.set(w / 2, h / 2, d / 2); return item;
  }
  function cylinder(parent, top, bottom, h, color, x, y, z, radial = 12, opts = {}) {
    return mesh(parent, new THREE.CylinderGeometry(top, bottom, h, radial), color, { x, y: y + h / 2, z }, { outline: false, ...opts });
  }
  function line(points, color = PALETTE.ink, opacity = 0.16) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(p[0], p[1], p[2])));
    return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  }
  function getCanvasTexture(draw, width = 512, height = 128) {
    const canvas = root.document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d'); draw(ctx, canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas); texture.encoding = THREE.sRGBEncoding;
    texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true; texture.needsUpdate = true; return texture;
  }
  function tagSprite(text, color = '#f5f0e6', background = 'rgba(45,43,38,.84)', size = 0.7) {
    const texture = getCanvasTexture((ctx, w, h) => {
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = background; ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(10, 16, w - 20, h - 32, 22); else ctx.rect(10, 16, w - 20, h - 32);
      ctx.fill(); ctx.fillStyle = color; ctx.font = '700 42px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(text).slice(0, 30), w / 2, h / 2, w - 42);
    });
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false }));
    sprite.text = String(text); sprite.scale.set(size * 2.7, size * 0.68, 1); return sprite;
  }
  function drawSpeechTexture(ctx, width, height, text) {
    ctx.clearRect(0, 0, width, height);
    const left = 28, top = 24, right = width - 28, bottom = height - 55, radius = 52;
    ctx.save(); ctx.shadowColor = 'rgba(25, 42, 31, .22)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 9;
    ctx.fillStyle = 'rgba(255, 253, 247, .98)'; ctx.beginPath();
    ctx.moveTo(left + radius, top); ctx.lineTo(right - radius, top); ctx.quadraticCurveTo(right, top, right, top + radius);
    ctx.lineTo(right, bottom - radius); ctx.quadraticCurveTo(right, bottom, right - radius, bottom);
    ctx.lineTo(246, bottom); ctx.lineTo(198, height - 20); ctx.lineTo(184, bottom);
    ctx.lineTo(left + radius, bottom); ctx.quadraticCurveTo(left, bottom, left, bottom - radius);
    ctx.lineTo(left, top + radius); ctx.quadraticCurveTo(left, top, left + radius, top); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(63, 91, 70, .22)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#283a30'; ctx.font = '650 62px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(text || '').slice(0, 34), width / 2, height * 0.46, width - 120);
  }
  function speechBubbleSprite() {
    const texture = getCanvasTexture((ctx, width, height) => drawSpeechTexture(ctx, width, height, ''), 1024, 320);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false, toneMapped: false }));
    sprite.text = ''; sprite.userData.kraSpeechBubble = true; sprite.scale.set(1.9, 0.62, 1); return sprite;
  }
  function wallColor(room) {
    const colors = { exec: 0xd1b787, manager: 0xc59d66, studio: 0xb3a7a1, lobby: 0xa9899b, records: 0x9a704f,
      meeting: 0x789376, pantry: 0xc9ac6e, play: 0x8969aa, war: 0x687c9b, inno: 0xa06d8a,
      obs: 0x4e8b91, sky: 0xc09050, server: 0x46777b, command: 0x954f60 };
    return colors[room.wall] || PALETTE.stone;
  }
  function floorColor(key, floorId, room = null) {
    if (key === 'redCorridor') return 0xa94343;
    if (key === 'pantryTile' || key === 'marble') return 0xd9cfb1;
    if (key === 'serverMetal') return 0x687e7c;
    if (key === 'warSlate') return 0x66768b;
    if (key === 'obsSlate') return 0x638c91;
    if (key === 'command') return 0x865a67;
    if (room) {
      const rooms = floorId === 1 ? {
        admin: 0xd5bf91, manager: 0xc9a979, studio: 0xb7a58c, lobby: 0xd0b083,
        records: 0x9e7655, meeting: 0x9cad8d, pantry: 0xd8cfad, play: 0x9074a4
      } : {
        warroom: 0x738196, innovation: 0xa17b91, server2: 0x637b7c,
        observatory: 0x6f9999, lounge2: 0xc19a68, command: 0x93616c
      };
      if (rooms[room.id]) return rooms[room.id];
    }
    if (key === 'recordsWood' || key === 'execWood' || key === 'studioWood' || key === 'meetingWood' || key === 'playWood' || key === 'skyWood') return 0xc49a68;
    return floorId === 2 ? 0x929d9b : 0xc6b99f;
  }
  function initRenderer(options) {
    if (sceneState.renderer) return true;
    if (sceneState.failed) return false;
    const canvas = root.document.getElementById('office-3d-canvas');
    if (!canvas || !THREE) return false;
    try {
      sceneState.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch (error) {
      sceneState.failed = true;
      console.error('KRA 3D renderer could not initialize WebGL:', error);
      const badge = root.document.getElementById('scene-render-error'); if (badge) badge.hidden = false;
      return false;
    }
    sceneState.renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 1.5));
    sceneState.renderer.shadowMap.enabled = true; sceneState.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    sceneState.renderer.outputEncoding = THREE.sRGBEncoding;
    sceneState.renderer.toneMapping = THREE.ACESFilmicToneMapping; sceneState.renderer.toneMappingExposure = 1.05;
    sceneState.scene = new THREE.Scene(); sceneState.scene.background = new THREE.Color(0x65705d);
    sceneState.camera = new THREE.PerspectiveCamera(36, options.W / options.H, 0.1, 240);
    const ambient = new THREE.HemisphereLight(0xf9f4e9, 0x8d8067, 1.15); sceneState.scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffedce, 2.0); sun.position.set(-15, 32, 25); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 34, bottom: -28, near: 1, far: 95 }); sun.shadow.bias = -0.001; sceneState.scene.add(sun);
    sceneState.target = new THREE.Vector3(0, 0.3, 0);
    sceneState.raycaster = new THREE.Raycaster(); sceneState.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    sceneState.W = 0; sceneState.H = 0;
    attachCameraControls(root.document.getElementById('office-canvas') || canvas);
    return true;
  }
  function resize(width, height) {
    if (!sceneState.renderer || !width || !height) return;
    if (width === sceneState.W && height === sceneState.H) return;
    sceneState.W = width; sceneState.H = height;
    sceneState.renderer.setSize(width, height, false);
    sceneState.camera.aspect = width / height; sceneState.camera.updateProjectionMatrix();
    if (sceneState.options) fitCamera(sceneState.options.MAP);
  }
  function fitCamera(MAP) {
    if (!sceneState.camera || !MAP) return;
    const span = Math.max(MAP.w, MAP.h) * 1.43 + 8;
    sceneState.radius = Math.max(28, span * (sceneState.floorElevation > 0 ? 1.2 : 1.13));
    sceneState.target.set(0, sceneState.floorElevation > 0 ? sceneState.floorElevation / 2 + 0.2 : 0.2, 0);
    sceneState.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -sceneState.floorElevation);
    sceneState.theta = 0.68; sceneState.phi = 0.78;
    updateCamera();
  }
  function updateCamera() {
    const s = sceneState, c = s.camera;
    if (!c) return;
    const r = s.radius, phi = Math.max(0.24, Math.min(1.28, s.phi)), theta = s.theta;
    c.position.set(s.target.x + r * Math.sin(phi) * Math.sin(theta), s.target.y + r * Math.cos(phi), s.target.z + r * Math.sin(phi) * Math.cos(theta));
    c.lookAt(s.target); c.updateMatrixWorld();
  }
  function attachCameraControls(canvas) {
    canvas.addEventListener('pointerdown', event => {
      sceneState.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY,
        theta: sceneState.theta, phi: sceneState.phi, target: sceneState.target.clone(), pan: event.shiftKey || event.button === 2 || event.button === 1 };
      if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
      const d = sceneState.drag; if (!d || d.id !== event.pointerId) return;
      const dx = event.clientX - d.x, dy = event.clientY - d.y;
      if (Math.abs(event.clientX - d.startX) + Math.abs(event.clientY - d.startY) > 4) sceneState.dragged = true;
      if (d.pan) {
        const scale = sceneState.radius * 0.0018;
        sceneState.target.x = d.target.x - dx * scale * Math.cos(sceneState.theta);
        sceneState.target.z = d.target.z + dx * scale * Math.sin(sceneState.theta) + dy * scale;
      } else {
        sceneState.theta = d.theta - dx * 0.006;
        sceneState.phi = Math.max(0.28, Math.min(1.25, d.phi + dy * 0.004));
      }
      updateCamera();
    });
    const release = event => {
      if (!sceneState.drag || sceneState.drag.id !== event.pointerId) return;
      sceneState.drag = null;
      if (sceneState.dragged) {
        sceneState.suppressClick = true;
        root.setTimeout(() => { sceneState.suppressClick = false; sceneState.dragged = false; }, 0);
      }
    };
    canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('contextmenu', event => event.preventDefault());
    canvas.addEventListener('wheel', event => { event.preventDefault(); sceneState.radius = Math.max(22, Math.min(112, sceneState.radius * Math.exp(event.deltaY * 0.001))); updateCamera(); }, { passive: false });
  }
  function consumeClickSuppression() { const value = sceneState.suppressClick; sceneState.suppressClick = false; sceneState.dragged = false; return value; }
  function campusTree(parent, x, z, scale = 1, shade = 0) {
    const tree = new THREE.Group(); tree.name = 'KRA campus tree'; tree.position.set(x, -0.42, z); tree.scale.setScalar(scale); parent.add(tree);
    cylinder(tree, 0.19, 0.29, 1.35, 0x806b51, 0, 0, 0, 9, { outline: false });
    const colors = [0x71845c, 0x819568, 0x6b805d];
    oval(tree, 1.55, 1.22, 1.48, colors[shade % colors.length], 0, 1.45, 0, { outline: false });
    oval(tree, 1.05, 0.86, 1.08, colors[(shade + 1) % colors.length], -0.38, 1.74, 0.1, { outline: false });
    oval(tree, 1.08, 0.9, 1.08, colors[(shade + 2) % colors.length], 0.39, 1.71, -0.08, { outline: false });
    return tree;
  }
  function campusHouse(parent, x, z, w, d, wall, roof, facing = 1) {
    const group = new THREE.Group(); group.name = 'KRA neighboring building'; group.position.set(x, -0.43, z); parent.add(group);
    const h = 2.2 + (w % 2) * 0.22;
    box(group, w, h, d, wall, 0, 0, 0, { round: true, outline: false, castShadow: true });
    box(group, w + 0.34, 0.28, d + 0.34, roof, 0, h, 0, { round: true, outline: false });
    box(group, w * 0.42, 0.2, d + 0.52, 0xeee4d1, 0, 0.22, 0, { outline: false });
    const frontZ = facing * (d / 2 + 0.015);
    for (const wx of [-w * 0.28, w * 0.28]) {
      box(group, Math.min(0.72, w * 0.2), 0.68, 0.07, 0x9bb9b4, wx, 1.18, frontZ, { outline: false });
      box(group, Math.min(0.78, w * 0.22), 0.08, 0.1, 0xf0e5d1, wx, 1.12, frontZ + facing * 0.035, { outline: false });
    }
    box(group, 0.7, 1.24, 0.08, 0x947353, 0, 0, frontZ, { outline: false });
    box(group, 0.95, 0.12, 0.45, 0xbcb09b, 0, 0, frontZ + facing * 0.28, { outline: false });
    return group;
  }
  function buildCampus(world, MAP) {
    // The office sits within a compact neighborhood block rather than floating alone.
    const ground = box(world, MAP.w + 30, 0.12, MAP.h + 34, 0x778566, 0, -0.52, 0, { outline: false, receiveShadow: true });
    ground.renderOrder = -3;
    const roadZ = MAP.h / 2 + 7.1, roadX = MAP.w / 2 + 7.1, roadWidth = 4.3;
    const road = 0x424a48, curb = 0xcac4b5, marking = 0xe8dfc9;
    // Four streets create a readable loop, with pale curbs, lane dashes and crosswalks.
    for (const z of [-roadZ, roadZ]) {
      const street = box(world, MAP.w + 19, 0.11, roadWidth, road, 0, -0.46, z, { outline: false, castShadow: false, receiveShadow: true });
      street.name = 'KRA campus road';
      box(world, MAP.w + 19, 0.13, 0.14, curb, 0, -0.43, z - roadWidth / 2, { outline: false, castShadow: false });
      box(world, MAP.w + 19, 0.13, 0.14, curb, 0, -0.43, z + roadWidth / 2, { outline: false, castShadow: false });
      for (let x = -MAP.w / 2 - 6; x <= MAP.w / 2 + 6; x += 4.6) {
        box(world, 1.9, 0.025, 0.09, marking, x, -0.355, z, { outline: false, castShadow: false });
      }
    }
    for (const x of [-roadX, roadX]) {
      const street = box(world, roadWidth, 0.11, MAP.h + 19, road, x, -0.46, 0, { outline: false, castShadow: false, receiveShadow: true });
      street.name = 'KRA campus road';
      box(world, 0.14, 0.13, MAP.h + 19, curb, x - roadWidth / 2, -0.43, 0, { outline: false, castShadow: false });
      box(world, 0.14, 0.13, MAP.h + 19, curb, x + roadWidth / 2, -0.43, 0, { outline: false, castShadow: false });
      for (let z = -MAP.h / 2 - 6; z <= MAP.h / 2 + 6; z += 4.6) {
        box(world, 0.09, 0.025, 1.9, marking, x, -0.355, z, { outline: false, castShadow: false });
      }
    }
    const houses = [
      [-MAP.w * 0.40, roadZ + 5.7, 4.3, 3.2, 0xd3c1a1, 0x8c6854, 1],
      [-MAP.w * 0.17, roadZ + 5.9, 3.7, 3.4, 0xe2d7c3, 0x778477, 1],
      [ MAP.w * 0.18, roadZ + 5.8, 4.2, 3.1, 0xc7d2c6, 0xa8755e, 1],
      [ MAP.w * 0.41, roadZ + 5.7, 3.8, 3.3, 0xd9c5ad, 0x687b79, 1],
      [-MAP.w * 0.40, -roadZ - 5.8, 4.0, 3.2, 0xd8d1bd, 0x9b7656, -1],
      [ MAP.w * 0.03, -roadZ - 5.7, 4.4, 3.3, 0xcbd4c9, 0x7c7468, -1],
      [ MAP.w * 0.39, -roadZ - 5.9, 3.7, 3.3, 0xe0d0b9, 0x8b6c66, -1]
    ];
    houses.forEach(spec => campusHouse(world, ...spec));
    // Tree-lined verges soften the block; deterministic spacing keeps the diorama uncluttered.
    for (let i = 0; i < 11; i += 1) {
      const x = -MAP.w * 0.48 + i * (MAP.w * 0.096);
      campusTree(world, x, roadZ - 3.05, 0.74 + (i % 3) * 0.08, i);
      if (i % 2 === 0) campusTree(world, x, -roadZ + 3.05, 0.7 + (i % 3) * 0.08, i + 1);
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i += 1) campusTree(world, side * (roadX - 3.15), -MAP.h * 0.42 + i * (MAP.h * 0.168), 0.72 + (i % 2) * 0.1, i + 2);
    }
    // Sidewalks link both façades to the surrounding block.
    for (const side of [-1, 1]) {
      box(world, MAP.w + 9, 0.055, 1.05, 0xc0b8a6, 0, -0.42, side * (MAP.h / 2 + 2.15), { outline: false, castShadow: false });
    }
    return { roadZ, roadX };
  }
  function buildCampusCar(parent, color, x, z, direction = 1, vertical = false) {
    const group = new THREE.Group(); group.name = 'KRA campus car';
    group.position.set(x, -0.35, z);
    group.rotation.y = vertical ? (direction > 0 ? -Math.PI / 2 : Math.PI / 2) : (direction > 0 ? 0 : Math.PI);
    parent.add(group);
    rounded(group, 2.65, 0.54, 1.18, color, 0, 0.53, 0, { outline: false });
    rounded(group, 1.42, 0.62, 0.91, 0xb8c9c4, -0.12, 1.04, 0, { outline: false, transparent: true, opacity: 0.88 });
    rounded(group, 0.72, 0.42, 0.055, 0x587078, 0.30, 1.06, 0.47, { outline: false, transparent: true, opacity: 0.84 });
    rounded(group, 0.72, 0.42, 0.055, 0x587078, 0.30, 1.06, -0.47, { outline: false, transparent: true, opacity: 0.84 });
    rounded(group, 0.42, 0.40, 0.055, 0x587078, -0.57, 1.06, 0.47, { outline: false, transparent: true, opacity: 0.84 });
    rounded(group, 0.42, 0.40, 0.055, 0x587078, -0.57, 1.06, -0.47, { outline: false, transparent: true, opacity: 0.84 });
    for (const wx of [-0.82, 0.82]) for (const wz of [-0.58, 0.58]) {
      const wheel = cylinder(group, 0.22, 0.22, 0.14, 0x303534, wx, 0.13, wz, 12, { outline: false });
      wheel.rotation.z = Math.PI / 2;
      cylinder(group, 0.105, 0.105, 0.15, 0xd0c9b9, wx, 0.13, wz, 10, { outline: false }).rotation.z = Math.PI / 2;
    }
    for (const wz of [-0.37, 0.37]) {
      rounded(group, 0.20, 0.17, 0.08, 0xf7df9f, 1.30, 0.58, wz, { outline: false, emissive: 0xf7df9f, emissiveIntensity: 0.18 });
      rounded(group, 0.18, 0.16, 0.08, 0xc15c4c, -1.30, 0.58, wz, { outline: false });
    }
    return group;
  }
  function buildCampusScooter(parent, x, z, direction = 1) {
    const group = new THREE.Group(); group.name = 'KRA campus motorbike';
    group.position.set(x, -0.35, z); group.rotation.y = direction > 0 ? -Math.PI / 2 : Math.PI / 2; parent.add(group);
    const wheelA = cylinder(group, 0.28, 0.28, 0.13, 0x303534, 0.72, 0.28, 0, 12, { outline: false }); wheelA.rotation.z = Math.PI / 2;
    const wheelB = cylinder(group, 0.28, 0.28, 0.13, 0x303534, -0.72, 0.28, 0, 12, { outline: false }); wheelB.rotation.z = Math.PI / 2;
    rounded(group, 0.85, 0.28, 0.30, 0xe0a34c, -0.06, 0.66, 0, { outline: false });
    rounded(group, 0.54, 0.14, 0.34, 0x3e4846, -0.42, 0.96, 0, { outline: false });
    cylinder(group, 0.045, 0.045, 0.58, 0x485957, 0.58, 0.40, 0, 8, { outline: false }).rotation.z = -0.34;
    rounded(group, 0.19, 0.16, 0.13, 0xf6e2a7, 0.88, 0.72, 0, { outline: false, emissive: 0xf6e2a7, emissiveIntensity: 0.2 });
    // A helmeted rider makes the motorbike read clearly as a moving campus vehicle.
    oval(group, 0.39, 0.43, 0.38, 0x425d58, 0.03, 1.31, 0, { outline: false });
    oval(group, 0.47, 0.22, 0.45, 0xd9bd78, 0.02, 1.51, 0, { outline: false });
    rounded(group, 0.42, 0.54, 0.38, 0x6b8d77, -0.08, 0.92, 0, { outline: false });
    return group;
  }
  function buildCampusPedestrian(parent, shirt, pants, x, z, direction = 1) {
    const group = new THREE.Group(); group.name = 'KRA campus pedestrian'; group.position.set(x, -0.35, z); parent.add(group);
    const torso = oval(group, 0.48, 0.69, 0.38, shirt, 0, 1.03, 0, { outline: false });
    oval(group, 0.40, 0.43, 0.39, 0xd8b18e, 0, 1.65, 0, { outline: false });
    oval(group, 0.43, 0.23, 0.42, 0x493f37, 0, 1.83, 0, { outline: false });
    const legs = [], arms = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(side * 0.14, 0.48, 0); group.add(leg);
      rounded(leg, 0.18, 0.50, 0.20, pants, 0, -0.23, 0, { outline: false });
      rounded(leg, 0.27, 0.12, 0.34, 0x4d4a43, 0.02, -0.40, 0.06, { outline: false });
      legs.push(leg);
      const arm = new THREE.Group(); arm.position.set(side * 0.29, 1.22, 0); group.add(arm);
      rounded(arm, 0.15, 0.48, 0.16, shirt, 0, -0.22, 0, { outline: false }); arms.push(arm);
    }
    group.rotation.y = direction > 0 ? Math.PI / 2 : -Math.PI / 2;
    return { group, legs, arms, torso, phase: Math.random() * Math.PI * 2 };
  }
  function buildCampusTraffic(world, MAP, roads) {
    const traffic = [];
    const roadLimitX = (MAP.w + 19) / 2 - 2.2, roadLimitZ = (MAP.h + 19) / 2 - 2.2;
    traffic.push({ kind: 'vehicle', axis: 'x', sign: 1, limit: roadLimitX, speed: 4.1,
      group: buildCampusCar(world, 0x6f9785, -roadLimitX * 0.58, roads.roadZ - 0.8, 1, false) });
    traffic.push({ kind: 'vehicle', axis: 'x', sign: -1, limit: roadLimitX, speed: 3.4,
      group: buildCampusCar(world, 0xc27a67, roadLimitX * 0.28, -roads.roadZ + 0.8, -1, false) });
    traffic.push({ kind: 'vehicle', axis: 'z', sign: 1, limit: roadLimitZ, speed: 2.7,
      group: buildCampusScooter(world, roads.roadX - 0.85, -roadLimitZ * 0.52, 1) });
    const walkLimit = MAP.w / 2 - 3;
    traffic.push({ kind: 'pedestrian', axis: 'x', sign: 1, limit: walkLimit, speed: 0.9,
      walker: buildCampusPedestrian(world, 0x6c8b75, 0x53665b, -walkLimit, MAP.h / 2 + 2.15, 1) });
    traffic.push({ kind: 'pedestrian', axis: 'x', sign: -1, limit: walkLimit, speed: 0.74,
      walker: buildCampusPedestrian(world, 0x7d7798, 0x79624c, walkLimit, -MAP.h / 2 - 2.15, -1) });
    traffic.forEach(actor => { if (actor.group) actor.group.userData.kraCampusTraffic = true; else actor.walker.group.userData.kraCampusTraffic = true; });
    return traffic;
  }
  function updateCampusTraffic(dt) {
    sceneState.campusActors.forEach(actor => {
      const object = actor.group || actor.walker.group;
      const position = actor.axis === 'x' ? object.position.x : object.position.z;
      let next = position + actor.sign * actor.speed * dt;
      if (next > actor.limit) next = -actor.limit;
      else if (next < -actor.limit) next = actor.limit;
      if (actor.axis === 'x') object.position.x = next; else object.position.z = next;
      if (actor.walker) {
        const t = sceneState.elapsed * actor.speed * 3 + actor.walker.phase;
        actor.walker.legs.forEach((leg, index) => { leg.rotation.x = Math.sin(t + index * Math.PI) * 0.38; });
        actor.walker.arms.forEach((arm, index) => { arm.rotation.x = -Math.sin(t + index * Math.PI) * 0.24; });
        actor.walker.torso.position.y = 1.03 + Math.abs(Math.sin(t * 2)) * 0.025;
      }
    });
  }
  function buildLowerStoreyShell(parent, MAP) {
    const shell = new THREE.Group(); shell.name = 'KRA lower-storey architecture'; parent.add(shell);
    box(shell, MAP.w + 1.5, 0.48, MAP.h + 1.5, 0x777366, 0, -0.34, 0, { outline: true });
    box(shell, MAP.w + 1.1, 0.12, MAP.h + 1.1, 0xd8d1bf, 0, -0.06, 0, { outline: false });
    const wallHeight = 3.78, frontZ = MAP.h / 2 + 0.04, backZ = -MAP.h / 2 - 0.04;
    const columnColor = 0xc9c0ad, glassColor = 0x92b7b9, mullionColor = 0x6b807c;
    const frontXs = [];
    for (let x = -MAP.w / 2; x <= MAP.w / 2 + 0.01; x += 5.5) frontXs.push(Math.min(x, MAP.w / 2));
    if (frontXs[frontXs.length - 1] < MAP.w / 2 - 0.01) frontXs.push(MAP.w / 2);
    for (const z of [frontZ, backZ]) {
      box(shell, MAP.w + 1.2, 0.22, 0.34, 0x756e61, 0, 0.12, z, { outline: false });
      box(shell, MAP.w + 1.2, 0.28, 0.38, 0xd8d0bd, 0, wallHeight - 0.18, z, { outline: false });
      frontXs.forEach((x, i) => {
        box(shell, 0.34, wallHeight, 0.34, columnColor, x, 0.18, z, { round: true, outline: false });
        if (i < frontXs.length - 1) {
          const mid = (x + frontXs[i + 1]) / 2, width = frontXs[i + 1] - x - 0.38;
          if (Math.abs(mid) < 1.8 && z === frontZ) {
            box(shell, width * 0.42, 2.48, 0.09, glassColor, mid - width * 0.24, 0.78, z, { transparent: true, opacity: 0.56, outline: false, roughness: 0.3 });
            box(shell, width * 0.42, 2.48, 0.09, glassColor, mid + width * 0.24, 0.78, z, { transparent: true, opacity: 0.56, outline: false, roughness: 0.3 });
            box(shell, 0.11, 2.55, 0.14, mullionColor, mid, 0.76, z, { outline: false });
          } else {
            box(shell, width, 2.36, 0.08, glassColor, mid, 0.82, z, { transparent: true, opacity: 0.48, outline: false, roughness: 0.32 });
          }
          box(shell, width + 0.04, 0.08, 0.12, mullionColor, mid, 1.94, z, { outline: false });
        }
      });
    }
    const sideZs = [];
    for (let z = -MAP.h / 2; z <= MAP.h / 2 + 0.01; z += 4.8) sideZs.push(Math.min(z, MAP.h / 2));
    if (sideZs[sideZs.length - 1] < MAP.h / 2 - 0.01) sideZs.push(MAP.h / 2);
    for (const x of [-MAP.w / 2 - 0.04, MAP.w / 2 + 0.04]) {
      box(shell, 0.34, 0.22, MAP.h + 1.2, 0x756e61, x, 0.12, 0, { outline: false });
      box(shell, 0.38, 0.28, MAP.h + 1.2, 0xd8d0bd, x, wallHeight - 0.18, 0, { outline: false });
      sideZs.forEach((z, i) => {
        box(shell, 0.34, wallHeight, 0.34, columnColor, x, 0.18, z, { round: true, outline: false });
        if (i < sideZs.length - 1) {
          const mid = (z + sideZs[i + 1]) / 2, depth = sideZs[i + 1] - z - 0.38;
          box(shell, 0.08, 2.36, depth, glassColor, x, 0.82, mid, { transparent: true, opacity: 0.48, outline: false, roughness: 0.32 });
          box(shell, 0.12, 0.08, depth + 0.04, mullionColor, x, 1.94, mid, { outline: false });
        }
      });
    }
    const floorLabel = tagSprite('FLOOR 01', '#f7f1e3', 'rgba(50,61,54,.9)', 0.48);
    floorLabel.position.set(0, wallHeight - 0.16, MAP.h / 2 + 0.42); shell.add(floorLabel);
    return shell;
  }

  function createWorld(options) {
    const { MAP, T, floor, deco, ROOM_DEFS, activeFloor } = options;
    const scene = sceneState.scene;
    if (sceneState.world) {
      scene.remove(sceneState.world);
      const geometries = new Set(), materials = new Set(), textures = new Set();
      sceneState.world.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
        list.forEach(value => { materials.add(value); if (value.map) textures.add(value.map); });
      });
      geometries.forEach(value => value.dispose()); textures.forEach(value => value.dispose()); materials.forEach(value => value.dispose());
    }
    sceneState.roomLabels = []; sceneState.materials.clear(); sceneState.softShapes.clear();
    scene.background.set(activeFloor === 2 ? 0x666b66 : 0x68745d);
    const world = new THREE.Group(); scene.add(world); sceneState.world = world;
    sceneState.floorElevation = activeFloor === 2 ? 4.3 : 0;
    const structure = new THREE.Group(); structure.name = 'KRA active floor ' + activeFloor; structure.position.y = sceneState.floorElevation;
    world.add(structure); sceneState.structure = structure;
    const materials = sceneState.materials;
    // A bevelled architectural base gives the room plate the paper-model silhouette.
    box(structure, MAP.w + 1.5, 0.48, MAP.h + 1.5, 0x807969, 0, -0.34, 0, { outline: true });
    box(structure, MAP.w + 1.1, 0.12, MAP.h + 1.1, 0xe1d9c7, 0, -0.06, 0, { outline: false });
    const tileGeometry = new THREE.BoxGeometry(0.99, 0.11, 0.99);
    const tileMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, vertexColors: true });
    const tiles = new THREE.InstancedMesh(tileGeometry, tileMaterial, MAP.w * MAP.h);
    tiles.name = 'KRA room-coloured floor tiles';
    const dummy = new THREE.Object3D(), tileColor = new THREE.Color(); let index = 0;
    for (let y = 0; y < MAP.h; y += 1) for (let x = 0; x < MAP.w; x += 1) {
      dummy.position.set(worldX(x + 0.5, MAP), -0.055, worldZ(y + 0.5, MAP)); dummy.updateMatrix(); tiles.setMatrixAt(index, dummy.matrix);
      const room = (ROOM_DEFS[activeFloor] || []).find(item => x >= item.x && x < item.x + item.w && y >= item.y && y < item.y + item.h) || null;
      tileColor.setHex(floorColor(floor[y]?.[x], activeFloor, room)).convertSRGBToLinear();
      const grain = Math.sin((x + 1) * 127.1 + (y + 1) * 311.7) * 43758.5453;
      tileColor.multiplyScalar(0.965 + (grain - Math.floor(grain)) * 0.07);
      tiles.setColorAt(index, tileColor); index += 1;
    }
    tiles.instanceMatrix.needsUpdate = true; if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
    tiles.receiveShadow = true; structure.add(tiles);
    // Fine dark grout lines articulate the square floor without returning to pixel art.
    const grout = [];
    for (let x = 0; x <= MAP.w; x += 1) grout.push([worldX(x, MAP), 0.006, -MAP.h / 2, worldX(x, MAP), 0.006, MAP.h / 2]);
    for (let y = 0; y <= MAP.h; y += 1) grout.push([-MAP.w / 2, 0.006, worldZ(y, MAP), MAP.w / 2, 0.006, worldZ(y, MAP)]);
    const groutVertices = [];
    grout.forEach(edge => { groutVertices.push(new THREE.Vector3(edge[0], edge[1], edge[2]), new THREE.Vector3(edge[3], edge[4], edge[5])); });
    const groutGeometry = new THREE.BufferGeometry().setFromPoints(groutVertices);
    structure.add(new THREE.LineSegments(groutGeometry, new THREE.LineBasicMaterial({ color: 0x514b40, transparent: true, opacity: 0.12 })));
    // A narrow lawn, rough stone path and small sculpted shrubs make the building feel like a diorama.
    const lawn = box(world, MAP.w + 5, 0.10, MAP.h + 5, 0x74805d, 0, -0.49, 0, { outline: false, receiveShadow: true });
    lawn.renderOrder = -2;
    const path = box(world, MAP.w + 3.4, 0.05, 1.15, 0xb2a58f, 0, -0.40, MAP.h / 2 + 1.1, { outline: false });
    path.renderOrder = -1;
    for (let i = 0; i < 38; i += 1) {
      const side = i % 2 ? -1 : 1, z = -MAP.h / 2 + 0.8 + (i * 7 % Math.max(1, MAP.h - 1));
      const x = side * (MAP.w / 2 + 1.65 + (i % 3) * 0.28);
      const shrub = new THREE.Group(); shrub.position.set(x, -0.35, z); world.add(shrub);
      const c = i % 3 ? 0x798c63 : 0x8d946c;
      oval(shrub, 1.35, 0.78, 1.3, c, 0, 0.28, 0);
      if (i % 5 === 0) cylinder(shrub, 0.12, 0.18, 0.72, 0x806a4e, 0, 0, 0, 7);
    }
    const campusRoads = buildCampus(world, MAP);
    sceneState.campusActors = buildCampusTraffic(world, MAP, campusRoads);
    if (activeFloor === 2) buildLowerStoreyShell(world, MAP);
    // Room rugs are now physical soft fabric meshes, not sprite overlays.
    (ROOM_DEFS[activeFloor] || []).forEach(room => {
      if (!room.rug) return;
      const rug = room.rug;
      rounded(structure, Math.max(1, rug.w - 0.2), 0.055, Math.max(1, rug.h - 0.2), colorValue(rug.fill, PALETTE.carpet),
        worldX(rug.x + rug.w / 2, MAP), 0.04, worldZ(rug.y + rug.h / 2, MAP));
      const trim = rounded(structure, Math.max(0.8, rug.w - 0.38), 0.018, Math.max(0.8, rug.h - 0.38), colorValue(rug.trim, PALETTE.woodLight),
        worldX(rug.x + rug.w / 2, MAP), 0.076, worldZ(rug.y + rug.h / 2, MAP));
      trim.material.transparent = true; trim.material.opacity = 0.72;
    });
    const doors = [];
    (ROOM_DEFS[activeFloor] || []).forEach(room => {
      const wall = wallColor(room), left = room.x, right = room.x + room.w, top = room.y, bottom = room.y + room.h;
      const doorX = typeof options.roomDoorCenter === 'function' ? options.roomDoorCenter(room) : room.x + room.w / 2 + 0.5;
      const doorEdge = room.y === 0 ? bottom : top;
      const opening = [doorX, 1.18];
      drawXWall(structure, room, left, right, top, wall, room.y === 0 ? 2.55 : 2.35, room.y > 0 ? opening : null, MAP);
      drawXWall(structure, room, left, right, bottom, wall, room.y + room.h >= MAP.h ? 2.55 : 1.42,
        room.y === 0 ? opening : null, MAP);
      drawZWall(structure, room, top, bottom, left, wall, 2.3, null, MAP);
      drawZWall(structure, room, top, bottom, right, wall, room.x + room.w >= MAP.w ? 2.55 : 1.35, null, MAP);
      // Warm, framed sliding doors sit in the circulation hall opening.
      const door = createDoor(structure, room, doorX, doorEdge, MAP, T);
      doors.push(door);
      addRoomName(structure, room, MAP);
      // A few exterior glass panels and posts give the handmade building a readable façade.
      if (room.y === 0) addWindow(structure, worldX((left + right) / 2, MAP), worldZ(top, MAP), Math.min(3.2, room.w * 0.42));
    });
    // Soft corner columns and a bright glazed lift well in the circulation spine.
    for (const x of [-MAP.w / 2, MAP.w / 2]) for (const z of [-MAP.h / 2, MAP.h / 2]) {
      box(structure, 0.32, 2.55, 0.32, 0xbeb29d, x, 0, z, { round: true, outline: true });
    }
    const lift = createElevator(structure, MAP, options);
    // Real 3D forms replace all atlas billboards: desks, chairs, storage, beds and plants are built from mesh pieces.
    const staticProps = collectProps(options);
    staticProps.forEach(item => buildProp(structure, item, MAP, T));
    // Soft-block character rigs are adapted from kantor-ai's MIT-licensed procedural avatar model.
    const avatars = new Map();
    options.AGENTS.forEach((agent, i) => {
      const avatar = buildAvatar(structure, agent, i, MAP);
      avatars.set(agent.id, avatar);
    });
    if (activeFloor === 1) buildOfficeCat(structure, options.cybercat, MAP);
    addRoomLights(structure, ROOM_DEFS[activeFloor] || [], MAP);
    sceneState.doors = doors; sceneState.avatars = avatars; sceneState.props = staticProps; sceneState.elevator = lift;
    sceneState.map = { w: MAP.w, h: MAP.h, corridorY: MAP.corridorY, activeFloor };
    sceneState.options = options;
    updateHighlight(options);
  }
  function drawXWall(parent, room, start, end, row, color, height, opening, MAP) {
    const half = opening ? opening[1] / 2 : 0, center = opening ? opening[0] : -999;
    const segments = opening ? [[start, Math.max(start, center - half)], [Math.min(end, center + half), end]] : [[start, end]];
    const z = worldZ(row, MAP), thickness = 0.22;
    segments.forEach(([a, b]) => {
      if (b - a < 0.18) return;
      const length = b - a;
      box(parent, length, height, thickness, color, worldX((a + b) / 2, MAP), 0, z, { outline: true });
      box(parent, length + 0.025, 0.12, thickness + 0.12, PALETTE.trim, worldX((a + b) / 2, MAP), height - 0.09, z, { outline: false });
      for (let course = 1; course < 4; course += 1) {
        const yy = course * height / 4;
        box(parent, length * 0.99, 0.018, thickness + 0.012, 0xb8aa91, worldX((a + b) / 2, MAP), yy, z, { outline: false });
      }
      for (let x = a + 1.25; x < b - 0.2; x += 1.25) {
        box(parent, 0.018, height * 0.47, thickness + 0.015, 0x998f7f, worldX(x, MAP), height * ((Math.floor(x * 2) % 2) ? 0.14 : 0.52), z, { outline: false });
      }
    });
  }
  function drawZWall(parent, room, start, end, col, color, height, opening, MAP) {
    const half = opening ? opening[1] / 2 : 0, center = opening ? opening[0] : -999;
    const segments = opening ? [[start, Math.max(start, center - half)], [Math.min(end, center + half), end]] : [[start, end]];
    const x = worldX(col, MAP), thickness = 0.22;
    segments.forEach(([a, b]) => {
      if (b - a < 0.18) return;
      const length = b - a;
      box(parent, thickness, height, length, color, x, 0, worldZ((a + b) / 2, MAP), { outline: true });
      box(parent, thickness + 0.12, 0.12, length + 0.025, PALETTE.trim, x, height - 0.09, worldZ((a + b) / 2, MAP), { outline: false });
      for (let course = 1; course < 4; course += 1) {
        box(parent, thickness + 0.012, 0.018, length * 0.99, 0xb8aa91, x, course * height / 4, worldZ((a + b) / 2, MAP), { outline: false });
      }
    });
  }
  function createDoor(parent, room, x, row, MAP, T) {
    const group = new THREE.Group(); parent.add(group);
    group.position.set(worldX(x, MAP), 0, worldZ(row, MAP));
    const height = 1.75, width = 1.08;
    box(group, 0.09, height, 0.16, 0x8e6e4b, -width / 2, 0, 0, { round: true });
    box(group, 0.09, height, 0.16, 0x8e6e4b, width / 2, 0, 0, { round: true });
    box(group, width + 0.1, 0.12, 0.2, 0xe2d5bc, 0, height - 0.06, 0, { outline: false });
    const left = box(group, width * 0.44, height * 0.9, 0.075, 0xb38b62, -width * 0.235, 0.05, 0.015, { round: true, outline: true });
    const right = box(group, width * 0.44, height * 0.9, 0.075, 0xc39a6e, width * 0.235, 0.05, -0.015, { round: true, outline: true });
    const windowPanel = box(group, width * 0.28, 0.45, 0.025, 0x91b5b3, 0, 1.0, 0.065, { outline: false, transparent: true, opacity: 0.58 });
    return { group, room, x, row, left, right, windowPanel, width, height };
  }
  function addWindow(parent, x, z, width) {
    const pane = box(parent, width, 0.75, 0.055, 0x9fbab8, x, 1.0, z - 0.13, { outline: true, transparent: true, opacity: 0.42 });
    pane.material.metalness = 0.08;
    box(parent, width + 0.18, 0.08, 0.18, 0xd5c8ae, x, 0.9, z - 0.1, { outline: false });
    box(parent, width + 0.18, 0.08, 0.18, 0xd5c8ae, x, 1.75, z - 0.1, { outline: false });
  }
  function addRoomName(parent, room, MAP) {
    const title = String(room.label || room.id).replace(/^\d+\s*/, '').replace(/\s+-\s+.*/, '');
    const sprite = tagSprite(title, '#fff9ed', 'rgba(49,47,41,.72)', 0.46);
    sprite.position.set(worldX(room.x + room.w / 2, MAP), 2.82, worldZ(room.y + 0.65, MAP));
    parent.add(sprite); sceneState.roomLabels.push({ id: room.id, sprite });
  }
  function addRoomLights(parent, rooms, MAP) {
    rooms.forEach(room => {
      const x = worldX(room.x + room.w / 2, MAP), z = worldZ(room.y + room.h / 2, MAP);
      const warm = new THREE.PointLight(0xffe4b3, 0.33, 9, 2); warm.position.set(x, 2.25, z); parent.add(warm);
      if (room.wall === 'server' || room.wall === 'obs' || room.wall === 'war') {
        const cool = new THREE.PointLight(0x9bd3d2, 0.42, 6, 2); cool.position.set(x, 1.6, z); parent.add(cool);
      }
    });
  }
  function collectProps(options) {
    const { MAP, deco, activeFloor, customDecor, surfaceDecor, getItemFootprint } = options;
    const list = [], occupied = new Set();
    for (let y = 0; y < MAP.h; y += 1) for (let x = 0; x < MAP.w; x += 1) {
      const id = deco[y]?.[x]; if (!id || occupied.has(x + ',' + y)) continue;
      const fp = getItemFootprint(id) || { cols: 1, rows: 1 };
      list.push({ id, x, y, cols: fp.cols || 1, rows: fp.rows || 1 });
      for (let dy = 0; dy < (fp.rows || 1); dy += 1) for (let dx = 0; dx < (fp.cols || 1); dx += 1) occupied.add((x + dx) + ',' + (y + dy));
    }
    (customDecor[activeFloor] || new Map()).forEach((id, key) => {
      const [x, y] = key.split(',').map(Number); if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const fp = options.isAtlasItem(id) ? getItemFootprint(id) : { cols: 1, rows: 1 };
      list.push({ id, x, y, cols: fp.cols || 1, rows: fp.rows || 1, custom: true });
    });
    (surfaceDecor || []).forEach(item => list.push({ ...item, cols: 1, rows: 1, surface: true }));
    return list;
  }
  function buildProp(parent, item, MAP, T) {
    const id = String(item.id || '').toLowerCase(), cols = Math.max(1, item.cols || 1), rows = Math.max(1, item.rows || 1);
    const x = worldX(item.x + cols / 2, MAP), z = worldZ(item.y + rows / 2, MAP), w = Math.min(2.5, cols * 0.9), d = Math.min(1.8, rows * 0.82);
    const group = new THREE.Group(); group.position.set(x, 0, z); parent.add(group); group.userData.kraProp = id;
    const wood = /meeting|executive|records|office|desk|table|coffee|barista|pantry/.test(id) ? PALETTE.woodLight : PALETTE.wood;
    const metal = /server|rack|ups|gpu|forge|terminal|console/.test(id);
    const isChair = /chair|seat|stool|armchair/.test(id);
    const isPlant = /plant|bonsai|cactus|tree|fern|shrub/.test(id);
    const isBed = /bed|bunk/.test(id);
    const isSofa = /sofa|couch|lounge|bench/.test(id);
    const isLamp = /lamp|light|lantern/.test(id);
    const isShelf = /shelf|bookcase|bookshelf|cabinet|locker|archive|storage/.test(id);
    const isServer = /server|rack|ups|gpu|compute|data_crystal/.test(id);
    const isScreen = /monitor|display|board|screen|terminal|workstation|console|arcade|computer/.test(id);
    if (isPlant) {
      cylinder(group, 0.31, 0.25, 0.45, /cactus/.test(id) ? 0xb97d53 : 0xc4966e, 0, 0, 0);
      cylinder(group, 0.07, 0.09, 0.72, 0x7a6349, 0, 0.45, 0, 7);
      for (let i = 0; i < 7; i += 1) {
        const a = i * 2.399, leaf = oval(group, 0.27, 0.65, 0.12, i % 2 ? 0x6e8d62 : 0x91a676, Math.cos(a) * 0.23, 0.82 + (i % 3) * 0.12, Math.sin(a) * 0.23);
        leaf.rotation.z = Math.sin(a) * 0.48; leaf.rotation.x = Math.cos(a) * 0.30;
      }
    } else if (isChair) {
      cylinder(group, 0.08, 0.16, 0.46, PALETTE.metal, 0, 0, 0);
      cylinder(group, 0.28, 0.28, 0.13, 0x544f47, 0, 0.43, 0);
      rounded(group, 0.74, 0.19, 0.70, /manager|exec/.test(id) ? 0x75685c : 0x87917a, 0, 0.61, 0);
      rounded(group, 0.72, 0.82, 0.17, 0x8e9982, 0, 1.02, -0.27);
      for (let i = 0; i < 5; i += 1) { const a = i * Math.PI * 2 / 5; box(group, 0.06, 0.04, 0.62, PALETTE.dark, Math.sin(a) * 0.28, 0.1, Math.cos(a) * 0.28).rotation.y = a; }
    } else if (isBed) {
      box(group, w, 0.42, d, 0x866c51, 0, 0, 0, { outline: true });
      rounded(group, w * 0.92, 0.22, d * 0.84, 0xe4dfd2, 0, 0.47, 0);
      rounded(group, w * 0.27, 0.18, d * 0.25, 0xf3eddf, -w * 0.28, 0.65, -d * 0.22);
      rounded(group, w * 0.52, 0.08, d * 0.07, 0x83978b, w * 0.1, 0.64, d * 0.34);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(group, 0.08, 0.48, 0.08, 0x745e48, sx * (w / 2 - 0.12), 0, sz * (d / 2 - 0.12));
    } else if (isSofa) {
      rounded(group, w, 0.47, d * 0.8, 0xb6c1a6, 0, 0.46, 0);
      rounded(group, w, 0.78, 0.24, 0x91a189, 0, 0.71, -d * 0.34);
      for (const sx of [-1, 1]) rounded(group, 0.24, 0.65, d * 0.8, 0x91a189, sx * (w / 2 - 0.07), 0.41, 0);
      rounded(group, w * 0.38, 0.14, d * 0.22, 0xe5dac6, 0, 0.74, 0.12);
    } else if (isLamp) {
      cylinder(group, 0.28, 0.33, 0.12, 0x78634b, 0, 0, 0);
      cylinder(group, 0.04, 0.05, 1.48, 0x655b4d, 0, 0.1, 0);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.42, 12, 1, true), material(0xe0c58e, { roughness: 0.65, emissive: 0x6a4720, emissiveIntensity: 0.28 }));
      shade.position.set(0, 1.57, 0); group.add(shade);
      const glow = new THREE.PointLight(0xffd58d, 0.26, 4, 2); glow.position.set(0, 1.42, 0); group.add(glow);
    } else if (isServer || isShelf) {
      const height = isServer ? 2.05 : 1.65;
      rounded(group, w, height, d, isServer ? 0x515d60 : 0x9b8568, 0, height / 2, 0, { outline: true });
      box(group, w * 0.86, height * 0.72, 0.05, isServer ? 0x303c40 : 0x765f48, 0, height * 0.48, d * 0.52, { outline: false });
      if (isServer) {
        for (let row = 0; row < 5; row += 1) {
          box(group, w * 0.73, 0.12, 0.06, 0x263236, 0, 0.28 + row * 0.31, d * 0.56, { outline: false });
          const led = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), material(row % 2 ? 0x7fcb95 : 0xe6bb68, { emissive: row % 2 ? 0x1d5c3e : 0x704a19, emissiveIntensity: 0.7 }));
          led.position.set(-w * 0.33, 0.3 + row * 0.31, d * 0.61); group.add(led);
        }
      } else {
        for (let row = 0; row < 3; row += 1) box(group, w * 0.82, 0.045, 0.07, 0xc0a47c, 0, 0.42 + row * 0.36, d * 0.57, { outline: false });
      }
    } else if (isScreen) {
      // Work desk or console, made as separate monitor, keyboard, and a rounded wood worktop.
      box(group, w, 0.12, d, wood, 0, 0.88, 0, { round: true, outline: true });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(group, 0.09, 0.84, 0.09, 0x78654f, sx * (w / 2 - 0.12), 0, sz * (d / 2 - 0.12));
      rounded(group, 0.82, 0.53, 0.09, 0x545956, 0, 1.27, -d * 0.22, { outline: true });
      box(group, 0.67, 0.38, 0.025, /server|data|crt/.test(id) ? 0x729a99 : 0xa9c5c1, 0, 1.28, -d * 0.15, { outline: false, emissive: /server/.test(id) ? 0x1d4442 : 0x0b1816, emissiveIntensity: 0.22 });
      rounded(group, 0.86, 0.045, 0.24, 0x777269, 0, 0.98, d * 0.23);
      cylinder(group, 0.07, 0.1, 0.14, PALETTE.dark, w * 0.32, 0.93, d * 0.18);
      if (/workstation|desk|table/.test(id)) buildChairBeside(group, -d * 0.74, 0);
    } else if (/arcade|game/.test(id)) {
      rounded(group, 0.8, 1.75, 0.7, 0x986b55, 0, 0.88, 0, { outline: true });
      box(group, 0.68, 0.55, 0.05, 0x67a2a1, 0, 1.45, 0.36, { outline: false, emissive: 0x173e3c, emissiveIntensity: 0.55 });
      sphere(group, 0.11, 0.11, 0.11, 0xc47d55, 0.2, 0.92, 0.4);
    } else {
      // Dining/conference tables, cabinets and small office objects all get a coherent physical form.
      const tableHeight = /table|conference|meeting|dining/.test(id) ? 0.78 : 0.54;
      rounded(group, w, 0.14, d, /table|desk|dining/.test(id) ? wood : 0xa18f76, 0, tableHeight, 0, { outline: true });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(group, 0.09, tableHeight, 0.09, 0x765f48, sx * (w / 2 - 0.12), 0, sz * (d / 2 - 0.12));
      if (/table|conference|meeting/.test(id)) {
        cylinder(group, 0.11, 0.14, 0.22, 0xc9a66f, 0, tableHeight + 0.07, 0, 10);
        oval(group, 0.3, 0.18, 0.26, 0x72876c, w * 0.29, tableHeight + 0.18, -d * 0.2);
      }
    }
    if (item.custom && !isPlant && !isChair && !isServer && !isScreen && !isSofa && !isBed && !isShelf && !isLamp) {
      const mark = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), material(0xc7924f)); mark.position.set(0, 0.73, 0.12); group.add(mark);
    }
    if (item.surface) group.scale.setScalar(0.7);
  }
  function buildChairBeside(parent, z, x) {
    cylinder(parent, 0.07, 0.11, 0.35, 0x61625d, x, 0, z);
    rounded(parent, 0.58, 0.16, 0.54, 0x849280, x, 0.51, z);
    rounded(parent, 0.58, 0.64, 0.15, 0x849280, x, 0.85, z - 0.2);
  }
  function sphere(parent, w, h, d, color, x, y, z) { return oval(parent, w, h, d, color, x, y, z); }
  function part(parent, geometry, color, x, y, z) { return mesh(parent, geometry, color, { x, y, z }, { outline: false }); }
  function joint(parent, x, y, z, length, width, color) {
    const pivot = new THREE.Group(); pivot.position.set(x, y, z); parent.add(pivot);
    part(pivot, softBox(width, length, width * 0.92), color, 0, -length / 2, 0); return pivot;
  }
  function buildAvatar(parent, agent, index, MAP) {
    const outer = new THREE.Group(); parent.add(outer); outer.userData.agentId = agent.id;
    const scale = agent.appearance?.body === 'broad_deep' ? 0.88 : agent.appearance?.body === 'petite_light' ? 0.76 : 0.82;
    const body = new THREE.Group(); body.scale.setScalar(scale); outer.add(body);
    const hips = new THREE.Group(); hips.position.y = 0.78; body.add(hips);
    const primary = colorValue(agent.palette?.primary, 0x70826f), accent = colorValue(agent.palette?.accent, 0xd5b16c);
    const skin = colorValue(agent.palette?.skin || agent.appearance?.skin, 0xd6a781), hair = colorValue(agent.palette?.hair, 0x352a24);
    const trousers = /formal_navy/.test(agent.appearance?.bottom || '') ? 0x38435a : /cargo/.test(agent.appearance?.bottom || '') ? 0x5b5a54 : 0x696357;
    part(hips, softBox(0.55, 0.17, 0.35), trousers, 0, 0.015, 0);
    oval(hips, 0.65, 0.7, 0.43, primary, 0, 0.39, 0);
    // Distinctive workwear layers: coat hems, suit lapels, colored scarves and role badges.
    if (agent.appearance?.top === 'white_lab_coat') {
      rounded(hips, 0.16, 0.54, 0.045, 0x657b88, 0, 0.40, 0.226);
      rounded(hips, 0.13, 0.48, 0.04, 0xf0eee4, -0.17, 0.42, 0.20);
    } else if (/suit/.test(agent.appearance?.top || '')) {
      rounded(hips, 0.10, 0.48, 0.035, 0xe0d4b8, 0, 0.43, 0.222);
      rounded(hips, 0.055, 0.38, 0.025, accent, 0, 0.40, 0.247);
    } else if (agent.appearance?.top === 'tactical_vest_purple') {
      rounded(hips, 0.28, 0.35, 0.045, 0x4c3c6d, -0.18, 0.40, 0.20);
      rounded(hips, 0.28, 0.35, 0.045, 0x4c3c6d, 0.18, 0.40, 0.20);
    }
    rounded(hips, 0.12, 0.13, 0.12, accent, 0.31, 0.42, 0.10);
    const head = new THREE.Group(); head.position.y = 1.01; hips.add(head);
    oval(head, 0.67, 0.68, 0.59, skin, 0, 0.02, 0.02);
    const isHijab = agent.appearance?.hair === 'hijab_emerald';
    if (isHijab) {
      oval(head, 0.76, 0.78, 0.69, 0x246a50, 0, 0.06, -0.075);
      rounded(head, 0.72, 0.38, 0.46, 0x246a50, 0, -0.25, -0.02);
      oval(head, 0.44, 0.06, 0.025, 0xe2d7bd, 0, -0.19, 0.34);
    } else {
      oval(head, 0.72, 0.38, 0.65, hair, 0, 0.25, -0.055);
      for (let i = 0; i < 5; i += 1) { const lock = oval(head, 0.21, 0.26, 0.22, hair, -0.27 + i * 0.13, 0.27 + Math.sin(i) * 0.035, 0.18); lock.rotation.z = -0.3 + i * 0.1; }
      if (agent.appearance?.body === 'petite_light') {
        oval(head, 0.64, 0.66, 0.25, hair, 0, -0.12, -0.25);
        for (const side of [-1, 1]) oval(head, 0.18, 0.52, 0.25, hair, side * 0.28, -0.1, -0.08);
      } else oval(head, 0.59, 0.32, 0.22, hair, 0, 0.12, -0.27);
    }
    for (const side of [-1, 1]) {
      oval(head, 0.12, 0.18, 0.12, skin, side * 0.33, 0, 0);
      oval(head, 0.055, 0.075, 0.025, 0x352c26, side * 0.13, 0.04, 0.292);
      oval(head, 0.016, 0.022, 0.012, 0xffffff, side * 0.13 - 0.008, 0.055, 0.31);
    }
    oval(head, 0.08, 0.055, 0.065, skin, 0, -0.03, 0.30);
    oval(head, 0.085, 0.026, 0.02, 0x885b4a, 0, -0.14, 0.285);
    if (agent.appearance?.face === 'beard_mustache') oval(head, 0.30, 0.19, 0.12, hair, 0, -0.20, 0.22);
    const legs = [-1, 1].map(side => {
      const thigh = joint(hips, side * 0.15, -0.03, 0, 0.36, 0.23, trousers);
      const knee = joint(thigh, 0, -0.34, 0, 0.37, 0.22, trousers);
      rounded(knee, 0.25, 0.11, 0.34, 0x4c4841, 0, -0.38, 0.055);
      return { thigh, knee };
    });
    const arms = [-1, 1].map(side => {
      const shoulder = joint(hips, side * 0.42, 0.62, 0, 0.32, 0.21, primary);
      const elbow = joint(shoulder, 0, -0.32, 0, 0.29, 0.18, skin);
      oval(elbow, 0.2, 0.2, 0.2, skin, 0, -0.30, 0);
      return { shoulder, elbow };
    });
    // Small tools are modelled, never composed as raster sprites.
    if (agent.appearance?.heldItem === 'wrench_tool') cylinder(arms[1].elbow, 0.035, 0.035, 0.38, 0x93a9ad, 0.02, -0.31, 0.08, 8);
    if (agent.appearance?.heldItem === 'glasses_tablet') rounded(arms[1].elbow, 0.23, 0.17, 0.025, 0x414847, 0.02, -0.32, 0.12);
    const selection = new THREE.Mesh(new THREE.RingGeometry(0.54, 0.66, 32), new THREE.MeshBasicMaterial({ color: accent, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
    selection.rotation.x = -Math.PI / 2; selection.position.y = 0.035; selection.visible = false; outer.add(selection);
    const label = tagSprite(agent.name || agent.id, '#fff8e8', 'rgba(48,45,40,.78)', 0.37); label.position.set(0, 2.5 * scale, 0); outer.add(label);
    const bubble = speechBubbleSprite(); bubble.position.set(0.36, 3.22 * scale, 0); bubble.visible = false; outer.add(bubble);
    return { group: outer, body, hips, head, legs, arms, selection, label, bubble, shirt: primary };
  }
  function buildOfficeCat(parent, cat, MAP) {
    if (!cat) return null;
    const group = new THREE.Group(); group.position.set(worldX(cat.x + 0.5, MAP), 0, worldZ(cat.y + 0.5, MAP)); parent.add(group);
    const fur = 0x9c7449;
    oval(group, 0.72, 0.30, 0.42, fur, 0, 0.34, 0);
    oval(group, 0.38, 0.34, 0.36, 0xc28f57, 0.28, 0.48, 0.18);
    for (const side of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.105, 0.24, 4), material(fur)); ear.position.set(0.18 + side * 0.12, 0.72, 0.18); ear.rotation.z = side * -0.15; group.add(ear); }
    const tail = cylinder(group, 0.07, 0.1, 0.62, fur, -0.36, 0.35, -0.12, 8); tail.rotation.z = 1.12;
    return group;
  }
  function updateHighlight(options) {
    if (!sceneState.world) return;
    if (sceneState.highlight) { sceneState.structure.remove(sceneState.highlight); sceneState.highlight.geometry.dispose(); sceneState.highlight.material.dispose(); sceneState.highlight = null; }
    const room = (options.ROOM_DEFS[options.activeFloor] || []).find(item => item.id === options.activeRoomId);
    if (!room) return;
    const pts = [new THREE.Vector3(worldX(room.x, options.MAP), 0.035, worldZ(room.y, options.MAP)),
      new THREE.Vector3(worldX(room.x + room.w, options.MAP), 0.035, worldZ(room.y, options.MAP)),
      new THREE.Vector3(worldX(room.x + room.w, options.MAP), 0.035, worldZ(room.y + room.h, options.MAP)),
      new THREE.Vector3(worldX(room.x, options.MAP), 0.035, worldZ(room.y + room.h, options.MAP)),
      new THREE.Vector3(worldX(room.x, options.MAP), 0.035, worldZ(room.y, options.MAP))];
    sceneState.highlight = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: colorValue(room.accent, 0xe3bf7a), linewidth: 2 }));
    sceneState.highlight.userData.roomId = room.id;
    sceneState.structure.add(sceneState.highlight);
  }
  function updateCursor(options) {
    if (sceneState.cursor) { sceneState.structure.remove(sceneState.cursor); sceneState.cursor.geometry.dispose(); sceneState.cursor.material.dispose(); sceneState.cursor = null; }
    const x = options.mouseTileX, y = options.mouseTileY;
    if (!options.decorMode || x < 0 || x >= options.MAP.w || y < 0 || y >= options.MAP.h) return;
    const color = options.selectedDecorItem === 'remove' ? 0xe76e5e : 0x75af8c;
    const shape = new THREE.PlaneGeometry(0.92, 0.92);
    const ghost = new THREE.Mesh(shape, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }));
    ghost.rotation.x = -Math.PI / 2; ghost.position.set(worldX(x + 0.5, options.MAP), 0.035, worldZ(y + 0.5, options.MAP));
    sceneState.structure.add(ghost); sceneState.cursor = ghost;
  }
  function signatureOf(options) {
    return [options.activeFloor, options.MAP.w, options.MAP.h, options.MAP.corridorY,
      (options.ROOM_DEFS[options.activeFloor] || []).map(r => [r.id, r.x, r.y, r.w, r.h, r.wall, r.rug && [r.rug.x, r.rug.y, r.rug.w, r.rug.h, r.rug.fill].join('/')].join(':')).join('|'),
      options.deco.map(row => row.map(v => v || '').join(',')).join(';'),
      [...(options.customDecor[options.activeFloor] || new Map()).entries()].map(v => v.join('@')).join('|')].join('~');
  }
  function updateDoorState(door, options) {
    const key = options.activeFloor + ':' + door.room.id, center = door.x;
    const threshold = door.room.y === 0 ? door.room.y + door.room.h : door.room.y;
    const approaching = options.AGENTS.some(a => !a.inTransit && (a.floorId || 1) === options.activeFloor
      && Math.abs(a.x + 0.5 - center) < 1.35 && Math.abs(a.y + 0.5 - threshold) < 1.9);
    const target = approaching ? 1 : 0, current = options.roomDoorStates.get(key) || 0;
    const dt = Math.min(0.05, (options.deltaMs || 16.67) / 1000), rate = target ? 8.2 : 4.6;
    const next = current + (target - current) * (1 - Math.exp(-dt * rate));
    options.roomDoorStates.set(key, Math.abs(target - next) < 0.012 ? target : next);
    const open = options.roomDoorStates.get(key);
    door.left.position.x = -door.width * (0.24 + open * 0.50);
    door.right.position.x = door.width * (0.24 + open * 0.50);
    door.windowPanel.material.opacity = 0.44 + open * 0.20;
  }
  function updateElevator(options) {
    const lift = sceneState.elevator; if (!lift) return;
    const x = Math.floor(options.MAP.w / 2 - 1), y = options.MAP.corridorY;
    const near = options.AGENTS.some(a => !a.inTransit && (a.floorId || 1) === options.activeFloor
      && Math.abs(a.x + 0.5 - options.MAP.w / 2) < 1.4 && Math.abs(a.y + 0.5 - (y + 1)) < 1.4);
    const target = !options.elevator.motion && (near || Math.floor(options.clock / 24) % 10 === 8) ? 1 : 0;
    const dt = Math.min(0.05, (options.deltaMs || 16.67) / 1000);
    options.elevator.openness += (target - options.elevator.openness) * (1 - Math.exp(-dt * 7.8));
    if (Math.abs(target - options.elevator.openness) < 0.012) options.elevator.openness = target;
    const open = options.elevator.openness;
    lift.left.position.x = -0.42 - open * 0.38; lift.right.position.x = 0.42 + open * 0.38;
    const shown = String(options.elevator.motion && performance.now() - options.elevator.motion.startedAt > 600 ? options.elevator.motion.toFloor : options.activeFloor).padStart(2, '0');
    if (lift.label.text !== shown) { lift.label.text = shown; updateTagTexture(lift.label); }
  }
  function updateTagTexture(sprite) {
    const texture = sprite.material.map, canvas = texture && texture.image;
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    if (sprite.userData?.kraSpeechBubble) {
      drawSpeechTexture(ctx, canvas.width, canvas.height, sprite.text || '');
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = 'rgba(45,43,38,.86)'; ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(10, 16, canvas.width - 20, canvas.height - 32, 22); else ctx.rect(10, 16, canvas.width - 20, canvas.height - 32);
      ctx.fill(); ctx.fillStyle = '#f5f0e6'; ctx.font = '700 42px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(sprite.text || '', canvas.width / 2, canvas.height / 2);
    }
    texture.needsUpdate = true;
  }
  function createElevator(parent, MAP, options) {
    const gx = Math.floor(MAP.w / 2 - 1), gy = MAP.corridorY, x = worldX(gx + 1, MAP), z = worldZ(gy + 1, MAP);
    const group = new THREE.Group(); group.name = 'KRA glass elevator'; group.position.set(x, 0, z); parent.add(group);
    rounded(group, 2.55, 0.12, 2.55, 0x5e716c, 0, 0.02, 0, { outline: true });
    rounded(group, 2.12, 0.07, 2.12, 0x34464a, 0, 0.12, 0, { outline: false });
    // Four glass sides and a readable canopy make the lift unmistakable at office scale.
    rounded(group, 0.055, 1.92, 1.72, 0x9bc1bc, -0.98, 1.08, 0, { outline: false, transparent: true, opacity: 0.20 });
    rounded(group, 0.055, 1.92, 1.72, 0x9bc1bc, 0.98, 1.08, 0, { outline: false, transparent: true, opacity: 0.20 });
    rounded(group, 1.92, 1.92, 0.055, 0x9bc1bc, 0, 1.08, -0.98, { outline: false, transparent: true, opacity: 0.22 });
    rounded(group, 2.02, 0.14, 2.02, 0xb5c8b9, 0, 2.06, -0.02, { outline: false });
    const rails = [];
    for (const sx of [-1.02, 1.02]) for (const sz of [-1.02, 1.02]) rails.push(box(group, 0.09, 2.10, 0.09, 0x8fa9a0, sx, 0.12, sz, { outline: false }));
    const left = box(group, 1.0, 1.70, 0.06, 0x9bbdb6, -0.50, 0.15, 1.04, { outline: true, transparent: true, opacity: 0.74 });
    const right = box(group, 1.0, 1.70, 0.06, 0x9bbdb6, 0.50, 0.15, 1.04, { outline: true, transparent: true, opacity: 0.74 });
    rounded(group, 0.22, 0.55, 0.13, 0x5d7772, 1.22, 1.13, 0.44, { outline: false });
    rounded(group, 0.09, 0.12, 0.045, 0xbce9ca, 1.22, 1.30, 0.51, { outline: false, emissive: 0xbce9ca, emissiveIntensity: 0.35 });
    const label = tagSprite(String(options.activeFloor).padStart(2, '0'), '#e9f1df', 'rgba(38,57,55,.92)', 0.48);
    label.position.set(0, 2.54, 0); group.add(label);
    return { group, left, right, label };
  }
  function updateAvatar(avatar, agent, dt) {
    const moving = Math.abs(agent.x - (avatar.lastX ?? agent.x)) > 0.001 || Math.abs(agent.y - (avatar.lastY ?? agent.y)) > 0.001;
    avatar.lastX = agent.x; avatar.lastY = agent.y;
    avatar.group.position.set(agent.x + 0.5 - sceneState.map.w / 2, sceneState.floorElevation, agent.y + 0.5 - sceneState.map.h / 2);
    const face = ({ up: Math.PI, north: Math.PI, down: 0, south: 0, left: Math.PI / 2, west: Math.PI / 2, right: -Math.PI / 2, east: -Math.PI / 2 })[agent.facing] ?? 0;
    avatar.group.rotation.y += wrapAngle(face - avatar.group.rotation.y) * Math.min(1, dt * 8);
    const t = sceneState.elapsed + (avatar.index || 0) * 1.7;
    const gait = moving ? Math.sin(t * 9) : 0;
    avatar.body.position.y = Math.sin(t * (moving ? 18 : 2.1)) * (moving ? 0.035 : 0.012);
    avatar.legs.forEach(({ thigh, knee }, i) => { thigh.rotation.x = gait * (i ? -0.36 : 0.36); knee.rotation.x = moving ? Math.max(0, Math.sin(t * 9 + i * Math.PI)) * 0.42 : 0.015; });
    avatar.arms.forEach(({ shoulder, elbow }, i) => {
      shoulder.rotation.x = moving ? gait * (i ? -0.31 : 0.31) : (agent.state === 'working' || /coding|monitoring/i.test(agent.status || '') ? Math.sin(t * 4 + i) * 0.08 - 0.16 : 0.02);
      shoulder.rotation.z = (i ? 1 : -1) * (agent.state === 'communicating' ? Math.sin(t * 4) * 0.12 : 0.04);
      elbow.rotation.x = agent.state === 'working' ? -0.30 + Math.sin(t * 5) * 0.09 : -0.08;
    });
    avatar.selection.visible = sceneState.options.selectedAgent?.id === agent.id || agent.recreationBuffUntil > performance.now();
    if (agent.recreationBuffUntil > performance.now()) avatar.selection.material.color.setHex(0xe4c36f);
    else avatar.selection.material.color.setHex(colorValue(agent.palette?.accent, 0xd6bd80));
    const text = agent.bubble && agent.bubbleUntil > performance.now() ? agent.bubble.slice(0, 34) : '';
    if (avatar.bubble.text !== text) { avatar.bubble.text = text; avatar.bubble.visible = !!text; updateTagTexture(avatar.bubble); }
    avatar.bubble.position.x = 0.38 + Math.sin(t * 1.2) * 0.03;
  }
  function wrapAngle(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
  function update(options) {
    sceneState.options = options; sceneState.elapsed += Math.min(0.05, (options.deltaMs || 16.67) / 1000);
    const nextSignature = signatureOf(options);
    if (!sceneState.world || nextSignature !== sceneState.signature) {
      sceneState.signature = nextSignature; createWorld(options); sceneState.map = { w: options.MAP.w, h: options.MAP.h, corridorY: options.MAP.corridorY, activeFloor: options.activeFloor };
      fitCamera(options.MAP);
    } else if (sceneState.highlight?.userData?.roomId !== options.activeRoomId) updateHighlight(options);
    resize(options.W, options.H); updateCamera(); updateCursor(options);
    const dt = Math.min(0.05, (options.deltaMs || 16.67) / 1000);
    sceneState.doors.forEach(door => updateDoorState(door, options)); updateElevator(options); updateCampusTraffic(dt);
    sceneState.avatars.forEach((avatar, id) => {
      const agent = options.AGENTS.find(item => item.id === id);
      avatar.group.visible = !!agent && !agent.inTransit && (agent.floorId || 1) === options.activeFloor;
      if (avatar.group.visible) updateAvatar(avatar, agent, dt);
    });
    sceneState.renderer.render(sceneState.scene, sceneState.camera);
  }
  function point(x, y, z = 0, MAP = sceneState.map, T = sceneState.T) {
    if (!sceneState.camera || !MAP) return { x: 0, y: 0 };
    const vector = new THREE.Vector3(worldX(x, MAP), sceneState.floorElevation + (z || 0), worldZ(y, MAP)).project(sceneState.camera);
    return { x: (vector.x * 0.5 + 0.5) * sceneState.W, y: (-vector.y * 0.5 + 0.5) * sceneState.H };
  }
  function hitTest(screenX, screenY, MAP = sceneState.map, T = sceneState.T) {
    if (!sceneState.camera || !MAP || !sceneState.raycaster) return { x: -1, y: -1 };
    const ndc = new THREE.Vector2(screenX / sceneState.W * 2 - 1, -(screenY / sceneState.H) * 2 + 1);
    sceneState.raycaster.setFromCamera(ndc, sceneState.camera);
    const hit = new THREE.Vector3();
    if (!sceneState.raycaster.ray.intersectPlane(sceneState.plane, hit)) return { x: -1, y: -1 };
    return { x: Math.floor(hit.x + MAP.w / 2), y: Math.floor(hit.z + MAP.h / 2) };
  }
  function render(options) {
    if (!initRenderer(options)) { options.ctx.clearRect(0, 0, options.W, options.H); return false; }
    sceneState.T = options.T || 32; update(options);
    options.ctx.clearRect(0, 0, options.W, options.H);
    return true;
  }
  function setZoom(factor) { sceneState.radius = Math.max(22, Math.min(112, sceneState.radius * factor)); updateCamera(); }
  function resetCamera() { if (sceneState.map) fitCamera(sceneState.map); }
  root.KRAThreeOfficeRenderer = Object.freeze({
    getCanvasSize: sizeFor, resize, render, point, hitTest, setZoom, resetCamera, consumeClickSuppression,
    getState: () => ({ activeFloor: sceneState.map?.activeFloor, hasScene: !!sceneState.world, objectCount: sceneState.world?.children.length || 0,
      cameraRadius: sceneState.radius, floorElevation: sceneState.floorElevation, campusActorCount: sceneState.campusActors.length })
  });
})(window);
