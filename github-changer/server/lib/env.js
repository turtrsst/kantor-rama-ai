'use strict';

/**
 * Pemuat `.env` tanpa dependency (tambahan bundle KRA).
 *
 * Upstream GitHub Changer mengandalkan environment yang sudah disuntik shell;
 * README-nya menyuruh `cp .env.example .env` tetapi `npm start` tidak pernah
 * membaca berkas itu. Bundle KRA membutuhkan `.env` agar pairing otomatis
 * desktop / `Start GitHub Changer.bat` bekerja konsisten.
 *
 * Aturan: nilai yang SUDAH ada di `process.env` selalu menang (environment
 * proses, `--env-file`, CI, dan tes tidak pernah ditimpa). Baris komentar dan
 * tanda kutip sederhana didukung. Kunci dibatasi pola shell yang aman.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ENV_FILE = path.join(ROOT, '.env');
const SAFE_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

try {
  const text = fs.readFileSync(ENV_FILE, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (!SAFE_KEY.test(key) || process.env[key] !== undefined) continue;
    let value = trimmed.slice(separator + 1).trim();
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
} catch {
  // `.env` opsional: semua parameter juga bisa diisi lewat UI Parameters.
}
