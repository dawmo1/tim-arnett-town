// Ambulances and fire trucks. Someone goes down near you: an ambulance comes from the nearest
// hospital (sirens on, traffic pulls over), paramedics kneel by them and, if it isn't too late,
// get them back on their feet. A car catches fire: a fire truck comes and puts it out before it blows.
// Local to each player, like traffic.
import * as W from './world.js';
import { makeVehicle, stepVehicle, V } from './vehicles.js';
import { makeCharacter, animateCharacter, placeCharacter, disposeCharacter } from './character.js';
import { angDiff, clamp } from './util.js';
import * as fx from './fx.js';

let scene, ctx;
const units = [];
const downs = []; // walkers waiting for help
const fires = new Set(); // burning vehicles already handled
let nextId = 0;
export function initEmergency(s, c) { scene = s; ctx = c; }

// Called when a townsperson is killed or badly hurt.
export function reportDown(w) { if (!downs.some((d) => d.w === w)) downs.push({ w, age: 0 }); }

function spawnUnit(kind, tx, tz, target) {
  const bases = kind === 'amb' ? W.places.hospitals : W.places.fire;
  const base = (bases || []).filter((b) => Math.hypot(b.x - tx, b.z - tz) < 900).sort((a, b) => Math.hypot(a.x - tx, a.z - tz) - Math.hypot(b.x - tx, b.z - tz))[0];
  // fires can't wait: a truck already out on the streets nearby takes the call
  const sp = (base && kind === 'amb' && W.roadNear(base.x, base.z, tx, tz)) || (kind === 'fire' ? W.roadSpot(tx, tz, 90, 140) : W.roadSpot(tx, tz, 170, 260));
  if (!sp) return null;
  const v = makeVehicle('e' + nextId++, kind === 'amb' ? V.AMBULANCE : V.FIRE, kind === 'amb' ? 0xf4f4f4 : 0xc62828, sp);
  v.mode = 'service'; v.npcDriver = true; v.sirenOn = true;
  ctx.add(v);
  const u = { kind, v, target, state: 'drive', pathT: 0, path: null, pi: 0, crew: [], t: 0, stuck: 0 };
  units.push(u);
  return u;
}

// drive along the streets toward (gx, gz); returns distance left
function drive(u, gx, gz, dt, slowAt) {
  const v = u.v, dist = Math.hypot(gx - v.x, gz - v.z);
  u.pathT -= dt;
  if (u.pathT <= 0) { u.pathT = 3; u.path = dist > 35 ? W.route(v.x, v.z, gx, gz, { any: true, heading: v.h }) : null; u.pi = 0; }
  let tx = gx, tz = gz;
  if (u.path && dist > 25) { while (u.pi < u.path.length - 1 && Math.hypot(u.path[u.pi][0] - v.x, u.path[u.pi][1] - v.z) < 11) u.pi++; tx = u.path[u.pi][0]; tz = u.path[u.pi][1]; }
  const ad = angDiff(v.h, Math.atan2(tx - v.x, tz - v.z));
  const stopping = dist < slowAt + Math.abs(v.speed) * 0.8;
  let inp = stopping ? { throttle: 0, brake: v.speed > 0.4 ? 1 : 0, steer: clamp(ad * 2, -1, 1) } : { throttle: Math.abs(ad) > 0.7 && v.speed > 10 ? 0 : 0.85, brake: Math.abs(ad) > 0.9 && v.speed > 12 ? 0.6 : 0, steer: clamp(ad * 2, -1, 1) };
  if (u.rev > 0) { u.rev -= dt; inp = { throttle: 0, brake: 1, steer: -inp.steer }; }
  else if (!stopping && Math.abs(v.speed) < 1) { u.stuck += dt; if (u.stuck > 2) { u.rev = 1.2; u.stuck = 0; } }
  else u.stuck = 0;
  stepVehicle(v, inp, dt);
  return dist;
}

function crewOut(u, n, look) {
  const v = u.v;
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1, x = v.x + Math.cos(v.h) * side * 1.8, z = v.z - Math.sin(v.h) * side * 1.8;
    const ch = makeCharacter(look(), { hat: u.kind === 'fire' ? undefined : undefined });
    scene.add(ch.g);
    u.crew.push({ ch, x, z, h: v.h });
  }
}
const medicLook = () => [[0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524][Math.floor(Math.random() * 4)], 0x1e88e5, 0x1a237e, 0x3b2314, 8 | 64];
const fireLook = () => [[0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524][Math.floor(Math.random() * 4)], 0x5d4037, 0x3e2723, 0x111111, 1 | 8 | 64 | (5 << 9)];
// walk crew member c toward (x, z); true when there
function walkTo(c, x, z, dt, near = 0.9) {
  const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz);
  if (d < near) { c.spd = 0; return true; }
  const p = W.pushOutCircle(c.x + (dx / d) * 3.2 * dt, c.z + (dz / d) * 3.2 * dt, 0.4);
  c.x = p.x; c.z = p.z; c.h += angDiff(c.h, Math.atan2(dx, dz)) * Math.min(1, dt * 8); c.spd = 3.2 * 1.45;
  return false;
}
function removeUnit(u) {
  for (const c of u.crew) { scene.remove(c.ch.g); disposeCharacter(c.ch); }
  u.crew = [];
  if (u.v.mode === 'service') ctx.remove(u.v);
  units.splice(units.indexOf(u), 1);
}

