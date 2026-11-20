// Alternative to the Overpass download (when the public servers are down): reads Geofabrik state extracts
// (cache/pbf/iowa-latest.osm.pbf, cache/pbf/illinois-latest.osm.pbf, © OpenStreetMap contributors, ODbL) and writes
// the same Overpass-style JSON that fetch-map.mjs would (cache/chunks/{query}_pbf.json, places/towns/counties.json),
// so build-map.mjs runs unchanged. Run: cd tools && npm run pbf   (then npm run map; terrain still comes from npm run fetch)
//   1st pass: nodes in the region (+ margin) and the relations; 2nd: ways touching the region (and every member way
//   of a relation); 3rd: the nodes of those ways that lie outside the margin, so ways and multipolygons come out whole.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { BBOX } from './map-config.mjs';
const parseOSM = createRequire(import.meta.url)('osm-pbf-parser');

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const FILES = ['iowa-latest.osm.pbf', 'illinois-latest.osm.pbf'].map((f) => here('cache/pbf/' + f)).filter((f) => fs.existsSync(f));
if (!FILES.length) throw new Error('no extracts in tools/cache/pbf/');
const OUT = here('cache/chunks/');
fs.mkdirSync(OUT, { recursive: true });
const M = 0.12, inReg = (lat, lon) => lat > BBOX.s && lat < BBOX.n && lon > BBOX.w && lon < BBOX.e;
const inMargin = (lat, lon) => lat > BBOX.s - M && lat < BBOX.n + M && lon > BBOX.w - M && lon < BBOX.e + M;
const t0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);
function pass(file, fn) {
  return new Promise((res, rej) => { const s = fs.createReadStream(file).pipe(parseOSM()); s.on('data', (items) => { for (const it of items) fn(it); }); s.on('end', res); s.on('error', rej); });
}
const coords = new Map(); // node id -> [lat, lon]
const tagged = []; // tagged nodes in the region
const rels = new Map(); // id -> {id, tags, members}
const ways = new Map(); // id -> {id, tags, refs}
const relWays = new Set(); // way ids used by relations we may keep
const REL_KEYS = ['building', 'natural', 'landuse', 'leisure', 'amenity', 'waterway', 'water', 'aeroway', 'man_made', 'tourism', 'shop', 'place'];
const relWanted = (t) => (t.type === 'multipolygon' && REL_KEYS.some((k) => t[k])) || (t.boundary === 'administrative' && (t.admin_level === '8' || t.admin_level === '6'));

for (const f of FILES) {
  await pass(f, (it) => {
    if (it.type === 'node') {
      if (inMargin(it.lat, it.lon)) { coords.set(it.id, [it.lat, it.lon]); if (inReg(it.lat, it.lon) && it.tags && Object.keys(it.tags).length) tagged.push(it); }
    } else if (it.type === 'relation' && it.tags && relWanted(it.tags) && !rels.has(it.id)) {
      rels.set(it.id, { id: it.id, tags: it.tags, members: it.members.filter((m) => m.type === 'way').map((m) => ({ ref: m.id, role: m.role })) });
      for (const m of it.members) if (m.type === 'way') relWays.add(m.id);
    }
  });
  log(`${f.split('/').pop()} pass 1: ${coords.size} nodes near the region, ${rels.size} relations`);
}
for (const f of FILES) {
  await pass(f, (it) => {
    if (it.type !== 'way' || ways.has(it.id)) return;
    const near = it.refs.some((r) => coords.has(r));
    if (near || relWays.has(it.id)) ways.set(it.id, { id: it.id, tags: it.tags || {}, refs: it.refs, near });
  });
  log(`${f.split('/').pop()} pass 2: ${ways.size} ways`);
}
// relations that reach the region; then every node still missing from the ways we keep
const keepRel = [...rels.values()].filter((r) => r.members.some((m) => ways.get(m.ref)?.near));
const keepWay = new Set([...ways.values()].filter((w) => w.near).map((w) => w.id));
for (const r of keepRel) for (const m of r.members) if (ways.has(m.ref)) keepWay.add(m.ref);
const missing = new Set();
for (const id of keepWay) for (const n of ways.get(id).refs) if (!coords.has(n)) missing.add(n);
log(`relations kept ${keepRel.length}, ways kept ${keepWay.size}, nodes to fetch ${missing.size}`);
if (missing.size) for (const f of FILES) await pass(f, (it) => { if (it.type === 'node' && missing.has(it.id)) coords.set(it.id, [it.lat, it.lon]); });
const geom = (w) => w.refs.map((n) => coords.get(n)).filter(Boolean).map(([lat, lon]) => ({ lat, lon }));
const wayInReg = (w) => w.refs.some((n) => { const c = coords.get(n); return c && inReg(c[0], c[1]); });
const center = (g) => { let a = 90, b = -90, c = 180, d = -180; for (const p of g) { a = Math.min(a, p.lat); b = Math.max(b, p.lat); c = Math.min(c, p.lon); d = Math.max(d, p.lon); } return { lat: (a + b) / 2, lon: (c + d) / 2 }; };

