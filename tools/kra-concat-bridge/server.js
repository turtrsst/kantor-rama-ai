'use strict';
/**
 * kra-concat-bridge — jembatan HTTP -> MCP(stdio) untuk Concat.
 *
 * n100n (dan KRA lewatnya) hanya berbicara HTTP, sedangkan Concat membuka
 * antarmuka mesinnya sebagai MCP server stdio (`concat --mcp`). Bridge ini
 * menjalankan binary Concat sebagai proses anak, menjaga satu sesi MCP, dan
 * meneruskan panggilan tool lewat HTTP JSON sederhana:
 *
 *   GET  /health              -> { ok, concat: { alive, initialized } }
 *   GET  /tools               -> daftar tool MCP Concat (untuk discovery)
 *   POST /call {tool, arguments, timeoutMs?}
 *                             -> { ok, isError, data, content }
 *
 * `data` adalah `structuredContent` MCP bila ada (Concat selalu mengirimnya),
 * atau hasil parse JSON dari konten teks pertama.
 *
 * Environment:
 *   BRIDGE_PORT          port HTTP            (default 5681)
 *   BRIDGE_HOST          bind address         (default 127.0.0.1)
 *   BRIDGE_TOKEN         bila diisi, wajib header `x-api-key`
 *   CONCAT_BIN           path binary Concat   (default "concat")
 *   CONCAT_MCP_MODE      headless|window|auto (default headless)
 *   CONCAT_CALL_TIMEOUT_MS timeout per call   (default 600000)
 *   CONCAT_MCP_ROOTS     diteruskan ke Concat (folder yang boleh ditulis
 *                        di luar home, untuk mode headless)
 *
 * Tanpa dependency: cukup Node.js >= 18.
 */

const http = require('node:http');
const { spawn } = require('node:child_process');

const PORT = Number(process.env.BRIDGE_PORT || 5681);
const HOST = process.env.BRIDGE_HOST || '127.0.0.1';
const TOKEN = process.env.BRIDGE_TOKEN || '';
const CONCAT_BIN = process.env.CONCAT_BIN || 'concat';
const MCP_MODE = (process.env.CONCAT_MCP_MODE || 'headless').toLowerCase();
const DEFAULT_TIMEOUT_MS = Number(process.env.CONCAT_CALL_TIMEOUT_MS || 600000);

const log = (...args) => console.error('[kra-concat-bridge]', ...args);

// --- MCP stdio client -----------------------------------------------------

let child = null;
let childBuffer = '';
let nextId = 1;
let initialized = false;
let starting = null;
const pending = new Map(); // id -> {resolve, reject, timer}
let queue = Promise.resolve(); // serialize tool calls on the single session

function handleLine(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch (_) {
    log('non-JSON line from concat stdout ignored:', line.slice(0, 120));
    return;
  }
  if (message.id !== undefined && pending.has(message.id)) {
    const { resolve, reject, timer } = pending.get(message.id);
    pending.delete(message.id);
    clearTimeout(timer);
    if (message.error) {
      const err = new Error(`MCP error ${message.error.code}: ${message.error.message || 'unknown'}`);
      err.rpcError = message.error;
      reject(err);
    } else {
      resolve(message.result);
    }
    return;
  }
  // Notifications (progress, logs) are informational only.
  if (message.method) log('notification:', message.method);
}

function failAllPending(error) {
  for (const { reject, timer } of pending.values()) {
    clearTimeout(timer);
    reject(error);
  }
  pending.clear();
}

function send(message) {
  if (!child || !child.stdin.writable) throw new Error('Concat MCP process is not running.');
  child.stdin.write(JSON.stringify(message) + '\n');
}

