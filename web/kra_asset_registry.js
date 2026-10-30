(function (root, factory) {
  const registry = factory();
  if (typeof module === 'object' && module.exports) module.exports = registry;
  root.KRAAssetRegistry = registry;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const COLORS = {
    outline: '#14182E', shadow: 'rgba(10, 14, 24, 0.42)', woodTop: '#A96A3C',
    woodHi: '#D49A66', woodFront: '#66381F', woodDark: '#342018', steelTop: '#53677D',
    steelHi: '#7893AE', steelFront: '#243343', bay: '#0A111B', cyan: '#00F0FF',
    pink: '#FF55B8', green: '#38E858', amber: '#FFAE38', red: '#D93838', gold: '#FFE070'
  };

  function fill(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function drawOrthoDesk34(ctx, x, y, w, topH, frontH, legH, topCol, topHi, frontCol, darkCol) {
    fill(ctx, x + 2, y + topH + frontH + legH - 2, w - 4, 4, COLORS.shadow);
    fill(ctx, x + 3, y + topH + frontH, 4, legH, COLORS.outline);
    fill(ctx, x + 4, y + topH + frontH, 2, legH - 1, darkCol);
    fill(ctx, x + w - 7, y + topH + frontH, 4, legH, COLORS.outline);
    fill(ctx, x + w - 6, y + topH + frontH, 2, legH - 1, darkCol);
    fill(ctx, x, y, w, topH + frontH, COLORS.outline);
    fill(ctx, x + 1, y + 1, w - 2, topH - 1, topCol);
    fill(ctx, x + 1, y + 1, w - 2, 1, topHi);
    fill(ctx, x + 1, y + topH, w - 2, 1, COLORS.outline);
    fill(ctx, x + 1, y + topH + 1, w - 2, frontH - 2, frontCol);
    fill(ctx, x + 3, y + topH + 2, 10, frontH - 4, darkCol);
    fill(ctx, x + w - 13, y + topH + 2, 10, frontH - 4, darkCol);
    fill(ctx, x + 7, y + topH + 4, 2, 1, COLORS.gold);
    fill(ctx, x + w - 9, y + topH + 4, 2, 1, COLORS.gold);
  }

  function drawOrthoCabinet34(ctx, x, y, w, topH, frontH, topCol, topHi, frontCol, bayCol) {
    fill(ctx, x + 1, y + topH + frontH - 1, w - 2, 3, COLORS.shadow);
    fill(ctx, x, y, w, topH + frontH, COLORS.outline);
    fill(ctx, x + 1, y + 1, w - 2, topH - 1, topCol);
    fill(ctx, x + 1, y + 1, w - 2, 1, topHi);
    fill(ctx, x + 1, y + topH, w - 2, 1, COLORS.outline);
    fill(ctx, x + 1, y + topH + 1, w - 2, frontH - 2, frontCol);
    fill(ctx, x + 3, y + topH + 3, w - 6, frontH - 6, bayCol);
  }

  const SKIN = {
    standard_warm: ['#E8B28C', '#C48962', '#FAD1B4'], petite_light: ['#F5C8A8', '#D49F7D', '#FFE3CF'],
    tall_olive: ['#D9A47E', '#B57D58', '#F0BF9C'], broad_deep: ['#9E6846', '#75482B', '#BA825E'],
    android_synth: ['#7A8EA8', '#52647D', '#A3B8D4']
  };

  function drawModularAgent(ctx, direction, config, frame) {
    const cfg = config || {};
    const skin = SKIN[cfg.body] || SKIN.standard_warm;
    const bob = cfg.anim === 'walk' && frame % 2 ? 1 : 0;
    const palette = cfg.palette || {};
    const pants = cfg.bottom === 'denim_work_boots' ? '#2C5282' : cfg.bottom === 'chinos_sneakers' ? '#B5926B' : '#1E2C47';
    const shoes = cfg.shoes === 'white_sneakers' ? '#E2E8F0' : cfg.bottom === 'denim_work_boots' ? '#784C28' : cfg.bottom === 'chinos_sneakers' ? '#E2E8F0' : '#181B24';
    const top = palette.primary || (cfg.top === 'teal_blazer_cream' ? '#246B73' : cfg.top === 'white_lab_coat' ? '#E2E8F0' : cfg.top === 'tactical_vest_purple' ? '#231D36' : '#223354');
    const hair = palette.hair || (cfg.hair === 'hijab_emerald' ? '#1F5C3E' : cfg.hair === 'tech_crop_brown' ? '#5C3B24' : '#261C16');
    fill(ctx, 9, 35, 14, 3, COLORS.shadow);
    [[10, 11], [17, 18]].forEach(([edge, inner]) => {
      fill(ctx, edge, 28 + bob, 5, 8, COLORS.outline); fill(ctx, inner, 28 + bob, 3, 6, pants); fill(ctx, inner, 34 + bob, 3, 2, shoes);
    });
    fill(ctx, 8, 18 + bob, 16, 11, COLORS.outline); fill(ctx, 9, 19 + bob, 14, 9, top);
    fill(ctx, 6, 19 + bob, 3, 8, COLORS.outline); fill(ctx, 7, 20 + bob, 2, 5, top); fill(ctx, 7, 25 + bob, 2, 2, skin[0]);
    fill(ctx, 23, 19 + bob, 3, 8, COLORS.outline); fill(ctx, 23, 20 + bob, 2, 5, top); fill(ctx, 23, 25 + bob, 2, 2, skin[0]);
    const accent = palette.accent || '#F4D35E';
    // Small role-coded tailoring keeps the roster readable at 32px without
    // losing the chunky pixel silhouette of the uploaded character sheet.
    if (cfg.top === 'navy_suit_tie') { fill(ctx, 15, 19 + bob, 3, 8, accent); fill(ctx, 16, 20 + bob, 1, 6, '#F7E8C0'); }
    if (cfg.top === 'white_lab_coat') { fill(ctx, 10, 19 + bob, 2, 9, '#F6F8FA'); fill(ctx, 20, 19 + bob, 2, 9, '#C2D1DE'); fill(ctx, 19, 21 + bob, 3, 3, accent); }
    if (cfg.top === 'teal_blazer_cream' || cfg.top === 'blue_overalls_belt') { fill(ctx, 10, 22 + bob, 2, 5, accent); fill(ctx, 18, 23 + bob, 4, 1, '#F6D38A'); }
    if (cfg.top === 'tactical_vest_purple') { fill(ctx, 11, 20 + bob, 3, 2, accent); fill(ctx, 18, 20 + bob, 3, 2, accent); fill(ctx, 12, 24 + bob, 8, 1, '#A99BC5'); }
    if (cfg.top === 'charcoal_jacket_coral') { fill(ctx, 10, 19 + bob, 2, 8, accent); fill(ctx, 20, 20 + bob, 1, 6, '#A6B4C3'); }
    if (cfg.top === 'brown_cardigan_green') { fill(ctx, 15, 19 + bob, 2, 9, accent); fill(ctx, 10, 26 + bob, 12, 1, '#C7A77D'); }
    if (cfg.heldItem === 'wrench_tool') { fill(ctx, 24, 23 + bob, 2, 5, '#B9C7D3'); fill(ctx, 22, 22 + bob, 6, 2, '#DCE5EB'); }
    fill(ctx, 8, 5 + bob, 16, 13, COLORS.outline); fill(ctx, 9, 6 + bob, 14, 12, palette.skin || skin[0]); fill(ctx, 10, 7 + bob, 12, 2, skin[2]); fill(ctx, 10, 16 + bob, 12, 2, skin[1]);
    fill(ctx, 8, 4 + bob, 16, 4, hair); fill(ctx, 8, 8 + bob, 2, 5, hair); fill(ctx, 22, 8 + bob, 2, 5, hair);
    if (cfg.hair === 'hijab_emerald') { fill(ctx, 7, 7 + bob, 3, 12, hair); fill(ctx, 22, 7 + bob, 3, 12, hair); fill(ctx, 9, 4 + bob, 14, 2, hair); }
    if (cfg.body === 'android_synth') { fill(ctx, 9, 8 + bob, 2, 7, '#75E7F3'); fill(ctx, 21, 8 + bob, 2, 7, '#75E7F3'); fill(ctx, 11, 16 + bob, 10, 1, '#415C78'); }
    if (direction !== 'back') {
      const shift = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
      fill(ctx, 11 + shift, 10 + bob, 3, 1, '#261A12'); fill(ctx, 18 + shift, 10 + bob, 3, 1, '#261A12');
      fill(ctx, 11 + shift, 11 + bob, 3, 2, '#FFFFFF'); fill(ctx, 18 + shift, 11 + bob, 3, 2, '#FFFFFF');
      fill(ctx, 12 + shift, 11 + bob, 2, 2, COLORS.outline); fill(ctx, 19 + shift, 11 + bob, 2, 2, COLORS.outline);
      fill(ctx, 14 + shift, 15 + bob, 4, 1, cfg.face === 'beard_mustache' ? '#3B281C' : '#783C2A');
    }
    if (cfg.heldItem === 'glasses_tablet' || cfg.gear === 'glasses_tablet') {
      fill(ctx, 10, 11 + bob, 12, 1, '#38BDF8'); fill(ctx, 22, 22 + bob, 6, 7, '#1E293B'); fill(ctx, 23, 23 + bob, 4, 5, COLORS.cyan);
    }
  }

  function fallback(ctx, id, box, options) {
    const b = box || { x: 0, y: 0, w: 64, h: 64 };
    const key = String(id || '').toLowerCase();
    const ratio = Math.min(b.w / 96, b.h / 64);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(ratio, ratio);
    if (key.includes('agent')) {
      drawModularAgent(ctx, options?.direction || 'front', options?.appearance || {}, options?.frame || 0);
    } else if (key.includes('rack') || key.includes('cabinet') || key.includes('server') || key.includes('ups')) {
      drawOrthoCabinet34(ctx, 8, 4, 48, 7, 48, COLORS.steelTop, COLORS.steelHi, COLORS.steelFront, COLORS.bay);
      for (let y = 16; y < 48; y += 7) {
        fill(ctx, 14, y, 5, 2, COLORS.green); fill(ctx, 26, y, 5, 2, COLORS.cyan); fill(ctx, 38, y, 5, 2, COLORS.amber);
      }
    } else if (key.includes('plant')) {
      drawOrthoCabinet34(ctx, 36, 40, 24, 4, 14, '#B65F3B', '#E08965', '#7B3E24', '#4D2518');
      fill(ctx, 26, 12, 42, 31, '#236A42'); fill(ctx, 31, 7, 20, 20, '#3F9E58'); fill(ctx, 50, 14, 20, 20, '#2D8A4E');
    } else if (key.includes('board') || key.includes('display') || key.includes('map')) {
      drawOrthoCabinet34(ctx, 8, 6, 80, 5, 34, COLORS.steelTop, COLORS.steelHi, COLORS.steelFront, '#0B1829');
      fill(ctx, 17, 17, 60, 15, COLORS.cyan); fill(ctx, 21, 21, 24, 2, '#17354C'); fill(ctx, 49, 25, 20, 2, COLORS.pink);
    } else {
      drawOrthoDesk34(ctx, 6, 26, 84, 11, 14, 8, COLORS.woodTop, COLORS.woodHi, COLORS.woodFront, COLORS.woodDark);
      fill(ctx, 20, 16, 20, 10, '#111827'); fill(ctx, 22, 18, 16, 6, COLORS.cyan);
      fill(ctx, 57, 16, 20, 10, '#111827'); fill(ctx, 59, 18, 16, 6, COLORS.pink);
    }
    ctx.restore();
  }

  function descriptor(id, footprint, file, kind, alternatives) {
    return {
      id,
      footprint: footprint || { cols: 1, rows: 1 },
      collision: kind !== 'chair',
      pivot: 'bottom_center',
      png: file ? [file] : [],
      alternatives: alternatives || [],
      fallback: kind || 'desk',
      emission: null,
      source: 'procedural-fallback'
    };
  }

  const props = Object.create(null);
  const add = (id, footprint, file, kind) => { props[id] = descriptor(id, footprint, file, kind); };
  [
    ['01_executive_desk_rama', { cols: 3, rows: 1 }, 'Batch1_Floor1_Core_Props/01_Executive_Desk/01_executive_desk_rama.png', 'desk'],
    ['02_server_rack_jarvis', { cols: 1, rows: 2 }, 'Batch1_Floor1_Core_Props/02_Server_Rack/02_server_rack_jarvis.png', 'rack'],
    ['03_workstation_maya', { cols: 2, rows: 1 }, 'Batch1_Floor1_Core_Props/03_Maya_Workstation/03_workstation_maya.png', 'desk'],
    ['04_conference_table_budi', { cols: 3, rows: 2 }, 'Batch1_Floor1_Core_Props/04_Conference_Table/04_conference_table_budi.png', 'desk'],
    ['05_archive_bookshelf_siti', { cols: 2, rows: 2 }, 'Batch1_Floor1_Core_Props/05_Archive_Bookshelf/05_archive_bookshelf_siti.png', 'cabinet'],
    ['06_arcade_console_dimas', { cols: 1, rows: 2 }, 'Batch1_Floor1_Core_Props/06_Arcade/06_arcade_console_dimas.png', 'cabinet'],
    ['07_elevator_door_module', { cols: 2, rows: 2 }, 'Batch1_Floor1_Core_Props/07_Elevator/07_elevator_door_module.png', 'cabinet'],
    ['08_chair_executive', { cols: 1, rows: 1 }, '', 'chair'], ['09_chair_ergonomic', { cols: 1, rows: 1 }, '', 'chair'],
    ['10_plant_potted_large', { cols: 1, rows: 1 }, '', 'plant'], ['11_brass_desk_lamp', { cols: 1, rows: 1 }, '', 'desk'],
    ['12_modular_taskboard', { cols: 2, rows: 1 }, '', 'board'], ['13_modular_couch', { cols: 2, rows: 1 }, '', 'desk'], ['14_billiard_table_dimas', { cols: 2, rows: 1 }, '', 'desk'],
    ['01_war_command_table_4x2', { cols: 4, rows: 2 }, '', 'desk'], ['02_war_tactical_display_wall', { cols: 3, rows: 2 }, '', 'board'],
    ['03_war_incident_board_timer', { cols: 2, rows: 2 }, '', 'board'], ['04_war_radio_beacon_chair', { cols: 3, rows: 1 }, '', 'chair'],
    ['05_inno_hotdesk_modular_2x1', { cols: 2, rows: 1 }, '', 'desk'], ['06_inno_prototype_pedestal', { cols: 2, rows: 1 }, '', 'desk'],
    ['07_inno_asset_forge_3d_printer', { cols: 2, rows: 2 }, '', 'cabinet'], ['08_inno_task_wall_sketch_board', { cols: 3, rows: 2 }, '', 'board'],
    ['09_obs_semicircle_monitoring_desk', { cols: 3, rows: 2 }, '', 'desk'], ['10_obs_multi_monitor_radar_wall', { cols: 3, rows: 2 }, '', 'board'],
    ['11_obs_topology_panel_sensor', { cols: 2, rows: 2 }, '', 'board'], ['12_obs_status_tower_rail', { cols: 2, rows: 2 }, '', 'cabinet'],
    ['13_sky_window_cityscape', { cols: 3, rows: 2 }, '', 'board'], ['14_sky_couch_low_table', { cols: 3, rows: 2 }, '', 'desk'],
    ['15_sky_vending_coffee_point', { cols: 2, rows: 2 }, '', 'cabinet'], ['16_sky_tree_telescope_charger', { cols: 3, rows: 2 }, '', 'plant'],
    ['13_aif_compute_pod_gpu_rack', { cols: 2, rows: 2 }, '', 'rack'], ['14_aif_training_display_data_crystal', { cols: 2, rows: 2 }, '', 'board'],
    ['15_aif_cooling_pipes_hologram_fx', { cols: 2, rows: 2 }, '', 'desk'], ['16_cmd_captain_console_dispatch_chairs', { cols: 3, rows: 2 }, '', 'desk'],
    ['17_cmd_global_project_map_logo', { cols: 3, rows: 2 }, '', 'board'], ['18_cmd_intercom_signal_board_alert', { cols: 3, rows: 2 }, '', 'board']
  ].forEach(([id, footprint, file, kind]) => add(id, footprint, file, kind));

  const FLOOR2_LEGACY_40x14 = Object.freeze({
    map: Object.freeze({ w: 40, h: 14, corridorY: 6 }),
    rooms: Object.freeze(['warroom', 'innovation', 'observatory', 'lounge2'].map(id => Object.freeze({ id })))
  });
  const FLOOR2_6DECK_44x12 = Object.freeze({
    map: Object.freeze({ w: 44, h: 12, corridorY: 5 }),
    rooms: Object.freeze(['warroom', 'innovation', 'aiforge', 'observatory', 'lounge2', 'command'].map(id => Object.freeze({ id })))
  });

  function get(id) { return props[id] || descriptor(id || 'missing_png_fixture', { cols: 1, rows: 1 }, '', 'desk'); }
  function getFootprint(id) { return get(id).footprint; }
  async function resolve(id, imageLoader) {
    const asset = get(id);
    for (const [source, urls] of [['png', asset.png], ['alternative', asset.alternatives]]) {
      for (const url of urls) {
        try { return { ...asset, source, image: await imageLoader(url) }; } catch (_) { }
      }
    }
    return { ...asset, source: 'procedural-fallback', draw: (ctx, box, options) => fallback(ctx, id, box, options) };
  }

  return { props, COLORS, FLOOR2_LEGACY_40x14, FLOOR2_6DECK_44x12, get, getFootprint, resolve, drawFallback: fallback, drawOrthoDesk34, drawOrthoCabinet34, drawModularAgent };
});
