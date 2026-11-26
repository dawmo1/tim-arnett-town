// Breakable street props: mailboxes, news boxes, bins, benches, meters, hydrants (water geyser), fences, hedges,
// trash bags, bus-shelter glass, stop signs, streetlights and traffic lights (those two snap at the base and topple,
// and their lamp goes out). Power poles and trees stay solid.
// A hit hides the instance (record.broken, read by stream.js / traffic.js) and throws a copy as debris (fx.debris:
// tumbles, settles, goes after 20-40 s). Broken props come back once their tile is rebuilt, or a few minutes later
// when nobody is near. Cars that hit one lose a little speed and get a dent, by the prop's mass.
import * as THREE from 'three';
import * as W from './world.js';
import * as fx from './fx.js';
import { propLook, refreshProps } from './city/stream.js';
import { sigPosts, sigBroken, setSignalBroken } from './traffic.js';
import { damageZone } from './vehicles.js';

// r: hit radius (m), m: mass (car slowdown / dent), shot: bullets break it, pole: snaps and topples
const KIND = {
  mailbox: { r: 0.35, m: 0.15, shot: true }, newsbox: { r: 0.3, m: 0.12, shot: true }, bin: { r: 0.35, m: 0.1, shot: true },
  bag: { r: 0.35, m: 0.02, shot: true }, meter: { r: 0.15, m: 0.08, shot: true }, hydrant: { r: 0.25, m: 0.35, shot: true, geyser: true },
  bench: { r: 0.9, m: 0.25 }, picket: { r: 1.2, m: 0.06 }, chainlink: { r: 1.5, m: 0.1 }, hedge: { r: 1.0, m: 0.1 },
  busstop: { r: 1.5, m: 0.25, shot: true, glass: true },
  // realism-pass props (city/propgeo.js), when they're placed as junk: utility poles (upole) stay solid
  ruralbox: { r: 0.3, m: 0.12, shot: true }, gnome: { r: 0.2, m: 0.03, shot: true }, planter: { r: 0.5, m: 0.4 },
  featherflag: { r: 0.25, m: 0.03 }, menuboard: { r: 0.5, m: 0.2 },
  streetlight: { r: 0.2, m: 0.45, pole: 7.5 }, signal: { r: 0.2, m: 0.55, pole: 6.2 }, stop: { r: 0.12, m: 0.1, shot: true, pole: 2.6 },
};
const CELL = 10, RESPAWN = 180, MAX_POLES = 8, MAX_GEYSERS = 4;
const grid = new Map(); // cell -> [entry]; entry = {ref, kind, x, y, z, h, tile}
const ck = (i, j) => i * 100003 + j;
const broken = []; // {ref, kind, at, x, z, sig}
let scene, quality = 'medium';

function index(t, rec) {
  const add = (ref, kind) => {
    const k = ck(Math.floor(ref.x / CELL), Math.floor(ref.z / CELL));
    let a = grid.get(k); if (!a) grid.set(k, (a = []));
    a.push({ ref, kind, x: ref.x, y: ref.y, z: ref.z, h: ref.h || 0, tile: t.key });
  };
  for (const j of rec.junk || []) if (KIND[j.kind]) add(j, j.kind);
  for (const l of rec.lights || []) add(l, 'streetlight');
}
function unindex(t) {
  for (const [k, a] of grid) { const b = a.filter((e) => e.tile !== t.key); if (!b.length) grid.delete(k); else if (b.length !== a.length) grid.set(k, b); }
  for (let i = broken.length - 1; i >= 0; i--) if (broken[i].tile === t.key) broken.splice(i, 1); // rebuilt fresh next time
}
export function initBreakables(s, q) {
  scene = s; quality = q || quality;
  W.onStream('built', index);
  W.onStream('unloaded', unindex);
  for (const rec of W.builtTiles.values()) index(rec.t, rec);
}
export function setBreakQuality(q) { quality = q; }

