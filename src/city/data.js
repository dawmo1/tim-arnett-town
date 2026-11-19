// Davenport map data: the index, the road graph, ground heights and ground types.
// Everything is in local metres: x = east, z = south, origin at 3rd & Main downtown.
// Map data © OpenStreetMap contributors (ODbL). Elevation: AWS Terrain Tiles.
export const TILE = 200;
export const WATER_Y = -0.15; // river surface
export const GROUND_LIFT = 0.08; // feet stand this far above the raw terrain (roads/sidewalks sit just under)
export const C = { lawn: 0, water: 1, park: 2, wood: 3, parking: 4, paved: 5, industrial: 6, cemetery: 7, sand: 8, road: 9, walk: 10, building: 11, pitch: 12, offmap: 13 };

export const D = { index: null, roads: null, overview: null, coarse: null };
const base = new URL('../../data/', import.meta.url);
const getJSON = async (p) => { const r = await fetch(new URL(p, base)); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); };
function b64(s, Type) {
  const bin = atob(s), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return Type === Uint8Array ? u8 : new Type(u8.buffer);
}

// ---------- startup ----------
export async function loadData() {
  const [index, roads, overview] = await Promise.all([getJSON('index.json'), getJSON('roads.json'), getJSON('overview.json')]);
  D.index = index; D.overview = overview;
  const c = overview.coarse;
  D.coarse = { ...c, heights: b64(c.heights, Int16Array), kind: b64(c.kind, Uint8Array) };
  D.tileSet = new Set(index.tiles);
  buildGraph(roads);
}

// ---------- tile data (fetched on demand, kept in a small cache) ----------
export const tiles = new Map(); // key -> {key, tx, tz, ox, oz, h:Int16Array, c:Uint8Array, b, t, k, e}
const pending = new Map();
export const tileKey = (tx, tz) => `${tx}_${tz}`;
export const inRange = (tx, tz) => D.index && tx >= D.index.tx0 && tx <= D.index.tx1 && tz >= D.index.tz0 && tz <= D.index.tz1;
export function fetchTile(tx, tz) {
  const key = tileKey(tx, tz);
  if (tiles.has(key)) return Promise.resolve(tiles.get(key));
  if (pending.has(key)) return pending.get(key);
  const p = getJSON(`tiles/${key}.json`).then((j) => {
    const t = { key, tx, tz, ox: tx * TILE, oz: tz * TILE, h: b64(j.h, Int16Array), c: b64(j.c, Uint8Array), b: j.b, t: j.t, k: j.k, e: j.e, used: performance.now() };
    tiles.set(key, t); pending.delete(key);
    return t;
  }).catch((e) => { pending.delete(key); throw e; });
  pending.set(key, p);
  return p;
}
export const isFetching = (key) => pending.has(key);

