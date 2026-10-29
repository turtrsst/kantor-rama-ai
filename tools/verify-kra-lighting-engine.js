const assert = require('node:assert/strict');
const lighting = require('../web/kra_lighting_engine.js');

assert.equal(lighting.reducedMotion({ matches: true }), true);
assert.equal(lighting.reducedMotion({ matches: false }), false);
assert.equal(lighting.normalizeEmission({}), null);
assert.deepEqual(
  lighting.normalizeEmission({ color: '#00F0FF', radius: 20, alpha: 2 }),
  { color: '#00F0FF', radius: 20, alpha: 1 }
);
assert.deepEqual(
  lighting.normalizeEmission({ color: '#FF55B8', radius: -3, alpha: -1 }),
  { color: '#FF55B8', radius: 0, alpha: 0 }
);

console.log('KRA lighting engine verification passed.');
