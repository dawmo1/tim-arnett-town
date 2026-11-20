// Car mods (Arnett Auto / personal cars): how a v.mods record looks on the car and sounds.
// v.mods = { engine 0-4, brakes 0-3, suspension 0-3, turbo 0|1, armor 0-5, bp 0|1, nitro 0|1,
//   paint: { c1, c2, f } (c1 = v.color, c2 secondary or null = factory, f = FINISHES index),
//   rims: { s, c } (s = RIMS index, 0 stock; c = colour or null), tint 0-3, neon colour or null, horn 0-5, plate '' or text }
// Everything is applied in place on the existing mesh, so it is safe to call again after any change.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { gltf } from './assets.js';
import { paintMaterial, GLASS } from './carmodel.js';
import { paintMat } from './vehicles.js';
import * as fx from './fx.js';

export const FINISHES = ['Gloss', 'Metallic', 'Matte', 'Pearlescent', 'Chrome'];
export const RIMS = ['Stock', 'Five spoke', 'Multi spoke', 'Deep dish', 'Mesh', 'Turbine', 'Tri spoke', 'Split six'];
export const TINTS = ['None', 'Light smoke', 'Dark smoke', 'Limo'];
export const HORNS = ['Stock', 'Truck', 'Sports', 'Clown', 'Musical', 'Air horn'];
export const PALETTE = [['Black', 0x0c0d0f], ['Graphite', 0x2b2e33], ['Silver', 0xb9bcbf], ['White', 0xf2f2f0], ['Arnett Red', 0xc62828], ['Wine', 0x6e1a2a],
  ['Orange', 0xe8661c], ['Cornfield Gold', 0xe0a526], ['Lime', 0x7cc322], ['Bluff Green', 0x2e7d32], ['Teal', 0x00897b], ['River Blue', 0x1565c0],
  ['Navy', 0x14254a], ['Purple', 0x5e35b1], ['Hot Pink', 0xe91e8c], ['Bronze', 0x8c6239]];
export const NEONS = [['White', 0xffffff], ['Red', 0xff2a2a], ['Blue', 0x2a6bff], ['Electric blue', 0x00e5ff], ['Green', 0x2aff5a], ['Lime', 0xb6ff00], ['Yellow', 0xffd600], ['Orange', 0xff7a00], ['Purple', 0xb03aff], ['Pink', 0xff3ab8]];

export const newMods = (v) => ({ engine: 0, brakes: 0, suspension: 0, turbo: 0, armor: 0, bp: 0, nitro: 0, paint: { c1: v.color, c2: null, f: 0 }, rims: { s: 0, c: null }, tint: 0, neon: null, horn: 0, plate: '' });
export const modsOf = (v) => (v.mods = { ...newMods(v), ...(v.mods || {}) });
// damage the car takes (main.js damageVehicle multiplies by this): armor 5 = half
export const armorMul = (v) => 1 - 0.1 * ((v.mods && v.mods.armor) || 0);

// template material name of each car mesh geometry (clones share geometry, so this survives the material swaps)
let names = null;
function nameOf(m) {
  if (!names) { names = new Map(); const g = gltf('cars'); if (g) g.scene.traverse((o) => { if (o.isMesh) names.set(o.geometry, o.material.name); }); }
  return names.get(m.geometry);
}
const SECONDS = [0xf2f2f0, 0xf4f4f4, 0xd8d8d8, 0x2e7d32];
// 1 primary paint, 2 secondary paint, 3 plate/decal, 0 anything else; remembered on the mesh the first time
function slot(m, v) {
  if (m.userData.slot !== undefined) return m.userData.slot;
  const n = nameOf(m);
  let s = n === 'paint' ? 1 : n === 'paint2' ? 2 : n === 'plate' || n === 'decal' ? 3 : 0;
  if (n === undefined) { // dented (geometry cloned) before we first saw it, or a box car: go by the material it still has
    const mt = m.material;
    if (mt === paintMat(v.color) || [0, 1, 2, 3].some((d) => mt === paintMaterial(v.color, d))) s = 1;
    else if (SECONDS.some((c) => [0, 1, 2, 3].some((d) => mt === paintMaterial(c, d)))) s = 2;
  }
  return (m.userData.slot = s);
}

