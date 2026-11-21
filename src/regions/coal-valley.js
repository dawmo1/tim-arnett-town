// Coal Valley (incl. Niabi Zoo and Oak Grove): real names, street features and signature models. Research notes and
// sources: docs/regions/coal-valley.md. Models: assets/src/regions/coal-valley/coal_valley.py (background Blender).
// Coordinates are game metres (x east, z south), from OSM via tools/map-config.mjs project().
const W = -Math.PI / 2, E = Math.PI / 2, N = Math.PI; // sign headings: the way the panel faces (0 = south)
export default {
  id: 'coal-valley',
  name: 'Coal Valley',
  bounds: [-800, 7050, 14750, 12900],
  names: [
    { match: 544439149, name: 'Coal Valley Municipal Center' }, // 900 1st Street (2002): village hall, police, township
    { match: 544439148, name: 'Robert R. Jones Public Library' }, // in the Municipal Center
    { match: 544438798, name: 'Coal Valley Baptist Church' },
    { match: 884842733, name: 'Bicentennial Elementary School' },
    { match: 1349654839, name: "Mulligan's Valley Pub" }, // strip on US-6 (Rudy's Tacos, Country Style Ice Cream, Subway)
    { match: 1545011190, name: '7-Eleven' }, // with the BP canopy, 1st Ave & 1st St
    { match: 930691003, name: 'Wild Things Gift Shop' }, // Niabi Zoo (OSM shop=gift node inside it)
    { match: 930691005, name: 'The Treehouse Snack Shack' },
    { match: 930691004, name: 'Niabi Zoo Express Depot' },
    { match: 628930336, name: 'Big Cats' },
  ],
  places: [
    // village gateways: US-6 (1st Avenue) west and east, US-150 (23rd Avenue) west and south-east
    { kind: 'sign', x: 8340, z: 7848, h: W, text: 'WELCOME TO COAL VALLEY', style: 'shop', w: 3.2, height: 2.4 },
    { kind: 'sign', x: 10690, z: 7892, h: E, text: 'WELCOME TO COAL VALLEY', style: 'shop', w: 3.2, height: 2.4 },
    { kind: 'sign', x: 9100, z: 10425, h: W, text: 'WELCOME TO COAL VALLEY', style: 'shop', w: 3.2, height: 2.4 },
    { kind: 'sign', x: 10575, z: 10670, h: 0.64, text: 'WELCOME TO COAL VALLEY', style: 'shop', w: 3.2, height: 2.4 },
    // Niabi Zoo Road (CR 77) leaves US-6 east of town; the zoo's lot is ~2 km south-east
    { kind: 'sign', x: 10735, z: 7895, h: W, text: 'NIABI ZOO ->', style: 'shop', w: 2.6, height: 2.6 },
    { kind: 'sign', x: 11805, z: 8572, text: 'NIABI ZOO', style: 'pole', w: 3.6, height: 4.2, lit: true },
    // Municipal Center (900 1st Street) and the school and parks along 1st Street
    { kind: 'sign', x: 9706, z: 8884, h: E, text: 'COAL VALLEY MUNICIPAL CENTER', style: 'shop', w: 3.4, height: 1.8 },
    { kind: 'sign', x: 9706, z: 9030, h: E, text: 'BICENTENNIAL ELEMENTARY', style: 'shop', w: 3.0, height: 2.0 },
    { kind: 'sign', x: 9560, z: 9100, text: 'COAL VALLEY MUNICIPAL PARK', style: 'shop', w: 3.0, height: 1.8 },
    { kind: 'sign', x: 9277, z: 8125, text: 'VETERANS MEMORIAL PARK', style: 'shop', w: 3.0, height: 1.8 },
    { kind: 'prop', prop: 'flagpole', x: 9283, z: 8138 },
    { kind: 'sign', x: 9776, z: 10395, text: 'POST OFFICE PARK', style: 'shop', w: 2.6, height: 1.8 },
    { kind: 'prop', prop: 'bench', x: 9700, z: 8895, h: E },
    { kind: 'prop', prop: 'bin', x: 9700, z: 8900 },
    // Niabi Zoo: entry plaza by the pond, then the exhibit signs along the loop path
    { kind: 'prop', prop: 'bench', x: 11893, z: 8808 },
    { kind: 'prop', prop: 'bench', x: 11899, z: 8814 },
    { kind: 'prop', prop: 'bench', x: 11914, z: 8813 },
    { kind: 'prop', prop: 'bin', x: 11889, z: 8803 },
    { kind: 'prop', prop: 'planter', x: 11884, z: 8790 },
    { kind: 'prop', prop: 'planter', x: 11890, z: 8796 },
    { kind: 'prop', prop: 'flagpole', x: 11880, z: 8768 },
    { kind: 'sign', x: 11979, z: 8822, text: 'NIABI ZOO EXPRESS', style: 'shop', w: 2.2, height: 2.2 },
    { kind: 'sign', x: 11950, z: 8824, text: 'WILD THINGS GIFT SHOP', style: 'shop', w: 2.2, height: 2.2 },
    { kind: 'sign', x: 12050, z: 8893, text: 'KOI POND', style: 'shop', w: 1.8, height: 1.8 },
    { kind: 'sign', x: 12005, z: 8840, text: 'GIBBONS', style: 'shop', w: 1.8, height: 1.8 },
    { kind: 'sign', x: 11990, z: 8790, text: 'WHITE RHINO', style: 'shop', w: 1.8, height: 1.8 },
    { kind: 'sign', x: 11880, z: 8960, text: 'BIG CATS', style: 'shop', w: 1.8, height: 1.8 },
    { kind: 'sign', x: 11830, z: 9005, text: 'REPTILE HOUSE', style: 'shop', w: 1.8, height: 1.8 },
    { kind: 'sign', x: 11785, z: 9025, text: 'WOLF RIDGE', style: 'shop', w: 1.8, height: 1.8 },
    { kind: 'sign', x: 11925, z: 9030, text: 'PAINTED DOGS', style: 'shop', w: 1.8, height: 1.8 },
    { kind: 'sign', x: 11995, z: 9095, text: 'BIODIVERSITY HALL', style: 'shop', w: 2.0, height: 1.8 },
    { kind: 'sign', x: 12000, z: 8915, text: 'DOMESTIC ANIMAL AREA', style: 'shop', w: 2.2, height: 1.8 },
    { kind: 'sign', x: 11953, z: 8970, text: 'FESTIVAL LAWN', style: 'shop', w: 1.8, height: 1.8 },
    { kind: 'prop', prop: 'bench', x: 11940, z: 8990 },
    { kind: 'prop', prop: 'bench', x: 11965, z: 8995 },
    { kind: 'prop', prop: 'bin', x: 11935, z: 8960 },
    { kind: 'prop', prop: 'bench', x: 11985, z: 9080 },
    // Oak Grove: US-67 through the village at 106th Avenue West
    { kind: 'sign', x: 805, z: 11930, h: N, text: 'OAK GROVE', style: 'shop', w: 2.6, height: 2.4 },
    { kind: 'sign', x: 625, z: 12340, h: 0, text: 'OAK GROVE', style: 'shop', w: 2.6, height: 2.4 },
  ],
  models: [
    { // Niabi Zoo Discovery Center (2011 admissions/education), entry walk canopy and the NIABI ZOO monument
      file: 'niabi_entrance', x: 11861, z: 8806, ground: true, load: 700,
      clear: [[11861, 8806, 4, 4], [11873.5, 8783.6, 1.5, 1.5]],
      solid: [[11863, 8804.8, 10.85, 9.35, 12, 0, 0.751], [11853, 8814, 2.7, 9.3, 8, 0, 0.751], [11858.7, 8791.9, 7.5, 2.95, 9, 0, 0.751],
        [11868.9, 8817.5, 6.55, 4, 9, 0, 0.751], [11868.5, 8793.2, 1.15, 4.65, 8, 0, 0.751], [11872.2, 8771.6, 4.6, 0.6, 2.6, 0, 0.751]],
    },
    { // Passport to Africa: giraffe house, raised feeding deck (walk under it), two giraffes
      file: 'niabi_giraffe', x: 11945, z: 9105, ground: true, load: 600,
      clear: [[11931, 9128, 3, 3], [11970, 9088, 1, 1]],
      solid: [[11931, 9127.7, 10.3, 11, 11, 0, -0.116], [11967.2, 9082.2, 1.5, 0.6, 5.5, 0, 0.29], [11956, 9086.6, 1.5, 0.6, 5.5, 0, 0.29]],
    },
    { // Endangered Species Carousel house
      file: 'niabi_carousel', x: 11914.2, z: 8972.9, ground: true, load: 450,
      clear: [[11914, 8973, 2, 2]],
      solid: [[11914.2, 8972.9, 4.8, 4.8, 4, 0, 0.785]],
    },
    { // Coal Valley Municipal Center (village hall + Robert R. Jones Library), 900 1st Street
      file: 'cv_municipal', x: 9662, z: 8900, ground: true, load: 600,
      clear: [[9664, 8884, 3, 3], [9658, 8918, 3, 3]],
      solid: [[9664.8, 8884.5, 13.2, 8.2, 8.5], [9663.4, 8901.4, 7.4, 8.9, 7], [9658, 8918.6, 19.5, 8.4, 7.6]],
    },
  ],
  notes: 'Sources and unverified details: docs/regions/coal-valley.md. OSM already draws the zoo exhibits, the south water '
    + 'tower (wt point, labelled by town) and the church names. To do: Engstrom Park (405 E 19th Ave) sign once located, '
    + 'Blackhawk Bank (200 1st St) on a Microsoft footprint, the 1892 town hall if it still stands.',
};
