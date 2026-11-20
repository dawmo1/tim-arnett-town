// Builds the meshes and collision walls for one 200 m tile of Davenport.
import * as THREE from 'three';
import { TILE, C, G, D, terrainHeight, district, pointOnEdge, nearestEdge } from './data.js';
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
// a quad facing n (corners in order round the quad), with per-corner uvs
function face(B, P, n, tint, at, uv) {
  const id = P.map((p, k) => B.v(p[0], p[1], p[2], n[0], n[1], n[2], tint[0], tint[1], tint[2], uv[k][0], uv[k][1], at[0], at[1]));
  const ax = P[1][0] - P[0][0], ay = P[1][1] - P[0][1], az = P[1][2] - P[0][2], bx = P[2][0] - P[0][0], by = P[2][1] - P[0][1], bz = P[2][2] - P[0][2];
  const d = (ay * bz - az * by) * n[0] + (az * bx - ax * bz) * n[1] + (ax * by - ay * bx) * n[2];
  if (d > 0) B.quad(id[0], id[1], id[2], id[3]); else B.quad(id[3], id[2], id[1], id[0]);
}
// a box turned to (ax, az): half-length ha along it, half-depth hp across, from y0 to y1
function obox(B, x, z, ax, az, ha, hp, y0, y1, tint, at, S = 4, bottom = false) {
  const px = -az, pz = ax;
  const C = (sa, sp, y) => [x + ax * ha * sa + px * hp * sp, y, z + az * ha * sa + pz * hp * sp];
  const side = (a0, p0, a1, p1, nx, nz, w) => face(B, [C(a0, p0, y0), C(a1, p1, y0), C(a1, p1, y1), C(a0, p0, y1)], [nx, 0, nz], tint, at, [[0, y0 / S], [w / S, y0 / S], [w / S, y1 / S], [0, y1 / S]]);
  side(-1, 1, 1, 1, px, pz, 2 * ha); side(-1, -1, 1, -1, -px, -pz, 2 * ha);
  side(1, -1, 1, 1, ax, az, 2 * hp); side(-1, -1, -1, 1, -ax, -az, 2 * hp);
  const top = [C(-1, -1, y1), C(1, -1, y1), C(1, 1, y1), C(-1, 1, y1)];
  face(B, top, [0, 1, 0], tint, at, top.map((p) => [p[0] / S, p[2] / S]));
  if (bottom) { const bt = [C(-1, -1, y0), C(1, -1, y0), C(1, 1, y0), C(-1, 1, y0)]; face(B, bt, [0, -1, 0], tint, at, bt.map((p) => [p[0] / S, p[2] / S])); }
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
const AWNING = [0x9e2a2b, 0x2f5d3a, 0x1f3a5f, 0x5c1f2e, 0xc9a66b, 0x222222, 0x8a5a2b, 0x2a6f75].map(lin);
const DOORS = [0x7a1f1f, 0x1f3550, 0x2b4a2e, 0x3b2a1f, 0xe9e4d8, 0x111111, 0x6b5a2a].map(lin);
const TRIM = lin(0xf2efe8), CONCRETE = lin(0x9d9a93), WOOD = lin(0x8a7560);
function buildBuildings(t, B, boxes, foot, SB, GB, junk) {
  t.b.forEach((rec, bi) => {
    const [rel, baseY, hgt, pitched, style, name, kind = 0] = rec;
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
    if (/church|cathedral|chapel|temple/i.test(name) || kind === 2) cell = 'church';
    if (kind === 1) cell = 'ramp';
    else if (kind === 3) cell = 'brick3';
    else if (kind === 4) cell = 'metal';
    // landmarks keep their real look
    if (/Figge|Conservatory/.test(name)) cell = 'glass';
    else if (/River Center/.test(name)) cell = 'office';
    else if (/Union Station|Freight House|Adler|Blackhawk|Kahl|Putnam/.test(name)) cell = 'brick2';
    if (pitched && hgt < 4.2) cell = 'garage';
    const store = !pitched && kind !== 1 && kind !== 2 && kind !== 3 && !name && hgt >= 6 && hgt < 32 && (((dist === 'downtown' || dist === 'village') && (style === 0 || style === 1) && hash(seed + 2) < 0.75) || style === 4 || kind === 5);
    let tint = [1, 1, 1];
    if (cell === 'siding' || cell === 'garage') tint = lin(SIDING_TINTS[Math.floor(hash(seed + 3) * SIDING_TINTS.length)]);
    else if (cell.startsWith('brick')) tint = lin(BRICK_TINTS[Math.floor(hash(seed + 4) * BRICK_TINTS.length)]);
    else if (cell === 'stucco') tint = lin([0xffffff, 0xf3e9d8, 0xe9e4da, 0xf5efe1][Math.floor(hash(seed + 5) * 4)]);
        const atl = (c) => [c[0] / 4, 1 - (c[1] + 1) / 4];
    const A = atl(CELL[cell]), S = atl(CELL.store), R = atl(CELL.roof), SH = atl(CELL.shingle);
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
    // the wall that faces the nearest street (shop signs, awnings, front doors, porches)
    let area2 = 0; for (let i = 0; i < n; i++) { const j = (i + 1) % n; area2 += pts[i * 2] * pts[j * 2 + 1] - pts[j * 2] * pts[i * 2 + 1]; }
    const house = pitched && hgt >= 4.2 && hgt < 12 && Math.abs(area2) / 2 < 320 && (cell === 'siding' || cell.startsWith('brick'));
    let best = null, road = null;
    if (store || house) {
      road = nearestEdge(cx, cz, 70);
      if (road) {
        let bd = 0.3;
        for (let i = 0; i < n; i++) {
          const x0 = pts[i * 2], z0 = pts[i * 2 + 1], x1 = pts[((i + 1) % n) * 2], z1 = pts[((i + 1) % n) * 2 + 1], L = Math.hypot(x1 - x0, z1 - z0);
          if (L < (house ? 4 : 5)) continue;
          let ox = (z1 - z0) / L, oz = -(x1 - x0) / L;
          if (pointInPoly((x0 + x1) / 2 + ox * 0.3, (z0 + z1) / 2 + oz * 0.3, pts)) { ox = -ox; oz = -oz; }
          const tx = road.x - (x0 + x1) / 2, tz = road.z - (z0 + z1) / 2, tl = Math.hypot(tx, tz) || 1, d = (ox * tx + oz * tz) / tl;
          if (d > bd) { bd = d; best = { x0, z0, x1, z1, L, ox, oz, i }; }
        }
      }
    }
    const pl = atl(CELL.plain), ol = outline(pts);
    // canvas awnings over each shop front (the store texture repeats three 6 m shops)
    if (store && best) {
      const ux = (best.x1 - best.x0) / best.L, uz = (best.z1 - best.z0) / best.L, a0 = wallAlong[best.i];
      for (let k = Math.floor(a0 / 6); k * 6 < a0 + best.L; k++) {
        const s0 = Math.max(0.4, k * 6 - a0 + 0.35), s1 = Math.min(best.L - 0.4, k * 6 + 5.65 - a0);
        if (s1 - s0 < 2 || hash(seed + k * 13) > 0.72) continue;
        const tint = AWNING[Math.floor(hash(seed + k * 17) * AWNING.length)], dk = tint.map((c) => c * 0.55);
        const P = (sa, out, y) => [best.x0 + ux * sa + best.ox * out, baseY + y, best.z0 + uz * sa + best.oz * out];
        const d = 1.35, nt = [best.ox * 0.35, 0.94, best.oz * 0.35];
        face(B, [P(s0, 0.02, 3.2), P(s1, 0.02, 3.2), P(s1, d, 2.7), P(s0, d, 2.7)], nt, tint, pl, [[0, 0], [1, 0], [1, 1], [0, 1]]);
        face(B, [P(s0, 0.02, 3.19), P(s1, 0.02, 3.19), P(s1, d, 2.69), P(s0, d, 2.69)], [-nt[0], -nt[1], -nt[2]], dk, pl, [[0, 0], [1, 0], [1, 1], [0, 1]]);
        face(B, [P(s0, d, 2.38), P(s1, d, 2.38), P(s1, d, 2.7), P(s0, d, 2.7)], [best.ox, 0, best.oz], tint, pl, [[0, 0], [1, 0], [1, 1], [0, 1]]);
        for (const [sx, sgn] of [[s0, -1], [s1, 1]]) face(B, [P(sx, 0.02, 3.2), P(sx, d, 2.7), P(sx, d, 2.38), P(sx, 0.02, 2.38 + 0.5)], [ux * sgn, 0, uz * sgn], dk, pl, [[0, 0], [1, 0], [1, 1], [0, 1]]);
      }
      band(B, pts, ol, baseY + 4.2, baseY + 4.5, 0.16, TRIM.map((c) => c * 0.85), pl);
    }
    // houses: front door, a porch with steps and posts, gutters, a chimney, a driveway to the street
    const baseYb = baseY;
    if (house && best) {
      const ux = (best.x1 - best.x0) / best.L, uz = (best.z1 - best.z0) / best.L, ox = best.ox, oz = best.oz;
      const porch = best.L > 6 && hash(seed + 31) < 0.75, ph = porch ? 0.35 : 0.15;
      const df = 0.3 + hash(seed + 32) * 0.4, dx = best.x0 + ux * best.L * df, dz = best.z0 + uz * best.L * df;
      const door = DOORS[Math.floor(hash(seed + 33) * DOORS.length)];
      const baseY = Math.max(baseYb, terrainHeight(dx + ox * 1.5, dz + oz * 1.5)); // the porch sits on the ground in front, not the lowest corner
      obox(B, dx + ox * 0.03, dz + oz * 0.03, ux, uz, 0.62, 0.03, baseY + ph, baseY + ph + 2.3, TRIM, pl);
      obox(B, dx + ox * 0.06, dz + oz * 0.06, ux, uz, 0.48, 0.03, baseY + ph, baseY + ph + 2.12, door, pl);
      if (porch) {
        const hw = Math.min(best.L * 0.42, 3.6), pc = Math.max(hw + 0.3, Math.min(best.L - hw - 0.3, best.L * df)), px = best.x0 + ux * pc, pz = best.z0 + uz * pc, dep = 2.2;
        obox(B, px + ox * dep / 2, pz + oz * dep / 2, ux, uz, hw, dep / 2, baseY - 0.6, baseY + ph, WOOD, pl);
        for (const sx of [-hw + 0.12, hw - 0.12]) obox(B, px + ux * sx + ox * (dep - 0.12), pz + uz * sx + oz * (dep - 0.12), ux, uz, 0.08, 0.08, baseY + ph, baseY + 2.85, TRIM, pl);
        obox(B, px + ox * (dep + 0.1) / 2, pz + oz * (dep + 0.1) / 2, ux, uz, hw + 0.15, (dep + 0.1) / 2, baseY + 2.85, baseY + 3.0, TRIM, pl, 4, true);
        obox(B, dx + ox * (dep + 0.2), dz + oz * (dep + 0.2), ux, uz, 0.7, 0.2, baseY - 0.4, baseY + ph * 0.5, CONCRETE, pl);
        // rails either side of the steps
        for (const [a, b] of [[-hw + 0.1, (df * best.L - pc) - 0.75], [(df * best.L - pc) + 0.75, hw - 0.1]]) if (b - a > 0.3) obox(B, px + ux * (a + b) / 2 + ox * (dep - 0.12), pz + uz * (a + b) / 2 + oz * (dep - 0.12), ux, uz, (b - a) / 2, 0.04, baseY + ph + 0.8, baseY + ph + 0.9, TRIM, pl);
      } else obox(B, dx + ox * 0.45, dz + oz * 0.45, ux, uz, 0.75, 0.4, baseY - 0.4, baseY + ph, CONCRETE, pl);
      // a flower bed under the front windows, a fence or hedge along the front of the yard
      if (junk) {
        const fs = df < 0.5 ? Math.min(best.L - 1.2, best.L * df + 2.2) : Math.max(1.2, best.L * df - 2.2);
        if (hash(seed + 35) < 0.55) junk.push({ kind: hash(seed + 36) < 0.6 ? 'flowers' : 'hedge', x: best.x0 + ux * fs + ox * (porch ? 2.7 : 0.6), z: best.z0 + uz * fs + oz * (porch ? 2.7 : 0.6), y: baseY, h: Math.atan2(ox, oz) });
        if (road) {
          const front = (road.x - dx) * ox + (road.z - dz) * oz - (road.e.width || 7) / 2 - WALK_W - 0.6;
          const r = hash(seed + 37), kindF = dist === 'west' && r < 0.5 ? 'chainlink' : r < 0.45 ? 'picket' : r < 0.65 ? 'hedge' : null;
          if (kindF && front > 3.5 && front < 14) {
            const seg = kindF === 'chainlink' ? 3 : kindF === 'hedge' ? 2 : 2.4, a0 = -3, a1 = best.L + 3;
            const gate = best.L * df, drive = df < 0.5 ? best.L * 0.85 : best.L * 0.15, hasDrive = hash(seed + 34) < 0.6;
            for (let a = a0; a + seg <= a1 + 0.01; a += seg) {
              const mid = a + seg / 2;
              if (Math.abs(mid - gate) < seg * 0.5 || (hasDrive && Math.abs(mid - drive) < seg * 0.5 + 1.4)) continue;
              const fx = best.x0 + ux * mid + ox * front, fz = best.z0 + uz * mid + oz * front;
              junk.push({ kind: kindF, x: fx, z: fz, y: terrainHeight(fx, fz), h: Math.atan2(ox, oz) });
            }
          }
        }
      }
      // driveway on the far side from the door, out to the kerb
      if (road && hash(seed + 34) < 0.6) {
        const f = df < 0.5 ? 0.85 : 0.15, sx = best.x0 + ux * best.L * f + ox * 0.1, sz = best.z0 + uz * best.L * f + oz * 0.1;
        const len = (road.x - sx) * ox + (road.z - sz) * oz - (road.e.width || 7) / 2;
        if (len > 2 && len < 24) {
          const segs = Math.ceil(len / 4);
          for (let k = 0; k < segs; k++) {
            const a = (k / segs) * len, b = ((k + 1) / segs) * len, Pd = (o, w) => { const x = sx + ox * o + ux * w, z = sz + oz * o + uz * w; return [x, terrainHeight(x, z) + 0.05, z]; };
            face(B, [Pd(a, -1.4), Pd(a, 1.4), Pd(b, 1.4), Pd(b, -1.4)], [0, 1, 0], CONCRETE, pl, [[0, 0], [1, 0], [1, 1], [0, 1]]);
          }
        }
      }
    }
    // a lit sign with a made-up name over the shop fronts, on the wall facing the street
    if (store && SB && hash(seed + 9) < 0.85) {
      {
        if (best) {
          const w = Math.min(best.L * 0.6, 9), mx = (best.x0 + best.x1) / 2 + best.ox * 0.14, mz = (best.z0 + best.z1) / 2 + best.oz * 0.14;
          const ux = (best.x1 - best.x0) / best.L, uz = (best.z1 - best.z0) / best.L, y0 = baseY + 3.25, y1 = baseY + 4.15;
          // winding: face outward
          const flip = ux * best.oz - uz * best.ox > 0;
          const si = Math.floor(hash(seed + 11) * 128), su = (si % 8) / 8, sv = 1 - (Math.floor(si / 8) + 1) / 16;
          const ax = mx - ux * w / 2, az = mz - uz * w / 2, bx = mx + ux * w / 2, bz = mz + uz * w / 2;
          const a = SB.v(ax, y0, az, best.ox, 0, best.oz, 1, 1, 1, flip ? su : su + 1 / 8, sv), b = SB.v(bx, y0, bz, best.ox, 0, best.oz, 1, 1, 1, flip ? su + 1 / 8 : su, sv);
          const c = SB.v(bx, y1, bz, best.ox, 0, best.oz, 1, 1, 1, flip ? su + 1 / 8 : su, sv + 1 / 16), d = SB.v(ax, y1, az, best.ox, 0, best.oz, 1, 1, 1, flip ? su : su + 1 / 8, sv + 1 / 16);
          if (flip) SB.quad(a, b, c, d); else SB.quad(b, a, d, c);
        }
      }
    }
    // a little grit in the older and rougher parts of town: tags on walls, bags and a dumpster out back
    const gritty = dist === 'west' || dist === 'riverfront' || kind === 4 || (dist === 'hilltop' && !pitched);
    if (GB && gritty && !pitched && hash(seed + 21) < 0.35) {
      for (let i = 0; i < n; i++) {
        const x0 = pts[i * 2], z0 = pts[i * 2 + 1], x1 = pts[((i + 1) % n) * 2], z1 = pts[((i + 1) % n) * 2 + 1], L = Math.hypot(x1 - x0, z1 - z0);
        if (L < 6 || hash(seed + i * 3) > 0.4) continue;
        let ox = (z1 - z0) / L, oz = -(x1 - x0) / L;
        if (pointInPoly((x0 + x1) / 2 + ox * 0.3, (z0 + z1) / 2 + oz * 0.3, pts)) { ox = -ox; oz = -oz; }
        const ux = (x1 - x0) / L, uz = (z1 - z0) / L, w = 3.4, f = 0.2 + hash(seed + i) * 0.6, mx = x0 + ux * L * f + ox * 0.08, mz = z0 + uz * L * f + oz * 0.08;
        const ti = Math.floor(hash(seed + i * 7) * 8), su = (ti % 4) / 4, sv = 1 - (Math.floor(ti / 4) + 1) / 2, flip = ux * oz - uz * ox > 0;
        const y0 = baseY + 0.3, y1 = baseY + 2.1, ax = mx - ux * w / 2, az = mz - uz * w / 2, bx = mx + ux * w / 2, bz = mz + uz * w / 2;
        const a = GB.v(ax, y0, az, ox, 0, oz, 1, 1, 1, flip ? su : su + 0.25, sv), b = GB.v(bx, y0, bz, ox, 0, oz, 1, 1, 1, flip ? su + 0.25 : su, sv);
        const c = GB.v(bx, y1, bz, ox, 0, oz, 1, 1, 1, flip ? su + 0.25 : su, sv + 0.5), d = GB.v(ax, y1, az, ox, 0, oz, 1, 1, 1, flip ? su : su + 0.25, sv + 0.5);
        if (flip) GB.quad(a, b, c, d); else GB.quad(b, a, d, c);
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
      if (junk) {
        const inside = (x, z, r) => pointInPoly(x, z, pts) && pointInPoly(x + r, z + r, pts) && pointInPoly(x - r, z - r, pts) && pointInPoly(x + r, z - r, pts) && pointInPoly(x - r, z + r, pts);
        let lx = 1, lz = 0, lb = 0;
        for (let i = 0; i < n; i++) { const ddx = pts[((i + 1) % n) * 2] - pts[i * 2], ddz = pts[((i + 1) % n) * 2 + 1] - pts[i * 2 + 1], l = Math.hypot(ddx, ddz); if (l > lb) { lb = l; lx = ddx / l; lz = ddz / l; } }
        const rh = Math.atan2(lx, lz);
        if (hgt > 45 && inside(cx, cz, 7)) {
          // a stepped crown on the tall towers, with a mast on the very top
          const A2 = atl(CELL[cell]), w0 = Math.min(9, lb * 0.32);
          obox(B, cx, cz, lx, lz, w0, w0 * 0.75, top, top + 6.6, tint, A2, 16);
          band(B, [cx - lx * w0 + lz * w0 * 0.75, cz - lz * w0 - lx * w0 * 0.75, cx + lx * w0 + lz * w0 * 0.75, cz + lz * w0 - lx * w0 * 0.75, cx + lx * w0 - lz * w0 * 0.75, cz + lz * w0 + lx * w0 * 0.75, cx - lx * w0 - lz * w0 * 0.75, cz - lz * w0 + lx * w0 * 0.75], outline([cx - lx * w0 + lz * w0 * 0.75, cz - lz * w0 - lx * w0 * 0.75, cx + lx * w0 + lz * w0 * 0.75, cz + lz * w0 - lx * w0 * 0.75, cx + lx * w0 - lz * w0 * 0.75, cz + lz * w0 + lx * w0 * 0.75, cx - lx * w0 - lz * w0 * 0.75, cz - lz * w0 + lx * w0 * 0.75]), top + 6.4, top + 7.0, 0.2, trim, pl, 0.15);
          obox(B, cx, cz, lx, lz, w0 * 0.55, w0 * 0.4, top + 6.6, top + 10.5, lin(0xb9bcbe), atl(CELL.metal));
          obox(B, cx, cz, lx, lz, 0.15, 0.15, top + 10.5, top + 18 + hash(seed + 60) * 10, lin(0x9a9c9e), pl);
        } else if (hgt > 16 && inside(cx, cz, 4)) obox(B, cx, cz, lx, lz, Math.min(4, lb * 0.16), 2.6, top, top + 3.2, lin(0xb9bcbe), atl(CELL.metal));
        const nAc = Math.floor(hash(seed + 42) * (hgt > 16 ? 5 : 3));
        for (let k = 0; k < nAc; k++) {
          const ax = cx + (hash(seed + k * 5 + 43) - 0.5) * lb * 0.6, az = cz + (hash(seed + k * 5 + 44) - 0.5) * lb * 0.6;
          if (inside(ax, az, 1.3) && Math.hypot(ax - cx, az - cz) > 4.5) junk.push({ kind: 'ac', x: ax, z: az, y: top, h: rh + (k % 2) * Math.PI / 2 });
        }
        if (old && hgt > 9 && (dist === 'downtown' || dist === 'village' || dist === 'west') && hash(seed + 45) < 0.35) {
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
      }
      return;
    }
    // gable roof over the footprint's oriented box
    let longest = 0, ux = 1, uz = 0;
    for (let i = 0; i < n; i++) { const dx = pts[((i + 1) % n) * 2] - pts[i * 2], dz = pts[((i + 1) % n) * 2 + 1] - pts[i * 2 + 1], l = Math.hypot(dx, dz); if (l > longest) { longest = l; ux = dx / l; uz = dz / l; } }
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
    if (hgt >= 4.2) {
      const pl = atl(CELL.plain), gut = hash(seed + 51) < 0.5 ? TRIM : lin(0x6e6a64);
      for (const va of [v0, v1]) { const [gx, gz] = W((u0 + u1) / 2, va); obox(B, gx, gz, ux, uz, (u1 - u0) / 2, 0.07, ey - 0.16, ey - 0.02, gut, pl, 4, true); }
      const [dx0, dz0] = W(u0 + 0.1, v0 + 0.1); obox(B, dx0, dz0, ux, uz, 0.05, 0.05, baseY, ey - 0.1, gut, pl);
      const [dx1, dz1] = W(u1 - 0.1, v1 - 0.1); obox(B, dx1, dz1, ux, uz, 0.05, 0.05, baseY, ey - 0.1, gut, pl);
      if (hash(seed + 52) < 0.45 && u1 - u0 > 5) {
        const cu = hash(seed + 53) < 0.5 ? u0 + 1.2 : u1 - 1.2, [chx, chz] = W(cu, vm + 0.5);
        obox(B, chx, chz, ux, uz, 0.42, 0.32, top, ry + 0.9, lin(BRICK_TINTS[0]), atl(CELL.brick3), 4);
        obox(B, chx, chz, ux, uz, 0.5, 0.4, ry + 0.9, ry + 1.05, lin(0x8c8a86), pl);
      }
    }
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

// ---------- street furniture along the sidewalks (deterministic per edge) ----------
function streetProps(t, junk, boxes) {
  for (const id of t.e) {
    const e = G.edges[id];
    if (!SIDEWALK(e) || e.len < 30) continue;
    const dist = district(e.pts[0], e.pts[1]), busy = dist === 'downtown' || dist === 'village', big = e.cls === 'primary' || e.cls === 'secondary';
    const put = (kind, s, side, off, extra = {}) => {
      const p = pointOnEdge(e, s), x = p.x + Math.cos(p.h) * off * side, z = p.z - Math.sin(p.h) * off * side;
      if (!inTile(t, x, z)) return null;
      const j = { kind, x, z, y: terrainHeight(x, z), h: p.h + (side > 0 ? -Math.PI / 2 : Math.PI / 2), ...extra };
      junk.push(j); return j;
    };
    const kerb = e.width / 2 + 0.55, back = e.width / 2 + WALK_W - 0.35;
    // hydrants every block or so, near the start of the edge
    if (hash(id * 3.7) < 0.8) put('hydrant', 9 + hash(id) * 6, hash(id * 1.3) < 0.5 ? 1 : -1, kerb);
    // a bus stop on bigger roads now and then (with a bench inside)
    if (big && e.len > 60 && hash(id * 5.1) < (busy ? 0.35 : 0.25)) {
      const side = hash(id * 2.9) < 0.5 ? 1 : -1, s = e.len * (0.35 + hash(id * 7.7) * 0.3);
      const j = put('busstop', s, side, e.width / 2 + 1.25);
      if (j) { j.busStop = true; boxes.push(makeBox(j.x - Math.sin(j.h) * 0.6, j.z - Math.cos(j.h) * 0.6, Math.cos(j.h), -Math.sin(j.h), 1.6, 0.1, j.y, 2.5)); }
    }
    if (busy || dist === 'riverfront') {
      for (let s = 16 + hash(id * 9.1) * 20, k = 0; s < e.len - 14; s += 34 + hash(id + k) * 30, k++) {
        const side = (k + id) % 2 ? 1 : -1, r = hash(id * 13 + k);
        if (r < 0.3) put('bench', s, side, back);
        else if (r < 0.55) put('bin', s, side, kerb + 0.1);
        else if (r < 0.7 && busy) { put('newsbox', s, side, back + 0.05); put('newsbox', s + 0.6, side, back + 0.05); }
        else if (r < 0.78) put('mailbox', s, side, kerb + 0.2);
      }
      // parking meters along downtown kerbs
      if (busy && e.cls !== 'primary') for (let s = 14, k = 0; s < e.len - 14; s += 7.5, k++) if (hash(id * 17 + k) < 0.8) { put('meter', s, 1, kerb - 0.15); put('meter', s + 3, -1, kerb - 0.15); }
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
        const y0 = terrainHeight(x0, z0) + 0.1, y1 = terrainHeight(x1, z1) + 0.1;
        const strip = (o0, o1, lift, c) => { const p = [[x0 + nx * o0, z0 + nz * o0, y0], [x0 + nx * o1, z0 + nz * o1, y0], [x1 + nx * o1, z1 + nz * o1, y1], [x1 + nx * o0, z1 + nz * o0, y1]].map(([x, z, y]) => B.v(x, y + lift, z, 0, 1, 0, ...c, 0, 0)); B.quad(p[1], p[0], p[3], p[2]); };
        strip(-1.6, 1.6, 0, BAL);
        for (let tt = 0; tt < 4; tt += 0.8) { const f = tt / 4; const px = x0 + (x1 - x0) * f, pz = z0 + (z1 - z0) * f; const y = y0 + (y1 - y0) * f + 0.03; const q = [[px + nx * -1.25, pz + nz * -1.25], [px + nx * 1.25, pz + nz * 1.25], [px + nx * 1.25 + ux * 0.25, pz + nz * 1.25 + uz * 0.25], [px + nx * -1.25 + ux * 0.25, pz + nz * -1.25 + uz * 0.25]].map(([x, z]) => B.v(x, y, z, 0, 1, 0, ...TIE, 0, 0)); B.quad(q[1], q[0], q[3], q[2]); }
        strip(-0.8, -0.68, 0.14, RAIL); strip(0.68, 0.8, 0.14, RAIL);
      }
    }
  }
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
  const bB = new Buf(true), sB = new Buf(), gB = new Buf(), boxes = [], foot = [], junk = [];
  buildBuildings(t, bB, boxes, foot, sB, gB, junk);
  add(bB.geometry(), M.building, true);
  add(sB.geometry(), M.signs, false);
  add(gB.geometry(), M.graffiti, false);
  const rB = new Buf(); buildRail(t, rB); add(rB.geometry(), M.rail, false);
  const trees = [];
  for (let i = 0; i < t.t.length; i += 4) {
    const x = t.t[i] + t.ox, z = t.t[i + 1] + t.oz;
    trees.push({ x, z, y: terrainHeight(x, z), kind: t.t[i + 2], s: t.t[i + 3] / 10, seed: hash(x * 3.1 + z) });
    boxes.push(makeBox(x, z, 1, 0, 0.22 * t.t[i + 3] / 10, 0.22 * t.t[i + 3] / 10, terrainHeight(x, z) - 1, 6));
  }
  streetProps(t, junk, boxes);
  const lights = streetLights(t);
  for (const l of lights) boxes.push(makeBox(l.x, l.z, 1, 0, 0.12, 0.12, l.y - 0.5, 8));
  return { group, boxes, trees, lights, foot, junk };
}
