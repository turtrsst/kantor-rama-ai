# 2D Atlas vs Blockbench Pixel-3D Comparison

## Starter comparison model

Open `kra-prop-comparison.bbmodel` in Blockbench. It contains two separate voxel props on one shared 64×64 floor-coordinate canvas:

- `Server rack`: layered cuboids, three equipment bays, feet, and colored status indicators.
- `Archive bookshelf`: carcass, uprights, shelves, and individually colored book blocks.

The model uses the same restrained office-tech palette as the current atlas study. Geometry is made from actual cuboids; it is an editable Blockbench `free` model, not a 2D atlas drawing. The existing 2D comparison remains in `../atlas/office_furniture_diffuse.svg` and preview `../renders/kra-atlas-assets-preview.png`.

## Fair visual comparison workflow

1. Open the `.bbmodel` in Blockbench and inspect the rack and bookshelf from the same top-down 3/4 orthographic angle used in `docs/pipeline-spec.md`.
2. Render/export each prop against a transparent background, using consistent output dimensions (64×96 per atlas frame), scale, floor-contact baseline, and palette.
3. Compare the resulting render with the corresponding SVG atlas cells at native scale and at the in-app zoom. Do not compare Blockbench's perspective viewport screenshot directly with the atlas: camera, scale, and background would differ.
4. For runtime use, export aligned diffuse and emission images, then set frame, floor-contact pivot, occupancy, and `has_emission` accurately in atlas metadata. This starter model has no baked emission texture and is not registered as a runtime atlas asset.

## Limitations

This is a first modeling study, not a polished reconstruction of the supplied Nano Banana image. It includes a server rack and archive shelf to establish a volumetric style baseline. Its colors are Blockbench palette colors, not textured voxel painting. Review silhouette, depth readability, detail at 64×96, and material palette in Blockbench before modeling the remaining props. No runtime map or renderer integration is included in this comparison task.
