// Townspeople. Most follow fixed routes driven by the shared clock (so everyone sees them in about
// the same place); others sit on benches, sunbathe, chat in groups or talk on the phone at fixed spots.
// When trouble starts they run, cower, call the cops, or (some of them) fight back. Only deaths are networked.
import * as THREE from 'three';
import * as W from './world.js';
import { rng, angDiff } from './util.js';
import { makeCharacter, randomLook, animateCharacter, placeCharacter, mat } from './character.js';
import { ragdoll, release, ragPos } from './ragdoll.js';
import * as nav from './nav.js';

export const RESPAWN_MS = 45000;
export const walkers = [];
export const fleeing = [];
let scene, ctx = { target: () => null, hitPlayer() {}, shot() {}, vehicles: () => [], threat: () => null };
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
}

export function walkerPose(w, tSec) {
  if (w.fixed) return { x: w.fixed.x, z: w.fixed.z, h: w.fixed.h };
  const u = (((w.off + tSec * w.speed + w.extra) % (2 * w.len)) + 2 * w.len) % (2 * w.len);
  const fwd = u < w.len;
  const s = w.sLo + (fwd ? u : 2 * w.len - u);
  return { x: w.x, z: w.z, h: w.h, s, fwd };
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

// Free-roaming people get a navigation agent so they path around buildings and each other.
function needAgent(w, speed) {
  if (!w.agent) w.agent = nav.addAgent(w.x, w.z, speed);
  else nav.setSpeed(w.agent, speed);
  return w.agent;
}
function dropAgent(w) { if (w.agent) { nav.removeAgent(w.agent); w.agent = null; } }
function startFlee(w, x, z, short) {
  w.mode = 'flee'; w.modeT = short ? 2.5 : 6 + Math.random() * 4; w.fx = x; w.fz = z; w.retarget = 0;
  w.fh = Math.atan2(w.x - x, w.z - z) + (Math.random() - 0.5) * 0.8;
  const a = needAgent(w, 6.5);
  if (a) nav.fleeTarget(a, w.x, w.z, x, z, short ? 8 : 35);
}
function goHostile(w, kind) {
  w.mode = 'hostile'; w.hostile = kind; w.modeT = 18; w.cd = kind === 'gun' ? 1.2 : 0.6; w.call = null; w.retarget = 0;
  needAgent(w, kind === 'gun' ? 4.5 : 5.8);
}
// Physical hit: dead bodies flop, the living get knocked down and then get up and react.
export function knock(w, vel, dead) {
  const r = ragdoll(w.ch, vel, dead ? { dead: true } : {
    getUp: 1.8 + Math.random(),
    onUp: (p, h) => {
      w.x = p.x; w.z = p.z; w.h = h; dropAgent(w);
      if (w.dead) return;
      if (w.temper !== 'normal' && Math.random() < 0.8) goHostile(w, w.temper === 'gunman' ? 'gun' : 'melee');
      else startFlee(w, p.x - vel.x, p.z - vel.z);
    },
  });
  if (r && dead) dropAgent(w);
  return !!r;
}
export function flinch(w) { w.ch.flinch = 1; }
// The player hurt this person without killing them.
export function provoke(w) {
  if (w.dead) return;
  if (w.temper === 'brawler') goHostile(w, 'melee');
  else if (w.temper === 'gunman') goHostile(w, 'gun');
  else startFlee(w, w.x - Math.sin(w.h), w.z - Math.cos(w.h));
}

const freeModes = new Set(['flee', 'cower', 'hostile', 'gone', 'surrender']);
export function updateWalkers(dt, tSec, nowMs, cam) {
  const target = ctx.target();
  for (const w of walkers) {
    if (w.dead && nowMs - w.dead.t > RESPAWN_MS) { w.dead = null; w.hp = 40; w.extra += 500; w.mode = w.fixed ? 'fixed' : 'path'; release(w.ch); dropAgent(w); }
    let speed = 0, pose = {};
    if (w.ch.rag) {
      // physics owns the body right now
      const p = ragPos(w.ch); w.x = p.x; w.z = p.z;
      if (w.dead) { w.dead.x = p.x; w.dead.z = p.z; }
      const far = Math.abs(w.x - cam.x) > 160 || Math.abs(w.z - cam.z) > 160;
      w.ch.g.visible = !far; if (w.dog) w.dog.g.visible = false;
      continue;
    }
    if (w.dead) {
      w.x = w.dead.x; w.z = w.dead.z; w.h = w.dead.h;
    } else if (freeModes.has(w.mode)) {
      w.modeT -= dt;
      if (w.mode === 'flee') {
        if (w.agent) {
          const st = nav.agentState(w.agent);
          w.x = st.x; w.z = st.z; if (st.speed > 0.3) w.h = Math.atan2(st.vx, st.vz); speed = st.speed;
          w.stuck = st.speed < 0.4 ? (w.stuck || 0) + dt : 0;
          if (w.stuck > 0.7) {
            w.stuck = 0; w.tries = (w.tries || 0) + 1;
            if (w.tries > 3) { dropAgent(w); w.tries = 0; } // give up on paths: just run
            else nav.fleeTarget(w.agent, w.x, w.z, w.x + (Math.random() - 0.5) * 20, w.z + (Math.random() - 0.5) * 20, 22);
          }
        } else {
          const p = W.pushOutCircle(w.x + Math.sin(w.fh) * 6 * dt, w.z + Math.cos(w.fh) * 6 * dt, 0.4);
          if (Math.hypot(p.x - w.x, p.z - w.z) < 6 * dt * 0.5) w.fh += 1.2;
          if (W.isLand(p.x, p.z)) { w.x = p.x; w.z = p.z; } else w.fh += Math.PI;
          w.h = w.fh; speed = 7;
        }
        if (w.modeT <= 0) { w.mode = 'gone'; w.modeT = 25; dropAgent(w); }
      } else if (w.mode === 'cower') {
        w.h += angDiff(w.h, Math.atan2(w.fx - w.x, w.fz - w.z) + Math.PI) * Math.min(1, dt * 5);
        pose = { cower: true };
        if (w.modeT <= 0) startFlee(w, w.fx, w.fz);
      } else if (w.mode === 'hostile') {
        hostileStep(w, dt, target);
        speed = w.spd || 0;
        pose = { aim: w.hostile === 'gun', weapon: w.hostile === 'gun' ? 'gun' : 'none', swing: w.swing || 0 };
        if (w.modeT <= 0 || !target || target.dead || Math.hypot(target.x - w.x, target.z - w.z) > 70) { startFlee(w, target ? target.x : w.x, target ? target.z : w.z); }
      } else if (w.mode === 'surrender') {
        // hands up, frozen, eyes on the gun
        const th = ctx.threat();
        if (th) w.h += angDiff(w.h, Math.atan2(th.x - w.x, th.z - w.z)) * Math.min(1, dt * 6);
        if (th && th.aimAt === w) w.modeT = Math.max(w.modeT, 1.2);
        pose = { handsUp: true };
        if (w.modeT <= 0) { if (Math.random() < 0.3) { w.mode = 'cower'; w.modeT = 3; w.fx = th ? th.x : w.x; w.fz = th ? th.z : w.z; } else startFlee(w, th ? th.x : w.x, th ? th.z : w.z); }
      } else if (w.mode === 'gone') {
        dropAgent(w);
        // out of sight for a while, then back to normal life
        if (w.modeT <= 0) { w.mode = w.fixed ? 'fixed' : 'path'; w.extra += 300; }
      }
    } else {
      // jump out of the way of a car coming straight at you
      if (!w.call && w.mode !== 'fixed' || (w.fixed && w.fixed.pose !== 'lie')) {
        for (const v of ctx.vehicles()) {
          const vs = Math.hypot(v.vx, v.vz);
          if (vs < 6) continue;
          const dx = w.x - v.x, dz = w.z - v.z;
          if (Math.abs(dx) > 14 || Math.abs(dz) > 14) continue;
          const along = (dx * v.vx + dz * v.vz) / vs, lat = (dx * v.vz - dz * v.vx) / vs;
          if (along > 0 && along / vs < 1.4 && Math.abs(lat) < 2.2) {
            const side = lat >= 0 ? 1 : -1;
            startFlee(w, w.x - (v.vz / vs) * side * 5, w.z + (v.vx / vs) * side * 5, true);
            break;
          }
        }
        if (w.mode === 'flee') continue;
      }
      const th = ctx.threat();
      let look = 0;
      if (th && !w.call) {
        const d = Math.hypot(th.x - w.x, th.z - w.z);
        if (th.aimAt === w) {
          // a gun pointed right at them
          scare(w.x, w.z, 15, 'gunfire'); // bystanders scatter first
          if (w.temper === 'gunman' && Math.random() < 0.7) goHostile(w, 'gun');
          else if (w.temper === 'brawler' && Math.random() < 0.25) goHostile(w, 'melee');
          else { dropAgent(w); w.mode = 'surrender'; w.modeT = 2.5 + Math.random() * 2; w.panic = 0; }
          continue;
        }
        if (th.armed && d < 13) {
          w.wary = (w.wary || 0) + dt;
          look = angDiff(w.h, Math.atan2(th.x - w.x, th.z - w.z));
          if (w.mode === 'path') w.extra += dt * w.speed * 0.6; // hurry along
          if (w.wary > 2.5 && d < 8 && (w.fixed || Math.random() < 0.01)) { startFlee(w, th.x, th.z); w.wary = 0; continue; }
        } else w.wary = Math.max(0, (w.wary || 0) - dt);
      }
      w.look = Math.max(-1.1, Math.min(1.1, look));
      if (w.panic > 0) { w.panic -= dt; w.extra += dt * w.speed * 2.6; }
      const p = walkerPose(w, tSec);
      w.x = p.x; w.z = p.z; w.h = p.h;
      speed = w.call ? 0 : w.mode === 'fixed' ? 0 : w.panic > 0 ? w.speed * 3.6 : w.speed * (w.act === 'jog' ? 1.6 : 1.4); // legs match how fast they really move
      if (w.fixed) pose = { sit: w.fixed.pose === 'sit', lie: w.fixed.pose === 'lie', chat: w.fixed.pose === 'chat', phone: w.fixed.pose === 'phone' };
    }
    const hidden = w.mode === 'gone' && !w.dead;
    const far = hidden || Math.abs(w.x - cam.x) > 160 || Math.abs(w.z - cam.z) > 160;
    w.ch.g.visible = !far;
    if (w.dog) w.dog.g.visible = !far && !w.dead;
    if (far) continue;
    w.y = W.groundHeight(w.x, w.z);
    placeCharacter(w.ch, w.x, w.y + (w.fixed && !w.dead && w.mode === 'fixed' ? (w.fixed.pose === 'sit' ? -0.35 : 0) : 0), w.z, w.h);
    animateCharacter(w.ch, dt, { speed, dead: !!w.dead, phone: !!w.call || pose.phone, look: w.mode === 'path' || w.mode === 'fixed' ? w.look || 0 : 0, ...pose });
    if (w.dog && !w.dead) {
      const d = w.dog, side = 0.8;
      const tx = w.x - Math.sin(w.h) * 1.1 + Math.cos(w.h) * side, tz = w.z - Math.cos(w.h) * 1.1 - Math.sin(w.h) * side;
      const dx = tx - d.g.position.x, dz = tz - d.g.position.z, dd = Math.hypot(dx, dz);
      if (dd > 6) d.g.position.set(tx, 0, tz);
      else { d.g.position.x += dx * Math.min(1, dt * 6); d.g.position.z += dz * Math.min(1, dt * 6); }
      d.g.position.y = W.groundHeight(d.g.position.x, d.g.position.z);
      if (dd > 0.05) d.g.rotation.y = Math.atan2(dx, dz);
      d.t += dt * (2 + speed * 3);
      d.legs.forEach((l, i) => { l.rotation.x = Math.sin(d.t + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * Math.min(0.8, speed * 0.2); });
      d.tail.rotation.y = Math.sin(d.t * 3) * 0.5;
    }
  }
  for (let i = fleeing.length - 1; i >= 0; i--) {
    const f = fleeing[i];
    f.t -= dt;
    if (f.ch.rag) continue;
    let spd = 6;
    if (f.angry && f.t > 0) {
      // an angry driver storms over and throws punches
      const t = ctx.target();
      f.cd = (f.cd || 0) - dt; f.swing = Math.max(0, (f.swing || 0) - dt * 3);
      if (t && !t.dead) {
        const dx = t.x - f.x, dz = t.z - f.z, d = Math.hypot(dx, dz);
        f.h = Math.atan2(dx, dz);
        if (d > 1.3) { const p = W.pushOutCircle(f.x + (dx / d) * 4.5 * dt, f.z + (dz / d) * 4.5 * dt, 0.4); f.x = p.x; f.z = p.z; spd = 4.5; }
        else { spd = 0; if (f.cd <= 0 && !t.inVeh) { f.cd = 1; f.swing = 1; ctx.hitPlayer(5 + Math.random() * 4, 'an angry driver', { hostile: 'melee', h: f.h }); } }
        if (d > 40) f.angry = false;
      }
      placeCharacter(f.ch, f.x, W.groundHeight(f.x, f.z), f.z, f.h);
      animateCharacter(f.ch, dt, { speed: spd, swing: f.swing });
      if (f.t <= 4) { f.angry = false; f.t = 8; }
      continue;
    }
    if (f.agent) {
      const st = nav.agentState(f.agent);
      f.x = st.x; f.z = st.z; spd = st.speed; if (st.speed > 0.3) f.h = Math.atan2(st.vx, st.vz);
      f.stuck = st.speed < 0.4 ? (f.stuck || 0) + dt : 0;
      if (f.stuck > 0.7) { f.stuck = 0; nav.removeAgent(f.agent); f.agent = null; } // blocked: run straight instead
    } else {
      const p = W.pushOutCircle(f.x + Math.sin(f.h) * 6 * dt, f.z + Math.cos(f.h) * 6 * dt, 0.4);
      if (Math.hypot(p.x - f.x, p.z - f.z) < 6 * dt * 0.4) f.h += 1.3;
      f.x = p.x; f.z = p.z;
    }
    placeCharacter(f.ch, f.x, W.groundHeight(f.x, f.z), f.z, f.h);
    animateCharacter(f.ch, dt, { speed: spd > 0.3 ? spd + 1 : 0 });
    if (f.t <= 0) { if (f.agent) nav.removeAgent(f.agent); scene.remove(f.ch.g); fleeing.splice(i, 1); }
  }
}

// A townsperson who decided to fight: close in and punch, or keep distance and shoot.
function hostileStep(w, dt, t) {
  w.spd = 0;
  if (!t || t.dead) return;
  const dx = t.x - w.x, dz = t.z - w.z, d = Math.hypot(dx, dz);
  w.h += angDiff(w.h, Math.atan2(dx, dz)) * Math.min(1, dt * 8);
  if (w.agent) {
    w.retarget -= dt;
    if (w.retarget <= 0) {
      w.retarget = 0.3;
      if (w.hostile === 'melee') nav.moveTo(w.agent, t.x - (dx / d) * 1.1, t.z - (dz / d) * 1.1);
      else if (d > 16 || d < 7) nav.moveTo(w.agent, t.x - (dx / d) * 11, t.z - (dz / d) * 11);
      else w.agent.resetMoveTarget();
    }
    const st = nav.agentState(w.agent);
    w.x = st.x; w.z = st.z; w.spd = st.speed + (st.speed > 0.3 ? 1 : 0);
  } else {
    let move = 0;
    if (w.hostile === 'melee') move = d > 1.3 ? 5.5 : 0;
    else move = d > 16 ? 4.5 : d < 7 ? -2 : 0;
    if (move) {
      const p = W.pushOutCircle(w.x + (dx / d) * move * dt, w.z + (dz / d) * move * dt, 0.4);
      if (W.isLand(p.x, p.z)) { w.x = p.x; w.z = p.z; }
      w.spd = Math.abs(move) + 1;
    }
  }
  w.cd -= dt;
  if (w.swing) w.swing = Math.max(0, w.swing - dt * 3);
  if (w.cd > 0) return;
  if (w.hostile === 'melee' && d < 1.6 && !t.inVeh) {
    w.cd = 0.9; w.swing = 1;
    ctx.hitPlayer(6 + Math.random() * 5, 'an angry local', w);
  } else if (w.hostile === 'gun' && d < 35 && W.lineOfSight(w.x, (w.y || 0) + 1.4, w.z, t.x, (t.y || 0) + 1.2, t.z)) {
    w.cd = 1.3 + Math.random() * 0.8;
    const hit = Math.random() < (t.inVeh ? 0.12 : 0.25), ty = (t.y || 0) + 1.2;
    ctx.shot(w, hit ? { x: t.x, y: ty, z: t.z } : { x: t.x + (Math.random() - 0.5) * 4, y: ty, z: t.z + (Math.random() - 0.5) * 4 });
    if (hit) ctx.hitPlayer(7 + Math.random() * 4, 'an armed local', w);
  }
}

export function spawnFleeing(x, z, h, down = 0, angry = false) {
  const ch = makeCharacter(randomLook());
  scene.add(ch.g);
  ch.g.position.set(x, W.groundHeight(x, z), z); ch.g.rotation.y = h;
  const f = { ch, x, z, h, t: (angry ? 16 : 8) + down, agent: null, angry };
  if (angry) { fleeing.push(f); return; }
  const run = () => { f.agent = nav.addAgent(f.x, f.z, 6.5); if (f.agent) nav.fleeTarget(f.agent, f.x, f.z, f.x - Math.sin(f.h), f.z - Math.cos(f.h), 40); };
  if (down > 0) {
    // thrown onto the street
    const ok = ragdoll(ch, { x: Math.sin(h) * 4, y: 2.5, z: Math.cos(h) * 4 }, { getUp: down, onUp: (p, hh) => { f.x = p.x; f.z = p.z; f.h = hh; run(); } });
    if (!ok) run();
  } else run();
  fleeing.push(f);
}
