import * as THREE from 'three';
import { mat } from './character.js';
import * as W from './world.js';
import { rng, clamp } from './util.js';
import * as fx from './fx.js';
import { sky } from './daynight.js';
import { buildCarMesh, dent, crumple, unDent, GLASS } from './carmodel.js';

export const TYPES = [
  { name: 'Sedan', len: 4.4, wid: 1.9, hgt: 1.45, max: 32, acc: 13, turn: 1.9, grip: 7, mass: 1.2, hp: 100 },
  { name: 'Sports car', len: 4.3, wid: 1.95, hgt: 1.15, max: 46, acc: 22, turn: 2.2, grip: 8.5, mass: 1.1, hp: 80 },
  { name: 'Truck', len: 5.8, wid: 2.3, hgt: 2.6, max: 25, acc: 8, turn: 1.4, grip: 6, mass: 2.6, hp: 180, truck: true },
  { name: 'Van', len: 5.0, wid: 2.1, hgt: 2.2, max: 28, acc: 10, turn: 1.6, grip: 6.5, mass: 2, hp: 140, van: true },
  { name: 'Motorbike', len: 2.1, wid: 0.8, hgt: 1.1, max: 44, acc: 20, turn: 2.6, grip: 9, mass: 0.45, hp: 50, bike: true },
  { name: 'Scooter', len: 1.8, wid: 0.7, hgt: 1.05, max: 22, acc: 12, turn: 2.8, grip: 9, mass: 0.3, hp: 40, bike: true },
  { name: 'Police car', len: 4.6, wid: 2.0, hgt: 1.5, max: 33, acc: 14, turn: 2.0, grip: 8, mass: 1.4, hp: 160, police: true },
  { name: 'City bus', len: 10, wid: 2.6, hgt: 3.1, max: 22, acc: 6, turn: 1.1, grip: 6, mass: 4, hp: 260, bus: true },
  { name: 'Speedboat', len: 6, wid: 2.3, hgt: 1.4, max: 30, acc: 11, turn: 1.3, grip: 2, mass: 1.6, hp: 150, boat: true },
  { name: 'Helicopter', len: 9, wid: 2.4, hgt: 2.6, max: 38, acc: 10, turn: 1.6, grip: 2, mass: 2.2, hp: 200, heli: true },
  // everyday
  { name: 'Hatchback', len: 3.9, wid: 1.8, hgt: 1.45, max: 30, acc: 13, turn: 2.1, grip: 7.2, mass: 1.0, hp: 90, hatch: true },
  { name: 'SUV', len: 4.8, wid: 2.0, hgt: 1.85, max: 31, acc: 12, turn: 1.8, grip: 7, mass: 1.7, hp: 130, suv: true },
  { name: 'Pickup', len: 5.4, wid: 2.05, hgt: 1.85, max: 31, acc: 12, turn: 1.7, grip: 6.8, mass: 1.9, hp: 140, pickup: true },
  { name: 'Minivan', len: 5.0, wid: 2.0, hgt: 1.8, max: 29, acc: 11, turn: 1.8, grip: 6.8, mass: 1.7, hp: 120, minivan: true },
  // fun
  { name: 'Muscle car', len: 4.7, wid: 2.0, hgt: 1.25, max: 44, acc: 20, turn: 1.9, grip: 7.5, mass: 1.4, hp: 110, muscle: true },
  { name: 'Convertible', len: 4.4, wid: 1.9, hgt: 1.2, max: 40, acc: 18, turn: 2.2, grip: 8, mass: 1.1, hp: 85, convertible: true },
  { name: 'Limo', len: 7.4, wid: 2.0, hgt: 1.45, max: 30, acc: 10, turn: 1.3, grip: 6.5, mass: 2.4, hp: 160, limo: true },
  { name: 'Monster truck', len: 5.2, wid: 2.8, hgt: 3.0, max: 34, acc: 16, turn: 1.6, grip: 7, mass: 3, hp: 260, monster: true },
  // work
  { name: 'Taxi', len: 4.5, wid: 1.9, hgt: 1.45, max: 32, acc: 13, turn: 1.9, grip: 7, mass: 1.2, hp: 100, taxi: true },
  { name: 'Garbage truck', len: 8, wid: 2.5, hgt: 3.4, max: 22, acc: 6, turn: 1.1, grip: 6, mass: 4.5, hp: 300, cabbed: 'garbage' },
  { name: 'Tow truck', len: 6.6, wid: 2.3, hgt: 2.6, max: 27, acc: 8, turn: 1.3, grip: 6, mass: 3, hp: 220, cabbed: 'tow' },
  // emergency
  { name: 'Ambulance', len: 6.2, wid: 2.3, hgt: 2.7, max: 32, acc: 11, turn: 1.5, grip: 6.5, mass: 2.6, hp: 200, cabbed: 'ambulance', siren: true },
  { name: 'Fire truck', len: 9.5, wid: 2.5, hgt: 3.2, max: 26, acc: 7, turn: 1.05, grip: 6, mass: 5, hp: 350, cabbed: 'fire', siren: true },
];
export const V = { SEDAN: 0, SPORTS: 1, TRUCK: 2, VAN: 3, BIKE: 4, SCOOTER: 5, POLICE: 6, BUS: 7, BOAT: 8, HELI: 9, HATCH: 10, SUV: 11, PICKUP: 12, MINIVAN: 13, MUSCLE: 14, CONVERTIBLE: 15, LIMO: 16, MONSTER: 17, TAXI: 18, GARBAGE: 19, TOW: 20, AMBULANCE: 21, FIRE: 22 };
export const BUS = 7, BOAT = 8, HELI = 9;
export const POLICE = 6;
// real-world car colours: lots of white, black, silver and grey, some blue and red, the odd bright one
export const CAR_COLORS = [0xf2f2f0, 0xf2f2f0, 0xe8e8e6, 0x1c1d20, 0x1c1d20, 0x9ea3a8, 0xb9bcbf, 0x6b7076, 0x4a4f55, 0x2f4a6d, 0x1f3550, 0x8e1c1c, 0xb02a2a, 0xc9b99a, 0x3f5a3c, 0x6e2b3a, 0xd9762b, 0xe3c33b, 0x2f8fd0, 0x4fae6e];

const box = new THREE.BoxGeometry(1, 1, 1);
const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10);
wheelGeo.rotateZ(Math.PI / 2);
// glossy car paint (reflects the sky through the environment map)
const paints = new Map();
let curPaint = -1;
export function paintMat(c) {
  let m = paints.get(c);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.28, metalness: 0.45, envMapIntensity: 1.3 }); paints.set(c, m); }
  return m;
}
function bx(g, c, sx, sy, sz, x, y, z, material) {
  const m = new THREE.Mesh(box, material || (c === curPaint ? paintMat(c) : mat(c)));
  m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
}

