// Builds the meshes and collision walls for one 200 m tile of the Quad Cities.
// Every building and street is first classed by src/city/areas.js (town core, old neighbourhood, newer suburb,
// commercial strip, industrial, farmland) from real data, and drawn with that archetype's look the same way everywhere.
import * as THREE from 'three';
import { TILE, C, G, D, terrainHeight, district, pointOnEdge, nearestEdge } from './data.js';
import { makeBox } from './collide.js';
import { M, CELL, STYLE_CELL, SIGN_NAMES } from './mats.js';
import { Buf, face, tri, obox, panel, lin, hash, PLAIN } from './geom.js';
import { applyArchetypes, edgeArea, coreAt, HOUSE, pointsOf } from './areas.js';
import { nameUV, displayName, STRIP_FOOD, GHOST } from './names.js';
import { streetSigns, powerLines, parkingDetail, crops, dataPoints, dataLines, placeOff, validatePlacements, regionPlaces, roadHit } from './detail.js';

// ---------- ground colours ----------
const GROUND = [];
GROUND[C.lawn] = 0x84a85c; GROUND[C.water] = 0x5a5844; GROUND[C.park] = 0x74ad52; GROUND[C.wood] = 0x557c3c;
GROUND[C.parking] = 0x5d6064; GROUND[C.paved] = 0x96938d; GROUND[C.industrial] = 0x8f897c; GROUND[C.cemetery] = 0x80a75e;
GROUND[C.sand] = 0xcdbb8a; GROUND[C.road] = 0x5a5d61; GROUND[C.walk] = 0xa9a59c; GROUND[C.building] = 0x8d8a84;
GROUND[C.pitch] = 0x63ab4b; GROUND[C.offmap] = 0x7d9461;
// newer map classes (tools/build-map.mjs); missing on old data, which is fine
const MORE = { farm: 0x8e9a5a, meadow: 0x93ad62, orchard: 0x6f9c4a, golf: 0x6cb552, rail: 0x7d7466, wetland: 0x6d8a5a, creek: 0x6b6a52, pond: 0x5a5844, residential: 0x84a85c, scrub: 0x6f8a4c, farmyard: 0x9c9478, quarry: 0xb5ab95 };
for (const [k, v] of Object.entries(MORE)) if (C[k] != null) GROUND[C[k]] = v;
const GROUND_LIN = Array.from(GROUND, (h) => lin(h ?? 0x84a85c));

function buildTerrain(t, B, step = 4) { // step 8 for the far LOD (same heights on the tile edges, so no cracks)
  const S = TILE / step + 1, cs = step / 4;
  const hgt = new Float32Array(S * S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) hgt[j * S + i] = terrainHeight(t.ox + i * step, t.oz + j * step);
  const cls = (i, j) => t.c[Math.max(0, Math.min(49, j)) * 50 + Math.max(0, Math.min(49, i))];
  // unmapped ground in a town core is paved lots and plazas, not lawn
  const urban = coreAt(t.ox + 100, t.oz + 100);
  const URBAN = lin(0x8f8b83);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const x = t.ox + i * step, z = t.oz + j * step, y = hgt[j * S + i];
    const hx = terrainHeight(x + 2, z) - terrainHeight(x - 2, z), hz = terrainHeight(x, z + 2) - terrainHeight(x, z - 2);
    const nl = Math.hypot(hx, 4, hz);
    let r = 0, g = 0, b = 0;
    for (const [di, dj] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) { const k0 = cls(i * cs + di, j * cs + dj); const c = urban && k0 === C.lawn ? URBAN : GROUND_LIN[k0] || GROUND_LIN[0]; r += c[0]; g += c[1]; b += c[2]; }
    const k = (0.93 + hash(x * 0.37 + z * 1.13) * 0.12) / 4;
    B.v(x, y, z, -hx / nl, 4 / nl, -hz / nl, r * k, g * k, b * k, x / 7, z / 7);
  }
  for (let j = 0; j < S - 1; j++) for (let i = 0; i < S - 1; i++) { const a = j * S + i; B.quad(a, a + S, a + S + 1, a + 1); }
}

