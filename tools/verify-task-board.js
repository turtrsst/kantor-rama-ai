const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('web/index.html', 'utf8');
const app = fs.readFileSync('web/app.js', 'utf8');

assert.match(html, /id="task-board-modal"/);
assert.match(html, /data-filter="WAITING_APPROVAL"/);
assert.match(html, /data-filter="EXECUTED"/);
assert.match(app, /function openTaskBoard\(/);
assert.match(app, /function renderTaskBoard\(/);
assert.match(app, /action=tasks/);
assert.match(app, /task-board-btn-close/);
assert.match(app, /dataset\.filter/);
assert.match(app, /action === 'review'/);
assert.match(app, /action === 'copy-path'/);
console.log('KRA task board verification passed.');
