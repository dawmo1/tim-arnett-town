// <Town name>: real names, street features and signature models for this part of the map. Copy to <id>.js
// (the id in src/regions/index.js REGIONS). Pure data: no imports, nothing runs at load. See README.md for every field.
// Coordinates are game metres: x east, z south, origin 3rd & Main in downtown Davenport (tools/map-config.mjs project()).
export default {
  id: 'town-id',
  name: 'Town Name',
  bounds: [0, 0, 0, 0], // [x0, z0, x1, z1]: the same box as this id's entry in index.js
  // Business / building names. match: the OSM way id of the building (tile record extra.id; 'r123' for a relation)
  // or {x, z, r}: the building whose centre is nearest (x, z) within r metres. National chains get a parody name
  // automatically (src/city/names.js), so give the real name and let it convert.
  names: [
    // { match: 123456789, name: 'Real Business Name' },
    // { match: { x: 0, z: 0, r: 12 }, name: 'Another Business' },
  ],
  // Street features and props. Point places are moved off the road / dropped inside buildings like every other prop.
  places: [
    // { kind: 'sign', x: 0, z: 0, h: 0, text: 'WELCOME', style: 'shop', w: 2.4, height: 2.6, lit: false },
    // { kind: 'statue', x: 0, z: 0, h: 0, scale: 1 },
    // { kind: 'watertower', x: 0, z: 0, height: 38, text: 'TOWN', color: 0xe9eef0 },
    // { kind: 'mural', x: 0, z: 0, h: 0, w: 8, hgt: 1.7, y: 1.5, text: 'PAINTED AD' },
    // { kind: 'prop', prop: 'bench', x: 0, z: 0, h: 0 },
    // { kind: 'tree', x: 0, z: 0, tree: 0, scale: 1 },
    // { kind: 'light', x: 0, z: 0, h: 0 },
    // { kind: 'roundabout', x: 0, z: 0, r: 6 },
    // { kind: 'median', pts: [0, 0, 10, 0], w: 1.6 },
    // { kind: 'parking', pts: [0, 0, 20, 0, 20, 20, 0, 20] },
  ],
  // Blender models: landmarks.js MODELS entries; file = assets/models/regions/<id>/<file>.glb
  models: [
    // { file: 'courthouse', x: 0, z: 0, ground: true, h: 0, load: 700, clear: [[0, 0, 12, 10]], solid: [[0, 0, 12, 10, 14]] },
  ],
  notes: '',
};
