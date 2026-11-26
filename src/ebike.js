// E-bikes: "Arnett Bike" docks round the Quad Cities riverfront, renting, returning, the rider's pedalling
// and the quiet motor. The vehicle itself is TYPES 'E-bike' (vehicles.js, bike physics) with its model in
// ebikemodel.js; it syncs online like any other vehicle (net.js), and other players see you pedal.
//
// The Quad Cities has no docked bike share today. The two real rental points are the free Visit Quad Cities
// bike rentals at Davenport's Union Station and Moline's RiverStation; the rest sit where a share system would:
// riverfront trail heads, downtowns, Augustana and the riverfront parks.
import * as THREE from 'three';
import { V } from './vehicles.js';
import { buildDockMesh, loadEbikeModel, ebikeModelReady, RIG } from './ebikemodel.js';
import { eco, spend } from './economy.js';
import * as fx from './fx.js';
import * as ui from './ui.js';
import * as W from './world.js';

export const FEE = 5; // to unlock a dock bike; free to ride as long as you like, and free to drop at any dock
const BIKE_COLOR = 0x1e6fd0; // Arnett Bike blue
// x, z: game metres (the dock's middle, on the path or sidewalk), h: faces the street
export const DOCKS = [
  { name: 'Union Station', town: 'Davenport', x: 35, z: 430.7, h: 1.57, real: true }, // Visit Quad Cities bike rental, 102 S Harrison St
  { name: 'Modern Woodmen Park', town: 'Davenport', x: -447.2, z: 574.5, h: -1.55 }, // riverfront trail by the ballpark
  { name: 'Village of East Davenport', town: 'Davenport', x: 2928.1, z: -700.1, h: -0.23 }, // Lindsay Park, River Dr
  { name: 'Credit Island', town: 'Davenport', x: -3249, z: 2827.5, h: -2.38 },
  { name: 'Leach Park', town: 'Bettendorf', x: 5111.4, z: 18, h: 2.51 }, // Bettendorf riverfront trail
  { name: 'Schwiebert Park', town: 'Rock Island', x: 298.1, z: 1232.8, h: -0.04 }, // downtown Rock Island riverfront
  { name: 'Augustana College', town: 'Rock Island', x: 2131.2, z: 2314.6, h: -0.01 },
  { name: 'RiverStation', town: 'Moline', x: 5183.1, z: 1608.3, h: 0.42, real: true }, // Visit Quad Cities bike rental, 1601 River Dr
  { name: 'WIU Riverfront', town: 'Moline', x: 7066.4, z: 1147.3, h: 0.1 }, // Western Illinois University QC campus
  { name: 'The Bend', town: 'East Moline', x: 10147, z: 529, h: 1.68 },
];
const SLOTS = [-1.5, -0.75, 0, 0.75, 1.5]; // bikes stand at these local x, z = 0, facing +z (the street)
const STOCK = 4; // bikes put in a dock when you first come near (one post left free to drop at)

let ctx = null;
// ctx from main.js: { scene, vehicles(), add(v), remove(v), make(id, ti, color, home), newId(tag), myVeh(), writeVeh(v, force) }
export function initEbikes(c) { ctx = c; loadEbikeModel(); }

const slotPos = (d, s) => ({ x: d.x + Math.cos(d.h) * SLOTS[s], z: d.z - Math.sin(d.h) * SLOTS[s], h: d.h });
const ebikes = () => ctx.vehicles().filter((v) => v.T.ebike);
function slotTaken(d, s, list) { const p = slotPos(d, s); return list.some((v) => Math.abs(v.x - p.x) < 0.5 && Math.abs(v.z - p.z) < 0.5); }

// ---------- docks near you: the station mesh and its bikes ----------
const built = new Map(); // dock index -> { mesh, stocked }
let manT = 0;
function manageDocks(px, pz) {
  if (!ebikeModelReady()) return;
  const list = ebikes();
  DOCKS.forEach((d, i) => {
    const dist = Math.hypot(d.x - px, d.z - pz);
    let b = built.get(i);
    if (dist < 320 && !b && hasGround(d)) {
      const mesh = buildDockMesh(); if (!mesh) return;
      mesh.position.set(d.x, W.groundHeight(d.x, d.z), d.z); mesh.rotation.y = d.h;
      ctx.scene.add(mesh); built.set(i, (b = { mesh, stocked: false }));
    }
    if (b && dist > 420) { // gone: the station and the bikes still sitting in it
      ctx.scene.remove(b.mesh); built.delete(i);
      for (const v of list) if (v.dock && v.dock.i === i && !v.driver && ctx.myVeh() !== v) ctx.remove(v);
      return;
    }
    if (b && !b.stocked) {
      b.stocked = true;
      for (let s = 0; s < STOCK; s++) if (!slotTaken(d, s, list)) dockBike(i, s);
    }
  });
}
// a tile's ground has streamed in under the dock (groundHeight is 0 before that)
const hasGround = (d) => W.tiles.has(`${Math.floor(d.x / 200)}_${Math.floor(d.z / 200)}`);
function dockBike(i, s) {
  const d = DOCKS[i], p = slotPos(d, s);
  const v = ctx.make(ctx.newId('eb'), V.EBIKE, BIKE_COLOR, { x: p.x, z: p.z, h: p.h });
  v.dock = { i, s }; v.keep = true; v.stolenOnce = true; // a dock bike is rented, not stolen
  ctx.add(v);
  return v;
}

