// The island: one long curved key. Positions use (s, d): s = distance along the island's spine,
// d = sideways offset (d > 0 is the ocean/beach side, d < 0 is the bay/docks side).
import * as THREE from 'three';
import { rng, clamp, textTexture, rayOBB, headingOf } from './util.js';
import { makeCharacter, mat } from './character.js';

export const R = 900, L = 1100;
const CX = 0, CZ = 880;
const TH0 = -Math.PI / 2 - L / (2 * R);
export const theta = (s) => TH0 + s / R;
export function P(s, d) {
  const t = theta(s);
  return { x: CX + (R + d) * Math.cos(t), z: CZ + (R + d) * Math.sin(t) };
}
export function toSD(x, z) {
  const dx = x - CX, dz = z - CZ;
  return { s: (Math.atan2(dz, dx) - TH0) * R, d: Math.hypot(dx, dz) - R };
}
export const roadHeading = (s) => -theta(s); // facing +s
const W_S = (p) => toSD(p.x, p.z).s, W_D = (p) => toSD(p.x, p.z).d;
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export function hw(s) { const e = Math.min(s, L - s); return 14 + 71 * sm(0, 130, e); }

export const BRIDGE_END = -130;
export const CROSS = Array.from({ length: 10 }, (_, i) => 140 + (i * 820) / 9);
export const colliders = []; // {cx,cz,ux,uz,vx,vz,hu,hv,h,br}
export const docks = [];
export const islets = [];
export const parkedSpots = [];
export const places = {};
// Materials and lists the day/night + weather system tweaks at runtime.
export const env = { glowSpots: [] };
export const ramps = [];

// Height of the ground at a point (ramps raise it; everything else is flat at 0).
export function groundHeight(x, z) {
  let g = 0;
  for (const r of ramps) {
    const dx = x - r.x, dz = z - r.z;
    const a = dx * r.fx + dz * r.fz, l = dx * r.fz - dz * r.fx;
    if (Math.abs(a) < r.len / 2 && Math.abs(l) < r.wid / 2) { const h = (r.h * (a + r.len / 2)) / r.len; if (h > g) g = h; }
  }
  return g;
}

function addRamp(scene, s, d, dir, len, wid, h) {
  const p = P(s, d), hd = -theta(s) + (dir > 0 ? 0 : Math.PI);
  const r = { x: p.x, z: p.z, h, len, wid, fx: Math.sin(hd), fz: Math.cos(hd), s };
  ramps.push(r);
  const L = len / 2, Wd = wid / 2;
  const v = (x, y, z) => [x, y, z];
  const BL = v(-Wd, 0, -L), BR = v(Wd, 0, -L), FL = v(-Wd, 0, L), FR = v(Wd, 0, L), TL = v(-Wd, h, L), TR = v(Wd, h, L);
  const tris = [BL, BR, TR, BL, TR, TL, FL, TL, TR, FL, TR, FR, BL, TL, FL, BR, FR, TR, BL, FL, FR, BL, FR, BR];
  const pos = new Float32Array(tris.flat());
  const uv = new Float32Array(tris.flatMap((q) => [q[0] / wid + 0.5, (q[2] + L) / len * 3]));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, rampMat());
  m.position.set(p.x, 0.02, p.z); m.rotation.y = hd;
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
}
let _rampMat = null;
function rampMat() {
  if (_rampMat) return _rampMat;
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#ffb300'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#212121'; for (let i = -64; i < 128; i += 22) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 11, 0); x.lineTo(i + 75, 64); x.lineTo(i + 64, 64); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  _rampMat = new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide });
  return _rampMat;
}

export function isLand(x, z) {
  const { s, d } = toSD(x, z);
  if (s >= 0 && s <= L && Math.abs(d) <= hw(s)) return true;
  if (s < 0 && s >= BRIDGE_END - 1 && Math.abs(d) <= 6.6) return true;
  if (s <= -157 && s >= -198 && d >= -8 && d <= 18) return true; // far side of the broken bridge
  for (const k of docks) if (s >= k.s0 && s <= k.s1 && d >= k.d0 && d <= k.d1) return true;
  for (const i of islets) { const dx = x - i.x, dz = z - i.z; if (dx * dx + dz * dz <= i.r * i.r) return true; }
  return false;
}

function addCollider(sc, dc, lenS, depth, h, extra = {}) {
  const t = theta(sc), p = P(sc, dc);
  const hv = (lenS * (R + dc)) / R / 2, hu = depth / 2;
  const b = { cx: p.x, cz: p.z, ux: Math.cos(t), uz: Math.sin(t), vx: -Math.sin(t), vz: Math.cos(t), hu, hv, h, br: Math.hypot(hu, hv), rot: -t, ...extra };
  colliders.push(b);
  return b;
}

// Push a circle out of every building/wall. Returns new position and the push normal.
export function pushOutCircle(x, z, r) {
  let hit = false, nx = 0, nz = 0;
  for (const b of colliders) {
    const dx = x - b.cx, dz = z - b.cz;
    if (Math.abs(dx) > b.br + r || Math.abs(dz) > b.br + r) continue;
    const lu = dx * b.ux + dz * b.uz, lv = dx * b.vx + dz * b.vz;
    const cu = clamp(lu, -b.hu, b.hu), cv = clamp(lv, -b.hv, b.hv);
    const du = lu - cu, dv = lv - cv;
    const d2 = du * du + dv * dv;
    if (d2 > r * r) continue;
    let pu, pv;
    if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; pu = du * k; pv = dv * k; }
    else {
      const ou = b.hu - Math.abs(lu) + r, ov = b.hv - Math.abs(lv) + r;
      if (ou < ov) { pu = Math.sign(lu || 1) * ou; pv = 0; } else { pv = Math.sign(lv || 1) * ov; pu = 0; }
    }
    const wx = pu * b.ux + pv * b.vx, wz = pu * b.uz + pv * b.vz;
    x += wx; z += wz; hit = true;
    const l = Math.hypot(wx, wz) || 1; nx = wx / l; nz = wz / l;
  }
  return { x, z, hit, nx, nz };
}

