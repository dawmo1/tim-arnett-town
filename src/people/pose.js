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
const STRIDE = { old: 1.25, fat: 1.18, gang: 0.92 }; // shorter steps need a quicker cadence to keep pace
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
  const ao = ch.armOut || 0; // heavier builds hold their arms out from the body
  set(P, 'upper_armL', 3, 0, 6 + ao); set(P, 'upper_armR', 3, 0, -6 - ao);
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
  const ao = ch.armOut || 0;
  set(P, 'upper_armL', s1 * armA + 4 * w, 0, 7 + 4 * w + ao); set(P, 'upper_armR', -s1 * armA + 4 * w, 0, -7 - 4 * w - ao);
  set(P, 'forearmL', -14 - 70 * w - Math.max(0, s1) * 12 * amp); set(P, 'forearmR', -14 - 70 * w - Math.max(0, -s1) * 12 * amp);
  set(P, 'handL', -5, 0, -5); set(P, 'handR', -5, 0, 5);
  set(P, 'hips', 0, s1 * (5 + 4 * w) * amp, 0); set(P, 'spine', 3 + 9 * w, -s1 * (6 + 5 * w) * amp, 0); set(P, 'chest', 2 + 4 * w, -s1 * 3 * amp, 0);
  set(P, 'neck', -3 * w); set(P, 'head', -3 - 6 * w + Math.abs(c1) * 2);
  P.root[1] = -(0.015 + 0.05 * w) * amp * Math.abs(c1) + 0.012 * w * amp;
  // walk styles (San Andreas-like ped groups), strongest at a walk
  const sty = ch.style, ws = (1 - w * 0.7) * amp;
  if (sty === 'gang') { // rolling swagger: lean back, shoulders roll, loose arms swung wide, a bounce
    add(P, 'spine', -7 * ws, -s1 * 6 * ws); add(P, 'chest', -3 * ws, -s1 * 9 * ws); add(P, 'head', -4 * ws, s1 * 6 * ws);
    add(P, 'upper_armL', 0, 0, 12 * ws); add(P, 'upper_armR', 0, 0, -12 * ws); add(P, 'forearmL', 12 * ws); add(P, 'forearmR', 12 * ws);
    add(P, 'thighL', 0, 0, 3 * ws); add(P, 'thighR', 0, 0, -3 * ws); P.root[1] -= 0.03 * ws * Math.abs(c1);
  } else if (sty === 'fat') { // waddle: short steps, side to side, arms held out
    for (const n of ['thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR']) P[n][0] *= 1 - 0.28 * ws;
    add(P, 'hips', 0, 0, s1 * 8 * ws); add(P, 'spine', -5 * ws, 0, -s1 * 6 * ws); P.root[0] += s1 * 0.03 * ws;
    add(P, 'upper_armL', 0, 0, 10 * ws); add(P, 'upper_armR', 0, 0, -10 * ws); add(P, 'thighL', 0, 0, 5 * ws); add(P, 'thighR', 0, 0, -5 * ws);
  } else if (sty === 'old') { // stooped shuffle: small steps, bent knees, head up
    for (const n of ['thighL', 'thighR', 'upper_armL', 'upper_armR']) P[n][0] *= 1 - 0.45 * ws;
    add(P, 'spine', 14 * ws); add(P, 'chest', 6 * ws); add(P, 'head', -14 * ws); add(P, 'shinL', 10 * ws); add(P, 'shinR', 10 * ws); P.root[1] -= 0.03 * ws;
  } else if (sty === 'woman') { // hips sway, steps cross a little, arms close
    add(P, 'hips', 0, s1 * 4 * ws, -s1 * 6 * ws); add(P, 'spine', 0, 0, s1 * 4 * ws);
    add(P, 'thighL', 0, 0, -4 * ws); add(P, 'thighR', 0, 0, 4 * ws); add(P, 'upper_armL', 0, 0, -3 * ws); add(P, 'upper_armR', 0, 0, 3 * ws);
  }
}
// armsUp(P, side, x, outward, elbow) or armsUp(P, side, x, twist, outward, elbow); outward > 0 lifts the arm away from the body
function armsUp(P, side, ...a) {
  const [x, y, z, elbow] = a.length >= 4 ? a : [a[0], 0, a[1], a[2] ?? -10];
  set(P, 'upper_arm' + side, x, side === 'L' ? y : -y, side === 'L' ? z : -z); set(P, 'forearm' + side, elbow);
}

// on a bicycle: pd = { legs: [thighL, shinL, footL, thighR, shinR, footR] (x angles), lean, reach: [x, outward, elbow] }
function pedalPose(P, pd) {
  const L = pd.legs;
  set(P, 'thighL', L[0], 0, 3); set(P, 'shinL', L[1]); set(P, 'footL', L[2]);
  set(P, 'thighR', L[3], 0, -3); set(P, 'shinR', L[4]); set(P, 'footR', L[5]);
  set(P, 'spine', pd.lean || 0); set(P, 'chest', (pd.lean || 0) * 0.3); set(P, 'head', -(pd.lean || 0) * 0.9);
  if (pd.reach) { const [x, o, el] = pd.reach; armsUp(P, 'L', x, o, el); armsUp(P, 'R', x, o, el); set(P, 'handL', 0, 0, -10); set(P, 'handR', 0, 0, 10); }
}

