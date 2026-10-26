# KRA Voxel Asset Pipeline

This directory is the self-contained 3D pixel-asset workspace for Kantor-Rama-AI.

## Included tools and source

- **MagicaVoxel 0.99.7.2 (Windows)**: bundled at `tools/magica-voxel/installed/`.
- **MagicaVoxel 0.99.7 repository release source**: release archive at `tools/magica-voxel/`.
- **Blockbench**: already installed externally at `D:\Blockbench\`; it is used for authoring, but no KRA runtime depends on that installation.
- **Reference image**: `assets/reference/kra-floor-reference.jpeg`.

## Floor Model

`models/kra-headquarters-floor.bbmodel` is an editable Blockbench project representing the KRA headquarters’ zoning: executive suite, server vault, bullpen, and break/lounge areas.

## Workflow

1. Open the `.bbmodel` file in Blockbench.
2. Use the reference image as a visual guide; create voxel furniture, walls, desk modules and character props.
3. Export final assets as `.vox` (MagicaVoxel), `.glb`, or spritesheets to `assets/voxel/renders/`.
4. The browser floor keeps a native Canvas fallback, so KRA stays functional without any external voxel viewer.
5. `atlas/office_furniture_diffuse.svg` and `atlas/office_furniture_emission.svg` are editable starter atlas artwork. Supplemental props currently extend the sheet as 2D voxel-style studies; they are not substitutes for Blockbench-authored production models.
6. Export runtime PNGs with `node tools/export-atlas-png.js`, review the atlas preview, and validate metadata with `php tools/verify-pipeline-atlas.php`.
7. Any asset that changes the application UI must pass the Rama audit before delivery.
