// Animation for people. Every frame a target pose is built from what the person is doing (walking,
// running, aiming, smoking, cowering, climbing, swimming...), blended toward smoothly, and written to
// the skeleton. Angles are in degrees, in a "canonical" frame where the arms hang straight down:
//   x: swing forward/back (negative swings a limb forward; positive bends the spine/head forward,
//      and bends a knee back)   y: turn (positive = toward the character's left)
//   z: sideways (positive moves a limb tip toward the character's left, +X)
// Left bones (…L) are on +X; the character faces +Z.
import * as THREE from 'three';
import { T } from './rig.js';

const DEG = Math.PI / 180;
export const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'shoulderL', 'upper_armL', 'forearmL', 'handL', 'shoulderR', 'upper_armR', 'forearmR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
export let REST = null;
const ARMS = new Set(['upper_armL', 'forearmL', 'handL', 'upper_armR', 'forearmR', 'handR']);

export function initPose() {
  if (REST || !T) return;
  const rig = T.rig; rig.updateMatrixWorld(true);
  const rigInv = new THREE.Quaternion(); rig.getWorldQuaternion(rigInv).invert();
  const C = {}, R = {};
  const down = new THREE.Vector3(0, -1, 0), y = new THREE.Vector3();
  const tpl = {}; for (const b of T.bones) tpl[b.name] = b;
  for (const n of BONES) {
    const b = tpl[n], q = new THREE.Quaternion(); b.getWorldQuaternion(q); q.premultiply(rigInv);
    R[n] = q;
    const c = q.clone();
    if (ARMS.has(n)) { y.set(0, 1, 0).applyQuaternion(q).normalize(); c.premultiply(new THREE.Quaternion().setFromUnitVectors(y, down)); }
    C[n] = c;
  }
  REST = {};
  for (const n of BONES) {
    const b = tpl[n], parent = b.parent && b.parent.isBone ? b.parent.name : null;
    REST[n] = { C: C[n], Cpi: parent ? C[parent].clone().invert() : new THREE.Quaternion(), p0: b.position.clone(), q0: b.quaternion.clone() };
  }
}

const e = new THREE.Euler(0, 0, 0, 'XYZ'), dq = new THREE.Quaternion();
// write a pose (angles in degrees) to a character's bones
export function writePose(ch, P) {
  for (const n of BONES) {
    const b = ch.bones[n], r = REST[n], a = P[n];
    e.set(a[0] * DEG, a[1] * DEG, a[2] * DEG); dq.setFromEuler(e);
    b.quaternion.copy(r.Cpi).multiply(dq).multiply(r.C);
  }
  const h = ch.bones.hips, p0 = REST.hips.p0;
  h.position.set(p0.x + P.root[0], p0.y + P.root[1], p0.z + P.root[2]);
}
export function blankPose() { const P = { root: [0, 0, 0] }; for (const n of BONES) P[n] = [0, 0, 0]; return P; }
function copyPose(dst, src) { for (const k in src) { const a = src[k], b = dst[k]; b[0] = a[0]; b[1] = a[1]; b[2] = a[2]; } }
function lerpPose(cur, tgt, k) { for (const n in tgt) { const a = cur[n], b = tgt[n]; a[0] += (b[0] - a[0]) * k; a[1] += (b[1] - a[1]) * k; a[2] += (b[2] - a[2]) * k; } }
const add = (P, n, x, y = 0, z = 0) => { const a = P[n]; a[0] += x; a[1] += y; a[2] += z; };
const set = (P, n, x, y = 0, z = 0) => { const a = P[n]; a[0] = x; a[1] = y; a[2] = z; };
const sm = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

