# 🎨 KRA Design System & Office Architecture
### Adapted from Munder Difflin (`HarnessMD/munder-difflin`)

> **Aesthetic Core:** Animal Crossing × Earthbound × SNES Menu UI  
> **Resolution Target:** Pixel-snapped, integer scaled, chunky borders, 4px grid.  
> **Master Root:** [[Dashboard KRA Project]]  

---

## 1. Design Philosophy & Rules

1. **Pixel-Snapped Everything:** No sub-pixel floats, no CSS blur filters, no soft floaty border-radii.
2. **Chunky Over Slick:** Multi-layer borders, tactile 3D button presses, weighted containers.
3. **Limited Nostalgic Palette:** Clean contrast using retro gaming palettes (cream, deep ink, rich accents).
4. **Motion with Intent:** Walk cycles, desk typing, document carrying animations directly reflect agent PTY lifecycle and analysis states.
5. **Office Metaphor:** Physical visual spaces map directly to digital processes (e.g., Rama in the corner executive suite auditing files; Creator agent at the drafting board; Auditor agent at the test terminal).

---

## 2. Palette Specification (Color Tokens)

All color tokens follow the exact Munder Difflin spec:

```css
:root {
  /* Surfaces & Canvas */
  --kra-cream-50:    #FFFDF5;  /* Inner highlight, modal card fill */
  --kra-cream-100:   #FFF8E7;  /* Standard panel background */
  --kra-cream-200:   #F4E9C7;  /* Middle border layer & alternating rows */
  --kra-cream-300:   #E8D9A0;  /* Disabled / shaded areas */
  --kra-paper-100:   #FCFAF0;  /* Terminal & editor background */

  /* Ink & Typography */
  --kra-ink-900:     #1A1320;  /* High-contrast text & primary outer border */
  --kra-ink-700:     #3D2E4A;  /* Secondary text & inner border layer */
  --kra-ink-500:     #6B5878;  /* Subtle captions, metadata */
  --kra-ink-300:     #A899B5;  /* Dividers & placeholders */

  /* Office Brand Accents */
  --kra-dunder-maroon: #6E1423; /* KRA brand maroon */
  --kra-dunder-gold:   #F4D35E; /* KRA gold accent */
  --kra-coral:         #FF6B6B; /* Urgent alert / Blocked / Boss reject */
  --kra-mint:          #6BCF7F; /* Success / Approved / Ready */
  --kra-sky:           #4ECDC4; /* Inspecting / Reasoning / Audit */
  --kra-lemon:         #FFD93D; /* Active work / In progress */
  --kra-lilac:         #B197FC; /* Memory / Semantic index */

  /* World / Tilemap Colors */
  --kra-floor-light:   #E5C896; /* Bullpen floor tile light */
  --kra-floor-dark:    #C9A66B; /* Bullpen floor tile dark */
  --kra-exec-light:    #A0633C; /* Boss Office rich mahogany light */
  --kra-exec-dark:     #7C4524; /* Boss Office rich mahogany dark */
  --kra-wall:          #593E2B; /* Room wall boundaries (3px stroke) */
  --kra-rug:           #9E2A2B; /* Executive velvet rug */
}
```

---

## 3. Typography

Fonts loaded from Google Fonts:
- **Headings / Badges:** `'Press Start 2P', monospace` (8px, 12px, 16px) — Title Case.
- **UI Body & Labels:** `'Pixelify Sans', cursive, sans-serif` (14px, 16px, 18px).
- **Console / Terminal / Paths:** `'VT323', monospace` (16px, 18px).

---

## 4. The SNES 3-Layer Border System

Every window, modal, terminal, and panel adheres to the 3-layer nesting:

```css
.kra-panel {
  background-color: var(--kra-cream-100);
  border: 2px solid var(--kra-ink-900);
  box-shadow: 
    inset 0 0 0 2px var(--kra-cream-200),
    inset 0 0 0 3px var(--kra-ink-700),
    4px 4px 0 rgba(26, 19, 32, 0.25); /* Hard offset shadow */
}
```

---

## 5. Virtual Office Floor Layout

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
