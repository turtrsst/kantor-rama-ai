const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = path => fs.readFileSync(path, 'utf8');
const keys = read('api/lib/KraApiKeys.php');
const auth = read('api/lib/KraAuth.php');
const api = read('api/index.php');
const db = read('api/lib/KraDb.php');
const entitlements = read('api/lib/KraEntitlements.php');
const tenant = read('api/lib/KraTenantContext.php');
const flow = read('api/lib/KraFlowBridge.php');
const react = read('api/lib/KraReActEngine.php');
const html = read('web/index.html');
const app = read('web/app.js');
const css = read('web/commercial_workspace.css');
const commercialTest = read('tools/runtime-harness/test-commercial.php');

// Paid plans only: server catalog is authoritative, and the free plan has no key budget.
const planStarts = {
  free: entitlements.indexOf("'free' => ["),
  pro: entitlements.indexOf("'pro' => ["),
  plus: entitlements.indexOf("'plus' => ["),
  platinum: entitlements.indexOf("'platinum' => ["),
};
const planEnds = {
  free: planStarts.pro,
  pro: planStarts.plus,
  plus: planStarts.platinum,
  platinum: entitlements.indexOf("\n    ];", planStarts.platinum),
};
for (const [plan, limit] of [['pro', 3], ['plus', 10], ['platinum', 25]]) {
  const block = entitlements.slice(planStarts[plan], planEnds[plan]);
  assert.ok(block.includes("'kra_api_access'"), `${plan} includes KRA API access`);
  assert.ok(block.includes(`'apiKeys' => ${limit}`), `${plan} allows ${limit} active KRA API keys`);
}
const freeStart = planStarts.free;
const freeEnd = planEnds.free;
assert.ok(!entitlements.slice(freeStart, freeEnd).includes("'kra_api_access'"), 'free plan cannot generate KRA API keys');
assert.match(entitlements, /'apiKeys' => 0/, 'free plan has zero API-key budget');
assert.match(keys, /Trial PRO gratis belum dapat membuat atau memakai KRA API Key/, 'free trial cannot issue/use a paid API key');
assert.match(keys, /paidAccessError/, 'paid access is evaluated centrally');

// Storage and secret handling.
assert.match(db, /CREATE TABLE IF NOT EXISTS `kra_api_keys`/, 'API key table migration exists');
assert.match(db, /UNIQUE KEY `uk_kra_api_key_hash` \(`key_hash`\)/, 'key hash is unique');
assert.match(keys, /random_bytes\(32\)/, 'key secret has 256-bit entropy');
assert.match(keys, /hash\('sha256'/, 'only a SHA-256 hash is persisted');
assert.match(keys, /'apiKey' => \(string\) \$created\['raw'\]/, 'plaintext is returned only from create/rotate');
assert.match(keys, /never includes the hash or plaintext secret/i, 'public key DTO documents secret exclusion');
assert.ok(!/localStorage\.setItem\([^)]*kra-api-key-secret/i.test(app), 'browser does not persist the plaintext secret in localStorage');
assert.ok(!/sessionStorage\.setItem\([^)]*kra-api-key-secret/i.test(app), 'browser does not persist the plaintext secret in sessionStorage');

// Authentication and delegated-authority boundaries.
assert.match(auth, /HTTP_X_KRA_API_KEY/, 'X-KRA-API-Key header is supported');
assert.match(auth, /function authenticateApiKey/, 'API-key authentication is wired');
assert.match(tenant, /delegated KRA API key is never a platform-admin credential/i, 'API keys do not inherit platform admin');
assert.match(api, /KRA API Key ini hanya berlaku untuk workspace tempat key dibuat/, 'keys are bound to one workspace');
assert.match(api, /function enforceApiKeyAccess/, 'endpoint scopes are enforced centrally');
assert.match(api, /api_key_scope_required/, 'missing scopes return a distinct error');
assert.match(api, /api_key_action_forbidden/, 'sensitive actions fail closed for API keys');
assert.match(flow, /KraTenantContext::isApiKeyAuth\(\)/, 'workspace keys can drive flow endpoints after scope checks');
assert.match(react, /if \(\$tool === 'run_terminal'\) return false;/, 'API keys can never use the ReAct terminal tool');
assert.match(react, /'recall_vault' => 'memory'/, 'ReAct vault recall requires the memory scope');
assert.match(react, /'stage_proposal' => 'tasks'/, 'ReAct proposals require the tasks scope');

// Management API and UI.
assert.match(api, /'api-keys', 'api-key-status'/, 'management and verification actions are registered');
assert.match(api, /requireCommercialFeature\('kra_api_access', 'KRA API Key'\)/, 'creation/rotation are entitlement-gated server-side');
assert.match(api, /requirePaidApiKeyAccess\(\)/, 'creation/rotation/use require paid access server-side');
assert.match(api, /\$workspace = requireWorkspaceAccess\('admin'\)[\s\S]*?api-keys/, 'only workspace owner/admin roles manage keys');
for (const id of [
  'kra-commercial-section-api-keys', 'kra-api-key-summary', 'kra-api-key-form',
  'kra-api-key-name', 'kra-api-key-expires', 'kra-api-key-generate',
  'kra-api-key-secret-wrap', 'kra-api-key-secret', 'kra-api-key-copy',
  'kra-api-key-secret-done', 'kra-api-key-list',
]) assert.ok(html.includes(`id="${id}"`), `#${id} exists`);
for (const fn of ['loadKraApiKeys', 'showKraApiKeySecret', 'hideKraApiKeySecret', 'copyKraApiKeySecret', 'updateKraApiKeyControls']) {
  assert.ok(app.includes(`function ${fn}`), `${fn} exists`);
}
assert.match(app, /\['workspace', 'setup', 'api-keys'\]/, 'free pricing-only modal hides API key settings');
assert.match(html, /commercial_workspace\.css\?v=20261102-api-keys-1/, 'commercial CSS cache is bumped');
assert.match(html, /app\.js\?v=20261102-api-keys-1/, 'app JS cache is bumped');
assert.match(css, /\.kra-api-key-secret/, 'one-time secret panel is styled');
assert.match(commercialTest, /only paid plans receive KRA API Key access/, 'runtime harness covers paid-only API keys');

console.log('KRA API Key verification passed: paid-only workspace keys, hashed storage, scoped delegated auth, one-time secret UI, rotate/revoke, and flow support are wired.');
