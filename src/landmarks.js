// Davenport's landmarks and the moving river/rail world, hand-built on top of the map data:
// Centennial Bridge (closed halfway: ROAD CLOSED), the lit Skybridge, Modern Woodmen Park with its
// Ferris wheel and light towers, the LeClaire Park bandshell, the Vander Veer fountain, the Adler
// marquee, the Hotel Blackhawk sign, NorthPark's sign, "Re-elect Mayor Tim Arnett" billboards,
// a made-up riverboat casino, barge tows on the Mississippi, a freight train down 5th Street with
// crossing gates, speedboats, and a helicopter on a downtown rooftop (stairs from the street).
// Trains and barges run on the shared clock, so every player sees them in the same place.
import * as THREE from 'three';
import * as W from './world.js';
import { G, D, pointOnEdge, terrainHeight, WATER_Y, lots } from './city/data.js';
import { addBoxes, makeBox } from './city/collide.js';
import { mat } from './character.js';
import { textTexture } from './util.js';
import { loadLazy, dropLazy } from './assets.js';

let scene, ctx;
const night = [];  // [material, max emissive] lit at night
const built = new Set();
let ferris = null, wheelT = 0, fountain = null;
export const doors = []; // {x, y, z, to: {x, y, z, h}, label}

export function initLandmarks(s, c) {
  scene = s; ctx = c;
  initTrain(); initRiver(); initBillboards(); initModels();
  W.onStream('built', (t) => tryBuild(t));
  for (const rec of W.builtTiles.values()) tryBuild(rec.t);
}
const box = (g, c, sx, sy, sz, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m || mat(c)); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; };
const glow = (color, k = 1) => { const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0, roughness: 0.4 }); night.push([m, k]); return m; };
const group = (x, y, z, h = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = h; scene.add(g); return g; };
function signMesh(lines, w, h, opts) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: textTexture(lines, opts), side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: 0, emissiveMap: textTexture(lines, opts) })); night.push([m.material, opts.glow ?? 0.6]); return m; }
const near = (t, x, z) => Math.abs(t.ox + 100 - x) < 260 && Math.abs(t.oz + 100 - z) < 260;

// Build each landmark once, when the tiles around it have loaded (so it sits on real ground).
function tryBuild(t) {
  const todo = [
    ...D.index.bridgeEnds.map((be, i) => ['bridge' + i, () => near(t, be.x, be.z) && buildBridgeEnd(be, i)]),
    ['skybridge', () => near(t, 225, 390) && buildSkybridge()],
    ['ballpark', () => near(t, -372, 559) && buildBallpark(-372, 559)],
    ['fountain', () => near(t, 197, -2183) && buildFountain(197, -2183)],
    ['casino', () => near(t, 520, 330) && buildCasino(520)],
    ['northpark', () => near(t, 290, -4413) && buildRoofSign(290, -4413, 'NORTHPARK', '#ffffff', 22)],
    ['helipad', () => near(t, 150, 120) && buildHelipad()],
    ['marina', () => near(t, 2605, -561) && buildMarina(2605, -561)],
    ['leclaire-boats', () => near(t, -60, 520) && buildMarina(-60, 470)],
  ];
  for (const [k, fn] of todo) if (!built.has(k) && fn()) built.add(k);
}
// first water when walking from (x, z) in direction (dx, dz)
function waterFrom(x, z, dx, dz, max = 800) { for (let d = 0; d < max; d += 4) if (!W.isLand(x + dx * d, z + dz * d)) return { x: x + dx * d, z: z + dz * d }; return null; }