// ---------- roads ----------
// Ground layers never overlap at the same depth (that's what flickered): each edge's strip stops where its junction
// starts, a junction is one convex polygon over the ends of its legs, two edges meeting end to end share a mitred joint,
// and the layers that do overlap (sidewalk < lot / driveway < minor road < major road < paint) are a depth-offset step
// apart (mats.js). Tunnels aren't drawn.
const legs = (k) => G.adj[k].map((id) => G.edges[id]).filter(Boolean);
// unit direction leaving node k along e (its first / last segment)
function legDir(e, k) {
  const P = e.pts, n = P.length / 2, atA = k === e.a;
  const ax = atA ? P[0] : P[n * 2 - 2], az = atA ? P[1] : P[n * 2 - 1], bx = atA ? P[2] : P[n * 2 - 4], bz = atA ? P[3] : P[n * 2 - 3], l = Math.hypot(bx - ax, bz - az) || 1;
  return [(bx - ax) / l, (bz - az) / l];
}
// where two edges meet end to end (a way split): the shared joint's tangent, so both strips end on the same mitre line
function joint(e, k, own) {
  const L = legs(k); if (L.length !== 2 || L[0] === L[1]) return null;
  const od = legDir(L[0] === e ? L[1] : L[0], k), atA = k === e.a;
  const tx = atA ? own[0] - od[0] : own[0] + od[0], tz = atA ? own[1] - od[1] : own[1] + od[1], l = Math.hypot(tx, tz);
  return l < 0.35 ? null : [tx / l, tz / l]; // (a hairpin: leave it square)
}
const dense = new Map(); // edge id -> {x, z, s, nx, nz, sc, m} (points every <= 5 m, mitred normals)
function denseOf(e) {
  let d = dense.get(e.id); if (d) return d;
  const P = e.pts, np = e.cum.length, xs = [], zs = [], ss = [];
  for (let i = 1; i < np; i++) {
    const ax = P[i * 2 - 2], az = P[i * 2 - 1], bx = P[i * 2], bz = P[i * 2 + 1], L = e.cum[i] - e.cum[i - 1], n = Math.max(1, Math.ceil(L / 5));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) { xs.push(ax + ((bx - ax) * k) / n); zs.push(az + ((bz - az) * k) / n); ss.push(e.cum[i - 1] + (L * k) / n); }
  }
  const m = xs.length, nx = new Float32Array(m), nz = new Float32Array(m), sc = new Float32Array(m);
  for (let k = 0; k < m; k++) {
    const k0 = Math.max(0, k - 1), k1 = Math.min(m - 1, k + 1);
    let dx = xs[k1] - xs[k0], dz = zs[k1] - zs[k0]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    // (-dz, dx) is the right-hand side of travel a->b (x east, z south); both sides are built symmetrically
    nx[k] = -dz; nz[k] = dx; sc[k] = 1;
    if (k > 0 && k < m - 1) {
      const ux = xs[k] - xs[k - 1], uz = zs[k] - zs[k - 1], vx = xs[k + 1] - xs[k], vz = zs[k + 1] - zs[k];
      const lu = Math.hypot(ux, uz) || 1, lv = Math.hypot(vx, vz) || 1;
      sc[k] = Math.min(2, 1 / Math.max(0.5, Math.sqrt((1 + (ux * vx + uz * vz) / (lu * lv)) / 2)));
    } else {
      const T = joint(e, k === 0 ? e.a : e.b, [dx, dz]);
      if (T) { nx[k] = -T[1]; nz[k] = T[0]; sc[k] = Math.min(2, 1 / Math.max(0.5, T[0] * dx + T[1] * dz)); }
    }
  }
  d = { x: xs, z: zs, s: ss, nx, nz, sc, m };
  dense.set(e.id, d);
  return d;
}
// the strip's point at distance s along e, o metres to the side (exactly what the strip quads interpolate)
function stripAt(e, s, o) {
  const d = denseOf(e); let k = 0; while (k < d.m - 2 && d.s[k + 1] < s) k++;
  const f = Math.max(0, Math.min(1, (s - d.s[k]) / ((d.s[k + 1] - d.s[k]) || 1)));
  const xa = d.x[k] + d.nx[k] * o * d.sc[k], za = d.z[k] + d.nz[k] * o * d.sc[k], xb = d.x[k + 1] + d.nx[k + 1] * o * d.sc[k + 1], zb = d.z[k + 1] + d.nz[k + 1] * o * d.sc[k + 1];
  return [xa + (xb - xa) * f, za + (zb - za) * f];
}
function hull(P) { // convex hull (monotone chain), counter-clockwise in x/z
  P = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
// A junction (3+ legs): how far each leg's strip is cut back (far enough that neighbouring legs no longer overlap, even
// at sharp angles) and the paved polygon over the middle. Cached; recomputed if more legs load.
const JN = new Map();
export function junction(k) {
  const L = legs(k); if (L.length < 3) return null;
  let J = JN.get(k); if (J && J.n === L.length) return J;
  const lg = L.map((e) => { const d = legDir(e, k); return { e, hw: e.width / 2, a: Math.atan2(d[1], d[0]) }; }).sort((p, q) => p.a - q.a);
  let hwMax = 0; for (const g of lg) hwMax = Math.max(hwMax, g.hw);
  let r = hwMax + 0.8;
  for (let i = 0; i < lg.length; i++) {
    const p = lg[i], q = lg[(i + 1) % lg.length]; let th = q.a - p.a; if (th <= 0) th += Math.PI * 2;
    if (th > Math.PI - 0.05) continue;
    const sn = Math.max(0.2, Math.sin(th)), cs = Math.cos(th);
    r = Math.max(r, (q.hw + p.hw * cs) / sn + 0.3, (p.hw + q.hw * cs) / sn + 0.3); // where the two legs' facing kerbs cross
  }
  r = Math.min(r, hwMax * 3 + 2);
  const trim = new Map(), ring = [[G.nodes.x[k], G.nodes.z[k]]];
  for (const g of lg) { const s = Math.min(r, g.e.len * 0.45), at = g.e.a === k ? s : g.e.len - s; trim.set(g.e.id, s); ring.push(stripAt(g.e, at, g.hw), stripAt(g.e, at, -g.hw)); }
  J = { n: L.length, r, trim, poly: hull(ring) };
  JN.set(k, J);
  return J;
}
// radius of the paved junction at a node (stop lines, crosswalks and signs sit just outside it)
export function nodeRadius(k) {
  const J = junction(k); if (J) return J.r;
  let r = 0; for (const e of legs(k)) r = Math.max(r, e.width / 2);
  return r;
}
const trimAt = (e, k) => { const J = junction(k); return J ? J.trim.get(e.id) ?? J.r : 0; };
const ROAD_COL = { motor: 0x4a4d52, trunk: 0x4a4d52, primary: 0x4c4f53, secondary: 0x515458, tertiary: 0x56595d, minor: 0x5c5f62, residential: 0x5e6164, service: 0x66686a, track: 0x8f8572 };
const SIDEWALK = (e) => e.cls !== 'service' && e.cls !== 'motor' && e.cls !== 'trunk' && e.cls !== 'track';
const WALK_W = 2.2;
const inTile = (t, x, z) => x >= t.ox && x < t.ox + TILE && z >= t.oz && z < t.oz + TILE;
// How a street looks, from its tags (edge flags) and its surroundings. Rural roads with no surface tag: Scott County's
// county roads are ~58% gravel (docs/references.md), so local roads out there are gravel unless tagged paved.
function roadLook(e, t) {
  if (e.look) return e.look;
  const a = edgeArea(e, t), f = e.flags | 0;
  const gravel = !!(f & 4) || (e.cls === 'track' && !(f & 2)) || (!(f & 6) && a === 'rural' && (e.cls === 'residential' || e.cls === 'minor' || e.cls === 'service') && hash(e.id * 0.7) < 0.58);
  const sw = f & 8 ? [1, -1] : f & 16 ? [-1] : f & 32 ? [1] : SIDEWALK(e) && a !== 'rural' && !gravel ? [1, -1] : [];
  return (e.look = { a, gravel, brick: !!(f & 2), sw, lit: !!(f & 64), median: !!(f & 4096) });
}
const BIG = new Set(['primary', 'secondary', 'tertiary', 'trunk', 'motor']);
const RANKC = { motor: 7, trunk: 6, primary: 5, secondary: 4, tertiary: 3, minor: 2, residential: 1, service: 0, track: 0 };
const surfCol = (e, L) => (L.gravel ? (e.cls === 'track' ? 0x8f8572 : 0xa39b8a) : L.brick ? 0x8a4b3b : ROAD_COL[e.cls] || 0x5a5d61);
// sidewalk layers by area: kerb, then a brick strip downtown or a grass parkway in the neighbourhoods, then the walk
function walkLayers(L, big, C3) {
  const [CURB, WALKC, BRICKW, GRASS, walkB, groundB] = C3;
  return L.a === 'core' ? [[-0.2, 0.15, CURB, walkB, 1.5], [0.15, 1.35, big ? BRICKW : WALKC, walkB, 1.5], [1.35, WALK_W + 0.6, WALKC, walkB, 1.5]]
    : (L.a === 'res' || L.a === 'suburb') && !big ? [[-0.2, 0.15, CURB, walkB, 1.5], [0.15, 0.9, GRASS, groundB, 7], [0.9, WALK_W + 0.3, WALKC, walkB, 1.5]]
      : [[-0.2, 0.15, CURB, walkB, 1.5], [0.15, WALK_W, WALKC, walkB, 1.5]];
}

// Bridge decks are solid slabs, not just a top surface: seen from the water or a road below, every raised deck has an
// underside, a fascia down each side with a low kerb lip on top, and concrete piers (a cap beam on one or two columns)
// every 40 m where it stands more than 5 m up. All in one plain vertex-coloured buffer (deckB, M.lod): about 6 quads per
// 5 m of deck and 14 per pier.
const DECK_T = { motor: 1.8, trunk: 1.6, primary: 1.3, secondary: 1.1 }; // slab + girder depth under the road surface
// (the underside colour is a little pink: the sky light from below is green-tinted, main.js hemi, so it reads as grey concrete)
const DECK_UNDER = lin(0x8f7a86), DECK_SIDE = lin(0xb1ada4), DECK_LIP = lin(0xc4c0b7), PIER = lin(0x9e9a92);
const PIER_STEP = 40;
// one 5 m piece of a bridge's slab (dense segment k of e, fractions fa..fb), from offset oL to oR across the road
function bridgeSlab(B, e, d, k, fa, fb, span, oL, oR, t) {
  const T = DECK_T[e.cls] || 0.9, LIP = 0.35;
  const at = (f, o) => { // [x, top y, z, bottom y, ground]
    const s = d.s[k] + span * f, xa = d.x[k] + d.nx[k] * o * d.sc[k], za = d.z[k] + d.nz[k] * o * d.sc[k], xb = d.x[k + 1] + d.nx[k + 1] * o * d.sc[k + 1], zb = d.z[k + 1] + d.nz[k + 1] * o * d.sc[k + 1];
    const x = xa + (xb - xa) * f, z = za + (zb - za) * f, y = pointOnEdge(e, s).y, g = terrainHeight(x, z);
    return [x, Math.max(y, g) + 0.06, z, y - T, g];
  };
  const aL = at(fa, oL), aR = at(fa, oR), bL = at(fb, oL), bR = at(fb, oR);
  if (Math.max(aL[1] - aL[4], aR[1] - aR[4], bL[1] - bL[4], bR[1] - bR[4]) < 0.5) return; // sitting on the ground: nothing shows
  const uv = [[0, 0], [1, 0], [1, 1], [0, 1]], P = (q, y) => [q[0], y, q[2]];
  face(B, [P(aL, aL[3]), P(aR, aR[3]), P(bR, bR[3]), P(bL, bL[3])], [0, -1, 0], DECK_UNDER, PLAIN, uv);
  for (const [a, b, sg] of [[aL, bL, -1], [aR, bR, 1]]) {
    const nx = d.nx[k] * sg, nz = d.nz[k] * sg, ix = -nx * 0.3, iz = -nz * 0.3;
    face(B, [P(a, a[3]), P(b, b[3]), P(b, b[1] + LIP), P(a, a[1] + LIP)], [nx, 0, nz], DECK_SIDE, PLAIN, uv); // fascia
    face(B, [P(a, a[1] + LIP), P(b, b[1] + LIP), [b[0] + ix, b[1] + LIP, b[2] + iz], [a[0] + ix, a[1] + LIP, a[2] + iz]], [0, 1, 0], DECK_LIP, PLAIN, uv); // lip top
    face(B, [[a[0] + ix, a[1], a[2] + iz], [b[0] + ix, b[1], b[2] + iz], [b[0] + ix, b[1] + LIP, b[2] + iz], [a[0] + ix, a[1] + LIP, a[2] + iz]], [-nx, 0, -nz], DECK_LIP, PLAIN, uv); // lip, road side
  }
  // piers at every 40 m mark along the edge that falls in this piece (and this tile), where the deck stands high enough
  const s0 = d.s[k] + span * fa, s1 = d.s[k] + span * fb;
  for (let sp = Math.ceil(s0 / PIER_STEP) * PIER_STEP; sp < s1; sp += PIER_STEP) {
    if (sp < 12 || sp > e.len - 12) continue; // the abutments carry the ends
    const f = (sp - d.s[k]) / span, c = at(f, (oL + oR) / 2);
    if (!inTile(t, c[0], c[2]) || c[3] - c[4] < 5) continue;
    const ux = d.x[k + 1] - d.x[k], uz = d.z[k + 1] - d.z[k], ul = Math.hypot(ux, uz) || 1, hx = ux / ul, hz = uz / ul, w = oR - oL;
    const cols = w > 13 ? [oL + 2.6, oR - 2.6] : [(oL + oR) / 2];
    const spots = cols.map((o) => at(f, o));
    if (spots.some((q) => roadHit(q[0], q[2], 1.2))) continue; // never a column in a road underneath
    for (const q of spots) obox(B, q[0], q[2], hx, hz, 0.9, w > 13 ? 0.9 : Math.min(2.2, w * 0.18), q[4] - 1.5, c[3] - 1.1, PIER, PLAIN);
    obox(B, c[0], c[2], -hz, hx, w / 2 - 0.6, 0.95, c[3] - 1.2, c[3], PIER, PLAIN, 4, true); // cap beam under the slab
  }
}
function buildRoads(t, roadB, roadLoB, walkB, markB, groundB, lite = false, deckB = null) { // lite: no paint (far LOD)
  const WHITE = lin(0xeeeeea), YELLOW = lin(0xe8b923), CURB = lin(0xbdb8ae), WALKC = lin(0xc9c5bd), BRICKW = lin(0x9a5a48), GRASS = lin(0x80a359);
  const C3 = [CURB, WALKC, BRICKW, GRASS, walkB, groundB];
  const deckY = (e, s, x, z) => (e.bridge ? pointOnEdge(e, s).y : terrainHeight(x, z));
  const flat = (B, ax, az, bx, bz, w, y0, y1, c) => { // a flat strip (markings) from a to b, w wide
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, px = (-dz / l) * w / 2, pz = (dx / l) * w / 2;
    const i0 = B.v(ax + px, y0, az + pz, 0, 1, 0, ...c, 0, 0), i1 = B.v(ax - px, y0, az - pz, 0, 1, 0, ...c, 0, 0);
    const i2 = B.v(bx - px, y1, bz - pz, 0, 1, 0, ...c, 0, 0), i3 = B.v(bx + px, y1, bz + pz, 0, 1, 0, ...c, 0, 0);
    B.quad(i0, i3, i2, i1);
  };
  const triFlat = (B, a, b, c, y, col) => { const i0 = B.v(a[0], y, a[1], 0, 1, 0, ...col, 0, 0), i1 = B.v(b[0], y, b[1], 0, 1, 0, ...col, 0, 0), i2 = B.v(c[0], y, c[1], 0, 1, 0, ...col, 0, 0); const cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); if (cr < 0) B.i.push(i0, i1, i2); else B.i.push(i0, i2, i1); };
  // a painted lane arrow at (x, z) pointing along (dx, dz): 'left' / 'right' bend, else straight
  const arrow = (x, z, dx, dz, kind, y) => {
    const rx = -dz, rz = dx; // right of travel
    flat(markB, x - dx * 2.2, z - dz * 2.2, x + dx * 0.4, z + dz * 0.4, 0.2, y, y, WHITE);
    let bx = x + dx * 0.4, bz = z + dz * 0.4, hx = dx, hz = dz;
    if (kind === 'left' || kind === 'right') { const s = kind === 'left' ? -1 : 1; flat(markB, bx, bz, bx + rx * s * 0.9, bz + rz * s * 0.9, 0.2, y, y, WHITE); bx += rx * s * 0.9; bz += rz * s * 0.9; hx = rx * s; hz = rz * s; }
    triFlat(markB, [bx - hz * 0.45, bz + hx * 0.45], [bx + hz * 0.45, bz - hx * 0.45], [bx + hx * 1.1, bz + hz * 1.1], y, WHITE);
  };
  for (const id of t.e) {
    const e = G.edges[id]; if (!e || (e.flags & 1)) continue;
    const d = denseOf(e), hw = e.width / 2, L = roadLook(e, t), RB = BIG.has(e.cls) ? roadB : roadLoB;
    const rc = lin(surfCol(e, L)), v = 0.94 + hash(id) * 0.1, rcol = [rc[0] * v, rc[1] * v, rc[2] * v];
    const cutA = trimAt(e, e.a), cutB = trimAt(e, e.b), lo = cutA, hi = e.len - cutB;
    const trimA = cutA ? cutA + 0.5 : 0, trimB = cutB ? cutB + 0.5 : 0;
    const big = BIG.has(e.cls), rural = L.a === 'rural';
    const lay = walkLayers(L, big, C3);
    for (let k = 0; k < d.m - 1; k++) {
      const sa = Math.max(lo, d.s[k]), sb = Math.min(hi, d.s[k + 1]); if (sb - sa < 0.01) continue;
      const span = d.s[k + 1] - d.s[k] || 1, fa = (sa - d.s[k]) / span, fb = (sb - d.s[k]) / span;
      const mx = d.x[k] + (d.x[k + 1] - d.x[k]) * (fa + fb) / 2, mz = d.z[k] + (d.z[k + 1] - d.z[k]) * (fa + fb) / 2;
      if (!inTile(t, mx, mz)) continue;
      // one end of a quad: offsets o0, o1 across the road at fraction f of dense segment k
      const row = (B, f, o0, o1, lift, c, uvScale) => {
        const out = [], s = d.s[k] + span * f;
        for (const o of [o0, o1]) {
          const xa = d.x[k] + d.nx[k] * o * d.sc[k], za = d.z[k] + d.nz[k] * o * d.sc[k], xb = d.x[k + 1] + d.nx[k + 1] * o * d.sc[k + 1], zb = d.z[k + 1] + d.nz[k + 1] * o * d.sc[k + 1];
          const x = xa + (xb - xa) * f, z = za + (zb - za) * f, y = (e.bridge ? Math.max(deckY(e, s), terrainHeight(x, z)) : terrainHeight(x, z)) + lift; // a deck never dips under the ground (where you'd stand: data.js groundHeight)
          out.push(B.v(x, y, z, 0, 1, 0, ...c, x / uvScale, z / uvScale));
        }
        return out;
      };
      const [a0, a1] = row(RB, fa, -hw, hw, 0.06, rcol, 6), [b0, b1] = row(RB, fb, -hw, hw, 0.06, rcol, 6);
      RB.quad(a0, a1, b1, b0);
      for (const side of L.sw) for (const [lo2, hi2, c, B, us] of lay) {
        const o0 = side > 0 ? hw + lo2 : -hw - hi2, o1 = side > 0 ? hw + hi2 : -hw - lo2, lift = B === groundB ? 0.04 : c === CURB ? 0.045 : 0.035;
        const [c0, c1] = row(B, fa, o0, o1, lift, c, us), [d0, d1] = row(B, fb, o0, o1, lift, c, us);
        B.quad(c0, c1, d1, d0);
      }
      if (deckB && e.bridge) bridgeSlab(deckB, e, d, k, fa, fb, span, -hw - (L.sw.includes(-1) ? lay.at(-1)[1] : 0) - 0.25, hw + (L.sw.includes(1) ? lay.at(-1)[1] : 0) + 0.25, t);
      // markings (skipped inside junctions and on gravel and brick)
      if (lite || L.gravel || L.brick || e.cls === 'track') continue;
      const s0 = d.s[k], s1 = d.s[k + 1];
      if (s0 < trimA + 1 || s1 > e.len - trimB - 1) continue;
      const y0 = deckY(e, s0, d.x[k], d.z[k]) + 0.085, y1 = deckY(e, s1, d.x[k + 1], d.z[k + 1]) + 0.085;
      const at = (kk, o) => [d.x[kk] + d.nx[kk] * o, d.z[kk] + d.nz[kk] * o];
      const lanes = e.lf + e.lb, lw = e.width / Math.max(1, lanes), twoWay = e.lf > 0 && e.lb > 0;
      const c0 = (e.lb - e.lf) * lw / 2; // centre between the backward lanes (-o side) and the forward lanes
      const dash = (o, col, w = 0.12, len = 3, gap = 9) => {
        const Ls = s1 - s0 || 1;
        for (let a = Math.floor(s0 / gap) * gap; a < s1; a += gap) {
          const lo3 = Math.max(s0, a), hi3 = Math.min(s1, a + len); if (hi3 <= lo3) continue;
          const f0 = (lo3 - s0) / Ls, f1 = (hi3 - s0) / Ls, [ax, az] = at(k, o), [bx, bz] = at(k + 1, o);
          flat(markB, ax + (bx - ax) * f0, az + (bz - az) * f0, ax + (bx - ax) * f1, az + (bz - az) * f1, w, y0 + (y1 - y0) * f0, y0 + (y1 - y0) * f1, col);
        }
      };
      const solid = (o, col, w = 0.11) => { const [ax, az] = at(k, o), [bx, bz] = at(k + 1, o); flat(markB, ax, az, bx, bz, w, y0, y1, col); };
      if (twoWay && big && L.median) {
        // a raised concrete median down the middle (OSM median tag)
        const [p0, p1] = row(walkB, 0, c0 - 0.7, c0 + 0.7, 0.12, CURB, 1.5), [q0, q1] = row(walkB, 1, c0 - 0.7, c0 + 0.7, 0.12, CURB, 1.5); walkB.quad(p0, p1, q1, q0);
      } else if (twoWay && big) for (const o of [c0 - 0.13, c0 + 0.13]) solid(o, YELLOW);
      else if (twoWay && rural && e.cls !== 'service') dash(c0, YELLOW, 0.11, 3, 12); // county roads: a broken yellow centre line
      if ((big || lanes >= 3) && lanes >= 2) for (let li = 1; li < lanes; li++) { if (twoWay && li === e.lb) continue; dash(-e.width / 2 + li * lw, WHITE); }
      if (big || (rural && e.cls !== 'service')) for (const o of [hw - 0.35, -hw + 0.35]) solid(o, WHITE, 0.12);
    }
    // turn arrows from turn:lanes on the forward lanes, a little before the far junction
    if (!lite && e.turn && e.lf > 0 && !L.gravel && G.adj[e.b].length >= 3 && e.len > trimB + 30) {
      const ent = String(e.turn).split('|'), lanes = e.lf + e.lb, lw = e.width / Math.max(1, lanes);
      if (ent.length === e.lf) {
        const s = e.len - trimB - 12, p = pointOnEdge(e, s), q = pointOnEdge(e, s + 1), dx = q.x - p.x, dz = q.z - p.z, dl = Math.hypot(dx, dz) || 1;
        ent.forEach((v2, i) => {
          const kind = /left/.test(v2) ? 'left' : /right/.test(v2) ? 'right' : /through/.test(v2) ? 'through' : null; if (!kind) return;
          const o = -e.width / 2 + (e.lb + i + 0.5) * lw, x = p.x + (-dz / dl) * o, z = p.z + (dx / dl) * o;
          if (inTile(t, x, z)) arrow(x, z, dx / dl, dz / dl, kind, (e.bridge ? p.y : terrainHeight(x, z)) + 0.09);
        });
      }
    }
  }
  // junction polygons, crosswalks and stop lines at nodes in this tile
  const N = G.nodes;
  const zebra = (e, sA, sB, yy) => {
    const p0 = pointOnEdge(e, sA), p1 = pointOnEdge(e, sB), ux = p1.x - p0.x, uz = p1.z - p0.z, ul = Math.hypot(ux, uz) || 1, nx = -uz / ul, nz = ux / ul;
    for (let o = -e.width / 2 + 0.5; o <= e.width / 2 - 0.4; o += 1.1) flat(markB, p0.x + nx * o, p0.z + nz * o, p1.x + nx * o, p1.z + nz * o, 0.55, yy(p0), yy(p1), WHITE);
  };
  // a convex polygon fanned from the node through a half-way ring, so it follows the ground on a slope
  const fan = (B, poly, x, z, yAt, lift, c, uvs) => {
    const ctr = B.v(x, yAt(x, z) + lift, z, 0, 1, 0, ...c, x / uvs, z / uvs), mid = [], out = [];
    for (const [px, pz] of poly) {
      const hx = (x + px) / 2, hz = (z + pz) / 2;
      mid.push(B.v(hx, yAt(hx, hz) + lift, hz, 0, 1, 0, ...c, hx / uvs, hz / uvs)); out.push(B.v(px, yAt(px, pz) + lift, pz, 0, 1, 0, ...c, px / uvs, pz / uvs));
    }
    for (let s = 0, n = poly.length; s < n; s++) { const s1 = (s + 1) % n; B.i.push(ctr, mid[s1], mid[s]); B.quad(mid[s], mid[s1], out[s1], out[s]); }
  };
  const nodes = new Set(); for (const id of t.e) { const e = G.edges[id]; if (e) { nodes.add(e.a); nodes.add(e.b); } }
  for (const k of nodes) {
    const x = N.x[k], z = N.z[k];
    if (!inTile(t, x, z)) continue;
    const J = junction(k); if (!J) continue;
    const adj = legs(k).filter((e) => !(e.flags & 1)); if (adj.length < 3) continue;
    const r = J.r, onBridge = adj.some((e) => e.bridge), yAt = onBridge ? () => N.y[k] : terrainHeight;
    let top = adj[0]; for (const e of adj) if (RANKC[e.cls] > RANKC[top.cls]) top = e;
    fan(roadB, J.poly, x, z, yAt, 0.07, lin(surfCol(top, roadLook(top, t))), 6); // a hair over the legs where a short leg's end falls inside the polygon
    if (deckB && onBridge && N.y[k] - terrainHeight(x, z) > 0.6) { // the slab's underside under a junction on a deck
      const yb = N.y[k] - (DECK_T[top.cls] || 0.9), P = J.poly, c = deckB.v(x, yb, z, 0, -1, 0, ...DECK_UNDER, 0, 0), ids = P.map(([px, pz]) => deckB.v(px, yb, pz, 0, -1, 0, ...DECK_UNDER, 0, 0));
      for (let i = 0; i < P.length; i++) { const j = (i + 1) % P.length, cr = (P[i][0] - x) * (P[j][1] - z) - (P[i][1] - z) * (P[j][0] - x); if (cr > 0) deckB.i.push(c, ids[i], ids[j]); else deckB.i.push(c, ids[j], ids[i]); }
    }
    // sidewalk corners: the same polygon out to the back of each leg's sidewalk, under the road
    if (adj.some((e) => roadLook(e, t).sw.length)) {
      const ring = [[x, z]];
      for (const e of adj) { const s = J.trim.get(e.id) ?? r, at = e.a === k ? s : e.len - s, L = roadLook(e, t), o = e.width / 2 + (L.sw.length ? walkLayers(L, BIG.has(e.cls), C3).at(-1)[1] : 0); ring.push(stripAt(e, at, o), stripAt(e, at, -o)); }
      fan(walkB, hull(ring), x, z, yAt, 0.03, WALKC, 1.5);
    }
    const ctrl = N.ctrl[k], core = coreAt(x, z);
    // painted crosswalks at signals, and on every leg in a town core
    if (lite || (!ctrl && !core)) continue;
    for (const e of adj) {
      const rr = J.trim.get(e.id) ?? r; if (e.len < rr + 8) continue;
      const fromA = e.a === k, dirIn = fromA ? e.lb > 0 : e.lf > 0; // traffic arrives at this node along e
      const yy = (p) => (e.bridge ? p.y : terrainHeight(p.x, p.z)) + 0.09;
      if ((ctrl === 1 || core) && roadLook(e, t).sw.length && !roadLook(e, t).brick) zebra(e, fromA ? rr + 0.6 : e.len - rr - 0.6, fromA ? rr + 3.6 : e.len - rr - 3.6, yy);
      if (dirIn && ctrl) { // stop line across the lanes coming in
        const lanes = e.lf + e.lb, lw = e.width / Math.max(1, lanes), nIn = fromA ? e.lb : e.lf;
        const q = pointOnEdge(e, fromA ? rr + 4.2 : e.len - rr - 4.2), q2 = pointOnEdge(e, fromA ? rr + 4.7 : e.len - rr - 4.7);
        const tx = q.x - q2.x, tz = q.z - q2.z, tl = Math.hypot(tx, tz) || 1; // incoming travel direction
        const rx = -tz / tl, rz = tx / tl; // its right-hand side
        const oFar = e.lf > 0 && e.lb > 0 ? nIn * lw : e.width / 2, oNear = e.lf > 0 && e.lb > 0 ? 0.1 : -e.width / 2;
        flat(markB, q.x + rx * oNear, q.z + rz * oNear, q.x + rx * oFar, q.z + rz * oFar, 0.5, yy(q), yy(q), WHITE);
      }
    }
  }
  // mapped mid-block / uncontrolled crossings (highway=crossing)
  if (!lite) for (const p of pointsOf(t, 'cw')) {
    const q = nearestEdge(p.x, p.z, 10); if (!q || q.e.cls === 'motor' || q.e.cls === 'trunk' || (q.e.flags & 1) || roadLook(q.e, t).gravel) continue;
    const e = q.e, ra = trimAt(e, e.a), rb = trimAt(e, e.b);
    if (q.s < ra + 0.5 || q.s > e.len - rb - 0.5) continue; // inside the junction polygon
    if ((q.s < ra + 5 && (G.nodes.ctrl[e.a] === 1 || coreAt(p.x, p.z))) || (q.s > e.len - rb - 5 && (G.nodes.ctrl[e.b] === 1 || coreAt(p.x, p.z)))) continue; // already painted at the junction
    zebra(e, Math.max(0, q.s - 1.5), Math.min(e.len, q.s + 1.5), (pp) => (e.bridge ? pp.y : terrainHeight(pp.x, pp.z)) + 0.09);
  }
}

