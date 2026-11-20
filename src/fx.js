// Visual + sound effects: blood, tracers, explosions, fire. All local-only.
import * as THREE from 'three';
import { isLand, groundHeight, pushOutCircle } from './world.js';

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

let skids;
const SKIDS = 500;
let skidI = 0;
export function initFx(s) {
  scene = s;
  skids = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.01, 0.5), new THREE.MeshBasicMaterial({ color: 0x1c1c1c, transparent: true, opacity: 0.55, depthWrite: false }), SKIDS);
  const o = new THREE.Object3D(); o.position.set(0, -50, 0); o.updateMatrix();
  for (let i = 0; i < SKIDS; i++) skids.setMatrixAt(i, o.matrix);
  skids.frustumCulled = false;
  scene.add(skids);
}
const so = new THREE.Object3D();
// A short dark tire mark under a wheel.
export function skid(x, z, h, y = 0) {
  so.position.set(x, y + 0.075, z); so.rotation.set(0, h, 0); so.updateMatrix();
  skids.setMatrixAt(skidI, so.matrix); skids.instanceMatrix.needsUpdate = true;
  skidI = (skidI + 1) % SKIDS;
}
const lightSmoke = new THREE.MeshLambertMaterial({ color: 0xdddddd, transparent: true, opacity: 0.55 });
export function smokePuff(x, y, z, light = false, size = 0.6) {
  if (parts.length > 260) return;
  const s = new THREE.Mesh(sphere, light ? lightSmoke : smokeMat);
  s.position.set(x, y, z); s.scale.setScalar(size);
  scene.add(s);
  parts.push({ m: s, vx: (Math.random() - 0.5) * 0.8, vy: 1 + Math.random(), vz: (Math.random() - 0.5) * 0.8, life: 1.4, kind: 'smoke' });
}
// Gray smoke from the hood of a badly damaged vehicle.
export function damageSmoke(v) {
  if (Math.random() > 0.15) return;
  smokePuff(v.x + Math.sin(v.h) * v.T.len * 0.35, v.y + v.T.hgt, v.z + Math.cos(v.h) * v.T.len * 0.35, false, 0.4);
}
const flashMat = new THREE.MeshBasicMaterial({ color: 0xffe082 });
const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd54f });
const glassMat = new THREE.MeshLambertMaterial({ color: 0xcfefff, transparent: true, opacity: 0.8 });
export function sparks(x, y, z, n = 10, dx = 0, dz = 0) {
  for (let i = 0; i < n && parts.length < 300; i++) {
    const m = new THREE.Mesh(box, sparkMat); m.scale.set(0.05, 0.05, 0.2);
    m.position.set(x, y, z); scene.add(m);
    parts.push({ m, vx: dx * 4 + (Math.random() - 0.5) * 9, vy: 1 + Math.random() * 4, vz: dz * 4 + (Math.random() - 0.5) * 9, life: 0.35 + Math.random() * 0.3, kind: 'spark' });
  }
}
const dropMat = new THREE.MeshBasicMaterial({ color: 0xc8d6e0, transparent: true, opacity: 0.55, depthWrite: false });
// Spray thrown up by a tire through a puddle.
export function splash(x, y, z, vx, vz, n = 4) {
  for (let i = 0; i < n && parts.length < 300; i++) {
    const m = new THREE.Mesh(box, dropMat); m.scale.setScalar(0.06 + Math.random() * 0.06);
    m.position.set(x, y + 0.1, z); scene.add(m);
    parts.push({ m, vx: vx * 0.3 + (Math.random() - 0.5) * 3, vy: 1.5 + Math.random() * 2.5, vz: vz * 0.3 + (Math.random() - 0.5) * 3, life: 0.6, kind: 'spark' });
  }
}
export function glass(x, y, z, n = 12) {
  for (let i = 0; i < n && parts.length < 300; i++) {
    const m = new THREE.Mesh(box, glassMat); const s = 0.04 + Math.random() * 0.08; m.scale.set(s, 0.01, s);
    m.position.set(x + (Math.random() - 0.5), y, z + (Math.random() - 0.5)); scene.add(m);
    parts.push({ m, vx: (Math.random() - 0.5) * 5, vy: 1 + Math.random() * 3, vz: (Math.random() - 0.5) * 5, life: 6, kind: 'glass' });
  }
}
// Loose car parts (bumpers, hoods, wheels) that tumble and then lie in the road for a while.
export const debrisList = [];
export function debris(m, vx, vy, vz) {
  scene.add(m);
  debrisList.push({ m, vx, vy, vz, wx: (Math.random() - 0.5) * 8, wz: (Math.random() - 0.5) * 8, life: 40, rest: false });
  if (debrisList.length > 40) { const d = debrisList.shift(); scene.remove(d.m); }
}
// ---------- gunfight detail: bullet holes, wall blood, impact dust, shell casings ----------
function splatTex(kind) {
  const n = 64, c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d');
  if (kind === 'hole') {
    let gr = g.createRadialGradient(32, 32, 0, 32, 32, 30); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.18, 'rgba(10,10,10,1)'); gr.addColorStop(0.3, 'rgba(60,60,60,0.7)'); gr.addColorStop(1, 'rgba(60,60,60,0)');
    g.fillStyle = gr; g.fillRect(0, 0, n, n);
  } else {
    g.fillStyle = 'rgba(110,0,0,0.92)';
    for (let k = 0; k < 14; k++) { const a = Math.random() * 7, r = Math.random() * 18; g.beginPath(); g.arc(32 + Math.cos(a) * r, 32 + Math.sin(a) * r, 3 + Math.random() * 9, 0, 7); g.fill(); }
    for (let k = 0; k < 7; k++) { const a = Math.random() * 7; g.beginPath(); g.ellipse(32 + Math.cos(a) * 22, 32 + Math.sin(a) * 22, 1.5, 4, a, 0, 7); g.fill(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const marks = {};
function markPool(kind, size) {
  if (marks[kind]) return marks[kind];
  const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: splatTex(kind), transparent: true, depthWrite: false, roughness: kind === 'hole' ? 0.9 : 0.3, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), 160);
  m.count = 0; m.frustumCulled = false; scene.add(m);
  return (marks[kind] = { m, i: 0 });
}
const mo = new THREE.Object3D(), nrm = new THREE.Vector3(), zAxis = new THREE.Vector3(0, 0, 1);
// a mark on a surface at p facing along normal n (bullet hole or blood splatter)
export function mark(kind, p, n, scale = 1) {
  const pool = markPool(kind, kind === 'hole' ? 0.12 : 0.9);
  nrm.set(n.x, n.y, n.z).normalize();
  mo.position.set(p.x + nrm.x * 0.01, p.y + nrm.y * 0.01, p.z + nrm.z * 0.01);
  mo.quaternion.setFromUnitVectors(zAxis, nrm); mo.rotateZ(Math.random() * 6.28);
  mo.scale.setScalar(scale * (0.8 + Math.random() * 0.5)); mo.updateMatrix();
  pool.m.setMatrixAt(pool.i, mo.matrix); pool.i = (pool.i + 1) % 160; pool.m.count = Math.max(pool.m.count, pool.i === 0 ? 160 : pool.i);
  pool.m.instanceMatrix.needsUpdate = true;
}
const dustMat = new THREE.MeshLambertMaterial({ color: 0xb8ae9c, transparent: true, opacity: 0.32, depthWrite: false });
// a bullet hitting something: kind 'wall' | 'ground' | 'metal'
export function impact(p, n, kind) {
  if (kind === 'metal') { sparks(p.x, p.y, p.z, 6, n.x * 0.5, n.z * 0.5); return; }
  for (let i = 0; i < 4 && parts.length < 300; i++) {
    const s = new THREE.Mesh(sphere, dustMat); s.position.set(p.x, p.y, p.z); s.scale.setScalar(0.025 + Math.random() * 0.025); scene.add(s);
    parts.push({ m: s, vx: n.x * 1.2 + (Math.random() - 0.5) * 0.6, vy: n.y * 1.2 + 0.3 + Math.random() * 0.4, vz: n.z * 1.2 + (Math.random() - 0.5) * 0.6, life: 0.4, kind: 'smoke' });
  }
  for (let i = 0; i < 3 && parts.length < 300; i++) {
    const m = new THREE.Mesh(box, dustMat); m.scale.setScalar(0.025); m.position.set(p.x, p.y, p.z); scene.add(m);
    parts.push({ m, vx: n.x * 3 + (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 2, vz: n.z * 3 + (Math.random() - 0.5) * 3, life: 0.5, kind: 'spark' });
  }
  mark('hole', p, n);
}
// brass flying out of the gun, bouncing on the ground
let casingGeo = null;
const casingMat = new THREE.MeshStandardMaterial({ color: 0xc89a3a, metalness: 0.9, roughness: 0.3 });
export function setCasingGeometry(g) { casingGeo = g; }
export function casing(p, side) {
  if (parts.length > 280) return;
  const m = new THREE.Mesh(casingGeo || box, casingMat); if (!casingGeo) m.scale.set(0.01, 0.02, 0.01);
  m.position.set(p.x, p.y, p.z); scene.add(m);
  parts.push({ m, vx: side.x * (1.5 + Math.random()) , vy: 1.6 + Math.random(), vz: side.z * (1.5 + Math.random()), life: 1.6, kind: 'casing', spin: 20 });
}
export function muzzleFlash(p) {
  const m = new THREE.Mesh(sphere, flashMat);
  m.position.set(p.x, p.y, p.z); m.scale.setScalar(0.18);
  scene.add(m);
  tracers.push({ l: m, life: 0.05, mesh: true });
}

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
  m.position.set(x, groundHeight(x, z) + 0.01 + Math.random() * 0.01, z); m.scale.setScalar(start);
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
      if (p.spin) { p.m.rotation.x += p.spin * dt; p.m.rotation.z += p.spin * 0.7 * dt; }
      p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
      if (p.gy === undefined) p.gy = groundHeight(p.m.position.x, p.m.position.z);
      if (p.m.position.y < p.gy + 0.05) {
        if (p.kind === 'blood' && Math.random() < 0.5) addDecal(p.m.position.x, p.m.position.z, 0.15 + Math.random() * 0.25, 0);
        if (p.kind === 'glass') { p.m.position.y = p.gy + 0.06; p.vx = p.vy = p.vz = 0; }
        else if (p.kind === 'casing' && p.vy < -1) { p.m.position.y = p.gy + 0.05; p.vy = -p.vy * 0.35; p.vx *= 0.5; p.vz *= 0.5; if (Math.random() < 0.3) tink(); }
        else if (p.kind === 'casing') { p.m.position.y = p.gy + 0.02; p.vx = p.vy = p.vz = 0; p.spin = 0; }
        else p.life = 0;
      }
    }
    if (p.life <= 0) { scene.remove(p.m); parts.splice(i, 1); }
  }
  for (let i = debrisList.length - 1; i >= 0; i--) {
    const d = debrisList[i];
    d.life -= dt;
    if (d.life <= 0) { scene.remove(d.m); debrisList.splice(i, 1); continue; }
    if (d.rest) continue;
    d.vy -= 20 * dt;
    d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.position.z += d.vz * dt;
    d.m.rotation.x += d.wx * dt; d.m.rotation.z += d.wz * dt;
    const pp = pushOutCircle(d.m.position.x, d.m.position.z, 0.3);
    if (pp.hit) { d.m.position.x = pp.x; d.m.position.z = pp.z; d.vx *= -0.4; d.vz *= -0.4; }
    const land = isLand(d.m.position.x, d.m.position.z);
    const gy = land ? groundHeight(d.m.position.x, d.m.position.z) + 0.15 : -1.5;
    if (d.m.position.y < gy) {
      d.m.position.y = gy; d.vy = -d.vy * 0.3; d.vx *= 0.6; d.vz *= 0.6; d.wx *= 0.5; d.wz *= 0.5;
      if (Math.abs(d.vy) < 0.8 && Math.hypot(d.vx, d.vz) < 0.5) { d.rest = true; d.m.rotation.x = Math.round(d.m.rotation.x / Math.PI) * Math.PI; d.m.rotation.z = Math.round(d.m.rotation.z / Math.PI) * Math.PI; }
    }
  }
  for (let i = decals.length - 1; i >= 0; i--) {
    const d = decals[i];
    if (d.target && d.m.scale.x < d.target) d.m.scale.setScalar(Math.min(d.target, d.m.scale.x + dt * 0.4));
    d.life -= dt;
    if (d.life <= 0) { scene.remove(d.m); decals.splice(i, 1); }
  }
  for (let i = tracers.length - 1; i >= 0; i--) {
    tracers[i].life -= dt;
    if (tracers[i].life <= 0) { scene.remove(tracers[i].l); if (!tracers[i].mesh) tracers[i].l.geometry.dispose(); tracers.splice(i, 1); }
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
let ac = null, noise = null, master = null, volume = 1;
// everything plays through one master volume
function out() { if (!master) { master = ac.createGain(); master.gain.value = volume; master.connect(ac.destination); } return master; }
export function setVolume(v) { volume = v; if (master) master.gain.value = v; }
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
  src.connect(f); f.connect(g); g.connect(out());
  src.start(); src.stop(ac.currentTime + dur);
}
const fall = (dist) => Math.max(0, 1 - dist / 140);
// Gunshots: a sharp crack, a noise body and a low thump, duller and quieter with distance, with an
// echo off the buildings when you're in a built-up street (echo 0..1 from main).
const GUN = { pistol: [0.6, 0.14, 3200, 95], smg: [0.45, 0.07, 3800, 110], shotgun: [1.0, 0.4, 2000, 70], rifle: [0.85, 0.22, 3600, 85], sniper: [1.0, 0.35, 3000, 60] };
let echoBus = null;
function echo() {
  if (echoBus) return echoBus;
  const d = ac.createDelay(1), fb = ac.createGain(), lp = ac.createBiquadFilter(), g = ac.createGain();
  d.delayTime.value = 0.13; fb.gain.value = 0.32; lp.type = 'lowpass'; lp.frequency.value = 1800; g.gain.value = 0;
  g.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(out());
  return (echoBus = g);
}
export let echoAmount = 0;
export function setEcho(e) { echoAmount = e; }
export function soundShot(kind, dist = 0) {
  if (!ac) return;
  const [vol, len, bright, thump] = GUN[kind] || GUN.pistol;
  const v = vol * Math.max(0, 1 - dist / 260), cut = bright * Math.max(0.15, 1 - dist / 180);
  if (v <= 0.01) return;
  const t = ac.currentTime;
  const src = ac.createBufferSource(); src.buffer = noise;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(cut * 1.6, t); f.frequency.exponentialRampToValueAtTime(cut * 0.35, t + len);
  const g = ac.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
  src.connect(f); f.connect(g); g.connect(out());
  const e = echo(), eg = ac.createGain(); eg.gain.value = echoAmount * 0.8; g.connect(eg); eg.connect(e); e.gain.value = 1;
  src.start(t, Math.random() * 0.5); src.stop(t + len + 0.05);
  // crack (close only) and thump
  if (dist < 60) { const c = ac.createBufferSource(); c.buffer = noise; const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500; const cg = ac.createGain(); cg.gain.setValueAtTime(v * 0.7 * (1 - dist / 60), t); cg.gain.exponentialRampToValueAtTime(0.001, t + 0.03); c.connect(hp); hp.connect(cg); cg.connect(out()); c.start(t); c.stop(t + 0.04); }
  const o = ac.createOscillator(), og = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(thump * 1.8, t); o.frequency.exponentialRampToValueAtTime(thump * 0.6, t + 0.12);
  og.gain.setValueAtTime(v * 0.8, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.connect(og); og.connect(out()); o.start(t); o.stop(t + 0.2);
}
export function tink() { tone('triangle', 3200 + Math.random() * 1500, 0.06, 0.03); }
export function soundBoom(dist = 0) { burst(1.4, 500, 1.2 * fall(dist * 0.6)); }
export function soundHit() { burst(0.06, 900, 0.4); }

function tone(type, freq, dur, vol, t0 = 0) {
  if (!ac || vol <= 0.01) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, ac.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t0 + dur);
  o.connect(g); g.connect(out());
  o.start(ac.currentTime + t0); o.stop(ac.currentTime + t0 + dur);
}
export function soundHorn(dist = 0) { const v = 0.18 * fall(dist * 1.5); tone('square', 392, 0.35, v); tone('square', 494, 0.35, v * 0.8); }
let lastCrunch = 0, lastScrape = 0, lastSqueal = 0;
export function soundCrunch(power = 1, dist = 0) {
  const now = performance.now();
  if (now - lastCrunch < 120) return;
  lastCrunch = now;
  const v = Math.min(1, power) * fall(dist);
  burst(0.5, 700, 0.9 * v); burst(0.18, 2600, 0.5 * v); tone('square', 90 + Math.random() * 60, 0.25, 0.12 * v);
}
export function soundScrape(dist = 0) {
  const now = performance.now();
  if (now - lastScrape < 90) return;
  lastScrape = now; burst(0.12, 5000, 0.18 * fall(dist));
}
export function soundSqueal(dist = 0) {
  const now = performance.now();
  if (now - lastSqueal < 140) return;
  lastSqueal = now; tone('sawtooth', 1150 + Math.random() * 120, 0.16, 0.035 * fall(dist));
}
export function soundThunder(power = 1) { burst(2.8, 260, 1.0 * power); setTimeout(() => burst(1.6, 180, 0.6 * power), 300); }

