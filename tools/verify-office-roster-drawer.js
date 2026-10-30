'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const html = read('web/index.html');
const app = read('web/app.js');
const css = read('web/office_roster_drawer.css');

assert(html.includes('class="agent-strip roster-drawer"'), 'Roster is an overlay drawer rather than a bottom layout row.');
assert(html.includes('id="btn-roster-drawer"') && html.includes('aria-controls="agent-roster-content"'), 'Crew drawer has an accessible edge trigger.');
assert(html.includes('class="agent-roster-content"') && html.includes(' inert'), 'Hidden roster content is removed from keyboard navigation.');
assert(!html.includes('Active Office Roster · select an agent to switch focus'), 'The old always-visible footer heading is removed.');
assert(css.includes('position: absolute') && css.includes('transform: translateX(-100%)'), 'The crew list slides out from behind its fixed left-edge trigger.');
assert(css.includes('max-height: min(74vh, 560px)') && css.includes('flex: 1 1 0'), 'The office floor can claim the former roster height.');
assert(app.includes('function initAgentRosterDrawer()') && app.includes('scheduleRosterDrawerHide(4600)'), 'Pointer activity opens the crew drawer and auto-hides it after idle.');
assert(app.includes("event.key === 'Escape' && drawer.classList.contains('is-open')"), 'Escape closes the roster drawer.');
assert(app.includes('closeAgentRosterDrawer();') && app.includes('initAgentRosterDrawer();'), 'Selecting a crew member closes the drawer and boot initializes it.');

console.log('Office canvas expansion and auto-hiding crew drawer verification passed.');
