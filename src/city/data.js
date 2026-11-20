// Quad Cities map data: the index, the road graph (in 2 km chunks loaded on demand), ground heights and ground types.
// Everything is in local metres: x = east, z = south, origin at 3rd & Main downtown.
// Map data © OpenStreetMap contributors (ODbL). Elevation: AWS Terrain Tiles.
export const TILE = 200;
export const WATER_Y = -0.15; // river surface
export const GROUND_LIFT = 0.08; // feet stand this far above the raw terrain (roads/sidewalks sit just under)
// ground classes (tools/build-map.mjs writes them; see the tile format note there). 13 = outside the map.
export const C = { lawn: 0, water: 1, park: 2, wood: 3, parking: 4, paved: 5, industrial: 6, cemetery: 7, sand: 8, road: 9, walk: 10, building: 11, pitch: 12, offmap: 13,
  farm: 14, meadow: 15, orchard: 16, golf: 17, rail: 18, wetland: 19, creek: 20, pond: 21, residential: 22, scrub: 23, farmyard: 24, quarry: 25 };

export const D = { index: null, roads: null, overview: null, coarse: null };
const base = new URL('../../data/', import.meta.url);
const getJSON = async (p) => { const r = await fetch(new URL(p, base)); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); };
function b64(s, Type) {
  const bin = atob(s), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return Type === Uint8Array ? u8 : new Type(u8.buffer);
}

