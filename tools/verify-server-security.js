const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const rootHtaccess = fs.readFileSync(path.join(root, '.htaccess'), 'utf8');
const apiHtaccess = fs.readFileSync(path.join(root, 'api/.htaccess'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'api/lib/KraAuth.php'), 'utf8');
const database = fs.readFileSync(path.join(root, 'api/lib/KraDb.php'), 'utf8');
const api = fs.readFileSync(path.join(root, 'api/index.php'), 'utf8');
const app = fs.readFileSync(path.join(root, 'web/app.js'), 'utf8');

assert(!/SetEnv\s+KRA_DB_USER\s+root\b/i.test(rootHtaccess), 'public Apache configuration must not set the application DB account to root');
assert(apiHtaccess.includes('config(\\.local)?\\.json'), 'API config and ignored local config files must be denied by Apache');
assert(rootHtaccess.includes('RewriteRule ^\\.temp(/|$) - [F,L,NC]'), 'temporary runtime data stays blocked from direct web access');
assert(auth.includes("getenv('KRA_ALLOW_DEFAULT_DB_ROOT') === '1'") && auth.includes("if (!$localDevServer && !$explicitLocalOverride) return null;"), 'SIAS auth refuses implicit MySQL root access for remote web requests');
assert(database.includes("getenv('KRA_ALLOW_DEFAULT_DB_ROOT') === '1'") && database.includes("if (!$localDevServer && !$explicitLocalOverride) return null;"), 'KRA DB root fallback remains local-only and explicit');
assert(api.includes("if ($action === 'logout')") && api.includes("if (!KraAuth::logout())"), 'server-side logout is an authenticated API action');
assert(auth.includes("UPDATE `kra_users` SET `session_hash` = :replacement") && auth.includes("':hash' => hash('sha256', $credential)"), 'logout revokes the current bearer hash server-side');
assert(app.includes("fetch('../api/index.php?action=logout'") && app.includes('payload.ok !== true'), 'browser clears the local token only after server revocation succeeds');

console.log('Server security verification passed: no root DB credentials in Apache config, local config is denied, root fallback is localhost-only, and logout revokes the bearer session.');
