# KRA Office Furniture Sprite Atlas — Starter Set

This starter atlas is an original native SVG pixel-art study guided by the supplied KRA office reference and the approved top-down 3/4 view direction. It remains a lightweight browser image source and does not require a new renderer dependency. Editable 3D authoring should continue in the existing Blockbench workspace.

## Files

- `office_furniture.json` — frame, pivot, floor occupancy, emission declaration.
- `office_furniture_diffuse.svg` / `office_furniture_emission.svg` — editable SVG source artwork.
- `office_furniture_diffuse.png` / `office_furniture_emission.png` — runtime PNG exports, transparent and pixel aligned.

## Included sprite frames

- `server_rack_jarvis`
- `executive_desk_rama`
- `arcade_machine_dimas`
- `neon_planter`
- `archive_bookshelf_siti`
- `studio_workstation_maya`
- `presentation_board`
- `coffee_station`
- `conference_table_budi`
- `billiard_table_dimas`
- `security_console_ops`
- `data_cable_node`
- `elevator_door_module`
- `office_chair`
- `security_terminal`
- `cutaway_wall_segment`

The atlas canvas is 256×480 pixels, arranged as a 4-column × 5-row set of 64×96 frames; the fifth row remains reserved. Sprite pivots currently use `(32, 80)` and occupancy is recorded in metadata. Footprints are starter collision guidance and require in-engine placement review. Supplemental props are original 2D voxel-style studies; they are not Blockbench-authored 3D models. Emission is enabled only on frames with a matching emission-map detail.

## Validation and next step

These are starter assets, not final Blockbench models. The SVGs are directly viewable for art review; the matching PNG exports are consumed by the Canvas atlas loader. Blockbench remains sufficient for creating production 3D-baked art. The current install at `D:\Blockbench\Blockbench.exe` is available. No additional application is required now. For future exports, use Blockbench orthographic camera, transparent PNG output, identical atlas canvases, and validate metadata with `tools/verify-pipeline-atlas.php`.
