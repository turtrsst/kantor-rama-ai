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
  const routeStart = api.indexOf(`if ($action === '${action}')`);
  const route = api.slice(routeStart, routeStart + 700);
  assert.ok(route.includes("requireWorkspaceAccess('admin')"), `${action} must require workspace-admin authorization`);
}
assert.match(app, /kraIsWorkspaceAdmin\(\)[\s\S]*?Pengaturan Obsidian Vault hanya untuk pemilik\/admin workspace/, 'Vault UI is also gated for workspace admins');
assert.match(settings, /private-settings[\\\\/]?[';]/, 'Persistent settings should use a private server-side directory');
assert.match(settings, /is_writable\(\$resolved\)/, 'Selected folders must be writable');
assert.match(settings, /str_starts_with\(\$name, '\.'\)/, 'Folder browsing should omit hidden/system entries');
assert.match(settings, /count\(\$dirs\) >= 250/, 'Folder browsing should have a bounded result count');
assert.ok(sync.includes('KraVaultSettings::current()'), 'Vault sync uses the centralized workspace-scoped vault resolver');
const currentStart = settings.indexOf('public static function current()');
const current = settings.slice(currentStart, currentStart + 900);
assert.ok(current.indexOf('self::selectedPath()') < current.indexOf("getenv('KRA_MEMORY_ROOT')"), 'Saved workspace folder must take precedence over KRA_MEMORY_ROOT');
assert.match(settings, /\$data\['workspaces'\]\[\$workspaceId\]/, 'Vault choices persist per workspace, not globally');
assert.match(settings, /assertHostedBrowseAllowed/, 'Hosted vault selection is contained to an approved server area');
assert.match(sync, /KRA Workspaces/, 'Vault writes are isolated in a workspace subfolder');
assert.match(api, /function getMemoryRoot\(\): string\s*\{\s*return KraVaultSync::getVaultDir\(\);/s, 'Runtime and memory operations must share one vault path');
assert.match(api, /'memoryRoot' => \$canViewMemoryPath \? \$memoryRoot : ''/, 'Runtime should not expose the selected filesystem path to non-admins');
assert.match(htaccess, /RewriteRule \^\\\.temp\(\/\|\$\) - \[F,L,NC\]/, 'HTTP access to local KRA settings should be denied');

console.log('Obsidian vault settings verification passed: workspace-admin folder browsing, writable-path validation, per-workspace persistent selection, hosted containment, and unified memory root.');