// ---------- buildings ----------
const SIDING_TINTS = [0xf4f1e8, 0xe9e2cf, 0xc9d6df, 0xd6dccb, 0xb9c4ca, 0xe8d9b0, 0xd9c6b6, 0xa9b8a5, 0xf2efe6, 0xcfc3a7, 0x9fb0bf, 0xe6e6e6];
const ROOF_TINTS = [0x55504b, 0x3f3c3a, 0x6b4a3c, 0x4a4f55, 0x5d5a52, 0x6e6259, 0x3b4a44];
const BRICK_TINTS = [0xffffff, 0xf0e2da, 0xffe9d6, 0xe6d4cc, 0xd9cbc3];
// house colours by era (docs/references.md): painted Victorians, earthy Craftsman, pastel and brick-veneer ranches,
// greige-to-charcoal vinyl on newer two-storeys, white farmhouses
const STYLE_LOOK = {
  victorian: [[0x3e5c4a, 0x6b2f2f, 0xc9a24a, 0x4f6d8c, 0xe9dfc4, 0x7a5c8a, 0x8a9a6b, 0xb5523b, 0xd8cfa8, 0x2f4f5f], 0.2, [0x3f3c3a, 0x4a4f55, 0x5d3a33, 0x3b4a44]],
  cottage: [[0xf4f1e8, 0xe6e6e6, 0xf1e6b8, 0xc9d6df, 0xd6dccb, 0xe9e2cf], 0.05, ROOF_TINTS],
  foursquare: [[0xa9b08f, 0xc8b48a, 0x8c7a5b, 0xefe8d8, 0x9aa38a, 0xd6c3a0, 0x7d8b74, 0xb9a88a], 0.35, ROOF_TINTS],
  bungalow: [[0xa9b08f, 0xc8b48a, 0x8c7a5b, 0xefe8d8, 0x9aa38a, 0xd6c3a0, 0x7d8b74, 0xb9a88a], 0.2, ROOF_TINTS],
  ranch: [[0xd9e7d6, 0xcfe0ea, 0xf1e6b8, 0xf4f1e8, 0xe8d6cf, 0xc9d6df, 0xe2e2d6], 0.45, [0x55504b, 0x3f3c3a, 0x6b4a3c, 0x5d5a52]],
  modern2: [[0xcfc6b4, 0xb9b3a6, 0xd8d2c4, 0x9aa0a3, 0xf2efe6, 0x5c636a, 0x3f4a5a, 0xc4b59a], 0, [0x5a4e44, 0x4a4a4a, 0x6b5f52]],
  farmhouse: [[0xf4f4f0, 0xf4f4f0, 0xf4f4f0, 0xefe9d9, 0xdfe6e8], 0, [0x4a4f55, 0x3f3c3a, 0x6e6259]],
};
const NAMED_COL = { white: 0xf2f2ee, red: 0x9b3a2e, brown: 0x7a5236, grey: 0x9a9a96, gray: 0x9a9a96, beige: 0xd8cbaa, yellow: 0xe6d28a, blue: 0x6f8fb0, green: 0x6f8f62, black: 0x2b2b2b, tan: 0xc8b48a, cream: 0xefe6cc, maroon: 0x6b2f2f };
const tagCol = (v) => { if (!v) return null; const s = String(v).toLowerCase(); if (/^#[0-9a-f]{6}$/.test(s)) return parseInt(s.slice(1), 16); return NAMED_COL[s] ?? null; };
const BIGBOX = ['ValuMart', 'Bullseye', 'Hi-Vue', "Menardo's", 'Hobby Hut', "Cole's", 'Fairaway', 'Best Bye', 'Home Deport', 'Dollar Generic', 'Alde', 'Lowe-Down'];
const pick = (arr, s) => arr[Math.floor(hash(s) * arr.length) % arr.length];
function pointInPoly(x, z, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], zi = pts[i + 1], xj = pts[j], zj = pts[j + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
// outward normals per edge and the polygon pushed out by o (mitred corners)
function outline(pts) {
  const n = pts.length / 2; let area = 0;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; area += pts[i * 2] * pts[j * 2 + 1] - pts[j * 2] * pts[i * 2 + 1]; }
  const N = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, dx = pts[j * 2] - pts[i * 2], dz = pts[j * 2 + 1] - pts[i * 2 + 1], L = Math.hypot(dx, dz) || 1;
    N.push(area > 0 ? [dz / L, -dx / L] : [-dz / L, dx / L]);
  }
  const off = (o) => { const Q = []; for (let i = 0; i < n; i++) { const a = N[(i + n - 1) % n], b = N[i]; let mx = a[0] + b[0], mz = a[1] + b[1]; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml; const k = o / Math.max(0.35, mx * b[0] + mz * b[1]); Q.push([pts[i * 2] + mx * k, pts[i * 2 + 1] + mz * k]); } return Q; };
  return { N, off };
}
// a projecting band round the building (ledge or cornice); with a parapet it also caps the roof edge
function band(B, pts, ol, y0, y1, o, tint, at, parapet = 0) {
  const n = pts.length / 2, Q = ol.off(o), P = parapet ? ol.off(-parapet) : null;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, nn = ol.N[i];
    const w0 = [pts[i * 2], pts[i * 2 + 1]], w1 = [pts[j * 2], pts[j * 2 + 1]], q0 = Q[i], q1 = Q[j], L = Math.hypot(q1[0] - q0[0], q1[1] - q0[1]);
    if (L < 0.05) continue;
    face(B, [[q0[0], y0, q0[1]], [q1[0], y0, q1[1]], [q1[0], y1, q1[1]], [q0[0], y1, q0[1]]], [nn[0], 0, nn[1]], tint, at, [[0, 0], [L / 4, 0], [L / 4, (y1 - y0) / 4], [0, (y1 - y0) / 4]]);
    face(B, [[w0[0], y0, w0[1]], [w1[0], y0, w1[1]], [q1[0], y0, q1[1]], [q0[0], y0, q0[1]]], [0, -1, 0], tint.map((c) => c * 0.7), at, [[0, 0], [L / 4, 0], [L / 4, 0.1], [0, 0.1]]);
    const i0 = P ? P[i] : w0, i1 = P ? P[j] : w1;
    face(B, [[i0[0], y1, i0[1]], [i1[0], y1, i1[1]], [q1[0], y1, q1[1]], [q0[0], y1, q0[1]]], [0, 1, 0], tint, at, [[0, 0], [L / 4, 0], [L / 4, 0.1], [0, 0.1]]);
    if (P) face(B, [[i0[0], y0, i0[1]], [i1[0], y0, i1[1]], [i1[0], y1, i1[1]], [i0[0], y1, i0[1]]], [-nn[0], 0, -nn[1]], tint.map((c) => c * 0.85), at, [[0, 0], [L / 4, 0], [L / 4, (y1 - y0) / 4], [0, (y1 - y0) / 4]]);
  }
}
// a glowing strip or quad for the night-life material: kind 0 porch lamp, 1 window, 2 Christmas bulbs, 3 neon
function glowQuad(B, P, n, col, kind, ph, uLen = 1) {
  const U = [[0, 0], [uLen, 0], [uLen, 1], [0, 1]];
  const id = P.map((p, k) => B.v(p[0], p[1], p[2], n[0], n[1], n[2], col[0], col[1], col[2], U[k][0], U[k][1], kind, ph));
  B.quad(id[0], id[1], id[2], id[3]);
}
const AWNING = [0x9e2a2b, 0x2f5d3a, 0x1f3a5f, 0x5c1f2e, 0xc9a66b, 0x222222, 0x8a5a2b, 0x2a6f75].map(lin);
const DOORS = [0x7a1f1f, 0x1f3550, 0x2b4a2e, 0x3b2a1f, 0xe9e4d8, 0x111111, 0x6b5a2a].map(lin);
const TRIM = lin(0xf2efe8), CONCRETE = lin(0x9d9a93), WOOD = lin(0x8a7560), GDOOR = lin(0xe9e6de), FIXTURE = lin(0xe8e2d0);
const LANDMARK = /Figge|Conservatory|River Center|Union Station|Freight House|Adler|Blackhawk|Kahl|Putnam/;
const PADROAD = new Set(['primary', 'secondary', 'tertiary', 'trunk']);

