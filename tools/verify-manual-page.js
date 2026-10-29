/* Assert-based check for the KRA manual page: renderer behaviour + UI wiring.
   Run: node tools/verify-manual-page.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const { render, esc } = require(path.join(root, 'web/kra_manual_render.js'));

let checks = 0;
const check = (label, fn) => { fn(); checks++; console.log('PASS  ' + label); };

check('renderer: heading gets id and toc entry', () => {
  const out = render('## 1. Tujuan\n\nTeks.');
  assert.ok(out.html.includes('<h2 id="1-tujuan">1. Tujuan</h2>'), out.html);
  assert.deepStrictEqual(out.toc, [{ level: 2, text: '1. Tujuan', id: '1-tujuan' }]);
});

check('renderer: table becomes a scrollable table', () => {
  const out = render('| A | B |\n| --- | --- |\n| 1 | 2 |');
  assert.ok(out.html.includes('<div class="table-scroll"><table>'), out.html);
  assert.ok(out.html.includes('<th>A</th>'), out.html);
  assert.ok(out.html.includes('<td>2</td>'), out.html);
});

check('renderer: fenced code is escaped, not parsed', () => {
  const out = render('```cmd\ncd C:\\xampp\n```');
  assert.ok(out.html.includes('<pre><code>cd C:\\xampp</code></pre>'), out.html);
});

check('renderer: inline code, bold, safe link, and unsafe scheme', () => {
  const out = render('Pakai `pdo_mysql`, **aktifkan**, lihat [dok](https://example.test) dan [blok](javascript:alert(1)).');
  assert.ok(out.html.includes('<code>pdo_mysql</code>'), out.html);
  assert.ok(out.html.includes('<strong>aktifkan</strong>'), out.html);
  assert.ok(out.html.includes('<a href="https://example.test" rel="noopener noreferrer">dok</a>'), out.html);
  assert.ok(!out.html.includes('href="javascript:'), out.html);
  assert.ok(out.html.includes('blok'), out.html);
});

check('renderer: raw html in source is escaped', () => {
  assert.strictEqual(esc('<img src=x onerror=y>'), '&lt;img src=x onerror=y&gt;');
  assert.ok(render('<script>bad()</script>').html.includes('&lt;script&gt;'));
});

check('renderer: list and ordered list', () => {
  const out = render('- satu\n- dua\n\n1. awal\n2. akhir');
  assert.ok(out.html.includes('<ul><li>satu</li><li>dua</li></ul>'), out.html);
  assert.ok(out.html.includes('<ol><li>awal</li><li>akhir</li></ol>'), out.html);
});

check('manual page files exist', () => {
  ['web/manual.html', 'web/kra_manual_render.js', 'docs/USER_MANUAL.md'].forEach(rel => {
    assert.ok(fs.existsSync(path.join(root, rel)), 'missing ' + rel);
  });
});

check('manual page fetches the manual and exposes its buttons', () => {
  const page = read('web/manual.html');
  assert.ok(page.includes("fetch('../docs/USER_MANUAL.md'"), 'manual fetch missing');
  assert.ok(page.includes('kra_manual_render.js'), 'renderer script tag missing');
  ['btn-back-office', 'btn-manual-theme', 'btn-manual-print'].forEach(id => {
    assert.ok(page.includes('id="' + id + '"'), 'missing button ' + id);
  });
  const inlineScript = page.match(/<script>\s*([\s\S]*?)\s*<\/script>/);
  assert.ok(inlineScript, 'inline script missing');
  assert.doesNotThrow(() => new Function(inlineScript[1]), 'inline script syntax invalid');
});

check('office UI links to the manual page', () => {
  assert.ok(read('web/index.html').includes('id="btn-open-manual"'), 'header button missing');
  assert.ok(read('web/index.html').includes('data-cmd="/manual"'), 'sidebar chip missing');
  const app = read('web/app.js');
  assert.ok(app.includes("window.open('manual.html'"), 'command must open manual.html');
  assert.ok(app.includes("getElementById('btn-open-manual')"), 'header button not wired');
});

check('real manual renders with sections and tables', () => {
  const out = render(read('docs/USER_MANUAL.md'));
  assert.ok(out.toc.length >= 10, 'expected 10+ TOC entries, got ' + out.toc.length);
  assert.ok(out.html.includes('<table>'), 'expected at least one table in the manual');
  assert.ok(out.html.includes('<pre><code>'), 'expected at least one code block');
});

console.log('\nAll ' + checks + ' manual page checks passed.');