// ---------- Blender landmarks (assets/src/landmarks.py -> assets/models/landmarks/<file>.glb) ----------
// Each model is built around its anchor (game x/z), base at y, facing as in the city. The OSM buildings
// under `clear` ([cx, cz, half x, half z]) are dropped from the tile data (city/data.js lots), `solid`
// ([cx, cz, half x, half z, height, base above y]) are its walls. Models stream in within LOAD m and out past DROP m.
const MODELS = [
  { file: 'blackhawk', x: 451.6, z: 96.5, y: 7.5, clear: [[451.6, 96.5, 21, 18]], solid: [[451.6, 96.5, 24.5, 22.3, 50]] },
  { file: 'adler', x: 342.4, z: 91.2, y: 8.6, clear: [[342.4, 91.2, 18, 16.5]], solid: [[342.4, 91.2, 19.7, 18.7, 27]] },
  { file: 'figge', x: 109, z: 340, y: 3.4, clear: [[109, 340, 46, 18]], solid: [[109, 340, 46, 18, 25]] },
  { file: 'banktower', x: 141, z: 164.7, y: 8.0, clear: [[141, 164.7, 13.5, 21]], solid: [[141, 164.7, 15.2, 22.9, 82]] },
  { file: 'putnam', x: 189.5, z: 215.7, y: 6.3, clear: [[189.5, 215.7, 8.5, 20.5]], solid: [[189.5, 215.7, 10.2, 22.1, 49]] },
  { file: 'cityhall', x: 81.5, z: -27.5, y: 12.6, clear: [[81.7, -27.5, 21, 15]], solid: [[81.7, -27.5, 22.9, 17.2, 52]] },
  { file: 'bandshell', x: -180, z: 530, y: 2.7, clear: [[-180, 530, 3, 6]], solid: [[-187.5, 530, 1.6, 4, 5]] }, // Bix bandshell, opens east to the lawn
  { file: 'ballpark', x: -400, z: 520, y: 3.0, clear: [[-431, 530, 3, 10], [-414, 545, 3, 8]], solid: [[-436, 527, 6, 24, 14], [-415, 489, 15, 7, 14], [-356, 490, 30, 7, 14]] }, // Modern Woodmen Park grandstand
  { file: 'ambrose', x: -287, z: -1693, y: 45.7, clear: [[-287, -1693, 3, 3]], solid: [[-286.6, -1688, 42.5, 12, 24], [-261, -1702, 17, 7, 16]] },
  { file: 'conservatory', x: 196, z: -2394, y: 37.4, clear: [[196, -2394, 15, 8]], solid: [[173, -2394, 14, 12, 8], [200, -2394, 12, 12, 15], [221.5, -2394, 8.5, 8, 8]] },
  { file: 'northpark', x: 132, z: -4257, y: 36.9, h: -0.277, clear: [], solid: [[130.6, -4252.2, 15, 5, 17]] }, // the mall's south entrance (the mall is OSM)
  { file: 'rivercenter', x: 461, z: 172, y: 5.1, clear: [[461, 172, 40, 20], [513, 157, 8, 12]], solid: [[452.5, 172, 50.5, 30, 20], [513, 157, 10, 14, 20], [421, 130, 2.2, 11.6, 4.2, 6]] },
];
const LOAD = 700, DROP = 900;
for (const L of MODELS) for (const [x, z, hw, hd] of L.clear) lots.extra.push({ x, z, fx: 0, fz: 1, hw, hd });
let LM = null; // the four shared landmark materials, swapped in by name
function lmMats() {
  if (LM) return LM;
  const base = { vertexColors: true, flatShading: true };
  const lit = new THREE.MeshStandardMaterial({ ...base, roughness: 0.25, emissive: 0xffc77a, emissiveIntensity: 0 });
  const neon = new THREE.MeshStandardMaterial({ ...base, roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0 });
  neon.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor.rgb;'); };
  night.push([lit, 1.2], [neon, 2.5]);
  LM = { lm_body: new THREE.MeshStandardMaterial({ ...base, roughness: 0.85 }), lm_glass: new THREE.MeshStandardMaterial({ ...base, roughness: 0.12 }), lm_lit: lit, lm_neon: neon };
  return LM;
}
function initModels() {
  for (const L of MODELS) {
    const ux = Math.cos(L.h || 0), uz = -Math.sin(L.h || 0);
    addBoxes('lm-' + L.file, L.solid.map(([x, z, hx, hz, h, up = 0]) => (up ? makeBox(x, z, ux, uz, hx, hz, L.y + up, h) : makeBox(x, z, ux, uz, hx, hz, L.y - 3, h + 3))));
  }
}
// L.h: heading (rotation.y); L.len: stretch a 100 m bridge module to this length; L.load: own load radius.
function placeModel(L, g) {
  const M = lmMats(), root = new THREE.Group(), lod = new THREE.LOD(), sc = g.scene.clone();
  root.position.set(L.x, L.y, L.z); root.rotation.y = L.h || 0; if (L.len) root.scale.z = L.len / 100; root.add(lod);
  sc.traverse((o) => { if (o.isMesh) { o.material = M[o.material.name] || M.lm_body; o.castShadow = o.receiveShadow = /_lod0/.test(o.name) || /_lod0/.test(o.parent?.name); } });
  for (const o of [...sc.children]) {
    if (o.name.endsWith('_lod0')) lod.addLevel(o, 0);
    else if (o.name.endsWith('_lod1')) lod.addLevel(o, 260);
    else root.add(o); // moving parts
  }
  scene.add(root); L.obj = root;
  L.onLoad?.(root);
}
let modelT = 0;
function updateModels(dt, focus) {
  if ((modelT -= dt) > 0 || !focus) return; modelT = 0.5;
  for (const L of MODELS) {
    const d = Math.hypot(L.x - focus.x, L.z - focus.z), file = `landmarks/${L.file}.glb`, load = L.load || LOAD;
    if (d < load && !L.obj && !L.loading) {
      L.loading = true;
      loadLazy(file).then((g) => { L.loading = false; if (g && !L.obj) placeModel(L, g); });
    } else if (d > load + DROP - LOAD && L.obj) {
      scene.remove(L.obj); L.obj = null; L.onUnload?.();
      // bridge modules share one file: free it when the last copy goes
      if (!MODELS.some((o) => o.file === L.file && (o.obj || o.loading))) loadLazy(file).then((g) => { g?.scene.traverse((o) => o.geometry?.dispose()); dropLazy(file); });
    }
  }
}

