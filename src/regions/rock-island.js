// Rock Island (incl. Arsenal Island and Andalusia): real names, the 2024-25 downtown rebuild, signs, water towers and
// four Blender models (Quarters One, the two rows of Rodman Avenue stone shops, the downtown gateway arch + letters).
// Sources and open questions: docs/regions/rock-island.md. Models: assets/src/regions/rock-island/ri_models.py.
// Pure data. Coordinates: game metres (x east, z south), from OSM via tools/map-config.mjs project().
const SHOP_H = 15;
// stone shop collision: oriented boxes [cx, cz, halfX, halfZ, height, base, heading] from the OSM outlines (Armory Row, heading 0.034)
const ARMORY = [[2547.2, 528.6, 2.1, 10.4], [2548.8, 576.0, 2.1, 10.6], [2582.9, 550.4, 32.9, 46.1], [2631.6, 571.3, 15.1, 10.5], [2655.6, 548.0, 9.6, 45.4],
  [2681.1, 582.8, 14.7, 9.8], [2702.9, 545.6, 8.4, 46.2], [2714.6, 551.2, 3.1, 40.2], [2742.4, 519.0, 2.0, 10.2], [2744.0, 566.6, 2.0, 9.9], [2754.4, 541.8, 9.2, 45.9],
  [2777.9, 576.6, 13.1, 9.8], [2801.7, 539.4, 11.9, 45.6], [2850.2, 537.0, 11.1, 45.7], [2875.7, 572.2, 13.2, 9.9], [2898.0, 535.2, 10.3, 46.4], [2924.0, 527.9, 16.0, 39.7],
  [2949.5, 532.7, 9.3, 45.1], [2973.1, 567.5, 13.1, 9.7], [2994.5, 530.7, 9.6, 46.0], [3005.4, 506.3, 2.2, 9.8], [3007.1, 554.1, 2.2, 9.9]].map((b) => [...b, SHOP_H, 0, 0.034]);
// Arsenal Row (south of Rodman Ave, heading 0.048)
const ARSENAL = [[2557.1, 710.5, 2.0, 9.4], [2559.4, 758.1, 2.0, 9.4], [2569.5, 733.1, 9.2, 45.4], [2590.4, 696.6, 13.4, 10.0], [2615.1, 731.2, 9.6, 45.8], [2639.9, 706.5, 16.4, 9.6],
  [2656.6, 753.6, 2.0, 9.9], [2666.8, 728.7, 9.3, 45.6], [2679.8, 692.1, 5.5, 9.7], [2680.5, 770.2, 2.4, 3.6], [2683.8, 724.8, 3.1, 11.4], [2688.5, 710.9, 2.3, 28.9], [2695.5, 691.2, 5.7, 9.5],
  [2694.9, 724.5, 3.4, 11.2], [2702.7, 769.2, 2.2, 3.5], [2714.2, 726.5, 11.3, 45.6], [2761.9, 724.1, 11.2, 45.9], [2785.0, 686.7, 13.6, 9.8], [2809.4, 721.7, 9.1, 45.9], [2819.7, 697.4, 2.3, 10.2],
  [2821.8, 740.9, 2.3, 13.8], [2858.9, 719.0, 11.2, 45.4], [2881.9, 682.4, 13.5, 10.0], [2906.5, 717.0, 9.5, 45.7], [2929.3, 692.4, 14.4, 9.6], [2956.5, 714.6, 11.7, 45.6], [2979.5, 677.9, 13.0, 10.1],
  [2972.2, 756.0, 2.0, 3.6], [2994.0, 755.0, 2.2, 3.6], [3005.7, 712.3, 11.5, 45.7]].map((b) => [...b, SHOP_H, 0, 0.048]);
// small clear boxes on corners of each OSM shop outline (a box touching a building drops the whole building)
const clearAt = (pts) => pts.map(([x, z]) => [x, z, 2, 2]);

// decorative street lights of the Rebuild Downtown blocks (18th St 1st-3rd Ave, 2nd and 3rd Ave 18th-19th St)
const LIGHTS = [];
for (const z of [1300, 1330, 1360, 1412, 1442, 1472, 1498]) LIGHTS.push({ kind: 'light', x: 238, z }, { kind: 'light', x: 255, z });
for (const x of [275, 305, 335]) for (const z of [1378, 1394, 1502, 1518]) LIGHTS.push({ kind: 'light', x, z });

