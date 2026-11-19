import * as THREE from 'three';
import { mat } from './character.js';
import * as W from './world.js';
import { rng, clamp } from './util.js';
import * as fx from './fx.js';

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
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x26323f });
  const parts = { wheels: [], glassMat, crushF: 0, crushB: 0 };
  if (T.bike) {
    bx(body, color, 0.32, 0.35, L * 0.55, 0, 0.72, 0.05);
    bx(body, 0x1e1e1e, 0.34, 0.12, 0.65, 0, 0.95, -0.25);
    bx(body, 0x333333, 0.7, 0.06, 0.06, 0, 1.12, L * 0.33);
    bx(body, 0xffffcc, 0.18, 0.14, 0.05, 0, 0.95, L * 0.38);
    if (T.name === 'Scooter') bx(body, color, 0.4, 0.08, 0.7, 0, 0.42, 0.05);
    for (const z of [L / 2 - 0.35, -L / 2 + 0.35]) { const w = new THREE.Mesh(wheelGeo, mat(0x111111)); w.scale.set(0.5, 0.95, 0.95); w.position.set(0, 0.36, z); body.add(w); parts.wheels.push(w); }
  } else if (T.truck) {
    const fg = new THREE.Group(); fg.position.z = L / 2; body.add(fg); parts.frontG = fg;
    parts.hood = bx(fg, color, Wd, 1.7, 1.9, 0, 1.25, -0.95);
    bx(fg, 0x26323f, Wd * 0.92, 0.65, 0.05, 0, 1.65, 0.01, glassMat);
    parts.bumpF = bx(fg, 0x2b2b2b, Wd + 0.04, 0.3, 0.25, 0, 0.5, 0.05);
    bx(body, 0xf2f2f2, Wd + 0.05, 2.2, L - 2.1, 0, 1.55, -1.0);
    bx(body, 0x333333, Wd * 0.9, 0.3, L, 0, 0.45, 0);
    parts.segL = 1.9;
  } else {
    const lower = T.hgt * 0.5, yb = 0.3 + lower / 2, segL = L * 0.28;
    parts.segL = segL;
    // front crumple zone: hood, headlights and bumper move together
    const fg = new THREE.Group(); fg.position.z = L / 2; body.add(fg); parts.frontG = fg;
    parts.hood = bx(fg, color, Wd, lower, segL, 0, yb, -segL / 2);
    bx(fg, 0xfff8c4, 0.35, 0.16, 0.05, Wd / 2 - 0.3, 0.3 + lower * 0.7, 0.01);
    bx(fg, 0xfff8c4, 0.35, 0.16, 0.05, -Wd / 2 + 0.3, 0.3 + lower * 0.7, 0.01);
    parts.bumpF = bx(fg, 0x2b2b2b, Wd + 0.04, 0.22, 0.25, 0, 0.42, -0.05);
    // rear crumple zone
    const rg = new THREE.Group(); rg.position.z = -L / 2; body.add(rg); parts.rearG = rg;
    parts.trunk = bx(rg, color, Wd, lower, segL, 0, yb, segL / 2);
    bx(rg, 0xd50000, 0.35, 0.14, 0.05, Wd / 2 - 0.3, 0.3 + lower * 0.7, -0.01);
    bx(rg, 0xd50000, 0.35, 0.14, 0.05, -Wd / 2 + 0.3, 0.3 + lower * 0.7, -0.01);
    parts.bumpR = bx(rg, 0x2b2b2b, Wd + 0.04, 0.22, 0.25, 0, 0.42, 0.05);
    // middle + doors
    const midL = L - 2 * segL;
    bx(body, color, Wd - 0.12, lower, midL, 0, yb, 0);
    const doorLen = midL * 0.95;
    const dl = new THREE.Group(); dl.position.set(Wd / 2 - 0.05, yb, doorLen / 2); body.add(dl);
    bx(dl, color, 0.1, lower, doorLen, 0, 0, -doorLen / 2);
    parts.doorL = dl;
    parts.doorR = bx(body, color, 0.1, lower, doorLen, -Wd / 2 + 0.05, yb, 0);
    const cabLen = T.van ? L * 0.82 : L * 0.5, cabZ = T.van ? -L * 0.07 : -L * 0.06;
    bx(body, 0, Wd * 0.88, T.hgt * 0.42, cabLen, 0, 0.3 + lower + T.hgt * 0.21, cabZ, glassMat);
    bx(body, color, Wd * 0.9, 0.07, cabLen + 0.02, 0, 0.3 + lower + T.hgt * 0.42, cabZ);
    if (T.van) bx(body, color, Wd * 0.9, T.hgt * 0.42, cabLen * 0.7, 0, 0.3 + lower + T.hgt * 0.21, cabZ - cabLen * 0.15);
    bx(body, color, 0.12, 0.1, 0.2, Wd / 2 + 0.06, 0.3 + lower + 0.05, cabZ + cabLen / 2 - 0.2);
    bx(body, color, 0.12, 0.1, 0.2, -Wd / 2 - 0.06, 0.3 + lower + 0.05, cabZ + cabLen / 2 - 0.2);
    if (T.police) {
      bx(body, 0x111111, Wd + 0.01, lower * 0.5, midL, 0, 0.3 + lower * 0.5, 0);
      bx(body, 0xffd54f, 0.02, 0.25, 0.3, Wd / 2 + 0.01, 0.3 + lower * 0.55, 0); bx(body, 0xffd54f, 0.02, 0.25, 0.3, -Wd / 2 - 0.01, 0.3 + lower * 0.55, 0);
      const red = new THREE.MeshBasicMaterial({ color: 0xff1744 }), blue = new THREE.MeshBasicMaterial({ color: 0x2979ff });
      bx(body, 0, 0.6, 0.18, 0.3, 0.32, 0.3 + lower + T.hgt * 0.5, cabZ, red);
      bx(body, 0, 0.6, 0.18, 0.3, -0.32, 0.3 + lower + T.hgt * 0.5, cabZ, blue);
      g.userData.lights = [red, blue];
    }
  }
  if (!T.bike) {
    for (const sx of [1, -1]) for (const sz of [1, -1]) {
      const w = new THREE.Group();
      w.position.set(sx * (Wd / 2 - 0.08), 0.36, sz * (L / 2 - (T.truck ? 1.0 : 0.85)));
      const tire = new THREE.Mesh(wheelGeo, mat(0x111111)); tire.castShadow = true; w.add(tire);
      bx(w, 0xcfd8dc, 0.04, 0.34, 0.34, sx * 0.14, 0, 0);
      body.add(w); parts.wheels.push(w);
    }
    // driver head: shown for traffic, cops and players
    const head = bx(body, 0xe0ac69, 0.3, 0.3, 0.3, 0.42, 0.3 + T.hgt * 0.72, T.truck ? L / 2 - 0.9 : -0.1);
    head.visible = false;
    g.userData.driverHead = head;
  }
  g.userData.body = body;
  g.userData.parts = parts;
  return g;
}

