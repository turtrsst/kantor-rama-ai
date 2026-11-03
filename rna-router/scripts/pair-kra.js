#!/usr/bin/env node
'use strict';

/**
 * Pairing SATU secret untuk automation RNA Router -> KRA.
 *
 *   node scripts/pair-kra.js [--kra-url=http://127.0.0.1:8088] [--env-path=...]
 *
 * Menulis `.kra-secrets.env` (gitignored) berisi:
 *   KRA_EVENT_SECRET=<hex>                  <- dipakai Node (penanda tangan HMAC)
 *   KRA_RNA_ROUTER_EVENT_SECRET=<hex sama> <- dipakai PHP (verifikasi HMAC)
 *   KRA_EVENT_URL, RNA_ROUTER_URL, KRA_RNA_ROUTER_URL
 *
 * Nilai yang sudah ada TIDAK ditimpa, jadi aman dijalankan berulang kali.
 * Script ini tidak pernah mengirim secret ke jaringan; hanya mencetak ke
 * terminal operator dan ke file lokal yang tidak masuk Git.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parse } = require('./kra-env.js');

const DEFAULT_ENV_PATH = path.resolve(__dirname, '..', '.kra-secrets.env');
const DEFAULT_KRA_URL = 'http://127.0.0.1:8088';
const SAFE_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

function arg(name, fallback) {
  const prefix = '--' + name + '=';
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function validBaseUrl(raw) {
  try {
    const url = new URL(String(raw));
    if ((url.protocol !== 'http:' && url.protocol !== 'https:')
      || url.username || url.password || url.search || url.hash) throw new Error('scheme');
    return url.href.replace(/\/+$/, '');
  } catch {
    throw new Error('--kra-url harus URL http:// atau https:// tanpa kredensial/query/fragment.');
  }
}

function setValue(text, key, value) {
  const pattern = new RegExp('^\\s*' + key + '\\s*=.*$', 'm');
  if (pattern.test(text)) return text.replace(pattern, key + '=' + value);
  return text.replace(/\s*$/, '') + '\n' + key + '=' + value + '\n';
}

/** @returns {{path:string, secret:string, values:object, created:boolean}} */
function pair(options = {}) {
  const envPath = options.envPath || DEFAULT_ENV_PATH;
  const kraUrl = validBaseUrl(options.kraUrl || DEFAULT_KRA_URL);
  let text = '';
  let created = false;
  try {
    text = fs.readFileSync(envPath, 'utf8');
  } catch (error) {
    if (error && error.code !== 'ENOENT') throw error;
    created = true;
  }
  const values = parse(text);
  const secret = values.KRA_EVENT_SECRET || crypto.randomBytes(24).toString('hex');
  const eventUrl = kraUrl + '/api/index.php?action=rna-router-event';
  const desired = {
    KRA_EVENT_SECRET: secret,
    // Nilai yang SAMA persis: inilah inti "samakan secret Node dan PHP".
    KRA_RNA_ROUTER_EVENT_SECRET: secret,
    RNA_ROUTER_URL: values.RNA_ROUTER_URL || 'http://127.0.0.1:3000',
    KRA_RNA_ROUTER_URL: values.KRA_RNA_ROUTER_URL || 'http://127.0.0.1:3000',
    KRA_EVENT_URL: values.KRA_EVENT_URL || eventUrl,
  };
  let changed = created;
  for (const [key, value] of Object.entries(desired)) {
    if (!SAFE_KEY.test(key)) throw new Error('Kunci environment tidak aman: ' + key);
    if (values[key] === value) continue;
    text = setValue(text, key, value);
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(envPath, text.replace(/\s*$/, '') + '\n', 'utf8', { mode: 0o600 });
    if (process.platform !== 'win32') {
      try { fs.chmodSync(envPath, 0o600); } catch { /* abaikan FS tanpa chmod */ }
    }
  }
  return { path: envPath, secret, values: { ...values, ...desired }, created: changed };
}

function main() {
  const result = pair({ envPath: arg('env-path', DEFAULT_ENV_PATH), kraUrl: arg('kra-url', DEFAULT_KRA_URL) });
  const s = result.secret;
  console.log('\n=== PAIRING SECRET: RNA Router -> KRA ===\n');
  console.log('[NODE] ' + (result.created ? 'Dibuat' : 'Sudah ada (nilai dipertahankan)') + ': ' + result.path);
  console.log('       Start RNA Router Automation.bat membaca file ini otomatis.');
  console.log('       KRA_EVENT_SECRET = KRA_RNA_ROUTER_EVENT_SECRET (sama persis).\n');
  console.log('[PHP]  Pilih SALAH SATU cara meneruskan secret ke proses PHP KRA:\n');
  console.log('  A. XAMPP / Apache — buat C:\\xampp\\apache\\conf\\extra\\httpd-kra-secrets.conf');
  console.log('     berisi baris berikut, lalu tambahkan "Include conf/extra/httpd-kra-secrets.conf"');
  console.log('     ke httpd.conf dan RESTART Apache lewat XAMPP Control Panel:\n');
  console.log('       SetEnv KRA_RNA_ROUTER_EVENT_SECRET ' + s);
  console.log('       SetEnv KRA_RNA_ROUTER_URL ' + result.values.KRA_RNA_ROUTER_URL + '\n');
  console.log('  B. PHP built-in / KRA desktop — jalankan di CMD, lalu TUTUP & BUKA ulang');
  console.log('     aplikasi desktop (atau restart "php -S") supaya child process mewarisi env:\n');
  console.log('       setx KRA_RNA_ROUTER_EVENT_SECRET "' + s + '"');
  console.log('       setx KRA_RNA_ROUTER_URL "' + result.values.KRA_RNA_ROUTER_URL + '"\n');
  console.log('[GITHUB CHANGER] secret-nya terpisah. Jalankan Start GitHub Changer.bat');
  console.log('     lalu salin KRA_GITHUB_CHANGER_API_KEY + KRA_GITHUB_CHANGER_EVENT_SECRET');
  console.log('     yang dicetaknya ke cara A/B yang sama (atau isi API key lewat panel).\n');
  console.log('Jangan commit .kra-secrets.env, .env, atau membagikan nilai di atas.\n');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('[PAIRING GAGAL] ' + String(error.message || error));
    process.exit(1);
  }
}

module.exports = { pair, parse, arg, validBaseUrl, DEFAULT_ENV_PATH };
