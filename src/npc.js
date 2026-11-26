// Townspeople. Each player has their own crowd around them (only what you do to them matters):
// people walk Davenport's sidewalks, cross at corners (waiting for the walk signal at traffic
// lights), and the mix fits the neighbourhood and the hour: office workers downtown, students by
// Palmer, shoppers at NorthPark, joggers and dog walkers on the riverfront, bus stops, buskers,
// food carts, road crews, mail carriers, cyclists, people mowing lawns, bar crowds at night and
// crowds at the ballpark and the bandshell on summer evenings.
// When trouble starts they run, cower, put their hands up, call the cops, or (some of them) fight back.
import * as THREE from 'three';
import * as W from './world.js';
import { G, pointOnEdge, district } from './city/data.js';
import { nodeRadius } from './city/tile.js';
import { angDiff } from './util.js';
import { makeCharacter, randomLook, roleLook, animateCharacter, placeCharacter, mat, disposeCharacter, setProp } from './character.js';
import { ragdoll, release, ragPos, standUp } from './ragdoll.js';
import { signalState } from './traffic.js';
import { sky } from './daynight.js';
import { turfAt, gangLook, gangById, warnLine, GANGS } from './gangs.js';

export const walkers = [];
export const fleeing = [];
let scene, ctx = { target: () => null, hitPlayer() {}, shot() {}, vehicles: () => [], allVehicles: () => [], threat: () => null, focus: () => null, quality: () => 'medium', player: () => null };
export function setNpcContext(c) { ctx = { ...ctx, ...c }; }
const pickW = (list) => { let t = 0; for (const [, w] of list) t += w; let x = Math.random() * t; for (const [v, w] of list) { x -= w; if (x <= 0) return v; } return list[0][0]; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];

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

// ---------- looks by role ----------
const ROLE_LOOK = { office: 'office', worker: 'worker', mail: 'mail', jogger: 'jogger', vendor: 'vendor', student: 'student', shopper: null, bar: 'bar' };
const lookFor = (role) => (role.startsWith('gang:') ? gangLook(gangById(role.slice(5)), roleLook) : roleLook(ROLE_LOOK[role] || role));

// ---------- props ----------
const PROP = {};
function propMats() {
  if (PROP.ready) return;
  PROP.ready = true;
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d'); g.fillStyle = '#1565c0'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#fff'; g.font = 'bold 44px Arial'; g.textAlign = 'center'; g.fillText('BUS', 64, 58); g.font = 'bold 22px Arial'; g.fillText('STOP', 64, 92);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  PROP.busSign = new THREE.MeshStandardMaterial({ map: t });
}
function box(parent, c, sx, sy, sz, x, y, z, m) { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m || mat(c)); b.position.set(x, y, z); b.castShadow = true; parent.add(b); return b; }
function propGroup(x, z, h) { const g = new THREE.Group(); g.position.set(x, W.groundHeight(x, z), z); g.rotation.y = h; scene.add(g); return g; }
function addBoard(ch) { // a skateboard under their feet
  const b = new THREE.Group(); ch.g.add(b);
  box(b, pick([0x111111, 0xc62828, 0x1565c0, 0x2e7d32]), 0.22, 0.03, 0.8, 0, 0.1, 0);
  for (const z of [0.28, -0.28]) box(b, 0xf5f5f5, 0.2, 0.05, 0.05, 0, 0.05, z);
  b.rotation.y = Math.PI / 2;
  return b;
}
const holdProps = {
  bag: (ch) => setProp(ch, 'bag'),
  backpack: (ch) => setProp(ch, 'backpack'),
  mailbag: (ch) => setProp(ch, 'mailbag'),
  guitar: (ch) => setProp(ch, 'guitar'),
  bike: (ch) => { const b = new THREE.Group(); ch.g.add(b); const col = pick([0xc62828, 0x1565c0, 0x212121, 0x2e7d32, 0xf9a825]); box(b, col, 0.06, 0.06, 1.0, 0, 0.62, 0); box(b, col, 0.06, 0.5, 0.06, 0, 0.45, 0.35); box(b, col, 0.06, 0.45, 0.06, 0, 0.48, -0.1); for (const zz of [0.55, -0.5]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 6, 14), mat(0x111111)); w.rotation.y = Math.PI / 2; w.position.set(0, 0.34, zz); b.add(w); } box(b, 0x111111, 0.45, 0.04, 0.04, 0, 0.98, 0.42); return b; },
  mower: (ch) => { const m = new THREE.Group(); m.position.set(0, 0, 0.9); ch.g.add(m); box(m, 0xc62828, 0.55, 0.28, 0.6, 0, 0.22, 0); box(m, 0x212121, 0.05, 0.6, 0.05, 0.2, 0.55, -0.35).rotation.x = -0.6; box(m, 0x212121, 0.05, 0.6, 0.05, -0.2, 0.55, -0.35).rotation.x = -0.6; return m; },
};

// ---------- the sidewalk network (derived from the roads) ----------
const SIDEWALK = (e) => e.cls !== 'service' && e.cls !== 'motor' && e.cls !== 'trunk' && !e.bridge;
const swOff = (e) => e.width / 2 + 1.1;
const nodeTrim = (k) => (G.adj[k].length >= 2 ? nodeRadius(k) + 1.0 : 0.5);
function sidePose(e, s, side, lat = 0) {
  const q = pointOnEdge(e, s), o = (swOff(e) + lat) * side;
  return { x: q.x - Math.cos(q.h) * o, z: q.z + Math.sin(q.h) * o, h: q.h };
}
// Walk state: e, s, dir (+1 toward b), side (+1 = right of a->b), lat (personal lane)
function walkPose(w) { const p = sidePose(w.e, w.s, w.side, w.lat); return { x: p.x, z: p.z, h: w.dir > 0 ? p.h : p.h + Math.PI }; }
function chooseLink(w) {
  const k = w.dir > 0 ? w.e.b : w.e.a, P = walkPose(w);
  const opts = [];
  for (const id of G.adj[k]) {
    const e2 = G.edges[id]; if (!SIDEWALK(e2) || (e2 === w.e && G.adj[k].length > 1)) continue;
    const dir2 = e2.a === k ? 1 : -1, s2 = dir2 > 0 ? Math.min(e2.len / 2, nodeTrim(k)) : Math.max(e2.len / 2, e2.len - nodeTrim(k));
    for (const side2 of [1, -1]) {
      const Q = sidePose(e2, s2, side2, w.lat), d = Math.hypot(Q.x - P.x, Q.z - P.z);
      const cross = d > 9; // anything further than the corner means crossing a street
      const straight = Math.abs(angDiff(P.h, dir2 > 0 ? Q.h : Q.h + Math.PI)) < 0.6;
      opts.push([{ e: e2, dir: dir2, s: s2, side: side2, Q, cross, k }, (cross ? 0.35 : 1) * (straight ? 1.6 : 1) * (e2 === w.e ? 0.05 : 1)]);
    }
  }
  if (!opts.length) return null;
  return pickW(opts);
}
function canCross(w, L, tSec) {
  const hc = Math.atan2(L.Q.x - w.x, L.Q.z - w.z);
  if (G.nodes.ctrl[L.k] === 1 && G.adj[L.k].length >= 3) return signalState(L.k, hc + Math.PI / 2, tSec) === 'r'; // walk signal: the crossed road has red
  const mx = (w.x + L.Q.x) / 2, mz = (w.z + L.Q.z) / 2;
  for (const v of ctx.vehicles()) {
    if (Math.abs(v.x - mx) > 22 || Math.abs(v.z - mz) > 22 || Math.hypot(v.vx || 0, v.vz || 0) < 2.5) continue;
    if ((mx - v.x) * (v.vx || 0) + (mz - v.z) * (v.vz || 0) > 0) return false; // coming this way
  }
  return true;
}

