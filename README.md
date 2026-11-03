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

## Multiuser workspaces & Creator plans

KRA supports isolated per-user workspaces with server-enforced entitlements.
Exact SIAS admins (`admin`/`administrator`/`superadmin`) receive Creator
access automatically; other users need the workspace owner's active **KRA PRO
(Rp9.000/month, Rp100.000/year)**, **KRA PLUS (Rp15.000/month,
Rp150.000/year)**, **KRA PLATINUM (Rp50.000/month, Rp500.000/year)**, trial, or
signed offline license. Projects, chat memory, provider BYOK settings,
YouTube/N100N/Telegram credentials, and Obsidian notes stay scoped to the
active workspace on the machine running KRA.

See [`docs/COMMERCIAL-AND-WORKSPACES.md`](docs/COMMERCIAL-AND-WORKSPACES.md)
for plan differences, manual activation, offline licensing, hybrid
database/Obsidian memory, and the hosted-readiness checklist.

## Source layout

- `api/` — PHP API, agent chat, ReAct engine, audit, and skill governance.
- `web/` — current interactive virtual-office browser prototype.
- `n100n/` — bundled local automation engine (Node service on port 5679).
- `github-changer/` — bundled local Git/GitHub dashboard (Node service on port 4173),
  including the two-way KRA bridge. See [`github-changer/UPSTREAM.md`](github-changer/UPSTREAM.md)
  for the pinned upstream commit and local patches.
- `rna-router/` — bundled OpenRouter-compatible AI gateway (Next.js on port 3000)
  with a zero-dependency KRA health/model automation. See [`rna-router/UPSTREAM.md`](rna-router/UPSTREAM.md).
- `models/dsh-superagent-intern/` — one intern **agent model** adapted from the
  DeepSeek `dsh-superagent` research prototype; powers Dira, the supervised
  office intern. See [`docs/INTERN-SUPERAGENT.md`](docs/INTERN-SUPERAGENT.md).
- `resources/skills/` — installed skill folders, provenance, and the activation lockfile.
- `tools/` — importers, verification suites, evaluation harness, and CI gate.
- `docs/` — pipeline and integration specifications.

## Office intern (super-agent model)

**Dira** is the seventh office agent: a supervised *anak magang* adapted from
[`deepseek-ai/dsh-superagent-prototype`](https://github.com/deepseek-ai/dsh-superagent-prototype)
(`main` @ `6337fc8`). Only its philosophy and prompt discipline are vendored as
an agent model pack — the DSH runtime, GitHub/Feishu watchers, and autonomous
PR/push abilities are explicitly **not** included. Chat with her through the
`Dira` tab or `@dira` in Team; every result is a draft and real changes still go
through KRA's approval gate and Rama. Verify with `npm run verify:intern-agent`.

## Bundled automation services

Both services ship as source in this repo but run as **separate Node processes**
(they are never served by Apache/PHP — `.htaccess` blocks their source trees).

| Service | Start | Docs |
| --- | --- | --- |
| N100N (workflow engine) | `npm run n100n` / `Start n100n.bat` | [`docs/N100N_DEPLOYMENT.md`](docs/N100N_DEPLOYMENT.md) |
| GitHub Changer (Git/GitHub dashboard) | `npm run github-changer` / `Start GitHub Changer.bat` | [`docs/GITHUB-CHANGER-INTEGRATION.md`](docs/GITHUB-CHANGER-INTEGRATION.md) |
| RNA Router (AI gateway) | `npm run rna-router` / `Start RNA Router.bat` | [`docs/RNA-ROUTER-INTEGRATION.md`](docs/RNA-ROUTER-INTEGRATION.md) |
| RNA Router automation (health/model → KRA) | `npm run rna-router:automation` / `Start RNA Router Automation.bat` | [`docs/RNA-ROUTER-INTEGRATION.md`](docs/RNA-ROUTER-INTEGRATION.md) |

The KRA header has **✦ GitHub Changer** and **⚡ RNA Router** shortcuts (plus
Settings → Integrations entries) that open each dashboard, show bridge status,
and configure server-only service keys. `api/lib/KraGitHubChangerClient.php`
calls the Node `/api/kra/*` endpoints; GitHub Changer reports each automation
run back to `api/index.php?action=github-changer-event` with an HMAC signature.
`api/lib/KraRnaRouterClient.php` talks to RNA Router's `/api/health`,
`/api/v1/models`, and `/api/v1/chat/completions`; the provider entry
`rna-router` in `api/config.example.json` lets KRA agent chat use that gateway
with Ollama fallback, and `rna-router/scripts/kra-automation.js` posts signed
health/model reports to `action=rna-router-event`. On the Electron desktop the
two zero-dependency Node services auto-start and their secrets are paired
automatically; RNA Router (Next.js + database) is started by its own launcher.
Verify with `npm run verify:github-changer-bundle`,
`npm run github-changer:test`, `npm run verify:rna-router-bundle`, and
`npm run rna-router:test`.

For the exact `git pull` → secret pairing → launcher sequence on the XAMPP
machine, follow [`docs/DEPLOY-KRA-AUTOMATION-RUNBOOK.md`](docs/DEPLOY-KRA-AUTOMATION-RUNBOOK.md).

Deployment branch: **`arena/cbf4b10e-kantor-rama-ai`** — the optional signed
deploy workflow is `.github/workflows/deploy-kra.yml` (inactive until
`KRA_DEPLOY_ENABLED=true`). Pushing source does not start a Node service.

## Skill governance

- Installed skills live in `resources/skills/`.
- Activation authority is `resources/skills/SKILLS_LOCK.json`.
- Import with a pinned ref: `php tools/import-github-skill.php <owner/repo> <path/SKILL.md> [name] --ref=<sha>`.
- Register and approve: `php tools/skills-lock.php build` then `php tools/skills-lock.php approve <id|--all> --by=rama`.
- Verify and evaluate: `php tools/skills-lock.php verify` and `php tools/eval-skills.php`.
- Full CI gate: `php tools/skills-gate.php`.

## Operational rule

At the start of a task, read the memory vault. At the end of a task, save the decisions and link each new report from `Dashboard KRA Project.md`.
