// Taking cover, GTA-style. F next to (or looking at) something solid snaps you into cover behind it with a short
// dash: crouched behind low cover (cars, low walls, hedges, fences, planters, benches), standing flat against high
// cover (building walls, vans, trucks, bus shelters). In cover:
//  - A / D (whichever way is along the edge from the camera) shuffle along it; you stop at its ends, and a
//    straight wall made of several pieces (low walls) carries on to the next piece
//  - holding right click pops out to aim (up over low cover; round the corner at an end of high cover, or a step out
//    from the middle of it), letting go ducks back in; left click without aiming blind-fires over / round it
//  - F again while looking at other cover runs to it (crouched); F with nothing in view, or pulling away from the
//    cover, leaves it; Space at low cover vaults over it
//  - bullets from the far side hit the cover instead of you (blocks(): the shot line has to pass the cover's face
//    below its top), so it protects for real; popping out exposes you again
// The cover is a face of an oriented box: the city's wall boxes (src/city/collide.js), a parked car's footprint, or a
// street prop's circle (breakables.js coverProps). spotFor() finds cover for NPCs (gang gunmen) the same way.
import * as W from './world.js';
import { coverProps } from './breakables.js';
import { angDiff } from './util.js';

const R = 0.42;        // standoff from the cover face (about the body's radius)
const MIN_H = 0.75;    // lower than this (above your feet) isn't cover
const LOW_MAX = 1.55;  // up to this: crouch behind it; higher: stand flat against it
const PROP_H = { bench: 0.85, planter: 0.9, hedge: 1.3, picket: 1.1, busstop: 2.4, mailbox: 1.25, newsbox: 1.1, bin: 1.0, ruralbox: 1.2, menuboard: 1.5 };

let ctx = { vehicles: () => [], myVeh: () => null, sound: () => {} };
export function initCover(c) { Object.assign(ctx, c); }

// phase: 'move' (the dash in) | 'swap' (running to the next cover) | 'in'
const S = { on: false, phase: '', t: 0, dur: 0, from: null, to: null, f: null, s: 0, side: 1, peek: 0, blindT: 0, hit: 0, backT: 0, edge: 0, stuck: 0, base: null };
export const active = () => S.on;
export const inCover = () => S.on && S.phase === 'in';
export const peeking = () => S.on && S.phase === 'in' && S.peek > 0.5;
export const isHigh = () => !!S.f && S.f.high;
export function leave() { S.on = false; S.phase = ''; S.f = null; S.peek = 0; S.blindT = 0; }

