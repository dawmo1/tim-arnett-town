// Planes: a Cessna-style high-wing prop plane and a crop duster. Forgiving arcade flight:
// W / S throttle up / down (S on the ground with the throttle closed = brakes), A / D bank and turn (steer the
// nosewheel on the ground), Space pull up, Shift nose down. Lift grows with airspeed; under the stall speed the
// nose drops and it sinks. Take off from runways, roads or flat fields; hard landings and hitting things wreck it.
// Flying is free: no stars just for taking off.
import * as THREE from 'three';
import * as W from './world.js';
import { gltf } from './assets.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------- flight ----------
// hitWalls(v): vehicles.js's building collision (resolves v.x/z/vx/vz, returns impact speed)
export function stepPlane(v, inp, dt, hitWalls) {
  const T = v.T, alive = v.hp > 0 && !(v.sinkT > 0);
  const land = W.isLand(v.x, v.z), ground = land ? W.groundHeight(v.x, v.z) : W.WATER_Y;
  const onGround = !(v.air > 0);
  v.pitch = v.pitch || 0; v.roll = v.roll || 0; v.vy = v.vy || 0;
  let sp = Math.max(0, v.speed || 0);
  // throttle is a lever: it stays where you leave it (an empty plane's engine winds down)
  const thrIn = (inp.throttle ? 1 : 0) - (inp.brake ? 1 : 0);
  v.thr = clamp((v.thr || 0) + (v.driver ? thrIn * 0.55 * dt : -0.3 * dt), 0, 1);
  // speed: prop thrust against drag (full throttle settles at T.max); climbing costs speed, diving gains it
  sp += ((alive ? v.thr * T.acc : 0) - T.acc * (sp / T.max) ** 2 - 9.8 * Math.sin(v.pitch)) * dt;
  if (onGround) {
    const rough = land && [W.C.lawn, W.C.park, W.C.wood, W.C.sand, W.C.cemetery].includes(W.classAt(v.x, v.z));
    sp -= (0.4 + (rough ? 1.2 : 0) + (inp.brake && v.thr === 0 ? 6 : 0)) * dt;
  }
  sp = clamp(sp, 0, T.max * 1.3);
  const lift = smooth(T.stall * 0.7, T.stall, sp); // 0 = no lift .. 1 = flying
  const pin = (inp.up ? 1 : 0) - (inp.down ? 1 : 0), steer = inp.steer || 0;
  if (onGround) {
    // rotate for take-off once fast enough, otherwise sit level; steer the nosewheel
    v.pitch += ((pin > 0 && lift > 0.8 ? 0.16 : 0) - v.pitch) * Math.min(1, dt * 3);
    v.roll *= Math.exp(-6 * dt);
    v.w = steer * T.turn * clamp(sp / 6, 0, 1) * (1 - 0.6 * smooth(0, T.stall, sp));
  } else {
    v.pitch += pin * 0.6 * dt * (0.35 + 0.65 * lift);
    if (!pin) v.pitch += (0.03 - v.pitch) * 0.3 * dt; // trimmed: drifts back toward level flight
    v.pitch -= (1 - lift) * 0.9 * dt; // stall: the nose falls through
    v.pitch = clamp(v.pitch, -0.8, 0.5);
    v.roll += (-steer * 0.75 - v.roll) * Math.min(1, dt * 2.2);
    v.w = -(9.8 * Math.tan(v.roll) / Math.max(18, sp)) * 2.2 * T.turn; // banked turn (right bank = h decreasing)
  }
  if (!alive) v.w *= 0.3;
  v.h += v.w * dt;
  // where it goes: along the nose with lift, sinking without
  const want = sp * Math.sin(v.pitch) * lift - (1 - lift) * 9 - (1 - Math.cos(v.roll)) * 5 * lift;
  const cushion = !onGround && v.y - ground < 5 && v.pitch > -0.15 && sp > T.stall * 0.6; // ground effect: a shallow approach settles softly
  v.vy += ((cushion ? Math.max(want, -2.5) : want) - v.vy) * Math.min(1, dt * (onGround ? 10 : 3));
  if (onGround && v.vy < 0) v.vy = 0;
  const fx = Math.sin(v.h), fz = Math.cos(v.h), hs = sp * Math.cos(v.pitch);
  v.vx = fx * hs; v.vz = fz * hs;
  v.x += v.vx * dt; v.z += v.vz * dt; v.y += v.vy * dt;
  v.hit = null;
  let impact = hitWalls(v);
  if (impact) sp = Math.max(0, (v.vx * fx + v.vz * fz) / Math.max(0.3, Math.cos(v.pitch)));
  // touching down: gentle is free; a hard landing, a wing tip or the nose first is a crash
  const g2 = W.isLand(v.x, v.z) ? W.groundHeight(v.x, v.z) : W.WATER_Y;
  v.landed = 0;
  if (v.y <= g2) {
    if (!onGround) {
      const down = -v.vy; v.landed = down;
      let crash = down > 4.5 ? down * 2.5 : 0;
      if (Math.abs(v.roll) > 0.45 || v.pitch < -0.2) crash += sp * 1.3; // cartwheel / nose-in
      if (crash) { impact = Math.max(impact, crash); v.hit = { imp: crash, cp: [v.x + fx * T.len * 0.4, v.z + fz * T.len * 0.4], nx: -fx, nz: -fz, wall: true }; sp *= 0.4; }
    }
    if (!W.isLand(v.x, v.z)) { v.sinkT = (v.sinkT || 0) + dt; sp *= Math.exp(-2.5 * dt); v.y = g2 - Math.min(2.2, v.sinkT * 0.7); }
    else { v.sinkT = 0; v.y = g2; }
    v.vy = 0; v.air = 0;
    if (v.pitch < 0) v.pitch = 0;
  } else {
    v.air = (v.air || 0) + dt; v.sinkT = 0;
    v.y = Math.min(v.y, g2 + 900);
  }
  v.speed = sp; v.alt = v.y - g2; v.slip = 0; v.tilt = 0; v.steerIn = steer;
  return impact;
}