function buildBuildings(t, B, boxes, foot, SB, GB, junk, X) {
  const { glowB, litB, namesB, newK, bigBoxes, yards, dealers, has } = X;
  // every footprint up front (yard props must not land inside a neighbour's house)
  const fps = t.b.map((rec) => { const rel = rec[0], p = new Float32Array(rel.length); let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity; for (let i = 0; i < rel.length; i += 2) { p[i] = rel[i] + t.ox; p[i + 1] = rel[i + 1] + t.oz; a = Math.min(a, p[i]); b = Math.max(b, p[i]); c = Math.min(c, p[i + 1]); d = Math.max(d, p[i + 1]); } return { p, a, b, c, d }; });
  const occupied = (x, z, r) => fps.some((f) => x > f.a - r && x < f.b + r && z > f.c - r && z < f.d + r && (pointInPoly(x, z, f.p) || pointInPoly(x + r, z, f.p) || pointInPoly(x - r, z, f.p) || pointInPoly(x, z + r, f.p) || pointInPoly(x, z - r, f.p)));
  t.b.forEach((rec, bi) => {
    const [, baseY, hgt, pitched, style, name, kind = 0] = rec;
    const pts = fps[bi].p, n = pts.length / 2; if (n < 3) return;
    let cx = 0, cz = 0; for (let i = 0; i < n; i++) { cx += pts[i * 2]; cz += pts[i * 2 + 1]; } cx /= n; cz /= n;
    const seed = t.tx * 7919 + t.tz * 104729 + bi * 31;
    if (rec.arch?.canopy) { canopy(B, glowB, pts, cx, cz, baseY, baseY + hgt, seed); return; } // no footprint: you can stand under it
    foot.push(pts);
    const dist = district(cx, cz), a = rec.arch || { area: 'res' }, HS = HOUSE[a.style];
    let area2 = 0; for (let i = 0; i < n; i++) { const j = (i + 1) % n; area2 += pts[i * 2] * pts[j * 2 + 1] - pts[j * 2] * pts[i * 2 + 1]; }
    const fp = Math.abs(area2) / 2;
    // roof form: the OSM roof:shape when tagged, else the archetype's
    const RF = a.roofTag || '';
    let form = /flat/.test(RF) ? 'flat' : /hip|pyram/.test(RF) ? 'hip' : /gambrel|mansard/.test(RF) ? 'gambrel' : /gable|saltbox|skillion/.test(RF) ? 'gable' : /dome|round|onion|cone/.test(RF) ? 'cone' : null;
    if (!form) form = a.round && fp < 1500 && (a.area === 'rural' || a.area === 'industrial' || a.style === 'silo' || a.style === 'bin') ? 'cone' : !pitched && a.style !== 'barn' && a.style !== 'shed_big' ? 'flat' : a.style === 'barn' ? 'gambrel' : HS ? (a.style === 'ranch' && fp > 140 ? 'hip' : HS.roof) : 'gable';
    const sloped = form !== 'flat';
    // facade
    let cell = STYLE_CELL[style] || 'plain';
    if (cell === 'brick') cell = dist === 'village' ? 'brick2' : hash(seed) < 0.3 ? 'brick3' : 'brick';
    if (cell === 'glass' && hash(seed + 1) < 0.45) cell = 'office';
    if (a.area === 'core' && !sloped && kind !== 1 && kind !== 2 && cell !== 'glass' && cell !== 'office') { const r = hash(seed + 12); cell = dist === 'village' ? 'brick2' : r < 0.45 ? 'brick' : r < 0.68 ? 'brick2' : r < 0.88 ? 'brick3' : 'stone'; }
    if (a.area === 'strip' && !sloped && cell === 'brick') cell = hash(seed + 12) < 0.5 ? 'stucco' : 'brick3';
    if (/church|cathedral|chapel|temple/i.test(name) || kind === 2) cell = 'church';
    if (kind === 1) cell = 'ramp';
    else if (kind === 3) cell = 'brick3';
    else if (kind === 4) cell = 'metal';
    if (/Figge|Conservatory/.test(name)) cell = 'glass';
    else if (/River Center/.test(name)) cell = 'office';
    else if (/Union Station|Freight House|Adler|Blackhawk|Kahl|Putnam/.test(name)) cell = 'brick2';
    const SL = STYLE_LOOK[a.style];
    if (SL) cell = hash(seed + 13) < SL[1] ? (a.style === 'ranch' && hash(seed + 14) < 0.5 ? 'brick3' : 'brick') : 'siding';
    if (a.style === 'barn' || a.style === 'silo') cell = 'plain';
    else if (a.style === 'shed_big' || a.style === 'bin') cell = 'metal';
    else if (a.style === 'shed') cell = 'siding';
    else if (a.style === 'garage' || (!a.style && pitched && hgt < 4.2)) cell = 'garage';
    // OSM wall material wins
    const mt = String(a.mat || '').toLowerCase();
    if (mt && kind !== 1 && !LANDMARK.test(name)) cell = /brick/.test(mt) ? (cell.startsWith('brick') ? cell : 'brick') : /stone|lime|sand/.test(mt) ? 'stone' : /glass/.test(mt) ? 'glass' : /metal|steel|alum/.test(mt) ? 'metal' : /plaster|stucco/.test(mt) ? 'stucco' : /wood|vinyl|timber|siding/.test(mt) ? 'siding' : cell;
    const house = HS ? fp < 420 : pitched && hgt >= 4.2 && hgt < 12 && fp < 320 && (cell === 'siding' || cell.startsWith('brick'));
    const bigBox = a.area === 'strip' && !sloped && fp > 2500 && kind !== 1;
    const store = !sloped && !bigBox && kind !== 1 && kind !== 2 && kind !== 3 && !LANDMARK.test(name) && hgt >= 4 && hgt < 32 && (!name || kind === 5 || a.shop)
      && ((a.area === 'core' && (style === 0 || style === 1 || cell.startsWith('brick') || cell === 'stone') && hash(seed + 2) < 0.75) || style === 4 || kind === 5 || (a.area === 'strip' && !!a.shop));
    let tint = [1, 1, 1];
    if (SL && cell === 'siding') tint = lin(pick(SL[0], seed + 3));
    else if (cell === 'siding' || cell === 'garage') tint = lin(SIDING_TINTS[Math.floor(hash(seed + 3) * SIDING_TINTS.length)]);
    else if (cell.startsWith('brick')) tint = lin(BRICK_TINTS[Math.floor(hash(seed + 4) * BRICK_TINTS.length)]);
    else if (cell === 'stucco') tint = lin([0xffffff, 0xf3e9d8, 0xe9e4da, 0xf5efe1][Math.floor(hash(seed + 5) * 4)]);
    if (a.style === 'barn') tint = lin(hash(seed + 3) < 0.85 ? 0x9b2d20 : 0xe8e4da);
    else if (a.style === 'shed_big') tint = lin(pick([0xd8d8d4, 0xb8bcbf, 0x9b2d20, 0xd9cfb6, 0xe8e8e2], seed + 3));
    else if (a.style === 'silo') tint = lin(hash(seed + 3) < 0.3 ? 0x2a4a7e : 0xcfcabd); // blue glass-lined Harvestore or concrete stave
    const tc = tagCol(a.col); if (tc != null && cell !== 'glass' && cell !== 'ramp') tint = lin(tc);
    const atl = (c) => [c[0] / 4, 1 - (c[1] + 1) / 4];
    const A = atl(CELL[cell]), S = atl(CELL.store), R = atl(CELL.roof), SH = atl(CELL.shingle), pl = atl(CELL.plain);
    const yb = baseY - 2.5, top = baseY + hgt;
    // walls
    let along = hash(seed + 6) * 16;
    const wallAlong = [];
    for (let i = 0; i < n; i++) {
      wallAlong.push(along);
      const x0 = pts[i * 2], z0 = pts[i * 2 + 1], x1 = pts[((i + 1) % n) * 2], z1 = pts[((i + 1) % n) * 2 + 1];
      const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz); if (L < 0.05) continue;
      let ox = dz / L, oz = -dx / L; // one of the two normals; flip so it points out
      if (pointInPoly((x0 + x1) / 2 + ox * 0.3, (z0 + z1) / 2 + oz * 0.3, pts)) { ox = -ox; oz = -oz; }
      const wall = (ylo, yhi, at, uS, vS, vOff) => {
        const u0 = along / uS, u1 = (along + L) / uS;
        const a0 = B.v(x0, ylo, z0, ox, 0, oz, ...tint, u0, (ylo - vOff) / vS, ...at), b0 = B.v(x1, ylo, z1, ox, 0, oz, ...tint, u1, (ylo - vOff) / vS, ...at);
        const c0 = B.v(x1, yhi, z1, ox, 0, oz, ...tint, u1, (yhi - vOff) / vS, ...at), d0 = B.v(x0, yhi, z0, ox, 0, oz, ...tint, u0, (yhi - vOff) / vS, ...at);
        if ((x1 - x0) * oz - (z1 - z0) * ox > 0) B.quad(a0, b0, c0, d0); else B.quad(b0, a0, d0, c0);
      };
      if (store) { wall(yb, baseY + 4.2, S, 18, 4.2, baseY); wall(baseY + 4.2, top, A, 16, 13.2, baseY + 4.2); }
      else wall(yb, top, A, 16, 13.2, baseY);
      along += L;
      if (L > 0.5) boxes.push(makeBox((x0 + x1) / 2 - ox * 0.6, (z0 + z1) / 2 - oz * 0.6, ox, oz, 0.6, L / 2 + 0.05, yb, top - yb + (sloped ? 1.5 : 0)));
    }
    // the wall that faces the street (shop signs, awnings, front doors, porches, garage doors, barn doors)
    const garage = a.style === 'garage', farm = a.area === 'rural', ind = a.area === 'industrial' && !sloped && fp > 400;
    let best = null, road = null;
    if (store || house || garage || bigBox || farm || ind || a.area === 'strip') {
      road = nearestEdge(cx, cz, garage || ind ? 60 : 80, garage || ind ? null : (e) => e.cls !== 'service' && e.cls !== 'track');
      if (road) {
        let bd = 0.3;
        for (let i = 0; i < n; i++) {
          const x0 = pts[i * 2], z0 = pts[i * 2 + 1], x1 = pts[((i + 1) % n) * 2], z1 = pts[((i + 1) % n) * 2 + 1], L = Math.hypot(x1 - x0, z1 - z0);
          if (L < (house ? 4 : garage ? 2.5 : 5)) continue;
          let ox = (z1 - z0) / L, oz = -(x1 - x0) / L;
          if (pointInPoly((x0 + x1) / 2 + ox * 0.3, (z0 + z1) / 2 + oz * 0.3, pts)) { ox = -ox; oz = -oz; }
          const tx = road.x - (x0 + x1) / 2, tz = road.z - (z0 + z1) / 2, tl = Math.hypot(tx, tz) || 1, d = (ox * tx + oz * tz) / tl;
          if (d > bd) { bd = d; best = { x0, z0, x1, z1, L, ox, oz, i }; }
        }
      }
    }
    const ol = outline(pts);
    const label = name ? displayName(name) : '';
    // canvas awnings over each shop front (the store texture repeats three 6 m shops)
    if (store && best) {
      const ux = (best.x1 - best.x0) / best.L, uz = (best.z1 - best.z0) / best.L, a0 = wallAlong[best.i];
      for (let k = Math.floor(a0 / 6); k * 6 < a0 + best.L; k++) {
        const s0 = Math.max(0.4, k * 6 - a0 + 0.35), s1 = Math.min(best.L - 0.4, k * 6 + 5.65 - a0);
        if (s1 - s0 < 2 || hash(seed + k * 13) > 0.72) continue;
        const tn = AWNING[Math.floor(hash(seed + k * 17) * AWNING.length)], dk = tn.map((c) => c * 0.55);
        const P = (sa, out, y) => [best.x0 + ux * sa + best.ox * out, baseY + y, best.z0 + uz * sa + best.oz * out];
        const d = 1.35, nt = [best.ox * 0.35, 0.94, best.oz * 0.35];
        face(B, [P(s0, 0.02, 3.2), P(s1, 0.02, 3.2), P(s1, d, 2.7), P(s0, d, 2.7)], nt, tn, pl, [[0, 0], [1, 0], [1, 1], [0, 1]]);
        face(B, [P(s0, 0.02, 3.19), P(s1, 0.02, 3.19), P(s1, d, 2.69), P(s0, d, 2.69)], [-nt[0], -nt[1], -nt[2]], dk, pl, [[0, 0], [1, 0], [1, 1], [0, 1]]);
        face(B, [P(s0, d, 2.38), P(s1, d, 2.38), P(s1, d, 2.7), P(s0, d, 2.7)], [best.ox, 0, best.oz], tn, pl, [[0, 0], [1, 0], [1, 1], [0, 1]]);
        for (const [sx, sgn] of [[s0, -1], [s1, 1]]) face(B, [P(sx, 0.02, 3.2), P(sx, d, 2.7), P(sx, d, 2.38), P(sx, 0.02, 2.38 + 0.5)], [ux * sgn, 0, uz * sgn], dk, pl, [[0, 0], [1, 0], [1, 1], [0, 1]]);
      }
      band(B, pts, ol, baseY + 4.2, baseY + 4.5, 0.16, TRIM.map((c) => c * 0.85), pl);
      // a neon blade sign hung off the front of a downtown shop
      if (a.area === 'core' && hash(seed + 81) < 0.5 && best.L > 5) {
        const s = best.L * (0.2 + hash(seed + 82) * 0.6), bx = best.x0 + ux * s + best.ox * 0.62, bz = best.z0 + uz * s + best.oz * 0.62;
        obox(B, best.x0 + ux * s + best.ox * 0.35, best.z0 + uz * s + best.oz * 0.35, best.ox, best.oz, 0.35, 0.03, baseY + 6.05, baseY + 6.12, lin(0x222222), pl);
        panel(litB, bx, baseY + 4.95, bz, ux, uz, 0.45, 2.1, nameUV('blade', label || SIGN_NAMES[Math.floor(hash(seed + 83) * SIGN_NAMES.length)], t.key), undefined, true, 1);
      }
    }
    // houses: front door, a porch by style, garage doors, gutters, a chimney, a driveway, yard life and night life
    const baseYb = baseY;
    let streetSide = 0; // which roof side (+v / -v) faces the street, set by the roof code
    if (house && best) {
      const ux = (best.x1 - best.x0) / best.L, uz = (best.z1 - best.z0) / best.L, ox = best.ox, oz = best.oz;
      const pk = HS ? HS.porch : best.L > 6 && hash(seed + 31) < 0.75 ? 'full' : 'stoop';
      const porch = pk !== 'stoop' && best.L > 5;
      const gar = HS && HS.garage && best.L > 7.5 ? (HS.garage === 2 || best.L > 12 ? 2 : 1) : 0, gw = gar === 2 ? 4.9 : 2.6;
      const gEnd = hash(seed + 34) < 0.5 ? 0 : 1; // garage at the start or the end of the front wall
      const df = gar ? (gEnd ? 0.25 : 0.75) : 0.3 + hash(seed + 32) * 0.4, dS = best.L * df, dx = best.x0 + ux * dS, dz = best.z0 + uz * dS;
      const door = DOORS[Math.floor(hash(seed + 33) * DOORS.length)];
      const by = Math.max(baseYb, terrainHeight(dx + ox * 1.5, dz + oz * 1.5)); // the porch sits on the ground in front, not the lowest corner
      const ph = porch ? 0.35 : 0.15;
      obox(B, dx + ox * 0.03, dz + oz * 0.03, ux, uz, 0.62, 0.03, by + ph, by + ph + 2.3, TRIM, pl);
      obox(B, dx + ox * 0.06, dz + oz * 0.06, ux, uz, 0.48, 0.03, by + ph, by + ph + 2.12, door, pl);
      // porch lamp beside the door
      { const lx = dx + ux * 0.85 + ox * 0.09, lz = dz + uz * 0.85 + oz * 0.09, ly = by + ph + 1.95; glowQuad(glowB, [[lx - ux * 0.09, ly, lz - uz * 0.09], [lx + ux * 0.09, ly, lz + uz * 0.09], [lx + ux * 0.09, ly + 0.26, lz + uz * 0.09], [lx - ux * 0.09, ly + 0.26, lz - uz * 0.09]], [ox, 0, oz], FIXTURE, 0, hash(seed + 91)); }
      let pc = dS, hwP = 0, dep = 2.2;
      if (porch) {
        hwP = pk === 'small' ? 1.5 : Math.min(best.L * 0.48, pk === 'wrap' ? 6.5 : 4.6);
        pc = Math.max(hwP + 0.3, Math.min(best.L - hwP - 0.3, dS));
        if (gar) { const g0 = gEnd ? best.L - 0.6 - gw : 0.6, g1 = g0 + gw; if (pc + hwP > g0 - 0.3 && pc - hwP < g1 + 0.3) { hwP = Math.min(hwP, 1.5); pc = gEnd ? Math.min(pc, g0 - hwP - 0.4) : Math.max(pc, g1 + hwP + 0.4); } }
        dep = pk === 'small' ? 1.6 : pk === 'wrap' ? 2.6 : 2.3;
        const px = best.x0 + ux * pc, pz = best.z0 + uz * pc, post = a.style === 'bungalow' ? 0.15 : 0.08;
        obox(B, px + ox * dep / 2, pz + oz * dep / 2, ux, uz, hwP, dep / 2, by - 0.6, by + ph, WOOD, pl);
        for (const sx of [-hwP + 0.12, hwP - 0.12]) { obox(B, px + ux * sx + ox * (dep - 0.14), pz + uz * sx + oz * (dep - 0.14), ux, uz, post, post, by + ph, by + 2.85, TRIM, pl); if (post > 0.1) obox(B, px + ux * sx + ox * (dep - 0.14), pz + uz * sx + oz * (dep - 0.14), ux, uz, post + 0.07, post + 0.07, by + ph, by + ph + 0.9, lin(0x8c8278), pl); }
        obox(B, px + ox * (dep + 0.1) / 2, pz + oz * (dep + 0.1) / 2, ux, uz, hwP + 0.15, (dep + 0.1) / 2, by + 2.85, by + 3.0, TRIM, pl, 4, true);
        obox(B, dx + ox * (dep + 0.2), dz + oz * (dep + 0.2), ux, uz, 0.7, 0.2, by - 0.4, by + ph * 0.5, CONCRETE, pl);
        for (const [a0, b0] of [[-hwP + 0.1, (dS - pc) - 0.75], [(dS - pc) + 0.75, hwP - 0.1]]) if (b0 - a0 > 0.3) obox(B, px + ux * (a0 + b0) / 2 + ox * (dep - 0.12), pz + uz * (a0 + b0) / 2 + oz * (dep - 0.12), ux, uz, (b0 - a0) / 2, 0.04, by + ph + 0.8, by + ph + 0.9, TRIM, pl);
      } else obox(B, dx + ox * 0.45, dz + oz * 0.45, ux, uz, 0.75, 0.4, by - 0.4, by + ph, CONCRETE, pl);
      // garage doors on ranches and newer two-storeys (OSM traces the garage as part of the house)
      let gS = -1;
      if (gar) {
        gS = gEnd ? best.L - 0.6 - gw / 2 : 0.6 + gw / 2;
        const gx = best.x0 + ux * gS, gz = best.z0 + uz * gS, gy = Math.max(baseYb, terrainHeight(gx + ox * 1.5, gz + oz * 1.5));
        obox(B, gx + ox * 0.04, gz + oz * 0.04, ux, uz, gw / 2, 0.04, gy, gy + 2.2, GDOOR, atl(CELL.garage));
        obox(B, gx + ox * 0.05, gz + oz * 0.05, ux, uz, gw / 2 + 0.12, 0.04, gy + 2.2, gy + 2.35, TRIM, pl);
      }
      // stone wainscot across the front of newer houses
      if (a.style === 'modern2') obox(B, (best.x0 + best.x1) / 2 + ox * 0.05, (best.z0 + best.z1) / 2 + oz * 0.05, ux, uz, best.L / 2, 0.05, baseYb - 0.4, baseYb + 1.0, lin(0xc9bba0), atl(CELL.stone));
      // window glow at night: TV blue or lamp-warm in a real window of the facade texture (siding: bays 0 and 2 of every
      // 16 m, 1.6 m wide, sill 0.83 m; brick: every 4 m, 2.1 m wide), ground floor and, on two-storeys, upstairs
      const winAt = cell === 'siding' ? (s) => { const m = (((wallAlong[best.i] + s) % 16) + 16) % 16; return Math.abs(m - 2) < 0.05 || Math.abs(m - 10) < 0.05; } : null;
      if (cell === 'siding' || cell.startsWith('brick')) {
        const step = cell === 'siding' ? 8 : 4, hwW = cell === 'siding' ? 0.78 : 1.0, a0 = wallAlong[best.i], first = (((cell === 'siding' ? 2 : 2) - a0) % step + step) % step;
        let k = 0;
        for (let s = first; s < best.L - 0.9 && k < 3; s += step) {
          if (s < 0.9 || Math.abs(s - dS) < 1.6 || (gS >= 0 && Math.abs(s - gS) < gw / 2 + 1.2) || (winAt && !winAt(s))) continue;
          const wx = best.x0 + ux * s + ox * 0.03, wz = best.z0 + uz * s + oz * 0.03;
          for (const fl of hgt > 5.5 ? [0, 1] : [0]) {
            const y0 = baseYb + (cell === 'siding' ? 0.83 : 0.72) + fl * 3.3, y1 = y0 + (cell === 'siding' ? 1.7 : 2.0);
            if (y1 > top - 0.1) continue;
            glowQuad(glowB, [[wx - ux * hwW, y0, wz - uz * hwW], [wx + ux * hwW, y0, wz + uz * hwW], [wx + ux * hwW, y1, wz + uz * hwW], [wx - ux * hwW, y1, wz - uz * hwW]], [ox, 0, oz], [0, 0, 0], 1, hash(seed + 95 + k * 7 + fl * 3));
          }
          k++;
        }
      }
      const fenceLine = road ? (road.x - dx) * ox + (road.z - dz) * oz - (road.e.width || 7) / 2 - WALK_W - 0.6 : 0;
      // a flower bed under the front windows, a fence or hedge along the front of the yard
      const bedS = df < 0.5 ? Math.min(best.L - 1.2, dS + 2.2) : Math.max(1.2, dS - 2.2);
      if (hash(seed + 35) < 0.55 && !gar) junk.push({ kind: hash(seed + 36) < 0.6 ? 'flowers' : 'hedge', x: best.x0 + ux * bedS + ox * (porch ? dep + 0.5 : 0.6), z: best.z0 + uz * bedS + oz * (porch ? dep + 0.5 : 0.6), y: by, h: Math.atan2(ox, oz) });
      if (hash(seed + 66) < 0.06) { const gx = best.x0 + ux * bedS + ox * (porch ? dep + 1.1 : 1.3), gz = best.z0 + uz * bedS + oz * (porch ? dep + 1.1 : 1.3); junk.push({ kind: 'gnome', x: gx, z: gz, y: terrainHeight(gx, gz), h: Math.atan2(ox, oz) }); }
      const hasDrive = !has.drive && (gar || hash(seed + 34.5) < 0.6), driveS = gar ? gS : df < 0.5 ? best.L * 0.85 : best.L * 0.15;
      // front-yard fences belong to the pre-war blocks (picket, hedge, chain-link in the working-class West End)
      if (road && !has.fence && (a.year < 1946 || (a.year < 1975 && hash(seed + 38) < 0.12))) {
        const r = hash(seed + 37), kindF = dist === 'west' && r < 0.5 ? 'chainlink' : r < 0.45 ? 'picket' : r < 0.65 ? 'hedge' : null;
        if (kindF && fenceLine > 3.5 && fenceLine < 14) {
          const seg = kindF === 'chainlink' ? 3 : kindF === 'hedge' ? 2 : 2.4;
          for (let s = -3; s + seg <= best.L + 3.01; s += seg) {
            const mid = s + seg / 2;
            if (Math.abs(mid - dS) < seg * 0.5 || (hasDrive && Math.abs(mid - driveS) < seg * 0.5 + 1.4)) continue;
            const fx = best.x0 + ux * mid + ox * fenceLine, fz = best.z0 + uz * mid + oz * fenceLine;
            junk.push({ kind: kindF, x: fx, z: fz, y: terrainHeight(fx, fz), h: Math.atan2(ox, oz) });
          }
        }
      }
      // a flag on a pole out front (more common on newer lots)
      if (hash(seed + 67) < (a.year >= 1975 ? 0.07 : 0.03) && fenceLine > 5) { const fx = dx + ox * Math.min(5, fenceLine - 1) + ux * 2.5, fz = dz + oz * Math.min(5, fenceLine - 1) + uz * 2.5; junk.push({ kind: 'flagpole', x: fx, z: fz, y: terrainHeight(fx, fz), h: Math.atan2(ux, uz) }); }
      // driveway out to the kerb (in front of the garage doors when there are any), sometimes a pickup or car on it
      if (road && hasDrive) {
        const sx = best.x0 + ux * driveS + ox * 0.1, sz = best.z0 + uz * driveS + oz * 0.1, half = gar ? gw / 2 + 0.3 : 1.4;
        const len = (road.x - sx) * ox + (road.z - sz) * oz - (road.e.width || 7) / 2;
        if (len > 2 && len < 24) {
          const segs = Math.ceil(len / 4);
          for (let k = 0; k < segs; k++) {
            const a0 = (k / segs) * len, b0 = ((k + 1) / segs) * len, Pd = (o, w) => { const x = sx + ox * o + ux * w, z = sz + oz * o + uz * w; return [x, terrainHeight(x, z) + 0.05, z]; };
            face(X.lotB || B, [Pd(a0, -half), Pd(a0, half), Pd(b0, half), Pd(b0, -half)], [0, 1, 0], CONCRETE, pl, [[0, 0], [1, 0], [1, 1], [0, 1]]);
          }
          if (len > 6.5 && hash(seed + 64) < 0.5) newK.push(sx + ox * Math.min(len - 3, 3.6) - t.ox, sz + oz * Math.min(len - 3, 3.6) - t.oz, Math.atan2(ox, oz), 1);
        }
      }
      // the back yard: sheds, swing sets, trampolines (more of them on newer, bigger lots)
      let depth = 0; for (let i = 0; i < n; i++) depth = Math.max(depth, -((pts[i * 2] - cx) * ox + (pts[i * 2 + 1] - cz) * oz));
      const newer = a.year >= 1975, items = [];
      if (hash(seed + 60) < (newer ? 0.28 : 0.12)) items.push('swing');
      if (hash(seed + 61) < (newer ? 0.22 : 0.08)) items.push('tramp');
      if (hash(seed + 62) < (a.style === 'farmhouse' ? 0.15 : newer ? 0.25 : 0.3)) items.push('shed');
      items.forEach((kd, k) => {
        const back = depth + 4 + hash(seed + 63 + k) * 4, lat = (k - (items.length - 1) / 2) * 4.5, x = cx - ox * back + ux * lat, z = cz - oz * back + uz * lat;
        if (occupied(x, z, kd === 'tramp' ? 2.2 : 1.8) || nearestEdge(x, z, 6) || !placeOff(x, z, 2.2, { drop: true })) return;
        junk.push({ kind: kd, placed: true, x, z, y: terrainHeight(x, z), h: Math.atan2(ox, oz) + (kd === 'shed' ? Math.PI : 0) });
        if (kd === 'shed') X.solid.push(makeBox(x, z, ox, oz, 1.6, 1.3, terrainHeight(x, z) - 0.3, 3));
      });
      // farmhouses: a mailbox on a post at the road
      if (a.style === 'farmhouse' && road) { const l = Math.hypot(cx - road.x, cz - road.z) || 1, o = road.e.width / 2 + 1.6, mx = road.x + (cx - road.x) / l * o, mz = road.z + (cz - road.z) / l * o; junk.push({ kind: 'ruralbox', x: mx, z: mz, y: terrainHeight(mx, mz), h: Math.atan2(road.x - mx, road.z - mz) }); }
      // Christmas lights along the porch roof (and the eaves, below) when it snows; 55% of houses put them up
      if (porch && hash(seed + 90) < 0.55) {
        const px = best.x0 + ux * pc + ox * (dep + 0.08), pz = best.z0 + uz * pc + oz * (dep + 0.08), y = by + 2.86;
        glowQuad(glowB, [[px - ux * hwP, y, pz - uz * hwP], [px + ux * hwP, y, pz + uz * hwP], [px + ux * hwP, y + 0.08, pz + uz * hwP], [px - ux * hwP, y + 0.08, pz - uz * hwP]], [ox, 0, oz], [1, 1, 1], 2, 0, hwP * 2 / 0.33);
      }
    }
    // detached garages (OSM traces them): a door on the side facing the alley or street
    if (garage && best && road) {
      const ux = (best.x1 - best.x0) / best.L, uz = (best.z1 - best.z0) / best.L, w = Math.min(best.L - 0.6, best.L >= 6.2 ? 4.9 : 2.6);
      if (w > 1.8) { const gx = (best.x0 + best.x1) / 2, gz = (best.z0 + best.z1) / 2, gy = Math.max(baseY, terrainHeight(gx + best.ox, gz + best.oz)); obox(B, gx + best.ox * 0.04, gz + best.oz * 0.04, ux, uz, w / 2, 0.04, gy, Math.min(top - 0.1, gy + 2.15), GDOOR, atl(CELL.garage)); }
    }
    // industrial: a row of truck-dock doors (raised to trailer height, with bumpers) on the side facing the drive
    if (ind && best && best.L > 9) {
      const ux = (best.x1 - best.x0) / best.L, uz = (best.z1 - best.z0) / best.L, nD = Math.min(8, Math.floor((best.L - 3) / 4.6));
      for (let k = 0; k < nD; k++) {
        const s = (best.L - (nD - 1) * 4.6) / 2 + k * 4.6, x = best.x0 + ux * s + best.ox * 0.05, z = best.z0 + uz * s + best.oz * 0.05;
        obox(B, x, z, ux, uz, 1.5, 0.05, baseY + 1.1, Math.min(top - 0.3, baseY + 4.1), lin(0x55595d), atl(CELL.garage));
        for (const sx of [-1.75, 1.75]) obox(B, x + ux * sx + best.ox * 0.12, z + uz * sx + best.oz * 0.12, ux, uz, 0.12, 0.12, baseY + 0.9, baseY + 1.4, lin(0x1c1c1c), pl);
      }
    }
    // farmsteads keep a grass yard (no crop rows) and get hay bales by the barn
    if (farm) yards.push({ x: cx, z: cz, r: Math.sqrt(fp) * 0.7 + 14 });
    if (a.style === 'barn' && hash(seed + 71) < 0.55) for (let k = 0; k < 3; k++) { const hx = cx + (hash(seed + 72 + k) - 0.5) * 6 + Math.sqrt(fp) * 0.7 + 2, hz = cz + (hash(seed + 75 + k) - 0.5) * 6; if (!occupied(hx, hz, 1) && placeOff(hx, hz, 0.8, { drop: true })) { junk.push({ kind: 'haybale', placed: true, x: hx, z: hz, y: terrainHeight(hx, hz), h: hash(seed + k) * 3 }); X.solid.push(makeBox(hx, hz, 1, 0, 0.75, 0.75, terrainHeight(hx, hz) - 0.2, 1.5)); } }
    // car dealerships: shop=car on the building (rows of cars and flags in its lot, see detail.js)
    if (a.shop === 'car' || /\b(Motors|Auto Sales|Chevrolet|Ford|Toyota|Honda|Nissan|Hyundai|Kia|Subaru|Dodge|Jeep|Buick|GMC|Cadillac|Lexus|Mazda|Volkswagen)\b/.test(name)) dealers.push({ x: cx, z: cz });
    // a lit sign over the shop fronts on the wall facing the street: the real name when the map has one
    if (store && best && hash(seed + 9) < 0.85) {
      const w = Math.min(best.L * 0.6, 9), mx = (best.x0 + best.x1) / 2 + best.ox * 0.14, mz = (best.z0 + best.z1) / 2 + best.oz * 0.14;
      const ux = (best.x1 - best.x0) / best.L, uz = (best.z1 - best.z0) / best.L, y0 = baseY + 3.25, y1 = baseY + 4.15;
      const shopName = label || (a.area === 'strip' && fp < 650 && road && PADROAD.has(road.e.cls) ? pick(STRIP_FOOD, seed + 85) : '');
      if (shopName) panel(litB, mx, (y0 + y1) / 2, mz, best.ox, best.oz, Math.min(w, 4.2), Math.min(w, 4.2) / 4.67, nameUV('shop', shopName, t.key), null, false, 1);
      else if (SB) {
        const flip = ux * best.oz - uz * best.ox > 0;
        const si = Math.floor(hash(seed + 11) * 128), su = (si % 8) / 8, sv = 1 - (Math.floor(si / 8) + 1) / 16;
        const ax = mx - ux * w / 2, az = mz - uz * w / 2, bx = mx + ux * w / 2, bz = mz + uz * w / 2;
        const i0 = SB.v(ax, y0, az, best.ox, 0, best.oz, 1, 1, 1, flip ? su : su + 1 / 8, sv), i1 = SB.v(bx, y0, bz, best.ox, 0, best.oz, 1, 1, 1, flip ? su + 1 / 8 : su, sv);
        const i2 = SB.v(bx, y1, bz, best.ox, 0, best.oz, 1, 1, 1, flip ? su + 1 / 8 : su, sv + 1 / 16), i3 = SB.v(ax, y1, az, best.ox, 0, best.oz, 1, 1, 1, flip ? su : su + 1 / 8, sv + 1 / 16);
        if (flip) SB.quad(i0, i1, i2, i3); else SB.quad(i1, i0, i3, i2);
      }
    }
    // strip pads (fast food, gas, banks along the arterials): a tall pylon sign at the road
    if (a.area === 'strip' && !sloped && fp > 110 && fp < 650 && road && PADROAD.has(road.e.cls) && road.d < 60 && hash(seed + 86) < 0.8) {
      const l = Math.hypot(cx - road.x, cz - road.z) || 1, o = road.e.width / 2 + 3.2, pp = placeOff(road.x + (cx - road.x) / l * o, road.z + (cz - road.z) / l * o, 0.5) || { x: NaN };
      const px = pp.x, pz = pp.z, py = terrainHeight(px, pz);
      if (isFinite(px)) {
      X.posts?.push({ kind: 'pylon', x: px, z: pz });
      const nx = Math.sin(road.h), nz = Math.cos(road.h), ux = nz, uz = -nx, txt = label || pick(STRIP_FOOD, seed + 85);
      for (const s of [-1.1, 1.1]) obox(B, px + ux * s, pz + uz * s, 1, 0, 0.16, 0.16, py - 0.3, py + 7.4, lin(0x6d7175), pl);
      obox(B, px, pz, ux, uz, 1.95, 0.25, py + 7.4, py + 8.4, lin(0x2a2c2e), pl);
      panel(litB, px, py + 7.9, pz, nx, nz, 3.7, 0.79, nameUV('pole', txt, t.key), undefined, false, 1);
      X.solid.push(makeBox(px, pz, nx, nz, 0.25, 1.3, py - 0.5, 7.5));
      // drive-through menu board along the side
      const mx = cx + ux * (Math.sqrt(fp) / 2 + 2.2), mz = cz + uz * (Math.sqrt(fp) / 2 + 2.2);
      if (!occupied(mx, mz, 0.8) && !nearestEdge(mx, mz, 4, (e) => e.cls !== 'service')) junk.push({ kind: 'menuboard', x: mx, z: mz, y: terrainHeight(mx, mz), h: Math.atan2(-ux, -uz) });
      }
    }
    // big boxes: the store's name in big letters over the entrance and a glass vestibule; cart corrals go in its lot
    if (bigBox && best) {
      const ux = (best.x1 - best.x0) / best.L, uz = (best.z1 - best.z0) / best.L, mx = (best.x0 + best.x1) / 2, mz = (best.z0 + best.z1) / 2;
      const w = Math.min(best.L * 0.42, 20), txt = label || pick(BIGBOX, seed + 87);
      panel(litB, mx + best.ox * 0.1, Math.max(baseY + 4.6, top - 0.6 - w / 9.3), mz + best.oz * 0.1, best.ox, best.oz, w, w / 4.67, nameUV('bigbox', txt, t.key), null, false, 1);
      obox(B, mx + best.ox * 2.2, mz + best.oz * 2.2, ux, uz, Math.min(5, best.L * 0.15), 2.2, baseY - 0.3, baseY + 4.2, [1, 1, 1], S, 18);
      bigBoxes.push({ x: mx + best.ox * 30, z: mz + best.oz * 30 });
    }
    // downtown: a faded painted ad high on an exposed side wall of an old brick block
    if (a.area === 'core' && cell.startsWith('brick') && hgt > 8 && !sloped && hash(seed + 80) < 0.3) {
      let side = -1, sl = 6;
      for (let i = 0; i < n; i++) { if (best && i === best.i) continue; const L = Math.hypot(pts[((i + 1) % n) * 2] - pts[i * 2], pts[((i + 1) % n) * 2 + 1] - pts[i * 2 + 1]); if (L > sl) { sl = L; side = i; } }
      if (side >= 0) {
        const x0 = pts[side * 2], z0 = pts[side * 2 + 1], x1 = pts[((side + 1) % n) * 2], z1 = pts[((side + 1) % n) * 2 + 1], nn = ol.N[side];
        const w = Math.min(sl * 0.7, 9), h = w / 4.67, mx = (x0 + x1) / 2 + nn[0] * 0.04, mz = (z0 + z1) / 2 + nn[1] * 0.04;
        if (!occupied(mx + nn[0] * 1.5, mz + nn[1] * 1.5, 0.5)) panel(namesB, mx, top - 1.3 - h / 2, mz, nn[0], nn[1], w, h, nameUV('ghost', pick(GHOST, seed + 84), t.key), null);
      }
    }
    // a little grit in the older and rougher parts of town: tags on walls, bags and a dumpster out back
    const gritty = dist === 'west' || dist === 'riverfront' || kind === 4 || a.area === 'industrial' || (dist === 'hilltop' && !sloped);
    if (GB && gritty && !sloped && hash(seed + 21) < 0.35) {
      for (let i = 0; i < n; i++) {
        const x0 = pts[i * 2], z0 = pts[i * 2 + 1], x1 = pts[((i + 1) % n) * 2], z1 = pts[((i + 1) % n) * 2 + 1], L = Math.hypot(x1 - x0, z1 - z0);
        if (L < 6 || hash(seed + i * 3) > 0.4) continue;
        let ox = (z1 - z0) / L, oz = -(x1 - x0) / L;
        if (pointInPoly((x0 + x1) / 2 + ox * 0.3, (z0 + z1) / 2 + oz * 0.3, pts)) { ox = -ox; oz = -oz; }
        const ux = (x1 - x0) / L, uz = (z1 - z0) / L, w = 3.4, f = 0.2 + hash(seed + i) * 0.6, mx = x0 + ux * L * f + ox * 0.08, mz = z0 + uz * L * f + oz * 0.08;
        const ti = Math.floor(hash(seed + i * 7) * 8), su = (ti % 4) / 4, sv = 1 - (Math.floor(ti / 4) + 1) / 2, flip = ux * oz - uz * ox > 0;
        const y0 = baseY + 0.3, y1 = baseY + 2.1, ax = mx - ux * w / 2, az = mz - uz * w / 2, bx = mx + ux * w / 2, bz = mz + uz * w / 2;
        const i0 = GB.v(ax, y0, az, ox, 0, oz, 1, 1, 1, flip ? su : su + 0.25, sv), i1 = GB.v(bx, y0, bz, ox, 0, oz, 1, 1, 1, flip ? su + 0.25 : su, sv);
        const i2 = GB.v(bx, y1, bz, ox, 0, oz, 1, 1, 1, flip ? su + 0.25 : su, sv + 0.5), i3 = GB.v(ax, y1, az, ox, 0, oz, 1, 1, 1, flip ? su : su + 0.25, sv + 0.5);
        if (flip) GB.quad(i0, i1, i2, i3); else GB.quad(i1, i0, i3, i2);
        if (junk && hash(seed + i * 11) < 0.5) {
          const jx = x0 + ux * L * (1 - f) + ox * 1.1, jz = z0 + uz * L * (1 - f) + oz * 1.1;
          junk.push({ kind: 'dumpster', x: jx, z: jz, y: terrainHeight(jx, jz), h: Math.atan2(ux, uz) });
          for (let k = 0; k < 3; k++) junk.push({ kind: 'bag', x: jx + ux * (1.6 + k * 0.5), z: jz + uz * (1.6 + k * 0.5), y: terrainHeight(jx, jz), h: k });
        }
        break;
      }
    }
    // roof
    const flatRoof = (y, at, tintR) => {
      const contour = []; for (let i = 0; i < n; i++) contour.push(new THREE.Vector2(pts[i * 2], pts[i * 2 + 1]));
      const tris = THREE.ShapeUtils.triangulateShape(contour, []);
      const idx = contour.map((p) => B.v(p.x, y, p.y, 0, 1, 0, ...tintR, p.x / 16, p.y / 16, ...at));
      for (const [ia, ib, ic] of tris) {
        const pa = contour[ia], pb = contour[ib], pc = contour[ic];
        const cr = (pb.x - pa.x) * (pc.y - pa.y) - (pb.y - pa.y) * (pc.x - pa.x);
        if (cr < 0) B.i.push(idx[ia], idx[ib], idx[ic]); else B.i.push(idx[ia], idx[ic], idx[ib]);
      }
    };
    if (!sloped) {
      const g = 0.8 + hash(seed + 7) * 0.25;
      flatRoof(top, R, [g, g, g * 0.98]);
      if (kind === 1 || hgt < 4) return;
      // cornice and parapet: heavy stone ones on old brick and stone blocks, a thin metal cap on glass
      const old = cell.startsWith('brick') || cell === 'stone' || cell === 'church';
      const trim = cell === 'stone' ? lin(0xd8ccb0) : old ? lin([0xe8dcc0, 0xd9cdb5, 0xbfb3a0, 0x8f4a3a][Math.floor(hash(seed + 41) * 4)]) : cell === 'glass' || cell === 'office' ? lin(0x8c949a) : lin(0xd5d0c6);
      if (old) {
        const big = hgt > 14;
        band(B, pts, ol, top - (big ? 0.75 : 0.45), top + (big ? 0.7 : 0.4), big ? 0.42 : 0.24, trim, pl, 0.25);
        if (!store && hgt > 8) band(B, pts, ol, baseY + 3.25, baseY + 3.45, 0.1, trim, pl);
        if (big) band(B, pts, ol, top - 3.6, top - 3.4, 0.08, trim, pl);
      } else band(B, pts, ol, top - 0.25, top + (cell === 'metal' ? 0.15 : 0.55), cell === 'metal' ? 0.05 : 0.08, trim, pl, 0.18);
      // the roof: a mechanical penthouse on towers, AC units, water tanks on old blocks
      const inside = (x, z, r) => pointInPoly(x, z, pts) && pointInPoly(x + r, z + r, pts) && pointInPoly(x - r, z - r, pts) && pointInPoly(x + r, z - r, pts) && pointInPoly(x - r, z + r, pts);
      let lx = 1, lz = 0, lb = 0;
      for (let i = 0; i < n; i++) { const ddx = pts[((i + 1) % n) * 2] - pts[i * 2], ddz = pts[((i + 1) % n) * 2 + 1] - pts[i * 2 + 1], l = Math.hypot(ddx, ddz); if (l > lb) { lb = l; lx = ddx / l; lz = ddz / l; } }
      const rh = Math.atan2(lx, lz);
      if (hgt > 45 && inside(cx, cz, 7)) {
        // a stepped crown on the tall towers, with a mast on the very top
        const A2 = atl(CELL[cell]), w0 = Math.min(9, lb * 0.32), crown = [cx - lx * w0 + lz * w0 * 0.75, cz - lz * w0 - lx * w0 * 0.75, cx + lx * w0 + lz * w0 * 0.75, cz + lz * w0 - lx * w0 * 0.75, cx + lx * w0 - lz * w0 * 0.75, cz + lz * w0 + lx * w0 * 0.75, cx - lx * w0 - lz * w0 * 0.75, cz - lz * w0 + lx * w0 * 0.75];
        obox(B, cx, cz, lx, lz, w0, w0 * 0.75, top, top + 6.6, tint, A2, 16);
        band(B, crown, outline(crown), top + 6.4, top + 7.0, 0.2, trim, pl, 0.15);
        obox(B, cx, cz, lx, lz, w0 * 0.55, w0 * 0.4, top + 6.6, top + 10.5, lin(0xb9bcbe), atl(CELL.metal));
        obox(B, cx, cz, lx, lz, 0.15, 0.15, top + 10.5, top + 18 + hash(seed + 60) * 10, lin(0x9a9c9e), pl);
      } else if (hgt > 16 && inside(cx, cz, 4)) obox(B, cx, cz, lx, lz, Math.min(4, lb * 0.16), 2.6, top, top + 3.2, lin(0xb9bcbe), atl(CELL.metal));
      const nAc = Math.floor(hash(seed + 42) * (hgt > 16 || bigBox ? 5 : 3));
      for (let k = 0; k < nAc; k++) {
        const ax = cx + (hash(seed + k * 5 + 43) - 0.5) * lb * 0.6, az = cz + (hash(seed + k * 5 + 44) - 0.5) * lb * 0.6;
        if (inside(ax, az, 1.3) && Math.hypot(ax - cx, az - cz) > 4.5) junk.push({ kind: 'ac', x: ax, z: az, y: top, h: rh + (k % 2) * Math.PI / 2 });
      }
      if (old && hgt > 9 && (a.area === 'core' || dist === 'west') && hash(seed + 45) < 0.35) {
        const tx = cx + (hash(seed + 46) - 0.5) * lb * 0.4, tz = cz + (hash(seed + 47) - 0.5) * lb * 0.4;
        if (inside(tx, tz, 2.2)) junk.push({ kind: 'tank', x: tx, z: tz, y: top, h: hash(seed + 48) * 6 });
      }
      // fire escape down a side wall of old walk-ups
      if (old && !store && hgt > 9 && hgt < 40 && hash(seed + 49) < 0.55) {
        for (let i = 0; i < n; i++) {
          if (best && i === best.i) continue;
          const x0 = pts[i * 2], z0 = pts[i * 2 + 1], x1 = pts[((i + 1) % n) * 2], z1 = pts[((i + 1) % n) * 2 + 1], L = Math.hypot(x1 - x0, z1 - z0);
          if (L < 8) continue;
          const nn = ol.N[i], f = 0.3 + hash(seed + 50) * 0.4, fx = x0 + (x1 - x0) * f + nn[0] * 0.05, fz = z0 + (z1 - z0) * f + nn[1] * 0.05, fh = Math.atan2(nn[0], nn[1]);
          for (let y = baseY + 3.3; y < top - 2.5; y += 3.3) junk.push({ kind: 'fesc', x: fx, z: fz, y, h: fh });
          break;
        }
      }
      return;
    }
    const rt = lin(tagCol(a.roofCol) ?? (SL ? pick(SL[2], seed + 8) : a.style === 'silo' || a.style === 'bin' ? (a.style === 'silo' && tint[2] > tint[0] ? 0x1d3558 : 0x9aa0a6) : a.style === 'shed_big' ? 0x8f9396 : ROOF_TINTS[Math.floor(hash(seed + 8) * ROOF_TINTS.length)]));
    // round silos and grain bins: a cone or dome over the footprint
    if (form === 'cone') {
      const r = Math.sqrt(fp / Math.PI), apex = [cx, top + r * (a.style === 'silo' ? 0.6 : 0.42), cz], inner = [cx, top - 1, cz];
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; tri(B, [pts[i * 2], top, pts[i * 2 + 1]], [pts[j * 2], top, pts[j * 2 + 1]], apex, rt, R, [[0, 0], [1, 0], [0.5, 1]], inner); }
      return;
    }
    // pitched roofs over the footprint's oriented box: gable, gambrel (barns) or hip (foursquares, bigger ranches)
    let longest = 0, ux = 1, uz = 0;
    for (let i = 0; i < n; i++) { const ddx = pts[((i + 1) % n) * 2] - pts[i * 2], ddz = pts[((i + 1) % n) * 2 + 1] - pts[i * 2 + 1], l = Math.hypot(ddx, ddz); if (l > longest) { longest = l; ux = ddx / l; uz = ddz / l; } }
    const vx = -uz, vz = ux;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (let i = 0; i < n; i++) { const pu = (pts[i * 2] - cx) * ux + (pts[i * 2 + 1] - cz) * uz, pv = (pts[i * 2] - cx) * vx + (pts[i * 2 + 1] - cz) * vz; u0 = Math.min(u0, pu); u1 = Math.max(u1, pu); v0 = Math.min(v0, pv); v1 = Math.max(v1, pv); }
    const oh = 0.45; u0 -= oh; u1 += oh; v0 -= oh; v1 += oh;
    const span = v1 - v0, vm = (v0 + v1) / 2;
    const pitch = HS ? HS.pitch : a.style === 'barn' ? 0.95 : a.style === 'shed_big' ? 0.22 : a.style === 'garage' ? 0.38 : a.style === 'shed' ? 0.45 : null;
    const rise = pitch != null ? Math.max(0.6, Math.min(6.5, (span / 2) * pitch)) : Math.max(1.3, Math.min(3.6, span * 0.36));
    const W = (pu, pv) => [cx + ux * pu + vx * pv, cz + uz * pu + vz * pv];
    const ey = top - 0.15, ry = top + rise, inner = [cx, top - 1.5, cz];
    if (road) streetSide = (road.x - cx) * vx + (road.z - cz) * vz > 0 ? 1 : -1;
    if (form === 'hip') {
      const hv = span / 2; let ua = u0 + hv, ub = u1 - hv; if (ua > ub) ua = ub = (u0 + u1) / 2;
      const P = (pu, pv, y) => { const [x, z] = W(pu, pv); return [x, y, z]; };
      const c00 = P(u0, v0, ey), c10 = P(u1, v0, ey), c11 = P(u1, v1, ey), c01 = P(u0, v1, ey), r1 = P(ua, vm, ry), r2 = P(ub, vm, ry);
      const uv = (p) => [p[0] / 6 + p[1] / 9, p[2] / 6];
      for (const [p, q, r] of [[c00, c10, r2], [c00, r2, r1], [c11, c01, r1], [c11, r1, r2], [c10, c11, r2], [c01, c00, r1]]) tri(B, p, q, r, rt, SH, [uv(p), uv(q), uv(r)], inner);
    } else {
      const prof = form === 'gambrel' ? [[0, 0], [0.18, 0.62], [0.5, 1], [0.82, 0.62], [1, 0]] : [[0, 0], [0.5, 1], [1, 0]];
      const PV = prof.map(([f, r]) => [v0 + f * span, ey + r * rise]);
      let acc = 0;
      for (let i = 0; i + 1 < PV.length; i++) {
        const [va, ya] = PV[i], [vb, yb2] = PV[i + 1], dv = vb - va, dy = yb2 - ya, sl = Math.hypot(dv, dy), nv = -dy / sl, ny = dv / sl;
        const [xa0, za0] = W(u0, va), [xa1, za1] = W(u1, va), [xb1, zb1] = W(u1, vb), [xb0, zb0] = W(u0, vb);
        face(B, [[xa0, ya, za0], [xa1, ya, za1], [xb1, yb2, zb1], [xb0, yb2, zb0]], [vx * nv, ny, vz * nv], rt, SH, [[u0 / 6, acc / 6], [u1 / 6, acc / 6], [u1 / 6, (acc + sl) / 6], [u0 / 6, (acc + sl) / 6]]);
        acc += sl;
      }
      // gable ends in the wall texture: the profile, with its eaves pulled in to the walls, fanned from the middle
      const endP = PV.map(([pv, y], i) => [i === 0 ? v0 + oh : i === PV.length - 1 ? v1 - oh : pv, i === 0 || i === PV.length - 1 ? top : y]);
      for (const ua of [u0 + oh, u1 - oh]) {
        const [mx, mz] = W(ua, vm), mid = [mx, top, mz];
        for (let i = 0; i + 1 < endP.length; i++) {
          const [xa, za] = W(ua, endP[i][0]), [xb, zb] = W(ua, endP[i + 1][0]), pa = [xa, endP[i][1], za], pb = [xb, endP[i + 1][1], zb];
          const uvw = (p, pv) => [(pv - v0) / 16, (p[1] - baseY) / 13.2];
          tri(B, mid, pa, pb, tint, A, [uvw(mid, vm), uvw(pa, endP[i][0]), uvw(pb, endP[i + 1][0])], [cx, top - 1, cz]);
        }
      }
      // barns: big doors and a hayloft door on the gable end that faces the road
      if (a.style === 'barn' && road) {
        const ue = (road.x - cx) * ux + (road.z - cz) * uz > 0 ? u1 - oh + 0.06 : u0 + oh - 0.06, [bx, bz] = W(ue, vm), dW = span * 0.2;
        obox(B, bx, bz, vx, vz, dW + 0.18, 0.05, baseY - 0.2, baseY + 3.75, lin(0xf0ece4), pl);
        obox(B, bx + ux * Math.sign(ue) * 0.03, bz + uz * Math.sign(ue) * 0.03, vx, vz, dW, 0.05, baseY - 0.2, baseY + 3.55, lin(0x5e1d16), pl);
        obox(B, bx, bz, vx, vz, 0.75, 0.05, top + 0.4, top + 1.8, lin(0xf0ece4), pl);
      }
    }
    flatRoof(top - 0.2, R, [0.6, 0.6, 0.6]); // ceiling under the roof (fills odd footprints)
    if (house) {
      // dormer on the street side of foursquares and bungalows
      if (HS && HS.dormer && streetSide && span > 6 && u1 - u0 > 6.5) {
        const dv = vm + streetSide * span * 0.2, yAt = ey + rise * (1 - Math.abs(dv - vm) / (span / 2)), [dx2, dz2] = W((u0 + u1) / 2, dv);
        obox(B, dx2, dz2, ux, uz, 1.15, 0.95, yAt - 0.5, yAt + 1.25, tint, A);
        obox(B, dx2, dz2, ux, uz, 1.35, 1.15, yAt + 1.25, yAt + 1.4, rt, SH);
      }
      // Queen Anne turret on the street corner of the bigger / more complex Victorians
      if (a.style === 'victorian' && best && (a.nv >= 8 || hash(seed + 70) < 0.3)) {
        const end = hash(seed + 69) < 0.5, tx = (end ? best.x1 : best.x0) + best.ox * 0.4, tz = (end ? best.z1 : best.z0) + best.oz * 0.4, Rt = 1.7, y0 = baseY - 0.5, y1 = top + 1.0, yA = y1 + 3.8;
        for (let k = 0; k < 8; k++) {
          const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2, am = (a0 + a1) / 2;
          const p0 = [tx + Math.cos(a0) * Rt, tz + Math.sin(a0) * Rt], p1 = [tx + Math.cos(a1) * Rt, tz + Math.sin(a1) * Rt], w = Rt * 0.765;
          face(B, [[p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]]], [Math.cos(am), 0, Math.sin(am)], tint, A, [[k * w / 16, (y0 - baseY) / 13.2], [(k + 1) * w / 16, (y0 - baseY) / 13.2], [(k + 1) * w / 16, (y1 - baseY) / 13.2], [k * w / 16, (y1 - baseY) / 13.2]]);
          tri(B, [p0[0], y1, p0[1]], [p1[0], y1, p1[1]], [tx, yA, tz], rt, SH, [[0, 0], [0.5, 0], [0.25, 0.7]], [tx, y1 - 1, tz]);
        }
      }
      // Christmas lights along the street-side eave
      if (streetSide && hash(seed + 90) < 0.55 && form !== 'hip') {
        const ve = streetSide > 0 ? v1 : v0, [ax, az] = W(u0, ve), [bx, bz] = W(u1, ve), L = u1 - u0, y = ey - 0.06;
        glowQuad(glowB, [[ax, y, az], [bx, y, bz], [bx, y + 0.08, bz], [ax, y + 0.08, az]], [vx * streetSide, 0, vz * streetSide], [1, 1, 1], 2, 0, L / 0.33);
      }
    }
    if (hgt >= 3 && (house || a.style === 'farmhouse' || a.style === 'garage')) {
      const gut = hash(seed + 51) < 0.5 ? TRIM : lin(0x6e6a64);
      if (form !== 'hip') for (const va of [v0, v1]) { const [gx, gz] = W((u0 + u1) / 2, va); obox(B, gx, gz, ux, uz, (u1 - u0) / 2, 0.07, ey - 0.16, ey - 0.02, gut, pl, 4, true); }
      const [dx0, dz0] = W(u0 + 0.1, v0 + 0.1); obox(B, dx0, dz0, ux, uz, 0.05, 0.05, baseY, ey - 0.1, gut, pl);
      const [dx1, dz1] = W(u1 - 0.1, v1 - 0.1); obox(B, dx1, dz1, ux, uz, 0.05, 0.05, baseY, ey - 0.1, gut, pl);
      if (house && hash(seed + 52) < (a.year && a.year < 1950 ? 0.7 : 0.35) && u1 - u0 > 5) {
        const cu = hash(seed + 53) < 0.5 ? u0 + 1.2 : u1 - 1.2, [chx, chz] = W(cu, vm + 0.5);
        obox(B, chx, chz, ux, uz, 0.42, 0.32, top, ry + 0.9, lin(BRICK_TINTS[0]), atl(CELL.brick3), 4);
        obox(B, chx, chz, ux, uz, 0.5, 0.4, ry + 0.9, ry + 1.05, lin(0x8c8a86), pl);
      }
    }
  });
}

