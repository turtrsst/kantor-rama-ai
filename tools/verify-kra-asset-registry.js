const assert = require('node:assert/strict');
const registry = require('../web/kra_asset_registry.js');

assert.equal(registry.get('13_aif_compute_pod_gpu_rack').footprint.cols, 2);
assert.equal(registry.get('16_cmd_captain_console_dispatch_chairs').pivot, 'bottom_center');
assert.equal(registry.get('missing_png_fixture').source, 'procedural-fallback');
assert.equal(registry.get('missing_png_fixture').emission, null);
assert.equal(registry.FLOOR2_LEGACY_40x14.map.w, 40);
assert.equal(registry.FLOOR2_LEGACY_40x14.map.h, 14);
assert.equal(registry.FLOOR2_6DECK_44x12.map.w, 44);
assert.equal(registry.FLOOR2_6DECK_44x12.map.h, 12);
assert.deepEqual(
  registry.FLOOR2_6DECK_44x12.rooms.map(room => room.id),
  ['warroom', 'innovation', 'aiforge', 'observatory', 'lounge2', 'command']
);

(async () => {
  const resolved = await registry.resolve('missing_png_fixture', () => Promise.reject(new Error('missing')));
  assert.equal(resolved.source, 'procedural-fallback');
  assert.equal(typeof resolved.draw, 'function');
  assert.equal(resolved.pivot, 'bottom_center');
  assert.deepEqual(resolved.footprint, { cols: 1, rows: 1 });
  assert.equal(resolved.collision, true);

  const attempts = [];
  const alternate = {
    ...registry.get('13_aif_compute_pod_gpu_rack'),
    png: ['missing.png'],
    alternatives: ['alternate.png']
  };
  registry.props.alternate_fixture = alternate;
  const alternateResolved = await registry.resolve('alternate_fixture', async url => {
    attempts.push(url);
    if (url === 'alternate.png') return { width: 1, height: 1 };
    throw new Error('missing');
  });
  assert.equal(alternateResolved.source, 'alternative');
  assert.deepEqual(attempts, ['missing.png', 'alternate.png']);
  delete registry.props.alternate_fixture;
  console.log('KRA asset registry verification passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