// ---------- bridges to Illinois: the structure (arches for Centennial, truss for Government) + ROAD CLOSED ----------
function buildBridgeEnd(be, i) {
  // carriageways that end side by side share one structure
  const twin = D.index.bridgeEnds.findIndex((o, j) => j < i && Math.hypot(o.x - be.x, o.z - be.z) < 60);
  if (twin < 0) { if (be.x < 0) buildCentennial(be); else buildTruss(be); }
  return buildBarrier(be, i);
}
function bridgeDeckY(be) {
  const e = G.bridges.filter((b) => Math.hypot((b.minx + b.maxx) / 2 - be.x, (b.minz + b.maxz) / 2 - be.z) < 900);
  return e.length ? Math.max(...e.map((b) => Math.max(G.nodes.y[b.a], G.nodes.y[b.b]))) : terrainHeight(be.x, be.z) + 9;
}
function buildTruss(be) {
  const deckY = bridgeDeckY(be), hx = Math.sin(be.h), hz = Math.cos(be.h);
  const shore = waterFrom(be.x - hx * 300, be.z - hz * 300, hx, hz, 400) || { x: be.x - hx * 80, z: be.z - hz * 80 };
  const total = Math.hypot(be.x - shore.x, be.z - shore.z) + 420, g = new THREE.Group(); scene.add(g);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(10, 0.8, 420), mat(0xa9a59c)); deck.position.set(be.x + hx * 210, deckY - 0.4, be.z + hz * 210); deck.rotation.y = be.h; g.add(deck);
  // the swing span over the lock by the Iowa shore, then 60 m truss panels (landmarks/govswing.glb, govtruss.glb)
  MODELS.push({ file: 'govswing', x: shore.x, z: shore.z, y: deckY, h: be.h, load: 1500 });
  for (let s = 102; s < total; s += 60) MODELS.push({ file: 'govtruss', x: shore.x + hx * s, z: shore.z + hz * s, y: deckY, h: be.h, load: 1500 });
}
function buildBarrier(be, i) {
  const deckY = bridgeDeckY(be), hx = Math.sin(be.h), hz = Math.cos(be.h);
  const bar = group(be.x, deckY, be.z, be.h);
  for (let k = -2; k <= 2; k++) { box(bar, 0xeeeeee, 1.9, 0.9, 0.6, k * 2, 0.45, 0); box(bar, 0xff6d00, 1.9, 0.15, 0.62, k * 2, 0.7, 0); }
  const sg = signMesh(['ROAD CLOSED', 'Bridge to Illinois closed'], 5, 1.8, { bg: '#ff6d00', fg: '#111111', size: 64, border: '#111111' }); sg.position.set(0, 2.4, -0.5); sg.rotation.y = Math.PI; bar.add(sg);
  box(bar, 0x555555, 0.12, 2.4, 0.12, -2.2, 1.2, -0.5); box(bar, 0x555555, 0.12, 2.4, 0.12, 2.2, 1.2, -0.5);
  for (const x of [-5, 5]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), glow(0xffa000, 3)); l.position.set(x, 1.2, 0); bar.add(l); bar.userData.flash = (bar.userData.flash || []).concat(l.material); }
  flashers.push(bar);
  addBoxes('bridge-closed' + i, [makeBox(be.x, be.z, hx, hz, 0.6, 8, deckY - 1, 3)]);
  return true;
}
function buildCentennial(be) {
  const deckY = bridgeDeckY(be);
  const hx = Math.sin(be.h), hz = Math.cos(be.h);
  // the rest of the bridge to Rock Island (looks only; the barrier stops you)
  const shore = waterFrom(be.x - hx * 500, be.z - hz * 500, hx, hz, 700) || { x: be.x - hx * 120, z: be.z - hz * 120 };
  const ext = 820, g = new THREE.Group(); scene.add(g);
  const L0 = Math.hypot(be.x - shore.x, be.z - shore.z), total = L0 + ext;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(14, 0.8, ext), mat(0xbdbab3));
  deck.position.set(be.x + hx * ext / 2, deckY - 0.4, be.z + hz * ext / 2); deck.rotation.y = be.h; g.add(deck);
  // five tied steel arches (assets: landmarks/centennial.glb, one 100 m span stretched to fit)
  const spans = 5, sl = total / spans;
  for (let k = 0; k < spans; k++) MODELS.push({ file: 'centennial', x: shore.x + hx * sl * k, z: shore.z + hz * sl * k, y: deckY, h: be.h, len: sl, load: 1500 });
  return true;
}
const flashers = [];

// ---------- Skybridge: the glass footbridge over River Drive, lit up at night ----------
function buildSkybridge() { // glass tube over River Drive with lift towers (landmarks/skybridge.glb, 161 m along +z)
  const x = 225, z0 = 310, z1 = 471, y = Math.max(terrainHeight(x, z0), terrainHeight(x, z1));
  MODELS.push({ file: 'skybridge', x, z: z0, y });
  return true;
}