let burntMat = null;
export function charVehicle(v) {
  burntMat = burntMat || new THREE.MeshLambertMaterial({ color: 0x2b2b2b });
  v.mesh.userData.body.traverse((m) => { if (m.isMesh && !(m.material && m.material.isMeshBasicMaterial)) m.material = burntMat; });
  // wheels fly off
  const parts = v.mesh.userData.parts;
  for (const w of parts.wheels) launchPart(v, w, 6);
  parts.wheels = [];
}

export function makeVehicle(id, ti, color, home) {
  const T = TYPES[ti];
  return {
    id, ti, T, color, mesh: makeVehicleMesh(T, color),
    x: home.x, z: home.z, h: home.h, y: 0, vx: 0, vz: 0, w: 0, speed: 0,
    hp: T.hp, driver: '', mode: 'parked', burnAt: 0, burnBy: '', exploded: false, sinkT: 0,
    home, tgt: null, lastWrite: 0, localSim: false, loop: null, slot: 0, charred: false, tilt: 0,
    dz: { f: 0, b: 0, l: 0, r: 0 }, hit: null,
  };
}

// ---------- damage you can see ----------
const crackTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#3a4a5a'; x.fillRect(0, 0, 64, 64);
  x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 1.5;
  for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(32, 32); x.lineTo(Math.random() * 64, Math.random() * 64); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
