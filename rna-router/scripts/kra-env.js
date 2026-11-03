'use strict';

/**
 * Pemuat `.kra-secrets.env` tanpa dependency (tambahan bundle KRA).
 *
 * Berkas itu dibuat sekali oleh `scripts/pair-kra.js` / `Pair KRA Event Secret.bat`
 * dan berisi SATU secret yang dipakai dua sisi: Node (`KRA_EVENT_SECRET`)
 * dan PHP (`KRA_RNA_ROUTER_EVENT_SECRET`). Environment proses selalu menang,
 * jadi `setx`, `--env-file`, CI, dan tes tidak pernah ditimpa.
 */
const fs = require('node:fs');
const path = require('node:path');

const ENV_FILE = path.resolve(__dirname, '..', '.kra-secrets.env');
const SAFE_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

function parse(text) {
  const values = {};
  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (!SAFE_KEY.test(key)) continue;
    let value = trimmed.slice(separator + 1).trim();
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function loadKraEnv(file = ENV_FILE) {
  let values = {};
  try {
    values = parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (error && error.code !== 'ENOENT') throw error;
    return {};
  }
  for (const [key, value] of Object.entries(values)) {
    if (process.env[key] !== undefined) continue;
    process.env[key] = value;
  }
  return values;
}

module.exports = { ENV_FILE, parse, loadKraEnv };
