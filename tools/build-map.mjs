// Turns the cached OpenStreetMap + elevation data into the game's streamed map data for the whole Quad Cities region.
// Run: cd tools && npm run fetch && npm run map      (needs ~3 GB of memory: the npm script raises Node's heap limit)
// Outputs (committed):
//   ../data/index.json            extent, towns, places, stations, POIs, Welcome signs, river crossings (loaded at startup)
//   ../data/overview.json         coarse 64 m terrain for the whole region, far-city boxes, major roads for the map (startup)
//   ../data/rail.json             rail lines (trains run on these) with their road crossings, and every track (startup)
//   ../data/roads/{cx}_{cz}.json  the road graph in 2 km chunks, loaded on demand (see src/city/data.js)
//   ../data/tiles/{tx}_{tz}.json  200 m tiles, loaded on demand (format below)
// Debug output (not committed): cache/preview.png
//
// ---------- tile format (data/tiles/{tx}_{tz}.json; x/z are metres relative to the tile's north-west corner) ----------
//   h   ground heights, 26x26 samples every 8 m (row-major, z then x), centimetres above the river:
//       a number = flat tile; "hd" (instead of h) = base64 bytes: int16 LE start value in 2 cm units, then 675 int8
//       deltas (2 cm units) in row order; a delta byte of -128 is followed by an absolute int16 LE value
//   c   ground class per 4 m cell, 50x50 (row-major) base64 bytes; "cr" (instead of c) = base64 run-length pairs [class, count]
//       classes (src/city/data.js C): 0 lawn 1 water 2 park 3 wood 4 parking 5 paved(retail/commercial) 6 industrial
//       7 cemetery 8 sand 9 road 10 walk 11 building 12 pitch 14 farmland 15 meadow 16 orchard 17 golf 18 railway
//       19 wetland 20 creek (stream bed) 21 pond (water above the river level) 22 residential 23 scrub 24 farmyard 25 quarry
//   b   buildings: [footprint [x,z,...], base y, height, pitched, style, name, kind, extra?]
//       extra: {id: OSM way id ('r' + id for relations), ms: 1 = a Microsoft footprint (no OSM tags), t: building type, l: levels, mh: min height, r: roof shape, rc: roof colour,
//       rm: roof material, m: wall material, co: wall colour, s: shop/amenity/office, a: "123 Main St", hn: house name}
//   t   trees [x, z, kind (0 broadleaf, 1 conifer, 2 street), scale*10] (OSM natural=tree first, then generated)
//   k   parking spots [x, z, heading, inLot]
//   e   ids of road-graph edges touching the tile (src/city/data.js G.edges[id], loaded with the tile's road chunk)
//   p   point features {key: [x, z, ...]}: lm street lamps, sg traffic signals, st stop signs, gw give way, cw crossings,
//       bs bus stops, bn benches, wb waste baskets, pb post boxes, hy fire hydrants, pp power poles, pt power towers,
//       fp flagpoles, bb billboards, lc rail level crossings, vm vending, dr drinking water, pl playgrounds,
//       pk parking entrances, sl silos / storage tanks (x, z, height), wt water towers (x, z, height), ch chimneys/masts (x, z, height)
//   l   lines {key: [[x, z, ...], ...]} clipped to the tile: fe fences, wa walls, he hedges, gr guard rails, rw retaining walls,
//       pw power lines, ps minor power lines, sr streams, dc ditches/drains, dw driveways, pa parking aisles, dt drive-throughs,
//       al alleys, fw footways/paths, cy cycleways, tk farm tracks (not in the graph), sv service roads cut off from the graph
//       (drawn as paved strips), tr tree rows, pi piers, rl rail tracks,
//       dm dams/weirs, kb kerbs/embankments
//   a   areas {key: [[x, z, ...], ...]} clipped to the tile: pk parking lots, fm farmland fields, or orchards, gf golf (fairway/green/bunker
//       as gf/gg/gb), ce cemeteries, pi pier decks, ap aeroway (runway ra / taxiway/apron aa)
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { BBOX, ORIGIN, TILE, ROAD_CHUNK, project } from './map-config.mjs';
import { roadIndex, inRing } from './road-clear.mjs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const OUT = process.env.MAP_OUT || here('../data/');
for (const d of ['tiles', 'roads']) { fs.rmSync(OUT + d, { recursive: true, force: true }); fs.mkdirSync(OUT + d, { recursive: true }); }
fs.rmSync(OUT + 'roads.json', { force: true });
const CHUNKS = process.env.MAP_CHUNKS || here('cache/chunks/');
// every element of one query, all chunks merged, duplicates (ways crossing a chunk edge) dropped
function readAll(name) {
  const seen = new Set(), out = [];
  for (const f of fs.readdirSync(CHUNKS).filter((f) => f === `${name}.json` || new RegExp(`^${name}_\\w+\\.json$`).test(f)).sort()) {
    for (const e of JSON.parse(fs.readFileSync(CHUNKS + f)).elements) { const k = e.type[0] + e.id; if (!seen.has(k)) { seen.add(k); out.push(e); } }
  }
  return out;
}
let seed = 12345;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const RIVER_LEVEL = 167.5; // nominal river surface; the local water-level field below puts every river at game y = 0
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const r1 = (v) => Math.round(v * 10) / 10;
const t0 = Date.now(); const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);

// ---------- extent & rasters ----------
const [X0] = project(ORIGIN.lat, BBOX.w), [X1] = project(ORIGIN.lat, BBOX.e);
const [, Z0] = project(BBOX.n, ORIGIN.lon), [, Z1] = project(BBOX.s, ORIGIN.lon);
const TX0 = Math.floor(X0 / TILE), TX1 = Math.ceil(X1 / TILE) - 1, TZ0 = Math.floor(Z0 / TILE), TZ1 = Math.ceil(Z1 / TILE) - 1;
const GX0 = TX0 * TILE, GZ0 = TZ0 * TILE, CELL = 4;
const GW = ((TX1 - TX0 + 1) * TILE) / CELL, GH = ((TZ1 - TZ0 + 1) * TILE) / CELL;
const HW = GW / 2 + 1, HH = GH / 2 + 1; // height nodes every 8 m, on tile corners
log(`extent ${((X1 - X0) / 1000).toFixed(1)} x ${((Z1 - Z0) / 1000).toFixed(1)} km, tiles ${TX1 - TX0 + 1}x${TZ1 - TZ0 + 1}, class raster ${GW}x${GH}`);
const cellOf = (x, z) => [Math.floor((x - GX0) / CELL), Math.floor((z - GZ0) / CELL)];
const inGrid = (i, j) => i >= 0 && j >= 0 && i < GW && j < GH;
const C = { lawn: 0, water: 1, park: 2, wood: 3, parking: 4, paved: 5, industrial: 6, cemetery: 7, sand: 8, road: 9, walk: 10, building: 11, pitch: 12, farm: 14, meadow: 15, orchard: 16, golf: 17, rail: 18, wetland: 19, creek: 20, pond: 21, residential: 22, scrub: 23, farmyard: 24, quarry: 25 };
const cls = new Uint8Array(GW * GH); // starts as lawn
const clsAt = (x, z) => { const [i, j] = cellOf(x, z); return inGrid(i, j) ? cls[j * GW + i] : C.water; };
const P = (g) => g.map((p) => project(p.lat, p.lon));

// even-odd scanline fill of a set of rings (outer + inner) into a grid; cb(k) per covered cell
function scan(rings, cell, gx0, gz0, gw, gh, cb) {
  const cr = rings.map((r) => r.map(([x, z]) => [(x - gx0) / cell, (z - gz0) / cell]));
  let minj = Infinity, maxj = -Infinity;
  for (const r of cr) for (const [, v] of r) { if (v < minj) minj = v; if (v > maxj) maxj = v; }
  for (let j = Math.max(0, Math.floor(minj)); j <= Math.min(gh - 1, Math.ceil(maxj)); j++) {
    const y = j + 0.5, xs = [];
    for (const cp of cr) for (let k = 0, l = cp.length - 1; k < cp.length; l = k++) { const [ax, ay] = cp[l], [bx, by] = cp[k]; if ((ay > y) !== (by > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax)); }
    xs.sort((a, b) => a - b);
    for (let q = 0; q + 1 < xs.length; q += 2) for (let i = Math.max(0, Math.ceil(xs[q] - 0.5)); i <= Math.min(gw - 1, Math.floor(xs[q + 1] - 0.5)); i++) cb(j * gw + i);
  }
}
const fillPoly = (rings, code, onlyIf) => scan(rings, CELL, GX0, GZ0, GW, GH, (k) => { if (!onlyIf || onlyIf(cls[k])) cls[k] = code; });
const pointInPoly = (x, z, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };
const bboxOf = (pl) => { let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity; for (const [x, z] of pl) { if (x < a) a = x; if (x > b) b = x; if (z < c) c = z; if (z > d) d = z; } return [a, b, c, d]; };
const ringArea = (r) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return a / 2; };
// multipolygon members -> closed rings (members come with full geometry: no bbox clipping)
function assembleRings(members) {
  const segs = members.filter((m) => m.geometry && m.geometry.length > 1 && m.geometry.every(Boolean)).map((m) => P(m.geometry));
  const rings = [];
  while (segs.length) {
    let ring = segs.shift(), guard = 0;
    while (guard++ < 5000) {
      const a = ring[0], b = ring[ring.length - 1];
      if (dist(a, b) < 0.5 && ring.length > 3) break;
      const k = segs.findIndex((s) => dist(s[0], b) < 0.5 || dist(s[s.length - 1], b) < 0.5);
      if (k < 0) break;
      let s = segs.splice(k, 1)[0];
      if (dist(s[0], b) > 0.5) s = s.slice().reverse();
      ring = ring.concat(s.slice(1));
    }
    if (ring.length > 3) rings.push(ring);
  }
  return rings;
}
const relRings = (e) => ({ outer: assembleRings(e.members.filter((m) => m.role !== 'inner')), inner: assembleRings(e.members.filter((m) => m.role === 'inner')) });
// Douglas-Peucker
function simplifyLine(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let md = 0, mi = -1;
    const [ax, az] = pts[a], [bx, bz] = pts[b], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    for (let i = a + 1; i < b; i++) { const t = Math.max(0, Math.min(1, ((pts[i][0] - ax) * dx + (pts[i][1] - az) * dz) / l2)); const d = Math.hypot(pts[i][0] - ax - dx * t, pts[i][1] - az - dz * t); if (d > md) { md = d; mi = i; } }
    if (md > tol) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// ---------- places, towns, counties ----------
const placesRaw = [...readAll('places'), ...readAll('towns'), ...readAll('counties')];
const towns = [], hoods = [], counties = [];
{
  const nodes = placesRaw.filter((e) => e.type === 'node' && e.tags && e.tags.place && e.tags.name);
  const rels = placesRaw.filter((e) => e.type === 'relation' && e.tags && e.tags.boundary === 'administrative' && e.tags.name);
  for (const r of rels) {
    const rings = relRings(r).outer.map((g) => simplifyLine(g, 15)).filter((g) => g.length > 3 && Math.abs(ringArea(g)) > 2e4);
    if (!rings.length) continue;
    if (r.tags.admin_level === '6') { counties.push({ name: r.tags.name, rings }); continue; }
    if (r.tags.admin_level !== '8') continue;
    const area = rings.reduce((a, g) => a + Math.abs(ringArea(g)), 0);
    let cx = 0, cz = 0, n = 0; for (const g of rings) for (const [x, z] of g) { cx += x; cz += z; n++; }
    const node = nodes.find((p) => p.tags.name === r.tags.name && ['city', 'town', 'village'].includes(p.tags.place));
    const [x, z] = node ? project(node.lat, node.lon) : [cx / n, cz / n];
    towns.push({ name: r.tags.name.replace(/^City of |^Village of /, ''), x: Math.round(x), z: Math.round(z), r: Math.round(Math.sqrt(area / Math.PI)), pop: +(r.tags.population || node?.tags.population || 0), place: node?.tags.place || 'town', rings });
  }
  // towns without a boundary relation (unincorporated places): just the node
  for (const p of nodes) if (['city', 'town', 'village', 'hamlet'].includes(p.tags.place) && !towns.some((t) => t.name === p.tags.name)) {
    const [x, z] = project(p.lat, p.lon);
    towns.push({ name: p.tags.name, x: Math.round(x), z: Math.round(z), r: p.tags.place === 'hamlet' ? 400 : 900, pop: +(p.tags.population || 0), place: p.tags.place, rings: [] });
  }
  for (const p of nodes) if (['suburb', 'neighbourhood', 'quarter', 'locality', 'island', 'islet'].includes(p.tags.place)) { const [x, z] = project(p.lat, p.lon); hoods.push({ name: p.tags.name, x: Math.round(x), z: Math.round(z), r: p.tags.place === 'suburb' ? 900 : p.tags.place === 'locality' ? 350 : 550 }); }
}
const [bx0, bz0] = [X0, Z0], inBox = (x, z) => x > bx0 && x < X1 && z > bz0 && z < Z1;
for (let i = towns.length - 1; i >= 0; i--) if (!inBox(towns[i].x, towns[i].z)) towns.splice(i, 1);
towns.sort((a, b) => b.pop - a.pop || b.r - a.r);
const townAt = (x, z) => towns.find((t) => t.rings.length ? t.rings.some((g) => pointInPoly(x, z, g)) : Math.hypot(t.x - x, t.z - z) < t.r) || null;
log(`towns: ${towns.map((t) => t.name).join(', ')}`);
log(`counties: ${counties.map((c) => c.name).join(', ')}, neighbourhoods ${hoods.length}`);

// ---------- districts ----------
// Davenport keeps its hand-drawn districts; other towns are 'town', the countryside 'rural' (src/city/data.js matches this)
const davenport = towns.find((t) => t.name === 'Davenport');
export function district(x, z) {
  const t = townAt(x, z);
  if (t && t === davenport) {
    if (x > 1500 && x < 3000 && z > -1000 && z < 300) return 'village';
    if (x > -1200 && x < 900 && z > -520 && z < 300) return 'downtown';
    if (z > -150 && Math.abs(x) < 4000) return 'riverfront';
    if (z < -3200) return 'north';
    if (x < -1200) return 'west';
    return 'hilltop';
  }
  return t ? 'town' : 'rural';
}
// cached per 200 m tile centre: point-in-polygon on town limits is slow
const distCache = new Map();
const districtFast = (x, z) => { const k = `${Math.floor(x / 100)},${Math.floor(z / 100)}`; let d = distCache.get(k); if (!d) distCache.set(k, (d = district(Math.floor(x / 100) * 100 + 50, Math.floor(z / 100) * 100 + 50))); return d; };

// ---------- elevation (8 m nodes) ----------
const Z = 14;
const tfiles = fs.readdirSync(here('cache/terrain')).map((f) => f.replace('.png', '').split('_').map(Number));
const ttx0 = Math.min(...tfiles.map((f) => f[1])), tty0 = Math.min(...tfiles.map((f) => f[2])), ttw = Math.max(...tfiles.map((f) => f[1])) - ttx0 + 1;
const tgrid = [];
for (const [, x, y] of tfiles) tgrid[(y - tty0) * ttw + (x - ttx0)] = PNG.sync.read(fs.readFileSync(here(`cache/terrain/${Z}_${x}_${y}.png`))).data;
const M_LAT = 110574, M_LON = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
const pxOf = (lon) => ((lon + 180) / 360) * 2 ** Z * 256;
const pyOf = (lat) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** Z * 256; };
const sampleDEM = (X, Y) => { const d = tgrid[(Math.floor(Y / 256) - tty0) * ttw + (Math.floor(X / 256) - ttx0)]; if (!d) return RIVER_LEVEL; const i = ((Math.floor(Y) & 255) * 256 + (Math.floor(X) & 255)) * 4; return d[i] * 256 + d[i + 1] + d[i + 2] / 256 - 32768; };
const demAt = (px, py) => { const fx = px - 0.5, fy = py - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0; return (sampleDEM(x0, y0) * (1 - ax) + sampleDEM(x0 + 1, y0) * ax) * (1 - ay) + (sampleDEM(x0, y0 + 1) * (1 - ax) + sampleDEM(x0 + 1, y0 + 1) * ax) * ay; };
const demXZ = (x, z) => demAt(pxOf(ORIGIN.lon + x / M_LON), pyOf(ORIGIN.lat - z / M_LAT));
let height = new Float32Array(HW * HH);
{
  const PX = new Float64Array(HW), PY = new Float64Array(HH);
  for (let i = 0; i < HW; i++) PX[i] = pxOf(ORIGIN.lon + (GX0 + i * 8) / M_LON);
  for (let j = 0; j < HH; j++) PY[j] = pyOf(ORIGIN.lat - (GZ0 + j * 8) / M_LAT);
  for (let j = 0; j < HH; j++) for (let i = 0; i < HW; i++) height[j * HW + i] = demAt(PX[i], PY[j]);
}
log('elevation sampled');

