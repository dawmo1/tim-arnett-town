// Geneseo, IL (Henry Co., "the Maple City"): the State St downtown and City Park, the Central Theatre row, the First
// Congregational Church, Geneseo High School (Maple Leafs), the parks, murals and the Hennepin Canal.
// Pure data. Sources and what is unverified: docs/regions/geneseo.md. Models: assets/src/regions/geneseo/geneseo.py.
// Coordinates are game metres (tools/map-config.mjs project()), mostly from OSM nodes/ways (ids in the notes).
const E = Math.PI / 2, W = -Math.PI / 2, N = Math.PI, S = 0; // headings: the way a sign/mural faces

export default {
  id: 'geneseo',
  name: 'Geneseo',
  bounds: [33350, 4650, 37750, 10850],
  names: [
    { match: 707598411, name: 'Central Theatre' }, // 111 N State: renamed from the (New) Geneseo Theatre (1924)
  ],
  places: [
    // ---- City Park (OSM ways 276742730 north block, 267003401 south block) and the State St boulevard
    { kind: 'sign', x: 35090, z: 8079, h: N, text: 'GENESEO CITY PARK', style: 'shop', w: 2.8 },
    { kind: 'sign', x: 35100, z: 8352, h: S, text: 'GENESEO CITY PARK', style: 'shop', w: 2.8 },
    { kind: 'statue', x: 35040, z: 8189, h: S }, // bronze statue (OSM node 13919219395)
    // veterans' memorial plaza, south block at State & Main: the 1891 Civil War memorial, flags, memorial benches
    { kind: 'statue', x: 35125, z: 8292, h: E, scale: 1.4 }, // war memorial (OSM way 1514063631)
    { kind: 'prop', prop: 'flagpole', x: 35133, z: 8292 }, // US flag, 7.6 m
    { kind: 'prop', prop: 'flagpole', x: 35130, z: 8288 }, // Navy
    { kind: 'prop', prop: 'flagpole', x: 35130, z: 8295 }, // Marine Corps
    { kind: 'prop', prop: 'bench', x: 35137, z: 8288, h: S },
    { kind: 'prop', prop: 'bench', x: 35137, z: 8296, h: N },
    { kind: 'prop', prop: 'bench', x: 35052, z: 8130, h: E },
    { kind: 'prop', prop: 'bench', x: 35052, z: 8160, h: E },
    { kind: 'prop', prop: 'bench', x: 35070, z: 8240, h: S },
    { kind: 'prop', prop: 'bin', x: 35020, z: 8289 },
    { kind: 'statue', x: 35141, z: 7940, h: E }, // Abraham Lincoln statue, State St at the Historical Museum
    { kind: 'sign', x: 35141, z: 7964, h: E, text: 'GENESEO HISTORICAL MUSEUM', style: 'shop', w: 3.0 }, // 205 S State
    { kind: 'sign', x: 35188, z: 7583, h: W, text: 'CENTRAL BANK PAVILION', style: 'shop', w: 3.0, lit: true }, // 218 N State, summer concerts
    { kind: 'prop', prop: 'flagpole', x: 35158, z: 8028 }, // VFW flag on the boulevard (223 S State)
    // ---- Geneseo Mural Project (geneseo.org/mural-project)
    { kind: 'mural', x: 35185, z: 7914.6, h: S, w: 14, hgt: 4, y: 1.2, text: 'WELCOME TO HISTORIC DOWNTOWN GENESEO' }, // 134 S State, 2022
    { kind: 'mural', x: 35180, z: 7732.3, h: N, w: 6, hgt: 3, y: 1.5, text: 'BRING ON THE BAND' }, // 112 N State, 2023
    { kind: 'mural', x: 35184, z: 8395.4, h: S, w: 10, hgt: 3, y: 1.2, text: 'THE FABRIC OF GENESEO' }, // 100 E Main, 2023
    // ---- Geneseo High School, 700 N State (Maple Leafs, kelly green and white), Bob Reade Field
    { kind: 'sign', x: 35166, z: 6640, h: W, text: 'GENESEO HIGH SCHOOL - MAPLE LEAFS', style: 'pole', w: 4.2, height: 3.2, lit: true },
    { kind: 'sign', x: 35352, z: 6730, h: N, text: 'BOB READE FIELD', style: 'shop', w: 3.4, height: 3.4 },
    { kind: 'sign', x: 35560, z: 6690, h: N, text: 'GENESEO MIDDLE SCHOOL', style: 'shop', w: 3.0 },
    // ---- parks and the canal
    { kind: 'sign', x: 35135, z: 9480, h: E, text: 'RICHMOND HILL PARK', style: 'shop', w: 3.0 }, // H K Robinson Dr
    { kind: 'sign', x: 34350, z: 9650, h: S, text: 'RICHMOND HILL PLAYERS', style: 'shop', w: 2.8 }, // 600 H K Robinson Dr
    { kind: 'sign', x: 36270, z: 5322, h: E, text: 'HENNEPIN CANAL PARKWAY', style: 'street', w: 3.0 }, // Grange Rd bridge, by the lock
    { kind: 'sign', x: 35262, z: 4690, h: E, text: 'IKES PARK - IZAAK WALTON LEAGUE', style: 'shop', w: 3.4 }, // 22870 IL 82
    { kind: 'sign', x: 35840, z: 8064, h: N, text: 'JOHN & CARLA EDWARDS AQUATIC CENTER', style: 'shop', w: 3.6 },
  ],
  models: [
    // City Park bandstand (OSM 706132429), white octagonal gazebo on a brick base, steps facing State St
    { file: 'bandstand', x: 35065.1, z: 8105, ground: true, load: 500, clear: [[35065.1, 8105, 5, 5]], solid: [[35065.1, 8105, 4.6, 4.6, 1]] },
    // 101-119 N State: Central Bank Illinois, the Central Theatre (marquee), Katsch, Brown & Ray, Mel Foster
    { file: 'storefronts', x: 35131, z: 7746, ground: true, load: 700, clear: [[35131, 7746, 14, 31]], solid: [[35130.8, 7746.3, 14.5, 31.4, 10]] },
    // First Congregational Church (UCC), 319 S State (OSM 707077022): nave, south porch + belfry and spire, west wing
    { file: 'congregational', x: 35128, z: 8180, ground: true, load: 900, clear: [[35128.2, 8179.8, 10, 20]],
      solid: [[35128.25, 8176.8, 9.7, 16.6, 15], [35130.15, 8196.4, 5.5, 3, 20], [35120.2, 8167.2, 1.8, 7, 4.5]] },
  ],
  notes: 'Research and sources: docs/regions/geneseo.md. Trap range: no range inside Geneseo was found online; the nearest '
    + 'verified trap field is Bi-State Sportsman\'s, 571 Cleveland Rd, Colona (colona region). Ask Dain where the team shoots, '
    + 'then model it. Unverified looks: bandstand colours, church facade and steeple position, Civil War memorial figure.',
};
