// Area archetypes: every building and street on the map is classed from real data (OSM tags, ground use,
// town centres, street shape, footprint shape) so every town, suburb, strip and farm gets the same depth.
// Notes and sources: docs/references.md ("Area realism").
//
// Data this reads (tools/build-map.mjs "tile format"; old tiles without the extras still work, using the defaults):
//   building record [rel, baseY, hgt, pitched, style, name, kind, extra?], extra = {t type, l levels, r roof shape,
//     rc roof colour, m wall material, co wall colour, s shop/amenity, mh min height}
//   edge flags (data.js): 2 brick, 4 gravel, 8/16/32 sidewalk both/left/right, 64 lit, 128 turn lanes (e.turn), 4096 median
//   t.p points {key: [x, z, (v)...]}, t.l lines {key: [[x, z, ...]]}, t.a areas {key: [[x, z, ...]]} (tile-relative)
import { TILE, C, G, terrainHeight, district, nearestEdge } from './data.js';

const hash = (n) => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
const M_LAT = 110574, M_LON = 111320 * Math.cos((41.5236 * Math.PI) / 180);
const ll = (lat, lon) => [(lon + 90.5776) * M_LON, -(lat - 41.5236) * M_LAT];

// Town centres (main street / downtown core), from OSM place nodes and the downtown streets in the notes.
// r = core radius (storefront rows), pw = how far the pre-war town reached (grid streets, alleys, old houses),
// y0 = when the core was built up. Coordinates are approximate centre points of each downtown.
export const TOWNS = [
  ['Davenport', 41.5228, -90.5745, 700, 3600, 1860, 'city'],
  ['East Davenport', 41.5305, -90.5440, 260, 700, 1860, 'main'],
  ['Rock Island', 41.5096, -90.5787, 450, 2800, 1870, 'city'],
  ['Moline', 41.5066, -90.5150, 450, 2600, 1880, 'city'],
  ['Bettendorf', 41.5258, -90.5105, 320, 1300, 1910, 'main'],
  ['East Moline', 41.5011, -90.4442, 300, 1400, 1905, 'main'],
  ['Silvis', 41.5121, -90.4150, 200, 800, 1910, 'main'],
  ['Milan', 41.4532, -90.5717, 200, 700, 1890, 'main'],
  ['Le Claire', 41.5975, -90.3437, 280, 700, 1860, 'main'],
  ['Port Byron', 41.6065, -90.3355, 180, 500, 1870, 'main'],
  ['Geneseo', 41.4482, -90.1544, 330, 1300, 1870, 'main'],
  ['Colona', 41.4836, -90.3541, 130, 500, 1920, 'main'],
  ['Coal Valley', 41.4287, -90.4607, 150, 600, 1910, 'main'],
  ['Carbon Cliff', 41.4950, -90.3907, 110, 400, 1910, 'main'],
  ['Hampton', 41.5578, -90.4093, 150, 500, 1880, 'main'],
  ['Rapids City', 41.5806, -90.3432, 110, 400, 1880, 'main'],
  ['Riverdale', 41.5367, -90.4626, 80, 300, 1950, 'main'],
  ['Eldridge', 41.6581, -90.5844, 180, 700, 1900, 'main'],
  ['Blue Grass', 41.5092, -90.7665, 130, 500, 1900, 'main'],
].map(([name, lat, lon, r, pw, y0, kind]) => { const [x, z] = ll(lat, lon); return { name, x, z, r, pw, y0, kind }; });

// Neighbourhoods whose era is known from their historic-district nominations (overrides the distance rule).
// [lat, lon, radius m, typical year, style hint]
const HOOD_ERA = [
  [41.5275, -90.5880, 550, 1875, 'victorian'], // Gold Coast / Hamburg (Italianate, Second Empire, Queen Anne)
  [41.5265, -90.5930, 400, 1870, 'victorian'], // Hamburg
  [41.5305, -90.5760, 550, 1895, null], // Hilltop / College Square
  [41.5395, -90.5715, 550, 1905, null], // Vander Veer Park district (1895-1915)
  [41.5300, -90.5330, 750, 1915, null], // McClellan Heights (1894-1940, curving streets)
  [41.5420, -90.5520, 600, 1915, null], // Prospect Park
  [41.5300, -90.5440, 450, 1870, null], // Village of East Davenport
  [41.4960, -90.5660, 350, 1910, null], // Highland Park, Rock Island (1895-1928)
  [41.5040, -90.5770, 400, 1885, 'victorian'], // Broadway district, Rock Island
  [41.5195, -90.6060, 900, 1910, null], // West End (1900-1940 frame houses)
].map(([lat, lon, r, y, s]) => { const [x, z] = ll(lat, lon); return { x, z, r, y, s }; });

