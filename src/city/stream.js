// Streams Davenport around the player: fetches tile data, builds a tile per frame (no hitches),
// unloads far tiles, and draws a cheap version of the rest of the city out to the horizon.
import * as THREE from 'three';
import { makeStreakMesh } from '../carlights.js';
import { D, TILE, WATER_Y, tiles, fetchTile, isFetching, inRange, tileKey, terrainHeight } from './data.js';
import { addBoxes, removeBoxes, makeBox } from './collide.js';
import { buildTile } from './tile.js';
import { M, initMaterials } from './mats.js';
import { gltf } from '../assets.js';

let scene;
const built = new Map(); // key -> {t, group, trees, lights, foot}
let R = 420; // full-detail radius
const listeners = { built: [], unloaded: [] };
export const on = (ev, fn) => listeners[ev].push(fn);
export const builtTiles = built;
export function setDetailRadius(r) { R = r; }
// Low draws small props and full tree canopies over a shorter range
let propScale = 1, treeNear = 110;
export function setPropQuality(q) { propScale = q === 'low' ? 0.55 : q === 'high' ? 1.25 : 1; treeNear = q === 'low' ? 55 : q === 'high' ? 150 : 110; instDirty = true; }

// ---------- collision walls straight from tile data (so far-off tiles still block police cars) ----------
function pointInPoly(x, z, p) { let c = false; for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) { if ((p[i + 1] > z) !== (p[j + 1] > z) && x < ((p[j] - p[i]) * (z - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]) c = !c; } return c; }
function tileBoxes(t) {
  const boxes = [];
  for (const [rel, baseY, hgt, pitched, , , kind] of t.b) {
    if (kind === 1) continue; // parking ramps are open: drive or walk in and hide
    const n = rel.length / 2, pts = new Float32Array(rel.length);
    for (let i = 0; i < n; i++) { pts[i * 2] = rel[i * 2] + t.ox; pts[i * 2 + 1] = rel[i * 2 + 1] + t.oz; }
    for (let i = 0; i < n; i++) {
      const x0 = pts[i * 2], z0 = pts[i * 2 + 1], x1 = pts[((i + 1) % n) * 2], z1 = pts[((i + 1) % n) * 2 + 1];
      const L = Math.hypot(x1 - x0, z1 - z0); if (L < 0.5) continue;
      let ox = (z1 - z0) / L, oz = -(x1 - x0) / L;
      if (pointInPoly((x0 + x1) / 2 + ox * 0.3, (z0 + z1) / 2 + oz * 0.3, pts)) { ox = -ox; oz = -oz; }
      boxes.push(makeBox((x0 + x1) / 2 - ox * 0.6, (z0 + z1) / 2 - oz * 0.6, ox, oz, 0.6, L / 2 + 0.05, baseY - 2.5, hgt + 2.5 + (pitched ? 1.5 : 0)));
    }
  }
  for (let i = 0; i < t.t.length; i += 4) {
    const x = t.t[i] + t.ox, z = t.t[i + 1] + t.oz, r = 0.22 * t.t[i + 3] / 10;
    boxes.push(makeBox(x, z, 1, 0, r, r, terrainHeight(x, z) - 1, 6));
  }
  return boxes;
}
function onData(t) {
  if (t.boxes) return;
  t.boxes = tileBoxes(t);
  addBoxes(t.key, t.boxes);
}

