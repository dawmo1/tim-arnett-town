// The e-bike and its docking station, from assets/models/ebike.glb (assets/src/ebike.py). Loaded on demand
// (not behind the loading screen); until it's in, vehicles.js draws its simple box bike instead.
// The bike follows the carmodel.js parts contract: userData.body > root, parts.wheels (steer pivot with a
// userData.spin child), parts.seats.D, lamps, plus parts.crank (spins round the bottom bracket) and the
// pedal / grip spots the rider is posed against (bike-local metres, facing +Z).
import * as THREE from 'three';
import { loadLazy } from './assets.js';
import { paintMaterial, GLASS, LAMP } from './carmodel.js';

let G = null, loading = null;
export function loadEbikeModel() {
  if (!loading) loading = loadLazy('ebike.glb').then((g) => {
    if (!g) return null;
    const T = { bike: null, wheel: null, dock: null };
    for (const c of g.scene.children) {
      if (c.name === 'car_ebike') T.bike = c;
      else if (c.name === 'ebike_wheel') T.wheel = c;
      else if (c.name === 'ebike_dock') T.dock = c;
    }
    g.scene.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = false; } });
    G = T.bike && T.wheel && T.dock ? T : null;
    return G;
  });
  return loading;
}
export const ebikeModelReady = () => !!G;

// geometry the rider needs (filled from the model's empties; defaults match ebike.py)
export const RIG = { seat: new THREE.Vector3(0, 0.965, -0.25), bb: new THREE.Vector3(0, 0.29, -0.04), crank: 0.17, pedalX: 0.14, grip: new THREE.Vector3(0.29, 1.04, 0.335) };

export function buildEbikeMesh(color, dirt = 0) {
  if (!G) return null;
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const root = G.bike.clone(true); root.position.set(0, 0, 0); body.add(root);
  const parts = { model: true, wheels: [], seats: {}, lamps: { head: [], tail: [] }, meshes: [], lampMeshes: [], glass: [], key: 'ebike', parts: {}, glassMat: GLASS, ebike: true };
  const p1 = paintMaterial(color, dirt), p2 = paintMaterial(0x111214, dirt);
  for (const c of [...root.children]) {
    const part = c.name.split('__')[1] || c.name;
    if (!c.isMesh && c.children.length === 0) {
      const p = c.position;
      if (part.startsWith('w_')) parts.wheels.push(wheel(p, part));
      else if (part.startsWith('seat_')) parts.seats[part.slice(5)] = p.clone();
      else if (part.startsWith('lamp_head')) parts.lamps.head.push([p.x, p.y, p.z]);
      else if (part.startsWith('lamp_tail')) parts.lamps.tail.push([p.x, p.y, p.z]);
      else if (part === 'bb') RIG.bb.copy(p);
      else if (part === 'grip_L') RIG.grip.copy(p);
      root.remove(c);
      continue;
    }
    parts.parts[part] = c;
    c.traverse((m) => {
      if (!m.isMesh) return;
      const n = m.material.name;
      if (n === 'paint') m.material = p1;
      else if (n === 'paint2') m.material = p2;
      else if (n === 'lamp_head') { m.material = LAMP.headOff; parts.lampMeshes.push([m, 'head']); }
      else if (n === 'lamp_tail') { m.material = LAMP.tailOff; parts.lampMeshes.push([m, 'tail']); }
      parts.meshes.push(m);
    });
  }
  if (parts.seats.D) RIG.seat.copy(parts.seats.D);
  for (const w of parts.wheels) body.add(w);
  parts.crank = parts.parts.crank || null;
  const head = new THREE.Object3D(); head.visible = false; body.add(head);
  g.userData.driverHead = head;
  g.userData.body = body;
  g.userData.parts = parts;
  g.userData.lamps = { head: parts.lamps.head, tail: parts.lamps.tail, bar: null, size: 0.7 };
  return g;
}
function wheel(p, part) {
  const w = new THREE.Group(), spin = G.wheel.clone(true);
  spin.position.set(0, 0, 0); w.add(spin); w.userData.spin = spin;
  w.position.copy(p); w.userData.front = part.includes('F'); w.userData.r = Math.max(0.2, p.y);
  return w;
}

// the docking station (kiosk + 5 posts); a small "ARNETT BIKE" sign goes on the kiosk
let signMat = null;
export function buildDockMesh() {
  if (!G) return null;
  const g = G.dock.clone(true);
  if (!signMat) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#1257b8'; x.fillRect(0, 0, 256, 128);
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = '900 46px "Pricedown Bl", Impact, sans-serif'; x.fillText('ARNETT', 128, 56);
    x.font = '700 34px Arial, sans-serif'; x.fillText('BIKE  $5', 128, 104);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    signMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.25 });
  }
  // the panel faces the street (+Z after export); ebike.py's kiosk is at x = 2.35, its screen side at z = +0.92
  const s = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), signMat); s.position.set(2.35, 1.6, 0.94); g.add(s);
  return g;
}