// A gas-station / drive-thru canopy: a slab with a coloured fascia on a row of columns, lit underneath at night.
function canopy(B, glowB, pts, cx, cz, baseY, top, seed) {
  const n = pts.length / 2, pl = [0.75, 0.25], R = [CELL.roof[0] / 4, 1 - (CELL.roof[1] + 1) / 4];
  const fascia = lin(pick([0xd62828, 0x1f6fd1, 0x2a9d3a, 0xf2f2f2, 0xf2b705, 0x111111], seed + 1)), WHITE = lin(0xf4f4f4);
  band(B, pts, outline(pts), top - 0.9, top, 0.02, fascia, pl);
  const contour = []; for (let i = 0; i < n; i++) contour.push(new THREE.Vector2(pts[i * 2], pts[i * 2 + 1]));
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  for (const [y, up] of [[top, true], [top - 0.9, false]]) {
    const idx = contour.map((p) => B.v(p.x, y, p.y, 0, up ? 1 : -1, 0, ...(up ? [0.8, 0.8, 0.8] : WHITE), p.x / 16, p.y / 16, ...(up ? R : pl)));
    for (const [a, b, c] of tris) { const pa = contour[a], pb = contour[b], pc = contour[c], cr = (pb.x - pa.x) * (pc.y - pa.y) - (pb.y - pa.y) * (pc.x - pa.x); if ((cr < 0) === up) B.i.push(idx[a], idx[b], idx[c]); else B.i.push(idx[a], idx[c], idx[b]); }
  }
  // columns down the middle along the long side; a lit panel under the slab
  let L = 0, ux = 1, uz = 0; for (let i = 0; i < n; i++) { const dx = pts[((i + 1) % n) * 2] - pts[i * 2], dz = pts[((i + 1) % n) * 2 + 1] - pts[i * 2 + 1], l = Math.hypot(dx, dz); if (l > L) { L = l; ux = dx / l; uz = dz / l; } }
  let u0 = Infinity, u1 = -Infinity; for (let i = 0; i < n; i++) { const u = (pts[i * 2] - cx) * ux + (pts[i * 2 + 1] - cz) * uz; u0 = Math.min(u0, u); u1 = Math.max(u1, u); }
  const nc = Math.max(2, Math.round((u1 - u0) / 8));
  for (let k = 0; k < nc; k++) { const u = u0 + 2 + ((u1 - u0 - 4) * k) / (nc - 1), x = cx + ux * u, z = cz + uz * u; obox(B, x, z, ux, uz, 0.3, 0.3, Math.min(baseY, terrainHeight(x, z)) - 0.3, top - 0.9, WHITE, pl); }
  const y = top - 0.92, w = (u1 - u0) / 2 - 1, vx = -uz * 2, vz = ux * 2;
  glowQuad(glowB, [[cx - ux * w - vx, y, cz - uz * w - vz], [cx + ux * w - vx, y, cz + uz * w - vz], [cx + ux * w + vx, y, cz + uz * w + vz], [cx - ux * w + vx, y, cz - uz * w + vz]], [0, -1, 0], [0.9, 0.9, 0.85], 3, 0);
}

