# Phase 15: Task Router & Low-Cost Execution — Design

Status: draft, pending builder check and user approval.
Location note: placed in `docs/plans/` to match Phase 1 and Phase 2 (my call).

## Intent

Officers pick the cheapest working way to handle each task. Choice is based on:
1. Right skills for the task (few, small).
2. Sound reasoning path (no loop when one step is enough).
3. Low token cost (primary criterion, per user).

Phase name is Phase 15 because "Phase 3" is already used by the Skill Hub (2026-10-25).

## Goals

- Classify each incoming task with cheap local rules before any LLM call.
- Choose one execution mode per task: `native`, `single`, or `react`.
- Select at most 2 skills beyond the core `antislop` skill, sent as digest only.
- Record per task: mode, skills used, estimated tokens, stop reason. Keep it short.
- Give smaller ReAct budgets to simple tasks.
- Add a verifier that measures these numbers.

## Non-goals

- No new LLM provider or model change. Default stays `9router`, fallback chain unchanged.
- No change to Ollama install (user will do later).
- No change to `web/`, CSS, Canvas, pixel assets, or layout.
- No autonomous file writes. All writes still go through `KraTaskEngine` approval gate.
- No replacement of `KraReActEngine` loop logic. Only budget input changes.
- No new database engine or table. Metadata stored in existing task JSON/MySQL row fields.

## Anti-goals

- Router must not add an LLM call to decide routing (that defeats low cost).
- Router must not weaken approval gates or skill lock (`KraSkillLock`).
- Router must not silently drop a task that needs ReAct; when unsure, escalate to `react` with the normal budget.
- Must not expose keys, bearer tokens, or raw upstream errors in task metadata.

## Constraints

- PHP 8.2, MySQL `kra_db`, PHP built-in server on `:8088`.
- PHP built-in server is single-threaded: verifiers must not HTTP self-call; run via `terminal-run`.
- Server RAM is ~8 GB, no GPU. Keep prompts small.
- Existing components to reuse: `KraSkillEngine` (digest, routing), `KraReActEngine` (`runLoop`, `AUTONOMY_BUDGET`), `KraTaskEngine` (propose/approve), `KraAgentChat` (native Dimas/Siti tools).

## Design

### 1. `KraTaskRouter` (new, `api/lib/KraTaskRouter.php`)

Pure function, no I/O except reading the task text.

```
route(string $agentId, string $message): array
  -> ['mode' => 'native'|'single'|'react', 'skills' => string[] (max 2), 'budget' => array, 'reason' => string]
```

Rules, checked in order (first match wins):

1. `native`: message matches a known native tool intent for the agent.
   - Dimas: audit/scan/security keywords. Uses `KraAudit::run`.
   - Siti: status/database/ops/runtime/server keywords. Uses existing ops report.
   - Reuses the keyword lists already in `KraAgentChat::generateReply()`. Move them to one shared constant to avoid drift (small refactor, allowed).
2. `react`: message contains multi-step signals: `lalu`, `kemudian`, `then`, `refactor`, `fix`, `perbaiki`, `buat modul`, `audit lalu`, or more than one `@agent` mention, or length > 400 chars.
3. `single`: everything else. One LLM call through `completeWithFallback`.

Skill selection:
- Start from `KraSkillEngine` agent list, minus `antislop` (core, always included as digest).
- Keep only skills whose name or description keywords match the message; take at most 2.
- If none match, send no extra skill (core only).

Budget per mode:
- `native`: no LLM, no ReAct.
- `single`: `maxTokens` 600 (current value).
- `react`: `KraReActEngine::AUTONOMY_BUDGET` as-is (6 turns, 12 tool calls, etc.).
- Optional tighter ReAct budget for short `react` tasks: `maxTurns` 3, `maxToolCalls` 6. Applied when router returns `react` AND message length < 120 chars and no multi-step signal beyond the initial trigger.

### 2. Wiring

- `KraAgentChat::generateReply()`: call `KraTaskRouter::route()` first.
  - `native` → existing native branch (tool call, optional LLM rewrite with 300 tokens if `useLiveModel`).
  - `single` → existing `completeWithFallback` path, with skill digest limited to router result.
  - `react` → run `KraReActEngine::runLoop()` with the router's budget and skill list. ReAct runs read-only tools and analysis; any file change is returned as a structured proposal (actionType, targetFile, proposedContent, summary). The proposal is stored by `KraTaskEngine::propose()` and waits for `action=task-approve`. No file is written during ReAct.

- `KraExecutionRunner::execute()`: when `actionType === 'modify'` and the target file already exists, create a backup copy at `.temp/backups/<filename>.<timestamp>.bak` before writing the new content. This fulfills the requirement for safe backup on risky/modify actions without cluttering the project tree.

- `KraTaskEngine::propose()`: accepts optional `routing` array and stores it as a top-level `routing` key in the task object (not under `execution`, which gets overwritten on approval). Chat path: `detectProposal()` already exists; we pass `routing` through it into the proposal object before `propose()`.

### 3. Metrics (small, no new table)

Each routed reply carries:
- `routing.mode`
- `routing.skills` (names only)
- `routing.estTokens` = `strlen(message) / 4 + digestBytes / 4 + maxTokens_out_estimate`. Estimate only, labeled "est".
- `routing.stopReason` (ReAct only; `null` otherwise)

No raw prompts, no raw model output stored in metrics.

### 4. Verifier

`tools/verify-phase15-router.php`, CLI only, run through `terminal-run`:
- Router returns `native` for "audit keamanan" with agent dimas.
- Router returns `native` for "status database" with agent siti.
- Router returns `single` for "Halo Rama" with agent rama.
- Router returns `react` for "audit lalu perbaiki file X" with agent maya.
- Skill list length ≤ 2 and excludes `antislop` duplicate.
- Simple task budget is smaller than default ReAct budget.
- Metadata contains no key-like or bearer patterns.
- Empty message throws `InvalidArgumentException`.

### 5. Regression

Re-run: `verify-phase1-runtime.php`, `verify-phase2-chat.php`, `verify-phase4.php`, `verify-phase10-14.php`, `audit-cli.php`. Audit must show 0 secrets.

## Acceptance

- Verifier PASS on server.
- Regression verifiers PASS.
- Live `action=chat-agent` returns `routing.mode` in response.
- Estimated token metric shown for one `single` and one `native` case.
- Vault note recorded with honest status.

## Left to the builder

- Exact keyword lists (start from existing lists in `KraAgentChat`).
- Whether to store routing in MySQL column or only JSON (prefer JSON to avoid schema change).

## Calls made by me (for user to check)

1. Plan file in `docs/plans/` instead of `docs/superpowers/specs/`, to match existing project convention.
2. Router is rules-only, no LLM call.
3. `react` mode is decided by router but not newly wired into chat in this phase; it only changes budget for task execution paths. Wiring full ReAct into chat is out of scope.
4. Token numbers are estimates (chars / 4), not provider-billed counts.

## Open questions for user

- None yet. Builder check may add some.
