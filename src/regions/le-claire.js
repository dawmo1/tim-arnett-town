// Le Claire, Iowa: the Cody Road historic main street, the levee and the riverboat landing. Sources and what is
// guessed: docs/regions/le-claire.md. Princeton IA (41.67 N) is north of the map, so nothing here for it.
// Already in src/landmarks.js (not repeated): Buffalo Bill Museum with the Lone Star, Antique Archaeology.
export default {
  id: 'le-claire',
  name: 'Le Claire',
  bounds: [14300, -10000, 19850, -6300],
  names: [
    // Cody Rd, 100 block north (Wisconsin St to Jones St). Even numbers on the west side, odd on the river side.
    { match: { x: 19478.4, z: -8195.0, r: 8 }, name: 'Wide River Winery' }, // 106 N Cody Rd tasting room
    { match: { x: 19478.6, z: -8233.4, r: 6 }, name: 'Cody Road Coffee' }, // 114 N Cody Rd
    { match: { x: 19519.6, z: -8254.5, r: 10 }, name: 'Faithful Pilot Cafe' }, // 117 N Cody Rd (river side)
    { match: 981000401, name: 'Crane & Pelican Cafe' }, // the 1851 Dawley House, 127 S 2nd St
    // Eagle Ridge Rd / Canal Shore Dr, south end of town by the I-80 bridge
    { match: { x: 18042.8, z: -6800.6, r: 15 }, name: "Steventon's" }, // 1399 Eagle Ridge Rd, on the river
    { match: 1316992675, name: 'Hungry Hobo' }, // OSM point inside this footprint
  ],
  places: [
    // welcome sign at the north edge of town on US 67 (painted paddle steamer), facing southbound traffic
    { kind: 'sign', x: 19392, z: -9850, h: Math.PI, text: 'WELCOME TO LECLAIRE', style: 'shop', w: 3.6, height: 2.4 },
    // the levee: Freedom Rock (model) with its sign, the Green Tree marker, the riverboat landing
    { kind: 'sign', x: 19550, z: -8092, h: -Math.PI / 2, text: 'SCOTT COUNTY FREEDOM ROCK', style: 'pole', w: 2.4 },
    { kind: 'tree', x: 19560, z: -8238, tree: 0, scale: 1.5 },
    { kind: 'sign', x: 19556, z: -8228, h: -Math.PI / 2, text: 'THE GREEN TREE', style: 'pole', w: 1.8 },
    { kind: 'sign', x: 19598, z: -8352, h: -Math.PI / 2, text: 'RIVERBOAT TWILIGHT CRUISES', style: 'shop', w: 3.0, lit: true },
    { kind: 'sign', x: 19560, z: -8395, h: -Math.PI / 2, text: 'PORT OF LECLAIRE', style: 'pole', w: 2.0 },
    // levee path: benches looking at the river, lights, bins
    ...[-8105, -8130, -8155, -8180, -8205].map((z) => ({ kind: 'prop', prop: 'bench', x: 19592, z, h: Math.PI / 2 })),
    ...[-8095, -8140, -8185, -8230].map((z) => ({ kind: 'light', x: 19586, z })),
    { kind: 'prop', prop: 'bin', x: 19588, z: -8118 },
    { kind: 'prop', prop: 'bin', x: 19588, z: -8193 },
    { kind: 'prop', prop: 'flagpole', x: 19562, z: -8080 },
    // Cody Rd sidewalks (100-300 N blocks): street trees (they carry the music speakers), benches, planters, bins
    ...[-8188, -8228, -8268, -8350, -8395].map((z) => ({ kind: 'tree', x: z === -8350 ? 19506.5 : 19508, z, tree: 2, scale: 0.9 })),
    ...[-8200, -8250, -8282].map((z) => ({ kind: 'tree', x: 19491, z, tree: 2, scale: 0.9 })),
    { kind: 'prop', prop: 'bench', x: 19507.6, z: -8240, h: -Math.PI / 2 },
    { kind: 'prop', prop: 'bench', x: 19490.5, z: -8222, h: Math.PI / 2 },
    { kind: 'prop', prop: 'bench', x: 19508.5, z: -8402, h: -Math.PI / 2 },
    { kind: 'prop', prop: 'planter', x: 19508.5, z: -8292 },
    { kind: 'prop', prop: 'planter', x: 19490.5, z: -8292 },
    { kind: 'prop', prop: 'planter', x: 19508.5, z: -8184 },
    { kind: 'prop', prop: 'planter', x: 19490.5, z: -8184 },
    { kind: 'prop', prop: 'bin', x: 19508.5, z: -8300 },
    { kind: 'prop', prop: 'bin', x: 19490.5, z: -8240 },
    { kind: 'prop', prop: 'newsbox', x: 19490.5, z: -8210 },
    { kind: 'sign', x: 19490, z: -8188, h: Math.PI / 2, text: 'CODY ROAD HISTORIC DISTRICT', style: 'pole', w: 2.6 },
    // Le Claire's water tower is already drawn from the OSM point (17714, -7666) with the town name
  ],
  models: [
    // Mississippi River Distilling Co., 303 N Cody Rd (OSM 791117506): anchor = middle of the Cody Rd front at street level
    { file: 'distillery', x: 19512.7, z: -8418.8, ground: true, load: 600, clear: [[19520.8, -8418.6, 8.5, 9]],
      solid: [[19520.8, -8418.6, 8.1, 8.9, 11]] },
    // Bard Hotel, 207 N Cody Rd (OSM 791117512), three storeys: anchor = the Cody Rd front at street level
    { file: 'bard', x: 19512.0, z: -8329.0, ground: true, load: 600, clear: [[19520.4, -8329.4, 10, 13.2]],
      solid: [[19521.1, -8325.6, 9.1, 9.7, 12.8], [19516.0, -8338.6, 5.5, 3.9, 12.8]] },
    // Riverboat Twilight at the levee landing (bow upstream); y = river surface (-0.15) - 0.6, like belle.glb
    { file: 'twilight', x: 19617.0, z: -8345.0, y: -0.75, load: 800, clear: [], solid: [[19617.0, -8344.0, 5.0, 20.2, 12]] },
    // Scott County Freedom Rock on the levee
    { file: 'freedomrock', x: 19555.0, z: -8086.0, ground: true, load: 300, clear: [], solid: [[19555.0, -8086.0, 1.5, 1.0, 1.7]] },
  ],
  notes: 'Research: docs/regions/le-claire.md. Models: assets/src/regions/le-claire/le_claire.py (background Blender). '
    + 'Unverified: exact lots of Wide River Winery, Cody Road Coffee and Faithful Pilot within the 100 N block, Steventon\'s footprint, '
    + 'all model colours. Left to do: Lock & Dam 14 and the I-80 bridge belong to the countryside agent; Princeton is off the map.',
};