// ---------- looks ----------
// body.rotation: nose up = -x, right bank = +z (car-local +x is the left side); the prop spins with the throttle
export function planeVisual(v, body, dt) {
  body.rotation.set(-(v.pitch || 0), 0, v.roll || 0);
  const prop = v.mesh.userData.prop;
  if (prop) prop.rotation.z += dt * (v.hp > 0 && (v.driver || v.air > 0) ? 12 + 60 * (v.thr || 0) : 0);
}
const mats = new Map();
const M = (c) => { if (!mats.has(c)) mats.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.2 })); return mats.get(c); };
const BOX = new THREE.BoxGeometry(1, 1, 1);
const WHEEL = new THREE.CylinderGeometry(0.3, 0.3, 0.18, 10).rotateZ(Math.PI / 2);
// Blender planes (assets/models/planes.glb, listed in assets/manifest.json as 'planes'): a root node whose name
// contains 'duster' or 'cessna', nose toward +z, wheels at y = 0, the propeller a child named '*prop*'.
function fromGlb(T) {
  const g = gltf('planes'); if (!g) return null;
  let src = null;
  g.scene.traverse((o) => { if (!src && o.name && o.name.toLowerCase().includes(T.duster ? 'duster' : 'cessna')) src = o; });
  return src ? src.clone(true) : null;
}
export function planeMesh(T, color) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x26323f, roughness: 0.08, metalness: 0.4 });
  const parts = { wheels: [], glassMat, segL: 1 };
  let prop = null;
  const model = fromGlb(T);
  if (model) {
    body.add(model);
    model.traverse((o) => { if (o.isMesh) o.castShadow = true; if (!prop && o.name && o.name.toLowerCase().includes('prop')) prop = o; });
  } else {
    const bx = (c, sx, sy, sz, x, y, z, m) => { const k = new THREE.Mesh(BOX, m || M(c)); k.scale.set(sx, sy, sz); k.position.set(x, y, z); k.castShadow = true; body.add(k); return k; };
    const trim = T.duster ? 0x1b1b1b : 0x1f4e9a, L = T.len;
    if (T.duster) { // low wing, single seat, tail-dragger, spray boom
      bx(color, 1.2, 1.3, L * 0.62, 0, 1.25, 0.6);
      bx(0, 0.9, 0.7, 1.3, 0, 2.15, -0.1, glassMat);
      bx(color, T.span, 0.16, 1.9, 0, 0.85, 0.9);
      bx(0x9e9e9e, T.span * 0.8, 0.06, 0.06, 0, 0.65, 0.2);
      bx(color, 0.5, 0.6, L * 0.4, 0, 1.45, -L * 0.33);
      bx(color, 3.6, 0.1, 1.0, 0, 1.6, -L * 0.48);
      bx(trim, 0.1, 1.4, 1.1, 0, 2.3, -L * 0.48);
      for (const s of [1, -1]) { bx(0x333333, 0.08, 0.9, 0.08, s * 1.0, 0.55, 1.4); const w = new THREE.Mesh(WHEEL, M(0x111111)); w.position.set(s * 1.0, 0.3, 1.4); body.add(w); }
      const tw = new THREE.Mesh(WHEEL, M(0x111111)); tw.scale.setScalar(0.5); tw.position.set(0, 0.15, -L * 0.48); body.add(tw);
      body.rotation.x = 0; // body sits level; the tail wheel is just smaller
    } else { // Cessna-style: high wing on struts, four seats, tricycle gear
      bx(color, 1.15, 1.35, L * 0.55, 0, 1.25, 0.7);
      bx(0, 1.18, 0.75, 1.6, 0, 1.75, 0.6, glassMat);
      bx(color, T.span, 0.14, 1.6, 0, 2.15, 0.4);
      bx(trim, T.span * 1.002, 0.05, 1.62, 0, 2.08, 0.4);
      for (const s of [1, -1]) { const st = bx(0x9e9e9e, 0.07, 1.4, 0.07, s * 1.6, 1.45, 0.4); st.rotation.z = s * 0.75; }
      bx(color, 0.55, 0.65, L * 0.45, 0, 1.4, -L * 0.3);
      bx(color, 3.4, 0.1, 1.0, 0, 1.5, -L * 0.48);
      bx(trim, 0.1, 1.5, 1.2, 0, 2.2, -L * 0.47);
      bx(trim, 1.17, 0.12, L * 0.55, 0, 1.0, 0.7);
      for (const [x, z] of [[1.1, 0.2], [-1.1, 0.2], [0, L * 0.38]]) { bx(0x333333, 0.07, 0.7, 0.07, x, 0.55, z); const w = new THREE.Mesh(WHEEL, M(0x111111)); w.position.set(x, 0.3, z); body.add(w); }
    }
    // spinner + two-blade prop on the nose
    const nose = (T.duster ? 0.6 : 0.7) + L * (T.duster ? 0.31 : 0.275);
    bx(0x222222, 0.35, 0.35, 0.3, 0, 1.25, nose + 0.1);
    prop = new THREE.Group(); prop.position.set(0, 1.25, nose + 0.28); body.add(prop);
    const blade = new THREE.Mesh(BOX, M(0x1a1a1a)); blade.scale.set(0.16, 1.9, 0.04); prop.add(blade);
  }
  // hidden driver head (vehicles.js API)
  const head = new THREE.Mesh(BOX, M(0xe0ac69)); head.scale.setScalar(0.3); head.position.set(0, 1.85, 0.6); head.visible = false; body.add(head);
  g.userData = { body, parts, driverHead: head, prop };
  return g;
}

