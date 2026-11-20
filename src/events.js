// Street events: little stories happening around you, local to each player. A registry of event
// types lives in src/events/*.js (crime, chaos, help, races and side jobs); each one is
//   { id, theme, name, weight, when(c) -> weight factor (time / weather / area), trigger(c) (vehicle side jobs),
//     variants: [...], start(ev) -> bool, update(ev, dt), end?(ev), seeR?, life? }
// This file picks what happens next (weighted, never the same type twice within RECENT events, and the
// same variant rarely twice), spawns it out of sight 60-150 m away, shows its goal once you're close,
// and tidies everything up once nobody's watching. Tools for the packs are in src/events/kit.js.
import { sky } from './daynight.js';
import * as W from './world.js';
import { walkers, dropScripted } from './npc.js';
import { K, unseen, dP, mission, clearMission, tickMission, pulseMarkers, dropMarker, move, fail, carGone } from './events/kit.js';
import crime from './events/crime.js';
import chaos from './events/chaos.js';
import help from './events/help.js';
import jobs from './events/jobs.js';

const TYPES = [...crime, ...chaos, ...help, ...jobs];
const RECENT = 12; // a type can't come back until this many others have played
const events = [];
export const activeEvents = events;
let nextT = 25, clock = 0, jobCool = 0, vehT = 0, lastVeh = null, trigT = 0;
const recent = [], lastV = new Map();
export function initEvents(c) { K.ctx = c; }

const conditions = () => ({ hour: sky.hour ?? 12, night: sky.night > 0.5, rain: sky.rain > 0.2 || sky.snowing > 0.2, district: W.district(K.P.x, K.P.z), foot: K.P.foot, veh: K.P.veh, vehT });
// a variant this type hasn't shown lately
function pickVariant(T) {
  const n = T.variants.length, used = lastV.get(T.id) || [];
  let opts = [...Array(n).keys()].filter((i) => !used.includes(i)); if (!opts.length) opts = [...Array(n).keys()];
  const vi = opts[Math.floor(Math.random() * opts.length)];
  used.push(vi); while (used.length > n - 1) used.shift(); lastV.set(T.id, used);
  return vi;
}
function launch(T) {
  const vi = pickVariant(T);
  const ev = { T, V: T.variants[vi], vi, id: T.id, theme: T.theme, label: T.name, t: 0, st: -1, x: K.P.x, z: K.P.z, people: [], cars: [], props: [], marks: [], done: false, doneT: 0, seen: false, job: !!T.trigger, goal: '' };
  let ok = false;
  try { ok = T.start(ev); } catch (e) { console.warn('street event', T.id, e); }
  if (!ok) { cleanup(ev); return false; }
  events.push(ev);
  recent.push(T.id); if (recent.length > RECENT) recent.shift();
  if (ev.job) { ev.seen = true; ev.seenT = 0; if (ev.goal) mission(ev, ev.goal, 8); }
  return true;
}
function spawnAmbient(c) {
  const pool = [];
  let sum = 0;
  for (const T of TYPES) {
    if (T.trigger || recent.includes(T.id) || events.some((e) => e.id === T.id)) continue;
    const w = (T.weight ?? 1) * (T.when ? T.when(c) : 1);
    if (w > 0) { pool.push([T, w]); sum += w; }
  }
  for (let tries = 0; tries < 3 && pool.length; tries++) {
    let x = Math.random() * sum, i = 0;
    while (i < pool.length - 1 && (x -= pool[i][1]) > 0) i++;
    const [T, w] = pool.splice(i, 1)[0]; sum -= w;
    if (launch(T)) return true;
  }
  return false;
}

export function updateEvents(dt, focus, cam, quiet) {
  if (!focus || !K.ctx) return;
  const m = K.ctx.me ? K.ctx.me() : null, veh = m ? m.veh : null, P = K.P;
  P.x = focus.x; P.z = focus.z; P.veh = veh; P.dead = !!(m && m.dead); P.foot = !veh && !P.dead; P.speed = veh ? Math.abs(veh.speed || 0) : (m && m.moveSpeed) || 0;
  K.cam = cam; clock += dt;
  vehT = veh && veh === lastVeh ? vehT + dt : 0; lastVeh = veh;
  tickMission(); pulseMarkers(clock);
  const jobOn = events.some((e) => e.job && !e.done);
  // something new now and then: one at a time at first, up to two later; a little busier as the session goes on
  nextT -= dt;
  if (nextT <= 0 && !quiet && !jobOn && !P.dead && events.filter((e) => !e.done && !e.job).length < (clock > 300 ? 2 : 1)) {
    nextT = (35 + Math.random() * 40) * Math.max(0.6, 1 - clock / 9000);
    if (!spawnAmbient(conditions())) nextT = 8;
  }
  // side jobs start a few seconds after you get in the right vehicle (taxi, ambulance, fire truck, police car, scooter)
  if ((trigT -= dt) <= 0) {
    trigT = 1;
    if (veh && !quiet && !jobOn && clock > jobCool) {
      const c = conditions();
      for (const T of TYPES) if (T.trigger && T.trigger(c)) { if (!launch(T)) jobCool = clock + 10; break; }
    }
  }
  for (const ev of [...events]) step(ev, dt);
}

