# Content Creator mode and N100N handoff

## Two separate workspaces

- **Virtual Office** is for KRA software work, file proposals, audits, and server/operations questions. Office Team, Office direct channels, and Office hires stay in that mode.
- **Content Creator Studio** is for content planning. Its private chat history and Creator roster are separate. Creator specialists and Creator hires cannot be selected from Office channels; Office channels reject explicit Creator mentions and direct cross-routing.
- Creator specialist profiles are stored by KRA with `workspace.mode=creator`; Office roster hydration excludes them. Built-in Creator personas are `creator_research`, `creator_writer`, `creator_producer`, and `creator_reviewer`. Legacy browser-only Creator hires that are missing from the server roster are rejected by chat with an explicit error; they are never routed to Rama or another Office agent. Chat-generated proposals from Creator identities are scoped to the Creator task board.

## Standard content workflow

1. **Nara — research:** research brief, primary source links, verified claims, audience context, and unanswered questions. Mark facts versus assumptions. If web search did not actually run, do not claim current research.
2. **Aruna — script and metadata:** work only from the approved brief/research. Return hook, script, title/description ideas, source notes, and unsupported claims to verify.
3. **Dito — production plan:** transform the approved script into a storyboard, shot list, pacing, asset checklist, and production handoff. KRA does not claim to render or create video files.
4. **Lintang — editorial review:** report PASS or NEEDS REVISION and list concrete factual, rights, platform-policy, clarity, and metadata risks.
5. **Human approval:** review the material and the approval-gated KRA proposal/checklist. The next stage is not started just because a preceding agent replied.
6. **Optional N100N automation:** select a workflow the user already built in N100N, validate the handoff items, start it through the KRA PHP server, and monitor its execution ID. N100N can perform configured automations; KRA does not infer or claim what those automations do.
7. **YouTube:** the current KRA OAuth connection only reads channel identity. Upload/publishing is not implemented; never report a publish as complete.

Studio Crew sends sequential contributions so every specialist can read the prior reply. This can be slower than a private single-agent chat. It is a multi-perspective discussion, not a background job queue and not a substitute for stage approvals.

The Creator workflow starter in KRA is an approval-gated checklist scaffold. It is not a live web research, script-generation, render, or upload job. Use Creator chat for model-generated deliverables; use the workflow scaffold to track human-reviewed files and dependencies.

## N100N connection model

KRA’s `KraN100nClient` calls N100N from the PHP server—not from browser JavaScript. Configure the URL and REST key in **Creator → Integration Settings** or with server-only environment variables:

```env
KRA_N100N_BASE_URL=http://127.0.0.1:5679
KRA_N100N_API_KEY=<same value as N100N APP_API_TOKEN>
```

Use loopback only when KRA and N100N share a host. If separate, configure the private N100N IP/hostname reachable from the KRA host, and firewall port 5679 to the KRA host. Do not expose the API key to the browser, URL, workflow payload, source files, or Git. Environment variables override values saved by an authenticated KRA supervisor.

The KRA panel follows this sequence:

1. Check the KRA-server-to-N100N connection.
2. Load existing workflows (`GET /api/workflows`). KRA does not create workflows in N100N; create/edit them in N100N’s UI.
3. Prepare one or more input items as a JSON array.
4. A supervisor explicitly confirms the run. KRA calls `POST /api/workflows/:id/run?async=1`, avoiding a long PHP wait.
5. KRA displays and stores N100N’s `execution_id`; use **CHECK RESULT** to query `GET /api/executions/:id`.

The KRA confirmation authorizes starting an automation only. It is not the human editorial approval and it does not prove the workflow is safe. Review the selected N100N graph first; it can send messages, update sheets, make HTTP requests, or perform other configured effects. The KRA client does not automatically retry POST runs/webhooks, to avoid accidental duplicate side effects after a lost response.

## Creator handoff payload

N100N expects `items` as an array of objects. The Creator panel’s example button inserts this shape:

```json
[
  {
    "source": "KRA Content Creator Studio",
    "schema": "kra.creator.handoff.v1",
    "project": { "id": "replace-with-project-id", "title": "replace-with-approved-topic" },
    "stage": "production_handoff",
    "brief": {
      "topic": "replace-with-approved-topic",
      "audience": "replace-with-audience",
      "format": "shorts",
      "language": "id-ID",
      "script": "paste-reviewed-script-here",
      "research_sources": [],
      "review_verdict": "pending"
    },
    "approval": {
      "human_approved": false,
      "approved_by": "",
      "approved_at": null
    },
    "youtube": { "channel_id": "", "visibility": "private" }
  }
]
```

Replace placeholders with reviewed data. Build the N100N graph so an `ifElse` node checks `$json.approval.human_approved === true` before any external action and stops or routes to a review branch when the value is false. Only set the flag true after an actual human approval; a model’s `PASS` recommendation is not approval. Keep access tokens and API keys in N100N/KRA server configuration, not in `items`.

## N100N → KRA (optional inbound queue)

The existing machine-only `flow-*` bridge can receive tasks from N100N. `KRA_FLOW_API_KEY` on KRA must match `KRA_API_KEY` on N100N. For live AI handling, set `KRA_FLOW_MODE=agent`; choose an Office agent with `KRA_FLOW_AGENT=rama`, or a Creator agent such as `KRA_FLOW_AGENT=creator_writer`. Creator IDs route to their matching private Creator channel. If a live provider fails, the task is marked `gagal` instead of receiving a template pretending to be agent output. `KRA_FLOW_MODE=template` remains an explicitly deterministic test mode; `manual` waits for a human/workflow to submit the result.

Do not reuse a single webhook/task token as an LLM credential. Keep both integrations server-side and rotate keys if they have appeared in repository history or logs.
