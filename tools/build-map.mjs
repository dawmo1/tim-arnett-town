// Turns the cached OpenStreetMap + elevation data into the game's streamed city data.
// Run: cd tools && npm run fetch && npm run map
// Outputs (committed): ../data/index.json, ../data/roads.json, ../data/overview.json, ../data/tiles/{tx}_{tz}.json
// Debug output (not committed): cache/preview.png
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import earcut from 'earcut';
import { BBOX, ORIGIN, TILE, project } from './map-config.mjs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const OUT = here('../data/');
fs.mkdirSync(OUT + 'tiles', { recursive: true });
const read = (n) => JSON.parse(fs.readFileSync(here(`cache/${n}.json`))).elements;
let seed = 12345;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const RIVER_LEVEL = 171.2; // metres above sea level; game y = elevation - RIVER_LEVEL

// ---------- extent & raster ----------
const [X0] = project(ORIGIN.lat, BBOX.w), [X1] = project(ORIGIN.lat, BBOX.e);
const [, Z0] = project(BBOX.n, ORIGIN.lon), [, Z1] = project(BBOX.s, ORIGIN.lon);
const TX0 = Math.floor(X0 / TILE), TX1 = Math.ceil(X1 / TILE) - 1, TZ0 = Math.floor(Z0 / TILE), TZ1 = Math.ceil(Z1 / TILE) - 1;
const GX0 = TX0 * TILE, GZ0 = TZ0 * TILE, CELL = 4;
const GW = ((TX1 - TX0 + 1) * TILE) / CELL, GH = ((TZ1 - TZ0 + 1) * TILE) / CELL;
console.log(`extent ${(X1 - X0) / 1000 | 0}x${(Z1 - Z0) / 1000 | 0} km, tiles ${TX1 - TX0 + 1}x${TZ1 - TZ0 + 1}, raster ${GW}x${GH}`);
const cellOf = (x, z) => [Math.floor((x - GX0) / CELL), Math.floor((z - GZ0) / CELL)];
const inGrid = (i, j) => i >= 0 && j >= 0 && i < GW && j < GH;

// ---------- elevation ----------
const Z = 14, tiles = new Map();
for (const f of fs.readdirSync(here('cache/terrain'))) { const [, x, y] = f.replace('.png', '').split('_').map(Number); tiles.set(`${x}_${y}`, PNG.sync.read(fs.readFileSync(here('cache/terrain/' + f)))); }
function elevAt(lat, lon) {
  const n = 2 ** Z, r = (lat * Math.PI) / 180;
  const px = ((lon + 180) / 360) * n * 256, py = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n * 256;
  const sample = (X, Y) => {
    const t = tiles.get(`${Math.floor(X / 256)}_${Math.floor(Y / 256)}`); if (!t) return RIVER_LEVEL;
    const i = ((Math.floor(Y) % 256) * 256 + (Math.floor(X) % 256)) * 4;
    return t.data[i] * 256 + t.data[i + 1] + t.data[i + 2] / 256 - 32768;
  };
  const fx = px - 0.5, fy = py - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0;
  return (sample(x0, y0) * (1 - ax) + sample(x0 + 1, y0) * ax) * (1 - ay) + (sample(x0, y0 + 1) * (1 - ax) + sample(x0 + 1, y0 + 1) * ax) * ay;
}
const M_LAT = 110574, M_LON = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
const toLatLon = (x, z) => [ORIGIN.lat - z / M_LAT, ORIGIN.lon + x / M_LON];
let height = new Float32Array(GW * GH);
for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const [la, lo] = toLatLon(GX0 + (i + 0.5) * CELL, GZ0 + (j + 0.5) * CELL); height[j * GW + i] = elevAt(la, lo) - RIVER_LEVEL; }
// water = below the river surface (plus a little), then smooth the land so the DEM noise disappears
const cls = new Uint8Array(GW * GH); // see CLASS below
const C = { lawn: 0, water: 1, park: 2, wood: 3, parking: 4, paved: 5, industrial: 6, cemetery: 7, sand: 8, road: 9, walk: 10, building: 11, pitch: 12, farm: 13 };
for (let k = 0; k < GW * GH; k++) if (height[k] < 0.7) cls[k] = C.water;
function blur(src, passes) {
  let a = src;
  for (let p = 0; p < passes; p++) {
    const b = new Float32Array(a.length);
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      let s = 0, n = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (inGrid(ii, jj)) { s += a[jj * GW + ii]; n++; } }
      b[j * GW + i] = s / n;
    }
    a = b;
  }
  return a;
}
height = blur(height, 2);
for (let k = 0; k < GW * GH; k++) if (cls[k] === C.water) height[k] = -3; else height[k] = Math.max(1.0, height[k]);
const heightAt = (x, z) => {
  const fx = (x - GX0) / CELL - 0.5, fz = (z - GZ0) / CELL - 0.5, i = Math.max(0, Math.min(GW - 2, Math.floor(fx))), j = Math.max(0, Math.min(GH - 2, Math.floor(fz)));
  const ax = Math.min(1, Math.max(0, fx - i)), az = Math.min(1, Math.max(0, fz - j));
  const h = (ii, jj) => height[jj * GW + ii];
  return (h(i, j) * (1 - ax) + h(i + 1, j) * ax) * (1 - az) + (h(i, j + 1) * (1 - ax) + h(i + 1, j + 1) * ax) * az;
};
const clsAt = (x, z) => { const [i, j] = cellOf(x, z); return inGrid(i, j) ? cls[j * GW + i] : C.water; };

