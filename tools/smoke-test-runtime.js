const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const remotionDir = path.join(root, 'remotion');
const entryPoint = 'src/index.ts';
const outDir = path.join(root, 'assets/renders/video');
const output = path.join(outDir, `smoke_test_${Date.now()}.mp4`);
let failed = false;

console.log('--- KRA Runtime Smoke Test ---');
console.log('\n[1/2] Rendering 30 Remotion frames...');
fs.mkdirSync(outDir, { recursive: true });
const render = spawnSync('npx.cmd', [
  'remotion', 'render', entryPoint, 'PromoClip', output, '--frames=0-29',
], { cwd: remotionDir, stdio: 'inherit', shell: true });

if (render.status !== 0) {
  failed = true;
  console.error(`FAIL: Remotion render exited with ${render.status ?? render.error?.message}`);
} else if (!fs.existsSync(output) || fs.statSync(output).size === 0) {
  failed = true;
  console.error('FAIL: Render returned success but output MP4 is missing or empty.');
} else {
  console.log(`PASS: Rendered ${output} (${fs.statSync(output).size} bytes).`);
}

console.log('\n[2/2] Verifying ReAct Engine tool dispatch wiring...');
const engineCode = fs.readFileSync(path.join(root, 'api/lib/KraReActEngine.php'), 'utf8');
for (const tool of ['gh_runs', 'gh_dispatch', 'web_search', 'web_fetch', 'remotion_render']) {
  if (!engineCode.includes(`case '${tool}':`)) {
    failed = true;
    console.error(`FAIL: Tool [${tool}] missing from executeTool().`);
  } else {
    console.log(`PASS: Tool [${tool}] wired.`);
  }
}

if (failed) process.exitCode = 1;
else console.log('\nSmoke test passed.');
