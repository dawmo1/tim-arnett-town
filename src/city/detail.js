// Street and area detail placed from data, the same way in every town (see docs/references.md):
// - OSM points (lamps, hydrants, benches, bins, post boxes, bus stops, flagpoles, stop signs, crossings, billboards,
//   playgrounds, level crossings, silos/tanks, water towers, chimneys) where mapped; per kind, a tile with mapped ones
//   gets no made-up ones
// - street-name blades (real names) and stop signs at junctions
// - utility poles and wires: OSM power lines where mapped, else local practice (down the alleys in the pre-war grid,
//   one side of the street elsewhere, buried in post-1975 subdivisions and downtowns)
// - OSM fences / walls / hedges (never across a carriageway), driveways, parking aisles, drive-throughs, farm tracks, tree rows
// - parking-lot striping, lot lights, cart corrals, dealership rows; crop rows on farmland fields
import { TILE, C, G, tiles, terrainHeight, pointOnEdge, nearestEdge, townAt, edgesNear, closestOnEdge } from './data.js';
import { makeBox } from './collide.js';
import { face, obox, panel, lin, hash, PLAIN } from './geom.js';
import { nameUV } from './names.js';
import { regionsIn } from '../regions/index.js';
import { edgeArea, tileStats, pointsOf, linesOf, areasOf, inPoly, longAxis, isFarmClass, coreAt } from './areas.js';
import { nodeRadius, junction } from './tile.js';

const inTile = (t, x, z) => x >= t.ox && x < t.ox + TILE && z >= t.oz && z < t.oz + TILE;
const RANK = { motor: 7, trunk: 6, primary: 5, secondary: 4, tertiary: 3, minor: 2, residential: 1, service: 0, track: 0 };
const POST = lin(0x7b8084), PL = PLAIN; // solid parts go in the tile's building buffer, plain atlas cell
// heading that turns a prop's front (+z) toward the nearest road
function faceRoad(x, z, r = 30) { const q = nearestEdge(x, z, r); return q ? { h: Math.atan2(q.x - x, q.z - z), q } : { h: hash(x + z) * 6.28, q: null }; }
function nodesIn(t) {
  if (t.nodes) return t.nodes;
  const out = new Set(), N = G.nodes;
  for (const id of t.e) { const e = G.edges[id]; if (e) for (const k of [e.a, e.b]) if (inTile(t, N.x[k], N.z[k])) out.add(k); }
  return (t.nodes = [...out]);
}
const sub = (q) => q && [q[0] + (q[2] - q[0]) * 0.375, q[1], q[0] + (q[2] - q[0]) * 0.625, q[3]]; // the square middle of a slot

