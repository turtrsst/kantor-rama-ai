const { app, BrowserWindow } = require('electron');

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true }
  });

  try {
    await win.loadURL('http://127.0.0.1/kantor-rama-ai/web/index.html');
    await win.webContents.executeJavaScript(`new Promise(resolve => {
      const check = () => window.KRA_APP_READY ? resolve() : setTimeout(check, 25);
      check();
    })`);

    const result = await win.webContents.executeJavaScript(`(async () => {
      const agent = AGENTS.find(item => item.id === 'creator');
      if (!agent) throw new Error('Creator agent was not initialized.');
      agent.floorId = 1;
      agent.x = agent.homeX;
      agent.y = agent.homeY;
      agent.inTransit = false;
      agent.state = 'idle';
      if (activeFloor !== 1) loadFloor(1);
      const originFloor = 1;
      const destinationFloor = 2;
      const started = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Transit completion timed out.')), 20000);
        transitAgentToFloor(agent, destinationFloor, () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      const enteredTransit = await new Promise(resolve => {
        const check = () => {
          if (agent.inTransit) return resolve(true);
          if ((agent.floorId || 1) !== originFloor) return resolve(false);
          setTimeout(check, 50);
        };
        check();
      });
      const stateDuringTransit = agent.state;
      await started;
      return {
        originFloor,
        destinationFloor,
        enteredTransit,
        stateDuringTransit,
        finalFloor: agent.floorId,
        inTransitAfterArrival: agent.inTransit,
        finalState: agent.state,
        atDestinationLift: Math.abs(agent.x - ELEVATOR_WAYPOINTS[destinationFloor].x) < 0.01
          && Math.abs(agent.y - ELEVATOR_WAYPOINTS[destinationFloor].y) < 0.01
      };
    })()`);

    const passed = result.enteredTransit
      && result.stateDuringTransit === 'in_transit'
      && result.finalFloor === result.destinationFloor
      && result.inTransitAfterArrival === false
      && result.atDestinationLift;
    console.log(JSON.stringify(result));
    if (!passed) process.exitCode = 1;
  } catch (error) {
    console.error('[FAIL] Elevator UI transit:', error.message);
    process.exitCode = 1;
  } finally {
    app.quit();
  }
});
