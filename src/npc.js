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
import { makeCharacter, randomLook, animateCharacter, placeCharacter, mat, disposeCharacter } from './character.js';
import { ragdoll, release, ragPos } from './ragdoll.js';
import { signalState } from './traffic.js';
import { sky } from './daynight.js';

export const walkers = [];
export const fleeing = [];
let scene, ctx = { target: () => null, hitPlayer() {}, shot() {}, vehicles: () => [], threat: () => null, focus: () => null, quality: () => 'medium' };
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
const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0x5c3a1e];
const HAIR = [0x111111, 0x3b2314, 0x8b4513, 0xd4a017, 0x777777];
function lookFor(role) {
  const hair = Math.random() < 0.5 ? 32 : 0;
  switch (role) {
    case 'office': return [pick(SKIN), pick([0xffffff, 0xdfe8f2, 0xb3c7e6, 0xe8e8e8, 0x8aa1b8]), pick([0x1c1d22, 0x2c3e50, 0x3a3a3a, 0x4a4036]), pick(HAIR), 8 | 64 | hair];
    case 'worker': return [pick(SKIN), pick([0xff8f00, 0xd4e157, 0xff6d00]), pick([0x2c3e50, 0x3e4a57, 0x5d4632]), pick(HAIR), 1 | 64 | (5 << 9)];
    case 'mail': return [pick(SKIN), 0x7d9ec2, 0x1f3a5f, pick(HAIR), 1 | 8 | 64 | (1 << 9)];
    case 'jogger': return [pick(SKIN), pick([0xff4081, 0x00b0ff, 0x76ff03, 0xffffff, 0x212121, 0xffea00]), pick([0x111111, 0x263238, 0x37474f]), pick(HAIR), 4 | 256 | hair | (Math.random() < 0.5 ? 8 : 0)];
    case 'vendor': return [pick(SKIN), 0xfafafa, 0x37474f, pick(HAIR), 1 | 64 | (3 << 9)];
    default: return randomLook();
  }
}

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
const holdProps = {
  bag: (ch) => box(ch.shL, pick([0xffffff, 0xc62828, 0x6d4c41, 0x1565c0]), 0.3, 0.35, 0.12, 0, -0.85, 0.02),
  backpack: (ch) => box(ch.body, pick([0x263238, 0xc62828, 0x1565c0, 0x2e7d32, 0x6a1b9a]), 0.42, 0.45, 0.2, 0, 1.2, -0.26),
  mailbag: (ch) => box(ch.body, 0x5d4037, 0.16, 0.36, 0.4, 0.32, 1.0, 0),
  guitar: (ch) => { const gt = new THREE.Group(); gt.position.set(0, 1.12, 0.22); gt.rotation.z = 0.9; ch.body.add(gt); box(gt, 0x8d5524, 0.42, 0.55, 0.12, 0, -0.1, 0); box(gt, 0x3e2723, 0.08, 0.6, 0.06, 0, 0.45, 0); return gt; },
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
  if (Math.hypot(x - PALMER.x, z - PALMER.z) < 350) add('student', 45);
  if (Math.hypot(x - NORTHPARK.x, z - NORTHPARK.z) < 450) add('shopper', 40);
  if (night) for (const r of m) if (['office', 'mail', 'mower', 'crew', 'cart', 'shopper', 'student'].includes(r[0])) r[1] *= 0.05;
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
  scene.add(ch.g);
  const w = { ch, role, x, z, y: W.groundHeight(x, z), h, hp: 40, dead: null, panic: 0, mode: 'walk', grp,
    temper: Math.random() < 0.18 ? 'brawler' : Math.random() < 0.08 ? 'gunman' : 'normal', speed: 1.15 + Math.random() * 0.5, lat: (Math.random() - 0.5) * 0.9, shirt: ch.shirtColor };
  if (role === 'office') w.speed += 0.2;
  if (role === 'jogger') w.speed = 3 + Math.random() * 0.8;
  if (role === 'cyclist') { w.speed = 4 + Math.random() * 1.5; holdProps.bike(ch); w.pose = 'bike'; }
  if (role === 'shopper' && Math.random() < 0.8) holdProps.bag(ch);
  if (role === 'student') holdProps.backpack(ch);
  if (role === 'mail') holdProps.mailbag(ch);
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
    if (['walk', 'dog', 'office', 'shopper', 'student', 'jogger', 'cyclist', 'mail'].includes(role)) {
      const w = newWalker(role, p.x, p.z, 0, null);
      startWalking(w, q.e, s, side, Math.random() < 0.5 ? 1 : -1);
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
let crowdT = 0;
function manageCrowds(focus, hour, dt) {
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
    if (Math.random() < 0.3) { w.mode = 'cower'; w.modeT = 3 + Math.random() * 3; w.fx = x; w.fz = z; }
    else startFlee(w, x, z);
  }
}
export const panicNear = (x, z, radius) => scare(x, z, radius, 'gunfire');
function startFlee(w, x, z, short) {
  if (!short && Math.random() < 0.4 && w.mode !== 'flee') say(w, line('scream'));
  w.mode = 'flee'; w.modeT = short ? 2 : 6 + Math.random() * 4; w.fx = x; w.fz = z;
  w.fh = Math.atan2(w.x - x, w.z - z) + (Math.random() - 0.5) * 0.8;
}
function goHostile(w, kind) { w.mode = 'hostile'; w.hostile = kind; w.modeT = 18; w.cd = kind === 'gun' ? 1.2 : 0.6; w.call = null; }
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
  if (w.temper === 'brawler') goHostile(w, 'melee');
  else if (w.temper === 'gunman') goHostile(w, 'gun');
  else startFlee(w, w.x - Math.sin(w.h), w.z - Math.cos(w.h));
}
// After running off: walk again from the nearest sidewalk.
function calmDown(w) {
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
  let nf = 0;
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
        const p = W.pushOutCircle(w.x + Math.sin(w.fh) * 6 * dt, w.z + Math.cos(w.fh) * 6 * dt, 0.4);
        if (Math.hypot(p.x - w.x, p.z - w.z) < 6 * dt * 0.5) w.fh += 1.2;
        if (W.isLand(p.x, p.z)) { w.x = p.x; w.z = p.z; } else w.fh += Math.PI;
        w.h = w.fh; speed = 7;
        if (w.modeT <= 0) { if (w.grp) { w.mode = 'gone'; w.modeT = 20; } else calmDown(w); }
      } else if (w.mode === 'cower') {
        w.h += angDiff(w.h, Math.atan2(w.fx - w.x, w.fz - w.z) + Math.PI) * Math.min(1, dt * 5);
        pose = { cower: true };
        if (w.modeT <= 0) startFlee(w, w.fx, w.fz);
      } else if (w.mode === 'hostile') {
        hostileStep(w, dt, target);
        speed = w.spd || 0;
        pose = { aim: w.hostile === 'gun', weapon: w.hostile === 'gun' ? 'gun' : 'none', swing: w.swing || 0 };
        if (w.modeT <= 0 || !target || target.dead || Math.hypot(target.x - w.x, target.z - w.z) > 70) startFlee(w, target ? target.x : w.x, target ? target.z : w.z);
      } else if (w.mode === 'surrender') {
        if (th) w.h += angDiff(w.h, Math.atan2(th.x - w.x, th.z - w.z)) * Math.min(1, dt * 6);
        if (th && th.aimAt === w) w.modeT = Math.max(w.modeT, 1.2);
        pose = { handsUp: true };
        if (w.modeT <= 0) { if (Math.random() < 0.3) { w.mode = 'cower'; w.modeT = 3; w.fx = th ? th.x : w.x; w.fz = th ? th.z : w.z; } else startFlee(w, th ? th.x : w.x, th ? th.z : w.z); }
      } else if (w.mode === 'gone') {
        w.ch.g.visible = false; if (w.dog) w.dog.g.visible = false;
        continue;
      }
    } else {
      // jump out of the way of a car coming straight at you
      if (w.mode !== 'fixed' || w.fixed.pose !== 'sit') {
        let dodged = false;
        for (const v of ctx.vehicles()) {
          const vs = Math.hypot(v.vx || 0, v.vz || 0);
          if (vs < 6) continue;
          const dx = w.x - v.x, dz = w.z - v.z;
          if (Math.abs(dx) > 14 || Math.abs(dz) > 14) continue;
          const along = (dx * v.vx + dz * v.vz) / vs, lat = (dx * v.vz - dz * v.vx) / vs;
          if (along > 0 && along / vs < 1.4 && Math.abs(lat) < 2.2) { const side = lat >= 0 ? 1 : -1; startFlee(w, w.x - (v.vz / vs) * side * 5, w.z + (v.vx / vs) * side * 5, true); dodged = true; break; }
        }
        if (dodged) continue;
      }
      // a gun in the street
      let look = 0, hurry = 1;
      if (th && !w.call) {
        const d = Math.hypot(th.x - w.x, th.z - w.z);
        if (th.aimAt === w) {
          scare(w.x, w.z, 15, 'gunfire'); // bystanders scatter first
          if (w.temper === 'gunman' && Math.random() < 0.7) goHostile(w, 'gun');
          else if (w.temper === 'brawler' && Math.random() < 0.25) goHostile(w, 'melee');
          else { w.mode = 'surrender'; w.modeT = 2.5 + Math.random() * 2; w.panic = 0; }
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
        if (w.mode === 'walk') { const p = walkPose(w); w.x = p.x; w.z = p.z; w.h += angDiff(w.h, p.h) * Math.min(1, dt * 8); }
        speed = w.speed * hurry * (w.role === 'jogger' ? 1.3 : 1.45);
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
        pose = { sit: f.pose === 'sit', chat: f.pose === 'chat' || f.pose === 'play', phone: f.pose === 'phone', handsUp: f.pose === 'cheer' && Math.sin(tSec * 2 + w.x) > 0.6 };
      }
    }
    w.y = W.groundHeight(w.x, w.z);
    // far away: a simple instanced figure instead of the full body
    const dcam = cam ? Math.hypot(w.x - cam.x, w.z - cam.z) : 0;
    const far = dcam > nearR && !w.dead;
    w.ch.g.visible = !far;
    if (w.dog) w.dog.g.visible = !far && !w.dead;
    if (far) {
      if (nf < 160 && dcam < 260) {
        tmpO.position.set(w.x, w.y, w.z); tmpO.rotation.set(0, w.h, 0); tmpO.updateMatrix();
        farBody.setMatrixAt(nf, tmpO.matrix); farHead.setMatrixAt(nf, tmpO.matrix);
        if (!w.farCol) w.farCol = w.role === 'worker' ? 0xff8f00 : w.role === 'office' ? 0xdfe8f2 : pick(SHIRTS);
        farBody.setColorAt(nf, tmpCol.setHex(w.farCol)); farHead.setColorAt(nf, tmpCol.setHex(0xd9a77c));
        nf++;
      }
      continue;
    }
    const sitting = w.mode === 'fixed' && w.fixed.pose === 'sit' && !w.dead;
    placeCharacter(w.ch, w.x, w.y + (sitting ? -0.35 : 0), w.z, w.h);
    const anim = { speed, dead: !!w.dead, phone: !!w.call || pose.phone, look: w.mode === 'walk' || w.mode === 'fixed' ? w.look || 0 : 0, ...pose };
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
  farBody.count = farHead.count = nf;
  farBody.instanceMatrix.needsUpdate = farHead.instanceMatrix.needsUpdate = true;
  if (farBody.instanceColor) farBody.instanceColor.needsUpdate = true;
  if (farHead.instanceColor) farHead.instanceColor.needsUpdate = true;
  updateFleeing(dt);
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
      animateCharacter(f.ch, dt, { speed: spd, swing: f.swing });
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
  const f = { ch, x, z, h, t: (angry ? 16 : 8) + down, angry };
  if (!angry && down > 0) ragdoll(ch, { x: Math.sin(h) * 4, y: 2.5, z: Math.cos(h) * 4 }, { getUp: down, onUp: (p, hh) => { f.x = p.x; f.z = p.z; f.h = hh; } });
  fleeing.push(f);
}
// a food cart near (x, z), for buying a snack
export function cartNear(x, z, r) { for (const g of groups) if (g.cart && Math.hypot(g.cart.x - x, g.cart.z - z) < r) return g.cart; return null; }
// Paramedics got here in time: back on their feet (and very keen to leave).
export function revive(w) {
  if (!walkers.includes(w)) return false;
  w.dead = null; w.hp = 40;
  release(w.ch); w.ch.getUp = 0.9;
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

// ---------- scripted people (street events drive them directly) ----------
export function addScripted(role, x, z, h, look) {
  const w = newWalker(role, x, z, h, null);
  if (look) { scene.remove(w.ch.g); disposeCharacter(w.ch); w.ch = makeCharacter(look); scene.add(w.ch.g); }
  w.mode = 'script'; w.script = { speed: 0, pose: {} }; w.scripted = true;
  return w;
}
export function dropScripted(w) { if (walkers.includes(w)) removeWalker(w); }
export function freeScripted(w, fromX, fromZ) { if (w.mode === 'script') startFlee(w, fromX, fromZ); }