// ---------- actions: key poses for the interactive moments (src/anim.js times them) ----------
// st.act = { n: name, k: 0..1 progress (or a looping phase), side: 1 | -1 }. side -1 mirrors the pose left/right
// (getting in on the passenger side, say). Poses are built from a few key poses with smooth, slightly overshooting
// blends: San Andreas-style, readable at a distance rather than subtle.
const PAIRS = [['shoulderL', 'shoulderR'], ['upper_armL', 'upper_armR'], ['forearmL', 'forearmR'], ['handL', 'handR'], ['thighL', 'thighR'], ['shinL', 'shinR'], ['footL', 'footR']];
function mirror(P) {
  for (const [a, b] of PAIRS) { const x = P[a]; P[a] = P[b]; P[b] = x; }
  for (const n of BONES) { P[n][1] = -P[n][1]; P[n][2] = -P[n][2]; }
  P.root[0] = -P.root[0];
}
const TA = blankPose(), TB = blankPose();
function clearPose(P) { for (const n in P) { P[n][0] = 0; P[n][1] = 0; P[n][2] = 0; } }
// key poses: [[k, fn(P)], ...] -> P at progress k (smoothstep between neighbours)
function keys(P, k, list) {
  let i = 0;
  while (i < list.length - 2 && k > list[i + 1][0]) i++;
  const [k0, f0] = list[i], [k1, f1] = list[i + 1];
  const u = sm(clamp01((k - k0) / Math.max(1e-6, k1 - k0)));
  clearPose(TA); f0(TA); clearPose(TB); f1(TB);
  for (const n in P) { const a = TA[n], b = TB[n], o = P[n]; o[0] = a[0] + (b[0] - a[0]) * u; o[1] = a[1] + (b[1] - a[1]) * u; o[2] = a[2] + (b[2] - a[2]) * u; }
}
function seated(P, t, ch, drive) {
  stand(P, t, ch);
  P.root[1] = -0.42; set(P, 'thighL', -88, 0, 4); set(P, 'thighR', -88, 0, -4); set(P, 'shinL', 85); set(P, 'shinR', 85); set(P, 'footL', -5); set(P, 'footR', -5);
  set(P, 'spine', -4);
  if (drive) { armsUp(P, 'L', -55, 8, -45); armsUp(P, 'R', -55, 8, -45); set(P, 'handL', 0, 0, -20); set(P, 'handR', 0, 0, 20); }
  else { armsUp(P, 'L', -18, 4, -55); armsUp(P, 'R', -18, 4, -55); }
}
function stool(P, t, ch) { // perched on a bar stool: higher seat, feet on the rail
  stand(P, t, ch);
  P.root[1] = -0.2; set(P, 'thighL', -72, 0, 8); set(P, 'thighR', -72, 0, -8); set(P, 'shinL', 95); set(P, 'shinR', 80); set(P, 'footL', -15); set(P, 'footR', -10);
  set(P, 'spine', 8); armsUp(P, 'L', -45, 6, -70); armsUp(P, 'R', -40, 6, -80);
}
function kneel(P) { // down on the right knee, left foot planted, a hand on the knee
  P.root[1] = -0.46; set(P, 'hips', 12); set(P, 'spine', 18); set(P, 'head', -10);
  set(P, 'thighL', -100, 0, 6); set(P, 'shinL', 100); set(P, 'footL', -10);
  set(P, 'thighR', -12, 0, -4); set(P, 'shinR', 100); set(P, 'footR', 40);
  armsUp(P, 'L', -55, 0, 8, -50); armsUp(P, 'R', -25, 0, 12, -30);
}
function actPose(P, ch, a, t, st) {
  const k = a.k || 0, n = a.n;
  let rate = 18;
  const S = (fn) => (Q) => fn(Q); // (readability)
  switch (n) {
    case 'carOpen': // facing the door: reach for the handle, pull it open and step back with it
      keys(P, k, [
        [0, S((Q) => stand(Q, t, ch))],
        [0.4, S((Q) => { stand(Q, t, ch); armsUp(Q, 'R', -80, 0, 4, -25); set(Q, 'spine', 10, 8); set(Q, 'head', 8); })],
        [1, S((Q) => { stand(Q, t, ch); armsUp(Q, 'R', -55, 0, 55, -55); set(Q, 'spine', 2, 28); set(Q, 'thighR', 14); set(Q, 'thighL', -10); Q.root[2] -= 0.12; })],
      ]);
      rate = 16; break;
    case 'carIn': // duck under the roof, swing a leg in, drop into the seat (the body turns and slides in main.js)
      keys(P, k, [
        [0, S((Q) => stand(Q, t, ch))],
        [0.45, S((Q) => { stand(Q, t, ch); Q.root[1] = -0.14; set(Q, 'spine', 26); set(Q, 'chest', 10); set(Q, 'head', 16); set(Q, 'thighR', -72); set(Q, 'shinR', 75); set(Q, 'thighL', -15); set(Q, 'shinL', 25); armsUp(Q, 'L', -110, 0, 18, -35); armsUp(Q, 'R', -40, 0, 20, -40); })],
        [1, S((Q) => seated(Q, t, ch, true))],
      ]);
      rate = 16; break;
    case 'carShut': // sat in the seat: reach out for the door and pull it shut
      keys(P, k, [
        [0, S((Q) => seated(Q, t, ch, true))],
        [0.45, S((Q) => { seated(Q, t, ch, true); armsUp(Q, 'L', -60, 0, 62, -25); set(Q, 'chest', 0, 25); set(Q, 'head', 0, 30); })],
        [1, S((Q) => seated(Q, t, ch, true))],
      ]);
      rate = 18; break;
    case 'carOut': // push the door, swing the legs out, stand up beside the car
      keys(P, k, [
        [0, S((Q) => seated(Q, t, ch, true))],
        [0.3, S((Q) => { seated(Q, t, ch, false); armsUp(Q, 'L', -55, 0, 55, -15); set(Q, 'chest', 0, 20); })],
        [0.6, S((Q) => { stand(Q, t, ch); Q.root[1] = -0.2; set(Q, 'spine', 28); set(Q, 'head', 12); set(Q, 'thighL', -70); set(Q, 'shinL', 80); set(Q, 'thighR', -40); set(Q, 'shinR', 60); armsUp(Q, 'L', -100, 0, 25, -30); armsUp(Q, 'R', -30, 0, 15, -40); })],
        [1, S((Q) => stand(Q, t, ch))],
      ]);
      rate = 16; break;
    case 'shutStand': // standing beside the car: shove the door shut with the near hand
      keys(P, k, [
        [0, S((Q) => stand(Q, t, ch))],
        [0.4, S((Q) => { stand(Q, t, ch); armsUp(Q, 'R', -20, 0, 70, -70); set(Q, 'spine', 0, -15); set(Q, 'head', 0, -25); })],
        [0.7, S((Q) => { stand(Q, t, ch); armsUp(Q, 'R', -30, 0, 60, -5); set(Q, 'spine', 4, -25, -6); set(Q, 'head', 0, -30); })],
        [1, S((Q) => stand(Q, t, ch))],
      ]);
      rate = 20; break;
    case 'door': // shoulder a building door open and step through
      keys(P, k, [
        [0, S((Q) => stand(Q, t, ch))],
        [0.45, S((Q) => { stand(Q, t, ch); armsUp(Q, 'R', -88, 0, 4, -60); set(Q, 'spine', 6, 10); set(Q, 'thighL', -25); set(Q, 'shinL', 20); })],
        [1, S((Q) => { stand(Q, t, ch); armsUp(Q, 'R', -85, 0, 6, -8); set(Q, 'spine', 12, 4); set(Q, 'thighL', -30); set(Q, 'shinL', 10); set(Q, 'thighR', 15); Q.root[2] += 0.1; })],
      ]);
      rate = 18; break;
    case 'give': case 'take': { // hand cash over a counter (give) / take a bag back (take), with a little nod
      const s = Math.sin(clamp01(k) * Math.PI), side = n === 'give' ? 'R' : 'L';
      stand(P, t, ch);
      armsUp(P, side, -72 * s - 6, 0, 4, -25 - 40 * (1 - s)); set(P, 'spine', 7 * s, (n === 'give' ? 8 : -8) * s); set(P, 'head', 10 * s);
      rate = 20; break;
    }
    case 'eat': { // hot dog / drink: bites, chew, look about
      const c = Math.max(0, Math.sin(k * Math.PI * 2 * 2));
      stand(P, t, ch);
      armsUp(P, 'R', -35 - 25 * c, 0, -12, -90 - 45 * c); set(P, 'handR', 0, 0, 20); set(P, 'head', -6 * c); set(P, 'spine', -2);
      rate = 16; break;
    }
    case 'fillBag': { // a clerk at gunpoint: scoop the till into a bag, hands shaking, glancing up
      const w = Math.sin(k * Math.PI * 2 * 3), sh = Math.sin(t * 25) * 2;
      stand(P, t, ch);
      set(P, 'spine', 22); set(P, 'chest', 8); set(P, 'head', 4 + Math.max(0, Math.sin(k * Math.PI * 2)) * -14);
      armsUp(P, 'L', -55 + 18 * w + sh, 0, 4, -50); armsUp(P, 'R', -55 - 18 * w - sh, 0, 4, -50);
      rate = 18; break;
    }
    case 'pool': { // bent over the table: bridge hand down, the cue arm draws back and strokes through
      const s = Math.sin(k * Math.PI * 2), strike = k > 0.85 ? Math.sin((k - 0.85) / 0.15 * Math.PI) : 0;
      stand(P, t, ch);
      P.root[1] = -0.08; set(P, 'hips', 8); set(P, 'spine', 34); set(P, 'chest', 12); set(P, 'head', -34); set(P, 'neck', -8);
      set(P, 'thighL', -30, 0, 4); set(P, 'shinL', 25); set(P, 'thighR', 10, 0, -6); set(P, 'shinR', 6);
      armsUp(P, 'L', -95, 0, 22, -12); set(P, 'handL', 0, 0, -30);
      armsUp(P, 'R', 12 + 16 * s - 30 * strike, 0, 14, -100 + 30 * s + 60 * strike);
      rate = 20; break;
    }
    case 'darts': { // sight, cock the wrist back, throw, follow through
      keys(P, k, [
        [0, S((Q) => { stand(Q, t, ch); armsUp(Q, 'R', -100, 0, 6, -95); set(Q, 'thighL', -8); set(Q, 'thighR', 8); set(Q, 'spine', 4, 15); })],
        [0.55, S((Q) => { stand(Q, t, ch); armsUp(Q, 'R', -110, 0, 6, -125); set(Q, 'thighL', -8); set(Q, 'thighR', 8); set(Q, 'spine', 2, 18); set(Q, 'head', 4); })],
        [0.7, S((Q) => { stand(Q, t, ch); armsUp(Q, 'R', -95, 0, 4, -8); set(Q, 'thighL', -12); set(Q, 'thighR', 10); set(Q, 'spine', 10, 6); })],
        [1, S((Q) => { stand(Q, t, ch); armsUp(Q, 'R', -100, 0, 6, -95); set(Q, 'thighL', -8); set(Q, 'thighR', 8); set(Q, 'spine', 4, 15); })],
      ]);
      rate = 22; break;
    }
    case 'table': { // cards / roulette: lean on the table, tap and shuffle chips
      const c = Math.sin(t * 2.2), d = Math.max(0, Math.sin(t * 1.3));
      stand(P, t, ch);
      set(P, 'spine', 16); set(P, 'head', 10 + 4 * c);
      armsUp(P, 'L', -48, 0, -4, -62); armsUp(P, 'R', -52 - 8 * d, 0, -2, -58 + 10 * c);
      rate = 12; break;
    }
    case 'slots': // one hand on the machine, the other hauls the lever down
      keys(P, k, [
        [0, S((Q) => { stand(Q, t, ch); set(Q, 'spine', 8); armsUp(Q, 'L', -55, 0, -2, -60); armsUp(Q, 'R', -130, 0, 14, -30); })],
        [0.35, S((Q) => { stand(Q, t, ch); set(Q, 'spine', 12); armsUp(Q, 'L', -55, 0, -2, -60); armsUp(Q, 'R', -60, 0, 14, -25); })],
        [1, S((Q) => { stand(Q, t, ch); set(Q, 'spine', 8); set(Q, 'head', 6); armsUp(Q, 'L', -55, 0, -2, -60); armsUp(Q, 'R', -125, 0, 14, -30); })],
      ]);
      rate = 18; break;
    case 'sit': seated(P, t, ch, false); set(P, 'head', Math.sin(t * 0.4 + ch.seed) * 6, Math.sin(t * 0.23 + ch.seed) * 18); rate = 10; break;
    case 'stool': stool(P, t, ch); set(P, 'head', 0, Math.sin(t * 0.3 + ch.seed) * 20); rate = 10; break;
    case 'getUpFront': // face down: push up, get a knee under you, stand
      keys(P, k, [
        [0, S((Q) => { Q.root[1] = -0.8; set(Q, 'hips', 86); set(Q, 'head', -30); armsUp(Q, 'L', -90, 0, 30, -100); armsUp(Q, 'R', -90, 0, 30, -100); set(Q, 'shinL', 5); set(Q, 'shinR', 5); })],
        [0.3, S((Q) => { Q.root[1] = -0.62; set(Q, 'hips', 62); set(Q, 'head', -25); armsUp(Q, 'L', -80, 0, 14, -10); armsUp(Q, 'R', -80, 0, 14, -10); set(Q, 'thighL', -40); set(Q, 'shinL', 90); set(Q, 'thighR', -10); set(Q, 'shinR', 40); })],
        [0.65, S((Q) => kneel(Q))],
        [1, S((Q) => stand(Q, t, ch))],
      ]);
      rate = 18; break;
    case 'getUpBack': // face up: sit up, roll onto a knee, push off it and stand
      keys(P, k, [
        [0, S((Q) => { Q.root[1] = -0.8; set(Q, 'hips', -86); set(Q, 'head', 10); armsUp(Q, 'L', -15, 0, 40, -20); armsUp(Q, 'R', -15, 0, 40, -20); set(Q, 'shinL', 8); set(Q, 'shinR', 4); })],
        [0.3, S((Q) => { Q.root[1] = -0.74; set(Q, 'hips', -6); set(Q, 'spine', 22); set(Q, 'head', 8); set(Q, 'thighL', -86); set(Q, 'thighR', -80); set(Q, 'shinL', 30); set(Q, 'shinR', 10); armsUp(Q, 'L', 35, 0, 25, -5); armsUp(Q, 'R', 35, 0, 25, -5); })],
        [0.62, S((Q) => kneel(Q))],
        [1, S((Q) => stand(Q, t, ch))],
      ]);
      rate = 18; break;
    case 'carTry': case 'carSmash': case 'carReach': case 'hotwire': case 'carHandsUp': rate = mechPose(P, ch, n, k, t); break;
    default: stand(P, t, ch);
  }
  if (a.side < 0) mirror(P);
  return rate;
}

