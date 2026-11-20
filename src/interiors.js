// Walk-in stores: corner stores and gas stations (rob the clerk), Arnett Arms (the gun counter) and Tim's Threads
// are real buildings on their own lot by the street (economy.js plans the lot, city/data.js clears it). Each is
// built while you're near and removed when you're far; you just walk in through the door.
// Bars (kind 'bar', on real OSM bar / pub spots) use the same lots; venues.js runs their drinks, games and regulars.
// The Arnett Belle casino floor is a room built out of sight under the riverboat when you press E at the gangway.
// Inside, the police can't see you (they wait outside and search), so hiding in a shop sheds stars.
import * as THREE from 'three';
import * as W from './world.js';
import { addBoxes, removeBoxes, makeBox } from './city/collide.js';
import { makeCharacter, randomLook, animateCharacter, placeCharacter, mat, disposeCharacter } from './character.js';
import { textTexture } from './util.js';
import { stores } from './economy.js';

const DEPTH = 400; // the casino room sits this far under the street
const NEAR = 130, FAR = 170; // storefronts are built within NEAR m of you and removed past FAR
let scene = null, light = null;
export let room = null; // the room you're in: {kind, store, group, x, y, z, w, d, cs, sn, clerk, people, exit, counter, under}
const built = new Set(); // storefronts standing right now
export function initInteriors(s) {
  scene = s;
  // one shop light, always in the scene and moved to the shop you're at (adding a light later recompiles every material)
  light = new THREE.PointLight(0xfff4e0, 0, 40, 1.6); scene.add(light);
}