// ---------- Modern Woodmen Park: field, grandstand, light towers, Ferris wheel ----------
function buildBallpark(cx, cz) {
  const y = terrainHeight(cx, cz) + 0.15, h = -0.6; // home plate up-river, outfield toward the bridge
  const g = group(cx, y, cz, h);
  // (the stadium building itself comes from the map data)
  // light towers
  for (const [lx, lz] of [[-40, 0], [40, 0], [-62, 45], [62, 45], [-30, 80], [30, 80]]) {
    box(g, 0x777777, 0.6, 32, 0.6, lx, 16, lz);
    const bank = box(g, 0, 4, 2.4, 0.6, lx, 32, lz, glow(0xfff8e1, 2)); bank.lookAt(cx, y, cz + 30);
  }
  // Ferris wheel beyond left field
  const fw = new THREE.Group(); fw.position.set(-58, 18, 74); g.add(fw);
  box(g, 0x9e9e9e, 0.5, 19, 0.5, -60, 9, 72).rotation.z = 0.25; box(g, 0x9e9e9e, 0.5, 19, 0.5, -56, 9, 76).rotation.z = -0.25;
  const wheel = new THREE.Group(); fw.add(wheel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(15, 0.35, 6, 40), glow(0xffeb3b, 1.5)); wheel.add(rim);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 15, 0.2), mat(0xbdbdbd)); sp.position.set(Math.cos(a) * 7.5, Math.sin(a) * 7.5, 0); sp.rotation.z = a - Math.PI / 2; wheel.add(sp);
    const car = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.6), mat([0xe53935, 0x1e88e5, 0xfdd835, 0x43a047][i % 4])); car.position.set(Math.cos(a) * 15, Math.sin(a) * 15 - 1, 0); wheel.add(car); car.userData.gondola = true;
  }
  ferris = wheel;
  const sg = signMesh(['MODERN WOODMEN PARK'], 18, 2.2, { bg: '#0d2a4a', fg: '#ffffff', size: 60, w: 1024, h: 128 }); sg.position.set(0, 9, -12); g.add(sg);
  return true;
}
function buildFountain(x, z) {
  const y = terrainHeight(x, z), g = group(x, y, z);
  const pool = new THREE.Mesh(new THREE.CylinderGeometry(9, 9.4, 0.8, 32), mat(0xbcaaa4)); pool.position.y = 0.4; g.add(pool);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.5, 0.1, 32), new THREE.MeshStandardMaterial({ color: 0x4fc3f7, roughness: 0.1 })); water.position.y = 0.75; g.add(water);
  box(g, 0xbcaaa4, 1.2, 3, 1.2, 0, 1.5, 0);
  fountain = new THREE.Mesh(new THREE.ConeGeometry(1.4, 6, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xe1f5fe, transparent: true, opacity: 0.55, side: THREE.DoubleSide, roughness: 0.1 }));
  fountain.position.y = 3.2; g.add(fountain);
  addBoxes('fountain', [makeBox(x, z, 1, 0, 9, 9, y - 1, 1.8)]);
  return true;
}

// ---------- the Arnett Belle: a made-up riverboat casino by the riverfront ----------
export const casino = { door: null, x: 0, z: 0 };
function buildCasino(x0) {
  const w = waterFrom(x0, 150, 0, 1); if (!w) return false;
  const x = w.x, z = w.z + 34, h = Math.PI / 2; // moored along the bank
  // the boat (landmarks/belle.glb): sternwheeler parallel to the bank, boarding door mid-ship facing the shore
  MODELS.push({ file: 'belle', x, z, y: WATER_Y - 0.6, load: 900, onLoad: (r) => { casino.wheel = r.getObjectByName('belle_wheel'); }, onUnload: () => { casino.wheel = null; } });
  // hull walls (boats bump into it), and a gangway to the bank
  const hx = Math.sin(h), hz = Math.cos(h);
  addBoxes('casino', [makeBox(x, z, hz, -hx, 9, 35, WATER_Y - 3, 6)].map((b) => b));
  const gw = group(x, WATER_Y + 1.2, w.z + 12, 0); box(gw, 0x8d6e63, 3, 0.3, 26, 0, 0, 0); box(gw, 0x5d4037, 0.1, 1, 26, 1.4, 0.6, 0); box(gw, 0x5d4037, 0.1, 1, 26, -1.4, 0.6, 0);
  casino.x = x; casino.z = z; casino.door = { x: w.x, z: w.z - 3 };
  ctx.onCasino?.(casino.door, Math.PI);
  return true;
}

