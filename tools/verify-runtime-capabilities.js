const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function checkFile(relPath) {
  const p = path.join(root, relPath);
  assert.ok(fs.existsSync(p), `Missing expected file: ${relPath}`);
  return fs.readFileSync(p, 'utf8');
}

console.log('--- Step 1: Testing GitHub Bridge ---');
const ghCode = checkFile('api/lib/KraGitHubBridge.php');
assert.match(ghCode, /final class KraGitHubBridge/);
assert.match(ghCode, /public static function listRuns\(/);
assert.match(ghCode, /public static function dispatch\(/);
assert.match(ghCode, /public static function getWorkflowLogs\(/);

const ciWf = checkFile('.github/workflows/ci.yml');
assert.match(ciWf, /name:\s*CI Pipeline/);
assert.match(ciWf, /workflow_dispatch:/);

console.log('--- Step 2: Testing Web Search Bridge ---');
const webCode = checkFile('api/lib/KraWebSearchBridge.php');
assert.match(webCode, /final class KraWebSearchBridge/);
assert.match(webCode, /public static function search\(/);
assert.match(webCode, /public static function fetch\(/);
assert.match(webCode, /public static function htmlToMarkdown\(/);

console.log('--- Step 3: Testing Remotion Bridge ---');
const remotionCode = checkFile('api/lib/KraRemotionBridge.php');
assert.match(remotionCode, /final class KraRemotionBridge/);
assert.match(remotionCode, /public static function render\(/);
assert.match(remotionCode, /public static function listCompositions\(/);
assert.match(remotionCode, /src\/index\.ts/);
assert.match(remotionCode, /MAX_RENDER_TIMEOUT_SEC/);

checkFile('remotion/package.json');
checkFile('remotion/src/index.ts');
checkFile('remotion/src/Root.tsx');
checkFile('remotion/src/PromoClip.tsx');

console.log('--- Step 4: Testing ReAct Catalog & Wiring ---');
const reactCode = checkFile('api/lib/KraReActEngine.php');
assert.match(reactCode, /'gh_runs'/);
assert.match(reactCode, /'gh_dispatch'/);
assert.match(reactCode, /'web_search'/);
assert.match(reactCode, /'web_fetch'/);
assert.match(reactCode, /'remotion_render'/);

assert.match(reactCode, /case 'gh_runs':/);
assert.match(reactCode, /case 'gh_dispatch':/);
assert.match(reactCode, /case 'web_search':/);
assert.match(reactCode, /case 'web_fetch':/);
assert.match(reactCode, /case 'remotion_render':/);

console.log('ALL RUNTIME EXTENSION ASSERTIONS PASSED.');