// Breaking into cars (src/carjack.js), facing the driver's door like carOpen: rattle the locked handle, wind up and
// drive an elbow through the window, reach in for the lock; then hunched under the dash pulling wires (seated).
function mechPose(P, ch, n, k, t) {
  const reach = (Q) => { stand(Q, t, ch); armsUp(Q, 'R', -80, 0, 4, -25); set(Q, 'spine', 10, 8); set(Q, 'head', 8); };
  const yank = (Q) => { stand(Q, t, ch); armsUp(Q, 'R', -62, 0, 8, -55); set(Q, 'spine', -6, 16); set(Q, 'chest', -4); set(Q, 'thighL', -14); set(Q, 'thighR', 10); Q.root[2] -= 0.08; };
  switch (n) {
    case 'carTry': // grab the handle, haul on it twice; it won't give
      keys(P, k, [[0, (Q) => stand(Q, t, ch)], [0.25, reach], [0.42, yank], [0.58, reach], [0.74, yank], [1, (Q) => { stand(Q, t, ch); set(Q, 'head', 4, 20); }]]);
      return 20;
    case 'carSmash': // look about, cock the elbow back and up, drive it through the glass, shake the arm off
      keys(P, k, [
        [0, (Q) => { stand(Q, t, ch); set(Q, 'head', 4, 20); }],
        [0.38, (Q) => { stand(Q, t, ch); armsUp(Q, 'R', -45, 25, 60, -150); set(Q, 'handR', 0, 0, 30); set(Q, 'spine', -4, -32); set(Q, 'chest', 0, -14); set(Q, 'head', 0, 18); set(Q, 'thighR', 12); set(Q, 'thighL', -6); Q.root[2] -= 0.06; }],
        [0.5, (Q) => { stand(Q, t, ch); armsUp(Q, 'R', -88, -10, 12, -150); set(Q, 'handR', 0, 0, 30); set(Q, 'spine', 14, 30); set(Q, 'chest', 6, 12); set(Q, 'head', 6, -6); set(Q, 'thighL', -26); set(Q, 'shinL', 16); set(Q, 'thighR', 14); Q.root[2] += 0.1; }],
        [0.68, (Q) => { stand(Q, t, ch); armsUp(Q, 'R', -80, -6, 18, -140); set(Q, 'spine', 12, 24); set(Q, 'head', 10); set(Q, 'thighL', -22); set(Q, 'shinL', 14); Q.root[2] += 0.08; }],
        [1, (Q) => { stand(Q, t, ch); armsUp(Q, 'R', -30, 0, 22, -40); set(Q, 'spine', 4, 6); }],
      ]);
      return 26;
    case 'carReach': // lean in through the broken window, feel for the lock, pop it
      keys(P, k, [
        [0, (Q) => { stand(Q, t, ch); armsUp(Q, 'R', -30, 0, 22, -40); }],
        [0.4, (Q) => { stand(Q, t, ch); armsUp(Q, 'R', -100, 0, 6, -20); set(Q, 'handR', 0, 0, 25); set(Q, 'spine', 24, 10); set(Q, 'chest', 8); set(Q, 'head', 14); set(Q, 'thighL', -18); set(Q, 'shinL', 12); Q.root[2] += 0.12; Q.root[1] -= 0.04; }],
        [0.65, (Q) => { stand(Q, t, ch); armsUp(Q, 'R', -112, 0, 2, -45); set(Q, 'handR', 30, 0, 25); set(Q, 'spine', 28, 6); set(Q, 'chest', 8); set(Q, 'head', 16); set(Q, 'thighL', -18); set(Q, 'shinL', 12); Q.root[2] += 0.14; Q.root[1] -= 0.05; }],
        [1, (Q) => stand(Q, t, ch)],
      ]);
      return 18;
    case 'hotwire': { // sat low, head under the steering column, both hands twisting wires (k loops)
      const a = Math.sin(t * 13), b = Math.sin(t * 9 + 1.3), spark = Math.max(0, Math.sin(k * Math.PI * 6)) ** 8;
      seated(P, t, ch, false);
      set(P, 'spine', 30); set(P, 'chest', 14, -8); set(P, 'neck', 10); set(P, 'head', 22 - spark * 14, -10);
      armsUp(P, 'L', -62 + a * 6, -10, 14, -85 + b * 10); armsUp(P, 'R', -58 - a * 6, 10, 10, -80 - b * 12);
      set(P, 'handL', b * 25, 0, -10); set(P, 'handR', -a * 25, 0, 10);
      return 22;
    }
    case 'carHandsUp': // a driver held up at gunpoint: sat in the seat, both hands high off the wheel
      seated(P, t, ch, false);
      armsUp(P, 'L', -160, 0, 30, -40); armsUp(P, 'R', -160, 0, 30, -40); set(P, 'spine', -8); set(P, 'head', -6 + Math.sin(t * 20) * 2);
      return 16;
  }
  stand(P, t, ch);
  return 14;
}

