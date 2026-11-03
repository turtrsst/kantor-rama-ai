#!/usr/bin/env node
'use strict';

/**
 * Automation RNA Router -> KRA (tambahan bundle KRA, zero dependency).
 *
 * Tanpa memasang Next.js pun script ini bisa jalan: ia hanya memanggil HTTP
 * gateway RNA Router lalu mengirim ringkasan bertanda tangan HMAC-SHA256 ke
 * `api/index.php?action=rna-router-event` di server PHP KRA. KRA menyimpan
 * event terakhir dan menampilkannya di panel RNA Router.
 *
 *   node scripts/kra-automation.js --once
 *   node scripts/kra-automation.js --interval=15 --probe-chat
 *
 * Environment:
 *   RNA_ROUTER_URL           default http://127.0.0.1:3000
 *   RNA_ROUTER_API_KEY       opsional, dikirim sebagai x-api-key
 *   RNA_AUTOMATION_MODEL     default muse-spark-1.2-free (dipakai --probe-chat)
 *   KRA_EVENT_URL            default http://127.0.0.1:8088/api/index.php?action=rna-router-event
 *   KRA_EVENT_SECRET         WAJIB untuk mengirim; kosong = hanya cetak laporan.
 *                           Diisi otomatis dari .kra-secrets.env oleh pair-kra.js.
 *   KRA_EVENT_TIMEOUT_MS     default 5000
 */
const crypto = require('node:crypto');
// Muat .kra-secrets.env (dibuat Pair KRA Event Secret.bat). Environment
// proses tetap menang; lihat scripts/kra-env.js.
require('./kra-env.js').loadKraEnv();

const DEFAULT_GATEWAY = 'http://127.0.0.1:3000';
const DEFAULT_EVENT_URL = 'http://127.0.0.1:8088/api/index.php?action=rna-router-event';
const DEFAULT_MODEL = 'muse-spark-1.2-free';

function safeHttpUrl(value, fallback) {
  const raw = String(value || '').trim() || fallback;
  try {
    const url = new URL(raw);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) {
      throw new Error('scheme');
    }
    return url;
  } catch {
    throw new Error('URL harus http:// atau https:// tanpa kredensial tertanam: ' + raw);
  }
}

function config() {
  return {
    gateway: safeHttpUrl(process.env.RNA_ROUTER_URL, DEFAULT_GATEWAY),
    eventUrl: safeHttpUrl(process.env.KRA_EVENT_URL, DEFAULT_EVENT_URL),
    apiKey: String(process.env.RNA_ROUTER_API_KEY || '').trim(),
    secret: String(process.env.KRA_EVENT_SECRET || '').trim(),
    model: String(process.env.RNA_AUTOMATION_MODEL || DEFAULT_MODEL).trim(),
    timeout: Math.max(1000, Number(process.env.KRA_EVENT_TIMEOUT_MS) || 5000),
  };
}

async function getJson(url, { apiKey = '', timeout = 6000, method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
  });
  let data = null;
  try { data = await response.json(); } catch { /* body bukan JSON */ }
  return { ok: response.ok, status: response.status, data };
}

