// Shared bits for the street events (src/events.js runs them, src/events/*.js define them):
// places out of sight, scripted people, event cars, GTA checkpoint cylinders, little props, and the
// bottom-centre mission line + timer. Nothing here runs per frame except what an active event asks for.
import * as THREE from 'three';
import * as W from '../world.js';
import { addScripted, dropScripted, freeScripted, say, walkers } from '../npc.js';
import { makeVehicle, CAR_COLORS } from '../vehicles.js';
import { joinTraffic } from '../traffic.js';
import { roleLook, mat } from '../character.js';
import { angDiff } from '../util.js';
import { stores } from '../economy.js';
import * as fx from '../fx.js';

// ctx: hooks from main.js; P: the player this frame {x, z, veh, foot, dead, speed}; cam: camera view
export const K = { ctx: null, P: { x: 0, z: 0, veh: null, foot: true, dead: false, speed: 0 }, cam: null };
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const rnd = (a, b) => a + Math.random() * (b - a);
export const chance = (p) => Math.random() < p;
export const dP = (x, z) => Math.hypot(x - K.P.x, z - K.P.z);
export const money = (a, b) => Math.round(rnd(a, b) / 5) * 5;

// ---------- lines: big pools, and the same line rarely comes up twice in a row anywhere ----------
const said = [];
export function fresh(pool) {
  let s = pick(pool);
  for (let i = 0; i < 6 && said.includes(s); i++) s = pick(pool);
  said.push(s); if (said.length > 80) said.shift();
  return s;
}
export function shout(w, pool, secs = 2.4) { if (live(w)) say(w, typeof pool === 'string' ? pool : fresh(pool), secs); }
export function chatter(w, pool, dt, rate = 0.3) { if (Math.random() < dt * rate) shout(w, pool); }
export const THANKS = ['Thank you!', 'My hero!', 'Thanks, stranger!', 'Bless you!', "I owe you one!", 'You saved me!', 'Wow, thanks!', 'Davenport needs more like you!', 'Thank you so much!', "Here, take this!"];
export const HELP = ['Help!', 'Somebody help!', 'Stop him!', 'Police!', 'Thief!', 'HEY!', 'Somebody stop him!', 'Call the cops!'];