// ---------- melee (src/combat.js times them): key poses with a wind-up, a snap to the contact pose, and recovery ----------
// Each move is a list of [k, fn] keys over the pose underneath (legs from walking or standing), so a punch can be
// thrown on the move. Key times line up with the contact fraction in combat.js MOVES.
const guardFists = (Q) => { armsUp(Q, 'L', -62, 0, -18, -112); armsUp(Q, 'R', -55, 0, -20, -118); set(Q, 'handL', 0, 0, -8); set(Q, 'handR', 0, 0, 8); add(Q, 'spine', 6, -10); add(Q, 'head', -6, 8); };
const guardKnife = (Q) => { armsUp(Q, 'L', -55, 0, -12, -100); armsUp(Q, 'R', -48, 0, 12, -62); add(Q, 'spine', 8, -14); add(Q, 'head', -4, 10); };
const guardBat = (Q) => { armsUp(Q, 'R', -100, 0, 15, -60); armsUp(Q, 'L', -90, 0, -20, -70); add(Q, 'spine', 5, -20); };
const stance = (Q) => { set(Q, 'thighL', -14, 0, 4); set(Q, 'shinL', 12); set(Q, 'thighR', 10, 0, -5); set(Q, 'shinR', 14); set(Q, 'footR', -8); Q.root[1] -= 0.03; };
const MELEE = {
  jab: [[0, guardFists], [0.18, (Q) => { guardFists(Q); armsUp(Q, 'L', -55, 0, -14, -128); add(Q, 'spine', 0, 4); }],
    [0.4, (Q) => { guardFists(Q); armsUp(Q, 'L', -93, 0, -6, -3); add(Q, 'spine', 0, -20); add(Q, 'chest', 0, -10); add(Q, 'head', 0, 6); Q.root[2] += 0.05; }],
    [0.62, (Q) => { guardFists(Q); armsUp(Q, 'L', -86, 0, -10, -35); add(Q, 'spine', 0, -12); }], [1, guardFists]],
  cross: [[0, guardFists], [0.2, (Q) => { guardFists(Q); armsUp(Q, 'R', -48, 0, -14, -128); add(Q, 'spine', 0, -10); }],
    [0.42, (Q) => { guardFists(Q); armsUp(Q, 'L', -50, 0, -25, -120); armsUp(Q, 'R', -93, 0, -8, -3); add(Q, 'spine', 4, 32); add(Q, 'chest', 0, 12); add(Q, 'head', 0, -14); add(Q, 'thighR', 12); add(Q, 'footR', -12); Q.root[2] += 0.07; }],
    [0.66, (Q) => { guardFists(Q); armsUp(Q, 'R', -80, 0, -12, -45); add(Q, 'spine', 2, 18); }], [1, guardFists]],
  // (the hook's upper arm is twisted so the elbow bends level: the fist swings round, not up)
  hook: [[0, guardFists], [0.25, (Q) => { guardFists(Q); armsUp(Q, 'R', -72, 80, 52, -95); add(Q, 'spine', 0, -26); add(Q, 'chest', 0, -8); }],
    [0.48, (Q) => { guardFists(Q); armsUp(Q, 'R', -88, 85, 10, -95); add(Q, 'spine', 4, 46); add(Q, 'chest', 0, 16); add(Q, 'hips', 0, 10); add(Q, 'head', 0, -22); Q.root[2] += 0.04; }],
    [0.7, (Q) => { guardFists(Q); armsUp(Q, 'R', -82, 80, -6, -105); add(Q, 'spine', 2, 38); }], [1, guardFists]],
  upper: [[0, guardFists], [0.22, (Q) => { guardFists(Q); Q.root[1] -= 0.1; add(Q, 'thighL', -22); add(Q, 'shinL', 34); add(Q, 'thighR', -22); add(Q, 'shinR', 34); armsUp(Q, 'R', -12, 0, 6, -112); add(Q, 'spine', 16, -16); }],
    [0.42, (Q) => { guardFists(Q); Q.root[1] += 0.04; armsUp(Q, 'R', -165, 0, 2, -50); add(Q, 'spine', -14, 22); add(Q, 'chest', -6, 8); add(Q, 'head', -12, -10); set(Q, 'footR', 18); }],
    [0.66, (Q) => { guardFists(Q); armsUp(Q, 'R', -140, 0, 4, -70); add(Q, 'spine', -8, 14); }], [1, guardFists]],
  kick: [[0, guardFists], [0.22, (Q) => { guardFists(Q); set(Q, 'thighR', -88); set(Q, 'shinR', 105); set(Q, 'footR', 10); add(Q, 'spine', -4); }],
    [0.42, (Q) => { guardFists(Q); set(Q, 'thighR', -98); set(Q, 'shinR', 6); set(Q, 'footR', -25); add(Q, 'spine', -20); add(Q, 'head', 10); set(Q, 'thighL', 6); set(Q, 'shinL', 8); }],
    [0.7, (Q) => { guardFists(Q); set(Q, 'thighR', -70); set(Q, 'shinR', 90); add(Q, 'spine', -6); }], [1, guardFists]],
  stomp: [[0, guardFists], [0.3, (Q) => { armsUp(Q, 'L', -40, 0, 22, -60); armsUp(Q, 'R', -30, 0, 26, -50); set(Q, 'thighR', -88); set(Q, 'shinR', 88); set(Q, 'footR', 0); add(Q, 'spine', 12); add(Q, 'head', 24); }],
    [0.55, (Q) => { armsUp(Q, 'L', -30, 0, 30, -40); armsUp(Q, 'R', -20, 0, 30, -40); set(Q, 'thighR', -28); set(Q, 'shinR', 22); set(Q, 'footR', 4); add(Q, 'spine', 26); add(Q, 'head', 28); Q.root[1] -= 0.06; set(Q, 'thighL', -6); set(Q, 'shinL', 18); }],
    [0.78, (Q) => { armsUp(Q, 'L', -40, 0, 20, -70); armsUp(Q, 'R', -35, 0, 20, -70); set(Q, 'thighR', -14); set(Q, 'shinR', 18); add(Q, 'spine', 16); add(Q, 'head', 18); }], [1, guardFists]],
  slashR: [[0, guardKnife], [0.2, (Q) => { guardKnife(Q); armsUp(Q, 'R', -96, 0, 68, -55); add(Q, 'spine', 0, -26); }],
    [0.45, (Q) => { guardKnife(Q); armsUp(Q, 'R', -82, 0, -38, -10); add(Q, 'spine', 4, 32); add(Q, 'chest', 0, 10); Q.root[2] += 0.05; }],
    [0.7, (Q) => { guardKnife(Q); armsUp(Q, 'R', -62, 0, -46, -36); add(Q, 'spine', 4, 34); }], [1, guardKnife]],
  slashL: [[0, guardKnife], [0.2, (Q) => { guardKnife(Q); armsUp(Q, 'R', -92, 0, -42, -100); add(Q, 'spine', 0, 26); }],
    [0.45, (Q) => { guardKnife(Q); armsUp(Q, 'R', -86, 0, 58, -8); add(Q, 'spine', 4, -28); add(Q, 'chest', 0, -8); Q.root[2] += 0.05; }],
    [0.7, (Q) => { guardKnife(Q); armsUp(Q, 'R', -70, 0, 66, -30); add(Q, 'spine', 2, -30); }], [1, guardKnife]],
  stab: [[0, guardKnife], [0.22, (Q) => { guardKnife(Q); armsUp(Q, 'R', 12, 0, 16, -118); add(Q, 'spine', 0, -18); }],
    [0.45, (Q) => { guardKnife(Q); armsUp(Q, 'R', -90, 0, -6, -2); add(Q, 'spine', 14, 20); add(Q, 'chest', 4, 6); set(Q, 'thighL', -34); set(Q, 'shinL', 28); set(Q, 'thighR', 16); set(Q, 'shinR', 10); Q.root[1] -= 0.06; Q.root[2] += 0.12; }],
    [0.7, (Q) => { guardKnife(Q); armsUp(Q, 'R', -84, 0, -4, -20); add(Q, 'spine', 10, 14); set(Q, 'thighL', -24); set(Q, 'shinL', 22); }], [1, guardKnife]],
  swingR: [[0, guardBat], [0.3, (Q) => { armsUp(Q, 'R', -140, 0, 40, -100); armsUp(Q, 'L', -130, 0, -4, -110); add(Q, 'spine', 2, -55); add(Q, 'chest', 0, -20); add(Q, 'thighL', -10); }],
    [0.5, (Q) => { armsUp(Q, 'R', -85, 0, -10, -15); armsUp(Q, 'L', -80, 0, -36, -30); add(Q, 'spine', 6, 36); add(Q, 'chest', 0, 16); add(Q, 'hips', 0, 14); add(Q, 'head', 0, -26); }],
    [0.75, (Q) => { armsUp(Q, 'R', -96, 0, -42, -60); armsUp(Q, 'L', -90, 0, -52, -70); add(Q, 'spine', 4, 64); add(Q, 'chest', 0, 20); add(Q, 'head', 0, -40); }], [1, guardBat]],
  swingL: [[0, guardBat], [0.3, (Q) => { armsUp(Q, 'R', -130, 0, -50, -90); armsUp(Q, 'L', -125, 0, -62, -100); add(Q, 'spine', 2, 50); add(Q, 'chest', 0, 16); }],
    [0.5, (Q) => { armsUp(Q, 'R', -86, 0, 32, -10); armsUp(Q, 'L', -80, 0, 2, -25); add(Q, 'spine', 6, -32); add(Q, 'chest', 0, -12); add(Q, 'head', 0, 24); }],
    [0.75, (Q) => { armsUp(Q, 'R', -92, 0, 52, -50); armsUp(Q, 'L', -88, 0, 20, -60); add(Q, 'spine', 4, -56); add(Q, 'head', 0, 36); }], [1, guardBat]],
  smash: [[0, guardBat], [0.32, (Q) => { armsUp(Q, 'R', -176, 0, 14, -92); armsUp(Q, 'L', -170, 0, 4, -96); add(Q, 'spine', -12); add(Q, 'chest', -8); add(Q, 'head', -8); Q.root[1] += 0.02; }],
    [0.52, (Q) => { armsUp(Q, 'R', -68, 0, 4, -6); armsUp(Q, 'L', -64, 0, -10, -12); add(Q, 'spine', 32); add(Q, 'chest', 10); Q.root[1] -= 0.12; set(Q, 'thighL', -34); set(Q, 'shinL', 40); set(Q, 'thighR', -16); set(Q, 'shinR', 36); }],
    [0.76, (Q) => { armsUp(Q, 'R', -44, 0, 6, -20); armsUp(Q, 'L', -40, 0, -6, -24); add(Q, 'spine', 30); Q.root[1] -= 0.08; set(Q, 'thighL', -26); set(Q, 'shinL', 30); }], [1, guardBat]],
};
const PUNCH_N = ['jab', 'cross', 'hook', 'upper', 'kick'];
const MB = blankPose();
// pose a melee move over P (which holds the legs underneath); still: not walking, so plant a fighting stance
function meleePose(P, n, k, still) {
  const list = MELEE[n]; if (!list) return;
  copyPose(MB, P);
  keys(P, k, list.map(([kk, fn]) => [kk, (Q) => { copyPose(Q, MB); if (still) stance(Q); fn(Q); }]));
}

