'use strict';

/** Regresi layout Studio Terminal: satu ruang chat grup untuk seluruh Studio
 *  Crew, tanpa baris tab specialist yang dulu menimpa shell terminal. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const html = read('web/index.html');
const terminal = read('web/creator_studio_terminal.css');
const polish = read('web/ui_polish.css');
const refresh = read('web/ui_refresh.css');
const app = read('web/app.js');

assert(html.includes('creator_studio_terminal.css?') && html.includes('ui_polish.css?')
  && html.includes('office_stage.css?') && html.includes('app.js?'),
  'Asset cache keys carry the terminal + office stage revisions.');

assert(!html.includes('creator-studio-terminal-tabs'), 'No specialist tab row is rendered above the terminal.');
assert(!html.includes('Pilih tab specialist'), 'Heading copy describes one group room, not per-agent tabs.');
assert(!app.includes('renderCreatorStudioTabs') && !app.includes('data-creator-terminal-agent'),
  'No tab construction or tab click routing remains in app.js.');
assert(app.includes("const targetId = CREATOR_STUDIO_GROUP_ID")
  && app.includes("sendButton.textContent = 'KIRIM KE CREW'"),
  'The terminal is locked to the Studio Crew group channel.');
assert(html.includes('KIRIM KE CREW') && html.includes('Tulis pesan untuk Studio Crew'),
  'Composer defaults describe the group channel.');

assert(terminal.includes('display: none !important') && polish.includes('display: none !important'),
  'Any leftover tab markup stays hidden if a cached page still renders it.');

assert(terminal.includes('display: grid') && terminal.includes('"input send"') && terminal.includes('"tools hint"'),
  'Composer keeps its deliberate two-row grid.');
assert(terminal.includes('grid-template-areas: "input" "send" "tools" "hint"'),
  'Small screens stack the composer instead of wrapping it.');
assert(terminal.includes('flex: 1 1 auto') && terminal.includes('min-height: 360px') && terminal.includes('max-height: none'),
  'Chat log grows to fill the terminal instead of capping at 380px.');
assert(terminal.includes('max-height: 120px') && app.includes('Math.min(input.scrollHeight, 120)'),
  'Auto-growing textarea stays capped so the composer cannot eat the chat log.');
assert(refresh.includes('height:clamp(520px') && refresh.includes('.creator-workspace-split'),
  'Creator split keeps a usable conversation height on 720p screens.');

console.log('Creator terminal layout verification passed: single group terminal, no tab row, expanding chat log.');
