// Townspeople. Most follow fixed routes driven by the shared clock (so everyone sees them in about
// the same place); others sit on benches, sunbathe, chat in groups or talk on the phone at fixed spots.
// When trouble starts they run, cower, call the cops, or (some of them) fight back. Only deaths are networked.
import * as THREE from 'three';
import * as W from './world.js';
import { rng, angDiff } from './util.js';
import { makeCharacter, randomLook, animateCharacter, mat } from './character.js';

const LINES = [
  { d: 8.6, s0: 15, s1: 1085 }, { d: -8.6, s0: 15, s1: 1085 },
  { d: 41.2, s0: 140, s1: 960 }, { d: -41.2, s0: 140, s1: 960 },
  { d: 66, s0: 160, s1: 940 }, { d: 74, s0: 160, s1: 940 },
];
export const RESPAWN_MS = 45000;
export const walkers = [];
export const fleeing = [];
let scene, ctx = { target: () => null, hitPlayer() {}, shot() {} };
export function setNpcContext(c) { ctx = { ...ctx, ...c }; }

// ---------- dogs ----------
function makeDog(color) {
  const g = new THREE.Group();
  const part = (sx, sy, sz, x, y, z, c = color) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat(c)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  part(0.28, 0.28, 0.7, 0, 0.45, 0);
  part(0.24, 0.24, 0.3, 0, 0.62, 0.42);
  part(0.12, 0.1, 0.16, 0, 0.56, 0.62, 0x222222);
  part(0.06, 0.12, 0.06, 0.08, 0.8, 0.38); part(0.06, 0.12, 0.06, -0.08, 0.8, 0.38);
  const tail = part(0.06, 0.06, 0.3, 0, 0.6, -0.45);
  const legs = [];
  for (const [x, z] of [[0.1, 0.25], [-0.1, 0.25], [0.1, -0.25], [-0.1, -0.25]]) {
    const leg = new THREE.Group(); leg.position.set(x, 0.32, z); g.add(leg);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.08), mat(color)); m.position.y = -0.16; leg.add(m);
    legs.push(leg);
  }
  return { g, legs, tail, t: 0 };
}

export function initWalkers(s) {
  scene = s;
  const r = rng(777);
  const add = (w) => {
    w.ch = makeCharacter(randomLook(r));
    scene.add(w.ch.g);
    w.hp = 40; w.dead = null; w.extra = 0; w.panic = 0; w.mode = w.fixed ? 'fixed' : 'path';
    w.temper = r() < 0.2 ? 'brawler' : r() < 0.1 ? 'gunman' : 'normal'; // some people fight back
    w.id = walkers.length; walkers.push(w);
    return w;
  };
  // people on routes (some jog, some walk the dog)
  for (let i = 0; i < 40; i++) {
    const line = LINES[Math.floor(r() * LINES.length)];
    const len = 50 + r() * 120;
    const kind = r();
    const w = add({ d: line.d + (r() - 0.5) * 1.2, sLo: line.s0 + r() * (line.s1 - line.s0 - len), len, speed: 1.1 + r() * 0.7, off: r() * 1000, act: 'walk' });
    if (kind < 0.15) { w.act = 'jog'; w.speed = 3.2 + r(); }
    else if (kind < 0.27) { w.act = 'dog'; w.dog = makeDog([0x8d6e63, 0xf5f5f5, 0x212121, 0xd7a35a][Math.floor(r() * 4)]); scene.add(w.dog.g); }
  }
  // people hanging around
  const benches = (W.env.benches || []).filter(() => r() < 0.6).slice(0, 12);
  for (const b of benches) add({ fixed: { x: b.x, z: b.z, h: b.h, pose: 'sit' }, act: 'sit' });
  const towels = (W.env.towels || []).filter(() => r() < 0.3).slice(0, 10);
  for (const t of towels) add({ fixed: { x: t.x, z: t.z, h: t.h, pose: 'lie' }, act: 'sunbathe' });
  for (let g = 0; g < 6; g++) {
    const s = 160 + r() * 780, side = r() < 0.5 ? 1 : -1, c = W.P(s, side * 9.2);
    const n = 2 + Math.floor(r() * 2);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const x = c.x + Math.cos(a) * 0.9, z = c.z + Math.sin(a) * 0.9;
      add({ fixed: { x, z, h: Math.atan2(c.x - x, c.z - z), pose: 'chat' }, act: 'chat' });
    }
  }
  for (let k = 0; k < 5; k++) {
    const s = 160 + r() * 780, p = W.P(s, (r() < 0.5 ? 1 : -1) * 9.6);
    add({ fixed: { x: p.x, z: p.z, h: r() * 6.28, pose: 'phone' }, act: 'phone' });
  }
}

