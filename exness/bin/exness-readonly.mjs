#!/usr/bin/env node
// exness-readonly.mjs
// Read-only client for the Exness Trading API (signed Ed25519 requests).
// Node.js standard library only. No dependencies.
//
// What it does:
//   --self-test        Validate signing against the public RFC 8032 Test 1
//                      vector from the Exness developer portal. No network.
//   --discover         Signed GET /v1/trading/access-point on the Gateway.
//                      Caches only the Access Point URL (no credentials) in
//                      ../.access-point.json for 24 hours.
//   --account-details  Signed GET /v1/configuration/accounts/{id}/account
//                      on the Access Point. Read-only. Prints the JSON reply.
//
// Credentials come from environment variables at runtime only:
//   EXN_API_KEY, EXN_PRIVATE_KEY, EXN_ACCOUNT_ID, EXN_DISCOVERY_BASE_URL
// They are never written to a file, never logged, and never printed.
// There are no trading endpoints in this file. No POST, no orders, no positions.
//
// Source: https://www.exness-api.com/trading/guides/code-examples
// (read 2026-11-09). This is a faithful port of the portal's TypeScript
// read-only example, with a discovery cache and a self-test added.

import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.access-point.json');
const EMPTY_BODY_HASH = createHash('sha256').update(Buffer.alloc(0)).digest('base64url');

// The public synthetic test vector from the Exness portal (RFC 8032 Test 1).
// It is not a credential. Never register it and never use it for real requests.
const TEST_VECTOR = {
  privateKeyHex: '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a',
  privateKeyPem: [
    '-----BEGIN PRIVATE KEY-----',
    'MC4CAQAwBQYDK2VwBCIEIJ1hsZ3v/VpguoRK9JLsLMREScVpezJpGXA7rAMcrn9g',
    '-----END PRIVATE KEY-----',
  ].join('\n'),
  apiKey: 'exnsk-synthetic-example',
  timestamp: 1773656070123,
  path: '/v1/trading/access-point?account_id=123456',
  expectedData: 'eyJhcGlfa2V5IjoiZXhuc2stc3ludGhldGljLWV4YW1wbGUiLCJpZGVtcG90ZW5jeV9rZXkiOiIiLCJ0aW1lc3RhbXAiOjE3NzM2NTYwNzAxMjMsInNpZ25fdmVyc2lvbiI6MSwibWV0aG9kIjoiR0VUIiwicGF0aCI6Ii92MS90cmFkaW5nL2FjY2Vzcy1wb2ludD9hY2NvdW50X2lkPTEyMzQ1NiIsImJvZHlfaGFzaCI6IjQ3REVRcGo4SEJTYS1fVEltVy01SkNldVFlUmttNU5NcEpXWkczaFN1RlUifQ',
  expectedSign: 'l-H_Acia8YoTjKFMg-3fon3NOEX8TalNVA7c01DQ9dHb7pVBJC4y06qC-DbpETzh1KToiOprqEV6uzN3t69ICQ',
};

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name}`);
  return value;
}

function loadSigningKey(text) {
  const input = text.trim();
  let key;
  if (input.startsWith('-----BEGIN PRIVATE KEY-----')) {
    key = createPrivateKey(input);
  } else {
    if (!/^[0-9a-fA-F]{128}$/.test(input)) {
      throw new Error('Expected 128 hex characters or unencrypted PKCS#8 PEM');
    }
    const raw = Buffer.from(input, 'hex');
    // RFC 8410 PKCS#8 DER wrapper for a 32-byte Ed25519 seed.
    key = createPrivateKey({
      key: Buffer.concat([
        Buffer.from('302e020100300506032b657004220420', 'hex'),
        raw.subarray(0, 32),
      ]),
      format: 'der',
      type: 'pkcs8',
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

function baseUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Expected an HTTPS base URL without credentials, path, query or fragment');
  }
  return url.origin;
}

function validateAccountId(accountId) {
  if (!/^[1-9][0-9]*$/.test(accountId) || BigInt(accountId) > 18446744073709551615n) {
    throw new Error('EXN_ACCOUNT_ID must be a positive uint64 decimal string');
  }
  return accountId;
}

function signedGetHeaders(apiKey, privateKey, pathWithQuery, timestamp = Date.now()) {
  // Serialize once: encode and sign the very same UTF-8 bytes.
  const payload = Buffer.from(JSON.stringify({
    api_key: apiKey,
    idempotency_key: '',
    timestamp,
    sign_version: 1,
    method: 'GET',
    path: pathWithQuery,
    body_hash: EMPTY_BODY_HASH,
  }), 'utf8');
  return {
    'EXN-API-KEY': apiKey,
    'EXN-IDEMPOTENCY-KEY': '',
    'EXN-TIMESTAMP': String(timestamp),
    'EXN-SIGN-VERSION': '1',
    'EXN-DATA': payload.toString('base64url'),
    'EXN-SIGN': sign(null, payload, privateKey).toString('base64url'),
  };
}

async function getJson(host, pathWithQuery, apiKey, privateKey) {
  const response = await fetch(host + pathWithQuery, {
    method: 'GET',
    headers: signedGetHeaders(apiKey, privateKey, pathWithQuery),
    // Do not forward signed headers to a redirect destination.
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Request failed: HTTP ${response.status}`);
  return response.json();
}

async function readCache(accountId) {
  try {
    const cached = JSON.parse(await readFile(CACHE_FILE, 'utf8'));
    if (cached.account_id === accountId &&
        typeof cached.access_point === 'string' &&
        typeof cached.discovered_at === 'number' &&
        Date.now() - cached.discovered_at < CACHE_TTL_MS) {
      return baseUrl(cached.access_point);
    }
  } catch {
    // No usable cache. Discovery runs instead.
  }
  return null;
}

