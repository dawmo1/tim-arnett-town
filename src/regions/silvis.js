// Silvis (incl. Carbon Cliff): real names, street features and signature models. Sources: docs/regions/silvis.md.
// Pure data (see README.md). Coordinates: game metres, x east, z south (tools/map-config.mjs project()).
// Already drawn from OSM, so not repeated here: the three water towers (13506,1538 downtown by Schadt Park;
// 13882,3531; 15235,2642 Carbon Cliff), the named churches, schools, Hy-Vee / Walmart / Crosstown, the library,
// McGehee Center, police and fire stations.
export default {
  id: 'silvis',
  name: 'Silvis',
  bounds: [12600, 200, 17150, 6200],
  names: [
    // 1st Avenue (IL 84 / IL 92) downtown. Odd numbers on the north side, the hundreds follow the numbered streets.
    { match: 844554260, name: 'Silvis Post Office' }, // 1001 1st Ave (USPS)
    { match: 844554263, name: 'La Michoacana Ice Cream' }, // 917 1st Ave (La Canasta Bakery shares it: sign below)
    { match: 464923572, name: 'Mr. Panda Chinese Kitchen' }, // 924 1st Ave
    { match: { x: 12721, z: 1131, r: 8 }, name: "Tony's Grocery" }, // 135 Hero Street
    // Carbon Cliff
    { match: { x: 15142, z: 2090, r: 12 }, name: 'Carbon Cliff Village Hall' }, // 1001 Mansur Ave
  ],
  places: [
    // Hero Street USA (2nd Street, renamed 1967): the memorial corner at 1st Ave and the park a block south
    { kind: 'sign', x: 12786, z: 1003, text: 'HERO STREET USA', style: 'street', w: 2.6, height: 3 },
    { kind: 'prop', prop: 'flagpole', x: 12791, z: 1025 },
    { kind: 'sign', x: 12749, z: 1112, text: 'HERO STREET MEMORIAL PARK', style: 'shop', w: 3.2, height: 2.4 },
    // downtown 1st Avenue
    { kind: 'mural', x: 13622.7, z: 1264.5, h: 1.356, w: 14, hgt: 3.2, y: 0.8, text: 'SILVIS  HERO STREET  ROCK ISLAND LINES' }, // 2024 mural by the post office lot
    { kind: 'prop', prop: 'mailbox', x: 13615, z: 1278 },
    { kind: 'sign', x: 13578, z: 1271, text: 'LA CANASTA BAKERY', style: 'shop', w: 2.4, height: 2.6 },
    { kind: 'sign', x: 13527, z: 1135, text: 'RRHMA SILVIS SHOP', style: 'shop', w: 3, height: 2.6 },
    { kind: 'sign', x: 13695, z: 1700, text: 'NORMAN SCHADT PARK', style: 'shop', w: 3, height: 2.4 },
    // Carbon Cliff
    { kind: 'sign', x: 15112, z: 2090, text: 'VILLAGE OF CARBON CLIFF', style: 'shop', w: 3.2, height: 2.4 },
    { kind: 'sign', x: 15905, z: 2880, text: 'CARBON CLIFF PARK', style: 'shop', w: 3, height: 2.4 }, // 343 N 1st Ave
  ],
  models: [
    // former Rock Island Lines Silvis locomotive shop (1903), now Railroading Heritage of Midwest America: OSM 489120819
    { file: 'shop', x: 13745, z: 940, ground: true, load: 1200, clear: [[13745, 940, 20, 12]],
      solid: [[13750.8, 924.5, 138, 27, 16.3, 0, -0.2555], [13764.6, 970.5, 101, 14, 16.3, 0, -0.2555], [13606.6, 891, 12, 19, 16.3, 0, -0.2555]] },
    // Hero Street USA monument (2007): stone block with the eight men in relief, bronze eagle holding the flag
    { file: 'hero', x: 12791, z: 1018, ground: true, load: 500, clear: [], solid: [[12791, 1018, 2.5, 1.7, 4.8]] },
  ],
  notes: 'Research and sources: docs/regions/silvis.md. Not here (other regions): Quad City Downs (5005 Morton Dr, East Moline, closed 2015), '
    + "Jumer's / Bally's casino (Rock Island), TPC Deere Run (Silvis address, but west of these bounds). 1st Ave 700-800 blocks have no "
    + 'footprints in the tile data, so the bars there (Avenue Tap 712, Torchlight / Frank\'s Pizzeria 711, Railhouse 803, '
    + "Rick and Kathy's 815) can't be renamed yet. Silvis City Hall (121 11th St) not matched to a footprint.",
};