// Davenport "mainland" = land connected to downtown without crossing water (drops Arsenal Island + Illinois)
const main = new Uint8Array(GW * GH);
{
  const [si, sj] = cellOf(0, -200), stack = [sj * GW + si]; main[stack[0]] = 1;
  while (stack.length) {
    const k = stack.pop(), i = k % GW, j = (k / GW) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (!inGrid(ii, jj)) continue; const kk = jj * GW + ii; if (!main[kk] && cls[kk] !== C.water) { main[kk] = 1; stack.push(kk); } }
  }
}
const onMain = (x, z) => { const [i, j] = cellOf(x, z); return inGrid(i, j) && main[j * GW + i] === 1; };

// ---------- districts (the map's own neighbourhood feel) ----------
export function district(x, z) {
  if (x > 1500 && x < 3000 && z > -1000 && z < 300) return 'village';
  if (x > -1200 && x < 900 && z > -520 && z < 300) return 'downtown';
  if (z > -150 && Math.abs(x) < 4000) return 'riverfront';
  if (z < -3200) return 'north';
  if (x < -1200) return 'west';
  return 'hilltop';
}

// ---------- polygons ----------
const P = (g) => g.map((p) => project(p.lat, p.lon));
function fillPoly(pts, code, onlyIf) {
  let minj = Infinity, maxj = -Infinity;
  const cp = pts.map(([x, z]) => [(x - GX0) / CELL, (z - GZ0) / CELL]);
  for (const [, v] of cp) { minj = Math.min(minj, v); maxj = Math.max(maxj, v); }
  for (let j = Math.max(0, Math.floor(minj)); j <= Math.min(GH - 1, Math.ceil(maxj)); j++) {
    const y = j + 0.5, xs = [];
    for (let k = 0, l = cp.length - 1; k < cp.length; l = k++) {
      const [ax, ay] = cp[l], [bx, by] = cp[k];
      if ((ay > y) !== (by > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let q = 0; q + 1 < xs.length; q += 2) for (let i = Math.max(0, Math.ceil(xs[q] - 0.5)); i <= Math.min(GW - 1, Math.floor(xs[q + 1] - 0.5)); i++) {
      const k = j * GW + i; if (!onlyIf || onlyIf(cls[k])) cls[k] = code;
    }
  }
}
const pointInPoly = (x, z, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };
function areaClass(t) {
  if (t.natural === 'water' || t.waterway === 'riverbank') return C.water;
  if (t.natural === 'wood' || t.landuse === 'forest') return C.wood;
  if (t.leisure === 'park' || t.leisure === 'garden' || t.leisure === 'golf_course' || t.landuse === 'recreation_ground' || t.leisure === 'playground' || t.landuse === 'village_green') return C.park;
  if (t.leisure === 'pitch' || t.leisure === 'track' || t.leisure === 'stadium') return C.pitch;
  if (t.amenity === 'parking') return C.parking;
  if (t.landuse === 'cemetery') return C.cemetery;
  if (t.landuse === 'commercial' || t.landuse === 'retail') return C.paved;
  if (t.landuse === 'industrial' || t.landuse === 'railway') return C.industrial;
  if (t.landuse === 'farmland' || t.landuse === 'meadow' || t.landuse === 'grass' || t.natural === 'grassland' || t.natural === 'scrub') return t.natural === 'scrub' ? C.wood : C.lawn;
  if (t.natural === 'sand' || t.natural === 'beach' || t.natural === 'bare_rock') return C.sand;
  return null;
}
const areaPolys = []; // {pts, code, tags}
for (const e of read('areas')) if (e.type === 'way' && e.geometry && e.geometry.length > 3) { const code = areaClass(e.tags || {}); if (code !== null) areaPolys.push({ pts: P(e.geometry), code, tags: e.tags }); }
for (const e of read('relations')) {
  const code = areaClass(e.tags || {}); if (code === null || code === C.water) continue; // river comes from elevation
  for (const ring of assembleRings(e.members.filter((m) => m.role !== 'inner'))) areaPolys.push({ pts: ring, code, tags: e.tags });
}
function assembleRings(members) {
  const segs = members.filter((m) => m.geometry && m.geometry.length > 1 && m.geometry.every(Boolean)).map((m) => P(m.geometry));
  const rings = [];
  while (segs.length) {
    let ring = segs.shift();
    let guard = 0;
    while (guard++ < 500) {
      const a = ring[0], b = ring[ring.length - 1];
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.5 && ring.length > 3) break;
      const k = segs.findIndex((s) => { const s0 = s[0], s1 = s[s.length - 1]; return Math.hypot(s0[0] - b[0], s0[1] - b[1]) < 0.5 || Math.hypot(s1[0] - b[0], s1[1] - b[1]) < 0.5; });
      if (k < 0) break;
      let s = segs.splice(k, 1)[0];
      if (Math.hypot(s[0][0] - b[0], s[0][1] - b[1]) > 0.5) s = s.slice().reverse();
      ring = ring.concat(s.slice(1));
    }
    if (ring.length > 3) rings.push(ring);
  }
  return rings;
}
// paint order: big landuse first, then parks, woods, parking, pitches, small water on top
const order = [C.industrial, C.paved, C.cemetery, C.lawn, C.sand, C.park, C.wood, C.pitch, C.parking, C.water];
areaPolys.sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));
for (const a of areaPolys) fillPoly(a.pts, a.code, (c) => c !== C.water || a.code === C.water);
for (const a of areaPolys) if (a.code === C.water) for (const p of a.pts) { /* lower ponds */ }

