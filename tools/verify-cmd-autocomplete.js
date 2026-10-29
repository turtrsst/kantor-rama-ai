const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('web/index.html', 'utf8');
const css = fs.readFileSync('web/style.css', 'utf8').replace(/\r\n/g, '\n');
const app = fs.readFileSync('web/app.js', 'utf8');

assert.match(html, /id="cmd-suggest" class="cmd-suggest hidden" role="listbox"/);
assert.match(html, /id="command-input"[^>]*aria-controls="cmd-suggest"/);
assert.match(css, /\.command-input-container \{\r?\n  position: relative;/);
assert.match(css, /\.cmd-suggest \{\n  position: absolute;/);
assert.match(css, /\.cmd-suggest-item\.active \{/);
assert.match(app, /const KRA_COMMANDS = \[/);
assert.match(app, /function renderCommandMenu\(/);
assert.match(app, /function moveCommandSelection\(/);
assert.match(app, /function acceptCommand\(/);
assert.match(app, /function hideCommandMenu\(/);
assert.match(app, /commandInput\.addEventListener\('input'/);
assert.match(app, /e\.key === 'ArrowDown' \|\| e\.key === 'ArrowUp'/);
assert.match(app, /KRA_COMMANDS\.forEach/);

const catalogSource = app.match(/const KRA_COMMANDS = (\[[\s\S]*?\n\]);/);
assert.ok(catalogSource, 'KRA_COMMANDS catalog not found');
const catalog = new Function('return ' + catalogSource[1])();

assert.ok(catalog.length >= 15, 'catalog too small');
for (const item of catalog) {
  assert.match(item.cmd, /^\/[a-z-]+$/, 'bad command name: ' + item.cmd);
  assert.ok(item.desc && item.desc.length > 4, 'missing description: ' + item.cmd);
}

const signatures = catalog.map(item => item.cmd + (item.args ? ' ' + item.args : ''));
assert.equal(new Set(signatures).size, signatures.length, 'duplicate command signature');

// Mirrors renderCommandMenu filtering.
const filter = query => catalog.filter(item => (item.cmd + ' ' + (item.args || '')).startsWith(query));

assert.equal(filter('/').length, catalog.length, 'bare slash must list every command');
assert.deepEqual(filter('/cre').map(i => i.cmd), ['/create', '/create-app']);
assert.deepEqual(filter('/create-app').map(i => i.cmd), ['/create-app']);
assert.equal(filter('/status').length, 1);
assert.equal(filter('/zzz').length, 0);
assert.ok(signatures.includes('/help'), '/help must be listed');

console.log('KRA slash autocomplete verification passed (' + catalog.length + ' commands).');
