// Ragdolls with Rapier physics. A ragdoll is six bodies (torso, head, 2 arms, 2 legs) joined at the
// shoulders, hips and neck. Each body's origin sits on the matching joint of the box character,
// so the character's existing groups can simply follow the bodies.
import * as THREE from 'three';
import RAPIER from '../vendor/rapier.js';
import * as W from './world.js';

let world = null, ready = false;
const active = [];
const STEP = 1 / 60;
let acc = 0;
const GROUP_WORLD = 0x0001, GROUP_RAG = 0x0002;
const groups = (member, filter) => (member << 16) | filter;

export async function initPhysics() {
  await RAPIER.init();
  world = new RAPIER.World({ x: 0, y: -18, z: 0 });
  const fixed = (desc, x, y, z, q) => {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z).setRotation(q || { x: 0, y: 0, z: 0, w: 1 }));
    world.createCollider(desc.setCollisionGroups(groups(GROUP_WORLD, 0xffff)).setFriction(0.9), body);
  };
  fixed(RAPIER.ColliderDesc.cuboid(4000, 0.5, 4000), 0, -0.5, 0); // ground (and water surface)
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (const b of W.colliders) {
    q.setFromAxisAngle(up, b.rot);
    fixed(RAPIER.ColliderDesc.cuboid(b.hu, b.h / 2, b.hv), b.cx, b.h / 2, b.cz, q);
  }
  for (const r of W.ramps) {
    const L = r.len / 2, Wd = r.wid / 2, hd = Math.atan2(r.fx, r.fz);
    const pts = new Float32Array([-Wd, 0, -L, Wd, 0, -L, -Wd, 0, L, Wd, 0, L, -Wd, r.h, L, Wd, r.h, L]);
    const d = RAPIER.ColliderDesc.convexHull(pts);
    if (d) fixed(d, r.x, 0.02, r.z, q.setFromAxisAngle(up, hd));
  }
  ready = true;
}
export const physicsReady = () => ready;

const PARTS = [
  // key, pivot (relative to character feet), collider
  ['body', [0, 0, 0], () => RAPIER.ColliderDesc.cuboid(0.26, 0.36, 0.15).setTranslation(0, 1.15, 0)],
  ['head', [0, 1.53, 0], () => RAPIER.ColliderDesc.ball(0.19).setTranslation(0, 0.22, 0)],
  ['shL', [-0.37, 1.48, 0], () => RAPIER.ColliderDesc.capsule(0.22, 0.08).setTranslation(0, -0.33, 0)],
  ['shR', [0.37, 1.48, 0], () => RAPIER.ColliderDesc.capsule(0.22, 0.08).setTranslation(0, -0.33, 0)],
  ['hipL', [-0.14, 0.85, 0], () => RAPIER.ColliderDesc.capsule(0.3, 0.1).setTranslation(0, -0.42, 0)],
  ['hipR', [0.14, 0.85, 0], () => RAPIER.ColliderDesc.capsule(0.3, 0.1).setTranslation(0, -0.42, 0)],
];
const tv = new THREE.Vector3(), tq = new THREE.Quaternion(), tq2 = new THREE.Quaternion(), tv2 = new THREE.Vector3();

// Knock a character over. vel = {x,y,z} launch velocity; spin = extra tumble.
// opts: { dead: stays down, getUp: seconds before standing (alive), onUp(pos) }
export function ragdoll(ch, vel, opts = {}) {
  if (!ready) return null;
  if (ch.rag) { // already flopping: just add the push
    for (const b of ch.rag.bodies) b.applyImpulse({ x: vel.x * 0.4, y: vel.y * 0.4, z: vel.z * 0.4 }, true);
    if (opts.dead) ch.rag.dead = true;
    return ch.rag;
  }
  // the ragdoll starts in the character's current pose
  ch.g.updateMatrixWorld(true);
  const rag = { ch, bodies: [], joints: [], dead: !!opts.dead, t: 0, still: 0, getUp: opts.getUp ?? 2.2, onUp: opts.onUp, frozen: false };
  const map = {};
  ch.body.rotation.set(0, 0, 0); ch.body.position.set(0, 0, 0);
  for (const [key, , collider] of PARTS) {
    const obj = key === 'body' ? ch.g : ch[key];
    obj.getWorldPosition(tv); obj.getWorldQuaternion(tq);
    const desc = RAPIER.RigidBodyDesc.dynamic().setTranslation(tv.x, tv.y + 0.02, tv.z).setRotation(tq).setLinearDamping(0.2).setAngularDamping(1.2).setCcdEnabled(true);
    const body = world.createRigidBody(desc);
    world.createCollider(collider().setDensity(key === 'body' ? 3 : 1.5).setFriction(0.8).setRestitution(0.05).setCollisionGroups(groups(GROUP_RAG, GROUP_WORLD)), body);
    const s = key === 'body' ? 1 : 0.95 + Math.random() * 0.1;
    body.setLinvel({ x: vel.x * s, y: vel.y * s, z: vel.z * s }, true);
    body.setAngvel({ x: (Math.random() - 0.5) * (opts.spin || 3), y: (Math.random() - 0.5) * 2, z: (Math.random() - 0.5) * (opts.spin || 3) }, true);
    map[key] = body; rag.bodies.push(body);
  }
  for (const [key, pivot] of PARTS) {
    if (key === 'body') continue;
    const j = RAPIER.JointData.spherical({ x: pivot[0], y: pivot[1], z: pivot[2] }, { x: 0, y: 0, z: 0 });
    rag.joints.push(world.createImpulseJoint(j, map.body, map[key], true));
  }
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
  for (const k of ['head', 'shL', 'shR', 'hipL', 'hipR']) { const p = PARTS.find((x) => x[0] === k)[1]; ch[k].position.set(p[0], p[1], p[2]); ch[k].quaternion.identity(); }
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
    const B = rag.map.body, bt = B.translation(), br = B.rotation();
    // the whole character follows the torso; limbs are placed relative to it
    ch.g.position.set(bt.x, bt.y, bt.z);
    ch.g.quaternion.set(br.x, br.y, br.z, br.w);
    tq.set(br.x, br.y, br.z, br.w).invert();
    for (const key of ['head', 'shL', 'shR', 'hipL', 'hipR']) {
      const b = rag.map[key], t = b.translation(), r = b.rotation();
      tv.set(t.x - bt.x, t.y - bt.y, t.z - bt.z).applyQuaternion(tq);
      ch[key].position.copy(tv);
      ch[key].quaternion.copy(tq).multiply(tq2.set(r.x, r.y, r.z, r.w));
    }
    const v = B.linvel(), speed = Math.hypot(v.x, v.y, v.z);
    rag.still = speed < 0.4 ? rag.still + dt : 0;
    if (rag.dead && rag.still > 1.5) freeze(rag); // lies there without costing anything
    if (!rag.dead && rag.t > rag.getUp && rag.still > 0.4) { active.splice(i, 1); finishUp(rag); }
    if (bt.y < -20) { freeze(rag); }
  }
}
function finishUp(rag) {
  const ch = rag.ch, p = rag.map ? (rag.frozen ? ch.g.position : rag.map.body.translation()) : ch.g.position;
  const pos = { x: p.x, z: p.z };
  // which way is the torso facing on the ground? stand up facing that way
  tv2.set(0, 0, 1).applyQuaternion(ch.g.quaternion);
  const h = Math.atan2(tv2.x, tv2.z);
  release(ch);
  if (rag.onUp) rag.onUp(pos, h);
}
// The pose a dead ragdoll ended in stays on screen; this lets the caller know where the body is.
export function isRagdolled(ch) { return !!ch.rag; }