export function nearestTown(x, z) {
  let best = TOWNS[0], bd = Infinity;
  for (const t of TOWNS) { const d = Math.hypot(t.x - x, t.z - z) - t.r; if (d < bd) { bd = d; best = t; } }
  return { town: best, d: Math.hypot(best.x - x, best.z - z) };
}
// ground classes that mean crop fields (old data: 13 = beyond the mapped land; new data may add a farmland class)
// (13 = outside the mapped area, not farmland; old tiles mapped farmland as lawn, so they get no crop rows)
const FARM = new Set([C.farm].filter((v) => v != null));
export const isFarmClass = (c) => FARM.has(c);

// optional tags on a building record (new tile format), else {}
export const tagsOf = (rec) => (rec[7] && typeof rec[7] === 'object' ? rec[7] : {});
const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : null; };
function yearOf(v) { const m = String(v ?? '').match(/(1[7-9]\d\d|20[0-2]\d)/); return m ? +m[1] : null; }

function polyStats(rel) {
  const n = rel.length / 2; let a = 0, per = 0, cx = 0, cz = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, x0 = rel[i * 2], z0 = rel[i * 2 + 1], x1 = rel[j * 2], z1 = rel[j * 2 + 1];
    a += x0 * z1 - x1 * z0; per += Math.hypot(x1 - x0, z1 - z0); cx += x0; cz += z0;
  }
  cx /= n; cz /= n; a = Math.abs(a) / 2;
  // oriented extent along the longest wall (aspect)
  let lb = 0, ux = 1, uz = 0;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n, dx = rel[j * 2] - rel[i * 2], dz = rel[j * 2 + 1] - rel[i * 2 + 1], l = Math.hypot(dx, dz); if (l > lb) { lb = l; ux = dx / l; uz = dz / l; } }
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (let i = 0; i < n; i++) { const px = rel[i * 2] - cx, pz = rel[i * 2 + 1] - cz, u = px * ux + pz * uz, v = -px * uz + pz * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  const L = u1 - u0, W = v1 - v0;
  return { area: a, per, n, cx, cz, aspect: Math.max(L, W) / Math.max(0.1, Math.min(L, W)), circ: per > 0 ? (4 * Math.PI * a) / (per * per) : 0 };
}

// Per-tile stats from the ground grid and the buildings (cached on the tile).
export function tileStats(t) {
  if (t.st) return t.st;
  let farm = 0, paved = 0, ind = 0, park = 0, lawn = 0, parking = 0, resid = 0, yard = 0;
  for (let k = 0; k < 2500; k++) {
    const c = t.c[k];
    if (FARM.has(c)) farm++; else if (c === C.paved) paved++; else if (c === C.industrial) ind++; else if (c === C.park || c === C.wood) park++;
    else if (c === C.lawn) lawn++; else if (c === C.parking) parking++; else if (c === C.residential) resid++; else if (c === C.farmyard) yard++;
  }
  let barea = 0; for (const rec of t.b) barea += polyStats(rec[0]).area;
  const { town, d } = nearestTown(t.ox + TILE / 2, t.oz + TILE / 2);
  // farmland (OSM fields or farmyards) or almost empty land well outside a town, and not a mapped residential area
  const rural = farm > 875 || yard > 60 || (t.b.length < 6 && d > town.pw + 400 && resid < 150 && paved + ind + parking < 150);
  return (t.st = { resid: resid / 2500, farm: farm / 2500, paved: paved / 2500, ind: ind / 2500, park: park / 2500, lawn: lawn / 2500, parking: parking / 2500, dens: barea / (TILE * TILE), nb: t.b.length, rural, town, d });
}