// ---------- roads ----------
const DRIVE = { motorway: 'motor', motorway_link: 'motor', trunk: 'trunk', trunk_link: 'trunk', primary: 'primary', primary_link: 'primary', secondary: 'secondary', secondary_link: 'secondary', tertiary: 'tertiary', tertiary_link: 'tertiary', unclassified: 'minor', residential: 'residential', living_street: 'residential', service: 'service' };
const WIDTH = { motor: 15, trunk: 14, primary: 13, secondary: 11, tertiary: 9.5, minor: 7.5, residential: 8, service: 4.6 };
const SPEED = { motor: 26, trunk: 18, primary: 15.6, secondary: 13.4, tertiary: 12, minor: 11, residential: 11, service: 6 };
const roadWays = [];
for (const e of read('roads')) {
  const t = e.tags || {}, cl = DRIVE[t.highway];
  if (!cl || !e.geometry || e.geometry.length < 2) continue;
  if (t.access === 'private' || t.area === 'yes') continue;
  if (cl === 'service' && (t.service === 'parking_aisle' || t.service === 'driveway' || t.service === 'drive-through')) continue;
  // node ids aren't in the download, but shared nodes have identical coordinates
  roadWays.push({ id: e.id, nodes: e.geometry.map((g) => `${g.lat.toFixed(7)},${g.lon.toFixed(7)}`), pts: P(e.geometry), cl, t });
}
// split ways into edges at shared nodes
const use = new Map();
for (const w of roadWays) w.nodes.forEach((n, i) => use.set(n, (use.get(n) || 0) + (i === 0 || i === w.nodes.length - 1 ? 2 : 1)));
const nodeIdx = new Map(), nodes = []; // nodes: {x,z,y,ctrl,osm}
const getNode = (osm, x, z) => { if (!nodeIdx.has(osm)) { nodeIdx.set(osm, nodes.length); nodes.push({ x, z, osm, ctrl: 0, deg: 0 }); } return nodeIdx.get(osm); };
const names = [], nameIdx = new Map();
const nameOf = (n) => { if (!n) return -1; if (!nameIdx.has(n)) { nameIdx.set(n, names.length); names.push(n); } return nameIdx.get(n); };
let edges = [];
for (const w of roadWays) {
  let start = 0;
  for (let i = 1; i < w.nodes.length; i++) {
    if (i === w.nodes.length - 1 || use.get(w.nodes[i]) > 1) {
      const pts = w.pts.slice(start, i + 1);
      const a = getNode(w.nodes[start], ...w.pts[start]), b = getNode(w.nodes[i], ...w.pts[i]);
      const t = w.t;
      let oneway = t.oneway === 'yes' || t.oneway === '1' || t.highway === 'motorway' || t.junction === 'roundabout' ? 1 : t.oneway === '-1' ? -1 : 0;
      let A = a, B = b, PTS = pts;
      if (oneway === -1) { A = b; B = a; PTS = pts.slice().reverse(); oneway = 1; }
      const lanesTotal = +t.lanes || (oneway ? (w.cl === 'primary' || w.cl === 'trunk' ? 2 : 1) : w.cl === 'primary' || w.cl === 'trunk' ? 4 : 2);
      const lf = oneway ? lanesTotal : Math.max(1, +t['lanes:forward'] || Math.ceil(lanesTotal / 2));
      const lb = oneway ? 0 : Math.max(1, +t['lanes:backward'] || Math.floor(lanesTotal / 2) || 1);
      const ms = t.maxspeed ? parseFloat(t.maxspeed) * (t.maxspeed.includes('mph') || !t.maxspeed.match(/km/) ? 0.447 : 0.2778) : SPEED[w.cl];
      const lw = Math.min(3.6, Math.max(3, WIDTH[w.cl] / Math.max(2, lf + lb)));
      edges.push({ a: A, b: B, pts: PTS, cl: w.cl, lf, lb, speed: Math.min(ms || SPEED[w.cl], 30), name: nameOf(t.name), bridge: t.bridge === 'yes', layer: +t.layer || 0, width: Math.max(WIDTH[w.cl] * (w.cl === 'service' ? 1 : 1), (lf + lb) * lw + (w.cl === 'residential' && !oneway ? 2 : 0)) });
      start = i;
    }
  }
}
// keep the Davenport side; bridges into the river end at a "road closed" barrier halfway across
const bridgeEnds = [];
edges = edges.filter((e) => {
  const A = nodes[e.a], B = nodes[e.b], ina = onMain(A.x, A.z), inb = onMain(B.x, B.z);
  if (ina && inb) return true;
  if (!ina && !inb) return false;
  if (!e.bridge) return false;
  // trim to the first 40% of the bridge, ending at a new dead-end node
  const keepFromA = ina, pts = keepFromA ? e.pts : e.pts.slice().reverse();
  let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const out = [pts[0]]; let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + d >= len * 0.4) { const k = (len * 0.4 - acc) / d; out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]); break; }
    acc += d; out.push(pts[i]);
  }
  const end = out[out.length - 1], nid = nodes.length;
  nodes.push({ x: end[0], z: end[1], osm: -nid, ctrl: 0, deg: 0, closed: 1 });
  bridgeEnds.push({ x: end[0], z: end[1], h: Math.atan2(end[0] - out[out.length - 2][0], end[1] - out[out.length - 2][1]) });
  if (keepFromA) { e.b = nid; e.pts = out; } else { e.a = nid; e.pts = out.slice().reverse(); }
  return true;
});
// drop tiny disconnected bits: keep the biggest connected network
{
  const adj = nodes.map(() => []);
  edges.forEach((e, i) => { adj[e.a].push(i); adj[e.b].push(i); });
  const comp = new Int32Array(nodes.length).fill(-1); let best = -1, bestN = 0, c = 0;
  for (let s = 0; s < nodes.length; s++) {
    if (comp[s] >= 0 || !adj[s].length) continue;
    const st = [s]; comp[s] = c; let n = 0;
    while (st.length) { const k = st.pop(); n++; for (const ei of adj[k]) { const e = edges[ei], o = e.a === k ? e.b : e.a; if (comp[o] < 0) { comp[o] = c; st.push(o); } } }
    if (n > bestN) { bestN = n; best = c; } c++;
  }
  edges = edges.filter((e) => comp[e.a] === best);
}
// renumber nodes that are still used
const used = new Map(); const nodes2 = [];
for (const e of edges) for (const k of ['a', 'b']) { if (!used.has(e[k])) { used.set(e[k], nodes2.length); nodes2.push(nodes[e[k]]); } e[k] = used.get(e[k]); }
for (const e of edges) { nodes2[e.a].deg++; nodes2[e.b].deg++; }
// node heights: terrain, except bridges interpolate between their ends
for (const n of nodes2) n.y = heightAt(n.x, n.z);
for (const e of edges) if (e.bridge) for (const k of ['a', 'b']) { const n = nodes2[e[k]], o = nodes2[e[k === 'a' ? 'b' : 'a']]; if (n.closed || n.y < 1) n.y = Math.max(n.y, o.y + 9); }
// intersection control from signal / stop nodes nearby
const pts = read('points');
const nearestNode = (x, z, r) => { let best = -1, bd = r; for (let i = 0; i < nodes2.length; i++) { if (nodes2[i].deg < 3 && !nodes2[i].closed) continue; const d = Math.hypot(nodes2[i].x - x, nodes2[i].z - z); if (d < bd) { bd = d; best = i; } } return best; };
let signals = 0, stops = 0;
for (const p of pts) {
  if (p.type !== 'node' || !p.tags || !p.tags.highway) continue;
  const [x, z] = project(p.lat, p.lon);
  if (p.tags.highway === 'traffic_signals') { const k = nearestNode(x, z, 25); if (k >= 0 && nodes2[k].ctrl !== 1) { nodes2[k].ctrl = 1; signals++; } }
  if (p.tags.highway === 'stop') { const k = nearestNode(x, z, 22); if (k >= 0 && nodes2[k].ctrl === 0) { nodes2[k].ctrl = 2; stops++; } }
}
// unmarked residential crossings: give 4-way junctions of small roads a stop sign so traffic takes turns
for (let i = 0; i < nodes2.length; i++) if (nodes2[i].deg >= 4 && nodes2[i].ctrl === 0) { nodes2[i].ctrl = 2; stops++; }
// paint roads + sidewalks into the raster
function strokeLine(pts, width, code, onlyIf) {
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], len = Math.hypot(bx - ax, bz - az), steps = Math.ceil(len / (CELL * 0.5));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, x = ax + (bx - ax) * t, z = az + (bz - az) * t, r = Math.ceil(width / 2 / CELL);
      const [ci, cj] = cellOf(x, z);
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        const ii = ci + di, jj = cj + dj; if (!inGrid(ii, jj)) continue;
        const cx = GX0 + (ii + 0.5) * CELL, cz = GZ0 + (jj + 0.5) * CELL;
        if (Math.hypot(cx - x, cz - z) <= width / 2) { const k = jj * GW + ii; if (!onlyIf || onlyIf(cls[k])) cls[k] = code; }
      }
    }
  }
}
for (const e of edges) if (e.cl !== 'service' && e.cl !== 'motor') strokeLine(e.pts, e.width + 4, C.walk, (c) => c !== C.water);
for (const e of edges) strokeLine(e.pts, e.width, C.road, (c) => c !== C.water || e.bridge);

