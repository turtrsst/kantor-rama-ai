/* Procedural creator studio scene, rendered with KRA's local Three.js r128 build. */
(function attachCreatorScene(root) {
  'use strict';
  const THREE = root.THREE;
  const state = { renderer: null, scene: null, camera: null, canvas: null, target: null, actorsGroup: null, actors: [], agents: [], radius: 17, theta: 0.82, phi: 1.0, observer: null, drag: null, failed: false };
  const AMBIENT_BEHAVIORS = [
    { key: 'computer', label: 'Typing at computer', duration: 10 },
    { key: 'thinking', label: 'Thinking through ideas', duration: 5 },
    { key: 'chatting', label: 'Discussing with teammate', duration: 6 },
    { key: 'resting', label: 'Taking a short break', duration: 6 },
    { key: 'stretching', label: 'Stretching', duration: 3 }
  ];
  const AMBIENT_CYCLE = AMBIENT_BEHAVIORS.reduce((total, item) => total + item.duration, 0);
  function ambientBehaviorAt(index, timeMs) {
    const pairOffset = Math.floor(Math.max(0, index) / 2) * 6.4;
    let phase = ((Number(timeMs || 0) / 1000 + pairOffset) % AMBIENT_CYCLE + AMBIENT_CYCLE) % AMBIENT_CYCLE;
    for (const behavior of AMBIENT_BEHAVIORS) {
      if (phase < behavior.duration) return behavior;
      phase -= behavior.duration;
    }
    return AMBIENT_BEHAVIORS[0];
  }
  function mat(color, roughness = 0.82, metalness = 0) {
    const value = new THREE.Color(color).convertSRGBToLinear();
    return new THREE.MeshStandardMaterial({ color: value, roughness, metalness });
  }
  function addBox(parent, size, color, position, materialOptions = {}) {
    const item = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), mat(color, materialOptions.roughness, materialOptions.metalness));
    item.position.set(position[0], position[1], position[2]); item.castShadow = materialOptions.castShadow !== false; item.receiveShadow = true;
    parent.add(item); return item;
  }
  function addCylinder(parent, radiusTop, radiusBottom, height, color, position, segments = 18) {
    const item = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), mat(color));
    item.position.set(position[0], position[1], position[2]); item.castShadow = true; parent.add(item); return item;
  }
  function addSphere(parent, size, color, position) {
    const item = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), mat(color));
    item.scale.set(size[0], size[1], size[2]); item.position.set(position[0], position[1], position[2]); item.castShadow = true; parent.add(item); return item;
  }
  function addStudioPlant(parent, x, z) {
    addCylinder(parent, 0.32, 0.42, 0.56, 0x9c765f, [x, 0.28, z], 16);
    addCylinder(parent, 0.08, 0.11, 0.9, 0x678064, [x, 0.92, z], 10);
    [[-0.3, 0.88, 0], [0.27, 1.05, 0.08], [0, 1.27, -0.12], [0.18, 0.74, -0.16]].forEach(([dx, y, dz], index) => {
      addSphere(parent, [0.24, 0.4, 0.16], index % 2 ? 0x77926e : 0x8da078, [x + dx, y, z + dz]);
    });
  }
  function addSoftbox(parent, x, z, color, rotation = 0) {
    const stand = new THREE.Group(); stand.position.set(x, 0, z); stand.rotation.y = rotation; parent.add(stand);
    addCylinder(stand, 0.035, 0.045, 2.5, 0x606d69, [0, 1.25, 0], 10);
    for (const [dx, dz] of [[-0.38, 0.22], [0.38, 0.22], [0, -0.38]]) {
      const leg = addCylinder(stand, 0.025, 0.035, 0.86, 0x606d69, [dx * 0.45, 0.08, dz * 0.45], 8);
      leg.rotation.z = dx * 0.55; leg.rotation.x = dz * 0.55;
    }
    const panel = addBox(stand, [1.35, 1.1, 0.16], color, [0, 2.58, 0], { castShadow: false });
    panel.material.emissive = new THREE.Color(color).convertSRGBToLinear(); panel.material.emissiveIntensity = 0.42;
    addBox(stand, [1.07, 0.82, 0.03], 0xfff4d9, [0, 2.58, 0.095], { castShadow: false });
    const lamp = new THREE.PointLight(0xffe8bd, 0.9, 9);
    lamp.position.set(x, 2.45, z); parent.add(lamp);
  }
  function buildScene() {
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe8eee8); scene.fog = new THREE.Fog(0xe8eee8, 28, 60);
    const world = new THREE.Group(); scene.add(world);
    scene.add(new THREE.HemisphereLight(0xfff8e8, 0x718077, 1.5));
    const sun = new THREE.DirectionalLight(0xffedcf, 2.25); sun.position.set(-8, 14, 8); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); scene.add(sun);
    addBox(world, [40, 0.3, 28], 0x829175, [0, -0.3, 0], { castShadow: false });
    addBox(world, [15, 0.42, 10], 0x887864, [0, -0.02, 0]);
    addBox(world, [14.5, 0.16, 9.5], 0xd8c8a9, [0, 0.27, 0], { castShadow: false });
    // Warm acoustic back wall and a partial side wall frame the open production set.
    addBox(world, [14, 4.6, 0.36], 0xd6d0bf, [0, 2.48, -4.72]);
    addBox(world, [0.36, 4.4, 8.7], 0xbecbbc, [7.0, 2.38, -0.4]);
    addBox(world, [14.1, 0.19, 0.42], 0x73816f, [0, 4.7, -4.72], { castShadow: false });
    // Acoustic felt panels, shelf and framed color cards.
    for (let i = 0; i < 7; i += 1) addBox(world, [0.92, 2.0, 0.08], i % 2 ? 0xa4ae9c : 0xb5b29f, [-5.7 + i * 1.75, 2.4, -4.48], { castShadow: false });
    addBox(world, [2.5, 0.13, 0.55], 0x8e7057, [4.85, 2.28, -4.24]);
    for (let i = 0; i < 3; i += 1) addBox(world, [0.38, 0.62 + (i % 2) * 0.2, 0.24], [0x73836e, 0xb47e62, 0xd3b772][i], [4.0 + i * 0.75, 2.67 + (i % 2) * 0.1, -4.2], { castShadow: false });
    // Main work desk, display and a small recording control surface.
    addBox(world, [5.2, 0.2, 2.15], 0x9c7657, [-0.5, 1.55, -0.3]);
    addBox(world, [5.35, 0.12, 2.3], 0xd0aa7b, [-0.5, 1.68, -0.3], { castShadow: false });
    for (const x of [-2.75, 1.75]) for (const z of [-1.0, 0.35]) addBox(world, [0.16, 1.45, 0.16], 0x596b65, [x, 0.8, z]);
    addBox(world, [2.25, 1.28, 0.12], 0x313a3d, [-0.5, 2.43, -1.02], { metalness: 0.16 });
    addBox(world, [2.05, 1.08, 0.025], 0x71928c, [-0.5, 2.45, -0.94], { castShadow: false });
    addBox(world, [1.12, 0.06, 0.62], 0x3e4b49, [-0.5, 1.78, -0.76], { castShadow: false });
    addBox(world, [1.2, 0.08, 0.42], 0x5d645e, [1.15, 1.8, -0.2], { castShadow: false });
    for (let i = 0; i < 5; i += 1) addBox(world, [0.12, 0.025, 0.24], i === 0 ? 0xd6a966 : 0x78847b, [0.76 + i * 0.19, 1.86, -0.2], { castShadow: false });
    // Desk microphone and shock mount.
    addCylinder(world, 0.055, 0.075, 0.8, 0x596967, [1.95, 2.05, 0.12], 12);
    addCylinder(world, 0.19, 0.14, 0.64, 0x343d3d, [1.95, 2.65, 0.12], 16);
    addBox(world, [0.28, 0.055, 0.28], 0x65736e, [1.95, 1.86, 0.12], { castShadow: false });
    // Camera on tripod, angled toward the desk, with a visible lens barrel.
    const cameraRig = new THREE.Group(); cameraRig.position.set(-4.0, 0, 1.2); cameraRig.rotation.y = -0.52; world.add(cameraRig);
    addBox(cameraRig, [1.0, 0.65, 0.58], 0x394443, [0, 2.15, 0]);
    addCylinder(cameraRig, 0.26, 0.32, 0.42, 0x202b2d, [0, 2.15, 0.49], 20);
    addCylinder(cameraRig, 0.16, 0.19, 0.09, 0x839f98, [0, 2.15, 0.73], 20);
    addCylinder(cameraRig, 0.045, 0.065, 1.65, 0x52635e, [0, 0.9, 0], 10);
    for (const [x, z] of [[-0.58, 0.45], [0.58, 0.45], [0, -0.62]]) {
      const leg = addCylinder(cameraRig, 0.025, 0.04, 1.15, 0x52635e, [x * 0.47, 0.31, z * 0.47], 8);
      leg.rotation.z = x * 0.56; leg.rotation.x = z * 0.5;
    }
    // Two softboxes, a director's chair and plants complete the practical studio set.
    addSoftbox(world, 4.15, 1.4, 0xc9d6cc, -0.38);
    addSoftbox(world, -4.8, -2.55, 0xe0d5bd, 0.42);
    addBox(world, [0.95, 0.9, 0.14], 0x60756b, [3.15, 1.35, -2.7]);
    addBox(world, [0.98, 0.12, 0.15], 0x8d694f, [3.15, 0.83, -2.7]);
    addCylinder(world, 0.07, 0.09, 0.8, 0x566860, [3.15, 0.42, -2.7], 12);
    addStudioPlant(world, -5.85, -2.55); addStudioPlant(world, 5.85, 2.3);
    // Soft practical light and cable-free accent strip along the set edge.
    addBox(world, [12.8, 0.035, 0.07], 0xe5c47f, [0, 0.47, 4.45], { castShadow: false });
    const strip = world.children[world.children.length - 1]; strip.material.emissive = new THREE.Color(0xe5c47f).convertSRGBToLinear(); strip.material.emissiveIntensity = 0.55;
    state.actorsGroup = new THREE.Group(); state.actorsGroup.name = 'KRA creator crew'; scene.add(state.actorsGroup);
    return scene;
  }
  function makeAgentBadge(name, activity) {
    const canvas = root.document.createElement('canvas'); canvas.width = 512; canvas.height = 144;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save();
    ctx.shadowColor = 'rgba(32, 49, 38, .18)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 5;
    ctx.fillStyle = 'rgba(255, 255, 252, .96)'; ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(12, 12, 488, 118, 40); else ctx.rect(12, 12, 488, 118);
    ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(73, 112, 82, .22)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#294332'; ctx.font = '700 35px system-ui, sans-serif';
    ctx.fillText(String(name || 'Studio agent').slice(0, 22), 256, 51, 440);
    ctx.fillStyle = '#68816c'; ctx.font = '600 27px system-ui, sans-serif';
    ctx.fillText(String(activity || 'Studio work').slice(0, 28), 256, 94, 440);
    const texture = new THREE.CanvasTexture(canvas); texture.encoding = THREE.sRGBEncoding;
    texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.needsUpdate = true;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false }));
    sprite.scale.set(1.55, 0.44, 1); return sprite;
  }
  function addAgentWorkstation(parent, accent, index) {
    const station = new THREE.Group(); station.name = 'Creator workstation ' + index; parent.add(station);
    // Compact desk faces the avatar; the separate chair makes the sitting pose legible.
    addBox(station, [1.45, 0.12, 0.78], 0x997553, [0, 1.0, 0.83]);
    for (const x of [-0.58, 0.58]) for (const z of [0.55, 1.1]) addBox(station, [0.08, 0.92, 0.08], 0x5b6961, [x, 0.5, z]);
    addBox(station, [0.54, 0.045, 0.36], 0x374340, [0, 1.09, 0.93], { castShadow: false });
    const screen = addBox(station, [0.54, 0.37, 0.045], 0x33494a, [0, 1.3, 0.75], { castShadow: false });
    screen.material.emissive = new THREE.Color(accent).convertSRGBToLinear(); screen.material.emissiveIntensity = 0.24;
    addBox(station, [0.38, 0.018, 0.13], 0x80988b, [0, 1.12, 0.58], { castShadow: false });
    // Chair sits behind the agent, away from the desk; its cushion is visible when the agent stands.
    addBox(station, [0.66, 0.13, 0.62], 0x5f7467, [0, 0.62, -0.44]);
    addBox(station, [0.68, 0.76, 0.12], 0x52675d, [0, 1.02, -0.72]);
    addCylinder(station, 0.07, 0.08, 0.5, 0x59665f, [0, 0.32, -0.44], 12);
    for (const x of [-0.22, 0.22]) addCylinder(station, 0.035, 0.045, 0.38, 0x59665f, [x, 0.12, -0.44], 8);
    const mug = addCylinder(station, 0.09, 0.1, 0.18, 0xe2c58b, [0.52, 1.15, 0.91], 12);
    mug.name = 'Creator break mug';
    return { screen, mug };
  }
  function makeAmbientBadge() {
    const canvas = root.document.createElement('canvas'); canvas.width = 384; canvas.height = 92;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas); texture.encoding = THREE.sRGBEncoding;
    texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false }));
    sprite.scale.set(1.2, 0.29, 1); sprite.position.set(0, 3.03, 0); sprite.userData.ambientCanvas = { canvas, ctx, texture, key: '' };
    return sprite;
  }
  function updateAmbientBadge(sprite, behavior) {
    const data = sprite.userData.ambientCanvas;
    if (!data || data.key === behavior.key) return;
    const labels = { computer: '⌨  AT COMPUTER', thinking: '✦  THINKING', chatting: '•••  DISCUSSING', resting: '☕  SHORT BREAK', stretching: '↗  STRETCHING' };
    const colors = { computer: '#e4f5ea', thinking: '#fff3d2', chatting: '#e6efff', resting: '#f8eadb', stretching: '#f2e8ff' };
    const { ctx, canvas } = data;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.fillStyle = colors[behavior.key] || '#f4f3ec'; ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(5, 5, canvas.width - 10, canvas.height - 10, 36); else ctx.rect(5, 5, canvas.width - 10, canvas.height - 10);
    ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(55, 82, 65, .2)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#294332'; ctx.font = '700 30px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(labels[behavior.key] || behavior.label.toUpperCase(), canvas.width / 2, canvas.height / 2, canvas.width - 24);
    data.key = behavior.key; data.texture.needsUpdate = true;
  }
  function createStudioAgent(agent, index) {
    const group = new THREE.Group(); group.name = 'KRA creator agent ' + String(agent.id || index);
    const stations = [[-4.55, 1.7], [-2.8, 2.45], [-0.9, 2.65], [1.1, 2.55], [3.2, 1.8], [4.65, 0.15], [-4.2, -1.8], [0.1, 3.55], [3.8, -2.4], [-1.8, -2.75], [1.9, -3.15], [5.0, 2.5]];
    const [x, z] = stations[index % stations.length];
    group.position.set(x, 0.35, z); state.actorsGroup.add(group);
    const validColor = value => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? Number.parseInt(value.slice(1), 16) : 0x74a184;
    const accent = validColor(agent.accent || agent.palette?.accent || agent.palette?.primary);
    const primary = validColor(agent.palette?.primary || agent.accent);
    const skin = agent.appearance?.body === 'broad_deep' ? 0xb47e60 : agent.appearance?.body === 'android_synth' ? 0xa9b9b2 : 0xd8aa88;
    const hair = agent.appearance?.hair === 'hijab_emerald' ? 0x2d7359 : 0x49362d;
    const marker = new THREE.Mesh(new THREE.CircleGeometry(0.54, 36), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.22, depthWrite: false }));
    marker.rotation.x = -Math.PI / 2; marker.position.y = 0.025; group.add(marker);
    const legs = [];
    for (const side of [-1, 1]) {
      const leg = addSphere(group, [0.15, 0.38, 0.17], 0x526057, [side * 0.15, 0.44, 0]);
      legs.push({ mesh: leg, side });
    }
    const torso = addSphere(group, [0.39, 0.55, 0.29], primary, [0, 1.05, 0]);
    addSphere(group, [0.13, 0.2, 0.13], skin, [0, 1.52, 0]);
    const head = new THREE.Group(); head.position.set(0, 1.84, 0.02); group.add(head);
    const face = addSphere(head, [0.32, 0.37, 0.3], skin, [0, 0, 0]);
    if (agent.appearance?.hair === 'hijab_emerald') {
      addSphere(head, [0.36, 0.43, 0.32], hair, [0, 0.02, -0.075]);
      addSphere(head, [0.34, 0.23, 0.2], hair, [0, -0.2, 0.09]);
      face.position.z = 0.075;
    } else {
      addSphere(head, [0.34, 0.18, 0.33], hair, [0, 0.18, -0.045]);
      for (const side of [-1, 1]) addSphere(head, [0.1, 0.24, 0.15], hair, [side * 0.25, -0.01, -0.025]);
    }
    addSphere(head, [0.035, 0.045, 0.018], 0x344137, [-0.105, 0.03, 0.27]);
    addSphere(head, [0.035, 0.045, 0.018], 0x344137, [0.105, 0.03, 0.27]);
    const arms = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(side * 0.35, 1.34, 0.01); group.add(pivot);
      const arm = addSphere(pivot, [0.14, 0.43, 0.15], primary, [side * 0.07, -0.19, 0]);
      const hand = addSphere(pivot, [0.11, 0.11, 0.11], skin, [side * 0.1, -0.4, 0.02]);
      arms.push({ pivot, arm, hand, side });
    }
    const workstation = addAgentWorkstation(group, accent, index);
    const activity = String(agent.activity || 'research');
    const badge = makeAgentBadge(agent.name, agent.activityLabel || activity);
    const ambientBadge = makeAmbientBadge();
    badge.position.set(0, 2.55, 0); group.add(badge); group.add(ambientBadge);
    return { group, torso, head, arms, legs, badge, ambientBadge, workstation, activity, index, currentBehavior: '' };
  }
  function clearCreatorActors() {
    if (!state.actorsGroup) return;
    state.actorsGroup.traverse(object => {
      if (object.geometry) object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      materials.forEach(value => { if (value.map) value.map.dispose(); value.dispose(); });
    });
    while (state.actorsGroup.children.length) state.actorsGroup.remove(state.actorsGroup.children[0]);
    state.actors = [];
  }
  function setAgents(agents) {
    state.agents = Array.isArray(agents) ? agents.slice(0, 12) : [];
    if (!state.scene && !init()) return false;
    clearCreatorActors();
    state.actors = state.agents.map(createStudioAgent);
    resize(); return true;
  }
  function updateAgentAnimation(time) {
    state.actors.forEach(actor => {
      const t = time * 0.001 + actor.index * 0.43;
      const behavior = ambientBehaviorAt(actor.index, time);
      const blendTarget = behavior.key === 'stretching' ? 0 : 1;
      actor.seatBlend = (actor.seatBlend ?? 1) + (blendTarget - (actor.seatBlend ?? 1)) * 0.09;
      const seated = actor.seatBlend;
      actor.currentBehavior = behavior.key;
      actor.group.position.y = 0.35 + Math.sin(t * 2.1) * (behavior.key === 'resting' ? 0.009 : 0.018);
      actor.group.rotation.y = behavior.key === 'chatting' ? (actor.index % 2 === 0 ? 0.48 : -0.48) : 0;
      actor.torso.position.y = 1.05 - 0.13 * seated;
      actor.torso.rotation.z = behavior.key === 'resting' ? 0.12 + Math.sin(t * 0.65) * 0.025
        : behavior.key === 'thinking' ? -0.035 : Math.sin(t * 1.3) * 0.018;
      actor.torso.rotation.x = behavior.key === 'computer' ? -0.08 : behavior.key === 'resting' ? 0.08 : 0;
      actor.head.rotation.y = behavior.key === 'chatting' ? (actor.index % 2 === 0 ? -0.34 : 0.34) : Math.sin(t * 0.8) * 0.07;
      actor.head.rotation.x = behavior.key === 'thinking' ? -0.14 : behavior.key === 'resting' ? 0.12 : 0;
      actor.head.position.y = 1.84 - 0.1 * seated;
      actor.legs.forEach(({ mesh, side }) => {
        mesh.position.set(side * 0.15, 0.44 + 0.06 * seated, 0.22 * seated);
        mesh.rotation.x = 1.15 * seated;
        mesh.rotation.z = behavior.key === 'resting' ? side * 0.04 : 0;
      });
      actor.arms.forEach(({ pivot, side }, armIndex) => {
        pivot.position.y = 1.34 - 0.11 * seated;
        const motion = Math.sin(t * 8 + armIndex * Math.PI) * 0.12;
        if (behavior.key === 'computer') {
          // Lean into the laptop and type with alternating hands.
          pivot.rotation.x = -0.95 + motion;
          pivot.rotation.z = side * (0.08 + motion * 0.18);
        } else if (behavior.key === 'thinking') {
          const thinkingHand = actor.index % 2 === 0 ? -1 : 1;
          pivot.rotation.x = side === thinkingHand ? -0.18 : -0.12;
          pivot.rotation.z = side === thinkingHand ? (side < 0 ? 2.18 : -2.18) : side * 0.08;
        } else if (behavior.key === 'chatting') {
          const gesture = Math.sin(t * 3.5 + armIndex) * 0.22;
          pivot.rotation.x = -0.48 + gesture * 0.25;
          pivot.rotation.z = side * (0.45 + gesture);
        } else if (behavior.key === 'stretching') {
          pivot.rotation.x = 0;
          pivot.rotation.z = side < 0 ? 2.72 : -2.72;
        } else {
          // Relaxed shoulders, a small breathing motion, and a lowered gaze during a break.
          pivot.rotation.x = 0.16 + Math.sin(t * 1.2 + armIndex) * 0.025;
          pivot.rotation.z = side * 0.08;
        }
      });
      actor.workstation.screen.material.emissiveIntensity = behavior.key === 'computer' ? 0.42 + (Math.sin(t * 2.8) + 1) * 0.12 : 0.16;
      updateAmbientBadge(actor.ambientBadge, behavior);
    });
  }
  function animate(time) {
    if (!state.renderer || !state.canvas) return;
    const rect = state.canvas.getBoundingClientRect();
    if (!root.document.hidden && rect.width > 2 && rect.height > 2) {
      updateAgentAnimation(time || 0);
      state.renderer.render(state.scene, state.camera);
    }
    if (root.requestAnimationFrame) root.requestAnimationFrame(animate);
  }
  function updateCamera() {
    if (!state.camera || !state.target) return;
    const sinPhi = Math.sin(state.phi);
    state.camera.position.set(state.target.x + state.radius * sinPhi * Math.sin(state.theta), state.target.y + state.radius * Math.cos(state.phi), state.target.z + state.radius * sinPhi * Math.cos(state.theta));
    state.camera.lookAt(state.target); state.camera.updateMatrixWorld();
  }
  function resize() {
    const canvas = state.canvas;
    if (!state.renderer || !canvas) return false;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    state.renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 1.5));
    state.renderer.setSize(rect.width, rect.height, false);
    state.camera.aspect = rect.width / rect.height; state.camera.updateProjectionMatrix();
    updateCamera(); state.renderer.render(state.scene, state.camera); return true;
  }
  function init() {
    if (state.renderer || state.failed || !THREE) return !!state.renderer;
    state.canvas = root.document.getElementById('creator-studio-3d');
    if (!state.canvas) return false;
    try {
      state.renderer = new THREE.WebGLRenderer({ canvas: state.canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
      state.renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 1.5));
      state.renderer.shadowMap.enabled = true; state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      state.renderer.outputEncoding = THREE.sRGBEncoding; state.renderer.toneMapping = THREE.ACESFilmicToneMapping; state.renderer.toneMappingExposure = 1.05;
      state.scene = buildScene(); state.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
      state.target = new THREE.Vector3(0, 1.1, -0.1); updateCamera();
      state.canvas.addEventListener('pointerdown', event => { state.drag = { x: event.clientX, y: event.clientY, theta: state.theta, phi: state.phi, id: event.pointerId }; state.canvas.setPointerCapture?.(event.pointerId); });
      state.canvas.addEventListener('pointermove', event => {
        if (!state.drag || state.drag.id !== event.pointerId) return;
        state.theta = state.drag.theta - (event.clientX - state.drag.x) * 0.006;
        state.phi = Math.max(0.28, Math.min(1.42, state.drag.phi + (event.clientY - state.drag.y) * 0.004)); updateCamera(); state.renderer.render(state.scene, state.camera);
      });
      const release = () => { state.drag = null; };
      state.canvas.addEventListener('pointerup', release); state.canvas.addEventListener('pointercancel', release);
      state.canvas.addEventListener('wheel', event => { event.preventDefault(); state.radius = Math.max(11, Math.min(27, state.radius * Math.exp(event.deltaY * 0.001))); resize(); }, { passive: false });
      if (root.ResizeObserver) { state.observer = new root.ResizeObserver(resize); state.observer.observe(state.canvas); }
      resize();
      if (root.requestAnimationFrame) root.requestAnimationFrame(animate);
      return true;
    } catch (error) {
      state.failed = true; console.error('KRA creator 3D scene could not initialize:', error); return false;
    }
  }
  const api = { init, resize, setAgents, getBehaviorAt: ambientBehaviorAt, getState: () => state };
  root.KRACreatorSceneRenderer = api;
  if (root.document && root.document.readyState !== 'loading') init();
  else if (root.document) root.document.addEventListener('DOMContentLoaded', init, { once: true });
})(typeof window !== 'undefined' ? window : globalThis);
