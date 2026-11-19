// Walk-in interiors: corner stores and gas stations (rob the clerk), Arnett Arms (the gun counter),
// the clothing store (new outfit), and the Arnett Belle casino (rob the cashier cage).
// A room is built when you walk in, out of sight under the store, and removed when you leave.
// Inside, the police can't see you (they wait outside and search), so hiding in a shop sheds stars.
import * as THREE from 'three';
import { addBoxes, removeBoxes, makeBox } from './city/collide.js';
import { makeCharacter, randomLook, animateCharacter, placeCharacter, mat, disposeCharacter } from './character.js';
import { textTexture } from './util.js';

const DEPTH = 400; // rooms sit this far under the street
let scene = null;
export let room = null; // the room you're in: {kind, store, group, x, y, z, w, d, clerk, people, exit, counter, light}
export function initInteriors(s) { scene = s; }

const box = (g, c, sx, sy, sz, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m || mat(c)); b.position.set(x, y, z); b.castShadow = false; b.receiveShadow = true; g.add(b); return b; };
const sign = (g, text, w, h, x, y, z, ry, bg, fg) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: textTexture(text, { w: 512, h: Math.round((512 * h) / w), bg, fg, size: 56 }) })); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m; };
const SIZES = { rob: [14, 11], guns: [16, 11], clothes: [18, 13], casino: [40, 30] };