// ---------- buildings ----------
const bld = [];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function simplify(pts) {
  let out = pts.slice();
  if (dist(out[0], out[out.length - 1]) < 0.1) out.pop();
  let changed = true;
  while (changed && out.length > 3) {
    changed = false;
    for (let i = 0; i < out.length && out.length > 3; i++) {
      const a = out[(i + out.length - 1) % out.length], b = out[i], c = out[(i + 1) % out.length];
      const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (dist(a, b) < 0.8 || Math.abs(cross) < 0.25) { out.splice(i, 1); changed = true; }
    }
  }
  // counter-clockwise in x/z (viewed from above with z south) for consistent wall normals
  let area = 0; for (let i = 0; i < out.length; i++) { const [x1, z1] = out[i], [x2, z2] = out[(i + 1) % out.length]; area += x1 * z2 - x2 * z1; }
  if (area < 0) out.reverse();
  return { pts: out, area: Math.abs(area) / 2 };
}
const HOUSEY = new Set(['house', 'detached', 'semidetached_house', 'residential', 'bungalow', 'terrace', 'garage', 'shed', 'cabin', 'farm']);
const skyline = [];
function addBuilding(geomPts, t) {
  if (geomPts.length < 4) return;
  const { pts, area } = simplify(geomPts);
  if (pts.length < 3 || area < 12) return;
  let cx = 0, cz = 0; for (const [x, z] of pts) { cx += x; cz += z; } cx /= pts.length; cz /= pts.length;
  const d = district(cx, cz), type = t.building || 'yes';
  let h;
  if (t['building:levels']) h = +t['building:levels'] * 3.3 + 1;
  else if (type === 'garage' || type === 'shed' || type === 'carport' || type === 'roof') h = 3 + rand();
  else if (HOUSEY.has(type) || (d !== 'downtown' && d !== 'north' && area < 260 && type === 'yes')) h = 5.5 + rand() * 2.5;
  else if (type === 'apartments' || type === 'dormitory') h = 10 + rand() * 10;
  else if (type === 'church') h = 14 + rand() * 6;
  else if (d === 'downtown') h = area > 2500 ? 18 + rand() * 30 : area > 800 ? 11 + rand() * 14 : 8 + rand() * 6;
  else if (d === 'village') h = 7 + rand() * 6;
  else if (d === 'north') h = area > 3000 ? 8 + rand() * 4 : 5 + rand() * 3;
  else h = area > 1500 ? 8 + rand() * 6 : 6 + rand() * 4;
  const pitched = (HOUSEY.has(type) || (type === 'yes' && area < 260 && d !== 'downtown' && d !== 'north')) && area < 420 ? 1 : 0;
  // facade style: 0 brick, 1 stone, 2 siding, 3 glass/office, 4 stucco/strip mall, 5 industrial metal
  let style = 2;
  if (d === 'downtown') style = h > 30 ? 3 : rand() < 0.65 ? 0 : 1;
  else if (d === 'village') style = rand() < 0.8 ? 0 : 1;
  else if (d === 'north') style = pitched ? 2 : 4;
  else if (!pitched) style = type === 'industrial' || type === 'warehouse' ? 5 : rand() < 0.5 ? 0 : 4;
  if (type === 'church') style = rand() < 0.5 ? 1 : 0;
  let ymin = Infinity, ymax = -Infinity; for (const [x, z] of pts) { const y = heightAt(x, z); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
  const onLand = onMain(cx, cz);
  if (!onLand) { if (ymin > 0.5) skyline.push([Math.round(cx), Math.round(cz), Math.round(h), Math.round(Math.sqrt(area) / 2)]); return; }
  bld.push({ pts, cx, cz, h: Math.round(h * 10) / 10, y: Math.round(ymin * 10) / 10, slope: ymax - ymin, pitched, style, name: t.name || '', type, area });
  fillPoly(pts, C.building, (c) => c !== C.water);
}
for (const e of read('buildings')) {
  if (e.type === 'way' && e.geometry) addBuilding(P(e.geometry), e.tags || {});
}
for (const e of read('relations')) if (e.tags && e.tags.building) for (const ring of assembleRings(e.members.filter((m) => m.role !== 'inner'))) addBuilding(ring, e.tags);

// ---------- parking spots ----------
const parking = [];
const near = (x, z, r) => nodes2.some((n) => n.deg >= 3 && Math.abs(n.x - x) < r && Math.abs(n.z - z) < r && Math.hypot(n.x - x, n.z - z) < r);
for (const e of edges) {
  if (!['residential', 'tertiary', 'minor', 'secondary'].includes(e.cl) || e.bridge) continue;
  const d0 = district(nodes2[e.a].x, nodes2[e.a].z);
  const p = e.cl === 'secondary' ? (d0 === 'downtown' || d0 === 'village' ? 0.45 : 0) : d0 === 'downtown' ? 0.55 : d0 === 'north' ? 0.1 : 0.3;
  if (!p) continue;
  const off = e.width / 2 - 1.15;
  for (let i = 1; i < e.pts.length; i++) {
    const [ax, az] = e.pts[i - 1], [bx, bz] = e.pts[i], len = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / len, uz = (bz - az) / len, nx = -uz, nz = ux, h = Math.atan2(ux, uz);
    for (let s = 4; s < len - 4; s += 6.4) for (const side of e.lb === 0 ? [1, -1] : [1, -1]) {
      if (rand() > p) continue;
      const x = ax + ux * s + nx * off * side, z = az + uz * s + nz * off * side;
      if (near(x, z, 14)) continue;
      parking.push([x, z, side > 0 ? h : h, 0]);
    }
  }
}
for (const a of areaPolys) {
  if (a.code !== C.parking) continue;
  const pts = a.pts; let best = 0, ux = 1, uz = 0;
  for (let i = 1; i < pts.length; i++) { const d = dist(pts[i], pts[i - 1]); if (d > best) { best = d; ux = (pts[i][0] - pts[i - 1][0]) / d; uz = (pts[i][1] - pts[i - 1][1]) / d; } }
  let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
  for (const [x, z] of pts) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); minz = Math.min(minz, z); maxz = Math.max(maxz, z); }
  let n = 0;
  const vx = -uz, vz = ux, cx = (minx + maxx) / 2, cz = (minz + maxz) / 2, R = Math.hypot(maxx - minx, maxz - minz) / 2;
  for (let a1 = -R; a1 < R && n < 60; a1 += 2.8) for (let b1 = -R; b1 < R && n < 60; b1 += 7.5) {
    const x = cx + ux * a1 + vx * b1, z = cz + uz * a1 + vz * b1;
    if (!pointInPoly(x, z, pts) || rand() > 0.5 || clsAt(x, z) === C.building) continue;
    parking.push([x, z, Math.atan2(vx, vz) + (rand() < 0.5 ? Math.PI : 0), 1]); n++;
  }
}