// ---------- faces ----------
// The face of an oriented box (centre c, axes u and v with half sizes) that looks toward point p.
// n: outward normal, a: along the face, off: distance of the face from the centre, [lo, hi]: its extent along a,
// s: p's position along a, d: p's distance in front of the face
function obbFace(kind, ref, cx, cz, ux, uz, hu, vx, vz, hv, y0, top, px, pz) {
  const dx = px - cx, dz = pz - cz, lu = dx * ux + dz * uz, lv = dx * vx + dz * vz;
  let f;
  if (Math.abs(lu) - hu >= Math.abs(lv) - hv) { const g = Math.sign(lu) || 1; f = { nx: ux * g, nz: uz * g, ax: vx, az: vz, off: hu, lo: -hv, hi: hv, s: lv, d: Math.abs(lu) - hu, axis: 0, g }; }
  else { const g = Math.sign(lv) || 1; f = { nx: vx * g, nz: vz * g, ax: ux, az: uz, off: hv, lo: -hu, hi: hu, s: lu, d: Math.abs(lv) - hv, axis: 1, g }; }
  f.kind = kind; f.ref = ref; f.cx = cx; f.cz = cz; f.y0 = y0; f.top = top;
  return f;
}
const vehAxes = (v) => [Math.cos(v.h), -Math.sin(v.h), v.T.wid / 2, Math.sin(v.h), Math.cos(v.h), v.T.len / 2];
const vehOK = (v) => !(v.T.bike || v.T.heli || v.T.boat || v.T.plane) && !(v.sinkT > 0) && Math.hypot(v.vx || 0, v.vz || 0) < 1.5 && v !== ctx.myVeh();
function vehFace(v, px, pz) { const [ux, uz, hu, vx, vz, hv] = vehAxes(v); return obbFace('veh', v, v.x, v.z, ux, uz, hu, vx, vz, hv, v.y, v.y + v.T.hgt, px, pz); }
function propFace(p, px, pz) {
  const dx = px - p.x, dz = pz - p.z, l = Math.hypot(dx, dz) || 1, nx = dx / l, nz = dz / l, r = p.r * 0.75;
  return { kind: 'prop', ref: p.ref, cx: p.x, cz: p.z, nx, nz, ax: -nz, az: nx, off: r, lo: -r, hi: r, s: 0, d: l - r, y0: p.y, top: p.y + (PROP_H[p.kind] || 1) };
}
// every face within r of (x, z) that's tall enough to hide behind for someone standing at height y
function faces(x, z, y, r, px = x, pz = z) {
  const out = [];
  for (const b of W.boxesNear(x, z, r)) {
    const top = b.y0 + b.h;
    if (top - y < MIN_H || b.y0 > y + 0.6 || Math.max(b.hu, b.hv) < 0.3) continue; // too low, overhead, or a pole
    out.push(obbFace('box', b, b.cx, b.cz, b.ux, b.uz, b.hu, b.vx, b.vz, b.hv, b.y0, top, px, pz));
  }
  for (const v of ctx.vehicles()) {
    if (!v || Math.abs(v.x - x) > r + 6 || Math.abs(v.z - z) > r + 6 || !vehOK(v)) continue;
    const f = vehFace(v, px, pz); if (f.top - y >= MIN_H) out.push(f);
  }
  for (const p of coverProps(x, z, r)) { const f = propFace(p, px, pz); if (f.top - y >= MIN_H) out.push(f); }
  for (const f of out) f.high = f.top - y > LOW_MAX;
  return out;
}
const clampS = (f, s) => (f.hi - f.lo < 0.5 ? (f.lo + f.hi) / 2 : Math.max(f.lo + 0.22, Math.min(f.hi - 0.22, s)));
const spot = (f, s, extra = 0) => ({ x: f.cx + f.nx * (f.off + R + extra) + f.ax * s, z: f.cz + f.nz * (f.off + R + extra) + f.az * s });
// can you stand at p (land, not inside a wall, about the same height) and get there from (x, y, z) in a straight line?
function reachable(x, y, z, p) {
  if (!W.isLand(p.x, p.z) || W.offMap(p.x, p.z)) return false;
  if (Math.abs(W.groundHeight(p.x, p.z) - y) > 0.9) return false;
  const q = W.pushOutCircle(p.x, p.z, R - 0.08, y);
  if (Math.hypot(q.x - p.x, q.z - p.z) > 0.25) return false;
  const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz);
  return d < 0.3 || W.rayBuildings(x, y + 0.6, z, dx / d, 0, dz / d, d) >= d - 0.3;
}
// sameFace: is f the face we're on now
const sameFace = (f) => !!S.f && f.ref === S.f.ref && f.nx * S.f.nx + f.nz * S.f.nz > 0.9;

