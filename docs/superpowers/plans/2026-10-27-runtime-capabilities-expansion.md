# Runtime Capabilities Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand KRA runtime with GitHub Actions integration, real-time web research, and Remotion motion graphics pipeline.

**Architecture:** Bridge pattern implementation in `api/lib/`. Each capability gets a dedicated service class and corresponding ReAct tools in `KraReActEngine`. GitHub uses CLI wrapper; Web Research uses direct HTTP/HTML parsing; Remotion uses Node/NPX CLI wrapper.

**Tech Stack:** PHP 8.x (Backend), GitHub CLI (gh), Remotion (Node/React), HTML5/JS (Frontend Preview).

**Spec:** Requirement for 6 core capabilities: (1) OS/Terminal, (2) Memory, (3) GitHub Actions, (4) Web Research, (5) Software Engineering, (6) Remotion. (1, 2, 5 already partially verified).

## Global Constraints

- No new external heavy dependencies if native/stdlib alternative exists.
- Keep `KraReActEngine` tool catalog clean and parameter-driven.
- All new tools must respect safety gates and project root boundaries.
- Tests must be runnable via `php tools/test-*.php`.

## Review Focus

- GitHub Actions: Token/Auth failure handling in CLI wrapper.
- Web Research: HTML-to-Text converter quality and snippet length.
- Remotion: Process timeout and resource cleanup for long renders.
- Safety: Command injection prevention in bridge classes.

---

### Task 1: GitHub & GitHub Actions Integration

**Files:**
- Create: `api/lib/KraGitHubBridge.php`
- Create: `tools/test-github-bridge.php`
- Create: `.github/workflows/ci.yml`
- Modify: `api/lib/KraReActEngine.php`

**Interfaces:**
- Produces: `KraGitHubBridge::dispatch(string $workflow, string $ref, array $inputs)`
- Produces: `KraGitHubBridge::listRuns(string $workflow)`
- Produces: `gh_dispatch`, `gh_runs` ReAct tools.

- [ ] **Step 1: Write failing `tools/test-github-bridge.php`**
- [ ] **Step 2: Run test, verify FAIL**
- [ ] **Step 3: Implement `KraGitHubBridge.php`**
  - Use `gh` CLI via `KraTerminalBridge` for auth/execution simplicity.
- [ ] **Step 4: Update `KraReActEngine.php`**
  - Add `gh_runs` and `gh_dispatch` to tool catalog and switch-case.
- [ ] **Step 5: Create `.github/workflows/ci.yml`**
  - PHP lint and `tools/verify-pilar1-auth.php` check.
- [ ] **Step 6: Run test, verify PASS**
- [ ] **Step 7: Commit**

### Task 2: Real-time Web Research & Fetch

**Files:**
- Create: `api/lib/KraWebSearchBridge.php`
- Create: `tools/test-web-research.php`
- Modify: `api/lib/KraReActEngine.php`

**Interfaces:**
- Produces: `KraWebSearchBridge::search(string $query)`
- Produces: `KraWebSearchBridge::fetch(string $url)`
- Produces: `web_search`, `web_fetch` ReAct tools.

- [ ] **Step 1: Write failing `tools/test-web-research.php`**
- [ ] **Step 2: Run test, verify FAIL**
- [ ] **Step 3: Implement `KraWebSearchBridge.php`**
  - Use `curl` to DuckDuckGo HTML / Serper API.
  - Implement HTML-to-Text/Markdown cleaner for clean context.
- [ ] **Step 4: Update `KraReActEngine.php`**
  - Add `web_search` and `web_fetch` tools.
- [ ] **Step 5: Run test, verify PASS**
- [ ] **Step 6: Commit**

### Task 3: Remotion Pipeline

**Files:**
- Create: `api/lib/KraRemotionBridge.php`
- Create: `remotion/package.json`
- Create: `remotion/src/Root.tsx`
- Create: `tools/test-remotion-bridge.php`
- Modify: `api/lib/KraReActEngine.php`

**Interfaces:**
- Produces: `KraRemotionBridge::render(string $composition, array $props)`
- Produces: `remotion_render` ReAct tool.

- [ ] **Step 1: Write failing `tools/test-remotion-bridge.php`**
- [ ] **Step 2: Run test, verify FAIL**
- [ ] **Step 3: Scaffolding `remotion/` directory**
  - `npm init`, install `remotion`, set up minimal project.
- [ ] **Step 4: Implement `KraRemotionBridge.php`**
  - `npx remotion render` wrapper with output mapping to `assets/renders/video/`.
- [ ] **Step 5: Update `KraReActEngine.php`**
  - Add `remotion_render` tool.
- [ ] **Step 6: Run test, verify PASS**
- [ ] **Step 7: Commit**
