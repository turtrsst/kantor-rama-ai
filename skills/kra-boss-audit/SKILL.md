---
name: kra-boss-audit
version: 1.0.0
description: |
  KRA Boss Audit — Rama's read-only executive review. Scans a target (folder,
  file, or recent change) for quality, structure, security and hygiene issues,
  then issues an executive verdict: APPROVED, NEEDS REVISION, or REJECTED /
  HALTED. No files are edited. Mirrors md-audit but adds boss-level verdicts
  and agent dispatch. (kantor-rama-ai)
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
---

## KRA Boss Audit (read-only)

Run an executive review of the target and return a verdict memo. **Do NOT edit any files.**

### Steps

1. **Scope** — identify the target root, primary language, and entry points
   (`package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `index.html`, or similar).

2. **Scan** — use `Grep`, `Glob`, and `Read` to look for:
   - Unhandled promise rejections / ignored errors
   - Hard-coded secrets or credentials (keys, tokens, passwords)
   - `TODO` / `FIXME` / `HACK` comments signalling known debt
   - Dead exports (exported symbols with no in-repo import)
   - Type-safety gaps (unchecked `any`, missing null guards)
   - **Structure & hygiene** — scattered files, orphaned docs, missing README, unlinked reports
   - **KRA rule compliance** — every report must link back to `Dashboard KRA Project.md`

3. **Verdict** — sort findings by severity and issue the boss memo:

   ```
   ## Boss Audit — <target name>

   ### Verdict
   [APPROVED | NEEDS REVISION | REJECTED / HALTED]

   ### The Good
   - <what was executed correctly>

   ### The Gaps
   - Critical: [file:line] <description>
   - High:     [file:line] <description>
   - Medium / Low: ...

   ### The Order
   - [ ] <action item> → <assigned subagent>

   ### Summary
   <total count> findings across <file count> files scanned.
   ```

4. **Dispatch** — assign each gap to the correct KRA subagent
   (`creator`, `modifier`, `auditor`, `dir-manager`) but take no action yourself.

5. **Report** — write the memo to `reports/<date> - <title>.md` and link it
   from `Dashboard KRA Project.md`.

6. Stop after reporting. Do not apply any fixes.