// Is this spot a town core (storefront rows)?
export function coreAt(x, z) {
  if (district(x, z) === 'downtown') return true; // downtown Davenport keeps its hand-drawn bounds
  for (const t of TOWNS) if (t.name !== 'Davenport' && Math.hypot(t.x - x, t.z - z) < t.r) return true; // incl. the Village's 11th St / Mound St core
  return false;
}

// The edge's surroundings: 'core' | 'res' | 'suburb' | 'strip' | 'industrial' | 'rural'. Cached on the edge.
export function edgeArea(e, t) {
  if (e.area) return e.area;
  const mx = e.pts[Math.floor(e.pts.length / 4) * 2], mz = e.pts[Math.floor(e.pts.length / 4) * 2 + 1];
  const st = t ? tileStats(t) : null;
  let a = 'res';
  if (coreAt(mx, mz)) a = 'core';
  else if (st && st.rural) a = 'rural';
  else if (st && st.ind > 0.3) a = 'industrial';
  else if (st && st.paved + st.parking > 0.28 && ['primary', 'secondary', 'trunk', 'tertiary'].includes(e.cls)) a = 'strip';
  else { const yr = eraAt(mx, mz, e); a = yr >= 1975 ? 'suburb' : 'res'; }
  // only cache once the tile's stats were known (edges cross tiles)
  if (t) e.area = a;
  return a;
}

// Road shape: grid streets (straight, long) are pre-war; curving streets and cul-de-sacs are post-war.
export function curvy(e) {
  if (e.curvy !== undefined) return e.curvy;
  const P = e.pts, n = P.length / 2, ch = Math.hypot(P[n * 2 - 2] - P[0], P[n * 2 - 1] - P[1]);
  const sinu = e.len / Math.max(1, ch);
  const deadEnd = G.adj && (G.adj[e.a]?.length === 1 || G.adj[e.b]?.length === 1);
  return (e.curvy = sinu > 1.07 || (deadEnd && e.cls === 'residential' && e.len < 260 && e.len > 40));
}

// Rough build year at a spot: historic districts first, then distance from the town's core (pre-war grid inside
// pw, then growth outward at ~100 m a year), pushed later on curving streets.
export function eraAt(x, z, e = null) {
  for (const h of HOOD_ERA) if (Math.hypot(h.x - x, h.z - z) < h.r) return h.y;
  const { town, d } = nearestTown(x, z);
  // pre-war: from the core's founding years at its edge to ~1935 at the edge of the grid (Davenport: 1880s at 1.5 km, ~1920 at 3 km)
  let y = d < town.pw ? town.y0 + Math.max(0, 1935 - town.y0) * Math.max(0, (d - town.r * 0.6) / (town.pw - town.r * 0.6)) : 1948 + Math.min(60, (d - town.pw) / 100);
  if (e && curvy(e)) y = Math.max(y, 1968);
  return Math.round(Math.min(2015, y));
}

// House styles: 'victorian' | 'cottage' | 'foursquare' | 'bungalow' | 'ranch' | 'modern2' | 'farmhouse'
// Wall (eave) height above the base, roof pitch (rise / half-span) and roof form per style.
export const HOUSE = {
  victorian: { eave: 7.4, pitch: 1.0, roof: 'gable', porch: 'wrap' },
  cottage: { eave: 4.5, pitch: 0.8, roof: 'gable', porch: 'small' },
  foursquare: { eave: 6.8, pitch: 0.5, roof: 'hip', porch: 'full', dormer: true },
  bungalow: { eave: 3.9, pitch: 0.42, roof: 'gable', porch: 'full', dormer: true },
  ranch: { eave: 3.0, pitch: 0.3, roof: 'gable', porch: 'stoop', garage: 1 },
  modern2: { eave: 6.0, pitch: 0.55, roof: 'gable', porch: 'small', garage: 2 },
  farmhouse: { eave: 6.6, pitch: 0.8, roof: 'gable', porch: 'full' },
};