// ---------- where things happen ----------
const SIDEWALK = (e) => e.cls !== 'service' && e.cls !== 'motor' && e.cls !== 'trunk' && !e.bridge;
const ROAD = (e) => e.cls !== 'service' && e.cls !== 'motor' && !e.bridge && e.len > 30;
// nobody would notice something appearing here: far off, or behind the camera
export function unseen(x, z, near = 100) {
  const c = K.cam; if (!c) return true;
  const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz) || 1;
  return d > 160 || (d > 18 && (dx * c.fx + dz * c.fz) / d < 0.35) || (d > near && (dx * c.fx + dz * c.fz) / d < 0.6);
}
// a sidewalk spot min..max m from the player (or from `at`), out of sight
export function spot(min = 60, max = 150, at = null) {
  const o = at || K.P;
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * Math.PI * 2, r = min + Math.random() * (max - min);
    const q = W.nearestEdge(o.x + Math.cos(a) * r, o.z + Math.sin(a) * r, 40, SIDEWALK);
    if (!q || q.e.len < 30) continue;
    const off = q.e.width / 2 + 1.2, side = Math.random() < 0.5 ? 1 : -1;
    const x = q.x - Math.cos(q.h) * off * side, z = q.z + Math.sin(q.h) * off * side;
    if (!W.isLand(x, z) || W.pushOutCircle(x, z, 0.5).hit) continue;
    if (!at && !unseen(x, z)) continue;
    return { x, z, h: q.h, e: q.e, q, side, nx: -Math.cos(q.h) * side, nz: Math.sin(q.h) * side }; // n: from the road toward the sidewalk
  }
  return null;
}
// a spot in the right-hand lane min..max m away, out of sight, with nothing parked on it
export function lane(min = 70, max = 160, at = null) {
  const o = at || K.P;
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * Math.PI * 2, r = min + Math.random() * (max - min);
    const q = W.nearestEdge(o.x + Math.cos(a) * r, o.z + Math.sin(a) * r, 50, ROAD);
    if (!q || (q.e.lf === 0 && q.e.lb === 0)) continue;
    let h = q.h, dir = 1;
    if (q.e.lf === 0 || (q.e.lb > 0 && Math.random() < 0.5)) { h += Math.PI; dir = -1; }
    const l = q.e.width / 4, x = q.x - Math.cos(h) * l, z = q.z + Math.sin(h) * l; // right of the heading
    if (!W.isLand(x, z) || (!at && !unseen(x, z)) || K.ctx.vehicles().some((v) => Math.abs(v.x - x) < 9 && Math.abs(v.z - z) < 9)) continue;
    return { x, z, h, q, dir, kx: x - Math.cos(h) * l * 0.6, kz: z + Math.sin(h) * l * 0.6 }; // k: parked at the kerb beside it
  }
  return null;
}
// the sidewalk in front of a real place (POI), the door toward the building
export function frontOf(px, pz) {
  const q = W.nearestEdge(px, pz, 80, SIDEWALK);
  if (!q) return null;
  const dx = px - q.x, dz = pz - q.z, l = Math.hypot(dx, dz) || 1, off = q.e.width / 2 + 1.6;
  const x = q.x + (dx / l) * off, z = q.z + (dz / l) * off;
  return { x, z, doorX: x + (dx / l) * 2.2, doorZ: z + (dz / l) * 2.2, face: Math.atan2(dx, dz), h: q.h, name: '' };
}
// a real place of one of these kinds min..max m away (and out of sight unless seen = true)
export function placeNear(kinds, min, max, seen = false) {
  const list = W.D.index.poi.filter((p) => kinds.includes(p.kind) && p.name && Math.hypot(p.x - K.P.x, p.z - K.P.z) > min && Math.hypot(p.x - K.P.x, p.z - K.P.z) < max);
  for (let i = 0; i < 6 && list.length; i++) {
    const p = list.splice(Math.floor(Math.random() * list.length), 1)[0], f = frontOf(p.x, p.z);
    if (f && (seen || unseen(f.x, f.z))) { f.name = p.name; f.kind = p.kind; return f; }
  }
  return null;
}
// real places are sparse: fall back to any sidewalk that has a building behind it (or just a sidewalk)
export function storefront(kinds, min, max, name) {
  const f = placeNear(kinds, min, max);
  if (f) return f;
  let p = null;
  for (let i = 0; i < 6; i++) {
    p = spot(min, max); if (!p) return null;
    const t = W.rayBuildings(p.x, W.groundHeight(p.x, p.z) + 1, p.z, p.nx, 0, p.nz, 9);
    if (t < 8.5) return { x: p.x, z: p.z, doorX: p.x + p.nx * (t - 0.4), doorZ: p.z + p.nz * (t - 0.4), face: Math.atan2(p.nx, p.nz), h: p.h, name };
  }
  return { x: p.x, z: p.z, doorX: p.x + p.nx * 1.5, doorZ: p.z + p.nz * 1.5, face: Math.atan2(p.nx, p.nz), h: p.h, name };
}
export function storeNear(kind, min, max) {
  const list = stores.filter((s) => s.kind === kind && dP(s.x, s.z) > min && dP(s.x, s.z) < max && unseen(s.x, s.z));
  return list.length ? pick(list) : null;
}
export const LANDMARKS = ['museum', 'theatre', 'attraction', 'park', 'hotel', 'university', 'college', 'stadium', 'artwork', 'department_store'];
// a sidewalk spot to drive someone to: a named place if there is one, or just somewhere in town
export function destination(min, max, kinds = null) {
  const f = kinds && placeNear(kinds, min, max, true);
  if (f) return f;
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2, r = rnd(min, max);
    const s = W.sidewalkSpot({ x: K.P.x + Math.cos(a) * r, z: K.P.z + Math.sin(a) * r, r: 80 });
    if (s && dP(s.x, s.z) > min * 0.7) { const [area, street] = W.areaAt(s.x, s.z); return { x: s.x, z: s.z, name: street || area }; }
  }
  return null;
}
export function hospital() { const h = W.hospitalSpawn(K.P.x, K.P.z); return { x: h.x, z: h.z, name: (h.name || 'the hospital').replace(/^MercyOne /, '') }; }
export function policeStation() {
  let best = null, bd = Infinity;
  for (const p of W.places.police || []) { const d = dP(p.x, p.z); if (d < bd) { bd = d; best = p; } }
  const f = best && frontOf(best.x, best.z);
  return f ? { x: f.x, z: f.z, name: 'the police station' } : null;
}

