# KRA Visual Overhaul Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add asset registry with reliable procedural fallback and activate Floor 2 six-deck 44×12 preset while preserving legacy Floor 2 layout.

**Architecture:** `web/kra_asset_registry.js` owns prop metadata, PNG candidates, collision footprints, pivots, and procedural 3/4 fallback drawing. `web/app.js` reads registry metadata instead of assuming atlas assets always load, and selects the six-deck layout by default while retaining `FLOOR2_LEGACY_40x14` as immutable fallback data. Existing Atlas assets remain preferred when valid.

**Tech Stack:** Native JavaScript, HTML5 Canvas 2D, existing Argon asset manifests, Node built-in `assert`.

**Spec:** User task “Implementasi Visual Overhaul KRA (Batches 1–11), Floor 2 (6-Deck 44x12), Cinematic Lighting & Modular Hire Agent”, plus `docs/pipeline-spec.md`.

## Global Constraints

- Preserve uncommitted source changes. No reset, checkout, or file deletion.
- Keep `FLOOR2_LEGACY_40x14`; default Floor 2 uses `FLOOR2_6DECK_44x12`.
- Asset load path is PNG first, registered alternative second, procedural Canvas fallback last.
- Registry fallback must retain `pivot: bottom_center`, footprint, collision, and source diagnostics.
- Fallback must render a visible prop instead of blank canvas or broken image.
- No new dependency.
- Do not change agent role, skill, LLM model, or authority in this phase.
- Respect `prefers-reduced-motion` by making fallback animation static when enabled.

## Review Focus

- Missing or malformed PNG source: fallback remains visible and reports `source: "procedural-fallback"`.
- Floor 1 remains 40×14 and all existing floor controls continue to work after Floor 2 becomes 44×12.
- Floor 2 AI Forge and Command Deck have unique room IDs, locations, wall/floor keys, and safe walkable corridor access.
- Registry footprint data prevents props from extending outside 44×12 map bounds.
- Legacy Floor 2 definition remains available and selectable for recovery without aliasing mutable active map arrays.

---

### Task 1: Registry contract and procedural fallback

**Files:**
- Create: `web/kra_asset_registry.js`
- Create: `tools/verify-kra-asset-registry.js`
- Modify: `web/index.html`

**Interfaces:**
- Produces: `window.KRAAssetRegistry` and CommonJS export with `get(id)`, `resolve(id, imageLoader)`, `drawFallback(ctx, id, box, options)`, `getFootprint(id)`.
- Produces: `KRAAssetRegistry.props` containing Batch 1–11 source metadata and fallback-capable definitions.

- [ ] **Step 1: Write failing registry verifier**

```js
assert.equal(registry.get('13_aif_compute_pod_gpu_rack').footprint.cols, 2);
assert.equal(registry.get('16_cmd_captain_console_dispatch_chairs').pivot, 'bottom_center');
assert.equal(registry.resolve('missing_png_fixture', () => Promise.reject(new Error('missing'))).then(r => r.source), 'procedural-fallback');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/verify-kra-asset-registry.js`
Expected: FAIL because `web/kra_asset_registry.js` does not exist.

- [ ] **Step 3: Create `web/kra_asset_registry.js`**

Define Batch 1–11 prop descriptors. Port `drawOrthoDesk34`, `drawOrthoCabinet34`, and `drawModularAgent` from `assets/argon/batch10_11_reference_true_studio.html` as concise registry drawing functions. `resolve()` must return PNG when available, alternate PNG when available, otherwise a visible procedural fallback descriptor. Every descriptor carries `footprint`, `collision`, `pivot: 'bottom_center'`, and `source`.

- [ ] **Step 4: Load registry before `app.js`**

Add `<script src="kra_asset_registry.js" defer></script>` before the existing app script in `web/index.html`.

- [ ] **Step 5: Run registry verifier**

Run: `node tools/verify-kra-asset-registry.js`
Expected: PASS.

### Task 2: Floor layout presets and six-deck Floor 2

**Files:**
- Modify: `web/app.js:51-287`
- Modify: `tools/verify-kra-asset-registry.js`

**Interfaces:**
- Consumes: `KRAAssetRegistry.getFootprint(id)`.
- Produces: `FLOOR2_LEGACY_40x14`, `FLOOR2_6DECK_44x12`, and `loadFloorPreset(floorId, preset)`.

- [ ] **Step 1: Extend verifier with Floor 2 preset assertions**

```js
assert.equal(FLOOR2_LEGACY_40x14.map.w, 40);
assert.equal(FLOOR2_LEGACY_40x14.map.h, 14);
assert.equal(FLOOR2_6DECK_44x12.map.w, 44);
assert.equal(FLOOR2_6DECK_44x12.map.h, 12);
assert.deepEqual(FLOOR2_6DECK_44x12.rooms.map(room => room.id), ['warroom', 'innovation', 'observatory', 'lounge2', 'aiforge', 'command']);
```

- [ ] **Step 2: Run verifier to verify it fails**

Run: `node tools/verify-kra-asset-registry.js`
Expected: FAIL because Floor 2 preset is absent.

- [ ] **Step 3: Add isolated preset data and active-map switching**

Make map dimensions part of the active preset. Preserve Floor 1 current layout. Add six 44×12 Floor 2 rooms split into three upper and three lower zones around the runway: War Room, Innovation Studio, AI Forge, Systems Observatory, Sky Lounge, Command Deck. Place Batch 3 and Batch 10 procedural prop IDs with registry footprint validation. Retain original Floor 2 room definitions and furniture under `FLOOR2_LEGACY_40x14`.

- [ ] **Step 4: Connect registry fallback path to existing prop draw path**

When atlas metadata/image does not provide a prop, retrieve registry metadata and draw it through `KRAAssetRegistry.drawFallback()`; use registry footprint for collision and Y sort.

- [ ] **Step 5: Run focused checks**

Run: `node tools/verify-kra-asset-registry.js`
Expected: PASS.

Run: `node --check web/kra_asset_registry.js && node --check web/app.js`
Expected: exit 0.

### Task 3: Regression verification and audit

**Files:**
- Modify: `tools/verify-kra-asset-registry.js`
- Modify: `docs/pipeline-spec.md`

**Interfaces:**
- Consumes: final registry and Floor 2 layout values.
- Produces: documented active/legacy preset contract.

- [ ] **Step 1: Add regression cases**

Test missing asset fallback has nonzero visible canvas pixels, all six Floor 2 room prop origins fit 44×12, and legacy preset values stay unchanged.

- [ ] **Step 2: Run test to verify it fails before fix if needed**

Run: `node tools/verify-kra-asset-registry.js`
Expected: failure until missing behavior is corrected.

- [ ] **Step 3: Make minimal corrections**

Fix registry or preset data only; do not expand into lighting, database migration, or Hire Agent UI.

- [ ] **Step 4: Run verification suite**

Run: `node tools/verify-kra-asset-registry.js`
Expected: PASS.

Run: `node tools/verify-atlas-render.js`
Expected: PASS or explicitly report environmental blocker.

Run: `node tools/verify-render-queue.js`
Expected: PASS or explicitly report environmental blocker.

Run: `node --check web/kra_asset_registry.js && node --check web/app.js`
Expected: exit 0.

Run: `php tools/audit-cli.php`
Expected: APPROVED or report actual findings.
