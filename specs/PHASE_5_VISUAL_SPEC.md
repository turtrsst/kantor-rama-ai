# 🏢 KRA Phase 5 Visual Specification: Modern 2.5D Dollhouse Office

> **Root Document:** `specs/PHASE_5_VISUAL_SPEC.md`  
> **Master Memory Root:** [[Dashboard KRA Project]]  
> **Reference Model:** `assets/reference/kra-floor-reference.jpeg` (Cross-section Dollhouse 2.5D Pixel Art)  
> **Author:** Jarvis (Lead Orchestrator) & Rama (Executive Boss)  
> **Status:** Phase 5A Approved Specification  

---

## 1. Executive Vision & Aesthetic Pillars

Phase 5 transitions Kantor-Rama-AI (KRA) from a basic flat tilemap to a **high-fidelity 2.5D modern dollhouse cross-section virtual office**, directly echoing the rich reference art (`kra-floor-reference.jpeg`).

### Core Aesthetic Pillars
1. **Architectural Dollhouse Cutaway:** Two-tier dual-deck horizontal layout split by a central Grand Red-Carpet Corridor.
2. **Distinct Zoned Environments:** Every room has a unique material identity (dark server racks, executive mahogany, Scandinavian blonde wood, pristine white kitchen tiles, rich conference rugs, cozy chill lounge).
3. **Chibi Character Polish:** Avatars feature crisp expressive silhouettes, distinct outfits, headwear/hair palettes, and contextual status badges (`[ NAME ■ ]`) with speech bubbles (`"Auditing codebase..."`).
4. **Vibrant Depth & Lighting:** Soft ambient drop shadows beneath furniture, glowing screens, warm floor lamps, and starlit window backdrops.
5. **No-Disruption Compatibility:** All visual enhancements maintain complete backward compatibility with KRA's existing safety gating, BYOK dispatcher, MySQL persistence, and Electron runtime.

---

## 2. Headquarters Spatial Layout (8-Room Cross-Section)

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [ ROOM 1: SERVER ROOM ]  │ [ ROOM 2: MANAGER SUITE ] │ [ ROOM 3: STUDIO ] │ [ ROOM 4: LOBBY ]   │
│ (Jarvis & Vault Core)    │ (Rama Executive Boss)     │ (Maya Modifier)    │ (Corporate Welcome) │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ═════════════════════ GRAND RUNWAY RED CARPET CORRIDOR ═══════════════════════════════ │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [ ROOM 5: RECORDS ]      │ [ ROOM 6: MEETING ROOM ]  │ [ ROOM 7: PANTRY ] │ [ ROOM 8: PLAY ]    │
│ (Siti Operations)        │ (Budi / War Room Board)   │ (Cafeteria Break)  │ (Dimas / Lounge)    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Room Specifications & Material Palettes

### Upper Deck (Top Row)

#### Room 1 — Server Room (Jarvis / Memory Core)
- **Role:** Central database, AI provider connection monitors, memory storage.
- **Flooring:** Industrial dark slate `#1E262F` & `#2A3642` with yellow/black hazard diagonal caution stripe at the door threshold.
- **Equipment:**
  - 3x Multi-tier server racks with animated green/amber/blue status LEDs.
  - Wall-mounted server rack cooling / ventilation unit.
  - Emergency wall-mounted fire extinguisher.
- **Badge Label:** `SERVER ROOM • JARVIS`

#### Room 2 — Manager Suite (Rama / Executive Supervisor)
- **Role:** High-level supervision, proposal approvals, audit verdicts.
- **Flooring:** Dark luxury espresso wood parquet `#2B1B17` / `#3D261F` with oversized charcoal executive desk rug `#1A1D24`.
- **Equipment:**
  - Wide mahogany executive desk with dual monitors, open laptop, and gold stationery.
  - Black ergonomic executive armchair with padded headrest.
  - Luxury guest couch with coffee table and ambient floor lamp.
  - Wall bookshelf and panoramic twilight window overlooking a city skyline with stars.
- **Badge Label:** `MANAGER • RAMA`

#### Room 3 — Studio (Maya / Code & Refactoring)
- **Role:** Active code refactoring, diff generation, styling.
- **Flooring:** Scandinavian light oak planking `#DFCFB2` / `#C8B799`.
- **Equipment:**
  - Modern natural wood workstation with dual monitors and cyan desk mat.
  - Design board with color swatches and typography posters (`Aa`).
  - Hanging wall shelves with architectural and coding reference books.
  - Ceramic potted plants.
- **Badge Label:** `STUDIO • MAYA`

