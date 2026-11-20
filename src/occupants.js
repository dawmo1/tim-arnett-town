// People inside cars: the drivers (and sometimes passengers) of the traffic, cops and service
// vehicles near the camera are real seated characters. Farther away nobody can see through the
// glass, so cars just drive themselves.
import { makeCharacter, animateCharacter, disposeCharacter, roleLook } from './character.js';

const seated = new Map(); // vehicle -> [{ ch, seat }]
let budget = 12;
export function setOccupantBudget(n) { budget = n; }
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) / 4294967296; };
const seeded = (seed) => { let a = Math.floor(seed * 1e9) | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// how many people ride in this car, and who they are (stable per car)
export function crewOf(v) {
  if (v.crew) return v.crew;
  const r = hash(String(v.id)), T = v.T;
  const role = T.police ? 'police' : T.name === 'Ambulance' ? 'medic' : T.name === 'Fire truck' ? 'fire' : T.name === 'Garbage truck' || T.name === 'Tow truck' ? 'worker' : T.limo ? 'office' : null;
  let n = 1;
  if (!T.bike && !role && !T.bus) n += r < 0.22 ? 1 : 0, n += r < 0.06 ? 2 : 0;
  if (T.police && r < 0.5) n = 2;
  v.crew = { n, role, seed: r };
  return v.crew;
}
const SEATS = ['D', 'P', 'RL', 'RR'];

// cars: [{ v, driver: bool }] that might show people; cam = camera position
export function updateOccupants(cars, cam, dt) {
  const want = [];
  for (const c of cars) {
    const v = c.v, P = v.mesh.userData.parts;
    if (!P || !P.seats || !P.seats.D || !v.mesh.visible || v.exploded) continue;
    const d2 = (v.x - cam.x) ** 2 + (v.z - cam.z) ** 2;
    if (d2 < 42 * 42) want.push({ v, d2 });
  }
  want.sort((a, b) => a.d2 - b.d2);
  const keep = new Set();
  let used = 0, made = 0;
  for (const { v } of want) {
    const crew = crewOf(v);
    if (used + 1 > budget) break;
    keep.add(v);
    let list = seated.get(v);
    if (!list) {
      if (made >= 2) continue; // spread the cost of building people over frames
      list = [];
      const rnd = seeded(crew.seed);
      const P = v.mesh.userData.parts;
      for (let i = 0; i < crew.n; i++) {
        const seat = P.seats[SEATS[i]]; if (!seat) break;
        const ch = makeCharacter(roleLook(i === 0 || crew.role === 'police' ? crew.role || 'x' : 'x', rnd));
        ch.g.position.set(seat.x, seat.y - 0.5, seat.z);
        v.mesh.userData.body.children[0].add(ch.g);
        list.push({ ch, seat: SEATS[i] });
        made++;
      }
      seated.set(v, list);
    }
    used += list.length;
    const ko = v.ko && v.npcDriver; // knocked out in a crash: slumped over toward the door
    for (const o of list) {
      animateCharacter(o.ch, dt, o.seat === 'D' ? (ko ? { sit: true } : { drive: !v.T.bike, sit: !!v.T.bike, steer: v.steerVis || 0, look: 0 }) : { sit: true, chat: o.seat === 'P' && Math.random() < 0.002 ? true : undefined });
      if (o.seat === 'D') o.ch.g.rotation.set(ko ? 0.3 : 0, 0, ko ? -0.45 : 0);
    }
  }
  for (const [v, list] of seated) {
    if (keep.has(v)) continue;
    for (const o of list) { o.ch.g.parent && o.ch.g.parent.remove(o.ch.g); disposeCharacter(o.ch); }
    seated.delete(v);
  }
}
// the car's people get out (carjack, crash): returns their seats so callers can spawn runners
export function emptyCar(v) {
  const list = seated.get(v);
  if (list) { for (const o of list) { o.ch.g.parent && o.ch.g.parent.remove(o.ch.g); disposeCharacter(o.ch); } seated.delete(v); }
  const crew = crewOf(v), n = crew.n;
  v.crew = { ...crew, n: 0 };
  return n;
}
export function clearOccupants(v) {
  const list = seated.get(v); if (!list) return;
  for (const o of list) { o.ch.g.parent && o.ch.g.parent.remove(o.ch.g); disposeCharacter(o.ch); }
  seated.delete(v);
}