// ---------- swimming (src/swim.js): s = { style: tread | breast | crawl | under | dive, k (dive progress), pitch } ----------
// The body lies along the water by turning the hips (the whole skeleton) PRONE degrees; limbs are posed as if
// standing, so "arms overhead" is "arms reaching forward" once prone. Exaggerated San Andreas strokes.
const PRONE = 84;
const SWIM_RATE = { tread: 1.1, breast: 0.85, crawl: 1.25, under: 0.75, dive: 0 };
function swimPose(P, ch, s, t, dt, sp) {
  const style = s.style || (sp < 0.3 ? 'tread' : 'breast');
  if (style !== 'dive') ch.swimPh = ((ch.swimPh || 0) + dt * SWIM_RATE[style] * (style === 'tread' || sp > 0.2 ? 1 : 0.35)) % 1;
  const p = ch.swimPh || 0, w = p * Math.PI * 2;
  if (style === 'tread') { // upright, head out, legs eggbeating, hands sculling flat
    P.root[1] = -0.78 + Math.sin(w * 2) * 0.03;
    set(P, 'hips', 8); set(P, 'spine', 6); set(P, 'chest', 2); set(P, 'head', -6, Math.sin(t * 0.7) * 10);
    set(P, 'thighL', -38 + Math.sin(w) * 22, 0, 16 + Math.cos(w) * 10); set(P, 'shinL', 75 + Math.sin(w + 1.2) * 30);
    set(P, 'thighR', -38 - Math.sin(w) * 22, 0, -16 + Math.cos(w) * 10); set(P, 'shinR', 75 - Math.sin(w + 1.2) * 30);
    set(P, 'footL', 20); set(P, 'footR', 20);
    const sc = Math.sin(w * 2);
    armsUp(P, 'L', -38, 0, 52 + sc * 22, -28); armsUp(P, 'R', -38, 0, 52 - sc * 22, -28);
    set(P, 'handL', 0, 0, -20 * sc); set(P, 'handR', 0, 0, -20 * sc);
    return 16;
  }
  if (style === 'crawl') { // freestyle: alternating arms, body roll, flutter kick, a breath to the side every stroke
    P.root[1] = -0.04; P.root[2] = 0; // (the back just breaking the surface)
    const arm = (side, q) => {
      if (q < 0.5) { const u = q / 0.5; armsUp(P, side, -180 + 175 * u, 0, 10, -15 - 70 * Math.sin(u * Math.PI)); } // the pull, under the body
      else { const u = (q - 0.5) / 0.5; armsUp(P, side, -5 + 185 * u, 0, 14 + 55 * Math.sin(u * Math.PI), -20 - 95 * Math.sin(u * Math.PI)); } // high-elbow recovery over the water
    };
    arm('L', p); arm('R', (p + 0.5) % 1);
    const roll = Math.sin(w) * 28;
    set(P, 'hips', PRONE, roll * 0.6); set(P, 'spine', 0, roll * 0.4); set(P, 'chest', 0, roll * 0.2);
    set(P, 'head', -38, -roll * 0.3 + 45 * Math.pow(Math.max(0, Math.sin(w)), 4), 0); set(P, 'neck', -12);
    const f = Math.sin(w * 3);
    set(P, 'thighL', -22 + f * 14, 0, 3); set(P, 'thighR', -22 - f * 14, 0, -3); set(P, 'shinL', 8 + Math.max(0, f) * 14); set(P, 'shinR', 8 + Math.max(0, -f) * 14); set(P, 'footL', 45); set(P, 'footR', 45);
    return 22;
  }
  if (style === 'dive') { // duck dive: tuck the head, reach down, kick the legs up
    const k = clamp01(s.k ?? 1);
    P.root[1] = -0.42 - 0.3 * k;
    set(P, 'hips', PRONE * sm(Math.min(1, k * 1.6)) + 40 * k); set(P, 'head', -10 - 20 * (1 - k));
    armsUp(P, 'L', -175, 0, 8, -6); armsUp(P, 'R', -175, 0, 8, -6);
    set(P, 'thighL', -40 * Math.sin(k * Math.PI)); set(P, 'thighR', -40 * Math.sin(k * Math.PI)); set(P, 'shinL', 60 * Math.sin(k * Math.PI)); set(P, 'shinR', 60 * Math.sin(k * Math.PI)); set(P, 'footL', 50); set(P, 'footR', 50);
    return 14;
  }
  // breaststroke (surface: head up for the breath on the pull; underwater: a long pull to the thighs, pitched to where you're heading)
  const under = style === 'under', pitch = under ? Math.max(-70, Math.min(70, s.pitch || 0)) : 0;
  const B = (Q, ax, az, el, th, sh, tz, hd) => {
    Q.root[1] = under ? -0.42 : -0.1; set(Q, 'hips', PRONE - (under ? 0 : 14) + pitch); set(Q, 'head', hd); set(Q, 'neck', -10);
    armsUp(Q, 'L', ax, 0, az, el); armsUp(Q, 'R', ax, 0, az, el);
    set(Q, 'thighL', th, 0, tz); set(Q, 'thighR', th, 0, -tz); set(Q, 'shinL', sh); set(Q, 'shinR', sh); set(Q, 'footL', 40 - sh * 0.3); set(Q, 'footR', 40 - sh * 0.3);
  };
  const hd = under ? -30 : -48, up = under ? -34 : -68;
  keys(P, p, under ? [
    [0, (Q) => B(Q, -178, 6, -4, 4, 6, 3, hd)],
    [0.3, (Q) => B(Q, -120, 75, -15, 4, 6, 3, hd)],
    [0.5, (Q) => B(Q, -15, 22, -10, -40, 105, 22, up)], // the long pull, hands to the thighs, legs drawn up
    [0.68, (Q) => B(Q, -95, 14, -125, -50, 115, 26, hd)],
    [0.82, (Q) => B(Q, -178, 6, -6, 6, 4, 2, hd)], // shoot forward, kick
    [1, (Q) => B(Q, -178, 6, -4, 4, 6, 3, hd)],
  ] : [
    [0, (Q) => B(Q, -176, 8, -6, 4, 8, 3, hd)],
    [0.3, (Q) => B(Q, -122, 72, -18, 4, 8, 3, (hd + up) / 2)], // out-sweep
    [0.48, (Q) => B(Q, -72, 26, -118, -48, 112, 24, up)], // in-sweep, head up for air, knees drawn up and out
    [0.66, (Q) => B(Q, -150, 10, -60, -30, 70, 32, hd)], // hands forward, the frog kick
    [0.8, (Q) => B(Q, -176, 8, -6, 6, 6, 4, hd)], // glide
    [1, (Q) => B(Q, -176, 8, -6, 4, 8, 3, hd)],
  ]);
  return 18;
}

