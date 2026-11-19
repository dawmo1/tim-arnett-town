// Small wildlife: pigeons that scatter downtown, gulls over the Mississippi, ducks along the riverfront.
// Purely local decoration (not networked).
import * as THREE from 'three';
import * as W from './world.js';
import { rng } from './util.js';

const birds = [];
let pigeonMesh, gullMesh, duckMesh;
const o = new THREE.Object3D();

function birdGeo() {
  // body + head + wings merged into one small geometry
  const g = new THREE.BoxGeometry(0.22, 0.18, 0.38);
  const head = new THREE.BoxGeometry(0.14, 0.14, 0.14).translate(0, 0.12, 0.2);
  const wings = new THREE.BoxGeometry(0.62, 0.03, 0.2).translate(0, 0.06, -0.02);
  const merged = new THREE.BufferGeometry();
  const parts = [g, head, wings].map((x) => x.toNonIndexed());
  const pos = [], nor = [];
  for (const p of parts) { pos.push(...p.attributes.position.array); nor.push(...p.attributes.normal.array); }
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return merged;
}

let lifeScene = null;
export function initLife(scene) {
  lifeScene = scene;
  const r = rng(555);
  const geo = birdGeo();
  // pigeon flocks on downtown and Village sidewalks
  const flocks = [];
  for (let k = 0; k < 9; k++) flocks.push(W.sidewalkSpot({ x: -150 + r() * 400, z: -260 + r() * 200, r: 120 }, r));
  for (let k = 0; k < 3; k++) flocks.push(W.sidewalkSpot({ x: 1900 + r() * 300, z: -450, r: 150 }, r));
  for (const f of flocks) for (let i = 0; i < 6; i++) {
    const hx = f.x + (r() - 0.5) * 3, hz = f.z + (r() - 0.5) * 3;
    birds.push({ kind: 'pigeon', hx, hz, x: hx, y: W.groundHeight(hx, hz) + 0.04, z: hz, h: r() * 6.28, state: 'ground', t: r() * 5, vx: 0, vy: 0, vz: 0 });
  }
  // gulls over the Mississippi, ducks along the riverfront
  const riverAt = (x) => { for (let z = -100; z < 900; z += 10) if (!W.isLand(x, z)) return z; return 300; };
  for (let i = 0; i < 12; i++) { const x = -1800 + r() * 4000, z = riverAt(x) + 40 + r() * 160; birds.push({ kind: 'gull', cx: x, cz: z, rad: 10 + r() * 25, a: r() * 6.28, sp: 0.3 + r() * 0.3, y: 14 + r() * 10, x, z, h: 0, t: 0 }); }
  for (let k = 0; k < 5; k++) { const x = -600 + r() * 1400, z = riverAt(x) + 8 + r() * 15; for (let i = 0; i < 4; i++) birds.push({ kind: 'duck', cx: x + (r() - 0.5) * 6, cz: z + (r() - 0.5) * 6, x, z, a: r() * 6.28, rad: 2 + r() * 3, sp: 0.1 + r() * 0.15, y: W.WATER_Y + 0.05, h: 0, t: r() * 6 }); }
  const count = (k) => birds.filter((b) => b.kind === k).length;
  pigeonMesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0x8a8f9a }), count('pigeon'));
  gullMesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xf5f5f5 }), count('gull'));
  duckMesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0x6d4c41 }), count('duck'));
  for (const m of [pigeonMesh, gullMesh, duckMesh]) { m.frustumCulled = false; scene.add(m); }
}

// Something startling happened at (x, z) (gunfire, explosion, a car).
export function startle(x, z, radius) {
  for (const b of birds) {
    if (Math.hypot(b.x - x, b.z - z) > radius) continue;
    if (b.kind === 'pigeon' && b.state === 'ground') flyOff(b, x, z);
    if (b.kind === 'gull') b.y = Math.min(40, b.y + 8);
    if (b.kind === 'duck') b.rad = Math.min(14, b.rad + 5);
  }
}
function flyOff(b, x, z) {
  const a = Math.atan2(b.x - x, b.z - z) + (Math.random() - 0.5) * 1.5;
  b.state = 'fly'; b.t = 6 + Math.random() * 4;
  b.vx = Math.sin(a) * (5 + Math.random() * 3); b.vz = Math.cos(a) * (5 + Math.random() * 3); b.vy = 4 + Math.random() * 3; b.h = a;
}