// ---------- water + land use ----------
const areasRaw = readAll('areas');
const isWater = (t) => t.natural === 'water' || t.waterway === 'riverbank' || t.waterway === 'dock' || t.landuse === 'reservoir' || t.landuse === 'basin' || (t.water && t.natural !== 'wetland');
const isRiver = (t) => t.waterway === 'riverbank' || /river|oxbow|canal|lock|stream/.test(t.water || '') || /Mississippi|Rock River|Slough|Sylvan|Lake Potter|Backwater/i.test(t.name || '');
function areaClass(t) {
  if (isWater(t)) return C.water;
  if (t.natural === 'wetland') return C.wetland;
  if (t.natural === 'wood' || t.landuse === 'forest') return C.wood;
  if (t.natural === 'scrub' || t.natural === 'heath') return C.scrub;
  if (t.leisure === 'golf_course' || t.golf) return C.golf;
  if (t.leisure === 'park' || t.leisure === 'garden' || t.landuse === 'recreation_ground' || t.leisure === 'playground' || t.landuse === 'village_green' || t.leisure === 'nature_reserve' || t.leisure === 'dog_park') return C.park;
  if (t.leisure === 'pitch' || t.leisure === 'track' || t.leisure === 'stadium' || t.leisure === 'sports_centre') return C.pitch;
  if (t.amenity === 'parking') return C.parking;
  if (t.landuse === 'cemetery' || t.amenity === 'grave_yard') return C.cemetery;
  if (t.landuse === 'commercial' || t.landuse === 'retail') return C.paved;
  if (t.landuse === 'industrial' || t.man_made === 'works') return C.industrial;
  if (t.landuse === 'railway') return C.rail;
  if (t.landuse === 'quarry' || t.landuse === 'landfill' || t.landuse === 'construction' || t.landuse === 'brownfield') return C.quarry;
  if (t.landuse === 'farmland') return C.farm;
  if (t.landuse === 'farmyard') return C.farmyard;
  if (t.landuse === 'orchard' || t.landuse === 'vineyard' || t.landuse === 'plant_nursery') return C.orchard;
  if (t.landuse === 'meadow' || t.natural === 'grassland' || t.landuse === 'grass' || t.landuse === 'greenfield') return C.meadow;
  if (t.landuse === 'residential') return C.residential;
  if (t.natural === 'sand' || t.natural === 'beach' || t.natural === 'bare_rock' || t.natural === 'shingle') return C.sand;
  if (t.aeroway === 'aerodrome' || t.aeroway === 'apron' || t.aeroway === 'runway' || t.aeroway === 'taxiway') return t.aeroway === 'aerodrome' ? C.meadow : C.paved;
  if (t.man_made === 'pier' || t.man_made === 'breakwater') return C.walk;
  return null;
}
const areaPolys = []; // {rings (outer + inner), outer, code, tags}
for (const e of areasRaw) {
  const t = e.tags || {}; const code = areaClass(t); if (code === null) continue;
  if (e.type === 'way' && e.geometry && e.geometry.length > 3 && dist(P([e.geometry[0]])[0], P([e.geometry[e.geometry.length - 1]])[0]) < 1) { const g = P(e.geometry); areaPolys.push({ rings: [g], outer: [g], code, tags: t }); }
  else if (e.type === 'relation' && e.members) { const { outer, inner } = relRings(e); if (outer.length) areaPolys.push({ rings: [...outer, ...inner], outer, code, tags: t }); }
}
log(`area polygons ${areaPolys.length}`);
// local water level: rivers sit at different heights (pool 14 above Lock & Dam 14, pool 15, pool 16 below Lock & Dam 15,
// the Rock River). Sample the hydro-flattened DEM on the river surfaces, spread it smoothly over the land, subtract.
const WC = 256, WW = Math.ceil((GW * CELL) / WC) + 1, WH = Math.ceil((GH * CELL) / WC) + 1;
const wl = new Float32Array(WW * WH), wn = new Float32Array(WW * WH);
{
  const SC = 32, SW = Math.ceil((GW * CELL) / SC), SH = Math.ceil((GH * CELL) / SC), samples = new Map();
  for (const a of areaPolys) if (a.code === C.water && (isRiver(a.tags) || a.outer.reduce((s, g) => s + Math.abs(ringArea(g)), 0) > 3e5)) {
    scan(a.rings, SC, GX0, GZ0, SW, SH, (k) => {
      const i = k % SW, j = (k / SW) | 0, x = GX0 + (i + 0.5) * SC, z = GZ0 + (j + 0.5) * SC, b = Math.floor((x - GX0) / WC + 0.5) + Math.floor((z - GZ0) / WC + 0.5) * WW;
      let arr = samples.get(b); if (!arr) samples.set(b, (arr = [])); arr.push(demXZ(x, z));
    });
  }
  for (const [b, arr] of samples) { arr.sort((p, q) => p - q); wl[b] = arr[Math.floor(arr.length * 0.3)]; wn[b] = 1; }
  // fill the rest by diffusion, then smooth
  let mean = 0, cnt = 0; for (let k = 0; k < wl.length; k++) if (wn[k]) { mean += wl[k]; cnt++; }
  mean = cnt ? mean / cnt : RIVER_LEVEL;
  for (let k = 0; k < wl.length; k++) if (!wn[k]) wl[k] = mean;
  for (let it = 0; it < 600; it++) for (let j = 0; j < WH; j++) for (let i = 0; i < WW; i++) {
    const k = j * WW + i; if (wn[k]) continue;
    let s = 0, n = 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < WW && jj < WH) { s += wl[jj * WW + ii]; n++; } }
    wl[k] = s / n;
  }
  for (let p = 0; p < 2; p++) { const b = wl.slice(); for (let j = 0; j < WH; j++) for (let i = 0; i < WW; i++) { let s = 0, n = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < WW && jj < WH) { s += b[jj * WW + ii]; n++; } } wl[j * WW + i] = s / n; } }
  log(`water level field: ${cnt} river blocks, ${Math.min(...wl).toFixed(1)}..${Math.max(...wl).toFixed(1)} m`);
}
const waterLevel = (x, z) => { const fx = (x - GX0) / WC, fz = (z - GZ0) / WC, i = Math.max(0, Math.min(WW - 2, Math.floor(fx))), j = Math.max(0, Math.min(WH - 2, Math.floor(fz))), ax = Math.min(1, Math.max(0, fx - i)), az = Math.min(1, Math.max(0, fz - j)); return (wl[j * WW + i] * (1 - ax) + wl[j * WW + i + 1] * ax) * (1 - az) + (wl[(j + 1) * WW + i] * (1 - ax) + wl[(j + 1) * WW + i + 1] * ax) * az; };
for (let j = 0; j < HH; j++) for (let i = 0; i < HW; i++) height[j * HW + i] -= waterLevel(GX0 + i * 8, GZ0 + j * 8);
// paint order: big land use first, then parks, woods, parking, pitches, water on top
const order = [C.farm, C.meadow, C.residential, C.farmyard, C.orchard, C.industrial, C.rail, C.quarry, C.paved, C.cemetery, C.golf, C.scrub, C.sand, C.park, C.wetland, C.wood, C.pitch, C.parking, C.walk, C.water];
areaPolys.sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));
for (const a of areaPolys) {
  if (a.code !== C.water) { fillPoly(a.rings, a.code); continue; }
  // water: rivers and ponds at the river's level are real water; ponds up on the land keep their height (class pond)
  let lo = Infinity; for (const g of a.outer) for (let i = 0; i < g.length; i += Math.max(1, g.length >> 4)) lo = Math.min(lo, demXZ(g[i][0], g[i][1]) - waterLevel(g[i][0], g[i][1]));
  fillPoly(a.rings, isRiver(a.tags) || lo < 2.5 ? C.water : C.pond);
}
// the countryside OSM leaves untagged is crop fields here (corn and soybeans): out of town, plain lawn becomes farmland
for (let j = 0; j < GH; j += 25) for (let i = 0; i < GW; i += 25) {
  if (districtFast(GX0 + i * CELL + 50, GZ0 + j * CELL + 50) !== 'rural') continue;
  for (let jj = j; jj < Math.min(GH, j + 25); jj++) for (let ii = i; ii < Math.min(GW, i + 25); ii++) { const k = jj * GW + ii; if (cls[k] === C.lawn) cls[k] = C.farm; }
}
log('land use painted');
// node heights: water nodes (2+ of the 4 cells round them are water) drop to the river bed, land is smoothed and kept above the water
{
  const wet = new Uint8Array(HW * HH);
  for (let j = 0; j < HH; j++) for (let i = 0; i < HW; i++) { let n = 0; for (const [di, dj] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) { const ii = i * 2 + di, jj = j * 2 + dj; if (inGrid(ii, jj) && cls[jj * GW + ii] === C.water) n++; } wet[j * HW + i] = n >= 2 ? 1 : 0; }
  const b = new Float32Array(HW * HH);
  for (let j = 0; j < HH; j++) for (let i = 0; i < HW; i++) { let s = 0, n = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < HW && jj < HH) { s += height[jj * HW + ii]; n++; } } b[j * HW + i] = s / n; }
  for (let k = 0; k < HW * HH; k++) height[k] = wet[k] ? -3 : Math.max(1.0, b[k]);
}
const heightAt = (x, z) => {
  const fx = (x - GX0) / 8, fz = (z - GZ0) / 8, i = Math.max(0, Math.min(HW - 2, Math.floor(fx))), j = Math.max(0, Math.min(HH - 2, Math.floor(fz)));
  const ax = Math.min(1, Math.max(0, fx - i)), az = Math.min(1, Math.max(0, fz - j)), h = (ii, jj) => height[jj * HW + ii];
  return (h(i, j) * (1 - ax) + h(i + 1, j) * ax) * (1 - az) + (h(i, j + 1) * (1 - ax) + h(i + 1, j + 1) * ax) * az;
};
log('heights done');