// ---------- street lights (placed along roads, deterministic; mapped lamps replace them nearby) ----------
function streetLights(t, junk, mapped) {
  const out = [];
  for (const id of t.e) {
    const e = G.edges[id]; if (!e) continue;
    const L = roadLook(e, t);
    if (e.len < 20 || e.cls === 'service' || e.cls === 'track' || e.cls === 'motor') continue;
    if (L.a === 'rural' && !L.lit) continue; // no streetlights out in the country
    if (!L.sw.length && L.a !== 'strip' && !L.lit) continue;
    const core = L.a === 'core', gap = core ? 22 : L.a === 'strip' ? 38 : L.a === 'suburb' ? 55 : 44;
    const s0 = 8 + hash(id) * gap;
    for (let s = s0, k = 0; s < e.len - 8; s += gap, k++) {
      const p = pointOnEdge(e, s);
      const side = (k + id) % 2 ? 1 : -1, off = e.width / 2 + 0.6;
      const q = placeOff(p.x + Math.cos(p.h) * off * side, p.z - Math.sin(p.h) * off * side, 0.2, { side }); if (!q) continue;
      const x = q.x, z = q.z;
      if (!inTile(t, x, z) || mapped.some((m) => (m.x - x) ** 2 + (m.z - z) ** 2 < 500)) continue;
      const l = { x, z, y: terrainHeight(x, z), h: p.h + (side > 0 ? -Math.PI / 2 : Math.PI / 2), placed: true };
      out.push(l);
      if (core && k % 2 === 0) junk.push({ kind: 'banner', x, z, y: l.y, h: l.h }); // seasonal banners downtown
    }
  }
  return out;
}