// ---------- placement: nothing on a carriageway, in a junction or inside a building ----------
const pipA = (x, z, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > z) !== (P[j][1] > z) && x < ((P[j][0] - P[i][0]) * (z - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };
// What a thing of radius r at (x, z) stands on: {e, q} a road (carriageway + r), {k, J} a junction polygon, or null.
// Bridge decks well above the ground don't count (you can stand under them); tunnels don't either.
export function roadHit(x, z, r = 0.4) {
  let best = null;
  const near = edgesNear(x, z, 20);
  for (const id of near) {
    const e = G.edges[id]; if (!e || (e.flags & 1)) continue;
    const q = closestOnEdge(e, x, z); if (q.d >= e.width / 2 + r) continue;
    if (e.bridge && q.y - terrainHeight(x, z) > 3) continue;
    if (!best || q.d - e.width / 2 < best.q.d - best.e.width / 2) best = { e, q };
  }
  if (best) return best;
  for (const id of near) {
    const e = G.edges[id]; if (!e) continue;
    for (const k of [e.a, e.b]) { const J = junction(k); if (J && Math.hypot(G.nodes.x[k] - x, G.nodes.z[k] - z) < J.r * 1.5 + r && pipA(x, z, J.poly)) return { k, J }; }
  }
  return null;
}
// tile footprints in world metres (cached per tile), for "is this spot inside a building"
function footsOf(t) {
  if (t._fpw) return t._fpw;
  return (t._fpw = t.b.filter((rec) => !rec.arch?.canopy).map((rec) => { const rel = rec[0], p = new Float32Array(rel.length); let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity; for (let i = 0; i < rel.length; i += 2) { p[i] = rel[i] + t.ox; p[i + 1] = rel[i + 1] + t.oz; a = Math.min(a, p[i]); b = Math.max(b, p[i]); c = Math.min(c, p[i + 1]); d = Math.max(d, p[i + 1]); } return { p, a, b, c, d }; }));
}
export function inBuilding(x, z, r = 0) {
  const tx = Math.floor(x / TILE), tz = Math.floor(z / TILE);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const t = tiles.get(`${tx + dx}_${tz + dz}`); if (!t) continue;
    for (const f of footsOf(t)) if (x > f.a - r && x < f.b + r && z > f.c - r && z < f.d + r && (inPoly(x, z, f.p) || (r > 0 && (inPoly(x + r, z, f.p) || inPoly(x - r, z, f.p) || inPoly(x, z + r, f.p) || inPoly(x, z - r, f.p))))) return true;
  }
  return false;
}
// Where a thing of radius r can stand near (x, z): the spot itself, or pushed sideways to just past the kerb of the road
// it was on (keeping its side; side = 1 / -1 picks one when it's dead on the centre line), or out of the junction
// polygon; null when there's no clear spot (squeezed between roads, or inside a building). opts.drop: never move it.
export function placeOff(x, z, r = 0.4, opts = {}) {
  let moved = false;
  for (let it = 0; it < 4; it++) {
    const hit = roadHit(x, z, r); if (!hit) break;
    if (opts.drop || it === 3) return null;
    moved = true;
    if (hit.J) {
      const cx = G.nodes.x[hit.k], cz = G.nodes.z[hit.k]; let dx = x - cx, dz = z - cz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      let d = l; while (d < 60 && pipA(cx + dx * d, cz + dz * d, hit.J.poly)) d += 0.5;
      x = cx + dx * (d + r + 0.3); z = cz + dz * (d + r + 0.3);
    } else {
      const { e, q } = hit; let nx = x - q.x, nz = z - q.z, l = Math.hypot(nx, nz);
      if (l < 0.05) { const sd = opts.side || 1; nx = Math.cos(q.h) * sd; nz = -Math.sin(q.h) * sd; l = 1; }
      const want = e.width / 2 + r + 0.35; x = q.x + (nx / l) * want; z = q.z + (nz / l) * want;
    }
  }
  if (!opts.noBuilding && inBuilding(x, z, Math.min(r, 0.5))) return null;
  return { x, z, moved };
}
// how big each kind of street / yard prop is (its radius for placeOff)
const PROP_R = { busstop: 1.4, bench: 0.8, planter: 0.6, dumpster: 1.1, corral: 1.5, shed: 1.8, swing: 1.8, tramp: 2.1, haybale: 0.8, upole: 0.25, upolet: 0.25, hydrant: 0.3, meter: 0.15, mailbox: 0.3, ruralbox: 0.3, newsbox: 0.35, bin: 0.35, flagpole: 0.2, gnome: 0.2, flowers: 0.5, menuboard: 0.6, featherflag: 0.3, balloons: 0.4, bag: 0.3, swingset: 1.8 };
const ON_BUILDING = new Set(['ac', 'tank', 'fesc', 'banner']); // roof / wall / pole attachments: not on the ground
const LINEAR = new Set(['picket', 'chainlink', 'hedge']); // fence and hedge pieces: dropped, not moved
// The last pass over a built tile: props and lights off the roads and out of buildings (moved to the kerb or dropped),
// parked cars out of junctions, travel lanes and buildings. Returns how many were moved / dropped.
export function validatePlacements(t, junk, lights) {
  let moved = 0, dropped = 0;
  const fix = (o, r, opts) => { const p = placeOff(o.x, o.z, r, opts); if (!p) { dropped++; return false; } if (p.moved) { o.x = p.x; o.z = p.z; o.y = terrainHeight(p.x, p.z); moved++; } return true; };
  for (let i = junk.length - 1; i >= 0; i--) { const j = junk[i]; if (ON_BUILDING.has(j.kind) || j.placed) continue; if (!fix(j, PROP_R[j.kind] ?? 0.4, { drop: LINEAR.has(j.kind) || j.kind === 'bag' })) junk.splice(i, 1); }
  for (let i = lights.length - 1; i >= 0; i--) { const l = lights[i]; if (l.placed) continue; if (!fix(l, 0.2, {})) lights.splice(i, 1); }
  if (!t.kChecked) {
    t.kChecked = true;
    const k = t.k, out = [];
    for (let i = 0; i < k.length; i += 4) {
      const x = k[i] + t.ox, z = k[i + 1] + t.oz, lot = k[i + 3];
      let ok;
      if (lot) ok = !roadHit(x, z, 1.1) && !inBuilding(x, z, 0.8);
      else { // kerb parking sits in its own street's parking lane: only travel lanes, junctions and buildings are out
        const h = roadHit(x, z, 2.5); ok = !(h && h.J);
        if (ok) for (const id of edgesNear(x, z, 20)) { const e = G.edges[id]; if (!e || (e.flags & 1)) continue; const q = closestOnEdge(e, x, z); if (q.d < e.width / 2 - 1.6 && !(e.bridge && q.y - terrainHeight(x, z) > 3)) { ok = false; break; } }
        ok = ok && !inBuilding(x, z, 0.5);
      }
      if (ok) out.push(k[i], k[i + 1], k[i + 2], k[i + 3]); else dropped++;
    }
    t.k = out;
  }
  return { moved, dropped };
}

