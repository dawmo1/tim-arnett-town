// Procedural prop kit (three.js geometry with baked vertex colours, same contract as the Blender props in
// assets/models/props.glb: one geometry per kind, drawn instanced by stream.js). Yard life, utility poles,
// lot and downtown furniture. Units: metres, +z = the prop's front.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const col = new THREE.Color();
function paint(g, hex) {
  g.deleteAttribute('uv');
  col.setHex(hex);
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const box = (w, h, d, x, y, z, c, ry = 0, rz = 0, rx = 0) => paint(new THREE.BoxGeometry(w, h, d).rotateX(rx).rotateZ(rz).rotateY(ry).translate(x, y, z), c);
const cyl = (r0, r1, h, x, y, z, c, seg = 8, rz = 0, rx = 0) => paint(new THREE.CylinderGeometry(r0, r1, h, seg).rotateX(rx).rotateZ(rz).translate(x, y, z), c);
const cone = (r, h, x, y, z, c, seg = 8) => paint(new THREE.ConeGeometry(r, h, seg).translate(x, y, z), c);
const ball = (r, x, y, z, c) => paint(new THREE.IcosahedronGeometry(r, 1).translate(x, y, z), c);
const merge = (parts) => { const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p))); g.computeBoundingSphere(); return g; };

export function proceduralProps() {
  const G = {};
  // wooden utility pole with a crossarm, three insulators (the wires are drawn per tile)
  const WOOD = 0x5e4a36, GREY = 0x8d9296;
  const pole = () => [cyl(0.13, 0.17, 10.6, 0, 5.3, 0, WOOD, 7), box(2.4, 0.12, 0.12, 0, 9.85, 0, WOOD), box(0.06, 0.6, 0.06, 0.55, 9.6, 0, 0x4a3b2b, 0, 0.6), box(0.06, 0.6, 0.06, -0.55, 9.6, 0, 0x4a3b2b, 0, -0.6),
    ...[-1.05, 0, 1.05].map((x) => cyl(0.05, 0.05, 0.22, x, x === 0 ? 10.72 : 10.02, 0, 0x7f8a6e, 6))];
  G.upole = merge(pole());
  G.upolet = merge([...pole(), cyl(0.32, 0.32, 0.95, 0, 8.4, 0.38, GREY, 10), box(0.08, 0.4, 0.2, 0, 8.6, 0.1, GREY)]);
  // backyard shed: 2.4 x 3 m, gable roof, double doors on the front
  { const W = 2.4, D = 3, H = 2.1, wall = 0xd8cfb8, roof = 0x5b4e45;
    const r = new THREE.BufferGeometry(), y0 = H, y1 = H + 0.8, hw = W / 2 + 0.12, hd = D / 2 + 0.12;
    r.setAttribute('position', new THREE.Float32BufferAttribute([-hw, y0, -hd, 0, y1, -hd, 0, y1, hd, -hw, y0, hd, hw, y0, -hd, hw, y0, hd, 0, y1, hd, 0, y1, -hd, -W / 2, H, D / 2, W / 2, H, D / 2, 0, y1 - 0.05, D / 2, W / 2, H, -D / 2, -W / 2, H, -D / 2, 0, y1 - 0.05, -D / 2], 3));
    r.setIndex([0, 2, 1, 0, 3, 2, 4, 6, 5, 4, 7, 6, 8, 9, 10, 11, 12, 13]); r.computeVertexNormals();
    const rc = new Float32Array(14 * 3); col.setHex(roof); for (let i = 0; i < 8; i++) rc.set([col.r, col.g, col.b], i * 3); col.setHex(wall); for (let i = 8; i < 14; i++) rc.set([col.r, col.g, col.b], i * 3);
    r.setAttribute('color', new THREE.BufferAttribute(rc, 3));
    G.shed = merge([box(W, H, D, 0, H / 2, 0, wall), r, box(1.3, 1.8, 0.04, 0, 0.92, D / 2 + 0.02, 0xf2efe6), box(0.04, 1.8, 0.06, 0, 0.92, D / 2 + 0.04, 0x8a8a8a)]);
  }
  // A-frame swing set (green steel, two swings)
  { const c = 0x2f6b3a, legs = [];
    for (const x of [-1.6, 1.6]) for (const s of [-1, 1]) legs.push(cyl(0.04, 0.04, 2.5, x, 1.15, s * 0.45, c, 6, 0, s * 0.37));
    G.swing = merge([...legs, cyl(0.05, 0.05, 3.3, 0, 2.3, 0, c, 6, Math.PI / 2), ...[-0.7, 0.7].flatMap((x) => [cyl(0.008, 0.008, 1.8, x - 0.2, 1.4, 0, 0x333333, 4), cyl(0.008, 0.008, 1.8, x + 0.2, 1.4, 0, 0x333333, 4), box(0.5, 0.04, 0.18, x, 0.5, 0, 0xd8a12a)])]);
  }
  // trampoline: black mat, blue pad ring, legs, net poles
  { const p = [cyl(1.8, 1.8, 0.04, 0, 0.9, 0, 0x1c1c1c, 20), paint(new THREE.TorusGeometry(1.85, 0.12, 4, 20).rotateX(Math.PI / 2).translate(0, 0.92, 0), 0x2a6fb5)];
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; p.push(cyl(0.03, 0.03, 0.9, Math.cos(a) * 1.8, 0.45, Math.sin(a) * 1.8, 0x777777, 5), cyl(0.02, 0.02, 1.7, Math.cos(a) * 1.85, 1.75, Math.sin(a) * 1.85, 0x222222, 4)); }
    G.tramp = merge(p);
  }
  // flagpole with a US flag (stripes and canton)
  { const p = [cyl(0.04, 0.06, 6.5, 0, 3.25, 0, 0xe8e8e8, 6), ball(0.08, 0, 6.55, 0, 0xd4af37)];
    for (let k = 0; k < 7; k++) p.push(box(0.02, 0.143, 1.6, 0, 6.3 - k * 0.143, 0.85, k % 2 ? 0xf4f4f4 : 0xb22234));
    p.push(box(0.03, 0.43, 0.68, 0, 6.15, 0.39, 0x3c3b6e));
    G.flagpole = merge(p);
  }
  // garden gnome
  G.gnome = merge([cyl(0.09, 0.12, 0.2, 0, 0.1, 0, 0x2b55a5, 8), ball(0.07, 0, 0.25, 0, 0xf2c9a0), cone(0.07, 0.11, 0, 0.27, 0.05, 0xf4f4f4, 6), cone(0.08, 0.2, 0, 0.38, 0, 0xc0262c, 8)]);
  // shopping-cart corral: galvanised rails, open at one end
  { const c = 0xa8adb2, p = [];
    for (const x of [-0.75, 0.75]) { p.push(box(0.05, 0.05, 5.6, x, 0.95, 0, c), box(0.05, 0.05, 5.6, x, 0.5, 0, c)); for (const z of [-2.8, 0, 2.8]) p.push(box(0.06, 1.0, 0.06, x, 0.5, z, c)); }
    p.push(box(1.55, 0.05, 0.05, 0, 0.95, -2.8, c), box(1.4, 0.5, 0.04, 0, 1.25, -2.8, 0x1f4e8c));
    for (let k = 0; k < 4; k++) p.push(box(0.55, 0.45, 0.85, 0, 0.62, -1.9 + k * 0.32, 0x9aa0a6)); // nested carts
    G.corral = merge(p);
  }
  // downtown light-pole banners (a pair hung off brackets, on the light pole)
  { const p = [];
    for (const s of [-1, 1]) p.push(box(0.03, 0.03, 0.75, 0, 6.1, s * 0.45, 0x222222), box(0.02, 1.25, 0.6, 0, 5.45, s * 0.5, s < 0 ? 0x1f4e8c : 0x9e2a2b), box(0.021, 0.2, 0.6, 0, 5.15, s * 0.5, 0xf2efe6));
    G.banner = merge(p);
  }
  // black planter with flowers
  G.planter = merge([box(1.0, 0.6, 1.0, 0, 0.3, 0, 0x26282a), box(0.9, 0.12, 0.9, 0, 0.62, 0, 0x3d2b1f), ball(0.28, -0.2, 0.75, -0.15, 0x3f7a2e), ball(0.26, 0.2, 0.74, 0.18, 0x4b8a34), ball(0.12, 0.05, 0.92, 0, 0xd8434e), ball(0.1, -0.25, 0.88, 0.2, 0xf2c14e), ball(0.1, 0.28, 0.86, -0.2, 0xb65fc4)]);
  // dealership feather flag and a balloon bunch
  G.featherflag = merge([cyl(0.02, 0.03, 4.4, 0, 2.2, 0, 0x555555, 5), box(0.02, 3.2, 0.7, 0, 2.6, 0.36, 0xd62828), box(0.021, 0.6, 0.7, 0, 3.9, 0.36, 0xfcbf49)]);
  G.balloons = merge([cyl(0.005, 0.005, 3, 0, 1.5, 0, 0xeeeeee, 3), ball(0.3, 0, 3.2, 0, 0xd62828), ball(0.3, 0.35, 3.0, 0.1, 0x1f6fd1), ball(0.3, -0.3, 3.05, -0.1, 0xf7d02c), ball(0.3, 0.05, 3.5, -0.2, 0xffffff)]);
  // rural mailbox on a post
  G.ruralbox = merge([box(0.1, 1.1, 0.1, 0, 0.55, 0, 0x6b5a45), box(0.24, 0.24, 0.5, 0, 1.2, 0.05, 0x2d2f31), cyl(0.12, 0.12, 0.5, 0, 1.32, 0.05, 0x2d2f31, 8, 0, Math.PI / 2)]);
  // drive-thru menu board
  G.menuboard = merge([box(0.15, 1.0, 0.15, 0, 0.5, 0, 0x333333), box(1.6, 1.3, 0.2, 0, 1.65, 0, 0x1c1c1c), box(1.45, 1.1, 0.02, 0, 1.65, 0.11, 0xe7d6a8)]);
  // round hay bale (farms)
  G.haybale = merge([paint(new THREE.CylinderGeometry(0.75, 0.75, 1.3, 12).rotateZ(Math.PI / 2).translate(0, 0.75, 0), 0xb59a5a)]);
  return G;
}
