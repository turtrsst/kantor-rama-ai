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
assert(refreshCss.includes('#app-root .app-mode-btn.active') && refreshCss.includes('border-radius: 999px'), 'Mode switch has rounded active-pill styling.');
assert(refreshCss.includes('#app-root .profile-avatar-grid .char-avatar') && refreshCss.includes('background-image: none !important'), 'Profile presets no longer render legacy sprite backgrounds.');
assert(manualHtml.includes('manual_refresh.css?v=20261030-manual-modern-1') && !manualHtml.includes('font-size: 20px'), 'Manual uses the polished external stylesheet instead of pixel typography.');
assert(manualCss.includes('.manual-doc h1') && manualCss.includes('font: 14px/1.75 var(--font-ui)'), 'Manual content is styled for readable product documentation.');
assert(launcher.includes('C:\\php84\\php.exe') && launcher.includes('PHP_VERSION_ID < 80400'), 'Windows launcher targets and validates PHP 8.4.');
assert(desktop.includes("'C:\\\\php84\\\\php.exe'") && desktop.includes('KRA_PHP_BIN'), 'Electron PHP server uses the PHP 8.4 path by default with an explicit override.');

console.log('Header menus, profile/mode styling, modern manual, and PHP 8.4 runtime verification passed.');