// ---------- roads ----------
const DRIVE = { motorway: 'motor', motorway_link: 'motor', trunk: 'trunk', trunk_link: 'trunk', primary: 'primary', primary_link: 'primary', secondary: 'secondary', secondary_link: 'secondary', tertiary: 'tertiary', tertiary_link: 'tertiary', unclassified: 'minor', road: 'minor', residential: 'residential', living_street: 'residential', service: 'service', track: 'track', busway: 'service' };
const CLASSES = ['motor', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'residential', 'service', 'track']; // index order is the data format: only append
const WIDTH = { motor: 15, trunk: 14, primary: 13, secondary: 11, tertiary: 9.5, minor: 7.5, residential: 8, service: 4.6, track: 3.6 };
const SPEED = { motor: 29, trunk: 24.6, primary: 15.6, secondary: 13.4, tertiary: 12, minor: 15.6, residential: 11, service: 6, track: 8 };
const roadsRaw = readAll('roads');
const roadWays = [], lineFeat = []; // lineFeat: {key, pts} drawn in tiles (not in the graph)
const SURF = { paving_stones: 2, sett: 2, cobblestone: 2, brick: 2, bricks: 2, gravel: 4, fine_gravel: 4, compacted: 4, dirt: 4, ground: 4, unpaved: 4, grass: 4, earth: 4, pebblestone: 4, mud: 4, sand: 4 };
for (const e of roadsRaw) {
  const t = e.tags || {};
  if (!e.geometry || e.geometry.length < 2) continue;
  if (t.railway) { if (!t.highway) continue; }
  const cl = DRIVE[t.highway];
  const svc = t.service;
  if (!cl) {
    if (['footway', 'path', 'pedestrian', 'steps', 'bridleway'].includes(t.highway) && t.footway !== 'sidewalk') lineFeat.push({ key: 'fw', pts: P(e.geometry) });
    else if (t.highway === 'cycleway') lineFeat.push({ key: 'cy', pts: P(e.geometry) });
    continue;
  }
  if (t.area === 'yes' || t.access === 'no' || t.motor_vehicle === 'no' || t.highway === 'construction') continue;
  // drawn in the tile but kept out of the graph: driveways, parking aisles, drive-throughs, private service lanes, farm tracks off the network
  if (cl === 'service' && (svc === 'parking_aisle' || svc === 'driveway' || svc === 'drive-through' || t.access === 'private')) { lineFeat.push({ key: svc === 'parking_aisle' ? 'pa' : svc === 'drive-through' ? 'dt' : 'dw', pts: P(e.geometry) }); continue; }
  if (cl === 'track' && (t.access === 'private' || t.tracktype === 'grade5')) { lineFeat.push({ key: 'tk', pts: P(e.geometry) }); continue; }
  if (cl === 'service' && svc === 'alley') lineFeat.push({ key: 'al', pts: P(e.geometry) });
  roadWays.push({ id: e.id, nodes: e.geometry.map((g) => `${g.lat.toFixed(7)},${g.lon.toFixed(7)}`), pts: P(e.geometry), cl, t });
}
log(`road ways ${roadWays.length}, path/line features ${lineFeat.length}`);
const use = new Map();
for (const w of roadWays) w.nodes.forEach((n, i) => use.set(n, (use.get(n) || 0) + (i === 0 || i === w.nodes.length - 1 ? 2 : 1)));
const nodeIdx = new Map(), nodes = [];
const getNode = (osm, x, z) => { if (!nodeIdx.has(osm)) { nodeIdx.set(osm, nodes.length); nodes.push({ x, z, osm, ctrl: 0, deg: 0 }); } return nodeIdx.get(osm); };
let edges = [];
// ramps: every *_link, plus short unnamed highway=motorway pieces that touch a link or trunk (mis-tagged ramps:
// they came out as 2-lane, 10 m motorway and overlapped at interchanges like I-88 exit 6). Untagged ramps get 1 lane.
{
  const touch = new Map(); // osm node -> highway types of the ways ending there
  for (const w of roadWays) for (const n of [w.nodes[0], w.nodes[w.nodes.length - 1]]) { if (!touch.has(n)) touch.set(n, []); touch.get(n).push(w.t.highway); }
  for (const w of roadWays) {
    const hw = w.t.highway;
    if (/_link$/.test(hw)) { w.ramp = true; continue; }
    if (hw !== 'motorway' || w.t.name || w.t.lanes) continue;
    let L = 0; for (let i = 1; i < w.pts.length; i++) L += dist(w.pts[i], w.pts[i - 1]);
    if (L < 700 && [w.nodes[0], w.nodes[w.nodes.length - 1]].some((n) => touch.get(n).some((h) => /_link$|^trunk$/.test(h)))) w.ramp = true;
  }
}
const parseWidth = (v) => { if (!v) return 0; const n = parseFloat(v); return /ft|'/.test(v) ? n * 0.3048 : n || 0; };
for (const w of roadWays) {
  let start = 0;
  for (let i = 1; i < w.nodes.length; i++) {
    if (i === w.nodes.length - 1 || use.get(w.nodes[i]) > 1) {
      const pts = w.pts.slice(start, i + 1), a = getNode(w.nodes[start], ...w.pts[start]), b = getNode(w.nodes[i], ...w.pts[i]), t = w.t;
      let oneway = t.oneway === 'yes' || t.oneway === '1' || t.oneway === 'true' || t.highway === 'motorway' || /_link$/.test(t.highway) && t.oneway !== 'no' && (w.cl === 'motor' || w.cl === 'trunk') || t.junction === 'roundabout' ? 1 : t.oneway === '-1' ? -1 : 0;
      let A = a, B = b, PTS = pts;
      if (oneway === -1) { A = b; B = a; PTS = pts.slice().reverse(); oneway = 1; }
      const lanesTotal = +t.lanes || (oneway ? (w.ramp ? 1 : w.cl === 'primary' || w.cl === 'trunk' || w.cl === 'motor' ? 2 : 1) : w.cl === 'primary' || w.cl === 'trunk' ? 4 : w.cl === 'track' ? 1 : 2);
      const lf = oneway ? lanesTotal : Math.max(1, +t['lanes:forward'] || Math.ceil(lanesTotal / 2));
      const lb = oneway ? 0 : w.cl === 'track' ? 1 : Math.max(1, +t['lanes:backward'] || Math.floor(lanesTotal / 2) || 1);
      const ms = t.maxspeed ? parseFloat(t.maxspeed) * (t.maxspeed.includes('mph') || !t.maxspeed.match(/km/) ? 0.447 : 0.2778) : SPEED[w.cl];
      const lw = Math.min(3.6, Math.max(3, WIDTH[w.cl] / Math.max(2, lf + lb)));
      const sw = t.sidewalk || t['sidewalk:both'] || '';
      const flags = (t.tunnel === 'yes' || t.tunnel === 'building_passage' ? 1 : 0) | (SURF[t.surface] || 0) | (sw === 'both' || sw === 'yes' ? 8 : sw === 'left' ? 16 : sw === 'right' ? 32 : 0) | (t.lit === 'yes' ? 64 : 0)
        | (t['turn:lanes'] || t['turn:lanes:forward'] || t['turn:lanes:backward'] ? 128 : 0) | (t.junction === 'roundabout' ? 256 : 0) | (t['bridge:movable'] || t.bridge === 'movable' ? 512 : 0)
        | (t.cycleway && t.cycleway !== 'no' ? 1024 : 0) | (t['parking:lane:both'] || t['parking:both'] || t['parking:lane:right'] || t['parking:right'] ? 2048 : 0) | (t.median || t.dual_carriageway === 'yes' ? 4096 : 0) | (t.toll === 'yes' ? 8192 : 0);
      // one carriageway of a divided road or a ramp: its lanes plus shoulders, not the class's two-way width (15 m motorway
      // ramps overlapped everything at the interchanges)
      const shoulder = w.cl === 'motor' || w.cl === 'trunk' ? 3 : w.cl === 'primary' || w.cl === 'secondary' ? 1.2 : 0.6;
      // a tagged width on a one-way carriageway is often the whole divided road: cap it at its own lanes plus shoulders
      const width = oneway ? Math.min(parseWidth(t.width) || Infinity, Math.max(4.5, lf * (parseWidth(t.width) ? 3.4 : lw) + shoulder))
        : parseWidth(t.width) || Math.max(WIDTH[w.cl], (lf + lb) * lw + (w.cl === 'residential' ? 2 : 0));
      edges.push({ a: A, b: B, pts: PTS, cl: w.cl, lf, lb, speed: Math.min(ms || SPEED[w.cl], 33), name: t.name || '', ref: t.ref || '', bridge: t.bridge && t.bridge !== 'no' ? 1 : 0, layer: +t.layer || 0, width: r1(width), flags, turn: t['turn:lanes'] || t['turn:lanes:forward'] || '' });
      start = i;
    }
  }
}
// E 53rd St, Brady to Elmore: 4 lanes plus a centre turn lane (2+2, ~17.5 m); OSM has it as a plain 2-lane road
for (const e of edges) {
  if (e.name !== 'East 53rd Street' || e.lb === 0) continue;
  const xs = e.pts.map((p) => p[0]), zs = e.pts.map((p) => p[1]);
  if (Math.min(...xs) >= 830 && Math.max(...xs) <= 3515 && Math.min(...zs) > -5700 && Math.max(...zs) < -5600) { e.lf = 2; e.lb = 2; e.width = 17.5; e.flags |= 128; }
}
// two one-way carriageways of the same road closer than their widths (River Drive downtown: 10 m apart, tagged 14-17 m):
// cap each at the separation and drop lanes to fit
{
  const ow = edges.filter((e) => e.lb === 0 && (e.name || e.ref)), G = 40, grid = new Map();
  const key = (x, z) => `${Math.floor(x / G)},${Math.floor(z / G)}`;
  for (const e of ow) for (const p of e.pts) { const k = key(p[0], p[1]); if (!grid.has(k)) grid.set(k, new Set()); grid.get(k).add(e); }
  const near = (f, x, z, dx, dz) => { // distance from (x,z) to f, if f runs the opposite way there
    let best = Infinity, dot = 0;
    for (let i = 1; i < f.pts.length; i++) {
      const [ax, az] = f.pts[i - 1], [bx, bz] = f.pts[i], sx = bx - ax, sz = bz - az, L2 = sx * sx + sz * sz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * sx + (z - az) * sz) / L2)), d = Math.hypot(ax + sx * t - x, az + sz * t - z);
      if (d < best) { best = d; dot = (sx * dx + sz * dz) / Math.sqrt(L2); }
    }
    return dot < -0.7 ? best : Infinity;
  };
  let capped = 0;
  for (const e of ow) {
    let sep = Infinity;
    for (let i = 1; i < e.pts.length; i++) {
      const [ax, az] = e.pts[i - 1], [bx, bz] = e.pts[i], L = Math.hypot(bx - ax, bz - az);
      if (L < 1) continue;
      for (let s = 5; s < L - 5; s += 10) { // samples along the edge, skipping the ends where carriageways merge
        const x = ax + (bx - ax) * s / L, z = az + (bz - az) * s / L, cand = new Set();
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (const f of grid.get(`${Math.floor(x / G) + di},${Math.floor(z / G) + dj}`) || []) cand.add(f);
        for (const f of cand) if (f !== e && (f.name === e.name || (f.ref && f.ref === e.ref))) { const d = near(f, x, z, (bx - ax) / L, (bz - az) / L); if (d > 5) sep = Math.min(sep, d); }
      }
    }
    if (e.width > sep - 0.6) { e.width = r1(Math.max(4.5, sep - 0.6)); e.lf = Math.max(1, Math.min(e.lf, Math.floor(e.width / 3.2))); capped++; }
  }
  log(`one-way carriageways capped to their separation: ${capped}`);
}
// drop tiny disconnected bits (keep every network longer than 400 m: towns, Arsenal Island, farm loops)
const elen = (e) => { let l = 0; for (let i = 1; i < e.pts.length; i++) l += dist(e.pts[i], e.pts[i - 1]); return l; };
{
  const adj = nodes.map(() => []);
  edges.forEach((e, i) => { adj[e.a].push(i); adj[e.b].push(i); });
  const comp = new Int32Array(nodes.length).fill(-1), compLen = []; let c = 0;
  for (let s = 0; s < nodes.length; s++) {
    if (comp[s] >= 0 || !adj[s].length) continue;
    const st = [s]; comp[s] = c; let L = 0;
    while (st.length) { const k = st.pop(); for (const ei of adj[k]) { const e = edges[ei], o = e.a === k ? e.b : e.a; if (e.a === k) L += elen(e); if (comp[o] < 0) { comp[o] = c; st.push(o); } } }
    compLen.push(L); c++;
  }
  // the dropped bits are mostly service roads that reach the network only through parking aisles: still drawn, as paved strips
  for (const e of edges) if (compLen[comp[e.a]] <= 400 && elen(e) > 15) lineFeat.push({ key: e.cl === 'track' ? 'tk' : 'sv', pts: e.pts });
  edges = edges.filter((e) => compLen[comp[e.a]] > 400);
}
// roads over water: a through road that isn't tagged as a bridge but crosses water cells (a causeway or a levee road the
// water polygon overlaps) would sit on the river bed (-3 m), under the water plane and invisible. The 8 m height nodes
// under it and PAD m beside it come up to LIFT m over the river. Service roads and tracks are left alone (boat ramps go
// into the water on purpose). scan-river-roads.mjs --write does the same to a built data/ folder.
{
  const LIFT = 0.3, PAD = 3; let n = 0;
  for (const e of edges) {
    if (e.bridge || e.flags & 1 || e.cl === 'service' || e.cl === 'track') continue;
    const r = e.width / 2 + PAD;
    for (let k = 1; k < e.pts.length; k++) {
      const [ax, az] = e.pts[k - 1], [bx, bz] = e.pts[k], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
      for (let gx = Math.floor((Math.min(ax, bx) - r - GX0) / 8); gx <= Math.ceil((Math.max(ax, bx) + r - GX0) / 8); gx++) for (let gz = Math.floor((Math.min(az, bz) - r - GZ0) / 8); gz <= Math.ceil((Math.max(az, bz) + r - GZ0) / 8); gz++) {
        if (gx < 0 || gz < 0 || gx >= HW || gz >= HH || height[gz * HW + gx] >= LIFT) continue;
        const x = GX0 + gx * 8, z = GZ0 + gz * 8, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
        if (Math.hypot(ax + dx * t - x, az + dz * t - z) <= r) { height[gz * HW + gx] = LIFT; n++; }
      }
    }
  }
  log(`roads over water: ${n} height nodes lifted under causeways and levee roads`);
}
const used = new Map(), nodes2 = [];
for (const e of edges) for (const k of ['a', 'b']) { if (!used.has(e[k])) { used.set(e[k], nodes2.length); nodes2.push(nodes[e[k]]); } e[k] = used.get(e[k]); }
for (const e of edges) { nodes2[e.a].deg++; nodes2[e.b].deg++; }
// node heights: terrain; nodes only on bridges get the deck height, relaxed between the bridge's abutments, at least 9-16 m over water
{
  const bridgeOnly = nodes2.map(() => true), badj = nodes2.map(() => []);
  edges.forEach((e) => { for (const k of ['a', 'b']) { if (!e.bridge) bridgeOnly[e[k]] = false; else badj[e[k]].push(e); } });
  for (const n of nodes2) n.y = heightAt(n.x, n.z);
  const free = nodes2.map((n, i) => bridgeOnly[i] && badj[i].length);
  for (let it = 0; it < 400; it++) nodes2.forEach((n, i) => {
    if (!free[i]) return;
    let s = 0, w = 0; for (const e of badj[i]) { const o = nodes2[e.a === i ? e.b : e.a], l = Math.max(5, elen(e)); s += o.y / l; w += 1 / l; }
    n.y = s / w;
  });
  nodes2.forEach((n, i) => { if (free[i] && clsAt(n.x, n.z) === C.water) n.y = Math.max(n.y, badj[i].some((e) => e.cl === 'motor') ? 16 : 10); });
  // a short creek bridge whose ends sit in water cells would ramp down under the river: its ends stay 0.3 m over it
  nodes2.forEach((n, i) => { if (badj[i].some((e) => e.cl !== 'service' && e.cl !== 'track')) n.y = Math.max(n.y, 0.3); });
}
// bridge edges over water arch up between their ends (edge.rise: extra metres at mid-span, a parabola; src/city/data.js edgeY)
for (const e of edges) {
  e.rise = 0; if (!e.bridge) continue;
  const ya = nodes2[e.a].y, yb = nodes2[e.b].y, L = elen(e), clear = /Government/i.test(e.name) ? 8 : e.cl === 'motor' ? 18 : e.cl === 'trunk' || e.cl === 'primary' ? 13 : 7;
  let acc = 0;
  for (let i = 1; i < e.pts.length; i++) {
    const d = dist(e.pts[i], e.pts[i - 1]);
    for (let s2 = 0; s2 < d; s2 += 8) {
      const t = (acc + s2) / L, x = e.pts[i - 1][0] + (e.pts[i][0] - e.pts[i - 1][0]) * s2 / d, z = e.pts[i - 1][1] + (e.pts[i][1] - e.pts[i - 1][1]) * s2 / d;
      if (heightAt(x, z) > -1 || t < 0.15 || t > 0.85) continue; // the ends can't lift: interior bridge nodes already sit high
      const base = ya + (yb - ya) * t * t * (3 - 2 * t), need = clear - base;
      if (need > 0) e.rise = Math.max(e.rise, Math.min(15, 0.08 * L, need / Math.max(0.51, 4 * t * (1 - t)))); // short spans stay low (a 15 m hump over 80 m is a ramp)
    }
    acc += d;
  }
  e.rise = r1(e.rise);
}
// overpasses: a bridge that crosses another road (no shared node, so grade-separated) clears it by 5.5 m; the deck's
// mid-span lift (rise) grows where the abutment heights alone would leave it on top of the road below
{
  const SG = 60, sgrid = new Map();
  edges.forEach((e, i) => { if (e.flags & 1) return; for (let k = 1; k < e.pts.length; k++) { const [ax, az] = e.pts[k - 1], [bx, bz] = e.pts[k]; for (let gx = Math.floor(Math.min(ax, bx) / SG); gx <= Math.floor(Math.max(ax, bx) / SG); gx++) for (let gz = Math.floor(Math.min(az, bz) / SG); gz <= Math.floor(Math.max(az, bz) / SG); gz++) { const key = gx * 100000 + gz; let a = sgrid.get(key); if (!a) sgrid.set(key, (a = [])); a.push(i, k); } } });
  const yAt = (e, t) => { const ya = nodes2[e.a].y, yb = nodes2[e.b].y; return e.bridge ? ya + (yb - ya) * t * t * (3 - 2 * t) + e.rise * 4 * t * (1 - t) : null; };
  let raised = 0;
  edges.forEach((e, i) => {
    if (!e.bridge) return;
    const L = elen(e); let acc = 0;
    for (let k = 1; k < e.pts.length; k++) {
      const [ax, az] = e.pts[k - 1], [bx, bz] = e.pts[k], sl = dist(e.pts[k - 1], e.pts[k]), seen = new Set();
      for (let gx = Math.floor(Math.min(ax, bx) / SG); gx <= Math.floor(Math.max(ax, bx) / SG); gx++) for (let gz = Math.floor(Math.min(az, bz) / SG); gz <= Math.floor(Math.max(az, bz) / SG); gz++) {
        const a = sgrid.get(gx * 100000 + gz) || [];
        for (let q = 0; q < a.length; q += 2) {
          const j = a[q], kk = a[q + 1], o = edges[j]; if (j === i || seen.has(j * 4096 + kk) || o.a === e.a || o.a === e.b || o.b === e.a || o.b === e.b) continue;
          seen.add(j * 4096 + kk);
          if (o.bridge && (o.layer || 1) >= (e.layer || 1)) continue; // the other one is the upper deck (or the same level)
          const [cx, cz] = o.pts[kk - 1], [dx, dz] = o.pts[kk], den = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx); if (Math.abs(den) < 1e-9) continue;
          const u = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / den, v = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / den;
          if (u < 0 || u > 1 || v < 0 || v > 1) continue;
          const t = (acc + u * sl) / L; if (t < 0.06 || t > 0.94) continue;
          let oy = heightAt(ax + (bx - ax) * u, az + (bz - az) * u);
          if (o.bridge) { let oacc = 0; for (let m = 1; m < kk; m++) oacc += dist(o.pts[m - 1], o.pts[m]); oy = yAt(o, (oacc + v * dist(o.pts[kk - 1], o.pts[kk])) / elen(o)); }
          const need = oy + 5.5 - yAt(e, t);
          if (need > 0.2) { e.rise = r1(Math.min(12, e.rise + need / (4 * t * (1 - t)))); raised++; }
        }
      }
      acc += sl;
    }
  });
  log(`overpass decks raised to clear the road below: ${raised}`);
}
// node lookup grid
const NG = 40, ngrid = new Map();
nodes2.forEach((n, i) => { const k = `${Math.floor(n.x / NG)},${Math.floor(n.z / NG)}`; let a = ngrid.get(k); if (!a) ngrid.set(k, (a = [])); a.push(i); });
const nearestNode = (x, z, r, ok = (n) => n.deg >= 3) => { let best = -1, bd = r; const ci = Math.floor(x / NG), cj = Math.floor(z / NG), rr = Math.ceil(r / NG); for (let dj = -rr; dj <= rr; dj++) for (let di = -rr; di <= rr; di++) for (const i of ngrid.get(`${ci + di},${cj + dj}`) || []) { if (!ok(nodes2[i])) continue; const d = Math.hypot(nodes2[i].x - x, nodes2[i].z - z); if (d < bd) { bd = d; best = i; } } return best; };
// ---------- point features ----------
const pts = readAll('points');
let signals = 0, stops = 0;
for (const p of pts) {
  if (p.type !== 'node' || !p.tags || !p.tags.highway) continue;
  const [x, z] = project(p.lat, p.lon);
  if (p.tags.highway === 'traffic_signals') { const k = nearestNode(x, z, 25); if (k >= 0 && nodes2[k].ctrl !== 1) { nodes2[k].ctrl = 1; signals++; } }
  if (p.tags.highway === 'stop') { const k = nearestNode(x, z, 22); if (k >= 0 && nodes2[k].ctrl === 0) { nodes2[k].ctrl = 2; stops++; } }
}
// unmarked crossings of small roads in town: 4-way stops so traffic takes turns (country crossroads stay open)
for (const n of nodes2) if (n.deg >= 4 && n.ctrl === 0 && districtFast(n.x, n.z) !== 'rural') { n.ctrl = 2; stops++; }
log(`graph: ${nodes2.length} nodes, ${edges.length} edges, signals ${signals}, stops ${stops}`);

