'use strict';

/** Verifikasi bundel RNA Router + automation KRA (berbasis berkas, tanpa service). */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

// --- Snapshot upstream & isolasi runtime -----------------------------------
for (const file of [
  'rna-router/package.json', 'rna-router/package-lock.json', 'rna-router/README.md',
  'rna-router/app/api/health/route.ts', 'rna-router/app/api/v1/models/route.ts',
  'rna-router/app/api/v1/chat/completions/route.ts', 'rna-router/lib/adapters.ts',
  'rna-router/scripts/kra-automation.js', 'rna-router/scripts/kra-automation.test.js',
  'rna-router/scripts/kra-env.js', 'rna-router/scripts/pair-kra.js',
]) {
  assert(exists(file), `Bundled RNA Router source is present: ${file}`);
}
assert(!exists('rna-router/.git') && !exists('rna-router/node_modules') && !exists('rna-router/.next'), 'Nested git/build/dependencies are not bundled.');
assert(!exists('rna-router/.env') && !exists('rna-router/.env.local'), 'Runtime secrets are not bundled.');
const upstream = read('rna-router/UPSTREAM.md');
assert(upstream.includes('turtrsst/RNA-Router') && upstream.includes('arena/ffbada04-rna-router')
  && upstream.includes('34fcbf25e895ad6dd2e13ca5d83815b596dd95e3'), 'Vendored source is pinned to a traceable upstream commit.');
assert(JSON.parse(read('rna-router/package.json')).version === '1.0.0', 'Bundled gateway version is pinned.');
assert(read('.htaccess').includes('RewriteRule ^rna-router(?:/|$) - [F,L,NC]'), 'Apache does not serve the Next.js source tree.');
assert(read('.gitignore').includes('rna-router/.next/') && read('.gitignore').includes('rna-router/.env.local'), 'Next.js build and env files are ignored.');
assert(read('rna-router/.gitignore').includes('rna-fallback-log.txt'), 'Automation runtime logs are ignored.');

// --- Automation ------------------------------------------------------------
const automation = read('rna-router/scripts/kra-automation.js');
assert(automation.includes("'/api/health'") && automation.includes("'/api/v1/models'")
  && automation.includes("'/api/v1/chat/completions'"), 'Automation polls health, models, and optionally chat.');
assert(automation.includes("createHmac('sha256'") && automation.includes("X-KRA-Signature")
  && automation.includes('X-KRA-Source'), 'Automation signs its reports with HMAC-SHA256.');
assert(automation.includes('KRA_EVENT_SECRET') && automation.includes("reason: 'KRA_EVENT_SECRET belum diset'"), 'Without a secret the automation is an explicit dry run.');
assert(automation.includes('--once') && automation.includes('--interval') && automation.includes('setInterval'), 'Automation supports one-shot and scheduled runs.');
assert(automation.includes("url.username || url.password"), 'URL validation rejects embedded credentials.');
assert(read('rna-router/scripts/kra-automation.test.js').includes('HMAC signature matches the raw body'), 'Offline test verifies the signed event.');
assert(JSON.parse(read('rna-router/package.json')).scripts['automation:kra'], 'Vendored package exposes the automation script.');
assert(read('Start RNA Router Automation.bat').includes('kra-automation.js --interval=15'), 'Windows automation launcher starts the scheduler.');
const pairScript = read('rna-router/scripts/pair-kra.js');
assert(pairScript.includes('KRA_EVENT_SECRET: secret') && pairScript.includes('KRA_RNA_ROUTER_EVENT_SECRET: secret'), 'One generated secret is written for BOTH Node and PHP.');
assert(pairScript.includes('values.KRA_EVENT_SECRET || crypto.randomBytes'), 'Existing secret is never overwritten.');
assert(pairScript.includes('SetEnv KRA_RNA_ROUTER_EVENT_SECRET') && pairScript.includes('setx KRA_RNA_ROUTER_EVENT_SECRET'), 'Pairing prints both Apache SetEnv and Windows setx instructions.');
assert(read('rna-router/scripts/kra-env.js').includes('process.env[key] !== undefined'), 'Environment process wins over the secret file.');
assert(automation.includes("require('./kra-env.js').loadKraEnv()"), 'Automation loads the paired secret automatically.');
assert(read('Start RNA Router Automation.bat').includes('.kra-secrets.env') && !read('Start RNA Router Automation.bat').includes('set "KRA_EVENT_URL='), 'Automation launcher relies on the paired file instead of hardcoding a KRA URL.');
assert(read('Pair KRA Event Secret.bat').includes('pair-kra.js --kra-url=%KRA_URL%'), 'Windows pairing launcher honours the KRA_URL override.');
assert(read('Start GitHub Changer.bat').includes('pair-kra.js --kra-url=%KRA_URL%'), 'GitHub Changer pairing honours the same KRA_URL override.');
assert(read('.gitignore').includes('rna-router/.kra-secrets.env') && read('rna-router/.gitignore').includes('.kra-secrets.env'), 'Shared secret file is ignored by Git.');
assert(exists('docs/DEPLOY-KRA-AUTOMATION-RUNBOOK.md') && read('docs/DEPLOY-KRA-AUTOMATION-RUNBOOK.md').includes('git pull --ff-only origin arena/cbf4b10e-kantor-rama-ai'), 'Runbook spells out the exact pull command and all three launchers.');