// Knock a mesh off the car and send it flying as debris.
function launchPart(v, m, power) {
  if (!m || !m.parent) return;
  m.updateWorldMatrix(true, false);
  const p = new THREE.Vector3(); m.getWorldPosition(p);
  const q = new THREE.Quaternion(); m.getWorldQuaternion(q);
  const s = new THREE.Vector3(); m.getWorldScale(s);
  m.parent.remove(m);
  m.position.copy(p); m.quaternion.copy(q); m.scale.copy(s);
  fx.debris(m, (v.vx || 0) * 0.6 + (Math.random() - 0.5) * power, 2 + Math.random() * power * 0.6, (v.vz || 0) * 0.6 + (Math.random() - 0.5) * power);
}
// Record an impact at world point (px, pz) and update the dents.
export function damageZone(v, px, pz, imp) {
  if (v.T.bike || imp < 4) return;
  const fx = Math.sin(v.h), fz = Math.cos(v.h), rx = -Math.cos(v.h), rz = Math.sin(v.h);
  const lf = (px - v.x) * fx + (pz - v.z) * fz, lr = (px - v.x) * rx + (pz - v.z) * rz;
  const zone = Math.abs(lf) / v.T.len > Math.abs(lr) / v.T.wid ? (lf > 0 ? 'f' : 'b') : lr > 0 ? 'r' : 'l';
  v.dz[zone] += imp;
  applyDamageVisual(v);
}
export function applyDamageVisual(v) {
  const P = v.mesh.userData.parts;
  if (!P || v.T.bike) return;
  const k = (z) => Math.min(1, v.dz[z] / 45);
  const segL = P.segL;
  if (P.frontG) {
    const d = k('f');
    P.frontG.position.z = v.T.len / 2 - segL * 0.5 * d;
    P.hood.scale.z = segL * (1 - 0.5 * d); P.hood.position.z = -P.hood.scale.z / 2;
    P.hood.rotation.x = -0.18 * d;
    if (d > 0.45 && P.bumpF) { launchPart(v, P.bumpF, 4); P.bumpF = null; }
    if (d > 0.8 && P.hood.parent && !v.T.truck && !P.hoodGone) { P.hoodGone = true; P.hood.rotation.x = -0.6; }
  }
  if (P.rearG) {
    const d = k('b');
    P.rearG.position.z = -v.T.len / 2 + segL * 0.5 * d;
    P.trunk.scale.z = segL * (1 - 0.5 * d); P.trunk.position.z = P.trunk.scale.z / 2;
    P.trunk.rotation.x = 0.18 * d;
    if (d > 0.45 && P.bumpR) { launchPart(v, P.bumpR, 4); P.bumpR = null; }
  }
  if (P.doorL) { const d = k('l'); P.doorL.position.x = v.T.wid / 2 - 0.05 - 0.2 * d; P.doorL.rotation.z = 0.12 * d; }
  if (P.doorR) { const d = k('r'); P.doorR.position.x = -v.T.wid / 2 + 0.05 + 0.2 * d; P.doorR.rotation.z = -0.12 * d; }
  const total = v.dz.f + v.dz.b + v.dz.l + v.dz.r;
  if (total > 30 && !P.cracked) { P.cracked = true; P.glassMat.map = crackTex; P.glassMat.color.setHex(0xffffff); P.glassMat.needsUpdate = true; }
  if (total > 70 && !P.shattered) {
    P.shattered = true; P.glassMat.map = null; P.glassMat.color.setHex(0x0e1318); P.glassMat.needsUpdate = true;
    fx.glass(v.x, v.y + v.T.hgt, v.z, 18);
  }
}

export function circles(v) {
  const T = v.T, fx = Math.sin(v.h), fz = Math.cos(v.h);
  const off = T.bike ? 0.5 : T.len / 2 - T.wid / 2, r = T.bike ? 0.45 : T.wid / 2;
  return [{ x: v.x + fx * off, z: v.z + fz * off, r }, { x: v.x - fx * off, z: v.z - fz * off, r }];
}

