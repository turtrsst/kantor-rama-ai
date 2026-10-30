# KRA Design System & Office Architecture

> **Current direction (2026-10-30):** calm, legible, non-pixel product UI paired with a warm, procedural 3D office. The existing KRA shell, floor plans, controls, authentication, Task Board, and integrations remain the product foundation.

---

## 1. Design Philosophy & Rules

1. **Clear before decorative:** favor readable hierarchy, comfortable type sizes, and whitespace over dense pixel labels.
2. **Warm, natural surfaces:** use evergreen ink, soft stone backgrounds, timber, muted brass, and garden greens inspired by the 3D office.
3. **Soft, consistent geometry:** use restrained rounded corners, subtle dividers, and low-contrast elevation rather than hard multi-layer borders.
4. **System-first typography:** use local/system sans-serif fallbacks; do not depend on remote font loading for the application to render correctly.
5. **Preserve application behavior:** visual changes must not alter KRA's authentication, two-floor structure, agent controls, Task Board, approvals, or integration semantics.
6. **Keep 3D views distinct:** Office and Content Creator are separate experiences; Creator's 3D production set is a visual workspace, not a claim of connected publishing integrations.

---

## 2. Palette Specification

The production CSS tokens in `web/style.css` are authoritative. Their light palette is warm white, soft sage-gray, evergreen text, and restrained brass/coral/lilac accents. Dark mode uses deep green-charcoal surfaces and accessible light text. Room-specific floor colors remain a separate part of the 3D world palette.

```css
:root {
  --paper-200: #eff3ef;
  --cream-100: #ffffff;
  --cream-200: #f2f5f1;
  --ink-900: #20332a;
  --ink-700: #40564a;
  --ink-500: #66776d;
  --ink-100: #dbe4dc;
  --maroon: #37694f; /* primary evergreen */
  --gold: #d7ad67;
  --coral: #c96556;
  --mint: #71a881;
  --sky: #89aaa2;
}
```

---

## 3. Typography

- **Headings and UI:** system-first sans-serif stacks (`Manrope`, `Inter`, `Segoe UI`, `system-ui`).
- **Data and technical labels:** a system monospace stack where alignment benefits from it.
- Font families are bundled neither remotely nor as a runtime dependency; browser/system fallbacks are expected.
- Keep labels comfortably readable; avoid all-caps microcopy as the default.

---

## 4. Surfaces, Controls & Interaction

- Panels use a light border, 12–18px corner radius, and restrained shadow; avoid hard offset shadows and layered pixel borders.
- Buttons and fields share rounded geometry, visible focus rings, and clear enabled/disabled states.
- Maintain contrast in both light and dark themes; 3D viewport framing may use deeper evergreen tones to complement the scene.
- Use motion sparingly and honor `prefers-reduced-motion`.

---

## 5. Legacy Tilemap Reference (Historical)

> The diagram and tile-level notes below describe an earlier pixel-rendered implementation. They are retained as historical layout context only; the active app uses the procedural Three.js renderer and the current KRA room data.


The KRA office canvas is mapped onto a 32×32 pixel tile grid:

```
+-------------------------------------------------------------------------+
| [ROOM 1: RAMA'S CORNER OFFICE]        | [ROOM 2: SERVER & MEMORY ARCHIVE] |
| - Mahogany parquet floor              | - Cool blue tile floor           |
| - Executive mahogany desk + gold lamp | - Server racks & blinky lights   |
| - Leather armchair & red velvet rug   | - Obsidian Vault terminal rack   |
| - Water cooler + potted fern          | - Semantic index station         |
| - Avatar: Boss Rama (Suit + Gold tie) |                                  |
+---------------------------------------+----------------------------------+
|                          [CORRIDOR & WATERCOOLER]                        |
+-------------------------------------------------------------------------+
| [ROOM 3: THE BULLPEN - SUBAGENT WORKSTATIONS]                            |
| - Oak parquet floor                                                      |
| - Desk 01: Creator Agent (Blueprints, scaffolding)                       |
| - Desk 02: Modifier Agent (Refactor terminal, wrench icon)               |
| - Desk 03: Auditor Agent (Diagnostic scope, magnifying glass)            |
| - Desk 04: Ops / Dir Agent (Filing cabinets, folder organizer)           |
+-------------------------------------------------------------------------+
```

---

## 6. Real-Time HUD & Command Architecture

The web interface is split into 3 functional zones:
1. **Interactive Floor Canvas (Left / Top):** Visual representation of Rama and subagents with live status bubbles, movement, and office furniture.
2. **Command & Terminal Panel (Right):**
   - Active Agent Header with sprite avatar and status chip.
   - Live Terminal Output stream (xterm.js / styled pre).
   - Command Input Bar with instant mode toggles (`/status`, `/rama review`, `/create`, `/modify`, `/audit`).
3. **Agent Roster Strip (Bottom):** Cards showing each agent's current state, engine/model, and pending approvals.
