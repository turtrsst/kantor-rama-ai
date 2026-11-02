const assert = require('node:assert/strict');
const fs = require('node:fs');

const database = fs.readFileSync('api/lib/KraDb.php', 'utf8');
const loginHtml = fs.readFileSync('web/login.html', 'utf8');
const loginCss = fs.readFileSync('web/login.css', 'utf8');

// MariaDB rejects BEFORE in ADD COLUMN IF NOT EXISTS; the failure must not
// silently take KraDb::connect() down and make every SIAS password look wrong.
assert.ok(!/ADD COLUMN[^;]*\bBEFORE\b/.test(database), 'tenant migrations must not position new columns with BEFORE');
assert.match(database, /error_log\('\[KraDbConnect\] ' \. \$e->getMessage\(\)\)/, 'database connection failures are logged');
assert.match(database, /catch \(Throwable \$e\) \{[\s\S]*?self::\$pdo = null;[\s\S]*?return null;/, 'a failed connection does not retain a partially migrated PDO');

// Desktop login fits one viewport while retaining an internally scrollable panel.
assert.match(loginCss, /body\.login-page \{[\s\S]*?height: 100dvh;[\s\S]*?overflow: hidden;/, 'desktop login is locked to one viewport');
assert.match(loginCss, /\.login-panel \{[\s\S]*?align-content: safe center;[\s\S]*?overflow-y: auto;/, 'login panel scrolls internally only when needed');
assert.match(loginCss, /@media \(min-width: 821px\) and \(max-height: 860px\)/, 'short desktop viewports use the compact login layout');
assert.match(loginCss, /@media \(max-width: 820px\) \{[\s\S]*?body\.login-page \{ height: auto; min-height: 100dvh; overflow: visible; \}/, 'mobile login keeps normal page scrolling');

// Registration is a full-width, keyboard-visible CTA rather than footer microcopy.
assert.match(loginHtml, /class="register-cta" href="register\.html"/, 'SIAS registration CTA links to registration');
assert.match(loginHtml, /Belum memiliki akun\?/, 'registration CTA headline is present');
assert.match(loginHtml, /Daftar baru lewat registrasi SIAS/, 'registration CTA subtext is present');
assert.match(loginHtml, /login\.css\?v=20261102-login-fit-1/, 'login stylesheet cache is bumped');
assert.match(loginCss, /\.register-cta:focus-visible/, 'registration CTA has a visible keyboard focus state');

console.log('SIAS login reliability verification passed.');