// ---------- startup ----------
// Loads the index, the overview and the rail lines. Road chunks and tiles come later, as they're needed.
export async function loadData() {
  const [index, overview, rail] = await Promise.all([getJSON('index.json'), getJSON('overview.json'), getJSON('rail.json')]);
  D.index = index; D.overview = overview; D.rail = rail;
  const c = overview.coarse;
  D.coarse = { ...c, heights: c.heights ? b64(c.heights, Int16Array) : unDelta(b64(c.heightsD, Uint8Array), c.w * c.h), kind: c.kind ? b64(c.kind, Uint8Array) : unRle(b64(c.kindRle, Uint8Array), c.w * c.h) };
  // the tiles with land: listed, or (region map) everything in range but the open-water ones
  if (index.tiles) D.tileSet = new Set(index.tiles);
  else { const water = new Set(index.waterTiles); D.tileSet = new Set(); for (let tz = index.tz0; tz <= index.tz1; tz++) for (let tx = index.tx0; tx <= index.tx1; tx++) { const k = `${tx}_${tz}`; if (!water.has(k)) D.tileSet.add(k); } }
  initGraph(index.roads);
  for (const t of index.towns) t.rings = t.rings.map((r) => Float32Array.from(r));
  for (const c2 of index.counties || []) c2.rings = c2.rings.map((r) => Float32Array.from(r));
  lots.list = [...lots.extra];
}
// ---------- tile data (fetched on demand, kept in a small cache) ----------
export const tiles = new Map(); // key -> {key, tx, tz, ox, oz, h:Int16Array, c:Uint8Array, b, t, k, e}
const pending = new Map();
const early = new Map(); // key -> tile JSON promise fetched by the lot planning, handed over on the first fetchTile
export const tileKey = (tx, tz) => `${tx}_${tz}`;
export const inRange = (tx, tz) => D.index && tx >= D.index.tx0 && tx <= D.index.tx1 && tz >= D.index.tz0 && tz <= D.index.tz1;
const rawTile = (key) => { const j = early.get(key); if (j) { early.delete(key); return j; } return getJSON(`tiles/${key}.json`); };
function decodeHeights(j) {
  if (typeof j.h === 'number') return new Int16Array(676).fill(j.h);
  if (!j.hd) return b64(j.h, Int16Array);
  const u = b64(j.hd, Uint8Array), out = new Int16Array(676), i16 = (p) => ((u[p] | (u[p + 1] << 8)) << 16) >> 16;
  let q = i16(0), p = 2; out[0] = q * 2;
  for (let k = 1; k < 676; k++) { const d = u[p++]; if (d === 128) { q = i16(p); p += 2; } else q += (d << 24) >> 24; out[k] = q * 2; }
  return out;
}
// coarse heights: int8 deltas in 0.5 m (-128 = int16 follows) -> decimetres
function unDelta(u, n) { const out = new Int16Array(n); let q = 0; for (let p = 0, k = 0; k < n; k++) { const d = u[p++]; if (d === 128) { q = ((u[p] | (u[p + 1] << 8)) << 16) >> 16; p += 2; } else q += (d << 24) >> 24; out[k] = q * 5; } return out; }
function unRle(u, n) { const out = new Uint8Array(n); for (let p = 0, k = 0; p < u.length; p += 2) { out.fill(u[p], k, k + u[p + 1]); k += u[p + 1]; } return out; }
const decodeClasses = (j) => (j.cr ? unRle(b64(j.cr, Uint8Array), 2500) : b64(j.c, Uint8Array));
// A tile needs its road chunk (it lists edge ids) and the walk-in store lots near it planned (they knock OSM buildings out).
export function fetchTile(tx, tz) {
  const key = tileKey(tx, tz);
  if (tiles.has(key)) return Promise.resolve(tiles.get(key));
  if (pending.has(key)) return pending.get(key);
  const ox = tx * TILE, oz = tz * TILE;
  const p = Promise.all([rawTile(key), lotsReady(ox + TILE / 2, oz + TILE / 2)]).then(([j]) => {
    const t = { key, tx, tz, ox, oz, h: decodeHeights(j), c: decodeClasses(j), b: clearLots(j.b, ox, oz), t: j.t, k: j.k, e: j.e.filter((id) => G.edges[id]), p: j.p || {}, l: j.l || {}, a: j.a || {}, used: performance.now() };
    tiles.set(key, t); pending.delete(key);
    return t;
  }).catch((e) => { pending.delete(key); throw e; });
  pending.set(key, p);
  return p;
}
export const isFetching = (key) => pending.has(key);
// Lots kept clear for the walk-in stores: economy.js sets `plan`. Planning is lazy, one road chunk at a time:
// plan(tileB, area) (tileB(tx, tz) -> that tile's raw building records, area = {x0, z0, x1, z1} of the chunk) returns
// [{x, z, fx, fz, hw, hd}] rectangles (centre, unit vector into the lot, half width, half depth) for the stores it places there.
// Every chunk within reach of a tile is planned before that tile is built (fetchTile -> lotsReady).
// A building touching a lot (lotHits) is dropped from its tile's data, so its mesh, walls, roof and footprint all go.
// landmarks.js pushes the Blender landmarks' footprints into `extra` (same shape) at import time.
export const lots = { plan: null, list: null, extra: [] };
const planned = new Map(); // road chunk key -> promise
const tileB = (tx, tz) => { const k = tileKey(tx, tz); if (!D.tileSet.has(k)) return Promise.resolve([]); if (!early.has(k) && !tiles.has(k)) early.set(k, getJSON(`tiles/${k}.json`)); return tiles.has(k) ? Promise.resolve(tiles.get(k).b) : early.get(k).then((j) => j.b, () => []); };
function planChunk(cx, cz) {
  const key = cx + '_' + cz;
  if (!planned.has(key)) {
    const S = G.chunk, area = { x0: cx * S, z0: cz * S, x1: (cx + 1) * S, z1: (cz + 1) * S };
    planned.set(key, ensureRoads(area.x0 - 300, area.z0 - 300, area.x1 + 300, area.z1 + 300)
      .then(() => (lots.plan ? lots.plan(tileB, area) : []))
      .then((list) => { lots.list.push(...list); }, (e) => console.warn('store plan', key, e)));
  }
  return planned.get(key);
}
// stores sit up to ~200 m from the point they were planned from
function lotsReady(x, z) {
  const S = G.chunk, out = [ensureRoads(x - 150, z - 150, x + 150, z + 150)];
  for (let cx = Math.floor((x - 330) / S); cx <= Math.floor((x + 330) / S); cx++) for (let cz = Math.floor((z - 330) / S); cz <= Math.floor((z + 330) / S); cz++) out.push(planChunk(cx, cz));
  return Promise.all(out);
}
const inPoly = (x, z, p) => { let c = false; for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) if ((p[i + 1] > z) !== (p[j + 1] > z) && x < ((p[j] - p[i]) * (z - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]) c = !c; return c; };
// shortcut: tests corners + edge midpoints of the building and corners + centre of the lot, so a thin wall crossing a lot without touching any of them survives
export function lotHits(L, rel, ox, oz) {
  const inL = (x, z) => { const dx = x - L.x, dz = z - L.z; return Math.abs(dx * L.fz - dz * L.fx) < L.hw && Math.abs(dx * L.fx + dz * L.fz) < L.hd; };
  for (let i = 0; i < rel.length; i += 2) { const j = (i + 2) % rel.length; if (inL(rel[i] + ox, rel[i + 1] + oz) || inL((rel[i] + rel[j]) / 2 + ox, (rel[i + 1] + rel[j + 1]) / 2 + oz)) return true; }
  return [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([a, f]) => inPoly(L.x + L.fz * a * L.hw + L.fx * f * L.hd - ox, L.z - L.fx * a * L.hw + L.fz * f * L.hd - oz, rel));
}
// the tiles clearLots checks a lot against (their centre within TILE / 2 + 30 m of the lot's centre)
export const lotNear = (L, ox, oz) => Math.abs(L.x - ox - TILE / 2) < TILE / 2 + 30 && Math.abs(L.z - oz - TILE / 2) < TILE / 2 + 30;
function clearLots(b, ox, oz) {
  const near = (lots.list || lots.extra).filter((L) => lotNear(L, ox, oz));
  if (!near.length) return b;
  return b.filter((rec) => !near.some((L) => lotHits(L, rec[0], ox, oz)));
}

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
// Top of the building roof at (x, z), or -Infinity (for standing on roofs and landing helicopters).
export function roofAt(x, z) {
  const t = tiles.get(tileKey(Math.floor(x / TILE), Math.floor(z / TILE)));
  if (!t) return -Infinity;
  if (!t.bb) t.bb = t.b.map(([rel, y, h, , , , kind]) => { let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity; for (let i = 0; i < rel.length; i += 2) { a = Math.min(a, rel[i]); b = Math.max(b, rel[i]); c = Math.min(c, rel[i + 1]); d = Math.max(d, rel[i + 1]); } return [a + t.ox, b + t.ox, c + t.oz, d + t.oz, rel, y + h, kind || 0]; });
  let top = -Infinity;
  for (const [a, b, c, d, rel, h] of t.bb) {
    if (x < a || x > b || z < c || z > d || h < top) continue;
    let inside = false; const lx = x - t.ox, lz = z - t.oz;
    for (let i = 0, j = rel.length - 2; i < rel.length; j = i, i += 2) if ((rel[i + 1] > lz) !== (rel[j + 1] > lz) && lx < ((rel[j] - rel[i]) * (lz - rel[i + 1])) / (rel[j + 1] - rel[i + 1]) + rel[i]) inside = !inside;
    if (inside) top = h;
  }
  return top;
}
// The kind of building (see the bake: 1 = parking ramp) whose footprint contains (x, z), or -1.
export function buildingKindAt(x, z) {
  if (!isFinite(roofAt(x, z))) return -1;
  const t = tiles.get(tileKey(Math.floor(x / TILE), Math.floor(z / TILE)));
  for (const [a, b, c, d, rel, , kind] of t.bb) {
    if (x < a || x > b || z < c || z > d) continue;
    let inside = false; const lx = x - t.ox, lz = z - t.oz;
    for (let i = 0, j = rel.length - 2; i < rel.length; j = i, i += 2) if ((rel[i + 1] > lz) !== (rel[j + 1] > lz) && lx < ((rel[j] - rel[i]) * (lz - rel[i + 1])) / (rel[j + 1] - rel[i + 1]) + rel[i]) inside = !inside;
    if (inside) return kind;
  }
  return -1;
}
// What's under your feet when you're at height y: a roof you're standing on, else the ground.
export function surfaceHeight(x, z, y) {
  const g = groundHeight(x, z), r = roofAt(x, z);
  return r > g && r <= y + 0.7 && buildingKindAt(x, z) !== 1 ? r + 0.05 : g;
}
export function isLand(x, z) {
  if (terrainHeight(x, z) > WATER_Y + 0.05) return true;
  return bridgeDeck(x, z) !== null;
}
// Land you can't go on (across the river, Arsenal Island): treated as a cliff.
export const offMap = (x, z) => classAt(x, z) === C.offmap || !D.index || x < D.index.tx0 * TILE + 20 || x > (D.index.tx1 + 1) * TILE - 20 || z < D.index.tz0 * TILE + 20 || z > (D.index.tz1 + 1) * TILE - 20;

