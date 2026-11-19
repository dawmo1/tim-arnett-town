// Little things happening around you: a mugging, a purse snatcher, someone breaking into a car,
// a fender-bender with two drivers arguing in the street. Step in and stop a crime for a reward.
// Local to each player.
import * as W from './world.js';
import { addScripted, dropScripted, freeScripted, say, line } from './npc.js';
import { makeVehicle, V, CAR_COLORS, damageZone } from './vehicles.js';
import { angDiff } from './util.js';

let ctx;
const events = [];
let nextT = 25;
export function initEvents(c) { ctx = c; }
export const activeEvents = events;

const crook = () => [[0xe0ac69, 0x8d5524, 0xffdbac][Math.floor(Math.random() * 3)], 0x212121, 0x263238, 0x111111, 2 | 64 | (2 << 9)];
const SIDEWALK = (e) => e.cls !== 'service' && e.cls !== 'motor' && e.cls !== 'trunk' && !e.bridge;
// a sidewalk spot 60-120 m away, out of sight
function spot(focus, cam, min = 60, max = 120) {
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * Math.PI * 2, r = min + Math.random() * (max - min);
    const q = W.nearestEdge(focus.x + Math.cos(a) * r, focus.z + Math.sin(a) * r, 40, SIDEWALK);
    if (!q || q.e.len < 30) continue;
    const off = q.e.width / 2 + 1.2, side = Math.random() < 0.5 ? 1 : -1;
    const x = q.x - Math.cos(q.h) * off * side, z = q.z + Math.sin(q.h) * off * side;
    if (!W.isLand(x, z) || W.pushOutCircle(x, z, 0.5).hit) continue;
    if (cam) { const dx = x - cam.x, dz = z - cam.z; if ((dx * cam.fx + dz * cam.fz) / (Math.hypot(dx, dz) || 1) > 0.5 && Math.hypot(dx, dz) < 100) continue; }
    return { x, z, h: q.h, e: q.e, q };
  }
  return null;
}

function startMugging(focus, cam) {
  const p = spot(focus, cam); if (!p) return false;
  const victim = addScripted('walk', p.x, p.z, p.h, null);
  const mugger = addScripted('walk', p.x + Math.sin(p.h) * 1.1, p.z + Math.cos(p.h) * 1.1, p.h + Math.PI, crook());
  mugger.temper = 'brawler';
  events.push({ kind: 'mugging', victim, mugger, t: 0, x: p.x, z: p.z, label: 'Mugging in progress' });
  return true;
}
function startSnatch(focus, cam) {
  const p = spot(focus, cam); if (!p) return false;
  const victim = addScripted('shopper', p.x, p.z, p.h, null);
  const thief = addScripted('walk', p.x - Math.sin(p.h) * 1.2, p.z - Math.cos(p.h) * 1.2, p.h, crook());
  events.push({ kind: 'snatch', victim, thief, t: 0, x: p.x, z: p.z, label: 'Purse snatcher', run: { h: p.h + (Math.random() - 0.5) } });
  return true;
}
function startCarThief(focus, cam) {
  const cars = ctx.vehicles().filter((v) => v.mode === 'parked' && !v.T.bike && !v.T.boat && !v.T.heli && Math.hypot(v.x - focus.x, v.z - focus.z) > 50 && Math.hypot(v.x - focus.x, v.z - focus.z) < 130);
  const v = cars[Math.floor(Math.random() * cars.length)]; if (!v) return false;
  const lx = Math.cos(v.h), lz = -Math.sin(v.h), off = v.T.wid / 2 + 0.6;
  const thief = addScripted('walk', v.x + lx * off, v.z + lz * off, v.h - Math.PI / 2, crook());
  events.push({ kind: 'carthief', v, thief, t: 0, x: v.x, z: v.z, label: 'Car thief' });
  return true;
}
function startFenderBender(focus, cam) {
  const p = spot(focus, cam, 70, 140); if (!p) return false;
  const q = p.q, e = q.e; if (e.lf === 0 || e.lb === 0 || e.width < 7) return false;
  const lane = e.width / 4, hx = Math.sin(q.h), hz = Math.cos(q.h), rx = -Math.cos(q.h), rz = Math.sin(q.h);
  const a = makeVehicle(ctx.newId('f'), [V.SEDAN, V.SUV, V.HATCH, V.PICKUP][Math.floor(Math.random() * 4)], CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)], { x: q.x + rx * lane, z: q.z + rz * lane, h: q.h + 0.25 });
  const b = makeVehicle(ctx.newId('f'), [V.SEDAN, V.MINIVAN, V.HATCH][Math.floor(Math.random() * 3)], CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)], { x: q.x + rx * lane + hx * 4.6, z: q.z + rz * lane + hz * 4.6, h: q.h - 0.15 });
  for (const v of [a, b]) { v.mode = 'free'; v.keep = true; ctx.add(v); }
  damageZone(a, a.x + hx * 2.2, a.z + hz * 2.2, 25); damageZone(b, b.x - hx * 2.2, b.z - hz * 2.2, 25);
  const off = e.width / 2 + 1.2;
  const d1 = addScripted('walk', q.x + rx * off + hx * 1.5, q.z + rz * off + hz * 1.5, q.h + Math.PI / 2, null);
  const d2 = addScripted('walk', q.x + rx * off + hx * 2.6, q.z + rz * off + hz * 2.6, q.h - Math.PI / 2, null);
  d1.script.pose = { chat: true }; d2.script.pose = { chat: true };
  d1.h = Math.atan2(d2.x - d1.x, d2.z - d1.z); d2.h = Math.atan2(d1.x - d2.x, d1.z - d2.z);
  events.push({ kind: 'fender', cars: [a, b], people: [d1, d2], t: 0, x: q.x, z: q.z, label: '' });
  return true;
}