// ---------- spawning ----------
// from the map data: Modern Woodmen Park, LeClaire Park, Palmer College, NorthPark Mall
const VENUES = [{ x: -372, z: 558, name: 'ballpark' }, { x: -52, z: 513, name: 'bandshell' }];
const PALMER = { x: 318, z: -544 }, NORTHPARK = { x: 290, z: -4413 };
function roleMix(x, z, hour) {
  const d = district(x, z), night = hour < 6 || hour > 21, eve = hour >= 17 && hour <= 23, work = hour >= 7 && hour <= 18;
  const m = [['walk', 30], ['dog', 7], ['phone', 4], ['chat', 6]];
  const add = (k, w) => { if (w > 0) m.push([k, w]); };
  if (d === 'downtown') { add('office', work ? 35 : 4); add('shopper', 10); add('busstop', 5); add('musician', eve || work ? 2.5 : 0); add('cart', work ? 2 : 0); add('crew', work ? 2 : 0); add('mail', work ? 2 : 0); add('cyclist', 5); add('jogger', 2); }
  else if (d === 'village') { add('shopper', 10); add('cyclist', 6); add('musician', 2); add('cart', work ? 1 : 0); add('busstop', 2); add('chat', 6); }
  else if (d === 'riverfront') { add('jogger', 22); add('dog', 10); add('cyclist', 15); add('cart', work || eve ? 3 : 0); add('musician', 2); add('chat', 6); }
  else if (d === 'north') { add('shopper', 35); add('busstop', 4); add('crew', work ? 2 : 0); add('cyclist', 2); }
  else { add('jogger', 6); add('cyclist', 6); add('mail', work ? 4 : 0); add('mower', work && hour > 9 ? 5 : 0); add('crew', work ? 2 : 0); add('busstop', 3); add('dog', 6); }
  // everyday street life
  add('elderly', work ? 5 : 2); add('pair', 7); add('smoker', d === 'downtown' || d === 'village' ? 4 : 1.5); add('coffee', d === 'downtown' ? 4 : 1);
  add('sweeper', work && (d === 'downtown' || d === 'village') ? 1.5 : 0); add('carwash', work && (d === 'west' || d === 'east' || d === 'north') ? 1.5 : 0);
  add('stretch', d === 'riverfront' ? 4 : 0.6); add('skaters', d === 'riverfront' || d === 'village' ? 2 : 0.4);
  add('preacher', d === 'downtown' && work ? 0.8 : 0); add('protest', d === 'downtown' && work ? 0.7 : 0); add('mascot', (d === 'riverfront' || d === 'north') && (work || eve) ? 0.6 : 0);
  const turf = turfAt(x, z);
  if (turf) { add('gang', night ? 30 : 16); add('smoker', 3); }
  if (Math.hypot(x - PALMER.x, z - PALMER.z) < 350) add('student', 45);
  if (Math.hypot(x - NORTHPARK.x, z - NORTHPARK.z) < 450) add('shopper', 40);
  if (night) for (const r of m) if (['office', 'mail', 'mower', 'crew', 'cart', 'shopper', 'student', 'elderly', 'sweeper', 'carwash', 'preacher', 'protest', 'mascot', 'coffee'].includes(r[0])) r[1] *= 0.05;
  return m;
}
// out of the camera's sight (or far enough not to notice)
function hidden(x, z, cam) {
  if (!cam) return true;
  const dx = x - cam.x, dz = z - cam.z, d = Math.hypot(dx, dz) || 1;
  return d > 140 || (dx * cam.fx + dz * cam.fz) / d < 0.3;
}
let groups = []; // {props: [Object3D], members: [walker], x, z}
function newWalker(role, x, z, h, grp) {
  const ch = makeCharacter(lookFor(role));
  if (role.startsWith('gang:') || role === 'crook') ch.style = 'gang'; else if (role === 'elderly') ch.style = 'old'; // walk styles (people/pose.js)
  scene.add(ch.g);
  const w = { ch, role, x, z, y: W.groundHeight(x, z), h, hp: 40, dead: null, panic: 0, mode: 'walk', grp,
    temper: Math.random() < 0.18 ? 'brawler' : Math.random() < 0.027 ? 'gunman' : 'normal', speed: 1.15 + Math.random() * 0.5, lat: (Math.random() - 0.5) * 0.9, shirt: ch.shirtColor,
    react: 0.25 + Math.random() ** 2 * 0.75 }; // seconds to notice danger: most are quickish, a few are slow
  if (role === 'office') w.speed += 0.2;
  if ((role === 'walk' || role === 'office' || role === 'student' || role === 'shopper') && Math.random() < 0.15) w.texting = true; // eyes on the phone
  if (role === 'elderly') w.react += 0.3;
  if (role === 'jogger') w.speed = 3 + Math.random() * 0.8;
  if (role === 'cyclist') { w.speed = 4 + Math.random() * 1.5; holdProps.bike(ch); w.pose = 'bike'; }
  if (role === 'shopper' && Math.random() < 0.8) holdProps.bag(ch);
  if (role === 'student') holdProps.backpack(ch);
  if (role === 'mail') holdProps.mailbag(ch);
  if (role === 'elderly') { w.speed = 0.75 + Math.random() * 0.25; if (Math.random() < 0.6) { setProp(ch, 'cane'); w.cane = true; } }
  if (role === 'dog') { w.dog = makeDog(pick([0x8d6e63, 0xf5f5f5, 0x212121, 0xd7a35a, 0x5d4037])); scene.add(w.dog.g); w.dog.g.position.set(x, w.y, z); }
  walkers.push(w);
  return w;
}
function startWalking(w, e, s, side, dir) { w.mode = 'walk'; w.e = e; w.s = s; w.side = side; w.dir = dir; w.link = null; }
function spawnOne(focus, cam, R, hour) {
  for (let tries = 0; tries < 6; tries++) {
    const a = Math.random() * Math.PI * 2, r = 35 + (R - 35) * Math.random() ** 1.5; // busier close to you
    const q = W.nearestEdge(focus.x + Math.cos(a) * r, focus.z + Math.sin(a) * r, 40, SIDEWALK);
    if (!q || q.e.len < 16) continue;
    const side = Math.random() < 0.5 ? 1 : -1, s = Math.max(4, Math.min(q.e.len - 4, q.s));
    const p = sidePose(q.e, s, side);
    if (!W.isLand(p.x, p.z) || W.pushOutCircle(p.x, p.z, 0.4).hit) continue;
    if (!hidden(p.x, p.z, cam) && Math.hypot(p.x - focus.x, p.z - focus.z) < 110) continue;
    const role = pickW(roleMix(p.x, p.z, hour));
    if (['walk', 'dog', 'office', 'shopper', 'student', 'jogger', 'cyclist', 'mail', 'elderly', 'pair'].includes(role)) {
      const w = newWalker(role === 'pair' ? 'walk' : role, p.x, p.z, 0, null);
      const dir = Math.random() < 0.5 ? 1 : -1;
      startWalking(w, q.e, s, side, dir);
      if (role === 'pair') { // a couple / two friends side by side, chatting
        const b = newWalker('walk', p.x, p.z, 0, null);
        startWalking(b, q.e, s, side, dir); b.buddyOf = w; w.lat = -0.35; b.lat = 0.35; b.speed = w.speed; w.chatty = b.chatty = true;
        return 2;
      }
      return 1;
    }
    return spawnScene(role, q.e, s, side, p);
  }
  return 0;
}
// small set pieces: bus stops, buskers, carts, road crews, chatting groups, lawn mowing
function spawnScene(role, e, s, side, p) {
  propMats();
  const face = sidePose(e, s, side).h + (side > 0 ? -Math.PI / 2 : Math.PI / 2); // facing the street
  const grp = { props: [], members: [], x: p.x, z: p.z };
  const add = (r, dx, dz, h, fixed) => { const x = p.x + dx, z = p.z + dz; const w = newWalker(r, x, z, h, grp); w.mode = 'fixed'; w.fixed = { x, z, h, ...fixed }; grp.members.push(w); return w; };
  const fx = Math.sin(face), fz = Math.cos(face), ax = Math.cos(face), az = -Math.sin(face); // forward / along the kerb
  if (role === 'busstop') {
    const g = propGroup(p.x - fx * 0.6, p.z - fz * 0.6, face); grp.props.push(g);
    box(g, 0x546e7a, 0.08, 2.6, 0.08, 1.4, 1.3, 0.4); box(g, 0, 0.5, 0.5, 0.04, 1.4, 2.4, 0.4, PROP.busSign);
    box(g, 0x6d4c41, 1.6, 0.08, 0.45, -0.2, 0.48, 0); box(g, 0x37474f, 0.06, 0.45, 0.06, -0.9, 0.24, 0); box(g, 0x37474f, 0.06, 0.45, 0.06, 0.5, 0.24, 0);
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) add('walk', -fx * 0.55 + ax * (i - 0.5) * 0.7, -fz * 0.55 + az * (i - 0.5) * 0.7, face, { pose: i === 0 || Math.random() < 0.4 ? 'sit' : 'phone' });
  } else if (role === 'musician') {
    const w = add('walk', 0, 0, face, { pose: 'play' }); holdProps.guitar(w.ch);
    const g = propGroup(p.x + fx * 0.6, p.z + fz * 0.6, face); grp.props.push(g); box(g, 0x3e2723, 0.6, 0.18, 0.3, 0, 0.09, 0); // open guitar case
    for (let i = 0; i < 3; i++) add('walk', fx * (2.4 + Math.random()) + ax * (i - 1) * 1.1, fz * (2.4 + Math.random()) + az * (i - 1) * 1.1, face + Math.PI, { pose: 'stand' });
  } else if (role === 'cart') {
    const g = propGroup(p.x, p.z, face); grp.props.push(g);
    box(g, 0xd32f2f, 1.5, 0.9, 0.8, 0, 0.75, 0); box(g, 0xeceff1, 1.52, 0.1, 0.82, 0, 1.22, 0); box(g, 0x212121, 0.05, 1.4, 0.05, 0, 1.9, 0);
    const um = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.5, 8), mat(pick([0xffeb3b, 0xff7043, 0x29b6f6]))); um.position.set(0, 2.7, 0); g.add(um);
    for (const zz of [-0.25, 0.25]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 10), mat(0x212121)); wh.rotation.z = Math.PI / 2; wh.position.set(0.75, 0.2, zz); g.add(wh); }
    add('vendor', -fx * 0.9, -fz * 0.9, face, { pose: 'stand' });
    if (Math.random() < 0.7) add('walk', fx * 1.2, fz * 1.2, face + Math.PI, { pose: 'stand' });
    grp.cart = { x: p.x, z: p.z };
  } else if (role === 'crew') {
    // cones on the parking lane, workers on the kerb
    const q = pointOnEdge(e, s), o = (e.width / 2 - 1) * side;
    const g = propGroup(q.x - Math.cos(q.h) * o, q.z + Math.sin(q.h) * o, q.h); grp.props.push(g);
    for (let i = -2; i <= 2; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.7, 8), mat(0xff6d00)); c.position.set(0, 0.35, i * 2.2); g.add(c); box(g, 0xffffff, 0.22, 0.08, 0.22, 0, 0.42, i * 2.2); }
    box(g, 0x8d6e63, 1.2, 0.05, 2.2, side * -0.4, 0.03, 0); // a dug-up patch
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) add('worker', ax * (i - 1) * 1.6 - fx * 0.2, az * (i - 1) * 1.6 - fz * 0.2, face + (i % 2 ? Math.PI : 0) + 0.3, { pose: 'chat' });
  } else if (role === 'chat') {
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, x = Math.cos(a) * 0.85, z = Math.sin(a) * 0.85; add('walk', x - fx * 0.3, z - fz * 0.3, Math.atan2(-x, -z), { pose: 'chat' }); }
  } else if (role === 'phone') {
    add('walk', -fx * 0.4, -fz * 0.4, face + (Math.random() - 0.5), { pose: 'phone' });
  } else if (role === 'gang') { // a crew hanging out on their corner
    const g = turfAt(p.x, p.z); if (!g) return 0;
    const n = 3 + Math.floor(Math.random() * 2), deal = Math.random() < 0.3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, x = Math.cos(a) * 1.1 - fx * 0.6, z = Math.sin(a) * 1.1 - fz * 0.6;
      const pose = deal && i < 2 ? 'chat' : ['chat', 'smoke', 'phone', 'stand'][Math.floor(Math.random() * 4)];
      const w = add('gang:' + g.id, x, z, Math.atan2(-x, -z), { pose });
      w.gang = g.id; w.temper = Math.random() < 0.18 ? 'gunman' : 'brawler'; w.farCol = parseInt(g.color.slice(1), 16);
      if (pose === 'smoke') setProp(w.ch, 'cig');
    }
    grp.gang = g.id;
  } else if (role === 'smoker') { // leaning on the wall behind the sidewalk, smoking
    const t = W.rayBuildings(p.x, W.groundHeight(p.x, p.z) + 1, p.z, -fx, 0, -fz, 6);
    if (t >= 6) return 0;
    const n = Math.random() < 0.35 ? 2 : 1;
    for (let i = 0; i < n; i++) { const w = add('walk', -fx * (t - 0.35) + ax * i * 0.8, -fz * (t - 0.35) + az * i * 0.8, face, { pose: 'lean' }); setProp(w.ch, 'cig'); }
  } else if (role === 'coffee') {
    const w = add('walk', -fx * 0.5, -fz * 0.5, face + (Math.random() - 0.5), { pose: 'coffee' }); setProp(w.ch, 'coffee');
    if (Math.random() < 0.5) { const b = add('walk', -fx * 0.5 + ax * 0.9, -fz * 0.5 + az * 0.9, face + Math.PI / 2, { pose: 'chat' }); void b; }
  } else if (role === 'sweeper') {
    const w = add('worker', -fx * 0.4, -fz * 0.4, face + Math.PI / 2, { pose: 'sweep' }); setProp(w.ch, 'cane');
  } else if (role === 'carwash') {
    const car = ctx.allVehicles().find((v) => v.mode === 'parked' && !v.T.bike && Math.hypot(v.x - p.x, v.z - p.z) < 25);
    if (!car) return 0;
    const lx = Math.cos(car.h), lz = -Math.sin(car.h), o = car.T.wid / 2 + 0.55;
    const x = car.x + lx * o - p.x, z = car.z + lz * o - p.z;
    add('walk', x, z, car.h - Math.PI / 2, { pose: 'wash', lines: ['Missed a spot...', 'Sparkling!'] });
  } else if (role === 'stretch') {
    add('jogger', -fx * 0.3, -fz * 0.3, face + Math.PI / 2, { pose: 'stretch' });
  } else if (role === 'preacher') {
    add('preacher', -fx * 0.6, -fz * 0.6, face, { pose: 'preach', lines: ['Repent!', 'The end is near!', 'Turn back!', 'Mayor Tim sees all!', 'Love thy neighbor!'] });
    for (let i = 0; i < Math.floor(Math.random() * 3); i++) add('walk', fx * 2.5 + ax * (i - 0.5) * 1.2, fz * 2.5 + az * (i - 0.5) * 1.2, face + Math.PI, { pose: Math.random() < 0.5 ? 'phone' : 'stand' });
  } else if (role === 'protest') {
    const n = 3 + Math.floor(Math.random() * 3);
    const chants = ['Fix the potholes!', 'Save the riverfront!', 'Four more years!', 'Re-elect Tim!', 'Lower the rent!', 'Bring back the trolley!'];
    for (let i = 0; i < n; i++) { const w = add('protest', -fx * 0.4 + ax * (i - n / 2) * 1.1, -fz * 0.4 + az * (i - n / 2) * 1.1, face, { pose: 'sign', lines: chants }); setProp(w.ch, 'sign'); }
  } else if (role === 'mascot') {
    add('mascot', -fx * 0.5, -fz * 0.5, face, { pose: 'dance', lines: ['Woo!', 'Go River Rats!', 'High five!'] });
  } else if (role === 'skaters') {
    const n = 2 + Math.floor(Math.random() * 2), dir = Math.random() < 0.5 ? 1 : -1;
    for (let i = 0; i < n; i++) { const w = newWalker('skater', p.x, p.z, 0, null); startWalking(w, e, Math.max(2, Math.min(e.len - 2, s + i * 2.5 * dir)), side, dir); w.speed = 4.2 + Math.random() * 0.6; w.skate = true; addBoard(w.ch); }
    return n;
  } else if (role === 'mower') {
    // out on a front lawn, back and forth
    const lx = p.x - fx * 6, lz = p.z - fz * 6;
    if (W.classAt(lx, lz) !== W.C.lawn || W.pushOutCircle(lx, lz, 3).hit) return 0;
    const w = add('walk', -fx * 6, -fz * 6, face, { pose: 'mow' }); holdProps.mower(w.ch);
    w.mow = { x: lx, z: lz, ax, az, t: Math.random() * 10 };
  } else return 0;
  groups.push(grp);
  return grp.members.length;
}
// crowds at the ballpark / bandshell on summer evenings, and outside bars at night
function spawnCrowd(x, z, n, faceX, faceZ) {
  const grp = { props: [], members: [], x, z, crowd: true };
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 9, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    if (!W.isLand(px, pz) || W.pushOutCircle(px, pz, 0.4).hit) continue;
    const road = W.nearestEdge(px, pz, 12); if (road && road.d < road.e.width / 2 + 0.6) continue; // not in the street
    const w = newWalker('walk', px, pz, Math.atan2(faceX - px, faceZ - pz), grp);
    w.mode = 'fixed'; w.fixed = { x: px, z: pz, h: w.h, pose: Math.random() < 0.4 ? 'chat' : Math.random() < 0.3 ? 'cheer' : 'stand' };
    grp.members.push(w);
  }
  groups.push(grp);
  return grp;
}
let rivalT = 40;
// Two crews clash: a rival group walks up to a gang hanging out and it kicks off.
function manageRivals(focus, dt) {
  rivalT -= dt; if (rivalT > 0) return; rivalT = 50 + Math.random() * 70;
  const home = groups.find((g) => g.gang && g.members.some((m) => !m.dead && m.mode === 'fixed') && Math.hypot(g.x - focus.x, g.z - focus.z) < 120);
  if (!home) return;
  const others = GANGS.filter((g) => g.id !== home.gang), rival = others[Math.floor(Math.random() * others.length)];
  const a = Math.random() * Math.PI * 2, rx = home.x + Math.cos(a) * 24, rz = home.z + Math.sin(a) * 24;
  if (!W.isLand(rx, rz) || W.pushOutCircle(rx, rz, 1).hit) return;
  const crew = [];
  for (let i = 0; i < 3; i++) { const w = newWalker('gang:' + rival.id, rx + (i - 1) * 1.2, rz, 0, null); w.gang = rival.id; w.temper = Math.random() < 0.2 ? 'gunman' : 'brawler'; w.farCol = parseInt(rival.color.slice(1), 16); crew.push(w); }
  const locals = home.members.filter((m) => !m.dead);
  for (const w of crew) { w.enemy = locals[Math.floor(Math.random() * locals.length)]; say(w, `${rival.name}!`); goHostile(w, w.temper === 'gunman' ? 'gun' : 'melee', false); w.modeT = 30; }
  for (const m of locals) { m.enemy = crew[Math.floor(Math.random() * crew.length)]; goHostile(m, m.temper === 'gunman' ? 'gun' : 'melee', false); m.modeT = 30; }
}
let crowdT = 0;
function manageCrowds(focus, hour, dt) {
  manageRivals(focus, dt);
  crowdT -= dt; if (crowdT > 0) return; crowdT = 8;
  const evening = hour >= 17.5 && hour <= 22.5, late = hour >= 21 || hour < 2;
  for (const v of VENUES) {
    if (Math.hypot(v.x - focus.x, v.z - focus.z) > 260 || !evening || groups.some((g) => g.venue === v.name)) continue;
    // gather on open ground near the venue (or the closest sidewalk)
    let sp = null;
    for (let i = 0; i < 20 && !sp; i++) { const a = Math.random() * 6.28, r = 20 + Math.random() * 50, x = v.x + Math.cos(a) * r, z = v.z + Math.sin(a) * r; if (W.isLand(x, z) && !W.pushOutCircle(x, z, 4).hit) sp = { x, z }; }
    sp = sp || W.sidewalkSpot({ x: v.x, z: v.z, r: 60 });
    spawnCrowd(sp.x, sp.z, ctx.quality() === 'low' ? 8 : 18, v.x, v.z).venue = v.name;
  }
  if (late) for (const b of W.D.index.poi) {
    if ((b.kind !== 'bar' && b.kind !== 'pub') || Math.hypot(b.x - focus.x, b.z - focus.z) > 220 || groups.some((g) => g.bar === b)) continue;
    const q = W.nearestEdge(b.x, b.z, 60, SIDEWALK); if (!q) continue;
    const dx = b.x - q.x, dz = b.z - q.z, l = Math.hypot(dx, dz) || 1, o = q.e.width / 2 + 1.3;
    spawnCrowd(q.x + (dx / l) * o, q.z + (dz / l) * o, 3 + Math.floor(Math.random() * 4), b.x, b.z).bar = b;
  }
}
function removeWalker(w) {
  scene.remove(w.ch.g); release(w.ch); disposeCharacter(w.ch);
  if (w.dog) scene.remove(w.dog.g);
  const i = walkers.indexOf(w); if (i >= 0) walkers.splice(i, 1);
}
function removeGroup(g) { for (const m of g.members) if (walkers.includes(m)) removeWalker(m); for (const p of g.props) scene.remove(p); groups = groups.filter((x) => x !== g); }