// ---------- renting (E at a docked bike) and returning (leave it by any dock) ----------
// Called before you walk up to a vehicle; false = don't get on.
export function beforeEnter(v) {
  if (!v || !v.T.ebike || !v.dock) return true;
  if (eco.cash < FEE) { ui.flashPrompt(`Arnett Bike: $${FEE} to unlock`); return false; }
  spend(FEE); fx.soundCash();
  ui.flashPrompt(`Arnett Bike unlocked · -$${FEE}`);
  v.dock = null; v.rented = true; v.keep = true;
  return true;
}
function returnBikes() {
  const me = ctx.myVeh();
  for (const v of ebikes()) {
    if (!v.rented || !v.ridden || v.driver || v === me || Math.hypot(v.vx || 0, v.vz || 0) > 0.5 || v.exploded) continue;
    for (const i of built.keys()) {
      const d = DOCKS[i]; if (Math.hypot(v.x - d.x, v.z - d.z) > 12) continue;
      const list = ebikes().filter((o) => o !== v);
      const s = SLOTS.findIndex((_, k) => !slotTaken(d, k, list)); if (s < 0) continue;
      const p = slotPos(d, s);
      v.x = p.x; v.z = p.z; v.h = p.h; v.vx = v.vz = 0; v.localSim = false; v.mode = 'parked';
      v.rented = false; v.ridden = false; v.dock = { i, s };
      ctx.writeVeh(v, true);
      ui.flashPrompt(`Bike returned to ${d.name}`);
      break;
    }
  }
}
// someone else took the bike from this slot on their screen: drop our copy of it
function dropDuplicates() {
  const list = ebikes();
  for (const v of list) {
    if (!v.dock || v.driver || ctx.myVeh() === v) continue;
    if (list.some((o) => o !== v && o.remote && o.driver && Math.hypot(o.x - v.x, o.z - v.z) < 1)) ctx.remove(v);
  }
}

// ---------- the rider: legs follow the pedals (two-bone IK in the bike's side plane), hands on the bars ----------
const tv = new THREE.Vector3(), tq = new THREE.Quaternion();
const DEG = 180 / Math.PI;
function legLens(ch) {
  if (ch._bk) return ch._bk;
  const b = ch.bones; if (!b || !b.thighL || !b.shinL || !b.footL) return null;
  ch.g.updateMatrixWorld(true);
  const w = (o) => o.getWorldPosition(new THREE.Vector3());
  const s = ch.g.getWorldScale(new THREE.Vector3()).y || 1;
  ch._bk = { a: w(b.thighL).distanceTo(w(b.shinL)) / s, c: w(b.shinL).distanceTo(w(b.footL)) / s };
  return ch._bk;
}
// one leg: hip and ankle target (y up, z forward) -> pose x angles [thigh, shin, foot]
function leg(a, c, hy, hz, ty, tz, out, k) {
  const dy = ty - hy, dz = tz - hz;
  const D = Math.min(a + c - 0.004, Math.max(Math.abs(a - c) + 0.02, Math.hypot(dy, dz)));
  const phi = Math.atan2(dz, -dy), al = Math.acos(Math.min(1, Math.max(-1, (a * a + D * D - c * c) / (2 * a * D))));
  const be = Math.acos(Math.min(1, Math.max(-1, (a * a + c * c - D * D) / (2 * a * c))));
  const th = -(phi + al) * DEG, sh = (Math.PI - be) * DEG;
  out[k] = th; out[k + 1] = sh; out[k + 2] = -(th + sh) + 8;
}
// Seat a person on an e-bike and pose them. pedaling: the motor's assisting (you're pushing the pedals round).
// Returns the animateCharacter state; the caller animates (so the weapon and the rest stay theirs).
export function rideEbike(ch, v, dt, pedaling) {
  const sp = Math.hypot(v.vx || 0, v.vz || 0);
  if (v.driver) { v.ridden = true; v.dock = null; } // out of the rack (a stolen dock bike too)
  if (pedaling) v.crankA = (v.crankA || 0) + (Math.max(sp, 2.2) / 0.35) * 0.36 * dt;
  const P = v.mesh.userData.parts; if (P && P.crank) P.crank.rotation.x = v.crankA || 0;
  const body = v.mesh.userData.body, root = body && body.children[0];
  const L = legLens(ch);
  const hip = ch._hipL || (ch._hipL = new THREE.Vector3(0.09, 0.53, 0));
  // character origin in bike space: the hips just above the saddle
  const ox = 0, oy = RIG.seat.y + 0.07 - hip.y, oz = RIG.seat.z + 0.02 - hip.z;
  if (root) {
    root.updateWorldMatrix(true, false);
    tv.set(ox, oy, oz); root.localToWorld(tv); ch.g.position.copy(tv);
    root.getWorldQuaternion(tq); ch.g.quaternion.copy(tq);
  } else { ch.g.position.set(v.x, v.y + 0.2, v.z); ch.g.rotation.set(0, v.h, v.tilt || 0); }
  const legs = [-60, 80, -10, -60, 80, -10];
  if (L) {
    const a0 = v.crankA || 0, cr = RIG.crank, ay = 0.075; // the ankle sits a little above the pedal
    const by = RIG.bb.y - oy, bz = RIG.bb.z - oz;
    leg(L.a, L.c, hip.y, hip.z, by + Math.cos(a0) * cr + ay, bz + Math.sin(a0) * cr - 0.03, legs, 0);
    leg(L.a, L.c, hip.y, hip.z, by - Math.cos(a0) * cr + ay, bz - Math.sin(a0) * cr - 0.03, legs, 3);
  }
  return { sit: true, pedal: { legs, lean: 16, reach: [-62, 8, -28] } };
}
// after animateCharacter: remember where the hip joint ended up (character space), for the next frame's seat
export function afterRide(ch) {
  const t = ch.bones && ch.bones.thighL; if (!t) return;
  ch.g.updateMatrixWorld(true);
  t.getWorldPosition(tv); ch.g.worldToLocal(tv);
  const h = ch._hipL || (ch._hipL = new THREE.Vector3());
  h.y += (tv.y - h.y) * 0.5; h.z += (tv.z - h.z) * 0.5; h.x = Math.abs(tv.x);
}