// the same selections as fetch-map.mjs's Overpass queries
const re = (s) => new RegExp(s);
const has = (t, k, r) => t[k] !== undefined && (!r || re(r).test(t[k]));
const SEL = {
  roads: { way: (t) => has(t, 'highway') || has(t, 'railway', '^(rail|tram|light_rail|abandoned|disused|siding|spur|yard)$') },
  buildings: { way: (t) => has(t, 'building') || has(t, 'building:part'), rel: (t) => has(t, 'building') },
  areas: {
    way: (t) => ['landuse', 'leisure', 'natural', 'water', 'aeroway', 'golf'].some((k) => has(t, k)) || has(t, 'amenity', '^(parking|grave_yard|school|college|university|hospital|marketplace)$') || has(t, 'waterway', '^(riverbank|dock)$') || has(t, 'man_made', '^(pier|breakwater|bridge)$') || t.place === 'island',
    rel: (t) => ['natural', 'landuse', 'leisure', 'water', 'aeroway'].some((k) => has(t, k)) || has(t, 'amenity', '^(parking|grave_yard|school|college|university|hospital)$') || t.waterway === 'riverbank' || has(t, 'man_made', '^(pier|bridge)$'),
  },
  lines: { way: (t) => has(t, 'barrier') || has(t, 'power', '^(line|minor_line|cable)$') || has(t, 'waterway', '^(river|stream|canal|ditch|drain|dam|weir|lock_gate)$') || has(t, 'man_made', '^(embankment|dyke|pipeline)$') || t.route === 'ferry' },
};
const POINT_NODE = (t) => has(t, 'natural', '^(tree|peak|spring|cliff)$') || has(t, 'highway', '^(street_lamp|traffic_signals|stop|give_way|crossing|bus_stop|turning_circle|motorway_junction|speed_camera|milestone)$')
  || ['amenity', 'emergency', 'man_made', 'advertising', 'barrier', 'leisure', 'tourism', 'shop', 'office', 'craft', 'historic', 'sport', 'traffic_sign', 'waterway', 'public_transport', 'aeroway'].some((k) => has(t, k))
  || has(t, 'power', '^(pole|tower|transformer|substation)$') || has(t, 'railway', '^(level_crossing|crossing|station|halt|signal|switch|buffer_stop|stop)$') || t.lock === 'yes';
const POINT_WAY = (t) => ['amenity', 'shop', 'tourism', 'historic', 'office', 'craft'].some((k) => has(t, k)) || has(t, 'leisure', '^(stadium|park|pitch|golf_course|marina|slipway|sports_centre|nature_reserve)$') || has(t, 'man_made', '^(pier|water_tower|silo|tower|chimney|lighthouse|storage_tank|works)$');
const POINT_REL = (t) => ['amenity', 'shop', 'tourism'].some((k) => has(t, k)) || has(t, 'leisure', '^(stadium|park|golf_course|nature_reserve)$');

function write(name, els) {
  const fd = fs.openSync(OUT + name, 'w');
  fs.writeSync(fd, '{"generator":"pbf-extract","elements":[\n');
  els.forEach((e, i) => fs.writeSync(fd, (i ? ',\n' : '') + JSON.stringify(e)));
  fs.writeSync(fd, '\n]}\n'); fs.closeSync(fd);
  log(`wrote ${name}: ${els.length} elements, ${(fs.statSync(OUT + name).size / 1e6).toFixed(1)} MB`);
}
const relEl = (r) => ({ type: 'relation', id: r.id, tags: r.tags, members: r.members.filter((m) => ways.has(m.ref)).map((m) => ({ type: 'way', ref: m.ref, role: m.role, geometry: geom(ways.get(m.ref)) })) });
const regWays = [...keepWay].map((id) => ways.get(id)).filter((w) => w.near && wayInReg(w));
const regRels = keepRel.filter((r) => r.members.some((m) => ways.has(m.ref) && wayInReg(ways.get(m.ref))));
for (const [name, s] of Object.entries(SEL)) {
  const out = regWays.filter((w) => s.way(w.tags)).map((w) => ({ type: 'way', id: w.id, tags: w.tags, geometry: geom(w) }));
  if (s.rel) for (const r of regRels) if (r.tags.type === 'multipolygon' && s.rel(r.tags)) out.push(relEl(r));
  write(`${name}_pbf.json`, out);
}
write('points_pbf.json', [
  ...tagged.filter((n) => POINT_NODE(n.tags)).map((n) => ({ type: 'node', id: n.id, lat: n.lat, lon: n.lon, tags: n.tags })),
  ...regWays.filter((w) => POINT_WAY(w.tags)).map((w) => ({ type: 'way', id: w.id, tags: w.tags, center: center(geom(w)) })),
  ...regRels.filter((r) => POINT_REL(r.tags)).map((r) => ({ type: 'relation', id: r.id, tags: r.tags, center: center(r.members.flatMap((m) => (ways.has(m.ref) ? geom(ways.get(m.ref)) : []))) })),
]);
write('places.json', tagged.filter((n) => n.tags.place).map((n) => ({ type: 'node', id: n.id, lat: n.lat, lon: n.lon, tags: n.tags })));
write('towns.json', regRels.filter((r) => r.tags.boundary === 'administrative' && r.tags.admin_level === '8').map(relEl));
write('counties.json', regRels.filter((r) => r.tags.boundary === 'administrative' && r.tags.admin_level === '6').map(relEl));
log('done');