// raster: roads + sidewalks (towns only), lines: creeks, rail beds
function strokeLine(pl, width, code, onlyIf) {
  for (let i = 1; i < pl.length; i++) {
    const [ax, az] = pl[i - 1], [bx, bz] = pl[i], len = Math.hypot(bx - ax, bz - az), steps = Math.ceil(len / (CELL * 0.5));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, x = ax + (bx - ax) * t, z = az + (bz - az) * t, r = Math.ceil(width / 2 / CELL), [ci, cj] = cellOf(x, z);
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        const ii = ci + di, jj = cj + dj; if (!inGrid(ii, jj)) continue;
        if (Math.hypot(GX0 + (ii + 0.5) * CELL - x, GZ0 + (jj + 0.5) * CELL - z) <= width / 2) { const k = jj * GW + ii; if (!onlyIf || onlyIf(cls[k])) cls[k] = code; }
      }
    }
  }
}
const linesRaw = readAll('lines');
for (const e of linesRaw) {
  const t = e.tags || {}; if (!e.geometry || e.geometry.length < 2) continue;
  const g = P(e.geometry);
  if (t.waterway === 'river' || t.waterway === 'canal') strokeLine(g, parseWidth(t.width) || 12, C.water, (c) => c !== C.water && c !== C.pond);
  else if (t.waterway === 'stream') strokeLine(g, parseWidth(t.width) || 4, C.creek, (c) => c !== C.water);
}
for (const e of edges) if (!['service', 'motor', 'track'].includes(e.cl) && districtFast(e.pts[0][0], e.pts[0][1]) !== 'rural') strokeLine(e.pts, e.width + 4, C.walk, (c) => c !== C.water);
for (const e of edges) strokeLine(e.pts, e.width, C.road, (c) => (c !== C.water && c !== C.creek) || e.bridge);
log('roads painted');