export function updateEmergency(dt, focus, cam, tSec) {
  // dispatch: one ambulance and one fire truck at a time, only for things near you
  if (focus) {
    for (let i = downs.length - 1; i >= 0; i--) {
      const d = downs[i], w = d.w;
      d.age += dt;
      const gone = !w.dead && !(w.ch && w.ch.rag);
      if (gone || Math.hypot(w.x - focus.x, w.z - focus.z) > 250 || d.age > 120) { downs.splice(i, 1); continue; }
      if (!units.some((u) => u.kind === 'amb') && d.age > 3) { if (spawnUnit('amb', w.x, w.z, d)) downs.splice(i, 1); }
    }
    for (const v of ctx.vehicles()) {
      if (!v.burnAt || v.exploded || fires.has(v) || Math.hypot(v.x - focus.x, v.z - focus.z) > 250 || units.some((u) => u.kind === 'fire')) continue;
      fires.add(v);
      spawnUnit('fire', v.x, v.z, v);
    }
  }
  const flash = Math.floor(tSec * 6) % 2;
  for (const u of [...units]) {
    const v = u.v;
    u.t += dt;
    // stolen or wrecked: the crew runs off, the job is over
    if (v.mode !== 'service') { for (const c of u.crew) { scene.remove(c.ch.g); disposeCharacter(c.ch); } u.crew = []; units.splice(units.indexOf(u), 1); continue; }
    const L = v.mesh.userData.lights;
    if (L) { L[0].color.setHex(flash ? 0xff1744 : 0x550000); L[1].color.setHex(flash ? 0x550000 : u.kind === 'fire' ? 0xff1744 : 0xfff3e0); }
    const tgt = u.kind === 'amb' ? u.target.w : u.target;
    if (u.state === 'drive') {
      const tx = tgt.x, tz = tgt.z;
      const dist = drive(u, tx, tz, dt, u.kind === 'amb' ? 10 : 12);
      const done = u.kind === 'fire' ? !tgt.burnAt || tgt.exploded : !tgt.dead && !(tgt.ch && tgt.ch.rag);
      if (done || u.t > 90) { u.state = 'leave'; u.t = 0; continue; }
      if (dist < (u.kind === 'amb' ? 16 : 18) && Math.abs(v.speed) < 1.5) { u.state = 'work'; u.t = 0; v.sirenOn = false; crewOut(u, 2, u.kind === 'amb' ? medicLook : fireLook); }
    } else if (u.state === 'work') {
      stepVehicle(v, { handbrake: true }, dt);
      let all = true;
      for (const [i, c] of u.crew.entries()) {
        const side = i % 2 ? 1 : -1;
        // firefighters spray from a few metres away; medics kneel right beside the person
        const gx = u.kind === 'fire' ? tgt.x : tgt.x + Math.cos(tgt.h || 0) * side * 0.9, gz = u.kind === 'fire' ? tgt.z : tgt.z - Math.sin(tgt.h || 0) * side * 0.9;
        c.tries = (c.tries || 0) + dt;
        const there = walkTo(c, gx, gz, dt, u.kind === 'fire' ? 5.5 : 0.7) || c.tries > 8;
        if (there) c.spd = 0;
        if (there) { c.h += angDiff(c.h, Math.atan2(tgt.x - c.x, tgt.z - c.z)) * Math.min(1, dt * 6); c.work = (c.work || 0) + dt; }
        all = all && there;
        if (u.kind === 'fire' && there && Math.random() < 0.6) fx.smokePuff(c.x + (tgt.x - c.x) * 0.6, W.groundHeight(c.x, c.z) + 1.2, c.z + (tgt.z - c.z) * 0.6, false, 0.5);
      }
      const workT = u.crew.length ? Math.min(...u.crew.map((c) => c.work || 0)) : 0;
      if (all && workT > (u.kind === 'amb' ? 5 : 2.5)) {
        if (u.kind === 'amb') ctx.revive(tgt); else ctx.extinguish(tgt);
        u.state = 'return'; u.t = 0;
      }
      if (u.kind === 'fire' && (tgt.exploded || !tgt.burnAt) && u.state === 'work') { u.state = 'return'; u.t = 0; }
      if (u.t > 40) { u.state = 'return'; u.t = 0; }
    } else if (u.state === 'return') {
      stepVehicle(v, { handbrake: true }, dt);
      let all = true;
      for (const c of u.crew) all = walkTo(c, v.x, v.z, dt, 2.2) && all;
      if (all || u.t > 15) { for (const c of u.crew) { scene.remove(c.ch.g); disposeCharacter(c.ch); } u.crew = []; u.state = 'leave'; u.t = 0; u.away = W.roadSpot(v.x, v.z, 300, 400); u.pathT = 0; }
    } else if (u.state === 'leave') {
      if (!u.away) u.away = W.roadSpot(v.x, v.z, 300, 400) || { x: v.x + 300, z: v.z };
      drive(u, u.away.x, u.away.z, dt, 5);
      const d = focus ? Math.hypot(v.x - focus.x, v.z - focus.z) : 999;
      let hidden = true;
      if (cam) { const dx = v.x - cam.x, dz = v.z - cam.z; hidden = (dx * cam.fx + dz * cam.fz) / (Math.hypot(dx, dz) || 1) < 0.2; }
      if ((d > 220 && hidden) || d > 400 || u.t > 60) { removeUnit(u); continue; }
    }
    for (const c of u.crew) {
      placeCharacter(c.ch, c.x, W.groundHeight(c.x, c.z), c.z, c.h);
      animateCharacter(c.ch, dt, c.spd > 0.1 ? { speed: c.spd } : u.kind === 'amb' && u.state === 'work' ? { cower: true } : { reach: true });
    }
  }
}
export const emergencyUnits = units;
