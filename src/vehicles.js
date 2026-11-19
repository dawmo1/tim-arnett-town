import * as THREE from 'three';
import { mat } from './character.js';
import * as W from './world.js';
import { rng, clamp } from './util.js';

export const TYPES = [
  { name: 'Sedan', len: 4.4, wid: 1.9, hgt: 1.45, max: 32, acc: 13, turn: 1.9, grip: 7, mass: 1.2, hp: 100 },
  { name: 'Sports car', len: 4.3, wid: 1.95, hgt: 1.15, max: 46, acc: 22, turn: 2.2, grip: 8.5, mass: 1.1, hp: 80 },
  { name: 'Truck', len: 5.8, wid: 2.3, hgt: 2.6, max: 25, acc: 8, turn: 1.4, grip: 6, mass: 2.6, hp: 180, truck: true },
  { name: 'Van', len: 5.0, wid: 2.1, hgt: 2.2, max: 28, acc: 10, turn: 1.6, grip: 6.5, mass: 2, hp: 140, van: true },
  { name: 'Motorbike', len: 2.1, wid: 0.8, hgt: 1.1, max: 44, acc: 20, turn: 2.6, grip: 9, mass: 0.45, hp: 50, bike: true },
  { name: 'Scooter', len: 1.8, wid: 0.7, hgt: 1.05, max: 22, acc: 12, turn: 2.8, grip: 9, mass: 0.3, hp: 40, bike: true },
  { name: 'Police car', len: 4.6, wid: 2.0, hgt: 1.5, max: 33, acc: 14, turn: 2.0, grip: 8, mass: 1.4, hp: 160, police: true },
];
export const POLICE = 6;
const CAR_COLORS = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0xecf0f1, 0x34495e, 0x9b59b6, 0xe67e22, 0x1abc9c, 0x161616, 0xff6fa8];

const box = new THREE.BoxGeometry(1, 1, 1);
const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10);
wheelGeo.rotateZ(Math.PI / 2);
function bx(g, c, sx, sy, sz, x, y, z, material) {
  const m = new THREE.Mesh(box, material || mat(c));
  m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
}