function step(ev, dt) {
  ev.t += dt;
  if (!ev.done) {
    const d = dP(ev.x, ev.z);
    if (!ev.seen && d < (ev.T.seeR || 50)) { ev.seen = true; ev.seenT = ev.t; if (ev.goal) mission(ev, ev.goal); }
    ev.st = ev.seen ? ev.t - ev.seenT : -1;
    try { ev.T.update(ev, dt); } catch (e) { console.warn('street event', ev.id, e); fail(ev, ''); }
    for (const w of ev.people) if (w.leaveNow) walkOff(ev, w, dt);
    if (!ev.done) {
      if (!ev.job && ((!ev.seen && ev.t > (ev.T.life || 100)) || (d > 320 && ev.t > 20 && !ev.dest && !ev.ride))) fail(ev, ''); // missed it
      else if (ev.job && P_dead()) fail(ev, '');
      else if ((ev.theme === 'chaos' || ev.theme === 'help') && !ev.ride && ev.people.length && ev.people.every((w) => w.mode !== 'script' && w.mode !== 'hostile' && !w.held)) fail(ev, ''); // everyone scattered (gunfire...)
    }
    if (ev.done) {
      for (const mk of [...ev.marks]) dropMarker(ev, mk);
      ev.dest = null;
      if (ev.job) jobCool = clock + (ev.ok ? 5 : 30);
    }
    return;
  }
  // done: our people walk off and vanish once nobody can see them; then the cars and props go
  ev.doneT += dt;
  for (let i = ev.people.length - 1; i >= 0; i--) {
    const w = ev.people[i];
    if (!walkers.includes(w) || w.mode !== 'script') { ev.people.splice(i, 1); continue; } // freed: an ordinary person now
    if (ev.doneT > 3) walkOff(ev, w, dt);
    if (unseen(w.x, w.z, 60) || ev.doneT > 150) { dropScripted(w); ev.people.splice(i, 1); }
  }
  if ((!ev.people.length && unseen(ev.x, ev.z, 60)) || ev.doneT > 150) { cleanup(ev); events.splice(events.indexOf(ev), 1); }
}
const P_dead = () => K.P.dead;
function walkOff(ev, w, dt) {
  if (w.mode !== 'script' || w.held || w.dead || (w.ch && w.ch.rag)) return;
  if (w.offH === undefined) w.offH = Math.atan2(w.x - ev.x, w.z - ev.z) + (Math.random() - 0.5) * 0.8;
  w.script.pose = {};
  w.offH = move(w, w.offH, 1.35, dt);
}
function cleanup(ev) {
  try { ev.T.end?.(ev); } catch (e) { console.warn('street event', ev.id, e); }
  for (const w of ev.people) if (w.mode === 'script') dropScripted(w);
  ev.people.length = 0;
  for (const v of ev.cars) {
    if (carGone(v)) continue;
    v.keep = false;
    if (v === K.P.veh || v.driver) continue;
    if (v.mode === 'race') { v.mode = 'parked'; v.npcDriver = false; }
    if (v.mode !== 'traffic' && unseen(v.x, v.z, 60)) K.ctx.remove?.(v); // else the usual parked-car tidy-up takes it later
  }
  for (const g of ev.props) g.parent && g.parent.remove(g);
  for (const mk of [...ev.marks]) dropMarker(ev, mk);
  clearMission(ev);
}

// map blips: the event itself (orange !), or where you're headed (yellow) during a ride, a delivery or a race
export function eventBlips() {
  const out = [];
  for (const e of events) {
    if (e.done) continue;
    if (e.dest) out.push({ x: e.dest.x, z: e.dest.z, type: null, color: '#ffd23f', size: 6, label: '', name: e.dest.name || e.label });
    else if (e.label) out.push({ x: e.x, z: e.z, color: '#ff9100', size: 5, label: '!', name: e.label });
  }
  return out;
}
// what's going on right now (for the phone)
export function list() { return events.filter((e) => !e.done).map((e) => ({ id: e.id, theme: e.theme, name: e.label, x: e.x, z: e.z, job: e.job })); }
// debug / testing: start a type by id right now (ignores the history and the timers)
export function forceEvent(id) { const T = TYPES.find((t) => t.id === id); return !!T && launch(T); }
export const eventTypes = TYPES.map((t) => ({ id: t.id, theme: t.theme, name: t.name, variants: t.variants.length }));
