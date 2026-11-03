'use strict';

/**
 * Verifikasi bundel GitHub Changer + jembatan KRA.
 * Sengaja berbasis berkas (tanpa PHP/Node service) supaya bisa jalan di CI
 * sebelum runtime apa pun dinyalakan.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

// --- 1. Snapshot upstream & isolasi rahasia --------------------------------
for (const file of [
  'github-changer/package.json', 'github-changer/README.md',
  'github-changer/server/index.js', 'github-changer/server/api.js',
  'github-changer/public/index.html', 'github-changer/config/defaults.json',
  'github-changer/scripts/smoke-test.js', 'github-changer/docs/deploy-kra.md',
]) {
  assert(exists(file), `Bundled GitHub Changer source is present: ${file}`);
}
assert(!exists('github-changer/.git'), 'Nested .git directory is not bundled.');
assert(!exists('github-changer/.env'), 'Runtime secrets are not bundled.');
assert(!exists('github-changer/data'), 'Runtime data (tokens/sessions/log) is not bundled.');
assert(!exists('github-changer/node_modules'), 'Dependencies are not bundled.');
const upstream = read('github-changer/UPSTREAM.md');
assert(upstream.includes('turtrsst/github-changer') && upstream.includes('arena/a2271201-github-changer')
  && upstream.includes('0635992476a2e0a53e795aeaf50dc2638981ef41'), 'Vendored source is pinned to a traceable upstream commit.');
const ghcPkg = JSON.parse(read('github-changer/package.json'));
assert(ghcPkg.version === '1.0.2', 'Bundled GitHub Changer version is pinned.');
assert(read('github-changer/.gitignore').includes('data/') && read('github-changer/.gitignore').includes('.env'), 'Upstream ignores runtime secrets.');
assert(read('.gitignore').includes('github-changer/data/') && read('.gitignore').includes('github-changer/.env'), 'KRA ignores bundled runtime secrets too.');
assert(read('.htaccess').includes('RewriteRule ^github-changer(?:/|$) - [F,L,NC]'), 'Apache does not serve the bundled Node source as static files.');

// --- 2. Endpoint mesin-ke-mesin di sisi Node ------------------------------
const ghcApi = read('github-changer/server/api.js');
const ghcKra = read('github-changer/server/lib/kra.js');
const ghcAutomation = read('github-changer/server/lib/automation.js');
assert(ghcApi.includes("route.startsWith('/api/kra/')") && ghcApi.includes("'/api/kra/status'")
  && ghcApi.includes("'/api/kra/repos'") && ghcApi.includes("'/api/kra/activity'")
  && ghcApi.includes("'/api/kra/sync'"), 'Node exposes the four /api/kra/* bridge routes.');
assert(ghcApi.includes('verifyKraKey(req)') && ghcApi.includes('kraBridgeEnabled()'), 'Bridge requires a shared x-api-key and is disabled without it.');
assert(ghcApi.includes('publicConfig(cfg, !(ctx.authenticated && ctx.pinOk))'), 'Unauthenticated bootstrap never leaks webhook secret.');
assert(ghcKra.includes('export function verifyKraKey') && ghcKra.includes('timingSafeEqual')
  && ghcKra.includes('export async function notifyKra') && ghcKra.includes("createHmac('sha256'"),
  'Bridge uses constant-time key comparison and HMAC-signed outbound events.');
assert(ghcAutomation.includes("notifyKra({") && ghcAutomation.includes("trigger !== 'kra'"), 'Every automation run reports its result to KRA once.');
assert(exists('github-changer/server/lib/env.js') && read('github-changer/server/lib/config.js').includes("import './env.js'"),
  'Bundled app loads .env without dependencies so launchers and desktop pairing work.');
const ghcEnvExample = read('github-changer/.env.example');
for (const key of ['KRA_GHC_API_KEY', 'KRA_GHC_EVENT_URL', 'KRA_GHC_EVENT_SECRET']) {
  assert(ghcEnvExample.includes(key), `Bridge environment variable documented: ${key}`);
}
const smoke = read('github-changer/scripts/smoke-test.js');
assert(smoke.includes('/api/kra/status') && smoke.includes('x-api-key palsu') && smoke.includes('bootstrap publik tidak membocorkan'),
  'Bundled offline test covers bridge auth and secret redaction.');

// --- 3. Klien PHP & endpoint KRA -------------------------------------------
const phpClient = read('api/lib/KraGitHubChangerClient.php');
assert(phpClient.includes('class KraGitHubChangerClient') && phpClient.includes("'x-api-key: '")
  && phpClient.includes('/api/kra/status') && phpClient.includes('/api/kra/sync'),
  'KRA PHP client talks to the Node bridge with a server-only key.');
assert(phpClient.includes("strtoupper($method) === 'GET' ? 1 : 0"), 'Only idempotent reads are retried; sync never runs twice.');
const settings = read('api/lib/KraIntegrationSettings.php');
assert(settings.includes('public static function githubChanger()')
  && settings.includes('public static function publicGitHubChangerBaseUrl()')
  && settings.includes('public static function saveGitHubChangerEvent')
  && settings.includes("'githubChanger'"), 'KRA stores bridge settings privately, per workspace.');
const apiIndex = read('api/index.php');
assert(apiIndex.includes("require_once __DIR__ . '/lib/KraGitHubChangerClient.php';"), 'KRA API loads the GitHub Changer client.');
for (const action of ['github-changer-status', 'github-changer-repos', 'github-changer-activity',
  'github-changer-sync', 'github-changer-config', 'github-changer-event']) {
  assert(apiIndex.includes(`$action === '${action}'`), `KRA API action registered: ${action}`);
}
assert(apiIndex.includes("'github-changer-event'];") || apiIndex.includes("'github-changer-event',"), 'Event callback is reachable without a browser session.');
assert(apiIndex.includes("hash_hmac('sha256', $raw, $secret)") && apiIndex.includes('hash_equals($expected, $signature)'),
  'Event callback verifies HMAC over the raw body with a constant-time comparison.');
assert(apiIndex.includes('requireSupervisorRole($currentUser)'), 'Manual sync is restricted to supervisors.');

// --- 4. Tombol, panel UI, desktop ------------------------------------------
const html = read('web/index.html');
const ghcJs = read('web/github_changer.js');
assert(html.includes('id="kra-github-changer-open"') && html.includes('id="btn-github-changer-settings"')
  && html.includes('id="github-changer-open-link"') && html.includes('github_changer.js?v=20261102-ghc-1'),
  'KRA has header + menu buttons to access GitHub Changer and loads the panel script.');
assert(html.includes('id="github-changer-config-form"') && html.includes('id="github-changer-sync"'),
  'Panel can configure the connection and trigger a sync.');
assert(ghcJs.includes('url.username || url.password') && ghcJs.includes('browserOnLan')
  && ghcJs.includes('target.hostname') && ghcJs.includes("url.protocol === 'https:' && !localService"),
  'UI shortcut links only public HTTPS or same-server/LAN endpoints with loopback rewriting.');
assert(exists('web/github_changer.css') && read('web/github_changer.css').includes('.kra-ghc-open'), 'Shortcut has dedicated styling.');
const desktop = read('desktop/main.js');
assert(desktop.includes('startGitHubChangerServer') && desktop.includes('ensureGitHubChangerEnv')
  && desktop.includes('KRA_GITHUB_CHANGER_API_KEY') && desktop.includes('KRA_GITHUB_CHANGER_EVENT_SECRET')
  && desktop.includes('githubChanger: {'), 'Desktop auto-starts the bundled sub-app and pairs PHP/Node secrets.');

// --- 5. Launcher, npm scripts, docs, CI, deploy -----------------------------
const rootPkg = JSON.parse(read('package.json')).scripts;
assert(rootPkg['github-changer'] && rootPkg['github-changer:test'] && rootPkg['verify:github-changer-bundle'],
  'Root npm scripts can start, test, and verify the bundled service.');
assert(exists('github-changer/scripts/pair-kra.js') && rootPkg['github-changer:pair']
  && read('github-changer/scripts/pair-kra.js').includes('KRA_GITHUB_CHANGER_EVENT_SECRET'),
  'One-command pairing helper prints the PHP-side environment values for XAMPP/manual installs.');
assert(read('Start GitHub Changer.bat').includes('node server\\index.js')
  && read('Start GitHub Changer.bat').includes('scripts\\pair-kra.js')
  && read('Start GitHub Changer.bat').includes('copy ".env.example" ".env"'), 'Windows launcher creates .env, pairs KRA secrets, and starts the Node service.');
assert(exists('docs/GITHUB-CHANGER-INTEGRATION.md') && read('docs/GITHUB-CHANGER-INTEGRATION.md').includes('arena/cbf4b10e-kantor-rama-ai'),
  'Integration guide documents the deployment branch.');
assert(read('README.md').includes('github-changer/'), 'README lists the bundled automation service.');
assert(exists('.github/workflows/deploy-kra.yml'), 'Optional HMAC deploy workflow template is included.');
assert(read('.github/workflows/ci.yml').includes('verify:github-changer-bundle') && read('.github/workflows/ci.yml').includes('github-changer:test'),
  'CI verifies the bundle and runs the bundled offline test.');

console.log('GitHub Changer bundle verification passed: pinned upstream, secret isolation, KRA<->Node bridge, UI shortcut, desktop pairing, docs, and CI.');