// ---------- people ----------
export const live = (w) => !!w && walkers.includes(w) && !w.dead;
const KO = new Set(['flee', 'cower', 'surrender', 'gone']);
// stopped: hit, knocked down, dead, gone, scared off, or held at gunpoint
export const stopped = (w) => !w || !walkers.includes(w) || !!w.dead || !!w.ch.rag || w.held || (w.hp < 40 && w.mode !== 'hostile') || KO.has(w.mode);
// beaten in a fight: down, dead, badly hurt or running away
export const beaten = (w) => !w || !walkers.includes(w) || !!w.dead || !!w.ch.rag || w.hp < 25 || KO.has(w.mode) || w.held;
// aim a gun at a scripted crook for a moment and they give up
export function caught(w, dt) {
  if (stopped(w)) return true;
  const th = K.ctx.threat && K.ctx.threat();
  if (th && th.aimAt === w && w.mode === 'script') { w.aimT = (w.aimT || 0) + dt; if (w.aimT > 0.8) { w.held = true; w.script.pose = { handsUp: true }; w.script.speed = 0; say(w, fresh(["Don't shoot!", 'OK, OK!', "I give up!", 'Easy! Easy!', "It's not what it looks like!"])); return true; } }
  return false;
}
// look: a role name ('crook', 'elderly', 'police'...) or a look array. mask: 1 ski, 2 Tim Arnett, 3 mascot
export function person(ev, role, x, z, h, look = null, mask = 0) {
  let L = look;
  if (mask) { L = (L || roleLook(role)).slice(); L[18] = mask; }
  const w = addScripted(role, x, z, h, L);
  ev.people.push(w);
  return w;
}
export function pose(w, p, speed = null) { if (w && w.mode === 'script' && !w.held) { w.script.pose = p; if (speed !== null) w.script.speed = speed; } }
export function face(w, x, z, dt) { if (w && w.mode === 'script') w.h += angDiff(w.h, Math.atan2(x - w.x, z - w.z)) * Math.min(1, dt * 6); }
// walk/run along heading h (sliding off walls); returns the heading (turned if blocked)
export function move(w, h, speed, dt) {
  if (!w || w.mode !== 'script' || w.held) return h;
  const p = W.pushOutCircle(w.x + Math.sin(h) * speed * dt, w.z + Math.cos(h) * speed * dt, 0.4);
  if (Math.hypot(p.x - w.x, p.z - w.z) < speed * dt * 0.4) h += 1.2;
  if (W.isLand(p.x, p.z)) { w.x = p.x; w.z = p.z; } else h += Math.PI / 2;
  w.h += angDiff(w.h, h) * Math.min(1, dt * 8); w.script.speed = speed * 1.45;
  return h;
}
export function goTo(w, x, z, speed, dt, stop = 0.6) {
  const d = Math.hypot(x - w.x, z - w.z);
  if (d < stop) { if (w.mode === 'script') w.script.speed = 0; return d; }
  move(w, Math.atan2(x - w.x, z - w.z), speed, dt);
  return d;
}
// run away from (x, z), weaving a little; re-aims now and then
export function runFrom(w, x, z, speed, dt) {
  w.runT = (w.runT || 0) - dt;
  if (w.runH === undefined || w.runT <= 0) { w.runT = 1.2 + Math.random() * 1.5; w.runH = Math.atan2(w.x - x, w.z - z) + (Math.random() - 0.5) * 1.1; }
  w.runH = move(w, w.runH, speed, dt);
}
export function free(w, x, z) { if (w && w.mode === 'script' && !w.held) freeScripted(w, x, z); }
// the closest ordinary passer-by (for drunks and loose dogs to pick on)
export function passerBy(x, z, r = 25) {
  let best = null, bd = r;
  for (const w of walkers) { if (w.scripted || w.dead || w.mode !== 'walk') continue; const d = Math.hypot(w.x - x, w.z - z); if (d < bd) { bd = d; best = w; } }
  return best;
}
// someone standing near the player for `secs` (on foot) - how events read "you stepped in"
export function stay(ev, x, z, r, secs, dt, onFoot = true) {
  const ok = dP(x, z) < r && (!onFoot || K.P.foot);
  ev.stayT = ok ? (ev.stayT || 0) + dt : Math.max(0, (ev.stayT || 0) - dt * 2);
  return ev.stayT >= secs;
}

