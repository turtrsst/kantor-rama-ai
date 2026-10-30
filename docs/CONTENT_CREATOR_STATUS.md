# Content Creator Studio: current status

## Available in KRA

- Switch between Virtual Office and Content Creator; the choice is kept in browser local storage.
- Content Creator starts with four built-in specialists—Nara (research), Aruna (script/metadata), Dito (production planning), and Lintang (quality review)—so the studio does not require manual hires. Each card's **CHAT** button opens a dedicated Studio Terminal without switching to Virtual Office. It has a shared **Studio Crew** group that broadcasts each prompt to all four specialists with a rolling shared transcript, plus individual specialist tabs. The Studio terminal has its own provider selector and isolated persisted group/private channels, plus approval-aware live provider chat.
- The 3D crew has desks/computers and an ambient visual cycle (typing, thinking, discussing, break, stretch). This is a simulation only; it does not claim that an AI task is running. Use each agent's CHAT button or queue a workflow for actual model work.
- The Task Board has distinct **Virtual Office** and **Content Creator** scopes. Task counts and lists are filtered by scope, each card carries a context badge, and opening the board defaults to the active app mode. Both views share the same approval engine without mixing their task lists.
- Save the starter YouTube workflow, inspect its dependency plan, and queue a stage.
- Queued stages create normal KRA Task Board proposals. A stage that writes a file remains `WAITING_APPROVAL` until a supervisor approves it. A later dependent stage cannot be queued before its preceding task reaches `EXECUTED`.
- Rejected or failed stages can be queued again as a new proposal; the old decision stays in Task Board history.
- The starter drafts are explicit editable checklists/placeholders. No source research, AI script generation, video rendering, channel connection, or upload is claimed.
- Each draft file is created only through the existing approval-gated runner. Starter output goes under `docs/content-creator/<workflow-name>/` after approval.
- The workflow list and state are stored locally in `.temp/workflows.json`; related proposals remain in the KRA Task Board store.

## Not available yet

- Google OAuth and YouTube channel management have not been implemented. The settings panel must continue to say **Not Connected**; the disabled connect control is not an OAuth implementation.
- Actual live-agent research/script generation and media rendering are not dispatched by these scaffold tasks.
- YouTube upload is not implemented. The final checklist asks the user to choose visibility, but this is not an upload approval action and cannot publish anything.
- KRA now includes an authenticated server-side N100N bridge in Content Creator: connection check, workflow listing, supervisor-gated run with explicit confirmation, and execution lookup. Configure `KRA_N100N_BASE_URL` and `KRA_N100N_API_KEY` in the Apache/PHP environment; the default base URL is loopback port 5679. The real service connection remains unverified from this checkout because the user's XAMPP/N100N host and rotated REST key are not available here. See `docs/N100N_SETUP.md`.

## Smoke test

Run `npx php-wasm-cli tools/test-creator-workflow.php`. It checks DAG ordering, approval-gated file writes, dependency blocking, retry after rejection, final visibility checklist, completion state, traversal rejection, and cycle rejection. The UI also requires a signed-in KRA session to call workflow APIs.