// ---------- far city ----------
let coarseMesh = null, farBoxes = null, water = null;
const farIdx = new Map(); // tile key -> instance indices
const farMats = [];
const discard = { center: { value: new THREE.Vector2() }, radius: { value: 0 } };
function discardPatch(m) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCenter = discard.center; sh.uniforms.uRadius = discard.radius;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWXZ;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec2 uCenter; uniform float uRadius; varying vec2 vWXZ;').replace('void main() {', 'void main() {\n if (distance(vWXZ, uCenter) < uRadius) discard;');
  };
  m.customProgramCacheKey = () => 'farDiscard';
}
function buildFar() {
  const c = D.coarse, w = c.w, h = c.h;
  const pos = new Float32Array(w * h * 3), colr = new Float32Array(w * h * 3), idx = [];
  const land = new THREE.Color(0x7f9a5c), water0 = new THREE.Color(0x4a4a3a), off = new THREE.Color(0x6f8a52), city = new THREE.Color(0x8c8a84);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i, kind = c.kind[k], y = c.heights[k] / 10;
    pos[k * 3] = c.x0 + i * c.step; pos[k * 3 + 1] = (kind === 1 ? -3 : y) - 1.2; pos[k * 3 + 2] = c.z0 + j * c.step;
    const cc = kind === 1 ? water0 : kind === 2 ? off : land.clone().lerp(city, 0.35);
    colr[k * 3] = cc.r; colr[k * 3 + 1] = cc.g; colr[k * 3 + 2] = cc.b;
    if (i < w - 1 && j < h - 1) idx.push(k, k + w, k + w + 1, k, k + w + 1, k + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const m = M.far.clone(); discardPatch(m); farMats.push(m);
  coarseMesh = new THREE.Mesh(g, m); coarseMesh.receiveShadow = false; coarseMesh.matrixAutoUpdate = false;
  scene.add(coarseMesh);
  // one box per building (hidden where the detailed tile is loaded) + the Illinois skyline
  const b = D.overview.b, sky = D.overview.skyline, nb = b.length / 6, ns = sky.length / 4;
  farBoxes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), M.farBox, nb + ns);
  const o = new THREE.Object3D(), cl = new THREE.Color();
  const STYLE = [0xa8705c, 0xcdbf9f, 0xd8d8d0, 0x7d97ab, 0xd9cfbd, 0xa9adb0];
  for (let i = 0; i < nb; i++) {
    const [x, z, y, hh, r, st] = [b[i * 6], b[i * 6 + 1], b[i * 6 + 2], b[i * 6 + 3], b[i * 6 + 4], b[i * 6 + 5]];
    o.position.set(x, y - 1, z); o.scale.set(r * 1.7, hh + 1, r * 1.7); o.updateMatrix(); farBoxes.setMatrixAt(i, o.matrix);
    farBoxes.setColorAt(i, cl.setHex(STYLE[st] || 0xcccccc).multiplyScalar(0.85 + ((i * 7919) % 100) / 400));
    const key = tileKey(Math.floor(x / TILE), Math.floor(z / TILE));
    let arr = farIdx.get(key); if (!arr) farIdx.set(key, (arr = [])); arr.push(i);
  }
  for (let i = 0; i < ns; i++) {
    const [x, z, hh, r] = [sky[i * 4], sky[i * 4 + 1], sky[i * 4 + 2], sky[i * 4 + 3]];
    o.position.set(x, terrainHeight(x, z) - 1, z); o.scale.set(r * 1.8, hh + 1, r * 1.8); o.updateMatrix(); farBoxes.setMatrixAt(nb + i, o.matrix);
    farBoxes.setColorAt(nb + i, cl.setHex(STYLE[(i * 3) % 6]).multiplyScalar(0.8));
  }
  farBoxes.frustumCulled = false; farBoxes.castShadow = false;
  farBoxes.userData.saved = farBoxes.instanceMatrix.array.slice();
  scene.add(farBoxes);
  water = new THREE.Mesh(new THREE.PlaneGeometry(16000, 14000).rotateX(-Math.PI / 2), M.water);
  water.position.set(-1000, WATER_Y, -1500); water.receiveShadow = true; water.matrixAutoUpdate = true;
  scene.add(water);
}
function hideFar(key, hide) {
  const arr = farIdx.get(key); if (!arr) return;
  const a = farBoxes.instanceMatrix.array, s = farBoxes.userData.saved;
  for (const i of arr) for (let k = 0; k < 16; k++) a[i * 16 + k] = hide ? 0 : s[i * 16 + k];
  farBoxes.instanceMatrix.needsUpdate = true;
}