// ---------- cars ----------
export function car(ev, ti, x, z, h, color = null) {
  const v = makeVehicle(K.ctx.newId('e'), ti, color ?? pick(CAR_COLORS), { x, z, h });
  v.keep = true; K.ctx.add(v); ev.cars.push(v);
  return v;
}
// into the traffic, foot down (panic), or weaving (drunk)
export function drive(v, panic = 40, drunk = false) {
  if (!joinTraffic(v)) return false;
  v.ag.panicT = panic; v.ag.drunk = drunk; v.ag.temper = drunk ? 1.3 : 1.15;
  return true;
}
export const carGone = (v) => !K.ctx.vehicles().includes(v);
// a fleeing car is stopped once it's wrecked, you're in it, or it sat still out of traffic for a moment
export function carStopped(ev, v, dt) {
  if (v.exploded || v.hp <= 0 || v === K.P.veh) return true;
  if (v.ag) v.ag.panicT = Math.max(v.ag.panicT || 0, 4);
  ev.stillT = v.mode !== 'traffic' && Math.abs(v.speed || 0) < 1.5 ? (ev.stillT || 0) + dt : 0;
  return ev.stillT > 1.6;
}
export const hazards = (v, secs = 300) => { v.alarmUntil = performance.now() / 1000 + secs; };
export const carSide = (v, side = 1, out = 0.7) => ({ x: v.x + Math.cos(v.h) * (v.T.wid / 2 + out) * side, z: v.z - Math.sin(v.h) * (v.T.wid / 2 + out) * side }); // side 1 = driver's door

