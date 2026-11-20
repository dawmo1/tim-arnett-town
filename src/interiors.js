// Walk-in stores: corner stores and gas stations (rob the clerk), Arnett Arms (the gun counter) and Tim's Threads
// are real buildings on their own lot by the street (economy.js plans the lot, city/data.js clears it). Each is
// built while you're near and removed when you're far; you just walk in through the door.
// The Arnett Belle casino is still a room built out of sight under the riverboat when you press E.
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
const LOOK = { rob: [0xd8cfc0, 0xc62828, '#c62828'], guns: [0x6d5f52, 0x212121, '#b71c1c'], clothes: [0xeae2ec, 0xad1457, '#ad1457'] };

// Build a store's room at (x, y, z) turned by rot (local -z is the door side). under: the casino's hidden room.
function buildRoom(store, x, y, z, rot, under) {
  const kind = store.kind, [w, d] = store.w ? [store.w, store.d] : SIZES[kind];
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; scene.add(g);
  const cs = Math.cos(rot), sn = Math.sin(rot), wx = (lx, lz) => x + lx * cs + lz * sn, wz = (lx, lz) => z - lx * sn + lz * cs;
  const boxes = [];
  // a collision box given in room coordinates
  const cb = (lx, lz, ux, uz, hu, hv, h) => boxes.push(makeBox(wx(lx, lz), wz(lx, lz), ux * cs + uz * sn, -ux * sn + uz * cs, hu, hv, y - 1, h));
  const wall = (cx, cz, ux, uz, len) => cb(cx, cz, ux, uz, 0.4, len / 2, 6);
  // shell: floor, ceiling, four walls (the door is on the -z wall)
  const floorCol = kind === 'casino' ? 0x5b1a2a : kind === 'guns' ? 0x5d5348 : 0x9c958a;
  box(g, floorCol, w, 0.2, d, 0, -0.1, 0); box(g, kind === 'casino' ? 0x2a0f18 : 0xb9b8b2, w, 0.2, d, 0, 4.2, 0);
  const wallCol = kind === 'casino' ? 0x3b1222 : kind === 'guns' ? 0x7a6f63 : kind === 'clothes' ? 0xc9b8cc : 0xc7c1b4;
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
  // ceiling lights
  for (let i = -1; i <= 1; i++) box(g, 0, w * 0.25, 0.08, 0.5, i * w * 0.3, 4.05, 0, basic(kind === 'casino' ? 0xffc46b : 0xfffbe8));
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
  } else if (kind === 'casino') {
    // slots along the sides, card tables in the middle, the cashier cage at the back
    for (const side of [-1, 1]) for (let i = 0; i < 9; i++) {
      const sx = side * (w / 2 - 1.2), sz = -d / 2 + 4 + i * 2.6;
      box(g, 0x311b92, 1, 1.9, 0.9, sx, 0.95, sz); box(g, 0, 0.7, 0.6, 0.05, sx - side * 0.46, 1.3, sz, basic([0xff4081, 0x40c4ff, 0xffeb3b][i % 3]));
      cb(sx, sz, 1, 0, 0.5, 0.45, 2);
      if (Math.random() < 0.55) person(randomLook(), sx - side * 1.2, sz, side > 0 ? Math.PI / 2 : -Math.PI / 2, 'stand');
    }
    for (const [tx, tz] of [[-6, -4], [6, -4], [-6, 4], [6, 4], [0, 0]]) {
      const tb = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.9, 16), mat(0x1b5e20)); tb.position.set(tx, 0.45, tz); g.add(tb);
      cb(tx, tz, 1, 0, 1.7, 1.7, 1.5);
      person([0xffdbac, 0xffffff, 0x111111, 0x111111, 8 | 64], tx, tz + 2.3, Math.PI, 'chat'); // dealer
      for (let k = 0; k < 3; k++) { const a = -0.6 + k * 0.6; person(randomLook(), tx + Math.sin(a) * 2.4, tz - Math.cos(a) * 2.4, a, 'stand'); }
    }
    // cashier cage
    box(g, 0x8d6e63, 10, 1.2, 1, 0, 0.6, d / 2 - 3); cb(0, d / 2 - 3, 0, 1, 0.5, 5, 3);
    for (let i = -5; i <= 5; i += 0.5) box(g, 0xffd54f, 0.04, 2.6, 0.04, i, 2.5, d / 2 - 3);
    box(g, 0xffd54f, 10, 0.08, 0.08, 0, 3.8, d / 2 - 3);
    clerk = person([0xe0ac69, 0xffffff, 0x111111, 0x3b2314, 8 | 64], 0, d / 2 - 1.8, Math.PI, 'stand');
    counter = { x: wx(0, d / 2 - 4), z: wz(0, d / 2 - 4) };
    sign(g, 'THE ARNETT BELLE', 10, 1.2, 0, 3.5, d / 2 - 0.2, Math.PI, '#1a0033', '#ffd54f');
    sign(g, 'CASHIER', 3, 0.5, 0, 3.1, d / 2 - 3.1, Math.PI, '#ffd54f', '#1a0033');
  }
  const owner = `shop_${Math.round(x)}_${Math.round(y)}_${Math.round(z)}`;
  addBoxes(owner, boxes);
  return { kind, store, group: g, owner, x, y, z, w, d, cs, sn, clerk, people, counter, under, exit: under ? { x: wx(0, -d / 2 + 1.4), z: wz(0, -d / 2 + 1.4) } : null };
}
function drop(R) {
  removeBoxes(R.owner);
  for (const p of R.people) { disposeCharacter(p.ch); R.group.remove(p.ch.g); }
  scene.remove(R.group);
  // free what this shop made: box geometry, sign textures, the $ sprite's material (shared materials and the $ texture stay)
  R.group.traverse((m) => { if (m.isSprite) m.material.dispose(); else if (m.geometry) { m.geometry.dispose(); if (m.material.map) { m.material.map.dispose(); m.material.dispose(); } } });
  if (R.store.tag?.parent === R.group) R.store.tag = null;
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
    if (!me.veh) for (const R of built) {
      const dx = me.x - R.x, dz = me.z - R.z;
      if (Math.abs(dx * R.cs - dz * R.sn) < R.w / 2 && Math.abs(dx * R.sn + dz * R.cs) < R.d / 2 && me.y < R.y + 3) { inside = R; break; }
    }
    if (room && room !== inside) { Object.assign(room.store, { alarmed: false, alarm: false, progress: 0 }); room.held = false; } // walking out drops the robbery
    room = inside;
  }
  // the shop light follows the shop you're in, or the nearest one when you're outside
  let lit = room, ld = 40;
  if (!lit) for (const R of built) { const d = Math.hypot(R.x - px, R.z - pz); if (d < ld) { ld = d; lit = R; } }
  if (lit) { light.position.set(lit.x, lit.y + 3.8, lit.z); light.color.setHex(lit.kind === 'casino' ? 0xffc27a : 0xfff4e0); }
  light.intensity = !lit ? 0 : lit.kind === 'casino' ? 30 : 12;
  for (const R of room?.under ? [room, ...built] : built) for (const p of R.people) {
    const scared = threat && Math.hypot(threat.x - p.x, threat.z - p.z) < 30;
    const st = p === R.clerk && R.held ? { handsUp: true } : scared && p !== R.clerk ? { cower: true } : p.pose === 'chat' ? { chat: true } : p.pose === 'browse' ? { look: Math.sin(performance.now() / 900 + p.lx) * 0.6 } : {};
    animateCharacter(p.ch, dt, st);
  }
}
export function nearExit(x, z) { return room && room.exit && Math.hypot(room.exit.x - x, room.exit.z - z) < 2.2; }
export function nearCounter(x, z) { return room && room.counter && Math.hypot(room.counter.x - x, room.counter.z - z) < 2.6; }
export const roomFloor = () => (room ? room.y : null);