// ---------- signs on real landmarks ----------
function buildRoofSign(x, z, text, color, size = 14) { // big letters on the roof of the tallest building at (x, z)
  let top = W.roofAt(x, z); if (!isFinite(top)) top = terrainHeight(x, z) + 12;
  const g = group(x, top, z, 0);
  const s = signMesh([text], size, size / 7, { w: 1024, h: 146, bg: 'rgba(0,0,0,0)', fg: color, size: 110, glow: 1.6 }); s.position.y = size / 14 + 1.2; s.material.transparent = true; g.add(s);
  const s2 = s.clone(); s2.rotation.y = Math.PI / 2; g.add(s2);
  box(g, 0x424242, size, 0.2, 0.2, 0, 1, 0);
  return true;
}

// ---------- rooftop helicopter (stairs from the street) ----------
export const helipad = { x: 0, z: 0, y: 0, ready: false };
function buildHelipad() {
  // the tallest flat roof downtown
  let best = null;
  for (const t of W.tiles.values()) {
    if (t.ox < -300 || t.ox > 500 || t.oz < -300 || t.oz > 300) continue;
    for (const [rel, by, h, pitched] of t.b) {
      if (pitched || h < 25) continue;
      let cx = 0, cz = 0; const n = rel.length / 2; for (let i = 0; i < rel.length; i += 2) { cx += rel[i]; cz += rel[i + 1]; } cx = cx / n + t.ox; cz = cz / n + t.oz;
      if (!best || by + h > best.top) best = { x: cx, z: cz, top: by + h };
    }
  }
  if (!best || W.roofAt(best.x, best.z) < best.top - 0.5) return false;
  const g = group(best.x, best.top + 0.05, best.z);
  const pad = new THREE.Mesh(new THREE.CircleGeometry(7, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: textTexture('H', { w: 256, h: 256, bg: '#3b4048', fg: '#ffc94a', size: 200, border: '#ffc94a' }) }));
  g.add(pad);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const l = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 5), glow(0x76ff03, 3)); l.position.set(Math.cos(a) * 7.2, 0.1, Math.sin(a) * 7.2); g.add(l); }
  helipad.x = best.x; helipad.z = best.z; helipad.y = best.top + 0.05; helipad.ready = true;
  ctx.addHeli(best.x, helipad.y, best.z);
  // stairwell: a door at street level on the side facing the nearest road, and a door hut on the roof
  const q = W.nearestEdge(best.x, best.z, 120);
  if (q) {
    const dx = q.x - best.x, dz = q.z - best.z, l = Math.hypot(dx, dz) || 1;
    let sx = best.x, sz = best.z; for (let d = 0; d < l; d += 0.5) { sx = best.x + (dx / l) * d; sz = best.z + (dz / l) * d; if (W.roofAt(sx, sz) < best.top - 1) break; }
    sx += (dx / l) * 1.2; sz += (dz / l) * 1.2;
    const rx = best.x + (dx / l) * 7.5, rz = best.z + (dz / l) * 7.5;
    if (W.roofAt(rx, rz) >= best.top - 0.5) {
      const hut = group(rx + (dx / l) * 1.5, best.top, rz + (dz / l) * 1.5, Math.atan2(dx, dz)); box(hut, 0x9e9e9e, 2.6, 2.6, 2.2, 0, 1.3, 0); box(hut, 0x37474f, 1, 2, 0.05, 0, 1, -1.11);
      const door = group(sx, terrainHeight(sx, sz), sz, Math.atan2(-dx, -dz)); box(door, 0x37474f, 1.2, 2.2, 0.1, 0, 1.1, 0); const sg = signMesh(['ROOF ACCESS'], 1.4, 0.35, { w: 256, h: 64, bg: '#b71c1c', fg: '#fff', size: 36 }); sg.position.set(0, 2.5, 0.06); door.add(sg);
      doors.push({ x: sx, z: sz, y: terrainHeight(sx, sz), to: { x: rx, z: rz, y: best.top + 0.05, h: Math.atan2(-dx, -dz) }, label: 'Take the stairs to the roof' });
      doors.push({ x: rx, z: rz, y: best.top, to: { x: sx + (dx / l) * 1.5, z: sz + (dz / l) * 1.5, y: terrainHeight(sx, sz), h: Math.atan2(dx, dz) }, label: 'Take the stairs down' });
    }
  }
  return true;
}

// ---------- speedboats tied up by the bank ----------
function buildMarina(x, z) {
  const w = waterFrom(x, z, 0, 1, 400) || waterFrom(x, z, 0, -1, 400) || waterFrom(x, z, 1, 0, 400);
  if (!w) return false;
  const dock = group(w.x, WATER_Y + 0.25, w.z + 8, 0);
  box(dock, 0x8d6e63, 3, 0.3, 22, 0, 0, 0);
  for (let i = 0; i < 3; i++) ctx.addBoat(w.x + (i % 2 ? 4.5 : -4.5), w.z + 4 + i * 6, Math.PI / 2);
  return true;
}