function request(method, params, timeoutMs) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`MCP request "${method}" timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    try {
      send({ jsonrpc: '2.0', id, method, params });
    } catch (error) {
      pending.delete(id);
      clearTimeout(timer);
      reject(error);
    }
  });
}

async function ensureConcat() {
  if (child && initialized) return;
  if (starting) return starting;
  starting = (async () => {
    const args = MCP_MODE === 'auto' ? ['--mcp'] : ['--mcp', MCP_MODE];
    log(`starting: ${CONCAT_BIN} ${args.join(' ')}`);
    child = spawn(CONCAT_BIN, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
      windowsHide: true,
    });
    initialized = false;
    childBuffer = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      childBuffer += chunk;
      let index;
      while ((index = childBuffer.indexOf('\n')) >= 0) {
        const line = childBuffer.slice(0, index).trim();
        childBuffer = childBuffer.slice(index + 1);
        if (line) handleLine(line);
      }
    });
    child.stderr.on('data', (chunk) => log('[concat]', chunk.toString().trim()));
    child.on('error', (error) => {
      log('failed to spawn concat:', error.message);
      failAllPending(new Error(`Cannot start Concat binary "${CONCAT_BIN}": ${error.message}. Set CONCAT_BIN to the full path of the Concat executable.`));
    });
    child.on('exit', (code, signal) => {
      log(`concat exited (code ${code}, signal ${signal || 'none'})`);
      failAllPending(new Error('Concat MCP process exited unexpectedly.'));
      if (child) child = null;
      initialized = false;
    });
    const hello = await request('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'kra-concat-bridge', version: '1.0.0' },
    }, 60000);
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    initialized = true;
    log('MCP session ready:', JSON.stringify(hello?.serverInfo || {}));
  })();
  try {
    await starting;
  } finally {
    starting = null;
  }
}

function unwrapToolResult(result) {
  const content = Array.isArray(result?.content) ? result.content : [];
  let data = result?.structuredContent ?? null;
  if (data === null) {
    const text = content.find((part) => part?.type === 'text')?.text;
    if (typeof text === 'string') {
      try { data = JSON.parse(text); } catch (_) { data = text; }
    }
  }
  return { isError: Boolean(result?.isError), data, content };
}

function callTool(tool, args, timeoutMs) {
  const run = async () => {
    await ensureConcat();
    const result = await request('tools/call', {
      name: tool,
      arguments: args || {},
      _meta: { progressToken: `kra-${Date.now()}` },
    }, timeoutMs);
    return unwrapToolResult(result);
  };
  const result = queue.then(run, run);
  queue = result.then(() => {}, () => {});
  return result;
}

// --- HTTP surface ---------------------------------------------------------

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (error) { reject(new Error('Request body is not valid JSON.')); }
    });
    req.on('error', reject);
  });
}

function reply(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    if (TOKEN && req.headers['x-api-key'] !== TOKEN) {
      return reply(res, 401, { ok: false, error: 'x-api-key tidak cocok.' });
    }
    if (req.method === 'GET' && url.pathname === '/health') {
      let alive = false;
      try {
        await ensureConcat();
        await request('ping', {}, 15000);
        alive = true;
      } catch (error) {
        return reply(res, 503, { ok: false, error: error.message, concat: { alive: false, initialized } });
      }
      return reply(res, 200, { ok: true, concat: { alive, initialized, bin: CONCAT_BIN, mode: MCP_MODE } });
    }
    if (req.method === 'GET' && url.pathname === '/tools') {
      await ensureConcat();
      const listed = await request('tools/list', {}, 60000);
      return reply(res, 200, { ok: true, tools: listed?.tools || [] });
    }
    if (req.method === 'POST' && url.pathname === '/call') {
      const body = await readBody(req);
      const tool = String(body.tool || '');
      if (!tool) return reply(res, 422, { ok: false, error: 'Field "tool" wajib diisi (nama tool MCP Concat).' });
      const timeoutMs = Math.min(Math.max(Number(body.timeoutMs || DEFAULT_TIMEOUT_MS), 1000), 30 * 60 * 1000);
      const outcome = await callTool(tool, body.arguments || {}, timeoutMs);
      // Tool-level errors are data for workflow branching, not transport
      // failures: always 200 here, with ok:false the caller can branch on.
      return reply(res, 200, { ok: !outcome.isError, tool, ...outcome });
    }
    return reply(res, 404, { ok: false, error: 'Unknown route. Use GET /health, GET /tools, POST /call.' });
  } catch (error) {
    log('request failed:', error.message);
    return reply(res, 502, { ok: false, error: error.message });
  }
});

server.listen(PORT, HOST, () => {
  log(`listening on http://${HOST}:${PORT} (concat bin: ${CONCAT_BIN}, mode: ${MCP_MODE}${TOKEN ? ', token required' : ''})`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    try { child?.kill(); } catch (_) { /* already gone */ }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  });
}
