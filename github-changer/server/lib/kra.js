'use strict';

/**
 * Jembatan GitHub Changer -> Kantor-Rama-AI (KRA).
 *
 * Tambahan lokal KRA di atas snapshot upstream `turtrsst/github-changer`.
 * Dua hal yang disediakan:
 *
 *  1. Endpoint mesin-ke-mesin `/api/kra/*` yang diamankan `x-api-key`
 *     (`KRA_GHC_API_KEY`), dipakai `api/lib/KraGitHubChangerClient.php` di KRA.
 *     Tidak memakai sesi OAuth browser, jadi PHP bisa memanggilnya walau belum
 *     ada akun GitHub yang login di dashboard.
 *  2. Notifikasi keluar bertanda tangan HMAC-SHA256 ke
 *     `api/index.php?action=github-changer-event` setiap automasi selesai,
 *     supaya panel KRA tahu kapan `git pull` terakhir berjalan.
 *
 * Semua rahasia hanya dibaca dari environment proses Node, tidak pernah
 * dikirim ke browser, tidak pernah ditulis ke log.
 */
import crypto from 'node:crypto';

const DEFAULT_EVENT_URL = 'http://127.0.0.1:8088/api/index.php?action=github-changer-event';
const SECRET_KEY_PATTERN = /(secret|token|password|apikey|api_key|authorization|cookie)/i;

function env(name) {
  return String(process.env[name] || '').trim();
}

function digest(value) {
  return crypto.createHash('sha256').update(value).digest();
}

export function kraBridgeEnabled() {
  return env('KRA_GHC_API_KEY') !== '';
}

/** Perbandingan waktu-konstan terhadap `x-api-key` dari server KRA. */
export function verifyKraKey(req) {
  const expected = env('KRA_GHC_API_KEY');
  const given = String(req.headers['x-api-key'] || '').trim();
  if (!expected || !given) return false;
  return crypto.timingSafeEqual(digest(expected), digest(given));
}

/** Konfigurasi automasi tanpa nilai rahasia (aman dikirim ke KRA / bootstrap). */
export function redactedAutomation(automation = {}) {
  return {
    enabled: Boolean(automation.enabled),
    intervalMinutes: Number(automation.intervalMinutes) || 0,
    action: String(automation.action || ''),
    branch: String(automation.branch || ''),
    onlyClean: Boolean(automation.onlyClean),
    webhookEnabled: Boolean(automation.webhookEnabled),
    webhookSecretSet: Boolean(automation.webhookSecret),
    webhookRepository: String(automation.webhookRepository || ''),
    webhookBranch: String(automation.webhookBranch || ''),
    webhookAction: String(automation.webhookAction || ''),
    deployCommandSet: Boolean(automation.deployCommand),
    reposConfigured: Array.isArray(automation.repos) ? automation.repos.length : 0,
  };
}

/** Buang kredensial yang mungkin tertanam di URL remote Git. */
export function safeRemoteUrl(value) {
  return String(value || '').replace(/^(https?:\/\/)[^/@\s]+@/i, '$1***@');
}

/** Buang kunci rahasia dari objek respons sebelum dikirim ke KRA. */
export function redactKeys(value, depth = 0) {
  if (depth > 6) return null;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redactKeys(item, depth + 1));
  if (!value || typeof value !== 'object') return value;
  const clean = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key)) continue;
    clean[key] = redactKeys(item, depth + 1);
  }
  return clean;
}

export function kraEventEnabled() {
  return env('KRA_GHC_EVENT_SECRET') !== '' && safeEventUrl() !== '';
}

function safeEventUrl() {
  const raw = env('KRA_GHC_EVENT_URL') || DEFAULT_EVENT_URL;
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

let lastEventResult = { sent: false, reason: 'not-run' };

export function kraEventState() {
  return { ...lastEventResult, enabled: kraEventEnabled() };
}

/**
 * Kirim ringkasan hasil automasi ke KRA. Best-effort: kegagalan KRA tidak
 * boleh menggagalkan `git pull` / webhook. Jangan pernah log URL atau secret.
 */
export async function notifyKra(event = {}) {
  const secret = env('KRA_GHC_EVENT_SECRET');
  const url = safeEventUrl();
  if (!secret || !url) {
    lastEventResult = { sent: false, reason: 'disabled', at: new Date().toISOString() };
    return lastEventResult;
  }
  const payload = {
    source: 'github-changer',
    type: 'automation',
    at: new Date().toISOString(),
    ...redactKeys(event),
  };
  let raw;
  try {
    raw = JSON.stringify(payload);
  } catch {
    lastEventResult = { sent: false, reason: 'payload', at: payload.at };
    return lastEventResult;
  }
  const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-KRA-Signature': signature,
        'X-KRA-Source': 'github-changer',
      },
      body: raw,
      signal: AbortSignal.timeout(4000),
    });
    // Drain the response so keep-alive sockets are not left dangling.
    try { await response.arrayBuffer(); } catch { /* ignore */ }
    lastEventResult = { sent: true, status: response.status, at: payload.at };
  } catch {
    lastEventResult = { sent: false, reason: 'unreachable', at: payload.at };
  }
  return lastEventResult;
}