// ---------- reactions ----------
// Something scary happened at (x, z). kind: 'gunfire' | 'attack' | 'explosion'
export function scare(x, z, radius, kind = 'gunfire') {
  for (const w of walkers) {
    if (w.dead || w.mode === 'gone' || w.mode === 'hostile') continue;
    const d = Math.hypot(w.x - x, w.z - z);
    if (d > radius) continue;
    if (w.temper === 'gunman' && d < 30 && kind !== 'explosion' && Math.random() < 0.5) { goHostile(w, 'gun'); continue; }
    if (w.call) continue; // already on the phone to the cops
    // calm people take their own moment to clock it (a bang is hard to miss), then run, hide or trip (see w.pending)
    if (CALM.has(w.mode)) { if (!w.pending) w.pending = { t: reactT(w) * (kind === 'explosion' ? 0.5 : 1), x, z }; continue; }
    if (Math.random() < 0.3) hideFrom(w, x, z);
    else startFlee(w, x, z);
  }
}
// how long this person takes to react to danger; phones and chats make it worse
const reactT = (w) => w.react + (w.texting || w.chatty || (w.fixed && (w.fixed.pose === 'phone' || w.fixed.pose === 'chat')) ? 0.45 : 0);
export const panicNear = (x, z, radius) => scare(x, z, radius, 'gunfire');
// A crash, a fistfight or someone down (no shooting): people stop, gather round and film it.
const WATCH_LINES = { alarm: ['Hey! Is that your car?!', "Somebody's stealing a car!", 'Ugh, that alarm...', "I'm calling the cops!", 'Hey! Stop!'], crash: ['Whoa!', 'Did you see that?!', 'Is everyone OK?', "I'm calling 911!", 'Oh my god!'], fight: ['Fight! Fight!', 'Break it up!', 'Ooooh!', 'Somebody stop them!', 'Get him!'], down: ['Is he OK?!', 'Call an ambulance!', 'Oh no...', 'Somebody help!'] };
export function incident(x, z, kind = 'crash') {
  let n = 0;
  for (const w of walkers) {
    if (w.dead || !CALM.has(w.mode) || w.mode === 'watch' || w.grp?.crowd) continue;
    const d = Math.hypot(w.x - x, w.z - z);
    if (d > 32 || Math.random() > 0.55 || n > 9) continue;
    const a = Math.atan2(w.x - x, w.z - z) + (Math.random() - 0.5) * 0.6, r = 4.5 + Math.random() * 3;
    const r2 = Math.random(), pose = kind === 'fight' && r2 < 0.35 ? { clap: true } : r2 < 0.55 ? { film: true } : r2 < 0.75 ? { point: true } : r2 < 0.88 ? { phone: true } : { cower: false, clutch: true };
    w.mode = 'watch'; w.watch = { x, z, sx: x + Math.sin(a) * r, sz: z + Math.cos(a) * r, t: 14 + Math.random() * 12, pose, lines: WATCH_LINES[kind] || WATCH_LINES.crash };
    if (r2 >= 0.75 && r2 < 0.88 && n === 0) ctx.callIn?.(x, z);
    n++;
  }
}
function startFlee(w, x, z, short) {
  if (!short && Math.random() < 0.4 && w.mode !== 'flee') say(w, line('scream'));
  const was = w.mode;
  w.mode = 'flee'; w.modeT = short ? 2 : 6 + Math.random() * 4; w.fx = x; w.fz = z; w.fleeSp = 0; w.freezeT = 0;
  w.fh = Math.atan2(w.x - x, w.z - z) + (Math.random() - 0.5) * 0.8;
  w.watch = null;
  // panic spreads: people nearby notice the screaming and run a moment later
  if (!short && was !== 'flee') for (const n of walkers) {
    if (n === w || n.dead || n.pending || !CALM.has(n.mode)) continue;
    const d = Math.hypot(n.x - w.x, n.z - w.z);
    if (d < 11) n.pending = { t: reactT(n) + d * 0.06 + Math.random() * 0.3, x, z };
  }
}
const CALM = new Set(['walk', 'link', 'fixed', 'watch', 'enter', 'tocar']);
// take cover behind a parked car (on the far side from the danger), else crouch where you are
function hideFrom(w, x, z) {
  let best = null, bd = 12;
  for (const v of ctx.allVehicles()) {
    if (v.mode !== 'parked' && Math.abs(v.speed || 0) > 1) continue;
    const d = Math.hypot(v.x - w.x, v.z - w.z); if (d > bd) continue;
    const ox = v.x - x, oz = v.z - z, ol = Math.hypot(ox, oz) || 1;
    if (ol < 4) continue;
    bd = d; best = { x: v.x + (ox / ol) * (v.T.wid / 2 + 0.7), z: v.z + (oz / ol) * (v.T.wid / 2 + 0.7) };
  }
  w.mode = 'cower'; w.modeT = 4 + Math.random() * 4; w.fx = x; w.fz = z; w.watch = null;
  w.coverAt = best;
}
function goHostile(w, kind, join = true) {
  w.mode = 'hostile'; w.hostile = kind; w.modeT = 18; w.cd = kind === 'gun' ? 1.2 : 0.6; w.call = null; w.watch = null; w.combo = 0;
  if (kind === 'melee' && w.bat === undefined) w.bat = Math.random() < (w.gang ? 0.12 : 0.07); // few people carry a bat
  if (!join) return;
  // their friends (and the odd hothead nearby) pile in
  for (const n of walkers) {
    if (n === w || n.dead || n.mode === 'hostile' || n.gang !== w.gang) continue;
    const d = Math.hypot(n.x - w.x, n.z - w.z);
    if ((n.grp && n.grp === w.grp) || (w.gang && d < 30) || (n.temper === 'brawler' && d < 14 && Math.random() < 0.35)) {
      n.enemy = w.enemy; setTimeout(() => { if (!n.dead && CALM.has(n.mode)) { say(n, line('fight')); goHostile(n, n.temper === 'gunman' || (w.gang && Math.random() < 0.15) ? 'gun' : 'melee', false); } }, 300 + Math.random() * 900);
    }
  }
}
// Physical hit: dead bodies flop, the living get knocked down and then get up and react.
export function knock(w, vel, dead) {
  const r = ragdoll(w.ch, vel, dead ? { dead: true } : {
    getUp: 1.8 + Math.random(),
    onUp: (p, h) => {
      w.x = p.x; w.z = p.z; w.h = h;
      if (w.dead) return;
      if (w.temper !== 'normal' && Math.random() < 0.8) goHostile(w, w.temper === 'gunman' ? 'gun' : 'melee');
      else startFlee(w, p.x - vel.x, p.z - vel.z);
    },
  });
  return !!r;
}
export function flinch(w) { w.ch.flinch = 1; say(w, line('hurt'), 1.2); }
// The player hurt this person without killing them.
export function provoke(w) {
  if (w.dead) return;
  if (w.temper !== 'normal') say(w, line('fight'));
  if (w.gang) goHostile(w, w.temper === 'gunman' ? 'gun' : 'melee');
  else if (w.temper === 'brawler') goHostile(w, 'melee');
  else if (w.temper === 'gunman') goHostile(w, 'gun');
  else startFlee(w, w.x - Math.sin(w.h), w.z - Math.cos(w.h));
}
// After running off: walk again from the nearest sidewalk.
function calmDown(w) {
  w.pending = null; // whatever scared them before is old news
  const q = W.nearestEdge(w.x, w.z, 40, SIDEWALK);
  if (!q) { w.mode = 'gone'; w.modeT = 3; return; }
  const s = Math.max(2, Math.min(q.e.len - 2, q.s));
  // which side of the road we're on: compare with the right-hand normal of a->b
  const side = (w.x - q.x) * -Math.cos(q.h) + (w.z - q.z) * Math.sin(q.h) >= 0 ? 1 : -1;
  startWalking(w, q.e, s, side, Math.random() < 0.5 ? 1 : -1);
  const P = walkPose(w);
  w.mode = 'link'; w.link = { Q: { x: P.x, z: P.z }, calm: true };
}