export function walkerPose(w, tSec) {
  if (w.fixed) return { x: w.fixed.x, z: w.fixed.z, h: w.fixed.h };
  const u = (((w.off + tSec * w.speed + w.extra) % (2 * w.len)) + 2 * w.len) % (2 * w.len);
  const fwd = u < w.len;
  const s = w.sLo + (fwd ? u : 2 * w.len - u);
  const p = W.P(s, w.d);
  return { x: p.x, z: p.z, h: fwd ? -W.theta(s) : -W.theta(s) + Math.PI };
}

export function isAlive(w, nowMs) { return !w.dead || nowMs - w.dead.t > RESPAWN_MS; }

// Something scary happened at (x, z). kind: 'gunfire' | 'attack' | 'explosion'
export function scare(x, z, radius, kind = 'gunfire') {
  for (const w of walkers) {
    if (w.dead || w.mode === 'gone' || w.mode === 'hostile') continue;
    const d = Math.hypot(w.x - x, w.z - z);
    if (d > radius) continue;
    if (w.temper === 'gunman' && d < 30 && kind !== 'explosion' && Math.random() < 0.5) { goHostile(w, 'gun'); continue; }
    if (w.call) continue; // already on the phone to the cops
    if (Math.random() < 0.3) { w.mode = 'cower'; w.modeT = 3 + Math.random() * 3; w.fx = x; w.fz = z; }
    else startFlee(w, x, z);
  }
}
export const panicNear = (x, z, radius) => scare(x, z, radius, 'gunfire');

function startFlee(w, x, z) {
  w.mode = 'flee'; w.modeT = 6 + Math.random() * 4;
  w.fh = Math.atan2(w.x - x, w.z - z) + (Math.random() - 0.5) * 0.8;
}
function goHostile(w, kind) {
  w.mode = 'hostile'; w.hostile = kind; w.modeT = 18; w.cd = kind === 'gun' ? 1.2 : 0.6; w.call = null;
}
// The player hurt this person without killing them.
export function provoke(w) {
  if (w.dead) return;
  if (w.temper === 'brawler') goHostile(w, 'melee');
  else if (w.temper === 'gunman') goHostile(w, 'gun');
  else startFlee(w, w.x - Math.sin(w.h), w.z - Math.cos(w.h));
}

