# KRA Visual & Navigation Engine Specification

> **Status:** Approved implementation target; staged rollout.  
> **Runtime:** Native Web-HTML5 Canvas 2D inside Electron.  
> **Project:** `C:\xampp\htdocs\kantor-rama-ai`  
> **Memory root:** `C:\vault\KRA`  
> **Reference:** User-supplied pixel office image `C:\Users\hp\Downloads\image_b8a1d35.jpg` (visual guide only; not a runtime dependency).

This document is the implementation contract for KRA's 2.5D visual asset pipeline, rendering, navigation, and ownership rules. It complements the approved agent/event contracts in `C:\vault\KRA\specs\AGENT_ACTIVITY_EVENT_BUS.md` and `C:\vault\KRA\agents\Agent Control Matrix.md`.

## Goals and constraints

- Keep the virtual office on native Canvas 2D; do not add Unity, Godot, WebGL, or WASM runtimes.
- Preserve the Propose-then-Approve boundary for work that can write or modify files.
- Maintain per-authenticated-user decoration isolation; never trust a browser-supplied `owner_id`.
- Keep assets crisp, deterministic, metadata-driven, and cheap to render.
- Treat `<0.1s` loading, `<50MB` memory, and stable 60 FPS as **measurement targets**, not guarantees. Validate these against the packaged Electron build and representative assets before claiming compliance.

## 1. Asset pipeline: 3D-baked voxel sprite (top-down 3/4 view)

### Authoring workflow

1. Model furniture, equipment, and architectural props in Blockbench (`.bbmodel`) to control voxel volume, bevels, proportions, and material colors.
2. Use a consistent top-down 3/4 orthographic camera. Wall faces point toward the camera/front and rise toward the back; floors and desktop surfaces remain readable as horizontal planes.
3. Keep each object centered on a documented grid footprint. Place its pivot at the lowest floor-contact point, not at the image center.
4. Export a diffuse PNG and an emission PNG with identical canvas dimensions, frame bounds, scale, and transparent padding.
5. Keep editable Blockbench source alongside exports. Exported PNGs are runtime assets; Blockbench is not a runtime dependency.

### Maps

- **Diffuse Map:** object colors and baked static contact/cast shadows. Keep lighting baked into this map restrained so runtime lights remain legible.
- **Emission Map:** transparent background; non-emissive pixels have alpha 0, emissive pixels carry the intended glow color and alpha. Its pixel coordinates must align exactly with the diffuse map.
- Avoid black-filled emission backgrounds. They waste atlas space and make alpha/compositing behavior ambiguous.

## 2. Sprite atlas metadata

Canonical example path: `assets/voxel/atlas/office_furniture.json`.

```json
{
  "texture_file": "office_furniture_diffuse.png",
  "emission_file": "office_furniture_emission.png",
  "grid_size": 32,
  "sprites": {
    "server_rack_jarvis": {
      "frame": { "x": 0, "y": 0, "w": 64, "h": 96 },
      "pivot": { "x": 32, "y": 80 },
      "grid_occupancy": { "cols": 2, "rows": 1 },
      "has_emission": true
    },
    "arcade_machine_dimas": {
      "frame": { "x": 64, "y": 0, "w": 32, "h": 64 },
      "pivot": { "x": 16, "y": 48 },
      "grid_occupancy": { "cols": 1, "rows": 1 },
      "has_emission": true
    }
  }
}
```

### Metadata invariants

- `frame` is a non-negative rectangle in atlas pixels and must fit inside both maps.
- `pivot` is relative to the frame, lies within the frame, and marks the lowest floor-contact point. Use `pivot.y` as the Y-sorting anchor.
- `grid_occupancy` is the static floor footprint in grid cells. A footprint is not inferred from sprite image dimensions. Atlas decorator placement validates the full footprint against map bounds, floor cells, static decor, custom decor, and active agents; cached occupied cells also block floor-aware A* routing, and erase removes the placed sprite by its origin footprint.
- `has_emission` must agree with the emission map's alpha content for that frame.
- Diffuse and emission atlas image dimensions must match exactly.
- Validate metadata at load/build time. Invalid frames, out-of-range pivots, missing maps, and inconsistent occupancy are errors, not silent fallbacks.

`assets/voxel/atlas/office_furniture.json` is the starter catalog. The matching PNG atlases and Blockbench source are shipped beside it. Assets can be inspected before renderer integration.

## 3. Canvas 2D rendering and caching

Canvas element: `#office-canvas`. Keep native Canvas 2D and disable interpolation:

```javascript
ctx.imageSmoothingEnabled = false;
```

### Render stages

1. Build the active-floor render queue. Exclude entities on inactive floors and entities whose state makes them invisible (e.g. fully inside the elevator). Sort drawable entities by their world-space Y anchor: `renderQueue.sort((a, b) => a.y - b.y)`; sprite objects use `pivot.y` to derive that anchor.
2. Draw the floor/base layer, then render queued objects and agents in deterministic depth order so foreground sprites can occlude background agents. Static architectural base art may be pre-drawn as a floor buffer; do not draw all furniture before all agents when that breaks Y-ordering.
3. If the selected art direction needs a night/contrast treatment, apply an ambient multiply overlay (`#1a1a24`) as a separate, measured pass. This is optional and must be visually validated against the approved reference; it must not unexpectedly darken baked diffuse shadows.
4. Apply existing radial room lights and emission. Pre-render or cache stable sprite/emission composites in offscreen buffers; the main canvas should use `drawImage()` for cached sprite layers.
5. Animate shimmer only for a small set of active lights/emissive items. Do not use per-sprite `shadowBlur` on every frame as the primary glow implementation.

