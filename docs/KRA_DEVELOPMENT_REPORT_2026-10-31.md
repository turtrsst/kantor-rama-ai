# KRA Development Report & Recommendations

**Date:** 31 October 2026 (Asia/Jakarta)
**Related audit:** [`KRA_AUDIT_REMEDIATION_2026-10-31.md`](KRA_AUDIT_REMEDIATION_2026-10-31.md)

## Work completed

- Repaired Creator Studio N100N session authentication, status-response handling, server-side configuration aliases, execution-ID validation, and asynchronous workflow starts. Preserved the separate machine-key-only `flow-*` endpoints and kept the N100N REST key on the PHP server.
- Removed the public Apache root-database defaults; blocked direct access to ignored local provider config; prohibited implicit SIAS MySQL-root fallback on remote requests.
- Added server-side logout token revocation and made the UI wait for successful revocation before clearing its session.
- Made pending skill approvals distinct from lock integrity errors without activating pending skills. Changed the skill CI verifier to test prompt directives without requiring a real provider.
- Fixed CI's reference to a non-existent renderer test and expanded its Node verification steps. Corrected the stale manual URL test.
- Added N100N config tests and a server-security verifier; documented the intended Exabytes/server-side configuration boundary.

## Prioritized development plan

### P0 — deployment and credential safety (operator action)

1. Deploy the source changes and set the actual `KRA_DB_HOST`, a dedicated `KRA_DB_USER`, and `KRA_DB_PASS` using Exabytes' supported server/PHP environment mechanism. Do not put secrets in Git-tracked `.htaccess` or the web directory. Keep the runtime DB account least-privileged; use a separate migration account if schema changes are needed.
2. Set `KRA_SIAS_DB` to the real SIAS database name if it is not `sias`. Keep the `users` table/password hash on the SIAS side; KRA only creates/looks up its session record in `kra_db`.
3. Rotate the N100N REST key and any other keys that were pasted into chat, then configure `KRA_N100N_BASE_URL` and `KRA_N100N_API_KEY` server-side. Never send a replacement key through chat or browser code.
4. Verify the actual hosting PHP version, required PDO/MySQL and cURL/stream capabilities, document root, and environment propagation in Exabytes. The public PHP runtime is controlled by the host; the Windows launcher setting is not a hosted PHP setting.

### P1 — production-like integration verification

1. In staging, test the complete auth matrix: anonymous N100N request returns 401; a valid KRA bearer session can check status/list workflows; an ordinary user cannot run; a supervisor can run; malformed/oversized payloads are rejected; logout invalidates the same bearer token.
2. Run an N100N mock/staging service to verify workflow-list response variants, async execution-ID extraction, and execution lookup. Add an API contract test that exercises actual PHP routing rather than only source-string assertions.
3. Test SIAS login against the real `users` schema with approved, pending, rejected, disabled, and password-hash cases. Do not use the supplied schema or sample values as credentials.
4. Add login-attempt throttling at the hosting/WAF layer (and, if supported by the deployment topology, application-level throttling). Current source checks password hashes and approval state, but has no built-in failed-login rate limiter.

### P2 — session and database lifecycle

1. Add explicit session expiry/rotation policy. Current tokens are random and stored as hashes, and logout revokes the active hash, but the schema does not define an absolute expiry or idle timeout.
2. Separate schema migration from normal request handling. `KraDb::connect()` currently runs idempotent migration SQL when it establishes a connection; production runtime credentials should not need DDL privileges on every API request.
3. Add a deployment check that reports missing DB/environment configuration without exposing credential values, and a health check that distinguishes KRA DB, SIAS DB, and N100N connectivity.
4. Review API error messages from external providers/N100N for redaction before returning them to users; retain useful diagnostics in server logs without logging bearer/API keys.

### P2 — UI and desktop regression coverage

1. Install the declared Electron dependency in CI and add an Electron/browser smoke job for the two-floor 3D scene, elevator transit, roster drawer, login, and logout. Existing Electron-focused verifiers could not run in this environment because `electron` was not installed.
2. Make browser smoke tests use a local mock backend and same-origin relative URLs, with explicit test setup/teardown. Do not point automated tests at the live public domain or localhost from the user's browser.
3. Add visual review at common desktop/mobile viewports after every major CSS/3D update. Current Node renderer tests verify scene construction and layout invariants, not screenshots or real GPU/browser behavior.
4. Keep the visual office activity state separate from real agent execution state; preserve the explicit simulated/presentation-only messaging.

## Quality gates now in the repository

- PHP 8.4 CI syntax checks and selected PHP tests remain authoritative for the release target.
- Node CI now runs the existing colony/Three.js, vault settings, chat modes, Creator roster, header, crew drawer, and server-security verifications plus skill tests.
- The skill lock distinguishes integrity from review state: pending skills remain visible for review and unavailable for activation until approved.
- Source-only preview/API simulations must be labeled as mock; they do not replace staging or production integration evidence.

## Open limitations

- No Exabytes panel/SSH access, production database credentials, SIAS account, rotated N100N key, live provider key, or live N100N endpoint was available. This report makes no claim that any production integration is now connected.
- Native PHP 8.4 CI and Electron/browser rendering were not executed from this workspace. PHP-WASM 8.5.10 and dependency-free Node checks were used; see the remediation report for exact results.
- Previous audit documents remain historical. Their unresolved counts should be rechecked against the current branch rather than carried forward as current defects.