// ---------- far-away people: one instanced figure each ----------
let farBody = null, farHead = null;
const tmpO = new THREE.Object3D(), tmpCol = new THREE.Color();
const SHIRTS = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0xffffff, 0x9b59b6, 0xff7f50, 0x1abc9c, 0x222222, 0xf39c12, 0x8aa1b8];
function farMeshes() {
  farBody = new THREE.InstancedMesh(new THREE.BoxGeometry(0.55, 1.5, 0.32).translate(0, 0.75, 0), new THREE.MeshStandardMaterial({ roughness: 0.85 }), 160);
  farHead = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.36, 0.34).translate(0, 1.72, 0), new THREE.MeshStandardMaterial({ roughness: 0.85 }), 160);
  for (const m of [farBody, farHead]) { m.count = 0; m.frustumCulled = false; scene.add(m); }
}
export function initWalkers(s) { scene = s; farMeshes(); }

// ---------- per frame ----------
let spawnT = 0;
const freeModes = new Set(['flee', 'cower', 'hostile', 'gone', 'surrender']);
// cam: {x, z, fx, fz} (position + flat look direction)
export function updateWalkers(dt, tSec, nowMs, cam) {
  const focus = ctx.focus(), q = ctx.quality(), hour = sky.hour ?? 12;
  const night = hour < 6 || hour > 21;
  const want = Math.round((q === 'low' ? 30 : q === 'medium' ? 60 : 80) * (night ? 0.5 : 1));
  const R = q === 'low' ? 150 : 190, nearR = q === 'low' ? 45 : 70;
  if (focus) {
    spawnT -= dt;
    if (spawnT <= 0) {
      spawnT = 0.2;
      if (walkers.length < want) spawnOne(focus, cam, R, hour);
      manageCrowds(focus, hour, 0.2);
      for (const g of [...groups]) if (Math.hypot(g.x - focus.x, g.z - focus.z) > R + 90 && hidden(g.x, g.z, cam)) removeGroup(g);
      for (const w of [...walkers]) {
        if (w.grp || w.mode === 'script') continue;
        const d = Math.hypot(w.x - focus.x, w.z - focus.z);
        if ((d > R + 40 && hidden(w.x, w.z, cam)) || d > R + 160 || (w.mode === 'gone' && w.modeT <= 0) || (w.dead && nowMs - w.dead.t > 90000 && hidden(w.x, w.z, cam))) removeWalker(w);
      }
    }
  }
  const target = ctx.target(), th = ctx.threat();
  farN = 0;
  for (const w of walkers) {
    let speed = 0, pose = {};
    if (w.ch.rag) {
      const p = ragPos(w.ch); w.x = p.x; w.z = p.z; w.y = W.groundHeight(p.x, p.z);
      if (w.dead) { w.dead.x = p.x; w.dead.z = p.z; }
      w.ch.g.visible = true; if (w.dog) w.dog.g.visible = false;
      continue;
    }
    if (w.dead) {
      w.x = w.dead.x; w.z = w.dead.z; w.h = w.dead.h;
    } else if (w.mode === 'script') {
      speed = w.script.speed; pose = w.script.pose;
    } else if (freeModes.has(w.mode)) {
      w.modeT -= dt;
      if (w.mode === 'flee') {
        const fs = w.fleeSp || 6; // fleeSp: a brisk step out of the way rather than a sprint
        const p = W.pushOutCircle(w.x + Math.sin(w.fh) * fs * dt, w.z + Math.cos(w.fh) * fs * dt, 0.4);
        if (Math.hypot(p.x - w.x, p.z - w.z) < fs * dt * 0.5) w.fh += 1.2;
        if (W.isLand(p.x, p.z)) { w.x = p.x; w.z = p.z; } else w.fh += Math.PI;
        w.h = w.fh; speed = fs + 1;
        if (w.modeT <= 0) { if (w.grp) { w.mode = 'gone'; w.modeT = 20; } else calmDown(w); }
      } else if (w.mode === 'cower') {
        if (w.coverAt) {
          const dx = w.coverAt.x - w.x, dz = w.coverAt.z - w.z, d = Math.hypot(dx, dz);
          if (d > 0.4) { const p = W.pushOutCircle(w.x + (dx / d) * 5 * dt, w.z + (dz / d) * 5 * dt, 0.35); w.x = p.x; w.z = p.z; w.h = Math.atan2(dx, dz); speed = 6; w.modeT += dt; if (d > 20) w.coverAt = null; }
          else w.coverAt = null;
        }
        if (!w.coverAt) { w.h += angDiff(w.h, Math.atan2(w.fx - w.x, w.fz - w.z) + Math.PI) * Math.min(1, dt * 5); pose = { cower: true }; }
        if (w.modeT <= 0) startFlee(w, w.fx, w.fz);
      } else if (w.mode === 'hostile') {
        hostileStep(w, dt, target);
        speed = w.spd || 0;
        pose = w.hostile === 'gun' ? { aim: true, weapon: 'gun' } : w.bat ? { weapon: 'bat', swing: w.swing ? 1 - w.swing : 0, aim: true } : { punch: { i: w.combo || 0, t: 1 - (w.swing || 0) }, weapon: 'none' };
        if (w.hostile !== 'gun' && !w.bat && !(w.swing > 0)) pose = { punch: { i: 0, t: 0 }, weapon: 'none' };
        const foe = w.enemy || target;
        if (w.modeT <= 0 || !foe || foe.dead || Math.hypot(foe.x - w.x, foe.z - w.z) > 70) { if (w.gang) { w.mode = 'gone'; w.modeT = 30; calmDown(w); } else startFlee(w, foe ? foe.x : w.x, foe ? foe.z : w.z); }
      } else if (w.mode === 'surrender') {
        if (th) w.h += angDiff(w.h, Math.atan2(th.x - w.x, th.z - w.z)) * Math.min(1, dt * 6);
        if (th && th.aimAt === w) { w.modeT = Math.max(w.modeT, 1.2); w.heldUp = (w.heldUp || 0) + dt; }
        pose = { handsUp: true };
        // held at gunpoint a while: beg on their knees, throw you their wallet, or drop and play dead
        if (w.heldUp > 2.5) {
          if (!w.giveUp) { const r = Math.random(); w.giveUp = r < 0.45 ? 'beg' : r < 0.8 ? 'cash' : 'dead'; say(w, w.giveUp === 'beg' ? pick(["Please don't shoot!", 'I have kids!', 'Please!']) : w.giveUp === 'cash' ? pick(['Take it! Take it!', "Here, it's all I have!"]) : '...'); if (w.giveUp === 'cash') ctx.dropCash?.(w.x + Math.sin(w.h) * 1.2, w.z + Math.cos(w.h) * 1.2, 15 + Math.floor(Math.random() * 60)); }
          pose = w.giveUp === 'beg' ? { beg: true } : w.giveUp === 'dead' ? { playDead: true } : { handsUp: true };
        }
        if (w.modeT <= 0) { if (Math.random() < 0.3) { w.mode = 'cower'; w.modeT = 3; w.fx = th ? th.x : w.x; w.fz = th ? th.z : w.z; } else startFlee(w, th ? th.x : w.x, th ? th.z : w.z); }
      } else if (w.mode === 'gone') {
        w.ch.g.visible = false; if (w.dog) w.dog.g.visible = false;
        continue;
      }
    } else {
      // a car coming straight at you: after your own reaction time, dive clear if it's close or fast,
      // otherwise most just step out of the way and some freeze up for a moment
      if (w.mode !== 'fixed' || w.fixed.pose !== 'sit') {
        let car = null;
        for (const v of ctx.vehicles()) {
          const vs = Math.hypot(v.vx || 0, v.vz || 0);
          if (vs < 6) continue;
          const dx = w.x - v.x, dz = w.z - v.z;
          if (Math.abs(dx) > 22 || Math.abs(dz) > 22) continue;
          const along = (dx * v.vx + dz * v.vz) / vs, lat = (dx * v.vz - dz * v.vx) / vs;
          if (along > 0 && along / vs < 1.8 && Math.abs(lat) < 2.3) { car = { v, vs, lat, tt: along / vs }; break; }
        }
        if (!car) w.carT = 0;
        else if ((w.carT = (w.carT || 0) + dt) > reactT(w)) {
          const { v, vs } = car, side = car.lat >= 0 ? 1 : -1, ax = w.x - (v.vz / vs) * side * 5, az = w.z + (v.vx / vs) * side * 5, r = Math.random();
          w.carT = 0; w.freezeT = 0;
          if (car.tt < 0.7 || vs > 17 || r < 0.2) startFlee(w, ax, az, true);
          else if (r < 0.7 && !w.grp) { startFlee(w, ax, az, true); w.modeT = 0.9; w.fleeSp = 2.6; if (r < 0.35) say(w, pick(['Hey!', 'Whoa!', 'Watch it!'])); }
          else { w.freezeT = 0.5 + Math.random() * 0.7; say(w, 'Whoa!'); }
          if (w.mode === 'flee') continue;
        }
      }
      if (w.freezeT > 0) { // frozen in the road, arms up over the head
        w.freezeT -= dt; w.y = W.groundHeight(w.x, w.z);
        drawWalker(w, cam, 0, { cower: true }, dt, nearR);
        continue;
      }
      // someone nearby started screaming: run (or hide, or trip over your own feet)
      if (w.pending) {
        w.pending.t -= dt;
        w.h += angDiff(w.h, Math.atan2(w.pending.x - w.x, w.pending.z - w.z)) * Math.min(1, dt * 6);
        if (w.pending.t <= 0) {
          const P = w.pending; w.pending = null; const r = Math.random();
          if (r < 0.22) hideFrom(w, P.x, P.z);
          else if (r < 0.28) { startFlee(w, P.x, P.z); knock(w, { x: Math.sin(w.fh) * 2.5, y: 1, z: Math.cos(w.fh) * 2.5 }, false); say(w, 'Whoa!'); }
          else startFlee(w, P.x, P.z);
          continue;
        }
      }
      if (w.mode === 'watch') { // rubbernecking: film it, point, call it in
        const W_ = w.watch; W_.t -= dt;
        const dx = W_.sx - w.x, dz = W_.sz - w.z, d = Math.hypot(dx, dz);
        if (d > 0.3) { const p = W.pushOutCircle(w.x + (dx / d) * 2.2 * dt, w.z + (dz / d) * 2.2 * dt, 0.35); w.x = p.x; w.z = p.z; w.h += angDiff(w.h, Math.atan2(dx, dz)) * Math.min(1, dt * 6); speed = 2.6; }
        else { w.h += angDiff(w.h, Math.atan2(W_.x - w.x, W_.z - w.z)) * Math.min(1, dt * 4); pose = W_.pose; }
        if (Math.random() < dt * 0.15) say(w, pick(W_.lines));
        if (W_.t <= 0) { w.watch = null; calmDown(w); }
        w.y = W.groundHeight(w.x, w.z);
        drawWalker(w, cam, speed, pose, dt, nearR);
        continue;
      }
      if (w.mode === 'enter' || w.mode === 'tocar') { // walking into a shop / over to their parked car
        const T_ = w.goal, dx = T_.x - w.x, dz = T_.z - w.z, d = Math.hypot(dx, dz);
        if (w.mode === 'tocar' && (!T_.v || T_.v.mode !== 'parked')) { w.goal = null; calmDown(w); continue; }
        if (d > 0.35) { w.x += (dx / d) * w.speed * dt; w.z += (dz / d) * w.speed * dt; w.h += angDiff(w.h, Math.atan2(dx, dz)) * Math.min(1, dt * 7); speed = w.speed * 1.45; }
        else if (w.mode === 'enter') { w.mode = 'gone'; w.modeT = 0; }
        else { // at the driver's door: open it, get in, drive away
          T_.v.doorOpen = 1; T_.v.doorCloseAt = performance.now() + 1500;
          if (ctx.driveOff && ctx.driveOff(T_.v)) { w.mode = 'gone'; w.modeT = 0; } else { w.goal = null; calmDown(w); }
        }
        w.y = W.groundHeight(w.x, w.z);
        drawWalker(w, cam, speed, pose, dt, nearR);
        continue;
      }
      // now and then: pop into a shop, or walk over to a parked car and drive off
      if (w.mode === 'walk' && !w.grp && !w.buddyOf && Math.random() < dt * 0.012) {
        const fx = -Math.sin(w.h + Math.PI / 2 * w.side), fz = -Math.cos(w.h + Math.PI / 2 * w.side);
        const t = W.rayBuildings(w.x, (w.y || 0) + 1, w.z, fx, 0, fz, 7);
        if (t < 7) { w.mode = 'enter'; w.goal = { x: w.x + fx * (t - 0.2), z: w.z + fz * (t - 0.2) }; }
        else {
          const car = ctx.allVehicles().find((v) => v.mode === 'parked' && !v.T.bike && !v.T.boat && !v.T.heli && !v.mods && Math.hypot(v.x - w.x, v.z - w.z) < 18);
          if (car) { const lx = Math.cos(car.h), lz = -Math.sin(car.h); w.mode = 'tocar'; w.goal = { v: car, x: car.x + lx * (car.T.wid / 2 + 0.6), z: car.z + lz * (car.T.wid / 2 + 0.6) }; }
        }
      }
      // you: walk into people and they push back; get close and they'll say something about you
      const pl = ctx.player();
      w.bumpCd = (w.bumpCd || 0) - dt; w.commentCd = (w.commentCd || 0) - dt;
      if (pl && !pl.dead) {
        const dx = pl.x - w.x, dz = pl.z - w.z, d = Math.hypot(dx, dz);
        if (!pl.inVeh && d < 0.8 && pl.speed > 1 && w.bumpCd <= 0) {
          w.bumpCd = 3; w.ch.hitT = 0.8; w.ch.hitX = 0; w.ch.hitZ = -1;
          w.h = Math.atan2(dx, dz);
          if (w.temper === 'brawler' && Math.random() < 0.45) { say(w, pick(['Watch it!', 'You wanna go?!', 'Back off!'])); w.shoveT = 0.5; ctx.shove?.(w); if (Math.random() < 0.3) { w.enemy = null; goHostile(w, 'melee'); } }
          else say(w, pick(['Excuse me!', 'Watch it!', 'Hey!', 'Rude!', 'Ow, my foot!']));
        } else if (d < 5.5 && w.commentCd <= 0 && Math.random() < dt * 0.35) { w.commentCd = 25; w.look = angDiff(w.h, Math.atan2(dx, dz)); say(w, commentOn(pl), 2.6); }
      }
      if (w.shoveT > 0) { w.shoveT -= dt; pose = { shove: 1 - w.shoveT / 0.5 }; }
      // a gun in the street
      let look = 0, hurry = 1;
      if (th && !w.call) {
        const d = Math.hypot(th.x - w.x, th.z - w.z);
        if (th.aimAt === w && w.gang) { say(w, line('fight')); goHostile(w, w.temper === 'gunman' ? 'gun' : 'melee'); continue; }
        if (w.gang && th.armed && d < 8) { // flashing a weapon on their block
          w.warnT = (w.warnT || 0) + dt;
          if (w.warnT > 0.5 && !w.warned) { w.warned = true; say(w, warnLine(gangById(w.gang)), 2.6); }
          if (w.warnT > 4.5) { goHostile(w, w.temper === 'gunman' ? 'gun' : 'melee'); continue; }
        } else if (w.gang) w.warnT = Math.max(0, (w.warnT || 0) - dt);
        if (th.aimAt === w) {
          scare(w.x, w.z, 15, 'gunfire'); // bystanders scatter first
          if (w.temper === 'gunman' && Math.random() < 0.7) goHostile(w, 'gun');
          else if (w.temper === 'brawler' && Math.random() < 0.25) goHostile(w, 'melee');
          else { w.mode = 'surrender'; w.modeT = 2.5 + Math.random() * 2; w.panic = 0; w.heldUp = 0; w.giveUp = null; }
          continue;
        }
        if (th.armed && d < 13) {
          w.wary = (w.wary || 0) + dt;
          look = angDiff(w.h, Math.atan2(th.x - w.x, th.z - w.z)); hurry = 1.5;
          if (w.wary > 2.5 && d < 8 && (w.mode === 'fixed' || Math.random() < 0.01)) { startFlee(w, th.x, th.z); w.wary = 0; continue; }
        } else w.wary = Math.max(0, (w.wary || 0) - dt);
      }
      w.look = Math.max(-1.1, Math.min(1.1, look));
      if (w.panic > 0) { w.panic -= dt; hurry = 2.6; }
      if (w.call) pose = { phone: true };
      else if (w.mode === 'walk') {
        w.s += w.speed * hurry * dt * w.dir;
        const k = w.dir > 0 ? w.e.b : w.e.a, end = w.dir > 0 ? w.e.len - nodeTrim(k) : nodeTrim(k);
        if (w.dir > 0 ? w.s >= end : w.s <= end) {
          w.s = end;
          const L = chooseLink(w);
          if (L) { w.mode = 'link'; w.link = L; w.wait = 0; } else w.dir = -w.dir;
        }
        if (w.buddyOf && w.buddyOf.mode === 'walk' && w.buddyOf.e === w.e) { w.s = w.buddyOf.s; w.dir = w.buddyOf.dir; }
        if (w.mode === 'walk') { const p = walkPose(w); w.x = p.x; w.z = p.z; w.h += angDiff(w.h, p.h) * Math.min(1, dt * 8); }
        speed = w.speed * hurry * (w.role === 'jogger' ? 1.3 : 1.45);
        if (w.chatty) pose = { chat: true };
        if (w.texting) pose = { text: true };
        if (w.cane) pose = { cane: true };
        if (w.skate) pose = { skate: true };
      } else if (w.mode === 'link') {
        const L = w.link, dx = L.Q.x - w.x, dz = L.Q.z - w.z, d = Math.hypot(dx, dz);
        if (L.cross && !L.go) { // wait at the kerb for the walk signal or a gap in traffic
          if (canCross(w, L, tSec)) L.go = true;
          else { w.h += angDiff(w.h, Math.atan2(dx, dz)) * Math.min(1, dt * 4); w.wait = (w.wait || 0) + dt; if (w.wait > 45) L.go = true; }
        }
        if (!L.cross || L.go) {
          const sp = w.speed * hurry * (L.cross ? 1.3 : 1);
          if (d < sp * dt + 0.05) {
            if (L.calm) w.mode = 'walk'; else startWalking(w, L.e, L.s, L.side, L.dir);
            w.link = null; w.onRoad = false;
          } else { w.x += (dx / d) * sp * dt; w.z += (dz / d) * sp * dt; w.h += angDiff(w.h, Math.atan2(dx, dz)) * Math.min(1, dt * 8); speed = sp * 1.45; w.onRoad = !!L.cross; }
        }
      } else if (w.mode === 'fixed') {
        const f = w.fixed;
        if (w.mow) { // push the mower back and forth across the lawn
          w.mow.t += dt;
          const u = Math.sin(w.mow.t * 0.25) * 5, dir = Math.cos(w.mow.t * 0.25) > 0 ? 1 : -1;
          w.x = w.mow.x + w.mow.ax * u; w.z = w.mow.z + w.mow.az * u; w.h = Math.atan2(w.mow.ax * dir, w.mow.az * dir); speed = 1.2;
        } else { w.x = f.x; w.z = f.z; w.h += angDiff(w.h, f.h + look) * Math.min(1, dt * 3); }
        pose = { sit: f.pose === 'sit', chat: f.pose === 'chat' || f.pose === 'play', phone: f.pose === 'phone', handsUp: f.pose === 'cheer' && Math.sin(tSec * 2 + w.x) > 0.6,
          lean: f.pose === 'lean', smoke: f.pose === 'lean' || f.pose === 'smoke', drink: f.pose === 'coffee', sweep: f.pose === 'sweep', wash: f.pose === 'wash', stretch: f.pose === 'stretch',
          preach: f.pose === 'preach', sign: f.pose === 'sign', dance: f.pose === 'dance' };
        if (f.pose === 'sweep') { f.t = (f.t || 0) + dt; w.x = f.x + Math.sin(f.h + Math.PI / 2) * Math.sin(f.t * 0.2) * 3; w.z = f.z + Math.cos(f.h + Math.PI / 2) * Math.sin(f.t * 0.2) * 3; speed = 0.6; }
        if (f.lines && Math.random() < dt * 0.12) say(w, pick(f.lines), 2.5);
      }
    }
    w.y = w.floorY ?? W.groundHeight(w.x, w.z); // floorY: bar regulars stand on the bar's floor (venues.js)
    drawWalker(w, cam, speed, pose, dt, nearR);
  }
  farBody.count = farHead.count = farN;
  farBody.instanceMatrix.needsUpdate = farHead.instanceMatrix.needsUpdate = true;
  if (farBody.instanceColor) farBody.instanceColor.needsUpdate = true;
  if (farHead.instanceColor) farHead.instanceColor.needsUpdate = true;
  updateFleeing(dt);
}

