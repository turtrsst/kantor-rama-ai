# KRA Application Audit & Remediation Report

**Audit date:** 31 October 2026 (Asia/Jakarta)
**Audited baseline:** branch `arena/23a84f9d-kantor-rama-ai`, commit `76c3166` (`fix(web): ship bundled Three.js runtime so the office can render`)
**Audit type:** source review plus repository-level automated tests. This is not a production penetration test or a live SIAS/N100N/Exabytes validation.

## Executive summary

The review found two high-impact runtime/security issues and several integration/CI defects. Confirmed source defects have been corrected in the current worktree. The highest-risk items were (1) a committed Apache configuration that selected MySQL `root` with no password and a separate SIAS connection that also fell back to `root` for remote requests, and (2) a Creator Studio N100N bridge whose server authentication gate did not match the browser's KRA bearer-session requests.

The KRA-specific Node verifications, PHP-WASM syntax checks, and available isolated PHP tests pass after remediation. Production database, provider, N100N, hosted PHP, and visual browser validation remain outstanding because this workspace has no production credentials or Exabytes control-panel access.

## Current findings and remediation

| ID | Severity | Confirmed finding at baseline | Remediation and current status |
|---|---|---|---|
| KRA-01 | **High — security** | Root `.htaccess` set `KRA_DB_USER root` and `KRA_DB_HOST 127.0.0.1`; no database password was supplied there. Separately, `KraAuth::siasConnect()` defaulted to MySQL `root` when no username was configured, including for remote web requests. A deployed copy could therefore attempt privileged, empty-password database access wherever the MySQL server allowed it. | Removed database credentials/overrides from tracked `.htaccess`; SIAS now refuses an implicit root account on remote requests and only permits the existing local-development/explicit-local override. Added a test for the remote SIAS root fallback. **Fixed in source; deploy with explicit least-privilege DB credentials.** |
| KRA-02 | **High — feature unavailable** | The global API gate treated `flow-*` and `n100n-*` as machine-only and demanded `x-api-key`. The Creator Studio browser intentionally does not possess the N100N service key; several calls had no explicit bearer header and the run request's bearer header was ignored by that gate. The UI's N100N controls therefore could not reliably work through a normal signed-in session. | Split machine-only flow actions from Creator N100N actions. N100N Studio requests now accept authenticated KRA bearer sessions; trusted machine-key use remains server-side, and launching a workflow still checks supervisor/admin role. **Fixed in source; not exercised against the hosted database.** |
| KRA-03 | **Medium — status UI** | The server returned `configured/baseUrl/ok`, while the Creator UI read `connected/configured/message/workflowCount`; a healthy N100N health response could still be shown as offline/unconfigured. | The status endpoint now returns an explicit `connected`, `configured`, and `message` contract. The UI no longer claims a workflow count before loading the list. **Fixed and statically verified.** |
| KRA-04 | **Medium — configuration** | Setup docs prescribed `KRA_N100N_BASE_URL` and `KRA_N100N_API_KEY`, while `KraN100nClient` only read `KRA_N100N_URL` and `KRA_N100N_TOKEN`; copying the documented server configuration did not configure the client. | Client now prefers documented `BASE_URL/API_KEY` variables and accepts the old `URL/TOKEN` names as compatibility aliases. Updated setup/integration docs and added tests for default, precedence, and legacy aliases. **Fixed and PHP-WASM tested.** |
| KRA-05 | **Medium — workflow execution** | The active execution lookup passed a query-string string into `execution(int $id)` under `strict_types`, risking `TypeError`; duplicate later N100N routes obscured the active contract. The UI route also used the synchronous `run()` path, which can hold PHP open for long workflows despite the documented async flow. | Validate and cast execution IDs before lookup, return 400 for malformed IDs and 502 for N100N failures, remove duplicate unreachable route implementations, and launch with `runAsync()` so the UI receives an execution ID promptly. **Fixed in source and covered by static checks; live N100N response shape remains unverified.** |
| KRA-06 | **High — CI reliability** | CI invoked `tools/verify-topdown-colony-renderer.js`, which is absent from the repository. The `verify:colony` script contains the actual Three.js verifier. The skill governance test also classified intentionally pending skills as lock corruption and attempted a live chat dispatch with no provider configured. | CI now invokes existing package verifications. Skill lock integrity reports pending approvals separately from corruption, while pending skills remain inactive; the skill test checks generated directives instead of calling a live provider. **Fixed; verification now passes with 105 checked / 56 approved / 49 pending / 0 integrity issues.** |
| KRA-07 | **Medium — session revocation** | The logout button only removed `sessionStorage`; a copied bearer token remained valid in the server-side `kra_users.session_hash`. | Added an authenticated `POST ?action=logout` that replaces the current stored session hash. The browser clears its token only after server revocation succeeds and shows an error otherwise. **Fixed in source/static tests; DB-backed revocation still needs staging verification.** |
| KRA-08 | **Low — test maintenance** | `verify-manual-page.js` expected a relative manual URL while the page uses a root-relative URL. The check failed although the current page path was intentional for the public root deployment. | Verifier now accepts either supported URL form. **Fixed; all 10 manual checks pass.** |
| KRA-09 | **Low — audit hygiene** | `KraAudit` excluded source/dependency directories but not `.temp`, the runtime task/workflow store. A project audit could scan transient/private runtime data as though it were source. | Added `.temp` to the excluded path list and extended the secret-scanner test with a synthetic runtime-token fixture to ensure that directory is skipped. **Fixed; audit secret test passes.** |