// ---------- trees + street lights (instanced, rebuilt when the loaded set changes) ----------
const inst = {};
let instDirty = false, instT = 0;
const instAt = { x: 0, z: 0 };
// how far away each kind of prop is still drawn (m)
const PROP_FAR = { fesc: 260, ac: 240, tank: 320, busstop: 220, dumpster: 150, bag: 110, picket: 150, chainlink: 150, hedge: 160, flowers: 110, bench: 140, bin: 120, newsbox: 100, hydrant: 120, meter: 90, mailbox: 110 };
// Blender props (assets/models/props.glb): every prop kind is one instanced mesh with baked colours.
export const WIND = { value: 0 };
const PROP_GEO = new Map();
function propGeometry(name) {
  if (PROP_GEO.has(name)) return PROP_GEO.get(name);
  if (name.endsWith('_trunk_far')) { const g = propGeometry(name.replace('_far', '')); PROP_GEO.set(name, g); return g; }
  let geo = null; const g = gltf('props');
  if (g) g.scene.traverse((o) => { if (!geo && o.isMesh && o.name === 'p_' + name) geo = o.geometry; });
  PROP_GEO.set(name, geo);
  return geo;
}
// leaves sway with the wind: the higher up the tree, the more it moves; each tree on its own phase
function swayPatch(m, amt) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = WIND;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { float h = max(0.0, position.y - 1.5); vec3 ip = instanceMatrix[3].xyz; float ph = ip.x * 0.13 + ip.z * 0.11;
          float sw = sin(uWind * 1.3 + ph) * 0.6 + sin(uWind * 2.9 + ph * 1.7) * 0.25;
          transformed.x += sw * ${amt} * h; transformed.z += cos(uWind * 1.05 + ph) * ${amt * 0.7} * h;
          transformed += normal * sin(uWind * 7.0 + dot(position, vec3(3.1, 2.3, 2.7))) * 0.04; }`);
  };
  m.customProgramCacheKey = () => 'sway' + amt;
  return m;
}
let PROP_MAT, LEAF_MAT, LENS_MAT;
const SHADOW = new Set(['dumpster', 'tank', 'fesc', 'busstop', 'streetlight', 'bench', 'ac']);
function propMesh(name, cap = 16) {
  const geo = propGeometry(name); if (!geo) return null;
  const leaves = name.includes('_leaves'), mat = leaves ? LEAF_MAT : name === 'streetlight_lens' ? LENS_MAT : PROP_MAT;
  const m = new THREE.InstancedMesh(geo, mat, cap); m.count = 0;
  m.castShadow = leaves || name.endsWith('_trunk') || SHADOW.has(name); m.receiveShadow = !leaves; m.frustumCulled = false;
  scene.add(m); inst[name] = m;
  return m;
}
function makeInstanced() {
  PROP_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.15 });
  LEAF_MAT = swayPatch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }), 0.012);
  M.lamp = M.lamp || new THREE.MeshBasicMaterial({ color: 0xfff3c4 });
  LENS_MAT = M.lamp;
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });
  const mk = (geo, mat, shadow) => { const m = new THREE.InstancedMesh(geo, mat, 16); m.count = 0; m.castShadow = shadow; m.receiveShadow = false; m.frustumCulled = false; scene.add(m); return m; };
  // at night each streetlight throws a warm pool on the ground; in the wet it also reflects as a streak
  { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    M.lpool = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }); }
  inst.lpool = mk(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), M.lpool, false);
  inst.lstreak = makeStreakMesh(16, 0xffc98a); scene.add(inst.lstreak);
  // fallbacks if props.glb is missing: the old simple shapes
  const fb = {
    streetlight: new THREE.BoxGeometry(0.16, 7.5, 0.16).translate(0, 3.75, 0), streetlight_lens: new THREE.BoxGeometry(0.5, 0.16, 0.8).translate(0, 7.3, 2.1),
    oak_trunk: new THREE.CylinderGeometry(0.16, 0.24, 4, 6).translate(0, 2, 0), oak_leaves: new THREE.IcosahedronGeometry(3, 1).translate(0, 5.4, 0),
    pine_trunk: new THREE.CylinderGeometry(0.12, 0.2, 3, 6).translate(0, 1.5, 0), pine_leaves: new THREE.ConeGeometry(2.6, 8.5, 8).translate(0, 5.6, 0),
    small_trunk: new THREE.CylinderGeometry(0.1, 0.14, 2.5, 6).translate(0, 1.25, 0), small_leaves: new THREE.IcosahedronGeometry(1.8, 0).translate(0, 3.2, 0),
    bag: new THREE.IcosahedronGeometry(0.4, 0).scale(1, 0.75, 1).translate(0, 0.28, 0), dumpster: new THREE.BoxGeometry(1.9, 1.3, 1.1).translate(0, 0.65, 0),
  };
  fb.maple_trunk = fb.oak_trunk; fb.maple_leaves = fb.oak_leaves;
  for (const [k, g] of Object.entries(fb)) if (!propGeometry(k)) { g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(k.endsWith('_trunk') ? 0.3 : k === 'dumpster' ? 0.2 : 0.8), 3)); PROP_GEO.set(k, g); }
  void leafMat;
}
function ensure(name, n) {
  let m = inst[name] || propMesh(name);
  if (!m) return null;
  if (m.instanceMatrix.count < n) {
    const cap = Math.ceil(n * 1.4);
    const nm = new THREE.InstancedMesh(m.geometry, m.material, cap);
    nm.castShadow = m.castShadow; nm.frustumCulled = false;
    scene.remove(m); scene.add(nm); m.dispose(); inst[name] = m = nm;
  }
  return m;
}
const GREENS = [0x4f7d32, 0x5b8a38, 0x46702c, 0x6a9440, 0x3f6a2c, 0x7a9a3c, 0x557f3a];
function rebuildInstances() {
  const all = { trees: [], lights: [], junk: [] };
  for (const b of built.values()) { all.trees.push(...b.trees); all.lights.push(...b.lights); all.junk.push(...(b.junk || [])); }
  // props by kind (rooftop units, fire escapes, dumpsters, benches, ...)
  const byKind = new Map(), oj = new THREE.Object3D();
  for (const j of all.junk) {
    const far = (PROP_FAR[j.kind] || 200) * propScale; if ((j.x - instAt.x) ** 2 + (j.z - instAt.z) ** 2 > far * far) continue;
    let a = byKind.get(j.kind); if (!a) byKind.set(j.kind, a = []); a.push(j);
  }
  for (const name of Object.keys(inst)) if (!byKind.has(name) && PROP_GEO.has(name) && !/_(trunk|leaves|lens|lo|far)$|^streetlight$/.test(name)) inst[name].count = 0;
  for (const [kind, list] of byKind) {
    const m = ensure(kind, list.length); if (!m) continue;
    list.forEach((j, i) => { oj.position.set(j.x, j.y, j.z); oj.rotation.set(0, j.h || 0, 0); oj.scale.setScalar(j.s || 1); oj.updateMatrix(); m.setMatrixAt(i, oj.matrix); });
    m.count = list.length; m.instanceMatrix.needsUpdate = true;
  }
  // trees: oak or maple for broadleaf, pine for conifers, a small ornamental for street trees
  const T = all.trees, o = new THREE.Object3D(), c = new THREE.Color();
  // broadleaf trees past ~110 m swap to a lighter canopy (and stop casting shadows)
  const SPEC = ['oak', 'maple', 'pine', 'small', 'oak_lo', 'maple_lo'], groups = { oak: [], maple: [], pine: [], small: [], oak_lo: [], maple_lo: [] };
  const hasLo = !!propGeometry('oak_leaves_lo');
  for (const t of T) {
    let sp = t.kind === 1 ? 'pine' : t.kind === 2 ? 'small' : t.seed < 0.55 ? 'oak' : 'maple';
    if (hasLo && (sp === 'oak' || sp === 'maple') && (t.x - instAt.x) ** 2 + (t.z - instAt.z) ** 2 > treeNear * treeNear) sp += '_lo';
    groups[sp].push(t);
  }
  for (const sp of SPEC) {
    const G = groups[sp], lo = sp.endsWith('_lo'), base = lo ? sp.slice(0, -3) : sp;
    if (lo && !hasLo) continue;
    const tr = ensure(lo ? base + '_trunk_far' : sp + '_trunk', G.length), lv = ensure(lo ? base + '_leaves_lo' : sp + '_leaves', G.length);
    if (!tr || !lv) continue;
    if (lo) { tr.castShadow = false; lv.castShadow = false; }
    G.forEach((t, i) => {
      const s = t.s * (sp === 'pine' ? 1.0 : sp === 'small' ? 1.1 : 1.05);
      o.rotation.set(0, t.seed * 6.28, 0); o.position.set(t.x, t.y - 0.15, t.z); o.scale.set(s, s * (0.9 + t.seed * 0.25), s); o.updateMatrix();
      tr.setMatrixAt(i, o.matrix); lv.setMatrixAt(i, o.matrix);
      c.setHex(GREENS[Math.floor(t.seed * GREENS.length)]).multiplyScalar(0.85 + t.seed * 0.3);
      if (sp === 'maple' && t.seed > 0.9) c.setHex(0x9a6a2a); // the odd turning maple
      if (sp === 'pine') c.multiplyScalar(0.7);
      lv.setColorAt(i, c);
    });
    tr.count = lv.count = G.length; tr.instanceMatrix.needsUpdate = lv.instanceMatrix.needsUpdate = true; if (lv.instanceColor) lv.instanceColor.needsUpdate = true;
  }
  const L = all.lights, pole = ensure('streetlight', L.length), lamp = ensure('streetlight_lens', L.length), lpool = ensure('lpool', L.length), lstreak = ensure('lstreak', L.length);
  L.forEach((l, i) => {
    o.rotation.set(0, l.h, 0); o.position.set(l.x, l.y, l.z); o.scale.set(1, 1, 1); o.updateMatrix(); pole.setMatrixAt(i, o.matrix); lamp.setMatrixAt(i, o.matrix);
    o.position.set(l.x + Math.sin(l.h) * 2.4, l.y + 0.07, l.z + Math.cos(l.h) * 2.4); o.scale.set(13, 1, 13); o.updateMatrix(); lpool.setMatrixAt(i, o.matrix);
    o.rotation.set(0, 0, 0); o.scale.set(1.3, 1, 11); o.updateMatrix(); lstreak.setMatrixAt(i, o.matrix);
  });
  pole.count = lamp.count = lpool.count = lstreak.count = L.length;
  for (const m of [pole, lamp, lpool, lstreak]) m.instanceMatrix.needsUpdate = true;
}

// ---------- the streaming loop ----------
export function initStream(s, quality) {
  scene = s;
  initMaterials(quality);
  buildFar();
  makeInstanced();
}
const dist2 = (tx, tz, x, z) => { const cx = (tx + 0.5) * TILE, cz = (tz + 0.5) * TILE; return (cx - x) ** 2 + (cz - z) ** 2; };
function neighboursReady(tx, tz) {
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const x = tx + dx, z = tz + dz; if (inRange(x, z) && !tiles.has(tileKey(x, z))) return false; }
  return true;
}
let fetching = 0;
function wantData(px, pz, rad) {
  const r = Math.ceil(rad / TILE) + 1, cx = Math.floor(px / TILE), cz = Math.floor(pz / TILE), out = [];
  for (let tz = cz - r; tz <= cz + r; tz++) for (let tx = cx - r; tx <= cx + r; tx++) {
    if (!inRange(tx, tz)) continue;
    const d2 = dist2(tx, tz, px, pz); if (d2 > rad * rad) continue;
    out.push({ tx, tz, d2, key: tileKey(tx, tz) });
  }
  return out.sort((a, b) => a.d2 - b.d2);
}
function pumpFetch(px, pz) {
  for (const w of wantData(px, pz, R + 340)) {
    if (fetching >= 6) break;
    if (tiles.has(w.key) || isFetching(w.key)) continue;
    fetching++;
    fetchTile(w.tx, w.tz).then(onData).catch((e) => console.warn('tile', w.key, e.message)).finally(() => { fetching--; });
  }
}
function buildOne(px, pz) {
  for (const w of wantData(px, pz, R)) {
    if (built.has(w.key) || !D.tileSet.has(w.key)) continue;
    const t = tiles.get(w.key);
    if (!t || !neighboursReady(w.tx, w.tz)) continue;
    const rec = buildTile(t);
    rec.t = t; t.used = performance.now();
    scene.add(rec.group);
    built.set(w.key, rec);
    hideFar(w.key, true);
    instDirty = true;
    for (const fn of listeners.built) fn(t, rec);
    return true;
  }
  return false;
}
function unloadFar(px, pz) {
  const lim = (R + 160) ** 2;
  for (const [key, rec] of built) {
    if (dist2(rec.t.tx, rec.t.tz, px, pz) < lim) continue;
    scene.remove(rec.group);
    rec.group.traverse((m) => { if (m.geometry) m.geometry.dispose(); });
    built.delete(key); hideFar(key, false); instDirty = true;
    for (const fn of listeners.unloaded) fn(rec.t, rec);
  }
  // forget tile data far away (keeps memory small on Chromebooks)
  if (tiles.size > 260) {
    const far = (R + 900) ** 2;
    for (const [key, t] of tiles) if (!built.has(key) && dist2(t.tx, t.tz, px, pz) > far) { removeBoxes(key); tiles.delete(key); }
  }
}
// How far from the player everything is detailed (the far terrain is hidden inside this).
function solidRadius(px, pz) {
  let r = R;
  for (const w of wantData(px, pz, R)) if (D.tileSet.has(w.key) && !built.has(w.key)) { r = Math.min(r, Math.sqrt(w.d2) - TILE * 0.72); }
  return Math.max(0, r - 30);
}
let frameBudget = 7;
export function updateStream(px, pz, dt) {
  pumpFetch(px, pz);
  const t0 = performance.now();
  while (performance.now() - t0 < frameBudget) if (!buildOne(px, pz)) break;
  unloadFar(px, pz);
  WIND.value += dt;
  instT -= dt;
  // small props only draw near the player: re-pick them after a walk or drive of 40 m
  if (!instDirty && (px - instAt.x) ** 2 + (pz - instAt.z) ** 2 > 1600) instDirty = true;
  if (instDirty && instT <= 0) { instDirty = false; instT = 0.4; instAt.x = px; instAt.z = pz; rebuildInstances(); }
  discard.center.value.set(px, pz); discard.radius.value = solidRadius(px, pz);
}
// Download (but don't build) the tiles around a point, e.g. where you'll spawn, while the menu is up.
export function prefetch(px, pz, rad) {
  return Promise.all(wantData(px, pz, rad + TILE * 1.5).map((w) => fetchTile(w.tx, w.tz).then(onData).catch(() => {})));
}
// Load and build everything within `rad` of a point before the game starts.
export async function preload(px, pz, rad, onProgress) {
  const need = wantData(px, pz, rad + TILE * 1.5);
  let done = 0;
  await Promise.all(need.map((w) => fetchTile(w.tx, w.tz).then(onData).catch(() => {}).finally(() => { done++; onProgress?.(done / need.length * 0.6); })));
  const toBuild = wantData(px, pz, rad).filter((w) => D.tileSet.has(w.key));
  let b = 0, tYield = performance.now();
  const saveR = R; R = Math.max(R, rad);
  while (true) {
    if (!buildOne(px, pz)) break;
    b++; onProgress?.(0.6 + Math.min(1, b / Math.max(1, toBuild.length)) * 0.4);
    if (performance.now() - tYield > 40) { await new Promise((r) => setTimeout(r, 0)); tYield = performance.now(); } // keep the spinner turning
  }
  R = saveR;
  instAt.x = px; instAt.z = pz; rebuildInstances(); instDirty = false;
  discard.center.value.set(px, pz); discard.radius.value = solidRadius(px, pz);
}
export function setBudget(ms) { frameBudget = ms; }
export function footprintsNear(x, z, r) {
  const out = [];
  for (const rec of built.values()) { const t = rec.t; if (Math.abs(t.ox + 100 - x) < r + 100 && Math.abs(t.oz + 100 - z) < r + 100) out.push(...rec.foot); }
  return out;
}
export { farMats };
