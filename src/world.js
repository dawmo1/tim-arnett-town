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
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export function hw(s) { const e = Math.min(s, L - s); return 14 + 71 * sm(0, 130, e); }

export const BRIDGE_END = -130;
export const CROSS = Array.from({ length: 10 }, (_, i) => 140 + (i * 820) / 9);
export const colliders = []; // {cx,cz,ux,uz,vx,vz,hu,hv,h,br}
export const docks = [];
export const islets = [];
export const parkedSpots = [];
export const places = {};

export function isLand(x, z) {
  const { s, d } = toSD(x, z);
  if (s >= 0 && s <= L && Math.abs(d) <= hw(s)) return true;
  if (s < 0 && s >= BRIDGE_END - 1 && Math.abs(d) <= 6.6) return true;
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
  const addB = (sc, dc, len, depth, h, color, extra) => { const b = addCollider(sc, dc, len, depth, h, extra); b.color = color; buildings.push(b); return b; };

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
        addB(sc, dc, bl, depth, h, color);
      }
    }
  }
  // --- small houses at the tips ---
  for (const [a, b] of [[22, 125], [975, 1080]]) {
    for (let s = a; s < b; s += 17 + r() * 6) {
      for (const side of [-1, 1]) {
        if (r() < 0.3) continue;
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
    const b = addCollider(BRIDGE_END + 1, 0, 1, 13, 1.4);
    const m = new THREE.Mesh(new THREE.BoxGeometry(13, 1.4, 1), new THREE.MeshLambertMaterial({ map: textTexture('BRIDGE OUT', { bg: '#ff8c1a', fg: '#ffffff', w: 512, h: 64, size: 44 }) }));
    m.position.set(b.cx, 0.7, b.cz); m.rotation.y = b.rot; scene.add(m);
    const stub = P(-185, 0);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(13, 0.6, 40), mat(0x8a8f96));
    deck.position.set(stub.x, -0.3, stub.z); deck.rotation.y = -theta(-185); scene.add(deck);
    const sg = sign(['BRIDGE OUT', 'Mainland ferry: never'], 6, 2.2, { bg: '#ffffff', fg: '#d35400', size: 60, border: '#d35400' });
    const q = P(BRIDGE_END + 6, 4.5);
    sg.position.set(q.x, 2.6, q.z); sg.rotation.y = -theta(BRIDGE_END) + Math.PI; posts(sg, 6, 2.6); scene.add(sg);
  }

  // --- building meshes (instanced) ---
  const bgeo = new THREE.BoxGeometry(1, 1, 1);
  bgeo.translate(0, 0.5, 0);
  const bmesh = new THREE.InstancedMesh(bgeo, new THREE.MeshLambertMaterial(), buildings.length);
  const roof = new THREE.InstancedMesh(bgeo, new THREE.MeshLambertMaterial({ color: 0x8d8d8d }), buildings.length);
  const o = new THREE.Object3D(), col = new THREE.Color();
  buildings.forEach((b, i) => {
    o.position.set(b.cx, 0, b.cz); o.rotation.set(0, b.rot, 0);
    o.scale.set(b.hu * 2, b.h, b.hv * 2); o.updateMatrix();
    bmesh.setMatrixAt(i, o.matrix); bmesh.setColorAt(i, col.setHex(b.color));
    o.position.y = b.h; o.scale.set(b.hu * 2 + 0.4, 0.5, b.hv * 2 + 0.4); o.updateMatrix(); roof.setMatrixAt(i, o.matrix);
  });
  scene.add(bmesh, roof);

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
    o.position.set(u.p.x + 1.4, 0.03, u.p.z + 0.6); o.updateMatrix(); tow.setMatrixAt(i, o.matrix); tow.setColorAt(i, col.setHex(BUILD_COLORS[i % BUILD_COLORS.length]));
  });
  scene.add(umb, pol, tow);

  // --- ground + water ---
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.Float32BufferAttribute(groundPos, 3));
  gg.setAttribute('color', new THREE.Float32BufferAttribute(groundCol, 3));
  gg.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(groundPos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  gg.setIndex(groundIdx);
  scene.add(new THREE.Mesh(gg, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
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
  const water = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshLambertMaterial({ color: COLORS.water }));
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

  // walkable spawn spots along the sidewalks
  places.spawns = [];
  for (let k = 0; k < 12; k++) { const s = 200 + k * 60; const p = P(s, k % 2 ? 8.8 : -8.8); places.spawns.push({ x: p.x, z: p.z, h: roadHeading(s) }); }
}

const DOCK_S = [272, 637, 905];

// Minimap outline (computed once)
export function outline() {
  const pts = [];
  for (let s = 0; s <= L; s += 10) pts.push(P(s, hw(s)));
  for (let s = L; s >= 0; s -= 10) pts.push(P(s, -hw(s)));
  return pts;
}