// ---------- billboards: Re-elect Mayor Tim Arnett, on Brady and Kimberly ----------
const SLOGANS = ['He fixed one pothole. Probably.', "Davenport's favourite Tim.", 'Vote Tim. He is already here.', 'Tim Arnett: Mayor of the Mississippi.'];
function initBillboards() {
  const spots = [['Brady Street', 30, -1600], ['Brady Street', 30, -2700], ['Kimberly Road', -700, -3950], ['Kimberly Road', 800, -3970]];
  spots.forEach(([name, x, z], i) => {
    const q = W.nearestEdge(x, z, 400, (e) => e.name.includes(name)); if (!q) return;
    for (const side of [1, -1]) {
      const off = q.e.width / 2 + 7, bx = q.x - Math.cos(q.h) * off * side, bz = q.z + Math.sin(q.h) * off * side;
      if (!W.isLand(bx, bz)) continue;
      const y = terrainHeight(bx, bz), g = group(bx, y, bz, q.h + (side > 0 ? -Math.PI / 2 : Math.PI / 2));
      box(g, 0x5d5d5d, 0.4, 7, 0.4, -4, 3.5, 0); box(g, 0x5d5d5d, 0.4, 7, 0.4, 4, 3.5, 0);
      const s = signMesh(['RE-ELECT MAYOR TIM ARNETT', SLOGANS[i % SLOGANS.length]], 13, 5, { w: 1024, h: 394, bg: '#fff59d', fg: '#c62828', size: 74, border: '#c62828', glow: 0.5 });
      s.position.set(0, 8.5, 0.25); g.add(s);
      box(g, 0x424242, 13.4, 5.4, 0.3, 0, 8.5, 0);
      addBoxes('billboard' + i, [makeBox(bx, bz, Math.cos(q.h), -Math.sin(q.h), 0.4, 4.2, y - 1, 6)]);
      break;
    }
  });
}

// ---------- the river: two barge tows going up and down ----------
const barges = [];
let riverPath = null;
function initRiver() {
  // channel centre line, from the coarse land/water grid
  const c = D.coarse, pts = [];
  let prevZ = 500;
  for (let x = -4800; x <= 600; x += 100) {
    const i = Math.round((x - c.x0) / c.step); if (i < 0 || i >= c.w) continue;
    let runs = [], start = null;
    for (let j = 0; j < c.h; j++) { const wet = c.kind[j * c.w + i] === 1; if (wet && start === null) start = j; if ((!wet || j === c.h - 1) && start !== null) { runs.push([start, j]); start = null; } }
    runs = runs.filter(([a, b]) => (b - a) * c.step > 150).map(([a, b]) => c.z0 + ((a + b) / 2) * c.step);
    if (!runs.length) continue;
    const z = runs.reduce((a, b) => (Math.abs(b - prevZ) < Math.abs(a - prevZ) ? b : a));
    pts.push([x, z]); prevZ = z;
  }
  for (let k = 0; k < 3; k++) for (let i = 1; i < pts.length - 1; i++) pts[i][1] = (pts[i - 1][1] + pts[i][1] * 2 + pts[i + 1][1]) / 4;
  if (pts.length < 3) return;
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  riverPath = { pts, cum, len: cum[cum.length - 1] };
  for (const [off, side] of [[0, -1], [0.55, 1]]) {
    const g = new THREE.Group(); scene.add(g);
    for (let r = 0; r < 3; r++) for (let cI = 0; cI < 2; cI++) { box(g, 0x8d3b2a, 10.5, 2.4, 59, (cI - 0.5) * 10.8, 0.6, 24 + r * 60); box(g, 0x5d2a1e, 9.5, 0.6, 57, (cI - 0.5) * 10.8, 2, 24 + r * 60); }
    box(g, 0xf5f5f5, 12, 3, 22, 0, 1.2, -10); box(g, 0xf5f5f5, 8, 3, 10, 0, 4, -14); box(g, 0x263238, 8.1, 1, 10.1, 0, 4.6, -14); box(g, 0xf5f5f5, 5, 2.4, 5, 0, 7, -16); box(g, 0x1a237e, 5.1, 0.8, 5.1, 0, 7.4, -16);
    box(g, 0x212121, 0.8, 4, 0.8, 1.8, 9, -18); box(g, 0x212121, 0.8, 4, 0.8, -1.8, 9, -18);
    barges.push({ g, off, side, len: 200 });
  }
}
function pathPose(P, s) {
  s = Math.max(0, Math.min(P.len, s));
  let i = 1; while (i < P.cum.length - 1 && P.cum[i] < s) i++;
  const k = (s - P.cum[i - 1]) / (P.cum[i] - P.cum[i - 1] || 1), a = P.pts[i - 1], b = P.pts[i];
  return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, h: Math.atan2(b[0] - a[0], b[1] - a[1]) };
}

