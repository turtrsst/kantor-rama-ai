#!/usr/bin/env node
'use strict';

/**
 * Pairing satu perintah GitHub Changer -> server PHP KRA (mode XAMPP/manual).
 *
 *   node scripts/pair-kra.js [--kra-url=http://127.0.0.1:8088]
 *
 * - Mengisi `KRA_GHC_API_KEY` dan `KRA_GHC_EVENT_SECRET` di `.env` bila kosong
 *   (nilai yang sudah ada TIDAK ditimpa).
 * - Mencetak variabel yang harus diset di sisi PHP KRA / form koneksi panel.
 * - Tidak pernah mencetak secret ke log selain ke terminal operator ini.
 *
 * Mode desktop KRA melakukan semua ini otomatis lewat desktop/main.js.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = path.join(ROOT, '.env');
const EXAMPLE_PATH = path.join(ROOT, '.env.example');

function parse(text) {
  const values = {};
  for (const line of String(text).split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (match) values[match[1]] = match[2].trim();
  }
  return values;
}

function setValue(text, key, value) {
  const pattern = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');
  if (pattern.test(text)) return text.replace(pattern, `${key}=${value}`);
  return text.replace(/\s*$/, '') + `\n${key}=${value}\n`;
}

const kraUrlArg = process.argv.find((arg) => arg.startsWith('--kra-url='));
const kraUrl = (kraUrlArg ? kraUrlArg.slice('--kra-url='.length) : 'http://127.0.0.1:8088').replace(/\/+$/, '');
try {
  const parsed = new URL(kraUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('scheme');
} catch {
  console.error('✗ --kra-url harus URL http:// atau https:// yang bisa dijangkau server PHP KRA.');
  process.exit(1);
}

let text = '';
try {
  text = fs.readFileSync(ENV_PATH, 'utf8');
} catch {
  try { text = fs.readFileSync(EXAMPLE_PATH, 'utf8'); } catch { text = ''; }
}
const values = parse(text);
let changed = !fs.existsSync(ENV_PATH);
for (const key of ['KRA_GHC_API_KEY', 'KRA_GHC_EVENT_SECRET']) {
  if (!values[key]) {
    values[key] = crypto.randomBytes(24).toString('hex');
    text = setValue(text, key, values[key]);
    changed = true;
  }
}
const eventUrl = `${kraUrl}/api/index.php?action=github-changer-event`;
if (!values.KRA_GHC_EVENT_URL) {
  text = setValue(text, 'KRA_GHC_EVENT_URL', eventUrl);
  values.KRA_GHC_EVENT_URL = eventUrl;
  changed = true;
}
if (changed) {
  fs.writeFileSync(ENV_PATH, text.endsWith('\n') ? text : text + '\n', 'utf8');
  console.log(`✓ ${ENV_PATH} diperbarui (file ini ada di .gitignore).`);
} else {
  console.log('✓ .env sudah lengkap; tidak ada nilai yang ditimpa.');
}

console.log('\nSalin ke environment server PHP KRA, atau isi lewat panel');
console.log('GitHub Changer → SAVE CONNECTION (API key bersifat write-only):\n');
console.log(`  KRA_GITHUB_CHANGER_URL=${process.env.KRA_GITHUB_CHANGER_URL || 'http://127.0.0.1:4173'}`);
console.log(`  KRA_GITHUB_CHANGER_API_KEY=${values.KRA_GHC_API_KEY}`);
console.log(`  KRA_GITHUB_CHANGER_EVENT_SECRET=${values.KRA_GHC_EVENT_SECRET}`);
console.log('\nLalu jalankan service ini (`npm start` / Start GitHub Changer.bat),');
console.log('restart server PHP KRA, dan tekan CHECK CONNECTION di panel KRA.');
console.log('Jangan commit .env atau membagikan nilai di atas ke publik.\n');
