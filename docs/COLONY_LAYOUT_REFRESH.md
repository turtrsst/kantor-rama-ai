# KRA 3D virtual-office refresh

The active office renderer is now a real **Three.js WebGL scene**, replacing the previous Canvas2D/isometric approximation. The scene uses a perspective camera, orbit/pan/zoom input, shadowed lighting, physical floor/wall/furniture meshes, a two-floor lift model, raycast-to-grid picking, and rounded soft-block crew figures with animated limbs. Room and agent data remain from KRA; the Office dashboard shell, floor controls, decorator, Task Board, and separate Creator mode remain KRA-owned.

The room and prop forms follow the warm paper-model direction in `kangkungmozzarella/kantor-ai`: soft rounded figures, outlined architectural/furniture shapes, natural timber/stone palette, soft light and walkable spaces. The upstream project has its own MIT license and it is included at `web/vendor/licenses/LICENSE-kantor-ai.txt`; adapted rounded-box/avatar implementation is attributed in the renderer source. Three.js r128 is bundled locally at `web/vendor/three-r128.min.js` to match the upstream version without depending on a CDN at runtime. Its MIT license is included at `web/vendor/LICENSE-three.txt`. No RimWorld textures or third-party pixel sprites are used by the 3D scene.

Floor 01 remains the 40×20 headquarters and Floor 02 the 44×20 operations deck. The two existing KRA plans, room definitions, crew identities, KRA panel dimensions, selection/hover, decorator coordinates, animated doors, lift, and local simulated game events are preserved. Pixel atlas furniture is mapped to newly modelled 3D desks, chairs, tables, server cabinets, plants, beds, sofas, lights and consoles; agent avatars are procedural mesh figures and do not display the old raster character sheets in the office view. The old pixel-art atlas remains available elsewhere in the app and its source assets are not deleted.

The live preview uses mocked APIs and does not exercise provider, filesystem, publishing, or external AI actions. The saved screenshots in `screenshots/` are historical top-down captures from the superseded renderer and are not evidence of the current WebGL scene.

## Verification

```sh
npm run verify:colony
node tools/verify-three-office-renderer.js
```

The checks cover floor geometry/routing, local Three.js runtime and licenses, generated mesh scene, floor-fit canvas dimensions, camera projection/raycast picking, selection/orbit input wiring, animated doors, and preserved references. A browser with WebGL enabled is required for the live 3D view.