// every intact breakable within r of (x, z) (props + traffic-light / stop-sign posts)
function near(x, z, r, out = []) {
  out.length = 0;
  for (let i = Math.floor((x - r - 2) / CELL); i <= Math.floor((x + r + 2) / CELL); i++) for (let j = Math.floor((z - r - 2) / CELL); j <= Math.floor((z + r + 2) / CELL); j++) {
    const a = grid.get(ck(i, j)); if (a) for (const e of a) if (!e.ref.broken && Math.abs(e.x - x) < r + 2 && Math.abs(e.z - z) < r + 2) out.push(e);
  }
  for (const p of sigPosts) if (!sigBroken.has(p.key) && Math.abs(p.x - x) < r + 1 && Math.abs(p.z - z) < r + 1) out.push({ ref: p, kind: p.kind, x: p.x, y: p.y, z: p.z, h: p.h, sig: true });
  return out;
}
const tmp = [];
// the nearest intact street bench within r of (x, z), to sit on: { x, y, z, h } (h: the way the seat faces), or null
export function benchNear(x, z, r = 1.5) {
  let best = null, bd = r;
  for (const e of near(x, z, r, [])) if (e.kind === 'bench') { const d = Math.hypot(e.x - x, e.z - z); if (d < bd) { bd = d; best = e; } }
  return best && { x: best.x, y: best.y, z: best.z, h: best.h, ref: best.ref };
}

// ---------- debris ----------
const darkMat = new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.6 });
const stopMat = new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.6 });
const stopGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.03, 8).rotateX(Math.PI / 2).rotateZ(Math.PI / 8);
const lensOff = new THREE.MeshStandardMaterial({ color: 0x55534c, roughness: 0.4 });
const boxGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), armGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
const myDebris = () => fx.debrisList.reduce((n, d) => n + (d.m.userData.brk ? 1 : 0), 0);
function throwPiece(e, vx, vy, vz) {
  const K = KIND[e.kind];
  if (myDebris() >= (quality === 'low' ? 10 : 24)) { fx.smokePuff(e.x, e.y + 0.5, e.z, true, 0.5); return; } // capped: it just goes
  const look = propLook(e.kind);
  const m = new THREE.Mesh(look.geo || boxGeo, look.geo ? look.mat : darkMat);
  if (!look.geo) m.scale.set(K.r * 1.4, 1, K.r * 1.4);
  m.position.set(e.x, e.y + 0.05, e.z); m.rotation.y = e.h; m.castShadow = quality !== 'low';
  m.userData.brk = true;
  fx.debris(m, vx, vy, vz);
  fx.debrisList[fx.debrisList.length - 1].life = 20 + Math.random() * 20;
}
// a pole snapping at the base: it tips over away from the hit and lies in the road, then sinks away
const poles = [];
function poleMesh(e) {
  const g = new THREE.Group();
  if (e.kind === 'streetlight') {
    for (const n of ['streetlight', 'streetlight_lens']) { const L = propLook(n); if (L.geo) g.add(new THREE.Mesh(L.geo, n === 'streetlight' ? L.mat : lensOff)); }
    if (!g.children.length) { const p = new THREE.Mesh(boxGeo, darkMat); p.scale.set(0.16, 7.5, 0.16); g.add(p); }
  } else if (e.kind === 'signal') {
    const p = new THREE.Mesh(boxGeo, darkMat); p.scale.set(0.24, 6.2, 0.24); g.add(p);
    const armG = new THREE.Group(); armG.position.y = 6; armG.rotation.y = e.ref.armH - e.h; g.add(armG); // arm out over the road
    const a = new THREE.Mesh(armGeo, darkMat); a.scale.set(0.12, 0.12, e.ref.armLen); armG.add(a);
    const head = new THREE.Mesh(boxGeo, darkMat); head.scale.set(0.42, 1.15, 0.32); head.position.set(0, -1.22, e.ref.armLen); armG.add(head);
  } else {
    const p = new THREE.Mesh(boxGeo, darkMat); p.scale.set(0.07, 2.6, 0.07); g.add(p);
    const s = new THREE.Mesh(stopGeo, stopMat); s.position.set(0, 2.3, 0.05); g.add(s);
  }
  return g;
}
function topple(e, dx, dz, sp) {
  if (poles.length >= MAX_POLES) { const o = poles.shift(); scene.remove(o.g); }
  const g = poleMesh(e), base = new THREE.Group();
  base.position.set(e.x, e.y, e.z); base.rotation.order = 'YXZ'; base.rotation.y = Math.atan2(dx, dz); // local +z = the way it falls
  g.rotation.y = e.h - base.rotation.y; base.add(g); scene.add(base);
  g.traverse((m) => { m.castShadow = quality !== 'low'; });
  poles.push({ g: base, ang: 0, w: Math.min(2.5, 0.4 + sp * 0.08), life: 25 + Math.random() * 15, len: KIND[e.kind].pole });
  fx.sparks(e.x, e.y + 0.3, e.z, 10, dx, dz);
}
// hydrant: a column of water that plays for a while
const geysers = [];
const waterMat = new THREE.MeshBasicMaterial({ color: 0xd4e6f2, transparent: true, opacity: 0.45, depthWrite: false });
const colGeo = new THREE.CylinderGeometry(0.12, 0.3, 1, 8, 1, true).translate(0, 0.5, 0);
function geyser(x, y, z) {
  if (geysers.length >= MAX_GEYSERS) { const o = geysers.shift(); scene.remove(o.m); }
  const m = new THREE.Mesh(colGeo, waterMat); m.position.set(x, y, z); scene.add(m);
  geysers.push({ m, x, y, z, t: 0, life: 25 });
}

