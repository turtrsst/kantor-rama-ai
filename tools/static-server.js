/* Minimal static server for KRA preview (no PHP). API calls fail gracefully client-side. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.php': 'application/json' };

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath.startsWith('/api/')) {
    // Stubs so the client treats itself as authenticated officer 'rama'.
    const body = JSON.stringify(urlPath.includes('auth-status')
      ? { ok: true, authenticated: true, user: { id: 'user_rama', username: 'rama', display_name: 'Rama (Preview)', role: 'supervisor' } }
      : { ok: true, items: [] });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(body);
  }
  let file = path.normalize(path.join(root, urlPath));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(8080, '127.0.0.1', () => console.log('STATIC READY'));
