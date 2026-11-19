// Builds the meshes and collision walls for one 200 m tile of Davenport.
import * as THREE from 'three';
import { TILE, C, G, terrainHeight, district, pointOnEdge } from './data.js';
import { makeBox } from './collide.js';
import { M, CELL, STYLE_CELL } from './mats.js';

const hash = (n) => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
const col = new THREE.Color();
const lin = (hex) => { col.setHex(hex); return [col.r, col.g, col.b]; };

// ---------- geometry buffers ----------
class Buf {
  constructor(withAtlas = false) { this.p = []; this.n = []; this.c = []; this.uv = []; this.i = []; this.a = withAtlas ? [] : null; }
  v(x, y, z, nx, ny, nz, r, g, b, u, w, ax = 0, ay = 0) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(r, g, b); this.uv.push(u, w);
    if (this.a) this.a.push(ax, ay);
    return this.p.length / 3 - 1;
  }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  geometry() {
    if (!this.i.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.a) g.setAttribute('atlas', new THREE.Float32BufferAttribute(this.a, 2));
    g.setIndex(this.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere();
    return g;
  }
}

// ---------- ground colours ----------
const GROUND = [];
GROUND[C.lawn] = 0x84a85c; GROUND[C.water] = 0x5a5844; GROUND[C.park] = 0x74ad52; GROUND[C.wood] = 0x557c3c;
GROUND[C.parking] = 0x5d6064; GROUND[C.paved] = 0x96938d; GROUND[C.industrial] = 0x8f897c; GROUND[C.cemetery] = 0x80a75e;
GROUND[C.sand] = 0xcdbb8a; GROUND[C.road] = 0x5a5d61; GROUND[C.walk] = 0xa9a59c; GROUND[C.building] = 0x8d8a84;
GROUND[C.pitch] = 0x63ab4b; GROUND[C.offmap] = 0x7d9461;
const GROUND_LIN = GROUND.map((h) => lin(h));

function buildTerrain(t) {
  const B = new Buf(), S = 51, step = 4;
  const hgt = new Float32Array(S * S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) hgt[j * S + i] = terrainHeight(t.ox + i * step, t.oz + j * step);
  const cls = (i, j) => t.c[Math.max(0, Math.min(49, j)) * 50 + Math.max(0, Math.min(49, i))];
  // unmapped ground downtown is paved lots and plazas, not lawn
  const urban = district(t.ox + 100, t.oz + 100) === 'downtown';
  const URBAN = lin(0x8f8b83);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const x = t.ox + i * step, z = t.oz + j * step, y = hgt[j * S + i];
    const hx = terrainHeight(x + 2, z) - terrainHeight(x - 2, z), hz = terrainHeight(x, z + 2) - terrainHeight(x, z - 2);
    const nl = Math.hypot(hx, 4, hz);
    let r = 0, g = 0, b = 0;
    for (const [di, dj] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) { const k0 = cls(i + di, j + dj); const c = urban && k0 === C.lawn ? URBAN : GROUND_LIN[k0] || GROUND_LIN[0]; r += c[0]; g += c[1]; b += c[2]; }
    const k = (0.93 + hash(x * 0.37 + z * 1.13) * 0.12) / 4;
    B.v(x, y, z, -hx / nl, 4 / nl, -hz / nl, r * k, g * k, b * k, x / 7, z / 7);
  }
  for (let j = 0; j < S - 1; j++) for (let i = 0; i < S - 1; i++) { const a = j * S + i; B.quad(a, a + S, a + S + 1, a + 1); }
  return B.geometry();
}

// ---------- roads ----------
const dense = new Map(); // edge id -> {x, z, s, nx, nz, m} arrays (points every <= 5 m, with mitre normals)
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
    // right-hand normal of travel direction a->b is (-dz... ) we keep (dz, -dx) = left; use both sides symmetrically
    nx[k] = -dz; nz[k] = dx;
    // mitre scale from the turn at this point
    if (k > 0 && k < m - 1) {
      const ux = xs[k] - xs[k - 1], uz = zs[k] - zs[k - 1], vx = xs[k + 1] - xs[k], vz = zs[k + 1] - zs[k];
      const lu = Math.hypot(ux, uz) || 1, lv = Math.hypot(vx, vz) || 1;
      const cos = (ux * vx + uz * vz) / (lu * lv);
      sc[k] = Math.min(2, 1 / Math.max(0.5, Math.sqrt((1 + cos) / 2)));
    } else sc[k] = 1;
  }
  d = { x: xs, z: zs, s: ss, nx, nz, sc, m };
  dense.set(e.id, d);
  return d;
}
const ROAD_COL = { motor: 0x4a4d52, trunk: 0x4a4d52, primary: 0x4c4f53, secondary: 0x515458, tertiary: 0x56595d, minor: 0x5c5f62, residential: 0x5e6164, service: 0x66686a };
const SIDEWALK = (e) => e.cls !== 'service' && e.cls !== 'motor' && e.cls !== 'trunk';
const WALK_W = 2.2;
// radius of the paved junction at a node
export function nodeRadius(k) {
  let r = 0; for (const id of G.adj[k]) r = Math.max(r, G.edges[id].width / 2);
  return r + (G.adj[k].length >= 3 ? 0.8 : 0);
}
const inTile = (t, x, z) => x >= t.ox && x < t.ox + TILE && z >= t.oz && z < t.oz + TILE;