let farN = 0;
// one person on screen: full body up close, an instanced stand-in farther away
function drawWalker(w, cam, speed, pose, dt, nearR) {
    // far away: a simple instanced figure instead of the full body
    const dcam = cam ? Math.hypot(w.x - cam.x, w.z - cam.z) : 0;
    const far = dcam > nearR && !w.dead;
    w.ch.g.visible = !far;
    if (w.dog) w.dog.g.visible = !far && !w.dead;
    if (far) {
      if (farN < 160 && dcam < 260) {
        tmpO.position.set(w.x, w.y, w.z); tmpO.rotation.set(0, w.h, 0); tmpO.updateMatrix();
        farBody.setMatrixAt(farN, tmpO.matrix); farHead.setMatrixAt(farN, tmpO.matrix);
        if (!w.farCol) w.farCol = w.role === 'worker' ? 0xff8f00 : w.role === 'office' ? 0xdfe8f2 : pick(SHIRTS);
        farBody.setColorAt(farN, tmpCol.setHex(w.farCol)); farHead.setColorAt(farN, tmpCol.setHex(0xd9a77c));
        farN++;
      }
      return;
    }
    const sitting = w.mode === 'fixed' && w.fixed.pose === 'sit' && !w.dead;
    placeCharacter(w.ch, w.x, w.y + (sitting ? 0.02 : 0), w.z, w.h);
    if (w.limp > 0) w.limp -= dt; if (w.clutch > 0) w.clutch -= dt;
    const anim = { speed, dead: !!w.dead, phone: !!w.call || pose.phone, look: w.mode === 'walk' || w.mode === 'fixed' ? w.look || 0 : 0, limp: w.limp > 0, clutch: w.clutch > 0, ...pose };
    if (w.pose === 'bike' && !w.dead && !freeModes.has(w.mode)) { anim.sit = true; anim.speed = 0; }
    animateCharacter(w.ch, dt, anim);
    if (w.dog && !w.dead) {
      const dg = w.dog, side = 0.8;
      const tx = w.x - Math.sin(w.h) * 1.1 + Math.cos(w.h) * side, tz = w.z - Math.cos(w.h) * 1.1 - Math.sin(w.h) * side;
      const dx = tx - dg.g.position.x, dz = tz - dg.g.position.z, dd = Math.hypot(dx, dz);
      if (dd > 6) dg.g.position.set(tx, 0, tz);
      else { dg.g.position.x += dx * Math.min(1, dt * 6); dg.g.position.z += dz * Math.min(1, dt * 6); }
      dg.g.position.y = W.groundHeight(dg.g.position.x, dg.g.position.z);
      if (dd > 0.05) dg.g.rotation.y = Math.atan2(dx, dz);
      dg.t += dt * (2 + speed * 3);
      dg.legs.forEach((l, i) => { l.rotation.x = Math.sin(dg.t + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * Math.min(0.8, speed * 0.2); });
      dg.tail.rotation.y = Math.sin(dg.t * 3) * 0.5;
    }
  }

// ---------- drivers who got out of their cars ----------
function updateFleeing(dt) {
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
      animateCharacter(f.ch, dt, { speed: spd, punch: f.swing ? { i: 1, t: 1 - f.swing } : undefined });
      if (f.t <= 4) { f.angry = false; f.t = 8; }
      continue;
    }
    const p = W.pushOutCircle(f.x + Math.sin(f.h) * 6 * dt, f.z + Math.cos(f.h) * 6 * dt, 0.4);
    if (Math.hypot(p.x - f.x, p.z - f.z) < 6 * dt * 0.4) f.h += 1.3;
    f.x = p.x; f.z = p.z;
    placeCharacter(f.ch, f.x, W.groundHeight(f.x, f.z), f.z, f.h);
    animateCharacter(f.ch, dt, { speed: spd + 1 });
    if (f.t <= 0) { scene.remove(f.ch.g); disposeCharacter(f.ch); fleeing.splice(i, 1); }
  }
}