// relaxed standing: slight elbow bend, arms a touch out, breathing
function stand(P, t, ch) {
  const br = Math.sin(t * 1.6 + ch.seed) * 1.2;
  set(P, 'upper_armL', 3, 0, 6); set(P, 'upper_armR', 3, 0, -6);
  set(P, 'forearmL', -10); set(P, 'forearmR', -10);
  set(P, 'handL', 0, 0, -4); set(P, 'handR', 0, 0, 4);
  add(P, 'chest', -br * 0.6); add(P, 'spine', 1);
  set(P, 'thighL', -2, 0, 2); set(P, 'thighR', 1, 0, -2); set(P, 'shinL', 3); set(P, 'shinR', 2);
  // weight shift
  const ws = Math.sin(t * 0.35 + ch.seed * 3) * 1.5;
  add(P, 'hips', 0, 0, ws); add(P, 'spine', 0, 0, -ws); P.root[0] += ws * 0.004;
}
// walk/run cycle: phase p, blend w (0 walk .. 1 run)
function locomote(P, p, s, w, ch) {
  const A = 22 + 20 * w, s1 = Math.sin(p), c1 = Math.cos(p);
  const amp = Math.min(1, s / 1.2);
  const th = (sg) => -sg * s1 * A * amp;
  set(P, 'thighL', th(1) - 4 * w); set(P, 'thighR', th(-1) - 4 * w);
  const knee = (sg) => (8 + (25 + 55 * w) * clamp01(0.5 + 0.5 * Math.cos(p + (sg > 0 ? 0 : Math.PI) - 0.9)) ** 1.5) * amp + 4;
  set(P, 'shinL', knee(1)); set(P, 'shinR', knee(-1));
  set(P, 'footL', -(P.thighL[0] + P.shinL[0]) * 0.65 + 6 * amp); set(P, 'footR', -(P.thighR[0] + P.shinR[0]) * 0.65 + 6 * amp);
  const armA = (16 + 34 * w) * amp;
  set(P, 'upper_armL', s1 * armA + 4 * w, 0, 7 + 4 * w); set(P, 'upper_armR', -s1 * armA + 4 * w, 0, -7 - 4 * w);
  set(P, 'forearmL', -14 - 70 * w - Math.max(0, s1) * 12 * amp); set(P, 'forearmR', -14 - 70 * w - Math.max(0, -s1) * 12 * amp);
  set(P, 'handL', -5, 0, -5); set(P, 'handR', -5, 0, 5);
  set(P, 'hips', 0, s1 * (5 + 4 * w) * amp, 0); set(P, 'spine', 3 + 9 * w, -s1 * (6 + 5 * w) * amp, 0); set(P, 'chest', 2 + 4 * w, -s1 * 3 * amp, 0);
  set(P, 'neck', -3 * w); set(P, 'head', -3 - 6 * w + Math.abs(c1) * 2);
  P.root[1] = -(0.015 + 0.05 * w) * amp * Math.abs(c1) + 0.012 * w * amp;
}
// armsUp(P, side, x, outward, elbow) or armsUp(P, side, x, twist, outward, elbow); outward > 0 lifts the arm away from the body
function armsUp(P, side, ...a) {
  const [x, y, z, elbow] = a.length >= 4 ? a : [a[0], 0, a[1], a[2] ?? -10];
  set(P, 'upper_arm' + side, x, side === 'L' ? y : -y, side === 'L' ? z : -z); set(P, 'forearm' + side, elbow);
}