export function makeVehicleMesh(T, color, dirt = 0, tiHint = -1) {
  const ti = tiHint >= 0 ? tiHint : TYPES.findIndex((t) => t === T || t.name === T.name);
  const model = buildCarMesh(ti, color, { dirt });
  if (model) return model;
  curPaint = color;
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const L = T.len, Wd = T.wid;
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x26323f, roughness: 0.08, metalness: 0.4 });
  const parts = { wheels: [], glassMat, crushF: 0, crushB: 0 };
  if (T.bike) {
    bx(body, color, 0.32, 0.35, L * 0.55, 0, 0.72, 0.05);
    bx(body, 0x1e1e1e, 0.34, 0.12, 0.65, 0, 0.95, -0.25);
    bx(body, 0x333333, 0.7, 0.06, 0.06, 0, 1.12, L * 0.33);
    bx(body, 0xffffcc, 0.18, 0.14, 0.05, 0, 0.95, L * 0.38);
    if (T.name === 'Scooter') bx(body, color, 0.4, 0.08, 0.7, 0, 0.42, 0.05);
    for (const z of [L / 2 - 0.35, -L / 2 + 0.35]) { const w = new THREE.Mesh(wheelGeo, mat(0x111111)); w.scale.set(0.5, 0.95, 0.95); w.position.set(0, 0.36, z); body.add(w); parts.wheels.push(w); }
  } else if (T.boat) {
    bx(body, color, Wd, 0.9, L * 0.8, 0, 0.3, -L * 0.08);
    const bow = bx(body, color, Wd * 0.7, 0.9, L * 0.3, 0, 0.3, L * 0.38); bow.rotation.y = Math.PI / 4; bow.scale.set(Wd * 0.7, 0.9, Wd * 0.7);
    bx(body, 0xffffff, Wd + 0.04, 0.12, L * 0.8, 0, 0.72, -L * 0.08);
    bx(body, 0, Wd * 0.8, 0.5, 0.06, 0, 1.05, 0.3, glassMat);
    bx(body, 0x1e1e1e, 0.5, 0.5, 0.6, 0, 0.8, -L * 0.45);
    parts.segL = 1;
  } else if (T.heli) {
    bx(body, color, Wd, 1.9, 4.4, 0, 1.3, 0.4);
    bx(body, 0, Wd * 0.86, 1.0, 1.3, 0, 1.6, 2.4, glassMat);
    bx(body, 0xffffff, Wd + 0.02, 0.4, 4.42, 0, 0.75, 0.4);
    bx(body, color, 0.45, 0.45, 4.6, 0, 1.55, -3.9);
    bx(body, color, 0.1, 1.3, 0.8, 0, 2.1, -6.0);
    for (const x of [0.95, -0.95]) bx(body, 0x333333, 0.12, 0.12, 3.6, x, 0.12, 0.4);
    const rotor = new THREE.Group(); rotor.position.set(0, 2.4, 0.4); body.add(rotor);
    for (const r of [0, Math.PI / 2]) { const b = new THREE.Mesh(box, mat(0x1e1e1e)); b.scale.set(0.3, 0.06, 10); b.rotation.y = r; rotor.add(b); }
    g.userData.rotor = rotor;
    parts.segL = 1;
  } else if (T.bus) {
    bx(body, color, Wd, T.hgt - 0.5, L, 0, 0.35 + (T.hgt - 0.5) / 2, 0);
    bx(body, 0, Wd + 0.02, 0.9, L * 0.82, 0, 1.9, -0.3, glassMat);
    bx(body, 0, Wd * 0.9, 1.1, 0.05, 0, 1.75, L / 2 + 0.01, glassMat);
    bx(body, 0xffffff, Wd + 0.03, 0.25, L, 0, 1.25, 0);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(Wd * 0.8, 0.35), new THREE.MeshBasicMaterial({ map: busSign() }));
    sign.position.set(0, T.hgt - 0.35, L / 2 + 0.02); body.add(sign);
    parts.segL = 1.5;
  } else if (T.truck || T.cabbed) {
    const kind = T.cabbed || 'box', cabC = kind === 'fire' ? 0xc62828 : kind === 'ambulance' ? 0xf4f4f4 : color;
    const cabL = kind === 'ambulance' ? 2.2 : 1.9, cabH = kind === 'ambulance' ? 1.5 : 1.7;
    const fg = new THREE.Group(); fg.position.z = L / 2; body.add(fg); parts.frontG = fg;
    parts.hood = bx(fg, cabC, Wd, cabH, cabL, 0, 0.4 + cabH / 2, -cabL / 2);
    bx(fg, 0x26323f, Wd * 0.92, 0.65, 0.05, 0, 0.4 + cabH - 0.45, 0.01, glassMat);
    bx(fg, 0xfff8c4, 0.3, 0.16, 0.05, Wd / 2 - 0.3, 0.75, 0.02); bx(fg, 0xfff8c4, 0.3, 0.16, 0.05, -Wd / 2 + 0.3, 0.75, 0.02);
    parts.bumpF = bx(fg, 0x2b2b2b, Wd + 0.04, 0.3, 0.25, 0, 0.5, 0.05);
    bx(body, 0x333333, Wd * 0.9, 0.3, L, 0, 0.45, 0);
    const rl = L - cabL - 0.2, rz = -L / 2 + rl / 2;
    if (kind === 'box') bx(body, 0xf2f2f2, Wd + 0.05, 2.2, rl, 0, 1.55, rz);
    else if (kind === 'garbage') {
      bx(body, 0x2e7d32, Wd + 0.05, 2.5, rl * 0.8, 0, 1.75, rz + rl * 0.1);
      const back = bx(body, 0x1b5e20, Wd, 2.1, rl * 0.25, 0, 1.45, -L / 2 + rl * 0.12); back.rotation.x = 0.35;
      bx(body, 0xfafafa, Wd + 0.07, 0.25, rl * 0.6, 0, 1.4, rz + rl * 0.1);
    } else if (kind === 'tow') {
      bx(body, 0x37474f, Wd, 0.25, rl, 0, 0.75, rz);
      const boom = bx(body, 0xf9a825, 0.25, 0.25, rl * 0.8, 0, 1.5, rz - 0.3); boom.rotation.x = -0.35;
      bx(body, 0x212121, 0.6, 0.12, 0.4, 0, 0.9, -L / 2 + 0.2);
    } else if (kind === 'ambulance') {
      bx(body, 0xf4f4f4, Wd + 0.05, 2.3, rl, 0, 1.6, rz);
      bx(body, 0xd32f2f, Wd + 0.08, 0.3, rl, 0, 1.25, rz);
      bx(body, 0xd32f2f, 0.05, 0.9, 0.3, Wd / 2 + 0.03, 2.1, rz); bx(body, 0xd32f2f, 0.05, 0.3, 0.9, Wd / 2 + 0.03, 2.1, rz);
      bx(body, 0xd32f2f, 0.05, 0.9, 0.3, -Wd / 2 - 0.03, 2.1, rz); bx(body, 0xd32f2f, 0.05, 0.3, 0.9, -Wd / 2 - 0.03, 2.1, rz);
    } else if (kind === 'fire') {
      bx(body, 0xc62828, Wd + 0.05, 1.7, rl, 0, 1.3, rz);
      bx(body, 0xe0e0e0, Wd + 0.07, 0.15, rl, 0, 1.9, rz);
      bx(body, 0xb0bec5, 0.7, 0.2, rl * 1.05, 0.3, 2.35, rz + 0.4); bx(body, 0xb0bec5, 0.7, 0.2, rl * 1.05, -0.3, 2.35, rz + 0.4);
      for (let k = 0; k < 9; k++) bx(body, 0xb0bec5, 1.3, 0.08, 0.08, 0, 2.38, rz - rl / 2 + k * rl / 8);
    }
    if (T.siren) { // light bar on the cab roof
      const red = new THREE.MeshBasicMaterial({ color: 0xff1744 }), blue = new THREE.MeshBasicMaterial({ color: kind === 'fire' ? 0xff1744 : 0xfff3e0 });
      bx(fg, 0, 0.6, 0.18, 0.3, 0.35, 0.4 + cabH + 0.1, -cabL / 2, red); bx(fg, 0, 0.6, 0.18, 0.3, -0.35, 0.4 + cabH + 0.1, -cabL / 2, blue);
      g.userData.lights = [red, blue];
    }
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
    const [cf, zf] = T.van ? [0.82, -0.07] : T.hatch ? [0.6, -0.13] : T.suv ? [0.68, -0.1] : T.minivan ? [0.78, -0.06] : T.pickup ? [0.33, 0.06] : T.limo ? [0.66, -0.04] : T.monster ? [0.4, 0.02] : [0.5, -0.06];
    const cabLen = L * cf, cabZ = L * zf, top = 0.3 + lower + T.hgt * 0.42;
    if (T.convertible) {
      const ws = bx(body, 0, Wd * 0.86, T.hgt * 0.36, 0.06, 0, 0.3 + lower + T.hgt * 0.16, cabZ + cabLen * 0.35, glassMat); ws.rotation.x = -0.5;
      bx(body, 0x2b1d14, Wd * 0.8, 0.4, cabLen * 0.6, 0, 0.3 + lower + 0.15, cabZ - cabLen * 0.05); // seats
    } else {
      bx(body, 0, Wd * 0.88, T.hgt * 0.42, cabLen, 0, 0.3 + lower + T.hgt * 0.21, cabZ, glassMat);
      bx(body, color, Wd * 0.9, 0.07, cabLen + 0.02, 0, top, cabZ);
      if (T.van) bx(body, color, Wd * 0.9, T.hgt * 0.42, cabLen * 0.7, 0, 0.3 + lower + T.hgt * 0.21, cabZ - cabLen * 0.15);
      // window pillars so the glasshouse reads as a car, not a box of glass
      for (const f of T.limo ? [0.5, 0.17, -0.17, -0.5] : [0.5, -0.02, -0.5]) bx(body, color, Wd * 0.9, T.hgt * 0.4, 0.09, 0, 0.3 + lower + T.hgt * 0.21, cabZ + cabLen * f);
    }
    if (T.pickup) { // open bed behind the cab
      const bz0 = cabZ - cabLen / 2, bl = bz0 + L / 2 - 0.15;
      for (const sx of [1, -1]) bx(body, color, 0.1, 0.45, bl, sx * (Wd / 2 - 0.05), 0.3 + lower + 0.22, bz0 - bl / 2);
      bx(body, 0x262626, Wd - 0.2, 0.05, bl, 0, 0.3 + lower + 0.02, bz0 - bl / 2);
    }
    if (T.taxi) { bx(body, 0xfff59d, 0.7, 0.22, 0.32, 0, top + 0.14, cabZ); bx(body, 0x111111, Wd + 0.01, 0.12, midL * 0.9, 0, 0.3 + lower * 0.6, 0); }
    if (T.muscle) { bx(fg, 0xf5f5f5, 0.35, lower + 0.01, segL + 0.01, 0, yb, -segL / 2); bx(fg, 0x1e1e1e, 0.6, 0.18, segL * 0.5, 0, yb + lower / 2 + 0.08, -segL * 0.5); }
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
  if (!T.bike && !T.boat && !T.heli) {
    for (const sx of [1, -1]) for (const sz of [1, -1]) {
      const w = new THREE.Group();
      w.position.set(sx * (Wd / 2 - 0.08), 0.36, sz * (L / 2 - (T.truck ? 1.0 : T.bus ? 2.0 : 0.85)));
      const tire = new THREE.Mesh(wheelGeo, mat(0x111111)); tire.castShadow = true; w.add(tire);
      bx(w, 0xcfd8dc, 0.04, 0.34, 0.34, sx * 0.14, 0, 0);
      body.add(w); parts.wheels.push(w);
    }
    // driver head: shown for traffic, cops and players
    const head = bx(body, 0xe0ac69, 0.3, 0.3, 0.3, 0.42, (T.cabbed ? 1.4 : 0.3 + T.hgt * 0.72), T.truck || T.cabbed ? L / 2 - 0.9 : T.bus ? L / 2 - 1.2 : -0.1);
    head.visible = false;
    g.userData.driverHead = head;
    if (T.monster) { // jacked up on huge tyres
      for (const c of body.children) if (!parts.wheels.includes(c)) c.position.y += 0.95;
      for (const w of parts.wheels) { w.scale.set(1.6, 2.5, 2.5); w.position.y = 0.9; w.position.x *= 1.08; }
    }
  }
  // merge the static boxes that share a material (a car is a few draw calls, not twenty-five)
  const keep = new Set([parts.hood, parts.bumpF, parts.trunk, parts.bumpR, parts.doorR, g.userData.driverHead].filter(Boolean));
  for (const grp of [body, parts.frontG, parts.rearG]) if (grp) mergeStatic(grp, keep);
  g.userData.body = body;
  g.userData.parts = parts;
  return g;
}
function mergeStatic(group, keep) {
  const byMat = new Map();
  for (const m of group.children) if (m.isMesh && !keep.has(m)) { if (!byMat.has(m.material)) byMat.set(m.material, []); byMat.get(m.material).push(m); }
  for (const [material, list] of byMat) {
    if (list.length < 2) continue;
    const pos = [], nor = [], uv = [], idx = [];
    for (const m of list) {
      m.updateMatrix();
      const gg = m.geometry.clone().applyMatrix4(m.matrix), base = pos.length / 3;
      pos.push(...gg.attributes.position.array); nor.push(...gg.attributes.normal.array); uv.push(...gg.attributes.uv.array);
      for (const i of gg.index.array) idx.push(base + i);
      group.remove(m);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    const mm = new THREE.Mesh(geo, material); mm.castShadow = true; group.add(mm);
  }
}
let _busSign = null;
function busSign() {
  if (_busSign) return _busSign;
  const c = document.createElement('canvas'); c.width = 256; c.height = 40;
  const x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, 256, 40);
  x.fillStyle = '#ffb300'; x.font = 'bold 24px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('12 ARNETT AVE', 128, 21);
  _busSign = new THREE.CanvasTexture(c); _busSign.colorSpace = THREE.SRGBColorSpace;
  return _busSign;
}