function buildRoads(t, roadB, walkB, markB) {
  const WHITE = lin(0xeeeeea), YELLOW = lin(0xe8b923);
  const deckY = (e, s, x, z) => (e.bridge ? pointOnEdge(e, s).y : terrainHeight(x, z));
  const flat = (B, ax, az, bx, bz, w, y0, y1, c) => { // a flat strip (markings) from a to b, w wide
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, px = (-dz / l) * w / 2, pz = (dx / l) * w / 2;
    const i0 = B.v(ax + px, y0, az + pz, 0, 1, 0, ...c, 0, 0), i1 = B.v(ax - px, y0, az - pz, 0, 1, 0, ...c, 0, 0);
    const i2 = B.v(bx - px, y1, bz - pz, 0, 1, 0, ...c, 0, 0), i3 = B.v(bx + px, y1, bz + pz, 0, 1, 0, ...c, 0, 0);
    B.quad(i0, i3, i2, i1);
  };
  for (const id of t.e) {
    const e = G.edges[id], d = denseOf(e), hw = e.width / 2;
    const rc = lin(ROAD_COL[e.cls] || 0x5a5d61), v = 0.94 + hash(id) * 0.1, rcol = [rc[0] * v, rc[1] * v, rc[2] * v];
    const wcol = lin(0xc9c5bd);
    const trimA = G.adj[e.a].length >= 3 ? nodeRadius(e.a) + 0.5 : 0, trimB = G.adj[e.b].length >= 3 ? nodeRadius(e.b) + 0.5 : 0;
    for (let k = 0; k < d.m - 1; k++) {
      const mx = (d.x[k] + d.x[k + 1]) / 2, mz = (d.z[k] + d.z[k + 1]) / 2;
      if (!inTile(t, mx, mz)) continue;
      // road surface
      const row = (B, k2, o0, o1, lift, c, uvScale) => {
        const out = [];
        for (const o of [o0, o1]) {
          const x = d.x[k2] + d.nx[k2] * o * d.sc[k2], z = d.z[k2] + d.nz[k2] * o * d.sc[k2];
          const y = (e.bridge ? deckY(e, d.s[k2]) : terrainHeight(x, z)) + lift;
          out.push(B.v(x, y, z, 0, 1, 0, ...c, x / uvScale, z / uvScale));
        }
        return out;
      };
      const [a0, a1] = row(roadB, k, -hw, hw, 0.06, rcol, 6), [b0, b1] = row(roadB, k + 1, -hw, hw, 0.06, rcol, 6);
      roadB.quad(a0, a1, b1, b0);
      if (SIDEWALK(e)) for (const [o0, o1] of [[hw - 0.2, hw + WALK_W], [-hw - WALK_W, -hw + 0.2]]) {
        const [c0, c1] = row(walkB, k, o0, o1, 0.035, wcol, 1.5), [d0, d1] = row(walkB, k + 1, o0, o1, 0.035, wcol, 1.5);
        walkB.quad(c0, c1, d1, d0);
      }
      // markings (skipped inside junctions)
      const s0 = d.s[k], s1 = d.s[k + 1];
      if (s0 < trimA + 1 || s1 > e.len - trimB - 1) continue;
      const y0 = deckY(e, s0, d.x[k], d.z[k]) + 0.085, y1 = deckY(e, s1, d.x[k + 1], d.z[k + 1]) + 0.085;
      const at = (kk, o) => [d.x[kk] + d.nx[kk] * o, d.z[kk] + d.nz[kk] * o];
      const big = ['primary', 'secondary', 'tertiary', 'trunk', 'motor'].includes(e.cls);
      const lanes = e.lf + e.lb, lw = e.width / Math.max(1, lanes);
      if (e.lf > 0 && e.lb > 0 && big) {
        // double yellow: the left side (+n) holds the backward lanes, so the centre sits between
        const c0 = (e.lb - e.lf) * lw / 2;
        for (const o of [c0 - 0.13, c0 + 0.13]) { const [ax, az] = at(k, o), [bx, bz] = at(k + 1, o); flat(markB, ax, az, bx, bz, 0.11, y0, y1, YELLOW); }
      }
      // dashed lane lines between lanes going the same way
      if ((big || lanes >= 3) && lanes >= 2) {
        // 3 m dashes every 9 m, cut out of this piece
        const L = s1 - s0 || 1;
        for (let a = Math.floor(s0 / 9) * 9; a < s1; a += 9) {
          const lo = Math.max(s0, a), hi = Math.min(s1, a + 3); if (hi <= lo) continue;
          const f0 = (lo - s0) / L, f1 = (hi - s0) / L;
          for (let li = 1; li < lanes; li++) {
            if (e.lf > 0 && e.lb > 0 && li === e.lb) continue; // that's the centre line
            const o = -e.width / 2 + li * lw;
            const [ax, az] = at(k, o), [bx, bz] = at(k + 1, o);
            flat(markB, ax + (bx - ax) * f0, az + (bz - az) * f0, ax + (bx - ax) * f1, az + (bz - az) * f1, 0.12, y0 + (y1 - y0) * f0, y0 + (y1 - y0) * f1, WHITE);
          }
        }
      }
      // white edge lines on big roads
      if (big) for (const o of [hw - 0.35, -hw + 0.35]) { const [ax, az] = at(k, o), [bx, bz] = at(k + 1, o); flat(markB, ax, az, bx, bz, 0.12, y0, y1, WHITE); }
    }
  }
  // junction discs, crosswalks and stop lines at nodes in this tile
  const N = G.nodes;
  for (let k = 0; k < N.n; k++) {
    const x = N.x[k], z = N.z[k];
    if (!inTile(t, x, z)) continue;
    const adj = G.adj[k]; if (adj.length < 2) continue;
    const r = nodeRadius(k), onBridge = adj.some((id) => G.edges[id].bridge);
    const ny = onBridge ? N.y[k] : null;
    const walk = adj.some((id) => SIDEWALK(G.edges[id]));
    const disc = (B, rad, lift, c, uvs) => {
      const seg = 18, ctr = B.v(x, (ny ?? terrainHeight(x, z)) + lift, z, 0, 1, 0, ...c, x / uvs, z / uvs), ring = [];
      for (let s = 0; s < seg; s++) { const a = (s / seg) * Math.PI * 2, px = x + Math.cos(a) * rad, pz = z + Math.sin(a) * rad; ring.push(B.v(px, (ny ?? terrainHeight(px, pz)) + lift, pz, 0, 1, 0, ...c, px / uvs, pz / uvs)); }
      for (let s = 0; s < seg; s++) B.i.push(ctr, ring[(s + 1) % seg], ring[s]);
    };
    const e0 = G.edges[adj[0]];
    disc(roadB, r, 0.065, lin(ROAD_COL[e0.cls] || 0x5a5d61), 6);
    if (walk && adj.length >= 3) disc(walkB, r + WALK_W, 0.03, lin(0xc9c5bd), 1.5);
    const ctrl = N.ctrl[k];
    if (!ctrl || adj.length < 3) continue;
    for (const id of adj) {
      const e = G.edges[id]; if (e.len < r + 8) continue;
      const fromA = e.a === k, dirIn = fromA ? e.lb > 0 : e.lf > 0; // traffic arrives at this node along e
      const p0 = pointOnEdge(e, fromA ? r + 0.6 : e.len - r - 0.6), p1 = pointOnEdge(e, fromA ? r + 3.6 : e.len - r - 3.6);
      const ux = p1.x - p0.x, uz = p1.z - p0.z, ul = Math.hypot(ux, uz) || 1, nx = -uz / ul, nz = ux / ul;
      const yy = (p) => (e.bridge ? p.y : terrainHeight(p.x, p.z)) + 0.09;
      if (ctrl === 1 && SIDEWALK(e)) { // zebra crosswalk
        for (let o = -e.width / 2 + 0.5; o <= e.width / 2 - 0.4; o += 1.1) {
          flat(markB, p0.x + nx * o, p0.z + nz * o, p1.x + nx * o, p1.z + nz * o, 0.55, yy(p0), yy(p1), WHITE);
        }
      }
      if (dirIn) { // stop line across the lanes coming in
        const lanes = e.lf + e.lb, lw = e.width / Math.max(1, lanes), nIn = fromA ? e.lb : e.lf;
        const q = pointOnEdge(e, fromA ? r + 4.2 : e.len - r - 4.2), q2 = pointOnEdge(e, fromA ? r + 4.7 : e.len - r - 4.7);
        // incoming lanes are on the incoming driver's right
        const tx = q.x - q2.x, tz = q.z - q2.z, tl = Math.hypot(tx, tz) || 1; // incoming travel direction
        const rx = -tz / tl, rz = tx / tl; // its right-hand side
        const oFar = e.lf > 0 && e.lb > 0 ? nIn * lw : e.width / 2, oNear = e.lf > 0 && e.lb > 0 ? 0.1 : -e.width / 2;
        const ax = q.x + rx * oNear, az = q.z + rz * oNear, bx = q.x + rx * oFar, bz = q.z + rz * oFar;
        flat(markB, ax, az, bx, bz, 0.5, yy(q), yy(q), WHITE);
      }
    }
  }
}