// ---------- heights ----------
function coarseHeight(x, z) {
  const c = D.coarse;
  const fx = (x - c.x0) / c.step, fz = (z - c.z0) / c.step;
  const i = Math.max(0, Math.min(c.w - 2, Math.floor(fx))), j = Math.max(0, Math.min(c.h - 2, Math.floor(fz)));
  const ax = Math.max(0, Math.min(1, fx - i)), az = Math.max(0, Math.min(1, fz - j));
  const H = c.heights, w = c.w;
  return ((H[j * w + i] * (1 - ax) + H[j * w + i + 1] * ax) * (1 - az) + (H[(j + 1) * w + i] * (1 - ax) + H[(j + 1) * w + i + 1] * ax) * az) / 10;
}
// Raw terrain height (no bridges). Uses the detailed 8 m grid when that tile's data is here.
export function terrainHeight(x, z) {
  const tx = Math.floor(x / TILE), tz = Math.floor(z / TILE);
  const t = tiles.get(tileKey(tx, tz));
  if (!t) return D.coarse ? coarseHeight(x, z) : 0;
  const fx = (x - t.ox) / 8, fz = (z - t.oz) / 8;
  const i = Math.min(24, Math.floor(fx)), j = Math.min(24, Math.floor(fz)), ax = fx - i, az = fz - j, H = t.h;
  return ((H[j * 26 + i] * (1 - ax) + H[j * 26 + i + 1] * ax) * (1 - az) + (H[j * 26 + 26 + i] * (1 - ax) + H[j * 26 + 27 + i] * ax) * az) / 100;
}
export function classAt(x, z) {
  const tx = Math.floor(x / TILE), tz = Math.floor(z / TILE);
  const t = tiles.get(tileKey(tx, tz));
  if (t) return t.c[Math.min(49, Math.floor((z - t.oz) / 4)) * 50 + Math.min(49, Math.floor((x - t.ox) / 4))];
  const c = D.coarse; if (!c) return C.lawn;
  const i = Math.round((x - c.x0) / c.step), j = Math.round((z - c.z0) / c.step);
  if (i < 0 || j < 0 || i >= c.w || j >= c.h) return C.water;
  const k = c.kind[j * c.w + i];
  return k === 1 ? C.water : k === 2 ? C.offmap : C.lawn;
}
// Bridge deck under (x, z), or null.
export function bridgeDeck(x, z) {
  let best = null, bd = Infinity;
  for (const e of G.bridges) {
    if (x < e.minx || x > e.maxx || z < e.minz || z > e.maxz) continue;
    const q = closestOnEdge(e, x, z);
    if (q.d < e.width / 2 + 0.6 && q.d < bd) { bd = q.d; best = q.y; }
  }
  return best;
}
// Where you stand: terrain or a bridge deck, a little above the raw ground.
export function groundHeight(x, z) {
  const t = terrainHeight(x, z), b = bridgeDeck(x, z);
  return (b !== null && b > t ? b : t) + GROUND_LIFT;
}
export function isLand(x, z) {
  if (terrainHeight(x, z) > WATER_Y + 0.05) return true;
  return bridgeDeck(x, z) !== null;
}
// Land you can't go on (across the river, Arsenal Island): treated as a cliff.
export const offMap = (x, z) => classAt(x, z) === C.offmap || !D.index || x < D.index.tx0 * TILE + 20 || x > (D.index.tx1 + 1) * TILE - 20 || z < D.index.tz0 * TILE + 20 || z > (D.index.tz1 + 1) * TILE - 20;

// ---------- districts + neighbourhoods ----------
export function district(x, z) {
  if (x > 1500 && x < 3000 && z > -1000 && z < 300) return 'village';
  if (x > -1200 && x < 900 && z > -520 && z < 300) return 'downtown';
  if (z > -150 && Math.abs(x) < 4000) return 'riverfront';
  if (z < -3200) return 'north';
  if (x < -1200) return 'west';
  return 'hilltop';
}
const M_LAT = 110574, M_LON = 111320 * Math.cos((41.5236 * Math.PI) / 180);
const ll = (lat, lon) => [(lon + 90.5776) * M_LON, -(lat - 41.5236) * M_LAT];
const HOODS = [
  ['Downtown', 41.5225, -90.5755, 700], ['Riverfront', 41.5185, -90.5745, 500], ['East Village', 41.5315, -90.5461, 700],
  ['Eagle Point', 41.5212, -90.5538, 500], ['East Circle', 41.5191, -90.5406, 400], ['Hilltop', 41.5305, -90.5760, 650],
  ['Vander Veer', 41.5395, -90.5715, 600], ['Central Davenport', 41.5470, -90.5720, 800], ['Gold Coast', 41.5275, -90.5880, 550],
  ['West End', 41.5195, -90.6060, 900], ['Black Hawk', 41.5209, -90.6376, 700], ['Fejervary', 41.5160, -90.6150, 600],
  ['Northwest Davenport', 41.5520, -90.6120, 1100], ['NorthPark', 41.5635, -90.5741, 700], ['Kimberly Road', 41.5585, -90.5870, 800],
  ['Prospect Park', 41.5420, -90.5520, 700], ['Hamburg', 41.5265, -90.5930, 450], ['Lincoln Park', 41.5370, -90.6000, 700],
  ['Garfield Park', 41.5420, -90.5950, 600], ['Hillcrest', 41.5490, -90.6300, 900], ['Oakdale', 41.5340, -90.5850, 500],
].map(([name, lat, lon, r]) => { const [x, z] = ll(lat, lon); return { name, x, z, r }; });
export function hoodAt(x, z) {
  let best = null, bd = Infinity;
  for (const h of HOODS) { const d = Math.hypot(h.x - x, h.z - z) / h.r; if (d < bd) { bd = d; best = h; } }
  return best && bd < 2.2 ? best.name : 'Davenport';
}