// ---------- materials (cached, shared by every car with the same look) ----------
const cache = new Map();
const cached = (k, make) => { let m = cache.get(k); if (!m) cache.set(k, (m = make())); return m; };
function finishMat(c, f) {
  return cached(`p${c}:${f}`, () => {
    if (f === 3) return new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.28, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 0.7, iridescenceIOR: 1.6, envMapIntensity: 1.2 });
    if (f === 4) return new THREE.MeshStandardMaterial({ color: new THREE.Color(c).lerp(new THREE.Color(0xffffff), 0.35), roughness: 0.05, metalness: 1, envMapIntensity: 2 });
    const [r, mt, e] = [[0.3, 0.12, 0.9], [0.3, 0.6, 1.3], [0.85, 0.05, 0.3]][f] || [0.3, 0.12, 0.9];
    return new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: mt, envMapIntensity: e });
  });
}
const rimMat = (c) => cached(`r${c}`, () => (c === null ? new THREE.MeshStandardMaterial({ color: 0xd8dde2, metalness: 1, roughness: 0.15, envMapIntensity: 1.6 }) : new THREE.MeshStandardMaterial({ color: c, metalness: 0.6, roughness: 0.3 })));
const tintMat = (t) => cached(`t${t}`, () => { const g = GLASS.clone(); g.color.setHex(0x050607); g.opacity = [0.5, 0.68, 0.84, 0.95][t]; return g; });
let glowTex = null;
function neonMats(c) {
  return cached(`n${c}`, () => {
    if (!glowTex) { // soft rounded glow, brightest just inside the car's outline
      const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(0.7, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64); glowTex = new THREE.CanvasTexture(cv);
    }
    const strip = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2.5), toneMapped: false });
    const pool = new THREE.MeshBasicMaterial({ color: c, map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    return { strip, pool };
  });
}
// plate: a per-text copy of the shared decal atlas with the plate area redrawn (taxi signs etc. keep their spots)
// shortcut: one cached atlas per text ever shown (typing previews add a few), fine for a handful of plates
function plateMat(text, src) {
  return cached(`l${text}`, () => {
    const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
    if (src.map && src.map.image) g.drawImage(src.map.image, 0, 0);
    const [x, y, w, h] = [0, 384, 256, 128]; // atlas uv box (0,0)-(0.5,0.25), same as carmodel.js
    g.fillStyle = '#f4f1e6'; g.fillRect(x, y, w, h); g.fillStyle = '#2a4e8a'; g.fillRect(x, y, w, h * 0.22);
    g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = `bold ${h * 0.16}px Arial`; g.fillText('IOWA', x + w / 2, y + h * 0.17);
    g.fillStyle = '#16233d'; g.font = `bold ${h * 0.42}px Arial Narrow, Arial`; g.fillText(text, x + w / 2, y + h * 0.75, w * 0.92);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 4;
    const m = src.clone(); m.map = t; return m;
  });
}