// ---------- buildings ----------
const SIDING_TINTS = [0xf4f1e8, 0xe9e2cf, 0xc9d6df, 0xd6dccb, 0xb9c4ca, 0xe8d9b0, 0xd9c6b6, 0xa9b8a5, 0xf2efe6, 0xcfc3a7, 0x9fb0bf, 0xe6e6e6];
const ROOF_TINTS = [0x55504b, 0x3f3c3a, 0x6b4a3c, 0x4a4f55, 0x5d5a52, 0x6e6259, 0x3b4a44];
const BRICK_TINTS = [0xffffff, 0xf0e2da, 0xffe9d6, 0xe6d4cc, 0xd9cbc3];
function pointInPoly(x, z, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], zi = pts[i + 1], xj = pts[j], zj = pts[j + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
function buildBuildings(t, B, boxes, foot) {
  t.b.forEach((rec, bi) => {
    const [rel, baseY, hgt, pitched, style, name] = rec;
    const pts = new Float32Array(rel.length);
    for (let i = 0; i < rel.length; i += 2) { pts[i] = rel[i] + t.ox; pts[i + 1] = rel[i + 1] + t.oz; }
    const n = pts.length / 2; if (n < 3) return;
    let cx = 0, cz = 0; for (let i = 0; i < n; i++) { cx += pts[i * 2]; cz += pts[i * 2 + 1]; } cx /= n; cz /= n;
    foot.push(pts);
    const seed = t.tx * 7919 + t.tz * 104729 + bi * 31;
    const dist = district(cx, cz);
    let cell = STYLE_CELL[style] || 'plain';
    if (cell === 'brick') cell = dist === 'village' ? 'brick2' : hash(seed) < 0.3 ? 'brick3' : 'brick';
    if (cell === 'glass' && hash(seed + 1) < 0.45) cell = 'office';
    if (/church|cathedral|chapel|temple/i.test(name)) cell = 'church';
    if (pitched && hgt < 4.2) cell = 'garage';
    const store = !pitched && hgt >= 6 && hgt < 32 && (((dist === 'downtown' || dist === 'village') && (style === 0 || style === 1) && hash(seed + 2) < 0.75) || style === 4);
    let tint = [1, 1, 1];
    if (cell === 'siding' || cell === 'garage') tint = lin(SIDING_TINTS[Math.floor(hash(seed + 3) * SIDING_TINTS.length)]);
    else if (cell.startsWith('brick')) tint = lin(BRICK_TINTS[Math.floor(hash(seed + 4) * BRICK_TINTS.length)]);
    else if (cell === 'stucco') tint = lin([0xffffff, 0xf3e9d8, 0xe9e4da, 0xf5efe1][Math.floor(hash(seed + 5) * 4)]);
        const atl = (c) => [c[0] / 4, 1 - (c[1] + 1) / 4];
    const A = atl(CELL[cell]), S = atl(CELL.store), R = atl(CELL.roof), SH = atl(CELL.shingle);
    const yb = baseY - 2.5, top = baseY + hgt;
    // walls
    let along = hash(seed + 6) * 16;
    for (let i = 0; i < n; i++) {
      const x0 = pts[i * 2], z0 = pts[i * 2 + 1], x1 = pts[((i + 1) % n) * 2], z1 = pts[((i + 1) % n) * 2 + 1];
      const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz); if (L < 0.05) continue;
      let ox = dz / L, oz = -dx / L; // one of the two normals; flip so it points out
      if (pointInPoly((x0 + x1) / 2 + ox * 0.3, (z0 + z1) / 2 + oz * 0.3, pts)) { ox = -ox; oz = -oz; }
      const wall = (ylo, yhi, at, uS, vS, vOff) => {
        const u0 = along / uS, u1 = (along + L) / uS;
        const a = B.v(x0, ylo, z0, ox, 0, oz, ...tint, u0, (ylo - vOff) / vS, ...at), b = B.v(x1, ylo, z1, ox, 0, oz, ...tint, u1, (ylo - vOff) / vS, ...at);
        const c = B.v(x1, yhi, z1, ox, 0, oz, ...tint, u1, (yhi - vOff) / vS, ...at), d = B.v(x0, yhi, z0, ox, 0, oz, ...tint, u0, (yhi - vOff) / vS, ...at);
        // winding so the face points along (ox, oz)
        if ((x1 - x0) * oz - (z1 - z0) * ox > 0) B.quad(a, b, c, d); else B.quad(b, a, d, c);
      };
      if (store) { wall(yb, baseY + 4.2, S, 18, 4.2, baseY); wall(baseY + 4.2, top, A, 16, 13.2, baseY + 4.2); }
      else wall(yb, top, A, 16, 13.2, baseY);
      along += L;
      if (L > 0.5) boxes.push(makeBox((x0 + x1) / 2 - ox * 0.6, (z0 + z1) / 2 - oz * 0.6, ox, oz, 0.6, L / 2 + 0.05, yb, top - yb + (pitched ? 1.5 : 0)));
    }
    // roof
    const flatRoof = (y, at, tintR) => {
      const contour = []; for (let i = 0; i < n; i++) contour.push(new THREE.Vector2(pts[i * 2], pts[i * 2 + 1]));
      const tris = THREE.ShapeUtils.triangulateShape(contour, []);
      const idx = contour.map((p) => B.v(p.x, y, p.y, 0, 1, 0, ...tintR, p.x / 16, p.y / 16, ...at));
      for (const [a, b, c] of tris) {
        // make each triangle face up
        const pa = contour[a], pb = contour[b], pc = contour[c];
        const cr = (pb.x - pa.x) * (pc.y - pa.y) - (pb.y - pa.y) * (pc.x - pa.x);
        if (cr < 0) B.i.push(idx[a], idx[b], idx[c]); else B.i.push(idx[a], idx[c], idx[b]);
      }
    };
    if (!pitched) {
      const g = 0.8 + hash(seed + 7) * 0.25;
      flatRoof(top, R, [g, g, g * 0.98]);
      return;
    }
    // gable roof over the footprint's oriented box
    let best = 0, ux = 1, uz = 0;
    for (let i = 0; i < n; i++) { const dx = pts[((i + 1) % n) * 2] - pts[i * 2], dz = pts[((i + 1) % n) * 2 + 1] - pts[i * 2 + 1], l = Math.hypot(dx, dz); if (l > best) { best = l; ux = dx / l; uz = dz / l; } }
    const vx = -uz, vz = ux;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (let i = 0; i < n; i++) { const pu = (pts[i * 2] - cx) * ux + (pts[i * 2 + 1] - cz) * uz, pv = (pts[i * 2] - cx) * vx + (pts[i * 2 + 1] - cz) * vz; u0 = Math.min(u0, pu); u1 = Math.max(u1, pu); v0 = Math.min(v0, pv); v1 = Math.max(v1, pv); }
    const oh = 0.45; u0 -= oh; u1 += oh; v0 -= oh; v1 += oh;
    const rise = Math.max(1.3, Math.min(3.6, (v1 - v0) * 0.36)), vm = (v0 + v1) / 2;
    const W = (pu, pv) => [cx + ux * pu + vx * pv, cz + uz * pu + vz * pv];
    const rt = lin(ROOF_TINTS[Math.floor(hash(seed + 8) * ROOF_TINTS.length)]);
    const ey = top - 0.15, ry = top + rise;
    for (const [va, side] of [[v0, -1], [v1, 1]]) {
      const [x0, z0] = W(u0, va), [x1, z1] = W(u1, va), [x2, z2] = W(u1, vm), [x3, z3] = W(u0, vm);
      const sl = Math.hypot(vm - va, rise), nyv = Math.abs(vm - va) / sl, nh = rise / sl;
      const nx = vx * side * nh, nz = vz * side * nh;
      const a = B.v(x0, ey, z0, nx, nyv, nz, ...rt, u0 / 6, 0, ...SH), b = B.v(x1, ey, z1, nx, nyv, nz, ...rt, u1 / 6, 0, ...SH);
      const c = B.v(x2, ry, z2, nx, nyv, nz, ...rt, u1 / 6, sl / 6, ...SH), d = B.v(x3, ry, z3, nx, nyv, nz, ...rt, u0 / 6, sl / 6, ...SH);
      // face outward/up
      const fx = (x1 - x0), fz = (z1 - z0), gx = x3 - x0, gy = ry - ey, gz = z3 - z0;
      const cyv = fz * gx - fx * gz; // y of (f x g)
      if (cyv > 0) B.quad(a, b, c, d); else B.quad(b, a, d, c);
    }
    for (const [ua, side] of [[u0 + oh, -1], [u1 - oh, 1]]) { // gable ends (wall texture)
      const [x0, z0] = W(ua, v0 + oh), [x1, z1] = W(ua, v1 - oh), [x2, z2] = W(ua, vm);
      const nx = ux * side, nz = uz * side;
      const a = B.v(x0, top, z0, nx, 0, nz, ...tint, 0, (top - baseY) / 13.2, ...A), b = B.v(x1, top, z1, nx, 0, nz, ...tint, (v1 - v0) / 16, (top - baseY) / 13.2, ...A);
      const c = B.v(x2, ry - 0.05, z2, nx, 0, nz, ...tint, (vm - v0) / 16, (ry - baseY) / 13.2, ...A);
      const cr = (x1 - x0) * nz - (z1 - z0) * nx;
      if (cr > 0) B.i.push(a, b, c); else B.i.push(b, a, c);
    }
    flatRoof(top - 0.2, R, [0.6, 0.6, 0.6]); // ceiling under the gable (fills odd footprints)
  });
}