// Decide what each building is (cached as rec.arch) and set realistic heights where OSM has none.
// Runs once per tile when its data arrives (before collision walls are made), so walls, roofs and visuals agree.
export function applyArchetypes(t) {
  if (t.archDone) return; t.archDone = true;
  const st = tileStats(t);
  t.b.forEach((rec, bi) => {
    const [rel, , hgt, pitched, , name, kind = 0] = rec;
    const tg = tagsOf(rec), ps = polyStats(rel), x = ps.cx + t.ox, z = ps.cz + t.oz, seed = t.tx * 7919 + t.tz * 104729 + bi * 31;
    const lv = num(tg.l ?? tg.levels), ht = num(tg.height), tagged = lv != null || ht != null;
    const type = tg.t || tg.type || '', roofTag = tg.r || tg.roof || '';
    const a = { area: 'res', style: null, year: yearOf(tg.start ?? tg.sd), round: ps.circ > 0.86 && ps.n >= 7, nv: ps.n, fp: ps.area, aspect: ps.aspect, roofTag, mat: tg.m || '', col: tg.co || '', roofCol: tg.rc || '', shop: tg.s || '' };
    a.canopy = /^(roof|carport)$/.test(type); // gas-station / drive-thru canopies: open underneath
    const core = coreAt(x, z);
    const farmB = /^(barn|farm_auxiliary|silo|cowshed|stable|sty|greenhouse|grain_bin)$/.test(type);
    if (core && !(pitched && ps.area < 420 && kind !== 5)) a.area = 'core'; // houses in and around a core stay houses
    else if (kind === 4 || rec[4] === 5 || /^(industrial|warehouse|manufacture)$/.test(type) || (!pitched && t.c[Math.min(49, Math.max(0, Math.floor(ps.cz / 4))) * 50 + Math.min(49, Math.max(0, Math.floor(ps.cx / 4)))] === C.industrial)) a.area = 'industrial';
    else if (st.rural || farmB) a.area = 'rural';
    else if (kind === 5 || /^(retail|commercial|supermarket)$/.test(type) || (!pitched && ps.area > 900 && kind !== 2 && kind !== 3 && kind !== 1)) a.area = 'strip';
    else a.area = 'res';
    // what to set the height to when OSM has no levels/height
    let h = null;
    if (a.area === 'rural' && kind !== 2 && kind !== 3) {
      // farmsteads: round = silo or grain bin, big = barn or machine shed, house-sized = farmhouse, small = shed
      if (a.round || type === 'silo' || type === 'grain_bin') { const r = Math.sqrt(ps.area / Math.PI); a.style = r < 3.6 && type !== 'grain_bin' ? 'silo' : 'bin'; h = a.style === 'silo' ? 16 + hash(seed) * 8 : Math.max(4, r * 1.1); }
      else if (type === 'barn' || (ps.area > 170 && ps.area < 700 && ps.aspect < 2.4 && type !== 'house')) { a.style = 'barn'; h = 4.2; }
      else if (ps.area >= 700 || type === 'farm_auxiliary' || type === 'industrial') { a.style = 'shed_big'; h = 5.2; }
      else if (ps.area >= 70 && pitched !== 0 || type === 'house' || type === 'farm') { a.style = 'farmhouse'; }
      else if (ps.area < 70) { a.style = 'shed'; h = 3.0; }
    }
    const garageLike = /^(garage|garages|shed)$/.test(type) || (pitched && hgt < 4.2 && !tagged);
    if (!a.style && pitched && !garageLike && ps.area < 420 && kind !== 2 && kind !== 3 && a.area !== 'core' && a.area !== 'strip') {
      // a house: its era from start_date, else the area rules; its style from era + footprint shape
      const yr = a.year ?? eraAt(x, z, roadNear(x, z));
      a.year = yr;
      const hood = HOOD_ERA.find((hh) => Math.hypot(hh.x - x, hh.z - z) < hh.r);
      const square = ps.aspect < 1.3;
      if (hood?.s === 'victorian' && ps.area > 80) a.style = 'victorian';
      else if (yr < 1900) a.style = ps.area > 115 || ps.n >= 8 ? 'victorian' : 'cottage';
      else if (yr < 1930) a.style = square && ps.area > 60 && ps.area < 150 ? 'foursquare' : ps.n >= 9 && ps.area > 130 ? 'victorian' : 'bungalow';
      else if (yr < 1946) a.style = 'cottage';
      else if (yr < 1978) a.style = ps.area > 95 || ps.aspect > 1.45 ? 'ranch' : 'cottage';
      else a.style = ps.area > 165 ? 'modern2' : 'ranch';
      if (lv === 1 && (a.style === 'victorian' || a.style === 'foursquare' || a.style === 'modern2')) a.style = yr < 1946 ? 'bungalow' : 'ranch';
      if (lv >= 2 && (a.style === 'ranch' || a.style === 'bungalow' || a.style === 'cottage')) a.style = yr < 1930 ? 'foursquare' : 'modern2';
      a.area = a.year >= 1975 ? 'suburb' : 'res';
    }
    if (a.canopy) { a.style = 'canopy'; h = Math.max(4.6, Math.min(6, hgt)); }
    if (garageLike && !a.style) a.style = 'garage';
    if (a.style && HOUSE[a.style]) h = HOUSE[a.style].eave;
    if (!tagged && a.area === 'core' && !pitched && kind !== 1 && kind !== 2 && !/(Figge|River Center|Blackhawk|Adler|Kahl|Putnam|Davenport Bank|MidAmerican)/.test(name)) {
      // storefront blocks: 2 storeys on narrow lots, 3 on wider ones (ground floor ~4.5 m, uppers ~3.8 m)
      if (district(x, z) !== 'downtown' || hgt < 10) h = ps.area < 260 ? 8.6 : ps.area < 900 ? 12.4 : null;
    }
    if (!tagged && a.area === 'strip' && !pitched && ps.area > 1800) h = Math.min(hgt, 7 + Math.min(3, ps.area / 4000));
    // OSM levels/height win (the map build already turned them into the height)
    if (!tagged && h != null) rec[2] = Math.round(h * 10) / 10;
    rec.arch = a;
  });
}
// nearest real street (not service roads) for the street-shape rule
function roadNear(x, z) { const q = nearestEdge(x, z, 60, (e) => e.cls !== 'service'); return q ? q.e : null; }