// ---------- breaking ----------
// e: an entry from near(); (vx, vy, vz): how it's thrown; returns its mass
function smash(e, vx, vy, vz) {
  const K = KIND[e.kind];
  if (K.glass) { // the shelter stays; its glass goes (and stays gone until it respawns)
    if (e.ref.glassOut) return 0; e.ref.glassOut = true;
    fx.glass(e.x, e.y + 1.2, e.z, quality === 'low' ? 14 : 30); fx.soundCrunch(0.5, 0);
    broken.push({ ref: e.ref, kind: e.kind, at: performance.now() / 1000, x: e.x, z: e.z, tile: e.tile });
    return K.m;
  }
  if (e.sig) setSignalBroken(e.ref.key, true); else { e.ref.broken = true; refreshProps(); }
  broken.push({ ref: e.ref, kind: e.kind, at: performance.now() / 1000, x: e.x, z: e.z, tile: e.tile, sig: e.sig });
  const sp = Math.hypot(vx, vz);
  if (K.pole) topple(e, sp > 0.1 ? vx / sp : 1, sp > 0.1 ? vz / sp : 0, sp);
  else throwPiece(e, vx, vy, vz);
  if (K.geyser) geyser(e.x, e.y, e.z);
  if (e.kind === 'hedge') fx.smokePuff(e.x, e.y + 0.6, e.z, true, 0.7);
  return K.m;
}