// Build the room for a store and return where to stand. store: {kind, name, x, z, ...}
export function enter(store, groundY) {
  if (room) leave();
  const kind = store.kind, [w, d] = SIZES[kind] || SIZES.rob;
  const x = store.x, y = groundY - DEPTH, z = store.z;
  const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
  const boxes = [];
  const wall = (cx, cz, ux, uz, len) => boxes.push(makeBox(x + cx, z + cz, ux, uz, 0.4, len / 2, y - 1, 6));
  // shell: floor, ceiling, four walls (the door is on the -z wall)
  const floorCol = kind === 'casino' ? 0x5b1a2a : kind === 'guns' ? 0x5d5348 : 0x9c958a;
  box(g, floorCol, w, 0.2, d, 0, -0.1, 0); box(g, kind === 'casino' ? 0x2a0f18 : 0xb9b8b2, w, 0.2, d, 0, 4.2, 0);
  const wallCol = kind === 'casino' ? 0x3b1222 : kind === 'guns' ? 0x7a6f63 : kind === 'clothes' ? 0xc9b8cc : 0xc7c1b4;
  box(g, wallCol, w, 4.2, 0.3, 0, 2.1, d / 2); box(g, wallCol, w, 4.2, 0.3, 0, 2.1, -d / 2); box(g, wallCol, 0.3, 4.2, d, w / 2, 2.1, 0); box(g, wallCol, 0.3, 4.2, d, -w / 2, 2.1, 0);
  wall(0, d / 2 + 0.4, 0, -1, w); wall(0, -d / 2 - 0.4, 0, 1, w); wall(w / 2 + 0.4, 0, -1, 0, d); wall(-w / 2 - 0.4, 0, 1, 0, d);
  box(g, 0x37474f, 2, 2.4, 0.1, 0, 1.2, -d / 2 + 0.2); // the door you came in by
  sign(g, 'EXIT', 1, 0.3, 0, 2.7, -d / 2 + 0.2, 0, '#2e7d32', '#ffffff');
  // ceiling lights
  for (let i = -1; i <= 1; i++) box(g, 0, w * 0.25, 0.08, 0.5, i * w * 0.3, 4.05, 0, new THREE.MeshBasicMaterial({ color: kind === 'casino' ? 0xffc46b : 0xfffbe8 }));
  const light = new THREE.PointLight(kind === 'casino' ? 0xffc27a : 0xfff4e0, kind === 'casino' ? 30 : 12, 40, 1.6); light.position.set(0, 3.8, 0); g.add(light);
  const people = [], person = (look, px, pz, h, pose) => { const ch = makeCharacter(look); g.add(ch.g); placeCharacter(ch, px, 0, pz, h); const p = { ch, x: x + px, z: z + pz, lx: px, lz: pz, h, pose, y }; people.push(p); return p; };
  let clerk = null, counter = null;
  if (kind === 'rob' || kind === 'guns' || kind === 'clothes') {
    // counter across the back with the clerk behind it
    box(g, kind === 'guns' ? 0x4e342e : 0x8d6e63, w * 0.45, 1.05, 0.8, w * 0.18, 0.52, d / 2 - 2.6);
    box(g, 0x212121, 0.5, 0.35, 0.4, w * 0.22, 1.22, d / 2 - 2.6); // register
    boxes.push(makeBox(x + w * 0.18, z + d / 2 - 2.6, 0, 1, 0.45, w * 0.23, y - 1, 2.1));
    clerk = person([0xe0ac69, kind === 'guns' ? 0x4e342e : kind === 'clothes' ? 0xad1457 : 0xc62828, 0x263238, 0x3b2314, 8 | 64], w * 0.18, d / 2 - 1.7, Math.PI, 'stand');
    counter = { x: x + w * 0.18, z: z + d / 2 - 3.4 };
  }
  if (kind === 'rob') {
    // shelves of snacks, a drinks cooler down the side
    for (let r = 0; r < 3; r++) {
      const sx = -w / 2 + 3 + r * 2.6;
      box(g, 0xcfd8dc, 0.8, 1.7, d * 0.5, sx, 0.85, -0.5);
      for (let k = 0; k < 6; k++) box(g, [0xe53935, 0xffb300, 0x43a047, 0x1e88e5, 0x8e24aa, 0xff7043][(k + r) % 6], 0.82, 0.22, d * 0.5 / 6 - 0.1, sx, 0.4 + (k % 3) * 0.5, -0.5 - d * 0.25 + (k + 0.5) * (d * 0.5 / 6));
      boxes.push(makeBox(x + sx, z - 0.5, 1, 0, 0.45, d * 0.25, y - 1, 3));
    }
    box(g, 0xb0bec5, 0.8, 2.2, d * 0.7, w / 2 - 0.6, 1.1, -0.5); box(g, 0x81d4fa, 0.05, 1.8, d * 0.68, w / 2 - 1.01, 1.2, -0.5, new THREE.MeshStandardMaterial({ color: 0x81d4fa, transparent: true, opacity: 0.4, emissive: 0x29b6f6, emissiveIntensity: 0.4 }));
    sign(g, store.name.toUpperCase(), 6, 0.8, w * 0.18, 3.3, d / 2 - 0.2, Math.PI, '#c62828', '#ffffff');
    for (let i = 0; i < 1 + Math.floor(Math.random() * 2); i++) person(randomLook(), -w / 2 + 4.3 + i * 2.6, -1 + Math.random() * 2, Math.random() * 6, 'browse');
  } else if (kind === 'guns') {
    // the gun wall
    for (let i = 0; i < 9; i++) { box(g, 0x212121, 1.1, 0.14, 0.12, -w / 2 + 2 + i * 1.5, 2 + (i % 3) * 0.5, d / 2 - 0.3); box(g, 0x3e2723, 0.18, 0.2, 0.12, -w / 2 + 1.6 + i * 1.5, 1.92 + (i % 3) * 0.5, d / 2 - 0.3); }
    box(g, 0x6d4c41, w * 0.3, 1, 0.8, -w * 0.25, 0.5, -1); boxes.push(makeBox(x - w * 0.25, z - 1, 0, 1, 0.45, w * 0.15, y - 1, 2));
    for (let i = 0; i < 4; i++) box(g, 0x8bc34a, 0.3, 0.3, 0.5, -w * 0.25 - 1.5 + i, 1.15, -1); // ammo boxes
    sign(g, 'ARNETT ARMS', 6, 0.9, 0, 3.4, d / 2 - 0.2, Math.PI, '#b71c1c', '#ffffff');
  } else if (kind === 'clothes') {
    for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) box(g, [0xe53935, 0x1e88e5, 0xfdd835, 0x43a047, 0x212121, 0xffffff, 0x8e24aa][(r + k) % 7], 0.3, 0.9, 0.5, -w / 2 + 3 + r * 3, 1.3, -d / 2 + 3 + k * 0.6);
    for (let r = 0; r < 4; r++) { box(g, 0x9e9e9e, 0.05, 0.05, 4, -w / 2 + 3 + r * 3, 1.85, -d / 2 + 4.5); boxes.push(makeBox(x - w / 2 + 3 + r * 3, z - d / 2 + 4.5, 1, 0, 0.3, 2, y - 1, 2)); }
    box(g, 0xb0bec5, 1.4, 2.4, 0.05, w / 2 - 0.3, 1.3, 1, new THREE.MeshStandardMaterial({ color: 0xcfe8ff, roughness: 0.02, metalness: 0.9 })); // mirror
    sign(g, store.name.toUpperCase(), 7, 0.9, 0, 3.4, d / 2 - 0.2, Math.PI, '#ad1457', '#ffffff');
    person(randomLook(), -w / 2 + 4.5, -d / 2 + 5, 1, 'browse');
  } else if (kind === 'casino') {
    // slots along the sides, card tables in the middle, the cashier cage at the back
    for (const side of [-1, 1]) for (let i = 0; i < 9; i++) {
      const sx = side * (w / 2 - 1.2), sz = -d / 2 + 4 + i * 2.6;
      box(g, 0x311b92, 1, 1.9, 0.9, sx, 0.95, sz); box(g, 0, 0.7, 0.6, 0.05, sx - side * 0.46, 1.3, sz, new THREE.MeshBasicMaterial({ color: [0xff4081, 0x40c4ff, 0xffeb3b][i % 3] }));
      boxes.push(makeBox(x + sx, z + sz, 1, 0, 0.5, 0.45, y - 1, 2));
      if (Math.random() < 0.55) person(randomLook(), sx - side * 1.2, sz, side > 0 ? Math.PI / 2 : -Math.PI / 2, 'stand');
    }
    for (const [tx, tz] of [[-6, -4], [6, -4], [-6, 4], [6, 4], [0, 0]]) {
      const tb = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.9, 16), mat(0x1b5e20)); tb.position.set(tx, 0.45, tz); g.add(tb);
      boxes.push(makeBox(x + tx, z + tz, 1, 0, 1.7, 1.7, y - 1, 1.5));
      person([0xffdbac, 0xffffff, 0x111111, 0x111111, 8 | 64], tx, tz + 2.3, Math.PI, 'chat'); // dealer
      for (let k = 0; k < 3; k++) { const a = -0.6 + k * 0.6; person(randomLook(), tx + Math.sin(a) * 2.4, tz - Math.cos(a) * 2.4, a, 'stand'); }
    }
    // cashier cage
    box(g, 0x8d6e63, 10, 1.2, 1, 0, 0.6, d / 2 - 3); boxes.push(makeBox(x, z + d / 2 - 3, 0, 1, 0.5, 5, y - 1, 3));
    for (let i = -5; i <= 5; i += 0.5) box(g, 0xffd54f, 0.04, 2.6, 0.04, i, 2.5, d / 2 - 3);
    box(g, 0xffd54f, 10, 0.08, 0.08, 0, 3.8, d / 2 - 3);
    clerk = person([0xe0ac69, 0xffffff, 0x111111, 0x3b2314, 8 | 64], 0, d / 2 - 1.8, Math.PI, 'stand');
    counter = { x, z: z + d / 2 - 4 };
    sign(g, 'THE ARNETT BELLE', 10, 1.2, 0, 3.5, d / 2 - 0.2, Math.PI, '#1a0033', '#ffd54f');
    sign(g, 'CASHIER', 3, 0.5, 0, 3.1, d / 2 - 3.1, Math.PI, '#ffd54f', '#1a0033');
  }
  addBoxes('room', boxes);
  room = { kind, store, group: g, x, y, z, w, d, clerk, people, counter, light, exit: { x, z: z - d / 2 + 1.4 } };
  return { x, y, z: z - d / 2 + 1.6, h: 0 };
}
export function leave() {
  if (!room) return;
  removeBoxes('room');
  for (const p of room.people) disposeCharacter(p.ch);
  scene.remove(room.group);
  room = null;
}
// Animate the people inside; clerk raises their hands when you point a gun at them.
export function updateRoom(dt, me, threat) {
  if (!room) return;
  for (const p of room.people) {
    const scared = threat && Math.hypot(threat.x - p.x, threat.z - p.z) < 30;
    const st = p === room.clerk && room.held ? { handsUp: true } : scared && p !== room.clerk ? { cower: true } : p.pose === 'chat' ? { chat: true } : p.pose === 'browse' ? { look: Math.sin(performance.now() / 900 + p.lx) * 0.6 } : {};
    animateCharacter(p.ch, dt, st);
  }
}
export function nearExit(x, z) { return room && Math.hypot(room.exit.x - x, room.exit.z - z) < 2.2; }
export function nearCounter(x, z) { return room && room.counter && Math.hypot(room.counter.x - x, room.counter.z - z) < 2.6; }
export const roomFloor = () => (room ? room.y : null);
