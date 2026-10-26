const { app, BrowserWindow } = require('electron');
const path = require('path');

const processStartedAt = process.hrtime.bigint();
const nowMs = () => Number(process.hrtime.bigint()) / 1e6;

app.whenReady().then(async () => {
  const appReadyMs = Number(process.hrtime.bigint() - processStartedAt) / 1e6;
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: true,
    backgroundColor: '#F0EAD2',
    webPreferences: { offscreen: false, backgroundThrottling: false }
  });
  const createdAt = nowMs();
  try {
    await win.loadURL('http://127.0.0.1/kantor-rama-ai/web/index.html');
    const navigationToLoadMs = nowMs() - createdAt;
    const profile = await win.webContents.executeJavaScript(`(async () => {
      const navigationToLoadMs = ${navigationToLoadMs};
      const atlasWaitStart = performance.now();
      while ((!window.KRA_APP_READY || !officeAtlas.ready || !window.KRA_APP_ATLAS_READY_AT) && performance.now() - atlasWaitStart < 10000) {
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      if (!window.KRA_APP_READY || !officeAtlas.ready) throw new Error('Application or atlas initialization timed out.');
      const appReadyMs = window.KRA_APP_READY_AT - window.KRA_APP_BOOT_STARTED;
      const atlasReadyMs = window.KRA_APP_ATLAS_READY_AT - window.KRA_APP_BOOT_STARTED;
      // performance.now() is relative to the page navigation start; timestamps are
      // recorded in the renderer and avoid adding loadURL's overlapping duration.
      const navigationToUiReadyMs = window.KRA_APP_READY_AT;
      const navigationToAtlasReadyMs = window.KRA_APP_ATLAS_READY_AT;
      await new Promise(resolve => setTimeout(resolve, 1200));
      const cacheStart = performance.now();
      const spriteNames = Object.keys(officeAtlas.metadata?.sprites || {});
      const usedFrames = [...new Set(Object.values({
        atlas_server: 'server_rack_jarvis', atlas_desk: 'executive_desk_rama',
        atlas_arcade: 'arcade_machine_dimas', atlas_planter: 'neon_planter'
      }))];
      usedFrames.forEach(name => getCachedAtlasFrame(name));
      const atlasWarmupMs = performance.now() - cacheStart;

      window.KRA_PROFILE = { renderFrameMs: 0, frameCount: 0 };
      const waitFrames = async count => {
        for (let index = 0; index < count; index += 1) {
          await new Promise(resolve => requestAnimationFrame(resolve));
        }
      };
      await waitFrames(30);

      const runs = [];
      for (let run = 0; run < 3; run += 1) {
        let elapsedTotal = 0;
        let slowFrameCount = 0;
        let maxFrameMs = 0;
        let previous = performance.now();
        let sample = [];
        let renderSamples = [];
        let nextReportAt = previous + 1000;
        const stopAt = previous + 3000;
        while (previous < stopAt) {
          await new Promise(resolve => requestAnimationFrame(resolve));
          const current = performance.now();
          const delta = current - previous;
          previous = current;
          elapsedTotal += delta;
          if (delta > 16.7) slowFrameCount += 1;
          if (delta > maxFrameMs) maxFrameMs = delta;
          sample.push(delta);
          renderSamples.push(window.KRA_PROFILE.renderFrameMs);
          if (current >= nextReportAt) {
            sample.sort((a, b) => a - b);
            const p95 = sample[Math.min(sample.length - 1, Math.floor(sample.length * 0.95))] || 0;
            renderSamples.sort((a, b) => a - b);
            const renderP95 = renderSamples[Math.min(renderSamples.length - 1, Math.floor(renderSamples.length * 0.95))] || 0;
            runs.push({
              segment: run + 1,
              frameCount: sample.length,
              averageFps: sample.length * 1000 / sample.reduce((sum, value) => sum + value, 0),
              p95FrameMs: p95,
              rendererWorkP95Ms: renderP95,
              maxFrameMs,
              framesOver16_7ms: slowFrameCount
            });
            sample = [];
            renderSamples = [];
            maxFrameMs = 0;
            slowFrameCount = 0;
            nextReportAt += 1000;
          }
        }
      }
      return {
        readyState: document.readyState,
        navigationToLoadMs,
        appReadyMs,
        atlasReadyMs,
        navigationToUiReadyMs,
        navigationToAtlasReadyMs,
        atlasReady: officeAtlas.ready,
        atlasSpriteCount: spriteNames.length,
        atlasCacheEntries: officeAtlas.cache.size,
        atlasWarmupMs,
        canvas: {
          width: document.getElementById('office-canvas').width,
          height: document.getElementById('office-canvas').height
        },
        rendererJsHeapMB: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null,
        runs
      };
    })()`);

    const appMetrics = app.getAppMetrics().map(({ type, memory }) => ({
      type,
      workingSetMB: memory.workingSetSize / 1024,
      privateMB: memory.privateBytes / 1024,
      peakWorkingSetMB: memory.peakWorkingSetSize / 1024
    }));
    const totalWorkingSetMB = appMetrics.reduce((sum, process) => sum + process.workingSetMB, 0);
    console.log(JSON.stringify({
      measurement: 'unpackaged Electron; native Canvas 2D; atlas cache warmed; 3x3s RAF runs',
      windowVisible: win.isVisible(),
      offscreen: win.webContents.getType() === 'offscreen',
      appReadyMainProcessMs: appReadyMs,
      navigationToLoadMs: profile.navigationToLoadMs,
      uiReadyFromBootMs: profile.appReadyMs,
      atlasReadyFromBootMs: profile.atlasReadyMs,
      navigationToUiReadyMs: profile.navigationToUiReadyMs,
      navigationToAtlasReadyMs: profile.navigationToAtlasReadyMs,
      profile,
      totalElectronWorkingSetMB: totalWorkingSetMB,
      appMetrics
    }, null, 2));
  } catch (error) {
    console.error('[FAIL] Electron profile:', error.message);
    process.exitCode = 1;
  } finally {
    win.destroy();
    app.quit();
  }
});