// A car (simulated here) driving into props. Call after stepVehicle.
export function hitByCar(v) {
  const T = v.T; if (T.heli || T.boat || v.sinkT > 0) return;
  const sp = Math.hypot(v.vx, v.vz); if (sp < 2.5) return;
  const fx_ = Math.sin(v.h), fz_ = Math.cos(v.h), hl = T.len / 2, hw = T.wid / 2;
  let mass = 0, cx = 0, cz = 0;
  for (const e of near(v.x, v.z, hl + 1.6, tmp)) {
    if (Math.abs(e.y - v.y) > 2.2) continue;
    const K = KIND[e.kind], dx = e.x - v.x, dz = e.z - v.z;
    const lf = dx * fx_ + dz * fz_, lr = dx * -fz_ + dz * fx_;
    if (Math.abs(lf) > hl + K.r || Math.abs(lr) > hw + K.r) continue;
    if (K.glass && e.ref.glassOut) continue;
    const k = 0.7 + Math.random() * 0.4;
    const m = smash(e, v.vx * k, 1.5 + sp * 0.12 + Math.random() * 2, v.vz * k);
    if (m > mass) { mass = m; cx = e.x; cz = e.z; }
  }
  if (!mass) return;
  const k = Math.min(0.3, mass / (T.mass * 2.8)); // a hydrant costs a sedan ~10% of its speed, a meter ~2%, a light pole ~15%
  v.vx *= 1 - k; v.vz *= 1 - k;
  if (v.speed !== undefined) v.speed *= 1 - k;
  damageZone(v, cx, cz, sp * mass * 2.4);
  fx.soundCrunch(Math.min(0.8, mass * 2 + sp / 60), 0);
}
// An explosion at (x, y, z): everything within r breaks and flies outward.
export function blast(x, y, z, r) {
  for (const e of near(x, z, r, tmp)) {
    const dx = e.x - x, dz = e.z - z, d = Math.hypot(dx, dz);
    if (d > r || Math.abs(e.y - y) > r) continue;
    const f = (1 - d / r) * 14 + 3;
    smash(e, (dx / (d || 1)) * f, 4 + f * 0.5, (dz / (d || 1)) * f);
  }
}
// A bullet from o along unit d that stops at distance maxT: breaks the first small prop it passes through.
export function shot(o, d, maxT) {
  const hd = Math.hypot(d.x, d.z) || 1;
  let best = null, bt = maxT;
  for (let s = 0; s < maxT; s += 18) { // walk the ray in 18 m steps (the grid lookup is cheap)
    const px = o.x + d.x * (s + 9), pz = o.z + d.z * (s + 9);
    for (const e of near(px, pz, 11, tmp)) {
      const K = KIND[e.kind]; if (!K.shot || (K.glass && e.ref.glassOut)) continue;
      // closest approach of the ray to the prop's vertical axis
      const t = ((e.x - o.x) * d.x + (e.z - o.z) * d.z) / (hd * hd);
      if (t < 0 || t >= bt) continue;
      const qx = o.x + d.x * t, qz = o.z + d.z * t, qy = o.y + d.y * t;
      if (Math.hypot(qx - e.x, qz - e.z) > K.r + 0.05 || qy < e.y || qy > e.y + (K.pole ? K.pole : K.glass ? 2.5 : 1.3)) continue;
      bt = t; best = e;
    }
    if (best) break;
  }
  if (!best) return Infinity;
  if (best.kind === 'stop' && Math.random() < 0.6) { fx.sparks(best.x, best.y + 2.3, best.z, 4); return bt; } // takes a few
  smash(best, d.x * 6, 2 + Math.random() * 2, d.z * 6);
  return bt;
}

// Per frame: falling poles, geysers, and respawning what got broken a while ago once nobody's near.
let respT = 0;
export function updateBreakables(dt, px, pz) {
  for (let i = poles.length - 1; i >= 0; i--) {
    const p = poles[i];
    p.life -= dt;
    if (p.ang < Math.PI / 2) { p.w += (14 / p.len) * Math.sin(p.ang + 0.05) * dt; p.ang = Math.min(Math.PI / 2, p.ang + p.w * dt); if (p.ang >= Math.PI / 2) fx.smokePuff(p.g.position.x + Math.sin(p.g.rotation.y) * p.len * 0.7, p.g.position.y + 0.3, p.g.position.z + Math.cos(p.g.rotation.y) * p.len * 0.7, true, 0.8); }
    p.g.rotation.x = p.ang; // tips about its local x: falls toward local +z
    if (p.life < 2) p.g.position.y -= dt * 0.4;
    if (p.life <= 0) { scene.remove(p.g); poles.splice(i, 1); }
  }
  for (let i = geysers.length - 1; i >= 0; i--) {
    const g = geysers[i]; g.t += dt;
    const h = Math.min(1, g.t * 3) * Math.max(0, Math.min(1, (g.life - g.t) / 4)) * (5.5 + Math.sin(g.t * 13) * 0.4);
    g.m.scale.set(1, Math.max(0.01, h), 1);
    if (h > 0.5 && Math.random() < (quality === 'low' ? 0.3 : 0.8)) fx.splash(g.x, g.y + h - 0.3, g.z, 0, 0, quality === 'low' ? 1 : 3);
    if (g.t >= g.life) { scene.remove(g.m); geysers.splice(i, 1); }
  }
  respT -= dt; if (respT > 0) return; respT = 2;
  const now = performance.now() / 1000;
  let redraw = false;
  for (let i = broken.length - 1; i >= 0; i--) {
    const b = broken[i];
    if (now - b.at < RESPAWN || Math.hypot(b.x - px, b.z - pz) < 120) continue;
    if (b.sig) setSignalBroken(b.ref.key, false); else { b.ref.broken = false; b.ref.glassOut = false; redraw = true; }
    broken.splice(i, 1);
  }
  if (redraw) refreshProps();
}
export function clearBreakables() { for (const p of poles) scene.remove(p.g); for (const g of geysers) scene.remove(g.m); poles.length = geysers.length = 0; }