// ---------- buildings ----------
const bld = [];
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
  let area = 0; for (let i = 0; i < out.length; i++) { const [x1, z1] = out[i], [x2, z2] = out[(i + 1) % out.length]; area += x1 * z2 - x2 * z1; }
  if (area < 0) out.reverse(); // counter-clockwise in x/z for consistent wall normals
  return { pts: out, area: Math.abs(area) / 2 };
}
const HOUSEY = new Set(['house', 'detached', 'semidetached_house', 'residential', 'bungalow', 'terrace', 'garage', 'garages', 'shed', 'cabin', 'farm', 'static_caravan', 'hut']);
const FARMY = new Set(['barn', 'farm_auxiliary', 'cowshed', 'stable', 'silo', 'greenhouse', 'sty', 'grain_bin', 'storage_tank']);
const parseH = (v) => { if (!v) return 0; const n = parseFloat(v); return /ft|'/.test(v) ? n * 0.3048 : n || 0; };
const MAT = (v) => (v ? String(v).toLowerCase().slice(0, 16) : undefined);
function addBuilding(geomPts, t, src = {}) {
  if (geomPts.length < 4) return;
  const { pts, area } = simplify(geomPts);
  if (pts.length < 3 || area < 12) return;
  let cx = 0, cz = 0; for (const [x, z] of pts) { cx += x; cz += z; } cx /= pts.length; cz /= pts.length;
  if (!inBox(cx, cz)) return;
  const d = districtFast(cx, cz), type = t.building || 'yes';
  const levels = +t['building:levels'] || 0;
  let h;
  if (parseH(t.height)) h = parseH(t.height);
  else if (levels) h = levels * 3.3 + 1 + (+t['roof:levels'] || 0) * 2;
  else if (type === 'garage' || type === 'shed' || type === 'carport' || type === 'roof' || type === 'garages') h = 3 + rand();
  else if (type === 'silo' || type === 'grain_bin') h = 10 + Math.sqrt(area) * 0.9 + rand() * 4;
  else if (FARMY.has(type)) h = 6 + rand() * 4;
  else if (HOUSEY.has(type) || (d !== 'downtown' && d !== 'north' && area < 260 && type === 'yes')) h = 5.5 + rand() * 2.5;
  else if (type === 'apartments' || type === 'dormitory') h = 10 + rand() * 10;
  else if (type === 'church') h = 14 + rand() * 6;
  else if (d === 'downtown') h = area > 2500 ? 12 + rand() * 12 : area > 800 ? 10 + rand() * 8 : 8 + rand() * 6; // real towers carry height/levels tags
  else if (d === 'village') h = 7 + rand() * 6;
  else if (d === 'north') h = area > 3000 ? 8 + rand() * 4 : 5 + rand() * 3;
  else if (d === 'rural') h = area > 1500 ? 7 + rand() * 4 : 5 + rand() * 3;
  else h = area > 1500 ? 8 + rand() * 6 : 6 + rand() * 4;
  if (src.id === 'r12867212') h = 27; // the Arconic Davenport Works mill in Riverdale (~490,000 m2) stands ~25-30 m, not 12 m
  const roof = t['roof:shape'];
  const pitched = roof ? (roof === 'flat' ? 0 : 1) : (HOUSEY.has(type) || type === 'barn' || (type === 'yes' && area < 260 && d !== 'downtown' && d !== 'north')) && area < 420 ? 1 : 0;
  // facade style: 0 brick, 1 stone, 2 siding, 3 glass/office, 4 stucco/strip mall, 5 industrial metal
  let style = 2;
  if (d === 'downtown') style = h > 30 ? 3 : rand() < 0.65 ? 0 : 1;
  else if (d === 'village') style = rand() < 0.8 ? 0 : 1;
  else if (d === 'north') style = pitched ? 2 : 4;
  else if (FARMY.has(type)) style = type === 'silo' || type === 'grain_bin' || type === 'storage_tank' ? 5 : 2;
  else if (!pitched) style = type === 'industrial' || type === 'warehouse' ? 5 : rand() < 0.5 ? 0 : 4;
  if (type === 'church') style = rand() < 0.5 ? 1 : 0;
  const m = MAT(t['building:material']);
  if (m) style = /brick/.test(m) ? 0 : /stone|limestone|sandstone/.test(m) ? 1 : /wood|vinyl|siding/.test(m) ? 2 : /glass/.test(m) ? 3 : /plaster|stucco|concrete/.test(m) ? 4 : /metal|steel/.test(m) ? 5 : style;
  let ymin = Infinity, ymax = -Infinity; for (const [x, z] of pts) { const y = heightAt(x, z); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
  // kind code for the game: 0 other, 1 parking garage, 2 church, 3 school/college, 4 warehouse/industrial, 5 shop/commercial, 6 house, 7 farm building
  const kind = type === 'parking' || t.parking === 'multi-storey' ? 1 : type === 'church' || type === 'cathedral' || type === 'chapel' ? 2 : ['school', 'university', 'college'].includes(type) ? 3 : ['warehouse', 'industrial', 'manufacture'].includes(type) ? 4 : ['retail', 'commercial', 'supermarket', 'office'].includes(type) ? 5 : pitched && !FARMY.has(type) ? 6 : FARMY.has(type) ? 7 : 0;
  if (kind === 1) { style = 1; h = parseH(t.height) || (levels || 5) * 3.1; } // parking ramps: about 3 m a deck
  const x = {};
  if (type !== 'yes') x.t = type;
  if (levels) x.l = levels;
  if (parseH(t.min_height)) x.mh = parseH(t.min_height);
  if (roof) x.r = roof;
  if (t['roof:colour']) x.rc = t['roof:colour'];
  if (t['roof:material']) x.rm = MAT(t['roof:material']);
  if (m) x.m = m;
  if (t['building:colour']) x.co = t['building:colour'];
  const s = t.shop || t.amenity || t.office || t.tourism || t.craft; if (s) x.s = s;
  if (t['addr:housenumber'] && t['addr:street']) x.a = `${t['addr:housenumber']} ${t['addr:street']}`;
  if (t['addr:housename']) x.hn = t['addr:housename'];
  if (src.id) x.id = src.id; // OSM way id ('r' + id for relations): src/regions name overrides match on it
  if (src.ms) x.ms = 1; // a Microsoft footprint (no tags; areas.js gives it its archetype's height and look)
  bld.push({ pts, cx, cz, h: Math.round(h * 10) / 10, y: Math.round(ymin * 10) / 10, pitched, style, name: t.name || '', type, area, kind, ms: !!src.ms, x: Object.keys(x).length ? x : null });
  fillPoly([pts], C.building, (c) => c !== C.water);
}
const wayTowers = []; // water towers mapped as outlines: drawn as tower points (see below), not as boxes
for (const e of readAll('buildings')) {
  const t = e.tags || {}; if (!t.building || t.building === 'no') continue; // building:part outlines duplicate their building
  if ((t.man_made === 'water_tower' || t.building === 'water_tower') && e.type === 'way' && e.geometry) {
    const g = P(e.geometry); let cx = 0, cz = 0; for (const [x, z] of g) { cx += x; cz += z; } wayTowers.push([cx / g.length, cz / g.length, parseH(t.height) || 38]); continue;
  }
  if (e.type === 'way' && e.geometry) addBuilding(P(e.geometry), t, { id: e.id });
  else if (e.type === 'relation' && e.members) for (const ring of relRings(e).outer) addBuilding(ring, t, { id: 'r' + e.id });
}
const nOSM = bld.length;
log(`buildings ${nOSM}`);
// Microsoft footprints (cache/ms/qc.json from ms-extract.mjs) where OSM has none: dropped when one overlaps an OSM
// building by more than 30% of either's area, sits on a road or in water (25% of it), or is long and thin (rail cars,
// semi trailers and barges the imagery model traced)
{
  const MSF = here('cache/ms/qc.json');
  if (fs.existsSync(MSF)) {
    const OG = 50, og = new Map();
    const toGrid = (i) => {
      const b = bld[i], [a, c, d, f] = bboxOf(b.pts); b.bb = [a, c, d, f];
      for (let gx = Math.floor(a / OG); gx <= Math.floor(c / OG); gx++) for (let gz = Math.floor(d / OG); gz <= Math.floor(f / OG); gz++) { const k = gx * 100000 + gz; let l = og.get(k); if (!l) og.set(k, (l = [])); l.push(i); }
    };
    for (let i = 0; i < bld.length; i++) toGrid(i);
    const why = { overlap: 0, road: 0, water: 0, thin: 0, small: 0 };
    let added = 0;
    for (const flat of JSON.parse(fs.readFileSync(MSF))) {
      const ring = []; for (let i = 0; i < flat.length; i += 2) ring.push([flat[i], flat[i + 1]]);
      const area = Math.abs(ringArea(ring)); if (area < 12) { why.small++; continue; }
      { let rx = 0, rz = 0; for (const [x, z] of ring) { rx += x; rz += z; } rx /= ring.length; rz /= ring.length; if (wayTowers.some(([tx, tz]) => Math.hypot(tx - rx, tz - rz) < 15)) { why.small++; continue; } }
      const [a, b, c, d] = bboxOf(ring);
      // oriented size along the longest side
      let lb = 0, ux = 1, uz = 0; for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length], l = dist(p, q); if (l > lb) { lb = l; ux = (q[0] - p[0]) / l; uz = (q[1] - p[1]) / l; } }
      let v0 = Infinity, v1 = -Infinity, u0 = Infinity, u1 = -Infinity; for (const [x, z] of ring) { const u = x * ux + z * uz, v = -x * uz + z * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
      const wid = Math.min(u1 - u0, v1 - v0), len = Math.max(u1 - u0, v1 - v0);
      if (wid < 4 && len / wid > 3.5) { why.thin++; continue; }
      const cand = new Set();
      for (let gx = Math.floor(a / OG); gx <= Math.floor(b / OG); gx++) for (let gz = Math.floor(c / OG); gz <= Math.floor(d / OG); gz++) for (const i of og.get(gx * 100000 + gz) || []) { const o = bld[i].bb; if (o[0] < b && o[1] > a && o[2] < d && o[3] > c) cand.add(i); }
      const st = Math.max(0.7, Math.sqrt(area / 250)), hit = new Map();
      let n = 0, road = 0, wet = 0;
      for (let z = c + st / 2; z < d; z += st) for (let x = a + st / 2; x < b; x += st) {
        if (!pointInPoly(x, z, ring)) continue;
        n++; const cl = clsAt(x, z); if (cl === C.road) road++; else if (cl === C.water) wet++;
        for (const i of cand) { const o = bld[i]; if (x > o.bb[0] && x < o.bb[1] && z > o.bb[2] && z < o.bb[3] && pointInPoly(x, z, o.pts)) hit.set(i, (hit.get(i) || 0) + 1); }
      }
      if (!n) { why.small++; continue; }
      if (road > n * 0.25) { why.road++; continue; }
      if (wet > n * 0.25) { why.water++; continue; }
      let dup = false; for (const [i, k] of hit) if (k > n * 0.3 || k * st * st > 0.3 * bld[i].area) { dup = true; break; }
      if (dup) { why.overlap++; continue; }
      const before = bld.length; addBuilding(ring, { building: 'yes' }, { ms: true }); if (bld.length > before) { added++; for (let i = before; i < bld.length; i++) toGrid(i); } // later footprints dedupe against this one too (the dataset has duplicates)
    }
    log(`Microsoft footprints: ${added} added; dropped ${JSON.stringify(why)}`);
  } else log('no cache/ms/qc.json: OSM buildings only (run npm run ms)');
}
log(`buildings ${bld.length} (OSM ${nOSM}, Microsoft ${bld.length - nOSM})`);

// ---------- tile features: points, lines, areas ----------
const tileKey = (x, z) => `${Math.floor(x / TILE)}_${Math.floor(z / TILE)}`;
const buckets = new Map();
const bucket = (k) => { let b = buckets.get(k); if (!b) buckets.set(k, (b = { b: [], t: [], k: [], e: new Set(), p: {}, l: {}, a: {} })); return b; };
const addPoint = (key, x, z, ...extra) => { if (!inBox(x, z)) return; const b = bucket(tileKey(x, z)); (b.p[key] = b.p[key] || []).push(x, z, ...extra); };
for (const [x, z, hh] of wayTowers) addPoint('wt', x, z, Math.round(hh));
const trees = [];
const PKEY = (t) => {
  if (t.highway === 'street_lamp') return 'lm'; if (t.highway === 'traffic_signals') return 'sg'; if (t.highway === 'stop') return 'st'; if (t.highway === 'give_way') return 'gw';
  if (t.highway === 'crossing' || t.railway === 'crossing') return 'cw'; if (t.highway === 'bus_stop' || t.public_transport === 'platform') return 'bs';
  if (t.amenity === 'bench' || t.leisure === 'picnic_table') return 'bn'; if (t.amenity === 'waste_basket' || t.amenity === 'waste_disposal' || t.amenity === 'recycling') return 'wb';
  if (t.amenity === 'post_box') return 'pb'; if (t.emergency === 'fire_hydrant') return 'hy'; if (t.power === 'pole') return 'pp'; if (t.power === 'tower') return 'pt';
  if (t.man_made === 'flagpole') return 'fp'; if (t.advertising) return 'bb'; if (t.railway === 'level_crossing') return 'lc'; if (t.amenity === 'vending_machine') return 'vm';
  if (t.amenity === 'drinking_water') return 'dr'; if (t.leisure === 'playground') return 'pl'; if (t.amenity === 'parking_entrance') return 'pk';
  return null;
};
let npts = 0;
for (const p of pts) {
  if (p.type !== 'node' || !p.tags) continue;
  const t = p.tags, [x, z] = project(p.lat, p.lon);
  if (t.natural === 'tree') { trees.push([x, z, t.leaf_type === 'needleleaved' ? 1 : 0, 0.8 + rand() * 0.5]); continue; }
  const hh = parseH(t.height);
  if (t.man_made === 'silo' || t.man_made === 'storage_tank') { addPoint('sl', x, z, Math.round(hh || 14)); npts++; continue; }
  if (t.man_made === 'water_tower') { addPoint('wt', x, z, Math.round(hh || 38)); npts++; continue; }
  if (t.man_made === 'chimney' || t.man_made === 'mast' || t.man_made === 'tower' || t.man_made === 'communications_tower') { addPoint('ch', x, z, Math.round(hh || 30)); npts++; continue; }
  const k = PKEY(t); if (k) { addPoint(k, x, z); npts++; }
}
// lines
const LKEY = (t) => {
  if (t.barrier === 'fence' || t.barrier === 'handrail') return 'fe'; if (t.barrier === 'wall' || t.barrier === 'city_wall') return 'wa'; if (t.barrier === 'hedge') return 'he';
  if (t.barrier === 'guard_rail') return 'gr'; if (t.barrier === 'retaining_wall') return 'rw'; if (t.barrier === 'kerb' || t.man_made === 'embankment' || t.man_made === 'dyke') return 'kb';
  if (t.power === 'line') return 'pw'; if (t.power === 'minor_line') return 'ps';
  if (t.waterway === 'stream' || t.waterway === 'river' || t.waterway === 'canal') return 'sr'; if (t.waterway === 'ditch' || t.waterway === 'drain') return 'dc';
  if (t.waterway === 'dam' || t.waterway === 'weir' || t.waterway === 'lock_gate') return 'dm'; if (t.natural === 'tree_row') return 'tr';
  if (t.man_made === 'pier' || t.man_made === 'breakwater') return 'pi';
  return null;
};
for (const e of linesRaw) { const k = LKEY(e.tags || {}); if (k && e.geometry) lineFeat.push({ key: k, pts: P(e.geometry) }); }
for (const e of areasRaw) { const t = e.tags || {}; if (e.type !== 'way' || !e.geometry) continue; if (t.natural === 'tree_row') lineFeat.push({ key: 'tr', pts: P(e.geometry) }); else if ((t.man_made === 'pier' || t.man_made === 'breakwater') && dist(P([e.geometry[0]])[0], P([e.geometry[e.geometry.length - 1]])[0]) > 1) lineFeat.push({ key: 'pi', pts: P(e.geometry) }); }
for (const e of roadsRaw) { const t = e.tags || {}; if (t.railway && e.geometry && !t.highway && ['rail', 'siding', 'spur', 'yard', 'tram', 'light_rail'].includes(t.railway)) lineFeat.push({ key: 'rl', pts: P(e.geometry) }); }
// clip a polyline to a box -> pieces (Liang-Barsky per segment)
function clipLine(pl, x0, z0, x1, z1) {
  const out = []; let cur = null;
  for (let i = 1; i < pl.length; i++) {
    let [ax, az] = pl[i - 1], [bx, bz] = pl[i], t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
    let ok = true;
    for (const [p, q] of [[-dx, ax - x0], [dx, x1 - ax], [-dz, az - z0], [dz, z1 - az]]) {
      if (p === 0) { if (q < 0) { ok = false; break; } continue; }
      const r = q / p; if (p < 0) { if (r > t1) { ok = false; break; } if (r > t0) t0 = r; } else { if (r < t0) { ok = false; break; } if (r < t1) t1 = r; }
    }
    if (!ok) { if (cur) { out.push(cur); cur = null; } continue; }
    const s = [ax + dx * t0, az + dz * t0], e = [ax + dx * t1, az + dz * t1];
    if (!cur) cur = [s]; cur.push(e);
    if (t1 < 1) { out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  return out.filter((c) => c.length > 1);
}
// clip a polygon ring to a box (Sutherland-Hodgman)
function clipPoly(ring, x0, z0, x1, z1) {
  let poly = ring;
  for (const [axis, v, keepLess] of [[0, x0, false], [0, x1, true], [1, z0, false], [1, z1, true]]) {
    const inside = (p) => (keepLess ? p[axis] <= v : p[axis] >= v), out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if (inside(a)) out.push(a);
      if (inside(a) !== inside(b)) { const t = (v - a[axis]) / (b[axis] - a[axis]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    poly = out; if (poly.length < 3) return null;
  }
  return poly;
}
function addLineToTiles(key, pl) {
  const [a, b, c, d] = bboxOf(pl);
  for (let tz = Math.floor(c / TILE); tz <= Math.floor(d / TILE); tz++) for (let tx = Math.floor(a / TILE); tx <= Math.floor(b / TILE); tx++) {
    if (tx < TX0 || tx > TX1 || tz < TZ0 || tz > TZ1) continue;
    const ox = tx * TILE, oz = tz * TILE;
    for (const piece of clipLine(pl, ox, oz, ox + TILE, oz + TILE)) { const bk = bucket(`${tx}_${tz}`); (bk.l[key] = bk.l[key] || []).push(simplifyLine(piece, 0.3).flatMap(([x, z]) => [r1(x - ox), r1(z - oz)])); }
  }
}
function addAreaToTiles(key, ring) {
  const [a, b, c, d] = bboxOf(ring);
  for (let tz = Math.floor(c / TILE); tz <= Math.floor(d / TILE); tz++) for (let tx = Math.floor(a / TILE); tx <= Math.floor(b / TILE); tx++) {
    if (tx < TX0 || tx > TX1 || tz < TZ0 || tz > TZ1) continue;
    const ox = tx * TILE, oz = tz * TILE, poly = clipPoly(ring, ox, oz, ox + TILE, oz + TILE);
    if (poly && Math.abs(ringArea(poly)) > 4) { const bk = bucket(`${tx}_${tz}`); (bk.a[key] = bk.a[key] || []).push(simplifyLine(poly, 0.3).flatMap(([x, z]) => [r1(x - ox), r1(z - oz)])); }
  }
}
for (const f of lineFeat) addLineToTiles(f.key, f.pts);
const AKEY = (t) => (t.amenity === 'parking' ? 'pk' : t.landuse === 'farmland' ? 'fm' : t.landuse === 'orchard' || t.landuse === 'vineyard' ? 'or' : t.golf === 'fairway' ? 'gf' : t.golf === 'green' ? 'gg' : t.golf === 'bunker' ? 'gb'
  : t.landuse === 'cemetery' || t.amenity === 'grave_yard' ? 'ce' : t.man_made === 'pier' ? 'pi' : t.aeroway === 'runway' ? 'ra' : t.aeroway === 'taxiway' || t.aeroway === 'apron' ? 'aa' : null);
for (const e of areasRaw) {
  const t = e.tags || {}, k = AKEY(t); if (!k) continue;
  if (e.type === 'way' && e.geometry && e.geometry.length > 3) { const g = P(e.geometry); if (dist(g[0], g[g.length - 1]) < 1) addAreaToTiles(k, g); }
  else if (e.type === 'relation' && e.members) for (const g of relRings(e).outer) addAreaToTiles(k, g);
}
log(`point features ${npts}, line features ${lineFeat.length}`);

// ---------- parking spots ----------
const parking = [];
const nearJunction = (x, z, r) => nearestNode(x, z, r) >= 0;
for (const e of edges) {
  if (!['residential', 'tertiary', 'minor', 'secondary'].includes(e.cl) || e.bridge) continue;
  const d0 = districtFast(nodes2[e.a].x, nodes2[e.a].z);
  const p = e.cl === 'secondary' ? (d0 === 'downtown' || d0 === 'village' ? 0.45 : 0) : d0 === 'downtown' ? 0.55 : d0 === 'north' ? 0.1 : d0 === 'rural' ? 0 : e.cl === 'minor' && d0 === 'town' ? 0.1 : 0.3;
  if (!p) continue;
  const off = e.width / 2 - 1.15;
  for (let i = 1; i < e.pts.length; i++) {
    const [ax, az] = e.pts[i - 1], [bx, bz] = e.pts[i], len = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / len, uz = (bz - az) / len, nx = -uz, nz = ux, h = Math.atan2(ux, uz);
    for (let s = 4; s < len - 4; s += 6.4) for (const side of [1, -1]) {
      if (rand() > p) continue;
      const x = ax + ux * s + nx * off * side, z = az + uz * s + nz * off * side;
      if (nearJunction(x, z, 14)) continue;
      parking.push([x, z, h, 0]);
    }
  }
}
for (const a of areaPolys) {
  if (a.code !== C.parking) continue;
  const pp = a.outer[0]; if (!pp) continue; let best = 0, ux = 1, uz = 0;
  for (let i = 1; i < pp.length; i++) { const d = dist(pp[i], pp[i - 1]); if (d > best) { best = d; ux = (pp[i][0] - pp[i - 1][0]) / d; uz = (pp[i][1] - pp[i - 1][1]) / d; } }
  const [minx, maxx, minz, maxz] = bboxOf(pp);
  let n = 0;
  const vx = -uz, vz = ux, cx = (minx + maxx) / 2, cz = (minz + maxz) / 2, R = Math.hypot(maxx - minx, maxz - minz) / 2;
  for (let a1 = -R; a1 < R && n < 60; a1 += 2.8) for (let b1 = -R; b1 < R && n < 60; b1 += 7.5) {
    const x = cx + ux * a1 + vx * b1, z = cz + uz * a1 + vz * b1;
    if (!pointInPoly(x, z, pp) || rand() > 0.5 || clsAt(x, z) === C.building) continue;
    parking.push([x, z, Math.atan2(vx, vz) + (rand() < 0.5 ? Math.PI : 0), 1]); n++;
  }
}

// ---------- generated trees (real OSM trees are already in `trees`) ----------
for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
  const c = cls[j * GW + i];
  if (c !== C.wood && c !== C.park && c !== C.cemetery && c !== C.lawn && c !== C.residential && c !== C.scrub && c !== C.golf && c !== C.wetland && c !== C.farmyard) continue;
  const x = GX0 + (i + rand()) * CELL, z = GZ0 + (j + rand()) * CELL, d = districtFast(x, z);
  let p = 0;
  if (c === C.wood) p = d === 'rural' ? 0.035 : 0.18; else if (c === C.scrub || c === C.wetland) p = 0.02; else if (c === C.park || c === C.cemetery || c === C.golf) p = 0.03;
  else if (c === C.farmyard) p = 0.01; else p = d === 'downtown' ? 0.004 : d === 'rural' ? 0.003 : 0.02;
  if (rand() < p) trees.push([x, z, c === C.wood ? (rand() < 0.3 ? 1 : 0) : rand() < 0.12 ? 1 : rand() < 0.25 ? 2 : 0, 0.75 + rand() * 0.6]);
}
for (const e of edges) {
  if (e.cl !== 'residential' && e.cl !== 'tertiary') continue;
  const dd = districtFast(nodes2[e.a].x, nodes2[e.a].z); if (dd === 'north' || dd === 'rural') continue;
  for (let i = 1; i < e.pts.length; i++) {
    const [ax, az] = e.pts[i - 1], [bx, bz] = e.pts[i], len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
    for (let s = 6; s < len; s += 11) for (const side of [1, -1]) {
      if (rand() > 0.55) continue;
      const off = e.width / 2 + 3.2, x = ax + ux * s - uz * off * side, z = az + uz * s + ux * off * side, c = clsAt(x, z);
      if (c === C.road || c === C.building || c === C.water || c === C.walk) continue;
      trees.push([x, z, dd === 'downtown' ? 2 : 0, 0.8 + rand() * 0.5]);
    }
  }
}
log(`trees ${trees.length}, parking ${parking.length}`);

// ---------- points of interest, stations ----------
const poi = [];
for (const p of pts) {
  const t = p.tags || {}; const lat = p.lat ?? p.center?.lat, lon = p.lon ?? p.center?.lon; if (lat == null) continue;
  const [x, z] = project(lat, lon); if (!inBox(x, z)) continue;
  const kind = (t.amenity && !['bench', 'waste_basket', 'post_box', 'vending_machine', 'parking_entrance', 'bicycle_parking', 'drinking_water', 'recycling', 'waste_disposal', 'parking_space', 'charging_station', 'telephone', 'shelter', 'clock', 'fountain', 'toilets', 'hunting_stand', 'bbq', 'grit_bin'].includes(t.amenity) ? t.amenity : null)
    || t.shop || t.tourism || (['stadium', 'park', 'pitch', 'golf_course', 'marina', 'sports_centre', 'nature_reserve', 'water_park', 'ice_rink', 'bowling_alley', 'fitness_centre', 'slipway'].includes(t.leisure) ? t.leisure : null)
    || (['pier', 'water_tower', 'lighthouse'].includes(t.man_made) ? t.man_made : null) || (t.highway === 'bus_stop' ? 'bus_stop' : null) || (t.historic ? 'historic' : null) || (t.office ? 'office' : null) || (t.craft ? 'craft' : null);
  if (!kind || (!t.name && ['parking', 'bus_stop', 'pitch', 'office', 'craft', 'historic'].includes(kind))) continue;
  poi.push({ kind, name: t.name || '', x: Math.round(x), z: Math.round(z) });
}
// a station's town: the town limits it sits in (or the nearest town)
const townOf = (x, z) => (townAt(x, z) || towns.reduce((a, b) => (Math.hypot(b.x - x, b.z - z) < Math.hypot(a.x - x, a.z - z) ? b : a), towns[0]))?.name || '';
const stations = (kind) => poi.filter((p) => p.kind === kind && p.name).map((p) => ({ ...p, town: townOf(p.x, p.z) }));
const police = stations('police').filter((p) => !/Campus|University|College|Security|Federal|FBI|Marshal|Courthouse|Jail/i.test(p.name));
const hospitals = stations('hospital').filter((p) => !/Clinic|Behavioral|Rehab|Hospice|Surgery Center/i.test(p.name));
const fire = stations('fire_station');

// ---------- Welcome signs where roads cross into a town ----------
const signs = [];
{
  const big = edges.filter((e) => ['motor', 'trunk', 'primary', 'secondary', 'tertiary'].includes(e.cl) && !e.bridge);
  towns.forEach((tw, ti) => {
    if (!tw.rings.length || tw.place === 'hamlet' || tw.place === 'isolated_dwelling') return;
    for (const ring of tw.rings) for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length], [mnx, mxx, mnz, mxz] = [Math.min(ax, bx), Math.max(ax, bx), Math.min(az, bz), Math.max(az, bz)];
      for (const e of big) {
        if (e.minx === undefined) [e.minx, e.maxx, e.minz, e.maxz] = bboxOf(e.pts);
        if (e.maxx < mnx || e.minx > mxx || e.maxz < mnz || e.minz > mxz) continue;
        for (let k = 1; k < e.pts.length; k++) {
          const [cx, cz] = e.pts[k - 1], [dx, dz] = e.pts[k], den = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx); if (Math.abs(den) < 1e-9) continue;
          const t = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / den, u = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / den;
          if (t < 0 || t > 1 || u < 0 || u > 1) continue;
          const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
          if (signs.some((s) => s[3] === ti && Math.hypot(s[0] - x, s[1] - z) < 250)) continue;
          // facing drivers coming in: heading of the road pointing into the town
          let h = Math.atan2(dx - cx, dz - cz); const ix = x + Math.sin(h) * 20, iz = z + Math.cos(h) * 20;
          if (!ring.length || !pointInPoly(ix, iz, ring)) h += Math.PI;
          const rx = x - Math.cos(h) * (e.width / 2 + 3), rz = z + Math.sin(h) * (e.width / 2 + 3); // on the right-hand verge
          signs.push([Math.round(rx), Math.round(rz), Math.round(h * 100) / 100, ti, e.cl === 'motor' ? 1 : 0]);
        }
      }
    }
  });
}
log(`Welcome signs ${signs.length}`);

// ---------- river crossings (the real bridges, for landmarks.js and agent-built structures) ----------
const crossings = [];
{
  const NAMES = [[/Centennial/i, 'Centennial Bridge'], [/Government|Arsenal/i, 'Government Bridge'], [/I.?74|Interstate 74|Iowa.Illinois Memorial/i, 'I-74 Bridge'], [/I.?280|Sergeant/i, 'I-280 Bridge'], [/I.?80/i, 'I-80 Bridge'], [/Rock Island Viaduct|Moline/i, 'Arsenal viaduct']];
  const wetLen = (e) => { let n = 0; for (let i = 1; i < e.pts.length; i++) { const [ax, az] = e.pts[i - 1], [bx, bz] = e.pts[i], L = dist(e.pts[i - 1], e.pts[i]); for (let s = 0; s < L; s += 10) if (heightAt(ax + (bx - ax) * s / L, az + (bz - az) * s / L) < -1) n += 10; } return n; }; // bridges paint road over the water class
  const groups = new Map();
  for (const e of edges) {
    if (!e.bridge || ['service', 'track'].includes(e.cl)) continue;
    const wl2 = wetLen(e); if (wl2 < 40) continue;
    const label = (e.name + ' ' + e.ref).trim(), nm = NAMES.find(([re]) => re.test(label));
    const key = (nm ? nm[1] : label || 'bridge') + '|' + Math.round(e.pts[0][0] / 3000) + ',' + Math.round(e.pts[0][1] / 3000);
    let g = groups.get(key); if (!g) groups.set(key, (g = { name: nm ? nm[1] : e.name || e.ref || 'Bridge', ref: e.ref, cl: e.cl, edges: [], wet: 0 })); g.edges.push(e); g.wet += wl2;
  }
  for (const g of groups.values()) {
    if (g.wet < 80) continue;
    const ids = g.edges.map((e) => edges.indexOf(e));
    const allPts = g.edges.flatMap((e) => e.pts), [a, b, c, d] = bboxOf(allPts);
    const mx = (a + b) / 2, mz = (c + d) / 2, wp = areaPolys.find((w) => w.code === C.water && w.tags.name && w.outer.some((r) => { const [p0, p1, p2, p3] = bboxOf(r); return mx > p0 && mx < p1 && mz > p2 && mz < p3; }));
    let river = wp ? wp.tags.name : null;
    if (!river) { let bd = Infinity; for (const w of areaPolys) { if (w.code !== C.water || !w.tags.name) continue; for (const r of w.outer) { const [p0, p1, p2, p3] = bboxOf(r); const dd = Math.hypot(Math.max(p0 - mx, 0, mx - p1), Math.max(p2 - mz, 0, mz - p3)); if (dd < bd) { bd = dd; river = w.tags.name; } } } }
    river = river || 'Mississippi River';
    crossings.push({ name: g.name, ref: g.ref, river, edges: ids, box: [Math.round(a), Math.round(c), Math.round(b), Math.round(d)], deck: r1(Math.max(...g.edges.map((e) => Math.max(nodes2[e.a].y, nodes2[e.b].y) + e.rise))), lines: g.edges.map((e) => simplifyLine(e.pts, 1).flatMap(([x, z]) => [Math.round(x), Math.round(z)])) });
  }
  log(`river crossings: ${crossings.map((c) => c.name).join(', ')}`);
}

// ---------- railways ----------
const rail = { lines: [], tracks: [], crossings: [], yards: [] };
{
  const ways = roadsRaw.filter((w) => w.type === 'way' && w.geometry && w.tags && w.tags.railway === 'rail' && !w.tags.highway);
  const keyOf = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  rail.tracks = ways.map((w) => simplifyLine(P(w.geometry), 1).flatMap(([x, z]) => [Math.round(x), Math.round(z)]));
  // mainline ways (no service tag) chained end to end; trains run on the long ones
  let segs = ways.filter((w) => !w.tags.service).map((w) => P(w.geometry));
  const lines = [];
  while (segs.length) {
    let line = segs.shift(), grown = true;
    while (grown) {
      grown = false;
      for (let i = 0; i < segs.length; i++) {
        const s0 = segs[i], a = keyOf(line[0]), b = keyOf(line[line.length - 1]), c = keyOf(s0[0]), d = keyOf(s0[s0.length - 1]);
        if (b === c) line = line.concat(s0.slice(1)); else if (b === d) line = line.concat(s0.slice().reverse().slice(1));
        else if (a === d) line = s0.concat(line.slice(1)); else if (a === c) line = s0.slice().reverse().concat(line.slice(1));
        else continue;
        segs.splice(i, 1); grown = true; break;
      }
    }
    lines.push(line);
  }
  const len = (l) => l.reduce((acc, p, i) => (i ? acc + dist(p, l[i - 1]) : 0), 0);
  lines.sort((a, b) => len(b) - len(a));
  const keep = lines.filter((l) => len(l) > 2500).map((l) => simplifyLine(l, 0.5));
  rail.lines = keep.map((l) => l.flatMap(([x, z]) => [r1(x), r1(z)]));
  // where each line crosses a road: [line, s along line, x, z, road heading, road width]
  keep.forEach((l, li) => {
    const cum = [0]; for (let i = 1; i < l.length; i++) cum.push(cum[i - 1] + dist(l[i], l[i - 1]));
    const [la, lb, lc, ld] = bboxOf(l);
    for (const e of edges) {
      if (e.bridge || e.cl === 'track' || (e.cl === 'service' && elen(e) < 40) || e.flags & 1) continue;
      if (e.minx === undefined) [e.minx, e.maxx, e.minz, e.maxz] = bboxOf(e.pts);
      if (e.maxx < la || e.minx > lb || e.maxz < lc || e.minz > ld) continue;
      for (let i = 1; i < l.length; i++) {
        const [ax, az] = l[i - 1], [bx, bz] = l[i];
        if (Math.max(ax, bx) < e.minx || Math.min(ax, bx) > e.maxx || Math.max(az, bz) < e.minz || Math.min(az, bz) > e.maxz) continue;
        for (let k = 1; k < e.pts.length; k++) {
          const [cx, cz] = e.pts[k - 1], [dx, dz] = e.pts[k], den = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx); if (Math.abs(den) < 1e-6) continue;
          const t = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / den, u = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / den;
          if (t < 0 || t > 1 || u < 0 || u > 1) continue;
          const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
          if (Math.abs(heightAt(x, z) - (nodes2[e.a].y + nodes2[e.b].y) / 2) > 6) continue; // road on a different level
          if (rail.crossings.some((c) => c[0] === li && Math.hypot(c[2] - x, c[3] - z) < 15)) continue;
          rail.crossings.push([li, r1(cum[i - 1] + Math.hypot(x - ax, z - az)), r1(x), r1(z), Math.round(Math.atan2(dx - cx, dz - cz) * 100) / 100, e.width]);
        }
      }
    }
  });
  // rail yards (named landuse=railway areas or yard tracks) for train spawns / scenery
  for (const a of areaPolys) if (a.code === C.rail && a.tags.name) { const [x0, x1, z0, z1] = bboxOf(a.outer[0]); rail.yards.push({ name: a.tags.name, x: Math.round((x0 + x1) / 2), z: Math.round((z0 + z1) / 2) }); }
  log(`rail: ${rail.tracks.length} tracks, ${keep.length} train lines (${keep.map((l) => (len(l) / 1000).toFixed(1)).join(', ')} km), ${rail.crossings.length} crossings, yards ${rail.yards.map((y) => y.name).join(', ')}`);
}
fs.writeFileSync(OUT + 'rail.json', JSON.stringify(rail));