// ---------- street lights (placed along roads, deterministic) ----------
function streetLights(t) {
  const out = [];
  for (const id of t.e) {
    const e = G.edges[id];
    if (!SIDEWALK(e) || e.len < 20) continue;
    const dist = district(e.pts[0], e.pts[1]);
    const gap = dist === 'downtown' || dist === 'village' ? 26 : e.cls === 'residential' ? 44 : 34;
    const s0 = 8 + hash(id) * gap;
    for (let s = s0, k = 0; s < e.len - 8; s += gap, k++) {
      const p = pointOnEdge(e, s);
      const side = (k + id) % 2 ? 1 : -1, off = e.width / 2 + 0.6;
      const x = p.x + Math.cos(p.h) * off * side, z = p.z - Math.sin(p.h) * off * side;
      if (!inTile(t, x, z)) continue;
      out.push({ x, z, y: terrainHeight(x, z), h: p.h + (side > 0 ? -Math.PI / 2 : Math.PI / 2) });
    }
  }
  return out;
}

// Build everything for a tile. Returns {group, boxes, trees, lights, foot}.
export function buildTile(t) {
  const group = new THREE.Group();
  const add = (geo, mat, shadow, recv = true) => { if (!geo) return; const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = recv; m.matrixAutoUpdate = false; group.add(m); };
  add(buildTerrain(t), M.terrain, false);
  const roadB = new Buf(), walkB = new Buf(), markB = new Buf();
  buildRoads(t, roadB, walkB, markB);
  add(walkB.geometry(), M.walk, false);
  add(roadB.geometry(), M.road, false);
  add(markB.geometry(), M.mark, false);
  const bB = new Buf(true), boxes = [], foot = [];
  buildBuildings(t, bB, boxes, foot);
  add(bB.geometry(), M.building, true);
  const trees = [];
  for (let i = 0; i < t.t.length; i += 4) {
    const x = t.t[i] + t.ox, z = t.t[i + 1] + t.oz;
    trees.push({ x, z, y: terrainHeight(x, z), kind: t.t[i + 2], s: t.t[i + 3] / 10, seed: hash(x * 3.1 + z) });
    boxes.push(makeBox(x, z, 1, 0, 0.22 * t.t[i + 3] / 10, 0.22 * t.t[i + 3] / 10, terrainHeight(x, z) - 1, 6));
  }
  const lights = streetLights(t);
  for (const l of lights) boxes.push(makeBox(l.x, l.z, 1, 0, 0.12, 0.12, l.y - 0.5, 8));
  return { group, boxes, trees, lights, foot };
}