export function rayBuildings(ox, oy, oz, dx, dy, dz, maxT = 400) {
  let best = maxT;
  for (const b of colliders) {
    const t = rayOBB(ox, oy, oz, dx, dy, dz, b.cx, b.h / 2, b.cz, b.ux, b.uz, b.hu, b.h / 2, b.vx, b.vz, b.hv);
    if (t < best) best = t;
  }
  return best;
}
export function lineOfSight(x1, y1, z1, x2, y2, z2) {
  const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1, l = Math.hypot(dx, dy, dz) || 1;
  return rayBuildings(x1, y1, z1, dx / l, dy / l, dz / l, l) >= l - 0.01;
}

// ---------- mesh building ----------
const groundPos = [], groundCol = [], groundIdx = [];
// walkable ground for the navigation mesh (same triangles as the visible ground)
export const navSource = { pos: groundPos, idx: groundIdx };
function addStrip(s0, s1, dA, dB, y, color, step = 8) {
  const fa = typeof dA === 'function' ? dA : () => dA;
  const fb = typeof dB === 'function' ? dB : () => dB;
  const c = new THREE.Color(color);
  const n = Math.max(1, Math.ceil((s1 - s0) / step));
  const base = groundPos.length / 3;
  for (let i = 0; i <= n; i++) {
    const s = s0 + ((s1 - s0) * i) / n;
    const a = P(s, fa(s)), b = P(s, fb(s));
    groundPos.push(a.x, y, a.z, b.x, y, b.z);
    groundCol.push(c.r, c.g, c.b, c.r, c.g, c.b);
    if (i < n) { const k = base + i * 2; groundIdx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
}

function sign(lines, w, h, opts) {
  const tex = textTexture(lines, opts);
  const m = new THREE.MeshLambertMaterial({ map: tex });
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(w, h);
  const front = new THREE.Mesh(geo, m); front.position.z = 0.03; g.add(front);
  const back = new THREE.Mesh(geo, m); back.rotation.y = Math.PI; back.position.z = -0.03; g.add(back);
  const board = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, h + 0.2, 0.05), mat(0x444444)); g.add(board);
  return g;
}
function posts(group, w, height, color = 0x666666) {
  const geo = new THREE.BoxGeometry(0.2, height, 0.2);
  for (const x of [-w / 2 + 0.3, w / 2 - 0.3]) { const p = new THREE.Mesh(geo, mat(color)); p.position.set(x, -height / 2, 0); group.add(p); }
}

const COLORS = {
  grass: 0x8fd16b, plot: 0xe9e4d6, road: 0x4b5058, walk: 0xd3cec4, sand: 0xf3e2a9,
  park: 0x6cc35a, lot: 0x5d626a, line: 0xf7d14a, water: 0x38bfe0,
};
const BUILD_COLORS = [0xf6c1a6, 0xa8d8ea, 0xf9e79f, 0xc3e6cb, 0xf5b7b1, 0xd7bde2, 0xfdebd0, 0xaed6f1, 0xfafafa, 0xffd6a5, 0xcaffbf];