// ---------- oriented boxes (separating axis test) ----------
export function boxOf(v) {
  const fx = Math.sin(v.h), fz = Math.cos(v.h);
  return { x: v.x, z: v.z, ax: fx, az: fz, ha: v.T.len / 2, bx: -fz, bz: fx, hb: v.T.wid / 2 };
}
const boxOfWall = (b) => ({ x: b.cx, z: b.cz, ax: b.vx, az: b.vz, ha: b.hv, bx: b.ux, bz: b.uz, hb: b.hu });
// Returns {depth, nx, nz} with the normal pointing from B to A, or null.
function sat(A, B) {
  const dx = A.x - B.x, dz = A.z - B.z;
  let best = null;
  for (const [nx, nz] of [[A.ax, A.az], [A.bx, A.bz], [B.ax, B.az], [B.bx, B.bz]]) {
    const ra = A.ha * Math.abs(A.ax * nx + A.az * nz) + A.hb * Math.abs(A.bx * nx + A.bz * nz);
    const rb = B.ha * Math.abs(B.ax * nx + B.az * nz) + B.hb * Math.abs(B.bx * nx + B.bz * nz);
    const d = dx * nx + dz * nz, o = ra + rb - Math.abs(d);
    if (o <= 0) return null;
    if (!best || o < best.depth) best = { depth: o, nx: d < 0 ? -nx : nx, nz: d < 0 ? -nz : nz };
  }
  return best;
}
function corners(B) {
  const out = [];
  for (const a of [1, -1]) for (const b of [1, -1]) out.push([B.x + B.ax * B.ha * a + B.bx * B.hb * b, B.z + B.az * B.ha * a + B.bz * B.hb * b]);
  return out;
}
function inside(B, x, z) {
  const dx = x - B.x, dz = z - B.z;
  return Math.abs(dx * B.ax + dz * B.az) <= B.ha + 0.05 && Math.abs(dx * B.bx + dz * B.bz) <= B.hb + 0.05;
}
function contactPoint(A, B) {
  let x = 0, z = 0, n = 0;
  for (const c of corners(A)) if (inside(B, c[0], c[1])) { x += c[0]; z += c[1]; n++; }
  for (const c of corners(B)) if (inside(A, c[0], c[1])) { x += c[0]; z += c[1]; n++; }
  return n ? [x / n, z / n] : [(A.x + B.x) / 2, (A.z + B.z) / 2];
}
const inertia = (T) => (T.mass * (T.len * T.len + T.wid * T.wid)) / 12;
// Rigid-body impulse between a and b (b may be null = wall, or static = can't move it here).
// Velocity of a body point: v + w * (rz, -rx), matching how heading h turns.
function resolve(a, b, c, cp, bStatic) {
  const ima = 1 / a.T.mass, iIa = 1 / inertia(a.T);
  const dyn = b && !bStatic;
  const imb = dyn ? 1 / b.T.mass : 0, iIb = dyn ? 1 / inertia(b.T) : 0;
  const share = ima / (ima + imb);
  a.x += c.nx * c.depth * share; a.z += c.nz * c.depth * share;
  if (dyn) { b.x -= c.nx * c.depth * (1 - share); b.z -= c.nz * c.depth * (1 - share); }
  const rax = cp[0] - a.x, raz = cp[1] - a.z, rbx = b ? cp[0] - b.x : 0, rbz = b ? cp[1] - b.z : 0;
  const wa = a.w || 0, wb = b ? b.w || 0 : 0;
  const rvx = a.vx + wa * raz - (b ? (b.vx || 0) + wb * rbz : 0);
  const rvz = a.vz - wa * rax - (b ? (b.vz || 0) - wb * rbx : 0);
  const vn = rvx * c.nx + rvz * c.nz;
  if (vn >= 0) return null;
  const ka = raz * c.nx - rax * c.nz, kb = rbz * c.nx - rbx * c.nz;
  // solve with b's real mass even if we can't move it, so a gets a believable shove
  const imbS = b ? 1 / b.T.mass : 0, iIbS = b ? 1 / inertia(b.T) : 0;
  const j = (-(1 + 0.15) * vn) / (ima + imbS + ka * ka * iIa + kb * kb * iIbS);
  const tx = -c.nz, tz = c.nx, vt = rvx * tx + rvz * tz;
  const kta = raz * tx - rax * tz, ktb = rbz * tx - rbx * tz;
  let jt = -vt / (ima + imbS + kta * kta * iIa + ktb * ktb * iIbS);
  jt = clamp(jt, -0.45 * j, 0.45 * j);
  const Jx = c.nx * j + tx * jt, Jz = c.nz * j + tz * jt, Jw = ka * j + kta * jt, JwB = kb * j + ktb * jt;
  a.vx += Jx * ima; a.vz += Jz * ima; a.w = wa + Jw * iIa;
  if (dyn) { b.vx -= Jx * imb; b.vz -= Jz * imb; b.w = wb - JwB * iIb; }
  return { imp: -vn, Jx, Jz, JwB, cp };
}