// ---------- props: a few boxes ----------
const BOX = new THREE.BoxGeometry(1, 1, 1);
// parts: [color, sx, sy, sz, x, y, z, rotX?]
export function prop(ev, parts, x, z, h = 0) {
  const g = new THREE.Group();
  for (const [c, sx, sy, sz, px, py, pz, rx] of parts) { const m = new THREE.Mesh(BOX, mat(c)); m.scale.set(sx, sy, sz); m.position.set(px, py, pz); if (rx) m.rotation.x = rx; m.castShadow = true; g.add(m); }
  g.position.set(x, W.groundHeight(x, z), z); g.rotation.y = h;
  K.ctx.scene.add(g); ev.props.push(g);
  return g;
}
export const PROPS = {
  cart: [[0x9aa4ad, 0.6, 0.45, 0.9, 0, 0.75, 0], [0x546e7a, 0.62, 0.05, 0.05, 0, 1.05, -0.5], [0x222222, 0.5, 0.12, 0.7, 0, 0.18, 0], [0x9aa4ad, 0.04, 0.5, 0.04, 0.25, 0.4, -0.4], [0x9aa4ad, 0.04, 0.5, 0.04, -0.25, 0.4, -0.4]],
  bin: [[0x2e7d32, 0.6, 1.0, 0.7, 0, 0.55, 0], [0x1b5e20, 0.64, 0.06, 0.74, 0, 1.08, 0], [0x111111, 0.7, 0.2, 0.2, 0, 0.1, -0.3]],
  chair: [[0x212121, 0.55, 0.12, 0.55, 0, 0.5, 0], [0x212121, 0.5, 0.55, 0.08, 0, 0.85, -0.25], [0x9e9e9e, 0.06, 0.4, 0.06, 0, 0.25, 0], [0x424242, 0.6, 0.05, 0.6, 0, 0.05, 0]],
  hotdog: [[0xeceff1, 1.4, 0.8, 0.8, 0, 0.75, 0], [0xd32f2f, 1.45, 0.12, 0.85, 0, 1.2, 0], [0x9e9e9e, 0.05, 1.2, 0.05, 0, 1.8, 0], [0xffeb3b, 1.6, 0.08, 1.6, 0, 2.4, 0], [0x212121, 0.1, 0.5, 0.5, 0.6, 0.25, 0], [0x212121, 0.1, 0.5, 0.5, -0.6, 0.25, 0]],
  coffee: [[0x5d4037, 1.3, 0.85, 0.8, 0, 0.75, 0], [0xffffff, 1.32, 0.15, 0.82, 0, 0.95, 0], [0x3e2723, 0.4, 0.4, 0.4, 0.3, 1.4, 0], [0x212121, 0.1, 0.5, 0.5, 0.55, 0.25, 0], [0x212121, 0.1, 0.5, 0.5, -0.55, 0.25, 0]],
  pretzel: [[0x1565c0, 1.3, 0.85, 0.8, 0, 0.75, 0], [0xffb300, 0.9, 0.5, 0.6, 0, 1.4, 0], [0x212121, 0.1, 0.5, 0.5, 0.55, 0.25, 0], [0x212121, 0.1, 0.5, 0.5, -0.55, 0.25, 0]],
  wallet: [[0x4e342e, 0.22, 0.04, 0.12, 0, 0.03, 0]],
  parcel: [[0xc8a165, 0.6, 0.45, 0.5, 0, 0.23, 0], [0xf5f5f5, 0.62, 0.05, 0.12, 0, 0.46, 0]],
  cake: [[0xffffff, 0.45, 0.35, 0.45, 0, 0.18, 0], [0xf48fb1, 0.47, 0.06, 0.47, 0, 0.37, 0]],
  atm: [[0x37474f, 0.8, 1.6, 0.5, 0, 0.8, 0], [0x4fc3f7, 0.5, 0.35, 0.05, 0, 1.25, 0.26], [0x263238, 0.4, 0.1, 0.08, 0, 0.9, 0.27]],
  dumpster: [[0x2e7d32, 2.0, 1.3, 1.2, 0, 0.65, 0], [0x1b5e20, 2.05, 0.08, 1.25, 0, 1.33, 0]],
  trash: [[0x424242, 0.7, 0.5, 0.7, 0.2, 0.25, 0], [0x212121, 0.6, 0.6, 0.6, -0.4, 0.3, 0.3], [0x5d4037, 0.8, 0.3, 0.5, 0, 0.15, -0.5]],
  ramp: [[0x8d8d8d, 4.2, 0.25, 6.2, 0, 0.75, 0, -0.26], [0xffd23f, 4.25, 0.27, 0.35, 0, 1.55, 2.95, -0.26], [0x5f6368, 4.0, 1.6, 0.25, 0, 0.8, 3.0]],
};

