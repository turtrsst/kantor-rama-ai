import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const EMPTY_BODY_HASH = createHash('sha256').update(Buffer.alloc(0)).digest('base64url');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Public RFC 8032 synthetic test vector from exness/bin/exness-readonly.mjs
const TEST_VECTOR = {
  privateKeyHex:
    '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a',
  privateKeyPem: [
    '-----BEGIN PRIVATE KEY-----',
    'MC4CAQAwBQYDK2VwBCIEIJ1hsZ3v/VpguoRK9JLsLMREScVpezJpGXA7rAMcrn9g',
    '-----END PRIVATE KEY-----'
  ].join('\n'),
  apiKey: 'exnsk-synthetic-example',
  timestamp: 1773656070123,
  path: '/v1/trading/access-point?account_id=123456',
  expectedData:
    'eyJhcGlfa2V5IjoiZXhuc2stc3ludGhldGljLWV4YW1wbGUiLCJpZGVtcG90ZW5jeV9rZXkiOiIiLCJ0aW1lc3RhbXAiOjE3NzM2NTYwNzAxMjMsInNpZ25fdmVyc2lvbiI6MSwibWV0aG9kIjoiR0VUIiwicGF0aCI6Ii92MS90cmFkaW5nL2FjY2Vzcy1wb2ludD9hY2NvdW50X2lkPTEyMzQ1NiIsImJvZHlfaGFzaCI6IjQ3REVRcGo4SEJTYS1fVEltVy01SkNldVFlUmttNU5NcEpXWkczaFN1RlUifQ',
  expectedSign:
    'l-H_Acia8YoTjKFMg-3fon3NOEX8TalNVA7c01DQ9dHb7pVBJC4y06qC-DbpETzh1KToiOprqEV6uzN3t69ICQ'
};

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function getSecretStorePath(rootDir) {
  return path.join(rootDir, '.kra-secrets.json');
}

function getEnvLocalPath(rootDir) {
  return path.join(rootDir, '.kra-env.local');
}

function getAccessPointCachePath(rootDir, profile) {
  return path.join(rootDir, 'exness', `.access-point.${profile}.json`);
}

async function readSecretFile(rootDir) {
  const filePath = getSecretStorePath(rootDir);
  try {
    const raw = await fsp.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      exness: {
        demo: parsed?.exness?.demo ?? {},
        real: parsed?.exness?.real ?? {}
      },
      integrations: parsed?.integrations ?? {}
    };
  } catch {
    return {
      exness: { demo: {}, real: {} },
      integrations: {}
    };
  }
}

async function writeSecretFile(rootDir, data) {
  const filePath = getSecretStorePath(rootDir);
  await fsp.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });

  const envLines = ['# Local server-side KRA secrets (git-ignored, never exposed to browser)'];
  const emitExn = (prefix, c) => {
    if (c.apiKey) envLines.push(`${prefix}_API_KEY=${JSON.stringify(c.apiKey)}`);
    if (c.privateKey) envLines.push(`${prefix}_PRIVATE_KEY=${JSON.stringify(c.privateKey)}`);
    if (c.accountId) envLines.push(`${prefix}_ACCOUNT_ID=${JSON.stringify(c.accountId)}`);
    if (c.discoveryBaseUrl) envLines.push(`${prefix}_DISCOVERY_BASE_URL=${JSON.stringify(c.discoveryBaseUrl)}`);
    if (c.expiryDate) envLines.push(`${prefix}_EXPIRY_DATE=${JSON.stringify(c.expiryDate)}`);
  };
  emitExn('EXN_DEMO', data.exness.demo);
  emitExn('EXN_REAL', data.exness.real);
  if (data.integrations.nineRouterUrl) envLines.push(`KRA_9ROUTER_URL=${JSON.stringify(data.integrations.nineRouterUrl)}`);
  if (data.integrations.nineRouterKey) envLines.push(`KRA_9ROUTER_KEY=${JSON.stringify(data.integrations.nineRouterKey)}`);
  if (data.integrations.freeLlmApiUrl) envLines.push(`KRA_FREELLMAPI_URL=${JSON.stringify(data.integrations.freeLlmApiUrl)}`);
  if (data.integrations.freeLlmApiKey) envLines.push(`KRA_FREELLMAPI_KEY=${JSON.stringify(data.integrations.freeLlmApiKey)}`);
  if (data.integrations.n8nWebhookUrl) envLines.push(`KRA_N8N_WEBHOOK_URL=${JSON.stringify(data.integrations.n8nWebhookUrl)}`);
  if (data.integrations.voiceboxUrl) envLines.push(`KRA_VOICEBOX_URL=${JSON.stringify(data.integrations.voiceboxUrl)}`);
  if (data.integrations.youtubeChannel) envLines.push(`KRA_YT_CHANNEL=${JSON.stringify(data.integrations.youtubeChannel)}`);
  if (data.integrations.youtubeClientId) envLines.push(`KRA_YT_CLIENT_ID=${JSON.stringify(data.integrations.youtubeClientId)}`);
  if (data.integrations.youtubeClientSecret) envLines.push(`KRA_YT_CLIENT_SECRET=${JSON.stringify(data.integrations.youtubeClientSecret)}`);
  await fsp.writeFile(getEnvLocalPath(rootDir), envLines.join('\n') + '\n', { mode: 0o600 });
}

