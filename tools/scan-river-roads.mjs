// River-road audit: walks every road edge in ../data/roads every 4 m and reports where the drawn surface would be under
// (or within a few cm of) the river plane (src/city/data.js WATER_Y), using the tile ground heights the game uses.
// A non-bridge road there is invisible (drowned); a bridge deck that low means its ends or its rise are wrong.
// With --write it lifts them the way a fresh build does (build-map.mjs, "roads over water"): the 8 m ground samples
// under and beside a drowned through road (not service roads or tracks: boat ramps go into the water on purpose) come
// up to LIFT metres over the river, and the end nodes of a bridge sitting under the water come up with them.
//   node --max-old-space-size=1024 scan-river-roads.mjs [--write] [--list out.json]
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const DATA = process.env.MAP_OUT || here('../data/');
const WATER_Y = -0.15, NEAR = 0.1; // the road surface sits 6 cm over the ground; under WATER_Y + NEAR it drowns or flickers
const WRITE = process.argv.includes('--write'), LIFT = 0.3, PAD = 3; // build-map.mjs uses the same numbers
const listAt = process.argv.indexOf('--list'), LIST = listAt > 0 ? process.argv[listAt + 1] : null;
const I = JSON.parse(fs.readFileSync(DATA + 'index.json'));
const CLASSES = I.roads.classes;
const tileSet = new Set(fs.readdirSync(DATA + 'tiles').map((f) => f.slice(0, -5)));
const cache = new Map();
function tileH(k) {
  if (cache.has(k)) return cache.get(k);
  let H = null;
  if (tileSet.has(k)) {
    const j = JSON.parse(fs.readFileSync(DATA + 'tiles/' + k + '.json'));
    H = new Float32Array(676);
    if (typeof j.h === 'number') H.fill(j.h / 100);
    else if (!j.hd) { const u = Buffer.from(j.h, 'base64'); for (let i = 0; i < 676; i++) H[i] = u.readInt16LE(i * 2) / 100; }
    else { const u = Buffer.from(j.hd, 'base64'), i16 = (p) => ((u[p] | (u[p + 1] << 8)) << 16) >> 16; let q = i16(0), p = 2; H[0] = q / 50; for (let i = 1; i < 676; i++) { const d = u[p++]; if (d === 128) { q = i16(p); p += 2; } else q += (d << 24) >> 24; H[i] = q / 50; } }
  }
  if (cache.size > 4000) cache.clear();
  cache.set(k, H); return H;
}
function ground(x, z) {
  const tx = Math.floor(x / 200), tz = Math.floor(z / 200), H = tileH(`${tx}_${tz}`); if (!H) return null;
  const fx = (x - tx * 200) / 8, fz = (z - tz * 200) / 8, i = Math.min(24, Math.floor(fx)), j = Math.min(24, Math.floor(fz)), ax = fx - i, az = fz - j;
  return (H[j * 26 + i] * (1 - ax) + H[j * 26 + i + 1] * ax) * (1 - az) + (H[j * 26 + 26 + i] * (1 - ax) + H[j * 26 + 27 + i] * ax) * az;
}
const nodeY = new Map(), raw = new Map();
for (const f of fs.readdirSync(DATA + 'roads')) {
  const r = JSON.parse(fs.readFileSync(DATA + 'roads/' + f));
  for (let i = 0; i < r.n.length; i += 6) nodeY.set(r.n[i], r.n[i + 3]);
  for (const e of r.e) if (!raw.has(e[0])) raw.set(e[0], e);
}
const R = { edges: 0, wetEdges: 0, wetM: 0, bridgeLow: 0, byCls: {}, list: [] };
for (const [id, a, b, cls, , , , name, bridge, width, flat, flags = 0, , , , rise = 0] of raw.values()) {
  if (flags & 1) continue; R.edges++;
  const ya = nodeY.get(a), yb = nodeY.get(b);
  let len = 0; for (let i = 2; i < flat.length; i += 2) len += Math.hypot(flat[i] - flat[i - 2], flat[i + 1] - flat[i - 1]);
  let acc = 0, wet = 0, low = 0, first = null, minY = Infinity;
  for (let i = 2; i < flat.length; i += 2) {
    const ax = flat[i - 2], az = flat[i - 1], bx = flat[i], bz = flat[i + 1], L = Math.hypot(bx - ax, bz - az);
    for (let s = 0; s < L; s += 4) {
      const x = ax + (bx - ax) * s / L, z = az + (bz - az) * s / L, g = ground(x, z); if (g === null) continue;
      let y = g;
      if (bridge) { const k = (acc + s) / (len || 1); y = Math.max(g, ya + (yb - ya) * k * k * (3 - 2 * k) + rise * 4 * k * (1 - k)); }
      if (y + 0.06 < WATER_Y + NEAR) { (bridge ? low++ : wet++); if (!first) first = [Math.round(x), Math.round(z)]; minY = Math.min(minY, y); }
    }
    acc += L;
  }
  if (wet || low) {
    const c = CLASSES[cls];
    if (wet) { R.wetEdges++; R.wetM += wet * 4; R.byCls[c] = (R.byCls[c] || 0) + wet * 4; }
    if (low) R.bridgeLow++;
    R.list.push({ id, cls: c, name, bridge: !!bridge, wetM: (wet + low) * 4, len: Math.round(len), at: first, minY: Math.round(minY * 100) / 100, width });
  }
}
// ---------- --write: lift the drowned through roads ----------
const lift = new Map(); // world grid node (gx * 1e6 + gz, 8 m) -> height it needs (m)
const liftNodes = new Map(); // road node id -> height
for (const l of R.list) {
  if (l.cls === 'service' || l.cls === 'track') continue;
  const e = raw.get(l.id), [, a, b, , , , , , bridge, width, flat] = e, r = width / 2 + PAD;
  if (bridge) { for (const k of [a, b]) if (nodeY.get(k) < LIFT) liftNodes.set(k, LIFT); }
  for (let i = 2; i < flat.length; i += 2) {
    const ax = flat[i - 2], az = flat[i - 1], bx = flat[i], bz = flat[i + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    if (bridge) continue; // a bridge's span keeps the water under it; its ends come up through liftNodes
    for (let gx = Math.floor((Math.min(ax, bx) - r) / 8); gx <= Math.ceil((Math.max(ax, bx) + r) / 8); gx++) for (let gz = Math.floor((Math.min(az, bz) - r) / 8); gz <= Math.ceil((Math.max(az, bz) + r) / 8); gz++) {
      const x = gx * 8, z = gz * 8, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      if (Math.hypot(ax + dx * t - x, az + dz * t - z) <= r) lift.set(gx * 1e6 + gz, LIFT);
    }
  }
}
let pts = 0, tilesW = 0, nodesW = 0;
if (WRITE) {
  const byTile = new Map();
  for (const [k, y] of lift) {
    const gx = Math.round(k / 1e6), gz = k - gx * 1e6;
    for (let tx = Math.ceil((gx - 25) / 25); tx <= Math.floor(gx / 25); tx++) for (let tz = Math.ceil((gz - 25) / 25); tz <= Math.floor(gz / 25); tz++) { // a node on a tile edge is in both tiles
      const key = `${tx}_${tz}`; if (!tileSet.has(key)) continue;
      let a = byTile.get(key); if (!a) byTile.set(key, (a = [])); a.push([gx - tx * 25, gz - tz * 25, y]);
    }
  }
  for (const [key, list] of byTile) {
    const txt = fs.readFileSync(DATA + 'tiles/' + key + '.json', 'utf8'), j = JSON.parse(txt), H = tileH(key), Q = Array.from(H, (v) => Math.round(v * 50)); // 2 cm units
    let n = 0; for (const [i, jj, y] of list) { const k = jj * 26 + i; if (Q[k] < y * 50) { Q[k] = Math.round(y * 50); n++; } }
    if (!n) continue;
    const bytes = [], i16 = (v) => bytes.push(v & 255, (v >> 8) & 255); i16(Q[0]);
    for (let k = 1; k < 676; k++) { const d = Q[k] - Q[k - 1]; if (d > -128 && d < 128) bytes.push(d & 255); else { bytes.push(128); i16(Q[k]); } }
    const o = {}; delete j.h; o.hd = Buffer.from(bytes).toString('base64'); for (const [kk, v] of Object.entries(j)) if (kk !== 'hd') o[kk] = v;
    fs.writeFileSync(DATA + 'tiles/' + key + '.json', JSON.stringify(o)); pts += n; tilesW++; cache.delete(key);
  }
  if (liftNodes.size) for (const f of fs.readdirSync(DATA + 'roads')) {
    const r = JSON.parse(fs.readFileSync(DATA + 'roads/' + f)); let n = 0;
    for (let i = 0; i < r.n.length; i += 6) if (liftNodes.has(r.n[i]) && r.n[i + 3] < LIFT) { r.n[i + 3] = LIFT; n++; }
    if (n) { fs.writeFileSync(DATA + 'roads/' + f, JSON.stringify(r)); nodesW += n; }
  }
  console.log(`lifted ${pts} ground samples in ${tilesW} tiles and ${nodesW} bridge end nodes (in road chunks) to ${LIFT} m over the river`);
}
console.log(`edges ${R.edges}; roads at or under the river surface: ${R.wetEdges} edges, ${R.wetM} m (by class ${JSON.stringify(R.byCls)}); bridge decks that low: ${R.bridgeLow}`);
for (const l of R.list.sort((p, q) => q.wetM - p.wetM).slice(0, 25)) console.log('  ', JSON.stringify(l));
if (LIST) fs.writeFileSync(LIST, JSON.stringify(R.list));
