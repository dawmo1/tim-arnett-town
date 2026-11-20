// Ragdolls with Rapier physics. A ragdoll is six bodies (torso, head, 2 arms, 2 legs) joined at the
// shoulders, hips and neck. Each body's origin sits on the matching joint of the box character,
// so the character's existing groups can simply follow the bodies.
import * as THREE from 'three';
import RAPIER from '../vendor/rapier.js';
import { tiles, TILE, tileKey } from './city/data.js';

let world = null, ready = false;
const active = [];
const STEP = 1 / 60;
let acc = 0;
const GROUP_WORLD = 0x0001, GROUP_RAG = 0x0002;
const groups = (member, filter) => (member << 16) | filter;

export async function initPhysics() {
  await RAPIER.init();
  world = new RAPIER.World({ x: 0, y: -14, z: 0 });
  ready = true;
}
export const physicsReady = () => ready;

// The ground and walls only exist for the 3x3 tiles around the player (that's where people fall over).
const statics = new Map(); // tile key -> rigid body
export function syncPhysics(px, pz) {
  if (!ready) return;
  const cx = Math.floor(px / TILE), cz = Math.floor(pz / TILE), want = new Set();
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const key = tileKey(cx + dx, cz + dz), t = tiles.get(key);
    if (!t || !t.boxes) continue;
    want.add(key);
    if (statics.has(key)) continue;
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const v = new Float32Array(26 * 26 * 3), idx = new Uint32Array(25 * 25 * 6);
    for (let j = 0; j < 26; j++) for (let i = 0; i < 26; i++) { const k = j * 26 + i; v[k * 3] = t.ox + i * 8; v[k * 3 + 1] = t.h[k] / 100; v[k * 3 + 2] = t.oz + j * 8; }
    let n = 0;
    for (let j = 0; j < 25; j++) for (let i = 0; i < 25; i++) { const a = j * 26 + i; idx.set([a, a + 26, a + 27, a, a + 27, a + 1], n); n += 6; }
    world.createCollider(RAPIER.ColliderDesc.trimesh(v, idx).setCollisionGroups(groups(GROUP_WORLD, 0xffff)).setFriction(0.9), body);
    const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    for (const b of t.boxes) {
      q.setFromAxisAngle(up, b.rot);
      world.createCollider(RAPIER.ColliderDesc.cuboid(b.hu, b.h / 2, b.hv).setTranslation(b.cx, b.y0 + b.h / 2, b.cz).setRotation(q).setCollisionGroups(groups(GROUP_WORLD, 0xffff)).setFriction(0.9), body);
    }
    statics.set(key, body);
  }
  for (const [key, body] of statics) if (!want.has(key)) { world.removeRigidBody(body); statics.delete(key); }
}

// Six bodies: torso, head, two arms, two legs, joined with hinges at the neck, shoulders and hips.
// All bodies start with the character's own heading (so the hinge frames line up); each remembers
// how its bone sat relative to it, and while the ragdoll runs the torso carries the whole character
// and the head/arms/legs set their bones' rotations.
const LIMITS = { head: [-0.7, 0.5], armL: [-2.9, 0.9], armR: [-2.9, 0.9], legL: [-1.7, 0.45], legR: [-1.7, 0.45] };
// part: [bone that is moved, bone where the part ends (for its length/direction), radius]
const PART = { head: ['head', null, 0.12], armL: ['upper_armL', 'handL', 0.05], armR: ['upper_armR', 'handR', 0.05], legL: ['thighL', 'footL', 0.07], legR: ['thighR', 'footR', 0.07] };
const tv = new THREE.Vector3(), tq = new THREE.Quaternion(), tq2 = new THREE.Quaternion(), tv2 = new THREE.Vector3(), tv3 = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0), tm = new THREE.Matrix4(), ts = new THREE.Vector3();