function getEffectiveExnessCreds(profile, stored) {
  const prefix = profile === 'demo' ? 'EXN_DEMO' : 'EXN_REAL';
  const envCreds = {
    apiKey: process.env[`${prefix}_API_KEY`] || stored.apiKey,
    privateKey: process.env[`${prefix}_PRIVATE_KEY`] || stored.privateKey,
    accountId: process.env[`${prefix}_ACCOUNT_ID`] || stored.accountId,
    discoveryBaseUrl: process.env[`${prefix}_DISCOVERY_BASE_URL`] || stored.discoveryBaseUrl,
    expiryDate: process.env[`${prefix}_EXPIRY_DATE`] || stored.expiryDate
  };
  const hasEnv = !!(process.env[`${prefix}_API_KEY`] && process.env[`${prefix}_PRIVATE_KEY`]);
  const hasAny = !!(envCreds.apiKey && envCreds.privateKey && envCreds.accountId && envCreds.discoveryBaseUrl);
  return {
    ...envCreds,
    source: hasEnv ? 'env' : hasAny ? 'store' : 'unconfigured'
  };
}

function maskTail(val, keep = 4) {
  if (!val) return null;
  if (val.length <= keep) return '****';
  return `••••${val.slice(-keep)}`;
}

// =====================================================================
// EXACT EXNESS ED25519 SIGNING PORTED FROM exness/bin/exness-readonly.mjs
// =====================================================================
export function loadSigningKey(text) {
  const input = String(text || '').trim();
  let key;
  if (input.startsWith('-----BEGIN PRIVATE KEY-----')) {
    key = createPrivateKey(input);
  } else {
    if (!/^[0-9a-fA-F]{128}$/.test(input)) {
      throw new Error('Expected 128 hex characters or unencrypted PKCS#8 PEM');
    }
    const raw = Buffer.from(input, 'hex');
    key = createPrivateKey({
      key: Buffer.concat([
        Buffer.from('302e020100300506032b657004220420', 'hex'),
        raw.subarray(0, 32)
      ]),
      format: 'der',
      type: 'pkcs8'
    });
    const publicJwk = createPublicKey(key).export({ format: 'jwk' });
    if (!Buffer.from(publicJwk.x ?? '', 'base64url').equals(raw.subarray(32))) {
      throw new Error('Private key public half does not match its seed');
    }
  }
  if (key.asymmetricKeyType !== 'ed25519') {
    throw new Error('Expected an Ed25519 private key');
  }
  return key;
}

export function validateHttpsOrigin(value) {
  const url = new URL(String(value || '').trim());
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('Expected an HTTPS base URL without credentials, path, query or fragment');
  }
  return url.origin;
}

export function validateAccountId(accountId) {
  const clean = String(accountId || '').trim();
  if (!/^[1-9][0-9]*$/.test(clean) || BigInt(clean) > 18446744073709551615n) {
    throw new Error('Account ID must be a positive uint64 decimal string');
  }
  return clean;
}

export function signedGetHeaders(apiKey, privateKey, pathWithQuery, timestamp = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({
      api_key: apiKey,
      idempotency_key: '',
      timestamp,
      sign_version: 1,
      method: 'GET',
      path: pathWithQuery,
      body_hash: EMPTY_BODY_HASH
    }),
    'utf8'
  );
  return {
    'EXN-API-KEY': apiKey,
    'EXN-IDEMPOTENCY-KEY': '',
    'EXN-TIMESTAMP': String(timestamp),
    'EXN-SIGN-VERSION': '1',
    'EXN-DATA': payload.toString('base64url'),
    'EXN-SIGN': sign(null, payload, privateKey).toString('base64url')
  };
}

export function runSigningSelfTest() {
  const checks = [];
  const keyFromHex = loadSigningKey(TEST_VECTOR.privateKeyHex);
  const headers = signedGetHeaders(
    TEST_VECTOR.apiKey,
    keyFromHex,
    TEST_VECTOR.path,
    TEST_VECTOR.timestamp
  );
  checks.push({ name: 'EXN-DATA (hex key)', pass: headers['EXN-DATA'] === TEST_VECTOR.expectedData });
  checks.push({ name: 'EXN-SIGN (hex key)', pass: headers['EXN-SIGN'] === TEST_VECTOR.expectedSign });

  const keyFromPem = loadSigningKey(TEST_VECTOR.privateKeyPem);
  const pemHeaders = signedGetHeaders(
    TEST_VECTOR.apiKey,
    keyFromPem,
    TEST_VECTOR.path,
    TEST_VECTOR.timestamp
  );
  checks.push({ name: 'EXN-SIGN (PEM key)', pass: pemHeaders['EXN-SIGN'] === TEST_VECTOR.expectedSign });

  let rejected = false;
  try {
    const tampered = TEST_VECTOR.privateKeyHex.slice(0, 64) + '00'.repeat(32);
    loadSigningKey(tampered);
  } catch (err) {
    rejected = err instanceof Error && err.message === 'Private key public half does not match its seed';
  }
  checks.push({ name: 'tampered public half rejected', pass: rejected });

  let baseRejected = false;
  try {
    validateHttpsOrigin('http://gateway.example');
  } catch (err) {
    baseRejected = err instanceof Error && err.message.startsWith('Expected an HTTPS base URL');
  }
  checks.push({ name: 'non-HTTPS base URL rejected', pass: baseRejected });

  return {
    passedCount: checks.filter((c) => c.pass).length,
    totalCount: checks.length,
    allPassed: checks.every((c) => c.pass),
    checks
  };
}