// A townsperson who decided to fight: close in and punch, or keep distance and shoot.
function hostileStep(w, dt, t) {
  w.spd = 0;
  if (w.enemy) { if (w.enemy.dead || !walkers.includes(w.enemy)) w.enemy = null; else t = w.enemy; }
  if (!t || t.dead) return;
  const dx = t.x - w.x, dz = t.z - w.z, d = Math.hypot(dx, dz);
  w.h += angDiff(w.h, Math.atan2(dx, dz)) * Math.min(1, dt * 8);
  const move = w.hostile === 'melee' ? (d > 1.3 ? 5.5 : 0) : d > 16 ? 4.5 : d < 7 ? -2 : 0;
  if (move) {
    const p = W.pushOutCircle(w.x + (dx / d) * move * dt, w.z + (dz / d) * move * dt, 0.4);
    if (W.isLand(p.x, p.z)) { w.x = p.x; w.z = p.z; }
    w.spd = Math.abs(move) + 1;
  }
  w.cd -= dt;
  if (w.swing) w.swing = Math.max(0, w.swing - dt * 3);
  if (w.cd > 0) return;
  if (w.hostile === 'melee' && d < 1.6 && !t.inVeh) {
    w.cd = w.bat ? 1.1 : 0.55 + Math.random() * 0.3; w.swing = 1; w.combo = ((w.combo || 0) + 1) % 5;
    const dmg = (w.bat ? 12 : 5) + Math.random() * 5;
    if (t === w.enemy) ctx.hurtNpc?.(t, dmg, dx / d, dz / d, w.bat ? 6 : w.combo === 4 ? 5 : 2.5);
    else ctx.hitPlayer(dmg, 'an angry local', w);
  } else if (w.hostile === 'gun' && d < 35 && W.lineOfSight(w.x, (w.y || 0) + 1.4, w.z, t.x, (t.y || 0) + 1.2, t.z)) {
    w.cd = 1.3 + Math.random() * 0.8;
    const hit = Math.random() < (t.inVeh ? 0.12 : 0.25), ty = (t.y || 0) + 1.2;
    ctx.shot(w, hit ? { x: t.x, y: ty, z: t.z } : { x: t.x + (Math.random() - 0.5) * 4, y: ty, z: t.z + (Math.random() - 0.5) * 4 });
    if (Math.random() < 0.5) scare(w.x, w.z, 28);
    if (hit && t === w.enemy) ctx.hurtNpc?.(t, 12 + Math.random() * 8, dx / d, dz / d, 3);
    else if (hit) ctx.hitPlayer(7 + Math.random() * 4, 'an armed local', w);
  }
}