// ---------- mapped point features ----------
// returns which kinds the data covered in this tile, so the made-up street furniture skips them
export function dataPoints(t, junk, lights, boxes, SB, NB, trees, posts) {
  const has = new Set();
  const put = (kind, p, extra = {}) => { const o = placeOff(p.x, p.z, PROP_R[kind] ?? 0.4); if (!o) return null; const y = terrainHeight(o.x, o.z); const j = { kind, x: o.x, z: o.z, y, h: faceRoad(o.x, o.z).h, placed: true, ...extra }; junk.push(j); return j; };
  const KIND = { hy: 'hydrant', bn: 'bench', wb: 'bin', pb: 'mailbox', fp: 'flagpole', vm: 'newsbox' };
  for (const [key, kind] of Object.entries(KIND)) for (const p of pointsOf(t, key)) { put(kind, p); has.add(kind); }
  for (const p of pointsOf(t, 'bs')) {
    const { h, q } = faceRoad(p.x, p.z, 25), j = put('busstop', p, { busStop: true }); has.add('busstop'); if (!j) continue; void h;
    boxes.push(makeBox(j.x - Math.sin(h) * 0.6, j.z - Math.cos(h) * 0.6, Math.cos(h), -Math.sin(h), 1.6, 0.1, j.y, 2.5)); void q;
  }
  for (const p0 of pointsOf(t, 'lm')) { has.add('light'); const p = placeOff(p0.x, p0.z, 0.2); if (!p) continue; const { h } = faceRoad(p.x, p.z, 25); lights.push({ x: p.x, z: p.z, y: terrainHeight(p.x, p.z), h, mapped: true, placed: true }); }
  for (const p of pointsOf(t, 'pl')) { put('swing', p, { h: hash(p.x) * 6.28 }); }
  // billboards: two steel legs and a 14.6 x 3.1 m face toward the road, with a local ad
  for (const p0 of pointsOf(t, 'bb')) {
    const p = placeOff(p0.x, p0.z, 1.5); if (!p) continue; posts?.push({ kind: 'billboard', x: p.x, z: p.z });
    const { h } = faceRoad(p.x, p.z, 80), y = terrainHeight(p.x, p.z), nx = Math.sin(h), nz = Math.cos(h), ux = nz, uz = -nx;
    for (const s of [-3.5, 3.5]) obox(SB, p.x + ux * s, p.z + uz * s, nx, nz, 0.25, 0.25, y - 0.3, y + 7, lin(0x6d7175), PL);
    obox(SB, p.x - nx * 0.25, p.z - nz * 0.25, ux, uz, 7.5, 0.2, y + 6.6, y + 10.2, lin(0x55595d), PL);
    const ads = ['TIM ARNETT INJURY LAW', 'ARNETT ARMS - GUNS', "TIM'S THREADS", 'VISIT LE CLAIRE', 'QUAD CITY BANK', 'BIG MUDDY BBQ', 'RIVER CITY PAWN', 'STEAMBOAT DAYS'];
    panel(NB, p.x + nx * 0.02, y + 8.4, p.z + nz * 0.02, nx, nz, 14.6, 3.13, nameUV('pole', ads[Math.floor(hash(p.x * 3 + p.z) * ads.length)], t.key), null, false, 1);
    boxes.push(makeBox(p.x, p.z, nx, nz, 0.3, 3.8, y - 0.5, 7));
  }
  // railroad crossbucks at level crossings
  for (const p0 of pointsOf(t, 'lc')) { // the mapped node is where the track crosses the road: the post goes on the verge
    const p = placeOff(p0.x, p0.z, 0.3); if (!p) continue; posts?.push({ kind: 'crossbuck', x: p.x, z: p.z });
    const { h } = faceRoad(p.x, p.z, 20), y = terrainHeight(p.x, p.z), xb = nameUV('xbuck', 'RAILROAD CROSSING', t.key);
    obox(SB, p.x, p.z, 1, 0, 0.05, 0.05, y - 0.2, y + 3.4, lin(0xe8e8e8), PL);
    if (xb) { const nx = Math.sin(h), nz = Math.cos(h); panel(NB, p.x + nx * 0.06, y + 3.0, p.z + nz * 0.06, nx, nz, 1.6, 0.34, xb); }
  }
  // silos / storage tanks, water towers (with the town's name), chimneys and masts
  for (const p of pointsOf(t, 'sl')) { if (roadHit(p.x, p.z, (p.v || 14) >= 10 ? 2.8 : 5)) continue; const y = terrainHeight(p.x, p.z), hh = p.v || 14, r = hh >= 10 ? 2.8 : 5; lathe(SB, p.x, y, p.z, [[r, -0.5], [r, hh], [r * 0.7, hh + r * 0.35], [0.01, hh + r * 0.55]], lin(hh >= 10 ? 0xcfcabd : 0xd9dbdc)); boxes.push(makeBox(p.x, p.z, 1, 0, r, r, y - 1, hh)); }
  for (const p of pointsOf(t, 'wt')) if (!roadHit(p.x, p.z, 1.8)) waterTower(t, SB, NB, boxes, p.x, p.z, p.v || 38, (townAt?.(p.x, p.z)?.name || t.st?.town?.name || ''));
  for (const p of pointsOf(t, 'ch')) { if (roadHit(p.x, p.z, 1.4)) continue; const y = terrainHeight(p.x, p.z), hh = p.v || 30; lathe(SB, p.x, y, p.z, [[1.4, -0.5], [0.8, hh], [0.01, hh]], lin(hh > 60 ? 0xc8442f : 0x8a4a3a), 8); boxes.push(makeBox(p.x, p.z, 1, 0, 1.2, 1.2, y - 1, hh)); }
  // OSM tree rows (windbreaks along farm fields, rows along drives)
  for (const l of linesOf(t, 'tr')) walk(l, 7, (x, z) => { if (inTile(t, x, z) && !roadHit(x, z, 0.5)) trees.push({ x, z, y: terrainHeight(x, z), kind: hash(x * 1.3 + z) < 0.35 ? 1 : 0, s: 0.85 + hash(x + z * 3) * 0.4, seed: hash(x * 3.1 + z) }); });
  return has;
}
// a water tower (tank on a pedestal) with the town's name round the tank
function waterTower(t, SB, NB, boxes, x, z, hh, text, col = 0xe9eef0) {
  const y = terrainHeight(x, z), tr = Math.max(6, hh * 0.22), ty = hh - tr * 1.2;
  lathe(SB, x, y, z, [[1.6, -0.5], [1.6, ty - tr * 0.4], [tr * 0.55, ty], [tr, ty + tr * 0.55], [tr * 0.95, ty + tr * 0.9], [tr * 0.5, ty + tr * 1.15], [0.01, ty + tr * 1.2]], lin(col), 18);
  const uv = text && nameUV('tower', text.toUpperCase(), t.key);
  if (uv) for (const a of [0.6, 0.6 + Math.PI]) { const nx = Math.sin(a), nz = Math.cos(a); panel(NB, x + nx * (tr + 0.05), y + ty + tr * 0.6, z + nz * (tr + 0.05), nx, nz, tr * 1.3, tr * 1.3 / 4, uv, null); }
  boxes.push(makeBox(x, z, 1, 0, 1.8, 1.8, y - 1, ty));
}
// a surface of revolution (silos, water towers) straight into a vertex buffer
function lathe(B, x, y, z, prof, tint, seg = 14) {
  for (let i = 0; i + 1 < prof.length; i++) {
    const [r0, y0] = prof[i], [r1, y1] = prof[i + 1], dr = r1 - r0, dy = y1 - y0, l = Math.hypot(dr, dy) || 1, ny = -dr / l, nr = dy / l;
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const P = [[x + c0 * r0, y + y0, z + s0 * r0], [x + c1 * r0, y + y0, z + s1 * r0], [x + c1 * r1, y + y1, z + s1 * r1], [x + c0 * r1, y + y1, z + s0 * r1]];
      const cm = Math.cos((a0 + a1) / 2), sm = Math.sin((a0 + a1) / 2);
      face(B, P, [cm * nr, ny, sm * nr], tint, PL, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    }
  }
}
// call fn(x, z, heading) every `step` metres along a polyline
function walk(l, step, fn, start = step / 2) {
  let carry = start;
  for (let i = 2; i < l.length; i += 2) {
    const ax = l[i - 2], az = l[i - 1], bx = l[i], bz = l[i + 1], L = Math.hypot(bx - ax, bz - az), h = Math.atan2(bx - ax, bz - az);
    for (let s = carry; s < L; s += step) fn(ax + (bx - ax) * (s / L), az + (bz - az) * (s / L), h);
    carry = ((carry - L) % step + step) % step;
  }
}

