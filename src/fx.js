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
        if (p.kind === 'glass') { p.m.position.y = 0.06; p.vx = p.vy = p.vz = 0; }
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
export function soundShot(kind, dist = 0) {
  const v = fall(dist);
  if (kind === 'shotgun') burst(0.35, 2200, 0.9 * v);
  else if (kind === 'rifle') burst(0.25, 3500, 0.8 * v);
  else if (kind === 'smg') burst(0.08, 4000, 0.45 * v);
  else burst(0.15, 3000, 0.6 * v);
}
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
  }
  const t = ac.currentTime;
  amb.hum.gain.setTargetAtTime(0.05 * v.hum, t, 0.5);
  amb.rain.gain.setTargetAtTime(0.12 * v.rain, t, 0.5);
  // waves swell and fade
  amb.waves.gain.setTargetAtTime(0.09 * v.waves * (0.6 + 0.4 * Math.sin(t * 0.7)), t, 0.4);
  amb.crickets.gain.setTargetAtTime(0.006 * v.crickets, t, 0.8);
  if (v.birds > 0.2 && Math.random() < 0.02 * v.birds) { const f = 2400 + Math.random() * 1800; tone('sine', f, 0.08, 0.025 * v.birds); tone('sine', f * 1.2, 0.07, 0.02 * v.birds, 0.09); }
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
