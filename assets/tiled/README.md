# KRA Tiled Furniture Pipeline

This folder contains the Phase 3 Tiled authoring pack for the 32x12 KRA office.

## Open in Tiled

1. Launch `D:\Tiled\tiled.exe`.
2. Open `KRA-Office-Furniture.tiled-project`.
3. Add the tilesets:
   - `tilesets/office_architecture.tsx`
   - `tilesets/office_furniture.tsx`
4. Use 32x32 grid snapping for architecture and 64x96 furniture previews.
5. Place furniture by its origin tile. The `footprint` object layer and occupancy properties are the source of truth for collision/pathfinding.

## Design rules

- Preserve the 32x12 world grid and 32px tile size.
- Keep furniture pivot at the lowest floor-contact point; runtime Y-sort uses this anchor.
- Do not place furniture in Grand Runway rows 5–6 or elevator cells around x=15–16.
- Keep door openings at bottom-room entrances: x=3–4, 11–12, 19–20, and 27–28.
- Multi-tile footprints must remain inside their owning room and must not overlap corridors, walls, agents, or other props.
- Furniture atlas source remains `../voxel/atlas/office_furniture_diffuse.png`; emission source remains `../voxel/atlas/office_furniture_emission.png`.

## Current authored catalog

20 atlas furniture entries are available in `office_furniture.tsx`, including server rack, executive desk, arcade machine, planter, bookshelf, Maya workstation, presentation board, coffee station, conference table, billiard table, security console, data node, elevator module, office chair, security terminal, cutaway wall, high-density server blade cabinet, network cable riser, pantry refrigerator, and barista espresso counter.

The architecture sheet contains room floor palettes, runway tiles, wall tiles, server wall, elevator hub, and executive rug accents.