// ---------- the state machine ----------
// st: { speed, aim, weapon, swim, sit, dead, lie, cower, reach, pull, phone, handsUp, look, chat, flinch, swing,
//       crouch, cover, smoke, drink, film, wave, point, beg, playDead, lean, preach, sign, dance, drive, climb, vault,
//       punch: {i, t}, kick: t, clutch, limp, cane, skate, getUp, sitGround, text, clap, shove, pitch (aim up/down) }
export function animate(ch, dt, st) {
  const t = (ch.time = (ch.time || 0) + dt);
  const P = ch.tgt || (ch.tgt = blankPose());
  const cur = ch.cur || (ch.cur = blankPose());
  for (const n in P) { P[n][0] = 0; P[n][1] = 0; P[n][2] = 0; }
  let rate = 14;
  const sp = st.speed || 0;
  const dead = st.dead || st.playDead;

  if (dead) { // limp on the ground (used when there's no ragdoll)
    ch.deadT = Math.min(1, (ch.deadT || 0) + dt * 2.5);
    P.root[1] = -0.78 * sm(ch.deadT);
    set(P, 'hips', -88 * sm(ch.deadT), 0, ch.roll * 10);
    armsUp(P, 'L', -20, 60, -20); armsUp(P, 'R', -10, 75, -30);
    set(P, 'thighL', -6, 0, 10); set(P, 'thighR', 4, 0, -6); set(P, 'shinL', 14); set(P, 'shinR', 6);
    set(P, 'head', -10, 30 * ch.roll); rate = 8;
  } else if (ch.getUp > 0) {
    ch.getUp = Math.max(0, ch.getUp - dt);
    const k = ch.getUp / 0.7;
    P.root[1] = -0.45 * k; set(P, 'hips', 25 * k); set(P, 'spine', 20 * k);
    set(P, 'thighL', -85 * k); set(P, 'thighR', -60 * k); set(P, 'shinL', 110 * k); set(P, 'shinR', 90 * k); set(P, 'footL', -20 * k); set(P, 'footR', -25 * k);
    armsUp(P, 'L', -50 * k, 10, -30 * k); armsUp(P, 'R', -50 * k, 10, -30 * k);
    rate = 20;
  } else if (st.drive || st.sit) {
    stand(P, t, ch);
    P.root[1] = -0.42; set(P, 'thighL', -88, 0, 4); set(P, 'thighR', -88, 0, -4); set(P, 'shinL', 85); set(P, 'shinR', 85); set(P, 'footL', -5); set(P, 'footR', -5);
    set(P, 'spine', -4);
    if (st.drive) { armsUp(P, 'L', -55, 8, -45); armsUp(P, 'R', -55, 8, -45); set(P, 'handL', 0, 0, -20); set(P, 'handR', 0, 0, 20); if (st.steer) { add(P, 'upper_armL', st.steer * 12); add(P, 'upper_armR', -st.steer * 12); } }
    else { armsUp(P, 'L', -18, 4, -55); armsUp(P, 'R', -18, 4, -55); }
  } else if (st.sitGround) {
    P.root[1] = -0.72; set(P, 'thighL', -85, 0, 18); set(P, 'thighR', -85, 0, -18); set(P, 'shinL', 100); set(P, 'shinR', 100); set(P, 'spine', 8); armsUp(P, 'L', -30, 15, -40); armsUp(P, 'R', -30, 15, -40);
  } else if (st.lie) {
    P.root[1] = -0.8; set(P, 'hips', -90); armsUp(P, 'L', -160, 20, -10); armsUp(P, 'R', -160, 20, -10); set(P, 'shinL', 5); set(P, 'shinR', 5); set(P, 'head', -10);
  } else if (st.cower) {
    P.root[1] = -0.5; set(P, 'hips', 30); set(P, 'spine', 25); set(P, 'chest', 15); set(P, 'head', 25);
    set(P, 'thighL', -100, 0, 8); set(P, 'thighR', -100, 0, -8); set(P, 'shinL', 125); set(P, 'shinR', 125); set(P, 'footL', -30); set(P, 'footR', -30);
    armsUp(P, 'L', -150, -25, -120); armsUp(P, 'R', -150, -25, -120);
    add(P, 'spine', Math.sin(t * 22) * 1.5); rate = 16;
  } else if (st.beg) {
    P.root[1] = -0.45; set(P, 'thighL', -10, 0, 4); set(P, 'thighR', -10, 0, -4); set(P, 'shinL', 100); set(P, 'shinR', 100); set(P, 'footL', 40); set(P, 'footR', 40);
    set(P, 'spine', 10); armsUp(P, 'L', -60, -18, -95); armsUp(P, 'R', -60, -18, -95);
    add(P, 'upper_armL', Math.sin(t * 6) * 6); add(P, 'upper_armR', Math.sin(t * 6) * 6); set(P, 'head', -8);
  } else if (st.swim) {
    const p = t * 3.2;
    P.root[1] = -1.15; set(P, 'hips', -70); set(P, 'head', -55);
    armsUp(P, 'L', -150 + Math.sin(p) * 70, 0, 20 + Math.cos(p) * 30); armsUp(P, 'R', -150 + Math.sin(p) * 70, 0, 20 + Math.cos(p) * 30);
    set(P, 'thighL', Math.sin(p * 2) * 25); set(P, 'thighR', -Math.sin(p * 2) * 25); set(P, 'shinL', 10); set(P, 'shinR', 10);
    if (sp < 0.3) { set(P, 'hips', -10); set(P, 'head', -5); armsUp(P, 'L', -30 + Math.sin(p) * 20, 40, -40); armsUp(P, 'R', -30 - Math.sin(p) * 20, 40, -40); P.root[1] = -1.25; }
  } else if (st.climb !== undefined) {
    const k = st.climb; // 0..1 up a wall
    armsUp(P, 'L', -170 + 60 * k, 10, -10 - 60 * k); armsUp(P, 'R', -170 + 60 * k, 10, -10 - 60 * k);
    set(P, 'thighL', -80 + 70 * k); set(P, 'thighR', -30 - 40 * Math.sin(k * 3)); set(P, 'shinL', 90 - 80 * k); set(P, 'shinR', 60);
    set(P, 'spine', 15); rate = 22;
  } else if (st.vault !== undefined) {
    const k = st.vault;
    set(P, 'hips', 10, 0, 20 * Math.sin(k * Math.PI)); armsUp(P, 'L', -60, 30, -10); set(P, 'thighL', -70 * Math.sin(k * Math.PI)); set(P, 'thighR', -50 * Math.sin(k * Math.PI)); set(P, 'shinL', 60); set(P, 'shinR', 40);
    armsUp(P, 'R', -20, 50, -10); rate = 24;
  } else {
    // ---- on your feet: idle / walk / run, then upper-body overlays ----
    const run = clamp01((sp - 2.6) / 2.4);
    if (sp > 0.25) { ch.walk = (ch.walk || 0) + dt * (sp < 2.6 ? sp * 2.9 : 7.5 + sp * 0.75); locomote(P, ch.walk, sp, run, ch); }
    else stand(P, t, ch);
    if (st.crouch) { P.root[1] -= 0.35; add(P, 'thighL', -60); add(P, 'thighR', -60); add(P, 'shinL', 85); add(P, 'shinR', 85); add(P, 'footL', -25); add(P, 'footR', -25); add(P, 'spine', 22); add(P, 'head', -12); }
    if (st.limp) { add(P, 'hips', 0, 0, Math.sin(ch.walk || 0) * 6); P.root[1] -= Math.max(0, Math.sin(ch.walk || 0)) * 0.04; add(P, 'thighR', 10); }
    if (st.cane) { add(P, 'spine', 14); add(P, 'chest', 6); add(P, 'head', -10); armsUp(P, 'R', -25 + Math.sin(ch.walk || 0) * 10, 6, -10); }
    if (st.skate) { P.root[1] -= 0.08; set(P, 'thighL', -10, 0, 12); set(P, 'thighR', 10, 0, -12); set(P, 'shinL', 15); set(P, 'shinR', 15); set(P, 'hips', 0, 70); set(P, 'spine', 5, -50); armsUp(P, 'L', 0, 25, -10); armsUp(P, 'R', 0, 25, -10); }
    const pitch = st.pitch || 0;
    if (st.cover) { P.root[1] -= 0.4; add(P, 'thighL', -70); add(P, 'thighR', -70); add(P, 'shinL', 95); add(P, 'shinR', 95); add(P, 'spine', 15); }
    if (st.swing > 0) { // two-handed bat swing (or a big punch when unarmed)
      const k = st.swing, s1 = Math.sin(clamp01(k) * Math.PI);
      const bat = st.weapon === 'bat';
      if (bat) {
        const a = -150 + k * 160;
        armsUp(P, 'R', a, 0, 20 - 40 * k); armsUp(P, 'L', a + 15, 0, -30 + 30 * k);
        set(P, 'forearmR', -30); set(P, 'forearmL', -60); set(P, 'spine', 5, -50 + k * 100); set(P, 'chest', 5, -20 + k * 40);
      } else {
        armsUp(P, 'R', -80 * s1 - 10, 0, 15 * s1, -20 - 60 * (1 - s1)); set(P, 'spine', 5, 30 * s1); armsUp(P, 'L', -40, 0, -10, -110);
      }
      rate = 30;
    } else if (st.punch) { // punch / kick combos: i = 0 jab, 1 cross, 2 hook, 3 uppercut, 4 kick
      const { i, t: k } = st.punch, s1 = Math.sin(clamp01(k) * Math.PI);
      armsUp(P, 'L', -60, 0, -20, -110); armsUp(P, 'R', -60, 0, -20, -110); set(P, 'spine', 6, -10); set(P, 'head', -6); // guard
      if (i === 0) { armsUp(P, 'L', -60 - 30 * s1, 0, -20 + 10 * s1, -110 + 105 * s1); set(P, 'spine', 6, -10 - 12 * s1); }
      else if (i === 1) { armsUp(P, 'R', -60 - 30 * s1, 0, -20 + 15 * s1, -110 + 105 * s1); set(P, 'spine', 8, 25 * s1); add(P, 'thighR', 10 * s1); }
      else if (i === 2) { armsUp(P, 'R', -70, 0, -20 + 70 * s1, -90); set(P, 'spine', 6, 45 * s1); }
      else if (i === 3) { armsUp(P, 'R', -60 - 90 * s1, 0, -10, -110 + 30 * s1); set(P, 'spine', -10 * s1, 20 * s1); P.root[1] += 0.05 * s1; }
      else { set(P, 'thighR', -95 * s1); set(P, 'shinR', 80 - 75 * s1); set(P, 'footR', 20); set(P, 'spine', -15 * s1); set(P, 'thighL', 5); }
      rate = 30;
    } else if (st.shove) { const s1 = Math.sin(clamp01(st.shove) * Math.PI); armsUp(P, 'L', -80 * s1, 0, -10, -60 + 50 * s1); armsUp(P, 'R', -80 * s1, 0, -10, -60 + 50 * s1); set(P, 'spine', 10 * s1); rate = 28; }
    else if (st.aim && st.weapon === 'gun') {
      const rifle = st.rifle;
      if (rifle) { armsUp(P, 'R', -55 - pitch, 0, -10, -105); armsUp(P, 'L', -80 - pitch, 0, -25, -15); set(P, 'handR', 0, 0, 10); set(P, 'chest', 0, 15); set(P, 'head', -pitch * 0.3, -15); }
      else { armsUp(P, 'R', -88 - pitch, 0, 8, -4); armsUp(P, 'L', -72 - pitch, 0, -32, -38); set(P, 'chest', 0, 8); set(P, 'head', -pitch * 0.4, -6); }
      set(P, 'spine', P.spine[0] - pitch * 0.3, P.spine[1] + 6);
      if (st.recoil > 0) { add(P, 'upper_armR', -st.recoil * 12); add(P, 'upper_armL', -st.recoil * 10); add(P, 'forearmR', -st.recoil * 8); }
      rate = 26;
    } else if (st.reload > 0) {
      const k = st.reload; armsUp(P, 'R', -45, 0, -20, -80); armsUp(P, 'L', -30 - 30 * Math.sin(k * Math.PI * 2), 0, -30, -70); set(P, 'head', 18);
    } else if (st.handsUp) {
      armsUp(P, 'L', -170, 0, 22, -15); armsUp(P, 'R', -170, 0, 22, -15); set(P, 'handL', 0, 0, 20); set(P, 'handR', 0, 0, -20);
      add(P, 'upper_armL', Math.sin(t * 9) * 2); add(P, 'upper_armR', Math.sin(t * 9.4) * 2);
    } else if (st.reach || st.pull !== undefined) {
      const k = st.pull !== undefined ? Math.sin(Math.min(1, st.pull) * Math.PI) : 0;
      armsUp(P, 'L', -85 + k * 40, 0, -10, -25 - k * 50); armsUp(P, 'R', -85 + k * 40, 0, -10, -25 - k * 50);
      add(P, 'spine', 12 - 30 * k); add(P, 'thighL', -20 * k); add(P, 'shinL', 20 * k); add(P, 'thighR', 15 * k);
    } else if (st.preach) {
      armsUp(P, 'R', -150 + Math.sin(t * 2) * 25, 0, 15, -20); armsUp(P, 'L', -40 + Math.sin(t * 2 + 1) * 30, 0, 15, -60); set(P, 'head', -12);
    } else if (st.sign) {
      armsUp(P, 'L', -150 + Math.sin(t * 3) * 8, 0, -12, -15); armsUp(P, 'R', -150 + Math.sin(t * 3) * 8, 0, -12, -15);
      P.root[1] += Math.abs(Math.sin(t * 3)) * 0.03;
    } else if (st.dance) {
      const b = t * 7; P.root[1] -= 0.06 + Math.abs(Math.sin(b)) * 0.06; set(P, 'hips', 0, Math.sin(b / 2) * 25, Math.sin(b) * 8);
      armsUp(P, 'L', -60 + Math.sin(b) * 60, 0, 40, -60); armsUp(P, 'R', -60 - Math.sin(b) * 60, 0, 40, -60); add(P, 'thighL', -20 * Math.max(0, Math.sin(b))); add(P, 'shinL', 30 * Math.max(0, Math.sin(b)));
    } else if (st.sweep) { // pushing a broom
      const k = Math.sin(t * 2.2); armsUp(P, 'R', -35 + k * 15, 0, -15, -40); armsUp(P, 'L', -55 + k * 15, 0, -25, -60); set(P, 'spine', 22, -k * 10); set(P, 'head', -8);
    } else if (st.wash) { // wiping a car in circles
      const a = t * 3.2; armsUp(P, 'R', -70 + Math.sin(a) * 18, 0, 10 + Math.cos(a) * 18, -30); set(P, 'spine', 18, 10); set(P, 'head', 6);
    } else if (st.stretch) { // runner's lunge
      P.root[1] -= 0.25; set(P, 'thighL', -70); set(P, 'shinL', 75); set(P, 'thighR', 40); set(P, 'shinR', 10); set(P, 'footR', 30);
      set(P, 'spine', 12 + Math.sin(t * 1.5) * 4); armsUp(P, 'L', -40, 0, 10, -30); armsUp(P, 'R', -40, 0, 10, -30);
    } else if (st.clap) {
      const c = Math.abs(Math.sin(t * 9)); armsUp(P, 'L', -60, 0, -30 + 20 * c, -70); armsUp(P, 'R', -60, 0, -30 + 20 * c, -70);
    } else if (st.beckon || st.wave) {
      armsUp(P, 'R', -160, 0, 25 + Math.sin(t * 10) * 18, -20);
    } else if (st.point) {
      armsUp(P, 'R', -90, 0, 0, -2); set(P, 'head', 0, -5);
    } else {
      // one-arm overlays (can stack with walking)
      if (st.phone) { armsUp(P, 'L', -25, 0, 22, -140); set(P, 'handL', 0, 0, -25); set(P, 'head', 0, 10, 6); }
      if (st.text || st.film) { armsUp(P, 'L', st.film ? -100 : -40, 0, -10, st.film ? -40 : -95); armsUp(P, 'R', st.film ? -100 : -40, 0, -10, st.film ? -40 : -95); set(P, 'head', st.film ? 0 : 25); }
      if (st.smoke) { const k = sm(clamp01(Math.sin(t * 0.9 + ch.seed) * 2 - 1)); armsUp(P, 'R', -30 - 20 * k, 0, -10, -60 - 70 * k); set(P, 'handR', 0, 0, 20); if (k > 0.8) set(P, 'head', -6); }
      if (st.drink) { const k = sm(clamp01(Math.sin(t * 0.7 + ch.seed) * 2 - 1)); armsUp(P, 'L', -30 - 20 * k, 0, -10, -80 - 50 * k); set(P, 'head', -12 * k); }
      if (st.chat) { const c = (ch.talk = (ch.talk || Math.random() * 10) + dt); armsUp(P, 'R', -25 - Math.max(0, Math.sin(c * 2.3)) * 30, 0, -10 + Math.sin(c * 1.7) * 15, -60 - Math.max(0, Math.sin(c * 2.3)) * 30); set(P, 'head', Math.sin(c * 1.3) * 4, Math.sin(c * 0.7) * 15); }
      if (st.lean) { add(P, 'hips', 0, 0, 0); P.root[2] -= 0.08; add(P, 'spine', -10); armsUp(P, 'L', 15, 0, -15, -20); armsUp(P, 'R', 15, 0, -15, -20); set(P, 'thighL', -15, 0, -8); set(P, 'shinL', 20); }
      if (st.aim && st.weapon === 'bat') { armsUp(P, 'R', -100, 0, 15, -60); armsUp(P, 'L', -90, 0, -20, -70); set(P, 'spine', 5, -20); }
      if (st.carry) { armsUp(P, 'R', 5, 0, -6, -12); }
      if (st.holdSign) { armsUp(P, 'L', -80, 0, -12, -70); armsUp(P, 'R', -80, 0, -12, -70); }
    }
    if (st.clutch) { armsUp(P, 'L', -40, 0, -35, -110); add(P, 'spine', 18); }
    // look toward something (degrees relative to the body)
    if (st.look) { const lk = Math.max(-70, Math.min(70, st.look / DEG)); add(P, 'head', 0, lk * 0.6); add(P, 'neck', 0, lk * 0.3); }
    if (ch.flinch > 0) { ch.flinch = Math.max(0, ch.flinch - dt * 4); add(P, 'spine', -18 * ch.flinch); add(P, 'head', -25 * ch.flinch); add(P, 'upper_armL', -30 * ch.flinch); add(P, 'upper_armR', -30 * ch.flinch); }
    if (ch.hitT > 0) { // stagger from a hit (direction given by ch.hitX = sideways, ch.hitZ = front/back)
      ch.hitT = Math.max(0, ch.hitT - dt * 3); const k = ch.hitT;
      add(P, 'spine', ch.hitZ * 25 * k, 0, ch.hitX * 20 * k); add(P, 'head', ch.hitZ * 20 * k); P.root[1] -= 0.05 * k;
    }
  }
  if (st.flinch) ch.flinch = 1;
  // ease toward the target pose
  if (!ch.posed) { copyPose(cur, P); ch.posed = true; } else lerpPose(cur, P, 1 - Math.exp(-dt * rate));
  writePose(ch, cur);
}
// make the pose snap (after a teleport, ragdoll release, etc.)
export function snapPose(ch) { ch.posed = false; }