// Looping ambience: city hum, rain, waves, crickets at night, birds by day. vols: {hum, rain, waves, crickets, birds} 0..1
let amb = null;
function loopNoise(type, freq, q = 1) {
  const src = ac.createBufferSource(); src.buffer = noise; src.loop = true;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain(); g.gain.value = 0;
  src.connect(f); f.connect(g); g.connect(out()); src.start();
  return g;
}
export function setAmbient(v) {
  if (!ac) return;
  if (!amb) {
    amb = { hum: loopNoise('lowpass', 220), rain: loopNoise('highpass', 1800), waves: loopNoise('bandpass', 420, 0.6) };
    // crickets: a high tone chopped on and off very fast
    const o = ac.createOscillator(), am = ac.createOscillator(), amg = ac.createGain(), g = ac.createGain();
    o.frequency.value = 4400; am.frequency.value = 28; amg.gain.value = 0.5;
    const pulse = ac.createGain(); pulse.gain.value = 0.5;
    am.connect(amg); amg.connect(pulse.gain); o.connect(pulse); pulse.connect(g); g.gain.value = 0; g.connect(out());
    o.start(); am.start();
    amb.crickets = g; amb.birdT = 0;
    amb.crowd = loopNoise('bandpass', 700, 1.4); amb.wind = loopNoise('lowpass', 380, 0.7); amb.work = loopNoise('bandpass', 2300, 4);
  }
  const t = ac.currentTime;
  amb.hum.gain.setTargetAtTime(0.05 * v.hum, t, 0.5);
  amb.rain.gain.setTargetAtTime(0.12 * v.rain, t, 0.5);
  // waves swell and fade
  amb.waves.gain.setTargetAtTime(0.09 * v.waves * (0.6 + 0.4 * Math.sin(t * 0.7)), t, 0.4);
  amb.crickets.gain.setTargetAtTime(0.006 * v.crickets, t, 0.8);
  // crowd murmur, wind gusts in storms, a jackhammer/compressor near road crews
  amb.crowd.gain.setTargetAtTime(0.045 * (v.crowd || 0) * (0.75 + 0.25 * Math.sin(t * 1.3)), t, 0.6);
  amb.wind.gain.setTargetAtTime(0.11 * (v.wind || 0) * (0.5 + 0.5 * Math.sin(t * 0.37) * Math.sin(t * 0.91)), t, 0.4);
  amb.work.gain.setTargetAtTime(0.03 * (v.work || 0) * (Math.sin(t * 9) > 0 ? 1 : 0.3), t, 0.05);
  if ((v.sirens || 0) > 0 && Math.random() < 0.004 * v.sirens) farSiren();
  if (v.birds > 0.2 && Math.random() < 0.02 * v.birds) { const f = 2400 + Math.random() * 1800; tone('sine', f, 0.08, 0.025 * v.birds); tone('sine', f * 1.2, 0.07, 0.02 * v.birds, 0.09); }
}
// a siren somewhere across town (just a wailing tone, quiet)
function farSiren() {
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
  o.type = 'triangle'; o.frequency.setValueAtTime(650, t);
  for (let k = 0; k < 6; k++) { o.frequency.linearRampToValueAtTime(900, t + k * 0.9 + 0.45); o.frequency.linearRampToValueAtTime(650, t + k * 0.9 + 0.9); }
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.012, t + 1); g.gain.exponentialRampToValueAtTime(0.0001, t + 5.4);
  o.connect(g); g.connect(out()); o.start(t); o.stop(t + 5.5);
}
// footsteps: grass is soft, concrete taps, metal clangs, wood knocks, water splashes
export function footstep(kind, loud = 1) {
  if (!ac) return;
  const v = 0.08 * loud;
  if (kind === 'grass') burst(0.07, 900, v * 0.7);
  else if (kind === 'metal') { burst(0.04, 3500, v * 0.6); tone('square', 520 + Math.random() * 120, 0.05, v * 0.12); }
  else if (kind === 'wood') { burst(0.05, 1200, v * 0.7); tone('sine', 180 + Math.random() * 40, 0.06, v * 0.25); }
  else if (kind === 'water') burst(0.12, 1800, v * 0.9);
  else if (kind === 'snow') burst(0.09, 600, v * 0.8);
  else burst(0.035, 2600 + Math.random() * 600, v * 0.75);
}
// WASTED: a low boom with a falling, detuned chord over it.
export function soundWasted() {
  if (!ac) return;
  burst(1.6, 220, 0.9);
  for (const [f, d] of [[196, 0], [233, 0.02], [147, 0.04]]) {
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + 0.05 + d;
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.5, t + 2.4);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.15); g.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
    o.connect(lp); lp.connect(g); g.connect(out()); o.start(t); o.stop(t + 2.7);
  }
}
export function soundStunt() { [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, 0.18, 0.15, i * 0.08)); }
export function soundWanted() { tone('sawtooth', 220, 0.25, 0.08); tone('sawtooth', 330, 0.25, 0.08, 0.12); }

