// Collision for the streamed city: every building wall (and tree trunk) is a thin oriented box
// kept in a 32 m grid. Boxes: {cx, cz, ux, uz, hu, vx, vz, hv, y0, h, br, rot}; u = across the wall, v = along it.
import { rayOBB, clamp } from '../util.js';
import { terrainHeight, groundHeight } from './data.js';

const CELL = 32;
const grid = new Map();
const key = (i, j) => (i + 4096) * 8192 + (j + 4096);
const owned = new Map(); // owner (tile key) -> [cell keys]

export function makeBox(cx, cz, ux, uz, hu, hv, y0, h) {
  return { cx, cz, ux, uz, vx: -uz, vz: ux, hu, hv, y0, h, br: Math.hypot(hu, hv), rot: Math.atan2(-uz, ux) };
}
export function addBoxes(owner, boxes) {
  const cells = new Set();
  for (const b of boxes) {
    const ex = Math.abs(b.ux) * b.hu + Math.abs(b.vx) * b.hv, ez = Math.abs(b.uz) * b.hu + Math.abs(b.vz) * b.hv;
    for (let j = Math.floor((b.cz - ez) / CELL); j <= Math.floor((b.cz + ez) / CELL); j++) {
      for (let i = Math.floor((b.cx - ex) / CELL); i <= Math.floor((b.cx + ex) / CELL); i++) {
        const k = key(i, j); let arr = grid.get(k); if (!arr) grid.set(k, (arr = []));
        b.owner = owner; arr.push(b); cells.add(k);
      }
    }
  }
  owned.set(owner, [...cells]);
}
export function removeBoxes(owner) {
  const cells = owned.get(owner); if (!cells) return;
  for (const k of cells) { const arr = grid.get(k); if (!arr) continue; const keep = arr.filter((b) => b.owner !== owner); if (keep.length) grid.set(k, keep); else grid.delete(k); }
  owned.delete(owner);
}
// All boxes whose cells touch the square around (x, z).
export function boxesNear(x, z, r, out = []) {
  out.length = 0;
  const i0 = Math.floor((x - r) / CELL), i1 = Math.floor((x + r) / CELL), j0 = Math.floor((z - r) / CELL), j1 = Math.floor((z + r) / CELL);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const arr = grid.get(key(i, j)); if (!arr) continue;
    for (const b of arr) if (Math.abs(b.cx - x) <= b.br + r && Math.abs(b.cz - z) <= b.br + r && !out.includes(b)) out.push(b);
  }
  return out;
}

const near = [];
// Push a circle out of every wall. Returns the new position and the push normal.
// y (optional): feet height; walls whose top is below your feet don't count (walking on roofs)
export function pushOutCircle(x, z, r, y = -Infinity) {
  let hit = false, nx = 0, nz = 0;
  boxesNear(x, z, r + 0.5, near);
  for (const b of near) {
    if (y > b.y0 + b.h - 0.4) continue;
    const dx = x - b.cx, dz = z - b.cz;
    if (Math.abs(dx) > b.br + r || Math.abs(dz) > b.br + r) continue;
    const lu = dx * b.ux + dz * b.uz, lv = dx * b.vx + dz * b.vz;
    const cu = clamp(lu, -b.hu, b.hu), cv = clamp(lv, -b.hv, b.hv);
    const du = lu - cu, dv = lv - cv, d2 = du * du + dv * dv;
    if (d2 > r * r) continue;
    let pu, pv;
    if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; pu = du * k; pv = dv * k; }
    else {
      const ou = b.hu - Math.abs(lu) + r, ov = b.hv - Math.abs(lv) + r;
      if (ou < ov) { pu = Math.sign(lu || 1) * ou; pv = 0; } else { pv = Math.sign(lv || 1) * ov; pu = 0; }
    }
    const wx = pu * b.ux + pv * b.vx, wz = pu * b.uz + pv * b.vz;
    x += wx; z += wz; hit = true;
    const l = Math.hypot(wx, wz) || 1; nx = wx / l; nz = wz / l;
  }
  return { x, z, hit, nx, nz };
}

// Distance along a ray to the first wall (walks the grid cells the ray crosses, nearest first).
const stamp = new WeakMap(); let rayId = 0;
export function rayBuildings(ox, oy, oz, dx, dy, dz, maxT = 400) {
  rayId++;
  let best = maxT;
  const hl = Math.hypot(dx, dz);
  let i = Math.floor(ox / CELL), j = Math.floor(oz / CELL);
  const si = dx > 0 ? 1 : -1, sj = dz > 0 ? 1 : -1;
  const tdx = hl > 1e-9 && Math.abs(dx) > 1e-9 ? CELL / Math.abs(dx) : Infinity, tdz = hl > 1e-9 && Math.abs(dz) > 1e-9 ? CELL / Math.abs(dz) : Infinity;
  let tx = Math.abs(dx) > 1e-9 ? ((dx > 0 ? (i + 1) * CELL - ox : ox - i * CELL) / Math.abs(dx)) : Infinity;
  let tz = Math.abs(dz) > 1e-9 ? ((dz > 0 ? (j + 1) * CELL - oz : oz - j * CELL) / Math.abs(dz)) : Infinity;
  let tEnter = 0;
  for (let n = 0; n < 200 && tEnter < best; n++) {
    const arr = grid.get(key(i, j));
    if (arr) for (const b of arr) {
      if (stamp.get(b) === rayId) continue; stamp.set(b, rayId);
      const t = rayOBB(ox, oy, oz, dx, dy, dz, b.cx, b.y0 + b.h / 2, b.cz, b.ux, b.uz, b.hu, b.h / 2, b.vx, b.vz, b.hv);
      if (t < best) best = t;
    }
    if (tx < tz) { tEnter = tx; tx += tdx; i += si; } else { tEnter = tz; tz += tdz; j += sj; }
    if (tEnter === Infinity) break;
  }
  return best;
}
// First point where a ray dips under the ground (coarse march, then refine).
export function rayGround(ox, oy, oz, dx, dy, dz, maxT = 200) {
  let prevT = 0, step = 1.5;
  if (oy < terrainHeight(ox, oz)) return 0;
  for (let t = step; t <= maxT; t += step) {
    const y = oy + dy * t, g = terrainHeight(ox + dx * t, oz + dz * t);
    if (y < g) {
      let lo = prevT, hi = t;
      for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2; if (oy + dy * m < terrainHeight(ox + dx * m, oz + dz * m)) hi = m; else lo = m; }
      return hi;
    }
    prevT = t;
    if (dy > -0.02 && y - g > 60) break; // flying off into the sky
  }
  return Infinity;
}
export function lineOfSight(x1, y1, z1, x2, y2, z2) {
  const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1, l = Math.hypot(dx, dy, dz) || 1;
  if (rayBuildings(x1, y1, z1, dx / l, dy / l, dz / l, l) < l - 0.01) return false;
  // hills block the view too (checked at a few points)
  for (const k of [0.25, 0.5, 0.75]) if (y1 + dy * k < terrainHeight(x1 + dx * k, z1 + dz * k) - 0.5) return false;
  return true;
}
export { groundHeight };
