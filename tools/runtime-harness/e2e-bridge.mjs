import { spawn } from 'node:child_process';
import fs from 'node:fs';

import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const media = '/tmp/kra-e2e-media.mp4';
const outVideo = '/tmp/kra-e2e-out.mp4';
fs.writeFileSync(media, Buffer.from([0, 0, 0, 24, 102, 116, 121, 112]));

const wrapper = '/tmp/fake-concat-e2e';
fs.writeFileSync(wrapper, '#!/bin/sh\nexec node ' + ROOT + '/tools/kra-concat-bridge/fake-concat-mcp.js "$@"\n');
fs.chmodSync(wrapper, 0o755);
const env = {
  ...process.env,
  BRIDGE_PORT: '5681',
  CONCAT_BIN: wrapper,
};
const bridge = spawn(process.execPath, [ROOT + '/tools/kra-concat-bridge/server.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
bridge.stdout.on('data', d => { log += d; });
bridge.stderr.on('data', d => { log += d; });

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function call(tool, args) {
  const res = await fetch('http://127.0.0.1:5681/call', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tool, arguments: args }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}
let failures = 0;
const check = (name, cond, extra = '') => { console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  — ' + extra : '')); if (!cond) failures++; };

try {
  for (let i = 0; i < 50; i++) {
    try { const h = await fetch('http://127.0.0.1:5681/health'); if (h.ok) break; } catch { /* wait */ }
    await sleep(200);
  }
  const pc = await call('project_create', { location: '/tmp/kra-e2e', name: 'Uji Runtime' });
  check('bridge project_create', pc.status === 200, 'HTTP ' + pc.status);
  const projectPath = pc.body?.structuredContent?.path || pc.body?.result?.structuredContent?.path || '';
  const mi = await call('media_import', { project: projectPath || '/tmp/kra-e2e/Uji Runtime.concat', paths: [media] });
  check('bridge media_import', mi.status === 200, 'HTTP ' + mi.status);
  const ex = await call('export_start', { project: projectPath || '/tmp/kra-e2e/Uji Runtime.concat', output: outVideo });
  check('bridge export_start', ex.status === 200, 'HTTP ' + ex.status);
  const ew = await call('export_wait', { timeout_seconds: 10 });
  check('bridge export_wait', ew.status === 200, 'HTTP ' + ew.status);
  console.log(failures === 0 ? 'BRIDGE E2E: ALL PASS' : 'BRIDGE E2E: ' + failures + ' FAIL');
} catch (e) {
  console.log('BRIDGE E2E ERROR:', e.message, '\nbridge log tail:', log.slice(-600));
  failures++;
} finally {
  bridge.kill('SIGTERM');
  fs.rmSync(media, { force: true }); fs.rmSync(outVideo, { force: true });
  fs.rmSync('/tmp/kra-e2e', { recursive: true, force: true });
  process.exit(failures ? 1 : 0);
}
