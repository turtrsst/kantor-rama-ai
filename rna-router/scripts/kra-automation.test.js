'use strict';

/** Tes offline automation RNA Router -> KRA (tidak butuh Next.js / Supabase). */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const automation = require('./kra-automation.js');

const SECRET = 'test-event-secret';

function listen(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

test('automation collects health/models, signs the event, and KRA accepts it', async () => {
  let received = null;
  const gateway = await listen(async (req, res) => {
    const raw = req.method === 'POST' ? await readBody(req) : '';
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/health') {
      res.end(JSON.stringify({ status: 'ok', version: '1.0.0', features: ['openrouter-api', 'auto-fallback'] }));
    } else if (req.url === '/api/v1/models') {
      res.end(JSON.stringify({ object: 'list', data: [
        { id: 'muse-spark-1.2-free', provider: 'muse' },
        { id: 'deepseek-chat', provider: 'deepseek' },
      ] }));
    } else if (req.url === '/api/v1/chat/completions') {
      assert(raw.includes('muse-spark-1.2-free'), 'chat probe sends the configured model');
      res.end(JSON.stringify({ choices: [{ message: { content: 'siap' } }] }));
    } else {
      res.writeHead(404);
      res.end('{}');
    }
  });
  const kra = await listen(async (req, res) => {
    const raw = await readBody(req);
    const expected = 'sha256=' + crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
    const valid = req.headers['x-kra-signature'] === expected;
    received = {
      url: req.url,
      source: req.headers['x-kra-source'],
      valid,
      body: JSON.parse(raw),
    };
    res.setHeader('Content-Type', 'application/json');
    if (!valid) {
      res.writeHead(401);
      res.end(JSON.stringify({ ok: false, error: 'signature tidak valid' }));
      return;
    }
    res.end(JSON.stringify({ ok: true }));
  });

  const previous = {};
  const env = {
    RNA_ROUTER_URL: `http://127.0.0.1:${gateway.port}`,
    KRA_EVENT_URL: `http://127.0.0.1:${kra.port}/api/index.php?action=rna-router-event`,
    KRA_EVENT_SECRET: SECRET,
    RNA_ROUTER_API_KEY: 'unit-test-key',
  };
  for (const [key, value] of Object.entries(env)) {
    previous[key] = process.env[key];
    process.env[key] = value;
  }
  try {
    const report = await automation.collect({ probeChat: true, trigger: 'unit-test' });
    assert.equal(report.healthy, true, 'health status ok');
    assert.equal(report.version, '1.0.0', 'gateway version is reported');
    assert.equal(report.modelCount, 2, 'model registry is counted');
    assert.equal(report.fallbackActive, true, 'auto-fallback feature is detected');
    assert.equal(report.probe.ok, true, 'chat probe succeeds');
    assert.equal(report.probe.reply, 'siap', 'chat probe reply is captured');
    assert.equal(report.error, '', 'no collection error');

    const delivery = await automation.deliver(report);
    assert.equal(delivery.sent, true, 'KRA accepted the signed event');
    assert.equal(received?.valid, true, 'HMAC signature matches the raw body');
    assert.equal(received?.source, 'rna-router', 'event source header is set');
    assert.equal(received?.body?.source, 'rna-router', 'payload identifies the source');
    assert.equal(received?.body?.modelCount, 2, 'payload carries the model count');
    assert.equal(received?.body?.webhookSecret, undefined, 'no secrets are forwarded');

    // Wrong secret must produce a different signature.
    const bad = await automation.deliver(report, { secret: 'wrong-secret' });
    assert.equal(bad.sent, false, 'KRA rejects a bad signature');
    assert.equal(received?.valid, false, 'last received signature is invalid');

    // Without a secret the automation stays in dry-run mode.
    const dry = await automation.deliver(report, { secret: '' });
    assert.equal(dry.sent, false, 'missing secret does not attempt a POST');
    assert.equal(dry.reason.includes('KRA_EVENT_SECRET'), true, 'dry-run reason is explicit');
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await close(gateway.server);
    await close(kra.server);
  }
});

test('credential-bearing URLs are rejected before any request is made', () => {
  assert.throws(() => automation.safeHttpUrl('http://user:pass@example.test'), /http:\/\/ atau https:\/\//);
  assert.throws(() => automation.safeHttpUrl('ftp://example.test'), /http:\/\/ atau https:\/\//);
  assert.equal(automation.safeHttpUrl('', 'http://127.0.0.1:3000').href, 'http://127.0.0.1:3000/');
});
