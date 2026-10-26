const { app, BrowserWindow } = require('electron');

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  try {
    await win.loadURL('http://127.0.0.1/kantor-rama-ai/web/index.html');
    await win.webContents.executeJavaScript(`new Promise(resolve => {
      const check = () => window.KRA_APP_READY ? resolve() : setTimeout(check, 25);
      check();
    })`);
    const result = await win.webContents.executeJavaScript(`(() => {
      const agent = AGENTS.find(item => item.id === 'rama');
      const saved = { x: agent.x, y: agent.y, floor: activeFloor, agentFloor: agent.floorId, state: agent.state, inTransit: agent.inTransit };
      const custom = customDecor[activeFloor];
      const keys = ['4,10'];
      const prior = keys.map(key => custom.get(key));
      agent.x = 2.5;
      agent.y = 10.5;
      agent.floorId = activeFloor;
      agent.state = 'idle';
      agent.inTransit = false;
      const start = { x: agent.x, y: agent.y };
      const target = { x: 8.5, y: 10.5 };
      const before = findWalkPath(agent, target.x, target.y);
      const ready = officeAtlas.ready;
      const atlasMetadata = officeAtlas.metadata;
      const atlases = { diffuse: officeAtlas.diffuse, emission: officeAtlas.emission };
      if (!officeAtlas.ready) officeAtlas.ready = true;
      if (!officeAtlas.metadata) officeAtlas.metadata = { sprites: { server_rack_jarvis: { grid_occupancy: { cols: 2, rows: 1 } } } };
      custom.set(keys[0], 'atlas_server');
      invalidateAtlasWalkBlockers(activeFloor);
      const after = findWalkPath(agent, target.x, target.y);
      const avoidsFootprint = after.length > 0 && after.every(point => {
        const tileX = Math.floor(point.x);
        const tileY = Math.floor(point.y);
        return !(tileY === 10 && (tileX === 4 || tileX === 5));
      });
      const occupancyCellA = atlasOccupancyAt(activeFloor, 4, 10);
      const occupancyCellB = atlasOccupancyAt(activeFloor, 5, 10);
      const footprintBlocked = occupancyCellA && occupancyCellB;
      keys.forEach((key, index) => {
        if (prior[index] === undefined) custom.delete(key);
        else custom.set(key, prior[index]);
      });
      invalidateAtlasWalkBlockers(activeFloor);
      officeAtlas.ready = ready;
      officeAtlas.metadata = atlasMetadata;
      officeAtlas.diffuse = atlases.diffuse;
      officeAtlas.emission = atlases.emission;
      agent.x = saved.x;
      agent.y = saved.y;
      agent.floorId = saved.agentFloor;
      agent.state = saved.state;
      agent.inTransit = saved.inTransit;
      return { start, target, baselinePathLength: before.length, obstaclePath: after, occupancyCellA, occupancyCellB, footprintBlocked, avoidsFootprint };
    })()`);
    const passed = result.baselinePathLength > 0 && result.footprintBlocked && result.avoidsFootprint;
    console.log(JSON.stringify(result));
    if (!passed) process.exitCode = 1;
  } catch (error) {
    console.error('[FAIL] Atlas pathfinding test:', error.message);
    process.exitCode = 1;
  } finally {
    app.quit();
  }
});