/** Kumpulkan health + daftar model; semua kegagalan dilaporkan, tidak dilempar. */
async function collect(options = {}) {
  const cfg = config();
  const timeout = options.timeout || 6000;
  const report = {
    source: 'rna-router',
    type: 'automation',
    at: new Date().toISOString(),
    trigger: options.trigger || 'schedule',
    gateway: cfg.gateway.origin,
    healthy: false,
    version: '',
    features: [],
    modelCount: 0,
    models: [],
    fallbackActive: false,
    probe: null,
    error: '',
  };
  try {
    const health = await getJson(new URL('/api/health', cfg.gateway), { apiKey: cfg.apiKey, timeout });
    if (health.ok && health.data) {
      report.healthy = String(health.data.status || '').toLowerCase() === 'ok';
      report.version = String(health.data.version || '');
      report.features = Array.isArray(health.data.features) ? health.data.features.slice(0, 12).map(String) : [];
    } else {
      report.error = 'health HTTP ' + health.status;
    }
    const models = await getJson(new URL('/api/v1/models', cfg.gateway), { apiKey: cfg.apiKey, timeout });
    if (models.ok && Array.isArray(models.data?.data)) {
      report.modelCount = models.data.data.length;
      report.models = models.data.data.slice(0, 20).map((item) => ({
        id: String(item?.id || item?.model || ''),
        provider: String(item?.provider || ''),
      }));
      // Auto-fallback aktif bila gateway melaporkan fitur tersebut.
      report.fallbackActive = report.features.some((f) => f.includes('fallback'));
    } else if (!report.error) {
      report.error = 'models HTTP ' + models.status;
    }
    if (options.probeChat && report.healthy) {
      const probe = await getJson(new URL('/api/v1/chat/completions', cfg.gateway), {
        apiKey: cfg.apiKey,
        timeout: Math.max(timeout, 20000),
        method: 'POST',
        body: {
          model: options.model || cfg.model,
          messages: [{ role: 'user', content: 'Balas tepat satu kata: siap' }],
          temperature: 0,
          max_tokens: 16,
        },
      });
      report.probe = {
        ok: probe.ok,
        status: probe.status,
        model: options.model || cfg.model,
        reply: probe.ok ? String(probe.data?.choices?.[0]?.message?.content || '').slice(0, 120) : '',
      };
    }
  } catch (error) {
    report.error = String(error.message || error).slice(0, 300);
  }
  return report;
}

function sign(payload, secret) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/** Kirim laporan ke KRA. Tanpa secret, laporan hanya dicetak (mode kering). */
async function deliver(report, options = {}) {
  const cfg = config();
  const url = options.eventUrl ? safeHttpUrl(options.eventUrl, DEFAULT_EVENT_URL) : cfg.eventUrl;
  const secret = options.secret !== undefined ? String(options.secret) : cfg.secret;
  const raw = JSON.stringify(report);
  if (!secret) return { sent: false, reason: 'KRA_EVENT_SECRET belum diset', report };
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-KRA-Signature': sign(raw, secret),
      'X-KRA-Source': 'rna-router',
    },
    body: raw,
    signal: AbortSignal.timeout(options.timeout || cfg.timeout),
  });
  let data = null;
  try { data = await response.json(); } catch { /* abaikan */ }
  return { sent: response.ok, status: response.status, reason: data?.error || '', report };
}

async function runOnce(options = {}) {
  const report = await collect(options);
  const delivery = await deliver(report, options);
  return { report, delivery };
}

function parseArgs(argv) {
  const flags = { once: false, probeChat: false, interval: 15, help: false };
  for (const arg of argv) {
    if (arg === '--once') flags.once = true;
    else if (arg === '--probe-chat') flags.probeChat = true;
    else if (arg === '--help' || arg === '-h') flags.help = true;
    else if (arg.startsWith('--interval=')) flags.interval = Math.max(1, Number(arg.slice(11)) || 15);
  }
  return flags;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    console.log('RNA Router -> KRA automation\n  --once          satu kali lalu keluar\n  --interval=N    menit antar run (default 15)\n  --probe-chat    kirim satu chat completion sebagai uji hidup\n  Env: RNA_ROUTER_URL, RNA_ROUTER_API_KEY, KRA_EVENT_URL, KRA_EVENT_SECRET');
    return;
  }
  const tick = async () => {
    try {
      const { report, delivery } = await runOnce({ probeChat: flags.probeChat });
      console.log(`[RNA automation] ${report.at} healthy=${report.healthy} models=${report.modelCount} sent=${delivery.sent}${delivery.reason ? ' (' + delivery.reason + ')' : ''}${report.error ? ' error=' + report.error : ''}`);
    } catch (error) {
      console.error('[RNA automation] ' + String(error.message || error));
    }
  };
  await tick();
  if (flags.once) return;
  console.log(`[RNA automation] Berjalan tiap ${flags.interval} menit. Ctrl+C untuk berhenti.`);
  const timer = setInterval(tick, flags.interval * 60 * 1000);
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => { clearInterval(timer); console.log('[RNA automation] Berhenti.'); process.exit(0); });
  }
}

if (require.main === module) {
  main().catch((error) => { console.error('[RNA automation] ' + String(error.message || error)); process.exit(1); });
}

module.exports = { config, safeHttpUrl, collect, deliver, runOnce, sign };