export function spawnFleeing(x, z, h, down = 0, angry = false) {
  const ch = makeCharacter(randomLook());
  scene.add(ch.g);
  ch.g.position.set(x, W.groundHeight(x, z), z); ch.g.rotation.y = h;
  const f = { ch, x, z, h, t: (angry ? 16 : 8) + down, angry };
  if (!angry && down > 0) ragdoll(ch, { x: Math.sin(h) * 4, y: 2.5, z: Math.cos(h) * 4 }, { getUp: down, onUp: (p, hh) => { f.x = p.x; f.z = p.z; f.h = hh; } });
  fleeing.push(f);
}
// A driver dragged out of (or bailing from) their car (carjack.js): a real townsperson who can be shot or chased.
// fall = an impulse {x, y, z} to throw them to the ground first (they get up after o.down seconds); then they react:
//   'flee' run off · 'fight' come at you with fists · 'gun' pull a gun · 'call' stand there phoning the cops (o.onCall(w))
//   'surrender' hands up and back away (held up at gunpoint), then run
const JACK_LINES = { fight: ['My car!', 'Get out of my car!', "You're dead!", 'Oh, hell no!'], gun: ['Big mistake!', "That's my ride!", 'You picked the wrong car!'],
  call: ['Police? My car just got stolen!', 'Hello, 911? Someone took my car!', "I'm calling the cops!"], flee: ['My car!', 'Take it! Take it!', 'Help!', 'Thief!'], surrender: ["Don't shoot!", "OK, OK! It's yours!", 'Easy! Easy!'] };
