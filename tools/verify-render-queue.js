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
      const originalDrawCharacter = drawCharacter;
      const originalDrawSprite = drawSprite;
      const draws = [];
      drawCharacter = (agent, x, y) => draws.push({ kind: 'agent', id: agent.id, anchor: y * T + 32 });
      drawSprite = (x, y, item) => draws.push({ kind: 'atlas', item, anchor: y * T + T });

      const agent = AGENTS.find(item => (item.floorId || 1) === activeFloor && !item.inTransit);
      if (!agent) throw new Error('No visible agent on the active floor.');
      const agentX = agent.x;
      const agentY = agent.y;
      const agentState = agent.state;
      const agentTarget = agent.pathTarget;
      const selected = selectedAgent;
      const floor = activeFloor;
      const decorItems = customDecor[activeFloor];
      const key = '4,4';
      const oldDecor = decorItems.get(key);
      decorItems.set(key, 'atlas_server');
      agent.x = 4;
      agent.y = 4;
      selectedAgent = agent;
      drawAtlasDecorAndAgents(0);

      agent.x = agentX;
      agent.y = agentY;
      agent.state = agentState;
      agent.pathTarget = agentTarget;
      selectedAgent = selected;
      if (oldDecor === undefined) decorItems.delete(key); else decorItems.set(key, oldDecor);
      drawCharacter = originalDrawCharacter;
      drawSprite = originalDrawSprite;

      const relevant = draws.filter(item => item.id === agent.id || item.item === 'atlas_server');
      return {
        relevant,
        sorted: relevant.every((item, index) => index === 0 || relevant[index - 1].anchor <= item.anchor),
        agentDepthAnchor: 4 * T + 32,
        propPivotAnchor: 4 * T + T
      };
    })()`);
    const expected = result.relevant.length === 2
      && result.relevant[0].kind === 'agent'
      && result.relevant[1].kind === 'atlas';
    const passed = result.sorted && expected;
    console.log(JSON.stringify(result));
    if (!passed) process.exitCode = 1;
  } catch (error) {
    console.error('[FAIL] Render queue depth test:', error.message);
    process.exitCode = 1;
  } finally {
    app.quit();
  }
});