// --- Klien PHP & endpoint --------------------------------------------------
const client = read('api/lib/KraRnaRouterClient.php');
assert(client.includes('class KraRnaRouterClient') && client.includes("'/api/health'")
  && client.includes("'/api/v1/models'") && client.includes("'/api/v1/chat/completions'"), 'PHP client talks to all three gateway routes.');
assert(client.includes("strtoupper($method) === 'GET' ? 1 : 0"), 'Only idempotent reads are retried.');
const settings = read('api/lib/KraIntegrationSettings.php');
assert(settings.includes('public static function rnaRouter()') && settings.includes('public static function saveRnaRouterEvent')
  && settings.includes("'rnaRouter'"), 'KRA stores gateway settings and automation events privately.');
const apiIndex = read('api/index.php');
assert(apiIndex.includes("require_once __DIR__ . '/lib/KraRnaRouterClient.php';"), 'KRA API loads the RNA Router client.');
for (const action of ['rna-router-status', 'rna-router-models', 'rna-router-chat', 'rna-router-config', 'rna-router-event']) {
  assert(apiIndex.includes(`$action === '${action}'`), `KRA API action registered: ${action}`);
}
assert(apiIndex.includes("hash_hmac('sha256', $raw, $secret)") && apiIndex.includes("'rna-router-event']"), 'Automation callback verifies HMAC over the raw body.');
const providerExample = JSON.parse(read('api/config.example.json'));
assert(providerExample.providers['rna-router']
  && providerExample.providers['rna-router'].baseUrl === 'http://127.0.0.1:3000/api/v1'
  && providerExample.providers['rna-router'].fallbackProvider === 'ollama', 'KRA chat can use the gateway as a provider with Ollama fallback.');

// --- UI, launcher, docs, CI ------------------------------------------------
const html = read('web/index.html');
const ui = read('web/rna_router.js');
assert(html.includes('id="kra-rna-router-open"') && html.includes('id="btn-rna-router-settings"')
  && html.includes('rna_router.js?v=20261103-rna-1') && html.includes('rna_router.css?v=20261103-rna-1'), 'Header shortcut, Settings entry, and panel assets are wired.');
assert(html.includes('id="rna-router-config-form"') && html.includes('id="rna-router-copy-command"'), 'Panel can configure the gateway and copy the automation command.');
assert(ui.includes('url.username || url.password') && ui.includes('browserOnLan') && ui.includes('target.hostname'), 'UI shortcut follows the same safe-link policy as N100N/GitHub Changer.');
assert(ui.includes("api('rna-router-chat'") && ui.includes('window.confirm'), 'Test chat is an explicit, confirmed action.');
assert(read('Start RNA Router.bat').includes('npm ci') && read('Start RNA Router.bat').includes('npm run dev'), 'Gateway launcher installs dependencies and starts Next.js.');
assert(exists('docs/RNA-ROUTER-INTEGRATION.md') && read('docs/RNA-ROUTER-INTEGRATION.md').includes('arena/cbf4b10e-kantor-rama-ai'), 'Integration guide documents the deployment branch.');
assert(read('README.md').includes('rna-router/') && read('README.md').includes('RNA Router automation'), 'README lists the bundled gateway and its automation.');
const scripts = JSON.parse(read('package.json')).scripts;
assert(scripts['rna-router:automation'] && scripts['rna-router:test'] && scripts['verify:rna-router-bundle'], 'Root npm scripts can run, test, and verify the automation.');
assert(read('.github/workflows/ci.yml').includes('verify:rna-router-bundle') && read('.github/workflows/ci.yml').includes('rna-router:test'), 'CI verifies the bundle and runs the offline automation test.');

console.log('RNA Router bundle verification passed: pinned upstream, signed automation, PHP bridge, provider config, UI shortcut, docs, and CI.');