export function spawnJacked(x, z, h, react, o = {}) {
  const w = newWalker(o.gang ? 'gang:' + o.gang : o.role || 'walk', x, z, h, null);
  if (o.gang) w.gang = o.gang;
  w.temper = react === 'gun' ? 'gunman' : react === 'fight' ? 'brawler' : 'normal';
  w.texting = false; w.jacked = true;
  w.ch.g.position.set(x, w.y, z); w.ch.g.rotation.set(0, h, 0); w.ch.g.updateMatrixWorld(true); // (a ragdoll starts from the body's matrix)
  w.mode = 'flee'; w.modeT = 99; w.fh = h; w.fleeSp = 0.01; // (held still while on the ground)
  const from = () => { const t = ctx.target(); return t ? { x: t.x, z: t.z } : { x: x - Math.sin(h), z: z - Math.cos(h) }; };
  const go = () => {
    if (w.dead) return;
    const f = from();
    w.fleeSp = 0; w.h = Math.atan2(f.x - w.x, f.z - w.z);
    if (react !== 'call') say(w, pick(JACK_LINES[react] || JACK_LINES.flee), 2.4);
    if (react === 'fight') { w.enemy = null; goHostile(w, 'melee', false); w.modeT = 14; }
    else if (react === 'gun') { w.enemy = null; goHostile(w, 'gun', false); w.modeT = 16; w.cd = 0.5; }
    else if (react === 'call') { calmDown(w); say(w, pick(JACK_LINES.call), 3.5); o.onCall?.(w); }
    else if (react === 'surrender') { w.mode = 'surrender'; w.modeT = 1.6 + Math.random(); w.heldUp = 0; w.giveUp = null; }
    else startFlee(w, f.x, f.z);
  };
  if (o.fall) ragdoll(w.ch, o.fall, { getUp: o.down || 1.4, onUp: (p, hh) => { w.x = p.x; w.z = p.z; w.h = hh; go(); } }) || go();
  else go();
  return w;
}
// a food cart near (x, z), for buying a snack
export function cartNear(x, z, r) { for (const g of groups) if (g.cart && Math.hypot(g.cart.x - x, g.cart.z - z) < r) return g.cart; return null; }
// Paramedics got here in time: back on their feet (and very keen to leave).
export function revive(w) {
  if (!walkers.includes(w)) return false;
  w.dead = null; w.hp = 40;
  if (w.ch.rag) standUp(w.ch); else { w.ch.getUp = w.ch.getUpDur = 1.25; w.ch.getUpFace = false; } // get up off the ground
  if (w.grp) { w.mode = 'gone'; w.modeT = 25; } else calmDown(w);
  return true;
}

// ---------- speech bubbles ----------
const bubbleCache = new Map();
function bubbleTex(text) {
  if (bubbleCache.has(text)) return bubbleCache.get(text);
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,.94)'; g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 4;
  g.beginPath(); g.roundRect(6, 6, 244, 62, 18); g.moveTo(110, 66); g.lineTo(128, 90); g.lineTo(146, 66); g.fill(); g.stroke();
  g.fillStyle = '#111'; g.font = 'bold 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 38, 230);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; bubbleCache.set(text, t);
  return t;
}
// Show a short line over someone's head for a few seconds (only near the player).
export function say(w, text, secs = 2.2) {
  if (!w || !w.ch || w.dead) return;
  const now = performance.now();
  if (w.saidAt && now - w.saidAt < 1500) return;
  w.saidAt = now;
  if (w.bubble) w.ch.g.remove(w.bubble);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTex(text), depthTest: true, transparent: true }));
  s.scale.set(1.9, 0.7, 1); s.position.y = 2.45; w.ch.g.add(s); w.bubble = s;
  setTimeout(() => { if (w.bubble === s) { w.ch.g.remove(s); w.bubble = null; } }, secs * 1000);
}
const LINES = { scream: ['AAAH!', 'Help!', 'Run!', 'Oh no!', 'Somebody help!'], hurt: ['Oof!', 'Ow!', 'Ugh!', 'Hey!'], greet: ['Hi!', 'Hey there!', 'Morning!', "How's it going?", 'Go Hawks!'], insulted: ['Excuse me?!', 'Get lost!', "What's your problem?", 'Rude.', 'Watch it, pal!'], fight: ['You want some?!', "Let's go!", 'Big mistake!'] };
export const line = (k) => pick(LINES[k]);
// what people say when you walk by (your clothes, your car, your rap sheet)
function commentOn(p) {
  if (p.stars >= 2) return pick(["Hey, aren't you the one from the news?!", "That's them! From the TV!", "I'm calling the cops!", 'Oh no. Not you again.']);
  if (p.mask === 'tim') return pick(["Mayor Tim?! Wait...", 'Nice mask. Vote Tim!', "Are you... the mayor?"]);
  if (p.mask) return pick(['Nice mask, creep.', 'Why are you wearing a mask?!', 'Uh... hi?']);
  if (p.armed) return pick(['Put that away!', 'Is that thing real?!', 'Whoa, easy with that!']);
  if (p.inVeh && p.vehSpeed > 14) return pick(['Slow down!', 'Learn to drive!', 'Maniac!', "There's kids around here!"]);
  if (p.inVeh && p.fancy) return pick(['Nice ride!', 'Sweet car!', 'Whoa, look at that car.']);
  if (p.top === 'suit') return pick(['Nice suit.', 'Big meeting today?', 'Fancy!']);
  if (p.top === 'hivis') return pick(['Fix the potholes!', 'When will the road be done?']);
  if (p.top === 'tank') return pick(['Gun show in town?', 'Nice arms.', 'Bit cold for that, no?']);
  return pick(['Hey.', 'Nice day, huh?', 'Love the shoes.', 'Go Hawks!', 'How ya doing?', 'Morning!', 'You lost?', 'Mm-hm.']);
}

// ---------- scripted people (street events drive them directly) ----------
export function addScripted(role, x, z, h, look) {
  const w = newWalker(role, x, z, h, null);
  if (look) { scene.remove(w.ch.g); disposeCharacter(w.ch); w.ch = makeCharacter(look); scene.add(w.ch.g); }
  w.mode = 'script'; w.script = { speed: 0, pose: {} }; w.scripted = true;
  return w;
}
export function dropScripted(w) { if (walkers.includes(w)) removeWalker(w); }
export function freeScripted(w, fromX, fromZ) { if (w.mode === 'script') startFlee(w, fromX, fromZ); }