#### Room 4 — Lobby & Reception (Brand Gateway)
- **Role:** Corporate reception, external project ingress.
- **Flooring:** Polished ivory terrazzo tile `#EFECE6` / `#D8D4CC`.
- **Equipment:**
  - Minimalist reception desk with brand monogram `KRA` and terminal.
  - Sleek modern waiting armchair and low glass table.
  - Architectural tall ficus plant in white cylinder pot.
- **Badge Label:** `LOBBY`

---

### Central Spine — Grand Red Carpet Corridor
- **Width:** Full map span connecting all 8 rooms.
- **Surface:** Deep crimson runner `#B82A38` bordered by ruby trim `#851C27`, framed by sleek light grey marble edging `#D5D8DC`.
- **Features:** Glass partitions, door openings with black pill room signs, corridor greenery.

---

### Lower Deck (Bottom Row)

#### Room 5 — Records & Archive (Siti / Filesystem & Environment)
- **Role:** Project workspace hygiene, directory indexing, vault persistence.
- **Flooring:** Rich walnut timber `#6A432D` with forest emerald velvet rug `#234E42`.
- **Equipment:**
  - Heavy oak desk with terminal and document in-tray.
  - Grand floor-to-ceiling library bookcase packed with multi-colored file binders.
  - Triple-drawer steel filing cabinets.
- **Badge Label:** `RECORDS • SITI`

#### Room 6 — Meeting & Collaboration War Room (Budi & Multi-Agent)
- **Role:** Strategic briefing, task brainstorming, team status reviews.
- **Flooring:** Light timber framing an expansive teal conference rug `#1F7A76`.
- **Equipment:**
  - Long 8-seat boardroom conference table in warm honey wood with centerpiece succulent.
  - 6-8 matching teal executive conference chairs.
  - Large illuminated wall whiteboard displaying live task metrics:
    `PROJECTS: KRA CORE (42 OPEN), VAULT SYNC (19 OPEN), BYOK DISPATCH (5 MODELS)`.
- **Badge Label:** `MEETING`

#### Room 7 — Pantry & Cafeteria (Team Refreshment)
- **Role:** Social downtime, stamina replenishment, informal chat.
- **Flooring:** Crisp ceramic grid tile `#F2F4F7` / `#D7DBE2`.
- **Equipment:**
  - Full kitchenette counter with sink, microwave, espresso coffee machine.
  - Large double-door stainless steel refrigerator.
  - Solid pine café table flanked by round red bistro stools `#D9383A`.
- **Badge Label:** `PANTRY`

#### Room 8 — Play & Recreation Lounge (Dimas / Code Review & Rest)
- **Role:** Relaxation, creative reset, security monitor downtime.
- **Flooring:** Deep cocoa planks `#3C2B22` with a plush indigo/violet area rug `#3B275E`.
- **Equipment:**
  - Retro standup arcade cabinet with illuminated marquee.
  - Media console with wide CRT/TV displaying a 16-bit pixel platformer.
  - Contemporary blue three-seater sofa.
  - Two oversized beanbags in bright orange `#E65C38` and cyan `#29B6B0`.
  - Warm brass arc floor lamp.
- **Badge Label:** `PLAY`

---

## 4. UI Elements & Interaction Design

### 1. Character Identification Badges
Directly below every avatar, render a high-contrast mini badge:
`[ RAMA ■ ]` or `[ MAYA ■ ]`
- `■` indicator: Green (`#4ECDC4` / `#6BCF7F`) for available/idle, Amber/Orange (`#F39C12` / `#E67E22`) for active/working.

### 2. Speech Bubbles
Pixel speech bubble styled with a white fill, 2px dark outline, and drop pointer:
- Displays active task description (e.g. `"Auditing codebase..."`, `"Scaffolding index.html..."`).
- Automatically pops up during execution and fades after task completion.

### 3. Studio Footer Status Legend
A clean, dark studio footer pinned beneath the canvas:
`"Working people sit at their desks. Everyone else wanders the studio. Tap anyone to see more or give them a task.  ■ available  ■ working"`

---

## 5. Tooling & Pipeline Standards

1. **Blockbench (`.bbmodel`):**
   - Editable reference model updated in `assets/voxel/models/kra-headquarters-floor.bbmodel`.
   - Grid snapping: 16px/32px per unit.
   - Textures: 64x64 pixel palettes.
2. **MagicaVoxel (`.vox`):**
   - Palette: Clean modern warm palette matching the reference image.
   - Used for volumetric asset previews and isometric scene exports.
3. **Interactive Runtime:**
   - Smooth 60 FPS pixel-perfect Canvas 2D fallback renderer with Y-depth sorting so agents and props layer realistically.
   - Retains 100% integration with Electron, PHP/MySQL, and BYOK AI dispatch.
