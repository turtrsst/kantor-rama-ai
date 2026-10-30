const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const html = read('web/index.html');
const app = read('web/app.js');
const api = read('api/index.php');
const settings = read('api/lib/KraVaultSettings.php');
const sync = read('api/lib/KraVaultSync.php');
const htaccess = read('.htaccess');

assert.match(html, /id="btn-obsidian-vault-settings"/, 'Settings menu should expose Obsidian vault configuration');
assert.match(html, /id="obsidian-vault-modal"/, 'Vault folder picker modal should be present');
assert.match(html, /obsidian_vault_settings\.css/, 'Vault settings stylesheet should be loaded');
assert.match(app, /vaultSettingsRequest\('vault-browse'/, 'UI should browse server directories');
assert.match(app, /vaultSettingsRequest\('vault-select'/, 'UI should persist the selected folder');
assert.match(app, /method: 'POST', headers: getAuthHeaders\(\), body: JSON\.stringify\(\{ path \}\)/, 'Vault path selection should use authenticated POST');

for (const action of ['vault-settings', 'vault-browse', 'vault-select']) {
  const route = api.slice(api.indexOf(`if ($action === '${action}')`));
  assert.ok(route.indexOf('requireSupervisorRole($currentUser)') >= 0, `${action} must require supervisor authorization`);
}
assert.match(settings, /private-settings[\\\\/]?[';]/, 'Persistent settings should use a private server-side directory');
assert.match(settings, /is_writable\(\$resolved\)/, 'Selected folders must be writable');
assert.match(settings, /str_starts_with\(\$name, '\.'\)/, 'Folder browsing should omit hidden/system entries');
assert.match(settings, /count\(\$dirs\) >= 250/, 'Folder browsing should have a bounded result count');
assert.ok(sync.indexOf('KraVaultSettings::selectedPath()') < sync.indexOf("getenv('KRA_MEMORY_ROOT')"), 'Saved folder must take precedence over KRA_MEMORY_ROOT');
assert.match(api, /function getMemoryRoot\(\): string\s*\{\s*return KraVaultSync::getVaultDir\(\);/s, 'Runtime and memory operations must share one vault path');
assert.match(api, /'memoryRoot' => \$canViewMemoryPath \? \$memoryRoot : ''/, 'Runtime should not expose the selected filesystem path to non-supervisors');
assert.match(htaccess, /RewriteRule \^\\\.temp\(\/\|\$\) - \[F,L,NC\]/, 'HTTP access to local KRA settings should be denied');

console.log('Obsidian vault settings verification passed: supervisor-only folder browsing, writable-path validation, persistent server-side selection, and unified memory root.');
