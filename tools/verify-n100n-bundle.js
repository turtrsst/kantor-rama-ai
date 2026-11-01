'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

assert(fs.existsSync(path.join(root, 'n100n/server.js')), 'N100N server is vendored under KRA.');
assert(fs.existsSync(path.join(root, 'n100n/public/index.html')), 'N100N dashboard UI is included.');
assert(!fs.existsSync(path.join(root, 'n100n/.env')), 'N100N runtime secrets are not bundled.');
assert(!fs.existsSync(path.join(root, 'n100n/data/n100n.db')), 'N100N runtime database is not bundled.');
const upstream = read('n100n/UPSTREAM.md');
assert(upstream.includes('turtrsst/n100n') && upstream.includes('77fe26134c83103e3f4175a43cf852b91dacc8a1'), 'Vendored upstream source is traceable to its commit.');
assert(read('n100n/.gitignore').includes('.env') && read('n100n/.gitignore').includes('data/'), 'N100N secrets and runtime data are ignored.');
assert(read('.htaccess').includes('RewriteRule ^n100n(?:/|$) - [F,L,NC]'), 'Apache does not expose the bundled Node source as static files.');
assert(read('web/index.html').includes('id="creator-n100n-open"'), 'Creator Studio has an N100N UI shortcut.');
assert(read('web/app.js').includes("url.protocol !== 'https:' || localHost"), 'The UI shortcut rejects loopback/private/insecure server-only endpoints.');
assert(read('docs/N100N_DEPLOYMENT.md').includes('does not automatically run or publish') || read('docs/N100N_DEPLOYMENT.md').includes('tidak otomatis menjalankan atau menerbitkan'), 'Deployment requirements distinguish bundled source from a running service.');
console.log('N100N bundle verification passed: upstream source, runtime-secret isolation, Apache protection, and HTTPS UI shortcut.');
