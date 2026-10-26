# Pixel Office Remodel (2026-10-26)

Rebuilt the canvas office so both floors fill their frame the way
`assets/reference/` does, using the finished Argon batches 1–5.
Before/after renders: `assets/argon/verify_floor1.png`, `verify_floor2.png`.

## Geometry

- World is now **40 × 14 tiles @ 32px = 1280 × 448** (was 44 × 12 with
  rooms only filling 32 columns, which left a dark void on the right and
  squeezed the map into a thin strip inside the frame).
- Two 6-tile room tiers split by the 2-tile Grand Runway corridor
  (`CORRIDOR_Y = 6`). Floor 1: eight 10-wide rooms. Floor 2: four 20-wide
  rooms (War Room, Innovation, Observatory, Sky Lounge).
- The canvas container uses a dark picture-frame mat, so contain-fit
  margins read as frame, not void.
- The main stage is `minmax(0, 1fr) + clamp(328px, 28vw, 396px)`. The
  explicit zero minimum is load-bearing: plain `1fr` let the legend's
  nowrap content widen the map track and push the chat panel off-screen.

## Where things live in `web/app.js`

- `ROOM_DEFS` — single source of truth for room rect, label, accent,
  floor type, wall style, and rug. Tiles store a floor-type key;
  `FLOOR_PAINTERS` bake planks/plates/marble/checker/slate plus rugs,
  door thresholds, and the runway carpet into `floorLayerCache`.
- `buildWorld()` / `buildSecondFloor()` — furniture layouts written with
  Argon atlas ids directly (e.g. `01_executive_desk_rama`). `put(x, y, id)`
  anchors a prop at the top-left tile of its atlas occupancy footprint.
  All 46 Batch 1/3/4 props are placed; the tiny Batch-4 desktop props
  (mug, globe, sticky notes, award) render via `SURFACE_DECOR` on desks.
- Chairs (`08_chair_executive`, `09_chair_ergonomic`) are **sittable**:
  they never block pathfinding, so each agent's home tile is the chair
  behind their desk. Render Y-sort uses each prop's footprint bottom.
- `WALL_STYLES` + `buildWallLayer()` — static per-floor wall treatment:
  46px paneled back walls with crown/chair-rail/wainscot/skirting,
  full-height 10px room partitions, windows/posters/KRA sign placed in
  exposed wall bays, a 21px corridor wall with door gaps, elevator
  housing, and the outer frame. Only elevator doors, server LEDs, and the arcade glow animate
  (`drawElevatorDoors`, `drawAmbientFX`). The old billiard laser web and
  the hard-coded "Scanning for risks." wall bubble are gone.
- `buildFloorOverlay()` — cached soft room light pools, lamp glows, and
  vignette (previously rebuilt every frame).
- Batch 5 Cybercat finally loads (sheet path fixed to
  `01_Cybercat_Jarvis/…`) and patrols the runway, curling up by the Play
  couch (`CYBERCAT_ROUTE`). Event-FX sheets remain unused for now.

## Coordinates that moved

Agent homes sit on chair tiles behind their desks (Rama 14,2 · Jarvis
4.5,2.6 · Maya 23,2 · Budi 14,9 · Siti 2,10 · Dimas 34,10). Elevator
waypoint is (19.5, 7.2). Innovation hotdesk hire seats are the chair
tiles (22,2) (26,2) (30,2) (34,2) on Floor 2. The War Room collaboration
scene now gathers at the command-table chairs (8,2) and (11,2).

## Verification

Layout validator (occupancy overlap + BFS reachability from the corridor
to every home/activity/elevator tile) passes with zero overlaps, and the
in-page path test returns a valid route for every destination. If you add
a prop, keep footprints non-overlapping and re-check reachability —
walls are visual only, but furniture footprints block walking.