### Security hardening also applied

- `api/.htaccess` now denies `config.local.json` in addition to provider configuration files, preventing direct retrieval if an ignored local file is accidentally copied into the web root.
- Added `tools/verify-server-security.js` and `npm run verify:server-security`, and wired that check into CI.
- No production keys were added to source or tests. The synthetic values in the N100N client test are non-secret fixtures.

## Verification performed

### Passed

- Node syntax checks for `web/*.js`, `desktop/*.js`, and `tools/*.js`; `git diff --check`.
- `npm run verify:colony` (layout and Three.js renderer), `verify:vault-settings`, `verify:chat-modes`, `verify:creator-roster`, `verify:header-ui`, `verify:office-roster-drawer`, and the new `verify:server-security`.
- `tools/verify-manual-page.js`: 10/10 checks.
- Node skill tests: 10/10.
- PHP-WASM 8.5.10 syntax lint: all **83** PHP files under `api/` and `tools/`.
- PHP-WASM isolated tests: skill governance, task engine, terminal-command rejection, live-provider policy, read-only workspace browser, SIAS login policy, N100N environment config, audit secret detection, Creator workflow, and flow bridge (25/25 assertions).
- Skill lock result after remediation: 105 files checked, 56 approved, 49 pending review, zero integrity issues. Pending skills remain non-activatable until approval.
- KRA secret scanner: 0 possible secrets. Its whole-repository run reports 484 heuristic findings across 2,561 files: 481 low-severity long-line/readability notices and 3 medium hard-coded-path notices. The path notices are the configurable Windows PHP launcher default plus two test assertions; they are not confirmed leaked credentials. The scanner verdict is therefore a heuristic “needs revision,” not evidence of an exposed API key.

### Not run or not established

- Native PHP 8.4 CI was not run in this Linux workspace (`php` is not installed). PHP checks used PHP-WASM 8.5.10; CI remains configured for native PHP 8.4.
- `verify-pilar1-auth.php` cannot pass here because no MySQL service/database is available. SIAS schema, account status, session persistence, and real credentials were not tested.
- Six Electron/browser verifiers (`verify-atlas-render.js`, `verify-atlas-ui.js`, `verify-landscape-phase1.js`, `verify-pathfinding-atlas.js`, `verify-render-queue.js`, and `verify-transit-ui.js`) could not start because Electron is not installed in this checkout. Their failure was `Cannot find module 'electron'`, not an application assertion.
- No live N100N service, AI provider, Google/Obsidian integration, public domain, Exabytes PHP runtime, or production deployment was contacted. No real N100N workflow was launched.
- No visual production-browser inspection was performed. The existing office design preview uses simulated API responses and is not production verification.

## Deployment actions still required

1. Upload/deploy these source changes through the user's normal hosting workflow.
2. Configure `KRA_DB_HOST`, a dedicated `KRA_DB_USER`, and `KRA_DB_PASS` in the Exabytes-supported PHP/server environment. Configure the actual SIAS database name with `KRA_SIAS_DB` if it is not `sias`, and provide SIAS read credentials only if they differ from the KRA DB account. Do not put DB secrets in repository `.htaccess`.
3. Configure `KRA_N100N_BASE_URL` and a **newly rotated** `KRA_N100N_API_KEY` server-side. Keys previously pasted into chat must be rotated before deployment; do not send replacements in chat.
4. Verify sign-in, logout/revocation, N100N connection/list/start/result on staging, then repeat on the public site. The host controls PHP version and environment availability; repository edits cannot change Exabytes server settings.

## Historical-report note

`docs/audit-komplit-KRA.md`, `docs/remediation-status.md`, and the 30 October focused report describe earlier snapshots. In particular, the old “49 skill checksum drifts” count is not a current finding: this audit found 49 intentionally pending approvals, no checksum/lock integrity issues, and kept those skills inactive.