const freeModes = new Set(['flee', 'cower', 'hostile', 'gone']);
export function updateWalkers(dt, tSec, nowMs, cam) {
  const target = ctx.target();
  for (const w of walkers) {
    if (w.dead && nowMs - w.dead.t > RESPAWN_MS) { w.dead = null; w.hp = 40; w.extra += 500; w.mode = w.fixed ? 'fixed' : 'path'; }
    let speed = 0, pose = {};
    if (w.dead) {
      w.x = w.dead.x; w.z = w.dead.z; w.h = w.dead.h;
    } else if (freeModes.has(w.mode)) {
      w.modeT -= dt;
      if (w.mode === 'flee') {
        const p = W.pushOutCircle(w.x + Math.sin(w.fh) * 6 * dt, w.z + Math.cos(w.fh) * 6 * dt, 0.4);
        if (Math.hypot(p.x - w.x, p.z - w.z) < 6 * dt * 0.5) w.fh += 1.2; // blocked: turn
        if (W.isLand(p.x, p.z)) { w.x = p.x; w.z = p.z; } else w.fh += Math.PI;
        w.h = w.fh; speed = 7;
        if (w.modeT <= 0) { w.mode = 'gone'; w.modeT = 25; }
      } else if (w.mode === 'cower') {
        w.h += angDiff(w.h, Math.atan2(w.fx - w.x, w.fz - w.z) + Math.PI) * Math.min(1, dt * 5);
        pose = { cower: true };
        if (w.modeT <= 0) startFlee(w, w.fx, w.fz);
      } else if (w.mode === 'hostile') {
        hostileStep(w, dt, target);
        speed = w.spd || 0;
        pose = { aim: w.hostile === 'gun', weapon: w.hostile === 'gun' ? 'gun' : 'none', swing: w.swing || 0 };
        if (w.modeT <= 0 || !target || target.dead || Math.hypot(target.x - w.x, target.z - w.z) > 70) { startFlee(w, target ? target.x : w.x, target ? target.z : w.z); }
      } else if (w.mode === 'gone') {
        // out of sight for a while, then back to normal life
        if (w.modeT <= 0) { w.mode = w.fixed ? 'fixed' : 'path'; w.extra += 300; }
      }
    } else {
      if (w.panic > 0) { w.panic -= dt; w.extra += dt * w.speed * 2.6; }
      const p = walkerPose(w, tSec);
      w.x = p.x; w.z = p.z; w.h = p.h;
      speed = w.call ? 0 : w.mode === 'fixed' ? 0 : w.act === 'jog' ? 7 : w.panic > 0 ? 6 : w.speed * 1.4;
      if (w.fixed) pose = { sit: w.fixed.pose === 'sit', lie: w.fixed.pose === 'lie', chat: w.fixed.pose === 'chat', phone: w.fixed.pose === 'phone' };
    }
    const hidden = w.mode === 'gone' && !w.dead;
    const far = hidden || Math.abs(w.x - cam.x) > 160 || Math.abs(w.z - cam.z) > 160;
    w.ch.g.visible = !far;
    if (w.dog) w.dog.g.visible = !far && !w.dead;
    if (far) continue;
    w.ch.g.position.set(w.x, w.fixed && !w.dead && w.mode === 'fixed' ? (w.fixed.pose === 'sit' ? -0.35 : 0) : 0, w.z);
    w.ch.g.rotation.y = w.h;
    animateCharacter(w.ch, dt, { speed, dead: !!w.dead, phone: !!w.call || pose.phone, ...pose });
    if (w.dog && !w.dead) {
      const d = w.dog, side = 0.8;
      const tx = w.x - Math.sin(w.h) * 1.1 + Math.cos(w.h) * side, tz = w.z - Math.cos(w.h) * 1.1 - Math.sin(w.h) * side;
      const dx = tx - d.g.position.x, dz = tz - d.g.position.z, dd = Math.hypot(dx, dz);
      if (dd > 6) d.g.position.set(tx, 0, tz);
      else { d.g.position.x += dx * Math.min(1, dt * 6); d.g.position.z += dz * Math.min(1, dt * 6); }
      if (dd > 0.05) d.g.rotation.y = Math.atan2(dx, dz);
      d.t += dt * (2 + speed * 3);
      d.legs.forEach((l, i) => { l.rotation.x = Math.sin(d.t + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * Math.min(0.8, speed * 0.2); });
      d.tail.rotation.y = Math.sin(d.t * 3) * 0.5;
    }
  }
  for (let i = fleeing.length - 1; i >= 0; i--) {
    const f = fleeing[i];
    f.t -= dt;
    if (f.down > 0) {
      f.down -= dt;
      f.ch.g.position.set(f.x, 0, f.z); f.ch.g.rotation.y = f.h + Math.PI;
      animateCharacter(f.ch, dt, { dead: true });
      continue;
    }
    const p = W.pushOutCircle(f.x + Math.sin(f.h) * 6 * dt, f.z + Math.cos(f.h) * 6 * dt, 0.4);
    f.x = p.x; f.z = p.z;
    f.ch.g.position.set(f.x, 0, f.z); f.ch.g.rotation.y = f.h;
    animateCharacter(f.ch, dt, { speed: 7 });
    if (f.t <= 0) { scene.remove(f.ch.g); fleeing.splice(i, 1); }
  }
}

// A townsperson who decided to fight: close in and punch, or keep distance and shoot.
function hostileStep(w, dt, t) {
  w.spd = 0;
  if (!t || t.dead) return;
  const dx = t.x - w.x, dz = t.z - w.z, d = Math.hypot(dx, dz);
  w.h += angDiff(w.h, Math.atan2(dx, dz)) * Math.min(1, dt * 8);
  let move = 0;
  if (w.hostile === 'melee') move = d > 1.3 ? 5.5 : 0;
  else move = d > 16 ? 4.5 : d < 7 ? -2 : 0;
  if (t.inVeh && w.hostile === 'melee') move = d > 3 ? 5 : 0;
  if (move) {
    const p = W.pushOutCircle(w.x + (dx / d) * move * dt, w.z + (dz / d) * move * dt, 0.4);
    if (W.isLand(p.x, p.z)) { w.x = p.x; w.z = p.z; }
    w.spd = Math.abs(move) + 1;
  }
  w.cd -= dt;
  if (w.swing) w.swing = Math.max(0, w.swing - dt * 3);
  if (w.cd > 0) return;
  if (w.hostile === 'melee' && d < 1.6 && !t.inVeh) {
    w.cd = 0.9; w.swing = 1;
    ctx.hitPlayer(6 + Math.random() * 5, 'an angry local', w);
  } else if (w.hostile === 'gun' && d < 35 && W.lineOfSight(w.x, 1.4, w.z, t.x, 1.2, t.z)) {
    w.cd = 1.3 + Math.random() * 0.8;
    const hit = Math.random() < (t.inVeh ? 0.12 : 0.25);
    ctx.shot(w, hit ? { x: t.x, y: 1.2, z: t.z } : { x: t.x + (Math.random() - 0.5) * 4, y: 1.2, z: t.z + (Math.random() - 0.5) * 4 });
    if (hit) ctx.hitPlayer(7 + Math.random() * 4, 'an armed local', w);
  }
}

export function spawnFleeing(x, z, h, down = 0) {
  const ch = makeCharacter(randomLook());
  scene.add(ch.g);
  fleeing.push({ ch, x, z, h, t: 7 + down, down });
}