// ---------- trees ----------
const trees = [];
for (let j = 0; j < GH; j += 1) for (let i = 0; i < GW; i += 1) {
  const c = cls[j * GW + i], x = GX0 + (i + rand()) * CELL, z = GZ0 + (j + rand()) * CELL;
  if (!onMain(x, z)) continue;
  let p = 0;
  if (c === C.wood) p = 0.22; else if (c === C.park || c === C.cemetery) p = 0.035; else if (c === C.lawn) p = district(x, z) === 'downtown' ? 0.004 : 0.022;
  if (p && rand() < p) trees.push([x, z, c === C.wood ? (rand() < 0.3 ? 1 : 0) : rand() < 0.12 ? 1 : rand() < 0.25 ? 2 : 0, 0.75 + rand() * 0.6]);
}
// street trees along neighbourhood streets
for (const e of edges) {
  if (e.cl !== 'residential' && e.cl !== 'tertiary') continue;
  const dd = district(nodes2[e.a].x, nodes2[e.a].z); if (dd === 'north') continue;
  for (let i = 1; i < e.pts.length; i++) {
    const [ax, az] = e.pts[i - 1], [bx, bz] = e.pts[i], len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
    for (let s = 6; s < len; s += 11) for (const side of [1, -1]) {
      if (rand() > 0.55) continue;
      const off = e.width / 2 + 3.2, x = ax + ux * s - uz * off * side, z = az + uz * s + ux * off * side, c = clsAt(x, z);
      if (c === C.road || c === C.building || c === C.water) continue;
      trees.push([x, z, dd === 'downtown' ? 2 : 0, 0.8 + rand() * 0.5]);
    }
  }
}