// ---------- street-name blades and stop signs ----------
export function streetSigns(t, NB, SB, boxes, posts) {
  const N = G.nodes, stops = pointsOf(t, 'st');
  const stopUV = nameUV('stop', 'STOP', t.key), backUV = nameUV('stopback', 'BACK', t.key);
  const stopSign = (e, fromA, r) => {
    const p = pointOnEdge(e, fromA ? Math.min(e.len * 0.5, r + 1.8) : Math.max(e.len * 0.5, e.len - r - 1.8));
    const q = pointOnEdge(e, fromA ? Math.min(e.len, r + 4) : Math.max(0, e.len - r - 4));
    let tx = p.x - q.x, tz = p.z - q.z; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl; // incoming travel direction
    const o = e.width / 2 + 0.9, sp = placeOff(p.x - tz * o, p.z + tx * o, 0.15, { side: 1 }); if (!sp) return;
    const sx = sp.x, sz = sp.z;
    if (!inTile(t, sx, sz)) return;
    const y = terrainHeight(sx, sz); posts?.push({ kind: 'stopsign', x: sx, z: sz });
    obox(SB, sx, sz, 1, 0, 0.035, 0.035, y - 0.2, y + 2.3, POST, PL);
    panel(NB, sx - tx * 0.05, y + 2.25, sz - tz * 0.05, -tx, -tz, 0.76, 0.76, sub(stopUV), sub(backUV)); // signs break, so no wall
  };
  for (const k of nodesIn(t)) {
    const adj = G.adj[k].filter((id) => G.edges[id]); if (adj.length < 3 || adj.some((id) => G.edges[id].bridge)) continue;
    const x = N.x[k], z = N.z[k], r = nodeRadius(k);
    const dirOf = (e) => { const fromA = e.a === k, p = pointOnEdge(e, fromA ? Math.min(e.len, r + 6) : Math.max(0, e.len - r - 6)), l = Math.hypot(p.x - x, p.z - z) || 1; return [(p.x - x) / l, (p.z - z) / l]; };
    const named = adj.map((id) => G.edges[id]).filter((e) => e.name && e.cls !== 'motor' && e.cls !== 'service' && e.cls !== 'track');
    const names = [...new Set(named.map((e) => e.name))];
    if (names.length >= 2) {
      const e0 = named.find((e) => e.name === names[0]), e1 = named.find((e) => e.name === names[1]);
      const d0 = dirOf(e0), d1 = dirOf(e1);
      let bx = d0[0] + d1[0], bz = d0[1] + d1[1]; const bl = Math.hypot(bx, bz);
      if (bl < 0.2) { bx = -d0[1]; bz = d0[0]; } else { bx /= bl; bz /= bl; }
      const off = Math.max(e0.width, e1.width) / 2 + 2.8, bp = placeOff(x + bx * off, z + bz * off, 0.15);
      if (bp) {
        const px = bp.x, pz = bp.z, y = terrainHeight(px, pz); posts?.push({ kind: 'streetblade', x: px, z: pz });
        obox(SB, px, pz, 1, 0, 0.035, 0.035, y - 0.2, y + 3.3, POST, PL);
        // each blade runs along its own street, readable from both sides
        panel(NB, px, y + 3.12, pz, -d0[1], d0[0], 1.4, 0.3, nameUV('street', e0.name, t.key));
        panel(NB, px, y + 2.8, pz, -d1[1], d1[0], 1.4, 0.3, nameUV('street', e1.name, t.key));
      }
    }
    // stop signs from the junction's control (mapped stop signs nearby are drawn from the points instead)
    if (N.ctrl[k] !== 2 || stops.some((s) => Math.hypot(s.x - x, s.z - z) < 30)) continue;
    const top = Math.max(...adj.map((id) => RANK[G.edges[id].cls] ?? 1)), allWay = adj.every((id) => (RANK[G.edges[id].cls] ?? 1) === top);
    for (const id of adj) {
      const e = G.edges[id], fromA = e.a === k;
      if (!(fromA ? e.lb > 0 : e.lf > 0) || e.cls === 'motor' || e.cls === 'service' || e.cls === 'track') continue;
      if (!allWay && (RANK[e.cls] ?? 1) === top) continue;
      stopSign(e, fromA, r);
    }
  }
  // mapped stop signs: face the traffic arriving at the nearer junction of the street they're on
  for (const s of stops) {
    const q = nearestEdge(s.x, s.z, 25); if (!q) continue;
    const e = q.e, toB = q.s > e.len / 2, k = toB ? e.b : e.a;
    stopSign(e, !toB, G.adj[k].length >= 3 ? nodeRadius(k) : 2);
  }
}