// ---------- rims: built once per style to fit the template wheel's rim, in wheel (spin) space ----------
let rimFit = null;
const rimGeos = [];
function fitRim(spin) {
  if (rimFit !== null) return rimFit;
  const box = new THREE.Box3(), mtx = new THREE.Matrix4();
  spin.updateMatrixWorld(true);
  const inv = spin.matrixWorld.clone().invert();
  spin.traverse((m) => { if (m.isMesh && (m.material.name === 'rim' || m.userData.rim)) { m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox.clone().applyMatrix4(mtx.multiplyMatrices(inv, m.matrixWorld))); } });
  if (box.isEmpty()) return (rimFit = false);
  // spin-local = the template wheel's own units (every car shares it); the axle is the rim's thinnest axis
  const sz = box.getSize(new THREE.Vector3()), axis = sz.x <= sz.y && sz.x <= sz.z ? 'x' : sz.y <= sz.z ? 'y' : 'z';
  const R = Math.max(...['x', 'y', 'z'].filter((k) => k !== axis).map((k) => sz[k])) / 2;
  return (rimFit = { c: box.getCenter(new THREE.Vector3()), axis, hw: sz[axis] / 2, R });
}
// built with the axle along X around the origin, then turned onto the real axle
function rimGeo(style, F) {
  if (rimGeos[style]) return rimGeos[style];
  const parts = [], R = F.R * 0.96, t = R * 0.11, xs = [F.hw - t / 2, -F.hw + t / 2], put = (g, x, y = 0, z = 0, ax = 0) => { g.rotateX(ax); g.translate(x, y, z); parts.push(g.toNonIndexed()); };
  const cyl = (r, w, n = 18) => new THREE.CylinderGeometry(r, r, w, n).rotateZ(Math.PI / 2);
  const spokes = (x, n, w, r0, r1, off = 0, depth = t) => { for (let i = 0; i < n; i++) { const a = off + (i / n) * Math.PI * 2, r = (r0 + r1) / 2; put(new THREE.BoxGeometry(depth, r1 - r0, w), x, Math.cos(a) * r, Math.sin(a) * r, a); } };
  put(cyl(R * 0.82, t * 0.4, 20), 0); // brake disc behind the spokes
  for (const x of xs) {
    put(new THREE.TorusGeometry(R * 0.94, R * 0.06, 5, 26).rotateY(Math.PI / 2), x); // lip
    put(cyl(R * 0.18, t * 1.6, 12), x); // hub
    if (style === 1) spokes(x, 5, R * 0.2, R * 0.15, R * 0.92);
    else if (style === 2) spokes(x, 10, R * 0.08, R * 0.15, R * 0.92);
    else if (style === 3) { put(cyl(R * 0.62, t, 22), x); spokes(x, 6, R * 0.12, R * 0.6, R * 0.92); } // deep dish: flat centre, short spokes out to the lip
    else if (style === 4) { spokes(x, 12, R * 0.05, R * 0.15, R * 0.92, 0); spokes(x, 12, R * 0.05, R * 0.15, R * 0.92, Math.PI / 12 + 0.12, t * 0.8); put(new THREE.TorusGeometry(R * 0.55, R * 0.03, 4, 22).rotateY(Math.PI / 2), x); }
    else if (style === 5) { put(cyl(R * 0.9, t * 0.6, 26), x); spokes(x, 14, R * 0.04, R * 0.3, R * 0.88, 0.1, t * 2.2); }
    else if (style === 6) spokes(x, 3, R * 0.3, R * 0.15, R * 0.92, Math.PI / 6);
    else if (style === 7) { spokes(x, 6, R * 0.07, R * 0.15, R * 0.92, -0.09); spokes(x, 6, R * 0.07, R * 0.15, R * 0.92, 0.09); }
  }
  const g = mergeGeometries(parts);
  if (F.axis === 'y') g.rotateZ(Math.PI / 2); else if (F.axis === 'z') g.rotateY(-Math.PI / 2);
  g.translate(F.c.x, F.c.y, F.c.z);
  return (rimGeos[style] = g);
}
function applyRims(v, P, m) {
  const st = m.rims || { s: 0, c: null }, mat = rimMat(st.c ?? null);
  for (const w of P.wheels) {
    const spin = w.userData.spin; if (!spin) continue;
    let old = spin.userData.modRim;
    if (old) { spin.remove(old); spin.userData.modRim = null; }
    const F = st.s ? fitRim(spin) : null;
    spin.traverse((c) => {
      if (!c.isMesh || !(c.material.name === 'rim' || c.userData.rim)) return;
      if (!c.userData.rimOrig) c.userData.rimOrig = c.material;
      c.userData.rim = true; c.material = st.c === null || st.c === undefined ? c.userData.rimOrig : mat; c.visible = !F;
    });
    if (F) { old = new THREE.Mesh(rimGeo(st.s, F), mat); old.castShadow = true; spin.add(old); spin.userData.modRim = old; }
  }
}