// Arcade car physics. inp: {throttle, brake, steer, handbrake}. Returns impact speed against walls.
export function stepVehicle(v, inp, dt) {
  const T = v.T;
  const fx = Math.sin(v.h), fz = Math.cos(v.h), rx = -Math.cos(v.h), rz = Math.sin(v.h);
  let vf = v.vx * fx + v.vz * fz, vr = v.vx * rx + v.vz * rz;
  const alive = v.hp > 0 && v.sinkT === 0;
  const grounded = !(v.air > 0);
  if (alive && grounded && inp.throttle > 0) vf += T.acc * inp.throttle * dt * (vf < 0 ? 2.5 : 1);
  if (alive && grounded && inp.brake > 0) { if (vf > 0.5) vf -= T.acc * 2.4 * dt; else vf = Math.max(-T.max * 0.35, vf - T.acc * 0.7 * dt); }
  if (grounded) {
    vf -= vf * ((inp.throttle || inp.brake) && alive ? 0.12 : 0.7) * dt;
    if (inp.handbrake) vf -= vf * 1.4 * dt;
    vr *= Math.exp(-(inp.handbrake ? 1.6 : T.grip) * dt);
  }
  if (vf > T.max) vf = T.max;
  const yaw = alive ? (inp.steer || 0) * T.turn * clamp(vf / 5, -1, 1) * (1 - 0.35 * Math.min(1, Math.abs(vf) / T.max)) * (inp.handbrake ? 1.35 : 1) : 0;
  // spin: tires pull the turn rate toward what the steering asks for; a crash can overpower that
  const gripK = grounded ? (inp.handbrake ? 2.5 : T.grip * 1.4) : 0.2;
  v.w = (v.w || 0) + (yaw - (v.w || 0)) * Math.min(1, gripK * dt);
  v.h += v.w * dt;
  const nfx = Math.sin(v.h), nfz = Math.cos(v.h), nrx = -Math.cos(v.h), nrz = Math.sin(v.h);
  v.vx = nfx * vf + nrx * vr; v.vz = nfz * vf + nrz * vr;
  const ox = v.x, oz = v.z;
  v.x += v.vx * dt; v.z += v.vz * dt;
  v.speed = vf;
  v.slip = Math.abs(vr) + Math.abs(v.w - yaw) * 2;
  v.tilt = T.bike ? clamp(-yaw * Math.abs(vf) * 0.03, -0.5, 0.5) : 0;
  let impact = 0;
  v.hit = null;
  // ramps: hitting the tall end is a wall
  let gh = W.groundHeight(v.x, v.z);
  if (gh - v.y > 0.7) {
    impact = Math.hypot(v.vx, v.vz);
    v.hit = { imp: impact, cp: [v.x + nfx * T.len / 2, v.z + nfz * T.len / 2], nx: -nfx, nz: -nfz, wall: true };
    v.x = ox; v.z = oz; v.vx *= -0.3; v.vz *= -0.3;
    gh = W.groundHeight(v.x, v.z);
  }
  // buildings and walls
  const A = boxOf(v), reach = T.len / 2 + 1;
  for (const b of W.colliders) {
    if (b.h < 0.5 || Math.abs(b.cx - v.x) > b.br + reach || Math.abs(b.cz - v.z) > b.br + reach) continue;
    A.x = v.x; A.z = v.z;
    const B = boxOfWall(b), c = sat(A, B);
    if (!c) continue;
    const cp = contactPoint(A, B);
    const r = resolve(v, null, c, cp, true);
    if (r && r.imp > impact) { impact = r.imp; v.hit = { imp: r.imp, cp, nx: c.nx, nz: c.nz, wall: true }; }
  }
  v.landed = 0;
  if (!W.isLand(v.x, v.z) && v.y < 0.3) {
    v.sinkT += dt; v.vx *= Math.exp(-2.5 * dt); v.vz *= Math.exp(-2.5 * dt);
    v.y = -Math.min(2.2, v.sinkT * 0.8); v.vy = 0; v.air = 0;
  } else {
    v.sinkT = 0;
    const floor = W.isLand(v.x, v.z) ? gh : -5;
    if (v.y > floor + 0.05) {
      v.air = (v.air || 0) + dt;
      v.vy = (v.vy || 0) - 22 * dt;
      v.y += v.vy * dt;
      if (v.y <= floor) { v.landed = -v.vy; v.y = floor; v.vy = 0; }
    } else {
      v.vy = dt > 0 ? (floor - v.y) / dt : 0;
      if (v.vy < 0) v.vy = 0;
      v.y = floor;
      v.lastAir = v.air || 0; v.air = 0;
    }
  }
  return impact;
}

