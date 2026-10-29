const assert = require('node:assert/strict');
const fs = require('node:fs');

const index = fs.readFileSync('web/index.html', 'utf8');
const app = fs.readFileSync('web/app.js', 'utf8');

assert.match(index, /kra_lighting_engine\.js[^\r\n]*defer/);
assert.ok(index.indexOf('kra_lighting_engine.js') < index.indexOf('app.js'));
assert.match(app, /KRALightingEngine/);
assert.match(app, /drawCinematicLighting\(\)/);
assert.match(fs.readFileSync('web/kra_lighting_engine.js', 'utf8'), /prefers-reduced-motion/);

console.log('KRA lighting integration verification passed.');