// ---------- utility poles and wires ----------
const WIRE_X = [-1.05, 0, 1.05], WIRE_Y = [10.02, 10.72, 10.02];
function wireSpan(W, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz); if (L < 3 || L > 140) return;
  const sag = Math.min(1.4, L * 0.012);
  for (let w = 0; w < 3; w++) {
    const ax = a.x + Math.cos(a.h) * WIRE_X[w], az = a.z - Math.sin(a.h) * WIRE_X[w], bx = b.x + Math.cos(b.h) * WIRE_X[w], bz = b.z - Math.sin(b.h) * WIRE_X[w];
    const ay = a.y + WIRE_Y[w], by = b.y + WIRE_Y[w];
    let px = ax, py = ay, pz = az;
    for (let s = 1; s <= 5; s++) { const f = s / 5, nx = ax + (bx - ax) * f, nz = az + (bz - az) * f, ny = ay + (by - ay) * f - sag * 4 * f * (1 - f); W.push(px, py, pz, nx, ny, nz); px = nx; py = ny; pz = nz; }
  }
}
export function powerLines(t, junk, W, boxes) {
  let n = 0;
  const put = (x0, z0, h) => {
    const p = inTile(t, x0, z0) ? placeOff(x0, z0, 0.25) : null, x = p ? p.x : x0, z = p ? p.z : z0; // off the road (wires follow it)
    const y = terrainHeight(x, z), j = { kind: n++ % 4 === 2 ? 'upolet' : 'upole', x, z, y, h, placed: true };
    if (p && inTile(t, x, z)) { junk.push(j); boxes.push(makeBox(x, z, 1, 0, 0.18, 0.18, y - 0.5, 11)); }
    return j;
  };
  const mapped = [...linesOf(t, 'ps'), ...linesOf(t, 'pw')];
  const poles = pointsOf(t, 'pp');
  if (mapped.length || poles.length) {
    // mapped minor lines run pole to pole; a pole at every vertex (lines come clipped to the tile, so wires meet at the edge)
    for (const P of mapped) {
      const m = P.length / 2; let prev = null;
      for (let i = 0; i < m; i++) {
        const j0 = Math.max(0, i - 1), j1 = Math.min(m - 1, i + 1), h = Math.atan2(P[j1 * 2] - P[j0 * 2], P[j1 * 2 + 1] - P[j0 * 2 + 1]);
        const x = P[i * 2], z = P[i * 2 + 1], edge = !inTile(t, x - 0.01, z - 0.01) || x - t.ox < 0.2 || z - t.oz < 0.2 || t.ox + TILE - x < 0.2 || t.oz + TILE - z < 0.2;
        const pole = edge ? { x, z, y: terrainHeight(x, z), h } : put(x, z, h);
        if (prev) wireSpan(W, prev, pole);
        prev = pole;
      }
    }
    if (!mapped.length) for (const p of poles) put(p.x, p.z, faceRoad(p.x, p.z).h + Math.PI / 2);
    return;
  }
  // not mapped here: follow the local practice
  const alleys = linesOf(t, 'al');
  const useAlleys = alleys.length >= 1;
  for (const P of alleys) { let prev = null; walk(P, 40, (x, z, h) => { const x2 = x + Math.cos(h) * 2.3, z2 = z - Math.sin(h) * 2.3, pole = put(x2, z2, h); if (prev) wireSpan(W, prev, pole); prev = pole; }, 6); }
  for (const id of t.e) {
    const e = G.edges[id]; if (!e) continue;
    const a = edgeArea(e, t);
    if (e.bridge || e.cls === 'motor' || e.cls === 'trunk' || e.cls === 'service' || e.cls === 'track' || a === 'core' || a === 'suburb' || e.len < 30) continue;
    if (useAlleys && a === 'res' && e.cls === 'residential') continue; // lines run down the alleys instead
    const gap = a === 'rural' ? 68 : 40, side = hash(id * 1.7) < 0.5 ? 1 : -1, off = e.width / 2 + (a === 'rural' ? 5 : 2.9);
    let prev = null;
    for (let s = 6 + hash(id) * 10; s < e.len - 4; s += gap) {
      const p = pointOnEdge(e, s), x = p.x + Math.cos(p.h) * off * side, z = p.z - Math.sin(p.h) * off * side;
      const pole = put(x, z, p.h);
      if (prev && inTile(t, prev.x, prev.z)) wireSpan(W, prev, pole);
      prev = pole;
    }
  }
}

// ---------- OSM barriers, driveways, aisles, drive-throughs, farm tracks ----------
// returns true when the tile has mapped fences / driveways (the made-up front-yard ones are skipped)
export function dataLines(t, junk, boxes, SB, roadB) {
  const has = { fence: false, drive: false };
  const res = tileStats(t).dens > 0.04;
  for (const P of linesOf(t, 'fe')) { has.fence = true; walk(P, res ? 2.4 : 3, (x, z, h) => { if (inTile(t, x, z)) junk.push({ kind: res ? 'picket' : 'chainlink', x, z, y: terrainHeight(x, z), h: h + Math.PI / 2 }); }); }
  for (const P of linesOf(t, 'he')) { has.fence = true; walk(P, 2, (x, z, h) => { if (inTile(t, x, z)) junk.push({ kind: 'hedge', x, z, y: terrainHeight(x, z), h: h + Math.PI / 2 }); }); }
  for (const key of ['wa', 'rw']) for (const P of linesOf(t, key)) {
    const tint = lin(key === 'rw' ? 0xb7ad99 : 0x9a5444), hgt = key === 'rw' ? 1.0 : 1.4;
    for (let i = 2; i < P.length; i += 2) {
      const ax0 = P[i - 2], az0 = P[i - 1], bx0 = P[i], bz0 = P[i + 1], L0 = Math.hypot(bx0 - ax0, bz0 - az0); if (L0 < 0.3) continue;
      const n = Math.ceil(L0 / 6); // in pieces of up to 6 m, so the bit of a wall that crosses a road can go
      for (let q = 0; q < n; q++) {
        const ax = ax0 + (bx0 - ax0) * q / n, az = az0 + (bz0 - az0) * q / n, bx = ax0 + (bx0 - ax0) * (q + 1) / n, bz = az0 + (bz0 - az0) * (q + 1) / n, L = L0 / n;
        const ux = (bx - ax) / L, uz = (bz - az) / L, mx = (ax + bx) / 2, mz = (az + bz) / 2, y = Math.min(terrainHeight(ax, az), terrainHeight(bx, bz));
        if (roadHit(mx, mz, 0.2)) continue; // OSM walls drawn across a carriageway (a gate line, a mis-snapped way)
        obox(SB, mx, mz, ux, uz, L / 2, 0.15, y - 0.4, y + hgt, tint, PL);
        boxes.push(makeBox(mx, mz, -uz, ux, 0.2, L / 2, y - 0.4, hgt + 0.4));
      }
    }
  }
  // paved strips that aren't in the road graph
  const STRIP = { dw: [3.0, 0x9a9890], pa: [6.0, 0x5d6064], dt: [3.6, 0x55585c], tk: [3.2, 0x9b8e74], sv: [4.6, 0x66686a] }; // sv: service roads cut off from the graph
  for (const [key, [w, hex]] of Object.entries(STRIP)) for (const P of linesOf(t, key)) {
    if (key === 'dw') has.drive = true;
    const c = lin(hex);
    for (let i = 2; i < P.length; i += 2) {
      const ax = P[i - 2], az = P[i - 1], bx = P[i], bz = P[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.2) continue;
      const nx = (-(bz - az) / L) * w / 2, nz = ((bx - ax) / L) * w / 2, n = Math.ceil(L / 4);
      for (let k = 0; k < n; k++) {
        const f0 = k / n, f1 = (k + 1) / n, x0 = ax + (bx - ax) * f0, z0 = az + (bz - az) * f0, x1 = ax + (bx - ax) * f1, z1 = az + (bz - az) * f1;
        const Q = (x, z) => [x, terrainHeight(x, z) + 0.05, z];
        face(roadB, [Q(x0 + nx, z0 + nz), Q(x0 - nx, z0 - nz), Q(x1 - nx, z1 - nz), Q(x1 + nx, z1 + nz)], [0, 1, 0], c, PL, [[x0 / 6, z0 / 6], [x0 / 6, z0 / 6 + 0.5], [x1 / 6, z1 / 6 + 0.5], [x1 / 6, z1 / 6]]);
      }
    }
  }
  return has;
}