// ---------- entering / swapping ----------
// F pressed. me: {x, y, z}; (cfx, cfz): the camera's flat look direction. Returns true if something happened.
export function press(me, cfx, cfz) {
  if (S.on && S.phase === 'in') {
    const t = pick(me, cfx, cfz, true);
    if (!t) { leave(); return true; }
    S.phase = 'swap'; S.f = t.f; S.s = t.s; S.from = { x: me.x, z: me.z }; S.to = { x: t.x, z: t.z }; S.t = 0; S.stuck = 0; S.peek = 0;
    S.side = sideFor(t.f, cfx, cfz, me);
    return true;
  }
  if (S.on) { leave(); return true; }
  const t = pick(me, cfx, cfz, false);
  if (!t) return false;
  const d = Math.hypot(t.x - me.x, t.z - me.z);
  Object.assign(S, { on: true, phase: 'move', t: 0, dur: Math.max(0.16, Math.min(0.55, d / 6.5)), from: { x: me.x, z: me.z }, to: { x: t.x, z: t.z }, f: t.f, s: t.s, peek: 0, blindT: 0, hit: 0, backT: 0, edge: 0 });
  S.side = sideFor(t.f, cfx, cfz, me);
  return true;
}
function sideFor(f, cfx, cfz, me) {
  const a = cfx * f.ax + cfz * f.az;
  if (Math.abs(a) > 0.2) return Math.sign(a);
  const p = spot(f, S.s);
  return Math.sign((me.x - p.x) * f.ax + (me.z - p.z) * f.az) || 1;
}
// best cover: next to you / in front of you (swap = false), or the one you're looking at 2-13 m away (swap = true)
function pick(me, cfx, cfz, swap) {
  let best = null, bs = 1e9;
  const cx = swap ? me.x + cfx * 7 : me.x, cz = swap ? me.z + cfz * 7 : me.z;
  for (const f of faces(cx, cz, me.y, swap ? 8 : 3.4, me.x, me.z)) {
    if (f.d < -0.05) continue; // (inside it)
    if (swap && sameFace(f)) continue;
    const s = clampS(f, f.s), p = spot(f, s), dx = p.x - me.x, dz = p.z - me.z, d = Math.hypot(dx, dz);
    const look = -(cfx * f.nx + cfz * f.nz); // > 0: facing the cover
    let sc;
    if (swap) {
      if (d < 2 || d > 13) continue;
      const ang = Math.abs(angDiff(Math.atan2(cfx, cfz), Math.atan2(dx, dz)));
      if (ang > 0.42 || look < -0.2) continue;
      sc = ang * 8 + d * 0.15;
    } else {
      if (d > 3.2 || (d > 1.3 && look < 0.35)) continue;
      sc = d - look * 1.2 + (f.kind === 'prop' ? 0.4 : 0);
    }
    if (sc >= bs || !reachable(me.x, me.y, me.z, p)) continue;
    bs = sc; best = { f, s, x: p.x, z: p.z };
  }
  return best;
}

