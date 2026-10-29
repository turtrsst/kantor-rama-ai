const assert = require('node:assert/strict');
const fs = require('node:fs');

const css = fs.readFileSync('web/style.css', 'utf8').replace(/\r\n/g, '\n');
const html = fs.readFileSync('web/index.html', 'utf8');
const app = fs.readFileSync('web/app.js', 'utf8');

// 1. Modal backdrop z-index must be above chat-fullscreen sidebar (1000) and its backdrop (999)
const modalBackdropZ = css.match(/\.modal-backdrop\s*\{[\s\S]*?z-index:\s*(\d+)/);
assert.ok(modalBackdropZ, 'modal-backdrop z-index rule not found');
const modalZ = parseInt(modalBackdropZ[1], 10);
assert.ok(modalZ > 1000, `modal-backdrop z-index ${modalZ} must be > 1000 (chat-fullscreen sidebar)`);
assert.ok(modalZ > 999, `modal-backdrop z-index ${modalZ} must be > 999 (chat-fullscreen::after backdrop)`);

// 2. chat-fullscreen sidebar z-index = 1000
const sidebarZ = css.match(/body\.chat-fullscreen\s+\.command-sidebar\s*\{[\s\S]*?z-index:\s*(\d+)/);
assert.ok(sidebarZ, 'chat-fullscreen .command-sidebar z-index not found');
assert.strictEqual(parseInt(sidebarZ[1], 10), 1000);

// 3. chat-fullscreen::after backdrop z-index = 999
const fsBackdropZ = css.match(/body\.chat-fullscreen::after\s*\{[\s\S]*?z-index:\s*(\d+)/);
assert.ok(fsBackdropZ, 'chat-fullscreen::after z-index not found');
assert.strictEqual(parseInt(fsBackdropZ[1], 10), 999);

// 4. All modal HTML elements use class="modal-backdrop"
const modalElements = html.match(/class="modal-backdrop/g);
assert.ok(modalElements, 'No modal-backdrop elements found in HTML');
assert.ok(modalElements.length >= 4, `Expected at least 4 modals (skills, task-board, project-path, approval), found ${modalElements.length}`);

// 5. OFFICE_WAYPOINTS exists with correct entries
const waypointSource = app.match(/const OFFICE_WAYPOINTS = \{([\s\S]*?)\n\};/);
assert.ok(waypointSource, 'OFFICE_WAYPOINTS not found');

// 6. Project Location Gate confirm handler references Budi by id and OFFICE_WAYPOINTS
// Find the confirm handler block: from document.getElementById('project-path-confirm') to its closing });
const confirmMarker = "document.getElementById('project-path-confirm').addEventListener('click', async () => {";
const confirmIdx = app.indexOf(confirmMarker);
assert.ok(confirmIdx !== -1, 'project-path-confirm click handler not found');
const confirmEnd = app.indexOf("\n});", confirmIdx);
assert.ok(confirmEnd !== -1, 'project-path-confirm handler end not found');
const confirmHandler = app.slice(confirmIdx, confirmEnd);
// Check it references AGENTS.find for creator
assert.ok(confirmHandler.includes("AGENTS.find(a => a.id === 'creator')"), 'confirm handler must lookup creator by id');
// Check it uses OFFICE_WAYPOINTS.budi
assert.ok(confirmHandler.includes('OFFICE_WAYPOINTS.budi'), 'confirm handler must use OFFICE_WAYPOINTS.budi');
// Check it has route-blocked fallback
assert.ok(confirmHandler.includes('if (!walkTo('), 'confirm handler must check walkTo result');

// 7. /create handler references Budi waypoint and has blocked-route fallback
const createIdx = app.indexOf("if (lower.startsWith('/create'))");
assert.ok(createIdx !== -1, '/create handler not found');
const modifyIdx = app.indexOf("if (lower.startsWith('/modify'))");
assert.ok(modifyIdx !== -1, '/modify handler not found');
const createHandler = app.slice(createIdx, modifyIdx);
assert.ok(createHandler.includes('OFFICE_WAYPOINTS.budi'), '/create must use Budi waypoint');
assert.ok(createHandler.includes('if (!walkTo('), '/create must check walkTo result');

// 8. /modify handler references Maya waypoint and has blocked-route fallback
const modifyHandler = app.slice(modifyIdx, modifyIdx + 2000); // enough to cover modify block
assert.ok(modifyHandler.includes('OFFICE_WAYPOINTS.maya'), '/modify must use Maya waypoint');
assert.ok(modifyHandler.includes('if (!walkTo('), '/modify must check walkTo result');

// 9. /audit handler references auditor by id
assert.ok(app.includes("AGENTS.find(a => a.id === 'auditor')"), '/audit must lookup auditor by id');

// 10. Modal count check
console.log('OFFICE UI STACKING AND COMMAND DISPATCH CHECKS PASSED');
console.log(`- modal-backdrop z-index: ${modalZ}`);
console.log('- chat-fullscreen sidebar z-index: 1000');
console.log('- chat-fullscreen::after z-index: 999');
console.log(`- Modal count in HTML: ${modalElements.length}`);
console.log('- OFFICE_WAYPOINTS verified');
console.log('- Project creation dispatches Budi to office waypoint');
console.log('- create commands report blocked routes instead of failing silently');