// ---------- parking lots: stall stripes, lot lights, cart corrals, dealership rows ----------
export function parkingDetail(t, markB, lights, junk, bigBoxes, dealers) {
  const WHITE = lin(0xe8e6df), cellAt = (i, j) => (i < 0 || j < 0 || i > 49 || j > 49 ? -1 : t.c[j * 50 + i]);
  const flat = (ax, az, bx, bz, w) => {
    if (cellAt(Math.floor(((ax + bx) / 2 - t.ox) / 4), Math.floor(((az + bz) / 2 - t.oz) / 4)) === C.road) return; // no stall paint across a road through the lot
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, px = (-dz / l) * w / 2, pz = (dx / l) * w / 2;
    const y0 = terrainHeight(ax, az) + 0.09, y1 = terrainHeight(bx, bz) + 0.09;
    face(markB, [[ax + px, y0, az + pz], [ax - px, y0, az - pz], [bx - px, y1, bz - pz], [bx + px, y1, bz + pz]], [0, 1, 0], WHITE, PL, [[0, 0], [0, 0], [0, 0], [0, 0]]);
  };
  const lots = areasOf(t, 'pk').map((P) => ({ P, h: longAxis(P) }));
  // OSM lot polygons: double-loaded rows (5.5 m stalls, 7 m aisle) along the lot's long side, stalls 2.7 m wide
  for (const L of lots) {
    const vx = Math.sin(L.h), vz = Math.cos(L.h), ux = vz, uz = -vx; // u along the long side, v across it
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (let i = 0; i < L.P.length; i += 2) { const u = L.P[i] * ux + L.P[i + 1] * uz, v = L.P[i] * vx + L.P[i + 1] * vz; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    if ((u1 - u0) * (v1 - v0) > 250000) continue; // clipped bits of huge lots: skip rather than draw thousands
    const at = (u, v) => [u * ux + v * vx, u * uz + v * vz];
    for (let v = v0 + 0.5; v < v1; v += 18) for (const [va, vb] of [[v, v + 5.5], [v + 12.5, v + 18]]) for (let u = u0 + 1; u < u1; u += 2.7) {
      const [ax, az] = at(u, va), [bx, bz] = at(u, vb);
      if (inPoly(ax, az, L.P) && inPoly(bx, bz, L.P)) flat(ax, az, bx, bz, 0.1);
    }
    // lot lights down the middle of every other aisle, ~30 m apart
    for (let v = v0 + 9; v < v1; v += 36) for (let u = u0 + 15; u < u1 - 5; u += 30) { const [x, z] = at(u, v); if (inPoly(x, z, L.P) && inTile(t, x, z)) lights.push({ x, z, y: terrainHeight(x, z), h: L.h, lot: true }); }
  }
  // tiles without lot polygons: stripe the parking cells around the lot spots the map build laid out
  const spots = [];
  if (!lots.length) for (let i = 0; i < t.k.length; i += 4) if (t.k[i + 3] === 1) spots.push({ x: t.k[i] + t.ox, z: t.k[i + 1] + t.oz, h: t.k[i + 2] });
  const nearest = (x, z) => { let b = null, bd = 45 * 45; for (const s of spots) { const d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < bd) { bd = d; b = s; } } return b; };
  const corralFor = bigBoxes.map(() => 0);
  for (let j = 0; j < 50; j++) for (let i = 0; i < 50; i++) {
    if (cellAt(i, j) !== C.parking) continue;
    const cx = t.ox + i * 4 + 2, cz = t.oz + j * 4 + 2;
    const lot = lots.find((L) => inPoly(cx, cz, L.P)), s = lot ? { x: cx, z: cz, h: lot.h } : nearest(cx, cz);
    if (!lots.length && i % 8 === 4 && j % 8 === 4 && cellAt(i - 2, j) === C.parking && cellAt(i + 2, j) === C.parking && cellAt(i, j - 2) === C.parking && cellAt(i, j + 2) === C.parking) lights.push({ x: cx, z: cz, y: terrainHeight(cx, cz), h: s ? s.h : 0, lot: true });
    if (!s) continue;
    if (!lot) {
      const vx = Math.sin(s.h), vz = Math.cos(s.h), ux = vz, uz = -vx;
      const du = (cx - s.x) * ux + (cz - s.z) * uz, dv = (cx - s.x) * vx + (cz - s.z) * vz;
      for (let r = Math.round((dv - 3) / 7.5); r <= Math.round((dv + 3) / 7.5); r++) for (let k = Math.floor((du - 3) / 2.8); k <= Math.ceil((du + 3) / 2.8); k++) {
        const lu = k * 2.8 + 1.4, lv = r * 7.5, mx = s.x + ux * lu + vx * lv, mz = s.z + uz * lu + vz * lv;
        if (Math.floor((mx - t.ox) / 4) !== i || Math.floor((mz - t.oz) / 4) !== j) continue; // each line belongs to the cell its middle is in
        flat(mx - vx * 2.5, mz - vz * 2.5, mx + vx * 2.5, mz + vz * 2.5, 0.1);
      }
    }
    // a few cart corrals out in front of each big store
    bigBoxes.forEach((bb, bi) => {
      const d = Math.hypot(cx - bb.x, cz - bb.z);
      if (corralFor[bi] < 3 && d > 22 && d < 75 && hash(i * 31 + j * 17 + bi) < 0.05) { corralFor[bi]++; junk.push({ kind: 'corral', x: cx, z: cz, y: terrainHeight(cx, cz), h: s.h }); }
    });
    // car dealerships (buildings with shop=car): rows of real, stealable cars and flags out front
    for (const dl of dealers) {
      if (Math.hypot(cx - dl.x, cz - dl.z) > 70) continue;
      if (!t.dealt && (i + j) % 2 === 0) t.k.push(cx - t.ox, cz - t.oz, s.h, 1);
      if (hash(i * 7 + j * 13) < 0.08) junk.push({ kind: hash(i + j * 3) < 0.4 ? 'balloons' : 'featherflag', x: cx, z: cz, y: terrainHeight(cx, cz), h: s.h });
    }
  }
  t.dealt = true;
}