// ---------- in cover ----------
// keep a car's face where the car is now; false = the cover's gone (drove off, wrecked, prop knocked over)
function refresh() {
  const f = S.f;
  if (f.kind === 'veh') {
    const v = f.ref;
    if (!vehOK(v) || v.exploded) return false;
    const [ux, uz, hu, vx, vz, hv] = vehAxes(v), g = f.g;
    if (f.axis === 0) Object.assign(f, { nx: ux * g, nz: uz * g, ax: vx, az: vz, off: hu, lo: -hv, hi: hv });
    else Object.assign(f, { nx: vx * g, nz: vz * g, ax: ux, az: uz, off: hv, lo: -hu, hi: hu });
    f.cx = v.x; f.cz = v.z; f.y0 = v.y; f.top = v.y + v.T.hgt;
  } else if (f.kind === 'prop' && f.ref.broken) return false;
  return true;
}
// a low wall in pieces: the next piece in line, past the end we're pushing toward
function chain(dir, y) {
  const f = S.f;
  if (f.kind !== 'box') return false;
  const p = spot(f, S.s + dir * 0.45);
  for (const g of faces(p.x, p.z, y, 1.2, p.x, p.z)) {
    if (g.kind !== 'box' || g.ref === f.ref || g.nx * f.nx + g.nz * f.nz < 0.94 || g.d < R - 0.25 || g.d > R + 0.3) continue;
    if (g.s < g.lo - 0.05 || g.s > g.hi + 0.05) continue;
    S.f = g; S.s = clampS(g, g.s);
    return true;
  }
  return false;
}
// one frame in cover. i: { x, y, z, mx, mz (camera-relative move, length 0..1), cfx, cfz, aiming, gun, jump }
// Returns { x, z, h, speed, pose: st fields for animateCharacter, aimOut, vault, left }
export function update(dt, i) {
  S.blindT = Math.max(0, S.blindT - dt); S.hit = Math.max(0, S.hit - dt * 4);
  if (S.f && !refresh()) { leave(); return { left: true }; }
  const f = S.f;
  if (S.phase === 'move' || S.phase === 'swap') {
    let x, z, sp;
    const to = S.phase === 'swap' ? spot(f, S.s) : S.to;
    if (S.phase === 'move') {
      S.t += dt;
      const k = Math.min(1, S.t / S.dur), e = k * k * (3 - 2 * k);
      x = S.from.x + (to.x - S.from.x) * e; z = S.from.z + (to.z - S.from.z) * e;
      sp = Math.hypot(to.x - S.from.x, to.z - S.from.z) / S.dur;
      if (k >= 1) arrive();
    } else { // a crouched sprint to the new cover
      const dx = to.x - i.x, dz = to.z - i.z, d = Math.hypot(dx, dz), st = Math.min(d, 6.2 * dt);
      const q = W.pushOutCircle(i.x + (dx / (d || 1)) * st, i.z + (dz / (d || 1)) * st, 0.4, i.y);
      x = q.x; z = q.z; sp = 6.2;
      S.stuck = Math.hypot(x - i.x, z - i.z) < st * 0.3 ? S.stuck + dt : 0;
      if (S.stuck > 0.35 || i.mx * dx + i.mz * dz < -0.5 * d) { leave(); return { x, z, left: true }; } // blocked, or you pulled back
      if (d < 0.12) { x = to.x; z = to.z; arrive(); }
    }
    return { x, z, h: Math.atan2(to.x - i.x, to.z - i.z) || 0, speed: sp, pose: { crouch: true } };
  }
  // ---- in ----
  const lat = i.mx * f.ax + i.mz * f.az, away = i.mx * f.nx + i.mz * f.nz;
  S.backT = away > 0.65 && Math.abs(lat) < 0.55 ? S.backT + dt : 0;
  if (S.backT > 0.2) { leave(); return { left: true }; } // stepped away from it
  const want = i.aiming && i.gun ? 1 : 0;
  S.peek += (want - S.peek) * Math.min(1, dt * 11);
  if (Math.abs(S.peek - want) < 0.02) S.peek = want;
  let speed = 0;
  if (Math.abs(lat) > 0.3 && S.peek < 0.3) {
    const dir = Math.sign(lat), v = (f.high ? 2.3 : 1.9) * Math.min(1, Math.abs(lat) * 1.3), lo = clampS(f, -1e9), hi = clampS(f, 1e9);
    S.side = dir;
    const ns = S.s + dir * v * dt;
    if ((ns > hi && !(dir > 0 && chain(1, i.y))) || (ns < lo && !(dir < 0 && chain(-1, i.y)))) S.s = Math.max(lo, Math.min(hi, ns));
    else if (S.f === f) { S.s = ns; speed = v; }
  }
  const g = S.f, lo = clampS(g, -1e9), hi = clampS(g, 1e9);
  S.edge = S.s >= hi - 0.02 ? 1 : S.s <= lo + 0.02 ? -1 : 0;
  if (hi - lo < 0.05) S.edge = S.side; // a narrow pillar or post: lean out either side
  if (i.jump && !g.high && S.peek < 0.3) { const h = Math.atan2(-g.nx, -g.nz); leave(); return { vault: true, h, left: true }; }
  const base = spot(g, S.s);
  let ox = 0, oz = 0;
  if (g.high && S.peek > 0) {
    const e = S.edge || 0;
    if (e) { ox = g.ax * e * 0.62 + g.nx * 0.12; oz = g.az * e * 0.62 + g.nz * 0.12; } // round the corner
    else { ox = g.nx * 0.75; oz = g.nz * 0.75; } // a step out from the wall
  }
  const x = base.x + ox * S.peek, z = base.z + oz * S.peek;
  const h = Math.atan2(g.ax * S.side, g.az * S.side);
  const wall = (-g.nx * Math.cos(h) + -g.nz * -Math.sin(h)) >= 0 ? 1 : -1; // the cover is on the body's left (+1) or right
  S.base = base;
  return { x, z, h, speed, aimOut: S.peek > 0.55, pose: { coverPose: { high: g.high, wall, peek: S.peek, blind: S.blindT > 0 ? 1 : 0, hit: S.hit, edge: S.edge * S.side } } };
}
function arrive() { S.phase = 'in'; S.hit = 1; S.backT = 0; ctx.sound(S.f.kind); }
// a blind-fire shot went off (the pose holds the gun up over / round the cover for a moment)
export function blindShot() { S.blindT = 0.42; }
export const blind = () => S.on && S.phase === 'in' && S.peek < 0.3;
// what to send to other players (anim.js codes): { n, k, side } or null
export function netAct() {
  if (!inCover()) return null;
  const hi = S.f.high, n = S.blindT > 0 ? (hi ? 'coverBlindHigh' : 'coverBlindLow') : hi ? 'coverHigh' : 'coverLow';
  const h = Math.atan2(S.f.ax * S.side, S.f.az * S.side), wall = (-S.f.nx * Math.cos(h) + -S.f.nz * -Math.sin(h)) >= 0 ? 1 : -1;
  return { n, k: Math.min(0.99, Math.round(S.peek * 100) / 100), side: wall };
}