// Crash a locally simulated vehicle v into another vehicle o.
// pushable = we may move o here; otherwise o only receives the impulse through o.pending (to send over the network).
// Returns impact speed (0 if no contact). Contact info lands in v.hit / o.hit.
export function collideVehicles(v, o, pushable) {
  if (Math.abs(v.y - (o.y || 0)) > 1.6) return 0;
  const A = boxOf(v), B = boxOf(o);
  const c = sat(A, B);
  if (!c) return 0;
  const cp = contactPoint(A, B);
  const r = resolve(v, o, c, cp, !pushable);
  if (!r) return 0;
  v.hit = { imp: r.imp, cp, nx: c.nx, nz: c.nz, other: o };
  o.hit = { imp: r.imp, cp, nx: -c.nx, nz: -c.nz, other: v };
  if (!pushable) o.pending = { jx: -r.Jx / o.T.mass, jz: -r.Jz / o.T.mass, jw: -r.JwB / inertia(o.T) };
  return r.imp;
}
// Apply an impulse that another computer worked out for us.
export function applyBump(v, b) {
  v.vx += b.jx || 0; v.vz += b.jz || 0; v.w = (v.w || 0) + (b.jw || 0);
}

// Push a walking character (circle) out of a vehicle.
export function pushCharOut(x, z, r, v) {
  const B = boxOf(v);
  const dx = x - B.x, dz = z - B.z;
  const la = dx * B.ax + dz * B.az, lb = dx * B.bx + dz * B.bz;
  const ca = clamp(la, -B.ha, B.ha), cb = clamp(lb, -B.hb, B.hb);
  let pa = la - ca, pb = lb - cb, d = Math.hypot(pa, pb);
  if (d > r) return { x, z };
  if (d < 1e-6) { // inside: push out along the shortest side
    const oa = B.ha - Math.abs(la), ob = B.hb - Math.abs(lb);
    if (oa < ob) { pa = Math.sign(la || 1); pb = 0; d = 0; const push = oa + r; return { x: x + B.ax * pa * push, z: z + B.az * pa * push }; }
    pb = Math.sign(lb || 1); const push = ob + r; return { x: x + B.bx * pb * push, z: z + B.bz * pb * push };
  }
  const k = (r - d) / d;
  return { x: x + (B.ax * pa + B.bx * pb) * k, z: z + (B.az * pa + B.bz * pb) * k };
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