let burntMat = null;
export function charVehicle(v) {
  burntMat = burntMat || new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 1 });
  v.mesh.userData.body.traverse((m) => { if (m.isMesh && !(m.material && m.material.isMeshBasicMaterial)) m.material = burntMat; });
  // wheels fly off
  const parts = v.mesh.userData.parts;
  for (const w of parts.wheels) launchPart(v, w, 6);
  parts.wheels = [];
}

// how grimy a car is (0 clean .. 3 filthy): work trucks and pickups more often, taxis and limos rarely
function dirtFor(id, ti) {
  let h = 0; for (let i = 0; i < String(id).length; i++) h = (h * 31 + String(id).charCodeAt(i)) >>> 0;
  const r = (h % 1000) / 1000, T = TYPES[ti];
  if (T.limo || T.police || T.taxi) return r < 0.85 ? 0 : 1;
  if (T.pickup || T.truck || T.cabbed || T.van) return r < 0.25 ? 0 : r < 0.6 ? 1 : r < 0.88 ? 2 : 3;
  return r < 0.5 ? 0 : r < 0.8 ? 1 : r < 0.95 ? 2 : 3;
}
export function makeVehicle(id, ti, color, home) {
  const T = TYPES[ti];
  return {
    id, ti, T, color, mesh: makeVehicleMesh(T, color, dirtFor(id, ti), ti),
    x: home.x, z: home.z, h: home.h, y: W.groundHeight(home.x, home.z), vx: 0, vz: 0, w: 0, speed: 0,
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
// the part's factory pose, remembered before it first gets bent, hung or knocked off (repair puts it back)
function base(m) { return m.userData.t0 || (m.userData.t0 = { p: m.position.clone(), q: m.quaternion.clone(), s: m.scale.clone() }); }
// knock off part P[key], remembering where it belongs so repair() can bolt it back on
function drop(v, P, key, power) {
  const m = P[key]; if (!m || !m.parent) return;
  base(m); (P.lost || (P.lost = [])).push({ key, m, parent: m.parent });
  launchPart(v, m, power); P[key] = null;
  if (P.hang) delete P.hang[key];
}
// Record an impact at world point (px, pz) and update the dents. ly = height of the hit (roof hits push down).
// Panels only get dented on cars that are drawn up close (far ones are a silhouette anyway).
export function damageZone(v, px, pz, imp, ly = 0.65) {
  if (v.T.bike || imp < 4) return;
  const fx = Math.sin(v.h), fz = Math.cos(v.h), rx = -Math.cos(v.h), rz = Math.sin(v.h);
  const lf = (px - v.x) * fx + (pz - v.z) * fz, lr = (px - v.x) * rx + (pz - v.z) * rz;
  const zone = Math.abs(lf) / v.T.len > Math.abs(lr) / v.T.wid ? (lf > 0 ? 'f' : 'b') : lr > 0 ? 'r' : 'l';
  const arm = tuneOf(v).armor; // armor plating dents less (the hp side is handled in main's damageVehicle)
  v.dz[zone] += imp * arm;
  // dent the panels where it hit (car-local: +x left, +z forward)
  const P = v.mesh.userData.parts;
  if (P && P.model && !v.T.heli && !v.T.boat && v.mesh.visible) {
    const lx = -lr, lz = lf, l = Math.hypot(lx, lz) || 1, roof = ly > v.T.hgt * 0.8;
    const depth = Math.min(0.2, imp * 0.006) * arm, rad = (0.75 + Math.min(0.5, imp * 0.015)) * (zone === 'f' || zone === 'b' ? 0.9 : 1);
    if (roof) dent(v, lx, ly, lz, 0, 0, depth, rad * 1.3, -1);
    else dent(v, lx, ly, lz, -lx / l, -lz / l, depth, rad);
  }
  applyDamageVisual(v);
}
export function applyDamageVisual(v) {
  const P = v.mesh.userData.parts;
  if (!P || v.T.bike) return;
  if (P.model) { modelDamage(v, P); return; }
  const k = (z) => Math.min(1, v.dz[z] / 45);
  const segL = P.segL;
  if (P.frontG) {
    const d = k('f');
    P.frontG.position.z = v.T.len / 2 - segL * 0.5 * d;
    P.hood.scale.z = segL * (1 - 0.5 * d); P.hood.position.z = -P.hood.scale.z / 2;
    P.hood.rotation.x = -0.18 * d;
    if (d > 0.45 && P.bumpF) drop(v, P, 'bumpF', 4);
    if (d > 0.8 && P.hood.parent && !v.T.truck && !P.hoodGone) { P.hoodGone = true; P.hood.rotation.x = -0.6; }
  }
  if (P.rearG) {
    const d = k('b');
    P.rearG.position.z = -v.T.len / 2 + segL * 0.5 * d;
    P.trunk.scale.z = segL * (1 - 0.5 * d); P.trunk.position.z = P.trunk.scale.z / 2;
    P.trunk.rotation.x = 0.18 * d;
    if (d > 0.45 && P.bumpR) drop(v, P, 'bumpR', 4);
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

// Blender cars: the hood buckles and springs up, bumpers and doors hang loose then come off, lamps break,
// glass cracks then shatters. Hanging parts swing in animateDamage.
function modelDamage(v, P) {
  const k = (z) => Math.min(1, v.dz[z] / 45);
  const f = k('f'), b = k('b'), l = k('l'), r = k('r');
  const H = P.hang || (P.hang = {});
  if (P.hood) { base(P.hood); P.hood.rotation.x = -0.4 * Math.max(0, f - 0.3); crumple(v, f); }
  for (const [key, d] of [['bumpF', f], ['bumpR', b]]) {
    if (!P[key] || d <= 0.25) continue;
    if (d > 0.6) drop(v, P, key, 4); else { base(P[key]); H[key] = Math.min(1, (d - 0.25) / 0.3); }
  }
  if (f > 0.5 && !v.brokenHead) { v.brokenHead = true; P.lampState = -1; fx.glass(v.x + Math.sin(v.h) * v.T.len / 2, v.y + 0.7, v.z + Math.cos(v.h) * v.T.len / 2, 6); }
  if (f > 0.95 && P.hood) drop(v, P, 'hood', 5);
  if (P.trunk) { base(P.trunk); P.trunk.rotation.x = 0.4 * Math.max(0, b - 0.3); }
  if (b > 0.5 && !v.brokenTail) { v.brokenTail = true; P.lampState = -1; }
  if (b > 0.95 && P.trunk) drop(v, P, 'trunk', 5);
  for (const [side, d] of [['L', l], ['R', r]]) {
    for (const nm of ['door' + side, 'door' + side + '2']) {
      if (!P[nm] || d <= 0.45) continue;
      const held = nm === 'door' + side && v.driver; // the driver's door stays on (it's how you get out)
      if (d > 0.92 && !held) drop(v, P, nm, 4); else H[nm] = Math.min(1, (d - 0.45) / 0.4);
    }
  }
  const total = v.dz.f + v.dz.b + v.dz.l + v.dz.r;
  if (total > 30 && !P.cracked) {
    P.cracked = true;
    const g = P.glassMat.clone(); g.map = crackTex; g.color.setHex(0xb8c4cc); g.opacity = 0.75; P.glassMat = g;
    for (const m of P.glass) m.material = g;
  }
  if (total > 70 && !P.shattered) {
    P.shattered = true;
    for (const m of P.glass) m.visible = false;
    fx.glass(v.x, v.y + v.T.hgt * 0.8, v.z, 22);
  }
}
// Loose bumpers sag by a corner and doors hang ajar, swinging with the car; at speed a dangling part tears off.
// Called per frame for cars that are drawn (cheap: nothing to do on an undamaged car).
export function animateDamage(v, dt) {
  const P = v.mesh.userData.parts, H = P && P.hang; if (!H) return;
  const sp = Math.abs(v.speed || 0), t = performance.now() / 1000;
  for (const key in H) {
    const m = P[key]; if (!m) { delete H[key]; continue; }
    const a = H[key], wob = Math.sin(t * (7 + sp * 0.3) + key.length) * Math.min(1, sp / 12) * 0.1 * a, t0 = base(m);
    if (key[0] === 'b') { m.rotation.z = (0.3 * a + wob) * (key === 'bumpF' ? 1 : -1); m.position.y = t0.p.y - 0.12 * a; }
    else { const ang = 0.22 * a + Math.abs(wob); m.rotation.y = key.includes('L') ? Math.min(m.rotation.y, -ang) : Math.max(m.rotation.y, ang); }
    if (a >= 1 && sp > 16 && Math.random() < dt * 0.35 && !(v.driver && (key === 'doorL' || key === 'doorR'))) drop(v, P, key, 4);
  }
}
// Arnett Auto: straighten every panel, bolt the lost parts back on, new glass and lamps. Resets v.dz too.
// (carmods' applyMods can be called after it to put the window tint back.)
export function repair(v) {
  v.dz = { f: 0, b: 0, l: 0, r: 0 }; v.brokenHead = v.brokenTail = false;
  v.fr = v.fp = v.frV = v.fpV = 0;
  const P = v.mesh.userData.parts; if (!P) return;
  for (const L of P.lost || []) { fx.undebris(L.m); L.parent.add(L.m); P[L.key] = L.m; }
  P.lost = []; P.hang = null; P.hoodGone = false;
  for (const key of ['hood', 'trunk', 'bumpF', 'bumpR', 'doorL', 'doorR', 'doorL2', 'doorR2']) {
    const m = P[key], t0 = m && m.userData.t0;
    if (t0) { m.position.copy(t0.p); m.quaternion.copy(t0.q); m.scale.copy(t0.s); }
  }
  unDent(v);
  if (P.model) {
    P.cracked = P.shattered = false; P.glassMat = GLASS;
    for (const m of P.glass) { m.material = GLASS; m.visible = true; }
    P.lampState = undefined;
  } else {
    P.cracked = P.shattered = false; P.glassMat.map = null; P.glassMat.color.setHex(0x26323f); P.glassMat.needsUpdate = true;
    applyDamageVisual(v);
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
const wallList = [];
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

// Buildings and walls (anything you're flying above is ignored). Returns the hardest impact.
function hitWalls(v) {
  const T = v.T, A = boxOf(v), reach = T.len / 2 + 1;
  let impact = 0;
  for (const b of W.boxesNear(v.x, v.z, reach + 1, wallList)) {
    if (v.y > b.y0 + b.h || v.y + T.hgt < b.y0 || Math.abs(b.cx - v.x) > b.br + reach || Math.abs(b.cz - v.z) > b.br + reach) continue;
    A.x = v.x; A.z = v.z;
    const B = boxOfWall(b), c = sat(A, B);
    if (!c) continue;
    const cp = contactPoint(A, B);
    v.touch = { t: performance.now(), cp, nx: c.nx, nz: c.nz }; // still touching (scraping) even when not closing in
    const r = resolve(v, null, c, cp, true);
    if (r) kick(v, c.nx, c.nz, r.imp, 1);
    if (r && r.imp > impact) { impact = r.imp; v.hit = { imp: r.imp, cp, nx: c.nx, nz: c.nz, wall: true }; }
  }
  return impact;
}

// Boats: drift a lot, bob on the waves, land is a wall.
function stepBoat(v, inp, dt) {
  const T = v.T, fx = Math.sin(v.h), fz = Math.cos(v.h), rx = -Math.cos(v.h), rz = Math.sin(v.h);
  let vf = v.vx * fx + v.vz * fz, vr = v.vx * rx + v.vz * rz;
  const alive = v.hp > 0;
  if (alive && inp.throttle) vf += T.acc * dt * (inp.nitro && v.nitro > 0 ? 1.7 : 1);
  if (alive && inp.brake) vf = Math.max(-8, vf - T.acc * 0.8 * dt);
  vf -= vf * 0.35 * dt; vr *= Math.exp(-1.6 * dt);
  if (vf > T.max) vf = T.max;
  const yaw = alive ? (inp.steer || 0) * T.turn * clamp(vf / 6, -1, 1) : 0;
  v.w = (v.w || 0) + (yaw - (v.w || 0)) * Math.min(1, 4 * dt); v.h += v.w * dt;
  const nfx = Math.sin(v.h), nfz = Math.cos(v.h), nrx = -Math.cos(v.h), nrz = Math.sin(v.h);
  v.vx = nfx * vf + nrx * vr; v.vz = nfz * vf + nrz * vr;
  const ox = v.x, oz = v.z;
  v.x += v.vx * dt; v.z += v.vz * dt;
  v.hit = null;
  let impact = 0;
  const bowX = v.x + nfx * T.len / 2, bowZ = v.z + nfz * T.len / 2;
  if (W.isLand(bowX, bowZ) || W.isLand(v.x, v.z) || W.offMap(bowX, bowZ)) { impact = Math.abs(vf); v.hit = { imp: impact, cp: [bowX, bowZ], nx: -nfx, nz: -nfz, wall: true }; v.x = ox; v.z = oz; v.vx *= -0.25; v.vz *= -0.25; }
  v.speed = vf; v.slip = Math.abs(vr); v.sinkT = 0; v.air = 0;
  v.y = -0.35 + Math.sin(performance.now() / 420 + v.x * 0.3) * 0.07 + Math.min(0.25, Math.abs(vf) * 0.008);
  v.pitch = -Math.min(0.16, Math.max(0, vf) * 0.006);
  return impact;
}

// Helicopter: W/S tilt forward/back, A/D turn, Space climb, Shift descend.
function stepHeli(v, inp, dt) {
  const T = v.T, alive = v.hp > 0;
  const ground = Math.max(W.isLand(v.x, v.z) ? W.groundHeight(v.x, v.z) : -0.15, W.roofAt(v.x, v.z)); // roofs are helipads too
  v.alt = v.y - ground;
  v.vy = v.vy || 0;
  if (alive) {
    if (inp.up) v.vy += 11 * dt; else if (inp.down) v.vy -= 11 * dt; else v.vy *= Math.exp(-2.5 * dt);
    v.vy = clamp(v.vy, -10, 9);
  } else v.vy -= 16 * dt; // engine dead: drop
  const flying = v.y > ground + 0.4;
  const fx = Math.sin(v.h), fz = Math.cos(v.h), rx = -Math.cos(v.h), rz = Math.sin(v.h);
  let vf = v.vx * fx + v.vz * fz, vr = v.vx * rx + v.vz * rz;
  if (flying && alive) vf += ((inp.throttle ? 1 : 0) - (inp.brake ? 1 : 0)) * T.acc * dt;
  vf -= vf * (flying ? 0.35 : 4) * dt; vr *= Math.exp(-1.4 * dt);
  vf = clamp(vf, -14, T.max);
  const yaw = alive && flying ? (inp.steer || 0) * T.turn : 0;
  v.w = (v.w || 0) + (yaw - (v.w || 0)) * Math.min(1, 3 * dt); v.h += v.w * dt;
  const nfx = Math.sin(v.h), nfz = Math.cos(v.h), nrx = -Math.cos(v.h), nrz = Math.sin(v.h);
  v.vx = nfx * vf + nrx * vr; v.vz = nfz * vf + nrz * vr;
  v.x += v.vx * dt; v.z += v.vz * dt; v.y += v.vy * dt;
  v.landed = 0;
  if (v.y < ground) { v.landed = -v.vy; v.y = ground; v.vy = Math.max(0, v.vy); }
  v.y = Math.min(v.y, ground + 160);
  v.speed = vf; v.slip = 0; v.sinkT = 0; v.air = flying ? 1 : 0;
  v.pitch = alive ? -((inp.throttle ? 1 : 0) - (inp.brake ? 1 : 0)) * 0.18 : v.pitch || 0;
  v.tilt = -v.w * 0.25;
  v.hit = null;
  return Math.max(hitWalls(v), v.landed > 9 ? v.landed : 0);
}

// ---------- handling ----------
// v.mods from Arnett Auto (carmods.js): upgrade levels above stock, 0 = stock. Old boolean upgrades already live in T.
const lvl = (v, k) => { const x = v.mods && v.mods[k]; return typeof x === 'number' ? x : 0; };
export function tuneOf(v) {
  const e = lvl(v, 'engine'), s = lvl(v, 'suspension');
  return { acc: 1 + 0.1 * e, max: 1 + 0.05 * e, brake: 1 + 0.2 * lvl(v, 'brakes'), grip: 1 + 0.06 * s, stiff: 1 + 0.25 * s, turbo: !!(v.mods && v.mods.turbo), armor: 1 - 0.1 * lvl(v, 'armor') };
}
// per-type character: loose = rear grip left under power in a slide, grip = cornering grip, roll = body lean
function feel(T) {
  return T._feel || (T._feel = T.muscle ? { loose: 0.7, grip: 0.95, roll: 1.15 } : T.name === 'Sports car' || T.convertible ? { loose: 1, grip: 1.12, roll: 0.6 }
    : T.monster ? { loose: 0.85, grip: 1, roll: 1.3 } : T.bike ? { loose: 0.9, grip: 1.25, roll: 0 } : { loose: 0.9, grip: 1, roll: 1 });
}
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrapA = (p) => (p > Math.PI ? p - 2 * Math.PI : p < -Math.PI ? p + 2 * Math.PI : p);
// One tipping axis (v.fr roll / v.fp pitch) of a box on flat ground: CG height h = a|sin p| + b|cos p| gives stable
// rests on the wheels, a side (or the nose) and the roof. Returns how fast a face slapped down this frame.
function tip(v, k, a, b, dt, onGround, springs) {
  let p = v[k] || 0, w = v[k + 'V'] || 0, slap = 0;
  if (onGround) {
    const q = Math.round(p / (Math.PI / 2)) * (Math.PI / 2); // settled flat on the wheels, a side or the roof
    if (Math.abs(p - q) < 0.015 && Math.abs(w) < 0.08) { v[k] = q; v[k + 'V'] = 0; return 0; }
    const s = Math.sin(p), c = Math.cos(p);
    let acc = -9.8 * (a * c * Math.sign(s) - b * s * Math.sign(c)) / (1.333 * (a * a + b * b));
    if (springs && Math.abs(p) < 0.5) acc *= springs; // suspension pushes a lifted end back down
    w = (w + acc * dt) * Math.exp(-0.8 * dt);
    const np = wrapA(p + w * dt);
    if (Math.sin(np) * s < 0 || Math.cos(np) * c < 0) { slap = Math.abs(w); w *= 0.6; } // a face slapped flat on the ground
    p = np;
  } else { w *= Math.exp(-0.4 * dt); p = wrapA(p + w * dt); }
  v[k] = p; v[k + 'V'] = w;
  return slap;
}
// how far the body must rise so a tipped car rests on its lowest corner (body pivots at ground centre)
const lift1 = (p, a, h) => Math.max(0, a * Math.abs(Math.sin(p)) - Math.min(0, h * Math.cos(p)));
export const tipLift = (T, fr, fp) => (fr || fp ? Math.max(lift1(fr, T.wid / 2, T.hgt), lift1(fp, T.len / 2, T.hgt)) : 0);
// A hit tips the car: side hits roll it the way it's shoved (top-heavy, light cars most), frontal ones lift the rear.
// share = how much of the closing speed this car takes (1 for a wall).
function kick(v, nx, nz, imp, share) {
  const T = v.T; if (T.bike || T.boat || T.heli || imp < 5 || v.mode === 'cop') return; // police.js poses cop cars itself (no tipping)
  const right = -nx * Math.cos(v.h) + nz * Math.sin(v.h), fwd = nx * Math.sin(v.h) + nz * Math.cos(v.h);
  v.frV = (v.frV || 0) + right * imp * share * 0.11 * (T.hgt / T.wid) * Math.pow(1.2 / T.mass, 0.3);
  v.fpV = (v.fpV || 0) - fwd * imp * share * 0.012;
  v.srV = (v.srV || 0) + right * imp * 0.03; v.spV = (v.spV || 0) - fwd * imp * 0.02;
}

// Arcade car physics. inp: {throttle, brake, steer, handbrake, nitro}. Returns impact speed against walls.
// World velocity is kept while the nose turns, so the tyres have to bend it round: grip is a sideways force
// limit, and past it the car slides (handbrake, power on in a muscle car, ice).
export function stepVehicle(v, inp, dt) {
  v.steerIn = inp.steer || 0;
  const T = v.T;
  if (T.boat) return stepBoat(v, inp, dt);
  if (T.heli) return stepHeli(v, inp, dt);
  // nitro: a few seconds of extra push, refills slowly
  if (v.nitro === undefined) v.nitro = 1;
  const boosting = inp.nitro && v.nitro > 0 && inp.throttle > 0 && !T.bike;
  v.boosting = boosting;
  v.nitro = boosting ? Math.max(0, v.nitro - dt / (3.5 * (T.nitroMul || 1))) : Math.min(1, v.nitro + dt / 14);
  const tn = tuneOf(v), F = feel(T);
  const fx = Math.sin(v.h), fz = Math.cos(v.h), rx = -Math.cos(v.h), rz = Math.sin(v.h);
  let vf = v.vx * fx + v.vz * fz, vr = v.vx * rx + v.vz * rz;
  const vf0 = vf;
  const alive = v.hp > 0 && v.sinkT === 0;
  const upset = !T.bike && (Math.abs(v.fr || 0) > 0.55 || Math.abs(v.fp || 0) > 0.6); // on its side or roof: no traction
  const grounded = !(v.air > 0) && !upset;
  const thr = alive ? inp.throttle || 0 : 0, brk = alive ? inp.brake || 0 : 0;
  // burnout: throttle and brake together at a standstill spin the rear wheels on the spot
  v.burnout = grounded && thr > 0 && brk > 0 && Math.abs(vf) < 3;
  v.spool = tn.turbo ? clamp((v.spool || 0) + (thr && grounded ? dt * 1.4 : -dt * 3), 0, 1) : 0;
  if (v.burnout) vf *= Math.exp(-6 * dt);
  else if (grounded) {
    if (thr > 0) vf += T.acc * tn.acc * (1 + 0.15 * v.spool) * thr * dt * (vf < 0 ? 2.5 : 1) * (boosting ? 1.6 : 1);
    if (brk > 0) { if (vf > 0.5) vf -= T.acc * 2.4 * (T.brakeMul || 1) * tn.brake * dt; else if (!thr) vf = Math.max(-T.max * 0.35, vf - T.acc * 0.7 * dt); }
  }
  if (v.flat) { vf = Math.min(vf, T.max * 0.45); vr *= 1 + dt * 0.8; }
  // grass, dirt and sand: extra drag and a much lower top speed than pavement
  const cls = grounded ? W.classAt(v.x, v.z) : -1;
  v.rough = cls === W.C.lawn || cls === W.C.park || cls === W.C.wood || cls === W.C.cemetery || cls === W.C.sand || cls === W.C.pitch;
  const slipA = Math.atan2(vr, Math.abs(vf) + 0.5); // + = sliding to the car's right
  if (grounded) {
    vf -= vf * ((thr || brk) ? 0.12 : 0.7) * dt;
    if (inp.handbrake) vf -= vf * 1.4 * dt;
    if (v.rough) vf -= vf * 0.9 * dt;
    // sideways tyre force (m/s²); it fades a little once the tyres are past the limit, so grip lets go gradually
    let cap = T.grip * sky.grip * tn.grip * F.grip * 5.5 * (1 - 0.3 * smooth(0.1, 0.45, Math.abs(slipA)));
    if (inp.handbrake) cap *= 0.15; // rear wheels locked
    else if (thr && Math.abs(slipA) > 0.12) cap *= F.loose; // power keeps a slide going
    if (v.rough) cap *= 0.8;
    const cut = Math.min(Math.abs(vr), cap * dt);
    vr -= Math.sign(vr) * cut;
    vf -= Math.sign(vf) * cut * 0.12; // scrubbing sideways costs speed
  } else if (upset && !(v.air > 0)) { vf *= Math.exp(-1.6 * dt); vr *= Math.exp(-1.6 * dt); } // grinding along on a side or the roof
  const cap = T.max * tn.max * (boosting ? 1.25 : 1) * (v.rough ? 0.5 : 1);
  if (vf > cap) vf = cap + (vf - cap) * Math.exp(-6 * dt);
  const sp = Math.abs(vf);
  let yaw = 0;
  if (alive && v.burnout) yaw = (inp.steer || 0) * 1.6; // pivot on the front wheels
  else if (alive && grounded) {
    // steering gets calmer with speed; countersteer assist pulls the nose back toward where the car is going
    yaw = (inp.steer || 0) * T.turn * clamp(vf / 5, -1, 1) * (1 - 0.45 * Math.min(1, sp / T.max)) * (inp.handbrake ? 1.6 : 1);
    if (vf > 3) yaw -= slipA * (inp.handbrake ? 0.3 : 1.8);
  }
  // spin: tires pull the turn rate toward what the steering asks for (heavy vehicles answer slower); a crash can overpower that
  if (grounded || v.burnout) {
    const gripK = (inp.handbrake ? 2.5 : T.grip * 1.4 * sky.grip) * Math.sqrt(clamp(1.3 / T.mass, 0.35, 1.2));
    v.w = (v.w || 0) + (yaw - (v.w || 0)) * Math.min(1, gripK * dt);
  } else v.w = (v.w || 0) * Math.exp(-(upset ? 2 : 0.6) * dt); // airborne: the spin just dies down
  v.h += v.w * dt;
  v.vx = fx * vf + rx * vr; v.vz = fz * vf + rz * vr;
  const nfx = Math.sin(v.h), nfz = Math.cos(v.h);
  const ox = v.x, oz = v.z;
  v.x += v.vx * dt; v.z += v.vz * dt;
  v.speed = vf;
  v.slip = v.burnout ? 12 : Math.abs(vr) + Math.abs(v.w - yaw) * 2;
  v.upset = upset;
  v.tilt = T.bike ? clamp(-yaw * Math.abs(vf) * 0.03, -0.5, 0.5) : 0;
  let impact = 0;
  v.hit = null;
  // ramps: hitting the tall end is a wall
  let gh = W.groundHeight(v.x, v.z);
  if (gh - v.y > 0.7 || W.offMap(v.x + nfx * T.len / 2, v.z + nfz * T.len / 2)) {
    impact = Math.hypot(v.vx, v.vz);
    v.hit = { imp: impact, cp: [v.x + nfx * T.len / 2, v.z + nfz * T.len / 2], nx: -nfx, nz: -nfz, wall: true };
    v.x = ox; v.z = oz; v.vx *= -0.3; v.vz *= -0.3;
    gh = W.groundHeight(v.x, v.z);
  }
  impact = Math.max(impact, hitWalls(v));
  v.landed = 0;
  if (!W.isLand(v.x, v.z) && v.y < 0.3) {
    v.sinkT += dt; v.vx *= Math.exp(-2.5 * dt); v.vz *= Math.exp(-2.5 * dt);
    v.y = -Math.min(2.2, v.sinkT * 0.8); v.vy = 0; v.air = 0;
  } else {
    v.sinkT = 0;
    const floor = W.isLand(v.x, v.z) ? gh : -5;
    // stick to the road over small dips (hills); real drops still send you flying
    if (v.y > floor + (v.air > 0 ? 0.05 : 0.35) || (v.vy || 0) > 1.5) {
      // take-off: the ramp's slope becomes the car's own tilt, and how fast it was tipping keeps it turning
      if (!(v.air > 0) && !T.bike && v.mode !== 'cop') { v.fr = (v.fr || 0) + (v.gr || 0); v.fp = (v.fp || 0) + (v.gp || 0); v.frV = (v.frV || 0) + (v.grRate || 0) * 0.8; v.gr = v.gp = 0; }
      v.air = (v.air || 0) + dt;
      v.vy = (v.vy || 0) - 22 * dt;
      v.y += v.vy * dt;
      if (v.y <= floor) { v.landed = -v.vy; v.y = floor; v.vy = 0; }
    } else {
      const step = floor - v.y;
      v.vy = dt > 0 ? step / dt : 0;
      if (step < 0.2 && !(v.lastStep > 0.06)) v.vy = Math.min(v.vy, 1.2); // a lone curb is a jolt, not a launch (ramps keep rising)
      v.lastStep = step;
      if (v.vy < 0) v.vy = 0;
      v.y = floor;
      v.lastAir = v.air || 0; v.air = 0;
    }
  }
  if (!(v.air > 0)) alignToGround(v, dt);
  if (!T.bike) impact = Math.max(impact, bodyMotion(v, inp, dt, tn, F, (vf - vf0) / Math.max(dt, 1e-3), vr, alive));
  return impact;
}

// Weight transfer and suspension (springs v.sr roll, v.sp pitch, v.sy heave) plus tipping over (v.fr, v.fp).
// Returns the speed of a side / roof slamming into the ground, with v.hit set for the crash effects.
function bodyMotion(v, inp, dt, tn, F, aLon, vr, alive) {
  const T = v.T, onGround = !(v.air > 0), drive = onGround && !v.upset, sp = Math.abs(v.speed);
  const k = F.roll * (T.hgt / 1.45) / tn.stiff;
  const tr = drive ? clamp(v.w * v.speed * 0.0028 * k, -0.13, 0.13) : 0; // lean out of the turn
  const tp = drive ? (v.burnout ? -0.03 : clamp(-aLon * 0.0022 * k, -0.09, 0.09)) : 0; // nose dives braking, squats accelerating
  // bumps: curbs and dips jolt the body, rough ground shakes it, landings squash it
  const gh = v.y, dg = gh - (v.lastGh ?? gh); v.lastGh = gh;
  if (drive && Math.abs(dg) > 0.03 && Math.abs(dg) < 0.7) { v.syV = (v.syV || 0) + dg * 9; v.spV = (v.spV || 0) - dg * 5; }
  if (drive && v.rough && Math.random() < dt * 7) { const s = Math.min(1, sp / 20); v.srV = (v.srV || 0) + (Math.random() - 0.5) * s; v.spV = (v.spV || 0) + (Math.random() - 0.5) * 0.8 * s; v.syV = (v.syV || 0) + (Math.random() - 0.5) * 0.7 * s; }
  if (v.landed > 2) { v.syV = (v.syV || 0) - Math.min(3, v.landed * 0.12); v.spV = (v.spV || 0) + (Math.random() - 0.5) * v.landed * 0.02; }
  const K = 110 * tn.stiff, D = 9 * Math.sqrt(tn.stiff);
  v.srV = v.srV || 0; v.spV = v.spV || 0; v.syV = v.syV || 0;
  v.srV += ((tr - (v.sr || 0)) * K - v.srV * D) * dt; v.sr = clamp((v.sr || 0) + v.srV * dt, -0.2, 0.2);
  v.spV += ((tp - (v.sp || 0)) * K - v.spV * D) * dt; v.sp = clamp((v.sp || 0) + v.spV * dt, -0.15, 0.15);
  v.syV += (-(v.sy || 0) * K - v.syV * D) * dt; v.sy = clamp((v.sy || 0) + v.syV * dt, -0.15, 0.15);
  if (v.mode === 'cop') return 0;
  // tipping: a car sliding sideways that has started to go over trips and keeps rolling; tripping on a curb or dirt starts it
  if (drive && Math.abs(vr) > 11) v.frV = (v.frV || 0) + vr * (dg > 0.05 ? 0.1 : v.rough ? 0.25 * dt : 0);
  if (v.upset && onGround) v.frV = (v.frV || 0) + Math.sign(vr) * Math.min(Math.abs(vr), 25) * 0.5 * dt;
  const steer = inp.steer || 0;
  if (!onGround) { // air: the nose gently follows the arc; A / D roll, W / S tip the nose a little
    const arc = -Math.atan2(v.vy || 0, Math.max(4, sp)) * 0.8;
    v.frV = (v.frV || 0) - steer * 2.5 * dt;
    v.fpV = (v.fpV || 0) + ((arc - (v.fp || 0)) * 3 - (v.fpV || 0) * 2 + ((inp.throttle || 0) - (inp.brake || 0)) * 0.8) * dt;
  }
  else if (v.upset && sp < 4) v.frV = (v.frV || 0) - steer * 7 * dt; // rock it back over with A / D
  const b = T.hgt * 0.42;
  const sr = tip(v, 'fr', T.wid / 2, b, dt, onGround, 0), spp = tip(v, 'fp', T.len / 2, b, dt, onGround, 2.5);
  // a side or the roof hitting the ground (landing back on the wheels doesn't count)
  const ar = Math.abs(v.fr), ap = Math.abs(v.fp);
  if (sr > 2.2 && ar > 0.8 && !v.hit) {
    const s = ar > 2.4 ? 0 : Math.sign(v.fr), rx = -Math.cos(v.h), rz = Math.sin(v.h);
    v.hit = { imp: sr * 3, cp: [v.x + rx * s * T.wid / 2, v.z + rz * s * T.wid / 2], nx: 0, nz: 0, ly: s ? T.hgt * 0.55 : T.hgt, roof: !s };
    return sr * 3;
  }
  if (spp > 2.2 && ap > 0.8 && !v.hit) {
    const s = ap > 2.4 ? 0 : Math.sign(v.fp), fx = Math.sin(v.h), fz = Math.cos(v.h);
    v.hit = { imp: spp * 3, cp: [v.x + fx * s * T.len / 2, v.z + fz * s * T.len / 2], nx: 0, nz: 0, ly: s ? T.hgt * 0.4 : T.hgt, roof: !s };
    return spp * 3;
  }
  return 0;
}

// ---------- far-away cars: one instanced silhouette each (two draw calls for all of them) ----------
const far = { body: null, cab: null, n: 0, o: new THREE.Object3D(), c: new THREE.Color() };
export function initFarCars(scene) {
  const g = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  far.body = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ roughness: 0.6 }), 260);
  far.cab = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0x2a3440, roughness: 0.3 }), 260);
  for (const m of [far.body, far.cab]) { m.count = 0; m.frustumCulled = false; scene.add(m); }
}
export function farCarsBegin() { far.n = 0; }
export function farCarAdd(v) {
  if (!far.body || far.n >= 260 || v.T.heli || v.T.boat) return false;
  const T = v.T, o = far.o, lo = T.bike ? 0.9 : 0.3 + T.hgt * 0.5;
  o.position.set(v.x, v.y + (T.monster ? 1 : 0.25), v.z); o.rotation.set(v.gp || 0, v.h, v.gr || 0, 'YXZ'); o.scale.set(T.bike ? 0.5 : T.wid, lo, T.len); o.updateMatrix();
  far.body.setMatrixAt(far.n, o.matrix); far.body.setColorAt(far.n, v.exploded ? far.c.setHex(0x2b2b2b) : far.c.setHex(v.color));
  const big = T.bus || T.truck || T.cabbed || T.van;
  o.position.y += lo; o.scale.set(T.wid * 0.86, T.bike ? 0.01 : T.hgt * (big ? 0.45 : 0.4), T.len * (big ? 0.85 : 0.5)); o.updateMatrix();
  far.cab.setMatrixAt(far.n, o.matrix);
  far.n++;
  return true;
}
export function farCarsEnd() {
  if (!far.body) return;
  far.body.count = far.cab.count = far.n;
  far.body.instanceMatrix.needsUpdate = far.cab.instanceMatrix.needsUpdate = true;
  if (far.body.instanceColor) far.body.instanceColor.needsUpdate = true;
}