export function buildWorld(scene) {
  const r = rng(20261119);
  // --- ground layers ---
  addStrip(0, L, (s) => -hw(s), (s) => Math.min(57, hw(s)), 0, COLORS.grass, 6);
  addStrip(0, L, (s) => Math.min(57, hw(s)), (s) => hw(s), 0, COLORS.sand, 6);
  addStrip(0, L, -7, 7, 0.04, COLORS.road, 6);
  addStrip(0, L, -0.14, 0.14, 0.07, COLORS.line, 6);
  addStrip(0, L, 7, 10.5, 0.06, COLORS.walk, 6);
  addStrip(0, L, -10.5, -7, 0.06, COLORS.walk, 6);
  addStrip(135, 965, 43, 53, 0.04, COLORS.road, 6);
  addStrip(135, 965, -53, -43, 0.04, COLORS.road, 6);
  addStrip(135, 965, 39.5, 43, 0.06, COLORS.walk, 6);
  addStrip(135, 965, -43, -39.5, 0.06, COLORS.walk, 6);
  for (const c of CROSS) addStrip(c - 5, c + 5, -53, 53, 0.045, COLORS.road, 10);
  // bridge deck
  addStrip(BRIDGE_END, 0, -6.5, 6.5, 0.05, COLORS.road, 5);
  addStrip(BRIDGE_END, 0, -0.14, 0.14, 0.08, COLORS.line, 5);

  const buildings = [];
  const addB = (sc, dc, len, depth, h, color, extra = {}) => { const b = addCollider(sc, dc, len, depth, h, { sc, dc, lenS: len, depth, ...extra }); b.color = color; buildings.push(b); return b; };

  // --- blocks between cross streets ---
  for (let i = 0; i < 9; i++) {
    const sA = CROSS[i] + 7.5, sB = CROSS[i + 1] - 7.5, mid = (sA + sB) / 2, len = sB - sA;
    const center = 1 - Math.abs(mid - L / 2) / (L / 2);
    for (const row of ['A', 'B', 'C']) {
      const [d0, d1] = row === 'A' ? [13, 38] : row === 'B' ? [-38, -13] : [-80, -57];
      const plotD = row === 'A' ? [10.5, 39.5] : row === 'B' ? [-39.5, -10.5] : [-82, -53];
      const key = row + i;
      if (key === 'A4') { // statue park
        addStrip(sA - 2.5, sB + 2.5, plotD[0], plotD[1], 0.03, COLORS.park, 10);
        places.park = { s: mid, d: 25.5 };
        continue;
      }
      if (key === 'B8') { // gas station
        addStrip(sA - 2.5, sB + 2.5, plotD[0], plotD[1], 0.03, COLORS.lot, 10);
        places.gas = { s: mid, d: -24 };
        addB(mid + 24, -32, 18, 10, 4.5, 0xffffff, { row: 'B', shop: 'ARNETT GAS' });
        continue;
      }
      if (key === 'A2' || key === 'B6') { // parking lots
        addStrip(sA - 2.5, sB + 2.5, plotD[0], plotD[1], 0.03, COLORS.lot, 10);
        const dc = (d0 + d1) / 2;
        for (let k = 0; k < 6; k++) {
          const s = sA + 6 + k * ((len - 12) / 5);
          for (const side of [-1, 1]) {
            const p = P(s, dc + side * 6);
            const t = theta(s);
            parkedSpots.push({ x: p.x, z: p.z, h: headingOf(side * Math.cos(t), side * Math.sin(t)) });
          }
        }
        continue;
      }
      addStrip(sA - 2.5, sB + 2.5, plotD[0], plotD[1], 0.03, COLORS.plot, 10);
      if (row === 'C') {
        // waterfront warehouses, leaving gaps at the docks
        const n = 2;
        const gap = 10, bl = (len - gap) / n;
        for (let k = 0; k < n; k++) {
          const sc = sA + bl / 2 + k * (bl + gap);
          if (DOCK_S.some((ds) => Math.abs(ds - sc) < bl / 2 + 20)) continue;
          addB(sc, -69, bl, 20, 5 + r() * 5, [0xb0bec5, 0xd7ccc8, 0xffe0b2, 0xb3e5fc][Math.floor(r() * 4)]);
        }
        continue;
      }
      const n = 2 + (r() < 0.5 ? 1 : 0);
      const gap = 4 + r() * 3, bl = (len - gap * (n - 1)) / n;
      for (let k = 0; k < n; k++) {
        const sc = sA + bl / 2 + k * (bl + gap);
        const depth = (d1 - d0) * (0.65 + r() * 0.35);
        const dc = row === 'A' ? d0 + depth / 2 : d1 - depth / 2;
        let h = 7 + r() * 12 + center * 16 * r();
        let color = BUILD_COLORS[Math.floor(r() * BUILD_COLORS.length)];
        if (key === 'B3' && k === 0) { h = 12; color = 0xffffff; places.clinic = { s: sc, d: dc, depth }; }
        addB(sc, dc, bl, depth, h, color, { row });
      }
    }
  }
  // --- small houses at the tips ---
  for (const [a, b] of [[22, 125], [975, 1080]]) {
    for (let s = a; s < b; s += 17 + r() * 6) {
      for (const side of [-1, 1]) {
        if (r() < 0.3 || (s > 1040 && side < 0)) continue;
        const depth = 7 + r() * 3, dc = side * (16 + depth / 2 + r() * 3);
        if (Math.abs(dc) + depth / 2 > hw(s) - 3) continue;
        addB(s, dc, 8 + r() * 4, depth, 3.5 + r() * 2.5, BUILD_COLORS[Math.floor(r() * BUILD_COLORS.length)]);
      }
    }
  }
  // Tim's Bait & Tackle shack by the middle dock
  addB(DOCK_S[1] + 14, -76, 12, 8, 4.5, 0x4fc3f7);
  // beach road shoulder parking
  for (let s = 170; s < 940; s += 50) {
    const p = P(s, 55.2);
    parkedSpots.push({ x: p.x, z: p.z, h: roadHeading(s) + (r() < 0.5 ? 0 : Math.PI) });
  }

  // --- docks ---
  for (const ds of DOCK_S) {
    const d1 = -hw(ds) + 1.5, d0 = -128;
    docks.push({ s0: ds - 3, s1: ds + 3, d0, d1, s: ds });
    const p = P(ds, (d0 + d1) / 2);
    const m = new THREE.Mesh(new THREE.BoxGeometry(d1 - d0, 0.45, 6), mat(0xa47148));
    m.position.set(p.x, -0.17, p.z); m.rotation.y = -theta(ds);
    scene.add(m);
    for (let dd = d0 + 2; dd < d1; dd += 8) for (const ss of [-2.7, 2.7]) {
      const q = P(ds + ss, dd);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.2, 6), mat(0x6d4c33));
      post.position.set(q.x, -0.6, q.z); scene.add(post);
    }
  }

  // --- islets ---
  const ir = rng(99);
  for (let k = 0; k < 10; k++) {
    const s = 60 + ir() * 980, side = k % 2 ? 1 : -1;
    const d = side * (hw(s) + 70 + ir() * 200);
    const p = P(s, d);
    islets.push({ x: p.x, z: p.z, r: 7 + ir() * 16 });
  }
  { const p = P(L + 3, 0); islets.push({ x: p.x, z: p.z, r: 15 }); }
  for (const i of islets) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(i.r, i.r * 1.15, 0.6, 18), mat(COLORS.sand));
    m.position.set(i.x, -0.28, i.z); scene.add(m);
  }

  // --- bridge rails, barrier, pillars, broken stub ---
  for (let s = BRIDGE_END; s < 0; s += 10) {
    for (const side of [-1, 1]) {
      const b = addCollider(s + 5, side * 6.4, 10, 0.4, 1.1);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.1, b.hv * 2), mat(0xb0b0b0));
      m.position.set(b.cx, 0.55, b.cz); m.rotation.y = b.rot; scene.add(m);
    }
    const p = P(s + 5, 0);
    const pil = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 3), mat(0x9e9e9e));
    pil.position.set(p.x, -3.2, p.z); scene.add(pil);
  }
  {
    const stub = P(-178, 5);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(26, 0.6, 40), mat(0x8a8f96));
    deck.position.set(stub.x, -0.3, stub.z); deck.rotation.y = -theta(-178); scene.add(deck);
    for (const ps of [-188, -168]) { const q = P(ps, 0); const pil = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 3), mat(0x9e9e9e)); pil.position.set(q.x, -3.4, q.z); scene.add(pil); }
    const sg = sign(['BRIDGE OUT', 'Jump at your own risk'], 6, 2.2, { bg: '#ffffff', fg: '#d35400', size: 60, border: '#d35400' });
    const q = P(BRIDGE_END + 6, 4.5);
    sg.position.set(q.x, 2.6, q.z); sg.rotation.y = -theta(BRIDGE_END) + Math.PI; posts(sg, 6, 2.6); scene.add(sg);
  }

  // --- stunt ramps ---
  addRamp(scene, -120, 0, -1, 16, 11, 3.2);   // jump the broken bridge
  addRamp(scene, 300, 72, 1, 12, 5, 2.2);
  addRamp(scene, 520, 70, -1, 12, 5, 2.2);
  addRamp(scene, 780, 72, 1, 14, 5, 3);
  addRamp(scene, 1088, 0, 1, 10, 7, 2);       // launch into the sea

  // --- buildings: one merged mesh with a window texture, tinted per building ---
  {
    const pos = [], nor = [], uv = [], colr = [], idx = [];
    const col = new THREE.Color(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    for (const b of buildings) {
      const w = b.hu * 2, dd = b.hv * 2;
      const g = new THREE.BoxGeometry(w, b.h, dd);
      g.translate(0, b.h / 2, 0);
      const U = g.attributes.uv;
      for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
        const i = f * 4 + k;
        if (f === 2 || f === 3) { U.setXY(i, 0.03, 0.03); continue; }
        const span = f < 2 ? dd : w;
        // the window texture holds 4x4 windows, so divide by 4 (lets each window be lit or dark at night)
        U.setXY(i, (U.getX(i) * Math.max(1, Math.round(span / 4)) + b.cx * 0.37) / 4, (U.getY(i) * Math.max(1, Math.round(b.h / 3.4))) / 4);
      }
      m4.compose(new THREE.Vector3(b.cx, 0, b.cz), q.setFromAxisAngle(up, b.rot), new THREE.Vector3(1, 1, 1));
      g.applyMatrix4(m4);
      const base = pos.length / 3;
      pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); uv.push(...g.attributes.uv.array);
      col.setHex(b.color);
      for (let i = 0; i < g.attributes.position.count; i++) colr.push(col.r, col.g, col.b);
      for (const i of g.index.array) idx.push(base + i);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    geo.setIndex(idx);
    const [dayTex, litTex] = windowTextures();
    const bm = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: dayTex, vertexColors: true, emissiveMap: litTex, emissive: 0xffd27a, emissiveIntensity: 0 }));
    env.buildings = bm.material;
    bm.castShadow = true; bm.receiveShadow = true;
    scene.add(bm);
    // roof rims + rooftop clutter
    const bgeo = new THREE.BoxGeometry(1, 1, 1); bgeo.translate(0, 0.5, 0);
    const roof = new THREE.InstancedMesh(bgeo, new THREE.MeshLambertMaterial({ color: 0x9a9a9a }), buildings.length);
    const acs = [];
    const o = new THREE.Object3D();
    buildings.forEach((b, i) => {
      o.position.set(b.cx, b.h, b.cz); o.rotation.set(0, b.rot, 0); o.scale.set(b.hu * 2 + 0.3, 0.45, b.hv * 2 + 0.3); o.updateMatrix(); roof.setMatrixAt(i, o.matrix);
      if (b.h > 6) for (let k = 0; k < 1 + Math.floor(r() * 3); k++) acs.push({ b, u: (r() - 0.5) * b.hu, v: (r() - 0.5) * b.hv, s: 0.8 + r() * 1.2 });
    });
    roof.castShadow = true;
    const ac = new THREE.InstancedMesh(bgeo, new THREE.MeshLambertMaterial({ color: 0xcfd8dc }), acs.length);
    acs.forEach((a, i) => {
      o.position.set(a.b.cx + a.u * a.b.ux + a.v * a.b.vx, a.b.h + 0.4, a.b.cz + a.u * a.b.uz + a.v * a.b.vz);
      o.rotation.set(0, a.b.rot, 0); o.scale.set(a.s * 1.4, a.s, a.s); o.updateMatrix(); ac.setMatrixAt(i, o.matrix);
    });
    ac.castShadow = true;
    scene.add(roof, ac);
    // shop fronts on the main road: awning + name sign
    const SHOPS = ['TIM-MART', 'ARNETT PAWN', 'SURF SHACK', 'PALM MOTEL', 'KEY LIME CAFE', 'TACO TIM', 'CONCH BURGER', 'ISLAND ARCADE', 'LUCKY 7 LAUNDRY', 'REEF RECORDS', 'ARNETT AUTO', 'GATOR GYM', 'SUNSET VIDEO', 'TIMS TATTOOS', 'COCONUT BANK', 'BAIT N BREW', 'MANGO NAILS', 'PELICAN PIZZA'];
    const SIGN_COLORS = [['#ff5e5b', '#fff'], ['#1e88e5', '#fff'], ['#ffd23f', '#222'], ['#2e7d32', '#fff'], ['#6a1b9a', '#ffeb3b'], ['#111', '#00e5ff']];
    let si = 0;
    for (const b of buildings) {
      const shop = b.shop || (b.row && r() < 0.7 ? SHOPS[si++ % SHOPS.length] : null);
      if (!shop) continue;
      const toward = b.row === 'A' ? -1 : 1;
      const fd = b.dc + toward * (b.depth / 2 + 0.05);
      const t = theta(b.sc);
      const face = headingOf(toward * Math.cos(t), toward * Math.sin(t));
      const wlen = Math.min(b.lenS - 2, 14);
      const [bg, fg] = SIGN_COLORS[Math.floor(r() * SIGN_COLORS.length)];
      const sg = sign(shop, wlen * 0.8, 1.3, { bg, fg, size: 64, w: 512, h: 96 });
      const p = P(b.sc, fd + toward * 0.1);
      sg.position.set(p.x, 4.3, p.z); sg.rotation.y = face; scene.add(sg);
      const aw = new THREE.Mesh(new THREE.BoxGeometry(wlen, 0.15, 2), mat([0xff5e5b, 0x1e88e5, 0x2e7d32, 0xffb300, 0xffffff][Math.floor(r() * 5)]));
      const ap = P(b.sc, fd + toward * 1);
      aw.position.set(ap.x, 3.1, ap.z); aw.rotation.y = face; aw.rotation.x = 0; aw.castShadow = true; scene.add(aw);
      const door = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.6), mat(0x37474f));
      const dp = P(b.sc, fd + toward * 0.03);
      door.position.set(dp.x, 1.3, dp.z); door.rotation.y = face; scene.add(door);
    }
  }

  const o = new THREE.Object3D(), col = new THREE.Color();
  // --- palms ---
  const palms = [];
  for (let s = 20; s < L - 10; s += 26 + r() * 10) {
    for (const side of [-1, 1]) if (r() < 0.75) palms.push(P(s, side * 11.8));
  }
  for (let k = 0; k < 120; k++) { const s = 30 + r() * (L - 60); const d = 60 + r() * (hw(s) - 64); if (d > 58) palms.push(P(s, d)); }
  for (const i of islets) if (i.r > 10) palms.push({ x: i.x + 2, z: i.z - 1 }, { x: i.x - 3, z: i.z + 3 });
  const tgeo = new THREE.CylinderGeometry(0.17, 0.27, 5.2, 5); tgeo.translate(0, 2.6, 0);
  const cgeo = new THREE.ConeGeometry(2.4, 1.3, 7); cgeo.translate(0, 5.6, 0);
  const trunks = new THREE.InstancedMesh(tgeo, mat(0x9b7653), palms.length);
  const crowns = new THREE.InstancedMesh(cgeo, mat(0x2e9e48), palms.length);
  palms.forEach((p, i) => {
    o.position.set(p.x, 0, p.z); o.rotation.set(0, r() * 6, 0); const sc = 0.8 + r() * 0.5; o.scale.set(sc, sc, sc); o.updateMatrix();
    trunks.setMatrixAt(i, o.matrix); crowns.setMatrixAt(i, o.matrix);
  });
  trunks.castShadow = crowns.castShadow = true;
  scene.add(trunks, crowns);

  // --- beach umbrellas & towels ---
  const ub = [];
  for (let k = 0; k < 60; k++) { const s = 160 + r() * 780; ub.push({ p: P(s, 64 + r() * 18), c: [0xff5e5b, 0xffd23f, 0x3bceac, 0x5b8cff, 0xffffff][k % 5] }); }
  const ugeo = new THREE.ConeGeometry(1.6, 0.7, 8); ugeo.translate(0, 2.3, 0);
  const pgeo = new THREE.CylinderGeometry(0.05, 0.05, 2.3, 4); pgeo.translate(0, 1.15, 0);
  const umb = new THREE.InstancedMesh(ugeo, new THREE.MeshLambertMaterial(), ub.length);
  const pol = new THREE.InstancedMesh(pgeo, mat(0xeeeeee), ub.length);
  const tow = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.04, 1.9), new THREE.MeshLambertMaterial(), ub.length);
  ub.forEach((u, i) => {
    o.position.set(u.p.x, 0, u.p.z); o.rotation.set(0, r() * 6, 0); o.scale.set(1, 1, 1); o.updateMatrix();
    umb.setMatrixAt(i, o.matrix); umb.setColorAt(i, col.setHex(u.c)); pol.setMatrixAt(i, o.matrix);
    o.position.set(u.p.x + 1.4, 0.03, u.p.z + 0.6); o.updateMatrix(); tow.setMatrixAt(i, o.matrix);
    env.towels = env.towels || []; env.towels.push({ x: u.p.x + 1.4, z: u.p.z + 0.6, h: o.rotation.y }); tow.setColorAt(i, col.setHex(BUILD_COLORS[i % BUILD_COLORS.length]));
  });
  scene.add(umb, pol, tow);

  // --- ground + water ---
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.Float32BufferAttribute(groundPos, 3));
  gg.setAttribute('color', new THREE.Float32BufferAttribute(groundCol, 3));
  gg.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(groundPos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  gg.setIndex(groundIdx);
  { const gm = new THREE.Mesh(gg, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); gm.receiveShadow = true; scene.add(gm); env.ground = gm.material; }
  // island "skirt" so the edge doesn't float above the water
  const skirt = new THREE.Mesh(new THREE.BufferGeometry(), mat(0xd8c48a));
  {
    const pos = [], idx = [];
    const ring = [];
    for (let s = 0; s <= L; s += 6) ring.push(P(s, hw(s)));
    for (let s = L; s >= 0; s -= 6) ring.push(P(s, -hw(s)));
    ring.forEach((p, i) => { pos.push(p.x, 0, p.z, p.x, -1.5, p.z); if (i < ring.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } });
    skirt.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    skirt.geometry.setIndex(idx); skirt.geometry.computeVertexNormals();
    skirt.material = new THREE.MeshLambertMaterial({ color: 0xd8c48a, side: THREE.DoubleSide });
  }
  scene.add(skirt);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshPhongMaterial({ color: 0x29b6d6, specular: 0xbfefff, shininess: 90 }));
  water.receiveShadow = true;
  env.water = water.material;
  water.rotation.x = -Math.PI / 2; water.position.y = -0.15;
  scene.add(water);
  const shallow = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial({ color: 0x7fe3ee, side: THREE.DoubleSide }));
  {
    const pos = [], idx = [];
    for (const side of [-1, 1]) {
      const base = pos.length / 3;
      let n = 0;
      for (let s = 0; s <= L; s += 8, n++) {
        const a = P(s, side * hw(s)), b = P(s, side * (hw(s) + 28));
        pos.push(a.x, -0.13, a.z, b.x, -0.13, b.z);
        if (s + 8 <= L) { const k = base + n * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
    }
    shallow.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    shallow.geometry.setIndex(idx); shallow.geometry.computeVertexNormals();
  }
  scene.add(shallow);

  // --- landmarks ---
  // Welcome sign by the bridge
  {
    const sg = sign(['WELCOME TO', 'TIM ARNETT TOWN'], 10, 3.2, { bg: '#1e88e5', fg: '#ffffff', size: 64, border: '#ffeb3b' });
    const p = P(22, 13.5);
    sg.position.set(p.x, 4.2, p.z); sg.rotation.y = -theta(22) + Math.PI; posts(sg, 10, 4.2, 0xffffff); scene.add(sg);
    addCollider(22, 13.5, 0.6, 10, 5);
  }
  // Statue park
  {
    const { s, d } = places.park;
    const p = P(s, d);
    const ped = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 3.2), mat(0xbdbdbd));
    ped.position.set(p.x, 1.1, p.z); ped.rotation.y = -theta(s); scene.add(ped);
    addCollider(s, d, 3.2, 3.2, 2.2);
    const gold = 0xd4af37;
    const st = makeCharacter([gold, gold, gold, gold]);
    st.g.scale.setScalar(2.6); st.g.position.set(p.x, 2.2, p.z);
    const t = theta(s);
    st.g.rotation.y = headingOf(-Math.cos(t), -Math.sin(t)); // face the main road
    st.shR.rotation.x = -2.6; // heroic wave
    scene.add(st.g);
    const pl = sign(['TIM ARNETT', 'Founder · Legend · Mayor'], 4, 1.3, { bg: '#3e2723', fg: '#ffd54f', size: 64 });
    const q = P(s, d - 2.3);
    pl.position.set(q.x, 1.2, q.z); pl.rotation.y = st.g.rotation.y; scene.add(pl);
    // billboard at the end of the park
    const bb = sign(['RE-ELECT MAYOR TIM ARNETT', 'He fixed one pothole. Probably.'], 16, 5, { w: 1024, h: 320, bg: '#fff59d', fg: '#c62828', size: 82, border: '#c62828' });
    const bp = P(s + 26, 30);
    bb.position.set(bp.x, 9, bp.z); bb.rotation.y = st.g.rotation.y; posts(bb, 16, 9, 0x555555); scene.add(bb);
    addCollider(s + 26, 30, 15, 0.6, 2);
  }
  // Clinic sign (respawn point in front)
  {
    const c = places.clinic;
    const t = theta(c.s);
    const front = c.d + c.depth / 2 + 0.15;
    const sg = sign(['✚ ARNETT CLINIC', 'Walk-ins & respawns'], 7, 1.8, { bg: '#ffffff', fg: '#d32f2f', size: 62, border: '#d32f2f' });
    const p = P(c.s, front);
    sg.position.set(p.x, 5, p.z); sg.rotation.y = headingOf(Math.cos(t), Math.sin(t)); scene.add(sg);
    const sp = P(c.s, -8.8);
    places.spawn = { x: sp.x, z: sp.z, h: roadHeading(c.s) };
  }
  // Tim's Bait & Tackle by the middle dock
  {
    const ds = DOCK_S[1];
    const t = theta(ds + 14);
    const sg = sign(["TIM'S BAIT & TACKLE", 'Worms · Ice · Gossip'], 9, 2.2, { bg: '#0d47a1', fg: '#ffffff', size: 54 });
    const p = P(ds + 14, -76 + 4.15);
    sg.position.set(p.x, 3.4, p.z); sg.rotation.y = headingOf(Math.cos(t), Math.sin(t)); scene.add(sg);
  }
  // Arnett Ave street signs at every cross street
  {
    const tex = textTexture('ARNETT AVE', { bg: '#1b5e20', fg: '#ffffff', w: 256, h: 64, size: 40 });
    const m = new THREE.MeshLambertMaterial({ map: tex });
    const geo = new THREE.PlaneGeometry(2.2, 0.55);
    for (const c of CROSS) {
      const p = P(c + 6.5, 9.5);
      const g = new THREE.Group();
      const a = new THREE.Mesh(geo, m); a.position.z = 0.02; const bk = new THREE.Mesh(geo, m); bk.rotation.y = Math.PI; bk.position.z = -0.02;
      g.add(a, bk); g.position.set(p.x, 3.1, p.z); g.rotation.y = -theta(c) + Math.PI / 2;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.3, 5), mat(0x777777)); pole.position.y = -1.5; g.add(pole);
      scene.add(g);
    }
  }
  // Beach sign
  {
    const sg = sign(['ARNETT BEACH', 'No lifeguard. Good luck.'], 7, 2, { bg: '#ffe082', fg: '#e65100', size: 58 });
    const s = 400, p = P(s, 59);
    sg.position.set(p.x, 2.6, p.z); const t = theta(s); sg.rotation.y = headingOf(-Math.cos(t), -Math.sin(t)); posts(sg, 7, 2.6, 0x8d6e63); scene.add(sg);
  }

  // --- street furniture: lights, crosswalks, lane lines, benches, bins, hydrants ---
  {
    const lights = [];
    for (let s = 30; s < L - 20; s += 38) for (const side of [-1, 1]) lights.push({ s: s + (side > 0 ? 19 : 0), side });
    const pole = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 7, 0.18).translate(0, 3.5, 0), mat(0x546e7a), lights.length);
    const arm = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 0.14, 0.14).translate(-1.1, 0, 0), mat(0x546e7a), lights.length);
    env.lampMat = new THREE.MeshBasicMaterial({ color: 0xfff3c4 });
    const lamp = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.18, 0.4), env.lampMat, lights.length);
    // pools of light under each lamp (only visible at night)
    env.poolMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const pool = new THREE.InstancedMesh(new THREE.CircleGeometry(4.5, 16).rotateX(-Math.PI / 2), env.poolMat, lights.length);
    lights.forEach((l, i) => { const q = P(l.s, l.side * 7.5); o.position.set(q.x, 0.1, q.z); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); o.updateMatrix(); pool.setMatrixAt(i, o.matrix); });
    scene.add(pool);
    lights.forEach((l, i) => {
      const p = P(l.s, l.side * 10.2), t = theta(l.s);
      const face = -t + (l.side > 0 ? 0 : Math.PI);
      o.position.set(p.x, 0, p.z); o.rotation.set(0, face, 0); o.scale.set(1, 1, 1); o.updateMatrix(); pole.setMatrixAt(i, o.matrix);
      o.position.y = 7; o.updateMatrix(); arm.setMatrixAt(i, o.matrix);
      const q = P(l.s, l.side * 8.1); o.position.set(q.x, 6.9, q.z); o.updateMatrix(); lamp.setMatrixAt(i, o.matrix);
    });
    pole.castShadow = true;
    scene.add(pole, arm, lamp);
    // crosswalk stripes on the main road at every cross street, plus white lane edges
    const stripes = [];
    for (const c of CROSS) for (let d = -6; d <= 6; d += 1.5) stripes.push({ s: c, d });
    const zebra = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, 0.02, 4), mat(0xf5f5f5), stripes.length);
    stripes.forEach((z, i) => { const p = P(z.s, z.d); o.position.set(p.x, 0.08, p.z); o.rotation.set(0, -theta(z.s), 0); o.updateMatrix(); zebra.setMatrixAt(i, o.matrix); });
    scene.add(zebra);
    for (const side of [-1, 1]) addStrip(0, L, side * 6.5, side * 6.75, 0.075, 0xf5f5f5, 6);
    const dashes = [];
    for (let s = 140; s < 960; s += 6) dashes.push(s);
    const dash = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 0.02, 2.4), mat(0xf5f5f5), dashes.length * 2);
    dashes.forEach((s, i) => [-48, 48].forEach((d, k) => { const p = P(s, d); o.position.set(p.x, 0.08, p.z); o.rotation.set(0, -theta(s), 0); o.updateMatrix(); dash.setMatrixAt(i * 2 + k, o.matrix); }));
    scene.add(dash);
    const furn = [];
    for (let s = 45; s < L - 30; s += 23) furn.push({ s, side: (s / 23) % 2 > 1 ? 1 : -1, kind: Math.floor(r() * 3) });
    const bench = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.5, 1.8).translate(0, 0.25, 0), mat(0x8d6e63), furn.length);
    const bin = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 8).translate(0, 0.45, 0), mat(0x2e7d32), furn.length);
    const hyd = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.22, 0.7, 8).translate(0, 0.35, 0), mat(0xe53935), furn.length);
    const hide = new THREE.Matrix4().makeTranslation(0, -50, 0);
    furn.forEach((f, i) => {
      const p = P(f.s, f.side * 9.9); o.position.set(p.x, 0.06, p.z); o.rotation.set(0, -theta(f.s), 0); o.updateMatrix();
      bench.setMatrixAt(i, f.kind === 0 ? o.matrix : hide);
      if (f.kind === 0) { env.benches = env.benches || []; env.benches.push({ x: p.x, z: p.z, h: -theta(f.s) + (f.side > 0 ? -Math.PI / 2 : Math.PI / 2) }); } bin.setMatrixAt(i, f.kind === 1 ? o.matrix : hide); hyd.setMatrixAt(i, f.kind === 2 ? o.matrix : hide);
    });
    bench.castShadow = bin.castShadow = hyd.castShadow = true;
    scene.add(bench, bin, hyd);
  }
  // --- lighthouse at the far tip ---
  {
    const s = 1062, d = -15, p = P(s, d);
    const g = new THREE.Group(); g.position.set(p.x, 0, p.z);
    for (let k = 0; k < 6; k++) { const seg = new THREE.Mesh(new THREE.CylinderGeometry(2.2 - k * 0.2, 2.4 - k * 0.2, 3, 12), mat(k % 2 ? 0xd32f2f : 0xffffff)); seg.position.y = 1.5 + k * 3; seg.castShadow = true; g.add(seg); }
    const lan = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 1.8, 10), new THREE.MeshBasicMaterial({ color: 0xfff59d })); lan.position.y = 19; g.add(lan);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(6, 60, 12, 1, true).rotateZ(Math.PI / 2).translate(30, 0, 0), new THREE.MeshBasicMaterial({ color: 0xfff7c0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 19; g.add(beam); env.beam = beam;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.6, 10), mat(0x263238)); cap.position.y = 20.7; g.add(cap);
    scene.add(g);
    addCollider(s, d, 4.6, 4.6, 21);
    places.lighthouse = { x: p.x, z: p.z };
  }
  // --- water tower ---
  {
    const s = 110, d = -55, p = P(s, d);
    const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = -theta(s);
    for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 16, 0.4), mat(0x90a4ae)); leg.position.set(x, 8, z); leg.castShadow = true; g.add(leg); }
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 6, 16), new THREE.MeshLambertMaterial({ map: textTexture(['TIM ARNETT TOWN'], { w: 1024, h: 128, bg: '#e3f2fd', fg: '#1565c0', size: 70 }) }));
    tank.position.y = 19; tank.castShadow = true; g.add(tank);
    const top = new THREE.Mesh(new THREE.ConeGeometry(5.3, 2.4, 16), mat(0x1565c0)); top.position.y = 23.2; g.add(top);
    scene.add(g);
    for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) { const q = P(s + z, d + x); addCollider(W_S(q), W_D(q), 0.6, 0.6, 16); }
  }
  // --- gas station canopy and pumps ---
  if (places.gas) {
    const { s, d } = places.gas, p = P(s, d);
    const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = -theta(s);
    const roofM = new THREE.Mesh(new THREE.BoxGeometry(16, 0.8, 26), mat(0xffffff)); roofM.position.y = 6; roofM.castShadow = true; g.add(roofM);
    const band = new THREE.Mesh(new THREE.BoxGeometry(16.1, 0.5, 26.1), mat(0xff5e5b)); band.position.y = 5.7; g.add(band);
    for (const [x, z] of [[-5, -9], [5, -9], [-5, 9], [5, 9]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 0.5), mat(0xeeeeee)); c.position.set(x, 3, z); g.add(c); }
    for (const z of [-5, 5]) {
      const isl = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 6), mat(0xbdbdbd)); isl.position.set(0, 0.12, z); g.add(isl);
      for (const zz of [-1.5, 1.5]) { const pump = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.7, 0.9), mat(0xff5e5b)); pump.position.set(0, 1, z + zz); pump.castShadow = true; g.add(pump); }
    }
    scene.add(g);
    for (const z of [-5, 5]) addCollider(s + z, d, 6, 1.6, 1.8);
  }
  // --- marina boats by the docks ---
  for (const ds of DOCK_S) {
    for (const k of [0, 1, 2]) {
      const side = k % 2 ? 1 : -1, dd = -100 - k * 9;
      const p = P(ds + side * 7, dd);
      const g = new THREE.Group(); g.position.set(p.x, -0.15, p.z); g.rotation.y = -theta(ds) + Math.PI / 2;
      const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1, 7), mat(0xffffff)); hull.position.y = 0.2; g.add(hull);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.2, 7.05), mat([0x1e88e5, 0xff5e5b, 0x2e7d32][k])); stripe.position.y = 0.45; g.add(stripe);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1, 2.4), mat(0x26323f)); cab.position.set(0, 1.1, -0.5); g.add(cab);
      scene.add(g);
    }
  }

  // walkable spawn spots along the sidewalks
  places.spawns = [];
  for (let k = 0; k < 12; k++) { const s = 200 + k * 60; const p = P(s, k % 2 ? 8.8 : -8.8); places.spawns.push({ x: p.x, z: p.z, h: roadHeading(s) }); }
}