// ---------- street furniture along the sidewalks (deterministic per edge; kinds the map has are skipped) ----------
function streetProps(t, junk, boxes, has) {
  for (const id of t.e) {
    const e = G.edges[id]; if (!e) continue;
    const L = roadLook(e, t);
    if (!L.sw.length || e.len < 30) continue;
    const busy = L.a === 'core', big = e.cls === 'primary' || e.cls === 'secondary';
    const put = (kind, s, side, off, extra = {}) => {
      if (has.has(kind)) return null;
      const p = pointOnEdge(e, s), q = placeOff(p.x + Math.cos(p.h) * off * side, p.z - Math.sin(p.h) * off * side, kind === 'busstop' ? 1.4 : 0.4, { side });
      if (!q || !inTile(t, q.x, q.z)) return null;
      const x = q.x, z = q.z, j = { kind, x, z, y: terrainHeight(x, z), h: p.h + (side > 0 ? -Math.PI / 2 : Math.PI / 2), placed: true, ...extra };
      junk.push(j); return j;
    };
    const kerb = e.width / 2 + 0.55, back = e.width / 2 + WALK_W - 0.35;
    if (hash(id * 3.7) < 0.8) put('hydrant', 9 + hash(id) * 6, hash(id * 1.3) < 0.5 ? 1 : -1, kerb);
    if (big && e.len > 60 && hash(id * 5.1) < (busy ? 0.35 : 0.25)) {
      const side = hash(id * 2.9) < 0.5 ? 1 : -1, s = e.len * (0.35 + hash(id * 7.7) * 0.3);
      const j = put('busstop', s, side, e.width / 2 + 1.25);
      if (j) { j.busStop = true; boxes.push(makeBox(j.x - Math.sin(j.h) * 0.6, j.z - Math.cos(j.h) * 0.6, Math.cos(j.h), -Math.sin(j.h), 1.6, 0.1, j.y, 2.5)); }
    }
    if (busy || district(e.pts[0], e.pts[1]) === 'riverfront') {
      for (let s = 16 + hash(id * 9.1) * 20, k = 0; s < e.len - 14; s += 34 + hash(id + k) * 30, k++) {
        const side = (k + id) % 2 ? 1 : -1, r = hash(id * 13 + k);
        if (r < 0.3) put('bench', s, side, back);
        else if (r < 0.55) put('bin', s, side, kerb + 0.1);
        else if (r < 0.7 && busy) { put('newsbox', s, side, back + 0.05); put('newsbox', s + 0.6, side, back + 0.05); }
        else if (r < 0.78) put('mailbox', s, side, kerb + 0.2);
      }
      // planters along downtown kerbs, staggered across the street
      if (busy) for (let s = 12 + hash(id * 2.3) * 10, k = 0; s < e.len - 10; s += 24, k++) put('planter', s, k % 2 ? 1 : -1, kerb + 0.35);
      // parking meters: downtown Davenport still has them
      if (busy && e.cls !== 'primary' && district(e.pts[0], e.pts[1]) === 'downtown') for (let s = 14, k = 0; s < e.len - 14; s += 7.5, k++) if (hash(id * 17 + k) < 0.8) { put('meter', s, 1, kerb - 0.15); put('meter', s + 3, -1, kerb - 0.15); }
    } else if (hash(id * 11.3) < 0.25) put(hash(id * 4.1) < 0.6 ? 'bin' : 'bench', e.len * 0.5, (id % 2) ? 1 : -1, hash(id) < 0.5 ? kerb + 0.1 : back);
  }
}