function formatExnessHttpError(status, bodyText) {
  if (status === 401) {
    if (bodyText && bodyText.includes('1001')) {
      return 'HTTP 401 (1001): Signature tidak valid — cek format private key Ed25519 dan sinkronisasi jam server.';
    }
    return 'HTTP 401 (1000/Auth): Key tidak valid, kedaluwarsa, atau IP server belum ada di Allowed IPs Exness.';
  }
  if (status === 404) {
    return 'HTTP 404 (2000): Account ID tidak ditemukan atau bukan milik API Key ini.';
  }
  if (status === 429) {
    return 'HTTP 429: Rate limit tercapai — tunggu sejenak lalu ulangi (cache Access Point aktif 24 jam).';
  }
  return `HTTP ${status}: Gagal menghubungi API Exness.`;
}

async function exnessReadOnlyGet(host, pathWithQuery, apiKey, privateKey) {
  const response = await fetch(host + pathWithQuery, {
    method: 'GET',
    headers: signedGetHeaders(apiKey, privateKey, pathWithQuery),
    redirect: 'error',
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new Error(formatExnessHttpError(response.status, bodyText));
  }
  return response.json();
}

async function discoverAccessPoint(rootDir, profile, apiKey, privateKey, accountId, gateway, forceRefresh) {
  const cacheFile = getAccessPointCachePath(rootDir, profile);
  if (!forceRefresh) {
    try {
      const cached = JSON.parse(await fsp.readFile(cacheFile, 'utf8'));
      if (
        cached.account_id === accountId &&
        typeof cached.access_point === 'string' &&
        typeof cached.discovered_at === 'number' &&
        Date.now() - cached.discovered_at < CACHE_TTL_MS
      ) {
        return { accessPoint: validateHttpsOrigin(cached.access_point), fromCache: true };
      }
    } catch {
      // ignore missing/stale cache
    }
  }

  const discovery = await exnessReadOnlyGet(
    gateway,
    `/v1/trading/access-point?account_id=${accountId}`,
    apiKey,
    privateKey
  );
  if (typeof discovery.access_point !== 'string' || !discovery.access_point) {
    throw new Error('Discovery response missing access_point');
  }
  const accessPoint = validateHttpsOrigin(discovery.access_point);
  await fsp.writeFile(
    cacheFile,
    JSON.stringify({ account_id: accountId, access_point: accessPoint, discovered_at: Date.now() }, null, 2) + '\n',
    { mode: 0o600 }
  );
  return { accessPoint, fromCache: false };
}

async function loadKraRosterFromDisk(rootDir) {
  const kraMain = JSON.parse(await fsp.readFile(path.join(rootDir, 'agents', 'kra-agents.json'), 'utf8'));
  const skillManifest = JSON.parse(await fsp.readFile(path.join(rootDir, 'skills', 'manifest.json'), 'utf8'));
  const financeFiles = ['sandi.json', 'mael.json', 'jarjit.json'];
  const financeAgents = await Promise.all(
    financeFiles.map(async (file) => JSON.parse(await fsp.readFile(path.join(rootDir, 'finance', file), 'utf8')))
  );

  const personaDir = path.join(rootDir, 'agents', 'personas');
  const personas = {};
  try {
    const entries = await fsp.readdir(personaDir);
    for (const file of entries) {
      if (file.endsWith('.md')) {
        personas[file.replace(/\.md$/, '')] = await fsp.readFile(path.join(personaDir, file), 'utf8');
      }
    }
  } catch {
    // ignore
  }

  const extraSkillsDir = path.join(rootDir, 'skills-extra-meimei');
  const extraSkills = [];
  try {
    const entries = await fsp.readdir(extraSkillsDir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) extraSkills.push(e.name);
    }
  } catch {
    // ignore
  }

  return {
    office: kraMain.office,
    abbreviation: kraMain.abbreviation,
    hierarchy: kraMain.hierarchy,
    kraAgents: kraMain.agents,
    financeAgents,
    personas,
    skillsManifest: {
      package: skillManifest.package,
      generated: skillManifest.generated,
      counts: skillManifest.counts,
      catalogOnly: skillManifest.catalog_only_not_in_this_package,
      extraMeimeiSkills: extraSkills
    }
  };
}