// ---------- cover (src/cover.js): cv = { high, wall (+1: the cover is on the body's left), peek 0..1, blind, hit, edge } ----------
// Low: a deep crouch, shoulder and head tucked in toward the cover, rising to a half crouch to aim over it.
// High: upright with the back turned into the wall and the head looking along it; leaning out to aim.
function coverBody(P, cv, sp, ch, dt) {
  const w = cv.wall, pk = cv.peek || 0, hit = cv.hit || 0;
  if (sp > 0.2) ch.walk = (ch.walk || 0) + dt * (4 + sp * 3.5);
  const sh = sp > 0.2 ? Math.sin(ch.walk || 0) : 0, lift = Math.max(0, sh), lift2 = Math.max(0, -sh);
  if (!cv.high) {
    const c = 1 - Math.max(pk * 0.7, (cv.blind || 0) * 0.3); // (blind fire: up a little, to get the gun over the top)
    P.root[1] = -0.55 * c; P.root[0] = 0.05 * w * c + 0.06 * w * hit;
    // the leg nearer the cover kneels, the outer one is planted ready to push off
    const kn = w > 0 ? 'L' : 'R', pl = w > 0 ? 'R' : 'L';
    set(P, 'thigh' + kn, (-38 - 20 * lift) * c, 0, 6 * w * c); set(P, 'shin' + kn, (128 - 20 * lift) * c); set(P, 'foot' + kn, 35 * c);
    set(P, 'thigh' + pl, (-100 + 18 * lift2) * c, 0, -14 * w * c); set(P, 'shin' + pl, (112 - 25 * lift2) * c); set(P, 'foot' + pl, -18 * c);
    set(P, 'hips', 6 * c, 14 * w * c, 0);
    set(P, 'spine', 26 * c, 18 * w * c, (14 * c + 12 * hit) * w); set(P, 'chest', 10 * c, 10 * w * c, 6 * w * c);
    set(P, 'neck', -6 * c); set(P, 'head', -14 * c, -34 * w * c, -8 * w * c);
  } else {
    const c = 1 - pk;
    P.root[0] = (0.07 + 0.06 * hit) * w * c;
    set(P, 'hips', 0, -34 * w * c, 3 * w * c);
    set(P, 'spine', -4 * c, -8 * w * c, (7 + 12 * hit) * w * c); set(P, 'chest', -6 * c, -6 * w * c, 4 * w * c);
    set(P, 'neck', 0, 18 * w * c); set(P, 'head', -2, 34 * w * c, 6 * w * c);
    set(P, 'thighL', -4 - 22 * lift, 0, 7); set(P, 'thighR', -4 - 22 * lift2, 0, -7); set(P, 'shinL', 6 + 35 * lift); set(P, 'shinR', 6 + 35 * lift2); set(P, 'footL', -4); set(P, 'footR', -4);
    if (pk > 0) { add(P, 'spine', 0, 0, -14 * w * pk); P.root[0] -= 0.08 * w * pk; }
  }
}
function coverArms(P, cv, st) {
  const w = cv.wall, gun = st.weapon === 'gun', near = w > 0 ? 'L' : 'R', far = w > 0 ? 'R' : 'L';
  if (cv.blind && gun) { // the gun held up over the top (low) or out round the side (high) without looking
    if (!cv.high) { armsUp(P, 'R', -172, 0, 6, -18); armsUp(P, 'L', st.rifle ? -160 : -40, 0, st.rifle ? -4 : 20, st.rifle ? -30 : -110); add(P, 'head', 22); add(P, 'neck', 10); add(P, 'spine', 8); }
    else { armsUp(P, 'R', -92, 0, -6, -4); armsUp(P, 'L', st.rifle ? -88 : -30, 0, st.rifle ? -26 : 10, st.rifle ? -12 : -100); add(P, 'head', 14, -30 * w); }
    return;
  }
  if (gun) { // ready: muzzle up by the shoulder, the other hand on it
    if (st.rifle) { armsUp(P, 'R', -38, 0, -8, -112); armsUp(P, 'L', -64, 0, -28, -104); set(P, 'handR', 0, 0, 14); }
    else { armsUp(P, 'R', -32, 0, 6, -138); armsUp(P, 'L', -44, 0, -22, -98); set(P, 'handR', 30, 0, 0); }
    return;
  }
  if (!cv.high) { armsUp(P, near, -48, 0, 34, -38); armsUp(P, far, -42, 0, -4, -78); } // a hand on the cover, the other on the knee
  else { armsUp(P, near, 12, 0, 26, -24); armsUp(P, far, -16, 0, -6, -40); } // palm flat to the wall
}