### Cache and memory rules

- Load metadata and maps once; validate matching dimensions and decode completion before making the atlas active.
- Cache by asset/frame and lighting variant; do not create new offscreen canvases each render frame.
- Release/reuse buffers on atlas replacement and avoid retaining duplicate decoded images.
- Keep the native Canvas fallback until the atlas integration has passed browser/Electron verification.

## 4. Agent navigation, floors, and elevator state machine

Keep **logical state** (agent floor/position/route/state) separate from **visual effects** (fade, elevator doors, camera). An animation must not be the source of truth for agent location.

### Required transit lifecycle

1. `IDLE`: At current floor position; retain existing procedural bobbing.
2. `WALKING_TO_ELEVATOR`: Plan a collision-safe route to the origin floor's `ElevatorWaypoints` entrance.
3. `WAITING_FOR_ELEVATOR`: Wait for availability/door opening; reject or queue conflicting external movement commands for this agent.
4. `ENTERING_ELEVATOR`: Animate into the cabin; interaction is disabled while the agent is committed to transit.
5. `IN_TRANSIT`: Agent is not rendered as a normal floor entity and cannot be selected by canvas hit-testing. Persist transit state.
6. `EXITING_ELEVATOR`: On the destination floor, set `floorId` and local coordinates atomically in logical state, then animate out of the cabin.
7. `WALKING_TO_TARGET`: Continue the planned destination route on the destination floor.

State changes and observable events should follow the typed event envelope and state transition rules in `C:\vault\KRA\specs\AGENT_ACTIVITY_EVENT_BUS.md`. Emit concise factual status; do not expose hidden reasoning. Persist floor, transit, coordinates, and state with presence data. State/presence does not grant filesystem authority.

### Floor rendering and camera

- Filter entities by `entity.floorId === activeFloorId` before sorting/rendering.
- Use Y-sorting within a floor; do not compare Y across different floors.
- Fade the old floor, move the camera/floor focus, and fade in the destination as visual effects after/alongside valid logical transitions.
- Inactive-floor hit targets must not receive pointer input. An agent on another floor may be focused by explicitly switching the camera to its floor.
- Elevator door/arrival transitions should have bounded duration and a safe completion/failure path; a missing callback must not strand an agent permanently in `in_transit`.

## 5. Backend and data security

- Decoration endpoints must authenticate a session/Bearer token on the server.
- The server derives owner identity from the verified session. Ignore client-supplied `owner`/`owner_id` fields.
- Reads, inserts, tile deletes, and floor clears must all scope database queries to the authenticated owner.
- Validate floor, item identifier, coordinates, and request method server-side; use parameterized SQL.
- Preserve 401 rejection for unauthenticated decoration API access and test IDOR payload tampering with two distinct users.
- Keep secrets out of source, client storage, logs, reports, screenshots, and audit output.

## 6. Independent subagent workflow and Obsidian memory

Subagents may independently inspect, design, and propose work within their role dossier and authority in `C:\vault\KRA\agents\Agent Control Matrix.md`. Use specialist agents only where useful; report observable evidence and decisions. No agent may bypass Rama/user approval for gated file writes, deployment, or destructive changes.

For each delivered milestone:

1. Verify relevant code and runtime behavior.
2. Run the Rama audit and report the exact verdict.
3. Create a dated report under `C:\vault\KRA\reports\` with implementation, evidence, limitations, and next steps.
4. Add a linked milestone to `C:\vault\KRA\Dashboard KRA Project.md` and keep the roadmap checkboxes/status accurate.

## 7. Delivery order and current implementation status

Approved order remains:

1. **Pilar 1 — security and per-user decoration isolation:** delivered and verified.
2. **Pilar 3 — cross-floor state and elevator transit:** backend persistence and a browser/Electron waypoint-to-lift-to-destination UI transit now pass. Failure recovery, contention/queue behavior, and arrival-to-target routing remain acceptance items.
3. **Pilar 2 — diffuse/emission atlas, metadata validation, offscreen caching:** starter atlas PNGs are loaded and validated; frame composites are cached, atlas props can be placed through the authenticated decorator, footprint occupancy is reserved/validated, and atlas props plus agents share a Y-sorted queue. The PNG export is still a starter art study: final Blockbench art, collision integration, broader visual review, custom-layout edge cases, and packaged-build validation remain open.
4. **Pilar 4 — measured performance budget:** a local Electron baseline was sampled; it is not a packaged-build acceptance measurement. Repeat with the packaged build and representative atlas content; treat RAM/load/FPS targets as measured criteria.

Do not mark a phase complete solely because its plan or assets exist. Update status only after the relevant acceptance tests and Rama audit pass.