export function makeVehicleMesh(T, color) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const L = T.len, Wd = T.wid;
  const glass = 0x26323f;
  if (T.bike) {
    bx(body, color, 0.32, 0.35, L * 0.55, 0, 0.72, 0.05);
    bx(body, 0x1e1e1e, 0.34, 0.12, 0.65, 0, 0.95, -0.25);
    bx(body, 0x333333, 0.7, 0.06, 0.06, 0, 1.12, L * 0.33);
    bx(body, 0xffffcc, 0.18, 0.14, 0.05, 0, 0.95, L * 0.38);
    if (T.name === 'Scooter') bx(body, color, 0.4, 0.08, 0.7, 0, 0.42, 0.05);
    for (const z of [L / 2 - 0.35, -L / 2 + 0.35]) { const w = new THREE.Mesh(wheelGeo, mat(0x111111)); w.scale.set(0.5, 0.95, 0.95); w.position.set(0, 0.36, z); body.add(w); }
  } else if (T.truck) {
    bx(body, color, Wd, 1.7, 1.9, 0, 1.25, L / 2 - 0.95);
    bx(body, glass, Wd * 0.92, 0.65, 0.05, 0, 1.65, L / 2 + 0.01);
    bx(body, 0xf2f2f2, Wd + 0.05, 2.2, L - 2.1, 0, 1.55, -1.0);
    bx(body, 0x333333, Wd * 0.9, 0.3, L, 0, 0.45, 0);
  } else {
    const lower = T.hgt * 0.5;
    bx(body, color, Wd, lower, L, 0, 0.3 + lower / 2, 0);
    const cabLen = T.van ? L * 0.82 : L * 0.5, cabZ = T.van ? -L * 0.07 : -L * 0.06;
    bx(body, glass, Wd * 0.88, T.hgt * 0.42, cabLen, 0, 0.3 + lower + T.hgt * 0.21, cabZ);
    bx(body, color, Wd * 0.9, 0.07, cabLen + 0.02, 0, 0.3 + lower + T.hgt * 0.42, cabZ);
    if (T.van) bx(body, color, Wd * 0.9, T.hgt * 0.42, cabLen * 0.7, 0, 0.3 + lower + T.hgt * 0.21, cabZ - cabLen * 0.15);
    bx(body, 0xfff8c4, 0.35, 0.16, 0.05, Wd / 2 - 0.3, 0.3 + lower * 0.7, L / 2 + 0.01);
    bx(body, 0xfff8c4, 0.35, 0.16, 0.05, -Wd / 2 + 0.3, 0.3 + lower * 0.7, L / 2 + 0.01);
    bx(body, 0xd50000, 0.35, 0.14, 0.05, Wd / 2 - 0.3, 0.3 + lower * 0.7, -L / 2 - 0.01);
    bx(body, 0xd50000, 0.35, 0.14, 0.05, -Wd / 2 + 0.3, 0.3 + lower * 0.7, -L / 2 - 0.01);
    bx(body, 0x2b2b2b, Wd + 0.04, 0.22, 0.25, 0, 0.42, L / 2 - 0.05);   // bumpers
    bx(body, 0x2b2b2b, Wd + 0.04, 0.22, 0.25, 0, 0.42, -L / 2 + 0.05);
    bx(body, color, 0.12, 0.1, 0.2, Wd / 2 + 0.06, 0.3 + lower + 0.05, cabZ + cabLen / 2 - 0.2);  // mirrors
    bx(body, color, 0.12, 0.1, 0.2, -Wd / 2 - 0.06, 0.3 + lower + 0.05, cabZ + cabLen / 2 - 0.2);
    if (T.police) {
      bx(body, 0x111111, Wd + 0.01, lower * 0.5, L * 0.45, 0, 0.3 + lower * 0.5, 0);
      bx(body, 0xffd54f, 0.02, 0.25, 0.3, Wd / 2 + 0.01, 0.3 + lower * 0.55, 0); bx(body, 0xffd54f, 0.02, 0.25, 0.3, -Wd / 2 - 0.01, 0.3 + lower * 0.55, 0);
      const red = new THREE.MeshBasicMaterial({ color: 0xff1744 }), blue = new THREE.MeshBasicMaterial({ color: 0x2979ff });
      bx(body, 0, 0.6, 0.18, 0.3, 0.32, 0.3 + lower + T.hgt * 0.5, cabZ, red);
      bx(body, 0, 0.6, 0.18, 0.3, -0.32, 0.3 + lower + T.hgt * 0.5, cabZ, blue);
      g.userData.lights = [red, blue];
    }
  }
  if (!T.bike) {
    for (const sx of [1, -1]) for (const sz of [1, -1]) {
      const w = new THREE.Mesh(wheelGeo, mat(0x111111));
      w.position.set(sx * (Wd / 2 - 0.08), 0.36, sz * (L / 2 - (T.truck ? 1.0 : 0.85)));
      body.add(w);
      bx(body, 0xcfd8dc, 0.04, 0.34, 0.34, sx * (Wd / 2 + 0.06), 0.36, w.position.z);
    }
    // NPC driver head, shown for traffic and cops
    const head = bx(body, 0xe0ac69, 0.3, 0.3, 0.3, 0.42, 0.3 + T.hgt * 0.72, T.truck ? L / 2 - 0.9 : -0.1);
    head.visible = false;
    g.userData.driverHead = head;
  }
  g.userData.body = body;
  return g;
}

let burntMat = null;
export function charVehicle(v) {
  burntMat = burntMat || new THREE.MeshLambertMaterial({ color: 0x2b2b2b });
  v.mesh.userData.body.traverse((m) => { if (m.isMesh && !(m.material && m.material.isMeshBasicMaterial)) m.material = burntMat; });
}

export function makeVehicle(id, ti, color, home) {
  const T = TYPES[ti];
  return {
    id, ti, T, color, mesh: makeVehicleMesh(T, color),
    x: home.x, z: home.z, h: home.h, y: 0, vx: 0, vz: 0, speed: 0,
    hp: T.hp, driver: '', mode: 'parked', burnAt: 0, burnBy: '', exploded: false, sinkT: 0,
    home, tgt: null, lastWrite: 0, localSim: false, loop: null, slot: 0, charred: false, tilt: 0,
  };
}