// ---------- points of interest ----------
const poi = [];
for (const p of pts) {
  const t = p.tags || {}; const lat = p.lat ?? p.center?.lat, lon = p.lon ?? p.center?.lon; if (lat == null) continue;
  const [x, z] = project(lat, lon); if (!onMain(x, z)) continue;
  const kind = t.amenity || t.shop || t.tourism || t.leisure || t.man_made || (t.highway === 'bus_stop' ? 'bus_stop' : null);
  if (!kind || t.highway === 'crossing') continue;
  poi.push({ kind, name: t.name || '', x: Math.round(x), z: Math.round(z) });
}

// ---------- write tiles ----------
const b64 = (arr) => Buffer.from(arr.buffer).toString('base64');
const r1 = (v) => Math.round(v * 10) / 10;
const tileKey = (x, z) => `${Math.floor(x / TILE)}_${Math.floor(z / TILE)}`;
const buckets = new Map();
const bucket = (k) => { if (!buckets.has(k)) buckets.set(k, { b: [], t: [], k: [], e: new Set() }); return buckets.get(k); };
for (const b of bld) bucket(tileKey(b.cx, b.cz)).b.push(b);
for (const t of trees) bucket(tileKey(t[0], t[1])).t.push(t);
for (const p of parking) bucket(tileKey(p[0], p[1])).k.push(p);
edges.forEach((e, idx) => { for (const [x, z] of e.pts) bucket(tileKey(x, z)).e.add(idx); for (let i = 1; i < e.pts.length; i++) bucket(tileKey((e.pts[i][0] + e.pts[i - 1][0]) / 2, (e.pts[i][1] + e.pts[i - 1][1]) / 2)).e.add(idx); });
let tileCount = 0, totalBytes = 0, maxBytes = 0;
const tileList = [];
for (let tz = TZ0; tz <= TZ1; tz++) for (let tx = TX0; tx <= TX1; tx++) {
  const ox = tx * TILE, oz = tz * TILE, key = `${tx}_${tz}`, bk = buckets.get(key) || { b: [], t: [], k: [], e: new Set() };
  // 26x26 heights at 8 m (centimetres) and 50x50 ground classes at 4 m
  const H = new Int16Array(26 * 26);
  for (let j = 0; j <= 25; j++) for (let i = 0; i <= 25; i++) H[j * 26 + i] = Math.round(heightAt(ox + i * 8, oz + j * 8) * 100);
  const CL = new Uint8Array(50 * 50);
  let anyLand = false;
  for (let j = 0; j < 50; j++) for (let i = 0; i < 50; i++) { const c = clsAt(ox + i * 4 + 2, oz + j * 4 + 2); const m = onMain(ox + i * 4 + 2, oz + j * 4 + 2); CL[j * 50 + i] = m ? c : c === C.water ? C.water : C.farm; if (m) anyLand = true; }
  const tile = {
    h: b64(H), c: b64(CL),
    b: bk.b.map((b) => [b.pts.flatMap(([x, z]) => [r1(x - ox), r1(z - oz)]), b.y, b.h, b.pitched, b.style, b.name]),
    t: bk.t.flatMap(([x, z, k, s]) => [r1(x - ox), r1(z - oz), k, Math.round(s * 10)]),
    k: bk.k.flatMap(([x, z, h, lot]) => [r1(x - ox), r1(z - oz), Math.round(h * 100) / 100, lot]),
    e: [...bk.e],
  };
  const json = JSON.stringify(tile);
  fs.writeFileSync(`${OUT}tiles/${key}.json`, json);
  tileCount++; totalBytes += json.length; maxBytes = Math.max(maxBytes, json.length);
  if (anyLand) tileList.push(key);
}
// ---------- road graph ----------
const roads = {
  names,
  nodes: nodes2.flatMap((n) => [r1(n.x), r1(n.z), r1(n.y), n.ctrl, n.closed ? 1 : 0]),
  edges: edges.map((e) => [e.a, e.b, Object.keys(WIDTH).indexOf(e.cl), e.lf, e.lb, r1(e.speed), e.name, e.bridge ? 1 : 0, r1(e.width), e.pts.flatMap(([x, z]) => [r1(x), r1(z)])]),
  classes: Object.keys(WIDTH),
};
fs.writeFileSync(OUT + 'roads.json', JSON.stringify(roads));
// distant city: one box per building + Illinois skyline
// coarse terrain for the far distance: heights (dm) and land/water every 32 m
const CW = Math.ceil((GW * CELL) / 32) + 1, CH = Math.ceil((GH * CELL) / 32) + 1;
const coarseH = new Int16Array(CW * CH), coarseW = new Uint8Array(CW * CH);
for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) { const x = GX0 + i * 32, z = GZ0 + j * 32; coarseH[j * CW + i] = Math.round(heightAt(x, z) * 10); coarseW[j * CW + i] = clsAt(x, z) === C.water ? 1 : onMain(x, z) ? 0 : 2; }
fs.writeFileSync(OUT + 'overview.json', JSON.stringify({
  b: bld.flatMap((b) => [Math.round(b.cx), Math.round(b.cz), Math.round(b.y), Math.round(b.h), Math.round(Math.sqrt(b.area) / 2), b.style]),
  skyline: skyline.flat(), coarse: { x0: GX0, z0: GZ0, step: 32, w: CW, h: CH, heights: b64(coarseH), kind: b64(coarseW) },
}));
const find = (kind, re) => poi.filter((p) => p.kind === kind && (!re || re.test(p.name)));
fs.writeFileSync(OUT + 'index.json', JSON.stringify({
  tile: TILE, tx0: TX0, tx1: TX1, tz0: TZ0, tz1: TZ1, riverLevel: RIVER_LEVEL, origin: ORIGIN,
  tiles: tileList, bridgeEnds,
  police: find('police').filter((p) => /Davenport|Scott/.test(p.name)), hospitals: find('hospital'), fire: find('fire_station'),
  poi: poi.filter((p) => p.name),
}));
console.log(`buildings ${bld.length}, skyline ${skyline.length}, trees ${trees.length}, parking ${parking.length}`);
console.log(`road nodes ${nodes2.length}, edges ${edges.length}, km ${(edges.reduce((a, e) => { let l = 0; for (let i = 1; i < e.pts.length; i++) l += dist(e.pts[i], e.pts[i - 1]); return a + l; }, 0) / 1000).toFixed(0)}, signals ${signals}, stops ${stops}, bridge ends ${bridgeEnds.length}`);
console.log(`tiles ${tileCount} (land ${tileList.length}), total ${(totalBytes / 1e6).toFixed(1)} MB, biggest ${(maxBytes / 1e3).toFixed(0)} KB, roads.json ${(fs.statSync(OUT + 'roads.json').size / 1e6).toFixed(1)} MB`);