// Knock a character over. vel = {x,y,z} launch velocity; spin = extra tumble.
// opts: { dead: stays down, getUp: seconds before standing (alive), onUp(pos, heading) }
export function ragdoll(ch, vel, opts = {}) {
  if (!ready || !ch.bones) return null;
  if (ch.rag) { // already flopping: just add the push
    for (const b of ch.rag.bodies) b.applyImpulse({ x: vel.x * 0.4, y: vel.y * 0.4, z: vel.z * 0.4 }, true);
    if (opts.dead) ch.rag.dead = true;
    return ch.rag;
  }
  ch.g.updateMatrixWorld(true);
  const q0 = new THREE.Quaternion(); ch.g.getWorldQuaternion(q0);
  const q0i = q0.clone().invert();
  const B = ch.bones;
  const rag = { ch, bodies: [], joints: [], dead: !!opts.dead, t: 0, still: 0, getUp: opts.getUp ?? 2.2, onUp: opts.onUp, frozen: false, parts: [] };
  const map = {};
  const pos = (b) => b.getWorldPosition(new THREE.Vector3());
  const hipsP = pos(B.hips), neckP = pos(B.neck);
  const mk = (key, p, collider, density, damp) => {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x, p.y + 0.02, p.z).setRotation(q0).setLinearDamping(0.12).setAngularDamping(damp).setCcdEnabled(true));
    world.createCollider(collider.setDensity(density).setFriction(1.1).setRestitution(0).setCollisionGroups(groups(GROUP_RAG, GROUP_WORLD)), body);
    const s = key === 'body' ? 1 : 0.95 + Math.random() * 0.1;
    body.setLinvel({ x: vel.x * s, y: vel.y * s, z: vel.z * s }, true);
    const sp = opts.spin ?? 1.2, hv = Math.hypot(vel.x, vel.z) || 1;
    body.setAngvel({ x: (vel.z / hv) * Math.min(4, hv * 0.5) + (Math.random() - 0.5) * sp, y: (Math.random() - 0.5) * sp * 0.5, z: -(vel.x / hv) * Math.min(4, hv * 0.5) + (Math.random() - 0.5) * sp }, true);
    map[key] = body; rag.bodies.push(body);
    return body;
  };
  // collider oriented from a joint toward a point (in the body's frame)
  const along = (from, to, r, cap = true) => {
    const d = tv.copy(to).sub(from).applyQuaternion(q0i), len = Math.max(0.1, d.length()); d.normalize();
    const rot = new THREE.Quaternion().setFromUnitVectors(Y, d);
    const c = cap ? RAPIER.ColliderDesc.capsule(Math.max(0.02, len / 2 - r), r) : RAPIER.ColliderDesc.cuboid(0.16, len / 2, 0.11);
    return c.setTranslation(d.x * len / 2, d.y * len / 2, d.z * len / 2).setRotation(rot);
  };
  const torso = mk('body', hipsP, along(hipsP, neckP, 0, false), 3.2, 1.6);
  for (const key of ['head', 'armL', 'armR', 'legL', 'legR']) {
    const [bn, end, r] = PART[key], bone = B[bn], jp = pos(bone);
    const ep = end ? pos(B[end]) : jp.clone().add(tv2.set(0, 0.24, 0).applyQuaternion(q0));
    if (key.startsWith('arm')) { const hand = B[end]; ep.add(tv3.set(0, 0, 0).add(pos(hand)).sub(pos(B[end === 'handL' ? 'forearmL' : 'forearmR'])).multiplyScalar(0.6)); }
    mk(key, jp, key === 'head' ? RAPIER.ColliderDesc.ball(r).setTranslation(...tv.copy(ep).sub(jp).applyQuaternion(q0i).multiplyScalar(0.45).toArray()) : along(jp, ep, r), 1.4, 2.6);
    const wq = new THREE.Quaternion(); bone.getWorldQuaternion(wq);
    rag.parts.push({ key, bone, off: q0i.clone().multiply(wq) });
    // hinge: anchor in the torso's frame, at the joint
    const a1 = tv.copy(jp).sub(hipsP).applyQuaternion(q0i);
    const jd = RAPIER.JointData.revolute({ x: a1.x, y: a1.y - 0.02, z: a1.z }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
    const j = world.createImpulseJoint(jd, torso, map[key], true);
    j.setLimits(LIMITS[key][0], LIMITS[key][1]);
    if (rag.dead) j.configureMotorVelocity(0, 0.25); else j.configureMotorPosition(0, 6, 1.2);
    rag.joints.push(j);
  }
  // the whole character rides on the torso
  const t0 = new THREE.Matrix4().compose(new THREE.Vector3(hipsP.x, hipsP.y + 0.02, hipsP.z), q0, new THREE.Vector3(1, 1, 1));
  rag.gOff = t0.clone().invert().multiply(ch.g.matrixWorld);
  rag.map = map;
  ch.rag = rag;
  active.push(rag);
  // keep the cost down: only the newest 14 ragdolls simulate
  if (active.filter((r) => !r.frozen).length > 14) freeze(active.find((r) => !r.frozen));
  return rag;
}

