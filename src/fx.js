// Visual + sound effects: blood, tracers, explosions, fire. All local-only.
import * as THREE from 'three';
import { isLand } from './world.js';

let scene;
const parts = [];     // flying particles
const decals = [];    // blood on the ground
const tracers = [];
const booms = [];
const fires = [];
const box = new THREE.BoxGeometry(1, 1, 1);
const bloodMat = new THREE.MeshLambertMaterial({ color: 0xa00000 });
const decalGeo = new THREE.CircleGeometry(1, 10); decalGeo.rotateX(-Math.PI / 2);
const decalMat = new THREE.MeshLambertMaterial({ color: 0x7a0000, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
const fireMat = new THREE.MeshBasicMaterial({ color: 0xff8c1a });
const smokeMat = new THREE.MeshLambertMaterial({ color: 0x555555, transparent: true, opacity: 0.7 });
const sphere = new THREE.SphereGeometry(1, 10, 8);

export function initFx(s) { scene = s; }

export function blood(x, y, z, dx = 0, dz = 0, amount = 8) {
  for (let i = 0; i < amount; i++) {
    const m = new THREE.Mesh(box, bloodMat);
    const s = 0.05 + Math.random() * 0.08; m.scale.set(s, s, s);
    m.position.set(x, y, z); scene.add(m);
    parts.push({ m, vx: dx * 3 + (Math.random() - 0.5) * 4, vy: 1 + Math.random() * 3, vz: dz * 3 + (Math.random() - 0.5) * 4, life: 1.2, kind: 'blood' });
  }
}
export function bloodPool(x, z, size = 1.2) { addDecal(x, z, 0.1, size); }
function addDecal(x, z, start, target) {
  if (!isLand(x, z)) return;
  const m = new THREE.Mesh(decalGeo, decalMat);
  m.position.set(x, 0.09 + Math.random() * 0.01, z); m.scale.setScalar(start);
  scene.add(m);
  decals.push({ m, target, life: 60 });
  if (decals.length > 80) { const d = decals.shift(); scene.remove(d.m); }
}

const lineMat = new THREE.LineBasicMaterial({ color: 0xfff3a0 });
export function tracer(a, b) {
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, b.y, b.z)]);
  const l = new THREE.Line(g, lineMat);
  scene.add(l); tracers.push({ l, life: 0.06 });
}

export function explosion(x, y, z) {
  const m = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: 0xffa726, transparent: true, opacity: 1 }));
  m.position.set(x, y + 1, z); scene.add(m);
  booms.push({ m, t: 0 });
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Mesh(sphere, smokeMat);
    s.position.set(x + (Math.random() - 0.5) * 3, y + 1, z + (Math.random() - 0.5) * 3); s.scale.setScalar(0.8 + Math.random());
    scene.add(s);
    parts.push({ m: s, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 3, vz: (Math.random() - 0.5) * 3, life: 2.5, kind: 'smoke' });
  }
  for (let i = 0; i < 12; i++) {
    const d = new THREE.Mesh(box, fireMat); d.scale.setScalar(0.2 + Math.random() * 0.25);
    d.position.set(x, y + 1, z); scene.add(d);
    parts.push({ m: d, vx: (Math.random() - 0.5) * 16, vy: 4 + Math.random() * 8, vz: (Math.random() - 0.5) * 16, life: 1.2, kind: 'debris' });
  }
}

// Fire that sits on a burning car until stopped.
export function startFire(obj) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(box, fireMat); f.position.set((Math.random() - 0.5) * 1.2, 1.2, (Math.random() - 0.5) * 2); g.add(f); }
  obj.add(g); fires.push(g);
  return g;
}
export function stopFire(g) { if (!g) return; g.parent && g.parent.remove(g); const i = fires.indexOf(g); if (i >= 0) fires.splice(i, 1); }

export function updateFx(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.kind === 'smoke') { p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt; p.m.scale.multiplyScalar(1 + dt * 0.6); }
    else {
      p.vy -= 18 * dt;
      p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
      if (p.m.position.y < 0.05) {
        if (p.kind === 'blood' && Math.random() < 0.5) addDecal(p.m.position.x, p.m.position.z, 0.15 + Math.random() * 0.25, 0);
        p.life = 0;
      }
    }
    if (p.life <= 0) { scene.remove(p.m); parts.splice(i, 1); }
  }
  for (let i = decals.length - 1; i >= 0; i--) {
    const d = decals[i];
    if (d.target && d.m.scale.x < d.target) d.m.scale.setScalar(Math.min(d.target, d.m.scale.x + dt * 0.4));
    d.life -= dt;
    if (d.life <= 0) { scene.remove(d.m); decals.splice(i, 1); }
  }
  for (let i = tracers.length - 1; i >= 0; i--) {
    tracers[i].life -= dt;
    if (tracers[i].life <= 0) { scene.remove(tracers[i].l); tracers[i].l.geometry.dispose(); tracers.splice(i, 1); }
  }
  for (let i = booms.length - 1; i >= 0; i--) {
    const b = booms[i]; b.t += dt;
    b.m.scale.setScalar(1 + b.t * 14);
    b.m.material.opacity = Math.max(0, 1 - b.t * 2.2);
    if (b.t > 0.5) { scene.remove(b.m); b.m.material.dispose(); booms.splice(i, 1); }
  }
  for (const g of fires) g.children.forEach((f) => { const s = 0.3 + Math.random() * 0.5; f.scale.set(s, s * 1.6, s); });
}

// ---------- sound (synthesized, no files) ----------
let ac = null, noise = null;
export function unlockAudio() {
  if (ac) { ac.resume(); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    noise = ac.createBuffer(1, ac.sampleRate * 1.5, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { ac = null; }
}
function burst(dur, freq, vol) {
  if (!ac || vol <= 0.01) return;
  const src = ac.createBufferSource(); src.buffer = noise;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  src.connect(f); f.connect(g); g.connect(ac.destination);
  src.start(); src.stop(ac.currentTime + dur);
}
const fall = (dist) => Math.max(0, 1 - dist / 140);
export function soundShot(kind, dist = 0) {
  const v = fall(dist);
  if (kind === 'shotgun') burst(0.35, 2200, 0.9 * v);
  else if (kind === 'rifle') burst(0.25, 3500, 0.8 * v);
  else if (kind === 'smg') burst(0.08, 4000, 0.45 * v);
  else burst(0.15, 3000, 0.6 * v);
}
export function soundBoom(dist = 0) { burst(1.4, 500, 1.2 * fall(dist * 0.6)); }
export function soundHit() { burst(0.06, 900, 0.4); }