function reward(ev, amount, text) { ev.done = true; ctx.reward(amount, text); }
const down = (w) => !w || w.dead || (w.ch && w.ch.rag) || w.mode !== 'script';
function move(w, h, speed, dt) {
  const p = W.pushOutCircle(w.x + Math.sin(h) * speed * dt, w.z + Math.cos(h) * speed * dt, 0.4);
  if (Math.hypot(p.x - w.x, p.z - w.z) < speed * dt * 0.4) h += 1.2;
  if (W.isLand(p.x, p.z)) { w.x = p.x; w.z = p.z; }
  w.h += angDiff(w.h, h) * Math.min(1, dt * 8); w.script.speed = speed * 1.45;
  return h;
}

export function updateEvents(dt, focus, cam, quiet) {
  if (!focus) return;
  nextT -= dt;
  if (nextT <= 0 && !quiet && events.length < 2) {
    nextT = 45 + Math.random() * 60;
    const r = Math.random();
    const ok = r < 0.3 ? startMugging(focus, cam) : r < 0.55 ? startSnatch(focus, cam) : r < 0.75 ? startCarThief(focus, cam) : startFenderBender(focus, cam);
    if (!ok) nextT = 8;
  }
  for (const ev of [...events]) {
    ev.t += dt;
    const far = Math.hypot(ev.x - focus.x, ev.z - focus.z) > 260;
    if (ev.kind === 'mugging') {
      const { victim: v, mugger: m } = ev;
      if (!ev.done && down(m)) { reward(ev, 150, 'You stopped a mugging'); if (!down(v)) { say(v, 'Thank you!'); freeScripted(v, m.x, m.z); } }
      if (!ev.done && !down(m)) {
        m.h += angDiff(m.h, Math.atan2(v.x - m.x, v.z - m.z)) * Math.min(1, dt * 6);
        m.script.pose = ev.t < 9 ? { aim: true, weapon: 'gun' } : {}; v.script.pose = { handsUp: true };
        if (ev.t > 1 && ev.t < 1.2) { say(m, 'Wallet. Now.'); say(v, 'Please!'); }
        if (ev.t > 9) { ev.x = m.x; ev.z = m.z; ev.runH = ev.runH ?? Math.atan2(m.x - v.x, m.z - v.z); ev.runH = move(m, ev.runH, 6.5, dt); if (ev.t > 9.2 && ev.t < 9.4) { freeScripted(v, m.x, m.z); say(v, 'Thief! Stop him!'); } }
        if (ev.t > 35) ev.done = true; // got away
      }
    } else if (ev.kind === 'snatch') {
      const { victim: v, thief: t } = ev;
      if (!ev.done && down(t)) { reward(ev, 120, 'You caught the purse snatcher'); if (!down(v)) say(v, 'My bag! Thank you!'); }
      if (!ev.done && !down(t)) {
        if (ev.t < 1.4) { t.h += angDiff(t.h, Math.atan2(v.x - t.x, v.z - t.z)) * Math.min(1, dt * 6); t.script.speed = 2; }
        else { if (!ev.yelled) { ev.yelled = true; say(v, 'Hey! My purse!'); freeScripted(v, t.x, t.z); } ev.run.h = move(t, ev.run.h, 6.2, dt); ev.x = t.x; ev.z = t.z; }
        if (ev.t > 30) ev.done = true;
      }
    } else if (ev.kind === 'carthief') {
      const t = ev.thief, v = ev.v;
      if (!ev.done && down(t)) reward(ev, 150, 'You stopped a car thief');
      else if (!ev.done && v.mode !== 'parked') { ev.done = true; dropScripted(t); } // someone (you) took it first
      else if (!ev.done) {
        t.script.pose = { reach: true }; t.h = v.h - Math.PI / 2;
        if (ev.t > 3 && ev.t < 3.2) ctx.alarm(v);
        if (ev.t > 14) { dropScripted(t); v.mode = 'free'; v.npcDriver = true; v.localSim = true; v.vx = Math.sin(v.h) * 9; v.vz = Math.cos(v.h) * 9; ev.done = true; } // drove off
      }
    } else if (ev.kind === 'fender') {
      if (ev.t > 2 && Math.random() < dt * 0.6) { const p = ev.people[Math.floor(Math.random() * 2)]; if (!down(p)) say(p, ['Learn to drive!', 'You hit ME!', "I'm calling my insurance!", 'Are you blind?!', 'Unbelievable!'][Math.floor(Math.random() * 5)]); }
      if (ev.t > 90) ev.done = true;
    }
    if (ev.done && (far || ev.t > 120)) { // tidy up once nobody's watching
      for (const w of [ev.victim, ev.mugger, ev.thief, ...(ev.people || [])]) if (w && w.mode === 'script') dropScripted(w);
      for (const v of ev.cars || []) { v.keep = false; }
      events.splice(events.indexOf(ev), 1);
    } else if (!ev.done && far && ev.t > 20) { ev.done = true; }
  }
}
// minimap blips for crimes in progress
export function eventBlips() { return events.filter((e) => !e.done && e.label).map((e) => ({ x: e.x, z: e.z, color: '#ff9100', size: 5, label: '!', name: e.label })); }