const DOCK_S = [272, 637, 905];

// 4x4 windows per texture. Day: glass. Night (emissive): a random mix of lit and dark windows.
function windowTextures() {
  const make = (lit) => {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const x = c.getContext('2d');
    const r = rng(lit ? 7 : 3);
    x.fillStyle = lit ? '#000' : '#ffffff'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const ox = i * 128, oy = j * 128;
      if (!lit) {
        x.fillStyle = '#e6e6e6'; x.fillRect(ox, oy + 118, 128, 10);
        x.fillStyle = '#5b7f9e'; x.fillRect(ox + 24, oy + 26, 80, 70);
        x.fillStyle = '#86a9c6'; x.fillRect(ox + 24, oy + 26, 80, 22);
        x.fillStyle = '#ffffff'; x.fillRect(ox + 62, oy + 26, 4, 70);
        x.fillStyle = '#d9d9d9'; x.fillRect(ox + 18, oy + 96, 92, 8);
      } else if (r() < 0.45) {
        x.fillStyle = ['#ffd27a', '#fff1c1', '#ffb85c', '#cfe3ff'][Math.floor(r() * 4)];
        x.fillRect(ox + 24, oy + 26, 80, 70);
        x.fillStyle = '#000'; x.fillRect(ox + 62, oy + 26, 4, 70);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  };
  return [make(false), make(true)];
}

// Minimap outline (computed once)
export function outline() {
  const pts = [];
  for (let s = 0; s <= L; s += 10) pts.push(P(s, hw(s)));
  for (let s = L; s >= 0; s -= 10) pts.push(P(s, -hw(s)));
  return pts;
}