const box = (g, c, sx, sy, sz, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m || mat(c)); b.position.set(x, y, z); b.castShadow = false; b.receiveShadow = true; g.add(b); return b; };
const sign = (g, text, w, h, x, y, z, ry, bg, fg) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: textTexture(text, { w: 512, h: Math.round((512 * h) / w), bg, fg, size: 56 }) })); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m; };
const SIZES = { casino: [40, 30] };
// shared materials (cached so building and removing shops doesn't leak them)
const basics = new Map(), basic = (c) => basics.get(c) || basics.set(c, new THREE.MeshBasicMaterial({ color: c })).get(c);
const GLASS = new THREE.MeshStandardMaterial({ color: 0x9fc6d8, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.6, depthWrite: false });
const COOLER = new THREE.MeshStandardMaterial({ color: 0x81d4fa, transparent: true, opacity: 0.4, emissive: 0x29b6f6, emissiveIntensity: 0.4 });
const MIRROR = new THREE.MeshStandardMaterial({ color: 0xcfe8ff, roughness: 0.02, metalness: 0.9 });
const ROB_TEX = textTexture('$', { w: 128, h: 128, bg: '#2fbf4a', fg: '#ffffff', size: 100, border: '#ffffff' });
// outside: facade, awning, sign colours
const LOOK = { rob: [0xd8cfc0, 0xc62828, '#c62828'], guns: [0x6d5f52, 0x212121, '#b71c1c'], clothes: [0xeae2ec, 0xad1457, '#ad1457'], bar: [0x5a3a2a, 0x1b3d1f, '#14110f'] };
// Bar and casino props shared by every build (userData.keep: drop() leaves them alone), made on first use.
let S = null;
const keep = (x) => { x.userData.keep = true; return x; };
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return keep(t); }
function shared() {
  if (S) return S;
  const carpet = canvasTex(128, 128, (x) => {
    x.fillStyle = '#5a0f22'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#c9a23a'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(64, 10); x.lineTo(118, 64); x.lineTo(64, 118); x.lineTo(10, 64); x.closePath(); x.stroke();
    x.fillStyle = '#1d2f5c'; x.beginPath(); x.arc(64, 64, 15, 0, 7); x.fill(); x.fillStyle = '#c9a23a';
    for (const [a, b] of [[0, 0], [128, 0], [0, 128], [128, 128]]) { x.beginPath(); x.arc(a, b, 11, 0, 7); x.fill(); }
  });
  carpet.wrapS = carpet.wrapT = THREE.RepeatWrapping; carpet.repeat.set(10, 7.5);
  const sectors = (x, n, cols, r0, r1) => { for (let i = 0; i < n; i++) { x.fillStyle = cols(i); x.beginPath(); x.moveTo(64, 64); x.arc(64, 64, r1, (i / n) * 6.283, ((i + 1) / n) * 6.283); x.fill(); } if (r0) { x.fillStyle = '#c9a23a'; x.beginPath(); x.arc(64, 64, r0, 0, 7); x.fill(); } };
  const board = canvasTex(128, 128, (x) => {
    x.fillStyle = '#111'; x.fillRect(0, 0, 128, 128);
    sectors(x, 20, (i) => (i % 2 ? '#c62828' : '#2e7d32'), 0, 60); sectors(x, 20, (i) => (i % 2 ? '#111' : '#f3e5c0'), 0, 54);
    sectors(x, 20, (i) => (i % 2 ? '#c62828' : '#2e7d32'), 0, 36); sectors(x, 20, (i) => (i % 2 ? '#111' : '#f3e5c0'), 0, 31);
    x.fillStyle = '#2e7d32'; x.beginPath(); x.arc(64, 64, 7, 0, 7); x.fill(); x.fillStyle = '#c62828'; x.beginPath(); x.arc(64, 64, 3.5, 0, 7); x.fill();
  });
  const wheel = canvasTex(128, 128, (x) => { x.clearRect(0, 0, 128, 128); sectors(x, 37, (i) => (i === 0 ? '#1b8a3a' : i % 2 ? '#b71c1c' : '#111'), 0, 63); x.fillStyle = '#4e2c1a'; x.beginPath(); x.arc(64, 64, 40, 0, 7); x.fill(); sectors(x, 8, () => '#c9a23a', 10, 0); });
  const std = (o) => keep(new THREE.MeshStandardMaterial(o));
  S = {
    carpet: std({ map: carpet, roughness: 1 }), felt: std({ color: 0x1f6b35, roughness: 1 }), gold: std({ color: 0xd4af37, metalness: 0.8, roughness: 0.3, emissive: 0x3a2a00 }),
    wood: std({ color: 0x3e2418, roughness: 0.6 }), red: std({ color: 0x8e1b2b, roughness: 0.8 }), slot: std({ color: 0x2a1450, metalness: 0.4, roughness: 0.4 }), chrome: std({ color: 0xcfd8dc, metalness: 0.9, roughness: 0.2 }),
    board: keep(new THREE.MeshBasicMaterial({ map: board })), wheel: keep(new THREE.MeshBasicMaterial({ map: wheel, transparent: true })), glow: keep(new THREE.MeshBasicMaterial({ color: 0xffffff })),
    ring: keep(new THREE.TorusGeometry(1.1, 0.07, 6, 24)), bulb: keep(new THREE.SphereGeometry(0.11, 8, 6)), crystal: keep(new THREE.OctahedronGeometry(0.35)), ball: keep(new THREE.SphereGeometry(0.045, 8, 6)),
    cab: keep(new THREE.BoxGeometry(1, 1.9, 0.9)), screen: keep(new THREE.PlaneGeometry(0.7, 0.6)), topper: keep(new THREE.BoxGeometry(0.9, 0.25, 0.8)), seat: keep(new THREE.CylinderGeometry(0.22, 0.2, 0.08, 10)), pole: keep(new THREE.CylinderGeometry(0.04, 0.04, 0.72, 6)),
    bottle: keep(new THREE.CylinderGeometry(0.05, 0.06, 0.3, 6)), half: keep(new THREE.CylinderGeometry(1.7, 1.7, 0.1, 20, 1, false, Math.PI / 2, Math.PI)), halfBase: keep(new THREE.CylinderGeometry(1.5, 1.5, 0.8, 20, 1, false, Math.PI / 2, Math.PI)),
    disc: keep(new THREE.CircleGeometry(1, 32)),
  };
  return S;
}
// many copies of one shape in one draw call: at = [[lx, ly, lz, rotY, colour?], ...]
function inst(g, geo, m, at) {
  const im = new THREE.InstancedMesh(geo, m, at.length), o = new THREE.Object3D(), c = new THREE.Color();
  at.forEach(([x, y, z, ry = 0, col], i) => { o.position.set(x, y, z); o.rotation.set(0, ry, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); if (col !== undefined) im.setColorAt(i, c.setHex(col)); });
  im.receiveShadow = true; g.add(im); return im;
}
// a glowing neon sign (cached per text, shared by every bar)
const neonTex = new Map();
function neon(g, text, col, w, x, y, z, ry) {
  let m = neonTex.get(text + col);
  if (!m) {
    const t = canvasTex(512, 160, (c) => { c.font = 'italic 700 92px "Brush Script MT", "Segoe Script", cursive'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = col; c.shadowBlur = 22; c.fillStyle = col; c.fillText(text, 256, 82, 490); c.shadowBlur = 6; c.fillStyle = '#fff8'; c.fillText(text, 256, 82, 490); });
    neonTex.set(text + col, (m = keep(new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }))));
  }
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.31), m); p.position.set(x, y, z); p.rotation.y = ry; g.add(p); return p;
}
const NEONS = [['Cold Beer', '#ff4f9a'], ['Hawks', '#ffd23f'], ['Busch-ish Light', '#3fc8ff'], ['Pabst Blue Ripoff', '#4f8bff'], ['Miller Time-ish', '#ffcf3f'], ['Live Bait', '#7dff6a'], ['Cocktails', '#ff6ae0'], ['Karaoke Tues', '#b388ff']];