// Police siren: one looping wail whose volume follows the nearest cop.
let siren = null;
export function setSiren(vol) {
  if (!ac) return;
  if (!siren) {
    const o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain();
    o.type = 'sawtooth'; o.frequency.value = 760; lfo.frequency.value = 0.55; lg.gain.value = 260;
    lfo.connect(lg); lg.connect(o.frequency);
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
    g.gain.value = 0; o.connect(f); f.connect(g); g.connect(out());
    o.start(); lfo.start();
    siren = g;
  }
  siren.gain.setTargetAtTime(Math.max(0, Math.min(0.09, vol * 0.09)), ac.currentTime, 0.2);
}

export const audio = () => ({ ac, noise, out: ac ? out() : null });
export function soundGoal() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone('triangle', f, 0.22, 0.13, i * 0.09)); }
export function soundCash() { tone('square', 1318, 0.06, 0.06); tone('square', 1760, 0.08, 0.06, 0.06); }
export function soundGnome() { [880, 1108, 1318, 1760].forEach((f, i) => tone('sine', f, 0.25, 0.12, i * 0.07)); }
export function soundClick() { burst(0.03, 4000, 0.25); }
export function soundReload() { burst(0.05, 3000, 0.3); setTimeout(() => burst(0.06, 2000, 0.35), 350); }
export function soundNitro() { burst(0.6, 900, 0.3); }