// Tile features in world coordinates (cached per tile). Points: [{x, z, v}] (v = height for sl/wt/ch).
const STRIDE = { sl: 3, wt: 3, ch: 3 };
export function pointsOf(t, key) {
  const c = t._pt || (t._pt = {}); if (c[key]) return c[key];
  const a = t.p && t.p[key], out = [], s = STRIDE[key] || 2;
  if (Array.isArray(a)) for (let i = 0; i + 1 < a.length; i += s) out.push({ x: a[i] + t.ox, z: a[i + 1] + t.oz, v: s > 2 ? a[i + 2] : 0 });
  return (c[key] = out);
}
const shift = (t, l) => { const f = new Float32Array(l.length); for (let i = 0; i < l.length; i += 2) { f[i] = l[i] + t.ox; f[i + 1] = l[i + 1] + t.oz; } return f; };
// Lines / areas: [Float32Array x, z, ...]
export function linesOf(t, key) { const c = t._ln || (t._ln = {}); if (c[key]) return c[key]; const a = t.l && t.l[key]; return (c[key] = Array.isArray(a) ? a.filter((l) => l.length >= 4).map((l) => shift(t, l)) : []); }
export function areasOf(t, key) { const c = t._ar || (t._ar = {}); if (c[key]) return c[key]; const a = t.a && t.a[key]; return (c[key] = Array.isArray(a) ? a.filter((l) => l.length >= 6).map((l) => shift(t, l)) : []); }
export const inPoly = (x, z, p) => { let c = false; for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) if ((p[i + 1] > z) !== (p[j + 1] > z) && x < ((p[j] - p[i]) * (z - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]) c = !c; return c; };
// direction of a polygon's longest side (fields and lots are laid out along it)
export function longAxis(p) { let b = 0, h = 0; for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) { const dx = p[i] - p[j], dz = p[i + 1] - p[j + 1], l = dx * dx + dz * dz; if (l > b) { b = l; h = Math.atan2(dx, dz); } } return h; }