// ---------- hit reactions (combat.js react() sets ch.react = { kind, t, dur, mag, sx }) ----------
function reactPose(P, r) {
  const u = r.t / r.dur, a = (u < 0.14 ? sm(u / 0.14) : 1 - sm((u - 0.14) / 0.86)) * r.mag, sx = r.sx;
  switch (r.kind) {
    case 'head': add(P, 'head', -36 * a, 22 * sx * a); add(P, 'neck', -14 * a); add(P, 'spine', -12 * a); add(P, 'chest', -8 * a); add(P, 'upper_armL', 18 * a, 0, 10 * a); add(P, 'upper_armR', 18 * a, 0, -10 * a); P.root[2] -= 0.05 * a; break;
    case 'gut': add(P, 'spine', 32 * a); add(P, 'chest', 16 * a); add(P, 'head', 12 * a); P.root[1] -= 0.08 * a; P.root[2] -= 0.04 * a; add(P, 'thighL', -14 * a); add(P, 'thighR', -14 * a); add(P, 'shinL', 26 * a); add(P, 'shinR', 26 * a);
      add(P, 'upper_armL', -26 * a, 0, -12 * a); add(P, 'upper_armR', -26 * a, 0, 12 * a); add(P, 'forearmL', -45 * a); add(P, 'forearmR', -45 * a); break;
    case 'side': add(P, 'spine', 4 * a, 20 * sx * a, 22 * sx * a); add(P, 'chest', 0, 14 * sx * a, 12 * sx * a); add(P, 'head', 0, -18 * sx * a, 18 * sx * a); add(P, sx > 0 ? 'upper_armR' : 'upper_armL', -10 * a, 0, -30 * sx * a); P.root[0] += 0.06 * sx * a; P.root[1] -= 0.03 * a; break;
    case 'back': add(P, 'spine', 26 * a); add(P, 'chest', 10 * a); add(P, 'head', -22 * a); add(P, 'upper_armL', 28 * a, 0, 14 * a); add(P, 'upper_armR', 28 * a, 0, -14 * a); P.root[2] += 0.07 * a; break;
    case 'leg': P.root[1] -= 0.13 * a; add(P, 'thighL', -22 * a); add(P, 'shinL', 48 * a); add(P, 'hips', 0, 0, 9 * a); add(P, 'spine', 10 * a, 0, -8 * a); add(P, 'upper_armL', -20 * a, 0, 16 * a); break;
  }
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

  if (st.act && !dead) {
    rate = actPose(P, ch, st.act, t, st);
  } else if (dead) { // limp on the ground (used when there's no ragdoll)
    ch.deadT = Math.min(1, (ch.deadT || 0) + dt * 2.5);
    P.root[1] = -0.78 * sm(ch.deadT);
    set(P, 'hips', -88 * sm(ch.deadT), 0, ch.roll * 10);
    armsUp(P, 'L', -20, 60, -20); armsUp(P, 'R', -10, 75, -30);
    set(P, 'thighL', -6, 0, 10); set(P, 'thighR', 4, 0, -6); set(P, 'shinL', 14); set(P, 'shinR', 6);
    set(P, 'head', -10, 30 * ch.roll); rate = 8;
  } else if (ch.getUp > 0) { // after a ragdoll: get up from lying face down or face up (ragdoll.js sets getUp / getUpFace)
    ch.getUp = Math.max(0, ch.getUp - dt);
    const dur = ch.getUpDur || 1.2;
    rate = actPose(P, ch, { n: ch.getUpFace ? 'getUpFront' : 'getUpBack', k: 1 - ch.getUp / dur }, t, st);
    if (ch.getUp <= 0) ch.getUpDur = 0;
  } else if (st.drive || st.sit) {
    stand(P, t, ch);
    P.root[1] = -0.42; set(P, 'thighL', -88, 0, 4); set(P, 'thighR', -88, 0, -4); set(P, 'shinL', 85); set(P, 'shinR', 85); set(P, 'footL', -5); set(P, 'footR', -5);
    set(P, 'spine', -4);
    if (st.drive) { armsUp(P, 'L', -55, 8, -45); armsUp(P, 'R', -55, 8, -45); set(P, 'handL', 0, 0, -20); set(P, 'handR', 0, 0, 20); if (st.steer) { add(P, 'upper_armL', st.steer * 12); add(P, 'upper_armR', -st.steer * 12); } }
    else { armsUp(P, 'L', -18, 4, -55); armsUp(P, 'R', -18, 4, -55); }
    if (st.pedal) { pedalPose(P, st.pedal); rate = 40; } // riding a bicycle (ebike.js works out the leg angles from the crank)
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
    rate = swimPose(P, ch, st.swim === true ? {} : st.swim, t, dt, sp);
  } else if (st.climb !== undefined) {
    // 0..1 up a wall: jump and reach, hang on the ledge, haul the chest over, knee up, stand
    keys(P, st.climb, [
      [0, (Q) => { stand(Q, t, ch); Q.root[1] = -0.12; set(Q, 'thighL', -30); set(Q, 'shinL', 40); set(Q, 'thighR', -20); set(Q, 'shinR', 35); armsUp(Q, 'L', -120, 0, 10, -40); armsUp(Q, 'R', -120, 0, 10, -40); }],
      [0.25, (Q) => { armsUp(Q, 'L', -172, 0, 12, -12); armsUp(Q, 'R', -172, 0, 12, -12); set(Q, 'spine', 4); set(Q, 'head', -18); set(Q, 'thighL', -25); set(Q, 'shinL', 50); set(Q, 'thighR', 5); set(Q, 'shinR', 30); }],
      [0.55, (Q) => { armsUp(Q, 'L', -150, 0, 22, -95); armsUp(Q, 'R', -150, 0, 22, -95); set(Q, 'spine', 25); set(Q, 'head', -10); set(Q, 'thighL', -70); set(Q, 'shinL', 95); set(Q, 'thighR', -15); set(Q, 'shinR', 40); }],
      [0.8, (Q) => { Q.root[1] = -0.3; armsUp(Q, 'L', -70, 0, 25, -60); armsUp(Q, 'R', -70, 0, 25, -60); set(Q, 'spine', 35); set(Q, 'thighL', -100); set(Q, 'shinL', 110); set(Q, 'thighR', -30); set(Q, 'shinR', 60); }],
      [1, (Q) => stand(Q, t, ch)],
    ]);
    rate = 24;
  } else if (st.vault !== undefined) {
    const k = st.vault;
    set(P, 'hips', 10, 0, 20 * Math.sin(k * Math.PI)); armsUp(P, 'L', -60, 30, -10); set(P, 'thighL', -70 * Math.sin(k * Math.PI)); set(P, 'thighR', -50 * Math.sin(k * Math.PI)); set(P, 'shinL', 60); set(P, 'shinR', 40);
    armsUp(P, 'R', -20, 50, -10); rate = 24;
  } else {
    // ---- on your feet: idle / walk / run, then upper-body overlays ----
    const run = clamp01((sp - 2.6) / 2.4);
    if (sp > 0.25) {
      // st.moveRel: which way the feet go relative to where the body faces (aiming: strafing / backpedalling).
      // The hips turn toward the movement (or away from it, walking backwards) and the chest turns back to the aim.
      const mr = st.moveRel || 0, back = Math.abs(mr) > 1.95;
      ch.walk = (ch.walk || 0) + dt * (sp < 2.6 ? sp * 2.9 * (STRIDE[ch.style] || 1) : 7.5 + sp * 0.75) * (back ? -1 : 1);
      locomote(P, ch.walk, sp, run, ch);
      if (mr) {
        let yaw = (back ? mr - Math.PI * Math.sign(mr) : mr) / DEG;
        yaw = Math.max(-62, Math.min(62, yaw));
        add(P, 'hips', 0, yaw); add(P, 'spine', 0, -yaw * 0.55); add(P, 'chest', 0, -yaw * 0.3); add(P, 'head', 0, -yaw * 0.15);
      }
    } else stand(P, t, ch);
    if (st.crouch) { P.root[1] -= 0.35; add(P, 'thighL', -60); add(P, 'thighR', -60); add(P, 'shinL', 85); add(P, 'shinR', 85); add(P, 'footL', -25); add(P, 'footR', -25); add(P, 'spine', 22); add(P, 'head', -12); }
    if (st.limp) { add(P, 'hips', 0, 0, Math.sin(ch.walk || 0) * 6); P.root[1] -= Math.max(0, Math.sin(ch.walk || 0)) * 0.04; add(P, 'thighR', 10); }
    if (st.cane) { add(P, 'spine', 14); add(P, 'chest', 6); add(P, 'head', -10); armsUp(P, 'R', -25 + Math.sin(ch.walk || 0) * 10, 6, -10); }
    if (st.skate) { P.root[1] -= 0.08; set(P, 'thighL', -10, 0, 12); set(P, 'thighR', 10, 0, -12); set(P, 'shinL', 15); set(P, 'shinR', 15); set(P, 'hips', 0, 70); set(P, 'spine', 5, -50); armsUp(P, 'L', 0, 25, -10); armsUp(P, 'R', 0, 25, -10); }
    const pitch = st.pitch || 0;
    if (st.cover) { P.root[1] -= 0.4; add(P, 'thighL', -70); add(P, 'thighR', -70); add(P, 'shinL', 95); add(P, 'shinR', 95); add(P, 'spine', 15); }
    if (st.coverPose) { coverBody(P, st.coverPose, sp, ch, dt); rate = 20; }
    if (st.melee || st.punch) { // a combo move (src/combat.js) or an NPC's punches (punch: { i: 0 jab .. 3 uppercut, 4 kick, t: 0..1 })
      const m = st.melee || { n: PUNCH_N[st.punch.i] || 'jab', k: st.punch.t };
      meleePose(P, m.n, clamp01(m.k), sp <= 0.25);
      rate = 42;
    } else if (st.swing > 0) { // two-handed bat swing (or a big punch when unarmed); swing = progress 0..1
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
    } else if (st.shove) { const s1 = Math.sin(clamp01(st.shove) * Math.PI); armsUp(P, 'L', -80 * s1, 0, -10, -60 + 50 * s1); armsUp(P, 'R', -80 * s1, 0, -10, -60 + 50 * s1); set(P, 'spine', 10 * s1); rate = 28; }
    else if (st.aim && st.weapon === 'gun') {
      const rifle = st.rifle;
      if (rifle) { armsUp(P, 'R', -55 - pitch, 0, -10, -105); armsUp(P, 'L', -80 - pitch, 0, -25, -15); set(P, 'handR', 0, 0, 10); set(P, 'chest', 0, 15); set(P, 'head', -pitch * 0.3, -15); }
      else { armsUp(P, 'R', -88 - pitch, 0, 8, -4); armsUp(P, 'L', -72 - pitch, 0, -32, -38); set(P, 'chest', 0, 8); set(P, 'head', -pitch * 0.4, -6); }
      set(P, 'spine', P.spine[0] - pitch * 0.3, P.spine[1] + 6);
      // the upper body leads where the camera looks while the feet catch up (st.aimYaw, radians, + = to the left)
      if (st.aimYaw) { const y = Math.max(-50, Math.min(50, st.aimYaw / DEG)); add(P, 'spine', 0, y * 0.45); add(P, 'chest', 0, y * 0.4); add(P, 'head', 0, y * 0.15); }
      if (st.recoil > 0) { // kick: the arms snap up and the shoulders rock back, then settle
        const r = st.recoil * (rifle ? 0.8 : 1);
        add(P, 'upper_armR', -r * 14); add(P, 'upper_armL', -r * 11); add(P, 'forearmR', -r * 10); add(P, 'chest', -r * 5); add(P, 'head', -r * 3); P.root[2] -= r * 0.02;
      }
      rate = 26;
    } else if (st.reload > 0) {
      // tip the gun, drop the mag (left hand to the belt), slap a fresh one in, rack it
      const k = st.reload, base = (Q) => { armsUp(Q, 'R', -50, 0, -18, -85); set(Q, 'handR', 0, 0, 25); set(Q, 'head', 18); set(Q, 'spine', 6); };
      const C = (fn) => (Q) => { copyPose(Q, P); base(Q); fn(Q); };
      keys(P, k, [
        [0, C((Q) => armsUp(Q, 'L', -60, 0, -28, -70))],
        [0.3, C((Q) => armsUp(Q, 'L', 5, 0, 18, -25))],
        [0.6, C((Q) => armsUp(Q, 'L', -55, 0, -26, -80))],
        [0.78, C((Q) => { armsUp(Q, 'L', -40, 0, -10, -55); set(Q, 'chest', 0, -8); })],
        [1, C((Q) => armsUp(Q, 'L', -60, 0, -28, -70))],
      ]);
    } else if (st.coverPose) { coverArms(P, st.coverPose, st);
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
    if (ch.react) { reactPose(P, ch.react); rate = Math.max(rate, 30); }
  }
  if (ch.react && (ch.react.t += dt) >= ch.react.dur) ch.react = null;
  if (st.flinch) ch.flinch = 1;
  // ease toward the target pose
  if (!ch.posed) { copyPose(cur, P); ch.posed = true; } else lerpPose(cur, P, 1 - Math.exp(-dt * rate));
  writePose(ch, cur);
}
// make the pose snap (after a teleport, ragdoll release, etc.)
export function snapPose(ch) { ch.posed = false; }
