// Vehicles built from the Blender models (assets/src/cars.py -> assets/models/cars.glb).
// Each type is a node "car_<key>" whose children are named "<key>__<part>": body, cabin, doors,
// hood, trunk, bumpers, details, interior, cargo, rotor... plus empties for wheels (w_FL...), seats
// (seat_D...) and lamps (lamp_head_L...). Paint, glass and lamps get game materials; everything
// else keeps the shared materials from the file.
import * as THREE from 'three';
import { gltf } from './assets.js';

export const KEYS = ['sedan', 'sports', 'truck', 'van', 'bike', 'scooter', 'police', 'bus', 'boat', 'heli', 'hatch', 'suv', 'pickup', 'minivan',
  'muscle', 'convertible', 'limo', 'monster', 'taxi', 'garbage', 'tow', 'ambulance', 'fire'];
const SECOND = { police: 0xf2f2f0, truck: 0xf2f2f0, ambulance: 0xf4f4f4, garbage: 0x2e7d32, bus: 0xf2f2f0, boat: 0xf4f4f4, heli: 0xf4f4f4, fire: 0xd8d8d8 };
let T = null;
function templates() {
  if (T) return T;
  const g = gltf('cars'); if (!g) return null;
  T = { types: new Map(), wheel: null };
  for (const c of g.scene.children) {
    if (c.name.startsWith('car_')) T.types.set(c.name.slice(4), c);
    else if (c.name === 'wheel') T.wheel = c;
  }
  return T;
}
export const hasCarModels = () => !!templates();

