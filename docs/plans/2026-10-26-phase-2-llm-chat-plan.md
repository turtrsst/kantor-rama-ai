# Phase 2: LLM Chat Integration Implementation Plan

> **For agentic workers:** Execute task-by-task using TDD. Do not modify pixel design, CSS, Canvas, layout, or asset files.

**Goal:** Integrate KRA officer chat with 9Router as default provider, safe fallback to simulator, and observable metadata without secret leakage.

**Architecture:** Route single-officer chat through `KraRouterGateway::completeWithFallback()`; return normalized metadata (`provider`, `model`, `fallbackUsed`, `fallbackProvider`, `attempts`); keep team broadcast on fast role-based simulator; preserve approval gates.

**Tech Stack:** PHP 8.2 CLI, MySQL/MariaDB, 9Router OpenAI-compatible API on port 20128, native KRA fallback chain.

**Spec:** `docs/plans/2026-10-26-phase-2-llm-chat-design.md`, `api/lib/KraAgentChat.php`, `api/lib/KraRouterGateway.php`.

## Global Constraints

- No visual, pixel, Canvas, CSS, or `web/` modifications.
- Default provider remains `9router`.
- Port 20128 is active on server; port 11434 remains offline until user installs Ollama.
- No raw error text or provider API keys leaked in responses, notes, or test output.
- No direct autonomous file writes.
- DB auto-migration path untouched.

## Review Focus

- Empty message must return clear error, not trigger provider.
- Unavailable provider must gracefully fall back to simulator without failing HTTP request.
- Metadata must never expose upstream error stack traces or bearer tokens.
- Team broadcast must not execute 5 serial remote LLM calls.
- Secret scan must pass clean.

---

### Task 1: Failing Test for Chat Integration and Fallback (RED)

**Files:**
- Create: `tools/verify-phase2-chat.php`

- [ ] Write CLI verifier that tests:
  - Direct `completeWithFallback` simulator returns content.
  - `KraAgentChat::dispatch` single-officer message returns required metadata fields.
  - Fallback used flag is boolean.
  - Attempts array contains normalized provider names only.
  - Secret scan confirms no keys in response JSON.
  - Empty message throws `InvalidArgumentException`.
- [ ] Run test on server and verify failure (RED).

### Task 2: Implement Chat Fallback Integration (GREEN)

**Files:**
- Modify: `api/lib/KraAgentChat.php`

- [x] Update `generateReply()` to use `KraRouterGateway::completeWithFallback()` for live model requests.
- [x] Normalize attempts to `[provider, 'online'|'offline']` removing raw exception messages.
- [x] Attach `fallbackUsed`, `fallbackProvider`, `attempts` to `generateReply()` output.
- [x] In `dispatch()`, forward new metadata fields to each reply element.
- [x] Ensure role-based fallback reply retains `fallbackUsed: true` and `provider: 'simulator'`.

### Task 3: Run Verification Suite (VERIFY)

**Files:**
- No visual files

- [x] Run `tools/verify-phase2-chat.php` via server terminal bridge.
- [x] Run `tools/verify-phase1-runtime.php`.
- [x] Run `tools/verify-phase4.php`.
- [x] Run `tools/verify-phase10-14.php`.
- [x] Run `tools/audit-cli.php`.
- [x] Confirm HTTP status via live curl/Invoke-RestMethod against `action=chat-agent`.

### Task 4: Record Outcome in Obsidian Memory Bridge

**Files:**
- Note: `\\100.76.172.67\c$\vault\KRA\01-KRA\Agent-Runs\`

- [x] Record test evidence, provider status, and next steps in vault.