// ---------- the freight train ----------
const train = { line: null, cars: [], crossings: [], speed: 9, period: 0 };
function initTrain() {
  if (!D.rail || !D.rail.lines.length) return;
  // the line that runs down 5th Street through downtown
  let best = null, bd = Infinity;
  for (const l of D.rail.lines) for (let i = 0; i < l.length; i += 2) { const d = Math.hypot(l[i] - 0, l[i + 1] + 108); if (d < bd) { bd = d; best = l; } }
  const pts = []; for (let i = 0; i < best.length; i += 2) pts.push([best[i], best[i + 1]]);
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  train.line = { pts, cum, len: cum[cum.length - 1] };
  train.period = (2 * train.line.len) / train.speed;
  // two locomotives and a string of boxcars, hoppers and tankers
  const kinds = ['loco', ...Array.from({ length: 16 }, (_, i) => ['box', 'hopper', 'tank', 'box'][i % 4]), 'loco'];
  let off = 0;
  for (const k of kinds) {
    const len = k === 'loco' ? 21 : 16, g = new THREE.Group(); scene.add(g); g.visible = false;
    const col = k === 'loco' ? 0xd32f2f : k === 'box' ? [0x8d3b2a, 0x546e7a, 0x6d4c41][Math.floor(Math.random() * 3)] : k === 'hopper' ? 0x9e9e9e : 0x263238;
    box(g, 0x212121, 3, 0.8, len, 0, 0.9, 0);
    if (k === 'loco') { box(g, col, 3, 3.2, len * 0.75, 0, 2.9, -len * 0.1); box(g, 0xfafafa, 3.05, 0.4, len * 0.75, 0, 2.2, -len * 0.1); box(g, col, 3, 3.8, 3.5, 0, 3.2, len / 2 - 2.4); box(g, 0x1c2a33, 2.6, 0.9, 0.05, 0, 4.2, len / 2 - 0.62); }
    else if (k === 'tank') { const tk = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, len - 1, 12), mat(col)); tk.rotation.x = Math.PI / 2; tk.position.y = 2.8; g.add(tk); }
    else box(g, col, 3, k === 'hopper' ? 3 : 3.8, len - 0.6, 0, k === 'hopper' ? 2.8 : 3.2, 0);
    for (const zz of [len / 2 - 2, -len / 2 + 2]) box(g, 0x111111, 2.6, 0.9, 2.4, 0, 0.45, zz);
    train.cars.push({ g, len, off: off + len / 2, T: { len, wid: 3.1, hgt: 4.5, mass: 400 }, x: 0, z: 0, y: 0, h: 0, vx: 0, vz: 0, w: 0 });
    off += len + 1;
  }
  train.length = off;
  // crossings: where the track crosses a street
  const L = train.line;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
    for (const id of W.edgesNear((ax + bx) / 2, (az + bz) / 2, Math.hypot(bx - ax, bz - az) / 2 + 30)) {
      const e = G.edges[id]; if (e.cls === 'service' && e.len < 40) continue;
      for (let k = 2; k < e.pts.length; k += 2) {
        const cx = e.pts[k - 2], cz = e.pts[k - 1], dx = e.pts[k], dz = e.pts[k + 1];
        const den = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx); if (Math.abs(den) < 1e-6) continue;
        const t = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / den, u = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / den;
        if (t < 0 || t > 1 || u < 0 || u > 1) continue;
        const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        if (train.crossings.some((c) => Math.hypot(c.x - x, c.z - z) < 15)) continue;
        train.crossings.push({ x, z, s: L.cum[i - 1] + Math.hypot(x - ax, z - az), e, rh: Math.atan2(dx - cx, dz - cz), down: 0, g: null });
      }
    }
  }
}
function trainHead(tSec) {
  const L = train.line, d = ((tSec * train.speed) % (2 * L.len) + 2 * L.len) % (2 * L.len);
  return d <= L.len ? { s: d, dir: 1 } : { s: 2 * L.len - d, dir: -1 };
}
function buildGates(c) {
  const g = new THREE.Group(); scene.add(g); c.g = g; c.arms = []; c.lamps = [];
  const y = terrainHeight(c.x, c.z);
  for (const side of [-1, 1]) {
    // one gate on each side of the track, on the right-hand side of each lane of traffic
    const off = c.e.width / 2 + 0.7, along = 4.5 * side;
    const rx = -Math.cos(c.rh), rz = Math.sin(c.rh), fx = Math.sin(c.rh), fz = Math.cos(c.rh);
    const px = c.x + fx * along + rx * off * -side, pz = c.z + fz * along + rz * off * -side;
    const post = new THREE.Group(); post.position.set(px, y, pz); post.rotation.y = c.rh + (side > 0 ? 0 : Math.PI); g.add(post);
    box(post, 0xeeeeee, 0.25, 3.4, 0.25, 0, 1.7, 0);
    const cross = box(post, 0xffffff, 1.6, 0.25, 0.05, 0, 3.1, 0); cross.rotation.z = 0.7; const cross2 = box(post, 0xffffff, 1.6, 0.25, 0.05, 0, 3.1, 0); cross2.rotation.z = -0.7;
    for (const lx of [-0.35, 0.35]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), glow(0xff1744, 4)); l.position.set(lx, 2.5, 0.15); post.add(l); c.lamps.push(l.material); }
    const arm = new THREE.Group(); arm.position.set(0, 1.1, 0); post.add(arm);
    const bar = box(arm, 0xffffff, c.e.width / 2 + 0.6, 0.18, 0.12, (c.e.width / 2 + 0.6) / 2 * side * -1 + 0, 0, 0);
    bar.position.x = -(c.e.width / 2 + 0.6) / 2;
    for (let k = 0; k < 4; k++) box(arm, 0xe53935, 0.4, 0.2, 0.14, -(k * 1.2 + 0.8), 0, 0);
    c.arms.push(arm);
  }
}
export const trainCars = train.cars;
// Which crossings have their gates down right now (traffic stops there).
export function closedCrossings() { return train.crossings.filter((c) => c.down > 0.5); }

