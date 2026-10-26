# Phase 15: Task Router & Low-Cost Execution Implementation Plan

> **For agentic workers:** Execute task-by-task using TDD. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide an intelligent, rules-first task router that chooses the cheapest working execution path (`native`, `single`, or `react`), selects minimal skills, exposes token cost metrics, and ensures safe file modification backups with strict approval gates.

**Architecture:** Pure-rule `KraTaskRouter` classifies requests before model calls. `KraAgentChat` delegates to `KraTaskRouter`, routing to native tools, single-turn LLM, or read-only `KraReActEngine` which produces proposals waiting for user approval. `KraExecutionRunner` creates file backups before any destructive modification.

**Tech Stack:** PHP 8.2 (Windows), MySQL `kra_db`, existing KRA ReAct & Skill engines, `tools/verify-phase15-router.php` verifier.

**Spec:** `docs/plans/2026-10-26-phase-15-task-router-design.md`

## Global Constraints

- No modifications to `web/`, CSS, Canvas, layout, or pixel assets.
- Default provider remains `9router` with fallback to `simulator`.
- No LLM call may be made to decide routing (must be deterministic and zero-cost).
- No file modifications may occur during the ReAct phase; all modifications must emit a proposal with `WAITING_APPROVAL` status.
- Secret scan must pass with 0 secrets. No bearer tokens or raw API keys in responses or metrics.
- Built-in PHP server is single-threaded: verifiers run via terminal-run CLI without HTTP self-calls.

## Review Focus

- Empty message or whitespace-only must throw `InvalidArgumentException`.
- Multi-step signals combined with audit tools must correctly route to `react` instead of pure `native`.
- Skill selection must never exceed 2 skills (excluding core `antislop`) and must respect `KraSkillLock`.
- ReAct loops must respect custom tight budgets for simple tasks.
- Modifying a non-existent file in `KraExecutionRunner` must not fail backup step.

---

### Task 1: Create Failing Verifier for Task Router and Cost Metrics (RED)

**Files:**
- Create: `tools/verify-phase15-router.php`

**Interfaces:**
- Consumes: `KraTaskRouter::route(string $agentId, string $message): array`
- Produces: CLI verification with exit code 0 on PASS, 1 on FAIL.

- [ ] **Step 1: Write `tools/verify-phase15-router.php`**
  - Verify `KraTaskRouter::route('dimas', 'audit keamanan')` returns `mode === 'native'`.
  - Verify `KraTaskRouter::route('siti', 'status database')` returns `mode === 'native'`.
  - Verify `KraTaskRouter::route('rama', 'Halo Rama')` returns `mode === 'single'`.
  - Verify `KraTaskRouter::route('maya', 'audit lalu perbaiki file test.php')` returns `mode === 'react'`.
  - Verify selected skills count <= 2 and does not duplicate `antislop`.
  - Verify estimated tokens (`estTokens`) is non-negative and lower for native than single/react.
  - Verify `KraExecutionRunner` creates `.temp/backups/*.bak` when modifying existing file.
  - Verify empty message throws `InvalidArgumentException`.

- [ ] **Step 2: Run test to verify it fails (RED)**
  - Execute via server terminal-run POST: `C:\xampp\php\php.exe tools\verify-phase15-router.php`.
  - Expected: FAIL with class or method not found.

---

### Task 2: Implement Pure `KraTaskRouter` Engine (GREEN)

**Files:**
- Create: `api/lib/KraTaskRouter.php`

**Interfaces:**
- Produces: `KraTaskRouter::route(string $agentId, string $message): array`
  - Returns `['mode' => string, 'skills' => array, 'budget' => array, 'estTokens' => int, 'reason' => string]`

- [ ] **Step 1: Implement `KraTaskRouter.php`**
  - Define rules in order: multi-step signals + keyword collision -> `react`, pure agent tool keywords -> `native`, default -> `single`.
  - Implement skill selection: pull active skills from `KraSkillEngine`, match keywords against message, take at most 2, exclude `antislop`.
  - Calculate `estTokens`: `intval(strlen($message) / 4) + ($mode === 'native' ? 0 : 600)`.
  - Provide budget: standard ReAct budget or tight budget (turns: 3, toolCalls: 6) if message < 120 chars.

- [ ] **Step 2: Run `tools/verify-phase15-router.php` check on router unit**
  - Confirm router logic unit tests pass.

---

### Task 3: Automatic Backup in `KraExecutionRunner` (GREEN)

**Files:**
- Modify: `api/lib/KraExecutionRunner.php`

**Interfaces:**
- Consumes: `$task['actionType']`, `$task['targetFile']`
- Produces: `.temp/backups/<filename>.<timestamp>.bak` when `actionType === 'modify'` and file exists.

- [ ] **Step 1: Update `KraExecutionRunner::execute()`**
  - Check if `$action === 'modify'` and file exists.
  - Ensure `.temp/backups` directory exists.
  - Copy target file to `.temp/backups/<basename>.<timestamp>.bak`.
  - Include `backupPath` in return array.

- [ ] **Step 2: Verify backup creation in verifier**

---

### Task 4: Integrate Router & ReAct Proposals into `KraAgentChat` (GREEN)

**Files:**
- Modify: `api/lib/KraAgentChat.php`

**Interfaces:**
- Consumes: `KraTaskRouter::route()`
- Produces: Extended chat responses with `routing` block; executes `KraReActEngine::runLoop()` for `react` mode and stages proposal on file action.

- [ ] **Step 1: Wire `KraTaskRouter` into `generateReply()`**
  - Call `KraTaskRouter::route()` at start of `generateReply()`.
  - If mode is `native`, use native tool dispatch.
  - If mode is `react`, run `KraReActEngine::runLoop()`. If tool outputs `stage_proposal` or proposal pattern detected, create proposal via `KraTaskEngine::propose()` with `routing` metadata.
  - Attach `routing` array (`mode`, `skills`, `estTokens`, `reason`) to reply.

- [ ] **Step 2: Run full `tools/verify-phase15-router.php` on server**
  - Verify complete passing status (GREEN).

---

### Task 5: Regression Suite & Obsidian Documentation

**Files:**
- Note: `\\100.76.172.67\c$\vault\KRA\01-KRA\Agent-Runs\`
- Update: `\\100.76.172.67\c$\vault\KRA\Dashboard KRA Project.md`

- [ ] **Step 1: Run full regression suite**
  - `tools/verify-phase1-runtime.php`
  - `tools/verify-phase2-chat.php`
  - `tools/verify-phase4.php`
  - `tools/verify-phase10-14.php`
  - `tools/audit-cli.php`

- [ ] **Step 2: Live HTTP chat verification**
  - Test `POST action=chat-agent` with native, single, and react prompts. Confirm `routing` block present and zero token leakage.

- [ ] **Step 3: Record outcome in Obsidian vault via memory bridge**
  - Run `capture.ps1` to log Agent-Run note.
  - Update `Dashboard KRA Project.md` milestone.
