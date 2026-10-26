# Phase 1 Runtime Foundation Implementation Plan

> **For agentic workers:** Execute task-by-task. Do not modify pixel design files.

**Goal:** Make KRA server runtime observable, reproducible, and ready for useful LLM work without changing visual UI or assets.

**Architecture:** Keep PHP API, MySQL, server vault, provider gateway, and batch launcher as separate runtime boundaries. Add health visibility and environment-driven verification; preserve `9router -> ollama -> simulator` fallback.

**Tech Stack:** PHP 8.2 CLI, MySQL/MariaDB, Windows XAMPP, PowerShell batch launcher, existing KRA gateway.

**Spec:** `README.md`, `install.md`, `api/index.php`, `api/lib/KraRouterGateway.php`.

## Global Constraints

- Source project: `C:\xampp\htdocs\kantor-rama-ai` on server `100.76.172.67`.
- Memory vault: `C:\vault\KRA` on server.
- Remote browser URL: `http://100.76.172.67:8088/web/index.html`.
- PHP server bind: `100.76.172.67:8088`.
- Provider fallback remains `9router -> ollama -> simulator`.
- Do not modify `web/`, pixel assets, Canvas rendering, CSS visual design, or layout files.
- Never expose API keys, passwords, cookies, or tokens in health responses or notes.
- No DB destructive operation. Auto-migration only through existing KRA path.

## Review Focus

- Missing vault: runtime must report unavailable, not claim healthy.
- Provider offline: health must show provider state and preserve simulator fallback.
- Wrong working directory: batch must fail clearly before PHP starts.
- Existing port 8088: batch must avoid duplicate PHP process.
- DB unavailable: runtime must report false without data loss.

---

### Task 1: Runtime Documentation and Path Contract

**Files:**
- Modify: `README.md`
- Modify: `install.md` only if server path or launch command is stale

- [x] Update project and vault paths to server runtime values.
- [x] Document `Start KRA.bat` and remote browser URL.
- [x] Document 9Router health requirement and Ollama optional fallback.
- [x] Verify no stale `D:\vault\KRA` or old Apache URL remains in runtime docs.

### Task 2: Runtime Health Contract

**Files:**
- Modify: `api/index.php`
- Test: `tools/verify-phase1-runtime.php`

- [x] Add runtime fields for project root, memory root, memory readable/writable, default provider, provider health summary, PHP version, and database state.
- [x] Keep health response secret-free.
- [x] Add failing assertions for `memoryRoot=C:\vault\KRA`, `memoryExists=true`, database boolean, and provider summary.
- [x] Run test against `http://100.76.172.67:8088/api/index.php`.

### Task 3: Provider Health Verification

**Files:**
- Modify: `tools/verify-phase1-runtime.php`
- Modify: `api/lib/KraRouterGateway.php` only if current response cannot represent offline state

- [x] Verify 9Router status on port 20128.
- [x] Verify Ollama status on port 11434 without requiring Ollama installation.
- [x] Verify simulator is available as safe fallback.
- [x] Verify no credential values appear in output.

### Task 4: Server Launcher Preflight

**Files:**
- Modify: `Start KRA.bat`

- [x] Check project directory exists.
- [x] Check PHP executable exists.
- [x] Check vault directory exists.
- [x] Set process-local `KRA_MEMORY_ROOT=C:\vault\KRA`.
- [x] Preserve duplicate port guard and remote URL.
- [x] Exit with readable error when preflight fails.

### Task 5: Full Verification Gate

**Files:**
- No visual files

- [x] Run `C:\xampp\php\php.exe tools\verify-phase1-runtime.php` on server.
- [x] Run existing `C:\xampp\php\php.exe tools\verify-phase4.php` with runtime URL corrected or environment override.
- [x] Run `C:\xampp\php\php.exe tools\verify-phase10-14.php`.
- [x] Run `C:\xampp\php\php.exe tools\audit-cli.php`.
- [x] Record actual outputs and unresolved findings in server vault.

## Ollama Decision

Ollama executable was not found in common server paths and port `11434` is currently unreachable. Installation requires RDP or an approved server-local administrator session. Do not install remotely through the SMB share. First inspect server GPU/RAM, then install Ollama on server and pull a model sized for available hardware.