// ---------- per frame ----------
export function updateLandmarks(dt, tSec, focus, n) {
  updateModels(dt, focus);
  for (const [m, k] of night) m.emissiveIntensity = n * k;
  const flashOn = Math.floor(tSec * 2) % 2 === 0;
  for (const f of flashers) for (const m of f.userData.flash) m.emissiveIntensity = flashOn ? 3 : 0.2;
  if (ferris) { ferris.rotation.z += dt * 0.12; for (const c of ferris.children) if (c.userData.gondola) c.rotation.z = -ferris.rotation.z; }
  if (fountain) { fountain.scale.y = 0.85 + Math.sin(tSec * 2.1) * 0.15; }
  if (casino.wheel) casino.wheel.rotation.z += dt * 0.6;
  // barges
  if (riverPath) for (const b of barges) {
    const span = riverPath.len - b.len - 50, period = (2 * span) / 2.4;
    const d = ((tSec / period + b.off) % 1) * 2 * span, s = d <= span ? d : 2 * span - d, dirF = d <= span ? 1 : -1;
    const p = pathPose(riverPath, s + 25), nx = -Math.cos(p.h), nz = Math.sin(p.h);
    b.g.position.set(p.x + nx * 90 * b.side, WATER_Y - 0.8, p.z + nz * 90 * b.side);
    b.g.rotation.y = dirF > 0 ? p.h : p.h + Math.PI;
    b.x = b.g.position.x; b.z = b.g.position.z; b.h = b.g.rotation.y;
  }
  // train
  if (train.line) {
    const head = trainHead(tSec), L = train.line;
    const near2 = (x, z) => focus && Math.hypot(x - focus.x, z - focus.z) < 650;
    for (const c of train.cars) {
      const s = head.s - c.off * head.dir;
      const on = s > 0 && s < L.len;
      if (!on) { c.g.visible = false; c.active = false; continue; }
      const p = pathPose(L, s);
      c.x = p.x; c.z = p.z; c.h = head.dir > 0 ? p.h : p.h + Math.PI; c.y = terrainHeight(p.x, p.z) + 0.25;
      c.vx = Math.sin(c.h) * train.speed; c.vz = Math.cos(c.h) * train.speed; c.active = true;
      c.g.visible = near2(c.x, c.z);
      if (c.g.visible) { c.g.position.set(c.x, c.y, c.z); c.g.rotation.y = c.h; }
    }
    // gates come down when the train is within 160 m of the crossing (or on it)
    const tail = head.s - train.length * head.dir;
    for (const c of train.crossings) {
      const lo = Math.min(head.s, tail) - 160, hi = Math.max(head.s, tail) + 160;
      const want = c.s > lo && c.s < hi ? 1 : 0;
      c.down += Math.sign(want - c.down) * Math.min(Math.abs(want - c.down), dt * 0.5);
      if (focus && Math.hypot(c.x - focus.x, c.z - focus.z) < 400) {
        if (!c.g) buildGates(c);
        c.g.visible = true;
        for (const a of c.arms) a.rotation.z = (1 - c.down) * 1.45 * (a.parent.rotation.y > 0 ? 1 : 1);
        const lit = c.down > 0.05 && Math.floor(tSec * 3) % 2;
        c.lamps.forEach((m, i) => { m.emissiveIntensity = c.down > 0.05 ? ((i % 2) === (lit ? 1 : 0) ? 4 : 0.1) : 0; });
      } else if (c.g) c.g.visible = false;
    }
    // horn when the train nears a crossing close to you
    for (const c of train.crossings) {
      const ds = Math.abs(c.s - head.s);
      if (ds < 90 && ds > 60 && focus && Math.hypot(c.x - focus.x, c.z - focus.z) < 350 && (!c.hornT || tSec - c.hornT > 20)) { c.hornT = tSec; ctx.horn(c.x, c.z); }
    }
  }
}
export function bargeList() { return barges.filter((b) => b.x !== undefined).map((b) => ({ x: b.x - Math.sin(b.h) * -60, z: b.z - Math.cos(b.h) * -60, h: b.h, T: { len: 200, wid: 22, hgt: 6, mass: 2000 }, vx: 0, vz: 0, w: 0, y: WATER_Y })); }