// ---------- the Channel Cat (OSM ferry routes) ----------
const ferries = [];
{
  // OSM maps the Channel Cat leg by leg (Lindsay Park - John Deere Commons, ...): chain its legs into one route
  const legs = [], CAT = /Channel Cat|Lindsay|John Deere Commons|Riverbend|Isle Casino|Leach|Butterworth/i;
  for (const e of linesRaw) if (e.tags && e.tags.route === 'ferry' && e.geometry) { const g = simplifyLine(P(e.geometry), 3); if (CAT.test(e.tags.name || '')) legs.push(g); else ferries.push({ name: e.tags.name || 'Ferry', pts: g.flatMap(([x, z]) => [Math.round(x), Math.round(z)]) }); }
  if (legs.length) {
    let line = legs.shift();
    for (let grown = true; grown && legs.length;) {
      grown = false;
      for (let i = 0; i < legs.length; i++) {
        const s0 = legs[i], a = line[0], b = line[line.length - 1];
        if (dist(b, s0[0]) < 40) line = line.concat(s0.slice(1)); else if (dist(b, s0[s0.length - 1]) < 40) line = line.concat(s0.slice().reverse().slice(1));
        else if (dist(a, s0[s0.length - 1]) < 40) line = s0.concat(line.slice(1)); else if (dist(a, s0[0]) < 40) line = s0.slice().reverse().concat(line.slice(1));
        else continue;
        legs.splice(i, 1); grown = true; break;
      }
    }
    ferries.unshift({ name: 'Channel Cat', pts: line.flatMap(([x, z]) => [Math.round(x), Math.round(z)]), extra: legs.length });
  }
}