// little animals for the loose-animal events (boxes, like the dogs)
const CRIT = { // body [w, h, len], legH, neck height, head, color, extra
  goat: { c: 0xeeeae0, b: [0.35, 0.4, 0.8], leg: 0.45, nk: 0.25, hd: [0.22, 0.25, 0.3], horn: 0x6d5c4a },
  llama: { c: 0xd9c3a0, b: [0.45, 0.5, 1.0], leg: 0.75, nk: 0.8, hd: [0.22, 0.25, 0.35] },
  pig: { c: 0xf2b3bd, b: [0.5, 0.45, 0.95], leg: 0.25, nk: 0.0, hd: [0.35, 0.32, 0.3] },
  sheep: { c: 0xf5f5f0, b: [0.55, 0.5, 0.85], leg: 0.35, nk: 0.1, hd: [0.22, 0.25, 0.28], face: 0x222222 },
  emu: { c: 0x5d4e3f, b: [0.45, 0.5, 0.6], leg: 0.9, nk: 0.7, hd: [0.13, 0.13, 0.22] },
  raccoon: { c: 0x6f6f6f, b: [0.28, 0.25, 0.5], leg: 0.15, nk: 0.0, hd: [0.22, 0.2, 0.22], face: 0x222222 },
  goose: { c: 0xf0f0f0, b: [0.3, 0.3, 0.5], leg: 0.25, nk: 0.45, hd: [0.1, 0.1, 0.2], beak: 0xff8f00 },
};
export function critter(ev, kind, x, z) {
  const C = CRIT[kind], g = new THREE.Group(), [bw, bh, bl] = C.b, y0 = C.leg + bh / 2;
  const part = (c, sx, sy, sz, px, py, pz, parent = g) => { const m = new THREE.Mesh(BOX, mat(c)); m.scale.set(sx, sy, sz); m.position.set(px, py, pz); m.castShadow = true; parent.add(m); return m; };
  part(C.c, bw, bh, bl, 0, y0, 0);
  if (C.nk) part(C.c, bw * 0.35, C.nk, bw * 0.35, 0, y0 + bh / 2 + C.nk / 2 - 0.05, bl / 2 - 0.05);
  const hy = y0 + bh / 2 + C.nk - 0.02;
  part(C.face || C.c, C.hd[0], C.hd[1], C.hd[2], 0, hy, bl / 2 + C.hd[2] / 2 - 0.05);
  if (C.horn) { part(C.horn, 0.05, 0.18, 0.05, 0.07, hy + 0.18, bl / 2); part(C.horn, 0.05, 0.18, 0.05, -0.07, hy + 0.18, bl / 2); }
  if (C.beak) part(C.beak, 0.08, 0.05, 0.14, 0, hy - 0.02, bl / 2 + C.hd[2]);
  const legs = [];
  for (const [lx, lz] of [[bw / 3, bl / 3], [-bw / 3, bl / 3], [bw / 3, -bl / 3], [-bw / 3, -bl / 3]]) {
    if (kind === 'goose' || kind === 'emu') { if (lz < 0) continue; }
    const leg = new THREE.Group(); leg.position.set(lx, C.leg, kind === 'goose' || kind === 'emu' ? 0 : lz); g.add(leg);
    part(kind === 'goose' ? 0xff8f00 : C.face || C.c, 0.07, C.leg, 0.07, 0, -C.leg / 2, 0, leg); legs.push(leg);
  }
  g.position.set(x, W.groundHeight(x, z), z);
  K.ctx.scene.add(g); ev.props.push(g);
  return { g, x, z, h: Math.random() * 6.28, legs, t: 0, kind };
}
export function stepCritter(c, h, speed, dt) {
  const p = W.pushOutCircle(c.x + Math.sin(h) * speed * dt, c.z + Math.cos(h) * speed * dt, 0.5);
  if (Math.hypot(p.x - c.x, p.z - c.z) < speed * dt * 0.4 || !W.isLand(p.x, p.z)) h += 1.4; else { c.x = p.x; c.z = p.z; }
  c.h += angDiff(c.h, h) * Math.min(1, dt * 6); c.t += dt * (2 + speed * 3);
  c.g.position.set(c.x, W.groundHeight(c.x, c.z), c.z); c.g.rotation.y = c.h;
  c.legs.forEach((l, i) => { l.rotation.x = Math.sin(c.t + (i % 2 ? Math.PI : 0)) * Math.min(0.8, speed * 0.2); });
  return h;
}