// ---------- the one entry point ----------
export function applyMods(v) {
  if (!v || !v.mods || !v.mesh) return;
  const m = modsOf(v), P = v.mesh.userData.parts; if (!P) return;
  if (m.nitro && !v.T.nitroMul) v.T = { ...v.T, nitroMul: 2 }; // vehicles.js reads T.nitroMul
  const pt = m.paint || (m.paint = { c1: v.color, c2: null, f: 0 });
  const p1 = finishMat(pt.c1, pt.f || 0), p2 = pt.c2 === null || pt.c2 === undefined ? null : finishMat(pt.c2, pt.f || 0);
  v.mesh.userData.body.traverse((o) => {
    if (!o.isMesh) return;
    const s = slot(o, v);
    if (s === 0) return;
    if (!o.userData.orig) o.userData.orig = o.material;
    if (s === 1) o.material = p1;
    else if (s === 2) o.material = p2 || o.userData.orig;
    else if (s === 3) o.material = m.plate ? plateMat(m.plate, o.userData.orig) : o.userData.orig;
  });
  v.color = pt.c1; // after the slots are known (they may go by the old colour); writeVeh sends it, so other players see the primary
  // window tint (cracked / shattered glass keeps its damage look)
  if (P.glass && !P.cracked) { const g = m.tint ? tintMat(m.tint) : GLASS; P.glassMat = g; for (const x of P.glass) x.material = g; }
  if (P.model) applyRims(v, P, m);
  // suspension: the shell sits lower over the wheels (3 cm a level)
  const root = P.model && v.mesh.userData.body.children[0];
  if (root) { if (root.userData.baseY === undefined) root.userData.baseY = root.position.y; root.position.y = root.userData.baseY - 0.03 * (m.suspension || 0); }
  // neon: emissive strips under the sills plus one additive glow on the road (no real lights)
  if (v.mesh.userData.neon) { v.mesh.remove(v.mesh.userData.neon); v.mesh.userData.neon.traverse((o) => o.geometry && o.geometry.dispose()); v.mesh.userData.neon = null; }
  if (m.neon !== null && m.neon !== undefined && !v.T.bike && !v.T.boat && !v.T.heli) {
    const { strip, pool } = neonMats(m.neon), L = v.T.len, Wd = v.T.wid, g = new THREE.Group();
    const s = new THREE.Mesh(mergeGeometries([-1, 1].map((k) => new THREE.BoxGeometry(0.04, 0.03, L * 0.7).translate(k * (Wd / 2 - 0.15), 0.16, 0))), strip);
    const q = new THREE.Mesh(new THREE.PlaneGeometry(Wd + 1.4, L + 1.2).rotateX(-Math.PI / 2).translate(0, 0.05, 0), pool);
    q.renderOrder = 1; g.add(s, q); v.mesh.add(g); v.mesh.userData.neon = g;
  }
}

// ---------- horns (synthesized; stock one is fx's) ----------
const fall = (d) => Math.max(0, 1 - d / 140);
function osc(ac, out, type, f, t0, dur, vol, f2) {
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + t0;
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.setValueAtTime(vol, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
}
export function horn(v, dist = 0, which) {
  const h = which ?? (v && v.mods && v.mods.horn) ?? 0;
  if (!h) { fx.soundHorn(dist); return; }
  const { ac, out } = fx.audio(); if (!ac) return;
  const k = 0.16 * fall(dist * 1.5); if (k <= 0.01) return;
  if (h === 1) { osc(ac, out, 'sawtooth', 147, 0, 0.7, k); osc(ac, out, 'sawtooth', 185, 0, 0.7, k * 0.8); osc(ac, out, 'square', 220, 0, 0.7, k * 0.4); }
  else if (h === 2) { osc(ac, out, 'square', 587, 0, 0.18, k * 0.7); osc(ac, out, 'square', 740, 0, 0.18, k * 0.6); osc(ac, out, 'square', 587, 0.22, 0.18, k * 0.7); osc(ac, out, 'square', 740, 0.22, 0.18, k * 0.6); }
  else if (h === 3) { osc(ac, out, 'triangle', 300, 0, 0.22, k * 1.4, 900); osc(ac, out, 'triangle', 900, 0.26, 0.3, k * 1.4, 260); }
  else if (h === 4) [523, 659, 784, 1046, 784].forEach((f, i) => osc(ac, out, 'square', f, i * 0.13, 0.12, k * 0.6));
  else if (h === 5) { osc(ac, out, 'sawtooth', 233, 0, 1.0, k * 1.1); osc(ac, out, 'sawtooth', 277, 0, 1.0, k); osc(ac, out, 'sawtooth', 349, 0, 1.0, k * 0.8); }
}
