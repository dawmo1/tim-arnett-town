// Small wildlife: pigeons that scatter, gulls circling the beach, ducks bobbing by the docks.
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

export function initLife(scene) {
  const r = rng(555);
  const geo = birdGeo();
  // pigeon flocks on sidewalks, the park and plazas
  const flocks = [];
  for (let k = 0; k < 10; k++) flocks.push(W.P(150 + r() * 800, (r() < 0.5 ? 1 : -1) * (8.8 + r() * 1.2)));
  if (W.places.park) for (let k = 0; k < 2; k++) flocks.push(W.P(W.places.park.s + (r() - 0.5) * 40, 22 + r() * 10));
  for (const f of flocks) for (let i = 0; i < 6; i++) {
    const hx = f.x + (r() - 0.5) * 3, hz = f.z + (r() - 0.5) * 3;
    birds.push({ kind: 'pigeon', hx, hz, x: hx, y: 0.1, z: hz, h: r() * 6.28, state: 'ground', t: r() * 5, vx: 0, vy: 0, vz: 0 });
  }
  // gulls circling over the beach
  for (let i = 0; i < 10; i++) { const c = W.P(150 + r() * 800, 70 + r() * 40); birds.push({ kind: 'gull', cx: c.x, cz: c.z, rad: 8 + r() * 20, a: r() * 6.28, sp: 0.3 + r() * 0.3, y: 14 + r() * 10, x: c.x, z: c.z, h: 0, t: 0 }); }
  // ducks near the docks
  for (const k of W.docks) for (let i = 0; i < 4; i++) { const c = W.P(k.s + 8 + (r() - 0.5) * 6, k.d0 + 15 + r() * 10); birds.push({ kind: 'duck', cx: c.x, cz: c.z, x: c.x, z: c.z, a: r() * 6.28, rad: 2 + r() * 3, sp: 0.1 + r() * 0.15, y: -0.1, h: 0, t: r() * 6 }); }
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
        b.y = 0.12 + Math.max(0, Math.sin(time * 9 + b.hx)) * 0.03;
      } else if (b.state === 'fly') {
        b.t -= dt; b.vy -= dt * 0.6;
        b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; flap = 1;
        if (b.t <= 0) { b.state = 'away'; b.t = 20 + Math.random() * 15; }
      } else { b.t -= dt; b.y = -50; if (b.t <= 0) { b.state = 'ground'; b.x = b.hx; b.z = b.hz; } }
    } else {
      b.a += b.sp * dt * (b.kind === 'gull' ? 1 : 0.6);
      b.x = b.cx + Math.cos(b.a) * b.rad; b.z = b.cz + Math.sin(b.a) * b.rad;
      b.h = b.a + Math.PI; // tangent direction
      if (b.kind === 'gull') { b.y += (16 - b.y) * dt * 0.05; flap = 0.5; }
      else { b.y = -0.12 + Math.sin(time * 2 + b.t) * 0.04; b.rad += (3 - b.rad) * dt * 0.05; }
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