// ---------- road graph ----------
export const G = { nodes: null, edges: [], adj: [], names: [], classes: [], bridges: [], grid: new Map() };
const GCELL = 50;
const gkey = (i, j) => (i + 4096) * 8192 + (j + 4096);
function buildGraph(r) {
  G.names = r.names; G.classes = r.classes;
  const n = r.nodes.length / 5;
  G.nodes = { n, x: new Float32Array(n), z: new Float32Array(n), y: new Float32Array(n), ctrl: new Uint8Array(n), closed: new Uint8Array(n) };
  for (let i = 0; i < n; i++) { G.nodes.x[i] = r.nodes[i * 5]; G.nodes.z[i] = r.nodes[i * 5 + 1]; G.nodes.y[i] = r.nodes[i * 5 + 2]; G.nodes.ctrl[i] = r.nodes[i * 5 + 3]; G.nodes.closed[i] = r.nodes[i * 5 + 4]; }
  G.adj = Array.from({ length: n }, () => []);
  r.edges.forEach(([a, b, cls, lf, lb, speed, name, bridge, width, flat], id) => {
    const pts = Float32Array.from(flat), np = pts.length / 2, cum = new Float32Array(np);
    for (let i = 1; i < np; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
    let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
    for (let i = 0; i < np; i++) { minx = Math.min(minx, pts[i * 2]); maxx = Math.max(maxx, pts[i * 2]); minz = Math.min(minz, pts[i * 2 + 1]); maxz = Math.max(maxz, pts[i * 2 + 1]); }
    const e = { id, a, b, cls: r.classes[cls], ci: cls, lf, lb, speed, name: name >= 0 ? r.names[name] : '', bridge: !!bridge, width, pts, cum, len: cum[np - 1], minx: minx - width, maxx: maxx + width, minz: minz - width, maxz: maxz + width };
    G.edges.push(e);
    G.adj[a].push(id); G.adj[b].push(id);
    if (e.bridge) G.bridges.push(e);
    for (let i = 1; i < np; i++) {
      const ax = pts[i * 2 - 2], az = pts[i * 2 - 1], bx = pts[i * 2], bz = pts[i * 2 + 1];
      const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / (GCELL / 2));
      const seen = new Set();
      for (let s = 0; s <= steps; s++) {
        const k = gkey(Math.floor((ax + ((bx - ax) * s) / steps) / GCELL), Math.floor((az + ((bz - az) * s) / steps) / GCELL));
        if (seen.has(k)) continue; seen.add(k);
        let arr = G.grid.get(k); if (!arr) G.grid.set(k, (arr = []));
        arr.push(id * 4096 + (i - 1));
      }
    }
  });
}
// Height of an edge at distance s along it (bridges ramp between their end heights).
function edgeY(e, s, x, z) {
  if (!e.bridge) return terrainHeight(x, z);
  const ya = G.nodes.y[e.a], yb = G.nodes.y[e.b], k = e.len ? s / e.len : 0;
  // gentle S-curve so decks don't kink at the ends
  return ya + (yb - ya) * (k * k * (3 - 2 * k));
}
export function pointOnEdge(e, s) {
  s = Math.max(0, Math.min(e.len, s));
  const { pts, cum } = e;
  let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
  const seg = cum[i] - cum[i - 1] || 1, k = (s - cum[i - 1]) / seg;
  const ax = pts[i * 2 - 2], az = pts[i * 2 - 1], bx = pts[i * 2], bz = pts[i * 2 + 1];
  const x = ax + (bx - ax) * k, z = az + (bz - az) * k;
  return { x, z, y: edgeY(e, s, x, z), h: Math.atan2(bx - ax, bz - az) };
}
export function closestOnEdge(e, x, z, segOnly = -1) {
  const { pts, cum } = e;
  let best = { d: Infinity };
  const n = cum.length;
  for (let i = segOnly >= 0 ? segOnly + 1 : 1; i < (segOnly >= 0 ? segOnly + 2 : n); i++) {
    const ax = pts[i * 2 - 2], az = pts[i * 2 - 1], bx = pts[i * 2], bz = pts[i * 2 + 1];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    const px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
    if (d < best.d) best = { d, x: px, z: pz, s: cum[i - 1] + t * (cum[i] - cum[i - 1]), seg: i - 1, h: Math.atan2(dx, dz), side: Math.sign(dx * (z - az) - dz * (x - ax)) };
  }
  best.y = edgeY(e, best.s, best.x, best.z);
  best.e = e;
  return best;
}
// Nearest road to a point (within maxD metres). filter(e) can skip edges.
export function nearestEdge(x, z, maxD = 60, filter = null) {
  const r = Math.ceil(maxD / GCELL), ci = Math.floor(x / GCELL), cj = Math.floor(z / GCELL);
  let best = null;
  const seen = new Set();
  for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    const arr = G.grid.get(gkey(ci + di, cj + dj)); if (!arr) continue;
    for (const code of arr) {
      if (seen.has(code)) continue; seen.add(code);
      const e = G.edges[Math.floor(code / 4096)];
      if (filter && !filter(e)) continue;
      const q = closestOnEdge(e, x, z, code % 4096);
      if (q.d <= maxD && (!best || q.d < best.d)) best = q;
    }
  }
  return best;
}
// Edges with a segment in the square around (x, z).
export function edgesNear(x, z, rad) {
  const r = Math.ceil(rad / GCELL), ci = Math.floor(x / GCELL), cj = Math.floor(z / GCELL), out = new Set();
  for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    const arr = G.grid.get(gkey(ci + di, cj + dj)); if (arr) for (const code of arr) out.add(Math.floor(code / 4096));
  }
  return out;
}
export const canGo = (e, fromNode) => (fromNode === e.a ? e.lf > 0 : e.lb > 0);