// ---------- engine of the vehicle you're in: pitch follows rpm, a sound per type ----------
// profile: [base Hz at idle, Hz at redline, waveform, filter, lumpiness (V8 burble), volume]
const ENGINE = {
  car: [42, 160, 'sawtooth', 900, 0, 0.11], sports: [60, 260, 'sawtooth', 1800, 0.05, 0.12], muscle: [34, 150, 'sawtooth', 700, 0.5, 0.15],
  truck: [26, 90, 'sawtooth', 500, 0.15, 0.14], bike: [70, 330, 'square', 1500, 0.2, 0.09], scooter: [110, 420, 'square', 2200, 0, 0.06],
  heli: [9, 18, 'sawtooth', 300, 0.9, 0.2], boat: [55, 210, 'square', 1200, 0.1, 0.08],
};
let eng = null;
export function setEngine(kind, rpm, load) {
  if (!ac) return;
  if (!kind) { if (eng) eng.g.gain.setTargetAtTime(0, ac.currentTime, 0.15); return; }
  const P = ENGINE[kind] || ENGINE.car;
  if (!eng || eng.kind !== kind) {
    if (eng) { eng.g.gain.setTargetAtTime(0, ac.currentTime, 0.05); const old = eng; setTimeout(() => { try { old.o1.stop(); old.o2.stop(); old.lfo.stop(); } catch { /* already stopped */ } }, 400); }
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
    o1.type = P[2]; o2.type = 'triangle'; f.type = 'lowpass'; f.frequency.value = P[3]; f.Q.value = 2;
    lfo.type = 'square'; lg.gain.value = 0;
    o1.connect(f); o2.connect(f); f.connect(g); lfo.connect(lg); lg.connect(g.gain); g.gain.value = 0; g.connect(out());
    o1.start(); o2.start(); lfo.start();
    eng = { kind, o1, o2, f, g, lfo, lg };
  }
  const t = ac.currentTime, hz = P[0] + (P[1] - P[0]) * rpm;
  eng.o1.frequency.setTargetAtTime(hz, t, 0.05); eng.o2.frequency.setTargetAtTime(hz * 0.5, t, 0.05);
  eng.f.frequency.setTargetAtTime(P[3] * (0.6 + 0.8 * load + rpm * 0.6), t, 0.05);
  eng.lfo.frequency.setTargetAtTime(hz / 4, t, 0.05); eng.lg.gain.setTargetAtTime(P[4] * P[5] * 0.6, t, 0.05);
  eng.g.gain.setTargetAtTime(P[5] * (0.55 + 0.45 * load) * (0.7 + 0.3 * rpm), t, 0.05);
}
export function soundBackfire(dist = 0) { burst(0.09, 700, 0.55 * fall(dist)); setTimeout(() => burst(0.06, 500, 0.35 * fall(dist)), 70); }
const exhaustMat = new THREE.MeshLambertMaterial({ color: 0x9a9a9a, transparent: true, opacity: 0.35, depthWrite: false });
// a little puff from the tailpipe (dark when flooring it, fire on a backfire)
export function exhaust(x, y, z, vx, vz, flame = false) {
  if (parts.length > 270) return;
  const s = new THREE.Mesh(sphere, flame ? fireMat : exhaustMat); s.position.set(x, y, z); s.scale.setScalar(flame ? 0.12 : 0.08); scene.add(s);
  parts.push({ m: s, vx: vx * 0.2 + (Math.random() - 0.5) * 0.4, vy: 0.3 + Math.random() * 0.3, vz: vz * 0.2 + (Math.random() - 0.5) * 0.4, life: flame ? 0.12 : 0.8, kind: 'smoke' });
}