async function discoverAccessPoint(apiKey, privateKey, accountId, gateway, force) {
  if (!force) {
    const cached = await readCache(accountId);
    if (cached) return { accessPoint: cached, fromCache: true };
  }
  const discovery = await getJson(
    gateway,
    `/v1/trading/access-point?account_id=${accountId}`,
    apiKey,
    privateKey,
  );
  if (typeof discovery.access_point !== 'string' || !discovery.access_point) {
    throw new Error('Discovery response is missing access_point');
  }
  const accessPoint = baseUrl(discovery.access_point);
  await writeFile(CACHE_FILE, JSON.stringify({
    account_id: accountId,
    access_point: accessPoint,
    discovered_at: Date.now(),
  }, null, 2) + '\n', { mode: 0o600 });
  return { accessPoint, fromCache: false };
}

function loadAuth() {
  const apiKey = requiredEnv('EXN_API_KEY');
  const accountId = validateAccountId(requiredEnv('EXN_ACCOUNT_ID'));
  const gateway = baseUrl(requiredEnv('EXN_DISCOVERY_BASE_URL'));
  const privateKey = loadSigningKey(requiredEnv('EXN_PRIVATE_KEY'));
  return { apiKey, accountId, gateway, privateKey };
}

function selfTest() {
  const results = [];
  const check = (name, actual, expected) => {
    const ok = actual === expected;
    results.push({ name, ok, actual, expected });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
    if (!ok) {
      console.log(`  expected: ${expected}`);
      console.log(`  actual:   ${actual}`);
    }
  };

  // 1. Hex key, fixed timestamp, exact test vector from the portal.
  const keyFromHex = loadSigningKey(TEST_VECTOR.privateKeyHex);
  const headers = signedGetHeaders(
    TEST_VECTOR.apiKey, keyFromHex, TEST_VECTOR.path, TEST_VECTOR.timestamp,
  );
  check('EXN-DATA (hex key)', headers['EXN-DATA'], TEST_VECTOR.expectedData);
  check('EXN-SIGN (hex key)', headers['EXN-SIGN'], TEST_VECTOR.expectedSign);

  // 2. Same key as PKCS#8 PEM must produce the identical signature.
  const keyFromPem = loadSigningKey(TEST_VECTOR.privateKeyPem);
  const pemHeaders = signedGetHeaders(
    TEST_VECTOR.apiKey, keyFromPem, TEST_VECTOR.path, TEST_VECTOR.timestamp,
  );
  check('EXN-SIGN (PEM key)', pemHeaders['EXN-SIGN'], TEST_VECTOR.expectedSign);

  // 3. A key whose public half does not match its seed must be rejected.
  let rejected = false;
  try {
    const tampered = TEST_VECTOR.privateKeyHex.slice(0, 64) + '00'.repeat(32);
    loadSigningKey(tampered);
  } catch (error) {
    rejected = error.message === 'Private key public half does not match its seed';
  }
  results.push({ name: 'tampered public half rejected', ok: rejected });
  console.log(`${rejected ? 'PASS' : 'FAIL'} tampered public half rejected`);

  // 4. A non-HTTPS base URL must be rejected.
  let baseRejected = false;
  try {
    baseUrl('http://gateway.example');
  } catch (error) {
    baseRejected = error.message.startsWith('Expected an HTTPS base URL');
  }
  results.push({ name: 'non-HTTPS base URL rejected', ok: baseRejected });
  console.log(`${baseRejected ? 'PASS' : 'FAIL'} non-HTTPS base URL rejected`);

  const failed = results.filter((r) => !r.ok).length;
  console.log(failed === 0
    ? `SELF-TEST OK: ${results.length}/${results.length} checks passed`
    : `SELF-TEST FAILED: ${failed} of ${results.length} checks failed`);
  return failed === 0;
}

function usage() {
  console.log([
    'Usage: node exness-readonly.mjs <command>',
    '',
    '  --self-test        Validate signing against the public test vector.',
    '  --discover         Discover and cache the Access Point URL.',
    '  --discover --refresh  Discover again, ignoring the cache.',
    '  --account-details  Read account details from the Access Point.',
    '',
    'Reads EXN_API_KEY, EXN_PRIVATE_KEY, EXN_ACCOUNT_ID and',
    'EXN_DISCOVERY_BASE_URL from the environment at runtime only.',
  ].join('\n'));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) {
    process.exitCode = selfTest() ? 0 : 1;
    return;
  }
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    usage();
    return;
  }
  const auth = loadAuth();
  if (args.includes('--discover')) {
    const { accessPoint, fromCache } = await discoverAccessPoint(
      auth.apiKey, auth.privateKey, auth.accountId, auth.gateway,
      args.includes('--refresh'),
    );
    console.log(`Access Point: ${accessPoint}${fromCache ? ' (cached)' : ''}`);
    return;
  }
  if (args.includes('--account-details')) {
    const { accessPoint } = await discoverAccessPoint(
      auth.apiKey, auth.privateKey, auth.accountId, auth.gateway, false,
    );
    const account = await getJson(
      accessPoint,
      `/v1/configuration/accounts/${auth.accountId}/account`,
      auth.apiKey,
      auth.privateKey,
    );
    console.log(JSON.stringify(account, null, 2));
    return;
  }
  usage();
  process.exitCode = 2;
}

main().catch((error) => {
  // Print the message only, without credentials or signed headers.
  console.error(error instanceof Error ? error.message : 'Unexpected error');
  process.exitCode = 1;
});