async function readSkillMarkdown(rootDir, skillName) {
  const safeName = String(skillName || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeName) return null;

  const candidates = [
    path.join(rootDir, 'skills', safeName, 'SKILL.md'),
    path.join(rootDir, 'skills-extra-meimei', safeName, 'SKILL.md')
  ];
  for (const cand of candidates) {
    if (fs.existsSync(cand)) {
      let content = await fsp.readFile(cand, 'utf8');
      content = content.replace(/~\/workspace\/custom-skills\//g, 'skills/');
      return {
        skillName: safeName,
        sourcePath: path.relative(rootDir, cand),
        content
      };
    }
  }
  return null;
}

const GROUP_CHAT_BOT_IDS = ['rama', 'marta', 'nara', 'raga', 'putri', 'aruna', 'meimei', 'fizi'];

function pickRespondingBots(message) {
  const lower = message.toLowerCase();
  const mentioned = GROUP_CHAT_BOT_IDS.filter((id) => new RegExp(`(@${id}\\b|\\b${id}\\b)`, 'i').test(lower));
  if (mentioned.length > 0) return mentioned;
  if (/(naskah|script|hook|revisi|approve|cta)/.test(lower)) return ['putri', 'rama'];
  if (/(edit|video|remotion|shotcraft|voicebox|render|desain)/.test(lower)) return ['raga', 'meimei'];
  if (/(qa|kualitas|cek|frame|defect|pass|revise)/.test(lower)) return ['meimei', 'marta'];
  if (/(publish|upload|seo|trend|ctr|retensi|analitik)/.test(lower)) return ['aruna', 'fizi'];
  if (/(komentar|audiens|sosmed|tiktok|threads|komunitas)/.test(lower)) return ['fizi'];
  if (/(bug|kode|backend|server|audit|api|keamanan)/.test(lower)) return ['nara', 'rama'];
  if (/(kejar|deadline|status|lapor|motivasi|tugas)/.test(lower)) return ['marta'];
  return ['rama', 'marta'];
}

function generateLocalPersonaReply(botId, userMessage) {
  switch (botId) {
    case 'rama':
      return `Siap, Yang Mulia. Arahan "${userMessage.slice(0, 72)}" saya catat ke Project Registry. MARTA, kawal eksekusi sesuai hierarki. Risiko utama: jangan bypass approval gate PUTRI dan QA gate MEIMEI.`;
    case 'marta':
      return `Siap Komandan & Yang Mulia! Saya sudah pantau papan tugas: semua staf wajib lapor progres nyata tanpa angka karangan. Ayo NARA, PUTRI, RAGA, MEIMEI, ARUNA, FIZI — tuntaskan jalur masing-masing!`;
    case 'nara':
      return `Yang Mulia, laporan teknis NARA: arsitektur server-side Exness read-only + 2.5D Three.js berjalan bersih. Semua kredensial tersimpan di server, tidak ada endpoint trading atau kebocoran ke browser.`;
    case 'putri':
      return `Siap Yang Mulia. Naskah baru selalu saya siapkan dengan 5 hook terukur, skrip per-scene, caption, dan CTA — dan tidak akan pernah lanjut ke RAGA sebelum Yang Mulia menyetujui: ship it, or change it?`;
    case 'raga':
      return `Siap laksanakan, Yang Mulia! 🎬 Pipeline editing, Shotcraft & Voicebox siap jalan begitu naskah PUTRI di-approve. Catatan: Remotion tetap khusus Yang Mulia ya, dan humor receh selalu on standby.`;
    case 'aruna':
      return `Baik Yang Mulia! ARUNA siap olah brief tren & paket publish (SEO, judul terukur, deskripsi). Status YouTube upload saat ini tetap Siap Terbit — tidak ada angka analitik palsu sebelum data asli masuk.`;
    case 'meimei':
      return `Yang Mulia, QA Gate MEIMEI aktif: "Lulus, atau perbaiki." Tidak ada render RAGA yang boleh masuk ke ARUNA tanpa checklist frame + audio PASS tanpa defect BLOCKER/MAJOR.`;
    case 'fizi':
      return `Hadir Yang Mulia! 💬 FIZI siap merespons komentar penonton di YouTube, TikTok, dan Threads setelah konten lolos QA MEIMEI & terbit lewat ARUNA. Setiap komentar itu penonton yang bicara!`;
    default:
      return 'Siap, Yang Mulia.';
  }
}

async function tryFreeLlmReply(botId, userMessage, personaText, settings) {
  const url = settings.nineRouterUrl || settings.freeLlmApiUrl;
  const key = settings.nineRouterKey || settings.freeLlmApiKey;
  if (!url) return null;

  const endpoint = url.replace(/\/+$/, '') + (url.includes('/chat/completions') ? '' : '/v1/chat/completions');
  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { Authorization: `Bearer ${key}` } : {})
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Kamu adalah agen ${botId.toUpperCase()} di Kantor Rama AI (KRA). Balas singkat dalam Bahasa Indonesia sesuai karaktermu, sapa pemilik dengan "Yang Mulia", dan jangan mengarang angka/analitik palsu.\n\nPersona:\n${personaText.slice(0, 1200)}`
          },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 220,
        temperature: 0.6
      }),
      signal: AbortSignal.timeout(10000)
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    return {
      reply: text,
      provider: settings.nineRouterUrl ? '9router' : 'freellmapi'
    };
  } catch {
    return null;
  }
}

export function createKraApiHandler(rootDir) {
  return async function handleKraApi(req, res, next) {
    const reqUrl = new URL(req.url || '/', 'http://localhost');
    if (!reqUrl.pathname.startsWith('/api/')) {
      return next();
    }

    try {
      if (req.method === 'GET' && reqUrl.pathname === '/api/kra/roster') {
        const roster = await loadKraRosterFromDisk(rootDir);
        return sendJson(res, 200, roster);
      }

      if (req.method === 'GET' && reqUrl.pathname === '/api/kra/skill') {
        const name = reqUrl.searchParams.get('name') || '';
        const skill = await readSkillMarkdown(rootDir, name);
        if (!skill) {
          return sendJson(res, 404, {
            error: `Skill "${name}" tidak ditemukan di skills/ atau skills-extra-meimei/.`
          });
        }
        return sendJson(res, 200, skill);
      }

      if (req.method === 'GET' && reqUrl.pathname === '/api/exness/status') {
        const store = await readSecretFile(rootDir);
        const buildProfileStatus = (profile) => {
          const eff = getEffectiveExnessCreds(profile, store.exness[profile]);
          return {
            profile,
            configured: eff.source !== 'unconfigured',
            source: eff.source,
            apiKeyLast4: maskTail(eff.apiKey, 4),
            accountIdMasked: maskTail(eff.accountId, 4),
            discoveryBaseUrl: eff.discoveryBaseUrl ?? null,
            expiryDate: eff.expiryDate ?? null
          };
        };
        return sendJson(res, 200, {
          demo: buildProfileStatus('demo'),
          real: buildProfileStatus('real'),
          readOnlyEnforced: true,
          note: 'Server-side Ed25519 read-only only. Private key never returned to browser.'
        });
      }

      if (req.method === 'POST' && reqUrl.pathname === '/api/exness/save') {
        const body = await readBody(req);
        const profile = body.profile === 'real' ? 'real' : 'demo';
        const apiKey = String(body.apiKey || '').trim();
        const privateKey = String(body.privateKey || '').trim();
        const accountId = validateAccountId(String(body.accountId || ''));
        const discoveryBaseUrl = validateHttpsOrigin(String(body.discoveryBaseUrl || ''));
        const expiryDate = String(body.expiryDate || '').trim() || undefined;

        if (!apiKey) throw new Error('API Key wajib diisi.');
        loadSigningKey(privateKey);

        const store = await readSecretFile(rootDir);
        store.exness[profile] = { apiKey, privateKey, accountId, discoveryBaseUrl, expiryDate };
        await writeSecretFile(rootDir, store);

        const prefix = profile === 'demo' ? 'EXN_DEMO' : 'EXN_REAL';
        process.env[`${prefix}_API_KEY`] = apiKey;
        process.env[`${prefix}_PRIVATE_KEY`] = privateKey;
        process.env[`${prefix}_ACCOUNT_ID`] = accountId;
        process.env[`${prefix}_DISCOVERY_BASE_URL`] = discoveryBaseUrl;

        return sendJson(res, 200, {
          ok: true,
          profile,
          configured: true,
          apiKeyLast4: maskTail(apiKey, 4),
          accountIdMasked: maskTail(accountId, 4),
          discoveryBaseUrl,
          expiryDate: expiryDate ?? null
        });
      }

      if (req.method === 'POST' && reqUrl.pathname === '/api/exness/delete') {
        const body = await readBody(req);
        const profile = body.profile === 'real' ? 'real' : 'demo';
        const store = await readSecretFile(rootDir);
        store.exness[profile] = {};
        await writeSecretFile(rootDir, store);

        const prefix = profile === 'demo' ? 'EXN_DEMO' : 'EXN_REAL';
        delete process.env[`${prefix}_API_KEY`];
        delete process.env[`${prefix}_PRIVATE_KEY`];
        delete process.env[`${prefix}_ACCOUNT_ID`];
        delete process.env[`${prefix}_DISCOVERY_BASE_URL`];
        delete process.env[`${prefix}_EXPIRY_DATE`];

        try {
          await fsp.unlink(getAccessPointCachePath(rootDir, profile));
        } catch {
          // ignore
        }

        return sendJson(res, 200, { ok: true, profile, configured: false });
      }

      if (req.method === 'POST' && reqUrl.pathname === '/api/exness/test') {
        const body = await readBody(req);
        const profile = body.profile === 'real' ? 'real' : 'demo';
        const refreshDiscovery = Boolean(body.refreshDiscovery);

        const selfTest = runSigningSelfTest();
        const store = await readSecretFile(rootDir);
        const creds = getEffectiveExnessCreds(profile, store.exness[profile]);

        if (
          creds.source === 'unconfigured' ||
          !creds.apiKey ||
          !creds.privateKey ||
          !creds.accountId ||
          !creds.discoveryBaseUrl
        ) {
          return sendJson(res, 200, {
            profile,
            selfTest,
            discovery: {
              status: 'FAIL',
              message: `Profil ${profile.toUpperCase()} belum dikonfigurasi di Settings.`
            },
            accountDetails: {
              status: 'SKIP',
              message: 'Konfigurasikan API Key, Private Key, Account ID, dan Gateway URL terlebih dahulu.'
            }
          });
        }

        try {
          const signingKey = loadSigningKey(creds.privateKey);
          const validatedAccountId = validateAccountId(creds.accountId);
          const validatedGateway = validateHttpsOrigin(creds.discoveryBaseUrl);

          const { accessPoint, fromCache } = await discoverAccessPoint(
            rootDir,
            profile,
            creds.apiKey,
            signingKey,
            validatedAccountId,
            validatedGateway,
            refreshDiscovery
          );

          try {
            const account = await exnessReadOnlyGet(
              accessPoint,
              `/v1/configuration/accounts/${validatedAccountId}/account`,
              creds.apiKey,
              signingKey
            );

            return sendJson(res, 200, {
              profile,
              selfTest,
              discovery: {
                status: 'PASS',
                accessPoint,
                fromCache
              },
              accountDetails: {
                status: 'PASS',
                currency: account.currency ?? null,
                leverage: account.leverage ?? null,
                marginCall: account.margin_call ?? account.margin_call_level ?? null,
                stopOut: account.stop_out ?? account.stop_out_level ?? null,
                balance: account.balance ?? null,
                equity: account.equity ?? null,
                margin: account.margin ?? null,
                freeMargin: account.free_margin ?? null,
                fetchedAt: new Date().toISOString()
              }
            });
          } catch (accErr) {
            return sendJson(res, 200, {
              profile,
              selfTest,
              discovery: {
                status: 'PASS',
                accessPoint,
                fromCache
              },
              accountDetails: {
                status: 'FAIL',
                message: accErr instanceof Error ? accErr.message : 'Gagal membaca detail akun.'
              }
            });
          }
        } catch (discErr) {
          return sendJson(res, 200, {
            profile,
            selfTest,
            discovery: {
              status: 'FAIL',
              message: discErr instanceof Error ? discErr.message : 'Discovery gagal.'
            },
            accountDetails: {
              status: 'SKIP',
              message: 'Account details dilewati karena discovery gagal.'
            }
          });
        }
      }

      if (req.method === 'GET' && reqUrl.pathname === '/api/exness/account') {
        const profile = reqUrl.searchParams.get('profile') === 'real' ? 'real' : 'demo';
        const store = await readSecretFile(rootDir);
        const creds = getEffectiveExnessCreds(profile, store.exness[profile]);
        if (
          creds.source === 'unconfigured' ||
          !creds.apiKey ||
          !creds.privateKey ||
          !creds.accountId ||
          !creds.discoveryBaseUrl
        ) {
          return sendJson(res, 200, { profile, status: 'not_configured', account: null });
        }

        const signingKey = loadSigningKey(creds.privateKey);
        const validatedAccountId = validateAccountId(creds.accountId);
        const validatedGateway = validateHttpsOrigin(creds.discoveryBaseUrl);
        const { accessPoint, fromCache } = await discoverAccessPoint(
          rootDir,
          profile,
          creds.apiKey,
          signingKey,
          validatedAccountId,
          validatedGateway,
          false
        );
        const account = await exnessReadOnlyGet(
          accessPoint,
          `/v1/configuration/accounts/${validatedAccountId}/account`,
          creds.apiKey,
          signingKey
        );
        return sendJson(res, 200, {
          profile,
          status: 'ok',
          fromCache,
          fetchedAt: new Date().toISOString(),
          account: {
            currency: account.currency ?? null,
            leverage: account.leverage ?? null,
            marginCall: account.margin_call ?? account.margin_call_level ?? null,
            stopOut: account.stop_out ?? account.stop_out_level ?? null,
            balance: account.balance ?? null,
            equity: account.equity ?? null,
            margin: account.margin ?? null,
            freeMargin: account.free_margin ?? null
          }
        });
      }

      if (req.method === 'GET' && reqUrl.pathname === '/api/market/btc-live') {
        // Real-only BTC/USDT & BTC/USD live ticker + candlestick hydration (Binance -> Coinbase -> CoinGecko).
        // Zero fabricated prices: returns status 'BELUM DIAMBIL' if all external feeds fail/blocked.
        try {
          const [kResp, tResp] = await Promise.all([
            fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=40', {
              signal: AbortSignal.timeout(4500)
            }),
            fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
              signal: AbortSignal.timeout(4500)
            })
          ]);
          if (kResp.ok) {
            const rawK = await kResp.json();
            const rawT = tResp.ok ? await tResp.json() : null;
            if (Array.isArray(rawK) && rawK.length > 0) {
              const candles = rawK.map((k) => ({
                time: Number(k[0]),
                open: Number(k[1]),
                high: Number(k[2]),
                low: Number(k[3]),
                close: Number(k[4]),
                vol: Number(k[5])
              })).filter((c) => Number.isFinite(c.close) && c.close > 0);
              const price = rawT && Number.isFinite(Number(rawT.lastPrice))
                ? Number(rawT.lastPrice)
                : candles[candles.length - 1]?.close ?? null;
              const change24hPct = rawT && Number.isFinite(Number(rawT.priceChangePercent))
                ? Number(rawT.priceChangePercent)
                : null;
              if (price !== null && candles.length > 0) {
                return sendJson(res, 200, {
                  ok: true,
                  source: 'Binance REST 1m',
                  symbol: 'BTC/USDT',
                  price,
                  change24hPct,
                  candles
                });
              }
            }
          }
        } catch {
          // Try next real feed
        }

        try {
          const [cbCandlesResp, cbTickerResp] = await Promise.all([
            fetch('https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=60', {
              headers: { 'User-Agent': 'kantor-rama-ai' },
              signal: AbortSignal.timeout(4500)
            }),
            fetch('https://api.exchange.coinbase.com/products/BTC-USD/ticker', {
              headers: { 'User-Agent': 'kantor-rama-ai' },
              signal: AbortSignal.timeout(4500)
            })
          ]);
          if (cbCandlesResp.ok) {
            const rawCb = await cbCandlesResp.json();
            const rawTicker = cbTickerResp.ok ? await cbTickerResp.json() : null;
            if (Array.isArray(rawCb) && rawCb.length > 0) {
              const candles = rawCb
                .slice(0, 40)
                .reverse()
                .map((row) => ({
                  time: Number(row[0]) * 1000,
                  low: Number(row[1]),
                  high: Number(row[2]),
                  open: Number(row[3]),
                  close: Number(row[4]),
                  vol: Number(row[5])
                }))
                .filter((c) => Number.isFinite(c.close) && c.close > 0);
              const price = rawTicker && Number.isFinite(Number(rawTicker.price))
                ? Number(rawTicker.price)
                : candles[candles.length - 1]?.close ?? null;
              const firstOpen = candles[0]?.open;
              const change24hPct =
                firstOpen && price ? ((price - firstOpen) / firstOpen) * 100 : null;
              if (price !== null && candles.length > 0) {
                return sendJson(res, 200, {
                  ok: true,
                  source: 'Coinbase 1m',
                  symbol: 'BTC/USD',
                  price,
                  change24hPct,
                  candles
                });
              }
            }
          }
        } catch {
          // Try CoinGecko next
        }

        try {
          const [cgOhlcResp, cgPriceResp] = await Promise.all([
            fetch('https://api.coingecko.com/api/v3/coins/bitcoin/ohlc?vs_currency=usd&days=1', {
              signal: AbortSignal.timeout(5000)
            }),
            fetch(
              'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true',
              { signal: AbortSignal.timeout(5000) }
            )
          ]);
          if (cgOhlcResp.ok) {
            const rawCg = await cgOhlcResp.json();
            const rawSp = cgPriceResp.ok ? await cgPriceResp.json() : null;
            if (Array.isArray(rawCg) && rawCg.length > 0) {
              const candles = rawCg.slice(-40).map((row) => ({
                time: Number(row[0]),
                open: Number(row[1]),
                high: Number(row[2]),
                low: Number(row[3]),
                close: Number(row[4]),
                vol: 1.0
              }));
              const price = Number.isFinite(Number(rawSp?.bitcoin?.usd))
                ? Number(rawSp.bitcoin.usd)
                : candles[candles.length - 1]?.close ?? null;
              const change24hPct = Number.isFinite(Number(rawSp?.bitcoin?.usd_24h_change))
                ? Number(rawSp.bitcoin.usd_24h_change)
                : null;
              if (price !== null && candles.length > 0) {
                return sendJson(res, 200, {
                  ok: true,
                  source: 'CoinGecko 30m',
                  symbol: 'BTC/USD',
                  price,
                  change24hPct,
                  candles
                });
              }
            }
          }
        } catch {
          // Offline / blocked -> honest BELUM DIAMBIL
        }

        return sendJson(res, 200, {
          ok: false,
          status: 'BELUM DIAMBIL',
          source: null,
          price: null,
          change24hPct: null,
          candles: []
        });
      }

      if (req.method === 'GET' && reqUrl.pathname === '/api/market/sandi-brief') {
        const assets = [];
        try {
          const resp = await fetch(
            'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true',
            { signal: AbortSignal.timeout(8000) }
          );
          if (resp.ok) {
            const json = await resp.json();
            if (json.bitcoin?.usd !== undefined) {
              assets.push({
                symbol: 'BTC/USD',
                price: json.bitcoin.usd,
                change24hPct: json.bitcoin.usd_24h_change ?? null,
                source: 'CoinGecko Free API'
              });
            }
            if (json.ethereum?.usd !== undefined) {
              assets.push({
                symbol: 'ETH/USD',
                price: json.ethereum.usd,
                change24hPct: json.ethereum.usd_24h_change ?? null,
                source: 'CoinGecko Free API'
              });
            }
            if (json.solana?.usd !== undefined) {
              assets.push({
                symbol: 'SOL/USD',
                price: json.solana.usd,
                change24hPct: json.solana.usd_24h_change ?? null,
                source: 'CoinGecko Free API'
              });
            }
          }
        } catch {
          // Offline / sandboxed -> explicit NOT RETRIEVED
        }

        let regime = 'BELUM DIAMBIL';
        if (assets.length > 0) {
          const changes = assets.map((a) => a.change24hPct).filter((c) => typeof c === 'number');
          const avg = changes.length ? changes.reduce((s, x) => s + x, 0) / changes.length : 0;
          regime = avg > 1.2 ? 'RISK-ON' : avg < -1.2 ? 'RISK-OFF' : 'MIXED';
        }

        return sendJson(res, 200, {
          fetchedAt: assets.length > 0 ? new Date().toISOString() : null,
          regime,
          assets,
          notRetrieved:
            assets.length === 0
              ? ['BTC/USD', 'ETH/USD', 'SOL/USD', 'EUR/USD', 'S&P 500']
              : ['EUR/USD (gunakan API Exness / feed tambahan)', 'S&P 500 (butuh feed bebas berbayar)'],
          disclaimer: 'Analisa bersifat edukasi, bukan saran keuangan. Jangan mengarang harga yang belum diambil.'
        });
      }

      if (req.method === 'GET' && reqUrl.pathname === '/api/settings/status') {
        const store = await readSecretFile(rootDir);
        const i = store.integrations;
        return sendJson(res, 200, {
          nineRouterUrl: i.nineRouterUrl || '',
          nineRouterHasKey: Boolean(i.nineRouterKey),
          nineRouterKeyLast4: maskTail(i.nineRouterKey, 4),
          freeLlmApiUrl: i.freeLlmApiUrl || '',
          freeLlmApiHasKey: Boolean(i.freeLlmApiKey),
          freeLlmApiKeyLast4: maskTail(i.freeLlmApiKey, 4),
          n8nWebhookUrl: i.n8nWebhookUrl || '',
          voiceboxUrl: i.voiceboxUrl || 'http://127.0.0.1:17493',
          youtubeChannel: i.youtubeChannel || '',
          youtubeClientIdLast4: maskTail(i.youtubeClientId, 4),
          youtubeHasSecret: Boolean(i.youtubeClientSecret)
        });
      }

      if (req.method === 'POST' && reqUrl.pathname === '/api/settings/save') {
        const body = await readBody(req);
        const store = await readSecretFile(rootDir);
        const next = { ...store.integrations };

        if (typeof body.nineRouterUrl === 'string') next.nineRouterUrl = body.nineRouterUrl.trim();
        if (typeof body.nineRouterKey === 'string' && body.nineRouterKey.trim()) next.nineRouterKey = body.nineRouterKey.trim();
        if (typeof body.freeLlmApiUrl === 'string') next.freeLlmApiUrl = body.freeLlmApiUrl.trim();
        if (typeof body.freeLlmApiKey === 'string' && body.freeLlmApiKey.trim()) next.freeLlmApiKey = body.freeLlmApiKey.trim();
        if (typeof body.n8nWebhookUrl === 'string') next.n8nWebhookUrl = body.n8nWebhookUrl.trim();
        if (typeof body.voiceboxUrl === 'string') next.voiceboxUrl = body.voiceboxUrl.trim();
        if (typeof body.youtubeChannel === 'string') next.youtubeChannel = body.youtubeChannel.trim();
        if (typeof body.youtubeClientId === 'string' && body.youtubeClientId.trim()) next.youtubeClientId = body.youtubeClientId.trim();
        if (typeof body.youtubeClientSecret === 'string' && body.youtubeClientSecret.trim()) next.youtubeClientSecret = body.youtubeClientSecret.trim();

        store.integrations = next;
        await writeSecretFile(rootDir, store);
        return sendJson(res, 200, { ok: true });
      }

      if (req.method === 'POST' && reqUrl.pathname === '/api/kra/chat') {
        const body = await readBody(req);
        const message = String(body.message || '').trim();
        if (!message) return sendJson(res, 400, { error: 'Pesan tidak boleh kosong.' });

        const targets = pickRespondingBots(message);
        const roster = await loadKraRosterFromDisk(rootDir);
        const store = await readSecretFile(rootDir);

        const replies = await Promise.all(
          targets.map(async (botId) => {
            const personaText = roster.personas[botId] || '';
            const llm = await tryFreeLlmReply(botId, message, personaText, store.integrations);
            return {
              agentId: botId,
              text: llm ? llm.reply : generateLocalPersonaReply(botId, message),
              source: llm ? `live:${llm.provider}` : 'persona-local'
            };
          })
        );

        return sendJson(res, 200, { replies });
      }

      if (req.method === 'POST' && reqUrl.pathname === '/api/sandi/analyze') {
        const body = await readBody(req);
        const ticker = String(body.ticker || '').trim().toUpperCase();
        const accountSize = Number(body.accountSize || 0);
        const riskPct = Number(body.riskPct || 1);
        const entry = Number(body.entry || 0);
        const stop = Number(body.stop || 0);
        const atr = Number(body.atr || 0);
        const winRate = Number(body.winRate || 0.45);
        const payoffRatio = Number(body.payoffRatio || 2.0);
        const eventGateActive = Boolean(body.eventGateActive);

        if (!ticker) return sendJson(res, 400, { error: 'Masukkan ticker / pair terlebih dahulu.' });

        const riskCapital = accountSize > 0 ? (accountSize * Math.max(0.1, Math.min(5, riskPct))) / 100 : 0;
        const stopDist = entry > 0 && stop > 0 ? Math.abs(entry - stop) : atr > 0 ? atr * 1.5 : 0;
        const fixedUnits = riskCapital > 0 && stopDist > 0 ? riskCapital / stopDist : 0;
        const rawKelly = payoffRatio > 0 ? winRate - (1 - winRate) / payoffRatio : 0;
        const halfKellyPct = Math.max(0, rawKelly * 0.5 * 100);

        const verdict = eventGateActive
          ? 'NO-ACTION (Event Gate Active)'
          : stopDist > 0 && entry > stop
            ? 'WAIT / WATCH LONG SETUP'
            : stopDist > 0 && entry < stop
              ? 'WAIT / WATCH SHORT SETUP'
              : 'WAIT';

        return sendJson(res, 200, {
          ticker,
          verdict,
          confidence: eventGateActive
            ? 'RENDAH (Event Gate Veto)'
            : entry > 0 && stop > 0
              ? 'MODERAT (Berbasis Input User)'
              : 'BELUM CUKUP DATA',
          sizing: {
            accountSize: accountSize > 0 ? accountSize : null,
            riskPct,
            riskCapitalUsd: riskCapital > 0 ? Number(riskCapital.toFixed(2)) : null,
            stopDistance: stopDist > 0 ? Number(stopDist.toFixed(4)) : null,
            fixedFractionalUnits: eventGateActive ? 0 : fixedUnits > 0 ? Number(fixedUnits.toFixed(4)) : null,
            atrSuggestedStop: atr > 0 && entry > 0 ? Number((entry - atr * 1.5).toFixed(4)) : null,
            halfKellyPct: Number(halfKellyPct.toFixed(2))
          },
          scenarios: {
            bear: `Invalidasi di ${stop > 0 ? stop : 'NOT RETRIEVED'} — cut risk segera sesuai plan.`,
            base: 'Konsolidasi menunggu konfirmasi volume & spread stabil.',
            bull: 'Lanjut tren jika struktur higher-low terjaga tanpa event makro mendadak.'
          },
          notRetrieved: entry > 0 ? [] : ['Harga live aset belum dimasukkan / diambil di sesi ini'],
          disclaimer:
            'Analisa bersifat edukasi, bukan saran keuangan. Keputusan eksekusi sepenuhnya berada di RAMA & Yang Mulia. SANDI tidak pernah mengeksekusi order.'
        });
      }

      return sendJson(res, 404, { error: 'Unknown KRA API route' });
    } catch (err) {
      return sendJson(res, 400, {
        error: err instanceof Error ? err.message : 'Server error'
      });
    }
  };
}
