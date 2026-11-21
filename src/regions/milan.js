// Milan, IL (old Camden Mills): real names, street features and signature models. Sources: docs/regions/milan.md.
// Street grid (game m): 1st St / US 67 runs N-S at x ~865; W 1st Ave / US 67 E-W at z ~7780; streets every ~125 m
// west (2nd St W x 740, 3rd 612, 4th 482, 5th 354, 6th 222); avenues south (2nd z 7895, 3rd 8001, 4th 8138, 10th 8941).
export default {
  id: 'milan',
  name: 'Milan',
  bounds: [-2350, 6600, 4600, 12650],
  // OSM already names most of Milan's businesses (Hy-Vee, Two Sisters, Maid-Rite, McDonald's...). These are the
  // Microsoft footprints with no name, matched from street addresses (block numbers; see docs/regions/milan.md).
  names: [
    { match: { x: 454, z: 7806, r: 10 }, name: 'Dizzy Horse' }, // 432 1st Ave W, corner of 4th St W (ex Legends Corner Bar)
    { match: { x: 541, z: 7737, r: 8 }, name: "Spinner's Pizza" }, // 319 1st Ave W
    { match: { x: 793, z: 7755, r: 8 }, name: "Pagalo's Pizzeria & Gelato" }, // 119 1st Ave W
    { match: { x: 332, z: 7737, r: 8 }, name: 'American Legion Post' }, // 515 1st Ave W
    { match: { x: 721, z: 8329, r: 10 }, name: "Finn's Grill & Bar" }, // 527 2nd St W, behind 580 1st St W
    { match: { x: 698, z: 10303, r: 10 }, name: 'Backyard Bowl' }, // 2020 1st St W, the old Milan Lanes
    { match: { x: 505, z: 8968, r: 8 }, name: "Vega's Bar" }, // 1011 4th St W
  ],
  places: [
    // town entry on US 67 coming off the Rock River bridges from Rock Island
    { kind: 'sign', x: 370, z: 7700, text: 'WELCOME TO MILAN', style: 'shop', w: 3.2, height: 2.8 },
    // park signs at each park's nearest street (OSM parks)
    { kind: 'sign', x: 1176, z: 8141, text: 'DICKSON PARK', style: 'shop', w: 2.4 },
    { kind: 'sign', x: 1255, z: 9251, text: 'COLLINSON PARK', style: 'shop', w: 2.4 },
    { kind: 'sign', x: 129, z: 7905, text: 'NEL DANIELS PARK', style: 'shop', w: 2.6 },
    { kind: 'sign', x: 438, z: 10002, text: 'LITTLE LEAGUE PARK', style: 'shop', w: 2.6 },
    { kind: 'sign', x: 585, z: 9781, text: 'FIRST PRESBYTERIAN PARK', style: 'shop', w: 3.0 },
    { kind: 'sign', x: 1784, z: 8188, text: 'PAPPAS PARK', style: 'shop', w: 2.4 },
    { kind: 'sign', x: -209, z: 9568, text: 'SHADYBROOK PARK', style: 'shop', w: 2.6 },
    { kind: 'sign', x: 1007, z: 10602, text: 'CAMDEN PARK', style: 'shop', w: 3.0, height: 2.8 },
    { kind: 'sign', x: -550, z: 8687, text: 'WEST PARK', style: 'shop', w: 2.4 },
    // Hennepin Canal Parkway: Lock 30 / Steel Dam access lot (state park), Lock 31 by the US 67 bridge
    { kind: 'sign', x: 2510, z: 7062, text: 'HENNEPIN CANAL LOCK 30', style: 'shop', w: 3.4 },
    { kind: 'sign', x: -1330, z: 6925, text: 'HENNEPIN CANAL LOCK 31', style: 'shop', w: 3.4 },
    // flags: Milan Post Office (USPS) on 1st Ave W, the fire station
    { kind: 'prop', prop: 'flagpole', x: 662, z: 7822 },
    { kind: 'prop', prop: 'mailbox', x: 676, z: 7822 },
    { kind: 'prop', prop: 'flagpole', x: 612 - 9, z: 7797 },
    // municipal building lot between 1st St E and the building (guess: no OSM lot)
    { kind: 'parking', pts: [896, 8160, 925, 8160, 925, 8214, 896, 8214] },
  ],
  // Blender sources: assets/src/regions/milan/milan.py. Each is modelled in game axes around its anchor (h 0).
  models: [
    { file: 'muni', x: 962, z: 8192, ground: true, dy: -0.35, load: 700, clear: [[962, 8191, 34, 26]],
      solid: [[954.1, 8205.35, 25.5, 6.35, 10.3], [968.9, 8182, 10.7, 17, 10.3], [982.6, 8205.45, 3.4, 11.75, 10.3], [987.95, 8175.05, 8.35, 5.05, 5.7],
        [953.6, 8195, 4.2, 4.2, 11.8], [931, 8170, 0.4, 2.6, 2]] },
    { file: 'camden', x: 918, z: 10892, ground: true, dy: -0.5, load: 600, clear: [[921, 10893.5, 29, 19]],
      solid: [[924.8, 10885.4, 25, 3.8, 5.5, 0, -0.269], [912.9, 10896.7, 20.95, 10.35, 5.5, 0, -0.269], [886, 10880, 0.4, 2.4, 2]] },
    { file: 'shelter', x: 1285, z: 10745, ground: true, dy: -0.3, load: 350, clear: [], solid: [] }, // Camden Park shelters (6 real)
    { file: 'shelter', x: 1307, z: 10710, ground: true, load: 350, h: Math.PI / 2, clear: [], solid: [] },
  ],
  notes: 'Research and sources: docs/regions/milan.md. OSM already renders the three water towers here (named from townAt) and names'
    + ' most businesses. Left for later: Sears Dam / Steel Dam / Hennepin locks as models (countryside owns locks and dams),'
    + ' the disused Sears hydro plant and Cotton Mill Building at the Rock River (OSM buildings), Backyard Bowl interior.',
};
