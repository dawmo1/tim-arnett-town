// A tiny demo region (LeClaire Park, downtown Davenport) that proves the registry end to end: a renamed building by
// OSM id and one by position, a statue and a park sign through the prop checks, and a model through the landmark
// loader. Safe to delete (remove its line in index.js too) once the town modules exist.
export default {
  id: 'example',
  name: 'LeClaire Park',
  bounds: [-400, 300, 200, 700],
  names: [
    { match: 556296616, name: "Arnett's Hardware" },
    { match: { x: -293, z: 217, r: 12 }, name: 'Bix Records' },
  ],
  places: [
    { kind: 'statue', x: -140, z: 548, h: Math.PI },
    { kind: 'sign', x: -232, z: 476, text: 'LECLAIRE PARK', style: 'shop', w: 2.6 },
  ],
  models: [
    { file: 'obelisk', x: -112, z: 560, ground: true, load: 500, clear: [], solid: [[-112, 560, 1.5, 1.5, 6]] },
  ],
  notes: 'Demo only.',
};
