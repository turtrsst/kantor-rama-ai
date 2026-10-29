---
name: obsidian-memory-bridge
description: Record completed, meaningful KRA work as an Obsidian Agent-Run note in \\100.76.172.67\c$\vault\KRA\01-KRA\ and link it to Dashboard KRA. Use at the end of any task that changed files, ran tests, or made a decision.
metadata:
  opencode/slash: "true"
---

## When to use
Use at the end of a meaningful task: files changed, tests run, a decision made, or work blocked/failed.
Skip for casual questions, trivial lookups, and interactions with no outcome.

## Steps
1. Gather facts from this session only: title, objective, scope, actions actually performed, files changed (paths), tests run with their real output, decisions, unresolved issues, next steps.
2. Choose status honestly: `proposed`, `in-progress`, `blocked`, `failed`, or `verified`. Use `verified` only if a test or check was run and passed.
3. Write the body to a temp file in `C:\Users\TU\AppData\Local\Temp\opencode\` (not in the vault).
4. Run:
   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\TU\.config\opencode\skills\obsidian-memory-bridge\scripts\capture.ps1" -Title "<title>" -Project "KRA" -Status "<status>" -BodyFile "<temp file>"
   ```
5. Read the script output. It reports `CREATED` or `SKIPPED (duplicate)` and the path written.
6. Report the note path to the user.

## Note format
Filename: `YYYY-MM-DD-<slug>.md` in `\\100.76.172.67\c$\vault\KRA\01-KRA\Agent-Runs\`.
Frontmatter fields: `type: agent-run`, `project`, `status`, `created`, `tags`.
Links: `[[Dashboard KRA]]` and `[[KRA]]` always. Link any other note only if it exists; otherwise write "planned: <name>" with no link.

## Rules
- Never write secrets, passwords, tokens, cookies, or keys.
- Never modify existing notes except the dashboard link insert done by the script.
- Do not write to the production app files as part of this skill.
- Do not write large logs. Summarize; keep test output to the relevant lines.
- Ask the user before any write outside `\\100.76.172.67\c$\vault\KRA\01-KRA\`.