// ---------- crop rows: each OSM field gets one crop, rows along its long side; elsewhere per quarter section ----------
const CROPS = [0x4d7a2a, 0x46722a, 0x7fae3a, 0x86b23f, 0x9ab25a];
export function crops(t, B, yards) {
  const st = tileStats(t);
  if (st.farm < 0.02 && !st.rural) return;
  const fields = areasOf(t, 'fm').map((P) => ({ P, h: longAxis(P), c: hash(P[0] * 0.13 + P[1] * 0.71) }));
  const S = 51, H = new Float32Array(S * S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) H[j * S + i] = terrainHeight(t.ox + i * 4, t.oz + j * 4) + 0.03;
  for (let j = 0; j < 50; j++) for (let i = 0; i < 50; i++) {
    const c = t.c[j * 50 + i], x = t.ox + i * 4, z = t.oz + j * 4;
    if (!(isFarmClass(c) || (st.rural && c === C.lawn && !fields.length))) continue;
    if (yards.some((y) => (y.x - x - 2) ** 2 + (y.z - z - 2) ** 2 < y.r * y.r)) continue; // farmstead yards stay grass
    const f = fields.find((F) => inPoly(x + 2, z + 2, F.P));
    let h, cr;
    if (f) { h = f.h; cr = f.c; } else { const qx = Math.floor((x + 2) / 402), qz = Math.floor((z + 2) / 402); h = hash(qx * 17 + qz * 3) < 0.5 ? 0 : Math.PI / 2; cr = hash(qx * 131 + qz * 977); }
    const ax = Math.cos(h), az = -Math.sin(h); // across the rows
    const cc = lin(CROPS[Math.floor(cr * CROPS.length)]), shade = 0.92 + hash(x * 0.37 + z * 1.13) * 0.1, tint = [cc[0] * shade, cc[1] * shade, cc[2] * shade];
    const k = j * S + i, corner = [[x, z, k], [x, z + 4, k + S], [x + 4, z + 4, k + S + 1], [x + 4, z, k + 1]];
    const id = corner.map(([px, pz, kk]) => B.v(px, H[kk], pz, 0, 1, 0, ...tint, (px * ax + pz * az) / 0.76, (px * az - pz * ax) / 4));
    B.quad(id[0], id[1], id[2], id[3]);
  }
}
export { coreAt };