export function circles(v) {
  const T = v.T, fx = Math.sin(v.h), fz = Math.cos(v.h);
  const off = T.bike ? 0.5 : T.len / 2 - T.wid / 2, r = T.bike ? 0.45 : T.wid / 2;
  return [{ x: v.x + fx * off, z: v.z + fz * off, r }, { x: v.x - fx * off, z: v.z - fz * off, r }];
}

// Arcade car physics. inp: {throttle, brake, steer, handbrake}. Returns impact speed against walls.
export function stepVehicle(v, inp, dt) {
  const T = v.T;
  const fx = Math.sin(v.h), fz = Math.cos(v.h), rx = -Math.cos(v.h), rz = Math.sin(v.h);
  let vf = v.vx * fx + v.vz * fz, vr = v.vx * rx + v.vz * rz;
  const alive = v.hp > 0 && v.sinkT === 0;
  if (alive && inp.throttle > 0) vf += T.acc * inp.throttle * dt * (vf < 0 ? 2.5 : 1);
  if (alive && inp.brake > 0) { if (vf > 0.5) vf -= T.acc * 2.4 * dt; else vf = Math.max(-T.max * 0.35, vf - T.acc * 0.7 * dt); }
  vf -= vf * ((inp.throttle || inp.brake) && alive ? 0.12 : 0.7) * dt;
  if (inp.handbrake) vf -= vf * 1.4 * dt;
  if (vf > T.max) vf = T.max;
  vr *= Math.exp(-(inp.handbrake ? 1.6 : T.grip) * dt);
  const yaw = alive ? (inp.steer || 0) * T.turn * clamp(vf / 5, -1, 1) * (1 - 0.35 * Math.min(1, Math.abs(vf) / T.max)) : 0;
  v.h += yaw * dt * (inp.handbrake ? 1.35 : 1);
  const nfx = Math.sin(v.h), nfz = Math.cos(v.h), nrx = -Math.cos(v.h), nrz = Math.sin(v.h);
  v.vx = nfx * vf + nrx * vr; v.vz = nfz * vf + nrz * vr;
  const ox = v.x, oz = v.z;
  v.x += v.vx * dt; v.z += v.vz * dt;
  v.speed = vf;
  v.slip = Math.abs(vr);
  v.tilt = T.bike ? clamp(-yaw * Math.abs(vf) * 0.03, -0.5, 0.5) : 0;
  let impact = 0;
  // ramps: hitting the tall end is a wall
  let gh = W.groundHeight(v.x, v.z);
  if (gh - v.y > 0.7) {
    impact = Math.hypot(v.vx, v.vz);
    v.x = ox; v.z = oz; v.vx *= -0.3; v.vz *= -0.3;
    gh = W.groundHeight(v.x, v.z);
  }
  for (const c of circles(v)) {
    const p = W.pushOutCircle(c.x, c.z, c.r);
    if (!p.hit) continue;
    v.x += p.x - c.x; v.z += p.z - c.z;
    const vn = v.vx * p.nx + v.vz * p.nz;
    if (vn < 0) { impact = Math.max(impact, -vn); v.vx -= p.nx * vn * 1.3; v.vz -= p.nz * vn * 1.3; }
  }
  v.landed = 0;
  if (!W.isLand(v.x, v.z) && v.y < 0.3) {
    v.sinkT += dt; v.vx *= Math.exp(-2.5 * dt); v.vz *= Math.exp(-2.5 * dt);
    v.y = -Math.min(2.2, v.sinkT * 0.8); v.vy = 0; v.air = 0;
  } else {
    v.sinkT = 0;
    const floor = W.isLand(v.x, v.z) ? gh : -5;
    if (v.y > floor + 0.05) {
      // airborne
      v.air = (v.air || 0) + dt;
      v.vy = (v.vy || 0) - 22 * dt;
      v.y += v.vy * dt;
      if (v.y <= floor) { v.landed = -v.vy; v.y = floor; v.vy = 0; }
    } else {
      // on the ground (or riding up a ramp): vertical speed follows the slope
      v.vy = dt > 0 ? (floor - v.y) / dt : 0;
      if (v.vy < 0) v.vy = 0;
      v.y = floor;
      v.lastAir = v.air || 0; v.air = 0;
    }
  }
  return impact;
}

