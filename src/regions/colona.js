// Colona (Henry County, IL): the former City of Green Rock (the numbered street grid west of the Green River) and the
// old Village of Colona (Maple / Warren / Water Streets by Hennepin Canal Lock 28), merged in 1997. IL 84 comes in over
// the Rock River on Colona Road, runs 1st Avenue and then 1st Street (the main street: police, fire, churches, Grease
// Monkeys, City Hall at 9th Avenue) and leaves south over the Green River to US 6. Sources: docs/regions/colona.md.
// Coordinates are game metres (tools/map-config.mjs project()); most points are the OSM features' own positions.
export default {
  id: 'colona',
  name: 'Colona',
  bounds: [15400, 3600, 21500, 9150],
  names: [
    { match: 955807700, name: 'St. Patrick Catholic Church' }, // 201 First Street (Diocese of Peoria, parish founded 1942)
    { match: 884842730, name: 'Colona Grade School' }, // 700 1st Street, Colona School District 190's only school
    { match: 884842720, name: 'Colona Grade School' },
    { match: 1528236331, name: "Maria's Pizza" }, // 514 Green Park Ave (Glazed Donuts & Coffee shares the block, 512)
    { match: 1539381683, name: 'Subway' },
    { match: 1564473671, name: 'I-80 Cafe' }, // 1356 Cleveland Road, Exit 7
    { match: 1544665807, name: 'Exit 7 Motorsports Park' }, // karting, 1350 Cleveland Road
    { match: { x: 18340, z: 5348, r: 10 }, name: 'Dairy Queen' }, // 550 Green Park Ave (MS footprint)
    { match: { x: 18363, z: 5814, r: 18 }, name: 'Highland Packing Co' }, // 810 Green Park Ave (MS footprint)
    { match: { x: 21247, z: 6450, r: 20 }, name: 'Paints BBQ' }, // by Colona's Scott Family Park (MS footprint)
  ],
  places: [
    // ---- 1st Street / civic
    { kind: 'sign', x: 18350, z: 5870, text: 'COLONA CITY HALL', style: 'shop', w: 2.8 }, // 100 E 9th Ave
    { kind: 'prop', prop: 'flagpole', x: 18372, z: 5869 },
    { kind: 'prop', prop: 'flagpole', x: 18378, z: 5925 }, // post office, 900 1st Street
    { kind: 'sign', x: 18294, z: 6044, text: 'TWIN RIVERS DISTRICT PUBLIC LIBRARY', style: 'shop', w: 3.4 }, // 911 1st Street
    { kind: 'prop', prop: 'flagpole', x: 18288, z: 4985 }, // fire department, 401 1st St
    { kind: 'prop', prop: 'flagpole', x: 18288, z: 4800 }, // police
    { kind: 'sign', x: 18312, z: 4830, text: 'COLONA GRADE SCHOOL', style: 'shop', w: 3.0 },
    { kind: 'prop', prop: 'flagpole', x: 18320, z: 4845 },
    { kind: 'sign', x: 18284, z: 4674, text: 'ST. PATRICK CATHOLIC CHURCH', style: 'shop', w: 3.2 },
    // ---- parks (OSM leisure=park names)
    { kind: 'sign', x: 18270, z: 4492, text: 'COLONA MEMORIAL PARK', style: 'shop', w: 3.0 }, // 1st St / Colona Rd, by the water tower
    { kind: 'prop', prop: 'flagpole', x: 18285, z: 4505 },
    { kind: 'prop', prop: 'bench', x: 18275, z: 4512 },
    { kind: 'prop', prop: 'bench', x: 18262, z: 4507 },
    { kind: 'sign', x: 18360, z: 4664, h: -Math.PI / 2, text: "GAILLIAERT'S PARK", style: 'shop', w: 2.8 },
    { kind: 'sign', x: 19072, z: 4618, text: 'OLD COLONA PARK', style: 'shop', w: 2.6 },
    { kind: 'sign', x: 19198, z: 5776, text: 'GREENWOOD PARK', style: 'shop', w: 2.6 },
    { kind: 'sign', x: 17585, z: 5276, text: 'TY MASSEY MEMORIAL BALL DIAMOND', style: 'shop', w: 3.4 },
    { kind: 'sign', x: 21332, z: 6140, text: "COLONA'S SCOTT FAMILY PARK", style: 'shop', w: 3.2 }, // 5775 Poppy Garden Rd (city-owned since 2013)
    // ---- Hennepin Canal: Lock 29 where it drops into the Rock River (city park + boat launch), Lock 28 in old Colona
    { kind: 'sign', x: 15612, z: 5778, text: 'HENNEPIN CANAL LOCK 29', style: 'shop', w: 3.0 },
    { kind: 'prop', prop: 'bench', x: 15645, z: 5799, h: 0 },
    { kind: 'prop', prop: 'bench', x: 15625, z: 5800, h: 0 },
    { kind: 'prop', prop: 'bin', x: 15618, z: 5795 },
    { kind: 'sign', x: 19145, z: 4660, text: 'HENNEPIN CANAL LOCK 28', style: 'shop', w: 3.0 },
    // ---- I-80 Exit 7 (Cleveland Road)
    { kind: 'sign', x: 20276, z: 4122, text: 'I-80 CAFE', style: 'pole', w: 3.0, height: 6, lit: true },
    { kind: 'sign', x: 20238, z: 4120, text: 'EXIT 7 MOTORSPORTS PARK', style: 'shop', w: 3.2 },
    // ---- Bi-State Sportsman's (571 Cleveland Rd): "turn right at sign and up the hill" (club website directions)
    { kind: 'sign', x: 19254, z: 4377, h: 0, text: "BI-STATE SPORTSMAN'S CLUB", style: 'shop', w: 3.4 },
    { kind: 'sign', x: 19403, z: 3830, text: "BI-STATE SPORTSMAN'S  PARKING", style: 'shop', w: 2.6 },
    // shotfall warnings round the OSM hazard area (w941111529)
    { kind: 'sign', x: 19640, z: 3618, h: Math.PI, text: 'DANGER  SHOTGUN RANGE', style: 'shop', w: 2.2, height: 1.8 },
    { kind: 'sign', x: 19838, z: 3760, h: Math.PI / 2, text: 'DANGER  SHOTGUN RANGE', style: 'shop', w: 2.2, height: 1.8 },
    { kind: 'sign', x: 19700, z: 3900, h: 0, text: 'DANGER  SHOTGUN RANGE', style: 'shop', w: 2.2, height: 1.8 },
    { kind: 'sign', x: 19560, z: 3880, h: 0, text: 'DANGER  SHOTGUN RANGE', style: 'shop', w: 2.2, height: 1.8 },
  ],
  // Bridges: y 0 because the models carry the game's own deck heights (assets/src/regions/colona/colona.py reads them
  // from data/roads). Solids: the pier columns (bridges) and the two chamber walls (locks).
  models: [
    { file: 'rockbridge', x: 17019.3, z: 4414.6, y: 0, load: 1500, clear: [], solid: [ // IL 84 over the Rock River (1981)
      [16911.8, 4406.7, 1.0, 3.6, 7.9, 0, -0.1393], [16963.4, 4414.0, 1.0, 3.6, 13.2, 0, -0.1393], [17016.5, 4421.4, 1.0, 3.6, 14.8, 0, -0.1393],
      [17069.7, 4428.9, 1.0, 3.6, 12.6, 0, -0.1393], [17121.2, 4436.1, 1.0, 3.6, 6.9, 0, -0.1393],
      [17128.5, 4422.8, 1.0, 3.6, 6.5, 0, 3.0005], [17077.0, 4415.5, 1.0, 3.6, 12.1, 0, 3.0005], [17023.9, 4407.9, 1.0, 3.6, 14.3, 0, 3.0005],
      [16970.8, 4400.4, 1.0, 3.6, 12.7, 0, 3.0005], [16919.3, 4393.1, 1.0, 3.6, 7.6, 0, 3.0005],
    ] },
    { file: 'greenbridge', x: 18324.3, z: 6584.9, y: 0, load: 1000, clear: [], solid: [ // IL 84 over the Green River (1936/1993)
      [18324.7, 6605.7, 0.55, 5.6, 10.4, 0, 1.5889], [18324.3, 6584.9, 0.55, 5.6, 14.2, 0, 1.5889], [18324.0, 6564.2, 0.55, 5.6, 10.4, 0, 1.5889],
    ] },
    { file: 'lock29', x: 15634.1, z: 5815.2, y: 0, load: 700, clear: [], solid: [
      [15633.4, 5821.5, 32.4, 1.0, 2.4, 0, 3.0381], [15634.8, 5808.9, 32.4, 1.0, 2.4, 0, 3.0381],
    ] },
    { file: 'lock28', x: 19111.8, z: 4679.6, y: 0, load: 700, clear: [], solid: [
      [19116.8, 4683.6, 34.6, 1.0, 2.7, 0, -2.2467], [19106.8, 4675.6, 34.6, 1.0, 2.7, 0, -2.2467],
    ] },
    // Bi-State Sportsman's: 4 skeet fields (3 combination trap fields), 5-stand, clubhouse + 2 pavilions, lot and the
    // gravel drive from Cleveland Road (draped on the game terrain, so y 0; LOD1 keeps the drive and lot). Solids use the
    // based form [x, z, halfAlong, halfAcross, height, baseY, heading].
    { file: 'bistate', x: 19438.2, z: 3760.5, y: 0, load: 1000, clear: [[19438.2, 3760.5, 9, 15], [19452, 3684.5, 3.5, 4.5]], solid: [
      [19438.2, 3760.5, 8.4, 14.3, 8.49, 19.19, 0],
      [19474.9, 3746.5, 1.3, 1.3, 2.0, 19.05, -1.6261], [19472.7, 3787.1, 1.3, 1.3, 2.0, 18.68, -1.6261], [19470.4, 3827.8, 1.3, 1.3, 2.0, 18.25, -1.6261],
      [19478.2, 3685.6, 1.2, 1.3, 5.7, 19.59, -1.6261], [19476.0, 3724.9, 1.2, 1.3, 5.7, 19.2, -1.6261], [19475.9, 3727.5, 1.2, 1.3, 3.6, 19.2, -1.6261],
      [19473.8, 3765.5, 1.2, 1.3, 5.7, 18.87, -1.6261], [19473.6, 3768.1, 1.2, 1.3, 3.6, 18.87, -1.6261], [19471.5, 3806.1, 1.2, 1.3, 5.7, 18.48, -1.6261],
      [19471.4, 3808.7, 1.2, 1.3, 3.6, 18.48, -1.6261], [19469.2, 3848.1, 1.2, 1.3, 3.6, 18.03, -1.6261],
    ] },
  ],
  notes: 'Research and sources: docs/regions/colona.md. Models: assets/src/regions/colona/colona.py (background Blender). ' +
    'Both OSM water towers (silver one at 1st Ave / 1st St, 18318,4544; the east one at 20979,6272) are already drawn by the core from OSM, so no watertower places here (they would double up). ' +
    'Not done: City Hall / main-street facades (no reference photos found), the Bi-State sporting clays course in the woods, Lavender Crest Winery sign (location unknown), the I-80/I-88 interchange (north of these bounds, z < 3600) and the Big X (I-74/I-80/I-280, just south-east).',
};