// ---------- town modules' places (src/regions/<id>.js; README there lists the kinds) ----------
// Point places go through placeOff like every other prop (moved off a carriageway, dropped inside a building), except the
// street features that belong on the road (roundabout islands, medians, parking surfaces). Unknown kinds warn once.
const warned = new Set();
export function regionPlaces(t, X) {
  const regs = regionsIn(t.ox, t.oz, t.ox + TILE, t.oz + TILE); if (!regs.length) return;
  const { junk, lights, trees, posts, solid, SB, NB, groundB, lotB, markB } = X;
  const CONC = lin(0xbdb8ae), GRASS = lin(0x80a359);
  for (const reg of regs) for (const p of reg.places) {
    const P = p.pts, px = P ? P[0] : p.x, pz = P ? P[1] : p.z;
    if (!inTile(t, px, pz)) continue; // each place is drawn by the tile its (first) point is in
    const h = p.h ?? faceRoad(px, pz).h + Math.PI, at = (r, o = {}) => placeOff(px, pz, r, o);
    switch (p.kind) {
      case 'prop': { const q = at(PROP_R[p.prop] ?? 0.4); if (q) junk.push({ kind: p.prop, x: q.x, z: q.z, y: terrainHeight(q.x, q.z), h, s: p.scale || 1, placed: true }); break; }
      case 'tree': { const q = at(0.5); if (q) trees.push({ x: q.x, z: q.z, y: terrainHeight(q.x, q.z), kind: p.tree ?? 0, s: p.scale || 1, seed: hash(q.x * 3.1 + q.z) }); break; }
      case 'light': { const q = at(0.2); if (q) lights.push({ x: q.x, z: q.z, y: terrainHeight(q.x, q.z), h, placed: true }); break; }
      case 'sign': { // a post with a text panel: style 'street' (green blade), 'shop', 'pole' (big lit pylon face)
        const q = at(0.2); if (!q) break;
        const y = terrainHeight(q.x, q.z), w = p.w || 2.4, hgt = p.height || 2.6, nx = Math.sin(h), nz = Math.cos(h);
        obox(SB, q.x, q.z, 1, 0, 0.05, 0.05, y - 0.2, y + hgt, POST, PL);
        panel(NB, q.x + nx * 0.06, y + hgt - w / 8, q.z + nz * 0.06, nx, nz, w, w / 4.67, nameUV(p.style || 'shop', p.text || reg.name, t.key), undefined, false, p.lit ? 1 : 0);
        posts.push({ kind: 'region sign', x: q.x, z: q.z }); break;
      }
      case 'statue': { // a stone plinth and a bronze figure (until a modelled one replaces it: put it in models)
        const q = at(1.3); if (!q) break;
        const y = terrainHeight(q.x, q.z), k = p.scale || 1, ux = Math.cos(h), uz = -Math.sin(h);
        obox(SB, q.x, q.z, ux, uz, 0.9 * k, 0.9 * k, y - 0.3, y + 1.6 * k, lin(0xb9b2a4), PL);
        obox(SB, q.x, q.z, ux, uz, 0.28 * k, 0.2 * k, y + 1.6 * k, y + 2.5 * k, lin(0x4f5a3c), PL);
        obox(SB, q.x, q.z, ux, uz, 0.22 * k, 0.16 * k, y + 2.5 * k, y + 3.25 * k, lin(0x4f5a3c), PL);
        solid.push(makeBox(q.x, q.z, ux, uz, 0.9 * k, 0.9 * k, y - 0.3, 1.9 * k)); posts.push({ kind: 'statue', x: q.x, z: q.z }); break;
      }
      case 'watertower': { const q = at(4); if (q) waterTower(t, SB, NB, solid, q.x, q.z, p.height || 38, p.text ?? reg.name, p.color); break; }
      case 'mural': { // a painted panel on a wall: x/z on the wall face, h = the way it faces, w x hgt metres
        const q = at(0.2, { noBuilding: true }); if (!q) break;
        const w = p.w || 8, hgt = p.hgt || w / 4.67, y = terrainHeight(q.x, q.z) + (p.y ?? 1.5);
        panel(NB, q.x, y + hgt / 2, q.z, Math.sin(h), Math.cos(h), w, hgt, nameUV('ghost', p.text || reg.name, t.key), null); break;
      }
      case 'roundabout': { // the raised island in the middle of a roundabout (the ring road itself is the OSM junction)
        const r = p.r || 6, y = terrainHeight(px, pz);
        lathe(SB, px, y, pz, [[r, -0.3], [r, 0.3], [r - 0.3, 0.32]], CONC, 24);
        const ctr = groundB.v(px, y + 0.33, pz, 0, 1, 0, ...GRASS, px / 7, pz / 7), ring = [];
        for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2, x = px + Math.cos(a) * (r - 0.3), z = pz + Math.sin(a) * (r - 0.3); ring.push(groundB.v(x, y + 0.33, z, 0, 1, 0, ...GRASS, x / 7, z / 7)); }
        for (let k = 0; k < 24; k++) groundB.i.push(ctr, ring[(k + 1) % 24], ring[k]);
        solid.push(makeBox(px, pz, 1, 0, r * 0.7, r * 0.7, y - 0.3, 0.6)); break;
      }
      case 'miniround': { // a painted mini-roundabout: a flat white disc on the junction, r metres, drive straight over it
        const r = p.r || 2, PAINT = lin(0xeeeeea), py = (x, z) => terrainHeight(x, z) + 0.1, ring = [];
        const ctr = markB.v(px, py(px, pz), pz, 0, 1, 0, ...PAINT, 0, 0);
        for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2, x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r; ring.push(markB.v(x, py(x, z), z, 0, 1, 0, ...PAINT, 0, 0)); }
        for (let k = 0; k < 20; k++) markB.i.push(ctr, ring[(k + 1) % 20], ring[k]);
        break;
      }
      case 'median': { // a raised kerbed median along pts [x, z, ...], w metres wide
        if (!P || P.length < 4) break;
        const w = p.w || 1.6;
        for (let i = 2; i < P.length; i += 2) {
          const ax = P[i - 2], az = P[i - 1], bx = P[i], bz = P[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.2) continue;
          const ux = (bx - ax) / L, uz = (bz - az) / L, mx = (ax + bx) / 2, mz = (az + bz) / 2, y = Math.min(terrainHeight(ax, az), terrainHeight(bx, bz));
          obox(SB, mx, mz, ux, uz, L / 2, w / 2, y - 0.2, y + 0.25, CONC, PL);
        }
        break;
      }
      case 'parking': { // a paved lot over the polygon pts [x, z, ...] (stalls are painted by the ground-class pass)
        if (!P || P.length < 6) break;
        const n = P.length / 2, pts = []; for (let i = 0; i < n; i++) pts.push([P[i * 2], P[i * 2 + 1]]);
        const c = lin(0x5d6064), ids = pts.map(([x, z]) => lotB.v(x, terrainHeight(x, z) + 0.05, z, 0, 1, 0, ...c, x / 6, z / 6));
        for (let i = 1; i + 1 < n; i++) { const [A, B, Cc] = [pts[0], pts[i], pts[i + 1]], cr = (B[0] - A[0]) * (Cc[1] - A[1]) - (B[1] - A[1]) * (Cc[0] - A[0]); if (cr < 0) lotB.i.push(ids[0], ids[i], ids[i + 1]); else lotB.i.push(ids[0], ids[i + 1], ids[i]); } // shortcut: a fan, so the polygon must be convex; split concave lots into several
        break;
      }
      default: if (!warned.has(p.kind)) { warned.add(p.kind); console.warn(`region ${reg.id}: unknown place kind '${p.kind}'`); }
    }
  }
}