// threats: [{x, z, r}] things that make pigeons fly when they get close (players, moving cars)
export function updateLife(dt, threats, time) {
  const idx = { pigeon: 0, gull: 0, duck: 0 };
  for (const b of birds) {
    let flap = 0;
    if (b.kind === 'pigeon') {
      if (b.state === 'ground') {
        b.t -= dt;
        if (b.t < 0) { b.t = 1 + Math.random() * 3; b.h += (Math.random() - 0.5) * 2; b.x = b.hx + (Math.random() - 0.5) * 2.5; b.z = b.hz + (Math.random() - 0.5) * 2.5; }
        for (const t of threats) if (Math.abs(t.x - b.x) < t.r && Math.abs(t.z - b.z) < t.r && Math.hypot(t.x - b.x, t.z - b.z) < t.r) { flyOff(b, t.x, t.z); break; }
        b.gy = b.gy ?? W.groundHeight(b.hx, b.hz); b.y = b.gy + 0.04 + Math.max(0, Math.sin(time * 9 + b.hx)) * 0.03;
      } else if (b.state === 'fly') {
        b.t -= dt; b.vy -= dt * 0.6;
        b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; flap = 1;
        if (b.t <= 0) { b.state = 'away'; b.t = 20 + Math.random() * 15; }
      } else { b.t -= dt; b.y = -50; if (b.t <= 0) { b.state = 'ground'; b.x = b.hx; b.z = b.hz; b.gy = null; } }
    } else {
      b.a += b.sp * dt * (b.kind === 'gull' ? 1 : 0.6);
      b.x = b.cx + Math.cos(b.a) * b.rad; b.z = b.cz + Math.sin(b.a) * b.rad;
      b.h = b.a + Math.PI; // tangent direction
      if (b.kind === 'gull') { b.y += (16 - b.y) * dt * 0.05; flap = 0.5; }
      else { b.y = W.WATER_Y + 0.03 + Math.sin(time * 2 + b.t) * 0.04; b.rad += (3 - b.rad) * dt * 0.05; }
    }
    o.position.set(b.x, b.y, b.z);
    o.rotation.set(0, b.h, flap ? Math.sin(time * 18 + b.x) * 0.3 * flap : 0);
    const sc = b.kind === 'gull' ? 1.6 : b.kind === 'duck' ? 1.3 : 1;
    o.scale.set(flap ? sc : sc * 0.55, sc, sc);
    o.updateMatrix();
    const m = b.kind === 'pigeon' ? pigeonMesh : b.kind === 'gull' ? gullMesh : duckMesh;
    m.setMatrixAt(idx[b.kind]++, o.matrix);
  }
  pigeonMesh.instanceMatrix.needsUpdate = gullMesh.instanceMatrix.needsUpdate = duckMesh.instanceMatrix.needsUpdate = true;
}