function freeze(rag) {
  if (!rag || rag.frozen) return;
  rag.frozen = true;
  for (const j of rag.joints) world.removeImpulseJoint(j, true);
  for (const b of rag.bodies) world.removeRigidBody(b);
  rag.joints = []; rag.bodies = [];
}
// Remove a ragdoll and let the character animate normally again.
export function release(ch) {
  const rag = ch.rag; if (!rag) return;
  freeze(rag);
  const i = active.indexOf(rag); if (i >= 0) active.splice(i, 1);
  ch.rag = null;
  ch.g.quaternion.identity();
}
export function ragPos(ch) { const b = ch.rag && ch.rag.map.body; if (!b || ch.rag.frozen) return ch.g.position; const t = b.translation(); return { x: t.x, y: t.y, z: t.z }; }

export function updateRagdolls(dt) {
  if (!ready) return;
  acc = Math.min(acc + dt, STEP * 4);
  let steps = 0;
  while (acc >= STEP && steps < 4) { world.step(); acc -= STEP; steps++; }
  for (let i = active.length - 1; i >= 0; i--) {
    const rag = active[i], ch = rag.ch;
    rag.t += dt;
    if (rag.frozen) { active.splice(i, 1); if (!rag.dead) finishUp(rag); continue; }
    const Bd = rag.map.body, bt = Bd.translation(), br = Bd.rotation();
    tm.compose(tv.set(bt.x, bt.y, bt.z), tq.set(br.x, br.y, br.z, br.w), ts.set(1, 1, 1)).multiply(rag.gOff);
    tm.decompose(ch.g.position, ch.g.quaternion, ts);
    ch.g.updateMatrixWorld(true);
    for (const p of rag.parts) {
      const r = rag.map[p.key].rotation();
      tq.set(r.x, r.y, r.z, r.w).multiply(p.off); // wanted world rotation of the bone
      p.bone.parent.getWorldQuaternion(tq2);
      p.bone.quaternion.copy(tq2.invert().multiply(tq));
      p.bone.updateMatrixWorld(true);
    }
    const v = Bd.linvel(), speed = Math.hypot(v.x, v.y, v.z);
    rag.still = speed < 0.4 ? rag.still + dt : 0;
    if (rag.dead && rag.still > 1.5) freeze(rag); // lies there without costing anything
    if (!rag.dead && rag.t > rag.getUp && rag.still > 0.4) { active.splice(i, 1); finishUp(rag); }
    if (bt.y < -20) { freeze(rag); }
  }
}
function finishUp(rag) {
  const ch = rag.ch, p = rag.map && !rag.frozen ? rag.map.body.translation() : ch.g.position;
  const pos = { x: p.x, z: p.z };
  // which way is the torso facing on the ground? stand up facing that way
  tv2.set(0, 0, 1).applyQuaternion(ch.g.quaternion);
  const h = Math.atan2(tv2.x, tv2.z);
  release(ch);
  ch.getUp = 0.7; // crouch, then stand (see people/pose.js)
  if (rag.onUp) rag.onUp(pos, h);
}
// The pose a dead ragdoll ended in stays on screen; this lets the caller know where the body is.
export function isRagdolled(ch) { return !!ch.rag; }