// ---------- railway track (ballast + two rails), cut into tiles like the roads ----------
function buildRail(t, B) {
  if (!D.rail) return;
  const BAL = lin(0x6b665e), RAIL = lin(0x8a8f96), TIE = lin(0x4e3b2c);
  for (const l of D.rail.tracks) {
    if (!l.bbox) { let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity; for (let i = 0; i < l.length; i += 2) { a = Math.min(a, l[i]); b = Math.max(b, l[i]); c = Math.min(c, l[i + 1]); d = Math.max(d, l[i + 1]); } l.bbox = [a, b, c, d]; }
    if (l.bbox[1] < t.ox - 5 || l.bbox[0] > t.ox + TILE + 5 || l.bbox[3] < t.oz - 5 || l.bbox[2] > t.oz + TILE + 5) continue;
    for (let i = 2; i < l.length; i += 2) {
      const ax = l[i - 2], az = l[i - 1], bx = l[i], bz = l[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 4));
      const ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux;
      for (let k = 0; k < n; k++) {
        const x0 = ax + (bx - ax) * (k / n), z0 = az + (bz - az) * (k / n), x1 = ax + (bx - ax) * ((k + 1) / n), z1 = az + (bz - az) * ((k + 1) / n);
        if (!inTile(t, (x0 + x1) / 2, (z0 + z1) / 2)) continue;
        const onRoad = t.c[Math.min(49, Math.floor(((z0 + z1) / 2 - t.oz) / 4)) * 50 + Math.min(49, Math.floor(((x0 + x1) / 2 - t.ox) / 4))] === C.road; // level crossing: rails only
        const y0 = terrainHeight(x0, z0) + 0.1, y1 = terrainHeight(x1, z1) + 0.1;
        const strip = (o0, o1, lift, c) => { const p = [[x0 + nx * o0, z0 + nz * o0, y0], [x0 + nx * o1, z0 + nz * o1, y0], [x1 + nx * o1, z1 + nz * o1, y1], [x1 + nx * o0, z1 + nz * o0, y1]].map(([x, z, y]) => B.v(x, y + lift, z, 0, 1, 0, ...c, 0, 0)); B.quad(p[1], p[0], p[3], p[2]); };
        if (!onRoad) strip(-1.6, 1.6, 0, BAL);
        if (!onRoad) for (let tt = 0; tt < 4; tt += 0.8) { const f = tt / 4; const px = x0 + (x1 - x0) * f, pz = z0 + (z1 - z0) * f; const y = y0 + (y1 - y0) * f + 0.03; const q = [[px + nx * -1.25, pz + nz * -1.25], [px + nx * 1.25, pz + nz * 1.25], [px + nx * 1.25 + ux * 0.25, pz + nz * 1.25 + uz * 0.25], [px + nx * -1.25 + ux * 0.25, pz + nz * -1.25 + uz * 0.25]].map(([x, z]) => B.v(x, y, z, 0, 1, 0, ...TIE, 0, 0)); B.quad(q[1], q[0], q[3], q[2]); }
        strip(-0.8, -0.68, 0.14, RAIL); strip(0.68, 0.8, 0.14, RAIL);
      }
    }
  }
}

// Build everything for a tile. Returns {group, boxes, trees, lights, foot, junk}.
export function buildTile(t) {
  applyArchetypes(t); // normally done when the data arrived (stream.js onData); this is the safety net
  const group = new THREE.Group();
  const add = (geo, mat, shadow, recv = true) => { if (!geo) return; const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = recv; m.matrixAutoUpdate = false; group.add(m); };
  // one buffer per material: grass parkways join the terrain, poles / posts / pylons / silos join the buildings
  // (plain atlas cell), and every text panel shares one material (lit ones flagged per vertex)
  const groundB = new Buf(); buildTerrain(t, groundB);
  const roadB = new Buf(), roadLoB = new Buf(), lotB = new Buf(), walkB = new Buf(), markB = new Buf();
  const bB = new Buf(true), sB = new Buf(), gB = new Buf(), glowB = new Buf(true), namesB = new Buf(true), cropB = new Buf();
  const litB = namesB, solidB = bB;
  // boxes: the old per-prop boxes (not registered; stream.js makes walls from the data). solid: new things that block
  // (utility poles, walls, billboards, silos, towers, sheds, pylons), registered by stream.js with the tile
  const boxes = [], solid = [], foot = [], junk = [], trees = [], wires = [], newK = [], bigBoxes = [], yards = [], dealers = [], posts = [];
  const deckB = new Buf(); buildRoads(t, roadB, roadLoB, walkB, markB, groundB, false, deckB);
  const lightsMapped = [];
  const has = dataPoints(t, junk, lightsMapped, solid, solidB, namesB, trees, posts);
  Object.assign(has, dataLines(t, junk, solid, solidB, lotB));
  buildBuildings(t, bB, boxes, foot, sB, gB, junk, { glowB, litB, namesB, solidB, lotB, newK, bigBoxes, yards, dealers, has, solid, posts });
  const lights = [...lightsMapped, ...streetLights(t, junk, lightsMapped)];
  parkingDetail(t, markB, lights, junk, bigBoxes, dealers);
  streetSigns(t, namesB, solidB, boxes, posts);
  regionPlaces(t, { junk, lights, trees, posts, solid, SB: solidB, NB: namesB, walkB, groundB, lotB, markB });
  powerLines(t, junk, wires, solid);
  crops(t, cropB, yards);
  if (!t.kAdded) { for (const v of newK) t.k.push(v); t.kAdded = true; } // driveway cars join the parked-car spots (once)
  add(cropB.geometry(), M.crop, false);
  add(groundB.geometry(), M.terrain, false);
  add(walkB.geometry(), M.walk, false);
  add(lotB.geometry(), M.lot || M.road, false);
  add(roadLoB.geometry(), M.roadLo || M.road, false);
  add(roadB.geometry(), M.road, false);
  add(markB.geometry(), M.mark, false);
  add(deckB.geometry(), M.lod, true);
  add(bB.geometry(), M.building, true);
  add(sB.geometry(), M.signs, false);
  add(gB.geometry(), M.graffiti, false);
  add(glowB.geometry(), M.glow, false, false);
  add(namesB.geometry(), M.names, false);
  if (wires.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3)); g.computeBoundingSphere(); const w = new THREE.LineSegments(g, M.wire); w.matrixAutoUpdate = false; group.add(w); }
  const rB = new Buf(); buildRail(t, rB); add(rB.geometry(), M.rail, false);
  for (let i = 0; i < t.t.length; i += 4) {
    const x = t.t[i] + t.ox, z = t.t[i + 1] + t.oz;
    trees.push({ x, z, y: terrainHeight(x, z), kind: t.t[i + 2], s: t.t[i + 3] / 10, seed: hash(x * 3.1 + z) });
    boxes.push(makeBox(x, z, 1, 0, 0.22 * t.t[i + 3] / 10, 0.22 * t.t[i + 3] / 10, terrainHeight(x, z) - 1, 6));
  }
  streetProps(t, junk, boxes, has);
  validatePlacements(t, junk, lights); // the last word: nothing on a carriageway, in a junction or inside a building
  for (const l of lights) boxes.push(makeBox(l.x, l.z, 1, 0, 0.12, 0.12, l.y - 0.5, 8));
  return { group, boxes, solid, trees, lights, foot, junk, posts };
}

// ---------- far LOD: what a tile looks like past the full-detail radius (stream.js swaps it for buildTile up close) ----------
// Coarser ground, the road surfaces and sidewalks (no paint), and every building as one plain extruded shell (gabled when
// its archetype has a pitched roof) in one vertex-coloured mesh: about five draw calls a tile. No props, signs or lights.
const LOD_WALL = { brick: 0xa8705c, brick2: 0x9a5a48, brick3: 0xb58a6e, stone: 0xcdbf9f, siding: 0xd8d4c8, glass: 0x7d97ab, office: 0x8a9aa6, stucco: 0xd9cfbd, metal: 0xa9adb0, store: 0xb59a80, church: 0xb9ab95, ramp: 0x9d9a93, garage: 0xd0ccc0, plain: 0xc8c2b6 };
export function buildTileLite(t) {
  applyArchetypes(t);
  const group = new THREE.Group();
  const add = (geo, mat, shadow) => { if (!geo) return; const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; m.matrixAutoUpdate = false; group.add(m); };
  const groundB = new Buf(), roadB = new Buf(), roadLoB = new Buf(), walkB = new Buf(), bB = new Buf();
  buildTerrain(t, groundB, 8);
  const deckB = new Buf(); buildRoads(t, roadB, roadLoB, walkB, null, groundB, true, deckB);
  const foot = [], trees = [], FLAT = lin(0x9a9893);
  t.b.forEach((rec, bi) => {
    const [rel, baseY, hgt, pitched, style] = rec, a = rec.arch || {}, n = rel.length / 2; if (n < 3 || a.canopy) return;
    const pts = new Float32Array(rel.length); for (let i = 0; i < rel.length; i++) pts[i] = rel[i] + (i % 2 ? t.oz : t.ox);
    foot.push(pts);
    const seed = t.tx * 7919 + t.tz * 104729 + bi * 31, HS = HOUSE[a.style];
    const cell = HS ? (hash(seed + 13) < (STYLE_LOOK[a.style]?.[1] ?? 0) ? 'brick' : 'siding') : a.style === 'barn' ? 'brick2' : STYLE_CELL[style] || 'plain';
    let wc = lin(LOD_WALL[cell] ?? 0xc8c2b6);
    if (HS && cell === 'siding') wc = lin(pick(STYLE_LOOK[a.style][0], seed + 3));
    const tc = tagCol(a.col); if (tc != null) wc = lin(tc);
    const sloped = pitched && a.style !== 'shed_big' && a.style !== 'bin' && !(a.roofTag && /flat/.test(a.roofTag));
    const top = baseY + hgt, yb = baseY - 1;
    let cx = 0, cz = 0; for (let i = 0; i < n; i++) { cx += pts[i * 2]; cz += pts[i * 2 + 1]; } cx /= n; cz /= n;
    for (let i = 0; i < n; i++) {
      const x0 = pts[i * 2], z0 = pts[i * 2 + 1], x1 = pts[((i + 1) % n) * 2], z1 = pts[((i + 1) % n) * 2 + 1], L = Math.hypot(x1 - x0, z1 - z0); if (L < 0.05) continue;
      let ox = (z1 - z0) / L, oz = -(x1 - x0) / L; if (pointInPoly((x0 + x1) / 2 + ox * 0.3, (z0 + z1) / 2 + oz * 0.3, pts)) { ox = -ox; oz = -oz; }
      face(bB, [[x0, yb, z0], [x1, yb, z1], [x1, top, z1], [x0, top, z0]], [ox, 0, oz], wc, PLAIN, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    }
    if (sloped) { // a gable over the footprint's oriented box, like the detailed roof
      let lb = 0, ux = 1, uz = 0; for (let i = 0; i < n; i++) { const dx = pts[((i + 1) % n) * 2] - pts[i * 2], dz = pts[((i + 1) % n) * 2 + 1] - pts[i * 2 + 1], l = Math.hypot(dx, dz); if (l > lb) { lb = l; ux = dx / l; uz = dz / l; } }
      const vx = -uz, vz = ux; let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      for (let i = 0; i < n; i++) { const pu = (pts[i * 2] - cx) * ux + (pts[i * 2 + 1] - cz) * uz, pv = (pts[i * 2] - cx) * vx + (pts[i * 2 + 1] - cz) * vz; u0 = Math.min(u0, pu); u1 = Math.max(u1, pu); v0 = Math.min(v0, pv); v1 = Math.max(v1, pv); }
      const rise = Math.max(0.8, Math.min(5, (v1 - v0) / 2 * (HS ? HS.pitch : 0.5))), W = (pu, pv, y) => [cx + ux * pu + vx * pv, y, cz + uz * pu + vz * pv], vm = (v0 + v1) / 2;
      const rc = lin(tagCol(a.roofCol) ?? (STYLE_LOOK[a.style] ? pick(STYLE_LOOK[a.style][2], seed + 8) : 0x5d5a52));
      for (const [va, sgn] of [[v0, -1], [v1, 1]]) { const sl = Math.hypot(vm - va, rise); face(bB, [W(u0, va, top), W(u1, va, top), W(u1, vm, top + rise), W(u0, vm, top + rise)], [vx * sgn * rise / sl, Math.abs(vm - va) / sl, vz * sgn * rise / sl], rc, PLAIN, [[0, 0], [1, 0], [1, 1], [0, 1]]); }
      for (const ue of [u0, u1]) tri(bB, W(ue, v0, top), W(ue, v1, top), W(ue, vm, top + rise), wc, PLAIN, [[0, 0], [1, 0], [0.5, 1]], [cx, top, cz]);
    } else {
      const contour = []; for (let i = 0; i < n; i++) contour.push(new THREE.Vector2(pts[i * 2], pts[i * 2 + 1]));
      const idx = contour.map((p) => bB.v(p.x, top, p.y, 0, 1, 0, ...FLAT, 0, 0));
      for (const [ia, ib, ic] of THREE.ShapeUtils.triangulateShape(contour, [])) { const pa = contour[ia], pb = contour[ib], pc = contour[ic], cr = (pb.x - pa.x) * (pc.y - pa.y) - (pb.y - pa.y) * (pc.x - pa.x); if (cr < 0) bB.i.push(idx[ia], idx[ib], idx[ic]); else bB.i.push(idx[ia], idx[ic], idx[ib]); }
    }
  });
  for (let i = 0; i < t.t.length; i += 4) { const x = t.t[i] + t.ox, z = t.t[i + 1] + t.oz; trees.push({ x, z, y: terrainHeight(x, z), kind: t.t[i + 2], s: t.t[i + 3] / 10, seed: hash(x * 3.1 + z) }); }
  add(groundB.geometry(), M.terrain, false);
  add(walkB.geometry(), M.walk, false);
  add(roadLoB.geometry(), M.roadLo || M.road, false);
  add(roadB.geometry(), M.road, false);
  add(bB.geometry(), M.lod, true);
  add(deckB.geometry(), M.lod, true);
  return { group, boxes: [], solid: [], trees, lights: [], foot, junk: [], posts: [], lite: true };
}