// ---------- runways (src/planes.js parks planes on them) ----------
const runways = [];
for (const e of areasRaw) {
  const t = e.tags || {}; if (t.aeroway !== 'runway' || e.type !== 'way' || !e.geometry) continue;
  const g = P(e.geometry); let a = g[0], b = g[g.length - 1];
  if (dist(a, b) < 1) { let best = 0; for (const p of g) for (const q of g) { const d = dist(p, q); if (d > best) { best = d; a = p; b = q; } } } // drawn as an area: its long axis
  const len = dist(a, b); if (len < 150 || !inBox(a[0], a[1])) continue;
  const surf = t.surface || '', paved = !/grass|dirt|turf|gravel|ground/.test(surf);
  runways.push({ x1: Math.round(a[0]), z1: Math.round(a[1]), x2: Math.round(b[0]), z2: Math.round(b[1]), width: Math.round(parseWidth(t.width) || (paved ? 45 : 20)), name: t.ref || t.name || '', kind: paved && len > 900 ? 'runway' : 'airstrip', surface: surf });
}
log(`runways ${runways.length}: ${runways.map((r) => r.name + ' ' + r.kind).join(', ')}`);

// ---------- the Mississippi's centre line (OSM waterway=river), for the barge tows ----------
let river = [];
{
  let segs = linesRaw.filter((e) => e.tags && e.tags.waterway === 'river' && /Mississippi/i.test(e.tags.name || '') && e.geometry).map((e) => P(e.geometry));
  const lines = [];
  while (segs.length) {
    let line = segs.shift();
    for (let grown = true; grown;) {
      grown = false;
      for (let i = 0; i < segs.length; i++) {
        const s0 = segs[i], a = line[0], b = line[line.length - 1];
        if (dist(b, s0[0]) < 2) line = line.concat(s0.slice(1)); else if (dist(b, s0[s0.length - 1]) < 2) line = line.concat(s0.slice().reverse().slice(1));
        else if (dist(a, s0[s0.length - 1]) < 2) line = s0.concat(line.slice(1)); else if (dist(a, s0[0]) < 2) line = s0.slice().reverse().concat(line.slice(1));
        else continue;
        segs.splice(i, 1); grown = true; break;
      }
    }
    lines.push(line);
  }
  const len = (l) => l.reduce((acc, p, i) => (i ? acc + dist(p, l[i - 1]) : 0), 0);
  lines.sort((a, b) => len(b) - len(a));
  if (lines.length) river = simplifyLine(lines[0].filter(([x, z]) => inBox(x, z)), 5).flatMap(([x, z]) => [Math.round(x), Math.round(z)]);
  log(`Mississippi centre line ${(len(lines[0] || []) / 1000).toFixed(1)} km`);
}

// ---------- nothing standing on a carriageway (road-clear.mjs; fix-road-overlaps.mjs makes the same call on built data) ----------
// OSM and Microsoft footprints that sit in a road (misplaced traces, trucks, sheds mapped over a lane) and trees whose trunk
// is on one (OSM natural=tree points, street trees the 4 m raster let through) are dropped; the building cells a dropped
// footprint painted go back to road (or lawn) so no grey pad is left under the street.
{
  const RX = roadIndex(edges.map((e) => ({ pts: e.pts, width: e.width, flags: e.flags, bridge: !!e.bridge, ya: nodes2[e.a].y, yb: nodes2[e.b].y, rise: e.rise || 0, cls: e.cl })));
  const why = {}; let cells = 0;
  const keep = bld.filter((b) => {
    const hit = RX.buildingHit(b.pts, b.y, b.h, { type: b.type, kind: b.kind, ms: b.ms, area: b.area }); if (!hit) return true;
    why[hit.why] = (why[hit.why] || 0) + 1;
    const [a, c, d, f] = bboxOf(b.pts), [i0, j0] = cellOf(a, d), [i1, j1] = cellOf(c, f);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (!inGrid(i, j) || cls[j * GW + i] !== C.building) continue;
      const x = GX0 + (i + 0.5) * CELL, z = GZ0 + (j + 0.5) * CELL; if (!inRing(x, z, b.pts)) continue;
      cls[j * GW + i] = RX.pointHit(x, z, -1) ? C.road : C.lawn; cells++;
    }
    return false;
  });
  const nb = bld.length - keep.length; bld.length = 0; for (const b of keep) bld.push(b);
  const nt = trees.length; let w = 0; for (const tr of trees) if (!RX.pointHit(tr[0], tr[1], 0.4, heightAt(tr[0], tr[1]))) trees[w++] = tr; trees.length = w;
  log(`off the roads: ${nb} buildings dropped ${JSON.stringify(why)} (${cells} ground cells repainted), ${nt - trees.length} trees dropped`);
}