// ---------- sound: a soft motor whine while assisting, the freewheel ticking when you coast, a bell ----------
let whine = null, tickAcc = 0;
export function ebikeSound(v, fwd, dt) {
  fx.setEngine(null);
  const { ac, noise, out } = fx.audio(); if (!ac || !out) return;
  if (!whine) {
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o1.type = 'sine'; o2.type = 'triangle'; f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.8;
    o1.connect(f); o2.connect(f); f.connect(g); g.gain.value = 0; g.connect(out); o1.start(); o2.start();
    whine = { o1, o2, g };
  }
  const sp = Math.abs(v.speed || 0), s = Math.min(1.3, sp / v.T.max), t = ac.currentTime;
  const on = fwd > 0 && v.hp > 0 && s < 1.02; // the assist stops at its 32 km/h limit
  whine.o1.frequency.setTargetAtTime(520 + 1100 * s, t, 0.08); whine.o2.frequency.setTargetAtTime((520 + 1100 * s) * 1.5, t, 0.08);
  whine.g.gain.setTargetAtTime(on ? 0.012 + 0.016 * Math.min(1, s * 2) : 0, t, on ? 0.12 : 0.25);
  // freewheel: the pawls click faster the quicker the back wheel turns
  if (fwd <= 0 && sp > 0.8 && noise) {
    tickAcc += dt * Math.min(38, sp * 4.2);
    while (tickAcc >= 1) { tickAcc -= 1; click(ac, noise, out, t + Math.random() * 0.02, 0.025 + Math.min(0.02, sp * 0.002)); }
  } else tickAcc = 0;
}
export function stopEbikeSound() { if (whine && fx.audio().ac) whine.g.gain.setTargetAtTime(0, fx.audio().ac.currentTime, 0.1); }
function click(ac, noise, out, t, vol) {
  const s = ac.createBufferSource(); s.buffer = noise;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 4200 + Math.random() * 800; f.Q.value = 3;
  const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.012);
  s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + 0.015);
}
// H on an e-bike: ding-ding
export function bell(dist = 0) {
  const { ac, out } = fx.audio(); if (!ac || !out) return;
  const k = 0.09 * Math.max(0, 1 - dist / 80); if (k < 0.005) return;
  for (const t0 of [0, 0.16]) for (const [f, m] of [[2650, 1], [5300, 0.25], [7100, 0.12]]) {
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + t0;
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(k * m, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.75);
  }
}

// ---------- per frame ----------
export function updateEbikes(dt, px, pz) {
  if (!ctx) return;
  const mine = ctx.myVeh();
  if (!mine || !mine.T.ebike) stopEbikeSound();
  if ((manT -= dt) > 0) return; manT = 0.5;
  manageDocks(px, pz);
  returnBikes();
  dropDuplicates();
}
// map: every dock (tier 1); the minimap gets the ones within r
export function blips(x, z, r = Infinity) {
  const out = [];
  for (const d of DOCKS) if (Math.hypot(d.x - x, d.z - z) < r) out.push({ x: d.x, z: d.z, type: 'ebike', name: `Arnett Bike: ${d.name}` });
  return out;
}