// ---------- bullets ----------
// Does a shot from (sx, sy, sz) at someone standing at (x, y, z) behind face f hit the cover first? The shot line from
// their chest (crouched: lower) has to cross the face's plane inside its ends and below its top. Returns the point
// where it hits the cover, or null.
function faceBlocks(f, x, y, z, chest, sx, sy, sz) {
  const dp = (x - f.cx) * f.nx + (z - f.cz) * f.nz - f.off, ds = (sx - f.cx) * f.nx + (sz - f.cz) * f.nz - f.off;
  if (dp <= 0 || ds >= -0.05) return null; // shooter on your side of it
  const t = dp / (dp - ds);
  const px = x + (sx - x) * t, pz = z + (sz - z) * t, py = y + chest + (sy - y - chest) * t;
  const along = (px - f.cx) * f.ax + (pz - f.cz) * f.az;
  if (along < f.lo - 0.08 || along > f.hi + 0.08 || py > f.top + 0.05 || py < f.y0 - 0.2) return null;
  return { x: px, y: py, z: pz, nx: f.nx, nz: f.nz, metal: f.kind === 'veh' };
}
// the player in cover: me {x, y, z}
export function blocks(me, sx, sy, sz) {
  if (!S.on || S.phase !== 'in' || !S.f) return null;
  const chest = S.f.high ? 1.25 : S.peek > 0.5 ? 1.6 : 0.75; // popped up: head and shoulders over the top
  return faceBlocks(S.f, me.x, me.y, me.z, chest, sx, sy, sz);
}
// someone else crouched at (x, y, z) behind whatever's between them and the shooter (NPCs in cover)
export function blocksAt(x, y, z, chest, sx, sy, sz) {
  for (const f of faces(x, z, y, 1.4)) {
    if (f.d > R + 0.45) continue;
    const p = faceBlocks(f, x, y, z, chest, sx, sy, sz); if (p) return p;
  }
  return null;
}

// ---------- cover for NPCs ----------
// A spot within r of (x, z) with something solid between it and the threat at (tx, tz): { x, z, high } or null.
export function spotFor(x, z, y, tx, tz, r = 11) {
  let best = null, bs = 1e9;
  const away = (cx, cz) => { const dx = cx - tx, dz = cz - tz, l = Math.hypot(dx, dz) || 1; return [cx + (dx / l) * 50, cz + (dz / l) * 50]; };
  for (const g of faces(x, z, y, r)) {
    const [qx, qz] = away(g.cx, g.cz);
    const f = g.kind === 'veh' ? vehFace(g.ref, qx, qz) : g.kind === 'prop' ? propFace({ ref: g.ref, x: g.cx, z: g.cz, y: g.y0, r: g.off / 0.75, kind: '' }, qx, qz) : obbFace('box', g.ref, g.cx, g.cz, g.ref.ux, g.ref.uz, g.ref.hu, g.ref.vx, g.ref.vz, g.ref.hv, g.y0, g.top, qx, qz);
    f.top = g.top; f.high = g.high;
    if (f.kind === 'box' && f.hi - f.lo > 30) continue; // a whole building side: too far round to be useful
    const s = clampS(f, ((x - f.cx) * f.ax + (z - f.cz) * f.az)), p = spot(f, s), d = Math.hypot(p.x - x, p.z - z);
    if (d > r || Math.hypot(p.x - tx, p.z - tz) < 6) continue;
    if (!faceBlocks(f, p.x, y, p.z, 0.75, tx, y + 1.3, tz)) continue; // it has to actually be between them
    const sc = d + (f.high ? 1.5 : 0);
    if (sc < bs && reachable(p.x, y, p.z, p)) { bs = sc; best = { x: p.x, z: p.z, high: f.high, nx: f.nx, nz: f.nz }; }
  }
  return best;
}
