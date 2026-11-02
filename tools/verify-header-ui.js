'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const app = read('web/app.js');
const mainHtml = read('web/index.html');
const refreshCss = read('web/ui_refresh.css');
const manualHtml = read('web/manual.html');
const manualCss = read('web/manual_refresh.css');
const desktop = read('desktop/main.js');
const launcher = read('Start KRA.bat');

assert.equal((app.match(/\.hud-drop-btn/g) || []).length > 0, true, 'Shared header menu controller is present.');
assert(app.includes("const hudDropdowns = document.querySelectorAll('.hud-dropdown')"), 'Both header dropdowns use the common menu controller.');
assert(!app.includes("settingsMenuButton?.addEventListener('click'"), 'Settings has no second toggle handler that closes the menu immediately.');
assert(app.includes("const settingsMenu = document.getElementById('settings-menu')"), 'YouTube settings can still close the shared Settings menu.');
assert(mainHtml.includes('ui_refresh.css?v=20261031-creator-split-1'), 'Updated menu/profile/mode styles use a fresh cache key.');
const polishCss = read('web/ui_polish.css');
assert(mainHtml.includes('ui_polish.css?v=20261102-header-grid-2') && mainHtml.indexOf('ui_polish.css') > mainHtml.indexOf('commercial_workspace.css'), 'UI polish layer loads last so header/terminal fixes win the cascade.');
assert(mainHtml.includes('hud-dropdown titlebar-settings') && mainHtml.includes('hud-dropdown titlebar-profile'), 'Settings and profile have stable header-grid area hooks.');
assert(
  polishCss.includes('.kra-titlebar')
  && polishCss.includes('display: grid')
  && polishCss.includes('flex: 0 0 auto')
  && polishCss.includes('min-height: max-content')
  && polishCss.includes('grid-template-areas: "status mode tenant settings profile"')
  && polishCss.includes('grid-template-columns: minmax(0, 1fr) auto auto')
  && polishCss.includes('@media (max-width: 1320px)'),
  'Header uses explicit non-shrinking grid rows so controls cannot spill underneath the main stage.'
);
assert(!polishCss.includes('.titlebar-right { flex: 1 1 100%') && !polishCss.includes('.kra-workspace-switcher select {\n  flex: 1 1 auto;\n  min-width: 180px'), 'Old flex-wrap header overflow rules are gone.');
assert(polishCss.includes('"desc desc"') && polishCss.includes('display: contents'), 'Studio Terminal description spans the full panel width instead of a squeezed column.');
assert(refreshCss.includes('#app-root .app-mode-btn.active') && refreshCss.includes('border-radius: 999px'), 'Mode switch has rounded active-pill styling.');
assert(refreshCss.includes('#app-root .profile-avatar-grid .char-avatar') && refreshCss.includes('background-image: none !important'), 'Profile presets no longer render legacy sprite backgrounds.');
assert(manualHtml.includes('manual_refresh.css?v=20261030-manual-modern-1') && !manualHtml.includes('font-size: 20px'), 'Manual uses the polished external stylesheet instead of pixel typography.');
assert(manualCss.includes('.manual-doc h1') && manualCss.includes('font: 14px/1.75 var(--font-ui)'), 'Manual content is styled for readable product documentation.');
assert(launcher.includes('C:\\php84\\php.exe') && launcher.includes('PHP_VERSION_ID < 80400'), 'Windows launcher targets and validates PHP 8.4.');
assert(desktop.includes("'C:\\\\php84\\\\php.exe'") && desktop.includes('KRA_PHP_BIN'), 'Electron PHP server uses the PHP 8.4 path by default with an explicit override.');

console.log('Header menus, profile/mode styling, modern manual, and PHP 8.4 runtime verification passed.');