// Resolve overlap between a locally simulated vehicle v and another vehicle o.
// If o is pushable, both move. Returns impact speed (0 if no contact).
export function collideVehicles(v, o, pushable) {
  let best = null;
  for (const a of circles(v)) for (const b of circles(o)) {
    const dx = a.x - b.x, dz = a.z - b.z, d = Math.hypot(dx, dz), pen = a.r + b.r - d;
    if (pen > 0 && (!best || pen > best.pen)) best = { pen, nx: d > 1e-6 ? dx / d : 1, nz: d > 1e-6 ? dz / d : 0 };
  }
  if (!best) return 0;
  const mv = v.T.mass, mo = pushable ? o.T.mass : 1e6, share = mo / (mv + mo);
  v.x += best.nx * best.pen * share; v.z += best.nz * best.pen * share;
  if (pushable) { o.x -= best.nx * best.pen * (1 - share); o.z -= best.nz * best.pen * (1 - share); }
  const rv = (v.vx - (o.vx || 0)) * best.nx + (v.vz - (o.vz || 0)) * best.nz;
  if (rv >= 0) return 0;
  const j = -rv * 1.2;
  v.vx += best.nx * j * share; v.vz += best.nz * j * share;
  if (pushable) { o.vx -= best.nx * j * (1 - share); o.vz -= best.nz * j * (1 - share); }
  return -rv;
}

// Push a walking character (circle) out of a vehicle.
export function pushCharOut(x, z, r, v) {
  for (const c of circles(v)) {
    const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), pen = r + c.r - d;
    if (pen > 0) { const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0; x += nx * pen; z += nz * pen; }
  }
  return { x, z };
}

// ---------- traffic loops (same on every computer, driven by the shared clock) ----------
export const LOOPS = [
  { s0: 25, s1: 1072, center: 0, lane: 3.5, speed: 12, count: 14 },
  { s0: 150, s1: 950, center: 48, lane: 2.5, speed: 9, count: 6 },
];
for (const lp of LOOPS) lp.len = 2 * (lp.s1 - lp.s0) + 2 * Math.PI * lp.lane;
export function loopPoint(lp, u) {
  u = ((u % lp.len) + lp.len) % lp.len;
  const S = lp.s1 - lp.s0, Tn = Math.PI * lp.lane;
  if (u < S) return W.P(lp.s0 + u, lp.center + lp.lane);
  u -= S;
  if (u < Tn) { const a = u / lp.lane; return W.P(lp.s1 + Math.sin(a) * lp.lane, lp.center + Math.cos(a) * lp.lane); }
  u -= Tn;
  if (u < S) return W.P(lp.s1 - u, lp.center - lp.lane);
  u -= S;
  const a = u / lp.lane;
  return W.P(lp.s0 - Math.sin(a) * lp.lane, lp.center - Math.cos(a) * lp.lane);
}
export function trafficPose(v, tSec) {
  const lp = v.loop;
  const u = lp.speed * tSec + (v.slot * lp.len) / lp.count;
  const a = loopPoint(lp, u), b = loopPoint(lp, u + 0.6);
  return { x: a.x, z: a.z, h: Math.atan2(b.x - a.x, b.z - a.z), vx: ((b.x - a.x) / 0.6) * lp.speed, vz: ((b.z - a.z) / 0.6) * lp.speed };
}

export function createAllVehicles(scene) {
  const r = rng(4242);
  const list = [];
  const parkedTypes = [0, 0, 0, 0, 1, 1, 1, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5];
  W.parkedSpots.forEach((sp, i) => {
    const ti = parkedTypes[Math.floor(r() * parkedTypes.length)];
    const v = makeVehicle('p' + i, ti, CAR_COLORS[Math.floor(r() * CAR_COLORS.length)], sp);
    list.push(v);
  });
  let n = 0;
  LOOPS.forEach((lp) => {
    for (let k = 0; k < lp.count; k++) {
      const ti = [0, 0, 0, 1, 3, 2][Math.floor(r() * 6)];
      const v = makeVehicle('t' + n++, ti, CAR_COLORS[Math.floor(r() * CAR_COLORS.length)], { x: 0, z: 0, h: 0 });
      v.mode = 'traffic'; v.loop = lp; v.slot = k;
      list.push(v);
    }
  });
  for (const v of list) scene.add(v.mesh);
  return list;
}