// ---------- materials ----------
const paints = new Map();
// glossy paint with a little dirt: level 0 clean .. 3 grimy (darker, rougher, browner low down)
export function paintMaterial(color, dirt = 0) {
  const key = color * 4 + dirt;
  let m = paints.get(key);
  if (!m) {
    const c = new THREE.Color(color);
    if (dirt) c.lerp(new THREE.Color(0x6b5a45), dirt * 0.07);
    m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.3 + dirt * 0.12, metalness: 0.12, envMapIntensity: 0.9 - dirt * 0.15 });
    if (dirt) {
      const k = dirt * 0.18;
      m.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vDirtY;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvDirtY = position.y;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vDirtY;')
          .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nfloat dk = ${k.toFixed(3)} * (1.0 - smoothstep(0.2, 0.75, vDirtY));\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.32, 0.27, 0.2), dk);\nroughnessFactor = mix(roughnessFactor, 0.9, dk);`);
      };
      m.customProgramCacheKey = () => 'dirt' + dirt;
    }
    paints.set(key, m);
  }
  return m;
}
export const GLASS = new THREE.MeshStandardMaterial({ color: 0x1a232c, roughness: 0.04, metalness: 0.4, transparent: true, opacity: 0.5, envMapIntensity: 1.6, depthWrite: false });
export const LAMP = {
  headOff: new THREE.MeshStandardMaterial({ color: 0xdfe4ea, roughness: 0.08, metalness: 0.6, envMapIntensity: 1.5 }),
  headOn: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d0, emissiveIntensity: 2.2, roughness: 0.1 }),
  tailOff: new THREE.MeshStandardMaterial({ color: 0x7a0c0c, roughness: 0.15, metalness: 0.3, envMapIntensity: 1.2 }),
  tailOn: new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff1010, emissiveIntensity: 1.1, roughness: 0.2 }),
  // braking: clearly brighter than plain tail lights, so the lens itself flares up (bloom does the glow)
  tailBrake: new THREE.MeshStandardMaterial({ color: 0xff3030, emissive: 0xff1a12, emissiveIntensity: 3.2, roughness: 0.2 }),
};
let decalTex = null;
// one small atlas: plate, taxi sign, ambulance stripe and cross, tow hazard stripes, bus sign (glTF UVs: v=0 at the top)
function decals() {
  if (decalTex) return decalTex;
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 512, 512);
  // Blender uvbox (u0,v0,u1,v1) -> canvas x = u*512, y = (1 - v)*512
  const R = (u0, v0, u1, v1) => [u0 * 512, (1 - v1) * 512, (u1 - u0) * 512, (v1 - v0) * 512];
  let [x, y, w, h] = R(0, 0, 0.5, 0.25); // Iowa-style plate
  g.fillStyle = '#f4f1e6'; g.fillRect(x, y, w, h); g.fillStyle = '#2a4e8a'; g.fillRect(x, y, w, h * 0.22);
  g.fillStyle = '#fff'; g.font = `bold ${h * 0.16}px Arial`; g.textAlign = 'center'; g.fillText('IOWA', x + w / 2, y + h * 0.17);
  g.fillStyle = '#16233d'; g.font = `bold ${h * 0.42}px Arial Narrow, Arial`; g.fillText('TIM 2026', x + w / 2, y + h * 0.75);
  [x, y, w, h] = R(0.5, 0.75, 1, 1); // taxi roof sign
  g.fillStyle = '#ffd23a'; g.fillRect(x, y, w, h); g.fillStyle = '#111'; g.font = `900 ${h * 0.55}px Arial Black, Arial`; g.fillText('TAXI', x + w / 2, y + h * 0.72);
  [x, y, w, h] = R(0, 0.25, 0.5, 0.5); // ambulance stripe
  g.fillStyle = '#d32f2f'; g.fillRect(x, y, w, h); g.fillStyle = '#fff'; g.font = `900 ${h * 0.5}px Arial Black, Arial`; g.fillText('AMBULANCE', x + w / 2, y + h * 0.68);
  [x, y, w, h] = R(0.5, 0.25, 0.75, 0.5); // star-ish cross
  g.fillStyle = '#fff'; g.fillRect(x, y, w, h); g.fillStyle = '#1e5fbf';
  for (const r of [0, Math.PI / 3, -Math.PI / 3]) { g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(r); g.fillRect(-w * 0.1, -h * 0.42, w * 0.2, h * 0.84); g.restore(); }
  [x, y, w, h] = R(0.75, 0.25, 1, 0.5); // hazard stripes
  g.fillStyle = '#f6c21c'; g.fillRect(x, y, w, h); g.fillStyle = '#111';
  for (let k = -4; k < 8; k++) { g.beginPath(); g.moveTo(x + k * 20, y + h); g.lineTo(x + k * 20 + 10, y + h); g.lineTo(x + k * 20 + 10 + h, y); g.lineTo(x + k * 20 + h, y); g.fill(); }
  [x, y, w, h] = R(0, 0.5, 1, 0.625); // bus destination
  g.fillStyle = '#111'; g.fillRect(x, y, w, h); g.fillStyle = '#ffb300'; g.font = `bold ${h * 0.6}px monospace`; g.fillText('12  ARNETT AVE', x + w / 2, y + h * 0.72);
  decalTex = new THREE.CanvasTexture(c); decalTex.colorSpace = THREE.SRGBColorSpace; decalTex.flipY = false; decalTex.anisotropy = 4;
  return decalTex;
}
const DECAL = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.1 });

// ---------- build one vehicle mesh ----------
const WHEEL_R = 0.33;
export function buildCarMesh(ti, color, opts = {}) {
  const t = templates(); if (!t) return null;
  const key = KEYS[ti], src = t.types.get(key); if (!src) return null;
  if (!DECAL.map) DECAL.map = decals();
  const dirt = opts.dirt ?? 0;
  if (key === 'police') color = 0x15171b; // black and white
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const root = src.clone(true);
  root.position.set(0, 0, 0);
  body.add(root);
  const parts = { model: true, wheels: [], seats: {}, lamps: { head: [], tail: [] }, meshes: [], lampMeshes: [], glass: [], key, parts: {} };
  const glassMat = GLASS; // replaced by a per-car copy the first time it cracks
  parts.glassMat = glassMat;
  const p1 = paintMaterial(color, dirt), p2 = paintMaterial(SECOND[key] ?? 0xf2f2f0, dirt);
  for (const c of [...root.children]) {
    const part = c.name.split('__')[1] || c.name;
    if (!c.isMesh && !c.isGroup && c.children.length === 0) {
      // empties: wheels, seats, lamps
      const p = c.position;
      if (part.startsWith('w_')) parts.wheels.push(makeWheel(t.wheel, p, part, key));
      else if (part.startsWith('seat_')) parts.seats[part.slice(5)] = p.clone();
      else if (part.startsWith('lamp_head')) parts.lamps.head.push([p.x, p.y, p.z]);
      else if (part.startsWith('lamp_tail')) parts.lamps.tail.push([p.x, p.y, p.z]);
      root.remove(c);
      continue;
    }
    parts.parts[part] = c;
    c.traverse((m) => {
      if (!m.isMesh) return;
      m.castShadow = true; m.receiveShadow = false;
      const n = m.material.name;
      if (n === 'paint') m.material = p1;
      else if (n === 'paint2') m.material = p2;
      else if (n === 'glass') { m.material = glassMat; parts.glass.push(m); m.castShadow = false; m.renderOrder = 2; }
      else if (n === 'lamp_head') { m.material = LAMP.headOff; parts.lampMeshes.push([m, 'head']); }
      else if (n === 'lamp_tail') { m.material = LAMP.tailOff; parts.lampMeshes.push([m, 'tail']); }
      else if (n === 'decal' || n === 'plate') m.material = DECAL;
      else if (n === 'interior') m.castShadow = false;
      parts.meshes.push(m);
    });
  }
  for (const w of parts.wheels) body.add(w);
  const P = parts.parts;
  parts.hood = P.hood; parts.trunk = P.trunk; parts.bumpF = P.bumpF; parts.bumpR = P.bumpR;
  parts.doorL = P.doorL; parts.doorR = P.doorR; parts.doorL2 = P.doorL2; parts.doorR2 = P.doorR2;
  if (key === 'monster') { for (const c of root.children) c.position.y += 0.95; for (const w of parts.wheels) { w.scale.multiplyScalar(2.3); w.position.y = 0.95; w.position.x *= 1.12; } for (const k in parts.seats) parts.seats[k].y += 0.95; }
  if (P.rotor) g.userData.rotor = P.rotor;
  // light bars (police, ambulance, fire) get flare spots on the roof
  if (key === 'police' || key === 'ambulance' || key === 'fire') {
    const box = new THREE.Box3().setFromObject(P.cabin || P.body || root);
    const y = box.max.y + 0.12, z = key === 'police' ? (box.min.z + box.max.z) / 2 : box.max.z - 0.35;
    g.userData.lights = [{ color: { setHex() {} } }, { color: { setHex() {} } }]; // the old light-bar API (now drawn by carlights.js)
    parts.lamps.bar = [[0.35, y, z], [-0.35, y, z]];
  }
  // a stand-in for the old "driver head" (people are seated in cars by main.js now)
  const head = new THREE.Object3D(); head.visible = false; body.add(head);
  g.userData.driverHead = head;
  g.userData.body = body;
  g.userData.parts = parts;
  g.userData.lamps = { head: parts.lamps.head, tail: parts.lamps.tail, bar: parts.lamps.bar || null, size: ti === 4 || ti === 5 ? 0.9 : 1.25 };
  return g;
}
function makeWheel(src, p, part, key) {
  const w = new THREE.Group(); // steering pivot
  const spin = src.clone(true); spin.position.set(0, 0, 0);
  w.add(spin); w.userData.spin = spin;
  const r = Math.max(0.2, p.y);
  let sx = r / WHEEL_R, sw = sx;
  if (key === 'bike' || key === 'scooter') sw = 0.4;
  else if (['truck', 'bus', 'garbage', 'tow', 'ambulance', 'fire'].includes(key)) sw = sx * 0.95;
  spin.scale.set(sw, sx, sx);
  w.position.copy(p);
  w.userData.front = part.includes('F');
  w.userData.r = r;
  spin.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return w;
}

// headlights / tail lamps glow when the lights are on, brighter when braking (swapped per car only when it changes)
export function setCarLamps(v, on, braking) {
  const P = v.mesh.userData.parts; if (!P || !P.lampMeshes) return;
  const hs = on ? 1 : 0, ts = braking ? 2 : on ? 1 : 0, st = hs * 3 + ts;
  if (P.lampState === st) return;
  P.lampState = st;
  const tail = v.brokenTail ? LAMP.tailOff : [LAMP.tailOff, LAMP.tailOn, LAMP.tailBrake][ts];
  for (const [m, kind] of P.lampMeshes) m.material = kind === 'head' ? (hs && !v.brokenHead ? LAMP.headOn : LAMP.headOff) : tail;
}

// spin the wheels and turn the front ones
export function animateWheels(v, dt) {
  const P = v.mesh.userData.parts; if (!P || !P.model) return;
  const yawRate = v.prevH === undefined ? 0 : ((v.h - v.prevH + Math.PI * 3) % (Math.PI * 2) - Math.PI) / Math.max(dt, 1e-3);
  v.prevH = v.h;
  const sp = v.speed || 0;
  const steer = v.steerIn !== undefined && v.steerIn !== null ? -v.steerIn * 0.5 : Math.max(-0.5, Math.min(0.5, yawRate * v.T.len * 0.5 / Math.max(2, Math.abs(sp)) * Math.sign(sp || 1)));
  v.steerVis = (v.steerVis || 0) + (steer - (v.steerVis || 0)) * Math.min(1, dt * 8);
  for (const w of P.wheels) {
    if (w.userData.y0 === undefined) w.userData.y0 = w.position.y;
    w.position.y = w.userData.y0 - (v.sy || 0); // wheels stay on the road while the body bounces
    w.userData.spin.rotation.x += (sp * dt) / w.userData.r;
    if (w.userData.front) w.rotation.y = v.steerVis;
  }
}

// ---------- damage: dents, a crumpled hood ----------
// A dented mesh gets its own copy of the geometry plus the factory positions / normals, so repair can undo it.
function own(m) {
  if (m.userData.pos0) return;
  m.geometry = m.geometry.clone(); m.userData.own = true;
  m.userData.pos0 = m.geometry.attributes.position.array.slice();
  if (m.geometry.attributes.normal) m.userData.nrm0 = m.geometry.attributes.normal.array.slice();
}
const tmp = new THREE.Vector3(), dir = new THREE.Vector3();
const MAX_DENT = 0.4; // no point sinks further than this from where it started, however many hits
// push vertices of every panel near car-local point (lx, ly, lz) inward along (nx, ny, nz), with falloff
export function dent(v, lx, ly, lz, nx, nz, depth, radius = 1.0, ny = -0.15) {
  const P = v.mesh.userData.parts; if (!P || !P.model) return;
  const root = v.mesh.userData.body.children[0];
  root.updateWorldMatrix(true, true);
  for (const m of P.meshes) {
    if (!m.parent || m.material.name === 'interior') continue;
    tmp.set(lx, ly, lz); root.localToWorld(tmp); m.worldToLocal(tmp);
    dir.set(lx + nx, ly + ny, lz + nz); root.localToWorld(dir); m.worldToLocal(dir); dir.sub(tmp).normalize(); // push direction in this mesh's frame
    const g = m.geometry;
    if (!g.boundingSphere) g.computeBoundingSphere();
    if (g.boundingSphere.center.distanceTo(tmp) > g.boundingSphere.radius + radius) continue;
    own(m);
    const pos = m.geometry.attributes.position, a = pos.array, o = m.userData.pos0, r2 = radius * radius;
    let moved = false;
    for (let i = 0; i < pos.count; i++) {
      const i3 = i * 3, dx = a[i3] - tmp.x, dy = a[i3 + 1] - tmp.y, dz = a[i3 + 2] - tmp.z, d2 = dx * dx + dy * dy * 0.6 + dz * dz;
      if (d2 > r2) continue;
      const k = (1 - d2 / r2) * depth * (0.8 + Math.random() * 0.4);
      let ex = a[i3] + dir.x * k - o[i3], ey = a[i3 + 1] + dir.y * k - o[i3 + 1], ez = a[i3 + 2] + dir.z * k - o[i3 + 2];
      const e = Math.hypot(ex, ey, ez);
      if (e > MAX_DENT) { const c = MAX_DENT / e; ex *= c; ey *= c; ez *= c; }
      a[i3] = o[i3] + ex; a[i3 + 1] = o[i3 + 1] + ey; a[i3 + 2] = o[i3 + 2] + ez;
      moved = true;
    }
    if (moved) { pos.needsUpdate = true; m.geometry.computeVertexNormals(); }
  }
}
// The hood folds as the front caves in (amt 0..1, absolute): it shortens and buckles up in the middle.
export function crumple(v, amt) {
  const P = v.mesh.userData.parts, hood = P && P.hood; if (!hood || !v.mesh.visible) return;
  hood.traverse((m) => {
    if (!m.isMesh) return;
    const d = amt - (m.userData.crumple || 0); if (d < 0.02) return;
    own(m); m.userData.crumple = amt;
    const a = m.geometry.attributes.position.array, o = m.userData.pos0;
    let z0 = Infinity, z1 = -Infinity;
    for (let i = 2; i < o.length; i += 3) { z0 = Math.min(z0, o[i]); z1 = Math.max(z1, o[i]); }
    const L = z1 - z0 || 1;
    for (let i = 0; i < a.length; i += 3) {
      const t = (o[i + 2] - z0) / L; // 0 at the windshield, 1 at the nose
      a[i + 1] += d * Math.sin(Math.PI * t) * 0.16 * L;
      a[i + 2] -= d * t * 0.3 * L;
    }
    m.geometry.attributes.position.needsUpdate = true; m.geometry.computeVertexNormals();
  });
}
// back to factory shape (Arnett Auto)
export function unDent(v) {
  v.mesh.userData.body.traverse((m) => {
    const o = m.userData && m.userData.pos0; if (!o) return;
    const g = m.geometry; g.attributes.position.array.set(o); g.attributes.position.needsUpdate = true;
    if (m.userData.nrm0) { g.attributes.normal.array.set(m.userData.nrm0); g.attributes.normal.needsUpdate = true; }
    m.userData.crumple = 0;
  });
}