// ---------- preview image (debug) ----------
const COL = [[136, 176, 104], [52, 118, 160], [96, 160, 80], [54, 104, 58], [90, 92, 98], [150, 150, 145], [130, 120, 110], [120, 150, 110], [210, 200, 150], [60, 62, 66], [190, 190, 185], [205, 160, 130], [120, 170, 90], [170, 160, 120]];
const png = new PNG({ width: GW, height: GH });
for (let k = 0; k < GW * GH; k++) {
  const c = COL[cls[k]] || [255, 0, 255], shade = cls[k] === C.water ? 1 : Math.max(0.6, Math.min(1.25, 0.75 + height[k] / 80));
  const dim = main[k] || cls[k] === C.water ? 1 : 0.55;
  png.data[k * 4] = c[0] * shade * dim; png.data[k * 4 + 1] = c[1] * shade * dim; png.data[k * 4 + 2] = c[2] * shade * dim; png.data[k * 4 + 3] = 255;
}
for (const n of nodes2) if (n.ctrl) { const [i, j] = cellOf(n.x, n.z); for (let d = -2; d <= 2; d++) for (const [ii, jj] of [[i + d, j], [i, j + d]]) if (inGrid(ii, jj)) { const k = jj * GW + ii; png.data[k * 4] = n.ctrl === 1 ? 255 : 255; png.data[k * 4 + 1] = n.ctrl === 1 ? 210 : 40; png.data[k * 4 + 2] = 40; } }
fs.writeFileSync(here('cache/preview.png'), PNG.sync.write(png));
console.log('preview written to tools/cache/preview.png');