// Build a store's room at (x, y, z) turned by rot (local -z is the door side). under: the casino's hidden room.
// bare: furniture and people only (a landmark hall: the shell is modelled in the landmark's GLB).
function buildRoom(store, x, y, z, rot, under, bare) {
  const kind = store.kind, [w, d] = store.w ? [store.w, store.d] : SIZES[kind];
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; scene.add(g);
  const cs = Math.cos(rot), sn = Math.sin(rot), wx = (lx, lz) => x + lx * cs + lz * sn, wz = (lx, lz) => z - lx * sn + lz * cs;
  const boxes = [];
  // a collision box given in room coordinates
  const cb = (lx, lz, ux, uz, hu, hv, h) => boxes.push(makeBox(wx(lx, lz), wz(lx, lz), ux * cs + uz * sn, -ux * sn + uz * cs, hu, hv, y - 1, h));
  const wall = (cx, cz, ux, uz, len) => cb(cx, cz, ux, uz, 0.4, len / 2, 6);
  // shell: floor, ceiling, four walls (the door is on the -z wall)
  if (!bare) {
  const floorCol = kind === 'bar' ? 0x3b2619 : kind === 'guns' ? 0x5d5348 : 0x9c958a;
  box(g, floorCol, w, 0.2, d, 0, -0.1, 0, kind === 'casino' ? shared().carpet : null); box(g, kind === 'casino' ? 0x2a0f18 : kind === 'bar' ? 0x22170f : 0xb9b8b2, w, 0.2, d, 0, 4.2, 0);
  const wallCol = kind === 'casino' ? 0x3b1222 : kind === 'bar' ? 0x5a3626 : kind === 'guns' ? 0x7a6f63 : kind === 'clothes' ? 0xc9b8cc : 0xc7c1b4;
  box(g, wallCol, w, 4.2, 0.3, 0, 2.1, d / 2); box(g, wallCol, 0.3, 4.2, d, w / 2, 2.1, 0); box(g, wallCol, 0.3, 4.2, d, -w / 2, 2.1, 0);
  wall(0, d / 2 + 0.4, 0, -1, w); wall(w / 2 + 0.4, 0, -1, 0, d); wall(-w / 2 - 0.4, 0, 1, 0, d);
  if (under) {
    box(g, wallCol, w, 4.2, 0.3, 0, 2.1, -d / 2); wall(0, -d / 2 - 0.4, 0, 1, w);
    box(g, 0x37474f, 2, 2.4, 0.1, 0, 1.2, -d / 2 + 0.2); // the door you came in by
    sign(g, 'EXIT', 1, 0.3, 0, 2.7, -d / 2 + 0.2, 0, '#2e7d32', '#ffffff');
  } else {
    // shop front: glass either side of an open doorway, a header with the sign, outer walls, roof and a foundation
    const [ext, awn, signBg] = LOOK[kind], L = w / 2 - 1.1;
    for (const side of [-1, 1]) {
      const cx = side * (1.1 + L / 2);
      box(g, wallCol, L, 0.6, 0.3, cx, 0.3, -d / 2); box(g, 0, L, 2, 0.08, cx, 1.6, -d / 2, GLASS); box(g, wallCol, L, 1.6, 0.3, cx, 3.4, -d / 2);
      box(g, 0x37474f, 0.14, 2.6, 0.34, side * 1.1, 1.3, -d / 2); // door frame
      cb(cx, -d / 2 - 0.15, 0, 1, 0.3, L / 2, 6); // thinner than the others so the glass isn't fenced off outside
      box(g, ext, 0.6, 4.8, 0.4, side * (w / 2 + 0.3), 2.4, -d / 2 - 0.05); // corner pillar
    }
    box(g, wallCol, 2.2, 1.6, 0.3, 0, 3.4, -d / 2);
    // outer walls sit just inside the collision boxes (which run 0.8 m out from the inner walls)
    box(g, ext, w + 1.3, 2, 0.1, 0, 3.6, -d / 2 - 0.2); box(g, ext, w + 1.3, 4.8, 0.1, 0, 2.4, d / 2 + 0.6);
    box(g, ext, 0.1, 4.8, d + 1.2, w / 2 + 0.6, 2.4, 0.3); box(g, ext, 0.1, 4.8, d + 1.2, -w / 2 - 0.6, 2.4, 0.3);
    box(g, 0x4a4a4a, w + 1.6, 0.25, d + 1.6, 0, 4.85, 0.2); box(g, 0x8d8a84, w + 1.3, 3, d + 1.3, 0, -1.6, 0.2);
    box(g, awn, 3.2, 0.12, 1.3, 0, 2.75, -d / 2 - 0.85); // awning over the door
    sign(g, store.name.toUpperCase(), Math.min(w - 2, 9), 1.1, 0, 3.65, -d / 2 - 0.3, Math.PI, signBg, '#ffffff');
    if (kind === 'rob') { const t = new THREE.Sprite(new THREE.SpriteMaterial({ map: ROB_TEX, transparent: true, opacity: 0.9 })); t.scale.set(1.1, 1.1, 1); t.position.set(0, 5.8, -d / 2); g.add(t); store.tag = t; } // faded while the till is empty (economy.js)
  }
  }
  // ceiling lights (bars hang dim pendants, the casino chandeliers)
  if (kind !== 'bar' && kind !== 'casino') for (let i = -1; i <= 1; i++) box(g, 0, w * 0.25, 0.08, 0.5, i * w * 0.3, 4.05, 0, basic(0xfffbe8));
  // spots: where E does something (venues.js); seats: where the bar's regulars sit or stand (venues.js spawns them)
  const spots = [], seats = [], spot = (lx, lz, r, act) => spots.push({ x: wx(lx, lz), z: wz(lx, lz), r, act }), seat = (lx, lz, h, pose) => seats.push({ x: wx(lx, lz), z: wz(lx, lz), h: rot + h, pose });
  let spin = null;
  const people = [], person = (look, px, pz, h, pose) => { const ch = makeCharacter(look); g.add(ch.g); placeCharacter(ch, px, 0, pz, h); const p = { ch, x: wx(px, pz), z: wz(px, pz), lx: px, lz: pz, h, pose, y }; people.push(p); return p; };
  let clerk = null, counter = null;
  if (kind === 'rob' || kind === 'guns' || kind === 'clothes') {
    // counter across the back with the clerk behind it
    box(g, kind === 'guns' ? 0x4e342e : 0x8d6e63, w * 0.45, 1.05, 0.8, w * 0.18, 0.52, d / 2 - 2.6);
    box(g, 0x212121, 0.5, 0.35, 0.4, w * 0.22, 1.22, d / 2 - 2.6); // register
    cb(w * 0.18, d / 2 - 2.6, 0, 1, 0.45, w * 0.23, 2.1);
    clerk = person([0xe0ac69, kind === 'guns' ? 0x4e342e : kind === 'clothes' ? 0xad1457 : 0xc62828, 0x263238, 0x3b2314, 8 | 64], w * 0.18, d / 2 - 1.7, Math.PI, 'stand');
    counter = { x: wx(w * 0.18, d / 2 - 3.4), z: wz(w * 0.18, d / 2 - 3.4) };
  }
  if (kind === 'rob') {
    // shelves of snacks, a drinks cooler down the side
    for (let r = 0; r < 3; r++) {
      const sx = -w / 2 + 3 + r * 2.6;
      box(g, 0xcfd8dc, 0.8, 1.7, d * 0.5, sx, 0.85, -0.5);
      for (let k = 0; k < 6; k++) box(g, [0xe53935, 0xffb300, 0x43a047, 0x1e88e5, 0x8e24aa, 0xff7043][(k + r) % 6], 0.82, 0.22, d * 0.5 / 6 - 0.1, sx, 0.4 + (k % 3) * 0.5, -0.5 - d * 0.25 + (k + 0.5) * (d * 0.5 / 6));
      cb(sx, -0.5, 1, 0, 0.45, d * 0.25, 3);
    }
    box(g, 0xb0bec5, 0.8, 2.2, d * 0.7, w / 2 - 0.6, 1.1, -0.5); box(g, 0x81d4fa, 0.05, 1.8, d * 0.68, w / 2 - 1.01, 1.2, -0.5, COOLER);
    sign(g, store.name.toUpperCase(), 6, 0.8, w * 0.18, 3.3, d / 2 - 0.2, Math.PI, '#c62828', '#ffffff');
    for (let i = 0; i < 1 + Math.floor(Math.random() * 2); i++) person(randomLook(), -w / 2 + 4.3 + i * 2.6, -1 + Math.random() * 2, Math.random() * 6, 'browse');
  } else if (kind === 'guns') {
    // the gun wall
    for (let i = 0; i < 9; i++) { box(g, 0x212121, 1.1, 0.14, 0.12, -w / 2 + 2 + i * 1.5, 2 + (i % 3) * 0.5, d / 2 - 0.3); box(g, 0x3e2723, 0.18, 0.2, 0.12, -w / 2 + 1.6 + i * 1.5, 1.92 + (i % 3) * 0.5, d / 2 - 0.3); }
    box(g, 0x6d4c41, w * 0.3, 1, 0.8, -w * 0.25, 0.5, -1); cb(-w * 0.25, -1, 0, 1, 0.45, w * 0.15, 2);
    for (let i = 0; i < 4; i++) box(g, 0x8bc34a, 0.3, 0.3, 0.5, -w * 0.25 - 1.5 + i, 1.15, -1); // ammo boxes
    sign(g, 'ARNETT ARMS', 6, 0.9, 0, 3.4, d / 2 - 0.2, Math.PI, '#b71c1c', '#ffffff');
  } else if (kind === 'clothes') {
    for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) box(g, [0xe53935, 0x1e88e5, 0xfdd835, 0x43a047, 0x212121, 0xffffff, 0x8e24aa][(r + k) % 7], 0.3, 0.9, 0.5, -w / 2 + 3 + r * 3, 1.3, -d / 2 + 3 + k * 0.6);
    for (let r = 0; r < 4; r++) { box(g, 0x9e9e9e, 0.05, 0.05, 4, -w / 2 + 3 + r * 3, 1.85, -d / 2 + 4.5); cb(-w / 2 + 3 + r * 3, -d / 2 + 4.5, 1, 0, 0.3, 2, 2); }
    box(g, 0xb0bec5, 1.4, 2.4, 0.05, w / 2 - 0.3, 1.3, 1, MIRROR); // mirror
    sign(g, store.name.toUpperCase(), 7, 0.9, 0, 3.4, d / 2 - 0.2, Math.PI, '#ad1457', '#ffffff');
    person(randomLook(), -w / 2 + 4.5, -d / 2 + 5, 1, 'browse');
  } else if (kind === 'bar') {
    const sh = shared(), W2 = w / 2, D2 = d / 2, bx = W2 - 2.6;
    // the bar: a long counter down the right side, bottles on the back bar, the bartender between them
    box(g, 0, 0.8, 1.05, 8, bx, 0.52, 1, sh.wood); box(g, 0x1c110b, 1.1, 0.08, 8.2, bx, 1.08, 1); box(g, 0, 0.06, 0.06, 8, bx - 0.5, 0.25, 1, sh.gold); // counter, top, brass foot rail
    for (let i = 0; i < 3; i++) box(g, 0, 0.08, 0.45, 0.08, bx + 0.1, 1.33, -1 + i * 0.25, sh.chrome); // beer taps
    cb(bx, 1, 1, 0, 0.55, 4.1, 2.1);
    box(g, 0x2a1a12, 0.5, 2.6, 8, W2 - 0.3, 1.3, 1); cb(W2 - 0.3, 1, 1, 0, 0.3, 4, 3);
    const bottles = [];
    for (let k = 0; k < 3; k++) { box(g, 0x5d4037, 0.55, 0.05, 8, W2 - 0.35, 1.15 + k * 0.55, 1); for (let i = 0; i < 16; i++) bottles.push([W2 - 0.4, 1.33 + k * 0.55, -2.7 + i * 0.49, 0, [0x2e7d32, 0x8d5524, 0xd7ccc8, 0x1565c0, 0xb71c1c, 0xffb300][(i * 7 + k) % 6]]); }
    inst(g, sh.bottle, sh.glow, bottles);
    sign(g, store.name.toUpperCase(), 5, 0.75, W2 - 0.17, 3.3, 1, -Math.PI / 2, '#14110f', '#ffb74d');
    clerk = person([0xc68642, 0x212121, 0x263238, 0x1b1b1b, 8 | 64], W2 - 1.4, 1, -Math.PI / 2, 'stand');
    counter = { x: wx(bx - 1, 1), z: wz(bx - 1, 1) };
    spot(bx - 1, 1, 1.7, 'drinks');
    // stools, with regulars standing at them
    const stoolZ = [-2.4, -1.2, 3.2, 4.4];
    inst(g, sh.seat, sh.red, stoolZ.map((z) => [bx - 0.85, 0.76, z])); inst(g, sh.pole, sh.chrome, stoolZ.map((z) => [bx - 0.85, 0.36, z]));
    for (const z of stoolZ) seat(bx - 1.2, z, Math.PI / 2, 'coffee');
    // two booths along the left wall
    for (const zc of [-2.2, 2.6]) {
      box(g, 0x4a2a1c, 1.0, 0.06, 0.9, -W2 + 1.3, 0.75, zc); box(g, 0x222222, 0.12, 0.72, 0.12, -W2 + 1.3, 0.37, zc);
      for (const sd of [-1, 1]) { box(g, 0, 1.8, 0.45, 0.6, -W2 + 1.0, 0.22, zc + sd * 1.0, sh.red); box(g, 0, 1.8, 1.2, 0.15, -W2 + 1.0, 0.75, zc + sd * 1.35, sh.red); }
      cb(-W2 + 1.1, zc, 1, 0, 1.0, 1.45, 1.4);
      seat(-W2 + 1.2, zc - 1.0, 0, 'sit'); seat(-W2 + 1.2, zc + 1.0, Math.PI, 'sit');
      box(g, 0, 0.3, 0.25, 0.3, -W2 + 1.3, 3.75, zc, basic(0xffb060)); // pendant
    }
    // pool table under its lamp
    const px = -1.8, pz = 1.2;
    box(g, 0, 1.45, 0.16, 2.6, px, 0.76, pz, sh.wood); box(g, 0, 1.2, 0.04, 2.3, px, 0.85, pz, sh.felt);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, 0, 0.14, 0.7, 0.14, px + a * 0.6, 0.35, pz + b * 1.15, sh.wood);
    inst(g, sh.ball, sh.glow, [0xffffff, 0xffd600, 0x1565c0, 0xc62828, 0x6a1b9a, 0xff6d00, 0x2e7d32, 0x111111].map((c, i) => [px - 0.3 + (i % 3) * 0.2, 0.92, pz - 0.6 + Math.floor(i / 3) * 0.45 + (i ? 0.5 : -0.3), 0, c]));
    box(g, 0x2e5d32, 1.1, 0.15, 0.4, px, 3.2, pz); box(g, 0, 1.0, 0.03, 0.34, px, 3.12, pz, basic(0xffcf80));
    cb(px, pz, 1, 0, 0.75, 1.3, 1);
    spot(px, pz, 2.2, 'pool');
    seat(px + 1.7, pz + 1.9, -2.4, 'chat'); seat(px - 1.6, pz - 2.1, 0.6, 'chat');
    // dartboard on the back wall with the throw line on the floor
    const dart = new THREE.Mesh(sh.disc, sh.board); dart.scale.setScalar(0.24); dart.position.set(-4.2, 1.73, D2 - 0.12); dart.rotation.y = Math.PI; g.add(dart);
    box(g, 0x1c110b, 0.75, 0.75, 0.06, -4.2, 1.73, D2 - 0.07); box(g, 0, 0.8, 0.01, 0.05, -4.2, 0.01, D2 - 2.37, basic(0xeeeeee));
    spot(-4.2, D2 - 2.6, 1.5, 'darts');
    seat(-2.6, D2 - 1.2, Math.PI + 0.6, 'chat');
    // jukebox in the back corner
    box(g, 0x5d2f1a, 0.9, 1.5, 0.6, -W2 + 2.6, 0.75, D2 - 0.45); box(g, 0, 0.7, 0.9, 0.02, -W2 + 2.6, 0.95, D2 - 0.76, basic(0xff7a2a)); box(g, 0, 0.8, 0.08, 0.03, -W2 + 2.6, 1.45, D2 - 0.77, basic(0x40c4ff));
    cb(-W2 + 2.6, D2 - 0.45, 1, 0, 0.5, 0.35, 1.6);
    // neon beer signs: back wall, left wall, over the back bar, and OPEN in the window
    const pickN = NEONS.slice().sort(() => Math.random() - 0.5);
    neon(g, pickN[0][0], pickN[0][1], 2.4, 0.6, 2.6, D2 - 0.16, Math.PI); neon(g, pickN[1][0], pickN[1][1], 2.2, -W2 + 0.16, 2.6, 0.2, Math.PI / 2); neon(g, pickN[2][0], pickN[2][1], 2.6, W2 - 0.16, 2.95, -2.6, -Math.PI / 2);
    neon(g, 'OPEN', '#ff2a2a', 1.4, -4, 2.1, -D2 + 0.12, Math.PI);
    for (let i = 0; i < 3; i++) box(g, 0, 0.3, 0.25, 0.3, bx - 0.4, 3.75, -1.5 + i * 2.5, basic(0xffb060)); // pendants over the counter
  } else if (kind === 'casino') {
    const sh = shared(), W2 = w / 2, D2 = d / 2;
    // chandeliers: gold rings of glowing bulbs (no extra lights: the one pooled shop light does the lighting)
    const CH = [[-8, -5], [8, -5], [-8, 6], [8, 6], [0, 0]];
    for (const [cx, cz] of CH) { const r = new THREE.Mesh(sh.ring, sh.gold); r.position.set(cx, 3.5, cz); r.rotation.x = Math.PI / 2; g.add(r); box(g, 0, 0.04, 0.6, 0.04, cx, 3.85, cz, sh.gold); }
    inst(g, sh.bulb, basic(0xfff1c4), CH.flatMap(([cx, cz]) => Array.from({ length: 10 }, (_, i) => [cx + Math.cos(i * 0.628) * 1.1, 3.47 - (i % 2) * 0.12, cz + Math.sin(i * 0.628) * 1.1])));
    inst(g, sh.crystal, basic(0xfff8e1), CH.map(([cx, cz]) => [cx, 3.1, cz]));
    // slot machines: a row down the left wall and a back-to-back island ([x, z, facing +x or -x])
    const slots = [];
    for (let i = 0; i < 11; i++) slots.push([-W2 + 0.8, -10 + i * 2, 1]);
    for (let i = 0; i < 9; i++) slots.push([-12.6, -8 + i * 2, -1], [-11.4, -8 + i * 2, 1]);
    const SC = [0xff4081, 0x40c4ff, 0xffeb3b, 0x69f0ae];
    inst(g, sh.cab, sh.slot, slots.map(([x, z, f]) => [x, 0.95, z, (f * Math.PI) / 2]));
    inst(g, sh.screen, sh.glow, slots.map(([x, z, f], i) => [x + f * 0.46, 1.35, z, (f * Math.PI) / 2, SC[i % 4]]));
    inst(g, sh.topper, sh.glow, slots.map(([x, z, f], i) => [x, 2.02, z, (f * Math.PI) / 2, SC[(i + 2) % 4]]));
    inst(g, sh.seat, sh.red, slots.map(([x, z, f]) => [x + f * 1.1, 0.62, z])); inst(g, sh.pole, sh.chrome, slots.map(([x, z, f]) => [x + f * 1.1, 0.3, z]));
    cb(-W2 + 0.8, 0, 1, 0, 0.5, 11.2, 2); cb(-12, 0, 1, 0, 1.1, 9.2, 2);
    for (const [x, z, f] of slots) {
      spot(x + f * 1.1, z, 0.95, 'slots');
      if (people.length < 9 && Math.random() < 0.35) person(randomLook(), x + f * 1.25, z, f > 0 ? -Math.PI / 2 : Math.PI / 2, 'stand');
    }
    // blackjack: half-moon tables, a dealer behind each
    const dealer = [0xffdbac, 0xffffff, 0x111111, 0x111111, 8 | 64];
    for (const [tx, tz] of [[1, -7], [8, -7], [1, 1.5]]) {
      const top = new THREE.Mesh(sh.half, sh.felt); top.position.set(tx, 0.85, tz); g.add(top);
      const base = new THREE.Mesh(sh.halfBase, sh.wood); base.position.set(tx, 0.4, tz); g.add(base);
      box(g, 0, 0.9, 0.08, 0.25, tx, 0.93, tz + 0.15, sh.gold); // chip tray
      for (let k = 0; k < 3; k++) box(g, 0, 0.12, 0.01, 0.17, tx - 0.6 + k * 0.6, 0.91, tz - 1.1, basic(0xffffff)); // cards
      cb(tx, tz - 0.8, 1, 0, 1.7, 0.85, 1.2);
      person(dealer, tx, tz + 0.6, Math.PI, 'chat');
      for (let k = 0; k < 3; k++) if (Math.random() < 0.55) { const a = -0.9 + k * 0.9; person(randomLook(), tx + Math.sin(a) * 2.2, tz - Math.cos(a) * 2.2, -a, 'stand'); }
      spot(tx, tz - 2.2, 1.6, 'blackjack');
    }
    // roulette, its wheel turning
    const rx = 8, rz = 1.5;
    box(g, 0, 3.4, 0.8, 1.6, rx, 0.4, rz, sh.wood); box(g, 0, 3.2, 0.05, 1.4, rx - 0.3, 0.83, rz, sh.felt);
    box(g, 0, 1.3, 0.25, 1.3, rx + 1.1, 0.95, rz, sh.wood);
    spin = new THREE.Mesh(sh.disc, sh.wheel); spin.scale.setScalar(0.6); spin.rotation.x = -Math.PI / 2; spin.position.set(rx + 1.1, 1.085, rz); g.add(spin);
    cb(rx, rz, 1, 0, 1.75, 0.85, 1.2);
    person(dealer, rx, rz + 1.3, Math.PI, 'chat');
    for (let k = 0; k < 3; k++) if (Math.random() < 0.6) person(randomLook(), rx - 1.2 + k * 1.1, rz - 1.4, 0, 'stand');
    spot(rx, rz - 1.5, 1.6, 'roulette');
    // the bar down the right wall
    const bx = W2 - 2.6;
    box(g, 0, 0.8, 1.05, 10, bx, 0.52, -6, sh.wood); box(g, 0, 1.1, 0.08, 10.2, bx, 1.08, -6, sh.gold);
    box(g, 0x2a1a12, 0.5, 2.6, 10, W2 - 0.3, 1.3, -6);
    const bottles = [];
    for (let k = 0; k < 3; k++) { box(g, 0x5d4037, 0.55, 0.05, 10, W2 - 0.35, 1.15 + k * 0.55, -6); for (let i = 0; i < 20; i++) bottles.push([W2 - 0.4, 1.33 + k * 0.55, -10.7 + i * 0.49, 0, [0x2e7d32, 0x8d5524, 0xd7ccc8, 0x1565c0, 0xb71c1c, 0xffb300][(i * 5 + k) % 6]]); }
    inst(g, sh.bottle, sh.glow, bottles);
    cb(bx, -6, 1, 0, 0.55, 5.1, 2.1); cb(W2 - 0.3, -6, 1, 0, 0.3, 5, 3);
    const stoolZ = [-10, -8, -4, -2];
    inst(g, sh.seat, sh.red, stoolZ.map((z) => [bx - 0.85, 0.76, z])); inst(g, sh.pole, sh.chrome, stoolZ.map((z) => [bx - 0.85, 0.36, z]));
    person([0xc68642, 0x111111, 0x111111, 0x1b1b1b, 8 | 64], W2 - 1.4, -6, -Math.PI / 2, 'stand');
    for (const z of stoolZ) if (Math.random() < 0.5) person(randomLook(), bx - 1.15, z, Math.PI / 2, 'chat');
    spot(bx - 1, -6, 1.8, 'drinks');
    // cashier cage (rob it: aim at the cashier, main.js)
    box(g, 0x8d6e63, 10, 1.2, 1, 0, 0.6, D2 - 3); cb(0, D2 - 3, 0, 1, 0.5, 5, 3);
    for (let i = -5; i <= 5; i += 0.5) box(g, 0xffd54f, 0.04, 2.6, 0.04, i, 2.5, D2 - 3);
    box(g, 0xffd54f, 10, 0.08, 0.08, 0, 3.8, D2 - 3);
    clerk = person([0xe0ac69, 0xffffff, 0x111111, 0x3b2314, 8 | 64], 0, D2 - 1.8, Math.PI, 'stand');
    counter = { x: wx(0, D2 - 4), z: wz(0, D2 - 4) };
    sign(g, store.name.toUpperCase(), 10, 1.2, 0, 3.5, D2 - 0.2, Math.PI, '#1a0033', '#ffd54f');
    sign(g, 'CASHIER', 3, 0.5, 0, 3.1, D2 - 3.1, Math.PI, '#ffd54f', '#1a0033');
    neon(g, 'Slots', '#ff4081', 3, -W2 + 0.16, 3, 0, Math.PI / 2); neon(g, 'Blackjack', '#40c4ff', 3.4, -9, 3, D2 - 0.16, Math.PI); neon(g, bare ? 'Lone Wolf' : 'Belle Bar', '#ffd54f', 3, W2 - 0.16, 3.1, -6, -Math.PI / 2);
  }
  const owner = `shop_${Math.round(x)}_${Math.round(y)}_${Math.round(z)}`;
  addBoxes(owner, boxes);
  return { kind, store, group: g, owner, x, y, z, w, d, cs, sn, clerk, people, counter, spots, seats, spin, under, exit: under ? { x: wx(0, -d / 2 + 1.4), z: wz(0, -d / 2 + 1.4) } : null };
}
function drop(R) {
  removeBoxes(R.owner);
  for (const p of R.people) { disposeCharacter(p.ch); R.group.remove(p.ch.g); }
  scene.remove(R.group);
  // free what this shop made: box geometry, sign textures, the $ sprite's material (shared materials and the $ texture stay)
  R.group.traverse((m) => {
    if (m.isSprite) m.material.dispose();
    else if (m.geometry) { if (m.isInstancedMesh) m.dispose(); if (!m.geometry.userData.keep) m.geometry.dispose(); if (m.material.map && !m.material.map.userData.keep) { m.material.map.dispose(); m.material.dispose(); } }
  });
  if (R.store.tag?.parent === R.group) R.store.tag = null;
}
// Landmark halls (landmarks.js): rooms modelled inside a landmark's GLB, added and removed with the model.
// Standing inside one makes it the room you're in (flat floor at h.y, the pooled light, out of police sight).
// A 'casino' hall also gets the casino floor (tables, slots, bar, cage) centred on h.fx/fz.
const halls = new Set();
export function addHall(h) {
  const store = { name: h.name, kind: h.kind, x: h.x, z: h.z, cooldown: 0, progress: 0 };
  const R = h.kind === 'casino' ? buildRoom(store, h.fx ?? h.x, h.y, h.fz ?? h.z, h.rot, false, true)
    : { kind: h.kind, store, group: null, owner: null, people: [], spots: null, seats: [] };
  Object.assign(R, { hall: true, x: h.x, y: h.y, z: h.z, w: h.w, d: h.d, cs: Math.cos(h.rot), sn: Math.sin(h.rot), lx: h.fx ?? h.x, lz: h.fz ?? h.z, ly: h.ly ?? 3.8, light: h.light });
  halls.add(R);
  return R;
}
export function removeHall(R) {
  if (R.group) drop(R);
  halls.delete(R);
  if (room === R) room = null;
}
// The casino: build its hidden room and return where to stand.
export function enter(store, groundY) {
  leave();
  room = buildRoom(store, store.x, groundY - DEPTH, store.z, 0, true);
  return { x: store.x, y: room.y, z: store.z - room.d / 2 + 1.6, h: 0 };
}
export function leave() {
  if (room?.under) drop(room);
  room = null;
}
// A storefront on its lot; the floor sits on the highest ground under it, at most a step above the door.
function storefront(s) {
  const fx = Math.sin(s.face), fz = Math.cos(s.face), at = (lx, lz) => W.groundHeight(s.cx + lx * fz + lz * fx, s.cz - lx * fx + lz * fz);
  const g0 = at(0, -s.d / 2), y = Math.min(g0 + 0.45, Math.max(g0, at(0, 0), at(-s.w / 2, s.d / 2), at(s.w / 2, s.d / 2)));
  return buildRoom(s, s.cx, y, s.cz, s.face, false);
}
let scanI = 0;
// Per frame: build/remove storefronts around you, work out which shop you're standing in, animate the people.
export function updateRoom(dt, me, threat) {
  if (!scene) return;
  const px = me.veh ? me.veh.x : me.x, pz = me.veh ? me.veh.z : me.z;
  const s = stores.length ? stores[(scanI = (scanI + 1) % stores.length)] : null; // one store a frame
  if (s && s.w) {
    const dd = Math.hypot(s.cx - px, s.cz - pz);
    // wait for the tile's data so the floor matches the detailed ground
    if (!s.room && dd < NEAR && W.tiles.has(`${Math.floor(s.cx / 200)}_${Math.floor(s.cz / 200)}`)) built.add((s.room = storefront(s)));
    else if (s.room && dd > FAR && s.room !== room) { drop(s.room); built.delete(s.room); s.room = null; }
  }
  if (!room?.under) {
    let inside = null;
    if (!me.veh) for (const set of [built, halls]) for (const R of set) {
      const dx = me.x - R.x, dz = me.z - R.z;
      if (Math.abs(dx * R.cs - dz * R.sn) < R.w / 2 && Math.abs(dx * R.sn + dz * R.cs) < R.d / 2 && me.y < R.y + 3) { inside = R; break; }
    }
    if (room && room !== inside) { Object.assign(room.store, { alarmed: false, alarm: false, progress: 0 }); room.held = false; } // walking out drops the robbery
    room = inside;
  }
  // the shop light follows the shop you're in, or the nearest one when you're outside
  let lit = room, ld = 40;
  if (!lit) for (const R of built) { const d = Math.hypot(R.x - px, R.z - pz); if (d < ld) { ld = d; lit = R; } }
  if (lit) { light.position.set(lit.lx ?? lit.x, lit.y + (lit.ly ?? 3.8), lit.lz ?? lit.z); light.color.setHex(lit.light?.[0] ?? (lit.kind === 'casino' ? 0xffc27a : lit.kind === 'bar' ? 0xff9a4a : 0xfff4e0)); }
  light.intensity = !lit ? 0 : lit.light ? lit.light[1] : lit.kind === 'casino' ? 30 : lit.kind === 'bar' ? 7 : 12;
  if (room?.spin) room.spin.rotation.z += dt * 1.6;
  for (const R of room?.under || room?.hall ? [room, ...built] : built) for (const p of R.people) {
    const scared = threat && Math.hypot(threat.x - p.x, threat.z - p.z) < 30;
    const st = p === R.clerk && R.held ? { handsUp: true } : scared && p !== R.clerk ? { cower: true } : p.pose === 'chat' ? { chat: true } : p.pose === 'browse' ? { look: Math.sin(performance.now() / 900 + p.lx) * 0.6 } : {};
    animateCharacter(p.ch, dt, st);
  }
}
export function nearExit(x, z) { return room && room.exit && Math.hypot(room.exit.x - x, room.exit.z - z) < 2.2; }
export function nearCounter(x, z) { return room && room.counter && Math.hypot(room.counter.x - x, room.counter.z - z) < 2.6; }
export const roomFloor = () => (room ? room.y : null);