// ---------- GTA checkpoint cylinders (pooled; each keeps its own material for the colour) ----------
const marks = [];
let cylGeo = null;
export function marker(ev, x, z, color = 0xffd23f, r = 3, h = 4) {
  if (!cylGeo) cylGeo = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true).translate(0, 0.5, 0);
  let m = marks.find((k) => !k.userData.used);
  if (!m) { m = new THREE.Mesh(cylGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide })); m.renderOrder = 2; marks.push(m); }
  m.userData.used = true; m.material.color.setHex(color); m.scale.set(r, h, r);
  m.position.set(x, W.groundHeight(x, z) - 0.2, z); m.visible = true;
  K.ctx.scene.add(m); ev.marks.push(m);
  return m;
}
export function moveMarker(m, x, z) { m.position.set(x, W.groundHeight(x, z) - 0.2, z); }
export function dropMarker(ev, m) { if (!m) return; m.userData.used = false; m.visible = false; m.parent && m.parent.remove(m); const i = ev.marks.indexOf(m); if (i >= 0) ev.marks.splice(i, 1); }
export function pulseMarkers(t) { const o = 0.26 + Math.sin(t * 3) * 0.06; for (const m of marks) if (m.userData.used) m.material.opacity = o; }

// ---------- the mission line (bottom centre) and timer ----------
// *word* = yellow (places, things), #word# = red (enemies), @word@ = blue (people to help)
let box = null, lineEl, timeEl, owner = null, hideAt = 0, shownSec = -1;
function dom() {
  if (box) return;
  box = document.createElement('div'); box.id = 'evMission';
  box.innerHTML = '<div class="evLine" hidden></div><div class="evTime" hidden></div>';
  (document.getElementById('hud') || document.body).append(box);
  lineEl = box.firstChild; timeEl = box.lastChild;
}
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
export function mission(ev, text, secs = 7, fail = false) {
  dom(); owner = ev;
  lineEl.innerHTML = esc(text).replace(/\*(.+?)\*/g, '<b>$1</b>').replace(/#(.+?)#/g, '<i>$1</i>').replace(/@(.+?)@/g, '<u>$1</u>');
  lineEl.classList.toggle('fail', fail); lineEl.hidden = false;
  hideAt = secs ? performance.now() + secs * 1000 : Infinity;
  box.classList.remove('evIn'); void box.offsetWidth; box.classList.add('evIn');
}
export function timer(ev, sec) {
  if (!box || owner !== ev) return;
  if (sec === null) { timeEl.hidden = true; shownSec = -1; return; }
  const s = Math.max(0, Math.ceil(sec));
  if (s === shownSec) return;
  shownSec = s; timeEl.hidden = false;
  timeEl.textContent = `TIME ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  timeEl.classList.toggle('low', s <= 10);
}
export function tickMission() { if (lineEl && !lineEl.hidden && performance.now() > hideAt) lineEl.hidden = true; }
export function clearMission(ev) { if (box && owner === ev) { lineEl.hidden = true; timeEl.hidden = true; owner = null; shownSec = -1; } }

// ---------- outcomes ----------
export function win(ev, cash, text, title = 'GOOD SAMARITAN') {
  if (ev.done) return;
  ev.done = true; ev.ok = true;
  clearMission(ev);
  K.ctx.reward(Math.max(0, Math.round(cash)), text, title);
}
export function fail(ev, text) {
  if (ev.done) return;
  ev.done = true; ev.ok = false;
  timer(ev, null);
  if (text && (ev.seen || ev.job)) { mission(ev, text, 5, true); K.ctx.feed?.(text); }
  else clearMission(ev);
}
// texts from the phone (agent 1's phone.js); quietly nothing if there's no phone yet
let phone;
export function text(from, msg) {
  if (phone === null) return;
  (phone ? Promise.resolve(phone) : import('../phone.js')).then((m) => { phone = m; m.text?.(from, msg); }).catch(() => { phone = null; });
}

// ---------- sound: a little jingle (ice cream truck), built from the game's own audio context ----------
export function jingle(dist) {
  const a = fx.audio(); if (!a.ac || !a.out || dist > 70) return;
  const v = 0.07 * Math.max(0, 1 - dist / 70), t0 = a.ac.currentTime;
  [784, 659, 784, 880, 784, 659, 523, 587].forEach((f, i) => {
    const o = a.ac.createOscillator(), g = a.ac.createGain();
    o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(v, t0 + i * 0.18); g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.18 + 0.16);
    o.connect(g); g.connect(a.out); o.start(t0 + i * 0.18); o.stop(t0 + i * 0.18 + 0.17);
  });
}
// ---------- giving someone a ride (fares, tourists, the injured, hitchhikers, witnesses) ----------
// The passenger flags you down; pull up next to them and stop, and they walk to your passenger door and get in.
export function pickup(ev, w, dt, o = {}) {
  if (!live(w) || w.mode !== 'script') return false;
  const v = K.P.veh, d = v ? Math.hypot(v.x - w.x, v.z - w.z) : 1e9;
  if (!v || (v.T.bike && !o.bike) || v.T.boat || v.T.heli || d > 14 || Math.abs(v.speed || 0) > 3) {
    if (!o.idle) face(w, K.P.x, K.P.z, dt);
    pose(w, o.idle || { wave: true }, 0);
    return false;
  }
  const door = carSide(v, -1, 0.5);
  if (goTo(w, door.x, door.z, o.speed || 2.2, dt, 0.7) < 0.8) {
    pose(w, o.walk || {});
    ev.look = w.ch.look; ev.role = w.role;
    dropScripted(w); ev.people = ev.people.filter((p) => p !== w);
    v.doorOpen = 1; v.doorCloseAt = performance.now() + 900;
    ev.ride = { v, hp: v.hp, t0: ev.t };
    return true;
  }
  pose(w, o.walk || {});
  return false;
}
// on the way: 'there' (stopped at the destination), 'left' (you got out and walked off), 'wreck', or ''
export function riding(ev, dest, dt) {
  const v = ev.ride.v;
  if (v.exploded || v.hp <= 0) return 'wreck';
  ev.offT = K.P.veh !== v ? (ev.offT || 0) + dt : 0;
  if (ev.offT > 8 || (K.P.veh !== v && dP(v.x, v.z) > 40)) return 'left';
  if (K.P.veh === v && Math.hypot(v.x - dest.x, v.z - dest.z) < 10 && Math.abs(v.speed || 0) < 2.5) return 'there';
  return '';
}
// they get out on the passenger side and walk off
export function dropOff(ev) {
  const v = ev.ride.v, d = carSide(v, -1, 0.8);
  const w = person(ev, ev.role || 'walk', d.x, d.z, v.h - Math.PI / 2, ev.look || null);
  w.leaveNow = true; v.doorOpen = 1; v.doorCloseAt = performance.now() + 900;
  return w;
}
export const dented = (ev) => Math.max(0, ev.ride.hp - ev.ride.v.hp);
// a voice from inside the car
export function inCar(v, pool) { say(v.yeller || (v.yeller = { ch: { g: v.mesh } }), typeof pool === 'string' ? pool : fresh(pool), 3); }
// a destination marker + map blip + the "Take them to X" line and timer
export function goal(ev, dest, line, secs = 0) {
  ev.dest = dest; ev.limit = secs; ev.legT = ev.t;
  for (const m of [...ev.marks]) dropMarker(ev, m);
  ev.destMark = marker(ev, dest.x, dest.z, 0xffd23f, 3, 3);
  mission(ev, line, 9);
}
export const timeLeft = (ev) => ev.limit - (ev.t - ev.legT);
export { fx, W, dropScripted, say };
