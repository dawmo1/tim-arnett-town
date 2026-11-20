// Geometry helpers shared by the tile builder (tile.js) and the street/area detail (detail.js).
import * as THREE from 'three';

const col = new THREE.Color();
export const lin = (hex) => { col.setHex(hex); return [col.r, col.g, col.b]; };
export const hash = (n) => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };

// growable vertex buffers -> one BufferGeometry (optional 'atlas' vec2 attribute)
export class Buf {
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
// a quad facing n (corners in order round the quad), with per-corner uvs
export function face(B, P, n, tint, at, uv) {
  const id = P.map((p, k) => B.v(p[0], p[1], p[2], n[0], n[1], n[2], tint[0], tint[1], tint[2], uv[k][0], uv[k][1], at[0], at[1]));
  const ax = P[1][0] - P[0][0], ay = P[1][1] - P[0][1], az = P[1][2] - P[0][2], bx = P[2][0] - P[0][0], by = P[2][1] - P[0][1], bz = P[2][2] - P[0][2];
  const d = (ay * bz - az * by) * n[0] + (az * bx - ax * bz) * n[1] + (ax * by - ay * bx) * n[2];
  if (d > 0) B.quad(id[0], id[1], id[2], id[3]); else B.quad(id[3], id[2], id[1], id[0]);
}
// a triangle with its normal worked out, wound to face away from `inside` ([x,y,z] a point it should face away from)
export function tri(B, a, b, c, tint, at, uv, inside) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  const flip = (a[0] - inside[0]) * nx + (a[1] - inside[1]) * ny + (a[2] - inside[2]) * nz < 0;
  if (flip) { nx = -nx; ny = -ny; nz = -nz; }
  const P = [a, b, c].map((p, k) => B.v(p[0], p[1], p[2], nx, ny, nz, tint[0], tint[1], tint[2], uv[k][0], uv[k][1], at[0], at[1]));
  if (flip) B.i.push(P[0], P[2], P[1]); else B.i.push(P[0], P[1], P[2]);
}
// a box turned to (ax, az): half-length ha along it, half-depth hp across, from y0 to y1
export function obox(B, x, z, ax, az, ha, hp, y0, y1, tint, at, S = 4, bottom = false) {
  const px = -az, pz = ax;
  const C = (sa, sp, y) => [x + ax * ha * sa + px * hp * sp, y, z + az * ha * sa + pz * hp * sp];
  const side = (a0, p0, a1, p1, nx, nz, w) => face(B, [C(a0, p0, y0), C(a1, p1, y0), C(a1, p1, y1), C(a0, p0, y1)], [nx, 0, nz], tint, at, [[0, y0 / S], [w / S, y0 / S], [w / S, y1 / S], [0, y1 / S]]);
  side(-1, 1, 1, 1, px, pz, 2 * ha); side(-1, -1, 1, -1, -px, -pz, 2 * ha);
  side(1, -1, 1, 1, ax, az, 2 * hp); side(-1, -1, -1, 1, -ax, -az, 2 * hp);
  const top = [C(-1, -1, y1), C(1, -1, y1), C(1, 1, y1), C(-1, 1, y1)];
  face(B, top, [0, 1, 0], tint, at, top.map((p) => [p[0] / S, p[2] / S]));
  if (bottom) { const bt = [C(-1, -1, y0), C(1, -1, y0), C(1, 1, y0), C(-1, 1, y0)]; face(B, bt, [0, -1, 0], tint, at, bt.map((p) => [p[0] / S, p[2] / S])); }
}
// A vertical text panel (uv box from names.js) centred at (x, y, z), facing (nx, nz), w x h. Two-sided: the back
// gets the same text the right way round, or `back` uvs. vertical = text runs top to bottom (blade signs).
// glow = 1 lights it at night (neon, shop and pylon signs); 0 = painted / reflective (street signs, ghost signs).
export const PLAIN = [0.75, 0.25]; // the plain cell of the building atlas (mats.js CELL.plain) for solid-coloured parts
export function panel(B, x, y, z, nx, nz, w, h, uv, back = uv, vertical = false, glow = 0) {
  if (!uv) return;
  const ux = nz, uz = -nx; // right-hand direction when looking at the front
  const P = (s, t) => [x - ux * w / 2 * s, y + h / 2 * t, z - uz * w / 2 * s];
  const W = [1, 1, 1];
  for (const side of [1, -1]) {
    const q = side > 0 ? uv : back; if (!q) continue;
    const [u0, v0, u1, v1] = q, o = 0.004 * side;
    const c = [P(1, -1), P(-1, -1), P(-1, 1), P(1, 1)].map((p) => [p[0] + nx * o, p[1], p[2] + nz * o]);
    // corner uvs: front reads left->right; back is mirrored so it also reads correctly
    let U = side > 0 ? [[u0, v0], [u1, v0], [u1, v1], [u0, v1]] : [[u1, v0], [u0, v0], [u0, v1], [u1, v1]];
    if (vertical) U = side > 0 ? [[u0, v1], [u0, v0], [u1, v0], [u1, v1]] : [[u0, v0], [u0, v1], [u1, v1], [u1, v0]];
    face(B, c, [nx * side, 0, nz * side], W, [glow, 0], U);
  }
}