// ---------- districts + neighbourhoods ----------
const inRings = (x, z, rings) => { let c = false; for (const p of rings) for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) if ((p[i + 1] > z) !== (p[j + 1] > z) && x < ((p[j] - p[i]) * (z - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]) c = !c; return c; };
const townCache = new Map();
// The town whose limits contain (x, z) (index.towns, biggest first), or null out in the country. Cached per 100 m.
export function townAt(x, z) {
  if (!D.index) return null;
  const k = Math.floor(x / 100) * 100000 + Math.floor(z / 100);
  let t = townCache.get(k);
  if (t === undefined) {
    const cx = Math.floor(x / 100) * 100 + 50, cz = Math.floor(z / 100) * 100 + 50;
    t = D.index.towns.find((tw) => (tw.rings.length ? inRings(cx, cz, tw.rings) : Math.hypot(tw.x - cx, tw.z - cz) < tw.r)) || null;
    townCache.set(k, t);
  }
  return t;
}
// Davenport keeps its hand-drawn districts; other towns are 'town', the countryside 'rural' (same as tools/build-map.mjs).
export function district(x, z) {
  const t = townAt(x, z);
  if (t && t.name === 'Davenport') {
    if (x > 1500 && x < 3000 && z > -1000 && z < 300) return 'village';
    if (x > -1200 && x < 900 && z > -520 && z < 300) return 'downtown';
    if (z > -150 && Math.abs(x) < 4000) return 'riverfront';
    if (z < -3200) return 'north';
    if (x < -1200) return 'west';
    return 'hilltop';
  }
  return t ? 'town' : 'rural';
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
// Area name for the HUD: a neighbourhood (Davenport's list, then OSM's), else the town, else the county.
export function hoodAt(x, z) {
  const t = townAt(x, z);
  let best = null, bd = Infinity;
  if (!t || t.name === 'Davenport') for (const h of HOODS) { const d = Math.hypot(h.x - x, h.z - z) / h.r; if (d < bd) { bd = d; best = h; } }
  if (best && bd < 2.2) return best.name;
  best = null; bd = Infinity;
  for (const h of D.index?.hoods || []) { const d = Math.hypot(h.x - x, h.z - z) / h.r; if (d < bd) { bd = d; best = h; } }
  if (best && bd < 1) return best.name;
  if (t) return t.name;
  const c = (D.index?.counties || []).find((co) => inRings(x, z, co.rings));
  return c ? (/County/.test(c.name) ? c.name : c.name + ' County') : 'Quad Cities';
}

// ---------- road graph ----------
// Nodes and edges have global ids (tiles list edge ids), but only the chunks near you are loaded:
// G.edges[id] is undefined until its chunk is in, G.adj[k] lists only loaded edges, G.list = the loaded edges.
export const G = { nodes: null, edges: [], adj: [], list: [], classes: [], bridges: [], grid: new Map(), chunk: 2000, chunkSet: new Set(), loadedChunks: new Map() };
const GCELL = 50;
const gkey = (i, j) => (i + 4096) * 8192 + (j + 4096);
const NO_EDGES = Object.freeze([]);
function initGraph(r) {
  G.classes = r.classes; G.chunk = r.chunk; G.chunkSet = new Set(r.chunks);
  const n = r.n;
  G.nodes = { n, x: new Float32Array(n), z: new Float32Array(n), y: new Float32Array(n), ctrl: new Uint8Array(n), closed: new Uint8Array(n) };
  G.adj = new Array(n).fill(NO_EDGES);
  G.edges = new Array(r.m);
}
const roadListeners = [];
export const onRoads = (fn) => roadListeners.push(fn); // fn(newEdges) after each chunk loads
function addChunk(r) {
  const N = G.nodes, added = [];
  for (let i = 0; i < r.n.length; i += 6) { const k = r.n[i]; if (G.adj[k] === NO_EDGES) { N.x[k] = r.n[i + 1]; N.z[k] = r.n[i + 2]; N.y[k] = r.n[i + 3]; N.ctrl[k] = r.n[i + 4]; N.closed[k] = r.n[i + 5]; G.adj[k] = []; } }
  for (const [id, a, b, cls, lf, lb, speed, name, bridge, width, flat, flags = 0, ref = '', layer = 0, turn = '', rise = 0] of r.e) {
    if (G.edges[id]) continue;
    const pts = Float32Array.from(flat), np = pts.length / 2, cum = new Float32Array(np);
    for (let i = 1; i < np; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
    let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
    for (let i = 0; i < np; i++) { minx = Math.min(minx, pts[i * 2]); maxx = Math.max(maxx, pts[i * 2]); minz = Math.min(minz, pts[i * 2 + 1]); maxz = Math.max(maxz, pts[i * 2 + 1]); }
    // flags: 1 tunnel, 2 brick/paving, 4 gravel/unpaved, 8 sidewalks both sides, 16 left only, 32 right only, 64 lit, 128 turn lanes,
    // 256 roundabout, 512 movable (swing) span, 1024 bike lane, 2048 kerb parking, 4096 median, 8192 toll. ref: "I 74", layer: OSM layer, turn: turn:lanes,
    // rise: metres a river span arches up at mid-span (edgeY)
    const e = { id, a, b, cls: G.classes[cls], ci: cls, lf, lb, speed, name: name || '', bridge: !!bridge, width, pts, cum, len: cum[np - 1], minx: minx - width, maxx: maxx + width, minz: minz - width, maxz: maxz + width, flags, ref, layer, turn, rise };
    G.edges[id] = e; G.list.push(e); added.push(e);
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
  }
  for (const fn of roadListeners) fn(added);
}
function loadChunk(key) {
  let p = G.loadedChunks.get(key);
  if (!p) {
    p = G.chunkSet.has(key) ? getJSON(`roads/${key}.json`).then(addChunk) : Promise.resolve();
    p.catch((e) => { console.warn('roads', key, e.message); G.loadedChunks.delete(key); });
    G.loadedChunks.set(key, p);
  }
  return p;
}
// Load every road chunk overlapping the box; resolves when they're all in.
export function ensureRoads(x0, z0, x1, z1) {
  const S = G.chunk, out = [];
  for (let cx = Math.floor(Math.min(x0, x1) / S); cx <= Math.floor(Math.max(x0, x1) / S); cx++) for (let cz = Math.floor(Math.min(z0, z1) / S); cz <= Math.floor(Math.max(z0, z1) / S); cz++) out.push(loadChunk(cx + '_' + cz));
  return Promise.all(out);
}
// Whether the road chunks round (x, z) are loaded.
export function roadsReady(x, z, r = 0) {
  const S = G.chunk;
  for (let cx = Math.floor((x - r) / S); cx <= Math.floor((x + r) / S); cx++) for (let cz = Math.floor((z - r) / S); cz <= Math.floor((z + r) / S); cz++) { const k = cx + '_' + cz; if (G.chunkSet.has(k) && !G.loadedChunks.has(k)) return false; }
  return true;
}
// Height of an edge at distance s along it (bridges ramp between their end heights).
function edgeY(e, s, x, z) {
  if (!e.bridge) return terrainHeight(x, z);
  const ya = G.nodes.y[e.a], yb = G.nodes.y[e.b], k = e.len ? s / e.len : 0;
  // gentle S-curve so decks don't kink at the ends; river spans arch up by e.rise at mid-span
  return ya + (yb - ya) * (k * k * (3 - 2 * k)) + (e.rise ? e.rise * 4 * k * (1 - k) : 0);
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
// Routes over the loaded road chunks; any chunks missing along the way start loading (callers re-route every few seconds,
// so a long trip across the region sorts itself out once they're in).
export function route(fx, fz, tx, tz, opts = {}) {
  const pad = Math.min(6000, 2500 + Math.hypot(tx - fx, tz - fz) * 0.3); // room for the detour to a bridge
  ensureRoads(Math.min(fx, tx) - pad, Math.min(fz, tz) - pad, Math.max(fx, tx) + pad, Math.max(fz, tz) + pad);
  const drivable = (e) => (e.cls !== 'service' && e.cls !== 'track') || e.len > 30;
  const A = nearestEdge(fx, fz, 120, drivable), B = nearestEdge(tx, tz, 300, drivable);
  if (!A || !B) return null;
  const N = G.nodes;
  // sparse A* state: only the nodes it touches
  const G0 = new Map(), CAME = new Map(), CE = new Map(), CLOSED = new Set();
  const g = { get: (k) => G0.get(k) ?? Infinity }, came = CAME, cameEdge = CE;
  const heap = [];
  const push = (node, f) => { heap.push([f, node]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const hx = (k) => Math.hypot(N.x[k] - B.x, N.z[k] - B.z);
  const cost = (e) => e.len / Math.max(5, e.speed) * (e.cls === 'service' ? 3 : 1); // seconds, roughly
  const start = (node, c) => { if (c < g.get(node)) { G0.set(node, c); push(node, c + hx(node) / 15); } };
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
    if (CLOSED.has(k)) continue; CLOSED.add(k);
    if (CLOSED.size > 200000) break;
    if (goal.has(k)) { reached = k; break; }
    for (const id of G.adj[k]) {
      const e = G.edges[id]; if (!opts.any && !canGo(e, k)) continue;
      const o = e.a === k ? e.b : e.a; if (CLOSED.has(o) || N.closed[o]) continue;
      const c = g.get(k) + cost(e);
      if (c < g.get(o)) { G0.set(o, c); came.set(o, k); cameEdge.set(o, id); push(o, c + hx(o) / 15); }
    }
  }
  if (reached < 0) return null;
  const chain = []; for (let k = reached; k !== undefined && k >= 0; k = came.get(k)) chain.push(k);
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
  for (let i = 1; i < chain.length; i++) { const e = G.edges[cameEdge.get(chain[i])]; addEdge(e, chain[i - 1]); out.push([N.x[chain[i]], N.z[chain[i]]]); }
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
    else e = G.list[Math.floor(rnd() * G.list.length)];
    if (!ok(e)) continue;
    const p = pointOnEdge(e, s ?? 6 + rnd() * (e.len - 12));
    if (!near && tries < 300 && !inPlay(p.x, p.z)) continue;
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
