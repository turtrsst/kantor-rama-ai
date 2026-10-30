(function (root, factory) {
  const loader = factory();
  root.KRABatchLoader = loader;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const BATCHES = [
    {
      id: 'batch7',
      name: 'Batch 7 - Lived-In Realism',
      manifest: '../assets/argon/Batch7_Lived_In_Realism/batch7_lived_in_manifest.json',
      atlas_dif: '../assets/argon/Batch7_Lived_In_Realism/00_Master_Atlas/batch7_lived_in_diffuse_atlas.png',
      atlas_em: '../assets/argon/Batch7_Lived_In_Realism/00_Master_Atlas/batch7_lived_in_emission_atlas.png'
    },
    {
      id: 'batch9',
      name: 'Batch 9 - Floor 1 Expansion',
      manifest: '../assets/argon/Batch9_Floor1_Complete_Expansion/batch9_floor1_expansion_manifest.json',
      atlas_dif: '../assets/argon/Batch9_Floor1_Complete_Expansion/00_Master_Atlas/batch9_floor1_diffuse_atlas.png',
      atlas_em: '../assets/argon/Batch9_Floor1_Complete_Expansion/00_Master_Atlas/batch9_floor1_emission_atlas.png'
    },
    {
      id: 'batch10',
      name: 'Batch 10 - Floor 2 Expansion',
      manifest: '../assets/argon/Batch10_Floor2_6Deck_ReferenceStyle/batch10_floor2_manifest.json',
      atlas_dif: '../assets/argon/Batch10_Floor2_6Deck_ReferenceStyle/00_Master_Atlas/batch10_floor2_6deck_diffuse.png',
      atlas_em: '../assets/argon/Batch10_Floor2_6Deck_ReferenceStyle/00_Master_Atlas/batch10_floor2_6deck_emission.png'
    }
  ];

  async function loadBatchAtlases(officeAtlas) {
    const jobs = BATCHES.map(async b => {
      try {
        const fetchManifest = window.KRAAssetCache?.fetch
          ? window.KRAAssetCache.fetch(b.manifest)
          : fetch(b.manifest + '?v=20261029');
        const [res, imgDif, imgEm] = await Promise.all([
          fetchManifest,
          loadImage(b.atlas_dif),
          loadImage(b.atlas_em)
        ]);
        if (!res.ok) throw new Error('Manifest request failed: ' + res.status);
        const manifest = await res.json();
        if (b.id === 'batch7') processBatch7(manifest, imgDif, imgEm, officeAtlas);
        else processAtlasBatch(manifest, imgDif, imgEm, officeAtlas);
      } catch (err) {
        console.warn('[BatchLoader] Failed:', b.id, err);
      }
    });
    // Independent asset families load concurrently instead of blocking one another.
    jobs.push(loadBatch6Modular(officeAtlas), loadBatch11Modular(officeAtlas));
    await Promise.allSettled(jobs);
  }

  async function loadBatch6Modular(officeAtlas) {
    const B6_PROPS = [
      { id: 'wall_cityscape_window', path: '01_Architectural_Walls/wall_cityscape_window.png', w: 32, h: 64 },
      { id: 'wall_cyberpunk_circuits', path: '01_Architectural_Walls/wall_cyberpunk_circuits.png', w: 32, h: 64 },
      { id: 'wall_glass_partition', path: '01_Architectural_Walls/wall_glass_partition.png', w: 32, h: 64 },
      { id: 'floor_caution_stripe_tape', path: '02_Floor_Decals_Rugs/floor_caution_stripe_tape.png', w: 32, h: 32 },
      { id: 'floor_gold_border_rug', path: '02_Floor_Decals_Rugs/floor_gold_border_rug.png', w: 64, h: 64 },
      { id: 'floor_direction_arrow_decal', path: '02_Floor_Decals_Rugs/floor_direction_arrow_decal.png', w: 32, h: 32 },
      { id: 'ceiling_industrial_hanging_lamp', path: '03_Ceiling_Props/ceiling_industrial_hanging_lamp.png', w: 32, h: 48 },
      { id: 'ceiling_ac_ventilator_vent', path: '03_Ceiling_Props/ceiling_ac_ventilator_vent.png', w: 32, h: 32 },
      { id: 'fx_hologram_projector', path: '04_Global_VFX_Gadgets/fx_hologram_projector.png', w: 32, h: 32 },
      { id: 'fx_patrol_security_bot', path: '04_Global_VFX_Gadgets/fx_patrol_security_bot.png', w: 32, h: 32 },
      { id: 'fx_steam_particle_forge', path: '04_Global_VFX_Gadgets/fx_steam_particle_forge.png', w: 32, h: 32 },
      { id: 'fx_electric_spark_server', path: '04_Global_VFX_Gadgets/fx_electric_spark_server.png', w: 32, h: 32 }
    ];

    const base = '../assets/argon/Batch6_Management_Game_Master_Bundle/';
    await Promise.all(B6_PROPS.map(async p => {
      try {
        const img = await loadImage(base + p.path);
        officeAtlas.metadata.sprites[p.id] = {
          frame: { x: 0, y: 0, w: p.w, h: p.h },
          pivot: { x: p.w / 2, y: p.h },
          grid_occupancy: { cols: Math.ceil(p.w / 32), rows: Math.ceil(p.h / 32) },
          has_emission: false,
          diffuse: img,
          emission: null
        };
      } catch (e) {
        console.warn('[BatchLoader] Failed Batch6 prop:', p.id);
      }
    }));
  }

  async function loadBatch11Modular(officeAtlas) {
    const B11_FRAME_W = 32;
    const B11_FRAME_H = 40;
    const B11_FRAMES_PER_ROW = 16;
    const B11_DIRS = 4;

    // Spritesheet: 512x160 = 16 frames × 32 wide, 4 directions × 40 tall
    const spriteUrl = '../assets/argon/Batch11_Modular_Agents/custom_agent_spritesheet_32x40.png';
    try {
      const img = await loadImage(spriteUrl);
      // Register each of the 64 frames (16 × 4 directions) into metadata.sprites
      for (let dir = 0; dir < B11_DIRS; dir++) {
        for (let f = 0; f < B11_FRAMES_PER_ROW; f++) {
          const frameId = `agent_modular_${dir}_${f}`;
          officeAtlas.metadata.sprites[frameId] = {
            frame: { x: f * B11_FRAME_W, y: dir * B11_FRAME_H, w: B11_FRAME_W, h: B11_FRAME_H },
            pivot: { x: B11_FRAME_W / 2, y: B11_FRAME_H },
            grid_occupancy: { cols: 1, rows: 1 },
            has_emission: false,
            diffuse: img,
            emission: null
          };
        }
      }
    } catch (e) {
      console.warn('[BatchLoader] Failed Batch11 modular:', e.message);
    }
  }

  function loadImage(url) {
    if (window.KRAAssetCache?.loadImage) return window.KRAAssetCache.loadImage(url);
    return new Promise((res, rej) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = url;
    });
  }

  function processAtlasBatch(manifest, diffuse, emission, officeAtlas) {
    manifest.assets.forEach(a => {
      const uv = a.atlas_uv;
      if (!uv) return;
      officeAtlas.metadata.sprites[a.id] = {
        frame: { x: uv.x, y: uv.y, w: uv.w, h: uv.h },
        pivot: { x: uv.w / 2, y: uv.h },
        grid_occupancy: { cols: Math.ceil(uv.w / 32), rows: Math.ceil(uv.h / 32) },
        has_emission: true,
        diffuse,
        emission
      };
    });
  }

  function processBatch7(manifest, diffuse, emission, officeAtlas) {
    let cx = 0, cy = 0, rowH = 0;
    Object.values(manifest.priorities).flat().forEach(a => {
      if (cx + a.width > 320) { cx = 0; cy += rowH + 4; rowH = 0; }
      officeAtlas.metadata.sprites[a.id] = {
        frame: { x: cx, y: cy, w: a.width, h: a.height },
        pivot: { x: a.width / 2, y: a.height },
        grid_occupancy: { cols: Math.ceil(a.width / 32), rows: Math.ceil(a.height / 32) },
        has_emission: true,
        diffuse,
        emission
      };
      cx += a.width + 4;
      if (a.height > rowH) rowH = a.height;
    });
  }

  function parseOccupancy(str) {
    const parts = str.split('x').map(Number);
    return { cols: parts[0] || 1, rows: parts[1] || 1 };
  }

  return { loadBatchAtlases };
});