// ---------- squirrels, rabbits, cats and the odd stray dog (around you, out of the way) ----------
// each animal kind is one instanced mesh of a few merged boxes: [sx, sy, sz, x, y, z, colour]
function animalGeo(parts) {
  const pos = [], nor = [], col = [], idx = [], c = new THREE.Color();
  for (const [sx, sy, sz, x, y, z, hex] of parts) {
    const g = new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z), base = pos.length / 3;
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    c.setHex(hex); for (let i = 0; i < g.attributes.position.count; i++) col.push(c.r, c.g, c.b);
    for (const i of g.index.array) idx.push(base + i);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
  return geo;
}
const KINDS = {
  squirrel: { n: 12, speed: 4, scare: 6, parts: [[0.12, 0.12, 0.28, 0, 0.1, 0, 0x8d5a3b], [0.1, 0.1, 0.1, 0, 0.17, 0.16, 0x8d5a3b], [0.08, 0.26, 0.08, 0, 0.24, -0.16, 0x9c6b47]] },
  rabbit: { n: 6, speed: 5, scare: 7, parts: [[0.18, 0.18, 0.32, 0, 0.12, 0, 0xb7a58f], [0.13, 0.13, 0.13, 0, 0.24, 0.17, 0xb7a58f], [0.03, 0.14, 0.05, 0.04, 0.37, 0.17, 0xc9b8a2], [0.03, 0.14, 0.05, -0.04, 0.37, 0.17, 0xc9b8a2], [0.07, 0.07, 0.07, 0, 0.15, -0.18, 0xf5f5f5]] },
  cat: { n: 5, speed: 3.5, scare: 3, parts: [[0.18, 0.2, 0.45, 0, 0.25, 0, 0x6d6d6d], [0.16, 0.16, 0.16, 0, 0.38, 0.27, 0x6d6d6d], [0.05, 0.06, 0.04, 0.05, 0.49, 0.27, 0x555555], [0.05, 0.06, 0.04, -0.05, 0.49, 0.27, 0x555555], [0.04, 0.04, 0.35, 0, 0.35, -0.35, 0x6d6d6d], [0.05, 0.16, 0.05, 0.06, 0.08, 0.15, 0x6d6d6d], [0.05, 0.16, 0.05, -0.06, 0.08, 0.15, 0x6d6d6d], [0.05, 0.16, 0.05, 0.06, 0.08, -0.15, 0x6d6d6d], [0.05, 0.16, 0.05, -0.06, 0.08, -0.15, 0x6d6d6d]] },
  stray: { n: 2, speed: 5, scare: 2.5, parts: [[0.28, 0.28, 0.7, 0, 0.45, 0, 0xc8a165], [0.24, 0.24, 0.3, 0, 0.62, 0.42, 0xc8a165], [0.12, 0.1, 0.16, 0, 0.56, 0.62, 0x222222], [0.06, 0.06, 0.3, 0, 0.6, -0.45, 0xc8a165], [0.08, 0.32, 0.08, 0.1, 0.16, 0.25, 0xc8a165], [0.08, 0.32, 0.08, -0.1, 0.16, 0.25, 0xc8a165], [0.08, 0.32, 0.08, 0.1, 0.16, -0.25, 0xc8a165], [0.08, 0.32, 0.08, -0.1, 0.16, -0.25, 0xc8a165]] },
};
const animals = [];
let animalMeshes = null;
const CAT_COLS = [0x6d6d6d, 0x2b2b2b, 0xe0a060, 0xf5f5f5, 0x8d6e63];
function animalSpot(kind, fx, fz) {
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * 6.28, r = 25 + Math.random() * 70, x = fx + Math.cos(a) * r, z = fz + Math.sin(a) * r;
    if (!W.isLand(x, z) || W.pushOutCircle(x, z, 0.3).hit) continue;
    const c = W.classAt(x, z);
    if (kind === 'squirrel' && c !== W.C.park && c !== W.C.lawn && c !== W.C.wood && c !== W.C.cemetery) continue;
    if (kind === 'rabbit' && c !== W.C.lawn && c !== W.C.park) continue;
    if (kind === 'cat' && c !== W.C.lawn && c !== W.C.walk && c !== W.C.paved) continue;
    if (kind === 'stray' && c === W.C.road) continue;
    return { x, z };
  }
  return null;
}
// focus: where the player is; threats: [{x, z, r}]
export function updateAnimals(dt, focus, threats, time) {
  if (!focus) return;
  if (!animalMeshes) {
    animalMeshes = {};
    for (const [k, def] of Object.entries(KINDS)) { const m = new THREE.InstancedMesh(animalGeo(def.parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), def.n); m.count = 0; m.frustumCulled = false; m.castShadow = true; lifeScene.add(m); animalMeshes[k] = m; }
  }
  // keep each kind topped up near you; forget the far ones
  for (const [k, def] of Object.entries(KINDS)) {
    const mine = animals.filter((a) => a.kind === k);
    for (const a of mine) if (Math.hypot(a.x - focus.x, a.z - focus.z) > 140) animals.splice(animals.indexOf(a), 1);
    if (mine.length < def.n && Math.random() < dt * 2) { const p = animalSpot(k, focus.x, focus.z); if (p) animals.push({ kind: k, x: p.x, z: p.z, h: Math.random() * 6.28, t: Math.random() * 3, run: 0, hop: 0, col: k === 'cat' ? CAT_COLS[Math.floor(Math.random() * CAT_COLS.length)] : null }); }
  }
  const idx = {};
  for (const a of animals) {
    const def = KINDS[a.kind];
    for (const t of threats) if (Math.abs(t.x - a.x) < def.scare + t.r && Math.abs(t.z - a.z) < def.scare + t.r && Math.hypot(t.x - a.x, t.z - a.z) < def.scare + t.r) { a.run = 1.6; a.h = Math.atan2(a.x - t.x, a.z - t.z) + (Math.random() - 0.5) * 0.6; }
    a.t -= dt;
    let sp = 0;
    if (a.run > 0) { a.run -= dt; sp = def.speed; }
    else if (a.t <= 0) { a.t = 1 + Math.random() * 4; if (Math.random() < 0.5) { a.h += (Math.random() - 0.5) * 2.5; a.wander = 0.6 + Math.random() * 1.2; } }
    if (a.wander > 0) { a.wander -= dt; sp = Math.max(sp, def.speed * 0.3); }
    if (sp) {
      const p = W.pushOutCircle(a.x + Math.sin(a.h) * sp * dt, a.z + Math.cos(a.h) * sp * dt, 0.25);
      if (p.hit) a.h += 1.5;
      if (W.isLand(p.x, p.z)) { a.x = p.x; a.z = p.z; } else a.h += Math.PI;
    }
    const hop = (a.kind === 'rabbit' || a.kind === 'squirrel') && sp ? Math.abs(Math.sin(time * 14 + a.x)) * 0.18 : 0;
    o.position.set(a.x, W.groundHeight(a.x, a.z) + hop, a.z); o.rotation.set(0, a.h, 0); o.scale.setScalar(1); o.updateMatrix();
    const m = animalMeshes[a.kind], i = (idx[a.kind] = (idx[a.kind] || 0) + 1) - 1;
    if (i < m.instanceMatrix.count) { m.setMatrixAt(i, o.matrix); if (a.col) m.setColorAt(i, new THREE.Color(a.col)); }
  }
  for (const [k, m] of Object.entries(animalMeshes)) { m.count = Math.min(idx[k] || 0, m.instanceMatrix.count); m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
}
