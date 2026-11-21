// Region registry: one override module per town (src/regions/<id>.js, see README.md and _template.js), loaded lazily
// the first time the player or a tile being built comes near its bounds. A region can rename buildings (names), add
// street features and props (places, drawn by src/city/detail.js regionPlaces with the same off-road checks as every
// other prop) and Blender models (models, streamed by src/landmarks.js like the other landmarks).
// Each entry: [id, x0, z0, x1, z1] in game metres (x east, z south; src/city/data.js). Town agents only edit their own
// module; these bounds decide when it loads (ask for a change here if a town needs a bigger area).
export const REGIONS = [
  ['example', -400, 300, 200, 700], // a tiny demo (LeClaire Park): one renamed building, a statue, a sign, a model
  ['davenport-downtown', -1500, -900, 2200, 900],
  ['davenport', -9200, -11100, 7250, 1200],
  ['bettendorf', 3750, -9800, 12700, 250], // incl. Riverdale and Panorama Park
  ['le-claire', 14300, -10000, 19850, -6300],
  ['port-byron', 13100, -12600, 26200, -2200], // incl. Rapids City and Hampton
  ['rock-island', -11750, 100, 5100, 12000], // incl. the Arsenal and Andalusia
  ['milan', -2350, 6600, 4600, 12650],
  ['moline', 3200, 600, 12150, 11350],
  ['east-moline', 9550, -2950, 25150, 4950],
  ['silvis', 12600, 200, 17150, 6200], // incl. Carbon Cliff
  ['colona', 15400, 3600, 21500, 9150],
  ['coal-valley', -800, 7050, 14750, 12900], // incl. Niabi Zoo and Oak Grove
  ['geneseo', 33350, 4650, 37750, 10850],
  ['countryside', -12000, -11400, 38200, 13800], // the whole map: highways, rivers, Black Hawk site, locks and dams
];
const loading = new Map(); // id -> Promise<region | null>
export const loaded = []; // regions in, in load order
const listeners = [];
// fn(region) for every region as it loads (and at once for the ones already in)
export function onRegion(fn) { listeners.push(fn); for (const r of loaded) fn(r); }
const overlaps = (b, x0, z0, x1, z1) => b[0] < x1 && b[2] > x0 && b[1] < z1 && b[3] > z0;
// a module's export, checked and indexed (bad entries are skipped with a warning, so one typo can't break the map)
function prepare(id, m, box) {
  const r = { id, name: m.name || id, bounds: Array.isArray(m.bounds) && m.bounds.length === 4 ? m.bounds : box, names: [], byId: new Map(), places: [], models: [], notes: m.notes || '' };
  for (const n of m.names || []) {
    if (!n || typeof n.name !== 'string') { console.warn(`region ${id}: name entry without a name`, n); continue; }
    if (typeof n.match === 'number' || typeof n.match === 'string') r.byId.set(String(n.match), n.name);
    else if (n.match && isFinite(n.match.x) && isFinite(n.match.z)) r.names.push({ x: n.match.x, z: n.match.z, r: n.match.r ?? 15, name: n.name });
    else console.warn(`region ${id}: name match must be an OSM id or {x, z, r}`, n);
  }
  for (const p of m.places || []) { if (p && typeof p.kind === 'string' && ((isFinite(p.x) && isFinite(p.z)) || Array.isArray(p.pts))) r.places.push(p); else console.warn(`region ${id}: place needs a kind and x/z (or pts)`, p); }
  for (const L of m.models || []) { if (L && typeof L.file === 'string' && isFinite(L.x) && isFinite(L.z)) r.models.push({ ...L, path: `regions/${id}/${L.file}.glb`, clear: L.clear || [], solid: L.solid || [] }); else console.warn(`region ${id}: model needs file, x, z`, L); }
  return r;
}
function load(entry) {
  const [id, ...box] = entry;
  if (!loading.has(id)) loading.set(id, import(`./${id}.js`).then((mod) => {
    const r = prepare(id, mod.default || {}, box);
    loaded.push(r);
    for (const fn of listeners) { try { fn(r); } catch (e) { console.warn('region', id, e); } }
    return r;
  }, (e) => { console.warn(`region ${id} failed to load`, e); return null; }));
  return loading.get(id);
}
// Load every region overlapping the square round (x, z); resolves when they're in (tiles wait for this before building).
export function loadRegionsNear(x, z, pad = 300) {
  const out = [];
  for (const e of REGIONS) if (overlaps(e.slice(1), x - pad, z - pad, x + pad, z + pad)) out.push(load(e));
  return Promise.all(out);
}
// The loaded regions whose bounds overlap a box.
export const regionsIn = (x0, z0, x1, z1) => loaded.filter((r) => overlaps(r.bounds, x0, z0, x1, z1));
// The region name for a building: by its OSM id (tile record extra.id), else the nearest position match within its r.
export function nameFor(id, x, z) {
  let best = null, bd = Infinity;
  for (const r of loaded) {
    if (id != null && r.byId.has(String(id))) return r.byId.get(String(id));
    for (const n of r.names) { const d = Math.hypot(n.x - x, n.z - z); if (d < n.r && d < bd) { bd = d; best = n.name; } }
  }
  return best;
}