// ---------- GPS: A* over the road graph, obeying one-way streets ----------
// opts.any: ignore one-way streets (emergency vehicles). opts.heading: prefer starting the way you face.
export function route(fx, fz, tx, tz, opts = {}) {
  const drivable = (e) => e.cls !== 'service' || e.len > 30;
  const A = nearestEdge(fx, fz, 120, drivable), B = nearestEdge(tx, tz, 300, drivable);
  if (!A || !B) return null;
  const N = G.nodes, n = N.n;
  const g = new Float64Array(n).fill(Infinity), came = new Int32Array(n).fill(-1), cameEdge = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
  const heap = [];
  const push = (node, f) => { heap.push([f, node]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const hx = (k) => Math.hypot(N.x[k] - B.x, N.z[k] - B.z);
  const cost = (e) => e.len / Math.max(5, e.speed) * (e.cls === 'service' ? 3 : 1); // seconds, roughly
  const start = (node, c) => { if (c < g[node]) { g[node] = c; push(node, c + hx(node) / 15); } };
  const ea = A.e, none = !(ea.lf > 0) && !(ea.lb > 0) || opts.any;
  // turning around costs time: penalise the end of the road behind you
  let penA = 0, penB = 0;
  if (opts.heading !== undefined) { const dot = Math.sin(opts.heading) * Math.sin(A.h) + Math.cos(opts.heading) * Math.cos(A.h); if (dot > 0) penA = 12; else penB = 12; }
  if (ea.lf > 0 || none) start(ea.b, (ea.len - A.s) / Math.max(5, ea.speed) + penB);
  if (ea.lb > 0 || none) start(ea.a, A.s / Math.max(5, ea.speed) + penA);
  const goal = new Set([B.e.a, B.e.b]);
  let reached = -1;
  while (heap.length) {
    const [, k] = pop();
    if (closed[k]) continue; closed[k] = 1;
    if (goal.has(k)) { reached = k; break; }
    for (const id of G.adj[k]) {
      const e = G.edges[id]; if (!opts.any && !canGo(e, k)) continue;
      const o = e.a === k ? e.b : e.a; if (closed[o] || N.closed[o]) continue;
      const c = g[k] + cost(e);
      if (c < g[o]) { g[o] = c; came[o] = k; cameEdge[o] = id; push(o, c + hx(o) / 15); }
    }
  }
  if (reached < 0) return null;
  const chain = []; for (let k = reached; k >= 0; k = came[k]) chain.push(k);
  chain.reverse();
  const out = [[fx, fz], [A.x, A.z]];
  const addEdge = (e, fromNode, s0 = null, s1 = null) => {
    const fwd = fromNode === e.a, P = e.pts, np = e.cum.length;
    const lo = s0 ?? 0, hi = s1 ?? e.len;
    const idx = []; for (let i = 0; i < np; i++) if (e.cum[i] > lo && e.cum[i] < hi) idx.push(i);
    if (!fwd) idx.reverse();
    for (const i of idx) out.push([P[i * 2], P[i * 2 + 1]]);
  };
  // first partial edge: from the snap point to the first node
  const n0 = chain[0];
  if (n0 === ea.b) addEdge(ea, ea.a, A.s, null); else addEdge(ea, ea.b, null, A.s);
  out.push([N.x[n0], N.z[n0]]);
  for (let i = 1; i < chain.length; i++) { const e = G.edges[cameEdge[chain[i]]]; addEdge(e, chain[i - 1]); out.push([N.x[chain[i]], N.z[chain[i]]]); }
  const eb = B.e;
  if (reached === eb.a) addEdge(eb, eb.a, null, B.s); else addEdge(eb, eb.b, B.s, null);
  out.push([B.x, B.z]);
  return out;
}

// ---------- spawning ----------
const PLAY = { x0: -3300, x1: 2600, z0: -4300, z1: 250 }; // where random spawns land (the busy part of town)
export function inPlay(x, z) { return x > PLAY.x0 && x < PLAY.x1 && z > PLAY.z0 && z < PLAY.z1; }
// A sidewalk spot beside a road. near: optional {x, z, r} to search around.
export function sidewalkSpot(near = null, rnd = Math.random) {
  const ok = (e) => !e.bridge && ['residential', 'tertiary', 'secondary', 'primary', 'minor'].includes(e.cls) && e.len > 25;
  for (let tries = 0; tries < 400; tries++) {
    let e, s;
    // widen the search around `near` if nothing suitable is close
    if (near) { const r = near.r * (1 + Math.floor(tries / 60)); const q = nearestEdge(near.x + (rnd() - 0.5) * r * 2, near.z + (rnd() - 0.5) * r * 2, r, ok); if (!q) continue; e = q.e; s = Math.max(6, Math.min(e.len - 6, q.s)); }
    else e = G.edges[Math.floor(rnd() * G.edges.length)];
    if (!ok(e)) continue;
    const p = pointOnEdge(e, s ?? 6 + rnd() * (e.len - 12));
    if (!near && !inPlay(p.x, p.z)) continue;
    const side = rnd() < 0.5 ? 1 : -1, off = e.width / 2 + 1.4;
    const x = p.x + Math.cos(p.h) * off * side, z = p.z - Math.sin(p.h) * off * side;
    if (!isLand(x, z) || offMap(x, z)) continue;
    return { x, z, h: p.h + (rnd() < 0.5 ? 0 : Math.PI) };
  }
  return { x: 0, z: -150, h: 0 };
}
export function nearestHospital(x, z) {
  let best = null, bd = Infinity;
  for (const h of D.index.hospitals) { const d = Math.hypot(h.x - x, h.z - z); if (d < bd) { bd = d; best = h; } }
  return best;
}
