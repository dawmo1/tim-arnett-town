// People on screen: built from the Blender model (people/rig.js), dressed from the shared atlas
// (people/paint.js) and animated by people/pose.js. This file keeps the small API the rest of the
// game uses: makeCharacter, placeCharacter, animateCharacter, disposeCharacter, nameTag, mat.
import * as THREE from 'three';
import { initPeople, buildPerson, propMesh, setExpression, T } from './people/rig.js';
import { initPose, animate, snapPose } from './people/pose.js';
import { randomLook as rl, roleLook, normLook } from './people/looks.js';

const mats = new Map();
export function mat(c) {
  let m = mats.get(c);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.82, metalness: 0 }); mats.set(c, m); }
  return m;
}
export const randomLook = (r = Math.random) => rl(r);
export { roleLook, normLook };

let ready = false;
export function initCharacters(quality) { if (!ready) { initPeople(quality); initPose(); ready = true; } }

// held weapons (simple shapes until the weapon models replace them): in the hand's canonical frame
// the arm hangs down, so "down" (-Y) is where the hand points and -Z is the back of the hand.
const gunMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.45, metalness: 0.6 });
const batMat = new THREE.MeshStandardMaterial({ color: 0x9c6b3a, roughness: 0.6 });
function canonicalChild(bone, name, obj, pos, rot = [0, 0, 0]) {
  // place obj at `pos` (character space at the canonical pose, relative to the bone) and orient it
  const r = boneRest(name), q = r.Ci;
  obj.position.copy(new THREE.Vector3(...pos).applyQuaternion(q));
  obj.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)));
  bone.add(obj);
  return obj;
}
let REST_CACHE = null;
function boneRest(name) {
  if (!REST_CACHE) REST_CACHE = {};
  if (!REST_CACHE[name]) { const { REST } = POSE; REST_CACHE[name] = { Ci: REST[name].C.clone().invert() }; }
  return REST_CACHE[name];
}
import * as POSE from './people/pose.js';

export function makeCharacter(look, opts = {}) {
  if (!ready) initCharacters();
  let L = look;
  if (opts.hat === 'cop') L = roleLook('police');
  else if (opts.role) L = roleLook(opts.role);
  const p = buildPerson(L);
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body); body.add(p.rig);
  const seed = Math.random() * 100;
  const female = p.look[1] === 3;
  p.rig.scale.setScalar((female ? 0.95 : 1.0) * (0.96 + (seed % 1) * 0.08));
  const B = p.bones;
  // gun: barrel down the hand, grip toward the back of the hand
  const gun = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.2, 0.045), gunMat); barrel.position.set(0, -0.08, 0.0); gun.add(barrel);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.045, 0.1), gunMat); grip.position.set(0, 0.0, -0.04); gun.add(grip);
  canonicalChild(B.handR, 'handR', gun, [0, -0.07, 0.01]);
  const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.018, 0.85, 8).translate(0, -0.35, 0), batMat);
  canonicalChild(B.handR, 'handR', bat, [0, -0.06, 0]);
  gun.visible = bat.visible = false;
  gun.traverse((o) => { o.castShadow = true; }); bat.castShadow = true;
  const ch = { g, body, rig: p.rig, mesh: p.body, acc: p.acc, mat: p.mat, bones: B, look: p.look, gun, bat, props: {}, seed, roll: (Math.random() - 0.5) * 2, walk: 0, deadT: 0 };
  return ch;
}

// carried things on the right bone, in the canonical frame (arms hanging down)
const PROP_AT = {
  backpack: ['chest', [0, 0.05, -0.2], [0, 0, 0]],
  bag: ['handL', [0.02, -0.12, 0], [0, 0, 0]],
  mailbag: ['hips', [-0.22, -0.05, 0.02], [0, 0, 0]],
  guitar: ['chest', [0, -0.05, 0.17], [0, 0, 0.9]],
  cane: ['handR', [0, -0.05, 0.02], [0, 0, 0]],
  phone: ['handL', [0, -0.08, 0.03], [0, 0, 0]],
  cig: ['handR', [0, -0.1, 0.02], [0, 0, 0]],
  coffee: ['handL', [0, -0.09, 0.03], [0, 0, 0]],
  sign: ['handR', [0, -0.04, 0], [Math.PI, 0, 0]],
};
export function setProp(ch, name, on = true) {
  if (!ch.bones) return null;
  let o = ch.props[name];
  if (on && !o) {
    const at = PROP_AT[name]; if (!at) return null;
    o = propMesh(name, ch.mat); if (!o) return null;
    canonicalChild(ch.bones[at[0]], at[0], o, at[1], at[2]);
    ch.props[name] = o;
  }
  if (o) o.visible = on;
  return o;
}

export function disposeCharacter(c) { c.mat?.dispose(); }

export function placeCharacter(c, x, y, z, h) {
  if (c.rag) return;
  c.g.position.set(x, y, z);
  c.g.rotation.set(0, h, 0);
}
export function animateCharacter(c, dt, st) {
  if (c.rag) return;
  c.gun.visible = st.weapon === 'gun';
  c.bat.visible = st.weapon === 'bat';
  c.animSpeed = st.speed || 0;
  setExpression(c, !!(st.cower || st.handsUp || st.beg || st.scared || st.flee));
  animate(c, dt, st);
}
export { snapPose };

export function nameTag(text, color = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.font = 'bold 34px system-ui, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,.75)';
  x.strokeText(text, 128, 32);
  x.fillStyle = color; x.fillText(text, 128, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(2, 0.5, 1);
  s.position.y = 2.35;
  s.renderOrder = 10;
  return s;
}
