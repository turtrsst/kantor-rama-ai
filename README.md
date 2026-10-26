# Kantor-Rama-AI (KRA)

> Multi-agent virtual office project source.

## Project location

```text
\\100.76.172.67\c$\xampp\htdocs\kantor-rama-ai\
```

## Memory vault

KRA's persistent rules, decisions, reports, and Obsidian configuration live separately at:

```text
C:\vault\KRA\
```

### Memory root

- `C:\vault\KRA\Dashboard KRA Project.md` — project dashboard, decisions, and report index.
- `C:\vault\KRA\KRA.md` — Jarvis operating role and safety/memory rules.
- `C:\vault\KRA\reports\` — all future generated reports.

## Source layout

- `api/` — PHP API, agent chat, ReAct engine, audit, and skill governance.
- `web/` — current interactive virtual-office browser prototype.
- `resources/skills/` — installed skill folders, provenance, and the activation lockfile.
- `tools/` — importers, verification suites, evaluation harness, and CI gate.
- `docs/` — pipeline and integration specifications.

## Skill governance

- Installed skills live in `resources/skills/`.
- Activation authority is `resources/skills/SKILLS_LOCK.json`.
- Import with a pinned ref: `php tools/import-github-skill.php <owner/repo> <path/SKILL.md> [name] --ref=<sha>`.
- Register and approve: `php tools/skills-lock.php build` then `php tools/skills-lock.php approve <id|--all> --by=rama`.
- Verify and evaluate: `php tools/skills-lock.php verify` and `php tools/eval-skills.php`.
- Full CI gate: `php tools/skills-gate.php`.

## Operational rule

At the start of a task, read the memory vault. At the end of a task, save the decisions and link each new report from `Dashboard KRA Project.md`.