// ---------- write tiles ----------
const b64 = (arr) => Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength).toString('base64');
for (const b of bld) bucket(tileKey(b.cx, b.cz)).b.push(b);
for (const t of trees) if (inBox(t[0], t[1])) bucket(tileKey(t[0], t[1])).t.push(t);
for (const p of parking) bucket(tileKey(p[0], p[1])).k.push(p);
// every tile an edge's carriageway touches lists it (sampled every 2 m along the centre line and both kerbs: the old
// 50 m steps missed the tiles a long straight road only clips at a corner, so those tiles drew no road there)
const keysAlong = (e, step, key) => {
  const ks = new Set(), o = e.width / 2 + 0.5;
  for (let i = 1; i < e.pts.length; i++) {
    const [ax, az] = e.pts[i - 1], [bx, bz] = e.pts[i], L = dist(e.pts[i], e.pts[i - 1]) || 1, nx = -(bz - az) / L, nz = (bx - ax) / L;
    for (let s = 0; s < L + step; s += step) { const f = Math.min(1, s / L), x = ax + (bx - ax) * f, z = az + (bz - az) * f; for (const m of [0, o, -o]) ks.add(key(x + nx * m, z + nz * m)); }
  }
  return ks;
};
edges.forEach((e, idx) => { for (const k of keysAlong(e, 2, tileKey)) bucket(k).e.add(idx); });
function encodeHeights(H) { // see the format note at the top
  if (H.every((v) => v === H[0])) return { h: H[0] };
  const bytes = []; const q = Array.from(H, (v) => Math.round(v / 2));
  const i16 = (v) => { bytes.push(v & 255, (v >> 8) & 255); };
  i16(q[0]);
  for (let k = 1; k < q.length; k++) { const d = q[k] - q[k - 1]; if (d > -128 && d < 128) bytes.push(d & 255); else { bytes.push(128); i16(q[k]); } }
  return { hd: Buffer.from(bytes).toString('base64') };
}
function encodeClasses(CL) {
  const rle = []; for (let k = 0; k < CL.length;) { let n = 1; while (k + n < CL.length && CL[k + n] === CL[k] && n < 255) n++; rle.push(CL[k], n); k += n; }
  return rle.length < CL.length ? { cr: Buffer.from(rle).toString('base64') } : { c: b64(CL) };
}
let tileCount = 0, totalBytes = 0, maxBytes = 0;
const tileList = [];
for (let tz = TZ0; tz <= TZ1; tz++) for (let tx = TX0; tx <= TX1; tx++) {
  const ox = tx * TILE, oz = tz * TILE, key = `${tx}_${tz}`, bk = buckets.get(key) || { b: [], t: [], k: [], e: new Set(), p: {}, l: {}, a: {} };
  const H = new Int16Array(26 * 26), hi = (ox - GX0) / 8, hj = (oz - GZ0) / 8;
  for (let j = 0; j <= 25; j++) for (let i = 0; i <= 25; i++) H[j * 26 + i] = Math.round(height[Math.min(HH - 1, hj + j) * HW + Math.min(HW - 1, hi + i)] * 100);
  const CL = new Uint8Array(50 * 50), ci = (ox - GX0) / CELL, cj = (oz - GZ0) / CELL;
  let anyLand = false;
  for (let j = 0; j < 50; j++) for (let i = 0; i < 50; i++) { const c = cls[(cj + j) * GW + ci + i]; CL[j * 50 + i] = c; if (c !== C.water) anyLand = true; }
  const tile = { ...encodeHeights(H), ...encodeClasses(CL) };
  if (bk.b.length) tile.b = bk.b.map((b) => { const r = [b.pts.flatMap(([x, z]) => [r1(x - ox), r1(z - oz)]), b.y, b.h, b.pitched, b.style, b.name, b.kind]; if (b.x) r.push(b.x); return r; });
  else tile.b = [];
  tile.t = bk.t.flatMap(([x, z, k, s]) => [r1(x - ox), r1(z - oz), k, Math.round(s * 10)]);
  tile.k = bk.k.flatMap(([x, z, h, lot]) => [r1(x - ox), r1(z - oz), Math.round(h * 100) / 100, lot]);
  tile.e = [...bk.e];
  if (Object.keys(bk.p).length) tile.p = Object.fromEntries(Object.entries(bk.p).map(([k, arr]) => { const stride = ['sl', 'wt', 'ch'].includes(k) ? 3 : 2, o = []; for (let i = 0; i < arr.length; i += stride) { o.push(r1(arr[i] - ox), r1(arr[i + 1] - oz)); for (let s = 2; s < stride; s++) o.push(arr[i + s]); } return [k, o]; }));
  if (Object.keys(bk.l).length) tile.l = bk.l;
  if (Object.keys(bk.a).length) tile.a = bk.a;
  const json = JSON.stringify(tile);
  fs.writeFileSync(`${OUT}tiles/${key}.json`, json);
  tileCount++; totalBytes += json.length; maxBytes = Math.max(maxBytes, json.length);
  if (anyLand) tileList.push(key);
}
log(`tiles ${tileCount} (land ${tileList.length}), ${(totalBytes / 1e6).toFixed(1)} MB, biggest ${(maxBytes / 1e3).toFixed(0)} KB`);

// ---------- road graph, in chunks ----------
// data/roads/{cx}_{cz}.json = {n: [id, x, z, y, ctrl, closed, ...], e: [[id, a, b, class, lanesFwd, lanesBack, speed, name, bridge, width, [x,z,...], flags, ref, layer, turnLanes, rise], ...]}
// Node and edge ids are global (tiles list edge ids). An edge is in every chunk it passes through, so a chunk holds
// every edge touching its area, and both of their end nodes.
const rchunks = new Map(), chunkOf = (x, z) => `${Math.floor(x / ROAD_CHUNK)}_${Math.floor(z / ROAD_CHUNK)}`;
edges.forEach((e, id) => {
  const ks = keysAlong(e, 5, chunkOf);
  for (const k of ks) { let c = rchunks.get(k); if (!c) rchunks.set(k, (c = { n: new Set(), e: [] })); c.e.push(id); c.n.add(e.a); c.n.add(e.b); }
});
let roadBytes = 0, roadMax = 0;
for (const [k, c] of rchunks) {
  const json = JSON.stringify({
    n: [...c.n].sort((a, b) => a - b).flatMap((i) => { const n = nodes2[i]; return [i, r1(n.x), r1(n.z), r1(n.y), n.ctrl, n.closed ? 1 : 0]; }),
    e: c.e.map((id) => { const e = edges[id]; return [id, e.a, e.b, CLASSES.indexOf(e.cl), e.lf, e.lb, r1(e.speed), e.name, e.bridge, e.width, simplifyLine(e.pts, 0.15).flatMap(([x, z]) => [r1(x), r1(z)]), e.flags, e.ref, e.layer, e.turn, e.rise]; }),
  });
  fs.writeFileSync(`${OUT}roads/${k}.json`, json); roadBytes += json.length; roadMax = Math.max(roadMax, json.length);
}
log(`road chunks ${rchunks.size}, ${(roadBytes / 1e6).toFixed(1)} MB, biggest ${(roadMax / 1e3).toFixed(0)} KB`);

// ---------- overview: coarse terrain (64 m), far-city boxes, major roads for the map ----------
const CS = 64, CW = Math.ceil((GW * CELL) / CS) + 1, CH = Math.ceil((GH * CELL) / CS) + 1;
const coarseH = new Int16Array(CW * CH), coarseW = new Uint8Array(CW * CH);
for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) {
  const x = GX0 + i * CS, z = GZ0 + j * CS; coarseH[j * CW + i] = Math.round(heightAt(x, z) * 10);
  let wet = 0; for (const [dx, dz] of [[0, 0], [-16, -16], [16, -16], [-16, 16], [16, 16]]) if (clsAt(x + dx, z + dz) === C.water) wet++;
  coarseW[j * CW + i] = wet >= 3 ? 1 : 0;
}
// far boxes: everything but small houses/sheds outside Davenport (they're invisible from far away anyway)
const farB = bld.filter((b) => b.area > 600 || b.h > 12 || (!b.ms && b.area > 90 && districtFast(b.cx, b.cz) !== 'rural' && districtFast(b.cx, b.cz) !== 'town')); // (Microsoft houses stay out: startup size)
const mapRoads = {};
for (const e of edges) if (['motor', 'trunk', 'primary', 'secondary', 'tertiary'].includes(e.cl)) (mapRoads[e.cl] = mapRoads[e.cl] || []).push(simplifyLine(e.pts, 4).flatMap(([x, z]) => [Math.round(x), Math.round(z)]));
fs.writeFileSync(OUT + 'overview.json', JSON.stringify({
  b: farB.flatMap((b) => [Math.round(b.cx), Math.round(b.cz), Math.round(b.y), Math.round(b.h), Math.round(Math.sqrt(b.area) / 2), b.style]),
  skyline: [], coarse: { x0: GX0, z0: GZ0, step: CS, w: CW, h: CH, heightsD: (() => { const b = []; let prev = 0; for (let k = 0; k < coarseH.length; k++) { const q = Math.round(coarseH[k] / 5), d = q - prev; if (d > -128 && d < 128) b.push(d & 255); else b.push(128, q & 255, (q >> 8) & 255); prev = q; } return Buffer.from(b).toString('base64'); })(), // 0.5 m steps, int8 deltas (-128 = absolute int16 follows)
  kindRle: (() => { const r = []; for (let k = 0; k < coarseW.length;) { let n = 1; while (k + n < coarseW.length && coarseW[k + n] === coarseW[k] && n < 255) n++; r.push(coarseW[k], n); k += n; } return Buffer.from(r).toString('base64'); })() }, roads: mapRoads,
}));

// ---------- index ----------
const ringsOut = (rings) => rings.map((g) => simplifyLine(g, 25).flatMap(([x, z]) => [Math.round(x), Math.round(z)]));
fs.writeFileSync(OUT + 'index.json', JSON.stringify({
  tile: TILE, tx0: TX0, tx1: TX1, tz0: TZ0, tz1: TZ1, riverLevel: RIVER_LEVEL, origin: ORIGIN,
  waterTiles: (() => { const land = new Set(tileList), out = []; for (let tz = TZ0; tz <= TZ1; tz++) for (let tx = TX0; tx <= TX1; tx++) if (!land.has(`${tx}_${tz}`)) out.push(`${tx}_${tz}`); return out; })(), // every other tile in range has land
  roads: { chunk: ROAD_CHUNK, n: nodes2.length, m: edges.length, classes: CLASSES, chunks: [...rchunks.keys()] },
  towns: towns.map((t) => ({ name: t.name, x: t.x, z: t.z, r: t.r, pop: t.pop, place: t.place, rings: ringsOut(t.rings) })),
  counties: counties.map((c) => ({ name: c.name, rings: ringsOut(c.rings) })),
  hoods, signs, crossings, ferries, runways, river,
  // named rivers/lakes for the HUD (smallest box containing you wins)
  waters: areaPolys.filter((a) => a.code === C.water && a.tags.name).map((a) => { const A = a.outer.reduce((s2, g) => s2 + Math.abs(ringArea(g)), 0), [x0, x1, z0, z1] = bboxOf(a.outer.flat()); return { name: a.tags.name, a: Math.round(A), box: [Math.round(x0), Math.round(z0), Math.round(x1), Math.round(z1)] }; }).filter((w) => w.a > 2e4),
  police, hospitals, fire,
  poi: poi.filter((p) => p.name),
}));
const sz = (f) => (fs.statSync(OUT + f).size / 1e6).toFixed(2) + ' MB';
log(`index.json ${sz('index.json')}, overview.json ${sz('overview.json')}, rail.json ${sz('rail.json')}`);
log(`stations: police ${police.length}, hospitals ${hospitals.length}, fire ${fire.length}; POIs ${poi.length}`);

// ---------- preview image (debug, every 4th cell) ----------
const COL = [[136, 176, 104], [52, 118, 160], [96, 160, 80], [54, 104, 58], [90, 92, 98], [150, 150, 145], [130, 120, 110], [120, 150, 110], [210, 200, 150], [60, 62, 66], [190, 190, 185], [205, 160, 130], [120, 170, 90], [0, 0, 0], [196, 186, 120], [160, 190, 110], [120, 160, 80], [110, 190, 100], [140, 120, 110], [90, 130, 120], [80, 140, 170], [70, 130, 180], [150, 170, 120], [110, 130, 80], [170, 150, 120], [170, 160, 150]];
const PW = Math.floor(GW / 4), PH = Math.floor(GH / 4), png = new PNG({ width: PW, height: PH });
for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) {
  const c = cls[j * 4 * GW + i * 4], col = COL[c] || [255, 0, 255], hh = height[Math.min(HH - 1, j * 2) * HW + Math.min(HW - 1, i * 2)], shade = c === C.water ? 1 : Math.max(0.6, Math.min(1.25, 0.75 + hh / 80)), k = (j * PW + i) * 4;
  png.data[k] = col[0] * shade; png.data[k + 1] = col[1] * shade; png.data[k + 2] = col[2] * shade; png.data[k + 3] = 255;
}
fs.writeFileSync(here('cache/preview.png'), PNG.sync.write(png));
log('preview written to tools/cache/preview.png');