// Lean with the slope of the ground under the wheels (v.gp pitch, v.gr roll).
export function alignToGround(v, dt) {
  const T = v.T; if (T.bike) return;
  const nfx = Math.sin(v.h), nfz = Math.cos(v.h), hl = T.len * 0.4, hwd = T.wid * 0.45;
  const hf = W.groundHeight(v.x + nfx * hl, v.z + nfz * hl), hb = W.groundHeight(v.x - nfx * hl, v.z - nfz * hl);
  const lx = Math.cos(v.h), lz = -Math.sin(v.h);
  const hL = W.groundHeight(v.x + lx * hwd, v.z + lz * hwd), hR = W.groundHeight(v.x - lx * hwd, v.z - lz * hwd);
  const k = Math.min(1, dt * 10), gr0 = v.gr || 0;
  v.gp = (v.gp || 0) + (clamp(Math.atan2(hb - hf, hl * 2), -0.5, 0.5) - (v.gp || 0)) * k;
  v.gr = gr0 + (clamp(Math.atan2(hL - hR, hwd * 2), -0.4, 0.4) - gr0) * k;
  v.grRate = dt > 0 ? (v.gr - gr0) / dt : 0; // a ramp under one side launches the car rolling
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
  v.touch = { t: performance.now(), cp, nx: c.nx, nz: c.nz };
  const r = resolve(v, o, c, cp, !pushable);
  if (!r) return 0;
  // the lighter car takes more of the shove; traffic cars get knocked loose (simulated here), so they can roll too
  const mo = (o.T && o.T.mass) || 50, ms = v.T.mass + mo;
  kick(v, c.nx, c.nz, r.imp, 2 * mo / ms);
  if ((pushable || o.mode === 'traffic') && o.T) kick(o, -c.nx, -c.nz, r.imp, 2 * v.T.mass / ms);
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

// Pose of a traffic car (filled in by the traffic system).
export function trafficPose(v) { return { x: v.x, z: v.z, h: v.h, vx: v.vx || 0, vz: v.vz || 0 }; }

// Parked cars at the given spots: [{x, z, h}]. More get added as you explore (see main.js).
const PARKED_TYPES = [0, 0, 0, 0, 10, 10, 10, 11, 11, 11, 11, 12, 12, 12, 13, 13, 1, 14, 15, 3, 4, 5, 18];
export function makeParked(id, sp, r = Math.random) {
  const ti = sp.ti ?? PARKED_TYPES[Math.floor(r() * PARKED_TYPES.length)];
  return makeVehicle(id, ti, CAR_COLORS[Math.floor(r() * CAR_COLORS.length)], sp);
}
export function createAllVehicles(scene, spots = []) {
  const list = spots.map((sp, i) => makeParked('p' + i, sp));
  for (const v of list) scene.add(v.mesh);
  return list;
}
