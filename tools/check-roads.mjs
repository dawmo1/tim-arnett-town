// Road audit: compares every drivable OSM highway way in the cache (cache/chunks/roads_*.json) with the built road graph
// (../data/roads) per town, and checks that every built edge is listed by every tile it crosses (a tile only draws the
// edges it lists, so a missing id is a gap in the road).
//   node check-roads.mjs [label]   (saves cache/roads-<label>.json; prints the missing ways by town, class and reason)
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { project } from './map-config.mjs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const DATA = process.env.MAP_OUT || here('../data/');
const label = process.argv[2] || 'now';
const I = JSON.parse(fs.readFileSync(DATA + 'index.json'));
const inRing = (x, z, p) => { let c = false; for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) if ((p[i + 1] > z) !== (p[j + 1] > z) && x < ((p[j] - p[i]) * (z - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]) c = !c; return c; };
const townAt = (x, z) => I.towns.find((t) => (t.rings.length ? t.rings.some((r) => inRing(x, z, r)) : Math.hypot(t.x - x, t.z - z) < t.r))?.name || '(country)';
const X0 = I.tx0 * 200, X1 = (I.tx1 + 1) * 200, Z0 = I.tz0 * 200, Z1 = (I.tz1 + 1) * 200;
// built edges: a 4 m grid of their centre lines
const grid = new Set(), G = 4, gk = (x, z) => `${Math.floor(x / G)},${Math.floor(z / G)}`;
const edges = new Map();
for (const f of fs.readdirSync(DATA + 'roads')) for (const e of JSON.parse(fs.readFileSync(DATA + 'roads/' + f)).e) if (!edges.has(e[0])) edges.set(e[0], { pts: e[10], w: e[9] });
for (const { pts } of edges.values()) for (let i = 2; i < pts.length; i += 2) { const L = Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]); for (let s = 0; s <= L; s += 2) grid.add(gk(pts[i - 2] + (pts[i] - pts[i - 2]) * s / L, pts[i - 1] + (pts[i + 1] - pts[i - 1]) * s / L)); }
// service roads cut off from the network (reached only through parking aisles) are drawn as paved strips: tile lines 'sv'
const strips = new Set();
for (const f of fs.readdirSync(DATA + 'tiles')) { const j = JSON.parse(fs.readFileSync(DATA + 'tiles/' + f)), [tx, tz] = f.slice(0, -5).split('_').map(Number); for (const l of j.l?.sv || []) for (let i = 2; i < l.length; i += 2) { const L = Math.hypot(l[i] - l[i - 2], l[i + 1] - l[i - 1]); for (let s = 0; s <= L; s += 2) strips.add(gk(tx * 200 + l[i - 2] + (l[i] - l[i - 2]) * s / L, tz * 200 + l[i - 1] + (l[i + 1] - l[i - 1]) * s / L)); } }
const near = (set, x, z) => { for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (set.has(`${Math.floor(x / G) + dx},${Math.floor(z / G) + dz}`)) return true; return false; };
const covered = (x, z) => { for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (grid.has(`${Math.floor(x / G) + dx},${Math.floor(z / G) + dz}`)) return true; return false; };
// why build-map leaves a way out of the graph (by design: drawn as a tile line instead, or not for cars)
const DRIVE = /^(motorway|trunk|primary|secondary|tertiary)(_link)?$|^(unclassified|road|residential|living_street|service|track|busway)$/;
function reason(t) {
  if (t.area === 'yes') return 'area';
  if (t.access === 'no' || t.motor_vehicle === 'no') return 'no-access';
  if (t.highway === 'service' && ['parking_aisle', 'driveway', 'drive-through'].includes(t.service)) return 'service:' + t.service + ' (tile line)';
  if (t.highway === 'service' && t.access === 'private') return 'private service (tile line)';
  if (t.highway === 'track' && (t.access === 'private' || t.tracktype === 'grade5')) return 'private track (tile line)';
  return null;
}
const R = { towns: {}, missing: [], tileGaps: 0, tileGapEdges: 0 };
const T = (n) => (R.towns[n] = R.towns[n] || { ways: 0, km: 0, missing: 0, missingKm: 0, byDesign: 0, cls: {} });
const files = fs.readdirSync(here('cache/chunks')).filter((f) => /^roads(_\w+)?\.json$/.test(f));
const seen = new Set();
for (const f of files) for (const e of JSON.parse(fs.readFileSync(here('cache/chunks/' + f))).elements) {
  const t = e.tags || {}; if (seen.has(e.id) || !e.geometry || e.geometry.length < 2 || !DRIVE.test(t.highway || '')) continue; seen.add(e.id);
  const P = e.geometry.map((g) => project(g.lat, g.lon)); let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
  const mid = P[Math.floor(P.length / 2)]; if (mid[0] < X0 || mid[0] > X1 || mid[1] < Z0 || mid[1] > Z1) continue;
  const town = T(townAt(mid[0], mid[1])); town.ways++; town.km += L / 1000;
  const why = reason(t); if (why) { town.byDesign++; continue; }
  let n = 0, c = 0;
  for (let i = 1; i < P.length; i++) { const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); for (let s = 0; s < l; s += 10) { n++; if (covered(P[i - 1][0] + (P[i][0] - P[i - 1][0]) * s / l, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * s / l)) c++; } }
  if (n && c / n < 0.5) {
    let sc = 0; for (let i = 1; i < P.length; i++) { const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); for (let s = 0; s < l; s += 10) if (near(strips, P[i - 1][0] + (P[i][0] - P[i - 1][0]) * s / l, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * s / l)) sc++; }
    if (sc / n >= 0.5) { town.strip = (town.strip || 0) + 1; continue; }
    town.missing++; town.missingKm += L / 1000; town.cls[t.highway] = (town.cls[t.highway] || 0) + 1;
    R.missing.push({ id: e.id, town: townAt(mid[0], mid[1]), hw: t.highway, len: Math.round(L), x: Math.round(mid[0]), z: Math.round(mid[1]), bridge: t.bridge, tunnel: t.tunnel, layer: t.layer, cov: +(c / n).toFixed(2) });
  }
}
// tile lists: every 2 m along each edge (and at its kerbs) the tile there must list the edge
const tileE = new Map();
for (const f of fs.readdirSync(DATA + 'tiles')) tileE.set(f.slice(0, -5), new Set(JSON.parse(fs.readFileSync(DATA + 'tiles/' + f)).e));
const gapEdges = new Set();
for (const [id, { pts, w }] of edges) for (let i = 2; i < pts.length; i += 2) {
  const ax = pts[i - 2], az = pts[i - 1], bx = pts[i], bz = pts[i + 1], L = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / L, nz = (bx - ax) / L;
  for (let s = 0; s <= L; s += 2) for (const o of [0, w / 2, -w / 2]) {
    const x = ax + (bx - ax) * s / L + nx * o, z = az + (bz - az) * s / L + nz * o, k = `${Math.floor(x / 200)}_${Math.floor(z / 200)}`, set = tileE.get(k);
    if (set && !set.has(id)) { R.tileGaps++; gapEdges.add(id); }
  }
}
R.tileGapEdges = gapEdges.size;
for (const t of Object.values(R.towns)) { t.km = Math.round(t.km * 10) / 10; t.missingKm = Math.round(t.missingKm * 10) / 10; }
fs.writeFileSync(here(`cache/roads-${label}.json`), JSON.stringify(R, null, 1));
console.log('town'.padEnd(18), 'OSM ways'.padEnd(9), 'km'.padEnd(8), 'by design', 'strips', 'MISSING (km) by class');
for (const [n, t] of Object.entries(R.towns).sort((a, b) => b[1].ways - a[1].ways)) console.log(n.padEnd(18), String(t.ways).padEnd(9), String(t.km).padEnd(8), String(t.byDesign).padEnd(9), String(t.strip || 0).padEnd(6), `${t.missing} (${t.missingKm})`, JSON.stringify(t.cls));
console.log(`missing ways ${R.missing.length}; tile gaps: ${R.tileGaps} samples on ${R.tileGapEdges} edges not listed by the tile they cross`);
for (const m of R.missing.sort((a, b) => (a.hw === 'service') - (b.hw === 'service') || b.len - a.len).slice(0, 15)) console.log('  ', JSON.stringify(m));