export default {
  id: 'rock-island',
  name: 'Rock Island',
  bounds: [-11750, 100, 5100, 12000],
  names: [
    { match: { x: 287, z: 1361, r: 10 }, name: 'RIBCO' }, // Rock Island Brewing Co., 1815 2nd Ave (reopened Dec 2025)
    { match: 987174622, name: "Huckleberry's Great Pizza" }, // 223 18th St
    { match: { x: 614, z: 1562, r: 10 }, name: 'Rozz-Tox' }, // 2108 3rd Ave
  ],
  places: [
    // Downtown Rock Island (the rebranded "District"): Green Lawn at 1801 2nd Ave, trees and benches on it
    { kind: 'tree', x: 256, z: 1334, tree: 0 }, { kind: 'tree', x: 274, z: 1330, tree: 0 }, { kind: 'tree', x: 272, z: 1352, tree: 2 },
    { kind: 'prop', prop: 'bench', x: 264, z: 1346 }, { kind: 'prop', prop: 'bench', x: 278, z: 1342 },
    { kind: 'prop', prop: 'planter', x: 238, z: 1395 }, { kind: 'prop', prop: 'planter', x: 255, z: 1430 }, { kind: 'prop', prop: 'planter', x: 238, z: 1460 },
    ...LIGHTS,
    // Schwiebert Riverfront Park (101 17th St): entrance sign on 1st Ave, benches on the promenade
    { kind: 'sign', x: 175, z: 1252, h: 0, text: 'SCHWIEBERT RIVERFRONT PARK', style: 'shop', w: 3.2 },
    ...[190, 230, 270, 310, 350, 390].map((x) => ({ kind: 'prop', prop: 'bench', x, z: 1172 })),
    // parks, schools, campus
    { kind: 'sign', x: 300, z: 2830, text: 'LONGVIEW PARK', style: 'shop', w: 2.8 },
    { kind: 'sign', x: 1060, z: 1622, h: 0, text: 'QUAD CITY BOTANICAL CENTER', style: 'shop', w: 3.2 },
    { kind: 'sign', x: -120, z: 4166, text: 'ROCK ISLAND HIGH SCHOOL', style: 'shop', w: 3.2 },
    { kind: 'sign', x: 2722, z: 2600, text: 'ALLEMAN HIGH SCHOOL', style: 'shop', w: 3.0 },
    { kind: 'sign', x: 2486, z: 2097, text: 'AUGUSTANA COLLEGE', style: 'shop', w: 3.0 },
    // Arsenal Island
    { kind: 'sign', x: 4880, z: 1100, text: 'ROCK ISLAND ARSENAL', style: 'pole', w: 3.4, height: 3.2, lit: true },
    { kind: 'sign', x: 3639, z: 605, h: Math.PI, text: 'ROCK ISLAND CONFEDERATE CEMETERY', style: 'shop', w: 3.4 },
    { kind: 'sign', x: 1075, z: 648, text: 'MISSISSIPPI RIVER VISITOR CENTER', style: 'shop', w: 3.4 },
    // Andalusia: welcome sign on IL 92 (6th Ave E) at the east edge of the village
    { kind: 'sign', x: -11250, z: 9338, text: 'ANDALUSIA', style: 'street', w: 2.6 },
    // the two city water towers OSM lacks (rigov.org list: 14th St & 42nd Ave, 36th St & 14th Ave; the other four are in OSM)
    { kind: 'watertower', x: -128, z: 5934, height: 40, text: 'ROCK ISLAND' },
    { kind: 'watertower', x: 2335, z: 2918, height: 40, text: 'ROCK ISLAND' },
  ],
  models: [
    // Quarters One (1871), Rock Island Arsenal: main block, front tower, rear wing
    { file: 'quarters1', x: 2357, z: 128, ground: true, load: 800, clear: [[2358, 127, 4, 4]],
      solid: [[2358, 127.05, 8, 11.55, 17], [2367.8, 127.1, 1.8, 2.9, 23], [2342, 126, 8, 5.4, 15]] },
    // the ten stone shops on Rodman Avenue (Armory Row north, Arsenal Row south)
    { file: 'shops_n', x: 2777, z: 541, ground: true, dy: 0.6, load: 1000,
      clear: clearAt([[2544.8, 518.3], [2709.8, 499.2], [2718.7, 579.9], [2552, 597.6], [2740, 508.9], [2808.1, 493.4], [2814.7, 573.4], [2747.3, 588.1], [2839.8, 504.2], [3002.6, 484.5], [3009.3, 563.9], [2844.4, 582.8]]),
      solid: ARMORY },
    { file: 'shops_s', x: 2787, z: 722, ground: true, dy: 1.0, load: 1000,
      clear: clearAt([[2554.7, 701.2], [2720, 680.5], [2727.2, 759.5], [2562.4, 778.9], [2749, 691.4], [2817.3, 675.4], [2824, 754.6], [2756.3, 770.4], [2846.2, 687.1], [3011.5, 666.3], [3018.8, 745.5], [2853.9, 764.6]]),
      solid: ARSENAL },
    // gateway arch over 18th St at 1st Ave + the ROCK ISLAND letters on the Green Lawn (2nd Ave & 18th St)
    { file: 'downtown', x: 246.4, z: 1284, ground: true, load: 600, clear: [],
      solid: [[237.2, 1284, 0.75, 0.75, 5.6], [255.6, 1284, 0.75, 0.75, 5.6], [259.5, 1372, 5.6, 0.6, 1.8, 0, 0.611]] },
  ],
  notes: 'See docs/regions/rock-island.md. Unverified: gateway arch design (modelled generic), exact RIBCO/Rozz-Tox footprints, '
    + 'water tower spots at 14th St & 42nd Ave and 36th St & 14th Ave (intersection known, corner guessed), stone-shop roof form. '
    + 'Wanted from core: a painted mini-roundabout at 2nd Ave & 18th St (built 2024), Arsenal Island gates.',
};
