const { app, BrowserWindow } = require('electron');

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  // Use user's typical window size or 1280x720 / 1266x657
  const win = new BrowserWindow({ width: 1266, height: 657, show: false });
  try {
    await win.loadURL('http://127.0.0.1/kantor-rama-ai/web/index.html');
    await new Promise(r => setTimeout(r, 1500));
    const info = await win.webContents.executeJavaScript(`(() => {
      const sidebar = document.querySelector('.command-sidebar');
      const stage = document.querySelector('.kra-main-stage');
      const input = document.querySelector('.command-input-container');
      const term = document.querySelector('.kra-terminal-wrapper');
      const actions = document.querySelector('.quick-actions-bar');
      const tabs = document.querySelector('.chat-tabs');
      const boss = document.querySelector('.boss-briefing-box');
      const header = sidebar.querySelector('.panel-header');
      const ctxBar = sidebar.querySelector('.chat-context-bar');
      const sendBtn = document.getElementById('btn-send-cmd');
      const cmdInput = document.getElementById('command-input');
      
      const sRect = sidebar.getBoundingClientRect();
      const iRect = input.getBoundingClientRect();
      
      return {
        windowH: window.innerHeight,
        stageH: stage.getBoundingClientRect().height,
        sidebarH: sRect.height,
        sidebarScrollH: sidebar.scrollHeight,
        overflowY: sidebar.scrollHeight - sRect.height,
        headerH: header ? header.getBoundingClientRect().height : 0,
        bossH: boss.getBoundingClientRect().height,
        tabsH: tabs.getBoundingClientRect().height,
        ctxBarH: ctxBar.getBoundingClientRect().height,
        termH: term.getBoundingClientRect().height,
        actionsH: actions.getBoundingClientRect().height,
        inputH: iRect.height,
        inputBottom: iRect.bottom,
        sidebarBottom: sRect.bottom,
        inputVisible: iRect.bottom <= sRect.bottom,
        sendBtnRect: sendBtn.getBoundingClientRect()
      };
    })()`);
    console.log(JSON.stringify(info, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    win.destroy();
    app.quit();
  }
});
