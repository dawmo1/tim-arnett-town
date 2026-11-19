// Walkers follow fixed back-and-forth routes driven by the shared clock, so every player
// sees them in about the same place. Only deaths are sent over the network.
import * as W from './world.js';
import { rng } from './util.js';
import { makeCharacter, randomLook, animateCharacter } from './character.js';

const LINES = [
  { d: 8.6, s0: 15, s1: 1085 }, { d: -8.6, s0: 15, s1: 1085 },
  { d: 41.2, s0: 140, s1: 960 }, { d: -41.2, s0: 140, s1: 960 },
  { d: 66, s0: 160, s1: 940 }, { d: 74, s0: 160, s1: 940 },
];
export const RESPAWN_MS = 45000;
export const walkers = [];
export const fleeing = [];
let scene;

export function initWalkers(s) {
  scene = s;
  const r = rng(777);
  for (let i = 0; i < 44; i++) {
    const line = LINES[Math.floor(r() * LINES.length)];
    const len = 50 + r() * 120;
    const ch = makeCharacter(randomLook(r));
    scene.add(ch.g);
    walkers.push({
      id: i, d: line.d + (r() - 0.5) * 1.2, sLo: line.s0 + r() * (line.s1 - line.s0 - len), len,
      speed: 1.1 + r() * 0.7, off: r() * 1000, extra: 0, panic: 0, hp: 40, dead: null, ch, x: 0, z: 0, h: 0, moving: 0,
    });
  }
}

export function walkerPose(w, tSec) {
  const u = (((w.off + tSec * w.speed + w.extra) % (2 * w.len)) + 2 * w.len) % (2 * w.len);
  const fwd = u < w.len;
  const s = w.sLo + (fwd ? u : 2 * w.len - u);
  const p = W.P(s, w.d);
  return { x: p.x, z: p.z, h: fwd ? -W.theta(s) : -W.theta(s) + Math.PI };
}

export function isAlive(w, nowMs) { return !w.dead || nowMs - w.dead.t > RESPAWN_MS; }

export function updateWalkers(dt, tSec, nowMs, cam) {
  for (const w of walkers) {
    if (w.dead && nowMs - w.dead.t > RESPAWN_MS) { w.dead = null; w.hp = 40; w.extra += 500; }
    if (w.dead) {
      w.x = w.dead.x; w.z = w.dead.z; w.h = w.dead.h;
    } else {
      if (w.panic > 0) { w.panic -= dt; w.extra += dt * w.speed * 2.6; }
      const p = walkerPose(w, tSec);
      w.x = p.x; w.z = p.z; w.h = p.h;
    }
    const far = Math.abs(w.x - cam.x) > 160 || Math.abs(w.z - cam.z) > 160;
    w.ch.g.visible = !far;
    if (far) continue;
    w.ch.g.position.set(w.x, 0, w.z);
    w.ch.g.rotation.y = w.h;
    animateCharacter(w.ch, dt, { speed: w.panic > 0 ? 6 : w.speed * 1.4, dead: !!w.dead });
  }
  for (let i = fleeing.length - 1; i >= 0; i--) {
    const f = fleeing[i];
    f.t -= dt;
    const p = W.pushOutCircle(f.x + Math.sin(f.h) * 6 * dt, f.z + Math.cos(f.h) * 6 * dt, 0.4);
    f.x = p.x; f.z = p.z;
    f.ch.g.position.set(f.x, 0, f.z); f.ch.g.rotation.y = f.h;
    animateCharacter(f.ch, dt, { speed: 7 });
    if (f.t <= 0) { scene.remove(f.ch.g); fleeing.splice(i, 1); }
  }
}

export function panicNear(x, z, radius) {
  for (const w of walkers) if (!w.dead && Math.hypot(w.x - x, w.z - z) < radius) w.panic = 6;
}

export function spawnFleeing(x, z, h) {
  const ch = makeCharacter(randomLook());
  scene.add(ch.g);
  fleeing.push({ ch, x, z, h, t: 7 });
}