// ---------- where planes are parked ----------
// Quad City International (Moline) and any runways/airstrips the map data lists. index.runways, if the map build
// provides it: [{x1, z1, x2, z2, width, name, kind: 'runway' | 'airstrip'}] in game metres.
const M_LAT = 110574, M_LON = 111320 * Math.cos((41.5236 * Math.PI) / 180);
const ll = (lat, lon) => ({ x: (lon + 90.5776) * M_LON, z: -(lat - 41.5236) * M_LAT });
// shortcut: MLI's main runway 9/27 as a 3 km east-west strip on the airport reference point, apron on its north side;
// replace with the real OSM runway ends once index.runways lands
const MLI = (() => { const c = ll(41.4485, -90.5075); return { x1: c.x - 1500, z1: c.z, x2: c.x + 1500, z2: c.z, width: 45, name: 'Quad City International', kind: 'runway' }; })();
const COLORS = [0xf4f4f4, 0xf4f4f4, 0xe8e2d0, 0xb71c1c, 0x1f4e9a];
let spots = null;
function makeSpots() {
  const rw = (W.D.index && W.D.index.runways) || [];
  const list = rw.some((r) => Math.hypot((r.x1 + r.x2) / 2 - (MLI.x1 + MLI.x2) / 2, (r.z1 + r.z2) / 2 - MLI.z1) < 2500) ? rw : [MLI, ...rw];
  const out = [];
  list.forEach((r, ri) => {
    const L = Math.hypot(r.x2 - r.x1, r.z2 - r.z1) || 1, ux = (r.x2 - r.x1) / L, uz = (r.z2 - r.z1) / L;
    const big = r.kind !== 'airstrip' && L > 1200, side = (r.width || 30) / 2 + (big ? 140 : 22);
    // parked in a row beside the runway, a third of the way along, noses toward it
    const bx = r.x1 + ux * L * 0.3 - uz * side, bz = r.z1 + uz * L * 0.3 + ux * side, h = Math.atan2(uz, -ux);
    const n = big ? 5 : 1;
    for (let i = 0; i < n; i++) {
      const duster = !big || i === n - 1;
      out.push({ id: `plane_${ri}_${i}`, kind: duster ? 'duster' : 'plane', color: duster ? 0xf2c230 : COLORS[i % COLORS.length], x: bx + ux * i * 16, z: bz + uz * i * 16, h });
    }
  });
  return out;
}
// The parked planes within reach of (px, pz) whose ground is loaded (main.js spawns the ones it doesn't have yet).
export function planeSpots(px, pz) {
  if (!W.D.index) return [];
  spots = spots || makeSpots();
  return spots.filter((s) => Math.hypot(s.x - px, s.z - pz) < 700 && W.tiles.has(`${Math.floor(s.x / 200)}_${Math.floor(s.z / 200)}`) && !W.offMap(s.x, s.z) && W.isLand(s.x, s.z));
}
